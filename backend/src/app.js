import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { registerAutoDefense } from "./lib/auto-defense.js";
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

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: [
        "req.headers.authorization",
        "headers.authorization",
        "SUPABASE_SERVICE_ROLE_KEY",
        "IYZICO_SECRET_KEY",
        "IYZICO_API_KEY"
      ]
    },
    genReqId: requestId,
    trustProxy: true,
    bodyLimit: 1024 * 1024
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
  });

  registerAutoDefense(app);

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, "");
      callback(null, config.allowedOrigins.includes(normalized));
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
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
    request.log.error({ error }, "Request failed");
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
  return app;
}
