(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const mallSlug = "allona-avm-dunyasi";
  let mallCenterLookup;
  let partnerAvmSubmissionTotal = 0;
  let partnerAvmSubmissionPage = 1;
  let partnerAvmSubmissionPageSize = 25;
  let partnerAvmSubmissionTypeFilter = "";
  let partnerAvmSubmissionStatusFilter = "";
  let partnerAvmSubmissionVisibilityFilter = "";
  let partnerAvmSubmissionStartDateFilter = "";
  let partnerAvmSubmissionEndDateFilter = "";
  let partnerAvmSubmissionRequestId = 0;
  let partnerAvmReportRowsPromise;

  const requestLabels = {
    tenant_profile: "Mağaza profili",
    campaign: "Kampanya",
    event: "Etkinlik",
    advertising: "Reklam / sponsor"
  };

  const visibilityLabels = {
    standard: "Standart",
    featured: "Öne çıkan",
    sponsored: "Sponsorlu",
    event_area: "Etkinlik alanı",
    not_published: "Yayında değil",
    scheduled: "Planlandı",
    published: "Yayında",
    hidden: "Gizli"
  };

  const statusLabels = {
    new: "Yeni",
    in_review: "İncelemede",
    changes_requested: "Revizyon istendi",
    approved: "Onaylandı",
    rejected: "Reddedildi",
    archived: "Arşivlendi"
  };

  const weekDays = [
    { value: 1, label: "Pazartesi" },
    { value: 2, label: "Salı" },
    { value: 3, label: "Çarşamba" },
    { value: 4, label: "Perşembe" },
    { value: 5, label: "Cuma" },
    { value: 6, label: "Cumartesi" },
    { value: 0, label: "Pazar" }
  ];

  async function guard() {
    const shell = document.querySelector("[data-partner-shell]");
    if (!shell) return null;
    try {
      return await App.auth.requireRole(["partner", "admin", "super_admin"]);
    } catch (error) {
      shell.innerHTML = `<div class="status-box status-box--error">${core.escapeHTML(error.message)}</div>`;
      return null;
    }
  }

  async function loadPartnerProducts(access) {
    const target = document.querySelector("[data-partner-products]");
    if (!target) return;
    core.renderStatus(target, "Ürünler yükleniyor...");
    try {
      let products;
      if (["admin", "super_admin"].includes(access.profile.role)) {
        products = await App.db.products.all();
      } else {
        const { data, error } = await App.db.client()
          .from("products")
          .select("*")
          .eq("partner_id", access.user.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        products = (data || []).map(core.normalizeProduct);
      }
      target.innerHTML = `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Ürün</th><th>Kategori</th><th>Fiyat</th><th>Stok</th><th>Durum</th></tr></thead>
            <tbody>
              ${products.map((product) => `
                <tr>
                  <td>${core.escapeHTML(product.name)}</td>
                  <td>${core.escapeHTML(product.category)}</td>
                  <td>${core.money(product.price)}</td>
                  <td><input type="number" min="0" value="${product.stock}" data-partner-stock="${core.escapeHTML(product.id)}"></td>
                  <td>${core.escapeHTML(product.status)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
      const reportProducts = document.querySelector("[data-report-products]");
      if (reportProducts) reportProducts.textContent = products.length;
    } catch (error) {
      core.renderStatus(target, error.message || "Ürünler yüklenemedi.", "error");
    }
  }

  async function loadPartnerOrders() {
    const target = document.querySelector("[data-partner-orders]");
    if (!target) return;
    core.renderStatus(target, "Siparişler yükleniyor...");
    try {
      const orders = await App.db.orders.list();
      target.innerHTML = `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Sipariş</th><th>Tutar</th><th>Durum</th><th>Ödeme</th></tr></thead>
            <tbody>
              ${orders.map((order) => `
                <tr>
                  <td>${core.escapeHTML(order.order_number || order.id)}</td>
                  <td>${core.money(order.total)}</td>
                  <td>${core.escapeHTML(order.order_status || "pending")}</td>
                  <td>${core.escapeHTML(order.payment_status || "pending")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
      const reportOrders = document.querySelector("[data-report-orders]");
      const reportPayments = document.querySelector("[data-report-payments]");
      if (reportOrders) reportOrders.textContent = orders.filter((order) => order.order_status === "pending").length;
      if (reportPayments) reportPayments.textContent = orders.filter((order) => order.payment_status === "awaiting_payment").length;
    } catch (error) {
      core.renderStatus(target, error.message || "Siparişler yüklenemedi.", "error");
    }
  }

  async function resolveMallCenter() {
    if (mallCenterLookup) return mallCenterLookup;
    const { data, error } = await App.db.client()
      .from("mall_centers")
      .select("id")
      .eq("slug", mallSlug)
      .maybeSingle();
    if (error) throw error;
    if (!data?.id) throw new Error("AVM merkezi kaydı bulunamadı. Supabase AVM migration sırası uygulanmalı.");
    mallCenterLookup = data;
    return mallCenterLookup;
  }

  function dateRange(row) {
    if (!row.requested_start_date && !row.requested_end_date) return "Tarih belirtilmedi";
    return [row.requested_start_date || "-", row.requested_end_date || "-"].join(" - ");
  }

  function nextDateKey(value) {
    const date = new Date(`${value}T12:00:00Z`);
    if (!Number.isFinite(date.getTime())) return "";
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  }

  function validHttpUrl(value) {
    try {
      return ["http:", "https:"].includes(new URL(String(value || "").trim()).protocol);
    } catch (error) {
      return false;
    }
  }

  function partnerMediaLink(row) {
    if (!validHttpUrl(row.media_url)) return "-";
    return `<a class="link-btn" href="${core.escapeHTML(row.media_url)}" target="_blank" rel="noopener">Görseli aç</a><br><small>${core.escapeHTML(row.media_alt || "Alt metin bekliyor")}</small>`;
  }

  function publishedAvmTargetLink(row) {
    if (!row.published_item_id || row.visibility_status !== "published" || row.request_type === "advertising") return "-";
    const href = `../avm-detay.html?item=${encodeURIComponent(row.published_item_id)}`;
    return `<a class="link-btn" href="${core.escapeHTML(href)}">Yayını aç</a>`;
  }

  function renderPartnerCampaignReport(rows, reportData) {
    const target = document.querySelector("[data-partner-avm-campaign-report]");
    if (!target) return;
    const campaignsByTarget = new Map();
    rows
      .filter((row) => row.request_type === "campaign" && row.published_item_id)
      .forEach((row) => {
        if (!campaignsByTarget.has(row.published_item_id)) campaignsByTarget.set(row.published_item_id, row);
      });
    const campaigns = [...campaignsByTarget.values()];
    if (!campaigns.length) {
      target.innerHTML = '<div class="empty-state">Yayın hedefi oluşmuş AVM kampanya talebi bulunmuyor.</div>';
      return;
    }
    if (!reportData) {
      core.renderStatus(target, "Kampanya performans kırılımı şu anda yüklenemiyor.", "error");
      return;
    }
    target.innerHTML = `
      <div class="section-header">
        <div>
          <p class="eyebrow">AVM Kampanya Performansı</p>
          <h2>Kampanya bazlı ilgi özeti</h2>
          <p class="muted">Arşivlenmemiş ziyaretçi ilgi kayıtları toplam ve son 30 gün penceresinde gösterilir.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Kampanya</th><th>Yayın</th><th>Toplam ilgi</th><th>Son 30 gün</th><th>Hedef</th></tr></thead>
          <tbody>
            ${campaigns.map((row) => `
              <tr>
                <td><strong>${core.escapeHTML(row.submission_title)}</strong><br><small>${core.escapeHTML(row.brand_name)}</small></td>
                <td>${core.escapeHTML(visibilityLabels[row.visibility_status] || row.visibility_status || "-")}<br><small>${core.escapeHTML(visibilityLabels[row.requested_visibility] || row.requested_visibility || "-")}</small></td>
                <td>${reportData.counts.get(row.published_item_id) || 0}</td>
                <td>${reportData.recentCounts.get(row.published_item_id) || 0}</td>
                <td>${publishedAvmTargetLink(row)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPartnerDirectoryInteractions(rows, summaryRows) {
    const target = document.querySelector("[data-partner-avm-interaction-report]");
    const report = document.querySelector("[data-report-avm-interactions]");
    const publishedByTarget = new Map();
    rows
      .filter((row) => row.request_type !== "advertising" && row.visibility_status === "published" && row.published_item_id)
      .forEach((row) => {
        if (!publishedByTarget.has(row.published_item_id)) publishedByTarget.set(row.published_item_id, row);
      });
    const publishedRows = [...publishedByTarget.values()];
    const summaries = new Map((summaryRows || []).map((summary) => [summary.directory_item_id, {
      total: Number(summary.total_count) || 0,
      views: Number(summary.detail_count) || 0,
      routePlan: Number(summary.route_plan_count) || 0,
      outbound: Number(summary.outbound_count) || 0,
      shares: Number(summary.share_count) || 0,
      recent: Number(summary.recent_count) || 0
    }]));
    const total = [...summaries.values()].reduce((sum, summary) => sum + summary.total, 0);
    if (report) report.textContent = total;
    if (!target) return;
    if (!publishedRows.length) {
      target.innerHTML = '<div class="empty-state">Yayındaki AVM katalog hedefiniz bulunmadığı için etkileşim raporu oluşmadı.</div>';
      return;
    }
    target.innerHTML = `
      <div class="section-header">
        <div>
          <p class="eyebrow">AVM İçerik Performansı</p>
          <h2>Yayın hedefi etkileşimleri</h2>
          <p class="muted">Günlük tekil ziyaretçi oturumu bazındaki detay, rota, dış aksiyon ve paylaşım kayıtları yalnızca kendi yayındaki hedefleriniz için gösterilir.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table data-table--wide">
          <thead><tr><th>Yayın hedefi</th><th>Toplam</th><th>Detay</th><th>Rota / plan</th><th>Dış aksiyon</th><th>Paylaşım</th><th>Son 30 gün</th><th>Hedef</th></tr></thead>
          <tbody>
            ${publishedRows.map((row) => {
              const summary = summaries.get(row.published_item_id) || { total: 0, views: 0, routePlan: 0, outbound: 0, shares: 0, recent: 0 };
              return `
                <tr>
                  <td><strong>${core.escapeHTML(row.submission_title)}</strong><br><small>${core.escapeHTML(row.brand_name)} · ${core.escapeHTML(requestLabels[row.request_type] || row.request_type)}</small></td>
                  <td>${summary.total}</td>
                  <td>${summary.views}</td>
                  <td>${summary.routePlan}</td>
                  <td>${summary.outbound}</td>
                  <td>${summary.shares}</td>
                  <td>${summary.recent}</td>
                  <td>${publishedAvmTargetLink(row)}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  async function loadDirectoryInteractionReport(rows) {
    const target = document.querySelector("[data-partner-avm-interaction-report]");
    const report = document.querySelector("[data-report-avm-interactions]");
    const targetIds = [...new Set(rows
      .filter((row) => row.request_type !== "advertising" && row.visibility_status === "published" && row.published_item_id)
      .map((row) => row.published_item_id))];
    if (!targetIds.length) {
      renderPartnerDirectoryInteractions(rows, []);
      return;
    }
    try {
      const { data, error } = await App.db.client().rpc("get_mall_directory_interaction_summary", {
        report_directory_item_ids: targetIds
      });
      if (error) throw error;
      renderPartnerDirectoryInteractions(rows, data || []);
    } catch (error) {
      if (report) report.textContent = "Kullanılamıyor";
      if (target) core.renderStatus(target, error.message || "AVM katalog etkileşimleri yüklenemedi.", "error");
    }
  }

  function timeValue(value) {
    const match = String(value || "").match(/^(\d{2}:\d{2})/);
    return match ? match[1] : "";
  }

  function istanbulDateKey() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date()).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function dayOfWeekForDate(dateKey) {
    return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  }

  function hoursRange(row) {
    if (!row) return "Program yayınlanmadı";
    if (row.is_closed) return "Kapalı";
    if (row.is_24_hours) return "24 saat açık";
    return `${timeValue(row.opens_at)} - ${timeValue(row.closes_at)}`;
  }

  function renderPartnerTenantHours(rows, profiles, weeklyRows, specialRows) {
    const target = document.querySelector("[data-partner-avm-hours-report]");
    const report = document.querySelector("[data-report-avm-hours]");
    if (report) report.textContent = profiles.length;
    if (!target) return;
    if (!profiles.length) {
      target.innerHTML = '<div class="empty-state">Yayındaki tenant hedeflerinize bağlı aktif çalışma saati profili bulunmuyor.</div>';
      return;
    }
    const today = istanbulDateKey();
    const todayDay = dayOfWeekForDate(today);
    const tenantByTarget = new Map();
    rows
      .filter((row) => row.request_type === "tenant_profile" && row.published_item_id)
      .forEach((row) => {
        if (!tenantByTarget.has(row.published_item_id)) tenantByTarget.set(row.published_item_id, row);
      });
    target.innerHTML = `
      <div class="section-header">
        <div>
          <p class="eyebrow">AVM Tenant Operasyonu</p>
          <h2>Çalışma saati yayınları</h2>
          <p class="muted">Yalnızca kendi yayın hedeflerinize bağlı aktif profiller ve İstanbul saatli bugün programı gösterilir.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Tenant</th><th>Bugün</th><th>Haftalık program</th><th>Sıradaki özel gün</th><th>Yayın hedefi</th></tr></thead>
          <tbody>
            ${profiles.map((profile) => {
              const tenant = tenantByTarget.get(profile.directory_item_id);
              const weekly = weeklyRows.filter((row) => row.profile_id === profile.id);
              const specialToday = specialRows.find((row) => row.profile_id === profile.id && row.service_date === today);
              const todayRow = specialToday || weekly.find((row) => Number(row.day_of_week) === todayDay);
              const nextSpecial = specialRows.find((row) => row.profile_id === profile.id && row.service_date >= today);
              const weeklySummary = weekDays.map((day) => {
                const row = weekly.find((item) => Number(item.day_of_week) === day.value);
                return `${day.label.slice(0, 3)} ${hoursRange(row)}`;
              }).join(" · ");
              return `
                <tr>
                  <td><strong>${core.escapeHTML(tenant?.brand_name || profile.title)}</strong><br><small>${core.escapeHTML(profile.title)}</small></td>
                  <td>${core.escapeHTML(hoursRange(todayRow))}${specialToday ? "<br><small>Özel gün programı</small>" : ""}</td>
                  <td><small>${core.escapeHTML(weeklySummary)}</small></td>
                  <td>${nextSpecial ? `${core.escapeHTML(nextSpecial.service_date)}<br><small>${core.escapeHTML(hoursRange(nextSpecial))}</small>` : "-"}</td>
                  <td>${tenant ? publishedAvmTargetLink(tenant) : "-"}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  async function loadPartnerTenantHours(rows) {
    const target = document.querySelector("[data-partner-avm-hours-report]");
    const report = document.querySelector("[data-report-avm-hours]");
    const tenantTargetIds = [...new Set(rows
      .filter((row) => row.request_type === "tenant_profile" && row.visibility_status === "published" && row.published_item_id)
      .map((row) => row.published_item_id))];
    if (!tenantTargetIds.length) {
      if (report) report.textContent = "0";
      if (target) target.innerHTML = '<div class="empty-state">Yayında tenant hedefiniz bulunmadığı için çalışma saati raporu oluşmadı.</div>';
      return;
    }
    try {
      const { data, error } = await App.db.client()
        .from("mall_hours_profiles")
        .select("id,directory_item_id,title,status")
        .in("directory_item_id", tenantTargetIds)
        .eq("status", "active");
      if (error) throw error;
      const profiles = data || [];
      const profileIds = profiles.map((profile) => profile.id);
      if (!profileIds.length) {
        renderPartnerTenantHours(rows, [], [], []);
        return;
      }
      const today = istanbulDateKey();
      const [weeklyResult, specialResult] = await Promise.all([
        App.db.client().from("mall_weekly_hours").select("profile_id,day_of_week,opens_at,closes_at,is_closed,is_24_hours,note").in("profile_id", profileIds),
        App.db.client().from("mall_special_hours").select("profile_id,service_date,opens_at,closes_at,is_closed,is_24_hours,note,status").in("profile_id", profileIds).eq("status", "active").gte("service_date", today).order("service_date", { ascending: true })
      ]);
      if (weeklyResult.error) throw weeklyResult.error;
      if (specialResult.error) throw specialResult.error;
      renderPartnerTenantHours(rows, profiles, weeklyResult.data || [], specialResult.data || []);
    } catch (error) {
      if (report) report.textContent = "Kullanılamıyor";
      if (target) core.renderStatus(target, error.message || "Tenant çalışma saatleri yüklenemedi.", "error");
    }
  }

  async function loadCampaignRedemptionCounts(rows) {
    const report = document.querySelector("[data-report-avm-redemptions]");
    const campaignReport = document.querySelector("[data-report-avm-campaigns]");
    const recentReport = document.querySelector("[data-report-avm-redemptions-30d]");
    const campaignTargetIds = [...new Set(rows
      .filter((row) => row.request_type === "campaign" && row.published_item_id)
      .map((row) => row.published_item_id))];
    const publishedCampaignCount = new Set(rows
      .filter((row) => row.request_type === "campaign" && row.visibility_status === "published" && row.published_item_id)
      .map((row) => row.published_item_id)).size;
    if (campaignReport) campaignReport.textContent = publishedCampaignCount;
    if (!campaignTargetIds.length) {
      if (report) report.textContent = "0";
      if (recentReport) recentReport.textContent = "0";
      return { counts: new Map(), recentCounts: new Map(), total: 0, recentTotal: 0 };
    }
    try {
      const batchSize = 500;
      const batches = [];
      for (let offset = 0; offset < campaignTargetIds.length; offset += batchSize) {
        batches.push(campaignTargetIds.slice(offset, offset + batchSize));
      }
      const results = await Promise.all(batches.map((batch) => App.db.client().rpc("get_mall_campaign_redemption_summary", {
        report_directory_item_ids: batch
      })));
      const failed = results.find((result) => result.error);
      if (failed) throw failed.error;
      const summaries = results.flatMap((result) => result.data || []);
      const counts = new Map(summaries.map((summary) => [summary.directory_item_id, Number(summary.total_count) || 0]));
      const recentCounts = new Map(summaries.map((summary) => [summary.directory_item_id, Number(summary.recent_count) || 0]));
      const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
      const recentTotal = [...recentCounts.values()].reduce((sum, count) => sum + count, 0);
      if (report) report.textContent = total;
      if (recentReport) recentReport.textContent = recentTotal;
      return { counts, recentCounts, total, recentTotal };
    } catch (error) {
      if (report) report.textContent = "Kullanılamıyor";
      if (recentReport) recentReport.textContent = "Kullanılamıyor";
      return null;
    }
  }

  function loadPartnerAvmReportRows(access, mallId) {
    if (partnerAvmReportRowsPromise) return partnerAvmReportRowsPromise;
    partnerAvmReportRowsPromise = (async () => {
      const rows = [];
      const batchSize = 500;
      let offset = 0;
      let expectedTotal;
      do {
        let query = App.db.client()
          .from("mall_partner_submissions")
          .select(
            "id,request_type,brand_name,submission_title,requested_visibility,visibility_status,status,published_item_id",
            offset === 0 ? { count: "exact" } : undefined
          )
          .eq("mall_id", mallId)
          .eq("module_key", "mall");
        if (!["admin", "super_admin"].includes(access.profile.role)) query = query.eq("submitted_by", access.user.id);
        query = query
          .order("created_at", { ascending: false })
          .range(offset, offset + batchSize - 1);
        const { data, error, count } = await query;
        if (error) throw error;
        const batch = data || [];
        rows.push(...batch);
        offset += batch.length;
        if (count !== null && count !== undefined && Number.isFinite(Number(count))) expectedTotal = Number(count);
        if (!batch.length || (Number.isFinite(expectedTotal) && offset >= expectedTotal)) break;
      } while (true);
      return rows;
    })().catch((error) => {
      partnerAvmReportRowsPromise = undefined;
      throw error;
    });
    return partnerAvmReportRowsPromise;
  }

  function renderPartnerAvmSubmissions(rows, redemptionReport) {
    const target = document.querySelector("[data-partner-avm-submissions]");
    if (!target) return;
    const totalPages = Math.max(1, Math.ceil(partnerAvmSubmissionTotal / partnerAvmSubmissionPageSize));
    const filtersActive = partnerAvmSubmissionTypeFilter
      || partnerAvmSubmissionStatusFilter
      || partnerAvmSubmissionVisibilityFilter
      || partnerAvmSubmissionStartDateFilter
      || partnerAvmSubmissionEndDateFilter;
    target.innerHTML = `
      <form class="filters partner-avm-submission-filters" data-partner-avm-submission-filters>
        <div class="field">
          <label for="partner-avm-submission-type-filter">Talep türü</label>
          <select id="partner-avm-submission-type-filter" data-partner-avm-submission-filter-type>
            <option value="">Tüm türler</option>
            ${Object.entries(requestLabels).map(([value, label]) => `<option value="${value}" ${partnerAvmSubmissionTypeFilter === value ? "selected" : ""}>${core.escapeHTML(label)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="partner-avm-submission-status-filter">İnceleme</label>
          <select id="partner-avm-submission-status-filter" data-partner-avm-submission-filter-status>
            <option value="">Tüm durumlar</option>
            ${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${partnerAvmSubmissionStatusFilter === value ? "selected" : ""}>${core.escapeHTML(label)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="partner-avm-submission-visibility-filter">Yayın durumu</label>
          <select id="partner-avm-submission-visibility-filter" data-partner-avm-submission-filter-visibility>
            <option value="">Tüm yayın durumları</option>
            ${["not_published", "scheduled", "published", "hidden"].map((value) => `<option value="${value}" ${partnerAvmSubmissionVisibilityFilter === value ? "selected" : ""}>${core.escapeHTML(visibilityLabels[value])}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="partner-avm-submission-start-filter">Oluşturma başlangıcı</label>
          <input id="partner-avm-submission-start-filter" type="date" data-partner-avm-submission-filter-start value="${core.escapeHTML(partnerAvmSubmissionStartDateFilter)}" ${partnerAvmSubmissionEndDateFilter ? `max="${core.escapeHTML(partnerAvmSubmissionEndDateFilter)}"` : ""}>
        </div>
        <div class="field">
          <label for="partner-avm-submission-end-filter">Oluşturma bitişi</label>
          <input id="partner-avm-submission-end-filter" type="date" data-partner-avm-submission-filter-end value="${core.escapeHTML(partnerAvmSubmissionEndDateFilter)}" ${partnerAvmSubmissionStartDateFilter ? `min="${core.escapeHTML(partnerAvmSubmissionStartDateFilter)}"` : ""}>
        </div>
        <div class="field">
          <label for="partner-avm-submission-page-size">Sayfa başına</label>
          <select id="partner-avm-submission-page-size" data-partner-avm-submission-page-size>
            ${[25, 50, 100].map((value) => `<option value="${value}" ${partnerAvmSubmissionPageSize === value ? "selected" : ""}>${value} kayıt</option>`).join("")}
          </select>
        </div>
        <div class="field field--actions">
          <label aria-hidden="true">&nbsp;</label>
          <button class="btn btn--light" type="button" data-partner-avm-submission-reset>Filtreleri Temizle</button>
        </div>
      </form>
      <p class="muted">${rows.length} kayıt bu sayfada / ${partnerAvmSubmissionTotal} eşleşme · üst performans özeti seçili oluşturma tarih aralığını kapsar.</p>
      ${rows.length
        ? `
          <div class="table-wrap">
            <table class="data-table data-table--wide">
              <thead><tr><th>Tür</th><th>Marka / Talep</th><th>Dönem</th><th>Medya</th><th>Görünürlük</th><th>İnceleme</th><th>Yayın</th><th>Yayın hedefi</th><th>Kampanya ilgisi</th><th>Tarih</th></tr></thead>
              <tbody>
                ${rows.map((row) => `
                  <tr>
                    <td>${core.escapeHTML(requestLabels[row.request_type] || row.request_type)}</td>
                    <td><strong>${core.escapeHTML(row.brand_name)}</strong><br>${core.escapeHTML(row.submission_title)}</td>
                    <td>${core.escapeHTML(dateRange(row))}</td>
                    <td>${partnerMediaLink(row)}</td>
                    <td>${core.escapeHTML(visibilityLabels[row.requested_visibility] || row.requested_visibility)}</td>
                    <td>${core.escapeHTML(statusLabels[row.status] || row.status)}</td>
                    <td>${core.escapeHTML(visibilityLabels[row.visibility_status] || row.visibility_status)}</td>
                    <td>${publishedAvmTargetLink(row)}</td>
                    <td>${row.request_type === "campaign"
                      ? core.escapeHTML(redemptionReport ? `${redemptionReport.counts.get(row.published_item_id) || 0} kayıt` : "Kullanılamıyor")
                      : "-"}</td>
                    <td>${row.created_at ? new Date(row.created_at).toLocaleString("tr-TR") : "-"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
          <nav class="avm-report-pagination" aria-label="AVM yayın talebi sayfaları">
            <button class="icon-btn" type="button" data-partner-avm-submission-previous aria-label="Önceki sayfa" title="Önceki sayfa" ${partnerAvmSubmissionPage <= 1 ? "disabled" : ""}>←</button>
            <span>Sayfa ${partnerAvmSubmissionPage} / ${totalPages}</span>
            <button class="icon-btn" type="button" data-partner-avm-submission-next aria-label="Sonraki sayfa" title="Sonraki sayfa" ${partnerAvmSubmissionPage >= totalPages ? "disabled" : ""}>→</button>
          </nav>
        `
        : `<div class="empty-state">${filtersActive ? "Bu filtrelerle eşleşen AVM yayın talebi yok." : "Henüz AVM yayın talebi göndermediniz."}</div>`}
    `;
  }

  async function loadPartnerAvmSubmissions(access, options = {}) {
    const target = document.querySelector("[data-partner-avm-submissions]");
    if (!target) return;
    if (options.resetPage) partnerAvmSubmissionPage = 1;
    const requestId = ++partnerAvmSubmissionRequestId;
    core.renderStatus(target, "AVM yayın talepleri yükleniyor...");
    try {
      const mall = await resolveMallCenter();
      let query = App.db.client()
        .from("mall_partner_submissions")
        .select("*", { count: "exact" })
        .eq("mall_id", mall.id)
        .eq("module_key", "mall")
        .order("created_at", { ascending: false });
      if (!["admin", "super_admin"].includes(access.profile.role)) {
        query = query.eq("submitted_by", access.user.id);
      }
      if (partnerAvmSubmissionTypeFilter) query = query.eq("request_type", partnerAvmSubmissionTypeFilter);
      if (partnerAvmSubmissionStatusFilter) query = query.eq("status", partnerAvmSubmissionStatusFilter);
      if (partnerAvmSubmissionVisibilityFilter) query = query.eq("visibility_status", partnerAvmSubmissionVisibilityFilter);
      if (partnerAvmSubmissionStartDateFilter) query = query.gte("created_at", `${partnerAvmSubmissionStartDateFilter}T00:00:00+03:00`);
      if (partnerAvmSubmissionEndDateFilter) query = query.lt("created_at", `${nextDateKey(partnerAvmSubmissionEndDateFilter)}T00:00:00+03:00`);
      const offset = (partnerAvmSubmissionPage - 1) * partnerAvmSubmissionPageSize;
      const [submissionResult, summaryResult, reportRows] = await Promise.all([
        query.range(offset, offset + partnerAvmSubmissionPageSize - 1),
        App.db.client().rpc("get_mall_partner_submission_summary", {
          report_mall_id: mall.id,
          report_start_date: partnerAvmSubmissionStartDateFilter || null,
          report_end_date: partnerAvmSubmissionEndDateFilter || null
        }),
        loadPartnerAvmReportRows(access, mall.id)
      ]);
      const { data, error, count } = submissionResult;
      if (error) throw error;
      if (summaryResult.error) throw summaryResult.error;
      if (requestId !== partnerAvmSubmissionRequestId) return;
      const rows = data || [];
      partnerAvmSubmissionTotal = Number(count) || 0;
      const totalPages = Math.max(1, Math.ceil(partnerAvmSubmissionTotal / partnerAvmSubmissionPageSize));
      if (partnerAvmSubmissionPage > totalPages) {
        partnerAvmSubmissionPage = totalPages;
        await loadPartnerAvmSubmissions(access);
        return;
      }
      const summary = summaryResult.data?.[0] || {};
      const report = document.querySelector("[data-report-avm-submissions]");
      const approvedReport = document.querySelector("[data-report-avm-approved]");
      const publishedReport = document.querySelector("[data-report-avm-published]");
      const advertisingReport = document.querySelector("[data-report-avm-advertising]");
      if (report) report.textContent = Number(summary.total_count) || 0;
      if (approvedReport) approvedReport.textContent = Number(summary.approved_count) || 0;
      if (publishedReport) publishedReport.textContent = Number(summary.published_count) || 0;
      if (advertisingReport) advertisingReport.textContent = Number(summary.advertising_count) || 0;
      const redemptionReport = await loadCampaignRedemptionCounts(reportRows);
      renderPartnerCampaignReport(reportRows, redemptionReport);
      await Promise.all([loadPartnerTenantHours(reportRows), loadDirectoryInteractionReport(reportRows)]);
      if (requestId !== partnerAvmSubmissionRequestId) return;
      renderPartnerAvmSubmissions(rows, redemptionReport);
    } catch (error) {
      if (requestId !== partnerAvmSubmissionRequestId) return;
      partnerAvmSubmissionTotal = 0;
      core.renderStatus(target, error.message || "AVM yayın talepleri yüklenemedi. İlgili Supabase migration uygulanmalı.", "error");
    }
  }

  function bindPartnerAvmSubmissionControls(access) {
    document.addEventListener("change", (event) => {
      const type = event.target.closest("[data-partner-avm-submission-filter-type]");
      const status = event.target.closest("[data-partner-avm-submission-filter-status]");
      const visibility = event.target.closest("[data-partner-avm-submission-filter-visibility]");
      const startDate = event.target.closest("[data-partner-avm-submission-filter-start]");
      const endDate = event.target.closest("[data-partner-avm-submission-filter-end]");
      const pageSize = event.target.closest("[data-partner-avm-submission-page-size]");
      if (!type && !status && !visibility && !startDate && !endDate && !pageSize) return;
      if (type) partnerAvmSubmissionTypeFilter = type.value;
      if (status) partnerAvmSubmissionStatusFilter = status.value;
      if (visibility) partnerAvmSubmissionVisibilityFilter = visibility.value;
      if (startDate) partnerAvmSubmissionStartDateFilter = startDate.value;
      if (endDate) partnerAvmSubmissionEndDateFilter = endDate.value;
      if (pageSize) partnerAvmSubmissionPageSize = Number(pageSize.value) || 25;
      if (partnerAvmSubmissionStartDateFilter && partnerAvmSubmissionEndDateFilter && partnerAvmSubmissionEndDateFilter < partnerAvmSubmissionStartDateFilter) {
        core.toast("Bitiş tarihi başlangıç tarihinden önce olamaz.", "error");
        return;
      }
      loadPartnerAvmSubmissions(access, { resetPage: true });
    });

    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-partner-avm-submission-reset]")) {
        partnerAvmSubmissionTypeFilter = "";
        partnerAvmSubmissionStatusFilter = "";
        partnerAvmSubmissionVisibilityFilter = "";
        partnerAvmSubmissionStartDateFilter = "";
        partnerAvmSubmissionEndDateFilter = "";
        loadPartnerAvmSubmissions(access, { resetPage: true });
        return;
      }
      if (event.target.closest("[data-partner-avm-submission-previous]") && partnerAvmSubmissionPage > 1) {
        partnerAvmSubmissionPage -= 1;
        loadPartnerAvmSubmissions(access);
        return;
      }
      const totalPages = Math.max(1, Math.ceil(partnerAvmSubmissionTotal / partnerAvmSubmissionPageSize));
      if (event.target.closest("[data-partner-avm-submission-next]") && partnerAvmSubmissionPage < totalPages) {
        partnerAvmSubmissionPage += 1;
        loadPartnerAvmSubmissions(access);
      }
    });
  }

  function prefillAvmContact(form, access) {
    if (form.elements.contact_name && !form.elements.contact_name.value) {
      form.elements.contact_name.value = access.profile.full_name || "";
    }
    if (form.elements.contact_email && !form.elements.contact_email.value) {
      form.elements.contact_email.value = access.user.email || "";
    }
    if (form.elements.contact_phone && !form.elements.contact_phone.value) {
      form.elements.contact_phone.value = access.profile.phone || "";
    }
  }

  function bindPartnerAvmForm(access) {
    const form = document.querySelector("[data-partner-avm-form]");
    const status = document.querySelector("[data-partner-avm-form-status]");
    if (!form) return;
    prefillAvmContact(form, access);

    const startInput = form.elements.requested_start_date;
    const endInput = form.elements.requested_end_date;
    const typeInput = form.elements.request_type;
    const mediaUrlInput = form.elements.media_url;
    const mediaAltInput = form.elements.media_alt;
    const syncRequestRequirements = () => {
      const scheduleRequired = ["campaign", "event", "advertising"].includes(typeInput?.value);
      const mediaRequired = true;
      if (startInput) startInput.required = scheduleRequired;
      if (endInput) endInput.required = scheduleRequired;
      if (mediaUrlInput) mediaUrlInput.required = mediaRequired;
      if (mediaAltInput) mediaAltInput.required = mediaRequired;
    };
    startInput?.addEventListener("change", () => {
      if (endInput) endInput.min = startInput.value || "";
    });
    typeInput?.addEventListener("change", syncRequestRequirements);
    form.addEventListener("reset", () => {
      window.setTimeout(() => {
        if (endInput) endInput.min = "";
        syncRequestRequirements();
      }, 0);
    });
    syncRequestRequirements();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      const values = core.parseForm(form);
      const requiredText = ["brand_name", "submission_title", "submission_summary", "contact_name", "contact_email"];
      if (requiredText.some((key) => !String(values[key] || "").trim())) {
        core.renderStatus(status, "Zorunlu alanlar yalnızca boşluk karakterlerinden oluşamaz.", "error");
        return;
      }
      const requiresSchedule = ["campaign", "event", "advertising"].includes(values.request_type);
      if (requiresSchedule && (!values.requested_start_date || !values.requested_end_date)) {
        core.renderStatus(status, "Kampanya, etkinlik ve reklam taleplerinde başlangıç ile bitiş tarihi zorunludur.", "error");
        return;
      }
      if (Boolean(values.requested_start_date) !== Boolean(values.requested_end_date)) {
        core.renderStatus(status, "Başlangıç ve bitiş tarihi birlikte girilmelidir.", "error");
        return;
      }
      if (values.requested_start_date && values.requested_end_date && values.requested_end_date < values.requested_start_date) {
        core.renderStatus(status, "Bitiş tarihi başlangıç tarihinden önce olamaz.", "error");
        return;
      }
      const mediaUrl = String(values.media_url || "").trim();
      const mediaAlt = String(values.media_alt || "").trim();
      if (!mediaUrl || !mediaAlt) {
        core.renderStatus(status, "Tüm AVM yayın taleplerinde içerik görseli ile görsel açıklaması zorunludur.", "error");
        return;
      }
      if (Boolean(mediaUrl) !== Boolean(mediaAlt)) {
        core.renderStatus(status, "İçerik görseli ve görsel açıklaması birlikte girilmelidir.", "error");
        return;
      }
      if (mediaUrl && !validHttpUrl(mediaUrl)) {
        core.renderStatus(status, "İçerik görseli geçerli bir HTTP(S) URL olmalıdır.", "error");
        return;
      }
      if (mediaAlt && (mediaAlt.length < 3 || mediaAlt.length > 300)) {
        core.renderStatus(status, "Görsel açıklaması 3-300 karakter arasında olmalıdır.", "error");
        return;
      }
      button.disabled = true;
      try {
        const mall = await resolveMallCenter();
        const payload = {
          mall_id: mall.id,
          submitted_by: access.user.id,
          module_key: "mall",
          request_type: values.request_type,
          brand_name: values.brand_name.trim(),
          submission_title: values.submission_title.trim(),
          submission_summary: values.submission_summary.trim(),
          contact_name: values.contact_name.trim(),
          contact_email: values.contact_email.trim(),
          contact_phone: values.contact_phone.trim() || null,
          requested_visibility: values.requested_visibility || "standard",
          destination_url: values.destination_url.trim() || null,
          media_url: mediaUrl || null,
          media_alt: mediaAlt,
          requested_start_date: values.requested_start_date || null,
          requested_end_date: values.requested_end_date || null,
          budget_range: values.budget_range || "not_specified",
          status: "new",
          visibility_status: "not_published",
          source_page: "partner-panel"
        };
        const { error } = await App.db.client().from("mall_partner_submissions").insert(payload);
        if (error) throw error;
        partnerAvmReportRowsPromise = undefined;
        form.reset();
        prefillAvmContact(form, access);
        core.renderStatus(status, "AVM yayın talebi yönetime iletildi.", "success");
        await loadPartnerAvmSubmissions(access, { resetPage: true });
      } catch (error) {
        core.renderStatus(status, error.message || "AVM yayın talebi gönderilemedi. İlgili Supabase migration uygulanmalı.", "error");
      } finally {
        button.disabled = false;
      }
    });
  }

  function bindStockUpdates() {
    document.addEventListener("change", async (event) => {
      const input = event.target.closest("[data-partner-stock]");
      if (!input) return;
      try {
        await App.db.products.updateFields(input.dataset.partnerStock, { stock: Number(input.value) });
        core.toast("Stok güncellendi.");
      } catch (error) {
        core.toast(error.message || "Stok güncellenemedi.", "error");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!document.querySelector("[data-page='partner']")) return;
    const access = await guard();
    if (!access) return;
    bindStockUpdates();
    bindPartnerAvmForm(access);
    bindPartnerAvmSubmissionControls(access);
    loadPartnerProducts(access);
    loadPartnerOrders();
    loadPartnerAvmSubmissions(access);
  });
})();
