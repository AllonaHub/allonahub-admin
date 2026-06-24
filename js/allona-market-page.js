(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const MARKET_SCOPE = "market";
  let products = [];
  let heroIndex = 0;
  let heroTimer;

  function withTimeout(promise, timeoutMs) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error("Market ürün sorgusu zaman aşımına uğradı.")), timeoutMs);
      })
    ]);
  }

  function isMarketProduct(product) {
    return App.catalog?.isMarketProduct ? App.catalog.isMarketProduct(product) : true;
  }

  function productText(product) {
    return `${product.name} ${product.description} ${product.category} ${product.brand || ""}`.toLocaleLowerCase("tr-TR");
  }

  function discountScore(product) {
    const compareAt = product.compare_at_price > product.price ? product.compare_at_price : Number(product.old_price || 0);
    if (!compareAt || compareAt <= product.price) return Number(product.discount_percent || 0);
    return Math.round(((compareAt - product.price) / compareAt) * 100);
  }

  function marketFiltersFromDom() {
    return {
      search: document.querySelector("[data-market-search]")?.value || core.getParam("q") || "",
      category: document.querySelector("[data-market-category]")?.value || "",
      sort: document.querySelector("[data-market-sort]")?.value || "newest",
      quick: document.querySelector("[data-market-quick]")?.value || ""
    };
  }

  function isFreshProduct(product) {
    return /kahvaltı|kahvalti|meyve|sebze|süt|sut|yumurta|kahve|zeytin|zeytinyağı|zeytinyagi/.test(productText(product));
  }

  function isHomeProduct(product) {
    return /temizlik|deterjan|kağıt|kagit|ev ihtiyaç|ev ihtiyac|mendil/.test(productText(product));
  }

  function isCareProduct(product) {
    return /bebek|kişisel|kisisel|bakım|bakim|mendil|hijyen/.test(productText(product));
  }

  function applyMarketFilters() {
    const filters = marketFiltersFromDom();
    const q = filters.search.trim().toLocaleLowerCase("tr-TR");
    const category = filters.category.trim().toLocaleLowerCase("tr-TR");

    const list = products.filter((product) => {
      const text = productText(product);
      const searchOk = !q || text.includes(q);
      const categoryOk = !category || product.category.toLocaleLowerCase("tr-TR") === category;
      const hasDeal = discountScore(product) > 0 || Boolean(product.discount_label || product.coupon_label);
      const fastDelivery = /hızlı|bugün|dakika|aynı gün/i.test(product.delivery_label || "") || product.stock >= 20;
      const quickOk = !filters.quick
        || (filters.quick === "deals" && hasDeal)
        || (filters.quick === "fast" && fastDelivery)
        || (filters.quick === "fresh" && isFreshProduct(product))
        || (filters.quick === "home" && isHomeProduct(product))
        || (filters.quick === "top" && (product.sold_count >= 150 || product.rating >= 4.8));
      return searchOk && categoryOk && quickOk;
    });

    if (filters.sort === "price_asc") list.sort((a, b) => a.price - b.price);
    else if (filters.sort === "price_desc") list.sort((a, b) => b.price - a.price);
    else if (filters.sort === "best_selling") list.sort((a, b) => b.sold_count - a.sold_count);
    else if (filters.sort === "discount_desc") list.sort((a, b) => discountScore(b) - discountScore(a));
    else list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    return list;
  }

  function renderRail(target, items, emptyMessage) {
    const node = typeof target === "string" ? document.querySelector(target) : target;
    if (!node) return;
    if (!items.length) {
      node.innerHTML = `<div class="empty-state">${core.escapeHTML(emptyMessage || "Bu bölümde gösterilecek market ürünü bulunamadı.")}</div>`;
      return;
    }
    node.innerHTML = items.map(core.productCard).join("");
  }

  function renderCount(items) {
    const node = document.querySelector("[data-market-count]");
    if (!node) return;
    const total = products.length;
    const count = items.length;
    node.textContent = total === count
      ? `${count} aktif Allona Market ürünü gösteriliyor.`
      : `${total} market ürünü içinde ${count} sonuç gösteriliyor.`;
  }

  function renderSourceNotice(state) {
    const node = document.querySelector("[data-market-source]");
    if (!node) return;
    if (state === "error") {
      node.textContent = "Canlı ürün kataloğu şu anda alınamadı. Lütfen kısa süre sonra tekrar deneyin.";
      return;
    }
    if (state === "empty") {
      node.textContent = "Allona Market için aktif Supabase ürünü bulunamadı.";
      return;
    }
    node.textContent = "Ürünler canlı Supabase kataloğundan çekildi.";
  }

  function renderCategoryOptions() {
    const select = document.querySelector("[data-market-category]");
    const strip = document.querySelector("[data-market-category-strip]");
    const categories = [...new Set(products.map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));

    if (select) {
      select.innerHTML = `<option value="">Tüm market kategorileri</option>${categories.map((category) => `<option value="${core.escapeHTML(category)}">${core.escapeHTML(category)}</option>`).join("")}`;
    }

    if (strip) {
      strip.innerHTML = [
        `<button class="market-category-chip is-active" type="button" data-market-chip="">Tümü</button>`,
        ...categories.map((category) => `<button class="market-category-chip" type="button" data-market-chip="${core.escapeHTML(category)}">${core.escapeHTML(category.replace("Market / ", ""))}</button>`)
      ].join("");
    }
  }

  function syncCategoryChips() {
    const current = document.querySelector("[data-market-category]")?.value || "";
    document.querySelectorAll("[data-market-chip]").forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.marketChip === current);
    });
  }

  function setQuickFilter(value) {
    const input = document.querySelector("[data-market-quick]");
    if (input) input.value = value || "";
    document.querySelectorAll("[data-market-quick-filter]").forEach((button) => {
      const active = Boolean(value) && button.dataset.marketQuickFilter === value;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function syncFiltersFromParams() {
    const searchInput = document.querySelector("[data-market-search]");
    const categorySelect = document.querySelector("[data-market-category]");
    const sortSelect = document.querySelector("[data-market-sort]");
    const q = core.getParam("q");
    const category = core.getParam("category");
    const sort = core.getParam("sort");
    const quick = core.getParam("quick");
    if (searchInput && q) searchInput.value = q;
    if (categorySelect && category) categorySelect.value = category;
    if (sortSelect && sort) sortSelect.value = sort;
    if (quick) setQuickFilter(quick);
  }

  function renderMarketSections() {
    const filtered = applyMarketFilters();
    const deals = [...filtered].sort((a, b) => discountScore(b) - discountScore(a)).slice(0, 12);
    const fresh = filtered.filter(isFreshProduct);
    const home = filtered.filter(isHomeProduct);
    const care = filtered.filter(isCareProduct);

    renderCount(filtered);
    renderRail("[data-market-all]", filtered, "Bu filtrelerle eşleşen Allona Market ürünü bulunamadı.");
    renderRail("[data-market-deals]", deals, "Bu filtrelerde kampanyalı market ürünü bulunamadı.");
    renderRail("[data-market-fresh]", fresh, "Bu filtrelerde taze reyon ürünü bulunamadı.");
    renderRail("[data-market-home]", home, "Bu filtrelerde ev ihtiyacı ürünü bulunamadı.");
    renderRail("[data-market-care]", care, "Bu filtrelerde bakım ürünü bulunamadı.");
    syncCategoryChips();
  }

  function setHeroSlide(nextIndex) {
    const slides = [...document.querySelectorAll("[data-market-slide]")];
    const dots = [...document.querySelectorAll("[data-market-dot]")];
    if (!slides.length) return;
    heroIndex = (nextIndex + slides.length) % slides.length;
    slides.forEach((slide, index) => slide.classList.toggle("is-active", index === heroIndex));
    dots.forEach((dot, index) => {
      dot.classList.toggle("is-active", index === heroIndex);
      dot.setAttribute("aria-current", index === heroIndex ? "true" : "false");
    });
  }

  function startHeroTimer() {
    window.clearInterval(heroTimer);
    heroTimer = window.setInterval(() => setHeroSlide(heroIndex + 1), 5200);
  }

  function bindHero() {
    const root = document.querySelector("[data-market-hero]");
    const slides = [...document.querySelectorAll("[data-market-slide]")];
    const dots = document.querySelector("[data-market-dots]");
    if (!root || !slides.length || !dots) return;

    dots.innerHTML = slides.map((_, index) => `<button class="${index === 0 ? "is-active" : ""}" type="button" data-market-dot="${index}" aria-label="${index + 1}. kampanyayı göster" ${index === 0 ? 'aria-current="true"' : ""}></button>`).join("");

    root.addEventListener("click", (event) => {
      const previous = event.target.closest("[data-market-prev]");
      const next = event.target.closest("[data-market-next]");
      const dot = event.target.closest("[data-market-dot]");
      if (previous) setHeroSlide(heroIndex - 1);
      if (next) setHeroSlide(heroIndex + 1);
      if (dot) setHeroSlide(Number(dot.dataset.marketDot || 0));
      if (previous || next || dot) startHeroTimer();
    });

    startHeroTimer();
  }

  function bindFilters() {
    const form = document.querySelector("[data-market-filters]");
    if (!form) return;

    form.addEventListener("input", core.debounce(renderMarketSections, 160));
    form.addEventListener("change", renderMarketSections);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      renderMarketSections();
    });
    form.addEventListener("click", (event) => {
      const quick = event.target.closest("[data-market-quick-filter]");
      if (!quick) return;
      const nextValue = quick.classList.contains("is-active") ? "" : quick.dataset.marketQuickFilter;
      setQuickFilter(nextValue);
      renderMarketSections();
    });

    form.querySelector("[data-market-reset]")?.addEventListener("click", () => {
      form.reset();
      setQuickFilter("");
      if (window.history && window.location.search) {
        window.history.replaceState(null, "", window.location.pathname);
      }
      renderMarketSections();
    });

    document.querySelector("[data-market-category-strip]")?.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-market-chip]");
      const select = document.querySelector("[data-market-category]");
      if (!chip || !select) return;
      select.value = chip.dataset.marketChip || "";
      renderMarketSections();
    });
  }

  async function loadProducts() {
    const targets = ["[data-market-all]", "[data-market-deals]", "[data-market-fresh]", "[data-market-home]", "[data-market-care]"];
    targets.forEach((target) => core.renderStatus(target, "Allona Market ürünleri yükleniyor..."));

    try {
      const remoteProducts = await withTimeout(App.db?.products?.listActive({ sort: "newest", scope: MARKET_SCOPE }) || Promise.reject(new Error("Supabase ürün servisi hazır değil.")), 5000);
      const liveProducts = (remoteProducts || []).filter(isMarketProduct);
      products = liveProducts.map(core.normalizeProduct);
      renderCategoryOptions();
      syncFiltersFromParams();
      renderSourceNotice(products.length ? "live" : "empty");
      renderMarketSections();
    } catch (error) {
      console.warn("Allona Market canlı katalog yüklenemedi; yalnızca canlı katalog kullanılacak:", error.message || error);
      products = [];
      renderCategoryOptions();
      syncFiltersFromParams();
      renderSourceNotice("error");
      renderMarketSections();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.querySelector("[data-page='allona-market']")) return;
    bindHero();
    bindFilters();
    loadProducts();
  });
})();
