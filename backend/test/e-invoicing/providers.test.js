import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createInvoiceProvider, invoiceProviderCatalog } from "../../src/modules/e-invoicing/invoice-providers.js";
import { createSalesChannelProvider, salesChannelCatalog } from "../../src/modules/e-invoicing/sales-channels.js";

const payload = {
  idempotencyKey: "invoice:create:org:seller:order:sub:e_invoice",
  documentType: "E_INVOICE",
  issueDate: "2026-08-27",
  currency: "TRY",
  subtotal: "100.00",
  grandTotal: "120.00",
  items: [{ description: "Test ürün", quantity: "1", unitCode: "C62", unitPrice: "100.0000", lineTotal: "100.00" }]
};

test("mock provider is deterministic and clearly non-production", async () => {
  const provider = createInvoiceProvider("mock");
  const first = await provider.createEInvoice(payload);
  const second = await provider.createEInvoice(payload);
  assert.equal(first.providerDocumentId, second.providerDocumentId);
  assert.equal(first.ettnUuid, second.ettnUuid);
  assert.equal(first.production, false);
  assert.match(first.pdf.toString("utf8", 0, 8), /^%PDF-1\.4/);
  assert.match(first.xml.toString("utf8"), /<Invoice/);
});

test("mock webhook validates timestamp and HMAC", () => {
  const now = new Date("2026-08-27T12:00:00Z");
  const timestamp = Math.floor(now.getTime() / 1000);
  const rawBody = Buffer.from('{"id":"evt-1"}');
  const secret = "unit-test-secret";
  const signature = createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest("hex");
  const result = createInvoiceProvider("mock", { clock: () => now }).validateWebhook({ rawBody, signature, timestamp, secret });
  assert.equal(result.valid, true);
  assert.equal(createInvoiceProvider("mock", { clock: () => now }).validateWebhook({ rawBody, signature, timestamp: timestamp - 999, secret }).valid, false);
});

test("real invoice provider placeholders expose no invented capability", () => {
  const provider = createInvoiceProvider("provider_a");
  assert.equal(Object.values(provider.getCapabilities()).some(Boolean), false);
  assert.throws(() => provider.createEInvoice(payload), /desteklemiyor/);
  assert.equal(invoiceProviderCatalog().find((item) => item.providerKey === "provider_a").productionReady, false);
});

test("sales channel capability catalog is the single conservative source", () => {
  const pazarama = createSalesChannelProvider("pazarama");
  assert.equal(Object.values(pazarama.getCapabilities()).some(Boolean), false);
  assert.throws(() => pazarama.fetchOrders({}), /desteklemiyor/);
  const local = createSalesChannelProvider("allonahub", { pushInvoiceMetadata: () => ({ accepted: true, persisted: true }) });
  assert.equal(local.getCapabilities().invoiceMetadata, true);
  assert.equal(local.getCapabilities().orders, false);
  assert.throws(() => local.fetchOrders({}), /desteklemiyor/);
  assert.equal(salesChannelCatalog().some((item) => item.providerKey === "amazon"), true);
});
