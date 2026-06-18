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
          <span>Allona Shop güvenli alışveriş deneyimi</span>
          <nav class="top-bar__links" aria-label="Üst bağlantılar">
            <a href="${core.url("orders.html")}">Siparişlerim</a>
            <a href="${core.url("addresses.html")}">Adreslerim</a>
            <a href="${core.url("favorites.html")}">Favorilerim</a>
          </nav>
        </div>
      </div>
      <header class="site-header">
        <div class="container header-main">
          <a class="brand" href="${core.url("index.html")}" aria-label="Allona Shop ana sayfa">
            <img src="${core.url("images/allona-logo.svg")}" alt="Allona Shop">
            <span class="brand__name">Allona <span class="brand__accent">Shop</span></span>
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
    return `
      <footer class="site-footer">
        <div class="container footer-grid">
          <div class="footer-col">
            <h2>Allona Shop</h2>
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
        <div class="container footer-bottom">© ${year} Allona Shop. Tüm hakları saklıdır.</div>
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
