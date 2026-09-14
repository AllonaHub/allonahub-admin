import { z } from "zod";
import { MARITIME_PROFILE_PHOTO_BUCKET } from "../lib/maritime-document-doctor.js";
import {
  MARITIME_SMART_RULE_VERSION,
  buildMaritimeSmartProfile,
  maritimeSmartSnapshotHash,
  matchMaritimeJobs
} from "../lib/maritime-smart-profile.js";
import { ensureMaritimeCustomerProfile } from "../lib/maritime-customer-profile.js";
import { auditEvent, authContext, hasRole, supabaseAdmin } from "../lib/supabase.js";

const runParamsSchema = z.object({ runId: z.string().uuid() }).strict();
const applicationParamsSchema = z.object({ applicationId: z.string().uuid() }).strict();
const confirmationSchema = z.object({ confirmation: z.literal(true) }).strict();
const availabilitySchema = z.object({
  confirmation: z.literal(true),
  work_status: z.enum(["available_now", "available_from_date", "onboard", "on_leave", "not_available"]),
  available_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().default(null)
}).strict().superRefine((value, context) => {
  if (value.work_status === "available_from_date" && !value.available_from) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["available_from"], message: "Başlangıç tarihi gereklidir." });
  }
});
const draftSchema = z.object({
  confirmation: z.literal(true),
  job_ids: z.array(z.string().uuid()).min(1).max(50).refine((values) => new Set(values).size === values.length)
}).strict();

function httpError(message, statusCode = 400, code = "MARITIME_SMART_ACCOUNT_REQUEST_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function assertDb(result, message) {
  if (result.error) {
    const source = `${result.error.message || ""} ${result.error.details || ""}`;
    const statusCode = /required|unavailable|not found|state conflict|not eligible/i.test(source) ? 409 : 503;
    throw httpError(message, statusCode, "MARITIME_SMART_ACCOUNT_DATABASE_ERROR");
  }
  return result.data;
}

async function ownCvIdentity(user) {
  const metadata = user?.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {};
  const raw = String(metadata.avatar_url || metadata.avatar || "").trim();
  const fallbackAvatarUrl = (
    (/^https:\/\//i.test(raw) && raw.length <= 2048)
    || (/^data:image\/(?:png|jpe?g|webp);base64,/i.test(raw) && raw.length <= 2000000)
  ) ? raw : "";
  const signed = await supabaseAdmin.storage
    .from(MARITIME_PROFILE_PHOTO_BUCKET)
    .createSignedUrl(`users/${user?.id}/profile.webp`, 600);
  return { avatar_url: signed.error ? fallbackAvatarUrl : String(signed.data?.signedUrl || fallbackAvatarUrl) };
}

async function requireCustomer(request, action) {
  const ctx = await authContext(request);
  if (!ctx?.user) throw httpError("Oturum doğrulanamadı.", 401, "AUTH_REQUIRED");
  if (!hasRole(ctx.profile, "customer")) {
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.smart_account_access_denied",
      severity: "warning",
      resourceType: "maritime_smart_account",
      metadata: { requested_action: action }
    });
    throw httpError("Bu alan kişisel kullanıcı hesaplarına açıktır. Şirket hesabıyla giriş yaptıysanız kişisel hesabınızla yeniden giriş yapın.", 403, "CUSTOMER_ACCOUNT_REQUIRED");
  }
  return ensureMaritimeCustomerProfile(ctx);
}

