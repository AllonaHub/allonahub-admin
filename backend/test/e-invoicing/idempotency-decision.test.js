import test from "node:test";
import assert from "node:assert/strict";
import { decideDocumentType } from "../../src/modules/e-invoicing/decision-engine.js";
import { invoiceIdempotencyKey, jobIdempotencyKey } from "../../src/modules/e-invoicing/idempotency.js";
import { createInvoiceProvider } from "../../src/modules/e-invoicing/invoice-providers.js";

test("invoice and upload jobs use distinct database keys", () => {
  const invoiceKey = invoiceIdempotencyKey({ organizationId: "o", sellerId: "s", orderId: "r", subOrderId: "u", documentType: "E_INVOICE" });
  const createKey = jobIdempotencyKey({ jobType: "CREATE_DOCUMENT", organizationId: "o", invoiceId: "i" });
  const uploadKey = jobIdempotencyKey({ jobType: "UPLOAD_TO_CHANNEL", organizationId: "o", invoiceId: "i" });
  assert.match(invoiceKey, /^invoice:create:/);
  assert.notEqual(createKey, uploadKey);
});

test("document decision trusts only a verified taxpayer snapshot", async () => {
  const result = await decideDocumentType({
    provider: createInvoiceProvider("mock"),
    customer: { taxpayerStatus: "e_invoice", taxpayerStatusVerified: true },
    settings: { documentTypeFallback: "MANUAL_REVIEW" },
    allowProviderQuery: false
  });
  assert.equal(result.documentType, "E_INVOICE");
});

test("customer supplied taxpayer status cannot force a document type", async () => {
  const result = await decideDocumentType({
    provider: createInvoiceProvider("mock"),
    customer: { taxpayerStatus: "e_invoice", taxpayerStatusVerified: false },
    settings: { documentTypeFallback: "MANUAL_REVIEW" },
    allowProviderQuery: false
  });
  assert.equal(result.status, "NEEDS_REVIEW");
  assert.equal(result.documentType, null);
});

test("unknown taxpayer defaults to review, not a legal guess", async () => {
  const result = await decideDocumentType({
    provider: createInvoiceProvider("mock"),
    customer: { taxpayerStatus: "unknown" },
    settings: {}
  });
  assert.equal(result.status, "NEEDS_REVIEW");
  assert.equal(result.documentType, null);
});
