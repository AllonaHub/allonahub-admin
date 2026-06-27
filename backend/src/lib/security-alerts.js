import crypto from "node:crypto";
import { config } from "../config.js";

const SEVERITY_WEIGHT = { debug: 0, info: 0, low: 0, medium: 1, warning: 2, high: 2, critical: 3 };
const sentAlerts = new Map();
const activeIncident = {
  active: false,
  level: "low",
  redZone: false,
  action: "",
  resourceType: "",
  resourceId: "",
  ipAddress: "",
  message: "",
  startedAt: null,
  acknowledgedAt: null,
  acknowledgedBy: null,
  silencedUntil: null,
  resolvedAt: null,
  resolvedBy: null,
  metadata: {}
};
const runtimeProtection = {
  apiLocked: false,
  paymentsLocked: false,
  ordersLocked: false,
  maintenanceSuggested: false,
  sessionRevokeSuggested: false,
  rollbackSuggested: false,
  denylistedIps: new Map(),
  activatedAt: null,
  activatedBy: "auto",
  reason: ""
};

function normalizeSeverity(value) {
  const severity = String(value || "info").toLowerCase();
  if (severity === "warning") return "high";
  if (["low", "medium", "high", "critical"].includes(severity)) return severity;
  return SEVERITY_WEIGHT[severity] >= 2 ? "high" : "low";
}

function severityAllowed(severity) {
  const min = normalizeSeverity(config.alerts.minSeverity || "critical");
  const normalized = normalizeSeverity(severity);
  return (SEVERITY_WEIGHT[normalized] || 0) >= (SEVERITY_WEIGHT[min] || 3);
}

function isRedZoneEvent(event) {
  const raw = [
    event.severity,
    event.action,
    event.resourceType,
    event.resourceId,
    event.actorRole,
    event.ipAddress,
    JSON.stringify(event.metadata || {})
  ].join(" ").toLowerCase();
  return normalizeSeverity(event.severity) === "critical" && (
    /super_admin|owner|admin\.boundary_denied|authz\.denied|permission|role|mfa/.test(raw) ||
    /payment|finance|payout|iyzico|checkout|refund|wallet/.test(raw) ||
    /secret|webhook|token|service_role|api_key|gitops|release/.test(raw) ||
    /attack|blocked|suspicious|sql|xss|csrf|intrusion/.test(raw)
  );
}

function alertFingerprint(event) {
  return crypto
    .createHash("sha256")
    .update([
      event.severity || "",
      event.action || "",
      event.resourceType || "",
      event.resourceId || "",
      event.ipAddress || "",
      JSON.stringify(event.metadata || {}).slice(0, 400)
    ].join("|"))
    .digest("hex");
}

function cleanOldFingerprints(now) {
  const ttl = Math.max(Number(config.alerts.cooldownMs || 180000), 30000);
  for (const [key, timestamp] of sentAlerts.entries()) {
    if (now - timestamp > ttl * 3) sentAlerts.delete(key);
  }
}

function shouldSend(event) {
  if (!config.alerts.enabled) return false;
  if (!severityAllowed(event.severity)) return false;
  if (!isRedZoneEvent(event) && event.channel !== "manual_test") return false;
  const now = Date.now();
  cleanOldFingerprints(now);
  const fingerprint = alertFingerprint(event);
  const previous = sentAlerts.get(fingerprint);
  if (previous && now - previous < Math.max(Number(config.alerts.cooldownMs || 180000), 30000)) {
    return false;
  }
  sentAlerts.set(fingerprint, now);
  return true;
}

function incidentPayload() {
  return {
    ...activeIncident,
    protection: runtimeProtectionStatus()
  };
}

function activateRuntimeProtection(event, payload) {
  if (!isRedZoneEvent(event)) return;
  const raw = `${event.action || ""} ${event.resourceType || ""} ${JSON.stringify(event.metadata || {})}`.toLowerCase();
  runtimeProtection.activatedAt = runtimeProtection.activatedAt || new Date().toISOString();
  runtimeProtection.activatedBy = "auto_red_zone";
  runtimeProtection.reason = payload.title || "Red zone security incident";

  if (/payment|finance|payout|iyzico|checkout|refund|wallet/.test(raw)) {
    runtimeProtection.paymentsLocked = true;
  }
  if (/order|checkout|cart/.test(raw)) {
    runtimeProtection.ordersLocked = true;
  }
  if (/super_admin|owner|admin\.boundary_denied|authz\.denied|secret|service_role|api_key|webhook|gitops|release|attack|intrusion/.test(raw)) {
    runtimeProtection.apiLocked = true;
    runtimeProtection.sessionRevokeSuggested = true;
    runtimeProtection.maintenanceSuggested = true;
    runtimeProtection.rollbackSuggested = /release|gitops|deploy|webhook/.test(raw);
  }
  if (event.ipAddress) {
    runtimeProtection.denylistedIps.set(event.ipAddress, {
      ip: event.ipAddress,
      reason: event.action || "red_zone_incident",
      created_at: new Date().toISOString()
    });
  }
}

