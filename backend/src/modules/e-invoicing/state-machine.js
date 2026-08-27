import { EInvoicingError } from "./errors.js";

export const INVOICE_STATUSES = Object.freeze([
  "DRAFT", "QUEUED", "PROCESSING", "ISSUED", "SENT", "ACCEPTED", "REJECTED",
  "CANCEL_PENDING", "CANCELLED", "RETURNED", "FAILED", "NEEDS_REVIEW"
]);

const invoiceTransitions = Object.freeze({
  DRAFT: ["QUEUED", "FAILED", "NEEDS_REVIEW"],
  QUEUED: ["PROCESSING", "FAILED", "NEEDS_REVIEW"],
  PROCESSING: ["ISSUED", "FAILED", "NEEDS_REVIEW"],
  ISSUED: ["SENT", "ACCEPTED", "REJECTED", "CANCEL_PENDING", "RETURNED", "NEEDS_REVIEW"],
  SENT: ["ACCEPTED", "REJECTED", "CANCEL_PENDING", "RETURNED", "FAILED", "NEEDS_REVIEW"],
  ACCEPTED: ["CANCEL_PENDING", "RETURNED", "NEEDS_REVIEW"],
  REJECTED: ["NEEDS_REVIEW"],
  CANCEL_PENDING: ["CANCELLED", "FAILED", "NEEDS_REVIEW"],
  CANCELLED: [],
  RETURNED: ["CANCEL_PENDING", "CANCELLED"],
  FAILED: ["QUEUED", "NEEDS_REVIEW"],
  NEEDS_REVIEW: ["DRAFT", "QUEUED", "CANCEL_PENDING", "FAILED"]
});

const workflowTransitions = Object.freeze({
  REQUESTED: ["REVIEW", "QUEUED", "REJECTED", "NEEDS_REVIEW"],
  REVIEW: ["QUEUED", "REJECTED", "NEEDS_REVIEW"],
  QUEUED: ["PROCESSING", "FAILED", "NEEDS_REVIEW"],
  PROCESSING: ["COMPLETED", "FAILED", "NEEDS_REVIEW"],
  COMPLETED: [],
  REJECTED: [],
  FAILED: ["QUEUED", "NEEDS_REVIEW"],
  NEEDS_REVIEW: ["REVIEW", "QUEUED", "REJECTED"]
});

export function canTransitionInvoice(from, to) {
  return from === to || Boolean(invoiceTransitions[from]?.includes(to));
}

export function isStaleProviderStatus(currentStatus, providerStatus) {
  const progress = ["DRAFT", "QUEUED", "PROCESSING", "ISSUED", "SENT", "ACCEPTED"];
  const currentIndex = progress.indexOf(String(currentStatus || "").toUpperCase());
  const providerIndex = progress.indexOf(String(providerStatus || "").toUpperCase());
  if (providerIndex < 0) return false;
  if (["CANCEL_PENDING", "CANCELLED", "RETURNED"].includes(String(currentStatus || "").toUpperCase())) return true;
  return currentIndex >= 0 && currentIndex > providerIndex;
}

export function assertInvoiceTransition(from, to) {
  if (!canTransitionInvoice(from, to)) {
    throw new EInvoicingError(`Geçersiz fatura durum geçişi: ${from} -> ${to}`, {
      code: "INVALID_INVOICE_STATUS_TRANSITION",
      statusCode: 409,
      details: { from, to }
    });
  }
  return to;
}

export function canTransitionWorkflow(from, to) {
  return from === to || Boolean(workflowTransitions[from]?.includes(to));
}

export function assertWorkflowTransition(from, to) {
  if (!canTransitionWorkflow(from, to)) {
    throw new EInvoicingError(`Geçersiz belge iş akışı geçişi: ${from} -> ${to}`, {
      code: "INVALID_DOCUMENT_WORKFLOW_TRANSITION",
      statusCode: 409,
      details: { from, to }
    });
  }
  return to;
}
