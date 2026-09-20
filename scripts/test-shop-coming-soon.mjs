import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const base = process.env.SHOP_TEST_BASE || "http://127.0.0.1:4197";
const output = process.env.SHOP_TEST_OUTPUT || "/tmp/allonahub-shop-soon-audit";
await mkdir(output, { recursive: true });
const catalog = JSON.parse(await readFile(new URL("../i18n/catalog.json", import.meta.url)));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const cases = [];
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/pages/ecosystem/yak%C4%B1nda.html?module=shop`);
  await page.waitForFunction(() => window.Allona?.platform);
  const reject = page.getByRole("button", { name: "Reddet", exact: true });
  if (await reject.isVisible()) await reject.click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["ocean", "white", "sunset", "turquoise"]) {
      await page.evaluate(theme => window.Allona.platform.setTheme(theme), theme);
      for (const lang of Object.keys(catalog.dirs)) {
        await page.evaluate(lang => window.Allona.platform.setLanguage(lang), lang);
        const expected = catalog.phrases["Allona Shop alışveriş modülümüz geliştirilmeye devam ediyor."][lang];
        await page.waitForFunction(expected => document.querySelector("[data-soon-copy]").textContent.trim() === expected, expected);
        assert.equal(await page.locator("[data-shop-soon-headline]").innerText(), catalog.phrases["Yakında Hizmetinizde"][lang]);
        assert.equal(await page.locator("h1").innerText(), "Allona Shop");
        const measure = await page.evaluate(() => {
          const el = document.querySelector(".soon-panel");
          const box = el.getBoundingClientRect();
          const heading = getComputedStyle(document.querySelector("[data-shop-soon-headline]"));
          return { overflow: document.documentElement.scrollWidth > innerWidth, center: Math.abs(box.x + box.width / 2 - innerWidth / 2), align: getComputedStyle(el).textAlign, color: heading.color, shadow: heading.textShadow, titleColor: getComputedStyle(document.querySelector("h1")).color };
        });
        assert.equal(measure.overflow, false, `${width}/${theme}/${lang}: overflow`);
        assert.ok(measure.center <= 1, `${width}/${theme}/${lang}: not centered`);
        assert.equal(measure.align, "center");
        assert.notEqual(measure.shadow, "none");
        if (theme === "white") assert.notEqual(measure.titleColor, "rgb(255, 255, 255)");
        cases.push({ width, theme, lang, ...measure });
        if ([390, 1440].includes(width) && lang === "tr") await page.screenshot({ path: `${output}/${theme}-${width}.png`, fullPage: true });
      }
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await page.locator("[data-shop-soon-headline]").evaluate(el => getComputedStyle(el).animationName), "none");
  await page.locator("[data-soon-back]").focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  assert.equal(await page.locator("[data-soon-back]").evaluate(el => getComputedStyle(el).outlineStyle), "solid");
  await page.goto(`${base}/index.html`);
  await page.locator(".module-card--shop").click();
  await page.waitForURL(/module=shop/);
  await page.locator("[data-soon-back]").click();
  await page.waitForURL(/index.html/);
  for (const javaScriptEnabled of [true, false]) {
    const redirectContext = await browser.newContext({ javaScriptEnabled });
    const redirectPage = await redirectContext.newPage();
    for (const entry of ["allonashop.html", "shop.html?category=test"]) {
      await redirectPage.goto(`${base}/pages/commerce/${entry}`);
      await redirectPage.waitForURL(/yak%C4%B1nda.html\?module=shop/);
    }
    await redirectContext.close();
  }
  await page.goto(`${base}/pages/ecosystem/yak%C4%B1nda.html?module=seyahat`);
  assert.equal(await page.locator("body").getAttribute("data-soon-module"), null);
  assert.equal(await page.locator("[data-shop-soon-headline]").isVisible(), false);
  console.log(JSON.stringify({ layoutChecks: cases.length, redirects: 4, homeNavigation: "passed", keyboard: "passed", reducedMotion: "passed", otherModules: "unchanged", screenshots: output }));
} finally {
  await browser.close();
  await writeFile(`${output}/report.json`, JSON.stringify(cases, null, 2));
}
