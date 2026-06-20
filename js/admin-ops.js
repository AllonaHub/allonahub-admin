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
      tickets: [],
      proposals: [],
      security: {},
      reports: {},
      audit: []
    }
  };

  const views = {
    dashboard: { label: "Dashboard", marker: "Canlı" },
    users: { label: "Kullanıcı Takibi", marker: "" },
    applications: { label: "Partner Başvuruları", marker: "" },
    partners: { label: "Partner Operasyonları", marker: "" },
    orders: { label: "Sipariş Yönetimi", marker: "" },
    content: { label: "İçerik Yönetimi", marker: "" },
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

  function titleCell(title, sub) {
    return `<span class="admin-row-title">${escape(title || "-")}</span><span class="admin-row-sub">${escape(sub || "")}</span>`;
  }

  function statusBox(message, type) {
    return `<div class="admin-status ${type === "error" ? "admin-status--error" : ""}">${escape(message)}</div>`;
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

  function warningPanel(warnings) {
    const rows = [...new Set([...(state.warnings || []), ...(warnings || [])])].filter(Boolean);
    if (!rows.length) return "";
    return `<div class="admin-panel-note">${rows.map(escape).join("<br>")}</div>`;
  }

  async function sessionToken() {
    if (!App.auth || !App.auth.getSession) throw new Error("Oturum sistemi yüklenemedi.");
    const session = await App.auth.getSession();
    if (!session?.access_token) {
      const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
      window.location.href = core.url(`/pages/account/login.html?returnTo=${returnTo}`);
      return "";
    }
    return session.access_token;
  }

  async function api(path, options) {
    const token = await sessionToken();
    if (!token) return null;
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      method: options?.method || "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      credentials: "omit"
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.message || payload.error || "İşlem tamamlanamadı.";
      throw new Error(message);
    }
    return payload;
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
      `<div class="admin-split">
        ${section("Son Siparişler", "", table(["Sipariş", "Müşteri", "Tutar", "Sipariş", "Ödeme"], orderRows, "Sipariş kaydı bulunamadı."))}
        ${section("Sistem Uyarıları", "", alertList)}
      </div>`
    ].join("");
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
            <button class="admin-btn" type="button" data-application-action="start_review" data-id="${escape(item.id)}">İncele</button>
            <button class="admin-btn admin-btn--gold" type="button" data-application-action="recommend_approve" data-id="${escape(item.id)}">Onay Öner</button>
            <button class="admin-btn admin-btn--danger" type="button" data-application-action="recommend_reject" data-id="${escape(item.id)}">Ret Öner</button>
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
        <input id="modal-${escape(field.id)}" name="${escape(field.id)}" maxlength="${escape(field.max || 180)}" value="${escape(field.value || "")}" ${field.required ? "required" : ""}>
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
    const data = await api("/v1/admin/ops/dashboard");
    state.dashboard = data.dashboard;
    state.warnings = data.warnings || [];
    renderDashboard(data.dashboard);
  }

  async function loadUsers() {
    const data = await api(`/v1/admin/ops/users?${queryParams()}`);
    state.cache.users = data.users || [];
    state.warnings = data.warnings || [];
    renderUsers(state.cache.users);
  }

  async function loadApplications() {
    const data = await api(`/v1/admin/ops/partner-applications?${queryParams()}`);
    state.cache.applications = data.applications || [];
    state.warnings = data.warnings || [];
    renderApplications(state.cache.applications);
  }

  async function loadPartners() {
    const data = await api(`/v1/admin/ops/partners?${queryParams()}`);
    state.cache.partners = data.partners || [];
    state.warnings = data.warnings || [];
    renderPartners(state.cache.partners);
  }

  async function loadOrders() {
    const data = await api(`/v1/admin/ops/orders?${queryParams()}`);
    state.cache.orders = data.orders || [];
    state.warnings = data.warnings || [];
    renderOrders(state.cache.orders);
  }

  async function loadSupport() {
    const data = await api(`/v1/admin/ops/support-tickets?${queryParams()}`);
    state.cache.tickets = data.tickets || [];
    state.warnings = data.warnings || [];
    renderSupport(state.cache.tickets);
  }

  async function loadContent() {
    const data = await api("/v1/admin/ops/content-proposals");
    state.cache.proposals = data.proposals || [];
    state.warnings = data.warnings || [];
    renderContent(state.cache.proposals);
  }

  async function loadSecurity() {
    const data = await api("/v1/admin/ops/security-monitoring");
    state.cache.security = data;
    state.warnings = data.warnings || [];
    renderSecurity(data);
  }

  async function loadReports() {
    const data = await api("/v1/admin/ops/reports");
    state.cache.reports = data.reports || {};
    state.warnings = data.warnings || [];
    renderReports(state.cache.reports);
  }

  async function loadAudit() {
    const data = await api("/v1/admin/ops/audit-log");
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
      if (state.view === "users") await loadUsers();
      if (state.view === "applications") await loadApplications();
      if (state.view === "partners") await loadPartners();
      if (state.view === "orders") await loadOrders();
      if (state.view === "content") await loadContent();
      if (state.view === "support") await loadSupport();
      if (state.view === "security") await loadSecurity();
      if (state.view === "reports") await loadReports();
      if (state.view === "audit") await loadAudit();
    } catch (error) {
      $("#adminContent").innerHTML = statusBox(error.message || "Panel verisi yüklenemedi.", "error");
    }
  }

  async function showDetail(type, id, source) {
    try {
      if (type === "user") {
        const data = await api(`/v1/admin/ops/users/${encodeURIComponent(id)}`);
        renderObjectDetails("Kullanıcı Detayı", data.profile);
      } else if (type === "application") {
        const data = await api(`/v1/admin/ops/partner-applications/${encodeURIComponent(id)}`);
        renderObjectDetails("Başvuru Detayı", data.application);
      } else if (type === "order") {
        const data = await api(`/v1/admin/ops/orders/${encodeURIComponent(id)}`);
        renderObjectDetails("Sipariş Detayı", data.order);
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
    await api(`/v1/admin/ops/users/${encodeURIComponent(userId)}/notes`, { method: "POST", body: data });
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
    await api(`/v1/admin/ops/users/${encodeURIComponent(userId)}/flag`, { method: "POST", body: data });
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
    await api(`/v1/admin/ops/partner-applications/${encodeURIComponent(applicationId)}/review`, {
      method: "PATCH",
      body: { action, risk_level: data.risk_level, reason: data.reason }
    });
    showToast("Başvuru inceleme kaydı oluşturuldu.");
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
    await api(`/v1/admin/ops/orders/${encodeURIComponent(orderId)}/risk-flag`, { method: "POST", body: data });
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
    await api(`/v1/admin/ops/support-tickets/${encodeURIComponent(ticketId)}/status`, {
      method: "PATCH",
      body: { source, status, note: data.note || "" }
    });
    showToast("Destek talebi güncellendi.");
    await loadSupport();
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
    await api("/v1/admin/ops/content-proposals", {
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

  async function bootstrap() {
    try {
      const data = await api("/v1/admin/ops/bootstrap");
      state.profile = data.profile;
      state.capabilities = data.capabilities || {};
      state.dashboard = data.dashboard;
      state.warnings = data.warnings || [];
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
      if (event.target.closest("#adminSignOut")) {
        await App.auth.signOut();
        return;
      }
      const detail = event.target.closest("[data-detail]");
      if (detail) {
        await showDetail(detail.dataset.detail, detail.dataset.id, detail.dataset.source);
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
      const supportStatus = event.target.closest("[data-support-status]");
      if (supportStatus) {
        await updateSupportStatus(supportStatus.dataset.id, supportStatus.dataset.source, supportStatus.dataset.supportStatus).catch((error) => showToast(error.message, "error"));
      }
    });

    document.addEventListener("submit", async (event) => {
      const contentForm = event.target.closest("[data-content-form]");
      if (contentForm) {
        event.preventDefault();
        await createContentProposal(contentForm).catch((error) => showToast(error.message, "error"));
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
    nav.innerHTML = Object.entries(views).map(([key, item]) => `
      <button type="button" data-admin-view="${escape(key)}" class="${key === state.view ? "is-active" : ""}">
        <span>${escape(item.label)}</span>
        ${item.marker ? `<small>${escape(item.marker)}</small>` : ""}
      </button>
    `).join("");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!document.querySelector("[data-page='admin-ops']")) return;
    state.view = viewFromHash();
    renderNav();
    bindEvents();
    await bootstrap();
  });
})();
