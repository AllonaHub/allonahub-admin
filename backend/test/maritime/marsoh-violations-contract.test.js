import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../../../", import.meta.url);
const source = (path) => readFileSync(new URL(path, root), "utf8");

test("MarSoh violations remain owner-only and expose rejected, quarantined and removed evidence", () => {
  const route = source("backend/src/routes/marsoh.js");
  const migration = source("supabase/migrations/20260925210000_marsoh_violation_evidence.sql");
  const ui = source("js/super-admin.js");
  assert.match(route, /\/v1\/admin\/marsoh\/violations/);
  assert.match(route, /hasRole\(ctx\.profile, "super_admin"\)/);
  assert.match(route, /marsoh_rejected_evidence"\)\.insert/);
  assert.match(route, /\.neq\("decision", "published"\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.marsoh_rejected_evidence from public, anon, authenticated/);
  assert.match(ui, /MarSoh İhlaller/);
  assert.match(source("admin/super-admin.html"), /data-view-target="marsoh-violations"/);
});
