import { EInvoicingError } from "./errors.js";

export async function decideDocumentType({ provider, customer = {}, settings = {}, credentials = null, allowProviderQuery = true }) {
  if (!provider) throw new EInvoicingError("Fatura sağlayıcısı zorunludur.", { code: "PROVIDER_REQUIRED" });
  const knownStatus = String(customer.taxpayerStatus || customer.taxpayer_status || "unknown").toLowerCase();
  const verifiedStatus = customer.taxpayerStatusVerified === true || customer.taxpayer_status_verified === true;
  if (verifiedStatus && knownStatus === "e_invoice") {
    return { status: "RESOLVED", documentType: "E_INVOICE", source: "customer_invoice_profile" };
  }
  if (verifiedStatus && ["not_e_invoice", "e_archive"].includes(knownStatus)) {
    return { status: "RESOLVED", documentType: "E_ARCHIVE", source: "customer_invoice_profile" };
  }
  const capabilities = provider.getCapabilities();
  if (allowProviderQuery && capabilities.taxpayerStatus) {
    const result = await provider.checkTaxpayerStatus({ customer, credentials });
    if (result?.known === true && result.registered === true) {
      return { status: "RESOLVED", documentType: "E_INVOICE", source: "provider_taxpayer_query" };
    }
    if (result?.known === true && result.registered === false) {
      return { status: "RESOLVED", documentType: "E_ARCHIVE", source: "provider_taxpayer_query" };
    }
  }

  const fallback = String(settings.documentTypeFallback || settings.document_type_fallback || "MANUAL_REVIEW").toUpperCase();
  if (fallback === "E_INVOICE" || fallback === "E_ARCHIVE") {
    return { status: "RESOLVED", documentType: fallback, source: "configured_fallback" };
  }
  return {
    status: "NEEDS_REVIEW",
    documentType: null,
    source: "manual_review",
    errorCode: "DOCUMENT_TYPE_UNRESOLVED"
  };
}
