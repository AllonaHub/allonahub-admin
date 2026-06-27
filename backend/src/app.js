import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { registerAutoDefense } from "./lib/auto-defense.js";
import { runtimeSecurityProtection } from "./lib/security-alerts.js";
import { registerAssistantRoutes } from "./routes/assistant.js";
import { registerRoutes } from "./routes/index.js";

function requestId() {
  return `aln-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function requestHostname(request) {
  return String(request.headers.host || "")
    .split(":")[0]
    .trim()
    .toLowerCase();
}

function runtimeProtectedPath(pathname, method) {
  const protection = runtimeSecurityProtection();
  const methodName = String(method || "GET").toUpperCase();
  const ownerPath = pathname.startsWith("/v1/control-center")
    || pathname.startsWith("/v1/owner-console")
    || pathname === "/v1/admin/ops/security-monitoring"
    || pathname === "/v1/ops-console/security-monitoring"
    || pathname.startsWith("/v1/admin/security")
    || pathname === "/health"
    || pathname === "/ready";
  if (ownerPath) return null;

  if (protection.apiLocked && pathname.startsWith("/v1/")) {
    return "API_RUNTIME_LOCKED";
  }
  if (protection.paymentsLocked && (
    pathname.startsWith("/v1/payments") ||
    pathname.startsWith("/v1/cv/checkout") ||
    pathname.startsWith("/v1/partner/payment-intents")
  )) {
    return "PAYMENTS_RUNTIME_LOCKED";
  }
  if (protection.ordersLocked && (
    (pathname === "/v1/orders" && methodName !== "GET") ||
    pathname.startsWith("/v1/partner/orders/status")
  )) {
    return "ORDERS_RUNTIME_LOCKED";
  }
  return null;
}

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: [
        "req.headers.authorization",
        "req.body.secret_value",
        "req.body.secrets",
        "headers.authorization",
        "body.secret_value",
        "body.secrets",
        "SUPABASE_SERVICE_ROLE_KEY",
        "IYZICO_SECRET_KEY",
        "IYZICO_API_KEY",
        "ASSISTANT_AI_API_KEY",
        "OPENAI_API_KEY",
        "ASSISTANT_TELEGRAM_BOT_TOKEN",
        "ASSISTANT_META_ACCESS_TOKEN",
        "ASSISTANT_META_WHATSAPP_ACCESS_TOKEN",
        "ASSISTANT_META_INSTAGRAM_ACCESS_TOKEN",
        "ASSISTANT_META_FACEBOOK_PAGE_ACCESS_TOKEN",
        "ASSISTANT_META_APP_SECRET",
        "ASSISTANT_META_VERIFY_TOKEN",
        "SOCIAL_MEDIA_DISPATCH_WEBHOOK_SECRET",
        "SOCIAL_MEDIA_SECRET_ENCRYPTION_KEY",
        "SOCIAL_MEDIA_ASSET_WEBHOOK_SECRET",
        "SOCIAL_MEDIA_ASSET_OPENAI_API_KEY",
        "CRON_SECRET",
        "config.supabase.serviceRoleKey",
        "config.iyzico.secretKey",
        "config.iyzico.apiKey",
        "config.assistant.aiApiKey",
        "config.assistant.telegramBotToken",
        "config.assistant.telegramWebhookSecret",
        "config.assistant.metaAccessToken",
        "config.assistant.metaWhatsappAccessToken",
        "config.assistant.metaInstagramAccessToken",
        "config.assistant.metaFacebookPageAccessToken",
        "config.assistant.metaAppSecret",
        "config.assistant.metaVerifyToken",
        "config.socialMedia.dispatchWebhookSecret",
        "config.socialMedia.secretEncryptionKey",
        "config.socialMedia.assetWebhookSecret",
        "config.socialMedia.assetOpenAiApiKey",
        "config.cronSecret",
        "supabase.serviceRoleKey",
        "iyzico.secretKey",
        "iyzico.apiKey",
        "assistant.aiApiKey",
        "assistant.telegramBotToken",
        "assistant.telegramWebhookSecret",
        "assistant.metaAccessToken",
        "assistant.metaWhatsappAccessToken",
        "assistant.metaInstagramAccessToken",
        "assistant.metaFacebookPageAccessToken",
        "assistant.metaAppSecret",
        "assistant.metaVerifyToken",
        "socialMedia.dispatchWebhookSecret",
        "socialMedia.secretEncryptionKey",
        "socialMedia.assetWebhookSecret",
        "socialMedia.assetOpenAiApiKey",
        "cronSecret"
      ]
    },
    genReqId: requestId,
    trustProxy: true,
    bodyLimit: 1024 * 1024
  });

  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (request, body, done) => {
    request.rawBody = body;
    try {
      const text = body.toString("utf8").trim();
      done(null, text ? JSON.parse(text) : {});
    } catch (error) {
      error.statusCode = 400;
      done(error);
    }
  });

  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
    hidePoweredBy: true,
    frameguard: { action: "deny" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  });

  app.addHook("onRequest", async (request, reply) => {
    const pathname = request.url.split("?")[0];
    const hostname = requestHostname(request);

    if (config.allowedHosts.length && hostname && !config.allowedHosts.includes(hostname)) {
      request.log.warn({ hostname }, "Blocked request with unexpected host");
      return reply.code(421).send({
        ok: false,
        error: "HOST_NOT_ALLOWED",
        message: "İstek doğrulanamadı."
      });
    }

    if (config.emergencyApiDisabled && pathname !== "/health") {
      return reply.code(503).send({
        ok: false,
        error: "API_DISABLED",
        message: "Sistem geçici olarak koruma modunda."
      });
    }

    if (config.maintenanceMode && !["/health", "/ready"].includes(pathname)) {
      return reply.code(503).send({
        ok: false,
        error: "MAINTENANCE_MODE",
        message: "Sistem bakım modunda."
      });
    }

    const runtimeLock = runtimeProtectedPath(pathname, request.method);
    if (runtimeLock) {
      return reply.code(503).send({
        ok: false,
        error: runtimeLock,
        message: "Sistem güvenlik alarmı nedeniyle koruma modunda."
      });
    }
  });

  registerAutoDefense(app);

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, "");
      callback(null, config.allowedOrigins.includes(normalized));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Requested-With"]
  });

  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    hook: "onRequest",
    errorResponseBuilder() {
      return {
        ok: false,
        error: "RATE_LIMITED",
        message: "Çok fazla istek gönderildi. Lütfen biraz bekleyin."
      };
    }
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({
      err: error,
      error_message: error?.message || null,
      error_code: error?.code || null,
      error_details: error?.details || null,
      error_hint: error?.hint || null,
      error_operation: error?.operationLabel || error?.operation_label || null,
      status_code: error?.statusCode || error?.status || null
    }, "Request failed");
    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    const publicMessage = error.name === "ZodError"
      ? "İstek alanları doğrulanamadı."
      : status >= 500
      ? "İşlem şu anda tamamlanamadı."
      : error.message || "İstek doğrulanamadı.";

    reply.code(status).send({
      ok: false,
      error: status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
      message: publicMessage
    });
  });

  registerRoutes(app);
  registerAssistantRoutes(app);
  return app;
}
