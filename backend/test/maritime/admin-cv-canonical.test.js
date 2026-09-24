import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";

process.env.SUPABASE_URL = "https://admin-cv.test";
process.env.SUPABASE_ANON_KEY = "test-anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service";
process.env.AUDIT_LOG_ENABLED = "false";
process.env.SUPER_ADMIN_OWNER_USER_IDS = "00000000-0000-4000-8000-000000000099";
process.env.ADMIN_ALLOWED_HOSTS = "";
const { prepareMaritimeAdminCv, normalizeManualCv, maritimeAdminCvError } = await import("../../src/routes/maritime-smart-account.js");
const { buildMaritimeSmartProfile } = await import("../../src/lib/maritime-smart-profile.js");
const { registerRoutes } = await import("../../src/routes/index.js");

const owner = "00000000-0000-4000-8000-000000000001";
const rowId = "00000000-0000-4000-8000-000000000002";
const documentId = "00000000-0000-4000-8000-000000000003";
export function fixture() {
  return {
    lang: "en", summaryMode: "auto",
    fields: {
      firstName: "Sample", familyName: "Seafarer", fatherName: "Parent", birthDate: "1990-01-02", birthPlace: "Baku",
      nationality: "Azerbaijan", gender: "male", marital: "single", position: "Ordinary Seaman",
      email: "sample@example.invalid", mobile: "+994000000000", address: "Sample address", airport: "Baku",
      passportNo: "P100", passportCountry: "AZ", passportIssued: "2025-01-01", passportValid: "2035-01-01",
      seamanBookNo: "B100", seamanBookIssued: "2025-01-01", seamanBookValid: "2035-01-01",
      medicalDoc: "M100", medicalFitness: "fit", medicalIssue: "2026-01-01", medicalExpiry: "2035-01-01"
    },
    stcwData: ["SP", "SH", "SI", "SL", "SO"].map((code) => ({ presetId: code.toLowerCase(), code, name: "", cert: "", number: "100", issue: "2025-01-01", expiry: "2035-01-01", included: "true" })),
    additionalData: [],
    seaData: [{ rowId, serviceDocumentId: documentId, saved: "false", imo: "9389370", vessel: "Sample vessel", company: "Sample company", type: "General Cargo", flag: "VU", mmsi: "123456789", dwt: "5000", grt: "3000", rank: "Ordinary Seaman", signon: "2025-01-01", signoff: "2025-06-01", referenceName: "Sample Reference", referenceCompanyEmail: "reference@example.invalid", referenceCompanyPhone: "+900000000000", referencePhone: "+900000000001" }]
  };
}

function mockStorage(t, { photo = true, document = true } = {}) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const target = new URL(String(url));
    assert.equal(target.origin, "https://admin-cv.test");
    const json = (value) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
    if (target.pathname.includes("/storage/")) return json(photo ? [{ name: "profile.webp" }] : []);
    if (target.pathname === "/rest/v1/maritime_document_intakes") {
      assert.equal(target.searchParams.get("seafarer_user_id"), `eq.${owner}`);
      return json(document ? [{ id: documentId, seafarer_user_id: owner, status: "user_confirmed", document_type: "sea_service_record", metadata: { source: "maritime_cv_sea_service", experience_id: rowId } }] : []);
    }
    throw new Error(`Unexpected request ${target.pathname}`);
  };
  t.after(() => { globalThis.fetch = original; });
}

test("legacy certificate alias becomes one number, code restores preset and identity stays original", () => {
  const cv = fixture();
  cv.fields.firstName = "Şəhriyar";
  cv.fields.doctor = "legacy invalid field";
  cv.stcwData[0] = { code: "SP", cert: "777", number: "" };
  const result = normalizeManualCv(cv);
  assert.equal(result.fields.firstName, "Şəhriyar");
  assert.equal(result.fields.birthPlace, "Baku");
  assert.equal(result.fields.doctor, undefined);
  assert.deepEqual(result.stcwData[0], { presetId: "sp", code: "SP", cert: "", number: "777" });
});

test("admin save rebuilds all derived data and confirms a complete owned sea record", async (t) => {
  mockStorage(t);
  const source = { manual_cv: fixture(), certificate_records: [{ document_number: "OLD" }], contact: { email: "old@example.invalid" }, rank: "OLD", sea_service: [] };
  const before = structuredClone(source);
  const { payload, readiness } = await prepareMaritimeAdminCv(owner, source, "verified");
  assert.deepEqual(source, before);
  assert.equal(payload.place_of_birth, "Baku");
  assert.equal(payload.certificate_records[0].document_number, "SP-100");
  assert.match(payload.certificate_records[0].title, /International Safety/);
  assert.equal(payload.contact.email, source.manual_cv.fields.email);
  assert.equal(payload.rank, "Ordinary Seaman");
  assert.equal(payload.sea_service[0].vessel_name, "Sample vessel");
  assert.equal(payload.manual_cv.seaData[0].saved, "true");
  assert.equal(readiness.ready, true);
  for (const status of ["user_confirmed", "verification_pending", "verified"]) {
    const result = buildMaritimeSmartProfile({ cvProfile: { profile_status: status, last_user_confirmed_at: "2026-09-24T00:00:00Z", profile_payload: payload }, readinessItems: [], documents: [], now: new Date("2026-09-25") });
    assert.ok(!result.readiness.blocking_reasons.includes("no_confirmed_profile"), status);
    assert.equal(result.cv_draft.certificate_records[0].document_number, "SP-100");
  }
});

