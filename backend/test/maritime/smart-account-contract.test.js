import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const migrationUrl = new URL("../../../supabase/migrations/20260914060000_create_maritime_smart_account.sql", import.meta.url);
const firewallMigrationUrl = new URL("../../../supabase/migrations/20260915193000_enforce_maritime_application_match_firewall.sql", import.meta.url);
const routeUrl = new URL("../../src/routes/maritime-smart-account.js", import.meta.url);
const pageUrl = new URL("../../../pages/ecosystem/maritime-smart-account.html", import.meta.url);
const uiUrl = new URL("../../../js/allona-maritime-smart-account.js", import.meta.url);
const cssUrl = new URL("../../../css/allona-maritime-portal.css", import.meta.url);
const mainRoutesUrl = new URL("../../src/routes/index.js", import.meta.url);
const portalUrl = new URL("../../../js/allona-maritime-portal.js", import.meta.url);
const identityLockMigrationUrl = new URL("../../../supabase/migrations/20260915211500_lock_maritime_cv_identity.sql", import.meta.url);
const personalLockMigrationUrl = new URL("../../../supabase/migrations/20260916160000_expand_maritime_cv_personal_lock.sql", import.meta.url);
const cvFormUrl = new URL("../../../js/maritime-cv-form.js", import.meta.url);
const cvAccountUrl = new URL("../../../js/maritime-cv-account.js", import.meta.url);
const cvPageUrl = new URL("../../../pages/ecosystem/maritime-cv.html", import.meta.url);

test("smart account writes remain customer-only, reviewable, and separated from final submission", async () => {
  const [migration, firewall] = await Promise.all([readFile(migrationUrl, "utf8"), readFile(firewallMigrationUrl, "utf8")]);
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
  assert.match(firewall, /maritime_application_match_firewall/);
  assert.match(firewall, /update of status, job_id, seafarer_user_id, metadata/);
  assert.match(firewall, /run\.rule_version = 'maritime-smart-account-v6'/);
  assert.match(firewall, /readiness,ready_to_apply/);
  assert.match(firewall, /match\.hard_gate_status = 'passed'/);
  assert.match(firewall, /match\.stale_after > now\(\)/);
  assert.match(firewall, /run\.seafarer_user_id = new\.seafarer_user_id/);
  assert.match(firewall, /match\.job_id = new\.job_id/);
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
  assert.match(route, /GLOBAL_CV_REQUIRED_FIELDS_MISSING/);
  assert.match(route, /data_origin !== "user_entered_maritime_cv"/);
  assert.match(route, /profile\.webp/);
  assert.match(route, /summaryMode: z\.enum\(\["auto", "custom"\]\)/);
  assert.match(route, /new Set\(\["presetId", "code", "name", "institute", "place", "issue", "rank", "cert", "number", "expiry", "unlimited", "included"\]\)/);
  assert.match(route, /validity_status: unlimited \? "non_expiring"/);
  assert.match(route, /manualStcwPresets/);
  assert.match(route, /Kimyasal Tanker Sertifikası \(SA\)/);
  assert.match(route, /Chemical Tanker Certificate \(SA\)/);
  assert.match(route, /MARITIME_CV_REQUIRED_FIELDS_MISSING/);
  assert.match(route, /hasPhoto: await hasStoredProfilePhoto/);
  assert.match(route, /save_locked_maritime_cv_profile/);
  assert.match(route, /maritime_check_device_access/);
  assert.match(route, /MARITIME_IDENTITY_ALREADY_REGISTERED/);
  assert.match(route, /MARITIME_DEVICE_ALREADY_BOUND/);
  assert.match(route, /\/v1\/admin\/maritime\/cv-identity-corrections\/:ticketId\/approve/);
  assert.match(route, /MARITIME_IDENTITY_CHANGE_APPROVED/);
  assert.match(route, /\["admin", "super_admin"\]/);
  assert.match(route, /!hasMfa\(ctx\)/);
});

