import assert from "node:assert/strict";
import { chromium } from "/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright/index.mjs";

const target = process.env.SUPER_ADMIN_TEST_URL || "http://127.0.0.1:4190/admin/super-admin.html";
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const widths = [320, 390, 768, 1440];
const userId = "11111111-1111-4111-8111-111111111111";
const worldId = "22222222-2222-4222-8222-222222222222";
const trId = "33333333-3333-4333-8333-333333333333";
const messageId = "44444444-4444-4444-8444-444444444444";

try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ contentType: "application/javascript", body: "window.supabase={};" }));
    await page.route("**/js/supabase-client.js*", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
    await page.route("**/js/auth.js*", (route) => route.fulfill({
      contentType: "application/javascript",
      body: `window.Allona=window.Allona||{};window.Allona.auth={requireRole:async()=>({user:{id:"${userId}"},profile:{role:"super_admin"}}),mfaStatus:async()=>({authenticated:true,mfaVerified:true}),getSession:async()=>({access_token:"test-token"}),signOut:async()=>{}};`
    }));
    await page.route("**/v1/**", async (route) => {
      const url = route.request().url();
      let body = { ok: true };
      if (url.includes("/owner-session")) body = { ok: true, owner: { user_id: userId, email: "owner@example.test", role: "super_admin" } };
      else if (url.includes("/command-center")) body = { ok: true, metrics: {}, alerts: [], approvals: [], control_links: [], system_health: {} };
      else if (url.includes("/admin/marsoh/moderation")) body = { ok: true, queue: [], reports: [], sanctions: [] };
      else if (url.includes("/admin/marsoh/management")) body = {
        ok: true,
        channels: [
          { id: worldId, slug: "world", channel_type: "world", country_code: null, status: "active", slow_mode_seconds: 3, name_i18n: { tr: "Dünya Genel", az: "Dünya söhbəti", en: "World Chat" }, pinned_notice_i18n: { tr: "Kişisel iletişim bilgisi paylaşmayın.", az: "Şəxsi əlaqə məlumatı paylaşmayın.", en: "Do not share personal contact details." } },
          { id: trId, slug: "country-tr", channel_type: "country", country_code: "TR", status: "active", slow_mode_seconds: 5, name_i18n: { tr: "TÃ¼rkiye OdasÄ±", az: "TÃ¼rkiyÉ™ otaÄŸÄ±", en: "Türkiye Room" }, pinned_notice_i18n: { tr: "SaygÄ±lÄ±, gÃ¼venli ve denizcilik odaklÄ± sohbet edin.", az: "Hörmətli, təhlükəsiz və dənizçilik yönümlü söhbət edin.", en: "Keep the conversation respectful, safe, and maritime-focused." } }
        ],
        topics: [{ id: "55555555-5555-4555-8555-555555555555", topic_date: "2026-09-20", status: "active", title_i18n: { tr: "Bugünün deniz konusu", az: "Günün dəniz mövzusu", en: "Today's sea topic" }, body_i18n: { tr: "Uzun vardiyalarda ekip içi iletişimi güçlendiren en iyi alışkanlık nedir?", az: "Uzun növbələrdə ekip ünsiyyətini gücləndirən ən yaxşı vərdiş nədir?", en: "Which habit best strengthens crew communication during long watches?" } }],
        messages: [{ message_id: messageId, channel_id: worldId, sender_user_id: userId, actor_type: "seafarer", body: "Denizde güvenlik her vardiyada ortak sorumluluktur.", language: "tr", sender_display_name: "Denizci AL-50001", published_at: "2026-09-20T12:00:00.000Z" }],
        audit: [{ id: "66666666-6666-4666-8666-666666666666", actor_user_id: userId, action: "marsoh.management.topic_updated", resource_type: "marsoh_topic_card", resource_id: null, created_at: "2026-09-20T12:05:00.000Z" }],
        next_cursor: null
      };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });

    await page.goto(target, { waitUntil: "networkidle" });
    await page.locator('[data-view-target="marsoh-moderation"]').click();
    await page.waitForSelector("[data-marsoh-topic-form]");
    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      navLabel: document.querySelector('[data-view-target="marsoh-moderation"]')?.textContent.trim(),
      topicForm: Boolean(document.querySelector("[data-marsoh-topic-form]")),
      announcementForm: Boolean(document.querySelector("[data-marsoh-announcement-form]")),
      channelForms: document.querySelectorAll("[data-marsoh-channel-form]").length,
      deleteControls: document.querySelectorAll('[data-marsoh-admin-action="rejected"]').length,
      bulkControl: Boolean(document.querySelector("[data-marsoh-bulk-remove]")),
      turkishSourceFields: document.querySelectorAll('[data-marsoh-topic-form] [name$="_tr"]').length,
      editableForeignFields: document.querySelectorAll('[data-marsoh-topic-form] [name$="_az"], [data-marsoh-topic-form] [name$="_en"], [data-marsoh-topic-form] [name$="_de"]').length,
      translationPreviews: document.querySelectorAll('[data-marsoh-topic-form] .sa-marsoh-translation-preview').length,
      turkeyLabel: [...document.querySelectorAll("[data-marsoh-channel-form] header strong")].find((element) => element.textContent.includes("Türkiye"))?.textContent,
      turkeySource: [...document.querySelectorAll('[data-marsoh-channel-form] [name="name_tr"]')].find((element) => element.value.includes("Türkiye"))?.value
    }));
    assert.equal(layout.scrollWidth, layout.viewport, `${width}px yatay taşma var`);
    assert.equal(layout.navLabel, "MarSoh");
    assert.equal(layout.topicForm, true);
    assert.equal(layout.announcementForm, true);
    assert.equal(layout.channelForms, 2);
    assert.ok(layout.deleteControls >= 1);
    assert.equal(layout.bulkControl, true);
    assert.equal(layout.turkishSourceFields, 2);
    assert.equal(layout.editableForeignFields, 0);
    assert.equal(layout.translationPreviews, 16);
    assert.equal(layout.turkeyLabel, "Türkiye Odası");
    assert.equal(layout.turkeySource, "Türkiye Odası");
    console.log(`Super Admin MarSoh responsive ${width}px: OK`);
    await context.close();
  }
} finally {
  await browser.close();
}
