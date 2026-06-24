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
      const existing = document.querySelector("script[data-allonahub-turnstile]");
      if (existing) {
        existing.addEventListener("load", () => resolve(true), { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.allonahubTurnstile = "true";
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error("Robot doğrulaması yüklenemedi."));
      document.head.appendChild(script);
    });

    return loader;
  }

  function challengeLabel(action) {
    const labels = {
      login: "Giriş için robot olmadığınızı doğrulayın.",
      register: "Kayıt için robot olmadığınızı doğrulayın.",
      forgot_password: "Şifre sıfırlama için robot olmadığınızı doğrulayın.",
      partner_application: "Başvuru için robot olmadığınızı doğrulayın.",
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
      .security-challenge,.allonahub-turnstile{display:grid;gap:8px;justify-items:center;margin:14px 0;min-height:78px}
      .allonahub-turnstile__label{font-size:12px;font-weight:700;color:inherit;opacity:.78;text-align:center}
      .allonahub-turnstile__widget{min-height:65px}
    `;
    document.head.appendChild(style);
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
    container.innerHTML = `<div class="allonahub-turnstile__label">${challengeLabel(normalizedAction)}</div><div class="allonahub-turnstile__widget"></div>`;

    const widgetTarget = container.querySelector(".allonahub-turnstile__widget");
    const state = {
      container,
      widgetId: null,
      token: ""
    };

    state.widgetId = window.turnstile.render(widgetTarget, {
      sitekey: siteKey(),
      action: normalizedAction,
      theme: "light",
      size: "normal",
      callback(token) {
        state.token = token || "";
        container.dataset.verified = state.token ? "true" : "false";
      },
      "error-callback"() {
        state.token = "";
        container.dataset.verified = "false";
      },
      "expired-callback"() {
        state.token = "";
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
        container.innerHTML = `<div class="allonahub-turnstile__label">${error.message || "Robot doğrulaması yüklenemedi."}</div>`;
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
        if (!visibleToken) return await execute(normalizedAction);
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
