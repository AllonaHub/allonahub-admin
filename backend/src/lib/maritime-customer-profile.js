import { hasRole, supabaseAdmin } from "./supabase.js";

function maritimeProfileError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function cleanProfileSeed(value, maxLength = 180) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, maxLength) : null;
}

const profileColumns = "id,role,full_name,phone,account_status,module,sector_key,sector_name,profession_key,profession_name";

export async function ensureMaritimeCustomerProfile(ctx) {
  if (!ctx?.user || !hasRole(ctx.profile, "customer")) {
    throw maritimeProfileError(
      "Bu alan kişisel kullanıcı hesaplarına açıktır. Şirket hesabıyla giriş yaptıysanız kişisel hesabınızla yeniden giriş yapın.",
      403,
      "CUSTOMER_ACCOUNT_REQUIRED"
    );
  }

  if (ctx.profilePersisted) {
    if (String(ctx.profile.account_status || "active").toLowerCase() !== "active") {
      throw maritimeProfileError("Hesabınız şu anda aktif değil.", 403, "ACCOUNT_NOT_ACTIVE");
    }
    if (String(ctx.profile.module || "").toLowerCase() !== "maritime") {
      const updated = await supabaseAdmin
        .from("profiles")
        .update({ module: "maritime", updated_at: new Date().toISOString() })
        .eq("id", ctx.user.id)
        .select(profileColumns)
        .maybeSingle();
      if (updated.error || !updated.data) {
        throw maritimeProfileError("Kişisel denizcilik profiliniz etkinleştirilemedi.", 503, "MARITIME_PROFILE_ACTIVATION_FAILED");
      }
      ctx.profile = updated.data;
    }
    return ctx;
  }

  const metadata = ctx.user.user_metadata || {};
  const nameParts = [metadata.first_name, metadata.last_name].map((value) => cleanProfileSeed(value, 80)).filter(Boolean);
  const fullName = cleanProfileSeed(metadata.full_name || metadata.name || nameParts.join(" "));
  const seed = {
    id: ctx.user.id,
    full_name: fullName,
    email: cleanProfileSeed(ctx.user.email, 320),
    phone: cleanProfileSeed(ctx.user.phone, 40),
    role: "customer",
    module: "maritime",
    account_status: "active",
    flagged_suspicious: false
  };
  const inserted = await supabaseAdmin
    .from("profiles")
    .insert(seed)
    .select(profileColumns)
    .maybeSingle();
  if (inserted.error && String(inserted.error.code || "") !== "23505") {
    throw maritimeProfileError("Kişisel denizcilik profiliniz hazırlanamadı.", 503, "MARITIME_CUSTOMER_PROFILE_RECOVERY_FAILED");
  }

  let profile = inserted.data || null;
  if (!profile) {
    const recovered = await supabaseAdmin
      .from("profiles")
      .select(profileColumns)
      .eq("id", ctx.user.id)
      .maybeSingle();
    if (recovered.error) {
      throw maritimeProfileError("Kişisel denizcilik profiliniz doğrulanamadı.", 503, "MARITIME_CUSTOMER_PROFILE_RECOVERY_FAILED");
    }
    profile = recovered.data || null;
  }
  if (!profile || !hasRole(profile, "customer")) {
    throw maritimeProfileError(
      "Bu alan kişisel kullanıcı hesaplarına açıktır. Şirket hesabıyla giriş yaptıysanız kişisel hesabınızla yeniden giriş yapın.",
      403,
      "CUSTOMER_ACCOUNT_REQUIRED"
    );
  }
  if (String(profile.account_status || "active").toLowerCase() !== "active") {
    throw maritimeProfileError("Hesabınız şu anda aktif değil.", 403, "ACCOUNT_NOT_ACTIVE");
  }
  ctx.profile = profile;
  ctx.profilePersisted = true;
  return ctx;
}
