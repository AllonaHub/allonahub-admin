import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

test("OBE is a real super-admin queue backed by protected listing review", () => {
  const page = read("admin/super-admin.html");
  const ui = read("js/super-admin.js");
  const route = read("backend/src/routes/index.js");
  assert.match(page, /data-view-target="maritime-pending-jobs">OBE<\/button>/);
  assert.match(ui, /Onay Bekleyen İş İlanları/);
  assert.match(ui, /\/v1\/ops-console\/maritime-listings\/pending/);
  assert.match(ui, /data-obe-review/);
  assert.match(ui, /data-obe-more/);
  assert.match(route, /opsGet\("\/maritime-listings\/pending"/);
  assert.match(route, /requireOpsAdmin\(request, "admin\.ops\.maritime_listing\.list"\)/);
  assert.match(route, /\.eq\("status", "pending_review"\)/);
  assert.match(route, /opsPatch\("\/maritime-listings\/:listingId\/review"/);
  assert.match(route, /requireOpsAdmin\(request, "admin\.ops\.maritime_listing\.review"\)/);
});
