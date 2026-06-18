(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
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

  function createOrderNo() {
    const now = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("");
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `ALN-${date}-${Date.now().toString(36).toUpperCase()}-${random}`;
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
      return "Sipariş kaydı için veritabanı alanları güncellenmeli. Lütfen kısa süre sonra tekrar deneyin veya Allona destek ile iletişime geçin.";
    }
    if (/row-level security|permission denied|unauthorized|forbidden/i.test(message)) {
      return "Sipariş oluşturmak için oturum yetkiniz doğrulanamadı. Lütfen çıkış yapıp tekrar giriş yapın.";
    }
    if (/failed to fetch|network|function|edge/i.test(message)) {
      return "Sipariş oluşturulurken bağlantı sorunu oluştu. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.";
    }
    return "Sipariş oluşturulamadı. Lütfen bilgilerinizi kontrol edip tekrar deneyin.";
  }

  function calculateOrderPayload(form) {
    const data = core.parseForm(form);
    const totals = App.cart.totals(lines, appliedCoupon);
    const acceptedAt = new Date().toISOString();
    const address = compactLines([
      data.shipping_address,
      data.shipping_district ? `İlçe: ${data.shipping_district}` : "",
      data.shipping_zip ? `Posta kodu: ${data.shipping_zip}` : "",
      data.billing_same === "on" ? "Fatura adresi teslimat adresiyle aynı." : "",
      data.billing_same !== "on" && data.billing_address ? `Fatura adresi: ${data.billing_address}` : "",
      data.billing_same !== "on" && data.billing_city ? `Fatura ili: ${data.billing_city}` : "",
      data.invoice_type ? `Fatura türü: ${data.invoice_type === "company" ? "Kurumsal" : "Bireysel"}` : "",
      data.identity_number ? `T.C./Vergi No: ${data.identity_number}` : "",
      data.tax_office ? `Vergi dairesi: ${data.tax_office}` : "",
      data.coupon_code ? `Kupon: ${String(data.coupon_code).trim().toUpperCase()}` : "",
      `Yasal onaylar: Ön bilgilendirme ve mesafeli satış sözleşmesi ${acceptedAt} tarihinde onaylandı.`
    ]);

    return {
      order_no: createOrderNo(),
      customer_name: data.full_name,
      customer_email: data.email,
      customer_phone: data.phone,
      city: data.shipping_city,
      address,
      subtotal: totals.subtotal,
      shipping: totals.shipping,
      discount: totals.discount,
      total: totals.total,
      order_status: "pending",
      payment_status: "pending"
    };
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
      button.disabled = true;

      try {
        const user = await App.auth.requireAuth();
        if (!user) return;
        if (!form.pre_info_accepted.checked || !form.distance_sales_accepted.checked) {
          core.renderStatus("[data-checkout-status]", "Ödeme öncesi yasal bilgilendirme ve mesafeli satış onayları zorunludur.", "error");
          return;
        }
        form.user_id.value = user.id;
        const orderPayload = calculateOrderPayload(form);
        const order = await App.db.orders.create(orderPayload, lines);
        const buyer = {
          identityNumber: form.identity_number.value || "11111111111",
          ip: "0.0.0.0"
        };
        let payment;
        try {
          payment = await App.db.payments.createIyzicoCheckout(order.id, buyer);
        } catch (paymentError) {
          core.renderStatus("[data-checkout-status]", "Siparişiniz kaydedildi fakat iyzico ödeme sayfası açılamadı. Lütfen kısa süre sonra tekrar deneyin veya Allona destek ile iletişime geçin.", "error");
          return;
        }
        if (payment && payment.paymentPageUrl) {
          window.location.href = payment.paymentPageUrl;
          return;
        }
        core.renderStatus("[data-checkout-status]", "Sipariş oluşturuldu ancak iyzico ödeme adresi dönmedi. Edge Function ayarlarını kontrol edin.", "error");
      } catch (error) {
        core.renderStatus("[data-checkout-status]", friendlyCheckoutError(error), "error");
      } finally {
        button.disabled = false;
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
