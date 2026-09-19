import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright/index.mjs";

const target = process.env.MARSOH_TEST_URL || "http://127.0.0.1:4182/pages/ecosystem/maritime-marsoh.html";
const moduleTarget = process.env.MARSOH_MODULE_TEST_URL || "http://127.0.0.1:4182/pages/ecosystem/allonadenizcilik.html";
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const widths = [320, 390, 768, 1440];

try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width <= 390 ? 740 : 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({
      contentType: "application/javascript",
      body: `window.supabase={createClient:function(){return {auth:{getSession:async()=>({data:{session:{access_token:"test-token",expires_at:9999999999,user:{id:"11111111-1111-4111-8111-111111111111"}}}}),getUser:async()=>({data:{user:{id:"11111111-1111-4111-8111-111111111111"}},error:null})},channel:function(){return {on:function(){return this},subscribe:function(callback){if(callback)callback("SUBSCRIBED");return this}}},removeChannel:function(){},from:function(){return {select:function(){return this},eq:function(){return this},maybeSingle:async()=>({data:null,error:null})}}}}};`
    }));
    await page.route("**/v1/maritime/marsoh/**", async (route) => {
      const url = route.request().url();
      let body = { ok: true };
      if (url.includes("/translate")) body = { ok: true, translated_text: "How does today's weather affect the route?", target_language: "en", automatic: true, cached: false };
      else if (url.includes("/reactions")) body = { ok: true, active: true, count: 1 };
      else if (url.includes("/bootstrap")) body = {
        ok: true,
        user: { id: "11111111-1111-4111-8111-111111111111", display_name: "Denizci", badge: "verified_seafarer", country_code: "TR" },
        channels: [
          { id: "21111111-1111-4111-8111-111111111111", slug: "world", channel_type: "world", country_code: null, name_i18n: { tr: "Dünya Genel", az: "Dünya söhbəti", en: "World Chat" }, pinned_notice_i18n: { tr: "İletişim bilgisi ve iş ilanı paylaşmayın.", az: "Əlaqə məlumatı və iş elanı paylaşmayın.", en: "Do not share contact details or job ads." }, unread_count: 2, notification_preference: "all" },
          { id: "31111111-1111-4111-8111-111111111111", slug: "country-tr", channel_type: "country", country_code: "TR", name_i18n: { tr: "Türkiye Odası", az: "Türkiyə otağı", en: "Türkiye Room" }, pinned_notice_i18n: { tr: "Saygılı ve güvenli konuşun.", az: "Hörmətli danışın.", en: "Keep it respectful." }, unread_count: 0, notification_preference: "mentions" }
        ],
        topic: { title_i18n: { tr: "Bugünün deniz konusu", az: "Günün dəniz mövzusu", en: "Today's sea topic" }, body_i18n: { tr: "Vardiyada en iyi ekip alışkanlığı nedir?", az: "Növbədə ən yaxşı ekip vərdişi nədir?", en: "What is the best watchkeeping habit?" } },
        blocked_user_ids: [],
        policy: { max_message_chars: 2000, text_only: true, sent_notice: "Gönderildi bilgisi teslim veya okunma garantisi değildir." }
      };
      else if (/\/channels\/[^/]+\/messages/.test(url)) body = {
        ok: true,
        next_cursor: null,
        messages: [
          { id: "41111111-1111-4111-8111-111111111111", channel_id: "21111111-1111-4111-8111-111111111111", sender: { id: "51111111-1111-4111-8111-111111111111", display_name: "A. Denizci", badge: "verified_seafarer", country_code: "AZ" }, body: "Bugünkü hava marşruta necə təsir edir?", language: "az", time: "2026-09-16T08:00:00.000Z", own: false },
          { id: "61111111-1111-4111-8111-111111111111", channel_id: "21111111-1111-4111-8111-111111111111", sender: { id: "11111111-1111-4111-8111-111111111111", display_name: "Denizci", badge: "verified_seafarer", country_code: "TR" }, body: "Vardiya planını önceden paylaşmak yardımcı oluyor.", language: "tr", time: "2026-09-16T08:01:00.000Z", own: true }
        ]
      };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto(target, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-marsoh-conversation]:not([hidden])");

    const layout = await page.evaluate(() => {
      const composer = document.querySelector("[data-marsoh-composer]").getBoundingClientRect();
      const header = document.querySelector(".marsoh-topbar").getBoundingClientRect();
      return {
        viewport: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        composerLeft: composer.left,
        composerRight: composer.right,
        composerBottom: composer.bottom,
        viewportHeight: window.innerHeight,
        headerBottom: header.bottom,
        conversationTop: document.querySelector("[data-marsoh-conversation]").getBoundingClientRect().top,
        hiddenUploadControls: document.querySelectorAll('input[type="file"], [data-attachment], [data-camera], [data-audio]').length,
        sendLabel: document.querySelector("[data-marsoh-send]").getAttribute("aria-label"),
        reducedAnimation: getComputedStyle(document.querySelector(".marsoh-product-icon"), "::after").animationName
        ,shell: document.querySelector("[data-marsoh-shell]").getBoundingClientRect().toJSON()
        ,conversation: document.querySelector("[data-marsoh-conversation]").getBoundingClientRect().toJSON()
        ,composerArea: document.querySelector(".marsoh-composer-area").getBoundingClientRect().toJSON()
        ,composerWidthStyle: getComputedStyle(document.querySelector("[data-marsoh-composer]")).width
      };
    });
    process.stdout.write(`MarSoh ${width}px ölçüm: ${JSON.stringify(layout)}\n`);
    assert.ok(layout.scrollWidth <= layout.viewport + 1, `${width}px görünümünde yatay taşma var`);
    assert.ok(layout.composerLeft >= 0 && layout.composerRight <= layout.viewport + 1, `${width}px composer taşması`);
    assert.ok(layout.composerBottom <= layout.viewportHeight + 1, `${width}px composer ekran dışı`);
    assert.ok(layout.conversationTop >= layout.headerBottom - 1, `${width}px üst bölüm çakışması`);
    assert.equal(layout.hiddenUploadControls, 0);
    assert.ok(layout.sendLabel);
    assert.equal(layout.reducedAnimation, "none");

    const translate = page.locator(".marsoh-message:not(.is-own) .marsoh-translate");
    assert.equal(await translate.count(), 1, `${width}px çeviri düğmesi görünmüyor`);
    await translate.click();
    await page.locator('.marsoh-translation-languages button[lang="en"]').click();
    assert.match(await page.locator(".marsoh-translation").textContent(), /How does today's weather affect the route\?/);

    await page.locator(".marsoh-message:not(.is-own) .marsoh-bubble").click();
    assert.equal(await page.locator(".marsoh-quick-reactions:not([hidden]) button").count(), 12, `${width}px hızlı tepki listesi eksik`);
    await page.locator('.marsoh-quick-reactions:not([hidden]) button[aria-label*="🧭"]').click();
    assert.match(await page.locator(".marsoh-message:not(.is-own) .marsoh-reactions").textContent(), /🧭\s*1/);

    await page.locator("[data-marsoh-emoji]").click();
    assert.ok(await page.locator("[data-marsoh-emoji-grid] button").count() >= 48, `${width}px emoji seçici eksik`);
    await page.locator('[data-marsoh-emoji-grid] button[aria-label*="🚢"]').click();
    assert.match(await page.locator("[data-marsoh-input]").inputValue(), /🚢/);
    assert.match(await page.locator("[data-marsoh-character-count]").textContent(), /\/ 2000/);

    await page.selectOption("[data-marsoh-language]", "ar");
    assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${width}px Arapça görünümünde taşma var`);
    await page.selectOption("[data-marsoh-language]", "tr");
    const restoredLtr = await page.evaluate(() => {
      const brand = document.querySelector(".marsoh-brand").getBoundingClientRect();
      const product = document.querySelector(".marsoh-product-mark").getBoundingClientRect();
      return { dir: document.documentElement.dir, scrollX: window.scrollX, brandLeft: brand.left, brandRight: brand.right, productLeft: product.left, productRight: product.right };
    });
    assert.equal(restoredLtr.dir, "ltr");
    assert.equal(restoredLtr.scrollX, 0);
    assert.ok(restoredLtr.brandLeft >= -1 && restoredLtr.brandRight <= width + 1, `${width}px dil dönüşünde logo taştı`);
    if (width > 760) assert.ok(restoredLtr.productLeft >= -1 && restoredLtr.productRight <= width + 1, `${width}px dil dönüşünde oda paneli taştı`);

    const lightThemeContrast = await page.evaluate(() => {
      document.body.dataset.theme = "white";
      const node = document.querySelector(".marsoh-message:not(.is-own) .marsoh-bubble");
      const style = getComputedStyle(node);
      const rgb = (value) => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const luminance = (value) => {
        const channels = rgb(value).map((channel) => {
          const part = channel / 255;
          return part <= .03928 ? part / 12.92 : ((part + .055) / 1.055) ** 2.4;
        });
        return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
      };
      const foreground = luminance(style.color);
      const background = luminance(style.backgroundColor);
      document.body.dataset.theme = "ocean";
      return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
    });
    assert.ok(lightThemeContrast >= 4.5, `${width}px açık tema mesaj kontrastı yetersiz: ${lightThemeContrast}`);

    if (process.env.MARSOH_SCREENSHOT_DIR && [390, 1440].includes(width)) {
      await mkdir(process.env.MARSOH_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: `${process.env.MARSOH_SCREENSHOT_DIR}/marsoh-${width}.png`, fullPage: false });
    }

    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.matches("a,button,textarea,select"));
    assert.equal(focused, true, `${width}px klavye odağı etkileşimli öğeye gelmedi`);

    if (width <= 1120) {
      await page.locator("[data-marsoh-open-info]").click();
      const info = await page.locator("[data-marsoh-info]").boundingBox();
      assert.ok(info && info.x >= -1 && info.x + info.width <= width + 1, `${width}px güvenlik kuralları paneli görünür alana açılmadı`);
      await page.locator("[data-marsoh-close-info]").click();
    } else {
      await expectVisibleBox(page, "[data-marsoh-info]", width, "masaüstü güvenlik paneli");
    }
    await context.close();
    process.stdout.write(`MarSoh responsive ${width}px: OK\n`);
  }

  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width <= 390 ? 740 : 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({
      contentType: "application/javascript",
      body: `window.supabase={createClient:function(){return {auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null},error:null}),onAuthStateChange:function(){return {data:{subscription:{unsubscribe:function(){}}}}}},from:function(){return {select:function(){return this},eq:function(){return this},maybeSingle:async()=>({data:null,error:null})}}}}};`
    }));
    await page.route("**/v1/**", (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false }) }));
    await page.goto(moduleTarget, { waitUntil: "networkidle" });
    await page.waitForSelector(".marsoh-entry");
    const layout = await page.evaluate(() => {
      const entry = document.querySelector(".marsoh-entry");
      const rect = entry.getBoundingClientRect();
      return {
        viewport: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        left: rect.left,
        right: rect.right,
        height: rect.height,
        label: entry.getAttribute("aria-label"),
        href: entry.getAttribute("href"),
        title: entry.querySelector("strong")?.textContent,
        animation: getComputedStyle(entry.querySelector(".marsoh-entry__icon"), "::after").animationName
      };
    });
    process.stdout.write(`MarSoh giriş kartı ${width}px ölçüm: ${JSON.stringify(layout)}\n`);
    assert.ok(layout.scrollWidth <= layout.viewport + 1, `${width}px modül görünümünde yatay taşma var`);
    assert.ok(layout.left >= 0 && layout.right <= layout.viewport + 1, `${width}px MarSoh giriş kartı taşması`);
    assert.ok(layout.height >= 48, `${width}px MarSoh dokunma hedefi yetersiz`);
    assert.equal(layout.label, "MarSoh sohbet alanını aç");
    assert.ok(["/maritime/marsoh", "/pages/ecosystem/maritime-marsoh.html"].includes(layout.href));
    assert.equal(layout.title, "MarSoh");
    assert.equal(layout.animation, "none");
    await entryFocusCheck(page, width);
    await context.close();
    process.stdout.write(`MarSoh giriş kartı responsive ${width}px: OK\n`);
  }
} finally {
  await browser.close();
}

async function entryFocusCheck(page, width) {
  await page.locator(".marsoh-entry").focus();
  const focused = await page.evaluate(() => document.activeElement?.classList.contains("marsoh-entry"));
  assert.equal(focused, true, `${width}px MarSoh giriş kartı klavye odağı alamadı`);
}

async function expectVisibleBox(page, selector, width, label) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box && box.x >= -1 && box.x + box.width <= width + 1, `${width}px ${label} görünür değil`);
}
