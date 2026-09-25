import { z } from "zod";
import { MARITIME_PROFILE_PHOTO_BUCKET, maritimeGlobalPassportReadiness } from "../lib/maritime-document-doctor.js";
import {
  MARITIME_SMART_RULE_VERSION,
  buildMaritimeSmartProfile,
  canonicalRank,
  maritimeSmartSnapshotHash,
  matchMaritimeJobs
} from "../lib/maritime-smart-profile.js";
import { ensureMaritimeCustomerProfile } from "../lib/maritime-customer-profile.js";
import { requireMaritimePasskeyProof } from "../lib/maritime-passkey.js";
import { queueMaritimeReferenceNotification } from "../lib/maritime-reference-notifications.js";
import { dateRangesOverlap } from "../lib/maritime-partner-center.js";
import { isValidImoNumber, lookupVesselByImo, normalizeImoNumber } from "../lib/maritime-vessel-provider.js";
import { auditEvent, authContext, hasMfa, hasRole, supabaseAdmin } from "../lib/supabase.js";

const runParamsSchema = z.object({ runId: z.string().uuid() }).strict();
const applicationParamsSchema = z.object({ applicationId: z.string().uuid() }).strict();
const manualApplicationSchema = z.object({ job_id: z.string().uuid(), share_documents: z.literal(true) }).strict();
const confirmationSchema = z.object({ confirmation: z.literal(true) }).strict();
const autoApplyPreferenceSchema = z.object({
  enabled: z.boolean(),
  confirmation: z.literal(true)
}).strict();
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
const manualCvFieldKeys = new Set([
  "position", "familyName", "firstName", "fatherName", "birth", "birthDate", "birthPlace", "nationality", "gender", "marital", "address", "airport",
  "height", "weight", "eyes", "hair", "shoes", "overall", "mobile", "email", "kinName", "kinPhone", "kinRelation", "kinAddress",
  "passportDoc", "passportNo", "passportCountry", "passportPlace", "passportIssued", "passportValid", "windows", "office", "internet",
  "seamanBookNo", "seamanBookPlace", "seamanBookIssued", "seamanBookValid", "seafarerIdNo", "seafarerIdPlace", "seafarerIdIssued", "seafarerIdValid",
  "schoolName", "schoolPlace", "schoolGrade", "schoolFrom", "schoolTo", "azSpeak", "azRead", "azWrite", "trSpeak", "trRead", "trWrite",
  "enSpeak", "enRead", "enWrite", "ruSpeak", "ruRead", "ruWrite", "medicalDoc", "medicalFitness", "medicalGrade", "medicalPlace", "medicalIssue", "medicalExpiry",
  "tradeSpecialty", "competencyClass", "competencyCountry", "competencyCertificate", "competencyIssued", "competencyExpires", "competencyLimit", "note"
]);
const manualCvRowKeys = {
  additional: new Set(["name", "institute", "place", "issue", "cert", "expiry"]),
  stcw: new Set(["presetId", "code", "name", "institute", "place", "issue", "rank", "cert", "number", "expiry", "unlimited", "included"]),
  sea: new Set([
    "imo", "vessel", "company", "type", "flag", "dwt", "grt", "netTonnage", "buildYear", "mmsi", "callSign", "lengthOverall",
    "rank", "signon", "signoff", "referenceName", "referenceCompanyEmail", "referenceCompanyPhone", "referencePhone", "lookupProvider", "lookupFetchedAt",
    "vesselPhotoUrl", "vesselPhotoSourceUrl", "vesselPhotoCredit",
    "rowId", "serviceDocumentId", "serviceDocumentName", "serviceDocumentSize", "serviceDocumentStatus", "saved"
  ])
};
function trustedVesselPhotoUrl(value, source = false) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:") return false;
    if (source) return url.hostname === "www.vesselfinder.com" && /^\/vessels\/details\/\d{7}$/i.test(url.pathname);
    return url.hostname === "static.vesselfinder.net" && /^\/ship-photo\/\d{7}-/i.test(url.pathname);
  } catch (error) {
    return false;
  }
}
function restrictedStringRecord(allowedKeys, maxLength) {
  return z.record(z.string().max(maxLength)).superRefine((value, context) => {
    for (const key of Object.keys(value)) {
      if (!allowedKeys.has(key)) context.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: "Desteklenmeyen CV alanı." });
    }
  });
}
const manualCvDraftSchema = z.object({
  lang: z.enum(["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"]).default("tr"),
  summaryMode: z.enum(["auto", "custom"]).default("auto"),
  fields: restrictedStringRecord(manualCvFieldKeys, 2000),
  additionalData: z.array(restrictedStringRecord(manualCvRowKeys.additional, 300)).max(50).default([]),
  stcwData: z.array(restrictedStringRecord(manualCvRowKeys.stcw, 300)).max(50).default([]),
  seaData: z.array(restrictedStringRecord(manualCvRowKeys.sea, 300)).max(50).default([])
}).strict();
const manualCvSchema = manualCvDraftSchema.superRefine((value, context) => {
  const experienceIds = new Set();
  value.seaData.forEach((row, index) => {
    const contentKeys = [...manualCvRowKeys.sea].filter((key) => !["rowId", "lookupProvider", "lookupFetchedAt", "serviceDocumentStatus", "saved"].includes(key));
    if (!contentKeys.some((key) => String(row[key] || "").trim())) return;
    const required = ["rowId", "imo", "vessel", "company", "type", "flag", "mmsi", "dwt", "grt", "rank", "signon", "signoff", "referenceName", "referenceCompanyEmail", "referenceCompanyPhone", "referencePhone", "serviceDocumentId"];
    required.forEach((key) => {
      if (!String(row[key] || "").trim()) context.addIssue({ code: z.ZodIssueCode.custom, path: ["seaData", index, key], message: "Deniz hizmeti referans alanı zorunludur." });
    });
    if (row.rowId && !z.string().uuid().safeParse(row.rowId).success) context.addIssue({ code: z.ZodIssueCode.custom, path: ["seaData", index, "rowId"], message: "Geçerli tecrübe kimliği gereklidir." });
    if (row.rowId && experienceIds.has(row.rowId)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["seaData", index, "rowId"], message: "Aynı tecrübe kaydı tekrar kullanılamaz." });
    if (row.rowId) experienceIds.add(row.rowId);
    if (row.serviceDocumentId && !z.string().uuid().safeParse(row.serviceDocumentId).success) context.addIssue({ code: z.ZodIssueCode.custom, path: ["seaData", index, "serviceDocumentId"], message: "Geçerli hizmet belgesi kimliği gereklidir." });
    if (row.saved !== "true") context.addIssue({ code: z.ZodIssueCode.custom, path: ["seaData", index, "saved"], message: "Deniz tecrübesi önce kullanıcı tarafından kaydedilmelidir." });
    if (row.imo && !isValidImoNumber(row.imo)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["seaData", index, "imo"], message: "Geçerli bir IMO numarası gereklidir." });
    if (row.referenceCompanyEmail && !z.string().email().safeParse(row.referenceCompanyEmail).success) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["seaData", index, "referenceCompanyEmail"], message: "Geçerli şirket e-postası gereklidir." });
    }
    if (row.vesselPhotoUrl && !trustedVesselPhotoUrl(row.vesselPhotoUrl)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["seaData", index, "vesselPhotoUrl"], message: "Gemi fotoğrafı güvenilir sağlayıcıdan gelmelidir." });
    }
    if (row.vesselPhotoSourceUrl && !trustedVesselPhotoUrl(row.vesselPhotoSourceUrl, true)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["seaData", index, "vesselPhotoSourceUrl"], message: "Gemi fotoğrafı kaynak bağlantısı geçersizdir." });
    }
    if (row.signon && row.signoff && row.signoff < row.signon) context.addIssue({ code: z.ZodIssueCode.custom, path: ["seaData", index, "signoff"], message: "Ayrılış tarihi katılış tarihinden önce olamaz." });
  });
});
const manualCvDraftRequestSchema = z.object({ cv: manualCvDraftSchema, confirmation: z.literal(true) }).strict();
const manualCvRequestSchema = z.object({ cv: manualCvSchema, confirmation: z.literal(true) }).strict();
const maritimeReferenceRequestSchema = z.object({
  experience: restrictedStringRecord(manualCvRowKeys.sea, 300).superRefine((row, context) => {
    const required = ["rowId", "imo", "vessel", "company", "type", "flag", "mmsi", "dwt", "grt", "rank", "signon", "signoff", "referenceName", "referenceCompanyEmail", "referenceCompanyPhone", "referencePhone", "serviceDocumentId"];
    required.forEach((key) => {
      if (!cvText(row[key])) context.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: "Deniz hizmeti referans alanı zorunludur." });
    });
    if (row.rowId && !z.string().uuid().safeParse(row.rowId).success) context.addIssue({ code: z.ZodIssueCode.custom, path: ["rowId"], message: "Geçerli tecrübe kimliği gereklidir." });
    if (row.serviceDocumentId && !z.string().uuid().safeParse(row.serviceDocumentId).success) context.addIssue({ code: z.ZodIssueCode.custom, path: ["serviceDocumentId"], message: "Geçerli hizmet belgesi kimliği gereklidir." });
    if (row.saved !== "true") context.addIssue({ code: z.ZodIssueCode.custom, path: ["saved"], message: "Deniz tecrübesi kaydı onaylanmalıdır." });
    if (row.imo && !isValidImoNumber(row.imo)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["imo"], message: "Geçerli bir IMO numarası gereklidir." });
    if (row.referenceCompanyEmail && !z.string().email().safeParse(row.referenceCompanyEmail).success) context.addIssue({ code: z.ZodIssueCode.custom, path: ["referenceCompanyEmail"], message: "Geçerli şirket e-postası gereklidir." });
    if (row.signon && row.signoff && row.signoff < row.signon) context.addIssue({ code: z.ZodIssueCode.custom, path: ["signoff"], message: "Ayrılış tarihi katılış tarihinden önce olamaz." });
  }),
  candidate: z.object({
    first_name: z.string().trim().min(1).max(160),
    middle_name: z.string().trim().max(160).default(""),
    family_name: z.string().trim().min(1).max(160)
  }).strict(),
  cv_summary: z.object({
    current_position: z.string().trim().max(160).default(""),
    competency_class: z.string().trim().max(160).default(""),
    competency_certificate: z.string().trim().max(160).default(""),
    medical_expiry: z.string().trim().max(20).default(""),
    certificate_codes: z.array(z.string().trim().min(1).max(40)).max(30).default([])
  }).strict(),
  confirmation: z.literal(true)
}).strict();
const maritimePartnerVesselRequestSchema = z.object({
  partner_id: z.string().uuid(),
  imo: z.string().trim().max(24),
  confirmation: z.literal(true)
}).strict();
const maritimePartnerReferenceReviewSchema = z.object({
  partner_id: z.string().uuid(),
  decision: z.enum(["confirmed", "denied", "needs_review"]),
  review_note: z.string().trim().max(1000).default(""),
  confirmation: z.literal(true)
}).strict();
const maritimePartnerReferenceParamsSchema = z.object({ claimId: z.string().uuid() }).strict();
const maritimePartnerVesselDecisionParamsSchema = z.object({ vesselId: z.string().uuid() }).strict();
const maritimePartnerVesselDecisionSchema = z.object({
  decision: z.enum(["verified", "rejected"]),
  review_note: z.string().trim().min(3).max(1000),
  confirmation: z.literal("MARITIME_VESSEL_REVIEW_APPROVED")
}).strict();
const identitySupportRequestSchema = z.object({
  message: z.string().trim().min(10).max(2000),
  confirmation: z.literal(true)
}).strict();
const identityCorrectionParamsSchema = z.object({ ticketId: z.string().uuid() }).strict();
const identityDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}, "Geçerli bir doğum tarihi gereklidir.");
const identityCorrectionApprovalSchema = z.object({
  confirmation: z.literal("MARITIME_IDENTITY_CHANGE_APPROVED"),
  identity: z.object({
    given_names: z.string().trim().min(2).max(160),
    family_name: z.string().trim().min(2).max(160),
    middle_name: z.string().trim().min(2).max(160),
    date_of_birth: identityDateSchema,
    place_of_birth: z.string().trim().min(2).max(160),
    nationality: z.string().trim().min(2).max(120),
    gender: z.string().trim().min(1).max(80)
  }).strict()
}).strict();
const maritimeIdentityLockedFields = Object.freeze([
  "position", "firstName", "familyName", "fatherName", "birthDate", "birthPlace", "nationality", "gender", "marital", "address", "airport"
]);

