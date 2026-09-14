import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const LOCAL_READER_TIMEOUT_MS = 180000;
const LOCAL_READER_MAX_PAGES = 60;
const LOCAL_READER_MAX_BUFFER = 24 * 1024 * 1024;
const LANGUAGES = ["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"];

function nullableLocalized(value) {
  return Object.fromEntries(LANGUAGES.map((language) => [language, value || null]));
}

function emptyLocalizedList() {
  return Object.fromEntries(LANGUAGES.map((language) => [language, []]));
}

function compact(value, maxLength = 240) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, maxLength) : null;
}

function normalizedForSearch(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[əƏ]/g, "e")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .toLowerCase()
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = String(text || "").match(pattern);
    if (match?.[1]) return compact(match[1]);
  }
  return null;
}

const MONTHS = new Map([
  ["january", 1], ["jan", 1], ["ocak", 1],
  ["february", 2], ["feb", 2], ["subat", 2], ["şubat", 2],
  ["march", 3], ["mar", 3], ["mart", 3],
  ["april", 4], ["apr", 4], ["nisan", 4],
  ["may", 5], ["mayis", 5], ["mayıs", 5],
  ["june", 6], ["jun", 6], ["haziran", 6],
  ["july", 7], ["jul", 7], ["temmuz", 7],
  ["august", 8], ["aug", 8], ["agustos", 8], ["ağustos", 8],
  ["september", 9], ["sep", 9], ["eylul", 9], ["eylül", 9],
  ["october", 10], ["oct", 10], ["ekim", 10],
  ["november", 11], ["nov", 11], ["kasim", 11], ["kasım", 11],
  ["december", 12], ["dec", 12], ["aralik", 12], ["aralık", 12]
]);

const DATE_SOURCE = "(?:\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}|\\d{4}[./-]\\d{1,2}[./-]\\d{1,2}|\\d{1,2}(?:st|nd|rd|th)?\\s+[A-Za-zÇĞİÖŞÜçğıöşü]+\\s+\\d{4})";

function normalizeDate(value) {
  const clean = String(value || "").trim().replace(/,/g, "");
  let match = clean.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (match) {
    const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
    return validDate(year, Number(match[2]), Number(match[1]));
  }
  match = clean.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (match) return validDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = clean.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})$/i);
  if (match) {
    const month = MONTHS.get(normalizedForSearch(match[2]));
    if (month) return validDate(Number(match[3]), month, Number(match[1]));
  }
  return null;
}

