(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const config = App.config || {};

  const state = {
    loaded: false,
    alerts: [],
    soundAllowed: false,
    played: new Set()
  };

  function $(selector) {
    return document.querySelector(selector);
  }

  function escape(value) {
    return core && core.escapeHTML
      ? core.escapeHTML(value ?? "")
      : String(value ?? "").replace(/[&<>"']/g, (char) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "\"": "&quot;",
          "'": "&#39;"
        })[char]);
  }

  function apiBase() {
    return String(config.apiBaseUrl || "").replace(/\/$/, "");
  }

  async function adminSessionToken() {
    if (!App.auth || !App.auth.getSession) return "";
    try {
      const session = await App.auth.getSession();
      return session?.access_token || "";
    } catch {
      return "";
    }
  }

  function savedSoundAllowed() {
    try {
      return window.localStorage.getItem("allona:platform-emergency-sound") === "1";
    } catch {
      return false;
    }
  }

  function saveSoundAllowed(value) {
    state.soundAllowed = value;
    try {
      window.localStorage.setItem("allona:platform-emergency-sound", value ? "1" : "0");
    } catch {
      // Notification preference remains session-only if storage is unavailable.
    }
  }

  function ensureStyles() {
    if ($("style[data-platform-alert-styles]")) return;
    const style = document.createElement("style");
    style.dataset.platformAlertStyles = "true";
    style.textContent = `
      .platform-alert-stack{position:fixed;top:88px;right:16px;z-index:1200;width:min(420px,calc(100vw - 32px));display:grid;gap:10px;pointer-events:none}
      .platform-alert{border:1px solid rgba(0,213,232,.35);border-radius:8px;background:rgba(5,11,20,.94);color:#f6fbff;box-shadow:0 18px 42px rgba(0,0,0,.28);padding:12px;display:grid;grid-template-columns:1fr auto;gap:12px;pointer-events:auto;backdrop-filter:blur(14px)}
      .platform-alert--critical{border-color:rgba(255,77,109,.68)}
      .platform-alert--warning{border-color:rgba(245,200,75,.55)}
      .platform-alert strong{display:block;margin-bottom:4px;font-size:14px;line-height:1.2}
      .platform-alert p{margin:0;color:rgba(246,251,255,.78);font-size:13px;line-height:1.4}
      .platform-alert__actions{display:flex;align-items:flex-start;gap:6px}
      .platform-alert__actions button{min-height:32px;border:1px solid rgba(0,213,232,.32);border-radius:8px;background:rgba(255,255,255,.08);color:#f6fbff;padding:0 10px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}
      .platform-alert__actions button:hover{background:rgba(0,213,232,.14)}
      @media(max-width:720px){.platform-alert-stack{top:72px;right:10px;width:calc(100vw - 20px)}.platform-alert{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function playTone(alert) {
    if (!state.soundAllowed || !alert.sound_enabled) return;
    if (state.played.has(alert.id)) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    state.played.add(alert.id);
    const audio = new AudioContext();
    const gain = audio.createGain();
    gain.gain.value = alert.severity === "critical" ? 0.075 : 0.045;
    gain.connect(audio.destination);
    [0, 180, 360].forEach((offset) => {
      const oscillator = audio.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = alert.severity === "critical" ? 820 : 560;
      oscillator.connect(gain);
      oscillator.start(audio.currentTime + offset / 1000);
      oscillator.stop(audio.currentTime + (offset + 130) / 1000);
    });
    setTimeout(() => audio.close().catch(() => {}), 820);
  }

  function render() {
    const existing = $("[data-platform-alert-stack]");
    if (!state.alerts.length) {
      if (existing) existing.remove();
      return;
    }

    const stack = existing || document.createElement("div");
    stack.className = "platform-alert-stack";
    stack.dataset.platformAlertStack = "true";
    stack.setAttribute("aria-live", "polite");
    stack.innerHTML = state.alerts.map((alert) => `
      <section class="platform-alert platform-alert--${escape(alert.severity || "warning")}" data-platform-alert-id="${escape(alert.id)}">
        <div>
          <strong>${escape(alert.title)}</strong>
          <p>${escape(alert.message)}</p>
        </div>
        <div class="platform-alert__actions">
          ${alert.sound_enabled && !state.soundAllowed ? `<button type="button" data-platform-alert-sound>Ses</button>` : ""}
          <button type="button" data-platform-alert-close="${escape(alert.id)}">Kapat</button>
        </div>
      </section>
    `).join("");

    if (!existing) document.body.appendChild(stack);
    state.alerts.forEach(playTone);
  }

  async function loadAlerts() {
    const base = apiBase();
    if (!base) return;
    const token = await adminSessionToken();
    if (!token) return;
    try {
      const response = await fetch(`${base}/v1/admin/platform-alerts`, {
        credentials: "omit",
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) return;
      state.alerts = (payload.alerts || []).filter((alert) => {
        try {
          return window.sessionStorage.getItem(`allona:platform-alert-closed:${alert.id}`) !== "1";
        } catch {
          return true;
        }
      });
      render();
    } catch {
      // Admin alert feed must never block the page.
    }
  }

  function bind() {
    if (state.loaded) return;
    state.loaded = true;
    state.soundAllowed = savedSoundAllowed();
    ensureStyles();

    document.addEventListener("click", (event) => {
      const close = event.target.closest("[data-platform-alert-close]");
      if (close) {
        try {
          window.sessionStorage.setItem(`allona:platform-alert-closed:${close.dataset.platformAlertClose}`, "1");
        } catch {
          // Alert can still be removed from the current DOM.
        }
        state.alerts = state.alerts.filter((alert) => alert.id !== close.dataset.platformAlertClose);
        render();
        return;
      }

      if (event.target.closest("[data-platform-alert-sound]")) {
        saveSoundAllowed(true);
        state.alerts.forEach(playTone);
        render();
      }
    });

    loadAlerts();
    window.setInterval(loadAlerts, 60000);
  }

  document.addEventListener("allona:layout-ready", bind);
  document.addEventListener("DOMContentLoaded", () => {
    if (
      document.querySelector("[data-layout='header']")
      || document.querySelector("[data-page='admin-ops']")
      || document.querySelector("[data-page='super-admin']")
    ) {
      bind();
    }
  });
})();
