export class EInvoicingError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "EInvoicingError";
    this.code = options.code || "E_INVOICING_ERROR";
    this.statusCode = options.statusCode || 400;
    this.retryable = options.retryable === true;
    this.details = options.details || null;
  }
}

export class UnsupportedCapabilityError extends EInvoicingError {
  constructor(provider, capability) {
    super(`${provider} sağlayıcısı ${capability} yeteneğini desteklemiyor.`, {
      code: "CAPABILITY_NOT_SUPPORTED",
      statusCode: 422,
      retryable: false,
      details: { provider, capability }
    });
  }
}

export class ProviderNotConfiguredError extends EInvoicingError {
  constructor(provider, capability) {
    super(`${provider} sağlayıcısının ${capability} uygulaması yapılandırılmadı.`, {
      code: "PROVIDER_NOT_CONFIGURED",
      statusCode: 503,
      retryable: false,
      details: { provider, capability }
    });
  }
}
