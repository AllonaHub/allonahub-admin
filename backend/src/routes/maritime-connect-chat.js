import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authContext, hasMfa, hasRole, supabaseAdmin } from "../lib/supabase.js";
import { classifyMarsohMessage, sanitizeMarsohText } from "../lib/marsoh-moderation.js";

const uuid = z.string().uuid();
const createSchema = z.object({ partner_id: uuid, candidate_room_id: uuid }).strict();
const sendSchema = z.object({ idempotency_key: uuid, body: z.string().min(1).max(2000) }).strict();

function fail(message, statusCode = 403, code = "MARITIME_CHAT_FORBIDDEN") {
  const error = new Error(message); error.statusCode = statusCode; error.code = code; error.exposeCode = true; return error;
}
function db(result) { if (result.error) throw fail("Firma sohbeti şu anda kullanılamıyor.", 503, "MARITIME_CHAT_DATABASE"); return result.data; }

async function memberOf(userId, partnerId) {
  const company = db(await supabaseAdmin.from("partner_businesses")
    .select("id,display_name,owner_id,status,verification_status,partner_type")
    .eq("id", partnerId).maybeSingle());
  if (!company || company.status !== "active" || company.verification_status !== "verified" || company.partner_type !== "maritime") return null;
  if (company.owner_id === userId) return company;
  const staff = db(await supabaseAdmin.from("partner_staff").select("user_id")
    .eq("partner_id", partnerId).eq("user_id", userId).eq("status", "active").maybeSingle());
  return staff ? company : null;
}

async function authorizedRoom(ctx, roomId, partnerId = null) {
  const room = db(await supabaseAdmin.from("maritime_private_candidate_rooms")
    .select("id,partner_id,application_id,seafarer_user_id,status,candidate_visible,expires_at")
    .eq("id", roomId).maybeSingle());
  if (!room || (partnerId && room.partner_id !== partnerId) || room.candidate_visible !== true
      || !["active", "offer", "hired"].includes(room.status)
      || (room.expires_at && Date.parse(room.expires_at) <= Date.now()) || !room.application_id) throw fail("Bu görüşme açık değil.");
  const application = db(await supabaseAdmin.from("maritime_hiring_applications")
    .select("status,candidate_consent_snapshot").eq("id", room.application_id).maybeSingle());
  if (!application || !["submitted", "shortlisted", "interviewing", "offer_sent", "offer_accepted", "hired"].includes(application.status)
      || application.candidate_consent_snapshot?.final_submission_confirmed !== true) throw fail("Adayın görüşme izni bulunmuyor.");
  let company = null;
  if (ctx.user.id === room.seafarer_user_id && hasRole(ctx.profile, "customer")) {
    company = db(await supabaseAdmin.from("partner_businesses")
      .select("id,display_name,status,verification_status,partner_type").eq("id", room.partner_id).maybeSingle());
    if (!company || company.status !== "active" || company.verification_status !== "verified" || company.partner_type !== "maritime") throw fail("Şirket doğrulanmadı.");
  } else if (hasRole(ctx.profile, "partner") && hasMfa(ctx)) company = await memberOf(ctx.user.id, room.partner_id);
  if (!company) throw fail("Bu görüşmeye erişiminiz yok.");
  return { room, company, candidate: ctx.user.id === room.seafarer_user_id };
}

async function threadAccess(request, threadId) {
  const ctx = await authContext(request);
  if (!ctx?.profilePersisted || ctx.profile.account_status !== "active") throw fail("Giriş yapmanız gerekiyor.", 401);
  const thread = db(await supabaseAdmin.from("maritime_connect_threads")
    .select("id,candidate_room_id,partner_id,seafarer_user_id,status")
    .eq("id", threadId).eq("thread_scope", "private_candidate").maybeSingle());
  if (!thread || thread.status !== "active") throw fail("Görüşme bulunamadı.", 404);
  const access = await authorizedRoom(ctx, thread.candidate_room_id, thread.partner_id);
  return { ctx, thread, ...access };
}

