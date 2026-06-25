(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const MARKET_SCOPE = "market";
  const fallbackProducts = [
    {
      id: "c00e8a56-048b-46a5-bb95-ca7653cc2625",
      name: "Allona Market Taze Sebze Paketi",
      description: "Günlük seçilmiş domates, salatalık, biber, yeşillik ve mevsim sebzeleriyle hızlı teslimata uygun market paketi.",
      category: "Market / Meyve Sebze",
      brand: "Allona Market",
      price: 349.9,
      old_price: 429.9,
      stock: 42,
      sold_count: 215,
      rating: 4.8,
      coupon_label: "Sepette fırsat",
      delivery_label: "Hızlı teslimat",
      image_url: "/images/modules/market-light-v5.jpg",
      module_key: MARKET_SCOPE,
      sku: "ALM-SEBZE-001",
      status: "active"
    },
    {
      id: "d442494b-a405-40d0-9fe1-1f96cf54397a",
      name: "Günlük Süt 1 L",
      description: "Kahvaltı ve günlük kullanım için soğuk zincire uygun, taze içimlik süt.",
      category: "Market / Kahvaltı",
      brand: "Allona Market",
      price: 39.9,
      old_price: 49.9,
      stock: 80,
      sold_count: 328,
      rating: 4.9,
      coupon_label: "Kahvaltı kuponu",
      delivery_label: "Bugün teslim",
      image_url: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=900&q=80",
      module_key: MARKET_SCOPE,
      sku: "ALM-SUT-001",
      status: "active"
    },
    {
      id: "828706bc-f000-4ece-ba69-ffd602c172b9",
      name: "Gezen Tavuk Yumurtası 15'li",
      description: "Kahvaltı, hamur işi ve günlük mutfak kullanımı için 15'li ekonomik yumurta paketi.",
      category: "Market / Kahvaltı",
      brand: "Allona Market",
      price: 129.9,
      old_price: 159.9,
      stock: 64,
      sold_count: 188,
      rating: 4.7,
      coupon_label: "Aile paketi",
      delivery_label: "Hızlı teslimat",
      image_url: "https://images.unsplash.com/photo-1587486913049-53fc88980cfc?auto=format&fit=crop&w=900&q=80",
      module_key: MARKET_SCOPE,
      sku: "ALM-YUMURTA-001",
      status: "active"
    },
    {
      id: "f58f1a4e-5c50-4d11-8ff7-d50cb7564eee",
      name: "Mevsim Meyve Sepeti",
      description: "Elma, muz, portakal ve mevsim meyvelerinden oluşan sunuma hazır taze paket.",
      category: "Market / Meyve Sebze",
      brand: "Allona Market",
      price: 319.9,
      old_price: 389.9,
      stock: 38,
      sold_count: 204,
      rating: 4.8,
      coupon_label: "Taze reyon",
      delivery_label: "Bugün teslim",
      image_url: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=900&q=80",
      module_key: MARKET_SCOPE,
      sku: "ALM-MEYVE-001",
      status: "active"
    },
    {
      id: "20f50397-8cb0-4fb2-93e8-1bf47132753d",
      name: "Allona Türk Kahvesi 250 g",
      description: "Yoğun aromalı, taze çekilmiş kahve keyfi için ekonomik paket.",
      category: "Market / Kahvaltı",
      brand: "Allona Market",
      price: 119.9,
      old_price: 149.9,
      stock: 55,
      sold_count: 241,
      rating: 4.9,
      coupon_label: "Sepette %5",
      delivery_label: "Hızlı teslimat",
      image_url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=80",
      module_key: MARKET_SCOPE,
      sku: "ALM-KAHVE-001",
      status: "active"
    },
    {
      id: "21ae8de4-2ec5-460d-bf6d-e1f73e4ea0a6",
      name: "Natürel Sızma Zeytinyağı 1 L",
      description: "Salata, kahvaltı ve günlük yemekler için natürel sızma zeytinyağı.",
      category: "Market / Temel Gıda",
      brand: "Allona Market",
      price: 399.9,
      old_price: 469.9,
      stock: 34,
      sold_count: 176,
      rating: 4.8,
      coupon_label: "Temel gıda",
      delivery_label: "Bugün teslim",
      image_url: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=900&q=80",
      module_key: MARKET_SCOPE,
      sku: "ALM-ZEYTINYAGI-001",
      status: "active"
    },
    {
      id: "a62c4fcc-48d1-470c-85c9-07ac9165c4d2",
      name: "Makarna ve Domates Sos Paketi",
      description: "Hızlı akşam yemeği için makarna ve sos ikili avantaj paketi.",
      category: "Market / Temel Gıda",
      brand: "Allona Market",
      price: 119.9,
      old_price: 149.9,
      stock: 90,
      sold_count: 267,
      rating: 4.7,
      coupon_label: "Akşam paketi",
      delivery_label: "Hızlı teslimat",
      image_url: "https://images.unsplash.com/photo-1556761223-4c4282c73f77?auto=format&fit=crop&w=900&q=80",
      module_key: MARKET_SCOPE,
      sku: "ALM-MAKARNA-001",
      status: "active"
    },
    {
      id: "8e8b1e1c-546f-48ae-afa8-3889e390dcb4",
      name: "Doğal Kaynak Suyu 6 x 1.5 L",
      description: "Ev ve ofis kullanımı için altılı doğal kaynak suyu paketi.",
      category: "Market / İçecek",
      brand: "Allona Market",
      price: 79.9,
      old_price: 99.9,
      stock: 120,
      sold_count: 390,
      rating: 4.9,
      coupon_label: "Çok satan",
      delivery_label: "Bugün teslim",
      image_url: "/images/modules/market-water-pack.png",
      module_key: MARKET_SCOPE,
      sku: "ALM-SU-001",
      status: "active"
    },
    {
      id: "0cdba404-46f2-4f0f-ac10-0bfd60f042e2",
      name: "Ev Temizlik Başlangıç Paketi",
      description: "Mutfak, banyo ve yüzey temizliği için çoklu ekonomik temizlik paketi.",
      category: "Market / Temizlik",
      brand: "Allona Market",
      price: 279.9,
      old_price: 349.9,
      stock: 36,
      sold_count: 154,
      rating: 4.7,
      coupon_label: "Sepette indirim",
      delivery_label: "Hızlı teslimat",
      image_url: "https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?auto=format&fit=crop&w=900&q=80",
      module_key: MARKET_SCOPE,
      sku: "ALM-TEMIZLIK-001",
      status: "active"
    },
    {
      id: "a3c210fb-9823-4275-9336-004d3a129503",
      name: "Kağıt Havlu 12'li Ekonomik Paket",
      description: "Mutfak ve günlük temizlik kullanımı için yüksek emici kağıt havlu paketi.",
      category: "Market / Ev İhtiyaçları",
      brand: "Allona Market",
      price: 189.9,
      old_price: 229.9,
      stock: 52,
      sold_count: 132,
      rating: 4.6,
      coupon_label: "Ev ihtiyaçları",
      delivery_label: "Bugün teslim",
      image_url: "/images/modules/market-paper-towels.png",
      module_key: MARKET_SCOPE,
      sku: "ALM-KAGIT-001",
      status: "active"
    },
    {
      id: "6a36c2e8-2e84-47f6-ba23-52d1e297fed2",
      name: "Bebek Islak Mendil 6'lı",
      description: "Hassas ciltler için günlük kullanıma uygun çoklu ıslak mendil paketi.",
      category: "Market / Bebek",
      brand: "Allona Market",
      price: 169.9,
      old_price: 199.9,
      stock: 48,
      sold_count: 121,
      rating: 4.8,
      coupon_label: "Aile bakım",
      delivery_label: "Hızlı teslimat",
      image_url: "/images/modules/market-baby-wipes.png",
      module_key: MARKET_SCOPE,
      sku: "ALM-BEBEK-001",
      status: "active"
    },
    {
      id: "dcd518d7-769c-44f4-9fa0-cb88f3db3623",
      name: "Aile Boyu Atıştırmalık Kutusu",
      description: "Film, ofis ve aile kullanımı için tatlı-tuzlu atıştırmalık seçkisi.",
      category: "Market / Atıştırmalık",
      brand: "Allona Market",
      price: 219.9,
      old_price: 259.9,
      stock: 44,
      sold_count: 144,
      rating: 4.7,
      coupon_label: "Sepet paketi",
      delivery_label: "Bugün teslim",
      image_url: "/images/modules/market-snack-box.png",
      module_key: MARKET_SCOPE,
      sku: "ALM-ATISTIRMALIK-001",
      status: "active"
    }
  ].map(core.normalizeProduct);

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

  function renderSourceNotice(isFallback) {
    const node = document.querySelector("[data-market-source]");
    if (!node) return;
    node.textContent = isFallback
      ? "Canlı ürün servisi yanıt vermediği için sunuma hazır yedek katalog gösteriliyor."
      : "Ürünler canlı Supabase kataloğundan çekildi.";
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
      const isFallback = !liveProducts.length;
      products = (isFallback ? fallbackProducts : liveProducts).map(core.normalizeProduct);
      renderCategoryOptions();
      syncFiltersFromParams();
      renderSourceNotice(isFallback);
      renderMarketSections();
    } catch (error) {
      console.warn("Allona Market canlı katalog yüklenemedi, yedek katalog gösteriliyor:", error.message || error);
      products = fallbackProducts.map(core.normalizeProduct);
      renderCategoryOptions();
      syncFiltersFromParams();
      renderSourceNotice(true);
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
