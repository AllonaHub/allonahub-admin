import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright/index.mjs";

const origin = process.env.PARTNER_TEST_ORIGIN || "http://127.0.0.1:4201";
const baseline = process.env.PARTNER_BASELINE === "1";
const out = process.env.PARTNER_SCREENSHOT_DIR || "/private/tmp/allonahub-partner-footer-qa";
const languages = ["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"];
const germanyLabels = { tr: "Almanya", az: "Almaniya", kk: "Германия", uz: "Germaniya", ky: "Германия", en: "Germany", de: "Deutschland", ru: "Германия", ar: "ألمانيا" };
const passwordLabels = {
  tr: ["Şifreyi göster", "Şifreyi gizle"], az: ["Şifrəni göstər", "Şifrəni gizlət"],
  en: ["Show password", "Hide password"], de: ["Passwort anzeigen", "Passwort ausblenden"],
  ru: ["Показать пароль", "Скрыть пароль"], ar: ["إظهار كلمة المرور", "إخفاء كلمة المرور"],
  kk: ["Құпиясөзді көрсету", "Құпиясөзді жасыру"], uz: ["Parolni ko‘rsatish", "Parolni yashirish"],
  ky: ["Сырсөздү көрсөтүү", "Сырсөздү жашыруу"]
};
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
await mkdir(out, { recursive: true });
const results = [];

async function openPage(path, width) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
  await context.addInitScript(() => { localStorage.setItem("allona.theme", "white"); localStorage.setItem("allona.language", "tr"); });
  const page = await context.newPage();
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "cdn.jsdelivr.net") return route.fulfill({ contentType: "application/javascript", body: `
      window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})};
      window.emailjs={init(){},send:async()=>({status:200})};` });
    if (url.hostname === "challenges.cloudflare.com") return route.fulfill({ contentType: "application/javascript", body: `window.turnstile={render(){return 'qa'},reset(){},remove(){}};` });
    // Read-only UI audit: all account/data writes are blocked, real public images may load.
    if (route.request().method() !== "GET" || url.hostname.includes("supabase") || url.hostname === "api.allonahub.com") return route.abort();
    return route.continue();
  });
  await page.goto(origin + path, { waitUntil: "networkidle" });
  await page.waitForSelector(".site-footer .mobile-payment-logo");
  const reject = page.locator("[data-cookie-reject]");
  if (await reject.isVisible()) await reject.click();
  return { context, page };
}

