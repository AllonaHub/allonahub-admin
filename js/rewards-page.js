(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;

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
        const profile = await App.auth.getProfile(user.id);
        data = {
          hp_balance: Math.max(0, Number(profile?.hp || 0)),
          xp_balance: Math.max(0, Number(profile?.xp || 0)),
          level_name: "New Member",
          premium_tier: "free"
        };
      }
      target.innerHTML = `
        <article class="stat-card"><span>HP indirim hakkı</span><strong>${Number(data.hp_balance || 0).toLocaleString("tr-TR")}</strong></article>
        <article class="stat-card"><span>XP</span><strong>${Number(data.xp_balance || 0).toLocaleString("tr-TR")}</strong></article>
        <article class="stat-card"><span>Seviye</span><strong>${core.escapeHTML(data.level_name || "New Member")}</strong></article>
        <article class="stat-card"><span>Premium</span><strong>${core.escapeHTML(data.premium_tier || "free")}</strong></article>
      `;
    } catch (error) {
      core.renderStatus("[data-rewards-status]", "HP/XP bilgileri yüklenemedi.", "error");
    }
  }

  async function loadCoupons() {
    const target = document.querySelector("[data-coupon-center-list]");
    if (!target) return;
    try {
      const { data, error } = await App.db.client()
        .from("coupons")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
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
      core.renderStatus(target, "Kuponlar yüklenemedi.", "error");
    }
  }

  async function loadLedger(user) {
    const target = document.querySelector("[data-hp-ledger-list]");
    if (!target) return;
    try {
      const { data, error } = await App.db.client()
        .from("hp_ledger")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
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
      core.renderStatus(target, "HP hareketleri yüklenemedi.", "error");
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
    await loadCoupons();
    await loadLedger(user);
  });
})();
