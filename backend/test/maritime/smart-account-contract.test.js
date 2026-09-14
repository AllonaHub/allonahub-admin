import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const migrationUrl = new URL("../../../supabase/migrations/20260914060000_create_maritime_smart_account.sql", import.meta.url);
const routeUrl = new URL("../../src/routes/maritime-smart-account.js", import.meta.url);
const pageUrl = new URL("../../../pages/ecosystem/maritime-smart-account.html", import.meta.url);
const uiUrl = new URL("../../../js/allona-maritime-smart-account.js", import.meta.url);
const cssUrl = new URL("../../../css/allona-maritime-portal.css", import.meta.url);
const mainRoutesUrl = new URL("../../src/routes/index.js", import.meta.url);
const portalUrl = new URL("../../../js/allona-maritime-portal.js", import.meta.url);

test("smart account writes remain customer-only, reviewable, and separated from final submission", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /role = 'customer'/);
  assert.match(migration, /status = 'user_confirmed'/);
  assert.match(migration, /prepare_application_draft_only/);
  assert.match(migration, /final_submission_requires_new_confirmation', true/);
  assert.match(migration, /explicit submission confirmation required/);
  assert.match(migration, /explicit availability confirmation required/);
  assert.match(migration, /'awaiting_candidate_approval'/);
  assert.match(migration, /partner\.verification_status = 'verified'/);
  assert.match(migration, /partner\.partner_type = 'maritime'/);
  assert.match(migration, /trusted backend required/);
  assert.match(migration, /invalidate_maritime_smart_account_after_document_change/);
  assert.match(migration, /invalidate_maritime_smart_account_after_readiness_change/);
  assert.match(migration, /invalidate_maritime_smart_account_after_availability_change/);
  assert.match(migration, /invalidate_maritime_matches_after_job_change/);
  assert.match(migration, /match\.stale_after > now\(\)/);
  assert.match(migration, /fresh confirmed smart match required/);
  assert.match(migration, /existing_match\.stale_after <= now\(\)/);
  assert.match(migration, /critical maritime document expired/);
  assert.match(migration, /on conflict \(public_listing_id\) where public_listing_id is not null do nothing/);
  assert.match(migration, /grant execute on function public\.prepare_maritime_smart_account\(uuid, text, text, jsonb, jsonb\) to service_role/);
  assert.doesNotMatch(migration, /grant execute on function public\.prepare_maritime_smart_account\([^\n]+\) to authenticated/);
});

