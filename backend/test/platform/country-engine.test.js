import test from "node:test";
import assert from "node:assert/strict";

import { CountryEngine } from "../../src/modules/platform/country-engine.js";

function country(overrides = {}) {
  return {
    id: "country-tr",
    country_code: "TR",
    country_name: "Türkiye",
    native_name: "Türkiye",
    currency_code: "TRY",
    currency_symbol: "₺",
    default_language: "tr",
    timezone: "Europe/Istanbul",
    phone_prefix: "+90",
    status: "active",
    launch_stage: "PUBLIC",
    updated_at: "2026-08-27T12:00:00.000Z",
    ...overrides
  };
}

function moduleConfig(overrides = {}) {
  return {
    id: "module-shop",
    module_key: "shop",
    enabled: true,
    beta: false,
    public_visible: true,
    partner_registration_enabled: true,
    transaction_enabled: true,
    updated_at: "2026-08-27T12:00:00.000Z",
    ...overrides
  };
}

function repository(context = {}) {
  return {
    async listCountries() {
      return context.countries || [];
    },
    async getCountryContext() {
      return context.countryContext || null;
    }
  };
}

test("public country list excludes disabled countries and private configuration", async () => {
  const engine = new CountryEngine(repository({
    countries: [
      country({ tax_configuration: { secret: true } }),
      country({ id: "country-az", country_code: "AZ", status: "coming_soon", launch_stage: "PLANNING" }),
      country({ id: "country-kz", country_code: "KZ", status: "disabled", launch_stage: "DISABLED" })
    ]
  }));

  const result = await engine.listPublicCountries();
  assert.deepEqual(result.map((item) => item.countryCode), ["TR", "AZ"]);
  assert.equal("taxConfiguration" in result[0], false);
  assert.equal("tax_configuration" in result[0], false);
});

test("public context returns only visible modules, enabled languages and display currencies", async () => {
  const engine = new CountryEngine(repository({
    countryContext: {
      country: country(),
      modules: [moduleConfig(), moduleConfig({ id: "private", module_key: "b2b", public_visible: false })],
      languages: [
        { language_code: "tr", native_label: "Türkçe", enabled: true, public_visible: true, is_default: true },
        { language_code: "en", native_label: "English", enabled: true, public_visible: false, is_default: false }
      ],
      currencies: [
        { currency_code: "TRY", currency_symbol: "₺", display_enabled: true, is_default: true, transaction_enabled: true, settlement_enabled: true },
        { currency_code: "USD", currency_symbol: "$", display_enabled: false, is_default: false, transaction_enabled: false, settlement_enabled: false }
      ],
      rewardPolicy: {
        policy_status: "active",
        transfer_eligible: false,
        cross_border_redemption_enabled: false,
        cashout_enabled: false
      }
    }
  }));

  const result = await engine.getPublicContext("tr");
  assert.deepEqual(result.modules.map((item) => item.moduleKey), ["shop"]);
  assert.deepEqual(result.languages.map((item) => item.code), ["tr"]);
  assert.deepEqual(result.currencies.map((item) => item.code), ["TRY"]);
  assert.equal(result.rewards.cashoutEnabled, false);
});

test("country launch cannot skip controlled stages", () => {
  const engine = new CountryEngine(repository());
  assert.throws(
    () => engine.validateCountryPatch(
      country({ status: "coming_soon", launch_stage: "PLANNING" }),
      { status: "active", launch_stage: "PUBLIC" },
      "CAB-2030-1"
    ),
    (error) => error.code === "COUNTRY_STAGE_TRANSITION_BLOCKED"
  );
});

test("beta or public exposure requires an approval reference", () => {
  const engine = new CountryEngine(repository());
  assert.throws(
    () => engine.validateCountryPatch(
      country({ status: "coming_soon", launch_stage: "INTERNAL_TEST" }),
      { status: "active", launch_stage: "BETA" },
      ""
    ),
    (error) => error.code === "APPROVAL_REFERENCE_REQUIRED"
  );
});

test("transactions require a production-ready payment route", () => {
  const engine = new CountryEngine(repository());
  const current = moduleConfig({ transaction_enabled: false });
  const context = { country: country(), providers: [] };
  assert.throws(
    () => engine.validateModulePatch(context, current, { transaction_enabled: true }, "CAB-2030-2"),
    (error) => error.code === "PAYMENT_PROVIDER_NOT_READY"
  );
});

test("planning countries cannot expose modules publicly", () => {
  const engine = new CountryEngine(repository());
  const current = moduleConfig({ enabled: true, public_visible: false, transaction_enabled: false });
  const context = { country: country({ status: "coming_soon", launch_stage: "PLANNING" }), providers: [] };
  assert.throws(
    () => engine.validateModulePatch(context, current, { public_visible: true }, "CAB-2030-3"),
    (error) => error.code === "COUNTRY_NOT_PUBLIC_READY"
  );
});

test("planning countries cannot mark a module as beta", () => {
  const engine = new CountryEngine(repository());
  const current = moduleConfig({ beta: false, public_visible: false, transaction_enabled: false });
  const context = { country: country({ status: "coming_soon", launch_stage: "PLANNING" }), providers: [] };
  assert.throws(
    () => engine.validateModulePatch(context, current, { beta: true }, "CAB-2030-3B"),
    (error) => error.code === "COUNTRY_NOT_BETA_READY"
  );
});

test("a production-ready payment assignment permits controlled transaction activation", () => {
  const engine = new CountryEngine(repository());
  const current = moduleConfig({ transaction_enabled: false });
  const context = {
    country: country(),
    providers: [{
      provider_type: "payment",
      provider_key: "bank_transfer",
      module_key: "shop",
      enabled: true,
      environment: "production",
      integration_provider_definitions: { implementation_status: "production_ready" }
    }]
  };
  const result = engine.validateModulePatch(context, current, { transaction_enabled: true }, "CAB-2030-4");
  assert.equal(result.transaction_enabled, true);
});
