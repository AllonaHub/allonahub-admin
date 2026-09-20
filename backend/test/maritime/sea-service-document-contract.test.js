import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const formUrl = new URL("../../../js/maritime-cv-form.js", import.meta.url);
const controlsUrl = new URL("../../../js/maritime-cv-controls.js", import.meta.url);
const accountUrl = new URL("../../../js/maritime-cv-account.js", import.meta.url);
const pageUrl = new URL("../../../pages/ecosystem/maritime-cv.html", import.meta.url);
const cssUrl = new URL("../../../css/maritime-cv-form.css", import.meta.url);
const viewerPageUrl = new URL("../../../pages/ecosystem/maritime-service-document.html", import.meta.url);
const viewerJsUrl = new URL("../../../js/maritime-service-document.js", import.meta.url);
const routeUrl = new URL("../../src/routes/maritime-documents.js", import.meta.url);
const smartRouteUrl = new URL("../../src/routes/maritime-smart-account.js", import.meta.url);
const appUrl = new URL("../../src/app.js", import.meta.url);

test("sea experience requires a securely archived service document before it reaches the CV", async () => {
  const [form, controls, account, page, css] = await Promise.all([
    readFile(formUrl, "utf8"),
    readFile(controlsUrl, "utf8"),
    readFile(accountUrl, "utf8"),
    readFile(pageUrl, "utf8"),
    readFile(cssUrl, "utf8")
  ]);
  for (const key of ["addServiceDocument", "saveExperience", "serviceDocumentLink", "experienceSaved", "serviceDocumentRequired"]) {
    assert.ok((form.match(new RegExp(`${key}:`, "g")) || []).length >= 4, `${key} must exist in all four Maritime CV languages`);
  }
  for (const field of ["imo", "vessel", "company", "type", "flag", "mmsi", "dwt", "grt", "rank", "signon", "signoff", "referenceName", "referenceCompanyEmail", "referenceCompanyPhone", "referencePhone"]) {
    assert.match(form, new RegExp(`data-cv-key="${field}"`));
  }
  for (const field of ["vesselPhotoUrl", "vesselPhotoSourceUrl", "vesselPhotoCredit"]) assert.match(form, new RegExp(field));
  assert.match(form, /className = "cv-sea-photo-row"/);
  assert.match(form, /addEventListener\("error", \(\) => photoRow\.remove\(\)/);
  assert.match(form, /cv-vessel-photo--editor/);
  assert.match(form, /accept="image\/jpeg,image\/png,image\/webp,image\/\*" capture="environment"/);
  assert.match(form, /accept="application\/pdf,\.pdf" data-cv-service-document data-cv-source="pdf"/);
  assert.match(form, /data-cv-action="choose-sea-document"/);
  assert.match(form, /data-cv-action="choose-sea-document-source"/);
  for (const source of ["camera", "library", "pdf"]) assert.match(form, new RegExp(`data-cv-source="${source}"`));
  assert.match(form, /data-cv-action="save-sea"/);
  assert.match(form, /seaData\.filter\(item => item\.saved === "true"\)/);
  assert.match(form, /serviceDocumentId/);
  assert.match(form, /class="cv-service-document-link"/);
  assert.match(form, /https:\/\/allonahub\.com\/pages\/ecosystem\/maritime-service-document\.html/);
  assert.match(controls, /pdf\.link\(x, y, width, height/);
  assert.match(controls, /attachSeaServiceDocument/);
  assert.match(account, /\/v1\/maritime\/sea-service-documents/);
  assert.match(page, /maritime-cv-form\.js\?v=20260920-cv-save2/);
  assert.match(css, /\.cv-sea-actions/);
  assert.match(css, /\.cv-sea-document-choice-actions/);
  assert.match(css, /\.cv-service-document-link/);
});

test("service document viewer uses short-lived authorization instead of publishing storage URLs", async () => {
  const [route, smartRoute, app, viewerPage, viewerJs, form] = await Promise.all([
    readFile(routeUrl, "utf8"),
    readFile(smartRouteUrl, "utf8"),
    readFile(appUrl, "utf8"),
    readFile(viewerPageUrl, "utf8"),
    readFile(viewerJsUrl, "utf8"),
    readFile(formUrl, "utf8")
  ]);
  assert.match(route, /app\.post\("\/v1\/maritime\/sea-service-documents"/);
  assert.match(app, /"X-Allona-Maritime-Experience-Id"/);
  assert.match(route, /maritimeDocumentSignatureMatches\(bytes, "application\/pdf"\)/);
  assert.match(route, /document_type: "sea_service_record"/);
  assert.match(route, /source: SEA_SERVICE_DOCUMENT_SOURCE/);
  assert.match(route, /app\.get\("\/v1\/maritime\/sea-service-documents\/:intakeId\/access"/);
  assert.match(route, /const expiresIn = 300/);
  assert.match(route, /hasRole\(ctx\.profile, \["admin", "super_admin"\]\)/);
  assert.match(route, /hasRole\(ctx\.profile, "partner"\)/);
  for (const key of ["rowId", "serviceDocumentId", "serviceDocumentName", "serviceDocumentSize", "serviceDocumentStatus", "saved"]) assert.match(smartRoute, new RegExp(`"${key}"`));
  assert.match(smartRoute, /assertOwnedSeaServiceDocuments\(ctx\.user\.id, input\.cv\.seaData\)/);
  assert.match(smartRoute, /document\.metadata\?\.experience_id === row\.rowId/);
  assert.match(smartRoute, /MARITIME_SEA_SERVICE_DOCUMENT_MISMATCH/);
  for (const status of ["submitted", "shortlisted", "interviewing", "offer_sent", "offer_accepted", "hired"]) assert.match(route, new RegExp(`"${status}"`));
  for (const blocked of ["drafted", "awaiting_candidate_approval", "withdrawn", "offer_declined", "rejected", "closed"]) {
    assert.doesNotMatch(route.match(/PARTNER_DOCUMENT_ACCESS_STATUSES[^;]+;/)?.[0] || "", new RegExp(`"${blocked}"`));
  }
  assert.doesNotMatch(form, /storage_bucket|storage_path|signedUrl/);
  assert.match(viewerPage, /data-go-back/);
  assert.match(viewerPage, /href="\.\.\/\.\.\/index\.html"/);
  assert.match(viewerPage, /href="allonadenizcilik\.html"/);
  for (const language of ["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"]) assert.match(viewerJs, new RegExp(`\\b${language}:\\{`));
  assert.match(viewerJs, /Authorization:`Bearer \$\{session\.access_token\}`/);
  assert.match(viewerJs, /\/v1\/maritime\/sea-service-documents\/\$\{encodeURIComponent\(id\)\}\/access/);
});
