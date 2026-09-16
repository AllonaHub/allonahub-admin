const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/gu;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu;
const CONFUSABLES = Object.freeze({
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y", "і": "i", "ј": "j",
  "Α": "a", "Β": "b", "Ε": "e", "Ζ": "z", "Η": "h", "Ι": "i", "Κ": "k", "Μ": "m", "Ν": "n", "Ο": "o", "Ρ": "p", "Τ": "t", "Χ": "x"
});
const LEET = Object.freeze({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "$": "s", "@": "a" });
const NUMBER_WORDS = new Map([
  ["zero", "0"], ["sifir", "0"], ["sıfır", "0"], ["sıfır", "0"], ["sifir", "0"],
  ["one", "1"], ["bir", "1"], ["two", "2"], ["iki", "2"], ["three", "3"], ["uc", "3"], ["üç", "3"],
  ["four", "4"], ["dort", "4"], ["dörd", "4"], ["dört", "4"], ["five", "5"], ["bes", "5"], ["beş", "5"],
  ["six", "6"], ["alti", "6"], ["altı", "6"], ["seven", "7"], ["yedi", "7"], ["seven", "7"],
  ["eight", "8"], ["sekiz", "8"], ["nine", "9"], ["dokuz", "9"]
]);

const PROFANITY = [
  /\b(?:amk|aq|orospu|pic|piç|siktir|sikik|fuck|fucking|bitch|motherfucker)\b/iu,
  /\b(?:geber|oldururum|öldürürüm|kill\s+you|i\s+will\s+kill|seni\s+bulurum)\b/iu
];
const HATE_OR_HARASSMENT = /\b(?:aptal|gerizekali|gerizekalı|salak|idiot|stupid|alçak|alcak)\b/iu;
const POSITION_TERMS = /\b(?:kaptan|captain|master|chief\s+officer|second\s+officer|2\.?\s*zabit|muhendis|mühendis|engineer|oiler|motorman|matros|able\s+seaman|ordinary\s+seaman|aşpaz|aspaz|cook|welder|fitter|crew|murettebat|mürettebat|denizci)\b/iu;
const SALARY_TERMS = /(?:\b(?:maas|maaş|salary|wage|ucret|ücret|usd|eur|dollar|dolar|avro)\b|[$€£]\s*\d|\d[\d.,]*\s*(?:usd|eur|dolar|avro))/iu;
const JOIN_TERMS = /\b(?:katilim|katılım|join(?:ing)?|yarin|yarın|tomorrow|acil|urgent|hemen|derhal|sign[ -]?on)\b/iu;
const VESSEL_TERMS = /\b(?:gemi|vessel|ship|tanker|bulk|cargo|kargo|container|konteyner|ro-?ro|lng|lpg)\b/iu;
const RECRUITMENT_CALL = /\b(?:araniyor|aranıyor|wanted|required|needed|basvur|başvur|apply|eleman|personel|crew\s+needed|ise\s+alim|işe\s+alım)\b/iu;
const MONEY_REQUEST = /\b(?:para\s+gonder|para\s+gönder|odeme\s+yap|ödeme\s+yap|komisyon|kapora|deposit|send\s+money|pay\s+me|crypto|bitcoin|usdt|iban)\b/iu;

function foldDiacritics(value) {
  return value.normalize("NFD").replace(/\p{M}+/gu, "");
}

export function sanitizeMarsohText(value, maxChars = 2000) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(ZERO_WIDTH, "")
    .replace(CONTROL, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxChars);
}

export function normalizedModerationText(value) {
  const safe = sanitizeMarsohText(value, 4000).toLocaleLowerCase("tr-TR");
  const confusable = [...safe].map((character) => CONFUSABLES[character] || character).join("");
  const folded = foldDiacritics(confusable);
  const leet = [...folded].map((character) => LEET[character] || character).join("");
  return leet
    .replace(/([a-zçğıöşü])(?:[\s._*\-]+)(?=[a-zçğıöşü])/giu, "$1")
    .replace(/(.)\1{3,}/gu, "$1$1")
    .replace(/\s+/g, " ")
    .trim();
}

function numberWordsToDigits(value) {
  return String(value).replace(/[\p{L}]+/gu, (word) => NUMBER_WORDS.get(word.toLocaleLowerCase("tr-TR")) || word);
}

