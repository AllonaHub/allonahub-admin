(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  let products = [];

  function withTimeout(promise, timeoutMs) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error("Ürün sorgusu zaman aşımına uğradı.")), timeoutMs);
      })
    ]);
  }

  function isShopCatalogProduct(product) {
    return App.catalog?.isShopProduct ? App.catalog.isShopProduct(product) : true;
  }

  function shopProductsOnly(productList) {
    return (productList || []).filter(isShopCatalogProduct);
  }

  function filtersFromDom() {
    return {
      search: document.querySelector("[data-filter-search]")?.value || core.getParam("q") || "",
      category: document.querySelector("[data-filter-category]")?.value || "",
      brand: document.querySelector("[data-filter-brand]")?.value || "",
      minPrice: document.querySelector("[data-filter-min]")?.value || "",
      maxPrice: document.querySelector("[data-filter-max]")?.value || "",
      sort: document.querySelector("[data-filter-sort]")?.value || "newest",
      quick: document.querySelector("[data-filter-quick]")?.value || ""
    };
  }

  function applyLocalFilters() {
    const filters = filtersFromDom();
    const q = filters.search.trim().toLocaleLowerCase("tr-TR");
    const category = filters.category.trim().toLocaleLowerCase("tr-TR");
    const brand = filters.brand.trim().toLocaleLowerCase("tr-TR");
    const min = Number(filters.minPrice || 0);
    const max = Number(filters.maxPrice || 0);

    let list = products.filter((product) => {
      const text = `${product.name} ${product.description} ${product.category} ${product.brand || ""}`.toLocaleLowerCase("tr-TR");
      const searchOk = !q || text.includes(q);
      const categoryOk = !category || product.category.toLocaleLowerCase("tr-TR") === category;
      const brandOk = !brand || String(product.brand || "").toLocaleLowerCase("tr-TR") === brand;
      const minOk = !min || product.price >= min;
      const maxOk = !max || product.price <= max;
      const hasDiscount = product.discount_percent > 0 || product.compare_at_price > product.price || Boolean(product.discount_label);
      const hasCoupon = Boolean(product.coupon_label || (hasDiscount && product.discount_percent >= 10));
      const fastDelivery = /hızlı|bugün|aynı gün|dijital/i.test(product.delivery_label || "") || product.stock >= 20;
      const freeShipping = product.price >= Number(App.config?.freeShippingThreshold || 1500) || /ücretsiz/i.test(product.delivery_label || "");
      const quickOk = !filters.quick
        || (filters.quick === "deals" && hasDiscount)
        || (filters.quick === "coupon" && hasCoupon)
        || (filters.quick === "fast" && fastDelivery)
        || (filters.quick === "free_shipping" && freeShipping)
        || (filters.quick === "top" && (product.sold_count >= 100 || product.rating >= 4.7));
      return searchOk && categoryOk && brandOk && minOk && maxOk && quickOk;
    });

    if (filters.sort === "price_asc") list.sort((a, b) => a.price - b.price);
    else if (filters.sort === "price_desc") list.sort((a, b) => b.price - a.price);
    else if (filters.sort === "best_selling") list.sort((a, b) => b.sold_count - a.sold_count);
    else if (filters.sort === "rating_desc") list.sort((a, b) => b.rating - a.rating);
    else if (filters.sort === "discount_desc") list.sort((a, b) => {
      const discountA = a.discount_percent || (a.compare_at_price > a.price ? Math.round(((a.compare_at_price - a.price) / a.compare_at_price) * 100) : 0);
      const discountB = b.discount_percent || (b.compare_at_price > b.price ? Math.round(((b.compare_at_price - b.price) / b.compare_at_price) * 100) : 0);
      return discountB - discountA;
    });
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

  function renderProductCount(items) {
    const node = document.querySelector("[data-product-count]");
    if (!node) return;
    const total = products.length;
    const count = items.length;
    node.textContent = total === count
      ? `${count} aktif ürün gösteriliyor.`
      : `${total} aktif ürün içinde ${count} sonuç gösteriliyor.`;
  }

  function renderCategoryOptions() {
    const select = document.querySelector("[data-filter-category]");
    if (!select) return;
    const categories = [...new Set(products.map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
    select.innerHTML = `<option value="">Tüm kategoriler</option>${categories.map((category) => `<option value="${core.escapeHTML(category)}">${core.escapeHTML(category)}</option>`).join("")}`;
  }

  function renderBrandOptions() {
    const select = document.querySelector("[data-filter-brand]");
    if (!select) return;
    const brands = [...new Set(products.map((product) => product.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
    select.innerHTML = `<option value="">Tüm markalar</option>${brands.map((brand) => `<option value="${core.escapeHTML(brand)}">${core.escapeHTML(brand)}</option>`).join("")}`;
  }

  function setQuickFilter(value) {
    const input = document.querySelector("[data-filter-quick]");
    if (input) input.value = value || "";
    document.querySelectorAll("[data-quick-filter]").forEach((button) => {
      button.classList.toggle("is-active", Boolean(value) && button.dataset.quickFilter === value);
      button.setAttribute("aria-pressed", Boolean(value) && button.dataset.quickFilter === value ? "true" : "false");
    });
  }

  function syncFiltersFromParams() {
    const searchInput = document.querySelector("[data-filter-search]");
    const categorySelect = document.querySelector("[data-filter-category]");
    const brandSelect = document.querySelector("[data-filter-brand]");
    const sortSelect = document.querySelector("[data-filter-sort]");
    const q = core.getParam("q");
    const category = core.getParam("category");
    const brand = core.getParam("brand");
    const sort = core.getParam("sort");
    const quick = core.getParam("quick");

    if (searchInput && q) searchInput.value = q;
    if (categorySelect && category) categorySelect.value = category;
    if (brandSelect && brand) brandSelect.value = brand;
    if (sortSelect && sort) sortSelect.value = sort;
    if (quick) setQuickFilter(quick);
  }

  function renderHomeSections() {
    const filteredProducts = applyLocalFilters();
    renderProductCount(filteredProducts);
    renderGrid("[data-products-grid]", filteredProducts);
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
      description: item.description || "Partner ürününü AllonaShop kataloğunda güvenli ödeme ve HP avantajıyla inceleyin.",
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
      description: ad.description || product?.description || "Partner kampanyasını AllonaShop üst kataloğunda keşfedin.",
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
        console.warn("Partner günlük reklamları yüklenemedi; canlı ürün kampanyaları kullanılacak:", error.message || error);
      }
    }

    const scopedRemoteAds = remoteAds.filter((ad) => !ad.product || isShopCatalogProduct(ad.product));
    const partnerProducts = productList.filter((item) => item.partner_id && isShopCatalogProduct(item)).map(heroAdFromProduct);
    const popularProducts = [...productList].sort((a, b) => b.sold_count - a.sold_count).map(heroAdFromProduct);
    const ads = uniqueAds([
      ...scopedRemoteAds.map(heroAdFromRecord),
      ...partnerProducts,
      ...popularProducts
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
      const liveProducts = shopProductsOnly(await withTimeout(App.db?.products?.listActive({ sort: "newest", scope: "shop" }) || Promise.reject(new Error("Supabase ürün servisi hazır değil.")), 4500));
      products = liveProducts;
      if (!liveProducts.length) {
        console.warn("Supabase products aktif Allona Shop ürünü döndürmedi; yalnızca canlı katalog kullanılacak.");
      }
      renderCategoryOptions();
      renderBrandOptions();
      syncFiltersFromParams();
      renderHomeSections();
      await refreshHeroAds();
    } catch (error) {
      console.warn("Supabase products yüklenemedi; yalnızca canlı katalog kullanılacak:", error.message || error);
      products = [];
      renderCategoryOptions();
      renderBrandOptions();
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
    form.addEventListener("click", (event) => {
      const quick = event.target.closest("[data-quick-filter]");
      if (!quick) return;
      const nextValue = quick.classList.contains("is-active") ? "" : quick.dataset.quickFilter;
      setQuickFilter(nextValue);
      renderHomeSections();
    });
    const reset = form.querySelector("[data-filter-reset]");
    if (reset) {
      reset.addEventListener("click", () => {
        form.reset();
        setQuickFilter("");
        if (window.history && window.location.search) {
          window.history.replaceState(null, "", window.location.pathname);
        }
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
