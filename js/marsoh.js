(function () {
  "use strict";

  const App = window.Allona = window.Allona || {};
  const I18n = window.MarSohI18n;
  const DB_NAME = "allonahub-marsoh";
  const STORE_NAME = "outbox";
  const ALLOWED_REACTIONS = ["👍", "❤️", "👏", "⚓", "🌊", "💪", "🙏", "🫡", "🚢", "🧭", "✨", "😊"];
  const COMPOSER_EMOJIS = [
    "😀", "😄", "😊", "🙂", "😉", "😍", "🤝", "🫡", "👍", "👎", "👏", "🙏",
    "💪", "❤️", "💙", "✨", "🎉", "✅", "⚠️", "💡", "🔥", "🌍", "🌊", "⚓",
    "🚢", "⛴️", "🛳️", "🛟", "🧭", "⛵", "🌅", "🌙", "☀️", "🌧️", "🌬️", "📡",
    "🛠️", "⚙️", "🦺", "👨‍✈️", "👩‍✈️", "🧑‍🔧", "📝", "📌", "❓", "❗", "💬", "🙌"
  ];
  const LANGUAGE_LABELS = {
    tr: "Türkçe", az: "Azərbaycanca", en: "English", de: "Deutsch", ru: "Русский",
    ar: "العربية", kk: "Қазақша", uz: "O‘zbekcha", ky: "Кыргызча"
  };
  const LOCALE_TAGS = {
    tr: "tr-TR", az: "az-AZ", en: "en-US", de: "de-DE", ru: "ru-RU",
    ar: "ar-SA", kk: "kk-KZ", uz: "uz-UZ", ky: "ky-KG"
  };
  const state = {
    session: null,
    locale: I18n.current(),
    bootstrap: null,
    currentChannel: null,
    messages: [],
    cursor: null,
    realtime: null,
    blocked: new Set(),
    speech: null,
    speechBase: "",
    outboxDb: null,
    modalTrigger: null,
    connectionState: "connecting",
    autoTranslate: localStorage.getItem("allona.marsoh.autoTranslate") !== "off",
    autoTranslationCount: 0,
    autoTranslationWindowStarted: 0
  };

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => [...(root || document).querySelectorAll(selector)];
  const t = (key) => I18n.t(key, state.locale);
  function uuid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  }
  const apiBase = () => String(App.config?.apiBaseUrl || "https://api.allonahub.com").replace(/\/$/, "");

  function setStatus(message) { const target = $("[data-marsoh-status]"); if (target) target.textContent = message || ""; }
  function setConnectionStatus(status) {
    state.connectionState = ["live", "offline", "connecting"].includes(status) ? status : "connecting";
    const target = $("[data-marsoh-connection]");
    if (!target) return;
    target.dataset.state = state.connectionState;
    const label = $("span", target);
    if (label) label.textContent = t(state.connectionState);
  }
  function composerLimit() { return Math.max(1, Number(state.bootstrap?.policy?.max_message_chars) || 2000); }
  function updateComposerMeta() {
    const input = $("[data-marsoh-input]");
    const counter = $("[data-marsoh-character-count]");
    if (!input || !counter) return;
    const limit = composerLimit();
    input.maxLength = limit;
    counter.textContent = `${input.value.length} / ${limit} ${t("characters")}`;
    counter.classList.toggle("is-near-limit", input.value.length >= limit * 0.9);
  }
  function nearBottom() { const target = $("[data-marsoh-messages]"); return target ? target.scrollHeight - target.scrollTop - target.clientHeight < 90 : true; }
  function scrollLatest(smooth) { const target = $("[data-marsoh-messages]"); if (target) target.scrollTo({ top: target.scrollHeight, behavior: smooth ? "smooth" : "auto" }); }

  async function api(path, options) {
    if (!state.session?.access_token) throw Object.assign(new Error("AUTH_REQUIRED"), { code: "AUTH_REQUIRED" });
    let response;
    try {
      response = await fetch(`${apiBase()}${path}`, {
        ...options,
        headers: { Accept: "application/json", Authorization: `Bearer ${state.session.access_token}`, ...(options?.body ? { "Content-Type": "application/json" } : {}), ...(options?.headers || {}) }
      });
    } catch (error) {
      error.code = "NETWORK_ERROR";
      throw error;
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok !== true) {
      const error = new Error(payload.message || "REQUEST_FAILED");
      error.code = payload.error || payload.code || "REQUEST_FAILED";
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function openOutbox() {
    if (!window.indexedDB) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE_NAME, { keyPath: "idempotency_key" });
        store.createIndex("channel_id", "channel_id", { unique: false });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function outboxTransaction(mode, handler) {
    if (!state.outboxDb) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const tx = state.outboxDb.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      const request = handler(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  const putOutbox = (item) => outboxTransaction("readwrite", (store) => store.put(item));
  const deleteOutbox = (key) => outboxTransaction("readwrite", (store) => store.delete(key));
  const getOutbox = (key) => outboxTransaction("readonly", (store) => store.get(key));
  const allOutbox = () => outboxTransaction("readonly", (store) => store.getAll()).then((rows) => rows || []);

  function loginGate(show, message) {
    const gate = $("[data-marsoh-auth-gate]");
    const conversation = $("[data-marsoh-conversation]");
    const channels = $("[data-marsoh-channels-panel]");
    const info = $("[data-marsoh-info]");
    if (gate) gate.hidden = !show;
    if (conversation) conversation.hidden = show;
    if (channels) channels.hidden = show;
    if (info) info.hidden = show;
    if (show && message) $("[data-marsoh-copy='loginRequired']").textContent = message;
    const link = $("[data-marsoh-login]");
    if (link) link.href = `../account/user.html?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  }

  function localizeChannel(channel) {
    if (channel.channel_type === "world") return t("worldRoom");
    if (channel.country_code && window.Intl?.DisplayNames) {
      const locale = LOCALE_TAGS[state.locale] || "tr-TR";
      const country = new Intl.DisplayNames([locale], { type: "region" }).of(channel.country_code);
      if (country) return t("countryRoom").replace("{country}", country);
    }
    return I18n.localized(channel.name_i18n, state.locale) || channel.slug;
  }
  function localizePinned(channel) { return I18n.localized(channel.pinned_notice_i18n, state.locale) || t("defaultPinned"); }

  function renderChannels() {
    const target = $("[data-marsoh-channel-list]");
    if (!target) return;
    target.replaceChildren();
    let total = 0;
    for (const channel of state.bootstrap?.channels || []) {
      total += Number(channel.unread_count || 0);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `marsoh-channel-button${state.currentChannel?.id === channel.id ? " is-active" : ""}`;
      button.dataset.channelId = channel.id;
      button.setAttribute("aria-pressed", state.currentChannel?.id === channel.id ? "true" : "false");
      const avatar = document.createElement("span"); avatar.className = "marsoh-channel-avatar"; avatar.textContent = channel.channel_type === "world" ? "◎" : channel.country_code;
      const copy = document.createElement("span");
      const strong = document.createElement("strong"); strong.textContent = localizeChannel(channel);
      const small = document.createElement("small"); small.textContent = channel.channel_type === "world" ? t("tagline") : t("memberRoom");
      copy.append(strong, small); button.append(avatar, copy);
      if (channel.unread_count) { const badge = document.createElement("span"); badge.className = "marsoh-channel-unread"; badge.textContent = channel.unread_count > 99 ? "99+" : channel.unread_count; button.append(badge); }
      button.addEventListener("click", () => openChannel(channel)); target.append(button);
    }
    const badge = $("[data-marsoh-total-unread]");
    if (badge) { badge.hidden = !total; badge.textContent = total > 99 ? "99+" : String(total); }
  }

  function dateKey(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(LOCALE_TAGS[state.locale] || "tr-TR", { day: "numeric", month: "long", year: "numeric" }); }
  function timeLabel(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString(LOCALE_TAGS[state.locale] || "tr-TR", { hour: "2-digit", minute: "2-digit" }); }

  function statusLabel(message) {
    if (!message.own) return "";
    if (message.local_status === "sending") return t("sending");
    if (message.local_status === "failed") return message.error_message || t("failed");
    return t("sent");
  }

  function reserveAutomaticTranslation() {
    const now = Date.now();
    if (!state.autoTranslationWindowStarted || now - state.autoTranslationWindowStarted >= 60000) {
      state.autoTranslationWindowStarted = now;
      state.autoTranslationCount = 0;
    }
    if (state.autoTranslationCount >= 8) return false;
    state.autoTranslationCount += 1;
    return true;
  }

  async function translateMessage(article, message, language, button, chooser, options) {
    message.translationPending = message.translationPending || new Set();
    if (message.translationPending.has(language)) return;
    message.translationPending.add(language);
    const languageButtons = chooser.querySelectorAll("button");
    languageButtons.forEach((item) => { item.disabled = true; });
    button.disabled = true;
    button.textContent = t("translating");
    const oldBox = $(".marsoh-translation", article);
    if (oldBox) oldBox.remove();
    try {
      message.translations = message.translations || {};
      let translated = message.translations[language];
      if (!translated) {
        const payload = await api(`/v1/maritime/marsoh/messages/${encodeURIComponent(message.id)}/translate`, {
          method: "POST",
          body: JSON.stringify({ target_language: language })
        });
        translated = payload.translated_text;
        message.translations[language] = translated;
      }
      const box = document.createElement("div");
      box.className = "marsoh-translation";
      box.lang = language;
      box.dir = language === "ar" ? "rtl" : "auto";
      const text = document.createElement("span");
      text.textContent = translated;
      const label = document.createElement("small");
      label.textContent = `${t("automaticTranslation")} · ${LANGUAGE_LABELS[language] || language.toUpperCase()}`;
      box.append(text, label);
      chooser.after(box);
      chooser.hidden = true;
      button.textContent = t("showOriginal");
      button.setAttribute("aria-expanded", "true");
    } catch {
      if (!options?.silentFailure) {
        const box = document.createElement("div");
        box.className = "marsoh-translation is-error";
        box.textContent = t("translationUnavailable");
        chooser.after(box);
      }
      chooser.hidden = true;
      button.textContent = t("translate");
      button.setAttribute("aria-expanded", "false");
    } finally {
      message.translationPending.delete(language);
      languageButtons.forEach((item) => { item.disabled = false; });
      button.disabled = false;
    }
  }

  function addTranslationControls(article, message) {
    if (message.own || !message.id || message.local_status) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "marsoh-translate";
    button.textContent = t("translate");
    button.setAttribute("aria-expanded", "false");

    const chooser = document.createElement("div");
    chooser.className = "marsoh-translation-chooser";
    chooser.hidden = true;
    chooser.setAttribute("role", "group");
    chooser.setAttribute("aria-label", t("translateTo"));
    const chooserLabel = document.createElement("strong");
    chooserLabel.textContent = t("translateTo");
    chooser.append(chooserLabel);

    const options = document.createElement("div");
    options.className = "marsoh-translation-languages";
    for (const language of I18n.SUPPORTED || ["tr", "az", "en"]) {
      const languageButton = document.createElement("button");
      languageButton.type = "button";
      languageButton.lang = language;
      languageButton.textContent = LANGUAGE_LABELS[language] || language.toUpperCase();
      languageButton.classList.toggle("is-preferred", language === state.locale);
      languageButton.addEventListener("click", () => translateMessage(article, message, language, button, chooser));
      options.append(languageButton);
    }
    chooser.append(options);
    button.addEventListener("click", () => {
      const existing = $(".marsoh-translation", article);
      if (existing && !existing.hidden) {
        existing.hidden = true;
        chooser.hidden = false;
        button.textContent = t("translate");
        button.setAttribute("aria-expanded", "true");
        return;
      }
      if (existing?.hidden) {
        existing.remove();
        chooser.hidden = false;
        button.textContent = t("translate");
        button.setAttribute("aria-expanded", "true");
        return;
      }
      chooser.hidden = !chooser.hidden;
      button.setAttribute("aria-expanded", String(!chooser.hidden));
    });
    article.append(button, chooser);
    const sourceLanguage = String(message.language || "").toLowerCase();
    if (state.autoTranslate && sourceLanguage && sourceLanguage !== "und" && sourceLanguage !== state.locale && reserveAutomaticTranslation()) {
      queueMicrotask(() => translateMessage(article, message, state.locale, button, chooser, { silentFailure: true }));
    }
  }

  async function toggleReaction(message, emoji, trigger) {
    if (trigger) trigger.disabled = true;
    try {
      const payload = await api(`/v1/maritime/marsoh/messages/${encodeURIComponent(message.id)}/reactions`, {
        method: "POST",
        body: JSON.stringify({ emoji })
      });
      const others = (message.reactions || []).filter((item) => item.emoji !== emoji);
      message.reactions = payload.count ? [...others, { emoji, count: payload.count, mine: payload.active }] : others;
      renderMessages({ preserveBottom: nearBottom() });
    } catch (error) {
      setStatus(error.message || t("failed"));
      if (trigger) trigger.disabled = false;
    }
  }

  function addReactions(article, bubble, message) {
    if (message.own || !message.id || message.local_status) return;
    const reactionState = new Map((message.reactions || []).map((item) => [item.emoji, item]));
    const bar = document.createElement("div"); bar.className = "marsoh-reactions";
    for (const [emoji, current] of reactionState) {
      if (!current.count) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${emoji} ${current.count}`;
      button.title = t("chooseReaction");
      button.setAttribute("aria-label", `${t("chooseReaction")}: ${emoji}, ${current.count}`);
      button.classList.toggle("is-active", current.mine === true);
      button.addEventListener("click", (event) => { event.stopPropagation(); toggleReaction(message, emoji, button); });
      bar.append(button);
    }
    if (bar.childElementCount) article.append(bar);

    const tray = document.createElement("div");
    tray.className = "marsoh-quick-reactions";
    tray.hidden = true;
    tray.setAttribute("role", "toolbar");
    tray.setAttribute("aria-label", t("reactions"));
    for (const emoji of ALLOWED_REACTIONS) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = emoji;
      button.title = t("chooseReaction");
      button.setAttribute("aria-label", `${t("chooseReaction")}: ${emoji}`);
      button.classList.toggle("is-active", reactionState.get(emoji)?.mine === true);
      button.addEventListener("click", (event) => { event.stopPropagation(); toggleReaction(message, emoji, button); });
      tray.append(button);
    }
    article.append(tray);

    const openTray = (event) => {
      if (event.target.closest("button") || window.getSelection()?.toString()) return;
      $$(".marsoh-quick-reactions").forEach((item) => {
        if (item !== tray) { item.hidden = true; item.closest(".marsoh-message")?.classList.remove("has-open-reactions"); }
      });
      tray.hidden = !tray.hidden;
      article.classList.toggle("has-open-reactions", !tray.hidden);
      if (!tray.hidden) $("button", tray)?.focus({ preventScroll: true });
    };
    bubble.tabIndex = 0;
    bubble.setAttribute("role", "button");
    bubble.setAttribute("aria-label", `${message.body}. ${t("tapForReaction")}`);
    bubble.addEventListener("click", openTray);
    bubble.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openTray(event); }
    });
  }

  function renderMessages(options) {
    const target = $("[data-marsoh-messages]");
    if (!target) return;
    const preserveBottom = options?.preserveBottom ?? nearBottom();
    target.replaceChildren();
    const sorted = [...state.messages].sort((a, b) => new Date(a.time || a.created_at) - new Date(b.time || b.created_at));
    if (!sorted.length) {
      const empty = document.createElement("div"); empty.className = "marsoh-empty";
      const strong = document.createElement("strong"); strong.textContent = t("emptyTitle");
      const span = document.createElement("span"); span.textContent = t("emptyBody"); empty.append(strong, span); target.append(empty); return;
    }
    let lastDate = "";
    for (const message of sorted) {
      const currentDate = dateKey(message.time || message.created_at);
      if (currentDate && currentDate !== lastDate) { const divider = document.createElement("div"); divider.className = "marsoh-date-divider"; divider.textContent = currentDate; target.append(divider); lastDate = currentDate; }
      const article = document.createElement("article");
      article.className = `marsoh-message${message.own ? " is-own" : ""}${message.local_status === "failed" ? " is-failed" : ""}`;
      article.dataset.messageId = message.id || message.idempotency_key;
      const head = document.createElement("div"); head.className = "marsoh-message-head";
      const name = document.createElement("strong"); name.textContent = message.sender?.display_name || state.bootstrap?.user?.display_name || "Denizci"; head.append(name);
      if (message.sender?.badge) { const badge = document.createElement("span"); badge.className = "marsoh-verified"; badge.textContent = message.sender.badge === "verified_company" ? "◆" : "✓"; badge.title = message.sender.badge === "verified_company" ? t("verifiedCompany") : t("verifiedSeafarer"); head.append(badge); }
      if (message.sender?.country_code) { const country = document.createElement("span"); country.className = "marsoh-country"; country.textContent = message.sender.country_code; head.append(country); }
      if (message.language && message.language !== "und" && message.language.toUpperCase() !== message.sender?.country_code) { const language = document.createElement("span"); language.className = "marsoh-message-language"; language.textContent = message.language.toUpperCase(); head.append(language); }
      const time = document.createElement("time"); time.dateTime = message.time || message.created_at || ""; time.textContent = timeLabel(time.dateTime); head.append(time); article.append(head);
      const bubble = document.createElement("div"); bubble.className = "marsoh-bubble";
      const body = document.createElement("span"); body.textContent = message.body; bubble.append(body);
      if (!message.own || message.local_status === "failed") { const menu = document.createElement("button"); menu.type = "button"; menu.className = "marsoh-message-menu"; menu.textContent = "⋯"; menu.setAttribute("aria-label", t("actionTitle")); menu.addEventListener("click", (event) => { event.stopPropagation(); openMessageActions(message); }); bubble.append(menu); }
      article.append(bubble);
      if (message.own) { const status = document.createElement("button"); status.type = "button"; status.className = `marsoh-message-status${message.local_status === "failed" ? " is-error" : ""}`; status.textContent = `${message.local_status === "failed" ? "! " : ""}${statusLabel(message)}`; if (message.local_status === "failed") status.addEventListener("click", () => openFailedActions(message)); article.append(status); }
      addTranslationControls(article, message); addReactions(article, bubble, message); target.append(article);
    }
    const count = $("[data-marsoh-room-count]");
    if (count) count.textContent = `${sorted.length} ${t("messages")}`;
    if (preserveBottom) requestAnimationFrame(() => scrollLatest(false));
  }

  function messageKey(message) { return message.id || message.idempotency_key; }
  function upsertMessage(message) {
    const key = messageKey(message);
    const index = state.messages.findIndex((item) => messageKey(item) === key || (message.id && (item.server_id === message.id || item.id === message.id)) || (message.idempotency_key && item.idempotency_key === message.idempotency_key));
    if (index >= 0) state.messages[index] = { ...state.messages[index], ...message };
    else state.messages.push(message);
  }

  async function loadOutboxForChannel(channelId) {
    const rows = (await allOutbox()).filter((item) => item.channel_id === channelId);
    for (const item of rows) upsertMessage({ ...item, own: true, time: item.created_at, sender: state.bootstrap.user });
  }

  async function loadMessages(before) {
    const channel = state.currentChannel;
    if (!channel) return;
    const target = $("[data-marsoh-messages]");
    const previousHeight = target?.scrollHeight || 0;
    const suffix = before ? `&before=${encodeURIComponent(before)}` : "";
    const payload = await api(`/v1/maritime/marsoh/channels/${encodeURIComponent(channel.id)}/messages?limit=50${suffix}`);
    if (state.currentChannel?.id !== channel.id) return;
    for (const message of payload.messages || []) upsertMessage(message);
    state.cursor = payload.next_cursor || null;
    const load = $("[data-marsoh-load-history]"); if (load) load.hidden = !state.cursor;
    renderMessages({ preserveBottom: !before });
    if (before && target) target.scrollTop = target.scrollHeight - previousHeight;
  }

  function stopRealtime() {
    if (state.realtime && App.supabase) App.supabase.removeChannel(state.realtime);
    state.realtime = null;
  }
  function subscribe(channelId) {
    stopRealtime();
    if (!navigator.onLine) { setConnectionStatus("offline"); return; }
    if (!App.supabase?.channel) { setConnectionStatus("connecting"); return; }
    setConnectionStatus("connecting");
    state.realtime = App.supabase.channel(`marsoh:${channelId}:${state.bootstrap.user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "marsoh_published_messages", filter: `channel_id=eq.${channelId}` }, (payload) => {
        const row = payload.new || {};
        if (state.currentChannel?.id !== channelId || state.blocked.has(row.sender_user_id)) return;
        const wasNearBottom = nearBottom();
        const own = row.sender_user_id === state.bootstrap.user.id;
        upsertMessage({ id: row.message_id, server_id: row.message_id, channel_id: row.channel_id, sender: { id: row.sender_user_id, display_name: row.sender_display_name, badge: row.sender_badge, country_code: row.sender_country_code, actor_type: row.actor_type }, body: row.body, language: row.language, time: row.published_at, own, local_status: own ? "sent" : undefined });
        renderMessages({ preserveBottom: wasNearBottom });
        if (!wasNearBottom) { $("[data-marsoh-unread-line]").hidden = false; $("[data-marsoh-jump-latest]").hidden = false; }
      }).subscribe((status) => {
        if (status === "SUBSCRIBED") setConnectionStatus("live");
        else if (!navigator.onLine) setConnectionStatus("offline");
        else setConnectionStatus("connecting");
      });
  }

  async function openChannel(channel) {
    state.currentChannel = channel;
    state.messages = []; state.cursor = null; state.autoTranslationCount = 0; state.autoTranslationWindowStarted = Date.now(); renderChannels();
    $("[data-marsoh-channels-panel]")?.classList.remove("is-open");
    $("[data-marsoh-room-title]").textContent = localizeChannel(channel);
    $("[data-marsoh-room-subtitle]").textContent = t("memberRoom");
    $("[data-marsoh-pinned] p").textContent = localizePinned(channel);
    const preference = $("[data-marsoh-notification]"); if (preference) preference.value = channel.notification_preference || "all";
    const target = $("[data-marsoh-messages]"); if (target) target.innerHTML = '<div class="marsoh-message-skeleton"></div><div class="marsoh-message-skeleton"></div>';
    await loadOutboxForChannel(channel.id);
    try { await loadMessages(null); await api(`/v1/maritime/marsoh/channels/${encodeURIComponent(channel.id)}/read`, { method: "POST" }); channel.unread_count = 0; renderChannels(); }
    catch (error) { setStatus(error.message || t("loadFailed")); renderMessages(); }
    subscribe(channel.id);
  }

  function policyError(error) { return ["CONTACT_EMAIL", "CONTACT_PHONE", "CONTACT_URL", "CONTACT_SOCIAL", "ABUSE_PROFANITY_THREAT", "ABUSE_HARASSMENT"].includes(error?.code); }
  function policyMessage(error) { return String(error?.code || "").startsWith("CONTACT_") ? t("contactFailed") : t("communityFailed"); }

  async function transmit(item) {
    item.local_status = "sending"; item.error_message = ""; await putOutbox(item); upsertMessage({ ...item, own: true, sender: state.bootstrap.user, time: item.created_at }); renderMessages({ preserveBottom: true });
    if (!navigator.onLine) return;
    try {
      const payload = await api("/v1/maritime/marsoh/messages", { method: "POST", body: JSON.stringify({ channel_id: item.channel_id, idempotency_key: item.idempotency_key, body: item.body, language: item.language }) });
      await deleteOutbox(item.idempotency_key);
      const accepted = { ...payload.message, idempotency_key: item.idempotency_key, server_id: payload.message.id, local_status: "sent", own: true };
      state.messages = state.messages.filter((message) => message.idempotency_key !== item.idempotency_key && message.id !== payload.message.id && message.server_id !== payload.message.id);
      state.messages.push(accepted);
      renderMessages({ preserveBottom: true });
    } catch (error) {
      item.local_status = "failed";
      item.failure_type = policyError(error) ? "policy" : "network";
      item.error_message = policyError(error) ? policyMessage(error) : (error.code === "NETWORK_ERROR" ? t("networkFailed") : error.message || t("failed"));
      await putOutbox(item); upsertMessage({ ...item, own: true, sender: state.bootstrap.user, time: item.created_at }); renderMessages({ preserveBottom: true });
    }
  }

  async function queueMessage(body) {
    const item = { idempotency_key: uuid(), channel_id: state.currentChannel.id, body, language: state.locale, local_status: "sending", created_at: new Date().toISOString(), failure_type: "", error_message: "" };
    await putOutbox(item); await transmit(item);
  }

  async function flushOutbox() {
    if (!navigator.onLine || !state.bootstrap) return;
    for (const item of await allOutbox()) if (item.local_status !== "failed" || item.failure_type === "network") await transmit(item);
  }

  function closeModal() {
    const modal = $("[data-marsoh-action-modal]");
    if (modal) modal.hidden = true;
    if (state.modalTrigger?.focus) state.modalTrigger.focus();
    state.modalTrigger = null;
  }
  function showActions(title, actions) {
    const modal = $("[data-marsoh-action-modal]"); const target = $("[data-marsoh-action-list]");
    state.modalTrigger = document.activeElement;
    $("[data-marsoh-action-title]").textContent = title; target.replaceChildren();
    for (const action of actions) { const button = document.createElement("button"); button.type = "button"; button.textContent = action.label; if (action.danger) button.className = "is-danger"; button.addEventListener("click", async () => { closeModal(); await action.run(); }); target.append(button); }
    modal.hidden = false;
    target.querySelector("button")?.focus();
  }

  function openFailedActions(message) {
    const actions = [
      { label: t("remove"), danger: true, run: async () => { await deleteOutbox(message.idempotency_key); state.messages = state.messages.filter((item) => item.idempotency_key !== message.idempotency_key); renderMessages(); } }
    ];
    if (message.failure_type === "policy") actions.unshift({ label: t("edit"), run: async () => { const input = $("[data-marsoh-input]"); input.value = message.body; input.focus(); await deleteOutbox(message.idempotency_key); state.messages = state.messages.filter((item) => item.idempotency_key !== message.idempotency_key); renderMessages(); resizeInput(); } });
    else actions.unshift({ label: t("retry"), run: async () => { const item = await getOutbox(message.idempotency_key); if (item) await transmit(item); } });
    showActions(t("actionTitle"), actions);
  }

  function openMessageActions(message) {
    if (message.local_status === "failed") return openFailedActions(message);
    if (message.own) return;
    showActions(t("actionTitle"), [
      { label: t("report"), run: () => openReport(message) },
      { label: t("block"), danger: true, run: async () => { await api("/v1/maritime/marsoh/blocks", { method: "POST", body: JSON.stringify({ blocked_user_id: message.sender.id }) }); state.blocked.add(message.sender.id); state.messages = state.messages.filter((item) => item.sender?.id !== message.sender.id); renderMessages(); setStatus(t("blocked")); } }
    ]);
  }

  function openReport(message) {
    const reasons = [["spam", "reasonSpam"], ["harassment", "reasonHarassment"], ["fraud", "reasonFraud"], ["recruitment", "reasonRecruitment"], ["contact_sharing", "reasonContact"], ["other", "reasonOther"]];
    showActions(t("reportReason"), reasons.map(([reason, label]) => ({ label: t(label), run: async () => { await api(`/v1/maritime/marsoh/messages/${encodeURIComponent(message.id)}/report`, { method: "POST", body: JSON.stringify({ reason_code: reason }) }); setStatus(t("reportSaved")); } })));
  }

  function resizeInput() {
    const input = $("[data-marsoh-input]");
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
    updateComposerMeta();
  }

  function renderComposerEmojis() {
    const grid = $("[data-marsoh-emoji-grid]");
    if (!grid) return;
    grid.replaceChildren();
    for (const emoji of COMPOSER_EMOJIS) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = emoji;
      button.setAttribute("aria-label", `${t("chooseEmoji")}: ${emoji}`);
      button.addEventListener("click", () => {
        const input = $("[data-marsoh-input]");
        if (!input || input.value.length + emoji.length > composerLimit()) return;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? start;
        input.setRangeText(emoji, start, end, "end");
        input.focus();
        resizeInput();
      });
      grid.append(button);
    }
  }

  function setupSpeech() {
    const button = $("[data-marsoh-mic]");
    if (!button || !window.MarSohSpeech?.BrowserSpeechToTextProvider) return;
    state.speech = new window.MarSohSpeech.BrowserSpeechToTextProvider({
      onStart() {
        state.speechBase = $("[data-marsoh-input]").value.trim();
        button.classList.add("is-listening");
        button.setAttribute("aria-pressed", "true");
        button.setAttribute("aria-label", t("stopListening"));
        $("[data-marsoh-listening]").hidden = false;
      },
      onListening() { setStatus(""); },
      onText({ combinedText }) {
        const input = $("[data-marsoh-input]");
        const combined = [state.speechBase, combinedText].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
        input.value = combined.slice(0, composerLimit());
        resizeInput();
      },
      onError(code, detail) {
        const message = code === "SPEECH_PERMISSION_DENIED" ? t("micDenied") : code === "SPEECH_TIMEOUT" ? t("micTimeout") : t("micError");
        setStatus(message);
        if (detail?.recoverable === false) state.speech?.stop();
      },
      onEnd() {
        button.classList.remove("is-listening");
        button.setAttribute("aria-pressed", "false");
        button.setAttribute("aria-label", t("voiceTyping"));
        $("[data-marsoh-listening]").hidden = true;
      }
    });
    const supported = state.speech.supported();
    button.hidden = !supported;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      if (state.speech.active) state.speech.stop();
      else {
        setStatus("");
        try { state.speech.start(state.locale); }
        catch { setStatus(supported ? t("micError") : t("micUnsupported")); }
      }
    });
    $("[data-marsoh-stop-listening]")?.addEventListener("click", () => state.speech?.stop());
  }

  function renderTopic() {
    const topic = state.bootstrap?.topic; const target = $("[data-marsoh-topic]"); if (!target || !topic) return;
    target.hidden = false; $("h2", target).textContent = I18n.localized(topic.title_i18n, state.locale) || t("todayTopic"); $("p", target).textContent = I18n.localized(topic.body_i18n, state.locale);
  }

  function bind() {
    $("[data-marsoh-back]")?.addEventListener("click", () => { if (document.referrer && new URL(document.referrer).origin === window.location.origin) history.back(); else window.location.href = "allonadenizcilik.html"; });
    $("[data-marsoh-open-channels]")?.addEventListener("click", () => $("[data-marsoh-channels-panel]")?.classList.add("is-open"));
    $("[data-marsoh-close-channels]")?.addEventListener("click", () => $("[data-marsoh-channels-panel]")?.classList.remove("is-open"));
    $("[data-marsoh-open-info]")?.addEventListener("click", () => $("[data-marsoh-info]")?.classList.add("is-open"));
    $("[data-marsoh-close-info]")?.addEventListener("click", () => $("[data-marsoh-info]")?.classList.remove("is-open"));
    $("[data-marsoh-modal-close]")?.addEventListener("click", closeModal);
    $("[data-marsoh-action-modal]")?.addEventListener("click", (event) => { if (event.target === event.currentTarget) closeModal(); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !$('[data-marsoh-action-modal]')?.hidden) closeModal(); });
    $("[data-marsoh-language]")?.addEventListener("change", (event) => {
      state.locale = I18n.normalize(event.target.value);
      localStorage.setItem("allona.language", state.locale);
      I18n.apply(state.locale);
      state.speech?.setLanguage(state.locale);
      renderComposerEmojis(); renderChannels(); renderTopic(); renderMessages(); updateComposerMeta(); setConnectionStatus(state.connectionState);
      if (state.currentChannel) { $("[data-marsoh-room-title]").textContent = localizeChannel(state.currentChannel); $("[data-marsoh-pinned] p").textContent = localizePinned(state.currentChannel); }
      $("[data-marsoh-policy-note]").textContent = t("sentNotice");
    });
    const autoTranslate = $("[data-marsoh-auto-translate]");
    if (autoTranslate) {
      autoTranslate.checked = state.autoTranslate;
      autoTranslate.addEventListener("change", () => {
        state.autoTranslate = autoTranslate.checked;
        localStorage.setItem("allona.marsoh.autoTranslate", state.autoTranslate ? "on" : "off");
        state.autoTranslationCount = 0;
        state.autoTranslationWindowStarted = Date.now();
        renderMessages({ preserveBottom: nearBottom() });
      });
    }
    $("[data-marsoh-composer]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = $("[data-marsoh-input]");
      const body = input.value.trim();
      if (!body || !state.currentChannel) return;
      if (state.speech?.active) state.speech.stop();
      input.value = "";
      resizeInput();
      await queueMessage(body);
    });
    $("[data-marsoh-input]")?.addEventListener("input", resizeInput);
    $("[data-marsoh-input]")?.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); $("[data-marsoh-composer]").requestSubmit(); } });
    $("[data-marsoh-emoji]")?.addEventListener("click", (event) => { event.stopPropagation(); const panel = $("[data-marsoh-emoji-panel]"); panel.hidden = !panel.hidden; });
    $("[data-marsoh-emoji-close]")?.addEventListener("click", () => { $("[data-marsoh-emoji-panel]").hidden = true; $("[data-marsoh-emoji]")?.focus(); });
    $("[data-marsoh-load-history]")?.addEventListener("click", () => state.cursor && loadMessages(state.cursor));
    $("[data-marsoh-jump-latest]")?.addEventListener("click", () => { scrollLatest(true); $("[data-marsoh-jump-latest]").hidden = true; $("[data-marsoh-unread-line]").hidden = true; });
    $("[data-marsoh-messages]")?.addEventListener("scroll", () => { if (nearBottom()) { $("[data-marsoh-jump-latest]").hidden = true; $("[data-marsoh-unread-line]").hidden = true; } });
    $("[data-marsoh-notification]")?.addEventListener("change", async (event) => { if (!state.currentChannel) return; try { await api(`/v1/maritime/marsoh/channels/${encodeURIComponent(state.currentChannel.id)}/notification-preference`, { method: "PATCH", body: JSON.stringify({ preference: event.target.value }) }); state.currentChannel.notification_preference = event.target.value; } catch (error) { setStatus(error.message); } });
    document.addEventListener("click", (event) => {
      if (!event.target.closest("[data-marsoh-emoji-panel], [data-marsoh-emoji]")) $("[data-marsoh-emoji-panel]").hidden = true;
      if (!event.target.closest(".marsoh-message")) $$(".marsoh-quick-reactions").forEach((item) => { item.hidden = true; item.closest(".marsoh-message")?.classList.remove("has-open-reactions"); });
    });
    window.addEventListener("online", async () => { setConnectionStatus("connecting"); if (state.currentChannel) subscribe(state.currentChannel.id); await flushOutbox(); });
    window.addEventListener("offline", () => setConnectionStatus("offline"));
    window.addEventListener("beforeunload", () => { stopRealtime(); state.speech?.stop(); });
  }

  async function init() {
    if (!document.querySelector("[data-page='marsoh']")) return;
    state.locale = I18n.apply(state.locale); renderComposerEmojis(); bind(); setupSpeech(); updateComposerMeta();
    try { state.outboxDb = await openOutbox(); } catch { state.outboxDb = null; }
    state.session = App.auth?.getSession ? await App.auth.getSession() : null;
    if (!state.session?.access_token) { loginGate(true); $("[data-marsoh-shell]").setAttribute("aria-busy", "false"); return; }
    try {
      const payload = await api(`/v1/maritime/marsoh/bootstrap?language=${encodeURIComponent(state.locale)}`);
      state.bootstrap = payload; state.blocked = new Set(payload.blocked_user_ids || []); loginGate(false); updateComposerMeta();
      $("[data-marsoh-policy-note]").textContent = t("sentNotice");
      renderChannels(); renderTopic();
      const first = payload.channels?.find((channel) => channel.slug === "world") || payload.channels?.[0];
      if (first) await openChannel(first);
      await flushOutbox();
    } catch (error) { loginGate(true, error.message || t("loadFailed")); }
    $("[data-marsoh-shell]").setAttribute("aria-busy", "false");
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
