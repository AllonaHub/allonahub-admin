import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "production";
process.env.LOG_LEVEL = "silent";
process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ||= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role-key";
process.env.TURNSTILE_SECRET_KEY = "";
process.env.COMPANY_LOOKUP_TR_PROVIDER = "generic";
process.env.COMPANY_LOOKUP_GB_API_KEY = "";

const { config } = await import("../../src/config.js");
const { resolvePartnerPasswordResetEligibility } = await import("../../src/routes/index.js");

function queryResult(data = null, error = null) {
  return { data, error };
}

function fakeSupabaseAdmin({ users = [], profile = null, profileError = null, partnerBusiness = null, legacyPartner = null } = {}) {
  return {
    auth: {
      admin: {
        async listUsers() {
          return { data: { users }, error: null };
        }
      }
    },
    from(table) {
      return {
        table,
        filters: [],
        select() {
          return this;
        },
        eq(key, value) {
          this.filters.push([key, value]);
          return this;
        },
        limit() {
          return this;
        },
        async maybeSingle() {
          if (table === "profiles") return queryResult(profile, profileError);
          if (table === "partner_businesses") {
            const ownerFilter = this.filters.find(([key]) => key === "owner_id");
            const activeFilter = this.filters.find(([key]) => key === "status");
            const matchesOwner = !partnerBusiness || !ownerFilter || partnerBusiness.owner_id === ownerFilter[1];
            const matchesStatus = !partnerBusiness || !activeFilter || partnerBusiness.status === activeFilter[1];
            return queryResult(matchesOwner && matchesStatus ? partnerBusiness : null);
          }
          if (table === "partners") return queryResult(legacyPartner);
          return queryResult(null);
        }
      };
    }
  };
}

test("partner password reset eligibility allows active partner businesses only", async () => {
  const user = { id: "user-partner", email: "partner@example.com" };
  const result = await resolvePartnerPasswordResetEligibility({
    email: user.email,
    adminClient: fakeSupabaseAdmin({
      users: [user],
      profile: { role: "partner" },
      partnerBusiness: { id: "partner-business", owner_id: user.id, status: "active" }
    })
  });

  assert.equal(result.eligible, true);
  assert.equal(result.partner_source, "partner_businesses");
});

test("partner password reset eligibility blocks non-partner customer accounts", async () => {
  const user = { id: "user-customer", email: "customer@example.com" };
  const result = await resolvePartnerPasswordResetEligibility({
    email: user.email,
    adminClient: fakeSupabaseAdmin({
      users: [user],
      profile: { role: "customer" }
    })
  });

  assert.equal(result.eligible, false);
  assert.equal(result.reason, "active_partner_not_found");
});

test("partner password reset eligibility blocks privileged roles even with partner rows", async () => {
  const user = { id: "user-admin", email: "admin@example.com" };
  const result = await resolvePartnerPasswordResetEligibility({
    email: user.email,
    adminClient: fakeSupabaseAdmin({
      users: [user],
      profile: { role: "super_admin" },
      partnerBusiness: { id: "admin-partner-business", owner_id: user.id, status: "active" }
    })
  });

  assert.equal(result.eligible, false);
  assert.equal(result.reason, "privileged_role");
});

test("partner password reset eligibility blocks privileged auth metadata roles", async () => {
  const user = {
    id: "user-admin-metadata",
    email: "admin-metadata@example.com",
    app_metadata: { role: "admin" }
  };
  const result = await resolvePartnerPasswordResetEligibility({
    email: user.email,
    adminClient: fakeSupabaseAdmin({
      users: [user],
      partnerBusiness: { id: "admin-metadata-partner", owner_id: user.id, status: "active" }
    })
  });

  assert.equal(result.eligible, false);
  assert.equal(result.reason, "privileged_role");
});

test("partner password reset eligibility blocks suspended partner profiles", async () => {
  const user = { id: "user-suspended-partner", email: "suspended@example.com" };
  const result = await resolvePartnerPasswordResetEligibility({
    email: user.email,
    adminClient: fakeSupabaseAdmin({
      users: [user],
      profile: { role: "partner", account_status: "suspended" },
      partnerBusiness: { id: "suspended-partner-business", owner_id: user.id, status: "active" }
    })
  });

  assert.equal(result.eligible, false);
  assert.equal(result.reason, "inactive_profile");
});

