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
    refundCancellations: []
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

  function partnerAccessEmailStatus(auth) {
    if (auth?.access_email_sent || auth?.invite_sent || auth?.password_reset_sent) {
      const type = auth.access_email_type === "invite" ? "davet maili" : "şifre belirleme maili";
      return `${type} gönderildi`;
    }
    return auth?.access_email_error
      ? `erişim maili gönderilemedi: ${auth.access_email_error}`
      : "erişim maili gönderilmedi";
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
    return core.url(`/admin/super-admin-login.html?returnTo=${returnTo}`);
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

  async function requireOwnerEntry() {
    if (!App.auth || !App.auth.requireAuth) throw new Error("Oturum modülü yüklenemedi.");
    const user = await App.auth.requireAuth();
    if (!user) return null;
    let profile = null;
    if (App.auth.getProfile) {
      profile = await App.auth.getProfile(user.id).catch(() => null);
    }
    return {
      user,
      profile: profile || {
        id: user.id,
        email: user.email || "",
        role: "owner_candidate"
      }
    };
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
      return {
        ...fallbackDiagnosis,
        mode: "locked",
        message: "Owner preflight API yanıtı alınamadı.",
        helper: publicError(error, "Owner doğrulaması backend'e ulaşamadı. API, CORS, Cloudflare veya oturum tokenı kontrol edilmeli."),
        steps: [
          "Sayfayı yenile ve tekrar dene.",
          "MFA2 tamamlandıysa owner-preflight API çağrısı backend'e ulaşmalı.",
          "Devam ederse api.allonahub.com CORS/admin host ve Cloudflare challenge durumunu kontrol et."
        ]
      };
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

  function apiRouteMissing(error) {
    const message = String(error?.message || error?.payload?.message || "");
    return error?.status === 404 || /route .*not found|not found/i.test(message);
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
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest"
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

  async function ownerOptionalApi(path, fallback, label) {
    try {
      return await api(path);
    } catch (error) {
      return Object.assign({}, fallback || {}, {
        __ownerWarning: {
          label: label || path,
          message: publicError(error, "Veri alınamadı.")
        }
      });
    }
  }

  function ownerDataWarnings() {
    return Array.from(arguments)
      .map((payload) => payload && payload.__ownerWarning)
      .filter(Boolean)
      .map((warning) => ownerLine(`${warning.label} veri uyarısı`, escape(warning.message), "", "high"))
      .join("");
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
                      <button class="sa-btn sa-mini" type="button" data-partner-detail="${escape(item.id)}">Karar Ver</button>
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

  function partnerCreateFormMarkup() {
    return `
      <form class="sa-inline-form" data-partner-create-form>
        <label>Firma / Mağaza
          <input name="company_name" required maxlength="160" placeholder="Örn. Allona Market Partneri">
        </label>
        <label>Yetkili
          <input name="contact_name" required maxlength="140" placeholder="Ad Soyad">
        </label>
        <label>E-posta
          <input name="email" required type="email" maxlength="180" placeholder="partner@firma.com">
        </label>
        <label>Telefon
          <input name="phone" maxlength="40" placeholder="+90 5xx xxx xx xx">
        </label>
        <label>Tip
          <select name="partner_type">
            <option value="shop">Shop / Pazaryeri</option>
            <option value="food">Yemek / Restoran</option>
            <option value="market">Market</option>
            <option value="service">Hizmet / Ekosistem</option>
          </select>
        </label>
        <label>Şehir
          <input name="city" maxlength="90" placeholder="İstanbul">
        </label>
        <label>Komisyon
          <input name="commission_rate" type="number" min="0" max="0.9" step="0.01" value="0.12">
        </label>
        <button class="sa-btn" type="submit">Partner Aç</button>
      </form>
    `;
  }

  async function createPartnerFromForm(form) {
    const formData = new FormData(form);
    const companyName = String(formData.get("company_name") || "").trim();
    const contactName = String(formData.get("contact_name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const partnerType = String(formData.get("partner_type") || "shop").trim();
    const payload = {
      company_name: companyName,
      contact_name: contactName,
      email,
      phone: String(formData.get("phone") || "").trim(),
      city: String(formData.get("city") || "").trim(),
      country: "Türkiye",
      category: partnerType,
      partner_type: partnerType,
      commission_rate: Number(formData.get("commission_rate") || 0.12),
      store_status: "active",
      reason: `Super Admin panelinden ${companyName || email} için doğrudan partner daveti oluşturuldu.`
    };

    const trigger = form.querySelector("button[type='submit']");
    await runConfirmed(`${companyName || email} için partner hesabı açılacak. Kullanıcı yoksa Supabase Auth daveti gönderilecek, profil rolü partner yapılacak ve aktif partner işletmesi oluşturulacak.`, async (reason) => {
      const result = await api("/v1/control-center/partners", {
        method: "POST",
        body: { ...payload, reason: reason || payload.reason }
      });
      const activation = result.activation || {};
      const auth = activation.auth || {};
      openDrawer("Partner Açılış Sonucu", [
        ownerLine("Firma", escape(result.partner_business?.display_name || companyName || "-"), "", "low"),
        ownerLine("Auth kullanıcısı", `${escape(auth.email || email)} / ${auth.created ? "yeni oluşturuldu" : "mevcut kullanıcı bağlandı"}`, "", "medium"),
        ownerLine("Erişim maili", escape(partnerAccessEmailStatus(auth)), "", auth.access_email_sent || auth.invite_sent || auth.password_reset_sent ? "low" : "high"),
        ownerLine("Partner paneli", "<a href=\"https://partner.allonahub.com/\">partner.allonahub.com</a>", "", "low")
      ].join(""));
      form.reset();
    }, {
      trigger,
      defaultReason: payload.reason,
      requireReason: true
    });
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
          ${item.subdomain_url ? `<a class="sa-mini-link" href="${escape(item.subdomain_url)}" target="_blank" rel="noopener">${escape(item.subdomain)}.allonahub.com</a>` : ""}
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
      approved: "Partner başvurusu onaylanacak; kullanıcı, profil, modül yetkisi ve aktif partner işletmesi otomatik oluşturulacak.",
      rejected: "Partner başvurusu reddedilecek."
    };
    const message = messages[decision] || "Partner başvurusu güncellenecek.";
    const confirmed = await confirmAction(message, {
      defaultReason: message,
      requireReason: decision !== "review"
    });
    if (!confirmed.confirmed) return;
    button.disabled = true;
    button.dataset.originalText = button.dataset.originalText || button.textContent || "";
    button.textContent = "Uygulanıyor...";
    try {
      const decisionPayload = {
        application_id: applicationId,
        decision,
        reason: confirmed.reason || message,
        commission_rate: 0.12,
        store_status: decision === "approved" ? "active" : "review"
      };
      let result = null;
      try {
        result = await api("/v1/control-center/partner-application-decisions", {
          method: "POST",
          body: decisionPayload
        });
      } catch (error) {
        if (!apiRouteMissing(error)) throw error;
        const { application_id: _applicationId, ...legacyPayload } = decisionPayload;
        result = await api(`/v1/control-center/partner-applications/${encodeURIComponent(applicationId)}`, {
          method: "PATCH",
          body: legacyPayload
        });
      }
      showPartnerDecisionResult(result, decision);
      if ($("[data-command-output]")) {
        await reloadOwnerActiveView();
      } else {
        await reloadActiveView();
      }
      setAlert(decision === "approved" ? "Partner onaylandı ve aktif edildi." : "Partner kararı kaydedildi.", "ok");
    } catch (error) {
      const messageText = publicError(error, "Partner kararı tamamlanamadı.");
      setAlert(messageText, "error");
      openDrawer("Partner Kararı Hatası", ownerLine("İşlem tamamlanamadı", escape(messageText), "<button type=\"button\" data-action-health-check>Komutları test et</button>", "critical"));
    } finally {
      button.disabled = false;
      button.textContent = button.dataset.originalText || "Uygula";
    }
  }

  function partnerApplicationById(applicationId) {
    return state.applications.find((item) => String(item.id) === String(applicationId));
  }

  function partnerApplicationDetailMarkup(item) {
    const metadata = item?.metadata && typeof item.metadata === "object" ? item.metadata : {};
    const actions = [
      `<button type="button" data-partner-decision="approved" data-application-id="${escape(item.id)}">Onayla ve Aktif Et</button>`,
      `<button type="button" data-partner-decision="rejected" data-application-id="${escape(item.id)}">Reddet</button>`,
      `<button type="button" data-partner-decision="review" data-application-id="${escape(item.id)}">İncelemeye Al</button>`
    ].join(" ");
    return [
      ownerLine("Firma", escape(item.company_name || "-"), "", "medium"),
      ownerLine("Yetkili", escape(item.contact_name || "-"), "", "medium"),
      ownerLine("İletişim", `${escape(item.email || "-")} / ${escape(item.phone || "-")}`, "", "medium"),
      ownerLine("Vergi / şehir", `${escape(item.tax_number || "-")} / ${escape(metadata.city || item.city || "-")}`, "", "medium"),
      ownerLine("Durum", `${escape(item.status || "-")} / ${escape(item.review_stage || "-")} / öneri ${escape(item.admin_recommendation || "-")}`, "", item.status === "pending" ? "high" : "medium"),
      ownerLine("Açıklama", escape(metadata.message || item.message || "-"), "", "medium"),
      ownerLine("Karar", "Detayı inceledikten sonra nihai kararı ver. Onay, partner hesabını ve aktif mağazayı otomatik açar.", actions, "critical")
    ].join("");
  }

  function showPartnerApplicationDetail(applicationId) {
    const item = partnerApplicationById(applicationId);
    if (!item) {
      openDrawer("Partner Başvurusu", ownerLine("Başvuru bulunamadı", escape(applicationId), "", "critical"));
      return;
    }
    openDrawer("Partner Başvuru Detayı", partnerApplicationDetailMarkup(item));
  }

  function showPartnerDecisionResult(result, decision) {
    const application = result?.application || {};
    const business = result?.partner_business || {};
    const activation = result?.activation || {};
    const auth = activation.auth || {};
    openDrawer("Partner Kararı", [
      ownerLine("Başvuru", `${escape(application.company_name || application.id || "-")} / ${escape(application.status || decision)}`, "", decision === "approved" ? "low" : "medium"),
      ownerLine("Partner mağazası", `${escape(business.display_name || "-")} / ${escape(business.status || "-")} / ${escape(business.verification_status || "-")}`, "", business.status === "active" ? "low" : "high"),
      ownerLine("Auth kullanıcısı", `${escape(auth.email || application.email || "-")} / ${auth.created ? "yeni oluşturuldu" : "mevcut kullanıcı"}`, "", "medium"),
      ownerLine("Erişim maili", escape(partnerAccessEmailStatus(auth)), "", auth.access_email_sent || auth.invite_sent || auth.password_reset_sent ? "low" : "high"),
      ownerLine("Partner paneli", "<a href=\"https://partner.allonahub.com/\" target=\"_blank\" rel=\"noopener\">partner.allonahub.com</a>", "", "low")
    ].join(""));
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
    "work-queue": ["İş Kuyruğu", "Modül onayları, riskler, destek ve yayın kararları"],
    alerts: ["Uyarı / Risk Akışı", "Öncelikli güvenlik, sistem ve yayın riskleri"],
    approvals: ["Yayın Onayları", "Main, deploy, migration ve panel değişikliği onayları"],
    "release-history": ["Yayın Geçmişi", "Onaylanan, gönderilen ve hata alan yayın kararları"],
    operations: ["Operasyon Merkezi", "Sipariş, destek ve canlı operasyon görünümü"],
    refunds: ["İade ve İptaller", "İade, iptal, neden ve owner aksiyon kontrolü"],
    finance: ["Finans Merkezi", "Ciro, ödeme, komisyon, iade ve hakediş kontrolü"],
    content: ["İçerik Kontrolü", "Banner, kampanya, sayfa, sosyal medya ve modül içerikleri"],
    health: ["Sistem Sağlığı", "API, database, webhook, modül ve operasyon servisleri"],
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

  function ownerControlLinkView(link) {
    const legacyMap = {
      orders: "operations",
      partner_orders: "operations",
      coupons: "content",
      hp_rewards: "finance",
      user_panel: "users",
      partner_panel: "partners",
      admin_panel: "operations"
    };
    return link.view || legacyMap[link.key] || "";
  }

  function ownerControlLinks(links) {
    const rows = (links || []).map((link) => {
      const view = ownerControlLinkView(link);
      const action = view
        ? `<button type="button" data-view-jump="${escape(view)}">Yönet</button>`
        : `<a href="${escape(link.href || "#")}">Aç</a>`;
      const target = view ? `super admin: ${view}` : (link.href || "route");
      return ownerLine(
        link.label || link.key,
        `${escape(link.key || "route")} / ${escape(target)} / risk: ${escape(link.risk_level || "low")}`,
        action,
        link.risk_level
      );
    });
    return rows.length ? rows.join("") : ownerEmpty("Yönlendirme bulunamadı.");
  }

  async function loadCommandCenter() {
    const payload = await api("/v1/control-center/command-center");
    state.commandCenter = payload;
    return payload;
  }

  async function loadCommandCenterOptional(label) {
    if (state.commandCenter) return state.commandCenter;
    const payload = await ownerOptionalApi("/v1/control-center/command-center", {
      summary: {},
      system_health: {},
      gitops: {}
    }, label || "Komut merkezi");
    if (!payload.__ownerWarning) state.commandCenter = payload;
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
      ownerLine("İş kuyruğu", "AVM, yemek, taksi, sosyal medya, destek, güvenlik ve yayın kararlarını tek listede izle.", "<button type=\"button\" data-view-jump=\"work-queue\">Aç</button>", "critical"),
      ownerLine("Operasyon merkezi", "Siparişler, destek talepleri ve canlı operasyon akışını Super Admin içinden izle.", "<button type=\"button\" data-view-jump=\"operations\">Aç</button>", "high"),
      ownerLine("İade ve iptaller", "İade/iptal kayıtlarını, nedenleri, destek sinyallerini ve owner aksiyonlarını tek yerden yönet.", "<button type=\"button\" data-view-jump=\"refunds\">Aç</button>", "critical"),
      ownerLine("Finans merkezi", "Ciro, ödeme riski, komisyon, iade ve hakediş ayarlarını tek yerden takip et.", "<button type=\"button\" data-view-jump=\"finance\">Aç</button>", "critical"),
      ownerLine("İçerik kontrolü", "Banner, kampanya, sayfa, sosyal medya ve modül içerik önerilerini gör.", "<button type=\"button\" data-view-jump=\"content\">Aç</button>", "high"),
      ownerLine("Ana sayfa modülleri", `${formatNumber(summary.homepage_modules)} modül / ${formatNumber(summary.future_operations)} gelecek operasyon`, "<button type=\"button\" data-view-jump=\"module-map\">Harita</button>", "medium"),
      ownerLine("Toplam sipariş", formatNumber(summary.total_orders), "<button type=\"button\" data-view-jump=\"operations\">Siparişleri yönet</button>", "medium"),
      ownerLine("Günlük ciro", money(summary.daily_revenue), "<button type=\"button\" data-view-jump=\"system\">Finans ayarları</button>", "low"),
      ownerLine("Bekleyen başvuru", formatNumber(summary.pending_applications), "<button type=\"button\" data-view-jump=\"partners\">Karar ver</button>", summary.pending_applications ? "high" : "low"),
      ownerLine("Güvenlik uyarısı", `${formatNumber(summary.security_alerts_24h)} / son 24 saat`, "<button type=\"button\" data-view-jump=\"security\">İncele</button>", summary.security_alerts_24h ? "high" : "low"),
      ownerLine("Canlı altyapı", `API ${escape(system.api || "-")} / DB ${escape(system.database || "-")} / Auto-defense ${formatNumber(system.auto_defense && system.auto_defense.recent_incident_count)} olay`, "<button type=\"button\" data-view-jump=\"alerts\">Risk akışı</button>", system.database === "online" ? "low" : "high"),
      ownerLine("Komut sağlık testi", "Panel komutlarını mevcut kontrol merkezi verisiyle kontrol et.", "<button type=\"button\" data-action-health-check>Komutları Test Et</button>", "medium"),
      ownerLine("Yayın hattı", gitops.enabled ? "Güvenli webhook açık" : "Bekleyen onay varsa detay incelemesi gerekir", "<button type=\"button\" data-view-jump=\"approvals\">Bekleyenleri incele</button>", gitops.enabled ? "high" : "medium"),
      ownerLine("Sistem sağlığı", "API, DB, GitOps, komut kabiliyeti ve operasyon raporlarını tek ekranda gör.", "<button type=\"button\" data-view-jump=\"health\">Aç</button>", system.database === "online" ? "low" : "critical"),
      ownerLine("Yönetim kısayolları", "Sipariş, finans, içerik, kullanıcı, partner ve modül yönetimi", "<button type=\"button\" data-open-links>Liste</button>", "low")
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

  function workQueueFilterMarkup(params) {
    const source = params && params.source_module || "";
    const status = params && params.status || "";
    const risk = params && params.risk_level || "";
    const sources = ["", "admin_ops", "avm", "food", "taxi", "social_media", "partner", "user_panel", "security", "legal", "release", "system", "other"];
    const statuses = ["", "open", "in_progress", "waiting_owner", "decided", "resolved", "cancelled"];
    const risks = ["", "low", "medium", "high", "critical"];
    return `
      <form class="sa-inline-form" data-owner-work-queue-filter>
        <select name="source_module">
          ${sources.map((item) => `<option value="${escape(item)}" ${source === item ? "selected" : ""}>${escape(item || "Tüm modüller")}</option>`).join("")}
        </select>
        <select name="status">
          ${statuses.map((item) => `<option value="${escape(item)}" ${status === item ? "selected" : ""}>${escape(item || "Tüm durumlar")}</option>`).join("")}
        </select>
        <select name="risk_level">
          ${risks.map((item) => `<option value="${escape(item)}" ${risk === item ? "selected" : ""}>${escape(item || "Tüm riskler")}</option>`).join("")}
        </select>
        <button class="sa-btn sa-btn-ghost" type="submit">Filtrele</button>
      </form>
    `;
  }

  async function loadOwnerWorkQueue(params) {
    ownerLoading("İş Kuyruğu");
    const query = new URLSearchParams(params || {});
    const payload = await api(`/v1/control-center/work-queue?${query.toString()}`);
    state.workQueueItems = payload.items || [];
    const summary = payload.summary || {};
    const rows = state.workQueueItems.map((item) => {
      const actionable = item.actionable === true;
      const action = actionable
        ? [
          `<button type="button" data-work-queue-status="in_progress" data-work-queue-id="${escape(item.id)}">İşleme al</button>`,
          `<button type="button" data-work-queue-status="waiting_owner" data-work-queue-id="${escape(item.id)}">Owner bekliyor</button>`,
          `<button type="button" data-work-queue-decision="resolved" data-work-queue-id="${escape(item.id)}">Çöz</button>`
        ].join(" ")
        : `<button type="button" data-work-queue-source="${escape(item.source_module || "other")}">Kaynağa git</button>`;
      return ownerLine(
        `${item.title || "İş"} ${actionable ? "" : "(türetilmiş)"}`,
        `${escape(item.source_module || "other")} / ${escape(item.target_type || "-")} / durum ${escape(item.status || "open")} / öncelik ${escape(item.priority || "normal")} / ${formatDate(item.created_at)}`,
        action,
        item.risk_level
      );
    });
    const warningRows = (payload.schema_warnings || []).map((item) => ownerLine(
      item.label || "schema",
      escape(item.message || "Migration kontrol edilmeli."),
      escape(item.code || ""),
      "high"
    ));
    ownerSetOutput(
      workQueueFilterMarkup(params) +
      ownerLine("Kuyruk özeti", `${formatNumber(summary.total)} kayıt / ${formatNumber(summary.stored)} kalıcı / ${formatNumber(summary.derived)} türetilmiş / ${formatNumber(summary.urgent)} acil`, "<button type=\"button\" data-action-health-check>Komutları test et</button>", summary.urgent ? "critical" : "medium") +
      (warningRows.join("") || "") +
      (rows.length ? rows.join("") : ownerEmpty("İş kuyruğu kaydı bulunamadı."))
    );
  }

  function sourceViewForWorkQueue(sourceModule) {
    const map = {
      admin_ops: "partners",
      avm: "module-map",
      food: "module-map",
      taxi: "module-map",
      social_media: "module-map",
      partner: "partners",
      user_panel: "users",
      security: "security",
      legal: "module-map",
      release: "approvals",
      system: "system"
    };
    return map[sourceModule] || "module-map";
  }

  async function updateWorkQueueStatus(button) {
    const itemId = button.dataset.workQueueId;
    const status = button.dataset.workQueueStatus;
    const item = (state.workQueueItems || []).find((entry) => entry.id === itemId);
    const message = `${item?.title || "İş kuyruğu kaydı"} durumu ${status} yapılacak.`;
    await runConfirmed(message, async (reason) => {
      await api(`/v1/control-center/work-queue/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        body: {
          status,
          reason
        }
      });
    }, {
      trigger: button,
      defaultReason: message,
      requireReason: true
    });
  }

  async function decideWorkQueueItem(button) {
    const itemId = button.dataset.workQueueId;
    const decision = button.dataset.workQueueDecision;
    const item = (state.workQueueItems || []).find((entry) => entry.id === itemId);
    const message = `${item?.title || "İş kuyruğu kaydı"} için ${decision} kararı verilecek.`;
    await runConfirmed(message, async (reason) => {
      await api(`/v1/control-center/work-queue/${encodeURIComponent(itemId)}/decision`, {
        method: "POST",
        body: {
          decision,
          status: decision === "resolved" ? "resolved" : "decided",
          reason
        }
      });
    }, {
      trigger: button,
      defaultReason: message,
      requireReason: true
    });
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
      ownerLine("Backend build", escape(system.build || "-"), "actions8 görünmüyorsa API redeploy eski build'de kalmıştır", system.build === "super-admin-actions-20260625-actions8" ? "low" : "high"),
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
    const [releasePayload, queuePayload] = await Promise.all([
      ownerOptionalApi("/v1/control-center/release-approvals?limit=80&status=pending", { approvals: [] }, "Yayın onayları"),
      ownerOptionalApi("/v1/control-center/work-queue?limit=80&status=open", { items: [] }, "İş kuyruğu")
    ]);
    state.approvals = releasePayload.approvals || [];
    state.approvalQueueItems = (queuePayload.items || []).filter((item) => {
      return item.target_type === "content_change_proposal"
        || item.target_type === "content_module"
        || item.target_type === "admin_approval_request";
    });

    const releaseRows = state.approvals.map((item) => {
      return ownerLine(
        `${item.approval_type} / onay bekliyor`,
        `${escape(item.target_ref || "main")} - ${escape(item.target_summary || "Açıklama yok")}`,
        `<button type="button" data-approval-detail="${escape(item.id)}">Detay</button>`,
        item.risk_level
      );
    });

    const queueRows = state.approvalQueueItems.map((item) => {
      const scope = item.metadata && item.metadata.content_scope ? ` / ${item.metadata.content_scope}` : "";
      return ownerLine(
        `${item.title || "Admin onayı"} / admin panelden geldi`,
        `${escape(item.source_module || "admin_ops")} / ${escape(item.target_type || "-")}${escape(scope)} / ${formatDate(item.created_at)}`,
        `<button type="button" data-view-jump="work-queue">İş kuyruğunda aç</button>`,
        item.risk_level || "medium"
      );
    });

    const total = releaseRows.length + queueRows.length;
    ownerSetOutput(
      ownerDataWarnings(releasePayload, queuePayload) +
      (total
        ? ownerLine("Bekleyen onaylar", `${formatNumber(total)} kayıt: ${formatNumber(releaseRows.length)} yayın / ${formatNumber(queueRows.length)} admin-içerik onayı.`, "", total ? "critical" : "low") +
          (queueRows.length ? ownerLine("Admin Panel İçerik Onayları", "Ana sayfa modülü, banner, kampanya, sayfa ve yasal içerik önerileri burada görünür.", "", "high") + queueRows.join("") : "") +
          (releaseRows.length ? ownerLine("Yayın / Deploy Onayları", "Main, deploy, migration ve panel değişikliği onayları.", "", "critical") + releaseRows.join("") : "")
        : ownerLine("Bekleyen yayın onayı yok", "Admin içerik onayı, main commit/push, deploy, migration veya panel değişikliği için bekleyen kayıt bulunmuyor.", "", "low"))
    );
  }

  async function loadOwnerReleaseHistory() {
    ownerLoading("Yayın Geçmişi");
    const payload = await ownerOptionalApi("/v1/control-center/release-approvals?limit=80", { approvals: [] }, "Yayın geçmişi");
    state.releaseHistory = payload.approvals || [];
    const rows = state.releaseHistory.map((item) => {
      const response = item.webhook_response || {};
      const action = item.status === "pending"
        ? `<button type="button" data-approval-detail="${escape(item.id)}">Detay / Onay</button>`
        : `<button type="button" data-release-history-detail="${escape(item.id)}">Detay</button>`;
      return ownerLine(
        `${item.approval_type || "release"} / ${item.status || "-"}`,
        `${escape(item.target_ref || "main")} - ${escape(item.target_summary || "Açıklama yok")} / webhook ${escape(String(item.webhook_status || response.code || response.ok || "-"))} / ${formatDate(item.created_at)}`,
        action,
        item.status === "failed" ? "critical" : (item.status === "pending" ? "critical" : item.risk_level || "low")
      );
    });
    ownerSetOutput(
      ownerDataWarnings(payload) +
      ownerLine("Yayın kayıtları", `${formatNumber(state.releaseHistory.length)} kayıt listeleniyor. Pending kayıtlar Bekleyenler ekranında da görünür.`, "<button type=\"button\" data-view-jump=\"approvals\">Bekleyenler</button>", "medium") +
      (rows.length ? rows.join("") : ownerEmpty("Yayın geçmişi kaydı bulunamadı."))
    );
  }

  async function loadOwnerOperations() {
    ownerLoading("Operasyon Merkezi");
    const [dashboardPayload, ordersPayload, supportPayload] = await Promise.all([
      ownerOptionalApi("/v1/admin/ops/dashboard", { dashboard: { metrics: {} } }, "Operasyon dashboard"),
      ownerOptionalApi("/v1/admin/ops/orders?limit=12", { orders: [] }, "Siparişler"),
      ownerOptionalApi("/v1/admin/ops/support-tickets?limit=12", { tickets: [] }, "Destek talepleri")
    ]);
    const metrics = dashboardPayload.dashboard && dashboardPayload.dashboard.metrics || {};
    const orders = ordersPayload.orders || [];
    const tickets = supportPayload.tickets || [];
    const orderRows = orders.slice(0, 8).map((order) => ownerLine(
      order.order_no || order.id,
      `${escape(order.customer_name || order.customer_email || "-")} / ${money(order.total)} / sipariş ${escape(order.order_status || "-")} / ödeme ${escape(order.payment_status || "-")} / ${formatDate(order.created_at)}`,
      `<button type="button" data-view-jump="operations">Operasyon görünümü</button>`,
      ["cancelled", "failed"].includes(order.order_status) || ["failed", "refunded"].includes(order.payment_status) ? "high" : "medium"
    ));
    const ticketRows = tickets.slice(0, 8).map((ticket) => ownerLine(
      ticket.title || ticket.category || "Destek talebi",
      `${escape(ticket.source || "user")} / ${escape(ticket.requester_label || "-")} / durum ${escape(ticket.status || "-")} / ${formatDate(ticket.created_at)}`,
      `<a href="./index.html">Admin Ops</a>`,
      ticket.priority === "urgent" ? "critical" : "medium"
    ));
    ownerSetOutput(
      ownerDataWarnings(dashboardPayload, ordersPayload, supportPayload) +
      ownerLine("Bugünkü operasyon", `${formatNumber(metrics.daily_users)} yeni kullanıcı / ${formatNumber(metrics.daily_partner_applications)} partner başvurusu / ${formatNumber(metrics.recent_orders)} son sipariş`, "<a href=\"./index.html\">Admin Ops</a>", "medium") +
      ownerLine("Açık destek", `${formatNumber(metrics.open_support_tickets)} talep / ${formatNumber(metrics.system_alerts)} sistem uyarısı`, "<button type=\"button\" data-view-jump=\"work-queue\">İş kuyruğu</button>", metrics.open_support_tickets || metrics.system_alerts ? "high" : "low") +
      ownerLine("Son siparişler", `${formatNumber(orders.length)} kayıt`, "", "medium") +
      (orderRows.join("") || ownerEmpty("Sipariş kaydı bulunamadı.")) +
      ownerLine("Destek akışı", `${formatNumber(tickets.length)} kayıt`, "", tickets.length ? "high" : "low") +
      (ticketRows.join("") || ownerEmpty("Açık destek kaydı bulunamadı."))
    );
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

  function providerDispatchText(dispatch) {
    if (!dispatch) return "Provider bildirimi henüz yok.";
    const webhook = dispatch.channels && dispatch.channels.webhook || {};
    const iyzico = dispatch.channels && dispatch.channels.iyzico || {};
    const parts = [
      webhook.configured ? `webhook ${webhook.sent ? "gönderildi" : "başarısız"}${webhook.status ? `/${webhook.status}` : ""}` : "webhook yok",
      iyzico.skipped ? `iyzico ${iyzico.code || "atlanmış"}` : `iyzico ${iyzico.sent ? "gönderildi" : "hazır değil"}${iyzico.status ? `/${iyzico.status}` : ""}`
    ];
    return parts.join(" / ");
  }

  function refundFiltersMarkup(params) {
    const status = params && params.status || "all";
    const search = params && params.search || "";
    return `
      <form class="sa-filter" data-owner-refunds-filter>
        <input name="search" type="search" value="${escape(search)}" placeholder="Sipariş no, müşteri, e-posta veya neden ara">
        <select name="status">
          ${[
            ["all", "Tümü"],
            ["refunded", "İadeler"],
            ["cancelled", "İptaller"],
            ["pending_signal", "Destek sinyalleri"]
          ].map(([value, label]) => `<option value="${value}" ${status === value ? "selected" : ""}>${label}</option>`).join("")}
        </select>
        <button type="submit">Filtrele</button>
      </form>
    `;
  }

  async function loadOwnerRefunds(params) {
    ownerLoading("İade ve İptaller");
    const query = new URLSearchParams({ limit: "80" });
    if (params && params.status) query.set("status", params.status);
    if (params && params.search) query.set("search", params.search);
    const payload = await ownerOptionalApi(`/v1/control-center/refund-cancellations?${query.toString()}`, {
      summary: {},
      items: [],
      warnings: []
    }, "İade ve iptal kayıtları");
    const summary = payload.summary || {};
    state.refundCancellations = payload.items || [];
    const rows = state.refundCancellations.map((item) => {
      const isTicket = item.type === "support_signal";
      const detail = isTicket
        ? `<button type="button" data-refund-ticket-detail="${escape(item.ticket_id || item.id)}">Detay</button>`
        : `<button type="button" data-refund-detail="${escape(item.id)}">Detay</button>`;
      const actions = isTicket ? detail : [
        detail,
        `<button type="button" data-refund-action="mark_review" data-refund-order="${escape(item.id)}">İncele</button>`,
        item.type !== "cancellation" ? `<button type="button" data-refund-action="approve_cancellation" data-refund-order="${escape(item.id)}">İptal</button>` : "",
        item.type !== "refund" ? `<button type="button" data-refund-action="approve_refund" data-refund-order="${escape(item.id)}">İade</button>` : "",
        `<button type="button" data-refund-action="reject_request" data-refund-order="${escape(item.id)}">Reddet</button>`
      ].filter(Boolean).join(" ");
      return ownerLine(
        `${refundTypeLabel(item.type)} / ${item.order_no || item.id}`,
        `${escape(item.customer_name || item.customer_email || "-")} / ${item.total ? money(item.total) : "tutar yok"} / sipariş ${escape(item.order_status || "-")} / ödeme ${escape(item.payment_status || "-")} / neden: ${escape(core.truncate ? core.truncate(item.reason || "-", 180) : String(item.reason || "-").slice(0, 180))} / ${formatDate(item.updated_at || item.created_at)}`,
        actions,
        item.risk_level || (item.type === "refund" ? "critical" : "high")
      );
    });
    ownerSetOutput(
      refundFiltersMarkup(params || {}) +
      ownerDataWarnings(payload) +
      ownerLine("Özet", `${formatNumber(summary.total)} kayıt / ${formatNumber(summary.refunded)} iade / ${formatNumber(summary.cancelled)} iptal / ${formatNumber(summary.support_signals)} destek sinyali`, "<button type=\"button\" data-view-jump=\"operations\">Operasyon</button>", summary.action_required ? "critical" : "low") +
      (payload.warnings || []).map((warning) => ownerLine("Şema uyarısı", escape(warning), "", "high")).join("") +
      (rows.join("") || ownerEmpty("İade veya iptal kaydı bulunamadı."))
    );
  }

  async function loadOwnerFinance() {
    ownerLoading("Finans Merkezi");
    const [commandPayload, reportsPayload, settingsPayload] = await Promise.all([
      loadCommandCenterOptional("Komut merkezi"),
      ownerOptionalApi("/v1/admin/ops/reports", { reports: { order_report: {}, support_report: {} } }, "Operasyon raporları"),
      ownerOptionalApi("/v1/control-center/settings", { settings: [] }, "Sistem ayarları")
    ]);
    const summary = commandPayload.summary || {};
    const reports = reportsPayload.reports || {};
    const orderReport = reports.order_report || {};
    const supportReport = reports.support_report || {};
    const settings = settingsPayload.settings || [];
    const financeSettings = settings.filter((item) => item.category === "finance" || ["payments_paused", "default_commission_rate", "minimum_payout_amount"].includes(item.setting_key));
    const rows = financeSettings.map((setting) => ownerLine(
      setting.label || setting.setting_key,
      `${escape(setting.setting_key)} / değer ${escape(String(setting.setting_value))} / risk ${escape(setting.risk_level || "medium")}`,
      "<button type=\"button\" data-view-jump=\"system\">Ayarı düzenle</button>",
      setting.risk_level
    ));
    ownerSetOutput(
      ownerDataWarnings(commandPayload, reportsPayload, settingsPayload) +
      ownerLine("Günlük ciro", money(summary.daily_revenue), "<button type=\"button\" data-view-jump=\"operations\">Siparişleri incele</button>", "medium") +
      ownerLine("Sipariş riski", `${formatNumber(orderReport.daily_orders)} günlük sipariş / ${formatNumber(orderReport.risky_open)} açık risk`, "<button type=\"button\" data-view-jump=\"work-queue\">Risk kuyruğu</button>", orderReport.risky_open ? "critical" : "low") +
      ownerLine("Destek / iade sinyali", `${formatNumber(supportReport.open)} açık destek / ${formatNumber(supportReport.resolved_today)} bugün çözülen`, "<button type=\"button\" data-view-jump=\"refunds\">İade ve iptaller</button>", supportReport.open ? "high" : "low") +
      ownerLine("Finans ayarları", `${formatNumber(financeSettings.length)} kontrol`, "", "critical") +
      (rows.join("") || ownerEmpty("Finans ayarı bulunamadı."))
    );
  }

  async function loadOwnerContent() {
    ownerLoading("İçerik Kontrolü");
    const [contentPayload, socialPayload, modulePayload] = await Promise.all([
      ownerOptionalApi("/v1/admin/ops/content-proposals", { proposals: [] }, "İçerik önerileri"),
      ownerOptionalApi("/v1/admin/ops/social-media?limit=40", { social: { drafts: [], posts: [] } }, "Sosyal medya"),
      ownerOptionalApi("/v1/control-center/module-map", { modules: [] }, "Modül haritası")
    ]);
    const proposals = contentPayload.proposals || [];
    const social = socialPayload.social || {};
    const drafts = social.drafts || [];
    const posts = social.posts || [];
    const modules = modulePayload.modules || [];
    const proposalRows = proposals.slice(0, 10).map((item) => ownerLine(
      item.title || item.content_scope || "İçerik önerisi",
      `${escape(item.content_scope || "-")} / durum ${escape(item.status || "-")} / ${escape(item.summary || "")} / ${formatDate(item.created_at)}`,
      "<button type=\"button\" data-view-jump=\"approvals\">Onayları gör</button>",
      item.content_scope === "legal" ? "critical" : "high"
    ));
    const draftRows = drafts.slice(0, 8).map((item) => ownerLine(
      item.title || item.content_theme || "Sosyal medya taslağı",
      `${escape(item.status || "-")} / ${escape(item.platform || item.content_theme || "-")} / ${formatDate(item.created_at)}`,
      "<a href=\"./index.html\">Admin Ops</a>",
      item.status === "failed" ? "high" : "medium"
    ));
    ownerSetOutput(
      ownerDataWarnings(contentPayload, socialPayload, modulePayload) +
      ownerLine("İçerik önerileri", `${formatNumber(proposals.length)} kayıt / banner, kampanya, sayfa ve yasal içerik`, "<button type=\"button\" data-view-jump=\"approvals\">Bekleyen onaylar</button>", proposals.length ? "high" : "low") +
      (proposalRows.join("") || ownerEmpty("İçerik önerisi bulunamadı.")) +
      ownerLine("Sosyal medya", `${formatNumber(drafts.length)} taslak / ${formatNumber(posts.length)} platform gönderisi`, "<a href=\"./index.html\">Sosyal medya merkezi</a>", drafts.length ? "medium" : "low") +
      (draftRows.join("") || ownerEmpty("Sosyal medya taslağı bulunamadı.")) +
      ownerLine("Modül vitrini", `${formatNumber(modules.length)} modül içerik/görünürlük haritasına bağlı`, "<button type=\"button\" data-view-jump=\"module-map\">Modül haritası</button>", "medium")
    );
  }

  async function loadOwnerHealth() {
    ownerLoading("Sistem Sağlığı");
    const [commandPayload, healthPayload, reportsPayload, alarmPayload] = await Promise.all([
      loadCommandCenterOptional("Komut merkezi"),
      ownerOptionalApi("/v1/control-center/action-health", { actions: {} }, "Komut sağlığı"),
      ownerOptionalApi("/v1/admin/ops/reports", { reports: { order_report: {}, support_report: {} } }, "Operasyon raporları"),
      ownerOptionalApi("/v1/control-center/alarm-status", { alarm: { channels: {}, incident: {} } }, "Alarm durumu")
    ]);
    const system = commandPayload.system_health || {};
    const gitops = commandPayload.gitops || {};
    const actions = healthPayload.actions || {};
    const reports = reportsPayload.reports || {};
    const alarm = alarmPayload.alarm || {};
    const channels = alarm.channels || {};
    const incident = alarm.incident || {};
    const protection = incident.protection || {};
    const actionRows = Object.entries(actions).map(([key, value]) => ownerLine(
      key,
      `${value.ok ? "hazır" : "eksik"}${value.endpoint ? ` / ${escape(value.endpoint)}` : ""}${value.dispatch_ready === false ? " / webhook hazır değil" : ""}`,
      "",
      value.ok && value.dispatch_ready !== false ? "low" : "high"
    ));
    ownerSetOutput(
      ownerDataWarnings(commandPayload, healthPayload, reportsPayload, alarmPayload) +
      ownerLine("API / DB", `API ${escape(system.api || "-")} / DB ${escape(system.database || "-")} / build ${escape(system.build || "-")}`, "<button type=\"button\" data-action-health-check>Komut testi</button>", system.database === "online" ? "low" : "critical") +
      ownerLine("Canlı bayraklar", `Bakım ${system.maintenance_mode ? "açık" : "kapalı"} / ödeme ${system.payments_disabled ? "kapalı" : "aktif"} / acil API ${system.emergency_api_disabled ? "kapalı" : "aktif"}`, "<button type=\"button\" data-view-jump=\"system\">Sistem ayarları</button>", system.emergency_api_disabled || system.payments_disabled ? "critical" : "low") +
      ownerLine("GitOps", `Enabled ${gitops.enabled ? "evet" : "hayır"} / webhook ${gitops.release_webhook_configured ? "hazır" : "eksik"}`, "<button type=\"button\" data-view-jump=\"approvals\">Yayın onayları</button>", gitops.enabled && gitops.release_webhook_configured ? "low" : "high") +
      ownerLine("Alarm kanalları", `Ses ${channels.browser_audio ? "aktif" : "pasif"} / Telegram ${channels.telegram ? "hazır" : "eksik"} / webhook ${channels.webhook ? "hazır" : "eksik"} / email ${channels.email_webhook ? "hazır" : "eksik"} / SMS ${channels.sms ? "hazır" : "eksik"} / min ${escape(alarm.min_severity || "-")}`, "<button type=\"button\" data-alarm-server-test>Server alarm testi</button>", channels.telegram || channels.webhook || channels.email_webhook || channels.sms ? "low" : "high") +
      ownerLine("Aktif alarm", incident.active ? `${escape(incident.level || "-")} / ${incident.redZone ? "kırmızı alan" : "standart"} / ${escape(incident.action || "-")}` : "Aktif alarm yok", incident.active ? "<button type=\"button\" data-alarm-acknowledge>Alarmı sustur</button> <button type=\"button\" data-alarm-resolve>Alarmı kapat</button>" : "", incident.active ? "critical" : "low") +
      ownerLine("Runtime koruma", `API ${protection.api_locked ? "kilitli" : "açık"} / ödeme ${protection.payments_locked ? "kilitli" : "açık"} / sipariş ${protection.orders_locked ? "kilitli" : "açık"}`, [
        `<button type="button" data-alarm-protection="${protection.api_locked ? "unlock_api" : "lock_api"}">${protection.api_locked ? "API aç" : "API kilitle"}</button>`,
        `<button type="button" data-alarm-protection="${protection.payments_locked ? "unlock_payments" : "lock_payments"}">${protection.payments_locked ? "Ödeme aç" : "Ödeme kilitle"}</button>`,
        `<button type="button" data-alarm-protection="${protection.orders_locked ? "unlock_orders" : "lock_orders"}">${protection.orders_locked ? "Sipariş aç" : "Sipariş kilitle"}</button>`,
        `<button type="button" data-alarm-protection="clear">Tüm korumayı temizle</button>`
      ].join(" "), protection.api_locked || protection.payments_locked || protection.orders_locked ? "critical" : "medium") +
      ownerLine("Operasyon raporu", `${formatNumber(reports.order_report && reports.order_report.daily_orders)} sipariş bugün / ${formatNumber(reports.support_report && reports.support_report.open)} açık destek`, "<button type=\"button\" data-view-jump=\"operations\">Operasyon</button>", reports.support_report && reports.support_report.open ? "high" : "low") +
      ownerLine("Komut kabiliyeti", `${formatNumber(actionRows.length)} kontrol`, "", "medium") +
      (actionRows.join("") || ownerEmpty("Komut sağlık kaydı bulunamadı."))
    );
  }

  async function postAlarmDecision(path, body, button, message) {
    await runConfirmed(message, async (reason) => {
      await api(path, {
        method: "POST",
        body: { ...body, reason }
      });
      await loadOwnerHealth();
    }, {
      trigger: button,
      defaultReason: message,
      requireReason: true
    });
  }

  async function acknowledgeServerAlarm(button) {
    await postAlarmDecision("/v1/control-center/alarm-acknowledge", {}, button, "Aktif alarm 30 dakika susturulacak.");
  }

  async function resolveServerAlarm(button) {
    await postAlarmDecision("/v1/control-center/alarm-resolve", {}, button, "Aktif alarm manuel olarak kapatılacak.");
  }

  async function updateAlarmProtection(button) {
    const action = button.dataset.alarmProtection;
    await postAlarmDecision("/v1/control-center/alarm-protection", { action }, button, `Runtime koruma aksiyonu uygulanacak: ${action}`);
  }

  async function runServerAlarmTest(button) {
    const message = "Server-side güvenlik alarmı test edilecek. Telegram/webhook/email kanalları yapılandırıldıysa bildirim gönderilir.";
    await runConfirmed(message, async () => {
      const result = await api("/v1/control-center/alarm-test", { method: "POST", body: {} });
      const channels = result.result && result.result.channels || {};
      openDrawer("Server Alarm Testi", [
        ownerLine("Telegram", channels.telegram?.configured ? `${channels.telegram.sent ? "gönderildi" : "başarısız"} / ${escape(channels.telegram.status || channels.telegram.error || "-")}` : "yapılandırılmamış", "", channels.telegram?.sent ? "low" : "high"),
        ownerLine("Webhook", channels.webhook?.configured ? `${channels.webhook.sent ? "gönderildi" : "başarısız"} / ${escape(channels.webhook.status || channels.webhook.error || "-")}` : "yapılandırılmamış", "", channels.webhook?.sent ? "low" : "high"),
        ownerLine("Email webhook", channels.email?.configured ? `${channels.email.sent ? "gönderildi" : "başarısız"} / ${escape(channels.email.status || channels.email.error || "-")}` : "yapılandırılmamış", "", channels.email?.sent ? "low" : "medium"),
        ownerLine("SMS", channels.sms?.configured ? `${channels.sms.sent ? "gönderildi" : "başarısız"} / ${escape(channels.sms.status || channels.sms.error || "-")}` : "yapılandırılmamış", "", channels.sms?.sent ? "low" : "medium")
      ].join(""));
    }, {
      trigger: button,
      defaultReason: "Server-side alarm kanal testi",
      requireReason: true
    });
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
      `${item.subdomain_url ? `<a href="${escape(item.subdomain_url)}" target="_blank" rel="noopener">Subdomain</a> ` : ""}<a href="${escape(item.href || "#")}">Eski yol</a> <button type="button" data-module-map-detail="${escape(item.module_key)}">Operasyon</button>`,
      item.maturity === "controlled" ? "high" : (item.maturity === "transactional" || item.maturity === "operational" ? "medium" : "low")
    ));
    const future = state.futureOperations.map((item) => ownerLine(
      item.label || item.key,
      `${escape(item.status || "planned")} / risk ${escape(item.risk_level || "medium")}`,
      "<button type=\"button\" data-view-jump=\"approvals\">Yayın onayları</button>",
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
      ownerLine("Yayın", "Bu modüldeki kritik içerik veya backend değişikliği Yayın Onayları üzerinden geçirilir.", "<button type=\"button\" data-view-jump=\"approvals\">Onayları incele</button>", "critical")
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
      `<button type="button" data-partner-detail="${escape(item.id)}">Karar Ver</button>`,
      item.status === "pending" ? "high" : "medium"
    ));
    const businessRows = state.businesses.map((item) => ownerLine(
      item.display_name || item.legal_name || item.id,
      `Mağaza ${escape(item.status || "-")} / doğrulama ${escape(item.verification_status || "-")} / komisyon ${formatNumber(Number(item.default_commission_rate || 0) * 100)}%`,
      "",
      item.status === "active" ? "low" : "medium"
    ));
    ownerSetOutput(
      partnerCreateFormMarkup() +
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
      else if (view === "work-queue") await loadOwnerWorkQueue(params);
      else if (view === "alerts") await loadOwnerAlerts();
      else if (view === "approvals") await loadOwnerApprovals();
      else if (view === "release-history") await loadOwnerReleaseHistory();
      else if (view === "operations") await loadOwnerOperations();
      else if (view === "refunds") await loadOwnerRefunds(params);
      else if (view === "finance") await loadOwnerFinance();
      else if (view === "content") await loadOwnerContent();
      else if (view === "health") await loadOwnerHealth();
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

  function setReleaseStatus(message, tone) {
    const target = $("[data-release-status]");
    if (!target) return;
    target.textContent = message || "";
    target.dataset.tone = tone || "";
  }

  async function submitReleaseApproval(form) {
    if (state.releaseApprovalSubmitting) return;
    const formData = new FormData(form);
    const targetSummary = String(formData.get("target_summary") || "").trim();
    const payload = {
      approval_type: String(formData.get("approval_type") || "main_commit_push"),
      target_ref: String(formData.get("target_ref") || "main").trim(),
      target_summary: targetSummary,
      risk_level: String(formData.get("risk_level") || "critical"),
      metadata: {
        source: "super_admin_owner_console",
        reason: targetSummary
      }
    };
    if (targetSummary.length < 3) {
      const message = "Yayın onayı için en az 3 karakterlik onay özeti gerekli.";
      setReleaseStatus(message, "error");
      setAlert(message, "error");
      const summaryInput = form.querySelector("[name='target_summary']");
      if (summaryInput) summaryInput.focus();
      return;
    }
    const submitButton = form.querySelector("[type='submit']");
    state.releaseApprovalSubmitting = true;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.originalText = submitButton.dataset.originalText || submitButton.textContent || "";
      submitButton.textContent = "İstek oluşturuluyor...";
    }
    setReleaseStatus("Yayın onayı isteği backend'e gönderiliyor...", "ok");
    setAlert("Yayın onayı isteği backend'e gönderiliyor...", "ok");
    try {
      const result = await api("/v1/control-center/release-approvals", {
        method: "POST",
        body: payload
      });
      const approval = result.approval || {};
      const response = approval.webhook_response || {};
      const warnings = result.schema_warnings || [];
      const status = approval.status || "pending";
      const released = status === "dispatched";
      const waitingOwner = status === "pending";
      const manualPending = status === "approved" || response.code === "GITOPS_NOT_CONFIGURED" || response.code === "GITOPS_DISABLED";
      const okStatus = released || manualPending || waitingOwner;
      setAlert(
        released
          ? "Yayın onayı deploy hattına gönderildi."
          : (waitingOwner ? "Yayın onayı isteği oluşturuldu; detay incelemesi bekliyor." : (manualPending ? "Yayın onayı kaydedildi; webhook yoksa manuel deploy bekliyor." : `Yayın onayı kaydedildi: ${status}`)),
        okStatus ? "ok" : "error"
      );
      closeReleaseModal();
      await jumpOwnerView("approvals");
      if (waitingOwner && approval.id) showApprovalDetail(approval.id);
      if (warnings.length) {
        openDrawer("Yayın Onayı Uyarısı", warnings.map((warning) => (
          ownerLine(warning.label || "schema", escape(warning.message || "Şema uyarısı"), "", "high")
        )).join(""));
      }
      form.reset();
      const targetRef = form.querySelector("[name='target_ref']");
      if (targetRef) targetRef.value = "main";
    } catch (error) {
      const message = publicError(error, "Yayın onayı oluşturulamadı.");
      setReleaseStatus(message, "error");
      setAlert(message, "error");
      openDrawer("Yayın Onayı Hatası", [
        ownerLine("İşlem tamamlanamadı", escape(message), "<button type=\"button\" data-release-open>Tekrar dene</button>", "critical"),
        ownerLine("Kontrol", "Owner lock, MFA2, release approval migration ve backend build durumunu Komut Sağlık Testi ile kontrol et.", "<button type=\"button\" data-action-health-check>Komutları test et</button>", "high")
      ].join(""));
      openReleaseModal();
    } finally {
      state.releaseApprovalSubmitting = false;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = submitButton.dataset.originalText || "Onay İsteği Oluştur";
      }
    }
  }

  function showRefundTicketDetail(ticketId) {
    const item = (state.refundCancellations || []).find((entry) => String(entry.ticket_id || entry.id) === String(ticketId) || String(entry.id) === `ticket:${ticketId}`);
    const ticket = item && item.tickets && item.tickets[0];
    if (!ticket) return;
    openDrawer("İade / İptal Destek Sinyali", [
      ownerLine("Başlık", escape(ticket.title || "-"), "", item.risk_level || "high"),
      ownerLine("Durum", `${escape(ticket.status || "-")} / ${escape(ticket.priority || "-")} / ${escape(ticket.category || "-")}`, "", item.risk_level || "high"),
      ownerLine("Talep sahibi", `${escape(item.customer_name || "-")} / ${escape(item.customer_email || "-")} / ${escape(item.customer_phone || "-")}`, "", "medium"),
      ownerLine("Açıklama", escape(ticket.message || "-"), "", "medium"),
      ownerLine("Metadata", escape(JSON.stringify(ticket.metadata || {}).slice(0, 900)), "", "low"),
      ownerLine("Aksiyon", "Bu kayıt bir destek sinyali. Sipariş eşleştikten sonra sipariş detayı üzerinden iade/iptal aksiyonu alınmalı.", "<button type=\"button\" data-view-jump=\"operations\">Siparişlerde ara</button>", "high"),
      ownerLine("Tarih", `${formatDate(ticket.created_at)} / güncelleme ${formatDate(ticket.updated_at)}`, "", "low")
    ].join(""));
  }

  async function showRefundDetail(orderId) {
    const payload = await api(`/v1/control-center/refund-cancellations/${encodeURIComponent(orderId)}`);
    const item = payload.item || {};
    const noteRows = (item.notes || []).slice(0, 8).map((note) => ownerLine(
      note.note_type || "not",
      `${escape(note.body || "-")} / ${formatDate(note.created_at)}`,
      "",
      note.note_type === "risk" ? "high" : "low"
    )).join("");
    const flagRows = (item.flags || []).slice(0, 8).map((flag) => ownerLine(
      flag.flag_type || "flag",
      `${escape(flag.status || "-")} / ${escape(flag.reason || "-")} / ${formatDate(flag.created_at)}`,
      "",
      flag.severity || "medium"
    )).join("");
    const ticketRows = (item.tickets || []).slice(0, 6).map((ticket) => ownerLine(
      ticket.title || "Destek sinyali",
      `${escape(ticket.status || "-")} / ${escape(ticket.priority || "-")} / ${escape(ticket.message || "-").slice(0, 260)}`,
      "",
      ticket.priority === "urgent" ? "critical" : "high"
    )).join("");
    const itemRows = (item.order_items || []).slice(0, 10).map((row) => ownerLine(
      row.product?.name || row.name || row.product_id || "Ürün",
      `${formatNumber(row.quantity || 1)} adet / ${money(row.price || row.unit_price || 0)} / partner ${escape(row.partner_id || row.product?.partner_id || "-")}`,
      "",
      "low"
    )).join("");
    openDrawer("İade / İptal Detayı", [
      ownerLine("Sipariş", `${escape(item.order_no || item.id || "-")} / ${refundTypeLabel(item.type)}`, "", item.risk_level || "high"),
      ownerLine("Müşteri", `${escape(item.customer_name || "-")} / ${escape(item.customer_email || "-")} / ${escape(item.customer_phone || "-")}`, "", "medium"),
      ownerLine("Tutar", money(item.total), `sipariş ${escape(item.order_status || "-")} / ödeme ${escape(item.payment_status || "-")}`, item.type === "refund" ? "critical" : "high"),
      ownerLine("Neden / açıklama", escape(item.reason || "Kayıtlarda neden bulunamadı; karar öncesi destek ve not kayıtlarını kontrol et."), "", item.reason ? "medium" : "high"),
      ownerLine("Ödeme sağlayıcı", providerDispatchText(item.provider_dispatch), "webhook/native durum", item.provider_dispatch?.ok ? "low" : "medium"),
      ownerLine("Aksiyonlar", "Detayı inceledikten sonra işlem uygula. Tüm kararlar audit log'a yazılır.", [
        `<button type="button" data-refund-action="mark_review" data-refund-order="${escape(item.id)}">İncelemeye al</button>`,
        `<button type="button" data-refund-action="approve_cancellation" data-refund-order="${escape(item.id)}">İptali onayla</button>`,
        `<button type="button" data-refund-action="approve_refund" data-refund-order="${escape(item.id)}">İadeyi onayla</button>`,
        `<button type="button" data-refund-action="reject_request" data-refund-order="${escape(item.id)}">Talebi reddet</button>`,
        `<button type="button" data-refund-action="add_note" data-refund-order="${escape(item.id)}">Not ekle</button>`
      ].join(" "), "critical"),
      ownerLine("Ürünler", `${formatNumber((item.order_items || []).length)} kalem`, "", "medium"),
      itemRows || ownerEmpty("Ürün kalemi bulunamadı."),
      ownerLine("Operasyon notları", `${formatNumber((item.notes || []).length)} kayıt`, "", "medium"),
      noteRows || ownerEmpty("Operasyon notu yok."),
      ownerLine("Risk / işlem flagleri", `${formatNumber((item.flags || []).length)} kayıt`, "", "medium"),
      flagRows || ownerEmpty("Flag kaydı yok."),
      ownerLine("Destek sinyalleri", `${formatNumber((item.tickets || []).length)} kayıt`, "", "high"),
      ticketRows || ownerEmpty("Bu siparişle eşleşen destek sinyali yok."),
      (payload.warnings || []).map((warning) => ownerLine("Şema uyarısı", escape(warning), "", "high")).join("")
    ].join(""));
  }

  async function runRefundAction(button) {
    const orderId = button.dataset.refundOrder;
    const action = button.dataset.refundAction;
    const label = refundActionLabel(action);
    const item = (state.refundCancellations || []).find((entry) => String(entry.id) === String(orderId));
    const message = `${item?.order_no || orderId} için "${label}" işlemi uygulanacak.`;
    await runConfirmed(message, async (reason) => {
      const result = await api(`/v1/control-center/refund-cancellations/${encodeURIComponent(orderId)}/action`, {
        method: "POST",
        body: {
          action,
          reason,
          note: label
        }
      });
      const updated = result.item || {};
      openDrawer("İade / İptal Aksiyon Sonucu", [
        ownerLine("İşlem", escape(label), "audit log'a yazıldı", action === "approve_refund" ? "critical" : "high"),
        ownerLine("Sipariş", `${escape(updated.order_no || orderId)} / sipariş ${escape(updated.order_status || "-")} / ödeme ${escape(updated.payment_status || "-")}`, "", updated.type === "refund" ? "critical" : "medium"),
        ownerLine("Gerekçe", escape(reason), "", "medium"),
        ownerLine("Ödeme sağlayıcı", providerDispatchText(result.provider_dispatch), "provider API bildirimi", result.provider_dispatch?.ok ? "low" : "high"),
        ownerLine("Not", result.note?.id ? `Operasyon notu oluşturuldu: ${escape(result.note.id)}` : "Not oluşturulamadı", "", result.note?.id ? "low" : "high"),
        ownerLine("Flag", result.flag?.id ? `İşlem flag'i oluşturuldu: ${escape(result.flag.id)}` : "Flag oluşturulamadı", "", result.flag?.id ? "low" : "high")
      ].join(""));
    }, {
      trigger: button,
      defaultReason: message,
      requireReason: true
    });
  }

  function showApprovalDetail(id) {
    const item = [...(state.approvals || []), ...(state.releaseHistory || [])].find((approval) => approval.id === id);
    if (!item) return;
    const manualPending = releaseApprovalManualPending(item);
    const statusText = manualPending && item.status === "failed" ? "approved / webhook bekliyor" : item.status;
    const canApprove = item.status === "pending";
    openDrawer("Yayın Onayı", [
      ownerLine("Tip", escape(item.approval_type || "-"), "", item.risk_level),
      ownerLine("Durum", escape(statusText || "-"), manualPending ? "onay kaydedildi; manuel deploy bekliyor" : "", manualPending ? "medium" : item.risk_level),
      ownerLine("Hedef", escape(item.target_ref || "-"), "", "medium"),
      ownerLine("Özet", escape(item.target_summary || "-"), "", "medium"),
      ownerLine("Metadata", escape(JSON.stringify(item.metadata || {}).slice(0, 1200)), "", "medium"),
      ownerLine("Webhook", `${escape(String(item.webhook_status || "-"))} / ${escape(JSON.stringify(item.webhook_response || {}).slice(0, 500))}`, "", item.status === "failed" && !manualPending ? "critical" : "low"),
      ownerLine("Tarih", formatDate(item.created_at), "", "low"),
      canApprove ? ownerLine("Karar", "Bu kaydı inceledikten sonra owner onayı verebilirsin.", `<button type="button" data-approval-approve="${escape(item.id)}">Owner onayı ver</button>`, "critical") : ""
    ].join(""));
  }

  function showReleaseHistoryDetail(id) {
    const item = (state.releaseHistory || []).find((approval) => approval.id === id);
    if (!item) return;
    const response = item.webhook_response || {};
    openDrawer("Yayın Geçmişi Detayı", [
      ownerLine("Tip", escape(item.approval_type || "-"), "", item.risk_level),
      ownerLine("Durum", escape(item.status || "-"), item.dispatched_at ? `dispatch ${formatDate(item.dispatched_at)}` : "", item.status === "failed" ? "critical" : "medium"),
      ownerLine("Hedef", escape(item.target_ref || "-"), "", "medium"),
      ownerLine("Özet", escape(item.target_summary || "-"), "", "medium"),
      ownerLine("Webhook", `${escape(String(item.webhook_status || "-"))} / ${escape(JSON.stringify(response).slice(0, 700))}`, "", item.status === "failed" ? "critical" : "low"),
      ownerLine("Metadata", escape(JSON.stringify(item.metadata || {}).slice(0, 1200)), "", "medium"),
      ownerLine("Tarih", `${formatDate(item.created_at)} / onay ${formatDate(item.approved_at)}`, "", "low")
    ].join(""));
  }

  async function approveReleaseApproval(button) {
    const approvalId = button.dataset.approvalApprove;
    const item = (state.approvals || []).find((approval) => approval.id === approvalId);
    if (!item) return;
    const message = `${item.approval_type || "release"} / ${item.target_ref || "main"} için owner onayı verilecek.`;
    await runConfirmed(message, async (reason) => {
      const result = await api(`/v1/control-center/release-approvals/${encodeURIComponent(approvalId)}/approve`, {
        method: "POST",
        body: { reason }
      });
      const approval = result.approval || {};
      const response = approval.webhook_response || {};
      const status = approval.status || "approved";
      openDrawer("Yayın Onayı Sonucu", [
        ownerLine("Durum", escape(status), status === "dispatched" ? "deploy hattına gönderildi" : "onay kaydedildi", status === "failed" ? "critical" : "low"),
        ownerLine("Hedef", `${escape(approval.target_ref || "-")} / ${escape(approval.approval_type || "-")}`, "", "medium"),
        ownerLine("Özet", escape(approval.target_summary || "-"), "", "medium"),
        ownerLine("Webhook", `${escape(String(approval.webhook_status || "-"))} / ${escape(response.code || response.ok || "-")}`, "", status === "failed" ? "high" : "low"),
        ownerLine("Mesaj", escape(response.message || response.body || "Owner onayı kaydedildi."), "", status === "failed" ? "high" : "low")
      ].join(""));
      state.approvals = (state.approvals || []).filter((approvalItem) => approvalItem.id !== approvalId);
    }, {
      trigger: button,
      defaultReason: message,
      requireReason: true
    });
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
        const partnerCreateForm = eventClosest(event, "[data-partner-create-form]");
        if (partnerCreateForm) {
          event.preventDefault();
          await createPartnerFromForm(partnerCreateForm);
          return;
        }

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

        const workQueueFilter = eventClosest(event, "[data-owner-work-queue-filter]");
        if (workQueueFilter) {
          event.preventDefault();
          const form = new FormData(workQueueFilter);
          const params = {};
          ["source_module", "status", "risk_level"].forEach((key) => {
            const value = String(form.get(key) || "").trim();
            if (value) params[key] = value;
          });
          await loadOwnerWorkQueue(params);
          return;
        }

        const refundsFilter = eventClosest(event, "[data-owner-refunds-filter]");
        if (refundsFilter) {
          event.preventDefault();
          const form = new FormData(refundsFilter);
          const params = {};
          ["search", "status"].forEach((key) => {
            const value = String(form.get(key) || "").trim();
            if (value) params[key] = value;
          });
          await loadOwnerRefunds(params);
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

        const alarmServerTest = eventClosest(event, "[data-alarm-server-test]");
        if (alarmServerTest) await runServerAlarmTest(alarmServerTest);

        const alarmAcknowledge = eventClosest(event, "[data-alarm-acknowledge]");
        if (alarmAcknowledge) await acknowledgeServerAlarm(alarmAcknowledge);

        const alarmResolve = eventClosest(event, "[data-alarm-resolve]");
        if (alarmResolve) await resolveServerAlarm(alarmResolve);

        const alarmProtection = eventClosest(event, "[data-alarm-protection]");
        if (alarmProtection) await updateAlarmProtection(alarmProtection);

        const approvalDetail = eventClosest(event, "[data-approval-detail]");
        if (approvalDetail) showApprovalDetail(approvalDetail.dataset.approvalDetail);

        const releaseHistoryDetail = eventClosest(event, "[data-release-history-detail]");
        if (releaseHistoryDetail) showReleaseHistoryDetail(releaseHistoryDetail.dataset.releaseHistoryDetail);

        const approvalApprove = eventClosest(event, "[data-approval-approve]");
        if (approvalApprove) await approveReleaseApproval(approvalApprove);

        const refundDetail = eventClosest(event, "[data-refund-detail]");
        if (refundDetail) await showRefundDetail(refundDetail.dataset.refundDetail);

        const refundTicketDetail = eventClosest(event, "[data-refund-ticket-detail]");
        if (refundTicketDetail) showRefundTicketDetail(refundTicketDetail.dataset.refundTicketDetail);

        const refundAction = eventClosest(event, "[data-refund-action]");
        if (refundAction) await runRefundAction(refundAction);

        const eventDetail = eventClosest(event, "[data-event-detail]");
        if (eventDetail) showEventDetail(eventDetail.dataset.eventDetail);

        const moduleMapDetail = eventClosest(event, "[data-module-map-detail]");
        if (moduleMapDetail) showModuleMapDetail(moduleMapDetail.dataset.moduleMapDetail);

        const workQueueSource = eventClosest(event, "[data-work-queue-source]");
        if (workQueueSource) await jumpOwnerView(sourceViewForWorkQueue(workQueueSource.dataset.workQueueSource));

        const workQueueStatus = eventClosest(event, "[data-work-queue-status]");
        if (workQueueStatus) await updateWorkQueueStatus(workQueueStatus);

        const workQueueDecision = eventClosest(event, "[data-work-queue-decision]");
        if (workQueueDecision) await decideWorkQueueItem(workQueueDecision);

        const permissionSave = eventClosest(event, "[data-permission-save]");
        if (permissionSave) await updatePermission(permissionSave);

        const userAction = eventClosest(event, "[data-user-action]");
        if (userAction) await updateUserAction(userAction);

        const partnerDecision = eventClosest(event, "[data-partner-decision]");
        if (partnerDecision) await decidePartner(partnerDecision);

        const partnerDetail = eventClosest(event, "[data-partner-detail]");
        if (partnerDetail) showPartnerApplicationDetail(partnerDetail.dataset.partnerDetail);

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
    state.access = await requireOwnerEntry();
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

      const partnerDetail = eventClosest(event, "[data-partner-detail]");
      if (partnerDetail) showPartnerApplicationDetail(partnerDetail.dataset.partnerDetail);

      const settingSave = eventClosest(event, "[data-setting-save]");
      if (settingSave) await saveSetting(settingSave);

      const moduleSave = eventClosest(event, "[data-module-save]");
      if (moduleSave) await saveModule(moduleSave);
    });

    document.addEventListener("submit", async (event) => {
      const partnerCreateForm = eventClosest(event, "[data-partner-create-form]");
      if (partnerCreateForm) {
        event.preventDefault();
        await createPartnerFromForm(partnerCreateForm);
      }
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
      state.access = await requireOwnerEntry();
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
