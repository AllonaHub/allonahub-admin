(function () {
  const TABLES = ["malls", "stores", "products", "campaigns", "coupons", "events", "reviews"];

  function getConfig() {
    return {
      url:
        window.ALLONAHUB_SUPABASE_URL ||
        localStorage.getItem("ALLONAHUB_SUPABASE_URL") ||
        "",
      anonKey:
        window.ALLONAHUB_SUPABASE_ANON_KEY ||
        localStorage.getItem("ALLONAHUB_SUPABASE_ANON_KEY") ||
        "",
    };
  }

  function hasConfig() {
    const config = getConfig();
    return Boolean(config.url && config.anonKey && config.url.includes("supabase"));
  }

  async function fetchTable(tableName) {
    const config = getConfig();
    const response = await fetch(`${config.url.replace(/\/$/, "")}/rest/v1/${tableName}?select=*`, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`${tableName} yüklenemedi: ${response.status}`);
    }

    return response.json();
  }

  async function insertRow(tableName, payload) {
    const config = getConfig();
    const response = await fetch(`${config.url.replace(/\/$/, "")}/rest/v1/${tableName}`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`${tableName} kaydedilemedi: ${response.status}`);
    }

    return response.json();
  }

  async function updateRow(tableName, id, payload) {
    const config = getConfig();
    const response = await fetch(
      `${config.url.replace(/\/$/, "")}/rest/v1/${tableName}?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error(`${tableName} güncellenemedi: ${response.status}`);
    }

    return response.json();
  }

  function normalizeData(data) {
    const seed = window.AVM_SEED_DATA || {};
    const camelize = (key) => key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    const normalizeRecord = (record) => {
      const normalizedRecord = Object.entries(record || {}).reduce((acc, [key, value]) => {
        acc[camelize(key)] = value;
        return acc;
      }, {});
      if (normalizedRecord.limitCount !== undefined && normalizedRecord.limit === undefined) {
        normalizedRecord.limit = normalizedRecord.limitCount;
      }
      return normalizedRecord;
    };
    const normalized = { ...seed };

    TABLES.forEach((table) => {
      normalized[table] = (data[table] || seed[table] || []).map(normalizeRecord);
    });

    const addCategoryMeta =
      typeof seed.findCategory === "function"
        ? (record) => {
            const category = seed.findCategory(record.category);

            if (!category) {
              return {
                ...record,
                categoryId: seed.categoryId ? seed.categoryId(record.category || "") : record.category,
                mainCategory: record.category,
                categoryPath: record.category ? [record.category] : [],
              };
            }

            return {
              ...record,
              categoryId: category.id,
              mainCategory: category.rootTitle,
              categoryPath: category.path,
            };
          }
        : (record) => record;

    normalized.stores = (normalized.stores || []).map(addCategoryMeta);
    normalized.products = (normalized.products || []).map(addCategoryMeta);
    normalized.categoryMenu = (normalized.categoryTree || []).map((category) => ({
      ...category,
      href: `#kategori-${category.id}`,
      storeCount: normalized.stores.filter((store) => store.mainCategory === category.title).length,
      productCount: normalized.products.filter((product) => product.mainCategory === category.title).length,
    }));

    normalized.malls = (normalized.malls || []).map((mall) => {
      const mallStores = (normalized.stores || []).filter((store) => store.mallId === mall.id);
      return {
        ...mall,
        storesCount: mallStores.filter((store) => store.type !== "restaurant").length,
        restaurantsCount: mallStores.filter((store) => store.type === "restaurant").length,
      };
    });

    return normalized;
  }

  async function loadAll() {
    if (!hasConfig()) {
      return normalizeData(window.AVM_SEED_DATA || {});
    }

    try {
      const loadedTables = await Promise.all(TABLES.map((table) => fetchTable(table)));
      const data = TABLES.reduce((acc, table, index) => {
        acc[table] = loadedTables[index];
        return acc;
      }, {});

      return normalizeData(data);
    } catch (error) {
      console.warn("Supabase bağlantısı başarısız, seed veri kullanılacak.", error);
      return normalizeData(window.AVM_SEED_DATA || {});
    }
  }

  function saveConfig(url, anonKey) {
    localStorage.setItem("ALLONAHUB_SUPABASE_URL", url.trim());
    localStorage.setItem("ALLONAHUB_SUPABASE_ANON_KEY", anonKey.trim());
  }

  window.AVMDataClient = {
    getConfig,
    hasConfig,
    loadAll,
    insertRow,
    updateRow,
    saveConfig,
  };
})();
