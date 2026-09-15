import { z } from "zod";
import { MARITIME_PROFILE_PHOTO_BUCKET, maritimeGlobalPassportReadiness } from "../lib/maritime-document-doctor.js";
import {
  MARITIME_SMART_RULE_VERSION,
  buildMaritimeSmartProfile,
  maritimeSmartSnapshotHash,
  matchMaritimeJobs
} from "../lib/maritime-smart-profile.js";
import { ensureMaritimeCustomerProfile } from "../lib/maritime-customer-profile.js";
import { requireMaritimePasskeyProof } from "../lib/maritime-passkey.js";
import { isValidImoNumber, normalizeImoNumber } from "../lib/maritime-vessel-provider.js";
import { auditEvent, authContext, hasMfa, hasRole, supabaseAdmin } from "../lib/supabase.js";

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
const manualCvFieldKeys = new Set([
  "position", "familyName", "firstName", "fatherName", "birth", "birthDate", "birthPlace", "nationality", "gender", "marital", "address", "airport",
  "height", "weight", "eyes", "hair", "shoes", "overall", "mobile", "email", "kinName", "kinPhone", "kinRelation", "kinAddress",
  "passportDoc", "passportNo", "passportCountry", "passportPlace", "passportIssued", "passportValid", "windows", "office", "internet",
  "seamanBookNo", "seamanBookPlace", "seamanBookIssued", "seamanBookValid", "seafarerIdNo", "seafarerIdPlace", "seafarerIdIssued", "seafarerIdValid",
  "schoolName", "schoolPlace", "schoolGrade", "schoolFrom", "schoolTo", "azSpeak", "azRead", "azWrite", "trSpeak", "trRead", "trWrite",
  "enSpeak", "enRead", "enWrite", "ruSpeak", "ruRead", "ruWrite", "medicalDoc", "medicalFitness", "medicalGrade", "medicalPlace", "medicalIssue", "medicalExpiry",
  "competencyClass", "competencyCountry", "competencyCertificate", "competencyIssued", "competencyExpires", "competencyLimit", "note"
]);
const manualCvRowKeys = {
  additional: new Set(["name", "institute", "place", "issue", "cert", "expiry"]),
  stcw: new Set(["presetId", "code", "name", "institute", "place", "issue", "rank", "cert", "number", "expiry", "unlimited", "included"]),
  sea: new Set([
    "imo", "vessel", "company", "type", "flag", "dwt", "grt", "netTonnage", "buildYear", "mmsi", "callSign", "lengthOverall",
    "rank", "signon", "signoff", "referenceName", "referenceCompanyEmail", "referenceCompanyPhone", "referencePhone", "lookupProvider", "lookupFetchedAt"
  ])
};
function restrictedStringRecord(allowedKeys, maxLength) {
  return z.record(z.string().max(maxLength)).superRefine((value, context) => {
    for (const key of Object.keys(value)) {
      if (!allowedKeys.has(key)) context.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: "Desteklenmeyen CV alanı." });
    }
  });
}
const manualCvSchema = z.object({
  lang: z.enum(["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"]).default("tr"),
  summaryMode: z.enum(["auto", "custom"]).default("auto"),
  fields: restrictedStringRecord(manualCvFieldKeys, 2000),
  additionalData: z.array(restrictedStringRecord(manualCvRowKeys.additional, 300)).max(50).default([]),
  stcwData: z.array(restrictedStringRecord(manualCvRowKeys.stcw, 300)).max(50).default([]),
  seaData: z.array(restrictedStringRecord(manualCvRowKeys.sea, 300)).max(50).default([])
}).strict().superRefine((value, context) => {
  value.seaData.forEach((row, index) => {
    const contentKeys = [...manualCvRowKeys.sea].filter((key) => !["lookupProvider", "lookupFetchedAt"].includes(key));
    if (!contentKeys.some((key) => String(row[key] || "").trim())) return;
    const required = ["imo", "vessel", "company", "type", "flag", "rank", "signon", "signoff", "referenceName", "referenceCompanyEmail", "referenceCompanyPhone", "referencePhone"];
    required.forEach((key) => {
      if (!String(row[key] || "").trim()) context.addIssue({ code: z.ZodIssueCode.custom, path: ["seaData", index, key], message: "Deniz hizmeti referans alanı zorunludur." });
    });
    if (row.imo && !isValidImoNumber(row.imo)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["seaData", index, "imo"], message: "Geçerli bir IMO numarası gereklidir." });
    if (row.referenceCompanyEmail && !z.string().email().safeParse(row.referenceCompanyEmail).success) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["seaData", index, "referenceCompanyEmail"], message: "Geçerli şirket e-postası gereklidir." });
    }
  });
});
const manualCvRequestSchema = z.object({ cv: manualCvSchema, confirmation: z.literal(true) }).strict();
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
  "firstName", "familyName", "fatherName", "birthDate", "birthPlace", "nationality", "gender"
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
  sa: Object.freeze({ code: "SA", tr: "Kimyasal Tanker Sertifikası (SA)", az: "Kimyəvi Tanker Sertifikatı (SA)", en: "Chemical Tanker Certificate (SA)", ru: "Сертификат химического танкера (SA)" }),
  se: Object.freeze({ code: "SE", tr: "SE Kodlu STCW Sertifikası", az: "SE Kodlu STCW Sertifikatı", en: "STCW Certificate (SE)", ru: "Сертификат STCW с кодом SE" })
});

