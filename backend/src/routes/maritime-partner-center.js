import { z } from "zod";
import { config } from "../config.js";
import { auditEvent, authContext, hasMfa, hasRole, supabaseAdmin } from "../lib/supabase.js";
import { isValidImoNumber, normalizeImoNumber } from "../lib/maritime-vessel-provider.js";
import {
  MARIPARTNER_REFERENCE_CATEGORIES,
  MARIPARTNER_REFERENCE_QUESTIONS,
  MARIPARTNER_REFRESH_QUESTIONS,
  MARIPARTNER_SLA_STAGES,
  approvedReferenceSummary,
  constantTimeHashEqual,
  createReviewerCredentials,
  httpError,
  historicalEmploymentMatch,
  normalizeImo,
  projectReviewerCandidate,
  reviewerCandidateFromProfilePayload,
  refreshResponsePayload,
  reviewerPassState,
  sanitizeRefreshQuestions,
  sanitizeReviewFields,
  sha256,
  slaStatus,
  referenceModerationScreen,
  validateEmployerReferencePayload
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
  action: z.enum(["cancel_refresh", "cancel_evidence", "revoke_pass", "deactivate_sla", "reference_approve", "reference_reject", "reference_changes", "reference_second_approve", "vessel_verify", "vessel_reject"]),
  resource_id: uuid,
  reason: z.string().trim().min(6).max(500)
}).strict();
const referenceRatingSchema = z.object({ category_key: z.enum(MARIPARTNER_REFERENCE_CATEGORIES), score: z.number().int().min(1).max(10).nullable().optional(), not_applicable: z.boolean().default(false) }).strict();
const referenceAnswerSchema = z.object({ question_key: z.enum(MARIPARTNER_REFERENCE_QUESTIONS), answer: z.enum(["yes", "no", "unknown"]), note: z.string().trim().max(500).nullable().optional() }).strict();
const employerReferenceSchema = z.object({
  partner_id: uuid,
  match_id: uuid,
  ratings: z.array(referenceRatingSchema).length(MARIPARTNER_REFERENCE_CATEGORIES.length),
  answers: z.array(referenceAnswerSchema).length(MARIPARTNER_REFERENCE_QUESTIONS.length),
  comment: z.string().trim().max(2000).nullable().optional()
}).strict();
const referenceDecisionSchema = z.object({ partner_id: uuid, decision: z.enum(["accept", "reject"]), reason: z.string().trim().min(6).max(500) }).strict();
const referenceSubmitSchema = z.object({ partner_id: uuid }).strict();
const automationPolicySchema = z.object({
  partner_id: uuid,
  seafarer_user_id: uuid,
  mode: z.enum(["off", "prepare_only", "apply_with_consent"]),
  allowed_rank_codes: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  allowed_vessel_types: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  daily_limit: z.number().int().min(0).max(100),
  consent_receipt_id: optionalUuid
}).strict();
const companyVerificationSchema = z.object({ partner_id: uuid, decision: z.enum(["verify", "request_changes", "reject", "revoke"]), verification_level: z.enum(["identity", "registry", "enhanced"]).default("identity"), reason: z.string().trim().min(6).max(1000), expires_at: z.string().datetime().nullable().optional() }).strict();
const recruiterAuthoritySchema = z.object({ partner_id: uuid, user_id: uuid, status: z.enum(["active", "suspended", "revoked"]), authority_scope: z.array(z.enum(["hiring", "employment_reference", "interview", "evidence_request"])).min(1).max(8), expires_at: z.string().datetime().nullable().optional(), reason: z.string().trim().min(6).max(1000) }).strict();
const vesselRelationshipSchema = z.object({ partner_id: uuid, imo_number: z.string().regex(/^\d{7}$/), company_name: z.string().trim().min(2).max(240), relationship_role: z.enum(["owner", "manager", "operator", "crewing_agent", "employer", "authorized_representative"]), valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), verification_status: z.enum(["registry_verified", "admin_verified", "rejected", "revoked"]), reason: z.string().trim().min(6).max(1000) }).strict();
const trustAppealSchema = z.object({ partner_id: uuid, case_id: uuid, reason: z.string().trim().min(12).max(2000) }).strict();
const interviewTemplateSchema = z.object({ partner_id: uuid, template_key: z.string().trim().regex(/^[a-z0-9_]{2,60}$/), title: z.string().trim().min(3).max(160), questions: z.array(z.object({ key: z.string().trim().regex(/^[a-z0-9_]{2,60}$/), label: z.string().trim().min(3).max(300), weight: z.number().min(0).max(100).default(1) }).strict()).min(1).max(50), activate: z.boolean().default(false) }).strict();
const importPreviewSchema = z.object({ partner_id: uuid, rows: z.array(z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))).min(1).max(10000), idempotency_key: z.string().trim().min(12).max(160) }).strict();
const partnerProfileSchema = z.object({
  partner_id: uuid,
  display_name: z.string().trim().min(2).max(160),
  legal_name: z.string().trim().max(180).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  city: z.string().trim().max(90).nullable().optional(),
  country: z.string().trim().max(90).nullable().optional(),
  description: z.string().trim().max(1200).nullable().optional(),
  logo_path: z.string().trim().regex(/^[0-9a-f-]{36}\/company-logo\.webp$/i).nullable().optional()
}).strict();
const partnerLogoIntentSchema = z.object({ partner_id: uuid, mime_type: z.literal("image/webp") }).strict();
const partnerJobSchema = z.object({
  partner_id: uuid,
  client_listing_id: uuid,
  title: z.string().trim().min(2).max(140),
  summary: z.string().trim().min(10).max(360),
  location_label: z.string().trim().max(120).optional().default(""),
  detail_label: z.string().trim().max(120).optional().default(""),
  rank_code: z.string().trim().min(1).max(80),
  required_certificate_codes: z.array(z.string().trim().min(1).max(80)).min(1).max(24),
  minimum_sea_service_days: z.number().int().min(0).max(20000).default(0),
  required_languages: z.array(z.object({ language: z.string().trim().min(2).max(60), level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2", "fluent", "native"]) }).strict()).max(12).default([]),
  medical_required: z.boolean().default(true),
  available_now_required: z.boolean().default(false),
  expires_at: z.string().datetime()
}).strict().superRefine((value, ctx) => {
  const expiry = new Date(value.expires_at).getTime();
  if (!Number.isFinite(expiry) || expiry < Date.now() + 86400000 || expiry > Date.now() + 180 * 86400000) ctx.addIssue({ code: "custom", path: ["expires_at"], message: "İlan bitiş tarihi yarın ile 180 gün sonrası arasında olmalıdır." });
});
const partnerVesselSchema = z.object({
  partner_id: uuid,
  imo_number: z.string().trim().regex(/^\d{7}$/),
  vessel_name: z.string().trim().min(2).max(160),
  vessel_type: z.string().trim().min(2).max(120),
  flag_state: z.string().trim().min(2).max(80),
  relationship_role: z.enum(["owner", "manager", "operator", "crewing_agent", "employer", "authorized_representative"]),
  mmsi: z.string().trim().regex(/^\d{7,9}$/).nullable().optional(),
  call_sign: z.string().trim().max(40).nullable().optional(),
  gross_tonnage: z.number().min(0).max(1000000).nullable().optional(),
  deadweight: z.number().min(0).max(2000000).nullable().optional(),
  year_built: z.number().int().min(1850).max(new Date().getUTCFullYear() + 1).nullable().optional(),
  valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  provider: z.string().trim().max(80).nullable().optional()
}).strict().superRefine((value, ctx) => {
  if (!isValidImoNumber(value.imo_number)) ctx.addIssue({ code: "custom", path: ["imo_number"], message: "Geçerli ve kontrol basamağı doğru bir IMO numarası girin." });
  if (value.valid_from && value.valid_until && value.valid_until < value.valid_from) ctx.addIssue({ code: "custom", path: ["valid_until"], message: "İlişki bitiş tarihi başlangıç tarihinden önce olamaz." });
});

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
    supabaseAdmin.from("partner_businesses").select("id,partner_code,display_name,legal_name,email,phone,country,city,description,logo_url,status,verification_status,partner_type").eq("owner_id", userId).eq("partner_type", "maritime"),
    supabaseAdmin.from("partner_staff").select("partner_id,staff_role,permissions,status,partner_businesses!inner(id,partner_code,display_name,legal_name,email,phone,country,city,description,logo_url,status,verification_status,partner_type)").eq("user_id", userId).eq("status", "active").eq("partner_businesses.partner_type", "maritime")
  ]);
  const memberships = new Map();
  (assertDb(owned, "Şirket sahipliği okunamadı.") || []).forEach((business) => memberships.set(business.id, { business, role: "owner", permissions: { all: true } }));
  (assertDb(staffed, "Şirket personel yetkisi okunamadı.") || []).forEach((row) => {
    const business = row.partner_businesses;
    if (business && !memberships.has(business.id)) memberships.set(business.id, { business, role: row.staff_role, permissions: row.permissions || {} });
  });
  return [...memberships.values()].filter((item) => item.business.status === "active");
}