test("Maritime CV identity and device controls are enforced by private database locks", async () => {
  const migration = await readFile(identityLockMigrationUrl, "utf8");
  assert.match(migration, /create table if not exists public\.maritime_cv_identity_locks/);
  assert.match(migration, /person_fingerprint text not null unique/);
  assert.match(migration, /create table if not exists public\.maritime_cv_device_bindings/);
  assert.match(migration, /device_fingerprint text primary key/);
  assert.match(migration, /MARITIME_IDENTITY_ALREADY_REGISTERED/);
  assert.match(migration, /MARITIME_IDENTITY_LOCKED/);
  assert.match(migration, /MARITIME_DEVICE_ALREADY_BOUND/);
  assert.match(migration, /before insert or update of seafarer_user_id, profile_status, profile_payload, last_user_confirmed_at/);
  assert.match(migration, /assigned_admin_id = p_approved_by/);
  assert.match(migration, /ticket\.status = 'in_progress'/);
  assert.match(migration, /v_birth_date !~ '\^\[0-9\]\{4\}-\[0-9\]\{2\}-\[0-9\]\{2\}\$'/);
  assert.match(migration, /v_birth_place is null or v_nationality is null or v_gender is null/);
  assert.match(migration, /maritime_identity_security_review_required/);
  assert.match(migration, /profile_status = 'draft'/);
  assert.match(migration, /identity_security_hold/);
  assert.match(migration, /grant execute on function public\.save_locked_maritime_cv_profile\(uuid, jsonb, integer, text, text\) to service_role/);
  assert.doesNotMatch(migration, /grant execute on function public\.save_locked_maritime_cv_profile\([^\n]+\) to authenticated/);
});

test("Maritime CV locks personal fields and clear preserves identity after first save", async () => {
  const [form, account, page] = await Promise.all([
    readFile(cvFormUrl, "utf8"),
    readFile(cvAccountUrl, "utf8"),
    readFile(cvPageUrl, "utf8")
  ]);
  for (const field of ["position", "firstName", "familyName", "fatherName", "birthDate", "birthPlace", "nationality", "gender", "marital", "address", "airport"]) {
    assert.match(form, new RegExp(`"${field}"`));
  }
  assert.match(form, /control\.readOnly = fieldLocked/);
  assert.match(form, /showIdentityFieldNotice/);
  assert.match(form, /control\.setAttribute\("aria-disabled", "true"\)/);
  assert.match(form, /if\(identityLocked && lockedFields\.has\(id\)\) return/);
  assert.match(form, /if\(!identityLocked\) setMaritimeCvPhoto\(""\)/);
  assert.match(form, /\["fatherName", "fatherName"\]/);
  assert.match(account, /"X-Allona-Device-Key": currentDeviceKey/);
  assert.match(account, /identity-change-request/);
  assert.match(page, /data-cv-identity-lock-notice/);
  assert.match(page, /data-cv-identity-support-dialog/);
  assert.match(page, /js\/cv-access\.js/);
});

test("Maritime CV personal lock upgrades existing identities without weakening duplicate-person protection", async () => {
  const [migration, route] = await Promise.all([readFile(personalLockMigrationUrl, "utf8"), readFile(routeUrl, "utf8")]);
  assert.match(migration, /maritime_cv_identity_snapshot_hash_v1/);
  assert.match(migration, /v_lock\.identity_version = 'maritime-identity-v1'/);
  assert.match(migration, /identity_version = 'maritime-personal-v2'/);
  for (const field of ["rank", "marital_status", "permanent_address", "nearest_airport"]) assert.match(migration, new RegExp(field));
  assert.match(migration, /v_person_fingerprint <> v_lock\.person_fingerprint/);
  assert.match(migration, /MARITIME_IDENTITY_ALREADY_REGISTERED/);
  assert.match(route, /maritimeIdentityLockVersion = "maritime-personal-v2"/);
  assert.match(route, /identityLock\.identity_version === maritimeIdentityLockVersion/);
  assert.match(route, /\.from\("maritime_cv_identity_locks"\)[\s\S]*?\.select\("locked_at,identity_version"\)/);
  assert.match(route, /locked: Boolean\(identityLock\)/);
});