function httpError(message, statusCode = 400, code = "MARITIME_SMART_ACCOUNT_REQUEST_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.exposeCode = true;
  return error;
}

function requestDeviceKey(request) {
  const value = String(request.headers["x-allona-device-key"] || "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(value)) {
    throw httpError("Güvenli cihaz tanımlaması tamamlanamadı. Tarayıcı güvenlik ayarlarınızı kontrol edip yeniden deneyin.", 400, "MARITIME_DEVICE_KEY_REQUIRED");
  }
  return value;
}

function identitySecurityError(source, fallbackMessage = "Maritime CV güvenlik doğrulaması tamamlanamadı.") {
  const text = String(source || "");
  if (text.includes("MARITIME_IDENTITY_ALREADY_REGISTERED")) {
    return httpError("Bu kişi sistemde kayıtlıdır. Bilgiler size aitse destekle iletişime geçin.", 409, "MARITIME_IDENTITY_ALREADY_REGISTERED");
  }
  if (text.includes("MARITIME_IDENTITY_LOCKED") || text.includes("MARITIME_IDENTITY_OWNER_LOCKED")) {
    return httpError("Kaydedilmiş kişisel bilgiler yalnız destek doğrulamasıyla değiştirilebilir.", 409, "MARITIME_IDENTITY_LOCKED");
  }
  if (text.includes("MARITIME_DEVICE_ALREADY_BOUND")) {
    return httpError("Bu cihaz başka bir hesaba bağlıdır. Hesabınıza erişemiyorsanız destekle iletişime geçin.", 409, "MARITIME_DEVICE_ALREADY_BOUND");
  }
  if (text.includes("MARITIME_DEVICE_BINDING_REQUIRED") || text.includes("MARITIME_DEVICE_KEY_INVALID")) {
    return httpError("Güvenli cihaz tanımlaması tamamlanamadı. Yeniden giriş yapıp tekrar deneyin.", 409, "MARITIME_DEVICE_BINDING_REQUIRED");
  }
  if (text.includes("MARITIME_IDENTITY_REQUIRED")) {
    return httpError("Ad, soyad, baba adı, doğum tarihi, doğum yeri, vatandaşlık ve cinsiyet eksiksiz doldurulmalıdır.", 409, "MARITIME_IDENTITY_REQUIRED");
  }
  return httpError(fallbackMessage, 503, "MARITIME_IDENTITY_SECURITY_UNAVAILABLE");
}

function assertIdentitySecurity(result, fallbackMessage) {
  if (result.error) {
    throw identitySecurityError(`${result.error.message || ""} ${result.error.details || ""} ${result.error.hint || ""}`, fallbackMessage);
  }
  if (typeof result.data === "string") {
    try {
      return JSON.parse(result.data);
    } catch {
      throw identitySecurityError("", fallbackMessage);
    }
  }
  return result.data || {};
}

function assertDb(result, message) {
  if (result.error) {
    const source = `${result.error.message || ""} ${result.error.details || ""}`;
    const statusCode = /required|unavailable|not found|state conflict|not eligible/i.test(source) ? 409 : 503;
    throw httpError(message, statusCode, "MARITIME_SMART_ACCOUNT_DATABASE_ERROR");
  }
  return result.data;
}

function cvText(value) {
  return String(value ?? "").trim();
}

function normalizedLockedCvValue(value) {
  return cvText(value).normalize("NFKC").replace(/\s+/g, " ");
}

function lockedCvValue(profilePayload, field) {
  const manualFields = profilePayload?.manual_cv?.fields;
  if (manualFields && Object.prototype.hasOwnProperty.call(manualFields, field)) return cvText(manualFields[field]);
  const fallback = {
    position: profilePayload?.rank,
    firstName: profilePayload?.given_names,
    familyName: profilePayload?.family_name,
    fatherName: profilePayload?.middle_name,
    birthDate: profilePayload?.date_of_birth,
    birthPlace: profilePayload?.place_of_birth,
    nationality: profilePayload?.nationality,
    gender: profilePayload?.gender,
    marital: profilePayload?.marital_status,
    address: profilePayload?.contact?.permanent_address,
    airport: profilePayload?.contact?.nearest_airport
  };
  return cvText(fallback[field]);
}

function enforceSavedPersonalDetails(identityLock, currentProfile, nextCv) {
  if (!identityLock || !currentProfile?.profile_payload) return;
  for (const field of maritimeIdentityLockedFields) {
    const previous = normalizedLockedCvValue(lockedCvValue(currentProfile.profile_payload, field));
    if (!previous) continue;
    const next = normalizedLockedCvValue(nextCv.fields[field]);
    if (next !== previous) {
      throw httpError("Kaydedilmiş kişisel bilgiler yalnız destek doğrulamasıyla değiştirilebilir.", 409, "MARITIME_IDENTITY_LOCKED");
    }
  }
}

function cvDate(value) {
  const clean = cvText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : clean || null;
}

