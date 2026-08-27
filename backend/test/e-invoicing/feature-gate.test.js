import assert from "node:assert/strict";
import test from "node:test";

test("production e-invoicing routes fail closed before touching migration tables", async () => {
  Object.assign(process.env, {
    NODE_ENV: "production",
    LOG_LEVEL: "silent",
    E_INVOICING_ENABLED: "false",
    COUNTRY_ENGINE_ENABLED: "false",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "test-anon",
    SUPABASE_SERVICE_ROLE_KEY: "test-service",
    ALLOWED_HOSTS: "localhost"
  });

  const { buildApp } = await import("../../src/app.js");
  const app = await buildApp();

  try {
    const protectedRequests = [
      ["GET", "/v1/e-invoicing/context"],
      ["GET", "/v1/account/invoice-profiles"],
      ["GET", "/v1/account/orders/00000000-0000-4000-8000-000000000000/invoices"],
      ["POST", "/v1/account/orders/00000000-0000-4000-8000-000000000000/invoice-profiles"]
    ];

    for (const [method, path] of protectedRequests) {
      const response = await app.inject({ method, url: path, headers: { host: "localhost" } });
      assert.equal(response.statusCode, 404, path);
      assert.equal(response.json().error, "E_INVOICING_DISABLED", path);
    }

    const impact = await app.inject({ method: "GET", url: "/v1/platform/impact", headers: { host: "localhost" } });
    assert.equal(impact.statusCode, 200);
    assert.deepEqual(impact.json(), { ok: true, published: false, metrics: [] });
  } finally {
    await app.close();
  }
});
