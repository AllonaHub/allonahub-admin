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
    metrics: {},
    recommendations: []
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

  function currentCatalogScope() {
    const businessType = String(state.business?.partner_type || "").toLocaleLowerCase("tr-TR");
    if (["market", "grocery", "supermarket", "süpermarket"].includes(businessType)) return "market";
    if (["food", "restaurant", "restoran", "yemek"].includes(businessType)) return "food";
    if (["service", "hizmet"].includes(businessType)) return "service";
    return "shop";
  }

  function catalogProfile(scope) {
    const profiles = {
      market: {
        href: "../commerce/allonamarket.html",
        label: "Markete Git",
        category: "Market / Kahvaltı",
        brand: "Allona Market Partneri",
        image: "/images/modules/market-water-pack.png"
      },
      food: {
        href: "../commerce/allonayemek.html",
        label: "Yemek Vitrinine Git",
        category: "Yemek / Menü",
        brand: "Allona Burger House",
        image: "/images/modules/yemek-light-v5.jpg"
      },
      service: {
        href: "../ecosystem/ecosystem.html",
        label: "Ekosisteme Git",
        category: "Hizmet / Operasyon",
        brand: "Allona Partner",
        image: "/images/product-fallback.svg"
      },
      shop: {
        href: "../commerce/allonashop.html",
        label: "Mağazaya Git",
        category: "Genel",
        brand: "Allona Shop Partneri",
        image: "/images/modules/allona-shop.png"
      }
    };
    return profiles[scope] || profiles.shop;
  }

  function applyCatalogProfile() {
    const scope = currentCatalogScope();
    const profile = catalogProfile(scope);
    const storeLink = $("[data-partner-store-link]");
    const storeLabel = $("[data-partner-store-label]");
    const productForm = $("[data-product-form]");
    if (storeLink) storeLink.href = profile.href;
    if (storeLabel) storeLabel.textContent = profile.label;
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

  function renderAll() {
    applyBusinessProfile();
    renderKpis();
    renderRecommendations();
    renderRecentPayments();
    renderPaymentRows();
    renderProducts();
    renderOrders();
    renderFinance();
    renderOperations();
    renderTickets();
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

  async function createProduct(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const scope = ["shop", "market", "food", "service"].includes(data.catalog_scope) ? data.catalog_scope : "shop";
    const profile = catalogProfile(scope);
    const businessName = state.business?.display_name || state.business?.legal_name || state.access.profile?.full_name || "Allona Partner";
    const payload = {
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
      sku: core.slugify(`${scope === "market" ? "ALM" : scope === "food" ? "ALY" : scope === "service" ? "ALS" : "ALP"}-${data.name}-${Date.now()}`).toUpperCase().slice(0, 48)
    };
    if (!payload.name || payload.price < 0) {
      toast("Ürün adı ve fiyat alanını kontrol edin.", "error");
      return;
    }
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    try {
      const created = await App.db.products.upsert(payload);
      state.products = [created, ...state.products];
      state.metrics.product_count = state.products.length;
      state.metrics.active_product_count = state.products.filter((item) => item.status === "active").length;
      state.metrics.low_stock_count = state.products.filter((item) => Number(item.stock || 0) <= 5).length;
      renderProducts();
      renderKpis();
      if (App.complianceAudit) {
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
            status: created.status || "draft"
          }
        });
      }
      form.reset();
      toast(scope === "market" ? "Market ürünü canlı kataloğa eklendi." : scope === "food" ? "Yemek ürünü canlı kataloğa eklendi." : "Ürün kataloğa eklendi.");
    } catch (error) {
      toast(error.message || "Ürün kaydedilemedi. Partner yetkisi veya ürün şemasını kontrol edin.", "error");
    } finally {
      button.disabled = false;
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
      const productDemo = event.target.closest("[data-product-demo]");

      if (nav) activatePanel(nav.dataset.panelTarget);
      if (jump) activatePanel(jump.dataset.panelJump);
      if (refresh) loadPartnerOs();
      if (logout) App.auth.signOut({ scope: "local" });
      if (growth) toast("Kampanya modülü için plan kaydı hazır. Bir sonraki adımda reklam bütçesi, tarih ve hedef kitle formu bağlanacak.");
      if (productDemo) toast("Aşağıdaki form ürünü yeni şemaya uygun taslak olarak kaydeder.");
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