async function listThreads(ctx, partnerId) {
  const isPartner = hasRole(ctx.profile, "partner");
  if (isPartner && (!hasMfa(ctx) || !partnerId || !await memberOf(ctx.user.id, partnerId))) throw fail("Şirket yetkisi doğrulanamadı.");
  if (!isPartner && !hasRole(ctx.profile, "customer")) throw fail("Görüşme yetkisi bulunmuyor.");
  const query = supabaseAdmin.from("maritime_connect_threads")
    .select("id,candidate_room_id,partner_id,seafarer_user_id,status,created_at")
    .eq("thread_scope", "private_candidate").eq("status", "active")
    .order("created_at", { ascending: false }).limit(50);
  const rows = db(await (isPartner ? query.eq("partner_id", partnerId) : query.eq("seafarer_user_id", ctx.user.id))) || [];
  const result = [];
  for (const thread of rows) {
    let access;
    try { access = await authorizedRoom(ctx, thread.candidate_room_id, thread.partner_id); } catch { continue; }
    const latest = db(await supabaseAdmin.from("maritime_connect_messages")
      .select("id,body,sender_user_id,created_at").eq("thread_id", thread.id).eq("message_type", "text")
      .order("created_at", { ascending: false }).limit(1).maybeSingle());
    if (!latest) continue;
    const cursor = db(await supabaseAdmin.from("maritime_connect_read_cursors")
      .select("last_read_at").eq("thread_id", thread.id).eq("user_id", ctx.user.id).maybeSingle());
    let unreadQuery = supabaseAdmin.from("maritime_connect_messages")
      .select("id", { count: "exact", head: true }).eq("thread_id", thread.id)
      .eq("message_type", "text").neq("sender_user_id", ctx.user.id);
    if (cursor) unreadQuery = unreadQuery.gt("created_at", cursor.last_read_at);
    const unreadResult = await unreadQuery;
    if (unreadResult.error) throw fail("Okunmamış mesajlar alınamadı.", 503);
    const unread = Number(unreadResult.count || 0) > 0;
    const candidateProfile = isPartner ? db(await supabaseAdmin.from("profiles").select("full_name").eq("id", thread.seafarer_user_id).maybeSingle()) : null;
    result.push({ id: thread.id, company_name: access.company.display_name, candidate_user_id: thread.seafarer_user_id,
      candidate_name: candidateProfile?.full_name || "Aday", partner_id: thread.partner_id, last_message: latest.body.slice(0, 120), last_message_at: latest.created_at, unread });
  }
  return result;
}

