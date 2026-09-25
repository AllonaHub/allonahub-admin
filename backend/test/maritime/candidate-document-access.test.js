import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { canViewCandidateDocuments } from "../../src/lib/maritime-candidate-document-access.js";

const now = Date.parse("2026-09-25T12:00:00Z");
const application = { status: "submitted", candidate_consent_snapshot: { final_submission_confirmed: true, documents_share_confirmed: false } };

test("documents require an active application and explicit permission", () => {
  assert.equal(canViewCandidateDocuments(application, null, now), false);
  assert.equal(canViewCandidateDocuments(application, { status: "pending", expires_at: "2026-09-26T12:00:00Z" }, now), false);
  assert.equal(canViewCandidateDocuments(application, { status: "accepted", expires_at: "2026-09-26T12:00:00Z" }, now), true);
  assert.equal(canViewCandidateDocuments(application, { status: "accepted", expires_at: "2026-09-24T12:00:00Z" }, now), false);
  assert.equal(canViewCandidateDocuments({ ...application, status: "withdrawn" }, { status: "accepted", expires_at: "2026-09-26T12:00:00Z" }, now), false);
  assert.equal(canViewCandidateDocuments({ ...application, candidate_consent_snapshot: {} }, { status: "accepted", expires_at: "2026-09-26T12:00:00Z" }, now), false);
});

test("a candidate can override earlier application consent by revoking permission", () => {
  const shared = { ...application, candidate_consent_snapshot: { final_submission_confirmed: true, documents_share_confirmed: true } };
  assert.equal(canViewCandidateDocuments(shared, null, now), true);
  assert.equal(canViewCandidateDocuments(shared, { status: "revoked" }, now), false);
  assert.equal(canViewCandidateDocuments(shared, { status: "declined" }, now), false);
});

test("partner document endpoints recheck tenant, room, consent and owner on every read", () => {
  const route = readFileSync(new URL("../../src/routes/maritime-partner-center.js", import.meta.url), "utf8");
  const legacy = readFileSync(new URL("../../src/routes/maritime-documents.js", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../../../supabase/migrations/20260925190000_maritime_candidate_document_grants.sql", import.meta.url), "utf8");
  assert.match(route, /candidate-rooms\/:roomId\/documents\/:documentId\/access/);
  assert.match(route, /await requirePartner\(request, "candidate_cv.read", partnerId\)/);
  assert.match(route, /await ensureHiringAuthority\(access\)/);
  assert.match(route, /await candidateRoom\(partnerId, roomId\)/);
  assert.match(route, /await documentPermission\(room\)/);
  assert.match(route, /\.eq\("seafarer_user_id", room\.seafarer_user_id\)/);
  assert.match(legacy, /canViewCandidateDocuments\(row, grants\.find/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all .* anon, authenticated/i);
});

test("applications expose actionable CV, consented documents and the scoped company chat", () => {
  const partner = readFileSync(new URL("../../../js/maripartner.js", import.meta.url), "utf8");
  const chat = readFileSync(new URL("../../../js/marsoh-firms.js", import.meta.url), "utf8");
  const chatRoute = readFileSync(new URL("../../src/routes/maritime-connect-chat.js", import.meta.url), "utf8");
  assert.match(partner, /Başvuranlar \(\$\{listed\.length\}\)/);
  assert.match(partner, /Uygun olanlar \(\$\{matched\.length\}\)/);
  assert.match(partner, /data-mp-candidate-chat/);
  assert.match(partner, /data-mp-candidate-documents/);
  assert.match(partner, /data-mp-document-request/);
  assert.match(partner, /candidate-rooms\/\$\{encodeURIComponent\(roomId\)\}\/documents/);
  assert.match(chat, /candidate\/document-requests/);
  assert.match(chat, /document-permissions\/\$\{encodeURIComponent\(request\.candidate_room_id\)\}/);
  assert.match(chatRoute, /const unread = Number\(unreadResult\.count \|\| 0\) > 0 \|\| Boolean\(pendingPermission\)/);
});

test("a submitted application is never moved back to candidate approval by a repeat invitation", () => {
  const route = readFileSync(new URL("../../src/routes/maritime-partner-center.js", import.meta.url), "utf8");
  const partner = readFileSync(new URL("../../../js/maripartner.js", import.meta.url), "utf8");
  const guard = route.indexOf('if (current && !["drafted", "awaiting_candidate_approval"].includes(current.status))');
  const update = route.indexOf('status: "awaiting_candidate_approval", last_stage_changed_at');
  assert.ok(guard > 0 && guard < update);
  assert.match(route, /already_applied: true/);
  assert.match(route, /already_invited: true/);
  assert.match(route, /CANDIDATE_INVITE_STATUS_DENIED/);
  assert.match(partner, /application \? "Başvuru Alındı" : "Davet Et"/);
});
