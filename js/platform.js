(function () {
  const App = window.Allona = window.Allona || {};
  const LANG_KEY = "allona.language";
  const THEME_KEY = "allona.theme";
  const REMOTE_CACHE_PREFIX = "allona.remoteTranslations.";
  const ASSET_VERSION = (() => {
    try {
      const current = document.currentScript && document.currentScript.src;
      return current ? new URL(current, window.location.href).searchParams.get("v") || "20260619-live9" : "20260619-live9";
    } catch (error) {
      return "20260619-live9";
    }
  })();
  const languages = [
    { code: "tr", label: "TR" },
    { code: "az", label: "AZ" },
    { code: "en", label: "EN" },
    { code: "de", label: "DE" },
    { code: "ru", label: "RU" },
    { code: "ar", label: "AR" }
  ];
  const themes = [
    { code: "ocean", label: "Deniz" },
    { code: "sunset", label: "Gün Batımı" },
    { code: "forest", label: "Yeşil" },
    { code: "turquoise", label: "Turkuaz" },
    { code: "white", label: "Beyaz" }
  ];
  const themeAliases = {
    neon: "ocean",
    allona: "ocean",
    marketplace: "forest",
    graphite: "ocean"
  };
  const state = {
    language: localStorage.getItem(LANG_KEY) || "tr",
    theme: themeAliases[localStorage.getItem(THEME_KEY)] || localStorage.getItem(THEME_KEY) || "ocean",
    packs: {}
  };
  const embeddedLanguagePacks = {
    az: {
      dir: "ltr",
      keys: {
        languageLabel: "Dil seçimi"
      },
      phrases: {
        "Dil seçimi": "Dil seçimi",
        "Tema seçimi": "Tema seçimi",
        "AllonaHub güvenli alışveriş ve hizmet ekosistemi": "AllonaHub təhlükəsiz alış-veriş və xidmət ekosistemi",
        "AllonaHub güvenli alışveriş deneyimi": "AllonaHub təhlükəsiz alış-veriş təcrübəsi",
        "Üst bağlantılar": "Üst bağlantılar",
        "Bildirimler": "Bildirişlər",
        "Siparişlerim": "Sifarişlərim",
        "Adreslerim": "Ünvanlarım",
        "Favorilerim": "Sevimlilərim",
        "Favoriler": "Sevimlilər",
        "Sepet": "Səbət",
        "Ödeme": "Ödəniş",
        "Giriş Yap": "Daxil ol",
        "Hesabım": "Hesabım",
        "Profil": "Profil",
        "Menüyü aç": "Menyunu aç",
        "Ana menü": "Əsas menyu",
        "AllonaHub ana sayfa": "AllonaHub ana səhifə",
        "Ürün, kategori, hizmet veya marka ara": "Məhsul, kateqoriya, xidmət və ya brend axtar",
        "Ürün, kategori veya marka ara": "Məhsul, kateqoriya və ya brend axtar",
        "Ürün ara": "Məhsul axtar",
        "Ara": "Axtar",
        "Allona Shop": "Allona Mağaza",
        "Allona Yemek": "Allona Yemək",
        "Allona Market": "Allona Market",
        "Allona Maritime": "Allona Dənizçilik",
        "Allona Denizcilik": "Allona Dənizçilik",
        "Allona East": "Allona Şərq",
        "AllonaHub Ekosistemi": "AllonaHub Ekosistemi",
        "Premium E-Ticaret": "Premium E-ticarət",
        "Premium pazar yeri deneyimi.": "Premium market yeri təcrübəsi.",
        "Seçili ürünleri güvenli ödeme, hızlı sepet ve HP avantajlarıyla keşfedin.": "Seçilmiş məhsulları təhlükəsiz ödəniş, sürətli səbət və HP üstünlükləri ilə kəşf edin.",
        "Yeni üyelere özel alışveriş fırsatları": "Yeni üzvlər üçün xüsusi alış-veriş fürsətləri",
        "Alışverişe Başla": "Alış-verişə başla",
        "Kategori Fırsatları": "Kateqoriya fürsətləri",
        "Elektronikten ev yaşamına hızlı keşif.": "Elektronikadan ev və yaşam məhsullarına sürətli kəşf.",
        "Popüler kategoriler, kampanyalar ve güven veren ürün kartları tek katalogda.": "Populyar kateqoriyalar, kampaniyalar və etibarlı məhsul kartları bir kataloqda.",
        "Güncel stok ve fiyat altyapısı hazır": "Aktual stok və qiymət infrastrukturu hazırdır",
        "Kataloğu Aç": "Kataloqu aç",
        "Teknoloji": "Texnologiya",
        "Yeni gelen ürünleri yakalayın.": "Yeni gələn məhsulları qaçırmayın.",
        "Elektronik, aksesuar ve dijital ürünler için dönüşüm odaklı katalog yapısı.": "Elektronika, aksesuar və rəqəmsal məhsullar üçün satış yönümlü kataloq quruluşu.",
        "Favori, puanlama ve hızlı sepete ekle": "Sevimli, reytinq və sürətli səbətə əlavə et",
        "Teknolojiyi İncele": "Texnologiyanı incələ",
        "Günlük Alışveriş": "Gündəlik alış-veriş",
        "Market, bakım ve ev ihtiyaçları.": "Market, baxım və ev ehtiyacları.",
        "Tek ekranda hızlı karar, net fiyat ve mobil öncelikli alışveriş akışı.": "Tək ekranda sürətli qərar, aydın qiymət və mobil öncəli alış-veriş axını.",
        "Mobilde yatay kaydırmalı kategori deneyimi": "Mobildə üfüqi sürüşdürülən kateqoriya təcrübəsi",
        "Market Ürünleri": "Market məhsulları",
        "HP, kupon ve premium avantaj.": "HP, kupon və premium üstünlük.",
        "Alışveriş motivasyonunu artıran sadakat, kupon ve üyelik alanlarıyla uyumlu.": "Alış-veriş motivasiyasını artıran loyallıq, kupon və üzvlük sahələri ilə uyğundur.",
        "Premium üyeliklerle daha fazla kazanım": "Premium üzvlüklərlə daha çox qazanc",
        "Kupona Git": "Kupona keç",
        "AllonaShop kampanya alanı": "AllonaShop kampaniya sahəsi",
        "Önceki kampanya": "Əvvəlki kampaniya",
        "Sonraki kampanya": "Növbəti kampaniya",
        "Kampanya seçimi": "Kampaniya seçimi",
        "AllonaShop kategorileri": "AllonaShop kateqoriyaları",
        "Trendyol tarzı kategori menüsü": "Trendyol tipli kateqoriya menyusu",
        "Katalog": "Kataloq",
        "Kadın": "Qadın",
        "Erkek": "Kişi",
        "Anne & Çocuk": "Ana və Uşaq",
        "Ev & Yaşam": "Ev və Yaşam",
        "Süpermarket": "Supermarket",
        "Kozmetik": "Kosmetika",
        "Ayakkabı & Çanta": "Ayaqqabı və Çanta",
        "Elektronik": "Elektronika",
        "Saat & Aksesuar": "Saat və Aksesuar",
        "Spor & Outdoor": "İdman və Outdoor",
        "Hızlı Keşif": "Sürətli kəşf",
        "Çok Satanlar": "Ən çox satılanlar",
        "Yeni Gelenler": "Yeni gələnlər",
        "Fırsatlar": "Fürsətlər",
        "Allona Seçkisi": "Allona seçkisi",
        "Popüler": "Populyar",
        "Takı & Aksesuar": "Zinət və aksesuar",
        "Kadın Ürünleri": "Qadın məhsulları",
        "Premium Ürünler": "Premium məhsullar",
        "HP Avantajlı": "HP üstünlüklü",
        "Partner Kataloğu": "Partner kataloqu",
        "Günün Ürünleri": "Günün məhsulları",
        "Kampanyalar": "Kampaniyalar",
        "Yeni Partnerler": "Yeni partnerlər",
        "Seçili Markalar": "Seçilmiş brendlər",
        "Günün katalog ürünleri": "Günün kataloq məhsulları",
        "Partner ürünleri ve kampanyaları tek ekranda keşfet.": "Partner məhsullarını və kampaniyalarını tək ekranda kəşf et.",
        "Kadın kategorileri": "Qadın kateqoriyaları",
        "Giyim": "Geyim",
        "Elbise": "Don",
        "Bluz": "Bluz",
        "Ceket": "Jaket",
        "İç Giyim": "İç geyim",
        "Kolye": "Boyunbağı",
        "Küpe": "Sırğa",
        "Bileklik": "Qolbaq",
        "Saç Aksesuarı": "Saç aksesuarı",
        "Çanta & Ayakkabı": "Çanta və ayaqqabı",
        "Çanta": "Çanta",
        "Topuklu": "Dabanlı ayaqqabı",
        "Sneaker": "Sneaker",
        "Sandalet": "Sandal",
        "Kadın kategorisinde öne çıkanlar": "Qadın kateqoriyasında önə çıxanlar",
        "Takı, aksesuar ve seçili partner koleksiyonları.": "Zinət, aksesuar və seçilmiş partner kolleksiyaları.",
        "Erkek kategorileri": "Kişi kateqoriyaları",
        "Gömlek": "Köynək",
        "T-shirt": "T-shirt",
        "Pantolon": "Şalvar",
        "Mont": "Gödəkçə",
        "Aksesuar": "Aksesuar",
        "Saat": "Saat",
        "Kupon": "Kupon",
        "Kemer": "Kəmər",
        "Gözlük": "Eynək",
        "Ayakkabı": "Ayaqqabı",
        "Günlük Ayakkabı": "Gündəlik ayaqqabı",
        "Spor Ayakkabı": "İdman ayaqqabısı",
        "Bot": "Bot",
        "Klasik": "Klassik",
        "Erkek koleksiyonu": "Kişi kolleksiyası",
        "Giyim, aksesuar ve günlük ürünlere hızlı ulaş.": "Geyim, aksesuar və gündəlik məhsullara sürətli çat.",
        "Anne ve çocuk kategorileri": "Ana və uşaq kateqoriyaları",
        "Bebek": "Körpə",
        "Bebek Giyim": "Körpə geyimi",
        "Bebek Bakım": "Körpə baxımı",
        "Bebek Arabası": "Körpə arabası",
        "Mama": "Uşaq qidası",
        "Çocuk": "Uşaq",
        "Çocuk Giyim": "Uşaq geyimi",
        "Oyuncak": "Oyuncaq",
        "Okul": "Məktəb",
        "Kitap": "Kitab",
        "Anne": "Ana",
        "Anne Ürünleri": "Ana məhsulları",
        "Emzirme": "Əmizdirmə",
        "Hamile": "Hamiləlik",
        "Bakım": "Baxım",
        "Aile alışverişi": "Ailə alış-verişi",
        "Anne, bebek ve çocuk ihtiyaçları aynı menüde.": "Ana, körpə və uşaq ehtiyacları eyni menyudadır.",
        "Ev ve yaşam kategorileri": "Ev və yaşam kateqoriyaları",
        "Ev": "Ev",
        "Mobilya": "Mebel",
        "Dekorasyon": "Dekorasiya",
        "Aydınlatma": "İşıqlandırma",
        "Ev Tekstili": "Ev tekstili",
        "Mutfak": "Mətbəx",
        "Mutfak Gereçleri": "Mətbəx ləvazimatları",
        "Sofra": "Süfrə",
        "Kahve": "Qəhvə",
        "Küçük Ev Aleti": "Kiçik məişət texnikası",
        "Yaşam": "Yaşam",
        "Bahçe": "Bağ",
        "Temizlik": "Təmizlik",
        "Düzenleyici": "Təşkilatçı",
        "Hobi": "Hobbi",
        "Evi yenile": "Evi yenilə",
        "Dekorasyon, mutfak ve günlük yaşam ürünleri.": "Dekorasiya, mətbəx və gündəlik yaşam məhsulları.",
        "Süpermarket kategorileri": "Supermarket kateqoriyaları",
        "Gıda": "Qida",
        "Kahvaltılık": "Səhər yeməyi məhsulları",
        "Atıştırmalık": "Qəlyanaltı",
        "İçecek": "İçki",
        "Organik": "Orqanik",
        "Ev İhtiyaçları": "Ev ehtiyacları",
        "Kağıt Ürünleri": "Kağız məhsulları",
        "Petshop": "Ev heyvanları mağazası",
        "Bebek Bezi": "Uşaq bezi",
        "Kişisel Bakım": "Şəxsi baxım",
        "Hijyen": "Gigiyena",
        "Sağlık": "Sağlamlıq",
        "Vitamin": "Vitamin",
        "Günlük ihtiyaçlar": "Gündəlik ehtiyaclar",
        "Market sepetini hızlı ve düzenli şekilde tamamla.": "Market səbətini sürətli və nizamlı tamamla.",
        "Kozmetik kategorileri": "Kosmetika kateqoriyaları",
        "Makyaj": "Makiyaj",
        "Ruj": "Dodaq boyası",
        "Fondöten": "Tonal krem",
        "Maskara": "Tuş",
        "Allık": "Ənlik",
        "Cilt Bakım": "Dəri baxımı",
        "Saç Bakım": "Saç baxımı",
        "Vücut Bakım": "Bədən baxımı",
        "Güneş Kremi": "Günəş kremi",
        "Parfüm": "Ətir",
        "Kadın Parfüm": "Qadın ətri",
        "Erkek Parfüm": "Kişi ətri",
        "Unisex": "Uniseks",
        "Setler": "Setlər",
        "Bakım kategorileri": "Baxım kateqoriyaları",
        "Güzellik, kişisel bakım ve parfüm kategorileri.": "Gözəllik, şəxsi baxım və ətir kateqoriyaları.",
        "Ayakkabı ve çanta kategorileri": "Ayaqqabı və çanta kateqoriyaları",
        "Omuz Çantası": "Çiyin çantası",
        "Sırt Çantası": "Bel çantası",
        "El Çantası": "Əl çantası",
        "Valiz": "Çamadan",
        "Kartlık": "Kart qabı",
        "Bakım Ürünleri": "Baxım məhsulları",
        "Seyahat": "Səyahət",
        "Stil tamamlayıcıları": "Stili tamamlayanlar",
        "Ayakkabı, çanta ve aksesuarları tek alanda incele.": "Ayaqqabı, çanta və aksesuarları tək sahədə incələ.",
        "Elektronik kategorileri": "Elektronika kateqoriyaları",
        "Telefon": "Telefon",
        "Bilgisayar": "Kompüter",
        "Tablet": "Planşet",
        "Kulaklık": "Qulaqlıq",
        "Şarj Ürünleri": "Şarj məhsulları",
        "Kılıf": "Qoruyucu qab",
        "Akıllı Saat": "Ağıllı saat",
        "Oyun": "Oyun",
        "Ev Elektroniği": "Ev elektronikası",
        "TV": "TV",
        "Ses Sistemi": "Səs sistemi",
        "Akıllı Ev": "Ağıllı ev",
        "Teknoloji fırsatları": "Texnologiya fürsətləri",
        "Elektronik ve aksesuar kampanyalarını yakala.": "Elektronika və aksesuar kampaniyalarını qaçırma.",
        "Saat ve aksesuar kategorileri": "Saat və aksesuar kateqoriyaları",
        "Kadın Saat": "Qadın saatı",
        "Erkek Saat": "Kişi saatı",
        "Spor Saat": "İdman saatı",
        "Şapka": "Papaq",
        "Takı": "Zinət",
        "Yüzük": "Üzük",
        "Halhal": "Ayaq bilərziyi",
        "Detaylarla tamamla": "Detallarla tamamla",
        "Saat, takı ve günlük aksesuarları keşfet.": "Saat, zinət və gündəlik aksesuarları kəşf et.",
        "Spor ve outdoor kategorileri": "İdman və outdoor kateqoriyaları",
        "Spor Giyim": "İdman geyimi",
        "Eşofman": "İdman dəsti",
        "Tayt": "Leggings",
        "Forma": "Forma",
        "Kamp": "Kamp",
        "Bisiklet": "Velosiped",
        "Yürüyüş": "Gəzinti",
        "Deniz Sporları": "Dəniz idmanları",
        "Fitness": "Fitness",
        "Yoga": "Yoqa",
        "Ekipman": "Avadanlıq",
        "Protein": "Protein",
        "Aktif yaşam": "Aktiv həyat",
        "Spor, outdoor ve performans ürünleri.": "İdman, outdoor və performans məhsulları.",
        "Popüler Ürünler": "Populyar məhsullar",
        "Tümünü Gör": "Hamısına bax",
        "Arama": "Axtarış",
        "Ürün, kategori veya marka": "Məhsul, kateqoriya və ya brend",
        "Kategori": "Kateqoriya",
        "Tüm kategoriler": "Bütün kateqoriyalar",
        "Min fiyat": "Minimum qiymət",
        "Max fiyat": "Maksimum qiymət",
        "Sıralama": "Sıralama",
        "En yeni": "Ən yeni",
        "En çok satan": "Ən çox satılan",
        "Fiyat artan": "Qiymət artan",
        "Fiyat azalan": "Qiymət azalan",
        "Yeni": "Yeni",
        "En Çok Satanlar": "Ən çox satılanlar",
        "Seçki": "Seçki",
        "Öne Çıkan Ürünler": "Önə çıxan məhsullar",
        "Favorilerime Git": "Sevimlilərimə keç",
        "Kişisel": "Şəxsi",
        "Sana Özel Öneriler": "Sənin üçün tövsiyələr",
        "Profilimi Güncelle": "Profilimi yenilə",
        "Favoriye ekle": "Sevimlilərə əlavə et",
        "Sepete Ekle": "Səbətə əlavə et",
        "Stok yok": "Stok yoxdur",
        "stok": "stok",
        "İndirim": "Endirim",
        "Fırsat": "Fürsət",
        "Genel": "Ümumi",
        "Ürün": "Məhsul",
        "Özel El İşlemeli Boham": "Xüsusi əl işləməli bohça",
        "Zarif sallantılı Halhal": "Zərif sallanan halhal",
        "Leaf Aura Tasarım Küpe": "Leaf Aura dizayn sırğa",
        "Özel El İşlemeli Yüzük": "Xüsusi əl işləməli üzük",
        "Laura Özel El İşi Kolye": "Laura xüsusi əl işi boyunbağı",
        "ALLONA Etnik Yaprak Detaylı Yüz Aksesuarı": "ALLONA etnik yarpaq detallı üz aksesuarı",
        "Alışveriş": "Alış-veriş",
        "Mağaza": "Mağaza",
        "Ürünler": "Məhsullar",
        "Kuponlar": "Kuponlar",
        "Müşteri": "Müştəri",
        "Hakkımızda": "Haqqımızda",
        "İletişim": "Əlaqə",
        "Destek Merkezi": "Dəstək mərkəzi",
        "Belgelerim": "Sənədlərim",
        "Teslimat ve Kargo": "Çatdırılma və karqo",
        "İade ve Cayma Hakkı": "Qaytarma və imtina hüququ",
        "Ekosistem": "Ekosistem",
        "Tüm Modüller": "Bütün modullar",
        "Partner Başvurusu": "Partner müraciəti",
        "Premium": "Premium",
        "Kariyer": "Karyera",
        "Partner Üyelik": "Partner üzvlüyü",
        "Yasal": "Hüquqi",
        "Mesafeli Satış Sözleşmesi": "Məsafəli satış müqaviləsi",
        "Ön Bilgilendirme Formu": "İlkin məlumat forması",
        "Gizlilik Politikası": "Məxfilik siyasəti",
        "KVKK Aydınlatma Metni": "KVKK məlumatlandırma mətni",
        "Çerez Politikası": "Çərəz siyasəti",
        "Kullanım Şartları": "İstifadə şərtləri",
        "Güvenlik Politikası": "Təhlükəsizlik siyasəti",
        "Tek hesapla alışveriş, hizmet, partner, ödeme ve dijital çözümler.": "Tək hesabla alış-veriş, xidmət, partner, ödəniş və rəqəmsal həllər.",
        "Tüm hakları saklıdır.": "Bütün hüquqlar qorunur.",
        "AllonaHub sosyal medya bağlantıları": "AllonaHub sosial media bağlantıları",
        "AllonaHub mobil uygulama bağlantıları": "AllonaHub mobil tətbiq bağlantıları",
        "App Store'dan indir": "App Store-dan endir",
        "Google Play'den indir": "Google Play-dən endir",
        "Download on the": "Buradan endir",
        "GET IT ON": "Buradan əldə et",
        "App Store": "App Store",
        "Google Play": "Google Play"
      }
    }
  };
  let translationObserver = null;
  let languageRefreshTimer = null;
  let isApplyingLanguage = false;

  function isNestedPage() {
    return /\/(admin|pages|partner)\//.test(window.location.pathname);
  }

  function assetUrl(path) {
    if (App.core && App.core.url) return App.core.url(path);
    if (/^(https?:)?\/\//.test(path) || path.startsWith("mailto:") || path.startsWith("tel:")) return path;
    return `${isNestedPage() ? "../" : ""}${path}`;
  }

  function ensurePlatformCss() {
    if ([...document.querySelectorAll('link[rel="stylesheet"]')].some((link) => (link.getAttribute("href") || "").includes("css/platform.css"))) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = assetUrl(`/css/platform.css?v=${ASSET_VERSION}`);
    document.head.appendChild(link);
  }

  function applyTheme(theme) {
    const normalized = themeAliases[theme] || theme;
    const selected = themes.some((item) => item.code === normalized) ? normalized : "ocean";
    state.theme = selected;
    localStorage.setItem(THEME_KEY, selected);
    document.body.setAttribute("data-theme", selected);
    document.querySelectorAll("[data-theme-select]").forEach((node) => {
      node.value = selected;
    });
    document.querySelectorAll("[data-theme-current]").forEach((node) => {
      node.textContent = currentTheme().label;
    });
    document.querySelectorAll("[data-theme-option]").forEach((node) => {
      node.classList.toggle("is-active", node.dataset.themeOption === selected);
      node.setAttribute("aria-checked", node.dataset.themeOption === selected ? "true" : "false");
    });
  }

  async function loadLanguage(language) {
    const selected = languages.some((item) => item.code === language) ? language : "tr";
    if (state.packs[selected]) return state.packs[selected];
    try {
      const response = await fetch(assetUrl(`/i18n/${selected}.json?v=${ASSET_VERSION}`), { cache: "no-cache" });
      if (!response.ok) throw new Error(`i18n ${selected} ${response.status}`);
      const remotePack = await response.json();
      const embeddedPack = embeddedLanguagePacks[selected] || {};
      const pack = {
        ...embeddedPack,
        ...remotePack,
        keys: { ...(embeddedPack.keys || {}), ...(remotePack.keys || {}) },
        phrases: { ...(embeddedPack.phrases || {}), ...(remotePack.phrases || {}) }
      };
      state.packs[selected] = pack;
      return pack;
    } catch (error) {
      console.warn("AllonaHub language pack could not be loaded:", error.message);
      state.packs[selected] = embeddedLanguagePacks[selected] || { dir: "ltr", phrases: {}, keys: {} };
      return state.packs[selected];
    }
  }

  function shouldSkipTranslateNode(parent) {
    if (!parent) return true;
    if (/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|SELECT|OPTION)$/i.test(parent.tagName)) return true;
    return Boolean(parent.closest("[data-no-translate], .logo-title, .brand__name, .platform-brand-normalized"));
  }

  function shouldSkipTranslateAttribute(node) {
    if (!node) return true;
    if (/^(SCRIPT|STYLE|NOSCRIPT)$/i.test(node.tagName)) return true;
    return Boolean(node.closest("[data-no-translate], .logo-title, .brand__name, .platform-brand-normalized"));
  }

  function ownTextNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (shouldSkipTranslateNode(parent)) return NodeFilter.FILTER_REJECT;
        if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  function normalizePhrase(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function phraseEntries(phrases) {
    if (phrases.__allonaEntries) return phrases.__allonaEntries;
    const entries = Object.entries(phrases)
      .filter(([source, translated]) => source && translated && source !== translated)
      .sort((a, b) => b[0].length - a[0].length);
    Object.defineProperty(phrases, "__allonaEntries", { value: entries, enumerable: false });
    return entries;
  }

  function normalizedPhraseMap(phrases) {
    if (phrases.__allonaNormalized) return phrases.__allonaNormalized;
    const normalized = {};
    Object.entries(phrases).forEach(([source, translated]) => {
      normalized[normalizePhrase(source)] = translated;
    });
    Object.defineProperty(phrases, "__allonaNormalized", { value: normalized, enumerable: false });
    return normalized;
  }

  function translatePhrase(phrases, source) {
    const original = String(source || "");
    const trimmed = original.trim();
    if (!trimmed) return "";
    const direct = phrases[trimmed] || normalizedPhraseMap(phrases)[normalizePhrase(trimmed)];
    if (direct) return direct;

    let translated = trimmed;
    phraseEntries(phrases).forEach(([from, to]) => {
      if (!translated.includes(from)) return;
      translated = translated.split(from).join(to);
    });
    return translated !== trimmed ? translated : "";
  }

  function localizedText(source) {
    const pack = state.packs[state.language] || embeddedLanguagePacks[state.language] || {};
    return translatePhrase(pack.phrases || {}, source) || source;
  }

  function translateExactText(pack) {
    const phrases = pack.phrases || {};
    const roots = document.body ? [document.body] : [];
    roots.forEach((root) => {
      ownTextNodes(root).forEach((node) => {
        if (!node.__allonaSourceText) node.__allonaSourceText = node.textContent;
        const source = node.__allonaSourceText.trim();
        const translated = translatePhrase(phrases, source);
        if (!translated) {
          node.textContent = node.__allonaSourceText;
          return;
        }
        const prefix = node.__allonaSourceText.match(/^\s*/)[0];
        const suffix = node.__allonaSourceText.match(/\s*$/)[0];
        node.textContent = `${prefix}${translated}${suffix}`;
      });
    });

    document.querySelectorAll("option").forEach((node) => {
      if (!node.__allonaSourceText) node.__allonaSourceText = node.textContent;
      const source = node.__allonaSourceText.trim();
      const translated = translatePhrase(phrases, source);
      if (!translated) {
        node.textContent = node.__allonaSourceText;
        return;
      }
      const prefix = node.__allonaSourceText.match(/^\s*/)[0];
      const suffix = node.__allonaSourceText.match(/\s*$/)[0];
      node.textContent = `${prefix}${translated}${suffix}`;
    });

    ["placeholder", "aria-label", "title", "alt"].forEach((attribute) => {
      document.querySelectorAll(`[${attribute}]`).forEach((node) => {
        if (shouldSkipTranslateAttribute(node)) return;
        const key = `__allonaSource_${attribute}`;
        if (!node[key]) node[key] = node.getAttribute(attribute);
        const translated = translatePhrase(phrases, node[key]);
        node.setAttribute(attribute, translated || node[key]);
      });
    });
  }

  function translationEndpoint() {
    return (App.config && App.config.translationEndpoint) || window.ALLONA_TRANSLATION_ENDPOINT || "";
  }

  function sourceTextNodes(pack) {
    const phrases = pack.phrases || {};
    const nodes = [];
    const roots = document.body ? [document.body] : [];
    roots.forEach((root) => {
      ownTextNodes(root).forEach((node) => {
        const source = (node.__allonaSourceText || node.textContent || "").trim();
        if (!source || phrases[source]) return;
        if (source.length < 2 || source.length > 180) return;
        nodes.push({ node, source });
      });
    });
    return nodes;
  }

  function readRemoteCache(language) {
    try {
      return JSON.parse(localStorage.getItem(`${REMOTE_CACHE_PREFIX}${language}`) || "{}");
    } catch (error) {
      return {};
    }
  }

  function writeRemoteCache(language, cache) {
    try {
      localStorage.setItem(`${REMOTE_CACHE_PREFIX}${language}`, JSON.stringify(cache));
    } catch (error) {
      // Translation still works for the current page when storage quota is full.
    }
  }

  function applyRemoteTranslations(nodes, translations) {
    nodes.forEach(({ node, source }) => {
      const translated = translations[source];
      if (!translated) return;
      const original = node.__allonaSourceText || node.textContent;
      const prefix = original.match(/^\s*/)[0];
      const suffix = original.match(/\s*$/)[0];
      node.textContent = `${prefix}${translated}${suffix}`;
    });
  }

  async function translateOnline(language, pack) {
    const endpoint = translationEndpoint();
    if (!endpoint || language === "tr") return;
    const nodes = sourceTextNodes(pack);
    if (!nodes.length) return;
    const cache = readRemoteCache(language);
    applyRemoteTranslations(nodes, cache);
    const missing = [...new Set(nodes.map((item) => item.source).filter((source) => !cache[source]))].slice(0, 80);
    if (!missing.length) return;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "tr", target: language, texts: missing })
      });
      if (!response.ok) throw new Error(`translation endpoint ${response.status}`);
      const payload = await response.json();
      const remote = Array.isArray(payload.translations)
        ? Object.fromEntries(missing.map((source, index) => [source, payload.translations[index]]))
        : (payload.translations || {});
      const nextCache = { ...cache, ...remote };
      writeRemoteCache(language, nextCache);
      applyRemoteTranslations(nodes, nextCache);
    } catch (error) {
      console.warn("AllonaHub online translation fallback failed:", error.message);
    }
  }

  async function applyLanguage(language) {
    const selected = languages.some((item) => item.code === language) ? language : "tr";
    state.language = selected;
    localStorage.setItem(LANG_KEY, selected);
    const pack = await loadLanguage(selected);
    document.documentElement.lang = selected;
    document.documentElement.dir = pack.dir || (selected === "ar" ? "rtl" : "ltr");
    isApplyingLanguage = true;
    try {
      translateExactText(pack);
      await translateOnline(selected, pack);
    } finally {
      isApplyingLanguage = false;
    }
    document.querySelectorAll("[data-language-select]").forEach((node) => {
      node.value = selected;
      node.setAttribute("aria-label", (pack.keys && pack.keys.languageLabel) || "Dil");
    });
    document.querySelectorAll("[data-language-current]").forEach((node) => {
      node.textContent = currentLanguage().label;
    });
    document.querySelectorAll("[data-language-option]").forEach((node) => {
      node.classList.toggle("is-active", node.dataset.languageOption === selected);
      node.setAttribute("aria-checked", node.dataset.languageOption === selected ? "true" : "false");
    });
    document.dispatchEvent(new CustomEvent("allona:language-changed", { detail: { language: selected } }));
  }

  function scheduleLanguageRefresh() {
    if (state.language === "tr" || isApplyingLanguage) return;
    window.clearTimeout(languageRefreshTimer);
    languageRefreshTimer = window.setTimeout(() => {
      applyLanguage(state.language);
    }, 80);
  }

  function startTranslationObserver() {
    if (translationObserver || !document.body) return;
    translationObserver = new MutationObserver((mutations) => {
      if (isApplyingLanguage) return;
      if (mutations.some((mutation) => mutation.addedNodes && mutation.addedNodes.length)) {
        scheduleLanguageRefresh();
      }
    });
    translationObserver.observe(document.body, { childList: true, subtree: true });
  }

  function currentLanguage() {
    return languages.find((item) => item.code === state.language) || languages[0];
  }

  function currentTheme() {
    return themes.find((item) => item.code === state.theme) || themes[0];
  }

  function controlsMarkup(mode) {
    return `
      <div class="platform-controls ${mode === "home" ? "platform-controls--home" : ""}" data-platform-controls>
        <div class="platform-control platform-control--language" data-platform-control>
          <button class="platform-control-btn platform-language-btn" type="button" data-platform-menu-toggle aria-label="Dil seçimi" aria-haspopup="menu" aria-expanded="false">
            <span class="platform-globe" aria-hidden="true"><span></span><span></span><span></span></span>
            <span class="platform-control-value" data-language-current>${currentLanguage().label}</span>
          </button>
          <div class="platform-menu" data-platform-menu role="menu" aria-label="Dil seçimi">
            ${languages.map((item) => `<button type="button" role="menuitemradio" aria-checked="${item.code === state.language ? "true" : "false"}" class="platform-menu-item ${item.code === state.language ? "is-active" : ""}" data-language-option="${item.code}">${item.label}</button>`).join("")}
          </div>
        </div>
        <div class="platform-control platform-control--theme" data-platform-control>
          <button class="platform-control-btn platform-theme-btn" type="button" data-platform-menu-toggle aria-label="Tema seçimi" aria-haspopup="menu" aria-expanded="false">
            <span class="platform-theme-dot" aria-hidden="true"></span>
            <span class="platform-control-value" data-theme-current>${currentTheme().label}</span>
          </button>
          <div class="platform-menu platform-menu--wide" data-platform-menu role="menu" aria-label="Tema seçimi">
            ${themes.map((item) => `<button type="button" role="menuitemradio" aria-checked="${item.code === state.theme ? "true" : "false"}" class="platform-menu-item ${item.code === state.theme ? "is-active" : ""}" data-theme-option="${item.code}"><span class="platform-theme-swatch platform-theme-swatch--${item.code}" aria-hidden="true"></span>${item.label}</button>`).join("")}
          </div>
        </div>
      </div>
    `;
  }

  function brandMarkup() {
    return `
      <img src="${assetUrl("/images/brand/allona.logo.png")}" alt="AllonaHub Logo">
      <span class="logo-title"><span class="gold">Allona</span><span class="blue">Hub</span></span>
    `;
  }

  function normalizeBrandNode(node) {
    if (!node || node.dataset.platformBrand === "ready") return;
    node.dataset.platformBrand = "ready";
    node.classList.add("platform-brand-normalized");
    node.innerHTML = brandMarkup();
    if (node.tagName !== "A") {
      node.setAttribute("role", "link");
      node.setAttribute("tabindex", "0");
      node.addEventListener("click", () => {
        window.location.href = assetUrl("/index.html");
      });
      node.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          window.location.href = assetUrl("/index.html");
        }
      });
    }
  }

  function normalizePlatformBrand() {
    const selectors = [
      "header .logo",
      "header .brand",
      ".header > .logo",
      ".topbar > .logo",
      ".site-header .brand",
      ".page > .header .brand",
      ".header > .brand",
      ".header .brand",
      ".topbar > .brand",
      ".premium-brand",
      ".premium-topbar .premium-brand",
      ".footer-brand"
    ];
    document.querySelectorAll(selectors.join(",")).forEach(normalizeBrandNode);
  }

  function accountLinkCandidates() {
    const selectors = [
      "[data-account-link]",
      "a.login",
      "a[href$='/pages/account/user.html']",
      "a[href$='/pages/account/login.html']"
    ];
    return [...document.querySelectorAll(selectors.join(","))].filter((link) => {
      const text = (link.textContent || "").trim().toLocaleLowerCase("tr-TR");
      const isAccountText = /giriş|login|hesab|kullanıcı girişi/.test(text);
      const isHeaderLink = Boolean(link.closest("header, nav, .header, .actions, .header-actions, .top-links, .top-mini-nav"));
      return link.matches("[data-account-link], a.login") || (isHeaderLink && isAccountText);
    });
  }

  function hasStoredAuthSession() {
    return false;
  }

  async function hasAuthenticatedUser() {
    try {
      if (App.auth && App.auth.getUser) {
        const user = await App.auth.getUser();
        if (user) return true;
      }
      if (App.supabase && App.supabase.auth && App.supabase.auth.getUser) {
        const { data, error } = await App.supabase.auth.getUser();
        if (!error && data && data.user) return true;
      }
    } catch (error) {
      // Header state must not trust stale local storage after password/session changes.
    }
    return hasStoredAuthSession();
  }

  async function updateAccountLinks() {
    const links = accountLinkCandidates();
    if (!links.length) return;
    const loggedIn = await hasAuthenticatedUser();
    if (!loggedIn) {
      links.forEach((link) => {
        link.href = assetUrl("/pages/account/register.html");
        link.textContent = localizedText("Giriş Yap");
        link.setAttribute("aria-label", localizedText("Giriş Yap"));
        link.setAttribute("data-account-link", "");
      });
      return;
    }
    links.forEach((link) => {
      link.href = assetUrl("/pages/account/user-panel.html");
      link.textContent = localizedText("Hesabım");
      link.setAttribute("aria-label", localizedText("Hesabım"));
      link.setAttribute("data-account-link", "");
    });
  }

  function mountControls() {
    if (document.querySelector("[data-platform-controls]")) return;
    const slot = document.querySelector("[data-platform-controls-slot]");
    if (slot) {
      slot.innerHTML = controlsMarkup(slot.dataset.platformControlsSlot || "");
      bindControlValues();
      return;
    }
    const account = accountLinkCandidates()[0];
    if (account) {
      account.insertAdjacentHTML("afterend", controlsMarkup(account.classList.contains("login") ? "home" : ""));
      bindControlValues();
    }
  }

  function bindControlValues() {
    document.querySelectorAll("[data-language-select]").forEach((node) => {
      node.value = state.language;
    });
    document.querySelectorAll("[data-theme-select]").forEach((node) => {
      node.value = state.theme;
    });
    document.querySelectorAll("[data-language-current]").forEach((node) => {
      node.textContent = currentLanguage().label;
    });
    document.querySelectorAll("[data-theme-current]").forEach((node) => {
      node.textContent = currentTheme().label;
    });
  }

  function inferRoute(label) {
    const text = String(label || "").toLocaleLowerCase("tr-TR").trim();
    const rules = [
      [/sepet|ödeme|sipariş/i, "/pages/commerce/cart.html"],
      [/favori/i, "/pages/account/favorites.html"],
      [/adres/i, "/pages/account/addresses.html"],
      [/hesab|panel|kullanıcı paneli/i, "/pages/account/user-panel.html"],
      [/profil|foto|kimlik/i, "/pages/account/profil.html"],
      [/partner|başvuru|restoran partneri|hizmet veren/i, "/pages/partner/partner.html"],
      [/destek|yardım|sss|sıkça/i, "/pages/company/destek.html"],
      [/kampanya|kupon/i, "/pages/commerce/kuponlar.html"],
      [/hp|wallet|kupon|puan/i, "/pages/account/rewards.html"],
      [/gizlilik/i, "/pages/legal/gizlilik.html"],
      [/çerez/i, "/pages/legal/cerez.html"],
      [/kvkk/i, "/pages/legal/kvkk.html"],
      [/kullanım|şart/i, "/pages/legal/kullanim-sartlari.html"],
      [/mesafeli|sözleşme/i, "/pages/legal/mesafeli-satis.html"],
      [/iletişim|bize/i, "/pages/company/iletisim.html"],
      [/modül|hizmet/i, "/pages/ecosystem/ecosystem.html#modules"],
      [/kariyer|iş/i, "/pages/career/allonakariyer.html"],
      [/allona shop|ürün|mağaza/i, "/pages/commerce/allonashop.html"],
      [/yemek|restoran/i, "/pages/commerce/allonayemek.html"],
      [/market/i, "/pages/commerce/allonamarket.html"],
      [/taksi|taxi/i, "/pages/ecosystem/allonataksi.html"]
    ];
    const found = rules.find(([rule]) => rule.test(text));
    if (found) return found[1];
    return `/pages/search/arama.html?q=${encodeURIComponent(label || "AllonaHub")}`;
  }

  function repairEmptyLinks() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest('a[href="#"]');
      if (!link) return;
      event.preventDefault();
      const label = link.textContent.trim() || link.getAttribute("aria-label") || "AllonaHub";
      window.location.href = assetUrl(inferRoute(label));
    });
  }

  function bindEvents() {
    document.addEventListener("change", (event) => {
      const languageSelect = event.target.closest("[data-language-select]");
      if (languageSelect) applyLanguage(languageSelect.value);
      const themeSelect = event.target.closest("[data-theme-select]");
      if (themeSelect) applyTheme(themeSelect.value);
    });
    document.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-platform-menu-toggle]");
      if (toggle) {
        const control = toggle.closest("[data-platform-control]");
        const nextState = !control.classList.contains("is-open");
        closePlatformMenus(control);
        control.classList.toggle("is-open", nextState);
        toggle.setAttribute("aria-expanded", nextState ? "true" : "false");
        return;
      }

      const languageOption = event.target.closest("[data-language-option]");
      if (languageOption) {
        event.preventDefault();
        applyLanguage(languageOption.dataset.languageOption);
        closePlatformMenus();
        return;
      }

      const themeOption = event.target.closest("[data-theme-option]");
      if (themeOption) {
        event.preventDefault();
        applyTheme(themeOption.dataset.themeOption);
        closePlatformMenus();
        return;
      }

      if (!event.target.closest("[data-platform-controls]")) {
        closePlatformMenus();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closePlatformMenus();
    });
    document.addEventListener("allona:layout-ready", () => {
      normalizePlatformBrand();
      mountControls();
      applyTheme(state.theme);
      startTranslationObserver();
      applyLanguage(state.language).then(updateAccountLinks);
      updateAccountLinks();
    });
    document.addEventListener("allona:language-changed", updateAccountLinks);
  }

  function closePlatformMenus(except) {
    document.querySelectorAll("[data-platform-control]").forEach((control) => {
      if (except && control === except) return;
      control.classList.remove("is-open");
      const toggle = control.querySelector("[data-platform-menu-toggle]");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    });
  }

  async function init() {
    ensurePlatformCss();
    normalizePlatformBrand();
    applyTheme(state.theme);
    mountControls();
    repairEmptyLinks();
    startTranslationObserver();
    await applyLanguage(state.language);
    await updateAccountLinks();
  }

  bindEvents();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  App.platform = {
    languages,
    themes,
    setLanguage: applyLanguage,
    setTheme: applyTheme,
    assetUrl
  };
})();
