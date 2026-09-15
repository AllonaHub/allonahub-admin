const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright-core");

const url = process.env.MARITIME_CV_URL || "http://127.0.0.1:4182/pages/ecosystem/maritime-cv.html?release=identity1";
const executablePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForFunction(() => document.body.dataset.maritimeCvReady === "true", null, { timeout: 30000 });
      await page.evaluate(() => {
        document.getElementById("firstName").value = "Nijat";
        document.getElementById("familyName").value = "Mahmudov";
        document.getElementById("fatherName").value = "Ali";
        document.getElementById("birthDate").value = "1990-01-01";
        document.getElementById("birthPlace").value = "Baku";
        document.getElementById("nationality").value = "Azerbaijani";
        document.getElementById("gender").value = "Male";
        document.getElementById("position").value = "Motorman";
        window.applyMaritimeIdentityLock({
          locked: true,
          fields: ["firstName", "familyName", "fatherName", "birthDate", "birthPlace", "nationality", "gender"]
        });
      });

      const state = await page.evaluate(() => ({
        locked: ["firstName", "familyName", "fatherName", "birthDate", "birthPlace", "nationality", "gender"].every((id) => document.getElementById(id).readOnly),
        fatherRequired: document.getElementById("fatherName").required,
        noticeVisible: !document.querySelector("[data-cv-identity-lock-notice]").hidden,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      }));
      assert.equal(state.locked, true, `${viewport.width}px identity fields must be readonly`);
      assert.equal(state.fatherRequired, true, `${viewport.width}px father name must be required`);
      assert.equal(state.noticeVisible, true, `${viewport.width}px identity notice must be visible`);
      assert.equal(state.horizontalOverflow, false, `${viewport.width}px page must not overflow horizontally`);

      page.once("dialog", (dialog) => dialog.accept());
      await page.click("#cvResetButton");
      const cleared = await page.evaluate(() => ({
        firstName: document.getElementById("firstName").value,
        familyName: document.getElementById("familyName").value,
        fatherName: document.getElementById("fatherName").value,
        position: document.getElementById("position").value
      }));
      assert.deepEqual(cleared, { firstName: "Nijat", familyName: "Mahmudov", fatherName: "Ali", position: "" });

      await page.click("[data-open-cv-identity-support]");
      assert.equal(await page.locator("[data-cv-identity-support-dialog]").getAttribute("open"), "");
      await page.click(".cv-dialog-close");
      assert.equal(await page.locator("[data-cv-identity-support-dialog]").getAttribute("open"), null);

      if (viewport.width === 390) {
        await page.click("[data-open-cv-identity-support]");
        await page.screenshot({ path: path.join(os.tmpdir(), "maritime-identity-lock-mobile.png"), fullPage: false });
      }
      await page.close();
    }
    process.stdout.write("Maritime identity lock UI passed at desktop and mobile widths.\n");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
