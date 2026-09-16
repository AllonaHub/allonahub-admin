(function () {
  "use strict";

  const App = window.Allona = window.Allona || {};

  async function init() {
    const badge = document.querySelector("[data-marsoh-entry-unread]");
    if (!badge || !App.auth?.getSession) return;
    const session = await App.auth.getSession();
    if (!session?.access_token) return;
    try {
      const apiBase = String(App.config?.apiBaseUrl || "https://api.allonahub.com").replace(/\/$/, "");
      const response = await fetch(`${apiBase}/v1/maritime/marsoh/bootstrap`, {
        cache: "no-store",
        headers: { Accept: "application/json", Authorization: `Bearer ${session.access_token}` }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok !== true) return;
      const count = (payload.channels || []).reduce((sum, channel) => sum + Number(channel.unread_count || 0), 0);
      badge.hidden = count < 1;
      badge.textContent = count > 99 ? "99+" : String(count);
      badge.setAttribute("aria-label", `${count} okunmamış MarSoh mesajı`);
    } catch {
      badge.hidden = true;
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
