(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const security = App.security;
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

  function normalizeDefaultAddresses(addresses) {
    const list = (addresses || []).map(normalizeAddress);
    if (!list.length) return [];
    const defaultIndex = list.findIndex((address) => address.is_default);
    const activeIndex = defaultIndex >= 0 ? defaultIndex : 0;
    return list.map((address, index) => ({ ...address, is_default: index === activeIndex }));
  }

  function addressFallbackMessage() {
    return "Adres tablosu Supabase'de henüz aktif görünmüyor. Adresler bu cihazda geçici olarak saklanıyor; kalıcı kayıt için docs/reference/DATABASE.md içindeki addresses SQL'i Supabase SQL Editor'da çalıştırılmalı.";
  }

  function normalizeAddress(raw) {
    const address = raw || {};
    return {
      id: address.id || `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: security ? security.normalizeText(address.title || "Adres", { max: 80 }) : address.title || "Adres",
      full_name: security ? security.normalizeText(address.full_name, { max: 120 }) : address.full_name || "",
      phone: security ? security.normalizeText(address.phone, { max: 30 }) : address.phone || "",
      address: security ? security.normalizeMultiline(address.address, { max: 600 }) : address.address || "",
      district: security ? security.normalizeText(address.district, { max: 90 }) : address.district || "",
      city: security ? security.normalizeText(address.city, { max: 90 }) : address.city || "",
      zip_code: security ? security.normalizeText(address.zip_code, { max: 20 }) : address.zip_code || "",
      is_default: Boolean(address.is_default),
      created_at: address.created_at || new Date().toISOString()
    };
  }

  function validateAddress(raw) {
    const address = normalizeAddress(raw);
    if (address.title.length < 2) throw new Error("Adres başlığını kontrol edin.");
    if (address.full_name.length < 2) throw new Error("Alıcı adını kontrol edin.");
    if (security && address.phone && !security.isPhone(address.phone)) throw new Error("Telefon numarasını kontrol edin.");
    if (address.city.length < 2) throw new Error("İl bilgisini kontrol edin.");
    if (address.address.length < 10) throw new Error("Açık adres en az 10 karakter olmalıdır.");
    return address;
  }

  function remoteAddressPayload(raw, userId) {
    const address = validateAddress(raw);
    return {
      user_id: userId,
      title: address.title || "Adres",
      full_name: address.full_name || "",
      phone: address.phone || "",
      address: address.address || "",
      district: address.district || "",
      city: address.city || "",
      zip_code: address.zip_code || "",
      is_default: raw.is_default === "on" || Boolean(address.is_default)
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
                  <td><a href="${core.url(`/pages/account/order-detail.html?id=${order.id}`)}">${core.escapeHTML(order.order_number || order.order_no || order.id)}</a></td>
                  <td>${core.money(order.grand_total || order.total_amount || order.total)}</td>
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
    const normalized = normalizeDefaultAddresses(addresses);
    if (!normalized.length) {
      list.innerHTML = `${warning}<div class="empty-state">Kayıtlı adres bulunmuyor.</div>`;
      return;
    }
    list.innerHTML = `
      ${warning}
      ${normalized.map((address) => `
        <article class="data-card">
          <div class="section-header">
            <div>
              <h2>${core.escapeHTML(address.title || "Adres")} ${address.is_default ? "<span class=\"status-pill\">Varsayılan</span>" : ""}</h2>
              <p>${core.escapeHTML(address.full_name || "")} ${core.escapeHTML(address.phone || "")}</p>
            </div>
            <div class="form-actions">
              ${address.is_default ? "" : `<button class="btn btn--light" type="button" data-default-address="${core.escapeHTML(address.id)}" data-address-source="${localMode ? "local" : "remote"}">Varsayılan Yap</button>`}
              <button class="btn btn--danger" type="button" data-delete-address="${core.escapeHTML(address.id)}" data-address-source="${localMode ? "local" : "remote"}">Sil</button>
            </div>
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
        .order("is_default", { ascending: false })
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
        const limit = security && security.rateLimit(`address:${user.id}`, { limit: 8, windowMs: 10 * 60 * 1000 });
        if (limit && !limit.allowed) throw new Error("Çok sık adres işlemi yapıldı. Lütfen biraz bekleyin.");
        const formPayload = core.parseForm(form);
        const payload = validateAddress(formPayload);
        if (state.source === "local") {
          const current = readLocalAddresses(user.id);
          const addresses = normalizeDefaultAddresses([
            { ...payload, is_default: formPayload.is_default === "on" || current.length === 0 },
            ...current.map((address) => ({ ...address, is_default: formPayload.is_default === "on" ? false : address.is_default }))
          ]);
          writeLocalAddresses(user.id, addresses);
          renderAddresses(document.querySelector("[data-address-list]"), addresses, "local");
          form.reset();
          core.toast("Adres geçici olarak bu cihazda kaydedildi.");
          return;
        }

        const { error } = await App.db.client().from("addresses").insert(remoteAddressPayload(formPayload, user.id));
        if (error) {
          if (isAddressesSchemaError(error)) {
            const current = readLocalAddresses(user.id);
            const addresses = normalizeDefaultAddresses([
              { ...payload, is_default: formPayload.is_default === "on" || current.length === 0 },
              ...current.map((address) => ({ ...address, is_default: formPayload.is_default === "on" ? false : address.is_default }))
            ]);
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
        const message = /kontrol edin|bekleyin|karakter/i.test(error.message || "")
          ? error.message
          : (security ? security.publicErrorMessage(error, "Adres kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin.") : "Adres kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin.");
        core.toast(message, "error");
      } finally {
        button.disabled = false;
      }
    });

    document.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-delete-address]");
      const defaultButton = event.target.closest("[data-default-address]");
      if (!button && !defaultButton) return;
      try {
        if (defaultButton) {
          if (defaultButton.dataset.addressSource === "local") {
            const addresses = normalizeDefaultAddresses(readLocalAddresses(user.id).map((address) => ({
              ...address,
              is_default: address.id === defaultButton.dataset.defaultAddress
            })));
            writeLocalAddresses(user.id, addresses);
            renderAddresses(document.querySelector("[data-address-list]"), addresses, "local");
            core.toast("Varsayılan adres güncellendi.");
            return;
          }

          const { error } = await App.db.client()
            .from("addresses")
            .update({ is_default: true })
            .eq("id", defaultButton.dataset.defaultAddress)
            .eq("user_id", user.id);
          if (error) throw error;
          const nextState = await loadAddresses(user.id);
          state.source = nextState.source;
          core.toast("Varsayılan adres güncellendi.");
          return;
        }

        if (button.dataset.addressSource === "local") {
          const addresses = normalizeDefaultAddresses(readLocalAddresses(user.id).filter((address) => address.id !== button.dataset.deleteAddress));
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
