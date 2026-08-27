export function isCustomerInvoiceVisible(invoice) {
  if (!invoice || invoice.customer_id == null) return false;
  if (invoice.document_scope === "CUSTOMER_SALE") {
    return ["E_INVOICE", "E_ARCHIVE"].includes(invoice.document_type);
  }
  if (invoice.document_scope !== "RETURN" || invoice.document_type !== "RETURN") return false;

  // A return placeholder is an internal workflow record until there is
  // objective provider/issuance evidence. In particular, a safely rejected
  // request must never appear in the customer's invoice history.
  return Boolean(
    invoice.provider_document_id
    || invoice.ettn_uuid
    || invoice.invoice_number
    || invoice.issued_at
  );
}