export function containsHiddenPhone(value) {
  const normalized = numberWordsToDigits(sanitizeMarsohText(value, 4000).toLocaleLowerCase("tr-TR"));
  const candidate = /(?:\+?\d[\s().\-–—_/📞☎📱]*){7,15}/gu;
  return [...normalized.matchAll(candidate)].some((match) => {
    const digits = match[0].replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15;
  });
}

function containsEmail(value) {
  const normalized = sanitizeMarsohText(value, 4000)
    .toLocaleLowerCase("tr-TR")
    .replace(/\s*(?:\[|\()?\s*(?:at|et)\s*(?:\]|\))?\s*/g, "@")
    .replace(/\s*(?:\[|\()?\s*(?:dot|nokta)\s*(?:\]|\))?\s*/g, ".");
  return /[a-z0-9._%+-]{1,64}@[a-z0-9.-]+\.[a-z]{2,24}/iu.test(normalized);
}

function containsUrl(value) {
  return /(?:https?:\/\/|www\.|\b[a-z0-9-]{2,63}\.(?:com|net|org|io|co|me|app|ru|tr|az)\b)/iu.test(value);
}

function containsSocialHandle(value) {
  return /(?:^|\s)@[a-z0-9_.]{2,32}\b/iu.test(value)
    || /\b(?:whats?app|telegram|instagram|facebook|tiktok|signal)\b.{0,36}\b(?:yaz|mesaj|dm|ulaş|ulas|contact|add)\b/iu.test(value)
    || /\b(?:yaz|mesaj|dm|ulaş|ulas|contact|add)\b.{0,36}\b(?:whats?app|telegram|instagram|facebook|tiktok|signal)\b/iu.test(value);
}

function languageOf(value) {
  const text = String(value || "").toLocaleLowerCase("tr-TR");
  if (/[əxq]/u.test(text)) return "az";
  if (/[çğıöşü]/u.test(text)) return "tr";
  if (/\b(?:the|and|with|what|why|ship|crew|salary)\b/i.test(text)) return "en";
  return "und";
}

function result(category, confidence, ruleCode, language, explanation, action, signals = []) {
  return {
    category,
    confidence,
    rule_code: ruleCode,
    language,
    administrator_explanation: explanation,
    recommended_action: action,
    signals,
    classifier_version: "marsoh-hybrid-v1"
  };
}

export function classifyMarsohMessageLocal(value) {
  const original = sanitizeMarsohText(value, 4000);
  const normalized = normalizedModerationText(original);
  const language = languageOf(original);

  if (containsEmail(original)) return result("contact_information", 0.99, "CONTACT_EMAIL", language, "E-posta adresi veya gizlenmiş e-posta örüntüsü algılandı.", "reject", ["email"]);
  if (containsHiddenPhone(original)) return result("contact_information", 0.98, "CONTACT_PHONE", language, "Telefon numarası veya sayı sözcükleriyle gizlenmiş numara algılandı.", "reject", ["phone"]);
  if (containsUrl(original)) return result("contact_information", 0.98, "CONTACT_URL", language, "Harici bağlantı algılandı.", "reject", ["url"]);
  if (PROFANITY.some((pattern) => pattern.test(normalized))) return result("abuse", 0.97, "ABUSE_PROFANITY_THREAT", language, "Küfür, ağır argo veya tehdit örüntüsü algılandı.", "reject", ["abuse"]);
  if (HATE_OR_HARASSMENT.test(normalized)) return result("harassment", 0.91, "ABUSE_HARASSMENT", language, "Hakaret veya taciz ifadesi algılandı.", "reject", ["harassment"]);

  const signals = [];
  if (POSITION_TERMS.test(original)) signals.push("position");
  if (SALARY_TERMS.test(original)) signals.push("salary");
  if (JOIN_TERMS.test(original)) signals.push("joining");
  if (VESSEL_TERMS.test(original)) signals.push("vessel");
  if (RECRUITMENT_CALL.test(original)) signals.push("recruitment_call");
  if (MONEY_REQUEST.test(original)) signals.push("money_request");
  if (containsSocialHandle(original)) signals.push("social_direction");

  const questionOnly = /[?？]\s*$/u.test(original) && !RECRUITMENT_CALL.test(original) && !JOIN_TERMS.test(original);
  if (signals.includes("money_request")) {
    return result("fraud_or_payment", 0.94, "FRAUD_PAYMENT_REQUEST", language, "Para, komisyon, IBAN veya kripto talebi sinyali algılandı.", "quarantine", signals);
  }
  if (!questionOnly && signals.length >= 3 && (signals.includes("recruitment_call") || signals.includes("joining"))) {
    return result("recruitment", Math.min(0.99, 0.72 + signals.length * 0.05), "RECRUITMENT_CONTEXT_HIGH", language, "Pozisyon, ücret, katılım, gemi ve işe alım sinyalleri birlikte değerlendirildi.", "quarantine", signals);
  }
  if (signals.includes("social_direction")) {
    return result("contact_information", 0.96, "CONTACT_SOCIAL", language, "Sosyal medya hesabı veya dış platforma yönlendirme algılandı.", "reject", signals);
  }
  if (!questionOnly && signals.length === 2 && signals.includes("recruitment_call")) {
    return result("recruitment", 0.63, "RECRUITMENT_CONTEXT_REVIEW", language, "İşe alım çağrısı bağlamsal inceleme gerektiriyor.", "quarantine", signals);
  }
  return result("safe_conversation", questionOnly ? 0.94 : 0.9, "SAFE_CONVERSATION", language, "Topluluk sohbeti olarak değerlendirildi.", "publish", signals);
}

