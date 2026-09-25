(function () {
  "use strict";
  const App = window.Allona || {};
  const $ = (selector) => document.querySelector(selector);
  const params = new URLSearchParams(location.search);
  const partnerId = params.get("partner_id");
  const partner = params.get("source") === "partner" && !!partnerId;
  const state = { session: null, threads: [], rooms: [], documentRequests: [], active: null, messages: [], seen: new Set(), loaded: false, timer: null };
  const base = () => /^(localhost|127\.0\.0\.1)$/i.test(location.hostname) ? "http://localhost:3000" : String(App.config?.apiBaseUrl || "https://api.allonahub.com").replace(/\/$/, "");
  function status(text) { $("[data-firm-status]").textContent = text || ""; }
  async function api(path, options = {}) {
    const response = await fetch(`${base()}${path}`, { ...options, headers: { Authorization: `Bearer ${state.session.access_token}`, Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok !== true) throw new Error(result.message || "İşlem tamamlanamadı.");
    return result;
  }
  const path = "/v1/maritime/connect-chat/threads";
  function name(thread) { return partner ? thread.candidate_name : thread.company_name; }
  function renderList() {
    const root = $("[data-firm-list]"); root.replaceChildren();
    if (partner) {
      const known = new Set(state.threads.map((thread) => thread.candidate_user_id));
      for (const room of state.rooms.filter((item) => !known.has(item.candidate_user_id))) {
        const button = document.createElement("button"); button.type = "button"; button.className = "firm-chat-item";
        button.textContent = `${room.candidate_name} · Görüşme başlat`;
        button.addEventListener("click", () => openRoom(room)); root.append(button);
      }
    }
    for (const thread of state.threads) {
      const button = document.createElement("button"); button.type = "button";
      button.className = `firm-chat-item${state.active?.id === thread.id ? " is-active" : ""}`;
      const initials = document.createElement("span"); initials.className = "firm-chat-initials";
      initials.textContent = name(thread).trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toLocaleUpperCase("tr");
      const words = document.createElement("span"); words.className = "firm-chat-item-text";
      const strong = document.createElement("strong"); strong.textContent = name(thread);
      const small = document.createElement("small"); small.textContent = thread.last_message;
      words.append(strong, small); button.append(initials, words);
      if (thread.unread) { const badge = document.createElement("span"); badge.className = "firm-chat-unread"; badge.textContent = "1"; badge.setAttribute("aria-label", "Okunmamış mesaj"); button.append(badge); }
      button.addEventListener("click", () => openThread(thread)); root.append(button);
    }
    if (!root.childElementCount) { const empty = document.createElement("p"); empty.className = "firm-chat-empty"; empty.textContent = partner ? "Onaylı aday görüşmesi henüz yok." : "Firmalardan henüz mesaj gelmedi."; root.append(empty); }
  }
  function renderMessages() {
    const root = $("[data-firm-messages]"); root.replaceChildren();
    for (const message of state.messages) {
      const item = document.createElement("article"); item.className = `firm-chat-bubble${message.sender_user_id === state.session.user.id ? " is-own" : ""}`;
      const body = document.createElement("p"); body.textContent = message.body;
      const time = document.createElement("time"); time.textContent = new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      item.append(body, time); root.append(item);
    }
    root.scrollTop = root.scrollHeight;
  }
  function renderDocumentRequest() {
    const root = $("[data-firm-document-request]"); root.replaceChildren();
    const request = state.documentRequests.find((item) => item.candidate_room_id === state.active?.candidate_room_id);
    if (!request || (partner && request.status !== "pending")) return;
    const card = document.createElement("div"); card.className = "firm-chat-permission";
    const label = document.createElement("p");
    label.textContent = partner ? "Adaydan belge görüntüleme izni bekleniyor." : request.status === "accepted" ? "Belge görüntüleme izni açık. İstediğiniz zaman geri çekebilirsiniz." : request.status === "declined" || request.status === "revoked" ? "Bu belge paylaşım izni kapalı." : "Bu şirket, başvurunuzdaki belgeleri işe alım değerlendirmesi için görüntülemek istiyor. İzni daha sonra geri çekebilirsiniz.";
    card.append(label);
    if (!partner) {
      const actions = document.createElement("div"); actions.className = "firm-chat-permission-actions";
      const decisions = request.status === "pending" ? [["accepted", "İzin Ver"], ["declined", "Reddet"]] : request.status === "accepted" ? [["revoked", "İzni Geri Çek"]] : [["accepted", "İzin Ver"]];
      for (const [decision, text] of decisions) {
        const button = document.createElement("button"); button.type = "button"; button.textContent = text;
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            const direct = request.application_consent || request.status === "declined" || request.status === "revoked";
            const endpoint = direct
              ? `/v1/maritime/candidate/document-permissions/${encodeURIComponent(request.candidate_room_id)}/${decision === "revoked" ? "revoke" : "allow"}`
              : `/v1/maritime/candidate/document-requests/${encodeURIComponent(request.id)}/respond`;
            await api(endpoint, { method: "POST", body: JSON.stringify(direct ? {} : { decision }) });
            await refresh(); status(decision === "accepted" ? "Belge görüntüleme izni verildi." : "Belge görüntüleme izni kapatıldı.");
          } catch (error) { status(error.message); button.disabled = false; }
        });
        actions.append(button);
      }
      card.append(actions);
    }
    root.append(card);
  }
  async function openRoom(room) {
    try {
      const result = await api(path, { method: "POST", body: JSON.stringify({ partner_id: partnerId, candidate_room_id: room.id }) });
      await openThread({ id: result.thread_id, candidate_room_id: room.id, candidate_user_id: room.candidate_user_id, candidate_name: room.candidate_name });
    } catch (error) { status(error.message); }
  }
  async function openThread(thread) {
    state.active = thread; document.body.classList.add("firm-chat-open");
    $("[data-firm-name]").textContent = name(thread);
    $("[data-firm-subtitle]").textContent = partner ? "Onaylı aday görüşmesi" : "Doğrulanmış şirket görüşmesi";
    renderList(); renderDocumentRequest();
    try {
      const result = await api(`${path}/${encodeURIComponent(thread.id)}/messages`);
      state.messages = result.messages.reverse(); renderMessages();
      await api(`${path}/${encodeURIComponent(thread.id)}/read`, { method: "POST" });
      thread.unread = false; renderList(); status("");
    } catch (error) { status(error.message); }
  }
  async function refresh() {
    const query = partner ? `?partner_id=${encodeURIComponent(partnerId)}` : "";
    const result = await api(path + query);
    for (const thread of result.threads) {
      const key = `${thread.id}:${thread.last_message_at}`;
      if (thread.unread && state.loaded && !state.seen.has(key) && localStorage.getItem("allona.marsoh.firmNotifications") !== "muted" && "Notification" in window && Notification.permission === "granted" && document.hidden) {
        new Notification("AllonaHub · Yeni firma mesajı", { body: partner ? "Adaydan yeni mesajınız var." : `${thread.company_name} size mesaj gönderdi.`, tag: thread.id });
      }
      state.seen.add(key);
    }
    state.threads = result.threads;
    if (!partner) {
      const permissions = await api("/v1/maritime/candidate/document-requests");
      state.documentRequests = permissions.requests || [];
    }
    state.loaded = true;
    if (partner) {
      const eligible = await api(`/v1/maritime/connect-chat/eligible-rooms?partner_id=${encodeURIComponent(partnerId)}`);
      state.rooms = eligible.rooms;
    }
    renderList(); renderDocumentRequest();
    if (state.active) {
      const latest = state.threads.find((item) => item.id === state.active.id);
      if (latest && state.messages.length && state.messages.at(-1)?.created_at !== latest.last_message_at) await openThread(latest);
    }
  }
  async function init() {
    state.session = await App.auth?.getSession?.();
    if (!state.session?.access_token) { status("Mesajları görmek için giriş yapın."); return; }
    if (partner) { $("[data-firm-title]").textContent = "Aday Görüşmeleri"; $("[data-firm-intro]").textContent = "Yalnızca onaylı başvurularınıza ait görüşmeler."; }
    const preference = $("[data-firm-preference]");
    preference.value = localStorage.getItem("allona.marsoh.firmNotifications") === "muted" ? "muted" : "all";
    preference.addEventListener("change", () => localStorage.setItem("allona.marsoh.firmNotifications", preference.value));
    const notify = $("[data-firm-notify]");
    if (!("Notification" in window) || Notification.permission === "denied") notify.hidden = true;
    else notify.addEventListener("click", async () => { const permission = await Notification.requestPermission(); notify.hidden = permission !== "default"; status(permission === "granted" ? "Tarayıcı bildirimleri açıldı." : "Tarayıcı bildirimi izni verilmedi."); });
    try {
      await refresh();
      if (partner && params.get("room_id")) {
        const room = state.rooms.find((item) => item.id === params.get("room_id"));
        const thread = state.threads.find((item) => item.candidate_room_id === params.get("room_id"));
        if (thread) await openThread(thread);
        else if (room) await openRoom(room);
      }
    } catch (error) { status(error.message); }
    $("[data-firm-form]").addEventListener("submit", async (event) => {
      event.preventDefault(); if (!state.active) return;
      const input = $("[data-firm-input]"); const body = input.value.trim(); if (!body) return;
      const key = crypto.randomUUID(); input.disabled = true;
      try {
        await api(`${path}/${encodeURIComponent(state.active.id)}/messages`, { method: "POST", body: JSON.stringify({ idempotency_key: key, body }) });
        input.value = ""; await openThread(state.active); await refresh();
      } catch (error) { status(error.message); } finally { input.disabled = false; input.focus(); }
    });
    $("[data-firm-back]").addEventListener("click", () => document.body.classList.remove("firm-chat-open"));
    state.timer = setInterval(() => refresh().catch((error) => status(error.message)), 8000);
    window.addEventListener("pagehide", () => clearInterval(state.timer));
  }
  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
