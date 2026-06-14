const SUPABASE_URL = "https://xqvikrysciguzholdjeb.supabase.co";
const SUPABASE_KEY = "sb_publishable_-P8KULtNFK5D9XRAeJrdng_zTCZ8zdF";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const AH_PROFILE_KEY = "allonahub_user_profile";

function cleanValue(value){
  if(value === undefined || value === "") return null;
  return value;
}

function getLocalProfile(){
  try{
    return JSON.parse(localStorage.getItem(AH_PROFILE_KEY) || "{}");
  }catch(e){
    return {};
  }
}

function saveLocalProfile(profile){
  localStorage.setItem(AH_PROFILE_KEY, JSON.stringify(profile || {}));
}

async function getCurrentUser(){
  const { data, error } = await supabaseClient.auth.getSession();

  if(error){
    console.error("SESSION ERROR:", error);
    return null;
  }

  return data?.session?.user || null;
}

async function requireAuth(){
  const user = await getCurrentUser();

  if(!user){
    window.location.href = "user.html";
    return null;
  }

  return user;
}

function getFirstName(name){
  return (name || "").trim().split(" ")[0] || "Üye";
}

function getGreeting(profile){
  const firstName = getFirstName(profile.full_name);
  const title = profile.profession_title || "Üye";
  return `${title} ${firstName}, hoş geldin`;
}

function normalizeProfile(data, user){
  const local = getLocalProfile();
  const meta = user?.user_metadata || {};

  const profile = {
    user_id: user?.id || data?.user_id || local.user_id || "",
    full_name: data?.full_name || meta.full_name || local.full_name || "AllonaHub Üyesi",
    email: data?.email || user?.email || local.email || "",
    phone: data?.phone || meta.phone || local.phone || "",
    country: data?.country || meta.country || local.country || "",
    city: data?.city || local.city || "",
    birth_date: data?.birth_date || local.birth_date || null,
    bio: data?.bio || local.bio || "",

    sector_key: data?.sector_key || meta.sector_key || local.sector_key || "other",
    sector_name: data?.sector_name || meta.sector_name || local.sector_name || "Diğer",
    profession_key: data?.profession_key || meta.profession_key || local.profession_key || "other_profession",
    profession_name: data?.profession_name || meta.profession_name || local.profession_name || "Diğer Meslek",
    profession_title: data?.profession_title || meta.profession_title || local.profession_title || "Üye",
    module: data?.module || meta.module || local.module || "general",

    avatar_url: data?.avatar_url || meta.avatar || local.avatar_url || local.avatar || "",
    avatar: data?.avatar_url || meta.avatar || local.avatar_url || local.avatar || "",

    premium_level: data?.premium_level || local.premium_level || "Basic",
    hp: data?.hp ?? local.hp ?? 100,
    xp: data?.xp ?? local.xp ?? 40,
    wallet_balance: data?.wallet_balance ?? local.wallet_balance ?? 0,

    profile_visible: data?.profile_visible ?? local.profile_visible ?? true,
    contact_locked: data?.contact_locked ?? local.contact_locked ?? true
  };

  profile.greeting = data?.greeting || meta.greeting || local.greeting || getGreeting(profile);

  return profile;
}

function profilePayload(profile, user){
  return {
    user_id: user.id,
    email: user.email || profile.email || null,

    full_name: cleanValue(profile.full_name),
    phone: cleanValue(profile.phone),
    country: cleanValue(profile.country),
    city: cleanValue(profile.city),
    birth_date: profile.birth_date || null,
    bio: cleanValue(profile.bio),

    sector_key: cleanValue(profile.sector_key),
    sector_name: cleanValue(profile.sector_name),
    profession_key: cleanValue(profile.profession_key),
    profession_name: cleanValue(profile.profession_name),
    profession_title: cleanValue(profile.profession_title),
    module: cleanValue(profile.module),

    avatar_url: cleanValue(profile.avatar || profile.avatar_url),

    premium_level: profile.premium_level || "Basic",
    hp: Number(profile.hp ?? 100),
    xp: Number(profile.xp ?? 40),
    wallet_balance: Number(profile.wallet_balance ?? 0),

    profile_visible: profile.profile_visible !== false,
    contact_locked: profile.contact_locked !== false,

    updated_at: new Date().toISOString()
  };
}

