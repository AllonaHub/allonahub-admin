import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Fastify from "fastify";

process.env.SUPABASE_URL = "https://global-cv.test";
process.env.SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.AUDIT_LOG_ENABLED = "false";
const { registerMaritimeSmartAccountRoutes } = await import("../../src/routes/maritime-smart-account.js");

async function harness(t, cvProfile, role = "customer") {
  const userId = "00000000-0000-4000-8000-000000000001";
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const target = new URL(String(url));
    assert.equal(target.origin, "https://global-cv.test");
    calls.push(target.pathname);
    const json = (value) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
    if (target.pathname === "/auth/v1/user") return json({ id: userId, app_metadata: { role } });
    if (target.pathname === "/rest/v1/profiles") return json({ id: userId, role, account_status: "active", module: "maritime" });
    if (target.pathname === "/rest/v1/maritime_cv_profiles") return json(cvProfile);
    if (target.pathname === "/rest/v1/maritime_seafarer_workspaces") return json(null);
    if (["/rest/v1/maritime_readiness_items", "/rest/v1/maritime_document_intakes"].includes(target.pathname)) return json([]);
    if (target.pathname === "/storage/v1/object/list/maritime-profile-photos") return json([]);
    throw new Error(`Unexpected request: ${target.pathname}`);
  };
  const app = Fastify({ logger: false });
  registerMaritimeSmartAccountRoutes(app);
  t.after(async () => { await app.close(); globalThis.fetch = originalFetch; });
  return { app, calls };
}

const prepare = (app, authenticated = true) => app.inject({
  method: "POST", url: "/v1/maritime/smart-account/prepare",
  headers: authenticated ? { authorization: "Bearer test-user" } : {}, payload: {}
});

test("Global CV preparation rejects guests and partner accounts before accessing CV data", async (t) => {
  const { app, calls } = await harness(t, null, "partner");
  assert.equal((await prepare(app, false)).statusCode, 401);
  assert.equal((await prepare(app)).statusCode, 403);
  assert.ok(!calls.includes("/rest/v1/maritime_cv_profiles"));
});

test("missing manual CV returns the specific create-CV prompt", async (t) => {
  const { app } = await harness(t, null);
  const response = await prepare(app);
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, "MARITIME_CV_REQUIRED");
});

for (const [status, confirmed] of [["draft", null], ["draft", "2026-09-20T12:00:00Z"], ["user_confirmed", null]]) {
  test(`manual CV with ${status}/${confirmed || "no confirmation"} must still pass Global CV readiness`, async (t) => {
    const { app, calls } = await harness(t, {
      profile_payload: { data_origin: "user_entered_maritime_cv" },
      profile_status: status, last_user_confirmed_at: confirmed
    });
    const response = await prepare(app);
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().code, "GLOBAL_CV_REQUIRED_FIELDS_MISSING");
    assert.ok(!calls.some((path) => path.includes("/rpc/prepare_maritime_smart_account")));
  });
}

test("restricted manual CV cannot be used for Global CV preparation", async (t) => {
  const { app } = await harness(t, {
    profile_payload: { data_origin: "user_entered_maritime_cv" },
    profile_status: "restricted", last_user_confirmed_at: null
  });
  const response = await prepare(app);
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, "MARITIME_CV_UNAVAILABLE");
});

test("confirmed manual CV still enforces essential fields and photo", async (t) => {
  const { app, calls } = await harness(t, {
    profile_payload: { data_origin: "user_entered_maritime_cv" },
    profile_status: "user_confirmed", last_user_confirmed_at: "2026-09-20T12:00:00Z"
  });
  const response = await prepare(app);
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, "GLOBAL_CV_REQUIRED_FIELDS_MISSING");
  assert.ok(!calls.some((path) => path.includes("/rpc/")));
});

test("manual Global CV migration replaces only the obsolete source guard and preserves security", async () => {
  const base = await readFile(new URL("../../../supabase/migrations/20260914060000_create_maritime_smart_account.sql", import.meta.url), "utf8");
  const migration = await readFile(new URL("../../../supabase/migrations/20260921020000_allow_confirmed_manual_global_cv.sql", import.meta.url), "utf8");
  const oldGuard = migration.match(/\$old\$([\s\S]*?)\$old\$/)[1];
  const newGuard = migration.match(/\$new\$([\s\S]*?)\$new\$/)[1];
  assert.equal(base.split(oldGuard).length, 2, "source guard must match exactly once");
  const upgraded = base.replace(oldGuard, newGuard);
  assert.ok(!upgraded.includes(oldGuard));
  assert.match(upgraded, /join public\.maritime_cv_identity_locks/);
  assert.match(upgraded, /cv\.seafarer_user_id = p_seafarer_user_id/);
  assert.match(upgraded, /cv\.last_user_confirmed_at is not null/);
  assert.match(upgraded, /auth\.role\(\) is distinct from 'service_role'/);
  assert.match(upgraded, /confirmed maritime CV or documents required/);
  assert.match(migration, /if strpos\(definition, new_guard\) > 0 then return/);
  assert.match(migration, /if strpos\(definition, old_guard\) = 0 then/);
  assert.doesNotMatch(migration, /grant |disable row level security|drop policy/i);
});

test("draft matching migration preserves identity guard and status of unchanged approved CVs", async () => {
  const writers = await readFile(new URL("../../../supabase/migrations/20260920234500_persist_maritime_cv_drafts.sql", import.meta.url), "utf8");
  const previousGuard = await readFile(new URL("../../../supabase/migrations/20260921020000_allow_confirmed_manual_global_cv.sql", import.meta.url), "utf8");
  const migration = await readFile(new URL("../../../supabase/migrations/20260925090000_maritime_cv_draft_matching_and_status.sql", import.meta.url), "utf8");
  assert.match(writers, /set profile_status = 'draft'/);
  assert.match(writers, /set profile_status = 'user_confirmed'/);
  assert.match(previousGuard, /cv\.profile_status in \('user_confirmed', 'verification_pending', 'verified'\)/);
  assert.match(previousGuard, /and cv\.last_user_confirmed_at is not null/);
  assert.match(migration, /prepare_maritime_smart_account/);
  assert.match(migration, /cv\.profile_status in \('draft', 'user_confirmed', 'verification_pending', 'verified'\)/);
  assert.match(migration, /maritime_cv_profiles\.profile_payload = excluded\.profile_payload/);
  assert.match(migration, /then maritime_cv_profiles\.profile_status/);
  assert.match(migration, /then 'verified'/);
  assert.doesNotMatch(migration, /grant |disable row level security|drop policy/i);
});
