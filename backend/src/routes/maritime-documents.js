import { randomUUID } from "node:crypto";
import { z } from "zod";
import { config } from "../config.js";
import {
  MARITIME_DOCUMENT_BUCKET,
  MARITIME_DOCUMENT_MAX_FILE_BYTES,
  MARITIME_DOCUMENT_READER_VERSION,
  MARITIME_PROFILE_PHOTO_BUCKET,
  MARITIME_PROFILE_PHOTO_MAX_BYTES,
  analyzeMaritimeDocument,
  maritimeGlobalPassportReadiness,
  maritimeDocumentIdentityConflicts,
  maritimeDocumentExtractionSchema,
  maritimeDocumentSha256,
  maritimeDocumentSignatureMatches,
  maritimeDocumentUploadFilesSchema,
  safeMaritimeDocumentName
} from "../lib/maritime-document-doctor.js";
import { ensureMaritimeCustomerProfile } from "../lib/maritime-customer-profile.js";
import { auditEvent, authContext, hasRole, supabaseAdmin } from "../lib/supabase.js";

const uploadIntentSchema = z.object({
  files: maritimeDocumentUploadFilesSchema,
  analysis_consent: z.literal(true)
}).strict();

const confirmationSchema = z.object({
  payload: maritimeDocumentExtractionSchema,
  confirmation: z.literal(true)
}).strict();

const rejectionSchema = z.object({
  reason: z.string().trim().max(500).optional()
}).strict();

const analysisRequestSchema = z.object({
  language: z.enum(["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"]).default("tr"),
  force: z.boolean().optional().default(false)
}).strict();
const profilePhotoIntentSchema = z.object({
  mime_type: z.literal("image/webp"),
  size_bytes: z.number().int().min(1).max(MARITIME_PROFILE_PHOTO_MAX_BYTES)
}).strict();
const profilePhotoConfirmationSchema = z.object({
  confirmation: z.literal(true),
  upload_id: z.string().uuid()
}).strict();

function httpError(message, statusCode = 400, code = "MARITIME_DOCUMENT_REQUEST_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function assertDb(result, message) {
  if (result.error) throw httpError(message, 503, "MARITIME_DOCUMENT_DATABASE_ERROR");
  return result.data;
}

async function requireCustomer(request, action) {
  const ctx = await authContext(request);
  if (!ctx?.user) throw httpError("Oturum doğrulanamadı.", 401, "AUTH_REQUIRED");
  if (!hasRole(ctx.profile, "customer")) {
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.document_access_denied",
      severity: "warning",
      resourceType: "maritime_document",
      metadata: { requested_action: action }
    });
    throw httpError("Bu alan kişisel kullanıcı hesaplarına açıktır. Şirket hesabıyla giriş yaptıysanız kişisel hesabınızla yeniden giriş yapın.", 403, "CUSTOMER_ACCOUNT_REQUIRED");
  }
  return ensureMaritimeCustomerProfile(ctx);
}

function retentionDate() {
  const configured = Number(config.maritimeDocuments.retentionDays);
  if (!Number.isFinite(configured) || configured <= 0) return null;
  const days = Math.max(1, Math.min(configured, 3650));
  return new Date(Date.now() + days * 86400000).toISOString();
}

function storageLimits() {
  return {
    max_bytes: Math.max(MARITIME_DOCUMENT_MAX_FILE_BYTES, Number(config.maritimeDocuments.userMaxBytes) || 536870912),
    max_files: Math.max(20, Number(config.maritimeDocuments.userMaxFiles) || 200)
  };
}

async function storageRows(userId) {
  const result = await supabaseAdmin
    .from("maritime_document_intakes")
    .select("id,status,storage_bucket,storage_path,file_size_bytes,file_sha256,mime_type,metadata")
    .eq("seafarer_user_id", userId)
    .range(0, 999);
  return assertDb(result, "Belge depolama kullanımı okunamadı.") || [];
}

function summarizeStorage(rows) {
  const objects = new Map();
  for (const row of rows) {
    const key = `${row.storage_bucket || ""}:${row.storage_path || ""}`;
    if (!row.storage_path || objects.has(key)) continue;
    objects.set(key, Math.max(0, Number(row.file_size_bytes) || 0));
  }
  const limits = storageLimits();
  const usedBytes = [...objects.values()].reduce((sum, size) => sum + size, 0);
  return {
    used_bytes: usedBytes,
    max_bytes: limits.max_bytes,
    remaining_bytes: Math.max(0, limits.max_bytes - usedBytes),
    file_count: rows.length,
    max_files: limits.max_files,
    remaining_files: Math.max(0, limits.max_files - rows.length)
  };
}

async function assertStorageCapacity(userId, incomingFiles, incomingBytes) {
  const usage = summarizeStorage(await storageRows(userId));
  if (usage.file_count + incomingFiles > usage.max_files) {
    throw httpError(`Belge arşivi en fazla ${usage.max_files} kayıt kabul eder. Eski bir belgeyi silip tekrar deneyin.`, 409, "MARITIME_DOCUMENT_FILE_QUOTA_EXCEEDED");
  }
  if (usage.used_bytes + incomingBytes > usage.max_bytes) {
    throw httpError("Belge arşivi depolama sınırına ulaştı. Eski bir belgeyi silip tekrar deneyin.", 409, "MARITIME_DOCUMENT_STORAGE_QUOTA_EXCEEDED");
  }
  return usage;
}

async function matchingStoredDocuments(userId, sha256, mimeType) {
  const result = await supabaseAdmin
    .from("maritime_document_intakes")
    .select("id,status,document_type,storage_bucket,storage_path,original_file_name,mime_type,file_size_bytes,file_sha256,metadata,created_at,updated_at")
    .eq("seafarer_user_id", userId)
    .eq("file_sha256", sha256)
    .eq("mime_type", mimeType)
    .not("status", "in", "(expired,revoked)")
    .order("created_at", { ascending: false })
    .limit(20);
  return assertDb(result, "Aynı belge kaydı denetlenemedi.") || [];
}

function archiveFileName(request) {
  const encoded = String(request.headers["x-allona-file-name"] || "").slice(0, 900);
  let decoded = encoded;
  try {
    decoded = decodeURIComponent(encoded);
  } catch (error) {}
  return safeMaritimeDocumentName(decoded || "maritime-document.pdf");
}

function seaServiceExperienceId(request) {
  return z.string().uuid().parse(String(request.headers["x-allona-maritime-experience-id"] || ""));
}

const SEA_SERVICE_DOCUMENT_SOURCE = "maritime_cv_sea_service";
const PARTNER_DOCUMENT_ACCESS_STATUSES = Object.freeze(["submitted", "shortlisted", "interviewing", "offer_sent", "offer_accepted", "hired"]);

