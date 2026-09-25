import assert from "node:assert/strict";
import { chromium } from "/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright/index.mjs";

const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const partnerId = "22222222-2222-4222-8222-222222222222";
try {
  for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ contentType: "application/javascript", body: "window.supabase={};" }));
    await page.route("**/js/supabase-client.js*", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
    await page.route("**/js/auth.js*", (route) => route.fulfill({ contentType: "application/javascript", body: 'window.Allona=window.Allona||{};window.Allona.auth={getSession:async()=>({access_token:"test-token",user:{id:"11111111-1111-4111-8111-111111111111"}}),signOut:async()=>{}};' }));
    await page.route("http://localhost:3000/v1/maritime/partner-center**", (route) => {
      const url = route.request().url();
      const body = url.includes("/private-candidates") ? { ok: true, candidates: [{ id: "33333333-3333-4333-8333-333333333333", full_name: "Ali Deniz", rank_code: "master", source: "company_pool" }] }
        : url.includes("/ui-translations") ? { ok: true, translations: {} }
          : { ok: true, restricted: false, partner: { id: partnerId, display_name: "WF Denizcilik", status: "active", verification_status: "verified" }, memberships: [{ id: partnerId, display_name: "WF Denizcilik" }], verification: { ready_for_hiring: true }, counters: {}, jobs: [{ id: "44444444-4444-4444-8444-444444444444", job_title: "Kaptan", rank_code: "master" }], candidate_rooms: [], matches: [], vessels: [], applications: [], partner_notifications: [] };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto("http://127.0.0.1:4191/pages/partner/maripartner.html", { waitUntil: "networkidle" });
    await page.locator('[data-mp-open="private-pool"]').first().click();
    await page.getByText("Ali Deniz").waitFor();
    assert.equal(await page.locator("[data-mp-private-source] option").count(), 4);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}px`);
    await context.close();
  }
} finally { await browser.close(); }
