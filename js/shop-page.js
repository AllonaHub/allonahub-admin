(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  let products = [];
  const fallbackProducts = [
    {
      id: "demo-shop-01",
      name: "Allona Premium Kulaklık",
      description: "Günlük kullanım ve çalışma için yüksek konforlu kablosuz kulaklık.",
      category: "Teknoloji",
      brand: "Allona",
      price: 1299,
      stock: 24,
      sold_count: 186,
      rating: 4.8,
      discount: "%18",
      image_url: "/images/modules/teknoloji.png",
      created_at: "2026-06-15T09:00:00Z"
    },
    {
      id: "demo-shop-02",
      name: "Akıllı Market Sepeti",
      description: "Market alışverişi ve günlük ihtiyaçlar için avantajlı başlangıç paketi.",
      category: "Market",
      brand: "Allona Market",
      price: 849,
      stock: 42,
      sold_count: 244,
      rating: 4.7,
      discount: "%12",
      image_url: "/images/modules/market.png",
      created_at: "2026-06-14T09:00:00Z"
    },
    {
      id: "demo-shop-03",
      name: "Gold Üyelere Özel Paket",
      description: "HP avantajları, kampanya erişimi ve özel alışveriş ayrıcalıkları.",
      category: "Premium",
      brand: "AllonaHub",
      price: 229,
      stock: 99,
      sold_count: 391,
      rating: 4.9,
      discount: "HP+",
      image_url: "/images/modules/wallet.png",
      created_at: "2026-06-13T09:00:00Z"
    },
    {
      id: "demo-shop-04",
      name: "Ev Yaşam Temizlik Seti",
      description: "Ev hizmetleri kategorisinden seçili ürünlerle pratik bakım seti.",
      category: "Ev Hizmetleri",
      brand: "Allona",
      price: 399,
      stock: 31,
      sold_count: 128,
      rating: 4.6,
      discount: "%22",
      image_url: "/images/modules/evhizmetleri.png",
      created_at: "2026-06-12T09:00:00Z"
    },
    {
      id: "demo-shop-05",
      name: "Spor & Fitness Başlangıç",
      description: "Sağlıklı yaşam rutinine başlamak için seçili spor ekipmanları.",
      category: "Spor",
      brand: "Allona Spor",
      price: 699,
      stock: 18,
      sold_count: 96,
      rating: 4.5,
      discount: "Yeni",
      image_url: "/images/modules/sporfitnes.png",
      created_at: "2026-06-11T09:00:00Z"
    },
    {
      id: "demo-shop-06",
      name: "Allona Yemek Menü Fırsatı",
      description: "Restoran kampanyaları için avantajlı menü ve kupon paketi.",
      category: "Yemek",
      brand: "Allona Yemek",
      price: 289,
      stock: 60,
      sold_count: 318,
      rating: 4.8,
      discount: "%15",
      image_url: "/images/modules/yemek.png",
      created_at: "2026-06-10T09:00:00Z"
    },
    {
      id: "demo-shop-07",
      name: "Pet Bakım Avantaj Seti",
      description: "Evcil dostlar için bakım, sağlık ve günlük ihtiyaç seti.",
      category: "Evcil Hayvan",
      brand: "Allona Pet",
      price: 549,
      stock: 27,
      sold_count: 112,
      rating: 4.7,
      discount: "%10",
      image_url: "/images/modules/evcilhayvan.png",
      created_at: "2026-06-09T09:00:00Z"
    },
    {
      id: "demo-shop-08",
      name: "Seyahat Planlama Paketi",
      description: "Konaklama, ulaşım ve tur planlaması için premium keşif paketi.",
      category: "Seyahat",
      brand: "Allona Seyahat",
      price: 999,
      stock: 15,
      sold_count: 74,
      rating: 4.6,
      discount: "HP x2",
      image_url: "/images/modules/seyahat.png",
      created_at: "2026-06-08T09:00:00Z"
    }
  ].map(core.normalizeProduct);
  const fallbackHeroAds = [
    {
      title: "Premium pazar yeri deneyimi.",
      subtitle: "Allona Shop",
      campaign_text: "Yeni üyelere özel alışveriş fırsatları",
      description: "Seçili ürünleri güvenli ödeme, hızlı sepet ve HP avantajlarıyla keşfedin.",
      image_url: "/images/modules/allona-shop.png",
      cta_label: "Alışverişe Başla",
      link_url: "#featured-products"
    },
    {
      title: "Elektronikten ev yaşamına hızlı keşif.",
      subtitle: "Kategori Fırsatları",
      campaign_text: "Güncel stok ve fiyat altyapısı hazır",
      description: "Popüler kategoriler, kampanyalar ve güven veren ürün kartları tek vitrinde.",
      image_url: "/images/modules/shop.png",
      cta_label: "Kataloğu Aç",
      link_url: "/pages/commerce/shop.html"
    },
    {
      title: "Yeni gelen ürünleri yakalayın.",
      subtitle: "Teknoloji",
      campaign_text: "Favori, puanlama ve hızlı sepete ekle",
      description: "Elektronik, aksesuar ve dijital ürünler için dönüşüm odaklı vitrin yapısı.",
      image_url: "/images/modules/teknoloji.png",
      cta_label: "Teknolojiyi İncele",
      link_url: "/pages/commerce/shop.html?category=Teknoloji"
    },
    {
      title: "Market, bakım ve ev ihtiyaçları.",
      subtitle: "Günlük Alışveriş",
      campaign_text: "Mobilde yatay kaydırmalı kategori deneyimi",
      description: "Tek ekranda hızlı karar, net fiyat ve mobil öncelikli alışveriş akışı.",
      image_url: "/images/modules/market.png",
      cta_label: "Market Ürünleri",
      link_url: "/pages/commerce/shop.html?category=Market"
    },
    {
      title: "HP, kupon ve premium avantaj.",
      subtitle: "Kupon",
      campaign_text: "Premium üyeliklerle daha fazla kazanım",
      description: "Alışveriş motivasyonunu artıran sadakat, kupon ve üyelik alanlarıyla uyumlu.",
      image_url: "/images/modules/wallet.png",
      cta_label: "Kupona Git",
      link_url: "/pages/wallet/hubwallet.html"
    }
  ];

  function withTimeout(promise, timeoutMs) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error("Ürün sorgusu zaman aşımına uğradı.")), timeoutMs);
      })
    ]);
  }

  function filtersFromDom() {
    return {
      search: document.querySelector("[data-filter-search]")?.value || core.getParam("q") || "",
      category: document.querySelector("[data-filter-category]")?.value || "",
      minPrice: document.querySelector("[data-filter-min]")?.value || "",
      maxPrice: document.querySelector("[data-filter-max]")?.value || "",
      sort: document.querySelector("[data-filter-sort]")?.value || "newest"
    };
  }

  function applyLocalFilters() {
    const filters = filtersFromDom();
    const q = filters.search.trim().toLocaleLowerCase("tr-TR");
    const category = filters.category.trim().toLocaleLowerCase("tr-TR");
    const min = Number(filters.minPrice || 0);
    const max = Number(filters.maxPrice || 0);

    let list = products.filter((product) => {
      const text = `${product.name} ${product.description} ${product.category} ${product.brand || ""}`.toLocaleLowerCase("tr-TR");
      const searchOk = !q || text.includes(q);
      const categoryOk = !category || product.category.toLocaleLowerCase("tr-TR") === category;
      const minOk = !min || product.price >= min;
      const maxOk = !max || product.price <= max;
      return searchOk && categoryOk && minOk && maxOk;
    });

    if (filters.sort === "price_asc") list.sort((a, b) => a.price - b.price);
    else if (filters.sort === "price_desc") list.sort((a, b) => b.price - a.price);
    else if (filters.sort === "best_selling") list.sort((a, b) => b.sold_count - a.sold_count);
    else list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    return list;
  }

  function renderGrid(target, items) {
    const node = typeof target === "string" ? document.querySelector(target) : target;
    if (!node) return;
    const limit = Number(node.dataset.previewLimit || 0);
    const visibleItems = limit ? items.slice(0, limit) : items;
    if (!visibleItems.length) {
      node.innerHTML = `<div class="empty-state">Bu filtrelerle eşleşen aktif ürün bulunamadı.</div>`;
      return;
    }
    node.innerHTML = visibleItems.map(core.productCard).join("");
  }

  function renderCategoryOptions() {
    const select = document.querySelector("[data-filter-category]");
    if (!select) return;
    const categories = [...new Set(products.map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
    select.innerHTML = `<option value="">Tüm kategoriler</option>${categories.map((category) => `<option value="${core.escapeHTML(category)}">${core.escapeHTML(category)}</option>`).join("")}`;
  }

  function syncFiltersFromParams() {
    const searchInput = document.querySelector("[data-filter-search]");
    const categorySelect = document.querySelector("[data-filter-category]");
    const sortSelect = document.querySelector("[data-filter-sort]");
    const q = core.getParam("q");
    const category = core.getParam("category");
    const sort = core.getParam("sort");

    if (searchInput && q) searchInput.value = q;
    if (categorySelect && category) categorySelect.value = category;
    if (sortSelect && sort) sortSelect.value = sort;
  }

  function renderHomeSections() {
    renderGrid("[data-products-grid]", applyLocalFilters());
    renderGrid("[data-new-grid]", products.slice(0, 4));
    renderGrid("[data-best-grid]", [...products].sort((a, b) => b.sold_count - a.sold_count).slice(0, 4));
    renderGrid("[data-featured-grid]", products.filter((item) => item.stock > 0).slice(0, 4));
    renderGrid("[data-recommended-grid]", products.filter((item) => item.stock > 0).slice(4, 8));
  }

  function heroAdFromProduct(product) {
    const item = core.normalizeProduct(product);
    return {
      title: item.name,
      subtitle: item.brand || item.category || "Partner Ürünü",
      campaign_text: item.discount || item.discount_label || `${core.money(item.price)} / hızlı sepet`,
      description: item.description || "Partner ürününü AllonaShop vitrininde güvenli ödeme ve HP avantajıyla inceleyin.",
      image_url: item.image_url,
      cta_label: "Ürünü İncele",
      link_url: core.productUrl(item),
      source_id: item.id
    };
  }

  function heroAdFromRecord(ad) {
    const product = ad.product ? core.normalizeProduct(ad.product) : null;
    return {
      title: ad.title || product?.name || "Partner reklamı",
      subtitle: ad.subtitle || product?.brand || product?.category || "Günlük Partner Reklamı",
      campaign_text: ad.campaign_text || product?.discount || product?.discount_label || "Bugüne özel görünürlük",
      description: ad.description || product?.description || "Partner kampanyasını AllonaShop üst vitrinde keşfedin.",
      image_url: ad.image_url || product?.image_url || "/images/modules/allona-shop.png",
      cta_label: ad.cta_label || "İncele",
      link_url: ad.link_url || (product ? core.productUrl(product) : "/pages/commerce/shop.html"),
      source_id: ad.id || product?.id
    };
  }

  function uniqueAds(items) {
    const seen = new Set();
    return items.filter((item) => {
      const key = item.source_id || `${item.title}-${item.link_url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function loadHeroAds(productList) {
    let remoteAds = [];
    if (App.config?.partnerAdsEnabled) {
      try {
        remoteAds = await withTimeout(App.db?.ads?.shopHero(5) || Promise.resolve([]), 3000);
      } catch (error) {
        console.warn("Partner günlük reklamları yüklenemedi, ürün/fallback vitrini kullanılacak:", error.message || error);
      }
    }

    const partnerProducts = productList.filter((item) => item.partner_id).map(heroAdFromProduct);
    const popularProducts = [...productList].sort((a, b) => b.sold_count - a.sold_count).map(heroAdFromProduct);
    const ads = uniqueAds([
      ...remoteAds.map(heroAdFromRecord),
      ...partnerProducts,
      ...popularProducts,
      ...fallbackHeroAds
    ]);
    return ads.slice(0, 5);
  }

  function renderHeroAds(ads) {
    const slider = document.querySelector("[data-shop-promo-slider]");
    const track = slider?.querySelector("[data-shop-promo-track]");
    if (!slider || !track || !ads.length) return;
    track.innerHTML = ads.map((ad, index) => `
      <article class="shop-promo-slide ${index === 0 ? "is-active" : ""}" data-shop-promo-slide>
        <img src="${core.escapeHTML(core.sanitizeUrl(ad.image_url, "/images/modules/allona-shop.png"))}" alt="${core.escapeHTML(ad.title)}" loading="${index === 0 ? "eager" : "lazy"}">
        <div class="shop-promo-content">
          <p class="eyebrow">${core.escapeHTML(ad.subtitle)}</p>
          <h${index === 0 ? "1 id=\"hero-title\"" : "2"}>${core.escapeHTML(ad.title)}</h${index === 0 ? "1" : "2"}>
          <p>${core.escapeHTML(ad.description)}</p>
          <strong>${core.escapeHTML(ad.campaign_text)}</strong>
          <a class="btn" href="${core.escapeHTML(ad.link_url || "/pages/commerce/shop.html")}">${core.escapeHTML(ad.cta_label || "İncele")}</a>
        </div>
      </article>
    `).join("");
  }

  async function refreshHeroAds() {
    renderHeroAds(await loadHeroAds(products));
    initShopPromoSlider();
  }

  async function loadProducts() {
    const loadingTargets = ["[data-products-grid]", "[data-new-grid]", "[data-best-grid]", "[data-featured-grid]", "[data-recommended-grid]"];
    loadingTargets.forEach((target) => core.renderStatus(target, "Ürünler yükleniyor..."));

    try {
      const liveProducts = await withTimeout(App.db?.products?.listActive({ sort: "newest" }) || Promise.reject(new Error("Supabase ürün servisi hazır değil.")), 4500);
      products = liveProducts.length ? liveProducts : fallbackProducts;
      if (!liveProducts.length) {
        console.warn("Supabase products boş döndü, mağaza vitrin fallback ürünleri gösteriliyor.");
      }
      renderCategoryOptions();
      syncFiltersFromParams();
      renderHomeSections();
      await refreshHeroAds();
    } catch (error) {
      console.warn("Supabase products yüklenemedi, mağaza vitrin fallback ürünleri gösteriliyor:", error.message || error);
      products = fallbackProducts;
      renderCategoryOptions();
      syncFiltersFromParams();
      renderHomeSections();
      await refreshHeroAds();
    }
  }

  function bindFilters() {
    const form = document.querySelector("[data-product-filters]");
    if (!form) return;
    form.addEventListener("input", core.debounce(renderHomeSections, 160));
    form.addEventListener("change", renderHomeSections);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      renderHomeSections();
    });
    const reset = form.querySelector("[data-filter-reset]");
    if (reset) {
      reset.addEventListener("click", () => {
        form.reset();
        renderHomeSections();
      });
    }
  }

  function initShopPromoSlider() {
    const slider = document.querySelector("[data-shop-promo-slider]");
    if (!slider) return;
    if (slider.__shopPromoTimer) window.clearInterval(slider.__shopPromoTimer);
    const slides = [...slider.querySelectorAll("[data-shop-promo-slide]")];
    const dotsWrap = slider.querySelector("[data-shop-promo-dots]");
    const prev = slider.querySelector("[data-shop-promo-prev]");
    const next = slider.querySelector("[data-shop-promo-next]");
    if (!slides.length || !dotsWrap) return;

    let index = 0;

    function show(nextIndex) {
      index = (nextIndex + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => slide.classList.toggle("is-active", slideIndex === index));
      dotsWrap.querySelectorAll("button").forEach((dot, dotIndex) => dot.classList.toggle("is-active", dotIndex === index));
    }

    function restart() {
      window.clearInterval(slider.__shopPromoTimer);
      slider.__shopPromoTimer = window.setInterval(() => show(index + 1), 3000);
    }

    dotsWrap.innerHTML = "";
    slides.forEach((_, slideIndex) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", `${slideIndex + 1}. kampanyayı göster`);
      dot.addEventListener("click", () => {
        show(slideIndex);
        restart();
      });
      dotsWrap.appendChild(dot);
    });

    if (prev) {
      prev.onclick = () => {
        show(index - 1);
        restart();
      };
    }
    if (next) {
      next.onclick = () => {
        show(index + 1);
        restart();
      };
    }

    slider.onmouseenter = () => window.clearInterval(slider.__shopPromoTimer);
    slider.onmouseleave = restart;
    show(0);
    restart();
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.querySelector("[data-page='shop']")) return;
    bindFilters();
    initShopPromoSlider();
    loadProducts();
  });
})();
