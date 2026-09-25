import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const portalUrl = new URL("../../../js/allona-maritime-portal.js", import.meta.url);
const routeUrl = new URL("../../src/routes/maritime-smart-account.js", import.meta.url);
const submissionModeMigrationUrl = new URL("../../../supabase/migrations/20260919182500_add_maritime_application_submission_mode.sql", import.meta.url);
const jobsPageUrl = new URL("../../../pages/ecosystem/maritime-jobs.html", import.meta.url);
const jobsStyleUrl = new URL("../../../css/allona-maritime-portal.css", import.meta.url);
const autoApplyPageUrl = new URL("../../../pages/ecosystem/maritime-auto-apply.html", import.meta.url);

async function portalGate() {
  const source = await readFile(portalUrl, "utf8");
  const instrumented = source
    .replace("const copyRows = {", "const copyRows = window.__portalCopyRows = {")
    .replace("let session = null;", "let session = null; window.__setPortalSession = (value) => { session = value; };")
    .replace(/let smartApplicationState = ([^\n]+);/, (line) => `${line}\n  window.__setSmartApplicationState = (value) => { smartApplicationState = value; };`)
    .replace("function jobApplicationGate(job) {", "window.__jobApplicationGate = function jobApplicationGate(job) {")
    .replace("function jobApplicationAction(job, gate) {", "window.__jobApplicationAction = function jobApplicationAction(job, gate) {")
    .replace("function departmentForRank(rankCode) {", "window.__departmentForRank = function departmentForRank(rankCode) {")
    .replace("function applicationDialogMarkup() {", "window.__applicationDialogMarkup = function applicationDialogMarkup() {");
  const window = { Allona: {} };
  vm.runInNewContext(instrumented, {
    window,
    document: {
      body: { dataset: { maritimeView: "jobs" } },
      documentElement: { lang: "tr" },
      readyState: "loading",
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; }
    },
    localStorage: { getItem() { return "tr"; }, setItem() {} },
    URL,
    URLSearchParams,
    FormData,
    AbortController,
    console
  });
  window.__setPortalSession({ access_token: "token", user: { id: "candidate" } });
  return { source, window };
}

test("published rank codes select the correct department without leaking into every filter", async () => {
  const { window, source } = await portalGate();
  const groups = {
    deck: ["master", "chief_officer", "second_officer", "third_officer", "deck_cadet", "bosun", "able_seaman", "ordinary_seaman", "deck_boy"],
    engine: ["chief_engineer", "second_engineer", "third_engineer", "fourth_engineer", "engine_cadet", "engine_bosun", "able_engine_rating", "motorman", "oiler", "wiper", "fitter", "welder", "pumpman"],
    electrical: ["eto", "electro_technical_rating", "electrician"],
    hotel: ["chief_cook", "cook", "steward"]
  };
  for (const [department, ranks] of Object.entries(groups)) {
    for (const rank of ranks) assert.equal(window.__departmentForRank(rank), department, rank);
  }
  assert.equal(window.__departmentForRank("unknown"), "all");
  assert.match(source, /department: departmentForRank\(requirements\.rank_code\)/);
  assert.doesNotMatch(source, /job\.department === "all"/);
  assert.equal(window.__portalCopyRows.applicationBlockedTitle[0], "Bu ilana başvuru yapamazsınız");
});

test("manual job gate requires saved Maritime CV, not uploaded documents", async () => {
  const { source, window } = await portalGate();
  for (const key of [
    "uploadDocuments", "documentsMissingReason", "reviewDocuments", "documentsPendingReason",
    "completeMaritimeCv", "maritimeCvMissingReason", "globalCvMissingReason", "confirmGlobalCvReason",
    "notEligibleForPosition", "notEligibleReason", "refreshEligibility", "refreshEligibilityReason",
    "listingRequirementsPending", "listingRequirementsPendingReason", "eligibilityUnavailable", "eligibilityUnavailableReason",
    "applicationBlockedTitle", "applicationDialogClose", "qualificationMismatchTemplate", "automaticApplicationSubmitted",
    "autoSaving", "autoSaveFailed", "shareDocumentsCheckbox", "shareDocumentsRequired", "shareDocumentsRequiredTitle"
  ]) {
    assert.equal(window.__portalCopyRows[key].length, 9, `${key} must include all nine languages`);
    assert.ok(window.__portalCopyRows[key].every((value) => String(value).trim()), `${key} contains an empty translation`);
  }
  window.__setSmartApplicationState({
    run: null,
    matches: [],
    application_drafts: [],
    application_readiness: { documents_state: "missing", has_saved_maritime_cv: false }
  });
  const gate = window.__jobApplicationGate({ id: "listing", smartJobId: "job" });
  assert.equal(gate.label, "apply");
  assert.equal(gate.actionLabel, "completeMaritimeCv");
  assert.equal(gate.href, "/pages/ecosystem/maritime-cv.html");
  assert.equal(gate.blocked, true);
  assert.equal(gate.disabled, false);
  const action = window.__jobApplicationAction({ id: "listing" }, gate);
  assert.match(action, /<button[^>]+data-apply-job="listing"/);
  assert.match(action, />Başvur<\/button>/);
  assert.match(action, /<input type="checkbox" data-job-share-consent="listing">/);
  assert.match(action, /Belgelerimin ve bilgilerimin bu firmayla paylaşılmasına izin veriyorum/);
  assert.match(source, /if \(!consent \|\| !consent\.checked\)/);
  assert.doesNotMatch(source, /window\.confirm\(text\("shareDocumentsConfirm"\)\)/);
  assert.doesNotMatch(action, /maritime-documents\.html/);
  assert.match(window.__applicationDialogMarkup(), /<dialog[^>]+data-application-dialog/);
  assert.doesNotMatch(source, /Uygunluk doğrulanamadı/);
});

