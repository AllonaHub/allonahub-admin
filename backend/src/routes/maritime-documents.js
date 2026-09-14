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
  maritimeDocumentIdentityConflicts,
  maritimeDocumentExtractionSchema,
  maritimeDocumentSha256,
  maritimeDocumentSignatureMatches,
  maritimeDocumentUploadFilesSchema,
  safeMaritimeDocumentName
} from "../lib/maritime-document-doctor.js";
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
  language: z.enum(["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"]).default("tr")
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

function cleanProfileSeed(value, maxLength = 180) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, maxLength) : null;
}

async function ensureMaritimeCustomerProfile(ctx) {
  if (ctx.profilePersisted) {
    if (String(ctx.profile.account_status || "active").toLowerCase() !== "active") {
      throw httpError("Hesabınız şu anda aktif değil.", 403, "ACCOUNT_NOT_ACTIVE");
    }
    return ctx;
  }

  const metadata = ctx.user.user_metadata || {};
  const nameParts = [metadata.first_name, metadata.last_name].map((value) => cleanProfileSeed(value, 80)).filter(Boolean);
  const fullName = cleanProfileSeed(metadata.full_name || metadata.name || nameParts.join(" "));
  const seed = {
    id: ctx.user.id,
    user_id: ctx.user.id,
    full_name: fullName,
    email: cleanProfileSeed(ctx.user.email, 320),
    phone: cleanProfileSeed(ctx.user.phone, 40),
    role: "customer",
    account_status: "active",
    flagged_suspicious: false
  };
  const inserted = await supabaseAdmin
    .from("profiles")
    .insert(seed)
    .select("id,role,full_name,phone,account_status")
    .maybeSingle();
  if (inserted.error && String(inserted.error.code || "") !== "23505") {
    throw httpError("Denizci profiliniz hazırlanamadı.", 503, "MARITIME_CUSTOMER_PROFILE_RECOVERY_FAILED");
  }

  let profile = inserted.data || null;
  if (!profile) {
    profile = assertDb(await supabaseAdmin
      .from("profiles")
      .select("id,role,full_name,phone,account_status")
      .eq("id", ctx.user.id)
      .maybeSingle(), "Denizci profiliniz doğrulanamadı.");
  }
  if (!profile || !hasRole(profile, "customer")) {
    throw httpError("Bu alan yalnız denizci kullanıcı hesaplarına açıktır.", 403, "CUSTOMER_ACCOUNT_REQUIRED");
  }
  if (String(profile.account_status || "active").toLowerCase() !== "active") {
    throw httpError("Hesabınız şu anda aktif değil.", 403, "ACCOUNT_NOT_ACTIVE");
  }
  ctx.profile = profile;
  ctx.profilePersisted = true;
  return ctx;
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
    throw httpError("Bu alan yalnız denizci kullanıcı hesaplarına açıktır.", 403, "CUSTOMER_ACCOUNT_REQUIRED");
  }
  return ensureMaritimeCustomerProfile(ctx);
}

function retentionDate() {
  const days = Math.max(1, Math.min(Number(config.maritimeDocuments.retentionDays) || 365, 3650));
  return new Date(Date.now() + days * 86400000).toISOString();
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
    .select("id,intake_id,seafarer_user_id,status,extracted_payload,overall_confidence,created_at,updated_at")
    .eq("id", extractionId)
    .eq("seafarer_user_id", userId)
    .maybeSingle();
  const data = assertDb(result, "Belge analiz kaydı okunamadı.");
  if (!data) throw httpError("Belge analiz kaydı bulunamadı.", 404, "MARITIME_EXTRACTION_NOT_FOUND");
  return data;
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
  const [batchesResult, intakesResult, extractionsResult, profileResult] = await Promise.all([
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
      .maybeSingle()
  ]);
  return {
    batches: assertDb(batchesResult, "Belge paketleri okunamadı.") || [],
    documents: assertDb(intakesResult, "Belgeler okunamadı.") || [],
    extractions: assertDb(extractionsResult, "Belge analizleri okunamadı.") || [],
    cv_profile: assertDb(profileResult, "Denizcilik CV profili okunamadı.") || null,
    profile_photo_url: await signedProfilePhoto(userId)
  };
}

export function registerMaritimeDocumentRoutes(app) {
  app.get("/v1/maritime/documents", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.document.list");
    return { ok: true, ...(await documentState(ctx.user.id)) };
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
    if (!config.maritimeDocuments.aiApiKey) {
      throw httpError("Belge okuma hizmeti henüz yapılandırılmadı.", 503, "MARITIME_DOCUMENT_AI_NOT_CONFIGURED");
    }
    const batchId = randomUUID();
    const now = new Date().toISOString();
    const totalSize = input.files.reduce((sum, file) => sum + file.size_bytes, 0);
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

  app.post("/v1/maritime/documents/:intakeId/analyze", {
    config: { rateLimit: { max: 20, timeWindow: "10 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.document.analyze");
    const intakeId = z.string().uuid().parse(request.params?.intakeId);
    const analysisInput = analysisRequestSchema.parse(request.body || {});
    const intake = await ownedIntake(ctx.user.id, intakeId);
    if (["pending_user_confirmation", "user_confirmed", "verification_pending", "verified"].includes(intake.status)) {
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
    if (!["pending_upload", "uploaded", "analysis_failed"].includes(intake.status)) {
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
      .in("status", ["pending_upload", "uploaded", "analysis_failed"])
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
        timeoutMs: config.maritimeDocuments.aiTimeoutMs
      });
      const extractionId = randomUUID();
      const extraction = assertDb(await supabaseAdmin.from("maritime_document_extractions").insert({
        id: extractionId,
        intake_id: intake.id,
        seafarer_user_id: ctx.user.id,
        status: "pending_user_confirmation",
        provider: "openai_responses",
        model_version: config.maritimeDocuments.aiModel,
        extraction_version: MARITIME_DOCUMENT_READER_VERSION,
        extracted_payload: payload,
        overall_confidence: payload.confidence,
        warnings: payload.warnings
      }).select("id,intake_id,status,extracted_payload,overall_confidence,created_at,updated_at").single(), "Belge analiz sonucu kaydedilemedi.");
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
          evidence_count: payload.field_evidence.length
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
    const identityConflicts = maritimeDocumentIdentityConflicts(currentProfile?.profile_payload || {}, confirmedPayload);
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

  app.post("/v1/maritime/document-extractions/:extractionId/reject", {
    config: { rateLimit: { max: 30, timeWindow: "10 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.document.reject");
    const extractionId = z.string().uuid().parse(request.params?.extractionId);
    const input = rejectionSchema.parse(request.body || {});
    const extraction = await ownedExtraction(ctx.user.id, extractionId);
    if (extraction.status === "rejected") return { ok: true, rejected: true, idempotent: true };
    if (extraction.status !== "pending_user_confirmation") {
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
    await refreshBatch(intake.batch_id, ctx.user.id);
    return { ok: true, rejected: true };
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
