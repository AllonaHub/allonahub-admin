import { createHash } from "node:crypto";

export const MARITIME_SMART_RULE_VERSION = "maritime-smart-account-v5";

const languageCodes = ["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"];

const verifiedCompetencyCatalog = Object.freeze({
  II1: ["Seyir vardiyası yönetimi ve güvenli köprüüstü operasyonları", "Naviqasiya növbəsinin idarə edilməsi və təhlükəsiz körpüüstü əməliyyatları", "Навигациялық вахтаны басқару және қауіпсіз көпірше операциялары", "Navigatsion navbatchilikni boshqarish va xavfsiz ko‘prik operatsiyalari", "Навигациялык вахтаны башкаруу жана коопсуз көпүрө операциялары", "Navigational watchkeeping and safe bridge operations", "Navigationswache und sichere Brückenabläufe", "Несение ходовой навигационной вахты и безопасные операции на мостике", "نوبة الملاحة وعمليات الجسر الآمنة"],
  II4: ["Güverte vardiyasına katılım ve seyir gözcülüğü", "Göyərtə növbəsində iştirak və müşahidə", "Палубалық вахтаға қатысу және бақылау", "Paluba navbatchiligida ishtirok etish va kuzatuv", "Палубалык вахтага катышуу жана байкоо", "Deck watchkeeping support and lookout duties", "Unterstützung der Deckswache und Ausguckdienst", "Участие в палубной вахте и обязанности наблюдателя", "دعم نوبة السطح ومهام المراقبة"],
  IV2: ["GMDSS haberleşmesi, acil durum ve emniyet iletişimi", "GMDSS rabitəsi, fövqəladə hallar və təhlükəsizlik əlaqəsi", "GMDSS байланысы, төтенше жағдай және қауіпсіздік байланысы", "GMDSS aloqasi, favqulodda holat va xavfsizlik kommunikatsiyasi", "GMDSS байланышы, өзгөчө кырдаал жана коопсуздук байланышы", "GMDSS communications, distress, and safety radio operations", "GMDSS-Kommunikation sowie Not- und Sicherheitsfunk", "Связь GMDSS, аварийная и безопасная радиосвязь", "اتصالات GMDSS وعمليات الاستغاثة والسلامة اللاسلكية"],
  VI1: ["Temel deniz emniyeti, yangınla mücadele, ilk yardım ve kişisel güvenlik", "Əsas dəniz təhlükəsizliyi, yanğınla mübarizə, ilk yardım və şəxsi təhlükəsizlik", "Негізгі теңіз қауіпсіздігі, өртпен күрес, алғашқы көмек және жеке қауіпсіздік", "Asosiy dengiz xavfsizligi, yong‘inga qarshi kurash, birinchi yordam va shaxsiy xavfsizlik", "Негизги деңиз коопсуздугу, өрт менен күрөшүү, биринчи жардам жана жеке коопсуздук", "Basic maritime safety, firefighting, first aid, and personal safety", "Grundlegende Schiffssicherheit, Brandbekämpfung, Erste Hilfe und persönliche Sicherheit", "Базовая морская безопасность, борьба с пожаром, первая помощь и личная безопасность", "السلامة البحرية الأساسية ومكافحة الحرائق والإسعافات الأولية والسلامة الشخصية"],
  VI6: ["Belirlenmiş gemi güvenlik görevleri ve güvenlik farkındalığı", "Təyin edilmiş gəmi təhlükəsizlik vəzifələri və təhlükəsizlik məlumatlılığı", "Кемедегі белгіленген қауіпсіздік міндеттері және қауіпсіздік сауаттылығы", "Kemadagi belgilangan xavfsizlik vazifalari va xavfsizlik xabardorligi", "Кемедеги белгиленген коопсуздук милдеттери жана коопсуздук маалымдуулугу", "Designated ship-security duties and security awareness", "Zugewiesene Gefahrenabwehraufgaben und Sicherheitsbewusstsein", "Назначенные обязанности по охране судна и осведомленность о безопасности", "مهام أمن السفينة المحددة والوعي الأمني"]
});

const rankAliases = new Map([
  ["master", "master"], ["captain", "master"], ["kaptan", "master"], ["ship master", "master"],
  ["chief officer", "chief_officer"], ["chief mate", "chief_officer"], ["1st officer", "chief_officer"], ["birinci zabit", "chief_officer"],
  ["second officer", "second_officer"], ["2nd officer", "second_officer"], ["ikinci zabit", "second_officer"],
  ["third officer", "third_officer"], ["3rd officer", "third_officer"], ["ucuncu zabit", "third_officer"],
  ["deck cadet", "deck_cadet"], ["deck trainee", "deck_cadet"],
  ["chief engineer", "chief_engineer"], ["bas muhendis", "chief_engineer"],
  ["second engineer", "second_engineer"], ["2nd engineer", "second_engineer"],
  ["third engineer", "third_engineer"], ["3rd engineer", "third_engineer"],
  ["fourth engineer", "fourth_engineer"], ["4th engineer", "fourth_engineer"],
  ["engine cadet", "engine_cadet"], ["engine trainee", "engine_cadet"],
  ["electro technical officer", "eto"], ["electro-technical officer", "eto"], ["eto", "eto"],
  ["bosun", "bosun"], ["boatswain", "bosun"], ["lostromo", "bosun"],
  ["able seaman", "able_seaman"], ["ab", "able_seaman"], ["usta gemici", "able_seaman"],
  ["ordinary seaman", "ordinary_seaman"], ["os", "ordinary_seaman"], ["gemici", "ordinary_seaman"],
  ["oiler", "oiler"], ["motorman", "oiler"], ["yagci", "oiler"],
  ["cook", "cook"], ["chief cook", "cook"], ["asci", "cook"],
  ["steward", "steward"], ["messman", "steward"]
]);

