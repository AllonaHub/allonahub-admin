(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;

  async function initProfile() {
    const form = document.querySelector("[data-profile-form]");
    if (!form) return;
    const user = await App.auth.requireAuth();
    if (!user) return;

    try {
      const profile = await App.auth.getProfile(user.id);
      form.email.value = user.email || "";
      form.full_name.value = profile?.full_name || "";
      form.phone.value = profile?.phone || "";
      form.role.value = profile?.role || "customer";
    } catch (error) {
      core.renderStatus("[data-profile-status]", error.message || "Profil yüklenemedi.", "error");
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      button.disabled = true;
      try {
        await App.auth.upsertProfile(core.parseForm(form));
        core.renderStatus("[data-profile-status]", "Profil güncellendi.", "success");
      } catch (error) {
        core.renderStatus("[data-profile-status]", error.message || "Profil güncellenemedi.", "error");
      } finally {
        button.disabled = false;
      }
    });
  }

  async function initOrders() {
    const list = document.querySelector("[data-orders-list]");
    if (!list) return;
    const user = await App.auth.requireAuth();
    if (!user) return;

    core.renderStatus(list, "Siparişler yükleniyor...");
    try {
      const orders = await App.db.orders.list({ userId: user.id });
      if (!orders.length) {
        list.innerHTML = `<div class="empty-state">Henüz siparişiniz yok. <a href="${core.url("shop.html")}">Mağazaya gidin</a>.</div>`;
        return;
      }
      list.innerHTML = `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Sipariş</th><th>Tutar</th><th>Durum</th><th>Ödeme</th><th>Kargo</th><th>Tarih</th></tr>
            </thead>
            <tbody>
              ${orders.map((order) => `
                <tr>
                  <td>${core.escapeHTML(order.order_number || order.id)}</td>
                  <td>${core.money(order.total_amount || order.total)}</td>
                  <td>${core.escapeHTML(order.status || order.order_status || "pending")}</td>
                  <td>${core.escapeHTML(order.payment_status || "pending")}</td>
                  <td>${core.escapeHTML(order.tracking_number || "-")}</td>
                  <td>${order.created_at ? new Date(order.created_at).toLocaleDateString("tr-TR") : "-"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    } catch (error) {
      core.renderStatus(list, error.message || "Siparişler yüklenemedi.", "error");
    }
  }

  async function initFavorites() {
    const grid = document.querySelector("[data-favorites-grid]");
    if (!grid) return;
    core.renderStatus(grid, "Favoriler yükleniyor...");
    try {
      const products = await App.favorites.hydrate();
      if (!products.length) {
        grid.innerHTML = `<div class="empty-state">Favori ürün bulunmuyor. <a href="${core.url("shop.html")}">Ürünleri keşfedin</a>.</div>`;
        return;
      }
      grid.innerHTML = products.map(core.productCard).join("");
    } catch (error) {
      core.renderStatus(grid, error.message || "Favoriler yüklenemedi.", "error");
    }
  }

  async function loadAddresses(userId) {
    const list = document.querySelector("[data-address-list]");
    if (!list) return;
    core.renderStatus(list, "Adresler yükleniyor...");
    try {
      const { data, error } = await App.db.client()
        .from("addresses")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!data.length) {
        list.innerHTML = `<div class="empty-state">Kayıtlı adres bulunmuyor.</div>`;
        return;
      }
      list.innerHTML = data.map((address) => `
        <article class="data-card">
          <div class="section-header">
            <div>
              <h2>${core.escapeHTML(address.title || "Adres")}</h2>
              <p>${core.escapeHTML(address.full_name || "")} ${core.escapeHTML(address.phone || "")}</p>
            </div>
            <button class="btn btn--danger" type="button" data-delete-address="${core.escapeHTML(address.id)}">Sil</button>
          </div>
          <p>${core.escapeHTML(address.address)}</p>
          <p>${core.escapeHTML([address.district, address.city, address.zip_code].filter(Boolean).join(" / "))}</p>
        </article>
      `).join("");
    } catch (error) {
      core.renderStatus(list, error.message || "Adresler yüklenemedi.", "error");
    }
  }

  async function initAddresses() {
    const form = document.querySelector("[data-address-form]");
    if (!form) return;
    const user = await App.auth.requireAuth();
    if (!user) return;
    await loadAddresses(user.id);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      button.disabled = true;
      try {
        const payload = { ...core.parseForm(form), user_id: user.id };
        const { error } = await App.db.client().from("addresses").insert(payload);
        if (error) throw error;
        form.reset();
        await loadAddresses(user.id);
        core.toast("Adres kaydedildi.");
      } catch (error) {
        core.toast(error.message || "Adres kaydedilemedi.", "error");
      } finally {
        button.disabled = false;
      }
    });

    document.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-delete-address]");
      if (!button) return;
      try {
        const { error } = await App.db.client().from("addresses").delete().eq("id", button.dataset.deleteAddress);
        if (error) throw error;
        await loadAddresses(user.id);
        core.toast("Adres silindi.");
      } catch (error) {
        core.toast(error.message || "Adres silinemedi.", "error");
      }
    });
  }

  function bindSignOut() {
    document.addEventListener("click", async (event) => {
      if (!event.target.closest("[data-sign-out]")) return;
      try {
        await App.auth.signOut();
      } catch (error) {
        core.toast(error.message || "Çıkış yapılamadı.", "error");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindSignOut();
    initProfile();
    initOrders();
    initFavorites();
    initAddresses();
  });
})();
