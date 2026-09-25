import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright/index.mjs";

const target = process.env.MARITIME_CV_TEST_URL || "http://127.0.0.1:4191/pages/ecosystem/maritime-cv.html";
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });

try {
  const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
  await page.route("**/js/supabase-client.js*", route => route.fulfill({ contentType: "application/javascript", body: "" }));
  await page.route("**/js/auth.js*", route => route.fulfill({ contentType: "application/javascript", body: 'window.Allona=window.Allona||{};window.Allona.auth={getSession:async()=>({access_token:"test-token",user:{id:"11111111-1111-4111-8111-111111111111"}}),requireAccountType:async()=>true};' }));
  await page.route("**/js/cv-access.js*", route => route.fulfill({ contentType: "application/javascript", body: 'window.Allona=window.Allona||{};window.Allona.cvAccess={getDeviceKey:async()=>"a".repeat(64)};' }));
  await page.route("**/v1/maritime/cv-profile**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, cv: null, profile_status: "draft", identity_lock: { locked: false, fields: [] } }) }));
  await page.goto(target, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.body.dataset.maritimeCvReady === "true");
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => {
      const photo = document.getElementById("cv_photo");
      photo.src = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="300" height="450" fill="blue"/></svg>');
      photo.hidden = false;
      document.getElementById("emptyPhoto").hidden = true;
    });
    await page.locator("#cv_photo").evaluate(image => image.decode());
    const dimensions = await page.locator(".cvPhotoFrame").evaluate(frame => {
      const photo = frame.querySelector("img");
      return { frameHeight: frame.getBoundingClientRect().height, photoHeight: photo.getBoundingClientRect().height };
    });
    assert.ok(Math.abs(dimensions.frameHeight - dimensions.photoHeight) < 2, `Photo frame has empty height at ${width}px`);
  }
  await page.evaluate(() => {
    window.validateMaritimeCV = () => true;
    window.AllonaMaritimeCommerce = { authorizeOrCheckout: async () => true };
    const note = document.querySelector("#cv_note");
    note.textContent = "Denizcilik deneyimi ve sertifikaları kayıtlıdır. ".repeat(12);
  });
  const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
  await page.locator("[data-cv-pdf]").first().click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /\.pdf$/i);
  const bytes = await readFile(await download.path());
  assert.ok(bytes.byteLength > 10_000, "PDF output is unexpectedly small");
  assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
  console.log(`Maritime CV PDF generated: ${bytes.byteLength} bytes`);
} finally {
  await browser.close();
}
