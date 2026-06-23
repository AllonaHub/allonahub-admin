(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;

  const state = {
    status: null,
    enrollment: null
  };

  function $(selector) {
    return document.querySelector(selector);
  }

  function escape(value) {
    return core.escapeHTML(value ?? "");
  }

  function returnTo() {
    const fallback = core.url("/pages/account/user-panel.html");
    const raw = core.getParam("returnTo") || "";
    try {
      const decoded = decodeURIComponent(raw);
      const target = new URL(decoded, window.location.href);
      if (target.origin !== window.location.origin) return fallback;
      return `${target.pathname}${target.search}${target.hash}` || fallback;
    } catch {
      return fallback;
    }
  }

  function qrSrc(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^data:image\/svg\+xml/i.test(raw)) return raw;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`;
  }

  function setStatus(message, tone) {
    const target = $("[data-mfa-status]");
    if (!target) return;
    target.textContent = message || "";
    target.dataset.tone = tone || "";
    target.hidden = !message;
  }

  function show(selector, visible) {
    const node = $(selector);
    if (node) node.hidden = !visible;
  }

  function verifiedFactors() {
    return (state.status?.factors?.all || []).filter((factor) => factor.status === "verified");
  }

  function factorLabel(factor) {
    const name = factor.friendly_name || "Authenticator";
    return `${name} (${factor.type || "totp"})`;
  }

  function renderFactors() {
    const target = $("[data-mfa-factors]");
    if (!target) return;
    const factors = state.status?.factors?.all || [];
    if (!factors.length) {
      target.innerHTML = `<div class="mfa-empty">Kayıtlı MFA cihazı yok.</div>`;
      return;
    }
    target.innerHTML = factors.map((factor) => `
      <div class="mfa-factor">
        <div>
          <strong>${escape(factorLabel(factor))}</strong>
          <span>${escape(factor.status || "unknown")}</span>
        </div>
        ${factor.status === "verified" && state.status?.mfaVerified
          ? `<button class="btn btn--light" type="button" data-mfa-remove="${escape(factor.id)}">Kaldır</button>`
          : ""}
      </div>
    `).join("");
  }

  function renderVerifyChoices() {
    const select = $("[data-mfa-factor-select]");
    if (!select) return;
    const factors = verifiedFactors();
    select.innerHTML = factors.map((factor) => `
      <option value="${escape(factor.id)}">${escape(factorLabel(factor))}</option>
    `).join("");
  }

  function render() {
    const status = state.status;
    const hasVerified = verifiedFactors().length > 0;
    const needsVerification = Boolean(status?.needsVerification);

    $("[data-mfa-current]").textContent = status?.currentLevel || "aal1";
    $("[data-mfa-next]").textContent = status?.nextLevel || "aal1";

    show("[data-mfa-verify-panel]", hasVerified && (needsVerification || !status?.mfaVerified));
    show("[data-mfa-enroll-panel]", !hasVerified);
    show("[data-mfa-manage-panel]", hasVerified && status?.mfaVerified);
    renderFactors();
    renderVerifyChoices();

    if (status?.mfaVerified) {
      setStatus("MFA doğrulandı. Güvenli oturum aktif.", "success");
    } else if (needsVerification) {
      setStatus("MFA doğrulaması gerekli.", "warning");
    } else if (!hasVerified) {
      setStatus("MFA kurulumu bekleniyor.", "warning");
    } else {
      setStatus("MFA cihazı bulundu.", "success");
    }
  }

  async function load() {
    const user = await App.auth.getUser();
    if (!user) {
      window.location.href = core.url(`/pages/account/user.html?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    state.status = await App.auth.mfaStatus();
    render();
  }

  async function startEnrollment() {
    const button = $("[data-mfa-enroll-start]");
    if (button) button.disabled = true;
    try {
      setStatus("MFA kurulumu hazırlanıyor...", "warning");
      const friendlyName = $("[data-mfa-friendly-name]")?.value || "AllonaHub Authenticator";
      state.enrollment = await App.auth.mfaEnroll({ friendlyName });
      const qr = $("[data-mfa-qr]");
      if (qr) {
        qr.hidden = false;
        qr.src = qrSrc(state.enrollment.totp.qrCode);
      }
      show("[data-mfa-enroll-verify]", true);
      setStatus("Authenticator uygulamasındaki kodu girin.", "warning");
    } catch (error) {
      setStatus(error.message || "MFA kurulumu başlatılamadı.", "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function verifyEnrollment(event) {
    event.preventDefault();
    if (!state.enrollment?.factorId) {
      setStatus("MFA kurulumu başlatılmadı.", "error");
      return;
    }
    const form = event.currentTarget;
    const button = form.querySelector("button[type='submit']");
    if (button) button.disabled = true;
    try {
      const code = form.elements.code.value;
      await App.auth.mfaVerify({ factorId: state.enrollment.factorId, code });
      setStatus("MFA etkinleştirildi.", "success");
      await load();
      window.location.href = returnTo();
    } catch (error) {
      setStatus(error.message || "Kod doğrulanamadı.", "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function verifyLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const factorId = form.elements.factorId.value;
    const button = form.querySelector("button[type='submit']");
    if (button) button.disabled = true;
    try {
      await App.auth.mfaChallengeAndVerify(factorId, form.elements.code.value);
      setStatus("MFA doğrulandı.", "success");
      window.location.href = returnTo();
    } catch (error) {
      setStatus(error.message || "Kod doğrulanamadı.", "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function removeFactor(factorId) {
    const factor = (state.status?.factors?.all || []).find((item) => item.id === factorId);
    if (!factor) return;
    if (!window.confirm(`${factorLabel(factor)} kaldırılsın mı?`)) return;
    try {
      await App.auth.mfaUnenroll(factorId);
      setStatus("MFA cihazı kaldırıldı.", "success");
      await load();
    } catch (error) {
      setStatus(error.message || "MFA cihazı kaldırılamadı.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    $("[data-mfa-enroll-start]")?.addEventListener("click", startEnrollment);
    $("[data-mfa-enroll-form]")?.addEventListener("submit", verifyEnrollment);
    $("[data-mfa-verify-form]")?.addEventListener("submit", verifyLogin);
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-mfa-remove]");
      if (button) removeFactor(button.getAttribute("data-mfa-remove"));
    });

    try {
      await load();
    } catch (error) {
      setStatus(error.message || "MFA durumu yüklenemedi.", "error");
    }
  });
})();