function validDate(year, month, day) {
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function labeledDate(pageTexts, labels) {
  const expression = new RegExp(`(?:${labels})\\s*(?:date)?\\s*[:#-]?\\s*(${DATE_SOURCE})`, "iu");
  for (let index = 0; index < pageTexts.length; index += 1) {
    const match = pageTexts[index].match(expression);
    const normalized = normalizeDate(match?.[1]);
    if (normalized) return { value: normalized, printed: compact(match[1]), page: index + 1 };
  }
  return null;
}

function findPage(pageTexts, value) {
  const wanted = normalizedForSearch(value);
  if (!wanted) return 1;
  const index = pageTexts.findIndex((text) => normalizedForSearch(text).includes(wanted));
  return index >= 0 ? index + 1 : 1;
}

function evidence(fieldPath, value, page, confidence = 0.72, printed = value) {
  if (!value) return null;
  return {
    field_path: fieldPath,
    value_as_printed: String(printed || value).trim().slice(0, 500),
    normalized_value: String(value).trim().slice(0, 500),
    source_page: Math.max(1, page || 1),
    visual_region: "full_page",
    confidence
  };
}

function countryDetails(text) {
  const normalized = normalizedForSearch(text);
  if (normalized.includes("republic of panama") || normalized.includes("panama maritime")) return { country: "Panama", code: "PA", family: "panama" };
  if (normalized.includes("republic of honduras") || normalized.includes("republica de honduras")) return { country: "Honduras", code: "HN", family: "honduras" };
  if (normalized.includes("republic of azerbaijan") || normalized.includes("azerbaycan respublikasi")) return { country: "Azerbaijan", code: "AZ", family: "azerbaijan" };
  if (normalized.includes("republic of turkiye") || normalized.includes("turkiye cumhuriyeti") || normalized.includes("republic of turkey")) return { country: "Türkiye", code: "TR", family: "turkey" };
  return { country: null, code: null, family: "unknown" };
}

function documentType(text, fileName) {
  const normalized = normalizedForSearch(`${fileName} ${text.slice(0, 12000)}`);
  if (/\b(curriculum vitae|cv form|ozgecmis)\b/.test(normalized)) return "cv";
  if (/\bcertificate of competency|competency certificate|yeterlik belgesi\b/.test(normalized)) return "competency_certificate";
  if (/\bstcw\b/.test(normalized) && /\bcertificate\b/.test(normalized)) return "stcw_certificate";
  if (/\bcertificate of training|training certificate|sertifikat|sertifika\b/.test(normalized)) return "training_certificate";
  if (/\b(seaman s book|seafarer s book|libreta de embarque|denizci cuzdan)\b/.test(normalized)) return "seafarer_book";
  if (/\bdenizcinin sexsiyyet senedi|gemiadami cuzdan|gemi adami cuzdan\b/.test(normalized)) return "seafarer_book";
  if (/\bpassport\b/.test(normalized)) return "passport";
  if (/\bmedical (certificate|examination)|saglik raporu\b/.test(normalized)) return "medical_certificate";
  if (/\bsea service|service record|deniz hizmet\b/.test(normalized)) return "sea_service_record";
  return "unknown";
}

function holderName(text) {
  return firstMatch(text, [
    /(?:this is to certify that|certify that)[ \t]+(?:mr\.?|ms\.?|mrs\.?)?[ \t]*([\p{L}][\p{L}'’-]+(?:[ \t]+[\p{L}][\p{L}'’-]+){1,4})(?=[ \t]+(?:date of birth|born|holder|nationality|passport))/iu,
    /(?:name of (?:the )?(?:holder|seafarer)|holder(?:'s)? name|full name|ad[ıi] soyad[ıi]|soyad[ıi][, \t]+ad[ıi])[ \t]*[:#-]?[ \t]*([\p{L}][\p{L}'’-]+(?:[ \t]+[\p{L}][\p{L}'’-]+){1,4})(?=[ \t]*\n|$)/imu,
    /(?:surname and given names?)[ \t]*[:#-]?[ \t]*([\p{L}][\p{L}'’-]+(?:[ \t]+[\p{L}][\p{L}'’-]+){1,4})(?=[ \t]*\n|$)/imu
  ]);
}

function rankValue(text) {
  const labeled = firstMatch(text, [/(?:rank|capacity|position|v[əe]zif[əe]|g[öo]revi)\s*[:#-]\s*([^\n]{2,80})/iu]);
  if (labeled) return labeled;
  const candidates = [
    "Master", "Chief Officer", "Second Officer", "Third Officer", "Deck Cadet",
    "Chief Engineer", "Second Engineer", "Third Engineer", "Fourth Engineer", "Engine Cadet",
    "Electro-Technical Officer", "Electrician", "Bosun", "Able Seaman", "Ordinary Seaman",
    "Motorman", "Oiler", "Fitter", "Cook", "Steward"
  ];
  const normalized = normalizedForSearch(text);
  return candidates.find((candidate) => normalized.includes(normalizedForSearch(candidate))) || null;
}

function issuingAuthority(text, country) {
  return firstMatch(text, [
    /(?:issuing authority|authority|issued by|veren makam|ver[əe]n orqan)\s*[:#-]?\s*([^\n]{3,120})/iu,
    /approved by\s+([^\n]{3,120})/iu
  ]) || (country.code === "PA" ? "Panama Maritime Authority" : country.code === "HN" ? "DGMM - Republic of Honduras" : null);
}

function documentNumber(text) {
  return firstMatch(text, [
    /certificate\s+of\s+training\s+(?:no\.?|n[oº°.]?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9 /.-]{3,40})/iu,
    /(?:certificate|document|passport|seaman(?:'s)? book|seafarer(?:'s)? book|licen[cs]e|diploma)\s*(?:number|no\.?|n[oº°.]?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9/.-]{3,40})/iu,
    /(?:belge|sertifika|pasaport)\s*(?:no|numaras[ıi])\s*[:#-]?\s*([A-Z0-9][A-Z0-9/.-]{3,40})/iu
  ]);
}

function documentTitle(text, type) {
  const course = firstMatch(text, [
    /(minimum standards of competence(?:\s+for|\s+in)?\s+[^\n]{3,140})/iu,
    /(?:course|training|certificate title|e[ğg]itim ad[ıi])\s*[:#-]\s*([^\n]{3,160})/iu
  ]);
  if (course) return course;
  const titles = {
    passport: "Passport", seafarer_book: "Seafarer's Book", medical_certificate: "Medical Certificate",
    sea_service_record: "Sea Service Record", competency_certificate: "Certificate of Competency",
    stcw_certificate: "STCW Certificate", training_certificate: "Training Certificate", cv: "Curriculum Vitae"
  };
  return titles[type] || "Maritime Document";
}

function sourceLanguages(text) {
  const result = [];
  if (/[əƏğĞıİşŞçÇöÖüÜ]/.test(text)) result.push("Azerbaijani or Turkish");
  if (/\b(the|certificate|republic|date|holder|training)\b/i.test(text)) result.push("English");
  if (/\b(república|fecha|libreta|marítima)\b/i.test(text)) result.push("Spanish");
  if (/[\u0400-\u04ff]/.test(text)) result.push("Russian or Cyrillic");
  if (/[\u0600-\u06ff]/.test(text)) result.push("Arabic");
  return unique(result);
}

function stcwReferences(text) {
  const matches = String(text || "").match(/(?:regulation|section|table)?\s*[A-Z]?-?[IVX]{1,5}\s*\/\s*\d+(?:\s*[-/]\s*\d+)*(?:\s*,?\s*par\.?\s*\d+(?:\s*[-–]\s*\d+)?)?/giu) || [];
  return unique(matches.map((value) => compact(value, 100))).slice(0, 30);
}

function certificateCodes(text) {
  const matches = String(text || "").match(/\b(?:SH|SI|SP|SO|SA|SL|DL|DQ|SW|SJ|SR|SN)[\s:#-]*[A-Z0-9][A-Z0-9/.-]{1,30}\b/giu) || [];
  return unique(matches.map((value) => compact(value, 100))).slice(0, 40);
}

function contactDetails(text) {
  const emails = unique(String(text || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu) || []);
  const phones = unique(String(text || "").match(/(?:\+|00)?\d[\d ()-]{7,}\d/g) || []).map((value) => compact(value, 40));
  return {
    email: emails[0] || null,
    phone: phones[0] || null,
    secondary_phone: phones[1] || null,
    permanent_address: firstMatch(text, [/(?:permanent address|address|adres)\s*[:#-]\s*([^\n]{5,220})/iu]),
    nearest_airport: firstMatch(text, [/(?:nearest airport|en yak[ıi]n havaliman[ıi])\s*[:#-]\s*([^\n]{3,120})/iu])
  };
}

function localWarning(language, lowText) {
  const messages = {
    tr: lowText ? "Belgenin bazı alanları yerel OCR ile net okunamadı; lütfen görüntüyü ve çıkarılan bilgileri dikkatle kontrol edin." : "Bilgiler yerel belge okuyucu ile çıkarıldı; kaydetmeden önce belgeyle karşılaştırın.",
    az: lowText ? "Sənədin bəzi sahələri yerli OCR ilə aydın oxunmadı; məlumatları diqqətlə yoxlayın." : "Məlumat yerli sənəd oxuyucusu ilə çıxarılıb; yadda saxlamazdan əvvəl sənədlə müqayisə edin.",
    en: lowText ? "Some fields were not clearly readable by local OCR; review the document and extracted details carefully." : "Details were extracted by the local document reader; compare them with the document before saving."
  };
  return messages[language] || messages.en;
}

export function parseMaritimeOcrPages({ pageTexts, fileName, outputLanguage = "tr", usedOcr = false }) {
  const pages = pageTexts.length ? pageTexts : [""];
  const text = pages.join("\n\f\n");
  const type = documentType(text, fileName);
  const country = countryDetails(text);
  const name = holderName(text);
  const number = documentNumber(text);
  const authority = issuingAuthority(text, country);
  const birth = labeledDate(pages, "date of birth|birth date|dob|doğum tarihi|do[ğg]um tarixi");
  const issue = labeledDate(pages, "date of issue|issue date|issued on|veriliş tarihi|verilm[əe] tarixi");
  const expiry = labeledDate(pages, "date of expiry|expiry date|valid until|son geçerlilik tarihi|bitm[əe] tarixi");
  const nationality = firstMatch(text, [/(?:nationality|milliy[əe]ti|uyru[ğg]u)\s*[:#-]?\s*([\p{L}][\p{L} -]{2,50})/iu]);
  const rank = rankValue(text);
  const title = documentTitle(text, type);
  const stcw = stcwReferences(text);
  const codes = certificateCodes(text);
  const evidenceRows = [];
  const addEvidence = (fieldPath, value, page = findPage(pages, value), confidence = usedOcr ? 0.68 : 0.82, printed = value) => {
    const row = evidence(fieldPath, value, page, confidence, printed);
    if (row) evidenceRows.push(row);
  };
  addEvidence("holder_name", name);
  addEvidence("document_number", number);
  addEvidence("issuing_authority", authority);
  if (birth) addEvidence("date_of_birth", birth.value, birth.page, usedOcr ? 0.68 : 0.84, birth.printed);
  if (issue) addEvidence("issue_date", issue.value, issue.page, usedOcr ? 0.68 : 0.84, issue.printed);
  if (expiry) addEvidence("expiry_date", expiry.value, expiry.page, usedOcr ? 0.68 : 0.84, expiry.printed);
  addEvidence("rank", rank);

  const certificateLike = ["training_certificate", "stcw_certificate", "competency_certificate"].includes(type);
  const identityLike = ["passport", "seafarer_book"].includes(type);
  const certificateRecords = certificateLike ? [{
    code: codes[0] || null,
    document_number: number,
    certificate_serial: null,
    endorsement_number: null,
    title,
    title_i18n: nullableLocalized(title),
    issuing_country: country.country,
    issuing_authority: authority,
    approval_authority: null,
    approval_reference: null,
    place_of_issue: null,
    course_start_date: null,
    course_end_date: null,
    issue_date: issue?.value || null,
    expiry_date: expiry?.value || null,
    validity_status: expiry ? "dated" : "not_stated",
    rank_or_capacity: rank,
    rank_or_capacity_i18n: nullableLocalized(rank),
    stcw_references: stcw,
    source_page: findPage(pages, number || title),
    confidence: usedOcr ? 0.66 : 0.8
  }] : [];
  if (certificateRecords.length) {
    if (codes[0]) addEvidence("certificate_records[0].code", codes[0]);
    if (number) addEvidence("certificate_records[0].document_number", number);
    if (authority) addEvidence("certificate_records[0].issuing_authority", authority);
    if (rank) addEvidence("certificate_records[0].rank_or_capacity", rank);
    stcw.forEach((value, index) => addEvidence(`certificate_records[0].stcw_references[${index}]`, value));
  }

  const identityDocuments = identityLike ? [{
    kind: type === "passport" ? "passport" : "seafarer_book",
    label: title,
    issuing_country: country.country,
    document_number: number,
    issuing_authority: authority,
    place_of_issue: null,
    issue_date: issue?.value || null,
    expiry_date: expiry?.value || null,
    validity_status: expiry ? "dated" : "not_stated",
    source_page: findPage(pages, number || title),
    confidence: usedOcr ? 0.66 : 0.8
  }] : [];
  if (identityDocuments.length) {
    if (number) addEvidence("identity_documents[0].document_number", number);
    if (authority) addEvidence("identity_documents[0].issuing_authority", authority);
    if (issue) addEvidence("identity_documents[0].issue_date", issue.value, issue.page, usedOcr ? 0.68 : 0.84, issue.printed);
    if (expiry) addEvidence("identity_documents[0].expiry_date", expiry.value, expiry.page, usedOcr ? 0.68 : 0.84, expiry.printed);
  }

  const readablePages = pages.filter((page) => normalizedForSearch(page).length >= 30).length;
  const lowText = readablePages < pages.length || normalizedForSearch(text).length < 80;
  const confidence = lowText ? 0.4 : usedOcr ? 0.66 : 0.8;
  return {
    reader_version: 6,
    document_type: type,
    document_title: title,
    document_country: country.country,
    document_country_code: country.code,
    template_family: country.family,
    ocr_quality: {
      page_count: pages.length,
      unreadable_pages: pages.map((page, index) => normalizedForSearch(page).length < 30 ? index + 1 : null).filter(Boolean),
      rotated_pages: [],
      has_mrz: /P<[A-Z]{3}|I<[A-Z]{3}/.test(text),
      has_tables: /\t| {4,}/.test(text)
    },
    field_evidence: evidenceRows.slice(0, 300),
    source_languages: sourceLanguages(text),
    holder_name: name,
    family_name: null,
    given_names: null,
    middle_name: null,
    document_number: number,
    issuing_authority: authority,
    nationality,
    date_of_birth: birth?.value || null,
    place_of_birth: firstMatch(text, [/(?:place of birth|do[ğg]um yeri)\s*[:#-]?\s*([^\n]{2,80})/iu]),
    gender: firstMatch(text, [/(?:sex|gender|cinsiyet)\s*[:#-]?\s*([^\n]{1,20})/iu]),
    marital_status: firstMatch(text, [/(?:marital status|medeni hali)\s*[:#-]?\s*([^\n]{2,30})/iu]),
    issue_date: issue?.value || null,
    expiry_date: expiry?.value || null,
    validity_status: expiry ? "dated" : "not_stated",
    rank,
    rank_i18n: nullableLocalized(rank),
    nationality_i18n: nullableLocalized(nationality),
    suitable_positions: rank ? [rank] : [],
    suitable_positions_i18n: rank ? Object.fromEntries(LANGUAGES.map((language) => [language, [rank]])) : emptyLocalizedList(),
    certificate_codes: codes,
    certificate_records: certificateRecords,
    identity_documents: identityDocuments,
    education: [],
    medical_records: [],
    vaccinations: [],
    endorsements: [],
    endorsements_i18n: emptyLocalizedList(),
    restrictions: [],
    restrictions_i18n: emptyLocalizedList(),
    sea_service: [],
    languages: [],
    contact: contactDetails(text),
    physical_profile: { height_cm: null, weight_kg: null, eye_color: null, hair_color: null, shoe_size: null, overall_size: null },
    emergency_contacts: [],
    references: [],
    professional_summary: null,
    professional_summary_i18n: nullableLocalized(null),
    skills: [],
    achievements: [],
    desired_salary_amount: null,
    desired_salary_currency: null,
    availability_text: null,
    medical_fitness: type === "medical_certificate" && /\bfit\b/i.test(text) ? "fit" : "not_stated",
    notes: [],
    confidence,
    warnings: [localWarning(outputLanguage, lowText)]
  };
}

async function availableTesseractLanguages() {
  const { stdout } = await execFileAsync("tesseract", ["--list-langs"], { timeout: 15000, maxBuffer: 1024 * 1024 });
  const available = new Set(String(stdout || "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean));
  const preferred = ["eng", "tur", "aze", "rus", "ara", "deu"].filter((language) => available.has(language));
  return preferred.length ? preferred.join("+") : "eng";
}

async function runOcr(imagePath, languages) {
  const { stdout } = await execFileAsync("tesseract", [imagePath, "stdout", "-l", languages, "--psm", "6"], {
    timeout: LOCAL_READER_TIMEOUT_MS,
    maxBuffer: LOCAL_READER_MAX_BUFFER
  });
  return String(stdout || "");
}

async function pdfPageCount(filePath) {
  const { stdout } = await execFileAsync("pdfinfo", [filePath], { timeout: 20000, maxBuffer: 2 * 1024 * 1024 });
  const match = String(stdout || "").match(/^Pages:\s+(\d+)/mi);
  return Math.max(1, Math.min(Number(match?.[1]) || 1, LOCAL_READER_MAX_PAGES));
}

async function extractPdfPages(filePath, workDir) {
  const pageCount = await pdfPageCount(filePath);
  let textPages = [];
  try {
    const { stdout } = await execFileAsync("pdftotext", ["-layout", "-enc", "UTF-8", "-f", "1", "-l", String(pageCount), filePath, "-"], {
      timeout: 60000,
      maxBuffer: LOCAL_READER_MAX_BUFFER
    });
    textPages = String(stdout || "").split("\f").slice(0, pageCount);
  } catch {
    textPages = [];
  }
  if (normalizedForSearch(textPages.join(" ")).length >= Math.max(100, pageCount * 35)) {
    return { pageTexts: textPages.length ? textPages : [""], usedOcr: false };
  }

  const prefix = path.join(workDir, "page");
  await execFileAsync("pdftoppm", ["-jpeg", "-r", "180", "-f", "1", "-l", String(pageCount), filePath, prefix], {
    timeout: LOCAL_READER_TIMEOUT_MS,
    maxBuffer: 4 * 1024 * 1024
  });
  const languages = await availableTesseractLanguages();
  const images = (await readdir(workDir))
    .filter((name) => /^page-\d+\.jpg$/i.test(name))
    .sort((first, second) => Number(first.match(/\d+/)?.[0]) - Number(second.match(/\d+/)?.[0]));
  const pageTexts = [];
  for (const image of images) pageTexts.push(await runOcr(path.join(workDir, image), languages));
  return { pageTexts: pageTexts.length ? pageTexts : [""], usedOcr: true };
}

export async function analyzeMaritimeDocumentLocally({ bytes, mimeType, fileName, outputLanguage = "tr" }) {
  const workDir = await mkdtemp(path.join(tmpdir(), "allonahub-maritime-"));
  try {
    const extension = mimeType === "application/pdf" ? ".pdf" : mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : ".jpg";
    const filePath = path.join(workDir, `source${extension}`);
    await writeFile(filePath, Buffer.from(bytes));
    const extracted = mimeType === "application/pdf"
      ? await extractPdfPages(filePath, workDir)
      : { pageTexts: [await runOcr(filePath, await availableTesseractLanguages())], usedOcr: true };
    return parseMaritimeOcrPages({ ...extracted, fileName, outputLanguage });
  } catch (cause) {
    const error = new Error("Local maritime document reading failed", { cause });
    error.code = cause?.code === "ENOENT" ? "MARITIME_DOCUMENT_LOCAL_READER_UNAVAILABLE" : "MARITIME_DOCUMENT_LOCAL_READER_FAILED";
    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
