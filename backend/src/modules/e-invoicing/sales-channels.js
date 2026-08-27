import { SalesChannelProvider } from "./contracts.js";
import { EInvoicingError } from "./errors.js";

const definitions = Object.freeze({
  trendyol: { displayName: "Trendyol", className: "TrendyolProvider", capabilities: {} },
  hepsiburada: { displayName: "Hepsiburada", className: "HepsiburadaProvider", capabilities: {} },
  n11: { displayName: "N11", className: "N11Provider", capabilities: {} },
  pazarama: { displayName: "Pazarama", className: "PazaramaProvider", capabilities: {} },
  ciceksepeti: { displayName: "Çiçeksepeti", className: "CicekSepetiProvider", capabilities: {} },
  pttavm: { displayName: "PTTAVM", className: "PttAvmProvider", capabilities: {} },
  shopier: { displayName: "Shopier", className: "ShopierProvider", capabilities: {} },
  amazon: { displayName: "Amazon", className: "AmazonProvider", capabilities: {} },
  allonahub: {
    displayName: "AllonaHub Marketplace",
    className: "AllonaHubProvider",
    capabilities: { invoiceMetadata: true }
  },
  allona_shop: {
    displayName: "Allona Shop",
    className: "AllonaHubProvider",
    capabilities: { invoiceMetadata: true }
  },
  custom_api: { displayName: "Custom API", className: "CustomApiProvider", capabilities: {} }
});

export class TrendyolProvider extends SalesChannelProvider {}
export class HepsiburadaProvider extends SalesChannelProvider {}
export class N11Provider extends SalesChannelProvider {}
export class PazaramaProvider extends SalesChannelProvider {}
export class CicekSepetiProvider extends SalesChannelProvider {}
export class PttAvmProvider extends SalesChannelProvider {}
export class ShopierProvider extends SalesChannelProvider {}
export class AmazonProvider extends SalesChannelProvider {}
export class AllonaHubProvider extends SalesChannelProvider {}
export class CustomApiProvider extends SalesChannelProvider {}

const classes = Object.freeze({
  TrendyolProvider,
  HepsiburadaProvider,
  N11Provider,
  PazaramaProvider,
  CicekSepetiProvider,
  PttAvmProvider,
  ShopierProvider,
  AmazonProvider,
  AllonaHubProvider,
  CustomApiProvider
});

export function salesChannelCatalog() {
  return Object.entries(definitions).map(([providerKey, definition]) => {
    const provider = createSalesChannelProvider(providerKey);
    return {
      providerKey,
      displayName: definition.displayName,
      providerClass: definition.className,
      capabilities: provider.getCapabilities(),
      implementation: providerKey === "allonahub" || providerKey === "allona_shop" ? "local_bridge" : "skeleton"
    };
  });
}

export function createSalesChannelProvider(providerKey, bridge = {}) {
  const key = String(providerKey || "").trim().toLowerCase();
  const definition = definitions[key];
  if (!definition) {
    throw new EInvoicingError("Satış kanalı sağlayıcısı tanınmıyor.", {
      code: "UNKNOWN_SALES_CHANNEL_PROVIDER",
      statusCode: 404,
      details: { providerKey: key }
    });
  }
  const ProviderClass = classes[definition.className];
  return new ProviderClass(key, definition.capabilities, bridge);
}

export function effectiveSalesChannelCapabilities(providerKey, overrides = {}) {
  const base = createSalesChannelProvider(providerKey).getCapabilities();
  return Object.fromEntries(Object.entries(base).map(([capability, supported]) => [
    capability,
    supported === true && overrides?.[capability] !== false
  ]));
}
