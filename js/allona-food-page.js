(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core || {};

  const locations = ["İstanbul, Beşiktaş", "İstanbul, Kadıköy", "Ankara, Çankaya", "İzmir, Alsancak"];
  const state = {
    restaurants: [],
    menuItems: [],
    heroAds: [],
    query: "",
    cuisine: "all",
    mode: "delivery",
    quick: new Set(),
    sort: "recommended",
    cart: [],
    discount: 0,
    trackStep: 1,
    locationIndex: 0,
    dataSource: "supabase",
    detailItem: null
  };

  const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const restaurantGrid = qs("[data-restaurant-grid]");
  const menuGrid = qs("[data-menu-grid]");
  const emptyState = qs("[data-food-empty]");
  const visibleCount = qs("[data-visible-count]");
  const summary = qs("[data-food-summary]");
  const statusNode = qs("[data-food-status]");
  const searchInput = qs("[data-food-search]");
  const cartItems = qs("[data-cart-items]");
  const countBadges = qsa("[data-cart-count], [data-cart-count-rail]");
  const subtotalNode = qs("[data-subtotal]");
  const deliveryNode = qs("[data-delivery-fee]");
  const discountNode = qs("[data-discount]");
  const hpNode = qs("[data-hp-earned]");
  const totalNode = qs("[data-total]");
  const isAllFoodPage = document.body?.dataset.page === "allona-food-all";

  function escape(value) {
    return core.escapeHTML ? core.escapeHTML(value) : String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char]));
  }

  function url(path) {
    return core.url ? core.url(path) : path;
  }

  function sanitizeUrl(value, fallback) {
    return core.sanitizeUrl ? core.sanitizeUrl(value, fallback) : (value || fallback);
  }

  function mediaUrl(value, fallback = "/images/modules/yemek-light-v5.jpg") {
    const raw = String(value || "").trim();
    if (!raw) return url(fallback);
    if (/^\/?images\//i.test(raw)) return url(raw.startsWith("/") ? raw : `/${raw}`);
    return sanitizeUrl(raw, fallback);
  }

  function safeHref(value, fallback = "#food-restaurants") {
    const raw = String(value || "").trim();
    if (!raw) return fallback;
    if (raw.startsWith("#")) return raw;
    if (/^(https?:)?\/\//i.test(raw)) return raw;
    if (/^[./\w-]/.test(raw)) return url(raw.startsWith("/") ? raw : `/pages/commerce/${raw}`);
    return fallback;
  }

  function toast(message, type) {
    if (core.toast) core.toast(message, type);
  }

  function priceLabel(value) {
    const amount = Number(value || 0);
    return Number.isFinite(amount) && amount > 0 ? money.format(amount) : "";
  }

  function hashText(value) {
    const text = String(value || "");
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  function setStatus(message, type) {
    if (!statusNode) return;
    statusNode.textContent = message || "";
    statusNode.hidden = !message;
    statusNode.classList.toggle("is-warning", type === "warning");
    statusNode.classList.toggle("is-success", type === "success");
  }

  function withTimeout(promise, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("Canlı katalog sorgusu zaman aşımına uğradı.")), timeoutMs);
      Promise.resolve(promise)
        .then((value) => {
          window.clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          window.clearTimeout(timer);
          reject(error);
        });
    });
  }

  function inferCuisine(value) {
    const text = String(value || "").toLocaleLowerCase("tr-TR");
    if (/burger/.test(text)) return "Burger";
    if (/pizza/.test(text)) return "Pizza";
    if (/kebap|lahmacun|pide|ızgara|izgara/.test(text)) return "Kebap";
    if (/döner|doner/.test(text)) return "Döner";
    if (/tatlı|pasta|dondurma|kahve/.test(text)) return /kahve/.test(text) ? "Kahve" : "Tatlı";
    if (/fit|sağlıklı|saglikli|salata|vegan|bowl/.test(text)) return "Sağlıklı";
    return "Yemek";
  }

  function iconForCuisine(cuisine) {
    const icons = {
      Burger: "fa-burger",
      Pizza: "fa-pizza-slice",
      Kebap: "fa-fire-burner",
      Döner: "fa-utensils",
      Tatlı: "fa-ice-cream",
      Kahve: "fa-mug-hot",
      Sağlıklı: "fa-seedling"
    };
    return icons[cuisine] || "fa-utensils";
  }

  function isFoodProduct(raw) {
    if (App.catalog?.isFoodProduct) return App.catalog.isFoodProduct(raw);
    const product = core.normalizeProduct ? core.normalizeProduct(raw) : raw;
    const sku = String(product.sku || product.product_sku || "").toLocaleUpperCase("tr-TR");
    if (/^ALY[-_]/.test(sku)) return true;
    const category = String(product.category || "").toLocaleLowerCase("tr-TR");
    const merchant = [product.brand, product.seller_name, product.partner_name, product.store_name]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("tr-TR");
    if (/yemek|restoran|restaurant|lokanta|pizzacı|pizzaci|kebapçı|kebapci|dönerci|donerci/.test(`${category} ${merchant}`)) return true;
    const text = [product.name, product.product_name, product.description, product.category, product.brand, product.seller_name, product.store_name, product.coupon_label, product.delivery_label]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("tr-TR");
    const foodSignal = /burger|pizza|kebap|döner|doner|dürüm|durum|tatlı|tatli|kahve|pide|lahmacun|bowl|salata|fast food/.test(text);
    const serviceSignal = /menü|menu|sipariş|siparis|restoran|restaurant|teslimat|kurye|soğan|sogan|soslu|sossuz/.test(text);
    return foodSignal && serviceSignal;
  }

  function normalizeProduct(raw) {
    const item = core.normalizeProduct ? core.normalizeProduct(raw) : raw;
    const cuisine = inferCuisine(`${item.category || ""} ${item.name || ""} ${item.description || ""}`);
    return {
      ...item,
      cuisine,
      seller_name: item.seller_name || item.partner_name || item.store_name || item.brand || "Allona Yemek Partner",
      image_url: item.image_url || item.image || "../../images/modules/yemek-light-v5.jpg",
      hp: Number(item.hp || item.hp_value || item.reward_hp || Math.max(18, Math.round(Number(item.price || 0) * 0.1))),
      eta: Number(item.eta || item.delivery_minutes || item.preparation_minutes || 20 + (Math.abs(String(item.id || item.name || "").length) % 18)),
      min: Number(item.min_order || item.minimum_order || Math.max(100, Math.round(Number(item.price || 0) * 0.8))),
      deal: item.discount_label || item.discount || item.coupon_label || "Günlük menü fırsatı"
    };
  }

  function productToMenuItem(raw, index) {
    const product = normalizeProduct(raw);
    const id = String(product.id || `food-live-${index}`);
    return {
      id,
      restaurant: product.seller_name,
      name: product.name,
      desc: product.description || `${product.cuisine} kategorisinde partner menüsü`,
      price: Number(product.price || 0),
      hp: product.hp,
      icon: iconForCuisine(product.cuisine),
      image: product.image_url,
      product
    };
  }

  function menuProfile(item) {
    const text = [item.name, item.desc, item.restaurant, item.product?.category, item.product?.description].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR");
    const base = {
      contains: ["Günlük hazırlanan ana ürün", "Partner restoran porsiyonu", "Paket servis seti"],
      options: [
        { id: "onion", label: "Soğan", defaultIncluded: true },
        { id: "pickle", label: "Turşu", defaultIncluded: true },
        { id: "tomato", label: "Domates", defaultIncluded: true },
        { id: "sauce-extra", label: "Sos ekstra", defaultIncluded: false }
      ],
      sauces: ["Şef sosu", "Sossuz", "Sos ayrı gelsin", "Acı sos"],
      spices: ["Baharat yok", "Az baharat", "Orta baharat", "Bol baharat"],
      notePlaceholder: "Örn: ekmek iyi kızarsın, sos ayrı gelsin"
    };

    if (/burger/.test(text)) {
      return {
        contains: ["Burger ekmeği", "Köfte veya tavuk", "Cheddar", "Marul", "Domates", "Patates", "İçecek"],
        options: [
          { id: "onion", label: "Soğan", defaultIncluded: true },
          { id: "pickle", label: "Turşu", defaultIncluded: true },
          { id: "mayo", label: "Mayonez", defaultIncluded: true },
          { id: "ketchup", label: "Ketçap", defaultIncluded: true },
          { id: "hot-sauce", label: "Acı sos", defaultIncluded: false }
        ],
        sauces: ["Burger sosu", "Sossuz", "Sos ayrı gelsin", "Acı sos"],
        spices: ["Baharat yok", "Az baharat", "Orta baharat", "Bol baharat"],
        notePlaceholder: "Örn: soğansız, turşu fazla, sos ayrı"
      };
    }

    if (/pizza/.test(text)) {
      return {
        contains: ["Pizza hamuru", "Domates sos", "Mozzarella", "Günlük pizza malzemeleri", "İçecek veya kampanya içeriği"],
        options: [
          { id: "olive", label: "Zeytin", defaultIncluded: true },
          { id: "corn", label: "Mısır", defaultIncluded: true },
          { id: "mushroom", label: "Mantar", defaultIncluded: true },
          { id: "extra-cheese", label: "Ekstra peynir", defaultIncluded: false },
          { id: "hot-pepper", label: "Acı biber", defaultIncluded: false }
        ],
        sauces: ["Domates sos", "Sos az", "Sossuz kenar", "Sarımsak sos yanında"],
        spices: ["Baharat yok", "Kekik az", "Kekik normal", "Acılı baharat"],
        notePlaceholder: "Örn: mantarsız, acı biber yanında"
      };
    }

    if (/kebap|döner|doner|dürüm|durum|lahmacun|pide|ızgara|izgara/.test(text)) {
      return {
        contains: ["Lavaş veya pide", "Et veya tavuk", "Yeşillik", "Domates", "Turşu", "Ayran veya içecek"],
        options: [
          { id: "onion", label: "Soğan", defaultIncluded: true },
          { id: "pickle", label: "Turşu", defaultIncluded: true },
          { id: "greens", label: "Yeşillik", defaultIncluded: true },
          { id: "sumac", label: "Sumak", defaultIncluded: true },
          { id: "mayo", label: "Mayonez", defaultIncluded: false },
          { id: "hot-sauce", label: "Acı sos", defaultIncluded: false }
        ],
        sauces: ["Soslu", "Sossuz", "Sos ayrı gelsin", "Yoğurtlu sos"],
        spices: ["Baharat yok", "Az baharat", "Orta baharat", "Bol baharat"],
        notePlaceholder: "Örn: soğansız dürüm, turşu olmasın, acılı olsun"
      };
    }

    if (/fit|sağlıklı|saglikli|salata|bowl|vegan/.test(text)) {
      return {
        contains: ["Protein", "Yeşillik", "Tahıl", "Günlük sebze", "Özel sos"],
        options: [
          { id: "greens", label: "Yeşillik", defaultIncluded: true },
          { id: "grain", label: "Tahıl", defaultIncluded: true },
          { id: "tomato", label: "Domates", defaultIncluded: true },
          { id: "onion", label: "Soğan", defaultIncluded: false },
          { id: "sauce-side", label: "Sos ayrı", defaultIncluded: true }
        ],
        sauces: ["Zeytinyağlı sos", "Sossuz", "Sos ayrı gelsin", "Acı sos"],
        spices: ["Baharat yok", "Az baharat", "Orta baharat", "Bol baharat"],
        notePlaceholder: "Örn: sos ayrı, soğansız, tahıl az"
      };
    }

    if (/tatlı|tatli|kahve|pasta|dondurma/.test(text)) {
      return {
        contains: ["Günlük tatlı", "Kahve veya içecek", "Paket servis seti"],
        options: [
          { id: "sugar", label: "Şeker", defaultIncluded: true },
          { id: "milk", label: "Süt", defaultIncluded: true },
          { id: "cream", label: "Krema", defaultIncluded: false },
          { id: "ice", label: "Buz", defaultIncluded: false }
        ],
        sauces: ["Standart", "Şekersiz", "Az şekerli", "Süt ayrı gelsin"],
        spices: ["Sade", "Tarçın az", "Tarçın normal", "Ekstra aroma"],
        notePlaceholder: "Örn: şekersiz kahve, süt ayrı, buzsuz"
      };
    }

    return base;
  }

  function sourceForDetail(id) {
    return state.menuItems.find((item) => String(item.id) === String(id)) || suggestedItemForRestaurant(id);
  }

  function productsToRestaurants(products) {
    const groups = new Map();
    products.forEach((raw, index) => {
      const product = normalizeProduct(raw);
      const key = product.seller_name || product.brand || `Allona Yemek Partner ${index + 1}`;
      const current = groups.get(key) || {
        id: `restaurant-${String(key).toLocaleLowerCase("tr-TR").replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ]+/gi, "-")}`,
        name: key,
        cuisine: product.cuisine,
        tags: [],
        rating: Number(product.rating || 4.7),
        eta: product.eta,
        hp: product.hp,
        min: product.min,
        price: Number(product.price || 0),
        description: product.description || `${product.cuisine} kategorisinde öne çıkan partner menüsü.`,
        deal: product.deal,
        free: Number(product.price || 0) >= 350,
        open: true,
        image: product.image_url,
        productId: product.id
      };
      current.tags = [...new Set([...current.tags, product.cuisine, product.category, product.name].filter(Boolean))].slice(0, 4);
      current.rating = Math.max(current.rating, Number(product.rating || current.rating || 4.7));
      current.eta = Math.min(current.eta, product.eta);
      current.hp = Math.max(current.hp, product.hp);
      current.min = Math.min(current.min, product.min);
      current.price = current.price ? Math.min(current.price, Number(product.price || current.price)) : Number(product.price || 0);
      if (!current.description && product.description) current.description = product.description;
      groups.set(key, current);
    });
    return Array.from(groups.values());
  }

  function productToHeroAd(raw) {
    const product = normalizeProduct(raw);
    return {
      title: product.name,
      subtitle: product.seller_name || product.category || "Allona Yemek Partneri",
      campaign_text: product.deal || `${money.format(product.price)} / hızlı sepet`,
      description: product.description || "Partner restoran kampanyasını Allona Yemek içinde keşfet.",
      price_label: priceLabel(product.price),
      image_url: product.image_url,
      cta_label: "Menüyü İncele",
      link_url: "#food-restaurants",
      source_id: product.id || product.name
    };
  }

  function heroAdFromRecord(ad) {
    const product = ad.product ? normalizeProduct(ad.product) : null;
    return {
      title: ad.title || product?.name || "Partner reklamı",
      subtitle: ad.subtitle || product?.seller_name || product?.category || "Günlük Partner Reklamı",
      campaign_text: ad.campaign_text || product?.deal || "Bugüne özel görünürlük",
      description: ad.description || product?.description || "Partner kampanyasını Allona Yemek üst alanında keşfedin.",
      price_label: ad.price_label || priceLabel(ad.price || product?.price),
      image_url: ad.image_url || product?.image_url || "../../images/modules/yemek-light-v5.jpg",
      cta_label: ad.cta_label || "İncele",
      link_url: ad.link_url || "#food-restaurants",
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

  async function fetchFoodProducts() {
    if (!App.db?.products?.listActive) return [];
    const products = await withTimeout(App.db.products.listActive({ sort: "newest", scope: "food" }), 4500);
    return (products || []).filter(isFoodProduct).map(normalizeProduct);
  }

  async function fetchFoodAds() {
    if (!App.config?.partnerAdsEnabled || !App.db?.ads?.foodHero) return [];
    try {
      return await withTimeout(App.db.ads.foodHero(12), 3500);
    } catch (error) {
      console.warn("Allona Yemek partner reklamları yüklenemedi:", error.message || error);
      return [];
    }
  }

  async function loadLiveFoodData() {
    setStatus("Canlı restoran kataloğu Supabase üzerinden yükleniyor.");
    try {
      const [products, ads] = await Promise.all([
        fetchFoodProducts().catch((error) => {
          console.warn("Allona Yemek ürünleri yüklenemedi:", error.message || error);
          return [];
        }),
        fetchFoodAds()
      ]);

      if (products.length) {
        state.menuItems = products.map(productToMenuItem);
        state.restaurants = productsToRestaurants(products);
        state.dataSource = "supabase";
      }

      const scopedAds = ads.filter((ad) => !ad.product || isFoodProduct(ad.product));

      state.heroAds = uniqueAds([
        ...scopedAds.map(heroAdFromRecord),
        ...products.map(productToHeroAd)
      ]).slice(0, 7);

      renderHeroAds();
      renderRestaurants();
      renderMenu();
      renderCart();
      focusAllPageView();
      setStatus(products.length ? "Canlı Supabase ürünleri gösteriliyor." : "Canlı Yemek ürünü bulunamadı.", products.length ? "success" : "warning");
    } catch (error) {
      console.warn("Allona Yemek canlı katalog hatası:", error.message || error);
      renderHeroAds();
      setStatus("Canlı katalog şu an alınamadı. Lütfen kısa süre sonra tekrar deneyin.", "warning");
    }
  }

  function renderHeroAds() {
    const slider = qs("[data-food-hero-slider]");
    const track = qs("[data-food-hero-track]");
    if (!slider || !track || !state.heroAds.length) return;
    track.innerHTML = state.heroAds.map((ad, index) => `
      <article class="food-promo-slide ${index === 0 ? "is-active" : ""}" data-food-hero-slide>
        <img src="${escape(mediaUrl(ad.image_url))}" alt="${escape(ad.title)}" loading="${index === 0 ? "eager" : "lazy"}">
        <div class="food-promo-content">
          <p class="food-eyebrow"><i class="fa-solid fa-bolt" aria-hidden="true"></i> ${escape(ad.subtitle)}</p>
          <h${index === 0 ? "1 id=\"hero-title\"" : "2"}>${escape(ad.title)}</h${index === 0 ? "1" : "2"}>
          <p>${escape(ad.description)}</p>
          <div class="food-promo-details">
            ${ad.price_label ? `<span class="food-promo-price">${escape(ad.price_label)}</span>` : ""}
            <span>${escape(ad.campaign_text)}</span>
          </div>
          <a class="food-promo-btn" href="${escape(safeHref(ad.link_url))}">${escape(ad.cta_label || "İncele")}</a>
        </div>
      </article>
    `).join("");
    initHeroSlider();
  }

  function initHeroSlider() {
    const slider = qs("[data-food-hero-slider]");
    if (!slider) return;
    if (slider.__foodHeroTimer) window.clearInterval(slider.__foodHeroTimer);
    const slides = qsa("[data-food-hero-slide]", slider);
    const dotsWrap = qs("[data-food-hero-dots]", slider);
    const prev = qs("[data-food-hero-prev]", slider);
    const next = qs("[data-food-hero-next]", slider);
    if (!slides.length || !dotsWrap) return;
    let index = 0;

    function show(nextIndex) {
      index = (nextIndex + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => slide.classList.toggle("is-active", slideIndex === index));
      qsa("button", dotsWrap).forEach((dot, dotIndex) => dot.classList.toggle("is-active", dotIndex === index));
    }

    function restart() {
      window.clearInterval(slider.__foodHeroTimer);
      slider.__foodHeroTimer = window.setInterval(() => show(index + 1), 3000);
    }

    dotsWrap.innerHTML = "";
    slides.forEach((_, slideIndex) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", `${slideIndex + 1}. reklamı göster`);
      dot.addEventListener("click", () => {
        show(slideIndex);
        restart();
      });
      dotsWrap.appendChild(dot);
    });
    if (prev) prev.onclick = () => { show(index - 1); restart(); };
    if (next) next.onclick = () => { show(index + 1); restart(); };
    slider.onmouseenter = () => window.clearInterval(slider.__foodHeroTimer);
    slider.onmouseleave = restart;
    show(0);
    restart();
  }

  function ensureDetailModal() {
    let modal = qs("[data-food-detail-modal]");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "food-detail-modal";
    modal.hidden = true;
    modal.dataset.foodDetailModal = "";
    modal.innerHTML = `<div class="food-detail-backdrop" data-food-detail-close></div><div class="food-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="food-detail-title" data-food-detail-dialog></div>`;
    document.body.appendChild(modal);
    return modal;
  }

  function closeDetailModal() {
    const modal = qs("[data-food-detail-modal]");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("food-detail-open");
    state.detailItem = null;
  }

  function renderDetailOptions(profile) {
    return profile.options.map((option) => `
      <label class="food-option">
        <input type="checkbox" data-detail-option value="${escape(option.id)}" data-label="${escape(option.label)}" data-default="${option.defaultIncluded ? "1" : "0"}" ${option.defaultIncluded ? "checked" : ""}>
        <span>${escape(option.label)}</span>
      </label>
    `).join("");
  }

  function renderChoiceGroup(name, title, values, icon) {
    return `
      <div class="food-choice-group">
        <h4><i class="fa-solid ${escape(icon)}" aria-hidden="true"></i>${escape(title)}</h4>
        <div class="food-choice-row">
          ${values.map((value, index) => `
            <label class="food-choice">
              <input type="radio" name="${escape(name)}" data-detail-choice data-label="${escape(value)}" value="${escape(value)}" ${index === 0 ? "checked" : ""}>
              <span>${escape(value)}</span>
            </label>
          `).join("")}
        </div>
      </div>
    `;
  }

  function openDetailModal(id) {
    const item = sourceForDetail(id);
    if (!item) return;
    state.detailItem = item;
    const modal = ensureDetailModal();
    const dialog = qs("[data-food-detail-dialog]", modal);
    const profile = menuProfile(item);
    const restaurant = state.restaurants.find((entry) => entry.name === item.restaurant || String(entry.productId) === String(item.id));
    const location = qs("[data-food-location-label]")?.textContent?.trim() || locations[state.locationIndex];
    dialog.innerHTML = `
      <button class="food-detail-close" type="button" data-food-detail-close aria-label="Menü detayını kapat"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      <div class="food-detail-media">
        <img src="${escape(mediaUrl(item.image))}" alt="${escape(item.name)}">
      </div>
      <form class="food-detail-body" data-food-detail-form>
        <div class="food-detail-head">
          <div>
            <p class="food-eyebrow"><i class="fa-solid ${escape(item.icon || "fa-utensils")}" aria-hidden="true"></i>${escape(item.restaurant)}</p>
            <h2 id="food-detail-title">${escape(item.name)}</h2>
            <p>${escape(item.desc || "Menü içeriği partner restoran tarafından hazırlanır.")}</p>
          </div>
          <strong>${money.format(item.price)}</strong>
        </div>

        <div class="food-detail-origin">
          <span><i class="fa-solid fa-store" aria-hidden="true"></i>${escape(item.restaurant)}</span>
          <span><i class="fa-solid fa-location-dot" aria-hidden="true"></i>${escape(location)}</span>
          <span><i class="fa-solid fa-clock" aria-hidden="true"></i>${escape(restaurant?.eta || 25)} dk</span>
          <span><i class="fa-solid fa-database" aria-hidden="true"></i>${escape(state.dataSource === "supabase" ? "Supabase canlı katalog" : "Canlı katalog bekleniyor")}</span>
        </div>

        <section class="food-detail-section">
          <h3>Menü İçeriği</h3>
          <div class="food-ingredient-list">
            ${profile.contains.map((value) => `<span>${escape(value)}</span>`).join("")}
          </div>
        </section>

        <section class="food-detail-section">
          <h3>İçinde Olsun mu?</h3>
          <div class="food-option-grid">
            ${renderDetailOptions(profile)}
          </div>
        </section>

        ${renderChoiceGroup("food_sauce", "Sos Seçimi", profile.sauces, "fa-bottle-droplet")}
        ${renderChoiceGroup("food_spice", "Baharat Seçimi", profile.spices, "fa-pepper-hot")}

        <label class="food-note-field">
          <span>Restorana Not</span>
          <textarea data-detail-note rows="3" maxlength="180" placeholder="${escape(profile.notePlaceholder)}"></textarea>
        </label>

        <div class="food-detail-actions">
          <div class="food-qty-stepper" aria-label="Adet">
            <button type="button" data-detail-qty="-1" aria-label="Adedi azalt"><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
            <output data-detail-qty-value>1</output>
            <button type="button" data-detail-qty="1" aria-label="Adedi artır"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
          </div>
          <button class="food-detail-submit" type="submit"><i class="fa-solid fa-basket-shopping" aria-hidden="true"></i>Seçimleri Sepete Ekle</button>
        </div>
      </form>
    `;
    modal.hidden = false;
    document.body.classList.add("food-detail-open");
    qs("[data-food-detail-close]", dialog)?.focus();
  }

  function detailSelections(form) {
    const optionInputs = qsa("[data-detail-option]", form);
    const removed = [];
    const added = [];
    const included = [];
    optionInputs.forEach((input) => {
      const label = input.dataset.label || input.value;
      const defaultIncluded = input.dataset.default === "1";
      if (input.checked) included.push(label);
      if (defaultIncluded && !input.checked) removed.push(label);
      if (!defaultIncluded && input.checked) added.push(label);
    });
    const choices = qsa("[data-detail-choice]:checked", form).map((input) => input.dataset.label || input.value).filter(Boolean);
    const note = String(qs("[data-detail-note]", form)?.value || "").trim().slice(0, 180);
    const qty = Math.max(1, Math.min(12, Number(qs("[data-detail-qty-value]", form)?.textContent || 1)));
    const summaryParts = [
      removed.length ? `Çıkarılacak: ${removed.join(", ")}` : "",
      added.length ? `Eklenecek: ${added.join(", ")}` : "",
      choices.length ? `Seçimler: ${choices.join(", ")}` : "",
      note ? `Not: ${note}` : ""
    ].filter(Boolean);
    return {
      qty,
      included,
      removed,
      added,
      choices,
      note,
      summary: summaryParts.length ? summaryParts.join(" • ") : "Standart içerik"
    };
  }

  async function addCustomizedItem(source, selections) {
    const baseId = source.product?.id || source.baseId || source.id;
    const fingerprint = hashText(`${source.id}|${selections.summary}`);
    const lineId = `${baseId}::${fingerprint}`;
    const existing = state.cart.find((item) => String(item.id) === lineId);
    if (existing) existing.qty += selections.qty;
    else {
      state.cart.push({
        ...source,
        id: lineId,
        baseId,
        qty: selections.qty,
        customizations: selections,
        customizationSummary: selections.summary
      });
    }
    renderCart();
    await mirrorSharedCart({
      ...source,
      id: lineId,
      baseId,
      customizations: selections,
      customizationSummary: selections.summary
    }, selections.qty);
    closeDetailModal();
  }

  function restaurantMatches(item) {
    const query = state.query.trim().toLocaleLowerCase("tr-TR");
    const text = [item.name, item.cuisine, item.deal, ...(item.tags || [])].join(" ").toLocaleLowerCase("tr-TR");
    if (query && !text.includes(query)) return false;
    if (state.cuisine !== "all" && item.cuisine !== state.cuisine) return false;
    if (state.quick.has("open") && !item.open) return false;
    if (state.quick.has("deal") && !item.deal) return false;
    if (state.quick.has("fast") && item.eta > 30) return false;
    if (state.quick.has("free") && !item.free) return false;
    return true;
  }

  function sortedRestaurants() {
    const list = state.restaurants.filter(restaurantMatches);
    if (state.sort === "rating") return list.sort((a, b) => b.rating - a.rating);
    if (state.sort === "fast") return list.sort((a, b) => a.eta - b.eta);
    if (state.sort === "hp") return list.sort((a, b) => b.hp - a.hp);
    return list.sort((a, b) => (Number(b.open) - Number(a.open)) || (b.rating - a.rating));
  }

  function renderRestaurants() {
    const list = sortedRestaurants();
    if (!restaurantGrid || !emptyState) return;
    restaurantGrid.innerHTML = list.map((item) => `
      <article class="food-card" data-food-detail="${escape(item.id)}" tabindex="0" role="button" aria-label="${escape(item.name)} menü detayını aç">
        <div class="food-card-media">
          <img src="${escape(mediaUrl(item.image))}" alt="${escape(item.name)}" loading="lazy">
          <div class="food-badge-row">
            <span class="food-badge"><i class="fa-solid fa-star" aria-hidden="true"></i>${escape(Number(item.rating || 4.7).toFixed(1))}</span>
            <span class="food-badge food-badge--green">${escape(item.free ? "Teslimat ücretsiz" : `${item.min} TL min.`)}</span>
          </div>
        </div>
        <div>
          <h3>${escape(item.name)}</h3>
          <p class="food-card-desc">${escape(item.description || (item.tags || []).join(" • "))}</p>
          <small class="food-card-tags">${escape((item.tags || []).join(" • "))}</small>
        </div>
        <div class="food-meta">
          <span><i class="fa-solid fa-clock" aria-hidden="true"></i>${escape(item.eta)} dk</span>
          <span><i class="fa-solid fa-ticket" aria-hidden="true"></i>${escape(item.deal)}</span>
          <span><i class="fa-solid fa-coins" aria-hidden="true"></i>+${escape(item.hp)} HP</span>
        </div>
        <div class="food-card-footer">
          <strong>${escape(item.price ? `${money.format(item.price)} başlangıç` : (state.mode === "pickup" ? "Gel-Al hazır" : "Teslimat açık"))}</strong>
          <button class="food-add" type="button" data-add-suggested="${escape(item.id)}"><i class="fa-solid fa-sliders" aria-hidden="true"></i>Seç</button>
        </div>
      </article>
    `).join("");
    emptyState.classList.toggle("is-visible", list.length === 0);
    if (visibleCount) visibleCount.textContent = list.length;
    if (summary) summary.textContent = `${list.length} restoran, ${state.mode === "pickup" ? "gel-al" : "teslimat"} modunda listeleniyor.`;
  }

  function renderMenu() {
    if (!menuGrid) return;
    menuGrid.innerHTML = state.menuItems.map((item) => `
      <article class="food-menu-item" data-food-detail="${escape(item.id)}" tabindex="0" role="button" aria-label="${escape(item.name)} menü detayını aç">
        <div class="food-menu-top">
          <div>
            <h3>${escape(item.name)}</h3>
            <p>${escape(item.restaurant)}</p>
          </div>
          <i class="fa-solid ${escape(item.icon)}" aria-hidden="true"></i>
        </div>
        <p>${escape(item.desc)}</p>
        <small>+${escape(item.hp)} HP kazandırır</small>
        <div class="food-price-line">
          <strong>${money.format(item.price)}</strong>
          <button class="food-add" type="button" data-add-item="${escape(item.id)}"><i class="fa-solid fa-sliders" aria-hidden="true"></i>Seç</button>
        </div>
      </article>
    `).join("");
  }

  function itemProductSnapshot(item) {
    const summary = item.customizationSummary || item.customizations?.summary || "";
    if (item.product) {
      return {
        ...item.product,
        id: summary ? item.id : item.product.id,
        original_product_id: item.baseId || item.product.id,
        description: summary ? `${item.product.description || item.desc || ""}\nTercihler: ${summary}`.trim() : item.product.description,
        food_customizations: item.customizations || null
      };
    }
    return {
      id: item.id,
      original_product_id: item.baseId || item.id,
      name: item.name,
      description: summary ? `${item.desc || ""}\nTercihler: ${summary}`.trim() : item.desc,
      category: "Yemek",
      brand: item.restaurant,
      seller_name: item.restaurant,
      price: item.price,
      stock: 99,
      image_url: mediaUrl(item.image),
      delivery_label: state.mode === "pickup" ? "Gel-Al" : "Bugün teslim",
      coupon_label: item.hp ? `+${item.hp} HP` : "",
      food_customizations: item.customizations || null
    };
  }

  function addLocalSharedCart(product, qty = 1) {
    if (!App.cart?.getItems || !App.cart?.setItems) return;
    const amount = Math.max(1, Number(qty || 1));
    const items = App.cart.getItems();
    const found = items.find((item) => String(item.id) === String(product.id));
    if (found) {
      found.qty = Number(found.qty || 1) + amount;
      found.product = found.product || product;
    } else {
      items.push({ id: product.id, qty: amount, product, added_at: new Date().toISOString() });
    }
    App.cart.setItems(items);
    toast("Menü sepete eklendi.");
  }

  async function mirrorSharedCart(item, qty = 1) {
    const product = itemProductSnapshot(item);
    if (!product || !product.id || !App.cart) return;
    try {
      await App.cart.add(product.id, qty, product);
    } catch (error) {
      addLocalSharedCart(product, qty);
    }
  }

  async function addItem(id) {
    const source = state.menuItems.find((item) => String(item.id) === String(id)) || suggestedItemForRestaurant(id);
    if (!source) return;
    const existing = state.cart.find((item) => String(item.id) === String(source.id));
    if (existing) existing.qty += 1;
    else state.cart.push({ ...source, qty: 1 });
    renderCart();
    await mirrorSharedCart(source);
  }

  function suggestedItemForRestaurant(restaurantId) {
    const restaurant = state.restaurants.find((item) => String(item.id) === String(restaurantId));
    if (!restaurant) return null;
    const match = state.menuItems.find((item) => item.restaurant === restaurant.name || String(item.id) === String(restaurant.productId)) || state.menuItems[0];
    return match ? { ...match, id: `${match.id}-${restaurant.id}` } : null;
  }

  function removeItem(id) {
    state.cart = state.cart.filter((item) => String(item.id) !== String(id));
    renderCart();
  }

  function cartMath() {
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const delivery = subtotal === 0 ? 0 : state.mode === "pickup" ? 0 : subtotal >= 350 ? 0 : 34.99;
    const hp = state.cart.reduce((sum, item) => sum + (item.hp * item.qty), 0);
    const discount = Math.min(state.discount, subtotal);
    return { subtotal, delivery, hp, discount, total: Math.max(0, subtotal + delivery - discount) };
  }

  function renderCart() {
    const count = state.cart.reduce((sum, item) => sum + item.qty, 0);
    countBadges.forEach((node) => { node.textContent = count; });
    if (count === 0) {
      state.discount = 0;
      if (cartItems) {
        cartItems.innerHTML = `<div class="food-cart-empty">Sepete menü eklediğinde toplam, teslimat ve HP burada görünür.</div>`;
      }
    } else if (cartItems) {
      cartItems.innerHTML = state.cart.map((item) => `
          <div class="food-cart-item">
            <div>
              <b>${escape(item.name)} x${escape(item.qty)}</b>
              <span>${escape(item.restaurant)} • ${money.format(item.price * item.qty)}</span>
              ${item.customizationSummary ? `<small class="food-cart-note">${escape(item.customizationSummary)}</small>` : ""}
            </div>
            <button type="button" data-remove-item="${escape(item.id)}" aria-label="${escape(item.name)} ürünü çıkar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
          </div>
        `).join("");
    }
    const totals = cartMath();
    if (subtotalNode) subtotalNode.textContent = money.format(totals.subtotal);
    if (deliveryNode) deliveryNode.textContent = money.format(totals.delivery);
    if (discountNode) discountNode.textContent = `-${money.format(totals.discount)}`;
    if (hpNode) hpNode.textContent = `${totals.hp} HP`;
    if (totalNode) totalNode.textContent = money.format(totals.total);
  }

  function setCuisine(cuisine) {
    state.cuisine = cuisine;
    qsa("[data-cuisine]").forEach((button) => button.classList.toggle("is-active", button.dataset.cuisine === cuisine));
    renderRestaurants();
  }

  function progressOrder() {
    state.trackStep = state.trackStep >= 4 ? 1 : state.trackStep + 1;
    qsa("[data-order-track] .food-track-step").forEach((node, index) => {
      node.classList.toggle("is-done", index < state.trackStep);
    });
  }

  function scrollShelf(target, direction) {
    const row = qs(`[data-scroll-row="${target}"]`);
    if (!row) return;
    const amount = Math.max(260, Math.round(row.clientWidth * 0.82)) * direction;
    row.scrollTo({ left: Math.max(0, row.scrollLeft + amount), behavior: "smooth" });
  }

  function focusAllPageView() {
    if (!isAllFoodPage) return;
    const view = core.getParam ? core.getParam("view") : new URLSearchParams(window.location.search).get("view");
    const target = view === "menus"
      ? qs("[data-menu-grid]")?.closest(".food-section")
      : view === "restaurants"
        ? qs("[data-restaurant-grid]")?.closest(".food-section")
        : null;
    if (target) window.setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 180);
  }

  function bindEvents() {
    const searchForm = qs("[data-food-search-form]");
    if (searchForm && searchInput) {
      searchForm.addEventListener("submit", (event) => {
        event.preventDefault();
        state.query = searchInput.value;
        renderRestaurants();
      });
      searchInput.addEventListener("input", (event) => {
        state.query = event.target.value;
        renderRestaurants();
      });
    }

    const globalSearch = qs("[data-global-search]");
    const globalInput = qs("#globalSearchInput");
    if (globalSearch && globalInput && searchInput) {
      globalSearch.addEventListener("click", () => {
        state.query = globalInput.value;
        searchInput.value = globalInput.value;
        renderRestaurants();
        qs("#food-restaurants")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    qsa("[data-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        state.mode = button.dataset.mode;
        qsa("[data-mode]").forEach((item) => item.classList.toggle("is-active", item === button));
        renderRestaurants();
        renderCart();
      });
    });
    qsa("[data-cuisine]").forEach((button) => {
      button.addEventListener("click", () => setCuisine(button.dataset.cuisine));
    });
    qsa("[data-quick]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.quick;
        if (state.quick.has(key)) state.quick.delete(key);
        else state.quick.add(key);
        button.classList.toggle("is-active", state.quick.has(key));
        renderRestaurants();
      });
    });
    qs("[data-food-sort]")?.addEventListener("change", (event) => {
      state.sort = event.target.value;
      renderRestaurants();
    });
    qs("[data-clear-filters]")?.addEventListener("click", () => {
      state.query = "";
      state.cuisine = "all";
      state.quick.clear();
      state.sort = "recommended";
      if (searchInput) searchInput.value = "";
      if (qs("[data-food-sort]")) qs("[data-food-sort]").value = "recommended";
      qsa("[data-quick]").forEach((button) => button.classList.remove("is-active"));
      setCuisine("all");
    });

    qs("[data-location-action]")?.addEventListener("click", () => {
      state.locationIndex = (state.locationIndex + 1) % locations.length;
      const label = qs("[data-food-location-label]");
      if (label) label.textContent = locations[state.locationIndex];
      toast(`${locations[state.locationIndex]} için restoranlar güncellendi.`);
    });
    qs("[data-address-edit]")?.addEventListener("click", () => {
      window.location.href = url("/pages/account/addresses.html");
    });

    document.addEventListener("click", async (event) => {
      const add = event.target.closest("[data-add-item], [data-add-suggested]");
      if (add) {
        openDetailModal(add.dataset.addItem || add.dataset.addSuggested);
        return;
      }
      const detailCard = event.target.closest("[data-food-detail]");
      if (detailCard && !event.target.closest("a, button, input, textarea, select, label")) {
        openDetailModal(detailCard.dataset.foodDetail);
        return;
      }
      const close = event.target.closest("[data-food-detail-close]");
      if (close) {
        closeDetailModal();
        return;
      }
      const qtyButton = event.target.closest("[data-detail-qty]");
      if (qtyButton) {
        const output = qs("[data-detail-qty-value]");
        if (output) {
          const next = Math.max(1, Math.min(12, Number(output.textContent || 1) + Number(qtyButton.dataset.detailQty || 0)));
          output.textContent = next;
        }
        return;
      }
      const remove = event.target.closest("[data-remove-item]");
      if (remove) removeItem(remove.dataset.removeItem);
      const scroll = event.target.closest("[data-scroll-target]");
      if (scroll) scrollShelf(scroll.dataset.scrollTarget, Number(scroll.dataset.scrollDir || 1));
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDetailModal();
      const card = event.target.closest("[data-food-detail]");
      if (card && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        openDetailModal(card.dataset.foodDetail);
      }
    });
    document.addEventListener("submit", async (event) => {
      const form = event.target.closest("[data-food-detail-form]");
      if (!form || !state.detailItem) return;
      event.preventDefault();
      const submit = form.querySelector("button[type='submit']");
      if (submit) submit.disabled = true;
      try {
        await addCustomizedItem(state.detailItem, detailSelections(form));
      } finally {
        if (submit) submit.disabled = false;
      }
    });
    qs("[data-coupon-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const code = qs("[data-coupon-code]")?.value.trim().toLocaleUpperCase("tr-TR");
      state.discount = code === "ALLONA50" ? 50 : code === "HP100" ? 100 : code ? 25 : 0;
      renderCart();
    });
    qs("[data-progress-order]")?.addEventListener("click", progressOrder);
    qs("[data-food-checkout]")?.addEventListener("click", (event) => {
      if (!state.cart.length && (!App.cart || !App.cart.count || !App.cart.count())) {
        event.preventDefault();
        toast("Ödemeye devam etmek için sepete menü ekleyin.", "error");
      }
    });
  }

  renderHeroAds();
  renderRestaurants();
  renderMenu();
  renderCart();
  bindEvents();
  loadLiveFoodData();
})();
