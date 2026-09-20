import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = process.env.AUTH_THEME_OUTPUT || "/tmp/allonahub-auth-theme-audit";
await mkdir(output, { recursive: true });
const mime = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".jpg": "image/jpeg" };
const server = createServer(async (request, response) => {
  const path = resolve(root, "." + decodeURIComponent(new URL(request.url, "http://localhost").pathname));
  if (!path.startsWith(root + "/")) { response.writeHead(403).end(); return; }
  try { response.setHeader("Content-Type", mime[extname(path)] || "application/octet-stream"); response.end(await readFile(path)); }
  catch { response.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const base = process.env.AUTH_THEME_BASE || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const report = { cases: [], failures: [], errors: [] };

// Resolve CSS colors (including color-mix) through canvas, then composite them.
function audit() {
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const rgba = value => {
    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    return [data[0], data[1], data[2], data[3] / 255];
  };
  const over = (front, back) => front.slice(0, 3).map((v, i) => v * front[3] + back[i] * (1 - front[3])).concat(1);
  const luminance = color => color.slice(0, 3).map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
  const contrast = (a, b) => { const l = [luminance(a), luminance(b)].sort((x, y) => y - x); return (l[0] + .05) / (l[1] + .05); };
  const layers = value => {
    let depth = 0, start = 0;
    const parts = [];
    for (let i = 0; i < value.length; i++) {
      if (value[i] === "(") depth++;
      if (value[i] === ")") depth--;
      if (value[i] === "," && !depth) { parts.push(value.slice(start, i)); start = i + 1; }
    }
    return parts.concat(value.slice(start));
  };
  const backgrounds = element => {
    if (!element) return [[255, 255, 255, 1]];
    const s = getComputedStyle(element);
    const own = rgba(s.backgroundColor);
    const gradients = layers(s.backgroundImage).filter(layer => layer.includes("gradient"));
    const bottom = gradients.at(-1)?.match(/(?:rgba?|color)\([^)]+\)|transparent/g)?.map(rgba);
    let colors = own[3] === 1 || bottom?.every(c => c[3] === 1) ? [own] : backgrounds(element.parentElement).map(back => over(own, back));
    for (const layer of gradients.reverse()) {
      const stops = (layer.match(/(?:rgba?|color)\([^)]+\)|transparent/g) || []).map(rgba);
      colors = colors.flatMap(back => stops.map(stop => over(stop, back))).slice(0, 64);
    }
    return colors;
  };
  const results = [];
  const candidates = document.querySelectorAll(".page input, .page select, .page button, .page a, .page h1, .page h2, .page h3, .page p, .page span, .page small, .page label, .page .tab, .page .warning-text, .page .reset-status, .page .auth-feedback, .page strong, .page .country-selected");
  for (const element of candidates) {
    const s = getComputedStyle(element);
    if (!element.getClientRects().length || s.visibility !== "visible" || (s.clip !== "auto" && s.position === "absolute")) continue;
    const isInput = element.matches("input,select");
    const icon = element.classList.contains("password-visibility-toggle");
    const text = isInput ? element.value || element.placeholder : element.textContent.trim();
    if (!text && !icon) continue;
    if (!isInput && !icon && element.children.length && !Array.from(element.childNodes).some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const placeholder = isInput && !element.value && element.placeholder;
    const style = placeholder ? getComputedStyle(element, "::placeholder") : s;
    const foreground = rgba(icon ? style.color : style.webkitTextFillColor || style.color);
    let opacity = Number(s.opacity) * (placeholder ? Number(style.opacity) : 1);
    for (let parent = element.parentElement; parent; parent = parent.parentElement) opacity *= Number(getComputedStyle(parent).opacity);
    foreground[3] *= opacity;
    const bg = backgrounds(element);
    const minimum = Math.min(...bg.map(b => contrast(over(foreground, b), b)));
    const large = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && parseFloat(s.fontWeight) >= 700);
    const threshold = icon || large ? 3 : 4.5;
    const selector = element.id ? `#${element.id}` : `${element.tagName.toLowerCase()}.${Array.from(element.classList).join(".")}`;
    results.push({ selector, text: icon ? "password-eye" : String(text).slice(0, 55), contrast: +minimum.toFixed(2), threshold, color: style.webkitTextFillColor || style.color, background: s.backgroundColor, disabled: element.matches(":disabled"), passes: minimum + .03 >= threshold });
  }
  return { overflow: document.documentElement.scrollWidth > innerWidth + 1, measurements: results };
}

try {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.addInitScript(() => {
    localStorage.setItem("allona.language", "tr");
    localStorage.setItem("allona.theme", "ocean");
  });
  // Never create a login, reset, email or account while testing presentation.
  await context.route("**/auth/v1/**", route => route.fulfill({ status: 401, contentType: "application/json", body: '{"error":"no_test_session"}' }));
  await context.route("https://api.allonahub.com/**", route => route.fulfill({ status: 503, contentType: "application/json", body: '{"ok":false}' }));
  await context.route("**/challenges.cloudflare.com/**", route => route.abort());
  const page = await context.newPage();
  page.on("pageerror", error => report.errors.push(error.message));
  for (const path of ["pages/account/user.html", "pages/account/reset-password.html"]) {
    await page.goto(`${base}/${path}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.Allona?.platform && document.querySelector(".password-visibility-toggle"));
    const rejectCookies = page.getByRole("button", { name: "Reddet", exact: true });
    if (await rejectCookies.isVisible()) await rejectCookies.click();
    for (const width of (process.env.AUTH_THEME_WIDTHS || "320,390,768,1440").split(",").map(Number)) {
      await page.setViewportSize({ width, height: 1000 });
      for (const theme of ["ocean", "white", "sunset", "turquoise"]) {
        if (path.includes("reset-password")) {
          await page.evaluate(theme => window.Allona.platform.setTheme(theme), theme);
        } else {
          await page.locator(".actions .platform-theme-btn").click();
          await page.locator(`.actions [data-theme-option="${theme}"]`).click();
        }
        assert.equal(await page.locator("body").getAttribute("data-theme"), theme);
        await page.waitForTimeout(350);
        const states = path.includes("reset-password") ? ["reset"] : ["login", "register", "forgot"];
        for (const state of states) {
          if (state !== "reset") await page.evaluate(state => window.openTab(state), state);
          if (state === "register") {
            await page.locator("#password1").fill("ThemeCheck2026!");
            await page.locator("#password2").fill("Mismatch2026!");
          }
          const inputs = page.locator(".password-visibility-field input:visible");
          for (let i = 0; i < await inputs.count(); i++) {
            const input = inputs.nth(i);
            await input.fill("ThemeCheck2026!");
            const toggle = input.locator("..").locator("button");
            if (await toggle.getAttribute("aria-pressed") === "true") await toggle.click();
            assert.equal(await input.getAttribute("type"), "password");
            const maskedStyle = await input.evaluate(element => {
              const s = getComputedStyle(element);
              return [s.color, s.webkitTextFillColor, s.backgroundColor];
            });
            assert.ok(await toggle.getAttribute("aria-label"), "eye control needs an accessible label");
            await input.focus();
            await input.press("Tab");
            assert.equal(await toggle.evaluate(element => element === document.activeElement), true);
            assert.equal(await toggle.evaluate(element => getComputedStyle(element).outlineStyle), "solid", "keyboard focus must remain visible");
            await toggle.press("Space");
            assert.equal(await input.getAttribute("type"), "text");
            assert.equal(await input.inputValue(), "ThemeCheck2026!");
            assert.deepEqual(await input.evaluate(element => {
              const s = getComputedStyle(element);
              return [s.color, s.webkitTextFillColor, s.backgroundColor];
            }), maskedStyle, "revealing a password must not change its contrast");
          }
          if (state === "register") await page.locator("#password2").fill("Mismatch2026!");
          // Let color transitions settle before measuring.
          await page.waitForTimeout(350);
          const result = await page.evaluate(audit);
          const entry = { path, state, width, theme, ...result };
          report.cases.push(entry);
          for (const value of result.measurements.filter(v => !v.passes)) report.failures.push({ path, state, width, theme, ...value });
          if (result.overflow) report.failures.push({ path, state, width, theme, overflow: true });
          for (let i = 0; i < await inputs.count(); i++) {
            const input = inputs.nth(i);
            await input.locator("..").locator("button").click();
            assert.equal(await input.getAttribute("type"), "password");
          }
          if ([390, 1440].includes(width)) await page.screenshot({ path: `${output}/${state}-${theme}-${width}.png`, fullPage: true });
          if (state === "login") {
            await page.evaluate(() => {
              document.getElementById("authStatus").hidden = false;
              document.getElementById("authStatus").textContent = "Giriş yapılamadı. Bilgilerinizi kontrol edin.";
              document.getElementById("verificationHelp").hidden = false;
            });
            const feedback = await page.evaluate(audit);
            report.cases.push({ path, state: "verification-feedback", width, theme, ...feedback });
            for (const value of feedback.measurements.filter(v => !v.passes)) report.failures.push({ path, state: "verification-feedback", width, theme, ...value });
            if (feedback.overflow) report.failures.push({ path, state: "verification-feedback", width, theme, overflow: true });
            await page.evaluate(() => {
              document.getElementById("authStatus").hidden = true;
              document.getElementById("verificationHelp").hidden = true;
            });
          }
        }
      }
    }
  }
  await context.close();
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
}
const unique = [...new Map(report.failures.map(f => [`${f.path}:${f.state}:${f.theme}:${f.selector}`, f])).values()];
console.log(JSON.stringify({ cases: report.cases.length, failures: unique, errors: [...new Set(report.errors)], report: `${output}/report.json` }, null, 2));
if (report.failures.length || report.errors.length) process.exitCode = 1;
