(function () {
  "use strict";
  const App = window.Allona || {};
  const $ = (selector) => document.querySelector(selector);
  const params = new URLSearchParams(location.search);
  const partnerId = params.get("partner_id");
  const partner = params.get("source") === "partner" && !!partnerId;
  const state = { session: null, threads: [], rooms: [], documentRequests: [], introRequests: [], active: null, messages: [], seen: new Set(), loaded: false, timer: null };
  const base = () => /^(localhost|127\.0\.0\.1)$/i.test(location.hostname) ? "http://localhost:3000" : String(App.config?.apiBaseUrl || "https://api.allonahub.com").replace(/\/$/, "");
  function status(text) { $("[data-firm-status]").textContent = text || ""; }
  async function api(path, options = {}) {
    const response = await fetch(`${base()}${path}`, { ...options, headers: { Authorization: `Bearer ${state.session.access_token}`, Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok !== true) throw new Error(result.message || "İşlem tamamlanamadı.");
    return result;
  }
  const path = "/v1/maritime/connect-chat/threads";
  const disclosureLabels = { vessel_type: "Gemi tipi", flag_state: "Bayrak", deadweight_tonnage: "DWT", gross_tonnage: "GT", trading_area: "Çalışma bölgesi", joining_port: "Katılım limanı", vessel_name: "Gemi adı", imo_number: "IMO", current_port: "Güncel liman", next_port: "Sonraki liman" };
  async function renderDisclosure() {
    const root = $("[data-firm-disclosure]"); root.replaceChildren();
    if (!state.active) return;
    const threadId = state.active.id;
    const disclosure = await api(path + "/" + encodeURIComponent(threadId) + "/disclosure");
    if (state.active?.id !== threadId) return;
    const details = document.createElement("details"); details.className = "firm-chat-disclosure";
    const summary = document.createElement("summary"); summary.textContent = "Görüşme bilgileri · " + disclosure.company_name;
    details.append(summary);
    const entries = Object.entries(disclosure.fields || {});
    if (partner) {
      const note = document.createElement("p"); note.textContent = "Seçtiğiniz bilgiler yalnız bu adayın özel görüşmesinde görünür. Gemi adı, IMO ve limanlar varsayılan olarak kapalıdır."; details.append(note);
      const form = document.createElement("form"); form.className = "firm-chat-disclosure-fields";
      for (const [key, value] of entries) {
        const label = document.createElement("label");
        const input = document.createElement("input"); input.type = "checkbox"; input.value = key;
        input.checked = (disclosure.visible_fields || []).includes(key);
        label.append(input, document.createTextNode(" " + disclosureLabels[key] + ": " + value)); form.append(label);
      }
      const save = document.createElement("button"); save.type = "submit"; save.textContent = "Paylaşımı Kaydet";
      form.append(save);
      form.addEventListener("submit", async (event) => {
        event.preventDefault(); save.disabled = true;
        try {
          await api(path + "/" + encodeURIComponent(threadId) + "/disclosure", { method: "PUT", body: JSON.stringify({ visible_fields: [...form.querySelectorAll("input:checked")].map((input) => input.value) }) });
          status("Görüşme bilgileri güncellendi.");
        } catch (error) { status(error.message); }
        finally { save.disabled = false; }
      });
      details.append(form);
    } else if (entries.length) {
      const list = document.createElement("dl");
      for (const [key, value] of entries) {
        const term = document.createElement("dt"); term.textContent = disclosureLabels[key];
        const description = document.createElement("dd"); description.textContent = value;
        list.append(term, description);
      }
      details.append(list);
    } else {
      const note = document.createElement("p"); note.textContent = "Şirket henüz bu görüşme için gemi bilgisi paylaşmadı."; details.append(note);
    }
    root.append(details);
  }
  function name(thread) { return partner ? thread.candidate_name : thread.company_name; }
  function renderList() {
    const root = $("[data-firm-list]"); root.replaceChildren();
    if (!partner) for (const intro of state.introRequests) {
      const card = document.createElement("article"); card.className = "firm-chat-intro";
      const heading = document.createElement("strong"); heading.textContent = `${intro.company_name} · ${intro.job_title}`;
      const explanation = document.createElement("p"); explanation.textContent = "Bu şirket görüşme ve CV/belge paylaşımı için davet gönderdi. Onay verirseniz yalnız bu şirket ve ilan için 30 gün süreyle görüşme, CV ve belge erişimi açılır. İş başvurusu yapılmaz; izni geri çekebilirsiniz.";
      const actions = document.createElement("div"); actions.className = "firm-chat-intro-actions";
      for (const [decision, label] of [["accept", "Onaylıyorum"], ["decline", "Reddet"]]) {
        const button = document.createElement("button"); button.type = "button"; button.textContent = label;
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            if (decision === "accept") {
              await api(`/v1/maritime/candidate/intro-requests/${encodeURIComponent(intro.id)}/confirm`, { method: "POST" });
              status("Bu şirkete görüşme ve belge izni verildi. İş başvurusu yapılmadı.");
            } else {
              await api(`/v1/maritime/candidate/intro-requests/${encodeURIComponent(intro.id)}/decline`, { method: "POST" });
              status("Davet reddedildi.");
            }
            await refresh();
          } catch (error) { status(error.message); button.disabled = false; }
        });
        actions.append(button);
      }
      card.append(heading, explanation, actions); root.append(card);
    }
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
    const request = partner ? state.active?.document_permission_status ? { status: state.active.document_permission_status } : null
      : state.documentRequests.find((item) => item.candidate_room_id === state.active?.candidate_room_id);
    if (!state.active || (partner && request?.status === "accepted") || (!partner && !request)) return;
    const card = document.createElement("div"); card.className = "firm-chat-permission";
    const label = document.createElement("p");
    label.textContent = partner ? request?.status === "pending" ? "Adayın belge görüntüleme onayı bekleniyor." : "Adayın CV ve belgelerini değerlendirmek için izin isteyin." : request?.status === "accepted" ? "Belge görüntüleme izni açık. İstediğiniz zaman geri çekebilirsiniz." : request?.status === "declined" || request?.status === "revoked" ? "Bu belge paylaşım izni kapalı." : request?.status === "pending" ? "Bu şirket, başvurunuzdaki CV ve belgeleri işe alım değerlendirmesi için görüntülemek istiyor. Onayınızı daha sonra geri çekebilirsiniz." : "Belge paylaşım talebi bulunmuyor.";
    card.append(label);
    if (partner && !request) {
      const actions = document.createElement("div"); actions.className = "firm-chat-permission-actions";
      const button = document.createElement("button"); button.type = "button"; button.textContent = "CV ve Belge İzni İste";
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await api(`/v1/maritime/partner-center/candidate-rooms/${encodeURIComponent(state.active.candidate_room_id)}/document-request`, { method: "POST", body: JSON.stringify({ partner_id: partnerId }) });
          await refresh(); status("İzin talebi adaya gönderildi.");
        } catch (error) { status(error.message); button.disabled = false; }
      });
      actions.append(button); card.append(actions);
    } else if (!partner && request) {
      const actions = document.createElement("div"); actions.className = "firm-chat-permission-actions";
      const decisions = request.status === "pending" ? [["accepted", "Onaylıyorum"], ["declined", "Reddet"]] : request.status === "accepted" ? [["revoked", "İzni Geri Çek"]] : [["accepted", "Onaylıyorum"]];
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
      await renderDisclosure();
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
    if (partner && state.active) state.active = state.threads.find((item) => item.id === state.active.id) || state.active;
    if (!partner) {
      const permissions = await api("/v1/maritime/candidate/document-requests");
      state.documentRequests = permissions.requests || [];
      const intros = await api("/v1/maritime/candidate/intro-requests");
      state.introRequests = intros.requests || [];
    }
    state.loaded = true;
    if (partner) {
      const eligible = await api(`/v1/maritime/connect-chat/eligible-rooms?partner_id=${encodeURIComponent(partnerId)}`);
      state.rooms = eligible.rooms;
    }
    renderList(); renderDocumentRequest();
    if (state.active) {
      if (!partner) await renderDisclosure();
      const latest = state.threads.find((item) => item.id === state.active.id);
      if (latest && state.messages.length && state.messages.at(-1)?.created_at !== latest.last_message_at) await openThread(latest);
    }
  }
  async function init() {
    state.session = await App.auth?.getSession?.();
    if (!state.session?.access_token) { status("Mesajları görmek için giriş yapın."); return; }
    if (partner) { $("[data-firm-title]").textContent = "Aday Görüşmeleri"; $("[data-firm-intro]").textContent = "Yalnızca onaylı başvurularınıza ait görüşmeler."; }
    if (!partner) {
      const wrap = $("[data-firm-discovery-wrap]"); const input = $("[data-firm-discovery]");
      const discovery = await api("/v1/maritime/candidate/discovery");
      input.checked = discovery.visible === true; wrap.hidden = false;
      input.addEventListener("change", async () => {
        input.disabled = true;
        try { await api("/v1/maritime/candidate/discovery", { method: "PUT", body: JSON.stringify({ visible: input.checked }) });
          status(input.checked ? "Sınırlı profil görünürlüğü açıldı." : "Sınırlı profil görünürlüğü kapatıldı."); }
        catch (error) { input.checked = !input.checked; status(error.message); }
        finally { input.disabled = false; }
      });
    }
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
