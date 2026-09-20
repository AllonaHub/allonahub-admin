import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { canReadMariPartnerFinance } from "../../src/lib/maritime-partner-center.js";

const root = new URL("../../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("MariPartner exposes exactly eight primary navigation entries", () => {
  const html = read("pages/partner/maripartner.html");
  const navigation = html.match(/<nav class="mp-primary-nav"[\s\S]*?<\/nav>/)?.[0] || "";
  const labels = [...navigation.matchAll(/<strong>([^<]+)<\/strong>/g)].map((match) => match[1]);
  assert.deepEqual(labels, [
    "Operasyon Merkezi",
    "Personel Merkezi",
    "İlanlar",
    "Gemiler",
    "MarSoh",
    "Bildirimler",
    "Finans ve Faturalandırma",
    "Şirket Hesabı"
  ]);
});

test("operations center uses real data hooks and five distinct primary actions", () => {
  const html = read("pages/partner/maripartner.html");
  const actions = html.match(/<section class="mp-quick-actions"[\s\S]*?<\/section>/)?.[0] || "";
  assert.equal((actions.match(/<button/g) || []).length, 5);
  for (const label of ["Yeni İlan Oluştur", "Hazır Aday Bul", "Acil Personel Bul", "Eşleşmeleri Gör", "Bekleyen İşlemleri Gör"]) assert.match(actions, new RegExp(label));
  for (const counter of ["ready_to_join", "pending_interviews", "pending_offers", "urgent_replacements", "active_crew", "upcoming_relief"]) assert.match(html, new RegExp(`data-mp-count="${counter}"`));
});

test("candidate cards keep two visible actions and preserve privileged operations behind server routes", () => {
  const script = read("js/maripartner.js");
  const candidateCard = script.match(/function personnelCandidateCard[\s\S]*?\n  }/)?.[0] || "";
  const visibleActions = candidateCard.match(/mp-candidate-card__actions\">([\s\S]*?)<details/)?.[1] || "";
  assert.equal((visibleActions.match(/<button/g) || []).length, 2);
  assert.match(candidateCard, /Adayı İncele/);
  assert.match(candidateCard, /Davet Et/);
  assert.match(candidateCard, /class="mp-more"/);
  assert.match(candidateCard, /Eşleşme Nedenini Gör/);
  assert.match(script, /candidate-invitations/);
  assert.match(script, /candidate-favorites/);
});

test("finance permission is deny-by-default for ordinary partner staff", () => {
  assert.equal(canReadMariPartnerFinance({ role: "owner", permissions: {} }), true);
  assert.equal(canReadMariPartnerFinance({ role: "accounting", permissions: {} }), true);
  assert.equal(canReadMariPartnerFinance({ role: "support", permissions: { read_finance: true } }), true);
  assert.equal(canReadMariPartnerFinance({ role: "support", permissions: {} }), false);
  assert.equal(canReadMariPartnerFinance(null), false);
});

test("operations control migration is server-only and idempotency-backed", () => {
  const migration = read("supabase/migrations/20260920233000_create_maripartner_operations_controls.sql");
  const route = read("backend/src/routes/maritime-partner-center.js");
  for (const table of ["maritime_partner_notification_preferences", "maritime_partner_saved_searches", "maritime_partner_operation_requests"]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  }
  assert.match(migration, /revoke all on public\.%I from anon, authenticated/i);
  assert.match(migration, /unique \(partner_id, actor_user_id, operation_type, idempotency_key\)/i);
  assert.match(migration, /maritime_urgent_crew_requests_idempotency_uidx/i);
  assert.match(route, /urgentResult\.error\?\.code === "23505"/);
  assert.match(route, /MARIPARTNER_FINANCE_DENIED/);
  assert.match(route, /URGENT_CREW_JOB_DENIED/);
  assert.match(route, /URGENT_CREW_VESSEL_DENIED/);
  assert.match(route, /\.eq\("recipient_user_id", access\.ctx\.user\.id\)/);
});

test("MariPartner keeps URL state, theme controls and responsive safeguards", () => {
  const html = read("pages/partner/maripartner.html");
  const script = read("js/maripartner.js");
  const css = read("css/maripartner.css");
  assert.match(html, /data-platform-controls-slot="home"/);
  assert.match(html, /js\/platform\.js/);
  assert.match(script, /searchParams\.set\("view"/);
  assert.match(script, /searchParams\.set\("tab"/);
  assert.match(css, /@media \(max-width: 1100px\)/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /mp-required-incomplete/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(script, /popstate/);
  assert.match(script, /focusable/);
  assert.match(script, /legacyViewAliases/);
});

test("job creation records operational requirements and invites only against open jobs", () => {
  const html = read("pages/partner/maripartner.html");
  const script = read("js/maripartner.js");
  const route = read("backend/src/routes/maritime-partner-center.js");
  for (const field of ["vessel_type", "joining_date", "location_label", "detail_label", "salary_amount", "salary_currency"]) {
    assert.match(html, new RegExp(`name="${field}"[^>]*required`));
    assert.match(script, new RegExp(`${field}:`));
  }
  assert.match(route, /job\.status !== "open"/);
  assert.match(route, /contract_start: body\.joining_date/);
  assert.match(route, /preferred_conditions: body\.preferred_conditions/);
});

test("ready candidate filters and saved searches stay tenant and user scoped", () => {
  const html = read("pages/partner/maripartner.html");
  const script = read("js/maripartner.js");
  const route = read("backend/src/routes/maritime-partner-center.js");
  assert.match(html, /data-mp-pool-filter/);
  assert.match(html, /data-mp-filter-count/);
  assert.match(html, /data-mp-filter-save/);
  assert.match(script, /readyPoolRooms/);
  assert.match(route, /maritime_partner_saved_searches/);
  assert.match(route, /\.eq\("owner_user_id", userId\)/);
  assert.match(route, /owner_user_id: access\.ctx\.user\.id/);
});
