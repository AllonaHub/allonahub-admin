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

export const MARIPARTNER_REFERENCE_CATEGORIES = Object.freeze([
  "professional_competence",
  "safety_awareness",
  "rule_compliance",
  "teamwork",
  "communication",
  "reliability",
  "punctuality",
  "problem_solving",
  "leadership",
  "technical_knowledge",
  "equipment_care",
  "watchkeeping",
  "stress_management",
  "adaptability",
  "rehire_willingness"
]);

export const MARIPARTNER_REFERENCE_QUESTIONS = Object.freeze([
  "employment_confirmed",
  "rank_confirmed",
  "service_dates_confirmed",
  "completed_contract",
  "eligible_for_rehire"
]);

export const MARIPARTNER_JOB_RANKS = Object.freeze({
  master: "Kaptan",
  chief_officer: "Baş Zabit",
  second_officer: "İkinci Zabit",
  third_officer: "Üçüncü Zabit",
  chief_engineer: "Baş Mühendis",
  second_engineer: "İkinci Mühendis",
  third_engineer: "Üçüncü Mühendis",
  oiler: "Yağcı / Motorman",
  able_seaman: "Usta Gemici",
  ordinary_seaman: "Gemici",
  cook: "Aşçı",
  electrician: "Elektrik Zabiti"
});

export const MARIPARTNER_TRADING_AREAS = Object.freeze({
  worldwide: "Dünya geneli",
  mediterranean: "Akdeniz",
  black_sea: "Karadeniz",
  north_sea_baltic: "Kuzey Denizi ve Baltık",
  north_atlantic: "Kuzey Atlantik",
  south_atlantic: "Güney Atlantik",
  red_sea_gulf_of_aden: "Kızıldeniz ve Aden Körfezi",
  arabian_gulf_indian_ocean: "Basra Körfezi ve Hint Okyanusu",
  west_africa_gulf_of_guinea: "Batı Afrika ve Gine Körfezi",
  east_africa: "Doğu Afrika",
  southeast_asia: "Güneydoğu Asya",
  east_asia: "Doğu Asya",
  australia_pacific: "Avustralya ve Pasifik",
  north_america: "Kuzey Amerika",
  central_south_america_caribbean: "Orta/Güney Amerika ve Karayipler",
  domestic_coastal: "Kabotaj / kıyı seferi",
  other: "Diğer rota"
});

export const MARIPARTNER_WAR_RISK_STATUSES = Object.freeze({
  no_known_listed_area: "Beyan edilen rotada bilinen listelenmiş risk bölgesi yok",
  listed_area_planned: "Listelenmiş veya yüksek riskli bölge geçişi planlanıyor",
  route_under_review: "Rota ve risk değerlendirmesi henüz kesinleşmedi"
});

export const MARIPARTNER_JOB_CERTIFICATE_CODES = Object.freeze([
  "SP", "SH", "SI", "SL", "SO", "SA",
  "II/1", "II/2", "II/4", "II/5",
  "III/1", "III/2", "III/4", "III/6",
  "IV/2", "V/1-1", "V/1-2", "V/2",
  "SHIP-COOK", "ADVANCED-DP"
]);

export const MARIPARTNER_RANK_CERTIFICATE_CODES = Object.freeze({
  master: "II/2",
  chief_officer: "II/2",
  second_officer: "II/1",
  third_officer: "II/1",
  chief_engineer: "III/2",
  second_engineer: "III/2",
  third_engineer: "III/1",
  oiler: "III/4",
  able_seaman: "II/5",
  ordinary_seaman: "II/4",
  cook: "SHIP-COOK",
  electrician: "III/6"
});

