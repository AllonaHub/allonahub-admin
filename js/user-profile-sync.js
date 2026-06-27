(function () {
  const STORAGE_KEY = "allonahub_user_profile";
  const PROFILE_EVENT = "allonahub:profile-updated";
  const PROFILE_CHANNEL = "allonahub-profile-sync";
  const HP_LEDGER_KEY = "allonahub_hp_ledger_v1";
  const SUPABASE_URL = window.Allona?.config?.supabaseUrl || "";
  const SUPABASE_KEY = window.Allona?.config?.supabaseAnonKey || "";

  const LEVELS = [
    { level: 1, minXp: 0, name: "New Member", key: "new-member", accent: "#18b8ff", bonus: "Başlangıç HP alanı" },
    { level: 2, minXp: 75, name: "Blue", key: "blue", accent: "#0aa7ff", bonus: "%10 ekstra HP" },
    { level: 3, minXp: 150, name: "Silver", key: "silver", accent: "#dcecff", bonus: "%5 kupon avantajı" },
    { level: 4, minXp: 300, name: "Gold", key: "gold", accent: "#f6b64b", bonus: "%10 özel kampanya" },
    { level: 5, minXp: 600, name: "Platinum", key: "platinum", accent: "#edf6ff", bonus: "Öncelikli destek" },
    { level: 6, minXp: 1500, name: "Diamond", key: "diamond", accent: "#20c8ff", bonus: "%20 ekstra HP" },
    { level: 7, minXp: 3000, name: "Elite", key: "elite", accent: "#b35cff", bonus: "Elite fırsatlar" },
    { level: 8, minXp: 6000, name: "Elite Diamond", key: "elite-diamond", accent: "#59e6ff", bonus: "VIP avantajlar" },
    { level: 9, minXp: 12000, name: "Elite Black", key: "elite-black", accent: "#f4c15d", bonus: "Yüksek kampanya limiti" },
    { level: 10, minXp: 25000, name: "Prestige", key: "prestige", accent: "#c15cff", bonus: "Prestige görevleri" },
    { level: 11, minXp: 50000, name: "Prestige Prime", key: "prestige-prime", accent: "#cfa2ff", bonus: "Prime partner fırsatları" },
    { level: 12, minXp: 100000, name: "Prestige Royal", key: "prestige-royal", accent: "#f6d07a", bonus: "Royal destek hattı" },
    { level: 13, minXp: 250000, name: "Prestige Immortal", key: "prestige-immortal", accent: "#d481ff", bonus: "Immortal kampanyalar" },
    { level: 14, minXp: 500000, name: "Prestige Infinity", key: "prestige-infinity", accent: "#9efcff", bonus: "Infinity etkinlikleri" },
    { level: 15, minXp: 1000000, name: "Legend Member", key: "legend", accent: "#ffd36a", bonus: "Legend concierge" }
  ];

  function safeParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function storedProfile() {
    return safeParse(localStorage.getItem(STORAGE_KEY) || "{}", {});
  }

  function setStoredProfile(profile) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile || {}));
  }

  function asNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function userKey(userOrId) {
    if (typeof userOrId === "string") return userOrId ? `user:${userOrId}` : "guest";
    const id = userOrId?.id || userOrId?.user_id || "";
    return id ? `user:${id}` : "guest";
  }

  function hpLedgerStore() {
    return safeParse(localStorage.getItem(HP_LEDGER_KEY) || "{}", {});
  }

  function getHpLedger(userOrId) {
    const entries = hpLedgerStore()[userKey(userOrId)];
    return Array.isArray(entries) ? entries : [];
  }

  function writeHpLedger(userOrId, entries) {
    try {
      const store = hpLedgerStore();
      store[userKey(userOrId)] = (Array.isArray(entries) ? entries : []).slice(0, 120);
      localStorage.setItem(HP_LEDGER_KEY, JSON.stringify(store));
    } catch (error) {
      // Profile numbers still persist through Supabase/auth metadata when ledger storage is unavailable.
    }
  }

  function hasHpLedgerEntry(userOrId, id) {
    if (!id) return false;
    return getHpLedger(userOrId).some((entry) => entry && entry.id === id);
  }

  function recordHpLedger(userOrId, entry) {
    if (!entry) return null;
    const amount = asNumber(entry.amount, 0);
    const id = entry.id || `${entry.bucket || "hp"}:${entry.source || "manual"}:${Date.now()}`;
    const nextEntry = {
      id,
      bucket: entry.bucket || "other",
      title: entry.title || "HP Hareketi",
      source: entry.source || "AllonaHub",
      amount,
      note: entry.note || "",
      created_at: entry.created_at || new Date().toISOString()
    };
    const next = [
      nextEntry,
      ...getHpLedger(userOrId).filter((item) => item && item.id !== id)
    ];
    writeHpLedger(userOrId, next);
    return nextEntry;
  }

  function firstDefined() {
    for (let index = 0; index < arguments.length; index += 1) {
      const value = arguments[index];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return "";
  }

  function timestamp(value) {
    const time = Date.parse(value || "");
    return Number.isFinite(time) ? time : 0;
  }

  function sourceOrder(dbProfile, meta, local) {
    const sources = [
      { name: "db", data: dbProfile || {}, time: timestamp(dbProfile?.updated_at), priority: 3 },
      { name: "meta", data: meta || {}, time: timestamp(meta?.updated_at), priority: 2 },
      { name: "local", data: local || {}, time: timestamp(local?.updated_at), priority: 1 }
    ];
    if (!sources.some((source) => source.time > 0)) return sources;
    return sources.slice().sort((a, b) => (b.time - a.time) || (b.priority - a.priority));
  }

  function readSourceValue(sources, fields, fallback) {
    const fieldList = Array.isArray(fields) ? fields : [fields];
    for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
      const data = sources[sourceIndex].data || {};
      for (let fieldIndex = 0; fieldIndex < fieldList.length; fieldIndex += 1) {
        const value = data[fieldList[fieldIndex]];
        if (value !== undefined && value !== null && value !== "") return value;
      }
    }
    return fallback !== undefined ? fallback : "";
  }

  function notifyProfileChange(profile) {
    try {
      window.dispatchEvent(new CustomEvent(PROFILE_EVENT, { detail: profile }));
    } catch (error) {
      // Some legacy browsers may not support CustomEvent in file contexts.
    }

    try {
      if ("BroadcastChannel" in window) {
        const channel = new BroadcastChannel(PROFILE_CHANNEL);
        channel.postMessage({ type: PROFILE_EVENT, profile });
        channel.close();
      }
    } catch (error) {
      // Local storage is still updated, so the panel can read the latest profile on load.
    }
  }

  function safeAvatarUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.length > 3 * 1024 * 1024) return "";
    if (/^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(raw)) return raw;
    try {
      const parsed = new URL(raw, window.location.href);
      if (["https:", "http:"].includes(parsed.protocol)) return parsed.href;
    } catch (error) {
      return "";
    }
    return "";
  }

  function makeUserId(user) {
    if (!user || !user.id) return "AH-USER-000000";
    return `AH-${String(user.id).slice(0, 8).toUpperCase()}`;
  }

  function initials(name) {
    const parts = String(name || "AllonaHub Üyesi").trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) return (parts[0] || "AH").slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  function levelFromXp(rawXp) {
    const xp = Math.max(0, asNumber(rawXp, 0));
    let current = LEVELS[0];
    let next = null;

    for (let index = 0; index < LEVELS.length; index += 1) {
      if (xp >= LEVELS[index].minXp) current = LEVELS[index];
      if (xp < LEVELS[index].minXp) {
        next = LEVELS[index];
        break;
      }
    }

    if (!next) {
      return {
        current,
        next: null,
        xp,
        progress: 100,
        currentMin: current.minXp,
        nextMin: current.minXp,
        remaining: 0
      };
    }

    const span = Math.max(1, next.minXp - current.minXp);
    const progress = Math.min(100, Math.max(0, Math.round(((xp - current.minXp) / span) * 100)));
    return {
      current,
      next,
      xp,
      progress,
      currentMin: current.minXp,
      nextMin: next.minXp,
      remaining: Math.max(0, next.minXp - xp)
    };
  }

  function isMaritimeProfile(profile) {
    const text = [
      profile?.module,
      profile?.sector_key,
      profile?.sector_name,
      profile?.profession_key,
      profile?.profession_name,
      profile?.profession_title
    ].join(" ").toLocaleLowerCase("tr-TR");
    return /maritime|deniz|gemi|kaptan|zabit|engineer|mühendis|eto|bosun|seaman|oiler|motorman|stcw|crew/.test(text);
  }

  function cvTarget(profile) {
    return isMaritimeProfile(profile) ? "/pages/career/cv-form.html?v=20260619-cv2" : "/pages/career/career-cv-form.html";
  }

  function normalizeProfile(session, dbProfile) {
    const user = session?.user || {};
    const meta = user.user_metadata || {};
    const rawLocal = storedProfile();
    const localUserId = rawLocal.user_id || rawLocal.id || "";
    const local = !user.id || !localUserId || localUserId === user.id ? rawLocal : {};
    const sources = sourceOrder(dbProfile, meta, local);
    const pick = (fields, fallback) => readSourceValue(sources, fields, fallback);
    const profile = {
      id: user.id || local.id || dbProfile?.id || "",
      user_id: user.id || local.user_id || dbProfile?.id || "",
      member_no: makeUserId(user),
      full_name: pick("full_name", user.email || "AllonaHub Üyesi"),
      email: firstDefined(user.email, pick("email", ""), ""),
      phone: pick("phone", ""),
      country: pick("country", ""),
      city: pick("city", ""),
      birth_date: pick("birth_date", ""),
      bio: pick("bio", ""),
      sector_key: pick("sector_key", "other"),
      sector_name: pick("sector_name", "Diğer"),
      profession_key: pick("profession_key", "other_profession"),
      profession_name: pick("profession_name", "Diğer Meslek"),
      profession_title: pick("profession_title", "Üye"),
      module: pick("module", "general"),
      experience_year: pick("experience_year", ""),
      profile_visible: pick("profile_visible", true) !== false,
      contact_locked: pick("contact_locked", true) !== false,
      avatar: safeAvatarUrl(pick(["avatar_url", "avatar"], "")),
      avatar_url: safeAvatarUrl(pick(["avatar_url", "avatar"], "")),
      hp: asNumber(pick("hp", 250), 250),
      xp: asNumber(pick("xp"), 0),
      streak: asNumber(pick("streak"), 0),
      cashout_balance: asNumber(pick("cashout_balance"), 0),
      hub_cash: asNumber(pick(["hub_cash", "wallet_balance"]), 0),
      wallet_balance: asNumber(pick(["wallet_balance", "hub_cash"]), 0),
      premium_level: pick("premium_level", "Basic"),
      greeting: pick("greeting", ""),
      last_daily_login_date: pick("last_daily_login_date", ""),
      last_daily_login_at: pick("last_daily_login_at", ""),
      updated_at: pick("updated_at", "")
    };

    const levelInfo = levelFromXp(profile.xp);
    profile.level = levelInfo.current.level;
    profile.level_name = levelInfo.current.name;
    profile.level_key = levelInfo.current.key;
    profile.progress = levelInfo.progress;
    profile.next_level_name = levelInfo.next ? levelInfo.next.name : "Legend Zirvesi";
    profile.next_level_xp = levelInfo.nextMin;
    profile.cv_target = cvTarget(profile);

    setStoredProfile(profile);
    return profile;
  }

  async function getSession(client) {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  async function fetchDbProfile(client, userId) {
    if (!client || !userId) return null;
    const { data, error } = await client
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn("Profil tablosu okunamadı:", error.message || error);
      return null;
    }

    return data || null;
  }

  async function load(client) {
    const session = await getSession(client);
    if (!session || !session.user) return null;
    const dbProfile = await fetchDbProfile(client, session.user.id);
    const profile = normalizeProfile(session, dbProfile);
    return { session, user: session.user, dbProfile, profile, levelInfo: levelFromXp(profile.xp) };
  }

  function richProfilePayload(user, profile) {
    return {
      id: user.id,
      full_name: profile.full_name || "",
      email: profile.email || user.email || "",
      phone: profile.phone || "",
      country: profile.country || "",
      city: profile.city || "",
      birth_date: profile.birth_date || null,
      bio: profile.bio || "",
      sector_key: profile.sector_key || "other",
      sector_name: profile.sector_name || "Diğer",
      profession_key: profile.profession_key || "other_profession",
      profession_name: profile.profession_name || "Diğer Meslek",
      profession_title: profile.profession_title || "Üye",
      module: profile.module || "general",
      experience_year: profile.experience_year === "" ? null : Number(profile.experience_year || 0),
      profile_visible: profile.profile_visible !== false,
      contact_locked: profile.contact_locked !== false,
      avatar_url: safeAvatarUrl(profile.avatar_url || profile.avatar || ""),
      hp: asNumber(profile.hp, 250),
      xp: asNumber(profile.xp, 0),
      level: levelFromXp(profile.xp).current.level,
      streak: asNumber(profile.streak, 0),
      cashout_balance: asNumber(profile.cashout_balance, 0),
      hub_cash: asNumber(profile.hub_cash, 0),
      wallet_balance: asNumber(profile.wallet_balance || profile.hub_cash, 0),
      premium_level: profile.premium_level || "Basic",
      updated_at: new Date().toISOString()
    };
  }

  function metadataPayload(profile) {
    return {
      full_name: profile.full_name || "",
      phone: profile.phone || "",
      country: profile.country || "",
      city: profile.city || "",
      birth_date: profile.birth_date || "",
      bio: profile.bio || "",
      sector_key: profile.sector_key || "other",
      sector_name: profile.sector_name || "Diğer",
      profession_key: profile.profession_key || "other_profession",
      profession_name: profile.profession_name || "Diğer Meslek",
      profession_title: profile.profession_title || "Üye",
      module: profile.module || "general",
      experience_year: profile.experience_year || "",
      profile_visible: profile.profile_visible !== false,
      contact_locked: profile.contact_locked !== false,
      avatar_url: safeAvatarUrl(profile.avatar_url || profile.avatar || ""),
      hp: asNumber(profile.hp, 250),
      xp: asNumber(profile.xp, 0),
      streak: asNumber(profile.streak, 0),
      cashout_balance: asNumber(profile.cashout_balance, 0),
      hub_cash: asNumber(profile.hub_cash, 0),
      wallet_balance: asNumber(profile.wallet_balance || profile.hub_cash, 0),
      premium_level: profile.premium_level || "Basic",
      last_daily_login_date: profile.last_daily_login_date || "",
      last_daily_login_at: profile.last_daily_login_at || "",
      updated_at: profile.updated_at || new Date().toISOString()
    };
  }

  async function save(client, rawProfile) {
    const session = await getSession(client);
    if (!session || !session.user) throw new Error("Profil kaydetmek için giriş yapmalısınız.");
    const merged = { ...storedProfile(), ...rawProfile, id: session.user.id, user_id: session.user.id, updated_at: new Date().toISOString() };
    const levelInfo = levelFromXp(merged.xp);
    merged.level = levelInfo.current.level;
    merged.level_name = levelInfo.current.name;
    merged.level_key = levelInfo.current.key;
    merged.progress = levelInfo.progress;
    merged.next_level_name = levelInfo.next ? levelInfo.next.name : "Legend Zirvesi";
    merged.cv_target = cvTarget(merged);

    setStoredProfile(merged);

    const { error: authError } = await client.auth.updateUser({ data: metadataPayload(merged) });
    if (authError) throw authError;

    const richPayload = richProfilePayload(session.user, merged);
    const { error: richError } = await client.from("profiles").upsert(richPayload).select("id").maybeSingle();
    if (richError) {
      console.warn("Geniş profil payload kaydedilemedi, temel profil payload deneniyor:", richError.message || richError);
      const minimalPayload = {
        id: session.user.id,
        full_name: merged.full_name || "",
        phone: merged.phone || "",
        updated_at: new Date().toISOString()
      };
      const { error: minimalError } = await client.from("profiles").upsert(minimalPayload).select("id").maybeSingle();
      if (minimalError) console.warn("Temel profil payload kaydedilemedi:", minimalError.message || minimalError);
    }

    setStoredProfile(merged);
    notifyProfileChange(merged);
    return merged;
  }

  async function updateEconomy(client, changes) {
    const loaded = await load(client);
    if (!loaded || !loaded.profile) throw new Error("HP/XP güncellemek için giriş yapmalısınız.");
    const base = loaded.profile;
    const next = { ...base };
    const numericFields = ["hp", "xp", "streak", "cashout_balance", "hub_cash", "wallet_balance"];

    numericFields.forEach((field) => {
      const setField = `${field}_set`;
      if (Object.prototype.hasOwnProperty.call(changes || {}, setField)) {
        next[field] = Math.max(0, asNumber(changes[setField], asNumber(base[field], 0)));
        return;
      }
      if (Object.prototype.hasOwnProperty.call(changes || {}, field)) {
        next[field] = Math.max(0, asNumber(base[field], 0) + asNumber(changes[field], 0));
      }
    });

    if (Object.prototype.hasOwnProperty.call(changes || {}, "hub_cash") && !Object.prototype.hasOwnProperty.call(changes || {}, "wallet_balance")) {
      next.wallet_balance = next.hub_cash;
    }
    if (Object.prototype.hasOwnProperty.call(changes || {}, "wallet_balance") && !Object.prototype.hasOwnProperty.call(changes || {}, "hub_cash")) {
      next.hub_cash = next.wallet_balance;
    }

    ["last_daily_login_date", "last_daily_login_at"].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(changes || {}, field)) {
        next[field] = String(changes[field] || "").slice(0, 48);
      }
    });

    return save(client, next);
  }

  function createClient() {
    if (!window.supabase) return null;
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  window.AllonaProfileSync = {
    STORAGE_KEY,
    PROFILE_EVENT,
    PROFILE_CHANNEL,
    HP_LEDGER_KEY,
    LEVELS,
    SUPABASE_URL,
    SUPABASE_KEY,
    createClient,
    storedProfile,
    setStoredProfile,
    normalizeProfile,
    levelFromXp,
    isMaritimeProfile,
    cvTarget,
    makeUserId,
    initials,
    safeAvatarUrl,
    getHpLedger,
    hasHpLedgerEntry,
    recordHpLedger,
    notifyProfileChange,
    load,
    save,
    updateEconomy
  };
})();
