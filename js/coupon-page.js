(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const security = App.security;
  const sync = window.AllonaProfileSync;
  const economyClient = sync && sync.createClient ? sync.createClient() : null;
  let activeUser = null;
  const storageKeys = {
    pending: "allonahub_pending_coupon_v1",
    wallet: "allonahub_user_coupons_v1",
    claimed: "allonahub_claimed_starter_coupons_v1",
    firstHpConversion: "allonahub_first_hp_conversion_v1"
  };

  const coupons = {
    WELCOME10: {
      code: "WELCOME10",
      title: "Welcome 10 Kuponu",
      discountType: "percent",
      discountValue: 10,
      hpReward: 0,
      description: "Yeni üyenin hesabına tanımlanan hoş geldin indirimi."
    },
    PARTNER15: {
      code: "PARTNER15",
      title: "Partner 15 Kuponu",
      discountType: "percent",
      discountValue: 15,
      hpReward: 0,
      description: "Seçili partner mağazalarda kullanılabilir indirim."
    },
    HP20: {
      code: "HP20",
      title: "HP Avantaj Kuponu",
      discountType: "percent",
      discountValue: 8,
      hpReward: 0,
      description: "HP sadakat alanı için düşük oranlı indirim."
    }
  };

  function normalizeCoupon(raw, action) {
    const base = coupons[String(raw || "").toUpperCase()] || coupons.WELCOME10;
    return {
      code: base.code,
      title: base.title,
      discount_type: base.discountType,
      discount_value: base.discountValue,
      source: "campaign",
      status: "active",
      hp_reward: base.hpReward,
      description: base.description,
      assigned_at: new Date().toISOString()
    };
  }

  function normalizeHpCoupon(requiredHp, couponValue) {
    const stamp = Date.now().toString(36).toUpperCase();
    return {
      code: `HP125-${stamp}`,
      title: "125 TL HP Kuponu",
      discount_type: "fixed",
      discount_value: couponValue,
      source: "hp_conversion",
      status: "active",
      hp_cost: requiredHp,
      description: `${requiredHp} HP karşılığında oluşturulan alışveriş kuponu.`,
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

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("tr-TR");
  }

  function formatHp(value) {
    return `${formatNumber(value)} HP`;
  }

  function formatCouponValue(item) {
    if (item.discount_type === "fixed") {
      return `${Number(item.discount_value || 0).toLocaleString("tr-TR")} TL`;
    }
    return `%${formatNumber(item.discount_value || 0)}`;
  }

  function couponBaseCode(code) {
    return String(code || "").toUpperCase().replace(/-HP$/, "").replace(/-\d+$/, "");
  }

  function couponHpReward(coupon) {
    const base = coupons[couponBaseCode(coupon?.code)];
    if (base) return Math.max(0, Number(base.hpReward || 0));
    return Math.max(0, Number(coupon?.hp_reward || 0));
  }

  function couponAwardId(coupon) {
    return `coupon:${couponBaseCode(coupon?.code)}`;
  }

  function hpBuckets(profile) {
    const total = Math.max(0, Number(profile?.hp || 0));
    const daily = Math.max(0, Number(profile?.cashout_balance || 0));
    const shopping = Math.max(0, Number(profile?.hub_cash || profile?.wallet_balance || 0));
    return { total, daily, shopping };
  }

  function getLocalWallet(user) {
    const all = safeJson(storageKeys.wallet, {});
    return Array.isArray(all[userKey(user)]) ? all[userKey(user)] : [];
  }

  function claimedCoupons(user) {
    const all = safeJson(storageKeys.claimed, {});
    const list = all[userKey(user)];
    return Array.isArray(list) ? list.map((code) => String(code).toUpperCase()) : [];
  }

  function markCouponClaimed(user, code) {
    if (!user || !code) return;
    const all = safeJson(storageKeys.claimed, {});
    const key = userKey(user);
    const next = Array.from(new Set([...(all[key] || []), String(code).toUpperCase()]));
    all[key] = next;
    writeJson(storageKeys.claimed, all);
  }

  function isStarterCouponClaimed(user, code) {
    const normalized = String(code || "").toUpperCase();
    return claimedCoupons(user).includes(normalized)
      || getLocalWallet(user).some((item) => couponBaseCode(item?.code) === normalized);
  }

  function firstHpConversionUsed(user) {
    const all = safeJson(storageKeys.firstHpConversion, {});
    return Boolean(all[userKey(user)]);
  }

  function markFirstHpConversionUsed(user, coupon) {
    if (!user) return;
    const all = safeJson(storageKeys.firstHpConversion, {});
    all[userKey(user)] = {
      code: coupon?.code || "",
      used_at: new Date().toISOString()
    };
    writeJson(storageKeys.firstHpConversion, all);
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
        <span>${core.escapeHTML(item.code)} - ${core.escapeHTML(formatCouponValue(item))}${item.status === "used" ? " - kullanıldı" : ""}</span>
      </div>
    `).join("");
  }

  async function renderStarterCoupons(user) {
    const cards = document.querySelectorAll("[data-starter-coupon]");
    if (!cards.length) return;
    let remoteCodes = [];
    if (user && App.db && App.db.client) {
      try {
        const { data, error } = await App.db.client()
          .from("user_coupons")
          .select("code, status")
          .eq("user_id", user.id)
          .in("code", Object.keys(coupons));
        if (error) throw error;
        remoteCodes = (data || []).map((item) => String(item.code || "").toUpperCase());
      } catch (error) {
        remoteCodes = [];
      }
    }
    cards.forEach((card) => {
      const code = String(card.dataset.starterCoupon || "").toUpperCase();
      const claimed = user && (isStarterCouponClaimed(user, code) || remoteCodes.includes(code));
      card.hidden = Boolean(claimed);
    });
    const visible = Array.from(cards).some((card) => !card.hidden);
    const grid = document.querySelector("[data-starter-coupon-grid]");
    if (grid) grid.hidden = !visible;
    const done = document.querySelector("[data-starter-coupon-done]");
    if (done) done.hidden = visible;
  }

  async function loadProfile() {
    if (!sync || !economyClient || !sync.load) return sync && sync.storedProfile ? sync.storedProfile() : {};
    try {
      const loaded = await sync.load(economyClient);
      return loaded?.profile || {};
    } catch (error) {
      console.warn("HP profili okunamadı:", error);
      return sync.storedProfile ? sync.storedProfile() : {};
    }
  }

  function renderPointShop(profile) {
    const totals = hpBuckets(profile || {});
    const totalNode = document.querySelector("[data-point-total]");
    const dailyNode = document.querySelector("[data-point-daily]");
    const shoppingNode = document.querySelector("[data-point-shopping]");
    const noteNode = document.querySelector("[data-point-note]");
    if (totalNode) totalNode.textContent = formatHp(totals.total);
    if (dailyNode) dailyNode.textContent = formatHp(totals.daily);
    if (shoppingNode) shoppingNode.textContent = formatHp(totals.shopping);
    if (noteNode) {
      if (totals.total < 1000) {
        noteNode.textContent = `125 TL kupon için ${formatHp(Math.max(0, 1000 - totals.total))} daha gerekiyor.`;
      } else if (activeUser && !firstHpConversionUsed(activeUser) && totals.shopping <= 0) {
        noteNode.textContent = "İlk kullanım hakkınla toplam HP'ni tek seferlik kupona çevirebilirsin.";
      } else if (totals.shopping <= 0) {
        noteNode.textContent = "İlk kullanım hakkından sonra günlük görev HP'si tek başına kupona çevrilemez. Dönüşüm için alışverişten kazanılan HP de gerekir.";
      } else {
        noteNode.textContent = "1000 HP karşılığı 125 TL kupon oluşturabilirsin. Alışveriş HP'si öncelikli kullanılır.";
      }
    }
  }

  async function awardCouponHp(user, coupon) {
    const amount = couponHpReward(coupon);
    if (!amount || !user || !sync || !economyClient || !sync.updateEconomy || !sync.recordHpLedger) return null;
    const id = couponAwardId(coupon);
    if (sync.hasHpLedgerEntry && sync.hasHpLedgerEntry(user, id)) return null;

    const updated = await sync.updateEconomy(economyClient, {
      hp: amount,
      hub_cash: amount
    });
    sync.recordHpLedger(user, {
      id,
      bucket: "shopping",
      title: coupon.title || coupon.code,
      source: "Tanımlı kupon",
      amount,
      note: "Kupon avantajı alışverişten kazanılan HP olarak işlendi."
    });
    return updated;
  }

  function registerReturnUrl() {
    const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    return core.url(`/pages/account/user.html?tab=register&returnTo=${returnTo}`);
  }

  async function assignCoupon(code, action) {
    if (action === "convert") {
      await convertCouponToHp(code);
      return;
    }

    const coupon = normalizeCoupon(code, action);
    const user = await currentUser();
    activeUser = user;
    if (!user) {
      writeJson(storageKeys.pending, coupon);
      renderStatus("Kupon hazırlandı. Hesabınıza tanımlamak için kayıt sayfasına yönlendiriliyorsunuz.", "info");
      window.setTimeout(() => {
        window.location.href = registerReturnUrl();
      }, 450);
      return;
    }

    if (isStarterCouponClaimed(user, coupon.code)) {
      renderStatus("Bu başlangıç kuponu daha önce hesabına tanımlanmış.", "info");
      await renderStarterCoupons(user);
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
    markCouponClaimed(user, coupon.code);
    const profile = await loadProfile();
    renderWallet(user);
    renderPointShop(profile);
    await renderStarterCoupons(user);
    renderStatus(`${coupon.title} hesabınızda tek seferlik kupon olarak aktif hale getirildi.`, "success");
    if (core.toast) core.toast(remoteSaved ? "Kupon hesabına tanımlandı." : "Kupon hesabına kaydedildi.");
  }

  async function convertCouponToHp(code) {
    renderStatus("Başlangıç kuponları artık HP'ye çevrilmez. Kuponu ödeme sayfasında indirim olarak kullanabilirsin.", "info");
  }

  async function convertPointsToCoupon(button) {
    const requiredHp = Math.max(0, Number(button?.dataset.requiredHp || 1000));
    const couponValue = Math.max(0, Number(button?.dataset.couponValue || 125));
    const user = await currentUser();
    activeUser = user;
    if (!user) {
      renderStatus("HP kuponu oluşturmak için hesabınıza giriş yapmalısınız.", "info");
      window.setTimeout(() => {
        window.location.href = registerReturnUrl();
      }, 450);
      return;
    }
    if (!sync || !economyClient || !sync.updateEconomy) {
      renderStatus("HP dönüşüm sistemi hazırlanamadı. Lütfen sayfayı yenileyin.", "info");
      return;
    }

    const profile = await loadProfile();
    const totals = hpBuckets(profile);
    if (totals.total < requiredHp) {
      renderStatus(`Bu kupon için ${formatHp(requiredHp)} gerekiyor. Mevcut toplam: ${formatHp(totals.total)}.`, "info");
      return;
    }
    const firstUseAvailable = !firstHpConversionUsed(user);
    if (!firstUseAvailable && totals.shopping <= 0) {
      renderStatus("İlk kullanım hakkından sonra günlük görev HP'si tek başına kupona çevrilemez. Önce alışverişten HP kazanmalısınız.", "info");
      return;
    }

    let remainingSpend = requiredHp;
    const shoppingSpend = Math.min(totals.shopping, remainingSpend);
    remainingSpend -= shoppingSpend;
    const dailySpend = Math.min(totals.daily, remainingSpend);
    remainingSpend -= dailySpend;
    const otherSpend = Math.max(0, remainingSpend);
    const coupon = normalizeHpCoupon(requiredHp, couponValue);

    try {
      const updated = await sync.updateEconomy(economyClient, {
        hp: -requiredHp,
        hub_cash_set: Math.max(0, totals.shopping - shoppingSpend),
        wallet_balance_set: Math.max(0, totals.shopping - shoppingSpend),
        cashout_balance_set: Math.max(0, totals.daily - dailySpend)
      });
      if (sync.recordHpLedger) {
        sync.recordHpLedger(user, {
          id: `point-shop:${coupon.code}`,
          bucket: "conversion",
          title: coupon.title,
          source: "Puan Dükkanı",
          amount: -requiredHp,
          note: `${formatHp(shoppingSpend)} alışveriş HP, ${formatHp(dailySpend)} günlük görev HP${otherSpend ? ` ve ${formatHp(otherSpend)} diğer HP` : ""} kullanıldı.`
        });
      }
      try {
        await saveRemoteCoupon(user, coupon);
      } catch (error) {
        console.warn("HP kuponu Supabase yazımı tamamlanamadı.", error);
      }
      saveLocalCoupon(user, coupon);
      if (firstUseAvailable) markFirstHpConversionUsed(user, coupon);
      renderWallet(user);
      renderPointShop(updated);
      renderStatus(`${coupon.title} oluşturuldu. ${formatHp(requiredHp)} kullanıldı.`, "success");
      if (core.toast) core.toast("HP kuponu oluşturuldu.");
    } catch (error) {
      console.error("HP kupon dönüşümü tamamlanamadı:", error);
      renderStatus("HP kuponu güvenli şekilde oluşturulamadı. Lütfen tekrar deneyin.", "info");
    }
  }

  async function applyPendingCoupon() {
    const pending = safeJson(storageKeys.pending, null);
    if (!pending || !pending.code) return;
    const user = await currentUser();
    activeUser = user;
    if (!user) return;
    try {
      await saveRemoteCoupon(user, pending);
    } catch (error) {
      console.warn("Bekleyen kupon merkezi hesaba yazılamadı.", error);
    }
    saveLocalCoupon(user, pending);
    markCouponClaimed(user, pending.code);
    localStorage.removeItem(storageKeys.pending);
    renderStatus(`${pending.title || pending.code} hesabınızda aktif hale getirildi.`, "success");
    renderWallet(user);
    renderPointShop(await loadProfile());
  }

  function bindCouponActions() {
    document.addEventListener("click", (event) => {
      const pointButton = event.target.closest("[data-point-convert]");
      if (pointButton) {
        event.preventDefault();
        convertPointsToCoupon(pointButton);
        return;
      }

      const button = event.target.closest("[data-coupon-action]");
      if (!button) return;
      event.preventDefault();
      assignCoupon(button.dataset.couponCode, button.dataset.couponAction);
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    bindCouponActions();
    const user = await currentUser();
    activeUser = user;
    await applyPendingCoupon();
    renderWallet(user);
    renderPointShop(await loadProfile());
    await renderStarterCoupons(user);
  });
})();
