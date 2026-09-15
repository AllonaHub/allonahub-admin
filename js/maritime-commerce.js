(function () {
  "use strict";

  const App = window.Allona = window.Allona || {};
  const pendingKeys = new Map();

  function apiBase() {
    if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) return "http://localhost:3000";
    return String(App.config && App.config.apiBaseUrl || "https://api.allonahub.com").replace(/\/$/, "");
  }

  async function session() {
    const current = App.auth && App.auth.getSession ? await App.auth.getSession() : null;
    if (!current?.access_token) {
      const error = new Error("AUTH_REQUIRED");
      error.code = "AUTH_REQUIRED";
      throw error;
    }
    return current;
  }

  async function deviceKey() {
    if (!App.cvAccess || typeof App.cvAccess.getDeviceKey !== "function") {
      const error = new Error("MARITIME_DEVICE_KEY_REQUIRED");
      error.code = "MARITIME_DEVICE_KEY_REQUIRED";
      throw error;
    }
    return App.cvAccess.getDeviceKey();
  }

  async function api(path, options) {
    const current = await session();
    const response = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${current.access_token}`,
        "X-Allona-Device-Key": await deviceKey(),
        ...(options && options.body ? { "Content-Type": "application/json" } : {}),
        ...(options && options.headers || {})
      }
    });
    const payload = await response.json().catch(function () { return {}; });
    if (!response.ok || payload.ok !== true) {
      const error = new Error(payload.message || "REQUEST_FAILED");
      error.status = response.status;
      error.code = payload.error || payload.code || "REQUEST_FAILED";
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function idempotencyKey(product) {
    if (pendingKeys.has(product)) return pendingKeys.get(product);
    let key = "";
    if (window.crypto && typeof window.crypto.randomUUID === "function") key = window.crypto.randomUUID();
    else {
      const bytes = window.crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes).map(function (value) { return value.toString(16).padStart(2, "0"); }).join("");
      key = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    pendingKeys.set(product, key);
    return key;
  }

  function trustedPaymentUrl(value) {
    try {
      const url = new URL(value);
      const configuredHosts = App.config?.bankPaymentAllowedHosts || [];
      const apiHost = App.config?.apiBaseUrl ? new URL(App.config.apiBaseUrl).hostname : "";
      const allowedHosts = new Set([...configuredHosts, apiHost].filter(Boolean));
      return url.protocol === "https:" && allowedHosts.has(url.hostname);
    } catch (error) {
      return false;
    }
  }

  async function authorizeDownload(product) {
    try {
      const result = await api("/v1/maritime/pdf-download/authorize", {
        method: "POST",
        body: JSON.stringify({ product, idempotency_key: idempotencyKey(product) })
      });
      pendingKeys.delete(product);
      return result;
    } catch (error) {
      if (error.status !== 0 && error.code !== "REQUEST_FAILED") pendingKeys.delete(product);
      throw error;
    }
  }

  async function startCheckout(product) {
    const result = await api("/v1/maritime/pdf-checkout", {
      method: "POST",
      body: JSON.stringify({ product })
    });
    if (!trustedPaymentUrl(result.paymentPageUrl)) {
      const error = new Error("UNTRUSTED_PAYMENT_URL");
      error.code = "UNTRUSTED_PAYMENT_URL";
      throw error;
    }
    window.location.assign(result.paymentPageUrl);
    return result;
  }

  async function authorizeOrCheckout(product) {
    try {
      return await authorizeDownload(product);
    } catch (error) {
      if (error.status !== 402 && error.code !== "MARITIME_PDF_PAYMENT_REQUIRED") throw error;
      await startCheckout(product);
      return null;
    }
  }

  async function lookupVessel(imo) {
    return api(`/v1/maritime/vessels/${encodeURIComponent(String(imo || ""))}`, { method: "GET" });
  }

  window.AllonaMaritimeCommerce = Object.freeze({ authorizeDownload, startCheckout, authorizeOrCheckout, lookupVessel });
})();
