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
  for (const width of [390, 1440]) {
    let failure = "";
    let downloadCount = 0;
    const page = await browser.newPage({ viewport: { width, height: 900 }, acceptDownloads: true });
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
        cv_draft: { holder_name: "Deniz Test", given_names: "Deniz", family_name: "Test", nationality: "Türkiye", date_of_birth: "1995-01-01", headline: "Oiler", certificates: [],
          contact: { email: "example@example.invalid" }, sea_service: Array.from({ length: 12 }, (_, i) => ({ vessel_name: `Example ${i + 1}`, rank: "Oiler", company_name: "Example Company", sign_on_date: "2024-01-01", sign_off_date: "2024-06-01" })) }
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
      window.html2canvas = async (...args) => { try { return await render(...args); } catch (e) { window.__renderError = e.stack; throw e; } };
      document.dispatchEvent(new CustomEvent("allona:maritime-smart-account-ready", { detail: { session: { access_token: "test-only" } } }));
    });
    await page.locator("[data-open-cv]").click();
    const download = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
    await page.locator("[data-print-cv]").click();
    const result = await Promise.race([download, page.waitForFunction(() => window.__pdfError).then(() => null)]);
    const diagnostics = await page.evaluate(() => ({ error: window.__pdfError, renderError: window.__renderError, authorized: window.__authorized, notice: document.querySelector("[data-smart-notice]")?.textContent }));
    console.log(JSON.stringify({ width, downloaded: Boolean(result), ...diagnostics }));
    assert.ok(result, JSON.stringify(diagnostics));
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
      console.log(`${width}px ${mode}: correct error visible inside CV dialog`);
    }
    await page.close();
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
