(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const security = App.security;

  function authError(error, fallback) {
    return security ? security.publicErrorMessage(error, fallback) : (fallback || "İşlem tamamlanamadı.");
  }

  function safeReturnTo(value) {
    const fallback = core.url("/pages/account/user-panel.html");
    const raw = String(value || "").trim();
    if (!raw) return fallback;

    try {
      const decoded = decodeURIComponent(raw);
      const target = new URL(decoded, window.location.href);
      if (target.origin !== window.location.origin) return fallback;
      return `${target.pathname}${target.search}${target.hash}` || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function isAuthLandingPage() {
    return Boolean(document.querySelector("[data-login-form]") || document.querySelector("[data-register-form]"));
  }

  async function redirectAuthenticatedUser(session) {
    if (!isAuthLandingPage()) return;
    const user = await App.auth.getUser();
    if (!user) return;

    const returnTo = safeReturnTo(core.getParam("returnTo"));
    if (App.auth.redirectToMfaIfNeeded && await App.auth.redirectToMfaIfNeeded(returnTo)) return;
    if (App.complianceAudit && session) {
      await App.complianceAudit.record({
        category: "account",
        action: "oauth_session_verified",
        severity: "info",
        resourceType: "user",
        resourceId: user.id,
        evidenceTags: ["auth", "oauth"],
        metadata: { return_to: returnTo }
      });
    }
    window.location.replace(returnTo);
  }

  function initOAuthRedirect() {
    if (!isAuthLandingPage() || !App.supabase) return;

    App.supabase.auth.onAuthStateChange((event, session) => {
      if (session && ["INITIAL_SESSION", "SIGNED_IN"].includes(event)) {
        redirectAuthenticatedUser(session);
      }
    });

    redirectAuthenticatedUser();
  }

  function initGoogleLogin() {
    document.querySelectorAll("[data-google-login]").forEach((button) => {
      button.addEventListener("click", async () => {
        const returnTo = core.getParam("returnTo") || button.getAttribute("data-return-to") || "/pages/account/user-panel.html";
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = "Google'a yönlendiriliyor...";

        try {
          const limit = security && security.rateLimit("google-login", { limit: 10, windowMs: 15 * 60 * 1000 });
          if (limit && !limit.allowed) {
            throw new Error(`Çok fazla Google giriş denemesi. ${limit.retryAfter} saniye sonra tekrar deneyin.`);
          }
          await App.auth.signInWithGoogle(returnTo);
        } catch (error) {
          const message = /Çok fazla/i.test(error.message || "")
            ? error.message
            : authError(error, "Google ile giriş başlatılamadı. Lütfen daha sonra tekrar deneyin.");
          core.toast(message, "error");
          core.renderStatus("[data-auth-status]", message, "error");
          button.disabled = false;
          button.textContent = originalText;
        }
      });
    });
  }

  async function initLogin() {
    const form = document.querySelector("[data-login-form]");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      const data = core.parseForm(form);
      button.disabled = true;
      try {
        const limit = security && security.rateLimit("login", { limit: 8, windowMs: 15 * 60 * 1000 });
        if (limit && !limit.allowed) {
          throw new Error(`Çok fazla giriş denemesi. ${limit.retryAfter} saniye sonra tekrar deneyin.`);
        }
        if (security && !security.isEmail(data.email)) {
          throw new Error("Geçerli bir e-posta adresi girin.");
        }
        await App.auth.signIn(data.email, data.password);
        if (App.cvAccess && App.cvAccess.ensureAccess) {
          await App.cvAccess.ensureAccess("login");
        }
        const returnTo = safeReturnTo(core.getParam("returnTo"));
        if (App.auth.redirectToMfaIfNeeded && await App.auth.redirectToMfaIfNeeded(returnTo)) return;
        if (App.complianceAudit) {
          const user = await App.auth.getUser();
          await App.complianceAudit.record({
            category: "account",
            action: "login_success",
            severity: "info",
            resourceType: "user",
            resourceId: user && user.id,
            evidenceTags: ["auth", "login"],
            metadata: { return_to: returnTo }
          });
        }
        window.location.href = returnTo;
      } catch (error) {
        const message = /Çok fazla|e-posta/i.test(error.message || "") ? error.message : authError(error, "Giriş yapılamadı. E-posta ve şifrenizi kontrol edin.");
        core.toast(message, "error");
      } finally {
        button.disabled = false;
      }
    });
  }

  async function initRegister() {
    const form = document.querySelector("[data-register-form]");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      const data = core.parseForm(form);
      button.disabled = true;
      try {
        const limit = security && security.rateLimit("register", { limit: 5, windowMs: 60 * 60 * 1000 });
        if (limit && !limit.allowed) {
          throw new Error(`Çok fazla kayıt denemesi. ${limit.retryAfter} saniye sonra tekrar deneyin.`);
        }
        if (security) {
          data.full_name = security.normalizeText(data.full_name, { max: 120 });
          data.phone = security.normalizeText(data.phone, { max: 30 });
          data.email = security.normalizeText(data.email, { max: 180 }).toLowerCase();
          if (data.full_name.length < 2) throw new Error("Ad soyad alanını kontrol edin.");
          if (!security.isEmail(data.email)) throw new Error("Geçerli bir e-posta adresi girin.");
          if (data.phone && !security.isPhone(data.phone)) throw new Error("Telefon numarasını kontrol edin.");
          if (String(data.password || "").length < 8) throw new Error("Şifre en az 8 karakter olmalıdır.");
        }
        if (App.cvAccess && App.cvAccess.reportSignupAttempt) {
          await App.cvAccess.reportSignupAttempt(data.email, "register_submit");
        }
        await App.auth.signUp(data);
        if (App.cvAccess && App.cvAccess.ensureAccess) {
          await App.cvAccess.ensureAccess("signup");
        }
        if (App.complianceAudit) {
          const user = await App.auth.getUser();
          await App.complianceAudit.record({
            category: "account",
            action: "registration_success",
            severity: "info",
            resourceType: "user",
            resourceId: user && user.id,
            evidenceTags: ["auth", "registration"],
            metadata: { phone_supplied: Boolean(data.phone) }
          });
        }
        core.toast("Kayıt oluşturuldu. E-posta doğrulaması gerekiyorsa gelen kutunuzu kontrol edin.");
        window.location.href = safeReturnTo(core.getParam("returnTo"));
      } catch (error) {
        const message = /çok fazla|kontrol edin|geçerli|şifre/i.test(error.message || "") ? error.message : authError(error, "Kayıt oluşturulamadı. Lütfen bilgilerinizi kontrol edin.");
        core.toast(message, "error");
      } finally {
        button.disabled = false;
      }
    });
  }

  async function initForgot() {
    const form = document.querySelector("[data-forgot-form]");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      const data = core.parseForm(form);
      button.disabled = true;
      try {
        const limit = security && security.rateLimit("forgot-password", { limit: 4, windowMs: 30 * 60 * 1000 });
        if (limit && !limit.allowed) {
          throw new Error(`Çok fazla deneme. ${limit.retryAfter} saniye sonra tekrar deneyin.`);
        }
        if (security && !security.isEmail(data.email)) {
          throw new Error("Geçerli bir e-posta adresi girin.");
        }
        await App.auth.resetPassword(data.email);
        core.renderStatus("[data-auth-status]", "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.", "success");
      } catch (error) {
        const message = /çok fazla|geçerli/i.test(error.message || "") ? error.message : authError(error, "Şifre sıfırlama başlatılamadı. Lütfen daha sonra tekrar deneyin.");
        core.renderStatus("[data-auth-status]", message, "error");
      } finally {
        button.disabled = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initOAuthRedirect();
    initLogin();
    initRegister();
    initForgot();
    initGoogleLogin();
  });
})();
