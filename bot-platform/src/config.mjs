import { fileURLToPath } from 'node:url';
import path from 'node:path';

const packageRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const repoRoot = path.resolve(packageRoot, '..');

function resolveStorageDir(value) {
  if (!value) {
    return path.join(packageRoot, 'runtime');
  }
  return path.isAbsolute(value) ? value : path.resolve(packageRoot, value);
}

function numberFromEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) ? value : fallback;
}

function boolFromEnv(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

export function loadConfig(overrides = {}) {
  return {
    packageRoot,
    repoRoot,
    host: overrides.host ?? process.env.BOT_HOST ?? '127.0.0.1',
    port: overrides.port ?? numberFromEnv('BOT_PORT', 8787),
    storageDir: overrides.storageDir ?? resolveStorageDir(process.env.BOT_STORAGE_DIR),
    webhookSecret: overrides.webhookSecret ?? process.env.BOT_WEBHOOK_SECRET ?? '',
    rateLimit: {
      windowMs:
        overrides.rateLimit?.windowMs ?? numberFromEnv('BOT_RATE_LIMIT_WINDOW_MS', 60_000),
      max: overrides.rateLimit?.max ?? numberFromEnv('BOT_RATE_LIMIT_MAX', 60)
    },
    ai: {
      enabled: overrides.ai?.enabled ?? boolFromEnv('BOT_ENABLE_AI', false),
      openaiApiKey: overrides.ai?.openaiApiKey ?? process.env.OPENAI_API_KEY ?? '',
      openaiModel: overrides.ai?.openaiModel ?? process.env.OPENAI_MODEL ?? ''
    }
  };
}

export { packageRoot, repoRoot };
