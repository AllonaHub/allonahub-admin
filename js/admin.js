(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;

  function rowStatus(value) {
    return `<span class="pill ${value === "active" || value === "paid" ? "pill--gold" : ""}">${core.escapeHTML(value || "-")}</span>`;
  }

  async function guard() {
    const shell = document.querySelector("[data-admin-shell]");
    if (!shell) return null;
    try {
      return await App.auth.requireRole(["admin", "super_admin"]);
    } catch (error) {
      shell.innerHTML = `<div class="status-box status-box--error">${core.escapeHTML(error.message)}</div>`;
      return null;
    }
  }

  async function loadProducts() {
    const target = document.querySelector("[data-admin-products]");
    if (!target) return;
    core.renderStatus(target, "Ürünler yükleniyor...");
    try {
      const products = await App.db.products.all();
      target.innerHTML = `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Ürün</th><th>Kategori</th><th>Fiyat</th><th>Stok</th><th>Durum</th><th></th></tr></thead>
            <tbody>
              ${products.map((product) => `
                <tr>
                  <td>${core.escapeHTML(product.name)}</td>
                  <td>${core.escapeHTML(product.category)}</td>
                  <td>${core.money(product.price)}</td>
                  <td>${product.stock}</td>
                  <td>${rowStatus(product.status)}</td>
                  <td>
                    <button class="btn btn--light" type="button" data-edit-product='${core.escapeHTML(JSON.stringify(product))}'>Düzenle</button>
                    <button class="btn btn--danger" type="button" data-delete-product="${core.escapeHTML(product.id)}">Sil</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    } catch (error) {
      core.renderStatus(target, error.message || "Ürünler yüklenemedi.", "error");
    }
  }

  async function loadOrders() {
    const target = document.querySelector("[data-admin-orders]");
    if (!target) return;
    core.renderStatus(target, "Siparişler yükleniyor...");
    try {
      const orders = await App.db.orders.list();
      target.innerHTML = `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Sipariş</th><th>Müşteri</th><th>Tutar</th><th>Sipariş</th><th>Ödeme</th><th>Kargo</th></tr></thead>
            <tbody>
              ${orders.map((order) => `
                <tr>
                  <td>${core.escapeHTML(order.order_number || order.id)}</td>
                  <td>${core.escapeHTML(order.customer_name || order.customer_email || "-")}</td>
                  <td>${core.money(order.total_amount || order.total)}</td>
                  <td>
                    <select data-order-status="${core.escapeHTML(order.id)}">
                      ${["pending","confirmed","preparing","shipped","delivered","cancelled","refunded"].map((status) => `<option value="${status}" ${(order.status || order.order_status) === status ? "selected" : ""}>${status}</option>`).join("")}
                    </select>
                  </td>
                  <td>${rowStatus(order.payment_status)}</td>
                  <td><input value="${core.escapeHTML(order.tracking_number || "")}" data-tracking-number="${core.escapeHTML(order.id)}" placeholder="Takip no"></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    } catch (error) {
      core.renderStatus(target, error.message || "Siparişler yüklenemedi.", "error");
    }
  }

  async function loadUsers() {
    const target = document.querySelector("[data-admin-users]");
    if (!target) return;
    core.renderStatus(target, "Kullanıcılar yükleniyor...");
    try {
      const { data, error } = await App.db.client().from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      target.innerHTML = `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Ad</th><th>Telefon</th><th>Rol</th><th>Tarih</th></tr></thead>
            <tbody>
              ${(data || []).map((user) => `
                <tr>
                  <td>${core.escapeHTML(user.full_name || "-")}</td>
                  <td>${core.escapeHTML(user.phone || "-")}</td>
                  <td>${rowStatus(user.role)}</td>
                  <td>${user.created_at ? new Date(user.created_at).toLocaleDateString("tr-TR") : "-"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    } catch (error) {
      core.renderStatus(target, error.message || "Kullanıcılar yüklenemedi.", "error");
    }
  }

  async function loadCoupons() {
    const target = document.querySelector("[data-admin-coupons]");
    if (!target) return;
    core.renderStatus(target, "Kuponlar yükleniyor...");
    try {
      const { data, error } = await App.db.client().from("coupons").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      target.innerHTML = `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Kod</th><th>Tip</th><th>Değer</th><th>Durum</th></tr></thead>
            <tbody>
              ${(data || []).map((coupon) => `
                <tr>
                  <td>${core.escapeHTML(coupon.code)}</td>
                  <td>${core.escapeHTML(coupon.discount_type)}</td>
                  <td>${core.escapeHTML(coupon.discount_value)}</td>
                  <td>${rowStatus(coupon.status)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    } catch (error) {
      core.renderStatus(target, error.message || "Kuponlar yüklenemedi.", "error");
    }
  }

  async function loadNotifications() {
    const target = document.querySelector("[data-admin-notifications]");
    if (!target) return;
    core.renderStatus(target, "Risk bildirimleri yükleniyor...");
    try {
      const { data, error } = await App.db.client()
        .from("admin_notifications")
        .select("*, profile:profiles(full_name, phone)")
        .in("kind", ["cv_device_risk", "cv_device_signup_attempt"])
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      const rows = data || [];
      target.innerHTML = rows.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Bildirim</th><th>Kullanıcı</th><th>Risk</th><th>Tarih</th></tr></thead>
            <tbody>
              ${rows.map((item) => {
                const meta = item.metadata || {};
                const profile = item.profile || {};
                return `
                  <tr>
                    <td><strong>${core.escapeHTML(item.title)}</strong><br>${core.escapeHTML(item.message)}</td>
                    <td>${core.escapeHTML(profile.full_name || item.user_id || "-")}</td>
                    <td>${rowStatus(item.severity)}<br><small>Cihaz hesap sayısı: ${core.escapeHTML(meta.device_account_count || meta.known_account_count || "-")}</small></td>
                    <td>${item.created_at ? new Date(item.created_at).toLocaleString("tr-TR") : "-"}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="status-box">Henüz riskli CV profili bildirimi yok.</div>`;
    } catch (error) {
      core.renderStatus(target, error.message || "Risk bildirimleri yüklenemedi.", "error");
    }
  }

  function bindProductForm() {
    const form = document.querySelector("[data-admin-product-form]");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      button.disabled = true;
      try {
        await App.db.products.upsert(core.parseForm(form));
        form.reset();
        form.id.value = "";
        core.toast("Ürün kaydedildi.");
        await loadProducts();
      } catch (error) {
        core.toast(error.message || "Ürün kaydedilemedi.", "error");
      } finally {
        button.disabled = false;
      }
    });

    document.addEventListener("click", async (event) => {
      const edit = event.target.closest("[data-edit-product]");
      const del = event.target.closest("[data-delete-product]");
      if (edit) {
        const product = JSON.parse(edit.dataset.editProduct);
        Object.keys(product).forEach((key) => {
          if (form.elements[key]) form.elements[key].value = product[key] ?? "";
        });
        window.scrollTo({ top: form.getBoundingClientRect().top + window.scrollY - 120, behavior: "smooth" });
      }
      if (del) {
        try {
          await App.db.products.delete(del.dataset.deleteProduct);
          core.toast("Ürün silindi.");
          await loadProducts();
        } catch (error) {
          core.toast(error.message || "Ürün silinemedi.", "error");
        }
      }
    });
  }

  function bindOrderUpdates() {
    document.addEventListener("change", async (event) => {
      const status = event.target.closest("[data-order-status]");
      if (!status) return;
      try {
        await App.db.orders.update(status.dataset.orderStatus, { status: status.value, order_status: status.value });
        core.toast("Sipariş durumu güncellendi.");
      } catch (error) {
        core.toast(error.message || "Sipariş güncellenemedi.", "error");
      }
    });

    document.addEventListener("blur", async (event) => {
      const tracking = event.target.closest("[data-tracking-number]");
      if (!tracking) return;
      try {
        await App.db.orders.update(tracking.dataset.trackingNumber, { tracking_number: tracking.value });
        core.toast("Kargo takip numarası güncellendi.");
      } catch (error) {
        core.toast(error.message || "Kargo bilgisi güncellenemedi.", "error");
      }
    }, true);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!document.querySelector("[data-page='admin']")) return;
    const access = await guard();
    if (!access) return;
    bindProductForm();
    bindOrderUpdates();
    loadProducts();
    loadOrders();
    loadUsers();
    loadCoupons();
    loadNotifications();
  });
})();