test("manual job gate permits missing documents when Maritime CV is saved", async () => {
  const { window } = await portalGate();
  window.__setSmartApplicationState({
    run: null,
    matches: [],
    application_drafts: [],
    application_readiness: { documents_state: "processing", has_saved_maritime_cv: false }
  });
  const documentGate = window.__jobApplicationGate({ id: "listing", smartJobId: "job" });
  assert.equal(documentGate.label, "apply");
  assert.equal(documentGate.actionLabel, "completeMaritimeCv");

  window.__setSmartApplicationState({
    run: null,
    matches: [],
    application_drafts: [],
    application_readiness: { documents_state: "confirmed", has_saved_maritime_cv: false }
  });
  const cvGate = window.__jobApplicationGate({ id: "listing", smartJobId: "job" });
  assert.equal(cvGate.label, "apply");
  assert.equal(cvGate.actionLabel, "completeMaritimeCv");
  assert.equal(cvGate.href, "/pages/ecosystem/maritime-cv.html");
  window.__setSmartApplicationState({ run: null, matches: [], application_drafts: [], application_readiness: { documents_state: "missing", has_saved_maritime_cv: true } });
  assert.equal(window.__jobApplicationGate({ id: "listing", smartJobId: "job" }).blocked, undefined);
});

test("manual job gate leaves rank decision to the current server-side Maritime CV", async () => {
  const { window, source } = await portalGate();
  window.__setSmartApplicationState({
    run: { id: "run", status: "user_confirmed" },
    matches: [{ job_id: "job", eligible: false, hard_gate_status: "failed", rank_compatible: false, missing_requirements: ["rank"] }],
    application_drafts: [],
    application_readiness: { documents_state: "confirmed", has_saved_maritime_cv: true }
  });
  const gate = window.__jobApplicationGate({ id: "listing", smartJobId: "job", title: "Kaptan" });
  assert.equal(gate.label, "apply");
  assert.equal(gate.blocked, undefined);
  assert.equal(gate.disabled, false);
  assert.match(source, /error\?\.code === "RANK_MISMATCH" \? text\("qualificationMismatchTemplate"\)/);
});

