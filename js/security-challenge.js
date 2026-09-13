(function () {
  const App = window.Allona = window.Allona || {};
  let loader = null;
  const visibleWidgets = new Map();

  function siteKey() {
    return String(App.config && App.config.turnstileSiteKey || "").trim();
  }

  function normalizeAction(action) {
    return String(action || "form_submit").trim().slice(0, 32) || "form_submit";
  }

  function isActiveChallenge(container) {
    const form = container && container.closest && container.closest(".form");
    if (form && !form.classList.contains("active")) return false;
    return true;
  }

  function loadTurnstile() {
    if (!siteKey()) return Promise.resolve(false);
    if (window.turnstile) return Promise.resolve(true);
    if (loader) return loader;

    loader = new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        callback(value);
      };
      const timeout = window.setTimeout(() => {
        finish(reject, new Error("Robot doğrulaması zamanında yüklenemedi."));
      }, 12000);
      const existing = document.querySelector("script[data-allonahub-turnstile]");
      if (existing) {
        existing.addEventListener("load", () => finish(resolve, true), { once: true });
        existing.addEventListener("error", () => finish(reject, new Error("Robot doğrulaması yüklenemedi.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.allonahubTurnstile = "true";
      script.onload = () => finish(resolve, true);
      script.onerror = () => finish(reject, new Error("Robot doğrulaması yüklenemedi."));
      document.head.appendChild(script);
    }).catch((error) => {
      loader = null;
      throw error;
    });

    return loader;
  }

  function challengeLabel(action) {
    const labels = {
      login: "Giriş için robot olmadığınızı doğrulayın.",
      register: "Kayıt için robot olmadığınızı doğrulayın.",
      forgot_password: "Şifre sıfırlama için robot olmadığınızı doğrulayın.",
      partner_company_lookup: "Şirket bilgisi sorgusu için robot olmadığınızı doğrulayın.",
      partner_application: "Başvuru için robot olmadığınızı doğrulayın.",
      maritime_partner_application: "Denizcilik partner başvurusu için robot olmadığınızı doğrulayın.",
      order_checkout: "Ödeme için robot olmadığınızı doğrulayın.",
      partner_payment_checkout: "Ödeme için robot olmadığınızı doğrulayın.",
      cv_checkout: "CV ödeme için robot olmadığınızı doğrulayın."
    };
    return labels[action] || "Robot olmadığınızı doğrulayın.";
  }

  function injectStyle() {
    if (document.querySelector("style[data-allonahub-turnstile-style]")) return;
    const style = document.createElement("style");
    style.dataset.allonahubTurnstileStyle = "true";
    style.textContent = `
      .security-challenge,.allonahub-turnstile{display:grid;gap:8px;justify-items:center;width:100%;max-width:100%;margin:14px 0;min-height:78px;overflow:hidden}
      .allonahub-turnstile__label{font-size:12px;font-weight:700;color:inherit;opacity:.78;text-align:center}
      .allonahub-turnstile__widget{width:100%;max-width:100%;min-height:65px}
      .allonahub-turnstile__widget>div{max-width:100%;margin-inline:auto}
    `;
    document.head.appendChild(style);
  }

  function buildChallengeContent(container, label, includeWidget) {
    const labelNode = document.createElement("div");
    labelNode.className = "allonahub-turnstile__label";
    labelNode.textContent = label;
    if (!includeWidget) {
      container.replaceChildren(labelNode);
      return null;
    }
    const widget = document.createElement("div");
    widget.className = "allonahub-turnstile__widget";
    container.replaceChildren(labelNode, widget);
    return widget;
  }

  function resetVisibleWidget(state) {
    if (!state || !window.turnstile || state.widgetId === null) return;
    try {
      window.turnstile.reset(state.widgetId);
    } catch (error) {}
    state.token = "";
    state.container.dataset.verified = "false";
  }

  function consumeVisibleToken(action) {
    const state = visibleWidgets.get(normalizeAction(action));
    if (!state) return "";
    const token = state.token || "";
    if (token) {
      setTimeout(() => resetVisibleWidget(state), 0);
    }
    return token;
  }

  function renderVisibleWidget(container, action) {
    if (!container || container.dataset.turnstileRendered === "true" || !window.turnstile) return;
    const normalizedAction = normalizeAction(action);
    container.dataset.turnstileRendered = "true";
    container.dataset.verified = "false";
    container.classList.add("allonahub-turnstile");
    const widgetTarget = buildChallengeContent(container, challengeLabel(normalizedAction), true);
    const state = {
      container,
      widgetId: null,
      token: "",
      failed: false
    };

    state.widgetId = window.turnstile.render(widgetTarget, {
      sitekey: siteKey(),
      action: normalizedAction,
      theme: "light",
      size: "flexible",
      callback(token) {
        state.token = token || "";
        state.failed = false;
        container.dataset.verified = state.token ? "true" : "false";
      },
      "error-callback"() {
        state.token = "";
        state.failed = true;
        container.dataset.verified = "false";
      },
      "expired-callback"() {
        state.token = "";
        state.failed = false;
        container.dataset.verified = "false";
      }
    });

    visibleWidgets.set(normalizedAction, state);
  }

  async function hydrateVisibleChallenges() {
    if (!siteKey()) return;
    const containers = Array.from(document.querySelectorAll("[data-security-challenge]")).filter(isActiveChallenge);
    if (!containers.length) return;
    injectStyle();
    try {
      await loadTurnstile();
    } catch (error) {
      containers.forEach((container) => {
        container.classList.add("allonahub-turnstile");
        container.dataset.verified = "false";
        buildChallengeContent(container, error.message || "Robot doğrulaması yüklenemedi.", false);
      });
      return;
    }
    if (!window.turnstile) return;
    containers.forEach((container) => {
      renderVisibleWidget(container, container.getAttribute("data-security-challenge"));
    });
  }

  async function execute(action) {
    if (!siteKey()) return "";
    await loadTurnstile();
    if (!window.turnstile) throw new Error("Robot doğrulaması başlatılamadı.");

    return new Promise((resolve, reject) => {
      const container = document.createElement("div");
      container.hidden = true;
      container.setAttribute("aria-hidden", "true");
      document.body.appendChild(container);

      let widgetId = null;
      const cleanup = () => {
        try {
          if (widgetId !== null) window.turnstile.remove(widgetId);
        } catch (error) {}
        container.remove();
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Robot doğrulaması zaman aşımına uğradı."));
      }, 30000);

      widgetId = window.turnstile.render(container, {
        sitekey: siteKey(),
        size: "invisible",
        execution: "execute",
        action: normalizeAction(action),
        callback(token) {
          clearTimeout(timeout);
          cleanup();
          resolve(token || "");
        },
        "error-callback"() {
          clearTimeout(timeout);
          cleanup();
          reject(new Error("Robot doğrulaması başarısız oldu."));
        },
        "expired-callback"() {
          clearTimeout(timeout);
          cleanup();
          reject(new Error("Robot doğrulaması süresi doldu."));
        }
      });

      window.turnstile.execute(widgetId);
    });
  }

  async function tokenFor(action) {
    try {
      const normalizedAction = normalizeAction(action);
      const visibleToken = consumeVisibleToken(action);
      if (visibleWidgets.has(normalizedAction)) {
        const state = visibleWidgets.get(normalizedAction);
        if (!visibleToken && state && state.failed) {
          const unavailable = new Error("Robot doğrulaması şu anda kullanılamıyor.");
          unavailable.status = 0;
          throw unavailable;
        }
        return visibleToken;
      }
      return await execute(normalizedAction);
    } catch (error) {
      if (App.core && App.core.toast) {
        App.core.toast(error.message || "Robot doğrulaması tamamlanamadı.", "error");
      }
      throw error;
    }
  }

  App.securityChallenge = {
    tokenFor,
    hydrate: hydrateVisibleChallenges,
    enabled: () => Boolean(siteKey())
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hydrateVisibleChallenges, { once: true });
  } else {
    hydrateVisibleChallenges();
  }
})();
