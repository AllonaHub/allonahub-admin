import { platformError } from "./errors.js";

class ProviderContract {
  constructor({ providerKey } = {}) {
    const key = String(providerKey || "").trim().toLowerCase();
    if (!/^[a-z][a-z0-9_.-]{1,79}$/.test(key)) {
      throw new TypeError("A valid providerKey is required");
    }
    this.providerKey = key;
  }

  notImplemented(operation) {
    throw platformError(
      "PROVIDER_OPERATION_NOT_IMPLEMENTED",
      `${this.providerKey} sağlayıcısında ${operation} işlemi uygulanmadı.`,
      501
    );
  }
}

export class PaymentProvider extends ProviderContract {
  authorize() { return this.notImplemented("authorize"); }
  capture() { return this.notImplemented("capture"); }
  refund() { return this.notImplemented("refund"); }
  getStatus() { return this.notImplemented("getStatus"); }
}

export class LogisticsProvider extends ProviderContract {
  quote() { return this.notImplemented("quote"); }
  createShipment() { return this.notImplemented("createShipment"); }
  track() { return this.notImplemented("track"); }
  cancelShipment() { return this.notImplemented("cancelShipment"); }
}

export class FiscalDocumentProvider extends ProviderContract {
  createDocument() { return this.notImplemented("createDocument"); }
  getDocument() { return this.notImplemented("getDocument"); }
  cancelDocument() { return this.notImplemented("cancelDocument"); }
}

export class TaxProvider extends ProviderContract {
  calculate() { return this.notImplemented("calculate"); }
}

export class TranslationProvider extends ProviderContract {
  translate() { return this.notImplemented("translate"); }
}

export class CustomsProvider extends ProviderContract {
  assess() { return this.notImplemented("assess"); }
  getStatus() { return this.notImplemented("getStatus"); }
}

export class CurrencyProvider extends ProviderContract {
  getRate() { return this.notImplemented("getRate"); }
}

export class MarketplaceProvider extends ProviderContract {
  upsertProducts() { return this.notImplemented("upsertProducts"); }
  updateInventory() { return this.notImplemented("updateInventory"); }
  getOrder() { return this.notImplemented("getOrder"); }
}

export const PROVIDER_CONTRACTS = Object.freeze({
  payment: Object.freeze({ Contract: PaymentProvider, methods: ["authorize", "capture", "refund", "getStatus"] }),
  logistics: Object.freeze({ Contract: LogisticsProvider, methods: ["quote", "createShipment", "track", "cancelShipment"] }),
  fiscal_document: Object.freeze({ Contract: FiscalDocumentProvider, methods: ["createDocument", "getDocument", "cancelDocument"] }),
  tax: Object.freeze({ Contract: TaxProvider, methods: ["calculate"] }),
  translation: Object.freeze({ Contract: TranslationProvider, methods: ["translate"] }),
  customs: Object.freeze({ Contract: CustomsProvider, methods: ["assess", "getStatus"] }),
  currency: Object.freeze({ Contract: CurrencyProvider, methods: ["getRate"] }),
  marketplace: Object.freeze({ Contract: MarketplaceProvider, methods: ["upsertProducts", "updateInventory", "getOrder"] })
});

function contractFor(type) {
  const contract = PROVIDER_CONTRACTS[String(type || "").trim()];
  if (!contract) throw new TypeError(`Unknown provider contract: ${type}`);
  return contract;
}

export function assertProviderImplementation(type, implementation) {
  const contract = contractFor(type);
  if (!implementation || typeof implementation !== "object") {
    throw new TypeError(`Provider implementation is required for ${type}`);
  }
  const missing = contract.methods.filter((method) => {
    if (typeof implementation[method] !== "function") return true;
    return implementation[method] === contract.Contract.prototype[method];
  });
  if (missing.length) {
    throw new TypeError(`${type} provider is missing concrete methods: ${missing.join(", ")}`);
  }
  return implementation;
}

export class ProviderRegistry {
  constructor() {
    this.providers = new Map();
  }

  register(type, implementation) {
    const provider = assertProviderImplementation(type, implementation);
    const key = `${type}:${provider.providerKey}`;
    if (this.providers.has(key)) throw new TypeError(`Provider already registered: ${key}`);
    this.providers.set(key, provider);
    return provider;
  }

  get(type, providerKey) {
    return this.providers.get(`${type}:${String(providerKey || "").trim().toLowerCase()}`) || null;
  }

  resolve(type, assignments, { moduleKey = "*", environment = "production" } = {}) {
    const candidates = (assignments || [])
      .filter((assignment) => assignment.provider_type === type)
      .filter((assignment) => assignment.enabled && assignment.environment === environment)
      .filter((assignment) => ["*", moduleKey].includes(assignment.module_key))
      .sort((left, right) => Number(left.priority || 100) - Number(right.priority || 100));
    for (const assignment of candidates) {
      const provider = this.get(type, assignment.provider_key);
      if (provider) return { provider, assignment };
    }
    return null;
  }
}
