import { z } from "zod";
import { auditEvent, authContext, hasMfa, hasRole, supabaseAdmin } from "../lib/supabase.js";
import {
  MARIPARTNER_REFRESH_QUESTIONS,
  MARIPARTNER_SLA_STAGES,
  constantTimeHashEqual,
  createReviewerCredentials,
  httpError,
  projectReviewerCandidate,
  reviewerCandidateFromProfilePayload,
  refreshResponsePayload,
  reviewerPassState,
  sanitizeRefreshQuestions,
  sanitizeReviewFields,
  sha256,
  slaStatus
} from "../lib/maritime-partner-center.js";

const uuid = z.string().uuid();
const optionalUuid = uuid.nullable().optional();
const refreshFiltersSchema = z.object({
  rank: z.string().trim().max(120).optional().default(""),
  vessel_type: z.string().trim().max(120).optional().default(""),
  earliest_join_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  availability_status: z.enum(["fresh", "stale", "expired", "unknown", "blocked"]).nullable().optional(),
  document_status: z.enum(["verified_ready", "ready_review", "draft", "unverified", "blocked"]).nullable().optional(),
  prior_relationship: z.literal("authorized_existing").default("authorized_existing")
}).strict();
const refreshSchema = z.object({
  partner_id: uuid,
  candidate_room_ids: z.array(uuid).min(1).max(250),
  job_id: optionalUuid,
  title: z.string().trim().min(3).max(140),
  filters: refreshFiltersSchema.optional().default({}),
  questions: z.array(z.string()).min(1).max(8),
  scheduled_at: z.string().datetime().optional(),
  expires_at: z.string().datetime()
}).strict();
const refreshResponseSchema = z.object({
  response_code: z.enum(["available", "unavailable", "date_changed", "not_interested"]),
  available_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  response_note: z.string().trim().max(500).optional(),
  preferred_vessel_type: z.string().trim().max(120).nullable().optional(),
  preferred_contract_length: z.string().trim().max(120).nullable().optional(),
  critical_document_change: z.boolean().optional().default(false),
  confirmed_fields: z.array(z.enum(MARIPARTNER_REFRESH_QUESTIONS)).max(8).optional().default([]),
  changed_fields: z.array(z.enum(MARIPARTNER_REFRESH_QUESTIONS)).max(8).optional().default([])
}).strict();
const evidenceResponseSchema = z.object({ decision: z.enum(["accepted", "declined"]) }).strict();
const evidenceTemplateSchema = z.object({
  partner_id: uuid,
  name: z.string().trim().min(3).max(140),
  hiring_stage: z.enum(["search", "shortlist", "conditional_hire", "onboarding"]),
  requirements: z.array(z.object({
    requirement_key: z.string().trim().regex(/^[a-z0-9_]{2,60}$/),
    label: z.string().trim().min(2).max(160),
    source_type: z.enum(["company_rule", "official_rule"]),
    official_source_url: z.string().url().max(500).nullable().optional(),
    sensitivity: z.enum(["metadata", "standard", "sensitive"]),
    required: z.boolean().default(true)
  }).strict()).min(1).max(40)
}).strict();
const evidenceRequestSchema = z.object({
  partner_id: uuid,
  template_id: uuid,
  candidate_room_id: uuid,
  job_id: optionalUuid,
  purpose: z.string().trim().min(8).max(500),
  expires_at: z.string().datetime()
}).strict();
const slaPolicySchema = z.object({
  partner_id: uuid,
  stage: z.enum(MARIPARTNER_SLA_STAGES),
  target_minutes: z.number().int().min(15).max(525600),
  primary_role: z.string().trim().min(2).max(80),
  primary_user_id: optionalUuid,
  backup_user_id: optionalUuid,
  notify_before_minutes: z.number().int().min(0).max(10080).default(60),
  escalation_after_minutes: z.number().int().min(0).max(10080).default(0),
  active: z.boolean().default(true)
}).strict();
const slaInstanceSchema = z.object({
  partner_id: uuid,
  policy_id: uuid,
  hiring_room_id: uuid,
  candidate_room_id: optionalUuid
}).strict();
const slaActionSchema = z.object({
  action: z.enum(["remind", "redirect_backup", "extend", "complete"]),
  reason: z.string().trim().min(3).max(500).optional(),
  extend_until: z.string().datetime().optional()
}).strict().superRefine((value, ctx) => {
  if (value.action === "extend" && (!value.reason || !value.extend_until)) ctx.addIssue({ code: "custom", message: "Uzatma tarihi ve gerekçesi zorunludur." });
});
const handoverSchema = z.object({
  partner_id: uuid,
  new_owner_user_id: uuid,
  backup_user_id: optionalUuid,
  reason: z.string().trim().min(6).max(500),
  next_action: z.string().trim().max(500).optional(),
  next_action_at: z.string().datetime().nullable().optional(),
  issue_note: z.string().trim().max(1000).optional()
}).strict();
const reviewerPassSchema = z.object({
  partner_id: uuid,
  candidate_room_id: uuid,
  job_id: optionalUuid,
  reviewer_name: z.string().trim().min(2).max(160),
  reviewer_contact: z.string().trim().min(5).max(250),
  purpose: z.string().trim().min(8).max(500),
  allowed_fields: z.array(z.string()).min(1).max(12),
  download_allowed: z.boolean().default(false),
  expires_at: z.string().datetime(),
  max_uses: z.number().int().min(1).max(20).default(1)
}).strict();
const reviewerAccessSchema = z.object({ token: z.string().min(30).max(200), code: z.string().regex(/^\d{6}$/) }).strict();
const reviewerDecisionSchema = reviewerAccessSchema.extend({
  decision: z.enum(["approved", "not_suitable", "comment"]),
  comment: z.string().trim().max(1200).optional()
}).strict();
const adminActionSchema = z.object({
  action: z.enum(["cancel_refresh", "cancel_evidence", "revoke_pass", "deactivate_sla"]),
  resource_id: uuid,
  reason: z.string().trim().min(6).max(500)
}).strict();

function assertDb(result, message) {
  if (result?.error) throw httpError(message, 500, "MARIPARTNER_DATABASE_ERROR");
  return result?.data;
}

function assertFutureWindow(value, { maxDays = 30, code = "EXPIRY_INVALID" } = {}) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= Date.now() || timestamp > Date.now() + maxDays * 86400000) {
    throw httpError(`Bitiş zamanı gelecekte ve en fazla ${maxDays} gün içinde olmalıdır.`, 400, code);
  }
}

async function partnerMemberships(userId) {
  const [owned, staffed] = await Promise.all([
    supabaseAdmin.from("partner_businesses").select("id,partner_code,display_name,status,verification_status,partner_type").eq("owner_id", userId).eq("partner_type", "maritime"),
    supabaseAdmin.from("partner_staff").select("partner_id,staff_role,permissions,status,partner_businesses!inner(id,partner_code,display_name,status,verification_status,partner_type)").eq("user_id", userId).eq("status", "active").eq("partner_businesses.partner_type", "maritime")
  ]);
  const memberships = new Map();
  (assertDb(owned, "Şirket sahipliği okunamadı.") || []).forEach((business) => memberships.set(business.id, { business, role: "owner", permissions: { all: true } }));
  (assertDb(staffed, "Şirket personel yetkisi okunamadı.") || []).forEach((row) => {
    const business = row.partner_businesses;
    if (business && !memberships.has(business.id)) memberships.set(business.id, { business, role: row.staff_role, permissions: row.permissions || {} });
  });
  return [...memberships.values()].filter((item) => item.business.status === "active");
}

