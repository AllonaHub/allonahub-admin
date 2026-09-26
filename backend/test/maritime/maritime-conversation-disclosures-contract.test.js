import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

test("conversation disclosures are server-owned, per room and default closed", () => {
  const migration = read("supabase/migrations/20260926133000_maritime_conversation_disclosures.sql");
  const route = read("backend/src/routes/maritime-connect-chat.js");
  assert.match(migration, /candidate_room_id uuid primary key/);
  assert.match(migration, /visible_fields text\[\] not null default '\{\}'/);
  assert.match(migration, /revoke all on public\.maritime_conversation_disclosures from public, anon, authenticated/);
  assert.match(route, /await threadAccess\(request, uuid\.parse\(request\.params\.threadId\)\)/);
  assert.match(route, /if \(candidate\) throw fail\("Bu paylaşımı yalnız şirket yönetebilir\."\)/);
  assert.match(route, /!candidate \|\| permitted\.has\(key\)/);
  assert.match(route, /visible_fields: candidate \? undefined :/);
});

test("firm chat exposes consent controls without HTML rendering of company data", () => {
  const page = read("pages/ecosystem/maritime-firm-chat.html");
  const client = read("js/marsoh-firms.js");
  assert.match(page, /data-firm-disclosure/);
  assert.match(client, /disclosureLabels/);
  assert.match(client, /description\.textContent = value/);
  assert.match(client, /visible_fields: \[\.\.\.form\.querySelectorAll\("input:checked"\)\]/);
});