async function seaServiceDocument(intakeId) {
  const result = await supabaseAdmin
    .from("maritime_document_intakes")
    .select("id,seafarer_user_id,status,document_type,storage_bucket,storage_path,original_file_name,mime_type,file_size_bytes,metadata,created_at,updated_at")
    .eq("id", intakeId)
    .maybeSingle();
  const data = assertDb(result, "Hizmet belgesi okunamadı.");
  if(!data || data.document_type !== "sea_service_record" || data.metadata?.source !== SEA_SERVICE_DOCUMENT_SOURCE) {
    throw httpError("Hizmet belgesi bulunamadı.", 404, "MARITIME_SEA_SERVICE_DOCUMENT_NOT_FOUND");
  }
  return data;
}

async function activePartnerIdsForUser(userId) {
  const [ownedResult, staffResult] = await Promise.all([
    supabaseAdmin.from("partner_businesses").select("id").eq("owner_id", userId).eq("status", "active"),
    supabaseAdmin.from("partner_staff").select("partner_id").eq("user_id", userId).eq("status", "active")
  ]);
  const ids = new Set((assertDb(ownedResult, "Şirket yetkisi doğrulanamadı.") || []).map(row => row.id));
  (assertDb(staffResult, "Şirket personel yetkisi doğrulanamadı.") || []).forEach(row => ids.add(row.partner_id));
  if(!ids.size) return [];
  const activeResult = await supabaseAdmin.from("partner_businesses").select("id").in("id", [...ids]).eq("status", "active");
  return (assertDb(activeResult, "Şirket durumu doğrulanamadı.") || []).map(row => row.id);
}

async function seaServiceDocumentAccess(ctx, document) {
  if(ctx.user.id === document.seafarer_user_id) return "owner";
  if(hasRole(ctx.profile, ["admin", "super_admin"])) return "admin";
  if(!hasRole(ctx.profile, "partner")) return "";
  const partnerIds = await activePartnerIdsForUser(ctx.user.id);
  if(!partnerIds.length) return "";
  const applicationResult = await supabaseAdmin
    .from("maritime_hiring_applications")
    .select("id")
    .eq("seafarer_user_id", document.seafarer_user_id)
    .in("partner_id", partnerIds)
    .in("status", PARTNER_DOCUMENT_ACCESS_STATUSES)
    .limit(1);
  return (assertDb(applicationResult, "Başvuru yetkisi doğrulanamadı.") || []).length ? "partner_application" : "";
}

async function ownedIntake(userId, intakeId) {
  const result = await supabaseAdmin
    .from("maritime_document_intakes")
    .select("id,batch_id,seafarer_user_id,status,document_type,storage_bucket,storage_path,original_file_name,mime_type,file_size_bytes,file_sha256,metadata,created_at,updated_at")
    .eq("id", intakeId)
    .eq("seafarer_user_id", userId)
    .maybeSingle();
  const data = assertDb(result, "Belge kaydı okunamadı.");
  if (!data) throw httpError("Belge bulunamadı.", 404, "MARITIME_DOCUMENT_NOT_FOUND");
  return data;
}

async function ownedExtraction(userId, extractionId) {
  const result = await supabaseAdmin
    .from("maritime_document_extractions")
    .select("id,intake_id,seafarer_user_id,status,extracted_payload,user_corrections,confirmed_payload,overall_confidence,created_at,updated_at")
    .eq("id", extractionId)
    .eq("seafarer_user_id", userId)
    .maybeSingle();
  const data = assertDb(result, "Belge analiz kaydı okunamadı.");
  if (!data) throw httpError("Belge analiz kaydı bulunamadı.", 404, "MARITIME_EXTRACTION_NOT_FOUND");
  return data;
}

async function currentCvReferencesDocument(userId, intakeId) {
  const result = await supabaseAdmin
    .from("maritime_cv_profiles")
    .select("profile_payload")
    .eq("seafarer_user_id", userId)
    .maybeSingle();
  const profile = assertDb(result, "Maritime CV belge bağlantıları doğrulanamadı.");
  const rows = profile?.profile_payload?.manual_cv?.seaData;
  return Array.isArray(rows) && rows.some((row) => row?.serviceDocumentId === intakeId);
}

async function sharedStorageReferenceCount(intake) {
  const result = await supabaseAdmin
    .from("maritime_document_intakes")
    .select("id", { count: "exact", head: true })
    .eq("storage_bucket", intake.storage_bucket)
    .eq("storage_path", intake.storage_path)
    .neq("id", intake.id);
  if (result.error) throw httpError("Belge depolama bağlantıları doğrulanamadı.", 503, "MARITIME_DOCUMENT_STORAGE_REFERENCE_ERROR");
  return Number(result.count || 0);
}

async function hasStoredProfilePhoto(userId) {
  const result = await supabaseAdmin.storage
    .from(MARITIME_PROFILE_PHOTO_BUCKET)
    .list(`users/${userId}`, { limit: 20, search: "profile.webp" });
  return !result.error && Array.isArray(result.data) && result.data.some((item) => item?.name === "profile.webp");
}

const PROFILE_ARRAY_KEYS = new Set([
  "suitable_positions", "certificate_codes", "certificate_records", "identity_documents", "education",
  "medical_records", "vaccinations", "endorsements", "restrictions", "sea_service", "languages",
  "emergency_contacts", "references", "field_evidence", "source_languages", "notes", "warnings", "skills", "achievements"
]);
const PROFILE_OBJECT_KEYS = new Set([
  "contact", "physical_profile", "rank_i18n", "nationality_i18n", "professional_summary_i18n",
  "suitable_positions_i18n", "endorsements_i18n", "restrictions_i18n", "ocr_quality"
]);

function payloadPriority(payload) {
  return ({
    unknown: 0,
    other: 5,
    training_certificate: 10,
    stcw_certificate: 15,
    medical_certificate: 20,
    competency_certificate: 30,
    sea_service_record: 35,
    cv: 45,
    visa: 55,
    seafarer_book: 70,
    passport: 100
  })[payload?.document_type] || 0;
}

function mergeUniqueRows(first, second) {
  const seen = new Set();
  return [...(Array.isArray(first) ? first : []), ...(Array.isArray(second) ? second : [])].filter((row) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeConfirmedPayloads(payloads) {
  const merged = {};
  for (const payload of [...payloads].sort((a, b) => payloadPriority(a) - payloadPriority(b))) {
    for (const [key, value] of Object.entries(payload || {})) {
      if (value === null || value === undefined || value === "") continue;
      if (PROFILE_ARRAY_KEYS.has(key)) {
        merged[key] = mergeUniqueRows(merged[key], value);
      } else if (PROFILE_OBJECT_KEYS.has(key) && value && typeof value === "object" && !Array.isArray(value)) {
        merged[key] = { ...(merged[key] || {}), ...Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== "")) };
      } else {
        merged[key] = value;
      }
    }
  }
  return merged;
}

function profileCompletion(payload) {
  let score = 0;
  if (payload?.holder_name) score += 10;
  if (payload?.nationality) score += 10;
  if (payload?.date_of_birth) score += 10;
  if (payload?.rank) score += 15;
  if (payload?.suitable_positions?.length) score += 10;
  if (payload?.certificate_codes?.length || payload?.certificate_records?.length) score += 20;
  if (payload?.sea_service?.length) score += 10;
  if (["fit", "fit_with_restrictions"].includes(payload?.medical_fitness) || payload?.medical_records?.length) score += 10;
  if (payload?.identity_documents?.length) score += 5;
  return Math.min(100, score);
}

