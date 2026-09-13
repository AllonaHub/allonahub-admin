(function () {
  "use strict";

  const paymentLabel = {
    tr: "Desteklenen ödeme yöntemleri",
    az: "Dəstəklənən ödəniş üsulları",
    en: "Supported payment methods",
    de: "Unterstützte Zahlungsmethoden",
    ru: "Поддерживаемые способы оплаты",
    ar: "طرق الدفع المدعومة",
    kk: "Қолдау көрсетілетін төлем әдістері",
    uz: "Qo'llab-quvvatlanadigan to'lov usullari",
    ky: "Колдоого алынган төлөм ыкмалары"
  };

  const logos = [
    ["TROY", "https://www.troyodeme.com/upload/cmspagefile/image/anasayfa/TROY-Logo-Tagline.png", "entry-payment-logo--troy"],
    ["Visa", "https://cdn.simpleicons.org/visa/1434CB", ""],
    ["Mastercard", "https://cdn.simpleicons.org/mastercard/EB001B", ""],
    ["American Express", "https://cdn.simpleicons.org/americanexpress/006FCF", ""],
    ["PayPal", "https://cdn.simpleicons.org/paypal/003087", ""],
    ["Google Pay", "https://cdn.simpleicons.org/googlepay/3C4043", ""],
    ["Apple Pay", "https://cdn.simpleicons.org/applepay/000000", ""]
  ];

  const languageCodes = ["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"];
  const footerRows = {
    socialLinksLabel: ["AllonaHub sosyal medya bağlantıları", "AllonaHub sosial media bağlantıları", "AllonaHub әлеуметтік желі сілтемелері", "AllonaHub ijtimoiy tarmoq havolalari", "AllonaHub социалдык тармак шилтемелери", "AllonaHub social media links", "AllonaHub Social-Media-Links", "Ссылки AllonaHub в социальных сетях", "روابط AllonaHub على وسائل التواصل الاجتماعي"],
    footerIntro: ["Tek hesapla alışveriş, hizmet, partner, ödeme ve dijital çözümler.", "Bir hesabla alış-veriş, xidmət, partner, ödəniş və rəqəmsal həllər.", "Бір аккаунтпен сауда, қызмет, серіктестік, төлем және цифрлық шешімдер.", "Bitta hisobda savdo, xizmat, hamkorlik, to‘lov va raqamli yechimlar.", "Бир аккаунтта соода, кызмат, өнөктөштүк, төлөм жана санарип чечимдер.", "Shopping, services, partners, payments, and digital solutions with one account.", "Shopping, Services, Partner, Zahlungen und digitale Lösungen mit einem Konto.", "Покупки, услуги, партнеры, платежи и цифровые решения в одном аккаунте.", "التسوق والخدمات والشركاء والمدفوعات والحلول الرقمية بحساب واحد."],
    footerLocation: ["İstanbul / Türkiye", "İstanbul / Türkiyə", "Ыстамбұл / Түркия", "Istanbul / Turkiya", "Стамбул / Түркия", "Istanbul / Türkiye", "Istanbul / Türkei", "Стамбул / Турция", "إسطنبول / تركيا"],
    shopping: ["Alışveriş", "Alış-veriş", "Сауда", "Xaridlar", "Соода", "Shopping", "Einkaufen", "Покупки", "التسوق"],
    products: ["Ürünler", "Məhsullar", "Өнімдер", "Mahsulotlar", "Товарлар", "Products", "Produkte", "Товары", "المنتجات"],
    allonaFood: ["Allona Yemek", "Allona Yemək", "Allona Тағам", "Allona Taom", "Allona Тамак", "Allona Food", "Allona Food", "Allona Еда", "Allona الطعام"],
    coupons: ["Kuponlar", "Kuponlar", "Купондар", "Kuponlar", "Купондор", "Coupons", "Gutscheine", "Купоны", "القسائم"],
    favorites: ["Favorilerim", "Sevimlilərim", "Таңдаулыларым", "Sevimlilarim", "Тандалмаларым", "Favorites", "Favoriten", "Избранное", "المفضلة"],
    orders: ["Siparişlerim", "Sifarişlərim", "Тапсырыстарым", "Buyurtmalarim", "Буйрутмаларым", "Orders", "Bestellungen", "Заказы", "طلباتي"],
    customer: ["Müşteri", "Müştəri", "Клиент", "Mijoz", "Кардар", "Customer", "Kundenservice", "Клиентам", "العملاء"],
    aboutUs: ["Hakkımızda", "Haqqımızda", "Біз туралы", "Biz haqimizda", "Биз жөнүндө", "About Us", "Über uns", "О нас", "من نحن"],
    contact: ["İletişim", "Əlaqə", "Байланыс", "Aloqa", "Байланыш", "Contact", "Kontakt", "Контакты", "اتصل بنا"],
    supportCenter: ["Destek Merkezi", "Dəstək mərkəzi", "Қолдау орталығы", "Yordam markazi", "Колдоо борбору", "Support Center", "Support-Center", "Центр поддержки", "مركز الدعم"],
    academy: ["AllonaHub Akademi", "AllonaHub Akademiyası", "AllonaHub академиясы", "AllonaHub Akademiyasi", "AllonaHub Академиясы", "AllonaHub Academy", "AllonaHub Akademie", "Академия AllonaHub", "أكاديمية AllonaHub"],
    myDocuments: ["Belgelerim", "Sənədlərim", "Құжаттарым", "Hujjatlarim", "Документтерим", "My Documents", "Meine Dokumente", "Мои документы", "مستنداتي"],
    notifications: ["Bildirimler", "Bildirişlər", "Хабарландырулар", "Bildirishnomalar", "Билдирмелер", "Notifications", "Benachrichtigungen", "Уведомления", "الإشعارات"],
    delivery: ["Teslimat ve Kargo", "Çatdırılma və karqo", "Жеткізу және тасымал", "Yetkazib berish va kargo", "Жеткирүү жана карго", "Delivery and Shipping", "Lieferung und Versand", "Доставка", "التوصيل والشحن"],
    returns: ["İade ve Cayma Hakkı", "Qaytarma və imtina hüququ", "Қайтару және бас тарту құқығы", "Qaytarish va voz kechish huquqi", "Кайтаруу жана баш тартуу укугу", "Returns and Right of Withdrawal", "Rückgabe und Widerruf", "Возврат и право отказа", "الإرجاع وحق العدول"],
    ecosystem: ["Ekosistem", "Ekosistem", "Экожүйе", "Ekotizim", "Экосистема", "Ecosystem", "Ökosystem", "Экосистема", "المنظومة"],
    allModules: ["Tüm Modüller", "Bütün modullar", "Барлық модульдер", "Barcha modullar", "Бардык модулдар", "All Modules", "Alle Module", "Все модули", "كل الوحدات"],
    partnerApplication: ["Partner Başvurusu", "Partner müraciəti", "Серіктестік өтінімі", "Hamkorlik arizasi", "Өнөктөштүк арызы", "Partner Application", "Partnerantrag", "Заявка партнера", "طلب شراكة"],
    coupon: ["Kupon", "Kupon", "Купон", "Kupon", "Купон", "Coupon", "Gutschein", "Купон", "قسيمة"],
    career: ["Kariyer", "Karyera", "Мансап", "Karyera", "Карьера", "Career", "Karriere", "Карьера", "المسار المهني"],
    partnerMembership: ["Partner Üyelik", "Partner üzvlüyü", "Серіктестік мүшелік", "Hamkorlik aʼzoligi", "Өнөктөштүк мүчөлүк", "Partner Membership", "Partnermitgliedschaft", "Партнерское членство", "عضوية الشركاء"],
    legal: ["Yasal", "Hüquqi", "Құқықтық", "Huquqiy", "Укуктук", "Legal", "Rechtliches", "Правовая информация", "قانوني"],
    distanceSales: ["Mesafeli Satış Sözleşmesi", "Məsafəli satış müqaviləsi", "Қашықтан сату шарты", "Masofaviy savdo shartnomasi", "Аралыктан сатуу келишими", "Distance Sales Agreement", "Fernabsatzvertrag", "Договор дистанционной продажи", "اتفاقية البيع عن بُعد"],
    preliminaryInfo: ["Ön Bilgilendirme Formu", "İlkin məlumat forması", "Алдын ала ақпарат нысаны", "Dastlabki maʼlumot shakli", "Алдын ала маалымат формасы", "Preliminary Information Form", "Vorabinformationen", "Форма предварительной информации", "نموذج المعلومات الأولية"],
    privacyPolicy: ["Gizlilik Politikası", "Məxfilik siyasəti", "Құпиялық саясаты", "Maxfiylik siyosati", "Купуялык саясаты", "Privacy Policy", "Datenschutzrichtlinie", "Политика конфиденциальности", "سياسة الخصوصية"],
    kvkkNotice: ["KVKK Aydınlatma Metni", "KVKK məlumatlandırma mətni", "KVKK ақпараттық мәтіні", "KVKK axborot matni", "KVKK маалымат тексти", "KVKK Privacy Notice", "KVKK-Datenschutzhinweis", "Уведомление KVKK", "إشعار KVKK"],
    cookiePolicy: ["Çerez Politikası", "Kuki siyasəti", "Cookie саясаты", "Cookie siyosati", "Cookie саясаты", "Cookie Policy", "Cookie-Richtlinie", "Политика cookies", "سياسة ملفات تعريف الارتباط"],
    terms: ["Kullanım Şartları", "İstifadə şərtləri", "Пайдалану шарттары", "Foydalanish shartlari", "Колдонуу шарттары", "Terms of Use", "Nutzungsbedingungen", "Условия использования", "شروط الاستخدام"],
    securityPolicy: ["Güvenlik Politikası", "Təhlükəsizlik siyasəti", "Қауіпсіздік саясаты", "Xavfsizlik siyosati", "Коопсуздук саясаты", "Security Policy", "Sicherheitsrichtlinie", "Политика безопасности", "سياسة الأمان"],
    trustMark: ["ETBİS ve Güven Damgası", "ETBİS və Güvən nişanı", "ETBİS және Сенім белгісі", "ETBİS va Ishonch belgisi", "ETBİS жана Ишеним белгиси", "ETBIS and Trust Mark", "ETBIS und Vertrauenssiegel", "ETBIS и знак доверия", "ETBIS وعلامة الثقة"],
    trustShort: ["ETBİS/Güven", "ETBİS/Güvən", "ETBİS/Сенім", "ETBİS/Ishonch", "ETBİS/Ишеним", "ETBIS/Trust", "ETBIS/Vertrauen", "ETBIS/Доверие", "ETBIS/الثقة"],
    rightsReserved: ["Tüm hakları saklıdır.", "Bütün hüquqlar qorunur.", "Барлық құқықтар қорғалған.", "Barcha huquqlar himoyalangan.", "Бардык укуктар корголгон.", "All rights reserved.", "Alle Rechte vorbehalten.", "Все права защищены.", "جميع الحقوق محفوظة."]
  };

  function footerCopy(language) {
    const index = Math.max(0, languageCodes.indexOf(language));
    return Object.fromEntries(Object.entries(footerRows).map(function (entry) { return [entry[0], entry[1][index]]; }));
  }

  function setText(node, value) {
    if (node && value && node.textContent !== value) node.textContent = value;
  }

  function localizeFooter(footer) {
    const copy = footerCopy(currentLanguage());
    const columns = Array.from(footer.querySelectorAll(".footer-grid .footer-col"));
    const introParagraphs = columns[0] ? columns[0].querySelectorAll(":scope > p") : [];
    setText(introParagraphs[0], copy.footerIntro);
    setText(introParagraphs[2], copy.footerLocation);
    const mappings = [
      null,
      { title: "shopping", links: ["products", null, "allonaFood", null, "coupons", "favorites", "orders"] },
      { title: "customer", links: ["aboutUs", "contact", "supportCenter", "academy", "myDocuments", "notifications", "delivery", "returns"] },
      { title: "ecosystem", links: ["allModules", "partnerApplication", "coupon", null, "career", "partnerMembership"] },
      { title: "legal", links: ["distanceSales", "preliminaryInfo", "privacyPolicy", "kvkkNotice", "cookiePolicy", "terms", "securityPolicy", "trustMark"] }
    ];
    mappings.forEach(function (mapping, index) {
      if (!mapping || !columns[index]) return;
      setText(columns[index].querySelector("h3"), copy[mapping.title]);
      Array.from(columns[index].querySelectorAll(":scope > a")).forEach(function (link, linkIndex) {
        const key = mapping.links[linkIndex];
        if (key) setText(link, copy[key]);
      });
    });
    const social = footer.querySelector(".social-icons");
    if (social) social.setAttribute("aria-label", copy.socialLinksLabel);
    const bottom = footer.querySelector(".footer-bottom");
    if (bottom) {
      setText(bottom.querySelector(":scope > span:first-child"), `© ${new Date().getFullYear()} AllonaHub. ${copy.rightsReserved}`);
      const keys = ["terms", "privacyPolicy", "cookiePolicy", "trustShort"];
      bottom.querySelectorAll(".footer-bottom__links a").forEach(function (link, index) { setText(link, copy[keys[index]]); });
    }
  }

  function currentLanguage() {
    const selected = String(localStorage.getItem("allona.language") || document.documentElement.lang || "tr").toLowerCase();
    return paymentLabel[selected] ? selected : "tr";
  }

  function logoMarkup(item) {
    return '<span class="mobile-payment-logo entry-payment-logo ' + item[2] + '" role="listitem" aria-label="' + item[0] + '">' +
      '<img src="' + item[1] + '" alt="' + item[0] + '" loading="eager" decoding="async">' +
      '</span>';
  }

  function enhanceFooter() {
    const footer = document.querySelector(".site-footer");
    if (!footer) return false;
    footer.setAttribute("data-no-translate", "");
    const stores = footer.querySelector(".store-buttons");
    if (stores) stores.remove();
    const strip = footer.querySelector(".footer-payment-strip");
    if (strip) {
      if (strip.dataset.entryLogosReady !== "true") {
        strip.dataset.entryLogosReady = "true";
        strip.setAttribute("role", "list");
        strip.innerHTML = logos.map(logoMarkup).join("");
      }
      strip.setAttribute("aria-label", paymentLabel[currentLanguage()]);
    }
    localizeFooter(footer);
    return true;
  }

  function init() {
    if (enhanceFooter()) return;
    const observer = new MutationObserver(function () {
      if (enhanceFooter()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener("allona:language-changed", enhanceFooter);
  document.addEventListener("allona:layout-ready", enhanceFooter);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
