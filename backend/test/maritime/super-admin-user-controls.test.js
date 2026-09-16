import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../../../supabase/migrations/20260916014500_create_maritime_super_admin_user_controls.sql", import.meta.url);
const routesUrl = new URL("../../src/routes/index.js", import.meta.url);
const pageUrl = new URL("../../../admin/maritime-users.html", import.meta.url);
const uiUrl = new URL("../../../js/admin-maritime-users.js", import.meta.url);
const superAdminPageUrl = new URL("../../../admin/super-admin.html", import.meta.url);
const superAdminUiUrl = new URL("../../../js/super-admin.js", import.meta.url);
const deployUrl = new URL("../../../deploy/maritime/apply-maritime-migrations.sh", import.meta.url);

test("Allona public user IDs start at AL-50001 and remain immutable", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /create sequence if not exists public\.allona_user_public_id_seq/);
  assert.match(migration, /start with 50001/);
  assert.match(migration, /select 'AL-' \|\| nextval/);
  assert.match(migration, /create unique index if not exists profiles_public_id_unique/);
  assert.match(migration, /check \(public_id ~ '\^AL-\[0-9\]\{5,\}\$'\)/);
  assert.match(migration, /before insert on public\.profiles/);
  assert.match(migration, /new\.public_id := public\.next_allona_user_public_id\(\)/);
  assert.match(migration, /ALLONA_PUBLIC_ID_IMMUTABLE/);
  assert.match(migration, /before update of public_id on public\.profiles/);
});

test("Maritime owner interventions are private, audited, and reason gated", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /create table if not exists public\.maritime_super_admin_snapshots/);
  assert.match(migration, /retention_until timestamptz not null default \(now\(\) \+ interval '90 days'\)/);
  assert.match(migration, /revoke all on public\.maritime_super_admin_snapshots from public, anon, authenticated/);
  assert.match(migration, /v_role is distinct from 'super_admin'/);
  assert.match(migration, /MARITIME_SUPER_ADMIN_REQUIRED/);
  assert.match(migration, /MARITIME_ADMIN_PUBLIC_ID_CONFIRMATION_FAILED/);
  assert.match(migration, /super_admin_update_maritime_cv/);
  assert.match(migration, /MARITIME_IDENTITY_ALREADY_REGISTERED/);
  assert.match(migration, /super_admin_decide_maritime_user/);
  assert.match(migration, /super_admin_review_maritime_document/);
  assert.match(migration, /last_super_admin_review_reason/);
  assert.match(migration, /super_admin_reset_maritime_user/);
  assert.match(migration, /snapshot_retained_days', 90/);
  assert.doesNotMatch(migration, /grant execute on function public\.super_admin_(?:update|decide|reset)[^\n]+ to authenticated/);
});

test("Maritime user APIs require owner MFA boundary and audit sensitive access", async () => {
  const routes = await readFile(routesUrl, "utf8");
  assert.match(routes, /superGet\("\/maritime-users"/);
  assert.match(routes, /superGet\("\/maritime-users\/:userRef"/);
  assert.match(routes, /superPatch\("\/maritime-users\/:userRef\/account"/);
  assert.match(routes, /superPatch\("\/maritime-users\/:userRef\/cv"/);
  assert.match(routes, /superPost\("\/maritime-users\/:userRef\/decision"/);
  assert.match(routes, /super_admin_review_maritime_document/);
  assert.match(routes, /superPost\("\/maritime-users\/:userRef\/reset"/);
  assert.match(routes, /requirePermanentSuperAdmin\(request, "super_admin\.maritime_users/);
  assert.match(routes, /super_admin\.maritime_user_detail_viewed/);
  assert.match(routes, /evidenceTags: \["super_admin", "maritime", "personal_data", "sensitive_access"\]/);
  assert.match(routes, /createSignedUrl\(document\.storage_path, 120/);
  assert.match(routes, /select\("created_at,updated_at,last_used_at,credential_device_type,credential_backed_up,revoked_at"\)/);
  assert.doesNotMatch(routes, /select\("[^"]*(?:credential_id|public_key)[^"]*"\)\.eq\("user_id", profile\.id\)/);
});

test("Maritime Super Admin page supports search, full review, decisions, and controlled reset", async () => {
  const [page, ui, superAdminPage, superAdminUi, deploy] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(uiUrl, "utf8"),
    readFile(superAdminPageUrl, "utf8"),
    readFile(superAdminUiUrl, "utf8"),
    readFile(deployUrl, "utf8")
  ]);
  assert.match(page, /AL-50001/);
  assert.match(page, /data-tab="account"/);
  assert.match(page, /data-tab="cv"/);
  assert.match(page, /data-tab="documents"/);
  assert.match(page, /data-tab="activity"/);
  assert.match(page, /data-tab="security"/);
  assert.match(page, /data-decision="approve"/);
  assert.match(page, /data-decision="restrict"/);
  assert.match(page, /confirmation_public_id/);
  assert.match(page, /90 gün saklanan denetim kaydı/);
  assert.match(ui, /\/v1\/control-center\/maritime-users/);
  assert.match(ui, /profile_payload: collectCvPayload\(\)/);
  assert.match(ui, /window\.confirm\("Bu işlem aktif denizcilik verilerini temizleyecek/);
  assert.match(ui, /body: \{ decision, reason \}/);
  assert.match(superAdminPage, /href="\.\/maritime-users\.html"/);
  assert.match(superAdminUi, /maritime-guided-cv-20260916/);
  assert.match(deploy, /20260916014500_create_maritime_super_admin_user_controls\.sql/);
});