async function requirePartner(request, action, partnerId = null, { manager = false } = {}) {
  const ctx = await authContext(request);
  if (!ctx?.user || !hasRole(ctx.profile, "partner") || !hasMfa(ctx)) throw httpError("MariPartner için MFA doğrulamalı denizcilik şirket hesabı gereklidir.", 403, "MARIPARTNER_ACCESS_REQUIRED");
  const memberships = await partnerMemberships(ctx.user.id);
  if (!memberships.length) throw httpError("Bu hesap aktif bir denizcilik şirketine bağlı değildir.", 403, "MARIPARTNER_MEMBERSHIP_REQUIRED");
  const membership = partnerId ? memberships.find((item) => item.business.id === partnerId) : memberships[0];
  if (!membership) throw httpError("Bu şirket üzerinde işlem yetkiniz yoktur.", 403, "MARIPARTNER_TENANT_DENIED");
  if (membership.business.verification_status !== "verified") throw httpError("MariPartner işlemleri için şirket doğrulaması tamamlanmalıdır.", 403, "MARIPARTNER_VERIFICATION_REQUIRED");
  if (manager && !["owner", "manager"].includes(membership.role) && membership.permissions?.manage_hiring !== true) throw httpError("Bu işlem şirket yöneticisi yetkisi gerektirir.", 403, "MARIPARTNER_MANAGER_REQUIRED");
  return { ctx, membership, memberships, action };
}

async function requireAdmin(request, action) {
  const ctx = await authContext(request);
  if (!ctx?.user || !hasRole(ctx.profile, ["admin", "super_admin"]) || !hasMfa(ctx)) throw httpError("MariPartner yönetimi için MFA doğrulamalı yönetici yetkisi gerekir.", 403, "MARIPARTNER_ADMIN_REQUIRED");
  return { ctx, action };
}

async function candidateRoom(partnerId, roomId) {
  const room = assertDb(await supabaseAdmin.from("maritime_private_candidate_rooms")
    .select("id,partner_id,job_id,hiring_room_id,seafarer_user_id,status,candidate_visible,expires_at")
    .eq("id", roomId).eq("partner_id", partnerId).maybeSingle(), "Aday odası okunamadı.");
  const expired = room?.expires_at && new Date(room.expires_at).getTime() <= Date.now();
  if (!room || expired || !["active", "offer", "hired"].includes(room.status) || room.candidate_visible !== true) throw httpError("Aday ilişkisi aktif veya yetkili değil.", 403, "CANDIDATE_RELATIONSHIP_REQUIRED");
  return room;
}

async function staffRows(partnerId) {
  const business = assertDb(await supabaseAdmin.from("partner_businesses").select("owner_id").eq("id", partnerId).single(), "Şirket sahibi okunamadı.");
  const staff = assertDb(await supabaseAdmin.from("partner_staff").select("user_id,full_name,staff_role,status").eq("partner_id", partnerId).eq("status", "active"), "Şirket ekibi okunamadı.") || [];
  const ids = [...new Set([business.owner_id, ...staff.map((item) => item.user_id)].filter(Boolean))];
  const profiles = ids.length ? assertDb(await supabaseAdmin.from("profiles").select("id,full_name,public_id").in("id", ids), "Şirket kullanıcıları okunamadı.") || [] : [];
  return ids.map((id) => {
    const staffItem = staff.find((item) => item.user_id === id);
    const profile = profiles.find((item) => item.id === id);
    return { user_id: id, full_name: staffItem?.full_name || profile?.full_name || "Yetkili", public_id: profile?.public_id || null, role: id === business.owner_id ? "owner" : staffItem?.staff_role || "support" };
  });
}

async function readinessSnapshot(seafarerUserId, requirements) {
  const result = await supabaseAdmin.from("maritime_readiness_items")
    .select("item_type,source_type,trust_level,verification_status,source_label,expires_at,verified_at,updated_at")
    .eq("seafarer_user_id", seafarerUserId);
  const items = assertDb(result, "Aday kanıt durumu okunamadı.") || [];
  const now = Date.now();
  return requirements.map((requirement) => {
    const candidates = items.filter((item) => item.item_type === requirement.requirement_key);
    const item = candidates.sort((left, right) => new Date(right.verified_at || right.updated_at || 0) - new Date(left.verified_at || left.updated_at || 0))[0];
    const expired = item?.expires_at && new Date(item.expires_at).getTime() <= now;
    const ready = item && !expired && item.verification_status === "verified";
    return {
      ...requirement,
      readiness_status: ready ? "ready" : item ? "review_required" : "missing",
      verification_status: expired ? "expired" : item?.verification_status || "missing",
      verified_source: item?.source_label || item?.source_type || null,
      valid_until: item?.expires_at || null
    };
  });
}

async function filterAuthorizedRooms(rooms, filters) {
  if (!rooms.length) return [];
  const userIds = [...new Set(rooms.map((room) => room.seafarer_user_id))];
  const [profilesResult, workspacesResult] = await Promise.all([
    supabaseAdmin.from("maritime_cv_profiles").select("seafarer_user_id,profile_payload").in("seafarer_user_id", userIds),
    supabaseAdmin.from("maritime_seafarer_workspaces").select("user_id,current_work_status,availability_status,readiness_level,metadata").in("user_id", userIds)
  ]);
  const profiles = assertDb(profilesResult, "Aday yeterlilikleri okunamadı.") || [];
  const workspaces = assertDb(workspacesResult, "Aday hazırlık durumları okunamadı.") || [];
  const normalize = (value) => String(value || "").normalize("NFKC").toLocaleLowerCase("tr-TR").trim();
  return rooms.filter((room) => {
    const payload = profiles.find((item) => item.seafarer_user_id === room.seafarer_user_id)?.profile_payload || {};
    const workspace = workspaces.find((item) => item.user_id === room.seafarer_user_id);
    if (filters.rank && !normalize(payload.rank).includes(normalize(filters.rank))) return false;
    if (filters.vessel_type && !(Array.isArray(payload.sea_service) && payload.sea_service.some((item) => normalize(item.vessel_type).includes(normalize(filters.vessel_type))))) return false;
    if (filters.earliest_join_date) {
      const availableFrom = String(workspace?.metadata?.available_from || "");
      const availableByRequestedDate = workspace?.current_work_status === "available_now"
        || (workspace?.current_work_status === "available_from_date" && /^\d{4}-\d{2}-\d{2}$/.test(availableFrom) && availableFrom <= filters.earliest_join_date);
      if (!availableByRequestedDate) return false;
    }
    if (filters.availability_status && workspace?.availability_status !== filters.availability_status) return false;
    if (filters.document_status && workspace?.readiness_level !== filters.document_status) return false;
    return true;
  });
}

