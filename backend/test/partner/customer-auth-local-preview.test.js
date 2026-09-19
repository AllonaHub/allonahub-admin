import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("local auth preview uses Cloudflare's documented test site key", async () => {
  const config = await source("js/config.js");

  assert.match(config, /localPreviewHost\s*\?\s*"1x00000000000000000000AA"/);
  assert.match(config, /:\s*"0x4AAAAAADokiv3Rugyxil7J"/);
});

test("auth page loads one cache-busted config and challenge runtime", async () => {
  const page = await source("pages/account/user.html");

  assert.equal((page.match(/js\/config\.js/g) || []).length, 1);
  assert.match(page, /js\/config\.js\?v=20260919-authfix2/);
  assert.match(page, /js\/security-challenge\.js\?v=20260919-authfix2/);
});

test("GitHub Pages auth mirror redirects to the protected canonical domain", async () => {
  const page = await source("pages/account/user.html");

  assert.match(page, /window\.location\.hostname!=="allonahub\.github\.io"/);
  assert.match(page, /new URL\("\/pages\/account\/user\.html","https:\/\/allonahub\.com"\)/);
  assert.match(page, /target\.origin!==current\.origin/);
  assert.match(page, /canonical\.searchParams\.set\("returnTo",canonicalPath\+target\.search\+target\.hash\)/);
  assert.match(page, /window\.location\.replace\(canonical\.href\)/);
});

test("direct email auth is strictly limited to local previews", async () => {
  const page = await source("pages/account/user.html");

  assert.match(page, /function isLocalAuthPreview\(\)/);
  assert.match(page, /if\(isLocalAuthPreview\(\)\)\{\s*await securityChallengeToken\("login"\);\s*data=await directSupabaseLogin\(email,password\);/);
  assert.match(page, /if\(isLocalAuthPreview\(\)\)\{\s*await securityChallengeToken\("register"\);\s*result=await directSupabaseRegistration\(registrationPayload\);/);
});

test("production customer login still requires the backend auth path", async () => {
  const page = await source("pages/account/user.html");

  assert.match(page, /data = await authApi\("\/v1\/auth\/login"/);
  assert.match(page, /turnstileToken:await securityChallengeToken\("login"\)/);
  assert.doesNotMatch(page, /backendUnavailable/);
});

test("local registration keeps required profile metadata", async () => {
  const page = await source("pages/account/user.html");

  assert.match(page, /async function directSupabaseRegistration\(payload\)/);
  assert.match(page, /full_name:payload\.full_name/);
  assert.match(page, /phone:payload\.phone/);
  assert.match(page, /country:payload\.profile && payload\.profile\.country/);
  assert.match(page, /emailRedirectTo:pageUrl\("\/pages\/account\/user\.html\?tab=login"\)/);
});

test("device binding is bypassed only for the local static preview", async () => {
  const page = await source("pages/account/user.html");

  assert.match(page, /async function claimCustomerAccountDevice\(user\)\{\s*\/\/[^]*?if\(isLocalAuthPreview\(\)\)return true;/);
  assert.match(page, /fetch\(apiBaseUrl\(\)\+"\/v1\/auth\/device\/claim"/);
});

test("normal login preserves trusted admin roles when profile RLS hides the row", async () => {
  const page = await source("pages/account/user.html");

  assert.match(page, /const trustedAuthRole=String\(user\.app_metadata && user\.app_metadata\.role \|\| ""\)/);
  assert.match(page, /const role=String\(profile\.role \|\| trustedAuthRole \|\| "customer"\)/);
  assert.match(page, /if\(context\.type==="customer" && !await claimCustomerAccountDevice\(verified\.user\)\)return;/);
});

test("a non-Turnstile 403 is not mislabeled as a robot verification failure", async () => {
  const page = await source("pages/account/user.html");
  const loginFailure = page.slice(page.indexOf("function loginFailureMessage"), page.indexOf("async function directSupabaseLogin"));
  const registrationFailure = page.slice(page.indexOf("function registerFailureMessage"), page.indexOf("function normalizeRegistrationPhone"));

  assert.doesNotMatch(loginFailure, /status===403/);
  assert.match(loginFailure, /code\.includes\("turnstile"\)/);
  assert.match(loginFailure, /code==="customer_account_required"/);
  assert.doesNotMatch(registrationFailure, /status===403/);
  assert.match(registrationFailure, /code==="CUSTOMER_ACCOUNT_REQUIRED"/);
});
