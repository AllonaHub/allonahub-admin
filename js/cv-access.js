(function () {
  const App = window.Allona = window.Allona || {};
  const DEVICE_STORAGE_KEY = "allona_cv_device_id_v1";
  const DEVICE_USERS_KEY = "allona_cv_device_users_v1";
  const LOCAL_USAGE_PREFIX = "allona_cv_local_usage_v1:";

  function randomId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return `cv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getRawDeviceId() {
    let id = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(DEVICE_STORAGE_KEY, id);
    }
    return id;
  }

  async function sha256(value) {
    if (!window.crypto || !window.crypto.subtle || !window.TextEncoder) {
      return `raw:${value}`;
    }
    const buffer = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function getDeviceKey() {
    return sha256(getRawDeviceId());
  }

  function readDeviceUsers() {
    try {
      return JSON.parse(localStorage.getItem(DEVICE_USERS_KEY) || "{}");
    } catch (error) {
      return {};
    }
  }

  function writeDeviceUsers(value) {
    localStorage.setItem(DEVICE_USERS_KEY, JSON.stringify(value || {}));
  }

  function readLocalUsage(userId) {
    try {
      return JSON.parse(localStorage.getItem(`${LOCAL_USAGE_PREFIX}${userId}`) || "{}");
    } catch (error) {
      return {};
    }
  }

  function writeLocalUsage(userId, value) {
    localStorage.setItem(`${LOCAL_USAGE_PREFIX}${userId}`, JSON.stringify(value || {}));
  }

  function normalizeResult(data) {
    if (!data) return null;
    if (typeof data === "string") {
      try { return JSON.parse(data); } catch (error) { return null; }
    }
    return data;
  }

  function isMissingBackend(error) {
    const message = `${error && error.message || ""} ${error && error.details || ""} ${error && error.hint || ""}`;
    return /function|schema cache|could not find|does not exist|not found/i.test(message);
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

  async function localEnsureAccess(user) {
    const deviceKey = await getDeviceKey();
    const users = readDeviceUsers();
    const list = Array.isArray(users[deviceKey]) ? users[deviceKey] : [];
    if (!list.includes(user.id)) list.push(user.id);
    users[deviceKey] = list;
    writeDeviceUsers(users);

    const isRisky = list[0] && list[0] !== user.id;
    const usage = readLocalUsage(user.id);
    const freeLimit = isRisky ? 0 : 2;
    const freeUsed = Number(usage.free_used || 0);
    const paidCredits = Number(usage.paid_credits || 0);
    return {
      user_id: user.id,
      free_limit: freeLimit,
      free_used: freeUsed,
      remaining_free: Math.max(freeLimit - freeUsed, 0),
      paid_credits: paidCredits,
      is_risky: isRisky,
      risk_reason: isRisky ? "same_device_multiple_accounts" : null,
      source: "local_fallback"
    };
  }

  async function localClaimGeneration(user) {
    const access = await localEnsureAccess(user);
    const usage = readLocalUsage(user.id);
    if (access.remaining_free > 0) {
      usage.free_used = Number(usage.free_used || 0) + 1;
      writeLocalUsage(user.id, usage);
      return {
        allowed: true,
        payment_required: false,
        generation_type: "free",
        remaining_free: Math.max(access.free_limit - usage.free_used, 0),
        paid_credits: access.paid_credits,
        is_risky: access.is_risky,
        source: "local_fallback"
      };
    }
    return {
      allowed: false,
      payment_required: true,
      payment_url: "cv-payment.html?reason=limit",
      remaining_free: 0,
      paid_credits: access.paid_credits,
      is_risky: access.is_risky,
      source: "local_fallback"
    };
  }

  async function ensureAccess(context) {
    const user = await currentUser();
    if (!user) return null;
    const deviceKey = await getDeviceKey();
    if (!App.db || !App.db.client) return localEnsureAccess(user);

    try {
      const { data, error } = await App.db.client().rpc("ensure_cv_access", {
        p_device_key: deviceKey,
        p_user_agent: navigator.userAgent || ""
      });
      if (error) throw error;
      return normalizeResult(data);
    } catch (error) {
      if (!isMissingBackend(error)) console.warn("CV erişim durumu alınamadı:", error);
      return localEnsureAccess(user);
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
          window.location.href = App.core.url(result.payment_url || "cv-payment.html?reason=limit");
          return result;
        }
        return result || { allowed: false };
      } catch (error) {
        if (!isMissingBackend(error)) console.warn("CV hakkı doğrulanamadı:", error);
      }
    }

    const fallback = await localClaimGeneration(user);
    if (fallback.payment_required) {
      window.location.href = App.core.url(fallback.payment_url || "cv-payment.html?reason=limit");
    }
    return fallback;
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
        identityNumber: payload && payload.identityNumber || "",
        buyerPhone: payload && payload.buyerPhone || ""
      }
    });
    if (error) throw error;
    return data;
  }

  function messageForAccess(access) {
    if (!access) return "CV/PDF üretmek için giriş yapın. Her hesabın 2 ücretsiz CV üretim hakkı bulunur.";
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
    node.dataset.state = access && access.is_risky ? "risk" : Number(access && access.remaining_free || 0) > 0 ? "free" : "paid";
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
