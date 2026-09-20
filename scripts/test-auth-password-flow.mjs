import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = async (path) => readFile(new URL(path, root), "utf8");
const passwordPages = [
  "pages/account/user.html",
  "pages/account/reset-password.html",
  "pages/account/login.html",
  "pages/account/register.html",
  "pages/partner/partner.html",
  "admin/admin-login.html",
  "admin/super-admin-login.html"
];

for (const path of passwordPages) {
  const html = await read(path);
  assert.match(html, /password-visibility\.css/, `${path} must load password visibility styles`);
  assert.match(html, /password-visibility\.js/, `${path} must load password visibility behavior`);
}

const visibilityScript = await read("js/password-visibility.js");
assert.doesNotThrow(() => new Function(visibilityScript), "password visibility script must parse");
assert.match(visibilityScript, /aria-pressed/, "toggle must expose its state to assistive technology");

const resetPage = await read("pages/account/reset-password.html");
assert.match(resetPage, /config\?\.apiBaseUrl/, "temporary password update must use the configured production API URL");
assert.match(resetPage, /https:\/\/api\.allonahub\.com/, "temporary password update must fail over to the production API host");
assert.doesNotMatch(resetPage, /signOut\(\{scope:"global"\}\)/, "password update must not sign out every device");
assert.doesNotMatch(resetPage, /clearSupabaseAuthTokens/, "password update must not delete the fresh session");
assert.doesNotMatch(resetPage, /searchParams\.set\("forceLogin","1"\)/, "successful reset must not force another logout");
assert.match(resetPage, /supabaseClient\.auth\.setSession/, "temporary password update must apply its replacement session");

const accountPage = await read("pages/account/user.html");
assert.match(accountPage, /const FORCE_ACCOUNT_SWITCH=boolParam\("switchAccount"\)/, "password=updated must not force account switching");

const routes = await read("backend/src/routes/index.js");
assert.match(routes, /replacementSession/, "temporary password endpoint must issue a replacement session when possible");
assert.match(routes, /reauthentication_required/, "temporary password endpoint must report the fallback state honestly");

console.log(`PASS auth password flow (${passwordPages.length} pages)`);
