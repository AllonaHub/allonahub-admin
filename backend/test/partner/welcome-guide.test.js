import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ||= "test-anon";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service";

const { config } = await import("../../src/config.js");
const { deliverAllonaHubWelcomeGuide, welcomeGuide } = await import("../../src/lib/allonahub-welcome-guide.js");

test("guide waits for verified registration and is private", async () => {
  const sql = await readFile(new URL("../../../supabase/migrations/20260925220000_allonahub_welcome_guide_email.sql", import.meta.url), "utf8");
  assert.match(sql, /new\.email_confirmed_at is null/);
  assert.match(sql, /user_id uuid primary key/);
  assert.match(sql, /after insert or update of email_confirmed_at on auth\.users/);
  assert.match(sql, /revoke all on public\.allonahub_welcome_guide_emails from public, anon, authenticated/);
  assert.match(sql, /auth\.role\(\) is distinct from 'service_role'/);
});

test("guide tells users how to complete CV and pause matching emails", () => {
  assert.match(welcomeGuide.steps.join(" "), /Maritime CV/);
  assert.match(welcomeGuide.steps.join(" "), /Gemideyim/);
  assert.match(welcomeGuide.steps.join(" "), /onay/);
});

test("guide sends a branded single-use email without personal CV data", async () => {
  const original = config.maritimeReferenceNotifications.resendApiKey;
  config.maritimeReferenceNotifications.resendApiKey = "test-key";
  const writes = [];
  const supabase = {
    rpc: async () => ({ data: [{ user_id: "user-1", recipient: "reader@example.com" }], error: null }),
    from: () => ({ update: (value) => ({ eq() { writes.push(value); return this; }, then(resolve) { resolve({ error: null }); } }) })
  };
  try {
    const result = await deliverAllonaHubWelcomeGuide({ supabase, userId: "user-1", send: async (_url, options) => {
      const payload = JSON.parse(options.body);
      assert.equal(payload.subject, welcomeGuide.subject);
      assert.deepEqual(payload.to, ["reader@example.com"]);
      assert.match(payload.html, /allonahub-notification\.gif/);
      assert.doesNotMatch(payload.html, /allonahub-welcome\.gif/);
      assert.match(payload.html, /pages\/account\/user\.html/);
      assert.equal(options.headers["Idempotency-Key"], "allonahub-welcome-guide/user-1");
      assert.doesNotMatch(JSON.stringify(payload), /passport_number|certificate_number/i);
      return { ok: true, json: async () => ({ id: "mail-1" }) };
    } });
    assert.equal(result, "sent");
    assert.equal(writes.at(-1).status, "sent");
  } finally {
    config.maritimeReferenceNotifications.resendApiKey = original;
  }
});
