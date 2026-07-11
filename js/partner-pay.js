(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;

  function $(selector) {
    return document.querySelector(selector);
  }

  function param(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
  }

  function apiBaseUrl() {
    const configured = String(App.config.apiBaseUrl || "").replace(/\/$/, "");
    if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) return "http://localhost:3000";
    return configured || "https://api.allonahub.com";
  }

  function channelLabel(channel) {
    const labels = {
      qr: "QR",
      nfc: "NFC SoftPOS",
      payment_link: "Ödeme linki",
      web_pos: "Web POS",
      physical_pos: "Fiziksel POS",
      cash: "Nakit",
      wallet: "Cüzdan"
    };
    return labels[channel] || channel || "QR";
  }

  function status(message, type) {
    const target = $("[data-partner-pay-status]");
    if (!target) return;
    target.textContent = message || "";
    target.classList.toggle("is-error", type === "error");
  }

  function hydrate() {
    const amount = Number(param("amount") || 0);
    const partner = param("partner") || "AllonaHub Partner";
    const channel = param("channel") || "qr";
    const payment = param("payment");

    if ($("[data-pay-title]")) $("[data-pay-title]").textContent = payment === "paid" ? "Ödeme başarılı" : "Partner Ödemesi";
    if ($("[data-pay-description]")) {
      $("[data-pay-description]").textContent = payment === "paid"
        ? "Ödemeniz başarıyla işlendi. Dijital fiş ve işlem kaydı partner paneline yansıtıldı."
        : "Bilgilerinizi girip güvenli banka ödeme ekranına devam edin.";
    }
    if ($("[data-pay-partner]")) $("[data-pay-partner]").textContent = partner;
    if ($("[data-pay-amount]")) $("[data-pay-amount]").textContent = amount ? core.money(amount) : "-";
    if ($("[data-pay-channel]")) $("[data-pay-channel]").textContent = channelLabel(channel);

    if (payment) {
      const form = $("[data-partner-pay-form]");
      if (form) form.hidden = true;
      status(payment === "paid" ? "AllonaHub ödeme sonucunu kaydetti." : "Ödeme tamamlanamadı veya iptal edildi.", payment === "paid" ? "" : "error");
    }

    if (channel === "nfc") {
      const form = $("[data-partner-pay-form]");
      if (form) form.hidden = true;
      status("Bu ödeme NFC SoftPOS cihazında tamamlanır. Kartınızı veya telefonunuzu partnerin sertifikalı NFC cihazına yaklaştırın.");
    }
  }

  async function beginCheckout(form) {
    const intentId = param("intent");
    if (!intentId || intentId.startsWith("local-")) {
      status("Bu ödeme bağlantısı yerel önizleme modunda oluşturulmuş. Canlı tahsilat için partner panelinin backend API ile bağlı olması gerekir.", "error");
      return;
    }

    const payload = Object.fromEntries(new FormData(form).entries());
    payload.intentId = intentId;
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    button.textContent = "Ödeme sayfası açılıyor...";
    try {
      const response = await fetch(`${apiBaseUrl()}/v1/public/partner-payment-intents/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false || !data.paymentPageUrl) {
        throw new Error(data.message || "Ödeme sayfası başlatılamadı.");
      }
      window.location.href = data.paymentPageUrl;
    } catch (error) {
      status(error.message || "Ödeme başlatılamadı. Lütfen tekrar deneyin.", "error");
    } finally {
      button.disabled = false;
      button.textContent = "Güvenli Ödeme Sayfasına Devam Et";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.querySelector("[data-page='partner-pay']")) return;
    hydrate();
    const form = $("[data-partner-pay-form]");
    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        beginCheckout(form);
      });
    }
  });
})();
