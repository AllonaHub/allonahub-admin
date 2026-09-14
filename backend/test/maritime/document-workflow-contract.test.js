import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const migrationUrl = new URL("../../../supabase/migrations/20260914050000_create_maritime_document_doctor.sql", import.meta.url);
const pageUrl = new URL("../../../pages/ecosystem/maritime-documents.html", import.meta.url);
const portalUrl = new URL("../../../js/allona-maritime-portal.js", import.meta.url);
const documentUiUrl = new URL("../../../js/allona-maritime-documents.js", import.meta.url);
const photoUiUrl = new URL("../../../js/allona-maritime-photo.js", import.meta.url);
const portalCssUrl = new URL("../../../css/allona-maritime-portal.css", import.meta.url);
const routeUrl = new URL("../../src/routes/maritime-documents.js", import.meta.url);
const customerProfileUrl = new URL("../../src/lib/maritime-customer-profile.js", import.meta.url);
const localReaderUrl = new URL("../../src/lib/maritime-local-document-reader.js", import.meta.url);
const dockerfileUrl = new URL("../../Dockerfile", import.meta.url);
const deployUrl = new URL("../../../deploy/maritime/apply-maritime-migrations.sh", import.meta.url);
const schemaCheckUrl = new URL("../../../deploy/maritime/check-maritime-hiring-core.sh", import.meta.url);

test("document storage and extracted records remain private until explicit confirmation", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /'maritime-private-documents'[\s\S]*?false/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /seafarer_user_id = auth\.uid\(\)/);
  assert.match(migration, /status <> 'confirmed' or \(confirmed_payload is not null and confirmed_at is not null\)/);
  assert.match(migration, /confirm_maritime_document_extraction/);
  assert.match(migration, /role = 'customer'/);
  assert.match(migration, /'certificate_records'/);
  assert.match(migration, /'field_evidence'/);
  assert.match(migration, /maritime_merge_cv_payload/);
  assert.match(migration, /maritime_jsonb_array_union\(current_payload -> 'sea_service', incoming_payload -> 'sea_service'\)/);
  assert.match(migration, /maritime_cv_profiles\.source_document_ids \|\| excluded\.source_document_ids/);
  assert.match(migration, /maritime document identity conflict/);
  assert.match(migration, /'maritime-profile-photos'[\s\S]*?false/);
  assert.match(migration, /'image\/webp'/);
});

test("production keeps a local OCR reader available when no external AI key is configured", async () => {
  const [route, localReader, dockerfile] = await Promise.all([
    readFile(routeUrl, "utf8"),
    readFile(localReaderUrl, "utf8"),
    readFile(dockerfileUrl, "utf8")
  ]);
  assert.match(route, /localReaderEnabled: config\.maritimeDocuments\.localReaderEnabled/);
  assert.match(route, /!config\.maritimeDocuments\.aiApiKey && !config\.maritimeDocuments\.localReaderEnabled/);
  assert.match(localReader, /pdftotext/);
  assert.match(localReader, /pdftoppm/);
  assert.match(localReader, /tesseract/);
  assert.match(dockerfile, /poppler-utils/);
  assert.match(dockerfile, /tesseract-ocr-data-aze/);
  assert.match(dockerfile, /tesseract-ocr-data-spa/);
  assert.match(dockerfile, /tesseract-ocr-data-tur/);
});

test("the production maritime migration chain includes and verifies Global Passport data", async () => {
  const [deploy, schemaCheck] = await Promise.all([
    readFile(deployUrl, "utf8"),
    readFile(schemaCheckUrl, "utf8")
  ]);
  assert.match(deploy, /20260914050000_create_maritime_document_doctor\.sql/);
  assert.match(deploy, /20260914060000_create_maritime_smart_account\.sql/);
  for (const table of [
    "maritime_document_batches",
    "maritime_document_extractions",
    "maritime_cv_profiles",
    "maritime_smart_account_runs",
    "maritime_application_permission_batches"
  ]) {
    assert.match(schemaCheck, new RegExp(`'${table}'`));
  }
  assert.match(schemaCheck, /Private maritime storage buckets are missing or unsafe/);
  assert.match(schemaCheck, /Maritime Global Passport function grants are unsafe/);
});

