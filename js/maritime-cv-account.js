(function () {
  "use strict";

  const App = window.Allona = window.Allona || {};
  let session = null;
  let accountOwnerId = null;
  let saving = false;
  let statusCopyState = null;

  function setSaveButtonsBusy(busy) {
    document.querySelectorAll("[data-cv-save]").forEach((button) => {
      button.disabled = busy;
      if (busy) button.setAttribute("aria-busy", "true");
      else button.removeAttribute("aria-busy");
    });
  }

  function copy(key, fallback) {
    return typeof window.t === "function" ? window.t(key) : fallback;
  }

  function statusTarget() {
    return document.querySelector("[data-cv-account-status]");
  }

  function setStatus(message, tone, html) {
    const target = statusTarget();
    if (!target) return;
    if (html) target.innerHTML = html;
    else target.textContent = message || "";
    target.className = `cv-account-status${message || html ? " is-visible" : ""}${tone ? ` is-${tone}` : ""}`;
  }

  function setCopyStatus(key, fallback, tone) {
    statusCopyState = { key, fallback, tone };
    setStatus(copy(key, fallback), tone);
  }

  function showLoginPrompt() {
    const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    statusCopyState = { kind: "login", tone: "warning" };
    setStatus("", "warning", `<a href="../account/user.html?returnTo=${returnTo}">${copy("accountLoginRequired", "Sign in to save your Maritime CV to your account.")}</a>`);
  }

  function apiBase() {
    return String(App.config && App.config.apiBaseUrl || "https://api.allonahub.com").replace(/\/$/, "");
  }

  async function deviceKey() {
    if (!App.cvAccess || typeof App.cvAccess.getDeviceKey !== "function") {
      const error = new Error("DEVICE_SECURITY_UNAVAILABLE");
      error.code = "MARITIME_DEVICE_KEY_REQUIRED";
      throw error;
    }
    return App.cvAccess.getDeviceKey();
  }

  async function api(path, options) {
    // A CV may take longer to fill than the lifetime of an access token.
    session = App.auth && App.auth.getSession ? await App.auth.getSession() : null;
    if (!session?.access_token) {
      const error = new Error("AUTH_REQUIRED");
      error.code = "AUTH_REQUIRED";
      throw error;
    }
    if (accountOwnerId && session.user?.id !== accountOwnerId) {
      const error = new Error("AUTH_ACCOUNT_CHANGED");
      error.code = "AUTH_ACCOUNT_CHANGED";
      throw error;
    }
    accountOwnerId = accountOwnerId || session.user?.id;
    const currentDeviceKey = await deviceKey();
    let response;
    try {
      response = await fetch(`${apiBase()}${path}`, {
        ...options,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "X-Allona-Device-Key": currentDeviceKey,
          ...(options && options.body && !(options.body instanceof Blob) ? { "Content-Type": "application/json" } : {}),
          ...(options && options.headers || {})
        }
      });
    } catch (cause) {
      const error = new Error("CV_NETWORK_ERROR", { cause });
      error.code = "CV_NETWORK_ERROR";
      throw error;
    }
    const payload = await response.json().catch(function () { return {}; });
    if (!response.ok || payload.ok !== true) {
      const error = new Error(payload.message || "REQUEST_FAILED");
      error.code = response.status === 401 ? "AUTH_REQUIRED" : payload.code || payload.error || "REQUEST_FAILED";
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function passkeyProof() {
    if (!window.AllonaMaritimePasskey || typeof window.AllonaMaritimePasskey.authorize !== "function") {
      const error = new Error("PASSKEY_SECURITY_UNAVAILABLE");
      error.code = "MARITIME_PASSKEY_UNSUPPORTED";
      throw error;
    }
    return window.AllonaMaritimePasskey.authorize();
  }

  function identityErrorMessage(error) {
    const messages = {
      AUTH_REQUIRED: ["accountLoginRequired", "Sign in to save your Maritime CV to your account."],
      AUTH_ACCOUNT_CHANGED: ["accountChanged", "Your signed-in account changed. Return to the original account before saving this CV."],
      CV_NETWORK_ERROR: ["accountNetworkError", "The connection was interrupted. Your form is preserved. Check your connection and save again."],
      CV_SAVE_IN_PROGRESS: ["accountSaving", "Saving Maritime CV to your account..."],
      MARITIME_CV_REQUIRED_FIELDS_MISSING: ["accountFieldsRequired", "Complete the required fields to create Global CV."],
      PHOTO_TOO_SMALL: ["accountPhotoTooSmall", "Choose a photo at least 300 by 300 pixels. Your CV details are saved."],
      PHOTO_TOO_LARGE: ["accountPhotoTooLarge", "Choose a photo smaller than 12 MB. Your CV details are saved."],
      MARITIME_IDENTITY_ALREADY_REGISTERED: ["identityAlreadyRegistered", "This person is already registered. Contact support if these details belong to you."],
      MARITIME_IDENTITY_LOCKED: ["identityChangeBlocked", "Saved personal details can only be changed through support verification."],
      MARITIME_DEVICE_ALREADY_BOUND: ["deviceAlreadyBound", "This device is linked to another account. Contact support if you cannot access your account."],
      MARITIME_DEVICE_KEY_REQUIRED: ["deviceSecurityFailed", "Secure device identification could not be completed. Check your browser security settings."],
      MARITIME_DEVICE_BINDING_REQUIRED: ["deviceSecurityFailed", "Secure device identification could not be completed. Check your browser security settings."],
      MARITIME_PASSKEY_UNSUPPORTED: ["passkeyUnsupported", "This browser does not support secure device verification. Use current Safari, Chrome or Edge."],
      MARITIME_PASSKEY_CANCELLED: ["passkeyCancelled", "Device verification was cancelled or timed out."],
      MARITIME_PASSKEY_VERIFICATION_REQUIRED: ["passkeyRequired", "Verify with Touch ID, Face ID or your screen lock to save."],
      MARITIME_PASSKEY_VERIFICATION_FAILED: ["passkeyFailed", "Secure device verification failed. Please try again."],
      MARITIME_PASSKEY_SECURITY_UNAVAILABLE: ["passkeyUnavailable", "Secure device verification is temporarily unavailable."]
    };
    const entry = messages[String(error?.code || "")];
    if (entry) return copy(entry[0], entry[1]);
    if (error?.stage === "photo") return copy("accountPhotoSaveFailed", "Your CV details are saved, but the photo could not be uploaded. Retry with the photo before creating Global CV.");
    if (error?.draftSaved) return copy("accountDraftSavedFinalFailed", "Your CV draft is saved. Final verification was not completed; try saving again.");
    return copy("accountSaveFailed", "Your Maritime CV could not be saved to your account. Please try again.");
  }

  function isIdentitySecurityError(error) {
    return new Set([
      "MARITIME_IDENTITY_ALREADY_REGISTERED",
      "MARITIME_IDENTITY_LOCKED",
      "MARITIME_DEVICE_ALREADY_BOUND",
      "MARITIME_DEVICE_KEY_REQUIRED",
      "MARITIME_DEVICE_BINDING_REQUIRED",
      "MARITIME_PASSKEY_UNSUPPORTED",
      "MARITIME_PASSKEY_CANCELLED",
      "MARITIME_PASSKEY_VERIFICATION_REQUIRED",
      "MARITIME_PASSKEY_VERIFICATION_FAILED",
      "MARITIME_PASSKEY_SECURITY_UNAVAILABLE"
    ]).has(String(error?.code || ""));
  }

  function applyIdentityLock(lock) {
    if (typeof window.applyMaritimeIdentityLock === "function") window.applyMaritimeIdentityLock(lock || { locked: false, fields: [] });
  }

  function showPhoto(url) {
    if (!url) return;
    if (typeof window.setMaritimeCvPhoto === "function") {
      window.setMaritimeCvPhoto(url);
      return;
    }
    const image = document.getElementById("cv_photo");
    const empty = document.getElementById("emptyPhoto");
    if (image) {
      image.src = url;
      image.hidden = false;
    }
    if (empty) empty.hidden = true;
    const remove = document.querySelector('[data-cv-action="remove-photo"]');
    if (remove) remove.hidden = false;
  }

  async function savePhoto(file) {
    if (!file) return;
    if (!window.AllonaMaritimePhoto || typeof window.AllonaMaritimePhoto.prepare !== "function") {
      throw new Error("PHOTO_PREPARATION_UNAVAILABLE");
    }
    let prepared;
    try {
      prepared = await window.AllonaMaritimePhoto.prepare(file);
    } catch (error) {
      error.code = error.code || error.message;
      throw error;
    }
    const result = await api("/v1/maritime/profile-photo", {
      method: "POST",
      headers: { "Content-Type": prepared.blob.type },
      body: prepared.blob
    });
    showPhoto(result.profile_photo_url || prepared.preview_url);
  }

  async function removePhoto() {
    session = App.auth && App.auth.getSession ? await App.auth.getSession() : null;
    if (!session?.access_token) return { ok: true, local_only: true };
    return api("/v1/maritime/profile-photo", { method: "DELETE" });
  }

  async function archiveSeaServiceDocument(file, experienceId, originalName) {
    if (!(file instanceof Blob) || !file.size) {
      const error = new Error("SEA_SERVICE_DOCUMENT_INVALID");
      error.code = "SEA_SERVICE_DOCUMENT_INVALID";
      throw error;
    }
    return api("/v1/maritime/sea-service-documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "X-Allona-File-Name": encodeURIComponent(String(originalName || "sea-service-document.pdf").slice(0, 180)),
        "X-Allona-Maritime-Experience-Id": String(experienceId || "")
      },
      body: file
    });
  }

  async function saveSeaExperience(data, rowIndex) {
    const cv = data && typeof data === "object" ? data : {};
    const experience = Array.isArray(cv.seaData) ? cv.seaData[Number(rowIndex)] : null;
    const fields = cv.fields && typeof cv.fields === "object" ? cv.fields : {};
    if (!experience) {
      const error = new Error("MARITIME_REFERENCE_EXPERIENCE_REQUIRED");
      error.code = "MARITIME_REFERENCE_EXPERIENCE_REQUIRED";
      throw error;
    }
    return api("/v1/maritime/reference-verifications", {
      method: "POST",
      body: JSON.stringify({
        experience,
        candidate: {
          first_name: String(fields.firstName || "").trim(),
          middle_name: String(fields.fatherName || "").trim(),
          family_name: String(fields.familyName || "").trim()
        },
        cv_summary: {
          current_position: String(fields.position || "").trim(),
          competency_class: String(fields.competencyClass || "").trim(),
          competency_certificate: String(fields.competencyCertificate || "").trim(),
          medical_expiry: String(fields.medicalExpiry || "").trim(),
          certificate_codes: [...new Set((Array.isArray(cv.stcwData) ? cv.stcwData : [])
            .filter(row => row && row.included !== "false")
            .map(row => String(row.code || "").trim().toUpperCase())
            .filter(Boolean))]
        },
        confirmation: true
      })
    });
  }

  async function save(data, options = {}) {
    if (saving) {
      const error = new Error("CV_SAVE_IN_PROGRESS");
      error.code = "CV_SAVE_IN_PROGRESS";
      throw error;
    }
    const finalize = options.finalize !== false;
    saving = true;
    setSaveButtonsBusy(true);
    setCopyStatus("accountSaving", "Saving Maritime CV to your account...", "progress");
    let draftSaved = false;
    try {
      const photo = document.getElementById("photoInput")?.files?.[0] || null;
      const cleanCv = JSON.parse(JSON.stringify(data || {}));
      delete cleanCv.photo;
      const draftResult = await api("/v1/maritime/cv-profile/draft", {
        method: "PUT",
        body: JSON.stringify({ cv: cleanCv, confirmation: true })
      });
      draftSaved = true;
      // Keep a selected photo until its separate upload succeeds.
      if (window.AllonaMaritimeCvDraft?.write) window.AllonaMaritimeCvDraft.write({ ...data, ...(draftResult.cv || {}) });
      applyIdentityLock(draftResult.identity_lock);
      try {
        let pendingPhoto = photo;
        if (!pendingPhoto && window.AllonaMaritimeCvDraft?.isSafePhotoDataUrl(data?.photo)) {
          pendingPhoto = await (await fetch(data.photo)).blob();
        }
        if (pendingPhoto) {
          await savePhoto(pendingPhoto);
          const input = document.getElementById("photoInput");
          if (photo && input?.files?.[0] === photo) input.value = "";
          if (window.AllonaMaritimeCvDraft?.write) window.AllonaMaritimeCvDraft.write(draftResult.cv || cleanCv);
        }
      } catch (error) {
        error.stage = "photo";
        throw error;
      }
      if (!finalize) {
        setCopyStatus("accountDraftSaved", "Your Maritime CV draft was saved. Complete the required fields to create Global CV.", "success");
        return { ...draftResult, finalized: false };
      }
      const proof = await passkeyProof();
      const result = await api("/v1/maritime/cv-profile", {
        method: "PUT",
        headers: { "X-Allona-Passkey-Proof": proof },
        body: JSON.stringify({ cv: cleanCv, confirmation: true })
      });
      applyIdentityLock(result.identity_lock);
      if (window.AllonaMaritimeCvDraft?.write) window.AllonaMaritimeCvDraft.write(result.cv || data);
      setCopyStatus("accountSaved", "Your Maritime CV and photo were saved to your account.", "success");
      return { ...result, finalized: true };
    } catch (error) {
      statusCopyState = null;
      error.draftSaved = draftSaved;
      setStatus(identityErrorMessage(error), draftSaved ? "warning" : "error");
      throw error;
    } finally {
      saving = false;
      setSaveButtonsBusy(false);
    }
  }

  async function load() {
    session = App.auth && App.auth.getSession ? await App.auth.getSession() : null;
    if (!session) {
      showLoginPrompt();
      return;
    }
    accountOwnerId = session.user?.id;
    if (App.auth && App.auth.requireAccountType) {
      const access = await App.auth.requireAccountType("customer", { user: session.user, redirect: true });
      if (!access) return;
    }
    setCopyStatus("accountLoading", "Loading your saved Maritime CV...", "progress");
    try {
      const result = await api("/v1/maritime/cv-profile", { method: "GET" });
      const pendingPhoto = window.AllonaMaritimeCvDraft?.read?.()?.photo;
      const hasPendingPhoto = window.AllonaMaritimeCvDraft?.isSafePhotoDataUrl(pendingPhoto);
      const cv = result.cv && hasPendingPhoto
        ? { ...result.cv, photo: pendingPhoto }
        : result.cv;
      if (cv && window.applyMaritimeCVData) window.applyMaritimeCVData(cv);
      if (cv && window.AllonaMaritimeCvDraft?.write) window.AllonaMaritimeCvDraft.write(cv);
      applyIdentityLock(result.identity_lock);
      if (!hasPendingPhoto) showPhoto(result.profile_photo_url);
      setCopyStatus(result.cv ? "accountLoaded" : "accountStart", result.cv ? "Your saved Maritime CV is open." : "Complete the relevant fields to add your Maritime CV to your account.", result.cv ? "success" : "info");
    } catch (error) {
      if (error.code === "AUTH_REQUIRED") {
        showLoginPrompt();
      } else if (isIdentitySecurityError(error)) {
        statusCopyState = null;
        setStatus(identityErrorMessage(error), "error");
      } else {
        setCopyStatus("accountLoadFailed", "Your saved CV could not be loaded. Your form has not been cleared. Check your connection and try again.", "warning");
      }
    }
  }

  function supportDialog() {
    return document.querySelector("[data-cv-identity-support-dialog]");
  }

  function openSupportDialog() {
    const dialog = supportDialog();
    if (!dialog) return;
    const status = dialog.querySelector("[data-cv-identity-support-status]");
    if (status) status.textContent = "";
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  async function submitIdentitySupport(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = String(new FormData(form).get("message") || "").trim();
    const submit = form.querySelector('[type="submit"]');
    const target = form.querySelector("[data-cv-identity-support-status]");
    if (message.length < 10) {
      if (target) target.textContent = copy("identitySupportDetailRequired", "Explain the requested correction in at least 10 characters.");
      return;
    }
    if (submit) submit.disabled = true;
    if (target) target.textContent = copy("identitySupportSending", "Creating your secure support request...");
    try {
      const result = await api("/v1/maritime/cv-profile/identity-change-request", {
        method: "POST",
        body: JSON.stringify({ message, confirmation: true })
      });
      if (target) target.textContent = copy(result.already_open ? "identitySupportAlreadyOpen" : "identitySupportSent", result.already_open ? "You already have an open identity correction request." : "Your identity correction request was sent securely.");
      form.querySelector("textarea").value = "";
    } catch (error) {
      if (target) target.textContent = error.message || copy("identitySupportFailed", "The support request could not be created.");
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  document.addEventListener("click", function (event) {
    if (event.target.closest("[data-open-cv-identity-support]")) {
      openSupportDialog();
      return;
    }
    if (!event.target.closest("[data-cv-go-back]")) return;
    if (document.referrer && new URL(document.referrer, window.location.href).origin === window.location.origin && history.length > 1) history.back();
    else window.location.href = "allonadenizcilik.html";
  });

  document.querySelector("[data-cv-identity-support-form]")?.addEventListener("submit", submitIdentitySupport);

  document.addEventListener("allonahub:maritime-cv-language", function () {
    if (statusCopyState?.kind === "login") showLoginPrompt();
    else if (statusCopyState?.key) setCopyStatus(statusCopyState.key, statusCopyState.fallback, statusCopyState.tone);
  });

  window.AllonaMaritimeCvAccount = Object.freeze({ save, removePhoto, archiveSeaServiceDocument, saveSeaExperience, errorMessage: identityErrorMessage });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load, { once: true });
  else load();
})();
