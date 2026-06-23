const SECRET_ENV_NAMES = new Set([
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TURNSTILE_SECRET_KEY",
  "IYZICO_API_KEY",
  "IYZICO_SECRET_KEY",
  "CRON_SECRET",
  "ASSISTANT_AI_API_KEY",
  "OPENAI_API_KEY",
  "ASSISTANT_TELEGRAM_BOT_TOKEN",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "SECURITY_ALERT_EMAIL_WEBHOOK_SECRET"
]);

function readEnv(name, options = {}) {
  const value = process.env[name];
  if ((value === undefined || value === "") && options.required !== false) {
    if (SECRET_ENV_NAMES.has(name)) {
      throw new Error("Required server secret is missing");
    }
    throw new Error(`${name} is required`);
  }
  return value || options.defaultValue || "";
}

function readSecretFallback(primaryName, fallbackName) {
  const value = process.env[primaryName] || process.env[fallbackName];
  if (!value) {
    throw new Error("Required server secret is missing");
  }
  return value;
}

function readNumber(name, defaultValue) {
  const value = Number(process.env[name] || defaultValue);
  if (!Number.isFinite(value)) return defaultValue;
  return value;
}

function readBool(name, defaultValue = false) {
  const value = process.env[name];
  if (value === undefined || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function readOptionalSecret(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return "";
}

function csv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
const supabaseServiceKey = readSecretFallback("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");

export const config = {
  env: readEnv("NODE_ENV", { required: false, defaultValue: "production" }),
  port: readNumber("PORT", 3000),
  logLevel: readEnv("LOG_LEVEL", { required: false, defaultValue: "info" }),
  siteUrl: readEnv("SITE_URL", { required: false, defaultValue: "https://allonahub.com" }).replace(/\/$/, ""),
  apiUrl: readEnv("API_URL", { required: false, defaultValue: "https://api.allonahub.com" }).replace(/\/$/, ""),
  allowedOrigins: csv(readEnv("ALLOWED_ORIGINS", { required: false, defaultValue: "https://allonahub.com,https://www.allonahub.com,https://admin.allonahub.com,https://allonahub.github.io" })),
  allowedHosts: csv(readEnv("ALLOWED_HOSTS", { required: false, defaultValue: "api.allonahub.com,admin.allonahub.com,localhost,127.0.0.1" })),
  adminHosts: csv(readEnv("ADMIN_HOSTS", { required: false, defaultValue: "admin.allonahub.com,api.allonahub.com" })),
  adminIpAllowlist: csv(readEnv("ADMIN_IP_ALLOWLIST", { required: false, defaultValue: "" })),
  mfaRequiredRoles: csv(readEnv("MFA_REQUIRED_ROLES", { required: false, defaultValue: "partner,courier,admin,super_admin" })),
  adminMfaEnforced: readBool("ADMIN_MFA_ENFORCED", false),
  superAdminMfaEnforced: readBool("SUPER_ADMIN_MFA_ENFORCED", false),
  cronSecret: readEnv("CRON_SECRET", { required: false, defaultValue: "" }),
  maintenanceMode: readBool("MAINTENANCE_MODE", false),
  emergencyApiDisabled: readBool("EMERGENCY_API_DISABLED", false),
  paymentsDisabled: readBool("PAYMENTS_DISABLED", false),
  auditEnabled: readBool("AUDIT_LOG_ENABLED", true),
  turnstile: {
    siteKey: readEnv("TURNSTILE_SITE_KEY", { required: false, defaultValue: "" }),
    secretKey: readEnv("TURNSTILE_SECRET_KEY", { required: false, defaultValue: "" }),
    requiredInProduction: readBool("TURNSTILE_REQUIRED_IN_PRODUCTION", true),
    bypassInDevelopment: readBool("TURNSTILE_BYPASS_IN_DEVELOPMENT", true)
  },
  autoDefense: {
    enabled: readBool("AUTO_DEFENSE_ENABLED", true),
    scoreThreshold: readNumber("AUTO_DEFENSE_SCORE_THRESHOLD", 12),
    windowMinutes: readNumber("AUTO_DEFENSE_WINDOW_MINUTES", 10),
    ipBlockMinutes: readNumber("AUTO_DEFENSE_IP_BLOCK_MINUTES", 15),
    adminLockMinutes: readNumber("AUTO_DEFENSE_ADMIN_LOCK_MINUTES", 10),
    strictModeMinutes: readNumber("AUTO_DEFENSE_STRICT_MODE_MINUTES", 10),
    maxRecentIncidents: readNumber("AUTO_DEFENSE_MAX_RECENT_INCIDENTS", 100),
    revokeSuspiciousSessions: readBool("AUTO_DEFENSE_REVOKE_SESSIONS", false),
    ipDenylist: csv(readEnv("AUTO_DEFENSE_IP_DENYLIST", { required: false, defaultValue: "" })),
    cfBotScoreBlockBelow: readNumber("AUTO_DEFENSE_CF_BOT_SCORE_BLOCK_BELOW", 10),
    cfThreatScoreBlockAbove: readNumber("AUTO_DEFENSE_CF_THREAT_SCORE_BLOCK_ABOVE", 50)
  },
  alerts: {
    telegramBotToken: readEnv("TELEGRAM_BOT_TOKEN", { required: false, defaultValue: "" }),
    telegramChatId: readEnv("TELEGRAM_CHAT_ID", { required: false, defaultValue: "" }),
    emailWebhookUrl: readEnv("SECURITY_ALERT_EMAIL_WEBHOOK_URL", { required: false, defaultValue: "" }),
    emailWebhookSecret: readEnv("SECURITY_ALERT_EMAIL_WEBHOOK_SECRET", { required: false, defaultValue: "" }),
    alertFrom: readEnv("SECURITY_ALERT_FROM", { required: false, defaultValue: "security@allonahub.com" }),
    alertTo: readEnv("SECURITY_ALERT_TO", { required: false, defaultValue: "" })
  },
  assistant: {
    enabled: readBool("ASSISTANT_ENABLED", true),
    aiProvider: readEnv("ASSISTANT_AI_PROVIDER", { required: false, defaultValue: "rules" }),
    aiApiKey: readOptionalSecret("ASSISTANT_AI_API_KEY", "OPENAI_API_KEY"),
    aiBaseUrl: readEnv("ASSISTANT_AI_BASE_URL", { required: false, defaultValue: "https://api.openai.com/v1/responses" }).replace(/\/$/, ""),
    aiModel: readEnv("ASSISTANT_AI_MODEL", { required: false, defaultValue: "gpt-4o-mini" }),
    aiTemperature: readNumber("ASSISTANT_AI_TEMPERATURE", 0.2),
    aiTimeoutMs: readNumber("ASSISTANT_AI_TIMEOUT_MS", 12000),
    maxMessageChars: readNumber("ASSISTANT_MAX_MESSAGE_CHARS", 1600),
    maxReplyChars: readNumber("ASSISTANT_MAX_REPLY_CHARS", 700),
    rateLimitMax: readNumber("ASSISTANT_RATE_LIMIT_MAX", 20),
    telegramBotToken: readOptionalSecret("ASSISTANT_TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_TOKEN"),
    telegramWebhookSecret: readEnv("TELEGRAM_WEBHOOK_SECRET", { required: false, defaultValue: "" })
  },
  cvPriceTry: readNumber("CV_PRICE_TRY", 149.99),
  supabase: {
    url: readEnv("SUPABASE_URL"),
    anonKey: supabaseAnonKey,
    serviceRoleKey: supabaseServiceKey
  },
  iyzico: {
    apiKey: readEnv("IYZICO_API_KEY"),
    secretKey: readEnv("IYZICO_SECRET_KEY"),
    baseUrl: readEnv("IYZICO_BASE_URL", { required: false, defaultValue: "https://sandbox-api.iyzipay.com" }).replace(/\/$/, "")
  }
};

if (!config.supabase.anonKey) {
  throw new Error("SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY is required");
}
