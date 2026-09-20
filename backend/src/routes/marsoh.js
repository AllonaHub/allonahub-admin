import { createHash, createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { config } from "../config.js";
import {
  MARSOH_PUBLIC_REJECTION,
  classifyMarsohMessage,
  containsHiddenPhone,
  normalizedModerationText,
  sanitizeMarsohText
} from "../lib/marsoh-moderation.js";
import {
  MARSOH_TRANSLATION_CACHE_VERSION,
  translateMarsohLocalizedFromTurkish,
  translateMarsohTextDetailed
} from "../lib/marsoh-translation.js";
import { auditEvent, authContext, hasMfa, hasRole, supabaseAdmin } from "../lib/supabase.js";

const uuidSchema = z.string().uuid();
const marsohLanguages = ["tr", "az", "en", "de", "ru", "ar", "kk", "uz", "ky"];
const languageSchema = z.enum(marsohLanguages).default("tr");
const sendSchema = z.object({
  channel_id: uuidSchema,
  idempotency_key: uuidSchema,
  body: z.string().min(1).max(4000),
  language: languageSchema
}).strict();
const translationSchema = z.object({ target_language: languageSchema }).strict();
const reactionSchema = z.object({ emoji: z.enum(["👍", "❤️", "👏", "⚓", "🌊", "💪", "🙏", "🫡", "🚢", "🧭", "✨", "😊"]) }).strict();
const reportSchema = z.object({
  reason_code: z.enum(["spam", "harassment", "fraud", "recruitment", "contact_sharing", "other"]),
  note: z.string().trim().max(500).optional().default("")
}).strict();
const blockSchema = z.object({ blocked_user_id: uuidSchema }).strict();
const preferenceSchema = z.object({ preference: z.enum(["all", "mentions", "muted"]) }).strict();
const decisionSchema = z.object({
  decision: z.enum(["published", "rejected"]),
  reason: z.string().trim().min(3).max(500)
}).strict();
const reportDecisionSchema = z.object({
  decision: z.enum(["dismissed", "actioned"]),
  reason: z.string().trim().min(3).max(500)
}).strict();
const localizedTextSchema = z.object(Object.fromEntries(
  marsohLanguages.map((language) => [language, z.string().trim().max(2000).optional()])
)).strict();
const topicDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const adminTopicSchema = z.object({
  title_i18n: localizedTextSchema,
  body_i18n: localizedTextSchema,
  status: z.enum(["active", "archived"]).default("active"),
  auto_translate_from_tr: z.boolean().default(true)
}).strict();
const adminChannelSchema = z.object({
  status: z.enum(["active", "paused", "archived"]).optional(),
  slow_mode_seconds: z.number().int().min(0).max(300).optional(),
  name_i18n: localizedTextSchema.optional(),
  pinned_notice_i18n: localizedTextSchema.optional(),
  auto_translate_from_tr: z.boolean().default(true)
}).strict().refine((value) => value.status !== undefined
  || value.slow_mode_seconds !== undefined
  || value.name_i18n !== undefined
  || value.pinned_notice_i18n !== undefined, "En az bir oda ayarı gereklidir.");
const adminAnnouncementSchema = z.object({
  channel_id: uuidSchema,
  idempotency_key: uuidSchema,
  body: z.string().min(1).max(4000),
  language: languageSchema
}).strict();
const bulkRemoveSchema = z.object({
  channel_id: uuidSchema.nullable().optional().default(null),
  reason: z.string().trim().min(6).max(500),
  confirmation: z.literal("MARSOH_ALL_MESSAGES_REMOVE")
}).strict();
const sanctionSchema = z.object({
  user_id: uuidSchema,
  sanction_type: z.enum(["temporary_mute", "permanent_ban"]),
  reason: z.string().trim().min(3).max(500),
  duration_minutes: z.number().int().min(5).max(525600).optional()
}).strict().superRefine((value, ctx) => {
  if (value.sanction_type === "temporary_mute" && !value.duration_minutes) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["duration_minutes"], message: "Temporary mute duration is required." });
  }
});

function httpError(message, statusCode = 400, code = "MARSOH_REQUEST_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.exposeCode = true;
  return error;
}

function assertDb(result, message) {
  if (result?.error) throw httpError(message, 503, "MARSOH_DATABASE_ERROR");
  return result?.data;
}

