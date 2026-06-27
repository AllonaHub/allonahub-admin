(function () {
  const App = window.Allona = window.Allona || {};
  const config = App.config || {};

  const STORAGE_KEY = "allonahub_admin_alarm_v1";
  const SEEN_KEY = "allonahub_admin_alarm_seen_v1";
  const POLL_MS = 30000;
  const MAX_SEEN = 160;
  const LEVEL_WEIGHT = { low: 0, info: 0, medium: 1, warning: 2, high: 2, critical: 3 };

  const state = {
    enabled: false,
    initialized: false,
    baselineReady: false,
    lastLevel: "low",
    lastMessage: "Alarm beklemede",
    timer: null,
    audioContext: null,
    root: null,
    button: null,
    status: null,
    seen: new Set()
  };

  function pageKind() {
    const page = document.body && document.body.dataset && document.body.dataset.page;
    if (page === "super-admin") return "super";
    if (page === "admin-ops") return "admin";
    return "";
  }

  function loadJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") || fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage can be disabled in private windows; alarm still works for the current tab.
    }
  }

  function normalizeLevel(value) {
    const level = String(value || "low").toLowerCase();
    if (level === "debug" || level === "info") return "low";
    if (level === "warning") return "high";
    if (["low", "medium", "high", "critical"].includes(level)) return level;
    return "medium";
  }

  function maxLevel(items) {
    return items.reduce((best, item) => {
      const level = normalizeLevel(item.severity || item.risk_level || item.level);
      return (LEVEL_WEIGHT[level] || 0) > (LEVEL_WEIGHT[best] || 0) ? level : best;
    }, "low");
  }

  function itemId(item) {
    return [
      item.kind || item.type || "event",
      item.id || item.resource_id || item.target_id || item.created_at || "",
      item.action || item.flag_type || item.title || item.message || ""
    ].join(":");
  }

  function itemTitle(item) {
    return item.title || item.action || item.flag_type || item.kind || item.resource_type || "Güvenlik uyarısı";
  }

  function itemMessage(item) {
    return item.message || item.reason || item.summary || item.resource_type || item.source || "";
  }

  function classifyItem(item) {
    const raw = `${item.severity || ""} ${item.action || ""} ${item.flag_type || ""} ${item.title || ""} ${item.message || ""}`.toLowerCase();
    if (/critical|authz\.denied|admin\.boundary_denied|owner|super_admin|webhook|secret|attack|blocked|suspicious|payment|finance/.test(raw)) {
      return "critical";
    }
    if (/warning|auth\.denied|mfa|required|failed|risk|flag|denied/.test(raw)) return "high";
    return normalizeLevel(item.severity || item.risk_level || "medium");
  }

  function normalizeItems(payload) {
    const kind = pageKind();
    if (kind === "super") {
      const security = payload.security || {};
      return (security.recent_events || []).map((item) => ({
        ...item,
        type: "security_event",
        severity: classifyItem(item)
      }));
    }
    return [
      ...(payload.events || []).map((item) => ({ ...item, type: "security_event", severity: classifyItem(item) })),
      ...(payload.flags || []).map((item) => ({ ...item, type: "operation_flag", severity: classifyItem(item) })),
      ...(payload.notifications || []).map((item) => ({ ...item, type: "admin_notification", severity: classifyItem(item) }))
    ];
  }

  async function sessionToken() {
    if (!App.auth || !App.auth.getSession) throw new Error("Oturum sistemi yüklenemedi.");
    const session = await App.auth.getSession();
    if (!session || !session.access_token) throw new Error("Oturum doğrulanamadı.");
    return session.access_token;
  }

  async function alarmApi(path) {
    const token = await sessionToken();
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || "Alarm verisi alınamadı.");
    return payload;
  }

  function endpoint() {
    return pageKind() === "super"
      ? "/v1/control-center/security"
      : "/v1/ops-console/security-monitoring";
  }

  function ensureAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error("Tarayıcı ses alarmını desteklemiyor.");
    if (!state.audioContext) state.audioContext = new AudioContext();
    return state.audioContext;
  }

  function playTone({ frequency = 720, duration = 0.16, delay = 0, type = "square", gain = 0.08 }) {
    const ctx = ensureAudio();
    const oscillator = ctx.createOscillator();
    const volume = ctx.createGain();
    const start = ctx.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(gain, start + 0.015);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(volume).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function playCriticalSiren() {
    const ctx = ensureAudio();
    const oscillator = ctx.createOscillator();
    const volume = ctx.createGain();
    const start = ctx.currentTime;
    oscillator.type = "sawtooth";
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(0.11, start + 0.04);
    for (let i = 0; i < 9; i += 1) {
      oscillator.frequency.linearRampToValueAtTime(i % 2 ? 520 : 980, start + 0.25 + i * 0.32);
    }
    volume.gain.exponentialRampToValueAtTime(0.0001, start + 3.2);
    oscillator.connect(volume).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + 3.25);
  }

  async function playAlarm(level) {
    if (!state.enabled) return;
    const ctx = ensureAudio();
    if (ctx.state === "suspended") await ctx.resume();
    if (level === "critical") {
      playCriticalSiren();
      return;
    }
    if (level === "high") {
      [0, 0.24, 0.48, 0.88].forEach((delay, index) => playTone({ frequency: index === 3 ? 520 : 860, delay, duration: 0.15, gain: 0.09 }));
      return;
    }
    if (level === "medium") {
      playTone({ frequency: 680, duration: 0.12, gain: 0.055 });
      playTone({ frequency: 680, delay: 0.22, duration: 0.12, gain: 0.055 });
    }
  }

  function notify(level, items) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const first = items[0] || {};
    const title = level === "critical" ? "AllonaHub Kritik Alarm" : "AllonaHub Güvenlik Uyarısı";
    const body = `${itemTitle(first)}${itemMessage(first) ? ` - ${itemMessage(first)}` : ""}`;
    try {
      new Notification(title, {
        body,
        tag: `allonahub-admin-${level}`,
        requireInteraction: level === "critical"
      });
    } catch {
      // Desktop notifications are optional; sound and in-panel state remain active.
    }
  }

  function statusText() {
    const enabledText = state.enabled ? "Alarm açık" : "Alarm kapalı";
    return `${enabledText} / ${state.lastLevel}: ${state.lastMessage}`;
  }

  function renderStatus() {
    if (!state.button || !state.status) return;
    state.button.textContent = state.enabled ? "Alarm Açık" : "Alarmı Etkinleştir";
    state.button.setAttribute("aria-pressed", state.enabled ? "true" : "false");
    state.root.dataset.level = state.lastLevel;
    state.status.textContent = statusText();
  }

  function injectUi() {
    if (state.root) return;
    const style = document.createElement("style");
    style.textContent = `
      .ah-admin-alarm{position:fixed;right:16px;bottom:16px;z-index:2147483000;display:grid;gap:8px;max-width:min(360px,calc(100vw - 32px));padding:10px;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:rgba(6,14,28,.94);color:#fff;box-shadow:0 18px 54px rgba(0,0,0,.32);font:12px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .ah-admin-alarm[data-level="high"]{border-color:rgba(255,184,77,.72)}
      .ah-admin-alarm[data-level="critical"]{border-color:rgba(255,77,109,.9);box-shadow:0 0 0 2px rgba(255,77,109,.22),0 18px 54px rgba(0,0,0,.42)}
      .ah-admin-alarm__row{display:flex;align-items:center;gap:8px;justify-content:space-between}
      .ah-admin-alarm button{border:1px solid rgba(255,255,255,.22);border-radius:6px;background:#12223a;color:#fff;min-height:30px;padding:6px 9px;font-weight:800;cursor:pointer}
      .ah-admin-alarm button[aria-pressed="true"]{background:#0f5132;border-color:rgba(56,217,150,.5)}
      .ah-admin-alarm__test{background:#44211c!important;border-color:rgba(255,184,77,.5)!important}
      .ah-admin-alarm__status{color:rgba(255,255,255,.78);overflow-wrap:anywhere}
    `;
    document.head.appendChild(style);

    state.root = document.createElement("section");
    state.root.className = "ah-admin-alarm";
    state.root.setAttribute("aria-label", "Admin sesli alarm");
    state.root.innerHTML = `
      <div class="ah-admin-alarm__row">
        <strong>Güvenlik Alarmı</strong>
        <button type="button" data-admin-alarm-toggle aria-pressed="false">Alarmı Etkinleştir</button>
      </div>
      <div class="ah-admin-alarm__row">
        <span class="ah-admin-alarm__status" data-admin-alarm-status>Alarm beklemede</span>
        <button class="ah-admin-alarm__test" type="button" data-admin-alarm-test>Test</button>
      </div>
    `;
    document.body.appendChild(state.root);
    state.button = state.root.querySelector("[data-admin-alarm-toggle]");
    state.status = state.root.querySelector("[data-admin-alarm-status]");
    state.button.addEventListener("click", enableAlarm);
    state.root.querySelector("[data-admin-alarm-test]").addEventListener("click", async () => {
      await enableAlarm();
      state.lastLevel = "critical";
      state.lastMessage = "Test alarmı";
      renderStatus();
      await playAlarm("critical");
    });
  }

  async function enableAlarm() {
    state.enabled = true;
    saveJson(STORAGE_KEY, { enabled: true });
    try {
      const ctx = ensureAudio();
      if (ctx.state === "suspended") await ctx.resume();
    } catch (error) {
      state.lastLevel = "high";
      state.lastMessage = error.message;
    }
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    renderStatus();
  }

  function remember(items) {
    items.forEach((item) => state.seen.add(itemId(item)));
    const trimmed = Array.from(state.seen).slice(-MAX_SEEN);
    state.seen = new Set(trimmed);
    saveJson(SEEN_KEY, trimmed);
  }

  async function pollAlarm() {
    if (!pageKind()) return;
    try {
      const payload = await alarmApi(endpoint());
      const items = normalizeItems(payload);
      if (!state.baselineReady) {
        remember(items);
        state.baselineReady = true;
        state.lastLevel = "low";
        state.lastMessage = `${items.length} kayıt izlendi`;
        renderStatus();
        return;
      }

      const fresh = items.filter((item) => !state.seen.has(itemId(item)));
      remember(items);
      const actionable = fresh.filter((item) => (LEVEL_WEIGHT[normalizeLevel(item.severity)] || 0) >= LEVEL_WEIGHT.medium);
      if (!actionable.length) {
        state.lastLevel = "low";
        state.lastMessage = "Yeni kritik uyarı yok";
        renderStatus();
        return;
      }

      const level = maxLevel(actionable);
      const first = actionable[0];
      state.lastLevel = level;
      state.lastMessage = `${actionable.length} yeni uyarı: ${itemTitle(first)}`;
      renderStatus();
      await playAlarm(level);
      notify(level, actionable);
    } catch (error) {
      state.lastLevel = "high";
      state.lastMessage = error.message || "Alarm izleme hatası";
      renderStatus();
    }
  }

  function init() {
    if (!pageKind() || state.initialized) return;
    state.initialized = true;
    const saved = loadJson(STORAGE_KEY, {});
    state.enabled = saved.enabled === true;
    state.seen = new Set(loadJson(SEEN_KEY, []));
    injectUi();
    renderStatus();
    pollAlarm();
    state.timer = setInterval(pollAlarm, POLL_MS);
  }

  App.adminAlarm = {
    init,
    enable: enableAlarm,
    poll: pollAlarm,
    test: () => playAlarm("critical")
  };

  document.addEventListener("DOMContentLoaded", init);
})();