function cvNumber(value) {
  const clean = String(value ?? "").replace(/[^0-9.]/g, "");
  if (!clean) return null;
  const numeric = Number(clean);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function localizedManualValue(language, value) {
  return Object.fromEntries(["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"].map((code) => [code, code === language ? cvText(value) || null : null]));
}

function manualLanguage(fields, code, language) {
  const labels = { az: "Azerbaijani", tr: "Turkish", en: "English", ru: "Russian" };
  const levels = [fields[`${code}Speak`], fields[`${code}Read`], fields[`${code}Write`]].map(cvText).filter(Boolean);
  return levels.length ? {
    language: labels[code],
    language_i18n: localizedManualValue(language, labels[code]),
    level: [...new Set(levels)].join(" / "),
    level_i18n: localizedManualValue(language, [...new Set(levels)].join(" / ")),
    confidence: 1
  } : null;
}

const manualStcwPresets = Object.freeze({
  sp: Object.freeze({ code: "SP", tr: "Uluslararası Emniyet Yönetimi (ISM Kodu)", az: "Beynəlxalq Təhlükəsizliyin İdarə Edilməsi (ISM Kodu)", en: "International Safety Management (ISM Code)", ru: "Международное управление безопасностью (Кодекс ISM)" }),
  sh: Object.freeze({ code: "SH", tr: "Belirlenmiş Güvenlik Görevleri (DSD)", az: "Təyin Edilmiş Təhlükəsizlik Vəzifələri (DSD)", en: "Designated Security Duties (DSD)", ru: "Назначенные обязанности по охране (DSD)" }),
  si: Object.freeze({ code: "SI", tr: "Güvenlik Farkındalık Eğitimi", az: "Təhlükəsizlik üzrə Məlumatlandırma Təlimi", en: "Security Awareness Training", ru: "Подготовка по осведомлённости в области охраны" }),
  sl: Object.freeze({ code: "SL", tr: "Can Kurtarma Araçları ve Kurtarma Botları Kullanma Yeterliği (PSCRB)", az: "Xilasetmə Vasitələri və Xilasedici Qayıqlar üzrə Hazırlıq (PSCRB)", en: "Proficiency in Survival Craft and Rescue Boats (PSCRB)", ru: "Подготовка по спасательным шлюпкам, плотам и дежурным шлюпкам (PSCRB)" }),
  so: Object.freeze({ code: "SO", tr: "Temel Emniyet Eğitimi (BST)", az: "Əsas Təhlükəsizlik Hazırlığı (BST)", en: "Basic Safety Training (BST)", ru: "Начальная подготовка по безопасности (BST)" }),
  sa: Object.freeze({ code: "SA", tr: "Kimyasal Tanker Sertifikası (SA)", az: "Kimyəvi Tanker Sertifikatı (SA)", en: "Chemical Tanker Certificate (SA)", ru: "Сертификат химического танкера (SA)" })
});

function manualStcwTitle(row, language) {
  const preset = manualStcwPresets[cvText(row.presetId || row.code).toLowerCase()];
  const title = cvText(row.name) || preset?.[language] || preset?.en || "";
  const titleI18n = preset
    ? Object.fromEntries(["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"].map((code) => [code, preset[code] || null]))
    : localizedManualValue(language, title);
  return { preset, title, titleI18n };
}

function manualCertificate(row, language, type = "training") {
  const stcwTitle = type === "stcw" ? manualStcwTitle(row, language) : null;
  const title = stcwTitle?.title || cvText(row.name);
  const code = type === "stcw" ? cvText(row.code || stcwTitle?.preset?.code).toUpperCase() : "";
  const rawNumber = cvText(row.number || row.cert);
  const documentNumber = code && rawNumber && !rawNumber.toUpperCase().startsWith(`${code}-`) ? `${code}-${rawNumber}` : rawNumber;
  const unlimited = type === "stcw" && cvText(row.unlimited) === "true";
  if (type === "stcw" && cvText(row.included) === "false") return null;
  const hasUserData = [row.name, row.institute, row.place, row.issue, row.rank, row.cert, row.number, row.expiry].some((value) => cvText(value));
  if (type === "stcw" && stcwTitle?.preset && !hasUserData && !unlimited) return null;
  if (!title && !documentNumber) return null;
  return {
    code: code || null,
    document_number: documentNumber || null,
    title: title || null,
    title_i18n: stcwTitle?.titleI18n || localizedManualValue(language, title),
    issuing_authority: cvText(row.institute) || null,
    place_of_issue: cvText(row.place) || null,
    issue_date: cvDate(row.issue),
    expiry_date: unlimited ? null : cvDate(row.expiry),
    validity_status: unlimited ? "non_expiring" : cvText(row.expiry) ? "dated" : "not_stated",
    rank_or_capacity: type === "stcw" ? cvText(row.rank) || null : null,
    rank_or_capacity_i18n: localizedManualValue(language, type === "stcw" ? row.rank : ""),
    stcw_references: [],
    confidence: 1
  };
}

function manualCvPayload(cv) {
  const fields = cv.fields;
  const givenNames = cvText(fields.firstName);
  const familyName = cvText(fields.familyName);
  const middleName = cvText(fields.fatherName);
  const legacyBirth = cvText(fields.birth);
  const birthDate = cvDate(fields.birthDate || legacyBirth.match(/\d{4}-\d{2}-\d{2}/)?.[0] || "");
  const birthPlace = cvText(fields.birthPlace || (birthDate ? legacyBirth.replace(String(birthDate), "") : legacyBirth).replace(/^[,\s-]+|[,\s-]+$/g, ""));
  const rank = cvText(fields.position);
  const identityDocuments = [];
  if (cvText(fields.passportNo) || cvText(fields.passportDoc)) identityDocuments.push({
    kind: "passport",
    label: cvText(fields.passportDoc) || "Travel Passport",
    issuing_country: cvText(fields.passportCountry) || null,
    document_number: cvText(fields.passportNo) || null,
    place_of_issue: cvText(fields.passportPlace) || null,
    issue_date: cvDate(fields.passportIssued),
    expiry_date: cvDate(fields.passportValid),
    validity_status: cvText(fields.passportValid) ? "dated" : "not_stated",
    confidence: 1
  });
  if (cvText(fields.seamanBookNo)) identityDocuments.push({
    kind: "seafarer_book",
    label: "Seaman Book",
    document_number: cvText(fields.seamanBookNo),
    place_of_issue: cvText(fields.seamanBookPlace) || null,
    issue_date: cvDate(fields.seamanBookIssued),
    expiry_date: cvDate(fields.seamanBookValid),
    validity_status: cvText(fields.seamanBookValid) ? "dated" : "not_stated",
    confidence: 1
  });
  if (cvText(fields.seafarerIdNo)) identityDocuments.push({
    kind: "national_id",
    label: "Seafarer Identity Document",
    document_number: cvText(fields.seafarerIdNo),
    place_of_issue: cvText(fields.seafarerIdPlace) || null,
    issue_date: cvDate(fields.seafarerIdIssued),
    expiry_date: cvDate(fields.seafarerIdValid),
    validity_status: cvText(fields.seafarerIdValid) ? "dated" : "not_stated",
    confidence: 1
  });
  const competency = cvText(fields.competencyCertificate) || cvText(fields.competencyClass) ? {
    code: cvText(fields.competencyClass) || null,
    document_number: cvText(fields.competencyCertificate) || null,
    title: cvText(fields.competencyClass) || "Certificate of Competency",
    title_i18n: localizedManualValue(cv.lang, cvText(fields.competencyClass) || "Certificate of Competency"),
    issuing_country: cvText(fields.competencyCountry) || null,
    issue_date: cvDate(fields.competencyIssued),
    expiry_date: cvDate(fields.competencyExpires),
    validity_status: cvText(fields.competencyExpires) ? "dated" : "not_stated",
    rank_or_capacity: rank || null,
    rank_or_capacity_i18n: localizedManualValue(cv.lang, rank),
    stcw_references: [],
    confidence: 1
  } : null;
  const certificateRecords = [
    competency,
    ...cv.additionalData.map((row) => manualCertificate(row, cv.lang, "training")),
    ...cv.stcwData.map((row) => manualCertificate(row, cv.lang, "stcw"))
  ].filter(Boolean);
  const medicalRecords = cvText(fields.medicalDoc) || cvText(fields.medicalIssue) || cvText(fields.medicalExpiry) ? [{
    record_type: "medical_certificate",
    document_number: cvText(fields.medicalDoc) || null,
    result: "not_stated",
    restrictions: [],
    validity_period_text: cvText(fields.medicalGrade) || null,
    place_of_issue: cvText(fields.medicalPlace) || null,
    issue_date: cvDate(fields.medicalIssue),
    expiry_date: cvDate(fields.medicalExpiry),
    validity_status: cvText(fields.medicalExpiry) ? "dated" : "not_stated",
    confidence: 1
  }] : [];
  const education = cvText(fields.schoolName) ? [{
    institution: cvText(fields.schoolName),
    city: cvText(fields.schoolPlace) || null,
    qualification: cvText(fields.schoolGrade) || null,
    qualification_i18n: localizedManualValue(cv.lang, fields.schoolGrade),
    start_date: cvDate(fields.schoolFrom),
    end_date: cvDate(fields.schoolTo),
    confidence: 1
  }] : [];
  const seaService = cv.seaData.map((row) => ({
    vessel_name: cvText(row.vessel) || null,
    imo_number: isValidImoNumber(row.imo) ? normalizeImoNumber(row.imo) : null,
    company_name: cvText(row.company) || null,
    vessel_type: cvText(row.type) || null,
    vessel_type_i18n: localizedManualValue(cv.lang, row.type),
    flag: cvText(row.flag) || null,
    deadweight_tonnage: cvNumber(row.dwt),
    gross_tonnage: cvNumber(row.grt),
    net_tonnage: cvNumber(row.netTonnage),
    build_year: cvNumber(row.buildYear),
    mmsi: cvText(row.mmsi) || null,
    call_sign: cvText(row.callSign) || null,
    length_overall_m: cvNumber(row.lengthOverall),
    rank: cvText(row.rank) || null,
    rank_i18n: localizedManualValue(cv.lang, row.rank),
    sign_on_date: cvDate(row.signon),
    sign_off_date: cvDate(row.signoff),
    reference_name: cvText(row.referenceName) || null,
    reference_company_email: cvText(row.referenceCompanyEmail) || null,
    reference_company_phone: cvText(row.referenceCompanyPhone) || null,
    reference_phone: cvText(row.referencePhone) || null,
    lookup_provider: cvText(row.lookupProvider) || null,
    lookup_fetched_at: cvText(row.lookupFetchedAt) || null,
    vessel_photo_url: cvText(row.vesselPhotoUrl) || null,
    vessel_photo_source_url: cvText(row.vesselPhotoSourceUrl) || null,
    vessel_photo_credit: cvText(row.vesselPhotoCredit) || null,
    confidence: 1
  })).filter((row) => row.vessel_name || row.company_name || row.rank || row.sign_on_date);
  const references = cv.seaData.map((row) => ({
    name: cvText(row.referenceName) || null,
    company: cvText(row.company) || null,
    position: "Vessel service reference",
    phone: cvText(row.referencePhone) || null,
    company_phone: cvText(row.referenceCompanyPhone) || null,
    email: cvText(row.referenceCompanyEmail) || null,
    vessel_name: cvText(row.vessel) || null,
    imo_number: isValidImoNumber(row.imo) ? normalizeImoNumber(row.imo) : null,
    confidence: 1
  })).filter((row) => row.name || row.company || row.phone || row.email);
  const skills = [
    ["Windows", fields.windows],
    ["Microsoft Office", fields.office],
    ["Internet", fields.internet]
  ].filter(([, level]) => cvText(level)).map(([name, level]) => ({ name: `${name}: ${cvText(level)}`, category: "digital", confidence: 1 }));
  const tradeSpecialties = {
    welder: "Welder",
    flame_cutter: "Flame Cutter",
    fitter: "Fitter"
  };
  const tradeSpecialty = tradeSpecialties[cvText(fields.tradeSpecialty)];
  if (tradeSpecialty) skills.push({ name: tradeSpecialty, category: "trade", confidence: 1 });
  const emergencyContacts = cvText(fields.kinName) || cvText(fields.kinPhone) ? [{
    name: cvText(fields.kinName) || null,
    relationship: cvText(fields.kinRelation) || null,
    phone: cvText(fields.kinPhone) || null,
    address: cvText(fields.kinAddress) || null,
    confidence: 1
  }] : [];
  return {
    data_origin: "user_entered_maritime_cv",
    document_type: "cv",
    source_languages: [cv.lang],
    holder_name: [givenNames, middleName, familyName].filter(Boolean).join(" "),
    family_name: familyName || null,
    given_names: givenNames || null,
    middle_name: middleName || null,
    date_of_birth: birthDate,
    place_of_birth: birthPlace || null,
    nationality: cvText(fields.nationality) || null,
    nationality_i18n: localizedManualValue(cv.lang, fields.nationality),
    gender: cvText(fields.gender) || null,
    marital_status: cvText(fields.marital) || null,
    rank: rank || null,
    rank_i18n: localizedManualValue(cv.lang, rank),
    suitable_positions: rank ? [rank] : [],
    suitable_positions_i18n: Object.fromEntries(["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"].map((code) => [code, code === cv.lang && rank ? [rank] : []])),
    contact: {
      email: cvText(fields.email) || null,
      phone: cvText(fields.mobile) || null,
      secondary_phone: null,
      permanent_address: cvText(fields.address) || null,
      nearest_airport: cvText(fields.airport) || null
    },
    physical_profile: {
      height_cm: cvNumber(fields.height),
      weight_kg: cvNumber(fields.weight),
      eye_color: cvText(fields.eyes) || null,
      hair_color: cvText(fields.hair) || null,
      shoe_size: cvText(fields.shoes) || null,
      overall_size: cvText(fields.overall) || null
    },
    identity_documents: identityDocuments,
    education,
    certificate_records: certificateRecords,
    certificate_codes: [...new Set(certificateRecords.map((row) => row.code).filter(Boolean))],
    medical_records: medicalRecords,
    medical_fitness: ["fit", "fit_with_restrictions", "unfit"].includes(cvText(fields.medicalFitness)) ? cvText(fields.medicalFitness) : "not_stated",
    sea_service: seaService,
    languages: [manualLanguage(fields, "az", cv.lang), manualLanguage(fields, "tr", cv.lang), manualLanguage(fields, "en", cv.lang), manualLanguage(fields, "ru", cv.lang)].filter(Boolean),
    skills,
    emergency_contacts: emergencyContacts,
    references,
    professional_summary: cvText(fields.note) || null,
    professional_summary_i18n: localizedManualValue(cv.lang, fields.note),
    notes: cvText(fields.note) ? [cvText(fields.note)] : [],
    manual_cv: cv
  };
}

function manualCvCompletion(payload) {
  const checks = [payload.given_names, payload.family_name, payload.date_of_birth, payload.place_of_birth, payload.nationality, payload.rank, payload.contact?.email, payload.contact?.phone];
  const detailed = [payload.identity_documents?.length, payload.certificate_records?.length, payload.sea_service?.length, payload.education?.length, payload.languages?.length];
  return Math.min(100, Math.round((checks.filter(Boolean).length / checks.length) * 70 + (detailed.filter(Boolean).length / detailed.length) * 30));
}

export const maritimeCvEditorMetadata = Object.freeze({
  fields: [...manualCvFieldKeys].filter((key) => key !== "birth"),
  presets: manualStcwPresets
});

export function normalizeManualCv(source) {
  const record = (value, allowed) => Object.fromEntries(Object.entries(value || {})
    .filter(([key]) => allowed.has(key)).map(([key, value]) => [key, String(value ?? "")]));
  const cv = manualCvDraftSchema.parse({
    lang: source.lang,
    summaryMode: source.summaryMode,
    fields: record(source.fields, manualCvFieldKeys),
    additionalData: (source.additionalData || []).map((row) => record(row, manualCvRowKeys.additional)),
    stcwData: (source.stcwData || []).map((row) => record(row, manualCvRowKeys.stcw)),
    seaData: (source.seaData || []).map((row) => record(row, manualCvRowKeys.sea))
  });
  cv.fields.birthDate ||= cv.fields.birth?.match(/\d{4}-\d{2}-\d{2}/)?.[0] || "";
  cv.fields.birthPlace ||= cvText((cv.fields.birth || "").replace(cv.fields.birthDate, "").replace(/^[,\s-]+|[,\s-]+$/g, ""));
  cv.stcwData = cv.stcwData.map((row) => {
    const presetId = cvText(row.presetId || row.code).toLowerCase();
    const preset = manualStcwPresets[presetId];
    return { ...row, ...(preset ? { presetId, code: preset.code } : {}), number: cvText(row.number || row.cert), cert: "" };
  });
  return cv;
}

export function maritimeAdminCvError(error) {
  const source = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ");
  if (/MARITIME_IDENTITY_/.test(source)) return identitySecurityError(source);
  return httpError("CV kaydı tamamlanamadı. Bilgiler korunuyor; lütfen yeniden deneyin.", 503, "MARITIME_ADMIN_CV_SAVE_UNAVAILABLE");
}

const adminCvRequiredLabels = Object.freeze({
  profile_photo: "Profil fotoğrafı", rank: "Pozisyon", given_names: "Ad", family_name: "Soyadı", middle_name: "Baba adı",
  date_of_birth: "Doğum tarihi", place_of_birth: "Doğum yeri", nationality: "Uyruk", gender: "Cinsiyet", marital_status: "Medeni durum",
  contact_email: "E-posta", contact_phone: "Telefon", permanent_address: "Adres", nearest_airport: "En yakın havalimanı",
  passport: "Pasaport", passport_number: "Pasaport numarası", passport_issuing_country: "Pasaportu düzenleyen ülke", passport_issue_date: "Pasaport veriliş tarihi", passport_expiry_date: "Pasaport geçerlilik tarihi",
  seaman_book: "Gemiadamı cüzdanı", seaman_book_number: "Gemiadamı cüzdan numarası", seaman_book_issue_date: "Cüzdan veriliş tarihi", seaman_book_expiry_date: "Cüzdan geçerlilik tarihi",
  medical_certificate: "Sağlık belgesi", medical_certificate_number: "Sağlık belgesi numarası", medical_certificate_issue_date: "Sağlık belgesi veriliş tarihi", medical_certificate_expiry_date: "Sağlık belgesi geçerlilik tarihi", medical_fitness: "Sağlık uygunluğu",
  rowId: "Kayıt kimliği", imo: "IMO", vessel: "Gemi adı", company: "Şirket", type: "Gemi türü", flag: "Bayrak", mmsi: "MMSI", dwt: "DWT", grt: "GRT", signon: "Katılış tarihi", signoff: "Ayrılış tarihi",
  referenceName: "Referans yetkilisi", referenceCompanyEmail: "Şirket e-postası", referenceCompanyPhone: "Şirket telefonu", referencePhone: "Referans telefonu", serviceDocumentId: "Hizmet belgesi"
});

function adminCvRequiredLabel(key) {
  if (adminCvRequiredLabels[key]) return adminCvRequiredLabels[key];
  const certificate = /^certificate_(sp|sh|si|sl|so)(?:_(number|issue_date|expiry_date))?$/.exec(key);
  if (certificate) return `${certificate[1].toUpperCase()} ${({ number: "sertifika numarası", issue_date: "veriliş tarihi", expiry_date: "geçerlilik tarihi" })[certificate[2]] || "sertifikası"}`;
  return key;
}

// Admin corrections use the same canonical data and ownership checks as a member save.
export async function prepareMaritimeAdminCv(userId, source, status) {
  if (!source?.manual_cv?.fields) throw httpError("Önce Maritime CV bilgilerini girin.", 409, "MARITIME_CV_REQUIRED");
  const cv = normalizeManualCv(source.manual_cv);
  const confirmed = ["user_confirmed", "verification_pending", "verified"].includes(status);
  if (confirmed) {
    const candidate = { ...cv, seaData: cv.seaData.map((row) => ({ ...row, saved: "true" })) };
    const parsed = manualCvSchema.safeParse(candidate);
    if (!parsed.success) {
      const fields = parsed.error.issues.map((issue) => `${Number(issue.path[1]) + 1}. kayıt: ${adminCvRequiredLabel(issue.path.at(-1))}`).join(", ");
      throw httpError(`Deniz tecrübesi tamamlanmalıdır: ${fields}.`, 409, "MARITIME_CV_EXPERIENCE_INCOMPLETE");
    }
    await assertOwnedSeaServiceDocuments(userId, candidate.seaData);
    cv.seaData = candidate.seaData;
  }
  const payload = { ...source, ...manualCvPayload(cv) };
  const readiness = maritimeGlobalPassportReadiness(payload, { hasPhoto: await hasStoredProfilePhoto(userId) });
  if (confirmed && !readiness.ready) {
    throw httpError(`CV onayı için eksik alanlar: ${readiness.missing.map(adminCvRequiredLabel).join(", ")}.`, 409, "MARITIME_CV_REQUIRED_FIELDS_MISSING");
  }
  return { payload, completion: manualCvCompletion(payload), readiness };
}

async function assertOwnedSeaServiceDocuments(userId, seaData) {
  const rows = seaData.filter((row) => String(row.serviceDocumentId || "").trim());
  if (!rows.length) return;
  const ids = [...new Set(rows.map((row) => row.serviceDocumentId))];
  const result = await supabaseAdmin
    .from("maritime_document_intakes")
    .select("id,seafarer_user_id,status,document_type,metadata")
    .in("id", ids)
    .eq("seafarer_user_id", userId);
  const documents = assertDb(result, "Hizmet belgeleri doğrulanamadı.") || [];
  const byId = new Map(documents.map((document) => [document.id, document]));
  for (const row of rows) {
    const document = byId.get(row.serviceDocumentId);
    const valid = document
      && document.document_type === "sea_service_record"
      && ["user_confirmed", "verified"].includes(document.status)
      && document.metadata?.source === "maritime_cv_sea_service"
      && document.metadata?.experience_id === row.rowId;
    if (!valid) throw httpError("Hizmet belgesi bu deniz tecrübesiyle güvenli biçimde eşleştirilemedi.", 409, "MARITIME_SEA_SERVICE_DOCUMENT_MISMATCH");
  }
}

function referenceCandidateName(candidate) {
  return [candidate.first_name, candidate.middle_name, candidate.family_name].map(cvText).filter(Boolean).join(" ");
}

function referenceSummaryFromCv(cv) {
  return {
    current_position: cvText(cv.fields.position),
    competency_class: cvText(cv.fields.competencyClass),
    competency_certificate: cvText(cv.fields.competencyCertificate),
    medical_expiry: cvText(cv.fields.medicalExpiry),
    certificate_codes: [...new Set(cv.stcwData
      .filter((row) => row.included !== "false")
      .map((row) => cvText(row.code).toUpperCase())
      .filter(Boolean))]
  };
}

async function maritimePublicId(userId) {
  const profile = assertDb(await supabaseAdmin.from("profiles").select("public_id").eq("id", userId).maybeSingle(), "Allona ID okunamadı.");
  const publicId = cvText(profile?.public_id);
  if (!publicId) throw httpError("Allona ID henüz oluşturulmadı. Lütfen sayfayı yenileyip tekrar deneyin.", 409, "MARITIME_PUBLIC_ID_REQUIRED");
  return publicId;
}

async function notifyReference({ request, ctx, experience, candidate, cvSummary, publicId }) {
  const result = await queueMaritimeReferenceNotification({
    supabase: supabaseAdmin,
    userId: ctx.user.id,
    publicId,
    candidateName: referenceCandidateName(candidate),
    experience,
    cvSummary
  });
  await auditEvent({
    request,
    actorId: ctx.user.id,
    actorRole: ctx.profile.role,
    action: "maritime.reference_verification_notification_queued",
    resourceType: "maritime_reference_verification_request",
    resourceId: result.request_id,
    metadata: {
      experience_id: experience.rowId,
      delivery_status: result.status,
      idempotent: result.idempotent === true
    }
  });
  return result;
}

async function ownCvIdentity(user) {
  const signed = await supabaseAdmin.storage
    .from(MARITIME_PROFILE_PHOTO_BUCKET)
    .createSignedUrl(`users/${user?.id}/profile.webp`, 600);
  return { avatar_url: signed.error ? "" : String(signed.data?.signedUrl || "") };
}

async function hasStoredProfilePhoto(userId) {
  const result = await supabaseAdmin.storage
    .from(MARITIME_PROFILE_PHOTO_BUCKET)
    .list(`users/${userId}`, { limit: 20, search: "profile.webp" });
  return !result.error && Array.isArray(result.data) && result.data.some((item) => item?.name === "profile.webp");
}

export async function invalidateMaritimeCvDerivedState(userId, now = new Date().toISOString()) {
  assertDb(await supabaseAdmin.from("maritime_smart_account_runs")
    .update({ status: "superseded" })
    .eq("seafarer_user_id", userId)
    .in("status", ["draft", "user_confirmed"]), "Eski Global CV taslağı kapatılamadı.");
  assertDb(await supabaseAdmin.from("maritime_match_results")
    .update({ hard_gate_status: "stale", stale_after: now })
    .eq("seafarer_user_id", userId)
    .neq("hard_gate_status", "stale"), "Eski iş eşleşmeleri kapatılamadı.");
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

async function requireIdentitySupportAdmin(request, action) {
  const ctx = await authContext(request);
  if (!ctx?.user) throw httpError("Oturum doğrulanamadı.", 401, "AUTH_REQUIRED");
  if (!hasRole(ctx.profile, ["admin", "super_admin"]) || !hasMfa(ctx)) {
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.cv_identity_support_denied",
      severity: "critical",
      resourceType: "maritime_cv_identity",
      metadata: { requested_action: action, mfa_verified: hasMfa(ctx) }
    });
    throw httpError("Bu işlem için MFA doğrulamalı yönetici yetkisi gereklidir.", 403, "MARITIME_IDENTITY_ADMIN_APPROVAL_REQUIRED");
  }
  return ctx;
}

