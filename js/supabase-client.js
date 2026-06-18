(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const config = App.config;

  if (window.supabase && config.supabaseUrl && config.supabaseAnonKey) {
    App.supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
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
    const product = {
      name: payload.name,
      description: payload.description || "",
      price: Number(payload.price || 0),
      stock: Number(payload.stock || 0),
      image_url: payload.image_url || "",
      category: payload.category || "Genel",
      status: payload.status || "active",
      slug: payload.slug || core.slugify(payload.name),
      meta_title: payload.meta_title || payload.name,
      meta_description: payload.meta_description || payload.description || ""
    };

    const query = payload.id
      ? client().from("products").update(product).eq("id", payload.id).select("*").single()
      : client().from("products").insert(product).select("*").single();

    const { data, error } = await query;
    if (error) throw error;
    return core.normalizeProduct(data);
  }

  async function deleteProduct(id) {
    const { error } = await client().from("products").delete().eq("id", id);
    if (error) throw error;
  }

  async function updateProductFields(id, payload) {
    const { data, error } = await client().from("products").update(payload).eq("id", id).select("*").single();
    if (error) throw error;
    return core.normalizeProduct(data);
  }

  async function listOrders(scope) {
    let query = client().from("orders").select("*, order_items(*)").order("created_at", { ascending: false });
    if (scope && scope.userId) query = query.eq("user_id", scope.userId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function updateOrder(id, payload) {
    const { data, error } = await client().from("orders").update(payload).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  }

  async function createOrder(order, items) {
    const { data: created, error } = await client().from("orders").insert(order).select("*").single();
    if (error) throw error;

    const rows = items.map((item) => ({
      order_id: created.id,
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.qty,
      price: item.product.price
    }));

    const { error: itemError } = await client().from("order_items").insert(rows);
    if (itemError) throw itemError;
    return created;
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
