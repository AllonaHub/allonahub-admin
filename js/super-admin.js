(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const security = App.security;
  const config = App.config || {};

  const state = {
    access: null,
    ownerShellMarkup: "",
    users: [],
    applications: [],
    businesses: [],
    settings: [],
    modules: [],
    maritimeTrust: null,
    marsohModeration: [],
    marsohReports: [],
    marsohSanctions: [],
    marsohChannels: [],
    marsohTopics: [],
    marsohMessages: [],
    marsohAudit: [],
    marsohMessageCursor: null
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

  const SUPER_ADMIN_ENTRY_ROLES = ["admin", "super_admin"];

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function eventClosest(event, selector) {
    const target = event && event.target;
    if (!target) return null;
    const element = target.closest ? target : target.parentElement;
    return element && element.closest ? element.closest(selector) : null;
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
    return core.url(`/pages/account/user.html?tab=login&switchAccount=1&intent=super_admin&v=20260624-switchsuper1&returnTo=${returnTo}`);
  }

  function mfaUrl() {
    const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    return core.url(`/pages/account/mfa.html?returnTo=${returnTo}`);
  }

  async function redirectToMfaForPrivilegedSession() {
    if (!App.auth || !App.auth.mfaStatus) return false;
    const status = await App.auth.mfaStatus();
    if (status && status.authenticated && !status.mfaVerified) {
      window.location.href = mfaUrl();
      return true;
    }
    return false;
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

  function rawErrorMessage(error) {
    return String([
      error && error.message,
      error && error.details,
      error && error.hint,
      error && error.payload && error.payload.message,
      error && error.payload && error.payload.error
    ].filter(Boolean).join(" ")).trim();
  }

  function superAdminAccessDiagnosis(error, fallback) {
    const raw = rawErrorMessage(error);
    const base = {
      mode: "locked",
      message: publicError(error, fallback || "Super Admin erişimi doğrulanamadı."),
      helper: "Oturum doğrulandı ancak owner kilidi veya Super Admin API yetkisi tamamlanmadı.",
      steps: [
        "MFA2 doğrulamasını tamamla.",
        "Backend owner allowlist ve Supabase owner kaydını kontrol et.",
        "ADMIN_IP_ALLOWLIST tanımlıysa mevcut public IP adresini ekle."
      ]
    };

    if (/oturum|session|jwt|token|giriş|login/i.test(raw)) {
      return {
        ...base,
        mode: "login",
        message: "Süper Admin için önce owner hesabıyla giriş yapılmalı.",
        helper: "Oturum doğrulanamadı veya süresi doldu.",
        steps: ["Owner hesabıyla tekrar giriş yap.", "Girişten sonra Super Admin sayfasına geri dön."]
      };
    }

    if (/mfa|iki aşamalı|2fa|aal2/i.test(raw)) {
      return {
        ...base,
        mode: "mfa",
        message: "Super Admin paneli için MFA2 doğrulaması gerekiyor.",
        helper: "Owner oturumu açık, ancak Supabase AAL2/MFA doğrulaması tamamlanmadı.",
        steps: ["MFA2 sayfasına git.", "6 haneli doğrulama kodunu tamamla.", "Sonra Super Admin paneline geri dön."]
      };
    }

    if (/owner kilidi yapılandırılmadı|SUPER_ADMIN_OWNER_USER_IDS|SUPER_ADMIN_OWNER_EMAILS/i.test(raw)) {
      return {
        ...base,
        message: "Owner kilidi henüz backend tarafında tanımlı değil.",
        helper: "API fail-closed çalışıyor: en az bir owner e-posta/id allowlist değeri zorunlu.",
        steps: [
          "Hetzner/API env içine SUPER_ADMIN_OWNER_EMAILS veya SUPER_ADMIN_OWNER_USER_IDS ekle.",
          "Supabase'de public.super_admin_owner_access tablosuna active owner satırı ekle.",
          "Backend API servisini yeniden başlat."
        ]
      };
    }

    if (/sadece kayıtlı super admin sahibi|owner_denied|owner.*denied/i.test(raw)) {
      return {
        ...base,
        message: "Bu hesap owner allowlist ile eşleşmedi.",
        helper: "Giriş yapılan e-posta veya Supabase user id owner kaydında active değil.",
        steps: [
          "Giriş yaptığın e-postayı SUPER_ADMIN_OWNER_EMAILS içine küçük harfle ekle.",
          "Aynı hesabı public.super_admin_owner_access tablosunda active yap.",
          "Hesap rolün admin ise panel içinden kendini kalıcı super_admin rolüne yükselt."
        ]
      };
    }

    if (/admin ip|ip doğrulaması|ip allow/i.test(raw)) {
      return {
        ...base,
        message: "Super Admin IP allowlist bu bağlantıyı kabul etmiyor.",
        helper: "ADMIN_IP_ALLOWLIST doluysa sadece listedeki public IP adresleri geçebilir.",
        steps: [
          "Sabit IP kullanmıyorsan ADMIN_IP_ALLOWLIST değerini boş bırak.",
          "Sabit IP kullanıyorsan mevcut public IP adresini virgülle ayrılmış listeye ekle.",
          "Backend API servisini yeniden başlat."
        ]
      };
    }

    if (/admin ağı|admin host|host/i.test(raw)) {
      return {
        ...base,
        message: "Admin host sınırı bu isteği kabul etmedi.",
        helper: "API isteği ADMIN_HOSTS içinde izinli hosttan gelmeli.",
        steps: [
          "ADMIN_HOSTS içinde api.allonahub.com bulunduğunu kontrol et.",
          "Admin alan adı kullanılıyorsa admin.allonahub.com değerini koru.",
          "Backend API servisini yeniden başlat."
        ]
      };
    }

    if (/super admin yetkisi|super_admin|role|rol/i.test(raw)) {
      return {
        ...base,
        message: "Owner doğrulandı ama kalıcı Super Admin rolü tamamlanmamış olabilir.",
        helper: "Owner bootstrap ile giriş yaptıktan sonra Yetki Merkezi'nden kendi hesabını super_admin yapmalısın.",
        steps: [
          "Erişim Kilidi sayfasında bootstrap_required durumunu kontrol et.",
          "Yetki Merkezi'nden kendi hesabına super_admin rolü ver.",
          "İşlem için gerekçe gir; audit log'a yazılır."
        ]
      };
    }

    return base;
  }

  function yesNo(value) {
    return value ? "evet" : "hayır";
  }

  function ownerPreflightAccessDiagnosis(payload, fallbackDiagnosis) {
    const preflight = payload && payload.preflight || {};
    const owner = preflight.owner || {};
    const env = owner.env || {};
    const database = owner.database || {};
    const envMatched = env.matched_by_user_id || env.matched_by_email;
    const ownerWarning = owner.warning || database.warning;
    const steps = [
      `API'nin gördüğü e-posta: ${preflight.email || owner.email || "-"}`,
      `Profil rolü: ${preflight.role || "-"} / MFA2: ${yesNo(preflight.mfa_verified)}`,
      `ENV owner allowlist: ${yesNo(env.configured)} / eşleşme: ${yesNo(envMatched)}`,
      `Supabase owner kaydı: ${yesNo(database.configured)} / eşleşme: ${yesNo(database.matched)}`,
      owner.next_step || "Owner kilidi tamamlanmalı."
    ];

    if (ownerWarning) {
      return {
        ...fallbackDiagnosis,
        mode: "locked",
        message: "API super_admin_owner_access tablosunu göremiyor.",
        helper: ownerWarning.message || "Owner migration üretim Supabase projesinde eksik görünüyor.",
        steps
      };
    }

    if (!owner.configured) {
      return {
        ...fallbackDiagnosis,
        mode: "locked",
        message: "API owner kaydını ne ENV'de ne Supabase'de görüyor.",
        helper: "Sorun frontend veya Coolify ekranı değil; API'nin bağlı olduğu Supabase/env owner kaydı boş.",
        steps
      };
    }

    if (!owner.matched) {
      const canRepairOwner = Boolean(
        database.configured &&
        preflight.mfa_verified &&
        SUPER_ADMIN_ENTRY_ROLES.includes(preflight.role)
      );
      return {
        ...fallbackDiagnosis,
        mode: "locked",
        message: "Owner kaydı var ama giriş yapan hesapla eşleşmiyor.",
        helper: canRepairOwner
          ? "Bu admin+MFA oturumu owner kaydını tek seferlik bu hesapla eşleştirebilir."
          : "Supabase owner satırındaki e-posta veya user_id, bu oturumdaki hesapla aynı olmalı.",
        can_repair_owner: canRepairOwner,
        steps
      };
    }

    if (owner.matched && !SUPER_ADMIN_ENTRY_ROLES.includes(preflight.role)) {
      return {
        ...fallbackDiagnosis,
        mode: "locked",
        message: "Owner doğrulandı; Super Admin yetkisini tamamla.",
        helper: "Bu hesap owner allowlist ile eşleşiyor fakat profil rolü henüz super_admin değil.",
        can_bootstrap_owner: true,
        steps
      };
    }

    return {
      ...fallbackDiagnosis,
      mode: "locked",
      message: preflight.role === "admin"
        ? "Owner doğrulandı; kalıcı Super Admin rolü tamamlanmalı."
        : "Owner preflight doğrulandı; paneli yeniden yükle.",
      helper: preflight.role === "admin"
        ? "Admin owner bootstrap açık; Yetki Merkezi'nden kendi hesabına super_admin rolü ver."
        : "API owner kilidini görüyor ve bu oturumla eşleştiriyor.",
      can_open_panel: owner.matched && preflight.role === "super_admin" && preflight.mfa_verified,
      preflight_payload: payload,
      steps
    };
  }

  async function loadOwnerPreflightDiagnosis(fallbackDiagnosis) {
    try {
      const payload = await api("/v1/control-center/owner-preflight");
      return ownerPreflightAccessDiagnosis(payload, fallbackDiagnosis);
    } catch (error) {
      return fallbackDiagnosis;
    }
  }

  function accessFallback(message, options) {
    const mode = options && options.mode || "login";
    const diagnosis = options && options.diagnosis || {};
    const opensPanel = Boolean(diagnosis.can_open_panel || mode === "panel");
    const primaryHref = mode === "mfa" ? mfaUrl() : loginUrl();
    const primaryLabel = mode === "mfa" ? "MFA2 Doğrulamasına Git" : "Süper Admin Olarak Giriş Yap";
    const helper = opensPanel
      ? diagnosis.helper || "Owner kilidi doğrulandı; Super Admin konsolu açılabilir."
      : mode === "mfa"
      ? "Oturum açık görünüyor; Super Admin için MFA2 doğrulaması tamamlanmalı."
      : mode === "locked"
        ? diagnosis.helper || "Oturum doğrulandı ancak owner kilidi veya Super Admin API yetkisi tamamlanmadı."
        : "Bu alana erişmek için süper admin hesabınızla giriş yapmalısınız.";
    const steps = Array.isArray(diagnosis.steps) ? diagnosis.steps : [];

    return `
      <main class="sa-main">
        <div class="sa-login-panel">
          <h1>Süper Admin Girişi</h1>
          <p>${escape(message || helper)}</p>
          <p>${escape(helper)}</p>
          ${steps.length ? `
            <div class="sa-empty">
              ${steps.map((step) => `<div>${escape(step)}</div>`).join("")}
            </div>
          ` : ""}
          ${diagnosis.can_repair_owner ? `<button class="sa-btn sa-btn-danger" type="button" data-owner-repair>Owner Kaydını Bu Hesapla Eşleştir</button>` : ""}
          ${diagnosis.can_bootstrap_owner ? `<button class="sa-btn" type="button" data-owner-bootstrap>Owner Yetkisini Tamamla</button>` : ""}
          ${opensPanel
            ? `<button class="sa-btn" type="button" data-owner-open-panel>Super Admin Konsolunu Aç</button>`
            : `<a class="sa-btn" href="${escape(primaryHref)}">${escape(primaryLabel)}</a>
              ${mode !== "mfa" ? `<a class="sa-btn sa-btn-ghost" href="${escape(mfaUrl())}">MFA2 Sayfasına Git</a>` : ""}
              <a class="sa-btn sa-btn-ghost" href="${escape(core.url("/admin/index.html"))}">Admin Panele Dön</a>`}
        </div>
      </main>
    `;
  }

  function setAccessFallback(shell, html) {
    shell.innerHTML = html;
    bindAccessFallbackActions(shell);
  }

  async function repairOwnerAccess(button) {
    const confirmed = await confirmAction("Bu tek seferlik işlem aktif owner kaydını mevcut admin+MFA oturumuyla eşleştirecek. İşlem audit log'a kritik kayıt olarak yazılacak.", { requireReason: true });
    if (!confirmed.confirmed) return;
    if (button) {
      button.disabled = true;
      button.textContent = "Owner eşleştiriliyor...";
    }
    try {
      await api("/v1/control-center/owner-access-repair", {
        method: "POST",
        body: {
          reason: confirmed.reason || "Owner access mismatch repair"
        }
      });
      window.location.reload();
    } catch (error) {
      if (button) {
        button.disabled = false;
        button.textContent = "Owner Kaydını Bu Hesapla Eşleştir";
      }
      alert(publicError(error, "Owner kaydı eşleştirilemedi."));
    }
  }

  async function bootstrapOwnerAccess(button) {
    const confirmed = await confirmAction("Owner hesabın doğrulandı. Bu işlem kendi hesabını super_admin rolüne yükseltecek ve audit log'a yazılacak.", { requireReason: false });
    if (!confirmed.confirmed) return;
    if (button) {
      button.disabled = true;
      button.textContent = "Yetki tamamlanıyor...";
    }
    try {
      await api("/v1/control-center/owner-bootstrap", { method: "POST" });
      window.location.reload();
    } catch (error) {
      if (button) {
        button.disabled = false;
        button.textContent = "Owner Yetkisini Tamamla";
      }
      alert(publicError(error, "Owner yetkisi tamamlanamadı."));
    }
  }

  function bindAccessFallbackActions(root) {
    const openPanelButton = root && root.querySelector ? root.querySelector("[data-owner-open-panel]") : null;
    if (openPanelButton && openPanelButton.dataset.bound !== "true") {
      openPanelButton.dataset.bound = "true";
      openPanelButton.addEventListener("click", async () => {
        openPanelButton.disabled = true;
        openPanelButton.textContent = "Panel açılıyor...";
        try {
          const payload = await api("/v1/control-center/owner-preflight");
          if (!await openOwnerConsoleFromPreflight(payload)) {
            throw new Error("Owner preflight panel açılışını doğrulamadı.");
          }
        } catch (error) {
          openPanelButton.disabled = false;
          openPanelButton.textContent = "Super Admin Konsolunu Aç";
          alert(publicError(error, "Panel açılamadı."));
        }
      });
    }

    const repairButton = root && root.querySelector ? root.querySelector("[data-owner-repair]") : null;
    if (repairButton && repairButton.dataset.bound !== "true") {
      repairButton.dataset.bound = "true";
      repairButton.addEventListener("click", () => repairOwnerAccess(repairButton));
    }

    const button = root && root.querySelector ? root.querySelector("[data-owner-bootstrap]") : null;
    if (button && button.dataset.bound !== "true") {
      button.dataset.bound = "true";
      button.addEventListener("click", () => bootstrapOwnerAccess(button));
    }
  }

  async function renderAccessFallback(shell, error, fallback) {
    if (!shell) return;
    const diagnosis = superAdminAccessDiagnosis(error, fallback);
    const message = diagnosis.message;
    try {
      const user = App.auth && App.auth.getUser ? await App.auth.getUser() : null;
      if (!user) {
        setAccessFallback(shell, accessFallback(message, { mode: "login", diagnosis }));
        return;
      }

      const profile = App.auth && App.auth.getProfile ? await App.auth.getProfile(user.id) : null;
      if (App.auth && App.auth.mfaStatus) {
        const status = await App.auth.mfaStatus();
        if (status && !status.mfaVerified) {
          setAccessFallback(shell, accessFallback("Super Admin paneli için MFA2 doğrulaması gerekiyor.", {
            mode: "mfa",
            diagnosis: superAdminAccessDiagnosis(new Error("mfa.required"), fallback)
          }));
          return;
        }
      }

      if (!profile || !SUPER_ADMIN_ENTRY_ROLES.includes(profile.role)) {
        const enrichedDiagnosis = await loadOwnerPreflightDiagnosis({
          ...diagnosis,
          message: "Bu hesap admin veya super_admin rolünde değil.",
          helper: "Super Admin giriş kapısına ulaşmak için hesap rolü en az admin olmalı.",
          steps: ["Owner allowlist ve MFA2 adımlarını tamamla.", "Owner doğrulanırsa kendi hesabını super_admin yap."]
        });
        if (enrichedDiagnosis.can_open_panel && await openOwnerConsoleFromPreflight(enrichedDiagnosis.preflight_payload)) return;
        setAccessFallback(shell, accessFallback(enrichedDiagnosis.message, { mode: enrichedDiagnosis.mode || "locked", diagnosis: enrichedDiagnosis }));
        return;
      }

      const enrichedDiagnosis = await loadOwnerPreflightDiagnosis(diagnosis);
      if (enrichedDiagnosis.can_open_panel && await openOwnerConsoleFromPreflight(enrichedDiagnosis.preflight_payload)) return;
      setAccessFallback(shell, accessFallback(enrichedDiagnosis.message, { mode: enrichedDiagnosis.mode || "locked", diagnosis: enrichedDiagnosis }));
    } catch (fallbackError) {
      setAccessFallback(shell, accessFallback(message, { mode: "login", diagnosis }));
    }
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

  function controlCenterPathCandidates(path) {
    const normalized = String(path || "");
    if (!normalized.startsWith("/v1/control-center")) return [normalized];
    return [
      normalized,
      normalized.replace(/^\/v1\/control-center/, "/v1/owner-console")
    ];
  }

  function shouldTryNextApiAlias(response, payload) {
    if (!response) return false;
    if (response.status === 404) return true;
    const message = String(payload && (payload.message || payload.error) || "");
    return response.status === 403 && /route|not found|challenge/i.test(message);
  }

  async function api(path, options) {
    const token = await sessionToken();
    const paths = controlCenterPathCandidates(path);
    let lastError = null;

    for (const candidatePath of paths) {
      const response = await fetch(`${config.apiBaseUrl}${candidatePath}`, {
        method: options && options.method || "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: options && options.body ? JSON.stringify(options.body) : undefined
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) return payload;
      const message = payload.message || payload.error || "İşlem tamamlanamadı.";
      if (response.status === 403 && /mfa|iki aşamalı|2fa|aal2/i.test(message)) {
        window.location.href = mfaUrl();
        throw new Error("İki aşamalı doğrulama gerekli.");
      }
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      lastError = error;
      if (paths.indexOf(candidatePath) < paths.length - 1 && shouldTryNextApiAlias(response, payload)) {
        continue;
      }
      throw error;
    }

    throw lastError || new Error("İşlem tamamlanamadı.");
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
    const requireReason = Boolean(options && options.requireReason);
    messageTarget.textContent = message;
    reasonInput.placeholder = requireReason
      ? "Audit log için işlem gerekçesi zorunlu."
      : "Audit log için kısa gerekçe yazabilirsin.";
    reasonInput.value = options && options.defaultReason
      ? options.defaultReason
      : (requireReason ? message : "");
    acceptButton.textContent = requireReason ? "Onayla ve Uygula" : "Onayla";
    modal.hidden = false;
    reasonInput.select();

    return new Promise((resolve) => {
      function cleanup(result) {
        modal.hidden = true;
        acceptButton.textContent = "Onayla";
        cancelButton.removeEventListener("click", onCancel);
        acceptButton.removeEventListener("click", onAccept);
        resolve(result);
      }
      function onCancel() {
        cleanup({ confirmed: false, reason: "" });
      }
      function onAccept() {
        const reason = reasonInput.value.trim();
        if (requireReason && reason.length < 6) {
          reasonInput.placeholder = "En az 6 karakterlik gerekçe gerekli.";
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
    const trigger = options && options.trigger;
    const confirmed = await confirmAction(message, options);
    if (!confirmed.confirmed) return;
    if (trigger) {
      trigger.disabled = true;
      trigger.dataset.originalText = trigger.dataset.originalText || trigger.textContent || "";
      trigger.textContent = "Uygulanıyor...";
    }
    try {
      await callback(confirmed.reason);
      if ($("[data-command-output]")) {
        await reloadOwnerActiveView();
      } else {
        await reloadActiveView();
      }
      setAlert("İşlem tamamlandı ve audit log'a işlendi.", "ok");
    } catch (error) {
      const messageText = publicError(error, "İşlem tamamlanamadı.");
      setAlert(messageText, "error");
      if ($("[data-command-output]")) {
        openDrawer("İşlem Hatası", ownerLine("Komut tamamlanamadı", escape(messageText), "<button type=\"button\" data-action-health-check>Komutları test et</button>", "critical"));
      }
    } finally {
      if (trigger) {
        trigger.disabled = false;
        trigger.textContent = trigger.dataset.originalText || "Uygula";
      }
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
    }, {
      trigger: button,
      defaultReason: message,
      requireReason: action === "suspended" || action === "suspicious"
    });
  }

  async function decidePartner(button) {
    const applicationId = button.dataset.applicationId;
    const decision = button.dataset.partnerDecision;
    const messages = {
      review: "Başvuru incelemeye alınacak.",
      approved: "Partner başvurusu onaylanacak ve uygun kullanıcı için mağaza kaydı hazırlanacak.",
      rejected: "Partner başvurusu reddedilecek."
    };
    const message = messages[decision] || "Partner başvurusu güncellenecek.";
    await runConfirmed(message, async (reason) => {
      await api(`/v1/control-center/partner-applications/${encodeURIComponent(applicationId)}`, {
        method: "PATCH",
        body: {
          decision,
          reason: reason || message,
          commission_rate: 0.12,
          store_status: decision === "approved" ? "active" : "review"
        }
      });
    }, {
      trigger: button,
      defaultReason: message,
      requireReason: decision !== "review"
    });
  }

  async function saveSetting(button) {
    const key = button.dataset.settingSave;
    const setting = state.settings.find((item) => item.setting_key === key);
    if (!setting) return;
    const safeKey = cssEscape(key);
    const toggle = $(`[data-setting-toggle="${safeKey}"]`);
    const input = $(`[data-setting-input="${safeKey}"]`);
    const value = toggle ? toggle.getAttribute("aria-pressed") === "true" : Number(input && input.value || 0);
    const message = `${setting.label || key} ayarı güncellenecek.`;
    await runConfirmed(message, async (reason) => {
      await api(`/v1/control-center/settings/${encodeURIComponent(key)}`, {
        method: "PATCH",
        body: { value, reason: reason || message }
      });
    }, {
      trigger: button,
      defaultReason: message,
      requireReason: ["critical", "high"].includes(setting.risk_level) && value === true
    });
  }

  async function saveModule(button) {
    const key = button.dataset.moduleSave;
    const safeKey = cssEscape(key);
    const active = $(`[data-module-toggle="is_active"][data-module-key="${safeKey}"]`);
    const visible = $(`[data-module-toggle="is_visible"][data-module-key="${safeKey}"]`);
    const commission = $(`[data-module-commission="${safeKey}"]`);
    const application = $(`[data-module-application="${safeKey}"]`);
    const message = "Modül kontrol ayarı güncellenecek.";
    await runConfirmed(message, async (reason) => {
      await api(`/v1/control-center/modules/${encodeURIComponent(key)}`, {
        method: "PATCH",
        body: {
          is_active: active ? active.getAttribute("aria-pressed") === "true" : undefined,
          is_visible: visible ? visible.getAttribute("aria-pressed") === "true" : undefined,
          commission_rate: Number(commission && commission.value || 0) / 100,
          application_status: application && application.value,
          content_config: { last_reason: reason || message }
        }
      });
    }, {
      trigger: button,
      defaultReason: message,
      requireReason: false
    });
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
    "maritime-trust": ["Maritime Trust", "Denizcilik metadata, risk, şikayet ve audit kontrolü"],
    "marsoh-moderation": ["MarSoh Yönetimi", "Odalar, günlük konu, mesajlar, bildirimler ve güvenlik kararları"],
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

  function ownerPreflightAllowsPanel(payload) {
    const preflight = payload && payload.preflight || {};
    const owner = preflight.owner || {};
    return Boolean(
      preflight.mfa_verified &&
      preflight.role === "super_admin" &&
      owner.configured &&
      owner.matched
    );
  }

  function ownerSessionFromPreflight(payload) {
    const preflight = payload && payload.preflight || {};
    const owner = preflight.owner || {};
    return {
      ok: true,
      owner: {
        user_id: preflight.user_id,
        email: preflight.email,
        role: preflight.role,
        source: owner.source || "owner_preflight",
        mfa_verified: true,
        owner_locked: true,
        bootstrap_required: false
      },
      gitops: {
        enabled: false,
        release_webhook_configured: false
      },
      control_links: []
    };
  }

  function applyOwnerSessionHeader(session) {
    const roleTarget = $("[data-sa-role]");
    const owner = session && session.owner || {};
    if (roleTarget) roleTarget.textContent = `Owner kilidi: ${owner.email || owner.user_id || "doğrulandı"}`;
  }

  function restoreOwnerConsoleShell() {
    const shell = $("[data-super-admin-shell]");
    if (!shell || $("[data-command-output]", shell)) return;
    if (state.ownerShellMarkup) {
      shell.innerHTML = state.ownerShellMarkup;
      state.ownerConsoleBound = false;
    }
  }

  async function recoverOwnerSessionWithPreflight(originalError) {
    const payload = await api("/v1/control-center/owner-preflight");
    if (!ownerPreflightAllowsPanel(payload)) throw originalError;

    state.ownerSession = ownerSessionFromPreflight(payload);
    applyOwnerSessionHeader(state.ownerSession);
    setAlert("Owner kilidi doğrulandı. Panel açıldı; bazı özet veriler API yanıtına göre sınırlı gelebilir.", "ok");
    return state.ownerSession;
  }

  async function openOwnerConsoleFromPreflight(payload) {
    if (!ownerPreflightAllowsPanel(payload)) return false;
    restoreOwnerConsoleShell();
    state.ownerSession = ownerSessionFromPreflight(payload);
    bindOwnerConsole();
    applyOwnerSessionHeader(state.ownerSession);
    try {
      await loadOwnerView("overview");
      setAlert("Owner kilidi doğrulandı. Panel açıldı.", "ok");
    } catch (error) {
      ownerSetOutput(ownerLine(
        "Panel erişimi açıldı",
        `Owner doğrulandı; özet verisi alınamadı: ${escape(publicError(error, "Kontrol merkezi yüklenemedi."))}`,
        "<button type=\"button\" data-view-jump=\"overview\">Tekrar dene</button>",
        "high"
      ));
      setAlert("Owner doğrulandı. Kontrol merkezi verisi alınamazsa panel açık kalır ve tekrar denenebilir.", "error");
    }
    return true;
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
      ownerLine("Yetki merkezi", "Rol verme, askıya alma ve risk seviyesi owner doğrulamalı backend service-role yazımıyla çalışır.", "<button type=\"button\" data-view-jump=\"permissions\">Aç</button>", "critical"),
      ownerLine("Ana sayfa modülleri", `${formatNumber(summary.homepage_modules)} modül / ${formatNumber(summary.future_operations)} gelecek operasyon`, "<button type=\"button\" data-view-jump=\"module-map\">Harita</button>", "medium"),
      ownerLine("Toplam sipariş", formatNumber(summary.total_orders), "<a href=\"./orders.html\">Sipariş merkezi</a>", "medium"),
      ownerLine("Günlük ciro", money(summary.daily_revenue), "<button type=\"button\" data-view-jump=\"system\">Finans ayarları</button>", "low"),
      ownerLine("Bekleyen başvuru", formatNumber(summary.pending_applications), "<button type=\"button\" data-view-jump=\"partners\">Karar ver</button>", summary.pending_applications ? "high" : "low"),
      ownerLine("Güvenlik uyarısı", `${formatNumber(summary.security_alerts_24h)} / son 24 saat`, "<button type=\"button\" data-view-jump=\"security\">İncele</button>", summary.security_alerts_24h ? "high" : "low"),
      ownerLine("Maritime Trust", "Denizcilik şikayet, fraud sinyali, erişim olayı ve audit akışı", "<button type=\"button\" data-view-jump=\"maritime-trust\">İzle</button>", "critical"),
      ownerLine("MarSoh moderasyonu", "Karantinaya alınan sohbet mesajlarını yayınla, reddet veya kullanıcı yaptırımı uygula.", "<button type=\"button\" data-view-jump=\"marsoh-moderation\">Kuyruğu Aç</button>", "critical"),
      ownerLine("Denizcilik kullanıcıları", "AL kimliğiyle kullanıcı bulma, CV ve belge onayı, düzenleme ve kontrollü temizleme", "<a href=\"./maritime-users.html\">Yönet</a>", "critical"),
      ownerLine("Sistem sağlığı", `API ${escape(system.api || "-")} / DB ${escape(system.database || "-")} / Auto-defense ${formatNumber(system.auto_defense && system.auto_defense.recent_incident_count)} olay`, "<button type=\"button\" data-view-jump=\"alerts\">Risk akışı</button>", system.database === "online" ? "low" : "high"),
      ownerLine("Komut sağlık testi", "Panel komutlarını mevcut kontrol merkezi verisiyle kontrol et.", "<button type=\"button\" data-action-health-check>Komutları Test Et</button>", "medium"),
      ownerLine("Yayın hattı", gitops.enabled ? "Güvenli webhook açık" : "Onay kaydı açık, otomatik GitOps kapalı", "<button type=\"button\" data-release-open>Onay ver</button>", gitops.enabled ? "high" : "medium"),
      ownerLine("Hızlı erişim", "Admin, user, partner ve modül ekranlarına geçiş", "<button type=\"button\" data-open-links>Liste</button>", "low")
    ].join(""));
  }

  async function runOwnerActionHealthCheck() {
    setAlert("Komut sağlık testi çalışıyor...", "ok");
    try {
      const payload = state.commandCenter || await loadCommandCenter();
      openDrawer("Komut Sağlık Testi", renderOwnerCommandCenterHealth(payload));
      setAlert(payload.schema_warnings && payload.schema_warnings.length ? "Komut testi uyarı verdi; detay panelde." : "Komut testi tamamlandı.", payload.schema_warnings && payload.schema_warnings.length ? "error" : "ok");
    } catch (error) {
      const message = publicError(error, "Komut sağlık testi çalışmadı.");
      openDrawer("Komut Sağlık Testi", ownerLine("Test başarısız", escape(message), "", "critical"));
      setAlert(message, "error");
    }
  }

  function renderOwnerActionHealth(payload) {
    const actions = payload.actions || {};
    const rows = Object.entries(actions).map(([key, value]) => ownerLine(
      key,
      `${value.ok ? "hazır" : "eksik"}${value.endpoint ? ` / ${escape(value.endpoint)}` : ""}${value.dispatch_ready === false ? " / deploy webhook hazır değil" : ""}`,
      value.service_role_fallback ? "service-role fallback açık" : "",
      value.ok && value.dispatch_ready !== false ? "low" : "high"
    ));
    const gitops = payload.gitops || {};
    return [
      ownerLine("Yayın deploy hattı", escape(gitops.message || "-"), gitops.dispatch_ready ? "deploy hazır" : "deploy webhook eksik", gitops.dispatch_ready ? "low" : "critical"),
      ownerLine("Backend yazma katmanı", "Yetki değişiklikleri owner+MFA sonrası backend service-role ile yazılır ve DB'den tekrar doğrulanır.", "", "high"),
      rows.join("") || ownerEmpty("Komut kaydı bulunamadı."),
      (payload.schema_warnings || []).map((item) => ownerLine(item.label || "schema", escape(item.message || "-"), escape(item.code || ""), "critical")).join("")
    ].join("");
  }

  function renderOwnerCommandCenterHealth(payload) {
    const summary = payload.summary || {};
    const system = payload.system_health || {};
    const gitops = payload.gitops || {};
    return [
      ownerLine("Sistem sağlığı", `API ${escape(system.api || "-")} / DB ${escape(system.database || "-")}`, "", system.database === "online" ? "low" : "high"),
      ownerLine("Backend build", escape(system.build || "-"), "denizcilik kullanıcı yönetimi görünmüyorsa API redeploy eski build'de kalmıştır", system.build === "maritime-guided-cv-20260916" ? "low" : "high"),
      ownerLine("Yetki merkezi", "Rol, durum ve risk komutları backend route ailesi üzerinden çalışır.", `${formatNumber(summary.total_users)} kullanıcı`, "medium"),
      ownerLine("Partner kararları", "Başvurular inceleme/onay/ret akışına bağlı.", `${formatNumber(summary.pending_applications)} bekleyen`, summary.pending_applications ? "high" : "low"),
      ownerLine("Modül yönetimi", "Ana sayfa modülleri ve görünürlük kayıtları yüklendi.", `${formatNumber(summary.homepage_modules)} modül`, "low"),
      ownerLine("Yayın hattı", gitops.enabled ? "GitOps açık" : "GitOps kapalı veya env eksik", gitops.release_webhook_configured ? "webhook var" : "webhook yok", gitops.release_webhook_configured ? "low" : "high"),
      (payload.schema_warnings || []).map((item) => ownerLine(item.label || "schema", escape(item.message || "-"), escape(item.code || ""), "critical")).join("")
    ].join("");
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
    const rows = state.approvals.map((item) => {
      const manualPending = releaseApprovalManualPending(item);
      const statusText = manualPending && item.status === "failed" ? "approved / webhook bekliyor" : item.status;
      return ownerLine(
        `${item.approval_type} / ${statusText}`,
        `${escape(item.target_ref || "main")} - ${escape(item.target_summary || "-")}`,
        `<button type="button" data-approval-detail="${escape(item.id)}">Detay</button>`,
        manualPending ? "medium" : item.risk_level
      );
    });
    ownerSetOutput(header + (rows.length ? rows.join("") : ownerEmpty("Yayın onayı kaydı yok.")));
  }

  function releaseApprovalManualPending(approval) {
    const response = approval && approval.webhook_response || {};
    return approval && (
      approval.status === "approved" ||
      response.code === "GITOPS_NOT_CONFIGURED" ||
      response.code === "GITOPS_DISABLED"
    );
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
      const result = await api(`/v1/control-center/permissions/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: {
          role: role && role.value,
          account_status: status && status.value,
          risk_level: risk && risk.value,
          flagged_suspicious: risk && ["high", "critical"].includes(risk.value),
          reason
        }
      });
      if (result && result.user) {
        state.permissionUsers = (state.permissionUsers || []).map((item) => (
          item.id === result.user.id ? result.user : item
        ));
        state.permissionChanges = result.change
          ? [result.change].concat(state.permissionChanges || []).slice(0, 80)
          : (state.permissionChanges || []);
      }
    }, {
      trigger: button,
      defaultReason: message,
      requireReason: true
    });
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

  function maritimeRisk(value) {
    if (value === "critical") return "critical";
    if (value === "high") return "high";
    if (value === "low") return "low";
    return "medium";
  }

  function metadataKeysLabel(keys) {
    const list = Array.isArray(keys) ? keys.filter(Boolean).slice(0, 12) : [];
    return list.length ? list.map((item) => escape(item)).join(", ") : "değerler gizli";
  }

  async function loadOwnerMaritimeTrust() {
    ownerLoading("Maritime Trust");
    const payload = await api("/v1/control-center/maritime-trust?limit=80");
    const trust = payload.maritime_trust || {};
    const metrics = trust.metrics || {};
    const policy = trust.control_policy || {};
    state.maritimeTrust = trust;
    state.maritimeTrustCases = trust.trust_cases || [];
    state.maritimeSensitiveAccessRequests = trust.sensitive_access_requests || [];
    state.maritimeAccessEvents = trust.access_events || [];
    state.maritimeAuditEvents = trust.audit_events || [];

    const riskRows = (trust.risk_signals || []).slice(0, 16).map((signal) => ownerLine(
      signal.title || "Risk sinyali",
      `${formatDate(signal.created_at)} / ${escape(signal.source_type || "-")} / ${escape(signal.message || "-")}`,
      "",
      signal.severity
    ));
    const complaintRows = (trust.complaints || []).slice(0, 16).map((item) => ownerLine(
      item.case_reference || item.id,
      `${escape(item.case_type || "-")} / ${escape(item.status || "-")} / ${escape(item.subject_type || "-")}: ${escape(item.summary_preview || "-")}`,
      `<button type="button" data-maritime-case-detail="${escape(item.id)}">Detay</button>`,
      maritimeRisk(item.risk_level || item.severity)
    ));
    const accessRequestRows = state.maritimeSensitiveAccessRequests.slice(0, 12).map((item) => ownerLine(
      item.access_scope || "sensitive_access",
      `${escape(item.status || "-")} / ${escape(item.purpose || "-")} / süre ${formatDate(item.starts_at)} - ${formatDate(item.expires_at)}`,
      `<button type="button" data-maritime-access-request-detail="${escape(item.id)}">Detay</button>`,
      item.status === "second_approval_required" ? "critical" : "high"
    ));
    const accessEventRows = state.maritimeAccessEvents.slice(0, 16).map((item) => ownerLine(
      item.action || "access",
      `${formatDate(item.created_at)} / ${escape(item.resource_type || "-")} ${escape(item.resource_id || "")} / ${escape(item.case_reference || "-")}`,
      `<button type="button" data-maritime-access-event-detail="${escape(item.id)}">Detay</button>`,
      item.action === "sensitive_access" ? "critical" : "medium"
    ));
    const auditRows = state.maritimeAuditEvents.slice(0, 16).map((event) => ownerLine(
      event.action || "audit",
      `${formatDate(event.created_at)} / ${escape(event.resource_type || "-")} ${escape(event.resource_id || "")} / IP ${escape(event.ip_address || "-")}`,
      `<button type="button" data-event-detail="${escape(event.id || "")}">Detay</button>`,
      event.severity
    ));
    const warningRows = (payload.schema_warnings || []).map((item) => ownerLine(
      item.label || "schema",
      escape(item.message || "-"),
      escape(item.code || ""),
      "critical"
    ));

    ownerSetOutput([
      ownerLine("Görünüm sınırı", "Metadata, risk sinyali, şikayet ve audit. Özel konuşma, dosya ve görüşme içeriği bu ekranda yok.", "", "critical"),
      ownerLine("İçerik koruması", policy.message_content_returned ? "Uyarı: endpoint içerik döndürüyor" : "Mesaj/dosya/görüşme içeriği dönmüyor.", escape(policy.sensitive_content_requires || "vaka, amaç, gerekçe, süre ve onay akışı gerekir"), policy.message_content_returned ? "critical" : "low"),
      ownerLine("Açık vaka", formatNumber(metrics.open_case_sample), "son örneklem", metrics.open_case_sample ? "high" : "low"),
      ownerLine("Fraud / şikayet", formatNumber(metrics.complaint_or_fraud_sample), "communication complaint + fraud signal", metrics.complaint_or_fraud_sample ? "critical" : "low"),
      ownerLine("Bekleyen hassas erişim", formatNumber(metrics.pending_sensitive_access_sample), "gerekçe içerikleri listede dönmez", metrics.pending_sensitive_access_sample ? "critical" : "low"),
      ownerLine("Erişim olayı", `${formatNumber(metrics.sensitive_access_event_sample)} hassas / ${formatNumber((trust.access_events || []).length)} toplam`, "view/download/export/sensitive_access", metrics.sensitive_access_event_sample ? "critical" : "medium"),
      ownerLine("Maritime audit uyarısı", formatNumber(metrics.audit_alert_sample), "warning + critical", metrics.audit_alert_sample ? "high" : "low"),
      ownerLine("Risk sinyali akışı", formatNumber(metrics.risk_signal_sample), "", metrics.risk_signal_sample ? "high" : "low"),
      riskRows.length ? riskRows.join("") : ownerLine("Risk sinyali", "Aktif kritik risk sinyali yok.", "", "low"),
      complaintRows.length ? complaintRows.join("") : ownerEmpty("Şikayet veya fraud vakası bulunamadı."),
      accessRequestRows.length ? accessRequestRows.join("") : ownerLine("Hassas erişim talebi", "Bekleyen talep yok.", "", "low"),
      accessEventRows.length ? accessEventRows.join("") : ownerEmpty("Maritime erişim olayı bulunamadı."),
      auditRows.length ? auditRows.join("") : ownerEmpty("Maritime audit kaydı bulunamadı."),
      warningRows.join("")
    ].join(""));
  }

  const marsohLanguageLabels = {
    tr: "Türkçe", az: "Azərbaycanca", en: "English", de: "Deutsch", ru: "Русский",
    ar: "العربية", kk: "Қазақша", uz: "O‘zbekcha", ky: "Кыргызча"
  };

  function marsohLocalizedFields(prefix, values, options) {
    const multiline = Boolean(options && options.multiline);
    const maxLength = Number(options && options.maxLength || (multiline ? 800 : 160));
    return Object.entries(marsohLanguageLabels).map(([language, label]) => {
      const value = escape(values && values[language] || "");
      const required = ["tr", "az", "en"].includes(language) && options?.requiredCore ? " required" : "";
      const control = multiline
        ? `<textarea name="${escape(prefix)}_${language}" maxlength="${maxLength}" rows="3"${required}>${value}</textarea>`
        : `<input name="${escape(prefix)}_${language}" type="text" maxlength="${maxLength}" value="${value}"${required}>`;
      return `<label><span>${escape(label)}</span>${control}</label>`;
    }).join("");
  }

  function marsohMapFromForm(form, prefix) {
    const data = new FormData(form);
    return Object.fromEntries(Object.keys(marsohLanguageLabels).map((language) => [language, String(data.get(`${prefix}_${language}`) || "").trim()]));
  }

  function marsohChannelLabel(channel) {
    return channel?.name_i18n?.tr || channel?.name_i18n?.az || channel?.name_i18n?.en || channel?.slug || "Oda";
  }

  function marsohPanel(title, subtitle, content, tone) {
    return `<section class="sa-marsoh-panel${tone ? ` is-${escape(tone)}` : ""}"><header><div><h2>${escape(title)}</h2><p>${escape(subtitle || "")}</p></div></header>${content}</section>`;
  }

  async function loadOwnerMarsohModeration() {
    ownerLoading("MarSoh Yönetimi");
    const [moderationPayload, managementPayload] = await Promise.all([
      api("/v1/admin/marsoh/moderation?limit=120"),
      api("/v1/admin/marsoh/management?limit=100")
    ]);
    state.marsohModeration = moderationPayload.queue || [];
    state.marsohReports = moderationPayload.reports || [];
    state.marsohSanctions = moderationPayload.sanctions || [];
    state.marsohChannels = managementPayload.channels || [];
    state.marsohTopics = managementPayload.topics || [];
    state.marsohMessages = managementPayload.messages || [];
    state.marsohAudit = managementPayload.audit || [];
    state.marsohMessageCursor = managementPayload.next_cursor || null;
    const queueRows = state.marsohModeration.map((item) => {
      const message = item.message || {};
      const channel = item.channel || {};
      const trust = item.sender_trust || {};
      const confidence = `${Math.round(Number(item.confidence || 0) * 100)}%`;
      const details = `${escape(message.body || "-")}<br><em>${escape(channel.slug || "-")} / ${escape(item.language || "und")} / ${escape(item.category || "-")} / ${escape(item.rule_code || "-")} / güven ${escape(confidence)}</em><br><em>${escape(item.administrator_explanation || "-")}</em>`;
      const actions = `<button type="button" data-marsoh-context="${escape(item.message_id)}">İlgili Geçmiş</button> <button type="button" data-marsoh-admin-action="published" data-message-id="${escape(item.message_id)}">Yayınla</button> <button type="button" data-marsoh-admin-action="rejected" data-message-id="${escape(item.message_id)}">Reddet</button> <button type="button" data-marsoh-admin-action="temporary_mute" data-user-id="${escape(message.sender_user_id || "")}">24 Saat Sustur</button> <button type="button" data-marsoh-admin-action="permanent_ban" data-user-id="${escape(message.sender_user_id || "")}">Sohbetten Engelle</button>`;
      return ownerLine(message.sender_display_name || trust.public_id || "Gönderici", details, actions, Number(item.confidence || 0) >= .9 ? "critical" : "high");
    });
    const reportRows = state.marsohReports.map((item) => {
      const message = item.message || {};
      const details = `${escape(message.body || "Mesaj yayından kaldırılmış olabilir.")}<br><em>${escape(item.reason_code || "other")} / ${formatDate(item.created_at)}${item.note ? ` / ${escape(item.note)}` : ""}</em>`;
      const actions = message.message_id
        ? `<button type="button" data-marsoh-context="${escape(item.message_id)}">İlgili Geçmiş</button> <button type="button" data-marsoh-report-action="dismissed" data-report-id="${escape(item.id)}">Bildirimi Kapat</button> <button type="button" data-marsoh-admin-action="rejected" data-message-id="${escape(item.message_id)}">Mesajı Reddet</button> <button type="button" data-marsoh-admin-action="temporary_mute" data-user-id="${escape(message.sender_user_id || "")}">24 Saat Sustur</button> <button type="button" data-marsoh-admin-action="permanent_ban" data-user-id="${escape(message.sender_user_id || "")}">Sohbetten Engelle</button>`
        : `<button type="button" data-marsoh-report-action="dismissed" data-report-id="${escape(item.id)}">Bildirimi Kapat</button>`;
      return ownerLine(message.sender_display_name || item.message_id || "Bildirilen mesaj", details, actions, item.reason_code === "fraud" || item.reason_code === "harassment" ? "critical" : "high");
    });
    const sanctionRows = state.marsohSanctions.map((item) => ownerLine(
      `${item.sanction_type === "permanent_ban" ? "Kalıcı yasak" : "Geçici susturma"} / ${item.user_id}`,
      `${escape(item.reason || "-")} / ${formatDate(item.starts_at)}${item.expires_at ? ` - ${formatDate(item.expires_at)}` : ""}`,
      `<button type="button" data-marsoh-admin-action="lift" data-sanction-id="${escape(item.id)}">Yaptırımı Kaldır</button>`,
      item.sanction_type === "permanent_ban" ? "critical" : "high"
    ));

    const channelOptions = state.marsohChannels.map((channel) => `<option value="${escape(channel.id)}">${escape(marsohChannelLabel(channel))}</option>`).join("");
    const latestTopic = state.marsohTopics[0] || {
      topic_date: new Date().toISOString().slice(0, 10),
      title_i18n: {}, body_i18n: {}, status: "active"
    };
    const announcementForm = `
      <form class="sa-marsoh-form" data-marsoh-announcement-form>
        <label><span>Yayın odası</span><select name="channel_id" required>${channelOptions}</select></label>
        <label><span>Mesaj dili</span><select name="language">${Object.entries(marsohLanguageLabels).map(([value, label]) => `<option value="${value}">${escape(label)}</option>`).join("")}</select></label>
        <label class="is-wide"><span>Yönetim mesajı</span><textarea name="body" rows="3" maxlength="2000" required placeholder="Topluluk veya denizde güvenlik duyurusunu yazın"></textarea></label>
        <button class="sa-btn" type="submit">MarSoh’ta Yayınla</button>
      </form>`;
    const topicForm = `
      <form class="sa-marsoh-form" data-marsoh-topic-form>
        <label><span>Yayın tarihi</span><input name="topic_date" type="date" value="${escape(latestTopic.topic_date)}" required></label>
        <label><span>Durum</span><select name="status"><option value="active" ${latestTopic.status === "active" ? "selected" : ""}>Aktif</option><option value="archived" ${latestTopic.status === "archived" ? "selected" : ""}>Arşiv</option></select></label>
        <details class="sa-marsoh-locales is-wide" open><summary>Başlık çevirileri</summary><div>${marsohLocalizedFields("title", latestTopic.title_i18n, { requiredCore: true })}</div></details>
        <details class="sa-marsoh-locales is-wide" open><summary>Soru çevirileri</summary><div>${marsohLocalizedFields("body", latestTopic.body_i18n, { multiline: true, maxLength: 800, requiredCore: true })}</div></details>
        <button class="sa-btn" type="submit">Günün Konusunu Kaydet</button>
      </form>`;
    const channelForms = state.marsohChannels.map((channel) => `
      <form class="sa-marsoh-channel" data-marsoh-channel-form data-channel-id="${escape(channel.id)}">
        <header><div><strong>${escape(marsohChannelLabel(channel))}</strong><small>${escape(channel.slug)}${channel.country_code ? ` / ${escape(channel.country_code)}` : ""}</small></div><span class="sa-marsoh-status">${escape(channel.status)}</span></header>
        <div class="sa-marsoh-form">
          <label><span>Oda durumu</span><select name="status"><option value="active" ${channel.status === "active" ? "selected" : ""}>Aktif</option><option value="paused" ${channel.status === "paused" ? "selected" : ""}>Duraklat</option><option value="archived" ${channel.status === "archived" ? "selected" : ""}>Arşivle</option></select></label>
          <label><span>Yavaş mod (saniye)</span><input name="slow_mode_seconds" type="number" min="0" max="300" value="${escape(channel.slow_mode_seconds)}" required></label>
          <details class="sa-marsoh-locales is-wide"><summary>Oda adı çevirileri</summary><div>${marsohLocalizedFields("name", channel.name_i18n, { maxLength: 120 })}</div></details>
          <details class="sa-marsoh-locales is-wide"><summary>Sabit güvenlik metinleri</summary><div>${marsohLocalizedFields("notice", channel.pinned_notice_i18n, { multiline: true, maxLength: 600 })}</div></details>
          <button class="sa-btn sa-btn-ghost" type="submit">Odayı Güncelle</button>
        </div>
      </form>`).join("");
    const messageRows = state.marsohMessages.map((item) => ownerLine(
      item.sender_display_name || "Gönderici",
      `${escape(item.body || "-")}<br><em>${escape(marsohChannelLabel(state.marsohChannels.find((channel) => channel.id === item.channel_id)))} / ${escape(item.language || "und")} / ${formatDate(item.published_at)}</em>`,
      `<button type="button" data-marsoh-context="${escape(item.message_id)}">Geçmiş</button> <button type="button" data-marsoh-admin-action="rejected" data-message-id="${escape(item.message_id)}">Mesajı Sil</button> <button type="button" data-marsoh-admin-action="temporary_mute" data-user-id="${escape(item.sender_user_id)}">24 Saat Sustur</button>`,
      item.actor_type === "moderator" ? "medium" : "low"
    ));
    const bulkControls = `
      <div class="sa-marsoh-danger-zone">
        <label><span>Temizlenecek alan</span><select data-marsoh-bulk-channel><option value="">Tüm MarSoh odaları</option>${channelOptions}</select></label>
        <p>Mesajlar halka açık akıştan kaldırılır; kabul kaydı, şikâyetler ve audit kanıtı korunur.</p>
        <button class="sa-btn sa-btn-danger" type="button" data-marsoh-bulk-remove>Tüm Yayınlanmış Mesajları Sil</button>
      </div>`;
    const auditRows = state.marsohAudit.slice(0, 40).map((item) => ownerLine(
      item.action || "MarSoh işlemi",
      `${formatDate(item.created_at)} / ${escape(item.resource_type || "-")} ${escape(item.resource_id || "")}`,
      item.actor_user_id ? `Yönetici ${escape(item.actor_user_id)}` : "Sistem",
      /removed|rejected|sanction|report/.test(item.action || "") ? "high" : "low"
    ));
    ownerSetOutput([
      `<div class="sa-marsoh-stats"><div><strong>${formatNumber(state.marsohChannels.length)}</strong><span>Oda</span></div><div><strong>${formatNumber(state.marsohMessages.length)}</strong><span>Son mesaj</span></div><div><strong>${formatNumber(state.marsohReports.length)}</strong><span>Açık bildirim</span></div><div><strong>${formatNumber(state.marsohModeration.length)}</strong><span>Karantina</span></div></div>`,
      marsohPanel("Yönetimden paylaşım", "Seçilen odada AllonaHub MarSoh Yönetimi adıyla yayımlanır.", announcementForm),
      marsohPanel("Bugünün deniz konusu", "Başlık ve soru metnini günlük olarak dokuz dilde yönetebilirsiniz.", topicForm),
      marsohPanel("Oda yönetimi", "Oda durumunu, yavaş modu, adları ve sabit güvenlik metinlerini yönetin.", `<div class="sa-marsoh-channels">${channelForms || ownerEmpty("MarSoh odası bulunamadı.")}</div>`),
      marsohPanel("Yayımlanmış mesajlar", "Hatalı bir mesajı tek tek kaldırın veya gerekli kullanıcı yaptırımını uygulayın.", `<div data-marsoh-published-list>${messageRows.length ? messageRows.join("") : ownerEmpty("Yayımlanmış mesaj bulunmuyor.")}</div>${state.marsohMessageCursor ? `<button class="sa-btn sa-btn-ghost sa-marsoh-more" type="button" data-marsoh-load-more>Daha Eski Mesajları Getir</button>` : ""}`),
      marsohPanel("Toplu temizlik", "Yüksek riskli işlem. Her kullanım gerekçe ve yönetici kimliğiyle kaydedilir.", bulkControls, "danger"),
      marsohPanel("Karantina kuyruğu", `${formatNumber(state.marsohModeration.length)} mesaj güvenlik kararı bekliyor.`, queueRows.length ? queueRows.join("") : ownerEmpty("Karantinada mesaj bulunmuyor.")),
      marsohPanel("Şikâyet ve bildirimler", `${formatNumber(state.marsohReports.length)} açık kullanıcı bildirimi bulunuyor.`, reportRows.length ? reportRows.join("") : ownerEmpty("Açık MarSoh bildirimi bulunmuyor.")),
      marsohPanel("Aktif yaptırımlar", `${formatNumber(state.marsohSanctions.length)} kullanıcı yaptırımı aktif.`, sanctionRows.length ? sanctionRows.join("") : ownerEmpty("Aktif MarSoh yaptırımı bulunmuyor.")),
      marsohPanel("MarSoh işlem geçmişi", "Son yönetim, moderasyon, şikâyet ve güvenlik kayıtları.", auditRows.length ? auditRows.join("") : ownerEmpty("MarSoh audit kaydı bulunmuyor."))
    ].join(""));
  }

  async function runMarsohAdminAction(button) {
    const action = button.dataset.marsohAdminAction;
    const messageId = button.dataset.messageId;
    const userId = button.dataset.userId;
    const sanctionId = button.dataset.sanctionId;
    const labels = {
      published: "Mesaj diğer kullanıcılara yayımlanacak.",
      rejected: "Mesaj halka açık MarSoh akışından kaldırılacak; güvenlik ve audit kaydı korunacak.",
      temporary_mute: "Kullanıcı 24 saat boyunca MarSoh'da susturulacak.",
      permanent_ban: "Kullanıcı MarSoh'dan kalıcı olarak engellenecek.",
      lift: "Seçili MarSoh yaptırımı kaldırılacak."
    };
    await runConfirmed(labels[action] || "MarSoh işlemi uygulanacak.", async (reason) => {
      if (action === "published" || action === "rejected") {
        await api(`/v1/admin/marsoh/messages/${encodeURIComponent(messageId)}/decision`, { method: "POST", body: { decision: action, reason } });
      } else if (action === "lift") {
        await api(`/v1/admin/marsoh/sanctions/${encodeURIComponent(sanctionId)}/lift`, { method: "POST", body: {} });
      } else {
        await api("/v1/admin/marsoh/sanctions", { method: "POST", body: { user_id: userId, sanction_type: action, reason, ...(action === "temporary_mute" ? { duration_minutes: 1440 } : {}) } });
      }
    }, { trigger: button, defaultReason: labels[action] || "MarSoh yönetici işlemi", requireReason: true });
  }

  async function runMarsohReportAction(button) {
    const action = button.dataset.marsohReportAction;
    const reportId = button.dataset.reportId;
    const labels = {
      dismissed: "Kullanıcı bildirimi işlem gerektirmediği gerekçesiyle kapatılacak.",
      actioned: "Kullanıcı bildirimi gerekli işlem uygulanmış olarak kapatılacak."
    };
    await runConfirmed(labels[action] || "MarSoh bildirimi sonuçlandırılacak.", async (reason) => {
      await api(`/v1/admin/marsoh/reports/${encodeURIComponent(reportId)}/decision`, {
        method: "POST",
        body: { decision: action, reason }
      });
    }, { trigger: button, defaultReason: labels[action] || "MarSoh bildirim kararı", requireReason: true });
  }

  async function submitMarsohAnnouncement(form) {
    const data = new FormData(form);
    const button = $("button[type='submit']", form);
    if (button) button.disabled = true;
    try {
      await api("/v1/admin/marsoh/messages", {
        method: "POST",
        body: {
          channel_id: String(data.get("channel_id") || ""),
          language: String(data.get("language") || "tr"),
          body: String(data.get("body") || "").trim(),
          idempotency_key: crypto.randomUUID()
        }
      });
      setAlert("Yönetim mesajı MarSoh’ta yayımlandı ve audit kaydı oluşturuldu.", "ok");
      await loadOwnerMarsohModeration();
    } catch (error) {
      setAlert(publicError(error, "Yönetim mesajı yayımlanamadı."), "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function submitMarsohTopic(form) {
    const data = new FormData(form);
    const topicDate = String(data.get("topic_date") || "");
    const button = $("button[type='submit']", form);
    if (button) button.disabled = true;
    try {
      await api(`/v1/admin/marsoh/topics/${encodeURIComponent(topicDate)}`, {
        method: "PUT",
        body: {
          title_i18n: marsohMapFromForm(form, "title"),
          body_i18n: marsohMapFromForm(form, "body"),
          status: String(data.get("status") || "active")
        }
      });
      setAlert("Günün deniz konusu tüm dil alanlarıyla kaydedildi.", "ok");
      await loadOwnerMarsohModeration();
    } catch (error) {
      setAlert(publicError(error, "Günün deniz konusu kaydedilemedi."), "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function submitMarsohChannel(form) {
    const data = new FormData(form);
    const channelId = form.dataset.channelId;
    const button = $("button[type='submit']", form);
    if (button) button.disabled = true;
    try {
      await api(`/v1/admin/marsoh/channels/${encodeURIComponent(channelId)}`, {
        method: "PATCH",
        body: {
          status: String(data.get("status") || "active"),
          slow_mode_seconds: Number(data.get("slow_mode_seconds") || 0),
          name_i18n: marsohMapFromForm(form, "name"),
          pinned_notice_i18n: marsohMapFromForm(form, "notice")
        }
      });
      setAlert("MarSoh oda ayarları güncellendi.", "ok");
      await loadOwnerMarsohModeration();
    } catch (error) {
      setAlert(publicError(error, "Oda ayarları güncellenemedi."), "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function removeAllMarsohMessages(button) {
    const channelId = String($("[data-marsoh-bulk-channel]")?.value || "") || null;
    const channel = state.marsohChannels.find((item) => item.id === channelId);
    const scope = channel ? marsohChannelLabel(channel) : "tüm MarSoh odaları";
    await runConfirmed(`${scope} içindeki bütün yayımlanmış mesajlar halka açık akıştan kaldırılacak. Bu işlem geri alınamaz.`, async (reason) => {
      const payload = await api("/v1/admin/marsoh/messages/bulk-remove", {
        method: "POST",
        body: { channel_id: channelId, reason, confirmation: "MARSOH_ALL_MESSAGES_REMOVE" }
      });
      setAlert(`${formatNumber(payload.removed_count)} mesaj halka açık akıştan kaldırıldı.`, "ok");
    }, { trigger: button, defaultReason: `${scope} için yönetici toplu temizlik kararı`, requireReason: true });
  }

  async function loadMoreMarsohMessages(button) {
    if (!state.marsohMessageCursor) return;
    button.disabled = true;
    try {
      const payload = await api(`/v1/admin/marsoh/management?limit=100&before=${encodeURIComponent(state.marsohMessageCursor)}`);
      const rows = (payload.messages || []).map((item) => ownerLine(
        item.sender_display_name || "Gönderici",
        `${escape(item.body || "-")}<br><em>${escape(marsohChannelLabel(state.marsohChannels.find((channel) => channel.id === item.channel_id)))} / ${escape(item.language || "und")} / ${formatDate(item.published_at)}</em>`,
        `<button type="button" data-marsoh-context="${escape(item.message_id)}">Geçmiş</button> <button type="button" data-marsoh-admin-action="rejected" data-message-id="${escape(item.message_id)}">Mesajı Sil</button> <button type="button" data-marsoh-admin-action="temporary_mute" data-user-id="${escape(item.sender_user_id)}">24 Saat Sustur</button>`,
        item.actor_type === "moderator" ? "medium" : "low"
      ));
      $("[data-marsoh-published-list]")?.insertAdjacentHTML("beforeend", rows.join(""));
      state.marsohMessages.push(...(payload.messages || []));
      state.marsohMessageCursor = payload.next_cursor || null;
      if (!state.marsohMessageCursor) button.remove();
    } catch (error) {
      setAlert(publicError(error, "Eski MarSoh mesajları yüklenemedi."), "error");
      button.disabled = false;
    }
  }

  async function showMarsohContext(messageId) {
    const payload = await api(`/v1/admin/marsoh/messages/${encodeURIComponent(messageId)}/context`);
    const rows = (payload.messages || []).map((item) => ownerLine(
      `${item.id === messageId ? "Hedef mesaj / " : ""}${item.sender_display_name || item.sender_user_id || "Gönderici"}`,
      escape(item.body || "-"),
      `${escape(item.language || "und")} / ${formatDate(item.accepted_at)}`,
      item.id === messageId ? "critical" : "medium"
    ));
    openDrawer("MarSoh İlgili Mesaj Geçmişi", rows.length ? rows.join("") : ownerEmpty("İlgili mesaj geçmişi bulunamadı."));
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
      else if (view === "maritime-trust") await loadOwnerMaritimeTrust();
      else if (view === "marsoh-moderation") await loadOwnerMarsohModeration();
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
    const confirmed = await confirmAction("Bu owner onayı audit log'a yazılacak ve yapılandırılmışsa güvenli yayın webhook'u tetiklenecek.", {
      defaultReason: payload.target_summary,
      requireReason: true
    });
    if (!confirmed.confirmed) return;
    payload.metadata.reason = confirmed.reason;
    try {
      const result = await api("/v1/control-center/release-approvals", {
        method: "POST",
        body: payload
      });
      const approval = result.approval || {};
      const response = approval.webhook_response || {};
      const status = approval.status || "approved";
      const released = status === "dispatched";
      const manualPending = status === "approved" || response.code === "GITOPS_NOT_CONFIGURED" || response.code === "GITOPS_DISABLED";
      const okStatus = released || manualPending;
      setAlert(
        released
          ? "Yayın onayı deploy hattına gönderildi."
          : (manualPending ? "Yayın onayı kaydedildi; webhook yoksa manuel deploy bekliyor." : `Yayın onayı kaydedildi: ${status}`),
        okStatus ? "ok" : "error"
      );
      openDrawer("Yayın Onayı Sonucu", [
        ownerLine("Durum", escape(status), released ? "yayına gönderildi" : (manualPending ? "onay kaydedildi; manuel deploy bekliyor" : "deploy hata aldı"), released ? "low" : (manualPending ? "medium" : "critical")),
        ownerLine("Webhook", `${escape(String(approval.webhook_status || "-"))} / ${escape(response.code || response.ok || "-")}`, "", released ? "low" : (manualPending ? "medium" : "high")),
        ownerLine("Mesaj", escape(response.message || response.body || "Yayın onayı kaydedildi."), "<button type=\"button\" data-action-health-check>Yayın hattını test et</button>", released ? "low" : (manualPending ? "medium" : "high"))
      ].join(""));
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
    const manualPending = releaseApprovalManualPending(item);
    const statusText = manualPending && item.status === "failed" ? "approved / webhook bekliyor" : item.status;
    openDrawer("Yayın Onayı", [
      ownerLine("Tip", escape(item.approval_type || "-"), "", item.risk_level),
      ownerLine("Durum", escape(statusText || "-"), manualPending ? "onay kaydedildi; manuel deploy bekliyor" : "", manualPending ? "medium" : item.risk_level),
      ownerLine("Hedef", escape(item.target_ref || "-"), "", "medium"),
      ownerLine("Özet", escape(item.target_summary || "-"), "", "medium"),
      ownerLine("Webhook", `${escape(String(item.webhook_status || "-"))} / ${escape(JSON.stringify(item.webhook_response || {}).slice(0, 500))}`, "", item.status === "failed" && !manualPending ? "critical" : "low"),
      ownerLine("Tarih", formatDate(item.created_at), "", "low")
    ].join(""));
  }

  function showEventDetail(id) {
    const events = [...(state.securityEvents || []), ...(state.auditEvents || []), ...(state.maritimeAuditEvents || [])];
    const item = events.find((event) => String(event.id) === String(id));
    if (!item) return;
    openDrawer("Audit Detayı", [
      ownerLine("İşlem", escape(item.action || "-"), "", item.severity),
      ownerLine("Kayıt", `${escape(item.resource_type || "-")} / ${escape(item.resource_id || "-")}`, "", "medium"),
      ownerLine("Aktör", `${escape(item.actor_role || "-")} / ${escape(item.actor_id || "-")}`, "", "medium"),
      ownerLine("IP", escape(item.ip_address || "-"), "", item.severity),
      ownerLine("Metadata", item.metadata_included === false ? "Bu görünümde metadata değeri dönmez." : escape(JSON.stringify(item.metadata || {}).slice(0, 1200)), "", "medium"),
      ownerLine("Tarih", formatDate(item.created_at), "", "low")
    ].join(""));
  }

  function showMaritimeCaseDetail(id) {
    const item = (state.maritimeTrustCases || []).find((event) => String(event.id) === String(id));
    if (!item) return;
    openDrawer("Maritime Trust Vakası", [
      ownerLine("Vaka", `${escape(item.case_reference || item.id)} / ${escape(item.case_type || "-")}`, "", item.risk_level),
      ownerLine("Durum", `${escape(item.status || "-")} / ${escape(item.severity || "-")}`, "", maritimeRisk(item.risk_level || item.severity)),
      ownerLine("Konu", `${escape(item.subject_type || "-")} / ${escape(item.subject_id || "-")}`, "", "medium"),
      ownerLine("Taraflar", `Partner ${escape(item.partner_id || "-")} / Aday ${escape(item.seafarer_user_id || "-")}`, "", "medium"),
      ownerLine("Atama", `Açan ${escape(item.opened_by || "-")} / Atanan ${escape(item.assigned_to || "-")}`, "", "medium"),
      ownerLine("Özet", escape(item.summary_preview || "-"), "kısa önizleme; konuşma içeriği değil", item.risk_level),
      ownerLine("Metadata anahtarları", metadataKeysLabel(item.metadata_keys), "değerler gizli", "medium"),
      ownerLine("İçerik", item.sensitive_content_included ? "Uyarı: içerik dönüyor" : "Özel konuşma/dosya/görüşme içeriği dönmüyor.", "", item.sensitive_content_included ? "critical" : "low"),
      ownerLine("Tarih", `${formatDate(item.created_at)} / güncelleme ${formatDate(item.updated_at)}`, "", "low")
    ].join(""));
  }

  function showMaritimeAccessRequestDetail(id) {
    const item = (state.maritimeSensitiveAccessRequests || []).find((event) => String(event.id) === String(id));
    if (!item) return;
    openDrawer("Hassas Erişim Talebi", [
      ownerLine("Talep", escape(item.id || "-"), "", item.status === "second_approval_required" ? "critical" : "high"),
      ownerLine("Vaka", escape(item.case_id || "-"), "", "medium"),
      ownerLine("Kapsam", `${escape(item.access_scope || "-")} / ${escape(item.status || "-")}`, "", item.status === "second_approval_required" ? "critical" : "high"),
      ownerLine("Amaç", escape(item.purpose || "-"), "", "medium"),
      ownerLine("Kişiler", `İsteyen ${escape(item.requester_user_id || "-")} / onay ${escape(item.approver_user_id || "-")} / ikinci onay ${escape(item.second_approver_user_id || "-")}`, "", "medium"),
      ownerLine("Süre", `${formatDate(item.starts_at)} - ${formatDate(item.expires_at)}`, "süreli erişim", "high"),
      ownerLine("Gerekçe", item.justification_included ? "Uyarı: ham gerekçe dönüyor" : "Ham gerekçe bu listede dönmez.", "", item.justification_included ? "critical" : "low"),
      ownerLine("Metadata anahtarları", metadataKeysLabel(item.metadata_keys), "değerler gizli", "medium"),
      ownerLine("Karar tarihi", formatDate(item.decided_at), "", "low")
    ].join(""));
  }

  function showMaritimeAccessEventDetail(id) {
    const item = (state.maritimeAccessEvents || []).find((event) => String(event.id) === String(id));
    if (!item) return;
    openDrawer("Maritime Erişim Olayı", [
      ownerLine("İşlem", escape(item.action || "-"), "", item.action === "sensitive_access" ? "critical" : "medium"),
      ownerLine("Kaynak", `${escape(item.resource_type || "-")} / ${escape(item.resource_id || "-")}`, "", "medium"),
      ownerLine("Aktör", escape(item.actor_user_id || "-"), "", "medium"),
      ownerLine("Grant", escape(item.grant_id || "-"), "", "medium"),
      ownerLine("Vaka", escape(item.case_reference || "-"), "", "high"),
      ownerLine("Amaç", escape(item.purpose || "-"), "", "medium"),
      ownerLine("Metadata anahtarları", metadataKeysLabel(item.metadata_keys), "değerler gizli", "medium"),
      ownerLine("İçerik", item.sensitive_content_included ? "Uyarı: içerik dönüyor" : "Özel konuşma/dosya/görüşme içeriği dönmüyor.", "", item.sensitive_content_included ? "critical" : "low"),
      ownerLine("Tarih", formatDate(item.created_at), "", "low")
    ].join(""));
  }

  function bindOwnerConsole() {
    state.ownerConsoleBound = true;

    const nav = $("[data-sa-nav]");
    if (nav && nav.dataset.bound !== "true") {
      nav.dataset.bound = "true";
      nav.addEventListener("click", async (event) => {
        const button = eventClosest(event, "[data-view-target]");
        if (!button) return;
        document.querySelectorAll("[data-view-target]").forEach((item) => item.classList.toggle("is-active", item === button));
        await loadOwnerView(button.dataset.viewTarget);
      });
    }

    if (!state.ownerDocumentEventsBound) {
      state.ownerDocumentEventsBound = true;

      document.addEventListener("submit", async (event) => {
        const usersFilter = eventClosest(event, "[data-owner-users-filter]");
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

        const permissionsFilter = eventClosest(event, "[data-owner-permissions-filter]");
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

        const marsohAnnouncementForm = eventClosest(event, "[data-marsoh-announcement-form]");
        if (marsohAnnouncementForm) {
          event.preventDefault();
          await submitMarsohAnnouncement(marsohAnnouncementForm);
          return;
        }

        const marsohTopicForm = eventClosest(event, "[data-marsoh-topic-form]");
        if (marsohTopicForm) {
          event.preventDefault();
          await submitMarsohTopic(marsohTopicForm);
          return;
        }

        const marsohChannelForm = eventClosest(event, "[data-marsoh-channel-form]");
        if (marsohChannelForm) {
          event.preventDefault();
          await submitMarsohChannel(marsohChannelForm);
          return;
        }

        const releaseForm = eventClosest(event, "[data-release-form]");
        if (releaseForm) {
          event.preventDefault();
          await submitReleaseApproval(releaseForm);
        }
      });

      document.addEventListener("click", async (event) => {
        const toggle = eventClosest(event, ".sa-toggle");
        if (toggle) {
          toggle.setAttribute("aria-pressed", toggle.getAttribute("aria-pressed") !== "true");
        }

        const viewJump = eventClosest(event, "[data-view-jump]");
        if (viewJump) await jumpOwnerView(viewJump.dataset.viewJump);

        if (eventClosest(event, "[data-release-open]")) openReleaseModal();
        if (eventClosest(event, "[data-release-cancel]")) closeReleaseModal();
        if (eventClosest(event, "[data-drawer-close]")) closeDrawer();

        if (eventClosest(event, "[data-open-links]")) {
          const payload = state.commandCenter || await loadCommandCenter();
          openDrawer("Hızlı Erişim", ownerControlLinks(payload.control_links || []));
        }

        if (eventClosest(event, "[data-action-health-check]")) await runOwnerActionHealthCheck();

        const approvalDetail = eventClosest(event, "[data-approval-detail]");
        if (approvalDetail) showApprovalDetail(approvalDetail.dataset.approvalDetail);

        const eventDetail = eventClosest(event, "[data-event-detail]");
        if (eventDetail) showEventDetail(eventDetail.dataset.eventDetail);

        const maritimeCaseDetail = eventClosest(event, "[data-maritime-case-detail]");
        if (maritimeCaseDetail) showMaritimeCaseDetail(maritimeCaseDetail.dataset.maritimeCaseDetail);

        const maritimeAccessRequestDetail = eventClosest(event, "[data-maritime-access-request-detail]");
        if (maritimeAccessRequestDetail) showMaritimeAccessRequestDetail(maritimeAccessRequestDetail.dataset.maritimeAccessRequestDetail);

        const maritimeAccessEventDetail = eventClosest(event, "[data-maritime-access-event-detail]");
        if (maritimeAccessEventDetail) showMaritimeAccessEventDetail(maritimeAccessEventDetail.dataset.maritimeAccessEventDetail);

        const marsohAdminAction = eventClosest(event, "[data-marsoh-admin-action]");
        if (marsohAdminAction) await runMarsohAdminAction(marsohAdminAction);

        const marsohReportAction = eventClosest(event, "[data-marsoh-report-action]");
        if (marsohReportAction) await runMarsohReportAction(marsohReportAction);

        const marsohContext = eventClosest(event, "[data-marsoh-context]");
        if (marsohContext) await showMarsohContext(marsohContext.dataset.marsohContext);

        const marsohBulkRemove = eventClosest(event, "[data-marsoh-bulk-remove]");
        if (marsohBulkRemove) await removeAllMarsohMessages(marsohBulkRemove);

        const marsohLoadMore = eventClosest(event, "[data-marsoh-load-more]");
        if (marsohLoadMore) await loadMoreMarsohMessages(marsohLoadMore);

        const moduleMapDetail = eventClosest(event, "[data-module-map-detail]");
        if (moduleMapDetail) showModuleMapDetail(moduleMapDetail.dataset.moduleMapDetail);

        const permissionSave = eventClosest(event, "[data-permission-save]");
        if (permissionSave) await updatePermission(permissionSave);

        const userAction = eventClosest(event, "[data-user-action]");
        if (userAction) await updateUserAction(userAction);

        const partnerDecision = eventClosest(event, "[data-partner-decision]");
        if (partnerDecision) await decidePartner(partnerDecision);

        const settingSave = eventClosest(event, "[data-setting-save]");
        if (settingSave) await saveSetting(settingSave);

        const moduleSave = eventClosest(event, "[data-module-save]");
        if (moduleSave) await saveModule(moduleSave);
      });
    }

    const refresh = $("[data-sa-refresh]");
    if (refresh && refresh.dataset.bound !== "true") {
      refresh.dataset.bound = "true";
      refresh.addEventListener("click", reloadOwnerActiveView);
    }

    const signOut = $("[data-sa-signout]");
    if (signOut && signOut.dataset.bound !== "true") {
      signOut.dataset.bound = "true";
      signOut.addEventListener("click", () => {
        App.auth.signOut({ scope: "local" });
      });
    }
  }

  async function initOwnerConsole() {
    state.access = await App.auth.requireRole(SUPER_ADMIN_ENTRY_ROLES);
    if (!state.access) return;
    if (await redirectToMfaForPrivilegedSession()) return;
    bindOwnerConsole();
    try {
      await loadOwnerSession();
    } catch (error) {
      await recoverOwnerSessionWithPreflight(error);
    }
    await loadOwnerView("overview");
  }

  function bindInteractions() {
    const nav = $("[data-sa-nav]");
    if (nav) {
      nav.addEventListener("click", async (event) => {
        const button = eventClosest(event, "[data-view-target]");
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
      const toggle = eventClosest(event, ".sa-toggle");
      if (toggle) {
        toggle.setAttribute("aria-pressed", toggle.getAttribute("aria-pressed") !== "true");
      }

      const userAction = eventClosest(event, "[data-user-action]");
      if (userAction) await updateUserAction(userAction);

      const partnerDecision = eventClosest(event, "[data-partner-decision]");
      if (partnerDecision) await decidePartner(partnerDecision);

      const settingSave = eventClosest(event, "[data-setting-save]");
      if (settingSave) await saveSetting(settingSave);

      const moduleSave = eventClosest(event, "[data-module-save]");
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
    const ownerShell = $("[data-super-admin-shell]");
    if (ownerShell && !state.ownerShellMarkup) state.ownerShellMarkup = ownerShell.innerHTML;
    if ($("[data-command-output]")) {
      try {
        await initOwnerConsole();
      } catch (error) {
        const shell = $("[data-super-admin-shell]");
        await renderAccessFallback(shell, error, "Bu panele sadece kayıtlı Super Admin sahibi erişebilir.");
      }
      return;
    }
    try {
      state.access = await App.auth.requireRole(SUPER_ADMIN_ENTRY_ROLES);
      if (!state.access) return;
      if (await redirectToMfaForPrivilegedSession()) return;
      const roleTarget = $("[data-sa-role]");
      if (roleTarget) roleTarget.textContent = state.access.profile.role;
      bindInteractions();
      await reloadAll();
    } catch (error) {
      const shell = $("[data-super-admin-shell]");
      await renderAccessFallback(shell, error, "Bu panele sadece Super Admin erişebilir.");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
