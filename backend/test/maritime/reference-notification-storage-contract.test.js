import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routeUrl = new URL("../../src/routes/maritime-smart-account.js", import.meta.url);
const documentRouteUrl = new URL("../../src/routes/maritime-documents.js", import.meta.url);
const notificationUrl = new URL("../../src/lib/maritime-reference-notifications.js", import.meta.url);
const migrationUrl = new URL("../../../supabase/migrations/20260916060000_add_maritime_reference_notifications_and_storage_policy.sql", import.meta.url);
const formUrl = new URL("../../../js/maritime-cv-form.js", import.meta.url);
const accountUrl = new URL("../../../js/maritime-cv-account.js", import.meta.url);
const documentsUiUrl = new URL("../../../js/allona-maritime-documents.js", import.meta.url);

test("reference saves queue one private verification notice with a limited CV summary", async () => {
  const [route, notification, migration, form, account] = await Promise.all([
    readFile(routeUrl, "utf8"),
    readFile(notificationUrl, "utf8"),
    readFile(migrationUrl, "utf8"),
    readFile(formUrl, "utf8"),
    readFile(accountUrl, "utf8")
  ]);
  assert.match(route, /app\.post\("\/v1\/maritime\/reference-verifications"/);
  assert.match(route, /assertOwnedSeaServiceDocuments\(ctx\.user\.id, \[input\.experience\]\)/);
  assert.match(route, /await maritimePublicId\(ctx\.user\.id\)/);
  assert.match(route, /queueMaritimeReferenceNotification/);
  assert.match(notification, /"Idempotency-Key": `maritime-reference\/\$\{record\.id\}`/);
  assert.match(notification, /Allona ID/);
  assert.match(notification, /reference_company_email/);
  assert.doesNotMatch(notification, /passport_number|date_of_birth|permanent_address|emergency_contacts/);
  assert.match(migration, /unique \(seafarer_user_id, experience_id, fingerprint\)/);
  assert.match(migration, /revoke all on public\.maritime_reference_verification_requests from anon, authenticated/);
  assert.match(form, /referenceNotificationSent/);
  assert.match(account, /\/v1\/maritime\/reference-verifications/);
});

test("reference fingerprints are stable and email output excludes unrelated sensitive CV data", async () => {
  process.env.SUPABASE_URL ||= "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY ||= "test-anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service";
  const { buildMaritimeReferenceNotification } = await import(notificationUrl.href);
  const input = {
    publicId: "AL-50001",
    candidateName: "Example Seafarer",
    experience: {
      rowId: "11111111-1111-4111-8111-111111111111",
      vessel: "NUR K",
      imo: "9389370",
      company: "Example Shipping",
      type: "General Cargo",
      flag: "Vanuatu",
      dwt: "5000",
      grt: "3000",
      rank: "Motorman",
      signon: "2025-01-01",
      signoff: "2025-06-01",
      referenceName: "Reference Person",
      referenceCompanyEmail: "office@example.com",
      referenceCompanyPhone: "+000000000",
      referencePhone: "+111111111",
      serviceDocumentId: "22222222-2222-4222-8222-222222222222"
    },
    cvSummary: {
      current_position: "Motorman",
      competency_class: "Engine Rating",
      competency_certificate: "CERT-1",
      medical_expiry: "2027-01-01",
      certificate_codes: ["SO", "SH"]
    }
  };
  const first = buildMaritimeReferenceNotification(input);
  const second = buildMaritimeReferenceNotification(structuredClone(input));
  assert.equal(first.fingerprint, second.fingerprint);
  assert.match(first.subject, /AL-50001/);
  assert.match(first.html, /NUR K/);
  assert.doesNotMatch(first.html, /passport|birth date|home address/i);
});

test("private document storage is persistent, quota limited, deduplicated and owner deletable", async () => {
  const [route, migration, ui] = await Promise.all([
    readFile(documentRouteUrl, "utf8"),
    readFile(migrationUrl, "utf8"),
    readFile(documentsUiUrl, "utf8")
  ]);
  assert.match(route, /if \(!Number\.isFinite\(configured\) \|\| configured <= 0\) return null/);
  assert.match(route, /assertStorageCapacity/);
  assert.match(route, /matchingStoredDocuments/);
  assert.match(route, /deduplicated_storage/);
  assert.match(route, /app\.delete\("\/v1\/maritime\/documents\/:intakeId"/);
  assert.match(route, /MARITIME_DOCUMENT_IN_USE/);
  assert.match(route, /sharedStorageReferenceCount/);
  assert.match(migration, /set retention_until = null/);
  assert.match(ui, /data-delete-intake/);
  assert.match(ui, /storage_usage/);
});
