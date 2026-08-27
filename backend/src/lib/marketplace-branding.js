export const MARKETPLACE_BRANDING_SANITIZER_VERSION = "20260827-platform-branding-cleanup1";

const MARKETPLACE_PLATFORM_TERMS = [
  "trendyol pazaryeri",
  "trendyol marketplace",
  "hepsi burada",
  "hepsiburada",
  "çicek sepeti",
  "çiçek sepeti",
  "cicek sepeti",
  "çiçeksepeti",
  "ciceksepeti",
  "gitti gidiyor",
  "gittigidiyor",
  "ptt avm",
  "pttavm",
  "trendyol",
  "pazarama",
  "woocommerce",
  "shopify",
  "amazon",
  "etsy",
  "n11"
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
}

const marketplacePlatformSource = MARKETPLACE_PLATFORM_TERMS
  .slice()
  .sort((a, b) => b.length - a.length)
  .map(escapeRegExp)
  .join("|");

export const marketplacePlatformPattern = new RegExp(`(^|[^\\p{L}\\p{N}])(?:${marketplacePlatformSource})(?=$|[^\\p{L}\\p{N}])`, "iu");
const marketplacePlatformGlobalPattern = new RegExp(`(^|[^\\p{L}\\p{N}])(?:${marketplacePlatformSource})(?=$|[^\\p{L}\\p{N}])`, "giu");

function removeMarketplaceTerms(value) {
  return String(value || "").replace(marketplacePlatformGlobalPattern, (_match, prefix = "") => {
    if (!prefix || /\s/.test(prefix)) return " ";
    return prefix;
  });
}

export function hasMarketplaceBranding(value) {
  return marketplacePlatformPattern.test(String(value || ""));
}

export function cleanMarketplaceText(value) {
  const cleaned = removeMarketplaceTerms(value)
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([([{])\s+/g, "$1")
    .replace(/\s+([)\]}])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*[-–—:|/]+\s*|\s*[-–—:|/]+\s*$/g, "")
    .trim();
  return cleaned;
}

export function cleanMarketplaceCode(value) {
  const cleaned = removeMarketplaceTerms(value)
    .replace(/\s*([._:/-])\s*/g, "$1")
    .replace(/[._:/-]{2,}/g, "-")
    .replace(/^[._:/-]+|[._:/-]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned;
}

export function cleanMarketplaceFieldValue(value, field = "") {
  const codeFields = new Set([
    "sku",
    "barcode",
    "gtin",
    "ean",
    "external_sku",
    "product_code",
    "stock_code",
    "model_code",
    "variant_id",
    "variant_match_key",
    "variant_group_key"
  ]);
  return codeFields.has(field) ? cleanMarketplaceCode(value) : cleanMarketplaceText(value);
}

export function cleanMarketplaceProductFields(product = {}, fields = []) {
  const next = { ...product };
  const changedFields = [];
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(next, field)) continue;
    const previous = String(next[field] ?? "");
    if (!previous) continue;
    const cleaned = cleanMarketplaceFieldValue(previous, field);
    if (cleaned && cleaned !== previous) {
      next[field] = cleaned;
      changedFields.push(field);
    }
  }
  return { product: next, changedFields };
}
