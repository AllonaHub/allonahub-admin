const cvDraftStore = window.AllonaMaritimeCvDraft;
let currentLang = "en";

const textFields = [
  "position","familyName","firstName","fatherName","birth","marital","address","airport",
  "height","weight","eyes","hair","shoes","overall",
  "mobile","email","kinName","kinPhone","kinRelation","kinAddress",
  "passportDoc","passportNo","passportPlace","passportIssued","passportValid",
  "windows","office","internet",
  "seamanBookNo","seamanBookPlace","seamanBookIssued","seamanBookValid",
  "seafarerIdNo","seafarerIdPlace","seafarerIdIssued","seafarerIdValid",
  "schoolName","schoolPlace","schoolGrade","schoolFrom","schoolTo",
  "azSpeak","azRead","azWrite","trSpeak","trRead","trWrite",
  "enSpeak","enRead","enWrite","ruSpeak","ruRead","ruWrite",
  "medicalDoc","medicalGrade","medicalPlace","medicalIssue","medicalExpiry",
  "competencyClass","competencyCountry","competencyCertificate",
  "competencyIssued","competencyExpires","competencyLimit","note"
];
const maxTextLength = 2000;
const maxRepeatFieldLength = 300;
const repeatRowKeys = Object.freeze({
  additional: Object.freeze(["name", "institute", "place", "issue", "cert", "expiry"]),
  stcw: Object.freeze(["name", "institute", "place", "issue", "rank", "cert", "expiry"]),
  sea: Object.freeze(["vessel", "company", "type", "flag", "dwt", "grt", "rank", "signon", "signoff"])
});

let additionalData = [];
let stcwData = [];
let seaData = [];
const maxRepeatRows = 50;
let autoSaveTimer = 0;

function valueOf(id){
  const el = document.getElementById(id);
  return el ? el.value : "";
}

function htmlValue(id){
  return escapeHTML(valueOf(id)).replace(/\n/g, "<br>");
}

function setCV(id, value){
  const el = document.getElementById("cv_" + id);
  if(el){
    el.innerHTML = value || "";
  }
}

function syncCV(){
  textFields.forEach(id => {
    setCV(id, htmlValue(id));
  });

  renderAdditionals();
  renderSTCW();
  renderSea();
}

