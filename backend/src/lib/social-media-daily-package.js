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
  instagram: ["AllonaHub", "DijitalBuyume", "SosyalMedyaYonetimi", "IsletmeSistemi", "SaaSTurkiye"],
  facebook: ["AllonaHub", "KOBI", "DijitalDonusum", "OnlineSatis", "IsletmeBuyutme"],
  threads: ["AllonaHub", "DijitalBuyume", "Girisim"],
  x: ["AllonaHub", "GrowthOps", "SaaS"],
  linkedin: ["AllonaHub", "DigitalOperations", "SaaS", "BusinessGrowth", "SocialMediaManagement"],
  tiktok: ["AllonaHub", "SosyalMedya", "DijitalBuyume", "Girisim", "SaaS"],
  youtube: ["AllonaHub", "Shorts", "DijitalBuyume", "IsletmeYonetimi"],
  pinterest: ["AllonaHub", "DijitalIsletme", "IcerikStratejisi", "SosyalMedyaPlani"],
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

function tags(platform) {
  return PLATFORM_HASHTAGS[platform] || ["AllonaHub", "DijitalBuyume"];
}

function hashtagLine(platform) {
  return tags(platform).map((tag) => `#${tag}`).join(" ");
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

export function buildSocialMediaDailyPackage(options = {}) {
  const planDate = options.planDate || new Date().toISOString().slice(0, 10);
  const objective = options.objective || "growth";
  const landingUrl = options.landingUrl || "https://allonahub.com/";
  const selectedPlatforms = (options.targetPlatforms?.length ? options.targetPlatforms : SOCIAL_MEDIA_PUBLIC_DAILY_PLATFORMS)
    .filter((platform, index, list) => platform && list.indexOf(platform) === index);
  const variant = Number(options.variant || 0);
  const theme = THEMES[(hashSeed(`${planDate}:${objective}`) + variant) % THEMES.length];
  const visualFingerprint = `daily:${planDate}:${theme.key}:v${variant}`;
  const imagePrompt = `Premium AllonaHub social media visual for ${theme.title}, ${theme.visual}, clean modern SaaS interface, no readable text`;
  const platformOverrides = Object.fromEntries(selectedPlatforms.map((platform) => {
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
    target_platforms: selectedPlatforms,
    asset: {
      title: `${planDate} ${theme.title}`,
      asset_type: "image",
      prompt: imagePrompt,
      alt_text: `AllonaHub ${theme.title} gorseli`,
      visual_fingerprint: visualFingerprint,
      platforms: selectedPlatforms.filter((platform) => !["threads", "x", "nsosyal", "telegram", "whatsapp"].includes(platform))
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
      target_platforms: selectedPlatforms,
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
