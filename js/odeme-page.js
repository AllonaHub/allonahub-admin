(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const security = App.security;
  let lines = [];
  let appliedCoupon = null;
  let savedAddresses = [];
  let checkoutUser = null;
  let checkoutProfile = null;
  const PAYMENT_HANDOFF_KEY = "allona_bank_payment_checkout";
  const COUPON_WALLET_KEY = "allonahub_user_coupons_v1";
  const FIRST_HP_CONVERSION_KEY = "allonahub_first_hp_conversion_v1";
  const HP_PER_TL = 8;

  function sellerName(product) {
    return product.seller_public_name || product.seller_name || "AllonaHub";
  }

  function sellerDisclosureLines() {
    return lines
      .map((item) => {
        const product = item.product || {};
        return `${product.name}: ${product.seller_kind || "Satıcı"} ${sellerName(product)}. ${product.invoice_responsibility || ""}`;
      })
      .filter(Boolean);
  }

  function uniqueSellerNames() {
    return [...new Set(lines.map((item) => sellerName(item.product || {})).filter(Boolean))].slice(0, 5);
  }

  function currencySettlementContext(totals) {
    const state = App.currency?.state || {};
    const displayCurrency = String(state.target || "TRY").toUpperCase();
    const settlementCurrency = String(state.base || App.config?.currency || "TRY").toUpperCase();
    return {
      displayCurrency,
      settlementCurrency,
      displayTotal: core.money(totals.total),
      settlementTotal: core.money(totals.total, { targetCurrency: settlementCurrency }),
      rateProvider: state.provider || "",
      rateUpdatedAt: state.updatedAt || 0,
      ratesReady: Boolean(state.ready)
    };
  }

  function paymentCurrencyDisclosure(totals) {
    const info = currencySettlementContext(totals);
    const sameCurrency = info.displayCurrency === info.settlementCurrency;
    return `
      <div class="payment-currency-disclosure" data-no-currency>
        <strong>Gösterilen fiyat / Tahsil edilecek para birimi</strong>
        <div><span>Gösterilen fiyat</span><b>${core.escapeHTML(info.displayTotal)} (${core.escapeHTML(info.displayCurrency)})</b></div>
        <div><span>Tahsil edilecek para birimi</span><b>${core.escapeHTML(info.settlementTotal)} (${core.escapeHTML(info.settlementCurrency)})</b></div>
        <p>${sameCurrency ? "Gösterim ve ödeme aynı para birimindedir." : "Seçili para birimi bilgilendirme amaçlı gösterilir; ödeme sağlayıcı tahsilatı TRY üzerinden tamamlar."}</p>
      </div>
    `;
  }

  function safeJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (error) {
      return fallback;
    }
  }

  function userKey(user) {
    return user && user.id ? `user:${user.id}` : "guest";
  }

  function walletCoupons(user) {
    const all = safeJson(COUPON_WALLET_KEY, {});
    const list = all[userKey(user)];
    return Array.isArray(list) ? list : [];
  }

  function writeWalletCoupons(user, coupons) {
    try {
      const all = safeJson(COUPON_WALLET_KEY, {});
      all[userKey(user)] = coupons;
      localStorage.setItem(COUPON_WALLET_KEY, JSON.stringify(all));
    } catch (error) {
      // Remote order data remains the source of truth.
    }
  }

  function firstHpUseAvailable(user) {
    const all = safeJson(FIRST_HP_CONVERSION_KEY, {});
    return !all[userKey(user)];
  }

  function markFirstHpUse(user, order) {
    if (!user || !firstHpUseAvailable(user)) return;
    try {
      const all = safeJson(FIRST_HP_CONVERSION_KEY, {});
      all[userKey(user)] = {
        code: order?.order_number || order?.order_no || order?.id || "checkout",
        used_at: new Date().toISOString()
      };
      localStorage.setItem(FIRST_HP_CONVERSION_KEY, JSON.stringify(all));
    } catch (error) {
      // The order still carries hp_to_use; this only blocks repeated first-use UI.
    }
  }

  function hpBuckets(profile) {
    return {
      total: Math.max(0, Number(profile?.hp || 0)),
      daily: Math.max(0, Number(profile?.cashout_balance || 0)),
      shopping: Math.max(0, Number(profile?.hub_cash || profile?.wallet_balance || 0))
    };
  }

  function allowedHpDiscount(requestedTl) {
    const requested = Math.max(0, Number(requestedTl || 0));
    if (!checkoutUser || !checkoutProfile || !requested) return requested;
    const buckets = hpBuckets(checkoutProfile);
    const requiredHp = Math.ceil(requested * HP_PER_TL);
    if (buckets.total < requiredHp) {
      return Math.floor(buckets.total / HP_PER_TL);
    }
    if (!firstHpUseAvailable(checkoutUser) && buckets.shopping <= 0) return 0;
    return requested;
  }

  function normalizeCoupon(row) {
    if (!row) return null;
    const status = String(row.status || (row.is_active === false ? "inactive" : "active")).toLowerCase();
    return {
      code: String(row.code || "").toUpperCase(),
      title: row.title || row.code || "Kupon",
      status,
      discount_type: row.discount_type || row.type || "fixed",
      discount_value: Number(row.discount_value || row.value || 0),
      max_discount: Number(row.max_discount || 0),
      min_order_total: Number(row.min_order_total || row.minimum_subtotal || 0),
      starts_at: row.starts_at || "",
      ends_at: row.ends_at || "",
      source: row.source || "campaign"
    };
  }

  function validateCoupon(coupon, totals) {
    if (!coupon || !coupon.code) throw new Error("Kupon bulunamadı.");
    if (coupon.status && !["active", "aktif"].includes(coupon.status)) throw new Error("Kupon aktif değil.");
    if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) throw new Error("Kupon henüz başlamadı.");
    if (coupon.ends_at && new Date(coupon.ends_at) < new Date()) throw new Error("Kupon süresi doldu.");
    if (Number(coupon.min_order_total || 0) > totals.subtotal) throw new Error("Sepet tutarı kupon için yeterli değil.");
    return coupon;
  }

  async function loadCouponFromUserWallet(code, user) {
    if (!user) return null;
    if (App.db && App.db.client) {
      try {
        const { data, error } = await App.db.client()
          .from("user_coupons")
          .select("*")
          .eq("user_id", user.id)
          .eq("code", code)
          .maybeSingle();
        if (error) throw error;
        if (data) return normalizeCoupon(data);
      } catch (error) {
        // Local wallet fallback follows.
      }
    }
    const local = walletCoupons(user).find((coupon) => String(coupon.code || "").toUpperCase() === code);
    return normalizeCoupon(local);
  }

  async function markCouponUsed(code, user) {
    if (!code || !user) return;
    const now = new Date().toISOString();
    const local = walletCoupons(user).map((coupon) => (
      String(coupon.code || "").toUpperCase() === code
        ? { ...coupon, status: "used", used_at: now }
        : coupon
    ));
    writeWalletCoupons(user, local);
    if (App.db && App.db.client) {
      await App.db.client()
        .from("user_coupons")
        .update({ status: "used", used_at: now })
        .eq("user_id", user.id)
        .eq("code", code);
    }
  }

  function renderSummary() {
    const node = document.querySelector("[data-checkout-summary]");
    if (!node) return;
    const form = document.querySelector("[data-checkout-form]");
    const hpToUse = allowedHpDiscount(form ? Number(form.hp_to_use && form.hp_to_use.value || 0) : 0);
    const totals = App.cart.totals(lines, appliedCoupon, hpToUse);
    const sellers = uniqueSellerNames();
    node.innerHTML = `
      <h2>Sipariş Özeti</h2>
      ${lines.map((item) => `
        <div class="summary-line summary-line--item">
          <span>
            ${core.escapeHTML(item.product.name)} × ${item.qty}
            <small>${core.escapeHTML(item.product.seller_kind || "Satıcı")}: ${core.escapeHTML(sellerName(item.product))}</small>
          </span>
          <strong>${core.money(item.product.price * item.qty)}</strong>
        </div>
      `).join("")}
      <div class="summary-line"><span>Ara toplam</span><strong>${core.money(totals.subtotal)}</strong></div>
      <div class="summary-line"><span>Kargo</span><strong>${totals.shipping ? core.money(totals.shipping) : "Ücretsiz"}</strong></div>
      <div class="summary-line"><span>Kupon</span><strong>-${core.money(totals.discount)}</strong></div>
      <div class="summary-line"><span>HP indirim hakkı</span><strong>-${core.money(totals.hpDiscount)}</strong></div>
      <div class="summary-line summary-line--total"><span>Toplam</span><strong>${core.money(totals.total)}</strong></div>
      ${paymentCurrencyDisclosure(totals)}
      <div class="summary-legal">
        <strong>Ödeme öncesi kontrol</strong>
        <p>${core.escapeHTML(sellers.join(", "))}${sellers.length === 5 ? " ve diğer satıcılar" : ""}</p>
        <p>Satıcı/fatura bilgileri, teslimat koşulları, cayma hakkı ve yasal metinler onay kutularıyla ödeme öncesinde sunulur.</p>
        <span>
          <a href="${core.url("/pages/legal/on-bilgilendirme.html")}" target="_blank" rel="noopener">Ön Bilgilendirme</a>
          <a href="${core.url("/pages/legal/mesafeli-satis.html")}" target="_blank" rel="noopener">Mesafeli Satış</a>
          <a href="${core.url("/pages/legal/etbis-guven-damgasi.html")}" target="_blank" rel="noopener">ETBİS/Güven</a>
        </span>
      </div>
    `;
  }

  function fillAddressForm(form, address) {
    if (!form || !address) return;
    form.full_name.value = address.full_name || form.full_name.value || "";
    form.phone.value = address.phone || form.phone.value || "";
    form.shipping_address.value = address.address || "";
    form.shipping_district.value = address.district || "";
    form.shipping_city.value = address.city || "";
    form.shipping_zip.value = address.zip_code || "";
  }

  async function loadSavedAddresses(user, form) {
    const select = form.address_id;
    if (!select) return;
    try {
      const { data, error } = await App.db.client()
        .from("addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      savedAddresses = data || [];
      select.innerHTML = `<option value="">Yeni adres bilgisiyle devam et</option>${savedAddresses.map((address) => `
        <option value="${core.escapeHTML(address.id)}" ${address.is_default ? "selected" : ""}>
          ${core.escapeHTML(address.title || "Adres")} - ${core.escapeHTML([address.district, address.city].filter(Boolean).join(" / "))}
        </option>
      `).join("")}`;
      const selected = savedAddresses.find((address) => String(address.id) === String(select.value)) || savedAddresses[0];
      if (selected) {
        select.value = selected.id;
        fillAddressForm(form, selected);
      } else {
        core.renderStatus("[data-checkout-status]", "Kayıtlı adresiniz yoksa formdaki teslimat adresi sipariş öncesi kaydedilir.", "info");
      }
    } catch (error) {
      core.renderStatus("[data-checkout-status]", "Adresler yüklenemedi. Formdaki teslimat adresi ile devam edebilirsiniz.", "warning");
    }
  }

  async function loadCheckout() {
    const form = document.querySelector("[data-checkout-form]");
    if (!form) return;

    const user = await App.auth.requireAuth();
    if (!user) return;
    checkoutUser = user;

    try {
      await App.cart.syncLocalToRemote();
      lines = await App.cart.hydrate();
      if (!lines.length) {
        core.renderStatus("[data-checkout-status]", "Güvenli ödeme için sepetinizde ürün olmalı.", "error");
        form.classList.add("hidden");
        return;
      }
      const profile = await App.auth.getProfile(user.id);
      if (window.AllonaProfileSync && window.AllonaProfileSync.createClient) {
        try {
          const loaded = await window.AllonaProfileSync.load(window.AllonaProfileSync.createClient());
          checkoutProfile = loaded?.profile || profile || null;
        } catch (error) {
          checkoutProfile = profile || null;
        }
      } else {
        checkoutProfile = profile || null;
      }
      if (profile) {
        form.full_name.value = profile.full_name || "";
        form.phone.value = profile.phone || "";
      }
      form.email.value = user.email || "";
      await loadSavedAddresses(user, form);
      renderSummary();
    } catch (error) {
      core.renderStatus("[data-checkout-status]", error.message || "Güvenli ödeme adımı yüklenemedi.", "error");
    }
  }

  function compactLines(lines) {
    return lines
      .map((line) => String(line || "").trim())
      .filter(Boolean)
      .join("\n");
  }

  function friendlyCheckoutError(error) {
    const message = `${error && error.message || ""} ${error && error.details || ""} ${error && error.hint || ""}`;
    if (/schema cache|could not find|column/i.test(message)) {
      return "Sipariş kaydı için veritabanı alanları güncellenmeli. Lütfen kısa süre sonra tekrar deneyin veya AllonaHub destek ile iletişime geçin.";
    }
    if (/row-level security|permission denied|unauthorized|forbidden/i.test(message)) {
      return "Sipariş oluşturmak için oturum yetkiniz doğrulanamadı. Lütfen çıkış yapıp tekrar giriş yapın.";
    }
    if (/failed to fetch|network|function|edge/i.test(message)) {
      return "Ödeme sayfasına yönlendirilirken bağlantı sorunu oluştu. Lütfen tekrar deneyin.";
    }
    return "Sipariş oluşturulamadı. Lütfen bilgilerinizi kontrol edip tekrar deneyin.";
  }

  function isTrustedBankPaymentUrl(value) {
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

  function storePaymentHandoff(payment, order, currencyContext) {
    const paymentPageUrl = payment && payment.paymentPageUrl;
    if (!paymentPageUrl || !isTrustedBankPaymentUrl(paymentPageUrl)) {
      throw new Error("banka güvenli ödeme bağlantısı doğrulanamadı.");
    }

    const payload = {
      provider: "bank_payment",
      orderId: order && order.id,
      orderNo: order && (order.order_number || order.order_no || order.id),
      paymentPageUrl,
      token: payment.token || "",
      displayCurrency: currencyContext?.displayCurrency || "",
      settlementCurrency: currencyContext?.settlementCurrency || "TRY",
      displayTotal: currencyContext?.displayTotal || "",
      settlementTotal: currencyContext?.settlementTotal || "",
      createdAt: Date.now(),
      expiresAt: Date.now() + (15 * 60 * 1000)
    };

    try {
      sessionStorage.setItem(PAYMENT_HANDOFF_KEY, JSON.stringify(payload));
      return true;
    } catch (error) {
      return false;
    }
  }

  function calculateOrderPayload(form) {
    const data = core.parseForm(form);
    const clean = {
      full_name: security ? security.normalizeText(data.full_name, { max: 120 }) : String(data.full_name || "").trim(),
      phone: security ? security.normalizeText(data.phone, { max: 30 }) : String(data.phone || "").trim(),
      email: security ? security.normalizeText(data.email, { max: 180 }).toLowerCase() : String(data.email || "").trim().toLowerCase(),
      shipping_address: security ? security.normalizeMultiline(data.shipping_address, { max: 700 }) : String(data.shipping_address || "").trim(),
      shipping_district: security ? security.normalizeText(data.shipping_district, { max: 90 }) : String(data.shipping_district || "").trim(),
      shipping_city: security ? security.normalizeText(data.shipping_city, { max: 90 }) : String(data.shipping_city || "").trim(),
      shipping_zip: security ? security.normalizeText(data.shipping_zip, { max: 20 }) : String(data.shipping_zip || "").trim(),
      billing_address: security ? security.normalizeMultiline(data.billing_address, { max: 700 }) : String(data.billing_address || "").trim(),
      billing_city: security ? security.normalizeText(data.billing_city, { max: 90 }) : String(data.billing_city || "").trim(),
      invoice_type: data.invoice_type === "company" ? "company" : "individual",
      tax_office: security ? security.normalizeText(data.tax_office, { max: 90 }) : String(data.tax_office || "").trim(),
      coupon_code: security ? security.normalizeText(data.coupon_code, { max: 40 }).toUpperCase() : String(data.coupon_code || "").trim().toUpperCase(),
      address_id: security && data.address_id && security.isUuid(data.address_id) ? data.address_id : "",
      hp_to_use: Math.max(0, Math.min(100, allowedHpDiscount(Number(data.hp_to_use || 0)))),
      billing_same: data.billing_same
    };
    validateCheckoutData(clean);
    const totals = App.cart.totals(lines, appliedCoupon, clean.hp_to_use);
    const acceptedAt = new Date().toISOString();
    const address = compactLines([
      clean.shipping_address,
      clean.shipping_district ? `İlçe: ${clean.shipping_district}` : "",
      clean.shipping_city ? `İl: ${clean.shipping_city}` : "",
      clean.shipping_zip ? `Posta kodu: ${clean.shipping_zip}` : "",
      clean.billing_same === "on" ? "Fatura adresi teslimat adresiyle aynı." : "",
      clean.billing_same !== "on" && clean.billing_address ? `Fatura adresi: ${clean.billing_address}` : "",
      clean.billing_same !== "on" && clean.billing_city ? `Fatura ili: ${clean.billing_city}` : "",
      clean.invoice_type ? `Fatura türü: ${clean.invoice_type === "company" ? "Kurumsal" : "Bireysel"}` : "",
      clean.tax_office ? `Vergi dairesi: ${clean.tax_office}` : "",
      clean.coupon_code ? `Kupon: ${clean.coupon_code}` : "",
      ...sellerDisclosureLines().map((line) => `Satıcı bilgilendirmesi: ${line}`),
      `Yasal onaylar: Ön bilgilendirme, satıcı/teslimat/fatura bilgisi ve mesafeli satış sözleşmesi ${acceptedAt} tarihinde onaylandı.`
    ]);

    return {
      customer_name: clean.full_name,
      customer_phone: clean.phone,
      customer_email: clean.email,
      city: clean.shipping_city,
      address,
      subtotal: totals.subtotal,
      discount: totals.discount,
      shipping: totals.shipping,
      total: totals.total,
      coupon_code: clean.coupon_code,
      address_id: clean.address_id,
      hp_to_use: clean.hp_to_use,
      payment_status: "pending",
      order_status: "pending",
      partner_status: "pending",
      tracking_number: "",
      cargo_company: ""
    };
  }

  function validateCheckoutData(data) {
    if (!lines.length) throw new Error("Sepetinizde ürün bulunmalıdır.");
    if (!data.full_name || data.full_name.length < 2) throw new Error("Ad soyad bilgisini kontrol edin.");
    if (security && !security.isPhone(data.phone)) throw new Error("Telefon numarasını kontrol edin.");
    if (security && !security.isEmail(data.email)) throw new Error("E-posta adresini kontrol edin.");
    if (!data.shipping_city || data.shipping_city.length < 2) throw new Error("İl bilgisini kontrol edin.");
    if (!data.shipping_address || data.shipping_address.length < 10) throw new Error("Teslimat adresini kontrol edin.");
  }

  async function ensureCheckoutAddress(form, user, orderPayload) {
    if (orderPayload.address_id) return orderPayload.address_id;

    const payload = {
      user_id: user.id,
      title: "Güvenli Ödeme Teslimat",
      full_name: orderPayload.customer_name,
      phone: orderPayload.customer_phone,
      address: form.shipping_address.value,
      district: form.shipping_district.value,
      city: form.shipping_city.value,
      zip_code: form.shipping_zip.value,
      is_default: savedAddresses.length === 0
    };

    const { data, error } = await App.db.client()
      .from("addresses")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      throw new Error("Adres kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin.");
    }

    return data.id;
  }

  function bindCheckout() {
    const form = document.querySelector("[data-checkout-form]");
    if (!form) return;

    async function applyCoupon() {
      const code = String(form.coupon_code.value || "").trim().toUpperCase();
      appliedCoupon = null;
      if (!code) {
        renderSummary();
        return;
      }

      try {
        const totals = App.cart.totals(lines);
        const { data, error } = await App.db.client()
          .from("coupons")
          .select("*")
          .eq("code", code)
          .maybeSingle();
        let coupon = null;
        if (!error && data) coupon = normalizeCoupon(data);
        if (!coupon) coupon = await loadCouponFromUserWallet(code, checkoutUser || await App.auth.getUser());
        if (error && !coupon) throw error;
        if (data && data.usage_limit && Number(data.used_count || 0) >= Number(data.usage_limit)) throw new Error("Kupon kullanım limiti doldu.");
        coupon = validateCoupon(coupon, totals);

        const previewDiscount = coupon.discount_type === "percent"
          ? totals.subtotal * (Number(coupon.discount_value || 0) / 100)
          : Number(coupon.discount_value || 0);
        appliedCoupon = {
          type: "fixed",
          value: coupon.max_discount ? Math.min(previewDiscount, Number(coupon.max_discount || 0)) : previewDiscount,
          code: coupon.code,
          source: coupon.source
        };
        core.renderStatus("[data-checkout-status]", "Kupon uygulandı.", "success");
      } catch (error) {
        appliedCoupon = null;
        core.renderStatus("[data-checkout-status]", error.message || "Kupon uygulanamadı.", "error");
      }
      renderSummary();
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = "Ödeme hazırlanıyor...";

      try {
        const limit = security && security.rateLimit("checkout", { limit: 5, windowMs: 10 * 60 * 1000 });
        if (limit && !limit.allowed) {
          throw new Error("Çok sık ödeme denemesi yapıldı. Lütfen biraz bekleyin.");
        }
        const user = await App.auth.requireAuth();
        if (!user) return;
        if (!form.pre_info_accepted.checked || !form.seller_info_accepted.checked || !form.distance_sales_accepted.checked) {
          core.renderStatus("[data-checkout-status]", "Ödeme öncesi satıcı, yasal bilgilendirme ve mesafeli satış onayları zorunludur.", "error");
          return;
        }
        await App.cart.syncLocalToRemote();
        const orderPayload = calculateOrderPayload(form);
        const currencyContext = currencySettlementContext(App.cart.totals(lines, appliedCoupon, orderPayload.hp_to_use));
        orderPayload.address_id = await ensureCheckoutAddress(form, user, orderPayload);
        const order = await App.db.orders.create(orderPayload, lines);
        if (orderPayload.coupon_code) {
          await markCouponUsed(orderPayload.coupon_code, user).catch(() => null);
        }
        if (orderPayload.hp_to_use > 0) {
          markFirstHpUse(user, order);
        }
        if (App.complianceAudit) {
          await App.complianceAudit.record({
            category: "order",
            action: "checkout_order_created",
            severity: "info",
            resourceType: "order",
            resourceId: order && order.id,
            evidenceTags: ["checkout", "order"],
            metadata: {
              item_count: lines.length,
              city: orderPayload.city,
              payment_currency: currencyContext,
              legal_acceptance: {
                pre_info: Boolean(form.pre_info_accepted.checked),
                seller_info: Boolean(form.seller_info_accepted.checked),
                distance_sales: Boolean(form.distance_sales_accepted.checked)
              }
            }
          });
        }
        const buyer = {
          email: form.email.value,
          phone: form.phone.value,
          ip: "0.0.0.0"
        };
        let payment;
        try {
          payment = await App.db.payments.createBankCheckout(order.id, buyer);
        } catch (paymentError) {
          core.renderStatus("[data-checkout-status]", "Siparişiniz kaydedildi fakat güvenli ödeme oturumu açılamadı. Lütfen kısa süre sonra tekrar deneyin veya AllonaHub destek ile iletişime geçin.", "error");
          return;
        }
        if (payment && payment.paymentPageUrl) {
          const handoffStored = storePaymentHandoff(payment, order, currencyContext);
          if (App.complianceAudit) {
            await App.complianceAudit.record({
              category: "payment",
              action: "bank_checkout_redirect",
              severity: "info",
              resourceType: "order",
              resourceId: order && order.id,
              evidenceTags: ["checkout", "payment_provider"],
              metadata: { provider: "bank_payment", payment_currency: currencyContext }
            });
          }
          App.cart.setItems([]);
          if (handoffStored) {
            window.location.href = core.url("/pages/commerce/bank-payment.html");
          } else {
            window.location.href = payment.paymentPageUrl;
          }
          return;
        }
        core.renderStatus("[data-checkout-status]", "Sipariş oluşturuldu ancak güvenli ödeme oturumu açılamadı. Lütfen kısa süre sonra tekrar deneyin.", "error");
      } catch (error) {
        const message = /kontrol edin|Sepetinizde|bekleyin|Adres kaydedilemedi/i.test(error.message || "")
          ? error.message
          : friendlyCheckoutError(error);
        core.renderStatus("[data-checkout-status]", message, "error");
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });

    form.addEventListener("change", (event) => {
      if (event.target.name === "billing_same") {
        document.querySelectorAll("[data-billing-extra]").forEach((node) => {
          node.classList.toggle("hidden", event.target.checked);
        });
      }
      if (event.target.name === "coupon_code") {
        applyCoupon();
      }
      if (event.target.name === "address_id") {
        const selected = savedAddresses.find((address) => String(address.id) === String(event.target.value));
        if (selected) fillAddressForm(form, selected);
      }
      if (event.target.name === "hp_to_use") {
        renderSummary();
      }
    });

    form.addEventListener("input", (event) => {
      if (event.target.name === "hp_to_use") renderSummary();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.querySelector("[data-page='checkout']")) return;
    bindCheckout();
    loadCheckout();
    document.addEventListener("allona:currency-changed", () => renderSummary());
  });
})();