async function rebuildConfirmedProfile(userId) {
  const result = await supabaseAdmin
    .from("maritime_document_extractions")
    .select("intake_id,confirmed_payload")
    .eq("seafarer_user_id", userId)
    .eq("status", "confirmed");
  const rows = assertDb(result, "Global CV yeniden oluşturulamadı.") || [];
  const payload = mergeConfirmedPayloads(rows.map((row) => row.confirmed_payload).filter(Boolean));
  assertDb(await supabaseAdmin.from("maritime_cv_profiles").upsert({
    seafarer_user_id: userId,
    profile_status: rows.length ? "user_confirmed" : "draft",
    profile_payload: payload,
    source_document_ids: [...new Set(rows.map((row) => row.intake_id).filter(Boolean))],
    completion_percent: profileCompletion(payload),
    last_user_confirmed_at: rows.length ? new Date().toISOString() : null
  }, { onConflict: "seafarer_user_id" }), "Global CV yeniden oluşturulamadı.");
  return payload;
}

async function updateReadinessSource(userId, intake, payload) {
  const sourceReference = intake.file_sha256 || intake.id;
  const summary = [payload.document_title, payload.document_number, payload.expiry_date].filter(Boolean).join(" · ") || "Kullanıcı tarafından düzeltilmiş denizcilik belgesi";
  assertDb(await supabaseAdmin.from("maritime_readiness_items").update({
    value_payload: payload,
    value_summary: summary,
    user_confirmed_at: new Date().toISOString()
  }).eq("seafarer_user_id", userId).eq("source_reference_hash", sourceReference), "Düzeltilen belge profili güncellenemedi.");
}

async function removeReadinessSource(userId, intake) {
  const sourceReference = intake.file_sha256 || intake.id;
  assertDb(await supabaseAdmin.from("maritime_readiness_items").delete()
    .eq("seafarer_user_id", userId)
    .eq("source_reference_hash", sourceReference), "Belge Global CV kaydından çıkarılamadı.");
}

function profilePhotoPath(userId) {
  return `users/${userId}/profile.webp`;
}

function pendingProfilePhotoPath(userId, uploadId) {
  return `users/${userId}/pending/${uploadId}.webp`;
}

async function signedProfilePhoto(userId) {
  const signed = await supabaseAdmin.storage
    .from(MARITIME_PROFILE_PHOTO_BUCKET)
    .createSignedUrl(profilePhotoPath(userId), 600);
  return signed.error ? "" : String(signed.data?.signedUrl || "");
}

async function refreshBatch(batchId, userId) {
  if (!batchId) return;
  const intakeResult = await supabaseAdmin
    .from("maritime_document_intakes")
    .select("status")
    .eq("batch_id", batchId)
    .eq("seafarer_user_id", userId);
  const rows = assertDb(intakeResult, "Belge paketi güncellenemedi.") || [];
  const statuses = rows.map((row) => row.status);
  let status = "uploading";
  if (statuses.some((item) => ["analyzing", "analysis_queued", "uploaded"].includes(item))) status = "analyzing";
  if (statuses.some((item) => item === "pending_user_confirmation")) status = "review_required";
  if (statuses.length && statuses.every((item) => ["user_confirmed", "verified", "rejected"].includes(item))) {
    status = statuses.every((item) => ["user_confirmed", "verified"].includes(item)) ? "confirmed" : "partially_confirmed";
  }
  if (statuses.length && statuses.every((item) => ["analysis_failed", "quarantined"].includes(item))) status = "failed";
  await supabaseAdmin
    .from("maritime_document_batches")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", batchId)
    .eq("seafarer_user_id", userId);
}

