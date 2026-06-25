(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const security = App.security;

  async function requireAdmin() {
    const user = await App.auth.requireAuth();
    if (!user) return null;
    const profile = await App.auth.getProfile(user.id);
    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      core.renderStatus("[data-admin-coupon-status]", "Bu alana erişim yetkiniz yok.", "error");
      return null;
    }
    return user;
  }

  function isoOrNull(value) {
    return value ? new Date(value).toISOString() : null;
  }

  async function loadCoupons() {
    const target = document.querySelector("[data-admin-coupons-list]");
    if (!target) return;
    core.renderStatus(target, "Kuponlar yükleniyor...");
    try {
      const { data, error } = await App.db.client().from("coupons").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      if (!data || !data.length) {
        target.innerHTML = `<div class="empty-state">Henüz kupon bulunmuyor.</div>`;
        return;
      }
      target.innerHTML = `
        <table class="data-table">
          <thead><tr><th>Kod</th><th>Başlık</th><th>İndirim</th><th>Min. Sepet</th><th>Limit</th><th>Kullanım</th><th>Durum</th></tr></thead>
          <tbody>
            ${data.map((coupon) => `
              <tr>
                <td>${core.escapeHTML(coupon.code)}</td>
                <td>${core.escapeHTML(coupon.title || "-")}</td>
                <td>${coupon.discount_type === "percent" ? `%${Number(coupon.discount_value || 0)}` : core.money(coupon.discount_value || 0)}</td>
                <td>${core.money(coupon.min_order_total || coupon.minimum_subtotal || 0)}</td>
                <td>${coupon.usage_limit || "-"}</td>
                <td>${coupon.used_count || 0}</td>
                <td>${coupon.is_active === false || coupon.status === "archived" ? "Pasif" : "Aktif"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    } catch (error) {
      core.renderStatus(target, error.message || "Kuponlar yüklenemedi.", "error");
    }
  }

  function couponPayload(form) {
    const data = core.parseForm(form);
    const code = security ? security.normalizeText(data.code, { max: 40 }).toUpperCase() : String(data.code || "").trim().toUpperCase();
    if (!code || code.length < 3) throw new Error("Kupon kodunu kontrol edin.");
    return {
      code,
      title: security ? security.normalizeText(data.title, { max: 120 }) : String(data.title || "").trim(),
      description: security ? security.normalizeMultiline(data.description, { max: 500 }) : String(data.description || "").trim(),
      discount_type: data.discount_type === "percent" ? "percent" : "fixed",
      discount_value: Math.max(0, Number(data.discount_value || 0)),
      min_order_total: Math.max(0, Number(data.min_order_total || 0)),
      minimum_subtotal: Math.max(0, Number(data.min_order_total || 0)),
      max_discount: data.max_discount ? Math.max(0, Number(data.max_discount || 0)) : null,
      usage_limit: data.usage_limit ? Math.max(1, Number(data.usage_limit || 0)) : null,
      starts_at: isoOrNull(data.starts_at),
      ends_at: isoOrNull(data.ends_at),
      is_active: data.is_active === "on",
      status: data.is_active === "on" ? "active" : "draft"
    };
  }

  function bindForm() {
    const form = document.querySelector("[data-admin-coupon-form]");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      button.disabled = true;
      try {
        const payload = couponPayload(form);
        const { error } = await App.db.client().from("coupons").upsert(payload, { onConflict: "code" });
        if (error) throw error;
        form.reset();
        form.is_active.checked = true;
        core.renderStatus("[data-admin-coupon-status]", "Kupon kaydedildi.", "success");
        await loadCoupons();
      } catch (error) {
        core.renderStatus("[data-admin-coupon-status]", /kontrol edin/i.test(error.message || "") ? error.message : "Kupon kaydedilemedi. Lütfen alanları kontrol edin.", "error");
      } finally {
        button.disabled = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!document.querySelector("[data-page='admin-coupons']")) return;
    const user = await requireAdmin();
    if (!user) return;
    bindForm();
    loadCoupons();
  });
})();
