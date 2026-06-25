(function () {
  const App = window.Allona = window.Allona || {};
  const security = App.security;

  function clearLocalAuthState(options) {
    if (App.clearAuthArtifacts) App.clearAuthArtifacts(options);
  }

  function authSafeError(message) {
    return new Error(message || "Oturum doğrulanamadı. Lütfen tekrar giriş yapın.");
  }

  function apiBaseUrl() {
    const configured = String(App.config && App.config.apiBaseUrl || "").replace(/\/$/, "");
    if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) return "http://localhost:3000";
    return configured || "https://api.allonahub.com";
  }

  async function authApi(path, payload) {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) {
      throw authSafeError(body.message || "Kimlik doğrulama isteği tamamlanamadı.");
    }
    return body;
  }

  async function applyBackendSession(session) {
    if (!session || !session.access_token || !session.refresh_token) return null;
    const { data, error } = await App.supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });
    if (error) throw authSafeError("Oturum güvenli şekilde başlatılamadı. Lütfen tekrar deneyin.");
    return data.session || null;
  }

  async function applyMfaSession(data) {
    const session = data && (data.session || (data.access_token ? data : null));
    if (!session || !session.access_token || !session.refresh_token) return null;
    return applyBackendSession(session);
  }

  function passwordLooksSafe(password) {
    const value = String(password || "");
    return value.length >= 8;
  }

  async function getSession() {
    if (!App.supabase) return null;
    try {
      const { data } = await App.supabase.auth.getSession();
      const session = data.session || null;
      if (!session) return null;
      if (session.expires_at && session.expires_at * 1000 < Date.now() - 30000) return null;
      return session;
    } catch (error) {
      return null;
    }
  }

  async function getUser() {
    if (!App.supabase) return null;
    try {
      const { data, error } = await App.supabase.auth.getUser();
      if (error) return null;
      return data.user || null;
    } catch (error) {
      return null;
    }
  }

  async function signIn(email, password, options) {
    const cleanEmail = security ? security.normalizeText(email, { max: 180 }).toLowerCase() : String(email || "").trim().toLowerCase();
    if (security && !security.isEmail(cleanEmail)) throw authSafeError("Geçerli bir e-posta adresi girin.");
    if (!String(password || "")) throw authSafeError("E-posta ve şifrenizi kontrol edin.");
    clearLocalAuthState();
    try {
      await App.supabase.auth.signOut({ scope: "local" });
    } catch (error) {
      // Eski veya bozuk local session giriş denemesini engellemesin.
    }
    const data = await authApi("/v1/auth/login", {
      email: cleanEmail,
      password,
      turnstileToken: options && options.turnstileToken || ""
    });
    await applyBackendSession(data.session);
    const verifiedUser = await getUser();
    if (!verifiedUser || (data.user && verifiedUser.id !== data.user.id)) {
      clearLocalAuthState({ supabaseTokens: true });
      try {
        await App.supabase.auth.signOut({ scope: "local" });
      } catch (error) {
        // Giriş zaten doğrulanmadı.
      }
      throw authSafeError("Oturum güvenli şekilde doğrulanamadı. Lütfen tekrar deneyin.");
    }
    localStorage.setItem("allonahub_auth_verified_at", new Date().toISOString());
    return data;
  }

  function safeReturnPath(value, fallback) {
    const fallbackPath = fallback || App.core.url("/pages/account/user-panel.html");
    const raw = String(value || "").trim();
    if (!raw) return fallbackPath;

    try {
      const decoded = decodeURIComponent(raw);
      const target = new URL(decoded, window.location.href);
      if (target.origin !== window.location.origin) return fallbackPath;
      return `${target.pathname}${target.search}${target.hash}` || fallbackPath;
    } catch (error) {
      return fallbackPath;
    }
  }

  async function signInWithGoogle(returnTo) {
    if (!App.supabase) throw new Error("Supabase istemcisi yüklenemedi.");

    const destination = safeReturnPath(returnTo, App.core.url("/pages/account/user-panel.html"));
    const redirectUrl = new URL(App.core.url("/pages/account/user.html"), window.location.href);
    redirectUrl.searchParams.set("returnTo", destination);

    const { data, error } = await App.supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl.href,
        queryParams: {
          access_type: "offline",
          prompt: "select_account"
        }
      }
    });

    if (error) throw error;
    return data;
  }

  async function verifyHuman(action, turnstileToken) {
    return authApi("/v1/auth/turnstile", {
      action: action || "login",
      turnstileToken: turnstileToken || ""
    });
  }

  async function signUp({ email, password, full_name, phone, profile, turnstileToken }) {
    const cleanEmail = security ? security.normalizeText(email, { max: 180 }).toLowerCase() : String(email || "").trim().toLowerCase();
    const cleanName = security ? security.normalizeText(full_name, { max: 120 }) : String(full_name || "").trim();
    const cleanPhone = security ? security.normalizeText(phone, { max: 30 }) : String(phone || "").trim();
    if (security && !security.isEmail(cleanEmail)) throw authSafeError("Geçerli bir e-posta adresi girin.");
    if (cleanName.length < 2) throw authSafeError("Ad soyad alanını kontrol edin.");
    if (!passwordLooksSafe(password)) throw authSafeError("Şifre en az 8 karakter olmalıdır.");
    const data = await authApi("/v1/auth/register", {
      email: cleanEmail,
      password,
      full_name: cleanName,
      phone: cleanPhone,
      profile: profile || {},
      turnstileToken: turnstileToken || ""
    });
    await applyBackendSession(data.session);
    return data;
  }

  async function signOut(options) {
    const scope = options && options.scope || "local";
    const { error } = await App.supabase.auth.signOut({ scope });
    if (error) throw authSafeError("Çıkış işlemi tamamlanamadı. Lütfen tekrar deneyin.");
    clearLocalAuthState();
    window.location.href = App.core.url("/index.html");
  }

  async function resetPassword(email, options) {
    const cleanEmail = security ? security.normalizeText(email, { max: 180 }).toLowerCase() : String(email || "").trim().toLowerCase();
    if (security && !security.isEmail(cleanEmail)) throw authSafeError("Geçerli bir e-posta adresi girin.");
    await authApi("/v1/auth/forgot-password", {
      email: cleanEmail,
      turnstileToken: options && options.turnstileToken || ""
    });
  }

  function sanitizeMfaFactor(factor) {
    if (!factor) return null;
    return {
      id: factor.id,
      type: factor.factor_type || factor.type || "totp",
      status: factor.status || "",
      friendly_name: factor.friendly_name || factor.friendlyName || "",
      created_at: factor.created_at || null,
      updated_at: factor.updated_at || null
    };
  }

  function normalizeMfaFactors(data) {
    const source = data || {};
    const all = Array.isArray(source.all)
      ? source.all
      : [...(source.totp || []), ...(source.phone || [])];
    return {
      all: all.map(sanitizeMfaFactor).filter(Boolean),
      totp: (source.totp || []).map(sanitizeMfaFactor).filter(Boolean),
      phone: (source.phone || []).map(sanitizeMfaFactor).filter(Boolean)
    };
  }

  function publicMfaError(error, fallback) {
    const message = String(error && error.message || "");
    if (/invalid|code|otp|factor|challenge|expired|verified/i.test(message)) {
      return authSafeError("İki aşamalı doğrulama kodu doğrulanamadı.");
    }
    return authSafeError(fallback || "İki aşamalı doğrulama tamamlanamadı.");
  }

  async function mfaStatus() {
    if (!App.supabase?.auth?.mfa) throw authSafeError("MFA altyapısı yüklenemedi.");
    const user = await getUser();
    if (!user) return {
      authenticated: false,
      currentLevel: "aal1",
      nextLevel: "aal1",
      needsVerification: false,
      factors: { all: [], totp: [], phone: [] }
    };

    const [assurance, factorsResult] = await Promise.all([
      App.supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      App.supabase.auth.mfa.listFactors()
    ]);
    if (assurance.error) throw publicMfaError(assurance.error);
    if (factorsResult.error) throw publicMfaError(factorsResult.error);

    const factors = normalizeMfaFactors(factorsResult.data);
    const currentLevel = assurance.data?.currentLevel || "aal1";
    const nextLevel = assurance.data?.nextLevel || (factors.all.some((factor) => factor.status === "verified") ? "aal2" : currentLevel);
    return {
      authenticated: true,
      currentLevel,
      nextLevel,
      mfaVerified: currentLevel === "aal2",
      needsVerification: currentLevel !== "aal2" && nextLevel === "aal2",
      factors
    };
  }

  async function mfaEnroll(options) {
    if (!App.supabase?.auth?.mfa) throw authSafeError("MFA altyapısı yüklenemedi.");
    const friendlyName = security
      ? security.normalizeText(options?.friendlyName || "AllonaHub Authenticator", { max: 80 })
      : String(options?.friendlyName || "AllonaHub Authenticator").trim().slice(0, 80);
    const { data, error } = await App.supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: friendlyName || "AllonaHub Authenticator"
    });
    if (error) throw publicMfaError(error, "MFA kurulumu başlatılamadı.");
    return {
      factorId: data.id,
      factor: sanitizeMfaFactor(data),
      totp: {
        qrCode: data.totp?.qr_code || data.totp?.qrCode || "",
        uri: data.totp?.uri || ""
      }
    };
  }

  async function mfaChallenge(factorId) {
    if (!App.supabase?.auth?.mfa) throw authSafeError("MFA altyapısı yüklenemedi.");
    const { data, error } = await App.supabase.auth.mfa.challenge({ factorId });
    if (error) throw publicMfaError(error, "MFA doğrulaması başlatılamadı.");
    return {
      challengeId: data.id,
      expiresAt: data.expires_at || data.expiresAt || null
    };
  }

  async function mfaVerify({ factorId, challengeId, code }) {
    if (!App.supabase?.auth?.mfa) throw authSafeError("MFA altyapısı yüklenemedi.");
    const cleanCode = String(code || "").replace(/\D/g, "").slice(0, 6);
    if (!/^\d{6}$/.test(cleanCode)) throw authSafeError("6 haneli doğrulama kodunu girin.");
    const activeChallengeId = challengeId || (await mfaChallenge(factorId)).challengeId;
    const { data, error } = await App.supabase.auth.mfa.verify({
      factorId,
      challengeId: activeChallengeId,
      code: cleanCode
    });
    if (error) throw publicMfaError(error);
    await applyMfaSession(data);
    localStorage.setItem("allonahub_mfa_verified_at", new Date().toISOString());
    return data || {};
  }

  async function mfaChallengeAndVerify(factorId, code) {
    const challenge = await mfaChallenge(factorId);
    return mfaVerify({ factorId, challengeId: challenge.challengeId, code });
  }

  async function mfaUnenroll(factorId) {
    if (!App.supabase?.auth?.mfa) throw authSafeError("MFA altyapısı yüklenemedi.");
    const status = await mfaStatus();
    if (!status.mfaVerified) throw authSafeError("MFA cihazını kaldırmak için önce doğrulama yapın.");
    const { data, error } = await App.supabase.auth.mfa.unenroll({ factorId });
    if (error) throw publicMfaError(error, "MFA cihazı kaldırılamadı.");
    return data || {};
  }

  function mfaUrl(returnTo) {
    const fallback = App.core?.url ? App.core.url("/pages/account/user-panel.html") : "/pages/account/user-panel.html";
    const target = safeReturnPath(returnTo, fallback);
    return App.core.url(`/pages/account/mfa.html?returnTo=${encodeURIComponent(target)}`);
  }

  async function redirectToMfaIfNeeded(returnTo) {
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (/\/pages\/account\/mfa\.html/i.test(window.location.pathname)) return false;
    const status = await mfaStatus();
    if (!status.needsVerification) return false;
    window.location.href = mfaUrl(returnTo || currentPath);
    return true;
  }

  async function applyMfaSession(data) {
    const session = data && (data.session || (data.access_token ? data : null));
    if (!session || !session.access_token || !session.refresh_token) return null;
    const { data: sessionData, error } = await App.supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });
    if (error) throw authSafeError("MFA oturumu güvenli şekilde doğrulanamadı. Lütfen tekrar deneyin.");
    return sessionData.session || null;
  }

  function sanitizeMfaFactor(factor) {
    if (!factor) return null;
    return {
      id: factor.id,
      type: factor.factor_type || factor.type || "totp",
      status: factor.status || "",
      friendly_name: factor.friendly_name || factor.friendlyName || "",
      created_at: factor.created_at || null,
      updated_at: factor.updated_at || null
    };
  }

  function normalizeMfaFactors(data) {
    const source = data || {};
    const all = Array.isArray(source.all)
      ? source.all
      : [...(source.totp || []), ...(source.phone || [])];
    return {
      all: all.map(sanitizeMfaFactor).filter(Boolean),
      totp: (source.totp || []).map(sanitizeMfaFactor).filter(Boolean),
      phone: (source.phone || []).map(sanitizeMfaFactor).filter(Boolean)
    };
  }

  function publicMfaError(error, fallback) {
    const message = String(error && error.message || "");
    if (/invalid|code|otp|factor|challenge|expired|verified/i.test(message)) {
      return authSafeError("İki aşamalı doğrulama kodu doğrulanamadı.");
    }
    return authSafeError(fallback || "İki aşamalı doğrulama tamamlanamadı.");
  }

  async function mfaStatus() {
    if (!App.supabase?.auth?.mfa) throw authSafeError("MFA altyapısı yüklenemedi.");
    const user = await getUser();
    if (!user) {
      return {
        authenticated: false,
        currentLevel: "aal1",
        nextLevel: "aal1",
        mfaVerified: false,
        needsVerification: false,
        factors: { all: [], totp: [], phone: [] }
      };
    }

    const [assurance, factorsResult] = await Promise.all([
      App.supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      App.supabase.auth.mfa.listFactors()
    ]);
    if (assurance.error) throw publicMfaError(assurance.error);
    if (factorsResult.error) throw publicMfaError(factorsResult.error);

    const factors = normalizeMfaFactors(factorsResult.data);
    const currentLevel = assurance.data?.currentLevel || "aal1";
    const nextLevel = assurance.data?.nextLevel || (factors.all.some((factor) => factor.status === "verified") ? "aal2" : currentLevel);
    return {
      authenticated: true,
      currentLevel,
      nextLevel,
      mfaVerified: currentLevel === "aal2",
      needsVerification: currentLevel !== "aal2" && nextLevel === "aal2",
      factors
    };
  }

  async function mfaEnroll(options) {
    if (!App.supabase?.auth?.mfa) throw authSafeError("MFA altyapısı yüklenemedi.");
    const friendlyName = security
      ? security.normalizeText(options?.friendlyName || "AllonaHub Authenticator", { max: 80 })
      : String(options?.friendlyName || "AllonaHub Authenticator").trim().slice(0, 80);
    const { data, error } = await App.supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: friendlyName || "AllonaHub Authenticator"
    });
    if (error) throw publicMfaError(error, "MFA kurulumu başlatılamadı.");
    return {
      factorId: data.id,
      factor: sanitizeMfaFactor(data),
      totp: {
        qrCode: data.totp?.qr_code || data.totp?.qrCode || "",
        uri: data.totp?.uri || ""
      }
    };
  }

  async function mfaChallenge(factorId) {
    if (!App.supabase?.auth?.mfa) throw authSafeError("MFA altyapısı yüklenemedi.");
    const { data, error } = await App.supabase.auth.mfa.challenge({ factorId });
    if (error) throw publicMfaError(error, "MFA doğrulaması başlatılamadı.");
    return {
      challengeId: data.id,
      expiresAt: data.expires_at || data.expiresAt || null
    };
  }

  async function mfaVerify({ factorId, challengeId, code }) {
    if (!App.supabase?.auth?.mfa) throw authSafeError("MFA altyapısı yüklenemedi.");
    const cleanCode = String(code || "").replace(/\D/g, "").slice(0, 6);
    if (!/^\d{6}$/.test(cleanCode)) throw authSafeError("6 haneli doğrulama kodunu girin.");
    const activeChallengeId = challengeId || (await mfaChallenge(factorId)).challengeId;
    const { data, error } = await App.supabase.auth.mfa.verify({
      factorId,
      challengeId: activeChallengeId,
      code: cleanCode
    });
    if (error) throw publicMfaError(error);
    await applyMfaSession(data);
    localStorage.setItem("allonahub_mfa_verified_at", new Date().toISOString());
    return data || {};
  }

  async function mfaChallengeAndVerify(factorId, code) {
    const challenge = await mfaChallenge(factorId);
    return mfaVerify({ factorId, challengeId: challenge.challengeId, code });
  }

  async function mfaUnenroll(factorId) {
    if (!App.supabase?.auth?.mfa) throw authSafeError("MFA altyapısı yüklenemedi.");
    const status = await mfaStatus();
    if (!status.mfaVerified) throw authSafeError("MFA cihazını kaldırmak için önce doğrulama yapın.");
    const { data, error } = await App.supabase.auth.mfa.unenroll({ factorId });
    if (error) throw publicMfaError(error, "MFA cihazı kaldırılamadı.");
    return data || {};
  }

  function mfaUrl(returnTo) {
    const fallback = App.core?.url ? App.core.url("/pages/account/user-panel.html") : "/pages/account/user-panel.html";
    const target = safeReturnPath(returnTo, fallback);
    return App.core.url(`/pages/account/mfa.html?returnTo=${encodeURIComponent(target)}`);
  }

  async function redirectToMfaIfNeeded(returnTo) {
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (/\/pages\/account\/mfa\.html/i.test(window.location.pathname)) return false;
    const status = await mfaStatus();
    if (!status.needsVerification) return false;
    window.location.href = mfaUrl(returnTo || currentPath);
    return true;
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
      full_name: security ? security.normalizeText(payload.full_name, { max: 120 }) : payload.full_name || "",
      phone: security ? security.normalizeText(payload.phone, { max: 30 }) : payload.phone || "",
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
    window.location.href = App.core.url(`/pages/account/user.html?returnTo=${returnTo}`);
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
    signInWithGoogle,
    verifyHuman,
    signUp,
    signOut,
    resetPassword,
    mfaStatus,
    mfaEnroll,
    mfaChallenge,
    mfaVerify,
    mfaChallengeAndVerify,
    mfaUnenroll,
    mfaUrl,
    redirectToMfaIfNeeded,
    requireAuth,
    requireRole,
    clearLocalAuthState
  };
})();