test("smart matching API returns public-safe matches without company identity or contacts", async () => {
  const route = await readFile(routeUrl, "utf8");
  assert.match(route, /\.select\("id"\)/);
  assert.match(route, /company_contact_visible: false/);
  assert.match(route, /delete publicMatch\.partner_id/);
  assert.match(route, /eligible: fresh && row\.hard_gate_status === "passed"/);
  assert.doesNotMatch(route, /partner_businesses"\)\s*\.select\("[^"]*(display_name|email|phone|legal_name)/);
  assert.match(route, /CUSTOMER_ACCOUNT_REQUIRED/);
  assert.match(route, /Bu alan kişisel kullanıcı hesaplarına açıktır/);
  assert.match(route, /cv_identity: await ownCvIdentity\(user\)/);
  assert.doesNotMatch(route, /metadata\.avatar_url \|\| metadata\.avatar/);
  assert.match(route, /maritimeGlobalPassportReadiness/);
  assert.match(route, /GLOBAL_PASSPORT_REQUIRED_FIELDS_MISSING/);
  assert.match(route, /profile\.webp/);
});

test("verified partner crew listings persist complete matching requirements", async () => {
  const routes = await readFile(mainRoutesUrl, "utf8");
  assert.match(routes, /rank_code: z\.string/);
  assert.match(routes, /required_certificate_codes: z\.array/);
  assert.match(routes, /minimum_sea_service_days/);
  assert.match(routes, /\.eq\("verification_status", "verified"\)/);
  assert.match(routes, /public_listing_id: listingRow\.id/);
  assert.match(routes, /matching_requirements/);
  assert.match(routes, /max\(48\)/);
});

test("smart account is a dedicated no-footer workspace with explicit approval actions", async () => {
  const [page, ui, css] = await Promise.all([readFile(pageUrl, "utf8"), readFile(uiUrl, "utf8"), readFile(cssUrl, "utf8")]);
  assert.match(page, /data-maritime-view="smart"/);
  assert.doesNotMatch(page, /<footer/i);
  assert.match(page, /data-view-link="smart"/);
  assert.match(page, /maritime-documents\.html\?mode=update#maritimeDocumentUpload/);
  assert.match(page, /data-portal-i18n="smartAccountAddDocument">Belge Ekle/);
  assert.match(page, /data-global-passport-help-toggle/);
  assert.match(page, /data-global-passport-help-card hidden/);
  assert.match(page, /data-portal-i18n="globalPassportHelpWorldwide"/);
  assert.match(page, /aria-controls="globalPassportHelp"/);
  assert.match(ui, /data-confirm-smart/);
  assert.match(ui, /data-prepare-drafts/);
  assert.match(ui, /data-prepare-all/);
  assert.match(ui, /data-open-cv/);
  assert.match(ui, /data-print-cv/);
  assert.match(ui, /window\.print\(\)/);
  assert.match(ui, /state\.cvOpen/);
  assert.match(ui, /maritime-cv-avatar/);
  assert.match(ui, /cv\.certificate_records/);
  assert.match(ui, /cv\.identity_documents/);
  assert.match(ui, /cv\.medical_records/);
  assert.match(ui, /cv\.competency_highlights/);
  assert.match(ui, /cv\.skills/);
  assert.match(ui, /cv\.achievements/);
  assert.match(ui, /row\.certificate_serial/);
  assert.match(ui, /row\.endorsement_number/);
  assert.match(ui, /row\.course_start_date/);
  assert.match(ui, /maritime-cv-neon-rail/);
  assert.match(ui, /cv\.headline_i18n/);
  assert.match(ui, /data-available-now/);
  assert.match(ui, /window\.confirm\(text\("finalConfirm"\)\)/);
  assert.match(css, /\.maritime-smart-action-rail/);
  assert.match(css, /@media print/);
  assert.match(css, /size: A4/);
  assert.match(css, /\.maritime-cv-layout/);
  assert.match(css, /border-radius: 50%/);
  assert.match(css, /\.maritime-cv-neon-rail/);
  assert.match(css, /#00eaff/);
  assert.match(css, /\.maritime-global-passport-help-card/);
  assert.match(css, /\.maritime-global-passport-help-toggle\[aria-expanded="true"\]/);
  assert.match(css, /\.maritime-global-passport-help-card \{[\s\S]*position: fixed;[\s\S]*max-height: calc\(100dvh - 24px\);[\s\S]*transform: translateY\(-50%\);/);
});

test("every smart-account label has a complete nine-language row", async () => {
  const source = await readFile(uiUrl, "utf8");
  const instrumented = source
    .replace("const copyRows = {", "const copyRows = window.__smartCopyRows = {")
    .replace("const missingLabels = {", "const missingLabels = window.__smartMissingLabels = {")
    .replace("const rankLabels = {", "const rankLabels = window.__smartRankLabels = {")
    .replace("const languageLabels = {", "const languageLabels = window.__smartLanguageLabels = {");
  const window = { Allona: {} };
  vm.runInNewContext(instrumented, {
    window,
    document: {
      documentElement: { lang: "tr" },
      addEventListener() {},
      querySelector() { return null; }
    },
    localStorage: { getItem() { return null; } },
    URL,
    console
  });
  for (const [key, row] of Object.entries(window.__smartCopyRows)) {
    assert.equal(row.length, 9, `${key} must include all nine languages`);
    assert.ok(row.every((value) => String(value).trim()), `${key} contains an empty translation`);
  }
  for (const [key, row] of Object.entries(window.__smartMissingLabels)) {
    assert.equal(row.length, 9, `${key} must include all nine languages`);
    assert.ok(row.every((value) => String(value).trim()), `${key} contains an empty translation`);
  }
  for (const collection of [window.__smartRankLabels, window.__smartLanguageLabels]) {
    for (const [key, row] of Object.entries(collection)) {
      assert.equal(row.length, 9, `${key} must include all nine languages`);
      assert.ok(row.every((value) => String(value).trim()), `${key} contains an empty translation`);
    }
  }
});

test("shared maritime navigation keeps complete translations for the smart account", async () => {
  const source = await readFile(portalUrl, "utf8");
  const instrumented = source.replace("const copyRows = {", "const copyRows = window.__portalCopyRows = {");
  const window = { Allona: {} };
  vm.runInNewContext(instrumented, {
    window,
    document: {
      body: { dataset: { maritimeView: "smart" } },
      documentElement: { lang: "tr" },
      readyState: "loading",
      addEventListener() {},
      querySelector() { return null; }
    },
    localStorage: { getItem() { return null; }, setItem() {} },
    URL,
    URLSearchParams,
    FormData,
    console
  });
  for (const key of ["smartAccountNav", "smartAccountTitle", "smartAccountLead", "smartAccountAddDocument", "globalPassportHelpLabel", "globalPassportHelpTitle", "globalPassportHelpBody", "globalPassportHelpWorldwide", "globalPassportHelpPrivacy", "globalPassportHelpClose", "seafarerStatusLabel", "seafarerStatusApproved", "seafarerStatusReview", "seafarerStatusEvidence", "seafarerStatusPending", "seafarerStatusNote"]) {
    const row = window.__portalCopyRows[key];
    assert.equal(row.length, 9, `${key} must include all nine languages`);
    assert.ok(row.every((value) => String(value).trim()), `${key} contains an empty translation`);
  }
  assert.deepEqual(Array.from(window.__portalCopyRows.smartAccountNav), Array(9).fill("GP CV"));
  assert.equal(window.__portalCopyRows.smartAccountTitle[0], "Global Pasaport CV");
  assert.match(source, /function setGlobalPassportHelp\(open, restoreFocus\)/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /function loadSeafarerClassification\(\)/);
  assert.match(source, /readiness\.seafarer_status/);
});

test("customer-only maritime pages explain account type without weakening separation", async () => {
  const source = await readFile(portalUrl, "utf8");
  const instrumented = source.replace("const copyRows = {", "const copyRows = window.__portalCopyRows = {");
  const window = { Allona: {} };
  vm.runInNewContext(instrumented, {
    window,
    document: {
      body: { dataset: { maritimeView: "documents" } },
      documentElement: { lang: "tr" },
      readyState: "loading",
      addEventListener() {},
      querySelector() { return null; }
    },
    localStorage: { getItem() { return null; }, setItem() {} },
    URL,
    URLSearchParams,
    FormData,
    console
  });
  for (const key of [
    "loginRequiredLead",
    "personalAccountRequiredTitle",
    "personalAccountRequiredLead",
    "personalAccountRule",
    "switchToPersonalAccount",
    "createPersonalAccount"
  ]) {
    const row = window.__portalCopyRows[key];
    assert.equal(row.length, 9, `${key} must include all nine languages`);
    assert.ok(row.every((value) => String(value).trim()), `${key} contains an empty translation`);
  }
  assert.match(source, /function personalAccountGate\(context\)/);
  assert.match(source, /accountSwitchUrl\("login"\)/);
  assert.match(source, /accountSwitchUrl\("register"\)/);
  assert.match(source, /if \(customerOnly && session[\s\S]*?personalAccountGate\(context\);/);
});
