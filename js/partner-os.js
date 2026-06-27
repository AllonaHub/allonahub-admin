(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;

  const state = {
    access: null,
    business: null,
    products: [],
    orders: [],
    paymentIntents: [],
    transactions: [],
    payouts: [],
    locations: [],
    devices: [],
    qrCodes: [],
    tickets: [],
    campaigns: [],
    metrics: {},
    recommendations: []
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
    "image_url",
    "description",
    "sku"
  ];

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
    if (["active", "paid", "settled", "delivered", "verified"].includes(status)) return "partner-os-status--good";
    if (["pending", "created", "awaiting_payment", "provider_pending", "review", "preparing"].includes(status)) return "partner-os-status--warn";
    if (["failed", "cancelled", "expired", "rejected", "suspended", "blocked"].includes(status)) return "partner-os-status--bad";
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
      approved: "Onaylandı"
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

  function renderActionCenter() {
    const target = $("[data-action-center]");
    if (!target) return;
    const metrics = state.metrics || {};
    const actions = [];
    if (!state.products.length) actions.push(["İlk ürünü ekle", "fa-box-open", "products", "primary"]);
    if (!state.paymentIntents.length) actions.push(["Ödeme isteği oluştur", "fa-qrcode", "payments", "primary"]);
    if (!state.campaigns.length) actions.push(["Kampanya planla", "fa-bullhorn", "growth", ""]);
    if (Number(metrics.open_order_count || 0) > 0) actions.push(["Siparişleri güncelle", "fa-truck-fast", "orders", ""]);
    if (!actions.length) {
      actions.push(["Performansı incele", "fa-chart-line", "finance", "primary"], ["Destek merkezini aç", "fa-headset", "support", ""]);
    }
    target.innerHTML = actions.slice(0, 4).map((item) => actionButton(...item)).join("");
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
      iyzico_checkout: "iyzico Checkout",
      iyzico_link: "iyzico Link",
      iyzico_cep_pos: "iyzico Cep POS",
      visa_tap_to_phone: "Visa Tap to Phone",
      mastercard_tap_on_phone: "Mastercard Tap on Phone",
      bank_pos: "Banka POS",
      manual: "Manuel"
    };
    return labels[provider] || provider || "-";
  }

  function renderProducts() {
    const target = $("[data-product-rows]");
    if (!target) return;
    if (!state.products.length) {
      target.innerHTML = `<tr><td colspan="6">Henüz ürün veya hizmet eklenmedi.</td></tr>`;
      return;
    }
    target.innerHTML = state.products.map((raw) => {
      const product = core.normalizeProduct(raw);
      const signal = product.stock <= 0 ? "Stok yok" : product.stock <= 5 ? "Kritik stok" : "Satışa hazır";
      const signalStatus = product.stock <= 0 ? "failed" : product.stock <= 5 ? "pending" : "active";
      return `
        <tr>
          <td><strong>${escape(product.name)}</strong><br><small>${escape(core.truncate(product.description || "", 64))}</small></td>
          <td>${escape(product.category)}</td>
          <td>${money(product.price)}</td>
          <td>${escape(product.stock)}</td>
          <td>${statusPill(product.status)}</td>
          <td>${statusPill(signalStatus).replace(statusLabel(signalStatus), escape(signal))}</td>
        </tr>
      `;
    }).join("");
  }

  function renderOrders() {
    const target = $("[data-order-rows]");
    if (!target) return;
    if (!state.orders.length) {
      target.innerHTML = `<tr><td colspan="6">Bu partnere ait sipariş görünmüyor.</td></tr>`;
      return;
    }
    target.innerHTML = state.orders.map((order) => {
      const items = order.partner_items || order.order_items || [];
      return `
        <tr>
          <td><strong>${escape(order.order_no || order.order_number || order.id)}</strong><br><small>${formatDate(order.created_at)}</small></td>
          <td>${escape(items.map((item) => item.product_name || item.product?.name || "Ürün").join(", "))}</td>
          <td>${money(order.partner_total || order.total || order.total_amount)}</td>
          <td>
            <select data-order-status="${escape(order.id)}">
              ${["confirmed", "preparing", "shipped", "delivered", "cancelled"].map((status) => `<option value="${status}" ${order.order_status === status ? "selected" : ""}>${escape(statusLabel(status))}</option>`).join("")}
            </select>
          </td>
          <td>${statusPill(order.payment_status || "pending")}</td>
          <td><input data-order-tracking="${escape(order.id)}" value="${escape(order.tracking_number || "")}" placeholder="Takip no"></td>
        </tr>
      `;
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
        { device_label: "Android NFC SoftPOS", device_type: "android_softpos", provider: "iyzico_cep_pos", status: "pending" },
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
    renderStoreHealth();
    renderActionCenter();
    renderAnnouncements();
    renderOnboarding();
    renderRecommendations();
    renderRecentPayments();
    renderPaymentRows();
    renderProducts();
    renderOrders();
    renderFinance();
    renderOperations();
    renderTickets();
    renderCampaigns();
    renderAcademy();
  }

  async function loadFallbackData() {
    const access = state.access;
    const business = {
      id: `local-${access.user.id}`,
      owner_id: access.user.id,
      display_name: access.profile.full_name || access.user.email || "Allona Partner",
      partner_code: "LOCAL-PARTNER",
      partner_type: "shop",
      status: "active",
      verification_status: "pending",
      trust_score: 72,
      level: 1,
      default_commission_rate: 0.12,
      email: access.user.email,
      phone: access.profile.phone || ""
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
    state.locations = [];
    state.devices = [];
    state.qrCodes = [];
    state.tickets = [];
    state.campaigns = [];
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
      try {
        const payload = await apiFetch("/v1/partner/os");
        Object.assign(state, {
          business: payload.business,
          products: payload.products || [],
          orders: payload.orders || [],
          paymentIntents: payload.paymentIntents || [],
          transactions: payload.transactions || [],
          payouts: payload.payouts || [],
          locations: payload.locations || [],
          devices: payload.devices || [],
          qrCodes: payload.qrCodes || [],
          tickets: payload.tickets || [],
          campaigns: payload.campaigns || [],
          metrics: payload.metrics || {},
          recommendations: payload.recommendations || []
        });
        showAlert("");
      } catch (error) {
        await loadFallbackData();
        showAlert("Partner API şu an erişilemedi; panel güvenli yerel fallback ile açıldı. Canlı yayında API aktif olduğunda tüm modüller veri çeker.");
      }
      renderAll();
    } catch (error) {
      showAlert(error.message || "Bu alana erişim yetkiniz yok.", "error");
    }
  }

  function activatePanel(id) {
    $all("[data-panel-section]").forEach((section) => section.classList.toggle("is-active", section.id === id));
    $all("[data-panel-target]").forEach((button) => button.classList.toggle("is-active", button.dataset.panelTarget === id));
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      provider: channel === "nfc" ? "iyzico_cep_pos" : channel === "payment_link" ? "iyzico_link" : "iyzico_checkout",
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
    return {
      name: data.name,
      description: data.description || "",
      category: data.category || profile.category,
      brand: data.brand || businessName,
      price: Number(data.price || 0),
      stock: Number(data.stock || 0),
      status: ["active", "draft"].includes(data.status) ? data.status : "active",
      module_key: scope,
      catalog_scope: scope,
      partner_id: state.access.user.id,
      partner_code: state.business?.partner_code || state.business?.id || state.access.user.id,
      partner_email: state.access.user.email || "",
      image_url: data.image_url || profile.image,
      slug: core.slugify(`${data.name}-${Date.now()}`),
      coupon_status: scope === "food" ? "Menü kuponu" : scope === "market" ? "Market kuponu" : "Aktif",
      hp_status: scope === "food" ? "HP kazandırır" : scope === "market" ? "Market HP" : "Aktif",
      sku: data.sku || core.slugify(`${profile.skuPrefix}-${data.name}-${Date.now()}`).toUpperCase().slice(0, 48)
    };
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
    renderKpis();
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
      toast(scope === "market" ? "Market ürünü canlı kataloğa eklendi." : scope === "food" ? "Yemek ürünü canlı kataloğa eklendi." : "Ürün kataloğa eklendi.");
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
      image_url: profile.image,
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
      image_url: item.image_url || "",
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

  function downloadRows(rows, filename, sheetName) {
    const normalizedRows = rows.length ? rows : [PRODUCT_TEMPLATE_COLUMNS.reduce((row, key) => ({ ...row, [key]: "" }), {})];
    if (window.XLSX) {
      const worksheet = window.XLSX.utils.json_to_sheet(normalizedRows, { header: PRODUCT_TEMPLATE_COLUMNS });
      const workbook = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      window.XLSX.writeFile(workbook, filename);
      return;
    }
    const csv = [
      PRODUCT_TEMPLATE_COLUMNS.join(";"),
      ...normalizedRows.map((row) => PRODUCT_TEMPLATE_COLUMNS.map((key) => {
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
    showBulkResult(result);
    toast(result.failed ? "Toplu yükleme tamamlandı; bazı satırlar atlandı." : "Toplu ürün yükleme tamamlandı.", result.failed ? "warning" : "success");
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

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const nav = event.target.closest("[data-panel-target]");
      const jump = event.target.closest("[data-panel-jump]");
      const refresh = event.target.closest("[data-refresh-partner]");
      const logout = event.target.closest("[data-partner-logout]");
      const growth = event.target.closest("[data-growth-action]");
      const productAdd = event.target.closest("[data-product-add]");
      const bulkTrigger = event.target.closest("[data-bulk-product-trigger]");
      const downloadTemplate = event.target.closest("[data-download-template]");
      const exportProducts = event.target.closest("[data-export-products]");

      if (nav) activatePanel(nav.dataset.panelTarget);
      if (jump) activatePanel(jump.dataset.panelJump);
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
        const form = $("[data-product-form]");
        if (form && form.elements.name) form.elements.name.focus();
      }
      if (bulkTrigger) {
        const input = $("[data-bulk-product-input]");
        if (input) input.click();
      }
      if (downloadTemplate) {
        downloadRows(productTemplateRows(), "allona-partner-urun-sablonu.xlsx", "UrunSablonu");
        toast("Excel yükleme şablonu indirildi.");
      }
      if (exportProducts) {
        downloadRows(rowsFromProducts(), "allona-partner-urunler.xlsx", "Urunler");
        toast("Katalog Excel dosyası indirildi.");
      }
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