async function footerSnapshot(page) {
  return page.locator(".site-footer").evaluate((footer) => {
    const selectors = [".footer-grid", ".footer-col", ".footer-col h3", ".footer-col > a:not(.footer-brand)", ".social-icons", ".social-icons a", ".footer-payment-strip", ".mobile-payment-logo", ".mobile-payment-logo img", ".footer-bottom"];
    const properties = ["display", "backgroundColor", "borderRadius", "borderLeftWidth", "borderRightWidth", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight", "gap", "fontSize", "lineHeight", "color", "gridAutoFlow", "gridAutoColumns", "gridTemplateColumns", "overflowX", "width", "opacity"];
    return {
      links: [...footer.querySelectorAll(".footer-col > a, .footer-bottom a")].map((a) => [a.textContent.trim(), new URL(a.href).pathname, new URL(a.href).hash]),
      styles: Object.fromEntries(selectors.map((selector) => { const style = getComputedStyle(footer.querySelector(selector)); return [selector, Object.fromEntries(properties.map((key) => [key, style[key]]))]; })),
      images: [...footer.querySelectorAll("img")].map((image) => ({ alt: image.alt, loaded: image.complete && image.naturalWidth > 0 })),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth
    };
  });
}

try {
  for (const width of baseline ? [390, 1440] : [320, 390, 768, 1440]) {
    const reference = await openPage("/pages/ecosystem/allonadenizcilik.html", width);
    const partner = await openPage("/pages/partner/partner.html", width);
    for (const language of baseline ? ["tr", "en"] : languages) {
      await reference.page.evaluate((lang) => window.Allona.platform.setLanguage(lang), language);
      await partner.page.evaluate((lang) => window.Allona.platform.setLanguage(lang), language);
      const expected = await footerSnapshot(reference.page);
      const actual = await footerSnapshot(partner.page);
      const tabs = {};
      for (const tab of ["login", "forgot", "apply"]) {
        await partner.page.locator(`[aria-controls="${tab}"]`).click();
        if (!baseline && tab === "login") {
          const password = partner.page.locator("#loginPassword");
          const toggle = partner.page.locator(".password-visibility-toggle");
          assert.equal(await toggle.getAttribute("aria-label"), passwordLabels[language][0]);
          await password.fill("Only-a-local-visibility-test");
          await toggle.click();
          assert.equal(await password.getAttribute("type"), "text");
          assert.equal(await toggle.getAttribute("aria-label"), passwordLabels[language][1]);
          await toggle.click();
          assert.equal(await password.getAttribute("type"), "password");
          assert.equal(await toggle.getAttribute("aria-label"), passwordLabels[language][0]);
          await password.fill("");
        }
        tabs[tab] = await partner.page.locator(`#${tab}`).evaluate((form) => ({
          text: form.innerText,
          fields: [...form.querySelectorAll("input,select,textarea")].map((input) => ({ id: input.id, label: input.getAttribute("aria-label"), placeholder: input.placeholder || "", value: input.value })),
          overflow: form.getBoundingClientRect().right > innerWidth + 1 || form.getBoundingClientRect().left < -1
        }));
      }
      results.push({ width, language, expected, actual, tabs });
      if (!baseline) {
        assert.equal(await partner.page.locator('#country option[value="DE"]').textContent(), germanyLabels[language]);
        assert.equal(await partner.page.locator('#countryCode option[value="+49"]').textContent(), `🇩🇪 ${germanyLabels[language]} +49`);
        assert.ok(actual.images.every((image) => image.loaded), "payment and brand images must load");
        assert.ok(tabs.apply.text.includes("Aydın") && tabs.apply.text.includes("Denizli"), "city names must not be partially translated");
        assert.ok(!tabs.apply.text.includes("Monthdın") && !tabs.apply.text.includes("Oceanli"));
        if (language !== "tr") {
          assert.ok(!tabs.forgot.text.includes("Şifre sıfırlama için robot olmadığınızı doğrulayın."));
          for (const tab of Object.values(tabs)) for (const field of tab.fields) assert.ok(field.label, `${field.id}: missing accessible label`);
        }
        const notice = await partner.page.evaluate(() => {
          showNotice("Başvurunuz alındı. Admin inceleme kuyruğuna düştü.");
          return document.querySelector("#notice").textContent;
        });
        if (language !== "tr") assert.notEqual(notice, "Başvurunuz alındı. Admin inceleme kuyruğuna düştü.");
        await partner.page.locator("#notice").evaluate((node) => { node.style.display = "none"; });
        assert.deepEqual(actual.links, expected.links, `${language}/${width}: footer links and labels`);
        // Partner entry uses border-box, maritime uses content-box for badges.
        // Compare shared layout and visible typography without inherited container text colors.
        for (const selector of Object.keys(actual.styles)) {
          const fields = Object.keys(actual.styles[selector]).filter((field) =>
            !(field === "color" && !selector.includes("h3") && !selector.includes("a:not")) &&
            !(field === "gridTemplateColumns" && [".social-icons", ".mobile-payment-logo"].includes(selector))
          );
          for (const field of fields) assert.equal(actual.styles[selector][field], expected.styles[selector][field], `${language}/${width}: ${selector} ${field}`);
        }
        assert.equal(actual.horizontalOverflow, false);
        assert.ok(await partner.page.locator(".social-icons svg path").evaluateAll((paths) => paths.every((path) => getComputedStyle(path).fill === "rgb(255, 255, 255)")));
        if (width < 761) {
          assert.ok(await partner.page.locator(".footer-grid").evaluate((grid) => {
            grid.scrollLeft = document.documentElement.dir === "rtl" ? -150 : 150;
            const moved = Math.abs(grid.scrollLeft) > 0;
            grid.scrollLeft = 0;
            return moved;
          }), "mobile footer must scroll horizontally in both directions");
        }
        for (const tab of Object.values(tabs)) assert.equal(tab.overflow, false);
        assert.equal(await partner.page.locator("#companyLookupBtn").isVisible(), false);
        assert.equal(await partner.page.locator("[data-security-challenge='partner_company_lookup']").count(), 0);
        assert.equal(await partner.page.locator("html").getAttribute("dir"), language === "ar" ? "rtl" : "ltr");
      }
      if (language === "tr") {
        for (const [label, target] of [["reference", reference], [baseline ? "before" : "after", partner]]) {
          await target.page.locator(".site-footer").screenshot({ path: `${out}/${label}-footer-${width}.png` });
          if (label !== "reference") await target.page.screenshot({ path: `${out}/${label}-page-${width}.png`, fullPage: true });
        }
      }
      if (!baseline) {
        for (const theme of ["ocean", "forest", "sunset", "graphite", "turquoise", "white", "navy"]) {
          await partner.page.evaluate((value) => window.Allona.platform.setTheme(value), theme);
          assert.equal(await partner.page.locator("body").getAttribute("data-theme"), "white");
          assert.equal(await partner.page.locator(".platform-control--theme").count(), 0);
        }
      }
    }
    console.log(`${width}px: ${baseline ? "baseline captured" : "9 languages, 3 tabs, footer parity and theme lock passed"}`);
    await reference.context.close();
    await partner.context.close();
  }
} finally {
  await writeFile(`${out}/${baseline ? "before" : "after"}-audit.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
