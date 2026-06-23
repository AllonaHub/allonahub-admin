import { config } from "../config.js";
import { sendSecurityAlert } from "./alerts.js";
import { auditEvent, authContext, supabaseAdmin } from "./supabase.js";

const SQLI_PATTERN = /\b(union\s+select|information_schema|pg_sleep|benchmark\s*\(|sleep\s*\(|or\s+1\s*=\s*1|drop\s+table|insert\s+into|select\s+.+from)\b/i;
const XSS_PATTERN = /(<script|javascript:|onerror\s*=|onload\s*=|<iframe|data:text\/html)/i;
const TRAVERSAL_PATTERN = /(\.\.\/|\.\.\\|%2e%2e|%252e%252e|\/etc\/passwd|\\windows\\win\.ini)/i;
const PROBE_PATTERN = /(\/wp-admin|\/wp-login|\/wordpress|\/xmlrpc\.php|\/phpmyadmin|\/\.env|\/vendor\/phpunit|\/cgi-bin|\/adminer)/i;
const SENSITIVE_PATH_PATTERN = /^\/v1\/(admin|ops-console|control-center|payments|cv|orders|partner|rewards|hp-wallet|cron)\b/i;
const ADMIN_PATH_PATTERN = /^\/v1\/(admin|ops-console|control-center)\b/i;

const state = {
  ipScores: new Map(),
  routeCounters: new Map(),
  blockedIps: new Map(),
  alertKeys: new Map(),
  recentIncidents: [],
  strictModeUntil: 0,
  adminLockedUntil: 0
};

function now() {
  return Date.now();
}

function minutes(value) {
  return Math.max(1, Number(value || 1)) * 60 * 1000;
}

function clientIp(request) {
  return String(request.headers["cf-connecting-ip"] || request.ip || "0.0.0.0").split(",")[0].trim();
}

function routePath(request) {
  return String(request.url || "/").split("?")[0] || "/";
}

function hostName(request) {
  return String(request.headers.host || "").split(":")[0].trim().toLowerCase();
}

function hasBearerToken(request) {
  return /^bearer\s+\S+/i.test(String(request.headers.authorization || "").trim());
}

function canPassPrivilegedAuthGate(request, pathname = routePath(request)) {
  return ADMIN_PATH_PATTERN.test(pathname) && hasBearerToken(request);
}

function compactPath(pathname) {
  return String(pathname || "/").replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ":uuid").slice(0, 180);
}

function normalizePayload(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.slice(0, 4000);
  try {
    return JSON.stringify(value).slice(0, 4000);
  } catch {
    return "";
  }
}

function cleanup() {
  const cutoff = now() - minutes(config.autoDefense.windowMinutes);
  for (const [key, item] of state.ipScores.entries()) {
    if (item.lastSeen < cutoff) state.ipScores.delete(key);
  }
  for (const [key, item] of state.routeCounters.entries()) {
    if (item.lastSeen < cutoff) state.routeCounters.delete(key);
  }
  for (const [key, blockedUntil] of state.blockedIps.entries()) {
    if (blockedUntil <= now()) state.blockedIps.delete(key);
  }
  for (const [key, alertedAt] of state.alertKeys.entries()) {
    if (alertedAt < cutoff) state.alertKeys.delete(key);
  }
}

function pushIncident(report) {
  state.recentIncidents.unshift(report);
  if (state.recentIncidents.length > config.autoDefense.maxRecentIncidents) {
    state.recentIncidents.length = config.autoDefense.maxRecentIncidents;
  }
}

function routeLimitFor(pathname, request) {
  const strict = state.strictModeUntil > now();
  if (ADMIN_PATH_PATTERN.test(pathname) && hasBearerToken(request)) return strict ? 30 : 80;
  if (ADMIN_PATH_PATTERN.test(pathname)) return strict ? 8 : 16;
  if (/^\/v1\/payments\b/i.test(pathname)) return strict ? 10 : 24;
  if (/^\/v1\/(orders|cv|partner|rewards|hp-wallet)\b/i.test(pathname)) return strict ? 18 : 36;
  return strict ? 60 : 120;
}

function countRoute(ip, pathname) {
  const bucketMs = 60 * 1000;
  const bucket = Math.floor(now() / bucketMs);
  const key = `${ip}:${bucket}:${compactPath(pathname)}`;
  const current = state.routeCounters.get(key) || { count: 0, lastSeen: now() };
  current.count += 1;
  current.lastSeen = now();
  state.routeCounters.set(key, current);
  return current.count;
}

function addScore(ip, amount, signals) {
  const current = state.ipScores.get(ip) || { score: 0, firstSeen: now(), lastSeen: now(), signals: [] };
  current.score += amount;
  current.lastSeen = now();
  current.signals = [...current.signals, ...signals].slice(-12);
  state.ipScores.set(ip, current);
  return current;
}

function automaticActionsFor(signals) {
  const actions = ["audit_log", "security_alert"];
  if (signals.some((signal) => signal.action === "ip_block")) actions.push("temporary_ip_block");
  if (signals.some((signal) => signal.action === "admin_lock")) actions.push("temporary_admin_lock");
  if (signals.some((signal) => signal.action === "strict_mode")) actions.push("temporary_strict_rate_limit");
  if (signals.some((signal) => signal.action === "session_revoke")) actions.push("suspicious_session_revoke");
  return [...new Set(actions)];
}

function recommendationsFor(attackType) {
  const common = [
    "Cloudflare WAF eventleri ve Traefik access loglari karsilastirilmali.",
    "Ayni IP/ASN tekrarliyorsa Cloudflare rule veya Access policy ile kalici kural insan onayi sonrasi eklenmeli.",
    "security_audit_events kayitlari incident dosyasina eklenmeli."
  ];
  if (attackType.includes("payment")) {
    return [
      "Iyzico callback loglari provider panelinden dogrulanmali.",
      "Siparis payment_status ve order_status kayitlari manuel kontrol edilmeli.",
      ...common
    ];
  }
  if (attackType.includes("admin")) {
    return [
      "Admin kullanicilarinda MFA ve son oturumlar kontrol edilmeli.",
      "Cloudflare Access policy ve admin IP allowlist gozden gecirilmeli.",
      ...common
    ];
  }
  return common;
}

function manualActionsFor(attackType) {
  const actions = [
    "production kod degisikligi",
    "database migration",
    "secret/API key yenileme",
    "kalici firewall veya Cloudflare WAF kurali",
    "buyuk rollback"
  ];
  if (attackType.includes("payment")) actions.push("odeme sistemini tamamen kapatma");
  return actions;
}

function reportFrom(request, ip, attackType, score, signals) {
  const pathname = routePath(request);
  return {
    id: `inc-${now()}-${Math.random().toString(16).slice(2)}`,
    time: new Date().toISOString(),
    ip,
    host: hostName(request),
    method: request.method,
    endpoint: pathname,
    attackType,
    score,
    signals: signals.map((signal) => signal.reason),
    automaticActions: automaticActionsFor(signals),
    recommendedPermanentFixes: recommendationsFor(attackType),
    manualApprovalRequired: manualActionsFor(attackType),
    requestId: request.id || null
  };
}

async function persistIncident(request, report) {
  await auditEvent({
    request,
    action: "auto_defense.incident",
    resourceType: "endpoint",
    resourceId: report.endpoint,
    severity: report.attackType.includes("critical") ? "critical" : "warning",
    metadata: report
  });
}

function shouldAlert(report) {
  const key = `${report.ip}:${report.attackType}:${report.endpoint}`;
  const lastAlerted = state.alertKeys.get(key) || 0;
  if (now() - lastAlerted < 5 * 60 * 1000) return false;
  state.alertKeys.set(key, now());
  return true;
}

async function maybeRevokeSession(request, signals) {
  if (!config.autoDefense.revokeSuspiciousSessions) return;
  if (!signals.some((signal) => signal.action === "session_revoke")) return;
  const ctx = await authContext(request);
  if (!ctx?.jwt || typeof supabaseAdmin.auth?.admin?.signOut !== "function") return;
  const { error } = await supabaseAdmin.auth.admin.signOut(ctx.jwt);
  if (error) {
    request.log.warn({ error: error.message }, "Suspicious session revoke failed");
  }
}

async function respondToSignals(request, signals, score) {
  if (!signals.length || score < config.autoDefense.scoreThreshold) return;

  const ip = clientIp(request);
  const attackType = signals.some((signal) => signal.type === "payment")
    ? "payment_manipulation_or_callback_abuse"
    : signals.some((signal) => signal.type === "admin")
    ? "unauthorized_admin_or_privileged_access"
    : signals.some((signal) => signal.type === "injection")
    ? "sql_xss_or_payload_abuse"
    : "endpoint_or_rate_abuse";

  if (signals.some((signal) => signal.action === "ip_block")) {
    state.blockedIps.set(ip, now() + minutes(config.autoDefense.ipBlockMinutes));
  }
  if (signals.some((signal) => signal.action === "admin_lock")) {
    state.adminLockedUntil = Math.max(state.adminLockedUntil, now() + minutes(config.autoDefense.adminLockMinutes));
  }
  if (signals.some((signal) => signal.action === "strict_mode")) {
    state.strictModeUntil = Math.max(state.strictModeUntil, now() + minutes(config.autoDefense.strictModeMinutes));
  }

  const report = reportFrom(request, ip, attackType, score, signals);
  pushIncident(report);
  await persistIncident(request, report);
  await maybeRevokeSession(request, signals);
  if (shouldAlert(report)) {
    void sendSecurityAlert(report, request.log);
  }
}

function cloudflareScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

function requestSignals(request, bodyValue = "", options = {}) {
  const countRouteHit = options.countRoute !== false;
  const pathname = routePath(request);
  const ip = clientIp(request);
  const raw = `${request.url || ""} ${normalizePayload(request.query)} ${normalizePayload(bodyValue)}`;
  const signals = [];

  if (config.autoDefense.ipDenylist.includes(ip)) {
    signals.push({ type: "reputation", reason: "configured_ip_denylist", score: 12, action: "ip_block" });
  }

  const cfBotScore = cloudflareScore(request.headers["cf-bot-score"]);
  if (cfBotScore !== null && cfBotScore <= config.autoDefense.cfBotScoreBlockBelow) {
    signals.push({ type: "reputation", reason: `low_cf_bot_score:${cfBotScore}`, score: 8, action: "ip_block" });
  }

  const cfThreatScore = cloudflareScore(request.headers["cf-threat-score"]);
  if (cfThreatScore !== null && cfThreatScore >= config.autoDefense.cfThreatScoreBlockAbove) {
    signals.push({ type: "reputation", reason: `high_cf_threat_score:${cfThreatScore}`, score: 8, action: "ip_block" });
  }

  if (SQLI_PATTERN.test(raw)) {
    signals.push({ type: "injection", reason: "sql_injection_pattern", score: 9, action: "ip_block" });
  }
  if (XSS_PATTERN.test(raw)) {
    signals.push({ type: "injection", reason: "xss_payload_pattern", score: 8, action: "ip_block" });
  }
  if (TRAVERSAL_PATTERN.test(raw)) {
    signals.push({ type: "probe", reason: "path_traversal_pattern", score: 8, action: "ip_block" });
  }
  if (PROBE_PATTERN.test(pathname)) {
    signals.push({ type: "probe", reason: "known_probe_path", score: 8, action: "ip_block" });
  }
  if (ADMIN_PATH_PATTERN.test(pathname) && state.adminLockedUntil > now()) {
    signals.push({ type: "admin", reason: "admin_panel_temporarily_locked", score: 12, action: "ip_block" });
  }
  if (/^\/v1\/payments\b/i.test(pathname) && request.method !== "POST" && !/callback$/i.test(pathname)) {
    signals.push({ type: "payment", reason: "unexpected_payment_method", score: 6, action: "strict_mode" });
  }
  if (SENSITIVE_PATH_PATTERN.test(pathname) && !request.headers.authorization && request.method !== "OPTIONS" && !/callback$/i.test(pathname)) {
    signals.push({ type: "auth", reason: "sensitive_endpoint_without_auth", score: 3, action: "strict_mode" });
  }

  if (countRouteHit) {
    const routeCount = countRoute(ip, pathname);
    const routeLimit = routeLimitFor(pathname, request);
    if (routeCount > routeLimit) {
      signals.push({
        type: SENSITIVE_PATH_PATTERN.test(pathname) ? "privileged_rate" : "rate",
        reason: `route_rate_exceeded:${routeCount}/${routeLimit}`,
        score: SENSITIVE_PATH_PATTERN.test(pathname) ? 8 : 5,
        action: SENSITIVE_PATH_PATTERN.test(pathname) ? "ip_block" : "strict_mode"
      });
    }
  }

  return signals;
}

function failureSignals(request, statusCode) {
  const pathname = routePath(request);
  if (![400, 401, 403, 404, 429].includes(statusCode)) return [];
  const signals = [];
  if (statusCode === 401) signals.push({ type: "auth", reason: "auth_failure", score: 3, action: "strict_mode" });
  if (statusCode === 403) signals.push({ type: "authz", reason: "authorization_failure", score: 4, action: "strict_mode" });
  if (statusCode === 429) signals.push({ type: "rate", reason: "framework_rate_limited", score: 5, action: "strict_mode" });
  if (statusCode === 404 && PROBE_PATTERN.test(pathname)) signals.push({ type: "probe", reason: "probe_404", score: 5, action: "ip_block" });
  if (ADMIN_PATH_PATTERN.test(pathname) && [401, 403, 429].includes(statusCode) && !hasBearerToken(request)) {
    signals.push({ type: "admin", reason: "admin_access_failure", score: 6, action: "admin_lock" });
  }
  if (/^\/v1\/payments\b/i.test(pathname) && [400, 401, 403, 429].includes(statusCode)) {
    signals.push({ type: "payment", reason: "payment_endpoint_failure", score: 6, action: "strict_mode" });
  }
  if (statusCode === 403 && request.headers.authorization) {
    signals.push({ type: "session", reason: "authorized_request_forbidden", score: 6, action: "session_revoke" });
  }
  return signals;
}

async function evaluate(request, signals) {
  if (!config.autoDefense.enabled || !signals.length) return false;
  cleanup();
  const ip = clientIp(request);
  const score = signals.reduce((sum, signal) => sum + signal.score, 0);
  const snapshot = addScore(ip, score, signals);
  await respondToSignals(request, signals, snapshot.score);
  return (state.blockedIps.get(ip) || 0) > now();
}

function blockedError() {
  const error = new Error("İstek geçici olarak sınırlandırıldı.");
  error.statusCode = 429;
  return error;
}

export function autoDefenseStatus() {
  cleanup();
  return {
    enabled: config.autoDefense.enabled,
    strictModeUntil: state.strictModeUntil ? new Date(state.strictModeUntil).toISOString() : null,
    adminLockedUntil: state.adminLockedUntil ? new Date(state.adminLockedUntil).toISOString() : null,
    blockedIpCount: state.blockedIps.size,
    trackedIpCount: state.ipScores.size,
    recentIncidents: state.recentIncidents
  };
}

export function registerAutoDefense(app) {
  app.addHook("onRequest", async (request, reply) => {
    if (!config.autoDefense.enabled) return;
    cleanup();

    const ip = clientIp(request);
    const pathname = routePath(request);
    const blockedUntil = state.blockedIps.get(ip) || 0;
    if (blockedUntil > now() && pathname !== "/health" && !canPassPrivilegedAuthGate(request, pathname)) {
      return reply.code(429).send({
        ok: false,
        error: "AUTO_DEFENSE_BLOCKED",
        message: "İstek geçici olarak sınırlandırıldı."
      });
    }

    const signals = requestSignals(request);
    const blocked = await evaluate(request, signals);
    if (blocked && routePath(request) !== "/health" && !canPassPrivilegedAuthGate(request)) {
      return reply.code(429).send({
        ok: false,
        error: "AUTO_DEFENSE_BLOCKED",
        message: "İstek geçici olarak sınırlandırıldı."
      });
    }
  });

  app.addHook("preValidation", async (request) => {
    if (!config.autoDefense.enabled) return;
    const signals = requestSignals(request, request.body, { countRoute: false });
    const blocked = await evaluate(request, signals);
    if (blocked && routePath(request) !== "/health" && !canPassPrivilegedAuthGate(request)) {
      throw blockedError();
    }
  });

  app.addHook("onResponse", async (request, reply) => {
    if (!config.autoDefense.enabled) return;
    const signals = failureSignals(request, reply.statusCode);
    await evaluate(request, signals);
  });

  app.addHook("onError", async (request, _reply, error) => {
    if (!config.autoDefense.enabled) return;
    const statusCode = error.statusCode || 500;
    const signals = failureSignals(request, statusCode);
    if (statusCode >= 500 && SENSITIVE_PATH_PATTERN.test(routePath(request))) {
      signals.push({ type: "server", reason: "sensitive_endpoint_5xx", score: 4, action: "strict_mode" });
    }
    await evaluate(request, signals);
  });
}
