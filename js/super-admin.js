(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const security = App.security;
  const config = App.config || {};

  const state = {
    access: null,
    users: [],
    applications: [],
    businesses: [],
    settings: [],
    modules: []
  };

  const viewLoaders = {
    dashboard: loadDashboard,
    users: loadUsers,
    partners: loadPartners,
    security: loadSecurity,
    settings: loadSettings,
    modules: loadModules,
    audit: loadAuditLog
  };

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function escape(value) {
    return core.escapeHTML(value);
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value || "").replace(/["\\]/g, "\\$&");
  }

  function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString("tr-TR");
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("tr-TR");
  }

  function money(value) {
    return core.money(Number(value || 0));
  }

  function normalizeRisk(value) {
    return String(value || "low").toLowerCase();
  }

  function riskLabel(value) {
    const risk = normalizeRisk(value);
    const labels = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
    return `<span class="sa-risk-${escape(risk)}">${escape(labels[risk] || value || "Low")}</span>`;
  }

  function statusLabel(value) {
    const status = String(value || "-").toLowerCase();
    const map = {
      active: "Aktif",
      passive: "Pasif",
      suspended: "Askıda",
      paid: "Ödendi",
      warning: "Uyarı"
    };
    const className = ["active", "passive", "suspended", "paid"].includes(status) ? status : "passive";
    return `<span class="sa-status-${escape(className)}">${escape(map[status] || value || "-")}</span>`;
  }

  function setAlert(message, tone) {
    const target = $("[data-sa-alert]");
    if (!target) return;
    if (!message) {
      target.hidden = true;
      target.textContent = "";
      return;
    }
    target.hidden = false;
    target.textContent = message;
    target.style.borderColor = tone === "ok" ? "rgba(56, 217, 150, 0.36)" : "rgba(255, 77, 109, 0.36)";
    target.style.background = tone === "ok" ? "rgba(56, 217, 150, 0.10)" : "rgba(255, 77, 109, 0.10)";
  }

  function loginUrl() {
    const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    return core.url(`/pages/account/user.html?returnTo=${returnTo}`);
  }

  function mfaUrl() {
    const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    return core.url(`/pages/account/mfa.html?returnTo=${returnTo}`);
  }

  function loginFallback(message) {
    return `
      <main class="sa-main">
        <div class="sa-login-panel">
          <h1>Süper Admin Girişi</h1>
          <p>${escape(message || "Bu alana erişmek için süper admin hesabınızla giriş yapmalısınız.")}</p>
          <a class="sa-btn" href="${escape(loginUrl())}">Süper Admin Olarak Giriş Yap</a>
        </div>
      </main>
    `;
  }

  function publicError(error, fallback) {
    return security && security.publicErrorMessage
      ? security.publicErrorMessage(error, fallback)
      : (error && error.message) || fallback;
  }

  async function sessionToken() {
    const session = await App.auth.getSession();
    if (!session || !session.access_token) {
      throw new Error("Oturum doğrulanamadı.");
    }
    return session.access_token;
  }

  async function api(path, options) {
    const token = await sessionToken();
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      method: options && options.method || "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: options && options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.message || payload.error || "İşlem tamamlanamadı.";
      if (response.status === 403 && /mfa|iki aşamalı|2fa|aal2/i.test(message)) {
        window.location.href = mfaUrl();
        throw new Error("İki aşamalı doğrulama gerekli.");
      }
      throw new Error(message);
    }
    return payload;
  }

  function renderEmpty(target, message) {
    target.innerHTML = `<div class="sa-empty">${escape(message || "Kayıt bulunamadı.")}</div>`;
  }

  function renderWarnings(warnings) {
    const target = $("[data-schema-warnings]");
    if (!target) return;
    const rows = warnings || [];
    if (!rows.length) {
      target.innerHTML = `<div class="sa-list-item"><strong>Hazır</strong><span>Migration uyumlu</span></div>`;
      return;
    }
    target.innerHTML = rows.map((warning) => `
      <div class="sa-list-item">
        <strong>${escape(warning.label || "Şema")}</strong>
        <span>${escape(warning.message || "Eksik migration")}</span>
      </div>
    `).join("");
  }

  function metricCard(label, value, sub) {
    return `
      <article class="sa-stat">
        <span>${escape(label)}</span>
        <strong>${escape(value)}</strong>
        <em>${escape(sub || "")}</em>
      </article>
    `;
  }

  async function loadDashboard() {
    const target = $("[data-dashboard-metrics]");
    const health = $("[data-system-health]");
    if (!target || !health) return;
    target.innerHTML = metricCard("Yükleniyor", "...", "Dashboard");
    const payload = await api("/v1/control-center/dashboard");
    const dashboard = payload.dashboard || {};
    const metrics = dashboard.metrics || {};
    target.innerHTML = [
      metricCard("Toplam Kullanıcı", formatNumber(metrics.total_users), "Profil"),
      metricCard("Toplam Partner", formatNumber(metrics.total_partners), "Mağaza"),
      metricCard("Toplam Sipariş", formatNumber(metrics.total_orders), "Tüm zamanlar"),
      metricCard("Günlük Ciro", money(metrics.daily_revenue), "Ödenen sipariş"),
      metricCard("Bekleyen Başvuru", formatNumber(metrics.pending_applications), "Partner"),
      metricCard("Güvenlik Uyarısı", formatNumber(metrics.security_alerts), "Son 24 saat"),
      metricCard("Sistem", dashboard.system_health && dashboard.system_health.database === "online" ? "Online" : "Uyarı", "API")
    ].join("");

    const system = dashboard.system_health || {};
    $("[data-system-health-badge]").textContent = system.database === "online" ? "Online" : "Uyarı";
    health.innerHTML = [
      ["API", system.api || "-"],
      ["Database", system.database || "-"],
      ["Bakım modu", system.maintenance_mode ? "Açık" : "Kapalı"],
      ["Ödeme durumu", system.payments_disabled ? "Durduruldu" : "Aktif"],
      ["Auto Defense", `${formatNumber(system.auto_defense && system.auto_defense.recent_incident_count)} olay`]
    ].map(([key, value]) => `
      <div class="sa-health-item"><strong>${escape(key)}</strong><span>${escape(value)}</span></div>
    `).join("");
    renderWarnings(dashboard.schema_warnings || []);
  }

  async function loadUsers(params) {
    const query = new URLSearchParams(params || {});
    const payload = await api(`/v1/control-center/users?${query.toString()}`);
    state.users = payload.users || [];
    const target = $("[data-users-table]");
    if (!target) return;
    $("[data-users-count]").textContent = `${formatNumber(payload.count || state.users.length)} kayıt`;
    if (!state.users.length) {
      renderEmpty(target, "Kullanıcı kaydı bulunamadı.");
      return;
    }

    target.innerHTML = `
      <table class="sa-table">
        <thead>
          <tr><th>Kullanıcı</th><th>Rol</th><th>Durum</th><th>Risk</th><th>Tarih</th><th>İşlem</th></tr>
        </thead>
        <tbody>
          ${state.users.map((user) => `
            <tr>
              <td>
                <strong>${escape(user.full_name || "-")}</strong><br>
                <small>${escape(user.email || user.phone || user.id)}</small>
              </td>
              <td>${escape(user.role)}</td>
              <td>${statusLabel(user.account_status)}${user.flagged_suspicious ? ` <span class="sa-status-warning">Şüpheli</span>` : ""}</td>
              <td>${riskLabel(user.risk_level)}</td>
              <td>${formatDate(user.created_at)}</td>
              <td>
                <div class="sa-row-actions">
                  <button class="sa-btn sa-btn-ghost sa-mini" type="button" data-user-action="active" data-user-id="${escape(user.id)}">Aktif</button>
                  <button class="sa-btn sa-btn-ghost sa-mini" type="button" data-user-action="passive" data-user-id="${escape(user.id)}">Pasif</button>
                  <button class="sa-btn sa-btn-danger sa-mini" type="button" data-user-action="suspended" data-user-id="${escape(user.id)}">Askıya al</button>
                  <button class="sa-btn sa-btn-ghost sa-mini" type="button" data-user-action="suspicious" data-user-id="${escape(user.id)}">Şüpheli</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  async function loadPartners() {
    const payload = await api("/v1/control-center/partners");
    state.applications = payload.applications || [];
    state.businesses = payload.businesses || [];
    const applicationsTarget = $("[data-partner-applications]");
    const businessesTarget = $("[data-partner-businesses]");
    $("[data-partner-app-count]").textContent = `${formatNumber(state.applications.length)} kayıt`;
    $("[data-partner-business-count]").textContent = `${formatNumber(state.businesses.length)} kayıt`;

    if (applicationsTarget) {
      if (!state.applications.length) {
        renderEmpty(applicationsTarget, "Başvuru bulunamadı.");
      } else {
        applicationsTarget.innerHTML = `
          <table class="sa-table">
            <thead><tr><th>Firma</th><th>İletişim</th><th>Durum</th><th>Tarih</th><th>İşlem</th></tr></thead>
            <tbody>
              ${state.applications.map((item) => `
                <tr>
                  <td><strong>${escape(item.company_name)}</strong><br><small>${escape(item.tax_number || "-")}</small></td>
                  <td>${escape(item.contact_name || "-")}<br><small>${escape(item.email || item.phone || "-")}</small></td>
                  <td>${statusLabel(item.status)}</td>
                  <td>${formatDate(item.created_at)}</td>
                  <td>
                    <div class="sa-row-actions">
                      <button class="sa-btn sa-btn-ghost sa-mini" type="button" data-partner-decision="review" data-application-id="${escape(item.id)}">İnceleme</button>
                      <button class="sa-btn sa-mini" type="button" data-partner-decision="approved" data-application-id="${escape(item.id)}">Onayla</button>
                      <button class="sa-btn sa-btn-danger sa-mini" type="button" data-partner-decision="rejected" data-application-id="${escape(item.id)}">Reddet</button>
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      }
    }

    if (businessesTarget) {
      if (!state.businesses.length) {
        renderEmpty(businessesTarget, "Partner mağazası bulunamadı.");
      } else {
        businessesTarget.innerHTML = `
          <table class="sa-table">
            <thead><tr><th>Mağaza</th><th>Tip</th><th>Komisyon</th><th>Doğrulama</th><th>Durum</th></tr></thead>
            <tbody>
              ${state.businesses.map((item) => `
                <tr>
                  <td><strong>${escape(item.display_name || item.legal_name || "-")}</strong><br><small>${escape(item.partner_code || item.id)}</small></td>
                  <td>${escape(item.partner_type || "-")}</td>
                  <td>${formatNumber(Number(item.default_commission_rate || 0) * 100)}%</td>
                  <td>${escape(item.verification_status || "-")}</td>
                  <td>${statusLabel(item.status)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      }
    }
  }

  async function loadSecurity() {
    const payload = await api("/v1/control-center/security");
    const securityData = payload.security || {};
    const metrics = securityData.metrics || {};
    const metricTarget = $("[data-security-metrics]");
    if (metricTarget) {
      metricTarget.innerHTML = [
        metricCard("Başarısız Giriş", formatNumber(metrics.failed_auth_24h), "Son 24 saat"),
        metricCard("Critical Olay", formatNumber(metrics.critical_events_sample), "Son kayıtlar"),
        metricCard("Şüpheli IP", formatNumber(metrics.suspicious_ip_count), "Riskli kaynak"),
        metricCard("Bloklu IP", formatNumber(metrics.blocked_ip_count), "Auto Defense")
      ].join("");
    }

    const ipTarget = $("[data-suspicious-ips]");
    const ips = securityData.suspicious_ips || [];
    if (ipTarget) {
      ipTarget.innerHTML = ips.length ? ips.map((item) => `
        <div class="sa-list-item"><strong>${escape(item.ip)}</strong><span>${formatNumber(item.count)} olay</span></div>
      `).join("") : `<div class="sa-empty">Şüpheli IP yok.</div>`;
    }

    renderEventsTable($("[data-security-events]"), securityData.recent_events || []);
  }

  async function loadSettings() {
    const payload = await api("/v1/control-center/settings");
    state.settings = payload.settings || [];
    const target = $("[data-settings-list]");
    const env = payload.env_flags || {};
    const envTarget = $("[data-settings-env]");
    if (envTarget) {
      envTarget.textContent = `ENV: bakım ${env.maintenance_mode ? "açık" : "kapalı"} / ödeme ${env.payments_disabled ? "kapalı" : "aktif"}`;
    }
    if (!target) return;
    target.innerHTML = state.settings.map((setting) => {
      const value = setting.setting_value;
      const isBoolean = setting.value_type === "boolean" || typeof value === "boolean";
      const control = isBoolean
        ? `<button class="sa-toggle" type="button" aria-pressed="${value === true}" data-setting-toggle="${escape(setting.setting_key)}"></button>`
        : `<input type="number" step="0.01" value="${escape(value)}" data-setting-input="${escape(setting.setting_key)}">`;
      return `
        <div class="sa-setting">
          <div>
            <h3>${escape(setting.label || setting.setting_key)}</h3>
            <span>${escape(setting.category || "system")} / ${escape(setting.risk_level || "medium")}</span>
          </div>
          <div class="sa-setting-control">
            ${control}
            <button class="sa-btn sa-mini" type="button" data-setting-save="${escape(setting.setting_key)}">Kaydet</button>
          </div>
        </div>
      `;
    }).join("");
  }

  async function loadModules() {
    const payload = await api("/v1/control-center/modules");
    state.modules = payload.modules || [];
    const target = $("[data-modules-list]");
    if (!target) return;
    target.innerHTML = state.modules.map((item) => `
      <article class="sa-module">
        <div>
          <h3>${escape(item.name || item.module_key)}</h3>
          <span>${escape(item.category || "services")}</span>
        </div>
        <div class="sa-module-row">
          <span>Aktif</span>
          <button class="sa-toggle" type="button" aria-pressed="${item.is_active === true}" data-module-toggle="is_active" data-module-key="${escape(item.module_key)}"></button>
        </div>
        <div class="sa-module-row">
          <span>Görünürlük</span>
          <button class="sa-toggle" type="button" aria-pressed="${item.is_visible === true}" data-module-toggle="is_visible" data-module-key="${escape(item.module_key)}"></button>
        </div>
        <label class="sa-module-row">
          <span>Komisyon</span>
          <input type="number" min="0" max="90" step="0.1" value="${escape(Number(item.commission_rate || 0) * 100)}" data-module-commission="${escape(item.module_key)}">
        </label>
        <label class="sa-module-row">
          <span>Başvuru</span>
          <select data-module-application="${escape(item.module_key)}">
            ${["open", "review_only", "closed"].map((status) => `<option value="${status}" ${item.application_status === status ? "selected" : ""}>${escape(status)}</option>`).join("")}
          </select>
        </label>
        <button class="sa-btn sa-mini" type="button" data-module-save="${escape(item.module_key)}">Kaydet</button>
      </article>
    `).join("");
  }

  async function loadAuditLog() {
    const payload = await api("/v1/control-center/audit-log?limit=80");
    renderEventsTable($("[data-audit-log]"), payload.events || []);
  }

  function renderEventsTable(target, events) {
    if (!target) return;
    if (!events.length) {
      renderEmpty(target, "Kayıt bulunamadı.");
      return;
    }
    target.innerHTML = `
      <table class="sa-table">
        <thead><tr><th>Tarih</th><th>Risk</th><th>İşlem</th><th>Kayıt</th><th>IP</th></tr></thead>
        <tbody>
          ${events.map((event) => `
            <tr>
              <td>${formatDate(event.created_at)}</td>
              <td>${riskLabel(event.severity)}</td>
              <td><strong>${escape(event.action || "-")}</strong><br><small>${escape(event.actor_role || "-")}</small></td>
              <td>${escape(event.resource_type || "-")}<br><small>${escape(event.resource_id || "-")}</small></td>
              <td>${escape(event.ip_address || "-")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function confirmAction(message, options) {
    const modal = $("[data-confirm-modal]");
    const messageTarget = $("[data-confirm-message]");
    const reasonInput = $("[data-confirm-reason]");
    const cancelButton = $("[data-confirm-cancel]");
    const acceptButton = $("[data-confirm-accept]");
    if (!modal || !messageTarget || !reasonInput || !cancelButton || !acceptButton) {
      return Promise.resolve({ confirmed: window.confirm(message), reason: "" });
    }
    messageTarget.textContent = message;
    reasonInput.value = "";
    modal.hidden = false;
    reasonInput.focus();

    return new Promise((resolve) => {
      function cleanup(result) {
        modal.hidden = true;
        cancelButton.removeEventListener("click", onCancel);
        acceptButton.removeEventListener("click", onAccept);
        resolve(result);
      }
      function onCancel() {
        cleanup({ confirmed: false, reason: "" });
      }
      function onAccept() {
        const reason = reasonInput.value.trim();
        if (options && options.requireReason && reason.length < 6) {
          reasonInput.focus();
          return;
        }
        cleanup({ confirmed: true, reason });
      }
      cancelButton.addEventListener("click", onCancel);
      acceptButton.addEventListener("click", onAccept);
    });
  }

  async function runConfirmed(message, callback, options) {
    const confirmed = await confirmAction(message, options);
    if (!confirmed.confirmed) return;
    try {
      await callback(confirmed.reason);
      setAlert("İşlem tamamlandı.", "ok");
      if ($("[data-command-output]")) {
        await reloadOwnerActiveView();
      } else {
        await reloadActiveView();
      }
    } catch (error) {
      setAlert(publicError(error, "İşlem tamamlanamadı."));
    }
  }

  async function updateUserAction(button) {
    const userId = button.dataset.userId;
    const action = button.dataset.userAction;
    const payload = {};
    let message = "Kullanıcı durumu güncellenecek.";
    if (action === "suspicious") {
      payload.flagged_suspicious = true;
      payload.risk_level = "high";
      message = "Kullanıcı şüpheli olarak işaretlenecek.";
    } else {
      payload.account_status = action;
      if (action === "active") payload.risk_level = "low";
      if (action === "suspended") {
        payload.flagged_suspicious = true;
        payload.risk_level = "critical";
        message = "Kullanıcı hesabı askıya alınacak.";
      }
    }

    await runConfirmed(message, async (reason) => {
      payload.note = reason || message;
      await api(`/v1/control-center/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: payload
      });
    }, { requireReason: action === "suspended" || action === "suspicious" });
  }

  async function decidePartner(button) {
    const applicationId = button.dataset.applicationId;
    const decision = button.dataset.partnerDecision;
    const messages = {
      review: "Başvuru incelemeye alınacak.",
      approved: "Partner başvurusu onaylanacak ve uygun kullanıcı için mağaza kaydı hazırlanacak.",
      rejected: "Partner başvurusu reddedilecek."
    };
    await runConfirmed(messages[decision] || "Partner başvurusu güncellenecek.", async (reason) => {
      await api(`/v1/control-center/partner-applications/${encodeURIComponent(applicationId)}`, {
        method: "PATCH",
        body: {
          decision,
          reason,
          commission_rate: 0.12,
          store_status: decision === "approved" ? "active" : "review"
        }
      });
    }, { requireReason: decision !== "review" });
  }

  async function saveSetting(button) {
    const key = button.dataset.settingSave;
    const setting = state.settings.find((item) => item.setting_key === key);
    if (!setting) return;
    const safeKey = cssEscape(key);
    const toggle = $(`[data-setting-toggle="${safeKey}"]`);
    const input = $(`[data-setting-input="${safeKey}"]`);
    const value = toggle ? toggle.getAttribute("aria-pressed") === "true" : Number(input && input.value || 0);
    await runConfirmed(`${setting.label || key} ayarı güncellenecek.`, async (reason) => {
      await api(`/v1/control-center/settings/${encodeURIComponent(key)}`, {
        method: "PATCH",
        body: { value, reason }
      });
    }, { requireReason: ["critical", "high"].includes(setting.risk_level) && value === true });
  }

  async function saveModule(button) {
    const key = button.dataset.moduleSave;
    const safeKey = cssEscape(key);
    const active = $(`[data-module-toggle="is_active"][data-module-key="${safeKey}"]`);
    const visible = $(`[data-module-toggle="is_visible"][data-module-key="${safeKey}"]`);
    const commission = $(`[data-module-commission="${safeKey}"]`);
    const application = $(`[data-module-application="${safeKey}"]`);
    await runConfirmed("Modül kontrol ayarı güncellenecek.", async (reason) => {
      await api(`/v1/control-center/modules/${encodeURIComponent(key)}`, {
        method: "PATCH",
        body: {
          is_active: active ? active.getAttribute("aria-pressed") === "true" : undefined,
          is_visible: visible ? visible.getAttribute("aria-pressed") === "true" : undefined,
          commission_rate: Number(commission && commission.value || 0) / 100,
          application_status: application && application.value,
          content_config: { last_reason: reason || "" }
        }
      });
    }, { requireReason: false });
  }

  const ownerViewTitles = {
    overview: ["Kontrol Merkezi", "Tüm ekosistem sinyalleri tek akışta"],
    alerts: ["Uyarı / Risk Akışı", "Öncelikli güvenlik, sistem ve yayın riskleri"],
    approvals: ["Yayın Onayları", "Main, deploy, migration ve panel değişikliği onayları"],
    access: ["Erişim Kilidi", "Owner-only oturum ve güvenli sınırlar"],
    permissions: ["Yetki Merkezi", "Rol verme, hesap durumu ve risk seviyesi kontrolü"],
    "module-map": ["Modül Haritası", "Ana sayfa modülleri ve gelecek operasyon hazırlığı"],
    users: ["Kullanıcı Yönetimi", "Hesap durumu, rol ve şüpheli kullanıcı kontrolü"],
    partners: ["Partner Başvuruları", "Onay, ret, inceleme ve mağaza doğrulama akışı"],
    modules: ["Modül Yönetimi", "Aktiflik, görünürlük, komisyon ve başvuru durumu"],
    system: ["Sistem Ayarları", "Bakım, ödeme, partner başvurusu ve komisyon kontrolleri"],
    security: ["Güvenlik Merkezi", "Başarısız giriş, IP, audit ve auto-defense sinyalleri"],
    audit: ["Audit Log", "Append-only kritik işlem kayıtları"]
  };

  function commandOutput() {
    return $("[data-command-output]");
  }

  function setCommandHeader(view) {
    const [title, subtitle] = ownerViewTitles[view] || ownerViewTitles.overview;
    const titleTarget = $("[data-command-title]");
    const subtitleTarget = $("[data-command-subtitle]");
    if (titleTarget) titleTarget.textContent = title;
    if (subtitleTarget) subtitleTarget.textContent = subtitle;
  }

  function ownerLine(label, value, action, risk) {
    const normalized = normalizeRisk(risk);
    const safeRisk = normalized === "warning" ? "high" : (normalized === "info" || normalized === "debug" ? "low" : normalized);
    const riskClass = risk ? ` sa-risk-${escape(safeRisk)}` : "";
    return `
      <div class="sa-line${riskClass}">
        <strong>${escape(label)}</strong>
        <span>${value || ""}</span>
        <small>${action || ""}</small>
      </div>
    `;
  }

  function ownerEmpty(message) {
    return `<div class="sa-empty">${escape(message || "Kayıt bulunamadı.")}</div>`;
  }

  function ownerLoading(label) {
    const target = commandOutput();
    if (target) target.innerHTML = ownerLine(label || "Yükleniyor", "Güvenli backend doğrulaması bekleniyor.", "", "medium");
  }

  function ownerSetOutput(html) {
    const target = commandOutput();
    if (target) target.innerHTML = html || ownerEmpty();
  }

  function ownerActiveView() {
    const active = document.querySelector("[data-view-target].is-active");
    return active ? active.dataset.viewTarget : "overview";
  }

  function openDrawer(title, html) {
    const drawer = $("[data-sa-drawer]");
    const titleTarget = $("[data-drawer-title]");
    const body = $("[data-drawer-body]");
    if (!drawer || !titleTarget || !body) return;
    titleTarget.textContent = title;
    body.innerHTML = html || ownerEmpty();
    drawer.hidden = false;
  }

  function closeDrawer() {
    const drawer = $("[data-sa-drawer]");
    if (drawer) drawer.hidden = true;
  }

  function ownerControlLinks(links) {
    const rows = (links || []).map((link) => ownerLine(
      link.label || link.key,
      `${escape(link.key || "route")} / risk: ${escape(link.risk_level || "low")}`,
      `<a href="${escape(link.href || "#")}">Aç</a>`,
      link.risk_level
    ));
    return rows.length ? rows.join("") : ownerEmpty("Yönlendirme bulunamadı.");
  }

  async function loadCommandCenter() {
    const payload = await api("/v1/control-center/command-center");
    state.commandCenter = payload;
    return payload;
  }

  async function loadOwnerSession() {
    const payload = await api("/v1/control-center/owner-session");
    state.ownerSession = payload;
    const roleTarget = $("[data-sa-role]");
    if (roleTarget) {
      const owner = payload.owner || {};
      roleTarget.textContent = `Owner kilidi: ${owner.email || owner.user_id || "doğrulandı"}`;
    }
    return payload;
  }

  async function loadOwnerOverview() {
    ownerLoading("Kontrol Merkezi");
    const payload = await loadCommandCenter();
    const summary = payload.summary || {};
    const system = payload.system_health || {};
    const gitops = payload.gitops || {};
    const owner = payload.owner || {};
    ownerSetOutput([
      ownerLine("Owner kilidi", `Sadece kayıtlı sahip: ${escape((owner.email || owner.user_id) || "doğrulandı")}`, "<button type=\"button\" data-view-jump=\"access\">Detay</button>", "critical"),
      owner.bootstrap_required ? ownerLine("Kalıcı Super Admin", "Owner doğrulandı; profil rolünü Super Admin yaparak kalıcı erişimi tamamla.", "<button type=\"button\" data-view-jump=\"permissions\">Yetki Merkezi</button>", "critical") : "",
      ownerLine("Toplam kullanıcı", formatNumber(summary.total_users), "<button type=\"button\" data-view-jump=\"users\">Yönet</button>", "medium"),
      ownerLine("Toplam partner", formatNumber(summary.total_partners), "<button type=\"button\" data-view-jump=\"partners\">Başvurular</button>", "medium"),
      ownerLine("Yetki merkezi", "Rol verme, askıya alma ve risk seviyesi owner-only backend RPC ile çalışır.", "<button type=\"button\" data-view-jump=\"permissions\">Aç</button>", "critical"),
      ownerLine("Ana sayfa modülleri", `${formatNumber(summary.homepage_modules)} modül / ${formatNumber(summary.future_operations)} gelecek operasyon`, "<button type=\"button\" data-view-jump=\"module-map\">Harita</button>", "medium"),
      ownerLine("Toplam sipariş", formatNumber(summary.total_orders), "<a href=\"./orders.html\">Sipariş merkezi</a>", "medium"),
      ownerLine("Günlük ciro", money(summary.daily_revenue), "<button type=\"button\" data-view-jump=\"system\">Finans ayarları</button>", "low"),
      ownerLine("Bekleyen başvuru", formatNumber(summary.pending_applications), "<button type=\"button\" data-view-jump=\"partners\">Karar ver</button>", summary.pending_applications ? "high" : "low"),
      ownerLine("Güvenlik uyarısı", `${formatNumber(summary.security_alerts_24h)} / son 24 saat`, "<button type=\"button\" data-view-jump=\"security\">İncele</button>", summary.security_alerts_24h ? "high" : "low"),
      ownerLine("Sistem sağlığı", `API ${escape(system.api || "-")} / DB ${escape(system.database || "-")} / Auto-defense ${formatNumber(system.auto_defense && system.auto_defense.recent_incident_count)} olay`, "<button type=\"button\" data-view-jump=\"alerts\">Risk akışı</button>", system.database === "online" ? "low" : "high"),
      ownerLine("Yayın hattı", gitops.enabled ? "Güvenli webhook açık" : "Onay kaydı açık, otomatik GitOps kapalı", "<button type=\"button\" data-release-open>Onay ver</button>", gitops.enabled ? "high" : "medium"),
      ownerLine("Hızlı erişim", "Admin, user, partner ve modül ekranlarına geçiş", "<button type=\"button\" data-open-links>Liste</button>", "low")
    ].join(""));
  }

  async function loadOwnerAlerts() {
    ownerLoading("Risk Akışı");
    const payload = state.commandCenter || await loadCommandCenter();
    const risks = payload.risks || [];
    ownerSetOutput(risks.length ? risks.map((risk) => ownerLine(
      risk.title || "Risk",
      escape(risk.message || "-"),
      risk.severity === "critical" ? "<button type=\"button\" data-view-jump=\"security\">Acil incele</button>" : "<button type=\"button\" data-view-jump=\"audit\">Audit</button>",
      risk.severity
    )).join("") : ownerLine("Risk", "Aktif kritik uyarı yok.", "", "low"));
  }

  async function loadOwnerApprovals() {
    ownerLoading("Yayın Onayları");
    const payload = await api("/v1/control-center/release-approvals?limit=80");
    state.approvals = payload.approvals || [];
    const header = ownerLine("Yeni onay", "Main commit/push, deploy veya migration için owner onayı oluştur.", "<button type=\"button\" data-release-open>Onay ver</button>", "critical");
    const rows = state.approvals.map((item) => ownerLine(
      `${item.approval_type} / ${item.status}`,
      `${escape(item.target_ref || "main")} - ${escape(item.target_summary || "-")}`,
      `<button type="button" data-approval-detail="${escape(item.id)}">Detay</button>`,
      item.risk_level
    ));
    ownerSetOutput(header + (rows.length ? rows.join("") : ownerEmpty("Yayın onayı kaydı yok.")));
  }

  async function loadOwnerAccess() {
    ownerLoading("Erişim Kilidi");
    const payload = state.ownerSession || await loadOwnerSession();
    const owner = payload.owner || {};
    const gitops = payload.gitops || {};
    ownerSetOutput([
      ownerLine("Owner doğrulaması", owner.owner_locked ? "Aktif ve backend tarafından doğrulandı." : "Doğrulanamadı.", "", owner.owner_locked ? "low" : "critical"),
      ownerLine("Kullanıcı", `${escape(owner.email || "-")} / ${escape(owner.user_id || "-")}`, "", "critical"),
      ownerLine("Rol + MFA", `${escape(owner.role || "-")} / MFA ${owner.mfa_verified ? "doğrulandı" : "eksik"}`, "", owner.mfa_verified ? "low" : "critical"),
      owner.bootstrap_required ? ownerLine("Bootstrap", "Kalıcı Super Admin rolü henüz tamamlanmamış. Yetki Merkezi'nden kendi hesabını Super Admin yap.", "<button type=\"button\" data-view-jump=\"permissions\">Tamamla</button>", "critical") : "",
      ownerLine("Kaynak", escape(owner.source || "unknown"), "", "medium"),
      ownerLine("GitOps", gitops.enabled ? "Açık" : "Kapalı", gitops.release_webhook_configured ? "Webhook hazır" : "Webhook yok", gitops.enabled && gitops.release_webhook_configured ? "high" : "medium"),
      ownerLine("Güvenlik sınırı", "Server-only gizli anahtarlar frontend içinde kullanılmaz; tüm yazma işlemleri backend + audit üzerinden yürür.", "", "critical")
    ].join(""));
  }

  function permissionFilterMarkup(params) {
    const role = params && params.role || "";
    const search = params && params.search || "";
    return `
      <form class="sa-inline-form" data-owner-permissions-filter>
        <input name="search" type="search" placeholder="Yetki verilecek kullanıcı ara" value="${escape(search)}">
        <select name="role">
          ${["", "customer", "partner", "courier", "admin", "super_admin"].map((item) => `<option value="${escape(item)}" ${role === item ? "selected" : ""}>${escape(item || "Tüm roller")}</option>`).join("")}
        </select>
        <button class="sa-btn sa-btn-ghost" type="submit">Filtrele</button>
      </form>
    `;
  }

  async function loadOwnerPermissions(params) {
    ownerLoading("Yetki Merkezi");
    const query = new URLSearchParams(params || {});
    const payload = await api(`/v1/control-center/permissions?${query.toString()}`);
    state.permissionUsers = payload.users || [];
    state.permissionChanges = payload.recent_changes || [];
    const guardrails = payload.guardrails || {};
    const rows = state.permissionUsers.map((user) => {
      const safeId = escape(user.id);
      const roleOptions = (payload.allowed_roles || ["customer", "partner", "courier", "admin", "super_admin"])
        .map((role) => `<option value="${escape(role)}" ${user.role === role ? "selected" : ""}>${escape(role)}</option>`)
        .join("");
      const statusOptions = ["active", "passive", "suspended"]
        .map((status) => `<option value="${status}" ${user.account_status === status ? "selected" : ""}>${escape(status)}</option>`)
        .join("");
      const riskOptions = ["low", "medium", "high", "critical"]
        .map((risk) => `<option value="${risk}" ${user.risk_level === risk ? "selected" : ""}>${escape(risk)}</option>`)
        .join("");
      return ownerLine(
        user.full_name || user.email || user.id,
        `${escape(user.email || user.phone || "-")} / mevcut rol ${escape(user.role || "customer")} / durum ${escape(user.account_status || "active")} / risk ${escape(user.risk_level || "low")}`,
        [
          `<select data-permission-role="${safeId}">${roleOptions}</select>`,
          `<select data-permission-status="${safeId}">${statusOptions}</select>`,
          `<select data-permission-risk="${safeId}">${riskOptions}</select>`,
          `<button type="button" data-permission-save="${safeId}">Yetki ver</button>`
        ].join(" "),
        user.role === "super_admin" ? "critical" : (user.role === "admin" ? "high" : user.risk_level)
      );
    });
    const changes = state.permissionChanges.slice(0, 8).map((item) => ownerLine(
      item.action || "permission",
      `${formatDate(item.created_at)} / ${escape(item.old_role || "-")} -> ${escape(item.new_role || "-")} / ${escape(item.reason || "-")}`,
      "",
      item.risk_level
    )).join("");
    ownerSetOutput(
      permissionFilterMarkup(params) +
      ownerLine("Koruma kuralı", `Super Admin rolü owner_access olmadan verilemez: ${guardrails.super_admin_requires_owner ? "aktif" : "pasif"} / reason zorunlu: ${guardrails.reason_required ? "aktif" : "pasif"}`, "", "critical") +
      (rows.length ? rows.join("") : ownerEmpty("Kullanıcı bulunamadı.")) +
      ownerLine("Son yetki değişiklikleri", `${formatNumber(state.permissionChanges.length)} kayıt`, "", "medium") +
      (changes || ownerEmpty("Yetki değişikliği kaydı yok."))
    );
  }

  async function updatePermission(button) {
    const userId = button.dataset.permissionSave;
    const safeId = cssEscape(userId);
    const role = $(`[data-permission-role="${safeId}"]`);
    const status = $(`[data-permission-status="${safeId}"]`);
    const risk = $(`[data-permission-risk="${safeId}"]`);
    const user = (state.permissionUsers || []).find((item) => item.id === userId);
    const message = `${user?.full_name || user?.email || "Kullanıcı"} için rol/durum/risk yetkisi güncellenecek.`;
    await runConfirmed(message, async (reason) => {
      await api(`/v1/control-center/permissions/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: {
          role: role && role.value,
          account_status: status && status.value,
          risk_level: risk && risk.value,
          flagged_suspicious: risk && ["high", "critical"].includes(risk.value),
          reason
        }
      });
    }, { requireReason: true });
  }

  async function loadOwnerModuleMap() {
    ownerLoading("Modül Haritası");
    const payload = await api("/v1/control-center/module-map");
    state.moduleMap = payload.modules || [];
    state.futureOperations = payload.future_operations || [];
    const rows = state.moduleMap.map((item) => ownerLine(
      item.name || item.module_key,
      `${escape(item.category || "-")} / ${escape(item.phase || "-")} / ${escape(item.maturity || "-")} / aktif ${item.is_active ? "evet" : "hayır"} / görünür ${item.is_visible ? "evet" : "hayır"} / komisyon ${formatNumber(Number(item.commission_rate || 0) * 100)}%`,
      `<a href="${escape(item.href || "#")}">Aç</a> <button type="button" data-module-map-detail="${escape(item.module_key)}">Operasyon</button>`,
      item.maturity === "controlled" ? "high" : (item.maturity === "transactional" || item.maturity === "operational" ? "medium" : "low")
    ));
    const future = state.futureOperations.map((item) => ownerLine(
      item.label || item.key,
      `${escape(item.status || "planned")} / risk ${escape(item.risk_level || "medium")}`,
      "<button type=\"button\" data-release-open>Yayın planı</button>",
      item.risk_level
    )).join("");
    ownerSetOutput(
      ownerLine("Kapsam", `${formatNumber(state.moduleMap.length)} ana sayfa modülü backend kontrol haritasına bağlı.`, "", "medium") +
      (rows.length ? rows.join("") : ownerEmpty("Modül haritası bulunamadı.")) +
      ownerLine("Gelecek operasyonlar", `${formatNumber(state.futureOperations.length)} hazırlık başlığı`, "", "high") +
      (future || "")
    );
  }

  function showModuleMapDetail(moduleKey) {
    const item = (state.moduleMap || []).find((moduleItem) => moduleItem.module_key === moduleKey);
    if (!item) return;
    openDrawer("Modül Operasyonu", [
      ownerLine("Modül", `${escape(item.name || item.module_key)} / ${escape(item.module_key)}`, `<a href="${escape(item.href || "#")}">Sayfayı aç</a>`, item.maturity === "controlled" ? "high" : "medium"),
      ownerLine("Durum", `${escape(item.phase || "-")} / ${escape(item.maturity || "-")} / kaynak ${escape(item.source || "-")}`, "", "medium"),
      ownerLine("Kontrol", `Aktif ${item.is_active ? "evet" : "hayır"} / görünür ${item.is_visible ? "evet" : "hayır"} / başvuru ${escape(item.application_status || "-")}`, "<button type=\"button\" data-view-jump=\"modules\">Ayarlar</button>", "medium"),
      ownerLine("Operasyonlar", escape((item.operations || []).join(", ") || "-"), "", item.maturity === "controlled" ? "high" : "low"),
      ownerLine("Yayın", "Bu modüldeki kritik içerik veya backend değişikliği Yayın Onayları üzerinden geçirilir.", "<button type=\"button\" data-release-open>Onay ver</button>", "critical")
    ].join(""));
  }

  function userFilterMarkup(params) {
    const role = params && params.role || "";
    const status = params && params.account_status || "";
    const search = params && params.search || "";
    return `
      <form class="sa-inline-form" data-owner-users-filter>
        <input name="search" type="search" placeholder="Kullanıcı ara" value="${escape(search)}">
        <select name="role">
          ${["", "customer", "partner", "courier", "admin", "super_admin"].map((item) => `<option value="${escape(item)}" ${role === item ? "selected" : ""}>${escape(item || "Tüm roller")}</option>`).join("")}
        </select>
        <select name="account_status">
          ${["", "active", "passive", "suspended"].map((item) => `<option value="${escape(item)}" ${status === item ? "selected" : ""}>${escape(item || "Tüm durumlar")}</option>`).join("")}
        </select>
        <button class="sa-btn sa-btn-ghost" type="submit">Filtrele</button>
      </form>
    `;
  }

  async function loadOwnerUsers(params) {
    ownerLoading("Kullanıcı Yönetimi");
    const query = new URLSearchParams(params || {});
    const payload = await api(`/v1/control-center/users?${query.toString()}`);
    state.users = payload.users || [];
    const rows = state.users.map((user) => ownerLine(
      user.full_name || user.email || user.id,
      `${escape(user.email || user.phone || "-")} / rol ${escape(user.role || "-")} / durum ${escape(user.account_status || "active")} / risk ${escape(user.risk_level || "low")}${user.flagged_suspicious ? " / şüpheli" : ""}`,
      [
        `<button type="button" data-user-action="active" data-user-id="${escape(user.id)}">Aktif</button>`,
        `<button type="button" data-user-action="passive" data-user-id="${escape(user.id)}">Pasif</button>`,
        `<button type="button" data-user-action="suspended" data-user-id="${escape(user.id)}">Askıya al</button>`,
        `<button type="button" data-user-action="suspicious" data-user-id="${escape(user.id)}">Şüpheli</button>`
      ].join(" "),
      user.risk_level
    ));
    ownerSetOutput(userFilterMarkup(params) + (rows.length ? rows.join("") : ownerEmpty("Kullanıcı kaydı bulunamadı.")));
  }

  async function loadOwnerPartners() {
    ownerLoading("Partner Başvuruları");
    const payload = await api("/v1/control-center/partners");
    state.applications = payload.applications || [];
    state.businesses = payload.businesses || [];
    const applicationRows = state.applications.map((item) => ownerLine(
      item.company_name || item.contact_name || item.id,
      `${escape(item.email || item.phone || "-")} / durum ${escape(item.status || "-")} / ${formatDate(item.created_at)}`,
      [
        `<button type="button" data-partner-decision="review" data-application-id="${escape(item.id)}">İnceleme</button>`,
        `<button type="button" data-partner-decision="approved" data-application-id="${escape(item.id)}">Onayla</button>`,
        `<button type="button" data-partner-decision="rejected" data-application-id="${escape(item.id)}">Reddet</button>`
      ].join(" "),
      item.status === "pending" ? "high" : "medium"
    ));
    const businessRows = state.businesses.map((item) => ownerLine(
      item.display_name || item.legal_name || item.id,
      `Mağaza ${escape(item.status || "-")} / doğrulama ${escape(item.verification_status || "-")} / komisyon ${formatNumber(Number(item.default_commission_rate || 0) * 100)}%`,
      "",
      item.status === "active" ? "low" : "medium"
    ));
    ownerSetOutput(
      ownerLine("Başvurular", `${formatNumber(state.applications.length)} kayıt`, "", state.applications.length ? "high" : "low") +
      (applicationRows.length ? applicationRows.join("") : ownerEmpty("Başvuru bulunamadı.")) +
      ownerLine("Mağazalar", `${formatNumber(state.businesses.length)} kayıt`, "", "medium") +
      (businessRows.length ? businessRows.join("") : "")
    );
  }

  async function loadOwnerSecurity() {
    ownerLoading("Güvenlik Merkezi");
    const payload = await api("/v1/control-center/security");
    const securityData = payload.security || {};
    const metrics = securityData.metrics || {};
    const ipRows = (securityData.suspicious_ips || []).map((item) => ownerLine(
      item.ip,
      `${formatNumber(item.count)} riskli olay`,
      "",
      "high"
    ));
    const eventRows = (securityData.recent_events || []).slice(0, 30).map((event) => ownerLine(
      event.action || "audit",
      `${formatDate(event.created_at)} / ${escape(event.resource_type || "-")} ${escape(event.resource_id || "")} / IP ${escape(event.ip_address || "-")}`,
      `<button type="button" data-event-detail="${escape(event.id || "")}">Detay</button>`,
      event.severity
    ));
    state.securityEvents = securityData.recent_events || [];
    ownerSetOutput([
      ownerLine("Başarısız giriş", formatNumber(metrics.failed_auth_24h), "Son 24 saat", metrics.failed_auth_24h ? "high" : "low"),
      ownerLine("Critical olay", formatNumber(metrics.critical_events_sample), "Son kayıtlar", metrics.critical_events_sample ? "critical" : "low"),
      ownerLine("Şüpheli IP", formatNumber(metrics.suspicious_ip_count), "", metrics.suspicious_ip_count ? "high" : "low"),
      ownerLine("Bloklu IP", formatNumber(metrics.blocked_ip_count), "Auto-defense", metrics.blocked_ip_count ? "high" : "low"),
      ipRows.join("") || ownerLine("Şüpheli IP", "Aktif IP uyarısı yok.", "", "low"),
      eventRows.join("") || ownerEmpty("Güvenlik kaydı bulunamadı.")
    ].join(""));
  }

  async function loadOwnerSystem() {
    ownerLoading("Sistem Ayarları");
    const payload = await api("/v1/control-center/settings");
    state.settings = payload.settings || [];
    const rows = state.settings.map((setting) => {
      const value = setting.setting_value;
      const isBoolean = setting.value_type === "boolean" || typeof value === "boolean";
      const control = isBoolean
        ? `<button class="sa-toggle" type="button" aria-pressed="${value === true}" data-setting-toggle="${escape(setting.setting_key)}"></button>`
        : `<input type="number" step="0.01" value="${escape(value)}" data-setting-input="${escape(setting.setting_key)}">`;
      return ownerLine(
        setting.label || setting.setting_key,
        `${escape(setting.category || "system")} / risk ${escape(setting.risk_level || "medium")} / değer ${escape(String(value))}`,
        `${control} <button type="button" data-setting-save="${escape(setting.setting_key)}">Kaydet</button>`,
        setting.risk_level
      );
    });
    const env = payload.env_flags || {};
    ownerSetOutput(
      ownerLine("Backend bayrakları", `Bakım ${env.maintenance_mode ? "açık" : "kapalı"} / API ${env.emergency_api_disabled ? "kapalı" : "aktif"} / ödeme ${env.payments_disabled ? "kapalı" : "aktif"}`, "", env.emergency_api_disabled || env.payments_disabled ? "critical" : "low") +
      (rows.length ? rows.join("") : ownerEmpty("Sistem ayarı bulunamadı."))
    );
  }

  async function loadOwnerModules() {
    ownerLoading("Modül Yönetimi");
    const payload = await api("/v1/control-center/modules");
    state.modules = payload.modules || [];
    const rows = state.modules.map((item) => ownerLine(
      item.name || item.module_key,
      `${escape(item.category || "services")} / aktif ${item.is_active ? "evet" : "hayır"} / görünür ${item.is_visible ? "evet" : "hayır"} / komisyon ${formatNumber(Number(item.commission_rate || 0) * 100)}% / başvuru ${escape(item.application_status || "-")}`,
      [
        `Aktif <button class="sa-toggle" type="button" aria-pressed="${item.is_active === true}" data-module-toggle="is_active" data-module-key="${escape(item.module_key)}"></button>`,
        `Görünür <button class="sa-toggle" type="button" aria-pressed="${item.is_visible === true}" data-module-toggle="is_visible" data-module-key="${escape(item.module_key)}"></button>`,
        `<input type="number" min="0" max="90" step="0.1" value="${escape(Number(item.commission_rate || 0) * 100)}" data-module-commission="${escape(item.module_key)}">`,
        `<select data-module-application="${escape(item.module_key)}">${["open", "review_only", "closed"].map((status) => `<option value="${status}" ${item.application_status === status ? "selected" : ""}>${escape(status)}</option>`).join("")}</select>`,
        `<button type="button" data-module-save="${escape(item.module_key)}">Kaydet</button>`
      ].join(" "),
      item.is_active && item.is_visible ? "low" : "medium"
    ));
    ownerSetOutput(rows.length ? rows.join("") : ownerEmpty("Modül kaydı bulunamadı."));
  }

  async function loadOwnerAudit() {
    ownerLoading("Audit Log");
    const payload = await api("/v1/control-center/audit-log?limit=120");
    state.auditEvents = payload.events || [];
    const rows = state.auditEvents.map((event) => ownerLine(
      event.action || "audit",
      `${formatDate(event.created_at)} / ${escape(event.actor_role || "-")} / ${escape(event.resource_type || "-")} ${escape(event.resource_id || "")} / IP ${escape(event.ip_address || "-")}`,
      `<button type="button" data-event-detail="${escape(event.id || "")}">Detay</button>`,
      event.severity
    ));
    ownerSetOutput(rows.length ? rows.join("") : ownerEmpty("Audit kaydı bulunamadı."));
  }

  async function loadOwnerView(view, params) {
    setAlert("");
    setCommandHeader(view);
    try {
      if (view === "overview") await loadOwnerOverview();
      else if (view === "alerts") await loadOwnerAlerts();
      else if (view === "approvals") await loadOwnerApprovals();
      else if (view === "access") await loadOwnerAccess();
      else if (view === "permissions") await loadOwnerPermissions(params);
      else if (view === "module-map") await loadOwnerModuleMap();
      else if (view === "users") await loadOwnerUsers(params);
      else if (view === "partners") await loadOwnerPartners();
      else if (view === "modules") await loadOwnerModules();
      else if (view === "system") await loadOwnerSystem();
      else if (view === "security") await loadOwnerSecurity();
      else if (view === "audit") await loadOwnerAudit();
    } catch (error) {
      ownerSetOutput(ownerLine("Erişim engellendi", escape(publicError(error, "Süper Admin verisi alınamadı.")), "", "critical"));
      setAlert(publicError(error, "Panel verisi yüklenemedi."));
    }
  }

  async function reloadOwnerActiveView() {
    await loadOwnerView(ownerActiveView());
  }

  function jumpOwnerView(view) {
    document.querySelectorAll("[data-view-target]").forEach((item) => item.classList.toggle("is-active", item.dataset.viewTarget === view));
    return loadOwnerView(view);
  }

  function openReleaseModal() {
    const modal = $("[data-release-modal]");
    if (modal) modal.hidden = false;
  }

  function closeReleaseModal() {
    const modal = $("[data-release-modal]");
    if (modal) modal.hidden = true;
  }

  async function submitReleaseApproval(form) {
    const formData = new FormData(form);
    const payload = {
      approval_type: String(formData.get("approval_type") || "main_commit_push"),
      target_ref: String(formData.get("target_ref") || "main").trim(),
      target_summary: String(formData.get("target_summary") || "").trim(),
      risk_level: String(formData.get("risk_level") || "critical"),
      metadata: {
        source: "super_admin_owner_console"
      }
    };
    closeReleaseModal();
    const confirmed = await confirmAction("Bu owner onayı audit log'a yazılacak ve yapılandırılmışsa güvenli yayın webhook'u tetiklenecek.", { requireReason: true });
    if (!confirmed.confirmed) return;
    payload.metadata.reason = confirmed.reason;
    try {
      const result = await api("/v1/control-center/release-approvals", {
        method: "POST",
        body: payload
      });
      setAlert(`Yayın onayı kaydedildi: ${result.approval && result.approval.status || "approved"}`, "ok");
      await jumpOwnerView("approvals");
      form.reset();
      const targetRef = form.querySelector("[name='target_ref']");
      if (targetRef) targetRef.value = "main";
    } catch (error) {
      setAlert(publicError(error, "Yayın onayı oluşturulamadı."));
    }
  }

  function showApprovalDetail(id) {
    const item = (state.approvals || []).find((approval) => approval.id === id);
    if (!item) return;
    openDrawer("Yayın Onayı", [
      ownerLine("Tip", escape(item.approval_type || "-"), "", item.risk_level),
      ownerLine("Durum", escape(item.status || "-"), "", item.risk_level),
      ownerLine("Hedef", escape(item.target_ref || "-"), "", "medium"),
      ownerLine("Özet", escape(item.target_summary || "-"), "", "medium"),
      ownerLine("Webhook", `${escape(String(item.webhook_status || "-"))} / ${escape(JSON.stringify(item.webhook_response || {}).slice(0, 500))}`, "", item.status === "failed" ? "critical" : "low"),
      ownerLine("Tarih", formatDate(item.created_at), "", "low")
    ].join(""));
  }

  function showEventDetail(id) {
    const events = [...(state.securityEvents || []), ...(state.auditEvents || [])];
    const item = events.find((event) => String(event.id) === String(id));
    if (!item) return;
    openDrawer("Audit Detayı", [
      ownerLine("İşlem", escape(item.action || "-"), "", item.severity),
      ownerLine("Kayıt", `${escape(item.resource_type || "-")} / ${escape(item.resource_id || "-")}`, "", "medium"),
      ownerLine("Aktör", `${escape(item.actor_role || "-")} / ${escape(item.actor_id || "-")}`, "", "medium"),
      ownerLine("IP", escape(item.ip_address || "-"), "", item.severity),
      ownerLine("Metadata", escape(JSON.stringify(item.metadata || {}).slice(0, 1200)), "", "medium"),
      ownerLine("Tarih", formatDate(item.created_at), "", "low")
    ].join(""));
  }

  function bindOwnerConsole() {
    const nav = $("[data-sa-nav]");
    if (nav) {
      nav.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-view-target]");
        if (!button) return;
        document.querySelectorAll("[data-view-target]").forEach((item) => item.classList.toggle("is-active", item === button));
        await loadOwnerView(button.dataset.viewTarget);
      });
    }

    document.addEventListener("submit", async (event) => {
      const usersFilter = event.target.closest("[data-owner-users-filter]");
      if (usersFilter) {
        event.preventDefault();
        const form = new FormData(usersFilter);
        const params = {};
        ["search", "role", "account_status"].forEach((key) => {
          const value = String(form.get(key) || "").trim();
          if (value) params[key] = value;
        });
        await loadOwnerUsers(params);
        return;
      }

      const permissionsFilter = event.target.closest("[data-owner-permissions-filter]");
      if (permissionsFilter) {
        event.preventDefault();
        const form = new FormData(permissionsFilter);
        const params = {};
        ["search", "role"].forEach((key) => {
          const value = String(form.get(key) || "").trim();
          if (value) params[key] = value;
        });
        await loadOwnerPermissions(params);
        return;
      }

      const releaseForm = event.target.closest("[data-release-form]");
      if (releaseForm) {
        event.preventDefault();
        await submitReleaseApproval(releaseForm);
      }
    });

    document.addEventListener("click", async (event) => {
      const toggle = event.target.closest(".sa-toggle");
      if (toggle) {
        toggle.setAttribute("aria-pressed", toggle.getAttribute("aria-pressed") !== "true");
      }

      const viewJump = event.target.closest("[data-view-jump]");
      if (viewJump) await jumpOwnerView(viewJump.dataset.viewJump);

      if (event.target.closest("[data-release-open]")) openReleaseModal();
      if (event.target.closest("[data-release-cancel]")) closeReleaseModal();
      if (event.target.closest("[data-drawer-close]")) closeDrawer();

      if (event.target.closest("[data-open-links]")) {
        const payload = state.commandCenter || await loadCommandCenter();
        openDrawer("Hızlı Erişim", ownerControlLinks(payload.control_links || []));
      }

      const approvalDetail = event.target.closest("[data-approval-detail]");
      if (approvalDetail) showApprovalDetail(approvalDetail.dataset.approvalDetail);

      const eventDetail = event.target.closest("[data-event-detail]");
      if (eventDetail) showEventDetail(eventDetail.dataset.eventDetail);

      const moduleMapDetail = event.target.closest("[data-module-map-detail]");
      if (moduleMapDetail) showModuleMapDetail(moduleMapDetail.dataset.moduleMapDetail);

      const permissionSave = event.target.closest("[data-permission-save]");
      if (permissionSave) await updatePermission(permissionSave);

      const userAction = event.target.closest("[data-user-action]");
      if (userAction) await updateUserAction(userAction);

      const partnerDecision = event.target.closest("[data-partner-decision]");
      if (partnerDecision) await decidePartner(partnerDecision);

      const settingSave = event.target.closest("[data-setting-save]");
      if (settingSave) await saveSetting(settingSave);

      const moduleSave = event.target.closest("[data-module-save]");
      if (moduleSave) await saveModule(moduleSave);
    });

    const refresh = $("[data-sa-refresh]");
    if (refresh) refresh.addEventListener("click", reloadOwnerActiveView);

    const signOut = $("[data-sa-signout]");
    if (signOut) {
      signOut.addEventListener("click", () => {
        App.auth.signOut({ scope: "local" });
      });
    }
  }

  async function initOwnerConsole() {
    state.access = await App.auth.requireRole(["super_admin"]);
    if (!state.access) return;
    bindOwnerConsole();
    await loadOwnerSession();
    await loadOwnerView("overview");
  }

  function bindInteractions() {
    const nav = $("[data-sa-nav]");
    if (nav) {
      nav.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-view-target]");
        if (!button) return;
        document.querySelectorAll("[data-view-target]").forEach((item) => item.classList.toggle("is-active", item === button));
        document.querySelectorAll("[data-view]").forEach((view) => view.classList.toggle("is-active", view.dataset.view === button.dataset.viewTarget));
        await reloadActiveView();
      });
    }

    const filters = $("[data-users-filter]");
    if (filters) {
      filters.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = new FormData(filters);
        const params = {};
        ["search", "role", "account_status"].forEach((key) => {
          const value = String(form.get(key) || "").trim();
          if (value) params[key] = value;
        });
        try {
          await loadUsers(params);
        } catch (error) {
          setAlert(publicError(error, "Kullanıcılar yüklenemedi."));
        }
      });
    }

    document.addEventListener("click", async (event) => {
      const toggle = event.target.closest(".sa-toggle");
      if (toggle) {
        toggle.setAttribute("aria-pressed", toggle.getAttribute("aria-pressed") !== "true");
      }

      const userAction = event.target.closest("[data-user-action]");
      if (userAction) await updateUserAction(userAction);

      const partnerDecision = event.target.closest("[data-partner-decision]");
      if (partnerDecision) await decidePartner(partnerDecision);

      const settingSave = event.target.closest("[data-setting-save]");
      if (settingSave) await saveSetting(settingSave);

      const moduleSave = event.target.closest("[data-module-save]");
      if (moduleSave) await saveModule(moduleSave);
    });

    const refresh = $("[data-sa-refresh]");
    if (refresh) refresh.addEventListener("click", reloadAll);

    const signOut = $("[data-sa-signout]");
    if (signOut) {
      signOut.addEventListener("click", () => {
        App.auth.signOut({ scope: "local" });
      });
    }
  }

  function activeView() {
    const view = $(".sa-view.is-active");
    return view ? view.dataset.view : "dashboard";
  }

  async function reloadActiveView() {
    setAlert("");
    const loader = viewLoaders[activeView()];
    if (!loader) return;
    try {
      await loader();
    } catch (error) {
      setAlert(publicError(error, "Panel verisi yüklenemedi."));
    }
  }

  async function reloadAll() {
    setAlert("");
    for (const loader of [loadDashboard, loadUsers, loadPartners, loadSecurity, loadSettings, loadModules, loadAuditLog]) {
      try {
        await loader();
      } catch (error) {
        setAlert(publicError(error, "Bazı panel verileri yüklenemedi."));
      }
    }
  }

  async function init() {
    if (!document.querySelector("[data-page='super-admin']")) return;
    if ($("[data-command-output]")) {
      try {
        await initOwnerConsole();
      } catch (error) {
        const shell = $("[data-super-admin-shell]");
        if (shell) {
          shell.innerHTML = loginFallback(publicError(error, "Bu panele sadece kayıtlı Super Admin sahibi erişebilir."));
        }
      }
      return;
    }
    try {
      state.access = await App.auth.requireRole(["super_admin"]);
      if (!state.access) return;
      const roleTarget = $("[data-sa-role]");
      if (roleTarget) roleTarget.textContent = state.access.profile.role;
      bindInteractions();
      await reloadAll();
    } catch (error) {
      const shell = $("[data-super-admin-shell]");
      if (shell) {
        shell.innerHTML = loginFallback(publicError(error, "Bu panele sadece Super Admin erişebilir."));
      }
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
