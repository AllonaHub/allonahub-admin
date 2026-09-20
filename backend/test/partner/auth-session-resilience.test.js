import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("auth runtime refreshes an expiring session instead of treating it as signed out", async () => {
  const authSource = await source("js/auth.js");
  const expired = { expires_at: Math.floor(Date.now() / 1000) - 5, user: { id: "user-1" } };
  const refreshed = { expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "user-1" } };
  let refreshCalls = 0;
  const window = {
    location: { hostname: "allonahub.com", origin: "https://allonahub.com", pathname: "/", search: "", hash: "", href: "https://allonahub.com/", replace() {} },
    Allona: {
      core: { url: value => value },
      supabase: {
        auth: {
          async getSession() { return { data: { session: expired }, error: null }; },
          async refreshSession() { refreshCalls += 1; return { data: { session: refreshed }, error: null }; }
        }
      }
    }
  };
  const context = vm.createContext({
    window,
    document: { body: { dataset: {} } },
    localStorage: { length: 0, key() { return null; }, removeItem() {}, setItem() {} },
    URL,
    URLSearchParams,
    console
  });

  vm.runInContext(authSource, context, { filename: "auth.js" });
  assert.equal(await window.Allona.auth.getSession(), refreshed);
  assert.equal(refreshCalls, 1);
});

test("customer login does not destroy a valid local session before credentials are accepted", async () => {
  const page = await source("pages/account/user.html");
  const loginFlow = page.slice(page.indexOf("async function loginUser()"), page.indexOf("function startGoogleAuth"));
  const beforeCredentialRequest = loginFlow.slice(0, loginFlow.indexOf("let data;"));

  assert.doesNotMatch(beforeCredentialRequest, /clearAuthArtifacts\(/);
  assert.doesNotMatch(beforeCredentialRequest, /auth\.signOut/);
  assert.match(loginFlow, /verifiedSignedInUser\(data\.user\)/);
  assert.match(page, /Mevcut oturumunuz korunuyor/);
});

test("profile helpers reuse the canonical Supabase client", async () => {
  const [profileSync, profilePage] = await Promise.all([
    source("js/user-profile-sync.js"),
    source("pages/account/profil.html")
  ]);

  assert.match(profileSync, /if \(window\.Allona\?\.supabase\) return window\.Allona\.supabase;/);
  assert.match(profileSync, /persistSession: false/);
  assert.match(profilePage, /window\.Allona\?\.supabase \|\| window\.supabase\.createClient/);
});

test("auth-critical assets are network-first and the Supabase browser SDK is pinned", async () => {
  const [worker, loginPage] = await Promise.all([
    source("sw.js"),
    source("pages/account/user.html")
  ]);

  assert.match(worker, /allonahub-pwa-20260920-auth-session1/);
  assert.match(worker, /requestUrl\.pathname === "\/js\/user-profile-sync\.js"/);
  assert.match(loginPage, /@supabase\/supabase-js@2\.108\.2/);
});
