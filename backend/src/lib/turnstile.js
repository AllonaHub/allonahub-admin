import { config } from "../config.js";

function shouldBypass() {
  if (config.security?.buildMode) return true;
  return config.env !== "production" && config.turnstile.bypassInDevelopment;
}

export function turnstileConfigured() {
  return Boolean(config.turnstile.secretKey);
}

export function turnstileRequired() {
  if (shouldBypass()) return false;
  if (config.env === "production") return config.turnstile.requiredInProduction;
  return turnstileConfigured();
}

export async function verifyTurnstileToken({ token, ip, action, request }) {
  if (!turnstileRequired() && !token) {
    return { ok: true, skipped: true };
  }

  if (!turnstileConfigured()) {
    return {
      ok: false,
      error: "TURNSTILE_NOT_CONFIGURED",
      message: "Robot doğrulaması yapılandırılmadı."
    };
  }

  if (!token || String(token).length > 2048) {
    return {
      ok: false,
      error: "TURNSTILE_TOKEN_MISSING",
      message: "Robot doğrulaması tamamlanamadı."
    };
  }

  const form = new FormData();
  form.set("secret", config.turnstile.secretKey);
  form.set("response", String(token));
  if (ip) form.set("remoteip", ip);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form
    });
    const result = await response.json().catch(() => ({}));
    const actionOk = !action || !result.action || result.action === action;

    if (response.ok && result.success === true && actionOk) {
      return { ok: true, result };
    }

    return {
      ok: false,
      error: "TURNSTILE_FAILED",
      result,
      message: "Robot doğrulaması başarısız oldu."
    };
  } catch (error) {
    request?.log?.warn({ error: error.message }, "Turnstile verification failed");
    return {
      ok: false,
      error: "TURNSTILE_UNAVAILABLE",
      message: "Robot doğrulaması şu anda tamamlanamadı."
    };
  }
}
