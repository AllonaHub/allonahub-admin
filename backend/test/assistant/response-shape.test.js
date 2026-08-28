import test from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ||= "http://localhost:54321";
process.env.SUPABASE_ANON_KEY ||= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role-key";
process.env.ASSISTANT_AI_PROVIDER = "rules";
process.env.ASSISTANT_AI_API_KEY = "";

const {
  detectAssistantIntent,
  generateAssistantReply,
  sanitizeAssistantActions
} = await import("../../src/lib/assistant.js");

const RAW_URL_PATTERN = /https?:\/\//i;

function context() {
  return { conversation: { previousAssistantMessages: 0, lastAssistantMessage: "" } };
}

test("assistant topic replies send buttons without raw URLs in message text", async () => {
  const message = "AllonaHub nedir?";
  const intent = detectAssistantIntent(message);
  const reply = await generateAssistantReply({
    message,
    channel: "webchat",
    intent,
    context: context(),
    metadata: {}
  });

  assert.equal(RAW_URL_PATTERN.test(reply.message), false);
  assert.ok(reply.actions.length > 0);
  assert.ok(reply.actions.length <= 3);
});

test("assistant greeting replies are capped to three action buttons", async () => {
  const message = "Merhaba";
  const intent = detectAssistantIntent(message);
  const reply = await generateAssistantReply({
    message,
    channel: "webchat",
    intent,
    context: context(),
    metadata: {}
  });

  assert.equal(RAW_URL_PATTERN.test(reply.message), false);
  assert.equal(reply.actions.length, 3);
});

test("assistant explains itself when users ask who it is", async () => {
  const message = "Sen kimsin, ne yapabilirsin?";
  const intent = detectAssistantIntent(message);
  const reply = await generateAssistantReply({
    message,
    channel: "webchat",
    intent,
    context: context(),
    metadata: {}
  });

  assert.equal(intent.key, "assistant_identity");
  assert.match(reply.message, /AllonaHub AI destek asistan/i);
  assert.equal(RAW_URL_PATTERN.test(reply.message), false);
  assert.ok(reply.actions.length <= 3);
});

test("assistant sends only a raw URL when the user explicitly asks for a link", async () => {
  const message = "CV oluşturma linkini gönderir misin?";
  const intent = detectAssistantIntent(message);
  const reply = await generateAssistantReply({
    message,
    channel: "webchat",
    intent,
    context: context(),
    metadata: {}
  });

  assert.equal(RAW_URL_PATTERN.test(reply.message), true);
  assert.match(reply.message, /career-cv-form\.html/);
  assert.deepEqual(reply.actions, []);
});

test("assistant sends a raw URL when the user asks for a page address", async () => {
  const message = "Hakkımızda sayfasının adresini gönderir misin?";
  const intent = detectAssistantIntent(message);
  const reply = await generateAssistantReply({
    message,
    channel: "webchat",
    intent,
    context: context(),
    metadata: {}
  });

  assert.equal(RAW_URL_PATTERN.test(reply.message), true);
  assert.match(reply.message, /hakkimizda\.html/);
  assert.deepEqual(reply.actions, []);
});

test("assistant gives address management guidance without confusing it with link requests", async () => {
  const message = "Adresimi nasıl değiştirebilirim?";
  const intent = detectAssistantIntent(message);
  const reply = await generateAssistantReply({
    message,
    channel: "webchat",
    intent,
    context: context(),
    metadata: {}
  });

  assert.equal(intent.key, "address_management");
  assert.equal(RAW_URL_PATTERN.test(reply.message), false);
  assert.match(reply.message, /Adreslerim/i);
  assert.deepEqual(reply.actions.map((action) => action.label), ["Adreslerim", "Profil", "Giriş Yap"]);
});

test("assistant gives invoice download guidance without generic payment fallback", async () => {
  const message = "Faturamı nereden indirebilirim?";
  const intent = detectAssistantIntent(message);
  const reply = await generateAssistantReply({
    message,
    channel: "webchat",
    intent,
    context: context(),
    metadata: {}
  });

  assert.equal(intent.key, "invoice_receipt");
  assert.equal(RAW_URL_PATTERN.test(reply.message), false);
  assert.match(reply.message, /Siparişlerim/i);
  assert.deepEqual(reply.actions.map((action) => action.label), ["Siparişlerim", "Belgeler", "Destek"]);
});

test("assistant gives a guided start for unsure users", async () => {
  const message = "Nereden başlayacağımı bilmiyorum, beni yönlendirir misin?";
  const intent = detectAssistantIntent(message);
  const reply = await generateAssistantReply({
    message,
    channel: "webchat",
    intent,
    context: context(),
    metadata: {}
  });

  assert.equal(intent.key, "guided_start");
  assert.equal(RAW_URL_PATTERN.test(reply.message), false);
  assert.deepEqual(reply.actions.map((action) => action.label), ["Hizmetler", "CV Oluştur", "Partner Ol"]);
});

