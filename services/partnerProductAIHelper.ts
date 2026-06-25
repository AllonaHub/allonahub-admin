export type ProductDraft = {
  name?: string;
  description?: string;
  category?: string;
  price?: number;
  stock?: number;
  sku?: string;
  barcode?: string;
  shipping_info?: string;
  seo_description?: string;
};

export class PartnerProductAIHelper {
  constructor(private draft: ProductDraft) {}

  suggestTitle() {
    const base = this.draft.name?.trim() || "Yeni AllonaHub Urunu";
    if (base.length >= 10) return base;
    return `${base} - Guvenilir ve Hizli Teslimat`;
  }

  suggestDescription() {
    const description = this.draft.description?.trim() || "";
    if (description.length > 100) return description;
    return `${description} Urunun temel avantajlarini, kullanim alanini, teslimat bilgisini ve kalite farkini net bicimde anlatin.`.trim();
  }

  suggestKeywords() {
    return [
      this.draft.category,
      this.draft.name,
      "allonahub",
      "guvenilir partner",
      "hizli teslimat"
    ].filter(Boolean).map((item) => String(item).toLocaleLowerCase("tr-TR"));
  }

  suggestCategory() {
    const text = `${this.draft.name || ""} ${this.draft.description || ""}`.toLocaleLowerCase("tr-TR");
    if (/telefon|kulaklik|kamera|laptop|bilgisayar/.test(text)) return "Elektronik";
    if (/bebek|anne|oyuncak/.test(text)) return "Anne & Bebek";
    if (/spor|outdoor|fitness/.test(text)) return "Spor & Outdoor";
    if (/kozmetik|parfum|bakim/.test(text)) return "Kozmetik";
    if (/oto|arac|aksesuar/.test(text)) return "Otomotiv Aksesuar";
    return this.draft.category || "Ev & Yasam";
  }

  detectMissingFields() {
    const missing: string[] = [];
    if (!this.draft.name || this.draft.name.length <= 10) missing.push("Urun adi en az 10 karakter olmali.");
    if (!this.draft.description || this.draft.description.length <= 100) missing.push("Aciklama 100 karakterden uzun olmali.");
    if (!this.draft.price || this.draft.price <= 0) missing.push("Fiyat girilmeli.");
    if (this.draft.stock === undefined || this.draft.stock === null) missing.push("Stok bilgisi girilmeli.");
    if (!this.draft.sku && !this.draft.barcode) missing.push("SKU veya barkod eklenmeli.");
    if (!this.draft.shipping_info) missing.push("Kargo/teslimat bilgisi eklenmeli.");
    if (!this.draft.seo_description) missing.push("SEO aciklamasi eklenmeli.");
    return missing;
  }
}