function escapeAttr(value){
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHTML(value){
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
  const translations = {
  en: {
    formTitle:"CV Information",
    applicationForm:"Application Form",
    personalDetails:"Personal Details",
    bodyDetails:"Body Details",
    contactDetails:"Contact Details",
    nextOfKin:"Next of Kin",
    passportDetails:"Travel Passport Details",
    computerSkills:"Computer Skills",
    seamanBookDetails:"Seaman’s Book Details",
    education:"Education",
    languageKnowledge:"Knowledge of Language",
    medicalInfo:"Medical Information",
    competency:"Certificate of Competency",
    certificateCompetency:"Certificate of Competency",
    additionalCertificates:"Additional Certificates",
    stcwCertificates:"STCW and Other Certificates",
    seaExperience:"Sea Experience",
    note:"Note",

    position:"Position",
    familyName:"Family Name",
    firstName:"First Name",
    fatherName:"Father’s Name",
    birth:"Date and Place of Birth",
    marital:"Marital Status",
    address:"Permanent Address",
    airport:"Nearest Airport",
    photo:"PHOTO",

    height:"Height",
    weight:"Weight",
    eyes:"Eyes Color",
    hair:"Hair Color",
    shoes:"Safety Shoes",
    overall:"Overalls",

    mobile:"Mobile",
    email:"E-mail Address",
    kinName:"Next of Kin",
    kinPhone:"Phone",
    kinRelation:"Relationship",
    kinAddress:"Address",

    document:"Document",
    number:"Number",
    placeOfIssue:"Place of Issue",
    issued:"Issued",
    valid:"Valid",

    windows:"Windows",
    office:"Microsoft Office",
    internet:"Internet",

    seamanBook:"Seaman Book",
    seafarerIdentity:"Seafarers Identity",
    seamanBookNo:"Seaman Book Document Number",
    seamanBookPlace:"Seaman Book Place of Issue",
    seafarerIdNo:"Seafarers Identity Document Number",
    seafarerIdPlace:"Seafarers Identity Place of Issue",

    schoolName:"Full Name of School",
    schoolPlace:"Place of Issue",
    schoolGrade:"Grade / Class",
    from:"From",
    to:"To",

    language:"Language",
    azerbaijanLang:"Azerbaijani",
    turkishLang:"Turkish",
    englishLang:"English",
    russianLang:"Russian",
    azerbaijani:"Azerbaijani",
    turkish:"Turkish",
    english:"English",
    russian:"Russian",
    speaking:"Speaking",
    reading:"Reading",
    writing:"Writing",

    grade:"Grade",
    dateOfIssue:"Date of Issue",
    dateOfExpiry:"Date of Expiry",
    dateIssued:"Date Issued",
    dateExpiry:"Date of Expiry",

    classGrade:"Class / Grade",
    issuingCountry:"Issuing Country",
    certificate:"Certificate",
    expires:"Expires",
    limitations:"Details of Limitations",

    courseName:"Course / Certificate",
    institute:"Institute",
    place:"Place",
    rank:"Rank",
    vessel:"Vessel",
    company:"Company",
    vesselType:"Type of Vessel",
    flag:"Flag",
    signOn:"Sign On",
    signOff:"Sign Off",

    addAdditional:"+ Add Additional Row",
    addSTCW:"+ Add STCW Certificate",
    addSea:"+ Add Sea Experience",
    deleteRow:"Delete Row",
    deleteCertificate:"Delete Certificate",
    deleteExperience:"Delete Experience",
    saveDraft:"Save",
    downloadPdf:"Download PDF",
    clearForm:"Clear",
    cvLanguage:"CV language",
    photoAlt:"CV profile photo",
    draftSaved:"CV draft will be kept in this tab for 2 hours.",
    draftSaveFailed:"CV draft could not be saved. Check your browser storage settings.",
    resetConfirm:"Clear all information?",
    photoInvalid:"Profile photo must be JPEG, PNG or WebP and no larger than 2 MB.",
    photoUnsafe:"Profile photo could not be read safely.",
    photoReadFailed:"Profile photo could not be read.",
    rowLimit:"You can add up to 50 rows in this section.",
    pdfLibraryFailed:"The PDF library could not be loaded. Check your connection and try again.",
    pdfPreviewMissing:"The PDF preview was not found. Reload the page and try again.",
    pdfGenerationFailed:"The PDF could not be created. Please try again."
  },
    tr: {
    formTitle:"CV Bilgileri",
    applicationForm:"Başvuru Formu",
    personalDetails:"Kişisel Bilgiler",
    bodyDetails:"Fiziksel Bilgiler",
    contactDetails:"İletişim Bilgileri",
    nextOfKin:"Yakın Kişi Bilgileri",
    passportDetails:"Pasaport Bilgileri",
    computerSkills:"Bilgisayar Bilgisi",
    seamanBookDetails:"Gemiadamı Cüzdanı Bilgileri",
    education:"Eğitim",
    languageKnowledge:"Dil Bilgisi",
    medicalInfo:"Sağlık Bilgileri",
    competency:"Yeterlilik Belgesi",
    certificateCompetency:"Yeterlilik Belgesi",
    additionalCertificates:"Ek Sertifikalar",
    stcwCertificates:"STCW ve Diğer Sertifikalar",
    seaExperience:"Deniz Tecrübesi",
    note:"Not",

    position:"Pozisyon",
    familyName:"Soyadı",
    firstName:"Adı",
    fatherName:"Baba Adı",
    birth:"Doğum Tarihi ve Yeri",
    marital:"Medeni Durum",
    address:"Daimi Adres",
    airport:"En Yakın Havalimanı",
    photo:"FOTOĞRAF",

    height:"Boy",
    weight:"Kilo",
    eyes:"Göz Rengi",
    hair:"Saç Rengi",
    shoes:"İş Ayakkabısı",
    overall:"Tulum Bedeni",

    mobile:"Telefon",
    email:"E-posta Adresi",
    kinName:"Yakın Kişi",
    kinPhone:"Telefon",
    kinRelation:"Yakınlık Derecesi",
    kinAddress:"Adres",

    document:"Belge",
    number:"Numara",
    placeOfIssue:"Düzenleme Yeri",
    issued:"Veriliş",
    valid:"Geçerlilik",

    windows:"Windows",
    office:"Microsoft Office",
    internet:"İnternet",

    seamanBook:"Gemiadamı Cüzdanı",
    seafarerIdentity:"Gemiadamı Kimliği",
    seamanBookNo:"Gemiadamı Cüzdanı Belge No",
    seamanBookPlace:"Gemiadamı Cüzdanı Düzenleme Yeri",
    seafarerIdNo:"Gemiadamı Kimliği Belge No",
    seafarerIdPlace:"Gemiadamı Kimliği Düzenleme Yeri",

    schoolName:"Okul Adı",
    schoolPlace:"Düzenleme Yeri",
    schoolGrade:"Derece / Sınıf",
    from:"Başlangıç",
    to:"Bitiş",

    language:"Dil",
    azerbaijanLang:"Azerbaycanca",
    turkishLang:"Türkçe",
    englishLang:"İngilizce",
    russianLang:"Rusça",
    azerbaijani:"Azerbaycanca",
    turkish:"Türkçe",
    english:"İngilizce",
    russian:"Rusça",
    speaking:"Konuşma",
    reading:"Okuma",
    writing:"Yazma",

    grade:"Derece",
    dateOfIssue:"Veriliş Tarihi",
    dateOfExpiry:"Son Geçerlilik Tarihi",
    dateIssued:"Veriliş Tarihi",
    dateExpiry:"Son Geçerlilik",

    classGrade:"Sınıf / Derece",
    issuingCountry:"Düzenleyen Ülke",
    certificate:"Sertifika",
    expires:"Geçerlilik",
    limitations:"Sınırlamalar",

    courseName:"Kurs / Sertifika",
    institute:"Kurum",
    place:"Yer",
    rank:"Rütbe",
    vessel:"Gemi",
    company:"Şirket",
    vesselType:"Gemi Tipi",
    flag:"Bayrak",
    signOn:"Katılış",
    signOff:"Ayrılış",

    addAdditional:"+ Ek Sertifika Ekle",
    addSTCW:"+ STCW Sertifikası Ekle",
    addSea:"+ Deniz Tecrübesi Ekle",
    deleteRow:"Satırı Sil",
    deleteCertificate:"Sertifikayı Sil",
    deleteExperience:"Tecrübeyi Sil",
    saveDraft:"Kaydet",
    downloadPdf:"PDF İndir",
    clearForm:"Temizle",
    cvLanguage:"CV dili",
    photoAlt:"CV profil fotoğrafı",
    draftSaved:"CV taslağı bu sekmede 2 saat saklanacak.",
    draftSaveFailed:"CV taslağı kaydedilemedi. Tarayıcı depolama ayarlarını kontrol edin.",
    resetConfirm:"Tüm bilgiler temizlensin mi?",
    photoInvalid:"Profil fotoğrafı JPEG, PNG veya WebP formatında ve en fazla 2 MB olmalıdır.",
    photoUnsafe:"Profil fotoğrafı güvenli biçimde okunamadı.",
    photoReadFailed:"Profil fotoğrafı okunamadı.",
    rowLimit:"Bu bölüme en fazla 50 satır eklenebilir.",
    pdfLibraryFailed:"PDF kütüphanesi yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.",
    pdfPreviewMissing:"PDF önizlemesi bulunamadı. Sayfayı yenileyip yeniden deneyin.",
    pdfGenerationFailed:"PDF oluşturulamadı. Lütfen yeniden deneyin."
  },

  az: {
    formTitle:"CV Məlumatları",
    applicationForm:"Müraciət Forması",
    personalDetails:"Şəxsi Məlumatlar",
    bodyDetails:"Fiziki Məlumatlar",
    contactDetails:"Əlaqə Məlumatları",
    nextOfKin:"Yaxın Şəxs Məlumatları",
    passportDetails:"Pasport Məlumatları",
    computerSkills:"Kompüter Bilikləri",
    seamanBookDetails:"Dənizçi Kitabçası Məlumatları",
    education:"Təhsil",
    languageKnowledge:"Dil Bilikləri",
    medicalInfo:"Tibbi Məlumatlar",
    competency:"Səriştə Sertifikatı",
    certificateCompetency:"Səriştə Sertifikatı",
    additionalCertificates:"Əlavə Sertifikatlar",
    stcwCertificates:"STCW və Digər Sertifikatlar",
    seaExperience:"Dəniz Təcrübəsi",
    note:"Qeyd",

    position:"Vəzifə",
    familyName:"Soyad",
    firstName:"Ad",
    fatherName:"Ata Adı",
    birth:"Doğum Tarixi və Yeri",
    marital:"Ailə Vəziyyəti",
    address:"Daimi Ünvan",
    airport:"Ən Yaxın Hava Limanı",
    photo:"FOTO",

    height:"Boy",
    weight:"Çəki",
    eyes:"Göz Rəngi",
    hair:"Saç Rəngi",
    shoes:"İş Ayaqqabısı",
    overall:"Kombinezon Ölçüsü",

    mobile:"Mobil",
    email:"E-poçt Ünvanı",
    kinName:"Yaxın Şəxs",
    kinPhone:"Telefon",
    kinRelation:"Qohumluq Dərəcəsi",
    kinAddress:"Ünvan",

    document:"Sənəd",
    number:"Nömrə",
    placeOfIssue:"Verilmə Yeri",
    issued:"Verilmə Tarixi",
    valid:"Etibarlıdır",

    windows:"Windows",
    office:"Microsoft Office",
    internet:"İnternet",

    seamanBook:"Dənizçi Kitabçası",
    seafarerIdentity:"Dənizçi Şəxsiyyət Sənədi",
    seamanBookNo:"Dənizçi Kitabçası Sənəd No",
    seamanBookPlace:"Dənizçi Kitabçası Verilmə Yeri",
    seafarerIdNo:"Dənizçi Şəxsiyyət Sənədi No",
    seafarerIdPlace:"Dənizçi Şəxsiyyət Sənədi Verilmə Yeri",

    schoolName:"Məktəb Adı",
    schoolPlace:"Verilmə Yeri",
    schoolGrade:"Dərəcə / Sinif",
    from:"Başlanğıc",
    to:"Bitiş",

    language:"Dil",
    azerbaijanLang:"Azərbaycanca",
    turkishLang:"Türkcə",
    englishLang:"İngiliscə",
    russianLang:"Rusca",
    azerbaijani:"Azərbaycanca",
    turkish:"Türkcə",
    english:"İngiliscə",
    russian:"Rusca",
    speaking:"Danışıq",
    reading:"Oxuma",
    writing:"Yazı",

    grade:"Dərəcə",
    dateOfIssue:"Verilmə Tarixi",
    dateOfExpiry:"Bitmə Tarixi",
    dateIssued:"Verilmə Tarixi",
    dateExpiry:"Bitmə Tarixi",

    classGrade:"Sinif / Dərəcə",
    issuingCountry:"Verən Ölkə",
    certificate:"Sertifikat",
    expires:"Etibarlılıq",
    limitations:"Məhdudiyyətlər",

    courseName:"Kurs / Sertifikat",
    institute:"Qurum",
    place:"Yer",
    rank:"Rütbə",
    vessel:"Gəmi",
    company:"Şirkət",
    vesselType:"Gəmi Tipi",
    flag:"Bayraq",
    signOn:"Giriş",
    signOff:"Çıxış",

    addAdditional:"+ Əlavə Sertifikat Əlavə Et",
    addSTCW:"+ STCW Sertifikatı Əlavə Et",
    addSea:"+ Dəniz Təcrübəsi Əlavə Et",
    deleteRow:"Sətri Sil",
    deleteCertificate:"Sertifikatı Sil",
    deleteExperience:"Təcrübəni Sil",
    saveDraft:"Yadda saxla",
    downloadPdf:"PDF endir",
    clearForm:"Təmizlə",
    cvLanguage:"CV dili",
    photoAlt:"CV profil fotosu",
    draftSaved:"CV qaralaması bu tabda 2 saat saxlanacaq.",
    draftSaveFailed:"CV qaralaması saxlanmadı. Brauzer yaddaşı ayarlarını yoxlayın.",
    resetConfirm:"Bütün məlumatlar təmizlənsin?",
    photoInvalid:"Profil fotosu JPEG, PNG və ya WebP formatında və ən çox 2 MB olmalıdır.",
    photoUnsafe:"Profil fotosu təhlükəsiz şəkildə oxunmadı.",
    photoReadFailed:"Profil fotosu oxunmadı.",
    rowLimit:"Bu bölməyə ən çox 50 sətir əlavə edilə bilər.",
    pdfLibraryFailed:"PDF kitabxanası yüklənmədi. Bağlantını yoxlayıb yenidən cəhd edin.",
    pdfPreviewMissing:"PDF önizləməsi tapılmadı. Səhifəni yeniləyib təkrar cəhd edin.",
    pdfGenerationFailed:"PDF yaradıla bilmədi. Yenidən cəhd edin."
  },
    ru: {
    formTitle:"Информация CV",
    applicationForm:"Форма Заявки",
    personalDetails:"Личная Информация",
    bodyDetails:"Физические Данные",
    contactDetails:"Контактная Информация",
    nextOfKin:"Ближайший Родственник",
    passportDetails:"Паспортные Данные",
    computerSkills:"Навыки Работы с Компьютером",
    seamanBookDetails:"Данные Мореходной Книжки",
    education:"Образование",
    languageKnowledge:"Знание Языков",
    medicalInfo:"Медицинская Информация",
    competency:"Сертификат Компетентности",
    certificateCompetency:"Сертификат Компетентности",
    additionalCertificates:"Дополнительные Сертификаты",
    stcwCertificates:"STCW и Другие Сертификаты",
    seaExperience:"Морской Опыт",
    note:"Примечание",

    position:"Должность",
    familyName:"Фамилия",
    firstName:"Имя",
    fatherName:"Отчество",
    birth:"Дата и Место Рождения",
    marital:"Семейное Положение",
    address:"Постоянный Адрес",
    airport:"Ближайший Аэропорт",
    photo:"ФОТО",

    height:"Рост",
    weight:"Вес",
    eyes:"Цвет Глаз",
    hair:"Цвет Волос",
    shoes:"Защитная Обувь",
    overall:"Размер Комбинезона",

    mobile:"Мобильный",
    email:"Электронная Почта",
    kinName:"Ближайший Родственник",
    kinPhone:"Телефон",
    kinRelation:"Степень Родства",
    kinAddress:"Адрес",

    document:"Документ",
    number:"Номер",
    placeOfIssue:"Место Выдачи",
    issued:"Выдан",
    valid:"Действителен",

    windows:"Windows",
    office:"Microsoft Office",
    internet:"Интернет",

    seamanBook:"Мореходная Книжка",
    seafarerIdentity:"Удостоверение Моряка",
    seamanBookNo:"Номер Мореходной Книжки",
    seamanBookPlace:"Место Выдачи Мореходной Книжки",
    seafarerIdNo:"Номер Удостоверения Моряка",
    seafarerIdPlace:"Место Выдачи Удостоверения Моряка",

    schoolName:"Название Учебного Заведения",
    schoolPlace:"Место Выдачи",
    schoolGrade:"Степень / Класс",
    from:"С",
    to:"До",

    language:"Язык",
    azerbaijanLang:"Азербайджанский",
    turkishLang:"Турецкий",
    englishLang:"Английский",
    russianLang:"Русский",
    azerbaijani:"Азербайджанский",
    turkish:"Турецкий",
    english:"Английский",
    russian:"Русский",
    speaking:"Разговор",
    reading:"Чтение",
    writing:"Письмо",

    grade:"Степень",
    dateOfIssue:"Дата Выдачи",
    dateOfExpiry:"Срок Действия",
    dateIssued:"Дата Выдачи",
    dateExpiry:"Срок Действия",

    classGrade:"Класс / Степень",
    issuingCountry:"Страна Выдачи",
    certificate:"Сертификат",
    expires:"Истекает",
    limitations:"Ограничения",

    courseName:"Курс / Сертификат",
    institute:"Учреждение",
    place:"Место",
    rank:"Должность",
    vessel:"Судно",
    company:"Компания",
    vesselType:"Тип Судна",
    flag:"Флаг",
    signOn:"Посадка",
    signOff:"Списание",

    addAdditional:"+ Добавить Сертификат",
    addSTCW:"+ Добавить STCW",
    addSea:"+ Добавить Морской Опыт",
    deleteRow:"Удалить Строку",
    deleteCertificate:"Удалить Сертификат",
    deleteExperience:"Удалить Опыт",
    saveDraft:"Сохранить",
    downloadPdf:"Скачать PDF",
    clearForm:"Очистить",
    cvLanguage:"Язык CV",
    photoAlt:"Фото профиля CV",
    draftSaved:"Черновик CV будет храниться в этой вкладке 2 часа.",
    draftSaveFailed:"Не удалось сохранить черновик CV. Проверьте настройки хранилища браузера.",
    resetConfirm:"Очистить всю информацию?",
    photoInvalid:"Фото профиля должно быть в формате JPEG, PNG или WebP и не превышать 2 МБ.",
    photoUnsafe:"Не удалось безопасно прочитать фото профиля.",
    photoReadFailed:"Не удалось прочитать фото профиля.",
    rowLimit:"В этот раздел можно добавить не более 50 строк.",
    pdfLibraryFailed:"Не удалось загрузить библиотеку PDF. Проверьте соединение и повторите попытку.",
    pdfPreviewMissing:"Предпросмотр PDF не найден. Обновите страницу и повторите попытку.",
    pdfGenerationFailed:"Не удалось создать PDF. Повторите попытку."
  }
};

function t(key){
  return translations[currentLang]?.[key] || translations.en[key] || key;
}

function associateEditorLabels(root){
  const scope = root || document.getElementById("cvEditor");
  if(!scope) return;

  scope.querySelectorAll("input, textarea, select").forEach((control, fallbackIndex) => {
    if(!control.id){
      const row = control.dataset.cvRow;
      const index = control.dataset.cvIndex;
      const key = control.dataset.cvKey;
      control.id = row && index && key
        ? `cv-${row}-${index}-${key}`
        : `cv-editor-control-${fallbackIndex}`;
    }

    if(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement){
      if(control.type !== "file"){
        control.maxLength = control.dataset.cvRow ? maxRepeatFieldLength : maxTextLength;
      }
    }

    const previous = control.previousElementSibling;
    if(previous instanceof HTMLLabelElement){
      previous.htmlFor = control.id;
      control.removeAttribute("aria-label");
      return;
    }

    const languageRow = control.dataset.ph && control.parentElement?.classList.contains("row3")
      ? control.parentElement
      : null;
    const languageLabel = languageRow?.previousElementSibling;
    if(languageLabel instanceof HTMLLabelElement){
      const language = languageLabel.textContent.trim();
      const skill = control.placeholder.trim();
      control.setAttribute("aria-label", `${language} ${skill}`.trim());
    }
  });
}

function changeLanguage(lang){
  if(!translations[lang]) return;
  currentLang = lang;
  try{
    localStorage.setItem("allonahub_cv_lang", lang);
  } catch(error) {}
  translatePage();
  renderAdditionalInputs();
  renderSTCWInputs();
  renderSeaInputs();
  syncCV();
}

function translatePage(){
  document.documentElement.lang = currentLang;
  document.documentElement.dir = "ltr";

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });

  document.querySelectorAll("[data-ph]").forEach(el => {
    const key = el.getAttribute("data-ph");
    el.placeholder = t(key);
  });

  document.querySelectorAll("[data-aria-i18n]").forEach(el => {
    el.setAttribute("aria-label", t(el.getAttribute("data-aria-i18n")));
  });

  document.querySelectorAll("[data-alt-i18n]").forEach(el => {
    el.setAttribute("alt", t(el.getAttribute("data-alt-i18n")));
  });
  associateEditorLabels();
}
  function renderAdditionalInputs(){
  const box = document.getElementById("additionalInputs");
  if(!box) return;

  box.innerHTML = "";

  additionalData.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "group cv-repeat-group cv-repeat-group--compact";

    div.innerHTML = `
      <h3>${t("additionalCertificates")} ${index + 1}</h3>

      <label>${t("courseName")}</label>
      <input value="${escapeAttr(item.name)}" data-cv-row="additional" data-cv-index="${index}" data-cv-key="name">

      <label>${t("institute")}</label>
      <input value="${escapeAttr(item.institute)}" data-cv-row="additional" data-cv-index="${index}" data-cv-key="institute">

      <label>${t("place")}</label>
      <input value="${escapeAttr(item.place)}" data-cv-row="additional" data-cv-index="${index}" data-cv-key="place">

      <label>${t("dateIssued")}</label>
      <input value="${escapeAttr(item.issue)}" data-cv-row="additional" data-cv-index="${index}" data-cv-key="issue">

      <label>Cert. No</label>
      <input value="${escapeAttr(item.cert)}" data-cv-row="additional" data-cv-index="${index}" data-cv-key="cert">

      <label>${t("dateExpiry")}</label>
      <input value="${escapeAttr(item.expiry)}" data-cv-row="additional" data-cv-index="${index}" data-cv-key="expiry">

      <button type="button" class="secondary" data-cv-action="remove-additional" data-cv-index="${index}">${t("deleteRow")}</button>
    `;

    box.appendChild(div);
  });
  associateEditorLabels(box);
}

