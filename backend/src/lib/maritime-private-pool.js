import ExcelJS from "exceljs";

export const POOL_COLUMNS = ["full_name", "rank_code", "email", "phone", "available_from", "vessel_type"];
const aliases = Object.freeze({
  ad_soyad: "full_name", "ad soyad": "full_name", name: "full_name", full_name: "full_name",
  rutbe: "rank_code", "rütbe": "rank_code", rank: "rank_code", rank_code: "rank_code",
  "e-posta": "email", eposta: "email", email: "email", "telefon": "phone", phone: "phone",
  "müsaitlik tarihi": "available_from", available_from: "available_from",
  "gemi türü": "vessel_type", vessel_type: "vessel_type"
});

function csvRows(text) {
  const rows = []; let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("CSV içinde kapanmamış tırnak var.");
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export async function parsePrivatePoolFile(buffer, name) {
  if (buffer.length > 1024 * 1024) throw new Error("Dosya 1 MB sınırını aşıyor.");
  let rows;
  if (/\.csv$/i.test(name)) rows = csvRows(new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, ""));
  else if (/\.xlsx$/i.test(name)) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount > 501 || workbook.worksheets.length > 1) throw new Error("Tek sayfada en fazla 500 aday yükleyin.");
    rows = [];
    sheet.eachRow({ includeEmpty: true }, (row) => rows.push(row.values.slice(1).map((value) => {
      if (value && typeof value === "object" && ("formula" in value || "sharedFormula" in value)) throw new Error("Formül içeren hücreler kabul edilmez.");
      return value instanceof Date ? value.toISOString().slice(0, 10) : String(value?.text || value?.result || value || "");
    })));
  } else throw new Error("Yalnız CSV veya XLSX dosyası yükleyin.");
  if (rows.length < 2 || rows.length > 501) throw new Error("Dosyada başlık ve en fazla 500 aday satırı bulunmalıdır.");
  const headers = rows.shift().map((value) => aliases[String(value).trim().toLocaleLowerCase("tr-TR")]);
  if (!headers.includes("full_name") || !headers.includes("rank_code") || headers.some((item) => !item) || new Set(headers).size !== headers.length) throw new Error("Başlıklar geçersiz. ad_soyad ve rutbe zorunludur.");
  return rows.filter((row) => row.some((value) => String(value).trim())).map((row) => Object.fromEntries(headers.map((key, index) => [key, String(row[index] || "").trim()])));
}

export function validatePoolRows(rows, rankLabels) {
  const accepted = [], rejected = [];
  const names = typeof rankLabels === "object" && !Array.isArray(rankLabels) ? rankLabels : Object.fromEntries(rankLabels.map((key) => [key, key]));
  rows.forEach((row, index) => {
    const rank = Object.entries(names).find(([code, label]) => code === row.rank_code || label.toLocaleLowerCase("tr-TR") === row.rank_code.toLocaleLowerCase("tr-TR"))?.[0];
    const reason = !row.full_name || row.full_name.length > 160 ? "Ad soyad gerekli (en fazla 160 karakter)."
      : !rank ? "Rütbe kodu tanınmıyor."
      : row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) ? "E-posta geçersiz."
      : row.phone && !/^\+?[\d ()-]{7,30}$/.test(row.phone) ? "Telefon geçersiz."
      : row.available_from && !/^\d{4}-\d{2}-\d{2}$/.test(row.available_from) ? "Tarih YYYY-MM-DD olmalıdır."
      : Object.values(row).some((value) => value.length > 200 || /^[=\t\r]/.test(value)) ? "Uzun veya formül benzeri değer kabul edilmez." : "";
    if (reason) rejected.push({ row: index + 2, reason });
    else accepted.push({ ...row, rank_code: rank });
  });
  return { accepted, rejected };
}

const folded = (value) => String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");

export function matchVerifiedFormerWorkers(candidates, relationships, profiles) {
  const verifiedIds = new Set(relationships.filter((row) => ["registry_verified", "reviewer_verified"].includes(row.verification_status)).map((row) => row.seafarer_user_id));
  const identity = new Set(profiles.filter((profile) => verifiedIds.has(profile.id) && profile.profile_visible === true && profile.email && profile.full_name)
    .map((profile) => `${folded(profile.email)}\0${folded(profile.full_name)}`));
  return candidates.map((candidate) => ({ ...candidate,
    previous_verified_worker: Boolean(candidate.email && identity.has(`${folded(candidate.email)}\0${folded(candidate.full_name)}`))
  }));
}
