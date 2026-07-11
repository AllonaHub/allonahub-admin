export const SOCIAL_MEDIA_PUBLIC_DAILY_PLATFORMS = [
  "instagram",
  "facebook",
  "threads",
  "x",
  "linkedin",
  "tiktok",
  "youtube",
  "pinterest",
  "nsosyal"
];

const THEMES = [
  {
    key: "customer_journey_control",
    title: "Musteri yolculugu tek panelde",
    angle: "kesiften guvene ve aksiyona giden dijital yolculuk",
    promise: "AllonaHub, isletmenin dijital temas noktalarini daha anlasilir ve yonetilebilir hale getirir.",
    visual: "customer journey dashboard with discovery trust action measurement stages"
  },
  {
    key: "approval_growth_ops",
    title: "Onayli sosyal medya operasyonu",
    angle: "taslak, tekrar kontrolu, admin onayi ve planli dagitim",
    promise: "AllonaHub sosyal medya buyumesini kisilere bagli islerden cikarip denetlenebilir bir akis haline getirir.",
    visual: "approval workflow dashboard with draft review queue and multi platform publishing"
  },
  {
    key: "local_business_scale",
    title: "Yerel isletmeler icin dijital olcek",
    angle: "kucuk isletmenin profesyonel dijital operasyon kurmasi",
    promise: "AllonaHub, yerel isletmelerin online gorunurluk, iletisim ve operasyonunu tek ekosistemde toplar.",
    visual: "local business owner using premium SaaS control panel for online growth"
  },
  {
    key: "content_without_repetition",
    title: "Tekrar etmeyen icerik sistemi",
    angle: "ayni metni, ayni anlami ve ayni gorsel fikri tekrar kullanmadan buyume",
    promise: "AllonaHub her taslagi yayin oncesi benzersizlik kontrolunden gecirir.",
    visual: "content uniqueness checker dashboard with captions images and approval status"
  },
  {
    key: "ecosystem_single_source",
    title: "Dijital isler icin tek kaynak",
    angle: "sosyal medya, satis, hizmet ve raporlamanin ayni merkezden yonetilmesi",
    promise: "AllonaHub daginik araclari tek operasyon merkezinde birlestirir.",
    visual: "digital business ecosystem dashboard with commerce services social and reporting modules"
  },
  {
    key: "measurement_before_more_posts",
    title: "Daha cok paylasim degil, daha olculebilir buyume",
    angle: "paylasim sayisindan once sonuc, aksiyon ve takip disiplini",
    promise: "AllonaHub sosyal medya kararlarini plan, onay ve sonuc kayitlariyla takip edilebilir hale getirir.",
    visual: "growth metrics dashboard connected to social media publishing calendar"
  },
  {
    key: "trust_layer",
    title: "Dijital guven katmani",
    angle: "musterinin markayi anlamasi, guvenmesi ve dogru aksiyona gecmesi",
    promise: "AllonaHub isletmelerin guven sinyallerini ve iletisim akisini daha net gostermesine yardim eder.",
    visual: "premium brand trust dashboard with verified signals customer actions and contact cards"
  },
  {
    key: "daily_operating_rhythm",
    title: "Gunluk buyume ritmi",
    angle: "her gun taze, onayli ve platforma gore ayrismis icerik uretimi",
    promise: "AllonaHub sosyal medya disiplinini gunluk is akisi haline getirir.",
    visual: "daily social media operating rhythm dashboard with calendar queue and approval checks"
  }
];

const PLATFORM_TIMES = Object.freeze({
  linkedin: "10:35",
  instagram: "12:20",
  facebook: "14:10",
  threads: "16:05",
  nsosyal: "17:35",
  x: "18:25",
  pinterest: "19:20",
  tiktok: "20:40",
  youtube: "21:10",
  telegram: "17:45",
  whatsapp: "11:30",
  google_business: "15:30"
});

