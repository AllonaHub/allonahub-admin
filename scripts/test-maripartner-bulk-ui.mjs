import assert from "node:assert/strict";
import { chromium } from "/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright/index.mjs";

const target = process.env.MARIPARTNER_TEST_URL || "http://127.0.0.1:4191/pages/partner/maripartner.html";
const screenshotDir = process.env.MARIPARTNER_SCREENSHOT_DIR || "";
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const userId = "11111111-1111-4111-8111-111111111111";
const partnerId = "22222222-2222-4222-8222-222222222222";
const vesselId = "33333333-3333-4333-8333-333333333333";

const workspace = {
  ok: true,
  restricted: false,
  partner: { id: partnerId, display_name: "WF Denizcilik", status: "active", verification_status: "verified" },
  memberships: [{ id: partnerId, display_name: "WF Denizcilik" }],
  verification: { company_active: true, company_verified: true, cycle_current: true, recruiter_authorized: true, ready_for_hiring: true },
  counters: {},
  jobs: [],
  vessels: [{
    id: vesselId,
    vessel_name: "NURKA",
    imo_number: "9389370",
    vessel_type: "General Cargo",
    flag_state: "Vanuatu",
    status: "verified",
    verification_status: "verified",
    metadata: { deadweight: 8200, gross_tonnage: 5100, year_built: 2006, current_port: "Pire", destination: "Valensiya" }
  }],
  matches: [], candidate_rooms: [], partner_notifications: [], applications: [], interviews: [], offers: [],
  work_relationships: [], relief_plans: [], urgent_crew_requests: [], saved_searches: [], favorite_candidates: [],
  refresh_campaigns: [], evidence_requests: [], evidence_templates: [], sla_policies: [], sla_instances: [], handovers: [], reviewer_passes: [],
  reference_matches: [], employer_references: [], notification_preferences: { in_app_mode: "all", email_digest: "off" }
};

