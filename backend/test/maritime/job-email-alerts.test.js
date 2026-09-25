import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ||= "test-anon";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service";

const { config } = await import("../../src/config.js");
const { deliverMaritimeJobEmailAlert } = await import("../../src/lib/maritime-job-email-alerts.js");

test("migration queues only matching available candidates and keeps alerts private", async () => {
  const sql = await readFile(new URL("../../../supabase/migrations/20260925210000_maritime_available_rank_job_alerts.sql", import.meta.url), "utf8");
  assert.match(sql, /maritime_manual_application_rank\(cv\.profile_payload ->> 'rank'\)/);
  assert.match(sql, /workspace\.current_work_status = 'available_now'/);
  assert.match(sql, /unique \(job_id, seafarer_user_id\)/);
  assert.match(sql, /alter table public\.maritime_job_email_alerts enable row level security/);
  assert.match(sql, /revoke all on public\.maritime_job_email_alerts from public, anon, authenticated/);
  assert.match(sql, /premium_only boolean not null default false/);
  assert.match(sql, /auth\.role\(\) is distinct from 'service_role'/);
});

test("suppressed alert cannot send an email", async () => {
  const oldKey = config.maritimeReferenceNotifications.resendApiKey;
  config.maritimeReferenceNotifications.resendApiKey = "test-key";
  try {
    const result = await deliverMaritimeJobEmailAlert({
      supabase: { rpc: async () => ({ data: [], error: null }) }, id: "alert-1",
      send: async () => { throw new Error("must not send"); }
    });
    assert.equal(result, "skipped");
  } finally {
    config.maritimeReferenceNotifications.resendApiKey = oldKey;
  }
});

test("accepted alert links to the matching job and never attaches a CV", async () => {
  const oldKey = config.maritimeReferenceNotifications.resendApiKey;
  config.maritimeReferenceNotifications.resendApiKey = "test-key";
  const changes = [];
  const supabase = {
    rpc: async () => ({ data: [{ id: "alert-1", recipient: "candidate@example.com", job_id: "11111111-1111-4111-8111-111111111111", title: "Kaptan aranıyor", summary: "Yeni açık pozisyon", rank_code: "master" }], error: null }),
    from: () => ({ update: (value) => ({ eq() { changes.push(value); return this; }, then(resolve) { resolve({ error: null }); } }) })
  };
  try {
    const result = await deliverMaritimeJobEmailAlert({ supabase, id: "alert-1", send: async (_url, options) => {
      const payload = JSON.parse(options.body);
      assert.deepEqual(payload.to, ["candidate@example.com"]);
      assert.match(payload.html, /maritime-jobs\.html\?job=11111111-1111-4111-8111-111111111111/);
      assert.doesNotMatch(JSON.stringify(payload), /attachment|certificate_number|passport_number/i);
      assert.equal(options.headers["Idempotency-Key"], "maritime-job-alert/alert-1");
      return { ok: true, json: async () => ({ id: "provider-1" }) };
    } });
    assert.equal(result, "sent");
    assert.equal(changes.at(-1).status, "sent");
  } finally {
    config.maritimeReferenceNotifications.resendApiKey = oldKey;
  }
});