const PLATFORM_HASHTAGS = Object.freeze({
  instagram: ["AllonaHub", "DijitalBuyume", "SosyalMedyaYonetimi", "AllonaShop", "SaaSTurkiye"],
  facebook: ["AllonaHub", "KOBI", "DijitalDonusum", "OnlineSatis", "AllonaShop"],
  threads: ["AllonaHub", "DijitalBuyume", "AllonaShop"],
  x: ["AllonaHub", "GrowthOps", "AllonaShop"],
  linkedin: ["AllonaHub", "DigitalOperations", "SaaS", "BusinessGrowth", "SocialMediaManagement"],
  tiktok: ["AllonaHub", "SosyalMedya", "DijitalBuyume", "AllonaShop", "SaaS"],
  youtube: ["AllonaHub", "Shorts", "DijitalBuyume", "AllonaShop"],
  pinterest: ["AllonaHub", "DijitalIsletme", "IcerikStratejisi", "AllonaShop"],
  nsosyal: ["AllonaHub", "YerliGirisim", "DijitalBuyume"],
  telegram: ["AllonaHub", "DijitalBuyume"],
  whatsapp: ["AllonaHub"],
  google_business: ["AllonaHub", "DijitalBuyume"]
});

function hashSeed(value) {
  let hash = 0;
  for (const char of String(value || "")) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
    hash |= 0;
  }
  return Math.abs(hash);
}

function isoForIstanbul(planDate, time) {
  return `${planDate}T${time}:00+03:00`;
}

function unique(values) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function tags(platform, extraTags = []) {
  return unique([...(PLATFORM_HASHTAGS[platform] || ["AllonaHub", "DijitalBuyume"]), ...extraTags]).slice(0, 12);
}

function hashtagLine(platform, extraTags = []) {
  return tags(platform, extraTags).map((tag) => `#${tag}`).join(" ");
}

function platformType(platform) {
  const types = {
    instagram: "reel",
    facebook: "feed",
    threads: "text",
    x: "text",
    linkedin: "article",
    tiktok: "short",
    youtube: "short",
    pinterest: "pin",
    nsosyal: "text",
    telegram: "text",
    whatsapp: "text",
    google_business: "feed"
  };
  return types[platform] || "feed";
}

function trimText(value, max = 900) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trim()}...`;
}

function absoluteUrl(value, siteUrl) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https:\/\//i.test(raw)) return raw;
  if (/^\/\//.test(raw)) return `https:${raw}`;
  if (/^http:\/\//i.test(raw)) return "";
  const base = String(siteUrl || "https://allonahub.com").replace(/\/$/, "");
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${base}${path}`;
}

function moneyTry(price, currency = "TRY") {
  const amount = Number(price || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: String(currency || "TRY").toUpperCase(),
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency || "TRY"}`;
  }
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function productUrl(product, siteUrl, landingUrl) {
  const preferred = absoluteUrl(landingUrl, siteUrl);
  const siteRoot = String(siteUrl || "https://allonahub.com").replace(/\/$/, "");
  if (preferred && preferred.replace(/\/$/, "") !== siteRoot) return preferred;
  const id = String(product?.id || "").trim();
  if (!id) return preferred || `${siteRoot}/pages/commerce/allonashop.html`;
  const params = new URLSearchParams({ id });
  const slug = String(product?.slug || slugify(product?.name)).trim();
  if (slug) params.set("slug", slug);
  return `${siteRoot}/pages/commerce/product.html?${params.toString()}`;
}

function productTags(product) {
  return unique([
    "AllonaShop",
    product?.module_key ? `Allona${String(product.module_key).replace(/[^a-z0-9]/gi, "")}` : "",
    product?.category,
    product?.brand,
    String(product?.name || "").split(/\s+/).slice(0, 2).join("")
  ].map((tag) => String(tag || "").replace(/[^a-z0-9ığüşöçİĞÜŞÖÇ]/gi, ""))).slice(0, 6);
}

function productSummary(product) {
  return trimText(product?.meta_description || product?.description || `${product?.name || "Urun"} AllonaHub vitrininde incelenebilir.`, 240);
}

function platformProductCaption(platform, product, planDate, landingUrl) {
  const name = trimText(product?.name || "AllonaHub urunu", 120);
  const description = productSummary(product);
  const price = moneyTry(product?.price, product?.currency || "TRY");
  const stockText = Number(product?.stock || 0) > 0 ? "stokta" : "sinirli stok";
  const category = trimText(product?.category || product?.module_key || "AllonaHub", 80);
  const basePrice = price ? ` Fiyat: ${price}.` : "";
  const base = {
    instagram: `${name} bugunun AllonaHub vitrininde.\n\n${description}${basePrice}\n\n${stockText}; detay ve siparis icin urun sayfasina bak.`,
    facebook: `Bugunun urun onerisi: ${name}.\n\n${description}${basePrice} AllonaHub uzerinden detaylari inceleyebilir, uygun oldugunda siparise gecebilirsin.`,
    threads: `Bugunun vitrin urunu: ${name}.\n\n${description}${basePrice}`,
    x: `AllonaHub urun notu (${planDate}): ${name}. ${description}${basePrice}`,
    linkedin: `AllonaHub'da bugunun ticaret odagi ${category} kategorisinden ${name}.\n\n${description}${basePrice} Onayli urun akisimizde vitrin, stok ve satis linki tek operasyon hattinda izlenir.`,
    tiktok: `${name} bugunun kisa urun vitrini. ${description}${basePrice} Detay icin AllonaHub urun sayfasina bak.`,
    youtube: `${name} icin kisa urun tanitimi: ${description}${basePrice} AllonaHub'da detaylari incele.`,
    pinterest: `${name}: ${description}${basePrice} AllonaHub urun vitrini.`,
    nsosyal: `AllonaHub'da bugunun urunu: ${name}. ${description}${basePrice}`,
    telegram: `AllonaHub gunluk urun onerisi: ${name}. ${description}${basePrice} Detay: ${landingUrl}`,
    whatsapp: `AllonaHub urun onerisi: ${name}. Detay: ${landingUrl}`,
    google_business: `${name}: ${description}${basePrice}`
  };
  return base[platform] || `${name}. ${description} ${landingUrl}`;
}

