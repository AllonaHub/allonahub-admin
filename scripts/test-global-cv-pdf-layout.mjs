import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright/index.mjs";

const source = await readFile(new URL("../js/allona-maritime-smart-account.js", import.meta.url), "utf8");
const renderer = source.slice(source.indexOf("function globalCvBreakpoints("), source.indexOf("async function printCv("));
assert.ok(renderer.includes("function addGlobalCvPages"));
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });

try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  await page.goto("http://127.0.0.1:4191/");
  await page.addScriptTag({ url: "http://127.0.0.1:4191/js/vendor/html2canvas-1.4.1.min.js" });
  await page.addScriptTag({ url: "http://127.0.0.1:4191/js/vendor/jspdf-2.5.1.umd.min.js" });
  await page.addScriptTag({ content: renderer });
  const result = await page.evaluate(async () => {
    const layout = document.createElement("main");
    layout.className = "maritime-cv-layout";
    layout.style.cssText = "width:960px;background:white;color:#102735;font:15px Arial;";
    for (let index = 0; index < 12; index += 1) {
      const section = document.createElement("section");
      section.className = "maritime-cv-v4-section";
      section.style.cssText = "height:230px;padding:10px;border-bottom:1px solid #ccc;box-sizing:border-box;";
      section.innerHTML = `<h3>Bölüm ${index + 1}</h3><p>${"Deniz hizmeti ve sertifika kaydı. ".repeat(10)}</p>`;
      layout.append(section);
    }
    document.body.append(layout);
    const scale = 1.5;
    const breaks = globalCvBreakpoints(layout, scale);
    const canvas = await html2canvas(layout, { scale, backgroundColor: "#ffffff" });
    const pdf = new jspdf.jsPDF("p", "mm", "a4", true);
    addGlobalCvPages(pdf, canvas, breaks);
    return { pages: pdf.getNumberOfPages(), breaks, bytes: pdf.output("arraybuffer").byteLength };
  });
  assert.ok(result.pages >= 2 && result.pages <= 3, JSON.stringify(result));
  assert.equal(result.breaks.length, 11, JSON.stringify(result));
  assert.ok(result.bytes > 10_000, JSON.stringify(result));
  console.log(`Global CV PDF: ${result.pages} A4 pages, ${result.bytes} bytes`);
} finally {
  await browser.close();
}