test("manual submissions check saved rank and explicit document consent on the server", async () => {
  const route = await readFile(routeUrl, "utf8");
  assert.match(route, /app\.post\("\/v1\/maritime\/manual-applications"/);
  assert.match(route, /requireCustomer\(request, "maritime\.manual_application\.submit"\)/);
  assert.match(route, /share_documents: z\.literal\(true\)/);
  assert.match(route, /canonicalRank\(buildMaritimeSmartProfile\(\{ cvProfile: cv \}\)\.profile\.rank\)/);
  assert.match(route, /candidateRank !== canonicalRank\(job\.rank_code\)/);
  assert.match(route, /documents_share_confirmed: true/);
  assert.match(route, /status: "submitted", submitted_at: now/);
  assert.match(route, /submission_mode: "manual"/);
});

test("rank-compatible job badge precedes the verified-company badge and stays legible in every theme", async () => {
  const [source, style] = await Promise.all([readFile(portalUrl, "utf8"), readFile(jobsStyleUrl, "utf8")]);
  const card = source.slice(source.indexOf("function jobCard(job)"), source.indexOf("function jobCard(job)") + 4500);
  assert.ok(card.indexOf('class="maritime-match-badge"') < card.indexOf('class="maritime-verified-badge"'));
  assert.match(card, /text\("rankCompatible"\)/);
  assert.match(style, /\.maritime-job-head \.maritime-match-badge/);
  assert.match(style, /data-theme="white"\] \.maritime-job-head \.maritime-match-badge/);
  assert.match(style, /@media \(max-width: 700px\) \{\s*\.maritime-job-head \{ flex-wrap: wrap; \}/);
});

test("database firewall permits consented manual rank matches without relaxing automatic matching", async () => {
  const migration = await readFile(new URL("../../../supabase/migrations/20260925200000_allow_rank_matched_manual_maritime_applications.sql", import.meta.url), "utf8");
  assert.match(migration, /matching_source' = 'maritime_cv_rank'/);
  assert.match(migration, /documents_share_confirmed' is distinct from 'true'/);
  assert.match(migration, /cv_rank <> job_rank/);
  assert.match(migration, /run\.status = 'user_confirmed'/);
  assert.match(migration, /match\.hard_gate_status = 'passed'/);
  assert.match(migration, /'kaptan'.*'master'/s);
});

test("job gate never calls missing or stale match data a qualification mismatch", async () => {
  const { window } = await portalGate();
  const base = {
    run: { id: "run", status: "user_confirmed" },
    application_drafts: [],
    application_readiness: { documents_state: "confirmed", has_saved_maritime_cv: true }
  };
  window.__setSmartApplicationState({ ...base, matches: [] });
  assert.equal(window.__jobApplicationGate({ id: "listing", smartJobId: "job" }).blocked, undefined);

  window.__setSmartApplicationState({ ...base, matches: [{ job_id: "job", eligible: false, hard_gate_status: "needs_data" }] });
  assert.equal(window.__jobApplicationGate({ id: "listing", smartJobId: "job" }).blocked, undefined);

  window.__setSmartApplicationState({ ...base, matches: [{ job_id: "job", eligible: true, hard_gate_status: "passed" }] });
  assert.equal(window.__jobApplicationGate({ id: "listing", smartJobId: "job" }).label, "apply");
});

test("smart account API exposes only a minimal application readiness summary", async () => {
  const route = await readFile(routeUrl, "utf8");
  assert.match(route, /async function maritimeApplicationReadiness\(userId\)/);
  assert.match(route, /documents_state: confirmedDocuments\.length \? "confirmed" : uploadedDocuments\.length \? "processing" : "missing"/);
  assert.match(route, /has_saved_maritime_cv: profile\?\.profile_payload\?\.data_origin === "user_entered_maritime_cv"/);
  assert.match(route, /application_readiness: applicationReadiness/);
  assert.doesNotMatch(route, /application_readiness:[^\n]*(passport|document_number|storage_path|profile_payload)/i);
});

test("application history distinguishes automatic submissions with a durable source field", async () => {
  const [{ source, window }, migration] = await Promise.all([
    portalGate(),
    readFile(submissionModeMigrationUrl, "utf8")
  ]);
  assert.equal(window.__portalCopyRows.automaticApplicationSubmitted.length, 9);
  assert.match(source, /select\("id,job_id,status,submission_mode,submitted_at,updated_at,metadata"\)/);
  assert.match(source, /item\.submission_mode === "automatic"/);
  assert.match(source, /automaticApplicationSubmitted/);
  assert.match(migration, /add column if not exists submission_mode text/);
  assert.match(migration, /check \(submission_mode in \('manual', 'automatic'\)\)/);
  assert.match(migration, /update of status, job_id, seafarer_user_id, metadata, submission_mode/);
  assert.match(migration, /create table if not exists public\.maritime_auto_apply_preferences/);
  assert.match(migration, /create or replace function public\.apply_maritime_automatic_applications/);
  assert.match(migration, /'automatic_application'/);
  assert.match(migration, /'application_mode', 'automatic'/);
  assert.match(migration, /maritime_auto_apply_run_confirmation/);
  assert.match(migration, /maritime_auto_apply_match_change/);
});

test("manual application page loads device and passkey security before the application controller", async () => {
  const [page, source] = await Promise.all([readFile(jobsPageUrl, "utf8"), readFile(portalUrl, "utf8")]);
  const deviceScript = page.indexOf("js/cv-access.js");
  const passkeyScript = page.indexOf("js/maritime-passkey.js");
  const portalScript = page.indexOf("js/allona-maritime-portal.js");
  assert.ok(deviceScript > 0 && passkeyScript > deviceScript && portalScript > passkeyScript);
  assert.match(source, /"X-Allona-Device-Key": await App\.cvAccess\.getDeviceKey\(\)/);
  assert.match(source, /"X-Allona-Passkey-Proof": await window\.AllonaMaritimePasskey\.authorize\(\)/);
});

test("automatic application preference is server-backed and passkey protected", async () => {
  const [page, source, route] = await Promise.all([
    readFile(autoApplyPageUrl, "utf8"),
    readFile(portalUrl, "utf8"),
    readFile(routeUrl, "utf8")
  ]);
  assert.match(page, /js\/cv-access\.js/);
  assert.match(page, /js\/maritime-passkey\.js/);
  assert.match(source, /fetch\(`\$\{base\}\/v1\/maritime\/auto-apply`/);
  assert.match(source, /smartApplicationApi\("\/v1\/maritime\/auto-apply"/);
  assert.doesNotMatch(source, /localStorage\.setItem\(storageKey\("autoApply"\)/);
  assert.match(route, /app\.get\("\/v1\/maritime\/auto-apply"/);
  assert.match(route, /app\.post\("\/v1\/maritime\/auto-apply"/);
  assert.match(route, /requireMaritimePasskeyProof\(request, ctx\.user\.id\)/);
  assert.match(route, /set_maritime_auto_apply_preference/);
});