try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    let submittedBatch = null;
    await page.addInitScript(() => localStorage.setItem("allona.theme", "sunset"));
    await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ contentType: "application/javascript", body: "window.supabase={};" }));
    await page.route("**/js/supabase-client.js*", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
    await page.route("**/js/auth.js*", (route) => route.fulfill({
      contentType: "application/javascript",
      body: `window.Allona=window.Allona||{};window.Allona.auth={getSession:async()=>({access_token:"test-token",user:{id:"${userId}"}}),signOut:async()=>{}};`
    }));
    await page.route("http://localhost:3000/v1/maritime/partner-center**", async (route) => {
      const url = route.request().url();
      if (url.includes("/ui-translations")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, translations: {} }) });
      if (url.includes("/jobs/bulk") && route.request().method() === "POST") {
        submittedBatch = JSON.parse(route.request().postData() || "{}");
        return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true, created_count: 2, auto_published_count: 2, results: [] }) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(workspace) });
    });
    await page.goto(`${target}?view=operations`, { waitUntil: "networkidle" });
    await page.waitForSelector(".mp-quick-action-group");
    assert.equal(await page.locator(".mp-quick-action-group > button").count(), 2);
    await page.locator('.mp-quick-action-group [data-mp-open="job-bulk-create"]').click();
    await page.waitForSelector("[data-mp-job-bulk-form]");

    assert.equal(await page.locator(".platform-control--theme").count(), 0);
    for (const theme of ["ocean", "sunset", "turquoise"]) {
      await page.evaluate((selected) => window.Allona.platform.setTheme(selected), theme);
      await page.waitForFunction(() => document.body.dataset.theme === "white" && document.documentElement.dataset.theme === "white");
    }
    const themeLock = await page.evaluate(() => ({
      htmlTheme: document.documentElement.dataset.theme,
      bodyTheme: document.body.dataset.theme,
      partnerThemeLocked: document.documentElement.dataset.partnerThemeLocked,
      visibleThemeControls: document.querySelectorAll(".platform-control--theme, [data-theme-select], [data-theme-option]").length,
      exposedThemes: window.Allona.platform.themes.map((theme) => theme.code),
      preservedGlobalPreference: localStorage.getItem("allona.theme"),
      body: getComputedStyle(document.body).backgroundColor,
      panel: getComputedStyle(document.querySelector(".mp-stats article")).backgroundColor,
      input: getComputedStyle(document.querySelector('[data-mp-job-bulk-form] input')).backgroundColor
    }));
    assert.deepEqual(themeLock, {
      htmlTheme: "white",
      bodyTheme: "white",
      partnerThemeLocked: "true",
      visibleThemeControls: 0,
      exposedThemes: ["white"],
      preservedGlobalPreference: "sunset",
      body: "rgb(237, 247, 252)",
      panel: "rgb(255, 255, 255)",
      input: "rgb(255, 255, 255)"
    });
    if (screenshotDir) {
      await page.screenshot({ path: `${screenshotDir}/maripartner-white-${width}.png`, fullPage: false });
    }

    const firstGroup = page.locator("[data-mp-bulk-vessel]").first();
    await firstGroup.locator('[name="vessel_profile_id"]').selectOption(vesselId);
    await firstGroup.locator('[name="joining_port"]').fill("Pire");
    await firstGroup.locator('[name="trading_area"]').selectOption("mediterranean");
    await firstGroup.locator('[name="war_risk_status"]').selectOption("no_known_listed_area");
    await firstGroup.locator('[name="current_position_confirmed"]').check();
    const firstPosition = firstGroup.locator("[data-mp-bulk-position]").first();
    await firstPosition.locator('[name="rank_code"]').selectOption("master");
    await firstPosition.locator('[name="openings_count"]').fill("2");
    await firstPosition.locator('[name="salary_amount"]').fill("6500");
    await firstPosition.locator('[name="salary_currency"]').selectOption("USD");
    await firstPosition.locator('[name="contract_code"]').selectOption("six_months");
    await firstGroup.locator("[data-mp-bulk-add-position]").click();
    const secondPosition = firstGroup.locator("[data-mp-bulk-position]").nth(1);
    await secondPosition.locator('[name="rank_code"]').selectOption("chief_engineer");
    await secondPosition.locator('[name="salary_amount"]').fill("6200");
    await secondPosition.locator('[name="salary_currency"]').selectOption("USD");
    await secondPosition.locator('[name="contract_code"]').selectOption("six_months");

    const layout = await page.evaluate(() => {
      const drawer = document.querySelector("[data-mp-drawer]").getBoundingClientRect();
      const form = document.querySelector("[data-mp-job-bulk-form]").getBoundingClientRect();
      const quickActions = document.querySelector(".mp-quick-action-group").getBoundingClientRect();
      const commonGrid = document.querySelector(".mp-bulk-common-grid");
      const footerButtons = [...document.querySelectorAll(".mp-bulk-footer > button")].map((button) => button.getBoundingClientRect().height);
      return {
        viewport: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        drawerLeft: drawer.left,
        drawerRight: drawer.right,
        formLeft: form.left,
        formRight: form.right,
        drawerWidth: drawer.width,
        quickActionsLeft: quickActions.left,
        quickActionsRight: quickActions.right,
        commonGridColumns: getComputedStyle(commonGrid).gridTemplateColumns.split(" ").length,
        tallestFooterButton: Math.max(...footerButtons),
        groups: document.querySelectorAll("[data-mp-bulk-vessel]").length,
        positions: document.querySelectorAll("[data-mp-bulk-position]").length,
        summary: document.querySelector("[data-mp-bulk-summary]").textContent.trim()
      };
    });
    assert.ok(layout.scrollWidth <= width + 1, `${width}px görünümünde yatay taşma var`);
    assert.ok(layout.drawerLeft >= -1 && layout.drawerRight <= width + 1, `${width}px çekmece görünüm alanından taşıyor`);
    assert.ok(layout.formLeft >= -1 && layout.formRight <= width + 1, `${width}px toplu ilan formu taşıyor`);
    assert.ok(layout.quickActionsLeft >= -1 && layout.quickActionsRight <= width + 1, `${width}px ilan buton grubu taşıyor`);
    assert.ok(layout.drawerWidth <= (width <= 720 ? width : 980) + 2, `${width}px toplu ilan çekmecesi gereğinden geniş`);
    assert.equal(layout.commonGridColumns, width <= 390 ? 1 : 3);
    assert.ok(layout.tallestFooterButton <= 48, `${width}px toplu ilan işlem butonları gereğinden yüksek`);
    assert.equal(layout.groups, 1);
    assert.equal(layout.positions, 2);
    assert.match(layout.summary, /2 bağımsız ilan · toplam 3 açık pozisyon/);
    await page.locator('[data-mp-job-bulk-form] button[type="submit"]').click();
    await page.waitForFunction(() => document.querySelector("[data-mp-alert]")?.textContent.includes("2 ilan oluşturuldu"));
    assert.equal(submittedBatch?.jobs?.length, 2);
    assert.deepEqual(submittedBatch.jobs.map((job) => job.rank_code), ["master", "chief_engineer"]);
    assert.deepEqual(submittedBatch.jobs.map((job) => job.openings_count), [2, 1]);
    assert.equal(new Set(submittedBatch.jobs.map((job) => job.client_listing_id)).size, 2);
    assert.ok(submittedBatch.jobs.every((job) => job.vessel_profile_id === vesselId));
    process.stdout.write(`MariPartner toplu ilan ve açık tema kilidi ${width}px: ${JSON.stringify({ layout, themeLock })}\n`);
    await context.close();
  }
} finally {
  await browser.close();
}
