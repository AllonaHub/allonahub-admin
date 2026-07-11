(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core || {};
  const CHECKOUT_KEY = "allona_partner_premium_checkout";
  const BANK_PAYMENT_HANDOFF_KEY = "allona_bank_checkout";

  const PLANS = {
    launch: {
      key: "launch",
      name: "Tam Entegrasyon Lansman",
      price: 299,
      period: "aylık",
      channels: 2,
      products: "1.000",
      orders: "1.000/ay",
      badge: "İlk 100-200 partner"
    },
    pro: {
      key: "pro",
      name: "Tam Entegrasyon Pro",
      price: 599,
      period: "aylık",
      channels: 5,
      products: "10.000",
      orders: "5.000/ay",
      badge: "Önerilen"
    },
    plus: {
      key: "plus",
      name: "Tam Entegrasyon Plus",
      price: 999,
      period: "aylık",
      channels: 10,
      products: "50.000",
      orders: "20.000/ay",
      badge: "Yoğun operasyon"
    }
  };

  function escape(value) {
    return core.escapeHTML ? core.escapeHTML(value) : String(value ?? "");
  }

  function money(value) {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function selectedPlan(key) {
    return PLANS[key] || PLANS.pro;
  }

  function readCheckout() {
    try {
      return JSON.parse(sessionStorage.getItem(CHECKOUT_KEY) || "{}");
    } catch (error) {
      return {};
    }
  }

  function writeCheckout(plan, source) {
    const payload = {
      plan_key: plan.key,
      plan_name: plan.name,
      amount: plan.price,
      currency: "TRY",
      period: plan.period,
      channels: plan.channels,
      product_quota: plan.products,
      order_quota: plan.orders,
      source: source || "partner_premium_page",
      created_at: new Date().toISOString(),
      return_to: "partner-panel.html#integrations"
    };
    sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(payload));
    return payload;
  }

  async function authHeaders() {
    if (!App.auth || !App.auth.getSession) return null;
    const session = await App.auth.getSession();
    if (!session?.access_token) return null;
    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json"
    };
  }

  function apiBaseUrl() {
    const configured = String(App.config?.apiBaseUrl || "").replace(/\/$/, "");
    if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) return "http://localhost:3000";
    return configured || "https://api.allonahub.com";
  }

  async function startRemoteCheckout(plan) {
    const headers = await authHeaders();
    if (!headers) return null;
    const response = await fetch(`${apiBaseUrl()}/v1/partner/premium/checkout`, {
      method: "POST",
      headers,
      body: JSON.stringify({ plan_key: plan.key, billing_period: "monthly" })
    });
    if (response.status === 404 || response.status === 501 || response.status === 503) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) return null;
    return payload;
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

  async function choosePlan(planKey) {
    const plan = selectedPlan(planKey);
    const handoff = writeCheckout(plan, "premium_plan_card");
    const remote = await startRemoteCheckout(plan);
    if (remote?.paymentPageUrl && trustedPaymentUrl(remote.paymentPageUrl)) {
      sessionStorage.setItem(BANK_PAYMENT_HANDOFF_KEY, JSON.stringify({
        paymentPageUrl: remote.paymentPageUrl,
        orderNo: remote.orderNo || `PREMIUM-${plan.key.toUpperCase()}`,
        displayTotal: money(plan.price),
        displayCurrency: "TRY",
        expiresAt: Date.now() + 15 * 60 * 1000
      }));
      window.location.href = "../commerce/bank-payment.html";
      return;
    }
    sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify({
      ...handoff,
      checkout_status: "payment_provider_pending"
    }));
    window.location.href = `partner-premium-checkout.html?plan=${encodeURIComponent(plan.key)}`;
  }

  function checkoutSummary(payload) {
    const plan = selectedPlan(payload.plan_key);
    return `
      <div><span>Paket</span><strong>${escape(payload.plan_name || plan.name)}</strong></div>
      <div><span>Aylık ücret</span><strong>${escape(money(payload.amount || plan.price))}</strong></div>
      <div><span>Kanal</span><strong>${escape(payload.channels || plan.channels)}</strong></div>
      <div><span>Ürün kotası</span><strong>${escape(payload.product_quota || plan.products)}</strong></div>
      <div><span>Sipariş kotası</span><strong>${escape(payload.order_quota || plan.orders)}</strong></div>
      <div><span>Durum</span><strong>Ödeme sağlayıcısı bekliyor</strong></div>
    `;
  }

  function renderCheckoutPage() {
    if (!document.querySelector("[data-page='partner-premium-checkout']")) return;
    const params = new URLSearchParams(window.location.search);
    const fallbackPlan = selectedPlan(params.get("plan"));
    const payload = Object.keys(readCheckout()).length ? readCheckout() : writeCheckout(fallbackPlan, "checkout_direct_open");
    const title = document.querySelector("[data-premium-checkout-title]");
    const copy = document.querySelector("[data-premium-checkout-copy]");
    const summary = document.querySelector("[data-premium-checkout-summary]");
    if (title) title.textContent = `${payload.plan_name || fallbackPlan.name} seçildi`;
    if (copy) {
      copy.textContent = "Gerçek ödeme sağlayıcı anahtarları aktif edildiğinde bu adım otomatik olarak güvenli banka ödeme ekranına aktaracak. Şu an paket seçimi ve checkout payload'u hazır tutuluyor.";
    }
    if (summary) summary.innerHTML = checkoutSummary(payload);
  }

  function bind() {
    document.addEventListener("click", (event) => {
      const planButton = event.target.closest("[data-premium-checkout]");
      const retryButton = event.target.closest("[data-premium-retry-checkout]");
      if (planButton) {
        choosePlan(planButton.dataset.premiumCheckout);
      }
      if (retryButton) {
        const payload = readCheckout();
        choosePlan(payload.plan_key || "pro");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bind();
    renderCheckoutPage();
  });
})();
