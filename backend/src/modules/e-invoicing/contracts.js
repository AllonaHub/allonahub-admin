import { UnsupportedCapabilityError } from "./errors.js";

export const SALES_CHANNEL_CAPABILITY_KEYS = Object.freeze([
  "orders", "returns", "cancellations", "invoiceUpload", "invoiceMetadata",
  "products", "inventory", "prices"
]);

export const INVOICE_PROVIDER_CAPABILITY_KEYS = Object.freeze([
  "taxpayerStatus", "eInvoice", "eArchive", "documentStatus", "pdf", "xml",
  "cancellation", "returns", "webhooks", "idempotentCreate", "synchronousArtifacts"
]);

export function normalizeCapabilities(keys, values = {}) {
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, values[key] === true])));
}

export class SalesChannelProvider {
  constructor(providerKey, capabilities = {}, bridge = {}) {
    this.providerKey = providerKey;
    this.capabilities = normalizeCapabilities(SALES_CHANNEL_CAPABILITY_KEYS, capabilities);
    this.bridge = bridge || {};
  }

  getCapabilities() { return this.capabilities; }
  connectStore(context) { return this.invoke("connectStore", "orders", context); }
  testConnection(context) { return this.invoke("testConnection", null, context); }
  disconnectStore(context) { return this.invoke("disconnectStore", null, context); }
  fetchOrders(context) { return this.invoke("fetchOrders", "orders", context); }
  fetchOrder(context) { return this.invoke("fetchOrder", "orders", context); }
  fetchReturns(context) { return this.invoke("fetchReturns", "returns", context); }
  fetchCancellations(context) { return this.invoke("fetchCancellations", "cancellations", context); }
  pushInvoice(context) { return this.invoke("pushInvoice", "invoiceUpload", context); }
  pushInvoiceMetadata(context) { return this.invoke("pushInvoiceMetadata", "invoiceMetadata", context); }
  syncProducts(context) { return this.invoke("syncProducts", "products", context); }
  syncInventory(context) { return this.invoke("syncInventory", "inventory", context); }
  syncPrices(context) { return this.invoke("syncPrices", "prices", context); }

  invoke(method, capability, context) {
    if (capability && !this.capabilities[capability]) {
      throw new UnsupportedCapabilityError(this.providerKey, capability);
    }
    if (typeof this.bridge[method] !== "function") {
      throw new UnsupportedCapabilityError(this.providerKey, method);
    }
    return this.bridge[method](context);
  }
}

export class InvoiceProvider {
  constructor(providerKey, capabilities = {}) {
    this.providerKey = providerKey;
    this.capabilities = normalizeCapabilities(INVOICE_PROVIDER_CAPABILITY_KEYS, capabilities);
  }

  getCapabilities() { return this.capabilities; }
  unsupported(capability) { throw new UnsupportedCapabilityError(this.providerKey, capability); }
  testConnection() { return this.unsupported("testConnection"); }
  checkTaxpayerStatus() { return this.unsupported("taxpayerStatus"); }
  createEInvoice() { return this.unsupported("eInvoice"); }
  createEArchiveInvoice() { return this.unsupported("eArchive"); }
  getDocumentStatus() { return this.unsupported("documentStatus"); }
  getPdf() { return this.unsupported("pdf"); }
  getXml() { return this.unsupported("xml"); }
  cancelDocument() { return this.unsupported("cancellation"); }
  createReturnDocument() { return this.unsupported("returns"); }
  validateWebhook() { return this.unsupported("webhooks"); }
  processWebhook() { return this.unsupported("webhooks"); }
}
