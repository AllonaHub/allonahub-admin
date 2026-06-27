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
            <a class="icon-btn icon-btn--count" href="${core.url("/pages/account/bildirimler.html")}" aria-label="Bildirimler">
              🔔 <span class="badge" data-notification-count>0</span>
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
      ["WhatsApp", "WA", "https://wa.me/905427781868", "wa"],
      ["Instagram", "IG", "https://www.instagram.com/allonahub", "ig"],
      ["X", "X", "https://x.com/allonahub", "x"],
      ["Facebook", "f", "https://www.facebook.com/allonahub", "fb"],
      ["YouTube", "yt", "https://www.youtube.com/@allonahub", "yt"],
      ["LinkedIn", "in", "https://www.linkedin.com/company/allonahub", "li"],
      ["Telegram", "tg", "https://t.me/allonahub", "tg"],
      ["TikTok", "tk", "https://www.tiktok.com/@allonahub", "tk"],
      ["E-Mail", "@", "mailto:info@allonahub.com", "mail"]
    ];
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
            <h3>Yasal</h3>
            <a href="${core.url("/pages/legal/mesafeli-satis.html")}">Mesafeli Satış Sözleşmesi</a>
            <a href="${core.url("/pages/legal/on-bilgilendirme.html")}">Ön Bilgilendirme Formu</a>
            <a href="${core.url("/pages/legal/gizlilik.html")}">Gizlilik Politikası</a>
            <a href="${core.url("/pages/legal/kvkk.html")}">KVKK Aydınlatma Metni</a>
            <a href="${core.url("/pages/legal/cerez-politikasi.html")}">Çerez Politikası</a>
            <a href="${core.url("/pages/legal/kullanim-sartlari.html")}">Kullanım Şartları</a>
            <a href="${core.url("/pages/legal/guvenlik-politikasi.html")}">Güvenlik Politikası</a>
            <a href="${core.url("/pages/legal/teslimat-kargo.html")}">Teslimat ve Kargo</a>
            <a href="${core.url("/pages/legal/iade-politikasi.html")}">İade ve Cayma Hakkı</a>
          </div>
          <div class="footer-col">
            <h3>Müşteri</h3>
            <a href="${core.url("/pages/partner/partner.html")}">Partner Başvurusu</a>
            <a href="${core.url("/pages/commerce/kuponlar.html")}">Kupon</a>
            <a href="${core.url("/pages/account/premium.html")}">Premium</a>
            <a href="${core.url("/pages/career/allonakariyer.html")}">Kariyer</a>
            <a href="${core.url("/pages/partner/partner-uyelik.html")}">Partner Üyelik</a>
            <a href="${core.url("/pages/partner/kurucu-uyelik.html")}">Kurucu Üyelik</a>
            <a href="${core.url("/pages/account/belgeler.html")}">Belgelerim</a>
            <a href="${core.url("/pages/account/bildirimler.html")}">Bildirimler</a>
          </div>
          <div class="footer-col">
            <h3>Ekosistem</h3>
            <a href="${core.url("/index.html#modules")}">Tüm Modüller</a>
            <a href="${core.url("/pages/company/hakkimizda.html#top")}">Hakkımızda</a>
            <a href="${core.url("/pages/company/iletisim.html")}">İletişim</a>
            <a href="${core.url("/pages/company/destek.html")}">Destek Merkezi</a>
            <a href="${core.url("/allonahub-akademi.html")}">AllonaHub Akademi</a>
            <a href="${core.url("/pages/wallet/hp-nedir.html")}">HP Dünyası</a>
          </div>
        </div>
        <div class="container social-icons" aria-label="AllonaHub sosyal medya bağlantıları">
          ${socials.map(([label, icon, href, className]) => `
            <a class="${className}" href="${href}" target="_blank" rel="noopener" aria-label="${label}">
              <b>${icon}</b>
              <span>${label}</span>
            </a>
          `).join("")}
        </div>
        <div class="container store-buttons" aria-label="AllonaHub mobil uygulama bağlantıları">
          <a href="https://www.apple.com/app-store/" class="store-btn store-btn--app" data-store-icon="A" target="_blank" rel="noopener" aria-label="App Store'dan indir">
            <span class="store-btn__text">
              <span class="store-btn__kicker">Download on the</span>
              <strong>App Store</strong>
            </span>
          </a>
          <a href="https://play.google.com/store" class="store-btn store-btn--app" data-store-icon="G" target="_blank" rel="noopener" aria-label="Google Play'den indir">
            <span class="store-btn__text">
              <span class="store-btn__kicker">GET IT ON</span>
              <strong>Google Play</strong>
            </span>
          </a>
        </div>
        <div class="container footer-payment-strip" aria-label="AllonaHub güvenli ödeme altyapısı">
          <span>Güvenli ödeme altyapısı</span>
          <span class="footer-iyzico-badge">
            <img src="${core.url("/images/payments/iyzico-pay-tr-colored-horizontal.svg")}" alt="iyzico ile öde" loading="lazy">
          </span>
        </div>
        <div class="container footer-bottom">
          <span>© ${year} AllonaHub. Tüm hakları saklıdır.</span>
          <span class="footer-bottom__links">
            <a href="${core.url("/pages/legal/kullanim-sartlari.html")}">Kullanım Şartları</a>
            <a href="${core.url("/pages/legal/gizlilik.html")}">Gizlilik Politikası</a>
            <a href="${core.url("/pages/legal/cerez-politikasi.html")}">Çerez Politikası</a>
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
      const q = new FormData(form).get("q") || "";
      const target = document.querySelector("[data-page='allona-market']")
        ? "/pages/commerce/allonamarket.html"
        : "/pages/commerce/shop.html";
      window.location.href = core.url(`${target}?q=${encodeURIComponent(q)}`);
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
    loadComplianceAudit();
    document.dispatchEvent(new CustomEvent("allona:layout-ready"));
  }

  document.addEventListener("DOMContentLoaded", bindLayout);
})();
