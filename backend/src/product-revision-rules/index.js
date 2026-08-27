import { marketplacePlatformPattern } from "../lib/marketplace-branding.js";

export const productReviewFieldLabels = {
  name: "Ürün adı",
  product_name: "Ürün adı",
  description: "Açıklama",
  meta_title: "SEO başlığı",
  meta_description: "SEO açıklaması",
  category: "Kategori",
  brand: "Marka",
  sku: "SKU",
  barcode: "Barkod",
  image_url: "Ürün görseli",
  seller_disclosure: "Satıcı bilgilendirme",
  invoice_responsibility: "Fatura sorumluluğu"
};

export { marketplacePlatformPattern };

export const PRODUCT_REVISION_DEFAULT_NOTICE = "Ürün revizyonu gereklidir. Tekrar ürün/varyant, barkod, görsel, açıklama, fiyat, stok, kategori ve otomatik temizlenemeyen dış platform ifadeleri AllonaHub yayın kurallarına göre kontrol edilmelidir.";

export const productReviewPolicyRules = [
  {
    code: "external_marketplace_branding",
    severity: "critical",
    requiresRevision: true,
    fields: ["name", "product_name", "description", "meta_title", "meta_description", "brand", "sku"],
    pattern: marketplacePlatformPattern,
    title: "Dış platform adı içeriyor",
    suggestion: "Otomatik temizlenemeyen dış pazar yeri adını kaldırın; ürün AllonaHub kataloğunda platform bağımsız ve kendi ürün bilgisiyle yayınlanmalı."
  },
  {
    code: "prohibited_or_illegal_terms",
    severity: "critical",
    requiresRevision: true,
    fields: ["name", "product_name", "description", "meta_title", "meta_description", "category", "brand"],
    pattern: /\b(sahte|replika|kaçak|kacak|yasadışı|yasadisi|uyuşturucu|uyusturucu|narkotik|silah|tabanca|tüfek|tufek|patlayıcı|patlayici|çalıntı|calinti|kumar|bahis)\b/i,
    title: "Yasaklı veya hukuki riskli ifade",
    suggestion: "Ürün adı, kategori veya açıklamadaki yasaklı/kaçak/hukuki riskli ifadeyi kaldırıp mevzuata uygun ürün içeriğiyle değiştirin."
  },
  {
    code: "regulated_health_claim",
    severity: "critical",
    requiresRevision: true,
    fields: ["name", "product_name", "description", "meta_title", "meta_description"],
    pattern: /(%100\s*(kesin|garanti)|kesin\s+(çözüm|cozum|tedavi)|mucize|garantili\s+tedavi|doktor\s+onaylı|doktor\s+onayli|bakanlık\s+onaylı|bakanlik\s+onayli|reçetesiz\s+ilaç|recetesiz\s+ilac)/i,
    title: "Sağlık/performans iddiası",
    suggestion: "İspatlanamayan sağlık, tedavi, kesin sonuç veya resmi onay iddialarını açıklamadan çıkarın."
  },
  {
    code: "contact_information_in_content",
    severity: "critical",
    requiresRevision: true,
    fields: ["description", "meta_description", "seller_disclosure"],
    pattern: /((\+?90\s*)?0?\s*5\d{2}[\s().-]*\d{3}[\s().-]*\d{2}[\s().-]*\d{2}|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|https?:\/\/|www\.|wa\.me|whatsapp|telegram|instagram|tiktok|facebook|x\.com|\.com\b|\.net\b|\.org\b)/i,
    title: "Açıklamada harici iletişim/yönlendirme",
    suggestion: "Telefon, e-posta, sosyal medya, WhatsApp veya dış link bilgisini ürün açıklamasından kaldırın; iletişim AllonaHub akışı üzerinden yürümeli."
  },
  {
    code: "return_exchange_payment_bypass",
    severity: "critical",
    requiresRevision: true,
    fields: ["description", "meta_description", "seller_disclosure"],
    pattern: /(iade\s+(yok|kabul\s+edilmez|alınmaz|alinmaz)|değişim\s+(yok|kabul\s+edilmez)|degisim\s+(yok|kabul\s+edilmez)|cayma\s+hakkı\s+yok|cayma\s+hakki\s+yok|kapıda\s+ödeme|kapida\s+odeme|iban|havale|eft|elden\s+ödeme|elden\s+odeme|whatsapp'tan\s+sipariş|whatsapptan\s+siparis)/i,
    title: "İade/değişim veya ödeme akışını bozan ifade",
    suggestion: "İade/değişim yasağı, IBAN/havale/elden ödeme veya platform dışı sipariş yönlendirmesi içeren metni kaldırın."
  },
  {
    code: "violence_or_hate_content",
    severity: "critical",
    requiresRevision: true,
    fields: ["name", "product_name", "description", "meta_title", "meta_description"],
    pattern: /(nefret\s+söylemi|nefret\s+soylemi|ırkçı|irkci|şiddet\s+çağrısı|siddet\s+cagrisi|terör|teror|örgüt|orgut)/i,
    title: "Şiddet/nefret içerik riski",
    suggestion: "Şiddet, nefret veya terör çağrışımı yapan ifadeleri kaldırın ve ürünü hukuka uygun şekilde yeniden tanımlayın."
  }
];

export const productIntegrationRevisionRules = [
  {
    code: "integration_barcode_missing",
    severity: "critical",
    requiresRevision: true,
    field: "barcode",
    title: "Barkod/GTIN eksik",
    message: "Entegrasyonla gelen üründe barkod veya AllonaHub iç referans barkodu yok.",
    suggestion: "Ürüne benzersiz barkod/GTIN veya AllonaHub iç barkodu ekleyin; aynı barkodla ikinci ürün açılmamalı.",
    test: (product) => !String(product.barcode || "").trim()
  },
  {
    code: "integration_category_generic",
    severity: "critical",
    requiresRevision: true,
    field: "category",
    title: "Kategori eşleşmesi net değil",
    message: "Entegrasyonla gelen ürün genel veya boş kategoriyle geldi.",
    suggestion: "Ürünü doğru AllonaHub kategorisine taşıyın.",
    test: (product) => {
      const category = String(product.category || "").trim().toLocaleLowerCase("tr-TR");
      return !category || category === "genel" || category === "general";
    }
  },
  {
    code: "integration_price_missing",
    severity: "critical",
    requiresRevision: true,
    field: "price",
    title: "Fiyat eksik",
    message: "Entegrasyonla gelen ürünün fiyatı yok veya 0 görünüyor.",
    suggestion: "Yayına göndermeden önce satış fiyatını girin.",
    test: (product) => Number(product.price || 0) <= 0
  },
  {
    code: "integration_stock_missing",
    severity: "warning",
    requiresRevision: true,
    field: "stock",
    title: "Stok eksik",
    message: "Entegrasyonla gelen ürünün stoğu yok veya 0 görünüyor.",
    suggestion: "Satışa açılacak ürün için stok bilgisini güncelleyin.",
    test: (product) => Number(product.stock || 0) <= 0
  },
  {
    code: "integration_image_missing",
    severity: "critical",
    requiresRevision: true,
    field: "image_url",
    title: "Görsel eksik",
    message: "Entegrasyonla gelen ürünün ana görseli yok.",
    suggestion: "Ürünün gerçek ana görselini ekleyin; aynı görsel tekrarlarını varyant olarak değil tekrar kayıt olarak ayırın.",
    test: (product) => !String(product.image_url || product.image || "").trim()
  },
  {
    code: "integration_description_short",
    severity: "warning",
    requiresRevision: true,
    field: "description",
    title: "Açıklama yetersiz",
    message: "Entegrasyonla gelen ürün açıklaması müşteri ve onay kontrolü için yetersiz.",
    suggestion: "Ürünün malzeme, kullanım, ölçü, içerik ve satış koşulu bilgisini açıklamaya ekleyin.",
    test: (product) => String(product.description || "").trim().length < 20
  }
];