function updateAdditional(index, key, value){
  const rowIndex = Number(index);
  if(!Number.isInteger(rowIndex) || rowIndex < 0 || !additionalData[rowIndex] || !repeatRowKeys.additional.includes(key)) return;
  additionalData[rowIndex][key] = String(value ?? "").slice(0, maxRepeatFieldLength);
  renderAdditionals();
  autoSaveCV();
}

function addAdditional(){
  if(additionalData.length >= maxRepeatRows){
    alert(t("rowLimit"));
    return;
  }
  additionalData.push({
    name:"",
    institute:"",
    place:"",
    issue:"",
    cert:"",
    expiry:""
  });

  renderAdditionalInputs();
  renderAdditionals();
  autoSaveCV();
}

function removeAdditional(index){
  const rowIndex = Number(index);
  if(!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= additionalData.length) return;
  additionalData.splice(rowIndex, 1);
  renderAdditionalInputs();
  renderAdditionals();
  autoSaveCV();
}

function renderAdditionals(){
  const tbody = document.getElementById("cv_additionalRows");
  if(!tbody) return;

  tbody.innerHTML = "";

  additionalData.forEach(item => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${escapeHTML(item.name)}</td>
      <td>${escapeHTML(item.institute)}</td>
      <td>${escapeHTML(item.place)}</td>
      <td>${escapeHTML(item.issue)}</td>
      <td>${escapeHTML(item.cert)}</td>
      <td>${escapeHTML(item.expiry)}</td>
    `;

    tbody.appendChild(tr);
  });
}

function renderSTCWInputs(){
  const box = document.getElementById("stcwInputs");
  if(!box) return;

  box.innerHTML = "";

  stcwData.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "group cv-repeat-group";

    div.innerHTML = `
      <h3>${t("stcwCertificates")} ${index + 1}</h3>

      <label>${t("courseName")}</label>
      <input value="${escapeAttr(item.name)}" data-cv-row="stcw" data-cv-index="${index}" data-cv-key="name">

      <label>${t("institute")}</label>
      <input value="${escapeAttr(item.institute)}" data-cv-row="stcw" data-cv-index="${index}" data-cv-key="institute">

      <label>${t("place")}</label>
      <input value="${escapeAttr(item.place)}" data-cv-row="stcw" data-cv-index="${index}" data-cv-key="place">

      <div class="row2">
        <div>
          <label>${t("dateIssued")}</label>
          <input value="${escapeAttr(item.issue)}" data-cv-row="stcw" data-cv-index="${index}" data-cv-key="issue">
        </div>

        <div>
          <label>${t("rank")}</label>
          <input value="${escapeAttr(item.rank)}" data-cv-row="stcw" data-cv-index="${index}" data-cv-key="rank">
        </div>
      </div>

      <div class="row2">
        <div>
          <label>Cert. No</label>
          <input value="${escapeAttr(item.cert)}" data-cv-row="stcw" data-cv-index="${index}" data-cv-key="cert">
        </div>

        <div>
          <label>${t("dateExpiry")}</label>
          <input value="${escapeAttr(item.expiry)}" data-cv-row="stcw" data-cv-index="${index}" data-cv-key="expiry">
        </div>
      </div>

      <button type="button" class="secondary" data-cv-action="remove-stcw" data-cv-index="${index}">${t("deleteCertificate")}</button>
    `;

    box.appendChild(div);
  });
  associateEditorLabels(box);
}

function updateSTCW(index, key, value){
  const rowIndex = Number(index);
  if(!Number.isInteger(rowIndex) || rowIndex < 0 || !stcwData[rowIndex] || !repeatRowKeys.stcw.includes(key)) return;
  stcwData[rowIndex][key] = String(value ?? "").slice(0, maxRepeatFieldLength);
  renderSTCW();
  autoSaveCV();
}
  function addSTCW(){
  if(stcwData.length >= maxRepeatRows){
    alert(t("rowLimit"));
    return;
  }
  stcwData.push({
    name:"",
    institute:"",
    place:"",
    issue:"",
    rank:"",
    cert:"",
    expiry:""
  });

  renderSTCWInputs();
  renderSTCW();
  autoSaveCV();
}

function removeSTCW(index){
  const rowIndex = Number(index);
  if(!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= stcwData.length) return;
  stcwData.splice(rowIndex, 1);
  renderSTCWInputs();
  renderSTCW();
  autoSaveCV();
}

function renderSTCW(){
  const tbody = document.getElementById("cv_stcwRows");
  if(!tbody) return;

  tbody.innerHTML = "";

  stcwData.forEach(item => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${escapeHTML(item.name)}</td>
      <td>${escapeHTML(item.institute)}</td>
      <td>${escapeHTML(item.place)}</td>
      <td>${escapeHTML(item.issue)}</td>
      <td>${escapeHTML(item.rank)}</td>
      <td>${escapeHTML(item.cert)}</td>
      <td>${escapeHTML(item.expiry)}</td>
    `;

    tbody.appendChild(tr);
  });
}

