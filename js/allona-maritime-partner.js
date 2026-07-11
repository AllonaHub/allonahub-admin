(function () {
  "use strict";

  const App = window.Allona = window.Allona || {};
  const form = document.querySelector("[data-maritime-partner-form]");
  if (!form) return;

  const role = document.getElementById("maritimePartnerRole");
  const companyName = document.getElementById("maritimeCompanyName");
  const contactName = document.getElementById("maritimeContactName");
  const email = document.getElementById("maritimeEmail");
  const phone = document.getElementById("maritimePhone");
  const companyType = document.getElementById("maritimeCompanyType");
  const country = document.getElementById("maritimeCountry");
  const city = document.getElementById("maritimeCity");
  const website = document.getElementById("maritimeWebsite");
  const message = document.getElementById("maritimeMessage");
  const consent = document.getElementById("maritimePrivacyConsent");
  const status = form.querySelector("[data-maritime-partner-status]");
  const result = form.querySelector("[data-maritime-partner-result]");
  const reference = form.querySelector("[data-maritime-partner-reference]");
  const submit = form.querySelector("[data-maritime-partner-submit]");
  const roles = new Set(["shipowner", "broker", "agency", "crewing", "port_service", "technical_service", "other"]);
  let clientRequestId = "";

  if ([role, companyName, contactName, email, phone, companyType, country, city, website, message, consent, submit].some(function (field) { return !field; })) return;

  form.noValidate = true;
  if (status) status.tabIndex = -1;
  if (result) result.tabIndex = -1;

  function compact(value, maxLength) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength || 160);
  }

  function createClientRequestId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    if (!window.crypto?.getRandomValues) return "";
    const bytes = window.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, function (value) { return value.toString(16).padStart(2, "0"); }).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function setStatus(text, tone) {
    if (!status) return;
    status.textContent = text || "";
    status.dataset.tone = tone || "neutral";
    status.setAttribute("role", tone === "error" ? "alert" : "status");
  }

  function setSubmitting(value) {
    submit.disabled = value;
    submit.setAttribute("aria-busy", String(value));
  }

  function showResult(application, duplicate) {
    if (!result) return;
    result.hidden = false;
    if (reference) {
      reference.textContent = application && application.reference_no
        ? `Basvuru no: ${application.reference_no}`
        : "Basvuru inceleme sirasina alindi.";
    }
    setStatus(duplicate ? "Bu basvuru daha once alinmisti; mevcut kayit gosteriliyor." : "Basvurun guvenli sekilde alindi.", "success");
    result.focus({ preventScroll: false });
  }

  function hideResult() {
    if (result) result.hidden = true;
    if (reference) reference.textContent = "";
  }

  function apiBaseUrl() {
    const configured = String(App.config && App.config.apiBaseUrl || "").replace(/\/$/, "");
    if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) return "http://localhost:3000";
    return configured || "https://api.allonahub.com";
  }

  function applyRoleFromQuery() {
    const requestedRole = compact(new URLSearchParams(window.location.search).get("role"), 40).toLocaleLowerCase("tr-TR");
    if (roles.has(requestedRole)) role.value = requestedRole;
  }

  function validateWebsite() {
    website.setCustomValidity("");
    const value = compact(website.value, 500);
    if (!value) return true;
    try {
      const parsed = new URL(value);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("protocol");
      return true;
    } catch (error) {
      website.setCustomValidity("Web sitesi http:// veya https:// ile baslamalidir.");
      return false;
    }
  }

  function focusFirstInvalid() {
    const firstInvalid = form.querySelector(":invalid");
    if (firstInvalid && typeof firstInvalid.focus === "function") {
      firstInvalid.focus({ preventScroll: false });
    } else if (status) {
      status.focus({ preventScroll: false });
    }
  }

  async function challengeToken() {
    if (!App.securityChallenge || !App.securityChallenge.enabled || !App.securityChallenge.enabled()) return "";
    return App.securityChallenge.tokenFor("maritime_partner_application");
  }

  async function authHeaders() {
    const headers = { "Content-Type": "application/json" };
    const session = App.auth && App.auth.getSession ? await App.auth.getSession() : null;
    if (session && session.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    return headers;
  }

  function publicError(error) {
    if (error && error.status === 400) return "Basvuru alanlari veya robot dogrulamasi kabul edilmedi. Bilgileri kontrol et.";
    if (error && error.status === 429) return "Cok fazla basvuru denemesi yapildi. Daha sonra yeniden dene.";
    if (error && error.status === 503) return "Partner basvuru servisi gecici olarak bakimda.";
    return "Basvuru su anda gonderilemedi. Bilgilerini kaybetmeden biraz sonra yeniden dene.";
  }

  applyRoleFromQuery();

  form.addEventListener("input", hideResult);
  website.addEventListener("input", function () { website.setCustomValidity(""); });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    validateWebsite();
    if (!form.checkValidity()) {
      focusFirstInvalid();
      form.reportValidity();
      setStatus("Devam etmek icin zorunlu alanlari kontrol et.", "error");
      return;
    }

    if (!clientRequestId) clientRequestId = createClientRequestId();
    if (!clientRequestId) {
      setStatus("Guvenli basvuru kimligi olusturulamadi. Tarayiciyi guncelleyip yeniden dene.", "error");
      if (status) status.focus({ preventScroll: false });
      return;
    }
    setSubmitting(true);
    hideResult();
    setStatus("Basvuru sunucu katmaninda dogrulaniyor.", "neutral");

    try {
      const turnstileToken = await challengeToken();
      const response = await fetch(`${apiBaseUrl()}/v1/public/maritime/partner-applications`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          client_request_id: clientRequestId,
          partner_role: role.value,
          company_name: compact(companyName.value, 160),
          contact_name: compact(contactName.value, 140),
          email: compact(email.value, 180).toLowerCase(),
          phone: compact(phone.value, 40),
          company_type: companyType.value,
          country: compact(country.value, 90),
          city: compact(city.value, 90),
          website: compact(website.value, 500),
          message: compact(message.value, 1200),
          privacy_consent: consent.checked,
          turnstileToken: turnstileToken
        })
      });
      const payload = await response.json().catch(function () { return {}; });
      if (!response.ok || payload.ok === false) {
        const error = new Error("Partner basvurusu gonderilemedi.");
        error.status = response.status;
        throw error;
      }

      form.reset();
      applyRoleFromQuery();
      clientRequestId = "";
      showResult(payload.application, Boolean(payload.duplicate));
    } catch (error) {
      setStatus(publicError(error), "error");
      if (status) status.focus({ preventScroll: false });
    } finally {
      setSubmitting(false);
    }
  });
})();
