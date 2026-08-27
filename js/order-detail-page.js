(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const security = App.security;

  async function checkAccess(mode, user) {
    if (mode === "user") return true;
    const profile = await App.auth.getProfile(user.id);
    if (mode === "admin") return profile && ["admin", "super_admin"].includes(profile.role);
    if (mode === "partner") return profile && ["partner", "admin", "super_admin"].includes(profile.role);
    return false;
  }

  function apiBaseUrl() {
    const configured = String(App.config.apiBaseUrl || "").replace(/\/$/, "");
    if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) return "http://localhost:3000";
    return configured || "https://api.allonahub.com";
  }

  async function loadPartnerOrder(orderId) {
    const session = await App.auth.getSession();
    if (!session || !session.access_token) throw new Error("API için oturum doğrulanamadı.");
    const response = await fetch(`${apiBaseUrl()}/v1/partner/os`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json"
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.message || payload.error || "Partner siparişi yüklenemedi.");
    }
    const order = (payload.orders || []).find((item) => String(item.id) === String(orderId));
    if (!order) return null;
    return { ...order, order_items: order.partner_items || order.order_items || [] };
  }

  function renderOrder(target, order, mode) {
    const items = order.order_items || [];
    target.innerHTML = `
      <article class="panel">
        <div class="section-header">
          <div><p class="eyebrow">Sipariş</p><h1>${core.escapeHTML(order.order_number || order.order_no || order.id)}</h1></div>
          <span class="pill pill--gold">${core.escapeHTML(order.status || order.order_status || "pending")}</span>
        </div>
        <div class="form-grid">
          <div><strong>Müşteri</strong><p>${core.escapeHTML(order.customer_name || "-")}</p></div>
          <div><strong>Şehir</strong><p>${core.escapeHTML(order.city || "-")}</p></div>
          <div><strong>Ödeme</strong><p>${core.escapeHTML(order.payment_status || "pending")}</p></div>
          <div><strong>Fraud</strong><p>${core.escapeHTML(order.fraud_status || "normal")}</p></div>
          <div class="field--full"><strong>Adres</strong><p>${core.escapeHTML(order.address || "-")}</p></div>
        </div>
      </article>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Ürün</th><th>Adet</th><th>Birim</th><th>Toplam</th>${mode === "user" ? "" : "<th>Partner Net</th>"}</tr></thead>
          <tbody>
            ${items.map((item) => `
              <tr>
                <td>${core.escapeHTML(item.product_name || "-")}</td>
                <td>${Number(item.quantity || 0).toLocaleString("tr-TR")}</td>
                <td>${core.money(item.unit_price || item.price || 0)}</td>
                <td>${core.money(item.total_price || ((item.price || 0) * (item.quantity || 0)))}</td>
                ${mode === "user" ? "" : `<td>${core.money(item.partner_net_earning || 0)}</td>`}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <aside class="summary-card">
        <h2>Toplam</h2>
        <div class="summary-line"><span>Ara toplam</span><strong>${core.money(order.subtotal || 0)}</strong></div>
        <div class="summary-line"><span>Kupon</span><strong>-${core.money(order.coupon_discount || order.discount || 0)}</strong></div>
        <div class="summary-line"><span>HP</span><strong>-${core.money(order.hp_discount || 0)}</strong></div>
        <div class="summary-line"><span>Kargo</span><strong>${core.money(order.shipping_total || order.shipping || 0)}</strong></div>
        <div class="summary-line summary-line--total"><span>Genel toplam</span><strong>${core.money(order.grand_total || order.total || 0)}</strong></div>
      </aside>
      <section class="customer-invoices" data-order-invoices data-order-id="${core.escapeHTML(order.id)}" aria-live="polite">
        <div class="customer-invoices__loading">Faturalar güvenli bağlantı üzerinden yükleniyor…</div>
      </section>
    `;
  }

  async function loadDetail() {
    const target = document.querySelector("[data-order-detail]");
    if (!target) return;
    const mode = target.dataset.orderDetail || "user";
    const id = core.getParam("id");
    if (!id || (security ? !security.isUuid(id) : !/^[0-9a-f-]{36}$/i.test(id))) {
      core.renderStatus(target, "Sipariş kimliği geçersiz.", "error");
      return;
    }
    const user = await App.auth.requireAuth();
    if (!user) return;
    if (!await checkAccess(mode, user)) {
      core.renderStatus(target, "Bu siparişi görüntüleme yetkiniz yok.", "error");
      return;
    }
    core.renderStatus(target, "Sipariş detayı yükleniyor...");
    try {
      const customerSafeProjection = [
        "id", "order_no", "order_number", "user_id", "customer_name", "city", "address",
        "subtotal", "shipping", "discount", "total", "order_status", "payment_status", "status",
        "discount_total", "hp_discount", "coupon_discount", "shipping_total", "grand_total",
        "tracking_number", "cargo_company", "created_at",
        "order_items(id,order_id,product_id,product_name,quantity,price,unit_price,total_price)"
      ].join(",");
      let data;
      if (mode === "partner") {
        data = await loadPartnerOrder(id);
      } else {
        const projection = mode === "user" ? customerSafeProjection : "*, order_items(*)";
        const result = await App.db.client().from("orders").select(projection).eq("id", id).maybeSingle();
        if (result.error) throw result.error;
        data = result.data;
      }
      if (!data) throw new Error("Sipariş bulunamadı.");
      renderOrder(target, data, mode);
      document.dispatchEvent(new CustomEvent("allona:order-rendered", { detail: { orderId: data.id, mode } }));
    } catch (error) {
      core.renderStatus(target, error.message || "Sipariş detayı yüklenemedi.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", loadDetail);
})();