function renderSeaInputs(){
  const box = document.getElementById("seaInputs");
  if(!box) return;

  box.innerHTML = "";

  seaData.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "group cv-repeat-group";

    div.innerHTML = `
      <h3>${t("seaExperience")} ${index + 1}</h3>

      <label>${t("vessel")}</label>
      <input value="${escapeAttr(item.vessel)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="vessel">

      <label>${t("company")}</label>
      <input value="${escapeAttr(item.company)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="company">

      <label>${t("vesselType")}</label>
      <input value="${escapeAttr(item.type)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="type">

      <label>${t("flag")}</label>
      <input value="${escapeAttr(item.flag)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="flag">

      <div class="row2">
        <div>
          <label>DWT</label>
          <input value="${escapeAttr(item.dwt)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="dwt">
        </div>

        <div>
          <label>GRT</label>
          <input value="${escapeAttr(item.grt)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="grt">
        </div>
      </div>

      <label>${t("rank")}</label>
      <input value="${escapeAttr(item.rank)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="rank">

      <div class="row2">
        <div>
          <label>${t("signOn")}</label>
          <input value="${escapeAttr(item.signon)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="signon">
        </div>

        <div>
          <label>${t("signOff")}</label>
          <input value="${escapeAttr(item.signoff)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="signoff">
        </div>
      </div>

      <button type="button" class="secondary" data-cv-action="remove-sea" data-cv-index="${index}">${t("deleteExperience")}</button>
    `;

    box.appendChild(div);
  });
  associateEditorLabels(box);
}

