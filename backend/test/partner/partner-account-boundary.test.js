import test from "node:test";
import assert from "node:assert/strict";
import { assertActivePartnerBusiness } from "../../src/lib/partner-account-boundary.js";

test("partner panel accepts an existing active business", () => {
  const active = { id: "partner-business", status: "active" };
  assert.equal(assertActivePartnerBusiness(active), active);
});

test("partner panel rejects missing, pending, and suspended businesses", () => {
  assert.throws(() => assertActivePartnerBusiness(null), (error) => error.statusCode === 403);
  assert.throws(() => assertActivePartnerBusiness({ id: "pending-business", status: "review" }), (error) => error.statusCode === 403);
  assert.throws(() => assertActivePartnerBusiness({ id: "suspended-business", status: "suspended" }), (error) => error.statusCode === 403);
});
