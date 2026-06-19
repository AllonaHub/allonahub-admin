(function () {
  const STORAGE_KEY = "allonahub_user_profile";
  const SUPABASE_URL = "https://xqvikrysciguzholdjeb.supabase.co";
  const SUPABASE_KEY = "sb_publishable_-P8KULtNFK5D9XRAeJrdng_zTCZ8zdF";

  const LEVELS = [
    { level: 1, minXp: 0, name: "New Member", key: "new-member", accent: "#18b8ff", bonus: "Başlangıç HP alanı" },
    { level: 2, minXp: 75, name: "Blue", key: "blue", accent: "#0aa7ff", bonus: "%10 ekstra HP" },
    { level: 3, minXp: 150, name: "Silver", key: "silver", accent: "#dcecff", bonus: "%5 kupon avantajı" },
    { level: 4, minXp: 300, name: "Gold", key: "gold", accent: "#f6b64b", bonus: "%10 özel kampanya" },
    { level: 5, minXp: 600, name: "Platinum", key: "platinum", accent: "#edf6ff", bonus: "Öncelikli destek" },
    { level: 6, minXp: 1500, name: "Diamond", key: "diamond", accent: "#20c8ff", bonus: "%20 ekstra HP" },
    { level: 7, minXp: 3000, name: "Elite", key: "elite", accent: "#b35cff", bonus: "Elite fırsatlar" },
    { level: 8, minXp: 6000, name: "Elite Diamond", key: "elite-diamond", accent: "#59e6ff", bonus: "VIP avantajlar" },
    { level: 9, minXp: 12000, name: "Elite Black", key: "elite-black", accent: "#f4c15d", bonus: "Yüksek cashout limiti" },
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

  function firstDefined() {
    for (let index = 0; index < arguments.length; index += 1) {
      const value = arguments[index];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return "";
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
    return isMaritimeProfile(profile) ? "cv-form.html?v=20260619-cv2" : "career-cv-form.html";
  }

  function normalizeProfile(session, dbProfile) {
    const user = session?.user || {};
    const meta = user.user_metadata || {};
    const local = storedProfile();
    const profile = {
      id: user.id || local.id || dbProfile?.id || "",
      user_id: user.id || local.user_id || dbProfile?.id || "",
      member_no: makeUserId(user),
      full_name: firstDefined(local.full_name, meta.full_name, dbProfile?.full_name, user.email, "AllonaHub Üyesi"),
      email: firstDefined(user.email, local.email, meta.email, ""),
      phone: firstDefined(local.phone, meta.phone, dbProfile?.phone, ""),
      country: firstDefined(local.country, meta.country, dbProfile?.country, ""),
      city: firstDefined(local.city, meta.city, dbProfile?.city, ""),
      birth_date: firstDefined(local.birth_date, meta.birth_date, dbProfile?.birth_date, ""),
      bio: firstDefined(local.bio, meta.bio, dbProfile?.bio, ""),
      sector_key: firstDefined(local.sector_key, meta.sector_key, dbProfile?.sector_key, "other"),
      sector_name: firstDefined(local.sector_name, meta.sector_name, dbProfile?.sector_name, "Diğer"),
      profession_key: firstDefined(local.profession_key, meta.profession_key, dbProfile?.profession_key, "other_profession"),
      profession_name: firstDefined(local.profession_name, meta.profession_name, dbProfile?.profession_name, "Diğer Meslek"),
      profession_title: firstDefined(local.profession_title, meta.profession_title, dbProfile?.profession_title, "Üye"),
      module: firstDefined(local.module, meta.module, dbProfile?.module, "general"),
      experience_year: firstDefined(local.experience_year, meta.experience_year, dbProfile?.experience_year, ""),
      profile_visible: firstDefined(local.profile_visible, meta.profile_visible, dbProfile?.profile_visible, true) !== false,
      contact_locked: firstDefined(local.contact_locked, meta.contact_locked, dbProfile?.contact_locked, true) !== false,
      avatar: safeAvatarUrl(firstDefined(local.avatar, local.avatar_url, meta.avatar_url, dbProfile?.avatar_url, "")),
      avatar_url: safeAvatarUrl(firstDefined(local.avatar_url, local.avatar, meta.avatar_url, dbProfile?.avatar_url, "")),
      hp: asNumber(firstDefined(local.hp, meta.hp, dbProfile?.hp), 250),
      xp: asNumber(firstDefined(local.xp, meta.xp, dbProfile?.xp), 0),
      streak: asNumber(firstDefined(local.streak, meta.streak, dbProfile?.streak), 0),
      cashout_balance: asNumber(firstDefined(local.cashout_balance, meta.cashout_balance, dbProfile?.cashout_balance), 0),
      hub_cash: asNumber(firstDefined(local.hub_cash, local.wallet_balance, meta.hub_cash, dbProfile?.hub_cash), 0),
      wallet_balance: asNumber(firstDefined(local.wallet_balance, local.hub_cash, meta.wallet_balance, dbProfile?.wallet_balance), 0),
      premium_level: firstDefined(local.premium_level, meta.premium_level, dbProfile?.premium_level, "Basic"),
      greeting: firstDefined(local.greeting, meta.greeting, dbProfile?.greeting, "")
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
      hp: asNumber(profile.hp, 250),
      xp: asNumber(profile.xp, 0),
      streak: asNumber(profile.streak, 0),
      cashout_balance: asNumber(profile.cashout_balance, 0),
      hub_cash: asNumber(profile.hub_cash, 0),
      premium_level: profile.premium_level || "Basic"
    };
  }

  async function save(client, rawProfile) {
    const session = await getSession(client);
    if (!session || !session.user) throw new Error("Profil kaydetmek için giriş yapmalısınız.");
    const merged = { ...storedProfile(), ...rawProfile, id: session.user.id, user_id: session.user.id };
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
    return merged;
  }

  function createClient() {
    if (!window.supabase) return null;
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  window.AllonaProfileSync = {
    STORAGE_KEY,
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
    load,
    save
  };
})();
