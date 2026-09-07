(function () {
  const App = window.Allona = window.Allona || {};

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function setStatus(message, tone = "info") {
    const node = $("[data-module-archive-status]");
    if (!node) return;
    node.textContent = message;
    node.dataset.tone = tone;
  }

  function loginUrl() {
    const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    return App.core?.url
      ? App.core.url(`/admin/admin-login.html?returnTo=${returnTo}`)
      : `/admin/admin-login.html?returnTo=${returnTo}`;
  }

  async function init() {
    if (document.body?.dataset?.page !== "admin-module-archive") return;

    try {
      const session = await App.auth?.getSession?.();
      if (!session?.access_token) {
        window.location.href = loginUrl();
        return;
      }

      await App.auth.requireRole(["admin", "super_admin"]);

      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (await App.auth.redirectToMfaIfNeeded?.(returnTo)) return;

      document.body.classList.add("is-authorized");
      setStatus("Admin görünümü aktif. Public vitrinde gizlenen tüm modül kartları burada düzenleme için görünür.");
    } catch (error) {
      setStatus(error?.message || "Modül arşivi için admin yetkisi doğrulanamadı.", "error");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
