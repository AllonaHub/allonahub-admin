(function () {
  "use strict";

  const App = window.Allona = window.Allona || {};
  let activeAuthorization = null;

  function securityError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function supported() {
    return Boolean(window.isSecureContext && window.PublicKeyCredential && navigator.credentials);
  }

  function apiBase() {
    return String(App.config && App.config.apiBaseUrl || "https://api.allonahub.com").replace(/\/$/, "");
  }

  async function deviceKey() {
    if (!App.cvAccess || typeof App.cvAccess.getDeviceKey !== "function") {
      throw securityError("Güvenli cihaz tanımlaması başlatılamadı.", "MARITIME_DEVICE_KEY_REQUIRED");
    }
    return App.cvAccess.getDeviceKey();
  }

  async function api(path, options) {
    const session = App.auth && App.auth.getSession ? await App.auth.getSession() : null;
    if (!session?.access_token) throw securityError("Oturum doğrulanamadı.", "AUTH_REQUIRED");
    const response = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.access_token}`,
        "X-Allona-Device-Key": await deviceKey(),
        ...(options && options.body ? { "Content-Type": "application/json" } : {}),
        ...(options && options.headers || {})
      }
    });
    const payload = await response.json().catch(function () { return {}; });
    if (!response.ok || payload.ok !== true) {
      throw securityError(payload.message || "Cihaz doğrulaması tamamlanamadı.", payload.code || payload.error || "MARITIME_PASSKEY_REQUEST_FAILED");
    }
    return payload;
  }

  function base64UrlToBytes(value) {
    const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function bytesToBase64Url(value) {
    const bytes = new Uint8Array(value || new ArrayBuffer(0));
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + 8192));
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function registrationOptions(options) {
    return {
      ...options,
      challenge: base64UrlToBytes(options.challenge),
      user: { ...options.user, id: base64UrlToBytes(options.user.id) },
      excludeCredentials: (options.excludeCredentials || []).map(function (entry) {
        return { ...entry, id: base64UrlToBytes(entry.id) };
      })
    };
  }

  function authenticationOptions(options) {
    return {
      ...options,
      challenge: base64UrlToBytes(options.challenge),
      allowCredentials: (options.allowCredentials || []).map(function (entry) {
        return { ...entry, id: base64UrlToBytes(entry.id) };
      })
    };
  }

  function registrationResponse(credential) {
    return {
      id: credential.id,
      rawId: bytesToBase64Url(credential.rawId),
      type: credential.type,
      authenticatorAttachment: credential.authenticatorAttachment || null,
      clientExtensionResults: credential.getClientExtensionResults ? credential.getClientExtensionResults() : {},
      response: {
        clientDataJSON: bytesToBase64Url(credential.response.clientDataJSON),
        attestationObject: bytesToBase64Url(credential.response.attestationObject),
        transports: credential.response.getTransports ? credential.response.getTransports() : []
      }
    };
  }

  function authenticationResponse(credential) {
    return {
      id: credential.id,
      rawId: bytesToBase64Url(credential.rawId),
      type: credential.type,
      authenticatorAttachment: credential.authenticatorAttachment || null,
      clientExtensionResults: credential.getClientExtensionResults ? credential.getClientExtensionResults() : {},
      response: {
        authenticatorData: bytesToBase64Url(credential.response.authenticatorData),
        clientDataJSON: bytesToBase64Url(credential.response.clientDataJSON),
        signature: bytesToBase64Url(credential.response.signature),
        userHandle: credential.response.userHandle ? bytesToBase64Url(credential.response.userHandle) : null
      }
    };
  }

  function normalizeBrowserError(error) {
    if (error?.name === "NotAllowedError") {
      return securityError("Cihaz doğrulaması iptal edildi veya süresi doldu.", "MARITIME_PASSKEY_CANCELLED");
    }
    if (error?.name === "InvalidStateError") {
      return securityError("Bu cihaz anahtarı daha önce kaydedilmiş. Yeniden doğrulamayı deneyin.", "MARITIME_PASSKEY_ALREADY_ENROLLED");
    }
    if (error?.code) return error;
    return securityError("Cihaz doğrulaması tamamlanamadı.", "MARITIME_PASSKEY_BROWSER_ERROR");
  }

  async function enroll() {
    const request = await api("/v1/maritime/passkey/registration/options", {
      method: "POST",
      body: JSON.stringify({})
    });
    let credential;
    try {
      credential = await navigator.credentials.create({ publicKey: registrationOptions(request.options) });
    } catch (error) {
      throw normalizeBrowserError(error);
    }
    if (!credential) throw securityError("Cihaz anahtarı oluşturulamadı.", "MARITIME_PASSKEY_BROWSER_ERROR");
    return api("/v1/maritime/passkey/registration/verify", {
      method: "POST",
      body: JSON.stringify({ challenge_id: request.challenge_id, credential: registrationResponse(credential) })
    });
  }

  async function authenticate() {
    const request = await api("/v1/maritime/passkey/authentication/options", {
      method: "POST",
      body: JSON.stringify({})
    });
    let credential;
    try {
      credential = await navigator.credentials.get({ publicKey: authenticationOptions(request.options) });
    } catch (error) {
      throw normalizeBrowserError(error);
    }
    if (!credential) throw securityError("Cihaz doğrulaması tamamlanamadı.", "MARITIME_PASSKEY_BROWSER_ERROR");
    return api("/v1/maritime/passkey/authentication/verify", {
      method: "POST",
      body: JSON.stringify({ challenge_id: request.challenge_id, credential: authenticationResponse(credential) })
    });
  }

  async function authorizeNow() {
    if (!supported()) {
      throw securityError("Bu tarayıcı güvenli cihaz doğrulamasını desteklemiyor. Güncel Safari, Chrome veya Edge kullanın.", "MARITIME_PASSKEY_UNSUPPORTED");
    }
    const status = await api("/v1/maritime/passkey/status", { method: "GET" });
    let result;
    if (status.enrolled) result = await authenticate();
    else {
      try {
        result = await enroll();
      } catch (error) {
        if (error?.code !== "MARITIME_PASSKEY_ALREADY_ENROLLED") throw error;
        result = await authenticate();
      }
    }
    if (!result?.proof) throw securityError("Cihaz doğrulama kanıtı oluşturulamadı.", "MARITIME_PASSKEY_PROOF_MISSING");
    return result.proof;
  }

  async function authorize() {
    if (activeAuthorization) return activeAuthorization;
    activeAuthorization = authorizeNow().finally(function () { activeAuthorization = null; });
    return activeAuthorization;
  }

  window.AllonaMaritimePasskey = Object.freeze({ authorize, supported });
})();