async function maritimePartnerBusinesses(userId, { verifiedOnly = false } = {}) {
  const [ownedResult, staffResult] = await Promise.all([
    supabaseAdmin.from("partner_businesses").select("id").eq("owner_id", userId),
    supabaseAdmin.from("partner_staff").select("partner_id").eq("user_id", userId).eq("status", "active")
  ]);
  const ids = new Set((assertDb(ownedResult, "Partner şirket yetkisi okunamadı.") || []).map((row) => row.id));
  (assertDb(staffResult, "Partner personel yetkisi okunamadı.") || []).forEach((row) => ids.add(row.partner_id));
  if (!ids.size) return [];
  let query = supabaseAdmin
    .from("partner_businesses")
    .select("id,partner_code,partner_type,status,verification_status")
    .in("id", [...ids])
    .eq("partner_type", "maritime")
    .eq("status", "active");
  if (verifiedOnly) query = query.eq("verification_status", "verified");
  return assertDb(await query.order("created_at", { ascending: true }), "Denizcilik partner kaydı okunamadı.") || [];
}

async function requireMaritimePartner(request, action, { verifiedOnly = true } = {}) {
  const ctx = await authContext(request);
  if (!ctx?.user) throw httpError("Oturum doğrulanamadı.", 401, "AUTH_REQUIRED");
  if (!hasRole(ctx.profile, "partner") || !hasMfa(ctx)) {
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.partner_reference_access_denied",
      severity: "warning",
      resourceType: "maritime_partner_reference_center",
      metadata: { requested_action: action, mfa_verified: hasMfa(ctx) }
    });
    throw httpError("Bu alan MFA doğrulamalı denizcilik partner hesaplarına açıktır.", 403, "MARITIME_PARTNER_ACCOUNT_REQUIRED");
  }
  const businesses = await maritimePartnerBusinesses(ctx.user.id, { verifiedOnly });
  if (!businesses.length && verifiedOnly) {
    throw httpError("Referans merkezi için aktif ve doğrulanmış denizcilik partneri gereklidir.", 403, "MARITIME_PARTNER_VERIFICATION_REQUIRED");
  }
  return { ctx, businesses };
}

