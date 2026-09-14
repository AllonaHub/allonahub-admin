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

function firstPageMatch(pageTexts, patterns) {
  for (let index = 0; index < pageTexts.length; index += 1) {
    const value = firstMatch(pageTexts[index], patterns);
    if (value) return { value, page: index + 1 };
  }
  return null;
}

function normalizedName(value) {
  return compact(String(value || "")
    .replace(/[<|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim(), 240);
}

function plausibleName(value, maxWords = 6) {
  const clean = normalizedName(value);
  if (!clean || /\d/.test(clean)) return null;
  const words = clean.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > maxWords) return null;
  if (!words.every((word) => /^[\p{L}'’-]+$/u.test(word))) return null;
  const normalized = normalizedForSearch(clean);
  if (/\b(date|birth|nationality|passport|document|authority|republic|certificate|maritime|gender|sex|height|address|email|phone|signature|surname|given name)\b/.test(normalized)) return null;
  return clean;
}

function splitHumanName(holder, explicitFamily = null, explicitGiven = null, explicitMiddle = null) {
  const family = plausibleName(explicitFamily, 3);
  const given = plausibleName(explicitGiven, 4);
  const middle = plausibleName(explicitMiddle, 3);
  const full = plausibleName(holder || [given, middle, family].filter(Boolean).join(" "));
  if (family || given) return { holder_name: full || [given, middle, family].filter(Boolean).join(" "), family_name: family, given_names: given, middle_name: middle };
  const parts = String(full || "").split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { holder_name: full, family_name: null, given_names: full, middle_name: null };
  return {
    holder_name: full,
    family_name: parts.at(-1),
    given_names: parts.slice(0, -1).join(" "),
    middle_name: null
  };
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

function mrzDate(value, kind) {
  const match = String(value || "").replace(/O/g, "0").match(/^(\d{2})(\d{2})(\d{2})$/);
  if (!match) return null;
  const currentYear = new Date().getUTCFullYear();
  const shortYear = Number(match[1]);
  const year = kind === "birth"
    ? (2000 + shortYear > currentYear ? 1900 + shortYear : 2000 + shortYear)
    : 2000 + shortYear;
  return validDate(year, Number(match[2]), Number(match[3]));
}

function normalizeMrzLine(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9<]/g, "");
}

function parsePassportMrz(text) {
  const lines = String(text || "").split(/\r?\n/).map(normalizeMrzLine).filter((line) => line.length >= 38);
  for (let index = 0; index < lines.length - 1; index += 1) {
    const first = lines[index];
    const second = lines[index + 1];
    if (!/^P</.test(first) || second.length < 38) continue;
    const nameZone = first.slice(5, 44);
    const [familyRaw, givenRaw = ""] = nameZone.split("<<");
    const familyName = normalizedName(familyRaw.replace(/</g, " "));
    const givenNames = normalizedName(givenRaw.replace(/</g, " "));
    const documentNumber = compact(second.slice(0, 9).replace(/</g, "").replace(/O/g, "0"), 40);
    const nationalityCode = second.slice(10, 13).replace(/</g, "");
    const dateOfBirth = mrzDate(second.slice(13, 19), "birth");
    const gender = second.slice(20, 21) === "M" ? "Male" : second.slice(20, 21) === "F" ? "Female" : null;
    const expiryDate = mrzDate(second.slice(21, 27), "expiry");
    return {
      holder_name: normalizedName([givenNames, familyName].filter(Boolean).join(" ")),
      family_name: familyName,
      given_names: givenNames,
      document_number: documentNumber,
      nationality_code: nationalityCode || null,
      date_of_birth: dateOfBirth,
      gender,
      expiry_date: expiryDate
    };
  }
  return null;
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
  const normalized = normalizedForSearch(String(text || "").slice(0, 30000));
  const normalizedFileName = normalizedForSearch(fileName);
  const clearCv = /\b(curriculum vitae|cv form|ozgecmis)\b/.test(normalized)
    && /\b(personal details|personal information|sea service|sea experience|work experience|education|contact)\b/.test(normalized);
  if (clearCv) return "cv";
  if (/\bcertificate of competency|competency certificate|yeterlik belgesi\b/.test(normalized)) return "competency_certificate";
  if (/\bstcw\b/.test(normalized) && /\bcertificate\b/.test(normalized)) return "stcw_certificate";
  if (/\bcertificate of training|training certificate|sertifikat|sertifika\b/.test(normalized)) return "training_certificate";
  if (/\b(seaman s book|seafarer s book|libreta de embarque|denizci cuzdan)\b/.test(normalized)) return "seafarer_book";
  if (/\bdenizcinin sexsiyyet senedi|gemiadami cuzdan|gemi adami cuzdan\b/.test(normalized)) return "seafarer_book";
  if (/\bpassport\b/.test(normalized) || /\bP<[A-Z]{3}/.test(String(text || "").toUpperCase())) return "passport";
  if (/\bmedical (certificate|examination)|saglik raporu\b/.test(normalized)) return "medical_certificate";
  if (/\bsea service|service record|deniz hizmet\b/.test(normalized)) return "sea_service_record";
  if (/\b(curriculum vitae|cv form|ozgecmis)\b/.test(normalizedFileName)) return "cv";
  return "unknown";
}

function holderName(text) {
  return firstMatch(text, [
    /(?:this is to certify that|certify that)[ \t]+(?:mr\.?|ms\.?|mrs\.?)?[ \t]*([\p{L}][\p{L}'’-]+(?:[ \t]+[\p{L}][\p{L}'’-]+){1,4})(?=[ \t]+(?:date of birth|born|holder|nationality|passport))/iu,
    /(?:name of (?:the )?(?:holder|seafarer)|holder(?:'s)? name|full name|ad[ıi] soyad[ıi]|soyad[ıi][, \t]+ad[ıi])[ \t]*[:#-]?[ \t]*([\p{L}][\p{L}'’-]+(?:[ \t]+[\p{L}][\p{L}'’-]+){1,4})(?=[ \t]*\n|$)/imu,
    /(?:surname and given names?)[ \t]*[:#-]?[ \t]*([\p{L}][\p{L}'’-]+(?:[ \t]+[\p{L}][\p{L}'’-]+){1,4})(?=[ \t]*\n|$)/imu,
    /(?:ad[ıi][ \t]+soyad[ıi]|adı[ \t]+və[ \t]+soyadı|soyadı[ \t]+və[ \t]+adı)[ \t]*[:#-]?[ \t]*([\p{L}][\p{L}'’-]+(?:[ \t]+[\p{L}][\p{L}'’-]+){1,4})(?=[ \t]*\n|$)/imu
  ]);
}

function labeledIdentity(pageTexts, mrz) {
  const family = firstPageMatch(pageTexts, [
    /(?:^|\n)[ \t]*(?:soyad[ıi]|surname|family name|familiya)[ \t]*(?:\/[^:\n]+)?[ \t]*[:#-]?[ \t]*([\p{L}][\p{L}'’-]*(?:[ \t]+[\p{L}][\p{L}'’-]*){0,3})(?=[ \t]*\n|$)/imu
  ]);
  const given = firstPageMatch(pageTexts, [
    /(?:^|\n)[ \t]*(?:ad[ıi]|given names?|first names?|name)[ \t]*(?:\/[^:\n]+)?[ \t]*[:#-]?[ \t]*([\p{L}][\p{L}'’-]*(?:[ \t]+[\p{L}][\p{L}'’-]*){0,3})(?=[ \t]*\n|$)/imu
  ]);
  const middle = firstPageMatch(pageTexts, [
    /(?:^|\n)[ \t]*(?:ata ad[ıi]|patronymic|middle name)[ \t]*(?:\/[^:\n]+)?[ \t]*[:#-]?[ \t]*([\p{L}][\p{L}'’-]*(?:[ \t]+[\p{L}][\p{L}'’-]*){0,2})(?=[ \t]*\n|$)/imu
  ]);
  const named = splitHumanName(
    mrz?.holder_name,
    mrz?.family_name || family?.value,
    mrz?.given_names || given?.value,
    middle?.value
  );
  return { ...named, page: family?.page || given?.page || middle?.page || null };
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
    /(?:belge|sertifika|pasaport|s[əe]n[əe]d)\s*(?:no|n[oö]mr[əe]si|numaras[ıi])\s*[:#-]?\s*([A-Z0-9][A-Z0-9/.-]{3,40})/iu,
    /(?:passport no|passport number|document no|s[əe]n[əe]din n[oö]mr[əe]si)\s*[:#-]?\s*([A-Z0-9][A-Z0-9/.-]{3,40})/iu
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

function contactDetails(pageTexts, type) {
  if (type !== "cv") {
    return { email: null, phone: null, secondary_phone: null, permanent_address: null, nearest_airport: null };
  }
  const cvText = pageTexts
    .filter((page) => documentType(page, "") === "cv")
    .slice(0, 3)
    .join("\n");
  const email = firstMatch(cvText, [/(?:personal\s+)?(?:e-?mail|email address)\s*[:#-]\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/iu]);
  const phonePattern = /(?:mobile|phone|telephone|telefon|mobil)\s*[:#-]\s*((?:\+|00)?\d[\d ()-]{7,}\d)/giu;
  const phones = unique([...cvText.matchAll(phonePattern)].map((match) => compact(match[1], 40)));
  return {
    email,
    phone: phones[0] || null,
    secondary_phone: phones[1] || null,
    permanent_address: firstMatch(cvText, [/(?:permanent address|home address|ikamet adresi)\s*[:#-]\s*([^\n]{5,220})/iu]),
    nearest_airport: firstMatch(cvText, [/(?:nearest airport|en yak[ıi]n havaliman[ıi])\s*[:#-]\s*([^\n]{3,120})/iu])
  };
}

function normalizedGender(value) {
  const normalized = normalizedForSearch(value);
  if (["m", "male", "erkek", "kisi"].includes(normalized)) return "Male";
  if (["f", "female", "kadin", "qadin"].includes(normalized)) return "Female";
  return null;
}

function cleanPlaceOfBirth(value) {
  const clean = compact(value, 80);
  const normalized = normalizedForSearch(clean);
  if (!clean || /\d/.test(clean) || /\b(nationality|milliyyeti|height|gender|sex|date|passport|document)\b/.test(normalized)) return null;
  return clean;
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
  const mrz = parsePassportMrz(text);
  const labeledName = labeledIdentity(pages, mrz);
  const name = labeledName.holder_name || holderName(text) || mrz?.holder_name || null;
  const nameParts = splitHumanName(name, labeledName.family_name || mrz?.family_name, labeledName.given_names || mrz?.given_names, labeledName.middle_name);
  const number = type === "cv" ? null : type === "passport" ? mrz?.document_number || documentNumber(text) : documentNumber(text) || mrz?.document_number || null;
  const authority = type === "cv" ? null : issuingAuthority(text, country);
  const mrzBirth = mrz?.date_of_birth ? { value: mrz.date_of_birth, printed: mrz.date_of_birth, page: findPage(pages, mrz.date_of_birth) } : null;
  const birth = type === "passport"
    ? mrzBirth || labeledDate(pages, "date of birth|birth date|dob|doğum tarihi|do[ğg]um tarixi")
    : labeledDate(pages, "date of birth|birth date|dob|doğum tarihi|do[ğg]um tarixi") || mrzBirth;
  const issue = labeledDate(pages, "date of issue|issue date|issued on|veriliş tarihi|verilm[əe] tarixi");
  const expiry = labeledDate(pages, "date of expiry|expiry date|valid until|son geçerlilik tarihi|bitm[əe] tarixi|etibarl[ıi]l[ıi]q m[üu]dd[əe]ti") || (mrz?.expiry_date ? { value: mrz.expiry_date, printed: mrz.expiry_date, page: findPage(pages, mrz.expiry_date) } : null);
  const mrzNationality = ({ AZE: "Azerbaijani", TUR: "Turkish", PAN: "Panamanian", HND: "Honduran" }[mrz?.nationality_code] || null);
  const labeledNationality = firstMatch(text, [/(?:nationality|milliy[əe]ti|v[əe]t[əe]ndaşl[ıi]ğ[ıi]|uyru[ğg]u)\s*(?:\/[^:\n]+)?\s*[:#-]?\s*([\p{L}][\p{L} -]{2,50})/iu]);
  const nationality = type === "passport" ? mrzNationality || labeledNationality : labeledNationality || mrzNationality;
  const placeOfBirth = cleanPlaceOfBirth(firstMatch(text, [/(?:place of birth|do[ğg]um yeri|do[ğg]uldu[ğg]u yer)\s*(?:\/[^:\n]+)?\s*[:#-]?\s*([^\n]{2,80})/iu]));
  const gender = type === "passport"
    ? mrz?.gender || normalizedGender(firstMatch(text, [/(?:sex|gender|cinsiyet|cinsi)\s*(?:\/[^:\n]+)?\s*[:#-]?\s*([^\n]{1,20})/iu]))
    : normalizedGender(firstMatch(text, [/(?:sex|gender|cinsiyet|cinsi)\s*(?:\/[^:\n]+)?\s*[:#-]?\s*([^\n]{1,20})/iu])) || mrz?.gender || null;
  const rank = rankValue(text);
  const title = documentTitle(text, type);
  const stcw = stcwReferences(text);
  const codes = certificateCodes(text);
  const evidenceRows = [];
  const addEvidence = (fieldPath, value, page = findPage(pages, value), confidence = usedOcr ? 0.68 : 0.82, printed = value) => {
    const row = evidence(fieldPath, value, page, confidence, printed);
    if (row) evidenceRows.push(row);
  };
  addEvidence("holder_name", name, labeledName.page || findPage(pages, name));
  addEvidence("document_number", number);
  addEvidence("issuing_authority", authority);
  if (birth) addEvidence("date_of_birth", birth.value, birth.page, usedOcr ? 0.68 : 0.84, birth.printed);
  if (issue) addEvidence("issue_date", issue.value, issue.page, usedOcr ? 0.68 : 0.84, issue.printed);
  if (expiry) addEvidence("expiry_date", expiry.value, expiry.page, usedOcr ? 0.68 : 0.84, expiry.printed);
  addEvidence("rank", rank);

  const pageFacts = pages.map((pageText, index) => {
    const pageType = documentType(pageText, "");
    const pageCountry = countryDetails(pageText);
    const pageMrz = parsePassportMrz(pageText);
    const pageNumber = pageType === "passport" ? pageMrz?.document_number || documentNumber(pageText) : documentNumber(pageText);
    const pageIssue = labeledDate([pageText], "date of issue|issue date|issued on|veriliş tarihi|verilm[əe] tarixi");
    const pageExpiry = labeledDate([pageText], "date of expiry|expiry date|valid until|son geçerlilik tarihi|bitm[əe] tarixi|etibarl[ıi]l[ıi]q m[üu]dd[əe]ti")
      || (pageMrz?.expiry_date ? { value: pageMrz.expiry_date } : null);
    return {
      page: index + 1,
      text: pageText,
      type: pageType,
      country: pageCountry,
      number: pageNumber,
      title: documentTitle(pageText, pageType),
      authority: issuingAuthority(pageText, pageCountry),
      issue: pageIssue?.value || null,
      expiry: pageExpiry?.value || null,
      rank: rankValue(pageText),
      codes: certificateCodes(pageText),
      stcw: stcwReferences(pageText)
    };
  });
  const certificateFacts = pageFacts.filter((item) => ["training_certificate", "stcw_certificate", "competency_certificate"].includes(item.type));
  if (!certificateFacts.length && ["training_certificate", "stcw_certificate", "competency_certificate"].includes(type)) {
    certificateFacts.push({ page: findPage(pages, number || title), type, country, number, title, authority, issue: issue?.value || null, expiry: expiry?.value || null, rank, codes, stcw });
  }
  const certificateRecords = unique(certificateFacts.map((item) => JSON.stringify({
    code: item.codes[0] || null,
    document_number: item.number,
    certificate_serial: null,
    endorsement_number: null,
    title: item.title,
    title_i18n: nullableLocalized(item.title),
    issuing_country: item.country.country,
    issuing_authority: item.authority,
    approval_authority: null,
    approval_reference: null,
    place_of_issue: null,
    course_start_date: null,
    course_end_date: null,
    issue_date: item.issue,
    expiry_date: item.expiry,
    validity_status: item.expiry ? "dated" : "not_stated",
    rank_or_capacity: item.rank,
    rank_or_capacity_i18n: nullableLocalized(item.rank),
    stcw_references: item.stcw,
    source_page: item.page,
    confidence: usedOcr ? 0.66 : 0.8
  }))).map((item) => JSON.parse(item));
  certificateRecords.forEach((row, recordIndex) => {
    if (row.code) addEvidence(`certificate_records[${recordIndex}].code`, row.code, row.source_page);
    if (row.document_number) addEvidence(`certificate_records[${recordIndex}].document_number`, row.document_number, row.source_page);
    if (row.issuing_authority) addEvidence(`certificate_records[${recordIndex}].issuing_authority`, row.issuing_authority, row.source_page);
    if (row.rank_or_capacity) addEvidence(`certificate_records[${recordIndex}].rank_or_capacity`, row.rank_or_capacity, row.source_page);
    row.stcw_references.forEach((value, stcwIndex) => addEvidence(`certificate_records[${recordIndex}].stcw_references[${stcwIndex}]`, value, row.source_page));
  });

  const identityFacts = pageFacts.filter((item) => ["passport", "seafarer_book"].includes(item.type));
  if (!identityFacts.length && ["passport", "seafarer_book"].includes(type)) {
    identityFacts.push({ page: findPage(pages, number || title), type, country, number, title, authority, issue: issue?.value || null, expiry: expiry?.value || null });
  }
  const identityDocuments = unique(identityFacts.map((item) => JSON.stringify({
    kind: item.type === "passport" ? "passport" : "seafarer_book",
    label: item.title,
    issuing_country: item.country.country,
    document_number: item.number,
    issuing_authority: item.authority,
    place_of_issue: null,
    issue_date: item.issue,
    expiry_date: item.expiry,
    validity_status: item.expiry ? "dated" : "not_stated",
    source_page: item.page,
    confidence: usedOcr ? 0.66 : 0.8
  }))).map((item) => JSON.parse(item));
  identityDocuments.forEach((row, recordIndex) => {
    if (row.document_number) addEvidence(`identity_documents[${recordIndex}].document_number`, row.document_number, row.source_page);
    if (row.issuing_authority) addEvidence(`identity_documents[${recordIndex}].issuing_authority`, row.issuing_authority, row.source_page);
    if (row.issue_date) addEvidence(`identity_documents[${recordIndex}].issue_date`, row.issue_date, row.source_page);
    if (row.expiry_date) addEvidence(`identity_documents[${recordIndex}].expiry_date`, row.expiry_date, row.source_page);
  });

  const medicalFacts = pageFacts.filter((item) => item.type === "medical_certificate");
  if (!medicalFacts.length && type === "medical_certificate") {
    medicalFacts.push({ page: findPage(pages, number || title), type, country, number, title, authority, issue: issue?.value || null, expiry: expiry?.value || null, text });
  }
  const medicalRecords = medicalFacts.map((item) => {
    const medicalText = item.text || "";
    const result = /\bunfit\b/i.test(medicalText) ? "unfit" : /\bfit(?:\s+for\s+(?:sea|duty|service))?\b/i.test(medicalText) ? "fit" : "not_stated";
    return {
      record_type: "medical_certificate",
      document_number: item.number,
      result,
      restrictions: [],
      issuing_authority: item.authority,
      place_of_issue: null,
      issue_date: item.issue,
      expiry_date: item.expiry,
      validity_status: item.expiry ? "dated" : "not_stated",
      source_page: item.page,
      confidence: usedOcr ? 0.66 : 0.8
    };
  });
  medicalRecords.forEach((row, index) => {
    if (row.document_number) addEvidence(`medical_records[${index}].document_number`, row.document_number, row.source_page);
    if (row.issuing_authority) addEvidence(`medical_records[${index}].issuing_authority`, row.issuing_authority, row.source_page);
    if (row.issue_date) addEvidence(`medical_records[${index}].issue_date`, row.issue_date, row.source_page);
    if (row.expiry_date) addEvidence(`medical_records[${index}].expiry_date`, row.expiry_date, row.source_page);
  });

  const readablePages = pages.filter((page) => normalizedForSearch(page).length >= 30).length;
  const lowText = readablePages < pages.length || normalizedForSearch(text).length < 80;
  const confidence = lowText ? 0.4 : usedOcr ? 0.66 : 0.8;
  return {
    reader_version: 7,
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
    holder_name: nameParts.holder_name,
    family_name: nameParts.family_name,
    given_names: nameParts.given_names,
    middle_name: nameParts.middle_name,
    document_number: number,
    issuing_authority: authority,
    nationality,
    date_of_birth: birth?.value || null,
    place_of_birth: placeOfBirth,
    gender,
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
    medical_records: medicalRecords,
    vaccinations: [],
    endorsements: [],
    endorsements_i18n: emptyLocalizedList(),
    restrictions: [],
    restrictions_i18n: emptyLocalizedList(),
    sea_service: [],
    languages: [],
    contact: contactDetails(pages, type),
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
    medical_fitness: medicalRecords.find((row) => row.result !== "not_stated")?.result || "not_stated",
    notes: [],
    confidence,
    warnings: [localWarning(outputLanguage, lowText)]
  };
}

async function availableTesseractLanguages() {
  const { stdout } = await execFileAsync("tesseract", ["--list-langs"], { timeout: 15000, maxBuffer: 1024 * 1024 });
  const available = new Set(String(stdout || "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean));
  const preferred = ["eng", "tur", "aze", "spa", "rus", "ara", "deu"].filter((language) => available.has(language));
  return preferred.length ? preferred.join("+") : "eng";
}

async function runOcrPass(imagePath, languages, pageSegmentationMode) {
  const { stdout } = await execFileAsync("tesseract", [imagePath, "stdout", "-l", languages, "--psm", pageSegmentationMode, "-c", "preserve_interword_spaces=1"], {
    timeout: LOCAL_READER_TIMEOUT_MS,
    maxBuffer: LOCAL_READER_MAX_BUFFER
  });
  return String(stdout || "");
}

function mergeOcrPasses(values) {
  const seen = new Set();
  const lines = [];
  for (const value of values) {
    for (const line of String(value || "").split(/\r?\n/)) {
      const normalized = normalizedForSearch(line);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      lines.push(line.trim());
    }
  }
  return lines.join("\n");
}

async function runOcr(imagePath, languages) {
  const sparse = await runOcrPass(imagePath, languages, "11");
  const automatic = await runOcrPass(imagePath, languages, "1").catch(() => "");
  return mergeOcrPasses([sparse, automatic]);
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
  await execFileAsync("pdftoppm", ["-jpeg", "-r", "260", "-f", "1", "-l", String(pageCount), filePath, prefix], {
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
