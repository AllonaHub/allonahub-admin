import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

test("unapplied candidate discovery is opt-in and exposes only a minimal projection", () => {
  const migration = read("supabase/migrations/20260926120000_maritime_candidate_discovery.sql");
  const route = read("backend/src/routes/maritime-partner-center.js");
  assert.match(migration, /visible_to_verified_partners boolean not null default false/);
  assert.match(migration, /revoke all on public\.maritime_candidate_discovery from anon, authenticated/);
  assert.match(migration, /revoke all on public\.maritime_candidate_intro_requests from anon, authenticated/);
  assert.match(migration, /maritime_intro_room_consent_select/);
  assert.match(migration, /maritime_intro_thread_consent_select/);
  assert.match(migration, /maritime_intro_messages_consent_select/);
  assert.match(route, /await ensureHiringAuthority\(access\)/);
  assert.match(route, /eq\("visible_to_verified_partners", true\)/);
  assert.match(route, /candidates\.push\(\{ id: cv\.seafarer_user_id, full_name:/);
  assert.match(route, /has_reference: referenceIds\.has/);
  assert.doesNotMatch(route.slice(route.indexOf('app.get("\/v1\/maritime\/partner-center\/discoverable-candidates"'), route.indexOf('app.post("\/v1\/maritime\/partner-center\/candidate-intro-requests"')), /email|phone|passport|document_number/);
});

test("candidate approval grants a time-limited private conversation without making a job application", () => {
  const route = read("backend/src/routes/maritime-partner-center.js");
  const chat = read("backend/src/routes/maritime-connect-chat.js");
  const ui = read("js/marsoh-firms.js");
  const confirm = route.slice(route.indexOf('app.post("\/v1\/maritime\/candidate\/intro-requests\/:requestId\/confirm"'), route.indexOf('app.get("\/v1\/maritime\/partner-center\/private-candidates"'));
  assert.match(confirm, /status: "accepted"/);
  assert.match(confirm, /Date\.now\(\) \+ 30 \* 86400000/);
  assert.match(confirm, /purpose: "candidate_intro"/);
  assert.doesNotMatch(confirm, /maritime_hiring_applications"\)\.insert/);
  assert.match(chat, /intro\?\.status !== "accepted" \|\| grant\?\.status !== "accepted"/);
  assert.match(chat, /select\("id,partner_id,job_id,application_id,seafarer_user_id,status,candidate_visible,expires_at"\)/);
  assert.match(route, /if \(!room\.application_id\) await candidateDisclosureForRoom\(room\)/);
  assert.match(ui, /Onaylıyorum/);
  assert.doesNotMatch(ui, /\/v1\/maritime\/manual-applications/);
});
