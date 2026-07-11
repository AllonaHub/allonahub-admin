(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;

  function setText(selector, value) {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  }

  function init() {
    if (!document.querySelector("[data-page='order-success']")) return;
    const payment = core.getParam("payment") || core.getParam("status") || "pending";
    const orderNo = core.getParam("order") || core.getParam("orderNo") || core.getParam("id") || "-";
    const result = document.querySelector("[data-order-result]");
    const icon = document.querySelector("[data-order-result-icon]");
    const retry = document.querySelector("[data-payment-retry]");
    const meta = document.querySelector("[data-order-result-meta]");

    const states = {
      paid: {
        className: "payment-result--success",
        title: "Ödeme Alındı",
        heading: "Siparişiniz başarıyla ödendi",
        copy: "banka ödeme doğrulaması tamamlandı. Siparişinizi Hesabım > Siparişlerim alanından takip edebilirsiniz.",
        icon: "✓"
      },
      failed: {
        className: "payment-result--failed",
        title: "Ödeme Tamamlanamadı",
        heading: "Ödeme tamamlanamadı",
        copy: "banka ödeme doğrulaması başarısız döndü. Kart bilgilerinizi banka ödeme ekranında tekrar kontrol ederek yeni ödeme deneyebilirsiniz.",
        icon: "!"
      },
      pending: {
        className: "payment-result--pending",
        title: "Ödeme Kontrol Ediliyor",
        heading: "Ödeme durumu beklemede",
        copy: "Ödeme sağlayıcısından sonuç bekleniyor. Sipariş durumunuz kısa süre içinde güncellenir.",
        icon: "..."
      }
    };

    const state = states[payment] || states.pending;
    if (result) result.classList.add(state.className);
    if (icon) icon.textContent = state.icon;
    if (retry && payment !== "paid") retry.classList.remove("hidden");
    setText("[data-order-result-title]", state.title);
    setText("[data-order-result-copy]", state.copy);
    setText("[data-order-result-heading]", state.heading);
    setText("[data-order-result-message]", state.copy);

    if (meta) {
      meta.innerHTML = `
        <span>Sipariş: <strong>${core.escapeHTML(orderNo)}</strong></span>
        <span>Ödeme durumu: <strong>${core.escapeHTML(payment)}</strong></span>
      `;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
