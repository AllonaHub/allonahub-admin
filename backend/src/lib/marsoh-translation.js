function outputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const output of payload?.output || []) {
    for (const content of output?.content || []) {
      if (typeof content?.text === "string") return content.text;
    }
  }
  return "";
}

export async function translateMarsohText(text, targetLanguage, options = {}) {
  if (!options.apiKey) {
    const error = new Error("MarSoh translation provider is not configured.");
    error.code = "MARSOH_TRANSLATION_UNAVAILABLE";
    throw error;
  }
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
          { role: "system", content: `Translate the supplied maritime community message into ${targetLanguage}. Preserve meaning and tone. Return only the translation as plain text. Never add links or contact details.` },
          { role: "user", content: String(text || "").slice(0, 2000) }
        ]
      })
    });
    if (!response.ok) throw new Error(`MARSOH_TRANSLATION_HTTP_${response.status}`);
    const translated = outputText(await response.json()).trim().slice(0, 6000);
    if (!translated) throw new Error("MARSOH_TRANSLATION_EMPTY");
    return translated;
  } finally {
    clearTimeout(timeout);
  }
}
