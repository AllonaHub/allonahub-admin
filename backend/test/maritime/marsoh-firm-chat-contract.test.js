import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("private firm chat is bound to verified partner, MFA, candidate consent and an active room", async () => {
  const route = await source("backend/src/routes/maritime-connect-chat.js");
  assert.match(route, /verification_status !== "verified"/);
  assert.match(route, /hasMfa\(ctx\)/);
  assert.match(route, /candidate_consent_snapshot\?\.final_submission_confirmed !== true/);
  assert.match(route, /room\.candidate_visible !== true/);
  assert.match(route, /room\.expires_at/);
  assert.match(route, /eq\("seafarer_user_id", ctx\.user\.id\)/);
});

test("private messages are server moderated, text-only, and idempotent", async () => {
  const route = await source("backend/src/routes/maritime-connect-chat.js");
  const migration = await source("supabase/migrations/20260925193000_maritime_private_chat_read_cursors.sql");
  assert.match(route, /sanitizeMarsohText/);
  assert.match(route, /classifyMarsohMessage/);
  assert.match(route, /decision\.recommended_action !== "publish"/);
  assert.match(route, /message_type: "text"/);
  assert.match(route, /idempotency_key/);
  assert.match(migration, /maritime_connect_message_client_uidx/);
  assert.doesNotMatch(route, /attachment_path|storage\.from|multipart/);
});

test("firm chat shows unread and renders message bodies as text", async () => {
  const ui = await source("js/marsoh-firms.js");
  const page = await source("pages/ecosystem/maritime-firm-chat.html");
  assert.match(page, /data-firm-nav-back/);
  assert.match(page, /data-firm-nav-return/);
  assert.match(ui, /if \(partner\) \{\s*const panelUrl = "\.\.\/partner\/maripartner\.html"/);
  assert.match(ui, /back\.href = panelUrl/);
  assert.match(ui, /returnLink\.href = panelUrl/);
  assert.match(ui, /returnLink\.textContent = "Panele Dön"/);
  assert.match(page, /new URLSearchParams\(location\.search\)\.get\("source"\) === "partner"/);
  assert.match(page, /returnLink\.textContent = "Panele Dön"/);
  assert.match(ui, /body\.textContent = message\.body/);
  assert.match(ui, /thread\.unread/);
  assert.match(ui, /Notification\.requestPermission\(\)/);
  assert.match(page, /data-firm-notify/);
  assert.doesNotMatch(page, /type="file"|accept="image|accept="audio/);
});

test("private chat requests document consent and shows the candidate an explicit approval action", async () => {
  const ui = await source("js/marsoh-firms.js");
  const chatRoute = await source("backend/src/routes/maritime-connect-chat.js");
  const partnerRoute = await source("backend/src/routes/maritime-partner-center.js");
  assert.match(ui, /CV ve Belge İzni İste/);
  assert.match(ui, /candidate-rooms\/\$\{encodeURIComponent\(state\.active\.candidate_room_id\)\}\/document-request/);
  assert.match(ui, /\["accepted", "Onaylıyorum"\]/);
  assert.match(ui, /document_permission_status/);
  assert.match(chatRoute, /partnerPermission/);
  assert.match(partnerRoute, /await activeApplicationForRoom\(room\)/);
  assert.match(partnerRoute, /await documentPermission\(room\)/);
});