async function latestSmartState(userId, user) {
  const runResult = await supabaseAdmin
    .from("maritime_smart_account_runs")
    .select("id,status,rule_version,input_snapshot_hash,smart_snapshot,match_count,eligible_match_count,confirmed_at,created_at,updated_at")
    .eq("seafarer_user_id", userId)
    .in("status", ["draft", "user_confirmed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const run = assertDb(runResult, "Akıllı hesap kaydı okunamadı.") || null;
  if (!run) return { run: null, matches: [], application_drafts: [], cv_identity: await ownCvIdentity(user) };

  const [matchesResult, applicationsResult] = await Promise.all([
    supabaseAdmin
      .from("maritime_match_results")
      .select("id,job_id,hard_gate_status,preference_score,input_snapshot,computed_at,stale_after,metadata")
      .eq("seafarer_user_id", userId)
      .eq("smart_account_run_id", run.id)
      .order("preference_score", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("maritime_hiring_applications")
      .select("id,job_id,status,submitted_at,updated_at,metadata,candidate_consent_snapshot")
      .eq("seafarer_user_id", userId)
      .in("status", ["drafted", "awaiting_candidate_approval", "submitted"])
      .order("created_at", { ascending: false })
      .limit(100)
  ]);
  const now = Date.now();
  const matches = (assertDb(matchesResult, "Akıllı eşleşmeler okunamadı.") || []).map((row) => {
    const staleAt = Date.parse(row.stale_after || "");
    const fresh = Number.isFinite(staleAt) && staleAt > now;
    const publicMatch = { ...(row.input_snapshot || {}) };
    delete publicMatch.partner_id;
    return {
      id: row.id,
      ...publicMatch,
      score: Number(row.preference_score) || Number(row.input_snapshot?.score) || 0,
      hard_gate_status: fresh ? row.hard_gate_status : "stale",
      eligible: fresh && row.hard_gate_status === "passed" && row.metadata?.eligible === true,
      company_contact_visible: false,
      computed_at: row.computed_at,
      stale_after: row.stale_after
    };
  });
  const matchedJobIds = new Set(matches.map((match) => match.job_id));
  const applicationDrafts = (assertDb(applicationsResult, "Başvuru taslakları okunamadı.") || [])
    .filter((application) => matchedJobIds.has(application.job_id))
    .map((application) => ({
      id: application.id,
      job_id: application.job_id,
      status: application.status,
      submitted_at: application.submitted_at,
      updated_at: application.updated_at,
      job_title: application.metadata?.job_title || "",
      job_reference: application.metadata?.job_reference || "",
      company_contact_visible: false,
      final_submission_confirmed: application.candidate_consent_snapshot?.final_submission_confirmed === true
    }));
  return { run, matches, application_drafts: applicationDrafts, cv_identity: await ownCvIdentity(user) };
}

async function verifiedOpenJobs() {
  const jobsResult = await supabaseAdmin
    .from("maritime_jobs")
    .select("id,partner_id,job_reference,status,rank_code,job_title,contract_start,contract_end,hard_gates,preference_weights,structured_requirements,rule_version,job_version,metadata,created_at,updated_at")
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(100);
  const jobs = assertDb(jobsResult, "Açık denizcilik ilanları okunamadı.") || [];
  const partnerIds = [...new Set(jobs.map((job) => job.partner_id).filter(Boolean))];
  if (!partnerIds.length) return [];
  const partnersResult = await supabaseAdmin
    .from("partner_businesses")
    .select("id")
    .in("id", partnerIds)
    .eq("partner_type", "maritime")
    .eq("status", "active")
    .eq("verification_status", "verified");
  const verifiedIds = new Set((assertDb(partnersResult, "Doğrulanmış şirketler okunamadı.") || []).map((partner) => partner.id));
  return jobs.filter((job) => verifiedIds.has(job.partner_id));
}

async function smartInputs(userId) {
  const [profileResult, itemsResult, workspaceResult, documentsResult] = await Promise.all([
    supabaseAdmin
      .from("maritime_cv_profiles")
      .select("profile_status,profile_payload,source_document_ids,completion_percent,last_user_confirmed_at,updated_at")
      .eq("seafarer_user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("maritime_readiness_items")
      .select("id,item_type,source_type,trust_level,verification_status,confidence,source_label,source_reference_hash,value_payload,expires_at,user_confirmed_at,verified_at")
      .eq("seafarer_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(300),
    supabaseAdmin
      .from("maritime_seafarer_workspaces")
      .select("current_work_status,availability_status,availability_confirmed_at,availability_stale_after,metadata")
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("maritime_document_intakes")
      .select("id,status,document_type,confirmed_by_user_at,created_at,updated_at")
      .eq("seafarer_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100)
  ]);
  return {
    cvProfile: assertDb(profileResult, "Denizcilik CV profili okunamadı."),
    readinessItems: assertDb(itemsResult, "Yeterlilik bilgileri okunamadı.") || [],
    workspace: assertDb(workspaceResult, "Denizcilik çalışma alanı okunamadı."),
    documents: assertDb(documentsResult, "Onaylı belgeler okunamadı.") || []
  };
}

async function persistSeafarerClassification(ctx, snapshot) {
  const readiness = snapshot?.readiness || {};
  const profile = snapshot?.profile || {};
  const status = String(readiness.seafarer_status || "not_assessed");
  const now = new Date().toISOString();
  const workspaceResult = await supabaseAdmin
    .from("maritime_seafarer_workspaces")
    .select("metadata")
    .eq("user_id", ctx.user.id)
    .maybeSingle();
  if (workspaceResult.error || !workspaceResult.data) {
    throw httpError("Denizcilik profil durumu kaydedilemedi.", 503, "SEAFARER_CLASSIFICATION_PERSIST_FAILED");
  }
  const currentMetadata = workspaceResult.data.metadata && typeof workspaceResult.data.metadata === "object"
    ? workspaceResult.data.metadata
    : {};
  const existingClassification = currentMetadata.seafarer_classification && typeof currentMetadata.seafarer_classification === "object"
    ? currentMetadata.seafarer_classification
    : {};
  const classification = {
    status,
    system_approved: readiness.seafarer_system_approved === true,
    reason_codes: Array.isArray(readiness.seafarer_reason_codes) ? readiness.seafarer_reason_codes : [],
    evidence: readiness.seafarer_evidence || {},
    source: "confirmed_document_analysis",
    evaluated_at: now,
    approved_at: status === "system_approved" ? existingClassification.approved_at || now : null
  };
  const workspaceUpdate = await supabaseAdmin
    .from("maritime_seafarer_workspaces")
    .update({ metadata: { ...currentMetadata, seafarer_classification: classification } })
    .eq("user_id", ctx.user.id);
  if (workspaceUpdate.error) {
    throw httpError("Denizcilik profil durumu kaydedilemedi.", 503, "SEAFARER_CLASSIFICATION_PERSIST_FAILED");
  }

  const profilePatch = { module: "maritime", updated_at: now };
  if (status === "system_approved") {
    profilePatch.sector_key = "maritime";
    profilePatch.sector_name = "Denizcilik";
    if (profile.canonical_rank) profilePatch.profession_key = String(profile.canonical_rank).slice(0, 90);
    if (profile.rank) profilePatch.profession_name = String(profile.rank).slice(0, 120);
  }
  const profileUpdate = await supabaseAdmin.from("profiles").update(profilePatch).eq("id", ctx.user.id);
  if (profileUpdate.error) {
    throw httpError("Denizcilik profil yönlendirmesi kaydedilemedi.", 503, "MARITIME_PROFILE_ACTIVATION_FAILED");
  }
  return classification;
}

export function registerMaritimeSmartAccountRoutes(app) {
  app.get("/v1/maritime/smart-account", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.smart_account.read");
    return { ok: true, ...(await latestSmartState(ctx.user.id, ctx.user)) };
  });

  app.post("/v1/maritime/smart-account/prepare", {
    config: { rateLimit: { max: 8, timeWindow: "10 minutes" } }
  }, async (request, reply) => {
    const ctx = await requireCustomer(request, "maritime.smart_account.prepare");
    const input = await smartInputs(ctx.user.id);
    if (!input.cvProfile || !input.documents.some((document) => ["user_confirmed", "verification_pending", "verified"].includes(document.status))) {
      throw httpError("Akıllı hesap için önce en az bir belgeyi kontrol edip onaylayın.", 409, "CONFIRMED_DOCUMENT_REQUIRED");
    }
    const jobs = await verifiedOpenJobs();
    const smartSnapshot = buildMaritimeSmartProfile(input);
    const matches = matchMaritimeJobs(smartSnapshot, jobs);
    const inputHash = maritimeSmartSnapshotHash({
      profile: smartSnapshot,
      jobs: jobs.map((job) => ({ id: job.id, job_version: job.job_version, updated_at: job.updated_at }))
    });
    const rpcResult = await supabaseAdmin.rpc("prepare_maritime_smart_account", {
      p_seafarer_user_id: ctx.user.id,
      p_input_snapshot_hash: inputHash,
      p_rule_version: MARITIME_SMART_RULE_VERSION,
      p_smart_snapshot: smartSnapshot,
      p_matches: matches
    });
    const prepared = assertDb(rpcResult, "Akıllı hesap hazırlanamadı.");
    const seafarerClassification = await persistSeafarerClassification(ctx, smartSnapshot);
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.smart_account_prepared",
      resourceType: "maritime_smart_account_run",
      resourceId: prepared?.run_id || null,
      metadata: {
        readiness_score: smartSnapshot.readiness.score,
        match_count: matches.length,
        eligible_match_count: matches.filter((match) => match.eligible).length,
        seafarer_status: seafarerClassification.status,
        rule_version: MARITIME_SMART_RULE_VERSION
      }
    });
    reply.code(prepared?.idempotent ? 200 : 201);
    return { ok: true, ...(await latestSmartState(ctx.user.id, ctx.user)) };
  });

  app.patch("/v1/maritime/smart-account/availability", {
    config: { rateLimit: { max: 12, timeWindow: "10 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.smart_account.availability");
    const input = availabilitySchema.parse(request.body || {});
    const result = assertDb(await ctx.db.rpc("set_maritime_availability", {
      p_work_status: input.work_status,
      p_available_from: input.available_from,
      p_confirmation: true
    }), "Çalışma uygunluğu kaydedilemedi.");
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.availability_confirmed",
      resourceType: "maritime_seafarer_workspace",
      metadata: { work_status: input.work_status, available_from: input.available_from }
    });
    return { ok: true, availability: result };
  });

  app.post("/v1/maritime/smart-account/:runId/confirm", {
    config: { rateLimit: { max: 20, timeWindow: "10 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.smart_account.confirm");
    const { runId } = runParamsSchema.parse(request.params || {});
    confirmationSchema.parse(request.body || {});
    const result = assertDb(await ctx.db.rpc("confirm_maritime_smart_account", {
      p_run_id: runId,
      p_confirmation: true
    }), "Akıllı hesap onaylanamadı.");
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.smart_account_confirmed",
      resourceType: "maritime_smart_account_run",
      resourceId: runId
    });
    return { ok: true, confirmed: result, ...(await latestSmartState(ctx.user.id, ctx.user)) };
  });

  app.post("/v1/maritime/smart-account/:runId/application-drafts", {
    config: { rateLimit: { max: 8, timeWindow: "10 minutes" } }
  }, async (request, reply) => {
    const ctx = await requireCustomer(request, "maritime.smart_account.prepare_application_drafts");
    const { runId } = runParamsSchema.parse(request.params || {});
    const input = draftSchema.parse(request.body || {});
    const result = assertDb(await ctx.db.rpc("create_maritime_application_drafts", {
      p_run_id: runId,
      p_job_ids: input.job_ids,
      p_confirmation: true
    }), "Başvuru taslakları hazırlanamadı.");
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.application_drafts_prepared",
      resourceType: "maritime_smart_account_run",
      resourceId: runId,
      metadata: { selected_job_count: input.job_ids.length, prepared_count: result?.prepared_count || 0 }
    });
    reply.code(201);
    return { ok: true, drafts: result, ...(await latestSmartState(ctx.user.id, ctx.user)) };
  });

  app.post("/v1/maritime/application-drafts/:applicationId/submit", {
    config: { rateLimit: { max: 20, timeWindow: "10 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.application.submit");
    const { applicationId } = applicationParamsSchema.parse(request.params || {});
    confirmationSchema.parse(request.body || {});
    const result = assertDb(await ctx.db.rpc("submit_maritime_application", {
      p_application_id: applicationId,
      p_confirmation: true
    }), "Başvuru gönderilemedi.");
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.application_submitted_by_candidate",
      resourceType: "maritime_hiring_application",
      resourceId: applicationId
    });
    return { ok: true, application: result, ...(await latestSmartState(ctx.user.id, ctx.user)) };
  });
}
