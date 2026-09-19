import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyMarsohMessageLocal,
  containsHiddenPhone,
  normalizedModerationText,
  sanitizeMarsohText
} from "../../src/lib/marsoh-moderation.js";
import { translateMarsohText } from "../../src/lib/marsoh-translation.js";

test("clean maritime conversation is publishable", () => {
  const result = classifyMarsohMessageLocal("Uzun vardiyalarda ekip iletişimini nasıl güçlendiriyorsunuz?");
  assert.equal(result.recommended_action, "publish");
  assert.equal(result.category, "safe_conversation");
});

test("profanity remains rejected after separator obfuscation", () => {
  const result = classifyMarsohMessageLocal("s . i . k . t . i . r");
  assert.equal(result.recommended_action, "reject");
  assert.equal(result.rule_code, "ABUSE_PROFANITY_THREAT");
});

test("phone numbers hidden by spaces, dashes, emoji, or number words are detected", () => {
  assert.equal(containsHiddenPhone("0 532-111-22-33"), true);
  assert.equal(containsHiddenPhone("beş üç iki bir bir bir iki iki üç üç"), true);
  assert.equal(containsHiddenPhone("+90📱532📞111📞2233"), true);
  assert.equal(classifyMarsohMessageLocal("bana 0 532 111 22 33 numarasından ulaş").rule_code, "CONTACT_PHONE");
});

test("email, URL, and social contact directions are rejected", () => {
  assert.equal(classifyMarsohMessageLocal("crew (at) example (dot) com").rule_code, "CONTACT_EMAIL");
  assert.equal(classifyMarsohMessageLocal("www.example.com adresine bak").rule_code, "CONTACT_URL");
  assert.equal(classifyMarsohMessageLocal("Telegram üzerinden bana yaz").rule_code, "CONTACT_SOCIAL");
});

test("salary discussion is not mistaken for a job advertisement", () => {
  const result = classifyMarsohMessageLocal("Bu pozisyonda maaşların son yıllarda düşmesinin nedeni nedir?");
  assert.equal(result.recommended_action, "publish");
  assert.equal(result.rule_code, "SAFE_CONVERSATION");
});

test("position, salary, joining, vessel, and contact call are quarantined", () => {
  const result = classifyMarsohMessageLocal("2. zabit aranıyor, 3.500 USD, yarın katılım, tanker, WhatsApp'tan yazın.");
  assert.equal(result.recommended_action, "quarantine");
  assert.equal(result.rule_code, "RECRUITMENT_CONTEXT_HIGH");
  assert.ok(result.confidence >= 0.9);
});

test("Unicode normalization removes invisible bypass characters", () => {
  const normalized = normalizedModerationText("s\u200Bi\u200Bk\u200Bt\u200Bi\u200Br");
  assert.equal(normalized, "siktir");
  assert.equal(classifyMarsohMessageLocal("s\u200Bi\u200Bk\u200Bt\u200Bi\u200Br").recommended_action, "reject");
});

test("HTML and script input remains inert plain text data", () => {
  const input = "<script>alert(1)</script><b>vardiya</b>";
  assert.equal(sanitizeMarsohText(input), input);
  assert.equal(classifyMarsohMessageLocal(input).recommended_action, "publish");
});

test("translation never produces a fake result without a configured provider", async () => {
  await assert.rejects(() => translateMarsohText("Merhaba", "en", {}), (error) => error.code === "MARSOH_TRANSLATION_UNAVAILABLE");
});

test("translation provider sends a maritime plain-text request and returns provider output", async () => {
  let requestBody;
  const translated = await translateMarsohText("Vardiya düzeni nasıl?", "de", {
    apiKey: "test-key",
    baseUrl: "https://provider.example/v1/responses",
    model: "translation-test",
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return { ok: true, json: async () => ({ output_text: "Wie ist der Wachplan?" }) };
    }
  });
  assert.equal(translated, "Wie ist der Wachplan?");
  assert.match(requestBody.input[0].content, /German/);
  assert.match(requestBody.input[0].content, /plain text/);
  assert.equal(requestBody.input[1].content, "Vardiya düzeni nasıl?");
});

test("translation rejects unsupported target languages before contacting a provider", async () => {
  let called = false;
  await assert.rejects(() => translateMarsohText("Merhaba", "xx", {
    apiKey: "test-key",
    baseUrl: "https://provider.example/v1/responses",
    model: "translation-test",
    fetchImpl: async () => { called = true; return { ok: true, json: async () => ({ output_text: "x" }) }; }
  }), (error) => error.code === "MARSOH_TRANSLATION_LANGUAGE_UNSUPPORTED");
  assert.equal(called, false);
});
