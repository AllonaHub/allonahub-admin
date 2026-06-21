(function () {
  const App = window.Allona = window.Allona || {};
  const SCRIPT = document.currentScript;
  const VERSION = "20260621";
  const STORAGE_KEY = "allonahub_assistant_conversation_id";
  const RATE_KEY = "allonahub_assistant_rate";
  const CHANNELS = ["webchat", "telegram", "partner_panel", "admin_panel", "whatsapp", "instagram"];

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
      .ah-assistant{position:fixed;right:20px;bottom:20px;z-index:2147483000;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#102033}
      .ah-assistant *{box-sizing:border-box;letter-spacing:0}
      .ah-assistant__button{width:58px;height:58px;border:0;border-radius:50%;background:#0b72ff;color:#fff;box-shadow:0 16px 38px rgba(11,114,255,.3);font-weight:800;cursor:pointer;display:grid;place-items:center}
      .ah-assistant__button span{display:block;font-size:24px;line-height:1}
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
      .ah-assistant__quick{display:flex;gap:6px;flex-wrap:wrap;padding:10px 12px;border-top:1px solid rgba(16,32,51,.08);background:#fff}
      .ah-assistant__quick button{border:1px solid rgba(11,114,255,.22);background:#eef6ff;color:#0b3f8c;border-radius:6px;padding:7px 9px;font-size:12px;font-weight:700;cursor:pointer}
      .ah-assistant__form{display:grid;grid-template-columns:1fr auto;gap:8px;padding:12px;border-top:1px solid rgba(16,32,51,.1);background:#fff}
      .ah-assistant__input{width:100%;min-height:42px;max-height:110px;resize:none;border:1px solid rgba(16,32,51,.18);border-radius:6px;padding:10px 11px;font:inherit;font-size:14px;line-height:1.35;outline:none}
      .ah-assistant__input:focus{border-color:#0b72ff;box-shadow:0 0 0 3px rgba(11,114,255,.12)}
      .ah-assistant__send{width:46px;height:42px;border:0;border-radius:6px;background:#f4b000;color:#102033;font-weight:900;cursor:pointer}
      .ah-assistant__send[disabled]{opacity:.56;cursor:not-allowed}
      @media (max-width:520px){.ah-assistant{right:12px;bottom:12px}.ah-assistant__panel{right:0;bottom:68px;width:calc(100vw - 24px);height:min(600px,calc(100vh - 92px))}.ah-assistant__button{width:54px;height:54px}}
    `;
    document.head.appendChild(style);
  }

  function appendMessage(messages, role, text) {
    const item = document.createElement("div");
    item.className = `ah-assistant__msg ah-assistant__msg--${role}`;
    item.textContent = text;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
    return item;
  }

  function widgetMarkup() {
    return `
      <button class="ah-assistant__button" type="button" aria-label="AllonaHub destek asistanını aç" data-assistant-toggle>
        <span aria-hidden="true">?</span>
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

    appendMessage(messages, "assistant", "Merhaba, AllonaHub destek asistanıyım. Sipariş, partner başvurusu, SSS, Akademi ve destek talebi için yardımcı olurum.");

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
        appendMessage(messages, "assistant", result.message || "Yanıt hazır.");
      } catch (error) {
        status.remove();
        appendMessage(messages, "assistant", error.message || "Şu anda yanıt veremedim. Lütfen daha sonra tekrar deneyin.");
      } finally {
        setBusy(false);
        input.focus();
      }
    }

    root.querySelector("[data-assistant-toggle]").addEventListener("click", () => {
      root.classList.toggle("ah-assistant--open");
      if (root.classList.contains("ah-assistant--open")) input.focus();
    });

    root.querySelector("[data-assistant-close]").addEventListener("click", () => {
      root.classList.remove("ah-assistant--open");
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
      if (root) root.classList.add("ah-assistant--open");
    },
    close() {
      const root = document.querySelector("[data-allonahub-assistant-widget]");
      if (root) root.classList.remove("ah-assistant--open");
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

