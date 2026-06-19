import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { registerRoutes } from "./routes/index.js";

function requestId() {
  return `aln-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
    contentSecurityPolicy: false
  });

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
