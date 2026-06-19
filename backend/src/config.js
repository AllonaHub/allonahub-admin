function readEnv(name, options = {}) {
  const value = process.env[name];
  if ((value === undefined || value === "") && options.required !== false) {
    throw new Error(`${name} is required`);
  }
  return value || options.defaultValue || "";
}

function readNumber(name, defaultValue) {
  const value = Number(process.env[name] || defaultValue);
  if (!Number.isFinite(value)) return defaultValue;
  return value;
}

function csv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";

export const config = {
  env: readEnv("NODE_ENV", { required: false, defaultValue: "production" }),
  port: readNumber("PORT", 3000),
  logLevel: readEnv("LOG_LEVEL", { required: false, defaultValue: "info" }),
  siteUrl: readEnv("SITE_URL", { required: false, defaultValue: "https://allonahub.com" }).replace(/\/$/, ""),
  apiUrl: readEnv("API_URL", { required: false, defaultValue: "https://api.allonahub.com" }).replace(/\/$/, ""),
  allowedOrigins: csv(readEnv("ALLOWED_ORIGINS", { required: false, defaultValue: "https://allonahub.com,https://www.allonahub.com" })),
  cronSecret: readEnv("CRON_SECRET", { required: false, defaultValue: "" }),
  cvPriceTry: readNumber("CV_PRICE_TRY", 149.99),
  supabase: {
    url: readEnv("SUPABASE_URL"),
    anonKey: supabaseAnonKey,
    serviceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY")
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
