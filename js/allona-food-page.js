(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core || {};

  const fallbackRestaurants = [
    { id: "burger-house", name: "Allona Burger House", cuisine: "Burger", tags: ["Burger", "Patates", "Soğuk içecek"], rating: 4.8, eta: 24, hp: 35, min: 180, deal: "2 menüye içecek", free: true, open: true, image: "../../images/modules/allona-yemek.png" },
    { id: "blue-pizza", name: "Blue Pizza", cuisine: "Pizza", tags: ["Pizza", "İtalyan", "Aile menüsü"], rating: 4.7, eta: 29, hp: 30, min: 220, deal: "%20 menü indirimi", free: false, open: true, image: "../../images/modules/yemek-light-v5.jpg" },
    { id: "kebap-prestige", name: "Kebap Prestige", cuisine: "Kebap", tags: ["Kebap", "Lahmacun", "Izgara"], rating: 4.9, eta: 34, hp: 42, min: 260, deal: "Aile paketinde HP", free: true, open: true, image: "../../images/modules/allona-yemek.png" },
    { id: "fit-bowl", name: "Fit Bowl Kitchen", cuisine: "Sağlıklı", tags: ["Salata", "Protein", "Vegan"], rating: 4.6, eta: 21, hp: 28, min: 160, deal: "Premium bowl fırsatı", free: false, open: true, image: "../../images/modules/yemek.png" },
    { id: "tatli-kahve", name: "Tatlı & Kahve Atelier", cuisine: "Tatlı", tags: ["Tatlı", "Kahve", "Pasta"], rating: 4.5, eta: 27, hp: 24, min: 120, deal: "Kahve yanında tatlı", free: true, open: true, image: "../../images/modules/allona-yemek.png" },
    { id: "doner-line", name: "Döner Line", cuisine: "Döner", tags: ["Döner", "Ayran", "Menü"], rating: 4.4, eta: 19, hp: 22, min: 110, deal: "Hızlı öğle menüsü", free: false, open: true, image: "../../images/modules/yemek-light-v5.jpg" }
  ];

  const fallbackMenuItems = [
    { id: "premium-burger", restaurant: "Allona Burger House", name: "Premium Burger Menü", desc: "Burger, patates, içecek ve sos", price: 289.99, hp: 35, icon: "fa-burger", image: "../../images/modules/allona-yemek.png" },
    { id: "pizza-duo", restaurant: "Blue Pizza", name: "Pizza Duo Menü", desc: "2 kişilik pizza ve içecek", price: 399.99, hp: 30, icon: "fa-pizza-slice", image: "../../images/modules/yemek-light-v5.jpg" },
    { id: "fit-protein", restaurant: "Fit Bowl Kitchen", name: "Fit Protein Bowl", desc: "Tavuk, yeşillik, tahıl ve sos", price: 249.99, hp: 28, icon: "fa-seedling", image: "../../images/modules/yemek.png" },
    { id: "kebap-family", restaurant: "Kebap Prestige", name: "Kebap Aile Menüsü", desc: "Izgara, lahmacun ve mezeler", price: 599.99, hp: 42, icon: "fa-fire-burner", image: "../../images/modules/allona-yemek.png" },
    { id: "dessert-coffee", restaurant: "Tatlı & Kahve Atelier", name: "Tatlı & Kahve Seti", desc: "Pasta dilimi ve özel kahve", price: 179.99, hp: 24, icon: "fa-mug-hot", image: "../../images/modules/yemek-light-v5.jpg" },
    { id: "quick-doner", restaurant: "Döner Line", name: "Hızlı Döner Menü", desc: "Döner, ayran ve patates", price: 199.99, hp: 22, icon: "fa-utensils", image: "../../images/modules/yemek.png" },
    { id: "vegan-bowl", restaurant: "Fit Bowl Kitchen", name: "Vegan Bowl", desc: "Nohut, avokado, yeşillik ve sos", price: 229.99, hp: 26, icon: "fa-leaf", image: "../../images/modules/yemek.png" },
    { id: "family-pizza", restaurant: "Blue Pizza", name: "Aile Pizza Paketi", desc: "Büyük pizza, tatlı ve içecek", price: 529.99, hp: 38, icon: "fa-people-group", image: "../../images/modules/yemek-light-v5.jpg" }
  ];

  const fallbackHeroAds = [
    { title: "Allona Yemek", subtitle: "Günlük Menü", campaign_text: "Partner menüleri burada döner", description: "Restoran, menü, kurye ve HP avantajı tek yemek akışında.", image_url: "../../images/modules/yemek-light-v5.jpg", cta_label: "Restoranları Gör", link_url: "#food-restaurants", source_id: "fallback-food-hero" },
    { title: "Premium Burger Menü", subtitle: "Allona Burger House", campaign_text: "2 menüye içecek fırsatı", description: "Çok satan menüleri hızlı sepet ve canlı teslimat akışıyla keşfet.", image_url: "../../images/modules/allona-yemek.png", cta_label: "Menüyü Ekle", link_url: "#food-restaurants", source_id: "fallback-burger-hero" },
    { title: "Aile Pizza Paketi", subtitle: "Blue Pizza", campaign_text: "%20 menü indirimi", description: "Partner restoranların günlük kampanyaları reklam alanında sırayla görünür.", image_url: "../../images/modules/yemek.png", cta_label: "Kampanyaya Git", link_url: "#food-restaurants", source_id: "fallback-pizza-hero" }
  ];

  const locations = ["İstanbul, Beşiktaş", "İstanbul, Kadıköy", "Ankara, Çankaya", "İzmir, Alsancak"];
  const state = {
    restaurants: [...fallbackRestaurants],
    menuItems: [...fallbackMenuItems],
    heroAds: [...fallbackHeroAds],
    query: "",
    cuisine: "all",
    mode: "delivery",
    quick: new Set(),
    sort: "recommended",
    cart: [],
    discount: 0,
    trackStep: 1,
    locationIndex: 0,
    dataSource: "fallback"
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

  function escape(value) {
    return core.escapeHTML ? core.escapeHTML(value) : String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char]));
  }

  function url(path) {
    return core.url ? core.url(path) : path;
  }

  function sanitizeUrl(value, fallback) {
    return core.sanitizeUrl ? core.sanitizeUrl(value, fallback) : (value || fallback);
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
    const product = core.normalizeProduct ? core.normalizeProduct(raw) : raw;
    const text = [product.name, product.product_name, product.description, product.category, product.brand, product.seller_name, product.store_name, product.coupon_label, product.delivery_label]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("tr-TR");
    return /yemek|restoran|restaurant|menü|menu|burger|pizza|kebap|döner|doner|tatlı|kahve|pide|lahmacun|bowl|salata|fast food/.test(text);
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
    const products = await withTimeout(App.db.products.listActive({ sort: "newest" }), 4500);
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

      state.heroAds = uniqueAds([
        ...ads.map(heroAdFromRecord),
        ...products.map(productToHeroAd),
        ...fallbackHeroAds
      ]).slice(0, 7);

      renderHeroAds();
      renderRestaurants();
      renderMenu();
      renderCart();
      setStatus(products.length ? "Canlı Supabase ürünleri gösteriliyor." : "Canlı Yemek ürünü bulunamadı; açılış demosu gösteriliyor.", products.length ? "success" : "warning");
    } catch (error) {
      console.warn("Allona Yemek canlı katalog hatası:", error.message || error);
      renderHeroAds();
      setStatus("Canlı katalog şu an alınamadı; güvenli demo katalog gösteriliyor.", "warning");
    }
  }

  function renderHeroAds() {
    const slider = qs("[data-food-hero-slider]");
    const track = qs("[data-food-hero-track]");
    if (!slider || !track || !state.heroAds.length) return;
    track.innerHTML = state.heroAds.map((ad, index) => `
      <article class="food-promo-slide ${index === 0 ? "is-active" : ""}" data-food-hero-slide>
        <img src="${escape(sanitizeUrl(ad.image_url, "/images/modules/yemek-light-v5.jpg"))}" alt="${escape(ad.title)}" loading="${index === 0 ? "eager" : "lazy"}">
        <div class="food-promo-content">
          <p class="food-eyebrow"><i class="fa-solid fa-bolt" aria-hidden="true"></i> ${escape(ad.subtitle)}</p>
          <h${index === 0 ? "1 id=\"hero-title\"" : "2"}>${escape(ad.title)}</h${index === 0 ? "1" : "2"}>
          <p>${escape(ad.description)}</p>
          <strong>${escape(ad.campaign_text)}</strong>
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
      slider.__foodHeroTimer = window.setInterval(() => show(index + 1), 3600);
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
    if (!restaurantGrid || !emptyState || !visibleCount || !summary) return;
    restaurantGrid.innerHTML = list.map((item) => `
      <article class="food-card">
        <div class="food-card-media">
          <img src="${escape(sanitizeUrl(item.image, "/images/modules/yemek-light-v5.jpg"))}" alt="${escape(item.name)}" loading="lazy">
          <div class="food-badge-row">
            <span class="food-badge"><i class="fa-solid fa-star" aria-hidden="true"></i>${escape(Number(item.rating || 4.7).toFixed(1))}</span>
            <span class="food-badge food-badge--green">${escape(item.free ? "Teslimat ücretsiz" : `${item.min} TL min.`)}</span>
          </div>
        </div>
        <div>
          <h3>${escape(item.name)}</h3>
          <p>${escape((item.tags || []).join(" • "))}</p>
        </div>
        <div class="food-meta">
          <span><i class="fa-solid fa-clock" aria-hidden="true"></i>${escape(item.eta)} dk</span>
          <span><i class="fa-solid fa-ticket" aria-hidden="true"></i>${escape(item.deal)}</span>
          <span><i class="fa-solid fa-coins" aria-hidden="true"></i>+${escape(item.hp)} HP</span>
        </div>
        <div class="food-card-footer">
          <strong>${escape(state.mode === "pickup" ? "Gel-Al hazır" : "Teslimat açık")}</strong>
          <button class="food-add" type="button" data-add-suggested="${escape(item.id)}"><i class="fa-solid fa-plus" aria-hidden="true"></i>Menü Ekle</button>
        </div>
      </article>
    `).join("");
    emptyState.classList.toggle("is-visible", list.length === 0);
    visibleCount.textContent = list.length;
    summary.textContent = `${list.length} restoran, ${state.mode === "pickup" ? "gel-al" : "teslimat"} modunda listeleniyor.`;
  }

  function renderMenu() {
    if (!menuGrid) return;
    menuGrid.innerHTML = state.menuItems.map((item) => `
      <article class="food-menu-item">
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
          <button class="food-add" type="button" data-add-item="${escape(item.id)}"><i class="fa-solid fa-plus" aria-hidden="true"></i>Ekle</button>
        </div>
      </article>
    `).join("");
  }

  function itemProductSnapshot(item) {
    if (item.product) return item.product;
    return {
      id: item.id,
      name: item.name,
      description: item.desc,
      category: "Yemek",
      brand: item.restaurant,
      seller_name: item.restaurant,
      price: item.price,
      stock: 99,
      image_url: item.image || "/images/modules/yemek-light-v5.jpg",
      delivery_label: state.mode === "pickup" ? "Gel-Al" : "Bugün teslim",
      coupon_label: item.hp ? `+${item.hp} HP` : ""
    };
  }

  function addLocalSharedCart(product) {
    if (!App.cart?.getItems || !App.cart?.setItems) return;
    const items = App.cart.getItems();
    const found = items.find((item) => String(item.id) === String(product.id));
    if (found) {
      found.qty = Number(found.qty || 1) + 1;
      found.product = found.product || product;
    } else {
      items.push({ id: product.id, qty: 1, product, added_at: new Date().toISOString() });
    }
    App.cart.setItems(items);
    toast("Menü sepete eklendi.");
  }

  async function mirrorSharedCart(item) {
    const product = itemProductSnapshot(item);
    if (!product || !product.id || !App.cart) return;
    try {
      await App.cart.add(product.id, 1, product);
    } catch (error) {
      addLocalSharedCart(product);
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
    if (!cartItems) return;
    if (count === 0) {
      cartItems.innerHTML = `<div class="food-cart-empty">Sepete menü eklediğinde toplam, teslimat ve HP burada görünür.</div>`;
      state.discount = 0;
    } else {
      cartItems.innerHTML = state.cart.map((item) => `
        <div class="food-cart-item">
          <div><b>${escape(item.name)} x${escape(item.qty)}</b><span>${escape(item.restaurant)} • ${money.format(item.price * item.qty)}</span></div>
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
        add.disabled = true;
        try {
          await addItem(add.dataset.addItem || add.dataset.addSuggested);
        } finally {
          add.disabled = false;
        }
        return;
      }
      const remove = event.target.closest("[data-remove-item]");
      if (remove) removeItem(remove.dataset.removeItem);
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
