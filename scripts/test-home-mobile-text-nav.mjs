import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const base = process.env.HOME_TEST_BASE || "http://127.0.0.1:4201";
const output = process.env.HOME_TEST_OUTPUT || "/private/tmp/allonahub-mobile-services-qa";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const cases = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await page.goto(base + "/index.html", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.Allona?.platform);
  await page.evaluate(() => { Allona.platform.setLanguage("tr"); Allona.platform.setTheme("ocean"); });
  const toggle = page.locator("#home-services-toggle");
  const menu = page.locator("#home-services-menu");
  assert.equal(await toggle.isVisible(), false);
  assert.equal(await menu.isVisible(), false);
  assert.equal(await page.locator(".top-mini-nav").isVisible(), true);
  assert.equal(await page.locator("body>header>.logo").isVisible(), true);
  const desktop = await page.evaluate(() => [...document.querySelectorAll(".top-mini-nav,body>header,body>header>a,body>header>nav,body>header>.nav-search,body>header>.platform-controls-slot")].map(n => {
    const clone = n.cloneNode(true);
    clone.querySelectorAll("#home-services-toggle,#home-services-menu").forEach(el => el.remove());
    const s = getComputedStyle(n), r = n.getBoundingClientRect();
    return { tag: n.tagName, class: n.className, text: clone.textContent.trim().replace(/\s+/g, " "), box: [r.x,r.y,r.width,r.height], styles: Object.fromEntries(["display","color","backgroundColor","fontSize","padding","gap"].map(k => [k,s[k]])) };
  }));
  if (process.env.HOME_NAV_BASELINE) {
    const before = JSON.parse(await readFile(process.env.HOME_NAV_BASELINE, "utf8")).map(row => ({...row, text: row.text.replace(/\s+/g, " ")}));
    assert.deepEqual(desktop, before, "Desktop header must remain unchanged");
  }
  await page.locator("body>header").screenshot({path: output + "/desktop-header-after.png"});
  await page.screenshot({path: output + "/after-1440.png"});
  for (const width of [320, 390, 760]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["ocean", "white", "forest", "sunset", "graphite", "turquoise", "corporate"]) {
      await page.evaluate(value => Allona.platform.setTheme(value), theme);
      for (const language of ["tr", "az", "en", "de", "ru", "ar", "kk", "uz", "ky"]) {
        await page.evaluate(value => Allona.platform.setLanguage(value), language);
        assert.equal(await page.locator(".top-mini-nav").isVisible(), false);
        assert.equal(await page.locator("body>header>.logo").isVisible(), false);
        assert.equal(await page.locator("body>header>nav").isVisible(), false);
        assert.equal(await toggle.isVisible(), true);
        const rect = await toggle.boundingBox();
        assert.ok(rect.width >= 48 && rect.height >= 48);
        assert.ok(await toggle.getAttribute("aria-label"));
        assert.equal(await menu.isVisible(), false);
        await toggle.click();
        assert.equal(await toggle.getAttribute("aria-expanded"), "true");
        assert.equal(await menu.isVisible(), true);
        const result = await menu.evaluate(element => {
          const r = element.getBoundingClientRect();
          return { links: [...element.querySelectorAll("a")].map(a => ({ href: a.getAttribute("href"), label: a.textContent.trim(), height: a.getBoundingClientRect().height })),
            overflow: document.documentElement.scrollWidth > innerWidth,
            inside: r.left >= 0 && r.right <= innerWidth,
            heading: element.querySelector("h2").textContent,
            ink: getComputedStyle(element.querySelector("a")).color,
            surface: getComputedStyle(element).backgroundColor };
        });
        assert.equal(result.links.length, 3);
        assert.ok(result.links.every(link => link.label && link.height >= 48));
        assert.ok(result.links[0].href.endsWith("/pages/ecosystem/allonadenizcilik.html") || result.links[0].href === "pages/ecosystem/allonadenizcilik.html");
        assert.ok(decodeURI(result.links[1].href).endsWith("pages/ecosystem/yakında.html?module=shop"));
        assert.ok(result.links[2].href.endsWith("/pages/account/user.html"));
        assert.equal(result.inside, true);
        assert.equal(result.overflow, false);
        assert.notEqual(result.ink, result.surface);
        if (language !== "tr") assert.notEqual(result.heading, "Hizmetlerimiz");
        if (width === 390 && language === "tr") await page.screenshot({ path: output + "/menu-" + theme + "-390.png" });
        await page.keyboard.press("Escape");
        assert.equal(await menu.isVisible(), false);
        assert.equal(await toggle.getAttribute("aria-expanded"), "false");
        assert.equal(await toggle.evaluate(node => node === document.activeElement), true);
        cases.push({width, theme, language, ...result});
      }
    }
    console.log(width + "px: 9 languages and 7 themes passed");
  }
  await page.setViewportSize({width:390,height:900});
  await page.evaluate(() => { Allona.platform.setLanguage("tr"); Allona.platform.setTheme("ocean"); });
  await toggle.focus();
  await page.keyboard.press("ArrowDown");
  assert.equal(await menu.locator("a").first().evaluate(n => n === document.activeElement), true);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  assert.equal(await menu.locator("a").last().evaluate(n => n === document.activeElement), true);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");
  assert.equal(await menu.isVisible(), true);
  await page.locator("#globalSearchInput").click({position:{x:5,y:5},force:true});
  // Focus leaving the navigation closes it even when the panel overlays the search field.
  await page.locator("#globalSearchInput").focus();
  assert.equal(await menu.isVisible(), false);
  await toggle.click();
  await toggle.click();
  assert.equal(await menu.isVisible(), false);
  await toggle.click();
  await page.setViewportSize({width:768,height:900});
  assert.equal(await menu.isVisible(), false);
  assert.equal(await toggle.isVisible(), false);
  assert.equal(await page.locator(".top-mini-nav").isVisible(), true);
  for (const [index,path] of [[0,"/pages/ecosystem/allonadenizcilik.html"],[1,"/pages/ecosystem/yakında.html"],[2,"/pages/account/user.html"]]) {
    await page.setViewportSize({width:390,height:900});
    await page.goto(base + "/index.html", {waitUntil:"networkidle"});
    await toggle.click();
    await menu.locator("a").nth(index).click();
    await page.waitForURL(url => decodeURI(url.pathname) === path);
    assert.ok((await page.title()).length > 0);
  }
  console.log(JSON.stringify({passed:cases.length, desktop:"unchanged", keyboard:"passed", closeAndResize:"passed", navigation:"3 destinations passed", screenshots:output}));
} finally {
  await browser.close();
  await writeFile(output + "/report.json", JSON.stringify(cases,null,2));
}
