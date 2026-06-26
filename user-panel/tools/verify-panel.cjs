const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
  const title = await page.title();
  const h1 = await page.locator("h1").textContent();
  const visibleSections = await page.locator(".panel-section.is-visible").count();

  await page.getByRole("button", { name: "Profil", exact: true }).click();
  await page.locator('input[name="name"]').fill("Allona Hub Test");
  await page.getByRole("button", { name: "Profili kaydet" }).click();

  await page.getByRole("button", { name: "Destek", exact: true }).click();
  await page.locator('input[name="subject"]').fill("Playwright test talebi");
  await page.locator('textarea[name="message"]').fill("Panel form davranisi test edildi.");
  await page.getByRole("button", { name: "Talep olustur" }).click();
  const ticketText = await page.locator("#ticketList").innerText();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Menuyu ac veya kapat").click();
  const navOpen = await page.evaluate(() => document.body.classList.contains("nav-open"));
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );

  await browser.close();

  console.log(
    JSON.stringify(
      {
        title,
        h1,
        visibleSections,
        ticketCreated: ticketText.includes("Playwright test talebi"),
        navOpen,
        overflow,
        errors,
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
