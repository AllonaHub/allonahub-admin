(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const config = App.config || {};

  const state = {
    view: "dashboard",
    profile: null,
    capabilities: {},
    dashboard: null,
    warnings: [],
    cache: {
      users: [],
      applications: [],
      partners: [],
      orders: [],
      refunds: [],
      productReviews: [],
      integrations: {},
      tickets: [],
      proposals: [],
      social: {},
      security: {},
      reports: {},
      audit: [],
      automation: null
    }
  };

  const views = {
    dashboard: { label: "Dashboard", marker: "Canlı" },
    automation: { label: "Otomasyon Merkezi", marker: "Yeni" },
    users: { label: "Kullanıcı Takibi", marker: "" },
    applications: { label: "Partner Başvuruları", marker: "" },
    partners: { label: "Partner Operasyonları", marker: "" },
    integrations: { label: "Entegrasyonlar", marker: "MVP" },
    orders: { label: "Sipariş Yönetimi", marker: "" },
    refunds: { label: "İade ve İptaller", marker: "" },
    productReviews: { label: "Ürün Onayı", marker: "ETBİS" },
    content: { label: "İçerik Yönetimi", marker: "" },
    social: { label: "Sosyal Medya", marker: "Yeni" },
    support: { label: "Destek Talepleri", marker: "" },
    security: { label: "Güvenlik İzleme", marker: "" },
    reports: { label: "Raporlama", marker: "" },
    audit: { label: "Audit Log", marker: "" }
  };

  function $(selector) {
    return document.querySelector(selector);
  }

  function escape(value) {
    return core.escapeHTML(value ?? "");
  }

  function dateTime(value) {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleString(config.locale || "tr-TR");
    } catch {
      return "-";
    }
  }

  function money(value) {
    return core.money(Number(value || 0));
  }

  function normalizeStatus(value) {
    return String(value || "-").replace(/_/g, " ");
  }

  function badge(value, tone) {
    const text = normalizeStatus(value);
    const normalized = String(value || "").toLowerCase();
    const color = tone
      || (["active", "paid", "resolved", "verified", "approved"].includes(normalized) ? "green" : "")
      || (["warning", "review", "in_progress", "awaiting_payment", "pending_super_admin"].includes(normalized) ? "orange" : "")
      || (["critical", "rejected", "cancelled", "failed", "suspended"].includes(normalized) ? "red" : "");
    return `<span class="admin-badge ${color ? `admin-badge--${color}` : ""}">${escape(text)}</span>`;
  }

  const socialPlatforms = ["instagram", "facebook", "threads", "x", "linkedin", "tiktok", "youtube", "pinterest", "nsosyal", "telegram", "whatsapp", "google_business"];

  function socialPlatformOptions(selected) {
    const selectedSet = new Set(String(selected || socialPlatforms.join(",")).split(",").map((item) => item.trim()).filter(Boolean));
    return socialPlatforms.map((platform) => `
      <label class="admin-check">
        <input type="checkbox" name="target_platforms" value="${escape(platform)}" ${selectedSet.has(platform) ? "checked" : ""}>
        <span>${escape(platform)}</span>
      </label>
    `).join("");
  }

  function checkedValues(form, name) {
    return [...form.querySelectorAll(`[name="${name}"]:checked`)].map((item) => item.value);
  }

  function csvValues(value) {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function jsonObject(value) {
    const raw = String(value || "").trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("Payload JSON obje formatında olmalı.");
    }
    return parsed;
  }

  function dateTimeInputToIso(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function titleCell(title, sub) {
    return `<span class="admin-row-title">${escape(title || "-")}</span><span class="admin-row-sub">${escape(sub || "")}</span>`;
  }

  function shortText(value, max = 180) {
    const text = String(value || "").trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
  }

  function refundTypeLabel(value) {
    const map = {
      refund: "İade",
      cancellation: "İptal",
      signal: "İşaret",
      support_signal: "Destek sinyali"
    };
    return map[value] || value || "-";
  }

  function refundActionLabel(action) {
    const map = {
      mark_review: "İncelemeye al",
      approve_cancellation: "İptali onayla",
      approve_refund: "İadeyi onayla",
      reject_request: "Talebi reddet",
      add_note: "Not ekle"
    };
    return map[action] || action || "Aksiyon";
  }

  function statusBox(message, type) {
    return `<div class="admin-status ${type === "error" ? "admin-status--error" : ""}">${escape(message)}</div>`;
  }

  function partnerAccessEmailStatus(auth) {
    if (auth?.access_email_sent || auth?.invite_sent || auth?.password_reset_sent) {
      const type = auth.access_email_type === "invite" ? "davet maili" : "şifre belirleme maili";
      return `${type} gönderildi`;
    }
    return auth?.access_email_error
      ? `erişim maili gönderilemedi: ${auth.access_email_error}`
      : "erişim maili gönderilmedi";
  }

  function loginUrl() {
    const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    return core.url(`/admin/admin-login.html?returnTo=${returnTo}`);
  }

  function mfaUrl() {
    const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    return core.url(`/pages/account/mfa.html?returnTo=${returnTo}`);
  }

  function showToast(message, type) {
    let wrap = $(".admin-toast");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "admin-toast";
      document.body.appendChild(wrap);
    }
    const item = document.createElement("div");
    item.className = `admin-toast__item ${type === "error" ? "admin-toast__item--error" : ""}`;
    item.textContent = message;
    wrap.appendChild(item);
    setTimeout(() => item.remove(), 3600);
  }

  function readableError(error) {
    const message = String(error?.message || "").trim();
    if (/load failed|failed to fetch|networkerror|network request failed|cancelled/i.test(message)) {
      return "API bağlantısı kurulamadı. Lütfen Cloudflare/API erişimini ve oturum tokenını kontrol edip sayfayı yenileyin.";
    }
    return message || "Panel verisi yüklenemedi.";
  }

  function warningPanel(warnings) {
    const rows = [...new Set([...(state.warnings || []), ...(warnings || [])])].filter(Boolean);
    if (!rows.length) return "";
    return `<div class="admin-panel-note">${rows.map(escape).join("<br>")}</div>`;
  }

  async function sessionToken() {
    if (!App.auth || !App.auth.getSession) throw new Error("Oturum sistemi yüklenemedi.");
    const session = await App.auth.getSession();
    if (!session?.access_token) {
      window.location.href = loginUrl();
      return "";
    }
    return session.access_token;
  }

  async function api(path, options) {
    const token = await sessionToken();
    if (!token) return null;
    let response;
    try {
      response = await fetch(`${config.apiBaseUrl}${path}`, {
        method: options?.method || "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest"
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
        credentials: "omit"
      });
    } catch (error) {
      console.error("[AdminOps] API fetch failed", path, error);
      const wrapped = new Error(readableError(error));
      wrapped.network = true;
      wrapped.apiPath = path;
      wrapped.cause = error;
      throw wrapped;
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.message || payload.error || `API isteği tamamlanamadı. HTTP ${response.status}`;
      if (response.status === 403 && /mfa|iki aşamalı|2fa|aal2/i.test(message)) {
        window.location.href = mfaUrl();
        throw new Error("İki aşamalı doğrulama gerekli.");
      }
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      error.apiPath = path;
      throw error;
    }
    return payload;
  }

  function apiRouteMissing(error) {
    const message = String(error?.message || error?.payload?.message || "");
    return error?.status === 404 || /route .*not found|not found/i.test(message);
  }

  function partnerApplicationsFallbackReason(error) {
    const message = String(error?.message || "");
    const path = String(error?.apiPath || "");
    if (!/partner-applications/i.test(path) && !/partner başvur/i.test(message)) return "";
    if (error?.network || /API bağlantısı kurulamadı|failed to fetch|load failed|network/i.test(message)) {
      return "Partner başvuruları API path'i Cloudflare tarafından engellendi; Supabase RLS fallback aktif.";
    }
    return "";
  }

  function dbClient() {
    if (!App.db || !App.db.client) throw new Error("Supabase istemcisi yüklenemedi.");
    return App.db.client();
  }

  function applicationFilters() {
    return {
      search: $("#adminGlobalSearch")?.value?.trim() || "",
      status: $("#adminGlobalStatus")?.value || "",
      limit: 100
    };
  }

  function filterApplications(items, filters) {
    const options = filters || applicationFilters();
    const q = String(options.search || "").toLocaleLowerCase("tr-TR");
    const status = String(options.status || "");
    return (items || [])
      .filter((item) => !status || item.status === status)
      .filter((item) => {
        if (!q) return true;
        return [
          item.company_name,
          item.contact_name,
          item.email,
          item.phone,
          item.tax_number,
          item.company_type,
          item.category,
          item.city,
          item.country
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(q);
      })
      .slice(0, Number(options.limit || 100));
  }

  async function listApplicationsFromSupabase() {
    const filters = applicationFilters();
    let query = dbClient()
      .from("partner_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.max(Number(filters.limit || 100), 200));

    if (filters.status) query = query.eq("status", filters.status);

    const { data, error } = await query;
    if (error) throw error;
    return filterApplications(data || [], filters);
  }

  async function getApplicationFromSupabase(applicationId) {
    const { data, error } = await dbClient()
      .from("partner_applications")
      .select("*")
      .eq("id", applicationId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Partner başvurusu bulunamadı.");
    return data;
  }

  async function updateApplicationReviewFromSupabase(applicationId, payload) {
    const nowIso = new Date().toISOString();
    const recommendation = payload.action === "recommend_approve"
      ? "approve"
      : payload.action === "recommend_reject"
      ? "reject"
      : payload.action === "send_super_admin"
      ? "needs_super_admin"
      : null;
    const reviewStage = payload.action === "start_review" ? "in_review" : "recommendation_ready";

    const { data, error } = await dbClient()
      .from("partner_applications")
      .update({
        status: "review",
        review_stage: reviewStage,
        admin_recommendation: recommendation,
        risk_level: payload.risk_level,
        reviewed_by: state.profile?.id || null,
        reviewed_at: nowIso,
        metadata: {
          last_admin_action: payload.action,
          last_admin_reason: payload.reason,
          last_admin_action_at: nowIso,
          fallback_source: "admin_ops_supabase"
        }
      })
      .eq("id", applicationId)
      .select("*")
      .single();
    if (error) throw error;

    try {
      const { error: noteError } = await dbClient()
        .from("admin_operation_notes")
        .insert({
          author_id: state.profile?.id || null,
          target_type: "partner_application",
          target_id: applicationId,
          note_type: "review",
          body: payload.reason
        });
      if (noteError) throw noteError;
    } catch (noteError) {
      console.warn("[AdminOps] fallback note insert skipped", noteError);
    }

    return data;
  }

  function setLoading(message) {
    const content = $("#adminContent");
    if (content) content.innerHTML = statusBox(message || "Yükleniyor...");
  }

  function setActiveNav() {
    document.querySelectorAll("[data-admin-view]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.adminView === state.view);
    });
  }

  function currentMetrics() {
    return state.dashboard?.metrics || {};
  }

  function countItems(items, predicate) {
    return (items || []).filter(predicate).length;
  }

  function notificationCount(view) {
    const metrics = currentMetrics();
    const alerts = state.dashboard?.alerts || [];
    const cache = state.cache || {};
    const automation = cache.automation || state.dashboard?.automation || {};
    const automationSummary = automation.summary || {};
    const refundSignalCount = countItems(alerts, (item) => /iade|iptal|refund|cancel|ihtilaf|dispute/i.test(`${item.title || ""} ${item.message || ""}`));
    const applicationCount = Math.max(
      Number(metrics.pending_applications || 0),
      countItems(cache.applications, (item) => ["pending", "review"].includes(String(item.status || "")))
    );
    const supportCount = Math.max(
      Number(metrics.open_support_tickets || 0),
      countItems(cache.tickets, (item) => ["open", "in_progress", "waiting"].includes(String(item.status || "")))
    );
    const securityCount = Number(metrics.system_alerts || 0);
    const counts = {
      dashboard: securityCount + applicationCount + supportCount,
      applications: applicationCount,
      support: supportCount,
      security: securityCount,
      refunds: Math.max(
        refundSignalCount,
        countItems(cache.refunds, (item) => ["support_signal", "signal"].includes(item.type) || item.order_status === "pending_signal")
      ),
      automation: Number(automationSummary.action_required || 0) + Number(automationSummary.auto_ready || 0),
      productReviews: countItems(cache.productReviews, (item) => !["approved", "rejected"].includes(String(item.compliance_review_status || "pending"))),
      content: countItems(cache.proposals, (item) => ["pending_super_admin", "review", "draft"].includes(String(item.status || ""))),
      social: countItems(cache.social?.drafts, (item) => ["ready_for_review", "queued", "failed"].includes(String(item.status || "")))
    };
    return Math.max(0, Number(counts[view] || 0));
  }

  function notificationTone(view, count) {
    if (!count) return "";
    if (["security", "refunds"].includes(view)) return "critical";
    if (view === "automation") return Number((state.cache.automation || state.dashboard?.automation || {}).summary?.critical || 0) ? "critical" : "attention";
    if (["support", "applications", "productReviews", "content"].includes(view)) return "attention";
    return "info";
  }

  function navBadge(view) {
    const count = notificationCount(view);
    if (!count) return "";
    const label = count > 99 ? "99+" : String(count);
    const tone = notificationTone(view, count);
    return `<span class="admin-nav-alert" data-tone="${escape(tone)}" title="${escape(label)} yeni bildirim">${escape(label)}</span>`;
  }

  function viewFromHash() {
    const key = String(window.location.hash || "").replace("#", "").trim();
    return views[key] ? key : "dashboard";
  }

  function queryParams() {
    const params = new URLSearchParams();
    const search = $("#adminGlobalSearch")?.value?.trim() || "";
    const status = $("#adminGlobalStatus")?.value || "";
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    params.set("limit", "100");
    return params.toString();
  }

  function section(title, subtitle, body, actions) {
    return `
      <section class="admin-section">
        <div class="admin-section__head">
          <div>
            <h1>${escape(title)}</h1>
            ${subtitle ? `<p>${escape(subtitle)}</p>` : ""}
          </div>
          ${actions ? `<div class="admin-actions">${actions}</div>` : ""}
        </div>
        <div class="admin-section__body">${body}</div>
      </section>
    `;
  }

  function table(headers, rows, emptyText) {
    if (!rows.length) return statusBox(emptyText || "Kayıt bulunamadı.");
    return `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr>${headers.map((item) => `<th>${escape(item)}</th>`).join("")}</tr></thead>
          <tbody>${rows.join("")}</tbody>
        </table>
      </div>
    `;
  }

  function metricsGrid(metrics) {
    const items = [
      ["Günlük kullanıcı", metrics.daily_users],
      ["Günlük başvuru", metrics.daily_partner_applications],
      ["Bekleyen başvuru", metrics.pending_applications],
      ["Son sipariş", metrics.recent_orders],
      ["Açık destek", metrics.open_support_tickets],
      ["Sistem uyarısı", metrics.system_alerts]
    ];
    return `<div class="admin-metrics">${items.map(([label, value]) => `
      <div class="admin-metric"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>
    `).join("")}</div>`;
  }

  function automationSummaryGrid(summary) {
    const items = [
      ["Otomatik hazır", summary.auto_ready],
      ["Admin kararı", summary.admin_required],
      ["Süper admin", summary.super_admin_required],
      ["Takip listesi", summary.watchlist],
      ["Kritik", summary.critical],
      ["Uygulandı", summary.applied]
    ];
    return `<div class="admin-metrics">${items.map(([label, value]) => `
      <div class="admin-metric"><span>${escape(label)}</span><strong>${escape(value || 0)}</strong></div>
    `).join("")}</div>`;
  }

  function automationRiskTone(risk) {
    if (risk === "critical") return "red";
    if (risk === "high" || risk === "warning") return "orange";
    if (risk === "low" || risk === "clear") return "green";
    return "";
  }

  function automationLaneTitle(lane) {
    const map = {
      auto_ready: "Otomatik hazır",
      admin_queue: "Admin kuyruğu",
      super_admin_queue: "Süper admin kuyruğu",
      watchlist: "Takip listesi"
    };
    return map[lane] || lane || "Kuyruk";
  }

  function automationQueueRows(items) {
    return (items || []).map((item) => `
      <tr>
        <td>${titleCell(item.title, `${automationLaneTitle(item.lane)} / ${item.type || "-"}`)}</td>
        <td>${badge(item.risk_level || "medium", automationRiskTone(item.risk_level))}</td>
        <td>${escape(shortText(item.summary || "-", 180))}</td>
        <td>${escape(shortText(item.action || "-", 120))}</td>
        <td>${dateTime(item.created_at)}</td>
      </tr>
    `);
  }

  function automationQueuePreview(automation) {
    const queues = automation?.queues || {};
    const rows = [
      ...(queues.auto_ready || []).slice(0, 4),
      ...(queues.admin_queue || []).slice(0, 4),
      ...(queues.super_admin_queue || []).slice(0, 4),
      ...(queues.watchlist || []).slice(0, 3)
    ];
    return table(["Kayıt", "Risk", "Sebep", "Aksiyon", "Tarih"], automationQueueRows(rows), "Otomasyon kuyruğunda kayıt yok.");
  }

  function automationRulesList(rules) {
    const rows = (rules || []).map((rule) => `
      <div class="admin-list-item">
        <strong>${badge(rule.auto_apply ? "otomatik" : "manuel", rule.auto_apply ? "green" : "orange")} ${escape(rule.title)}</strong>
        <p>${escape(rule.summary || "")}</p>
      </div>
    `).join("");
    return rows ? `<div class="admin-list">${rows}</div>` : statusBox("Otomasyon kuralı bulunamadı.");
  }

  function automationActions(automation) {
    const summary = automation?.summary || {};
    return `
      <button class="admin-btn admin-btn--gold" type="button" data-admin-automation-run="publish_safe_products" ${Number(summary.auto_ready || 0) ? "" : "disabled"}>Güvenli Ürünleri Yayına Al</button>
      <button class="admin-btn admin-btn--primary" type="button" id="adminRefresh">Yenile</button>
    `;
  }

  function automationPanel(automation) {
    if (!automation) return "";
    const summary = automation.summary || {};
    return section(
      "Otomasyon Merkezi",
      `Son kontrol: ${dateTime(automation.checked_at)}`,
      automationSummaryGrid(summary) + automationQueuePreview(automation),
      `<button class="admin-btn" type="button" data-admin-view="automation">Detay</button>${automationActions(automation)}`
    );
  }

  function renderAutomationCenter(automation) {
    const payload = automation || state.cache.automation || state.dashboard?.automation || { summary: {}, queues: {}, rules: [] };
    const queues = payload.queues || {};
    $("#adminContent").innerHTML = [
      section(
        "Otomasyon Merkezi",
        "Düşük riskli işler otomatik, riskli işler admin, kritik işler süper admin kuyruğuna düşer",
        warningPanel(payload.warnings) + automationSummaryGrid(payload.summary || {}),
        automationActions(payload)
      ),
      section("Otomatik Hazır", "Kuralları geçen ve güvenli yayınlanabilecek kayıtlar", table(["Kayıt", "Risk", "Sebep", "Aksiyon", "Tarih"], automationQueueRows(queues.auto_ready || []), "Otomatik yayınlanabilecek kayıt yok.")),
      section("Admin Kuyruğu", "Admin kararı veya revizyon bildirimi isteyen kayıtlar", table(["Kayıt", "Risk", "Sebep", "Aksiyon", "Tarih"], automationQueueRows(queues.admin_queue || []), "Admin kararı bekleyen kayıt yok.")),
      section("Süper Admin Kuyruğu", "Owner onayı, kritik güvenlik, içerik veya yayın kararı isteyen kayıtlar", table(["Kayıt", "Risk", "Sebep", "Aksiyon", "Tarih"], automationQueueRows(queues.super_admin_queue || []), "Süper admin kuyruğu boş.")),
      section("Takip Listesi", "Otomatik işlem yapılmayan ama izlenen operasyonel kayıtlar", table(["Kayıt", "Risk", "Sebep", "Aksiyon", "Tarih"], automationQueueRows(queues.watchlist || []), "Takip listesi boş.")),
      section("Kurallar", "Otomasyonun hangi işi nerede durdurduğunu gösterir", automationRulesList(payload.rules || []))
    ].join("");
  }

  function renderDashboard(payload) {
    const dashboard = payload || state.dashboard || { metrics: {}, recentOrders: [], alerts: [] };
    const orders = dashboard.recentOrders || [];
    const alerts = dashboard.alerts || [];
    const orderRows = orders.map((order) => `
      <tr>
        <td>${titleCell(order.order_no || order.id, dateTime(order.created_at))}</td>
        <td>${titleCell(order.customer_name, order.customer_email)}</td>
        <td>${money(order.total)}</td>
        <td>${badge(order.order_status)}</td>
        <td>${badge(order.payment_status)}</td>
      </tr>
    `);
    const alertList = alerts.length ? `
      <div class="admin-list">
        ${alerts.map((item) => `
          <div class="admin-list-item">
            <strong>${badge(item.severity)} ${escape(item.title)}</strong>
            <p>${escape(item.message || "-")}</p>
            <p>${escape(dateTime(item.created_at))}</p>
          </div>
        `).join("")}
      </div>
    ` : statusBox("Aktif sistem uyarısı yok.");

    $("#adminContent").innerHTML = [
      section("Admin Dashboard", "Günlük operasyon özeti", metricsGrid(dashboard.metrics || {})),
      warningPanel(),
      automationPanel(dashboard.automation),
      `<div class="admin-split">
        ${section("Son Siparişler", "", table(["Sipariş", "Müşteri", "Tutar", "Sipariş", "Ödeme"], orderRows, "Sipariş kaydı bulunamadı."))}
        ${section("Sistem Uyarıları", "", alertList)}
      </div>`
    ].join("");
  }

  function productReviewStatusLabel(value) {
    const map = {
      pending: "Onay bekliyor",
      approved: "Onaylandı",
      rejected: "Reddedildi",
      needs_review: "Revizyon gerekli"
    };
    return map[value] || value || "pending";
  }

  function productReviewStatusTone(value) {
    if (value === "approved") return "green";
    if (value === "rejected") return "red";
    return "orange";
  }

  function productReviewAutomationLabel(automation) {
    if (!automation) return "Kontrol bekliyor";
    if (automation.revision_required || automation.lane === "needs_revision") return "Revizyon riski";
    if (automation.lane === "watch" || automation.risk_level === "warning") return "Kontrol et";
    return "Onaya hazır";
  }

  function productReviewAutomationTone(automation) {
    if (!automation) return "orange";
    if (automation.revision_required || automation.risk_level === "critical" || automation.lane === "needs_revision") return "red";
    if (automation.risk_level === "warning" || automation.lane === "watch") return "orange";
    return "green";
  }

  function productReviewAutomationReason(automation) {
    const reasons = automation?.reasons || [];
    if (!reasons.length) return "Otomasyon revizyon riski görmedi.";
    return reasons
      .slice(0, 2)
      .map((reason) => `${reason.field_label || reason.field || "Alan"}: ${reason.title || reason.message || "Kontrol"}`)
      .join(" · ");
  }

  function renderProductReviews(products) {
    const rows = products.map((raw) => {
      const product = core.normalizeProduct(raw);
      const reviewStatus = raw.compliance_review_status || "pending";
      const automation = raw.review_automation;
      return `
        <tr>
          <td>${titleCell(product.name, `${product.category || "-"} / ${product.module_key || "shop"}`)}</td>
          <td>${titleCell(product.seller_public_name || product.seller_name || "-", product.seller_legal_name || product.seller_city || "-")}</td>
          <td>${money(product.price)}<br><small>${escape(product.stock)} stok</small></td>
          <td>${badge(product.status)}<br>${badge(productReviewStatusLabel(reviewStatus), productReviewStatusTone(reviewStatus))}</td>
          <td>${badge(productReviewAutomationLabel(automation), productReviewAutomationTone(automation))}<br><small>${escape(shortText(productReviewAutomationReason(automation), 130))}</small></td>
          <td>${escape(shortText(product.invoice_responsibility || "-", 120))}</td>
          <td>
            <span class="admin-actions">
              <button class="admin-btn" type="button" data-detail="product-review" data-id="${escape(product.id)}">Detay</button>
              <button class="admin-btn admin-btn--gold" type="button" data-product-review-action="approved" data-id="${escape(product.id)}">Yayına Al</button>
              <button class="admin-btn" type="button" data-product-review-action="needs_review" data-id="${escape(product.id)}">Revizyon</button>
              <button class="admin-btn admin-btn--danger" type="button" data-product-review-action="rejected" data-id="${escape(product.id)}">Reddet</button>
            </span>
          </td>
        </tr>
      `;
    });

    $("#adminContent").innerHTML = section(
      "Ürün Onayı",
      "Partner katalog kayıtlarında satıcı, fatura, iade/cayma ve yasaklı ürün uygunluğu kontrolü",
      warningPanel() + table(["Ürün", "Satıcı", "Fiyat/Stok", "Durum", "Otomasyon", "Fatura Sorumluluğu", "Aksiyon"], rows, "Onay bekleyen ürün bulunamadı."),
      `<a class="admin-btn admin-btn--gold" href="product-reviews.html">Ürün Onay Otomasyonu</a><button class="admin-btn admin-btn--primary" type="button" id="adminRefresh">Yenile</button>`
    );
  }

  function renderUsers(users) {
    const rows = users.map((user) => `
      <tr>
        <td>${titleCell(user.full_name || user.email || user.id, user.email || user.phone)}</td>
        <td>${escape(user.phone || "-")}</td>
        <td>${badge(user.role)}</td>
        <td>${badge(user.profile_visible === false ? "hidden" : "active")}</td>
        <td>${dateTime(user.created_at)}</td>
        <td>
          <span class="admin-actions">
            <button class="admin-btn" type="button" data-detail="user" data-id="${escape(user.id)}">Detay</button>
            <button class="admin-btn admin-btn--gold" type="button" data-user-note="${escape(user.id)}">Not</button>
            <button class="admin-btn admin-btn--danger" type="button" data-user-flag="${escape(user.id)}">Şüpheli</button>
          </span>
        </td>
      </tr>
    `);
    $("#adminContent").innerHTML = section(
      "Kullanıcı Takibi",
      "Listeleme, detay görüntüleme, not ve şüpheli kullanıcı işaretleme",
      warningPanel() + table(["Kullanıcı", "Telefon", "Rol", "Durum", "Kayıt", "İşlem"], rows, "Kullanıcı bulunamadı.")
    );
  }

  function renderApplications(applications) {
    const rows = applications.map((item) => `
      <tr>
        <td>${titleCell(item.company_name, item.contact_name || item.email)}</td>
        <td>${escape(item.tax_number || "-")}</td>
        <td>${badge(item.status)}</td>
        <td>${badge(item.review_stage || "new")}</td>
        <td>${badge(item.risk_level || "info")}</td>
        <td>${dateTime(item.created_at)}</td>
        <td>
          <span class="admin-actions">
            <button class="admin-btn" type="button" data-detail="application" data-id="${escape(item.id)}">Detay</button>
            <button class="admin-btn admin-btn--gold" type="button" data-application-decision="${escape(item.id)}">Karar Ver</button>
          </span>
        </td>
      </tr>
    `);
    $("#adminContent").innerHTML = section(
      "Partner Başvuruları",
      "İnceleme, öneri ve Super Admin onayına gönderme",
      warningPanel() + table(["Başvuru", "Vergi No", "Durum", "İnceleme", "Risk", "Tarih", "İşlem"], rows, "Partner başvurusu bulunamadı.")
    );
  }

  function renderPartners(partners) {
    const rows = partners.map((partner) => `
      <tr>
        <td>${titleCell(partner.display_name || partner.legal_name, partner.partner_code)}</td>
        <td>${escape(partner.partner_type || "-")}</td>
        <td>${badge(partner.status)}</td>
        <td>${badge(partner.verification_status)}</td>
        <td>${escape(partner.trust_score ?? "-")}</td>
        <td>${escape(partner.city || "-")}</td>
        <td><button class="admin-btn" type="button" data-detail="partner" data-id="${escape(partner.id)}">Detay</button></td>
      </tr>
    `);
    $("#adminContent").innerHTML = section(
      "Partner Operasyonları",
      "Partner durumu, mağaza bilgisi ve operasyonel izleme",
      warningPanel() + table(["Partner", "Tip", "Durum", "Doğrulama", "Güven", "Şehir", "İşlem"], rows, "Partner kaydı bulunamadı.")
    );
  }

  function renderIntegrations(data) {
    const integrations = data.integrations || [];
    const runs = data.runs || [];
    const publishJobs = data.publishJobs || [];
    const policy = data.policy || {};
    const metricHtml = `<div class="admin-metrics">${[
      ["Bağlantı", integrations.length],
      ["Sorunlu run", runs.filter((item) => ["failed", "partial"].includes(item.status)).length],
      ["Publish kuyruğu", publishJobs.filter((item) => ["queued", "failed"].includes(item.status)).length],
      ["Apply", policy.apply_enabled ? "Açık" : "Kapalı"],
      ["Outbound", policy.outbound_enabled ? "Açık" : "Kapalı"]
    ].map(([label, value]) => `<div class="admin-metric"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`).join("")}</div>`;
    const integrationRows = integrations.map((item) => `
      <tr>
        <td>${titleCell(item.display_name || item.provider, item.partner?.display_name || item.partner?.partner_code || item.partner_id)}</td>
        <td>${badge(item.provider)}<br><small>${escape(item.plan_tier || "free")}</small></td>
        <td>${badge(item.status)}<br>${badge(item.last_test_status || "test bekliyor")}</td>
        <td>${escape(item.sync_mode || "manual")}<br><small>${escape(item.import_enabled ? "import açık" : "import kapalı")} / ${escape(item.export_enabled ? "export açık" : "export kapalı")}</small></td>
        <td>${dateTime(item.last_sync_at)}<br><small>${escape(shortText(item.last_error_message || item.last_test_message || "-", 90))}</small></td>
      </tr>
    `);
    const runRows = runs.map((run) => `
      <tr>
        <td>${titleCell(run.integration?.display_name || run.integration?.provider || run.integration_id, dateTime(run.started_at))}</td>
        <td>${badge(run.run_mode)} / ${badge(run.direction)}</td>
        <td>${badge(run.status)}</td>
        <td>${escape(run.checked_count || 0)} kontrol · ${escape(run.created_count || 0)} yeni · ${escape(run.updated_count || 0)} güncel</td>
        <td>${escape(run.failed_count || 0)} hata · ${escape(run.warning_count || 0)} uyarı</td>
      </tr>
    `);
    const jobRows = publishJobs.map((job) => `
      <tr>
        <td>${titleCell(job.product?.name || job.product_id, job.integration?.display_name || job.integration?.provider || job.integration_id)}</td>
        <td>${badge(job.action)}</td>
        <td>${badge(job.status)}</td>
        <td>${dateTime(job.scheduled_at)}<br><small>${escape(shortText(job.error_message || "-", 90))}</small></td>
      </tr>
    `);
    $("#adminContent").innerHTML = [
      section("Entegrasyon Merkezi", "Partner connectorları, sync runları ve outbound kuyruğu", warningPanel(data.warnings) + metricHtml),
      section("Bağlantılar", "", table(["Entegrasyon", "Provider", "Durum", "Mod", "Son Çalışma"], integrationRows, "Entegrasyon kaydı bulunamadı.")),
      `<div class="admin-split">
        ${section("Senkron Logları", "", table(["Run", "Tip", "Durum", "Sayaç", "Kontrol"], runRows, "Senkron kaydı bulunamadı."))}
        ${section("Publish Kuyruğu", "", table(["Ürün", "Aksiyon", "Durum", "Plan"], jobRows, "Publish işi bulunamadı."))}
      </div>`
    ].join("");
  }

  function renderOrders(orders) {
    const rows = orders.map((order) => `
      <tr>
        <td>${titleCell(order.order_no || order.id, dateTime(order.created_at))}</td>
        <td>${titleCell(order.customer_name, order.customer_email)}</td>
        <td>${money(order.total)}</td>
        <td>${badge(order.order_status)}</td>
        <td>${badge(order.payment_status)}</td>
        <td>${escape(order.tracking_number || "-")}</td>
        <td>
          <span class="admin-actions">
            <button class="admin-btn" type="button" data-detail="order" data-id="${escape(order.id)}">Detay</button>
            <button class="admin-btn admin-btn--danger" type="button" data-order-risk="${escape(order.id)}">Riskli</button>
          </span>
        </td>
      </tr>
    `);
    $("#adminContent").innerHTML = section(
      "Sipariş Yönetimi",
      "Sipariş, ödeme, teslimat ve riskli sipariş takibi",
      warningPanel() + table(["Sipariş", "Müşteri", "Tutar", "Sipariş", "Ödeme", "Kargo", "İşlem"], rows, "Sipariş bulunamadı.")
    );
  }

  function renderRefunds(payload) {
    const data = payload || {};
    const items = data.items || [];
    const summary = data.summary || {};
    const metricHtml = `<div class="admin-metrics">
      ${[
        ["Toplam", summary.total],
        ["İade", summary.refunded],
        ["İptal", summary.cancelled],
        ["Destek sinyali", summary.support_signals],
        ["Aksiyon bekleyen", summary.action_required]
      ].map(([label, value]) => `<div class="admin-metric"><span>${escape(label)}</span><strong>${escape(value || 0)}</strong></div>`).join("")}
    </div>`;
    const filterHint = `
      <div class="admin-panel-note">
        Arama kutusundan sipariş no, müşteri, e-posta veya neden arayabilirsin.
        Durum filtresinde <strong>Refunded</strong>, <strong>Cancelled</strong> veya <strong>Pending signal</strong> seçilebilir.
      </div>
    `;
    const rows = items.map((item) => {
      const isTicket = item.type === "support_signal";
      const actions = isTicket
        ? `<button class="admin-btn" type="button" data-refund-ticket-detail="${escape(item.ticket_id || item.id)}">Detay</button>`
        : `
          <span class="admin-actions">
            <button class="admin-btn" type="button" data-refund-detail="${escape(item.id)}">Detay</button>
            <button class="admin-btn" type="button" data-refund-action="mark_review" data-id="${escape(item.id)}">İncele</button>
            <button class="admin-btn admin-btn--gold" type="button" data-refund-action="approve_cancellation" data-id="${escape(item.id)}">İptal Onayla</button>
            <button class="admin-btn admin-btn--gold" type="button" data-refund-action="approve_refund" data-id="${escape(item.id)}">İade Onayla</button>
            <button class="admin-btn admin-btn--danger" type="button" data-refund-action="reject_request" data-id="${escape(item.id)}">Reddet</button>
          </span>
        `;
      return `
        <tr>
          <td>${titleCell(item.order_no || item.id, dateTime(item.updated_at || item.created_at))}</td>
          <td>${badge(refundTypeLabel(item.type), item.type === "refund" ? "red" : item.type === "cancellation" ? "orange" : "")}</td>
          <td>${titleCell(item.customer_name || item.customer_email || "-", item.customer_phone || item.customer_email || "")}</td>
          <td>${item.total ? money(item.total) : "-"}</td>
          <td>${badge(item.order_status || "-")}</td>
          <td>${badge(item.payment_status || "-")}</td>
          <td>${escape(shortText(item.reason || "Neden kaydı yok", 150))}</td>
          <td>${actions}</td>
        </tr>
      `;
    });
    $("#adminContent").innerHTML = section(
      "İade ve İptaller",
      "İade, iptal, destek sinyali, neden ve operasyon aksiyonları",
      warningPanel(data.warnings || []) + metricHtml + filterHint + table(["Sipariş", "Tip", "Müşteri", "Tutar", "Sipariş", "Ödeme", "Neden", "İşlem"], rows, "İade veya iptal kaydı bulunamadı.")
    );
  }

  function renderSupport(tickets) {
    const rows = tickets.map((ticket) => `
      <tr>
        <td>${titleCell(ticket.title, ticket.requester_label)}</td>
        <td>${badge(ticket.source)}</td>
        <td>${escape(ticket.category || "-")}</td>
        <td>${badge(ticket.priority || "normal")}</td>
        <td>${badge(ticket.status)}</td>
        <td>${dateTime(ticket.created_at)}</td>
        <td>
          <span class="admin-actions">
            <button class="admin-btn" type="button" data-detail="ticket" data-id="${escape(ticket.id)}" data-source="${escape(ticket.source)}">Detay</button>
            <button class="admin-btn" type="button" data-support-status="in_progress" data-id="${escape(ticket.id)}" data-source="${escape(ticket.source)}">İşlemde</button>
            <button class="admin-btn admin-btn--gold" type="button" data-support-status="resolved" data-id="${escape(ticket.id)}" data-source="${escape(ticket.source)}">Çözüldü</button>
          </span>
        </td>
      </tr>
    `);
    $("#adminContent").innerHTML = section(
      "Destek Talepleri",
      "Kullanıcı ve partner talepleri",
      warningPanel() + table(["Talep", "Kaynak", "Kategori", "Öncelik", "Durum", "Tarih", "İşlem"], rows, "Destek talebi bulunamadı.")
    );
  }

  function renderContent(payload) {
    const proposals = payload || [];
    const proposalRows = proposals.map((item) => `
      <tr>
        <td>${titleCell(item.title, item.summary)}</td>
        <td>${badge(item.content_scope)}</td>
        <td>${badge(item.status)}</td>
        <td>${escape(item.proposer?.full_name || item.proposed_by || "-")}</td>
        <td>${dateTime(item.created_at)}</td>
      </tr>
    `);
    const form = `
      <form data-content-form>
        <div class="admin-grid-3">
          <div class="admin-field">
            <label for="contentScope">Kapsam</label>
            <select id="contentScope" name="content_scope" required>
              <option value="home_module">Ana sayfa modülü</option>
              <option value="banner">Banner</option>
              <option value="campaign">Kampanya</option>
              <option value="page">Sayfa</option>
              <option value="legal">Yasal içerik</option>
            </select>
          </div>
          <div class="admin-field">
            <label for="contentTitle">Başlık</label>
            <input id="contentTitle" name="title" maxlength="180" required>
          </div>
          <div class="admin-field">
            <label for="contentKey">Referans</label>
            <input id="contentKey" name="reference" maxlength="120">
          </div>
        </div>
        <div class="admin-field" style="margin-top:12px">
          <label for="contentSummary">Öneri özeti</label>
          <textarea id="contentSummary" name="summary" maxlength="1600" required></textarea>
        </div>
        <div class="admin-form-actions">
          <button class="admin-btn admin-btn--primary" type="submit">Onaya Gönder</button>
        </div>
      </form>
    `;
    $("#adminContent").innerHTML = [
      section("İçerik Yönetimi", "Ana sayfa modülü, banner ve kampanya önerileri", warningPanel() + form),
      section("Onay Bekleyen İçerikler", "", table(["İçerik", "Kapsam", "Durum", "Admin", "Tarih"], proposalRows, "İçerik önerisi bulunamadı."))
    ].join("");
  }

  function renderSocialMedia(payload) {
    const social = payload || {};
    const accounts = social.accounts || [];
    const assets = social.assets || [];
    const drafts = social.drafts || [];
    const posts = social.posts || [];
    const attempts = social.attempts || [];
    const rules = social.rules || [];
    const plans = social.plans || [];
    const connections = social.connections || {};
    const vault = social.vault || {};
    const dispatch = social.dispatch || {};
    const postsByDraft = posts.reduce((acc, post) => {
      acc[post.draft_id] = acc[post.draft_id] || [];
      acc[post.draft_id].push(post);
      return acc;
    }, {});
    const latestAttempts = attempts.reduce((acc, attempt) => {
      if (!acc[attempt.post_id]) acc[attempt.post_id] = attempt;
      return acc;
    }, {});
    const metrics = [
      ["Aktif hesap", accounts.filter((item) => item.is_active).length],
      ["Hazır taslak", drafts.filter((item) => item.status === "ready_for_review").length],
      ["Planlı post", posts.filter((item) => ["approved", "scheduled", "queued"].includes(item.status)).length],
      ["Yayınlanan", posts.filter((item) => item.status === "published").length],
      ["Dry run", dispatch.dry_run ? "Açık" : "Kapalı"],
      ["Webhook", dispatch.webhook_configured ? "Hazır" : "Bekliyor"],
      ["Vault", vault.enabled ? "Aktif" : "Key bekliyor"],
      ["Günlük paket", dispatch.daily_drafts_enabled ? "Cron açık" : "Manuel"],
      [
        "Asset",
        dispatch.asset_webhook_configured
          ? "Webhook hazır"
          : dispatch.asset_generation_ready
            ? "Otomatik"
            : dispatch.asset_generation_enabled
              ? "Eksik ayar"
              : "Prompt"
      ]
    ];
    const metricGrid = `<div class="admin-metrics">${metrics.map(([label, value]) => `
      <div class="admin-metric"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>
    `).join("")}</div>`;
    const accountRows = accounts.map((account) => `
      <tr>
        <td>${titleCell(account.display_name, `@${account.handle}`)}</td>
        <td>${badge(account.platform)}</td>
        <td>${badge(account.connector_mode)}</td>
        <td>${badge(account.connection_status, account.connection_status === "connected" ? "green" : "")}</td>
        <td><a class="admin-link" href="${escape(account.account_url || "#")}" target="_blank" rel="noopener">Aç</a></td>
      </tr>
    `);
    const ruleRows = rules.map((rule) => `
      <tr>
        <td>${titleCell(rule.rule_key, rule.rule_label)}</td>
        <td>${badge(rule.is_enforced ? "enforced" : "paused", rule.is_enforced ? "green" : "orange")}</td>
        <td>${escape(rule.enforcement_layer || "-")}</td>
      </tr>
    `);
    const connectionRows = Object.values(connections).map((connection) => {
      const missing = connection.missing_required || [];
      const secretText = (connection.secrets || []).map((secret) => (
        `${secret.present ? "OK" : "Eksik"} ${secret.key}${secret.required ? "" : " (opsiyonel)"}`
      )).join(" / ");
      return `
        <tr>
          <td>${titleCell(connection.platform, secretText)}</td>
          <td>${badge(connection.ready ? "ready" : "missing", connection.ready ? "green" : "orange")}</td>
          <td>${escape(missing.length ? missing.join(", ") : "-")}</td>
          <td>${connection.ready ? `<button class="admin-btn" type="button" data-social-test="${escape(connection.platform)}">Test</button>` : ""}</td>
        </tr>
      `;
    });
    const draftRows = drafts.map((draft) => {
      const draftPosts = postsByDraft[draft.id] || [];
      const platformText = draftPosts.map((post) => post.platform).join(", ") || "-";
      const canSubmit = ["draft", "needs_changes"].includes(draft.status);
      const canApprove = ["ready_for_review", "draft", "approved", "scheduled"].includes(draft.status);
      return `
        <tr>
          <td>${titleCell(draft.title, draft.body)}</td>
          <td>${badge(draft.status)} ${badge(draft.uniqueness_status, draft.uniqueness_status === "unique" ? "green" : "orange")}</td>
          <td>${escape(platformText)}</td>
          <td>${dateTime(draft.scheduled_for || draft.created_at)}</td>
          <td>
            <span class="admin-actions">
              ${canSubmit ? `<button class="admin-btn" type="button" data-social-submit="${escape(draft.id)}">Onaya Gönder</button>` : ""}
              ${canApprove ? `<button class="admin-btn admin-btn--gold" type="button" data-social-approve="${escape(draft.id)}">Planlı Onayla</button>` : ""}
              ${canApprove ? `<button class="admin-btn admin-btn--primary" type="button" data-social-publish="${escape(draft.id)}">Şimdi Kuyruğa Al</button>` : ""}
            </span>
          </td>
        </tr>
      `;
    });
    const postRows = posts.slice(0, 120).map((post) => {
      const account = post.account || {};
      const attempt = latestAttempts[post.id];
      const canDispatch = ["approved", "scheduled", "queued", "failed"].includes(post.status);
      const payload = post.platform_payload || {};
      return `
        <tr>
          <td>${titleCell(post.platform, account.display_name || account.handle)}</td>
          <td>${titleCell(post.caption || "-", [payload.image_url ? "image" : "", payload.video_url ? "video" : "", payload.image_prompt ? "prompt" : ""].filter(Boolean).join(" / "))}</td>
          <td>${badge(post.status)}</td>
          <td>${dateTime(post.scheduled_for)}</td>
          <td>${attempt ? badge(attempt.status) : "-"}</td>
          <td>
            <span class="admin-actions">
              <button class="admin-btn" type="button" data-social-media="${escape(post.id)}">Medya</button>
              ${canDispatch ? `<button class="admin-btn" type="button" data-social-dispatch="${escape(post.id)}">Dispatch</button>` : ""}
            </span>
          </td>
        </tr>
      `;
    });
    const assetRows = assets.slice(0, 80).map((asset) => {
      const metadata = asset.metadata || {};
      const assetUrl = asset.asset_url || metadata.image_url || metadata.video_url || "";
      return `
        <tr>
          <td>${titleCell(asset.title, asset.prompt || asset.alt_text || "")}</td>
          <td>${badge(metadata.status || (assetUrl ? "url_ready" : "prompt_ready"), assetUrl ? "green" : "orange")}</td>
          <td>${escape((metadata.platforms || []).join(", ") || "-")}</td>
          <td>${assetUrl ? `<a class="admin-link" href="${escape(assetUrl)}" target="_blank" rel="noopener">Aç</a>` : "-"}</td>
        </tr>
      `;
    });
    const assetGenerationReady = Boolean(dispatch.asset_generation_ready);
    const assetPrepareHint = assetGenerationReady
      ? ""
      : statusBox(
          dispatch.asset_generation_enabled
            ? "Asset üretimi için provider secretı veya storage bucket ayarı eksik."
            : "Asset üretimi kapalı. Generator env ayarları yapılana kadar promptlar manuel asset olarak kalır."
        );
    const assetActions = `
      <div class="admin-form-actions">
        <button class="admin-btn admin-btn--gold" type="button" data-social-prepare-assets ${assetGenerationReady ? "" : "disabled"}>
          Eksik Assetleri Hazırla
        </button>
      </div>
    `;
    const planRows = plans.map((plan) => `
      <tr>
        <td>${titleCell(plan.plan_date, plan.summary)}</td>
        <td>${badge(plan.objective)}</td>
        <td>${badge(plan.status)}</td>
        <td>${escape((plan.target_platforms || []).join(", "))}</td>
      </tr>
    `);
    const draftForm = `
      <form data-social-draft-form>
        <div class="admin-grid-3">
          <div class="admin-field">
            <label for="socialTitle">Başlık</label>
            <input id="socialTitle" name="title" maxlength="180" required>
          </div>
          <div class="admin-field">
            <label for="socialTheme">Tema</label>
            <input id="socialTheme" name="content_theme" maxlength="220" value="AllonaHub ekosistem büyümesi" required>
          </div>
          <div class="admin-field">
            <label for="socialLanding">Link</label>
            <input id="socialLanding" name="landing_url" maxlength="700" value="https://allonahub.com">
          </div>
        </div>
        <div class="admin-grid-3" style="margin-top:12px">
          <div class="admin-field">
            <label for="socialHook">Hook</label>
            <input id="socialHook" name="hook" maxlength="400">
          </div>
          <div class="admin-field">
            <label for="socialCta">CTA</label>
            <input id="socialCta" name="cta" maxlength="400" value="AllonaHub'u keşfet">
          </div>
          <div class="admin-field">
            <label for="socialSchedule">Plan zamanı</label>
            <input id="socialSchedule" name="scheduled_for" type="datetime-local">
          </div>
        </div>
        <div class="admin-field" style="margin-top:12px">
          <label for="socialBody">Metin</label>
          <textarea id="socialBody" name="body" maxlength="4000" required></textarea>
        </div>
        <div class="admin-grid-3" style="margin-top:12px">
          <div class="admin-field">
            <label for="socialHashtags">Hashtag</label>
            <input id="socialHashtags" name="hashtags" maxlength="400" value="AllonaHub,AllonaShop,ekosistem">
          </div>
          <div class="admin-field">
            <label for="socialVisual">Görsel parmak izi</label>
            <input id="socialVisual" name="visual_fingerprint" maxlength="220">
          </div>
          <div class="admin-field">
            <label for="socialPostType">Format</label>
            <select id="socialPostType" name="post_type">
              <option value="feed">Feed</option>
              <option value="reel">Reel</option>
              <option value="short">Short</option>
              <option value="pin">Pin</option>
              <option value="text">Text</option>
              <option value="carousel">Carousel</option>
            </select>
          </div>
        </div>
        <div class="admin-grid-3" style="margin-top:12px">
          <div class="admin-field">
            <label for="socialImageUrl">Görsel URL</label>
            <input id="socialImageUrl" name="image_url" maxlength="900" placeholder="https://...">
          </div>
          <div class="admin-field">
            <label for="socialVideoUrl">Video URL</label>
            <input id="socialVideoUrl" name="video_url" maxlength="900" placeholder="https://...">
          </div>
          <div class="admin-field">
            <label for="socialPrivacy">Video gizlilik</label>
            <select id="socialPrivacy" name="privacy_status">
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </select>
          </div>
        </div>
        <div class="admin-grid-3" style="margin-top:12px">
          <div class="admin-field">
            <label for="socialWhatsappTo">WhatsApp hedefi</label>
            <input id="socialWhatsappTo" name="whatsapp_to" maxlength="40" placeholder="+905...">
          </div>
          <div class="admin-field">
            <label for="socialActionType">CTA tipi</label>
            <select id="socialActionType" name="action_type">
              <option value="LEARN_MORE">Learn more</option>
              <option value="SIGN_UP">Sign up</option>
              <option value="ORDER">Order</option>
              <option value="CALL">Call</option>
            </select>
          </div>
          <div class="admin-field">
            <label for="socialPayloadJson">Ek payload JSON</label>
            <input id="socialPayloadJson" name="platform_payload_json" maxlength="1600" placeholder='{"topic_type":"STANDARD"}'>
          </div>
        </div>
        <div class="admin-check-grid" style="margin-top:12px">${socialPlatformOptions()}</div>
        <div class="admin-form-actions">
          <button class="admin-btn admin-btn--primary" type="submit">Taslak Oluştur</button>
        </div>
      </form>
    `;
    const accountForm = `
      <form data-social-account-form>
        <div class="admin-grid-3">
          <div class="admin-field">
            <label for="socialAccountPlatform">Platform</label>
            <select id="socialAccountPlatform" name="platform">${socialPlatforms.map((item) => `<option value="${escape(item)}">${escape(item)}</option>`).join("")}</select>
          </div>
          <div class="admin-field">
            <label for="socialAccountHandle">Kullanıcı adı</label>
            <input id="socialAccountHandle" name="handle" maxlength="160" value="allonahub" required>
          </div>
          <div class="admin-field">
            <label for="socialAccountName">Görünen ad</label>
            <input id="socialAccountName" name="display_name" maxlength="160" value="AllonaHub" required>
          </div>
        </div>
        <div class="admin-grid-3" style="margin-top:12px">
          <div class="admin-field">
            <label for="socialAccountUrl">URL</label>
            <input id="socialAccountUrl" name="account_url" maxlength="500">
          </div>
          <div class="admin-field">
            <label for="socialConnectorMode">Connector</label>
            <select id="socialConnectorMode" name="connector_mode">
              <option value="pending">Pending</option>
              <option value="manual">Manual</option>
              <option value="server_webhook">Server webhook</option>
              <option value="native_api">Native API</option>
            </select>
          </div>
          <div class="admin-field">
            <label for="socialConnectionStatus">Bağlantı</label>
            <select id="socialConnectionStatus" name="connection_status">
              <option value="not_connected">Not connected</option>
              <option value="connected">Connected</option>
              <option value="needs_reauth">Needs reauth</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
        </div>
        <div class="admin-form-actions">
          <button class="admin-btn" type="submit">Hesabı Kaydet</button>
        </div>
      </form>
    `;
    const secretForm = `
      <form data-social-secret-form>
        <div class="admin-grid-3">
          <div class="admin-field">
            <label for="socialSecretPlatform">Platform</label>
            <select id="socialSecretPlatform" name="platform">${Object.keys(connections).map((item) => `<option value="${escape(item)}">${escape(item)}</option>`).join("")}</select>
          </div>
          <div class="admin-field">
            <label for="socialSecretKey">Secret anahtarı</label>
            <input id="socialSecretKey" name="secret_key" maxlength="90" placeholder="ACCESS_TOKEN" required>
          </div>
          <div class="admin-field">
            <label for="socialSecretValue">Secret değeri</label>
            <input id="socialSecretValue" name="secret_value" type="password" maxlength="16000" autocomplete="off" required>
          </div>
        </div>
        <div class="admin-form-actions">
          <button class="admin-btn admin-btn--gold" type="submit" ${vault.enabled ? "" : "disabled"}>Secret Kaydet / Döndür</button>
        </div>
      </form>
    `;
    const planForm = `
      <form data-social-plan-form>
        <div class="admin-grid-3">
          <div class="admin-field">
            <label for="socialPlanDate">Tarih</label>
            <input id="socialPlanDate" name="plan_date" type="date" required>
          </div>
          <div class="admin-field">
            <label for="socialPlanObjective">Hedef</label>
            <input id="socialPlanObjective" name="objective" maxlength="80" value="growth" required>
          </div>
          <div class="admin-field">
            <label for="socialPlanSummary">Özet</label>
            <input id="socialPlanSummary" name="summary" maxlength="900">
          </div>
        </div>
        <div class="admin-check-grid" style="margin-top:12px">${socialPlatformOptions()}</div>
        <div class="admin-form-actions">
          <button class="admin-btn" type="submit">Günlük Planı Kaydet</button>
          <button class="admin-btn admin-btn--gold" type="button" data-social-dispatch-due>Planlı Kuyruğu Çalıştır</button>
        </div>
      </form>
    `;
    const packageForm = `
      <form data-social-package-form>
        <div class="admin-grid-3">
          <div class="admin-field">
            <label for="socialPackageDate">Paket tarihi</label>
            <input id="socialPackageDate" name="plan_date" type="date">
          </div>
          <div class="admin-field">
            <label for="socialPackageObjective">Hedef</label>
            <input id="socialPackageObjective" name="objective" maxlength="80" value="growth">
          </div>
          <div class="admin-field">
            <label for="socialPackageLanding">Landing link</label>
            <input id="socialPackageLanding" name="landing_url" maxlength="700" value="https://allonahub.com/">
          </div>
        </div>
        <div class="admin-check-grid" style="margin-top:12px">${socialPlatformOptions("instagram,facebook,threads,x,linkedin,tiktok,youtube,pinterest,nsosyal")}</div>
        <div class="admin-form-actions">
          <button class="admin-btn admin-btn--primary" type="submit">Günlük Paketi Oluştur</button>
        </div>
      </form>
    `;

    $("#adminContent").innerHTML = [
      section("Sosyal Medya Merkezi", "Taslak, onay, tekrar engeli ve çoklu platform kuyruğu", warningPanel() + metricGrid),
      `<div class="admin-split">
        ${section("Yeni Taslak", "", draftForm)}
        ${section("Otomatik Günlük Paket", "", packageForm)}
      </div>`,
      section("Günlük Plan", "", planForm),
      `<div class="admin-split">
        ${section("Hesap Envanteri", "", accountForm + table(["Hesap", "Platform", "Connector", "Bağlantı", "URL"], accountRows, "Hesap bulunamadı."))}
        ${section("Bağlantı Secretleri", "", secretForm + table(["Platform", "Durum", "Eksik Zorunlu", "Test"], connectionRows, "Bağlantı tanımı bulunamadı."))}
      </div>`,
      section("Görsel / Video Assetleri", "", assetPrepareHint + assetActions + table(["Asset", "Durum", "Platform", "URL"], assetRows, "Asset kaydı bulunamadı.")),
      section("Kurallar", "", table(["Kural", "Durum", "Katman"], ruleRows, "Kural bulunamadı.")),
      section("Taslaklar", "", table(["İçerik", "Durum", "Platform", "Tarih", "İşlem"], draftRows, "Taslak bulunamadı.")),
      section("Platform Kuyruğu", "", table(["Platform", "Caption", "Durum", "Plan", "Son Deneme", "İşlem"], postRows, "Platform postu bulunamadı.")),
      section("Günlük Planlar", "", table(["Tarih", "Hedef", "Durum", "Platform"], planRows, "Günlük plan bulunamadı."))
    ].join("");
  }

  function renderSecurity(payload) {
    const events = payload?.events || [];
    const flags = payload?.flags || [];
    const notifications = payload?.notifications || [];
    const eventRows = events.map((item) => `
      <tr>
        <td>${titleCell(item.action, item.resource_type || item.source)}</td>
        <td>${badge(item.severity)}</td>
        <td>${escape(item.ip_address || "-")}</td>
        <td>${dateTime(item.created_at)}</td>
      </tr>
    `);
    const flagRows = flags.map((item) => `
      <tr>
        <td>${titleCell(item.flag_type, item.reason)}</td>
        <td>${badge(item.target_type)}</td>
        <td>${badge(item.severity)}</td>
        <td>${badge(item.status)}</td>
        <td>${dateTime(item.created_at)}</td>
      </tr>
    `);
    const notificationList = notifications.length ? `
      <div class="admin-list">${notifications.slice(0, 12).map((item) => `
        <div class="admin-list-item">
          <strong>${badge(item.severity)} ${escape(item.title)}</strong>
          <p>${escape(item.message)}</p>
          <p>${escape(dateTime(item.created_at))}</p>
        </div>
      `).join("")}</div>
    ` : statusBox("Bildirim bulunamadı.");
    $("#adminContent").innerHTML = [
      section("Güvenlik İzleme", "Başarısız girişler, risk işaretleri ve sistem uyarıları", warningPanel()),
      `<div class="admin-split">
        ${section("Audit Uyarıları", "", table(["Aksiyon", "Risk", "IP", "Tarih"], eventRows, "Güvenlik olayı bulunamadı."))}
        ${section("Admin Bildirimleri", "", notificationList)}
      </div>`,
      section("Açık Risk İşaretleri", "", table(["İşaret", "Hedef", "Risk", "Durum", "Tarih"], flagRows, "Açık risk işareti bulunamadı."))
    ].join("");
  }

  function renderReports(reports) {
    const groups = reports || {};
    const tiles = Object.entries(groups).map(([key, value]) => `
      <div class="admin-list-item">
        <strong>${escape(key.replace(/_/g, " "))}</strong>
        <p>${Object.entries(value || {}).map(([itemKey, itemValue]) => `${escape(itemKey.replace(/_/g, " "))}: ${escape(itemValue)}`).join("<br>")}</p>
      </div>
    `).join("");
    $("#adminContent").innerHTML = section(
      "Raporlama",
      "Günlük operasyon, partner başvuru, sipariş, kullanıcı aktivite ve destek raporu",
      warningPanel() + `<div class="admin-grid-3">${tiles || statusBox("Rapor verisi bulunamadı.")}</div>`
    );
  }

  function renderAudit(events) {
    const rows = events.map((event) => `
      <tr>
        <td>${titleCell(event.action, event.resource_type || "-")}</td>
        <td>${escape(event.actor_role || "-")}</td>
        <td>${badge(event.severity)}</td>
        <td>${escape(event.resource_id || "-")}</td>
        <td>${escape(event.ip_address || "-")}</td>
        <td>${dateTime(event.created_at)}</td>
      </tr>
    `);
    $("#adminContent").innerHTML = section(
      "Audit Log",
      "Admin Panel işlemleri ve görüntüleme kayıtları",
      warningPanel() + table(["İşlem", "Rol", "Risk", "Kayıt", "IP", "Tarih"], rows, "Audit kaydı bulunamadı.")
    );
  }

  function renderObjectDetails(title, record) {
    const value = record || {};
    const rows = Object.entries(value)
      .filter(([, item]) => item === null || ["string", "number", "boolean"].includes(typeof item))
      .slice(0, 34)
      .map(([key, item]) => `<div><dt>${escape(key)}</dt><dd>${escape(item ?? "-")}</dd></div>`)
      .join("");
    $("#adminDrawerTitle").textContent = title;
    $("#adminDrawerBody").innerHTML = rows ? `<dl class="admin-kv">${rows}</dl>` : statusBox("Detay verisi yok.");
    $("#adminDrawer").classList.add("is-open");
  }

  function applicationDecisionMarkup(application, notes = [], approvalRequests = []) {
    const item = application || {};
    const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
    const canDecide = ["admin", "super_admin"].includes(String(state.profile?.role || "").toLowerCase());
    const rows = [
      ["Firma", item.company_name || "-"],
      ["Yetkili", item.contact_name || "-"],
      ["E-posta", item.email || "-"],
      ["Telefon", item.phone || "-"],
      ["Vergi No", item.tax_number || "-"],
      ["Durum", item.status || "-"],
      ["İnceleme", item.review_stage || "-"],
      ["Admin önerisi", item.admin_recommendation || "-"],
      ["Risk", item.risk_level || "-"],
      ["Kategori", metadata.category || item.category || "-"],
      ["Mesaj", metadata.message || item.message || "-"],
      ["Tarih", dateTime(item.created_at)]
    ].map(([key, value]) => `<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join("");
    const noteRows = (notes || []).slice(0, 5).map((note) => `<li>${escape(dateTime(note.created_at))}: ${escape(note.body || "-")}</li>`).join("");
    const requestRows = (approvalRequests || []).slice(0, 5).map((request) => `<li>${escape(request.status || "-")} / ${escape(request.summary || "-")}</li>`).join("");
    const actionButtons = canDecide
      ? `
        <button class="admin-btn admin-btn--gold" type="button" data-application-final-decision="approved" data-id="${escape(item.id)}">Onayla ve Aktif Et</button>
        <button class="admin-btn admin-btn--danger" type="button" data-application-final-decision="rejected" data-id="${escape(item.id)}">Reddet</button>
        <button class="admin-btn" type="button" data-application-final-decision="review" data-id="${escape(item.id)}">İncelemeye Al</button>
      `
      : `
        <button class="admin-btn" type="button" data-application-action="start_review" data-id="${escape(item.id)}">İncelemeye Al</button>
        <button class="admin-btn admin-btn--gold" type="button" data-application-action="send_super_admin" data-id="${escape(item.id)}">Super Admin Onayına Gönder</button>
        <button class="admin-btn admin-btn--danger" type="button" data-application-action="recommend_reject" data-id="${escape(item.id)}">Ret Öner</button>
      `;
    return `
      <dl class="admin-kv">${rows}</dl>
      ${noteRows ? `<h3>İnceleme notları</h3><ul>${noteRows}</ul>` : ""}
      ${requestRows ? `<h3>Onay kayıtları</h3><ul>${requestRows}</ul>` : ""}
      <div class="admin-actions">${actionButtons}</div>
    `;
  }

  function closeDrawer() {
    $("#adminDrawer")?.classList.remove("is-open");
  }

  function fieldMarkup(field) {
    if (field.type === "select") {
      return `
        <div class="admin-field">
          <label for="modal-${escape(field.id)}">${escape(field.label)}</label>
          <select id="modal-${escape(field.id)}" name="${escape(field.id)}" ${field.required ? "required" : ""}>
            ${(field.options || []).map((option) => `<option value="${escape(option.value)}">${escape(option.label)}</option>`).join("")}
          </select>
        </div>
      `;
    }
    if (field.type === "textarea") {
      return `
        <div class="admin-field">
          <label for="modal-${escape(field.id)}">${escape(field.label)}</label>
          <textarea id="modal-${escape(field.id)}" name="${escape(field.id)}" maxlength="${escape(field.max || 1600)}" ${field.required ? "required" : ""}>${escape(field.value || "")}</textarea>
        </div>
      `;
    }
    return `
      <div class="admin-field">
        <label for="modal-${escape(field.id)}">${escape(field.label)}</label>
        <input id="modal-${escape(field.id)}" name="${escape(field.id)}" type="${escape(field.inputType || "text")}" maxlength="${escape(field.max || 180)}" value="${escape(field.value || "")}" ${field.required ? "required" : ""}>
      </div>
    `;
  }

  function openModal(options) {
    const modal = $("#adminModal");
    const form = $("#adminModalForm");
    $("#adminModalTitle").textContent = options.title || "Onay";
    $("#adminModalBody").innerHTML = `
      ${options.message ? `<p>${escape(options.message)}</p>` : ""}
      ${(options.fields || []).map(fieldMarkup).join("")}
    `;
    $("#adminModalConfirm").textContent = options.confirmText || "Onayla";
    $("#adminModalConfirm").classList.toggle("admin-btn--danger", Boolean(options.danger));
    $("#adminModalConfirm").classList.toggle("admin-btn--primary", !options.danger);
    modal.classList.add("is-open");

    return new Promise((resolve) => {
      const cleanup = () => {
        modal.classList.remove("is-open");
        form.onsubmit = null;
        $("#adminModalCancel").onclick = null;
      };
      $("#adminModalCancel").onclick = () => {
        cleanup();
        resolve(null);
      };
      form.onsubmit = (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        cleanup();
        resolve(data);
      };
    });
  }

  async function loadDashboard() {
    const data = await api("/v1/ops-console/dashboard");
    state.dashboard = data.dashboard;
    state.cache.automation = data.dashboard?.automation || state.cache.automation;
    state.warnings = data.warnings || [];
    renderNav();
    renderDashboard(data.dashboard);
  }

  async function loadAutomation() {
    const data = await api("/v1/ops-console/automation?limit=80");
    state.cache.automation = data.automation || { summary: {}, queues: {}, rules: [] };
    state.warnings = data.warnings || [];
    renderAutomationCenter(state.cache.automation);
  }

  async function loadUsers() {
    const data = await api(`/v1/ops-console/users?${queryParams()}`);
    state.cache.users = data.users || [];
    state.warnings = data.warnings || [];
    renderUsers(state.cache.users);
  }

  async function loadApplications() {
    try {
      const data = await api(`/v1/ops-console/partner-applications?${queryParams()}`);
      state.cache.applications = data.applications || [];
      state.warnings = data.warnings || [];
      renderApplications(state.cache.applications);
    } catch (error) {
      const fallbackReason = partnerApplicationsFallbackReason(error);
      if (!fallbackReason) throw error;
      console.warn("[AdminOps] partner applications API fallback active", error);
      state.cache.applications = await listApplicationsFromSupabase();
      state.warnings = [fallbackReason];
      renderApplications(state.cache.applications);
    }
  }

  async function loadPartners() {
    const data = await api(`/v1/ops-console/partners?${queryParams()}`);
    state.cache.partners = data.partners || [];
    state.warnings = data.warnings || [];
    renderPartners(state.cache.partners);
  }

  async function loadIntegrations() {
    const data = await api(`/v1/ops-console/integrations?${queryParams()}`);
    state.cache.integrations = data || {};
    state.warnings = data.warnings || [];
    renderIntegrations(data);
  }

  async function loadOrders() {
    const data = await api(`/v1/ops-console/orders?${queryParams()}`);
    state.cache.orders = data.orders || [];
    state.warnings = data.warnings || [];
    renderOrders(state.cache.orders);
  }

  async function loadRefunds() {
    const params = new URLSearchParams();
    const search = $("#adminGlobalSearch")?.value?.trim() || "";
    const status = $("#adminGlobalStatus")?.value || "";
    if (search) params.set("search", search);
    if (["cancelled", "refunded", "pending_signal"].includes(status)) params.set("status", status);
    params.set("limit", "100");
    const data = await api(`/v1/ops-console/refund-cancellations?${params.toString()}`);
    state.cache.refunds = data.items || [];
    state.warnings = data.warnings || [];
    renderRefunds(data);
  }

  async function loadProductReviews() {
    const params = new URLSearchParams();
    const search = $("#adminGlobalSearch")?.value?.trim() || "";
    if (search) params.set("search", search);
    params.set("limit", "120");
    const data = await api(`/v1/ops-console/product-reviews?${params.toString()}`);
    state.cache.productReviews = data.products || [];
    state.warnings = data.warnings || [];
    renderProductReviews(state.cache.productReviews);
  }

  async function loadSupport() {
    const data = await api(`/v1/ops-console/support-tickets?${queryParams()}`);
    state.cache.tickets = data.tickets || [];
    state.warnings = data.warnings || [];
    renderSupport(state.cache.tickets);
  }

  async function loadContent() {
    const data = await api("/v1/ops-console/content-proposals");
    state.cache.proposals = data.proposals || [];
    state.warnings = data.warnings || [];
    renderContent(state.cache.proposals);
  }

  async function loadSocialMedia() {
    const data = await api(`/v1/ops-console/social-media?${queryParams()}`);
    state.cache.social = data.social || {};
    state.warnings = data.warnings || [];
    renderSocialMedia(state.cache.social);
  }

  async function loadSecurity() {
    const data = await api("/v1/ops-console/security-monitoring");
    state.cache.security = data;
    state.warnings = data.warnings || [];
    renderSecurity(data);
  }

  async function loadReports() {
    const data = await api("/v1/ops-console/reports");
    state.cache.reports = data.reports || {};
    state.warnings = data.warnings || [];
    renderReports(state.cache.reports);
  }

  async function loadAudit() {
    const data = await api("/v1/ops-console/audit-log");
    state.cache.audit = data.events || [];
    state.warnings = data.warnings || [];
    renderAudit(state.cache.audit);
  }

  async function loadView(view) {
    state.view = view || state.view;
    setActiveNav();
    setLoading(`${views[state.view].label} yükleniyor...`);
    try {
      if (state.view === "dashboard") await loadDashboard();
      if (state.view === "automation") await loadAutomation();
      if (state.view === "users") await loadUsers();
      if (state.view === "applications") await loadApplications();
      if (state.view === "partners") await loadPartners();
      if (state.view === "integrations") await loadIntegrations();
      if (state.view === "orders") await loadOrders();
      if (state.view === "refunds") await loadRefunds();
      if (state.view === "productReviews") await loadProductReviews();
      if (state.view === "content") await loadContent();
      if (state.view === "social") await loadSocialMedia();
      if (state.view === "support") await loadSupport();
      if (state.view === "security") await loadSecurity();
      if (state.view === "reports") await loadReports();
      if (state.view === "audit") await loadAudit();
      renderNav();
    } catch (error) {
      console.error("[AdminOps] view load failed", state.view, error);
      $("#adminContent").innerHTML = statusBox(readableError(error), "error");
    }
  }

  async function showDetail(type, id, source) {
    try {
      if (type === "user") {
        const data = await api(`/v1/ops-console/users/${encodeURIComponent(id)}`);
        renderObjectDetails("Kullanıcı Detayı", data.profile);
      } else if (type === "application") {
        try {
          const data = await api(`/v1/ops-console/partner-applications/${encodeURIComponent(id)}`);
          $("#adminDrawerTitle").textContent = "Başvuru Detayı";
          $("#adminDrawerBody").innerHTML = applicationDecisionMarkup(data.application, data.notes, data.approvalRequests);
          $("#adminDrawer").classList.add("is-open");
        } catch (error) {
          const fallbackReason = partnerApplicationsFallbackReason(error);
          if (!fallbackReason) throw error;
          console.warn("[AdminOps] partner application detail fallback active", error);
          $("#adminDrawerTitle").textContent = "Başvuru Detayı";
          $("#adminDrawerBody").innerHTML = applicationDecisionMarkup(await getApplicationFromSupabase(id));
          $("#adminDrawer").classList.add("is-open");
        }
      } else if (type === "order") {
        const data = await api(`/v1/ops-console/orders/${encodeURIComponent(id)}`);
        renderObjectDetails("Sipariş Detayı", data.order);
      } else if (type === "product-review") {
        const item = state.cache.productReviews.find((product) => String(product.id) === String(id));
        renderObjectDetails("Ürün Onay Detayı", item);
      } else if (type === "partner") {
        const item = state.cache.partners.find((partner) => partner.id === id);
        renderObjectDetails("Partner Detayı", item);
      } else if (type === "ticket") {
        const item = state.cache.tickets.find((ticket) => ticket.id === id && ticket.source === source);
        renderObjectDetails("Destek Talebi", item);
      }
    } catch (error) {
      showToast(error.message || "Detay açılamadı.", "error");
    }
  }

  async function showApplicationDecision(applicationId) {
    await showDetail("application", applicationId);
  }

  function showRefundTicketDetail(ticketId) {
    const item = (state.cache.refunds || []).find((entry) => String(entry.ticket_id || entry.id) === String(ticketId) || String(entry.id) === `ticket:${ticketId}`);
    const ticket = item?.tickets?.[0];
    if (!ticket) {
      showToast("Destek sinyali detayı bulunamadı.", "error");
      return;
    }
    $("#adminDrawerTitle").textContent = "İade / İptal Destek Sinyali";
    $("#adminDrawerBody").innerHTML = `
      <dl class="admin-kv">
        <div><dt>Başlık</dt><dd>${escape(ticket.title || "-")}</dd></div>
        <div><dt>Durum</dt><dd>${escape(ticket.status || "-")} / ${escape(ticket.priority || "-")} / ${escape(ticket.category || "-")}</dd></div>
        <div><dt>Talep sahibi</dt><dd>${escape(item.customer_name || "-")} / ${escape(item.customer_email || "-")} / ${escape(item.customer_phone || "-")}</dd></div>
        <div><dt>Açıklama</dt><dd>${escape(ticket.message || "-")}</dd></div>
        <div><dt>Metadata</dt><dd>${escape(JSON.stringify(ticket.metadata || {}).slice(0, 900))}</dd></div>
        <div><dt>Tarih</dt><dd>${dateTime(ticket.created_at)} / ${dateTime(ticket.updated_at)}</dd></div>
      </dl>
    `;
    $("#adminDrawer").classList.add("is-open");
  }

  async function showRefundDetail(orderId) {
    const payload = await api(`/v1/ops-console/refund-cancellations/${encodeURIComponent(orderId)}`);
    const item = payload.item || {};
    const noteRows = (item.notes || []).slice(0, 8).map((note) => `
      <div class="admin-list-item">
        <strong>${escape(note.note_type || "not")} / ${dateTime(note.created_at)}</strong>
        <p>${escape(note.body || "-")}</p>
      </div>
    `).join("");
    const flagRows = (item.flags || []).slice(0, 8).map((flag) => `
      <div class="admin-list-item">
        <strong>${badge(flag.severity || "warning")} ${escape(flag.flag_type || "flag")} / ${escape(flag.status || "-")}</strong>
        <p>${escape(flag.reason || "-")}</p>
      </div>
    `).join("");
    const ticketRows = (item.tickets || []).slice(0, 6).map((ticket) => `
      <div class="admin-list-item">
        <strong>${escape(ticket.title || "Destek sinyali")} / ${escape(ticket.status || "-")}</strong>
        <p>${escape(shortText(ticket.message || "-", 280))}</p>
      </div>
    `).join("");
    const productRows = (item.order_items || []).slice(0, 12).map((row) => `
      <tr>
        <td>${escape(row.product?.name || row.name || row.product_id || "Ürün")}</td>
        <td>${escape(row.quantity || 1)}</td>
        <td>${money(row.price || row.unit_price || 0)}</td>
        <td>${escape(row.partner_id || row.product?.partner_id || "-")}</td>
      </tr>
    `);

    $("#adminDrawerTitle").textContent = "İade / İptal Detayı";
    $("#adminDrawerBody").innerHTML = `
      <dl class="admin-kv">
        <div><dt>Sipariş</dt><dd>${escape(item.order_no || item.id || "-")} / ${escape(refundTypeLabel(item.type))}</dd></div>
        <div><dt>Müşteri</dt><dd>${escape(item.customer_name || "-")} / ${escape(item.customer_email || "-")} / ${escape(item.customer_phone || "-")}</dd></div>
        <div><dt>Tutar</dt><dd>${money(item.total)} / sipariş ${escape(item.order_status || "-")} / ödeme ${escape(item.payment_status || "-")}</dd></div>
        <div><dt>Neden / açıklama</dt><dd>${escape(item.reason || "Kayıtlarda neden bulunamadı; karar öncesi destek ve not kayıtlarını kontrol et.")}</dd></div>
        <div><dt>Tarih</dt><dd>${dateTime(item.created_at)} / ${dateTime(item.updated_at)}</dd></div>
      </dl>
      <div class="admin-actions" style="margin:12px 0">
        <button class="admin-btn" type="button" data-refund-action="mark_review" data-id="${escape(item.id)}">İncelemeye al</button>
        <button class="admin-btn admin-btn--gold" type="button" data-refund-action="approve_cancellation" data-id="${escape(item.id)}">İptali onayla</button>
        <button class="admin-btn admin-btn--gold" type="button" data-refund-action="approve_refund" data-id="${escape(item.id)}">İadeyi onayla</button>
        <button class="admin-btn admin-btn--danger" type="button" data-refund-action="reject_request" data-id="${escape(item.id)}">Talebi reddet</button>
        <button class="admin-btn" type="button" data-refund-action="add_note" data-id="${escape(item.id)}">Not ekle</button>
      </div>
      ${table(["Ürün", "Adet", "Tutar", "Partner"], productRows, "Ürün kalemi bulunamadı.")}
      <div class="admin-split" style="margin-top:14px">
        ${section("Operasyon notları", "", noteRows ? `<div class="admin-list">${noteRows}</div>` : statusBox("Operasyon notu yok."))}
        ${section("Risk / işlem flagleri", "", flagRows ? `<div class="admin-list">${flagRows}</div>` : statusBox("Flag kaydı yok."))}
      </div>
      ${section("Destek sinyalleri", "", ticketRows ? `<div class="admin-list">${ticketRows}</div>` : statusBox("Bu siparişle eşleşen destek sinyali yok."))}
      ${warningPanel(payload.warnings || [])}
    `;
    $("#adminDrawer").classList.add("is-open");
  }

  async function createUserNote(userId) {
    const data = await openModal({
      title: "Kullanıcı Notu",
      message: "Not audit log'a kaydedilecek.",
      confirmText: "Not Ekle",
      fields: [
        { id: "note_type", label: "Not tipi", type: "select", options: [
          { value: "general", label: "Genel" },
          { value: "risk", label: "Risk" },
          { value: "review", label: "İnceleme" }
        ] },
        { id: "body", label: "Not", type: "textarea", required: true }
      ]
    });
    if (!data) return;
    await api(`/v1/ops-console/users/${encodeURIComponent(userId)}/notes`, { method: "POST", body: data });
    showToast("Kullanıcı notu eklendi.");
    await loadUsers();
  }

  async function flagUser(userId) {
    const data = await openModal({
      title: "Şüpheli Kullanıcı İşareti",
      message: "Bu işlem kullanıcıyı silmez veya rol değiştirmez; yalnızca operasyonel risk işareti oluşturur.",
      confirmText: "İşaretle",
      danger: true,
      fields: [
        { id: "severity", label: "Risk", type: "select", options: [
          { value: "warning", label: "Warning" },
          { value: "critical", label: "Critical" },
          { value: "info", label: "Info" }
        ] },
        { id: "reason", label: "Gerekçe", type: "textarea", required: true }
      ]
    });
    if (!data) return;
    await api(`/v1/ops-console/users/${encodeURIComponent(userId)}/flag`, { method: "POST", body: data });
    showToast("Şüpheli kullanıcı işareti oluşturuldu.");
    await loadUsers();
  }

  async function partnerApplicationAction(applicationId, action) {
    const labels = {
      start_review: "İncelemeye Al",
      recommend_approve: "Onay Öner",
      recommend_reject: "Ret Öner",
      send_super_admin: "Super Admin Onayına Gönder"
    };
    const data = await openModal({
      title: labels[action] || "Başvuru İşlemi",
      message: "Nihai onay veya ret Super Admin alanında verilir.",
      confirmText: labels[action] || "Onayla",
      danger: action === "recommend_reject",
      fields: [
        { id: "risk_level", label: "Risk", type: "select", options: [
          { value: "info", label: "Info" },
          { value: "warning", label: "Warning" },
          { value: "critical", label: "Critical" }
        ] },
        { id: "reason", label: "Gerekçe", type: "textarea", required: true }
      ]
    });
    if (!data) return;
    const payload = { action, risk_level: data.risk_level, reason: data.reason };
    try {
      try {
        await api("/v1/ops-console/partner-application-reviews", {
          method: "POST",
          body: { application_id: applicationId, ...payload }
        });
      } catch (error) {
        if (!apiRouteMissing(error)) throw error;
        await api(`/v1/ops-console/partner-applications/${encodeURIComponent(applicationId)}/review`, {
          method: "PATCH",
          body: payload
        });
      }
    } catch (error) {
      const fallbackReason = partnerApplicationsFallbackReason(error);
      if (!fallbackReason) throw error;
      console.warn("[AdminOps] partner application review fallback active", error);
      await updateApplicationReviewFromSupabase(applicationId, payload);
      state.warnings = [fallbackReason];
    }
    showToast("Başvuru inceleme kaydı oluşturuldu.");
    await loadApplications();
    await showApplicationDecision(applicationId).catch(() => null);
  }

  async function finalPartnerApplicationDecision(applicationId, decision) {
    const labels = {
      approved: "Onayla ve Aktif Et",
      rejected: "Reddet",
      review: "İncelemeye Al"
    };
    const data = await openModal({
      title: `Partner Başvuru Kararı: ${labels[decision] || decision}`,
      message: decision === "approved"
        ? "Admin onayıyla partner hesabı, profil rolü ve aktif partner mağazası oluşturulacak."
        : "Karar audit log'a yazılacak.",
      confirmText: labels[decision] || "Kararı Kaydet",
      danger: decision === "rejected",
      fields: [
        { id: "reason", label: "Karar gerekçesi", type: "textarea", required: decision !== "review", max: 1200 }
      ]
    });
    if (!data) return;
    const decisionPayload = {
      application_id: applicationId,
      decision,
      reason: data.reason || labels[decision] || "Partner başvuru kararı",
      commission_rate: 0.12,
      store_status: decision === "approved" ? "active" : "review"
    };
    let result = null;
    try {
      result = await api("/v1/ops-console/partner-application-decisions", {
        method: "POST",
        body: decisionPayload
      });
    } catch (error) {
      if (!apiRouteMissing(error)) throw error;
      try {
        result = await api("/v1/control-center/partner-application-decisions", {
          method: "POST",
          body: decisionPayload
        });
      } catch (controlError) {
        if (!apiRouteMissing(controlError)) throw controlError;
        const { application_id: _applicationId, ...legacyPayload } = decisionPayload;
        result = await api(`/v1/control-center/partner-applications/${encodeURIComponent(applicationId)}`, {
          method: "PATCH",
          body: legacyPayload
        });
      }
    }
    const business = result.partner_business || {};
    const auth = result.activation?.auth || {};
    showToast(decision === "approved" ? "Partner onaylandı ve aktif edildi." : "Partner kararı kaydedildi.");
    $("#adminDrawerTitle").textContent = "Partner Kararı";
    $("#adminDrawerBody").innerHTML = `
      <dl class="admin-kv">
        <div><dt>Başvuru</dt><dd>${escape(result.application?.company_name || applicationId)}</dd></div>
        <div><dt>Durum</dt><dd>${escape(result.application?.status || decision)}</dd></div>
        <div><dt>Partner mağazası</dt><dd>${escape(business.display_name || "-")} / ${escape(business.status || "-")}</dd></div>
        <div><dt>Auth kullanıcısı</dt><dd>${escape(auth.email || result.application?.email || "-")} / ${escape(auth.user_id || "-")}</dd></div>
        <div><dt>Erişim maili</dt><dd>${escape(partnerAccessEmailStatus(auth))}</dd></div>
        <div><dt>Partner paneli</dt><dd><a href="https://partner.allonahub.com/" target="_blank" rel="noopener">partner.allonahub.com</a></dd></div>
      </dl>
      ${decision === "approved" ? `
        <div class="admin-status">
          Bu başvuru approved statüsüne geçtiği için bekleyen başvuru filtresinden çıkabilir. Aktif kayıt Partner Operasyonları listesinde takip edilir.
        </div>
        <div class="admin-actions">
          <button class="admin-btn admin-btn--primary" type="button" data-admin-view="partners">Aktif Partnerleri Aç</button>
          <button class="admin-btn" type="button" data-admin-view="applications">Başvuruları Aç</button>
        </div>
      ` : ""}
    `;
    $("#adminDrawer").classList.add("is-open");
    await loadApplications();
  }

  async function flagOrder(orderId) {
    const data = await openModal({
      title: "Riskli Sipariş İşareti",
      message: "Sipariş durumu veya ödeme bilgisi değiştirilmez.",
      confirmText: "Riskli İşaretle",
      danger: true,
      fields: [
        { id: "severity", label: "Risk", type: "select", options: [
          { value: "warning", label: "Warning" },
          { value: "critical", label: "Critical" },
          { value: "info", label: "Info" }
        ] },
        { id: "reason", label: "Gerekçe", type: "textarea", required: true }
      ]
    });
    if (!data) return;
    await api(`/v1/ops-console/orders/${encodeURIComponent(orderId)}/risk-flag`, { method: "POST", body: data });
    showToast("Sipariş risk işareti oluşturuldu.");
    await loadOrders();
  }

  async function updateSupportStatus(ticketId, source, status) {
    const data = await openModal({
      title: "Destek Talebi Durumu",
      message: `Talep durumu "${normalizeStatus(status)}" yapılacak.`,
      confirmText: "Güncelle",
      fields: [
        { id: "note", label: "İşlem notu", type: "textarea", required: false }
      ]
    });
    if (!data) return;
    await api(`/v1/ops-console/support-tickets/${encodeURIComponent(ticketId)}/status`, {
      method: "PATCH",
      body: { source, status, note: data.note || "" }
    });
    showToast("Destek talebi güncellendi.");
    await loadSupport();
  }

  async function runRefundAction(orderId, action) {
    const label = refundActionLabel(action);
    const item = (state.cache.refunds || []).find((entry) => String(entry.id) === String(orderId));
    const data = await openModal({
      title: `İade / İptal - ${label}`,
      message: `${item?.order_no || orderId} için "${label}" işlemi uygulanacak. Tüm kararlar audit log'a yazılır.`,
      confirmText: label,
      danger: action === "reject_request" || action === "approve_refund",
      fields: [
        { id: "reason", label: "İşlem gerekçesi", type: "textarea", required: true, max: 1200 },
        { id: "note", label: "Ek açıklama", type: "textarea", required: false, max: 1200, value: label }
      ]
    });
    if (!data) return;
    const result = await api(`/v1/ops-console/refund-cancellations/${encodeURIComponent(orderId)}/action`, {
      method: "POST",
      body: {
        action,
        reason: data.reason,
        note: data.note || ""
      }
    });
    showToast("İade / iptal aksiyonu kaydedildi.");
    if (result.item) {
      await showRefundDetail(orderId).catch(() => null);
    }
    await loadRefunds();
  }

  async function runProductReviewAction(productId, decision) {
    const item = state.cache.productReviews.find((product) => String(product.id) === String(productId));
    const labels = {
      approved: "Yayına Al",
      needs_review: "Revizyon İste",
      rejected: "Reddet"
    };
    const data = await openModal({
      title: `Ürün Kararı: ${labels[decision] || decision}`,
      message: `${item?.name || item?.product_name || productId} için karar kaydedilecek. Satıcı, fatura, teslimat ve yasaklı ürün uygunluğu kontrol edilmiş olmalı.`,
      confirmText: labels[decision] || "Kaydet",
      danger: decision === "rejected",
      fields: [
        { id: "reason", label: "Karar notu", type: "textarea", required: true, max: 1200 }
      ]
    });
    if (!data) return;

    const result = await api(`/v1/ops-console/product-reviews/${encodeURIComponent(productId)}/decision`, {
      method: "POST",
      body: {
        decision,
        reason: data.reason || ""
      }
    });

    if (App.complianceAudit) {
      await App.complianceAudit.record({
        category: "product",
        action: "admin_product_compliance_decision",
        severity: decision === "approved" ? "info" : "warning",
        resourceType: "product",
        resourceId: productId,
        evidenceTags: ["admin_ops", "product_compliance", decision],
        metadata: {
          decision,
          status: result.product?.status || "",
          reason: data.reason || ""
        }
      });
    }

    showToast(decision === "approved" ? "Ürün yayına alındı." : decision === "rejected" ? "Ürün reddedildi." : "Ürün revizyona gönderildi.");
    await loadProductReviews();
  }

  async function runAdminAutomation(action) {
    const summary = (state.cache.automation || state.dashboard?.automation || {}).summary || {};
    const data = await openModal({
      title: "Otomasyonu Çalıştır",
      message: `${Number(summary.auto_ready || 0)} güvenli ürün otomatik yayına alınabilir. Finans, iade, partner ve süper admin kararları otomatik onaylanmaz.`,
      confirmText: "Otomasyonu Çalıştır",
      fields: [
        {
          id: "reason",
          label: "Audit gerekçesi",
          type: "textarea",
          required: true,
          max: 900,
          value: "Otomasyon: düşük riskli ürün kuralları geçti; ürün yayına alındı."
        }
      ]
    });
    if (!data) return;
    const result = await api("/v1/ops-console/automation/run", {
      method: "POST",
      body: {
        apply: true,
        actions: [action || "publish_safe_products"],
        limit: 40,
        reason: data.reason || ""
      }
    });
    state.cache.automation = result.automation || state.cache.automation;
    const count = Number(result.automation?.applied?.products_published?.length || 0);
    showToast(count ? `${count} güvenli ürün otomasyonla yayına alındı.` : "Otomasyon çalıştı; yayınlanacak yeni güvenli ürün bulunmadı.");
    if (state.view === "automation") {
      renderAutomationCenter(state.cache.automation);
    } else {
      await loadDashboard();
    }
    renderNav();
  }

  async function createContentProposal(form) {
    const raw = Object.fromEntries(new FormData(form).entries());
    const data = await openModal({
      title: "İçerik Önerisi",
      message: "Öneri Super Admin onay kuyruğuna gönderilecek.",
      confirmText: "Gönder",
      fields: [
        { id: "confirm", label: "Onay notu", type: "textarea", value: raw.summary, required: true }
      ]
    });
    if (!data) return;
    await api("/v1/ops-console/content-proposals", {
      method: "POST",
      body: {
        content_scope: raw.content_scope,
        title: raw.title,
        summary: data.confirm,
        payload: {
          reference: raw.reference || "",
          prepared_from: "admin_panel"
        }
      }
    });
    showToast("İçerik önerisi onaya gönderildi.");
    form.reset();
    await loadContent();
  }

  async function createSocialDraft(form) {
    const raw = Object.fromEntries(new FormData(form).entries());
    const targetPlatforms = checkedValues(form, "target_platforms");
    const extraPayload = jsonObject(raw.platform_payload_json);
    const platformPayload = {
      link: raw.landing_url || "",
      landing_url: raw.landing_url || "",
      image_url: raw.image_url || "",
      video_url: raw.video_url || "",
      privacy_status: raw.privacy_status || "public",
      privacy_level: raw.privacy_status === "private" ? "SELF_ONLY" : "PUBLIC_TO_EVERYONE",
      action_type: raw.action_type || "LEARN_MORE",
      to: raw.whatsapp_to || "",
      ...extraPayload
    };
    await api("/v1/ops-console/social-media/drafts", {
      method: "POST",
      body: {
        title: raw.title,
        content_theme: raw.content_theme,
        hook: raw.hook || "",
        body: raw.body,
        cta: raw.cta || "",
        landing_url: raw.landing_url || "",
        scheduled_for: dateTimeInputToIso(raw.scheduled_for),
        target_platforms: targetPlatforms.length ? targetPlatforms : socialPlatforms,
        post_type: raw.post_type || "feed",
        hashtags: csvValues(raw.hashtags),
        visual_fingerprint: raw.visual_fingerprint || "",
        platform_payload: platformPayload,
        metadata: { prepared_from: "admin_social_center" }
      }
    });
    showToast("Sosyal medya taslağı oluşturuldu.");
    form.reset();
    await loadSocialMedia();
  }

  async function saveSocialAccount(form) {
    const raw = Object.fromEntries(new FormData(form).entries());
    await api("/v1/ops-console/social-media/accounts", {
      method: "POST",
      body: {
        platform: raw.platform,
        display_name: raw.display_name,
        handle: raw.handle,
        account_url: raw.account_url || "",
        connector_mode: raw.connector_mode || "pending",
        connection_status: raw.connection_status || "not_connected",
        is_active: true
      }
    });
    showToast("Sosyal medya hesabı kaydedildi.");
    await loadSocialMedia();
  }

  async function saveSocialPlan(form) {
    const raw = Object.fromEntries(new FormData(form).entries());
    const targetPlatforms = checkedValues(form, "target_platforms");
    await api("/v1/ops-console/social-media/daily-plans", {
      method: "POST",
      body: {
        plan_date: raw.plan_date,
        objective: raw.objective || "growth",
        summary: raw.summary || "",
        target_platforms: targetPlatforms.length ? targetPlatforms : socialPlatforms
      }
    });
    showToast("Günlük sosyal medya planı kaydedildi.");
    await loadSocialMedia();
  }

  async function generateSocialPackage(form) {
    const raw = Object.fromEntries(new FormData(form).entries());
    const targetPlatforms = checkedValues(form, "target_platforms");
    const data = await api("/v1/ops-console/social-media/daily-package/generate", {
      method: "POST",
      body: {
        plan_date: raw.plan_date || undefined,
        objective: raw.objective || "growth",
        landing_url: raw.landing_url || "https://allonahub.com/",
        target_platforms: targetPlatforms.length ? targetPlatforms : ["instagram", "facebook", "threads", "x", "linkedin", "tiktok", "youtube", "pinterest", "nsosyal"],
        auto_submit: true,
        generate_assets: true
      }
    });
    showToast(data?.skipped ? "Bugünün paketi zaten var." : "Günlük paket onaya hazır oluşturuldu.");
    await loadSocialMedia();
  }

  async function prepareSocialAssets() {
    const data = await api("/v1/ops-console/social-media/assets/prepare", {
      method: "POST",
      body: { limit: 20 }
    });
    const count = data?.prepared?.length || 0;
    showToast(`Asset hazırlama tamamlandı: ${count}`);
    await loadSocialMedia();
  }

  async function saveSocialSecret(form) {
    const raw = Object.fromEntries(new FormData(form).entries());
    await api("/v1/ops-console/social-media/secrets", {
      method: "POST",
      body: {
        platform: raw.platform,
        secret_key: String(raw.secret_key || "").trim().toUpperCase(),
        secret_value: raw.secret_value
      }
    });
    showToast("Secret güvenli şekilde kaydedildi.");
    form.reset();
    await loadSocialMedia();
  }

  async function updateSocialPostMedia(postId) {
    const data = await openModal({
      title: "Medya / Payload",
      message: "Public HTTPS medya URL'leri platform yayınında kullanılır.",
      confirmText: "Kaydet",
      fields: [
        { id: "image_url", label: "Görsel URL", required: false, max: 900 },
        { id: "video_url", label: "Video URL", required: false, max: 900 },
        { id: "link", label: "Landing link", required: false, max: 900 },
        { id: "platform_payload_json", label: "Ek payload JSON", required: false, max: 1600 }
      ]
    });
    if (!data) return;
    await api(`/v1/ops-console/social-media/posts/${encodeURIComponent(postId)}/media`, {
      method: "POST",
      body: {
        image_url: data.image_url || "",
        video_url: data.video_url || "",
        link: data.link || "",
        platform_payload: jsonObject(data.platform_payload_json)
      }
    });
    showToast("Medya bilgisi kaydedildi.");
    await loadSocialMedia();
  }

  async function testSocialConnection(platform) {
    const data = await api("/v1/ops-console/social-media/connections/test", {
      method: "POST",
      body: { platform }
    });
    const status = data?.result?.status || "tested";
    const message = data?.result?.errorMessage ? ` - ${data.result.errorMessage}` : "";
    showToast(`Bağlantı testi: ${normalizeStatus(status)}${message}`, data?.ok ? "" : "error");
    await loadSocialMedia();
  }

  async function submitSocialDraft(draftId) {
    await api(`/v1/ops-console/social-media/drafts/${encodeURIComponent(draftId)}/submit`, { method: "POST" });
    showToast("Taslak onaya gönderildi.");
    await loadSocialMedia();
  }

  async function approveSocialDraft(draftId, publishNow) {
    const data = await openModal({
      title: publishNow ? "Şimdi Kuyruğa Al" : "Planlı Sosyal Medya Onayı",
      message: publishNow ? "Onaylanan postlar hemen server dispatch kuyruğuna alınacak." : "Saat girmezsen platform bazlı paket saatleri korunur.",
      confirmText: publishNow ? "Şimdi Kuyruğa Al" : "Planlı Onayla",
      fields: [
        { id: "scheduled_for", label: "Plan zamanı", inputType: "datetime-local", required: false },
        { id: "approval_note", label: "Onay notu", type: "textarea", required: false, max: 900 }
      ]
    });
    if (!data) return;
    await api(`/v1/ops-console/social-media/drafts/${encodeURIComponent(draftId)}/approve`, {
      method: "POST",
      body: {
        publish_now: Boolean(publishNow),
        scheduled_for: dateTimeInputToIso(data.scheduled_for),
        approval_note: data.approval_note || ""
      }
    });
    showToast(publishNow ? "Taslak onaylandı ve kuyruk çalıştırıldı." : "Taslak planlı onaylandı.");
    await loadSocialMedia();
  }

  async function dispatchSocialPost(postId) {
    await api(`/v1/ops-console/social-media/posts/${encodeURIComponent(postId)}/dispatch`, { method: "POST" });
    showToast("Dispatch isteği kaydedildi.");
    await loadSocialMedia();
  }

  async function dispatchDueSocialPosts() {
    await api("/v1/ops-console/social-media/dispatch-due", { method: "POST" });
    showToast("Planlı sosyal medya kuyruğu çalıştırıldı.");
    await loadSocialMedia();
  }

  async function bootstrap() {
    try {
      const data = await api("/v1/ops-console/bootstrap");
      state.profile = data.profile;
      state.capabilities = data.capabilities || {};
      state.dashboard = data.dashboard;
      state.warnings = data.warnings || [];
      renderNav();
      $("#adminProfileName").textContent = state.profile.full_name || "Admin";
      $("#adminProfileRole").textContent = state.profile.role || "admin";
      if (state.view === "dashboard") {
        renderDashboard(state.dashboard);
      } else {
        await loadView(state.view);
      }
    } catch (error) {
      $("#adminContent").innerHTML = statusBox(error.message || "Admin Panel erişimi doğrulanamadı.", "error");
    }
  }

  function bindEvents() {
    document.addEventListener("click", async (event) => {
      const nav = event.target.closest("[data-admin-view]");
      if (nav) {
        window.history.replaceState(null, "", `#${nav.dataset.adminView}`);
        await loadView(nav.dataset.adminView);
        return;
      }
      if (event.target.closest("[data-drawer-close]")) {
        closeDrawer();
        return;
      }
      if (event.target.closest("#adminRefresh")) {
        await loadView(state.view);
        return;
      }
      const automationRun = event.target.closest("[data-admin-automation-run]");
      if (automationRun) {
        await runAdminAutomation(automationRun.dataset.adminAutomationRun).catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("#adminSignOut")) {
        await App.auth.signOut();
        return;
      }
      const detail = event.target.closest("[data-detail]");
      if (detail) {
        await showDetail(detail.dataset.detail, detail.dataset.id, detail.dataset.source);
        return;
      }
      const applicationDecision = event.target.closest("[data-application-decision]");
      if (applicationDecision) {
        await showApplicationDecision(applicationDecision.dataset.applicationDecision).catch((error) => showToast(error.message, "error"));
        return;
      }
      const finalApplicationDecision = event.target.closest("[data-application-final-decision]");
      if (finalApplicationDecision) {
        await finalPartnerApplicationDecision(finalApplicationDecision.dataset.id, finalApplicationDecision.dataset.applicationFinalDecision).catch((error) => showToast(error.message, "error"));
        return;
      }
      const userNote = event.target.closest("[data-user-note]");
      if (userNote) {
        await createUserNote(userNote.dataset.userNote).catch((error) => showToast(error.message, "error"));
        return;
      }
      const userFlag = event.target.closest("[data-user-flag]");
      if (userFlag) {
        await flagUser(userFlag.dataset.userFlag).catch((error) => showToast(error.message, "error"));
        return;
      }
      const applicationAction = event.target.closest("[data-application-action]");
      if (applicationAction) {
        await partnerApplicationAction(applicationAction.dataset.id, applicationAction.dataset.applicationAction).catch((error) => showToast(error.message, "error"));
        return;
      }
      const orderRisk = event.target.closest("[data-order-risk]");
      if (orderRisk) {
        await flagOrder(orderRisk.dataset.orderRisk).catch((error) => showToast(error.message, "error"));
        return;
      }
      const refundDetail = event.target.closest("[data-refund-detail]");
      if (refundDetail) {
        await showRefundDetail(refundDetail.dataset.refundDetail).catch((error) => showToast(error.message, "error"));
        return;
      }
      const refundTicketDetail = event.target.closest("[data-refund-ticket-detail]");
      if (refundTicketDetail) {
        showRefundTicketDetail(refundTicketDetail.dataset.refundTicketDetail);
        return;
      }
      const refundAction = event.target.closest("[data-refund-action]");
      if (refundAction) {
        await runRefundAction(refundAction.dataset.id, refundAction.dataset.refundAction).catch((error) => showToast(error.message, "error"));
        return;
      }
      const productReviewAction = event.target.closest("[data-product-review-action]");
      if (productReviewAction) {
        await runProductReviewAction(productReviewAction.dataset.id, productReviewAction.dataset.productReviewAction).catch((error) => showToast(error.message, "error"));
        return;
      }
      const supportStatus = event.target.closest("[data-support-status]");
      if (supportStatus) {
        await updateSupportStatus(supportStatus.dataset.id, supportStatus.dataset.source, supportStatus.dataset.supportStatus).catch((error) => showToast(error.message, "error"));
        return;
      }
      const socialSubmit = event.target.closest("[data-social-submit]");
      if (socialSubmit) {
        await submitSocialDraft(socialSubmit.dataset.socialSubmit).catch((error) => showToast(error.message, "error"));
        return;
      }
      const socialApprove = event.target.closest("[data-social-approve]");
      if (socialApprove) {
        await approveSocialDraft(socialApprove.dataset.socialApprove, false).catch((error) => showToast(error.message, "error"));
        return;
      }
      const socialPublish = event.target.closest("[data-social-publish]");
      if (socialPublish) {
        await approveSocialDraft(socialPublish.dataset.socialPublish, true).catch((error) => showToast(error.message, "error"));
        return;
      }
      const socialDispatch = event.target.closest("[data-social-dispatch]");
      if (socialDispatch) {
        await dispatchSocialPost(socialDispatch.dataset.socialDispatch).catch((error) => showToast(error.message, "error"));
        return;
      }
      const socialMedia = event.target.closest("[data-social-media]");
      if (socialMedia) {
        await updateSocialPostMedia(socialMedia.dataset.socialMedia).catch((error) => showToast(error.message, "error"));
        return;
      }
      const socialTest = event.target.closest("[data-social-test]");
      if (socialTest) {
        await testSocialConnection(socialTest.dataset.socialTest).catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("[data-social-prepare-assets]")) {
        await prepareSocialAssets().catch((error) => showToast(error.message, "error"));
        return;
      }
      if (event.target.closest("[data-social-dispatch-due]")) {
        await dispatchDueSocialPosts().catch((error) => showToast(error.message, "error"));
      }
    });

    document.addEventListener("submit", async (event) => {
      const contentForm = event.target.closest("[data-content-form]");
      if (contentForm) {
        event.preventDefault();
        await createContentProposal(contentForm).catch((error) => showToast(error.message, "error"));
      }
      const socialDraftForm = event.target.closest("[data-social-draft-form]");
      if (socialDraftForm) {
        event.preventDefault();
        await createSocialDraft(socialDraftForm).catch((error) => showToast(error.message, "error"));
      }
      const socialAccountForm = event.target.closest("[data-social-account-form]");
      if (socialAccountForm) {
        event.preventDefault();
        await saveSocialAccount(socialAccountForm).catch((error) => showToast(error.message, "error"));
      }
      const socialPlanForm = event.target.closest("[data-social-plan-form]");
      if (socialPlanForm) {
        event.preventDefault();
        await saveSocialPlan(socialPlanForm).catch((error) => showToast(error.message, "error"));
      }
      const socialPackageForm = event.target.closest("[data-social-package-form]");
      if (socialPackageForm) {
        event.preventDefault();
        await generateSocialPackage(socialPackageForm).catch((error) => showToast(error.message, "error"));
      }
      const socialSecretForm = event.target.closest("[data-social-secret-form]");
      if (socialSecretForm) {
        event.preventDefault();
        await saveSocialSecret(socialSecretForm).catch((error) => showToast(error.message, "error"));
      }
    });

    $("#adminGlobalSearch")?.addEventListener("input", core.debounce(() => {
      if (state.view !== "dashboard" && state.view !== "content" && state.view !== "security" && state.view !== "reports" && state.view !== "audit") {
        loadView(state.view);
      }
    }, 350));

    $("#adminGlobalStatus")?.addEventListener("change", () => {
      if (state.view !== "dashboard" && state.view !== "content" && state.view !== "security" && state.view !== "reports" && state.view !== "audit") {
        loadView(state.view);
      }
    });
  }

  function renderNav() {
    const nav = $("#adminNav");
    if (!nav) return;
    nav.innerHTML = Object.entries(views).map(([key, item]) => {
      const count = notificationCount(key);
      return `
      <button type="button" data-admin-view="${escape(key)}" class="${key === state.view ? "is-active" : ""} ${count ? "has-alert" : ""}">
        <span class="admin-nav-label">
          <span>${escape(item.label)}</span>
          ${navBadge(key)}
        </span>
        ${item.marker ? `<small>${escape(item.marker)}</small>` : ""}
      </button>
    `;
    }).join("");
    setActiveNav();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!document.querySelector("[data-page='admin-ops']")) return;
    state.view = viewFromHash();
    renderNav();
    bindEvents();
    await bootstrap();
  });
})();
