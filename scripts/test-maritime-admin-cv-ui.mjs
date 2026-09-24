import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { resolve, extname } from "node:path";
import { chromium } from "/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright/index.mjs";

const root = resolve(import.meta.dirname, "..");
const baseline = process.env.MARITIME_CV_BASELINE_REF || "7f90e974e34294e1a81ba4af78769bd5249baca2";
const shots = process.env.MARITIME_CV_SCREENSHOT_DIR || "/tmp/allona-admin-cv-qa";
await mkdir(shots, { recursive: true });
const server = createServer(async (req, res) => {
  const path = resolve(root, `.${new URL(req.url, "http://localhost").pathname}`);
  if (!path.startsWith(`${root}/`)) return res.writeHead(403).end();
  try {
    const content = await readFile(path);
    res.writeHead(200, { "content-type": ({ ".html": "text/html", ".js": "text/javascript", ".css": "text/css" })[extname(path)] || "application/octet-stream" }).end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const target = `http://127.0.0.1:${server.address().port}/admin/maritime-users.html`;
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const user = { id: "00000000-0000-4000-8000-000000000001", public_id: "AL-TEST", full_name: "Sample Seafarer", email: "sample@example.invalid", account_status: "active" };
function detailFixture() {
  return {
    user, profile: user, auth: { email: user.email }, security: {},
    cv_editor: { fields: ["firstName", "familyName", "fatherName", "birthDate", "birthPlace", "position", "nationality", "gender", "email"], presets: { sp: { code: "SP", tr: "Uluslararası Emniyet Yönetimi (ISM Kodu)", en: "International Safety Management (ISM Code)", az: "Beynəlxalq Təhlükəsizliyin İdarə Edilməsi", ru: "Международное управление безопасностью" } } },
    cv_profile: { profile_status: "draft", completion_percent: 100, profile_payload: { manual_cv: {
      lang: "tr", summaryMode: "auto", fields: { firstName: "Şəhriyar", familyName: "Sample", fatherName: "Parent", birthDate: "1990-01-02", birthPlace: "Baku", position: "Gemici", nationality: "Azerbaycan", gender: "Erkek", email: user.email },
      stcwData: [{ presetId: "sp", code: "SP", cert: "123", number: "", name: "", issue: "2025-01-01", expiry: "2035-01-01", included: "true" }],
      seaData: [{ vessel: "Sample vessel", saved: "false", rowId: "00000000-0000-4000-8000-000000000002", serviceDocumentId: "00000000-0000-4000-8000-000000000003" }], additionalData: []
    } } }
  };
}
try {
  for (const width of [390, 1440]) {
    for (const mode of ["before", "after"]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      let detail = detailFixture();
      let saved = null;
      await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
      await page.route("**/js/supabase-client.js*", (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
      await page.route("**/js/auth.js*", (route) => route.fulfill({ contentType: "text/javascript", body: 'window.Allona.auth={getSession:async()=>({access_token:"test"})};' }));
      await page.route("**/v1/control-center/**", async (route) => {
        const url = new URL(route.request().url());
        if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,PATCH" } });
        let response = { ok: true };
        if (url.pathname.endsWith("/cv")) {
          saved = route.request().postDataJSON();
          detail.cv_profile.profile_payload = saved.profile_payload;
          detail.cv_profile.profile_status = saved.profile_status;
        } else if (url.pathname.endsWith(user.id)) response = detail;
        else if (url.pathname.endsWith("/maritime-users")) response = { users: [user] };
        await route.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(response) });
      });
      if (mode === "before") {
        for (const file of ["js/admin-maritime-users.js", "css/admin-maritime-users.css"]) {
          const body = execFileSync("git", ["show", `${baseline}:${file}`], { cwd: root, encoding: "utf8" });
          await page.route(`**/${file}*`, (route) => route.fulfill({ contentType: file.endsWith(".js") ? "text/javascript" : "text/css", body }));
        }
      }
      await page.goto(target, { waitUntil: "networkidle" });
      await page.locator(`[data-user-id="${user.id}"]`).click();
      await page.locator('[data-tab="cv"]').click();
      await page.locator('[data-cv-field="birthPlace"]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${shots}/${mode}-${width}.png` });
      if (mode === "after") {
        assert.equal(await page.locator('[data-cv-field="birthPlace"]').getAttribute("type"), "text");
        assert.equal(await page.locator('[data-cv-field="birthPlace"]').inputValue(), "Bakü");
        assert.equal(await page.locator('[data-cv-field="number"]').count(), 0);
        const stcw = page.locator('[data-collection="stcwData"]');
        assert.equal(await stcw.locator('[data-row-field="cert"]').count(), 0);
        assert.equal(await stcw.locator('[data-row-field="number"]').inputValue(), "123");
        assert.match(await stcw.locator('[data-row-field="name"]').inputValue(), /Uluslararası/);
        await page.locator('[data-cv-form] [name="profile_status"]').selectOption("verified");
        await page.locator('[data-cv-form] [name="reason"]').fill("Sample review reason");
        await page.locator('[name="cv_language"]').selectOption("en");
        assert.equal(await page.locator('[data-cv-field="position"]').inputValue(), "Ordinary Seaman");
        assert.equal(await page.locator('[data-cv-field="firstName"]').inputValue(), "Shahriyar");
        assert.match(await stcw.locator('[data-row-field="name"]').inputValue(), /International/);
        assert.equal(await page.locator('[data-cv-form] [name="profile_status"]').inputValue(), "verified");
        assert.equal(await page.locator('[data-cv-form] [name="reason"]').inputValue(), "Sample review reason");
        await stcw.locator('[data-row-field="number"]').fill("456");
        await page.locator('[data-add-row="stcwData"]').click();
        await stcw.locator('[data-row-index="1"] [data-row-field="name"]').fill("Custom certificate");
        await page.locator('[data-cv-form] button[type="submit"]').click();
        await page.waitForFunction(() => document.querySelector('[data-alert]').textContent.includes("güncellendi"));
        assert.equal(saved.profile_payload.manual_cv.fields.firstName, "Şəhriyar");
        assert.equal(saved.profile_payload.manual_cv.fields.position, "Gemici");
        assert.equal(saved.profile_payload.manual_cv.fields.birthPlace, "Baku");
        assert.equal(saved.profile_payload.manual_cv.lang, "en");
        assert.equal(saved.profile_payload.manual_cv.stcwData[0].number, "456");
        assert.equal(saved.profile_payload.manual_cv.stcwData[0].cert, "");
        assert.equal(saved.profile_payload.manual_cv.stcwData[1].name, "Custom certificate");
        assert.equal(saved.profile_payload.manual_cv.seaData[0].serviceDocumentId, detailFixture().cv_profile.profile_payload.manual_cv.seaData[0].serviceDocumentId);
        const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
        assert.ok(layout.scrollWidth <= layout.width + 1, JSON.stringify(layout));
        assert.deepEqual(errors, []);
        await page.screenshot({ path: `${shots}/saved-${width}.png` });
      }
      console.log(`${mode} admin CV ${width}px: OK`);
      await context.close();
    }
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