function compactJobText(value, maxLength = 160) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function buildMariPartnerJobPresentation(input, vessel) {
  const rankLabel = MARIPARTNER_JOB_RANKS[input?.rank_code] || compactJobText(input?.rank_code, 80) || "Denizci";
  const tradingAreaLabel = MARIPARTNER_TRADING_AREAS[input?.trading_area] || "Belirtilen rota";
  const warRiskLabel = MARIPARTNER_WAR_RISK_STATUSES[input?.war_risk_status] || MARIPARTNER_WAR_RISK_STATUSES.route_under_review;
  const months = Math.max(0, Math.trunc(Number(input?.minimum_sea_service_months) || 0));
  const amount = Number(input?.salary_amount);
  const salary = Number.isFinite(amount) ? `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount)} ${input?.salary_currency || ""}`.trim() : "";
  const vesselType = compactJobText(vessel?.vessel_type, 120) || "Deniz ticaret gemisi";
  const experience = months ? `en az ${months} ay deniz hizmeti` : "deniz hizmeti için başlangıç seviyesi kabul edilebilir";
  const route = [compactJobText(input?.joining_port, 120), tradingAreaLabel].filter(Boolean).join(" / ");
  const summary = `${vesselType} tipi gemide ${rankLabel} pozisyonu; ${experience}. ${compactJobText(input?.joining_date, 10)} tarihinde ${compactJobText(input?.joining_port, 120)} limanından katılım. Çalışma bölgesi: ${tradingAreaLabel}.`;
  const metadata = vessel?.metadata && typeof vessel.metadata === "object" ? vessel.metadata : {};
  return {
    title: rankLabel,
    summary: compactJobText(summary, 360),
    location_label: compactJobText(route, 120),
    detail_label: compactJobText([input?.contract_label, salary].filter(Boolean).join(" · "), 120),
    minimum_sea_service_days: months * 30,
    public_vessel: {
      vessel_type: vesselType,
      flag_state: compactJobText(vessel?.flag_state, 80) || null,
      gross_tonnage: Number.isFinite(Number(metadata.gross_tonnage)) ? Number(metadata.gross_tonnage) : null,
      deadweight: Number.isFinite(Number(metadata.deadweight)) ? Number(metadata.deadweight) : null,
      year_built: Number.isFinite(Number(metadata.year_built)) ? Number(metadata.year_built) : null
    },
    route: {
      current_port: compactJobText(input?.current_port, 120),
      current_position_source: "company_confirmed",
      joining_port: compactJobText(input?.joining_port, 120),
      next_port: compactJobText(input?.next_port, 120),
      trading_area: input?.trading_area,
      trading_area_label: tradingAreaLabel,
      war_risk_status: input?.war_risk_status,
      war_risk_label: warRiskLabel,
      war_risk_note: compactJobText(input?.war_risk_note, 240) || null
    }
  };
}

export function normalizeImo(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return /^\d{7}$/.test(digits) ? digits : null;
}

export function dateRangesOverlap(leftStart, leftEnd, rightStart, rightEnd) {
  const min = new Date("1900-01-01T00:00:00.000Z").getTime();
  const max = new Date("2999-12-31T23:59:59.999Z").getTime();
  const startA = leftStart ? new Date(leftStart).getTime() : min;
  const endA = leftEnd ? new Date(leftEnd).getTime() : max;
  const startB = rightStart ? new Date(rightStart).getTime() : min;
  const endB = rightEnd ? new Date(rightEnd).getTime() : max;
  return [startA, endA, startB, endB].every(Number.isFinite) && startA <= endB && startB <= endA;
}

export function historicalEmploymentMatch(claim, relationships = []) {
  const imo = normalizeImo(claim?.imo_number);
  if (!imo) return { level: "rejected", confidence: 0, reason_codes: ["IMO_INVALID"] };
  const candidates = relationships.filter((item) => normalizeImo(item.imo_number) === imo);
  if (!candidates.length) return { level: "possible_match", confidence: 35, reason_codes: ["IMO_ONLY_UNVERIFIED"] };
  const overlap = candidates.find((item) => dateRangesOverlap(claim?.service_start, claim?.service_end, item.valid_from, item.valid_until));
  if (!overlap) return { level: "conflict", confidence: 78, reason_codes: ["IMO_MATCH_DATE_CONFLICT"] };
  const sourceVerified = ["registry_verified", "admin_verified"].includes(overlap.verification_status);
  const companyAligned = !claim?.source_company_name || !overlap.company_name
    || String(claim.source_company_name).localeCompare(String(overlap.company_name), undefined, { sensitivity: "base" }) === 0;
  if (sourceVerified && companyAligned) return { level: "exact_verified", confidence: 98, reason_codes: ["IMO_DATE_COMPANY_VERIFIED"], relationship_id: overlap.id };
  if (sourceVerified) return { level: "strong_match", confidence: 88, reason_codes: ["IMO_DATE_VERIFIED", "COMPANY_NAME_VARIANT"], relationship_id: overlap.id };
  return { level: "strong_match", confidence: 72, reason_codes: ["IMO_DATE_PARTNER_ASSERTED"], relationship_id: overlap.id };
}

