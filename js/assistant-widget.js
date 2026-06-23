(function () {
  const App = window.Allona = window.Allona || {};
  const SCRIPT = document.currentScript;
  const VERSION = "20260621";
  const STORAGE_KEY = "allonahub_assistant_conversation_id";
  const RATE_KEY = "allonahub_assistant_rate";
  const CHANNELS = ["webchat", "telegram", "partner_panel", "admin_panel", "whatsapp", "instagram"];
  const CONTACT_CHANNELS = {
    whatsapp: `https://wa.me/905427781868?text=${encodeURIComponent("Merhaba AllonaHub, destek almak istiyorum.")}`,
    telegram: "https://t.me/allonahub"
  };

  function escapeHTML(value) {
    if (App.core && App.core.escapeHTML) return App.core.escapeHTML(value);
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeText(value, max) {
    return String(value ?? "")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max || 1600);
  }

  function safeActionUrl(value) {
    try {
      const url = new URL(String(value || ""), window.location.href);
      return /^https?:$/i.test(url.protocol) ? url.href : "";
    } catch (error) {
      return "";
    }
  }

  function apiBaseUrl() {
    const configured = String(App.config && App.config.apiBaseUrl || "").replace(/\/$/, "");
    if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) return "http://localhost:3000";
    return configured || "https://api.allonahub.com";
  }

  function configuredChannel(options) {
    const raw = String(
      options && options.channel ||
      SCRIPT && SCRIPT.dataset.channel ||
      document.body && document.body.dataset.assistantChannel ||
      "webchat"
    ).toLowerCase();
    return CHANNELS.includes(raw) ? raw : "webchat";
  }

  function conversationId() {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) return existing;
      const created = `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(STORAGE_KEY, created);
      return created;
    } catch (error) {
      return `web-${Date.now()}`;
    }
  }

  function rateAllowed() {
    const now = Date.now();
    let hits = [];
    try {
      hits = JSON.parse(localStorage.getItem(RATE_KEY) || "[]");
    } catch (error) {
      hits = [];
    }
    hits = hits.filter((time) => now - Number(time) < 60000);
    if (hits.length >= 12) return false;
    hits.push(now);
    try {
      localStorage.setItem(RATE_KEY, JSON.stringify(hits));
    } catch (error) {
      // Widget can continue without client-side persistence.
    }
    return true;
  }

  async function authHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (!App.auth || !App.auth.getSession) return headers;
    try {
      const session = await App.auth.getSession();
      if (session && session.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
    } catch (error) {
      // Public webchat still works without an authenticated session.
    }
    return headers;
  }

  function styles() {
    if (document.getElementById("allonahub-assistant-widget-style")) return;
    const style = document.createElement("style");
    style.id = "allonahub-assistant-widget-style";
    style.textContent = `
      .ah-assistant{position:fixed;right:20px;bottom:20px;z-index:2147483000;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#102033;display:grid;justify-items:end;gap:10px}
      .ah-assistant *{box-sizing:border-box;letter-spacing:0}
      .ah-assistant__button{position:relative;width:66px;height:66px;border:1px solid rgba(255,255,255,.36);border-radius:22px;background:linear-gradient(145deg,#061b33 0%,#0755b8 50%,#00e5ff 100%);color:#fff;box-shadow:0 18px 46px rgba(0,122,255,.34),0 0 0 6px rgba(255,215,0,.08);font-weight:900;cursor:pointer;display:grid;place-items:center;overflow:hidden;isolation:isolate;transition:transform .18s ease,box-shadow .18s ease}
      .ah-assistant__button:before{content:"";position:absolute;inset:-38%;background:conic-gradient(from 120deg,rgba(255,215,0,.95),rgba(0,229,255,.45),rgba(255,255,255,.82),rgba(255,215,0,.95));animation:ahAssistSpin 5.5s linear infinite;opacity:.72;z-index:-2}
      .ah-assistant__button:after{content:"";position:absolute;inset:3px;border-radius:19px;background:linear-gradient(145deg,rgba(4,16,37,.98),rgba(0,85,184,.88));z-index:-1}
      .ah-assistant__button:hover{transform:translateY(-2px);box-shadow:0 22px 54px rgba(0,122,255,.42),0 0 0 7px rgba(255,215,0,.12)}
      .ah-assistant__button-mark{position:relative;display:grid;place-items:center;width:44px;height:44px;border-radius:16px;background:radial-gradient(circle at 35% 20%,rgba(255,255,255,.94),rgba(255,255,255,.1) 42%,rgba(0,229,255,.16));box-shadow:inset 0 0 18px rgba(255,255,255,.16)}
      .ah-assistant__button-mark b{font-size:25px;line-height:1;color:#ffd700;text-shadow:0 0 12px rgba(255,215,0,.42)}
      .ah-assistant__button-mark i{position:absolute;right:-5px;bottom:-4px;display:grid;place-items:center;min-width:22px;height:22px;border-radius:999px;background:#ffd700;color:#061b33;font-style:normal;font-size:10px;font-weight:1000;box-shadow:0 6px 14px rgba(0,0,0,.22)}
      .ah-assistant__channels{position:absolute;right:2px;bottom:78px;display:grid;gap:10px;width:min(210px,calc(100vw - 32px));max-height:min(276px,calc(100vh - 118px));overflow-y:auto;padding:4px;opacity:0;transform:translateY(14px) scale(.96);pointer-events:none;transition:opacity .2s ease,transform .2s ease;scrollbar-width:none}
      .ah-assistant__channels::-webkit-scrollbar{display:none}
      .ah-assistant--actions-open .ah-assistant__channels{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}
      .ah-assistant__channel{width:100%;min-height:58px;border:1px solid rgba(255,255,255,.26);border-radius:18px;padding:10px 12px;display:grid;grid-template-columns:42px 1fr;align-items:center;gap:10px;text-decoration:none;color:#fff;background:linear-gradient(145deg,rgba(5,25,50,.96),rgba(3,10,24,.98));box-shadow:0 14px 34px rgba(2,8,20,.32);cursor:pointer;text-align:left}
      .ah-assistant__channel:hover{transform:translateY(-1px);border-color:rgba(0,229,255,.5)}
      .ah-assistant__channel-icon{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;font-weight:1000;font-size:13px;color:#061b33;background:#fff}
      .ah-assistant__channel strong{display:block;font-size:13px;line-height:1.15;color:#fff}
      .ah-assistant__channel small{display:block;margin-top:3px;font-size:11px;line-height:1.2;color:rgba(255,255,255,.72)}
      .ah-assistant__channel--chat .ah-assistant__channel-icon{background:linear-gradient(135deg,#ffd700,#fff1a8)}
      .ah-assistant__channel--whatsapp .ah-assistant__channel-icon{background:#25d366;color:#fff}
      .ah-assistant__channel--telegram .ah-assistant__channel-icon{background:#27a7e7;color:#fff}
      .ah-assistant__panel{position:absolute;right:0;bottom:72px;width:min(380px,calc(100vw - 32px));height:min(620px,calc(100vh - 112px));background:#fff;border:1px solid rgba(16,32,51,.12);border-radius:8px;box-shadow:0 24px 80px rgba(16,32,51,.24);display:none;overflow:hidden}
      .ah-assistant--open .ah-assistant__panel{display:grid;grid-template-rows:auto 1fr auto}
      .ah-assistant__head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 14px 12px;background:#102033;color:#fff}
      .ah-assistant__title{display:grid;gap:2px;min-width:0}
      .ah-assistant__title strong{font-size:15px;line-height:1.2}
      .ah-assistant__title span{font-size:12px;line-height:1.3;color:rgba(255,255,255,.76)}
      .ah-assistant__close{width:34px;height:34px;border:0;border-radius:6px;background:rgba(255,255,255,.12);color:#fff;font-size:22px;line-height:1;cursor:pointer}
      .ah-assistant__messages{padding:14px;overflow:auto;background:#f6f9fc;display:flex;flex-direction:column;gap:10px}
      .ah-assistant__msg{max-width:88%;padding:10px 12px;border-radius:8px;font-size:14px;line-height:1.42;white-space:pre-wrap;overflow-wrap:anywhere}
      .ah-assistant__msg--assistant{align-self:flex-start;background:#fff;border:1px solid rgba(16,32,51,.08)}
      .ah-assistant__msg--user{align-self:flex-end;background:#0b72ff;color:#fff}
      .ah-assistant__msg--status{align-self:center;background:transparent;color:#5d6b7a;font-size:12px;padding:2px}
      .ah-assistant__msg-text{white-space:pre-wrap}
      .ah-assistant__actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:10px}
      .ah-assistant__action{display:flex;align-items:center;justify-content:center;min-height:36px;padding:8px 9px;border:1px solid rgba(11,114,255,.22);border-radius:7px;background:#eef6ff;color:#0b3f8c;text-decoration:none;font-size:12px;font-weight:800;line-height:1.2;text-align:center;overflow-wrap:anywhere}
      .ah-assistant__action:hover{background:#ddecff;border-color:rgba(11,114,255,.42)}
      .ah-assistant__quick{display:flex;gap:6px;flex-wrap:wrap;padding:10px 12px;border-top:1px solid rgba(16,32,51,.08);background:#fff}
      .ah-assistant__quick button{border:1px solid rgba(11,114,255,.22);background:#eef6ff;color:#0b3f8c;border-radius:6px;padding:7px 9px;font-size:12px;font-weight:700;cursor:pointer}
      .ah-assistant__form{display:grid;grid-template-columns:1fr auto;gap:8px;padding:12px;border-top:1px solid rgba(16,32,51,.1);background:#fff}
      .ah-assistant__input{width:100%;min-height:42px;max-height:110px;resize:none;border:1px solid rgba(16,32,51,.18);border-radius:6px;padding:10px 11px;font:inherit;font-size:14px;line-height:1.35;outline:none}
      .ah-assistant__input:focus{border-color:#0b72ff;box-shadow:0 0 0 3px rgba(11,114,255,.12)}
      .ah-assistant__send{width:46px;height:42px;border:0;border-radius:6px;background:#f4b000;color:#102033;font-weight:900;cursor:pointer}
      .ah-assistant__send[disabled]{opacity:.56;cursor:not-allowed}
      @keyframes ahAssistSpin{to{transform:rotate(360deg)}}
      @media (max-width:520px){.ah-assistant{right:12px;bottom:12px}.ah-assistant__panel{right:0;bottom:68px;width:calc(100vw - 24px);height:min(600px,calc(100vh - 92px))}.ah-assistant__button{width:60px;height:60px;border-radius:20px}.ah-assistant__button:after{border-radius:17px}.ah-assistant__button-mark{width:40px;height:40px}.ah-assistant__channels{right:0;bottom:70px;width:min(198px,calc(100vw - 24px));max-height:min(236px,calc(100vh - 100px))}.ah-assistant__channel{min-height:54px;border-radius:16px}.ah-assistant__actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function appendActions(item, actions) {
    const cleanActions = (Array.isArray(actions) ? actions : [])
      .filter((action) => action && action.type === "open_url" && action.label && action.url)
      .slice(0, 6);
    if (!cleanActions.length) return;

    const grid = document.createElement("div");
    grid.className = "ah-assistant__actions";
    cleanActions.forEach((action) => {
      const href = safeActionUrl(action.url);
      if (!href) return;
      const link = document.createElement("a");
      link.className = "ah-assistant__action";
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = normalizeText(action.label, 44);
      grid.appendChild(link);
    });

    if (grid.children.length) item.appendChild(grid);
  }

  function appendMessage(messages, role, text, actions) {
    const item = document.createElement("div");
    item.className = `ah-assistant__msg ah-assistant__msg--${role}`;
    const textNode = document.createElement("div");
    textNode.className = "ah-assistant__msg-text";
    textNode.textContent = text;
    item.appendChild(textNode);
    if (role === "assistant") appendActions(item, actions);
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
    return item;
  }

  function widgetMarkup() {
    return `
      <div class="ah-assistant__channels" id="allonahub-assistant-channels" aria-label="Hızlı destek kanalları" data-assistant-channels>
        <button class="ah-assistant__channel ah-assistant__channel--chat" type="button" data-assistant-open-chat>
          <span class="ah-assistant__channel-icon" aria-hidden="true">AI</span>
          <span><strong>AI Asistan</strong><small>Web chat desteği</small></span>
        </button>
        <a class="ah-assistant__channel ah-assistant__channel--whatsapp" href="${CONTACT_CHANNELS.whatsapp}" target="_blank" rel="noopener noreferrer" data-assistant-channel-link>
          <span class="ah-assistant__channel-icon" aria-hidden="true">WA</span>
          <span><strong>WhatsApp</strong><small>Hızlı destek hattı</small></span>
        </a>
        <a class="ah-assistant__channel ah-assistant__channel--telegram" href="${CONTACT_CHANNELS.telegram}" target="_blank" rel="noopener noreferrer" data-assistant-channel-link>
          <span class="ah-assistant__channel-icon" aria-hidden="true">TG</span>
          <span><strong>Telegram</strong><small>Topluluk ve destek</small></span>
        </a>
      </div>
      <button class="ah-assistant__button" type="button" aria-label="AllonaHub hızlı destek seçeneklerini aç" aria-controls="allonahub-assistant-channels" aria-expanded="false" data-assistant-toggle>
        <span class="ah-assistant__button-mark" aria-hidden="true"><b>?</b><i>AI</i></span>
      </button>
      <section class="ah-assistant__panel" aria-label="AllonaHub destek asistanı">
        <header class="ah-assistant__head">
          <div class="ah-assistant__title">
            <strong>AllonaHub Destek</strong>
            <span>AI asistan</span>
          </div>
          <button class="ah-assistant__close" type="button" aria-label="Kapat" data-assistant-close>&times;</button>
        </header>
        <div class="ah-assistant__messages" data-assistant-messages></div>
        <div>
          <div class="ah-assistant__quick">
            <button type="button" data-assistant-quick="Siparişimi sorgulamak istiyorum">Sipariş</button>
            <button type="button" data-assistant-quick="Partner başvurusu yapmak istiyorum">Partner</button>
            <button type="button" data-assistant-quick="CV oluşturmak istiyorum">CV Oluştur</button>
            <button type="button" data-assistant-quick="Denizcilik iş ilanları hakkında bilgi almak istiyorum">Denizcilik</button>
            <button type="button" data-assistant-quick="AllonaHub Akademi hakkında bilgi almak istiyorum">Akademi</button>
            <button type="button" data-assistant-ticket="Destek talebi oluşturmak istiyorum">Destek Talebi</button>
          </div>
          <form class="ah-assistant__form" data-assistant-form>
            <textarea class="ah-assistant__input" rows="1" maxlength="1600" placeholder="Mesajınızı yazın" data-assistant-input></textarea>
            <button class="ah-assistant__send" type="submit" aria-label="Gönder" title="Gönder">›</button>
          </form>
        </div>
      </section>
    `;
  }

  async function postMessage(message, options) {
    const payload = {
      message,
      channel: options.channel,
      conversationId: conversationId(),
      createSupportTicket: Boolean(options.createSupportTicket),
      metadata: {
        widget_version: VERSION,
        url: window.location.href,
        page_title: document.title || "",
        referrer: document.referrer || "",
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      }
    };

    const response = await fetch(`${apiBaseUrl()}/v1/assistant/messages`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) {
      throw new Error(body.message || "Asistan yanıtı alınamadı.");
    }
    return body;
  }

  function mount(options) {
    if (document.querySelector("[data-allonahub-assistant-widget]")) return;
    styles();

    const state = {
      channel: configuredChannel(options),
      busy: false
    };

    const root = document.createElement("div");
    root.className = "ah-assistant";
    root.setAttribute("data-allonahub-assistant-widget", "");
    root.innerHTML = widgetMarkup();
    document.body.appendChild(root);

    const messages = root.querySelector("[data-assistant-messages]");
    const input = root.querySelector("[data-assistant-input]");
    const form = root.querySelector("[data-assistant-form]");
    const sendButton = root.querySelector(".ah-assistant__send");
    const toggleButton = root.querySelector("[data-assistant-toggle]");

    appendMessage(messages, "assistant", "Merhaba, AllonaHub destek asistanıyım. Sipariş, partner başvurusu, SSS, Akademi ve destek talebi için yardımcı olurum.");

    function setActionsOpen(value) {
      root.classList.toggle("ah-assistant--actions-open", Boolean(value));
      if (toggleButton) toggleButton.setAttribute("aria-expanded", value ? "true" : "false");
    }

    function setChatOpen(value) {
      root.classList.toggle("ah-assistant--open", Boolean(value));
      if (value) {
        setActionsOpen(false);
        input.focus();
      }
    }

    function setBusy(value) {
      state.busy = value;
      sendButton.disabled = value;
      input.disabled = value;
    }

    async function submit(text, extra) {
      const clean = normalizeText(text, 1600);
      if (!clean || state.busy) return;
      if (!rateAllowed()) {
        appendMessage(messages, "status", "Çok sık mesaj gönderildi. Lütfen biraz bekleyin.");
        return;
      }

      appendMessage(messages, "user", clean);
      input.value = "";
      setBusy(true);
      const status = appendMessage(messages, "status", "Yanıt hazırlanıyor...");
      try {
        const result = await postMessage(clean, {
          channel: state.channel,
          createSupportTicket: extra && extra.createSupportTicket
        });
        status.remove();
        appendMessage(messages, "assistant", result.message || "Yanıt hazır.", result.actions || []);
      } catch (error) {
        status.remove();
        appendMessage(messages, "assistant", error.message || "Şu anda yanıt veremedim. Lütfen daha sonra tekrar deneyin.");
      } finally {
        setBusy(false);
        input.focus();
      }
    }

    toggleButton.addEventListener("click", () => {
      const next = !root.classList.contains("ah-assistant--actions-open");
      setChatOpen(false);
      setActionsOpen(next);
    });

    root.querySelector("[data-assistant-open-chat]").addEventListener("click", () => {
      setChatOpen(true);
    });

    root.querySelector("[data-assistant-close]").addEventListener("click", () => {
      setChatOpen(false);
    });

    root.querySelectorAll("[data-assistant-channel-link]").forEach((link) => {
      link.addEventListener("click", () => setActionsOpen(false));
    });

    document.addEventListener("click", (event) => {
      if (!root.contains(event.target)) setActionsOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setActionsOpen(false);
        setChatOpen(false);
      }
    });

    root.querySelectorAll("[data-assistant-quick]").forEach((button) => {
      button.addEventListener("click", () => submit(button.dataset.assistantQuick || ""));
    });

    root.querySelectorAll("[data-assistant-ticket]").forEach((button) => {
      button.addEventListener("click", () => submit(button.dataset.assistantTicket || "", { createSupportTicket: true }));
    });

    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 110)}px`;
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submit(input.value);
    });
  }

  App.assistantWidget = {
    mount,
    open() {
      const root = document.querySelector("[data-allonahub-assistant-widget]");
      if (root) {
        root.classList.remove("ah-assistant--actions-open");
        root.classList.add("ah-assistant--open");
        root.querySelector("[data-assistant-toggle]")?.setAttribute("aria-expanded", "false");
      }
    },
    close() {
      const root = document.querySelector("[data-allonahub-assistant-widget]");
      if (root) {
        root.classList.remove("ah-assistant--open", "ah-assistant--actions-open");
        root.querySelector("[data-assistant-toggle]")?.setAttribute("aria-expanded", "false");
      }
    }
  };

  const autoMount = !SCRIPT || SCRIPT.dataset.autoMount !== "false";
  if (autoMount) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => mount());
    } else {
      mount();
    }
  }
})();
