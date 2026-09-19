import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const portalUrl = new URL("../../../js/allona-maritime-portal.js", import.meta.url);
const routeUrl = new URL("../../src/routes/maritime-smart-account.js", import.meta.url);

async function portalGate() {
  const source = await readFile(portalUrl, "utf8");
  const instrumented = source
    .replace("const copyRows = {", "const copyRows = window.__portalCopyRows = {")
    .replace("let session = null;", "let session = null; window.__setPortalSession = (value) => { session = value; };")
    .replace(/let smartApplicationState = ([^\n]+);/, (line) => `${line}\n  window.__setSmartApplicationState = (value) => { smartApplicationState = value; };`)
    .replace("function jobApplicationGate(job) {", "window.__jobApplicationGate = function jobApplicationGate(job) {");
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

test("job gate directs candidates with no documents to document upload", async () => {
  const { source, window } = await portalGate();
  for (const key of [
    "uploadDocuments", "documentsMissingReason", "reviewDocuments", "documentsPendingReason",
    "completeMaritimeCv", "maritimeCvMissingReason", "globalCvMissingReason", "confirmGlobalCvReason",
    "notEligibleForPosition", "notEligibleReason", "refreshEligibility", "refreshEligibilityReason",
    "listingRequirementsPending", "listingRequirementsPendingReason", "eligibilityUnavailable", "eligibilityUnavailableReason"
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
  assert.equal(gate.label, "uploadDocuments");
  assert.equal(gate.reason, "Uygun ilanları belirleyebilmemiz için denizcilik belgelerinizi yükleyin.");
  assert.equal(gate.href, "/pages/ecosystem/maritime-documents.html");
  assert.equal(gate.disabled, false);
  assert.doesNotMatch(source, /Uygunluk doğrulanamadı/);
});

test("job gate distinguishes incomplete documents and Maritime CV", async () => {
  const { window } = await portalGate();
  window.__setSmartApplicationState({
    run: null,
    matches: [],
    application_drafts: [],
    application_readiness: { documents_state: "processing", has_saved_maritime_cv: false }
  });
  assert.equal(window.__jobApplicationGate({ id: "listing", smartJobId: "job" }).label, "reviewDocuments");

  window.__setSmartApplicationState({
    run: null,
    matches: [],
    application_drafts: [],
    application_readiness: { documents_state: "confirmed", has_saved_maritime_cv: false }
  });
  const cvGate = window.__jobApplicationGate({ id: "listing", smartJobId: "job" });
  assert.equal(cvGate.label, "completeMaritimeCv");
  assert.equal(cvGate.href, "/pages/ecosystem/maritime-cv.html");
});

test("job gate uses a gentle qualification mismatch only after a confirmed match run", async () => {
  const { window } = await portalGate();
  window.__setSmartApplicationState({
    run: { id: "run", status: "user_confirmed" },
    matches: [{ job_id: "job", eligible: false, hard_gate_status: "failed" }],
    application_drafts: [],
    application_readiness: { documents_state: "confirmed", has_saved_maritime_cv: true }
  });
  const gate = window.__jobApplicationGate({ id: "listing", smartJobId: "job" });
  assert.equal(gate.label, "notEligibleForPosition");
  assert.equal(gate.reason, "Bu ilan için yeterliliğiniz eşleşmiyor.");
  assert.equal(gate.disabled, true);
  assert.equal(gate.href, undefined);
});

test("job gate never calls missing or stale match data a qualification mismatch", async () => {
  const { window } = await portalGate();
  const base = {
    run: { id: "run", status: "user_confirmed" },
    application_drafts: [],
    application_readiness: { documents_state: "confirmed", has_saved_maritime_cv: true }
  };
  window.__setSmartApplicationState({ ...base, matches: [] });
  assert.equal(window.__jobApplicationGate({ id: "listing", smartJobId: "job" }).label, "refreshEligibility");

  window.__setSmartApplicationState({ ...base, matches: [{ job_id: "job", eligible: false, hard_gate_status: "needs_data" }] });
  assert.equal(window.__jobApplicationGate({ id: "listing", smartJobId: "job" }).label, "listingRequirementsPending");

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
