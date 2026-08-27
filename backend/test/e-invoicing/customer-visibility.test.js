import assert from "node:assert/strict";
import test from "node:test";
import { isCustomerInvoiceVisible } from "../../src/modules/e-invoicing/customer-visibility.js";

const customerId = "00000000-0000-4000-8000-000000000001";

test("customer sale invoices remain visible while internal domains stay hidden", () => {
  assert.equal(isCustomerInvoiceVisible({ customer_id: customerId, document_scope: "CUSTOMER_SALE", document_type: "E_INVOICE" }), true);
  assert.equal(isCustomerInvoiceVisible({ customer_id: customerId, document_scope: "CUSTOMER_SALE", document_type: "E_ARCHIVE" }), true);
  assert.equal(isCustomerInvoiceVisible({ customer_id: customerId, document_scope: "COMMISSION", document_type: "COMMISSION" }), false);
  assert.equal(isCustomerInvoiceVisible({ customer_id: null, document_scope: "CUSTOMER_SALE", document_type: "E_ARCHIVE" }), false);
});

test("rejected return placeholders are hidden until issuance evidence exists", () => {
  const rejectedPlaceholder = {
    customer_id: customerId,
    document_scope: "RETURN",
    document_type: "RETURN",
    status: "FAILED",
    provider_document_id: null,
    ettn_uuid: null,
    invoice_number: null,
    issued_at: null
  };
  assert.equal(isCustomerInvoiceVisible(rejectedPlaceholder), false);
  assert.equal(isCustomerInvoiceVisible({ ...rejectedPlaceholder, status: "ISSUED", issued_at: "2026-08-27T12:00:00Z" }), true);
  assert.equal(isCustomerInvoiceVisible({ ...rejectedPlaceholder, provider_document_id: "provider-return-1" }), true);
});
