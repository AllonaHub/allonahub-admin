import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

test("partner entry opens private candidate conversations, not public MarSoh", () => {
  assert.match(read("pages/partner/maripartner.html"), /maritime-firm-chat\.html\?source=partner/);
  assert.doesNotMatch(read("pages/partner/maripartner.html"), /maritime-marsoh\.html\?source=partner/);
  const chat = read("js/marsoh.js");
  assert.match(chat, /partnerEntry \? "\.\.\/partner\/maripartner\.html"/);
  assert.doesNotMatch(chat, /history\.back\(\)/);
});

test("matching view opens as a full page and only exposes authorized candidate rooms", () => {
  const panel = read("js/maripartner.js");
  assert.match(panel, /classList\.toggle\("mp-drawer--matches", panel === "matches"\)/);
  assert.match(panel, /const rooms = state\.data\.candidate_rooms \|\| \[\];/);
  assert.match(panel, /rooms\.filter\(\(room\) => room\.job_id === item\.job_id\)/);
  assert.match(panel, /data-mp-document-request/);
  assert.match(read("css/maripartner.css"), /\.mp-drawer--matches \{ inset: 0; width: 100%/);
});

test("panel back goes to operations without reopening the prior panel", () => {
  const panel = read("js/maripartner.js");
  assert.match(panel, /if \(event\.target\.closest\("\[data-mp-back\]"\)\) \{\s*closePanel\(\);/);
});
