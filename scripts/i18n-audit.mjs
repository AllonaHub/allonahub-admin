import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const targetLanguage = process.argv[2] || "en";
const sourceDirs = ["pages", "admin"];
const sourceFiles = ["index.html", "allonahub-akademi.html", "js/layout.v3.js", "js/platform.js"];

function walk(dir, output = []) {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return output;
  for (const name of fs.readdirSync(absolute)) {
    const filePath = path.join(absolute, name);
    const relative = path.relative(root, filePath);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (!relative.includes("docs/archive")) walk(relative, output);
      continue;
    }
    if (/\.(html|js)$/i.test(name)) output.push(relative);
  }
  return output;
}

function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, filePath), "utf8"));
  } catch {
    return fallback;
  }
}

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function shouldSkip(value) {
  const text = normalize(value);
  if (!text || text.length < 2 || text.length > 220) return true;
  if (/^(Allona|Hub|AllonaHub|AllonaHub Logo|HP|VIP|AMEX|Visa|Mastercard|App Store|Google Play)$/i.test(text)) return true;
  if (/^(Elite|Elite Black|Kadıköy)$/i.test(text)) return true;
  if (text === "'da.") return true;
  if (/^(WhatsApp|Instagram|Facebook|YouTube|LinkedIn|Telegram|TikTok|Nsosyal|E-Mail|X|𝕏|in)$/i.test(text)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return true;
  if (/^(www\.)?[a-z0-9.-]+\.[a-z]{2,}$/i.test(text)) return true;
  if (/^\+?\d+\s*HP$/i.test(text)) return true;
  if (/^\+?\d[\d\s().-]{5,}$/.test(text)) return true;
  if (/^\+90\s*5x{2}/i.test(text)) return true;
  if (/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D\s]+$/u.test(text)) return true;
  if (/^\d[\d.,]*\s*(m²|m2|m|km|kg|gr|DWT)$/i.test(text)) return true;
  if (/\d/.test(text) && /\b(dk|m²|m2|m|km|kg|gr|DWT|HP|₺|TL|EUR|USD|build|charter)\b|[%₺€$↑•]/i.test(text)) return true;
  if (/^\d+\.\s+[A-ZÇĞİÖŞÜa-zçğıöşü ]{2,24}$/.test(text)) return true;
  if (/^[a-f0-9]{20,}$/i.test(text)) return true;
  if (/^(width=|initial-scale=|minimum-scale=|maximum-scale=|user-scalable=)/i.test(text)) return true;
  if (/[`${}]/.test(text)) return true;
  if (/^[A-Z0-9+&/ .-]{2,18}$/.test(text) && !/[ÇĞİÖŞÜçğıöşü]/.test(text)) return true;
  if (/^[\d\s.,:;!?%₺€$+/#()[\]-]+$/.test(text)) return true;
  if (/^(https?:|mailto:|tel:|data:)/i.test(text)) return true;
  if (/^[A-Za-z0-9_-]+\.(html|js|css|svg|png|jpg|jpeg|webp)([?#].*)?$/i.test(text)) return true;
  if (/^[{}()[\];,.'"`]+$/.test(text)) return true;
  if (/^<|>$/.test(text)) return true;
  return false;
}

function collectPhrases(filePath, phrases) {
  const raw = fs.readFileSync(path.join(root, filePath), "utf8")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const patterns = [
    />\s*([^<>]+?)\s*</g,
    /\b(?:placeholder|aria-label|title|alt)=["']([^"']+)["']/g,
    /\bcontent=["']([^"']+)["']/g,
    /\bdata-i18n=["']([^"']+)["']/g
  ];

  for (const pattern of patterns) {
    for (const match of raw.matchAll(pattern)) {
      const phrase = normalize(match[1]);
      if (shouldSkip(phrase)) continue;
      if (!phrases.has(phrase)) phrases.set(phrase, new Set());
      phrases.get(phrase).add(filePath);
    }
  }
}

function catalogPhrases(language) {
  const catalog = readJson("i18n/catalog.json", { phrases: {} });
  const phrases = {};
  for (const [source, translations] of Object.entries(catalog.phrases || {})) {
    if (language === "tr") {
      phrases[source] = translations.tr || source;
      continue;
    }
    if (translations && translations[language]) phrases[source] = translations[language];
  }
  return phrases;
}

function languagePhrases(language) {
  const pack = readJson(`i18n/${language}.json`, { phrases: {} });
  return {
    ...(pack.phrases || {}),
    ...catalogPhrases(language)
  };
}

function hasTranslation(phrase, dictionary) {
  if (dictionary[phrase]) return true;
  const normalizedPhrase = normalize(phrase);
  if (dictionary[normalizedPhrase]) return true;
  return Object.entries(dictionary)
    .filter(([source, translated]) => source && translated && source !== translated)
    .some(([source]) => normalizedPhrase.includes(source));
}

const files = [
  ...sourceFiles.filter((file) => fs.existsSync(path.join(root, file))),
  ...sourceDirs.flatMap((dir) => walk(dir))
];
const phrases = new Map();
files.forEach((file) => collectPhrases(file, phrases));

const dictionary = languagePhrases(targetLanguage);
const missing = [...phrases.entries()]
  .filter(([phrase]) => !hasTranslation(phrase, dictionary))
  .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0], "tr"));

const total = phrases.size;
const covered = total - missing.length;
const percent = total ? Math.round((covered / total) * 1000) / 10 : 100;

console.log(`Language: ${targetLanguage}`);
console.log(`Unique phrases: ${total}`);
console.log(`Covered: ${covered}`);
console.log(`Missing: ${missing.length}`);
console.log(`Coverage: ${percent}%`);

if (missing.length) {
  console.log("\nTop missing phrases:");
  missing.slice(0, 80).forEach(([phrase, fileSet]) => {
    console.log(`- ${phrase} (${[...fileSet].slice(0, 3).join(", ")})`);
  });
}
