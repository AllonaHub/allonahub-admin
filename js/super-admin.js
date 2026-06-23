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
    modules: [],
    adminOps: null
  };

  const viewLoaders = {
    dashboard: loadDashboard,
    users: loadUsers,
    partners: loadPartners,
    security: loadSecurity,
    adminOps: loadAdminOps,
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
    return core.url(`/pages/account/login.html?returnTo=${returnTo}`);
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

  async function loadAdminOps() {
    const payload = await api("/v1/control-center/admin-ops");
    state.adminOps = payload.admin_ops || {};
    const data = state.adminOps;
    const admins = data.admins || [];
    const profiles = data.permission_profiles || [];
    const assignments = data.assignments || [];
    const approvals = data.approval_requests || [];
    const alerts = data.emergency_alerts || [];
    const assignmentByAdmin = new Map(assignments.map((item) => [item.admin_user_id, item]));

    const adminTarget = $("[data-admin-ops-admins]");
    const profileTarget = $("[data-admin-ops-profiles]");
    const approvalTarget = $("[data-admin-ops-approvals]");
    const alertTarget = $("[data-admin-ops-alerts]");

    $("[data-admin-ops-admin-count]").textContent = `${formatNumber(admins.length)} kayıt`;
    $("[data-admin-ops-approval-count]").textContent = `${formatNumber(approvals.length)} kayıt`;
    $("[data-admin-ops-alert-count]").textContent = `${formatNumber(alerts.length)} kayıt`;

    if (adminTarget) {
      if (!admins.length) {
        renderEmpty(adminTarget, "Admin kullanıcısı bulunamadı.");
      } else {
        adminTarget.innerHTML = `
          <table class="sa-table">
            <thead><tr><th>Admin</th><th>Durum</th><th>Yetki Profili</th><th>İşlem</th></tr></thead>
            <tbody>
              ${admins.map((admin) => {
                const assignment = assignmentByAdmin.get(admin.id) || {};
                return `
                  <tr>
                    <td><strong>${escape(admin.full_name || "-")}</strong><br><small>${escape(admin.email || admin.phone || admin.id)}</small></td>
                    <td>${statusLabel(admin.account_status || "active")}<br><small>${escape(admin.risk_level || "low")}</small></td>
                    <td>
                      <select data-admin-profile-select="${escape(admin.id)}">
                        ${profiles.map((profile) => `<option value="${escape(profile.profile_key)}" ${assignment.profile_key === profile.profile_key ? "selected" : ""}>${escape(profile.label || profile.profile_key)}</option>`).join("")}
                      </select>
                      <small>${escape(assignment.status || "atanmadı")}</small>
                    </td>
                    <td>
                      <button class="sa-btn sa-mini" type="button" data-admin-profile-save="${escape(admin.id)}">Kaydet</button>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        `;
      }
    }

    if (profileTarget) {
      profileTarget.innerHTML = profiles.length ? profiles.map((profile) => {
        const permissionCount = Object.values(profile.permissions || {}).filter(Boolean).length;
        return `
          <div class="sa-list-item">
            <strong>${escape(profile.label || profile.profile_key)}</strong>
            <span>${escape(profile.profile_key)} / ${formatNumber(permissionCount)} izin</span>
          </div>
        `;
      }).join("") : `<div class="sa-empty">Yetki profili bulunamadı.</div>`;
    }

    if (approvalTarget) {
      if (!approvals.length) {
        renderEmpty(approvalTarget, "Onay talebi bulunamadı.");
      } else {
        approvalTarget.innerHTML = `
          <table class="sa-table">
            <thead><tr><th>Talep</th><th>Hedef</th><th>Durum</th><th>Tarih</th><th>İşlem</th></tr></thead>
            <tbody>
              ${approvals.map((item) => `
                <tr>
                  <td><strong>${escape(item.request_type || "-")}</strong><br><small>${escape(item.summary || "-")}</small></td>
                  <td>${escape(item.target_type || "-")}<br><small>${escape(item.target_id || "-")}</small></td>
                  <td>${statusLabel(item.status)}</td>
                  <td>${formatDate(item.created_at)}</td>
                  <td>
                    <div class="sa-row-actions">
                      <button class="sa-btn sa-mini" type="button" data-admin-approval-decision="approved" data-request-id="${escape(item.id)}" ${item.status !== "pending_super_admin" ? "disabled" : ""}>Onayla</button>
                      <button class="sa-btn sa-btn-danger sa-mini" type="button" data-admin-approval-decision="rejected" data-request-id="${escape(item.id)}" ${item.status !== "pending_super_admin" ? "disabled" : ""}>Reddet</button>
                      <button class="sa-btn sa-btn-ghost sa-mini" type="button" data-admin-approval-decision="cancelled" data-request-id="${escape(item.id)}" ${item.status !== "pending_super_admin" ? "disabled" : ""}>İptal</button>
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      }
    }

    if (alertTarget) {
      if (!alerts.length) {
        renderEmpty(alertTarget, "Acil alarm bulunamadı.");
      } else {
        alertTarget.innerHTML = `
          <table class="sa-table">
            <thead><tr><th>Alarm</th><th>Risk</th><th>Kapsam</th><th>Durum</th><th>İşlem</th></tr></thead>
            <tbody>
              ${alerts.map((item) => `
                <tr>
                  <td><strong>${escape(item.title || "-")}</strong><br><small>${escape(item.message || "-")}</small></td>
                  <td>${riskLabel(item.severity || "medium")}</td>
                  <td>${escape(item.scope || "platform")}</td>
                  <td>${statusLabel(item.status)}</td>
                  <td>
                    <div class="sa-row-actions">
                      <button class="sa-btn sa-mini" type="button" data-emergency-status="active" data-alert-id="${escape(item.id)}" ${item.status === "active" ? "disabled" : ""}>Aktif</button>
                      <button class="sa-btn sa-btn-ghost sa-mini" type="button" data-emergency-status="resolved" data-alert-id="${escape(item.id)}" ${item.status === "resolved" ? "disabled" : ""}>Çözüldü</button>
                      <button class="sa-btn sa-btn-danger sa-mini" type="button" data-emergency-status="cancelled" data-alert-id="${escape(item.id)}" ${item.status === "cancelled" ? "disabled" : ""}>İptal</button>
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      }
    }

    if (payload.schema_warnings?.length) {
      setAlert("Admin Ops migration/policy uyarısı var.");
    }
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
      await reloadActiveView();
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

  async function saveAdminProfile(button) {
    const adminId = button.dataset.adminProfileSave;
    const safeId = cssEscape(adminId);
    const select = $(`[data-admin-profile-select="${safeId}"]`);
    const profileKey = select && select.value;
    if (!profileKey) return;
    await runConfirmed("Admin yetki profili güncellenecek.", async (reason) => {
      await api("/v1/control-center/admin-ops/assignments", {
        method: "POST",
        body: {
          admin_user_id: adminId,
          profile_key: profileKey,
          status: "active",
          notes: reason || `Profile ${profileKey}`
        }
      });
    }, { requireReason: true });
  }

  async function decideAdminApproval(button) {
    const requestId = button.dataset.requestId;
    const decision = button.dataset.adminApprovalDecision;
    const message = decision === "approved"
      ? "Admin onay talebi kabul edilecek."
      : decision === "rejected"
      ? "Admin onay talebi reddedilecek."
      : "Admin onay talebi iptal edilecek.";
    await runConfirmed(message, async (reason) => {
      await api(`/v1/control-center/admin-ops/approval-requests/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        body: { decision, reason }
      });
    }, { requireReason: true });
  }

  async function updateEmergencyStatus(button) {
    const alertId = button.dataset.alertId;
    const status = button.dataset.emergencyStatus;
    const message = status === "active"
      ? "Acil alarm aktif yayına alınacak."
      : status === "resolved"
      ? "Acil alarm çözüldü olarak kapatılacak."
      : "Acil alarm iptal edilecek.";
    await runConfirmed(message, async (reason) => {
      await api(`/v1/control-center/emergency-alerts/${encodeURIComponent(alertId)}`, {
        method: "PATCH",
        body: { status, reason }
      });
    }, { requireReason: true });
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

      const adminProfileSave = event.target.closest("[data-admin-profile-save]");
      if (adminProfileSave) await saveAdminProfile(adminProfileSave);

      const adminApprovalDecision = event.target.closest("[data-admin-approval-decision]");
      if (adminApprovalDecision) await decideAdminApproval(adminApprovalDecision);

      const emergencyStatus = event.target.closest("[data-emergency-status]");
      if (emergencyStatus) await updateEmergencyStatus(emergencyStatus);
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
    for (const loader of [loadDashboard, loadUsers, loadPartners, loadSecurity, loadAdminOps, loadSettings, loadModules, loadAuditLog]) {
      try {
        await loader();
      } catch (error) {
        setAlert(publicError(error, "Bazı panel verileri yüklenemedi."));
      }
    }
  }

  async function init() {
    if (!document.querySelector("[data-page='super-admin']")) return;
    try {
      state.access = await App.auth.requireRole(["super_admin"]);
      if (!state.access) return;
      const roleTarget = $("[data-sa-role]");
      if (roleTarget) roleTarget.textContent = state.access.profile.role;
      const loginLink = $("[data-sa-login]");
      if (loginLink) {
        loginLink.href = loginUrl();
        loginLink.hidden = true;
      }
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
