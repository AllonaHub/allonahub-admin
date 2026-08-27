(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const INTEGRATION_AUTO_PULL_DELAY_MS = 11000;
  const INTEGRATION_AUTO_PULL_MAX_BATCHES = 50;

  const state = {
    access: null,
    business: null,
    products: [],
    orders: [],
    paymentIntents: [],
    transactions: [],
    payouts: [],
    refundCancellations: [],
    locations: [],
    devices: [],
    qrCodes: [],
    tickets: [],
    campaigns: [],
    integrations: [],
    integrationConnectors: [],
    integrationRuns: [],
    partnerWarnings: [],
    integrationWarnings: [],
    refundWarnings: [],
    integrationPolicy: {},
    metrics: {},
    recommendations: [],
    selectedRefundId: null,
    productView: "list",
    orderFilters: {
      search: "",
      code: "",
      status: "all",
      quick: "all",
      pageSize: 50
    },
    initialHashApplied: false
  };

  const MODULE_PROFILES = {
    shop: {
      label: "Allona Shop",
      shortLabel: "Shop",
      typeLabels: ["Ürün", "Ürün Ekle"],
      href: "../commerce/allonashop.html",
      category: "Genel",
      brand: "Allona Shop Partneri",
      image: "/images/modules/allona-shop.png",
      skuPrefix: "ALP"
    },
    market: {
      label: "Allona Market",
      shortLabel: "Market",
      typeLabels: ["Market ürünü", "Market Ürünü Ekle"],
      href: "../commerce/allonamarket.html",
      category: "Market / Kahvaltı",
      brand: "Allona Market Partneri",
      image: "/images/modules/market-water-pack.png",
      skuPrefix: "ALM"
    },
    food: {
      label: "Allona Yemek",
      shortLabel: "Yemek",
      typeLabels: ["Menü ürünü", "Menü Ürünü Ekle"],
      href: "../commerce/allonayemek.html",
      category: "Yemek / Menü",
      brand: "Allona Burger House",
      image: "/images/modules/yemek-light-v5.jpg",
      skuPrefix: "ALY"
    },
    service: {
      label: "Hizmet / Ekosistem",
      shortLabel: "Hizmet",
      typeLabels: ["Hizmet", "Hizmet Ekle"],
      href: "../ecosystem/ecosystem.html",
      category: "Hizmet / Operasyon",
      brand: "Allona Partner",
      image: "/images/product-fallback.svg",
      skuPrefix: "ALS"
    }
  };

  const PRODUCT_TEMPLATE_COLUMNS = [
    "catalog_scope",
    "name",
    "category",
    "brand",
    "price",
    "stock",
    "status",
    "seller_public_name",
    "seller_legal_name",
    "seller_city",
    "seller_contact",
    "seller_tax_number_masked",
    "invoice_responsibility",
    "seller_disclosure",
    "image_url",
    "media_gallery",
    "video_url",
    "description",
    "sku"
  ];

  const RESTRICTED_PRODUCT_PATTERNS = [
    ["Alkol ve tütün ürünü", /\b(alkol|alkollü|bira|şarap|rakı|viski|votka|tütün|sigara|puro|nargile|elektronik sigara|vape)\b/i],
    ["Silah, patlayıcı veya kesici saldırı ürünü", /\b(silah|tabanca|tüfek|mermi|fişek|patlayıcı|bomba|bıçak|sustalı|elektro şok|şok cihazı)\b/i],
    ["İlaç veya reçeteli sağlık ürünü", /\b(reçeteli|ilaç|antibiyotik|hormon|steroid|anabolik|uyuşturucu|narkotik|cbd|kenevir|esrar)\b/i],
    ["Kumar, bahis veya şans oyunu", /\b(kumar|bahis|casino|poker|rulet|iddaa kuponu|şans oyunu)\b/i],
    ["Yetişkin içerik veya hizmet", /\b(yetişkin|erotik|escort|cinsel|pornografik)\b/i],
    ["Canlı hayvan veya kontrol gerektiren hayvan satışı", /\b(canlı hayvan|yavru kedi|yavru köpek|evcil hayvan satışı)\b/i]
  ];

  const DEFAULT_INTEGRATION_CONNECTORS = [
    { provider: "generic_feed", label: "CSV / JSON Feed", availability: "free", stage: "enabled", active_now: true, outbound_active_now: false, sort_order: 10 },
    { provider: "woocommerce", label: "WooCommerce", availability: "free", stage: "starter", active_now: true, outbound_active_now: false, sort_order: 20 },
    { provider: "shopify", label: "Shopify", availability: "premium", stage: "premium_ready", active_now: true, outbound_active_now: false, sort_order: 30 },
    { provider: "trendyol", label: "Trendyol Pazaryeri", availability: "premium", stage: "premium_ready", active_now: true, outbound_active_now: false, sort_order: 40 },
    { provider: "hepsiburada", label: "Hepsiburada", availability: "premium", stage: "premium_ready", active_now: true, outbound_active_now: false, sort_order: 50 },
    { provider: "n11", label: "n11", availability: "premium", stage: "premium_ready", active_now: true, outbound_active_now: false, sort_order: 60 },
    { provider: "ciceksepeti", label: "Çiçeksepeti", availability: "premium", stage: "planned", active_now: false, outbound_active_now: false, sort_order: 70 },
    { provider: "pazarama", label: "Pazarama", availability: "premium", stage: "planned", active_now: false, outbound_active_now: false, sort_order: 80 },
    { provider: "custom_api", label: "Özel API", availability: "enterprise", stage: "premium_ready", active_now: true, outbound_active_now: false, sort_order: 90 }
  ];

  const INTEGRATION_CREDENTIAL_HINTS = {
    generic_feed: {
      sourceLabel: "Feed URL",
      sourcePlaceholder: "https://partner-site.com/products.csv veya .json",
      keyLabel: "API anahtarı",
      keyPlaceholder: "Gerekmiyorsa boş bırak",
      secretLabel: "API secret / token",
      secretPlaceholder: "Gerekmiyorsa boş bırak"
    },
    woocommerce: {
      sourceLabel: "WooCommerce mağaza URL",
      sourcePlaceholder: "https://magazaadresiniz.com",
      keyLabel: "Consumer Key",
      keyPlaceholder: "ck_...",
      secretLabel: "Consumer Secret",
      secretPlaceholder: "cs_..."
    },
    shopify: {
      sourceLabel: "Shopify shop domain",
      sourcePlaceholder: "magazaniz.myshopify.com",
      keyLabel: "API anahtarı",
      keyPlaceholder: "Opsiyonel",
      secretLabel: "Admin API access token",
      secretPlaceholder: "shpat_..."
    },
    trendyol: {
      sourceLabel: "Supplier ID / Satıcı ID",
      sourcePlaceholder: "Trendyol tedarikçi numaranız",
      keyLabel: "Trendyol API Key",
      keyPlaceholder: "Satıcı panelindeki API key",
      secretLabel: "Trendyol API Secret",
      secretPlaceholder: "Satıcı panelindeki API secret"
    },
    hepsiburada: {
      sourceLabel: "Merchant ID",
      sourcePlaceholder: "Hepsiburada merchant ID",
      keyLabel: "Hepsiburada API Key",
      keyPlaceholder: "API key",
      secretLabel: "Hepsiburada API Secret",
      secretPlaceholder: "API secret"
    },
    n11: {
      sourceLabel: "Kaynak / mağaza URL",
      sourcePlaceholder: "Opsiyonel",
      keyLabel: "n11 App Key",
      keyPlaceholder: "App key",
      secretLabel: "n11 App Secret",
      secretPlaceholder: "App secret"
    }
  };

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $all(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function money(value) {
    return core.money(Number(value || 0));
  }

  function escape(value) {
    return core.escapeHTML(value ?? "");
  }

  function formatDate(value) {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (error) {
      return "-";
    }
  }

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function apiBaseUrl() {
    const configured = String(App.config.apiBaseUrl || "").replace(/\/$/, "");
    if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) return "http://localhost:3000";
    return configured || "https://api.allonahub.com";
  }

  async function authHeaders() {
    const session = await App.auth.getSession();
    if (!session || !session.access_token) throw new Error("API için oturum doğrulanamadı.");
    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json"
    };
  }

  async function apiFetch(path, options) {
    const settings = options || {};
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      ...settings,
      headers: {
        ...(await authHeaders()),
        ...(settings.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.message || payload.error || "Partner API isteği tamamlanamadı.");
    }
    return payload;
  }

  async function syncEInvoicingEntry() {
    const entry = $("[data-e-invoicing-entry]");
    if (!entry) return;
    entry.hidden = true;
    try {
      const catalog = await apiFetch("/v1/e-invoicing/catalog");
      entry.hidden = catalog.enabled !== true;
    } catch (error) {
      entry.hidden = true;
    }
  }

  function showAlert(message, type) {
    const node = $("[data-partner-alert]");
    if (!node) return;
    node.hidden = !message;
    node.textContent = message || "";
    node.classList.toggle("is-error", type === "error");
  }

  function toast(message, type) {
    if (core.toast) core.toast(message, type);
    showAlert(message, type);
  }

  function statusClass(status) {
    if (["active", "paid", "settled", "delivered", "verified", "enabled", "success"].includes(status)) return "partner-os-status--good";
    if (["pending", "created", "awaiting_payment", "provider_pending", "review", "in_review", "preparing", "starter", "premium_ready", "queued", "running", "partial", "needs_attention", "pending_partner", "signal", "needs_review"].includes(status)) return "partner-os-status--warn";
    if (["failed", "cancelled", "expired", "rejected", "suspended", "blocked", "disabled", "dispute_admin_review", "needs_revision", "revision_required"].includes(status)) return "partner-os-status--bad";
    return "";
  }

  function statusLabel(status) {
    const labels = {
      active: "Aktif",
      draft: "Taslak",
      archived: "Arşiv",
      pending: "Bekliyor",
      review: "İncelemede",
      verified: "Doğrulandı",
      rejected: "Reddedildi",
      created: "Oluşturuldu",
      awaiting_payment: "Ödeme bekliyor",
      provider_pending: "Sağlayıcı bekliyor",
      paid: "Ödendi",
      failed: "Başarısız",
      cancelled: "İptal",
      expired: "Süresi doldu",
      refunded: "İade",
      confirmed: "Onaylandı",
      preparing: "Hazırlanıyor",
      shipped: "Kargoda",
      delivered: "Teslim edildi",
      open: "Açık",
      waiting: "Bekliyor",
      resolved: "Çözüldü",
      scheduled: "Planlandı",
      approved: "Onaylandı",
      enabled: "Açık",
      starter: "Başlangıç",
      premium_ready: "Premium hazır",
      planned: "Planlı",
      needs_attention: "İlgi istiyor",
      needs_review: "Kontrol",
      needs_revision: "Revize gerekli",
      revision_required: "Revize gerekli",
      in_review: "İncelemede",
      partial: "Kısmi",
      success: "Başarılı",
      skipped: "Atlandı",
      queued: "Kuyrukta",
      running: "Çalışıyor",
      pending_partner: "Partner onayı",
      dispute_admin_review: "Admin ihtilafı",
      signal: "Sinyal",
      support_signal: "Destek sinyali"
    };
    return labels[status] || status || "-";
  }

  function statusPill(status) {
    return `<span class="partner-os-status ${statusClass(status)}">${escape(statusLabel(status))}</span>`;
  }

  function initials(value) {
    return String(value || "AP")
      .split(/\s+/)
      .filter(Boolean)
      .map((item) => item[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function applyBusinessProfile() {
    const business = state.business || {};
    const name = business.display_name || business.legal_name || state.access?.profile?.full_name || "Allona Partner";
    const code = business.partner_code || "Partner OS";
    const avatar = $("[data-partner-avatar]");

    if ($("[data-partner-name]")) $("[data-partner-name]").textContent = name;
    if ($("[data-partner-code]")) $("[data-partner-code]").textContent = code;
    if ($("[data-partner-summary]")) {
      $("[data-partner-summary]").textContent = `${statusLabel(business.status || "active")} partner · ${statusLabel(business.verification_status || "pending")} · ${business.city || "AllonaHub ekosistemi"}`;
    }
    if ($("[data-dashboard-title]")) $("[data-dashboard-title]").textContent = `${name} için büyüme merkezi`;
    if ($("[data-dashboard-subtitle]")) {
      $("[data-dashboard-subtitle]").textContent = "QR, NFC, sipariş, ürün, kampanya, hakediş ve destek tek panelde yönetiliyor.";
    }
    if (avatar) {
      if (business.logo_url) {
        avatar.innerHTML = `<img src="${escape(business.logo_url)}" alt="${escape(name)}">`;
      } else {
        avatar.textContent = initials(name);
      }
    }

    applyCatalogProfile();

    const trust = Math.max(0, Math.min(100, Number(state.metrics.trust_score || business.trust_score || 70)));
    if ($("[data-trust-score]")) $("[data-trust-score]").textContent = `${trust}`;
    if ($("[data-trust-progress]")) $("[data-trust-progress]").style.width = `${trust}%`;
    if ($("[data-trust-label]")) {
      $("[data-trust-label]").textContent = trust >= 85
        ? "Doğrulama, ödeme ve operasyon kalitesi güçlü."
        : "Belge, cihaz ve ödeme aktivasyonu tamamlandıkça skor artar.";
    }

    const form = $("[data-profile-form]");
    if (form) {
      ["display_name", "legal_name", "phone", "city", "country", "description", "logo_url", "preferred_cargo_company", "payout_schedule"].forEach((key) => {
        if (form.elements[key]) form.elements[key].value = business[key] || "";
      });
    }
  }

  function renderKpis() {
    const metrics = state.metrics || {};
    const kpis = [
      ["Bugünkü Tahsilat", money(metrics.paid_today), "QR/NFC/link ödemeleri"],
      ["Açık Sipariş", metrics.open_order_count || 0, "Hazırlık ve kargo bekleyen"],
      ["İade / İptal", metrics.refund_cancellation_pending_count || 0, "Partner kararı bekleyen"],
      ["Bekleyen Ödeme", metrics.awaiting_payment_count || 0, "Açık QR/link istekleri"],
      ["Net Hacim", money(metrics.net_volume), "Komisyon sonrası kayıt"],
      ["Aktif Ürün", metrics.active_product_count || 0, "Yayında görünen ürün/hizmet"],
      ["Kritik Stok", metrics.low_stock_count || 0, "5 ve altı stok"],
      ["Bekleyen Hakediş", money(metrics.payout_pending), "Planlanmış ödeme"],
      ["Destek Talebi", metrics.open_ticket_count || 0, "Açık/yanıt bekleyen"]
    ];
    const target = $("[data-partner-kpis]");
    if (!target) return;
    target.innerHTML = kpis.map(([label, value, hint]) => `
      <article class="partner-os-kpi">
        <span>${escape(label)}</span>
        <strong>${escape(value)}</strong>
        <small>${escape(hint)}</small>
      </article>
    `).join("");
  }

  function renderMarketplaceBrief() {
    const target = $("[data-marketplace-brief]");
    if (!target) return;
    const metrics = state.metrics || {};
    const productIssues = productAttentionCount();
    const refundIssues = numeric(metrics.refund_cancellation_pending_count) + numeric(metrics.refund_cancellation_dispute_count);
    const integrationIssues = integrationAttentionCount();
    const openOrders = numeric(metrics.open_order_count);
    const operationRisk = productIssues + refundIssues + integrationIssues;
    const operationStatus = operationRisk > 0 ? "Riskli" : "Sağlıklı";
    const operationTone = operationRisk > 0 ? "pending" : "active";
    const campaignCount = state.campaigns.length;
    const activeProducts = numeric(metrics.active_product_count) || countByStatus(state.products, ["active"]);
    const waitingProducts = countByStatus(state.products, ["draft", "pending", "review", "needs_review", "in_review"]);

    target.innerHTML = `
      <div class="partner-os-marketplace-strip">
        <article>
          <span>Operasyon Durumu</span>
          <strong>${escape(operationStatus)}</strong>
          <small>${escape(openOrders)} açık sipariş · ${escape(refundIssues)} iade/iptal · ${escape(productIssues)} ürün sinyali</small>
          ${statusPill(operationTone)}
        </article>
        <article>
          <span>Satış Performansı</span>
          <strong>${money(metrics.gross_volume)}</strong>
          <small>Net ${money(metrics.net_volume)} · bugün ${money(metrics.paid_today)}</small>
          ${statusPill(numeric(metrics.paid_today) > 0 ? "active" : "pending")}
        </article>
        <article>
          <span>Katalog Kalitesi</span>
          <strong>${escape(activeProducts)} yayında</strong>
          <small>${escape(waitingProducts)} onay/revize bekliyor · ${escape(numeric(metrics.low_stock_count))} kritik stok</small>
          ${statusPill(productIssues ? "needs_review" : "active")}
        </article>
        <article>
          <span>Büyüme Planı</span>
          <strong>${escape(campaignCount)} kampanya</strong>
          <small>Kupon, reklam ve tekrar müşteri akışları tek merkezden izlenir.</small>
          ${statusPill(campaignCount ? "scheduled" : "pending")}
        </article>
      </div>
      <div class="partner-os-marketplace-actions">
        ${actionButton("Ürünleri düzenle", "fa-table-list", "products", "primary")}
        ${actionButton("Siparişleri aç", "fa-truck-fast", "orders", "")}
        ${actionButton("Raporları incele", "fa-chart-simple", "reports", "")}
        ${actionButton("Reklam planla", "fa-rectangle-ad", "ads", "")}
        ${actionButton("Müşteri aksiyonları", "fa-comments", "customers", "")}
      </div>
    `;
  }

  function renderStoreHealth() {
    const target = $("[data-store-health]");
    if (!target) return;
    const metrics = state.metrics || {};
    const business = state.business || {};
    const score = Math.max(0, Math.min(100, Number(metrics.trust_score || business.trust_score || 70)));
    const rows = [
      ["Profil", business.logo_url && business.display_name ? "Tamam" : "Eksik bilgi", business.logo_url && business.display_name ? "active" : "pending"],
      ["Katalog", Number(metrics.active_product_count || 0) > 0 ? `${metrics.active_product_count} aktif` : "Ürün bekliyor", Number(metrics.active_product_count || 0) > 0 ? "active" : "pending"],
      ["Ödeme", Number(metrics.awaiting_payment_count || 0) || Number(metrics.paid_today || 0) ? "Aktif" : "Kurulum bekliyor", Number(metrics.awaiting_payment_count || 0) || Number(metrics.paid_today || 0) ? "active" : "pending"],
      ["Destek", Number(metrics.open_ticket_count || 0) ? `${metrics.open_ticket_count} açık` : "Temiz", Number(metrics.open_ticket_count || 0) ? "pending" : "active"]
    ];
    target.innerHTML = `
      <div class="partner-os-health-score">
        <strong>${score}</strong>
        <span>Genel sağlık</span>
      </div>
      <div class="partner-os-health-bars">
        ${rows.map(([label, value, status]) => `
          <div>
            <span>${escape(label)}</span>
            ${statusPill(status).replace(statusLabel(status), escape(value))}
          </div>
        `).join("")}
      </div>
    `;
  }

  function actionButton(label, icon, target, tone) {
    return `
      <button type="button" class="${tone ? `is-${tone}` : ""}" data-panel-jump="${escape(target)}">
        <i class="fa-solid ${escape(icon)}"></i>
        <span>${escape(label)}</span>
      </button>
    `;
  }

  function growthActionButton(label, icon, action, tone) {
    return `
      <button type="button" class="${tone ? `is-${tone}` : ""}" data-growth-action="${escape(action)}">
        <i class="fa-solid ${escape(icon)}"></i>
        <span>${escape(label)}</span>
      </button>
    `;
  }

  function renderActionCenter() {
    const target = $("[data-action-center]");
    if (!target) return;
    const metrics = state.metrics || {};
    const actions = [];
    if (Number(metrics.refund_cancellation_pending_count || 0) > 0 || Number(metrics.refund_cancellation_dispute_count || 0) > 0) {
      actions.push(["İade / iptal incele", "fa-rotate-left", "refunds", "primary"]);
    }
    if (!state.products.length) actions.push(["İlk ürünü ekle", "fa-box-open", "products", "primary"]);
    if (productAttentionCount() > 0) actions.push(["Ürün kalite kontrolü", "fa-shield-halved", "products", "primary"]);
    if (!state.integrations.length) actions.push(["Entegrasyon bağla", "fa-plug-circle-bolt", "integrations", "primary"]);
    if (!state.paymentIntents.length) actions.push(["Ödeme isteği oluştur", "fa-qrcode", "payments", "primary"]);
    if (!state.campaigns.length) actions.push(["Promosyon planla", "fa-tags", "growth", ""]);
    if (Number(metrics.open_order_count || 0) > 0) actions.push(["Siparişleri güncelle", "fa-truck-fast", "orders", ""]);
    actions.push(["Raporları incele", "fa-chart-simple", "reports", ""]);
    if (!actions.length) {
      actions.push(["Performansı incele", "fa-chart-line", "finance", "primary"], ["Destek merkezini aç", "fa-headset", "support", ""]);
    }
    target.innerHTML = actions.slice(0, 6).map((item) => actionButton(...item)).join("");
  }

  function numeric(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  }

  function countByStatus(items, statuses) {
    const wanted = new Set(statuses);
    return (items || []).filter((item) => wanted.has(String(item.status || item.request_status || "").toLowerCase())).length;
  }

  function productAttentionCount() {
    const reviewStatuses = new Set(["pending", "needs_review", "needs_revision", "revision_required", "review", "in_review", "rejected"]);
    const productStatuses = new Set(["draft", "pending", "review", "in_review", "needs_review", "needs_revision", "revision_required", "rejected"]);
    return (state.products || []).filter((product) => (
      reviewStatuses.has(String(product.compliance_review_status || "").toLowerCase())
      || productStatuses.has(String(product.status || "").toLowerCase())
      || numeric(product.price) <= 0
      || numeric(product.stock) <= 5
    )).length;
  }

  function integrationAttentionCount() {
    const warningCount = (state.integrationWarnings || []).length;
    const integrationCount = countByStatus(state.integrations, ["needs_attention", "disabled", "paused"]);
    const runCount = (state.integrationRuns || []).slice(0, 8).filter((run) => {
      const status = String(run.status || "").toLowerCase();
      return ["failed", "partial"].includes(status) || numeric(run.failed_count) > 0 || numeric(run.warning_count) > 0;
    }).length;
    return warningCount + integrationCount + runCount;
  }

  function campaignAttentionCount() {
    return countByStatus(state.campaigns, ["draft", "pending", "review", "queued"]);
  }

  function notificationBuckets() {
    const metrics = state.metrics || {};
    const onboarding = onboardingItems().filter((item) => !item.done).length;
    const support = Math.max(
      numeric(metrics.open_ticket_count),
      countByStatus(state.tickets, ["open", "waiting", "in_progress"])
    );
    const refunds = numeric(metrics.refund_cancellation_pending_count) + numeric(metrics.refund_cancellation_dispute_count);
    const productAttention = productAttentionCount();
    const campaignAttention = campaignAttentionCount();
    const integrationAttention = integrationAttentionCount();
    const settings = (state.partnerWarnings || []).length + (state.refundWarnings || []).length;
    const buckets = {
      onboarding: { count: onboarding, tone: "info", label: `${onboarding} kurulum adımı bekliyor` },
      payments: { count: numeric(metrics.awaiting_payment_count), tone: "info", label: `${numeric(metrics.awaiting_payment_count)} ödeme işlemi bekliyor` },
      products: { count: productAttention, tone: "warning", label: "Ürünlerde kontrol bekleyen kayıt var" },
      integrations: { count: integrationAttention, tone: "warning", label: "Entegrasyon uyarısı var" },
      orders: { count: numeric(metrics.open_order_count), tone: "info", label: `${numeric(metrics.open_order_count)} açık sipariş var` },
      refunds: { count: refunds, tone: "critical", label: `${refunds} iade/iptal aksiyonu bekliyor` },
      finance: { count: numeric(metrics.payout_pending) > 0 ? 1 : 0, tone: "info", label: "Hakediş raporu güncel" },
      growth: { count: campaignAttention, tone: "info", label: "Promosyon/fiyat planlama sinyali var" },
      reports: { count: productAttention + numeric(metrics.open_order_count) + refunds, tone: productAttention || refunds ? "warning" : "info", label: "Raporlarda takip edilmesi gereken veri var" },
      customers: { count: support + refunds, tone: refunds ? "critical" : "warning", label: "Müşteri ve destek aksiyonu bekliyor" },
      ads: { count: campaignAttention || (numeric(metrics.active_product_count) > 0 && !state.campaigns.length ? 1 : 0), tone: "info", label: "Reklam veya kampanya planı bekliyor" },
      development: { count: onboarding + productAttention + integrationAttention, tone: productAttention || integrationAttention ? "warning" : "info", label: "Gelişim planında bekleyen adım var" },
      operations: { count: numeric(metrics.open_order_count), tone: "info", label: "Operasyon güncellemesi bekliyor" },
      support: { count: support, tone: "warning", label: `${support} açık destek bildirimi var` },
      settings: { count: settings, tone: "critical", label: "Sistem veya veri erişimi uyarısı var" }
    };
    const dashboardSummaryBuckets = new Set(["onboarding", "reports", "customers", "ads", "development"]);
    buckets.dashboard = {
      count: Object.entries(buckets).reduce((total, [key, item]) => dashboardSummaryBuckets.has(key) ? total : total + numeric(item.count), 0),
      tone: Object.values(buckets).some((item) => item.tone === "critical" && numeric(item.count) > 0) ? "critical" : "warning",
      label: "Panelde okunmamış operasyon bildirimi var"
    };
    return buckets;
  }

  function navButtonLabel(button) {
    const label = Array.from(button.children).find((child) => (
      child.tagName === "SPAN" && !child.classList.contains("partner-os-nav-badge")
    ));
    return label?.textContent?.trim() || button.dataset.panelTarget || "Bölüm";
  }

  function setNavBadge(button, notification) {
    if (!button) return;
    const count = numeric(notification?.count);
    let badge = button.querySelector(".partner-os-nav-badge");
    if (!count) {
      if (badge) badge.remove();
      button.classList.remove("has-notification", "has-critical-notification");
      button.removeAttribute("data-notification-count");
      button.removeAttribute("title");
      button.setAttribute("aria-label", navButtonLabel(button));
      return;
    }
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "partner-os-nav-badge";
      badge.setAttribute("aria-hidden", "true");
      button.appendChild(badge);
    }
    const label = navButtonLabel(button);
    const display = count > 99 ? "99+" : String(count);
    const description = notification.label || `${display} bildirim var`;
    badge.textContent = display;
    button.dataset.notificationCount = display;
    button.classList.add("has-notification");
    button.classList.toggle("has-critical-notification", notification.tone === "critical");
    button.title = `${label}: ${description}`;
    button.setAttribute("aria-label", `${label}: ${description}`);
  }

  function renderNotificationBadges() {
    const buckets = notificationBuckets();
    $all("[data-panel-target]").forEach((button) => {
      setNavBadge(button, buckets[button.dataset.panelTarget]);
    });
  }

  function renderAnnouncements() {
    const target = $("[data-announcement-list]");
    if (!target) return;
    const announcements = [
      { title: "Partner MFA zorunlu", body: "Partner girişleri iki aşamalı doğrulama ile korunuyor.", status: "active" },
      { title: "Kampanya planlayıcı hazır", body: "Kupon, vitrin reklamı ve HP sadakat planlarını büyüme merkezinde oluştur.", status: "pending" },
      { title: "QR/NFC ödeme merkezi", body: "Tahsilat linki, QR ve SoftPOS akışları tek ekranda izlenir.", status: "active" }
    ];
    target.innerHTML = announcements.map((item) => `
      <article class="partner-os-list-item">
        <div><strong>${escape(item.title)}</strong><span>${escape(item.body)}</span></div>
        <em>${escape(statusLabel(item.status))}</em>
      </article>
    `).join("");
  }

  function onboardingItems() {
    const business = state.business || {};
    const metrics = state.metrics || {};
    return [
      {
        title: "Partner profilini tamamla",
        body: "Görünen ad, yasal unvan, telefon, şehir, logo ve açıklama bilgileri.",
        done: Boolean(business.display_name && business.phone && business.city),
        target: "settings"
      },
      {
        title: "MFA güvenliğini doğrula",
        body: "Partner paneline erişim için iki aşamalı doğrulama kullan.",
        done: true,
        target: "settings"
      },
      {
        title: "İlk ürün veya hizmeti ekle",
        body: "Katalog, stok, fiyat, görsel ve açıklama alanlarını doldur.",
        done: Number(metrics.active_product_count || 0) > 0,
        target: "products"
      },
      {
        title: "Ürün akışını bağla",
        body: "CSV, JSON veya WooCommerce bağlantısını ücretsiz başlangıç paketinde hazırla.",
        done: state.integrations.length > 0,
        target: "integrations"
      },
      {
        title: "Ödeme kanalını dene",
        body: "QR, ödeme linki veya NFC SoftPOS için test ödeme isteği oluştur.",
        done: state.paymentIntents.length > 0,
        target: "payments"
      },
      {
        title: "İlk kampanyanı planla",
        body: "Kupon, HP sadakat veya sponsorlu görünürlük kampanyası hazırla.",
        done: state.campaigns.length > 0,
        target: "growth"
      }
    ];
  }

  function renderOnboarding() {
    const target = $("[data-onboarding-list]");
    const scoreTarget = $("[data-onboarding-score]");
    if (!target) return;
    const items = onboardingItems();
    const doneCount = items.filter((item) => item.done).length;
    const percent = Math.round((doneCount / items.length) * 100);
    if (scoreTarget) scoreTarget.textContent = `%${percent} tamamlandı`;
    target.innerHTML = items.map((item) => `
      <article class="partner-os-onboarding-item ${item.done ? "is-done" : ""}">
        <i class="fa-solid ${item.done ? "fa-circle-check" : "fa-circle"}"></i>
        <div>
          <strong>${escape(item.title)}</strong>
          <span>${escape(item.body)}</span>
        </div>
        <button type="button" data-panel-jump="${escape(item.target)}">${item.done ? "Aç" : "Tamamla"}</button>
      </article>
    `).join("");
  }

  function normalizeModuleKey(value) {
    const key = String(value || "").trim().toLocaleLowerCase("tr-TR");
    const aliases = {
      allonashop: "shop",
      product: "shop",
      products: "shop",
      urun: "shop",
      "ürün": "shop",
      marketplace: "shop",
      grocery: "market",
      supermarket: "market",
      "süpermarket": "market",
      restaurant: "food",
      restoran: "food",
      yemek: "food",
      menu: "food",
      menü: "food",
      services: "service",
      hizmet: "service",
      ecosystem: "service"
    };
    return MODULE_PROFILES[key] ? key : aliases[key] || "";
  }

  function defaultModuleForPartnerType() {
    const businessType = String(state.business?.partner_type || "").toLocaleLowerCase("tr-TR");
    return normalizeModuleKey(businessType) || "shop";
  }

  function parseMaybeJson(value) {
    if (!value || typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }

  function businessMetadata() {
    return parseMaybeJson(state.business?.metadata)
      || parseMaybeJson(state.business?.settings)
      || parseMaybeJson(state.business?.module_permissions)
      || {};
  }

  function collectModuleCandidates() {
    const business = state.business || {};
    const metadata = businessMetadata();
    return [
      business.allowed_modules,
      business.enabled_modules,
      business.modules,
      business.module_permissions,
      metadata.allowed_modules,
      metadata.enabled_modules,
      metadata.modules,
      metadata.module_permissions,
      metadata.partner_modules
    ].map(parseMaybeJson).filter(Boolean);
  }

  function moduleAccessMap() {
    const access = Object.keys(MODULE_PROFILES).reduce((map, key) => {
      map[key] = false;
      return map;
    }, {});
    let hasExplicitAccess = false;

    collectModuleCandidates().forEach((candidate) => {
      if (Array.isArray(candidate)) {
        candidate.forEach((item) => {
          const key = normalizeModuleKey(typeof item === "object" ? item.key || item.module || item.name : item);
          const enabled = !(item && typeof item === "object" && (item.enabled === false || item.write === false || item.status === "disabled"));
          if (key) {
            access[key] = enabled;
            hasExplicitAccess = true;
          }
        });
        return;
      }
      if (candidate && typeof candidate === "object") {
        Object.entries(candidate).forEach(([rawKey, rawValue]) => {
          const key = normalizeModuleKey(rawKey);
          const enabled = rawValue === true
            || rawValue === "true"
            || rawValue === "enabled"
            || rawValue === "active"
            || rawValue === "write"
            || rawValue === "manage"
            || rawValue === 1
            || (rawValue && typeof rawValue === "object" && rawValue.enabled !== false && rawValue.write !== false);
          if (key) {
            access[key] = Boolean(enabled);
            hasExplicitAccess = true;
          }
        });
      }
    });

    if (!hasExplicitAccess) access[defaultModuleForPartnerType()] = true;
    return access;
  }

  function enabledScopes() {
    const access = moduleAccessMap();
    return Object.keys(MODULE_PROFILES).filter((key) => access[key]);
  }

  function isModuleEnabled(scope) {
    return Boolean(moduleAccessMap()[normalizeModuleKey(scope)]);
  }

  function currentCatalogScope() {
    return enabledScopes()[0] || defaultModuleForPartnerType();
  }

  function catalogProfile(scope) {
    return MODULE_PROFILES[scope] || MODULE_PROFILES.shop;
  }

  function renderModuleAccess() {
    const target = $("[data-module-access]");
    if (!target) return;
    const access = moduleAccessMap();
    target.innerHTML = Object.entries(MODULE_PROFILES).map(([key, profile]) => {
      const enabled = Boolean(access[key]);
      return `
        <article class="partner-os-module-card ${enabled ? "is-enabled" : "is-locked"}">
          <i class="fa-solid ${enabled ? "fa-unlock-keyhole" : "fa-lock"}"></i>
          <div>
            <strong>${escape(profile.label)}</strong>
            <span>${enabled ? "Admin tarafından açık; katalog ve yükleme aktif." : "Görünür, ancak ekleme ve düzenleme kapalı."}</span>
          </div>
          <em>${enabled ? "Açık" : "Kilitli"}</em>
        </article>
      `;
    }).join("");
  }

  function applyModulePermissions() {
    const form = $("[data-product-form]");
    const access = moduleAccessMap();
    const scope = currentCatalogScope();
    const profile = catalogProfile(scope);
    const addButton = $("[data-product-add]");
    if (addButton) {
      const label = addButton.querySelector("span");
      if (label) label.textContent = profile.typeLabels[1];
    }
    if (!form) return;
    if (form.elements.catalog_scope) {
      $all("option", form.elements.catalog_scope).forEach((option) => {
        const key = normalizeModuleKey(option.value);
        option.disabled = !access[key];
        option.textContent = `${catalogProfile(key).label}${access[key] ? "" : " (kilitli)"}`;
      });
      form.elements.catalog_scope.value = scope;
    }
    const nameLabel = form.querySelector("label:first-child span");
    if (nameLabel) nameLabel.textContent = `${profile.typeLabels[0]} adı`;
  }

  function applyCatalogProfile() {
    const scope = currentCatalogScope();
    const profile = catalogProfile(scope);
    const storeLink = $("[data-partner-store-link]");
    const storeLabel = $("[data-partner-store-label]");
    const productForm = $("[data-product-form]");
    if (storeLink) storeLink.href = profile.href;
    if (storeLabel) storeLabel.textContent = `${profile.shortLabel} Vitrinine Git`;
    applyModulePermissions();
    renderModuleAccess();
    if (!productForm || productForm.dataset.catalogProfileReady === "true") return;
    if (productForm.elements.catalog_scope) productForm.elements.catalog_scope.value = scope;
    if (productForm.elements.category && !productForm.elements.category.value) productForm.elements.category.placeholder = profile.category;
    if (productForm.elements.brand && !productForm.elements.brand.value) productForm.elements.brand.placeholder = profile.brand;
    if (productForm.elements.image_url && !productForm.elements.image_url.value) productForm.elements.image_url.placeholder = profile.image;
    productForm.dataset.catalogProfileReady = "true";
  }

  function renderRecommendations() {
    const target = $("[data-partner-recommendations]");
    if (!target) return;
    const items = state.recommendations && state.recommendations.length
      ? state.recommendations
      : [{ title: "Partner OS hazır", body: "Ödeme, katalog, sipariş ve finans verileri tek panelde görünür.", action: "Başla" }];
    target.innerHTML = items.map((item) => `
      <article class="partner-os-rec">
        <div>
          <strong>${escape(item.title)}</strong>
          <span>${escape(item.body)}</span>
        </div>
        <em>${escape(item.action || "Aç")}</em>
      </article>
    `).join("");
  }

  function renderRecentPayments() {
    const target = $("[data-recent-payments]");
    if (!target) return;
    const items = state.paymentIntents.slice(0, 5);
    if (!items.length) {
      target.innerHTML = emptyList("Henüz ödeme isteği yok", "QR, NFC veya link ile ilk tahsilatı oluştur.");
      return;
    }
    target.innerHTML = items.map((item) => `
      <article class="partner-os-list-item">
        <div>
          <strong>${escape(channelLabel(item.channel))} · ${money(item.amount)}</strong>
          <span>${escape(item.description || item.provider || "Ödeme isteği")} · ${formatDate(item.created_at)}</span>
        </div>
        <em>${escape(statusLabel(item.status))}</em>
      </article>
    `).join("");
  }

  function channelLabel(channel) {
    const labels = {
      qr: "QR",
      nfc: "NFC",
      payment_link: "Link",
      web_pos: "Web POS",
      physical_pos: "Fiziksel POS",
      cash: "Nakit",
      wallet: "Cüzdan"
    };
    return labels[channel] || channel || "-";
  }

  function emptyList(title, body) {
    return `
      <article class="partner-os-list-item">
        <div>
          <strong>${escape(title)}</strong>
          <span>${escape(body)}</span>
        </div>
      </article>
    `;
  }

  function renderPaymentRows() {
    const target = $("[data-payment-rows]");
    if (!target) return;
    if (!state.paymentIntents.length) {
      target.innerHTML = `<tr><td colspan="5">Henüz ödeme isteği yok.</td></tr>`;
      return;
    }
    target.innerHTML = state.paymentIntents.map((intent) => `
      <tr>
        <td>${escape(channelLabel(intent.channel))}</td>
        <td>${money(intent.amount)}</td>
        <td>${statusPill(intent.status)}</td>
        <td>${escape(providerLabel(intent.provider))}</td>
        <td>${formatDate(intent.created_at)}</td>
      </tr>
    `).join("");
  }

  function providerLabel(provider) {
    const labels = {
      allonapay: "AllonaPay",
      bank_checkout: "Banka Checkout",
      bank_payment_link: "Banka Ödeme Linki",
      bank_softpos: "Banka SoftPOS",
      visa_tap_to_phone: "Visa Tap to Phone",
      mastercard_tap_on_phone: "Mastercard Tap on Phone",
      bank_pos: "Banka POS",
      manual: "Manuel"
    };
    return labels[provider] || provider || "-";
  }

  function productQualitySignal(product) {
    const status = String(product.status || "").toLowerCase();
    const reviewStatus = String(product.compliance_review_status || product.review_status || product.moderation_status || "").toLowerCase();
    if (["needs_revision", "revision_required"].includes(status) || ["needs_revision", "revision_required"].includes(reviewStatus)) {
      return { label: "Revize gerekli", status: "failed", action: "Eksik/riskli alanları düzelt" };
    }
    if (["rejected", "blocked", "suspended"].includes(status) || reviewStatus === "rejected") {
      return { label: "Yayına kapalı", status: "failed", action: "Ret gerekçesini incele" };
    }
    if (numeric(product.price) <= 0) return { label: "Fiyat eksik", status: "failed", action: "Fiyat gir" };
    if (numeric(product.stock) <= 0) return { label: "Stok yok", status: "failed", action: "Stok ekle" };
    if (numeric(product.stock) <= 5) return { label: "Kritik stok", status: "pending", action: "Stok güncelle" };
    if (["draft", "pending", "review", "in_review"].includes(status) || ["pending", "review", "in_review", "needs_review"].includes(reviewStatus)) {
      return { label: "Onay bekliyor", status: "pending", action: "Onay sürecini takip et" };
    }
    return { label: "Satışa hazır", status: "active", action: "Performansı izle" };
  }

  function renderProducts() {
    renderProductSummary();
    const target = $("[data-product-rows]");
    if (!target) return;
    if (!state.products.length) {
      target.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="partner-os-empty-row">
              <strong>Henüz ürün veya hizmet eklenmedi.</strong>
              <span>İlk ürününü eklediğinde burada fiyat, stok, durum ve yayın sinyaliyle birlikte görünecek.</span>
              <button type="button" data-product-add><i class="fa-solid fa-plus"></i><span>Ürün ekle</span></button>
            </div>
          </td>
        </tr>
      `;
      return;
    }
    target.innerHTML = state.products.slice(0, 12).map((raw) => {
      const product = core.normalizeProduct(raw);
      const signalInfo = productQualitySignal(product);
      const image = product.image_url || "/images/product-fallback.svg";
      const sku = raw.sku || product.sku || raw.external_sku || "-";
      const barcode = raw.barcode || raw.gtin || raw.ean || "";
      const modelCode = raw.model_code || raw.external_product_id || raw.product_model_code || "";
      const variant = [raw.color, raw.colour, raw.size, raw.variant_name, raw.variant_value].filter(Boolean).join(" · ");
      const detailUrl = `/pages/partner/partner-product-detail.html?id=${encodeURIComponent(product.id || raw.id || "")}`;
      return `
        <tr>
          <td>
            <div class="partner-os-product-cell">
              <img src="${escape(image)}" alt="${escape(product.name)}" loading="lazy" onerror="this.src='/images/product-fallback.svg'">
              <div>
                <strong>${escape(product.name)}</strong>
                <span>${escape([product.category, product.brand].filter(Boolean).join(" · ") || "Kategori bekliyor")}</span>
                ${variant ? `<small>${escape(variant)}</small>` : ""}
              </div>
            </div>
          </td>
          <td>
            <strong>${escape(sku)}</strong>
            <span class="partner-os-muted-line">${escape(barcode ? `Barkod: ${barcode}` : "Barkod bekliyor")}</span>
            ${modelCode ? `<span class="partner-os-muted-line">${escape(`Model: ${modelCode}`)}</span>` : ""}
          </td>
          <td><strong>${money(product.price)}</strong><span class="partner-os-muted-line">Müşteri fiyatı</span></td>
          <td>${statusPill(product.status)}</td>
          <td>${statusPill(signalInfo.status).replace(statusLabel(signalInfo.status), escape(signalInfo.label))}</td>
          <td>
            <a class="partner-os-mini-action" href="${escape(detailUrl)}"><i class="fa-solid fa-pen-to-square"></i><span>Düzenle</span></a>
          </td>
        </tr>
      `;
    }).join("") + (state.products.length > 12 ? `
      <tr>
        <td colspan="6">
          <a class="partner-os-table-more" href="/pages/partner/partner-products.html">
            <i class="fa-solid fa-table-list"></i>
            <span>${escape(state.products.length - 12)} ürün daha var; gelişmiş ürün listesinde aç</span>
          </a>
        </td>
      </tr>
    ` : "");
  }

  function renderProductSummary() {
    const target = $("[data-product-summary]");
    if (!target) return;
    const products = state.products.map((item) => core.normalizeProduct(item));
    const active = products.filter((item) => item.status === "active").length;
    const waiting = products.filter((item) => ["draft", "pending", "review"].includes(item.status)).length;
    const lowStock = products.filter((item) => Number(item.stock || 0) <= 5).length;
    const stats = [
      ["Ürünlerim", products.length, "Toplam kayıt"],
      ["Yayında", active, "Aktif ürün/hizmet"],
      ["Onay bekleyen", waiting, "Taslak ve inceleme"],
      ["Stok uyarısı", lowStock, "5 ve altı stok"]
    ];
    target.innerHTML = stats.map(([label, value, hint]) => `
      <article>
        <span>${escape(label)}</span>
        <strong>${escape(value)}</strong>
        <small>${escape(hint)}</small>
      </article>
    `).join("");
  }

  function setProductView(view, options) {
    const nextView = view === "add" ? "add" : "list";
    state.productView = nextView;
    $all("[data-product-view-panel]").forEach((panel) => {
      const active = panel.dataset.productViewPanel === nextView;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
    $all("[data-product-view-target]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.productViewTarget === nextView);
    });
    if (nextView === "add" && options?.focusForm) {
      const form = $("[data-product-form]");
      if (form?.elements?.name) form.elements.name.focus();
    }
  }

  function integrationConnectors() {
    const source = state.integrationConnectors.length ? state.integrationConnectors : DEFAULT_INTEGRATION_CONNECTORS;
    return [...source].sort((a, b) => Number(a.sort_order || 100) - Number(b.sort_order || 100));
  }

  function integrationConnector(provider) {
    return integrationConnectors().find((item) => item.provider === provider) || { provider, label: provider || "-", active_now: false };
  }

  function integrationProviderLabel(provider) {
    return integrationConnector(provider).label || provider || "-";
  }

  function integrationPolicy() {
    return state.integrationPolicy || {};
  }

  function currentIntegrationMode() {
    const active = $("[data-integration-mode].is-active");
    return active && active.dataset.integrationMode === "full" ? "full" : "import";
  }

  function partnerHasFullIntegrationAccess() {
    const policy = integrationPolicy();
    return Boolean(policy.premium_enabled && policy.full_integration_enabled && ["premium", "enterprise"].includes(policy.partner_plan_tier));
  }

  function integrationPremiumUrl(plan) {
    const selectedPlan = plan || "pro";
    const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}#integrations`);
    return `partner-integration-premium.html?plan=${encodeURIComponent(selectedPlan)}&returnTo=${returnTo}`;
  }

  function openIntegrationPremium(plan) {
    window.location.href = integrationPremiumUrl(plan);
  }

  function setIntegrationMode(mode) {
    const selected = mode === "full" ? "full" : "import";
    $all("[data-integration-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.integrationMode === selected);
    });
    const exportInput = $("[data-integration-export-enabled]");
    if (exportInput) exportInput.value = selected === "full" ? "true" : "false";
    renderIntegrationModeNote();
  }

  function renderIntegrationModeNote() {
    const target = $("[data-integration-note]");
    if (!target) return;
    const mode = currentIntegrationMode();
    const policy = integrationPolicy();
    if (mode === "full") {
      const unlocked = partnerHasFullIntegrationAccess();
      target.innerHTML = `
        <strong>Tam Entegrasyon ${unlocked ? "aktif" : "premium gerektirir"}</strong>
        <span>Tam entegrasyon, buradan entegre olarak buraya yüklediğiniz ürünün API'sini girdiğiniz tüm platformlara yayılmasını sağlayacak bir entegrasyon platformudur. Bunu elde etmek için premium üyelik elde etmeniz gerekiyor.</span>
        ${unlocked ? "" : `<a class="partner-os-inline-link" href="${escape(integrationPremiumUrl("pro"))}">Premium paketleri gör</a>`}
        ${policy.outbound_enabled ? "" : "<em>Dış platformlara yayın şu anda operasyon onayı bekliyor.</em>"}
      `;
      target.classList.add("is-premium");
      return;
    }
    target.innerHTML = `
      <strong>Ürünleri Çek ücretsiz</strong>
      <span>Partner kazanımı için dış platform, mağaza veya feed ürünlerini AllonaHub kataloğuna çekme ücretsizdir. Ürünler güvenlik için taslak/kontrol akışına alınır.</span>
    `;
    target.classList.remove("is-premium");
  }

  function integrationStageLabel(connector) {
    if (connector.active_now) return connector.outbound_active_now ? "Tam entegrasyon açık" : "Ürün çekme ücretsiz";
    if (connector.stage === "premium_ready") return "Premium hazır";
    if (connector.stage === "planned") return "Planlı";
    return statusLabel(connector.stage || "pending");
  }

  function renderIntegrationProviderOptions() {
    const select = $("[data-integration-provider]");
    if (!select) return;
    const connectors = integrationConnectors();
    select.innerHTML = connectors.map((connector) => `
      <option value="${escape(connector.provider)}" ${connector.active_now ? "" : "disabled"}>
        ${escape(connector.label)}${connector.active_now ? "" : " (yakında)"}
      </option>
    `).join("");
    applyIntegrationCredentialHints();
  }

  function applyIntegrationCredentialHints() {
    const provider = $("[data-integration-provider]")?.value || "generic_feed";
    const hints = INTEGRATION_CREDENTIAL_HINTS[provider] || INTEGRATION_CREDENTIAL_HINTS.generic_feed;
    const sourceLabel = $("[data-integration-source-label]");
    const sourceInput = $("[data-integration-source-input]");
    const keyLabel = $("[data-integration-key-label]");
    const keyInput = $("[data-integration-key-input]");
    const secretLabel = $("[data-integration-secret-label]");
    const secretInput = $("[data-integration-secret-input]");
    if (sourceLabel) sourceLabel.textContent = hints.sourceLabel;
    if (sourceInput) sourceInput.placeholder = hints.sourcePlaceholder;
    if (keyLabel) keyLabel.textContent = hints.keyLabel;
    if (keyInput) keyInput.placeholder = hints.keyPlaceholder;
    if (secretLabel) secretLabel.textContent = hints.secretLabel;
    if (secretInput) secretInput.placeholder = hints.secretPlaceholder;
  }

  function renderIntegrationConnectors() {
    const target = $("[data-integration-connectors]");
    if (!target) return;
    target.innerHTML = integrationConnectors().map((connector) => {
      const enabled = Boolean(connector.active_now);
      const status = enabled ? "active" : connector.stage || "pending";
      return `
        <article class="partner-os-integration-card ${enabled ? "is-enabled" : "is-locked"}">
          <i class="fa-solid ${enabled ? "fa-plug-circle-bolt" : "fa-lock"}"></i>
          <div>
            <strong>${escape(connector.label)}</strong>
            <span>${escape(integrationStageLabel(connector))} · ${escape(connector.outbound_active_now ? "Çift yönlü" : "İçe aktarım")}</span>
          </div>
          ${statusPill(status)}
        </article>
      `;
    }).join("");
  }

  function renderIntegrationRows() {
    const target = $("[data-integration-rows]");
    if (!target) return;
    if (!state.integrations.length) {
      target.innerHTML = emptyList("Bağlantı yok", "CSV/JSON feed veya WooCommerce ile ilk ürün akışını bağla.");
      return;
    }
    target.innerHTML = state.integrations.map((integration) => {
      const connector = integrationConnector(integration.provider);
      const secretKeys = (integration.secrets || []).map((item) => item.secret_key).join(", ");
      const policy = integrationPolicy();
      const canApply = Boolean(policy.apply_enabled) && !["paused", "disabled", "archived"].includes(integration.status);
      return `
        <article class="partner-os-integration-row">
          <div>
            <strong>${escape(integration.display_name || integrationProviderLabel(integration.provider))}</strong>
            <span>${escape(connector.label)} · ${escape(integration.sync_mode || "manual")} · ${escape(secretKeys || "secret bekliyor")} · ${escape(policy.force_draft_on_apply ? "taslak aktarım" : "yayın ayarı geçerli")}</span>
          </div>
          <div class="partner-os-integration-row-actions">
            ${statusPill(integration.status || "draft")}
            <button type="button" data-integration-test="${escape(integration.id)}"><i class="fa-solid fa-vial"></i><span>Test</span></button>
            <button type="button" data-integration-preview="${escape(integration.id)}"><i class="fa-solid fa-eye"></i><span>Önizle</span></button>
            ${canApply ? `<button type="button" data-integration-sync="${escape(integration.id)}"><i class="fa-solid fa-cloud-arrow-down"></i><span>Ürünleri Çek</span></button>` : ""}
          </div>
        </article>
      `;
    }).join("");
  }

  function renderIntegrationRuns() {
    const target = $("[data-integration-runs]");
    if (!target) return;
    if (!state.integrationRuns.length) {
      target.innerHTML = emptyList("Senkron yok", "Bağlantı testinden sonra önizleme çalıştır.");
      return;
    }
    target.innerHTML = state.integrationRuns.slice(0, 10).map((run) => {
      const preview = Array.isArray(run.summary?.preview) ? run.summary.preview : [];
      const summaryErrors = Array.isArray(run.summary?.errors) ? run.summary.errors : [];
      const pageInfo = run.summary?.page_info || {};
      const duplicateCount = Number(run.summary?.duplicate_count || 0);
      const pageLine = pageInfo.provider
        ? `Sayfa ${pageInfo.current_page ?? pageInfo.requested_page ?? 0} · ${pageInfo.rows || 0} kaynak kayıt${pageInfo.exhausted ? " · kaynak sonuna gelindi" : pageInfo.next_page !== null && pageInfo.next_page !== undefined ? ` · sıradaki sayfa ${pageInfo.next_page}` : ""}`
        : "";
      const canApplyPreview = run.run_mode === "preview" && ["success", "partial"].includes(run.status) && run.integration_id;
      return `
        <article class="partner-os-integration-run">
          <div>
            <strong>${escape(integrationProviderLabel(state.integrations.find((item) => item.id === run.integration_id)?.provider))} · ${escape(run.run_mode || "preview")}</strong>
            <span>${escape(formatDate(run.started_at))} · ${escape(run.checked_count || 0)} kayıt · ${escape(run.created_count || 0)} yeni · ${escape(run.updated_count || 0)} güncel · ${escape(run.skipped_count || 0)} aynı · ${escape(run.failed_count || 0)} hata</span>
            ${pageLine ? `<small>${escape(pageLine)}</small>` : ""}
            ${duplicateCount ? `<small>${escape(duplicateCount)} tekrar eden kaynak satırı tek ürün olarak işlendi.</small>` : ""}
            ${preview.length ? `<small>${preview.slice(0, 3).map((item) => `${escape(item.name)}${item.compliance_status ? ` (${escape(statusLabel(item.compliance_status))})` : ""}`).join(", ")}</small>` : ""}
            ${run.warning_count ? `<small>${escape(run.warning_count)} uyarı kontrol bekliyor.</small>` : ""}
            ${summaryErrors.length ? `<small>${summaryErrors.slice(0, 2).map((item) => escape(item.message || item.external_product_id || "Ürün işlenemedi")).join(" · ")}</small>` : ""}
            ${run.error_message ? `<small>${escape(run.error_message)}</small>` : ""}
          </div>
          <div class="partner-os-integration-row-actions">
            ${statusPill(run.status || "queued")}
            ${canApplyPreview ? `<button type="button" data-integration-apply="${escape(run.integration_id)}"><i class="fa-solid fa-cloud-arrow-down"></i><span>Kataloğa Aktar</span></button>` : ""}
          </div>
        </article>
      `;
    }).join("");
  }

  function renderIntegrations() {
    renderIntegrationModeNote();
    renderIntegrationProviderOptions();
    renderIntegrationConnectors();
    renderIntegrationRows();
    renderIntegrationRuns();
  }

  function orderItems(order) {
    return order.partner_items || order.order_items || [];
  }

  function orderNo(order) {
    return order.order_no || order.order_number || order.id || "-";
  }

  function orderCustomer(order) {
    return order.customer_name || order.buyer_name || order.customer_email || order.shipping_name || "-";
  }

  function orderCodeText(order) {
    return [
      order.tracking_number,
      order.cargo_tracking_number,
      order.shipment_tracking_number,
      ...orderItems(order).flatMap((item) => [
        item.barcode,
        item.sku,
        item.stock_code,
        item.product?.barcode,
        item.product?.sku
      ])
    ].filter(Boolean).join(" ");
  }

  function orderText(order) {
    return [
      orderNo(order),
      orderCustomer(order),
      order.customer_email,
      order.customer_phone,
      orderItems(order).map((item) => item.product_name || item.product?.name || "Ürün").join(" ")
    ].filter(Boolean).join(" ");
  }

  function orderMatchesFilter(order) {
    const filters = state.orderFilters || {};
    const search = String(filters.search || "").trim().toLocaleLowerCase("tr-TR");
    const code = String(filters.code || "").trim().toLocaleLowerCase("tr-TR");
    const status = String(filters.status || "all").trim();
    const quick = String(filters.quick || "all").trim();
    const orderStatus = String(order.order_status || order.status || "").trim();
    const searchOk = !search || orderText(order).toLocaleLowerCase("tr-TR").includes(search);
    const codeOk = !code || orderCodeText(order).toLocaleLowerCase("tr-TR").includes(code);
    const statusOk = status === "all" || orderStatus === status;
    const hasTracking = Boolean(order.tracking_number || order.cargo_tracking_number || order.shipment_tracking_number);
    const quickOk = quick === "missing_tracking"
      ? ["confirmed", "preparing", "shipped"].includes(orderStatus) && !hasTracking
      : true;
    return searchOk && codeOk && statusOk && quickOk;
  }

  function filteredOrders() {
    return (state.orders || []).filter(orderMatchesFilter);
  }

  function renderOrderSummary() {
    const target = $("[data-order-summary]");
    if (!target) return;
    const rows = state.orders || [];
    const filtered = filteredOrders();
    const open = rows.filter((order) => ["confirmed", "preparing", "shipped"].includes(order.order_status || order.status)).length;
    const shipped = rows.filter((order) => (order.order_status || order.status) === "shipped").length;
    const delivered = rows.filter((order) => (order.order_status || order.status) === "delivered").length;
    const missingTracking = rows.filter((order) => ["confirmed", "preparing", "shipped"].includes(order.order_status || order.status) && !order.tracking_number && !order.cargo_tracking_number).length;
    const activeStatus = String(state.orderFilters.status || "all");
    const activeQuick = String(state.orderFilters.quick || "all");
    const cards = [
      { label: "Filtre sonucu", value: filtered.length, hint: `${rows.length} toplam sipariş`, tone: filtered.length ? "good" : "warn", status: "all", quick: "all" },
      { label: "Açık operasyon", value: open, hint: "Hazırlık/kargo/takip", tone: open ? "warn" : "good", status: "preparing", quick: "all" },
      { label: "Kargoda", value: shipped, hint: "Takip bekleyen gönderiler", tone: shipped ? "warn" : "good", status: "shipped", quick: "all" },
      { label: "Teslim", value: delivered, hint: "Tamamlanan sipariş", tone: delivered ? "good" : "warn", status: "delivered", quick: "all" },
      { label: "Takip no eksik", value: missingTracking, hint: "Kargo alanı kontrol edilmeli", tone: missingTracking ? "bad" : "good", status: "all", quick: "missing_tracking" }
    ];
    target.innerHTML = cards.map((card) => `
      <button type="button" class="partner-os-order-card is-${escape(card.tone)} ${activeStatus === card.status && activeQuick === card.quick ? "is-active" : ""}" data-order-card-status="${escape(card.status)}" data-order-card-quick="${escape(card.quick)}">
        <span>${escape(card.label)}</span>
        <strong>${escape(card.value)}</strong>
        <small>${escape(card.hint)}</small>
      </button>
    `).join("");
  }

  function exportOrders() {
    const rows = filteredOrders().map((order) => ({
      order_no: orderNo(order),
      customer: orderCustomer(order),
      products: orderItems(order).map((item) => item.product_name || item.product?.name || "Ürün").join(", "),
      total: order.partner_total || order.total || order.total_amount || 0,
      order_status: statusLabel(order.order_status || order.status),
      payment_status: statusLabel(order.payment_status || "pending"),
      tracking_number: order.tracking_number || order.cargo_tracking_number || "",
      created_at: order.created_at || ""
    }));
    downloadRows(rows, "allona-partner-siparis-kargo.xlsx", "SiparisKargo", [
      "order_no",
      "customer",
      "products",
      "total",
      "order_status",
      "payment_status",
      "tracking_number",
      "created_at"
    ]);
    toast(`${rows.length} sipariş Excel dosyasına hazırlandı.`);
  }

  function carrierLabel(value) {
    const labels = {
      allona: "Allona anlaşmalı",
      yurtici: "Yurtiçi / benzeri",
      mng: "MNG / benzeri",
      aras: "Aras / benzeri"
    };
    return labels[value] || value || "Kargo";
  }

  function cargoRate(value) {
    const rates = {
      allona: 24,
      yurtici: 29,
      mng: 28,
      aras: 27
    };
    return rates[value] || rates.allona;
  }

  function calculateCargoQuote(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const width = Math.max(1, numeric(data.width));
    const length = Math.max(1, numeric(data.length));
    const height = Math.max(1, numeric(data.height));
    const weight = Math.max(0, numeric(data.weight));
    const desi = Number(((width * length * height) / 3000).toFixed(2));
    const billedDesi = Math.max(1, Math.ceil(Math.max(desi, weight)));
    const base = cargoRate(data.carrier);
    const amount = Number((base + billedDesi * 11.5).toFixed(2));
    return {
      carrier: data.carrier || "allona",
      width,
      length,
      height,
      weight,
      desi,
      billedDesi,
      amount
    };
  }

  function renderCargoQuote(quote) {
    const target = $("[data-cargo-result]");
    if (!target || !quote) return;
    target.innerHTML = `
      <div class="partner-os-cargo-quote">
        <span>${escape(carrierLabel(quote.carrier))}</span>
        <strong>${money(quote.amount)}</strong>
        <small>Tahmini taşıma bedeli. Nihai fatura kargo firmasının ölçümüne göre oluşur.</small>
        <div>
          <article><b>${escape(quote.desi)}</b><em>Desi</em></article>
          <article><b>${escape(quote.weight)} kg</b><em>Ağırlık</em></article>
          <article><b>${escape(quote.billedDesi)}</b><em>Fatura desisi</em></article>
        </div>
      </div>
    `;
  }

  function renderOrders() {
    const target = $("[data-order-rows]");
    renderOrderSummary();
    if (!target) return;
    const rows = filteredOrders().slice(0, Number(state.orderFilters.pageSize || 50));
    if (!rows.length) {
      target.innerHTML = `<tr><td colspan="7">Bu filtrede sipariş görünmüyor.</td></tr>`;
      return;
    }
    target.innerHTML = rows.map((order) => {
      const items = orderItems(order);
      const tracking = order.tracking_number || order.cargo_tracking_number || "";
      const currentStatus = order.order_status || order.status || "confirmed";
      return `
        <tr>
          <td><strong>${escape(orderNo(order))}</strong><br><small>${formatDate(order.created_at)}</small></td>
          <td>${escape(items.map((item) => item.product_name || item.product?.name || "Ürün").join(", "))}</td>
          <td>${escape(orderCustomer(order))}</td>
          <td>${money(order.partner_total || order.total || order.total_amount)}</td>
          <td>
            <select data-order-status="${escape(order.id)}">
              ${["confirmed", "preparing", "shipped", "delivered", "cancelled"].map((status) => `<option value="${status}" ${currentStatus === status ? "selected" : ""}>${escape(statusLabel(status))}</option>`).join("")}
            </select>
          </td>
          <td>${statusPill(order.payment_status || "pending")}</td>
          <td><input data-order-tracking="${escape(order.id)}" value="${escape(tracking)}" placeholder="Takip no"></td>
        </tr>
      `;
    }).join("");
  }

  function refundTypeLabel(value) {
    const labels = {
      refund: "İade",
      cancellation: "İptal",
      signal: "Talep"
    };
    return labels[value] || value || "Talep";
  }

  function refundProviderText(item) {
    const dispatch = item.provider_dispatch;
    if (!dispatch) return item.request_status === "approved" ? "Bildirim kaydı yok" : "Karar bekliyor";
    if (dispatch.ok) return "Ödeme kuruluşuna iletildi";
    const bankPaymentCode = dispatch.channels?.bankPayment?.code;
    const webhookCode = dispatch.channels?.webhook?.code;
    return bankPaymentCode || webhookCode || "Bildirim beklemede";
  }

  function refundDetailMarkup(item) {
    const ticket = (item.tickets || [])[0] || {};
    const flag = (item.flags || [])[0] || {};
    const provider = refundProviderText(item);
    return `
      <tr class="partner-os-refund-detail">
        <td colspan="7">
          <div class="partner-os-refund-detail-grid">
            <article>
              <strong>Talep açıklaması</strong>
              <span>${escape(item.reason || ticket.message || ticket.title || "Açıklama kaydı yok.")}</span>
            </article>
            <article>
              <strong>İptal / iade nedeni</strong>
              <span>${escape(flag.reason || ticket.message || "Partner kararı bekleniyor.")}</span>
            </article>
            <article>
              <strong>Ödeme bildirimi</strong>
              <span>${escape(provider)}</span>
            </article>
          </div>
        </td>
      </tr>
    `;
  }

  function renderRefundCancellations() {
    const target = $("[data-refund-cancellation-rows]");
    const summary = $("[data-refund-cancellation-summary]");
    const items = state.refundCancellations || [];
    const pending = items.filter((item) => item.request_status === "pending_partner").length;
    const disputes = items.filter((item) => item.request_status === "dispute_admin_review").length;
    if (summary) summary.textContent = `${pending} bekleyen · ${disputes} ihtilaf`;
    if (!target) return;
    if (!items.length) {
      target.innerHTML = `<tr><td colspan="7">Partner kararı bekleyen iade veya iptal talebi görünmüyor.</td></tr>`;
      return;
    }
    target.innerHTML = items.map((item) => {
      const approveAction = item.type === "cancellation" ? "approve_cancellation" : "approve_refund";
      const actionButtons = item.decision_required
        ? `
          <button class="is-primary" type="button" data-refund-order="${escape(item.id)}" data-refund-decision="${escape(approveAction)}"><i class="fa-solid fa-check"></i><span>Kabul Et</span></button>
          <button class="is-danger" type="button" data-refund-order="${escape(item.id)}" data-refund-decision="reject_request"><i class="fa-solid fa-scale-balanced"></i><span>İhtilafa Gönder</span></button>
        `
        : `<span>${escape(item.request_status === "dispute_admin_review" ? "Admin incelemesinde" : refundProviderText(item))}</span>`;
      const row = `
        <tr>
          <td><strong>${escape(item.order_no || item.id)}</strong><br><small>${escape(formatDate(item.signal_at || item.created_at))}</small></td>
          <td>${escape(refundTypeLabel(item.type))}</td>
          <td>${escape(item.customer_name || item.customer_email || "-")}</td>
          <td>${money(item.partner_total || item.total)}</td>
          <td>${statusPill(item.request_status || item.order_status || "signal")}</td>
          <td class="partner-os-refund-reason">${escape(core.truncate(item.reason || "-", 96))}</td>
          <td>
            <div class="partner-os-table-actions">
              <button type="button" data-refund-detail="${escape(item.id)}"><i class="fa-solid fa-circle-info"></i><span>Detay</span></button>
              ${actionButtons}
            </div>
          </td>
        </tr>
      `;
      return row + (state.selectedRefundId === item.id ? refundDetailMarkup(item) : "");
    }).join("");
  }

  function renderFinance() {
    const metrics = state.metrics || {};
    const summary = $("[data-finance-summary]");
    if (summary) {
      const rows = [
        ["Brüt satış", money(metrics.gross_volume), "Ödeme ve sipariş hacmi"],
        ["Net kazanç", money(metrics.net_volume), "Komisyon sonrası"],
        ["Bekleyen hakediş", money(metrics.payout_pending), "Ödeme takviminde"],
        ["Bugün tahsilat", money(metrics.paid_today), "Gün içi performans"]
      ];
      summary.innerHTML = rows.map(([title, value, hint]) => `
        <article class="partner-os-finance-item">
          <div><strong>${escape(title)}</strong><span>${escape(hint)}</span></div>
          <em>${escape(value)}</em>
        </article>
      `).join("");
    }
    const rate = Number(state.business?.default_commission_rate || 0.12) * 100;
    if ($("[data-commission-rate]")) $("[data-commission-rate]").textContent = `%${rate.toFixed(rate % 1 ? 1 : 0)}`;

    const target = $("[data-payout-rows]");
    if (!target) return;
    if (!state.payouts.length) {
      target.innerHTML = `<tr><td colspan="5">Henüz planlanmış hakediş yok.</td></tr>`;
      return;
    }
    target.innerHTML = state.payouts.map((payout) => `
      <tr>
        <td>${escape(payout.period_start)} - ${escape(payout.period_end)}</td>
        <td>${money(payout.gross_amount)}</td>
        <td>${money(payout.commission_amount)}</td>
        <td>${money(payout.net_amount)}</td>
        <td>${statusPill(payout.status)}</td>
      </tr>
    `).join("");
  }

  function renderReportCards(target, cards) {
    if (!target) return;
    target.innerHTML = cards.map((card) => `
      <article class="partner-os-report-card ${card.tone ? `is-${escape(card.tone)}` : ""}">
        <span>${escape(card.label)}</span>
        <strong>${escape(card.value)}</strong>
        <small>${escape(card.hint)}</small>
      </article>
    `).join("");
  }

  function renderReports() {
    const metrics = state.metrics || {};
    const products = state.products.map((item) => core.normalizeProduct(item));
    const active = products.filter((item) => item.status === "active").length;
    const waiting = products.filter((item) => ["draft", "pending", "review", "in_review", "needs_review"].includes(String(item.status || "").toLowerCase())).length;
    const missingPrice = products.filter((item) => numeric(item.price) <= 0).length;
    const missingStock = products.filter((item) => numeric(item.stock) <= 0).length;
    const lowStock = products.filter((item) => numeric(item.stock) > 0 && numeric(item.stock) <= 5).length;
    renderReportCards($("[data-report-sales-summary]"), [
      { label: "Brüt hacim", value: money(metrics.gross_volume), hint: `Net kazanç ${money(metrics.net_volume)}`, tone: "good" },
      { label: "Bugünkü tahsilat", value: money(metrics.paid_today), hint: "QR/NFC/link toplamı", tone: numeric(metrics.paid_today) ? "good" : "warn" },
      { label: "Aktif katalog", value: `${active} ürün`, hint: `${waiting} kayıt onay/revize akışında`, tone: active ? "good" : "warn" },
      { label: "Stok-fiyat alarmı", value: `${missingPrice + missingStock + lowStock}`, hint: `${missingPrice} fiyat yok · ${missingStock} stok yok · ${lowStock} kritik`, tone: missingPrice + missingStock + lowStock ? "bad" : "good" }
    ]);

    const actionTarget = $("[data-report-action-list]");
    if (actionTarget) {
      const actions = [];
      if (missingPrice) actions.push(actionButton("Fiyatı eksik ürünleri aç", "fa-tags", "products", "primary"));
      if (missingStock || lowStock) actions.push(actionButton("Stok uyarılarını aç", "fa-boxes-stacked", "products", "primary"));
      if (waiting) actions.push(actionButton("Onay bekleyenleri kontrol et", "fa-shield-halved", "products", ""));
      actions.push(actionButton("Sipariş raporuna git", "fa-truck-fast", "orders", ""));
      actions.push(`<button type="button" data-export-products><i class="fa-solid fa-file-export"></i><span>Ürün Excel'i indir</span></button>`);
      actionTarget.innerHTML = actions.slice(0, 6).join("");
    }

    const rowTarget = $("[data-report-product-rows]");
    if (!rowTarget) return;
    if (!products.length) {
      rowTarget.innerHTML = `<tr><td colspan="6">Raporlanacak ürün görünmüyor.</td></tr>`;
      return;
    }
    const weight = (product) => {
      const signal = productQualitySignal(product);
      if (signal.status === "failed") return 0;
      if (signal.status === "pending") return 1;
      return 2;
    };
    rowTarget.innerHTML = [...products]
      .sort((a, b) => weight(a) - weight(b) || numeric(a.stock) - numeric(b.stock))
      .slice(0, 12)
      .map((product) => {
        const signal = productQualitySignal(product);
        const detailUrl = `/pages/partner/partner-product-detail.html?id=${encodeURIComponent(product.id || "")}`;
        return `
          <tr>
            <td><strong>${escape(product.name)}</strong><br><small>${escape(product.category || "Kategori bekliyor")}</small></td>
            <td>${escape(product.sold_count || 0)}</td>
            <td>${money(product.price)}</td>
            <td>${escape(product.stock)}</td>
            <td>${statusPill(product.status)}</td>
            <td>
              <a class="partner-os-mini-action" href="${escape(detailUrl)}">
                <i class="fa-solid fa-pen-to-square"></i>
                <span>${escape(signal.action)}</span>
              </a>
            </td>
          </tr>
        `;
      }).join("");
  }

  function renderCustomers() {
    const metrics = state.metrics || {};
    const business = state.business || {};
    const support = Math.max(
      numeric(metrics.open_ticket_count),
      countByStatus(state.tickets, ["open", "waiting", "in_progress"])
    );
    const refunds = numeric(metrics.refund_cancellation_pending_count) + numeric(metrics.refund_cancellation_dispute_count);
    const trust = Math.max(0, Math.min(100, numeric(metrics.trust_score || business.trust_score || 70)));
    renderReportCards($("[data-store-customer-summary]"), [
      { label: "Mağaza skoru", value: `${trust}/100`, hint: business.verification_status ? statusLabel(business.verification_status) : "Doğrulama bekliyor", tone: trust >= 85 ? "good" : "warn" },
      { label: "Açık müşteri işi", value: `${support + refunds}`, hint: `${support} destek · ${refunds} iade/iptal`, tone: support + refunds ? "bad" : "good" },
      { label: "Açık sipariş", value: `${numeric(metrics.open_order_count)}`, hint: "Hazırlık ve kargo takibi", tone: numeric(metrics.open_order_count) ? "warn" : "good" },
      { label: "Mağaza profili", value: business.logo_url && business.display_name ? "Tamam" : "Eksik", hint: business.city || "Şehir/profil bilgisi bekliyor", tone: business.logo_url && business.display_name ? "good" : "warn" }
    ]);

    const actionTarget = $("[data-store-customer-actions]");
    if (!actionTarget) return;
    const actions = [];
    if (support) actions.push(actionButton("Destek taleplerini yanıtla", "fa-headset", "support", "primary"));
    if (refunds) actions.push(actionButton("İade / iptal kararlarını aç", "fa-rotate-left", "refunds", "primary"));
    if (numeric(metrics.open_order_count)) actions.push(actionButton("Sipariş ve kargo güncelle", "fa-truck-fast", "orders", ""));
    actions.push(actionButton("Mağaza profilini düzenle", "fa-store", "settings", ""));
    actions.push(actionButton("Müşteri etkisini raporda gör", "fa-chart-simple", "reports", ""));
    actionTarget.innerHTML = actions.slice(0, 5).map((item) => typeof item === "string" ? item : actionButton(...item)).join("");
  }

  function renderAds() {
    const metrics = state.metrics || {};
    const activeCampaigns = countByStatus(state.campaigns, ["active", "scheduled", "approved"]);
    const pendingCampaigns = campaignAttentionCount();
    const activeProducts = numeric(metrics.active_product_count) || countByStatus(state.products, ["active"]);
    renderReportCards($("[data-ads-summary]"), [
      { label: "Reklama hazır ürün", value: `${activeProducts}`, hint: "Yayındaki katalogdan seçilebilir", tone: activeProducts ? "good" : "warn" },
      { label: "Aktif kampanya", value: `${activeCampaigns}`, hint: `${pendingCampaigns} plan/onay bekliyor`, tone: activeCampaigns ? "good" : "warn" },
      { label: "Bugünkü hacim", value: money(metrics.paid_today), hint: "Reklam etkisi için günlük takip", tone: numeric(metrics.paid_today) ? "good" : "warn" },
      { label: "Bütçe kontrolü", value: money(state.campaigns.reduce((sum, item) => sum + numeric(item.budget), 0)), hint: "Planlanan kampanya bütçesi", tone: state.campaigns.length ? "good" : "warn" }
    ]);

    const target = $("[data-ads-action-list]");
    if (!target) return;
    target.innerHTML = [
      growthActionButton("Sponsorlu görünürlük planla", "fa-ranking-star", "ads", "primary"),
      growthActionButton("Kupon kampanyası oluştur", "fa-ticket", "coupon", ""),
      growthActionButton("Sadakat kampanyası oluştur", "fa-users-viewfinder", "loyalty", ""),
      actionButton("Reklama hazır ürünleri kontrol et", "fa-boxes-stacked", "products", ""),
      actionButton("Performans raporunu aç", "fa-chart-simple", "reports", "")
    ].join("");
  }

  function renderDevelopment() {
    const target = $("[data-development-list]");
    const scoreTarget = $("[data-development-score]");
    if (!target) return;
    const items = onboardingItems();
    const doneCount = items.filter((item) => item.done).length;
    const percent = Math.round((doneCount / Math.max(items.length, 1)) * 100);
    if (scoreTarget) scoreTarget.textContent = `%${percent} olgunluk`;
    const recommendations = (state.recommendations || []).slice(0, 3).map((item) => ({
      title: item.title,
      body: item.body,
      target: item.target || "reports",
      done: false,
      icon: "fa-lightbulb"
    }));
    const rows = [
      ...items.map((item) => ({ ...item, icon: item.done ? "fa-circle-check" : "fa-circle" })),
      ...recommendations
    ];
    target.innerHTML = rows.map((item) => `
      <article class="partner-os-development-item ${item.done ? "is-done" : ""}">
        <i class="fa-solid ${escape(item.icon)}"></i>
        <div>
          <strong>${escape(item.title)}</strong>
          <span>${escape(item.body)}</span>
        </div>
        <button type="button" data-panel-jump="${escape(item.target || "reports")}">${item.done ? "Aç" : "İlerle"}</button>
      </article>
    `).join("");
  }

  function renderOperations() {
    const locations = $("[data-location-list]");
    if (locations) {
      locations.innerHTML = state.locations.length
        ? state.locations.map((item) => `
          <article class="partner-os-list-item">
            <div><strong>${escape(item.name)}</strong><span>${escape([item.location_type, item.city, item.address].filter(Boolean).join(" · "))}</span></div>
            <em>${item.is_default ? "Varsayılan" : "Aktif"}</em>
          </article>
        `).join("")
        : emptyList("Şube kaydı yok", "İlk şube, araç veya mobil satış noktasını eklemek için destek talebi açabilirsin.");
    }

    const devices = $("[data-device-list]");
    if (devices) {
      const demoDevices = state.devices.length ? state.devices : [
        { device_label: "Android NFC SoftPOS", device_type: "android_softpos", provider: "bank_softpos", status: "pending" },
        { device_label: "Dinamik QR Terminal", device_type: "qr_stand", provider: "allonapay", status: "active" },
        { device_label: "Taksi Mobil Terminal", device_type: "taxi_terminal", provider: "visa_tap_to_phone", status: "pending" }
      ];
      devices.innerHTML = demoDevices.map((item) => `
        <article class="partner-os-list-item">
          <div><strong>${escape(item.device_label)}</strong><span>${escape(providerLabel(item.provider))} · ${escape(item.device_type)}</span></div>
          <em>${escape(statusLabel(item.status))}</em>
        </article>
      `).join("");
    }
  }

  function renderTickets() {
    const target = $("[data-ticket-list]");
    if (!target) return;
    target.innerHTML = state.tickets.length
      ? state.tickets.map((ticket) => `
        <article class="partner-os-list-item">
          <div><strong>${escape(ticket.title)}</strong><span>${escape(ticket.category)} · ${formatDate(ticket.created_at)}</span></div>
          <em>${escape(statusLabel(ticket.status))}</em>
        </article>
      `).join("")
      : emptyList("Açık talep yok", "Ödeme, QR/NFC, kargo veya teknik konularda talep açabilirsin.");
  }

  function campaignTypeLabel(value) {
    const labels = {
      coupon: "Kupon",
      sponsored_listing: "Vitrin reklamı",
      loyalty: "HP sadakat",
      free_delivery: "Ücretsiz teslimat"
    };
    return labels[value] || value || "-";
  }

  function renderCampaigns() {
    const target = $("[data-campaign-rows]");
    if (!target) return;
    if (!state.campaigns.length) {
      target.innerHTML = `<tr><td colspan="5">Henüz planlanmış kampanya yok.</td></tr>`;
      return;
    }
    target.innerHTML = state.campaigns.map((campaign) => `
      <tr>
        <td><strong>${escape(campaign.title)}</strong><br><small>${escape(campaign.summary || "")}</small></td>
        <td>${escape(campaignTypeLabel(campaign.campaign_type))}</td>
        <td>${escape([campaign.starts_at, campaign.ends_at].filter(Boolean).join(" - ") || "Tarih bekliyor")}</td>
        <td>${escape(statusLabel(campaign.objective || "conversion"))}</td>
        <td>${statusPill(campaign.status || "review")}</td>
      </tr>
    `).join("");
  }

  function renderAcademy() {
    const target = $("[data-academy-list]");
    if (!target) return;
    const lessons = [
      ["Hızlı başlangıç", "Profil, katalog, ödeme ve destek kurulumunu 15 dakikada tamamla.", "onboarding", "fa-list-check"],
      ["Ürün ve stok kalitesi", "Görsel, açıklama, fiyat, stok ve kategori standardını güçlendir.", "products", "fa-boxes-stacked"],
      ["Sipariş operasyonu", "Hazırlık, kargo, teslimat ve müşteri iletişimi akışlarını takip et.", "orders", "fa-truck-fast"],
      ["Kampanya ve reklam", "Kupon, HP, vitrin ve tekrar müşteri planlarını tek yerden yönet.", "growth", "fa-bullhorn"],
      ["Finans ve hakediş", "Komisyon, net kazanç, ödeme takvimi ve raporları doğru oku.", "finance", "fa-wallet"],
      ["Güvenlik standardı", "MFA, destek, audit ve hesap güvenliği kontrollerini düzenli tut.", "settings", "fa-shield-halved"]
    ];
    target.innerHTML = lessons.map(([title, body, targetId, icon]) => `
      <article class="partner-os-academy-card">
        <i class="fa-solid ${escape(icon)}"></i>
        <div>
          <strong>${escape(title)}</strong>
          <span>${escape(body)}</span>
        </div>
        <button type="button" data-panel-jump="${escape(targetId)}">Aç</button>
      </article>
    `).join("");
  }

  function renderAll() {
    applyBusinessProfile();
    renderKpis();
    renderMarketplaceBrief();
    renderStoreHealth();
    renderActionCenter();
    renderAnnouncements();
    renderOnboarding();
    renderRecommendations();
    renderRecentPayments();
    renderPaymentRows();
    renderProducts();
    setProductView(state.productView || "list");
    renderIntegrations();
    renderOrders();
    renderRefundCancellations();
    renderFinance();
    renderReports();
    renderCustomers();
    renderAds();
    renderOperations();
    renderTickets();
    renderCampaigns();
    renderAcademy();
    renderDevelopment();
    renderNotificationBadges();
  }

  async function loadFallbackData() {
    const access = state.access;
    const partnerBusiness = access.partnerBusiness || {};
    const business = {
      id: partnerBusiness.id || `local-${access.user.id}`,
      owner_id: partnerBusiness.owner_id || access.user.id,
      display_name: partnerBusiness.display_name || partnerBusiness.legal_name || access.profile.full_name || access.user.email || "Allona Partner",
      partner_code: partnerBusiness.partner_code || "LOCAL-PARTNER",
      partner_type: partnerBusiness.partner_type || "shop",
      status: partnerBusiness.status || "active",
      verification_status: partnerBusiness.verification_status || "pending",
      trust_score: partnerBusiness.trust_score || 72,
      level: partnerBusiness.level || 1,
      default_commission_rate: 0.12,
      email: partnerBusiness.email || access.user.email,
      phone: partnerBusiness.phone || access.profile.phone || ""
    };

    const { data: products } = await App.db.client()
      .from("products")
      .select("*")
      .eq("partner_id", access.user.id)
      .order("created_at", { ascending: false });

    state.business = business;
    state.products = products || [];
    state.orders = [];
    state.paymentIntents = [];
    state.transactions = [];
    state.payouts = [];
    state.refundCancellations = [];
    state.locations = [];
    state.devices = [];
    state.qrCodes = [];
    state.tickets = [];
    state.campaigns = [];
    state.integrations = [];
    state.integrationConnectors = DEFAULT_INTEGRATION_CONNECTORS;
    state.integrationRuns = [];
    state.partnerWarnings = [];
    state.integrationWarnings = [];
    state.refundWarnings = [];
    state.integrationPolicy = {
      apply_enabled: false,
      require_apply_confirmation: true,
      apply_confirmation_text: "KATALOGA_AKTAR",
      force_draft_on_apply: true
    };
    state.metrics = {
      product_count: state.products.length,
      active_product_count: state.products.filter((item) => item.status === "active").length,
      low_stock_count: state.products.filter((item) => Number(item.stock || 0) <= 5).length,
      open_order_count: 0,
      awaiting_payment_count: 0,
      paid_today: 0,
      gross_volume: 0,
      net_volume: 0,
      payout_pending: 0,
      open_ticket_count: 0,
      trust_score: 72
    };
    state.recommendations = [
      {
        title: "Backend bekleniyor, panel yerel fallback ile açık",
        body: "Supabase ürünleri okunuyor. Partner OS migration ve API yayına alındığında tüm modüller canlı veriyle çalışacak.",
        action: "Hazır"
      }
    ];
  }

  async function loadPartnerOs() {
    showAlert("Partner OS yükleniyor...");
    try {
      state.access = await App.auth.requireRole(["partner", "admin", "super_admin"]);
      if (!state.access) return;
      await syncEInvoicingEntry();
      try {
        const payload = await apiFetch("/v1/partner/os");
        Object.assign(state, {
          business: payload.business,
          products: payload.products || [],
          orders: payload.orders || [],
          paymentIntents: payload.paymentIntents || [],
          transactions: payload.transactions || [],
          payouts: payload.payouts || [],
          refundCancellations: payload.refundCancellations || [],
          locations: payload.locations || [],
          devices: payload.devices || [],
          qrCodes: payload.qrCodes || [],
          tickets: payload.tickets || [],
          campaigns: payload.campaigns || [],
          integrations: payload.integrations || [],
          integrationConnectors: payload.integrationConnectors || DEFAULT_INTEGRATION_CONNECTORS,
          integrationRuns: payload.integrationRuns || [],
          partnerWarnings: payload.partnerWarnings || [],
          integrationWarnings: payload.integrationWarnings || [],
          refundWarnings: payload.refundWarnings || [],
          integrationPolicy: payload.integrationPolicy || {},
          metrics: payload.metrics || {},
          recommendations: payload.recommendations || []
        });
        showAlert("");
      } catch (error) {
        await loadFallbackData();
        showAlert("Partner API şu an erişilemedi; panel güvenli yerel fallback ile açıldı. Canlı yayında API aktif olduğunda tüm modüller veri çeker.");
      }
      renderAll();
      applyInitialHash();
    } catch (error) {
      showAlert(error.message || "Bu alana erişim yetkiniz yok.", "error");
    }
  }

  function activatePanel(id) {
    $all("[data-panel-section]").forEach((section) => section.classList.toggle("is-active", section.id === id));
    $all("[data-panel-target]").forEach((button) => button.classList.toggle("is-active", button.dataset.panelTarget === id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function applyInitialHash() {
    if (state.initialHashApplied) return;
    state.initialHashApplied = true;
    const hash = String(window.location.hash || "").replace(/^#/, "");
    if (hash === "products-add") {
      activatePanel("products");
      setProductView("add", { focusForm: true });
      return;
    }
    if (hash && document.getElementById(hash)) activatePanel(hash);
  }

  function paymentPreview(intent) {
    const target = $("[data-payment-preview]");
    if (!target || !intent) return;
    const url = intent.qr_payload || intent.payment_url || `${window.location.origin}${core.url(`/pages/partner/pay.html?intent=${intent.id}`)}`;
    const qrUrl = `https://quickchart.io/qr?size=280&margin=2&text=${encodeURIComponent(url)}`;
    const nfcNote = intent.channel === "nfc"
      ? "NFC tahsilat için sertifikalı SoftPOS uygulamasında aynı tutarla işlemi başlatın. AllonaHub bu ödeme isteğini, cihazı ve hakedişi takip eder."
      : "Müşteri QR kodu okutarak veya bağlantıya dokunarak ödeme ekranına geçer.";
    target.innerHTML = `
      <div class="partner-os-qr-card">
        <img src="${escape(qrUrl)}" alt="Ödeme QR kodu" loading="eager" onerror="this.hidden=true;this.closest('.partner-os-qr-card').classList.add('is-qr-fallback')">
        <span class="partner-os-qr-fallback">QR görseli yüklenemedi. Ödeme bağlantısı aktif.</span>
        <strong>${money(intent.amount)} · ${escape(channelLabel(intent.channel))}</strong>
        <span>${escape(nfcNote)}</span>
        <code>${escape(url)}</code>
      </div>
    `;
  }

  function localPaymentIntent(data) {
    const id = uuid();
    const channel = data.channel || "qr";
    const params = new URLSearchParams({
      intent: id,
      amount: String(Number(data.amount || 0)),
      channel,
      partner: state.business?.display_name || "AllonaHub Partner"
    });
    const url = `${window.location.origin}${core.url(`/pages/partner/pay.html?${params.toString()}`)}`;
    return {
      id,
      partner_id: state.business?.id,
      channel,
      provider: channel === "nfc" ? "bank_softpos" : channel === "payment_link" ? "bank_payment_link" : "bank_checkout",
      amount: Number(data.amount || 0),
      currency: "TRY",
      description: data.description || "Partner ödeme isteği",
      customer_phone: data.customer_phone || "",
      status: channel === "nfc" ? "provider_pending" : "awaiting_payment",
      payment_url: url,
      qr_payload: url,
      created_at: new Date().toISOString()
    };
  }

  function restrictedProductReason(data) {
    const text = [
      data.name,
      data.category,
      data.brand,
      data.description
    ].map((value) => String(value || "")).join(" ");
    const found = RESTRICTED_PRODUCT_PATTERNS.find(([, pattern]) => pattern.test(text));
    return found ? found[0] : "";
  }

  async function createPaymentIntent(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    data.amount = Number(data.amount || 0);
    if (!data.amount || data.amount <= 0) {
      toast("Tutar 0'dan büyük olmalı.", "error");
      return;
    }
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    try {
      let intent;
      try {
        const payload = await apiFetch("/v1/partner/payment-intents", {
          method: "POST",
          body: JSON.stringify(data)
        });
        intent = payload.paymentIntent;
      } catch (error) {
        intent = localPaymentIntent(data);
        showAlert("Ödeme isteği yerel önizleme olarak oluşturuldu. Backend aktif olduğunda kayıt ve hakediş canlıya bağlanacak.");
      }
      state.paymentIntents = [intent, ...state.paymentIntents.filter((item) => item.id !== intent.id)];
      state.metrics.awaiting_payment_count = state.paymentIntents.filter((item) => ["created", "awaiting_payment", "provider_pending"].includes(item.status)).length;
      paymentPreview(intent);
      renderPaymentRows();
      renderRecentPayments();
      renderKpis();
      renderNotificationBadges();
      if (App.complianceAudit) {
        await App.complianceAudit.record({
          category: "partner",
          action: "payment_intent_created",
          severity: "info",
          resourceType: "partner_payment_intent",
          resourceId: intent.id,
          evidenceTags: ["partner_os", "payment"],
          metadata: {
            channel: intent.channel,
            provider: intent.provider,
            amount: Number(intent.amount || 0),
            local_preview: String(intent.id || "").startsWith("local-")
          }
        });
      }
      form.reset();
      toast(`${channelLabel(intent.channel)} ödeme isteği hazır.`);
    } catch (error) {
      toast(error.message || "Ödeme isteği oluşturulamadı.", "error");
    } finally {
      button.disabled = false;
    }
  }

  function productPayloadFromData(data) {
    const scope = normalizeModuleKey(data.catalog_scope) || currentCatalogScope();
    const profile = catalogProfile(scope);
    const businessName = state.business?.display_name || state.business?.legal_name || state.access.profile?.full_name || "Allona Partner";
    const sellerPublicName = data.seller_public_name || businessName;
    const sellerLegalName = data.seller_legal_name || state.business?.legal_name || "";
    const sellerCity = data.seller_city || state.business?.city || "";
    const sellerContact = data.seller_contact || state.business?.support_email || state.access.user.email || "";
    const sellerTaxMasked = data.seller_tax_number_masked || "";
    const invoiceResponsibility = data.invoice_responsibility || "Fatura ve satış sonrası sorumluluk ilgili partner/satıcı kaydına göre yürütülür.";
    const sellerDisclosure = data.seller_disclosure || "Satıcı bilgileri sipariş onayı öncesinde ve faturada gösterilir; destek AllonaHub üzerinden yürütülür.";
    const complianceReason = restrictedProductReason(data);
    if (complianceReason) {
      throw new Error(`${complianceReason} kategorisi otomatik ürün yüklemeye kapalıdır. Lütfen AllonaHub destek üzerinden manuel inceleme talebi açın.`);
    }
    const mediaGallery = parseMediaGallery(data.media_gallery);
    const primaryImage = data.image_url || mediaGallery[0] || profile.image;
    return {
      name: data.name,
      description: data.description || "",
      category: data.category || profile.category,
      brand: data.brand || businessName,
      price: Number(data.price || 0),
      stock: Number(data.stock || 0),
      status: "draft",
      module_key: scope,
      catalog_scope: scope,
      partner_id: state.access.user.id,
      partner_code: state.business?.partner_code || state.business?.id || state.access.user.id,
      partner_email: state.access.user.email || "",
      seller_public_name: sellerPublicName,
      seller_kind: "Partner satıcı",
      seller_legal_name: sellerLegalName,
      seller_city: sellerCity,
      seller_contact: sellerContact,
      seller_tax_number_masked: sellerTaxMasked,
      invoice_responsibility: invoiceResponsibility,
      seller_disclosure: sellerDisclosure,
      compliance_review_status: "pending",
      compliance_notes: data.status === "active" ? "Partner yayın talebi oluşturdu; admin onayı bekleniyor." : "Partner ürün taslağı oluşturdu; admin onayı bekleniyor.",
      image_url: primaryImage,
      media_gallery: mediaGallery.length ? mediaGallery : (primaryImage ? [primaryImage] : []),
      video_url: String(data.video_url || "").trim(),
      slug: core.slugify(`${data.name}-${Date.now()}`),
      coupon_status: scope === "food" ? "Menü kuponu" : scope === "market" ? "Market kuponu" : "Aktif",
      hp_status: scope === "food" ? "HP kazandırır" : scope === "market" ? "Market HP" : "Aktif",
      sku: data.sku || core.slugify(`${profile.skuPrefix}-${data.name}-${Date.now()}`).toUpperCase().slice(0, 48)
    };
  }

  function parseMediaGallery(value) {
    if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8);
    const raw = String(value || "").trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8);
    } catch (error) {
      // Excel/CSV imports may carry gallery URLs as comma or newline separated text.
    }
    return raw.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
  }

  async function persistProductPayload(payload, options) {
    const settings = options || {};
    if (!payload.name || payload.price < 0) {
      throw new Error("Ürün adı ve fiyat alanını kontrol edin.");
    }
    if (!isModuleEnabled(payload.catalog_scope)) {
      throw new Error(`${catalogProfile(payload.catalog_scope).label} modülü bu partner için kilitli.`);
    }
    const created = await App.db.products.upsert(payload);
    state.products = [created, ...state.products];
    state.metrics.product_count = state.products.length;
    state.metrics.active_product_count = state.products.filter((item) => item.status === "active").length;
    state.metrics.low_stock_count = state.products.filter((item) => Number(item.stock || 0) <= 5).length;
    if (App.complianceAudit && !settings.skipAudit) {
      await App.complianceAudit.record({
        category: "partner",
        action: "product_draft_created",
        severity: "info",
        resourceType: "product",
        resourceId: created.id,
        evidenceTags: ["partner_os", "catalog"],
        metadata: {
          category: created.category || payload.category,
          price: Number(created.price || payload.price || 0),
          status: created.status || "draft",
          source: settings.source || "form"
        }
      });
    }
    return created;
  }

  async function createProductFromData(data, options) {
    const payload = productPayloadFromData(data);
    const created = await persistProductPayload(payload, options);
    renderProducts();
    setProductView("list");
    renderKpis();
    renderNotificationBadges();
    return created;
  }

  async function createProduct(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const scope = normalizeModuleKey(data.catalog_scope) || currentCatalogScope();
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    try {
      await createProductFromData(data, { source: "form" });
      form.reset();
      applyCatalogProfile();
      toast(scope === "market" ? "Market ürünü admin onayına gönderildi." : scope === "food" ? "Yemek ürünü admin onayına gönderildi." : "Ürün admin onayına gönderildi.");
    } catch (error) {
      toast(error.message || "Ürün kaydedilemedi. Partner yetkisi veya ürün şemasını kontrol edin.", "error");
    } finally {
      button.disabled = false;
    }
  }

  function productTemplateRows() {
    const scope = currentCatalogScope();
    const profile = catalogProfile(scope);
    return [{
      catalog_scope: scope,
      name: scope === "food" ? "Cheeseburger Menü" : scope === "service" ? "Standart Hizmet Paketi" : "Örnek Ürün",
      category: profile.category,
      brand: state.business?.display_name || profile.brand,
      price: 199.9,
      stock: scope === "service" ? 1 : 25,
      status: "draft",
      seller_public_name: state.business?.display_name || profile.brand,
      seller_legal_name: state.business?.legal_name || "",
      seller_city: state.business?.city || "",
      seller_contact: state.access?.user?.email || "",
      seller_tax_number_masked: "",
      invoice_responsibility: "Fatura ve satış sonrası sorumluluk ilgili partner/satıcı kaydına göre yürütülür.",
      seller_disclosure: "Satıcı bilgileri sipariş onayı öncesinde ve faturada gösterilir; destek AllonaHub üzerinden yürütülür.",
      image_url: profile.image,
      media_gallery: JSON.stringify([profile.image]),
      video_url: "",
      description: "Excel ile yükleme örneği",
      sku: `${profile.skuPrefix}-ORNEK-001`
    }];
  }

  function rowsFromProducts() {
    return state.products.map((item) => ({
      catalog_scope: item.catalog_scope || item.module_key || currentCatalogScope(),
      name: item.name || item.title || "",
      category: item.category || "",
      brand: item.brand || "",
      price: Number(item.price || 0),
      stock: Number(item.stock || 0),
      status: item.status || "draft",
      seller_public_name: item.seller_public_name || item.seller_name || "",
      seller_legal_name: item.seller_legal_name || "",
      seller_city: item.seller_city || "",
      seller_contact: item.seller_contact || "",
      seller_tax_number_masked: item.seller_tax_number_masked || "",
      invoice_responsibility: item.invoice_responsibility || "",
      seller_disclosure: item.seller_disclosure || "",
      image_url: item.image_url || "",
      media_gallery: Array.isArray(item.media_gallery) ? JSON.stringify(item.media_gallery) : item.media_gallery || "",
      video_url: item.video_url || "",
      description: item.description || "",
      sku: item.sku || ""
    }));
  }

  function downloadBlob(blob, filename) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function downloadRows(rows, filename, sheetName, columns = PRODUCT_TEMPLATE_COLUMNS) {
    const normalizedRows = rows.length ? rows : [columns.reduce((row, key) => ({ ...row, [key]: "" }), {})];
    if (window.XLSX) {
      const worksheet = window.XLSX.utils.json_to_sheet(normalizedRows, { header: columns });
      const workbook = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      window.XLSX.writeFile(workbook, filename);
      return;
    }
    const csv = [
      columns.join(";"),
      ...normalizedRows.map((row) => columns.map((key) => {
        const value = String(row[key] ?? "");
        return `"${value.replace(/"/g, '""')}"`;
      }).join(";"))
    ].join("\n");
    downloadBlob(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }), filename.replace(/\.xlsx$/i, ".csv"));
  }

  function parseDelimited(text) {
    const firstLine = String(text || "").split(/\r?\n/).find((line) => line.trim()) || "";
    const delimiter = [";", "\t", ","].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];
      if (char === '"' && quoted && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        row.push(cell);
        cell = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\n") index += 1;
        row.push(cell);
        if (row.some((value) => String(value).trim())) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }
    row.push(cell);
    if (row.some((value) => String(value).trim())) rows.push(row);
    const headers = (rows.shift() || []).map((header) => String(header || "").trim());
    return rows.map((values) => headers.reduce((entry, header, index) => {
      entry[header] = values[index] ?? "";
      return entry;
    }, {}));
  }

  function normalizeProductRow(row) {
    const aliases = {
      catalog_scope: ["catalog_scope", "module", "module_key", "kanal", "yayın kanalı", "yayin kanali", "modül", "modul"],
      name: ["name", "title", "ürün adı", "urun adi", "hizmet adı", "hizmet adi", "ad"],
      category: ["category", "kategori"],
      brand: ["brand", "marka", "restoran", "restoran / marka adı", "restoran / marka adi"],
      price: ["price", "fiyat", "tutar"],
      stock: ["stock", "stok", "kontenjan"],
      status: ["status", "durum", "yayın durumu", "yayin durumu"],
      image_url: ["image_url", "görsel url", "gorsel url", "resim", "fotoğraf", "fotograf"],
      media_gallery: ["media_gallery", "galeri", "görsel galeri", "gorsel galeri", "ek görseller", "ek gorseller"],
      video_url: ["video_url", "video", "video url", "ürün videosu", "urun videosu"],
      description: ["description", "açıklama", "aciklama"],
      sku: ["sku", "stok kodu", "ürün kodu", "urun kodu"]
    };
    const normalized = {};
    const source = Object.entries(row || {}).reduce((map, [key, value]) => {
      map[String(key || "").trim().toLocaleLowerCase("tr-TR")] = value;
      return map;
    }, {});
    Object.entries(aliases).forEach(([target, keys]) => {
      const found = keys.find((key) => Object.prototype.hasOwnProperty.call(source, key));
      normalized[target] = found ? source[found] : "";
    });
    return normalized;
  }

  async function readProductFile(file) {
    if (/\.xlsx?$/i.test(file.name) && !window.XLSX) {
      throw new Error("Excel motoru yüklenemedi. Dosyayı CSV olarak kaydedip tekrar deneyin.");
    }
    if (window.XLSX && /\.xlsx?$/i.test(file.name)) {
      const buffer = await file.arrayBuffer();
      const workbook = window.XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      return window.XLSX.utils.sheet_to_json(sheet, { defval: "" });
    }
    const text = await file.text();
    return parseDelimited(text);
  }

  function showBulkResult(result) {
    const target = $("[data-bulk-result]");
    if (!target) return;
    target.hidden = false;
    target.innerHTML = `
      <strong>${result.created} kayıt eklendi, ${result.failed} satır atlandı.</strong>
      ${result.errors.length ? `<ul>${result.errors.slice(0, 8).map((error) => `<li>${escape(error)}</li>`).join("")}</ul>` : "<span>Yükleme tamamlandı.</span>"}
    `;
  }

  async function importProductFile(file) {
    if (!file) return;
    const rows = await readProductFile(file);
    const result = { created: 0, failed: 0, errors: [] };
    for (const [index, row] of rows.entries()) {
      try {
        await createProductFromData(normalizeProductRow(row), { source: "excel", skipAudit: true });
        result.created += 1;
      } catch (error) {
        result.failed += 1;
        result.errors.push(`Satır ${index + 2}: ${error.message || "Kaydedilemedi."}`);
      }
    }
    if (App.complianceAudit && result.created) {
      await App.complianceAudit.record({
        category: "partner",
        action: "product_bulk_imported",
        severity: "info",
        resourceType: "product",
        resourceId: state.business?.id || state.access.user.id,
        evidenceTags: ["partner_os", "catalog", "excel"],
        metadata: { created: result.created, failed: result.failed, file_name: file.name }
      });
    }
    renderProducts();
    renderKpis();
    renderNotificationBadges();
    showBulkResult(result);
    toast(result.failed ? "Toplu yükleme tamamlandı; bazı satırlar atlandı." : "Toplu ürün yükleme tamamlandı.", result.failed ? "warning" : "success");
  }

  function integrationSecretsFromData(data) {
    const provider = data.provider || "generic_feed";
    const sourceUrl = String(data.source_url || "").trim();
    const apiKey = String(data.api_key || "").trim();
    const apiSecret = String(data.api_secret || "").trim();
    const secrets = {};

    if (provider === "generic_feed") {
      if (sourceUrl) secrets.FEED_URL = sourceUrl;
      return secrets;
    }
    if (provider === "woocommerce") {
      if (sourceUrl) secrets.API_BASE_URL = sourceUrl;
      if (apiKey) secrets.CONSUMER_KEY = apiKey;
      if (apiSecret) secrets.CONSUMER_SECRET = apiSecret;
      return secrets;
    }
    if (provider === "shopify") {
      if (sourceUrl) secrets.SHOP_DOMAIN = sourceUrl;
      if (apiSecret || apiKey) secrets.ACCESS_TOKEN = apiSecret || apiKey;
      return secrets;
    }
    if (provider === "trendyol") {
      if (sourceUrl) secrets.SUPPLIER_ID = sourceUrl;
      if (apiKey) secrets.API_KEY = apiKey;
      if (apiSecret) secrets.API_SECRET = apiSecret;
      return secrets;
    }
    if (provider === "hepsiburada") {
      if (sourceUrl) secrets.MERCHANT_ID = sourceUrl;
      if (apiKey) secrets.API_KEY = apiKey;
      if (apiSecret) secrets.API_SECRET = apiSecret;
      return secrets;
    }
    if (provider === "n11") {
      if (apiKey) secrets.APP_KEY = apiKey;
      if (apiSecret) secrets.APP_SECRET = apiSecret;
      return secrets;
    }
    if (provider === "ciceksepeti") {
      if (apiKey || apiSecret) secrets.API_KEY = apiKey || apiSecret;
      return secrets;
    }
    if (provider === "pazarama") {
      if (apiKey) secrets.API_KEY = apiKey;
      if (apiSecret) secrets.API_SECRET = apiSecret;
      return secrets;
    }
    if (sourceUrl) secrets.API_BASE_URL = sourceUrl;
    if (apiKey || apiSecret) secrets.ACCESS_TOKEN = apiSecret || apiKey;
    return secrets;
  }

  function integrationPayloadFromForm(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const fullIntegration = data.export_enabled === "true" || currentIntegrationMode() === "full";
    return {
      provider: data.provider || "generic_feed",
      display_name: data.display_name || integrationProviderLabel(data.provider),
      status: "draft",
      sync_mode: data.sync_mode || "manual",
      default_publish_status: data.default_publish_status || "draft",
      import_enabled: true,
      export_enabled: fullIntegration,
      direction: fullIntegration ? "bidirectional" : "inbound",
      settings: {
        module_key: data.module_key || "shop",
        default_category: data.default_category || "Genel"
      },
      secrets: integrationSecretsFromData(data)
    };
  }

  async function saveIntegration(form) {
    const button = form.querySelector("button[type='submit']");
    if (button) button.disabled = true;
    try {
      if (currentIntegrationMode() === "full" && !partnerHasFullIntegrationAccess()) {
        toast("Tam entegrasyon premium üyelik gerektirir. Ürünleri çekme ücretsizdir; tam entegrasyon premium sonrası açılır.", "warning");
        openIntegrationPremium("pro");
        return;
      }
      const payload = await apiFetch("/v1/partner/integrations", {
        method: "POST",
        body: JSON.stringify(integrationPayloadFromForm(form))
      });
      const integration = payload.integration;
      state.integrations = [integration, ...state.integrations.filter((item) => item.id !== integration.id)];
      renderIntegrations();
      renderActionCenter();
      renderOnboarding();
      const mode = currentIntegrationMode();
      form.reset();
      setIntegrationMode(mode);
      applyIntegrationCredentialHints();
      toast("Entegrasyon bağlantısı kaydedildi.");
      if (App.complianceAudit) {
        await App.complianceAudit.record({
          category: "partner",
          action: "integration_created",
          severity: "info",
          resourceType: "partner_integration",
          resourceId: integration.id,
          evidenceTags: ["partner_os", "integration"],
          metadata: {
            provider: integration.provider,
            sync_mode: integration.sync_mode,
            default_publish_status: integration.default_publish_status
          }
        });
      }
    } catch (error) {
      toast(error.message || "Entegrasyon kaydedilemedi.", "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function testIntegration(integrationId) {
    try {
      const payload = await apiFetch(`/v1/partner/integrations/${encodeURIComponent(integrationId)}/test`, {
        method: "POST",
        body: JSON.stringify({ probe_remote: true })
      });
      if (payload.integration) {
        state.integrations = state.integrations.map((item) => item.id === integrationId ? { ...item, ...payload.integration } : item);
      }
      renderIntegrations();
      const rowsRead = payload.result?.remote_probe?.rows_read;
      toast(rowsRead !== undefined ? `Bağlantı doğrulandı; ${rowsRead} kayıt okunabildi.` : "Entegrasyon bağlantısı doğrulandı.");
    } catch (error) {
      toast(error.message || "Entegrasyon testi başarısız.", "error");
    }
  }

  function integrationRunSummary(run) {
    const created = Number(run?.created_count || 0);
    const updated = Number(run?.updated_count || 0);
    const skipped = Number(run?.skipped_count || 0);
    const failed = Number(run?.failed_count || 0);
    const checked = Number(run?.checked_count || 0);
    if (!checked) return "Kaynakta okunacak ürün bulunamadı.";
    const pageInfo = run?.summary?.page_info || {};
    const pageSuffix = pageInfo.provider
      ? pageInfo.exhausted
        ? " Kaynak sonuna gelindi; sonraki tam kontrolde baştan değişiklik taranır."
        : pageInfo.next_page !== null && pageInfo.next_page !== undefined
          ? ` Sıradaki çekimde sayfa ${pageInfo.next_page} alınacak.`
          : ""
      : "";
    return `${created} yeni, ${updated} güncel, ${skipped} zaten aynı, ${failed} hata.${pageSuffix}`;
  }

  function shouldContinueIntegrationPull(run) {
    const pageInfo = run?.summary?.page_info || {};
    return Boolean(
      run?.run_mode === "apply"
      && pageInfo.provider
      && pageInfo.exhausted === false
    );
  }

  function nextIntegrationPullLabel(run) {
    const pageInfo = run?.summary?.page_info || {};
    if (pageInfo.next_page !== null && pageInfo.next_page !== undefined) return `sayfa ${pageInfo.next_page}`;
    return "sıradaki sayfa";
  }

  async function syncIntegration(integrationId, mode, options = {}) {
    try {
      const runMode = mode || "preview";
      const body = { mode: runMode, direction: "inbound" };
      if (runMode === "apply") {
        const policy = integrationPolicy();
        const confirmationText = policy.apply_confirmation_text || "KATALOGA_AKTAR";
        if (!options.autoContinue) {
          const confirmed = window.confirm("Ürünleri AllonaHub kataloğuna taslak/kontrol durumunda aktaralım mı?");
          if (!confirmed) {
            toast("Kataloğa aktarım iptal edildi.", "warning");
            return;
          }
        }
        body.confirm_apply = confirmationText;
        body.approval_note = options.autoContinue
          ? "Partner panelinden otomatik sayfalı ürün çekme ile kataloğa aktarım."
          : "Partner panelinden ücretsiz ürün çekme ile kataloğa aktarım.";
      }
      const payload = await apiFetch(`/v1/partner/integrations/${encodeURIComponent(integrationId)}/sync`, {
        method: "POST",
        body: JSON.stringify(body)
      });
      if (payload.run) {
        state.integrationRuns = [payload.run, ...state.integrationRuns.filter((item) => item.id !== payload.run.id)];
      }
      if (runMode === "apply") {
        await loadPartnerOs();
        toast(`Ürün çekme tamamlandı: ${integrationRunSummary(payload.run)} Ürünlerim ve admin onay ekranı yenilendi.`);
        const remainingBatches = Number(options.remainingBatches ?? INTEGRATION_AUTO_PULL_MAX_BATCHES);
        if (shouldContinueIntegrationPull(payload.run) && remainingBatches > 0) {
          toast(`${nextIntegrationPullLabel(payload.run)} ${Math.round(INTEGRATION_AUTO_PULL_DELAY_MS / 1000)} saniye içinde otomatik çekilecek.`, "info");
          window.setTimeout(() => {
            syncIntegration(integrationId, "apply", {
              autoContinue: true,
              remainingBatches: remainingBatches - 1
            });
          }, INTEGRATION_AUTO_PULL_DELAY_MS);
        }
      } else {
        renderIntegrationRuns();
        renderNotificationBadges();
        toast(`Önizleme tamamlandı: ${integrationRunSummary(payload.run)} Kataloğa yazmak için Ürünleri Çek butonunu kullan.`);
      }
    } catch (error) {
      toast(error.message || "Entegrasyon senkronu çalışmadı.", "error");
    }
  }

  async function saveProfile(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const payload = await apiFetch("/v1/partner/profile", {
        method: "PATCH",
        body: JSON.stringify(data)
      });
      state.business = payload.business;
      applyBusinessProfile();
      if (App.complianceAudit) {
        await App.complianceAudit.record({
          category: "partner",
          action: "profile_updated",
          severity: "info",
          resourceType: "partner_business",
          resourceId: state.business && state.business.id,
          evidenceTags: ["partner_os", "profile"],
          metadata: { updated_fields: Object.keys(data) }
        });
      }
      toast("Partner bilgileri kaydedildi.");
    } catch (error) {
      toast(error.message || "Profil kaydedilemedi.", "error");
    }
  }

  async function createTicket(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      let ticket;
      try {
        const payload = await apiFetch("/v1/partner/support-tickets", {
          method: "POST",
          body: JSON.stringify(data)
        });
        ticket = payload.ticket;
      } catch (error) {
        ticket = {
          id: uuid(),
          title: data.title,
          category: data.category,
          priority: data.priority,
          message: data.message,
          status: "open",
          created_at: new Date().toISOString()
        };
        showAlert("Destek talebi yerel önizleme olarak eklendi. API aktif olduğunda kayıt canlıya bağlanacak.");
      }
      state.tickets = [ticket, ...state.tickets];
      state.metrics.open_ticket_count = state.tickets.filter((item) => ["open", "waiting"].includes(item.status)).length;
      renderTickets();
      renderKpis();
      renderNotificationBadges();
      if (App.complianceAudit) {
        await App.complianceAudit.record({
          category: "support",
          action: "partner_support_ticket_created",
          severity: data.priority === "urgent" ? "warning" : "info",
          resourceType: "partner_support_ticket",
          resourceId: ticket.id,
          evidenceTags: ["partner_os", "support"],
          metadata: {
            category: data.category,
            priority: data.priority,
            local_preview: String(ticket.id || "").startsWith("local-")
          }
        });
      }
      form.reset();
      toast("Destek talebi oluşturuldu.");
    } catch (error) {
      toast(error.message || "Destek talebi oluşturulamadı.", "error");
    }
  }

  async function createCampaign(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.title) {
      toast("Kampanya adı zorunlu.", "error");
      return;
    }
    const campaign = {
      id: uuid(),
      title: data.title,
      campaign_type: data.campaign_type || "coupon",
      starts_at: data.starts_at || "",
      ends_at: data.ends_at || "",
      budget: Number(data.budget || 0),
      objective: data.objective || "conversion",
      summary: data.summary || "",
      status: "review",
      created_at: new Date().toISOString()
    };
    state.campaigns = [campaign, ...state.campaigns];
    renderCampaigns();
    renderActionCenter();
    renderOnboarding();
    renderNotificationBadges();
    form.reset();
    toast("Kampanya planı oluşturuldu ve onay akışına hazırlandı.");
    if (App.complianceAudit) {
      await App.complianceAudit.record({
        category: "partner",
        action: "campaign_plan_created",
        severity: "info",
        resourceType: "partner_campaign",
        resourceId: campaign.id,
        evidenceTags: ["partner_os", "growth"],
        metadata: {
          campaign_type: campaign.campaign_type,
          objective: campaign.objective,
          budget: campaign.budget
        }
      });
    }
  }

  async function updateOrder(orderId, payload) {
    try {
      await apiFetch("/v1/partner/orders/status", {
        method: "PATCH",
        body: JSON.stringify({ orderId, ...payload })
      });
      if (App.complianceAudit) {
        await App.complianceAudit.record({
          category: "partner",
          action: "order_status_updated",
          severity: "info",
          resourceType: "order",
          resourceId: orderId,
          evidenceTags: ["partner_os", "order"],
          metadata: {
            changed_fields: Object.keys(payload)
          }
        });
      }
      toast("Sipariş güncellendi.");
    } catch (error) {
      toast(error.message || "Sipariş güncellenemedi.", "error");
    }
  }

  async function refreshRefundCancellations() {
    const payload = await apiFetch("/v1/partner/refund-cancellations");
    state.refundCancellations = payload.items || [];
    state.metrics = {
      ...(state.metrics || {}),
      refund_cancellation_pending_count: payload.summary?.pending_partner || 0,
      refund_cancellation_dispute_count: payload.summary?.disputes || 0
    };
    renderKpis();
    renderActionCenter();
    renderRefundCancellations();
    renderNotificationBadges();
  }

  async function runRefundDecision(orderId, action) {
    const item = (state.refundCancellations || []).find((entry) => String(entry.id) === String(orderId));
    const label = action === "reject_request" ? "İhtilafa gönder" : "Kabul et";
    const defaultReason = action === "reject_request"
      ? "Partner sözleşme ve iade koşullarına göre talebi admin ihtilaf incelemesine gönderdi."
      : "Partner sözleşme ve iade koşullarına göre talebi kabul etti.";
    const reason = window.prompt(`${label} nedeni`, defaultReason);
    if (!reason) return;
    const noteInput = window.prompt("Ek açıklama", item?.reason || "");
    const note = noteInput === null ? "" : noteInput;
    try {
      const payload = await apiFetch(`/v1/partner/refund-cancellations/${encodeURIComponent(orderId)}/decision`, {
        method: "POST",
        body: JSON.stringify({ action, reason, note })
      });
      if (App.complianceAudit) {
        await App.complianceAudit.record({
          category: "partner",
          action: `refund_cancellation_${action}`,
          severity: action === "approve_refund" || action === "reject_request" ? "critical" : "warning",
          resourceType: "order",
          resourceId: orderId,
          evidenceTags: ["partner_os", "refund_cancellation"],
          metadata: {
            provider_dispatch: payload.provider_dispatch || null
          }
        });
      }
      await refreshRefundCancellations();
      toast(action === "reject_request" ? "Talep admin ihtilafına gönderildi." : "Talep kabul edildi ve ödeme bildirimi tetiklendi.");
    } catch (error) {
      toast(error.message || "İade/iptal kararı kaydedilemedi.", "error");
    }
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const nav = event.target.closest("[data-panel-target]");
      const jump = event.target.closest("[data-panel-jump]");
      const refresh = event.target.closest("[data-refresh-partner]");
      const logout = event.target.closest("[data-partner-logout]");
      const growth = event.target.closest("[data-growth-action]");
      const productAdd = event.target.closest("[data-product-add]");
      const productView = event.target.closest("[data-product-view-target]");
      const bulkTrigger = event.target.closest("[data-bulk-product-trigger]");
      const downloadTemplate = event.target.closest("[data-download-template]");
      const exportProducts = event.target.closest("[data-export-products]");
      const exportOrdersButton = event.target.closest("[data-export-orders]");
      const clearOrderFilters = event.target.closest("[data-clear-order-filters]");
      const orderCard = event.target.closest("[data-order-card-status]");
      const integrationMode = event.target.closest("[data-integration-mode]");
      const integrationTest = event.target.closest("[data-integration-test]");
      const integrationPreview = event.target.closest("[data-integration-preview]");
      const integrationSync = event.target.closest("[data-integration-sync]");
      const integrationApply = event.target.closest("[data-integration-apply]");
      const refundDetail = event.target.closest("[data-refund-detail]");
      const refundDecision = event.target.closest("[data-refund-decision]");

      if (nav) activatePanel(nav.dataset.panelTarget);
      if (jump) activatePanel(jump.dataset.panelJump);
      if (productView) {
        activatePanel("products");
        setProductView(productView.dataset.productViewTarget);
      }
      if (refresh) loadPartnerOs();
      if (logout) App.auth.signOut({ scope: "local" });
      if (growth) {
        activatePanel("growth");
        const form = $("[data-campaign-form]");
        if (form && form.elements.campaign_type) {
          const mapping = { coupon: "coupon", ads: "sponsored_listing", loyalty: "loyalty" };
          form.elements.campaign_type.value = mapping[growth.dataset.growthAction] || "coupon";
          form.elements.title.focus();
        }
      }
      if (productAdd) {
        activatePanel("products");
        setProductView("add", { focusForm: true });
      }
      if (bulkTrigger) {
        setProductView("add");
        const input = $("[data-bulk-product-input]");
        if (input) input.click();
      }
      if (downloadTemplate) {
        setProductView("add");
        downloadRows(productTemplateRows(), "allona-partner-urun-sablonu.xlsx", "UrunSablonu");
        toast("Excel yükleme şablonu indirildi.");
      }
      if (exportProducts) {
        downloadRows(rowsFromProducts(), "allona-partner-urunler.xlsx", "Urunler");
        toast("Katalog Excel dosyası indirildi.");
      }
      if (exportOrdersButton) exportOrders();
      if (clearOrderFilters) {
        state.orderFilters = { search: "", code: "", status: "all", quick: "all", pageSize: 50 };
        const search = $("[data-order-search]");
        const code = $("[data-order-code-filter]");
        const status = $("[data-order-status-filter]");
        const pageSize = $("[data-order-page-size]");
        if (search) search.value = "";
        if (code) code.value = "";
        if (status) status.value = "all";
        if (pageSize) pageSize.value = "50";
        renderOrders();
        toast("Sipariş filtreleri temizlendi.");
      }
      if (orderCard) {
        state.orderFilters.status = orderCard.dataset.orderCardStatus || "all";
        state.orderFilters.quick = orderCard.dataset.orderCardQuick || "all";
        const status = $("[data-order-status-filter]");
        if (status) status.value = state.orderFilters.status;
        renderOrders();
      }
      if (integrationMode) {
        if (integrationMode.dataset.integrationMode === "full" && !partnerHasFullIntegrationAccess()) {
          openIntegrationPremium("pro");
          return;
        }
        setIntegrationMode(integrationMode.dataset.integrationMode);
      }
      if (integrationTest) testIntegration(integrationTest.dataset.integrationTest);
      if (integrationPreview) syncIntegration(integrationPreview.dataset.integrationPreview, "preview");
      if (integrationSync) syncIntegration(integrationSync.dataset.integrationSync, "apply");
      if (integrationApply) syncIntegration(integrationApply.dataset.integrationApply, "apply");
      if (refundDetail) {
        state.selectedRefundId = state.selectedRefundId === refundDetail.dataset.refundDetail ? null : refundDetail.dataset.refundDetail;
        renderRefundCancellations();
      }
      if (refundDecision) runRefundDecision(refundDecision.dataset.refundOrder, refundDecision.dataset.refundDecision);
    });

    const paymentForm = $("[data-payment-form]");
    if (paymentForm) {
      paymentForm.addEventListener("submit", (event) => {
        event.preventDefault();
        createPaymentIntent(paymentForm);
      });
    }

    const productForm = $("[data-product-form]");
    if (productForm) {
      productForm.addEventListener("submit", (event) => {
        event.preventDefault();
        createProduct(productForm);
      });
    }

    const integrationForm = $("[data-integration-form]");
    if (integrationForm) {
      integrationForm.addEventListener("submit", (event) => {
        event.preventDefault();
        saveIntegration(integrationForm);
      });
      integrationForm.elements.provider?.addEventListener("change", applyIntegrationCredentialHints);
      applyIntegrationCredentialHints();
    }

    const bulkInput = $("[data-bulk-product-input]");
    if (bulkInput) {
      bulkInput.addEventListener("change", async () => {
        const file = bulkInput.files && bulkInput.files[0];
        bulkInput.value = "";
        try {
          await importProductFile(file);
        } catch (error) {
          toast(error.message || "Excel dosyası okunamadı.", "error");
        }
      });
    }

    const profileForm = $("[data-profile-form]");
    if (profileForm) {
      profileForm.addEventListener("submit", (event) => {
        event.preventDefault();
        saveProfile(profileForm);
      });
    }

    const supportForm = $("[data-support-form]");
    if (supportForm) {
      supportForm.addEventListener("submit", (event) => {
        event.preventDefault();
        createTicket(supportForm);
      });
    }

    const campaignForm = $("[data-campaign-form]");
    if (campaignForm) {
      campaignForm.addEventListener("submit", (event) => {
        event.preventDefault();
        createCampaign(campaignForm);
      });
    }

    const orderSearch = $("[data-order-search]");
    if (orderSearch) {
      orderSearch.addEventListener("input", () => {
        state.orderFilters.search = orderSearch.value;
        renderOrders();
      });
    }

    const orderCode = $("[data-order-code-filter]");
    if (orderCode) {
      orderCode.addEventListener("input", () => {
        state.orderFilters.code = orderCode.value;
        renderOrders();
      });
    }

    const orderStatus = $("[data-order-status-filter]");
    if (orderStatus) {
      orderStatus.addEventListener("change", () => {
        state.orderFilters.status = orderStatus.value || "all";
        state.orderFilters.quick = "all";
        renderOrders();
      });
    }

    const orderPageSize = $("[data-order-page-size]");
    if (orderPageSize) {
      orderPageSize.addEventListener("change", () => {
        state.orderFilters.pageSize = Number(orderPageSize.value || 50);
        renderOrders();
      });
    }

    const cargoCalculator = $("[data-cargo-calculator]");
    if (cargoCalculator) {
      cargoCalculator.addEventListener("submit", (event) => {
        event.preventDefault();
        renderCargoQuote(calculateCargoQuote(cargoCalculator));
      });
      cargoCalculator.addEventListener("input", () => {
        renderCargoQuote(calculateCargoQuote(cargoCalculator));
      });
      cargoCalculator.addEventListener("change", () => {
        renderCargoQuote(calculateCargoQuote(cargoCalculator));
      });
    }

    document.addEventListener("change", (event) => {
      const status = event.target.closest("[data-order-status]");
      if (status) updateOrder(status.dataset.orderStatus, { order_status: status.value });
    });

    document.addEventListener("blur", (event) => {
      const tracking = event.target.closest("[data-order-tracking]");
      if (tracking) updateOrder(tracking.dataset.orderTracking, { tracking_number: tracking.value });
    }, true);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.querySelector("[data-page='partner-os']")) return;
    bindEvents();
    loadPartnerOs();
  });
})();
