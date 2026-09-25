import assert from "node:assert/strict";
import { chromium } from "/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright/index.mjs";

const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const partnerId = "22222222-2222-4222-8222-222222222222";
try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ contentType: "application/javascript", body: "window.supabase={};" }));
    await page.route("**/js/supabase-client.js*", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
    await page.route("**/js/auth.js*", (route) => route.fulfill({ contentType: "application/javascript", body: 'window.Allona=window.Allona||{};window.Allona.auth={getSession:async()=>({access_token:"test-token",user:{id:"11111111-1111-4111-8111-111111111111"}}),signOut:async()=>{}};' }));
    await page.route("http://localhost:3000/v1/maritime/partner-center**", (route) => {
      const url = route.request().url();
      const body = url.includes("/joining-operations") ? { ok: true, operations: [] }
        : url.includes("/private-candidates") ? { ok: true, candidates: [{ id: "33333333-3333-4333-8333-333333333333", full_name: "Ali Deniz", rank_code: "master", source: "company_pool" }] }
        : url.includes("/ui-translations") ? { ok: true, translations: {} }
          : { ok: true, restricted: false, partner: { id: partnerId, display_name: "WF Denizcilik", status: "active", verification_status: "verified" }, memberships: [{ id: partnerId, display_name: "WF Denizcilik" }], verification: { ready_for_hiring: true }, counters: {}, jobs: [{ id: "44444444-4444-4444-8444-444444444444", job_title: "Kaptan", rank_code: "master" }], offers: [{ id: "55555555-5555-4555-8555-555555555555", job_id: "44444444-4444-4444-8444-444444444444", offer_status: "accepted" }], candidate_rooms: [], matches: [], vessels: [], applications: [], partner_notifications: [] };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto("http://127.0.0.1:4191/pages/partner/maripartner.html", { waitUntil: "networkidle" });
    await page.locator('[data-mp-open="private-pool"]').first().click();
    await page.getByText("Ali Deniz").waitFor();
    assert.equal(await page.locator("[data-mp-private-source] option").count(), 4);
    await page.locator('[data-mp-drawer] [data-mp-close]').click();
    await page.locator('.mp-quick-actions [data-mp-open="joining"]').click();
    assert.equal(await page.locator("[data-mp-joining-offers] option").count(), 2);
    for (const name of ["flight_status", "hotel_status", "transfer_status"]) {
      assert.equal(await page.locator(`[data-mp-joining-form] select[name="${name}"]`).inputValue(), "requested");
    }
    await page.getByText("Henüz yerleştirme dosyası yok.", { exact: false }).waitFor();
    const joiningLayout = await page.evaluate(() => {
      const drawer = document.querySelector('.mp-drawer--joining');
      const form = drawer.querySelector('.mp-joining-form');
      const fields = [...form.querySelectorAll('label')].map((label) => label.getBoundingClientRect());
      const overlaps = fields.some((a, i) => fields.slice(i + 1).some((b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1));
      const header = getComputedStyle(drawer.querySelector('header'));
      return { overlaps, overflow: form.scrollWidth > form.clientWidth || drawer.scrollWidth > drawer.clientWidth, headerBackground: header.backgroundColor, buttonHeight: form.querySelector('button').getBoundingClientRect().height };
    });
    assert.equal(joiningLayout.overlaps, false, `joining fields overlap at ${width}px`);
    assert.equal(joiningLayout.overflow, false, `joining drawer overflows at ${width}px`);
    assert.ok(joiningLayout.buttonHeight >= 48, `joining button too small at ${width}px`);
    assert.notEqual(joiningLayout.headerBackground, 'rgb(7, 27, 47)', `dark joining header at ${width}px`);
    if (width === 390 || width === 1440) await page.locator('.mp-drawer--joining').screenshot({ path: `/tmp/maripartner-joining-${width}.png` });
    if (width === 390) {
      await page.locator('.mp-joining-save').scrollIntoViewIfNeeded();
      await page.locator('.mp-drawer--joining').screenshot({ path: '/tmp/maripartner-joining-390-bottom.png' });
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}px`);
    await context.close();
  }
} finally { await browser.close(); }
