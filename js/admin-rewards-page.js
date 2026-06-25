(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;

  async function requireAdmin() {
    const user = await App.auth.requireAuth();
    if (!user) return null;
    const profile = await App.auth.getProfile(user.id);
    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      core.renderStatus("[data-admin-rewards-status]", "Bu alana erişim yetkiniz yok.", "error");
      return null;
    }
    return user;
  }

  async function loadRewards() {
    const target = document.querySelector("[data-admin-rewards-list]");
    if (!target) return;
    core.renderStatus(target, "HP/XP kayıtları yükleniyor...");
    try {
      const { data, error } = await App.db.client()
        .from("user_rewards")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      if (!data || !data.length) {
        target.innerHTML = `<div class="empty-state">Henüz HP/XP kaydı bulunmuyor.</div>`;
        return;
      }
      const userIds = data.map((reward) => reward.user_id).filter(Boolean);
      const { data: profiles } = await App.db.client()
        .from("profiles")
        .select("id,full_name,email,phone,role")
        .in("id", userIds);
      const profileById = new Map((profiles || []).map((profile) => [String(profile.id), profile]));
      target.innerHTML = `
        <table class="data-table">
          <thead><tr><th>Kullanıcı</th><th>HP</th><th>XP</th><th>Seviye</th><th>Premium</th><th>Güncelleme</th></tr></thead>
          <tbody>
            ${data.map((reward) => {
              const profile = profileById.get(String(reward.user_id)) || {};
              return `
              <tr>
                <td>${core.escapeHTML(profile.full_name || reward.user_id)}<br><small>${core.escapeHTML(profile.email || "")}</small></td>
                <td>${Number(reward.hp_balance || 0).toLocaleString("tr-TR")}</td>
                <td>${Number(reward.xp_balance || 0).toLocaleString("tr-TR")}</td>
                <td>${core.escapeHTML(reward.level_name || "New Member")}</td>
                <td>${core.escapeHTML(reward.premium_tier || "free")}</td>
                <td>${reward.updated_at ? new Date(reward.updated_at).toLocaleString("tr-TR") : "-"}</td>
              </tr>
            `; }).join("")}
          </tbody>
        </table>
      `;
    } catch (error) {
      core.renderStatus(target, error.message || "HP/XP kayıtları yüklenemedi.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!document.querySelector("[data-page='admin-rewards']")) return;
    const user = await requireAdmin();
    if (!user) return;
    loadRewards();
  });
})();
