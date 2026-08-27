import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { InvoiceProvider } from "./contracts.js";
import { EInvoicingError } from "./errors.js";
import { deterministicHex } from "./idempotency.js";

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function deterministicUuid(seed) {
  const hex = deterministicHex(seed, 32).split("");
  hex[12] = "4";
  hex[16] = ["8", "9", "a", "b"][Number.parseInt(hex[16], 16) % 4];
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function mockInvoiceNumber(seed) {
  const numeric = BigInt(`0x${deterministicHex(seed, 12)}`) % 1_000_000_000n;
  return `MOCK${String(numeric).padStart(9, "0")}`;
}

function buildXml(payload, result) {
  const items = (payload.items || []).map((item, index) => `
    <InvoiceLine>
      <ID>${index + 1}</ID>
      <InvoicedQuantity unitCode="${escapeXml(item.unitCode || "C62")}">${escapeXml(item.quantity)}</InvoicedQuantity>
      <LineExtensionAmount currencyID="${escapeXml(payload.currency)}">${escapeXml(item.lineTotal)}</LineExtensionAmount>
      <Item><Description>${escapeXml(item.description)}</Description></Item>
      <Price><PriceAmount currencyID="${escapeXml(payload.currency)}">${escapeXml(item.unitPrice)}</PriceAmount></Price>
    </InvoiceLine>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <UBLVersionID>2.1</UBLVersionID>
  <ID>${escapeXml(result.invoiceNumber)}</ID>
  <UUID>${escapeXml(result.ettnUuid)}</UUID>
  <IssueDate>${escapeXml(payload.issueDate)}</IssueDate>
  <InvoiceTypeCode>${escapeXml(payload.documentType)}</InvoiceTypeCode>
  <DocumentCurrencyCode>${escapeXml(payload.currency)}</DocumentCurrencyCode>
  <LegalMonetaryTotal>
    <LineExtensionAmount currencyID="${escapeXml(payload.currency)}">${escapeXml(payload.subtotal)}</LineExtensionAmount>
    <TaxExclusiveAmount currencyID="${escapeXml(payload.currency)}">${escapeXml(payload.subtotal)}</TaxExclusiveAmount>
    <TaxInclusiveAmount currencyID="${escapeXml(payload.currency)}">${escapeXml(payload.grandTotal)}</TaxInclusiveAmount>
    <PayableAmount currencyID="${escapeXml(payload.currency)}">${escapeXml(payload.grandTotal)}</PayableAmount>
  </LegalMonetaryTotal>${items}
</Invoice>`;
}

function pdfEscape(value) {
  return String(value).replace(/([\\()])/g, "\\$1").replace(/[^\x20-\x7E]/g, "?");
}

function buildMinimalPdf(lines) {
  const content = ["BT", "/F1 11 Tf", "48 790 Td"];
  lines.forEach((line, index) => {
    if (index) content.push("0 -18 Td");
    content.push(`(${pdfEscape(line)}) Tj`);
  });
  content.push("ET");
  const stream = content.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

function safeEqualHex(expected, received) {
  if (!/^[a-f0-9]{64}$/i.test(String(received || ""))) return false;
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function requireMockPayload(payload) {
  const required = ["idempotencyKey", "documentType", "issueDate", "currency", "subtotal", "grandTotal"];
  const missing = required.filter((key) => !String(payload?.[key] ?? "").trim());
  if (missing.length) {
    throw new EInvoicingError("Mock fatura payload alanları eksik.", {
      code: "INVALID_INVOICE_PAYLOAD",
      statusCode: 422,
      details: { missing }
    });
  }
}

export class MockInvoiceProvider extends InvoiceProvider {
  constructor(options = {}) {
    super("mock", {
      taxpayerStatus: true,
      eInvoice: true,
      eArchive: true,
      documentStatus: true,
      pdf: true,
      xml: true,
      cancellation: true,
      returns: true,
      webhooks: true,
      idempotentCreate: true,
      synchronousArtifacts: true
    });
    this.clock = options.clock || (() => new Date());
  }

  async testConnection() {
    return { ok: true, provider: this.providerKey, environment: "mock", production: false };
  }

  async checkTaxpayerStatus({ customer = {} } = {}) {
    const status = String(customer.taxpayerStatus || customer.taxpayer_status || "unknown").toLowerCase();
    if (status === "e_invoice") return { known: true, registered: true, source: "mock_input" };
    if (["not_e_invoice", "e_archive"].includes(status)) return { known: true, registered: false, source: "mock_input" };
    return { known: false, registered: null, source: "mock_input" };
  }

  async createEInvoice(payload) { return this.createDocument({ ...payload, documentType: "E_INVOICE" }); }
  async createEArchiveInvoice(payload) { return this.createDocument({ ...payload, documentType: "E_ARCHIVE" }); }

  async createDocument(payload) {
    requireMockPayload(payload);
    const seed = `${payload.idempotencyKey}:${payload.documentType}`;
    const result = {
      provider: "mock",
      providerDocumentId: `mock_${deterministicHex(seed, 24)}`,
      ettnUuid: deterministicUuid(seed),
      invoiceNumber: mockInvoiceNumber(seed),
      documentType: payload.documentType,
      status: "ISSUED",
      issueDate: payload.issueDate,
      production: false
    };
    return {
      ...result,
      xml: Buffer.from(buildXml(payload, result), "utf8"),
      pdf: buildMinimalPdf([
        "ALLONAHUB MOCK FATURA - URETIM BELGESI DEGILDIR",
        `Belge: ${result.invoiceNumber}`,
        `ETTN: ${result.ettnUuid}`,
        `Tur: ${result.documentType}`,
        `Tarih: ${payload.issueDate}`,
        `Toplam: ${payload.grandTotal} ${payload.currency}`
      ])
    };
  }

  async getDocumentStatus({ providerDocumentId }) {
    return { providerDocumentId, status: "ISSUED", production: false };
  }

  async getPdf({ document }) {
    if (!document?.pdf) throw new EInvoicingError("Mock PDF bulunamadı.", { code: "MOCK_PDF_NOT_FOUND", statusCode: 404 });
    return Buffer.from(document.pdf);
  }

  async getXml({ document }) {
    if (!document?.xml) throw new EInvoicingError("Mock XML bulunamadı.", { code: "MOCK_XML_NOT_FOUND", statusCode: 404 });
    return Buffer.from(document.xml);
  }

  async cancelDocument({ providerDocumentId, reason }) {
    return { providerDocumentId, status: "CANCELLED", reason: String(reason || "").slice(0, 500), production: false };
  }

  async createReturnDocument(payload) {
    return this.createDocument({ ...payload, documentType: "RETURN" });
  }

  validateWebhook({ rawBody, signature, timestamp, secret, now = this.clock(), toleranceSeconds = 300 }) {
    const eventTime = Number(timestamp);
    const nowSeconds = Math.floor(new Date(now).getTime() / 1000);
    if (!Number.isFinite(eventTime) || Math.abs(nowSeconds - eventTime) > toleranceSeconds) {
      return { valid: false, code: "WEBHOOK_TIMESTAMP_INVALID" };
    }
    if (!secret) return { valid: false, code: "WEBHOOK_SECRET_MISSING" };
    const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ""), "utf8");
    const expected = createHmac("sha256", secret).update(`${eventTime}.`).update(body).digest("hex");
    const received = String(signature || "").replace(/^sha256=/i, "");
    return safeEqualHex(expected, received)
      ? { valid: true, code: null }
      : { valid: false, code: "WEBHOOK_SIGNATURE_INVALID" };
  }

  processWebhook({ payload }) {
    const event = typeof payload === "string" ? JSON.parse(payload) : payload;
    return {
      providerEventId: String(event?.id || event?.event_id || ""),
      providerDocumentId: String(event?.document_id || ""),
      eventType: String(event?.type || "document.status"),
      status: String(event?.status || "").toUpperCase(),
      occurredAt: event?.timestamp || null
    };
  }
}

class SkeletonInvoiceProvider extends InvoiceProvider {
  constructor(providerKey) { super(providerKey, {}); }
}

export class ProviderA extends SkeletonInvoiceProvider { constructor() { super("provider_a"); } }
export class ProviderB extends SkeletonInvoiceProvider { constructor() { super("provider_b"); } }
export class ProviderC extends SkeletonInvoiceProvider { constructor() { super("provider_c"); } }

const providerFactories = Object.freeze({
  mock: (options) => new MockInvoiceProvider(options),
  provider_a: () => new ProviderA(),
  provider_b: () => new ProviderB(),
  provider_c: () => new ProviderC()
});

export function invoiceProviderCatalog() {
  return Object.entries(providerFactories).map(([providerKey, factory]) => {
    const provider = factory();
    return {
      providerKey,
      displayName: providerKey === "mock" ? "Mock Invoice Provider" : providerKey.replace("_", " ").toUpperCase(),
      implementation: providerKey === "mock" ? "mock" : "skeleton",
      productionReady: false,
      capabilities: provider.getCapabilities()
    };
  });
}

export function createInvoiceProvider(providerKey, options = {}) {
  const key = String(providerKey || "").trim().toLowerCase();
  const factory = providerFactories[key];
  if (!factory) {
    throw new EInvoicingError("Fatura sağlayıcısı tanınmıyor.", {
      code: "UNKNOWN_INVOICE_PROVIDER",
      statusCode: 404,
      details: { providerKey: key }
    });
  }
  return factory(options);
}
