const SUPABASE_URL="https://xqvikrysciguzholdjeb.supabase.co";
const SUPABASE_KEY="sb_publishable_-P8KULtNFK5D9XRAeJrdng_zTCZ8zdF";

const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const AH_PROFILE_KEY="allonahub_user_profile";

async function getCurrentUser(){
  const { data:{ session }, error } = await supabaseClient.auth.getSession();

  if(error || !session || !session.user){
    return null;
  }

  return session.user;
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

function getFirstName(name){
  return (name || "").trim().split(" ")[0] || "Üye";
}

function getGreeting(profile){
  const firstName=getFirstName(profile.full_name);
  const title=profile.profession_title || "Üye";
  return `${title} ${firstName}, hoş geldin`;
}

function normalizeProfile(data,user){
  const local=getLocalProfile();

  return {
    user_id:user?.id || data?.user_id || local.user_id || "",
    full_name:data?.full_name || user?.user_metadata?.full_name || local.full_name || "AllonaHub Üyesi",
    email:data?.email || user?.email || local.email || "",
    phone:data?.phone || user?.user_metadata?.phone || local.phone || "",
    country:data?.country || user?.user_metadata?.country || local.country || "",
    city:data?.city || local.city || "",
    birth_date:data?.birth_date || local.birth_date || "",
    bio:data?.bio || local.bio || "",

    sector_key:data?.sector_key || user?.user_metadata?.sector_key || local.sector_key || "other",
    sector_name:data?.sector_name || user?.user_metadata?.sector_name || local.sector_name || "Diğer",
    profession_key:data?.profession_key || user?.user_metadata?.profession_key || local.profession_key || "other_profession",
    profession_name:data?.profession_name || user?.user_metadata?.profession_name || local.profession_name || "Diğer Meslek",
    profession_title:data?.profession_title || user?.user_metadata?.profession_title || local.profession_title || "Üye",
    module:data?.module || user?.user_metadata?.module || local.module || "general",

    avatar_url:data?.avatar_url || user?.user_metadata?.avatar || local.avatar_url || local.avatar || "",
    avatar:data?.avatar_url || user?.user_metadata?.avatar || local.avatar_url || local.avatar || "",

    premium_level:data?.premium_level || local.premium_level || "Basic",
    hp:data?.hp ?? local.hp ?? 100,
    xp:data?.xp ?? local.xp ?? 40,
    wallet_balance:data?.wallet_balance ?? local.wallet_balance ?? 0,

    profile_visible:data?.profile_visible ?? local.profile_visible ?? true,
    contact_locked:data?.contact_locked ?? local.contact_locked ?? true,

    greeting:data?.greeting || user?.user_metadata?.greeting || local.greeting || ""
  };
}
async function getProfile(){

    const user = await getCurrentUser();

    if(!user) return null;

    const { data, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

    let profile = normalizeProfile(data,user);

    if(!data){

        const { data:newProfile, error:insertError } =
        await supabaseClient
        .from("profiles")
        .insert({
            user_id:user.id,
            email:user.email,
            full_name:profile.full_name,
            phone:profile.phone,
            country:profile.country,
            city:profile.city,
            birth_date:profile.birth_date,
            bio:profile.bio,

            sector_key:profile.sector_key,
            sector_name:profile.sector_name,
            profession_key:profile.profession_key,
            profession_name:profile.profession_name,
            profession_title:profile.profession_title,
            module:profile.module,

            avatar_url:profile.avatar,

            premium_level:profile.premium_level,
            hp:profile.hp,
            xp:profile.xp,
            wallet_balance:profile.wallet_balance,

            profile_visible:profile.profile_visible,
            contact_locked:profile.contact_locked
        })
        .select()
        .single();

        if(!insertError && newProfile){
            profile = normalizeProfile(newProfile,user);
        }
    }

    saveLocalProfile(profile);

    return profile;

}

async function saveProfile(profile){

    const user = await getCurrentUser();

    if(!user) return false;

    profile.user_id = user.id;

    const { error } = await supabaseClient
        .from("profiles")
        .upsert({
            user_id:user.id,

            full_name:profile.full_name,
            email:user.email,
            phone:profile.phone,
            country:profile.country,
            city:profile.city,
            birth_date:profile.birth_date,
            bio:profile.bio,

            sector_key:profile.sector_key,
            sector_name:profile.sector_name,

            profession_key:profile.profession_key,
            profession_name:profile.profession_name,
            profession_title:profile.profession_title,

            module:profile.module,

            avatar_url:profile.avatar,

            premium_level:profile.premium_level,
            hp:profile.hp,
            xp:profile.xp,
            wallet_balance:profile.wallet_balance,

            profile_visible:profile.profile_visible,
            contact_locked:profile.contact_locked,

            updated_at:new Date().toISOString()
        });

    if(error){

        console.error(error);

        return false;

    }

    await supabaseClient.auth.updateUser({

        data:{

            full_name:profile.full_name,

            phone:profile.phone,

            country:profile.country,

            profession_key:profile.profession_key,

            profession_name:profile.profession_name,

            profession_title:profile.profession_title,

            sector_key:profile.sector_key,

            sector_name:profile.sector_name,

            module:profile.module,

            greeting:getGreeting(profile),

            avatar:profile.avatar

        }

    });

    saveLocalProfile(profile);

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

    const ext = file.name.split(".").pop().toLowerCase();
    const filePath = `${user.id}/avatar-${Date.now()}.${ext}`;

    const { error:uploadError } = await supabaseClient.storage
        .from("avatars")
        .upload(filePath,file,{
            cacheControl:"3600",
            upsert:true
        });

    if(uploadError){
        console.error(uploadError);
        alert("Fotoğraf yüklenemedi: " + uploadError.message);
        return null;
    }

    const { data } = supabaseClient.storage
        .from("avatars")
        .getPublicUrl(filePath);

    return data.publicUrl;
}

async function updateHP(amount,reason="HP işlemi"){

    const profile = await getProfile();

    if(!profile) return null;

    profile.hp = Number(profile.hp || 0) + Number(amount || 0);

    await saveProfile(profile);

    console.log("HP güncellendi:", reason, amount);

    return profile.hp;
}

async function updateXP(amount,reason="XP işlemi"){

    const profile = await getProfile();

    if(!profile) return null;

    profile.xp = Number(profile.xp || 0) + Number(amount || 0);

    if(profile.xp >= 100){
        profile.xp = profile.xp - 100;
        profile.level = Number(profile.level || 1) + 1;
    }

    await saveProfile(profile);

    console.log("XP güncellendi:", reason, amount);

    return profile.xp;
}

async function updateWallet(amount,reason="Wallet işlemi"){

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

    window.location.href="user.html";

}

async function requireAuth(){

    const user = await getCurrentUser();

    if(!user){
        window.location.href="user.html";
        return null;
    }

    return user;

}
