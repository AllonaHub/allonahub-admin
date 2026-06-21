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
    const cleanName = security ? security.normalizeText(payload.name, { max: 180 }) : String(payload.name || "").trim();
    if (!cleanName) throw new Error("Ürün adı zorunludur.");
    if (payload.id && security && !security.isUuid(payload.id)) throw new Error("Ürün kimliği geçersiz.");
    const product = {
      name: cleanName,
      description: security ? security.normalizeMultiline(payload.description, { max: 1800 }) : payload.description || "",
      price: Number(payload.price || 0),
      stock: Number(payload.stock || 0),
      image_url: security ? security.sanitizePublicUrl(payload.image_url) : payload.image_url || "",
      category: security ? security.normalizeText(payload.category || "Genel", { max: 90 }) : payload.category || "Genel",
      status: ["active", "draft", "archived"].includes(payload.status) ? payload.status : "active",
      slug: payload.slug ? core.slugify(payload.slug) : core.slugify(cleanName),
      meta_title: security ? security.normalizeText(payload.meta_title || cleanName, { max: 180 }) : payload.meta_title || cleanName,
      meta_description: security ? security.normalizeText(payload.meta_description || payload.description || "", { max: 260 }) : payload.meta_description || payload.description || ""
    };

    const query = payload.id
      ? client().from("products").update(product).eq("id", payload.id).select("*").single()
      : client().from("products").insert(product).select("*").single();

    const { data, error } = await query;
    if (error) throw error;
    return core.normalizeProduct(data);
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

  async function listShopPartnerAds(limit) {
    const { data, error } = await client()
      .from("partner_ads")
      .select("*, product:products(*)")
      .eq("status", "active")
      .in("placement", ["allonashop_hero", "shop_hero"])
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

  async function createOrder(order, items) {
    const lines = (items || [])
      .map((item) => ({
        product_id: String(item.product && item.product.id || item.id || ""),
        quantity: Math.max(1, Math.min(99, Number(item.qty || item.quantity || 1)))
      }))
      .filter((item) => !security || security.isUuid(item.product_id));
    if (!lines.length) throw new Error("Sipariş için geçerli ürün bulunamadı.");

    try {
      const { data, error } = await client().rpc("create_secure_order", {
        p_customer_name: order.customer_name,
        p_customer_email: order.customer_email,
        p_customer_phone: order.customer_phone,
        p_city: order.city,
        p_address: order.address,
        p_items: lines,
        p_coupon_code: order.coupon_code || null
      });
      if (error) throw error;
      if (typeof data === "string") return JSON.parse(data);
      return data;
    } catch (error) {
      if (!missingBackend(error)) throw error;
      throw new Error("Güvenli sipariş altyapısı henüz aktif değil. Lütfen Supabase migrationlarını uygulayın.");
    }
  }

  async function invokeIyzicoCheckout(orderId, buyer) {
    const configuredApi = String(config.apiBaseUrl || "").replace(/\/$/, "");
    const apiBaseUrl = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
      ? "http://localhost:3000"
      : configuredApi;
    if (apiBaseUrl && App.auth && App.auth.getSession) {
      const session = await App.auth.getSession();
      if (!session || !session.access_token) throw new Error("Ödeme için oturum doğrulanamadı.");
      const response = await fetch(`${apiBaseUrl}/v1/payments/iyzico/checkout`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orderId,
          turnstileToken: buyer && buyer.turnstileToken || ""
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.message || "Ödeme oturumu başlatılamadı.");
      }
      return data;
    }

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
      shopHero: listShopPartnerAds
    },
    orders: {
      list: listOrders,
      update: updateOrder,
      create: createOrder
    },
    payments: {
      createIyzicoCheckout: invokeIyzicoCheckout
    }
  };
})();
