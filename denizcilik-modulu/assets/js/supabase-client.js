(function () {
  const config = window.MARITIME_SUPABASE || {};
  const demo = window.MARITIME_DEMO_DATA || {};
  const hasSupabase =
    Boolean(config.enabled) &&
    Boolean(config.url) &&
    Boolean(config.anonKey) &&
    Boolean(window.supabase);

  const client = hasSupabase
    ? window.supabase.createClient(config.url, config.anonKey)
    : null;

  const tableNames = {
    freightRates: "maritime_freight_rates",
    companies: "maritime_companies",
    consultants: "maritime_consultants",
    posts: "maritime_posts",
    quoteRequests: "maritime_quote_requests",
    supportTickets: "maritime_support_tickets"
  };

  const storageKeys = {
    freightRates: "allonahub-maritime-rates",
    posts: "allonahub-maritime-posts",
    quoteRequests: "allonahub-maritime-quotes",
    supportTickets: "allonahub-maritime-support"
  };

  function readLocal(collection) {
    try {
      return JSON.parse(localStorage.getItem(storageKeys[collection]) || "[]");
    } catch (error) {
      console.warn("Local maritime data could not be parsed", error);
      return [];
    }
  }

  function writeLocal(collection, rows) {
    if (!storageKeys[collection]) return;
    localStorage.setItem(storageKeys[collection], JSON.stringify(rows));
  }

  function fallbackRows(collection) {
    const base = Array.isArray(demo[collection]) ? demo[collection] : [];
    const local = readLocal(collection);
    return [...local, ...base];
  }

  function fromRate(row) {
    return {
      id: row.id,
      route: row.route,
      origin: row.origin,
      destination: row.destination,
      transitDays: row.transit_days,
      carrier: row.carrier,
      mode: row.mode,
      containerType: row.container_type,
      priceUsd: Number(row.price_usd || 0),
      validity: row.validity,
      status: row.status,
      capacity: row.capacity,
      updatedAt: row.updated_at_label || row.created_at,
      note: row.note
    };
  }

  function toRate(row) {
    return {
      route: row.route,
      origin: row.origin,
      destination: row.destination,
      transit_days: Number(row.transitDays || row.transit_days || 0),
      carrier: row.carrier,
      mode: row.mode,
      container_type: row.containerType || row.container_type,
      price_usd: Number(row.priceUsd || row.price_usd || 0),
      validity: row.validity,
      status: row.status || "Yeni",
      capacity: row.capacity,
      updated_at_label: row.updatedAt || new Date().toISOString().slice(0, 10),
      note: row.note
    };
  }

  function fromCompany(row) {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      base: row.base,
      verified: Boolean(row.verified),
      rating: Number(row.rating || 0),
      phone: row.phone,
      email: row.email,
      website: row.website,
      lanes: row.lanes || [],
      services: row.services || [],
      responseTime: row.response_time,
      activeOffers: Number(row.active_offers || 0)
    };
  }

  function fromConsultant(row) {
    return {
      id: row.id,
      name: row.name,
      title: row.title,
      city: row.city,
      experience: row.experience,
      rating: Number(row.rating || 0),
      email: row.email,
      phone: row.phone,
      specialties: row.specialties || [],
      nextSlot: row.next_slot,
      priceTry: Number(row.price_try || 0)
    };
  }

  function fromPost(row) {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      owner: row.owner,
      route: row.route,
      publishedAt: row.published_at_label || row.created_at,
      priceUsd: Number(row.price_usd || 0),
      status: row.status,
      content: row.content,
      tags: row.tags || []
    };
  }

  function toPost(row) {
    return {
      type: row.type,
      title: row.title,
      owner: row.owner,
      route: row.route,
      published_at_label: row.publishedAt || new Date().toLocaleString("tr-TR"),
      price_usd: Number(row.priceUsd || row.price_usd || 0),
      status: row.status || "Yayinda",
      content: row.content,
      tags: Array.isArray(row.tags) ? row.tags : String(row.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean)
    };
  }

  function fromQuote(row) {
    return {
      id: row.id,
      companyName: row.company_name,
      contactName: row.contact_name,
      email: row.email,
      phone: row.phone,
      origin: row.origin,
      destination: row.destination,
      cargoType: row.cargo_type,
      containerType: row.container_type,
      targetDate: row.target_date,
      budgetUsd: Number(row.budget_usd || 0),
      status: row.status,
      createdAt: row.created_at_label || row.created_at
    };
  }

  function toQuote(row) {
    return {
      company_name: row.companyName,
      contact_name: row.contactName,
      email: row.email,
      phone: row.phone,
      origin: row.origin,
      destination: row.destination,
      cargo_type: row.cargoType,
      container_type: row.containerType,
      target_date: row.targetDate,
      budget_usd: Number(row.budgetUsd || 0),
      status: row.status || "Yeni Talep",
      created_at_label: row.createdAt || new Date().toLocaleString("tr-TR")
    };
  }

  function fromTicket(row) {
    return {
      id: row.id,
      subject: row.subject,
      owner: row.owner,
      priority: row.priority,
      status: row.status,
      updatedAt: row.updated_at_label || row.created_at
    };
  }

  function toTicket(row) {
    return {
      subject: row.subject,
      owner: row.owner,
      priority: row.priority,
      status: row.status || "Yeni",
      updated_at_label: row.updatedAt || new Date().toLocaleString("tr-TR")
    };
  }

  const mapping = {
    freightRates: { from: fromRate, to: toRate },
    companies: { from: fromCompany },
    consultants: { from: fromConsultant },
    posts: { from: fromPost, to: toPost },
    quoteRequests: { from: fromQuote, to: toQuote },
    supportTickets: { from: fromTicket, to: toTicket }
  };

  async function fetchCollection(collection) {
    if (!client) return fallbackRows(collection);

    try {
      const { data, error } = await client
        .from(tableNames[collection])
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const mapper = mapping[collection]?.from || ((row) => row);
      const rows = (data || []).map(mapper);
      return rows.length ? rows : fallbackRows(collection);
    } catch (error) {
      console.warn(`Supabase ${collection} read failed; using local data`, error);
      return fallbackRows(collection);
    }
  }

  async function insertCollection(collection, payload) {
    const id = `${collection}-${Date.now()}`;
    const localPayload = { id, ...payload };
    const localRows = readLocal(collection);
    writeLocal(collection, [localPayload, ...localRows]);

    if (!client) return { ok: true, mode: "local", row: localPayload };

    try {
      const mapper = mapping[collection]?.to || ((row) => row);
      const { error } = await client.from(tableNames[collection]).insert(mapper(payload));
      if (error) throw error;
      return { ok: true, mode: "supabase", row: localPayload };
    } catch (error) {
      console.warn(`Supabase ${collection} insert failed; stored locally`, error);
      return { ok: true, mode: "local", row: localPayload, warning: error.message };
    }
  }

  window.MaritimeStore = {
    isSupabaseActive: () => Boolean(client),
    async loadAll() {
      const [freightRates, companies, consultants, posts, quoteRequests, supportTickets] = await Promise.all([
        fetchCollection("freightRates"),
        fetchCollection("companies"),
        fetchCollection("consultants"),
        fetchCollection("posts"),
        fetchCollection("quoteRequests"),
        fetchCollection("supportTickets")
      ]);

      return { freightRates, companies, consultants, posts, quoteRequests, supportTickets };
    },
    insertRate: (payload) => insertCollection("freightRates", payload),
    insertPost: (payload) => insertCollection("posts", payload),
    insertQuoteRequest: (payload) => insertCollection("quoteRequests", payload),
    insertSupportTicket: (payload) => insertCollection("supportTickets", payload)
  };
})();
