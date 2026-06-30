(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const config = App.config;
  const security = App.security;

  function isPasswordRecoveryType(type) {
    return ["recovery", "password_recovery"].includes(String(type || "").toLowerCase());
  }

  function hasPasswordRecoveryParams() {
    const sources = [
      new URLSearchParams(window.location.search || ""),
      new URLSearchParams(String(window.location.hash || "").replace(/^#/, ""))
    ];

    return sources.some((params) => {
      const type = String(params.get("type") || "").toLowerCase();
      return isPasswordRecoveryType(type);
    });
  }

  function passwordResetUrl(preserveCurrentUrl) {
    const resetPath = core && core.url ? core.url("/pages/account/reset-password.html") : "/pages/account/reset-password.html";
    const target = new URL(resetPath, window.location.origin);
    if (preserveCurrentUrl) {
      target.search = window.location.search || "";
      target.hash = window.location.hash || "";
    }
    return target;
  }

  function redirectPasswordRecovery() {
    if (!hasPasswordRecoveryParams()) return false;
    if (/\/pages\/account\/reset-password\.html$/i.test(window.location.pathname)) return false;

    window.location.replace(passwordResetUrl(true).href);
    return true;
  }

  if (redirectPasswordRecovery()) return;

  if (window.supabase && config.supabaseUrl && config.supabaseAnonKey) {
    App.supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

  function clearAuthArtifacts(options) {
    const settings = options || {};
    const explicitKeys = [
      "allonahub_user_profile",
      "allonahub_auth_verified_at",
      "allonaPartnerLoggedIn",
      "allonaPartnerEmail",
      "allonaPartnerUserId",
      "allonaPartnerProfile",
      "allonaPartnerId",
      "allonaPartnerType"
    ];

    explicitKeys.forEach((key) => localStorage.removeItem(key));

    const removablePrefixes = [
      "allonahub.daily-login.",
      "allona_rate:login",
      "allona_rate:partner-login"
    ];

    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index) || "";
      if (removablePrefixes.some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key);
      }
      if (settings.supabaseTokens && /^sb-.+-auth-token$/.test(key)) {
        localStorage.removeItem(key);
      }
    }
  }

  App.clearAuthArtifacts = clearAuthArtifacts;

  if (App.supabase && App.supabase.auth && App.supabase.auth.onAuthStateChange) {
    App.supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && !/\/pages\/account\/reset-password\.html$/i.test(window.location.pathname)) {
        window.location.replace(passwordResetUrl(false).href);
        return;
      }
      if (event === "SIGNED_OUT" || event === "USER_DELETED") {
        clearAuthArtifacts();
      }
    });
  }

  function client() {
    if (!App.supabase) {
      throw new Error("Supabase istemcisi yüklenemedi.");
    }
    return App.supabase;
  }

  function sortProducts(items, sort) {
    const list = [...items];
    if (sort === "price_asc") return list.sort((a, b) => a.price - b.price);
    if (sort === "price_desc") return list.sort((a, b) => b.price - a.price);
    if (sort === "best_selling") return list.sort((a, b) => b.sold_count - a.sold_count);
    return list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }

  function normalizedScope(value) {
    const scope = String(value || "")
      .trim()
      .toLocaleLowerCase("tr-TR")
      .replace(/[\s-]+/g, "_");
    if (["food", "yemek", "allona_yemek", "allonayemek", "restaurant", "restoran"].includes(scope)) return "food";
    if (["market", "allona_market", "allonamarket", "supermarket", "süpermarket", "grocery"].includes(scope)) return "market";
    if (["shop", "allona_shop", "allonashop", "marketplace", "pazaryeri"].includes(scope)) return "shop";
    if (["service", "hizmet", "services", "ecosystem", "ekosistem"].includes(scope)) return "service";
    return "";
  }

  function explicitCatalogScope(item) {
    const candidates = [
      item.module_key,
      item.moduleKey,
      item.catalog_scope,
      item.catalogScope,
      item.module_scope,
      item.moduleScope,
      item.commerce_scope,
      item.commerceScope,
      item.product_scope,
      item.productScope
    ];
    for (const candidate of candidates) {
      const scope = normalizedScope(candidate);
      if (scope) return scope;
    }

    const sku = String(item.sku || item.product_sku || "").trim().toLocaleUpperCase("tr-TR");
    if (/^ALM[-_]/.test(sku)) return "market";
    if (/^ALY[-_]/.test(sku)) return "food";
    if (/^(ALS|ASHOP|ALSHOP|SHOP)[-_]/.test(sku)) return "shop";
    return "";
  }

  function productCatalogText(item) {
    const categoryLabel = core.labelFromValue ? core.labelFromValue(item.category, "") : item.category;
    return [
      item.name,
      item.product_name,
      item.description,
      categoryLabel,
      item.brand,
      item.seller_name,
      item.partner_name,
      item.store_name,
      item.coupon_label,
      item.delivery_label
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("tr-TR");
  }

  function isFoodCatalogProduct(raw) {
    const item = core.normalizeProduct ? core.normalizeProduct(raw) : (raw || {});
    const explicit = explicitCatalogScope(item);
    if (explicit === "food") return true;
    if (explicit && explicit !== "shop") return false;

    const category = String(item.category || "").toLocaleLowerCase("tr-TR");
    const merchant = [item.brand, item.seller_name, item.partner_name, item.store_name]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("tr-TR");
    if (/yemek|restoran|restaurant|lokanta|pizzacı|pizzaci|kebapçı|kebapci|dönerci|donerci/.test(`${category} ${merchant}`)) {
      return true;
    }

    const text = productCatalogText(item);
    const foodSignal = /burger|pizza|kebap|döner|doner|dürüm|durum|tatlı|tatli|kahve|pide|lahmacun|bowl|salata|fast food/.test(text);
    const serviceSignal = /menü|menu|sipariş|siparis|restoran|restaurant|teslimat|kurye|soğan|sogan|soslu|sossuz/.test(text);
    return foodSignal && serviceSignal;
  }

  function isMarketCatalogProduct(raw) {
    const item = core.normalizeProduct ? core.normalizeProduct(raw) : (raw || {});
    const explicit = explicitCatalogScope(item);
    if (explicit === "market") return true;
    if (explicit && explicit !== "shop") return false;

    const category = String(item.category || "").toLocaleLowerCase("tr-TR");
    const merchant = [item.brand, item.seller_name, item.partner_name, item.store_name]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("tr-TR");
    const sku = String(item.sku || "").toLocaleLowerCase("tr-TR");
    if (/allona market|market \/|süpermarket|supermarket/.test(`${category} ${merchant}`)) return true;
    if (/^alm[-_]/.test(sku)) return true;

    const marketText = [
      item.name,
      item.product_name,
      item.category,
      item.brand,
      item.seller_name,
      item.partner_name,
      item.store_name,
      item.sku
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("tr-TR");
    return /meyve|sebze|kahvaltı|kahvalti|süt|sut|yumurta|zeytin|zeytinyağı|zeytinyagi|makarna|temel gıda|temel gida|içecek|icecek|temizlik|deterjan|kağıt|kagit|bebek|ıslak mendil|islak mendil|atıştırmalık|atistirmalik|petshop/.test(marketText);
  }

  function matchesCatalogScope(item, scope) {
    const target = normalizedScope(scope);
    if (target === "food") return isFoodCatalogProduct(item);
    if (target === "market") return isMarketCatalogProduct(item);
    if (target === "shop") return !isFoodCatalogProduct(item) && !isMarketCatalogProduct(item);
    return true;
  }

  function filterProducts(items, filters) {
    const options = filters || {};
    const q = String(options.search || "").trim().toLocaleLowerCase("tr-TR");
    const category = String(options.category || "").trim().toLocaleLowerCase("tr-TR");
    const min = Number(options.minPrice || 0);
    const max = Number(options.maxPrice || 0);

    return items.filter((item) => {
      if (!matchesCatalogScope(item, options.scope)) return false;
      const itemCategory = App.core?.labelFromValue ? App.core.labelFromValue(item.category, "") : String(item.category || "");
      const text = `${item.name} ${item.description} ${itemCategory} ${item.brand || ""}`.toLocaleLowerCase("tr-TR");
      const categoryMatch = !category || (App.shopCategories?.productMatchesCategory
        ? App.shopCategories.productMatchesCategory(item, options.category)
        : itemCategory.toLocaleLowerCase("tr-TR") === category);
      const searchMatch = !q || text.includes(q);
      const minMatch = !min || item.price >= min;
      const maxMatch = !max || item.price <= max;
      return categoryMatch && searchMatch && minMatch && maxMatch;
    });
  }

  function missingBackend(error) {
    const message = `${error && error.message || ""} ${error && error.details || ""} ${error && error.hint || ""}`;
    return /function|schema cache|could not find|does not exist|not found/i.test(message);
  }

  async function listActiveProducts(filters) {
    const { data, error } = await client()
      .from("products")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) throw error;
    const normalized = (data || []).map(core.normalizeProduct);
    const filtered = filterProducts(normalized, filters);
    return sortProducts(filtered, filters && filters.sort);
  }

  async function productsByIds(ids) {
    const cleanIds = [...new Set((ids || []).filter(Boolean))];
    if (!cleanIds.length) return [];
    const { data, error } = await client()
      .from("products")
      .select("*")
      .in("id", cleanIds)
      .eq("status", "active");

    if (error) throw error;
    return (data || []).map(core.normalizeProduct);
  }

  async function productById(id) {
    const { data, error } = await client()
      .from("products")
      .select("*")
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw error;
    return data ? core.normalizeProduct(data) : null;
  }

  async function allProducts() {
    const { data, error } = await client()
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(core.normalizeProduct);
  }

  async function upsertProduct(payload) {
    const cleanName = security ? security.normalizeText(payload.name || payload.product_name, { max: 180 }) : String(payload.name || payload.product_name || "").trim();
    if (!cleanName) throw new Error("Ürün adı zorunludur.");
    if (payload.id && security && !security.isUuid(payload.id)) throw new Error("Ürün kimliği geçersiz.");
    const status = ["active", "draft", "archived"].includes(payload.status) ? payload.status : "active";
    const description = security ? security.normalizeMultiline(payload.description, { max: 1800 }) : payload.description || "";
    const categoryLabel = core.labelFromValue ? core.labelFromValue(payload.category, "Genel") : String(payload.category || "Genel");
    const category = security ? security.normalizeText(categoryLabel || "Genel", { max: 90 }) : categoryLabel || "Genel";
    const brand = security ? security.normalizeText(payload.brand || payload.seller_name || "", { max: 120 }) : payload.brand || payload.seller_name || "";
    const rawImageUrl = String(payload.image_url || "").trim();
    const imageUrl = security
      ? (security.sanitizePublicUrl(rawImageUrl) || (/^(\/?images\/|\.{1,2}\/images\/)/i.test(rawImageUrl) ? rawImageUrl : ""))
      : rawImageUrl;
    const normalizeGallery = (value) => {
      if (Array.isArray(value)) return value;
      const raw = String(value || "").trim();
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // CSV and Excel imports may pass galleries as comma or newline separated text.
      }
      return raw.split(/[\n,]+/);
    };
    const mediaGallery = normalizeGallery(payload.media_gallery)
      .map((url) => String(url || "").trim())
      .map((url) => security ? (security.sanitizePublicUrl(url) || (/^(\/?images\/|\.{1,2}\/images\/)/i.test(url) ? url : "")) : url)
      .filter(Boolean)
      .slice(0, 8);
    const rawVideoUrl = String(payload.video_url || "").trim();
    const videoUrl = security ? security.sanitizePublicUrl(rawVideoUrl) : rawVideoUrl;
    const price = Number(payload.price || 0);
    const stock = Number(payload.stock || 0);
    const moduleKey = normalizedScope(payload.module_key || payload.catalog_scope || payload.catalogScope || payload.moduleScope || payload.scope) || "shop";
    const skuPrefix = moduleKey === "market" ? "ALM" : moduleKey === "food" ? "ALY" : moduleKey === "service" ? "ALS" : "ALP";
    const sellerFields = {
      seller_public_name: security ? security.normalizeText(payload.seller_public_name || payload.seller_name || payload.brand || "", { max: 140 }) : String(payload.seller_public_name || payload.seller_name || payload.brand || "").trim(),
      seller_kind: security ? security.normalizeText(payload.seller_kind || (payload.partner_id ? "Partner satıcı" : "Platform satıcısı"), { max: 60 }) : String(payload.seller_kind || (payload.partner_id ? "Partner satıcı" : "Platform satıcısı")).trim(),
      seller_legal_name: security ? security.normalizeText(payload.seller_legal_name || "", { max: 180 }) : String(payload.seller_legal_name || "").trim(),
      seller_city: security ? security.normalizeText(payload.seller_city || "", { max: 90 }) : String(payload.seller_city || "").trim(),
      seller_contact: security ? security.normalizeText(payload.seller_contact || payload.partner_email || "", { max: 180 }) : String(payload.seller_contact || payload.partner_email || "").trim(),
      seller_tax_number_masked: security ? security.normalizeText(payload.seller_tax_number_masked || "", { max: 40 }) : String(payload.seller_tax_number_masked || "").trim(),
      invoice_responsibility: security ? security.normalizeText(payload.invoice_responsibility || "", { max: 260 }) : String(payload.invoice_responsibility || "").trim(),
      seller_disclosure: security ? security.normalizeText(payload.seller_disclosure || "", { max: 320 }) : String(payload.seller_disclosure || "").trim(),
      compliance_review_status: ["pending", "approved", "rejected", "needs_review"].includes(payload.compliance_review_status) ? payload.compliance_review_status : "pending",
      compliance_notes: security ? security.normalizeText(payload.compliance_notes || "", { max: 360 }) : String(payload.compliance_notes || "").trim()
    };
    const modernProduct = {
      name: cleanName,
      description,
      price,
      stock,
      image_url: imageUrl,
      category,
      module_key: moduleKey,
      status,
      slug: payload.slug ? core.slugify(payload.slug) : core.slugify(cleanName),
      meta_title: security ? security.normalizeText(payload.meta_title || cleanName, { max: 180 }) : payload.meta_title || cleanName,
      meta_description: security ? security.normalizeText(payload.meta_description || payload.description || "", { max: 260 }) : payload.meta_description || payload.description || "",
      brand,
      partner_id: payload.partner_id || undefined,
      media_gallery: mediaGallery.length ? mediaGallery : (imageUrl ? [imageUrl] : []),
      video_url: videoUrl || "",
      ...sellerFields
    };

    const legacyProduct = {
      product_name: cleanName,
      description,
      price,
      old_price: Number(payload.old_price || payload.compare_at_price || price || 0),
      stock,
      image_url: imageUrl,
      category,
      module_key: moduleKey,
      status,
      brand,
      partner_id: security && security.isUuid(payload.partner_id) ? payload.partner_id : String(payload.partner_code || payload.partner_id || "ALP-PARTNER"),
      partner_email: payload.partner_email || "",
      coupon_status: payload.coupon_status || payload.coupon_label || "Aktif",
      hp_status: payload.hp_status || payload.hp_label || "Aktif",
      sku: payload.sku || core.slugify(`${skuPrefix}-${cleanName}-${payload.partner_id || "partner"}`).toUpperCase().slice(0, 48),
      barcode: payload.barcode || "",
      media_gallery: mediaGallery.length ? mediaGallery : (imageUrl ? [imageUrl] : []),
      video_url: videoUrl || "",
      ...sellerFields
    };

    function withoutOptionalMediaFields(product) {
      const {
        media_gallery: _mediaGallery,
        video_url: _videoUrl,
        ...rest
      } = product;
      return rest;
    }

    function withoutSellerFields(product) {
      const {
        seller_public_name: _sellerPublicName,
        seller_kind: _sellerKind,
        seller_legal_name: _sellerLegalName,
        seller_city: _sellerCity,
        seller_contact: _sellerContact,
        seller_tax_number_masked: _sellerTaxNumberMasked,
        invoice_responsibility: _invoiceResponsibility,
        seller_disclosure: _sellerDisclosure,
        compliance_review_status: _complianceReviewStatus,
        compliance_notes: _complianceNotes,
        ...rest
      } = product;
      return rest;
    }

    function isSchemaFallbackError(error) {
      const message = `${error && error.message || ""} ${error && error.details || ""} ${error && error.hint || ""}`;
      return /column|schema cache|could not find|does not exist|invalid input syntax for type uuid|module_key|catalog_scope/i.test(message);
    }

    async function runWrite(product) {
      const query = payload.id
        ? client().from("products").update(product).eq("id", payload.id).select("*").single()
        : client().from("products").insert(product).select("*").single();
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }

    try {
      return core.normalizeProduct(await runWrite(modernProduct));
    } catch (error) {
      if (!isSchemaFallbackError(error)) throw error;
      const { module_key: _moduleKey, ...legacyWithoutModuleKey } = legacyProduct;
      const variants = [
        legacyProduct,
        withoutOptionalMediaFields(modernProduct),
        withoutOptionalMediaFields(legacyProduct),
        withoutSellerFields(modernProduct),
        withoutSellerFields(legacyProduct),
        withoutSellerFields(withoutOptionalMediaFields(modernProduct)),
        withoutSellerFields(withoutOptionalMediaFields(legacyProduct)),
        withoutSellerFields(withoutOptionalMediaFields(legacyWithoutModuleKey))
      ];
      let lastError = error;
      for (const variant of variants) {
        try {
          return core.normalizeProduct(await runWrite(variant));
        } catch (variantError) {
          if (!isSchemaFallbackError(variantError)) throw variantError;
          lastError = variantError;
        }
      }
      throw lastError;
    }
  }

  async function deleteProduct(id) {
    if (security && !security.isUuid(id)) throw new Error("Ürün kimliği geçersiz.");
    const { error } = await client().from("products").delete().eq("id", id);
    if (error) throw error;
  }

  async function updateProductFields(id, payload) {
    if (security && !security.isUuid(id)) throw new Error("Ürün kimliği geçersiz.");
    const cleanPayload = { ...payload };
    if (Object.prototype.hasOwnProperty.call(cleanPayload, "stock")) {
      cleanPayload.stock = Math.max(0, Number(cleanPayload.stock || 0));
    }
    const { data, error } = await client().from("products").update(cleanPayload).eq("id", id).select("*").single();
    if (error) throw error;
    return core.normalizeProduct(data);
  }

  async function listPartnerAds(placements, limit) {
    const targetPlacements = placements && placements.length ? placements : ["allonashop_hero", "shop_hero"];
    const { data, error } = await client()
      .from("partner_ads")
      .select("*, product:products(*)")
      .eq("status", "active")
      .in("placement", targetPlacements)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    const now = Date.now();
    return (data || [])
      .filter((ad) => {
        const startsOk = !ad.starts_at || new Date(ad.starts_at).getTime() <= now;
        const endsOk = !ad.ends_at || new Date(ad.ends_at).getTime() >= now;
        return startsOk && endsOk;
      })
      .slice(0, limit || 5);
  }

  async function listShopPartnerAds(limit) {
    return listPartnerAds(["allonashop_hero", "shop_hero"], limit);
  }

  async function listFoodPartnerAds(limit) {
    return listPartnerAds(["allonayemek_hero", "allona_yemek_hero", "food_hero", "yemek_hero"], limit);
  }

  async function listMarketPartnerAds(limit) {
    return listPartnerAds(["allonamarket_hero", "allona_market_hero", "market_hero", "grocery_hero"], limit);
  }

  async function listOrders(scope) {
    let query = client().from("orders").select("*, order_items(*)").order("created_at", { ascending: false });
    if (scope && scope.userId) query = query.eq("user_id", scope.userId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function updateOrder(id, payload) {
    if (security && !security.isUuid(id)) throw new Error("Sipariş kimliği geçersiz.");
    const { data, error } = await client().from("orders").update(payload).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  }

  function parseRpcPayload(data) {
    if (typeof data === "string") return JSON.parse(data);
    return data;
  }

  async function getActiveCart() {
    const { data, error } = await client().rpc("get_active_cart");
    if (error) throw error;
    return parseRpcPayload(data) || { items: [] };
  }

  async function addCartItem(productId, quantity) {
    if (security && !security.isUuid(productId)) throw new Error("Ürün kimliği geçersiz.");
    const { data, error } = await client().rpc("add_cart_item", {
      p_product_id: productId,
      p_quantity: Math.max(1, Math.min(99, Number(quantity || 1)))
    });
    if (error) throw error;
    return parseRpcPayload(data) || { items: [] };
  }

  async function setCartItemQuantity(productId, quantity) {
    if (security && !security.isUuid(productId)) throw new Error("Ürün kimliği geçersiz.");
    const { data, error } = await client().rpc("set_cart_item_quantity", {
      p_product_id: productId,
      p_quantity: Math.max(0, Math.min(99, Number(quantity || 0)))
    });
    if (error) throw error;
    return parseRpcPayload(data) || { items: [] };
  }

  async function clearActiveCart() {
    const { data, error } = await client().rpc("clear_active_cart");
    if (error) throw error;
    return parseRpcPayload(data) || { items: [] };
  }

  async function createOrder(order, items) {
    const lines = (items || [])
      .map((item) => ({
        product_id: String(item.product && item.product.id || item.id || ""),
        quantity: Math.max(1, Math.min(99, Number(item.qty || item.quantity || 1)))
      }))
      .filter((item) => !security || security.isUuid(item.product_id));
    if (!lines.length) throw new Error("Sipariş için geçerli ürün bulunamadı.");

    try {
      const { data, error } = await client().rpc("create_transaction_order", {
        p_address_id: order.address_id || null,
        p_coupon_code: order.coupon_code || null,
        p_hp_to_use: Math.max(0, Math.min(100, Number(order.hp_to_use || 0)))
      });
      if (error) throw error;
      return parseRpcPayload(data);
    } catch (error) {
      if (!missingBackend(error)) throw error;
      console.warn("Transaction Core RPC aktif değil; frontend insert kapalı tutuldu.", error);
      throw new Error("Sipariş altyapısı güncelleniyor. Lütfen kısa süre sonra tekrar deneyin veya AllonaHub destek ile iletişime geçin.");
    }
  }

  async function invokeIyzicoCheckout(orderId, buyer) {
    const { data, error } = await client().functions.invoke(config.iyzicoFunctionName, {
      body: { orderId, buyer }
    });
    if (error) throw error;
    return data;
  }

  function normalizeTaxiVehicleClass(row) {
    return {
      key: String(row.service_key || "").trim(),
      label: String(row.label || row.service_key || "").trim(),
      description: String(row.short_description || "").trim(),
      base: Number(row.base_fare || 0),
      perKm: Number(row.per_km_fare || 0),
      perMin: Number(row.per_min_fare || 0),
      minimumFare: Number(row.minimum_fare || 0),
      reserveFee: Number(row.reserve_fee || 0),
      airportFee: Number(row.airport_fee || 0),
      multiplier: Number(row.surge_multiplier || 1),
      hpRate: Number(row.hp_rate || 18),
      sortOrder: Number(row.sort_order || 100)
    };
  }

  function normalizeTaxiDriver(row) {
    const make = String(row.vehicle_make || "").trim();
    const model = String(row.vehicle_model || "").trim();
    return {
      id: String(row.id || row.public_code || ""),
      publicId: String(row.public_code || row.id || ""),
      name: String(row.display_name || "Allona Taksi").trim(),
      type: String(row.service_label || "Ekonomik").trim(),
      services: Array.isArray(row.service_keys) && row.service_keys.length ? row.service_keys : ["ekonomik"],
      lat: Number(row.current_lat || 0),
      lng: Number(row.current_lng || 0),
      rating: Number(row.rating || 4.8),
      hp: Number(row.hp_reward || 20),
      vehicle: [make, model].filter(Boolean).join(" ") || String(row.vehicle_model || "Allona Taksi").trim(),
      plate: String(row.vehicle_plate || "").trim(),
      color: String(row.vehicle_color || "").trim(),
      verified: Boolean(row.is_verified),
      female: Boolean(row.is_female_driver),
      airportPermit: Boolean(row.airport_permit),
      availability: String(row.availability_status || "online"),
      completedTrips: Number(row.completed_trips || 0),
      acceptsCash: row.accepts_cash !== false,
      acceptsCard: row.accepts_card !== false,
      acceptsCoupon: row.accepts_coupon !== false,
      lastSeenAt: row.last_seen_at || row.updated_at || row.created_at || ""
    };
  }

  function normalizeTaxiDestination(row) {
    return {
      id: String(row.id || row.label || ""),
      label: String(row.label || "").trim(),
      shortLabel: String(row.short_label || row.label || "").trim(),
      category: String(row.category || "city").trim(),
      lat: Number(row.lat || 0),
      lng: Number(row.lng || 0),
      priority: Number(row.priority || 100)
    };
  }

  function taxiLiveDataEnabled() {
    if (App.config && App.config.taxiLiveDataEnabled === true) return true;
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("taxiLive") === "1" || localStorage.getItem("allona.taxi.liveData") === "1";
    } catch (error) {
      return false;
    }
  }

  async function listTaxiVehicleClasses() {
    if (!taxiLiveDataEnabled()) return [];
    const { data, error } = await client()
      .from("taxi_vehicle_classes")
      .select("service_key,label,short_description,base_fare,per_km_fare,per_min_fare,minimum_fare,reserve_fee,airport_fee,surge_multiplier,hp_rate,sort_order")
      .eq("module_scope", "allona_taksi")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return (data || []).map(normalizeTaxiVehicleClass).filter((item) => item.key);
  }

  async function listTaxiDrivers() {
    if (!taxiLiveDataEnabled()) return [];
    const { data, error } = await client()
      .from("taxi_drivers")
      .select("id,public_code,display_name,service_keys,service_label,vehicle_make,vehicle_model,vehicle_color,vehicle_plate,rating,completed_trips,hp_reward,is_verified,is_female_driver,airport_permit,accepts_cash,accepts_card,accepts_coupon,availability_status,current_lat,current_lng,last_seen_at,created_at,updated_at")
      .eq("module_scope", "allona_taksi")
      .eq("is_public", true)
      .in("availability_status", ["online", "busy"])
      .order("last_seen_at", { ascending: false });

    if (error) throw error;
    return (data || [])
      .map(normalizeTaxiDriver)
      .filter((driver) => driver.id && Number.isFinite(driver.lat) && Number.isFinite(driver.lng));
  }

  async function listTaxiDestinations() {
    if (!taxiLiveDataEnabled()) return [];
    const { data, error } = await client()
      .from("taxi_destinations")
      .select("id,label,short_label,category,lat,lng,priority")
      .eq("module_scope", "allona_taksi")
      .eq("is_active", true)
      .order("priority", { ascending: true });

    if (error) throw error;
    return (data || [])
      .map(normalizeTaxiDestination)
      .filter((destination) => destination.label && Number.isFinite(destination.lat) && Number.isFinite(destination.lng));
  }

  async function createTaxiRideRequest(payload) {
    const { data: authData, error: authError } = await client().auth.getUser();
    if (authError) throw authError;
    if (!authData || !authData.user) {
      const error = new Error("Taksi kaydı oluşturmak için üye girişi gerekir.");
      error.code = "AUTH_REQUIRED";
      throw error;
    }

    const { data, error } = await client().rpc("create_taxi_ride_request", {
      p_pickup_label: String(payload.pickup_label || "").slice(0, 240),
      p_pickup_lat: Number(payload.pickup_lat || 0),
      p_pickup_lng: Number(payload.pickup_lng || 0),
      p_dropoff_label: String(payload.dropoff_label || "").slice(0, 240),
      p_dropoff_lat: Number(payload.dropoff_lat || 0),
      p_dropoff_lng: Number(payload.dropoff_lng || 0),
      p_service_key: String(payload.service_key || "ekonomik"),
      p_payment_method: String(payload.payment_method || "allona-cash"),
      p_profile_type: String(payload.profile_type || "personal"),
      p_reserve_at: payload.reserve_at || null,
      p_prefer_female_driver: Boolean(payload.prefer_female_driver),
      p_matched_driver_id: payload.matched_driver_id || null,
      p_estimated_distance_km: Number(payload.estimated_distance_km || 0),
      p_estimated_minutes: Number(payload.estimated_minutes || 0),
      p_fare_min: Number(payload.fare_min || 0),
      p_fare_max: Number(payload.fare_max || 0),
      p_hp_reward: Number(payload.hp_reward || 0),
      p_safety_features: payload.safety_features || {}
    });

    if (error) throw error;
    return parseRpcPayload(data);
  }

  App.db = {
    client,
    products: {
      listActive: listActiveProducts,
      byIds: productsByIds,
      byId: productById,
      all: allProducts,
      upsert: upsertProduct,
      updateFields: updateProductFields,
      delete: deleteProduct
    },
    ads: {
      shopHero: listShopPartnerAds,
      foodHero: listFoodPartnerAds,
      marketHero: listMarketPartnerAds,
      list: listPartnerAds
    },
    orders: {
      list: listOrders,
      update: updateOrder,
      create: createOrder
    },
    cart: {
      get: getActiveCart,
      add: addCartItem,
      setQuantity: setCartItemQuantity,
      clear: clearActiveCart
    },
    payments: {
      createIyzicoCheckout: invokeIyzicoCheckout
    },
    taxi: {
      vehicleClasses: listTaxiVehicleClasses,
      drivers: listTaxiDrivers,
      destinations: listTaxiDestinations,
      createRideRequest: createTaxiRideRequest
    }
  };

  App.catalog = {
    isFoodProduct: isFoodCatalogProduct,
    isMarketProduct: isMarketCatalogProduct,
    isShopProduct: (item) => !isFoodCatalogProduct(item) && !isMarketCatalogProduct(item),
    matchesScope: matchesCatalogScope
  };
})();
