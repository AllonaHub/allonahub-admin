import crypto from "node:crypto";

export const MARIPARTNER_SAFE_REVIEW_FIELDS = Object.freeze([
  "display_name",
  "rank",
  "sea_service_summary",
  "vessel_experience",
  "certificate_status",
  "interview_result",
  "company_notes"
]);

export const MARIPARTNER_REFRESH_QUESTIONS = Object.freeze([
  "availability",
  "available_from",
  "preferred_vessel_type",
  "preferred_contract_length",
  "interest_status",
  "critical_document_change"
]);

export const MARIPARTNER_SLA_STAGES = Object.freeze([
  "shortlist_review",
  "technical_review",
  "manager_decision",
  "offer_preparation",
  "candidate_response",
  "joining_preparation"
]);

export function httpError(message, statusCode = 400, code = "MARIPARTNER_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.exposeCode = true;
  return error;
}

export function sha256(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

export function createReviewerCredentials() {
  const token = crypto.randomBytes(32).toString("base64url");
  const code = String(crypto.randomInt(100000, 1000000));
  return { token, code, tokenHash: sha256(token), codeHash: sha256(code) };
}

export function constantTimeHashEqual(expectedHash, plainValue) {
  const expected = Buffer.from(String(expectedHash || ""), "hex");
  const actual = Buffer.from(sha256(plainValue), "hex");
  return expected.length === actual.length && expected.length > 0 && crypto.timingSafeEqual(expected, actual);
}

export function sanitizeReviewFields(fields) {
  const requested = Array.isArray(fields) ? fields : [];
  return [...new Set(requested.map((item) => String(item || "").trim()).filter((item) => MARIPARTNER_SAFE_REVIEW_FIELDS.includes(item)))];
}

export function sanitizeRefreshQuestions(questions) {
  const requested = Array.isArray(questions) ? questions : [];
  return [...new Set(requested.map((item) => String(item || "").trim()).filter((item) => MARIPARTNER_REFRESH_QUESTIONS.includes(item)))];
}

export function slaStatus({ dueAt, notifyBeforeMinutes = 60, completedAt = null, now = new Date() }) {
  if (completedAt) return "completed";
  const due = new Date(dueAt).getTime();
  const current = new Date(now).getTime();
  if (!Number.isFinite(due)) return "on_time";
  if (current >= due) return "overdue";
  if (due - current <= Math.max(0, Number(notifyBeforeMinutes) || 0) * 60000) return "approaching";
  return "on_time";
}

export function projectReviewerCandidate(candidate, allowedFields) {
  const fields = sanitizeReviewFields(allowedFields);
  return Object.fromEntries(fields.map((field) => [field, candidate?.[field] ?? null]));
}

function cleanReviewText(value, maxLength = 160) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, maxLength) : null;
}

function safeServiceRecord(record) {
  return {
    vessel_name: cleanReviewText(record?.vessel_name),
    imo_number: /^\d{7}$/.test(String(record?.imo_number || "")) ? String(record.imo_number) : null,
    company_name: cleanReviewText(record?.company_name),
    vessel_type: cleanReviewText(record?.vessel_type),
    flag: cleanReviewText(record?.flag),
    gross_tonnage: Number.isFinite(Number(record?.gross_tonnage)) ? Number(record.gross_tonnage) : null,
    deadweight_tonnage: Number.isFinite(Number(record?.deadweight_tonnage)) ? Number(record.deadweight_tonnage) : null,
    rank: cleanReviewText(record?.rank),
    sign_on_date: /^\d{4}-\d{2}-\d{2}$/.test(String(record?.sign_on_date || "")) ? String(record.sign_on_date) : null,
    sign_off_date: /^\d{4}-\d{2}-\d{2}$/.test(String(record?.sign_off_date || "")) ? String(record.sign_off_date) : null
  };
}

export function reviewerCandidateFromProfilePayload(payload, now = new Date()) {
  const source = payload && typeof payload === "object" ? payload : {};
  const seaService = Array.isArray(source.sea_service) ? source.sea_service.slice(0, 50).map(safeServiceRecord) : [];
  const certificates = Array.isArray(source.certificate_records) ? source.certificate_records : [];
  const currentTime = new Date(now).getTime();
  const certificateStatus = certificates.reduce((summary, certificate) => {
    const expiry = certificate?.expiry_date ? new Date(certificate.expiry_date).getTime() : NaN;
    if (!Number.isFinite(expiry)) summary.undated += 1;
    else if (expiry < currentTime) summary.expired += 1;
    else summary.valid += 1;
    return summary;
  }, { total: certificates.length, valid: 0, expired: 0, undated: 0 });
  const composedName = [source.given_names, source.middle_name, source.family_name].map((item) => cleanReviewText(item)).filter(Boolean).join(" ");
  return {
    display_name: cleanReviewText(source.holder_name) || composedName || "Aday",
    rank: cleanReviewText(source.rank) || cleanReviewText(source.suitable_positions?.[0]),
    sea_service_summary: seaService.length ? `${seaService.length} doğrulanabilir deniz hizmeti kaydı` : "Deniz hizmeti kaydı bulunmuyor",
    vessel_experience: seaService,
    certificate_status: certificateStatus,
    interview_result: null,
    company_notes: null
  };
}

export function refreshResponsePayload(input) {
  const responseCode = String(input?.response_code || "").trim();
  if (!["available", "unavailable", "date_changed", "not_interested"].includes(responseCode)) {
    throw httpError("Geçerli bir uygunluk yanıtı seçin.", 400, "INVALID_REFRESH_RESPONSE");
  }
  const availableFrom = input?.available_from ? String(input.available_from) : null;
  if ((responseCode === "available" || responseCode === "date_changed") && !/^\d{4}-\d{2}-\d{2}$/.test(availableFrom || "")) {
    throw httpError("Uygun olduğunuz tarihi seçin.", 400, "AVAILABLE_DATE_REQUIRED");
  }
  return {
    response_code: responseCode,
    available_from: availableFrom,
    response_note: String(input?.response_note || "").trim().slice(0, 500) || null,
    status: "responded",
    responded_at: new Date().toISOString()
  };
}

export function reviewerPassState(pass, now = new Date()) {
  if (!pass || pass.status !== "active") return pass?.status || "closed";
  if (new Date(pass.expires_at).getTime() <= new Date(now).getTime()) return "expired";
  if (Number(pass.use_count || 0) >= Number(pass.max_uses || 1)) return "used";
  return "active";
}
