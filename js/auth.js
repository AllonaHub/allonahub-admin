(function () {
  const App = window.Allona = window.Allona || {};

  async function getSession() {
    if (!App.supabase) return null;
    const { data } = await App.supabase.auth.getSession();
    return data.session || null;
  }

  async function getUser() {
    if (!App.supabase) return null;
    const { data } = await App.supabase.auth.getUser();
    return data.user || null;
  }

  async function signIn(email, password) {
    const { data, error } = await App.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signUp({ email, password, full_name, phone }) {
    const { data, error } = await App.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          phone
        }
      }
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await App.supabase.auth.signOut();
    if (error) throw error;
    window.location.href = App.core.url("index.html");
  }

  async function resetPassword(email) {
    const redirectTo = `${window.location.origin}${App.core.url("profile.html")}`;
    const { error } = await App.supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }

  async function getProfile(userId) {
    const user = userId ? { id: userId } : await getUser();
    if (!user) return null;

    const { data, error } = await App.db.client()
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;

    const authUser = await getUser();
    return {
      id: user.id,
      full_name: authUser && authUser.user_metadata && authUser.user_metadata.full_name || "",
      phone: authUser && authUser.user_metadata && authUser.user_metadata.phone || "",
      role: "customer"
    };
  }

  async function upsertProfile(payload) {
    const user = await getUser();
    if (!user) throw new Error("Profil güncellemek için giriş yapmalısınız.");
    const current = await getProfile(user.id);

    const profile = {
      id: user.id,
      full_name: payload.full_name || "",
      phone: payload.phone || "",
      role: current?.role || "customer",
      updated_at: new Date().toISOString()
    };

    const { data, error } = await App.db.client()
      .from("profiles")
      .upsert(profile)
      .select("*")
      .single();
    if (error) throw error;

    await App.supabase.auth.updateUser({
      data: {
        full_name: profile.full_name,
        phone: profile.phone
      }
    });

    return data;
  }

  async function requireAuth() {
    const user = await getUser();
    if (user) return user;
    const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    window.location.href = App.core.url(`login.html?returnTo=${returnTo}`);
    return null;
  }

  async function requireRole(roles) {
    const user = await requireAuth();
    if (!user) return null;
    const profile = await getProfile(user.id);
    if (!profile || !roles.includes(profile.role)) {
      throw new Error("Bu alana erişim yetkiniz yok.");
    }
    return { user, profile };
  }

  App.auth = {
    getSession,
    getUser,
    getProfile,
    upsertProfile,
    signIn,
    signUp,
    signOut,
    resetPassword,
    requireAuth,
    requireRole
  };
})();
