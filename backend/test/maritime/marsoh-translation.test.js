import test from "node:test";
import assert from "node:assert/strict";
import { translateMarsohText, translateMarsohTextDetailed } from "../../src/lib/marsoh-translation.js";


test("local server translation works without a paid API key", async () => {
  let requestedUrl;
  let requestBody;
  const result = await translateMarsohTextDetailed("Vardiya güvenliği önemlidir.", "en", {
    sourceLanguage: "tr",
    provider: "local",
    localUrl: "http://marsoh-translator:8080",
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          ok: true,
          translated_text: "Watchkeeping safety is important.",
          provider: "local_ctranslate2",
          model: "m2m100"
        })
      };
    }
  });

  assert.equal(requestedUrl, "http://marsoh-translator:8080/translate");
  assert.deepEqual(requestBody, {
    text: "Vardiya güvenliği önemlidir.",
    source_language: "tr",
    target_language: "en"
  });
  assert.equal(result.translated_text, "Watchkeeping safety is important.");
  assert.equal(result.provider, "local_ctranslate2");
});

test("configured external provider is only used as fallback after local failure", async () => {
  const calls = [];
  const translated = await translateMarsohText("Gəmidə təhlükəsizlik vacibdir.", "de", {
    sourceLanguage: "az",
    provider: "local",
    localUrl: "http://marsoh-translator:8080",
    apiKey: "future-provider-key",
    baseUrl: "https://provider.example/v1/responses",
    model: "translation-test",
    fetchImpl: async (url) => {
      calls.push(url);
      if (String(url).includes("marsoh-translator")) return { ok: false, status: 503 };
      return { ok: true, json: async () => ({ output_text: "Sicherheit an Bord ist wichtig." }) };
    }
  });

  assert.equal(translated, "Sicherheit an Bord ist wichtig.");
  assert.deepEqual(calls, ["http://marsoh-translator:8080/translate", "https://provider.example/v1/responses"]);
});

test("same-language translation stays local and does not call a provider", async () => {
  let called = false;
  const result = await translateMarsohTextDetailed("Salam dənizçilər", "az", {
    sourceLanguage: "az",
    localUrl: "http://marsoh-translator:8080",
    fetchImpl: async () => {
      called = true;
      throw new Error("must not be called");
    }
  });
  assert.equal(result.translated_text, "Salam dənizçilər");
  assert.equal(result.provider, "local_identity");
  assert.equal(called, false);
});

test("unsupported source language is rejected before local server contact", async () => {
  let called = false;
  await assert.rejects(() => translateMarsohText("Bonjour", "tr", {
    sourceLanguage: "fr",
    localUrl: "http://marsoh-translator:8080",
    fetchImpl: async () => {
      called = true;
      return { ok: true, json: async () => ({ ok: true, translated_text: "Merhaba" }) };
    }
  }), (error) => error.code === "MARSOH_TRANSLATION_LANGUAGE_UNSUPPORTED");
  assert.equal(called, false);
});
