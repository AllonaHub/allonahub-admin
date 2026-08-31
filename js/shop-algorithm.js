(function () {
  const App = window.Allona = window.Allona || {};
  const PROFILE_KEY = "allona.shopInterestProfile.v1";
  const EXPOSURE_KEY = "allona.shopExposureLedger.v1";
  const VERSION = "20260831-faircommerce1";
  const MAX_PROFILE_TERMS = 48;
  const MAX_PROFILE_ITEMS = 64;
  const PROFILE_DECAY_PER_WEEK = 0.72;
  const EVENT_WEIGHTS = {
    product_click: 1.1,
    favorite: 2.4,
    cart_add: 3.1,
    search: 0.7,
    category_filter: 0.9
  };
  const BASE_WEIGHTS = Object.freeze({
    relevance: 0.27,
    commerce: 0.18,
    quality: 0.14,
    seller: 0.14,
    logistics: 0.11,
    demand: 0.08,
    personalization: 0.05,
    discovery: 0.03
  });
  const SECTION_WEIGHTS = Object.freeze({
    catalog: BASE_WEIGHTS,
    featured: {
      relevance: 0.2,
      commerce: 0.18,
      quality: 0.14,
      seller: 0.17,
      logistics: 0.12,
      demand: 0.08,
      personalization: 0.06,
      discovery: 0.05
    },
    recommended: {
      relevance: 0.2,
      commerce: 0.14,
      quality: 0.12,
      seller: 0.13,
      logistics: 0.1,
      demand: 0.08,
      personalization: 0.18,
      discovery: 0.05
    },
    hero_ad: {
      relevance: 0.14,
      commerce: 0.22,
      quality: 0.18,
      seller: 0.13,
      logistics: 0.13,
      demand: 0.11,
      personalization: 0.04,
      discovery: 0.05
    }
  });
  const SENSITIVE_TERMS = [
    "saglik",
    "saglık",
    "sağlik",
    "sağlık",
    "ilac",
    "ilaç",
    "vitamin",
    "takviye",
    "hijyen",
    "ic giyim",
    "iç giyim",
    "sutyen",
    "sütyen",
    "kulot",
    "külot",
    "hamile",
    "emzirme",
    "tiras",
    "tıraş",
    "epilasyon"
  ];

  function label(value, fallback = "") {
    if (App.core?.labelFromValue) return App.core.labelFromValue(value, fallback);
    if (value == null) return fallback;
    if (Array.isArray(value)) return value.map((item) => label(item, "")).filter(Boolean).join(", ") || fallback;
    if (typeof value === "object") return label(value.name || value.title || value.label || value.category_name || value.categoryName || value.category, fallback);
    const text = String(value || "").trim();
    return text && !/^(\[object object\]|undefined|null|nan)$/i.test(text) ? text : fallback;
  }

  function normalizeText(value) {
    const normalizer = App.shopCategories?.normalizeText;
    if (normalizer) return normalizer(value);
    return String(value || "")
      .trim()
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9ğüşöçıİ\s-]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value));
  }

  function logRatio(value, max) {
    const amount = Math.max(0, safeNumber(value));
    const ceiling = Math.max(1, safeNumber(max, 1));
    return clamp(Math.log1p(amount) / Math.log1p(ceiling));
  }

  function normalizeProduct(raw) {
    const product = App.core?.normalizeProduct ? App.core.normalizeProduct(raw || {}) : (raw || {});
    return {
      ...product,
      name: label(product.name || product.product_name, "Ürün"),
      category: label(product.category || product.category_name || product.categoryName, "Genel"),
      brand: label(product.brand || product.brand_name || product.brandName, ""),
      seller_public_name: label(product.seller_public_name || product.seller_name || product.partner_name || product.store_name || product.shop_name, "AllonaHub"),
      price: safeNumber(product.price),
      stock: safeNumber(product.stock),
      sold_count: safeNumber(product.sold_count),
      rating: safeNumber(product.rating || product.average_rating),
      review_count: safeNumber(product.review_count || product.reviews_count || product.rating_count),
      favorite_count: safeNumber(product.favorite_count || product.favorites_count || product.favorite_total),
      cart_count: safeNumber(product.cart_count || product.in_cart_count || product.cart_add_count),
      view_count: safeNumber(product.view_count || product.views_24h || product.view_count_24h),
      seller_score: safeNumber(product.seller_score || product.store_score || product.partner_score)
    };
  }

  function productId(product) {
    return String(product?.id || product?.slug || product?.name || "").trim();
  }

  function sellerKey(product) {
    return normalizeText(product.partner_id || product.seller_id || product.seller_public_name || product.seller_name || product.brand || "allona");
  }

  function brandKey(product) {
    return normalizeText(product.brand || "");
  }

  function productText(product) {
    return normalizeText([
      product.name,
      product.description,
      product.category,
      product.brand,
      product.seller_public_name,
      product.meta_title,
      product.meta_description
    ].filter(Boolean).join(" "));
  }

  function isSensitive(value) {
    const text = normalizeText(value);
    return Boolean(text && SENSITIVE_TERMS.some((term) => text.includes(normalizeText(term))));
  }

  function readJson(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function allowsAnalytics() {
    return Boolean(App.privacy?.allows?.("analytics") || App.privacy?.allows?.("marketing"));
  }

  function allowsPersonalization() {
    return Boolean(App.privacy?.allows?.("marketing"));
  }

  function emptyProfile() {
    return {
      version: VERSION,
      categories: {},
      brands: {},
      terms: {},
      products: {},
      updated_at: new Date().toISOString()
    };
  }

  function decayProfile(profile) {
    const current = profile && typeof profile === "object" ? profile : emptyProfile();
    const updatedAt = Date.parse(current.updated_at || "");
    const ageDays = Number.isFinite(updatedAt) ? Math.max(0, (Date.now() - updatedAt) / 86400000) : 0;
    const factor = Math.pow(PROFILE_DECAY_PER_WEEK, ageDays / 7);
    const next = {
      version: VERSION,
      categories: decayMap(current.categories, factor, MAX_PROFILE_ITEMS),
      brands: decayMap(current.brands, factor, MAX_PROFILE_ITEMS),
      terms: decayMap(current.terms, factor, MAX_PROFILE_TERMS),
      products: decayMap(current.products, factor, MAX_PROFILE_ITEMS),
      updated_at: new Date().toISOString()
    };
    return next;
  }

  function decayMap(map, factor, limit) {
    return Object.fromEntries(Object.entries(map || {})
      .map(([key, value]) => [key, clamp(safeNumber(value) * factor, 0, 50)])
      .filter(([, value]) => value >= 0.05)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit));
  }

  function readProfile() {
    if (!allowsPersonalization()) return emptyProfile();
    return decayProfile(readJson(PROFILE_KEY, emptyProfile()));
  }

  function bump(map, key, amount) {
    const normalized = normalizeText(key);
    if (!normalized || isSensitive(normalized)) return;
    map[normalized] = clamp(safeNumber(map[normalized]) + amount, 0, 50);
  }

  function rememberInterest(eventName, rawProduct, detail = {}) {
    if (!allowsPersonalization()) return null;
    const weight = EVENT_WEIGHTS[eventName] || 0.5;
    if (!weight) return null;
    const hasProductSignal = Boolean(rawProduct && (
      rawProduct.id
      || rawProduct.slug
      || rawProduct.name
      || rawProduct.product_name
      || rawProduct.category
      || rawProduct.category_name
      || rawProduct.brand
    ));
    const product = normalizeProduct(rawProduct || {});
    const profile = readProfile();
    if (hasProductSignal) {
      bump(profile.categories, product.category, weight);
      bump(profile.brands, product.brand, weight * 0.75);
      const id = productId(product);
      if (id) bump(profile.products, id, weight * 0.8);
    }

    const query = label(detail.search || detail.query || "", "");
    if (query && !isSensitive(query)) {
      query.split(/\s+/).filter((term) => term.length >= 3).slice(0, 6).forEach((term) => bump(profile.terms, term, weight * 0.7));
    }
    if (hasProductSignal) {
      productText(product).split(/\s+/).filter((term) => term.length >= 4).slice(0, 10).forEach((term) => bump(profile.terms, term, weight * 0.2));
    }
    profile.updated_at = new Date().toISOString();
    writeJson(PROFILE_KEY, profile);
    return profile;
  }

  function recordEvent(eventName, rawProduct, detail = {}) {
    const product = rawProduct ? normalizeProduct(rawProduct) : {};
    document.dispatchEvent(new CustomEvent("allona:shop-algorithm-signal", {
      detail: {
        version: VERSION,
        event: eventName,
        product_id: productId(product),
        seller_key: sellerKey(product),
        surface: detail.surface || "",
        analytics_allowed: allowsAnalytics(),
        personalization_allowed: allowsPersonalization()
      }
    }));
    return rememberInterest(eventName, product, detail);
  }

  function catalogEligibility(product) {
    const activeStatus = !product.status || ["active", "published", "approved"].includes(String(product.status).toLocaleLowerCase("tr-TR"));
    const hasIdentity = Boolean(productId(product) || product.name);
    const hasImage = Boolean(label(product.image_url || product.image, ""));
    const hasCategory = normalizeText(product.category) !== "genel";
    const hasPrice = product.price > 0;
    const hasStock = product.stock > 0;
    return {
      canShow: activeStatus && hasIdentity,
      canPurchase: activeStatus && hasIdentity && hasPrice && hasStock,
      hasImage,
      hasCategory,
      hasPrice,
      hasStock
    };
  }

  function buildStats(items) {
    const products = items.map(normalizeProduct);
    const sellerCounts = new Map();
    const brandCounts = new Map();
    products.forEach((product) => {
      sellerCounts.set(sellerKey(product), (sellerCounts.get(sellerKey(product)) || 0) + 1);
      const brand = brandKey(product);
      if (brand) brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
    });
    return {
      maxSold: Math.max(1, ...products.map((item) => item.sold_count)),
      maxReviews: Math.max(1, ...products.map((item) => item.review_count)),
      maxFavorites: Math.max(1, ...products.map((item) => item.favorite_count)),
      maxCart: Math.max(1, ...products.map((item) => item.cart_count)),
      maxViews: Math.max(1, ...products.map((item) => item.view_count)),
      sellerCounts,
      brandCounts,
      sellerVariety: sellerCounts.size,
      brandVariety: brandCounts.size
    };
  }

  function dataQualityScore(product, eligibility) {
    const checks = [
      productId(product),
      product.name && product.name.length >= 8,
      product.description && product.description.length >= 24,
      eligibility.hasCategory,
      eligibility.hasImage,
      product.brand,
      eligibility.hasPrice,
      eligibility.hasStock
    ];
    return checks.filter(Boolean).length / checks.length;
  }

  function sellerHealthScore(product) {
    const raw = product.seller_score;
    if (raw > 0) return clamp(raw > 5 ? raw / 10 : raw / 5);
    if (product.partner_id || product.is_partner_product) return 0.58;
    return 0.62;
  }

  function commerceScore(product, eligibility) {
    if (!eligibility.hasPrice || !eligibility.hasStock) return 0.18;
    const discount = safeNumber(product.discount_percent) > 0 || product.compare_at_price > product.price ? 0.18 : 0;
    const priceReadiness = product.price > 0 ? 0.36 : 0;
    const stockReadiness = product.stock > 0 ? 0.28 : 0;
    const socialReadiness = product.favorite_count || product.cart_count || product.sold_count ? 0.18 : 0.08;
    return clamp(priceReadiness + stockReadiness + discount + socialReadiness);
  }

  function logisticsScore(product, eligibility) {
    if (!eligibility.hasStock) return 0;
    const delivery = normalizeText(product.delivery_label || product.shipping_label || product.fulfillment_label || "");
    const fast = /hizli|bugun|ayni gun|yarin|dijital|express/.test(delivery) ? 0.35 : 0.12;
    const freeShipping = product.price >= Number(App.config?.freeShippingThreshold || 1500) || /ucretsiz/.test(delivery) ? 0.25 : 0;
    const stockDepth = clamp(product.stock / 50) * 0.3;
    return clamp(fast + freeShipping + stockDepth + 0.1);
  }

  function demandScore(product, stats) {
    const rating = product.rating ? clamp(product.rating / 5) * 0.28 : 0.1;
    const reviews = logRatio(product.review_count, stats.maxReviews) * 0.18;
    const sales = logRatio(product.sold_count, stats.maxSold) * 0.22;
    const favorites = logRatio(product.favorite_count, stats.maxFavorites) * 0.14;
    const cart = logRatio(product.cart_count, stats.maxCart) * 0.12;
    const views = logRatio(product.view_count, stats.maxViews) * 0.06;
    return clamp(rating + reviews + sales + favorites + cart + views);
  }

  function relevanceScore(product, context) {
    const text = productText(product);
    const selectedCategory = normalizeText(context.category || context.filters?.category || "");
    const query = normalizeText(context.search || context.filters?.search || context.query || "");
    const quick = context.quick || context.filters?.quick || "";
    let score = 0.36;
    if (selectedCategory) score += text.includes(selectedCategory) ? 0.26 : -0.08;
    if (query) {
      const terms = query.split(/\s+/).filter((term) => term.length >= 2);
      const matched = terms.filter((term) => text.includes(term)).length;
      score += terms.length ? (matched / terms.length) * 0.28 : 0;
    }
    if (quick === "deals" && (product.discount_percent > 0 || product.compare_at_price > product.price)) score += 0.08;
    if (quick === "fast" && logisticsScore(product, catalogEligibility(product)) >= 0.6) score += 0.08;
    if (quick === "rated" && product.rating >= 4.5) score += 0.08;
    if (quick === "top" && product.sold_count >= 100) score += 0.08;
    return clamp(score);
  }

  function profileScore(product) {
    if (!allowsPersonalization()) return 0;
    const profile = readProfile();
    const category = normalizeText(product.category);
    const brand = brandKey(product);
    const id = normalizeText(productId(product));
    const text = productText(product);
    const categoryScore = clamp(safeNumber(profile.categories[category]) / 12) * 0.34;
    const brandScore = clamp(safeNumber(profile.brands[brand]) / 12) * 0.22;
    const productScore = clamp(safeNumber(profile.products[id]) / 8) * 0.18;
    const termScore = clamp(Object.entries(profile.terms || {}).reduce((total, [term, value]) => (
      text.includes(term) ? total + safeNumber(value) : total
    ), 0) / 24) * 0.26;
    return clamp(categoryScore + brandScore + productScore + termScore);
  }

  function discoveryScore(product, stats, eligibility) {
    const sellerPoolShare = stats.sellerVariety > 1 ? 1 / Math.max(1, stats.sellerCounts.get(sellerKey(product)) || 1) : 0.35;
    const lowMomentum = demandScore(product, stats) < 0.35 ? 0.22 : 0.06;
    const partnerBoost = product.partner_id || product.is_partner_product ? 0.16 : 0.08;
    const readyBoost = eligibility.canPurchase ? 0.2 : 0;
    const qualityBoost = dataQualityScore(product, eligibility) >= 0.74 ? 0.24 : 0.08;
    return clamp((sellerPoolShare * 0.3) + lowMomentum + partnerBoost + readyBoost + qualityBoost);
  }

  function scoreProduct(rawProduct, context, stats) {
    const product = normalizeProduct(rawProduct);
    const eligibility = catalogEligibility(product);
    if (!eligibility.canShow) return null;
    const sectionWeights = SECTION_WEIGHTS[context.section] || BASE_WEIGHTS;
    const scores = {
      relevance: relevanceScore(product, context),
      commerce: commerceScore(product, eligibility),
      quality: dataQualityScore(product, eligibility),
      seller: sellerHealthScore(product),
      logistics: logisticsScore(product, eligibility),
      demand: demandScore(product, stats),
      personalization: profileScore(product),
      discovery: discoveryScore(product, stats, eligibility)
    };
    const saleReadinessPenalty = eligibility.canPurchase ? 0 : -0.18;
    const finalScore = Object.entries(sectionWeights).reduce((total, [key, weight]) => total + (scores[key] || 0) * weight, 0) + saleReadinessPenalty;
    return {
      product: rawProduct,
      normalized: product,
      seller: sellerKey(product),
      brand: brandKey(product),
      eligibility,
      scores,
      finalScore
    };
  }

  function diversify(scored, context = {}) {
    if (scored.length <= 2) return scored;
    const sellerVariety = new Set(scored.map((item) => item.seller)).size;
    if (sellerVariety <= 1) return scored;
    const windowSize = Math.min(scored.length, Math.max(8, safeNumber(context.windowSize, 24)));
    const maxSellerInWindow = Math.max(1, Math.ceil(windowSize * safeNumber(context.maxSellerShare, 0.34)));
    const maxBrandInWindow = Math.max(2, Math.ceil(windowSize * safeNumber(context.maxBrandShare, 0.46)));
    const selected = [];
    const delayed = [];
    const sellers = new Map();
    const brands = new Map();

    scored.forEach((item) => {
      const inPriorityWindow = selected.length < windowSize;
      const sellerCount = sellers.get(item.seller) || 0;
      const brandCount = item.brand ? (brands.get(item.brand) || 0) : 0;
      const sellerBlocked = inPriorityWindow && sellerCount >= maxSellerInWindow;
      const brandBlocked = inPriorityWindow && item.brand && brandCount >= maxBrandInWindow;
      if (sellerBlocked || brandBlocked) {
        delayed.push(item);
        return;
      }
      selected.push(item);
      sellers.set(item.seller, sellerCount + 1);
      if (item.brand) brands.set(item.brand, brandCount + 1);
    });

    return [...selected, ...delayed];
  }

  function rankProducts(productList, context = {}) {
    const items = Array.isArray(productList) ? productList : [];
    if (!items.length) return [];
    const stats = buildStats(items);
    const scored = items
      .map((item) => scoreProduct(item, context, stats))
      .filter(Boolean)
      .sort((a, b) => b.finalScore - a.finalScore);
    return diversify(scored, context).map((item) => item.product);
  }

  function rankSection(productList, section, context = {}) {
    return rankProducts(productList, { ...context, section });
  }

  function recordImpressions(items, detail = {}) {
    if (!allowsAnalytics() || !Array.isArray(items) || !items.length) return;
    const ledger = readJson(EXPOSURE_KEY, { version: VERSION, sellers: {}, products: {}, updated_at: "" });
    items.slice(0, 24).forEach((rawProduct, index) => {
      const product = normalizeProduct(rawProduct);
      const seller = sellerKey(product);
      const id = productId(product);
      const weight = 1 / Math.max(1, index + 1);
      if (seller) ledger.sellers[seller] = safeNumber(ledger.sellers[seller]) + weight;
      if (id) ledger.products[id] = safeNumber(ledger.products[id]) + weight;
    });
    ledger.version = VERSION;
    ledger.updated_at = new Date().toISOString();
    ledger.sellers = decayMap(ledger.sellers, 1, 160);
    ledger.products = decayMap(ledger.products, 1, 240);
    writeJson(EXPOSURE_KEY, ledger);
    document.dispatchEvent(new CustomEvent("allona:shop-algorithm-impressions", {
      detail: {
        version: VERSION,
        surface: detail.surface || "",
        count: items.length
      }
    }));
  }

  let lastContextKey = "";
  function trackCatalogContext(filters = {}) {
    const key = JSON.stringify({
      search: label(filters.search, ""),
      category: label(filters.category, ""),
      quick: label(filters.quick, "")
    });
    if (!key || key === lastContextKey) return;
    lastContextKey = key;
    if (filters.search) recordEvent("search", {}, { search: filters.search, surface: "catalog_filter" });
    if (filters.category) recordEvent("category_filter", { category: filters.category }, { surface: "catalog_filter" });
  }

  function productSnapshotFromElement(element) {
    const raw = element?.dataset?.productSnapshot || element?.closest?.("[data-product-snapshot]")?.dataset?.productSnapshot || "";
    if (!raw) return null;
    try {
      return JSON.parse(decodeURIComponent(raw));
    } catch (error) {
      return null;
    }
  }

  function bindBehaviorSignals() {
    if (document.documentElement.dataset.shopAlgorithmSignalsBound === "true") return;
    document.documentElement.dataset.shopAlgorithmSignalsBound = "true";
    document.addEventListener("click", (event) => {
      const shell = event.target.closest?.('.site-shell[data-page="shop"]');
      if (!shell) return;
      const addButton = event.target.closest("[data-add-product]");
      const favButton = event.target.closest("[data-fav-product]");
      const previewLink = event.target.closest("[data-product-preview-link]");
      const source = addButton || favButton || previewLink;
      if (!source) return;
      const snapshot = productSnapshotFromElement(source) || { id: source.dataset.addProduct || source.dataset.favProduct || source.dataset.productPreviewLink };
      if (addButton) recordEvent("cart_add", snapshot, { surface: "product_card" });
      else if (favButton) recordEvent("favorite", snapshot, { surface: "product_card" });
      else recordEvent("product_click", snapshot, { surface: "product_card" });
    }, true);
  }

  App.shopAlgorithm = {
    version: VERSION,
    rankProducts,
    rankSection,
    scoreProduct,
    recordEvent,
    recordImpressions,
    trackCatalogContext,
    allowsPersonalization,
    allowsAnalytics,
    bindBehaviorSignals
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindBehaviorSignals);
  } else {
    bindBehaviorSignals();
  }
})();
