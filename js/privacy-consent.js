(function () {
  const App = window.Allona = window.Allona || {};
  const CONSENT_KEY = "allona.cookieConsent.v1";
  const LOCATION_PERMISSION_KEY = "allona.location.permission.v1";
  const LOCATION_CACHE_KEY = "allona.location.lastKnown.v1";
  const CONSENT_VERSION = "20260628-privacy1";
  const SERVICE_WORKER_VERSION = "20260629-googleoauth1";

  const categories = {
    necessary: true,
    preferences: false,
    analytics: false,
    marketing: false
  };

  function refreshServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (!(location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) return;
    const refresh = () => {
      navigator.serviceWorker.register(`/sw.js?v=${SERVICE_WORKER_VERSION}`, { scope: "/" })
        .then((registration) => registration.update())
        .catch(() => undefined);
    };
    if (document.readyState === "complete") refresh();
    else window.addEventListener("load", refresh, { once: true });
  }

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function readJson(key, fallback) {
    try {
      const raw = storageGet(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    return storageSet(key, JSON.stringify(value));
  }

  function legalUrl(path) {
    if (App.core && typeof App.core.url === "function") return App.core.url(path);
    return path;
  }

  function normalizedConsent(settings) {
    const input = settings || {};
    return {
      version: CONSENT_VERSION,
      necessary: true,
      preferences: Boolean(input.preferences),
      analytics: Boolean(input.analytics),
      marketing: Boolean(input.marketing),
      source: input.source || "banner",
      updated_at: new Date().toISOString()
    };
  }

  function getCookieConsent() {
    const consent = readJson(CONSENT_KEY, null);
    if (!consent || consent.version !== CONSENT_VERSION) return null;
    return normalizedConsent(consent);
  }

  function allows(category) {
    if (category === "necessary") return true;
    const consent = getCookieConsent();
    return Boolean(consent && consent[category]);
  }

  function setCookieConsent(settings) {
    const consent = normalizedConsent(settings);
    writeJson(CONSENT_KEY, consent);
    document.documentElement.dataset.cookieConsent = "set";
    document.dispatchEvent(new CustomEvent("allona:cookie-consent-updated", { detail: consent }));
    return consent;
  }

  function injectStyles() {
    if (document.getElementById("allona-cookie-consent-style")) return;
    const style = document.createElement("style");
    style.id = "allona-cookie-consent-style";
    style.textContent = `
      .ah-cookie-banner,
      .ah-cookie-preferences,
      .ah-cookie-modal {
        font-family: Inter, Arial, Helvetica, sans-serif;
        color: var(--ah-ink, #102033);
      }

      .ah-cookie-banner {
        position: fixed;
        z-index: 2147483000;
        left: max(16px, env(safe-area-inset-left));
        right: max(16px, env(safe-area-inset-right));
        bottom: max(16px, env(safe-area-inset-bottom));
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 16px;
        align-items: center;
        max-width: 1080px;
        margin: 0 auto;
        padding: 16px;
        border: 1px solid var(--ah-line, rgba(20, 43, 70, .16));
        border-radius: 8px;
        background: var(--ah-card, #ffffff);
        box-shadow: 0 18px 48px rgba(15, 23, 42, .18);
      }

      .ah-cookie-banner strong,
      .ah-cookie-modal strong {
        display: block;
        margin: 0 0 6px;
        color: var(--ah-ink, #102033);
        font-size: 1rem;
        line-height: 1.25;
      }

      .ah-cookie-banner p,
      .ah-cookie-modal p {
        margin: 0;
        color: var(--ah-muted, #566579);
        font-size: .92rem;
        line-height: 1.55;
      }

      .ah-cookie-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
      }

      .ah-cookie-btn,
      .ah-cookie-preferences {
        appearance: none;
        border: 1px solid var(--ah-line, rgba(20, 43, 70, .16));
        border-radius: 8px;
        background: var(--ah-card, #ffffff);
        color: var(--ah-ink, #102033);
        cursor: pointer;
        font: inherit;
        font-weight: 800;
        line-height: 1;
      }

      .ah-cookie-btn {
        min-height: 40px;
        padding: 0 14px;
      }

      .ah-cookie-btn:hover,
      .ah-cookie-preferences:hover {
        border-color: var(--ah-primary, #00a6d6);
      }

      .ah-cookie-btn--primary {
        border-color: var(--ah-primary-strong, #0077a8);
        background: var(--ah-primary-strong, #0077a8);
        color: #ffffff;
      }

      .ah-cookie-btn--ghost {
        background: color-mix(in srgb, var(--ah-primary, #00a6d6) 9%, transparent);
      }

      .ah-cookie-preferences {
        position: fixed;
        z-index: 2147482500;
        left: max(14px, env(safe-area-inset-left));
        bottom: max(14px, env(safe-area-inset-bottom));
        min-height: 34px;
        padding: 0 10px;
        font-size: .78rem;
        box-shadow: 0 10px 28px rgba(15, 23, 42, .12);
      }

      .ah-cookie-modal {
        position: fixed;
        z-index: 2147483100;
        inset: 0;
        display: grid;
        place-items: center;
        padding: 18px;
        background: rgba(3, 10, 24, .58);
      }

      .ah-cookie-dialog {
        width: min(100%, 620px);
        max-height: min(760px, calc(100vh - 36px));
        overflow: auto;
        border: 1px solid var(--ah-line, rgba(20, 43, 70, .16));
        border-radius: 8px;
        background: var(--ah-card, #ffffff);
        box-shadow: 0 24px 70px rgba(3, 10, 24, .28);
        padding: 18px;
      }

      .ah-cookie-choice-list {
        display: grid;
        gap: 10px;
        margin: 16px 0;
      }

      .ah-cookie-choice {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px;
        align-items: center;
        padding: 12px;
        border: 1px solid var(--ah-line, rgba(20, 43, 70, .16));
        border-radius: 8px;
        background: color-mix(in srgb, var(--ah-card, #ffffff) 92%, var(--ah-primary, #00a6d6));
      }

      .ah-cookie-choice b {
        display: block;
        margin-bottom: 4px;
        color: var(--ah-ink, #102033);
      }

      .ah-cookie-choice span {
        color: var(--ah-muted, #566579);
        font-size: .86rem;
        line-height: 1.45;
      }

      .ah-cookie-switch {
        width: 46px;
        height: 26px;
        accent-color: var(--ah-primary-strong, #0077a8);
      }

      .ah-cookie-links {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 10px;
      }

      .ah-cookie-links a {
        color: var(--ah-primary-strong, #0077a8);
        font-weight: 800;
        text-decoration: none;
      }

      @media (max-width: 720px) {
        .ah-cookie-banner {
          grid-template-columns: 1fr;
          align-items: stretch;
        }

        .ah-cookie-actions {
          justify-content: stretch;
        }

        .ah-cookie-btn {
          flex: 1 1 140px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function removeConsentUi() {
    document.querySelectorAll("[data-cookie-consent-ui]").forEach((node) => node.remove());
  }

  function mountPreferenceButton() {
    if (document.querySelector("[data-cookie-preferences-open]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ah-cookie-preferences";
    button.textContent = "Çerezler";
    button.setAttribute("aria-label", "Çerez tercihlerini yönet");
    button.setAttribute("data-cookie-preferences-open", "true");
    button.setAttribute("data-cookie-consent-ui", "true");
    button.addEventListener("click", () => openPreferences());
    document.body.appendChild(button);
  }

  function closeModal() {
    document.querySelectorAll(".ah-cookie-modal[data-cookie-consent-ui]").forEach((node) => node.remove());
  }

  function saveAndClose(settings) {
    setCookieConsent(settings);
    removeConsentUi();
    mountPreferenceButton();
  }

  function openPreferences() {
    closeModal();
    injectStyles();
    const current = getCookieConsent() || normalizedConsent(categories);
    const overlay = document.createElement("div");
    overlay.className = "ah-cookie-modal";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "ah-cookie-title");
    overlay.setAttribute("data-cookie-consent-ui", "true");
    overlay.innerHTML = `
      <div class="ah-cookie-dialog">
        <strong id="ah-cookie-title">Çerez tercihleri</strong>
        <p>Zorunlu çerezler site güvenliği, oturum, sepet ve temel hizmetler için kullanılır. Analitik, tercih ve pazarlama çerezleri için tercihinizi aşağıdan yönetebilirsiniz.</p>
        <div class="ah-cookie-choice-list">
          <label class="ah-cookie-choice">
            <span><b>Zorunlu çerezler</b><span>Site güvenliği ve temel işlevler için gereklidir; kapatılamaz.</span></span>
            <input class="ah-cookie-switch" type="checkbox" checked disabled>
          </label>
          <label class="ah-cookie-choice">
            <span><b>Tercih çerezleri</b><span>Dil, tema ve arayüz tercihlerini hatırlamak için kullanılır.</span></span>
            <input class="ah-cookie-switch" type="checkbox" data-cookie-choice="preferences" ${current.preferences ? "checked" : ""}>
          </label>
          <label class="ah-cookie-choice">
            <span><b>Analitik çerezleri</b><span>Platform performansı ve deneyim iyileştirmeleri için ölçüm sağlar.</span></span>
            <input class="ah-cookie-switch" type="checkbox" data-cookie-choice="analytics" ${current.analytics ? "checked" : ""}>
          </label>
          <label class="ah-cookie-choice">
            <span><b>Pazarlama çerezleri</b><span>Kampanya ve ilgi alanına uygun içerik gösterimi için kullanılabilir.</span></span>
            <input class="ah-cookie-switch" type="checkbox" data-cookie-choice="marketing" ${current.marketing ? "checked" : ""}>
          </label>
        </div>
        <div class="ah-cookie-actions">
          <button class="ah-cookie-btn" type="button" data-cookie-reject>Reddet</button>
          <button class="ah-cookie-btn ah-cookie-btn--ghost" type="button" data-cookie-save>Tercihleri kaydet</button>
          <button class="ah-cookie-btn ah-cookie-btn--primary" type="button" data-cookie-allow>Tümüne izin ver</button>
        </div>
        <div class="ah-cookie-links">
          <a href="${legalUrl("/pages/legal/cerez-politikasi.html")}">Çerez Politikası</a>
          <a href="${legalUrl("/pages/legal/gizlilik.html")}">Gizlilik Politikası</a>
          <a href="${legalUrl("/pages/legal/kvkk.html")}">KVKK Aydınlatma Metni</a>
        </div>
      </div>
    `;
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeModal();
      if (event.target.closest("[data-cookie-reject]")) saveAndClose({ source: "preferences_reject" });
      if (event.target.closest("[data-cookie-allow]")) {
        saveAndClose({ preferences: true, analytics: true, marketing: true, source: "preferences_allow_all" });
      }
      if (event.target.closest("[data-cookie-save]")) {
        const settings = { source: "preferences_save" };
        overlay.querySelectorAll("[data-cookie-choice]").forEach((input) => {
          settings[input.dataset.cookieChoice] = input.checked;
        });
        saveAndClose(settings);
      }
    });
    document.body.appendChild(overlay);
  }

  function mountBanner() {
    injectStyles();
    if (getCookieConsent()) {
      document.documentElement.dataset.cookieConsent = "set";
      mountPreferenceButton();
      return;
    }
    if (document.querySelector(".ah-cookie-banner")) return;
    const banner = document.createElement("section");
    banner.className = "ah-cookie-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-live", "polite");
    banner.setAttribute("aria-label", "Çerez izni");
    banner.setAttribute("data-cookie-consent-ui", "true");
    banner.innerHTML = `
      <div>
        <strong>Çerez tercihlerinizi yönetebilirsiniz</strong>
        <p>AllonaHub zorunlu çerezleri site güvenliği ve temel hizmetler için kullanır. Analitik, tercih ve pazarlama çerezleri yalnızca izin verdiğiniz kapsamda etkinleştirilir.</p>
        <div class="ah-cookie-links">
          <a href="${legalUrl("/pages/legal/cerez-politikasi.html")}">Çerez Politikası</a>
          <a href="${legalUrl("/pages/legal/gizlilik.html")}">Gizlilik Politikası</a>
        </div>
      </div>
      <div class="ah-cookie-actions">
        <button class="ah-cookie-btn" type="button" data-cookie-reject>Reddet</button>
        <button class="ah-cookie-btn ah-cookie-btn--ghost" type="button" data-cookie-preferences>Tercihler</button>
        <button class="ah-cookie-btn ah-cookie-btn--primary" type="button" data-cookie-allow>Tümüne izin ver</button>
      </div>
    `;
    banner.addEventListener("click", (event) => {
      if (event.target.closest("[data-cookie-reject]")) saveAndClose({ source: "banner_reject" });
      if (event.target.closest("[data-cookie-allow]")) {
        saveAndClose({ preferences: true, analytics: true, marketing: true, source: "banner_allow_all" });
      }
      if (event.target.closest("[data-cookie-preferences]")) openPreferences();
    });
    document.body.appendChild(banner);
  }

  function normalizePosition(position) {
    if (!position || !position.coords) return null;
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy_m: position.coords.accuracy || null,
      captured_at: new Date().toISOString()
    };
  }

  function cachedLocation(maximumAge) {
    const cached = readJson(LOCATION_CACHE_KEY, null);
    if (!cached || !cached.captured_at) return null;
    const age = Date.now() - Date.parse(cached.captured_at);
    if (Number.isFinite(age) && age <= Number(maximumAge || 10 * 60 * 1000)) return cached;
    return null;
  }

  async function geolocationPermissionState() {
    if (!navigator.permissions || !navigator.permissions.query) return "unknown";
    try {
      const permission = await navigator.permissions.query({ name: "geolocation" });
      return permission && permission.state ? permission.state : "unknown";
    } catch (error) {
      return "unknown";
    }
  }

  function priorLocationAllowed() {
    const stored = readJson(LOCATION_PERMISSION_KEY, null);
    return Boolean(stored && stored.allowed === true);
  }

  function rememberLocationPermission(allowed, state) {
    writeJson(LOCATION_PERMISSION_KEY, {
      allowed: Boolean(allowed),
      state: state || (allowed ? "granted" : "prompt"),
      updated_at: new Date().toISOString()
    });
  }

  async function canUseLocation(options) {
    if (!navigator.geolocation) return { ok: false, state: "unsupported" };
    const settings = options || {};
    const state = await geolocationPermissionState();
    if (state === "denied") {
      rememberLocationPermission(false, "denied");
      return { ok: false, state };
    }
    if (state === "granted" || priorLocationAllowed() || settings.prompt === true) {
      return { ok: true, state };
    }
    return { ok: false, state: state || "prompt" };
  }

  async function getLocation(options) {
    const settings = options || {};
    const maximumAge = Number(settings.maximumAge || 10 * 60 * 1000);
    const currentState = await geolocationPermissionState();
    if (currentState === "denied") {
      rememberLocationPermission(false, "denied");
      return null;
    }
    const cached = settings.useCache === false ? null : cachedLocation(maximumAge);
    if (cached && !settings.force) return cached;

    const decision = await canUseLocation(settings);
    if (!decision.ok) return null;

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition((position) => {
        const location = normalizePosition(position);
        if (location) {
          rememberLocationPermission(true, "granted");
          writeJson(LOCATION_CACHE_KEY, location);
        }
        resolve(location);
      }, (error) => {
        if (error && error.code === error.PERMISSION_DENIED) rememberLocationPermission(false, "denied");
        resolve(null);
      }, {
        enableHighAccuracy: Boolean(settings.highAccuracy),
        maximumAge,
        timeout: Number(settings.timeout || 8000)
      });
    });
  }

  async function watchLocation(onSuccess, onError, options) {
    const settings = options || {};
    const decision = await canUseLocation(settings);
    if (!decision.ok) {
      if (typeof onError === "function") onError(decision);
      return null;
    }
    return navigator.geolocation.watchPosition((position) => {
      const location = normalizePosition(position);
      if (location) {
        rememberLocationPermission(true, "granted");
        writeJson(LOCATION_CACHE_KEY, location);
      }
      if (typeof onSuccess === "function") onSuccess(position, location);
    }, (error) => {
      if (error && error.code === error.PERMISSION_DENIED) rememberLocationPermission(false, "denied");
      if (typeof onError === "function") onError(error);
    }, {
      enableHighAccuracy: Boolean(settings.highAccuracy),
      maximumAge: Number(settings.maximumAge || 10000),
      timeout: Number(settings.timeout || 12000)
    });
  }

  function init() {
    refreshServiceWorker();
    mountBanner();
  }

  App.privacy = {
    categories,
    getCookieConsent,
    setCookieConsent,
    allows,
    openCookiePreferences: openPreferences,
    getLocation,
    watchLocation,
    geolocationPermissionState,
    cachedLocation
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
