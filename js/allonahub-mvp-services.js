(function () {
  const App = window.Allona = window.Allona || {};

  function basePath() {
    const path = window.location.pathname;
    const markers = ["/pages/", "/admin/", "/index.html", "/coupon-center.html", "/discover.html", "/notifications.html"];
    for (const marker of markers) {
      const index = path.indexOf(marker);
      if (index > 0) return path.slice(0, index);
    }
    if (/\.github\.io$/i.test(window.location.hostname)) {
      const first = path.split("/").filter(Boolean)[0];
      return first ? `/${first}` : "";
    }
    return "";
  }

  const prefix = basePath().replace(/\/$/, "");

  function url(path) {
    if (!path) return "";
    if (/^(https?:)?\/\//.test(path) || path.startsWith("mailto:") || path.startsWith("tel:") || path.startsWith("#")) return path;
    if (!path.startsWith("/")) return path;
    return `${prefix}${path}`;
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function money(value) {
    const amount = Number(value || 0);
    return amount.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
  }

  function initSupabase() {
    if (App.supabase) return App.supabase;
    if (!window.supabase || !App.config?.supabaseUrl || !App.config?.supabaseAnonKey) return null;
    App.supabase = window.supabase.createClient(App.config.supabaseUrl, App.config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return App.supabase;
  }

  async function getUser() {
    const client = initSupabase();
    if (!client) return null;
    try {
      const { data } = await client.auth.getUser();
      return data.user || null;
    } catch (error) {
      return null;
    }
  }

  async function select(table, options) {
    const client = initSupabase();
    if (!client) return { data: [], error: new Error("Supabase istemcisi hazir degil.") };
    let query = client.from(table).select(options?.columns || "*");
    if (options?.filters) {
      options.filters.forEach((filter) => {
        query = query[filter.op || "eq"](filter.column, filter.value);
      });
    }
    if (options?.order) query = query.order(options.order.column, { ascending: Boolean(options.order.ascending) });
    if (options?.limit) query = query.limit(options.limit);
    return query;
  }

  async function insert(table, payload) {
    const client = initSupabase();
    if (!client) throw new Error("Supabase istemcisi hazir degil.");
    const { data, error } = await client.from(table).insert(payload).select("*").single();
    if (error) throw error;
    return data;
  }

  async function update(table, id, payload) {
    const client = initSupabase();
    if (!client) throw new Error("Supabase istemcisi hazir degil.");
    const { data, error } = await client.from(table).update(payload).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  }

  async function upsert(table, payload, options) {
    const client = initSupabase();
    if (!client) throw new Error("Supabase istemcisi hazir degil.");
    const { data, error } = await client
      .from(table)
      .upsert(payload, options || {})
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async function rpc(name, args) {
    const client = initSupabase();
    if (!client) throw new Error("Supabase istemcisi hazir degil.");
    const { data, error } = await client.rpc(name, args || {});
    if (error) throw error;
    return data;
  }

  async function currentPartner() {
    const client = initSupabase();
    const user = await getUser();
    if (!client || !user) return null;

    const { data } = await client
      .from("partners")
      .select("*")
      .or(`user_id.eq.${user.id},owner_id.eq.${user.id},email.eq.${user.email || ""}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return data || null;
  }

  function qualityScore(draft) {
    let score = 0;
    const images = Array.isArray(draft.images) ? draft.images : [];
    if (String(draft.name || "").trim().length > 10) score += 10;
    if (String(draft.description || "").trim().length > 100) score += 15;
    if (String(draft.image_url || "").trim() || images.length) score += 20;
    if (Number(draft.price || 0) > 0) score += 15;
    if (draft.category_id || String(draft.category || "").trim()) score += 10;
    if (draft.stock !== undefined && draft.stock !== null && String(draft.stock) !== "") score += 10;
    if (String(draft.sku || "").trim() || String(draft.barcode || "").trim()) score += 10;
    if (String(draft.shipping_info || "").trim()) score += 5;
    if (String(draft.seo_description || "").trim()) score += 5;
    return Math.min(100, score);
  }

  const PartnerProductAIHelper = {
    suggestTitle(draft) {
      const name = String(draft.name || "").trim();
      return name.length > 10 ? name : `${name || "Yeni urun"} - AllonaHub guvencesi`;
    },
    suggestDescription(draft) {
      const description = String(draft.description || "").trim();
      if (description.length > 100) return description;
      return `${description} Urunun temel faydasini, malzeme/ozellik bilgisini, teslimat kosulunu ve partner guvencesini net bicimde anlatin.`.trim();
    },
    suggestKeywords(draft) {
      return [draft.category, draft.name, "allonahub", "guvenilir partner", "hizli teslimat"].filter(Boolean);
    },
    suggestCategory(draft) {
      const text = `${draft.name || ""} ${draft.description || ""}`.toLocaleLowerCase("tr-TR");
      if (/telefon|laptop|kulaklik|kamera/.test(text)) return "Elektronik";
      if (/bebek|anne/.test(text)) return "Anne & Bebek";
      if (/spor|fitness|outdoor/.test(text)) return "Spor & Outdoor";
      if (/kozmetik|bakim|parfum/.test(text)) return "Kozmetik";
      return "Ev & Yasam";
    },
    detectMissingFields(draft) {
      const missing = [];
      if (String(draft.name || "").trim().length <= 10) missing.push("Urun adi 10 karakterden uzun olmali.");
      if (String(draft.description || "").trim().length <= 100) missing.push("Aciklama 100 karakterden uzun olmali.");
      if (!String(draft.image_url || "").trim()) missing.push("En az bir urun gorseli eklenmeli.");
      if (Number(draft.price || 0) <= 0) missing.push("Fiyat girilmeli.");
      if (!String(draft.category || "").trim() && !draft.category_id) missing.push("Kategori secilmeli.");
      if (!String(draft.sku || "").trim() && !String(draft.barcode || "").trim()) missing.push("SKU veya barkod eklenmeli.");
      if (!String(draft.shipping_info || "").trim()) missing.push("Kargo/teslimat bilgisi eklenmeli.");
      if (!String(draft.seo_description || "").trim()) missing.push("SEO aciklamasi eklenmeli.");
      return missing;
    }
  };

  App.mvp = {
    url,
    escapeHTML,
    money,
    initSupabase,
    getUser,
    select,
    insert,
    update,
    upsert,
    rpc,
    currentPartner,
    qualityScore,
    PartnerProductAIHelper
  };
})();
