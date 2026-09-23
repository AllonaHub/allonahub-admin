import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const base = process.env.MARITIME_NAV_BASE || "http://127.0.0.1:4201";
const output = process.env.MARITIME_NAV_OUTPUT || "/private/tmp/allonahub-maritime-auth-nav-qa";
const url = base + "/pages/ecosystem/allonadenizcilik.html";
const selector = "[data-maritime-auth-nav]";
const paths = ["maritime-jobs.html", "maritime-applications.html", "maritime-offers.html", "maritime-auto-apply.html", "maritime-complaints.html"];
const results = [];
await mkdir(output, { recursive: true });

// Only the auth transport is simulated. The page, layout, translations and CSS
// run unchanged; no real accounts, tokens, emails or database writes are used.
function installAuthDouble() {
  const listeners = new Set();
  const user = { id: "maritime-ui-test-user", app_metadata: { role: "customer" } };
  let verified = false;
  let cached = false;
  let held = true;
  let failure = false;
  let pending = [];
  const session = () => cached ? { user, access_token: "ui-test-only", expires_at: Date.now() / 1000 + 3600 } : null;
  const control = window.__maritimeAuthTest = {
    set(options) {
      if ("verified" in options) verified = options.verified;
      if ("cached" in options) cached = options.cached;
      if ("held" in options) held = options.held;
      if ("failure" in options) failure = options.failure;
    },
    emit(event) { listeners.forEach(callback => callback(event, session())); },
    release() { held = false; const jobs = pending; pending = []; jobs.forEach(resolve => resolve()); },
    pendingCount() { return pending.length; },
    listenerCount() { return listeners.size; }
  };
  const auth = {
    async getUser() {
      const result = { data: { user: verified ? user : null }, error: failure ? { message: "Test verification failure" } : null };
      if (held) await new Promise(resolve => pending.push(resolve));
      return result;
    },
    async getSession() { return { data: { session: session() }, error: null }; },
    async refreshSession() { return auth.getSession(); },
    onAuthStateChange(callback) {
      listeners.add(callback);
      return { data: { subscription: { unsubscribe() { listeners.delete(callback); } } } };
    },
    async signOut() { verified = false; cached = false; control.emit("SIGNED_OUT"); return { error: null }; }
  };
  const query = new Proxy({}, { get(target, property) {
    if (property === "then") return resolve => Promise.resolve(resolve({ data: null, error: null }));
    return () => query;
  } });
  window.supabase = { createClient: () => ({ auth, from: () => query }) };
}

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
async function checkState(page, visible) {
  await page.waitForFunction(({ selector, visible }) => {
    const element = document.querySelector(selector);
    return element && !element.hidden === visible && (getComputedStyle(element).display !== "none") === visible;
  }, { selector, visible });
  const nav = page.locator(selector);
  assert.equal(await nav.isVisible(), visible);
  assert.equal(await nav.locator("a").count(), 5);
  assert.deepEqual(await nav.locator("a").evaluateAll(links => links.map(link => link.getAttribute("href"))), paths);
  for (const link of await nav.locator("a").all()) assert.equal(await link.isVisible(), visible);
  assert.equal(await page.locator(".mobile-maritime__brand").isVisible(), true);
  assert.equal(await page.locator("[data-maritime-mobile-account]").isVisible(), true);
  assert.equal(await page.locator("[data-maritime-mobile-search]").isVisible(), true);
  assert.equal(await page.locator(".marsoh-entry").isVisible(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}

try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await context.route("**/npm/@supabase/supabase-js@*", route => route.fulfill({ contentType: "application/javascript", body: `(${installAuthDouble.toString()})();` }));
    await context.route(/https:\/\/[^/]*(?:supabase\.co|api\.allonahub\.com)\//, route => route.fulfill({ status: 503, contentType: "application/json", body: "{}" }));
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.Allona?.platform && window.__maritimeAuthTest?.pendingCount() > 0);
    await checkState(page, false);
    results.push({ width, scenario: "Hidden before authentication resolves" });
    await page.evaluate(() => __maritimeAuthTest.release());
    await checkState(page, false);

    for (const visible of [false, true]) {
      if (visible) {
        await page.evaluate(() => { __maritimeAuthTest.set({ verified: true, cached: true }); __maritimeAuthTest.emit("SIGNED_IN"); });
      }
      await checkState(page, visible);
      for (const theme of ["ocean", "white", "forest", "sunset", "graphite", "turquoise", "corporate"]) {
        for (const language of ["tr", "az", "en", "de", "ru", "ar", "kk", "uz", "ky"]) {
          await page.evaluate(({ theme, language }) => { Allona.platform.setTheme(theme); Allona.platform.setLanguage(language); }, { theme, language });
          await checkState(page, visible);
          results.push({ width, theme, language, authenticated: visible });
        }
      }
      await page.evaluate(() => { Allona.platform.setLanguage("tr"); Allona.platform.setTheme("ocean"); });
      await page.screenshot({ path: `${output}/${visible ? "signed-in" : "guest"}-${width}.png` });
    }

    const firstLink = page.locator(selector + " a").first();
    await firstLink.focus();
    assert.equal(await firstLink.evaluate(link => link === document.activeElement), true);
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(selector + " a").nth(1).evaluate(link => link === document.activeElement), true);

    await page.evaluate(() => { __maritimeAuthTest.set({ held: true }); __maritimeAuthTest.emit("TOKEN_REFRESHED"); });
    await page.waitForFunction(() => __maritimeAuthTest.pendingCount() > 0);
    await page.evaluate(() => Allona.supabase.auth.signOut());
    await checkState(page, false);
    await page.evaluate(() => __maritimeAuthTest.release());
    await page.waitForFunction(() => !__maritimeAuthTest.pendingCount());
    await checkState(page, false);
    assert.equal(await page.locator("[data-maritime-mobile-account]").getAttribute("data-maritime-authenticated"), "false");
    results.push({ width, scenario: "Logout hides immediately; stale verification cannot reveal menu" });

    await page.evaluate(() => { __maritimeAuthTest.set({ verified: false, cached: true, failure: true }); __maritimeAuthTest.emit("SIGNED_IN"); });
    await checkState(page, false);
    results.push({ width, scenario: "Cached session with failed server verification stays hidden" });
    await page.evaluate(() => { __maritimeAuthTest.set({ verified: true, failure: false }); __maritimeAuthTest.emit("SIGNED_IN"); });
    await checkState(page, true);

    const subscriptions = await page.evaluate(() => __maritimeAuthTest.listenerCount());
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
    await checkState(page, false);
    assert.equal(await page.evaluate(() => __maritimeAuthTest.listenerCount()), subscriptions - 1);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await checkState(page, true);
    assert.equal(await page.evaluate(() => __maritimeAuthTest.listenerCount()), subscriptions);
    await page.evaluate(() => { __maritimeAuthTest.set({ verified: false, cached: false }); __maritimeAuthTest.emit("INITIAL_SESSION"); });
    await checkState(page, false);
    results.push({ width, scenario: "Back-forward lifecycle revalidates and unsubscribes; empty session hides" });
    assert.deepEqual(errors, [], "No browser JavaScript errors");
    await context.close();
    console.log(`${width}px: guest/signed-in, 9 languages, 7 themes, auth races and lifecycle passed`);
  }

  const noScript = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await noScript.newPage();
  for (const width of [390, 1440]) {
    await staticPage.setViewportSize({ width, height: 900 });
    await staticPage.goto(url, { waitUntil: "domcontentloaded" });
    assert.equal(await staticPage.locator(selector).isVisible(), false);
  }
  await noScript.close();
  results.push({ scenario: "No JavaScript: guest menu hidden on mobile and desktop" });

  // Real SDK, no test doubles or stored sessions: final anonymous smoke test.
  const anonymous = await browser.newContext();
  const guest = await anonymous.newPage();
  for (const width of [390, 1440]) {
    await guest.setViewportSize({ width, height: 900 });
    await guest.goto(url, { waitUntil: "networkidle" });
    await checkState(guest, false);
  }
  await anonymous.close();
  results.push({ scenario: "Real SDK anonymous smoke: mobile and desktop passed" });
  console.log(JSON.stringify({ passed: results.length, base, screenshots: output, realUserDataChanged: false }));
} finally {
  await browser.close();
  await writeFile(output + "/report.json", JSON.stringify(results, null, 2));
}
