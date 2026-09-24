(function () {
  const App = window.Allona = window.Allona || {};
  const DEVICE_STORAGE_KEY = "allona_cv_device_id_v1";
  const DEVICE_COOKIE_KEY = "allona_cv_device_id_v1";

  function randomId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    if (window.crypto && window.crypto.getRandomValues) {
      const bytes = new Uint8Array(24);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    const error = new Error("DEVICE_CRYPTO_UNAVAILABLE");
    error.code = "DEVICE_CRYPTO_UNAVAILABLE";
    throw error;
  }

  function readDeviceCookie() {
    const prefix = `${DEVICE_COOKIE_KEY}=`;
    const row = String(document.cookie || "").split(";").map((item) => item.trim()).find((item) => item.startsWith(prefix));
    return row ? decodeURIComponent(row.slice(prefix.length)) : "";
  }

  function writeDeviceCookie(value) {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${DEVICE_COOKIE_KEY}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  }

  function getRawDeviceId() {
    let stored = "";
    try { stored = localStorage.getItem(DEVICE_STORAGE_KEY) || ""; } catch (error) {}
    const cookie = readDeviceCookie();
    let id = cookie || stored;
    if (!id) {
      id = randomId();
    }
    try { localStorage.setItem(DEVICE_STORAGE_KEY, id); } catch (error) {}
    writeDeviceCookie(id);
    if (!readDeviceCookie() && !stored) {
      try { stored = localStorage.getItem(DEVICE_STORAGE_KEY) || ""; } catch (error) {}
      if (!stored) {
        const error = new Error("DEVICE_STORAGE_UNAVAILABLE");
        error.code = "DEVICE_STORAGE_UNAVAILABLE";
        throw error;
      }
    }
    return id;
  }

  async function sha256(value) {
    if (!window.crypto || !window.crypto.subtle || !window.TextEncoder) {
      const error = new Error("DEVICE_CRYPTO_UNAVAILABLE");
      error.code = "DEVICE_CRYPTO_UNAVAILABLE";
      throw error;
    }
    const buffer = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function getDeviceKey() {
    return sha256(getRawDeviceId());
  }

  function normalizeResult(data) {
    if (!data) return null;
    if (typeof data === "string") {
      try { return JSON.parse(data); } catch (error) { return null; }
    }
    return data;
  }

  async function currentUser() {
    if (!App.auth || !App.auth.getUser) return null;
    try {
      return await App.auth.getUser();
    } catch (error) {
      return null;
    }
  }

  async function requireUserForCV() {
    if (App.auth && App.auth.requireAuth) return App.auth.requireAuth();
    return currentUser();
  }

  async function ensureAccess(context) {
    const user = await currentUser();
    if (!user) return null;
    const deviceKey = await getDeviceKey();
    if (!App.db || !App.db.client) return { service_unavailable: true };

    try {
      const { data, error } = await App.db.client().rpc("ensure_cv_access", {
        p_device_key: deviceKey,
        p_user_agent: navigator.userAgent || ""
      });
      if (error) throw error;
      return normalizeResult(data);
    } catch (error) {
      console.warn("CV erişim durumu sunucudan alınamadı:", error);
      return { service_unavailable: true };
    }
  }

  async function claimGeneration(options) {
    const user = await requireUserForCV();
    if (!user) return { allowed: false, login_required: true };
    const deviceKey = await getDeviceKey();
    const title = options && options.title || "AllonaHub CV";

    if (App.db && App.db.client) {
      try {
        const { data, error } = await App.db.client().rpc("claim_cv_generation", {
          p_device_key: deviceKey,
          p_cv_title: title,
          p_user_agent: navigator.userAgent || ""
        });
        if (error) throw error;
        const result = normalizeResult(data);
        if (result && result.payment_required) {
          window.location.href = App.core.url(result.payment_url || "/pages/career/cv-payment.html?reason=limit");
          return result;
        }
        return result || { allowed: false, service_unavailable: true };
      } catch (error) {
        console.warn("CV hakkı sunucudan doğrulanamadı:", error);
      }
    }
    return { allowed: false, service_unavailable: true };
  }

  async function reportSignupAttempt(email, context) {
    if (!App.db || !App.db.client) return null;
    try {
      const { data, error } = await App.db.client().rpc("report_cv_device_signal", {
        p_device_key: await getDeviceKey(),
        p_email: email || "",
        p_context: context || "register_attempt",
        p_user_agent: navigator.userAgent || ""
      });
      if (error) throw error;
      return normalizeResult(data);
    } catch (error) {
      if (!isMissingBackend(error)) console.warn("CV cihaz bildirimi gönderilemedi:", error);
      return null;
    }
  }

  async function createCVCheckout(payload) {
    const user = await requireUserForCV();
    if (!user) return null;
    const functionName = App.config.cvCheckoutFunctionName || "create-cv-checkout";
    const { data, error } = await App.db.client().functions.invoke(functionName, {
      body: {
        deviceKey: await getDeviceKey(),
        buyerEmail: payload && payload.buyerEmail || "",
        buyerPhone: payload && payload.buyerPhone || ""
      }
    });
    if (error) throw error;
    return data;
  }

  function messageForAccess(access) {
    if (!access) return "CV/PDF üretmek için giriş yapın. Her hesabın 2 ücretsiz CV üretim hakkı bulunur.";
    if (access.service_unavailable) return "CV hakkı sunucudan doğrulanamadı. Bağlantınızı kontrol edip tekrar deneyin; hakkınız değişmedi.";
    if (access.is_risky) {
      return "Bu cihazda daha önce CV hakkı kullanılan farklı bir hesap var. Bu hesap riskli profil olarak işaretlendi ve ücretsiz CV hakkı tanımlanmadı.";
    }
    if (Number(access.remaining_free || 0) > 0) {
      return `Ücretsiz CV hakkınız: ${access.remaining_free}/${access.free_limit || 2}. Hak bitince CV üretimi ödeme sayfasına yönlendirilir.`;
    }
    if (Number(access.paid_credits || 0) > 0) {
      return `Ücretli CV krediniz: ${access.paid_credits}. PDF üretiminde bir kredi kullanılacak.`;
    }
    return "Ücretsiz CV haklarınız bitti. Bir sonraki CV üretimi ödeme sayfasına yönlendirilecek.";
  }

  async function renderStatus(target) {
    const node = typeof target === "string" ? document.querySelector(target) : target;
    if (!node) return;
    const user = await currentUser();
    if (!user) {
      node.textContent = messageForAccess(null);
      node.dataset.state = "login";
      return;
    }
    const access = await ensureAccess("status");
    node.textContent = messageForAccess(access);
    node.dataset.state = access?.service_unavailable ? "unavailable" : access?.is_risky ? "risk" : Number(access?.remaining_free || 0) > 0 ? "free" : "paid";
  }

  document.addEventListener("DOMContentLoaded", () => {
    const status = document.querySelector("[data-cv-access-status]");
    if (status) renderStatus(status);
  });

  App.cvAccess = {
    getDeviceKey,
    ensureAccess,
    claimGeneration,
    reportSignupAttempt,
    createCVCheckout,
    renderStatus
  };
})();
