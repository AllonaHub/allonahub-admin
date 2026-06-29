(function () {
  const App = window.Allona = window.Allona || {};
  const config = App.config || {};

  const STORAGE_KEY = "allonahub_admin_alarm_v1";
  const SEEN_KEY = "allonahub_admin_alarm_seen_v1";
  const SILENCE_KEY = "allonahub_admin_alarm_silence_v1";
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
    overlay: null,
    overlayBody: null,
    suppressedUntil: 0,
    activeAudio: new Set(),
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

  function itemRaw(item) {
    return `${item.severity || ""} ${item.action || ""} ${item.flag_type || ""} ${item.kind || ""} ${item.title || ""} ${item.message || ""} ${item.reason || ""} ${item.actor_role || ""} ${item.role || ""} ${JSON.stringify(item.metadata || {})}`.toLowerCase();
  }

  function isPrivilegedActor(item) {
    const role = String(item.actor_role || item.role || "").toLowerCase();
    return ["admin", "super_admin"].includes(role);
  }

  function trustedAdminItem(item) {
    const raw = itemRaw(item);
    if (isPrivilegedActor(item) && item.source === "admin" && !/(authz\.denied|auth\.denied|owner_denied|role_denied|permission_super_admin_denied|boundary_denied)/.test(raw)) return true;
    if (!/(^| )(admin\.ops\.|super_admin\.)/.test(raw)) return false;
    if (/boundary_denied|authz\.denied|auth\.denied|owner_denied|role_denied|permission_super_admin_denied/.test(raw)) return false;
    if (/mfa_required|config_missing|missing|mismatch|unauthorized|forbidden/.test(raw)) return false;
    if (/failed|blocked|suspicious|attack|intrusion|sql|xss|csrf|bruteforce/.test(raw)) return false;
    return true;
  }

  function isExternalThreatItem(item) {
    const raw = itemRaw(item);
    if (trustedAdminItem(item)) return false;
    if (isPrivilegedActor(item) && item.source === "admin" && !/(authz\.denied|auth\.denied|owner_denied|role_denied|permission_super_admin_denied|boundary_denied)/.test(raw)) return false;
    return /authz\.denied|admin\.boundary_denied|owner_denied|role_denied|permission_super_admin_denied|red_zone|red zone|kırmızı|attack|intrusion|breach|compromise|bruteforce|sql|xss|csrf|auto_defense|blocked_ip|suspicious_ip/.test(raw);
  }

  function isCriticalAlarmItem(item) {
    const raw = itemRaw(item);
    if (!isExternalThreatItem(item)) return false;
    if (trustedAdminItem(item)) return false;
    if (item.type === "admin_notification") {
      return normalizeLevel(item.severity) === "critical"
        || /red_zone|red zone|kırmızı|critical|saldırı|attack|intrusion|breach|compromise/.test(raw);
    }
    if (item.type === "operation_flag") {
      return normalizeLevel(item.severity) === "critical";
    }
    return normalizeLevel(item.severity) === "critical"
      || /authz\.denied|admin\.boundary_denied|owner_denied|role_denied|permission_super_admin_denied|red_zone|red zone|attack|intrusion|breach|compromise|bruteforce|sql|xss|csrf/.test(raw);
  }

  function isAudibleAlarmItem(item) {
    return isCriticalAlarmItem(item);
  }

  function classifyItem(item) {
    const raw = itemRaw(item);
    if (trustedAdminItem(item)) return "low";
    if (/critical|authz\.denied|admin\.boundary_denied|owner_denied|role_denied|webhook|secret|attack|blocked|suspicious|payment|finance/.test(raw)) {
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
      ...(payload.notifications || []).map((item) => ({ ...item, type: "admin_notification", severity: normalizeLevel(item.severity) }))
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

  async function alarmPost(path, body) {
    const token = await sessionToken();
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body || {})
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || "Alarm işlemi tamamlanamadı.");
    return payload;
  }

  function endpoint() {
    return pageKind() === "super"
      ? "/v1/control-center/security"
      : "/v1/ops-console/security-monitoring";
  }

  async function alarmStatus() {
    if (pageKind() !== "super") return null;
    return alarmApi("/v1/control-center/alarm-status").catch(() => null);
  }

  function ensureAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error("Tarayıcı ses alarmını desteklemiyor.");
    if (!state.audioContext) state.audioContext = new AudioContext();
    return state.audioContext;
  }

  function trackAudio(node) {
    state.activeAudio.add(node);
    node.onended = () => state.activeAudio.delete(node);
  }

  function stopActiveAudio() {
    for (const node of state.activeAudio) {
      try {
        node.stop(0);
      } catch {}
    }
    state.activeAudio.clear();
    try {
      if (state.audioContext && state.audioContext.state === "running") state.audioContext.suspend();
    } catch {}
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
    trackAudio(oscillator);
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
    trackAudio(oscillator);
    oscillator.start(start);
    oscillator.stop(start + 3.25);
  }

  async function playAlarm(level) {
    if (!state.enabled) return;
    if (Date.now() < state.suppressedUntil) return;
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
    if (state.suppressedUntil && Date.now() < state.suppressedUntil) {
      return `${enabledText} / susturuldu: ${new Date(state.suppressedUntil).toLocaleTimeString("tr-TR")}`;
    }
    return `${enabledText} / ${state.lastLevel}: ${state.lastMessage}`;
  }

  function renderStatus() {
    if (!state.button || !state.status) return;
    state.button.textContent = state.enabled ? "Alarmı Kapat" : "Alarmı Aç";
    state.button.setAttribute("aria-pressed", state.enabled ? "true" : "false");
    state.root.dataset.level = state.lastLevel;
    state.status.textContent = statusText();
  }

  function activeIncidentFromStatus(payload) {
    const incident = payload && payload.alarm && payload.alarm.incident;
    if (!incident || !incident.active) return null;
    if (!incident.redZone) return null;
    if (incident.silencedUntil && Date.parse(incident.silencedUntil) > Date.now()) return null;
    return incident;
  }

  function overlayVisibleIncident(level, items, statusPayload) {
    const incident = activeIncidentFromStatus(statusPayload);
    if (incident) {
      return {
        level: incident.level || "critical",
        redZone: Boolean(incident.redZone),
        title: incident.redZone ? "Kırmızı Alan Güvenlik Alarmı" : "Güvenlik Alarmı",
        message: `${incident.action || "security"} ${incident.ipAddress ? `/ IP ${incident.ipAddress}` : ""}`,
        protection: incident.protection || null,
        serverIncident: true
      };
    }
    if ((LEVEL_WEIGHT[level] || 0) < LEVEL_WEIGHT.critical) return null;
    const first = items[0] || {};
    return {
      level,
      redZone: true,
      title: "Kritik Güvenlik Alarmı",
      message: `${itemTitle(first)}${itemMessage(first) ? ` - ${itemMessage(first)}` : ""}`,
      protection: null,
      serverIncident: false
    };
  }

  function protectionText(protection) {
    if (!protection) return "Koruma durumu alınamadı.";
    const parts = [
      protection.api_locked ? "API kilidi aktif" : "",
      protection.payments_locked ? "Ödeme kilidi aktif" : "",
      protection.orders_locked ? "Sipariş kilidi aktif" : "",
      protection.maintenance_suggested ? "Bakım modu önerildi" : "",
      protection.session_revoke_suggested ? "Oturum iptali önerildi" : "",
      protection.rollback_suggested ? "Rollback önerildi" : ""
    ].filter(Boolean);
    return parts.length ? parts.join(" / ") : "Otomatik koruma kilidi aktif değil.";
  }

  function showOverlay(incident) {
    if (!state.enabled || Date.now() < state.suppressedUntil) return;
    if (!incident || !state.overlay || !state.overlayBody) return;
    state.overlay.dataset.level = incident.level || "critical";
    state.overlay.hidden = false;
    state.overlayBody.innerHTML = `
      <strong>${incident.title}</strong>
      <span>${incident.message || "Kritik olay algılandı."}</span>
      <small>${protectionText(incident.protection)}</small>
    `;
  }

  function hideOverlay() {
    if (state.overlay) state.overlay.hidden = true;
  }

  function injectUi() {
    if (state.root) return;
    const style = document.createElement("style");
    style.textContent = `
      .ah-admin-alarm{position:fixed;right:12px;bottom:12px;z-index:900;display:grid;gap:6px;width:min(280px,calc(100vw - 24px));padding:8px;border:1px solid rgba(255,255,255,.18);border-radius:7px;background:rgba(6,14,28,.90);color:#fff;box-shadow:0 14px 40px rgba(0,0,0,.26);font:11px/1.3 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .ah-admin-alarm[data-level="high"]{border-color:rgba(255,184,77,.72)}
      .ah-admin-alarm[data-level="critical"]{border-color:rgba(255,77,109,.9);box-shadow:0 0 0 2px rgba(255,77,109,.22),0 18px 54px rgba(0,0,0,.42)}
      .ah-admin-alarm__row{display:flex;align-items:center;gap:8px;justify-content:space-between}
      .ah-admin-alarm strong{font-size:11px}
      .ah-admin-alarm button{border:1px solid rgba(255,255,255,.22);border-radius:6px;background:#12223a;color:#fff;min-height:26px;padding:4px 7px;font-weight:800;cursor:pointer;font-size:11px}
      .ah-admin-alarm button[aria-pressed="true"]{background:#0f5132;border-color:rgba(56,217,150,.5)}
      .ah-admin-alarm__test{background:#44211c!important;border-color:rgba(255,184,77,.5)!important}
      .ah-admin-alarm__status{color:rgba(255,255,255,.78);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
      .ah-admin-alarm-screen{position:fixed;inset:0;z-index:2147483100;display:grid;place-items:center;padding:24px;background:rgba(5,8,14,.82);backdrop-filter:blur(8px)}
      .ah-admin-alarm-screen[hidden]{display:none}
      .ah-admin-alarm-screen__panel{width:min(620px,calc(100vw - 32px));border:2px solid rgba(255,77,109,.92);border-radius:10px;background:#100b11;color:#fff;box-shadow:0 28px 90px rgba(0,0,0,.58),0 0 0 8px rgba(255,77,109,.18);padding:18px;display:grid;gap:14px}
      .ah-admin-alarm-screen__body{display:grid;gap:6px}
      .ah-admin-alarm-screen__body strong{font-size:20px}
      .ah-admin-alarm-screen__body span{font-size:14px;color:rgba(255,255,255,.88)}
      .ah-admin-alarm-screen__body small{font-size:12px;color:rgba(255,255,255,.68)}
      .ah-admin-alarm-screen__actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      .ah-admin-alarm-screen__actions button{min-height:38px;border-radius:7px;border:1px solid rgba(255,255,255,.18);background:#211827;color:#fff;padding:8px 11px;font-weight:900;cursor:pointer}
      .ah-admin-alarm-screen__actions [data-admin-alarm-resolve]{background:#681b2b}
    `;
    document.head.appendChild(style);

    state.root = document.createElement("section");
    state.root.className = "ah-admin-alarm";
    state.root.setAttribute("aria-label", "Admin sesli alarm");
    state.root.innerHTML = `
      <div class="ah-admin-alarm__row">
        <strong>Güvenlik Alarmı</strong>
        <button type="button" data-admin-alarm-toggle aria-pressed="false">Alarmı Aç</button>
      </div>
      <div class="ah-admin-alarm__row">
        <span class="ah-admin-alarm__status" data-admin-alarm-status>Alarm beklemede</span>
        <button class="ah-admin-alarm__test" type="button" data-admin-alarm-test>Test</button>
      </div>
    `;
    document.body.appendChild(state.root);
    state.overlay = document.createElement("section");
    state.overlay.className = "ah-admin-alarm-screen";
    state.overlay.hidden = true;
    state.overlay.setAttribute("role", "alertdialog");
    state.overlay.setAttribute("aria-modal", "true");
    state.overlay.innerHTML = `
      <div class="ah-admin-alarm-screen__panel">
        <div class="ah-admin-alarm-screen__body" data-admin-alarm-overlay-body></div>
        <div class="ah-admin-alarm-screen__actions">
          <button type="button" data-admin-alarm-enable-sound>Sesli alarmı aç</button>
          <button type="button" data-admin-alarm-ack>30 dk sustur</button>
          <button type="button" data-admin-alarm-resolve>Alarmı kapat</button>
          <button type="button" data-admin-alarm-hide>Paneli gizle</button>
        </div>
      </div>
    `;
    document.body.appendChild(state.overlay);
    state.overlayBody = state.overlay.querySelector("[data-admin-alarm-overlay-body]");
    state.button = state.root.querySelector("[data-admin-alarm-toggle]");
    state.status = state.root.querySelector("[data-admin-alarm-status]");
    state.button.addEventListener("click", toggleAlarm);
    state.root.querySelector("[data-admin-alarm-test]").addEventListener("click", async () => {
      await enableAlarm();
      state.lastLevel = "critical";
      state.lastMessage = "Test alarmı";
      renderStatus();
      await playAlarm("critical");
    });
    state.overlay.querySelector("[data-admin-alarm-enable-sound]").addEventListener("click", enableAlarm);
    state.overlay.querySelector("[data-admin-alarm-hide]").addEventListener("click", hideOverlay);
    state.overlay.querySelector("[data-admin-alarm-ack]").addEventListener("click", acknowledgeAlarm);
    state.overlay.querySelector("[data-admin-alarm-resolve]").addEventListener("click", resolveAlarm);
  }

  async function enableAlarm() {
    state.enabled = true;
    state.suppressedUntil = 0;
    saveJson(STORAGE_KEY, { enabled: true, updated_at: new Date().toISOString() });
    saveJson(SILENCE_KEY, { until: 0 });
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
    pollAlarm();
  }

  function disableAlarm(message = "Alarm kapatıldı") {
    state.enabled = false;
    state.suppressedUntil = 0;
    stopActiveAudio();
    hideOverlay();
    saveJson(STORAGE_KEY, { enabled: false, updated_at: new Date().toISOString() });
    saveJson(SILENCE_KEY, { until: 0 });
    state.lastLevel = "low";
    state.lastMessage = message;
    renderStatus();
  }

  async function toggleAlarm() {
    if (state.enabled) {
      disableAlarm("Manuel kapatıldı");
      return;
    }
    await enableAlarm();
  }

  function remember(items) {
    items.forEach((item) => state.seen.add(itemId(item)));
    const trimmed = Array.from(state.seen).slice(-MAX_SEEN);
    state.seen = new Set(trimmed);
    saveJson(SEEN_KEY, trimmed);
  }

  async function acknowledgeAlarm() {
    if (pageKind() === "super") {
      await alarmPost("/v1/control-center/alarm-acknowledge", { reason: "Alarm panelinden manuel susturma" }).catch(() => null);
    }
    state.suppressedUntil = Date.now() + 30 * 60 * 1000;
    saveJson(SILENCE_KEY, { until: state.suppressedUntil });
    stopActiveAudio();
    hideOverlay();
    state.lastMessage = "Alarm susturuldu";
    renderStatus();
  }

  async function resolveAlarm() {
    if (pageKind() === "super") {
      await alarmPost("/v1/control-center/alarm-resolve", { reason: "Alarm panelinden manuel kapatma" }).catch(() => null);
      await alarmPost("/v1/control-center/alarm-protection", { action: "clear", reason: "Alarm kapatılırken runtime koruma temizlendi" }).catch(() => null);
    }
    const currentItems = await alarmApi(endpoint()).then(normalizeItems).catch(() => []);
    remember(currentItems);
    disableAlarm("Alarm kapatıldı");
  }

  async function pollAlarm() {
    if (!pageKind()) return;
    if (!state.enabled) {
      hideOverlay();
      state.lastLevel = "low";
      state.lastMessage = "Kapalı; manuel açılınca izler";
      renderStatus();
      return;
    }
    try {
      const [payload, statusPayload] = await Promise.all([
        alarmApi(endpoint()),
        alarmStatus()
      ]);
      const items = normalizeItems(payload);
      const serverIncident = overlayVisibleIncident("critical", [], statusPayload);
      if (serverIncident) showOverlay(serverIncident);
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
      if (Date.now() < state.suppressedUntil) {
        state.lastLevel = "low";
        state.lastMessage = "Alarm susturuldu";
        renderStatus();
        return;
      }
      const audible = fresh.filter(isAudibleAlarmItem);
      const critical = fresh.filter(isCriticalAlarmItem);
      if (!audible.length && !critical.length) {
        state.lastLevel = "low";
        state.lastMessage = "Yeni kritik uyarı yok";
        renderStatus();
        return;
      }

      const actionable = critical.length ? critical : audible;
      const level = critical.length ? "critical" : maxLevel(actionable);
      const first = actionable[0];
      state.lastLevel = level;
      state.lastMessage = `${actionable.length} yeni uyarı: ${itemTitle(first)}`;
      renderStatus();
      const visibleIncident = overlayVisibleIncident(level, actionable, statusPayload);
      if (visibleIncident) showOverlay(visibleIncident);
      await playAlarm(level);
      if (critical.length) notify(level, actionable);
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
    state.suppressedUntil = Number(loadJson(SILENCE_KEY, {}).until || 0);
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
