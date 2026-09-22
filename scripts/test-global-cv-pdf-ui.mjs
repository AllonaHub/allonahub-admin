import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { chromium } from "/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright/index.mjs";

const root = resolve(import.meta.dirname, "..");
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, `.${decodeURIComponent(new URL(req.url, "http://localhost").pathname)}`);
    if (!path.startsWith(`${root}/`)) throw new Error("INVALID_PATH");
    res.setHeader("Content-Type", mime[extname(path)] || "application/octet-stream");
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
try {
  for (const width of [320, 390, 768, 1440]) {
    let failure = "";
    let downloadCount = 0;
    const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width <= 390, hasTouch: width <= 390, acceptDownloads: true });
    page.on("download", () => { downloadCount += 1; });
    await page.route("https://cdn.jsdelivr.net/**", route => route.fulfill({ body: "" }));
    for (const script of ["supabase-client", "auth", "allona-maritime-portal"]) {
      await page.route(`**/js/${script}.js*`, route => route.fulfill({ contentType: "application/javascript", body: "" }));
    }
    await page.route("**/js/allona-maritime-smart-account.js*", async route => {
      const source = await readFile(resolve(root, "js/allona-maritime-smart-account.js"), "utf8");
      await route.fulfill({ contentType: "application/javascript", body: source.replace('const code = String(error?.code || "");', 'window.__pdfError = error.stack; const code = String(error?.code || "");') });
    });
    await page.route("**/v1/maritime/smart-account", route => route.fulfill({
      contentType: "application/json", body: JSON.stringify({ ok: true, run: { id: "pdf-fixture", status: "user_confirmed", smart_snapshot: {
        readiness: { score: 100, missing_items: [], expiry_alerts: [] },
        cv_draft: { holder_name: "Deniz Örnek", given_names: "Deniz", family_name: "Örnek", nationality: "Türkiye", date_of_birth: "1995-01-01", place_of_birth: "İstanbul", headline: "Oiler", certificates: [],
          professional_summary: "Makine dairesi operasyonları ve ekip çalışması alanlarında deneyimli denizci. Bakım çalışmalarına ve güvenli vardiya uygulamalarına katkıda bulunur.",
          physical_profile: { height_cm: 182, weight_kg: 78, overall_size: "L", shoe_size: "43" },
          contact: { email: "example@example.invalid", permanent_address: "İstanbul, Türkiye", nearest_airport: "IST" },
          identity_documents: [{kind: "passport", document_number: "EXAMPLE1234", issuing_country: "Türkiye", expiry_date: "2030-01-01"}],
          certificate_records: ["SH", "SI", "SO", "SP", "SL"].map(code => ({ code, title: "Denizde güvenlik eğitimi", document_number: `${code}-EXAMPLE`, issuing_country: "Türkiye", issue_date: "2025-01-01", expiry_date: "2030-01-01" })),
          languages: [{language:"Turkish",level:"Native"},{language:"English",level:"Good"}],
          sea_service: Array.from({ length: 12 }, (_, i) => ({ vessel_name: `Example ${i + 1}`, rank: "Oiler", company_name: "Example Company", vessel_type: "General cargo", gross_tonnage: "12400", deadweight_tonnage: "18000", sign_on_date: "2024-01-01", sign_off_date: "2024-06-01" })) }
      } }, matches: [], application_drafts: [] })
    }));
    await page.route("**/v1/maritime/pdf-download/authorize", route => failure === "network" ? route.abort("failed") : route.fulfill({
      status: failure === "payment" ? 402 : 200, contentType: "application/json",
      body: JSON.stringify(failure === "payment" ? { ok: false, code: "MARITIME_PDF_PAYMENT_REQUIRED" } : { ok: true, allowed: true })
    }));
    await page.route("**/v1/maritime/pdf-checkout", route => route.fulfill({
      status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, code: "BANK_PAYMENT_NOT_CONFIGURED" })
    }));
    await page.goto(`${base}/pages/ecosystem/maritime-smart-account.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      window.Allona.auth = { getSession: async () => ({ access_token: "test-only" }) };
      window.Allona.cvAccess = { getDeviceKey: async () => "a".repeat(64) };
      const render = window.html2canvas;
      window.html2canvas = async (element, options) => {
        const dialog = document.querySelector("[data-cv-dialog]");
        const scroller = document.querySelector("[data-cv-scroll]");
        const before = dialog.getBoundingClientRect().toJSON();
        const scrollBefore = scroller.scrollTop;
        const onclone = options.onclone;
        const observations = [];
        const observe = () => {
          const rect = dialog.getBoundingClientRect();
          observations.push({ stable: rect.width === before.width && rect.height === before.height && rect.x === before.x && rect.y === before.y,
            scrollStable: scroller.scrollTop === scrollBefore, scrollBefore, scrollAfter: scroller.scrollTop, liveCaptureClass: document.body.classList.contains("maritime-pdf-capture") });
        };
        const observer = new ResizeObserver(observe);
        observer.observe(dialog);
        try {
          const canvas = await render(element, { ...options, onclone: async (...args) => {
            await onclone(...args);
            window.__cloneWidth = args[1].getBoundingClientRect().width;
            observe();
          } });
          observe();
          window.__captureObservations = observations;
          window.__canvasSize = { width: canvas.width, height: canvas.height };
          return canvas;
        } catch (e) { window.__renderError = e.stack; throw e; }
        finally { observer.disconnect(); }
      };
      document.dispatchEvent(new CustomEvent("allona:maritime-smart-account-ready", { detail: { session: { access_token: "test-only" } } }));
    });
    await page.locator("[data-open-cv]").click();
    assert.equal(await page.locator(".maritime-cv-record--credential > div > p").count(), 0, "Missing certificate capacity must not invent a captain rank");
    for (const lang of ["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"]) {
      await page.evaluate(lang => {
        document.querySelector("[data-cv-scroll]").scrollTop = 240;
        localStorage.setItem("allona.language", lang);
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
        document.dispatchEvent(new CustomEvent("allona:language-changed"));
      }, lang);
      assert.equal(await page.locator("[data-cv-scroll]").evaluate(el => el.scrollTop), 240, "Language refresh preserves the reading position");
      for (const theme of ["ocean", "graphite", "sunset", "forest", "turquoise", "white", "corporate"]) {
        const layout = await page.evaluate(theme => {
          document.body.dataset.theme = theme;
          const dialog = document.querySelector("[data-cv-dialog]");
          const scroll = document.querySelector("[data-cv-scroll]");
          const rect = dialog.getBoundingClientRect();
          const actions = document.querySelector(".maritime-cv-actions").getBoundingClientRect();
          const content = document.querySelector(".maritime-cv-layout").getBoundingClientRect();
          const badText = [...document.querySelectorAll(".maritime-cv-body h2, .maritime-cv-body h3, .maritime-cv-body p, .maritime-cv-body dd, .maritime-cv-body dt, .maritime-cv-language-list small, .maritime-cv-language-list b, .maritime-cv-code")].filter(el => {
            const style = getComputedStyle(el);
            return style.color === "rgb(255, 255, 255)" || style.webkitTextFillColor === "rgb(255, 255, 255)" || parseFloat(style.fontSize) < 10;
          }).map(el => el.className);
          const clipped = [...document.querySelectorAll(".maritime-cv-body h2, .maritime-cv-body h3, .maritime-cv-facts > div, .maritime-cv-record, .maritime-cv-service-row")].filter(el => {
            const box = el.getBoundingClientRect();
            return box.left < content.left - 1 || box.right > content.right + 1 || el.scrollWidth > el.clientWidth + 1;
          }).map(el => el.className);
          return { overflow: scroll.scrollWidth > scroll.clientWidth + 1, badText, clipped,
            fits: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
            actionsVisible: actions.bottom <= innerHeight && actions.top >= 0, locked: getComputedStyle(document.documentElement).overflow === "hidden" };
        }, theme);
        assert.deepEqual(layout, { overflow: false, badText: [], clipped: [], fits: true, actionsVisible: true, locked: true }, `${width}px ${lang}/${theme}`);
      }
    }
    await page.evaluate(() => {
      localStorage.setItem("allona.language", "tr");
      document.documentElement.lang = "tr";
      document.documentElement.dir = "ltr";
      document.body.dataset.theme = "ocean";
      document.dispatchEvent(new CustomEvent("allona:language-changed"));
      document.querySelector("[data-cv-scroll]").scrollTop = 0;
    });
    if (process.env.MARITIME_CV_SCREENSHOT_PREFIX) await page.screenshot({ path: `${process.env.MARITIME_CV_SCREENSHOT_PREFIX}-${width}.png` });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("[data-cv-dialog]").evaluate(el => el.open), false);
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("maritime-cv-open")), false);
    await page.evaluate(() => document.dispatchEvent(new CustomEvent("allona:language-changed")));
    assert.equal(await page.locator("[data-cv-dialog]").evaluate(el => el.open), false, "Escape must not leave a stale preview-open state");
    await page.locator("[data-open-cv]").click();
    await page.locator("[data-cv-scroll]").focus();
    await page.keyboard.press("PageDown");
    await page.waitForFunction(() => document.querySelector("[data-cv-scroll]").scrollTop > 0);
    await page.waitForTimeout(500);
    await page.locator("[data-cv-scroll]").evaluate(el => { el.scrollTop = 400; });
    console.log(`${width}px: 9 languages x 7 themes, no clipping, readable text, stable scroll, keyboard/Escape passed`);
    if (process.env.MARITIME_CV_VISUAL_ONLY) { await page.close(); continue; }
    const download = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
    await page.locator("[data-print-cv]").click();
    const result = await Promise.race([download, page.waitForFunction(() => window.__pdfError).then(() => null)]);
    const diagnostics = await page.evaluate(() => ({ error: window.__pdfError, renderError: window.__renderError, authorized: window.__authorized, notice: document.querySelector("[data-smart-notice]")?.textContent }));
    console.log(JSON.stringify({ width, downloaded: Boolean(result), ...diagnostics }));
    assert.ok(result, JSON.stringify(diagnostics));
    const capture = await page.evaluate(() => ({ observations: window.__captureObservations, cloneWidth: window.__cloneWidth, size: window.__canvasSize, scroll: document.querySelector("[data-cv-scroll]").scrollTop }));
    assert.ok(capture.observations.length > 0);
    assert.ok(capture.observations.every(row => row.stable && row.scrollStable && !row.liveCaptureClass), JSON.stringify(capture));
    assert.equal(capture.cloneWidth, 960);
    assert.equal(capture.size.width, 2160);
    assert.equal(capture.scroll, 400, "PDF download must not reset the reading position");
    const path = `/tmp/allonahub-global-cv-${width}.pdf`;
    await result.saveAs(path);
    assert.ok((await readFile(path)).subarray(0, 5).equals(Buffer.from("%PDF-")));
    for (const mode of ["network", "payment"]) {
      failure = mode;
      await page.evaluate(() => { window.__pdfError = null; });
      await page.locator("[data-print-cv]").click();
      await page.waitForFunction(() => window.__pdfError);
      const notice = page.locator("[data-pdf-notice]");
      assert.ok(await notice.isVisible());
      assert.match(await notice.textContent(), mode === "network" ? /İndirme servisine ulaşılamadı/ : /ödeme bağlantısı henüz etkin değil/);
      assert.doesNotMatch(await notice.textContent(), /Bilgilerinizi.*kontrol/);
      assert.equal(downloadCount, 1, "No download without server authorization");
      assert.equal(await page.locator("[data-cv-scroll]").evaluate(el => el.scrollTop), 400, "PDF errors must not reset the reading position");
      assert.ok((await notice.boundingBox()).y < 900, "Error remains in view without scrolling");
      console.log(`${width}px ${mode}: correct error visible inside CV dialog`);
    }
    await page.close();
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