test("partner password reset eligibility blocks inactive partner business rows before profile fallback", async () => {
  const user = { id: "user-inactive-business", email: "inactive-business@example.com" };
  const result = await resolvePartnerPasswordResetEligibility({
    email: user.email,
    adminClient: fakeSupabaseAdmin({
      users: [user],
      profile: { role: "partner" },
      partnerBusiness: { id: "inactive-partner-business", owner_id: user.id, status: "pending" }
    })
  });

  assert.equal(result.eligible, false);
  assert.equal(result.reason, "inactive_partner_business");
});

test("partner password reset eligibility fails closed when profile state cannot be read", async () => {
  const user = { id: "user-profile-error", email: "profile-error@example.com" };
  const result = await resolvePartnerPasswordResetEligibility({
    email: user.email,
    adminClient: fakeSupabaseAdmin({
      users: [user],
      profileError: { message: "profiles unavailable" },
      partnerBusiness: { id: "profile-error-partner-business", owner_id: user.id, status: "active" }
    })
  });

  assert.equal(result.eligible, false);
  assert.equal(result.reason, "profile_lookup_failed");
});

test("partner password reset eligibility requires an auth user before legacy partner fallback", async () => {
  const result = await resolvePartnerPasswordResetEligibility({
    email: "legacy@example.com",
    adminClient: fakeSupabaseAdmin({
      users: [],
      legacyPartner: { id: "legacy-partner", email: "legacy@example.com", status: "active" }
    })
  });

  assert.equal(result.eligible, false);
  assert.equal(result.reason, "auth_user_not_found");
});

test("company lookup fails closed when the official provider is not configured", async () => {
  const { buildApp } = await import("../../src/app.js");
  const app = await buildApp();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/partner-company-lookup",
      headers: { host: "localhost" },
      payload: { country_code: "GB", tax_number: "12345678" }
    });
    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.provider, "uk_companies_house");
    assert.equal(payload.status, "provider_unconfigured");
    assert.equal(payload.company, null);
  } finally {
    await app.close();
  }
});

test("company lookup does not ask for a robot challenge when the country provider is missing", async () => {
  const previous = {
    turnstileSecret: config.turnstile.secretKey,
    turkeyProvider: config.companyLookup.turkeyProvider,
    turkeyApiUrl: config.companyLookup.turkeyApiUrl
  };
  config.turnstile.secretKey = "test-turnstile-secret";
  config.companyLookup.turkeyProvider = "generic";
  config.companyLookup.turkeyApiUrl = "";

  const { buildApp } = await import("../../src/app.js");
  const app = await buildApp();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/partner-company-lookup",
      headers: { host: "localhost" },
      payload: { country_code: "TR", tax_number: "1000000000" }
    });
    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.provider, "tr_authorized_provider");
    assert.equal(payload.status, "provider_unconfigured");
    assert.equal(payload.company, null);
    assert.match(payload.message, /yetkili entegratör|resmi/i);
  } finally {
    await app.close();
    config.turnstile.secretKey = previous.turnstileSecret;
    config.companyLookup.turkeyProvider = previous.turkeyProvider;
    config.companyLookup.turkeyApiUrl = previous.turkeyApiUrl;
  }
});

test("company lookup keeps robot protection when an official provider is configured", async () => {
  const previous = {
    turnstileSecret: config.turnstile.secretKey,
    companiesHouseApiKey: config.companyLookup.companiesHouseApiKey
  };
  config.turnstile.secretKey = "test-turnstile-secret";
  config.companyLookup.companiesHouseApiKey = "test-companies-house-key";

  const { buildApp } = await import("../../src/app.js");
  const app = await buildApp();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/partner-company-lookup",
      headers: { host: "localhost" },
      payload: { country_code: "GB", tax_number: "12345678" }
    });
    assert.equal(response.statusCode, 400);
    assert.match(response.json().message, /Robot doğrulaması gerekli/);
  } finally {
    await app.close();
    config.turnstile.secretKey = previous.turnstileSecret;
    config.companyLookup.companiesHouseApiKey = previous.companiesHouseApiKey;
  }
});