function platformCaption(platform, theme, planDate, landingUrl) {
  const base = {
    instagram: `AllonaHub'da bugunun odagi: ${theme.angle}. Isletmenin dijital buyumesi daha planli, daha kontrollu ve daha olculebilir ilerlemeli.\n\n${theme.promise}`,
    facebook: `Dijital buyume, tek tek paylasim yapmaktan daha fazlasidir. ${theme.promise} Bugunku calismamiz ${theme.angle} uzerine kurulu.\n\nAllonaHub ile hedefimiz, isletmeler icin daha duzenli ve guvenilir bir buyume altyapisi olusturmak.`,
    threads: `Bugunku soru: ${theme.angle} nasil daha sade yonetilir?\n\nAllonaHub'da cevap net: taslak, kontrol, onay ve olculebilir akis.`,
    x: `AllonaHub buyume notu (${planDate}): ${theme.angle}.\n\nDaha az daginiklik. Daha net operasyon. Daha olculebilir sonuc.`,
    linkedin: `AllonaHub'da dijital buyumeyi operasyonel bir disiplin olarak ele aliyoruz. Bugunku odagimiz ${theme.angle}.\n\n${theme.promise} Bu yaklasim, sosyal medya ve dijital varlik yonetimini daha surdurulebilir hale getirir.`,
    tiktok: `Dijitalde buyume sadece gorunmek degil. ${theme.angle} icin sistemi dogru kurmak gerekir. AllonaHub bu akisi tek merkezde toplamak icin gelistiriliyor.`,
    youtube: `AllonaHub ile ${theme.angle} daha yonetilebilir hale geliyor. Bu kisa videoda dijital buyumenin isletme tarafindaki pratik akisina odaklaniyoruz.`,
    pinterest: `${theme.title}: AllonaHub, ${theme.angle} konusunda isletmelere daha duzenli bir dijital operasyon yaklasimi sunar.`,
    nsosyal: `AllonaHub'da bugunku odak: ${theme.angle}. Buyume tek paylasim degil; dogru kurulan ve onaylanan gunluk is akisi.`,
    telegram: `AllonaHub gunluk buyume notu: ${theme.angle}. ${theme.promise}`,
    whatsapp: `AllonaHub gunluk bilgilendirme: ${theme.angle}. Detay: ${landingUrl}`,
    google_business: `${theme.promise} Bugunku odak: ${theme.angle}.`
  };
  return base[platform] || `${theme.promise} ${landingUrl}`;
}

function platformVisual(platform, theme) {
  if (platform === "pinterest") {
    return `Vertical Pinterest infographic, ${theme.visual}, premium SaaS style, clean layout, no readable text`;
  }
  if (platform === "tiktok" || platform === "youtube") {
    return `Short vertical video storyboard, ${theme.visual}, fast UI motion, premium SaaS product demo, no readable text`;
  }
  return `Premium SaaS dashboard visual, ${theme.visual}, realistic modern interface, clean business lighting, no readable text`;
}

