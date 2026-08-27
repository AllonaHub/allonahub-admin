import test from "node:test";
import assert from "node:assert/strict";

import {
  PaymentProvider,
  ProviderRegistry,
  assertProviderImplementation
} from "../../src/modules/platform/provider-contracts.js";

class IncompletePaymentProvider extends PaymentProvider {}

class TestPaymentProvider extends PaymentProvider {
  authorize() { return { ok: true }; }
  capture() { return { ok: true }; }
  refund() { return { ok: true }; }
  getStatus() { return { status: "ready" }; }
}

test("abstract provider methods cannot be registered as a real integration", () => {
  assert.throws(
    () => assertProviderImplementation("payment", new IncompletePaymentProvider({ providerKey: "fake" })),
    /missing concrete methods/
  );
});

test("registry resolves the lowest-priority matching provider assignment", () => {
  const registry = new ProviderRegistry();
  const provider = registry.register("payment", new TestPaymentProvider({ providerKey: "test_bank" }));
  const resolved = registry.resolve("payment", [
    { provider_type: "payment", provider_key: "missing", module_key: "shop", enabled: true, environment: "production", priority: 10 },
    { provider_type: "payment", provider_key: "test_bank", module_key: "shop", enabled: true, environment: "production", priority: 20 }
  ], { moduleKey: "shop" });

  assert.equal(resolved.provider, provider);
  assert.equal(resolved.assignment.provider_key, "test_bank");
});

test("registry does not resolve disabled or wrong-environment assignments", () => {
  const registry = new ProviderRegistry();
  registry.register("payment", new TestPaymentProvider({ providerKey: "test_bank" }));
  const resolved = registry.resolve("payment", [
    { provider_type: "payment", provider_key: "test_bank", module_key: "shop", enabled: false, environment: "production" },
    { provider_type: "payment", provider_key: "test_bank", module_key: "shop", enabled: true, environment: "sandbox" }
  ], { moduleKey: "shop", environment: "production" });
  assert.equal(resolved, null);
});