async function partnerDashboard(partnerId) {
  const now = new Date().toISOString();
  const [jobs, rooms, matches, refreshes, refreshRequests, evidence, templates, policies, slas, handovers, passes, team] = await Promise.all([
    supabaseAdmin.from("maritime_jobs").select("id,job_reference,job_title,rank_code,status,created_at").eq("partner_id", partnerId).order("created_at", { ascending: false }).limit(80),
    supabaseAdmin.from("maritime_private_candidate_rooms").select("id,job_id,hiring_room_id,seafarer_user_id,status,candidate_visible,expires_at,created_at").eq("partner_id", partnerId).in("status", ["active", "offer", "hired"]).order("created_at", { ascending: false }).limit(250),
    supabaseAdmin.from("maritime_match_results").select("id,job_id,seafarer_user_id,hard_gate_status,preference_score,computed_at,stale_after,metadata").eq("partner_id", partnerId).order("computed_at", { ascending: false }).limit(250),
    supabaseAdmin.from("maritime_talent_refresh_campaigns").select("id,title,status,scheduled_at,expires_at,created_at").eq("partner_id", partnerId).order("created_at", { ascending: false }).limit(60),
    supabaseAdmin.from("maritime_talent_refresh_requests").select("id,status,response_code,available_from,changed_fields,campaign_id,created_at").eq("partner_id", partnerId).order("created_at", { ascending: false }).limit(500),
    supabaseAdmin.from("maritime_evidence_requests").select("id,status,purpose,requirement_snapshot,expires_at,candidate_room_id,created_at").eq("partner_id", partnerId).order("created_at", { ascending: false }).limit(80),
    supabaseAdmin.from("maritime_evidence_templates").select("id,name,hiring_stage,active,created_at").eq("partner_id", partnerId).eq("active", true).order("created_at", { ascending: false }).limit(80),
    supabaseAdmin.from("maritime_hiring_sla_policies").select("id,stage,target_minutes,primary_role,primary_user_id,backup_user_id,notify_before_minutes,active").eq("partner_id", partnerId).eq("active", true).order("stage"),
    supabaseAdmin.from("maritime_hiring_sla_instances").select("id,policy_id,hiring_room_id,candidate_room_id,stage,status,due_at,completed_at,extended_until").eq("partner_id", partnerId).order("due_at", { ascending: true }).limit(120),
    supabaseAdmin.from("maritime_hiring_handovers").select("id,hiring_room_id,previous_owner_user_id,new_owner_user_id,backup_user_id,reason,structured_summary,created_at").eq("partner_id", partnerId).order("created_at", { ascending: false }).limit(80),
    supabaseAdmin.from("maritime_reviewer_passes").select("id,candidate_room_id,job_id,reviewer_name,purpose,status,allowed_fields,download_allowed,use_count,max_uses,expires_at,created_at").eq("partner_id", partnerId).order("created_at", { ascending: false }).limit(80),
    staffRows(partnerId)
  ]);
  const jobRows = assertDb(jobs, "İlanlar okunamadı.") || [];
  const roomRows = (assertDb(rooms, "Aday odaları okunamadı.") || []).filter((room) => room.candidate_visible === true && (!room.expires_at || new Date(room.expires_at).getTime() > Date.now()));
  const profileIds = [...new Set(roomRows.map((item) => item.seafarer_user_id))];
  const profiles = profileIds.length ? assertDb(await supabaseAdmin.from("profiles").select("id,public_id,full_name").in("id", profileIds), "Aday profilleri okunamadı.") || [] : [];
  const safeRooms = roomRows.map((room) => ({ ...room, candidate: profiles.find((profile) => profile.id === room.seafarer_user_id) || { public_id: null, full_name: "Aday" } }));
  const matchRows = (assertDb(matches, "Eşleşmeler okunamadı.") || []).filter((match) => match.hard_gate_status === "passed" && match.metadata?.eligible === true && (!match.stale_after || new Date(match.stale_after).getTime() > Date.now()) && roomRows.some((room) => room.seafarer_user_id === match.seafarer_user_id && (!match.job_id || room.job_id === match.job_id)));
  const slaRows = (assertDb(slas, "Süreç süreleri okunamadı.") || []).map((item) => ({ ...item, status: slaStatus({ dueAt: item.extended_until || item.due_at, completedAt: item.completed_at, now }) }));
  const passRows = (assertDb(passes, "İnceleme geçişleri okunamadı.") || []).map((item) => ({ ...item, status: reviewerPassState(item) }));
  const refreshRequestRows = assertDb(refreshRequests, "Aday güncelleme yanıtları okunamadı.") || [];
  const pendingRefresh = refreshRequestRows.filter((item) => ["scheduled", "sent"].includes(item.status)).length;
  const pendingEvidence = (evidence.data || []).filter((item) => ["requested", "candidate_action"].includes(item.status)).length;
  const overdueSteps = slaRows.filter((item) => item.status === "overdue").length;
  return {
    jobs: jobRows,
    candidate_rooms: safeRooms,
    matches: matchRows,
    refresh_campaigns: assertDb(refreshes, "Yenileme kayıtları okunamadı.") || [],
    refresh_requests: refreshRequestRows,
    evidence_requests: assertDb(evidence, "Kanıt talepleri okunamadı.") || [],
    evidence_templates: assertDb(templates, "Kanıt şablonları okunamadı.") || [],
    sla_policies: assertDb(policies, "Süreç kuralları okunamadı.") || [],
    sla_instances: slaRows,
    handovers: assertDb(handovers, "Devir kayıtları okunamadı.") || [],
    reviewer_passes: passRows,
    team,
    counters: {
      open_jobs: jobRows.filter((item) => item.status === "open").length,
      authorized_candidates: safeRooms.length,
      eligible_matches: matchRows.length,
      overdue_steps: overdueSteps,
      pending_evidence: pendingEvidence,
      pending_refresh: pendingRefresh,
      active_reviewer_passes: passRows.filter((item) => item.status === "active").length,
      action_required: pendingRefresh + pendingEvidence + overdueSteps
    }
  };
}

async function logAction(request, ctx, action, resourceType, resourceId, metadata = {}, severity = "info") {
  await auditEvent({ request, actorId: ctx.user.id, actorRole: ctx.profile.role, action, resourceType, resourceId, metadata, severity, evidenceTags: ["maripartner", "maritime_hiring"] });
}

