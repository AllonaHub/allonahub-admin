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
            <span class="brand__name"><span class="brand__allona">Allona</span><span class="brand__hub">Hub</span></span>
          </a>
          <form class="search-form" data-site-search>
            <input type="search" name="q" autocomplete="off" placeholder="Ürün, kategori veya marka ara" aria-label="Ürün ara">
            <button class="btn" type="submit">Ara</button>
          </form>
          <div class="header-actions">
            <a class="icon-btn" href="${core.url("favorites.html")}" aria-label="Favoriler">
              ♡ <span class="badge" data-fav-count>0</span>
            </a>
            <a class="icon-btn" href="${core.url("cart.html")}" aria-label="Sepet">
              🛒 <span class="badge" data-cart-count>0</span>
            </a>
            <a class="link-btn icon-btn--wide" href="${core.url("login.html")}" data-account-link>Hesabım</a>
            <button class="icon-btn mobile-nav-toggle" type="button" data-nav-toggle aria-label="Menüyü aç">☰</button>
          </div>
        </div>
        <div class="nav-row">
          <div class="container nav-row__inner">
            <nav class="nav-links" data-nav-links aria-label="Ana menü">
              <a href="${core.url("index.html")}" ${active("index.html")}>Vitrin</a>
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
              <span><span class="brand__allona">Allona</span><span class="brand__hub">Hub</span></span>
            </a>
            <p>Allworksin Business Danışmanlık Tic. Ltd. Şti.</p>
            <p>İstanbul / Türkiye</p>
            <p>allonahub@gmail.com</p>
          </div>
          <div class="footer-col">
            <h3>Mağaza</h3>
            <a href="${core.url("shop.html")}">Ürünler</a>
            <a href="${core.url("favorites.html")}">Favorilerim</a>
            <a href="${core.url("orders.html")}">Siparişlerim</a>
          </div>
          <div class="footer-col">
            <h3>Müşteri</h3>
            <a href="${core.url("hakkimizda.html")}">Hakkımızda</a>
            <a href="${core.url("iletisim.html")}">İletişim</a>
            <a href="${core.url("teslimat-kargo.html")}">Teslimat ve Kargo</a>
            <a href="${core.url("iade-politikasi.html")}">İade ve Cayma Hakkı</a>
          </div>
          <div class="footer-col">
            <h3>Yasal</h3>
            <a href="${core.url("mesafeli-satis.html")}">Mesafeli Satış Sözleşmesi</a>
            <a href="${core.url("on-bilgilendirme.html")}">Ön Bilgilendirme Formu</a>
            <a href="${core.url("gizlilik.html")}">Gizlilik Politikası</a>
            <a href="${core.url("kvkk.html")}">KVKK Aydınlatma Metni</a>
            <a href="${core.url("cerez.html")}">Çerez Politikası</a>
            <a href="${core.url("kullanim-sartlari.html")}">Kullanım Şartları</a>
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
  }

  document.addEventListener("DOMContentLoaded", bindLayout);
})();
