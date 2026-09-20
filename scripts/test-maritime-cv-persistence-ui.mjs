import assert from "node:assert/strict";
import { chromium } from "/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright/index.mjs";

const target = process.env.MARITIME_CV_TEST_URL || "http://127.0.0.1:4191/pages/ecosystem/maritime-cv.html";
const screenshotDir = process.env.MARITIME_CV_SCREENSHOT_DIR || "";
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const userId = "11111111-1111-4111-8111-111111111111";

try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    let storedCv = null;
    let draftSaveCount = 0;
    const alerts = [];

    await page.addInitScript(() => {
      window.alert = (message) => window.__cvAlerts.push(String(message));
      window.__cvAlerts = [];
    });
    await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ contentType: "application/javascript", body: "window.supabase={};" }));
    await page.route("**/js/supabase-client.js*", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
    await page.route("**/js/auth.js*", (route) => route.fulfill({
      contentType: "application/javascript",
      body: `window.Allona=window.Allona||{};window.Allona.auth={getSession:async()=>({access_token:"test-token",user:{id:"${userId}"}}),requireAccountType:async()=>true};`
    }));
    await page.route("**/js/cv-access.js*", (route) => route.fulfill({
      contentType: "application/javascript",
      body: "window.Allona=window.Allona||{};window.Allona.cvAccess={getDeviceKey:async()=>\"a\".repeat(64)};"
    }));
    await page.route("**/v1/maritime/cv-profile**", async (route) => {
      const request = route.request();
      if (request.method() === "GET") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
          ok: true,
          cv: storedCv,
          profile_status: storedCv ? "draft" : "draft",
          completion_percent: storedCv ? 12 : 0,
          profile_photo_url: null,
          identity_lock: { locked: false, fields: [] },
          global_cv_readiness: { ready: false, missing: ["photo"] }
        }) });
      }
      if (request.method() === "PUT" && request.url().endsWith("/draft")) {
        storedCv = JSON.parse(request.postData() || "{}").cv;
        draftSaveCount += 1;
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
          ok: true,
          cv: storedCv,
          profile: { profile_status: "draft", completion_percent: 12 },
          identity_lock: { locked: false, fields: [] },
          global_cv_readiness: { ready: false, missing: ["photo"] }
        }) });
      }
      return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false }) });
    });

    await page.goto(target, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.body.dataset.maritimeCvReady === "true");
    await page.locator("#firstName").fill("Deniz");
    await page.locator(".cv-final-actions [data-cv-save]").click();
    await page.waitForFunction(() => window.__cvAlerts.length > 0);
    alerts.push(...await page.evaluate(() => window.__cvAlerts));
    assert.equal(draftSaveCount, 1);
    assert.equal(storedCv.fields.firstName, "Deniz");
    assert.match(alerts.at(-1), /kaydedildi|saved|saxlanıldı|сохранён/i);

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => document.body.dataset.maritimeCvReady === "true");
    assert.equal(await page.locator("#firstName").inputValue(), "Deniz");
    assert.equal(await page.locator("[data-cv-save]").count(), 2);
    assert.equal(await page.locator("[data-cv-pdf]").count(), 2);
    assert.equal(await page.locator("[data-cv-back-to-top]").count(), 1);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.locator("[data-cv-back-to-top]").click();
    await page.waitForTimeout(50);
    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewport: innerWidth,
      top: window.scrollY,
      finalActions: [...document.querySelectorAll(".cv-final-actions button")].map((button) => ({
        label: button.textContent.trim(),
        height: button.getBoundingClientRect().height,
        width: button.getBoundingClientRect().width
      }))
    }));
    assert.ok(layout.scrollWidth <= width + 1, `${width}px görünümünde yatay taşma var`);
    assert.equal(layout.top, 0);
    assert.equal(layout.finalActions.length, 3);
    assert.ok(layout.finalActions.every((button) => button.height >= 48));
    if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/maritime-cv-actions-${width}.png`, fullPage: true });
    process.stdout.write(`Maritime CV kalıcı kayıt ve alt işlemler ${width}px: ${JSON.stringify(layout)}\n`);
    await context.close();
  }
} finally {
  await browser.close();
}