test("incomplete sea reference cannot be approved even by administrator", async (t) => {
  mockStorage(t);
  const cv = fixture();
  cv.seaData[0].referenceCompanyEmail = "";
  await assert.rejects(prepareMaritimeAdminCv(owner, { manual_cv: cv }, "verified"), (error) => error.code === "MARITIME_CV_EXPERIENCE_INCOMPLETE" && error.statusCode === 409);
});

test("another user's service document cannot be attached through admin finalization", async (t) => {
  mockStorage(t, { document: false });
  await assert.rejects(prepareMaritimeAdminCv(owner, { manual_cv: fixture() }, "user_confirmed"), { code: "MARITIME_SEA_SERVICE_DOCUMENT_MISMATCH" });
});

test("missing photo and required certificates block confirmation, not draft preservation", async (t) => {
  mockStorage(t, { photo: false });
  const cv = fixture();
  cv.stcwData[0].number = "";
  const draft = await prepareMaritimeAdminCv(owner, { manual_cv: cv }, "draft");
  assert.equal(draft.payload.manual_cv.seaData[0].saved, "false");
  assert.equal(draft.readiness.ready, false);
  await assert.rejects(prepareMaritimeAdminCv(owner, { manual_cv: cv }, "verified"), (error) => error.code === "MARITIME_CV_REQUIRED_FIELDS_MISSING" && /Profil fotoğrafı/.test(error.message));
});

test("database identity rejection is actionable without exposing private database details", () => {
  assert.equal(maritimeAdminCvError({ message: "MARITIME_IDENTITY_REQUIRED" }).statusCode, 409);
  assert.equal(maritimeAdminCvError({ message: "MARITIME_IDENTITY_ALREADY_REGISTERED" }).code, "MARITIME_IDENTITY_ALREADY_REGISTERED");
  assert.ok(!maritimeAdminCvError({ message: "secret database record" }).message.includes("secret"));
});

for (const [role, aal, status] of [["super_admin", "aal2", 200], ["super_admin", "aal1", 403], ["customer", "aal2", 403]]) {
  test(`real admin PATCH protects ${role}/${aal} and writes canonical CV only when authorized`, async (t) => {
    const originalFetch = globalThis.fetch;
    let rpcPayload;
    const admin = "00000000-0000-4000-8000-000000000099";
    globalThis.fetch = async (url, init = {}) => {
      const target = new URL(String(url));
      assert.equal(target.origin, "https://admin-cv.test");
      const json = (data) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
      if (target.pathname === "/auth/v1/user") return json({ id: admin, aal, app_metadata: { role } });
      if (target.pathname === "/rest/v1/profiles") return json(target.searchParams.get("id") === `eq.${admin}` ? { id: admin, role, account_status: "active" } : { id: owner, role: "customer", module: "maritime", public_id: "AL-50001" });
      if (target.pathname.includes("/storage/")) return json([{ name: "profile.webp" }]);
      if (target.pathname === "/rest/v1/maritime_document_intakes") return json([{ id: documentId, status: "user_confirmed", document_type: "sea_service_record", metadata: { source: "maritime_cv_sea_service", experience_id: rowId } }]);
      if (["/rest/v1/maritime_smart_account_runs", "/rest/v1/maritime_match_results"].includes(target.pathname)) return json([]);
      if (target.pathname === "/rest/v1/rpc/super_admin_update_maritime_cv") {
        rpcPayload = JSON.parse(init.body);
        return json({ ok: true });
      }
      throw new Error(`Unexpected request ${target.pathname}`);
    };
    const app = Fastify({ logger: false });
    registerRoutes(app);
    t.after(async () => { await app.close(); globalThis.fetch = originalFetch; });
    const request = { method: "PATCH", url: `/v1/control-center/maritime-users/${owner}/cv`, headers: { host: "admin.allonahub.com", authorization: "Bearer test" }, payload: { profile_payload: { manual_cv: fixture() }, profile_status: "verified", completion_percent: 0, reason: "Synthetic admin review" } };
    const response = await app.inject(request);
    assert.equal(response.statusCode, status, response.body);
    if (status === 200) {
      assert.equal(rpcPayload.p_profile_payload.place_of_birth, "Baku");
      assert.equal(rpcPayload.p_profile_payload.certificate_records[0].document_number, "SP-100");
      assert.equal(rpcPayload.p_actor_user_id, admin);
      assert.equal(rpcPayload.p_target_user_id, owner);
      assert.equal(rpcPayload.p_profile_status, "verified");
      assert.ok(rpcPayload.p_completion_percent > 0);
    } else assert.equal(rpcPayload, undefined);
    const guest = await app.inject({ ...request, headers: { host: "admin.allonahub.com" } });
    assert.equal(guest.statusCode, 401);
  });
}
