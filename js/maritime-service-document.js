(function () {
  "use strict";

  const App = window.Allona = window.Allona || {};
  const languages = new Set(["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"]);
  const copy = {
    tr:{ maritime:"Denizcilik",back:"Geri Dön",home:"Ana Sayfa",module:"Modüle Dön",secure:"Güvenli belge görüntüleme",title:"Hizmet Belgesi",lead:"Bu belge yalnızca belge sahibi, yetkili yönetici veya aktif işe alım sürecindeki firma tarafından görüntülenebilir.",open:"Yeni sekmede aç",loading:"Belge için güvenli erişim hazırlanıyor...",loginTitle:"Giriş gerekli",loginLead:"Belgeyi görüntülemek için ilgili hesabınızla giriş yapın.",userLogin:"Denizci girişi",partnerLogin:"Firma girişi",errorTitle:"Belge açılamadı",retry:"Tekrar dene",invalid:"Belge bağlantısı geçersiz.",denied:"Bu belgeyi görüntüleme yetkiniz bulunmuyor.",failed:"Belge şu anda açılamadı. Lütfen tekrar deneyin."},
    az:{ maritime:"Dənizçilik",back:"Geri qayıt",home:"Ana səhifə",module:"Modula qayıt",secure:"Təhlükəsiz sənəd görüntüləmə",title:"Dəniz xidməti sənədi",lead:"Bu sənədi yalnız sənəd sahibi, səlahiyyətli idarəçi və ya aktiv işə qəbul prosesində olan şirkət görə bilər.",open:"Yeni vərəqdə aç",loading:"Sənəd üçün təhlükəsiz giriş hazırlanır...",loginTitle:"Giriş tələb olunur",loginLead:"Sənədi görmək üçün uyğun hesabla daxil olun.",userLogin:"Dənizçi girişi",partnerLogin:"Şirkət girişi",errorTitle:"Sənəd açıla bilmədi",retry:"Yenidən cəhd et",invalid:"Sənəd keçidi etibarsızdır.",denied:"Bu sənədi görmək icazəniz yoxdur.",failed:"Sənəd hazırda açıla bilmədi."},
    kk:{ maritime:"Теңіз қызметі",back:"Артқа",home:"Басты бет",module:"Модульге оралу",secure:"Қауіпсіз құжат қарау",title:"Теңіз қызметі туралы құжат",lead:"Бұл құжатты тек иесі, уәкілетті әкімші немесе белсенді жұмысқа қабылдау үдерісіндегі компания қарай алады.",open:"Жаңа бетте ашу",loading:"Қауіпсіз кіру дайындалуда...",loginTitle:"Кіру қажет",loginLead:"Құжатты көру үшін тиісті есептік жазбамен кіріңіз.",userLogin:"Теңізші кіруі",partnerLogin:"Компания кіруі",errorTitle:"Құжат ашылмады",retry:"Қайталау",invalid:"Құжат сілтемесі жарамсыз.",denied:"Бұл құжатты көруге рұқсатыңыз жоқ.",failed:"Құжат қазір ашылмады."},
    uz:{ maritime:"Dengizchilik",back:"Orqaga",home:"Bosh sahifa",module:"Modulga qaytish",secure:"Xavfsiz hujjat ko'rish",title:"Dengiz xizmati hujjati",lead:"Bu hujjatni faqat egasi, vakolatli administrator yoki faol ishga qabul jarayonidagi kompaniya ko'ra oladi.",open:"Yangi oynada ochish",loading:"Xavfsiz kirish tayyorlanmoqda...",loginTitle:"Kirish kerak",loginLead:"Hujjatni ko'rish uchun tegishli hisob bilan kiring.",userLogin:"Dengizchi kirishi",partnerLogin:"Kompaniya kirishi",errorTitle:"Hujjat ochilmadi",retry:"Qayta urinish",invalid:"Hujjat havolasi noto'g'ri.",denied:"Bu hujjatni ko'rish huquqingiz yo'q.",failed:"Hujjat hozir ochilmadi."},
    ky:{ maritime:"Деңиз иши",back:"Артка",home:"Башкы бет",module:"Модулга кайтуу",secure:"Коопсуз документ көрүү",title:"Деңиз кызматынын документи",lead:"Бул документти ээси, ыйгарым укуктуу администратор же активдүү жумушка алуу процессиндеги компания гана көрө алат.",open:"Жаңы өтмөктө ачуу",loading:"Коопсуз кирүү даярдалууда...",loginTitle:"Кирүү талап кылынат",loginLead:"Документти көрүү үчүн тиешелүү эсеп менен кириңиз.",userLogin:"Деңизчи кирүүсү",partnerLogin:"Компания кирүүсү",errorTitle:"Документ ачылган жок",retry:"Кайра аракет",invalid:"Документ шилтемеси жараксыз.",denied:"Бул документти көрүүгө укугуңуз жок.",failed:"Документ азыр ачылган жок."},
    en:{ maritime:"Maritime",back:"Back",home:"Home",module:"Back to Module",secure:"Secure document viewer",title:"Sea-service Document",lead:"This document is available only to its owner, an authorized administrator, or a company involved in an active hiring application.",open:"Open in new tab",loading:"Preparing secure document access...",loginTitle:"Sign-in required",loginLead:"Sign in with the relevant account to view the document.",userLogin:"Seafarer sign-in",partnerLogin:"Company sign-in",errorTitle:"Document unavailable",retry:"Try again",invalid:"The document link is invalid.",denied:"You are not authorized to view this document.",failed:"The document could not be opened right now."},
    de:{ maritime:"Seefahrt",back:"Zurück",home:"Startseite",module:"Zum Modul",secure:"Sichere Dokumentanzeige",title:"Seefahrtsnachweis",lead:"Dieses Dokument kann nur vom Eigentümer, einem autorisierten Administrator oder einem Unternehmen in einem aktiven Einstellungsverfahren angesehen werden.",open:"In neuem Tab öffnen",loading:"Sicherer Dokumentzugriff wird vorbereitet...",loginTitle:"Anmeldung erforderlich",loginLead:"Melden Sie sich mit dem passenden Konto an.",userLogin:"Seefahrer-Anmeldung",partnerLogin:"Firmen-Anmeldung",errorTitle:"Dokument nicht verfügbar",retry:"Erneut versuchen",invalid:"Der Dokumentlink ist ungültig.",denied:"Sie sind nicht berechtigt, dieses Dokument anzusehen.",failed:"Das Dokument konnte nicht geöffnet werden."},
    ru:{ maritime:"Морской модуль",back:"Назад",home:"Главная",module:"Вернуться в модуль",secure:"Безопасный просмотр документа",title:"Документ о морском стаже",lead:"Документ доступен только владельцу, уполномоченному администратору или компании с активной заявкой на найм.",open:"Открыть в новой вкладке",loading:"Подготавливается безопасный доступ...",loginTitle:"Требуется вход",loginLead:"Войдите с соответствующей учетной записью.",userLogin:"Вход моряка",partnerLogin:"Вход компании",errorTitle:"Документ недоступен",retry:"Повторить",invalid:"Недействительная ссылка на документ.",denied:"У вас нет доступа к этому документу.",failed:"Документ сейчас не удалось открыть."},
    ar:{ maritime:"الملاحة البحرية",back:"رجوع",home:"الرئيسية",module:"العودة إلى الوحدة",secure:"عرض آمن للمستند",title:"وثيقة الخدمة البحرية",lead:"لا يمكن عرض هذا المستند إلا من قبل مالكه أو مسؤول مخول أو شركة ضمن عملية توظيف نشطة.",open:"فتح في علامة تبويب جديدة",loading:"جار إعداد وصول آمن...",loginTitle:"تسجيل الدخول مطلوب",loginLead:"سجل الدخول بالحساب المناسب لعرض المستند.",userLogin:"دخول البحار",partnerLogin:"دخول الشركة",errorTitle:"المستند غير متاح",retry:"إعادة المحاولة",invalid:"رابط المستند غير صالح.",denied:"ليس لديك صلاحية لعرض هذا المستند.",failed:"تعذر فتح المستند الآن."}
  };

  function currentLanguage() {
    let stored = "";
    try { stored = localStorage.getItem("allonahub_language") || localStorage.getItem("allonahub_lang") || ""; } catch(error) {}
    return languages.has(stored) ? stored : (languages.has(document.documentElement.lang) ? document.documentElement.lang : "tr");
  }

  function localize(language) {
    const lang = languages.has(language) ? language : "tr";
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-copy]").forEach(node => { node.textContent = copy[lang][node.dataset.copy] || copy.tr[node.dataset.copy] || ""; });
    const select = document.querySelector("[data-language]");
    if(select) select.value = lang;
    try { localStorage.setItem("allonahub_language", lang); } catch(error) {}
  }

  function apiBase() { return String(App.config?.apiBaseUrl || "https://api.allonahub.com").replace(/\/$/, ""); }
  function documentId() { return new URLSearchParams(window.location.search).get("id") || ""; }
  function validId(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
  function hideAll() { ["[data-status]", "[data-login]", "[data-error]", "[data-viewer]"].forEach(selector => { const node = document.querySelector(selector); if(node) node.hidden = true; }); }

  function showError(key) {
    hideAll();
    const lang = currentLanguage();
    const panel = document.querySelector("[data-error]");
    panel.hidden = false;
    panel.querySelector("[data-error-message]").textContent = copy[lang][key] || copy[lang].failed;
  }

  function showLogin(id) {
    hideAll();
    const panel = document.querySelector("[data-login]");
    panel.hidden = false;
    const returnTo = encodeURIComponent(`${window.location.pathname}?id=${encodeURIComponent(id)}`);
    panel.querySelector("[data-user-login]").href = `../account/user.html?returnTo=${returnTo}`;
    panel.querySelector("[data-partner-login]").href = `../partner/partner.html?returnTo=${returnTo}`;
  }

  async function loadDocument() {
    const id = documentId();
    if(!validId(id)) { showError("invalid"); return; }
    hideAll();
    document.querySelector("[data-status]").hidden = false;
    const session = App.auth?.getSession ? await App.auth.getSession() : null;
    if(!session?.access_token) { showLogin(id); return; }
    const headers = { Accept:"application/json", Authorization:`Bearer ${session.access_token}` };
    try {
      if(App.cvAccess?.getDeviceKey) headers["X-Allona-Device-Key"] = await App.cvAccess.getDeviceKey();
    } catch(error) {}
    try {
      const response = await fetch(`${apiBase()}/v1/maritime/sea-service-documents/${encodeURIComponent(id)}/access`, { headers });
      const payload = await response.json().catch(() => ({}));
      if(response.status === 401) { showLogin(id); return; }
      if(response.status === 403) { showError("denied"); return; }
      if(!response.ok || payload.ok !== true || !/^https:\/\//i.test(payload.url || "")) { showError("failed"); return; }
      hideAll();
      const viewer = document.querySelector("[data-viewer]");
      const frame = viewer.querySelector("[data-document-frame]");
      frame.src = payload.url;
      viewer.hidden = false;
      const open = document.querySelector("[data-open-document]");
      open.href = payload.url;
      open.hidden = false;
    } catch(error) { showError("failed"); }
  }

  document.addEventListener("DOMContentLoaded", function () {
    localize(currentLanguage());
    document.querySelector("[data-language]")?.addEventListener("change", event => localize(event.currentTarget.value));
    document.querySelector("[data-retry]")?.addEventListener("click", loadDocument);
    document.querySelector("[data-go-back]")?.addEventListener("click", function () {
      try {
        if(document.referrer && new URL(document.referrer).origin === window.location.origin && history.length > 1) { history.back(); return; }
      } catch(error) {}
      window.location.href = "allonadenizcilik.html";
    });
    loadDocument();
  }, { once:true });
})();
