const INLINE_AVATAR_KEYS = ["avatar_url", "avatar", "picture"];

function inlineImage(value) {
  return typeof value === "string" && /^data:image\//i.test(value);
}

function repairError() {
  const error = new Error("Oturum hazırlanamadı. Bilgileriniz korunuyor; lütfen yeniden giriş yapın.");
  error.statusCode = 503;
  error.code = "AUTH_SESSION_PREPARATION_FAILED";
  return error;
}

// Auth metadata is embedded in every JWT. Keep image bytes in the profile,
// and only clear the duplicate after its persistent copy is confirmed.
export async function repairInlineAuthAvatar(admin, user) {
  const metadata = user?.user_metadata || {};
  const keys = INLINE_AVATAR_KEYS.filter(key => inlineImage(metadata[key]));
  if (!keys.length) return false;
  const profile = await admin.from("profiles").select("id,avatar_url").eq("id", user.id).maybeSingle();
  if (profile.error || !profile.data) throw repairError();
  if (!profile.data.avatar_url) {
    const saved = await admin.from("profiles")
      .update({ avatar_url: metadata[keys[0]] })
      .eq("id", user.id).select("id,avatar_url").maybeSingle();
    if (saved.error || saved.data?.avatar_url !== metadata[keys[0]]) throw repairError();
  }
  const updated = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: Object.fromEntries(keys.map(key => [key, null]))
  });
  if (updated.error || !updated.data?.user || keys.some(key => inlineImage(updated.data.user.user_metadata?.[key]))) {
    throw repairError();
  }
  return true;
}

export async function preparePasswordLoginSession({ admin, auth, data, email, password }) {
  if (!await repairInlineAuthAvatar(admin, data.user)) return data;
  // Refresh through the supplied password, not a client-provided user ID/token.
  const renewed = await auth.signInWithPassword({ email, password });
  if (renewed.error || !renewed.data?.session || renewed.data.user?.id !== data.user.id) throw repairError();
  if (renewed.data.session.access_token.length > 12000) throw repairError();
  return renewed.data;
}