function updateSea(index, key, value){
  const rowIndex = Number(index);
  if(!Number.isInteger(rowIndex) || rowIndex < 0 || !seaData[rowIndex] || !repeatRowKeys.sea.includes(key)) return;
  seaData[rowIndex][key] = String(value ?? "").slice(0, maxRepeatFieldLength);
  renderSea();
  autoSaveCV();
}
  function addSea(){
  if(seaData.length >= maxRepeatRows){
    alert(t("rowLimit"));
    return;
  }
  seaData.push({
    vessel:"",
    company:"",
    type:"",
    flag:"",
    dwt:"",
    grt:"",
    rank:"",
    signon:"",
    signoff:""
  });

  renderSeaInputs();
  renderSea();
  autoSaveCV();
}

function removeSea(index){
  const rowIndex = Number(index);
  if(!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= seaData.length) return;
  seaData.splice(rowIndex, 1);
  renderSeaInputs();
  renderSea();
  autoSaveCV();
}

function renderSea(){
  const tbody = document.getElementById("cv_seaRows");
  if(!tbody) return;

  tbody.innerHTML = "";

  seaData.forEach(item => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${escapeHTML(item.vessel)}</td>
      <td>${escapeHTML(item.company)}</td>
      <td>${escapeHTML(item.type)}</td>
      <td>${escapeHTML(item.flag)}</td>
      <td>${escapeHTML(item.dwt)}</td>
      <td>${escapeHTML(item.grt)}</td>
      <td>${escapeHTML(item.rank)}</td>
      <td>${escapeHTML(item.signon)}</td>
      <td>${escapeHTML(item.signoff)}</td>
    `;

    tbody.appendChild(tr);
  });
}

function getCVData(){
  const fields = {};

  textFields.forEach(id => {
    fields[id] = String(valueOf(id)).slice(0, maxTextLength);
  });

  const photo = document.getElementById("cv_photo")?.getAttribute("src") || "";
  return {
    lang: currentLang,
    fields,
    additionalData,
    stcwData,
    seaData,
    photo: cvDraftStore?.isSafePhotoDataUrl(photo) ? photo : ""
  };
}

function persistCV(){
  return Boolean(cvDraftStore && cvDraftStore.write(getCVData()));
}

function saveCV(){
  if(autoSaveTimer){
    window.clearTimeout(autoSaveTimer);
    autoSaveTimer = 0;
  }
  alert(persistCV() ? t("draftSaved") : t("draftSaveFailed"));
}

function autoSaveCV(){
  if(autoSaveTimer) window.clearTimeout(autoSaveTimer);
  autoSaveTimer = window.setTimeout(function(){
    autoSaveTimer = 0;
    persistCV();
  }, 250);
}
function sanitizeDraftRows(value, keys){
  if(!Array.isArray(value)) return [];
  return value.slice(0, 50).filter(item => item && typeof item === "object" && !Array.isArray(item)).map(item => {
    const clean = {};
    keys.forEach(key => {
      clean[key] = String(item[key] ?? "").slice(0, maxRepeatFieldLength);
    });
    return clean;
  });
}
  function loadCV(){
  const data = cvDraftStore?.read();
  if(!data || typeof data !== "object") return;

    if(data.lang && translations[data.lang]){
      currentLang = data.lang;
      const langSelect = document.getElementById("langSelect");
      if(langSelect) langSelect.value = currentLang;
    }

    if(data.fields && typeof data.fields === "object" && !Array.isArray(data.fields)){
      textFields.forEach(id => {
        const el = document.getElementById(id);
        if(el){
          el.value = String(data.fields[id] ?? "").slice(0, maxTextLength);
        }
      });
    }

    additionalData = sanitizeDraftRows(data.additionalData, repeatRowKeys.additional);
    stcwData = sanitizeDraftRows(data.stcwData, repeatRowKeys.stcw);
    seaData = sanitizeDraftRows(data.seaData, repeatRowKeys.sea);

    if(data.photo && cvDraftStore?.isSafePhotoDataUrl(data.photo)){
      const img = document.getElementById("cv_photo");
      const empty = document.getElementById("emptyPhoto");

      if(img){
        img.src = data.photo;
        img.hidden = false;
      }

      if(empty){
        empty.hidden = true;
      }
    }
}

const photoInput = document.getElementById("photoInput");

if(photoInput){
  photoInput.addEventListener("change", function(){
    const file = this.files && this.files[0];
    if(!file) return;
    if(!cvDraftStore?.isAllowedPhotoFile(file)){
      this.value = "";
      alert(t("photoInvalid"));
      return;
    }

    const reader = new FileReader();

    reader.onload = function(e){
      const photoData = String(e.target?.result || "");
      if(!cvDraftStore?.isSafePhotoDataUrl(photoData)){
        photoInput.value = "";
        alert(t("photoUnsafe"));
        return;
      }
      const img = document.getElementById("cv_photo");
      const empty = document.getElementById("emptyPhoto");

      if(img){
        img.src = photoData;
        img.hidden = false;
      }

      if(empty){
        empty.hidden = true;
      }

      autoSaveCV();
    };
    reader.onerror = function(){
      photoInput.value = "";
      alert(t("photoReadFailed"));
    };

    reader.readAsDataURL(file);
  });
}
  function resetForm(){
  const ok = confirm(t("resetConfirm"));
  if(!ok) return;

  textFields.forEach(id => {
    const el = document.getElementById(id);
    if(el){
      el.value = "";
    }
  });

  additionalData = [];
  stcwData = [];
  seaData = [];

  const img = document.getElementById("cv_photo");
  const empty = document.getElementById("emptyPhoto");
  const fileInput = document.getElementById("photoInput");

  if(img){
    img.removeAttribute("src");
    img.hidden = true;
  }

  if(empty){
    empty.hidden = false;
  }

  if(fileInput){
    fileInput.value = "";
  }

  if(autoSaveTimer){
    window.clearTimeout(autoSaveTimer);
    autoSaveTimer = 0;
  }
  cvDraftStore?.clear();

  renderAdditionalInputs();
  renderSTCWInputs();
  renderSeaInputs();
  syncCV();
}

window.addEventListener("pagehide", function(){
  if(!autoSaveTimer) return;
  window.clearTimeout(autoSaveTimer);
  autoSaveTimer = 0;
  persistCV();
});

document.addEventListener("DOMContentLoaded", function(){
  let savedLang = "";
  try{
    savedLang = localStorage.getItem("allonahub_cv_lang") || "";
  } catch(error) {}
  if(savedLang && translations[savedLang]){
    currentLang = savedLang;
  }

  const langSelect = document.getElementById("langSelect");
  if(langSelect){
    langSelect.value = currentLang;
  }

  loadCV();

  translatePage();
  renderAdditionalInputs();
  renderSTCWInputs();
  renderSeaInputs();
  syncCV();
  document.body.dataset.maritimeCvReady = "true";
  document.dispatchEvent(new Event("allonahub:maritime-cv-ready"));
});
  const valueTranslations = {
  excellent:{ en:"Excellent", tr:"Mükemmel", az:"Əla", ru:"Отлично" },
  good:{ en:"Good", tr:"İyi", az:"Yaxşı", ru:"Хорошо" },
  average:{ en:"Average", tr:"Orta", az:"Orta", ru:"Средний" },
  poor:{ en:"Poor", tr:"Zayıf", az:"Zəif", ru:"Слабый" },

  single:{ en:"Single", tr:"Bekar", az:"Subay", ru:"Холост" },
  married:{ en:"Married", tr:"Evli", az:"Evli", ru:"Женат" },

  azerbaijan:{ en:"Azerbaijan", tr:"Azerbaycan", az:"Azərbaycan", ru:"Азербайджан" },
  turkey:{ en:"Turkey", tr:"Türkiye", az:"Türkiyə", ru:"Турция" },
  russia:{ en:"Russia", tr:"Rusya", az:"Rusiya", ru:"Россия" },
  baku:{ en:"Baku", tr:"Bakü", az:"Bakı", ru:"Баку" },

  oiler:{ en:"Oiler", tr:"Yağcı", az:"Yağçı", ru:"Моторист" },
  motorman:{ en:"Motorman", tr:"Makine Tayfası", az:"Motorçu", ru:"Моторист" },
  cadet:{ en:"Cadet", tr:"Stajyer", az:"Kadet", ru:"Кадет" },
  captain:{ en:"Captain", tr:"Kaptan", az:"Kapitan", ru:"Капитан" },
  engineer:{ en:"Engineer", tr:"Mühendis", az:"Mühəndis", ru:"Инженер" }
};

function normalizeText(value){
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/ı/g,"i")
    .replace(/ə/g,"e")
    .replace(/ü/g,"u")
    .replace(/ö/g,"o")
    .replace(/ş/g,"s")
    .replace(/ç/g,"c")
    .replace(/ğ/g,"g")
    .replace(/\s+/g," ");
}

function translateUserValue(value){
  const raw = String(value || "");
  const key = normalizeText(raw);

  for(const itemKey in valueTranslations){
    const item = valueTranslations[itemKey];

    const matched = Object.values(item).some(v => normalizeText(v) === key);

    if(matched){
      return item[currentLang] || raw;
    }
  }

  return raw;
}

function syncCV(){
  textFields.forEach(id => {
    const translated = translateUserValue(valueOf(id));
    setCV(id, escapeHTML(translated).replace(/\n/g, "<br>"));
  });

  renderAdditionals();
  renderSTCW();
  renderSea();
}
  function translateDynamicValue(value){
  return translateUserValue(value);
}

function renderAdditionals(){
  const tbody = document.getElementById("cv_additionalRows");
  if(!tbody) return;

  tbody.innerHTML = "";

  additionalData.forEach(item => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${escapeHTML(translateDynamicValue(item.name))}</td>
      <td>${escapeHTML(translateDynamicValue(item.institute))}</td>
      <td>${escapeHTML(translateDynamicValue(item.place))}</td>
      <td>${escapeHTML(item.issue)}</td>
      <td>${escapeHTML(item.cert)}</td>
      <td>${escapeHTML(item.expiry)}</td>
    `;

    tbody.appendChild(tr);
  });
}

