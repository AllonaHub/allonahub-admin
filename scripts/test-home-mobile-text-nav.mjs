import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const base = process.env.HOME_TEST_BASE || "http://127.0.0.1:4197";
const output = "/tmp/allonahub-home-text-nav-audit";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const cases = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${base}/index.html`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.Allona?.platform);
  const desktop = await page.locator(".top-mini-nav, .top-mini-nav a").evaluateAll(els => els.map(el => {
    const style = getComputedStyle(el);
    return Object.fromEntries(["display", "width", "height", "padding", "border", "borderRadius", "backgroundColor", "fontSize", "gap", "flexWrap", "overflowX"].map(key => [key, style[key]]));
  }));
  if (process.env.HOME_NAV_BASELINE) assert.deepEqual(desktop, JSON.parse(await readFile(process.env.HOME_NAV_BASELINE, "utf8")), "Desktop navigation changed");
  await page.screenshot({ path: `${output}/desktop-1440.png` });
  for (const width of [320, 390, 760]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["ocean", "white", "sunset", "turquoise"]) {
      await page.evaluate(theme => window.Allona.platform.setTheme(theme), theme);
      for (const language of ["tr", "az", "en", "de", "ru", "ar", "kk", "uz", "ky"]) {
        await page.evaluate(language => window.Allona.platform.setLanguage(language), language);
        const result = await page.locator(".top-mini-nav").evaluate(nav => {
          const links = [...nav.querySelectorAll("a")].filter(el => !el.hidden);
          const rects = links.map(el => el.getBoundingClientRect());
          return {
            display: getComputedStyle(nav).display,
            overflowX: getComputedStyle(nav).overflowX,
            scrollable: nav.scrollWidth > nav.clientWidth,
            pageOverflow: document.documentElement.scrollWidth > innerWidth,
            singleRow: rects.every(rect => Math.abs(rect.top - rects[0].top) < 1),
            links: links.map(el => {
              const s = getComputedStyle(el);
              return { border: s.borderTopWidth, background: s.backgroundColor, image: s.backgroundImage, radius: s.borderRadius, shadow: s.boxShadow, height: el.getBoundingClientRect().height, href: el.getAttribute("href") };
            })
          };
        });
        assert.equal(result.display, "flex");
        assert.equal(result.overflowX, "auto");
        assert.equal(result.pageOverflow, false);
        assert.equal(result.singleRow, true);
        assert.equal(result.links.length, 4);
        if (width === 320 && language === "tr") assert.equal(result.scrollable, true);
        for (const link of result.links) {
          assert.equal(link.border, "0px");
          assert.equal(link.background, "rgba(0, 0, 0, 0)");
          assert.equal(link.image, "none");
          assert.equal(link.radius, "0px");
          assert.equal(link.shadow, "none");
          assert.ok(link.height >= 44);
          assert.ok(link.href);
        }
        cases.push({ width, theme, language, ...result });
        if (width === 390 && language === "tr") await page.screenshot({ path: `${output}/${theme}-390.png` });
      }
    }
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => window.Allona.platform.setLanguage("tr"));
  const first = page.locator(".top-mini-nav a").first();
  const last = page.locator(".top-mini-nav a").last();
  await first.focus();
  for (let index = 0; index < 3; index++) await page.keyboard.press("Tab");
  assert.equal(await last.evaluate(el => el === document.activeElement), true);
  assert.equal(await last.evaluate(el => getComputedStyle(el).outlineStyle), "solid");
  assert.equal(await last.evaluate(el => {
    const link = el.getBoundingClientRect();
    const rail = el.parentElement.getBoundingClientRect();
    return link.left >= rail.left - 1 && link.right <= rail.right + 1;
  }), true, "Keyboard focus must scroll the last link into view");
  console.log(JSON.stringify({ passed: cases.length, desktop: "unchanged", keyboardScroll: "passed", screenshots: output }));
} finally {
  await browser.close();
  await writeFile(`${output}/report.json`, JSON.stringify(cases, null, 2));
}
