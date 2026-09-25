import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ||= "test-anon";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service";

const { maritimeAdminNotificationForAudit, queueMaritimeAdminNotification, deliverDueMaritimeAdminNotifications } = await import("../../src/lib/maritime-admin-notifications.js");
const { config } = await import("../../src/config.js");

test("joining requests create a minimal internal email without passenger details", () => {
  const event = maritimeAdminNotificationForAudit({
    action: "maripartner.joining_created",
    resourceType: "maritime_joining_operation",
    resourceId: "11111111-1111-4111-8111-111111111111",
    actorId: "22222222-2222-4222-8222-222222222222",
    requestId: "request-1",
    metadata: { partner_id: "33333333-3333-4333-8333-333333333333", requested_services: ["flight", "hotel"], passport_number: "DO_NOT_EMAIL" }
  });
  assert.equal(event.recipient, "allonahub@gmail.com");
  assert.match(event.subject, /yerleştirme/);
  assert.match(event.body_text, /flight, hotel/);
  assert.doesNotMatch(event.body_text, /DO_NOT_EMAIL|passport_number/);
  assert.equal(maritimeAdminNotificationForAudit({ action: "maripartner.joining_updated", resourceId: event.resource_id, metadata: { requested_services: [] } }), null);
});

test("unrelated actions are not emailed and duplicate event is only queued once", async () => {
  assert.equal(maritimeAdminNotificationForAudit({ action: "maripartner.candidate_cv_viewed", resourceId: "abc" }), null);
  const rows = new Map();
  let inserts = 0;
  const supabase = {
    from(name) {
      assert.equal(name, "maritime_admin_email_outbox");
      return {
        upsert(event) {
          inserts += Number(!rows.has(event.event_key));
          rows.set(event.event_key, rows.get(event.event_key) || { id: "id-1", status: "queued" });
          return { select: async () => ({ data: [rows.get(event.event_key)], error: null }) };
        }
      };
    }
  };
  const event = maritimeAdminNotificationForAudit({ action: "maritime.partner_application.created", resourceId: "app-1", requestId: "req-1" });
  await queueMaritimeAdminNotification({ supabase, event });
  await queueMaritimeAdminNotification({ supabase, event });
  assert.equal(inserts, 1);
});

test("outbox migration blocks direct client access and uses an atomic service-only claim", async () => {
  const sql = await readFile(new URL("../../../supabase/migrations/20260925180000_maritime_admin_email_outbox.sql", import.meta.url), "utf8");
  assert.match(sql, /unique/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.maritime_admin_email_outbox from public, anon, authenticated/);
  assert.match(sql, /auth\.role\(\) <> 'service_role'/);
  assert.match(sql, /lease_until/);
});

test("provider failure stays queued for retry and successful retry retains one provider id", async () => {
  const oldKey = config.maritimeAdminNotifications.resendApiKey;
  config.maritimeAdminNotifications.resendApiKey = "test-key";
  const row = { id: "id-1", event_key: "event-1", status: "queued", recipient: "allonahub@gmail.com", subject: "Test", body_text: "Minimal test", attempts: 0 };
  const supabase = {
    rpc: async () => {
      if (row.status === "sent") return { data: [], error: null };
      row.status = "sending";
      row.attempts += 1;
      return { data: [{ ...row }], error: null };
    },
    from() {
      return {
        upsert(event) { return { select: async () => ({ data: [{ ...row }], error: null }) }; },
        update(change) { Object.assign(row, change); return { eq() { return this; }, then(resolve) { resolve({ error: null }); } }; },
        select() { return { in() { return this; }, lte() { return this; }, order() { return this; }, limit: async () => ({ data: [{ id: row.id }], error: null }) }; }
      };
    }
  };
  const event = { event_key: row.event_key };
  try {
    const first = await queueMaritimeAdminNotification({ supabase, event, send: async () => ({ ok: false, status: 503, json: async () => ({}) }) });
    assert.equal(first, "failed");
    assert.equal(row.last_error, "EMAIL_PROVIDER_HTTP_503");
    const second = await deliverDueMaritimeAdminNotifications({ supabase, send: async (_url, options) => {
      const payload = JSON.parse(options.body);
      assert.match(payload.html, /AllonaHub/);
      assert.match(payload.html, /DENİZCİLİK YÖNETİM BİLDİRİMİ/);
      assert.equal(payload.text, row.body_text);
      return { ok: true, json: async () => ({ id: "provider-1" }) };
    } });
    assert.equal(second.sent, 1);
    assert.equal(row.provider_message_id, "provider-1");
    assert.equal(await queueMaritimeAdminNotification({ supabase, event, send: async () => { throw new Error("duplicate delivery"); } }), "sent");
  } finally {
    config.maritimeAdminNotifications.resendApiKey = oldKey;
  }
});
