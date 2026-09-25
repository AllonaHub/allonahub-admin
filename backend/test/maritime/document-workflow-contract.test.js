import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const migrationUrl = new URL("../../../supabase/migrations/20260914050000_create_maritime_document_doctor.sql", import.meta.url);
const pageUrl = new URL("../../../pages/ecosystem/maritime-documents.html", import.meta.url);
const maritimeCvPageUrl = new URL("../../../pages/ecosystem/maritime-cv.html", import.meta.url);
const maritimeCvFormUrl = new URL("../../../js/maritime-cv-form.js", import.meta.url);
const maritimeCvAccountUrl = new URL("../../../js/maritime-cv-account.js", import.meta.url);
const portalUrl = new URL("../../../js/allona-maritime-portal.js", import.meta.url);
const documentUiUrl = new URL("../../../js/allona-maritime-documents.js", import.meta.url);
const photoUiUrl = new URL("../../../js/allona-maritime-photo.js", import.meta.url);
const maritimeCvBaseCssUrl = new URL("../../../css/maritime-cv-form-base.css", import.meta.url);
const routeUrl = new URL("../../src/routes/maritime-documents.js", import.meta.url);
const appUrl = new URL("../../src/app.js", import.meta.url);
const customerProfileUrl = new URL("../../src/lib/maritime-customer-profile.js", import.meta.url);
const localReaderUrl = new URL("../../src/lib/maritime-local-document-reader.js", import.meta.url);
const dockerfileUrl = new URL("../../Dockerfile", import.meta.url);
const deployUrl = new URL("../../../deploy/maritime/apply-maritime-migrations.sh", import.meta.url);
const schemaCheckUrl = new URL("../../../deploy/maritime/check-maritime-hiring-core.sh", import.meta.url);

