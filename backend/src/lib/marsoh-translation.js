function outputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const output of payload?.output || []) {
    for (const content of output?.content || []) {
      if (typeof content?.text === "string") return content.text;
    }
  }
  return "";
}

const LANGUAGE_NAMES = Object.freeze({
  tr: "Turkish", az: "Azerbaijani", en: "English", de: "German", ru: "Russian",
  ar: "Arabic", kk: "Kazakh", uz: "Uzbek", ky: "Kyrgyz"
});

function translationError(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

function translatedText(value) {
  const text = String(value || "").trim().slice(0, 6000);
  if (!text) throw translationError("MARSOH_TRANSLATION_EMPTY", "Translation provider returned an empty result.");
  return text;
}

async function localTranslation(text, sourceLanguage, targetLanguage, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.localTimeoutMs || 60000);
  try {
    const headers = { "Content-Type": "application/json" };
    if (options.localSecret) headers["X-MarSoh-Internal-Token"] = options.localSecret;
    const response = await (options.fetchImpl || fetch)(`${String(options.localUrl).replace(/\/$/, "")}/translate`, {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify({
        text,
        source_language: sourceLanguage,
        target_language: targetLanguage
      })
    });
    if (!response.ok) throw new Error(`MARSOH_LOCAL_TRANSLATION_HTTP_${response.status}`);
    const payload = await response.json();
    if (payload?.ok !== true) throw new Error("MARSOH_LOCAL_TRANSLATION_BAD_RESPONSE");
    return {
      translated_text: translatedText(payload.translated_text),
      provider: String(payload.provider || "local_ctranslate2").slice(0, 80),
      model: String(payload.model || "m2m100_418m_int8").slice(0, 120)
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function externalTranslation(text, sourceLanguage, targetLanguage, options) {
  if (!options.apiKey) throw translationError("MARSOH_TRANSLATION_UNAVAILABLE", "External translation provider is not configured.");
  const targetName = LANGUAGE_NAMES[targetLanguage];
  const sourceName = LANGUAGE_NAMES[sourceLanguage] || "the detected source language";
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
          { role: "system", content: `Translate the supplied maritime community message from ${sourceName} into ${targetName}. Preserve maritime terminology, meaning, names, numbers, and tone. Return only the translated plain text. Do not answer the message, explain the translation, add Markdown, or invent links or contact details.` },
          { role: "user", content: text }
        ]
      })
    });
    if (!response.ok) throw new Error(`MARSOH_TRANSLATION_HTTP_${response.status}`);
    return {
      translated_text: translatedText(outputText(await response.json())),
      provider: "openai_responses",
      model: String(options.model || "external").slice(0, 120)
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function translateMarsohTextDetailed(text, targetLanguage, options = {}) {
  const targetName = LANGUAGE_NAMES[targetLanguage];
  const sourceLanguage = String(options.sourceLanguage || "").trim().toLowerCase();
  if (!targetName || (sourceLanguage && !LANGUAGE_NAMES[sourceLanguage])) {
    throw translationError("MARSOH_TRANSLATION_LANGUAGE_UNSUPPORTED", "MarSoh translation language is not supported.");
  }
  const normalizedText = String(text || "").trim().slice(0, 2000);
  if (!normalizedText) throw translationError("MARSOH_TRANSLATION_EMPTY", "MarSoh message is empty.");
  if (sourceLanguage && sourceLanguage === targetLanguage) {
    return { translated_text: normalizedText, provider: "local_identity", model: "identity" };
  }

  const provider = String(options.provider || "local").trim().toLowerCase();
  let localFailure;
  if (provider !== "external" && options.localUrl && sourceLanguage) {
    try {
      return await localTranslation(normalizedText, sourceLanguage, targetLanguage, options);
    } catch (error) {
      localFailure = error;
    }
  }

  if (options.apiKey) {
    try {
      return await externalTranslation(normalizedText, sourceLanguage, targetLanguage, options);
    } catch (error) {
      throw translationError("MARSOH_TRANSLATION_UNAVAILABLE", "MarSoh translation providers are unavailable.", error);
    }
  }
  throw translationError("MARSOH_TRANSLATION_UNAVAILABLE", "MarSoh translation provider is not available.", localFailure);
}

export async function translateMarsohText(text, targetLanguage, options = {}) {
  const result = await translateMarsohTextDetailed(text, targetLanguage, options);
  return result.translated_text;
}