async function documentState(userId) {
  const [batchesResult, intakesResult, extractionsResult, profileResult, allStorageRows] = await Promise.all([
    supabaseAdmin
      .from("maritime_document_batches")
      .select("id,status,file_count,total_size_bytes,confirmed_document_count,created_at,updated_at")
      .eq("seafarer_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabaseAdmin
      .from("maritime_document_intakes")
      .select("id,batch_id,status,document_type,original_file_name,mime_type,file_size_bytes,ocr_confidence,classification_confidence,confirmed_by_user_at,analysis_error,created_at,updated_at")
      .eq("seafarer_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("maritime_document_extractions")
      .select("id,intake_id,status,extracted_payload,overall_confidence,user_corrections,confirmed_payload,confirmed_at,rejected_at,created_at,updated_at")
      .eq("seafarer_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("maritime_cv_profiles")
      .select("profile_payload,completion_percent,last_user_confirmed_at,updated_at")
      .eq("seafarer_user_id", userId)
      .maybeSingle(),
    storageRows(userId)
  ]);
  const profilePhotoReady = await hasStoredProfilePhoto(userId);
  const profilePayload = assertDb(profileResult, "Denizcilik CV profili okunamadı.")?.profile_payload || {};
  const globalCvReadiness = maritimeGlobalPassportReadiness(profilePayload, { hasPhoto: profilePhotoReady });
  return {
    batches: assertDb(batchesResult, "Belge paketleri okunamadı.") || [],
    documents: assertDb(intakesResult, "Belgeler okunamadı.") || [],
    extractions: assertDb(extractionsResult, "Belge analizleri okunamadı.") || [],
    cv_profile: assertDb(profileResult, "Denizcilik CV profili okunamadı.") || null,
    profile_photo_url: profilePhotoReady ? await signedProfilePhoto(userId) : "",
    profile_photo_ready: profilePhotoReady,
    storage_usage: summarizeStorage(allStorageRows),
    global_cv_readiness: globalCvReadiness,
    global_passport_readiness: globalCvReadiness
  };
}

export function registerMaritimeDocumentRoutes(app) {
  app.get("/v1/maritime/documents", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.document.list");
    return { ok: true, ...(await documentState(ctx.user.id)) };
  });

  app.post("/v1/maritime/profile-photo", {
    bodyLimit: MARITIME_PROFILE_PHOTO_MAX_BYTES,
    config: { rateLimit: { max: 10, timeWindow: "10 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.profile_photo.upload");
    const bytes = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
    if (!bytes.length || bytes.length > MARITIME_PROFILE_PHOTO_MAX_BYTES || !maritimeDocumentSignatureMatches(bytes, "image/webp")) {
      throw httpError("Profil fotoğrafı güvenli biçimde doğrulanamadı.", 400, "MARITIME_PHOTO_INVALID");
    }
    const path = profilePhotoPath(ctx.user.id);
    const saved = await supabaseAdmin.storage.from(MARITIME_PROFILE_PHOTO_BUCKET).upload(path, bytes, {
      contentType: "image/webp",
      upsert: true
    });
    if (saved.error) throw httpError("Profil fotoğrafı kaydedilemedi.", 503, "MARITIME_PHOTO_SAVE_FAILED");
    const url = await signedProfilePhoto(ctx.user.id);
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.profile_photo_saved",
      resourceType: "maritime_profile_photo",
      metadata: { bytes: bytes.length, direct_private_upload: true, face_pixels_regenerated: false }
    });
    return { ok: true, profile_photo_url: url };
  });

  app.post("/v1/maritime/profile-photo/upload-intent", {
    config: { rateLimit: { max: 10, timeWindow: "10 minutes" } }
  }, async (request, reply) => {
    const ctx = await requireCustomer(request, "maritime.profile_photo.upload_intent");
    const input = profilePhotoIntentSchema.parse(request.body || {});
    const uploadId = randomUUID();
    const path = pendingProfilePhotoPath(ctx.user.id, uploadId);
    const signed = await supabaseAdmin.storage
      .from(MARITIME_PROFILE_PHOTO_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });
    if (signed.error || !signed.data?.token) {
      throw httpError("Profil fotoğrafı yükleme bağlantısı oluşturulamadı.", 503, "MARITIME_PHOTO_SIGNING_FAILED");
    }
    reply.code(201);
    return {
      ok: true,
      upload: { upload_id: uploadId, bucket: MARITIME_PROFILE_PHOTO_BUCKET, path, token: signed.data.token },
      expected: input
    };
  });

  app.post("/v1/maritime/profile-photo/confirm", {
    config: { rateLimit: { max: 10, timeWindow: "10 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.profile_photo.confirm");
    const input = profilePhotoConfirmationSchema.parse(request.body || {});
    const pendingPath = pendingProfilePhotoPath(ctx.user.id, input.upload_id);
    const path = profilePhotoPath(ctx.user.id);
    const download = await supabaseAdmin.storage.from(MARITIME_PROFILE_PHOTO_BUCKET).download(pendingPath);
    if (download.error || !download.data) throw httpError("Yüklenen profil fotoğrafı bulunamadı.", 409, "MARITIME_PHOTO_UPLOAD_INCOMPLETE");
    const bytes = Buffer.from(await download.data.arrayBuffer());
    if (!bytes.length || bytes.length > MARITIME_PROFILE_PHOTO_MAX_BYTES || !maritimeDocumentSignatureMatches(bytes, "image/webp")) {
      await supabaseAdmin.storage.from(MARITIME_PROFILE_PHOTO_BUCKET).remove([pendingPath]);
      throw httpError("Profil fotoğrafı güvenli biçimde doğrulanamadı.", 400, "MARITIME_PHOTO_INVALID");
    }
    const saved = await supabaseAdmin.storage.from(MARITIME_PROFILE_PHOTO_BUCKET).upload(path, bytes, {
      contentType: "image/webp",
      upsert: true
    });
    if (saved.error) throw httpError("Profil fotoğrafı kaydedilemedi.", 503, "MARITIME_PHOTO_SAVE_FAILED");
    await supabaseAdmin.storage.from(MARITIME_PROFILE_PHOTO_BUCKET).remove([pendingPath]);
    const url = await signedProfilePhoto(ctx.user.id);
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.profile_photo_saved",
      resourceType: "maritime_profile_photo",
      metadata: { bytes: bytes.length, face_pixels_regenerated: false }
    });
    return { ok: true, profile_photo_url: url };
  });

  app.delete("/v1/maritime/profile-photo", {
    config: { rateLimit: { max: 10, timeWindow: "10 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.profile_photo.delete");
    const path = profilePhotoPath(ctx.user.id);
    const removed = await supabaseAdmin.storage.from(MARITIME_PROFILE_PHOTO_BUCKET).remove([path]);
    if (removed.error) throw httpError("Profil fotoğrafı silinemedi.", 503, "MARITIME_PHOTO_DELETE_FAILED");
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.profile_photo_deleted",
      resourceType: "maritime_profile_photo"
    });
    return { ok: true };
  });

  app.post("/v1/maritime/documents/upload-intents", {
    config: { rateLimit: { max: 12, timeWindow: "10 minutes" } }
  }, async (request, reply) => {
    const ctx = await requireCustomer(request, "maritime.document.upload_intent");
    const input = uploadIntentSchema.parse(request.body || {});
    if (!(await hasStoredProfilePhoto(ctx.user.id))) {
      throw httpError("Global CV için önce Maritime CV alanında profil fotoğrafınızı ekleyip kaydedin.", 409, "MARITIME_PROFILE_PHOTO_REQUIRED");
    }
    if (!config.maritimeDocuments.aiApiKey && !config.maritimeDocuments.localReaderEnabled) {
      throw httpError("Belge okuma hizmeti henüz yapılandırılmadı.", 503, "MARITIME_DOCUMENT_AI_NOT_CONFIGURED");
    }
    const batchId = randomUUID();
    const now = new Date().toISOString();
    const totalSize = input.files.reduce((sum, file) => sum + file.size_bytes, 0);
    await assertStorageCapacity(ctx.user.id, input.files.length, totalSize);
    assertDb(await supabaseAdmin.from("maritime_document_batches").insert({
      id: batchId,
      seafarer_user_id: ctx.user.id,
      status: "uploading",
      file_count: input.files.length,
      total_size_bytes: totalSize,
      analysis_consent_at: now,
      metadata: { source: "maritime_documents_ui", analysis_consent: true }
    }), "Belge paketi oluşturulamadı.");

    const records = input.files.map((file) => {
      const intakeId = randomUUID();
      const safeName = safeMaritimeDocumentName(file.name);
      return {
        id: intakeId,
        batch_id: batchId,
        seafarer_user_id: ctx.user.id,
        status: "pending_upload",
        document_type: "unknown",
        storage_bucket: MARITIME_DOCUMENT_BUCKET,
        storage_path: `users/${ctx.user.id}/${batchId}/${intakeId}-${safeName}`,
        original_file_name: file.name,
        mime_type: file.mime_type,
        file_size_bytes: file.size_bytes,
        user_confirmation_required: true,
        retention_until: retentionDate(),
        metadata: {
          client_file_id: file.client_file_id,
          analysis_consent_at: now,
          upload_completed: false
        }
      };
    });
    assertDb(await supabaseAdmin.from("maritime_document_intakes").insert(records), "Belge kayıtları oluşturulamadı.");

    try {
      const uploads = [];
      for (const record of records) {
        const signedResult = await supabaseAdmin.storage
          .from(MARITIME_DOCUMENT_BUCKET)
          .createSignedUploadUrl(record.storage_path, { upsert: false });
        if (signedResult.error || !signedResult.data?.token) throw signedResult.error || new Error("Signed upload token missing");
        uploads.push({
          intake_id: record.id,
          client_file_id: record.metadata.client_file_id,
          bucket: MARITIME_DOCUMENT_BUCKET,
          path: record.storage_path,
          token: signedResult.data.token
        });
      }
      await auditEvent({
        request,
        actorId: ctx.user.id,
        actorRole: ctx.profile.role,
        action: "maritime.document_upload_intents_created",
        resourceType: "maritime_document_batch",
        resourceId: batchId,
        metadata: { file_count: records.length, total_size_bytes: totalSize }
      });
      reply.code(201);
      return { ok: true, batch_id: batchId, uploads };
    } catch (error) {
      await supabaseAdmin.from("maritime_document_batches").update({ status: "failed" }).eq("id", batchId);
      throw httpError("Belge yükleme bağlantıları oluşturulamadı.", 503, "MARITIME_UPLOAD_SIGNING_FAILED");
    }
  });

  app.post("/v1/maritime/documents/archive", {
    bodyLimit: MARITIME_DOCUMENT_MAX_FILE_BYTES,
    config: { rateLimit: { max: 30, timeWindow: "10 minutes" } }
  }, async (request, reply) => {
    const ctx = await requireCustomer(request, "maritime.document.archive");
    const bytes = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
    if (!bytes.length || bytes.length > MARITIME_DOCUMENT_MAX_FILE_BYTES) {
      throw httpError("PDF dosyasının boyutu doğrulanamadı.", 400, "MARITIME_DOCUMENT_INVALID_SIZE");
    }
    if (!maritimeDocumentSignatureMatches(bytes, "application/pdf")) {
      throw httpError("Yüklenen dosya geçerli bir PDF değil.", 400, "MARITIME_DOCUMENT_SIGNATURE_MISMATCH");
    }

    const sha256 = maritimeDocumentSha256(bytes);
    const matches = await matchingStoredDocuments(ctx.user.id, sha256, "application/pdf");
    const idempotent = matches.find((row) => row.metadata?.source === "maritime_documents_archive");
    if (idempotent) {
      reply.code(200);
      return { ok: true, document: idempotent, deduplicated: true, idempotent: true };
    }
    const reusable = matches.find((row) => row.storage_path && row.storage_bucket === MARITIME_DOCUMENT_BUCKET) || null;
    await assertStorageCapacity(ctx.user.id, 1, reusable ? 0 : bytes.length);
    const intakeId = randomUUID();
    const safeName = archiveFileName(request);
    const storagePath = reusable?.storage_path || `users/${ctx.user.id}/archive/${intakeId}-${safeName}`;
    const now = new Date().toISOString();
    if (!reusable) {
      const saved = await supabaseAdmin.storage.from(MARITIME_DOCUMENT_BUCKET).upload(storagePath, bytes, {
        contentType: "application/pdf",
        upsert: false
      });
      if (saved.error) throw httpError("PDF belgesi güvenli arşive kaydedilemedi.", 503, "MARITIME_DOCUMENT_ARCHIVE_FAILED");
    }

    try {
      const document = assertDb(await supabaseAdmin.from("maritime_document_intakes").insert({
        id: intakeId,
        seafarer_user_id: ctx.user.id,
        status: "uploaded",
        document_type: "unknown",
        storage_bucket: MARITIME_DOCUMENT_BUCKET,
        storage_path: storagePath,
        original_file_name: safeName,
        mime_type: "application/pdf",
        file_size_bytes: bytes.length,
        file_sha256: sha256,
        upload_completed_at: now,
        user_confirmation_required: false,
        retention_until: retentionDate(),
        metadata: {
          source: "maritime_documents_archive",
          storage_only: true,
          document_analysis: false,
          deduplicated_storage: Boolean(reusable),
          reused_from_intake_id: reusable?.id || null,
          uploaded_by_user_at: now
        }
      }).select("id,status,original_file_name,mime_type,file_size_bytes,created_at,updated_at").single(), "PDF belge kaydı oluşturulamadı.");
      await auditEvent({
        request,
        actorId: ctx.user.id,
        actorRole: ctx.profile.role,
        action: "maritime.document_archived",
        resourceType: "maritime_document_intake",
        resourceId: intakeId,
        metadata: { file_size_bytes: bytes.length, document_analysis: false }
      });
      reply.code(201);
      return { ok: true, document, deduplicated: Boolean(reusable) };
    } catch (error) {
      if (!reusable) await supabaseAdmin.storage.from(MARITIME_DOCUMENT_BUCKET).remove([storagePath]);
      throw error;
    }
  });

  app.post("/v1/maritime/sea-service-documents", {
    bodyLimit: MARITIME_DOCUMENT_MAX_FILE_BYTES,
    config: { rateLimit: { max: 30, timeWindow: "10 minutes" } }
  }, async (request, reply) => {
    const ctx = await requireCustomer(request, "maritime.sea_service_document.archive");
    const experienceId = seaServiceExperienceId(request);
    const bytes = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
    if(!bytes.length || bytes.length > MARITIME_DOCUMENT_MAX_FILE_BYTES) {
      throw httpError("Hizmet belgesinin boyutu doğrulanamadı.", 400, "MARITIME_SEA_SERVICE_DOCUMENT_INVALID_SIZE");
    }
    if(!maritimeDocumentSignatureMatches(bytes, "application/pdf")) {
      throw httpError("Hizmet belgesi geçerli bir PDF değil.", 400, "MARITIME_SEA_SERVICE_DOCUMENT_SIGNATURE_MISMATCH");
    }
    const sha256 = maritimeDocumentSha256(bytes);
    const matches = await matchingStoredDocuments(ctx.user.id, sha256, "application/pdf");
    const idempotent = matches.find((row) => row.metadata?.source === SEA_SERVICE_DOCUMENT_SOURCE && row.metadata?.experience_id === experienceId);
    if (idempotent) {
      reply.code(200);
      return { ok: true, document: idempotent, deduplicated: true, idempotent: true };
    }
    const reusable = matches.find((row) => row.storage_path && row.storage_bucket === MARITIME_DOCUMENT_BUCKET) || null;
    await assertStorageCapacity(ctx.user.id, 1, reusable ? 0 : bytes.length);
    const intakeId = randomUUID();
    const safeName = archiveFileName(request);
    const storagePath = reusable?.storage_path || `users/${ctx.user.id}/sea-service/${experienceId}/${intakeId}-${safeName}`;
    const now = new Date().toISOString();
    if (!reusable) {
      const saved = await supabaseAdmin.storage.from(MARITIME_DOCUMENT_BUCKET).upload(storagePath, bytes, {
        contentType: "application/pdf",
        upsert: false
      });
      if(saved.error) throw httpError("Hizmet belgesi güvenli arşive kaydedilemedi.", 503, "MARITIME_SEA_SERVICE_DOCUMENT_ARCHIVE_FAILED");
    }
    try {
      const document = assertDb(await supabaseAdmin.from("maritime_document_intakes").insert({
        id: intakeId,
        seafarer_user_id: ctx.user.id,
        status: "user_confirmed",
        document_type: "sea_service_record",
        storage_bucket: MARITIME_DOCUMENT_BUCKET,
        storage_path: storagePath,
        original_file_name: safeName,
        mime_type: "application/pdf",
        file_size_bytes: bytes.length,
        file_sha256: sha256,
        upload_completed_at: now,
        confirmed_by_user_at: now,
        user_confirmation_required: false,
        retention_until: retentionDate(),
        metadata: {
          source: SEA_SERVICE_DOCUMENT_SOURCE,
          experience_id: experienceId,
          storage_only: true,
          document_analysis: false,
          deduplicated_storage: Boolean(reusable),
          reused_from_intake_id: reusable?.id || null,
          uploaded_by_user_at: now
        }
      }).select("id,status,document_type,original_file_name,mime_type,file_size_bytes,created_at,updated_at").single(), "Hizmet belgesi kaydı oluşturulamadı.");
      await auditEvent({
        request,
        actorId: ctx.user.id,
        actorRole: ctx.profile.role,
        action: "maritime.sea_service_document_archived",
        resourceType: "maritime_document_intake",
        resourceId: intakeId,
        metadata: { experience_id: experienceId, file_size_bytes: bytes.length, document_analysis: false }
      });
      reply.code(201);
      return { ok: true, document, deduplicated: Boolean(reusable) };
    } catch(error) {
      if (!reusable) await supabaseAdmin.storage.from(MARITIME_DOCUMENT_BUCKET).remove([storagePath]);
      throw error;
    }
  });

  app.get("/v1/maritime/sea-service-documents/:intakeId/access", {
    config: { rateLimit: { max: 40, timeWindow: "5 minutes" } }
  }, async (request) => {
    const ctx = await authContext(request);
    if(!ctx?.user) throw httpError("Belgeyi görüntülemek için giriş yapın.", 401, "AUTH_REQUIRED");
    const intakeId = z.string().uuid().parse(request.params?.intakeId);
    const document = await seaServiceDocument(intakeId);
    const access = await seaServiceDocumentAccess(ctx, document);
    if(!access) {
      await auditEvent({
        request,
        actorId: ctx.user.id,
        actorRole: ctx.profile.role,
        action: "maritime.sea_service_document_access_denied",
        severity: "warning",
        resourceType: "maritime_document_intake",
        resourceId: document.id
      });
      throw httpError("Bu hizmet belgesini görüntüleme yetkiniz bulunmuyor.", 403, "MARITIME_SEA_SERVICE_DOCUMENT_ACCESS_DENIED");
    }
    const expiresIn = 300;
    const signed = await supabaseAdmin.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, expiresIn);
    if(signed.error || !signed.data?.signedUrl) throw httpError("Hizmet belgesi görüntüleme bağlantısı oluşturulamadı.", 503, "MARITIME_SEA_SERVICE_DOCUMENT_SIGNING_FAILED");
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.sea_service_document_access_granted",
      resourceType: "maritime_document_intake",
      resourceId: document.id,
      metadata: { access, expires_in_seconds: expiresIn }
    });
    return {
      ok: true,
      url: signed.data.signedUrl,
      expires_in_seconds: expiresIn,
      document: { id: document.id, name: document.original_file_name, mime_type: document.mime_type }
    };
  });

  app.post("/v1/maritime/documents/:intakeId/analyze", {
    config: { rateLimit: { max: 20, timeWindow: "10 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.document.analyze");
    const intakeId = z.string().uuid().parse(request.params?.intakeId);
    const analysisInput = analysisRequestSchema.parse(request.body || {});
    const intake = await ownedIntake(ctx.user.id, intakeId);
    const forcedDraftRefresh = analysisInput.force === true && ["pending_user_confirmation", "user_confirmed"].includes(intake.status);
    if (["pending_user_confirmation", "user_confirmed", "verification_pending", "verified"].includes(intake.status) && !forcedDraftRefresh) {
      const existing = await supabaseAdmin
        .from("maritime_document_extractions")
        .select("id,intake_id,status,extracted_payload,overall_confidence,created_at,updated_at")
        .eq("intake_id", intake.id)
        .eq("seafarer_user_id", ctx.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { ok: true, extraction: assertDb(existing, "Belge analizi okunamadı."), idempotent: true };
    }
    if (!["pending_upload", "uploaded", "analysis_failed"].includes(intake.status) && !forcedDraftRefresh) {
      throw httpError("Belge şu anda analiz edilemez.", 409, "MARITIME_DOCUMENT_STATE_CONFLICT");
    }

    const download = await supabaseAdmin.storage.from(intake.storage_bucket).download(intake.storage_path);
    if (download.error || !download.data) throw httpError("Yüklenen belge bulunamadı.", 409, "MARITIME_DOCUMENT_UPLOAD_INCOMPLETE");
    const bytes = Buffer.from(await download.data.arrayBuffer());
    if (!bytes.length || bytes.length > MARITIME_DOCUMENT_MAX_FILE_BYTES) {
      await supabaseAdmin.from("maritime_document_intakes").update({ status: "quarantined", analysis_error: "invalid_file_size" }).eq("id", intake.id);
      await refreshBatch(intake.batch_id, ctx.user.id);
      throw httpError("Belge boyutu doğrulanamadı.", 400, "MARITIME_DOCUMENT_INVALID_SIZE");
    }
    if (!maritimeDocumentSignatureMatches(bytes, intake.mime_type)) {
      await supabaseAdmin.from("maritime_document_intakes").update({ status: "quarantined", analysis_error: "file_signature_mismatch" }).eq("id", intake.id);
      await refreshBatch(intake.batch_id, ctx.user.id);
      throw httpError("Dosya içeriği seçilen belge türüyle uyuşmuyor.", 400, "MARITIME_DOCUMENT_SIGNATURE_MISMATCH");
    }

    const sha256 = maritimeDocumentSha256(bytes);
    const claim = assertDb(await supabaseAdmin.from("maritime_document_intakes").update({
      status: "analyzing",
      file_sha256: sha256,
      file_size_bytes: bytes.length,
      upload_completed_at: new Date().toISOString(),
      analysis_started_at: new Date().toISOString(),
      analysis_error: null,
      metadata: { ...(intake.metadata || {}), upload_completed: true }
    })
      .eq("id", intake.id)
      .eq("seafarer_user_id", ctx.user.id)
      .in("status", ["pending_upload", "uploaded", "analysis_failed", ...(forcedDraftRefresh ? ["pending_user_confirmation", "user_confirmed"] : [])])
      .select("id")
      .maybeSingle(), "Belge analiz için kilitlenemedi.");
    if (!claim) {
      const current = await ownedIntake(ctx.user.id, intake.id);
      if (["pending_user_confirmation", "user_confirmed", "verification_pending", "verified"].includes(current.status)) {
        const existing = await supabaseAdmin
          .from("maritime_document_extractions")
          .select("id,intake_id,status,extracted_payload,overall_confidence,created_at,updated_at")
          .eq("intake_id", intake.id)
          .eq("seafarer_user_id", ctx.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return { ok: true, extraction: assertDb(existing, "Belge analizi okunamadı."), idempotent: true };
      }
      throw httpError("Belge analizi zaten devam ediyor.", 409, "MARITIME_DOCUMENT_ANALYSIS_IN_PROGRESS");
    }

    try {
      const payload = await analyzeMaritimeDocument({
        bytes,
        mimeType: intake.mime_type,
        fileName: intake.original_file_name,
        apiKey: config.maritimeDocuments.aiApiKey,
        apiBaseUrl: config.maritimeDocuments.aiBaseUrl,
        model: config.maritimeDocuments.aiModel,
        outputLanguage: analysisInput.language,
        timeoutMs: config.maritimeDocuments.aiTimeoutMs,
        localReaderEnabled: config.maritimeDocuments.localReaderEnabled
      });
      const existingDraft = forcedDraftRefresh
        ? assertDb(await supabaseAdmin.from("maritime_document_extractions")
          .select("id,status,confirmed_payload")
          .eq("intake_id", intake.id)
          .eq("seafarer_user_id", ctx.user.id)
          .in("status", ["pending_user_confirmation", "confirmed"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(), "Mevcut belge taslağı okunamadı.")
        : null;
      const extractionId = existingDraft?.id || randomUUID();
      const extractionRecord = {
        intake_id: intake.id,
        seafarer_user_id: ctx.user.id,
        status: "pending_user_confirmation",
        provider: config.maritimeDocuments.aiApiKey ? "openai_responses" : "local_ocr",
        model_version: config.maritimeDocuments.aiApiKey ? config.maritimeDocuments.aiModel : `local-reader-v${MARITIME_DOCUMENT_READER_VERSION}`,
        extraction_version: MARITIME_DOCUMENT_READER_VERSION,
        extracted_payload: payload,
        overall_confidence: payload.confidence,
        warnings: payload.warnings,
        user_corrections: null,
        confirmed_at: null,
        rejected_at: null
      };
      if (existingDraft?.status !== "confirmed") extractionRecord.confirmed_payload = null;
      const extractionQuery = existingDraft
        ? supabaseAdmin.from("maritime_document_extractions").update(extractionRecord).eq("id", extractionId).eq("seafarer_user_id", ctx.user.id)
        : supabaseAdmin.from("maritime_document_extractions").insert({ id: extractionId, ...extractionRecord });
      const extraction = assertDb(await extractionQuery.select("id,intake_id,status,extracted_payload,overall_confidence,created_at,updated_at").single(), "Belge analiz sonucu kaydedilemedi.");
      await supabaseAdmin.from("maritime_document_intakes").update({
        status: "pending_user_confirmation",
        document_type: payload.document_type,
        ocr_confidence: payload.confidence,
        classification_confidence: payload.confidence,
        analysis_completed_at: new Date().toISOString()
      }).eq("id", intake.id).eq("seafarer_user_id", ctx.user.id);
      await refreshBatch(intake.batch_id, ctx.user.id);
      await auditEvent({
        request,
        actorId: ctx.user.id,
        actorRole: ctx.profile.role,
        action: "maritime.document_analysis_ready",
        resourceType: "maritime_document_intake",
        resourceId: intake.id,
        metadata: {
          reader_version: MARITIME_DOCUMENT_READER_VERSION,
          document_type: payload.document_type,
          document_country_code: payload.document_country_code,
          template_family: payload.template_family,
          confidence: payload.confidence,
          evidence_count: payload.field_evidence.length,
          reanalysis: forcedDraftRefresh
        }
      });
      return { ok: true, extraction };
    } catch (error) {
      await supabaseAdmin.from("maritime_document_intakes").update({
        status: "analysis_failed",
        analysis_completed_at: new Date().toISOString(),
        analysis_error: String(error?.code || "analysis_failed").slice(0, 120)
      }).eq("id", intake.id).eq("seafarer_user_id", ctx.user.id);
      await refreshBatch(intake.batch_id, ctx.user.id);
      request.log.warn({ code: error?.code || null, intakeId: intake.id }, "Maritime document analysis failed");
      throw httpError("Belge analizi tamamlanamadı. Dosya korundu; daha sonra yeniden deneyebilirsiniz.", 503, "MARITIME_DOCUMENT_ANALYSIS_FAILED");
    }
  });

  app.post("/v1/maritime/document-extractions/:extractionId/confirm", {
    config: { rateLimit: { max: 30, timeWindow: "10 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.document.confirm");
    const extractionId = z.string().uuid().parse(request.params?.extractionId);
    const input = confirmationSchema.parse(request.body || {});
    const extraction = await ownedExtraction(ctx.user.id, extractionId);
    if (extraction.status === "confirmed") {
      return { ok: true, confirmed: { extraction_id: extraction.id, status: "confirmed", idempotent: true } };
    }
    if (extraction.status !== "pending_user_confirmation") {
      throw httpError("Bu analiz artık onaylanamaz.", 409, "MARITIME_EXTRACTION_STATE_CONFLICT");
    }
    const original = maritimeDocumentExtractionSchema.parse(extraction.extracted_payload);
    const confirmedPayload = {
      ...input.payload,
      reader_version: original.reader_version,
      ocr_quality: original.ocr_quality,
      field_evidence: original.field_evidence,
      confidence: original.confidence,
      warnings: original.warnings
    };
    const currentProfileResult = await supabaseAdmin
      .from("maritime_cv_profiles")
      .select("profile_payload")
      .eq("seafarer_user_id", ctx.user.id)
      .maybeSingle();
    const currentProfile = assertDb(currentProfileResult, "Denizcilik CV profili doğrulanamadı.");
    let conflictProfile = currentProfile?.profile_payload || {};
    if (extraction.confirmed_payload) {
      const otherConfirmed = assertDb(await supabaseAdmin
        .from("maritime_document_extractions")
        .select("confirmed_payload")
        .eq("seafarer_user_id", ctx.user.id)
        .eq("status", "confirmed")
        .neq("id", extraction.id), "Mevcut denizcilik kimliği doğrulanamadı.");
      conflictProfile = mergeConfirmedPayloads((otherConfirmed || []).map((row) => row.confirmed_payload).filter(Boolean));
    }
    const identityConflicts = maritimeDocumentIdentityConflicts(conflictProfile, confirmedPayload);
    if (identityConflicts.length) {
      await auditEvent({
        request,
        actorId: ctx.user.id,
        actorRole: ctx.profile.role,
        action: "maritime.document_identity_conflict",
        severity: "warning",
        resourceType: "maritime_document_extraction",
        resourceId: extractionId,
        metadata: { conflicts: identityConflicts }
      });
      throw httpError("Bu belgedeki kişi bilgileri mevcut denizci profiliyle uyuşmuyor.", 409, "MARITIME_DOCUMENT_IDENTITY_CONFLICT");
    }
    const result = await ctx.db.rpc("confirm_maritime_document_extraction", {
      p_extraction_id: extractionId,
      p_confirmed_payload: confirmedPayload
    });
    const confirmed = assertDb(result, "Belge bilgileri onaylanamadı.");
    await rebuildConfirmedProfile(ctx.user.id);
    const intake = await ownedIntake(ctx.user.id, extraction.intake_id);
    await refreshBatch(intake.batch_id, ctx.user.id);
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.document_extraction_confirmed",
      resourceType: "maritime_document_extraction",
      resourceId: extractionId,
      metadata: { reader_version: MARITIME_DOCUMENT_READER_VERSION, document_type: confirmedPayload.document_type }
    });
    return { ok: true, confirmed };
  });

  app.post("/v1/maritime/document-extractions/:extractionId/correct", {
    config: { rateLimit: { max: 30, timeWindow: "10 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.document.correct");
    const extractionId = z.string().uuid().parse(request.params?.extractionId);
    const input = confirmationSchema.parse(request.body || {});
    const extraction = await ownedExtraction(ctx.user.id, extractionId);
    if (extraction.status !== "confirmed") {
      throw httpError("Yalnız onaylanmış bir belge düzeltilebilir.", 409, "MARITIME_EXTRACTION_STATE_CONFLICT");
    }
    const original = maritimeDocumentExtractionSchema.parse(extraction.extracted_payload);
    const correctedPayload = maritimeDocumentExtractionSchema.parse({
      ...input.payload,
      reader_version: original.reader_version,
      ocr_quality: original.ocr_quality,
      field_evidence: original.field_evidence,
      confidence: original.confidence,
      warnings: original.warnings
    });
    assertDb(await supabaseAdmin.from("maritime_document_extractions").update({
      user_corrections: correctedPayload,
      confirmed_payload: correctedPayload,
      confirmed_at: new Date().toISOString()
    }).eq("id", extraction.id).eq("seafarer_user_id", ctx.user.id), "Belge düzeltmeleri kaydedilemedi.");
    const intake = await ownedIntake(ctx.user.id, extraction.intake_id);
    await updateReadinessSource(ctx.user.id, intake, correctedPayload);
    const profilePayload = await rebuildConfirmedProfile(ctx.user.id);
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.document_extraction_corrected",
      resourceType: "maritime_document_extraction",
      resourceId: extraction.id,
      metadata: { document_type: correctedPayload.document_type, user_confirmed: true }
    });
    return { ok: true, corrected: true, profile_payload: profilePayload };
  });

  app.post("/v1/maritime/document-extractions/:extractionId/reject", {
    config: { rateLimit: { max: 30, timeWindow: "10 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.document.reject");
    const extractionId = z.string().uuid().parse(request.params?.extractionId);
    const input = rejectionSchema.parse(request.body || {});
    const extraction = await ownedExtraction(ctx.user.id, extractionId);
    if (extraction.status === "rejected") return { ok: true, rejected: true, idempotent: true };
    if (!["pending_user_confirmation", "confirmed"].includes(extraction.status)) {
      throw httpError("Bu analiz artık reddedilemez.", 409, "MARITIME_EXTRACTION_STATE_CONFLICT");
    }
    const now = new Date().toISOString();
    assertDb(await supabaseAdmin.from("maritime_document_extractions").update({
      status: "rejected",
      rejected_at: now,
      user_corrections: { rejection_reason: input.reason || "user_rejected_extraction" }
    }).eq("id", extraction.id).eq("seafarer_user_id", ctx.user.id), "Belge analizi reddedilemedi.");
    assertDb(await supabaseAdmin.from("maritime_document_intakes").update({ status: "rejected" }).eq("id", extraction.intake_id).eq("seafarer_user_id", ctx.user.id), "Belge durumu güncellenemedi.");
    const intake = await ownedIntake(ctx.user.id, extraction.intake_id);
    if (extraction.status === "confirmed" || extraction.confirmed_payload) {
      await removeReadinessSource(ctx.user.id, intake);
      await rebuildConfirmedProfile(ctx.user.id);
    }
    await refreshBatch(intake.batch_id, ctx.user.id);
    return { ok: true, rejected: true };
  });

  app.delete("/v1/maritime/documents/:intakeId", {
    config: { rateLimit: { max: 20, timeWindow: "10 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.document.delete");
    const intakeId = z.string().uuid().parse(request.params?.intakeId);
    const intake = await ownedIntake(ctx.user.id, intakeId);
    if (await currentCvReferencesDocument(ctx.user.id, intake.id)) {
      throw httpError("Bu hizmet belgesi kayıtlı Maritime CV içinde kullanılıyor. Önce tecrübe kaydını güncelleyin veya kaldırın.", 409, "MARITIME_DOCUMENT_IN_USE");
    }
    const previousStatus = intake.status;
    assertDb(await supabaseAdmin.from("maritime_document_intakes").update({ status: "revoked" }).eq("id", intake.id).eq("seafarer_user_id", ctx.user.id), "Belge silme işlemi başlatılamadı.");
    try {
      const sameHashReferences = intake.file_sha256
        ? await matchingStoredDocuments(ctx.user.id, intake.file_sha256, intake.mime_type)
        : [];
      if ((await sharedStorageReferenceCount(intake)) === 0) {
        const removed = await supabaseAdmin.storage.from(intake.storage_bucket).remove([intake.storage_path]);
        if (removed.error) throw httpError("Belge özel arşivden silinemedi.", 503, "MARITIME_DOCUMENT_STORAGE_DELETE_FAILED");
      }
      if (intake.file_sha256 && sameHashReferences.length === 0) {
        assertDb(await supabaseAdmin.from("maritime_readiness_items").delete()
          .eq("seafarer_user_id", ctx.user.id)
          .eq("source_reference_hash", intake.file_sha256), "Belge profil bağlantısı temizlenemedi.");
      }
      assertDb(await supabaseAdmin.from("maritime_document_intakes").delete()
        .eq("id", intake.id)
        .eq("seafarer_user_id", ctx.user.id), "Belge kaydı silinemedi.");
      await refreshBatch(intake.batch_id, ctx.user.id);
    } catch (error) {
      await supabaseAdmin.from("maritime_document_intakes").update({ status: previousStatus }).eq("id", intake.id).eq("seafarer_user_id", ctx.user.id);
      throw error;
    }
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.document_deleted_by_owner",
      resourceType: "maritime_document_intake",
      resourceId: intake.id,
      metadata: { shared_storage_object_retained: (await sharedStorageReferenceCount(intake)) > 0 }
    });
    return { ok: true, deleted: true };
  });

  app.get("/v1/maritime/documents/:intakeId/download", {
    config: { rateLimit: { max: 30, timeWindow: "5 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.document.download");
    const intakeId = z.string().uuid().parse(request.params?.intakeId);
    const intake = await ownedIntake(ctx.user.id, intakeId);
    if (intake.status === "pending_upload") throw httpError("Belge yüklemesi henüz tamamlanmadı.", 409, "MARITIME_DOCUMENT_UPLOAD_INCOMPLETE");
    const expiresIn = Math.max(30, Math.min(Number(config.maritimeDocuments.signedDownloadExpiresSeconds) || 120, 600));
    const signed = await supabaseAdmin.storage.from(intake.storage_bucket).createSignedUrl(intake.storage_path, expiresIn, { download: intake.original_file_name });
    if (signed.error || !signed.data?.signedUrl) throw httpError("Belge görüntüleme bağlantısı oluşturulamadı.", 503, "MARITIME_DOCUMENT_DOWNLOAD_FAILED");
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.document_download_link_created",
      resourceType: "maritime_document_intake",
      resourceId: intake.id,
      metadata: { expires_in_seconds: expiresIn }
    });
    return { ok: true, url: signed.data.signedUrl, expires_in_seconds: expiresIn };
  });
}