function responseText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const output of payload?.output || []) {
    for (const content of output?.content || []) {
      if (typeof content?.text === "string") return content.text;
    }
  }
  return "";
}

async function remoteClassification(text, options) {
  if (!options?.apiKey) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 12000);
  try {
    const response = await (options.fetchImpl || fetch)(options.baseUrl, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: options.model,
        temperature: 0,
        input: [
          { role: "system", content: "Classify a maritime community-chat message. Return strict JSON with category, confidence, rule_code, language, administrator_explanation, recommended_action. recommended_action must be publish, reject, or quarantine. Reject contact details, URLs, social handles, profanity, harassment, hate and threats. Quarantine recruitment, job ads, personnel searches, commission/payment requests and scams. A general question about salary trends is not a job ad." },
          { role: "user", content: text }
        ]
      })
    });
    if (!response.ok) throw new Error(`MARSOH_CLASSIFIER_HTTP_${response.status}`);
    const raw = responseText(await response.json()).trim().replace(/^```json\s*|\s*```$/g, "");
    const parsed = JSON.parse(raw);
    if (!['publish', 'reject', 'quarantine'].includes(parsed.recommended_action)) throw new Error("MARSOH_CLASSIFIER_BAD_ACTION");
    return result(
      String(parsed.category || "semantic_review").slice(0, 80),
      Math.max(0, Math.min(Number(parsed.confidence) || 0.5, 1)),
      String(parsed.rule_code || "SEMANTIC_REVIEW").slice(0, 80),
      String(parsed.language || "und").slice(0, 8),
      String(parsed.administrator_explanation || "Semantic classifier decision.").slice(0, 500),
      parsed.recommended_action,
      ["semantic_provider"]
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function classifyMarsohMessage(value, options = {}) {
  const local = classifyMarsohMessageLocal(value);
  if (local.recommended_action !== "publish") return local;
  try {
    const remote = await remoteClassification(sanitizeMarsohText(value, 4000), options);
    if (!remote) return local;
    return remote.recommended_action === "publish" ? { ...local, classifier_version: "marsoh-hybrid-v1+provider" } : remote;
  } catch {
    // Deterministically clean messages stay available; any locally suspicious
    // message was already quarantined before the provider call.
    return { ...local, classifier_version: "marsoh-hybrid-v1-provider-unavailable" };
  }
}

export const MARSOH_PUBLIC_REJECTION = Object.freeze({
  CONTACT_EMAIL: "Gönderilemedi — iletişim bilgisi paylaşımı yasaktır",
  CONTACT_PHONE: "Gönderilemedi — iletişim bilgisi paylaşımı yasaktır",
  CONTACT_URL: "Gönderilemedi — iletişim bilgisi paylaşımı yasaktır",
  CONTACT_SOCIAL: "Gönderilemedi — iletişim bilgisi paylaşımı yasaktır",
  ABUSE_PROFANITY_THREAT: "Gönderilemedi — topluluk kurallarına aykırı ifade",
  ABUSE_HARASSMENT: "Gönderilemedi — topluluk kurallarına aykırı ifade"
});