async function requirePartnerMembership(request, action, partnerId = null, { manager = false } = {}) {
  const ctx = await authContext(request);
  if (!ctx?.user || !hasRole(ctx.profile, "partner") || !hasMfa(ctx)) throw httpError("MariPartner için MFA doğrulamalı denizcilik şirket hesabı gereklidir.", 403, "MARIPARTNER_ACCESS_REQUIRED");
  const memberships = await partnerMemberships(ctx.user.id);
  if (!memberships.length) throw httpError("Bu hesap aktif bir denizcilik şirketine bağlı değildir.", 403, "MARIPARTNER_MEMBERSHIP_REQUIRED");
  const membership = partnerId ? memberships.find((item) => item.business.id === partnerId) : memberships[0];
  if (!membership) throw httpError("Bu şirket üzerinde işlem yetkiniz yoktur.", 403, "MARIPARTNER_TENANT_DENIED");
  if (manager && !["owner", "manager"].includes(membership.role) && membership.permissions?.manage_hiring !== true) throw httpError("Bu işlem şirket yöneticisi yetkisi gerektirir.", 403, "MARIPARTNER_MANAGER_REQUIRED");
  return { ctx, membership, memberships, action };
}

async function requirePartner(request, action, partnerId = null, options = {}) {
  const access = await requirePartnerMembership(request, action, partnerId, options);
  if (access.membership.business.verification_status !== "verified") throw httpError("MariPartner işlemleri için şirket doğrulaması tamamlanmalıdır.", 403, "MARIPARTNER_VERIFICATION_REQUIRED");
  return access;
}

