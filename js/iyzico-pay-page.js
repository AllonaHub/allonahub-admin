(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const STORAGE_KEY = "allona_iyzico_checkout";

  function readSession() {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
    } catch (error) {
      return {};
    }
  }

  function isTrustedIyzicoUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && (url.hostname === "iyzipay.com" || url.hostname.endsWith(".iyzipay.com"));
    } catch (error) {
      return false;
    }
  }

  function renderError(message) {
    const root = document.querySelector("[data-payment-handoff]");
    const text = document.querySelector("[data-payment-handoff-message]");
    const button = document.querySelector("[data-payment-continue]");
    if (root) root.classList.add("payment-handoff--error");
    if (text) text.textContent = message;
    if (button) button.disabled = true;
  }

  function redirect(paymentUrl) {
    window.location.assign(paymentUrl);
  }

  function init() {
    if (!document.querySelector("[data-page='iyzico-pay']")) return;
    const session = readSession();
    const paymentUrl = session.paymentPageUrl;
    const meta = document.querySelector("[data-payment-handoff-meta]");
    const button = document.querySelector("[data-payment-continue]");

    if (!paymentUrl || !isTrustedIyzicoUrl(paymentUrl)) {
      renderError("Güvenli ödeme oturumu bulunamadı veya doğrulanamadı. Lütfen checkout adımından tekrar deneyin.");
      return;
    }

    if (session.expiresAt && Date.now() > Number(session.expiresAt)) {
      sessionStorage.removeItem(STORAGE_KEY);
      renderError("Ödeme oturumunun süresi doldu. Lütfen checkout adımından yeni bir ödeme oturumu başlatın.");
      return;
    }

    if (meta) {
      meta.innerHTML = `
        <span>Sipariş: <strong>${core.escapeHTML(session.orderNo || session.orderId || "-")}</strong></span>
        <span>Sağlayıcı: <strong>iyzico CheckoutForm</strong></span>
      `;
    }

    if (button) {
      button.addEventListener("click", () => redirect(paymentUrl));
    }

    window.setTimeout(() => redirect(paymentUrl), 900);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
