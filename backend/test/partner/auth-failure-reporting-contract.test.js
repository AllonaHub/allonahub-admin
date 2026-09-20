import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("auth failure reporting is owner-only, limited to 90 days and uses masked data", async () => {
  const routes = await source("backend/src/routes/index.js");
  assert.match(routes, /superGet\("\/auth-failures"/);
  assert.match(routes, /requireSuperAdmin\(request, "super_admin\.auth_failures\.view"\)/);
  assert.match(routes, /max\(90\)/);
  assert.match(routes, /email_masked: maskAuthEmail\(email\)/);
  assert.match(routes, /retentionDays: 90/);
  assert.doesNotMatch(routes, /auth_failure_diagnostics[\s\S]{0,600}email:\s*email/);
});

test("production migration repairs every pgcrypto-backed maritime identity function", async () => {
  const migration = await source("supabase/migrations/20260921010000_repair_auth_device_security_and_failure_reporting.sql");
  assert.match(migration, /maritime_device_fingerprint/);
  assert.match(migration, /maritime_cv_person_fingerprint/);
  assert.match(migration, /maritime_cv_identity_snapshot_hash_v1/);
  assert.match(migration, /set search_path = public, extensions/g);
  assert.match(migration, /extensions\.digest/g);
  assert.match(migration, /security_audit_events_auth_failure_report_idx/);
});

test("super admin exposes the 90-day auth failure report", async () => {
  const [page, script] = await Promise.all([
    source("admin/super-admin.html"),
    source("js/super-admin.js")
  ]);
  assert.match(page, /data-view-target="auth-failures">Giriş Hataları/);
  assert.match(script, /\/v1\/control-center\/auth-failures\?days=90&limit=300/);
  assert.match(script, /Son 90 gündeki giriş, kayıt ve e-posta teslim sorunları/);
});

test("customer registration reports email throttling and supports secure confirmation resend", async () => {
  const [routes, page] = await Promise.all([
    source("backend/src/routes/index.js"),
    source("pages/account/user.html")
  ]);
  assert.match(routes, /error: "AUTH_EMAIL_RATE_LIMITED"/);
  assert.match(routes, /app\.post\("\/v1\/auth\/resend-confirmation"/);
  assert.match(routes, /verifyTurnstile\(request, "resend_confirmation"/);
  assert.match(routes, /supabasePublic\.auth\.resend\(\{/);
  assert.match(routes, /Do not reveal whether an address exists in Auth/);
  assert.match(page, /id="resendConfirmationBtn"/);
  assert.match(page, /authApi\("\/v1\/auth\/resend-confirmation"/);
  assert.match(page, /AUTH_EMAIL_RATE_LIMITED/);
});

test("email throttling preserves the pending account and confirmation uses a six digit code", async () => {
  const [routes, page, template] = await Promise.all([
    source("backend/src/routes/index.js"),
    source("pages/account/user.html"),
    source("supabase/auth-email-templates/confirmation.html")
  ]);
  assert.match(routes, /createPendingCustomerAfterEmailThrottle/);
  assert.match(routes, /email_confirm:\s*false/);
  assert.match(routes, /app\.post\("\/v1\/auth\/verify-email-code"/);
  assert.match(routes, /verifyOtp\(\{[\s\S]*type:\s*"signup"/);
  assert.match(page, /id="verificationCode"/);
  assert.match(page, /authApi\("\/v1\/auth\/verify-email-code"/);
  assert.match(template, /\{\{ \.Token \}\}/);
  assert.doesNotMatch(template, /href="\{\{ \.ConfirmationURL \}\}"/);
});

test("customer login separates provider outages and rate limits from invalid credentials", async () => {
  const [routes, page] = await Promise.all([
    source("backend/src/routes/index.js"),
    source("pages/account/user.html")
  ]);

  assert.match(routes, /error: "AUTH_RATE_LIMITED"/);
  assert.match(routes, /error: "AUTH_SERVICE_UNAVAILABLE"/);
  assert.match(page, /code\.includes\("service_unavailable"\)/);
  assert.match(page, /status>=500/);
});

test("temporary recovery accounts must replace their password before normal navigation", async () => {
  const [routes, loginPage, resetPage] = await Promise.all([
    source("backend/src/routes/index.js"),
    source("pages/account/user.html"),
    source("pages/account/reset-password.html")
  ]);
  assert.match(routes, /must_change_password:\s*Boolean/);
  assert.match(routes, /app\.post\("\/v1\/auth\/complete-temporary-password"/);
  assert.match(routes, /auth\.temporary_password_completed/);
  assert.match(loginPage, /data\.user\.must_change_password/);
  assert.match(resetPage, /hasForcedPasswordIntent/);
  assert.match(resetPage, /\/v1\/auth\/complete-temporary-password/);
  assert.match(resetPage, /supabaseClient\.auth\.setSession/);
  assert.doesNotMatch(resetPage, /signOut\(\{scope:"global"\}\)/);
  assert.match(routes, /replacementSession/);
  assert.match(routes, /reauthentication_required/);
});
