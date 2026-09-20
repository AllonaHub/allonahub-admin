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
      .allonahub-turnstile__status{font-size:12px;line-height:1.45;color:inherit;opacity:.82;text-align:center}
      .allonahub-turnstile__retry{min-height:40px;padding:8px 14px;border:1px solid rgba(14,116,144,.36);border-radius:8px;background:#ecfeff;color:#0e5263;font:700 12px/1.2 inherit;cursor:pointer}
      .allonahub-turnstile__retry[hidden]{display:none}
      .allonahub-turnstile__retry:focus-visible{outline:3px solid rgba(6,182,212,.35);outline-offset:2px}
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
    const status = document.createElement("div");
    status.className = "allonahub-turnstile__status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "allonahub-turnstile__retry";
    retry.textContent = "Güvenlik kontrolünü yeniden dene";
    retry.hidden = true;
    container.replaceChildren(labelNode, widget, status, retry);
    return { widget, status, retry };
  }

  function clearRetryTimer(state) {
    if (!state || !state.retryTimer) return;
    window.clearTimeout(state.retryTimer);
    state.retryTimer = null;
  }

  function resetVisibleWidgetAfterFailure(state, automatic) {
    if (!state || !window.turnstile || state.widgetId === null) return;
    clearRetryTimer(state);
    state.token = "";
    state.failed = false;
    state.recovering = true;
    state.container.dataset.verified = "false";
    state.retry.hidden = true;
    state.status.textContent = automatic
      ? "Güvenlik kontrolü yeniden hazırlanıyor..."
      : "Güvenlik kontrolü yenilendi. Lütfen doğrulamayı tamamlayın.";
    const delay = automatic ? Math.min(6000, 1200 * Math.max(1, state.retryCount)) : 0;
    state.retryTimer = window.setTimeout(() => {
      state.retryTimer = null;
      try {
        window.turnstile.reset(state.widgetId);
        state.recovering = false;
      } catch (error) {
        state.recovering = false;
        state.failed = true;
        state.status.textContent = "Güvenlik kontrolü yenilenemedi. Lütfen yeniden deneyin.";
        state.retry.hidden = false;
      }
    }, delay);
  }

  function resetVisibleWidget(state) {
    if (!state || !window.turnstile || state.widgetId === null) return;
    clearRetryTimer(state);
    try {
      window.turnstile.reset(state.widgetId);
    } catch (error) {}
    state.token = "";
    state.failed = false;
    state.recovering = false;
    state.retryCount = 0;
    if (state.status) state.status.textContent = "";
    if (state.retry) state.retry.hidden = true;
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
    const content = buildChallengeContent(container, challengeLabel(normalizedAction), true);
    const state = {
      container,
      widgetId: null,
      token: "",
      failed: false,
      recovering: false,
      retryCount: 0,
      retryTimer: null,
      status: content.status,
      retry: content.retry
    };

    state.retry.addEventListener("click", () => resetVisibleWidgetAfterFailure(state, false));

    state.widgetId = window.turnstile.render(content.widget, {
      sitekey: siteKey(),
      action: normalizedAction,
      theme: "auto",
      size: "flexible",
      retry: "never",
      "refresh-expired": "auto",
      "refresh-timeout": "auto",
      callback(token) {
        clearRetryTimer(state);
        state.token = token || "";
        state.failed = false;
        state.recovering = false;
        state.retryCount = 0;
        state.status.textContent = "";
        state.retry.hidden = true;
        container.dataset.verified = state.token ? "true" : "false";
      },
      "error-callback"(errorCode) {
        state.token = "";
        state.failed = true;
        state.recovering = false;
        state.retryCount += 1;
        container.dataset.verified = "false";
        if (state.retryCount <= 2) {
          window.setTimeout(() => resetVisibleWidgetAfterFailure(state, true), 0);
        } else {
          state.status.textContent = "Güvenlik kontrolü tamamlanamadı. Bağlantınızı kontrol edip yeniden deneyin.";
          state.retry.hidden = false;
        }
        return true;
      },
      "expired-callback"() {
        state.token = "";
        state.failed = false;
        container.dataset.verified = "false";
        state.status.textContent = "Güvenlik kontrolünün süresi doldu; yenileniyor...";
      },
      "timeout-callback"() {
        state.token = "";
        state.failed = true;
        container.dataset.verified = "false";
        state.status.textContent = "Güvenlik kontrolü zaman aşımına uğradı.";
        state.retry.hidden = false;
      },
      "unsupported-callback"() {
        clearRetryTimer(state);
        state.token = "";
        state.failed = true;
        state.recovering = false;
        container.dataset.verified = "false";
        state.status.textContent = "Bu tarayıcı güvenlik kontrolünü desteklemiyor. Güncel Safari, Chrome veya Edge ile yeniden deneyin.";
        state.retry.hidden = true;
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
        if (visibleToken) return visibleToken;
        if (state && state.recovering) {
          const recovering = new Error("Robot doğrulaması yeniden hazırlanıyor. Lütfen birkaç saniye sonra tekrar deneyin.");
          recovering.status = 0;
          throw recovering;
        }
        if (state && state.failed) {
          const unavailable = new Error("Robot doğrulaması şu anda kullanılamıyor.");
          unavailable.status = 0;
          throw unavailable;
        }
        const required = new Error("Önce robot doğrulamasını tamamlayın.");
        required.status = 400;
        throw required;
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
