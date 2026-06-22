(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const config = App.config;
  const security = App.security;

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

  function filterProducts(items, filters) {
    const options = filters || {};
    const q = String(options.search || "").trim().toLocaleLowerCase("tr-TR");
    const category = String(options.category || "").trim().toLocaleLowerCase("tr-TR");
    const min = Number(options.minPrice || 0);
    const max = Number(options.maxPrice || 0);

    return items.filter((item) => {
      const text = `${item.name} ${item.description} ${item.category} ${item.brand || ""}`.toLocaleLowerCase("tr-TR");
      const categoryMatch = !category || item.category.toLocaleLowerCase("tr-TR") === category;
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
    const category = security ? security.normalizeText(payload.category || "Genel", { max: 90 }) : payload.category || "Genel";
    const brand = security ? security.normalizeText(payload.brand || payload.seller_name || "", { max: 120 }) : payload.brand || payload.seller_name || "";
    const rawImageUrl = String(payload.image_url || "").trim();
    const imageUrl = security
      ? (security.sanitizePublicUrl(rawImageUrl) || (/^(\/?images\/|\.{1,2}\/images\/)/i.test(rawImageUrl) ? rawImageUrl : ""))
      : rawImageUrl;
    const price = Number(payload.price || 0);
    const stock = Number(payload.stock || 0);
    const modernProduct = {
      name: cleanName,
      description,
      price,
      stock,
      image_url: imageUrl,
      category,
      status,
      slug: payload.slug ? core.slugify(payload.slug) : core.slugify(cleanName),
      meta_title: security ? security.normalizeText(payload.meta_title || cleanName, { max: 180 }) : payload.meta_title || cleanName,
      meta_description: security ? security.normalizeText(payload.meta_description || payload.description || "", { max: 260 }) : payload.meta_description || payload.description || "",
      brand,
      partner_id: payload.partner_id || undefined
    };

    const legacyProduct = {
      product_name: cleanName,
      description,
      price,
      old_price: Number(payload.old_price || payload.compare_at_price || price || 0),
      stock,
      image_url: imageUrl,
      category,
      status,
      brand,
      partner_id: String(payload.partner_code || payload.partner_id || "ALP-FOOD"),
      partner_email: payload.partner_email || "",
      coupon_status: payload.coupon_status || payload.coupon_label || "Aktif",
      hp_status: payload.hp_status || payload.hp_label || "Aktif",
      sku: payload.sku || core.slugify(`${cleanName}-${payload.partner_id || "food"}`).toUpperCase().slice(0, 48),
      barcode: payload.barcode || ""
    };

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
      const message = `${error && error.message || ""} ${error && error.details || ""} ${error && error.hint || ""}`;
      if (!/column|schema cache|could not find|does not exist|invalid input syntax for type uuid/i.test(message)) throw error;
      return core.normalizeProduct(await runWrite(legacyProduct));
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
    }
  };
})();
