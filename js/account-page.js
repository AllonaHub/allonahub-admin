(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const ADDRESS_STORAGE_PREFIX = "allona_addresses_v1:";

  function addressStorageKey(userId) {
    return `${ADDRESS_STORAGE_PREFIX}${userId}`;
  }

  function isAddressesSchemaError(error) {
    const message = String(error && error.message || "");
    const code = String(error && error.code || "");
    return code === "PGRST205" || (/addresses/i.test(message) && /schema cache|could not find/i.test(message));
  }

  function readLocalAddresses(userId) {
    try {
      return JSON.parse(localStorage.getItem(addressStorageKey(userId)) || "[]");
    } catch (error) {
      return [];
    }
  }

  function writeLocalAddresses(userId, addresses) {
    localStorage.setItem(addressStorageKey(userId), JSON.stringify(addresses));
  }

  function addressFallbackMessage() {
    return "Adres tablosu Supabase'de henüz aktif görünmüyor. Adresler bu cihazda geçici olarak saklanıyor; kalıcı kayıt için docs/reference/DATABASE.md içindeki addresses SQL'i Supabase SQL Editor'da çalıştırılmalı.";
  }

  function normalizeAddress(raw) {
    const address = raw || {};
    return {
      id: address.id || `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: address.title || "Adres",
      full_name: address.full_name || "",
      phone: address.phone || "",
      address: address.address || "",
      district: address.district || "",
      city: address.city || "",
      zip_code: address.zip_code || "",
      created_at: address.created_at || new Date().toISOString()
    };
  }

  function remoteAddressPayload(raw, userId) {
    const address = raw || {};
    return {
      user_id: userId,
      title: address.title || "Adres",
      full_name: address.full_name || "",
      phone: address.phone || "",
      address: address.address || "",
      district: address.district || "",
      city: address.city || "",
      zip_code: address.zip_code || ""
    };
  }

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
        list.innerHTML = `<div class="empty-state">Henüz siparişiniz yok. <a href="${core.url("/pages/commerce/shop.html")}">Mağazaya gidin</a>.</div>`;
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
        grid.innerHTML = `<div class="empty-state">Favori ürün bulunmuyor. <a href="${core.url("/pages/commerce/shop.html")}">Ürünleri keşfedin</a>.</div>`;
        return;
      }
      grid.innerHTML = products.map(core.productCard).join("");
    } catch (error) {
      core.renderStatus(grid, error.message || "Favoriler yüklenemedi.", "error");
    }
  }

  function renderAddresses(list, addresses, source) {
    const localMode = source === "local";
    const warning = localMode ? `<div class="status-box status-box--warning">${core.escapeHTML(addressFallbackMessage())}</div>` : "";
    if (!addresses.length) {
      list.innerHTML = `${warning}<div class="empty-state">Kayıtlı adres bulunmuyor.</div>`;
      return;
    }
    list.innerHTML = `
      ${warning}
      ${addresses.map((address) => `
        <article class="data-card">
          <div class="section-header">
            <div>
              <h2>${core.escapeHTML(address.title || "Adres")}</h2>
              <p>${core.escapeHTML(address.full_name || "")} ${core.escapeHTML(address.phone || "")}</p>
            </div>
            <button class="btn btn--danger" type="button" data-delete-address="${core.escapeHTML(address.id)}" data-address-source="${localMode ? "local" : "remote"}">Sil</button>
          </div>
          <p>${core.escapeHTML(address.address)}</p>
          <p>${core.escapeHTML([address.district, address.city, address.zip_code].filter(Boolean).join(" / "))}</p>
        </article>
      `).join("")}
    `;
  }

  async function loadAddresses(userId) {
    const list = document.querySelector("[data-address-list]");
    if (!list) return { source: "remote" };
    core.renderStatus(list, "Adresler yükleniyor...");
    try {
      const { data, error } = await App.db.client()
        .from("addresses")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      renderAddresses(list, (data || []).map(normalizeAddress), "remote");
      return { source: "remote" };
    } catch (error) {
      if (isAddressesSchemaError(error)) {
        renderAddresses(list, readLocalAddresses(userId), "local");
        return { source: "local" };
      }
      core.renderStatus(list, "Adresler şu anda yüklenemedi. Lütfen daha sonra tekrar deneyin.", "error");
      return { source: "remote" };
    }
  }

  async function initAddresses() {
    const form = document.querySelector("[data-address-form]");
    if (!form) return;
    const user = await App.auth.requireAuth();
    if (!user) return;
    const state = await loadAddresses(user.id);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      button.disabled = true;
      try {
        const formPayload = core.parseForm(form);
        const payload = normalizeAddress(formPayload);
        if (state.source === "local") {
          const addresses = [payload, ...readLocalAddresses(user.id)];
          writeLocalAddresses(user.id, addresses);
          renderAddresses(document.querySelector("[data-address-list]"), addresses, "local");
          form.reset();
          core.toast("Adres geçici olarak bu cihazda kaydedildi.");
          return;
        }

        const { error } = await App.db.client().from("addresses").insert(remoteAddressPayload(formPayload, user.id));
        if (error) {
          if (isAddressesSchemaError(error)) {
            const addresses = [payload, ...readLocalAddresses(user.id)];
            writeLocalAddresses(user.id, addresses);
            state.source = "local";
            renderAddresses(document.querySelector("[data-address-list]"), addresses, "local");
            form.reset();
            core.toast("Adres geçici olarak bu cihazda kaydedildi.");
            return;
          }
          throw error;
        }
        form.reset();
        await loadAddresses(user.id);
        core.toast("Adres kaydedildi.");
      } catch (error) {
        core.toast("Adres kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin.", "error");
      } finally {
        button.disabled = false;
      }
    });

    document.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-delete-address]");
      if (!button) return;
      try {
        if (button.dataset.addressSource === "local") {
          const addresses = readLocalAddresses(user.id).filter((address) => address.id !== button.dataset.deleteAddress);
          writeLocalAddresses(user.id, addresses);
          renderAddresses(document.querySelector("[data-address-list]"), addresses, "local");
          core.toast("Adres silindi.");
          return;
        }

        const { error } = await App.db.client().from("addresses").delete().eq("id", button.dataset.deleteAddress);
        if (error) {
          if (isAddressesSchemaError(error)) {
            state.source = "local";
            renderAddresses(document.querySelector("[data-address-list]"), readLocalAddresses(user.id), "local");
            core.toast("Adres tablosu henüz aktif değil.", "error");
            return;
          }
          throw error;
        }
        const nextState = await loadAddresses(user.id);
        state.source = nextState.source;
        core.toast("Adres silindi.");
      } catch (error) {
        core.toast("Adres silinemedi. Lütfen tekrar deneyin.", "error");
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
