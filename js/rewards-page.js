(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const sync = window.AllonaProfileSync;
  const localCouponKey = "allonahub_user_coupons_v1";
  const claimedCouponKey = "allonahub_claimed_starter_coupons_v1";

  function safeJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (error) {
      return fallback;
    }
  }

  function userKey(user) {
    return user && user.id ? `user:${user.id}` : "guest";
  }

  function fallbackProfile(user) {
    if (sync && sync.storedProfile) return sync.storedProfile();
    return {};
  }

  function hpBuckets(profile) {
    const total = Math.max(0, Number(profile?.hp || 0));
    const daily = Math.max(0, Number(profile?.cashout_balance || 0));
    const shopping = Math.max(0, Number(profile?.hub_cash || profile?.wallet_balance || 0));
    return { total, daily, shopping };
  }

  function localCoupons(user) {
    const wallet = safeJson(localCouponKey, {});
    const list = wallet[userKey(user)];
    return Array.isArray(list) ? list : [];
  }

  function couponBaseCode(code) {
    return String(code || "").toUpperCase().replace(/-HP$/, "").replace(/-\d+$/, "");
  }

  function claimedStarterCodes(user) {
    const all = safeJson(claimedCouponKey, {});
    const list = all[userKey(user)];
    return Array.isArray(list) ? list.map((code) => String(code).toUpperCase()) : [];
  }

  function isStarterVisible(user, code) {
    const normalized = String(code || "").toUpperCase();
    if (claimedStarterCodes(user).includes(normalized)) return false;
    return !localCoupons(user).some((coupon) => couponBaseCode(coupon?.code) === normalized);
  }

  function starterCoupons(user) {
    return [
      {
        code: "WELCOME10",
        title: "Yeni üye indirimi",
        description: "İlk alışveriş için tek kullanımlık %10 indirim.",
        discount_type: "percent",
        discount_value: 10
      },
      {
        code: "PARTNER15",
        title: "Partner mağaza indirimi",
        description: "Seçili partner mağazalarda tek kullanımlık %15 avantaj.",
        discount_type: "percent",
        discount_value: 15
      },
      {
        code: "HP20",
        title: "HP dönüşüm avantajı",
        description: "HP kullanım kurallarına göre düşük değerli dönüşüm avantajı.",
        discount_type: "percent",
        discount_value: 5
      }
    ].filter((coupon) => isStarterVisible(user, coupon.code));
  }

  async function safeRows(query) {
    try {
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      return [];
    }
  }

  async function loadSummary(user) {
    const target = document.querySelector("[data-rewards-summary]");
    if (!target) return;
    try {
      let { data, error } = await App.db.client()
        .from("user_rewards")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        const profile = fallbackProfile(user) || await App.auth.getProfile(user.id);
        const buckets = hpBuckets(profile);
        data = {
          hp_balance: buckets.total,
          xp_balance: Math.max(0, Number(profile?.xp || 0)),
          level_name: profile?.level_name || "New Member",
          premium_tier: profile?.premium_level || "free",
          daily_hp: buckets.daily,
          shopping_hp: buckets.shopping
        };
      }
      target.innerHTML = `
        <article class="stat-card"><span>HP indirim hakkı</span><strong>${Number(data.hp_balance || 0).toLocaleString("tr-TR")}</strong></article>
        <article class="stat-card"><span>XP</span><strong>${Number(data.xp_balance || 0).toLocaleString("tr-TR")}</strong></article>
        <article class="stat-card"><span>Seviye</span><strong>${core.escapeHTML(data.level_name || "New Member")}</strong></article>
        <article class="stat-card"><span>Premium</span><strong>${core.escapeHTML(data.premium_tier || "free")}</strong></article>
      `;
    } catch (error) {
      const profile = fallbackProfile(user);
      const buckets = hpBuckets(profile);
      target.innerHTML = `
        <article class="stat-card"><span>HP indirim hakkı</span><strong>${Number(buckets.total || 0).toLocaleString("tr-TR")}</strong></article>
        <article class="stat-card"><span>XP</span><strong>${Number(profile.xp || 0).toLocaleString("tr-TR")}</strong></article>
        <article class="stat-card"><span>Seviye</span><strong>${core.escapeHTML(profile.level_name || "New Member")}</strong></article>
        <article class="stat-card"><span>Premium</span><strong>${core.escapeHTML(profile.premium_level || "free")}</strong></article>
      `;
    }
  }

  async function loadCoupons(user) {
    const target = document.querySelector("[data-coupon-center-list]");
    if (!target) return;
    try {
      let { data, error } = await App.db.client()
        .from("coupons")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) {
        data = await safeRows(
          App.db.client()
            .from("user_coupons")
            .select("id, code, title, status, source, assigned_at, used_at")
            .eq("user_id", user.id)
            .order("assigned_at", { ascending: false })
            .limit(12)
        );
      }
      const locals = localCoupons(user).filter((coupon) => String(coupon.status || "active").toLowerCase() !== "used");
      if ((!data || !data.length) && locals.length) data = locals;
      if ((!data || !data.length) && !locals.length) data = starterCoupons(user);
      if (!data || !data.length) {
        target.innerHTML = `<div class="empty-state">Aktif kupon bulunmuyor.</div>`;
        return;
      }
      target.innerHTML = data.map((coupon) => `
        <article class="coupon-card">
          <span class="pill pill--gold">${core.escapeHTML(coupon.code)}</span>
          <h3>${core.escapeHTML(coupon.title || coupon.code)}</h3>
          <p>${core.escapeHTML(coupon.description || "Checkout sırasında kupon kodunu kullanabilirsiniz.")}</p>
          <strong>${coupon.discount_type === "percent" ? `%${Number(coupon.discount_value || 0)}` : core.money(coupon.discount_value || 0)}</strong>
        </article>
      `).join("");
    } catch (error) {
      const fallbackCoupons = starterCoupons(user);
      target.innerHTML = fallbackCoupons.length ? fallbackCoupons.map((coupon) => `
        <article class="coupon-card">
          <span class="pill pill--gold">${core.escapeHTML(coupon.code)}</span>
          <h3>${core.escapeHTML(coupon.title)}</h3>
          <p>${core.escapeHTML(coupon.description)}</p>
          <strong>%${Number(coupon.discount_value || 0)}</strong>
        </article>
      `).join("") : `<div class="empty-state">Aktif kupon bulunmuyor.</div>`;
    }
  }

  async function loadLedger(user) {
    const target = document.querySelector("[data-hp-ledger-list]");
    if (!target) return;
    try {
      let { data, error } = await App.db.client()
        .from("hp_ledger")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) {
        data = sync && sync.getHpLedger ? sync.getHpLedger(user).map((entry) => ({
          type: entry.bucket || "other",
          amount: entry.amount || 0,
          reason: `${entry.title || "HP hareketi"}${entry.note ? ` - ${entry.note}` : ""}`,
          created_at: entry.created_at
        })) : [];
      }
      if (!data || !data.length) {
        target.innerHTML = `<div class="empty-state">Henüz HP hareketi bulunmuyor.</div>`;
        return;
      }
      target.innerHTML = `
        <table class="data-table">
          <thead><tr><th>Tip</th><th>HP</th><th>Açıklama</th><th>Tarih</th></tr></thead>
          <tbody>
            ${data.map((item) => `
              <tr>
                <td>${core.escapeHTML(item.type)}</td>
                <td>${Number(item.amount || 0).toLocaleString("tr-TR")}</td>
                <td>${core.escapeHTML(item.reason || "-")}</td>
                <td>${item.created_at ? new Date(item.created_at).toLocaleString("tr-TR") : "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    } catch (error) {
      const localLedger = sync && sync.getHpLedger ? sync.getHpLedger(user) : [];
      target.innerHTML = localLedger.length ? `
        <table class="data-table">
          <thead><tr><th>Tip</th><th>HP</th><th>Açıklama</th><th>Tarih</th></tr></thead>
          <tbody>
            ${localLedger.map((item) => `
              <tr>
                <td>${core.escapeHTML(item.bucket || "other")}</td>
                <td>${Number(item.amount || 0).toLocaleString("tr-TR")}</td>
                <td>${core.escapeHTML(item.title || item.note || "-")}</td>
                <td>${item.created_at ? new Date(item.created_at).toLocaleString("tr-TR") : "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<div class="empty-state">Henüz HP hareketi bulunmuyor.</div>`;
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!document.querySelector("[data-page='rewards']")) return;
    document.addEventListener("click", async (event) => {
      if (!event.target.closest("[data-sign-out]")) return;
      await App.auth.signOut();
    });
    const user = await App.auth.requireAuth();
    if (!user) return;
    await loadSummary(user);
    await loadCoupons(user);
    await loadLedger(user);
  });
})();
