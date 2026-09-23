import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright/index.mjs";

const target = process.env.PARTNER_TEST_URL || "http://127.0.0.1:4201/pages/partner/partner.html";
const baseline = process.env.PARTNER_BASELINE === "1";
const screenshotDir = process.env.PARTNER_SCREENSHOT_DIR || "/private/tmp/allonahub-partner-manual-application";
await mkdir(screenshotDir, { recursive: true });
const configSource = await readFile(new URL("../js/config.js", import.meta.url), "utf8");
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });

try {
  for (const enabled of baseline ? [true] : [false, true]) {
    for (const width of baseline ? [390, 1440] : [320, 390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
      const page = await context.newPage();
      const submissions = [];
      const lookups = [];
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      // Isolate the UI test: no real accounts, emails, CAPTCHA or provider calls.
      await page.route("**/*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname.endsWith("/js/config.js")) {
          return route.fulfill({ contentType: "application/javascript", body: configSource + (enabled && !baseline ? "\nwindow.Allona.config.partnerCompanyLookupEnabled = true;" : "") });
        }
        if (url.hostname === "cdn.jsdelivr.net") {
          return route.fulfill({ contentType: "application/javascript", body: `
            window.supabase={createClient:()=>({auth:{
              getSession:async()=>({data:{session:null}}),
              onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
            }})};
            window.emailjs={init(){},send:async()=>({status:200})};
          ` });
        }
        if (url.hostname === "challenges.cloudflare.com") {
          return route.fulfill({ contentType: "application/javascript", body: `
            window.testChallengeActions=[];
            window.testChallengeCallbacks={};
            window.turnstile={render(container,options){
              window.testChallengeActions.push(options.action);
              const control=document.createElement('button');
              control.type='button'; control.textContent='Robot kontrolu (test)';
              control.onclick=()=>options.callback('test-'+options.action);
              container.appendChild(control);
              window.testChallengeCallbacks[options.action]=options.callback;
              return options.action;
            },reset(){},remove(){}};
          ` });
        }
        if (url.pathname === "/v1/partner-applications") {
          submissions.push(request.postDataJSON());
          return route.fulfill({ status: 201, json: { ok: true, application: { id: "ui-test-application", status: "pending" } } });
        }
        if (url.pathname === "/v1/partner-company-lookup") {
          lookups.push(request.postDataJSON());
          return route.fulfill({ json: { ok: true, status: "provider_unconfigured", verified: false, company: null } });
        }
        if (url.origin === new URL(target).origin) return route.continue();
        return route.abort();
      });
      await page.goto(target, { waitUntil: "networkidle" });
      const cookieReject = page.locator("[data-cookie-reject]");
      if (await cookieReject.isVisible()) await cookieReject.click();
      await page.locator("#partnerApplyTab").click();
      await page.waitForFunction(() => window.testChallengeActions?.includes("partner_application"));
      if (!baseline) {
        assert.equal(await page.locator("#companyLookupBtn").isVisible(), enabled);
        assert.equal(await page.locator("#companyLookupBtn").isEnabled(), enabled);
        const actions = await page.evaluate(() => window.testChallengeActions);
        assert.equal(actions.includes("partner_company_lookup"), enabled);
        assert.ok(actions.includes("login"));
        const grid = await page.locator("#apply").evaluate((el) => getComputedStyle(el).gridTemplateAreas);
        assert.equal(grid.includes("lookup"), enabled);
        await page.evaluate(() => lookupCompanyInfo());
        assert.equal(lookups.length, 0, "disabled lookup or empty tax number must not query a provider");
      }
      if (baseline || !enabled) {
        await page.locator("#apply").scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${screenshotDir}/${baseline ? "before" : "after"}-${width}.png`, fullPage: true });
        await page.locator(".partner-login").screenshot({ path: `${screenshotDir}/${baseline ? "before" : "after"}-form-${width}.png` });
      }
      if (!baseline) {
        const fields = { contact_name: "Manual Application", email: "manual-application@example.com", phone: "5550000000", tax_number: "1234567890", partner_name: "Manual Maritime Company", tax_office: "Kadikoy" };
        for (const [id, value] of Object.entries(fields)) await page.locator(`#${id}`).fill(value);
        if (!enabled) {
          await page.evaluate(() => lookupCompanyInfo());
          assert.equal(lookups.length, 0, "disabled lookup must ignore valid tax numbers too");
        }
        await page.locator("#company_type").selectOption({ index: 2 });
        await page.locator("#city").selectOption({ index: 1 });
        await page.locator("#category").selectOption({ label: "Denizcilik / Maritime" });
        await page.locator('[data-security-challenge="partner_application"] button').first().click();
        await page.locator("#apply .form-actions .btn").first().click();
        await page.waitForFunction(() => localStorage.getItem("lastPartnerApplication") !== null);
        assert.equal(submissions.length, 1);
        assert.deepEqual(submissions[0].company_lookup, {});
        assert.equal(submissions[0].status, "pending");
        assert.equal(submissions[0].turnstileToken, "test-partner_application");
        assert.equal(submissions[0].company_name, fields.partner_name);
        assert.equal(lookups.length, 0);
        assert.equal(new URL(page.url()).pathname, new URL(target).pathname, "application must not enter a partner panel");
        assert.match(await page.locator("#notice").innerText(), /Admin inceleme/);
        await page.locator("#partnerForgotTab").click();
        await page.waitForFunction(() => window.testChallengeActions?.includes("forgot_password"));
        if (enabled) {
          await page.locator("#partnerApplyTab").click();
          await page.locator("#tax_number").fill("1234567890");
          await page.locator("#companyLookupBtn").click();
          await page.waitForFunction(() => document.querySelector("#companyLookupBtn").disabled === false);
          assert.equal(lookups.length, 1, "lookup can be restored with the feature flag");
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px overflow`);
        assert.deepEqual(errors, []);
      }
      console.log(JSON.stringify({ width, lookupEnabled: enabled, baseline, submissions: submissions.length, pass: true }));
      await context.close();
    }
  }
} finally {
  await browser.close();
}
