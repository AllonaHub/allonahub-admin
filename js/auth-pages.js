(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;

  async function initLogin() {
    const form = document.querySelector("[data-login-form]");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      const data = core.parseForm(form);
      button.disabled = true;
      try {
        await App.auth.signIn(data.email, data.password);
        const returnTo = core.getParam("returnTo");
        window.location.href = returnTo ? decodeURIComponent(returnTo) : core.url("profile.html");
      } catch (error) {
        core.toast(error.message || "Giriş yapılamadı.", "error");
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
        await App.auth.signUp(data);
        core.toast("Kayıt oluşturuldu. E-posta doğrulaması gerekiyorsa gelen kutunuzu kontrol edin.");
        window.location.href = core.url("profile.html");
      } catch (error) {
        core.toast(error.message || "Kayıt oluşturulamadı.", "error");
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
        await App.auth.resetPassword(data.email);
        core.renderStatus("[data-auth-status]", "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.", "success");
      } catch (error) {
        core.renderStatus("[data-auth-status]", error.message || "Şifre sıfırlama başlatılamadı.", "error");
      } finally {
        button.disabled = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initLogin();
    initRegister();
    initForgot();
  });
})();