function productVisualPrompt(platform, product) {
  const name = trimText(product?.name || "AllonaHub product", 120);
  const category = trimText(product?.category || product?.module_key || "commerce", 80);
  if (platform === "pinterest") {
    return `Vertical product pin for ${name}, ${category} ecommerce product, premium marketplace styling, clean layout, no readable text`;
  }
  if (platform === "tiktok" || platform === "youtube") {
    return `Short vertical product showcase storyboard for ${name}, ecommerce product detail, premium marketplace UI motion, no readable text`;
  }
  return `Premium ecommerce product social visual for ${name}, ${category}, clean product-detail composition, modern marketplace style, no readable text`;
}

function selectedPlatforms(options) {
  return (options.targetPlatforms?.length ? options.targetPlatforms : SOCIAL_MEDIA_PUBLIC_DAILY_PLATFORMS)
    .filter((platform, index, list) => platform && list.indexOf(platform) === index);
}

export function buildProductSocialMediaDailyPackage(options = {}) {
  const product = options.product || {};
  const planDate = options.planDate || new Date().toISOString().slice(0, 10);
  const objective = options.objective || "daily_product";
  const siteUrl = options.siteUrl || "https://allonahub.com";
  const landingUrl = productUrl(product, siteUrl, options.landingUrl);
  const productName = trimText(product.name || "AllonaHub urunu", 120);
  const productImageUrl = absoluteUrl(product.image_url, siteUrl);
  const extraTags = productTags(product);
  const platforms = selectedPlatforms(options);
  const variant = Number(options.variant || 0);
  const visualFingerprint = `product:${product.id || slugify(productName)}`;
  const imagePrompt = productVisualPrompt("instagram", product);
  const description = productSummary(product);
  const platformOverrides = Object.fromEntries(platforms.map((platform) => {
    const scheduled = isoForIstanbul(planDate, PLATFORM_TIMES[platform] || "12:00");
    const caption = platformProductCaption(platform, product, planDate, landingUrl);
    const visualPrompt = productVisualPrompt(platform, product);
    return [platform, {
      caption,
      hashtags: tags(platform, extraTags).map((tag) => `#${tag}`),
      post_type: platformType(platform),
      scheduled_for: scheduled,
      platform_payload: {
        link: landingUrl,
        landing_url: landingUrl,
        image_url: productImageUrl,
        video_url: "",
        visual_concept: `${productName} product showcase`,
        image_prompt: visualPrompt,
        video_prompt: platform === "tiktok" || platform === "youtube" ? visualPrompt : "",
        uniqueness_note: `${planDate} ${platform} product:${product.id || productName} v${variant}; platform-specific caption and prompt.`,
        product_id: product.id || "",
        product_name: productName,
        product_price: product.price ?? null,
        privacy_status: platform === "youtube" ? "public" : undefined,
        privacy_level: platform === "tiktok" ? "PUBLIC_TO_EVERYONE" : undefined,
        action_type: platform === "google_business" ? "LEARN_MORE" : undefined
      }
    }];
  }));

  return {
    plan_date: planDate,
    objective,
    title: `${planDate} ${productName} sosyal medya urun paketi`,
    summary: `${productName}: ${description}`,
    target_platforms: platforms,
    asset: {
      title: `${planDate} ${productName}`,
      asset_type: productImageUrl ? "image" : "image",
      asset_url: productImageUrl,
      prompt: imagePrompt,
      alt_text: `${productName} urun gorseli`,
      visual_fingerprint: visualFingerprint,
      platforms: platforms.filter((platform) => !["threads", "x", "nsosyal", "telegram", "whatsapp"].includes(platform)),
      source_image_url: productImageUrl
    },
    draft: {
      title: `${productName} - ${planDate}`,
      content_theme: `daily_product / ${objective}`,
      hook: `Bugunun urunu: ${productName}.`,
      body: `${description} AllonaHub urun vitrininden stok, fiyat ve detay bilgisiyle yayina hazirlandi.`,
      cta: "Urunu incele",
      landing_url: landingUrl,
      language: "tr",
      scheduled_for: null,
      target_platforms: platforms,
      post_type: "feed",
      hashtags: hashtagLine("instagram", extraTags).split(" "),
      visual_fingerprint: visualFingerprint,
      platform_payload: {
        link: landingUrl,
        landing_url: landingUrl,
        image_url: productImageUrl,
        video_url: "",
        image_prompt: imagePrompt,
        visual_concept: `${productName} product showcase`,
        asset_status: productImageUrl ? "url_ready" : "prompt_ready",
        generated_for_date: planDate,
        product_id: product.id || "",
        product_name: productName
      },
      platform_overrides: platformOverrides,
      metadata: {
        prepared_from: "daily_product_generator",
        plan_date: planDate,
        objective,
        product_id: product.id || "",
        product_name: productName,
        product_category: product.category || "",
        product_module_key: product.module_key || "",
        variant
      }
    }
  };
}