const languageLevel = new Map([
  ["a1", 1], ["beginner", 1], ["basic", 1],
  ["a2", 2], ["elementary", 2],
  ["b1", 3], ["intermediate", 3],
  ["b2", 4], ["upper intermediate", 4],
  ["c1", 5], ["advanced", 5],
  ["c2", 6], ["fluent", 6], ["native", 7], ["mother tongue", 7]
]);

function text(value) {
  return String(value ?? "").trim();
}

function folded(value) {
  return text(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function token(value) {
  return folded(value).replace(/\s+/g, "_");
}

function uniqueText(values) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const clean = text(value);
    const key = folded(clean);
    if (!clean || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
}

function uniqueDisplayText(values) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const clean = text(value);
    const key = clean.normalize("NFKC").toLocaleLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function localizedText(value) {
  const source = object(value);
  return Object.fromEntries(languageCodes.map((code) => [code, text(source[code]) || null]));
}

function localizedTextHasValue(value) {
  return languageCodes.some((code) => Boolean(text(object(value)[code])));
}

function localizedListsFromSources(payload, items, key) {
  const sources = [payload, ...items.map((item) => object(item.value_payload))];
  const property = `${key}_i18n`;
  return Object.fromEntries(languageCodes.map((code) => [
    code,
    uniqueDisplayText(sources.flatMap((source) => array(object(source[property])[code])))
  ]));
}

function certificateRecord(rowValue) {
  const row = object(rowValue);
  const normalized = {
    code: text(row.code) || null,
    document_number: text(row.document_number) || null,
    certificate_serial: text(row.certificate_serial) || null,
    endorsement_number: text(row.endorsement_number) || null,
    title: text(row.title) || null,
    title_i18n: localizedText(row.title_i18n),
    issuing_country: text(row.issuing_country) || null,
    issuing_authority: text(row.issuing_authority) || null,
    approval_authority: text(row.approval_authority) || null,
    approval_reference: text(row.approval_reference) || null,
    place_of_issue: text(row.place_of_issue) || null,
    course_start_date: text(row.course_start_date) || null,
    course_end_date: text(row.course_end_date) || null,
    issue_date: text(row.issue_date) || null,
    expiry_date: text(row.expiry_date) || null,
    validity_status: text(row.validity_status) || (row.expiry_date ? "dated" : "not_stated"),
    rank_or_capacity: text(row.rank_or_capacity) || null,
    rank_or_capacity_i18n: localizedText(row.rank_or_capacity_i18n),
    stcw_references: uniqueText(row.stcw_references),
    source_page: Number.isInteger(row.source_page) ? row.source_page : null,
    confidence: Math.max(0, Math.min(1, Number(row.confidence) || 0))
  };
  return normalized.code || normalized.document_number || normalized.title || normalized.rank_or_capacity ? normalized : null;
}

function legacyCertificateRecords(payloadValue) {
  const payload = object(payloadValue);
  const explicit = array(payload.certificate_records).map(certificateRecord).filter(Boolean);
  if (explicit.length) return explicit;
  const codes = uniqueText(payload.certificate_codes);
  const certificateDocument = ["stcw_certificate", "competency_certificate", "training_certificate"].includes(text(payload.document_type));
  if (!certificateDocument && !codes.length) return [];
  const rows = codes.length ? codes : [null];
  return rows.map((code) => certificateRecord({
    code,
    document_number: payload.document_number,
    certificate_serial: payload.certificate_serial,
    endorsement_number: payload.endorsement_number,
    title: payload.document_title,
    title_i18n: payload.document_title_i18n,
    issuing_country: payload.document_country,
    issuing_authority: payload.issuing_authority,
    approval_authority: payload.approval_authority,
    approval_reference: payload.approval_reference,
    place_of_issue: payload.place_of_issue,
    course_start_date: payload.course_start_date,
    course_end_date: payload.course_end_date,
    issue_date: payload.issue_date,
    expiry_date: payload.expiry_date,
    validity_status: payload.validity_status,
    rank_or_capacity: payload.rank,
    rank_or_capacity_i18n: payload.rank_i18n,
    stcw_references: payload.stcw_references,
    source_page: 1,
    confidence: payload.confidence
  })).filter(Boolean);
}

function certificateRecordKey(row) {
  return [row.code, row.document_number, row.certificate_serial, row.endorsement_number, row.title, row.issuing_authority, row.issue_date, row.expiry_date, row.rank_or_capacity]
    .map(folded)
    .join("|");
}

function uniqueCertificateRecords(values) {
  const seen = new Set();
  const result = [];
  for (const row of values.flatMap(legacyCertificateRecords)) {
    const key = certificateRecordKey(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result.slice(0, 80);
}

function recordConfidence(row) {
  return Math.max(0, Math.min(1, Number(object(row).confidence) || 0));
}

function recordPage(row) {
  return Number.isInteger(object(row).source_page) ? object(row).source_page : null;
}

function uniqueRecords(values, normalize, keyFields, limit = 100) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const row = normalize(value);
    if (!row) continue;
    const key = keyFields.map((field) => folded(row[field])).join("|");
    if (!key.replace(/\|/g, "") || seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result.slice(0, limit);
}

function identityDocument(rowValue) {
  const row = object(rowValue);
  const kind = ["passport", "national_id", "seafarer_book", "seaman_record_book", "visa", "other"].includes(text(row.kind)) ? text(row.kind) : "other";
  const normalized = {
    kind,
    label: text(row.label) || null,
    issuing_country: text(row.issuing_country) || null,
    document_number: text(row.document_number) || null,
    issuing_authority: text(row.issuing_authority) || null,
    place_of_issue: text(row.place_of_issue) || null,
    issue_date: text(row.issue_date) || null,
    expiry_date: text(row.expiry_date) || null,
    validity_status: text(row.validity_status) || (row.expiry_date ? "dated" : "not_stated"),
    source_page: recordPage(row),
    confidence: recordConfidence(row)
  };
  return normalized.document_number || normalized.label ? normalized : null;
}

function legacyIdentityDocuments(sourceValue) {
  const source = object(sourceValue);
  const explicit = [...array(source.identity_documents)];
  const type = text(source.document_type);
  if (!explicit.length && ["passport", "seafarer_book", "visa"].includes(type) && (source.document_number || source.document_title)) {
    explicit.push({
      kind: type,
      label: source.document_title,
      issuing_country: source.document_country,
      document_number: source.document_number,
      issuing_authority: source.issuing_authority,
      place_of_issue: source.place_of_issue,
      issue_date: source.issue_date,
      expiry_date: source.expiry_date,
      validity_status: source.validity_status,
      source_page: 1,
      confidence: source.confidence
    });
  }
  return explicit;
}

function educationRecord(rowValue) {
  const row = object(rowValue);
  const normalized = {
    institution: text(row.institution) || null,
    city: text(row.city) || null,
    country: text(row.country) || null,
    qualification: text(row.qualification) || null,
    qualification_i18n: localizedText(row.qualification_i18n),
    field_of_study: text(row.field_of_study) || null,
    field_of_study_i18n: localizedText(row.field_of_study_i18n),
    start_date: text(row.start_date) || null,
    end_date: text(row.end_date) || null,
    graduation_date: text(row.graduation_date) || null,
    source_page: recordPage(row),
    confidence: recordConfidence(row)
  };
  return normalized.institution || normalized.qualification || normalized.field_of_study ? normalized : null;
}

function medicalRecord(rowValue) {
  const row = object(rowValue);
  const normalized = {
    record_type: text(row.record_type) || "other",
    document_number: text(row.document_number) || null,
    result: text(row.result) || "not_stated",
    restrictions: uniqueText(row.restrictions),
    issuing_authority: text(row.issuing_authority) || null,
    place_of_issue: text(row.place_of_issue) || null,
    issue_date: text(row.issue_date) || null,
    expiry_date: text(row.expiry_date) || null,
    validity_status: text(row.validity_status) || (row.expiry_date ? "dated" : "not_stated"),
    source_page: recordPage(row),
    confidence: recordConfidence(row)
  };
  return normalized.document_number || normalized.issue_date || normalized.expiry_date || normalized.result !== "not_stated" ? normalized : null;
}

function vaccinationRecord(rowValue) {
  const row = object(rowValue);
  const normalized = {
    vaccine_name: text(row.vaccine_name) || null,
    vaccine_name_i18n: localizedText(row.vaccine_name_i18n),
    document_number: text(row.document_number) || null,
    dose: text(row.dose) || null,
    issuing_authority: text(row.issuing_authority) || null,
    issue_date: text(row.issue_date) || null,
    expiry_date: text(row.expiry_date) || null,
    validity_status: text(row.validity_status) || (row.expiry_date ? "dated" : "not_stated"),
    source_page: recordPage(row),
    confidence: recordConfidence(row)
  };
  return normalized.vaccine_name || normalized.document_number ? normalized : null;
}

function skillRecord(rowValue) {
  const row = object(rowValue);
  const normalized = {
    name: text(row.name),
    name_i18n: localizedText(row.name_i18n),
    category: ["maritime", "safety", "technical", "digital", "leadership", "soft_skill", "other"].includes(text(row.category)) ? text(row.category) : "other",
    source_page: recordPage(row),
    confidence: recordConfidence(row)
  };
  return normalized.name ? normalized : null;
}

function achievementRecord(rowValue) {
  const row = object(rowValue);
  const normalized = {
    title: text(row.title),
    title_i18n: localizedText(row.title_i18n),
    details: text(row.details) || null,
    date: text(row.date) || null,
    source_page: recordPage(row),
    confidence: recordConfidence(row)
  };
  return normalized.title ? normalized : null;
}

function seaServiceRecord(rowValue) {
  const row = object(rowValue);
  const normalized = {
    vessel_name: text(row.vessel_name) || null,
    imo_number: /^\d{7}$/.test(text(row.imo_number)) ? text(row.imo_number) : null,
    company_name: text(row.company_name) || null,
    flag: text(row.flag) || null,
    vessel_type: text(row.vessel_type) || null,
    vessel_type_i18n: localizedText(row.vessel_type_i18n),
    rank: text(row.rank) || null,
    rank_i18n: localizedText(row.rank_i18n),
    sign_on_date: text(row.sign_on_date) || null,
    sign_off_date: text(row.sign_off_date) || null,
    total_days: Number.isInteger(row.total_days) ? row.total_days : null,
    gross_tonnage: Number.isFinite(Number(row.gross_tonnage)) ? Number(row.gross_tonnage) : null,
    deadweight_tonnage: Number.isFinite(Number(row.deadweight_tonnage)) ? Number(row.deadweight_tonnage) : null,
    engine_make_model: text(row.engine_make_model) || null,
    engine_power_kw: Number.isFinite(Number(row.engine_power_kw)) ? Number(row.engine_power_kw) : null,
    source_page: recordPage(row),
    confidence: recordConfidence(row)
  };
  return normalized.vessel_name || normalized.company_name || normalized.sign_on_date || normalized.sign_off_date ? normalized : null;
}

function mergedNestedObject(sources, key, fields) {
  const result = Object.fromEntries(fields.map((field) => [field, null]));
  for (const source of sources.slice().reverse()) {
    const value = object(object(source)[key]);
    for (const field of fields) {
      if (value[field] !== null && value[field] !== undefined && value[field] !== "") result[field] = value[field];
    }
  }
  return result;
}

function firstSourceText(sources, key) {
  for (const source of sources) {
    const value = text(object(source)[key]);
    if (value) return value;
  }
  return "";
}

function firstLocalizedValue(payload, items, key) {
  const direct = object(payload[key]);
  if (localizedTextHasValue(direct)) return localizedText(direct);
  for (const item of items) {
    const candidate = object(object(item.value_payload)[key]);
    if (localizedTextHasValue(candidate)) return localizedText(candidate);
  }
  return localizedText({});
}

function canonicalRank(value) {
  const normalized = folded(value);
  if (!normalized) return "";
  if (rankAliases.has(normalized)) return rankAliases.get(normalized);
  for (const [alias, code] of rankAliases.entries()) {
    if (normalized.includes(alias)) return code;
  }
  return token(normalized);
}

function certificateToken(value) {
  return text(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function certificateVariants(value) {
  const normalized = certificateToken(value);
  return new Set([normalized, normalized.replace(/^STCW/, "")].filter(Boolean));
}

function parseDate(value) {
  const raw = text(value);
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) return null;
  const date = new Date(`${raw.slice(0, 10)}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function daysBetween(start, end) {
  if (!start || !end || end < start) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function seaServiceDays(rows) {
  return array(rows).reduce((sum, rowValue) => {
    const row = object(rowValue);
    const supplied = Number(row.total_days);
    if (Number.isFinite(supplied) && supplied > 0) return sum + Math.min(Math.round(supplied), 20000);
    return sum + daysBetween(parseDate(row.sign_on_date), parseDate(row.sign_off_date));
  }, 0);
}

function canonicalStcwToken(value) {
  return certificateToken(value).replace(/^STCW/, "").replace(/^A(?=[IVX])/, "");
}

function localizedCatalogRow(values) {
  return Object.fromEntries(languageCodes.map((code, index) => [code, text(values[index]) || null]));
}

function verifiedCompetencyHighlights(records) {
  const seen = new Set();
  const result = [];
  for (const row of records) {
    const candidates = uniqueText([row.code, ...array(row.stcw_references)]).map(canonicalStcwToken);
    const catalogCode = candidates.find((code) => verifiedCompetencyCatalog[code]);
    let labelI18n = catalogCode ? localizedCatalogRow(verifiedCompetencyCatalog[catalogCode]) : null;
    if (!labelI18n || !localizedTextHasValue(labelI18n)) {
      labelI18n = localizedTextHasValue(row.rank_or_capacity_i18n)
        ? localizedText(row.rank_or_capacity_i18n)
        : localizedText(row.title_i18n);
    }
    const label = text(labelI18n.en || labelI18n.tr || row.rank_or_capacity || row.title);
    const key = folded(label);
    if (!label || !key || seen.has(key)) continue;
    seen.add(key);
    result.push({ code: text(row.code) || catalogCode || null, label, label_i18n: labelI18n, origin: "verified_credential" });
  }
  return result.slice(0, 30);
}

function generatedProfessionalSummary(certificateCount, serviceRows, totalDays, highlights) {
  if (!certificateCount && !serviceRows.length && !highlights.length) return localizedText({});
  const highlightsByLanguage = Object.fromEntries(languageCodes.map((code) => [
    code,
    highlights.slice(0, 4).map((row) => text(object(row.label_i18n)[code]) || row.label).filter(Boolean).join(", ")
  ]));
  const count = Math.max(certificateCount, highlights.length);
  const serviceCount = serviceRows.length;
  const days = Math.max(0, Number(totalDays) || 0);
  const detail = (code) => highlightsByLanguage[code] || "";
  const serviceText = {
    tr: serviceCount ? `${serviceCount} deniz hizmeti kaydı${days ? ` ve toplam ${days} gün doğrulanmış deneyim` : ""}` : "denizcilik yeterlilikleri",
    az: serviceCount ? `${serviceCount} dəniz xidməti qeydi${days ? ` və ümumilikdə ${days} gün təsdiqlənmiş təcrübə` : ""}` : "dənizçilik səriştələri",
    kk: serviceCount ? `${serviceCount} теңіз қызметі жазбасы${days ? ` және барлығы ${days} күн расталған тәжірибе` : ""}` : "теңіз біліктіліктері",
    uz: serviceCount ? `${serviceCount} dengiz xizmati qaydi${days ? ` va jami ${days} kun tasdiqlangan tajriba` : ""}` : "dengizchilik malakalari",
    ky: serviceCount ? `${serviceCount} деңиз кызматынын жазуусу${days ? ` жана жалпысынан ${days} күн ырасталган тажрыйба` : ""}` : "деңизчилик квалификациялары",
    en: serviceCount ? `${serviceCount} verified sea-service record${serviceCount === 1 ? "" : "s"}${days ? ` covering ${days} days` : ""}` : "verified maritime qualifications",
    de: serviceCount ? `${serviceCount} bestätigte Seefahrtsnachweise${days ? ` mit insgesamt ${days} Tagen` : ""}` : "bestätigte maritime Befähigungen",
    ru: serviceCount ? `${serviceCount} подтвержденных записей морского стажа${days ? ` общей продолжительностью ${days} дней` : ""}` : "подтвержденные морские квалификации",
    ar: serviceCount ? `${serviceCount} من سجلات الخدمة البحرية الموثقة${days ? ` بإجمالي ${days} يومًا` : ""}` : "مؤهلات بحرية موثقة"
  };
  return {
    tr: `${serviceText.tr} ve ${count} belge kaydı tek profilde düzenlenmiştir. Belgeyle doğrulanan güçlü yönleri ${detail("tr")} alanlarını kapsar. Gemi ve görev kayıtları eklendikçe tecrübe özeti otomatik olarak genişler.`,
    az: `${serviceText.az} və ${count} sənəd qeydi vahid profildə toplanıb. Sənədlə təsdiqlənən güclü tərəfləri ${detail("az")} sahələrini əhatə edir. Gəmi və vəzifə qeydləri əlavə olunduqca təcrübə xülasəsi avtomatik genişlənir.`,
    kk: `${serviceText.kk} және ${count} құжат жазбасы бір профильде жинақталған. Құжатпен расталған күшті жақтары: ${detail("kk")}. Кеме мен қызмет жазбалары қосылған сайын тәжірибе қорытындысы автоматты түрде кеңейеді.`,
    uz: `${serviceText.uz} va ${count} hujjat qaydi yagona profilda jamlangan. Hujjat bilan tasdiqlangan kuchli tomonlari: ${detail("uz")}. Kema va lavozim qaydlari qo‘shilgani sari tajriba xulosasi avtomatik kengayadi.`,
    ky: `${serviceText.ky} жана ${count} документ жазуусу бир профилде топтолду. Документ менен ырасталган күчтүү жактары: ${detail("ky")}. Кеме жана кызмат жазуулары кошулган сайын тажрыйба жыйынтыгы автоматтык кеңейет.`,
    en: `${serviceText.en} and ${count} credential record${count === 1 ? "" : "s"} are organized in one profile. Document-verified strengths include ${detail("en")}. The experience summary expands automatically as vessel and position records are added.`,
    de: `${serviceText.de} und ${count} Befähigungsnachweise sind in einem Profil zusammengeführt. Dokumentengeprüfte Stärken umfassen ${detail("de")}. Die Erfahrung wird mit jedem ergänzten Schiffs- und Tätigkeitsnachweis automatisch erweitert.`,
    ru: `${serviceText.ru} и ${count} записей квалификаций объединены в одном профиле. Подтвержденные документами сильные стороны: ${detail("ru")}. Сводка опыта автоматически расширяется при добавлении сведений о судах и должностях.`,
    ar: `جُمعت ${serviceText.ar} و${count} من سجلات المؤهلات في ملف واحد. تشمل نقاط القوة المثبتة بالمستندات: ${detail("ar")}. ويتوسع ملخص الخبرة تلقائيًا عند إضافة سجلات السفن والوظائف.`
  };
}

function nestedValues(items, key) {
  return uniqueText(items.flatMap((item) => array(object(item.value_payload)[key])));
}

function identityConflicts(items) {
  const identityRows = items
    .filter((item) => item.item_type === "identity")
    .map((item) => object(item.value_payload));
  const checks = ["holder_name", "date_of_birth", "nationality"];
  return checks.flatMap((field) => {
    const values = uniqueText(identityRows.map((row) => row[field]));
    return values.length > 1 ? [{ code: `conflicting_${field}`, field, values }] : [];
  });
}

function expiryState(items, now) {
  const today = new Date(now);
  const alerts = [];
  const counters = { valid: 0, expiring_30: 0, expiring_90: 0, expired: 0, no_expiry: 0 };
  for (const item of items) {
    const expiry = parseDate(item.expires_at || object(item.value_payload).expiry_date);
    if (!expiry) {
      counters.no_expiry += 1;
      continue;
    }
    const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
    const alert = {
      readiness_item_id: item.id || null,
      item_type: item.item_type || "other",
      source_label: text(item.source_label),
      expires_at: expiry.toISOString().slice(0, 10),
      days_remaining: days
    };
    if (days < 0) {
      counters.expired += 1;
      alerts.push({ ...alert, severity: "expired" });
    } else if (days <= 30) {
      counters.expiring_30 += 1;
      alerts.push({ ...alert, severity: "critical" });
    } else if (days <= 90) {
      counters.expiring_90 += 1;
      alerts.push({ ...alert, severity: "warning" });
    } else {
      counters.valid += 1;
    }
  }
  alerts.sort((first, second) => first.days_remaining - second.days_remaining);
  return { counters, alerts };
}

function categoryScore(present, weight) {
  return present ? weight : 0;
}

export function buildMaritimeSmartProfile({ cvProfile, readinessItems = [], workspace = null, documents = [], now = new Date() }) {
  const payload = object(cvProfile?.profile_payload || cvProfile);
  const items = array(readinessItems).filter((item) => (
    ["user_confirmed", "employer_confirmed", "registry_confirmed", "reviewer_confirmed"].includes(item.trust_level)
    && !["rejected", "expired", "revoked", "disputed"].includes(item.verification_status)
  ));
  const sources = [payload, ...items.map((item) => object(item.value_payload))];
  const positions = uniqueText([...array(payload.suitable_positions), ...nestedValues(items, "suitable_positions")]);
  const positionsI18n = localizedListsFromSources(payload, items, "suitable_positions");
  const certificateRecords = uniqueCertificateRecords(sources);
  const identityDocuments = uniqueRecords(
    sources.flatMap(legacyIdentityDocuments),
    identityDocument,
    ["kind", "document_number", "issuing_country", "issue_date"],
    80
  );
  const education = uniqueRecords(sources.flatMap((source) => array(source.education)), educationRecord, ["institution", "qualification", "field_of_study", "graduation_date"], 50);
  const medicalRecords = uniqueRecords(sources.flatMap((source) => array(source.medical_records)), medicalRecord, ["record_type", "document_number", "issue_date", "expiry_date"], 50);
  const vaccinations = uniqueRecords(sources.flatMap((source) => array(source.vaccinations)), vaccinationRecord, ["vaccine_name", "document_number", "issue_date"], 50);
  const seaService = uniqueRecords(sources.flatMap((source) => array(source.sea_service)), seaServiceRecord, ["vessel_name", "rank", "sign_on_date", "sign_off_date"], 120);
  const skills = uniqueRecords(sources.flatMap((source) => array(source.skills)), skillRecord, ["name", "category"], 80);
  const achievements = uniqueRecords(sources.flatMap((source) => array(source.achievements)), achievementRecord, ["title", "date"], 40);
  const references = uniqueRecords(sources.flatMap((source) => array(source.references)), (rowValue) => {
    const row = object(rowValue);
    const normalized = { name: text(row.name) || null, company: text(row.company) || null, position: text(row.position) || null, phone: text(row.phone) || null, email: text(row.email) || null, source_page: recordPage(row), confidence: recordConfidence(row) };
    return normalized.name || normalized.company ? normalized : null;
  }, ["name", "company", "phone", "email"], 30);
  const emergencyContacts = uniqueRecords(sources.flatMap((source) => array(source.emergency_contacts)), (rowValue) => {
    const row = object(rowValue);
    const normalized = { name: text(row.name) || null, relationship: text(row.relationship) || null, phone: text(row.phone) || null, address: text(row.address) || null, source_page: recordPage(row), confidence: recordConfidence(row) };
    return normalized.name || normalized.phone ? normalized : null;
  }, ["name", "relationship", "phone"], 10);
  const contact = mergedNestedObject(sources, "contact", ["email", "phone", "secondary_phone", "permanent_address", "nearest_airport"]);
  const physicalProfile = mergedNestedObject(sources, "physical_profile", ["height_cm", "weight_kg", "eye_color", "hair_color", "shoe_size", "overall_size"]);
  const certificates = uniqueText([
    ...array(payload.certificate_codes),
    ...nestedValues(items, "certificate_codes"),
    ...certificateRecords.map((row) => row.code)
  ]);
  const endorsements = uniqueText([...array(payload.endorsements), ...nestedValues(items, "endorsements")]);
  const endorsementsI18n = localizedListsFromSources(payload, items, "endorsements");
  const restrictions = uniqueText([...array(payload.restrictions), ...nestedValues(items, "restrictions")]);
  const restrictionsI18n = localizedListsFromSources(payload, items, "restrictions");
  const languages = uniqueRecords(sources.flatMap((source) => array(source.languages)), (entryValue) => {
    const entry = object(entryValue);
    const normalized = { language: text(entry.language), language_i18n: localizedText(entry.language_i18n), level: text(entry.level) || null, level_i18n: localizedText(entry.level_i18n), source_page: recordPage(entry), confidence: recordConfidence(entry) };
    return normalized.language ? normalized : null;
  }, ["language", "level"], 30);
  const confirmedDocuments = array(documents).filter((document) => ["user_confirmed", "verification_pending", "verified"].includes(document.status));
  const expiry = expiryState(items, now);
  const conflicts = identityConflicts(items);
  const medical = text(firstSourceText(sources, "medical_fitness") || medicalRecords.find((row) => row.result !== "not_stated")?.result || "not_stated");
  const rank = text(firstSourceText(sources, "rank") || positions[0]);
  const rankI18n = firstLocalizedValue(payload, items, "rank_i18n");
  const nationalityI18n = firstLocalizedValue(payload, items, "nationality_i18n");
  const explicitSummary = firstSourceText(sources, "professional_summary");
  const explicitSummaryI18n = firstLocalizedValue(payload, items, "professional_summary_i18n");
  const competencyHighlights = verifiedCompetencyHighlights(certificateRecords);
  const totalSeaServiceDays = seaServiceDays(seaService);
  const generatedSummaryI18n = generatedProfessionalSummary(certificateRecords.length, seaService, totalSeaServiceDays, competencyHighlights);
  const professionalSummaryI18n = localizedTextHasValue(explicitSummaryI18n) ? explicitSummaryI18n : generatedSummaryI18n;
  const professionalSummary = explicitSummary || professionalSummaryI18n.en || professionalSummaryI18n.tr || "";
  const experienceOverview = {
    record_count: seaService.length,
    total_days: totalSeaServiceDays,
    vessels: uniqueText(seaService.map((row) => row.vessel_name)),
    companies: uniqueText(seaService.map((row) => row.company_name)),
    vessel_types: uniqueText(seaService.map((row) => row.vessel_type)),
    ranks: uniqueText(seaService.map((row) => row.rank))
  };
  const itemTypes = new Set(items.map((item) => item.item_type));
  const holderName = firstSourceText(sources, "holder_name");
  const nationality = firstSourceText(sources, "nationality");
  const dateOfBirth = firstSourceText(sources, "date_of_birth");
  const hasIdentity = Boolean(holderName && dateOfBirth);
  const hasRank = Boolean(rank || positions.length);
  const hasCertificates = certificates.length > 0;
  const hasSeaService = seaService.length > 0;
  const hasMedical = medical === "fit" || medical === "fit_with_restrictions";
  const hasPassport = itemTypes.has("passport") || identityDocuments.some((row) => row.kind === "passport");
  const hasSeamanBook = itemTypes.has("seaman_book") || identityDocuments.some((row) => ["seafarer_book", "seaman_record_book"].includes(row.kind));
  const hasLanguage = languages.length > 0;
  const score = Math.min(100,
    categoryScore(hasIdentity, 15)
    + categoryScore(hasRank, 15)
    + categoryScore(hasCertificates, 20)
    + categoryScore(hasSeaService, 15)
    + categoryScore(hasMedical, 10)
    + categoryScore(hasPassport, 10)
    + categoryScore(hasSeamanBook, 5)
    + categoryScore(hasLanguage, 5)
    + categoryScore(confirmedDocuments.length > 0, 5)
  );
  const missing = [
    !hasIdentity && "identity",
    !hasRank && "rank",
    !hasCertificates && "certificates",
    !hasSeaService && "sea_service",
    !hasMedical && "medical",
    !hasPassport && "passport",
    !hasSeamanBook && "seaman_book",
    !hasLanguage && "languages"
  ].filter(Boolean);
  const blockingReasons = [
    !confirmedDocuments.length && "no_confirmed_documents",
    !hasIdentity && "identity_missing",
    !hasRank && "rank_missing",
    !hasCertificates && "certificates_missing",
    medical === "unfit" && "medical_unfit",
    conflicts.length > 0 && "identity_conflict",
    expiry.alerts.some((alert) => alert.severity === "expired" && ["medical", "passport", "seaman_book"].includes(alert.item_type)) && "critical_document_expired"
  ].filter(Boolean);
  const readyToApply = score >= 70 && blockingReasons.length === 0;
  const sourceDocumentIds = uniqueText(cvProfile?.source_document_ids || confirmedDocuments.map((document) => document.id));

  return {
    rule_version: MARITIME_SMART_RULE_VERSION,
    profile: {
      holder_name: holderName,
      family_name: firstSourceText(sources, "family_name"),
      given_names: firstSourceText(sources, "given_names"),
      middle_name: firstSourceText(sources, "middle_name"),
      nationality,
      date_of_birth: dateOfBirth,
      place_of_birth: firstSourceText(sources, "place_of_birth"),
      gender: firstSourceText(sources, "gender"),
      marital_status: firstSourceText(sources, "marital_status"),
      rank,
      rank_i18n: rankI18n,
      canonical_rank: canonicalRank(rank),
      suitable_positions: positions,
      suitable_positions_i18n: positionsI18n,
      certificate_codes: certificates,
      certificate_records: certificateRecords,
      identity_documents: identityDocuments,
      education,
      medical_records: medicalRecords,
      vaccinations,
      endorsements,
      endorsements_i18n: endorsementsI18n,
      restrictions,
      restrictions_i18n: restrictionsI18n,
      sea_service: seaService,
      total_sea_service_days: totalSeaServiceDays,
      languages,
      skills,
      achievements,
      competency_highlights: competencyHighlights,
      contact,
      physical_profile: physicalProfile,
      emergency_contacts: emergencyContacts,
      references,
      professional_summary: professionalSummary,
      professional_summary_i18n: professionalSummaryI18n,
      professional_summary_origin: explicitSummary ? "document" : "generated_from_verified_data",
      desired_salary_amount: Number(firstSourceText(sources, "desired_salary_amount")) || null,
      desired_salary_currency: firstSourceText(sources, "desired_salary_currency"),
      availability_text: firstSourceText(sources, "availability_text"),
      medical_fitness: medical,
      current_work_status: text(workspace?.current_work_status || "unknown"),
      availability_status: text(workspace?.availability_status || "unknown")
    },
    cv_draft: {
      template_version: "allonahub-maritime-cv-v6",
      holder_name: holderName,
      family_name: firstSourceText(sources, "family_name"),
      given_names: firstSourceText(sources, "given_names"),
      middle_name: firstSourceText(sources, "middle_name"),
      headline: rank || positions[0] || "",
      headline_i18n: rankI18n,
      nationality,
      nationality_i18n: nationalityI18n,
      date_of_birth: dateOfBirth,
      place_of_birth: firstSourceText(sources, "place_of_birth"),
      gender: firstSourceText(sources, "gender"),
      marital_status: firstSourceText(sources, "marital_status"),
      contact,
      physical_profile: physicalProfile,
      professional_summary: professionalSummary,
      professional_summary_i18n: professionalSummaryI18n,
      professional_summary_origin: explicitSummary ? "document" : "generated_from_verified_data",
      desired_salary_amount: Number(firstSourceText(sources, "desired_salary_amount")) || null,
      desired_salary_currency: firstSourceText(sources, "desired_salary_currency"),
      availability_text: firstSourceText(sources, "availability_text"),
      identity_documents: identityDocuments,
      education,
      qualifications: certificates,
      certificate_records: certificateRecords,
      medical_records: medicalRecords,
      vaccinations,
      endorsements,
      endorsements_i18n: endorsementsI18n,
      sea_service: seaService,
      experience_overview: experienceOverview,
      languages,
      skills,
      achievements,
      competency_highlights: competencyHighlights,
      references,
      restrictions,
      restrictions_i18n: restrictionsI18n,
      medical_fitness: medical
    },
    readiness: {
      score,
      level: readyToApply ? "ready_review" : score >= 45 ? "needs_attention" : "starting",
      ready_to_apply: readyToApply,
      missing_items: missing,
      blocking_reasons: blockingReasons,
      conflicts,
      expiry_alerts: expiry.alerts,
      document_counters: expiry.counters,
      confirmed_document_count: confirmedDocuments.length,
      source_document_ids: sourceDocumentIds
    }
  };
}

function requirementValue(job, keys, fallback = null) {
  const sources = [object(job.hard_gates), object(job.structured_requirements), object(job.metadata), job];
  for (const source of sources) {
    for (const key of keys) {
      if (source[key] !== undefined && source[key] !== null && source[key] !== "") return source[key];
    }
  }
  return fallback;
}

function requirementList(job, keys) {
  const value = requirementValue(job, keys, []);
  if (Array.isArray(value)) return uniqueText(value.map((entry) => typeof entry === "string" ? entry : object(entry).code || object(entry).name || object(entry).language));
  return text(value) ? uniqueText(text(value).split(/[,;|]/)) : [];
}

function profileLanguageLevel(profile, language) {
  const target = folded(language);
  const row = array(profile.languages).find((entry) => folded(object(entry).language) === target);
  return languageLevel.get(folded(object(row).level)) || 0;
}

function requiredLanguageLevel(job, language) {
  const rows = array(requirementValue(job, ["required_languages", "languages"], []));
  const row = rows.find((entry) => folded(typeof entry === "string" ? entry : object(entry).language || object(entry).name) === folded(language));
  return languageLevel.get(folded(object(row).level || object(row).minimum_level)) || 0;
}

function component(code, weight, ratio, detail = {}) {
  const safeRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
  return { code, weight, earned: Math.round(weight * safeRatio * 100) / 100, status: safeRatio >= 1 ? "passed" : safeRatio > 0 ? "partial" : "failed", detail };
}

export function matchMaritimeJob(smartProfile, job) {
  const profile = object(smartProfile?.profile);
  const readiness = object(smartProfile?.readiness);
  const requiredRanks = uniqueText([job.rank_code, ...requirementList(job, ["required_ranks", "rank_codes", "rank"])]).map(canonicalRank).filter(Boolean);
  const candidateRanks = uniqueText([profile.rank, ...array(profile.suitable_positions)]).map(canonicalRank).filter(Boolean);
  const rankRequired = requiredRanks.length > 0;
  const rankMatched = !rankRequired || requiredRanks.some((rank) => candidateRanks.includes(rank));

  const requiredCertificates = requirementList(job, ["required_certificate_codes", "certificate_codes", "required_certificates", "certificates"]);
  const candidateCertificates = new Set(array(profile.certificate_codes).flatMap((certificate) => [...certificateVariants(certificate)]));
  const certificateChecks = requiredCertificates.map((certificate) => {
    const matched = [...certificateVariants(certificate)].some((requiredToken) => candidateCertificates.has(requiredToken));
    return { certificate, matched };
  });
  const certificateRatio = certificateChecks.length ? certificateChecks.filter((entry) => entry.matched).length / certificateChecks.length : 1;

  const requiredDays = Math.max(0, Number(requirementValue(job, ["minimum_sea_service_days", "min_sea_service_days", "minimum_experience_days", "experience_days"], 0)) || 0);
  const candidateDays = Math.max(0, Number(profile.total_sea_service_days) || 0);
  const experienceRatio = requiredDays ? Math.min(1, candidateDays / requiredDays) : 1;

  const requiredLanguages = requirementList(job, ["required_languages", "languages"]);
  const languageChecks = requiredLanguages.map((language) => {
    const candidateLevel = profileLanguageLevel(profile, language);
    const minimumLevel = requiredLanguageLevel(job, language);
    return { language, candidate_level: candidateLevel, minimum_level: minimumLevel, matched: candidateLevel > 0 && candidateLevel >= minimumLevel };
  });
  const languageRatio = languageChecks.length ? languageChecks.filter((entry) => entry.matched).length / languageChecks.length : 1;

  const medicalRequired = Boolean(requirementValue(job, ["medical_required", "requires_medical", "medical_fitness_required"], false));
  const medicalPassed = !medicalRequired || ["fit", "fit_with_restrictions"].includes(profile.medical_fitness);
  const availabilityRequired = Boolean(requirementValue(job, ["available_now_required", "immediate_joining", "availability_required"], false));
  const availabilityPassed = !availabilityRequired || profile.current_work_status === "available_now";

  const components = [
    component("rank", 35, rankMatched ? 1 : 0, { required: requiredRanks, candidate: candidateRanks }),
    component("certificates", 25, certificateRatio, { checks: certificateChecks }),
    component("sea_service", 15, experienceRatio, { required_days: requiredDays, candidate_days: candidateDays }),
    component("languages", 10, languageRatio, { checks: languageChecks }),
    component("medical", 10, medicalPassed ? 1 : 0, { required: medicalRequired, candidate: profile.medical_fitness }),
    component("availability", 5, availabilityPassed ? 1 : 0, { required_now: availabilityRequired, candidate: profile.current_work_status })
  ];
  const missingRequirements = [
    (!rankRequired || !requiredCertificates.length) && "job_requirements_incomplete",
    rankRequired && !rankMatched && "rank",
    ...certificateChecks.filter((entry) => !entry.matched).map((entry) => `certificate:${entry.certificate}`),
    requiredDays > candidateDays && `sea_service_days:${requiredDays - candidateDays}`,
    ...languageChecks.filter((entry) => !entry.matched).map((entry) => `language:${entry.language}`),
    !medicalPassed && "medical",
    !availabilityPassed && "availability"
  ].filter(Boolean);
  let score = Math.round(components.reduce((sum, entry) => sum + entry.earned, 0));
  const criticalExpiry = array(readiness.expiry_alerts).some((alert) => alert.severity === "expired" && ["medical", "passport", "seaman_book"].includes(alert.item_type));
  if (criticalExpiry) score = Math.max(0, score - 25);
  const requirementsComplete = rankRequired && requiredCertificates.length > 0;
  const hardGatePassed = requirementsComplete && rankMatched && certificateRatio === 1 && experienceRatio === 1 && medicalPassed && availabilityPassed;
  const eligible = readiness.ready_to_apply === true && hardGatePassed && !criticalExpiry;
  return {
    job_id: job.id,
    partner_id: job.partner_id,
    job_reference: text(job.job_reference),
    job_title: text(job.job_title),
    contract_start: job.contract_start || null,
    contract_end: job.contract_end || null,
    location_label: text(object(job.metadata).location_label || object(job.structured_requirements).location_label),
    detail_label: text(object(job.metadata).detail_label || object(job.structured_requirements).contract_label),
    score,
    grade: score >= 85 ? "excellent" : score >= 70 ? "strong" : score >= 50 ? "potential" : "weak",
    eligible,
    hard_gate_status: !requirementsComplete ? "needs_data" : hardGatePassed ? "passed" : "failed",
    components,
    missing_requirements: missingRequirements,
    company_contact_visible: false
  };
}

export function matchMaritimeJobs(smartProfile, jobs) {
  return array(jobs)
    .map((job) => matchMaritimeJob(smartProfile, job))
    .sort((first, second) => second.score - first.score || first.job_title.localeCompare(second.job_title));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function maritimeSmartSnapshotHash(value) {
  const canonical = JSON.stringify(stableValue(value));
  return createHash("sha256").update(canonical).digest("hex");
}