async function getProfile(){
  const user = await getCurrentUser();

  if(!user){
    return null;
  }

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if(error){
    console.error("PROFILE SELECT ERROR:", error);
    alert("Profil okunamadı: " + error.message);
    return null;
  }

  let profile = normalizeProfile(data, user);

  if(!data){
    const payload = profilePayload(profile, user);

    const { data:newProfile, error:insertError } = await supabaseClient
      .from("profiles")
      .insert(payload)
      .select()
      .single();

    if(insertError){
      console.error("PROFILE INSERT ERROR:", insertError);
      alert("Profil oluşturulamadı: " + insertError.message);
      return profile;
    }

    profile = normalizeProfile(newProfile, user);
  }

  saveLocalProfile(profile);
  return profile;
}

async function saveProfile(profile){
  const user = await getCurrentUser();

  if(!user){
    alert("Oturum bulunamadı.");
    return false;
  }

  const payload = profilePayload(profile, user);

  const { data, error } = await supabaseClient
    .from("profiles")
    .upsert(payload, { onConflict:"user_id" })
    .select()
    .single();

  if(error){
    console.error("PROFILE SAVE ERROR:", error);
    alert("Profil kaydedilemedi: " + error.message);
    return false;
  }

  await supabaseClient.auth.updateUser({
    data:{
      full_name: payload.full_name,
      phone: payload.phone,
      country: payload.country,
      sector_key: payload.sector_key,
      sector_name: payload.sector_name,
      profession_key: payload.profession_key,
      profession_name: payload.profession_name,
      profession_title: payload.profession_title,
      module: payload.module,
      greeting: getGreeting(payload),
      avatar: payload.avatar_url
    }
  });

  const normalized = normalizeProfile(data, user);
  saveLocalProfile(normalized);

  return true;
}

async function uploadAvatar(file){
  const user = await getCurrentUser();

  if(!user){
    alert("Oturum bulunamadı.");
    return null;
  }

  if(!file){
    return null;
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const filePath = `${user.id}/avatar-${Date.now()}.${ext}`;

  const { error:uploadError } = await supabaseClient.storage
    .from("avatars")
    .upload(filePath, file, {
      cacheControl:"3600",
      upsert:true
    });

  if(uploadError){
    console.error("AVATAR UPLOAD ERROR:", uploadError);
    alert("Fotoğraf yüklenemedi: " + uploadError.message);
    return null;
  }

  const { data } = supabaseClient.storage
    .from("avatars")
    .getPublicUrl(filePath);

  const avatarUrl = data.publicUrl;

  const profile = await getProfile();

  if(profile){
    profile.avatar = avatarUrl;
    profile.avatar_url = avatarUrl;
    await saveProfile(profile);
  }

  return avatarUrl;
}

async function updateHP(amount, reason="HP işlemi"){
  const profile = await getProfile();
  if(!profile) return null;

  profile.hp = Number(profile.hp || 0) + Number(amount || 0);
  await saveProfile(profile);

  console.log("HP güncellendi:", reason, amount);
  return profile.hp;
}

async function updateXP(amount, reason="XP işlemi"){
  const profile = await getProfile();
  if(!profile) return null;

  profile.xp = Number(profile.xp || 0) + Number(amount || 0);
  await saveProfile(profile);

  console.log("XP güncellendi:", reason, amount);
  return profile.xp;
}

async function updateWallet(amount, reason="Wallet işlemi"){
  const profile = await getProfile();
  if(!profile) return null;

  profile.wallet_balance = Number(profile.wallet_balance || 0) + Number(amount || 0);
  await saveProfile(profile);

  console.log("Wallet güncellendi:", reason, amount);
  return profile.wallet_balance;
}

async function logout(){
  await supabaseClient.auth.signOut();
  localStorage.removeItem(AH_PROFILE_KEY);
  window.location.href = "user.html";
}