export function registerMaritimeConnectChatRoutes(app) {
  app.get("/v1/maritime/connect-chat/eligible-rooms", async (request) => {
    const ctx = await authContext(request);
    if (!ctx?.profilePersisted || ctx.profile.account_status !== "active" || !hasRole(ctx.profile, "partner") || !hasMfa(ctx)) throw fail("Şirket yetkisi doğrulanamadı.", 401);
    const partnerId = uuid.parse(request.query?.partner_id);
    if (!await memberOf(ctx.user.id, partnerId)) throw fail("Şirket yetkisi doğrulanamadı.");
    const rooms = db(await supabaseAdmin.from("maritime_private_candidate_rooms")
      .select("id,partner_id,application_id,seafarer_user_id,status,candidate_visible,expires_at")
      .eq("partner_id", partnerId).eq("candidate_visible", true).in("status", ["active", "offer", "hired"])
      .order("created_at", { ascending: false }).limit(100)) || [];
    const eligible = [];
    for (const room of rooms) {
      try {
        await authorizedRoom(ctx, room.id, partnerId);
        const profile = db(await supabaseAdmin.from("profiles").select("full_name").eq("id", room.seafarer_user_id).maybeSingle());
        eligible.push({ id: room.id, candidate_user_id: room.seafarer_user_id, candidate_name: profile?.full_name || "Aday" });
      } catch { /* A closed or unconsented room is never offered for messaging. */ }
    }
    return { ok: true, rooms: eligible };
  });
  app.get("/v1/maritime/connect-chat/threads", async (request) => {
    const ctx = await authContext(request);
    if (!ctx?.profilePersisted || ctx.profile.account_status !== "active") throw fail("Giriş yapmanız gerekiyor.", 401);
    const partnerId = request.query?.partner_id ? uuid.parse(request.query.partner_id) : null;
    return { ok: true, threads: await listThreads(ctx, partnerId) };
  });

  app.post("/v1/maritime/connect-chat/threads", async (request) => {
    const ctx = await authContext(request);
    if (!ctx?.profilePersisted || ctx.profile.account_status !== "active" || !hasRole(ctx.profile, "partner") || !hasMfa(ctx)) throw fail("Şirket yetkisi doğrulanamadı.");
    const input = createSchema.parse(request.body || {});
    const { room } = await authorizedRoom(ctx, input.candidate_room_id, input.partner_id);
    let thread = db(await supabaseAdmin.from("maritime_connect_threads")
      .select("id").eq("candidate_room_id", room.id).eq("thread_scope", "private_candidate").maybeSingle());
    if (!thread) {
      const inserted = await supabaseAdmin.from("maritime_connect_threads").insert({
        candidate_room_id: room.id, partner_id: room.partner_id, seafarer_user_id: room.seafarer_user_id,
        thread_scope: "private_candidate", purpose: "consented_hiring_conversation", status: "active", created_by: ctx.user.id
      }).select("id").maybeSingle();
      thread = inserted.error ? db(await supabaseAdmin.from("maritime_connect_threads").select("id")
        .eq("candidate_room_id", room.id).eq("thread_scope", "private_candidate").maybeSingle()) : inserted.data;
    }
    if (!thread) throw fail("Görüşme açılamadı.", 503);
    return { ok: true, thread_id: thread.id };
  });

  app.get("/v1/maritime/connect-chat/threads/:threadId/messages", async (request) => {
    const { thread } = await threadAccess(request, uuid.parse(request.params.threadId));
    const before = request.query?.before ? z.string().datetime({ offset: true }).parse(request.query.before) : null;
    const limit = Math.min(50, Math.max(1, Number(request.query?.limit) || 30));
    let query = supabaseAdmin.from("maritime_connect_messages")
      .select("id,body,sender_user_id,created_at").eq("thread_id", thread.id).eq("message_type", "text")
      .order("created_at", { ascending: false }).limit(limit + 1);
    if (before) query = query.lt("created_at", before);
    const rows = db(await query) || [];
    return { ok: true, messages: rows.slice(0, limit), next_cursor: rows.length > limit ? rows[limit - 1].created_at : null };
  });

  app.post("/v1/maritime/connect-chat/threads/:threadId/messages", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request) => {
    const { ctx, thread } = await threadAccess(request, uuid.parse(request.params.threadId));
    const input = sendSchema.parse(request.body || {});
    const body = sanitizeMarsohText(input.body, 2000);
    if (!body) throw fail("Boş mesaj gönderilemez.", 400);
    const existing = db(await supabaseAdmin.from("maritime_connect_messages")
      .select("id,body,sender_user_id,created_at").eq("thread_id", thread.id).eq("sender_user_id", ctx.user.id)
      .eq("metadata->>client_id", input.idempotency_key).maybeSingle());
    if (existing) return { ok: true, message: existing };
    const decision = await classifyMarsohMessage(body, {});
    if (decision.recommended_action !== "publish") {
      throw fail("Mesaj topluluk güvenliği nedeniyle gönderilemedi.", 422, "MARITIME_CHAT_POLICY");
    }
    const inserted = await supabaseAdmin.from("maritime_connect_messages").insert({
      id: randomUUID(), thread_id: thread.id, sender_user_id: ctx.user.id, message_type: "text",
      body, metadata: { client_id: input.idempotency_key }, delivery_status: "sent"
    }).select("id,body,sender_user_id,created_at").single();
    if (inserted.error) {
      const retried = db(await supabaseAdmin.from("maritime_connect_messages")
        .select("id,body,sender_user_id,created_at").eq("thread_id", thread.id).eq("sender_user_id", ctx.user.id)
        .eq("metadata->>client_id", input.idempotency_key).maybeSingle());
      if (!retried) throw fail("Mesaj gönderilemedi.", 503);
      return { ok: true, message: retried };
    }
    return { ok: true, message: inserted.data };
  });

  app.post("/v1/maritime/connect-chat/threads/:threadId/read", async (request) => {
    const { ctx, thread } = await threadAccess(request, uuid.parse(request.params.threadId));
    db(await supabaseAdmin.from("maritime_connect_read_cursors").upsert({ thread_id: thread.id, user_id: ctx.user.id, last_read_at: new Date().toISOString() }, { onConflict: "thread_id,user_id" }));
    return { ok: true };
  });
}