export function validateEmployerReferencePayload(input) {
  const ratings = Array.isArray(input?.ratings) ? input.ratings : [];
  const answers = Array.isArray(input?.answers) ? input.answers : [];
  const ratingMap = new Map();
  ratings.forEach((item) => {
    if (!MARIPARTNER_REFERENCE_CATEGORIES.includes(item?.category_key)) throw httpError("Geçersiz referans değerlendirme kategorisi.", 400, "REFERENCE_CATEGORY_INVALID");
    if (item.not_applicable === true) ratingMap.set(item.category_key, { category_key: item.category_key, score: null, not_applicable: true });
    else {
      const score = Number(item.score);
      if (!Number.isInteger(score) || score < 1 || score > 10) throw httpError("Referans puanları 1 ile 10 arasında olmalıdır.", 400, "REFERENCE_SCORE_INVALID");
      ratingMap.set(item.category_key, { category_key: item.category_key, score, not_applicable: false });
    }
  });
  if (ratingMap.size !== MARIPARTNER_REFERENCE_CATEGORIES.length) throw httpError("Tüm referans kategorilerini puanlayın veya uygulanamaz olarak işaretleyin.", 400, "REFERENCE_CATEGORIES_INCOMPLETE");
  const answerMap = new Map();
  answers.forEach((item) => {
    if (!MARIPARTNER_REFERENCE_QUESTIONS.includes(item?.question_key)) throw httpError("Geçersiz referans sorusu.", 400, "REFERENCE_QUESTION_INVALID");
    if (!["yes", "no", "unknown"].includes(item?.answer)) throw httpError("Referans sorularını evet, hayır veya bilinmiyor olarak yanıtlayın.", 400, "REFERENCE_ANSWER_INVALID");
    answerMap.set(item.question_key, { question_key: item.question_key, answer: item.answer, note: String(item.note || "").trim().slice(0, 500) || null });
  });
  if (answerMap.size !== MARIPARTNER_REFERENCE_QUESTIONS.length) throw httpError("Tüm zorunlu referans sorularını yanıtlayın.", 400, "REFERENCE_ANSWERS_INCOMPLETE");
  const comment = String(input?.comment || "").trim();
  if (comment.length > 2000) throw httpError("Referans yorumu 2.000 karakteri geçemez.", 400, "REFERENCE_COMMENT_TOO_LONG");
  const scored = [...ratingMap.values()].filter((item) => Number.isInteger(item.score));
  const average = scored.length ? scored.reduce((sum, item) => sum + item.score, 0) / scored.length : null;
  const highImpactNegative = (average !== null && average <= 3) || answerMap.get("eligible_for_rehire")?.answer === "no";
  return { ratings: [...ratingMap.values()], answers: [...answerMap.values()], comment: comment || null, average_score: average === null ? null : Number(average.toFixed(2)), high_impact_negative: highImpactNegative };
}

export function referenceModerationScreen(input) {
  const text = String(input?.comment || "").normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, " ").replace(/\s+/g, " ").trim();
  const contact = /(?:https?:\/\/|www\.|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|(?:\+?\d[\s().-]*){7,})/iu.test(text);
  const abusive = /\b(?:aptal|salak|şerefsiz|orospu|fuck|idiot)\b/iu.test(text);
  return {
    normalized_comment: text.slice(0, 2000) || null,
    decision: contact || abusive ? "needs_review" : "automated_screening",
    rule_codes: [...(contact ? ["CONTACT_DATA"] : []), ...(abusive ? ["ABUSIVE_LANGUAGE"] : [])]
  };
}

export function approvedReferenceSummary(references) {
  const approved = (Array.isArray(references) ? references : []).filter((item) => item.status === "approved");
  const scores = approved.map((item) => Number(item.average_score)).filter(Number.isFinite);
  return {
    approved_count: approved.length,
    average_score: scores.length ? Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(2)) : null,
    last_approved_at: approved.map((item) => item.approved_at).filter(Boolean).sort().at(-1) || null
  };
}

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

export function canReadMariPartnerFinance(membership) {
  if (!membership) return false;
  if (["owner", "manager", "accounting"].includes(membership.role)) return true;
  return membership.permissions?.all === true
    || membership.permissions?.finance === true
    || membership.permissions?.read_finance === true;
}
