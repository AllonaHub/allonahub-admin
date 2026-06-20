(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const security = App.security;
  let lines = [];
  let appliedCoupon = null;

  function renderSummary() {
    const node = document.querySelector("[data-checkout-summary]");
    if (!node) return;
    const totals = App.cart.totals(lines, appliedCoupon);
    node.innerHTML = `
      <h2>Sipariş Özeti</h2>
      ${lines.map((item) => `
        <div class="summary-line">
          <span>${core.escapeHTML(item.product.name)} × ${item.qty}</span>
          <strong>${core.money(item.product.price * item.qty)}</strong>
        </div>
      `).join("")}
      <div class="summary-line"><span>Ara toplam</span><strong>${core.money(totals.subtotal)}</strong></div>
      <div class="summary-line"><span>Kargo</span><strong>${totals.shipping ? core.money(totals.shipping) : "Ücretsiz"}</strong></div>
      <div class="summary-line"><span>Kupon</span><strong>-${core.money(totals.discount)}</strong></div>
      <div class="summary-line summary-line--total"><span>Toplam</span><strong>${core.money(totals.total)}</strong></div>
    `;
  }

  async function loadCheckout() {
    const form = document.querySelector("[data-checkout-form]");
    if (!form) return;

    const user = await App.auth.requireAuth();
    if (!user) return;

    try {
      lines = await App.cart.hydrate();
      if (!lines.length) {
        core.renderStatus("[data-checkout-status]", "Checkout için sepetinizde ürün olmalı.", "error");
        form.classList.add("hidden");
      }
      const profile = await App.auth.getProfile(user.id);
      if (profile) {
        form.full_name.value = profile.full_name || "";
        form.phone.value = profile.phone || "";
      }
      form.email.value = user.email || "";
      renderSummary();
    } catch (error) {
      core.renderStatus("[data-checkout-status]", error.message || "Checkout yüklenemedi.", "error");
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
      billing_same: data.billing_same
    };
    validateCheckoutData(clean);
    const totals = App.cart.totals(lines, appliedCoupon);
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
      `Yasal onaylar: Ön bilgilendirme ve mesafeli satış sözleşmesi ${acceptedAt} tarihinde onaylandı.`
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
      payment_status: "pending",
      order_status: "pending",
      partner_status: "new",
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
          .eq("status", "active")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Kupon bulunamadı.");
        if (data.starts_at && new Date(data.starts_at) > new Date()) throw new Error("Kupon henüz başlamadı.");
        if (data.ends_at && new Date(data.ends_at) < new Date()) throw new Error("Kupon süresi doldu.");
        if (Number(data.minimum_subtotal || 0) > totals.subtotal) throw new Error("Sepet tutarı kupon için yeterli değil.");
        if (data.usage_limit && Number(data.used_count || 0) >= Number(data.usage_limit)) throw new Error("Kupon kullanım limiti doldu.");

        appliedCoupon = {
          type: data.discount_type === "percent" ? "percent" : "fixed",
          value: Number(data.discount_value || 0)
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
        if (!form.pre_info_accepted.checked || !form.distance_sales_accepted.checked) {
          core.renderStatus("[data-checkout-status]", "Ödeme öncesi yasal bilgilendirme ve mesafeli satış onayları zorunludur.", "error");
          return;
        }
        const orderPayload = calculateOrderPayload(form);
        const order = await App.db.orders.create(orderPayload, lines);
        const buyer = {
          email: form.email.value,
          phone: form.phone.value
        };
        let payment;
        try {
          payment = await App.db.payments.createIyzicoCheckout(order.id, buyer);
        } catch (paymentError) {
          core.renderStatus("[data-checkout-status]", "Siparişiniz kaydedildi fakat güvenli ödeme oturumu açılamadı. Lütfen kısa süre sonra tekrar deneyin veya AllonaHub destek ile iletişime geçin.", "error");
          return;
        }
        if (payment && payment.paymentPageUrl) {
          window.location.href = payment.paymentPageUrl;
          return;
        }
        core.renderStatus("[data-checkout-status]", "Sipariş oluşturuldu ancak güvenli ödeme oturumu açılamadı. Lütfen kısa süre sonra tekrar deneyin.", "error");
      } catch (error) {
        const message = /kontrol edin|Sepetinizde|bekleyin|Güvenli sipariş servisi/i.test(error.message || "")
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
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.querySelector("[data-page='checkout']")) return;
    bindCheckout();
    loadCheckout();
  });
})();