test("email and Google registration flows enforce the one-device account boundary", async () => {
  const [routes, accountPage, authPage] = await Promise.all([
    readFile(mainRoutesUrl, "utf8"),
    readFile(new URL("../../../pages/account/user.html", import.meta.url), "utf8"),
    readFile(new URL("../../../js/allona-auth-page.js", import.meta.url), "utf8")
  ]);
  assert.match(routes, /device_key: z\.string\(\)\.trim\(\)\.regex\(\/\^\[0-9a-f\]\{64\}\$\/i\)/);
  assert.match(routes, /maritime_device_registration_allowed/);
  assert.match(routes, /maritime_bind_device_to_user/);
  assert.match(routes, /Registration rolled back after device binding failure/);
  assert.match(routes, /\/v1\/auth\/device\/claim/);
  assert.match(accountPage, /device_key:deviceKey/);
  assert.match(accountPage, /claimCustomerAccountDevice/);
  assert.match(accountPage, /context\.type==="customer" && !await claimCustomerAccountDevice\(verified\.user\)/);
  assert.match(accountPage, /window\.Allona\.cvAccess\.getDeviceKey\(\)/);
  assert.match(authPage, /allonahub\.oauth\.mode/);
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
  assert.match(routes, /smart_job_id/);
  assert.match(routes, /new Map\(\(smartJobs\.data \|\| \[\]\)\.map/);
});

test("smart account is a dedicated no-footer workspace with explicit approval actions", async () => {
  const [page, ui, css] = await Promise.all([readFile(pageUrl, "utf8"), readFile(uiUrl, "utf8"), readFile(cssUrl, "utf8")]);
  assert.match(page, /data-maritime-view="smart"/);
  assert.doesNotMatch(page, /<footer/i);
  assert.match(page, /data-view-link="smart"/);
  assert.match(page, /href="maritime-cv\.html"/);
  assert.match(page, /data-portal-i18n="smartAccountAddDocument">Maritime CV'yi Düzenle/);
  assert.match(page, /<title>Global CV \| AllonaHub<\/title>/);
  assert.match(page, /data-global-passport-help-toggle/);
  assert.match(page, /data-global-passport-help-card hidden/);
  assert.match(page, /data-portal-i18n="globalPassportHelpWorldwide"/);
  assert.match(page, /aria-controls="globalPassportHelp"/);
  assert.match(ui, /data-confirm-smart/);
  assert.match(ui, /data-prepare-drafts/);
  assert.match(ui, /data-prepare-all/);
  assert.match(ui, /data-open-cv/);
  assert.match(ui, /data-print-cv/);
  assert.match(ui, /addGlobalCvPages/);
  assert.match(ui, /pdf\.save\(fileName\)/);
  assert.doesNotMatch(ui, /window\.print\(\)/);
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
  for (const key of ["maritimeCvNav", "smartAccountNav", "smartAccountTitle", "smartAccountLead", "smartAccountAddDocument", "globalPassportHelpLabel", "globalPassportHelpTitle", "globalPassportHelpBody", "globalPassportHelpWorldwide", "globalPassportHelpPrivacy", "globalPassportHelpClose", "seafarerStatusLabel", "seafarerStatusApproved", "seafarerStatusReview", "seafarerStatusEvidence", "seafarerStatusPending", "seafarerStatusNote"]) {
    const row = window.__portalCopyRows[key];
    assert.equal(row.length, 9, `${key} must include all nine languages`);
    assert.ok(row.every((value) => String(value).trim()), `${key} contains an empty translation`);
  }
  assert.deepEqual(Array.from(window.__portalCopyRows.smartAccountNav), Array(9).fill("Global CV"));
  assert.deepEqual(Array.from(window.__portalCopyRows.maritimeCvNav), Array(9).fill("Maritime CV"));
  assert.equal(window.__portalCopyRows.smartAccountTitle[0], "Global CV");
  assert.doesNotMatch(source, /Global Pasaport|Global Passport|GP CV/);
  assert.match(source, /function setGlobalPassportHelp\(open, restoreFocus\)/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /function loadSeafarerClassification\(\)/);
  assert.match(source, /readiness\.seafarer_status/);
  assert.match(source, /function jobApplicationGate\(job\)/);
  assert.match(source, /\/v1\/maritime\/smart-account\/\$\{encodeURIComponent\(smartApplicationState\.run\.id\)\}\/application-drafts/);
  assert.match(source, /\/v1\/maritime\/application-drafts\/\$\{encodeURIComponent\(draft\.id\)\}\/submit/);
  assert.doesNotMatch(source, /id: `application-\$\{job\.id\}-\$\{Date\.now\(\)\}`/);
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