function partnerBusinessById(businesses, partnerId) {
  const business = businesses.find((item) => item.id === partnerId);
  if (!business) throw httpError("Bu denizcilik partneri üzerinde işlem yetkiniz yoktur.", 403, "MARITIME_PARTNER_ACCESS_DENIED");
  return business;
}

function partnerReviewPublic(row) {
  if (!row) return null;
  return {
    decision: row.decision,
    review_note: row.review_note || "",
    reviewed_at: row.reviewed_at
  };
}

async function maritimePartnerReferenceCenter(userId) {
  const businesses = await maritimePartnerBusinesses(userId);
  const verifiedBusinesses = businesses.filter((item) => item.verification_status === "verified");
  const verifiedPartnerIds = verifiedBusinesses.map((item) => item.id);
  if (!verifiedPartnerIds.length) {
    return {
      access: { approved: false, reason: "partner_verification_required" },
      businesses,
      vessels: [],
      claims: []
    };
  }

  const vessels = assertDb(await supabaseAdmin
    .from("maritime_vessel_profiles")
    .select("id,partner_id,imo_number,vessel_name,vessel_type,flag_state,status,verification_status,verified_at,updated_at")
    .in("partner_id", verifiedPartnerIds)
    .order("created_at", { ascending: false }), "Partner gemi profilleri okunamadı.") || [];
  const relationships = assertDb(await supabaseAdmin
    .from("maritime_vessel_company_relationships")
    .select("id,partner_id,vessel_profile_id,imo_number,company_name,relationship_role,valid_from,valid_until,verification_status")
    .in("partner_id", verifiedPartnerIds)
    .in("verification_status", ["registry_verified", "admin_verified"])
    .order("valid_from", { ascending: false }), "Tarihsel gemi-şirket yetkileri okunamadı.") || [];
  const imoNumbers = [...new Set(relationships.map((item) => normalizeImoNumber(item.imo_number)).filter(Boolean))];
  if (!imoNumbers.length) {
    return {
      access: { approved: true, reason: "verified_historical_relationship_required" },
      businesses: verifiedBusinesses,
      vessels,
      claims: []
    };
  }

  const claimRows = assertDb(await supabaseAdmin
    .from("maritime_employment_reference_claims")
    .select("id,imo_number,candidate_public_id,candidate_name,vessel_name,source_company_name,rank_name,service_start,service_end,service_document_id,status,created_at,updated_at")
    .in("imo_number", imoNumbers)
    .neq("status", "withdrawn")
    .order("created_at", { ascending: false })
    .limit(500), "Eski çalışan referansları okunamadı.") || [];
  const claimIds = claimRows.map((item) => item.id);
  const reviews = claimIds.length ? assertDb(await supabaseAdmin
    .from("maritime_partner_reference_reviews")
    .select("claim_id,partner_id,decision,review_note,reviewed_at")
    .in("partner_id", verifiedPartnerIds)
    .in("claim_id", claimIds), "Partner referans kararları okunamadı.") || [] : [];
  const reviewByKey = new Map(reviews.map((item) => [`${item.claim_id}:${item.partner_id}`, item]));
  const claimsByImo = new Map();
  claimRows.forEach((claim) => {
    const imo = normalizeImoNumber(claim.imo_number);
    const rows = claimsByImo.get(imo) || [];
    rows.push(claim);
    claimsByImo.set(imo, rows);
  });
  const claims = [];
  const seen = new Set();
  relationships.forEach((relationship) => {
    (claimsByImo.get(normalizeImoNumber(relationship.imo_number)) || []).forEach((claim) => {
      if (!dateRangesOverlap(claim.service_start, claim.service_end, relationship.valid_from, relationship.valid_until)) return;
      const key = `${claim.id}:${relationship.partner_id}`;
      if (seen.has(key)) return;
      seen.add(key);
      claims.push({
        id: claim.id,
        partner_id: relationship.partner_id,
        vessel_profile_id: relationship.vessel_profile_id,
        relationship_id: relationship.id,
        relationship_role: relationship.relationship_role,
        imo_number: normalizeImoNumber(claim.imo_number),
        candidate_public_id: claim.candidate_public_id,
        candidate_name: claim.candidate_name,
        vessel_name: claim.vessel_name,
        source_company_name: claim.source_company_name || "",
        rank_name: claim.rank_name || "",
        service_start: claim.service_start,
        service_end: claim.service_end,
        service_document_available: Boolean(claim.service_document_id),
        review: partnerReviewPublic(reviewByKey.get(key))
      });
    });
  });
  return {
    access: { approved: true, reason: claims.length ? "ready" : "no_matches" },
    businesses: verifiedBusinesses,
    vessels,
    claims
  };
}

