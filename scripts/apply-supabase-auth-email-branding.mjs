#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templatesDir = path.join(rootDir, "supabase", "auth-email-templates");
const apiBaseUrl = "https://api.supabase.com/v1";
const args = new Set(process.argv.slice(2));

function env(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function requireEnv(value, message) {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

function readTemplate(fileName) {
  return fs.readFileSync(path.join(templatesDir, fileName), "utf8").trim();
}

function projectRefFromUrl(value) {
  if (!value) return "";
  try {
    const host = new URL(value).hostname;
    const match = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return match ? match[1] : "";
  } catch {
    return "";
  }
}

function optionalInt(value, name) {
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be a number.`);
  }
  return Number(value);
}

function compact(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined && value !== "")
  );
}

function redacted(object) {
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => [
      key,
      key === "smtp_pass" && value ? "[redacted]" : value
    ])
  );
}

const accessToken = requireEnv(
  env("SUPABASE_ACCESS_TOKEN", "SUPABASE_MANAGEMENT_ACCESS_TOKEN"),
  "Set SUPABASE_ACCESS_TOKEN or SUPABASE_MANAGEMENT_ACCESS_TOKEN before running this script."
);
const projectRef = requireEnv(
  env("SUPABASE_PROJECT_REF", "PROJECT_REF") || projectRefFromUrl(env("SUPABASE_URL")),
  "Set SUPABASE_PROJECT_REF, PROJECT_REF or SUPABASE_URL before running this script."
);
const senderName = env("SUPABASE_AUTH_SENDER_NAME") || "Alloana Hub";
const siteUrl = (env("SUPABASE_AUTH_SITE_URL", "SITE_URL") || "https://allonahub.com").replace(/\/$/, "");
const resetUrl = `${siteUrl}/pages/account/reset-password.html`;
const defaultUriAllowList = [
  siteUrl,
  `${siteUrl}/**`,
  "https://www.allonahub.com",
  "https://www.allonahub.com/**"
].join(",");
const uriAllowList = env("SUPABASE_AUTH_URI_ALLOW_LIST", "SUPABASE_AUTH_REDIRECT_URLS") || defaultUriAllowList;
const smtpAdminEmail = env("SUPABASE_AUTH_SMTP_ADMIN_EMAIL", "SMTP_ADMIN_EMAIL", "MAIL_FROM") || "destek@allonahub.com";
const smtpHost = env("SUPABASE_AUTH_SMTP_HOST", "SMTP_HOST");
const smtpPort = env("SUPABASE_AUTH_SMTP_PORT", "SMTP_PORT") || (smtpHost ? "587" : "");
const smtpUser = env("SUPABASE_AUTH_SMTP_USER", "SMTP_USER");
const smtpPass = env("SUPABASE_AUTH_SMTP_PASS", "SMTP_PASS");
const smtpMaxFrequency = optionalInt(env("SUPABASE_AUTH_SMTP_MAX_FREQUENCY"), "SUPABASE_AUTH_SMTP_MAX_FREQUENCY");

const hasPartialSmtp = Boolean(smtpHost || smtpUser || smtpPass || env("SUPABASE_AUTH_SMTP_PORT", "SMTP_PORT"));
if (hasPartialSmtp && (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpAdminEmail)) {
  throw new Error("Custom SMTP requires SUPABASE_AUTH_SMTP_HOST, SUPABASE_AUTH_SMTP_PORT, SUPABASE_AUTH_SMTP_USER, SUPABASE_AUTH_SMTP_PASS and SUPABASE_AUTH_SMTP_ADMIN_EMAIL.");
}

const payload = compact({
  site_url: siteUrl,
  uri_allow_list: uriAllowList,
  external_email_enabled: true,
  smtp_admin_email: smtpAdminEmail,
  smtp_sender_name: senderName,
  smtp_host: smtpHost,
  smtp_port: smtpPort,
  smtp_user: smtpUser,
  smtp_pass: smtpPass,
  smtp_max_frequency: smtpMaxFrequency,
  mailer_subjects_recovery: `${senderName} şifre yenileme bağlantın`,
  mailer_templates_recovery_content: readTemplate("recovery.html"),
  mailer_notifications_password_changed_enabled: true,
  mailer_subjects_password_changed_notification: `${senderName} şifren güncellendi`,
  mailer_templates_password_changed_notification_content: readTemplate("password-changed.html")
});

if (args.has("--dry-run")) {
  console.log(JSON.stringify(redacted(payload), null, 2));
  if (!hasPartialSmtp) {
    console.warn("Warning: no custom SMTP credentials were provided. Supabase's default SMTP may still show Supabase as the sender.");
  }
  process.exit(0);
}

const response = await fetch(`${apiBaseUrl}/projects/${encodeURIComponent(projectRef)}/config/auth`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(payload)
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(`Supabase auth email branding update failed (${response.status}): ${body}`);
}

const result = await response.json();
console.log("Supabase Auth email branding updated.");
console.log(JSON.stringify({
  project_ref: projectRef,
  site_url: result.site_url,
  smtp_admin_email: result.smtp_admin_email,
  smtp_sender_name: result.smtp_sender_name,
  mailer_subjects_recovery: result.mailer_subjects_recovery,
  mailer_subjects_password_changed_notification: result.mailer_subjects_password_changed_notification,
  reset_redirect: resetUrl
}, null, 2));

if (!hasPartialSmtp) {
  console.warn("Warning: custom SMTP credentials were not provided. Configure SMTP to fully replace the Supabase sender identity.");
}