test("the customer workspace exposes a PDF-only Global Passport flow", async () => {
  const [page, portal, documentUi, photoUi, portalCss, route, customerProfile] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(portalUrl, "utf8"),
    readFile(documentUiUrl, "utf8"),
    readFile(photoUiUrl, "utf8"),
    readFile(portalCssUrl, "utf8"),
    readFile(routeUrl, "utf8"),
    readFile(customerProfileUrl, "utf8")
  ]);
  assert.match(page, /class="maritime-document-nav"[^>]+data-view-link="documents"/);
  assert.match(page, /type="file" multiple/);
  assert.match(page, /accept="application\/pdf,\.pdf"/);
  assert.match(page, /data-document-i18n="uploadAndAnalyze">Global Pasaportu Oluştur/);
  assert.match(page, /id="maritimeDocumentUpload"/);
  assert.match(page, /data-passport-update-note/);
  assert.match(page, /data-global-passport-preview/);
  assert.match(page, /data-global-passport-readiness/);
  assert.match(page, /data-confirm-global-passport/);
  assert.match(page, /data-open-maritime-cv/);
  assert.match(page, /data-document-i18n="backToPanel"/);
  assert.match(page, /data-document-i18n="matchingJobs"/);
  assert.match(page, /data-profile-photo-input/);
  assert.match(page, /data-photo-required-notice/);
  assert.match(page, /allona-maritime-photo\.js/);
  assert.doesNotMatch(page, /selfie_segmentation/);
  assert.doesNotMatch(page, /<(?:input|select|textarea)[^>]+name="(?:document_type|document_title|description|holder_name)"/);
  assert.ok(page.indexOf('data-view-link="documents"') < page.indexOf('data-view-link="jobs"'));
  assert.match(portal, /\["applications", "offers", "auto", "account", "documents", "smart"\]/);
  assert.match(portal, /allona:maritime-documents-ready/);
  assert.match(documentUi, /maxFiles = 20/);
  assert.match(documentUi, /maxFileBytes = 45 \* 1024 \* 1024/);
  assert.match(documentUi, /const allowedTypes = \["application\/pdf"\]/);
  assert.match(documentUi, /function globalPassportDraft\(\)/);
  assert.match(documentUi, /function globalPassportPreviewMarkup\(draft\)/);
  assert.match(documentUi, /function confirmGlobalPassport\(button\)/);
  assert.match(documentUi, /function isUpdateMode\(\)/);
  assert.match(documentUi, /function refreshSmartAccountAfterDocumentChange\(\)/);
  assert.match(documentUi, /\/v1\/maritime\/smart-account\/prepare/);
  assert.match(documentUi, /event\.target\.closest\("\[data-extraction-form\]"\)/);
  assert.match(documentUi, /event\.target\.closest\("\[data-reject-extraction\]"\)/);
  assert.match(documentUi, /function evidenceSourcePage\(payload, fieldPath, value\)/);
  assert.doesNotMatch(documentUi, /source_page: 1/);
  assert.match(documentUi, /body: JSON\.stringify\(\{ payload, confirmation: true \}\)/);
  assert.match(documentUi, /function globalPassportReadiness\(draft\)/);
  assert.match(documentUi, /function rescanAnalysis\(intakeId, button\)/);
  assert.doesNotMatch(documentUi, /sessionMetadata\.full_name|user\?\.email\?\.split/);
  assert.match(documentUi, /mime_type: "application\/pdf"/);
  assert.match(documentUi, /confirmation: true/);
  assert.match(documentUi, /certificateRecordsMarkup/);
  assert.match(documentUi, /certificate_records: records/);
  assert.match(documentUi, /identity_documents/);
  assert.match(documentUi, /physical_profile/);
  assert.match(documentUi, /medical_records: medicalRecords/);
  assert.match(documentUi, /vaccinations/);
  assert.match(documentUi, /education/);
  assert.match(documentUi, /skills/);
  assert.match(documentUi, /achievements/);
  assert.match(documentUi, /references/);
  assert.match(documentUi, /sourceEvidence/);
  assert.match(photoUi, /face_pixels_regenerated: false/);
  assert.doesNotMatch(photoUi, /fetch\(|XMLHttpRequest|WebSocket/);
  assert.match(portalCss, /\.maritime-global-passport-actions \.maritime-button\[hidden\][\s\S]*?display: none !important/);
  assert.match(route, /\/v1\/maritime\/profile-photo\/upload-intent/);
  assert.match(route, /\/v1\/maritime\/profile-photo\/confirm/);
  assert.match(route, /pendingProfilePhotoPath/);
  assert.match(route, /upload_id/);
  assert.match(route, /\.upload\(path, bytes/);
  assert.match(route, /MARITIME_PROFILE_PHOTO_MAX_BYTES/);
  assert.match(route, /MARITIME_DOCUMENT_READER_VERSION/);
  assert.match(route, /maritimeDocumentIdentityConflicts/);
  assert.match(route, /MARITIME_DOCUMENT_IDENTITY_CONFLICT/);
  assert.match(route, /MARITIME_PROFILE_PHOTO_REQUIRED/);
  assert.match(route, /\["pending_user_confirmation", "user_confirmed"\]\.includes\(intake\.status\)/);
  assert.match(route, /\.neq\("id", extraction\.id\)/);
  assert.match(route, /extraction\.status === "confirmed" \|\| extraction\.confirmed_payload/);
  assert.match(route, /\/v1\/maritime\/document-extractions\/:extractionId\/correct/);
  assert.match(route, /rebuildConfirmedProfile/);
  assert.match(route, /import \{ ensureMaritimeCustomerProfile \}/);
  assert.match(route, /return ensureMaritimeCustomerProfile\(ctx\)/);
  assert.match(customerProfile, /function ensureMaritimeCustomerProfile\(ctx\)/);
  assert.match(customerProfile, /MARITIME_CUSTOMER_PROFILE_RECOVERY_FAILED/);
  assert.match(route, /Bu alan kişisel kullanıcı hesaplarına açıktır/);
  assert.match(customerProfile, /account_status: "active"/);
  assert.match(route, /MARITIME_DOCUMENT_AI_NOT_CONFIGURED/);
  assert.match(documentUi, /firstFailureMessage/);
  assert.match(documentUi, /error\.code = payload\.code/);
  assert.match(route, /maritimeDocumentSignatureMatches\(bytes, "image\/webp"\)/);
  assert.doesNotMatch(documentUi, /name="certificate_codes"/);
  assert.doesNotMatch(portal, /career\/cv-form\.html/);
});

