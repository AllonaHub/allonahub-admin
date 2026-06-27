import crypto from "node:crypto";
import { config } from "../config.js";

const SEVERITY_WEIGHT = { debug: 0, info: 0, low: 0, medium: 1, warning: 2, high: 2, critical: 3 };
const sentAlerts = new Map();

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

export function securityAlertStatus() {
  return {
    enabled: config.alerts.enabled,
    min_severity: normalizeSeverity(config.alerts.minSeverity || "critical"),
    cooldown_ms: Math.max(Number(config.alerts.cooldownMs || 180000), 30000),
    channels: {
      browser_audio: true,
      telegram: Boolean(config.alerts.telegramBotToken && config.alerts.telegramChatId),
      webhook: Boolean(config.alerts.webhookUrl),
      email_webhook: Boolean(config.alerts.emailWebhookUrl && config.alerts.alertTo)
    },
    memory_dedupe_size: sentAlerts.size
  };
}

export async function sendSecurityAlert(event, options = {}) {
  const payload = buildPayload(event, options.channel || "security");
  if (!options.force && !shouldSend(payload)) {
    return { skipped: true, reason: "threshold_or_cooldown", payload, status: securityAlertStatus() };
  }

  const [telegram, webhook, email] = await Promise.all([
    sendTelegram(payload),
    sendGenericWebhook(payload),
    sendEmailWebhook(payload)
  ]);

  return {
    skipped: false,
    payload,
    channels: { telegram, webhook, email },
    status: securityAlertStatus()
  };
}

export function sendSecurityAlertFromAuditEvent(event, request) {
  sendSecurityAlert(event).catch((error) => {
    request?.log?.warn({ error: error.message, action: event.action }, "Security alert dispatch failed");
  });
}