async function maritimeApplicationReadiness(userId) {
  const [profileResult, documentsResult] = await Promise.all([
    supabaseAdmin
      .from("maritime_cv_profiles")
      .select("profile_status,profile_payload,last_user_confirmed_at")
      .eq("seafarer_user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("maritime_document_intakes")
      .select("status")
      .eq("seafarer_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100)
  ]);
  const profile = assertDb(profileResult, "Başvuru CV durumu okunamadı.") || null;
  const documents = assertDb(documentsResult, "Başvuru belge durumu okunamadı.") || [];
  const uploadedStatuses = new Set([
    "uploaded", "analysis_queued", "analyzing", "pending_user_confirmation", "user_confirmed",
    "verification_pending", "verified", "analysis_failed", "classified", "ocr_draft"
  ]);
  const confirmedStatuses = new Set(["user_confirmed", "verification_pending", "verified"]);
  const uploadedDocuments = documents.filter((document) => uploadedStatuses.has(document.status));
  const confirmedDocuments = documents.filter((document) => confirmedStatuses.has(document.status));

  return {
    documents_state: confirmedDocuments.length ? "confirmed" : uploadedDocuments.length ? "processing" : "missing",
    has_saved_maritime_cv: profile?.profile_payload?.data_origin === "user_entered_maritime_cv",
    has_confirmed_maritime_cv: Boolean(profile?.last_user_confirmed_at),
    cv_status: profile?.profile_status || "missing"
  };
}

async function maritimeAutoApplyPreference(userId) {
  const result = await supabaseAdmin
    .from("maritime_auto_apply_preferences")
    .select("enabled,enabled_at,disabled_at,last_processed_at,updated_at")
    .eq("seafarer_user_id", userId)
    .maybeSingle();
  const preference = assertDb(result, "Otomatik başvuru tercihi okunamadı.") || null;
  return {
    enabled: preference?.enabled === true,
    enabled_at: preference?.enabled_at || null,
    disabled_at: preference?.disabled_at || null,
    last_processed_at: preference?.last_processed_at || null,
    updated_at: preference?.updated_at || null
  };
}

async function latestSmartState(userId, user) {
  const [applicationReadiness, cvIdentity] = await Promise.all([
    maritimeApplicationReadiness(userId),
    ownCvIdentity(user)
  ]);
  const runResult = await supabaseAdmin
    .from("maritime_smart_account_runs")
    .select("id,status,rule_version,input_snapshot_hash,smart_snapshot,match_count,eligible_match_count,confirmed_at,created_at,updated_at")
    .eq("seafarer_user_id", userId)
    .in("status", ["draft", "user_confirmed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const run = assertDb(runResult, "Akıllı hesap kaydı okunamadı.") || null;
  if (run?.smart_snapshot?.profile) {
    const workspace = assertDb(await supabaseAdmin.from("maritime_seafarer_workspaces")
      .select("current_work_status,job_email_opted_in_at")
      .eq("user_id", userId).maybeSingle(), "Müsaitlik durumu okunamadı.");
    run.smart_snapshot.profile.current_work_status = workspace?.current_work_status || "unknown";
    run.smart_snapshot.profile.job_email_opted_in = Boolean(workspace?.job_email_opted_in_at);
  }
  if (!run) {
    const applications = assertDb(await supabaseAdmin.from("maritime_hiring_applications")
      .select("id,job_id,status,submitted_at")
      .eq("seafarer_user_id", userId).eq("status", "submitted")
      .order("submitted_at", { ascending: false }).limit(100), "Başvurular okunamadı.") || [];
    return { run: null, matches: [], application_drafts: applications,
      application_readiness: applicationReadiness, cv_identity: cvIdentity };
  }

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
  const currentRule = run.rule_version === MARITIME_SMART_RULE_VERSION;
  const matches = (assertDb(matchesResult, "Akıllı eşleşmeler okunamadı.") || []).map((row) => {
    const staleAt = Date.parse(row.stale_after || "");
    const fresh = currentRule && Number.isFinite(staleAt) && staleAt > now;
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
    .filter((application) => matchedJobIds.has(application.job_id) || application.status === "submitted")
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
  return { run, matches, application_drafts: applicationDrafts, application_readiness: applicationReadiness, cv_identity: cvIdentity };
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
    source: snapshot?.profile?.data_origin === "user_entered_maritime_cv" ? "user_entered_maritime_cv" : "confirmed_document_analysis",
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
  app.post("/v1/maritime/manual-applications", {
    config: { rateLimit: { max: 20, timeWindow: "10 minutes" } }
  }, async (request, reply) => {
    const ctx = await requireCustomer(request, "maritime.manual_application.submit");
    const input = manualApplicationSchema.parse(request.body || {});
    await requireMaritimePasskeyProof(request, ctx.user.id);
    const job = (await verifiedOpenJobs()).find((item) => item.id === input.job_id);
    if (!job) throw httpError("İlan artık başvuruya açık değil.", 409, "JOB_UNAVAILABLE");
    const cv = assertDb(await supabaseAdmin.from("maritime_cv_profiles")
      .select("profile_status,profile_payload")
      .eq("seafarer_user_id", ctx.user.id).maybeSingle(), "Maritime CV okunamadı.");
    if (!cv || cv.profile_payload?.data_origin !== "user_entered_maritime_cv" || ["restricted", "stale"].includes(cv.profile_status)) {
      throw httpError("Başvurmadan önce Maritime CV'nizi kaydedin.", 409, "MARITIME_CV_REQUIRED");
    }
    const cvReadiness = maritimeGlobalPassportReadiness(cv.profile_payload, {
      hasPhoto: await hasStoredProfilePhoto(ctx.user.id)
    });
    if (!cvReadiness.ready) {
      throw httpError(`Başvurmak için Maritime CV zorunlu alanlarını tamamlayın: ${cvReadiness.missing.map(adminCvRequiredLabel).join(", ")}.`, 409, "MARITIME_CV_REQUIRED_FIELDS_MISSING");
    }
    const candidateRank = canonicalRank(buildMaritimeSmartProfile({ cvProfile: cv }).profile.rank);
    if (!candidateRank || !canonicalRank(job.rank_code) || candidateRank !== canonicalRank(job.rank_code)) {
      throw httpError("CV'nizdeki rütbe bu ilana uygun değil.", 409, "RANK_MISMATCH");
    }

    const existing = assertDb(await supabaseAdmin.from("maritime_hiring_applications")
      .select("id,status").eq("job_id", job.id).eq("seafarer_user_id", ctx.user.id).maybeSingle(), "Başvuru kontrol edilemedi.");
    if (existing && existing.status === "submitted") return { ok: true, application: existing, idempotent: true };
    if (existing && !["drafted", "awaiting_candidate_approval"].includes(existing.status)) {
      throw httpError("Bu ilandaki başvurunuzun durumu değişti.", 409, "APPLICATION_STATE_CONFLICT");
    }
    const now = new Date().toISOString();
    const consent = { final_submission_confirmed: true, final_submission_confirmed_at: now,
      documents_share_confirmed: true, documents_share_confirmed_at: now, consent_version: "maritime-manual-rank-v1" };
    let applicationId = existing?.id;
    if (!applicationId) {
      const inserted = await supabaseAdmin.from("maritime_hiring_applications").insert({
        job_id: job.id, partner_id: job.partner_id, seafarer_user_id: ctx.user.id,
        status: "awaiting_candidate_approval", submission_mode: "manual", candidate_consent_snapshot: consent,
        metadata: { job_title: job.job_title, job_reference: job.job_reference, matching_source: "maritime_cv_rank" }
      }).select("id").single();
      if (inserted.error && /saved Maritime CV rank does not match/i.test(inserted.error.message || "")) {
        throw httpError("CV'nizdeki rütbe bu ilana uygun değil.", 409, "RANK_MISMATCH");
      }
      if (inserted.error && /manual application consent required/i.test(inserted.error.message || "")) {
        throw httpError("Başvuru için belge paylaşım izninizi işaretleyin.", 409, "APPLICATION_CONSENT_REQUIRED");
      }
      if (inserted.error && /current eligible CV match required/i.test(inserted.error.message || "")) {
        throw httpError("Başvuru güvenlik kuralı güncelleniyor. Lütfen kısa süre sonra yeniden deneyin.", 503, "APPLICATION_RULE_UPDATE_REQUIRED");
      }
      applicationId = assertDb(inserted, "Başvuru kaydedilemedi. Lütfen kısa süre sonra yeniden deneyin.").id;
    }
    const submitted = assertDb(await supabaseAdmin.from("maritime_hiring_applications")
      .update({ status: "submitted", submitted_at: now, candidate_consent_snapshot: consent })
      .eq("id", applicationId).eq("seafarer_user_id", ctx.user.id)
      .select("id,job_id,status,submitted_at").single(), "Başvuru gönderilemedi.");
    await auditEvent({ request, actorId: ctx.user.id, actorRole: ctx.profile.role,
      action: "maritime.manual_application_submitted", resourceType: "maritime_hiring_application", resourceId: applicationId,
      metadata: { job_id: job.id, documents_share_confirmed: true } });
    reply.code(201);
    return { ok: true, application: submitted };
  });
  app.get("/v1/maritime/cv-profile", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.cv_profile.read");
    const deviceKey = requestDeviceKey(request);
    const deviceAccess = assertIdentitySecurity(await supabaseAdmin.rpc("maritime_check_device_access", {
      p_user_id: ctx.user.id,
      p_device_key: deviceKey
    }), "Cihaz erişimi doğrulanamadı.");
    if (deviceAccess.allowed !== true) throw identitySecurityError(deviceAccess.code);
    const profile = assertDb(await supabaseAdmin
      .from("maritime_cv_profiles")
      .select("profile_status,profile_payload,completion_percent,last_user_confirmed_at,updated_at")
      .eq("seafarer_user_id", ctx.user.id)
      .maybeSingle(), "Maritime CV kaydı okunamadı.");
    const identityLock = assertDb(await supabaseAdmin
      .from("maritime_cv_identity_locks")
      .select("locked_at,identity_version")
      .eq("user_id", ctx.user.id)
      .maybeSingle(), "Maritime CV kimlik kilidi okunamadı.");
    const photo = await ownCvIdentity(ctx.user);
    const payload = profile?.profile_payload || {};
    return {
      ok: true,
      cv: payload.manual_cv || null,
      profile_status: profile?.profile_status || "draft",
      completion_percent: profile?.completion_percent || 0,
      updated_at: profile?.updated_at || null,
      profile_photo_url: photo.avatar_url,
      profile_photo_ready: Boolean(photo.avatar_url),
      identity_lock: {
        locked: Boolean(identityLock),
        locked_at: identityLock?.locked_at || null,
        version: identityLock?.identity_version || null,
        fields: identityLock
          ? maritimeIdentityLockedFields.filter((field) => Boolean(lockedCvValue(payload, field)))
          : []
      },
      global_cv_readiness: maritimeGlobalPassportReadiness(payload, { hasPhoto: Boolean(photo.avatar_url) })
    };
  });

  app.post("/v1/maritime/reference-verifications", {
    config: { rateLimit: { max: 20, timeWindow: "10 minutes" } }
  }, async (request, reply) => {
    const ctx = await requireCustomer(request, "maritime.reference_verification.create");
    const input = maritimeReferenceRequestSchema.parse(request.body || {});
    await assertOwnedSeaServiceDocuments(ctx.user.id, [input.experience]);
    const notification = await notifyReference({
      request,
      ctx,
      experience: input.experience,
      candidate: input.candidate,
      cvSummary: input.cv_summary,
      publicId: await maritimePublicId(ctx.user.id)
    });
    reply.code(notification.idempotent ? 200 : 201);
    return {
      ok: true,
      notification: {
        request_id: notification.request_id,
        claim_id: notification.claim_id,
        status: notification.status,
        idempotent: notification.idempotent === true
      }
    };
  });

  app.get("/v1/maritime/partner/reference-center", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } }
  }, async (request) => {
    const { ctx } = await requireMaritimePartner(request, "maritime.partner_reference_center.read", { verifiedOnly: false });
    return { ok: true, ...(await maritimePartnerReferenceCenter(ctx.user.id)) };
  });

  app.post("/v1/maritime/partner/vessels", {
    config: { rateLimit: { max: 10, timeWindow: "1 hour" } }
  }, async (request, reply) => {
    const { ctx, businesses } = await requireMaritimePartner(request, "maritime.partner_vessel.submit");
    const input = maritimePartnerVesselRequestSchema.parse(request.body || {});
    const business = partnerBusinessById(businesses, input.partner_id);
    const imo = normalizeImoNumber(input.imo);
    if (!isValidImoNumber(imo)) throw httpError("Geçerli bir IMO numarası gereklidir.", 400, "MARITIME_IMO_INVALID");
    const existing = assertDb(await supabaseAdmin
      .from("maritime_vessel_profiles")
      .select("id,partner_id,imo_number,vessel_name,vessel_type,flag_state,status,verification_status,verified_at,updated_at")
      .eq("partner_id", business.id)
      .eq("imo_number", imo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(), "Partner gemi kaydı kontrol edilemedi.");
    if (existing) return reply.code(200).send({ ok: true, duplicate: true, vessel: existing });

    const vessel = await lookupVesselByImo(imo);
    const created = assertDb(await supabaseAdmin.from("maritime_vessel_profiles").insert({
      partner_id: business.id,
      imo_number: imo,
      vessel_name: cvText(vessel.vessel_name) || `IMO ${imo}`,
      vessel_type: cvText(vessel.vessel_type) || null,
      flag_state: cvText(vessel.flag) || null,
      status: "pending_review",
      verification_status: "pending_review",
      last_change_summary: "Partner IMO doğrulama talebi",
      metadata: {
        source: "partner_reference_center",
        provider: vessel.provider || null,
        provider_source_url: vessel.provider_source_url || null,
        submitted_by: ctx.user.id
      }
    }).select("id,partner_id,imo_number,vessel_name,vessel_type,flag_state,status,verification_status,verified_at,updated_at").single(), "Partner gemi doğrulama talebi oluşturulamadı.");
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.partner_vessel.submitted",
      resourceType: "maritime_vessel_profile",
      resourceId: created.id,
      metadata: { partner_id: business.id, imo_number: imo }
    });
    return reply.code(201).send({ ok: true, duplicate: false, vessel: created });
  });

  app.post("/v1/admin/maritime/partner-vessels/:vesselId/decision", {
    config: { rateLimit: { max: 30, timeWindow: "1 hour" } }
  }, async (request) => {
    const ctx = await requireIdentitySupportAdmin(request, "maritime.partner_vessel.review");
    const { vesselId } = maritimePartnerVesselDecisionParamsSchema.parse(request.params || {});
    const input = maritimePartnerVesselDecisionSchema.parse(request.body || {});
    const vessel = assertDb(await supabaseAdmin
      .from("maritime_vessel_profiles")
      .select("id,partner_id,imo_number,status,verification_status,metadata")
      .eq("id", vesselId)
      .maybeSingle(), "Partner gemi profili okunamadı.");
    if (!vessel) throw httpError("Partner gemi profili bulunamadı.", 404, "MARITIME_PARTNER_VESSEL_NOT_FOUND");
    const verified = input.decision === "verified";
    const now = new Date().toISOString();
    const updated = assertDb(await supabaseAdmin.from("maritime_vessel_profiles").update({
      status: verified ? "verified" : "changes_requested",
      verification_status: verified ? "verified" : "rejected",
      verified_at: verified ? now : null,
      last_change_summary: input.review_note,
      metadata: {
        ...(vessel.metadata && typeof vessel.metadata === "object" ? vessel.metadata : {}),
        reviewed_by: ctx.user.id,
        reviewed_at: now,
        review_decision: input.decision
      }
    }).eq("id", vessel.id).select("id,partner_id,imo_number,vessel_name,vessel_type,flag_state,status,verification_status,verified_at,updated_at").single(), "Partner gemi kararı kaydedilemedi.");
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: verified ? "maritime.partner_vessel.verified" : "maritime.partner_vessel.rejected",
      resourceType: "maritime_vessel_profile",
      resourceId: vessel.id,
      severity: verified ? "info" : "warning",
      metadata: { partner_id: vessel.partner_id, imo_number: vessel.imo_number, mfa_verified: true }
    });
    return { ok: true, vessel: updated };
  });

  app.post("/v1/maritime/partner/reference-claims/:claimId/review", {
    config: { rateLimit: { max: 60, timeWindow: "1 hour" } }
  }, async (request) => {
    const { ctx, businesses } = await requireMaritimePartner(request, "maritime.partner_reference.review");
    const { claimId } = maritimePartnerReferenceParamsSchema.parse(request.params || {});
    const input = maritimePartnerReferenceReviewSchema.parse(request.body || {});
    const business = partnerBusinessById(businesses, input.partner_id);
    const claim = assertDb(await supabaseAdmin
      .from("maritime_employment_reference_claims")
      .select("id,imo_number,service_start,service_end,status")
      .eq("id", claimId)
      .neq("status", "withdrawn")
      .maybeSingle(), "Referans kaydı okunamadı.");
    if (!claim) throw httpError("İncelenebilir referans kaydı bulunamadı.", 404, "MARITIME_REFERENCE_CLAIM_NOT_FOUND");
    const relationshipRows = assertDb(await supabaseAdmin
      .from("maritime_vessel_company_relationships")
      .select("id,valid_from,valid_until,verification_status")
      .eq("partner_id", business.id)
      .eq("imo_number", normalizeImoNumber(claim.imo_number))
      .in("verification_status", ["registry_verified", "admin_verified"]), "Tarihsel IMO yetkisi doğrulanamadı.") || [];
    const relationship = relationshipRows.find((item) => dateRangesOverlap(claim.service_start, claim.service_end, item.valid_from, item.valid_until));
    if (!relationship) throw httpError("Bu referans için hizmet tarihleriyle örtüşen doğrulanmış şirket-gemi yetkiniz bulunmuyor.", 403, "MARITIME_REFERENCE_HISTORICAL_AUTHORITY_DENIED");
    const now = new Date().toISOString();
    const review = assertDb(await supabaseAdmin.from("maritime_partner_reference_reviews").upsert({
      claim_id: claim.id,
      partner_id: business.id,
      reviewer_user_id: ctx.user.id,
      decision: input.decision,
      review_note: input.review_note || null,
      reviewed_at: now
    }, { onConflict: "claim_id,partner_id" }).select("claim_id,partner_id,decision,review_note,reviewed_at").single(), "Referans kararı kaydedilemedi.");
    assertDb(await supabaseAdmin.from("maritime_employment_reference_claims").update({
      status: "partner_reviewed",
      first_matched_at: now,
      last_partner_review_at: now
    }).eq("id", claim.id), "Referans doğrulama durumu güncellenemedi.");
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.partner_reference.reviewed",
      resourceType: "maritime_employment_reference_claim",
      resourceId: claim.id,
      severity: input.decision === "denied" ? "warning" : "info",
      metadata: { partner_id: business.id, imo_number: claim.imo_number, relationship_id: relationship.id, decision: input.decision }
    });
    return { ok: true, review: partnerReviewPublic(review) };
  });

  app.put("/v1/maritime/cv-profile/draft", {
    config: { rateLimit: { max: 40, timeWindow: "10 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.cv_profile.draft_save");
    const deviceKey = requestDeviceKey(request);
    const input = manualCvDraftRequestSchema.parse(request.body || {});
    const [currentProfile, currentIdentityLock] = await Promise.all([
      supabaseAdmin
        .from("maritime_cv_profiles")
        .select("profile_payload")
        .eq("seafarer_user_id", ctx.user.id)
        .maybeSingle(),
      supabaseAdmin
        .from("maritime_cv_identity_locks")
        .select("locked_at,identity_version")
        .eq("user_id", ctx.user.id)
        .maybeSingle()
    ]);
    const savedProfile = assertDb(currentProfile, "Mevcut Maritime CV taslağı okunamadı.");
    const savedIdentityLock = assertDb(currentIdentityLock, "Maritime CV kimlik kilidi okunamadı.");
    enforceSavedPersonalDetails(savedIdentityLock, savedProfile, input.cv);
    await assertOwnedSeaServiceDocuments(ctx.user.id, input.cv.seaData);
    const payload = manualCvPayload(input.cv);
    const photoReady = await hasStoredProfilePhoto(ctx.user.id);
    const readiness = maritimeGlobalPassportReadiness(payload, { hasPhoto: photoReady });
    const profile = assertIdentitySecurity(await supabaseAdmin.rpc("save_maritime_cv_draft", {
      p_user_id: ctx.user.id,
      p_profile_payload: payload,
      p_completion_percent: manualCvCompletion(payload),
      p_device_key: deviceKey,
      p_user_agent: String(request.headers["user-agent"] || "").slice(0, 500)
    }), "Maritime CV taslağı güvenli biçimde kaydedilemedi.");
    const persistedIdentityLock = assertDb(await supabaseAdmin
      .from("maritime_cv_identity_locks")
      .select("locked_at,identity_version")
      .eq("user_id", ctx.user.id)
      .maybeSingle(), "Maritime CV kimlik kilidi yeniden okunamadı.");
    await invalidateMaritimeCvDerivedState(ctx.user.id);
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.cv_profile_draft_saved",
      resourceType: "maritime_cv_profile",
      metadata: { source: "user_entered_maritime_cv", completion_percent: profile.completion_percent, ready_for_global_cv: readiness.ready }
    });
    return {
      ok: true,
      cv: input.cv,
      profile,
      profile_photo_ready: photoReady,
      global_cv_readiness: readiness,
      identity_lock: {
        locked: Boolean(persistedIdentityLock),
        locked_at: persistedIdentityLock?.locked_at || null,
        version: persistedIdentityLock?.identity_version || null,
        fields: persistedIdentityLock ? maritimeIdentityLockedFields : []
      }
    };
  });

  app.put("/v1/maritime/cv-profile", {
    config: { rateLimit: { max: 20, timeWindow: "10 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.cv_profile.save");
    const deviceKey = requestDeviceKey(request);
    const input = manualCvRequestSchema.parse(request.body || {});
    const [currentProfile, currentIdentityLock] = await Promise.all([
      supabaseAdmin
        .from("maritime_cv_profiles")
        .select("profile_payload")
        .eq("seafarer_user_id", ctx.user.id)
        .maybeSingle(),
      supabaseAdmin
        .from("maritime_cv_identity_locks")
        .select("locked_at,identity_version")
        .eq("user_id", ctx.user.id)
        .maybeSingle()
    ]);
    const savedProfile = assertDb(currentProfile, "Mevcut Maritime CV kaydı okunamadı.");
    const savedIdentityLock = assertDb(currentIdentityLock, "Maritime CV kimlik kilidi okunamadı.");
    enforceSavedPersonalDetails(savedIdentityLock, savedProfile, input.cv);
    await assertOwnedSeaServiceDocuments(ctx.user.id, input.cv.seaData);
    const payload = manualCvPayload(input.cv);
    const cvReadiness = maritimeGlobalPassportReadiness(payload, {
      hasPhoto: await hasStoredProfilePhoto(ctx.user.id)
    });
    if (!cvReadiness.ready) {
      throw httpError(`Maritime CV için zorunlu alanlar eksik: ${cvReadiness.missing.join(", ")}.`, 409, "MARITIME_CV_REQUIRED_FIELDS_MISSING");
    }
    await requireMaritimePasskeyProof(request, ctx.user.id);
    const now = new Date().toISOString();
    const profile = assertIdentitySecurity(await supabaseAdmin.rpc("save_locked_maritime_cv_profile", {
      p_user_id: ctx.user.id,
      p_profile_payload: payload,
      p_completion_percent: manualCvCompletion(payload),
      p_device_key: deviceKey,
      p_user_agent: String(request.headers["user-agent"] || "").slice(0, 500)
    }), "Maritime CV güvenli biçimde kaydedilemedi.");
    const identityLock = assertDb(await supabaseAdmin
      .from("maritime_cv_identity_locks")
      .select("locked_at,identity_version")
      .eq("user_id", ctx.user.id)
      .maybeSingle(), "Maritime CV kimlik kilidi okunamadı.");
    await invalidateMaritimeCvDerivedState(ctx.user.id, now);
    const storedProfile = assertDb(await supabaseAdmin
      .from("maritime_cv_profiles")
      .select("profile_payload,profile_status,completion_percent,last_user_confirmed_at,updated_at")
      .eq("seafarer_user_id", ctx.user.id)
      .maybeSingle(), "Kaydedilen Maritime CV yeniden doğrulanamadı.");
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.cv_profile_saved",
      resourceType: "maritime_cv_profile",
      metadata: { source: "user_entered_maritime_cv", completion_percent: profile.completion_percent }
    });
    const referenceNotifications = [];
    const publicId = await maritimePublicId(ctx.user.id);
    for (const experience of input.cv.seaData.filter((row) => row.saved === "true")) {
      try {
        referenceNotifications.push(await notifyReference({
          request,
          ctx,
          experience,
          candidate: {
            first_name: input.cv.fields.firstName,
            middle_name: input.cv.fields.fatherName || "",
            family_name: input.cv.fields.familyName
          },
          cvSummary: referenceSummaryFromCv(input.cv),
          publicId
        }));
      } catch (error) {
        request.log.warn({
          code: "MARITIME_REFERENCE_NOTIFICATION_RETRY_REQUIRED",
          experienceId: experience.rowId,
          errorCode: error?.code || "REFERENCE_NOTIFICATION_FAILED"
        }, "Maritime reference notification could not be queued after CV save");
        referenceNotifications.push({ status: "failed", experience_id: experience.rowId });
      }
    }
    return {
      ok: true,
      cv: storedProfile?.profile_payload?.manual_cv || input.cv,
      profile: storedProfile || profile,
      global_cv_readiness: maritimeGlobalPassportReadiness(storedProfile?.profile_payload || payload, { hasPhoto: true }),
      reference_notifications: referenceNotifications.map((item) => ({
        request_id: item.request_id || null,
        claim_id: item.claim_id || null,
        status: item.status,
        idempotent: item.idempotent === true
      })),
      identity_lock: {
        locked: Boolean(identityLock),
        locked_at: identityLock?.locked_at || profile.last_user_confirmed_at || now,
        version: identityLock?.identity_version || null,
        fields: identityLock ? maritimeIdentityLockedFields : []
      }
    };
  });

  app.post("/v1/maritime/cv-profile/identity-change-request", {
    config: { rateLimit: { max: 3, timeWindow: "24 hours" } }
  }, async (request, reply) => {
    const ctx = await requireCustomer(request, "maritime.cv_profile.identity_change_request");
    const deviceKey = requestDeviceKey(request);
    const deviceAccess = assertIdentitySecurity(await supabaseAdmin.rpc("maritime_check_device_access", {
      p_user_id: ctx.user.id,
      p_device_key: deviceKey
    }), "Cihaz erişimi doğrulanamadı.");
    if (deviceAccess.allowed !== true) throw identitySecurityError(deviceAccess.code);
    const input = identitySupportRequestSchema.parse(request.body || {});
    const identityLock = assertDb(await supabaseAdmin
      .from("maritime_cv_identity_locks")
      .select("locked_at")
      .eq("user_id", ctx.user.id)
      .maybeSingle(), "Maritime CV kimlik kilidi doğrulanamadı.");
    if (!identityLock) {
      throw httpError("Henüz kilitlenmiş bir Maritime CV kimliği bulunmuyor.", 409, "MARITIME_IDENTITY_NOT_LOCKED");
    }

    const existing = assertDb(await supabaseAdmin
      .from("support_tickets")
      .select("id,status,created_at")
      .eq("user_id", ctx.user.id)
      .eq("category", "maritime_identity_change")
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(), "Kimlik değişikliği destek kaydı kontrol edilemedi.");
    if (existing) return reply.code(200).send({ ok: true, ticket: existing, already_open: true });

    const ticket = assertDb(await supabaseAdmin.from("support_tickets").insert({
      user_id: ctx.user.id,
      requester_type: "user",
      category: "maritime_identity_change",
      priority: "high",
      title: "Maritime CV kişisel bilgi değişikliği",
      message: input.message,
      status: "open",
      metadata: {
        source: "maritime_cv_identity_lock",
        identity_locked_at: identityLock.locked_at,
        requested_fields: maritimeIdentityLockedFields
      }
    }).select("id,status,created_at").single(), "Kimlik değişikliği destek kaydı oluşturulamadı.");

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.cv_identity_change_requested",
      resourceType: "support_ticket",
      resourceId: ticket.id,
      severity: "warning",
      metadata: { identity_locked_at: identityLock.locked_at }
    });
    return reply.code(201).send({ ok: true, ticket, already_open: false });
  });

  app.post("/v1/admin/maritime/cv-identity-corrections/:ticketId/approve", {
    config: { rateLimit: { max: 10, timeWindow: "1 hour" } }
  }, async (request) => {
    const ctx = await requireIdentitySupportAdmin(request, "maritime.cv_identity_support.approve");
    const { ticketId } = identityCorrectionParamsSchema.parse(request.params || {});
    const input = identityCorrectionApprovalSchema.parse(request.body || {});
    const ticket = assertDb(await supabaseAdmin
      .from("support_tickets")
      .select("id,user_id,category,status,assigned_admin_id,metadata")
      .eq("id", ticketId)
      .maybeSingle(), "Kimlik düzeltme destek kaydı okunamadı.");
    if (!ticket || ticket.category !== "maritime_identity_change" || !ticket.user_id) {
      throw httpError("Geçerli bir Maritime CV kimlik düzeltme talebi bulunamadı.", 404, "MARITIME_IDENTITY_SUPPORT_CASE_REQUIRED");
    }
    if (!["open", "in_progress"].includes(ticket.status)) {
      throw httpError("Bu kimlik düzeltme talebi artık işlem için açık değildir.", 409, "MARITIME_IDENTITY_SUPPORT_CASE_CLOSED");
    }
    if (ticket.assigned_admin_id && ticket.assigned_admin_id !== ctx.user.id) {
      throw httpError("Bu talep başka bir yetkiliye atanmıştır.", 409, "MARITIME_IDENTITY_SUPPORT_CASE_ASSIGNED");
    }

    const claimedTicket = assertDb(await supabaseAdmin
      .from("support_tickets")
      .update({
        status: "in_progress",
        assigned_admin_id: ctx.user.id,
        metadata: {
          ...(ticket.metadata && typeof ticket.metadata === "object" ? ticket.metadata : {}),
          identity_review_claimed_at: new Date().toISOString(),
          identity_review_claimed_by: ctx.user.id
        }
      })
      .eq("id", ticket.id)
      .in("status", ["open", "in_progress"])
      .or(`assigned_admin_id.is.null,assigned_admin_id.eq.${ctx.user.id}`)
      .select("id,user_id,status,assigned_admin_id")
      .single(), "Kimlik düzeltme talebi güvenli incelemeye alınamadı.");
    if (claimedTicket.assigned_admin_id !== ctx.user.id) {
      throw httpError("Kimlik düzeltme talebi yetkiliye atanamadı.", 409, "MARITIME_IDENTITY_SUPPORT_CASE_ASSIGNED");
    }

    const correction = assertIdentitySecurity(await supabaseAdmin.rpc("support_replace_maritime_cv_identity", {
      p_user_id: claimedTicket.user_id,
      p_new_identity: input.identity,
      p_ticket_id: claimedTicket.id,
      p_approved_by: ctx.user.id
    }), "Kimlik düzeltmesi güvenli biçimde tamamlanamadı.");
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.cv_identity_changed_by_support",
      resourceType: "maritime_cv_identity",
      resourceId: claimedTicket.user_id,
      severity: "critical",
      metadata: { ticket_id: claimedTicket.id, mfa_verified: true }
    });
    return { ok: true, correction };
  });

  app.get("/v1/maritime/smart-account", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.smart_account.read");
    return { ok: true, ...(await latestSmartState(ctx.user.id, ctx.user)) };
  });

  app.get("/v1/maritime/candidate-matches", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.candidate_matches.read");
    const input = await smartInputs(ctx.user.id);
    if (!input.cvProfile || input.cvProfile.profile_payload?.data_origin !== "user_entered_maritime_cv" ||
        ["restricted", "stale"].includes(input.cvProfile.profile_status)) {
      return { ok: true, matches: [] };
    }
    const jobs = await verifiedOpenJobs();
    const snapshot = buildMaritimeSmartProfile(input);
    const matches = matchMaritimeJobs(snapshot, jobs).filter((match) => match.rank_compatible === true)
      .map((match) => ({ job_id: match.job_id, rank_compatible: true, eligible: match.eligible === true,
        hard_gate_status: match.hard_gate_status }));
    return { ok: true, matches };
  });

  app.post("/v1/maritime/smart-account/refresh-matches", {
    config: { rateLimit: { max: 12, timeWindow: "10 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.smart_account.refresh_matches");
    const run = assertDb(await supabaseAdmin.from("maritime_smart_account_runs")
      .select("id,status,input_snapshot_hash")
      .eq("seafarer_user_id", ctx.user.id)
      .eq("status", "user_confirmed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(), "Onaylı Global CV okunamadı.");
    if (!run) throw httpError("Önce Global CV'nizi onaylayın.", 409, "GLOBAL_CV_CONFIRMATION_REQUIRED");
    const input = await smartInputs(ctx.user.id);
    if (!input.cvProfile || input.cvProfile.profile_payload?.data_origin !== "user_entered_maritime_cv"
        || ["restricted", "stale"].includes(input.cvProfile.profile_status)) {
      throw httpError("Maritime CV güncel değil.", 409, "MARITIME_CV_UNAVAILABLE");
    }
    const jobs = await verifiedOpenJobs();
    const snapshot = buildMaritimeSmartProfile(input);
    const hash = maritimeSmartSnapshotHash({
      matching_source_version: "maritime-cv-v1",
      profile: snapshot,
      jobs: jobs.map((job) => ({ id: job.id, job_version: job.job_version, updated_at: job.updated_at }))
    });
    const currentMatches = assertDb(await supabaseAdmin.from("maritime_match_results")
      .select("job_id,stale_after,hard_gate_status")
      .eq("smart_account_run_id", run.id)
      .neq("hard_gate_status", "stale"), "Mevcut eşleşmeler okunamadı.") || [];
    const jobIds = new Set(jobs.map((job) => job.id));
    const fresh = currentMatches.length === jobs.length && currentMatches.every((match) =>
      jobIds.has(match.job_id) && match.hard_gate_status !== "stale" && Date.parse(match.stale_after || "") > Date.now());
    if (run.input_snapshot_hash !== hash || !fresh) {
      const matches = matchMaritimeJobs(snapshot, jobs);
      assertDb(await supabaseAdmin.rpc("refresh_confirmed_maritime_matches", {
        p_user_id: ctx.user.id,
        p_run_id: run.id,
        p_input_snapshot_hash: hash,
        p_rule_version: MARITIME_SMART_RULE_VERSION,
        p_smart_snapshot: snapshot,
        p_matches: matches
      }), "İlan eşleşmeleri güncellenemedi.");
    }
    return { ok: true, ...(await latestSmartState(ctx.user.id, ctx.user)) };
  });

  app.get("/v1/maritime/auto-apply", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.auto_apply.read");
    return { ok: true, preference: await maritimeAutoApplyPreference(ctx.user.id) };
  });

  app.post("/v1/maritime/auto-apply", {
    config: { rateLimit: { max: 8, timeWindow: "10 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.auto_apply.update");
    const input = autoApplyPreferenceSchema.parse(request.body || {});
    await requireMaritimePasskeyProof(request, ctx.user.id);
    const result = assertDb(await ctx.db.rpc("set_maritime_auto_apply_preference", {
      p_enabled: input.enabled,
      p_confirmation: true
    }), "Otomatik başvuru tercihi kaydedilemedi.");
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: input.enabled ? "maritime.auto_apply_enabled" : "maritime.auto_apply_disabled",
      resourceType: "maritime_auto_apply_preference",
      resourceId: ctx.user.id,
      metadata: { submitted_count: Number(result?.submitted_count) || 0 }
    });
    return { ok: true, preference: await maritimeAutoApplyPreference(ctx.user.id) };
  });

  app.post("/v1/maritime/smart-account/prepare", {
    config: { rateLimit: { max: 8, timeWindow: "10 minutes" } }
  }, async (request, reply) => {
    const ctx = await requireCustomer(request, "maritime.smart_account.prepare");
    const input = await smartInputs(ctx.user.id);
    if (!input.cvProfile || input.cvProfile.profile_payload?.data_origin !== "user_entered_maritime_cv") {
      throw httpError("Global CV için önce Maritime CV'nizi doldurup kaydedin.", 409, "MARITIME_CV_REQUIRED");
    }
    if (["restricted", "stale"].includes(input.cvProfile.profile_status)) {
      throw httpError("Maritime CV'niz kısıtlı veya güncel değil. Destek ekibiyle iletişime geçin.", 409, "MARITIME_CV_UNAVAILABLE");
    }
    const passportReadiness = maritimeGlobalPassportReadiness(input.cvProfile.profile_payload || {}, {
      hasPhoto: await hasStoredProfilePhoto(ctx.user.id)
    });
    if (!passportReadiness.ready) {
      throw httpError(`Global CV için zorunlu alanlar eksik: ${passportReadiness.missing.join(", ")}.`, 409, "GLOBAL_CV_REQUIRED_FIELDS_MISSING");
    }
    const jobs = await verifiedOpenJobs();
    const smartSnapshot = buildMaritimeSmartProfile(input);
    const matches = matchMaritimeJobs(smartSnapshot, jobs);
    const inputHash = maritimeSmartSnapshotHash({
      matching_source_version: "maritime-cv-v1",
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
    await requireMaritimePasskeyProof(request, ctx.user.id);
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
    await requireMaritimePasskeyProof(request, ctx.user.id);
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
    const savedCv = assertDb(await supabaseAdmin
      .from("maritime_cv_profiles")
      .select("profile_payload")
      .eq("seafarer_user_id", ctx.user.id)
      .maybeSingle(), "Maritime CV kaydı okunamadı.");
    const cvReadiness = maritimeGlobalPassportReadiness(savedCv?.profile_payload || {}, {
      hasPhoto: await hasStoredProfilePhoto(ctx.user.id)
    });
    if (!cvReadiness.ready) {
      throw httpError(`Başvurmak için Maritime CV zorunlu alanlarını tamamlayın: ${cvReadiness.missing.join(", ")}.`, 409, "MARITIME_CV_REQUIRED_FIELDS_MISSING");
    }
    await requireMaritimePasskeyProof(request, ctx.user.id);
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