async function partnerVerificationSummary(partnerId, userId, business) {
  const now = new Date().toISOString();
  const [cycleResult, authorityResult] = await Promise.all([
    supabaseAdmin.from("maritime_company_verification_cycles").select("id,status,verification_level,verified_at,expires_at,created_at").eq("partner_id", partnerId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("maritime_recruiter_authorities").select("id,status,authority_scope,approved_at,expires_at").eq("partner_id", partnerId).eq("user_id", userId).maybeSingle()
  ]);
  const cycle = assertDb(cycleResult, "Şirket doğrulama durumu okunamadı.") || null;
  const authority = assertDb(authorityResult, "Temsilci yetkisi okunamadı.") || null;
  const cycleCurrent = cycle?.status === "verified" && (!cycle.expires_at || cycle.expires_at > now);
  const authorityCurrent = authority?.status === "active" && (!authority.expires_at || authority.expires_at > now) && authority.authority_scope?.includes("hiring");
  return {
    company_verified: business.verification_status === "verified",
    company_active: business.status === "active",
    cycle_current: Boolean(cycleCurrent),
    recruiter_authorized: Boolean(authorityCurrent),
    ready_for_hiring: Boolean(business.status === "active" && business.verification_status === "verified" && cycleCurrent && authorityCurrent),
    cycle,
    authority
  };
}

async function requireAdmin(request, action) {
  const ctx = await authContext(request);
  if (!ctx?.user || !hasRole(ctx.profile, ["admin", "super_admin"]) || !hasMfa(ctx)) throw httpError("MariPartner yönetimi için MFA doğrulamalı yönetici yetkisi gerekir.", 403, "MARIPARTNER_ADMIN_REQUIRED");
  return { ctx, action };
}

async function ensureReferenceAuthority(access) {
  if (!config.mariPartner.employerReferencesEnabled) throw httpError("Doğrulanmış işveren referansı özelliği şu anda kapalıdır.", 503, "EMPLOYER_REFERENCES_DISABLED");
  const now = new Date().toISOString();
  const cycle = assertDb(await supabaseAdmin.from("maritime_company_verification_cycles")
    .select("id,status,verification_level,verified_at,expires_at")
    .eq("partner_id", access.membership.business.id).eq("status", "verified")
    .or(`expires_at.is.null,expires_at.gt.${now}`).order("verified_at", { ascending: false }).limit(1).maybeSingle(), "Şirket doğrulama döngüsü okunamadı.");
  if (!cycle) throw httpError("Doğrulanmış işveren referansı için şirket doğrulaması güncel olmalıdır.", 403, "REFERENCE_COMPANY_VERIFICATION_REQUIRED");
  const authority = assertDb(await supabaseAdmin.from("maritime_recruiter_authorities")
    .select("id,status,authority_scope,approved_at,expires_at")
    .eq("partner_id", access.membership.business.id).eq("user_id", access.ctx.user.id).eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${now}`).maybeSingle(), "İşe alım yetkisi okunamadı.");
  if (!authority?.authority_scope?.includes("employment_reference")) throw httpError("Doğrulanmış referans işlemi için yetkili şirket temsilcisi olmalısınız.", 403, "REFERENCE_RECRUITER_AUTHORITY_REQUIRED");
  return { cycle, authority };
}

async function ensureHiringAuthority(access) {
  const verification = await partnerVerificationSummary(access.membership.business.id, access.ctx.user.id, access.membership.business);
  if (!verification.cycle_current) throw httpError("Yeni ilan için şirket doğrulama süresi güncel olmalıdır.", 403, "HIRING_COMPANY_VERIFICATION_REQUIRED");
  if (!verification.recruiter_authorized) throw httpError("Yeni ilan için aktif işe alım temsilcisi yetkisi gereklidir.", 403, "HIRING_RECRUITER_AUTHORITY_REQUIRED");
  return verification;
}

async function referenceMatchesForPartner(partnerId) {
  const [claimsResult, relationshipsResult, persistedResult] = await Promise.all([
    supabaseAdmin.from("maritime_employment_reference_claims").select("id,seafarer_user_id,imo_number,candidate_public_id,candidate_name,vessel_name,source_company_name,rank_name,service_start,service_end,status,created_at").neq("status", "withdrawn").order("created_at", { ascending: false }).limit(500),
    supabaseAdmin.from("maritime_vessel_company_relationships").select("id,partner_id,imo_number,company_name,relationship_role,valid_from,valid_until,verification_status").eq("partner_id", partnerId),
    supabaseAdmin.from("maritime_employer_reference_matches").select("id,claim_id,partner_id,relationship_id,match_level,confidence,reason_codes,status,decided_at,created_at").eq("partner_id", partnerId)
  ]);
  const claims = assertDb(claimsResult, "Deniz hizmeti iddiaları okunamadı.") || [];
  const relationships = (assertDb(relationshipsResult, "Tarihsel gemi yetkileri okunamadı.") || []).filter((item) => !["rejected", "revoked"].includes(item.verification_status));
  const persisted = assertDb(persistedResult, "Referans eşleşmeleri okunamadı.") || [];
  const allowedImos = new Set(relationships.map((item) => normalizeImo(item.imo_number)).filter(Boolean));
  const computed = claims.filter((claim) => allowedImos.has(normalizeImo(claim.imo_number))).map((claim) => {
    const evaluation = historicalEmploymentMatch(claim, relationships);
    const saved = persisted.find((item) => item.claim_id === claim.id);
    return { ...claim, evaluation, match: saved || null };
  });
  return computed;
}

async function writeReferenceAccess({ partnerId, referenceId, userId, action, purpose, metadata = {} }) {
  assertDb(await supabaseAdmin.from("maritime_employer_reference_access_logs").insert({ partner_id: partnerId, reference_id: referenceId, actor_user_id: userId, action, purpose, metadata }), "Referans erişim kaydı oluşturulamadı.");
}

async function notifyPartner(partnerId, notification) {
  const members = await staffRows(partnerId);
  const rows = members.map((member) => ({ partner_id: partnerId, recipient_user_id: member.user_id, ...notification }));
  if (rows.length) assertDb(await supabaseAdmin.from("maritime_partner_notifications").insert(rows), "Şirket bildirimi oluşturulamadı.");
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
  const [jobs, rooms, matches, refreshes, refreshRequests, evidence, templates, policies, slas, handovers, passes, team, vesselsResult, vesselRelationshipsResult] = await Promise.all([
    supabaseAdmin.from("maritime_jobs").select("id,job_reference,job_title,rank_code,status,source_free_text,structured_requirements,submitted_at,created_at,updated_at").eq("partner_id", partnerId).order("created_at", { ascending: false }).limit(80),
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
    staffRows(partnerId),
    supabaseAdmin.from("maritime_vessel_profiles").select("id,imo_number,vessel_name,vessel_type,flag_state,status,verification_status,profile_version,reapproval_required,last_change_summary,metadata,created_at,updated_at").eq("partner_id", partnerId).neq("status", "archived").order("created_at", { ascending: false }).limit(250),
    supabaseAdmin.from("maritime_vessel_company_relationships").select("id,vessel_profile_id,imo_number,relationship_role,valid_from,valid_until,verification_status,created_at,updated_at").eq("partner_id", partnerId).not("verification_status", "in", '(rejected,revoked)').order("created_at", { ascending: false }).limit(500)
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
  const [historicalMatches, referencesResult, authorityResult, notificationsResult, metricsResult] = await Promise.all([
    referenceMatchesForPartner(partnerId),
    supabaseAdmin.from("maritime_employer_references").select("id,match_id,claim_id,status,version_number,average_score,high_impact_negative,requires_second_review,approved_at,created_at,updated_at").eq("partner_id", partnerId).order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.from("maritime_recruiter_authorities").select("id,user_id,status,authority_scope,expires_at").eq("partner_id", partnerId).eq("status", "active"),
    supabaseAdmin.from("maritime_partner_notifications").select("id,notification_type,title,message,resource_type,resource_id,is_read,created_at").eq("partner_id", partnerId).eq("is_read", false).order("created_at", { ascending: false }).limit(50),
    supabaseAdmin.from("maritime_metric_snapshots").select("metric_key,metric_value,period_start,period_end,dimensions").eq("partner_id", partnerId).order("period_end", { ascending: false }).limit(100)
  ]);
  const referenceRows = assertDb(referencesResult, "İşveren referansları okunamadı.") || [];
  const vesselRelationships = assertDb(vesselRelationshipsResult, "Şirket-gemi ilişkileri okunamadı.") || [];
  const vesselRows = (assertDb(vesselsResult, "Gemi kayıtları okunamadı.") || []).map((vessel) => ({
    ...vessel,
    relationship: vesselRelationships.find((relationship) => relationship.vessel_profile_id === vessel.id || relationship.imo_number === vessel.imo_number) || null
  }));
  return {
    jobs: jobRows,
    vessels: vesselRows,
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
    historical_reference_matches: historicalMatches,
    employer_references: referenceRows,
    reference_summary: approvedReferenceSummary(referenceRows),
    recruiter_authorities: assertDb(authorityResult, "İşe alım yetkileri okunamadı.") || [],
    partner_notifications: assertDb(notificationsResult, "Şirket bildirimleri okunamadı.") || [],
    metric_snapshots: assertDb(metricsResult, "Değer ölçümleri okunamadı.") || [],
    live_metrics: [
      { metric_key: "authorized_candidate_count", metric_value: safeRooms.length, explanation: "Aktif ve süresi dolmamış özel aday odaları" },
      { metric_key: "eligible_match_count", metric_value: matchRows.length, explanation: "Güncel hard-gate kurallarını geçen eşleşmeler" },
      { metric_key: "approved_employer_reference_count", metric_value: referenceRows.filter((item) => item.status === "approved").length, explanation: "Moderasyon ve gerekiyorsa ikinci inceleme tamamlanmış referanslar" },
      { metric_key: "overdue_sla_count", metric_value: overdueSteps, explanation: "Sunucu saatine göre hedefi geçmiş açık süreç adımları" }
    ],
    features: {
      employer_references: config.mariPartner.employerReferencesEnabled,
      auto_prepare: config.mariPartner.autoPrepareEnabled,
      auto_apply: config.mariPartner.autoApplyEnabled,
      readonly_data_query: config.mariPartner.readonlyDataQueryEnabled,
      webhooks: config.mariPartner.webhooksEnabled
    },
    team,
    counters: {
      open_jobs: jobRows.filter((item) => item.status === "open").length,
      authorized_candidates: safeRooms.length,
      eligible_matches: matchRows.length,
      overdue_steps: overdueSteps,
      pending_evidence: pendingEvidence,
      pending_refresh: pendingRefresh,
      active_reviewer_passes: passRows.filter((item) => item.status === "active").length,
      pending_reference_matches: historicalMatches.filter((item) => !item.match || item.match.status === "pending").length,
      pending_reference_reviews: referenceRows.filter((item) => ["submitted", "automated_screening", "needs_review"].includes(item.status)).length,
      action_required: pendingRefresh + pendingEvidence + overdueSteps + historicalMatches.filter((item) => !item.match || item.match.status === "pending").length
    }
  };
}

async function logAction(request, ctx, action, resourceType, resourceId, metadata = {}, severity = "info") {
  await auditEvent({ request, actorId: ctx.user.id, actorRole: ctx.profile.role, action, resourceType, resourceId, metadata, severity, evidenceTags: ["maripartner", "maritime_hiring"] });
}

export function registerMaritimePartnerCenterRoutes(app) {
  app.get("/v1/maritime/partner-center", async (request) => {
    const partnerId = request.query?.partner_id ? uuid.parse(request.query.partner_id) : null;
    const access = await requirePartnerMembership(request, "dashboard.read", partnerId);
    const verification = await partnerVerificationSummary(access.membership.business.id, access.ctx.user.id, access.membership.business);
    const base = { ok: true, partner: access.membership.business, memberships: access.memberships.map((item) => ({ ...item.business, role: item.role })), verification };
    if (access.membership.business.verification_status !== "verified") {
      return { ...base, restricted: true, jobs: [], vessels: [], candidate_rooms: [], matches: [], partner_notifications: [], team: [], counters: { open_jobs: 0, authorized_candidates: 0, eligible_matches: 0, overdue_steps: 0, pending_evidence: 0, action_required: 0 } };
    }
    const dashboard = await partnerDashboard(access.membership.business.id);
    return { ...base, restricted: false, ...dashboard };
  });

  app.post("/v1/maritime/partner-center/profile/logo-intent", { config: { rateLimit: { max: 8, timeWindow: "10 minutes" } } }, async (request) => {
    const body = partnerLogoIntentSchema.parse(request.body || {});
    const access = await requirePartnerMembership(request, "profile.logo.create", body.partner_id, { manager: true });
    const path = `${access.membership.business.id}/company-logo.webp`;
    const { data, error } = await supabaseAdmin.storage.from("maritime-partner-logos").createSignedUploadUrl(path, { upsert: true });
    if (error || !data?.token) throw httpError("Şirket logosu için güvenli yükleme alanı hazırlanamadı.", 503, "MARIPARTNER_LOGO_UPLOAD_UNAVAILABLE");
    await logAction(request, access.ctx, "maripartner.logo_upload_intent_created", "partner_business", body.partner_id, { path });
    return { ok: true, bucket: "maritime-partner-logos", path, token: data.token };
  });

  app.patch("/v1/maritime/partner-center/profile", async (request) => {
    const body = partnerProfileSchema.parse(request.body || {});
    const access = await requirePartnerMembership(request, "profile.update", body.partner_id, { manager: true });
    const { partner_id: partnerId, logo_path: logoPath, ...profile } = body;
    if (logoPath !== undefined) {
      const publicUrl = logoPath ? supabaseAdmin.storage.from("maritime-partner-logos").getPublicUrl(logoPath).data.publicUrl : null;
      profile.logo_url = publicUrl ? `${publicUrl}?v=${Date.now()}` : null;
    }
    const business = assertDb(await supabaseAdmin.from("partner_businesses").update(profile).eq("id", partnerId).select("id,partner_code,display_name,legal_name,email,phone,country,city,description,logo_url,status,verification_status,partner_type").single(), "Şirket profili güncellenemedi.");
    await logAction(request, access.ctx, "maripartner.profile_updated", "partner_business", partnerId, { updated_fields: Object.keys(profile) });
    return { ok: true, business };
  });

  app.post("/v1/maritime/partner-center/jobs", { config: { rateLimit: { max: 12, timeWindow: "1 hour" } } }, async (request, reply) => {
    const body = partnerJobSchema.parse(request.body || {});
    const access = await requirePartner(request, "job.create", body.partner_id, { manager: true });
    await ensureHiringAuthority(access);
    const existing = assertDb(await supabaseAdmin.from("maritime_public_listings").select("id,status,title,created_at").eq("partner_user_id", access.ctx.user.id).eq("client_listing_id", body.client_listing_id).maybeSingle(), "İlan tekrar kontrolü yapılamadı.");
    const now = new Date().toISOString();
    const matchingRequirements = {
      rank_code: body.rank_code,
      required_certificate_codes: body.required_certificate_codes,
      minimum_sea_service_days: body.minimum_sea_service_days,
      required_languages: body.required_languages,
      medical_required: body.medical_required,
      available_now_required: body.available_now_required
    };
    const listing = existing || assertDb(await supabaseAdmin.from("maritime_public_listings").insert({
        partner_user_id: access.ctx.user.id,
        client_listing_id: body.client_listing_id,
        module_key: "maritime",
        listing_type: "crew_position",
        status: "pending_review",
        title: body.title,
        summary: body.summary,
        location_label: body.location_label,
        detail_label: body.detail_label,
        matching_requirements: matchingRequirements,
        sort_order: 100,
        published_at: now,
        expires_at: body.expires_at,
        submission_source: "maripartner",
        submitted_at: now
      }).select("id,status,title,summary,location_label,detail_label,matching_requirements,submitted_at,created_at").single(), "İlan kaydı oluşturulamadı.");
    const existingJob = existing ? assertDb(await supabaseAdmin.from("maritime_jobs").select("id,job_reference,job_title,rank_code,status,created_at").eq("public_listing_id", listing.id).eq("partner_id", body.partner_id).maybeSingle(), "İlan eşleştirme kaydı doğrulanamadı.") : null;
    if (existingJob) return reply.code(200).send({ ok: true, duplicate: true, listing, job: existingJob });
    const jobResult = await supabaseAdmin.from("maritime_jobs").insert({
      partner_id: body.partner_id,
      public_listing_id: listing.id,
      created_by: access.ctx.user.id,
      status: "pending_review",
      rank_code: body.rank_code,
      job_title: body.title,
      hard_gates: { required_certificate_codes: body.required_certificate_codes, minimum_sea_service_days: body.minimum_sea_service_days, medical_required: body.medical_required, available_now_required: body.available_now_required, requirements_complete: true },
      structured_requirements: { required_languages: body.required_languages, location_label: body.location_label, contract_label: body.detail_label },
      source_free_text: body.summary,
      submitted_at: now,
      metadata: { source: "maripartner", public_listing_id: listing.id, expires_at: body.expires_at, company_contact_visible: false }
    }).select("id,job_reference,job_title,rank_code,status,created_at").single();
    if (jobResult.error) {
      if (!existing) await supabaseAdmin.from("maritime_public_listings").delete().eq("id", listing.id).eq("partner_user_id", access.ctx.user.id);
      throw httpError("Akıllı eşleştirme ilanı oluşturulamadı.", 500, "MARIPARTNER_JOB_CREATE_FAILED");
    }
    const job = jobResult.data;
    await logAction(request, access.ctx, "maripartner.job_submitted", "maritime_job", job.id, { partner_id: body.partner_id, public_listing_id: listing.id, rank_code: body.rank_code });
    return reply.code(existing ? 200 : 201).send({ ok: true, duplicate: Boolean(existing), listing, job });
  });

  app.post("/v1/maritime/partner-center/vessels", { config: { rateLimit: { max: 20, timeWindow: "1 hour" } } }, async (request, reply) => {
    const body = partnerVesselSchema.parse(request.body || {});
    const access = await requirePartner(request, "vessel.create", body.partner_id, { manager: true });
    const imo = normalizeImoNumber(body.imo_number);
    const now = new Date().toISOString();
    const metadata = {
      mmsi: body.mmsi || null,
      call_sign: body.call_sign || null,
      gross_tonnage: body.gross_tonnage ?? null,
      deadweight: body.deadweight ?? null,
      year_built: body.year_built ?? null,
      source: "maripartner",
      lookup_provider: body.provider || null
    };
    const existingVessel = assertDb(await supabaseAdmin.from("maritime_vessel_profiles")
      .select("id,profile_version,verification_status")
      .eq("partner_id", body.partner_id).eq("imo_number", imo)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(), "Gemi tekrar kontrolü yapılamadı.");
    const vesselValues = {
      partner_id: body.partner_id,
      imo_number: imo,
      vessel_name: body.vessel_name,
      vessel_type: body.vessel_type,
      flag_state: body.flag_state,
      status: "pending_review",
      verification_status: "pending_review",
      reapproval_required: Boolean(existingVessel),
      last_change_summary: existingVessel ? "MariPartner gemi bilgileri güncellendi" : "MariPartner gemi doğrulama talebi",
      metadata,
      updated_at: now,
      ...(existingVessel ? { profile_version: Number(existingVessel.profile_version || 1) + 1 } : {})
    };
    const vessel = existingVessel
      ? assertDb(await supabaseAdmin.from("maritime_vessel_profiles").update(vesselValues).eq("id", existingVessel.id).eq("partner_id", body.partner_id).select("id,imo_number,vessel_name,vessel_type,flag_state,status,verification_status,profile_version,metadata,created_at,updated_at").single(), "Gemi kaydı güncellenemedi.")
      : assertDb(await supabaseAdmin.from("maritime_vessel_profiles").insert(vesselValues).select("id,imo_number,vessel_name,vessel_type,flag_state,status,verification_status,profile_version,metadata,created_at,updated_at").single(), "Gemi kaydı oluşturulamadı.");
    const assertion = assertDb(await supabaseAdmin.from("maritime_evidence_assertions").insert({
      subject_type: "vessel",
      subject_id: vessel.id,
      assertion_key: "company_vessel_relationship",
      asserted_value: { partner_id: body.partner_id, imo_number: imo, relationship_role: body.relationship_role, valid_from: body.valid_from || null, valid_until: body.valid_until || null },
      source_type: "company_attestation",
      verification_status: "pending",
      created_by: access.ctx.user.id
    }).select("id").single(), "Gemi ilişki kanıtı oluşturulamadı.");
    const currentRelationship = assertDb(await supabaseAdmin.from("maritime_vessel_company_relationships")
      .select("id").eq("partner_id", body.partner_id).eq("imo_number", imo).eq("relationship_role", body.relationship_role)
      .not("verification_status", "in", '(rejected,revoked)').order("created_at", { ascending: false }).limit(1).maybeSingle(), "Şirket-gemi ilişkisi kontrol edilemedi.");
    const relationshipValues = {
      partner_id: body.partner_id,
      vessel_profile_id: vessel.id,
      imo_number: imo,
      company_name: access.membership.business.legal_name || access.membership.business.display_name,
      relationship_role: body.relationship_role,
      valid_from: body.valid_from || null,
      valid_until: body.valid_until || null,
      verification_status: "partner_asserted",
      evidence_assertion_id: assertion.id,
      verified_by: null,
      verified_at: null,
      updated_at: now
    };
    const relationship = currentRelationship
      ? assertDb(await supabaseAdmin.from("maritime_vessel_company_relationships").update(relationshipValues).eq("id", currentRelationship.id).eq("partner_id", body.partner_id).select("id,imo_number,relationship_role,verification_status,valid_from,valid_until,created_at,updated_at").single(), "Şirket-gemi ilişkisi güncellenemedi.")
      : assertDb(await supabaseAdmin.from("maritime_vessel_company_relationships").insert(relationshipValues).select("id,imo_number,relationship_role,verification_status,valid_from,valid_until,created_at,updated_at").single(), "Şirket-gemi ilişkisi oluşturulamadı.");
    await logAction(request, access.ctx, "maripartner.vessel_submitted", "maritime_vessel_profile", vessel.id, { partner_id: body.partner_id, imo_number: imo, relationship_role: body.relationship_role, relationship_id: relationship.id, lookup_provider: body.provider || null });
    return reply.code(existingVessel ? 200 : 201).send({ ok: true, duplicate: Boolean(existingVessel), vessel, relationship });
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

  app.post("/v1/maritime/partner-center/reference-matches/:claimId/decision", { config: { rateLimit: { max: 30, timeWindow: "10 minutes" } } }, async (request) => {
    const claimId = uuid.parse(request.params.claimId);
    const body = referenceDecisionSchema.parse(request.body || {});
    const access = await requirePartner(request, "employer_reference.match_decide", body.partner_id, { manager: true });
    await ensureReferenceAuthority(access);
    const candidate = (await referenceMatchesForPartner(body.partner_id)).find((item) => item.id === claimId);
    if (!candidate) throw httpError("Bu şirkete ait tarihsel çalışma eşleşmesi bulunamadı.", 404, "REFERENCE_MATCH_NOT_FOUND");
    if (body.decision === "accept" && !["exact_verified", "strong_match"].includes(candidate.evaluation.level)) throw httpError("Referans vermeden önce tarihsel çalışma ilişkisi güvenilir kanıtla doğrulanmalıdır.", 409, "REFERENCE_RELATIONSHIP_NOT_VERIFIED");
    const now = new Date().toISOString();
    const match = assertDb(await supabaseAdmin.from("maritime_employer_reference_matches").upsert({
      claim_id: claimId,
      partner_id: body.partner_id,
      relationship_id: candidate.evaluation.relationship_id || null,
      match_level: candidate.evaluation.level,
      confidence: candidate.evaluation.confidence,
      reason_codes: candidate.evaluation.reason_codes,
      status: body.decision === "accept" ? "accepted" : "rejected",
      decided_by: access.ctx.user.id,
      decided_at: now,
      updated_at: now
    }, { onConflict: "claim_id,partner_id" }).select("*").single(), "Tarihsel çalışma eşleşmesi kaydedilemedi.");
    await logAction(request, access.ctx, "maripartner.reference_match_decided", "maritime_employer_reference_match", match.id, { partner_id: body.partner_id, decision: body.decision, match_level: match.match_level, reason: body.reason }, body.decision === "reject" ? "warning" : "info");
    return { ok: true, match };
  });

  app.post("/v1/maritime/partner-center/employer-references", { config: { rateLimit: { max: 20, timeWindow: "10 minutes" } } }, async (request, reply) => {
    const body = employerReferenceSchema.parse(request.body || {});
    const access = await requirePartner(request, "employer_reference.create", body.partner_id, { manager: true });
    await ensureReferenceAuthority(access);
    const normalized = validateEmployerReferencePayload(body);
    const match = assertDb(await supabaseAdmin.from("maritime_employer_reference_matches")
      .select("id,claim_id,partner_id,status,match_level,claim:maritime_employment_reference_claims!inner(seafarer_user_id)")
      .eq("id", body.match_id).eq("partner_id", body.partner_id).eq("status", "accepted").in("match_level", ["exact_verified", "strong_match"]).maybeSingle(), "Referans eşleşmesi okunamadı.");
    if (!match) throw httpError("Doğrulanmış tarihsel çalışma ilişkisi olmadan referans oluşturulamaz.", 409, "REFERENCE_VERIFIED_MATCH_REQUIRED");
    const existing = assertDb(await supabaseAdmin.from("maritime_employer_references").select("id,version_number,status").eq("match_id", match.id).order("version_number", { ascending: false }).limit(1).maybeSingle(), "Mevcut referans okunamadı.");
    if (existing && !["withdrawn", "rejected", "superseded", "expired"].includes(existing.status)) throw httpError("Bu çalışma ilişkisi için açık bir referans kaydı zaten var.", 409, "REFERENCE_ALREADY_OPEN");
    const versionNumber = Number(existing?.version_number || 0) + 1;
    const reference = assertDb(await supabaseAdmin.from("maritime_employer_references").insert({
      match_id: match.id,
      claim_id: match.claim_id,
      partner_id: body.partner_id,
      seafarer_user_id: match.claim.seafarer_user_id,
      author_user_id: access.ctx.user.id,
      status: "draft",
      version_number: versionNumber,
      comment: normalized.comment,
      average_score: normalized.average_score,
      high_impact_negative: normalized.high_impact_negative,
      requires_second_review: normalized.high_impact_negative
    }).select("*").single(), "İşveren referansı oluşturulamadı.");
    assertDb(await supabaseAdmin.from("maritime_employer_reference_ratings").insert(normalized.ratings.map((item) => ({ ...item, reference_id: reference.id }))), "Referans puanları kaydedilemedi.");
    assertDb(await supabaseAdmin.from("maritime_employer_reference_answers").insert(normalized.answers.map((item) => ({ ...item, reference_id: reference.id }))), "Referans cevapları kaydedilemedi.");
    const snapshot = { match_id: match.id, ratings: normalized.ratings, answers: normalized.answers, comment: normalized.comment, average_score: normalized.average_score, high_impact_negative: normalized.high_impact_negative };
    assertDb(await supabaseAdmin.from("maritime_employer_reference_versions").insert({ reference_id: reference.id, version_number: versionNumber, snapshot_hash: sha256(JSON.stringify(snapshot)), snapshot, change_reason: existing ? "previous_reference_closed" : "initial_draft", created_by: access.ctx.user.id }), "Referans sürümü kaydedilemedi.");
    await writeReferenceAccess({ partnerId: body.partner_id, referenceId: reference.id, userId: access.ctx.user.id, action: "create", purpose: "verified_employer_reference" });
    await logAction(request, access.ctx, "maripartner.employer_reference_created", "maritime_employer_reference", reference.id, { partner_id: body.partner_id, high_impact_negative: normalized.high_impact_negative });
    return reply.code(201).send({ ok: true, reference });
  });

  app.post("/v1/maritime/partner-center/employer-references/:referenceId/submit", { config: { rateLimit: { max: 20, timeWindow: "10 minutes" } } }, async (request) => {
    const referenceId = uuid.parse(request.params.referenceId);
    const body = referenceSubmitSchema.parse(request.body || {});
    const access = await requirePartner(request, "employer_reference.submit", body.partner_id, { manager: true });
    await ensureReferenceAuthority(access);
    const current = assertDb(await supabaseAdmin.from("maritime_employer_references").select("id,partner_id,status,comment,high_impact_negative").eq("id", referenceId).eq("partner_id", body.partner_id).maybeSingle(), "Referans okunamadı.");
    if (!current || current.status !== "draft") throw httpError("Yalnız taslak referans incelemeye gönderilebilir.", 409, "REFERENCE_NOT_DRAFT");
    const screen = referenceModerationScreen(current);
    const nextStatus = current.high_impact_negative || screen.decision === "needs_review" ? "needs_review" : "automated_screening";
    const reference = assertDb(await supabaseAdmin.from("maritime_employer_references").update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", referenceId).eq("status", "draft").select("id,status,high_impact_negative,requires_second_review").single(), "Referans incelemeye gönderilemedi.");
    assertDb(await supabaseAdmin.from("maritime_employer_reference_moderation").insert({ reference_id: referenceId, stage: "automated_screening", decision: nextStatus === "needs_review" ? "escalated" : "pending", rule_codes: screen.rule_codes, explanation: nextStatus === "needs_review" ? "İnsan incelemesi veya ikinci karar gerekli." : "Otomatik ön kontrol tamamlandı; yönetici kararı bekleniyor." }), "Referans moderasyon kaydı oluşturulamadı.");
    assertDb(await supabaseAdmin.from("admin_notifications").insert({ kind: "maritime_employer_reference", severity: current.high_impact_negative ? "warning" : "info", title: "İşveren referansı inceleme bekliyor", message: "MariPartner üzerinden doğrulanmış işveren referansı gönderildi.", metadata: { reference_id: referenceId, partner_id: body.partner_id, high_impact_negative: current.high_impact_negative } }), "Yönetici bildirimi oluşturulamadı.");
    await writeReferenceAccess({ partnerId: body.partner_id, referenceId, userId: access.ctx.user.id, action: "submit", purpose: "moderation_submission", metadata: { rule_codes: screen.rule_codes } });
    await logAction(request, access.ctx, "maripartner.employer_reference_submitted", "maritime_employer_reference", referenceId, { partner_id: body.partner_id, high_impact_negative: current.high_impact_negative });
    return { ok: true, reference };
  });

  app.post("/v1/maritime/partner-center/employer-references/:referenceId/withdraw", async (request) => {
    const referenceId = uuid.parse(request.params.referenceId);
    const body = referenceSubmitSchema.parse(request.body || {});
    const access = await requirePartner(request, "employer_reference.withdraw", body.partner_id, { manager: true });
    const reference = assertDb(await supabaseAdmin.from("maritime_employer_references").update({ status: "withdrawn", withdrawn_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", referenceId).eq("partner_id", body.partner_id).in("status", ["draft", "submitted", "automated_screening", "needs_review"]).select("id,status").maybeSingle(), "Referans geri çekilemedi.");
    if (!reference) throw httpError("Referans geri çekilemez durumda.", 409, "REFERENCE_WITHDRAW_CONFLICT");
    await writeReferenceAccess({ partnerId: body.partner_id, referenceId, userId: access.ctx.user.id, action: "withdraw", purpose: "author_withdrawal" });
    await logAction(request, access.ctx, "maripartner.employer_reference_withdrawn", "maritime_employer_reference", referenceId, { partner_id: body.partner_id }, "warning");
    return { ok: true, reference };
  });

  app.get("/v1/maritime/partner-center/candidate-rooms/:roomId/employer-reference-summary", async (request) => {
    const roomId = uuid.parse(request.params.roomId);
    const partnerId = uuid.parse(request.query?.partner_id);
    const access = await requirePartner(request, "employer_reference.summary", partnerId);
    await ensureReferenceAuthority(access);
    const room = await candidateRoom(partnerId, roomId);
    const references = assertDb(await supabaseAdmin.from("maritime_employer_references").select("id,average_score,approved_at,status").eq("seafarer_user_id", room.seafarer_user_id).eq("status", "approved").order("approved_at", { ascending: false }), "Onaylı referans özeti okunamadı.") || [];
    for (const reference of references) await writeReferenceAccess({ partnerId, referenceId: reference.id, userId: access.ctx.user.id, action: "view_summary", purpose: "active_hiring_relationship", metadata: { candidate_room_id: room.id } });
    return { ok: true, summary: approvedReferenceSummary(references) };
  });

  app.post("/v1/maritime/partner-center/trust-appeals", { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } }, async (request, reply) => {
    const body = trustAppealSchema.parse(request.body || {});
    const access = await requirePartner(request, "trust_appeal.create", body.partner_id, { manager: true });
    const trustCase = assertDb(await supabaseAdmin.from("maritime_trust_cases").select("id,partner_id,status").eq("id", body.case_id).eq("partner_id", body.partner_id).maybeSingle(), "Güven vakası okunamadı.");
    if (!trustCase) throw httpError("Bu şirkete ait itiraz edilebilir güven vakası bulunamadı.", 404, "TRUST_CASE_NOT_FOUND");
    const appeal = assertDb(await supabaseAdmin.from("maritime_trust_appeals").insert({ case_id: trustCase.id, appellant_user_id: access.ctx.user.id, appellant_partner_id: body.partner_id, reason: body.reason }).select("id,case_id,status,created_at").single(), "İtiraz kaydedilemedi.");
    assertDb(await supabaseAdmin.from("maritime_trust_case_events").insert({ case_id: trustCase.id, event_type: "appeal_submitted", from_status: trustCase.status, to_status: trustCase.status, actor_user_id: access.ctx.user.id, reason: body.reason }), "İtiraz geçmişi kaydedilemedi.");
    await logAction(request, access.ctx, "maripartner.trust_appeal_submitted", "maritime_trust_appeal", appeal.id, { partner_id: body.partner_id, case_id: trustCase.id }, "warning");
    return reply.code(201).send({ ok: true, appeal });
  });

  app.post("/v1/maritime/partner-center/interview-templates", async (request, reply) => {
    const body = interviewTemplateSchema.parse(request.body || {});
    const access = await requirePartner(request, "interview_template.create", body.partner_id, { manager: true });
    const previous = assertDb(await supabaseAdmin.from("maritime_interview_template_versions").select("version_number").eq("partner_id", body.partner_id).eq("template_key", body.template_key).order("version_number", { ascending: false }).limit(1).maybeSingle(), "Görüşme şablonu sürümü okunamadı.");
    const versionNumber = Number(previous?.version_number || 0) + 1;
    if (body.activate) assertDb(await supabaseAdmin.from("maritime_interview_template_versions").update({ status: "retired" }).eq("partner_id", body.partner_id).eq("template_key", body.template_key).eq("status", "active"), "Önceki görüşme şablonu kapatılamadı.");
    const template = assertDb(await supabaseAdmin.from("maritime_interview_template_versions").insert({ partner_id: body.partner_id, template_key: body.template_key, version_number: versionNumber, title: body.title, questions: body.questions, status: body.activate ? "active" : "draft", created_by: access.ctx.user.id }).select("*").single(), "Görüşme şablonu oluşturulamadı.");
    await logAction(request, access.ctx, "maripartner.interview_template_version_created", "maritime_interview_template_version", template.id, { partner_id: body.partner_id, template_key: body.template_key, version_number: versionNumber });
    return reply.code(201).send({ ok: true, template });
  });

  app.post("/v1/maritime/partner-center/imports/preview", { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } }, async (request, reply) => {
    const body = importPreviewSchema.parse(request.body || {});
    const access = await requirePartner(request, "import.preview", body.partner_id, { manager: true });
    if (body.rows.length > config.mariPartner.maxImportRows) throw httpError(`Bir içe aktarma önizlemesinde en fazla ${config.mariPartner.maxImportRows} satır kullanılabilir.`, 400, "IMPORT_ROW_LIMIT");
    const allowedKeys = new Set(["candidate_public_id", "job_reference", "rank_code", "vessel_type", "available_from", "note"]);
    const rejected = [];
    body.rows.forEach((row, index) => {
      const extra = Object.keys(row).filter((key) => !allowedKeys.has(key));
      if (extra.length || (!row.candidate_public_id && !row.job_reference)) rejected.push({ row: index + 1, reason_codes: [...(extra.length ? ["UNSUPPORTED_COLUMNS"] : []), ...(!row.candidate_public_id && !row.job_reference ? ["IDENTIFIER_REQUIRED"] : [])] });
    });
    const report = { accepted_count: body.rows.length - rejected.length, rejected_count: rejected.length, rejected_rows: rejected.slice(0, 100), source_hash: sha256(JSON.stringify(body.rows)) };
    const job = assertDb(await supabaseAdmin.from("maritime_import_jobs").upsert({ partner_id: body.partner_id, status: rejected.length ? "preview" : "validated", row_count: body.rows.length, accepted_count: report.accepted_count, rejected_count: report.rejected_count, validation_report: report, idempotency_key: body.idempotency_key, created_by: access.ctx.user.id }, { onConflict: "idempotency_key" }).select("id,status,row_count,accepted_count,rejected_count,validation_report,created_at").single(), "İçe aktarma önizlemesi kaydedilemedi.");
    await logAction(request, access.ctx, "maripartner.import_preview_created", "maritime_import_job", job.id, { partner_id: body.partner_id, row_count: body.rows.length, rejected_count: rejected.length });
    return reply.code(201).send({ ok: true, import_job: job });
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
    const [businesses, refreshes, evidence, policies, slas, handovers, passes, references, referenceMatches, disputes, companyCycles, recruiterAuthorities, trustAppeals, vesselRelationships] = await Promise.all([
      supabaseAdmin.from("partner_businesses").select("id,owner_id,partner_code,display_name,status,verification_status,created_at").eq("partner_type", "maritime").order("created_at", { ascending: false }).limit(limit),
      supabaseAdmin.from("maritime_talent_refresh_campaigns").select("id,partner_id,title,status,scheduled_at,expires_at,created_at").order("created_at", { ascending: false }).limit(limit),
      supabaseAdmin.from("maritime_evidence_requests").select("id,partner_id,status,purpose,expires_at,created_at").order("created_at", { ascending: false }).limit(limit),
      supabaseAdmin.from("maritime_hiring_sla_policies").select("id,partner_id,stage,target_minutes,active,created_at").eq("active", true).order("created_at", { ascending: false }).limit(limit),
      supabaseAdmin.from("maritime_hiring_sla_instances").select("id,partner_id,hiring_room_id,stage,status,due_at,completed_at,extended_until").order("due_at", { ascending: true }).limit(limit),
      supabaseAdmin.from("maritime_hiring_handovers").select("id,partner_id,hiring_room_id,previous_owner_user_id,new_owner_user_id,reason,created_at").order("created_at", { ascending: false }).limit(limit),
      supabaseAdmin.from("maritime_reviewer_passes").select("id,partner_id,reviewer_name,purpose,status,use_count,max_uses,expires_at,created_at").order("created_at", { ascending: false }).limit(limit),
      supabaseAdmin.from("maritime_employer_references").select("id,partner_id,claim_id,status,version_number,average_score,high_impact_negative,requires_second_review,first_reviewed_by,second_reviewed_by,comment,created_at,updated_at").in("status", ["submitted", "automated_screening", "needs_review"]).order("created_at", { ascending: true }).limit(limit),
      supabaseAdmin.from("maritime_employer_reference_matches").select("id,claim_id,partner_id,match_level,confidence,reason_codes,status,decided_at,created_at").order("created_at", { ascending: false }).limit(limit),
      supabaseAdmin.from("maritime_employer_reference_disputes").select("id,reference_id,opened_by_partner_id,reason,status,resolution,created_at,updated_at").in("status", ["open", "triage", "awaiting_evidence"]).order("created_at", { ascending: true }).limit(limit),
      supabaseAdmin.from("maritime_company_verification_cycles").select("id,partner_id,status,verification_level,verified_at,expires_at,created_at").order("created_at", { ascending: false }).limit(limit),
      supabaseAdmin.from("maritime_recruiter_authorities").select("id,partner_id,user_id,status,authority_scope,approved_at,expires_at,created_at").order("created_at", { ascending: false }).limit(limit),
      supabaseAdmin.from("maritime_trust_appeals").select("id,case_id,appellant_partner_id,status,reason,reviewer_user_id,second_reviewer_user_id,created_at").in("status", ["submitted", "triage", "in_review"]).order("created_at", { ascending: true }).limit(limit),
      supabaseAdmin.from("maritime_vessel_company_relationships").select("id,partner_id,vessel_profile_id,imo_number,company_name,relationship_role,valid_from,valid_until,verification_status,evidence_assertion_id,created_at,updated_at,vessel:maritime_vessel_profiles(vessel_name,vessel_type,flag_state,metadata)").in("verification_status", ["partner_asserted", "disputed"]).order("created_at", { ascending: true }).limit(limit)
    ]);
    const slaRows = (assertDb(slas, "SLA kayıtları okunamadı.") || []).map((item) => ({ ...item, status: slaStatus({ dueAt: item.extended_until || item.due_at, completedAt: item.completed_at }) }));
    await logAction(request, ctx, "maripartner.admin_viewed", "maripartner_admin", null, { limit });
    return { ok: true, businesses: assertDb(businesses, "Şirketler okunamadı.") || [], refresh_campaigns: assertDb(refreshes, "Yenilemeler okunamadı.") || [], evidence_requests: assertDb(evidence, "Kanıt talepleri okunamadı.") || [], sla_policies: assertDb(policies, "SLA kuralları okunamadı.") || [], sla_instances: slaRows, handovers: assertDb(handovers, "Devirler okunamadı.") || [], reviewer_passes: (assertDb(passes, "Geçişler okunamadı.") || []).map((item) => ({ ...item, status: reviewerPassState(item) })), employer_references: assertDb(references, "İşveren referansları okunamadı.") || [], reference_matches: assertDb(referenceMatches, "Referans eşleşmeleri okunamadı.") || [], reference_disputes: assertDb(disputes, "Referans itirazları okunamadı.") || [], company_verification_cycles: assertDb(companyCycles, "Şirket doğrulamaları okunamadı.") || [], recruiter_authorities: assertDb(recruiterAuthorities, "Temsilci yetkileri okunamadı.") || [], trust_appeals: assertDb(trustAppeals, "Güven itirazları okunamadı.") || [], vessel_relationships: assertDb(vesselRelationships, "Gemi doğrulama kuyruğu okunamadı.") || [] };
  });

  app.post("/v1/admin/maripartner/action", async (request) => {
    const body = adminActionSchema.parse(request.body || {});
    const { ctx } = await requireAdmin(request, body.action);
    let result;
    if (body.action === "cancel_refresh") result = await supabaseAdmin.from("maritime_talent_refresh_campaigns").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", body.resource_id).in("status", ["scheduled", "sent"]).select("id,status").maybeSingle();
    if (body.action === "cancel_evidence") result = await supabaseAdmin.from("maritime_evidence_requests").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", body.resource_id).in("status", ["requested", "candidate_action"]).select("id,status,sensitive_access_request_id").maybeSingle();
    if (body.action === "revoke_pass") result = await supabaseAdmin.from("maritime_reviewer_passes").update({ status: "revoked", revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", body.resource_id).eq("status", "active").select("id,status").maybeSingle();
    if (body.action === "deactivate_sla") result = await supabaseAdmin.from("maritime_hiring_sla_policies").update({ active: false, updated_at: new Date().toISOString() }).eq("id", body.resource_id).select("id,active").maybeSingle();
    if (["vessel_verify", "vessel_reject"].includes(body.action)) {
      const current = assertDb(await supabaseAdmin.from("maritime_vessel_company_relationships").select("id,partner_id,vessel_profile_id,evidence_assertion_id,verification_status").eq("id", body.resource_id).maybeSingle(), "Gemi doğrulama kaydı okunamadı.");
      if (!current || !["partner_asserted", "disputed"].includes(current.verification_status)) throw httpError("Gemi doğrulama kaydı artık işlem beklemiyor.", 409, "VESSEL_VERIFICATION_CONFLICT");
      const approved = body.action === "vessel_verify";
      const now = new Date().toISOString();
      result = await supabaseAdmin.from("maritime_vessel_company_relationships").update({ verification_status: approved ? "admin_verified" : "rejected", verified_by: ctx.user.id, verified_at: approved ? now : null, updated_at: now }).eq("id", current.id).in("verification_status", ["partner_asserted", "disputed"]).select("id,partner_id,vessel_profile_id,imo_number,relationship_role,verification_status,verified_at").maybeSingle();
      const updatedRelationship = assertDb(result, "Gemi ilişkisi doğrulama kararı kaydedilemedi.");
      if (!updatedRelationship) throw httpError("Gemi doğrulama kararı başka bir işlemle değişti.", 409, "VESSEL_VERIFICATION_CONFLICT");
      if (current.vessel_profile_id) assertDb(await supabaseAdmin.from("maritime_vessel_profiles").update({ status: approved ? "verified" : "changes_requested", verification_status: approved ? "verified" : "rejected", verified_at: approved ? now : null, reapproval_required: false, last_change_summary: body.reason, updated_at: now }).eq("id", current.vessel_profile_id).eq("partner_id", current.partner_id), "Gemi profilinin doğrulama durumu güncellenemedi.");
      if (current.evidence_assertion_id) assertDb(await supabaseAdmin.from("maritime_evidence_assertions").update({ verification_status: approved ? "verified" : "rejected", confidence: approved ? 100 : 0, updated_at: now }).eq("id", current.evidence_assertion_id), "Gemi ilişki kanıtı güncellenemedi.");
      await notifyPartner(current.partner_id, { notification_type: "vessel_verification_decision", title: approved ? "Gemi kaydı doğrulandı" : "Gemi kaydı için düzeltme gerekiyor", message: approved ? "Şirket-gemi ilişkiniz yönetim tarafından doğrulandı." : "Şirket-gemi ilişkiniz doğrulanamadı. Ayrıntılar için destek ekibiyle iletişime geçin.", resource_type: "maritime_vessel_profile", resource_id: current.vessel_profile_id, metadata: { decision: approved ? "verified" : "rejected" } });
      result = { data: updatedRelationship, error: null };
    }
    if (["reference_approve", "reference_reject", "reference_changes", "reference_second_approve"].includes(body.action)) {
      const current = assertDb(await supabaseAdmin.from("maritime_employer_references").select("id,partner_id,status,high_impact_negative,requires_second_review,first_reviewed_by,second_reviewed_by").eq("id", body.resource_id).maybeSingle(), "Referans inceleme kaydı okunamadı.");
      if (!current || !["submitted", "automated_screening", "needs_review"].includes(current.status)) throw httpError("Referans artık moderasyon kuyruğunda değil.", 409, "REFERENCE_MODERATION_CONFLICT");
      const now = new Date().toISOString();
      let update;
      let stage = "first_review";
      let decision = "pending";
      if (body.action === "reference_reject") { update = { status: "rejected", rejected_at: now, first_reviewed_by: current.first_reviewed_by || ctx.user.id, first_reviewed_at: now }; decision = "rejected"; }
      if (body.action === "reference_changes") { update = { status: "needs_review", first_reviewed_by: current.first_reviewed_by || ctx.user.id, first_reviewed_at: now }; decision = "needs_changes"; }
      if (body.action === "reference_approve" && current.high_impact_negative) { update = { status: "needs_review", requires_second_review: true, first_reviewed_by: ctx.user.id, first_reviewed_at: now }; decision = "escalated"; }
      if (body.action === "reference_approve" && !current.high_impact_negative) { update = { status: "approved", first_reviewed_by: ctx.user.id, first_reviewed_at: now, approved_at: now }; decision = "approved"; }
      if (body.action === "reference_second_approve") {
        if (!current.high_impact_negative || !current.first_reviewed_by) throw httpError("Bu referans için ikinci inceleme gerekmiyor.", 409, "REFERENCE_SECOND_REVIEW_NOT_REQUIRED");
        if (current.first_reviewed_by === ctx.user.id) throw httpError("İkinci incelemeyi farklı bir yönetici yapmalıdır.", 403, "REFERENCE_SECOND_REVIEWER_MUST_DIFFER");
        update = { status: "approved", second_reviewed_by: ctx.user.id, second_reviewed_at: now, approved_at: now };
        stage = "second_review";
        decision = "approved";
      }
      result = await supabaseAdmin.from("maritime_employer_references").update({ ...update, updated_at: now }).eq("id", body.resource_id).select("id,partner_id,status,high_impact_negative,requires_second_review,first_reviewed_by,second_reviewed_by,approved_at").maybeSingle();
      const updated = assertDb(result, "Referans moderasyon kararı kaydedilemedi.");
      if (!updated) throw httpError("Referans moderasyon kararı çakıştı.", 409, "REFERENCE_MODERATION_CONFLICT");
      assertDb(await supabaseAdmin.from("maritime_employer_reference_moderation").insert({ reference_id: current.id, stage, decision, explanation: body.reason, reviewer_user_id: ctx.user.id }), "Referans moderasyon geçmişi kaydedilemedi.");
      await notifyPartner(current.partner_id, { notification_type: "employer_reference_decision", title: "İşveren referansı güncellendi", message: decision === "approved" ? "Referans onaylandı." : decision === "rejected" ? "Referans reddedildi." : "Referans için ek inceleme gerekiyor.", resource_type: "maritime_employer_reference", resource_id: current.id, metadata: { decision } });
      result = { data: updated, error: null };
    }
    const row = assertDb(result, "Yönetim işlemi tamamlanamadı.");
    if (!row) throw httpError("Kayıt bulunamadı veya artık değiştirilemez.", 409, "MARIPARTNER_ADMIN_ACTION_CONFLICT");
    if (body.action === "cancel_evidence" && row.sensitive_access_request_id) await supabaseAdmin.from("maritime_sensitive_access_requests").update({ status: "revoked", decided_at: new Date().toISOString() }).eq("id", row.sensitive_access_request_id).in("status", ["requested", "approved", "second_approval_required"]);
    await logAction(request, ctx, `maripartner.admin_${body.action}`, "maripartner_resource", body.resource_id, { reason: body.reason }, "warning");
    return { ok: true, resource: row };
  });

  app.post("/v1/admin/maripartner/company-verification", async (request) => {
    const body = companyVerificationSchema.parse(request.body || {});
    const { ctx } = await requireAdmin(request, "company_verification.decide");
    const now = new Date().toISOString();
    const status = body.decision === "verify" ? "verified" : body.decision === "request_changes" ? "changes_requested" : body.decision === "revoke" ? "revoked" : "rejected";
    if (body.decision === "verify" && body.expires_at) assertFutureWindow(body.expires_at, { maxDays: 730, code: "COMPANY_VERIFICATION_EXPIRY_INVALID" });
    const cycle = assertDb(await supabaseAdmin.from("maritime_company_verification_cycles").insert({ partner_id: body.partner_id, status, verification_level: body.verification_level, evidence_snapshot: { decision_reason: body.reason }, verified_by: ctx.user.id, verified_at: body.decision === "verify" ? now : null, expires_at: body.decision === "verify" ? body.expires_at || new Date(Date.now() + 365 * 86400000).toISOString() : null }).select("*").single(), "Şirket doğrulama kararı kaydedilemedi.");
    await logAction(request, ctx, "maripartner.company_verification_decided", "maritime_company_verification_cycle", cycle.id, { partner_id: body.partner_id, status, reason: body.reason }, status === "verified" ? "info" : "warning");
    return { ok: true, verification: cycle };
  });

  app.post("/v1/admin/maripartner/recruiter-authority", async (request) => {
    const body = recruiterAuthoritySchema.parse(request.body || {});
    const { ctx } = await requireAdmin(request, "recruiter_authority.decide");
    const now = new Date().toISOString();
    const authority = assertDb(await supabaseAdmin.from("maritime_recruiter_authorities").upsert({ partner_id: body.partner_id, user_id: body.user_id, status: body.status, authority_scope: body.authority_scope, approved_by: ctx.user.id, approved_at: body.status === "active" ? now : null, expires_at: body.expires_at || null, updated_at: now }, { onConflict: "partner_id,user_id" }).select("*").single(), "Şirket temsilcisi yetkisi kaydedilemedi.");
    await logAction(request, ctx, "maripartner.recruiter_authority_decided", "maritime_recruiter_authority", authority.id, { partner_id: body.partner_id, user_id: body.user_id, status: body.status, reason: body.reason }, body.status === "active" ? "info" : "warning");
    return { ok: true, authority };
  });

  app.post("/v1/admin/maripartner/vessel-company-relationships", async (request, reply) => {
    const body = vesselRelationshipSchema.parse(request.body || {});
    const { ctx } = await requireAdmin(request, "vessel_company_relationship.create");
    if (body.valid_from && body.valid_until && body.valid_until < body.valid_from) throw httpError("İlişki bitiş tarihi başlangıçtan önce olamaz.", 400, "VESSEL_RELATIONSHIP_DATE_INVALID");
    const { reason, ...relationshipInput } = body;
    const relationship = assertDb(await supabaseAdmin.from("maritime_vessel_company_relationships").insert({ ...relationshipInput, verified_by: ctx.user.id, verified_at: ["registry_verified", "admin_verified"].includes(body.verification_status) ? new Date().toISOString() : null }).select("*").single(), "Tarihsel gemi-şirket ilişkisi kaydedilemedi.");
    await logAction(request, ctx, "maripartner.vessel_company_relationship_created", "maritime_vessel_company_relationship", relationship.id, { partner_id: body.partner_id, imo_number: body.imo_number, verification_status: body.verification_status, reason });
    return reply.code(201).send({ ok: true, relationship });
  });
}
