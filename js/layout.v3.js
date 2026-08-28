(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;

  function active(path) {
    const current = window.location.pathname.endsWith("/") ? `${window.location.pathname}index.html` : window.location.pathname;
    const target = core.url(path).split(/[?#]/)[0];
    return current === target || current.split("/").pop() === target.split("/").pop() ? 'aria-current="page"' : "";
  }

  function headerMarkup() {
    return `
      <div class="top-bar">
        <div class="container top-bar__inner">
          <span>AllonaHub güvenli alışveriş ve hizmet ekosistemi</span>
          <nav class="top-bar__links" aria-label="Üst bağlantılar">
            <a href="${core.url("/pages/account/bildirimler.html")}">Bildirimler</a>
            <a href="${core.url("/pages/account/orders.html")}">Siparişlerim</a>
            <a href="${core.url("/pages/account/addresses.html")}">Adreslerim</a>
            <a href="${core.url("/pages/account/favorites.html")}">Favorilerim</a>
          </nav>
        </div>
      </div>
      <header class="site-header">
        <div class="container header-main">
          <div class="header-brand-row">
            <a class="brand" href="${core.url("/index.html")}" aria-label="AllonaHub ana sayfa">
              <img src="${core.url("/images/brand/allona.logo.png")}" alt="AllonaHub Logo">
              <span class="logo-title"><span class="gold">Allona</span><span class="blue">Hub</span></span>
            </a>
            <span class="platform-controls-slot" data-platform-controls-slot></span>
          </div>
          <form class="search-form" data-site-search>
            <input type="search" name="q" autocomplete="off" placeholder="Ürün, kategori, hizmet veya marka ara" aria-label="Ürün, kategori, hizmet veya marka ara">
            <button class="btn" type="submit">Ara</button>
          </form>
          <div class="header-actions">
            <button class="icon-btn mobile-nav-toggle" type="button" data-nav-toggle aria-label="Menüyü aç" aria-expanded="false" aria-controls="site-primary-nav">☰</button>
            <a class="icon-btn icon-btn--count" href="${core.url("/pages/account/bildirimler.html")}" aria-label="Bildirimler" data-notification-link>
              🔔 <span class="badge" data-notification-count hidden aria-hidden="true"></span>
            </a>
            <a class="icon-btn icon-btn--count icon-btn--favorite" href="${core.url("/pages/account/favorites.html")}" aria-label="Favoriler">
              <span class="header-action-icon header-action-icon--heart" aria-hidden="true">♥</span>
              <span class="badge" data-fav-count>0</span>
            </a>
            <a class="icon-btn icon-btn--wide" href="${core.url("/pages/commerce/kuponlar.html")}" aria-label="Kuponlar">
              Kupon
            </a>
            <a class="icon-btn icon-btn--count icon-btn--cart" href="${core.url("/pages/commerce/cart.html")}" aria-label="Sepet">
              <span class="header-action-icon header-action-icon--cart" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3.5 4.5h2.2l2.1 10.1a2.2 2.2 0 0 0 2.1 1.7h7.5a2.2 2.2 0 0 0 2.1-1.6l1.4-5.5H7"></path>
                  <path d="M9.5 11.5h8.2"></path>
                  <path d="M10.2 13.8h6.4"></path>
                  <circle cx="10.3" cy="20" r="1.55"></circle>
                  <circle cx="18" cy="20" r="1.55"></circle>
                </svg>
              </span>
              <span class="badge" data-cart-count>0</span>
            </a>
            <a class="link-btn icon-btn--wide" href="${core.url("/pages/account/user.html")}" data-account-link>Giriş Yap</a>
          </div>
        </div>
        <div class="nav-row">
          <div class="container nav-row__inner">
            <nav class="nav-links" id="site-primary-nav" data-nav-links aria-label="Ana menü">
              <a href="${core.url("/index.html#modules")}" ${active("/index.html")}>Ekosistem</a>
              <a href="${core.url("/allonahub-akademi.html")}" ${active("/allonahub-akademi.html")}>Akademi</a>
              <a href="${core.url("/pages/ecosystem/allonataksi.html")}" ${active("/pages/ecosystem/allonataksi.html")}>Taksi</a>
              <a href="${core.url("/pages/commerce/shop.html")}" ${active("/pages/commerce/shop.html")}>Mağaza</a>
              <a href="${core.url("/pages/commerce/allonamarket.html")}" ${active("/pages/commerce/allonamarket.html")}>Market</a>
              <a href="${core.url("/pages/commerce/cart.html")}" ${active("/pages/commerce/cart.html")}>Sepet</a>
              <a href="${core.url("/pages/commerce/guvenli-odeme.html")}" ${active("/pages/commerce/guvenli-odeme.html")}>Ödeme</a>
              <a href="${core.url("/pages/premium.html")}" ${active("/pages/premium.html")}>Premium</a>
              <a href="${core.url("/pages/account/user-panel.html")}" ${active("/pages/account/user-panel.html")}>Hesabım</a>
            </nav>
          </div>
        </div>
      </header>
    `;
  }

  function footerMarkup() {
    const year = new Date().getFullYear();
    const socials = [
      ["WhatsApp", "whatsapp", "https://wa.me/905427781868", "wa"],
      ["Instagram", "instagram", "https://www.instagram.com/allonahub", "ig"],
      ["X", "X", "https://x.com/allonahub", "x"],
      ["Facebook", "facebook", "https://www.facebook.com/allonahub", "fb"],
      ["YouTube", "youtube", "https://www.youtube.com/@allonahub", "yt"],
      ["LinkedIn", "linkedin", "https://www.linkedin.com/company/allonahub", "li"],
      ["Telegram", "telegram", "https://t.me/allonahub", "tg"],
      ["TikTok", "tiktok", "https://www.tiktok.com/@allonahub", "tk"],
      ["E-Mail", "mail", "mailto:info@allonahub.com", "mail"]
    ];
    const socialIcon = (name) => {
      const icons = {
        whatsapp: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 3.2a8.72 8.72 0 0 0-7.46 13.25L3.5 20.8l4.45-1.05a8.72 8.72 0 1 0 4.09-16.55Zm0 1.72a6.99 6.99 0 0 1 5.9 10.76 6.95 6.95 0 0 1-8.84 2.24l-.33-.18-2.6.61.63-2.53-.2-.35a7 7 0 0 1 5.44-10.55Zm-2.9 3.44c-.16 0-.42.06-.65.31-.22.25-.85.83-.85 2.02 0 1.19.87 2.34.99 2.51.12.16 1.68 2.68 4.14 3.65 2.05.81 2.47.65 2.92.61.45-.04 1.45-.59 1.65-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.47-.29-.25-.12-1.45-.72-1.68-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.78.96-.14.16-.29.18-.53.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.71-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.55-1.34-.77-1.83-.2-.48-.41-.41-.57-.42h-.49Z"/></svg>`,
        instagram: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.4 2.8h9.2a4.6 4.6 0 0 1 4.6 4.6v9.2a4.6 4.6 0 0 1-4.6 4.6H7.4a4.6 4.6 0 0 1-4.6-4.6V7.4a4.6 4.6 0 0 1 4.6-4.6Zm0 1.9a2.7 2.7 0 0 0-2.7 2.7v9.2a2.7 2.7 0 0 0 2.7 2.7h9.2a2.7 2.7 0 0 0 2.7-2.7V7.4a2.7 2.7 0 0 0-2.7-2.7H7.4Zm4.6 3.1a4.2 4.2 0 1 1 0 8.4 4.2 4.2 0 0 1 0-8.4Zm0 1.9a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6Zm4.45-2.36a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1Z"/></svg>`,
        X: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.25 10.35 21.18 2.8h-2.2l-5.7 6.2-4.55-6.2H3.2l7.26 9.9-7.26 7.9h2.2l6.02-6.55 4.8 6.55h5.53l-7.5-10.25Zm-2.05 2.23-.99-1.35-4.4-5.98h1.02l4.46 6.06.99 1.35 4.64 6.3h-1.02l-4.7-6.38Z"/></svg>`,
        facebook: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.1 8.05V6.62c0-.68.45-.84.77-.84h1.95V2.82L14.13 2.8c-2.98 0-3.66 2.23-3.66 3.66v1.59H8.25v3.04h2.22v8.61h3.63v-8.61h2.48l.33-3.04H14.1Z"/></svg>`,
        youtube: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.4 7.1a3 3 0 0 0-2.12-2.12C17.4 4.48 12 4.48 12 4.48s-5.4 0-7.28.5A3 3 0 0 0 2.6 7.1 31.2 31.2 0 0 0 2.1 12c0 1.72.18 3.55.5 4.9a3 3 0 0 0 2.12 2.12c1.88.5 7.28.5 7.28.5s5.4 0 7.28-.5a3 3 0 0 0 2.12-2.12c.32-1.35.5-3.18.5-4.9s-.18-3.55-.5-4.9ZM10.05 15.6V8.4L16.1 12l-6.05 3.6Z"/></svg>`,
        linkedin: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.35 8.9h3.32v10.3H5.35V8.9Zm1.66-5.1a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8Zm4.1 5.1h3.18v1.41h.05c.44-.84 1.52-1.72 3.13-1.72 3.35 0 3.97 2.2 3.97 5.07v5.54h-3.31v-4.91c0-1.17-.02-2.68-1.63-2.68-1.64 0-1.89 1.28-1.89 2.6v4.99h-3.32V8.9Z"/></svg>`,
        telegram: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.6 4.2 18.4 19.25c-.24 1.07-.86 1.34-1.75.83l-4.84-3.57-2.34 2.25c-.26.26-.47.47-.97.47l.35-4.93 8.97-8.1c.39-.35-.08-.54-.61-.2L6.12 12.98 1.35 11.5c-1.04-.33-1.06-1.04.22-1.54L20.2 2.78c.86-.32 1.61.2 1.4 1.42Z"/></svg>`,
        tiktok: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.86 2.8c.28 2.45 1.65 3.91 4.04 4.07v3.12a7.08 7.08 0 0 1-4.02-1.23v5.84c0 3.9-2.43 6.6-6.06 6.6a5.7 5.7 0 0 1-5.72-5.76 5.74 5.74 0 0 1 7.7-5.4v3.38a2.55 2.55 0 0 0-1.84-.45 2.45 2.45 0 0 0 .18 4.88c1.43 0 2.34-.9 2.34-2.62V2.8h3.38Z"/></svg>`,
        mail: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.6 5.4h14.8a2.2 2.2 0 0 1 2.2 2.2v8.8a2.2 2.2 0 0 1-2.2 2.2H4.6a2.2 2.2 0 0 1-2.2-2.2V7.6a2.2 2.2 0 0 1 2.2-2.2Zm.24 2 7.16 5.02 7.16-5.02H4.84Zm14.76 2.22-6.98 4.88a1.08 1.08 0 0 1-1.24 0L4.4 9.62v6.78c0 .11.09.2.2.2h14.8a.2.2 0 0 0 .2-.2V9.62Z"/></svg>`
      };
      return icons[name] || `<span>${core.escapeHTML(name)}</span>`;
    };
    const storeIcon = (name) => {
      const icons = {
        apple: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.08 2.47-1.35.03-1.78-.79-3.32-.79-1.54 0-2.02.77-3.3.82-1.32.05-2.33-1.34-3.17-2.57-1.72-2.49-3.03-7.03-1.27-10.1 1.22-2.12 3.4-3.44 5.78-3.48 1.27-.02 2.47.85 3.32.85.84 0 2.44-1.05 4.11-.9.7.03 2.66.28 3.92 2.13-.1.06-2.34 1.37-2.31 4.08.03 3.24 2.84 4.32 2.87 4.33-.02.07-.45 1.55-1.49 3.06ZM13.4 4.8c.7-.85 1.17-2.03 1.04-3.2-1.01.04-2.24.67-2.96 1.52-.65.75-1.22 1.96-1.06 3.11 1.13.09 2.29-.57 2.98-1.43Z"/></svg>`,
        play: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.5 3.52c-.35.22-.55.66-.55 1.25v14.46c0 .59.2 1.03.55 1.25l8.41-8.48L4.5 3.52Z"/><path d="m15.57 9.32-2.1 2.12-2.1-2.12-6.16-6.2c.3-.04.65.04 1.03.25l9.33 5.95Z"/><path d="m13.47 12.56 2.1 2.12-9.33 5.95c-.38.21-.73.29-1.03.25l8.26-8.32Z"/><path d="M20.05 11.02c.9.55.9 1.41 0 1.96l-3.35 2.13L14.59 13l2.11-2.11 3.35 2.13Z"/></svg>`
      };
      return icons[name] || "";
    };
    return `
      <footer class="site-footer allona-user-footer">
        <div class="container footer-grid">
          <div class="footer-col">
            <a class="footer-brand" href="${core.url("/index.html")}" aria-label="AllonaHub ana sayfa">
              <img src="${core.url("/images/brand/allona.logo.png")}" alt="AllonaHub Logo">
              <span class="logo-title"><span class="gold">Allona</span><span class="blue">Hub</span></span>
            </a>
            <p>Tek hesapla alışveriş, hizmet, partner, ödeme ve dijital çözümler.</p>
            <p>Allworksin Business Danışmanlık Tic. Ltd. Şti.</p>
            <p>İstanbul / Türkiye</p>
            <p>info@allonahub.com</p>
          </div>
          <div class="footer-col">
            <h3>Alışveriş</h3>
            <a href="${core.url("/pages/commerce/shop.html")}">Ürünler</a>
            <a href="${core.url("/pages/commerce/allonashop.html")}">Allona Shop</a>
            <a href="${core.url("/pages/commerce/allonayemek.html")}">Allona Yemek</a>
            <a href="${core.url("/pages/commerce/allonamarket.html")}">Allona Market</a>
            <a href="${core.url("/pages/commerce/kuponlar.html")}">Kuponlar</a>
            <a href="${core.url("/pages/account/favorites.html")}">Favorilerim</a>
            <a href="${core.url("/pages/account/orders.html")}">Siparişlerim</a>
          </div>
          <div class="footer-col">
            <h3>Müşteri</h3>
            <a href="${core.url("/pages/company/hakkimizda.html")}">Hakkımızda</a>
            <a href="${core.url("/pages/company/iletisim.html")}">İletişim</a>
            <a href="${core.url("/pages/company/destek.html")}">Destek Merkezi</a>
            <a href="${core.url("/allonahub-akademi.html")}">AllonaHub Akademi</a>
            <a href="${core.url("/pages/account/belgeler.html")}">Belgelerim</a>
            <a href="${core.url("/pages/account/bildirimler.html")}">Bildirimler</a>
            <a href="${core.url("/pages/legal/teslimat-kargo.html")}">Teslimat ve Kargo</a>
            <a href="${core.url("/pages/legal/iade-politikasi.html")}">İade ve Cayma Hakkı</a>
          </div>
          <div class="footer-col">
            <h3>Ekosistem</h3>
            <a href="${core.url("/index.html#modules")}">Tüm Modüller</a>
            <a href="${core.url("/pages/partner/partner.html")}">Partner Başvurusu</a>
            <a href="${core.url("/pages/commerce/kuponlar.html")}">Kupon</a>
            <a href="${core.url("/pages/premium.html")}">Premium</a>
            <a href="${core.url("/pages/career/allonakariyer.html")}">Kariyer</a>
            <a href="${core.url("/pages/partner/partner-uyelik.html")}">Partner Üyelik</a>
          </div>
          <div class="footer-col">
            <h3>Yasal</h3>
            <a href="${core.url("/pages/legal/mesafeli-satis.html")}">Mesafeli Satış Sözleşmesi</a>
            <a href="${core.url("/pages/legal/on-bilgilendirme.html")}">Ön Bilgilendirme Formu</a>
            <a href="${core.url("/pages/legal/gizlilik.html")}">Gizlilik Politikası</a>
            <a href="${core.url("/pages/legal/kvkk.html")}">KVKK Aydınlatma Metni</a>
            <a href="${core.url("/pages/legal/cerez-politikasi.html")}">Çerez Politikası</a>
            <a href="${core.url("/pages/legal/kullanim-sartlari.html")}">Kullanım Şartları</a>
            <a href="${core.url("/pages/legal/guvenlik-politikasi.html")}">Güvenlik Politikası</a>
            <a href="${core.url("/pages/legal/etbis-guven-damgasi.html")}">ETBİS ve Güven Damgası</a>
          </div>
        </div>
        <div class="container social-icons" aria-label="AllonaHub sosyal medya bağlantıları">
          ${socials.map(([label, icon, href, className]) => `
            <a class="${className}" href="${href}" target="_blank" rel="noopener" aria-label="${label}">
              <b class="social-icon" aria-hidden="true">${socialIcon(icon)}</b>
              <span>${label}</span>
            </a>
          `).join("")}
        </div>
        <div class="container store-buttons" aria-label="AllonaHub mobil uygulama bağlantıları">
          <span class="store-btn store-btn--app" data-store-icon="A" role="group" aria-label="Mobil uygulama yakında: App Store" aria-disabled="true">
            <span class="store-btn__icon store-btn__icon--apple" aria-hidden="true">${storeIcon("apple")}</span>
            <span class="store-btn__text">
              <span class="store-btn__kicker">Mobil uygulama yakında</span>
              <strong>App Store</strong>
            </span>
          </span>
          <span class="store-btn store-btn--app" data-store-icon="G" role="group" aria-label="Mobil uygulama yakında: Google Play" aria-disabled="true">
            <span class="store-btn__icon store-btn__icon--play" aria-hidden="true">${storeIcon("play")}</span>
            <span class="store-btn__text">
              <span class="store-btn__kicker">Mobil uygulama yakında</span>
              <strong>Google Play</strong>
            </span>
          </span>
        </div>
        <div class="container footer-payment-strip" aria-label="AllonaHub güvenli ödeme altyapısı">
          <span>Güvenli ödeme altyapısı</span>
          <span class="footer-payment-badge">TROY</span>
          <span class="footer-payment-badge">Visa</span>
          <span class="footer-payment-badge">Mastercard</span>
          <span class="footer-payment-badge">AMEX</span>
        </div>
        <div class="container footer-bottom">
          <span>© ${year} AllonaHub. Tüm hakları saklıdır.</span>
          <span class="footer-bottom__links">
            <a href="${core.url("/pages/legal/kullanim-sartlari.html")}">Kullanım Şartları</a>
            <a href="${core.url("/pages/legal/gizlilik.html")}">Gizlilik Politikası</a>
            <a href="${core.url("/pages/legal/cerez-politikasi.html")}">Çerez Politikası</a>
            <a href="${core.url("/pages/legal/etbis-guven-damgasi.html")}">ETBİS/Güven</a>
          </span>
        </div>
      </footer>
    `;
  }

  async function updateAccountLink() {
    const link = document.querySelector("[data-account-link]");
    if (!link || !App.auth) return;
    const user = await App.auth.getUser();
    if (user) {
      link.href = core.url("/pages/account/user-panel.html");
      link.textContent = "Hesabım";
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

  async function updateNotificationCount() {
    const badges = document.querySelectorAll(".site-header [data-notification-count]");
    if (!badges.length) return;

    const setHidden = () => {
      badges.forEach((node) => {
        node.hidden = true;
        node.setAttribute("aria-hidden", "true");
        node.textContent = "";
      });
      document.querySelectorAll(".site-header [data-notification-link]").forEach((node) => {
        node.setAttribute("aria-label", "Bildirimler");
      });
    };

    setHidden();
    const helper = window.AllonaUserNotifications;
    if (!helper || typeof helper.load !== "function") return;

    try {
      const result = await helper.load();
      const count = Number(result && result.unreadCount);
      if (!Number.isFinite(count) || count <= 0) return;
      const label = `${count} okunmamış bildirim`;
      badges.forEach((node) => {
        node.textContent = count > 99 ? "99+" : String(count);
        node.hidden = false;
        node.removeAttribute("aria-hidden");
      });
      document.querySelectorAll(".site-header [data-notification-link]").forEach((node) => {
        node.setAttribute("aria-label", label);
      });
    } catch (error) {
      setHidden();
    }
  }

  function loadComplianceAudit() {
    if (App.complianceAudit || document.querySelector("script[data-compliance-audit]")) return;
    const script = document.createElement("script");
    script.src = core.url("/js/compliance-audit.js?v=20260621-legal1");
    script.defer = true;
    script.dataset.complianceAudit = "true";
    document.head.appendChild(script);
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

    document.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-site-search]");
      if (!form) return;
      event.preventDefault();
      const q = String(new FormData(form).get("q") || "").trim();
      if (!q) return;
      window.location.href = core.url(`/pages/search/arama.html?q=${encodeURIComponent(q)}`);
    });

    document.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-nav-toggle]");
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
      }
    });

    if (App.cart) App.cart.updateBadges();
    updateAccountLink();
    updateRemoteFavoriteCount();
    updateNotificationCount();
    loadComplianceAudit();
    document.dispatchEvent(new CustomEvent("allona:layout-ready"));
  }

  document.addEventListener("DOMContentLoaded", bindLayout);
})();
