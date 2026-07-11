(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const preferenceKeys = {
    theme: "allona_theme_v1",
    language: "allona_language_v1"
  };
  const themes = ["sea", "neon", "fresh"];
  const languages = ["tr", "en"];

  function readPreference(key, fallback) {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writePreference(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      // Preferences still apply for the current page if storage is unavailable.
    }
  }

  function applyTheme(value) {
    const theme = themes.includes(value) ? value : "sea";
    document.documentElement.dataset.theme = theme;
    writePreference(preferenceKeys.theme, theme);
    return theme;
  }

  function applyLanguage(value) {
    const language = languages.includes(value) ? value : "tr";
    document.documentElement.lang = language;
    writePreference(preferenceKeys.language, language);
    return language;
  }

  applyTheme(readPreference(preferenceKeys.theme, "sea"));
  applyLanguage(readPreference(preferenceKeys.language, document.documentElement.lang || "tr"));

  function active(path) {
    const current = window.location.pathname.split("/").pop() || "index.html";
    return current === path ? 'aria-current="page"' : "";
  }

  function headerMarkup() {
    return `
      <div class="top-bar">
        <div class="container top-bar__inner">
          <span>AllonaHub güvenli alışveriş deneyimi</span>
          <nav class="top-bar__links" aria-label="Üst bağlantılar">
            <a href="${core.url("orders.html")}">Siparişlerim</a>
            <a href="${core.url("addresses.html")}">Adreslerim</a>
            <a href="${core.url("favorites.html")}">Favorilerim</a>
          </nav>
        </div>
      </div>
      <header class="site-header">
        <div class="container header-main">
          <a class="brand" href="${core.url("index.html")}" aria-label="AllonaHub ana sayfa">
            <img src="${core.url("images/allona-logo-mark.png")}" alt="AllonaHub">
            <span class="brand__name"><span class="brand__allona">Allona</span><span class="brand__hub">Hub</span></span>
          </a>
          <form class="search-form" data-site-search role="search">
            <input type="search" name="q" autocomplete="off" placeholder="Ürün, kategori veya marka ara" aria-label="Ürün ara">
            <button class="btn" type="submit">Ara</button>
          </form>
          <div class="header-actions">
            <div class="action-menu" data-notification-menu>
              <button class="icon-btn" type="button" data-notification-toggle aria-label="Bildirimler" aria-expanded="false" title="Bildirimler">
                🔔 <span class="badge" data-notification-count>0</span>
              </button>
              <div class="action-popover" data-notification-panel hidden>
                <strong>Bildirimler</strong>
                <p>Yeni bildiriminiz yok. Sipariş ve favori güncellemeleri burada görünecek.</p>
                <a href="${core.url("orders.html")}">Siparişleri aç</a>
              </div>
            </div>
            <a class="link-btn icon-btn--wide" href="${core.url("wallet.html")}" aria-label="Hub Wallet">Wallet</a>
            <a class="icon-btn" href="${core.url("favorites.html")}" aria-label="Favoriler">
              ♡ <span class="badge" data-fav-count>0</span>
            </a>
            <a class="icon-btn" href="${core.url("cart.html")}" aria-label="Sepet">
              🛒 <span class="badge" data-cart-count>0</span>
            </a>
            <a class="link-btn icon-btn--wide" href="${core.url("login.html")}" data-account-link>Hesabım</a>
            <label class="select-chip" aria-label="Dil seçimi">
              <span>Dil</span>
              <select data-language-select>
                <option value="tr">TR</option>
                <option value="en">EN</option>
              </select>
            </label>
            <label class="select-chip" aria-label="Tema seçimi">
              <span>Tema</span>
              <select data-theme-select>
                <option value="sea">Deniz</option>
                <option value="neon">Neon</option>
                <option value="fresh">Ferah</option>
              </select>
            </label>
            <button class="icon-btn mobile-nav-toggle" type="button" data-nav-toggle aria-label="Menüyü aç" aria-expanded="false" aria-controls="site-primary-nav">☰</button>
          </div>
        </div>
        <div class="nav-row">
          <div class="container nav-row__inner">
            <nav class="nav-links" id="site-primary-nav" data-nav-links aria-label="Ana menü">
              <a href="${core.url("index.html")}" ${active("index.html")}>Vitrin</a>
              <a href="${core.url("shop.html")}" ${active("shop.html")}>Mağaza</a>
              <a href="${core.url("market.html")}" ${active("market.html")}>Market</a>
              <a href="${core.url("avm-dunyasi.html")}" ${active("avm-dunyasi.html")}>AVM Dünyası</a>
              <a href="${core.url("taxi.html")}" ${active("taxi.html")}>Taksi</a>
              <a href="${core.url("cart.html")}" ${active("cart.html")}>Sepet</a>
              <a href="${core.url("checkout.html")}" ${active("checkout.html")}>Checkout</a>
              <a href="${core.url("profile.html")}" ${active("profile.html")}>Profil</a>
            </nav>
          </div>
        </div>
      </header>
    `;
  }

  function footerMarkup() {
    const year = new Date().getFullYear();
    const socials = [
      ["WhatsApp", "WA", "https://wa.me/905427781868", "social-link--whatsapp"],
      ["Instagram", "IG", "https://www.instagram.com/allonahub", "social-link--instagram"],
      ["X", "X", "https://x.com/allonahub", "social-link--x"],
      ["LinkedIn", "in", "https://www.linkedin.com/company/allonahub", "social-link--linkedin"],
      ["YouTube", "▶", "https://www.youtube.com/@allonahub", "social-link--youtube"],
      ["Nsosyal", "N", "https://nsosyal.com/allonahub", "social-link--nsosyal"],
      ["TikTok", "♪", "https://www.tiktok.com/@allonahub", "social-link--tiktok"]
    ];
    return `
      <footer class="site-footer">
        <div class="container footer-grid">
          <div class="footer-col">
            <a class="footer-brand" href="${core.url("index.html")}" aria-label="AllonaHub ana sayfa">
              <img src="${core.url("images/allona-logo-mark.png")}" alt="">
              <span><span class="brand__allona">Allona</span><span class="brand__hub">Hub</span></span>
            </a>
            <p>AllonaHub ekosisteminin premium alışveriş deneyimi.</p>
          </div>
          <div class="footer-col">
            <h3>Mağaza</h3>
            <a href="${core.url("shop.html")}">Ürünler</a>
            <a href="${core.url("market.html")}">Allona Market</a>
            <a href="${core.url("avm-dunyasi.html")}">AVM Dünyası</a>
            <a href="${core.url("avm-partner.html")}">AVM Partner</a>
            <a href="${core.url("favorites.html")}">Favorilerim</a>
            <a href="${core.url("orders.html")}">Siparişlerim</a>
          </div>
          <div class="footer-col">
            <h3>Hesap</h3>
            <a href="${core.url("login.html")}">Giriş Yap</a>
            <a href="${core.url("register.html")}">Kayıt Ol</a>
            <a href="${core.url("profile.html")}">Profil</a>
          </div>
          <div class="footer-col">
            <h3>İletişim</h3>
            <p>info@allonahub.com</p>
            <p>İstanbul / Türkiye</p>
            <p>+90 542 778 18 68</p>
          </div>
        </div>
        <div class="container footer-social" aria-label="AllonaHub sosyal medya bağlantıları">
          ${socials.map(([label, icon, href, className]) => `
            <a class="social-link ${className}" href="${href}" target="_blank" rel="noopener" aria-label="${label}">
              <span class="social-link__icon">${icon}</span>
              <span>${label}</span>
            </a>
          `).join("")}
        </div>
        <div class="container footer-bottom">© ${year} AllonaHub. Tüm hakları saklıdır.</div>
      </footer>
    `;
  }

  async function updateAccountLink() {
    const link = document.querySelector("[data-account-link]");
    if (!link || !App.auth) return;
    const user = await App.auth.getUser();
    if (user) {
      link.href = core.url("profile.html");
      link.textContent = "Profil";
    }
  }

  async function updateRemoteFavoriteCount() {
    if (!App.favorites) return;
    try {
      const ids = await App.favorites.ids();
      document.querySelectorAll("[data-fav-count]").forEach((node) => {
        node.textContent = ids.length;
      });
    } catch (error) {
      // Local count remains visible if the remote favorite table is unavailable.
    }
  }

  function setMobileNav(open) {
    const nav = document.querySelector("[data-nav-links]");
    const toggle = document.querySelector("[data-nav-toggle]");
    const header = document.querySelector(".site-header");
    if (!nav || !toggle || !header) return;

    nav.classList.toggle("is-open", open);
    header.classList.toggle("nav-open", open);
    document.body.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Menüyü kapat" : "Menüyü aç");
  }

  function bindLayout() {
    document.querySelectorAll("[data-layout='header']").forEach((node) => {
      node.innerHTML = headerMarkup();
    });
    document.querySelectorAll("[data-layout='footer']").forEach((node) => {
      node.innerHTML = footerMarkup();
    });

    document.querySelectorAll("[data-theme-select]").forEach((select) => {
      select.value = document.documentElement.dataset.theme || "sea";
    });
    document.querySelectorAll("[data-language-select]").forEach((select) => {
      select.value = document.documentElement.lang || "tr";
    });

    document.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-site-search]");
      if (!form) return;
      event.preventDefault();
      const q = new FormData(form).get("q") || "";
      const page = document.querySelector("[data-page='market']") ? "market.html" : "shop.html";
      window.location.href = core.url(`${page}?q=${encodeURIComponent(q)}`);
    });

    document.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-nav-toggle]");
      const notificationToggle = event.target.closest("[data-notification-toggle]");
      const notificationMenu = event.target.closest("[data-notification-menu]");

      if (notificationToggle) {
        const panel = document.querySelector("[data-notification-panel]");
        const open = notificationToggle.getAttribute("aria-expanded") !== "true";
        notificationToggle.setAttribute("aria-expanded", String(open));
        if (panel) panel.hidden = !open;
        return;
      }

      if (!notificationMenu) {
        const panel = document.querySelector("[data-notification-panel]");
        const button = document.querySelector("[data-notification-toggle]");
        if (panel) panel.hidden = true;
        if (button) button.setAttribute("aria-expanded", "false");
      }

      if (toggle) {
        const open = toggle.getAttribute("aria-expanded") !== "true";
        setMobileNav(open);
        return;
      }

      if (event.target.closest("[data-nav-links] a")) {
        setMobileNav(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setMobileNav(false);
        const panel = document.querySelector("[data-notification-panel]");
        const button = document.querySelector("[data-notification-toggle]");
        if (panel) panel.hidden = true;
        if (button) button.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("change", (event) => {
      const themeSelect = event.target.closest("[data-theme-select]");
      const languageSelect = event.target.closest("[data-language-select]");
      if (themeSelect) {
        applyTheme(themeSelect.value);
        core.toast("Tema güncellendi.");
      }
      if (languageSelect) {
        applyLanguage(languageSelect.value);
        core.toast("Dil tercihi kaydedildi.");
      }
    });

    if (App.cart) App.cart.updateBadges();
    updateAccountLink();
    updateRemoteFavoriteCount();
  }

  document.addEventListener("DOMContentLoaded", bindLayout);
})();
