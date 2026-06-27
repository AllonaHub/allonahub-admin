(function () {
  const state = {
    data: null,
    selectedMallId: null,
    query: "",
    city: "Tümü",
    category: "Tümü",
    cart: [],
    favorites: new Set(JSON.parse(localStorage.getItem("avmFavorites") || "[]")),
  };

  const formatCurrency = (value, currency = "TRY") =>
    new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);

  const byId = (id) => document.getElementById(id);

  function saveFavorites() {
    localStorage.setItem("avmFavorites", JSON.stringify([...state.favorites]));
  }

  function getSelectedMall() {
    return state.data.malls.find((mall) => mall.id === state.selectedMallId) || state.data.malls[0];
  }

  function getMallStores(mallId) {
    return state.data.stores.filter((store) => store.mallId === mallId);
  }

  function getMallProducts(mallId) {
    return state.data.products.filter((product) => product.mallId === mallId && product.status === "published");
  }

  function getFilteredMalls() {
    const query = state.query.trim().toLocaleLowerCase("tr-TR");
    return state.data.malls.filter((mall) => {
      const matchesQuery = !query || `${mall.name} ${mall.city} ${mall.district}`.toLocaleLowerCase("tr-TR").includes(query);
      const matchesCity = state.city === "Tümü" || mall.city === state.city;
      const stores = getMallStores(mall.id);
      const matchesCategory =
        state.category === "Tümü" ||
        stores.some((store) =>
          [store.category, store.type, store.mainCategory, ...(store.categoryPath || [])].includes(state.category)
        );
      return matchesQuery && matchesCity && matchesCategory;
    });
  }

  function renderFilters() {
    const cityFilter = byId("cityFilter");
    const categoryFilter = byId("categoryFilter");
    const cities = ["Tümü", ...new Set(state.data.malls.map((mall) => mall.city).sort((a, b) => a.localeCompare(b, "tr")))];
    const categorySource = state.data.allCategoryLabels || state.data.categories || [];
    const categories = ["Tümü", ...categorySource];

    cityFilter.innerHTML = cities
      .map((city) => `<option value="${city}" ${city === state.city ? "selected" : ""}>${city}</option>`)
      .join("");
    categoryFilter.innerHTML = categories
      .map((category) => `<option value="${category}" ${category === state.category ? "selected" : ""}>${category}</option>`)
      .join("");
  }

  function renderStats() {
    const mallCount = state.data.malls.length;
    const partnerCount = state.data.malls.filter((mall) => mall.partnerStatus === "partner-ready").length;
    byId("directoryCount").textContent = mallCount.toLocaleString("tr-TR");
    byId("partnerCount").textContent = partnerCount.toLocaleString("tr-TR");
    byId("productCount").textContent = state.data.products.length.toLocaleString("tr-TR");
    byId("storeCount").textContent = state.data.stores.length.toLocaleString("tr-TR");
  }

  function renderMallList() {
    const malls = getFilteredMalls();
    const list = byId("mallList");
    byId("resultCount").textContent = `${malls.length} AVM`;

    list.innerHTML = malls
      .map((mall) => {
        const stores = getMallStores(mall.id);
        const isSelected = mall.id === state.selectedMallId;
        const isFavorite = state.favorites.has(mall.id);
        return `
          <button class="mall-row ${isSelected ? "is-selected" : ""}" data-action="select-mall" data-id="${mall.id}">
            <span class="mall-row-main">
              <strong>${mall.name}</strong>
              <span>${mall.city} / ${mall.district}</span>
            </span>
            <span class="mall-row-meta">
              <span>${stores.length} kayıt</span>
              <span>${isFavorite ? "Favori" : mall.partnerStatus === "partner-ready" ? "Partner" : "Seed"}</span>
            </span>
          </button>
        `;
      })
      .join("");
  }

  function renderCampaigns(mallId) {
    const campaigns = state.data.campaigns.filter((campaign) => campaign.mallId === mallId);
    const container = byId("campaignStrip");

    container.innerHTML = campaigns.length
      ? campaigns
          .map(
            (campaign) => `
              <article class="info-tile">
                <span class="eyebrow">${campaign.status === "published" ? "Yayında" : "Onay bekliyor"}</span>
                <h3>${campaign.title}</h3>
                <p>${campaign.condition}</p>
                <small>${campaign.startsAt} - ${campaign.endsAt}</small>
              </article>
            `
          )
          .join("")
      : `<article class="empty-state">Bu AVM için aktif kampanya verisi henüz girilmedi.</article>`;
  }

  function renderStores(mallId) {
    const stores = getMallStores(mallId);
    const container = byId("storeStrip");

    container.innerHTML = stores.length
      ? stores
          .map(
            (store) => `
              <article class="store-card">
                <img src="${store.image}" alt="${store.name} mağaza görseli" loading="lazy">
                <div>
                  <span class="eyebrow">${store.category}</span>
                  <h3>${store.name}</h3>
                  <p>${store.floor} katı, ${store.unit} no. ${store.mainCategory || store.type || "Mağaza"}.</p>
                  <div class="rating-line">${renderRating(store.rating)} <span>${store.rating} (${store.reviewCount})</span></div>
                </div>
              </article>
            `
          )
          .join("")
      : `<article class="empty-state">Bu AVM için mağaza, işletme veya restoran kaydı henüz yok.</article>`;
  }

  function renderRating(value) {
    const rounded = Math.round(value);
    return `<span class="stars" aria-label="${value} puan">${"★".repeat(rounded)}${"☆".repeat(Math.max(0, 5 - rounded))}</span>`;
  }

  function renderProducts(mallId) {
    const products = getMallProducts(mallId);
    const container = byId("productRail");

    container.innerHTML = products.length
      ? products
          .map(
            (product) => `
              <article class="product-card">
                <div class="product-image">
                  <img src="${product.image}" alt="${product.name}" loading="lazy">
                  <span>${product.badge}</span>
                </div>
                <div class="product-body">
                  <span class="eyebrow">${product.mainCategory || product.category}</span>
                  <h3>${product.name}</h3>
                  <div class="rating-line">${renderRating(product.rating)} <span>${product.rating} (${product.reviewCount})</span></div>
                  <strong>${formatCurrency(product.price, product.currency)}</strong>
                  <div class="button-row">
                    <button class="secondary-button" data-action="add-cart" data-id="${product.id}">Sepete Ekle</button>
                    <button class="primary-button" data-action="buy-now" data-id="${product.id}">Hemen Al</button>
                  </div>
                </div>
              </article>
            `
          )
          .join("")
      : `<article class="empty-state wide">Ürünler yüklendiğinde bu alanda yatay kaydırmalı vitrin otomatik oluşur.</article>`;
  }

  function renderCoupons(mallId) {
    const coupons = state.data.coupons.filter((coupon) => coupon.mallId === mallId);
    const container = byId("couponStrip");

    container.innerHTML = coupons.length
      ? coupons
          .map((coupon) => {
            const usedRatio = Math.round((coupon.used / coupon.limit) * 100);
            return `
              <article class="info-tile">
                <span class="eyebrow">${coupon.code}</span>
                <h3>${coupon.title}</h3>
                <p>${coupon.used}/${coupon.limit} kullanım, ${coupon.expiresAt} son tarih.</p>
                <div class="progress"><span style="width:${usedRatio}%"></span></div>
              </article>
            `;
          })
          .join("")
      : `<article class="empty-state">Bu AVM için kupon tanımı yok.</article>`;
  }

  function renderReviews(mallId) {
    const reviews = state.data.reviews.filter((review) => review.mallId === mallId);
    const container = byId("reviewList");

    container.innerHTML = reviews.length
      ? reviews
          .map(
            (review) => `
              <article class="review-item">
                <div>${renderRating(review.rating)}</div>
                <p>${review.text}</p>
                <strong>${review.author}</strong>
              </article>
            `
          )
          .join("")
      : `<article class="empty-state">İlk değerlendirme geldiğinde burada görünecek.</article>`;
  }

  function renderCart() {
    const count = state.cart.reduce((total, item) => total + item.qty, 0);
    const total = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    byId("cartCount").textContent = count.toLocaleString("tr-TR");
    byId("cartTotal").textContent = formatCurrency(total || 0);
    byId("cartItems").innerHTML = state.cart.length
      ? state.cart
          .map(
            (item) => `
              <li>
                <span>${item.name}</span>
                <strong>${item.qty} x ${formatCurrency(item.price, item.currency)}</strong>
              </li>
            `
          )
          .join("")
      : `<li>Sepet boş. Ürünlerden "Sepete Ekle" ile başlayın.</li>`;
  }

  function renderDetail() {
    const mall = getSelectedMall();
    const stores = getMallStores(mall.id);
    const products = getMallProducts(mall.id);
    const isFavorite = state.favorites.has(mall.id);

    byId("selectedMallName").textContent = mall.name;
    byId("selectedMallLocation").textContent = `${mall.city} / ${mall.district}`;
    byId("selectedMallMeta").textContent = `${stores.length} mağaza ve işletme, ${products.length} ürün`;
    byId("selectedMallRating").innerHTML = `${renderRating(mall.rating)} <span>${mall.rating}</span>`;
    byId("favoriteMall").textContent = isFavorite ? "Favoriden Çıkar" : "Favoriye Al";
    byId("partnerLink").href = `partner.html?mall=${encodeURIComponent(mall.id)}`;
    byId("adminLink").href = `admin.html?mall=${encodeURIComponent(mall.id)}`;

    byId("serviceList").innerHTML = state.data.mallServices
      .map((service) => `<span class="service-pill">${service}</span>`)
      .join("");

    renderCampaigns(mall.id);
    renderStores(mall.id);
    renderProducts(mall.id);
    renderCoupons(mall.id);
    renderReviews(mall.id);
  }

  function addToCart(productId, immediate) {
    const product = state.data.products.find((item) => item.id === productId);
    if (!product) return;

    const existing = state.cart.find((item) => item.id === product.id);
    if (existing) {
      existing.qty += 1;
    } else {
      state.cart.push({ ...product, qty: 1 });
    }

    renderCart();
    byId("cartNotice").textContent = immediate
      ? `${product.name} hemen al akışına hazırlandı.`
      : `${product.name} sepete eklendi.`;
  }

  function bindEvents() {
    byId("searchInput").addEventListener("input", (event) => {
      state.query = event.target.value;
      renderMallList();
    });

    byId("cityFilter").addEventListener("change", (event) => {
      state.city = event.target.value;
      renderMallList();
    });

    byId("categoryFilter").addEventListener("change", (event) => {
      state.category = event.target.value;
      renderMallList();
    });

    byId("favoriteMall").addEventListener("click", () => {
      const mall = getSelectedMall();
      if (state.favorites.has(mall.id)) {
        state.favorites.delete(mall.id);
      } else {
        state.favorites.add(mall.id);
      }
      saveFavorites();
      renderMallList();
      renderDetail();
    });

    document.body.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-action]");
      if (!trigger) return;
      const action = trigger.dataset.action;
      const id = trigger.dataset.id;

      if (action === "select-mall") {
        state.selectedMallId = id;
        renderMallList();
        renderDetail();
        byId("mallDetail").scrollIntoView({ behavior: "smooth", block: "start" });
      }

      if (action === "add-cart") {
        addToCart(id, false);
      }

      if (action === "buy-now") {
        addToCart(id, true);
      }
    });

    byId("clearCart").addEventListener("click", () => {
      state.cart = [];
      byId("cartNotice").textContent = "Sepet temizlendi.";
      renderCart();
    });
  }

  async function init() {
    state.data = await window.AVMDataClient.loadAll();
    window.AVM_ACTIVE_DATA = state.data;
    const urlMall = new URLSearchParams(window.location.search).get("mall");
    state.selectedMallId =
      urlMall && state.data.malls.some((mall) => mall.id === urlMall) ? urlMall : state.data.malls[0].id;

    renderFilters();
    renderStats();
    renderMallList();
    renderDetail();
    renderCart();
    bindEvents();

    byId("dataSource").textContent = window.AVMDataClient.hasConfig()
      ? "Supabase bağlantısı aktif"
      : "Seed veri ile çalışıyor";

    if (window.ShopCategoryExperience) {
      window.ShopCategoryExperience.init();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
