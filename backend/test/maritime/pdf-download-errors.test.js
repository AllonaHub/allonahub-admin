import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../../js/maritime-commerce.js", import.meta.url), "utf8");
function client(fetch, getDeviceKey = async () => "a".repeat(64)) {
  let nextKey = 0;
  const context = { URL, crypto: { randomUUID: () => "11111111-1111-4111-8111-111111111111" }, fetch, window: {
    crypto: { randomUUID: () => `11111111-1111-4111-8111-${String(++nextKey).padStart(12, "0")}` },
    location: { hostname: "127.0.0.1", assign() { throw new Error("Unexpected payment navigation"); } },
    Allona: { config: { apiBaseUrl: "https://api.example.invalid" },
      auth: { getSession: async () => ({ access_token: "synthetic-session" }) }, cvAccess: { getDeviceKey } }
  } };
  vm.runInNewContext(source, context);
  return context.window.AllonaMaritimeCommerce;
}
test("PDF authorization honors the configured API even on a local preview", async () => {
  const calls = [];
  const api = client(async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ ok: true, allowed: true }) };
  });
  await api.authorizeOrCheckout("global_cv_pdf");
  assert.equal(calls[0].url, "https://api.example.invalid/v1/maritime/pdf-download/authorize");
  assert.equal(calls[0].options.headers.Authorization, "Bearer synthetic-session");
  assert.equal(calls[0].options.headers["X-Allona-Device-Key"], "a".repeat(64));
});
test("network failures are not reported as invalid CV data", async () => {
  const api = client(async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(api.authorizeOrCheckout("global_cv_pdf"), error => {
    assert.equal(error.code, "MARITIME_PDF_NETWORK_ERROR");
    assert.equal(api.pdfErrorKey(error), "pdfNetworkFailed");
    return true;
  });
});
test("unconfigured bank is explicit and never bypasses paid PDF authorization", async () => {
  let calls = 0;
  const api = client(async () => {
    calls += 1;
    return { ok: false, status: calls === 1 ? 402 : 503, json: async () => ({
      ok: false, error: "Service Unavailable", code: calls === 1 ? "MARITIME_PDF_PAYMENT_REQUIRED" : "BANK_PAYMENT_NOT_CONFIGURED"
    }) };
  });
  await assert.rejects(api.authorizeOrCheckout("global_cv_pdf"), error => {
    assert.equal(error.code, "BANK_PAYMENT_NOT_CONFIGURED");
    assert.equal(api.pdfErrorKey(error), "pdfPaymentUnavailable");
    return true;
  });
  assert.equal(calls, 2);
});
test("device failures remain distinguishable from network errors", async () => {
  const api = client(() => { throw new Error("Network must not be called"); }, async () => { throw new Error("Local storage unavailable"); });
  await assert.rejects(api.authorizeOrCheckout("maritime_cv_pdf"), error => {
    assert.equal(api.pdfErrorKey(error), "pdfDeviceFailed");
    return true;
  });
});
test("an interrupted authorization reuses its key and does not spend a second download", async () => {
  const keys = [];
  const api = client(async (url, options) => {
    keys.push(JSON.parse(options.body).idempotency_key);
    if (keys.length === 1) throw new TypeError("Response lost after server accepted request");
    return { ok: true, json: async () => ({ ok: true, allowed: true }) };
  });
  await assert.rejects(api.authorizeOrCheckout("global_cv_pdf"));
  await api.authorizeOrCheckout("global_cv_pdf");
  assert.equal(keys[0], keys[1]);
  await api.authorizeOrCheckout("global_cv_pdf");
  assert.notEqual(keys[1], keys[2]);
});
test("checkout checks bank readiness before writing a pending payment", async () => {
  const route = await readFile(new URL("../../src/routes/maritime-commerce.js", import.meta.url), "utf8");
  const handler = route.slice(route.indexOf('app.post("/v1/maritime/pdf-checkout"'));
  assert.ok(handler.indexOf("if (!bankPaymentConfigured())") < handler.indexOf('.insert({ user_id: ctx.user.id'));
  assert.match(handler, /return reply\.code\(503\)\.send\(\{\s*ok: false,\s*error: "BANK_PAYMENT_NOT_CONFIGURED"/);
});
