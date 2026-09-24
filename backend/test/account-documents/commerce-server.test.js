import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import assert from "node:assert/strict";
import test from "node:test";

const couponSource = readFileSync(new URL("../../../js/coupon-page.js", import.meta.url), "utf8");
const checkoutSource = readFileSync(new URL("../../../js/odeme-page.js", import.meta.url), "utf8");
const cartSource = readFileSync(new URL("../../../js/cart.js", import.meta.url), "utf8");

test("coupon failure does not create a browser-only entitlement", async () => {
  const handlers = {};
  const store = new Map();
  const status = { innerHTML: "" };
  const wallet = { innerHTML: "" };
  const document = {
    addEventListener: (name, callback) => { handlers[name] = callback; },
    querySelector: (selector) => ({ "[data-coupon-status]": status, "[data-coupon-wallet]": wallet })[selector] || null,
    querySelectorAll: () => []
  };
  const db = { from: () => ({
    insert: async () => ({ error: new Error("offline") }),
    select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) })
  }) };
  const window = {
    Allona: {
      core: { escapeHTML: (value) => value, toast() {} },
      auth: { getUser: async () => ({ id: "account-1" }) },
      db: { client: () => db }
    },
    AllonaProfileSync: { createClient: () => ({}), load: async () => ({ profile: {} }) }
  };
  runInNewContext(couponSource, {
    window, document, localStorage: {
      getItem: (key) => store.get(key) || null,
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.delete(key)
    },
    console: { warn() {} }, Date, Math, Number, String, Array, Set, Map, JSON, Promise
  });
  await handlers.DOMContentLoaded();
  handlers.click({
    preventDefault() {},
    target: { closest: (selector) => selector === "[data-coupon-action]"
      ? { dataset: { couponCode: "WELCOME10", couponAction: "claim" } } : null }
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(status.innerHTML, /sunucuya kaydedilemedi/);
  assert.equal(store.has("allonahub_user_coupons_v1"), false);
});

test("authenticated commerce cannot fall back to browser-only cart or coupons", () => {
  assert.doesNotMatch(cartSource, /backendMissing\(error\)\) return hydrateLocal/);
  assert.doesNotMatch(cartSource, /backendMissing\(error\)\) throw error;\s*addLocal/);
  assert.doesNotMatch(checkoutSource, /Local wallet fallback follows/);
  assert.match(checkoutSource, /if \(!App\.db\?\.client\) throw new Error\("Kupon sunucusuna bağlanılamadı/);
});
