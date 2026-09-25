import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  MARIPARTNER_JOB_RANKS,
  MARIPARTNER_RANK_CERTIFICATE_CODES,
  MARIPARTNER_CONTRACT_OPTIONS,
  buildMariPartnerJobPresentation,
  canReadMariPartnerFinance,
  recommendedVesselCertificateCodes,
  reviewMariPartnerJobForAutomaticPublication
} from "../../src/lib/maritime-partner-center.js";

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

test("operations center keeps bulk creation beside the primary new-job action", () => {
  const html = read("pages/partner/maripartner.html");
  const actions = html.match(/<section class="mp-quick-actions"[\s\S]*?<\/section>/)?.[0] || "";
  assert.equal((actions.match(/<button/g) || []).length, 7);
  assert.match(actions, /class="mp-quick-action-group"/);
  for (const label of ["Yeni İlan", "Toplu İlan", "Hazır Aday Bul", "Aday Havuzu", "Acil Personel Bul", "Eşleşmeleri Gör", "Bekleyen İşlemleri Gör"]) assert.match(actions, new RegExp(label));
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

test("MariPartner keeps URL state, a locked light theme and responsive safeguards", () => {
  const html = read("pages/partner/maripartner.html");
  const script = read("js/maripartner.js");
  const platform = read("js/platform.js");
  const css = read("css/maripartner.css");
  assert.match(html, /data-platform-controls-slot="home"/);
  assert.match(html, /js\/platform\.js/);
  assert.match(html, /data-theme="white" data-partner-theme-locked="true"/);
  assert.match(html, /css\/maripartner\.css\?v=20260925-private-pool2/);
  assert.match(html, /js\/platform\.js\?v=20260920-partner-light1/);
  assert.match(html, /js\/maripartner-i18n\.js\?v=20260920-maripartner-job6/);
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
  assert.match(platform, /PARTNER_THEME_LOCKED/);
  assert.match(platform, /const selected = PARTNER_THEME_LOCKED \? "white"/);
  assert.match(platform, /PARTNER_THEME_LOCKED \? "" : `<div class="platform-control platform-control--theme"/);
  assert.match(platform, /themes: PARTNER_THEME_LOCKED \? themes\.filter/);
  assert.match(platform, /document\.documentElement\.setAttribute\("data-theme", selected\)/);
});

test("MariPartner uses one light page plane instead of detached header and sidebar surfaces", () => {
  const css = read("css/maripartner.css");
  for (const token of ["--mp-canvas", "--mp-panel", "--mp-panel-soft", "--mp-input", "--mp-raised", "--mp-header-surface"]) assert.match(css, new RegExp(token));
  assert.match(css, /\.mp-app-shell[^}]*background:\s*var\(--mp-canvas\)/s);
  assert.match(css, /\.mp-sidebar[^}]*background:\s*var\(--mp-canvas\)/s);
  assert.match(css, /\.mp-hero[^}]*background:\s*transparent[^}]*border-bottom:\s*1px solid var\(--mp-line\)[^}]*box-shadow:\s*none/s);
  assert.match(css, /data-theme="white"[^}]*--mp-canvas:\s*#edf7fc/);
  assert.match(css, /\.mp-drawer[^}]*background:\s*var\(--mp-paper\)/);
  assert.doesNotMatch(css, /body\.mp-body\[data-theme\] \.mp-drawer[^}]*background:\s*#f5f8fb/);
});

test("all partner pages are marked for the light theme and platform controls enforce it", () => {
  const pages = [
    "e-donusum.html", "index.html", "kurucu-uyelik.html", "maripartner.html", "maritime-partner.html", "maritime-review.html", "partner-cargo-settings.html",
    "partner-integration-premium.html", "partner-order-detail.html", "partner-orders.html", "partner-panel.html",
    "partner-premium-checkout.html", "partner-product-detail.html", "partner-products.html", "partner-uyelik.html",
    "partner.html", "pay.html", "pazaryeri-satis.html"
  ];
  for (const page of pages) {
    const html = read(`pages/partner/${page}`);
    assert.match(html, /data-theme="white"/i, `${page} açık temayla başlamalı`);
    assert.match(html, /data-partner-theme-locked="true"/i, `${page} tema kilidine sahip olmalı`);
    if (/js\/platform\.js/.test(html)) {
      assert.match(html, /platform\.js\?v=20260920-partner-light1/, `${page} kilitli platform sürümünü kullanmalı`);
    }
  }
});

test("MariPartner translates authored and dynamic UI in all nine platform languages", () => {
  const client = read("js/maripartner-i18n.js");
  const panel = read("js/maripartner.js");
  const route = read("backend/src/routes/maritime-partner-center.js");
  for (const language of ["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"]) assert.match(client, new RegExp(`"${language}"`));
  for (const phrase of ["Operasyon Merkezi", "Personel Merkezi", "Finans ve Faturalandırma", "Şirket Hesabı", "Güvenli eşleşmeler", "Yeni İlan", "Tek pozisyon", "Toplu İlan", "Birden çok rütbe"]) assert.match(client, new RegExp(phrase));
  assert.match(client, /allona:language-changed/);
  assert.match(client, /MutationObserver/);
  assert.match(client, /ui-translations/);
  assert.match(client, /\[data-mp-company-name\]/);
  for (const phrase of ["Toplu İlan Oluştur", "Tek işlem, bağımsız ilanlar", "Gemi ve ortak sefer koşulları", "Rütbe ilanı", "Kişi sayısı"]) assert.match(client, new RegExp(phrase));
  assert.match(panel, /MariPartnerI18n/);
  assert.match(panel, /applyI18n\(body\)/);
  assert.match(route, /partnerUiTranslationSchema/);
  assert.match(route, /requirePartnerMembership\(request, "ui_translation\.read"\)/);
  assert.match(route, /translateMarsohTextDetailed/);
});

test("single and bulk job creation record independent matching requirements", () => {
  const html = read("pages/partner/maripartner.html");
  const script = read("js/maripartner.js");
  const route = read("backend/src/routes/maritime-partner-center.js");
  for (const field of ["vessel_profile_id", "joining_date", "joining_port", "current_port", "next_port", "trading_area", "war_risk_status", "contract_code", "salary_amount", "salary_currency", "minimum_sea_service_months", "openings_count", "current_position_confirmed"]) {
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
  assert.match(route, /submission_source: "partner"/);
  assert.doesNotMatch(route, /submission_source: "maripartner"/);
  assert.match(route, /job\.status !== "open"/);
  assert.match(route, /contract_start: body\.joining_date/);
  assert.match(route, /preferred_conditions: body\.preferred_conditions/);
  assert.match(html, /Toplu İlan Oluştur/);
  assert.match(html, /id="mpJobBulkTemplate"/);
  assert.match(script, /\/v1\/maritime\/partner-center\/jobs\/bulk/);
  assert.match(script, /Aynı gemi ve rütbe iki kez eklenemez/);
  assert.match(route, /app\.post\("\/v1\/maritime\/partner-center\/jobs\/bulk"/);
  assert.match(route, /client_batch_id/);
  assert.match(route, /Aynı gemi ve rütbe için kişi sayısını artırın/);
  assert.match(route, /openings_count: body\.openings_count/);
  assert.match(route, /maripartner\.job_batch_submitted/);
  assert.match(route, /maritime_jobs"\)\.delete\(\)\.in\("id"/);
});

test("smart job presentation never exposes vessel identity and converts experience months for matching", () => {
  const result = buildMariPartnerJobPresentation({
    rank_code: "able_engine_rating",
    minimum_sea_service_months: 6,
    salary_amount: 3500,
    salary_currency: "USD",
    joining_date: "2026-10-05",
    joining_port: "Pire",
    current_port: "İstanbul",
    next_port: "Valensiya",
    trading_area: "mediterranean",
    war_risk_status: "no_known_listed_area",
    contract_code: "four_plus_one",
    openings_count: 3
  }, {
    vessel_name: "Gizli Gemi",
    imo_number: "9389370",
    vessel_type: "Genel Kargo",
    flag_state: "Vanuatu",
    metadata: { deadweight: 8200, gross_tonnage: 5100, year_built: 2006 }
  });
  assert.equal(result.title, "Usta Yağcı / Usta Makine Tayfası (STCW III/5)");
  assert.equal(result.minimum_sea_service_days, 180);
  assert.equal(result.public_vessel.deadweight, 8200);
  assert.equal(result.route.contract_label, "4+1 aylık kontrat");
  assert.match(result.summary, /en az 6 ay deniz hizmeti bulunan 3 Usta Yağcı \/ Usta Makine Tayfası \(STCW III\/5\)/);
  assert.match(result.detail_label, /^3 kişi · 4\+1 aylık kontrat/);
  assert.doesNotMatch(result.summary, /kontrat 4\+1 aylık kontrat/);
  assert.doesNotMatch(JSON.stringify(result), /Gizli Gemi|9389370/);
});

test("automatic publication is deny-by-default unless vessel, route and company confirmation are safe", () => {
  const input = {
    current_position_confirmed: true,
    war_risk_status: "no_known_listed_area",
    preferred_conditions: "",
    war_risk_note: ""
  };
  const vessel = { status: "verified", verification_status: "verified", reapproval_required: false };
  assert.deepEqual(reviewMariPartnerJobForAutomaticPublication(input, vessel), {
    approved: true,
    rule_version: "maripartner-auto-review-v1",
    reason_codes: ["STRUCTURED_REQUIREMENTS_COMPLETE"]
  });
  assert.equal(reviewMariPartnerJobForAutomaticPublication({
    ...input,
    preferred_conditions: "İlk çıkan adaylar uygundur"
  }, vessel).approved, true);
  const unsafe = reviewMariPartnerJobForAutomaticPublication({
    ...input,
    preferred_conditions: "Ek tercih yönetici tarafından değerlendirilmelidir.",
    war_risk_note: "Rotada ek risk beyanı var.",
    war_risk_status: "route_under_review"
  }, { ...vessel, verification_status: "pending" });
  assert.equal(unsafe.approved, false);
  assert.deepEqual(unsafe.reason_codes, ["VESSEL_VERIFICATION_REQUIRED", "ROUTE_RISK_REVIEW_REQUIRED", "FREE_TEXT_REVIEW_REQUIRED"]);
});

test("job cards localize rank codes and keep headcount separate from matching identity", () => {
  const script = read("js/maripartner.js");
  assert.match(script, /const rankLabel = jobRankLabels\[item\.rank_code\] \|\| title/);
  assert.match(script, /openings > 1 \? `\$\{openings\} kişi` : null/);
  assert.doesNotMatch(script, /textContent\s*=\s*item\.rank_code/);
});

test("contract choices include reliever work and cap standard contracts at 9+1 months", () => {
  assert.equal(MARIPARTNER_CONTRACT_OPTIONS.relief_2_months, "2 aylık değiştirmeci kontratı");
  assert.equal(MARIPARTNER_CONTRACT_OPTIONS.relief_3_months, "3 aylık değiştirmeci kontratı");
  assert.equal(MARIPARTNER_CONTRACT_OPTIONS.nine_plus_one, "9+1 aylık kontrat");
  assert.equal(Object.values(MARIPARTNER_CONTRACT_OPTIONS).some((label) => /^10/.test(label)), false);
});

test("vessel certificate recommendations stay optional and rank aware", () => {
  assert.deepEqual(recommendedVesselCertificateCodes("Chemical Tanker", "chief_engineer"), ["SA", "V/1-1-BASIC", "V/1-1-CHEM-ADV"]);
  assert.deepEqual(recommendedVesselCertificateCodes("Chemical Tanker", "oiler"), ["SA", "V/1-1-BASIC"]);
  assert.deepEqual(recommendedVesselCertificateCodes("LNG Tanker", "master"), ["V/1-2-BASIC", "V/1-2-GAS-ADV"]);
});

test("partner job ranks cover cadets, deck and engine ratings, tanker crew, electrical and hotel roles", () => {
  const html = read("pages/partner/maripartner.html");
  const script = read("js/maripartner.js");
  const expected = [
    "deck_cadet", "bosun", "deck_boy", "fourth_engineer", "engine_cadet", "engine_bosun",
    "able_engine_rating", "motorman", "oiler", "wiper", "fitter", "welder", "eto",
    "electro_technical_rating", "pumpman", "chief_cook", "cook", "steward"
  ];
  expected.forEach((rank) => {
    assert.ok(MARIPARTNER_JOB_RANKS[rank], `${rank} must be accepted by the server`);
    assert.ok(Array.isArray(MARIPARTNER_RANK_CERTIFICATE_CODES[rank]), `${rank} must have a certificate policy`);
    assert.match(html, new RegExp(`value="${rank}"`));
    assert.match(script, new RegExp(`${rank}:`));
  });
  assert.deepEqual(MARIPARTNER_RANK_CERTIFICATE_CODES.able_engine_rating, ["III/5", "VI/2-1"]);
  assert.deepEqual(MARIPARTNER_RANK_CERTIFICATE_CODES.bosun, ["II/5", "VI/2-1"]);
  assert.deepEqual(MARIPARTNER_RANK_CERTIFICATE_CODES.pumpman, ["II/4"]);
  for (const code of ["FITTER", "WELDER", "FOOD-HYG"]) assert.match(script, new RegExp(`(?:"${code}"|${code}):`));
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
