import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routeUrl = new URL("../../src/routes/maritime-smart-account.js", import.meta.url);

test("application submission rechecks the saved Maritime CV before calling the database submit RPC", async () => {
  const source = await readFile(routeUrl, "utf8");
  const submit = source.slice(source.indexOf('app.post("/v1/maritime/application-drafts/:applicationId/submit"'));
  assert.match(submit, /\.from\("maritime_cv_profiles"\)/);
  assert.match(submit, /maritimeGlobalPassportReadiness\(savedCv\?\.profile_payload/);
  assert.match(submit, /hasPhoto: await hasStoredProfilePhoto\(ctx\.user\.id\)/);
  assert.match(submit, /MARITIME_CV_REQUIRED_FIELDS_MISSING/);
  assert.ok(submit.indexOf("MARITIME_CV_REQUIRED_FIELDS_MISSING") < submit.indexOf('rpc("submit_maritime_application"'));
});

test("manual rank-matched application also requires complete Maritime CV fields", async () => {
  const source = await readFile(routeUrl, "utf8");
  const manual = source.slice(source.indexOf('app.post("/v1/maritime/manual-applications"'), source.indexOf('app.get("/v1/maritime/cv-profile"'));
  assert.match(manual, /maritimeGlobalPassportReadiness\(cv\.profile_payload/);
  assert.match(manual, /MARITIME_CV_REQUIRED_FIELDS_MISSING/);
  assert.ok(manual.indexOf("MARITIME_CV_REQUIRED_FIELDS_MISSING") < manual.indexOf("const candidateRank"));
  assert.ok(manual.indexOf("MARITIME_CV_REQUIRED_FIELDS_MISSING") < manual.indexOf('.from("maritime_hiring_applications").insert'));
});
