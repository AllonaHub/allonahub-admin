import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildMariPartnerJobPresentation, canReadMariPartnerFinance } from "../../src/lib/maritime-partner-center.js";

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
  assert.match(html, /js\/maripartner-i18n\.js\?v=20260920-maripartner-job2/);
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

test("MariPartner uses one theme-aware page plane instead of detached header and sidebar surfaces", () => {
  const css = read("css/maripartner.css");
  for (const token of ["--mp-canvas", "--mp-panel", "--mp-panel-soft", "--mp-header-surface"]) assert.match(css, new RegExp(token));
  assert.match(css, /\.mp-app-shell[^}]*background:\s*var\(--mp-canvas\)/s);
  assert.match(css, /\.mp-sidebar[^}]*background:\s*var\(--mp-canvas\)/s);
  assert.match(css, /\.mp-hero[^}]*background:\s*transparent[^}]*border-bottom:\s*1px solid var\(--mp-line\)[^}]*box-shadow:\s*none/s);
  assert.match(css, /data-theme="sunset"[^}]*--mp-panel:/);
  assert.match(css, /data-theme="turquoise"[^}]*--mp-panel:/);
});

test("MariPartner translates authored and dynamic UI in all nine platform languages", () => {
  const client = read("js/maripartner-i18n.js");
  const panel = read("js/maripartner.js");
  const route = read("backend/src/routes/maritime-partner-center.js");
  for (const language of ["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"]) assert.match(client, new RegExp(`"${language}"`));
  for (const phrase of ["Operasyon Merkezi", "Personel Merkezi", "Finans ve Faturalandırma", "Şirket Hesabı", "Güvenli eşleşmeler"]) assert.match(client, new RegExp(phrase));
  assert.match(client, /allona:language-changed/);
  assert.match(client, /MutationObserver/);
  assert.match(client, /ui-translations/);
  assert.match(client, /\[data-mp-company-name\]/);
  assert.match(panel, /MariPartnerI18n/);
  assert.match(panel, /applyI18n\(body\)/);
  assert.match(route, /partnerUiTranslationSchema/);
  assert.match(route, /requirePartnerMembership\(request, "ui_translation\.read"\)/);
  assert.match(route, /translateMarsohTextDetailed/);
});

test("job creation records operational requirements and invites only against open jobs", () => {
  const html = read("pages/partner/maripartner.html");
  const script = read("js/maripartner.js");
  const route = read("backend/src/routes/maritime-partner-center.js");
  for (const field of ["vessel_profile_id", "joining_date", "joining_port", "current_port", "next_port", "trading_area", "war_risk_status", "contract_label", "salary_amount", "salary_currency", "minimum_sea_service_months"]) {
    assert.match(html, new RegExp(`name="${field}"[^>]*required`));
    assert.match(script, new RegExp(`${field}:`));
  }
  assert.doesNotMatch(html.match(/<form class="mp-form mp-job-form"[\s\S]*?<\/form>/)?.[0] || "", /name="title"|name="summary"|name="vessel_type"/);
  assert.match(html, /data-mp-job-vessel-preview/);
  assert.match(html, /data-mp-job-certificates/);
  assert.match(script, /rankCertificates/);
  assert.match(script, /expiry\.max = addDays\(joining\.value, 3\)/);
  assert.match(route, /medical_required: true/);
  assert.match(route, /vessel_identity_visible: false/);
  assert.match(route, /job\.status !== "open"/);
  assert.match(route, /contract_start: body\.joining_date/);
  assert.match(route, /preferred_conditions: body\.preferred_conditions/);
});

test("smart job presentation never exposes vessel identity and converts experience months for matching", () => {
  const result = buildMariPartnerJobPresentation({
    rank_code: "oiler",
    minimum_sea_service_months: 6,
    salary_amount: 3500,
    salary_currency: "USD",
    joining_date: "2026-10-05",
    joining_port: "Pire",
    current_port: "İstanbul",
    next_port: "Valensiya",
    trading_area: "mediterranean",
    war_risk_status: "no_known_listed_area",
    contract_label: "4+1 ay"
  }, {
    vessel_name: "Gizli Gemi",
    imo_number: "9389370",
    vessel_type: "Genel Kargo",
    flag_state: "Vanuatu",
    metadata: { deadweight: 8200, gross_tonnage: 5100, year_built: 2006 }
  });
  assert.equal(result.title, "Yağcı / Motorman");
  assert.equal(result.minimum_sea_service_days, 180);
  assert.equal(result.public_vessel.deadweight, 8200);
  assert.doesNotMatch(JSON.stringify(result), /Gizli Gemi|9389370/);
});

test("public maritime jobs expose safe operational facts without vessel name or IMO", () => {
  const routes = read("backend/src/routes/index.js");
  assert.match(routes, /minimum_sea_service_months/);
  assert.match(routes, /vessel_public_profile/);
  assert.match(routes, /joining_port/);
  assert.match(routes, /war_risk_status/);
  const publicProjection = routes.match(/matching_requirements: item\.listing_type === "crew_position"[\s\S]*?smart_job_id:/)?.[0] || "";
  assert.doesNotMatch(publicProjection, /vessel_name|imo_number/);
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