function manualStcwTitle(row, language) {
  const preset = manualStcwPresets[cvText(row.presetId).toLowerCase()];
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
  const skills = [fields.windows, fields.office, fields.internet].map(cvText).filter(Boolean).map((name) => ({ name, category: "digital", confidence: 1 }));
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
        fields: identityLock ? maritimeIdentityLockedFields : []
      },
      global_cv_readiness: maritimeGlobalPassportReadiness(payload, { hasPhoto: Boolean(photo.avatar_url) })
    };
  });

  app.put("/v1/maritime/cv-profile", {
    config: { rateLimit: { max: 20, timeWindow: "10 minutes" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.cv_profile.save");
    const deviceKey = requestDeviceKey(request);
    const input = manualCvRequestSchema.parse(request.body || {});
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
    assertDb(await supabaseAdmin.from("maritime_smart_account_runs")
      .update({ status: "superseded" })
      .eq("seafarer_user_id", ctx.user.id)
      .in("status", ["draft", "user_confirmed"]), "Eski Global CV taslağı kapatılamadı.");
    assertDb(await supabaseAdmin.from("maritime_match_results")
      .update({ hard_gate_status: "stale", stale_after: now })
      .eq("seafarer_user_id", ctx.user.id)
      .neq("hard_gate_status", "stale"), "Eski iş eşleşmeleri kapatılamadı.");
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.cv_profile_saved",
      resourceType: "maritime_cv_profile",
      metadata: { source: "user_entered_maritime_cv", completion_percent: profile.completion_percent }
    });
    return {
      ok: true,
      cv: input.cv,
      profile,
      identity_lock: {
        locked: true,
        locked_at: profile.last_user_confirmed_at || now,
        version: "maritime-identity-v1",
        fields: maritimeIdentityLockedFields
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

  app.post("/v1/maritime/smart-account/prepare", {
    config: { rateLimit: { max: 8, timeWindow: "10 minutes" } }
  }, async (request, reply) => {
    const ctx = await requireCustomer(request, "maritime.smart_account.prepare");
    const input = await smartInputs(ctx.user.id);
    if (!input.cvProfile || input.cvProfile.profile_payload?.data_origin !== "user_entered_maritime_cv") {
      throw httpError("Global CV için önce Maritime CV'nizi doldurup kaydedin.", 409, "MARITIME_CV_REQUIRED");
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
