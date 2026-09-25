import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../../../supabase/migrations/20260916003000_add_maritime_passkey_security.sql", import.meta.url);
const identityMigrationUrl = new URL("../../../supabase/migrations/20260915211500_lock_maritime_cv_identity.sql", import.meta.url);
const passkeyRouteUrl = new URL("../../src/routes/maritime-passkey.js", import.meta.url);
const proofUrl = new URL("../../src/lib/maritime-passkey.js", import.meta.url);
const smartRouteUrl = new URL("../../src/routes/maritime-smart-account.js", import.meta.url);
const browserUrl = new URL("../../../js/maritime-passkey.js", import.meta.url);
const cvAccountUrl = new URL("../../../js/maritime-cv-account.js", import.meta.url);
const smartUiUrl = new URL("../../../js/allona-maritime-smart-account.js", import.meta.url);
const cvPageUrl = new URL("../../../pages/ecosystem/maritime-cv.html", import.meta.url);
const smartPageUrl = new URL("../../../pages/ecosystem/maritime-smart-account.html", import.meta.url);
const appUrl = new URL("../../src/app.js", import.meta.url);
const configUrl = new URL("../../src/config.js", import.meta.url);

test("WebAuthn accepts both customer and admin-hosted job pages without relaxing RP checks", async () => {
  const [config, route] = await Promise.all([readFile(configUrl, "utf8"), readFile(passkeyRouteUrl, "utf8")]);
  assert.match(config, /"https:\/\/allonahub\.com"/);
  assert.match(config, /"https:\/\/admin\.allonahub\.com"/);
  assert.match(route, /hostname === configuredRpId \|\| hostname\.endsWith\(`\.\$\{configuredRpId\}`\)/);
  assert.match(route, /config\.webauthn\.allowedOrigins\.includes\(origin\)/);
  assert.match(route, /expectedOrigin: challenge\.origin/);
});

test("passkey secrets, challenges, and one-time proofs stay backend-only", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /create table if not exists public\.maritime_passkey_credentials/);
  assert.match(migration, /user_id uuid primary key/);
  assert.match(migration, /credential_id text not null unique/);
  assert.match(migration, /create table if not exists public\.maritime_passkey_challenges/);
  assert.match(migration, /create table if not exists public\.maritime_passkey_proofs/);
  assert.match(migration, /alter table public\.maritime_passkey_credentials enable row level security/);
  assert.match(migration, /revoke all on public\.maritime_passkey_credentials from public, anon, authenticated/);
  assert.match(migration, /revoke all on function public\.maritime_consume_passkey_proof\(uuid, text, text\) from public, anon, authenticated/);
  assert.match(migration, /proof\.consumed_at is null/);
  assert.match(migration, /proof\.expires_at > now\(\)/);
  assert.match(migration, /set consumed_at = now\(\)/);
});

test("WebAuthn ceremonies require the platform authenticator and verified user", async () => {
  const route = await readFile(passkeyRouteUrl, "utf8");
  assert.match(route, /authenticatorAttachment: "platform"/);
  assert.match(route, /residentKey: "required"/);
  assert.match(route, /requireResidentKey: true/);
  assert.match(route, /userVerification: "required"/);
  assert.match(route, /expectedOrigin: challenge\.origin/);
  assert.match(route, /expectedRPID: challenge\.rp_id/);
  assert.match(route, /requireUserVerification: true/);
  assert.match(route, /verification\.authenticationInfo\.newCounter/);
  assert.match(route, /maritime_bind_device_to_user/);
  assert.match(route, /maritime_check_device_access/);
});

test("high-risk CV and application actions consume a fresh passkey proof", async () => {
  const [proof, route] = await Promise.all([readFile(proofUrl, "utf8"), readFile(smartRouteUrl, "utf8")]);
  assert.match(proof, /maritime_consume_passkey_proof/);
  assert.match(proof, /x-allona-passkey-proof/);
  assert.equal((route.match(/await requireMaritimePasskeyProof\(request, ctx\.user\.id\);/g) || []).length, 6);
  assert.match(route, /save_locked_maritime_cv_profile/);
  assert.match(route, /set_maritime_auto_apply_preference/);
  assert.match(route, /confirm_maritime_smart_account/);
  assert.match(route, /create_maritime_application_drafts/);
  assert.match(route, /submit_maritime_application/);
});

test("browser pages perform native WebAuthn without persisting proof tokens", async () => {
  const [browser, cvAccount, smartUi, cvPage, smartPage, app] = await Promise.all([
    readFile(browserUrl, "utf8"),
    readFile(cvAccountUrl, "utf8"),
    readFile(smartUiUrl, "utf8"),
    readFile(cvPageUrl, "utf8"),
    readFile(smartPageUrl, "utf8"),
    readFile(appUrl, "utf8")
  ]);
  assert.match(browser, /window\.PublicKeyCredential/);
  assert.match(browser, /navigator\.credentials\.create/);
  assert.match(browser, /navigator\.credentials\.get/);
  assert.match(browser, /\/v1\/maritime\/passkey\/registration\/verify/);
  assert.match(browser, /\/v1\/maritime\/passkey\/authentication\/verify/);
  assert.doesNotMatch(browser, /localStorage\.setItem|sessionStorage\.setItem/);
  assert.match(cvAccount, /"X-Allona-Passkey-Proof": proof/);
  assert.match(smartUi, /"X-Allona-Passkey-Proof"/);
  assert.match(smartUi, /"X-Allona-Device-Key"/);
  assert.match(cvPage, /js\/maritime-passkey\.js/);
  assert.match(smartPage, /js\/cv-access\.js/);
  assert.match(smartPage, /js\/maritime-passkey\.js/);
  assert.match(app, /"X-Allona-Device-Key"/);
  assert.match(app, /"X-Allona-Passkey-Proof"/);
});

test("same-person duplicate protection remains independent of the browser device", async () => {
  const migration = await readFile(identityMigrationUrl, "utf8");
  assert.match(migration, /person_fingerprint text not null unique/);
  assert.match(migration, /MARITIME_IDENTITY_ALREADY_REGISTERED/);
  assert.match(migration, /where identity_lock\.person_fingerprint = v_person_fingerprint/);
  assert.match(migration, /and identity_lock\.user_id <> p_user_id/);
});
