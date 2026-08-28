import test from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role-key";
process.env.SUPABASE_ANON_KEY ||= "test-anon-key";

const { CountryRepository } = await import("../../src/modules/platform/repository.js");

test("country state mutation uses the atomic audit RPC", async () => {
  const calls = [];
  const client = {
    async rpc(name, payload) {
      calls.push({ name, payload });
      return { data: { id: "country-tr", status: "active", launch_stage: "PUBLIC" }, error: null };
    }
  };
  const repository = new CountryRepository(client);
  const updated = await repository.applyCountryStateChange({
    country: { id: "country-tr" },
    patch: { status: "active", launch_stage: "PUBLIC" },
    expectedUpdatedAt: "2026-08-27T12:00:00.000Z",
    actorId: "actor-1",
    reason: "Approved staging parity",
    approvalReference: "CAB-2030-5",
    requestId: "request-1"
  });

  assert.equal(updated.id, "country-tr");
  assert.equal(calls[0].name, "apply_country_state_change");
  assert.equal(calls[0].payload.p_expected_updated_at, "2026-08-27T12:00:00.000Z");
  assert.equal(calls[0].payload.p_approval_reference, "CAB-2030-5");
});

test("module mutation passes every capability to one atomic RPC", async () => {
  const calls = [];
  const client = {
    async rpc(name, payload) {
      calls.push({ name, payload });
      return { data: [{ id: "module-shop", transaction_enabled: false }], error: null };
    }
  };
  const repository = new CountryRepository(client);
  const updated = await repository.applyModuleChange({
    module: { id: "module-shop" },
    patch: {
      enabled: true,
      beta: false,
      public_visible: true,
      partner_registration_enabled: true,
      transaction_enabled: false
    },
    expectedUpdatedAt: "2026-08-27T12:00:00.000Z",
    actorId: "actor-1",
    reason: "Approved visibility change",
    approvalReference: "CAB-2030-6",
    requestId: "request-2",
    activationRaised: true
  });

  assert.equal(updated.id, "module-shop");
  assert.equal(calls[0].name, "apply_country_module_change");
  assert.equal(calls[0].payload.p_transaction_enabled, false);
  assert.equal(calls[0].payload.p_activation_raised, true);
});

test("atomic RPC concurrency conflict remains a 409 domain error", async () => {
  const client = {
    async rpc() {
      return { data: null, error: { message: "COUNTRY_MODULE_UPDATE_CONFLICT" } };
    }
  };
  const repository = new CountryRepository(client);
  await assert.rejects(
    repository.applyModuleChange({
      module: { id: "module-shop" },
      patch: {
        enabled: true,
        beta: false,
        public_visible: true,
        partner_registration_enabled: false,
        transaction_enabled: false
      },
      expectedUpdatedAt: "2026-08-27T12:00:00.000Z",
      actorId: "actor-1",
      reason: "Concurrent update check",
      approvalReference: "CAB-2030-7",
      requestId: "request-3",
      activationRaised: false
    }),
    (error) => error.code === "COUNTRY_MODULE_UPDATE_CONFLICT" && error.statusCode === 409
  );
});

function countBuilder(value, calls, table) {
  const filters = [];
  const builder = {
    eq(column, filterValue) {
      filters.push(["eq", column, filterValue]);
      return builder;
    },
    or(filterValue) {
      filters.push(["or", filterValue]);
      return builder;
    },
    gte(column, filterValue) {
      filters.push(["gte", column, filterValue]);
      return builder;
    },
    then(resolve) {
      calls.push({ table, filters });
      resolve({ count: value, error: null });
    }
  };
  return builder;
}

function rowsBuilder(data, calls, table) {
  const filters = [];
  const builder = {
    eq(column, filterValue) {
      filters.push(["eq", column, filterValue]);
      return builder;
    },
    gte(column, filterValue) {
      filters.push(["gte", column, filterValue]);
      return builder;
    },
    range(from, to) {
      filters.push(["range", from, to]);
      return builder;
    },
    then(resolve) {
      calls.push({ table, filters });
      resolve({ data, error: null });
    }
  };
  return builder;
}

test("live public impact computes only aggregate metrics from canonical tables", async () => {
  const calls = [];
  const profileCounts = [12, 3];
  const client = {
    from(table) {
      return {
        select(columns, options = {}) {
          if (options.head) {
            const count = table === "profiles" ? profileCounts.shift() : 4;
            return countBuilder(count, calls, table);
          }
          assert.equal(table, "hp_ledger");
          assert.equal(columns, "amount");
          return rowsBuilder([{ amount: 20 }, { amount: -5 }, { amount: 30 }], calls, table);
        }
      };
    }
  };
  const repository = new CountryRepository(client);
  const result = await repository.listLivePublicImpact();

  assert.deepEqual(result.metrics.map((item) => item.metric_key), [
    "active_user_count",
    "active_partner_count",
    "new_user_count",
    "hp_points_issued"
  ]);
  assert.equal(result.metrics.find((item) => item.metric_key === "active_user_count").numeric_value, 12);
  assert.equal(result.metrics.find((item) => item.metric_key === "active_partner_count").numeric_value, 4);
  assert.equal(result.metrics.find((item) => item.metric_key === "new_user_count").numeric_value, 3);
  assert.equal(result.metrics.find((item) => item.metric_key === "hp_points_issued").numeric_value, 50);
  assert.ok(result.sourceNotes.some((note) => note.includes("crew_count")));
  assert.ok(calls.some((call) => (
    call.table === "partner_businesses"
    && call.filters.some((filter) => filter[0] === "eq" && filter[1] === "status" && filter[2] === "active")
    && call.filters.some((filter) => filter[0] === "eq" && filter[1] === "verification_status" && filter[2] === "verified")
  )));
  assert.equal(calls.filter((call) => call.table === "profiles").length, 2);
});
