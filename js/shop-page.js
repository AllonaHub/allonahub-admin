(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const MODULE_PARTNER_ADS_KEY = "allona.modulePartnerAds";
  let products = [];
  let heroAds = [];

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

  function categoryPreset() {
    const shell = document.querySelector(".site-shell[data-shop-category]");
    return shell?.dataset.shopCategory || "";
  }

  function filtersFromDom() {
    return {
      search: document.querySelector("[data-filter-search]")?.value || core.getParam("q") || "",
      category: document.querySelector("[data-filter-category]")?.value || core.getParam("category") || categoryPreset() || "",
      brand: document.querySelector("[data-filter-brand]")?.value || "",
      minPrice: document.querySelector("[data-filter-min]")?.value || "",
      maxPrice: document.querySelector("[data-filter-max]")?.value || "",
      sort: document.querySelector("[data-filter-sort]")?.value || "newest",
      quick: document.querySelector("[data-filter-quick]")?.value || ""
    };
  }

  function selectedCurrencyCode() {
    return String(App.currency?.state?.target || App.config?.currency || "TRY").toUpperCase();
  }

  function priceFilterToBase(value) {
    const amount = Number(value || 0);
    if (!amount) return 0;
    const state = App.currency?.state || {};
    const sourceCurrency = selectedCurrencyCode();
    const baseCurrency = String(state.base || App.config?.currency || "TRY").toUpperCase();
    if (sourceCurrency === baseCurrency || !App.currency?.toBase) return amount;
    const converted = App.currency.toBase(amount, sourceCurrency);
    return converted && converted.currency === baseCurrency ? Number(converted.amount || 0) : amount;
  }

  function updatePriceFilterCurrencyHints() {
    const code = selectedCurrencyCode();
    document.querySelectorAll("[data-filter-min], [data-filter-max]").forEach((input) => {
      const label = input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null;
      if (label) {
        if (!label.dataset.baseLabel) label.dataset.baseLabel = label.textContent.trim();
        label.textContent = `${label.dataset.baseLabel} (${code})`;
      }
      input.placeholder = code;
      input.setAttribute("aria-label", `${label?.dataset.baseLabel || "Fiyat"} (${code})`);
    });
  }

  function applyLocalFilters() {
    const filters = filtersFromDom();
    const q = filters.search.trim().toLocaleLowerCase("tr-TR");
    const category = filters.category.trim().toLocaleLowerCase("tr-TR");
    const brand = filters.brand.trim().toLocaleLowerCase("tr-TR");
    const min = priceFilterToBase(filters.minPrice);
    const max = priceFilterToBase(filters.maxPrice);

    let list = products.filter((product) => {
      const productCategory = core.labelFromValue ? core.labelFromValue(product.category, "") : String(product.category || "");
      const text = `${product.name} ${product.description} ${productCategory} ${product.brand || ""}`.toLocaleLowerCase("tr-TR");
      const searchOk = !q || text.includes(q);
      const categoryOk = !category || (App.shopCategories?.productMatchesCategory
        ? App.shopCategories.productMatchesCategory(product, filters.category)
        : productCategory.toLocaleLowerCase("tr-TR") === category);
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

  function resolveGridNode(target) {
    return typeof target === "string" ? document.querySelector(target) : target;
  }

  function loadingSkeletonMarkup(index) {
    return `
      <article class="shop-product-skeleton" aria-hidden="true">
        <div class="shop-product-skeleton__media">
          <span class="shop-loading-spinner" aria-hidden="true"></span>
        </div>
        <div class="shop-product-skeleton__body">
          <span style="--shop-skeleton-width:${68 + (index % 3) * 8}%"></span>
          <span style="--shop-skeleton-width:${82 - (index % 2) * 14}%"></span>
          <span style="--shop-skeleton-width:${46 + (index % 4) * 7}%"></span>
        </div>
      </article>
    `;
  }

  function renderLoadingGrid(target) {
    const node = resolveGridNode(target);
    if (!node) return;
    const count = Math.max(4, Math.min(8, Number(node.dataset.previewLimit || 6)));
    node.classList.add("is-shop-loading");
    node.setAttribute("aria-busy", "true");
    node.innerHTML = Array.from({ length: count }, (_, index) => loadingSkeletonMarkup(index)).join("");
  }

  function markImageLoaded(card) {
    card?.classList.remove("is-image-loading");
  }

  function prepareProductImages(node) {
    node.querySelectorAll(".product-card").forEach((card) => {
      const image = card.querySelector(".product-card__media img");
      if (!image) return;
      if (image.complete && image.naturalWidth > 0) {
        markImageLoaded(card);
        return;
      }
      card.classList.add("is-image-loading");
      image.addEventListener("load", () => markImageLoaded(card), { once: true });
      image.addEventListener("error", () => window.setTimeout(() => markImageLoaded(card), 450), { once: true });
      window.setTimeout(() => {
        if (image.complete) markImageLoaded(card);
      }, 12000);
    });
  }

  function renderGrid(target, items) {
    const node = resolveGridNode(target);
    if (!node) return;
    node.classList.remove("is-shop-loading");
    node.removeAttribute("aria-busy");
    const limit = Number(node.dataset.previewLimit || 0);
    const visibleItems = limit ? items.slice(0, limit) : items;
    if (!visibleItems.length) {
      node.innerHTML = `<div class="empty-state">Bu filtrelerle eşleşen aktif ürün bulunamadı.</div>`;
      return;
    }
    node.innerHTML = visibleItems.map(core.productCard).join("");
    prepareProductImages(node);
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
    const rawCategories = App.shopCategories?.categoryOptions
      ? App.shopCategories.categoryOptions(products)
      : [...new Set(products
        .map((product) => core.labelFromValue ? core.labelFromValue(product.category, "") : String(product.category || ""))
        .filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "tr"));
    const categories = rawCategories
      .map((category) => core.labelFromValue ? core.labelFromValue(category, "") : String(category || ""))
      .filter((category) => {
        const normalized = App.shopCategories?.normalizeText ? App.shopCategories.normalizeText(category) : category.toLocaleLowerCase("tr-TR");
        return category && category !== "[object Object]" && normalized !== "genel";
      });
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
    const category = core.getParam("category") || categoryPreset();
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

  function moduleAdMatchesShop(item) {
    if (!item) return false;
    if (item.moduleKey === "shop" || item.module_key === "shop") return true;
    const keys = item.moduleKeys || item.module_keys || [];
    if (Array.isArray(keys) && keys.includes("shop")) return true;
    return item.moduleKey === "all" || item.moduleKey === "*" || item.module_key === "all" || item.module_key === "*";
  }

  function isActiveModulePartnerAd(item) {
    if (!item || !(item.title || item.name) || !(item.image || item.image_url)) return false;
    const now = Date.now();
    const startsAt = item.startsAt || item.startDate || item.activeFrom || item.starts_at;
    const endsAt = item.endsAt || item.endDate || item.activeUntil || item.ends_at;
    const startTime = startsAt ? Date.parse(startsAt) : NaN;
    const endTime = endsAt ? Date.parse(endsAt) : NaN;
    if (Number.isFinite(startTime) && now < startTime) return false;
    if (Number.isFinite(endTime) && now > endTime) return false;
    return item.status !== "paused" && item.status !== "draft";
  }

  function rotateByModuleBannerRule(items) {
    if (!items.length) return [];
    const now = new Date();
    const dayKey = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
    const pool = items.slice().sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
    const selected = pool[Math.floor(dayKey / 180) % pool.length] || pool[dayKey % pool.length] || pool[0];
    return [selected, ...pool.filter((item) => item !== selected)];
  }

  function readShopModuleAdPool() {
    const pools = [];
    if (window.AllonaModuleAds) pools.push(window.AllonaModuleAds);
    if (window.AllonaPartnerAds) pools.push(window.AllonaPartnerAds);
    try {
      const raw = localStorage.getItem(MODULE_PARTNER_ADS_KEY);
      if (raw) pools.push(JSON.parse(raw));
    } catch (error) {
      // Optional partner ad data should never block the Shop catalog.
    }

    const ads = pools.flatMap((source) => {
      if (!source) return [];
      if (Array.isArray(source)) return source.filter(moduleAdMatchesShop);
      if (Array.isArray(source.shop)) return source.shop;
      return [];
    }).filter(isActiveModulePartnerAd);

    return rotateByModuleBannerRule(ads);
  }

  function safeAccent(value) {
    const raw = String(value || "").trim();
    if (/^#[\da-f]{3,8}$/i.test(raw)) return raw;
    if (/^rgba?\(/i.test(raw)) return raw;
    return "#00e5ff";
  }

  function heroHref(value) {
    const raw = String(value || "").trim();
    if (raw.startsWith("#")) return core.escapeHTML(raw);
    return core.escapeHTML(core.sanitizeUrl(raw, "/pages/commerce/shop.html"));
  }

  function heroAdFromProduct(product) {
    const item = core.normalizeProduct(product);
    const discountText = item.discount_label || (item.discount_percent ? `%${item.discount_percent} indirim` : "");
    const campaignText = discountText || item.delivery_label || `${core.money(item.price)} / hızlı sepet`;
    const meta = [
      item.seller_name,
      item.rating ? `${item.rating.toFixed(1)} puan` : "",
      item.stock > 0 ? `${item.stock} stok` : "Stok sinyali bekleniyor"
    ].filter(Boolean).join(" • ");

    return {
      title: item.name,
      subtitle: item.brand || item.category || "Partner Ürünü",
      campaign_text: campaignText,
      description: item.description || "Partner ürününü AllonaShop kataloğunda güvenli ödeme ve HP avantajıyla inceleyin.",
      image_url: item.image_url,
      cta_label: "Ürünü İncele",
      link_url: core.productUrl(item),
      source_id: item.id,
      price_label: core.money(item.price),
      meta_label: meta,
      accent: "#00e5ff"
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
      link_url: product ? core.productUrl(product) : (ad.link_url || "/pages/commerce/shop.html"),
      source_id: ad.id || product?.id,
      price_label: product ? core.money(product.price) : "",
      meta_label: product ? [product.seller_name, product.rating ? `${product.rating.toFixed(1)} puan` : ""].filter(Boolean).join(" • ") : "",
      accent: ad.accent || "#00e5ff"
    };
  }

  function heroAdFromModuleRecord(ad) {
    return {
      title: ad.title || ad.name || "Allona Shop",
      subtitle: ad.eyebrow || ad.label || "Günlük Vitrin",
      campaign_text: ad.campaign_text || ad.campaignText || ad.partnerTier || "Üst banner yayını",
      description: ad.sentence || ad.description || "Seçili ürün ve kampanyaları Allona Shop üst banner alanında keşfedin.",
      image_url: ad.image || ad.image_url || "/images/ads/hero-ad-shop.jpg",
      cta_label: ad.cta || ad.cta_label || "Alışverişe Git",
      link_url: ad.href || ad.url || ad.link_url || "/pages/commerce/shop.html",
      source_id: ad.id || ad.slug || ad.title || ad.name,
      price_label: ad.price_label || "",
      meta_label: ad.meta_label || ad.visibilityRule || ad.partnerVisibility || "",
      accent: safeAccent(ad.accent)
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
    const moduleAds = readShopModuleAdPool().map(heroAdFromModuleRecord);
    const ads = uniqueAds([
      ...moduleAds,
      ...scopedRemoteAds.map(heroAdFromRecord),
      ...partnerProducts,
      ...popularProducts
    ]);
    return ads.slice(0, 5);
  }

  function slideMarkup(ad, index) {
    const accent = safeAccent(ad.accent);
    const href = heroHref(ad.link_url || "/pages/commerce/shop.html");
    const title = ad.title || "Allona Shop ürünü";
    const description = core.truncate(ad.description || "Seçili ürünü Allona Shop kataloğunda inceleyin.", 132);
    const headingTag = index === 0 ? "h2" : "h3";
    return `
      <article class="shop-promo-slide ${index === 0 ? "is-active" : ""}" data-shop-promo-slide style="--module-ad-accent:${accent}">
        <img src="${core.escapeHTML(core.sanitizeUrl(ad.image_url, "/images/modules/allona-shop.png"))}" alt="${core.escapeHTML(title)}" loading="${index === 0 ? "eager" : "lazy"}">
        <div class="shop-promo-content">
          <p class="eyebrow">${core.escapeHTML(ad.subtitle || "Allona Shop")}</p>
          <${headingTag}>${core.escapeHTML(title)}</${headingTag}>
          <p>${core.escapeHTML(description)}</p>
          <div class="shop-promo-details">
            ${ad.price_label ? `<span class="shop-promo-price">${core.escapeHTML(ad.price_label)}</span>` : ""}
            ${ad.meta_label ? `<span class="shop-promo-meta">${core.escapeHTML(ad.meta_label)}</span>` : ""}
          </div>
          ${ad.price_label ? "" : `<strong>${core.escapeHTML(ad.campaign_text || "Bugünün öne çıkan ürünü")}</strong>`}
          <a class="btn" href="${href}">${core.escapeHTML(ad.cta_label || "Ürünü İncele")}</a>
        </div>
      </article>
    `;
  }

  function ensureShopPromoRail() {
    let section = document.querySelector("[data-shop-promo-rail]");
    if (!section) {
      section = document.createElement("section");
      section.className = "container shop-promo-section";
      section.dataset.shopPromoRail = "";
      section.setAttribute("aria-label", "Allona Shop ürün reklamları");
      section.innerHTML = `
        <div class="shop-promo-slider" data-shop-promo-slider aria-label="Allona Shop ürün reklamları">
          <button class="shop-promo-control shop-promo-control--prev" type="button" data-shop-promo-prev aria-label="Önceki ürün reklamı">‹</button>
          <div class="shop-promo-track" data-shop-promo-track></div>
          <button class="shop-promo-control shop-promo-control--next" type="button" data-shop-promo-next aria-label="Sonraki ürün reklamı">›</button>
          <div class="shop-promo-dots" data-shop-promo-dots aria-label="Ürün reklamı seçimi"></div>
        </div>
      `;
    }

    const moduleBanner = document.querySelector("[data-module-ad-banner][data-module-key='shop']");
    if (moduleBanner) {
      moduleBanner.insertAdjacentElement("afterend", section);
    } else {
      const main = document.querySelector(".site-main");
      main?.insertAdjacentElement("afterbegin", section);
    }
    return section;
  }

  function renderHeroAds(ads) {
    heroAds = ads;
    const section = ensureShopPromoRail();
    const slider = section?.querySelector("[data-shop-promo-slider]");
    const track = slider?.querySelector("[data-shop-promo-track]");
    if (!section || !slider || !track || !ads.length) {
      if (section) section.hidden = true;
      return;
    }
    section.hidden = false;
    track.innerHTML = ads.slice(0, 5).map(slideMarkup).join("");
    initShopPromoSlider(slider);
  }

  async function refreshHeroAds() {
    renderHeroAds(await loadHeroAds(products));
  }

  async function loadProducts() {
    const loadingTargets = ["[data-products-grid]", "[data-new-grid]", "[data-best-grid]", "[data-featured-grid]", "[data-recommended-grid]"];
    loadingTargets.forEach(renderLoadingGrid);

    try {
      const liveProducts = shopProductsOnly(await withTimeout(App.db?.products?.listActive({ sort: "newest", scope: "shop" }) || Promise.reject(new Error("Supabase ürün servisi hazır değil.")), 9000));
      products = liveProducts;
      if (!liveProducts.length) {
        console.warn("Supabase products aktif Allona Shop ürünü döndürmedi; yalnızca canlı katalog kullanılacak.");
      }
      renderCategoryOptions();
      renderBrandOptions();
      syncFiltersFromParams();
      updatePriceFilterCurrencyHints();
      renderHomeSections();
      await refreshHeroAds();
    } catch (error) {
      console.warn("Supabase products yüklenemedi; yalnızca canlı katalog kullanılacak:", error.message || error);
      products = [];
      renderCategoryOptions();
      renderBrandOptions();
      syncFiltersFromParams();
      updatePriceFilterCurrencyHints();
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
        updatePriceFilterCurrencyHints();
        renderHomeSections();
      });
    }
  }

  function initShopPromoSlider(scope) {
    const slider = scope?.matches?.("[data-shop-promo-slider]")
      ? scope
      : (scope || document).querySelector("[data-shop-promo-slider]");
    if (!slider) return;
    if (slider.__shopPromoTimer) window.clearInterval(slider.__shopPromoTimer);
    const slides = [...slider.querySelectorAll("[data-shop-promo-slide]")];
    const dotsWrap = slider.querySelector("[data-shop-promo-dots]");
    const prev = slider.querySelector("[data-shop-promo-prev]");
    const next = slider.querySelector("[data-shop-promo-next]");
    if (!slides.length) return;

    let index = 0;

    function show(nextIndex) {
      index = (nextIndex + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => slide.classList.toggle("is-active", slideIndex === index));
      dotsWrap?.querySelectorAll("button").forEach((dot, dotIndex) => dot.classList.toggle("is-active", dotIndex === index));
    }

    function restart() {
      window.clearInterval(slider.__shopPromoTimer);
      slider.__shopPromoTimer = window.setInterval(() => show(index + 1), 3000);
    }

    if (dotsWrap) {
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
    }

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
    document.addEventListener("allona:module-ad-banner-ready", (event) => {
      if (event.detail?.key === "shop" && heroAds.length) renderHeroAds(heroAds);
    });
    bindFilters();
    initShopPromoSlider();
    loadProducts();
    document.addEventListener("allona:currency-changed", () => {
      updatePriceFilterCurrencyHints();
      renderHomeSections();
    });
  });
})();
