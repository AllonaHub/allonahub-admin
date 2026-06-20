(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const security = App.security;
  const storageKeys = {
    pending: "allonahub_pending_coupon_v1",
    wallet: "allonahub_user_coupons_v1"
  };

  const coupons = {
    WELCOME10: {
      code: "WELCOME10",
      title: "Welcome 10 Kuponu",
      discountType: "percent",
      discountValue: 10,
      description: "Yeni üyenin hesabına tanımlanan hoş geldin indirimi."
    },
    PARTNER15: {
      code: "PARTNER15",
      title: "Partner 15 Kuponu",
      discountType: "percent",
      discountValue: 15,
      description: "Seçili partner mağazalarda kullanılabilir indirim."
    },
    HP20: {
      code: "HP20",
      title: "HP 20 Kuponu",
      discountType: "percent",
      discountValue: 20,
      description: "HP sadakat avantajı için tanımlanan indirim."
    }
  };

  function normalizeCoupon(raw, action) {
    const base = coupons[String(raw || "").toUpperCase()] || coupons.WELCOME10;
    const isHp = action === "convert";
    return {
      code: isHp ? `${base.code}-HP` : base.code,
      title: isHp ? `${base.title} HP Dönüşümü` : base.title,
      discount_type: base.discountType,
      discount_value: base.discountValue,
      source: isHp ? "hp_conversion" : "campaign",
      status: "active",
      description: base.description,
      assigned_at: new Date().toISOString()
    };
  }

  function safeJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Kupon ekranı Supabase yazamazsa bile mevcut sayfa akışı bozulmasın.
    }
  }

  function userKey(user) {
    return user && user.id ? `user:${user.id}` : "guest";
  }

  function getLocalWallet(user) {
    const all = safeJson(storageKeys.wallet, {});
    return Array.isArray(all[userKey(user)]) ? all[userKey(user)] : [];
  }

  function saveLocalCoupon(user, coupon) {
    const all = safeJson(storageKeys.wallet, {});
    const key = userKey(user);
    const list = Array.isArray(all[key]) ? all[key] : [];
    const next = [
      coupon,
      ...list.filter((item) => item && item.code !== coupon.code)
    ].slice(0, 24);
    all[key] = next;
    writeJson(storageKeys.wallet, all);
    return next;
  }

  async function currentUser() {
    if (App.auth && App.auth.getUser) return App.auth.getUser();
    if (App.supabase && App.supabase.auth) {
      const { data, error } = await App.supabase.auth.getUser();
      if (!error) return data.user || null;
    }
    return null;
  }

  async function saveRemoteCoupon(user, coupon) {
    if (!user || !App.db || !App.db.client) return false;
    const row = {
      user_id: user.id,
      code: coupon.code,
      title: coupon.title,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      source: coupon.source,
      status: coupon.status
    };
    const { error } = await App.db.client()
      .from("user_coupons")
      .upsert(row, { onConflict: "user_id,code" });
    if (error) throw error;
    return true;
  }

  function renderStatus(message, type) {
    const target = document.querySelector("[data-coupon-status]");
    if (!target) return;
    target.innerHTML = `<div class="coupon-status coupon-status--${type || "info"}">${core.escapeHTML(message)}</div>`;
  }

  function renderWallet(user) {
    const target = document.querySelector("[data-coupon-wallet]");
    if (!target) return;
    const items = getLocalWallet(user);
    if (!items.length) {
      target.innerHTML = "<p>Hesabınızda henüz tanımlı kupon yok.</p>";
      return;
    }
    target.innerHTML = items.map((item) => `
      <div class="wallet-coupon">
        <strong>${core.escapeHTML(item.title || item.code)}</strong>
        <span>${core.escapeHTML(item.code)} - %${core.escapeHTML(String(item.discount_value || 0))}</span>
      </div>
    `).join("");
  }

  function registerReturnUrl() {
    const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    return core.url(`/pages/account/register.html?returnTo=${returnTo}`);
  }

  async function assignCoupon(code, action) {
    const coupon = normalizeCoupon(code, action);
    const user = await currentUser();
    if (!user) {
      writeJson(storageKeys.pending, coupon);
      renderStatus("Kupon hazırlandı. Hesabınıza tanımlamak için kayıt sayfasına yönlendiriliyorsunuz.", "info");
      window.setTimeout(() => {
        window.location.href = registerReturnUrl();
      }, 450);
      return;
    }

    let remoteSaved = false;
    try {
      remoteSaved = await saveRemoteCoupon(user, coupon);
    } catch (error) {
      const message = security && security.publicErrorMessage
        ? security.publicErrorMessage(error, "Kupon yerel hesap cüzdanına kaydedildi. Supabase tablosu aktif olunca merkezi hesaba da yazılacak.")
        : "Kupon yerel hesap cüzdanına kaydedildi.";
      console.warn("Kupon Supabase yazımı tamamlanamadı.", error);
      renderStatus(message, "info");
    }

    saveLocalCoupon(user, coupon);
    renderWallet(user);
    renderStatus(`${coupon.title} hesabınızda aktif hale getirildi.`, "success");
    if (core.toast) core.toast(remoteSaved ? "Kupon hesabına tanımlandı." : "Kupon hesabına kaydedildi.");
  }

  async function applyPendingCoupon() {
    const pending = safeJson(storageKeys.pending, null);
    if (!pending || !pending.code) return;
    const user = await currentUser();
    if (!user) return;
    try {
      await saveRemoteCoupon(user, pending);
    } catch (error) {
      console.warn("Bekleyen kupon merkezi hesaba yazılamadı.", error);
    }
    saveLocalCoupon(user, pending);
    localStorage.removeItem(storageKeys.pending);
    renderStatus(`${pending.title || pending.code} hesabınızda aktif hale getirildi.`, "success");
    renderWallet(user);
  }

  function bindCouponActions() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-coupon-action]");
      if (!button) return;
      event.preventDefault();
      assignCoupon(button.dataset.couponCode, button.dataset.couponAction);
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    bindCouponActions();
    const user = await currentUser();
    await applyPendingCoupon();
    renderWallet(user);
  });
})();
