import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const countryMigrationUrl = new URL("../../../supabase/migrations/20260827220000_create_country_engine.sql", import.meta.url);
const commerceMigrationUrl = new URL("../../../supabase/migrations/20260827221000_create_cross_border_trade_foundation.sql", import.meta.url);

async function migrations() {
  return {
    country: await readFile(fileURLToPath(countryMigrationUrl), "utf8"),
    commerce: await readFile(fileURLToPath(commerceMigrationUrl), "utf8")
  };
}

test("country and cross-border migrations are additive and contain no destructive DDL", async () => {
  const sql = Object.values(await migrations()).join("\n");
  assert.doesNotMatch(sql, /\bdrop\s+(table|column|schema)\b/i);
  assert.doesNotMatch(sql, /\btruncate\b/i);
  assert.doesNotMatch(sql, /\bdelete\s+from\b/i);
});

test("country migration defines the control-plane tables", async () => {
  const { country: sql } = await migrations();
  for (const table of [
    "countries",
    "country_modules",
    "country_languages",
    "country_currencies",
    "integration_provider_definitions",
    "country_provider_assignments",
    "user_country_profiles",
    "partner_passports",
    "partner_country_approvals",
    "compliance_rule_sets",
    "country_reward_policies"
  ]) {
    assert.match(sql, new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}`, "i"));
  }
});

test("cross-border migration defines commerce snapshots and provider-neutral records", async () => {
  const { commerce: sql } = await migrations();
  for (const table of [
    "exchange_rate_snapshots",
    "order_currency_snapshots",
    "product_country_availability",
    "trade_requests",
    "trade_offers",
    "shipments",
    "compliance_assessments",
    "integration_api_clients",
    "integration_webhook_endpoints",
    "impact_metric_snapshots"
  ]) {
    assert.match(sql, new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}`, "i"));
  }
});

test("future-country transaction and reward cashout seeds remain closed", async () => {
  const { country: sql } = await migrations();
  assert.match(sql, /'AZ'.*?'PLANNING'/s);
  assert.match(sql, /cross_border_redemption_enabled[\s\S]*?false/i);
  assert.match(sql, /cashout_enabled[\s\S]*?false/i);
});

test("impact metrics are not seeded with illustrative numbers", async () => {
  const { commerce: sql } = await migrations();
  assert.doesNotMatch(sql, /insert\s+into\s+public\.impact_metric_snapshots/i);
});

test("cross-border foundation tolerates legacy schemas without an HP ledger", async () => {
  const { commerce: sql } = await migrations();
  assert.match(sql, /to_regclass\('public\.hp_ledger'\)\s+is\s+not\s+null/i);
  assert.match(sql, /to_regclass\('public\.hp_ledger_country_contexts'\)\s+is\s+not\s+null/i);
});

test("product ownership RLS tolerates legacy text partner identifiers", async () => {
  const { commerce: sql } = await migrations();
  assert.match(sql, /p\.partner_id::text\s*=\s*auth\.uid\(\)::text/i);
});

test("country foundation does not replace the legacy shared updated-at function", async () => {
  const { country: sql } = await migrations();
  assert.doesNotMatch(sql, /create\s+or\s+replace\s+function\s+public\.set_updated_at\s*\(/i);
  assert.match(sql, /public\.set_country_engine_updated_at\s*\(/i);
});

test("identity approvals, legal evidence and financial snapshots have database guards", async () => {
  const { country, commerce } = await migrations();
  assert.match(country, /user_country_profiles_controlled_fields/i);
  assert.match(country, /user_legal_acceptances_validate/i);
  assert.match(country, /legal_document_versions_content_guard/i);
  assert.match(commerce, /order_currency_snapshots_immutable/i);
  assert.match(commerce, /orders_currency_snapshot_guard/i);
  assert.match(commerce, /impact_metric_snapshots_published_guard/i);
});

test("country and module state changes persist configuration evidence atomically", async () => {
  const { country: sql } = await migrations();
  assert.match(sql, /function\s+public\.apply_country_state_change/i);
  assert.match(sql, /function\s+public\.apply_country_module_change/i);
  assert.match(sql, /insert\s+into\s+public\.country_configuration_events/i);
  assert.match(sql, /grant\s+execute[\s\S]*?to\s+service_role/i);
});