test("photo preparation preserves portrait pixels when background is white or segmentation fails", async () => {
  const source = await readFile(photoUiUrl, "utf8");
  const prepare = source.slice(source.indexOf("async function prepare(file)"), source.indexOf("window.AllonaMaritimePhoto"));
  assert.match(prepare, /Math\.min\(border\.red, border\.green, border\.blue\) < 238/);
  assert.doesNotMatch(prepare, /whitenConnectedBackground\(/);
  assert.match(prepare, /backgroundMethod = "original_preserved"/);
});

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
  assert.match(deploy, /20260915193000_enforce_maritime_application_match_firewall\.sql/);
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

test("the customer workspace separates manual Maritime CV, PDF archive, and Global CV", async () => {
  const [page, maritimeCvPage, maritimeCvForm, maritimeCvAccount, portal, documentUi, photoUi, maritimeCvBaseCss, route, customerProfile, app] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(maritimeCvPageUrl, "utf8"),
    readFile(maritimeCvFormUrl, "utf8"),
    readFile(maritimeCvAccountUrl, "utf8"),
    readFile(portalUrl, "utf8"),
    readFile(documentUiUrl, "utf8"),
    readFile(photoUiUrl, "utf8"),
    readFile(maritimeCvBaseCssUrl, "utf8"),
    readFile(routeUrl, "utf8"),
    readFile(customerProfileUrl, "utf8"),
    readFile(appUrl, "utf8")
  ]);
  assert.match(page, /class="maritime-document-nav"[^>]+data-view-link="documents"/);
  assert.match(page, /href="maritime-cv\.html"[^>]+data-view-link="maritime-cv"/);
  assert.match(page, /data-create-global-cv/);
  assert.match(page, /type="file" multiple/);
  assert.match(page, /accept="application\/pdf,\.pdf"/);
  assert.match(page, /data-document-i18n="saveDocuments">Belgeleri Kaydet/);
  assert.match(page, /Belgeler okunmaz ve CV alanlarını değiştirmez/);
  assert.match(page, /id="maritimeDocumentUpload"/);
  assert.match(page, /data-document-i18n="backToPanel"/);
  assert.match(page, /data-document-i18n="matchingJobs"/);
  assert.doesNotMatch(page, /data-profile-photo-input|data-extraction-form|data-confirm-global-passport/);
  assert.doesNotMatch(page, /<(?:input|select|textarea)[^>]+name="(?:document_type|document_title|description|holder_name)"/);
  assert.ok(page.indexOf('data-view-link="documents"') < page.indexOf('data-view-link="jobs"'));
  assert.match(maritimeCvPage, /<title>Maritime CV \| AllonaHub<\/title>/);
  assert.match(maritimeCvPage, /<body[^>]+data-no-translate/);
  assert.match(maritimeCvPage, /id="photoInput"/);
  assert.match(maritimeCvPage, /data-cv-action="remove-photo"/);
  assert.match(maritimeCvPage, /class="cvPhotoFrame"/);
  assert.match(maritimeCvPage, /data-cv-action="add-stcw"/);
  assert.match(maritimeCvPage, /data-cv-action="generate-summary"/);
  assert.match(maritimeCvPage, /id="medicalFitness"/);
  for (const id of ["gender", "marital", "eyes", "hair", "shoes", "overall", "passportDoc", "windows", "office", "internet", "tradeSpecialty"]) {
    assert.match(maritimeCvPage, new RegExp(`<select id="${id}"`));
  }
  for (const language of ["az", "tr", "en", "ru"]) {
    for (const skill of ["Speak", "Read", "Write"]) assert.match(maritimeCvPage, new RegExp(`<select id="${language}${skill}"`));
  }
  assert.match(maritimeCvPage, /js\/vendor\/html2canvas-1\.4\.1\.min\.js/);
  assert.match(maritimeCvPage, /js\/vendor\/jspdf-2\.5\.1\.umd\.min\.js/);
  assert.doesNotMatch(maritimeCvPage, /cdnjs\.cloudflare\.com\/ajax\/libs\/(?:html2canvas|jspdf)/);
  assert.match(maritimeCvPage, /maritime-cv-account\.js/);
  assert.match(maritimeCvForm, /window\.getMaritimeCVData = getCVData/);
  for (const code of ["SP", "SH", "SI", "SL", "SO", "SA"]) assert.match(maritimeCvForm, new RegExp(`code: "${code}"`));
  assert.doesNotMatch(maritimeCvForm, /id: "se"[^\n]+code: "SE"/);
  assert.match(maritimeCvForm, /removedSePreset && !hasSeCertificateData/);
  for (const code of ["SP", "SH", "SI", "SL", "SO"]) assert.match(maritimeCvForm, new RegExp(`id: "${code.toLowerCase()}"[^\n]+required: true`));
  for (const label of [
    "Chemical Tanker Certificate (SA)",
    "Kimyasal Tanker Sertifikası (SA)",
    "Kimyəvi Tanker Sertifikatı (SA)",
    "Сертификат химического танкера (SA)"
  ]) assert.ok(maritimeCvForm.includes(label));
  for (const key of ["photoHelp", "validityPeriod", "competencyHelp", "stcwHelp", "certificateNumber", "unlimited", "generateSummary", "accountFieldsRequired", "selectSkillLevel", "tradeSpecialty", "serviceDocumentChooseTitle"]) {
    assert.ok((maritimeCvForm.match(new RegExp(`${key}:`, "g")) || []).length >= 4, `${key} must exist in all four CV languages`);
  }
  assert.match(maritimeCvForm, /generatedProfessionalSummary/);
  assert.match(maritimeCvForm, /deriveCertificateCode/);
  assert.match(maritimeCvForm, /updateStcwCardPresentation/);
  assert.match(maritimeCvForm, /displayPosition/);
  assert.match(maritimeCvForm, /function validateMaritimeCV\(options\)/);
  assert.match(maritimeCvForm, /preset\?\.id === "sa"/);
  assert.match(maritimeCvForm, /data-cv-key="included"/);
  assert.match(maritimeCvForm, /summaryMode === "auto"/);
  assert.match(maritimeCvAccount, /\/v1\/maritime\/cv-profile/);
  assert.match(maritimeCvAccount, /\/v1\/maritime\/profile-photo/);
  assert.match(maritimeCvAccount, /method: "DELETE"/);
  assert.doesNotMatch(portal, /career\/cv-form\.html/);
  assert.match(portal, /allona:maritime-documents-ready/);
  assert.match(documentUi, /const maxFiles = 20/);
  assert.match(documentUi, /const maxFileBytes = 45 \* 1024 \* 1024/);
  assert.match(documentUi, /const allowedTypes = \["application\/pdf"\]/);
  assert.match(documentUi, /\/v1\/maritime\/documents\/archive/);
  assert.match(documentUi, /\/v1\/maritime\/smart-account\/prepare/);
  assert.doesNotMatch(documentUi, /\/analyze|document-extractions|evidenceSourcePage|globalPassportDraft/);
  assert.match(photoUi, /face_pixels_regenerated: false/);
  assert.doesNotMatch(photoUi, /fetch\(|XMLHttpRequest|WebSocket/);
  assert.match(maritimeCvBaseCss, /\.cvPhotoFrame\s*\{[\s\S]*?aspect-ratio:3 \/ 4/);
  assert.match(maritimeCvBaseCss, /\.photoCell img\s*\{[\s\S]*?object-fit:contain/);
  assert.match(maritimeCvBaseCss, /@media print[\s\S]*?\.cvPhotoFrame\s*\{[\s\S]*?width:38mm!important/);
  assert.match(route, /app\.post\("\/v1\/maritime\/documents\/archive"/);
  assert.match(route, /document_analysis: false/);
  assert.match(route, /maritimeDocumentSignatureMatches\(bytes, "application\/pdf"\)/);
  assert.match(app, /addContentTypeParser\("application\/pdf"/);
  assert.match(app, /"X-Allona-File-Name"/);
  assert.match(route, /\/v1\/maritime\/profile-photo\/upload-intent/);
  assert.match(route, /\/v1\/maritime\/profile-photo\/confirm/);
  assert.match(route, /app\.post\("\/v1\/maritime\/profile-photo"/);
  assert.match(route, /Buffer\.isBuffer\(request\.body\)/);
  assert.match(app, /registerMaritimePhotoParsers\(app\)/);
  assert.match(route, /normalizeMaritimeProfilePhoto\(request\.body, request\.headers\["content-type"\]\)/);
  assert.match(route, /pendingProfilePhotoPath/);
  assert.match(route, /upload_id/);
  assert.match(route, /\.upload\(path, bytes/);
  assert.match(route, /MARITIME_PROFILE_PHOTO_MAX_BYTES/);
  assert.match(route, /MARITIME_DOCUMENT_READER_VERSION/);
  assert.match(route, /maritimeDocumentIdentityConflicts/);
  assert.match(route, /MARITIME_DOCUMENT_IDENTITY_CONFLICT/);
  assert.match(route, /import \{ ensureMaritimeCustomerProfile \}/);
  assert.match(route, /return ensureMaritimeCustomerProfile\(ctx\)/);
  assert.match(customerProfile, /function ensureMaritimeCustomerProfile\(ctx\)/);
  assert.match(customerProfile, /MARITIME_CUSTOMER_PROFILE_RECOVERY_FAILED/);
  assert.match(route, /Bu alan kişisel kullanıcı hesaplarına açıktır/);
  assert.match(customerProfile, /account_status: "active"/);
  assert.match(documentUi, /error\.code = response\.status === 401 \? "AUTH_REQUIRED" : payload\.code \|\| payload\.error/);
  assert.match(route, /normalizeMaritimeProfilePhoto\(Buffer\.from\(await download\.data\.arrayBuffer\(\)\), "image\/webp"\)/);
  assert.doesNotMatch(documentUi, /name="certificate_codes"/);
});

test("every document label has a complete nine-language row", async () => {
  const source = await readFile(documentUiUrl, "utf8");
  const instrumented = source.replace("const copyRows = {", "const copyRows = window.__documentCopyRows = {");
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
  assert.ok(window.__documentCopyRows.uploadLead.every((value) => /PDF/i.test(value) && !/JPEG|PNG|WebP/i.test(value)));
});