function sha256(value) {
  return createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function opaqueHash(value) {
  const secret = config.marsoh.abuseHashSecret || config.supabase.serviceRoleKey;
  return createHmac("sha256", secret).update(String(value || "unknown"), "utf8").digest("hex");
}

function cleanLocalizedMap(value, maxLength) {
  return Object.fromEntries(marsohLanguages.flatMap((language) => {
    const text = sanitizeMarsohText(value?.[language] || "", maxLength);
    return text ? [[language, text]] : [];
  }));
}

function marsohTranslationOptions() {
  return {
    provider: config.marsoh.translationProvider,
    localUrl: config.marsoh.translationLocalUrl,
    localSecret: config.marsoh.translationLocalSecret,
    localTimeoutMs: config.marsoh.translationLocalTimeoutMs,
    apiKey: config.marsoh.translationApiKey,
    baseUrl: config.marsoh.translationBaseUrl,
    model: config.marsoh.translationModel,
    timeoutMs: config.marsoh.providerTimeoutMs,
    concurrency: 2
  };
}

async function localizedAdminTextFromTurkish(value, maxLength) {
  const source = sanitizeMarsohText(value?.tr || "", maxLength);
  if (!source) throw httpError("Türkçe kaynak metin zorunludur.", 400, "MARSOH_TURKISH_SOURCE_REQUIRED");
  try {
    const result = await translateMarsohLocalizedFromTurkish(source, marsohTranslationOptions());
    return {
      localized: cleanLocalizedMap(result.localized, maxLength),
      providers: result.providers
    };
  } catch {
    throw httpError("Diğer dil çevirileri şu anda oluşturulamadı. İçerik kaydedilmedi; lütfen yeniden deneyin.", 503, "MARSOH_ADMIN_TRANSLATION_UNAVAILABLE");
  }
}

function requestIp(request) {
  return String(request.headers["cf-connecting-ip"] || request.headers["x-forwarded-for"] || request.ip || "")
    .split(",")[0]
    .trim();
}

async function requireMarsohUser(request, action) {
  const ctx = await authContext(request);
  if (!ctx?.user || !ctx.profilePersisted) throw httpError("MarSoh için giriş yapmalısınız.", 401, "AUTH_REQUIRED");
  if (String(ctx.profile.account_status || "active") !== "active") {
    throw httpError("Hesabınız aktif olmadığı için MarSoh kullanılamıyor.", 403, "MARSOH_ACCOUNT_INACTIVE");
  }
  if (hasRole(ctx.profile, "partner") && !config.marsoh.companyMessagingEnabled) {
    throw httpError("Şirket mesajlaşması henüz açık değil.", 403, "MARSOH_COMPANY_MESSAGING_DISABLED");
  }
  if (!hasRole(ctx.profile, ["customer", "partner", "admin", "super_admin"])) {
    await auditEvent({ request, actorId: ctx.user.id, actorRole: ctx.profile.role, action: "marsoh.access_denied", severity: "warning", resourceType: "marsoh", metadata: { requested_action: action } });
    throw httpError("Bu hesap MarSoh erişimine uygun değil.", 403, "MARSOH_ROLE_NOT_ALLOWED");
  }
  return ctx;
}

async function requireModerator(request, action) {
  const ctx = await authContext(request);
  if (!ctx?.user || !hasRole(ctx.profile, ["admin", "super_admin"]) || !hasMfa(ctx)) {
    await auditEvent({ request, actorId: ctx?.user?.id || null, actorRole: ctx?.profile?.role || null, action: "marsoh.moderator_denied", severity: "critical", resourceType: "marsoh_moderation", metadata: { requested_action: action, mfa_verified: hasMfa(ctx) } });
    throw httpError("MarSoh moderasyonu için MFA doğrulamalı yönetici yetkisi gerekir.", 403, "MARSOH_MODERATOR_REQUIRED");
  }
  return ctx;
}

async function verifiedCountry(userId) {
  const profileRows = assertDb(await supabaseAdmin
    .from("user_country_profiles")
    .select("country_id,updated_at")
    .eq("user_id", userId)
    .eq("kyc_status", "verified")
    .order("updated_at", { ascending: false })
    .limit(1), "Doğrulanmış ülke bilgisi okunamadı.") || [];
  if (!profileRows[0]?.country_id) return null;
  const country = assertDb(await supabaseAdmin
    .from("countries")
    .select("country_code,country_name,native_name,default_language")
    .eq("id", profileRows[0].country_id)
    .maybeSingle(), "Ülke bilgisi okunamadı.");
  return country?.country_code ? country : null;
}

function countryNames(country) {
  const label = String(country?.native_name || country?.country_name || country?.country_code || "Country").trim();
  return {
    tr: `${label} Odası`, az: `${label} otağı`, en: `${label} Room`, de: `Raum ${label}`,
    ru: `Комната: ${label}`, ar: `غرفة ${label}`, kk: `${label} бөлмесі`, uz: `${label} xonasi`, ky: `${label} бөлмөсү`
  };
}

function safePublicActorName(value, fallback) {
  const name = sanitizeMarsohText(value, 100);
  const containsContact = containsHiddenPhone(name)
    || /@|https?:\/\/|www\.|\b(?:whats?app|telegram|instagram|facebook|tiktok|signal)\b/iu.test(name);
  return name && !containsContact ? name : fallback;
}

async function verifiedPartnerActor(userId) {
  const businesses = assertDb(await supabaseAdmin
    .from("partner_businesses")
    .select("id,display_name")
    .eq("owner_id", userId)
    .eq("partner_type", "maritime")
    .eq("status", "active")
    .eq("verification_status", "verified")
    .limit(1), "Şirket doğrulaması okunamadı.") || [];
  return businesses[0] || null;
}

async function actorSnapshot(ctx, country) {
  if (hasRole(ctx.profile, "partner")) {
    const business = await verifiedPartnerActor(ctx.user.id);
    if (!business) throw httpError("MarSoh şirket mesajları için doğrulanmış denizcilik şirketi gerekir.", 403, "MARSOH_VERIFIED_COMPANY_REQUIRED");
    return { actor_type: "company", display_name: safePublicActorName(business.display_name, "Doğrulanmış Denizcilik Şirketi"), badge: "verified_company", country_code: country?.country_code || null };
  }
  if (hasRole(ctx.profile, ["admin", "super_admin"])) {
    return { actor_type: "moderator", display_name: "AllonaHub Moderator", badge: "moderator", country_code: country?.country_code || null };
  }
  const badges = assertDb(await supabaseAdmin
    .from("maritime_trust_badges")
    .select("badge_type")
    .eq("entity_type", "seafarer")
    .eq("entity_id", ctx.user.id)
    .eq("status", "active")
    .limit(5), "Denizci rozeti okunamadı.") || [];
  const rawName = String(ctx.profile.full_name || "").trim();
  const safeName = safePublicActorName(rawName, `Denizci ${ctx.profile.public_id || ""}`.trim());
  return {
    actor_type: "seafarer",
    display_name: safeName || "Denizci",
    badge: badges.some((item) => item.badge_type === "verified_gold") ? "verified_seafarer" : null,
    country_code: country?.country_code || null
  };
}

async function ensureChannels(ctx, country) {
  if (country && !["TR", "AZ"].includes(country.country_code)) {
    assertDb(await supabaseAdmin.from("marsoh_channels").upsert({
      slug: `country-${country.country_code.toLowerCase()}`,
      channel_type: "country",
      country_code: country.country_code,
      status: "active",
      name_i18n: countryNames(country),
      pinned_notice_i18n: {
        tr: "Kişisel iletişim bilgisi ve iş ilanı paylaşmayın.",
        az: "Şəxsi əlaqə məlumatı və iş elanı paylaşmayın.",
        en: "Do not share personal contact details or job ads.",
        de: "Teilen Sie keine persönlichen Kontaktdaten oder Stellenanzeigen.",
        ru: "Не публикуйте личные контакты или вакансии.",
        ar: "لا تشارك بيانات الاتصال الشخصية أو إعلانات الوظائف.",
        kk: "Жеке байланыс деректерін немесе жұмыс жарнамаларын бөліспеңіз.",
        uz: "Shaxsiy aloqa ma'lumotlari yoki ish e'lonlarini ulashmang.",
        ky: "Жеке байланыш маалыматтарын же жумуш жарыяларын бөлүшпөңүз."
      },
      created_by_system: true
    }, { onConflict: "slug" }), "Ülke odası hazırlanamadı.");
  }
  const allowedCountries = ["TR", "AZ", country?.country_code].filter(Boolean);
  const channels = assertDb(await supabaseAdmin
    .from("marsoh_channels")
    .select("id,slug,channel_type,country_code,status,name_i18n,pinned_notice_i18n,slow_mode_seconds")
    .eq("status", "active")
    .or(`channel_type.eq.world,country_code.in.(${allowedCountries.join(",")})`)
    .order("channel_type", { ascending: true })
    .order("country_code", { ascending: true }), "MarSoh odaları hazırlanamadı.") || [];
  if (channels.length) {
    assertDb(await supabaseAdmin.from("marsoh_channel_memberships").upsert(channels.map((channel) => ({
      channel_id: channel.id,
      user_id: ctx.user.id,
      actor_type: hasRole(ctx.profile, ["admin", "super_admin"]) ? "moderator" : (hasRole(ctx.profile, "partner") ? "company" : "seafarer"),
      member_status: "active"
    })), { onConflict: "channel_id,user_id", ignoreDuplicates: true }), "MarSoh oda üyeliği hazırlanamadı.");
  }
  return channels;
}

async function membership(userId, channelId) {
  return assertDb(await supabaseAdmin.from("marsoh_channel_memberships")
    .select("channel_id,user_id,member_status,notification_preference,last_read_published_at,last_message_at")
    .eq("channel_id", channelId).eq("user_id", userId).maybeSingle(), "Oda üyeliği doğrulanamadı.");
}

async function requireChannelAccess(ctx, channelId, { write = false } = {}) {
  const member = await membership(ctx.user.id, channelId);
  if (!member || member.member_status !== "active") throw httpError("Bu MarSoh odasına erişiminiz yok.", 403, "MARSOH_CHANNEL_ACCESS_DENIED");
  if (write) {
    const sanctions = assertDb(await supabaseAdmin.from("marsoh_user_sanctions")
      .select("sanction_type,expires_at")
      .eq("user_id", ctx.user.id).eq("status", "active")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .limit(5), "MarSoh yaptırım durumu okunamadı.") || [];
    if (sanctions.some((row) => row.sanction_type === "permanent_ban")) throw httpError("MarSoh erişiminiz engellenmiştir.", 403, "MARSOH_BANNED");
    if (sanctions.some((row) => row.sanction_type === "temporary_mute")) throw httpError("MarSoh gönderiminiz geçici olarak durdurulmuştur.", 403, "MARSOH_MUTED");
  }
  return member;
}

async function marsohAudit({ request, ctx, action, resourceType, resourceId = null, contentHash = null, metadata = {} }) {
  await supabaseAdmin.from("marsoh_audit_events").insert({
    actor_user_id: ctx?.user?.id || null,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    content_hash: contentHash,
    metadata
  });
  await auditEvent({ request, actorId: ctx?.user?.id || null, actorRole: ctx?.profile?.role || null, action, resourceType, resourceId, metadata });
}

async function removePublishedMessagesWithoutRpc({ request, ctx, channelId, reason }) {
  let removed = 0;
  for (let batch = 0; batch < 200; batch += 1) {
    let query = supabaseAdmin.from("marsoh_published_messages").select("message_id").order("published_at", { ascending: true }).limit(500);
    if (channelId) query = query.eq("channel_id", channelId);
    const rows = assertDb(await query, "Yayımlanmış MarSoh mesajları okunamadı.") || [];
    const messageIds = rows.map((row) => row.message_id);
    if (!messageIds.length) break;
    assertDb(await supabaseAdmin.from("marsoh_moderation_decisions").update({
      decision: "rejected",
      decided_by: ctx.user.id,
      decided_at: new Date().toISOString(),
      administrator_explanation: reason,
      updated_at: new Date().toISOString()
    }).in("message_id", messageIds), "MarSoh moderasyon kararları güncellenemedi.");
    assertDb(await supabaseAdmin.from("marsoh_published_messages").delete().in("message_id", messageIds), "MarSoh mesajları yayından kaldırılamadı.");
    removed += messageIds.length;
    if (messageIds.length < 500) break;
  }
  await marsohAudit({ request, ctx, action: "marsoh.management.bulk_removed", resourceType: "marsoh_channel", resourceId: channelId || null, metadata: { reason, removed_count: removed, fallback: true } });
  return removed;
}

async function recordRateEvent(request, ctx, eventType, channelId = null, bodyHash = null) {
  const ip = requestIp(request);
  assertDb(await supabaseAdmin.from("marsoh_rate_limit_events").insert({
    user_id: ctx.user.id,
    channel_id: channelId,
    session_hash: opaqueHash(ctx.jwtClaims?.session_id || ctx.jwtClaims?.sub || ctx.user.id),
    ip_hash: ip ? opaqueHash(ip) : null,
    body_hash: bodyHash,
    event_type: eventType
  }), "MarSoh trafik kontrolü kaydedilemedi.");
}

async function enforceSendLimits(request, ctx, channel, member, bodyHash) {
  const now = Date.now();
  const minuteAgo = new Date(now - 60000).toISOString();
  const createdAt = Date.parse(ctx.user.created_at || 0);
  const newAccount = Number.isFinite(createdAt) && now - createdAt < 7 * 86400000;
  const max = newAccount ? config.marsoh.newAccountRatePerMinute : config.marsoh.sendRatePerMinute;
  const ip = requestIp(request);
  const ipHash = ip ? opaqueHash(ip) : null;
  const sessionHash = opaqueHash(ctx.jwtClaims?.session_id || ctx.jwtClaims?.sub || ctx.user.id);
  const userCountQuery = supabaseAdmin.from("marsoh_rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.user.id).eq("event_type", "send_attempt").gte("created_at", minuteAgo);
  const sessionCountQuery = supabaseAdmin.from("marsoh_rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("session_hash", sessionHash).eq("event_type", "send_attempt").gte("created_at", minuteAgo);
  const ipCountQuery = ipHash ? supabaseAdmin.from("marsoh_rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash).eq("event_type", "send_attempt").gte("created_at", minuteAgo) : null;
  const [countResult, sessionCountResult, ipCountResult] = await Promise.all([
    userCountQuery,
    sessionCountQuery,
    ipCountQuery || Promise.resolve({ count: 0, data: null, error: null })
  ]);
  assertDb(countResult, "MarSoh hız limiti denetlenemedi.");
  assertDb(sessionCountResult, "MarSoh oturum trafik limiti denetlenemedi.");
  assertDb(ipCountResult, "MarSoh ağ trafik limiti denetlenemedi.");
  if ((countResult.count || 0) >= max) throw httpError("Çok hızlı mesaj gönderiyorsunuz. Lütfen biraz bekleyin.", 429, "MARSOH_RATE_LIMITED");
  if ((sessionCountResult.count || 0) >= max * 2 || (ipCountResult.count || 0) >= max * 5) {
    throw httpError("Anormal mesaj trafiği algılandı. Lütfen daha sonra yeniden deneyin.", 429, "MARSOH_ANOMALOUS_TRAFFIC");
  }

  const slowModeMs = Math.max(0, Number(channel.slow_mode_seconds) || 0) * 1000;
  if (slowModeMs && member.last_message_at && now - Date.parse(member.last_message_at) < slowModeMs) {
    throw httpError("Bu odada yavaş mod açık. Lütfen kısa bir süre bekleyin.", 429, "MARSOH_SLOW_MODE");
  }
  const duplicate = assertDb(await supabaseAdmin.from("marsoh_messages")
    .select("id")
    .eq("sender_user_id", ctx.user.id).eq("normalized_hash", bodyHash)
    .gte("accepted_at", new Date(now - 120000).toISOString()).limit(1), "Tekrar mesaj kontrolü yapılamadı.") || [];
  if (duplicate.length) throw httpError("Aynı mesajı kısa aralıklarla tekrar gönderemezsiniz.", 429, "MARSOH_DUPLICATE_MESSAGE");

  const recentRooms = assertDb(await supabaseAdmin.from("marsoh_rate_limit_events")
    .select("channel_id").eq("user_id", ctx.user.id).eq("event_type", "send_attempt")
    .gte("created_at", new Date(now - 600000).toISOString()).limit(100), "Oda trafik kontrolü yapılamadı.") || [];
  if (new Set(recentRooms.map((row) => row.channel_id).filter(Boolean)).size >= 4 && !recentRooms.some((row) => row.channel_id === channel.id)) {
    throw httpError("Kısa sürede çok sayıda odaya mesaj gönderemezsiniz.", 429, "MARSOH_CROSS_ROOM_LIMIT");
  }
  await recordRateEvent(request, ctx, "send_attempt", channel.id, bodyHash);
}

function publicMessage(row, own = false) {
  return {
    id: row.message_id || row.id,
    channel_id: row.channel_id,
    sender: {
      id: row.sender_user_id,
      display_name: row.sender_display_name,
      badge: row.sender_badge || null,
      country_code: row.sender_country_code || null,
      actor_type: row.actor_type
    },
    body: row.body,
    language: row.language || "und",
    time: row.published_at || row.accepted_at || row.created_at,
    own,
    reactions: row.reactions || [],
    status: own ? "sent" : undefined
  };
}

async function blockedIds(userId) {
  const rows = assertDb(await supabaseAdmin.from("marsoh_user_blocks").select("blocked_user_id").eq("blocker_user_id", userId), "Engellenen kullanıcılar okunamadı.") || [];
  return new Set(rows.map((row) => row.blocked_user_id));
}

async function listMessages(ctx, channelId, before, limit) {
  await requireChannelAccess(ctx, channelId);
  const blocked = await blockedIds(ctx.user.id);
  let publishedQuery = supabaseAdmin.from("marsoh_published_messages")
    .select("message_id,channel_id,sender_user_id,actor_type,body,language,sender_display_name,sender_badge,sender_country_code,published_at,created_at")
    .eq("channel_id", channelId).neq("sender_user_id", ctx.user.id)
    .order("published_at", { ascending: false }).limit(limit + 1);
  let ownQuery = supabaseAdmin.from("marsoh_messages")
    .select("id,channel_id,sender_user_id,actor_type,body,language,sender_display_name,sender_badge,sender_country_code,accepted_at,created_at")
    .eq("channel_id", channelId).eq("sender_user_id", ctx.user.id)
    .order("accepted_at", { ascending: false }).limit(limit + 1);
  if (before) {
    publishedQuery = publishedQuery.lt("published_at", before);
    ownQuery = ownQuery.lt("accepted_at", before);
  }
  const [publishedResult, ownResult] = await Promise.all([publishedQuery, ownQuery]);
  const published = (assertDb(publishedResult, "Mesaj geçmişi okunamadı.") || []).filter((row) => !blocked.has(row.sender_user_id)).map((row) => publicMessage(row, false));
  const own = (assertDb(ownResult, "Kendi mesajlarınız okunamadı.") || []).map((row) => publicMessage(row, true));
  const merged = [...published, ...own].sort((a, b) => new Date(b.time) - new Date(a.time));
  const page = merged.slice(0, limit);
  const messageIds = page.map((message) => message.id);
  const reactions = messageIds.length ? assertDb(await supabaseAdmin.from("marsoh_message_reactions")
    .select("message_id,user_id,emoji").in("message_id", messageIds), "Mesaj tepkileri okunamadı.") || [] : [];
  const reactionMap = new Map();
  for (const reaction of reactions) {
    const entries = reactionMap.get(reaction.message_id) || new Map();
    const current = entries.get(reaction.emoji) || { emoji: reaction.emoji, count: 0, mine: false };
    current.count += 1;
    current.mine = current.mine || reaction.user_id === ctx.user.id;
    entries.set(reaction.emoji, current);
    reactionMap.set(reaction.message_id, entries);
  }
  for (const message of page) message.reactions = [...(reactionMap.get(message.id)?.values() || [])];
  return { messages: page, next_cursor: merged.length > limit ? page[page.length - 1]?.time || null : null };
}

async function visiblePublished(ctx, messageId) {
  const message = assertDb(await supabaseAdmin.from("marsoh_published_messages")
    .select("message_id,channel_id,sender_user_id,body,language")
    .eq("message_id", messageId).maybeSingle(), "Mesaj okunamadı.");
  if (!message) throw httpError("Mesaj bulunamadı.", 404, "MARSOH_MESSAGE_NOT_FOUND");
  await requireChannelAccess(ctx, message.channel_id);
  const blocked = await blockedIds(ctx.user.id);
  if (blocked.has(message.sender_user_id)) throw httpError("Mesaj bulunamadı.", 404, "MARSOH_MESSAGE_NOT_FOUND");
  return message;
}

async function denyOwnMessageAction(ctx, messageId) {
  const accepted = assertDb(await supabaseAdmin.from("marsoh_messages")
    .select("sender_user_id").eq("id", messageId).maybeSingle(), "Mesaj sahipliği doğrulanamadı.");
  if (accepted?.sender_user_id === ctx.user.id) {
    throw httpError("Bu işlem kendi mesajlarınız için kullanılamaz.", 400, "MARSOH_OWN_MESSAGE_ACTION_NOT_ALLOWED");
  }
}

async function channelRowsWithUnread(ctx, channels) {
  const memberships = assertDb(await supabaseAdmin.from("marsoh_channel_memberships")
    .select("channel_id,notification_preference,last_read_published_at")
    .eq("user_id", ctx.user.id).in("channel_id", channels.map((channel) => channel.id)), "Oda tercihleri okunamadı.") || [];
  const byChannel = new Map(memberships.map((row) => [row.channel_id, row]));
  return Promise.all(channels.map(async (channel) => {
    const member = byChannel.get(channel.id) || {};
    let query = supabaseAdmin.from("marsoh_published_messages").select("message_id", { count: "exact", head: true })
      .eq("channel_id", channel.id).neq("sender_user_id", ctx.user.id);
    if (member.last_read_published_at) query = query.gt("published_at", member.last_read_published_at);
    const result = await query;
    assertDb(result, "Okunmamış mesaj sayısı hesaplanamadı.");
    return { ...channel, unread_count: result.count || 0, notification_preference: member.notification_preference || "all" };
  }));
}

export function registerMarsohRoutes(app) {
  app.get("/v1/maritime/marsoh/bootstrap", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request) => {
    const ctx = await requireMarsohUser(request, "marsoh.bootstrap");
    const language = languageSchema.catch("tr").parse(request.query?.language || "tr");
    const country = await verifiedCountry(ctx.user.id);
    const actor = await actorSnapshot(ctx, country);
    const channels = await channelRowsWithUnread(ctx, await ensureChannels(ctx, country));
    const topic = assertDb(await supabaseAdmin.from("marsoh_topic_cards")
      .select("id,topic_date,title_i18n,body_i18n").eq("status", "active")
      .lte("topic_date", new Date().toISOString().slice(0, 10)).order("topic_date", { ascending: false }).limit(1).maybeSingle(), "Günün konusu okunamadı.");
    const sentNotice = {
      tr: "Mesajlar güvenlik amacıyla otomatik olarak denetlenebilir, geciktirilebilir veya dağıtılmayabilir; Gönderildi bilgisi teslim/okunma garantisi değildir.",
      az: "Mesajlar təhlükəsizlik məqsədilə avtomatik yoxlanıla, gecikdirilə və ya paylanmaya bilər; Göndərildi məlumatı çatdırılma və ya oxunma zəmanəti deyil.",
      en: "Messages may be automatically reviewed, delayed, or withheld for safety; Sent does not guarantee delivery or reading.",
      de: "Nachrichten können aus Sicherheitsgründen automatisch geprüft, verzögert oder zurückgehalten werden; Gesendet garantiert weder Zustellung noch Lesen.",
      ru: "В целях безопасности сообщения могут автоматически проверяться, задерживаться или не распространяться; статус Отправлено не гарантирует доставку или прочтение.",
      ar: "قد تخضع الرسائل للمراجعة الآلية أو التأخير أو الحجب لأغراض السلامة؛ حالة تم الإرسال لا تضمن التسليم أو القراءة.",
      kk: "Қауіпсіздік үшін хабарламалар автоматты түрде тексерілуі, кешіктірілуі немесе таратылмауы мүмкін; Жөнелтілді күйі жеткізілгеніне не оқылғанына кепілдік бермейді.",
      uz: "Xabarlar xavfsizlik uchun avtomatik tekshirilishi, kechiktirilishi yoki tarqatilmasligi mumkin; Yuborildi holati yetkazilgan yoki o'qilganini kafolatlamaydi.",
      ky: "Коопсуздук үчүн билдирүүлөр автоматтык түрдө текшерилиши, кечигиши же таратылбай калышы мүмкүн; Жөнөтүлдү абалы жеткирилгенине же окулганына кепилдик бербейт."
    };
    return {
      ok: true,
      user: { id: ctx.user.id, ...actor, preferred_language: language },
      channels,
      topic,
      blocked_user_ids: [...await blockedIds(ctx.user.id)],
      policy: {
        max_message_chars: config.marsoh.maxMessageChars,
        sent_notice: sentNotice[language] || sentNotice.en,
        text_only: true,
        company_messaging_enabled: config.marsoh.companyMessagingEnabled
      }
    };
  });

  app.get("/v1/maritime/marsoh/channels/:channelId/messages", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request) => {
    const ctx = await requireMarsohUser(request, "marsoh.messages.list");
    const channelId = uuidSchema.parse(request.params?.channelId);
    const limit = Math.max(1, Math.min(Number(request.query?.limit) || 50, 100));
    const before = request.query?.before ? z.string().datetime({ offset: true }).parse(request.query.before) : null;
    return { ok: true, ...(await listMessages(ctx, channelId, before, limit)) };
  });

  app.post("/v1/maritime/marsoh/messages", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const ctx = await requireMarsohUser(request, "marsoh.message.send");
    const input = sendSchema.parse(request.body || {});
    const body = sanitizeMarsohText(input.body, 4000);
    if (!body) throw httpError("Mesaj boş bırakılamaz.", 400, "MARSOH_MESSAGE_EMPTY");
    if (body.length > config.marsoh.maxMessageChars) throw httpError(`Mesaj en fazla ${config.marsoh.maxMessageChars} karakter olabilir.`, 400, "MARSOH_MESSAGE_TOO_LONG");
    const member = await requireChannelAccess(ctx, input.channel_id, { write: true });
    const channel = assertDb(await supabaseAdmin.from("marsoh_channels").select("id,status,slow_mode_seconds").eq("id", input.channel_id).maybeSingle(), "Oda okunamadı.");
    if (!channel || channel.status !== "active") throw httpError("Bu oda şu anda mesaj kabul etmiyor.", 409, "MARSOH_CHANNEL_PAUSED");
    const existing = assertDb(await supabaseAdmin.from("marsoh_messages")
      .select("id,channel_id,sender_user_id,actor_type,body,language,sender_display_name,sender_badge,sender_country_code,accepted_at")
      .eq("sender_user_id", ctx.user.id).eq("idempotency_key", input.idempotency_key).maybeSingle(), "Tekrarlanan mesaj doğrulanamadı.");
    if (existing) {
      reply.code(202);
      return { ok: true, accepted: true, message: publicMessage(existing, true) };
    }
    const normalizedHash = sha256(normalizedModerationText(body));
    await enforceSendLimits(request, ctx, channel, member, normalizedHash);
    const classification = await classifyMarsohMessage(body, {
      apiKey: config.marsoh.classifierApiKey,
      baseUrl: config.marsoh.classifierBaseUrl,
      model: config.marsoh.classifierModel,
      timeoutMs: config.marsoh.providerTimeoutMs
    });
    if (classification.recommended_action === "reject") {
      await marsohAudit({ request, ctx, action: "marsoh.message.rejected", resourceType: "marsoh_channel", resourceId: channel.id, contentHash: normalizedHash, metadata: { category: classification.category, rule_code: classification.rule_code } });
      throw httpError(MARSOH_PUBLIC_REJECTION[classification.rule_code] || "Gönderilemedi — topluluk kurallarına aykırı ifade", 422, classification.rule_code);
    }
    const country = await verifiedCountry(ctx.user.id);
    const actor = await actorSnapshot(ctx, country);
    const messageId = randomUUID();
    const decision = classification.recommended_action === "quarantine" ? "quarantined" : "published";
    const acceptedRows = assertDb(await supabaseAdmin.rpc("marsoh_accept_text_message", {
      p_message_id: messageId,
      p_channel_id: channel.id,
      p_sender_user_id: ctx.user.id,
      p_actor_type: actor.actor_type,
      p_idempotency_key: input.idempotency_key,
      p_body: body,
      p_normalized_hash: normalizedHash,
      p_language: classification.language === "und" ? input.language : classification.language,
      p_sender_display_name: actor.display_name,
      p_sender_badge: actor.badge,
      p_sender_country_code: actor.country_code,
      p_category: classification.category,
      p_confidence: classification.confidence,
      p_rule_code: classification.rule_code,
      p_administrator_explanation: classification.administrator_explanation,
      p_recommended_action: classification.recommended_action,
      p_decision: decision,
      p_classifier_version: classification.classifier_version
    }), "Mesaj güvenli biçimde kaydedilemedi.") || [];
    const acceptedId = acceptedRows[0]?.message_id || messageId;
    await supabaseAdmin.from("marsoh_channel_memberships").update({ last_message_at: new Date().toISOString() }).eq("channel_id", channel.id).eq("user_id", ctx.user.id);
    await marsohAudit({ request, ctx, action: "marsoh.message.accepted", resourceType: "marsoh_message", resourceId: acceptedId, contentHash: normalizedHash, metadata: { published: decision === "published", classifier_version: classification.classifier_version } });
    reply.code(202);
    return {
      ok: true,
      accepted: true,
      message: publicMessage({ id: acceptedId, channel_id: channel.id, sender_user_id: ctx.user.id, actor_type: actor.actor_type, body, language: input.language, sender_display_name: actor.display_name, sender_badge: actor.badge, sender_country_code: actor.country_code, accepted_at: new Date().toISOString() }, true)
    };
  });

  app.post("/v1/maritime/marsoh/channels/:channelId/read", async (request) => {
    const ctx = await requireMarsohUser(request, "marsoh.channel.read");
    const channelId = uuidSchema.parse(request.params?.channelId);
    await requireChannelAccess(ctx, channelId);
    assertDb(await supabaseAdmin.from("marsoh_channel_memberships").update({ last_read_published_at: new Date().toISOString() }).eq("channel_id", channelId).eq("user_id", ctx.user.id), "Okundu işareti güncellenemedi.");
    return { ok: true };
  });

  app.patch("/v1/maritime/marsoh/channels/:channelId/notification-preference", async (request) => {
    const ctx = await requireMarsohUser(request, "marsoh.channel.preference");
    const channelId = uuidSchema.parse(request.params?.channelId);
    const input = preferenceSchema.parse(request.body || {});
    await requireChannelAccess(ctx, channelId);
    assertDb(await supabaseAdmin.from("marsoh_channel_memberships").update({ notification_preference: input.preference }).eq("channel_id", channelId).eq("user_id", ctx.user.id), "Bildirim tercihi güncellenemedi.");
    return { ok: true, preference: input.preference };
  });

  app.post("/v1/maritime/marsoh/messages/:messageId/translate", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request) => {
    const ctx = await requireMarsohUser(request, "marsoh.message.translate");
    const messageId = uuidSchema.parse(request.params?.messageId);
    const input = translationSchema.parse(request.body || {});
    await denyOwnMessageAction(ctx, messageId);
    const message = await visiblePublished(ctx, messageId);
    const sourceHash = sha256(`${MARSOH_TRANSLATION_CACHE_VERSION}:${message.body}`);
    const cached = assertDb(await supabaseAdmin.from("marsoh_translation_cache")
      .select("translated_text,provider,model").eq("message_id", messageId)
      .eq("target_language", input.target_language).eq("source_hash", sourceHash).maybeSingle(), "Çeviri önbelleği okunamadı.");
    if (cached) return { ok: true, translated_text: cached.translated_text, target_language: input.target_language, automatic: true, cached: true };
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const rate = await supabaseAdmin.from("marsoh_rate_limit_events").select("id", { count: "exact", head: true }).eq("user_id", ctx.user.id).eq("event_type", "translation").gte("created_at", oneMinuteAgo);
    assertDb(rate, "Çeviri hız limiti denetlenemedi.");
    if ((rate.count || 0) >= config.marsoh.translationRatePerMinute) throw httpError("Çok fazla çeviri isteği gönderildi.", 429, "MARSOH_TRANSLATION_RATE_LIMITED");
    await recordRateEvent(request, ctx, "translation", message.channel_id, sourceHash);
    let translation;
    try {
      translation = await translateMarsohTextDetailed(message.body, input.target_language, {
        sourceLanguage: message.language,
        provider: config.marsoh.translationProvider,
        localUrl: config.marsoh.translationLocalUrl,
        localSecret: config.marsoh.translationLocalSecret,
        localTimeoutMs: config.marsoh.translationLocalTimeoutMs,
        apiKey: config.marsoh.translationApiKey,
        baseUrl: config.marsoh.translationBaseUrl,
        model: config.marsoh.translationModel,
        timeoutMs: config.marsoh.providerTimeoutMs
      });
    } catch {
      throw httpError("Çeviri şu anda kullanılamıyor.", 503, "MARSOH_TRANSLATION_UNAVAILABLE");
    }
    assertDb(await supabaseAdmin.from("marsoh_translation_cache").upsert({
      message_id: messageId,
      target_language: input.target_language,
      source_hash: sourceHash,
      translated_text: translation.translated_text,
      provider: translation.provider,
      model: translation.model
    }, { onConflict: "message_id,target_language,source_hash" }), "Çeviri önbelleğe kaydedilemedi.");
    return { ok: true, translated_text: translation.translated_text, target_language: input.target_language, automatic: true, cached: false };
  });

  app.post("/v1/maritime/marsoh/messages/:messageId/reactions", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request) => {
    const ctx = await requireMarsohUser(request, "marsoh.reaction.toggle");
    const messageId = uuidSchema.parse(request.params?.messageId);
    const input = reactionSchema.parse(request.body || {});
    await denyOwnMessageAction(ctx, messageId);
    await visiblePublished(ctx, messageId);
    const current = assertDb(await supabaseAdmin.from("marsoh_message_reactions").select("emoji").eq("message_id", messageId).eq("user_id", ctx.user.id).eq("emoji", input.emoji).maybeSingle(), "Tepki okunamadı.");
    if (current) assertDb(await supabaseAdmin.from("marsoh_message_reactions").delete().eq("message_id", messageId).eq("user_id", ctx.user.id).eq("emoji", input.emoji), "Tepki kaldırılamadı.");
    else assertDb(await supabaseAdmin.from("marsoh_message_reactions").insert({ message_id: messageId, user_id: ctx.user.id, emoji: input.emoji }), "Tepki eklenemedi.");
    const countResult = await supabaseAdmin.from("marsoh_message_reactions").select("message_id", { count: "exact", head: true }).eq("message_id", messageId).eq("emoji", input.emoji);
    assertDb(countResult, "Tepki sayısı okunamadı.");
    return { ok: true, active: !current, count: countResult.count || 0 };
  });

  app.post("/v1/maritime/marsoh/messages/:messageId/report", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request) => {
    const ctx = await requireMarsohUser(request, "marsoh.message.report");
    const messageId = uuidSchema.parse(request.params?.messageId);
    const input = reportSchema.parse(request.body || {});
    await denyOwnMessageAction(ctx, messageId);
    const message = await visiblePublished(ctx, messageId);
    await recordRateEvent(request, ctx, "report", message.channel_id, sha256(messageId));
    assertDb(await supabaseAdmin.from("marsoh_message_reports").upsert({
      message_id: messageId,
      reporter_user_id: ctx.user.id,
      reason_code: input.reason_code,
      note: input.note || null,
      status: "open",
      updated_at: new Date().toISOString()
    }, { onConflict: "message_id,reporter_user_id" }), "Bildirim kaydedilemedi.");
    await marsohAudit({ request, ctx, action: "marsoh.message.reported", resourceType: "marsoh_message", resourceId: messageId, metadata: { reason_code: input.reason_code } });
    return { ok: true, reported: true };
  });

  app.post("/v1/maritime/marsoh/blocks", async (request) => {
    const ctx = await requireMarsohUser(request, "marsoh.user.block");
    const input = blockSchema.parse(request.body || {});
    if (input.blocked_user_id === ctx.user.id) throw httpError("Kendinizi engelleyemezsiniz.", 400, "MARSOH_SELF_BLOCK_NOT_ALLOWED");
    assertDb(await supabaseAdmin.from("marsoh_user_blocks").upsert({ blocker_user_id: ctx.user.id, blocked_user_id: input.blocked_user_id }, { onConflict: "blocker_user_id,blocked_user_id" }), "Kullanıcı engellenemedi.");
    return { ok: true, blocked: true };
  });

  app.delete("/v1/maritime/marsoh/blocks/:userId", async (request) => {
    const ctx = await requireMarsohUser(request, "marsoh.user.unblock");
    const blockedUserId = uuidSchema.parse(request.params?.userId);
    assertDb(await supabaseAdmin.from("marsoh_user_blocks").delete().eq("blocker_user_id", ctx.user.id).eq("blocked_user_id", blockedUserId), "Kullanıcı engeli kaldırılamadı.");
    return { ok: true, blocked: false };
  });

  app.get("/v1/admin/marsoh/management", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request) => {
    await requireModerator(request, "marsoh.management.read");
    const limit = Math.max(1, Math.min(Number(request.query?.limit) || 80, 200));
    const before = request.query?.before ? z.string().datetime({ offset: true }).parse(request.query.before) : null;
    let messagesQuery = supabaseAdmin.from("marsoh_published_messages")
      .select("message_id,channel_id,sender_user_id,actor_type,body,language,sender_display_name,sender_badge,sender_country_code,published_at")
      .order("published_at", { ascending: false })
      .limit(limit + 1);
    if (before) messagesQuery = messagesQuery.lt("published_at", before);
    const [channelsResult, topicsResult, messagesResult, auditResult] = await Promise.all([
      supabaseAdmin.from("marsoh_channels")
        .select("id,slug,channel_type,country_code,status,name_i18n,pinned_notice_i18n,slow_mode_seconds,updated_at")
        .order("channel_type", { ascending: true }).order("country_code", { ascending: true }),
      supabaseAdmin.from("marsoh_topic_cards")
        .select("id,topic_date,title_i18n,body_i18n,status,created_at")
        .order("topic_date", { ascending: false }).limit(14),
      messagesQuery,
      supabaseAdmin.from("marsoh_audit_events")
        .select("id,actor_user_id,action,resource_type,resource_id,metadata,created_at")
        .order("created_at", { ascending: false }).limit(100)
    ]);
    const channels = assertDb(channelsResult, "MarSoh odaları okunamadı.") || [];
    const topics = assertDb(topicsResult, "MarSoh konu kartları okunamadı.") || [];
    const messageRows = assertDb(messagesResult, "Yayımlanmış MarSoh mesajları okunamadı.") || [];
    const audit = assertDb(auditResult, "MarSoh yönetim kayıtları okunamadı.") || [];
    const hasMore = messageRows.length > limit;
    const messages = messageRows.slice(0, limit);
    return {
      ok: true,
      channels,
      topics,
      messages,
      audit,
      next_cursor: hasMore ? messages[messages.length - 1]?.published_at || null : null
    };
  });

  app.patch("/v1/admin/marsoh/channels/:channelId", async (request) => {
    const ctx = await requireModerator(request, "marsoh.management.channel.update");
    const channelId = uuidSchema.parse(request.params?.channelId);
    const input = adminChannelSchema.parse(request.body || {});
    const current = assertDb(await supabaseAdmin.from("marsoh_channels")
      .select("id,name_i18n,pinned_notice_i18n").eq("id", channelId).maybeSingle(), "MarSoh odası okunamadı.");
    if (!current) throw httpError("MarSoh odası bulunamadı.", 404, "MARSOH_CHANNEL_NOT_FOUND");
    const update = { updated_at: new Date().toISOString() };
    if (input.status !== undefined) update.status = input.status;
    if (input.slow_mode_seconds !== undefined) update.slow_mode_seconds = input.slow_mode_seconds;
    const translationProviders = {};
    if (input.name_i18n) {
      if (input.auto_translate_from_tr) {
        const translated = await localizedAdminTextFromTurkish(input.name_i18n, 120);
        update.name_i18n = translated.localized;
        translationProviders.name = translated.providers;
      } else {
        update.name_i18n = { ...(current.name_i18n || {}), ...cleanLocalizedMap(input.name_i18n, 120) };
      }
    }
    if (input.pinned_notice_i18n) {
      if (input.auto_translate_from_tr) {
        const translated = await localizedAdminTextFromTurkish(input.pinned_notice_i18n, 600);
        update.pinned_notice_i18n = translated.localized;
        translationProviders.notice = translated.providers;
      } else {
        update.pinned_notice_i18n = { ...(current.pinned_notice_i18n || {}), ...cleanLocalizedMap(input.pinned_notice_i18n, 600) };
      }
    }
    const channel = assertDb(await supabaseAdmin.from("marsoh_channels").update(update).eq("id", channelId)
      .select("id,slug,status,name_i18n,pinned_notice_i18n,slow_mode_seconds,updated_at").single(), "MarSoh odası güncellenemedi.");
    await marsohAudit({ request, ctx, action: "marsoh.management.channel_updated", resourceType: "marsoh_channel", resourceId: channelId, metadata: { fields: Object.keys(input), source_language: "tr", auto_translated_languages: input.auto_translate_from_tr ? marsohLanguages.filter((language) => language !== "tr") : [], translation_providers: translationProviders } });
    return { ok: true, channel };
  });

  app.put("/v1/admin/marsoh/topics/:topicDate", async (request) => {
    const ctx = await requireModerator(request, "marsoh.management.topic.update");
    const topicDate = topicDateSchema.parse(request.params?.topicDate);
    const input = adminTopicSchema.parse(request.body || {});
    let titleI18n;
    let bodyI18n;
    let translationProviders = {};
    if (input.auto_translate_from_tr) {
      const [translatedTitle, translatedBody] = await Promise.all([
        localizedAdminTextFromTurkish(input.title_i18n, 160),
        localizedAdminTextFromTurkish(input.body_i18n, 800)
      ]);
      titleI18n = translatedTitle.localized;
      bodyI18n = translatedBody.localized;
      translationProviders = { title: translatedTitle.providers, body: translatedBody.providers };
    } else {
      titleI18n = cleanLocalizedMap(input.title_i18n, 160);
      bodyI18n = cleanLocalizedMap(input.body_i18n, 800);
      if (!titleI18n.tr || !titleI18n.az || !titleI18n.en || !bodyI18n.tr || !bodyI18n.az || !bodyI18n.en) {
        throw httpError("Türkçe, Azerbaycanca ve İngilizce konu başlığı ile soru metni zorunludur.", 400, "MARSOH_TOPIC_CORE_LANGUAGES_REQUIRED");
      }
    }
    const existing = assertDb(await supabaseAdmin.from("marsoh_topic_cards").select("id").eq("topic_date", topicDate).maybeSingle(), "MarSoh konusu okunamadı.");
    const topic = assertDb(await supabaseAdmin.from("marsoh_topic_cards").upsert({
      ...(existing?.id ? { id: existing.id } : {}),
      topic_date: topicDate,
      title_i18n: titleI18n,
      body_i18n: bodyI18n,
      status: input.status
    }, { onConflict: "topic_date" }).select("id,topic_date,title_i18n,body_i18n,status,created_at").single(), "MarSoh konusu kaydedilemedi.");
    await marsohAudit({ request, ctx, action: "marsoh.management.topic_updated", resourceType: "marsoh_topic_card", resourceId: topic.id, metadata: { topic_date: topicDate, status: input.status, source_language: "tr", auto_translated_languages: input.auto_translate_from_tr ? marsohLanguages.filter((language) => language !== "tr") : [], translation_providers: translationProviders } });
    return { ok: true, topic };
  });

  app.post("/v1/admin/marsoh/messages", async (request, reply) => {
    const ctx = await requireModerator(request, "marsoh.management.announcement.publish");
    const input = adminAnnouncementSchema.parse(request.body || {});
    const body = sanitizeMarsohText(input.body, 4000);
    if (!body) throw httpError("Yönetim mesajı boş bırakılamaz.", 400, "MARSOH_MESSAGE_EMPTY");
    if (body.length > config.marsoh.maxMessageChars) throw httpError(`Mesaj en fazla ${config.marsoh.maxMessageChars} karakter olabilir.`, 400, "MARSOH_MESSAGE_TOO_LONG");
    const channel = assertDb(await supabaseAdmin.from("marsoh_channels").select("id,status").eq("id", input.channel_id).maybeSingle(), "MarSoh odası okunamadı.");
    if (!channel || channel.status !== "active") throw httpError("Yalnızca aktif bir MarSoh odasına duyuru gönderilebilir.", 409, "MARSOH_CHANNEL_PAUSED");
    const messageId = randomUUID();
    const hash = sha256(normalizedModerationText(body));
    const acceptedRows = assertDb(await supabaseAdmin.rpc("marsoh_accept_text_message", {
      p_message_id: messageId,
      p_channel_id: channel.id,
      p_sender_user_id: ctx.user.id,
      p_actor_type: "moderator",
      p_idempotency_key: input.idempotency_key,
      p_body: body,
      p_normalized_hash: hash,
      p_language: input.language,
      p_sender_display_name: "AllonaHub MarSoh Yönetimi",
      p_sender_badge: "moderator",
      p_sender_country_code: null,
      p_category: "community_notice",
      p_confidence: 1,
      p_rule_code: "ADMIN_NOTICE",
      p_administrator_explanation: "MFA doğrulamalı MarSoh yöneticisi tarafından yayımlandı.",
      p_recommended_action: "publish",
      p_decision: "published",
      p_classifier_version: "admin-v1"
    }), "MarSoh yönetim mesajı yayımlanamadı.") || [];
    const acceptedId = acceptedRows[0]?.message_id || messageId;
    await marsohAudit({ request, ctx, action: "marsoh.management.announcement_published", resourceType: "marsoh_message", resourceId: acceptedId, contentHash: hash, metadata: { channel_id: channel.id, language: input.language } });
    reply.code(201);
    return { ok: true, message_id: acceptedId };
  });

  app.post("/v1/admin/marsoh/messages/bulk-remove", async (request) => {
    const ctx = await requireModerator(request, "marsoh.management.messages.bulk_remove");
    const input = bulkRemoveSchema.parse(request.body || {});
    if (input.channel_id) {
      const channel = assertDb(await supabaseAdmin.from("marsoh_channels").select("id").eq("id", input.channel_id).maybeSingle(), "MarSoh odası okunamadı.");
      if (!channel) throw httpError("MarSoh odası bulunamadı.", 404, "MARSOH_CHANNEL_NOT_FOUND");
    }
    const rpcResult = await supabaseAdmin.rpc("marsoh_admin_remove_published_messages", {
      p_actor_user_id: ctx.user.id,
      p_reason: input.reason,
      p_channel_id: input.channel_id || null
    });
    const missingRpc = rpcResult?.error && /marsoh_admin_remove_published_messages|schema cache|function/i.test(String(rpcResult.error.message || rpcResult.error.details || ""));
    const removed = missingRpc
      ? await removePublishedMessagesWithoutRpc({ request, ctx, channelId: input.channel_id || null, reason: input.reason })
      : assertDb(rpcResult, "MarSoh mesajları yayından kaldırılamadı.");
    if (!missingRpc) {
      await auditEvent({ request, actorId: ctx.user.id, actorRole: ctx.profile.role, action: "marsoh.management.bulk_removed", resourceType: "marsoh_channel", resourceId: input.channel_id || null, metadata: { removed_count: Number(removed || 0), reason: input.reason } });
    }
    return { ok: true, removed_count: Number(removed || 0) };
  });

  app.get("/v1/admin/marsoh/moderation", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request) => {
    await requireModerator(request, "marsoh.moderation.list");
    const limit = Math.max(1, Math.min(Number(request.query?.limit) || 80, 200));
    const decisions = assertDb(await supabaseAdmin.from("marsoh_moderation_decisions")
      .select("message_id,category,confidence,rule_code,language,administrator_explanation,recommended_action,decision,classifier_version,created_at")
      .eq("decision", "quarantined").order("created_at", { ascending: false }).limit(limit), "Moderasyon kuyruğu okunamadı.") || [];
    const messageIds = decisions.map((row) => row.message_id);
    const messages = messageIds.length ? assertDb(await supabaseAdmin.from("marsoh_messages")
      .select("id,channel_id,sender_user_id,body,sender_display_name,sender_badge,sender_country_code,accepted_at")
      .in("id", messageIds), "Karantina mesajları okunamadı.") || [] : [];
    const channelIds = [...new Set(messages.map((row) => row.channel_id))];
    const channels = channelIds.length ? assertDb(await supabaseAdmin.from("marsoh_channels").select("id,slug,name_i18n").in("id", channelIds), "Oda bilgisi okunamadı.") || [] : [];
    const userIds = [...new Set(messages.map((row) => row.sender_user_id))];
    const profiles = userIds.length ? assertDb(await supabaseAdmin.from("profiles").select("id,public_id,account_status,risk_level").in("id", userIds), "Gönderici güven durumu okunamadı.") || [] : [];
    const messageById = new Map(messages.map((row) => [row.id, row]));
    const channelById = new Map(channels.map((row) => [row.id, row]));
    const profileById = new Map(profiles.map((row) => [row.id, row]));
    const reports = assertDb(await supabaseAdmin.from("marsoh_message_reports")
      .select("id,message_id,reporter_user_id,reason_code,note,status,created_at")
      .eq("status", "open").order("created_at", { ascending: false }).limit(limit), "Mesaj bildirimleri okunamadı.") || [];
    const reportMessageIds = [...new Set(reports.map((row) => row.message_id))];
    const reportMessages = reportMessageIds.length ? assertDb(await supabaseAdmin.from("marsoh_published_messages")
      .select("message_id,channel_id,sender_user_id,body,sender_display_name,sender_badge,sender_country_code,published_at")
      .in("message_id", reportMessageIds), "Bildirilen mesajlar okunamadı.") || [] : [];
    const reportMessageById = new Map(reportMessages.map((row) => [row.message_id, row]));
    const sanctions = assertDb(await supabaseAdmin.from("marsoh_user_sanctions")
      .select("id,user_id,sanction_type,status,reason,starts_at,expires_at,created_at")
      .eq("status", "active").or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("created_at", { ascending: false }).limit(limit), "Aktif yaptırımlar okunamadı.") || [];
    return { ok: true, sanctions, reports: reports.map((report) => ({ ...report, message: reportMessageById.get(report.message_id) || null })), queue: decisions.map((decision) => {
      const message = messageById.get(decision.message_id) || {};
      return { ...decision, message, channel: channelById.get(message.channel_id) || null, sender_trust: profileById.get(message.sender_user_id) || null };
    }) };
  });

  app.get("/v1/admin/marsoh/messages/:messageId/context", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request) => {
    const ctx = await requireModerator(request, "marsoh.moderation.context");
    const messageId = uuidSchema.parse(request.params?.messageId);
    const target = assertDb(await supabaseAdmin.from("marsoh_messages")
      .select("id,channel_id,accepted_at").eq("id", messageId).maybeSingle(), "Mesaj bağlamı okunamadı.");
    if (!target) throw httpError("Mesaj bulunamadı.", 404, "MARSOH_MESSAGE_NOT_FOUND");
    const messages = assertDb(await supabaseAdmin.from("marsoh_messages")
      .select("id,sender_user_id,sender_display_name,sender_badge,body,language,accepted_at")
      .eq("channel_id", target.channel_id).lte("accepted_at", target.accepted_at)
      .order("accepted_at", { ascending: false }).limit(20), "Mesaj geçmişi okunamadı.") || [];
    await marsohAudit({ request, ctx, action: "marsoh.moderation.context_viewed", resourceType: "marsoh_message", resourceId: messageId, metadata: { returned_count: messages.length } });
    return { ok: true, messages: messages.reverse() };
  });

  app.post("/v1/admin/marsoh/messages/:messageId/decision", async (request) => {
    const ctx = await requireModerator(request, "marsoh.moderation.decide");
    const messageId = uuidSchema.parse(request.params?.messageId);
    const input = decisionSchema.parse(request.body || {});
    assertDb(await supabaseAdmin.rpc("marsoh_admin_decide_message", { p_message_id: messageId, p_actor_user_id: ctx.user.id, p_decision: input.decision, p_reason: input.reason }), "Moderasyon kararı uygulanamadı.");
    if (input.decision === "rejected") {
      assertDb(await supabaseAdmin.from("marsoh_message_reports").update({ status: "actioned", updated_at: new Date().toISOString() }).eq("message_id", messageId).eq("status", "open"), "Mesaj bildirimleri sonuçlandırılamadı.");
    }
    await auditEvent({ request, actorId: ctx.user.id, actorRole: ctx.profile.role, action: `marsoh.moderation.${input.decision}`, resourceType: "marsoh_message", resourceId: messageId, metadata: { reason: input.reason } });
    return { ok: true, decision: input.decision };
  });

  app.post("/v1/admin/marsoh/reports/:reportId/decision", async (request) => {
    const ctx = await requireModerator(request, "marsoh.report.decide");
    const reportId = uuidSchema.parse(request.params?.reportId);
    const input = reportDecisionSchema.parse(request.body || {});
    const report = assertDb(await supabaseAdmin.from("marsoh_message_reports")
      .update({ status: input.decision, updated_at: new Date().toISOString() })
      .eq("id", reportId).eq("status", "open").select("id,message_id,status").maybeSingle(), "Mesaj bildirimi sonuçlandırılamadı.");
    if (!report) throw httpError("Açık mesaj bildirimi bulunamadı.", 404, "MARSOH_REPORT_NOT_FOUND");
    await marsohAudit({ request, ctx, action: `marsoh.report.${input.decision}`, resourceType: "marsoh_message_report", resourceId: reportId, metadata: { message_id: report.message_id, reason: input.reason } });
    return { ok: true, report };
  });

  app.post("/v1/admin/marsoh/sanctions", async (request) => {
    const ctx = await requireModerator(request, "marsoh.sanction.create");
    const input = sanctionSchema.parse(request.body || {});
    const expiresAt = input.sanction_type === "temporary_mute" ? new Date(Date.now() + input.duration_minutes * 60000).toISOString() : null;
    const sanction = assertDb(await supabaseAdmin.from("marsoh_user_sanctions").insert({ user_id: input.user_id, sanction_type: input.sanction_type, reason: input.reason, expires_at: expiresAt, created_by: ctx.user.id }).select("id,user_id,sanction_type,status,expires_at").single(), "Yaptırım uygulanamadı.");
    await marsohAudit({ request, ctx, action: "marsoh.sanction.created", resourceType: "marsoh_user_sanction", resourceId: sanction.id, metadata: { target_user_id: input.user_id, sanction_type: input.sanction_type, expires_at: expiresAt } });
    return { ok: true, sanction };
  });

  app.post("/v1/admin/marsoh/sanctions/:sanctionId/lift", async (request) => {
    const ctx = await requireModerator(request, "marsoh.sanction.lift");
    const sanctionId = uuidSchema.parse(request.params?.sanctionId);
    assertDb(await supabaseAdmin.from("marsoh_user_sanctions").update({ status: "lifted", lifted_by: ctx.user.id, lifted_at: new Date().toISOString() }).eq("id", sanctionId).eq("status", "active"), "Yaptırım kaldırılamadı.");
    await marsohAudit({ request, ctx, action: "marsoh.sanction.lifted", resourceType: "marsoh_user_sanction", resourceId: sanctionId });
    return { ok: true, lifted: true };
  });
}
