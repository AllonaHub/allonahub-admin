const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright-core");

const root = path.resolve(__dirname, "..");
const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function assert(value, message) {
  if (!value) throw new Error(message);
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url, "http://allonahub.test").pathname);
      const requested = pathname === "/" ? "/avm-dunyasi.html" : pathname;
      const file = path.resolve(root, `.${requested}`);
      if (!file.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      fs.readFile(file, (error, data) => {
        if (error) {
          response.writeHead(404).end("Not found");
          return;
        }
        response.writeHead(200, { "content-type": mime[path.extname(file)] || "application/octet-stream" });
        response.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const supabaseMock = `
(() => {
  const now = Date.now();
  const center = { id: "11111111-1111-4111-8111-111111111111", name: "Test AVM", city: "İstanbul", district: "Şişli", address: "Test adresi", phone: "+902120000000", website_url: "https://allonahub.com", hero_image_url: null, status: "active" };
  const profile = { id: "33333333-3333-4333-8333-333333333333", full_name: "AVM Test Admin", role: "admin" };
  const sponsor = { id: "22222222-2222-4222-8222-222222222222", public_id: "sponsor-test", title: "Onaylı Yaz Kampanyası", slot_type: "sponsored_listing", placement: "Mağaza rehberi", description: "Ziyaretçilere özel doğrulanmış sponsor kampanyası.", creative_image_url: "https://cdn.example/sponsor.webp", creative_image_alt: "Onaylı marka yaz kampanyası görseli", cta_label: "Kampanyayı İncele", cta_url: "https://brand.example/campaign", starts_at: new Date(now - 3600000).toISOString(), ends_at: new Date(now + 86400000).toISOString(), display_order: 1, status: "active" };
  const floorMap = { id: "66666666-6666-4666-8666-666666666666", public_id: "ground-floor", title: "Zemin Kat", floor_label: "Zemin Kat", image_url: "https://cdn.example/ground-floor.webp", image_alt: "Test AVM zemin kat planı", native_width_px: 1200, native_height_px: 800, storage_bucket: "mall-assets", storage_path: "test/ground-floor.webp", display_order: 1, status: "active" };
  const floorZone = { id: "77777777-7777-4777-8777-777777777777", floor_map_id: floorMap.id, public_id: "ground-north", title: "Kuzey Mağaza Koridoru", floor_label: "Zemin Kat", zone_type: "stores", route_hint: "Ana girişten kuzeye ilerleyin", management_metric: "Mağaza yönlendirmesi", description: "Doğrulanmış test koordinatı", map_x_percent: 12, map_y_percent: 30, map_width_percent: 28, map_height_px: 64, display_order: 1, status: "active" };
  const incompleteFloorZone = { ...floorZone, id: "88888888-8888-4888-8888-888888888888", public_id: "coordinate-pending", title: "Koordinat Bekleyen Bölge", map_x_percent: null, display_order: 2 };
  const sponsorSubmission = { id: "44444444-4444-4444-8444-444444444444", mall_id: center.id, submitted_by: profile.id, module_key: "mall", request_type: "advertising", brand_name: "Partner Test Marka", submission_title: "Sponsorlu Yaz Yerleşimi", submission_summary: "Yayındaki sponsor testi", requested_visibility: "sponsored", visibility_status: "published", status: "approved", published_item_id: null, published_ad_slot_id: sponsor.id, created_at: new Date(now - 3600000).toISOString() };
  window.__supabaseWrites = [];
  window.__rpcCalls = [];
  const resultFor = (table, single) => {
    if (table === "mall_centers") return { data: single ? center : [center], error: null, count: 1 };
    if (table === "profiles") return { data: single ? profile : [profile], error: null, count: 1 };
    if (table === "mall_ad_slots") return { data: single ? sponsor : [sponsor], error: null, count: 1 };
    if (table === "mall_floor_maps") return { data: single ? floorMap : [floorMap], error: null, count: 1 };
    if (table === "mall_floor_zones") return { data: single ? floorZone : [floorZone, incompleteFloorZone], error: null, count: 2 };
    if (table === "mall_partner_submissions") return { data: single ? sponsorSubmission : [sponsorSubmission], error: null, count: 1 };
    return { data: single ? null : [], error: null, count: 0 };
  };
  const query = (table) => {
    const api = {};
    ["select", "eq", "neq", "lte", "gte", "gt", "lt", "in", "is", "or", "order", "range", "limit"].forEach((name) => {
      api[name] = () => api;
    });
    ["insert", "update", "upsert", "delete"].forEach((name) => {
      api[name] = (payload) => {
        window.__supabaseWrites.push({ table, operation: name, payload });
        return api;
      };
    });
    api.maybeSingle = () => Promise.resolve(resultFor(table, true));
    api.single = () => Promise.resolve(resultFor(table, true));
    api.then = (resolve, reject) => Promise.resolve(resultFor(table, false)).then(resolve, reject);
    return api;
  };
  window.supabase = {
    createClient: () => ({
      auth: {
        getSession: async () => ({ data: { session: { user: { id: profile.id } } } }),
        getUser: async () => ({ data: { user: { id: profile.id, email: "partner@example.com", user_metadata: { full_name: profile.full_name } } } })
      },
      from: query,
      rpc: async (name, args = {}) => {
        window.__rpcCalls.push({ name, args });
        if (name === "get_mall_partner_submission_summary") return { data: [{ total_count: 1, approved_count: 1, published_count: 1, advertising_count: 1 }], error: null };
        if (name === "get_mall_ad_slot_interaction_summary") return { data: [{ ad_slot_id: sponsor.id, impression_count: 120, click_count: 9, click_rate: 7.5, recent_impression_count: 80, recent_click_count: 6 }], error: null };
        if (name === "get_mall_ad_slot_interaction_report") return { data: [{
          interaction_id: "55555555-5555-4555-8555-555555555555",
          ad_slot_id: sponsor.id,
          ad_slot_public_id: sponsor.public_id,
          interaction_type: args.report_interaction_type || "impression",
          source_page: "avm-dunyasi",
          interaction_date: "2026-07-11",
          created_at: new Date(now - 1800000).toISOString(),
          slot_title: sponsor.title,
          slot_type: sponsor.slot_type,
          placement: sponsor.placement,
          total_count: 60,
          impression_count: args.report_interaction_type === "click" ? 0 : 51,
          click_count: args.report_interaction_type === "impression" ? 0 : 9
        }], error: null };
        return { data: [], error: null };
      }
    })
  };
})();
`;

async function run() {
  const sponsorId = "22222222-2222-4222-8222-222222222222";
  const server = await startServer();
  const address = server.address();
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--host-resolver-rules=MAP allonahub.test 127.0.0.1"]
  });
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(`console: ${message.text()}`);
      });
      page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
      await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: supabaseMock }));
      await page.route("https://api.allonahub.com/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"base":"TRY","rates":{"TRY":1}}' }));
      await page.route("https://cdn.example/**", (route) => route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="100%" height="100%" fill="#d9ebe5"/></svg>'
      }));
      await page.route("https://images.unsplash.com/**", (route) => route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="100%" height="100%" fill="#eef7fa"/></svg>'
      }));
      await page.goto(`http://allonahub.test:${address.port}/avm-dunyasi.html`, { waitUntil: "networkidle" });
      await page.locator("[data-avm-sponsored]:not([hidden])").waitFor();
      await page.locator("[data-avm-floor-map-select]").waitFor();
      assert(await page.locator("[data-avm-floor-map-select]").count() === 1, "Kat planı sekmesi tek ve geçerli kapanış etiketiyle render edilmedi.");
      assert(await page.locator("[data-avm-zone]").count() === 1, "Eksik koordinatlı bölge sentetik konumla ziyaretçiye açıldı.");
      const zoneStyle = await page.locator('[data-avm-zone="ground-north"]').getAttribute("style");
      assert(zoneStyle.includes("left:12%") && zoneStyle.includes("top:30%") && zoneStyle.includes("width:28%"), "Ziyaretçi kat planı gerçek koordinatları kullanmadı.");
      assert(await page.locator("[data-avm-sponsored-card]").count() === 1, "Tek onaylı sponsor kartı görünmeliydi.");
      assert(await page.locator("[data-avm-sponsored-card] img").getAttribute("alt") === "Onaylı marka yaz kampanyası görseli", "Sponsor alt metni korunmadı.");
      const rel = await page.locator("[data-avm-sponsored-card] a").getAttribute("rel");
      assert(rel && rel.split(/\s+/).includes("sponsored") && rel.split(/\s+/).includes("noopener"), "Sponsor bağlantısı rel sözleşmesini taşımıyor.");
      await page.locator("[data-avm-sponsored-card]").scrollIntoViewIfNeeded();
      await page.waitForFunction(() => window.__supabaseWrites.some((write) => write.table === "mall_ad_slot_interactions" && write.payload.interaction_type === "impression"));
      await page.evaluate(() => {
        const link = document.querySelector("[data-avm-sponsored-cta]");
        link.addEventListener("click", (event) => event.preventDefault(), { once: true });
        link.click();
      });
      await page.waitForFunction(() => window.__supabaseWrites.some((write) => write.table === "mall_ad_slot_interactions" && write.payload.interaction_type === "click"));
      const sponsorWrites = await page.evaluate(() => window.__supabaseWrites.filter((write) => write.table === "mall_ad_slot_interactions"));
      assert(sponsorWrites.every((write) => write.payload.ad_slot_id === "22222222-2222-4222-8222-222222222222"), "Sponsor ölçümü doğru reklam hedefine bağlanmadı.");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert(overflow <= 1, `${viewport.width}px görünümünde ${overflow}px yatay taşma var.`);
      assert(errors.length === 0, errors.join("\n"));
      await page.close();
    }

    const admin = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const adminErrors = [];
    admin.on("console", (message) => {
      if (message.type() === "error") adminErrors.push(`console: ${message.text()}`);
    });
    admin.on("pageerror", (error) => adminErrors.push(`pageerror: ${error.message}`));
    await admin.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: supabaseMock }));
    await admin.route("https://api.allonahub.com/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"base":"TRY","rates":{"TRY":1}}' }));
    await admin.route("https://cdn.example/**", (route) => route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="100%" height="100%" fill="#d9ebe5"/></svg>'
    }));
    await admin.goto(`http://allonahub.test:${address.port}/admin/avm.html`, { waitUntil: "networkidle" });
    await admin.locator("[data-avm-admin-sponsor-interactions] h3").waitFor();
    await admin.locator('[data-avm-preview-zone="77777777-7777-4777-8777-777777777777"]').waitFor();
    const adminZoneStyle = await admin.locator('[data-avm-preview-zone="77777777-7777-4777-8777-777777777777"]').getAttribute("style");
    assert(adminZoneStyle.includes("left:12%") && adminZoneStyle.includes("top:30%") && adminZoneStyle.includes("width:28%"), "Admin kat planı önizlemesi gerçek koordinatları kullanmadı.");
    assert(await admin.locator("[data-avm-preview-zone]").count() === 1, "Eksik koordinatlı bölge admin önizlemesinde sentetik konumla gösterildi.");
    assert(await admin.locator("[data-avm-admin-sponsor-interactions] tbody tr").count() === 1, "Admin sponsor etkileşim raporu satırı görünmedi.");
    assert((await admin.locator("[data-avm-admin-sponsor-interactions]").textContent()).includes("%17,65"), "Admin sponsor tıklama oranı filtre toplamlarından hesaplanmadı.");
    const sponsorTargetOptions = await admin.locator("[data-avm-sponsor-interaction-filter-target] option").evaluateAll((options) => options.map((option) => option.value));
    const sponsorTargetMarkup = await admin.locator("[data-avm-sponsor-interaction-filter-target]").evaluate((element) => element.outerHTML);
    assert(sponsorTargetOptions.includes(sponsorId), `Admin sponsor hedef filtresi envanteri taşımadı: ${sponsorTargetOptions.join(", ")} · ${sponsorTargetMarkup}`);
    await admin.locator("[data-avm-sponsor-interaction-filter-target]").selectOption(sponsorId);
    await admin.locator("[data-avm-sponsor-interaction-filter-slot-type]").selectOption("sponsored_listing");
    await admin.locator("[data-avm-sponsor-interaction-filter-type]").selectOption("click");
    await admin.locator("[data-avm-sponsor-interaction-filter-start]").fill("2026-07-01");
    await admin.locator("[data-avm-sponsor-interaction-filter-end]").fill("2026-07-11");
    await admin.locator("[data-avm-sponsor-interaction-page-size]").selectOption("25");
    await admin.waitForFunction((sponsorId) => {
      const calls = window.__rpcCalls.filter((call) => call.name === "get_mall_ad_slot_interaction_report");
      const args = calls[calls.length - 1]?.args || {};
      return args.report_ad_slot_id === sponsorId
        && args.report_slot_type === "sponsored_listing"
        && args.report_interaction_type === "click"
        && args.report_start_date === "2026-07-01"
        && args.report_end_date === "2026-07-11"
        && args.report_limit === 25;
    }, sponsorId);
    await admin.locator("[data-avm-sponsor-interaction-next]").click();
    await admin.waitForFunction(() => {
      const calls = window.__rpcCalls.filter((call) => call.name === "get_mall_ad_slot_interaction_report");
      return calls.some((call) => call.args.report_limit === 25 && call.args.report_offset === 25);
    });
    await admin.locator("[data-avm-sponsor-interaction-export]").click();
    await admin.waitForFunction(() => {
      const calls = window.__rpcCalls.filter((call) => call.name === "get_mall_ad_slot_interaction_report");
      return calls.some((call) => call.args.report_limit === 200 && call.args.report_offset === 0);
    });
    const form = admin.locator("[data-avm-ad-form]");
    await form.locator('[name="public_id"]').fill("sponsor-admin-smoke");
    await form.locator('[name="title"]').fill("Admin Sponsor Smoke");
    await form.locator('[name="placement"]').fill("Mağaza rehberi üst bandı");
    await form.locator('[name="lead_goal"]').fill("Kampanya ziyareti");
    await form.locator('[name="description"]').fill("Onaylı sponsor kampanyasının ziyaretçi açıklaması.");
    await form.locator('[name="creative_image_url"]').fill("https://cdn.example/admin-sponsor.webp");
    await form.locator('[name="creative_image_alt"]').fill("Admin sponsor kampanyası görseli");
    await form.locator('[name="cta_label"]').fill("Teklifi İncele");
    await form.locator('[name="cta_url"]').fill("https://brand.example/admin-campaign");
    await form.locator('[name="starts_at"]').fill("2026-07-11T10:00");
    await form.locator('[name="ends_at"]').fill("2026-07-31T22:00");
    await form.locator('[name="status"]').selectOption("active");
    await form.locator('button[type="submit"]').click();
    await admin.waitForFunction(() => window.__supabaseWrites.some((write) => write.table === "mall_ad_slots" && write.operation === "insert"));
    const write = await admin.evaluate(() => window.__supabaseWrites.find((item) => item.table === "mall_ad_slots" && item.operation === "insert"));
    assert(write.payload.creative_image_url === "https://cdn.example/admin-sponsor.webp", "Admin sponsor görsel URL payload'ı yanlış.");
    assert(write.payload.cta_url === "https://brand.example/admin-campaign", "Admin sponsor CTA payload'ı yanlış.");
    assert(write.payload.starts_at === "2026-07-11T07:00:00.000Z" && write.payload.ends_at === "2026-07-31T19:00:00.000Z", "Admin İstanbul yayın aralığı UTC'ye doğru çevrilmedi.");
    assert(adminErrors.length === 0, adminErrors.join("\n"));
    await admin.close();

    const mobileAdmin = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const mobileAdminErrors = [];
    mobileAdmin.on("console", (message) => {
      if (message.type() === "error") mobileAdminErrors.push(`console: ${message.text()}`);
    });
    mobileAdmin.on("pageerror", (error) => mobileAdminErrors.push(`pageerror: ${error.message}`));
    await mobileAdmin.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: supabaseMock }));
    await mobileAdmin.route("https://api.allonahub.com/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"base":"TRY","rates":{"TRY":1}}' }));
    await mobileAdmin.route("https://cdn.example/**", (route) => route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="100%" height="100%" fill="#d9ebe5"/></svg>'
    }));
    await mobileAdmin.goto(`http://allonahub.test:${address.port}/admin/avm.html#ad-slots`, { waitUntil: "networkidle" });
    await mobileAdmin.locator("[data-avm-admin-sponsor-interactions] h3").waitFor();
    const mobileAdminOverflow = await mobileAdmin.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const mobileAdminGridDebug = await mobileAdmin.locator("[data-avm-sponsor-interaction-filters]").evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      columns: getComputedStyle(element).gridTemplateColumns,
      parentWidth: element.parentElement.getBoundingClientRect().width,
      fieldMinWidth: getComputedStyle(element.querySelector(".field")).minWidth
    }));
    const mobileAdminOverflowSources = await mobileAdmin.evaluate(() => [...document.querySelectorAll("body *")]
      .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
      .slice(0, 8)
      .map((element) => `${element.closest("section")?.id || "no-section"}/${element.parentElement?.className || "-"}/${element.tagName.toLowerCase()}.${element.className || "-"}:${Math.round(element.getBoundingClientRect().right)}`));
    assert(mobileAdminOverflow <= 1, `390px admin görünümünde ${mobileAdminOverflow}px yatay taşma var: ${mobileAdminOverflowSources.join(", ")} · ${JSON.stringify(mobileAdminGridDebug)}`);
    assert(mobileAdminErrors.length === 0, mobileAdminErrors.join("\n"));
    await mobileAdmin.close();

    const partner = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const partnerErrors = [];
    partner.on("console", (message) => {
      if (message.type() === "error") partnerErrors.push(`console: ${message.text()}`);
    });
    partner.on("pageerror", (error) => partnerErrors.push(`pageerror: ${error.message}`));
    await partner.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: supabaseMock }));
    await partner.route("https://api.allonahub.com/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"base":"TRY","rates":{"TRY":1}}' }));
    await partner.goto(`http://allonahub.test:${address.port}/partner/avm.html#avm-submissions`, { waitUntil: "networkidle" });
    await partner.locator("[data-partner-avm-sponsor-report] h2").waitFor();
    assert(await partner.locator("[data-report-avm-sponsor-impressions]").textContent() === "120", "Partner sponsor gösterim toplamı yanlış.");
    assert(await partner.locator("[data-report-avm-sponsor-clicks]").textContent() === "9", "Partner sponsor tıklama toplamı yanlış.");
    assert((await partner.locator("[data-report-avm-sponsor-rate]").textContent()).includes("7,5"), "Partner sponsor tıklama oranı yanlış.");
    const partnerForm = partner.locator("[data-partner-avm-form]");
    await partnerForm.locator('[name="request_type"]').selectOption("advertising");
    assert(await partnerForm.locator('[name="requested_start_date"]').getAttribute("required") !== null, "Reklam talebinde başlangıç tarihi zorunlu değil.");
    assert(await partnerForm.locator('[name="media_url"]').getAttribute("required") !== null, "Reklam talebinde görsel zorunlu değil.");
    await partnerForm.locator('[name="brand_name"]').fill("Partner Test Marka");
    await partnerForm.locator('[name="submission_title"]').fill("Sponsorlu Yaz Yerleşimi");
    await partnerForm.locator('[name="requested_visibility"]').selectOption("sponsored");
    await partnerForm.locator('[name="contact_name"]').fill("Partner Yetkilisi");
    await partnerForm.locator('[name="contact_email"]').fill("partner@example.com");
    await partnerForm.locator('[name="requested_start_date"]').fill("2026-07-11");
    await partnerForm.locator('[name="requested_end_date"]').fill("2026-07-31");
    await partnerForm.locator('[name="destination_url"]').fill("https://brand.example/partner-campaign");
    await partnerForm.locator('[name="media_url"]').fill("https://cdn.example/partner-sponsor.webp");
    await partnerForm.locator('[name="media_alt"]').fill("Partner sponsor kampanyası görseli");
    await partnerForm.locator('[name="submission_summary"]').fill("AVM ziyaretçilerine yönelik onay bekleyen sponsor kampanyası.");
    await partnerForm.locator('button[type="submit"]').click();
    await partner.waitForFunction(() => window.__supabaseWrites.some((write) => write.table === "mall_partner_submissions" && write.operation === "insert"));
    const partnerWrite = await partner.evaluate(() => window.__supabaseWrites.find((item) => item.table === "mall_partner_submissions" && item.operation === "insert"));
    assert(partnerWrite.payload.request_type === "advertising", "Partner reklam talebi türü korunmadı.");
    assert(partnerWrite.payload.media_url === "https://cdn.example/partner-sponsor.webp", "Partner sponsor görseli payload'a taşınmadı.");
    assert(partnerWrite.payload.requested_start_date === "2026-07-11" && partnerWrite.payload.requested_end_date === "2026-07-31", "Partner sponsor yayın aralığı payload'a taşınmadı.");
    assert(partnerErrors.length === 0, partnerErrors.join("\n"));
    await partner.close();
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
  process.stdout.write("AVM sponsor smoke passed (visitor measurement + admin filtered report/publish + partner request/report).\n");
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