test("every document label has a complete nine-language row", async () => {
  const source = await readFile(documentUiUrl, "utf8");
  const instrumented = source
    .replace("const copyRows = {", "const copyRows = window.__documentCopyRows = {")
    .replace("const documentTypeLabels = {", "const documentTypeLabels = window.__documentTypeLabels = {");
  const window = { Allona: {} };
  vm.runInNewContext(instrumented, {
    window,
    document: {
      readyState: "loading",
      documentElement: { lang: "tr" },
      addEventListener() {},
      querySelectorAll() { return []; }
    },
    localStorage: { getItem() { return null; } },
    URL,
    URLSearchParams,
    FormData,
    console
  });
  for (const [key, row] of Object.entries(window.__documentCopyRows)) {
    assert.equal(row.length, 9, `${key} must include all nine languages`);
    assert.ok(row.every((value) => String(value).trim()), `${key} contains an empty translation`);
  }
  for (const [key, row] of Object.entries(window.__documentTypeLabels)) {
    assert.equal(row.length, 9, `${key} must include all nine languages`);
    assert.ok(row.every((value) => String(value).trim()), `${key} contains an empty translation`);
  }
  assert.ok(window.__documentCopyRows.uploadLead.every((value) => /PDF/i.test(value) && !/JPEG|PNG|WebP/i.test(value)));
});
