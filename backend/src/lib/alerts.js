import { config } from "../config.js";

function truncate(value, max = 3500) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function incidentText(report) {
  const actions = (report.automaticActions || []).join(", ") || "none";
  const manual = (report.manualApprovalRequired || []).join(", ") || "none";
  return [
    "AllonaHub security incident",
    `time: ${report.time}`,
    `type: ${report.attackType}`,
    `endpoint: ${report.endpoint}`,
    `ip: ${report.ip}`,
    `score: ${report.score}`,
    `auto_actions: ${actions}`,
    `manual_required: ${manual}`
  ].join("\n");
}

async function postJson(url, payload, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    return response.ok;
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendSecurityAlert(report, logger) {
  const tasks = [];

  if (config.alerts.telegramBotToken && config.alerts.telegramChatId) {
    const url = `https://api.telegram.org/bot${config.alerts.telegramBotToken}/sendMessage`;
    tasks.push(postJson(url, {
      chat_id: config.alerts.telegramChatId,
      text: truncate(incidentText(report)),
      disable_web_page_preview: true
    }));
  }

  if (config.alerts.emailWebhookUrl) {
    const headers = config.alerts.emailWebhookSecret
      ? { "x-alert-secret": config.alerts.emailWebhookSecret }
      : {};
    tasks.push(postJson(config.alerts.emailWebhookUrl, {
      from: config.alerts.alertFrom,
      to: config.alerts.alertTo,
      subject: `[AllonaHub Security] ${report.attackType}`,
      text: incidentText(report),
      report
    }, headers));
  }

  if (!tasks.length) return;

  const results = await Promise.allSettled(tasks);
  const failed = results.filter((result) => result.status === "rejected" || result.value === false);
  if (failed.length) {
    logger?.warn({ failed: failed.length, attackType: report.attackType }, "Security alert delivery failed");
  }
}
