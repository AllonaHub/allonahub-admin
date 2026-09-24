import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("submitted applications open a partner room only after final candidate consent", async () => {
  const migration = await readFile(new URL("../../../supabase/migrations/20260925160000_maritime_submitted_application_rooms.sql", import.meta.url), "utf8");
  assert.match(migration, /new\.status <> 'submitted'/);
  assert.match(migration, /final_submission_confirmed/);
  assert.match(migration, /after update of status/);
  assert.match(migration, /on conflict \(partner_id, job_id, seafarer_user_id\) do update/);
  assert.match(migration, /candidate_visible = true/);
  assert.match(migration, /where a\.status = 'submitted'/);
});

test("partner CV requires verified hiring authority, submitted consent, and an active scoped room", async () => {
  const [route, documents] = await Promise.all([
    readFile(new URL("../../src/routes/maritime-partner-center.js", import.meta.url), "utf8"),
    readFile(new URL("../../src/routes/maritime-documents.js", import.meta.url), "utf8")
  ]);
  assert.match(route, /candidate-rooms\/:roomId\/cv/);
  assert.match(route, /await ensureHiringAuthority\(access\);\s*const room = await candidateRoom/);
  assert.match(route, /candidate_consent_snapshot\?\.final_submission_confirmed !== true/);
  assert.match(route, /reviewerCandidateFromProfilePayload\(payload\)/);
  assert.match(documents, /verifiedCycles/);
  assert.match(documents, /candidate_consent_snapshot\?\.final_submission_confirmed === true/);
  assert.match(documents, /room\.application_id === row\.id/);
});

test("partner panel links each authorized match and application to its candidate CV", async () => {
  const panel = await readFile(new URL("../../../js/maripartner.js", import.meta.url), "utf8");
  assert.match(panel, /data-mp-candidate-inspect="\$\{escape\(room\.id\)\}"/);
  assert.match(panel, /data-mp-candidate-cv="\$\{escape\(room\.id\)\}"/);
  assert.match(panel, /candidate-rooms\/\$\{encodeURIComponent\(inspectCv\.dataset\.mpCandidateCv\)\}\/cv/);
  assert.match(panel, /sea-service-documents\/\$\{encodeURIComponent\(serviceDocument\.dataset\.mpServiceDocument\)\}\/access/);
});
