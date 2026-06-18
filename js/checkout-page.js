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

  function calculateOrderPayload(form) {
    const data = core.parseForm(form);
    const totals = App.cart.totals(lines, appliedCoupon);
    return {
      user_id: data.user_id,
      customer_name: data.full_name,
      customer_email: data.email,
      customer_phone: data.phone,
      shipping_address: {
        title: data.address_title || "Teslimat",
        address: data.shipping_address,
        district: data.shipping_district,
        city: data.shipping_city,
        zip_code: data.shipping_zip
      },
      billing_address: {
        type: data.invoice_type,
        tax_identity: data.tax_identity,
        tax_office: data.tax_office,
        address: data.billing_same === "on" ? data.shipping_address : data.billing_address,
        city: data.billing_same === "on" ? data.shipping_city : data.billing_city
      },
      coupon_code: data.coupon_code || null,
      address_id: null,
      subtotal: totals.subtotal,
      shipping_total: totals.shipping,
      discount_total: totals.discount,
      total: totals.total,
      total_amount: totals.total,
      shipping_fee: totals.shipping,
      discount_amount: totals.discount,
      status: "pending",
      legal_acceptances: {
        pre_info_accepted: data.pre_info_accepted === "on",
        distance_sales_accepted: data.distance_sales_accepted === "on",
        accepted_at: new Date().toISOString()
      },
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
        const payment = await App.db.payments.createIyzicoCheckout(order.id, buyer);
        if (payment && payment.paymentPageUrl) {
          window.location.href = payment.paymentPageUrl;
          return;
        }
        core.renderStatus("[data-checkout-status]", "Sipariş oluşturuldu ancak iyzico ödeme adresi dönmedi. Edge Function ayarlarını kontrol edin.", "error");
      } catch (error) {
        core.renderStatus("[data-checkout-status]", error.message || "Sipariş oluşturulamadı.", "error");
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