export function registerMaritimePartnerCenterRoutes(app) {
  app.get("/v1/maritime/partner-center", async (request) => {
    const partnerId = request.query?.partner_id ? uuid.parse(request.query.partner_id) : null;
    const access = await requirePartner(request, "dashboard.read", partnerId);
    const dashboard = await partnerDashboard(access.membership.business.id);
    return { ok: true, partner: access.membership.business, memberships: access.memberships.map((item) => ({ ...item.business, role: item.role })), ...dashboard };
  });

  app.post("/v1/maritime/partner-center/refresh-campaigns", { config: { rateLimit: { max: 12, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = refreshSchema.parse(request.body || {});
    const access = await requirePartner(request, "refresh.create", body.partner_id);
    assertFutureWindow(body.expires_at, { maxDays: 30, code: "REFRESH_EXPIRY_INVALID" });
    const questions = sanitizeRefreshQuestions(body.questions);
    if (!questions.length) throw httpError("En az bir güvenli güncelleme sorusu seçin.", 400, "REFRESH_QUESTION_REQUIRED");
    const rooms = assertDb(await supabaseAdmin.from("maritime_private_candidate_rooms").select("id,seafarer_user_id,status,candidate_visible,expires_at").eq("partner_id", body.partner_id).in("id", body.candidate_room_ids), "Aday havuzu doğrulanamadı.") || [];
    const authorized = rooms.filter((room) => ["active", "offer", "hired"].includes(room.status) && room.candidate_visible === true && (!room.expires_at || new Date(room.expires_at).getTime() > Date.now()));
    if (authorized.length !== new Set(body.candidate_room_ids).size) throw httpError("Yalnız şirketin yetkili özel aday havuzundaki kişiler seçilebilir.", 403, "REFRESH_POOL_SCOPE_DENIED");
    const eligible = await filterAuthorizedRooms(authorized, body.filters);
    if (!eligible.length) throw httpError("Seçilen filtrelerle güncellenebilecek yetkili aday bulunamadı.", 409, "REFRESH_FILTER_EMPTY");
    const campaign = assertDb(await supabaseAdmin.from("maritime_talent_refresh_campaigns").insert({ partner_id: body.partner_id, job_id: body.job_id || null, created_by: access.ctx.user.id, title: body.title, filters: body.filters, questions, scheduled_at: body.scheduled_at || new Date().toISOString(), expires_at: body.expires_at, status: "sent" }).select("*").single(), "Havuz güncellemesi oluşturulamadı.");
    const requests = eligible.map((room) => ({ campaign_id: campaign.id, partner_id: body.partner_id, seafarer_user_id: room.seafarer_user_id, candidate_room_id: room.id, status: "sent" }));
    assertDb(await supabaseAdmin.from("maritime_talent_refresh_requests").insert(requests), "Aday güncelleme görevleri oluşturulamadı.");
    await logAction(request, access.ctx, "maripartner.refresh_created", "maritime_talent_refresh_campaign", campaign.id, { partner_id: body.partner_id, recipient_count: requests.length });
    return reply.code(201).send({ ok: true, campaign, recipient_count: requests.length, delivery: "in_app_task" });
  });

  app.get("/v1/maritime/candidate/refresh-requests", async (request) => {
    const ctx = await authContext(request);
    if (!ctx?.user || !hasRole(ctx.profile, "customer")) throw httpError("Bu alan denizci kullanıcı hesabına açıktır.", 403, "SEAFARER_ACCOUNT_REQUIRED");
    const rows = assertDb(await supabaseAdmin.from("maritime_talent_refresh_requests").select("id,status,response_code,available_from,response_note,responded_at,created_at,campaign:maritime_talent_refresh_campaigns!inner(title,questions,expires_at,status),partner:partner_businesses!inner(display_name,verification_status)").eq("seafarer_user_id", ctx.user.id).order("created_at", { ascending: false }).limit(100), "Bilgi güncelleme talepleri okunamadı.") || [];
    return { ok: true, requests: rows.filter((item) => item.partner?.verification_status === "verified") };
  });

  app.post("/v1/maritime/candidate/refresh-requests/:requestId/respond", async (request) => {
    const ctx = await authContext(request);
    if (!ctx?.user || !hasRole(ctx.profile, "customer")) throw httpError("Bu alan denizci kullanıcı hesabına açıktır.", 403, "SEAFARER_ACCOUNT_REQUIRED");
    const requestId = uuid.parse(request.params.requestId);
    const payload = refreshResponsePayload(refreshResponseSchema.parse(request.body || {}));
    const current = assertDb(await supabaseAdmin.from("maritime_talent_refresh_requests").select("id,campaign_id,status,campaign:maritime_talent_refresh_campaigns!inner(expires_at,status,questions)").eq("id", requestId).eq("seafarer_user_id", ctx.user.id).maybeSingle(), "Güncelleme talebi okunamadı.");
    if (!current || !["scheduled", "sent"].includes(current.status)) throw httpError("Bu güncelleme talebi yanıtlanamaz.", 409, "REFRESH_REQUEST_NOT_OPEN");
    if (["cancelled", "expired"].includes(current.campaign?.status) || new Date(current.campaign?.expires_at).getTime() <= Date.now()) throw httpError("Bu güncelleme talebinin süresi dolmuştur.", 410, "REFRESH_REQUEST_EXPIRED");
    const allowedQuestions = sanitizeRefreshQuestions(current.campaign?.questions || []);
    const submitted = refreshResponseSchema.parse(request.body || {});
    const detailPayload = {
      preferred_vessel_type: allowedQuestions.includes("preferred_vessel_type") ? submitted.preferred_vessel_type || null : null,
      preferred_contract_length: allowedQuestions.includes("preferred_contract_length") ? submitted.preferred_contract_length || null : null,
      critical_document_change: allowedQuestions.includes("critical_document_change") ? submitted.critical_document_change === true : false
    };
    const confirmedFields = submitted.confirmed_fields.filter((field) => allowedQuestions.includes(field));
    const changedFields = submitted.changed_fields.filter((field) => allowedQuestions.includes(field));
    const updated = assertDb(await supabaseAdmin.from("maritime_talent_refresh_requests").update({ ...payload, response_payload: detailPayload, confirmed_fields: confirmedFields, changed_fields: changedFields, last_confirmed_at: new Date().toISOString() }).eq("id", requestId).eq("seafarer_user_id", ctx.user.id).select("id,status,response_code,available_from,responded_at,changed_fields").single(), "Yanıt kaydedilemedi.");
    const pendingResult = await supabaseAdmin.from("maritime_talent_refresh_requests").select("id", { count: "exact", head: true }).eq("campaign_id", current.campaign_id).in("status", ["scheduled", "sent"]);
    if (pendingResult.error) throw httpError("Kampanya durumu hesaplanamadı.", 500, "MARIPARTNER_DATABASE_ERROR");
    if (Number(pendingResult.count || 0) === 0) await supabaseAdmin.from("maritime_talent_refresh_campaigns").update({ status: "responded", updated_at: new Date().toISOString() }).eq("id", current.campaign_id).eq("status", "sent");
    await logAction(request, ctx, "maripartner.refresh_responded", "maritime_talent_refresh_request", requestId, { response_code: payload.response_code });
    return { ok: true, request: updated };
  });

  app.get("/v1/maritime/candidate/evidence-requests", async (request) => {
    const ctx = await authContext(request);
    if (!ctx?.user || !hasRole(ctx.profile, "customer")) throw httpError("Bu alan denizci kullanıcı hesabına açıktır.", 403, "SEAFARER_ACCOUNT_REQUIRED");
    const rows = assertDb(await supabaseAdmin.from("maritime_evidence_requests")
      .select("id,status,purpose,requirement_snapshot,candidate_consent_status,candidate_responded_at,expires_at,created_at,partner:partner_businesses!inner(display_name,verification_status),template:maritime_evidence_templates!inner(name,hiring_stage)")
      .eq("seafarer_user_id", ctx.user.id).order("created_at", { ascending: false }).limit(100), "Kanıt talepleri okunamadı.") || [];
    return { ok: true, requests: rows.filter((item) => item.partner?.verification_status === "verified") };
  });

  app.post("/v1/maritime/candidate/evidence-requests/:requestId/respond", async (request) => {
    const ctx = await authContext(request);
    if (!ctx?.user || !hasRole(ctx.profile, "customer")) throw httpError("Bu alan denizci kullanıcı hesabına açıktır.", 403, "SEAFARER_ACCOUNT_REQUIRED");
    const requestId = uuid.parse(request.params.requestId);
    const body = evidenceResponseSchema.parse(request.body || {});
    const current = assertDb(await supabaseAdmin.from("maritime_evidence_requests").select("id,status,sensitive_access_request_id,expires_at").eq("id", requestId).eq("seafarer_user_id", ctx.user.id).maybeSingle(), "Kanıt talebi okunamadı.");
    if (!current || !["requested", "candidate_action"].includes(current.status)) throw httpError("Bu kanıt talebi artık yanıtlanamaz.", 409, "EVIDENCE_REQUEST_NOT_OPEN");
    if (new Date(current.expires_at).getTime() <= Date.now()) throw httpError("Bu kanıt talebinin süresi dolmuştur.", 410, "EVIDENCE_REQUEST_EXPIRED");
    const update = { candidate_consent_status: body.decision, candidate_responded_at: new Date().toISOString(), status: body.decision === "accepted" ? "candidate_action" : "cancelled", updated_at: new Date().toISOString() };
    const evidence = assertDb(await supabaseAdmin.from("maritime_evidence_requests").update(update).eq("id", requestId).eq("seafarer_user_id", ctx.user.id).select("id,status,candidate_consent_status,candidate_responded_at").single(), "Kanıt talebi yanıtlanamadı.");
    if (body.decision === "declined" && current.sensitive_access_request_id) await supabaseAdmin.from("maritime_sensitive_access_requests").update({ status: "denied", decided_at: new Date().toISOString() }).eq("id", current.sensitive_access_request_id).eq("status", "requested");
    await logAction(request, ctx, "maripartner.evidence_candidate_response", "maritime_evidence_request", requestId, { decision: body.decision });
    return { ok: true, evidence_request: evidence, next_path: body.decision === "accepted" ? "/pages/ecosystem/maritime-documents.html" : null };
  });

  app.post("/v1/maritime/partner-center/evidence-templates", async (request, reply) => {
    const body = evidenceTemplateSchema.parse(request.body || {});
    const access = await requirePartner(request, "evidence_template.create", body.partner_id, { manager: true });
    body.requirements.forEach((item) => { if (item.source_type === "official_rule" && !item.official_source_url) throw httpError("Resmî kural için doğrulanabilir kaynak bağlantısı zorunludur.", 400, "OFFICIAL_SOURCE_REQUIRED"); });
    const template = assertDb(await supabaseAdmin.from("maritime_evidence_templates").insert({ partner_id: body.partner_id, name: body.name, hiring_stage: body.hiring_stage, created_by: access.ctx.user.id }).select("*").single(), "Kanıt şablonu oluşturulamadı.");
    const requirements = body.requirements.map((item, index) => ({ ...item, template_id: template.id, display_order: index }));
    assertDb(await supabaseAdmin.from("maritime_evidence_requirements").insert(requirements), "Kanıt kuralları kaydedilemedi.");
    await logAction(request, access.ctx, "maripartner.evidence_template_created", "maritime_evidence_template", template.id, { partner_id: body.partner_id, requirement_count: requirements.length });
    return reply.code(201).send({ ok: true, template: { ...template, requirements } });
  });

  app.post("/v1/maritime/partner-center/evidence-requests", async (request, reply) => {
    const body = evidenceRequestSchema.parse(request.body || {});
    const access = await requirePartner(request, "evidence_request.create", body.partner_id);
    assertFutureWindow(body.expires_at, { maxDays: 30, code: "EVIDENCE_EXPIRY_INVALID" });
    const room = await candidateRoom(body.partner_id, body.candidate_room_id);
    const template = assertDb(await supabaseAdmin.from("maritime_evidence_templates").select("id,hiring_stage,active").eq("id", body.template_id).eq("partner_id", body.partner_id).eq("active", true).maybeSingle(), "Kanıt şablonu okunamadı.");
    if (!template) throw httpError("Aktif kanıt şablonu bulunamadı.", 404, "EVIDENCE_TEMPLATE_NOT_FOUND");
    const requirements = assertDb(await supabaseAdmin.from("maritime_evidence_requirements").select("requirement_key,label,source_type,official_source_url,sensitivity,required").eq("template_id", template.id).order("display_order"), "Kanıt kuralları okunamadı.") || [];
    const requirementSnapshot = await readinessSnapshot(room.seafarer_user_id, requirements);
    let sensitiveAccessRequestId = null;
    if (requirements.some((item) => item.sensitivity === "sensitive")) {
      const trustCase = assertDb(await supabaseAdmin.from("maritime_trust_cases").insert({ case_type: "content_access", subject_type: "document", partner_id: body.partner_id, seafarer_user_id: room.seafarer_user_id, opened_by: access.ctx.user.id, summary: "MariPartner minimum gerekli kanıt erişimi", metadata: { candidate_room_id: room.id, job_id: body.job_id || room.job_id } }).select("id").single(), "Hassas erişim vakası oluşturulamadı.");
      const sensitive = assertDb(await supabaseAdmin.from("maritime_sensitive_access_requests").insert({ case_id: trustCase.id, requester_user_id: access.ctx.user.id, access_scope: "document_content", purpose: body.purpose, justification: "Adayın açık rızasına bağlı minimum gerekli işe alım kanıtı", status: "requested", expires_at: body.expires_at, metadata: { partner_id: body.partner_id, candidate_room_id: room.id, download_allowed: false } }).select("id").single(), "Hassas erişim talebi oluşturulamadı.");
      sensitiveAccessRequestId = sensitive.id;
    }
    const evidence = assertDb(await supabaseAdmin.from("maritime_evidence_requests").insert({ partner_id: body.partner_id, template_id: template.id, job_id: body.job_id || room.job_id, candidate_room_id: room.id, seafarer_user_id: room.seafarer_user_id, requested_by: access.ctx.user.id, requirement_snapshot: requirementSnapshot, sensitive_access_request_id: sensitiveAccessRequestId, purpose: body.purpose, expires_at: body.expires_at }).select("*").single(), "Kanıt talebi oluşturulamadı.");
    await logAction(request, access.ctx, "maripartner.evidence_requested", "maritime_evidence_request", evidence.id, { partner_id: body.partner_id, sensitive_access_requested: Boolean(sensitiveAccessRequestId) });
    return reply.code(201).send({ ok: true, evidence_request: evidence });
  });

  app.post("/v1/maritime/partner-center/sla-policies", async (request) => {
    const body = slaPolicySchema.parse(request.body || {});
    const access = await requirePartner(request, "sla_policy.upsert", body.partner_id, { manager: true });
    const team = await staffRows(body.partner_id);
    for (const userId of [body.primary_user_id, body.backup_user_id].filter(Boolean)) if (!team.some((item) => item.user_id === userId)) throw httpError("Süreç sorumlusu şirket ekibinde değildir.", 403, "SLA_ASSIGNEE_TENANT_DENIED");
    const policy = assertDb(await supabaseAdmin.from("maritime_hiring_sla_policies").upsert({ ...body, created_by: access.ctx.user.id, updated_at: new Date().toISOString() }, { onConflict: "partner_id,stage" }).select("*").single(), "Süreç süresi kaydedilemedi.");
    await logAction(request, access.ctx, "maripartner.sla_policy_saved", "maritime_hiring_sla_policy", policy.id, { partner_id: body.partner_id, stage: body.stage });
    return { ok: true, policy };
  });

  app.post("/v1/maritime/partner-center/sla-instances", async (request, reply) => {
    const body = slaInstanceSchema.parse(request.body || {});
    const access = await requirePartner(request, "sla_instance.create", body.partner_id);
    const room = assertDb(await supabaseAdmin.from("maritime_hiring_rooms").select("id,status").eq("id", body.hiring_room_id).eq("partner_id", body.partner_id).maybeSingle(), "İşe alım dosyası okunamadı.");
    if (!room || !["active", "paused"].includes(room.status)) throw httpError("Süre takibi yalnız açık işe alım dosyasında başlatılabilir.", 409, "HIRING_CASE_NOT_OPEN");
    const policy = assertDb(await supabaseAdmin.from("maritime_hiring_sla_policies").select("*").eq("id", body.policy_id).eq("partner_id", body.partner_id).eq("active", true).maybeSingle(), "Süre kuralı okunamadı.");
    if (!policy) throw httpError("Aktif süreç süresi kuralı bulunamadı.", 404, "SLA_POLICY_NOT_FOUND");
    if (body.candidate_room_id) {
      const candidate = await candidateRoom(body.partner_id, body.candidate_room_id);
      if (candidate.hiring_room_id !== body.hiring_room_id) throw httpError("Aday odası bu işe alım dosyasına bağlı değildir.", 409, "SLA_CANDIDATE_ROOM_MISMATCH");
    }
    const dueAt = new Date(Date.now() + Number(policy.target_minutes) * 60000).toISOString();
    const instance = assertDb(await supabaseAdmin.from("maritime_hiring_sla_instances").insert({ partner_id: body.partner_id, policy_id: policy.id, hiring_room_id: body.hiring_room_id, candidate_room_id: body.candidate_room_id || null, stage: policy.stage, status: "on_time", due_at: dueAt }).select("*").single(), "Süre takibi başlatılamadı.");
    await logAction(request, access.ctx, "maripartner.sla_started", "maritime_hiring_sla_instance", instance.id, { partner_id: body.partner_id, hiring_room_id: body.hiring_room_id, stage: policy.stage });
    return reply.code(201).send({ ok: true, instance });
  });

  app.post("/v1/maritime/partner-center/sla-instances/:instanceId/action", async (request) => {
    const instanceId = uuid.parse(request.params.instanceId);
    const body = slaActionSchema.parse(request.body || {});
    const current = assertDb(await supabaseAdmin.from("maritime_hiring_sla_instances").select("*,policy:maritime_hiring_sla_policies(backup_user_id)").eq("id", instanceId).maybeSingle(), "Süreç kaydı okunamadı.");
    if (!current) throw httpError("Süreç kaydı bulunamadı.", 404, "SLA_INSTANCE_NOT_FOUND");
    const access = await requirePartner(request, `sla.${body.action}`, current.partner_id, { manager: body.action === "redirect_backup" });
    const now = new Date().toISOString();
    const update = { updated_at: now };
    if (body.action === "remind") update.last_reminded_at = now;
    if (body.action === "redirect_backup") {
      if (!current.policy?.backup_user_id) throw httpError("Bu süreç için yedek sorumlu tanımlı değildir.", 409, "SLA_BACKUP_REQUIRED");
      const ownership = assertDb(await supabaseAdmin.from("maritime_hiring_case_ownership").select("*").eq("hiring_room_id", current.hiring_room_id).maybeSingle(), "Dosya sorumluluğu okunamadı.");
      if (ownership?.owner_user_id !== current.policy.backup_user_id && access.ctx.user.id !== current.policy.backup_user_id) {
        const summary = {
          last_completed_action: ownership?.last_completed_action || null,
          waiting_party: ownership?.waiting_party || null,
          next_action: ownership?.next_action || "Geciken SLA adımını tamamla",
          next_action_at: ownership?.next_action_at || current.due_at,
          issue_note: ownership?.issue_note || `SLA aşaması gecikti: ${current.stage}`,
          last_candidate_contact_at: ownership?.last_candidate_contact_at || null
        };
        assertDb(await supabaseAdmin.rpc("maritime_transfer_hiring_case", { p_partner_id: current.partner_id, p_hiring_room_id: current.hiring_room_id, p_new_owner_user_id: current.policy.backup_user_id, p_backup_user_id: ownership?.owner_user_id || null, p_reason: "Geciken süreç yedek sorumluya yönlendirildi", p_summary: summary, p_actor_user_id: access.ctx.user.id }), "Dosya yedek sorumluya yönlendirilemedi.");
      }
      update.escalated_at = now;
    }
    if (body.action === "extend") {
      assertFutureWindow(body.extend_until, { maxDays: 365, code: "SLA_EXTENSION_INVALID" });
      update.extended_until = body.extend_until; update.extension_reason = body.reason; update.status = "on_time";
    }
    if (body.action === "complete") { update.completed_at = now; update.status = "completed"; }
    const instance = assertDb(await supabaseAdmin.from("maritime_hiring_sla_instances").update(update).eq("id", instanceId).eq("partner_id", current.partner_id).select("*").single(), "Süreç işlemi tamamlanamadı.");
    await logAction(request, access.ctx, `maripartner.sla_${body.action}`, "maritime_hiring_sla_instance", instanceId, { partner_id: current.partner_id, reason: body.reason || null });
    return { ok: true, instance };
  });

  app.post("/v1/maritime/partner-center/hiring-rooms/:roomId/handover", async (request) => {
    const roomId = uuid.parse(request.params.roomId);
    const body = handoverSchema.parse(request.body || {});
    const access = await requirePartner(request, "handover.create", body.partner_id, { manager: true });
    const room = assertDb(await supabaseAdmin.from("maritime_hiring_rooms").select("id,status,job_id,metadata").eq("id", roomId).eq("partner_id", body.partner_id).maybeSingle(), "İşe alım dosyası okunamadı.");
    if (!room || !["active", "paused"].includes(room.status)) throw httpError("Yalnız açık işe alım dosyaları devredilebilir.", 409, "HIRING_CASE_NOT_OPEN");
    const team = await staffRows(body.partner_id);
    if (!team.some((item) => item.user_id === body.new_owner_user_id) || (body.backup_user_id && !team.some((item) => item.user_id === body.backup_user_id))) throw httpError("Yeni sorumlu şirket ekibinde değildir.", 403, "HANDOVER_ASSIGNEE_TENANT_DENIED");
    const existing = assertDb(await supabaseAdmin.from("maritime_hiring_case_ownership").select("*").eq("hiring_room_id", roomId).maybeSingle(), "Dosya sahipliği okunamadı.");
    const previousOwner = existing?.owner_user_id || access.ctx.user.id;
    if (previousOwner === body.new_owner_user_id) throw httpError("Yeni sorumlu mevcut sorumludan farklı olmalıdır.", 409, "HANDOVER_OWNER_UNCHANGED");
    const summary = { last_completed_action: existing?.last_completed_action || null, waiting_party: existing?.waiting_party || null, next_action: body.next_action || existing?.next_action || null, next_action_at: body.next_action_at || existing?.next_action_at || null, issue_note: body.issue_note || existing?.issue_note || null, last_candidate_contact_at: existing?.last_candidate_contact_at || null };
    const transfer = assertDb(await supabaseAdmin.rpc("maritime_transfer_hiring_case", { p_partner_id: body.partner_id, p_hiring_room_id: roomId, p_new_owner_user_id: body.new_owner_user_id, p_backup_user_id: body.backup_user_id || null, p_reason: body.reason, p_summary: summary, p_actor_user_id: access.ctx.user.id }), "Dosya sahipliği atomik olarak devredilemedi.")?.[0];
    await logAction(request, access.ctx, "maripartner.hiring_case_handed_over", "maritime_hiring_room", roomId, { partner_id: body.partner_id, previous_owner_user_id: transfer?.previous_owner_user_id || previousOwner, new_owner_user_id: body.new_owner_user_id, handover_id: transfer?.handover_id || null });
    return { ok: true, transfer };
  });

  app.post("/v1/maritime/partner-center/reviewer-passes", { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = reviewerPassSchema.parse(request.body || {});
    const access = await requirePartner(request, "reviewer_pass.create", body.partner_id, { manager: true });
    const room = await candidateRoom(body.partner_id, body.candidate_room_id);
    if (body.job_id && body.job_id !== room.job_id) throw httpError("İnceleme ilanı aday odasındaki ilanla eşleşmiyor.", 409, "REVIEW_JOB_SCOPE_MISMATCH");
    const allowedFields = sanitizeReviewFields(body.allowed_fields);
    if (!allowedFields.length) throw httpError("En az bir güvenli inceleme alanı seçin.", 400, "REVIEW_FIELDS_REQUIRED");
    if (new Date(body.expires_at).getTime() <= Date.now() || new Date(body.expires_at).getTime() > Date.now() + 30 * 86400000) throw httpError("Geçiş süresi gelecekte ve en fazla 30 gün olmalıdır.", 400, "REVIEW_PASS_EXPIRY_INVALID");
    const credentials = createReviewerCredentials();
    const pass = assertDb(await supabaseAdmin.from("maritime_reviewer_passes").insert({ partner_id: body.partner_id, candidate_room_id: room.id, job_id: body.job_id || room.job_id, seafarer_user_id: room.seafarer_user_id, created_by: access.ctx.user.id, reviewer_name: body.reviewer_name, reviewer_contact_hash: sha256(body.reviewer_contact), purpose: body.purpose, allowed_fields: allowedFields, download_allowed: body.download_allowed, token_hash: credentials.tokenHash, code_hash: credentials.codeHash, max_uses: body.max_uses, expires_at: body.expires_at }).select("id,reviewer_name,purpose,allowed_fields,download_allowed,max_uses,expires_at,status").single(), "Güvenli inceleme geçişi oluşturulamadı.");
    await logAction(request, access.ctx, "maripartner.reviewer_pass_created", "maritime_reviewer_pass", pass.id, { partner_id: body.partner_id, allowed_fields: allowedFields, download_allowed: body.download_allowed });
    return reply.code(201).send({ ok: true, pass, reviewer_url: "/pages/partner/maritime-review.html", access_token: credentials.token, one_time_code: credentials.code, delivery: "link_generated_not_sent" });
  });

  app.post("/v1/maritime/partner-center/reviewer-passes/:passId/revoke", async (request) => {
    const passId = uuid.parse(request.params.passId);
    const row = assertDb(await supabaseAdmin.from("maritime_reviewer_passes").select("id,partner_id,status").eq("id", passId).maybeSingle(), "İnceleme geçişi okunamadı.");
    if (!row) throw httpError("İnceleme geçişi bulunamadı.", 404, "REVIEW_PASS_NOT_FOUND");
    const access = await requirePartner(request, "reviewer_pass.revoke", row.partner_id, { manager: true });
    const pass = assertDb(await supabaseAdmin.from("maritime_reviewer_passes").update({ status: "revoked", revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", passId).eq("partner_id", row.partner_id).select("id,status,revoked_at").single(), "İnceleme geçişi iptal edilemedi.");
    await logAction(request, access.ctx, "maripartner.reviewer_pass_revoked", "maritime_reviewer_pass", passId, { partner_id: row.partner_id });
    return { ok: true, pass };
  });

  async function reviewerPassFromCredentials(request, body) {
    const tokenHash = sha256(body.token);
    const pass = assertDb(await supabaseAdmin.from("maritime_reviewer_passes").select("*").eq("token_hash", tokenHash).maybeSingle(), "İnceleme geçişi doğrulanamadı.");
    if (!pass || !constantTimeHashEqual(pass.code_hash, body.code)) {
      await auditEvent({ request, action: "maripartner.reviewer_pass_access_denied", resourceType: "maritime_reviewer_pass", resourceId: pass?.id || null, severity: "warning", metadata: { reason: "invalid_credentials" }, evidenceTags: ["maripartner", "external_reviewer", "denied"] });
      throw httpError("Geçiş bilgileri doğrulanamadı.", 403, "REVIEW_PASS_INVALID");
    }
    const state = reviewerPassState(pass);
    if (state !== "active") {
      await auditEvent({ request, action: "maripartner.reviewer_pass_access_denied", resourceType: "maritime_reviewer_pass", resourceId: pass.id, severity: "warning", metadata: { reason: state }, evidenceTags: ["maripartner", "external_reviewer", "denied"] });
      throw httpError("Bu inceleme geçişi artık kullanılamaz.", 410, `REVIEW_PASS_${state.toUpperCase()}`);
    }
    const room = assertDb(await supabaseAdmin.from("maritime_private_candidate_rooms").select("id,status,candidate_visible,expires_at").eq("id", pass.candidate_room_id).eq("partner_id", pass.partner_id).maybeSingle(), "Aday ilişkisi doğrulanamadı.");
    const job = pass.job_id ? assertDb(await supabaseAdmin.from("maritime_jobs").select("id,status,job_title,job_reference").eq("id", pass.job_id).eq("partner_id", pass.partner_id).maybeSingle(), "İlan doğrulanamadı.") : null;
    const roomExpired = room?.expires_at && new Date(room.expires_at).getTime() <= Date.now();
    if (!room || roomExpired || !["active", "offer", "hired"].includes(room.status) || room.candidate_visible !== true || (pass.job_id && !job) || (job && ["closed", "cancelled"].includes(job.status))) {
      await auditEvent({ request, action: "maripartner.reviewer_pass_access_denied", resourceType: "maritime_reviewer_pass", resourceId: pass.id, severity: "warning", metadata: { reason: "scope_closed" }, evidenceTags: ["maripartner", "external_reviewer", "denied"] });
      throw httpError("İnceleme kapsamı kapanmıştır.", 410, "REVIEW_SCOPE_CLOSED");
    }
    return { pass, job };
  }

  app.post("/v1/maritime/reviewer-pass/access", { config: { rateLimit: { max: 10, timeWindow: "5 minutes" } } }, async (request) => {
    const body = reviewerAccessSchema.parse(request.body || {});
    const { pass, job } = await reviewerPassFromCredentials(request, body);
    const profile = assertDb(await supabaseAdmin.from("maritime_cv_profiles").select("profile_payload").eq("seafarer_user_id", pass.seafarer_user_id).maybeSingle(), "Aday özeti okunamadı.");
    const safeCandidate = projectReviewerCandidate(reviewerCandidateFromProfilePayload(profile?.profile_payload), pass.allowed_fields);
    await supabaseAdmin.from("maritime_reviewer_passes").update({ last_accessed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", pass.id);
    await auditEvent({ request, action: "maripartner.reviewer_pass_viewed", resourceType: "maritime_reviewer_pass", resourceId: pass.id, metadata: { partner_id: pass.partner_id, field_count: pass.allowed_fields.length }, evidenceTags: ["maripartner", "external_reviewer"] });
    return { ok: true, review: { pass_id: pass.id, reviewer_name: pass.reviewer_name, purpose: pass.purpose, expires_at: pass.expires_at, download_allowed: pass.download_allowed, job, candidate: safeCandidate } };
  });

  app.post("/v1/maritime/reviewer-pass/decision", { config: { rateLimit: { max: 10, timeWindow: "5 minutes" } } }, async (request) => {
    const body = reviewerDecisionSchema.parse(request.body || {});
    const { pass } = await reviewerPassFromCredentials(request, body);
    if (body.decision === "comment" && !body.comment) throw httpError("Yorum alanı boş bırakılamaz.", 400, "REVIEW_COMMENT_REQUIRED");
    const recorded = assertDb(await supabaseAdmin.rpc("maritime_record_reviewer_decision", { p_pass_id: pass.id, p_decision: body.decision, p_comment: body.comment || null }), "İnceleme kararı kaydedilemedi.")?.[0];
    await auditEvent({ request, action: "maripartner.reviewer_decision_created", resourceType: "maritime_reviewer_pass", resourceId: pass.id, metadata: { decision: body.decision }, evidenceTags: ["maripartner", "external_reviewer"] });
    return { ok: true, decision: { id: recorded?.decision_id, decision: body.decision, use_count: recorded?.use_count, pass_status: recorded?.pass_status } };
  });

  app.post("/v1/maritime/reviewer-pass/export", { config: { rateLimit: { max: 5, timeWindow: "5 minutes" } } }, async (request, reply) => {
    const body = reviewerAccessSchema.parse(request.body || {});
    const { pass, job } = await reviewerPassFromCredentials(request, body);
    if (pass.download_allowed !== true) {
      await auditEvent({ request, action: "maripartner.reviewer_pass_download_denied", resourceType: "maritime_reviewer_pass", resourceId: pass.id, severity: "warning", metadata: { reason: "download_not_allowed" }, evidenceTags: ["maripartner", "external_reviewer", "download", "denied"] });
      throw httpError("Bu inceleme geçişinde indirme yetkisi yoktur.", 403, "REVIEW_DOWNLOAD_DENIED");
    }
    const profile = assertDb(await supabaseAdmin.from("maritime_cv_profiles").select("profile_payload").eq("seafarer_user_id", pass.seafarer_user_id).maybeSingle(), "Aday özeti okunamadı.");
    const candidate = projectReviewerCandidate(reviewerCandidateFromProfilePayload(profile?.profile_payload), pass.allowed_fields);
    await auditEvent({ request, action: "maripartner.reviewer_pass_downloaded", resourceType: "maritime_reviewer_pass", resourceId: pass.id, metadata: { partner_id: pass.partner_id, field_count: pass.allowed_fields.length }, evidenceTags: ["maripartner", "external_reviewer", "download"] });
    reply.header("Content-Type", "application/json; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="allonahub-maritime-review-${pass.id.slice(0, 8)}.json"`);
    reply.header("Cache-Control", "no-store");
    return reply.send(JSON.stringify({ purpose: pass.purpose, expires_at: pass.expires_at, job, candidate }, null, 2));
  });

  app.get("/v1/admin/maripartner", async (request) => {
    const { ctx } = await requireAdmin(request, "admin.read");
    const limit = Math.min(200, Math.max(10, Number(request.query?.limit) || 100));
    const [businesses, refreshes, evidence, policies, slas, handovers, passes] = await Promise.all([
      supabaseAdmin.from("partner_businesses").select("id,partner_code,display_name,status,verification_status,created_at").eq("partner_type", "maritime").order("created_at", { ascending: false }).limit(limit),
      supabaseAdmin.from("maritime_talent_refresh_campaigns").select("id,partner_id,title,status,scheduled_at,expires_at,created_at").order("created_at", { ascending: false }).limit(limit),
      supabaseAdmin.from("maritime_evidence_requests").select("id,partner_id,status,purpose,expires_at,created_at").order("created_at", { ascending: false }).limit(limit),
      supabaseAdmin.from("maritime_hiring_sla_policies").select("id,partner_id,stage,target_minutes,active,created_at").eq("active", true).order("created_at", { ascending: false }).limit(limit),
      supabaseAdmin.from("maritime_hiring_sla_instances").select("id,partner_id,hiring_room_id,stage,status,due_at,completed_at,extended_until").order("due_at", { ascending: true }).limit(limit),
      supabaseAdmin.from("maritime_hiring_handovers").select("id,partner_id,hiring_room_id,previous_owner_user_id,new_owner_user_id,reason,created_at").order("created_at", { ascending: false }).limit(limit),
      supabaseAdmin.from("maritime_reviewer_passes").select("id,partner_id,reviewer_name,purpose,status,use_count,max_uses,expires_at,created_at").order("created_at", { ascending: false }).limit(limit)
    ]);
    const slaRows = (assertDb(slas, "SLA kayıtları okunamadı.") || []).map((item) => ({ ...item, status: slaStatus({ dueAt: item.extended_until || item.due_at, completedAt: item.completed_at }) }));
    await logAction(request, ctx, "maripartner.admin_viewed", "maripartner_admin", null, { limit });
    return { ok: true, businesses: assertDb(businesses, "Şirketler okunamadı.") || [], refresh_campaigns: assertDb(refreshes, "Yenilemeler okunamadı.") || [], evidence_requests: assertDb(evidence, "Kanıt talepleri okunamadı.") || [], sla_policies: assertDb(policies, "SLA kuralları okunamadı.") || [], sla_instances: slaRows, handovers: assertDb(handovers, "Devirler okunamadı.") || [], reviewer_passes: (assertDb(passes, "Geçişler okunamadı.") || []).map((item) => ({ ...item, status: reviewerPassState(item) })) };
  });

  app.post("/v1/admin/maripartner/action", async (request) => {
    const body = adminActionSchema.parse(request.body || {});
    const { ctx } = await requireAdmin(request, body.action);
    let result;
    if (body.action === "cancel_refresh") result = await supabaseAdmin.from("maritime_talent_refresh_campaigns").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", body.resource_id).in("status", ["scheduled", "sent"]).select("id,status").maybeSingle();
    if (body.action === "cancel_evidence") result = await supabaseAdmin.from("maritime_evidence_requests").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", body.resource_id).in("status", ["requested", "candidate_action"]).select("id,status,sensitive_access_request_id").maybeSingle();
    if (body.action === "revoke_pass") result = await supabaseAdmin.from("maritime_reviewer_passes").update({ status: "revoked", revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", body.resource_id).eq("status", "active").select("id,status").maybeSingle();
    if (body.action === "deactivate_sla") result = await supabaseAdmin.from("maritime_hiring_sla_policies").update({ active: false, updated_at: new Date().toISOString() }).eq("id", body.resource_id).select("id,active").maybeSingle();
    const row = assertDb(result, "Yönetim işlemi tamamlanamadı.");
    if (!row) throw httpError("Kayıt bulunamadı veya artık değiştirilemez.", 409, "MARIPARTNER_ADMIN_ACTION_CONFLICT");
    if (body.action === "cancel_evidence" && row.sensitive_access_request_id) await supabaseAdmin.from("maritime_sensitive_access_requests").update({ status: "revoked", decided_at: new Date().toISOString() }).eq("id", row.sensitive_access_request_id).in("status", ["requested", "approved", "second_approval_required"]);
    await logAction(request, ctx, `maripartner.admin_${body.action}`, "maripartner_resource", body.resource_id, { reason: body.reason }, "warning");
    return { ok: true, resource: row };
  });
}