function activateIncident(event, payload) {
  const redZone = isRedZoneEvent(event);
  const level = redZone ? "critical" : normalizeSeverity(event.severity);
  activeIncident.active = true;
  activeIncident.level = level;
  activeIncident.redZone = redZone;
  activeIncident.action = event.action || "";
  activeIncident.resourceType = event.resourceType || "";
  activeIncident.resourceId = event.resourceId || "";
  activeIncident.ipAddress = event.ipAddress || "";
  activeIncident.message = payload.title || "Security alarm";
  activeIncident.startedAt = activeIncident.startedAt || new Date().toISOString();
  activeIncident.resolvedAt = null;
  activeIncident.resolvedBy = null;
  activeIncident.metadata = publicMetadata(event.metadata);
  activateRuntimeProtection(event, payload);
}

function publicMetadata(metadata) {
  const safe = { ...(metadata || {}) };
  ["password", "token", "secret", "authorization", "cookie", "api_key", "service_role"].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(safe, key)) safe[key] = "[redacted]";
  });
  return safe;
}

function buildPayload(event, channel = "security") {
  const severity = normalizeSeverity(event.severity);
  return {
    ok: true,
    channel,
    severity,
    title: severity === "critical" ? "AllonaHub Kritik Güvenlik Alarmı" : "AllonaHub Güvenlik Uyarısı",
    action: event.action,
    resource_type: event.resourceType || null,
    resource_id: event.resourceId || null,
    actor_role: event.actorRole || null,
    actor_id: event.actorId || null,
    ip_address: event.ipAddress || null,
    source: event.source || "backend",
    purpose: event.purpose || "security_audit",
    metadata: publicMetadata(event.metadata),
    created_at: new Date().toISOString(),
    site: config.siteUrl,
    api: config.apiUrl
  };
}

function telegramText(payload) {
  const lines = [
    payload.severity === "critical" ? "🚨 AllonaHub KRİTİK ALARM" : "⚠️ AllonaHub Güvenlik Uyarısı",
    `Seviye: ${payload.severity}`,
    `İşlem: ${payload.action || "-"}`,
    `Kaynak: ${payload.resource_type || "-"} ${payload.resource_id || ""}`.trim(),
    `Rol: ${payload.actor_role || "-"}`,
    `IP: ${payload.ip_address || "-"}`,
    `Zaman: ${payload.created_at}`
  ];
  return lines.join("\n").slice(0, 3900);
}

async function postJson(url, body, headers = {}, timeoutMs = 8000) {
  if (!url) return { configured: false, sent: false };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      signal: controller.signal,
      body: JSON.stringify(body)
    });
    const text = await response.text().catch(() => "");
    return {
      configured: true,
      sent: response.ok,
      status: response.status,
      body: text.slice(0, 800)
    };
  } catch (error) {
    return {
      configured: true,
      sent: false,
      error: error.name === "AbortError" ? "timeout" : error.message
    };
  } finally {
    clearTimeout(timeout);
  }
}

function webhookHeaders(payload, secret) {
  if (!secret) return {};
  const raw = JSON.stringify(payload);
  return {
    "X-Allona-Alert-Signature": crypto.createHmac("sha256", secret).update(raw).digest("hex")
  };
}

async function sendTelegram(payload) {
  if (!config.alerts.telegramBotToken || !config.alerts.telegramChatId) {
    return { configured: false, sent: false };
  }
  return postJson(
    `https://api.telegram.org/bot${encodeURIComponent(config.alerts.telegramBotToken)}/sendMessage`,
    {
      chat_id: config.alerts.telegramChatId,
      text: telegramText(payload),
      disable_web_page_preview: true
    }
  );
}

async function sendGenericWebhook(payload) {
  return postJson(
    config.alerts.webhookUrl,
    payload,
    webhookHeaders(payload, config.alerts.webhookSecret)
  );
}

async function sendEmailWebhook(payload) {
  if (!config.alerts.emailWebhookUrl) return { configured: false, sent: false };
  return postJson(
    config.alerts.emailWebhookUrl,
    {
      ...payload,
      from: config.alerts.alertFrom,
      to: config.alerts.alertTo,
      subject: `${payload.title}: ${payload.action || "security"}`
    },
    webhookHeaders(payload, config.alerts.emailWebhookSecret)
  );
}

async function sendSms(payload) {
  if (
    config.alerts.smsProvider !== "twilio" ||
    !config.alerts.smsAccountSid ||
    !config.alerts.smsAuthToken ||
    !config.alerts.smsFrom ||
    !config.alerts.smsTo
  ) {
    return { configured: false, sent: false };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const body = new URLSearchParams({
      From: config.alerts.smsFrom,
      To: config.alerts.smsTo,
      Body: `${payload.title}: ${payload.action || "security"} / ${payload.ip_address || "-"}`
    });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.alerts.smsAccountSid)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.alerts.smsAccountSid}:${config.alerts.smsAuthToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      signal: controller.signal,
      body
    });
    const text = await response.text().catch(() => "");
    return {
      configured: true,
      sent: response.ok,
      status: response.status,
      body: text.slice(0, 800)
    };
  } catch (error) {
    return {
      configured: true,
      sent: false,
      error: error.name === "AbortError" ? "timeout" : error.message
    };
  } finally {
    clearTimeout(timeout);
  }
}

