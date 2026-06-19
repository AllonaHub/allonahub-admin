(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;

  function active(path) {
    const current = window.location.pathname.split("/").pop() || "index.html";
    return current === path ? 'aria-current="page"' : "";
  }

  function headerMarkup() {
    return `
      <div class="top-bar">
        <div class="container top-bar__inner">
          <span>AllonaHub güvenli alışveriş ve hizmet ekosistemi</span>
          <nav class="top-bar__links" aria-label="Üst bağlantılar">
            <a href="${core.url("bildirimler.html")}">Bildirimler</a>
            <a href="${core.url("orders.html")}">Siparişlerim</a>
            <a href="${core.url("addresses.html")}">Adreslerim</a>
            <a href="${core.url("favorites.html")}">Favorilerim</a>
          </nav>
        </div>
      </div>
      <header class="site-header">
        <div class="container header-main">
          <a class="brand" href="${core.url("index.html")}" aria-label="AllonaHub ana sayfa">
            <img src="${core.url("allona.logo.png")}" alt="AllonaHub Logo">
            <span class="logo-title"><span class="gold">Allona</span><span class="blue">Hub</span></span>
          </a>
          <form class="search-form" data-site-search>
            <input type="search" name="q" autocomplete="off" placeholder="Ürün, kategori, hizmet veya marka ara" aria-label="Ürün, kategori, hizmet veya marka ara">
            <button class="btn" type="submit">Ara</button>
          </form>
          <div class="header-actions">
            <a class="icon-btn" href="${core.url("bildirimler.html")}" aria-label="Bildirimler">
              🔔
            </a>
            <a class="icon-btn icon-btn--wide" href="${core.url("hubwallet.html")}" aria-label="Kupon">
              Kupon
            </a>
            <a class="icon-btn icon-btn--count icon-btn--favorite" href="${core.url("favorites.html")}" aria-label="Favoriler">
              <span class="header-action-icon header-action-icon--heart" aria-hidden="true">♥</span>
              <span class="badge" data-fav-count>0</span>
            </a>
            <a class="icon-btn icon-btn--count icon-btn--cart" href="${core.url("cart.html")}" aria-label="Sepet">
              <span class="header-action-icon header-action-icon--cart" aria-hidden="true"></span>
              <span class="badge" data-cart-count>0</span>
            </a>
            <a class="link-btn icon-btn--wide" href="${core.url("login.html")}" data-account-link>Giriş Yap</a>
            <span class="platform-controls-slot" data-platform-controls-slot></span>
            <button class="icon-btn mobile-nav-toggle" type="button" data-nav-toggle aria-label="Menüyü aç">☰</button>
          </div>
        </div>
        <div class="nav-row">
          <div class="container nav-row__inner">
            <nav class="nav-links" data-nav-links aria-label="Ana menü">
              <a href="${core.url("index.html")}" ${active("index.html")}>Vitrin</a>
              <a href="${core.url("ecosystem.html")}" ${active("ecosystem.html")}>Ekosistem</a>
              <a href="${core.url("shop.html")}" ${active("shop.html")}>Mağaza</a>
              <a href="${core.url("cart.html")}" ${active("cart.html")}>Sepet</a>
              <a href="${core.url("checkout.html")}" ${active("checkout.html")}>Ödeme</a>
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
            <a class="footer-brand" href="${core.url("index.html")}" aria-label="AllonaHub ana sayfa">
              <img src="${core.url("allona.logo.png")}" alt="AllonaHub Logo">
              <span class="logo-title"><span class="gold">Allona</span><span class="blue">Hub</span></span>
            </a>
            <p>Tek hesapla alışveriş, hizmet, partner, ödeme ve dijital çözümler.</p>
            <p>Allworksin Business Danışmanlık Tic. Ltd. Şti.</p>
            <p>İstanbul / Türkiye</p>
            <p>info@allonahub.com</p>
          </div>
          <div class="footer-col">
            <h3>Alışveriş</h3>
            <a href="${core.url("shop.html")}">Ürünler</a>
            <a href="${core.url("allonashop.html")}">Allona Shop</a>
            <a href="${core.url("allonayemek.html")}">Allona Yemek</a>
            <a href="${core.url("allonamarket.html")}">Allona Market</a>
            <a href="${core.url("kuponlar.html")}">Kuponlar</a>
            <a href="${core.url("favorites.html")}">Favorilerim</a>
            <a href="${core.url("orders.html")}">Siparişlerim</a>
          </div>
          <div class="footer-col">
            <h3>Müşteri</h3>
            <a href="${core.url("hakkimizda.html")}">Hakkımızda</a>
            <a href="${core.url("iletisim.html")}">İletişim</a>
            <a href="${core.url("destek.html")}">Destek Merkezi</a>
            <a href="${core.url("belgeler.html")}">Belgelerim</a>
            <a href="${core.url("bildirimler.html")}">Bildirimler</a>
            <a href="${core.url("teslimat-kargo.html")}">Teslimat ve Kargo</a>
            <a href="${core.url("iade-politikasi.html")}">İade ve Cayma Hakkı</a>
          </div>
          <div class="footer-col">
            <h3>Ekosistem</h3>
            <a href="${core.url("ecosystem.html#modules")}">Tüm Modüller</a>
            <a href="${core.url("partner.html")}">Partner Başvurusu</a>
            <a href="${core.url("hubwallet.html")}">Kupon</a>
            <a href="${core.url("premium.html")}">Premium</a>
            <a href="${core.url("allonakariyer.html")}">Kariyer</a>
            <a href="${core.url("partner-uyelik.html")}">Partner Üyelik</a>
          </div>
          <div class="footer-col">
            <h3>Yasal</h3>
            <a href="${core.url("mesafeli-satis.html")}">Mesafeli Satış Sözleşmesi</a>
            <a href="${core.url("on-bilgilendirme.html")}">Ön Bilgilendirme Formu</a>
            <a href="${core.url("gizlilik.html")}">Gizlilik Politikası</a>
            <a href="${core.url("kvkk.html")}">KVKK Aydınlatma Metni</a>
            <a href="${core.url("cerez-politikasi.html")}">Çerez Politikası</a>
            <a href="${core.url("kullanim-sartlari.html")}">Kullanım Şartları</a>
            <a href="${core.url("guvenlik-politikasi.html")}">Güvenlik Politikası</a>
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
            <img src="${core.url("images/payments/iyzico-pay-tr-colored-horizontal.svg")}" alt="iyzico ile öde" loading="lazy">
          </span>
        </div>
        <div class="container footer-bottom">
          <span>© ${year} AllonaHub. Tüm hakları saklıdır.</span>
          <span class="footer-bottom__links">
            <a href="${core.url("kullanim-sartlari.html")}">Kullanım Şartları</a>
            <a href="${core.url("gizlilik.html")}">Gizlilik Politikası</a>
            <a href="${core.url("cerez-politikasi.html")}">Çerez Politikası</a>
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
      link.href = core.url("profile.html");
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
      window.location.href = core.url(`shop.html?q=${encodeURIComponent(q)}`);
    });

    document.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-nav-toggle]");
      if (!toggle) return;
      const nav = document.querySelector("[data-nav-links]");
      if (nav) nav.classList.toggle("is-open");
    });

    if (App.cart) App.cart.updateBadges();
    updateAccountLink();
    updateRemoteFavoriteCount();
    document.dispatchEvent(new CustomEvent("allona:layout-ready"));
  }

  document.addEventListener("DOMContentLoaded", bindLayout);
})();