test("assistant clarifies free usage and paid steps without pushing payment", async () => {
  const message = "AllonaHub ücretsiz mi, ücretli paket var mı?";
  const intent = detectAssistantIntent(message);
  const reply = await generateAssistantReply({
    message,
    channel: "webchat",
    intent,
    context: context(),
    metadata: {}
  });

  assert.equal(intent.key, "free_pricing");
  assert.equal(RAW_URL_PATTERN.test(reply.message), false);
  assert.ok(/onayınız olmadan ödeme/i.test(reply.message));
  assert.deepEqual(reply.actions.map((action) => action.label), ["Hizmetler", "Premium", "Partner Ol"]);
});

test("assistant helps users choose the right module", async () => {
  const message = "Shop mu market mi, hangi modül bana uygun?";
  const intent = detectAssistantIntent(message);
  const reply = await generateAssistantReply({
    message,
    channel: "webchat",
    intent,
    context: context(),
    metadata: {}
  });

  assert.equal(intent.key, "module_chooser");
  assert.equal(RAW_URL_PATTERN.test(reply.message), false);
  assert.match(reply.message, /Shop/);
  assert.deepEqual(reply.actions.map((action) => action.label), ["Hizmetler", "Arama", "Destek / SSS"]);
});

test("assistant honors text-only requests without links or buttons", async () => {
  const message = "Link atma, AllonaHub nedir kısaca anlatır mısın?";
  const intent = detectAssistantIntent(message);
  const reply = await generateAssistantReply({
    message,
    channel: "webchat",
    intent,
    context: context(),
    metadata: {}
  });

  assert.equal(RAW_URL_PATTERN.test(reply.message), false);
  assert.equal(reply.actions.length, 0);
  assert.match(reply.message, /AllonaHub/);
});

test("assistant gives step guidance for CV creation questions", async () => {
  const message = "CV nasıl oluştururum?";
  const intent = detectAssistantIntent(message);
  const reply = await generateAssistantReply({
    message,
    channel: "webchat",
    intent,
    context: context(),
    metadata: {}
  });

  assert.equal(intent.key, "cv_howto");
  assert.equal(RAW_URL_PATTERN.test(reply.message), false);
  assert.match(reply.message, /adım adım/i);
  assert.deepEqual(reply.actions.map((action) => action.label), ["CV Oluştur", "Kariyer", "Denizcilik CV"]);
});

test("assistant explains how to place an order without treating it as tracking", async () => {
  const message = "Nasıl sipariş verebilirim?";
  const intent = detectAssistantIntent(message);
  const reply = await generateAssistantReply({
    message,
    channel: "webchat",
    intent,
    context: context(),
    metadata: {}
  });

  assert.equal(intent.key, "order_howto");
  assert.equal(RAW_URL_PATTERN.test(reply.message), false);
  assert.match(reply.message, /sepete ekleyin/i);
  assert.deepEqual(reply.actions.map((action) => action.label), ["Allona Shop", "Sepet", "Kuponlar"]);
});

test("assistant gives secure password reset guidance", async () => {
  const message = "Şifremi unuttum, giriş yapamıyorum";
  const intent = detectAssistantIntent(message);
  const reply = await generateAssistantReply({
    message,
    channel: "webchat",
    intent,
    context: context(),
    metadata: {}
  });

  assert.equal(intent.key, "password_reset");
  assert.equal(RAW_URL_PATTERN.test(reply.message), false);
  assert.match(reply.message, /sohbetten istemem/i);
  assert.deepEqual(reply.actions.map((action) => action.label), ["Şifremi Unuttum", "Giriş Yap", "Destek"]);
});

test("assistant action sanitizer deduplicates repeated destinations", () => {
  const actions = sanitizeAssistantActions([
    { type: "open_url", label: "Destek", url: "https://allonahub.com/pages/company/destek.html" },
    { type: "open_url", label: "Destek Tekrar", url: "https://allonahub.com/pages/company/destek.html" },
    { type: "open_url", label: "Hizmetler", url: "https://allonahub.com/index.html#modules" },
    { type: "open_url", label: "İletişim", url: "https://allonahub.com/pages/company/iletisim.html" },
    { type: "open_url", label: "Fazla", url: "https://allonahub.com/fazla.html" }
  ]);

  assert.deepEqual(actions.map((action) => action.label), ["Destek", "Hizmetler", "İletişim"]);
});