export function buildSocialMediaDailyPackage(options = {}) {
  const planDate = options.planDate || new Date().toISOString().slice(0, 10);
  const objective = options.objective || "growth";
  const landingUrl = options.landingUrl || "https://allonahub.com/";
  const platforms = selectedPlatforms(options);
  const variant = Number(options.variant || 0);
  const theme = THEMES[(hashSeed(`${planDate}:${objective}`) + variant) % THEMES.length];
  const visualFingerprint = `daily:${planDate}:${theme.key}:v${variant}`;
  const imagePrompt = `Premium AllonaHub social media visual for ${theme.title}, ${theme.visual}, clean modern SaaS interface, no readable text`;
  const platformOverrides = Object.fromEntries(platforms.map((platform) => {
    const scheduled = isoForIstanbul(planDate, PLATFORM_TIMES[platform] || "12:00");
    const caption = platformCaption(platform, theme, planDate, landingUrl);
    const visualPrompt = platformVisual(platform, theme);
    return [platform, {
      caption,
      hashtags: tags(platform).map((tag) => `#${tag}`),
      post_type: platformType(platform),
      scheduled_for: scheduled,
      platform_payload: {
        link: landingUrl,
        landing_url: landingUrl,
        image_url: "",
        video_url: "",
        visual_concept: theme.visual,
        image_prompt: visualPrompt,
        video_prompt: platform === "tiktok" || platform === "youtube" ? visualPrompt : "",
        uniqueness_note: `${planDate} ${platform} ${theme.key} v${variant}; platform-specific caption and prompt.`,
        privacy_status: platform === "youtube" ? "public" : undefined,
        privacy_level: platform === "tiktok" ? "PUBLIC_TO_EVERYONE" : undefined,
        action_type: platform === "google_business" ? "LEARN_MORE" : undefined
      }
    }];
  }));

  return {
    plan_date: planDate,
    objective,
    title: `${planDate} AllonaHub sosyal medya buyume paketi`,
    summary: `${theme.title}: ${theme.angle}.`,
    target_platforms: platforms,
    asset: {
      title: `${planDate} ${theme.title}`,
      asset_type: "image",
      asset_url: "",
      prompt: imagePrompt,
      alt_text: `AllonaHub ${theme.title} gorseli`,
      visual_fingerprint: visualFingerprint,
      platforms: platforms.filter((platform) => !["threads", "x", "nsosyal", "telegram", "whatsapp"].includes(platform))
    },
    draft: {
      title: `${theme.title} - ${planDate}`,
      content_theme: `${theme.key} / ${objective}`,
      hook: `Bugunku odak: ${theme.angle}.`,
      body: `${theme.promise} AllonaHub bu yapiyi taslak, onay, planlama ve platforma gore dagitim akisi ile yonetir.`,
      cta: "AllonaHub'u kesfet",
      landing_url: landingUrl,
      language: "tr",
      scheduled_for: null,
      target_platforms: platforms,
      post_type: "feed",
      hashtags: hashtagLine("instagram").split(" "),
      visual_fingerprint: visualFingerprint,
      platform_payload: {
        link: landingUrl,
        landing_url: landingUrl,
        image_url: "",
        video_url: "",
        image_prompt: imagePrompt,
        visual_concept: theme.visual,
        asset_status: "prompt_ready",
        generated_for_date: planDate
      },
      platform_overrides: platformOverrides,
      metadata: {
        prepared_from: "daily_package_generator",
        plan_date: planDate,
        objective,
        theme_key: theme.key,
        theme_title: theme.title,
        variant
      }
    }
  };
}