function smsConfigured() {
  return Boolean(
    config.alerts.smsProvider === "twilio" &&
    config.alerts.smsAccountSid &&
    config.alerts.smsAuthToken &&
    config.alerts.smsFrom &&
    config.alerts.smsTo
  );
}

export function securityAlertStatus() {
  return {
    enabled: config.alerts.enabled,
    min_severity: normalizeSeverity(config.alerts.minSeverity || "critical"),
    cooldown_ms: Math.max(Number(config.alerts.cooldownMs || 180000), 30000),
    channels: {
      browser_audio: true,
      telegram: Boolean(config.alerts.telegramBotToken && config.alerts.telegramChatId),
      webhook: Boolean(config.alerts.webhookUrl),
      email_webhook: Boolean(config.alerts.emailWebhookUrl && config.alerts.alertTo),
      sms: smsConfigured()
    },
    memory_dedupe_size: sentAlerts.size,
    incident: incidentPayload()
  };
}

export async function sendSecurityAlert(event, options = {}) {
  const payload = buildPayload(event, options.channel || "security");
  const alertEvent = { ...event, channel: options.channel };
  if (options.force || isRedZoneEvent(alertEvent)) {
    activateIncident(alertEvent, payload);
  }
  if (!options.force && !shouldSend(alertEvent)) {
    return { skipped: true, reason: "threshold_or_cooldown", payload, status: securityAlertStatus() };
  }

  const [telegram, webhook, email, sms] = await Promise.all([
    sendTelegram(payload),
    sendGenericWebhook(payload),
    sendEmailWebhook(payload),
    sendSms(payload)
  ]);

  return {
    skipped: false,
    payload,
    channels: { telegram, webhook, email, sms },
    status: securityAlertStatus()
  };
}

export function sendSecurityAlertFromAuditEvent(event, request) {
  sendSecurityAlert(event).catch((error) => {
    request?.log?.warn({ error: error.message, action: event.action }, "Security alert dispatch failed");
  });
}

export function runtimeSecurityProtection() {
  return runtimeProtection;
}

export function runtimeProtectionStatus() {
  return {
    api_locked: runtimeProtection.apiLocked,
    payments_locked: runtimeProtection.paymentsLocked,
    orders_locked: runtimeProtection.ordersLocked,
    maintenance_suggested: runtimeProtection.maintenanceSuggested,
    session_revoke_suggested: runtimeProtection.sessionRevokeSuggested,
    rollback_suggested: runtimeProtection.rollbackSuggested,
    denylisted_ips: Array.from(runtimeProtection.denylistedIps.values()),
    activated_at: runtimeProtection.activatedAt,
    activated_by: runtimeProtection.activatedBy,
    reason: runtimeProtection.reason
  };
}

export function acknowledgeSecurityAlarm({ actorId = null, reason = "" } = {}) {
  activeIncident.acknowledgedAt = new Date().toISOString();
  activeIncident.acknowledgedBy = actorId;
  activeIncident.silencedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  activeIncident.metadata = {
    ...(activeIncident.metadata || {}),
    last_ack_reason: reason
  };
  return incidentPayload();
}

export function resolveSecurityAlarm({ actorId = null, reason = "" } = {}) {
  activeIncident.active = false;
  activeIncident.level = "low";
  activeIncident.redZone = false;
  activeIncident.resolvedAt = new Date().toISOString();
  activeIncident.resolvedBy = actorId;
  activeIncident.message = "Alarm kapatıldı";
  activeIncident.metadata = {
    ...(activeIncident.metadata || {}),
    last_resolve_reason: reason
  };
  return incidentPayload();
}

export function updateRuntimeProtection(action, actorId, reason = "") {
  if (action === "clear") {
    runtimeProtection.apiLocked = false;
    runtimeProtection.paymentsLocked = false;
    runtimeProtection.ordersLocked = false;
    runtimeProtection.maintenanceSuggested = false;
    runtimeProtection.sessionRevokeSuggested = false;
    runtimeProtection.rollbackSuggested = false;
    runtimeProtection.denylistedIps.clear();
    runtimeProtection.activatedAt = null;
    runtimeProtection.activatedBy = actorId || "owner";
    runtimeProtection.reason = reason || "manual_clear";
  }
  if (action === "lock_api") runtimeProtection.apiLocked = true;
  if (action === "lock_payments") runtimeProtection.paymentsLocked = true;
  if (action === "lock_orders") runtimeProtection.ordersLocked = true;
  if (action === "unlock_api") runtimeProtection.apiLocked = false;
  if (action === "unlock_payments") runtimeProtection.paymentsLocked = false;
  if (action === "unlock_orders") runtimeProtection.ordersLocked = false;
  if (action !== "clear") {
    runtimeProtection.activatedAt = runtimeProtection.activatedAt || new Date().toISOString();
    runtimeProtection.activatedBy = actorId || "owner";
    runtimeProtection.reason = reason || action;
  }
  return runtimeProtectionStatus();
}
