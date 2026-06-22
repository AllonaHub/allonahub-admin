(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const security = App.security;

  async function guard() {
    const shell = document.querySelector("[data-partner-shell]");
    if (!shell) return null;
    try {
      return await App.auth.requireRole(["partner", "admin", "super_admin"]);
    } catch (error) {
      shell.innerHTML = `<div class="status-box status-box--error">${core.escapeHTML(security ? security.publicErrorMessage(error, "Bu alana erişim yetkiniz yok.") : "Bu alana erişim yetkiniz yok.")}</div>`;
      return null;
    }
  }

  async function loadPartnerProducts(access) {
    const target = document.querySelector("[data-partner-products]");
    if (!target) return;
    core.renderStatus(target, "Ürünler yükleniyor...");
    try {
      let products;
      if (["admin", "super_admin"].includes(access.profile.role)) {
        products = await App.db.products.all();
      } else {
        const { data, error } = await App.db.client()
          .from("products")
          .select("*")
          .eq("partner_id", access.user.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        products = (data || []).map(core.normalizeProduct);
      }
      target.innerHTML = `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Ürün</th><th>Kategori</th><th>Fiyat</th><th>Stok</th><th>Durum</th></tr></thead>
            <tbody>
              ${products.map((product) => `
                <tr>
                  <td>${core.escapeHTML(product.name)}</td>
                  <td>${core.escapeHTML(product.category)}</td>
                  <td>${core.money(product.price)}</td>
                  <td><input type="number" min="0" value="${product.stock}" data-partner-stock="${core.escapeHTML(product.id)}"></td>
                  <td>${core.escapeHTML(product.status)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
      const reportProducts = document.querySelector("[data-report-products]");
      if (reportProducts) reportProducts.textContent = products.length;
    } catch (error) {
      core.renderStatus(target, security ? security.publicErrorMessage(error, "Ürünler yüklenemedi.") : "Ürünler yüklenemedi.", "error");
    }
  }

  async function loadPartnerOrders() {
    const target = document.querySelector("[data-partner-orders]");
    if (!target) return;
    core.renderStatus(target, "Siparişler yükleniyor...");
    try {
      const orders = await App.db.orders.list();
      target.innerHTML = `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Sipariş</th><th>Tutar</th><th>Durum</th><th>Ödeme</th></tr></thead>
            <tbody>
              ${orders.map((order) => `
                <tr>
                  <td>${core.escapeHTML(order.order_number || order.id)}</td>
                  <td>${core.money(order.total_amount || order.total)}</td>
                  <td>${core.escapeHTML(order.status || order.order_status || "pending")}</td>
                  <td>${core.escapeHTML(order.payment_status || "pending")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
      const reportOrders = document.querySelector("[data-report-orders]");
      const reportPayments = document.querySelector("[data-report-payments]");
      if (reportOrders) reportOrders.textContent = orders.filter((order) => (order.status || order.order_status) === "pending").length;
      if (reportPayments) reportPayments.textContent = orders.filter((order) => order.payment_status === "awaiting_payment").length;
    } catch (error) {
      core.renderStatus(target, security ? security.publicErrorMessage(error, "Siparişler yüklenemedi.") : "Siparişler yüklenemedi.", "error");
    }
  }

  function bindStockUpdates() {
    document.addEventListener("change", async (event) => {
      const input = event.target.closest("[data-partner-stock]");
      if (!input) return;
      try {
        const limit = security && security.rateLimit("partner-stock-update", { limit: 30, windowMs: 10 * 60 * 1000 });
        if (limit && !limit.allowed) throw new Error("Çok sık stok işlemi yapıldı. Lütfen biraz bekleyin.");
        const stock = Math.max(0, Math.min(100000, Number(input.value || 0)));
        input.value = stock;
        await App.db.products.updateFields(input.dataset.partnerStock, { stock });
        core.toast("Stok güncellendi.");
      } catch (error) {
        const message = /bekleyin/i.test(error.message || "")
          ? error.message
          : (security ? security.publicErrorMessage(error, "Stok güncellenemedi.") : "Stok güncellenemedi.");
        core.toast(message, "error");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!document.querySelector("[data-page='partner']")) return;
    const access = await guard();
    if (!access) return;
    bindStockUpdates();
    loadPartnerProducts(access);
    loadPartnerOrders();
  });
})();