function renderSTCW(){
  const tbody = document.getElementById("cv_stcwRows");
  if(!tbody) return;

  tbody.innerHTML = "";

  stcwData.forEach(item => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${escapeHTML(translateDynamicValue(item.name))}</td>
      <td>${escapeHTML(translateDynamicValue(item.institute))}</td>
      <td>${escapeHTML(translateDynamicValue(item.place))}</td>
      <td>${escapeHTML(item.issue)}</td>
      <td>${escapeHTML(translateDynamicValue(item.rank))}</td>
      <td>${escapeHTML(item.cert)}</td>
      <td>${escapeHTML(item.expiry)}</td>
    `;

    tbody.appendChild(tr);
  });
}

function renderSea(){
  const tbody = document.getElementById("cv_seaRows");
  if(!tbody) return;

  tbody.innerHTML = "";

  seaData.forEach(item => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${escapeHTML(translateDynamicValue(item.vessel))}</td>
      <td>${escapeHTML(translateDynamicValue(item.company))}</td>
      <td>${escapeHTML(translateDynamicValue(item.type))}</td>
      <td>${escapeHTML(translateDynamicValue(item.flag))}</td>
      <td>${escapeHTML(item.dwt)}</td>
      <td>${escapeHTML(item.grt)}</td>
      <td>${escapeHTML(translateDynamicValue(item.rank))}</td>
      <td>${escapeHTML(item.signon)}</td>
      <td>${escapeHTML(item.signoff)}</td>
    `;

    tbody.appendChild(tr);
  });
}
