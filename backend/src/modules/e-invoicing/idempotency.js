import { createHash } from "node:crypto";
import { EInvoicingError } from "./errors.js";

function requiredSegment(name, value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    throw new EInvoicingError(`${name} idempotency alanı zorunludur.`, {
      code: "IDEMPOTENCY_SCOPE_INCOMPLETE",
      details: { field: name }
    });
  }
  return normalized;
}

export function invoiceIdempotencyKey({ organizationId, sellerId, orderId, subOrderId, documentType }) {
  return [
    "invoice:create",
    requiredSegment("organizationId", organizationId),
    requiredSegment("sellerId", sellerId),
    requiredSegment("orderId", orderId),
    requiredSegment("subOrderId", subOrderId),
    requiredSegment("documentType", documentType)
  ].join(":");
}

export function jobIdempotencyKey({ jobType, invoiceId, organizationId, scope = "v1" }) {
  return [
    "invoice:job",
    requiredSegment("jobType", jobType),
    requiredSegment("organizationId", organizationId),
    requiredSegment("invoiceId", invoiceId),
    requiredSegment("scope", scope)
  ].join(":");
}

export function deterministicHex(value, length = 32) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}
