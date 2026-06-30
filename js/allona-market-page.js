(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const MARKET_SCOPE = "market";
  const MIN_MARKET_SHOWCASE_PRODUCTS = 12;
  let products = [];
  let heroIndex = 0;
  let heroTimer;

  const MARKET_PREVIEW_PRODUCTS = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Taze Sebze Paketi",
      description: "Domates, salatalık, biber, yeşillik ve mevsim sebzeleriyle günlük seçilmiş hızlı teslimat paketi.",
      category: "Market / Meyve Sebze",
      brand: "Allona Market",
      price: 349.9,
      compare_at_price: 429.9,
      stock: 42,
      image_url: "/images/modules/market-light-v5.jpg",
      module_key: MARKET_SCOPE,
      status: "active",
      slug: "taze-sebze-paketi",
      rating: 4.8,
      review_count: 126,
      sold_count: 430,
      favorite_count: 92,
      cart_count: 38,
      coupon_label: "Sepette kupon",
      delivery_label: "Bugün teslim",
      seller_name: "Allona Market Partneri",
      seller_score: 4.9,
      created_at: "2026-06-27T08:30:00+03:00",
      is_preview: true
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Doğal Kaynak Suyu 6 x 1.5 L",
      description: "Ev ve ofis kullanımı için altılı doğal kaynak suyu paketi.",
      category: "Market / İçecek",
      brand: "Allona Market",
      price: 79.9,
      compare_at_price: 99.9,
      stock: 120,
      image_url: "/images/modules/market-water-pack.png",
      module_key: MARKET_SCOPE,
      status: "active",
      slug: "dogal-kaynak-suyu-6x15l",
      rating: 4.9,
      review_count: 210,
      sold_count: 980,
      favorite_count: 156,
      cart_count: 74,
      coupon_label: "Çoklu alım",
      delivery_label: "30 dk hazırlık",
      seller_name: "Allona Market Partneri",
      seller_score: 4.9,
      created_at: "2026-06-27T08:20:00+03:00",
      is_preview: true
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Kağıt Havlu 12'li Ekonomik Paket",
      description: "Mutfak ve günlük temizlik kullanımı için yüksek emici kağıt havlu paketi.",
      category: "Market / Ev İhtiyaçları",
      brand: "Allona Market",
      price: 189.9,
      compare_at_price: 229.9,
      stock: 52,
      image_url: "/images/modules/market-paper-towels.png",
      module_key: MARKET_SCOPE,
      status: "active",
      slug: "kagit-havlu-12li-ekonomik-paket",
      rating: 4.7,
      review_count: 88,
      sold_count: 310,
      favorite_count: 64,
      cart_count: 29,
      coupon_label: "Ev kuponu",
      delivery_label: "Hızlı teslimat",
      seller_name: "Allona Market Partneri",
      seller_score: 4.8,
      created_at: "2026-06-27T08:10:00+03:00",
      is_preview: true
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      name: "Bebek Islak Mendil 6'lı",
      description: "Hassas ciltler için günlük kullanıma uygun çoklu ıslak mendil paketi.",
      category: "Market / Bebek",
      brand: "Allona Market",
      price: 169.9,
      compare_at_price: 199.9,
      stock: 48,
      image_url: "/images/modules/market-baby-wipes.png",
      module_key: MARKET_SCOPE,
      status: "active",
      slug: "bebek-islak-mendil-6li",
      rating: 4.8,
      review_count: 132,
      sold_count: 520,
      favorite_count: 118,
      cart_count: 41,
      coupon_label: "Aile kuponu",
      delivery_label: "Bugün teslim",
      seller_name: "Allona Market Partneri",
      seller_score: 4.9,
      created_at: "2026-06-27T08:00:00+03:00",
      is_preview: true
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      name: "Aile Boyu Atıştırmalık Kutusu",
      description: "Film, ofis ve aile kullanımı için tatlı-tuzlu atıştırmalık seçkisi.",
      category: "Market / Atıştırmalık",
      brand: "Allona Market",
      price: 219.9,
      compare_at_price: 259.9,
      stock: 44,
      image_url: "/images/modules/market-snack-box.png",
      module_key: MARKET_SCOPE,
      status: "active",
      slug: "aile-boyu-atistirmalik-kutusu",
      rating: 4.8,
      review_count: 95,
      sold_count: 470,
      favorite_count: 76,
      cart_count: 33,
      coupon_label: "Fırsat ürünü",
      delivery_label: "Hızlı teslimat",
      seller_name: "Allona Market Partneri",
      seller_score: 4.8,
      created_at: "2026-06-27T07:50:00+03:00",
      is_preview: true
    },
    {
      id: "66666666-6666-4666-8666-666666666666",
      name: "Günlük Süt 1 L",
      description: "Kahvaltı ve günlük kullanım için soğuk zincire uygun taze içimlik süt.",
      category: "Market / Kahvaltı",
      brand: "Allona Market",
      price: 39.9,
      compare_at_price: 49.9,
      stock: 80,
      image_url: "/images/modules/market-light-v5.jpg",
      module_key: MARKET_SCOPE,
      status: "active",
      slug: "gunluk-sut-1l",
      rating: 4.7,
      review_count: 144,
      sold_count: 690,
      favorite_count: 82,
      cart_count: 57,
      coupon_label: "Kahvaltı",
      delivery_label: "Soğuk zincir",
      seller_name: "Allona Market Partneri",
      seller_score: 4.9,
      created_at: "2026-06-27T07:40:00+03:00",
      is_preview: true
    },
    {
      id: "77777777-7777-4777-8777-777777777777",
      name: "Gezen Tavuk Yumurtası 15'li",
      description: "Kahvaltı ve günlük mutfak kullanımı için 15'li ekonomik yumurta paketi.",
      category: "Market / Kahvaltı",
      brand: "Allona Market",
      price: 129.9,
      compare_at_price: 159.9,
      stock: 64,
      image_url: "/images/modules/market-light-v5.jpg",
      module_key: MARKET_SCOPE,
      status: "active",
      slug: "gezen-tavuk-yumurtasi-15li",
      rating: 4.8,
      review_count: 118,
      sold_count: 540,
      favorite_count: 70,
      cart_count: 46,
      coupon_label: "Sepette avantaj",
      delivery_label: "Bugün teslim",
      seller_name: "Allona Market Partneri",
      seller_score: 4.8,
      created_at: "2026-06-27T07:30:00+03:00",
      is_preview: true
    },
    {
      id: "88888888-8888-4888-8888-888888888888",
      name: "Mevsim Meyve Sepeti",
      description: "Elma, muz, portakal ve mevsim meyvelerinden oluşan sunuma hazır taze paket.",
      category: "Market / Meyve Sebze",
      brand: "Allona Market",
      price: 319.9,
      compare_at_price: 389.9,
      stock: 38,
      image_url: "/images/modules/market-light-v5.jpg",
      module_key: MARKET_SCOPE,
      status: "active",
      slug: "mevsim-meyve-sepeti",
      rating: 4.8,
      review_count: 84,
      sold_count: 350,
      favorite_count: 61,
      cart_count: 24,
      coupon_label: "Taze reyon",
      delivery_label: "Bugün teslim",
      seller_name: "Allona Market Partneri",
      seller_score: 4.9,
      created_at: "2026-06-27T07:20:00+03:00",
      is_preview: true
    },
    {
      id: "99999999-9999-4999-8999-999999999999",
      name: "Allona Türk Kahvesi 250 g",
      description: "Yoğun aromalı, taze çekilmiş kahve keyfi için ekonomik paket.",
      category: "Market / Kahvaltı",
      brand: "Allona Market",
      price: 119.9,
      compare_at_price: 149.9,
      stock: 55,
      image_url: "/images/modules/market-snack-box.png",
      module_key: MARKET_SCOPE,
      status: "active",
      slug: "allona-turk-kahvesi-250g",
      rating: 4.9,
      review_count: 173,
      sold_count: 760,
      favorite_count: 128,
      cart_count: 62,
      coupon_label: "Kahve kuponu",
      delivery_label: "Hızlı teslimat",
      seller_name: "Allona Market Partneri",
      seller_score: 4.9,
      created_at: "2026-06-27T07:10:00+03:00",
      is_preview: true
    },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Ev Temizlik Başlangıç Paketi",
      description: "Mutfak, banyo ve yüzey temizliği için çoklu ekonomik temizlik paketi.",
      category: "Market / Temizlik",
      brand: "Allona Market",
      price: 279.9,
      compare_at_price: 349.9,
      stock: 36,
      image_url: "/images/modules/market-paper-towels.png",
      module_key: MARKET_SCOPE,
      status: "active",
      slug: "ev-temizlik-baslangic-paketi",
      rating: 4.7,
      review_count: 77,
      sold_count: 280,
      favorite_count: 58,
      cart_count: 22,
      coupon_label: "Ev kuponu",
      delivery_label: "Hızlı teslimat",
      seller_name: "Allona Market Partneri",
      seller_score: 4.8,
      created_at: "2026-06-27T07:00:00+03:00",
      is_preview: true
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      name: "Natürel Sızma Zeytinyağı 1 L",
      description: "Salata, kahvaltı ve günlük yemekler için natürel sızma zeytinyağı.",
      category: "Market / Temel Gıda",
      brand: "Allona Market",
      price: 399.9,
      compare_at_price: 469.9,
      stock: 34,
      image_url: "/images/modules/market-light-v5.jpg",
      module_key: MARKET_SCOPE,
      status: "active",
      slug: "naturel-sizma-zeytinyagi-1l",
      rating: 4.8,
      review_count: 101,
      sold_count: 390,
      favorite_count: 86,
      cart_count: 27,
      coupon_label: "Temel gıda",
      delivery_label: "Bugün teslim",
      seller_name: "Allona Market Partneri",
      seller_score: 4.8,
      created_at: "2026-06-27T06:50:00+03:00",
      is_preview: true
    },
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      name: "Makarna ve Domates Sos Paketi",
      description: "Hızlı akşam yemeği için makarna ve sos ikili avantaj paketi.",
      category: "Market / Temel Gıda",
      brand: "Allona Market",
      price: 119.9,
      compare_at_price: 149.9,
      stock: 90,
      image_url: "/images/modules/market-snack-box.png",
      module_key: MARKET_SCOPE,
      status: "active",
      slug: "makarna-ve-domates-sos-paketi",
      rating: 4.7,
      review_count: 66,
      sold_count: 510,
      favorite_count: 53,
      cart_count: 49,
      coupon_label: "Akşam paketi",
      delivery_label: "Hızlı teslimat",
      seller_name: "Allona Market Partneri",
      seller_score: 4.8,
      created_at: "2026-06-27T06:40:00+03:00",
      is_preview: true
    }
  ];

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
      minPrice: document.querySelector("[data-market-min]")?.value || "",
      maxPrice: document.querySelector("[data-market-max]")?.value || "",
      sort: document.querySelector("[data-market-sort]")?.value || "newest",
      quick: document.querySelector("[data-market-quick]")?.value || ""
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
    document.querySelectorAll("[data-market-min], [data-market-max]").forEach((input) => {
      const label = input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null;
      if (label) {
        if (!label.dataset.baseLabel) label.dataset.baseLabel = label.textContent.trim();
        label.textContent = `${label.dataset.baseLabel} (${code})`;
      }
      input.placeholder = code;
      input.setAttribute("aria-label", `${label?.dataset.baseLabel || "Fiyat"} (${code})`);
    });
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

  function marketImageForProduct(product) {
    const text = productText(product);
    const current = String(product.image_url || "").trim();
    const isSeedOrExternal = !current || /images\.unsplash\.com/i.test(current) || /allona market/i.test(String(product.brand || product.seller_name || ""));
    if (!isSeedOrExternal && /^https?:\/\//i.test(current)) return current;
    if (!isSeedOrExternal && current) return current;
    if (/su|içecek|icecek|kaynak/.test(text)) return "/images/modules/market-water-pack.png";
    if (/kağıt|kagit|havlu|temizlik|deterjan|ev ihtiyaç|ev ihtiyac/.test(text)) return "/images/modules/market-paper-towels.png";
    if (/bebek|mendil|bakım|bakim|hijyen/.test(text)) return "/images/modules/market-baby-wipes.png";
    if (/atıştırmalık|atistirmalik|kahve|makarna|sos/.test(text)) return "/images/modules/market-snack-box.png";
    return "/images/modules/market-light-v5.jpg";
  }

  function normalizeMarketProduct(product) {
    const normalized = core.normalizeProduct(product);
    return {
      ...normalized,
      image_url: marketImageForProduct(normalized),
      module_key: normalized.module_key || MARKET_SCOPE,
      seller_name: normalized.seller_name || normalized.brand || "Allona Market Partneri"
    };
  }

  function applyMarketFilters() {
    const filters = marketFiltersFromDom();
    const q = filters.search.trim().toLocaleLowerCase("tr-TR");
    const category = filters.category.trim().toLocaleLowerCase("tr-TR");
    const min = priceFilterToBase(filters.minPrice);
    const max = priceFilterToBase(filters.maxPrice);

    const list = products.filter((product) => {
      const text = productText(product);
      const searchOk = !q || text.includes(q);
      const categoryOk = !category || product.category.toLocaleLowerCase("tr-TR") === category;
      const minOk = !min || product.price >= min;
      const maxOk = !max || product.price <= max;
      const hasDeal = discountScore(product) > 0 || Boolean(product.discount_label || product.coupon_label);
      const fastDelivery = /hızlı|bugün|dakika|aynı gün/i.test(product.delivery_label || "") || product.stock >= 20;
      const quickOk = !filters.quick
        || (filters.quick === "deals" && hasDeal)
        || (filters.quick === "fast" && fastDelivery)
        || (filters.quick === "fresh" && isFreshProduct(product))
        || (filters.quick === "home" && isHomeProduct(product))
        || (filters.quick === "top" && (product.sold_count >= 150 || product.rating >= 4.8));
      return searchOk && categoryOk && minOk && maxOk && quickOk;
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
      node.textContent = "Canlı ürün kataloğu şu anda alınamadı; vitrin örnek partner market ürünleriyle açık tutuluyor.";
      return;
    }
    if (state === "empty") {
      node.textContent = "Allona Market için aktif Supabase ürünü bulunamadı; vitrin örnek partner market ürünleriyle dolduruldu.";
      return;
    }
    if (state === "mixed") {
      node.textContent = "Supabase ürünleri, vitrin bütünlüğü için örnek partner market ürünleriyle tamamlandı.";
      return;
    }
    node.textContent = "Ürünler canlı Supabase kataloğundan çekildi.";
  }

  function previewProducts() {
    return MARKET_PREVIEW_PRODUCTS.map(normalizeMarketProduct);
  }

  function completeShowcase(liveProducts) {
    const live = (liveProducts || []).map(normalizeMarketProduct);
    if (live.length >= MIN_MARKET_SHOWCASE_PRODUCTS) {
      return { items: live, source: "live" };
    }
    const liveIds = new Set(live.map((product) => String(product.id)));
    const supplement = previewProducts()
      .filter((product) => !liveIds.has(String(product.id)))
      .slice(0, Math.max(0, MIN_MARKET_SHOWCASE_PRODUCTS - live.length));
    return {
      items: [...live, ...supplement],
      source: live.length ? "mixed" : "empty"
    };
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
      updatePriceFilterCurrencyHints();
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
      const showcase = completeShowcase(liveProducts);
      products = showcase.items;
      renderCategoryOptions();
      syncFiltersFromParams();
      updatePriceFilterCurrencyHints();
      renderSourceNotice(showcase.source);
      renderMarketSections();
    } catch (error) {
      console.warn("Allona Market canlı katalog yüklenemedi; vitrin önizleme kataloğu kullanılacak:", error.message || error);
      products = previewProducts();
      renderCategoryOptions();
      syncFiltersFromParams();
      updatePriceFilterCurrencyHints();
      renderSourceNotice("error");
      renderMarketSections();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.querySelector("[data-page='allona-market']")) return;
    bindHero();
    bindFilters();
    loadProducts();
    document.addEventListener("allona:currency-changed", () => {
      updatePriceFilterCurrencyHints();
      renderMarketSections();
    });
  });
})();
