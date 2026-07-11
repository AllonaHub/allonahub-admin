#!/usr/bin/env node

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith("--")) continue;
  const key = arg.slice(2);
  const next = process.argv[index + 1];
  if (!next || next.startsWith("--")) {
    args.set(key, "true");
  } else {
    args.set(key, next);
    index += 1;
  }
}

const apiUrl = String(args.get("api") || process.env.API_URL || "https://api.allonahub.com").replace(/\/$/, "");
const token = args.get("token") || process.env.PARTNER_JWT || "";
const feedUrl = args.get("feed") || process.env.PARTNER_INTEGRATION_FEED_URL || "";
const runApply = args.get("apply") === "true" || process.env.PARTNER_INTEGRATION_SMOKE_APPLY === "true";

if (!token || !feedUrl) {
  console.error("Usage: PARTNER_JWT=... PARTNER_INTEGRATION_FEED_URL=https://... node scripts/partner-integration-smoke-test.mjs");
  console.error("Optional: API_URL=https://api.allonahub.com PARTNER_INTEGRATION_SMOKE_APPLY=true");
  process.exit(1);
}

async function api(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  if (!response.ok) {
    const message = payload.message || payload.error || text || `HTTP ${response.status}`;
    throw new Error(`${path} failed: ${message}`);
  }
  return payload;
}

const list = await api("/v1/partner/integrations");
console.log("connectors:", (list.connectors || []).map((item) => `${item.provider}:${item.active_now ? "open" : "locked"}`).join(", "));

const created = await api("/v1/partner/integrations", {
  method: "POST",
  body: JSON.stringify({
    provider: "generic_feed",
    display_name: `Smoke Feed ${new Date().toISOString()}`,
    status: "draft",
    sync_mode: "manual",
    default_publish_status: "draft",
    import_enabled: true,
    export_enabled: false,
    settings: {
      module_key: "shop",
      default_category: "Smoke Test"
    },
    secrets: {
      FEED_URL: feedUrl
    }
  })
});

const integrationId = created.integration.id;
console.log("integration:", integrationId);

const test = await api(`/v1/partner/integrations/${integrationId}/test`, {
  method: "POST",
  body: JSON.stringify({ probe_remote: true })
});
console.log("test:", test.result.status, "rows:", test.result.remote_probe?.rows_read || 0);

const preview = await api(`/v1/partner/integrations/${integrationId}/sync`, {
  method: "POST",
  body: JSON.stringify({ mode: "preview", direction: "inbound", limit: 5 })
});
console.log("preview:", preview.run.status, "checked:", preview.run.checked_count, "warnings:", preview.run.warning_count || 0);

if (runApply) {
  const apply = await api(`/v1/partner/integrations/${integrationId}/sync`, {
    method: "POST",
    body: JSON.stringify({
      mode: "apply",
      direction: "inbound",
      limit: 5,
      confirm_apply: "KATALOGA_AKTAR",
      approval_note: "Smoke test controlled apply"
    })
  });
  console.log("apply:", apply.run.status, "created:", apply.run.created_count, "updated:", apply.run.updated_count);
}
