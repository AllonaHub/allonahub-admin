(function () {
  "use strict";

  const App = window.Allona = window.Allona || {};
  const LANGUAGES = new Set(["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"]);
  const CACHE_VERSION = "v2";
  const sourceByNode = new WeakMap();
  const sourceByAttribute = new WeakMap();
  const sourceRegistry = new Set();
  let timer = 0;
  let observer = null;
  let inflight = null;
  let retryAfter = 0;

  const core = {
    az: {
      "İçeriğe geç": "Məzmuna keç", "Şirket hesabı": "Şirkət hesabı", "Modüle Dön": "Modula qayıt", "Yenile": "Yenilə", "Şirket Profili": "Şirkət profili", "Aktif şirket": "Aktiv şirkət", "Operasyon Merkezi": "Əməliyyat Mərkəzi", "Personel Merkezi": "Heyət Mərkəzi", "İlanlar": "Elanlar", "Gemiler": "Gəmilər", "Bildirimler": "Bildirişlər", "Finans ve Faturalandırma": "Maliyyə və hesab-faktura", "Şirket Hesabı": "Şirkət Hesabı", "Denizcilik şirketi çalışma alanı": "Dənizçilik şirkəti iş sahəsi", "Canlı operasyon": "Canlı əməliyyat", "Yeni İlan Oluştur": "Yeni Elan Yarat", "Hazır Aday Bul": "Hazır Namizəd Tap", "Acil Personel Bul": "Təcili Heyət Tap", "Eşleşmeleri Gör": "Uyğunluqları Gör", "Bekleyen İşlemleri Gör": "Gözləyən İşləri Gör", "Aktif ilan": "Aktiv elan", "Yeni eşleşme": "Yeni uyğunluq", "İncelemede aday": "Baxışda olan namizəd", "Görüşme bekleyen": "Müsahibə gözləyən", "Teklif bekleyen": "Təklif gözləyən", "Son bildirimler": "Son bildirişlər", "Bekleyen görevler": "Gözləyən tapşırıqlar", "Güvenli eşleşmeler": "Təhlükəsiz uyğunluqlar", "Tüm ilanlar": "Bütün elanlar", "İncele": "Bax", "Gör": "Gör", "Planla": "Planlaşdır", "Aç": "Aç"
    },
    kk: {
      "İçeriğe geç": "Мазмұнға өту", "Şirket hesabı": "Компания тіркелгісі", "Modüle Dön": "Модульге қайту", "Yenile": "Жаңарту", "Şirket Profili": "Компания профилі", "Aktif şirket": "Белсенді компания", "Operasyon Merkezi": "Операциялар орталығы", "Personel Merkezi": "Экипаж орталығы", "İlanlar": "Хабарландырулар", "Gemiler": "Кемелер", "Bildirimler": "Хабарламалар", "Finans ve Faturalandırma": "Қаржы және шоттар", "Şirket Hesabı": "Компания тіркелгісі", "Denizcilik şirketi çalışma alanı": "Теңіз компаниясының жұмыс кеңістігі", "Canlı operasyon": "Тікелей операция", "Yeni İlan Oluştur": "Жаңа хабарландыру жасау", "Hazır Aday Bul": "Дайын үміткерді табу", "Acil Personel Bul": "Шұғыл экипаж табу", "Eşleşmeleri Gör": "Сәйкестіктерді көру", "Bekleyen İşlemleri Gör": "Күтудегі істерді көру", "Aktif ilan": "Белсенді хабарландыру", "Yeni eşleşme": "Жаңа сәйкестік", "Son bildirimler": "Соңғы хабарламалар", "Bekleyen görevler": "Күтудегі тапсырмалар", "Güvenli eşleşmeler": "Қауіпсіз сәйкестіктер", "Tüm ilanlar": "Барлық хабарландырулар", "İncele": "Қарау", "Gör": "Көру", "Planla": "Жоспарлау", "Aç": "Ашу"
    },
    uz: {
      "İçeriğe geç": "Kontentga o'tish", "Şirket hesabı": "Kompaniya hisobi", "Modüle Dön": "Modulga qaytish", "Yenile": "Yangilash", "Şirket Profili": "Kompaniya profili", "Aktif şirket": "Faol kompaniya", "Operasyon Merkezi": "Operatsiyalar markazi", "Personel Merkezi": "Ekipaj markazi", "İlanlar": "E'lonlar", "Gemiler": "Kemalar", "Bildirimler": "Bildirishnomalar", "Finans ve Faturalandırma": "Moliya va hisob-faktura", "Şirket Hesabı": "Kompaniya hisobi", "Denizcilik şirketi çalışma alanı": "Dengiz kompaniyasi ish maydoni", "Canlı operasyon": "Jonli operatsiya", "Yeni İlan Oluştur": "Yangi e'lon yaratish", "Hazır Aday Bul": "Tayyor nomzodni topish", "Acil Personel Bul": "Shoshilinch ekipaj topish", "Eşleşmeleri Gör": "Mosliklarni ko'rish", "Bekleyen İşlemleri Gör": "Kutilayotgan ishlarni ko'rish", "Aktif ilan": "Faol e'lon", "Yeni eşleşme": "Yangi moslik", "Son bildirimler": "So'nggi bildirishnomalar", "Bekleyen görevler": "Kutilayotgan vazifalar", "Güvenli eşleşmeler": "Xavfsiz mosliklar", "Tüm ilanlar": "Barcha e'lonlar", "İncele": "Ko'rib chiqish", "Gör": "Ko'rish", "Planla": "Rejalash", "Aç": "Ochish"
    },
    ky: {
      "İçeriğe geç": "Мазмунга өтүү", "Şirket hesabı": "Компаниянын аккаунту", "Modüle Dön": "Модулга кайтуу", "Yenile": "Жаңыртуу", "Şirket Profili": "Компаниянын профили", "Aktif şirket": "Активдүү компания", "Operasyon Merkezi": "Операциялар борбору", "Personel Merkezi": "Экипаж борбору", "İlanlar": "Жарыялар", "Gemiler": "Кемелер", "Bildirimler": "Билдирмелер", "Finans ve Faturalandırma": "Каржы жана эсеп-фактура", "Şirket Hesabı": "Компаниянын аккаунту", "Denizcilik şirketi çalışma alanı": "Деңиз компаниясынын иш аймагы", "Canlı operasyon": "Жандуу операция", "Yeni İlan Oluştur": "Жаңы жарыя түзүү", "Hazır Aday Bul": "Даяр талапкерди табуу", "Acil Personel Bul": "Шашылыш экипаж табуу", "Eşleşmeleri Gör": "Дал келүүлөрдү көрүү", "Bekleyen İşlemleri Gör": "Күтүп жаткан иштерди көрүү", "Aktif ilan": "Активдүү жарыя", "Yeni eşleşme": "Жаңы дал келүү", "Son bildirimler": "Акыркы билдирмелер", "Bekleyen görevler": "Күтүп жаткан тапшырмалар", "Güvenli eşleşmeler": "Коопсуз дал келүүлөр", "Tüm ilanlar": "Бардык жарыялар", "İncele": "Кароо", "Gör": "Көрүү", "Planla": "Пландоо", "Aç": "Ачуу"
    },
    en: {
      "İçeriğe geç": "Skip to content", "Şirket hesabı": "Company account", "Modüle Dön": "Back to Module", "Yenile": "Refresh", "Şirket Profili": "Company Profile", "Aktif şirket": "Active company", "Operasyon Merkezi": "Operations Center", "Personel Merkezi": "Crew Center", "İlanlar": "Jobs", "Gemiler": "Vessels", "Bildirimler": "Notifications", "Finans ve Faturalandırma": "Finance and Billing", "Şirket Hesabı": "Company Account", "Denizcilik şirketi çalışma alanı": "Maritime company workspace", "Canlı operasyon": "Live operations", "Yeni İlan Oluştur": "Create New Job", "Hazır Aday Bul": "Find Ready Candidate", "Acil Personel Bul": "Find Urgent Crew", "Eşleşmeleri Gör": "View Matches", "Bekleyen İşlemleri Gör": "View Pending Tasks", "Aktif ilan": "Active jobs", "Yeni eşleşme": "New matches", "İncelemede aday": "Candidates under review", "Görüşme bekleyen": "Awaiting interview", "Teklif bekleyen": "Awaiting offer", "Son bildirimler": "Latest notifications", "Bekleyen görevler": "Pending tasks", "Güvenli eşleşmeler": "Secure matches", "Tüm ilanlar": "All jobs", "İncele": "Review", "Gör": "View", "Planla": "Plan", "Aç": "Open"
    },
    de: {
      "İçeriğe geç": "Zum Inhalt", "Şirket hesabı": "Unternehmenskonto", "Modüle Dön": "Zurück zum Modul", "Yenile": "Aktualisieren", "Şirket Profili": "Unternehmensprofil", "Aktif şirket": "Aktives Unternehmen", "Operasyon Merkezi": "Betriebszentrum", "Personel Merkezi": "Crew-Zentrum", "İlanlar": "Stellenanzeigen", "Gemiler": "Schiffe", "Bildirimler": "Benachrichtigungen", "Finans ve Faturalandırma": "Finanzen und Abrechnung", "Şirket Hesabı": "Unternehmenskonto", "Denizcilik şirketi çalışma alanı": "Arbeitsbereich des Schifffahrtsunternehmens", "Canlı operasyon": "Live-Betrieb", "Yeni İlan Oluştur": "Neue Stelle erstellen", "Hazır Aday Bul": "Einsatzbereiten Kandidaten finden", "Acil Personel Bul": "Dringend Crew finden", "Eşleşmeleri Gör": "Übereinstimmungen anzeigen", "Bekleyen İşlemleri Gör": "Ausstehende Aufgaben anzeigen", "Aktif ilan": "Aktive Stellen", "Yeni eşleşme": "Neue Übereinstimmung", "Son bildirimler": "Neueste Benachrichtigungen", "Bekleyen görevler": "Ausstehende Aufgaben", "Güvenli eşleşmeler": "Sichere Übereinstimmungen", "Tüm ilanlar": "Alle Stellen", "İncele": "Prüfen", "Gör": "Anzeigen", "Planla": "Planen", "Aç": "Öffnen"
    },
    ru: {
      "İçeriğe geç": "Перейти к содержимому", "Şirket hesabı": "Аккаунт компании", "Modüle Dön": "Вернуться в модуль", "Yenile": "Обновить", "Şirket Profili": "Профиль компании", "Aktif şirket": "Активная компания", "Operasyon Merkezi": "Операционный центр", "Personel Merkezi": "Центр экипажа", "İlanlar": "Вакансии", "Gemiler": "Суда", "Bildirimler": "Уведомления", "Finans ve Faturalandırma": "Финансы и счета", "Şirket Hesabı": "Аккаунт компании", "Denizcilik şirketi çalışma alanı": "Рабочая область морской компании", "Canlı operasyon": "Текущие операции", "Yeni İlan Oluştur": "Создать вакансию", "Hazır Aday Bul": "Найти готового кандидата", "Acil Personel Bul": "Срочно найти экипаж", "Eşleşmeleri Gör": "Посмотреть совпадения", "Bekleyen İşlemleri Gör": "Посмотреть ожидающие задачи", "Aktif ilan": "Активные вакансии", "Yeni eşleşme": "Новые совпадения", "Son bildirimler": "Последние уведомления", "Bekleyen görevler": "Ожидающие задачи", "Güvenli eşleşmeler": "Безопасные совпадения", "Tüm ilanlar": "Все вакансии", "İncele": "Проверить", "Gör": "Посмотреть", "Planla": "Планировать", "Aç": "Открыть"
    },
    ar: {
      "İçeriğe geç": "الانتقال إلى المحتوى", "Şirket hesabı": "حساب الشركة", "Modüle Dön": "العودة إلى الوحدة", "Yenile": "تحديث", "Şirket Profili": "ملف الشركة", "Aktif şirket": "الشركة النشطة", "Operasyon Merkezi": "مركز العمليات", "Personel Merkezi": "مركز الطاقم", "İlanlar": "الوظائف", "Gemiler": "السفن", "Bildirimler": "الإشعارات", "Finans ve Faturalandırma": "المالية والفوترة", "Şirket Hesabı": "حساب الشركة", "Denizcilik şirketi çalışma alanı": "مساحة عمل شركة الملاحة", "Canlı operasyon": "عمليات مباشرة", "Yeni İlan Oluştur": "إنشاء وظيفة جديدة", "Hazır Aday Bul": "العثور على مرشح جاهز", "Acil Personel Bul": "العثور على طاقم عاجل", "Eşleşmeleri Gör": "عرض المطابقات", "Bekleyen İşlemleri Gör": "عرض المهام المعلقة", "Aktif ilan": "الوظائف النشطة", "Yeni eşleşme": "مطابقات جديدة", "Son bildirimler": "أحدث الإشعارات", "Bekleyen görevler": "المهام المعلقة", "Güvenli eşleşmeler": "مطابقات آمنة", "Tüm ilanlar": "كل الوظائف", "İncele": "مراجعة", "Gör": "عرض", "Planla": "تخطيط", "Aç": "فتح"
    }
  };

  const dynamicSources = [
    "Şirket İlanları", "Gemi Ekle", "Yetkili Adaylar", "Aday Detayı", "Başvurular ve İşe Alım Dosyaları", "Şirket Bildirimleri", "Şirket Hesabı", "Doğrulama Şartları", "Havuzu Güncelle", "Kanıt Kontrolü", "Süreç Süreleri", "Dosya Devri", "Güvenli İnceleme", "Doğrulanmış Referans", "Karar ve Değer Merkezi", "Hazır Aday Havuzu", "Akıllı Eşleşmeler", "Acil Personel ve Replacement", "Bekleyen İşlemler", "Görüşmeler", "Teklifler ve Kontratlar", "Aktif Mürettebat", "Relief ve Rehire", "Taslak", "Doğrulanmadı", "Doğrulama bekliyor", "Onay bekliyor", "Doğrulandı", "Yayında", "Açık", "Duraklatıldı", "Düzeltme gerekli", "Arşivlendi", "Kapandı", "İptal", "Pozisyon doldu", "Teklif aşaması", "İşe alındı", "Bekliyor", "Gemi sahibi", "Teknik yönetici", "İşletmeci", "Personel acentesi", "İşveren", "Yetkili temsilci", "Şirket ilişkisi", "Aday", "Denizcilik adayı", "Adayı İncele", "Davet Et", "Eşleşme Nedenini Gör", "Favorilerde", "Favoriye Ekle", "Firma Referanslarını Gör", "Genel Bakış", "Uygunluk", "Belgeler", "Deniz Hizmeti", "Firma Referansları", "İşlem Geçmişi", "İşlemler", "Güven", "Yönetim", "Kural kodu", "Kaynak", "Hassasiyet", "Şirket kuralı", "Resmî kural", "Yalnız metadata", "Standart", "Hassas, aday rızası gerekir", "Resmî kaynak bağlantısı", "Zorunlu", "Gereksinimi kaldır", "Doğrulanmış denizcilik şirketi", "Şirket doğrulama adımları tamamlanmalı", "İlan ve işe alım temsilcisi yetkileriniz güncel.", "Eksik şartları görmek için doğrulama durumunu açın.", "Doğrulanmış denizcilik şirketi çalışma alanı", "Denizcilik şirketi doğrulama çalışma alanı", "Yeni denizcilik ilanı oluştur", "Yeni İlan", "Tek pozisyon", "Toplu İlan", "Birden çok rütbe", "Toplu İlan Oluştur", "Toplu İlanları Oluştur", "Tek işlem, bağımsız ilanlar", "Başka gemi ekle", "Gemi grubu", "Gemi ve ortak sefer koşulları", "Rütbe ilanı", "Rütbe ekle", "Kişi sayısı", "Ortak tercih notu", "Zorunlu ve önerilen sertifikalar", "Gemi konumu ve rota bilgilerini şirket adına doğruluyorum", "İlan oluşturmak için şirket ve temsilci doğrulaması tamamlanmalıdır.", "MariPartner şu anda yüklenemedi. Lütfen tekrar deneyin.", "Panel verileri yenilendi.", "Tüm ilanlar", "Kayıtlı arama seçin", "Size atanmış bekleyen görev bulunmuyor.", "Bu kapsamda güvenli eşleşme bulunmuyor. Yalnız yetkili aday ilişkileri burada gösterilir."
  ];

  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const language = () => {
    const selected = localStorage.getItem("allona.language") || document.documentElement.lang || "tr";
    return LANGUAGES.has(selected) ? selected : "tr";
  };
  const cacheKey = (lang) => `maripartner.uiTranslations.${CACHE_VERSION}.${lang}`;
  const readCache = (lang) => {
    try { return JSON.parse(localStorage.getItem(cacheKey(lang)) || "{}"); }
    catch { return {}; }
  };
  const writeCache = (lang, values) => {
    try { localStorage.setItem(cacheKey(lang), JSON.stringify(values)); }
    catch { /* The current page still keeps translations in memory. */ }
  };
  const shouldSkip = (element) => !element || Boolean(element.closest("[data-no-translate], [data-mp-company-name], [data-mp-company-avatar], [data-mp-count], [data-mp-nav-count], [data-mp-notification-signal], time, code"));

  function rememberAttribute(element, attribute, source) {
    let values = sourceByAttribute.get(element);
    if (!values) { values = {}; sourceByAttribute.set(element, values); }
    values[attribute] = source;
    sourceRegistry.add(source);
  }

  function capture(root) {
    const learnSources = root === document;
    const roots = [root];
    if (root === document) document.querySelectorAll("template").forEach((template) => roots.push(template.content));
    roots.forEach((scope) => {
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const source = normalize(node.textContent);
          if (!source || source.length > 360 || shouldSkip(node.parentElement)) return NodeFilter.FILTER_REJECT;
          if (!learnSources && !sourceRegistry.has(source)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const source = normalize(node.textContent);
        if (!sourceByNode.has(node)) sourceByNode.set(node, source);
        sourceRegistry.add(source);
      }
      scope.querySelectorAll?.("[placeholder], [aria-label], [title], [alt]").forEach((element) => {
        if (shouldSkip(element)) return;
        ["placeholder", "aria-label", "title", "alt"].forEach((attribute) => {
          const source = normalize(element.getAttribute(attribute));
          if (source && source.length <= 360 && (learnSources || sourceRegistry.has(source))) rememberAttribute(element, attribute, source);
        });
      });
    });
    dynamicSources.forEach((source) => sourceRegistry.add(source));
  }

  function nodeSource(node) {
    if (sourceByNode.has(node)) return sourceByNode.get(node);
    const current = normalize(node.textContent);
    if (!sourceRegistry.has(current)) return "";
    sourceByNode.set(node, current);
    return current;
  }

  function translated(source, lang, cache) {
    if (lang === "tr") return source;
    return cache[source] || core[lang]?.[source] || "";
  }

  function apply(root, lang, cache) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) { return shouldSkip(node.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const source = nodeSource(node);
      if (!source) continue;
      const value = translated(source, lang, cache);
      if (!value) continue;
      const original = node.textContent;
      node.textContent = `${original.match(/^\s*/)?.[0] || ""}${value}${original.match(/\s*$/)?.[0] || ""}`;
    }
    root.querySelectorAll?.("[placeholder], [aria-label], [title], [alt]").forEach((element) => {
      if (shouldSkip(element)) return;
      const values = sourceByAttribute.get(element) || {};
      Object.entries(values).forEach(([attribute, source]) => {
        const value = translated(source, lang, cache);
        if (value) element.setAttribute(attribute, value);
      });
    });
  }

  function activeSources(root) {
    const values = new Set();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) { return shouldSkip(node.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    while (walker.nextNode()) {
      const source = nodeSource(walker.currentNode);
      if (source) values.add(source);
    }
    root.querySelectorAll?.("[placeholder], [aria-label], [title], [alt]").forEach((element) => {
      Object.values(sourceByAttribute.get(element) || {}).forEach((source) => values.add(source));
    });
    return [...values];
  }

  async function sessionToken() {
    const session = App.auth?.getSession ? await App.auth.getSession() : null;
    return session?.access_token || "";
  }

  async function fetchMissing(lang, sources, cache) {
    const missing = sources.filter((source) => !cache[source] && !core[lang]?.[source]);
    if (!missing.length || lang === "tr") return cache;
    const token = await sessionToken();
    if (!token) return cache;
    const apiRoot = /^(localhost|127\.0\.0\.1)$/i.test(location.hostname) ? "http://localhost:3000" : String(App.config?.apiBaseUrl || "https://api.allonahub.com").replace(/\/$/, "");
    const endpoint = `${apiRoot}/v1/maritime/partner-center/ui-translations`;
    const chunks = [];
    for (let index = 0; index < missing.length; index += 40) chunks.push(missing.slice(index, index + 40));
    for (let index = 0; index < chunks.length; index += 2) {
      const results = await Promise.all(chunks.slice(index, index + 2).map(async (texts) => {
        const response = await fetch(endpoint, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ target_language: lang, texts }) });
        if (!response.ok) throw new Error(`MARIPARTNER_UI_TRANSLATION_${response.status}`);
        return response.json();
      }));
      results.forEach((payload) => Object.assign(cache, payload.translations || {}));
      writeCache(lang, cache);
      apply(document.body, lang, cache);
    }
    return cache;
  }

  async function refresh(root) {
    const scope = root?.nodeType ? root : document.body;
    capture(scope);
    const lang = language();
    const cache = readCache(lang);
    apply(scope, lang, cache);
    if (lang === "tr" || Date.now() < retryAfter) return;
    if (inflight) return inflight;
    inflight = fetchMissing(lang, activeSources(scope), cache)
      .then(() => apply(scope, lang, cache))
      .catch((error) => {
        retryAfter = Date.now() + 60000;
        console.warn("MariPartner interface translation is temporarily unavailable:", error.message);
      })
      .finally(() => { inflight = null; });
    return inflight;
  }

  function schedule(root) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => refresh(root || document.body), 40);
  }

  function t(source) {
    const clean = normalize(source);
    sourceRegistry.add(clean);
    return translated(clean, language(), readCache(language())) || clean;
  }

  capture(document);
  document.addEventListener("allona:language-changed", () => { retryAfter = 0; schedule(document.body); });
  window.addEventListener("load", () => schedule(document.body), { once: true });
  observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.addedNodes.length)) schedule(document.body);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.MariPartnerI18n = { apply: refresh, t, languages: [...LANGUAGES] };
})();
