const cvDraftStore = window.AllonaMaritimeCvDraft;
let currentLang = ["en", "tr", "az", "ru"].includes(document.documentElement.lang) ? document.documentElement.lang : "en";

const textFields = [
  "position","familyName","firstName","fatherName","birth","birthDate","birthPlace","nationality","gender","marital","address","airport",
  "height","weight","eyes","hair","shoes","overall",
  "mobile","email","kinName","kinPhone","kinRelation","kinAddress",
  "passportDoc","passportNo","passportCountry","passportPlace","passportIssued","passportValid",
  "windows","office","internet",
  "seamanBookNo","seamanBookPlace","seamanBookIssued","seamanBookValid",
  "seafarerIdNo","seafarerIdPlace","seafarerIdIssued","seafarerIdValid",
  "schoolName","schoolPlace","schoolGrade","schoolFrom","schoolTo",
  "azSpeak","azRead","azWrite","trSpeak","trRead","trWrite",
  "enSpeak","enRead","enWrite","ruSpeak","ruRead","ruWrite",
  "medicalDoc","medicalFitness","medicalGrade","medicalPlace","medicalIssue","medicalExpiry",
  "tradeSpecialty","competencyClass","competencyCountry","competencyCertificate",
  "competencyIssued","competencyExpires","competencyLimit","note"
];
const maxTextLength = 2000;
const maxRepeatFieldLength = 300;
const immutableIdentityFieldIds = Object.freeze([
  "position", "firstName", "familyName", "fatherName", "birthDate", "birthPlace", "nationality", "gender", "marital", "address", "airport"
]);
let identityLockState = Object.freeze({ locked: false, fields: [] });
let identityFieldNoticeTimer = 0;
const dateFieldIds = new Set([
  "birthDate", "passportIssued", "passportValid", "seamanBookIssued", "seamanBookValid",
  "seafarerIdIssued", "seafarerIdValid", "schoolFrom", "schoolTo", "medicalIssue", "medicalExpiry",
  "competencyIssued", "competencyExpires"
]);
const repeatRowKeys = Object.freeze({
  additional: Object.freeze(["name", "institute", "place", "issue", "cert", "expiry"]),
  stcw: Object.freeze(["presetId", "code", "name", "institute", "place", "issue", "rank", "cert", "number", "expiry", "unlimited", "included"]),
  sea: Object.freeze([
    "imo", "vessel", "company", "type", "flag", "dwt", "grt", "netTonnage", "buildYear", "mmsi", "callSign", "lengthOverall",
    "rank", "signon", "signoff", "referenceName", "referenceCompanyEmail", "referenceCompanyPhone", "referencePhone", "lookupProvider", "lookupFetchedAt",
    "vesselPhotoUrl", "vesselPhotoSourceUrl", "vesselPhotoCredit",
    "rowId", "serviceDocumentId", "serviceDocumentName", "serviceDocumentSize", "serviceDocumentStatus", "saved"
  ])
});

const maxSeaServiceDocumentBytes = 45 * 1024 * 1024;

function createSeaRowId(){
  if(window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(character){
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 3) | 8;
    return value.toString(16);
  });
}

const stcwPresets = Object.freeze([
  Object.freeze({ id: "sp", code: "SP", titleKey: "stcwSp", editableTitle: false, required: true }),
  Object.freeze({ id: "sh", code: "SH", titleKey: "stcwSh", editableTitle: false, required: true }),
  Object.freeze({ id: "si", code: "SI", titleKey: "stcwSi", editableTitle: false, required: true }),
  Object.freeze({ id: "sl", code: "SL", titleKey: "stcwSl", editableTitle: false, required: true }),
  Object.freeze({ id: "so", code: "SO", titleKey: "stcwSo", editableTitle: false, required: true }),
  Object.freeze({ id: "sa", code: "SA", titleKey: "stcwSa", editableTitle: true })
]);

function newStcwRow(preset){
  return {
    presetId: preset?.id || "",
    code: preset?.code || "",
    name: "",
    institute: "",
    place: "",
    issue: "",
    rank: "",
    cert: "",
    number: "",
    expiry: "",
    unlimited: "false",
    included: "true"
  };
}

function newSeaRow(){
  return {
    rowId:createSeaRowId(),
    imo:"",
    vessel:"",
    company:"",
    type:"",
    flag:"",
    dwt:"",
    grt:"",
    netTonnage:"",
    buildYear:"",
    mmsi:"",
    callSign:"",
    lengthOverall:"",
    rank:"",
    signon:"",
    signoff:"",
    referenceName:"",
    referenceCompanyEmail:"",
    referenceCompanyPhone:"",
    referencePhone:"",
    lookupProvider:"",
    lookupFetchedAt:"",
    vesselPhotoUrl:"",
    vesselPhotoSourceUrl:"",
    vesselPhotoCredit:"",
    serviceDocumentId:"",
    serviceDocumentName:"",
    serviceDocumentSize:"",
    serviceDocumentStatus:"",
    saved:"false"
  };
}

let additionalData = [];
let stcwData = stcwPresets.map(newStcwRow);
let seaData = [];
let summaryMode = "auto";
const maxRepeatRows = 50;
let autoSaveTimer = 0;

function valueOf(id){
  const el = document.getElementById(id);
  return el ? el.value : "";
}

function setCV(id, value){
  const el = document.getElementById("cv_" + id);
  if(el){
    el.innerHTML = value || "";
  }
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

function trustedVesselPhotoUrl(value){
  try{
    const url = new URL(String(value || ""));
    if(url.protocol !== "https:") return "";
    const allowed = url.hostname === "static.vesselfinder.net" && /^\/ship-photo\/\d{7}-/i.test(url.pathname);
    return allowed ? url.href : "";
  } catch(error){
    return "";
  }
}

function trustedVesselPhotoSourceUrl(value){
  try{
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && url.hostname === "www.vesselfinder.com" && /^\/vessels\/details\/\d{7}$/i.test(url.pathname)
      ? url.href
      : "";
  } catch(error){
    return "";
  }
}
  const translations = {
  en: {
    formTitle:"CV Information",
    moduleSubtitle:"Manage your maritime career details in one profile",
    back:"Back",
    home:"Home",
    moduleReturn:"Back to Module",
    documents:"My Documents",
    globalCv:"Global CV",
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
    birthDate:"Date of Birth",
    birthPlace:"Place of Birth",
    nationality:"Nationality",
    gender:"Gender",
    marital:"Marital Status",
    selectGender:"Select gender",
    genderMale:"Male",
    genderFemale:"Female",
    selectMaritalStatus:"Select marital status",
    maritalSingle:"Single",
    maritalMarried:"Married",
    maritalDivorced:"Divorced",
    maritalWidowed:"Widowed",
    maritalSeparated:"Separated",
    address:"Permanent Address",
    airport:"Nearest Airport",
    photo:"PHOTO",
    removePhoto:"Remove photo",
    photoHelp:"Add a clear portrait photo. You can remove it and upload another photo at any time.",

    height:"Height",
    weight:"Weight",
    eyes:"Eyes Color",
    hair:"Hair Color",
    shoes:"Safety Shoes",
    overall:"Overalls",
    selectEyeColor:"Select eye color",
    selectHairColor:"Select hair color",
    selectShoeSize:"Select shoe size",
    selectOverallSize:"Select overall size",
    colorBrown:"Brown",
    colorBlack:"Black",
    colorBlue:"Blue",
    colorGreen:"Green",
    colorHazel:"Hazel",
    colorGrey:"Grey",
    colorBlond:"Blond",
    colorRed:"Red",
    colorWhite:"White",
    hairBald:"Bald",
    optionOther:"Other",

    mobile:"Mobile",
    email:"E-mail Address",
    kinName:"Next of Kin",
    kinPhone:"Phone",
    kinRelation:"Relationship",
    kinAddress:"Address",
    selectRelationship:"Select relationship",
    relationshipSpouse:"Spouse",
    relationshipParent:"Parent",
    relationshipChild:"Child",
    relationshipSibling:"Sibling",

    document:"Document",
    number:"Number",
    placeOfIssue:"Place of Issue",
    issued:"Issued",
    valid:"Valid",
    selectPassportType:"Select passport type",
    passportOrdinary:"Ordinary passport",
    passportDiplomatic:"Diplomatic passport",
    passportService:"Service / official passport",
    passportSpecial:"Special passport",
    passportTemporary:"Temporary / emergency passport",
    passportRefugee:"Refugee travel document",

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
    selectSkillLevel:"Select level",
    skillGood:"Good",
    skillIntermediate:"Intermediate",
    skillBasic:"Basic",

    grade:"Grade",
    validityPeriod:"Validity Period",
    dateOfIssue:"Date of Issue",
    dateOfExpiry:"Date of Expiry",
    dateIssued:"Date Issued",
    dateExpiry:"Date of Expiry",

    classGrade:"Class / Grade",
    issuingCountry:"Issuing Country",
    certificate:"Certificate",
    expires:"Expires",
    limitations:"Details of Limitations",
    competencyHelp:"Add your officer competency, welder, fitter or other professional competency certificate here.",
    tradeSpecialty:"Certified trade specialty",
    selectTradeSpecialty:"No additional trade specialty",
    tradeWelder:"Welder",
    tradeFlameCutter:"Flame Cutter",
    tradeFitter:"Fitter",
    tradeSpecialtyHelp:"Choose this only when you hold the corresponding professional certificate. It will appear next to your position in the CV.",

    courseName:"Course / Certificate",
    certificateCode:"Certificate Code",
    certificateNumber:"Certificate No.",
    certificateNumberPlaceholder:"Enter only the number after the code",
    unlimited:"No expiry / Unlimited",
    requiredBadge:"Required",
    optionalBadge:"Optional",
    includeInCv:"Show in CV",
    requiredCvMessage:"Complete the required fields before saving, downloading, or creating your Global CV: {fields}.",
    medicalFitness:"Medical fitness",
    selectMedicalFitness:"Select fitness status",
    fit:"Fit",
    fitWithRestrictions:"Fit with restrictions",
    unfit:"Unfit",
    additionalCertificatesHelp:"Add welder, fitter and any other professional certificates not listed below.",
    stcwHelp:"Enter only your certificate number, issue details and validity for the prepared STCW rows. You can add another certificate at any time.",
    customCertificate:"Other STCW Certificate",
    customCertificateName:"Certificate name",
    automaticCodeShort:"AUTO",
    stcwSp:"International Safety Management (ISM Code)",
    stcwSh:"Designated Security Duties (DSD)",
    stcwSi:"Security Awareness Training",
    stcwSl:"Proficiency in Survival Craft and Rescue Boats (PSCRB)",
    stcwSo:"Basic Safety Training (BST)",
    stcwSa:"Chemical Tanker Certificate (SA)",
    institute:"Institute",
    place:"Place",
    rank:"Rank",
    vessel:"Vessel",
    vesselPhoto:"Vessel photo",
    company:"Company",
    vesselType:"Type of Vessel",
    flag:"Flag",
    signOn:"Sign On",
    signOff:"Sign Off",
    imoNumber:"IMO Number",
    lookupVessel:"Find Vessel by IMO",
    lookupSuccess:"Available vessel details were added from the connected or open vessel register. Verify the values and complete any missing fields.",
    lookupFailed:"Vessel details could not be retrieved. Check the IMO number and complete the fields manually.",
    lookupManualHint:"Enter a valid IMO number to retrieve available vessel particulars. Fields not returned by the provider remain editable.",
    mmsi:"MMSI",
    callSign:"Call Sign",
    buildYear:"Year Built",
    lengthOverall:"Length Overall (m)",
    netTonnage:"Net Tonnage",
    referenceDetails:"Reference Contact Details",
    referenceName:"Authorized / Reference Person",
    referenceCompanyEmail:"Company E-mail",
    referenceCompanyPhone:"Company Phone",
    referencePhone:"Authorized Person Phone",
    seaRequiredMessage:"Complete the required sea-service and reference fields for experience {row}: {fields}.",
    serviceDocument:"Sea-service document",
    addServiceDocument:"Add Service Document",
    replaceServiceDocument:"Replace Service Document",
    serviceDocumentHelp:"Take a photo, choose an image from your library, or select an existing PDF. Images are converted to PDF and stored securely.",
    serviceDocumentChooseTitle:"How would you like to add the sea-service document?",
    serviceDocumentCamera:"Take a Photo",
    serviceDocumentLibrary:"Choose from Photo Library",
    serviceDocumentPdf:"Choose PDF from Files",
    serviceDocumentRequired:"Sea-service document",
    serviceDocumentSelected:"Document: {name}",
    serviceDocumentUploading:"Saving the sea-service document...",
    serviceDocumentUploaded:"The sea-service document was saved securely.",
    serviceDocumentFailed:"The sea-service document could not be saved. Sign in and try again.",
    serviceDocumentInvalid:"Select a PDF, JPEG, PNG or WebP document.",
    serviceDocumentTooLarge:"The sea-service document cannot exceed 45 MB.",
    serviceDocumentLink:"View sea-service document",
    saveExperience:"Save Experience",
    experienceSaved:"Saved and added to the CV",
    experienceNeedsSave:"Complete the required fields and save this experience.",
    experienceSaving:"Saving the experience and creating the reference verification record...",
    experienceSavedAlert:"The sea experience was saved and added to the CV.",
    referenceNotificationSent:" The reference verification notice was sent to AllonaHub.",
    referenceNotificationQueued:" The reference verification notice was queued securely.",
    experienceSaveFailed:"The sea experience could not be saved.",
    experienceDateInvalid:"The sign-off date cannot be earlier than the sign-on date.",

    addAdditional:"+ Add Additional Row",
    addSTCW:"+ Add STCW Certificate",
    addSea:"+ Add Sea Experience",
    deleteRow:"Delete Row",
    deleteCertificate:"Delete Certificate",
    deleteExperience:"Delete Experience",
    noteHelp:"Leave this field empty to create a professional summary from your position, certificates and sea experience.",
    notePlaceholder:"Optional personal note",
    generateSummary:"Create summary from my information",
    summaryGenerated:"The professional summary was created from your CV information.",
    removePhotoFailed:"The photo could not be removed from your account. Please try again.",
    photoRemoved:"The profile photo was removed.",
    saveDraft:"Save",
    backToTop:"Back to top",
    downloadPdf:"Download PDF · $7",
    clearForm:"Clear",
    cvLanguage:"CV language",
    photoAlt:"CV profile photo",
    draftSaved:"Your Maritime CV draft will remain saved until you clear it.",
    accountDraftSaved:"Your Maritime CV draft was saved. Complete the required fields to create Global CV.",
    accountDraftSavedFinalFailed:"Your draft was saved, but secure finalization was not completed. Verify the missing fields or device confirmation and save again.",
    accountSaved:"Your Maritime CV and photo were saved to your account.",
    accountSaving:"Saving Maritime CV to your account...",
    accountLoading:"Loading your saved Maritime CV...",
    accountLoaded:"Your saved Maritime CV is open.",
    accountStart:"Complete the relevant fields to add your Maritime CV to your account.",
    accountFieldsRequired:"Complete the relevant fields to add your Maritime CV to your account.",
    signIn:"Sign in",
    accountSaveFailed:"Your Maritime CV could not be saved to your account. Please try again.",
    accountLoginRequired:"Sign in to save your Maritime CV to your account.",
    draftSaveFailed:"CV draft could not be saved. Check your browser storage settings.",
    identityLockedTitle:"Personal details are securely locked",
    identityLockedBody:"After the first save, personal details cannot be cleared or changed from this form. Your photo remains replaceable.",
    identityLockedField:"This personal detail is locked. Request a verified correction from support to change it.",
    identitySupportButton:"Request a correction",
    identitySupportTitle:"Personal detail correction",
    identitySupportLead:"For account security, locked identity details are changed only after a support review.",
    identitySupportMessage:"Explain which detail must be corrected and why",
    identitySupportPlaceholder:"State the incorrect detail, the correct information, and the reason for the change.",
    identitySupportCancel:"Cancel",
    identitySupportSend:"Send securely",
    identitySupportDetailRequired:"Explain the requested correction in at least 10 characters.",
    identitySupportSending:"Creating your secure support request...",
    identitySupportSent:"Your identity correction request was sent securely.",
    identitySupportAlreadyOpen:"You already have an open identity correction request.",
    identitySupportFailed:"The support request could not be created.",
    identityAlreadyRegistered:"This person is already registered. Contact support if these details belong to you.",
    identityChangeBlocked:"Saved personal details can only be changed through support verification.",
    deviceAlreadyBound:"This device is linked to another account. Contact support if you cannot access your account.",
    deviceSecurityFailed:"Secure device identification could not be completed. Check your browser security settings.",
    passkeyUnsupported:"This browser does not support secure device verification. Use current Safari, Chrome or Edge.",
    passkeyCancelled:"Device verification was cancelled or timed out.",
    passkeyRequired:"Verify with Touch ID, Face ID or your screen lock to save.",
    passkeyFailed:"Secure device verification failed. Please try again.",
    passkeyUnavailable:"Secure device verification is temporarily unavailable.",
    resetConfirmLocked:"Clear all non-personal information? Your locked identity details and photo will be kept.",
    resetConfirm:"Clear all information?",
    photoInvalid:"Profile photo must be JPEG, PNG or WebP and no larger than 12 MB.",
    photoUnsafe:"Profile photo could not be read safely.",
    photoReadFailed:"Profile photo could not be read.",
    rowLimit:"You can add up to 50 rows in this section.",
    pdfLibraryFailed:"The PDF library could not be loaded. Check your connection and try again.",
    pdfPreviewMissing:"The PDF preview was not found. Reload the page and try again.",
    pdfGenerationFailed:"The PDF could not be created. Please try again.",
    pdfLoginRequired:"Sign in before downloading your PDF.",
    pdfSaveRequired:"Save your Maritime CV before downloading the PDF.",
    pdfPaymentSecurityFailed:"The secure payment address could not be verified.",
    pdfPaymentFailed:"The $7 PDF payment could not be started. Saving and editing your CV remain free."
  },
    tr: {
    formTitle:"CV Bilgileri",
    moduleSubtitle:"Denizcilik kariyer bilgilerinizi tek profilde yönetin",
    back:"Geri Dön",
    home:"Ana Sayfa",
    moduleReturn:"Modüle Dön",
    documents:"Belgelerim",
    globalCv:"Global CV",
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
    birthDate:"Doğum Tarihi",
    birthPlace:"Doğum Yeri",
    nationality:"Uyruğu",
    gender:"Cinsiyet",
    marital:"Medeni Durum",
    selectGender:"Cinsiyet seçin",
    genderMale:"Erkek",
    genderFemale:"Kadın",
    selectMaritalStatus:"Medeni durum seçin",
    maritalSingle:"Bekar",
    maritalMarried:"Evli",
    maritalDivorced:"Boşanmış",
    maritalWidowed:"Dul",
    maritalSeparated:"Ayrı yaşıyor",
    address:"Daimi Adres",
    airport:"En Yakın Havalimanı",
    photo:"FOTOĞRAF",
    removePhoto:"Fotoğrafı Sil",
    photoHelp:"Net bir portre fotoğrafı ekleyin. İstediğiniz zaman silip başka bir fotoğraf yükleyebilirsiniz.",

    height:"Boy",
    weight:"Kilo",
    eyes:"Göz Rengi",
    hair:"Saç Rengi",
    shoes:"İş Ayakkabısı",
    overall:"Tulum Bedeni",
    selectEyeColor:"Göz rengi seçin",
    selectHairColor:"Saç rengi seçin",
    selectShoeSize:"Ayakkabı numarası seçin",
    selectOverallSize:"Tulum bedeni seçin",
    colorBrown:"Kahverengi",
    colorBlack:"Siyah",
    colorBlue:"Mavi",
    colorGreen:"Yeşil",
    colorHazel:"Ela",
    colorGrey:"Gri",
    colorBlond:"Sarı",
    colorRed:"Kızıl",
    colorWhite:"Beyaz",
    hairBald:"Kel",
    optionOther:"Diğer",

    mobile:"Telefon",
    email:"E-posta Adresi",
    kinName:"Yakın Kişi",
    kinPhone:"Telefon",
    kinRelation:"Yakınlık Derecesi",
    kinAddress:"Adres",
    selectRelationship:"Yakınlık derecesi seçin",
    relationshipSpouse:"Eş",
    relationshipParent:"Anne / Baba",
    relationshipChild:"Çocuk",
    relationshipSibling:"Kardeş",

    document:"Belge",
    number:"Numara",
    placeOfIssue:"Düzenleme Yeri",
    issued:"Veriliş",
    valid:"Geçerlilik",
    selectPassportType:"Pasaport türünü seçin",
    passportOrdinary:"Umuma mahsus pasaport",
    passportDiplomatic:"Diplomatik pasaport",
    passportService:"Hizmet / resmî pasaport",
    passportSpecial:"Hususi pasaport",
    passportTemporary:"Geçici / acil pasaport",
    passportRefugee:"Mülteci seyahat belgesi",

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
    selectSkillLevel:"Seviye seçin",
    skillGood:"İyi",
    skillIntermediate:"Orta",
    skillBasic:"Temel",

    grade:"Derece",
    validityPeriod:"Geçerlilik Süresi",
    dateOfIssue:"Veriliş Tarihi",
    dateOfExpiry:"Son Geçerlilik Tarihi",
    dateIssued:"Veriliş Tarihi",
    dateExpiry:"Son Geçerlilik",

    classGrade:"Sınıf / Derece",
    issuingCountry:"Düzenleyen Ülke",
    certificate:"Sertifika",
    expires:"Geçerlilik",
    limitations:"Sınırlamalar",
    competencyHelp:"Zabit yeterliliği, kaynakçı, fitter veya diğer mesleki yeterlilik belgenizi buraya ekleyin.",
    tradeSpecialty:"Belgeli mesleki uzmanlık",
    selectTradeSpecialty:"Ek mesleki uzmanlık yok",
    tradeWelder:"Kaynakçı",
    tradeFlameCutter:"Alevle Kesim Uzmanı",
    tradeFitter:"Fitter",
    tradeSpecialtyHelp:"Yalnız ilgili mesleki sertifikanız varsa seçin. Seçiminiz CV'de pozisyonunuzun yanında gösterilir.",

    courseName:"Kurs / Sertifika",
    certificateCode:"Sertifika Kodu",
    certificateNumber:"Sertifika No.",
    certificateNumberPlaceholder:"Koddan sonraki numarayı yazın",
    unlimited:"Süresiz / Limitsiz",
    requiredBadge:"Zorunlu",
    optionalBadge:"İsteğe bağlı",
    includeInCv:"CV'de göster",
    requiredCvMessage:"Kaydetmeden, indirmeden veya Global CV oluşturmadan önce zorunlu alanları tamamlayın: {fields}.",
    medicalFitness:"Sağlık uygunluğu",
    selectMedicalFitness:"Sağlık durumunu seçin",
    fit:"Uygun",
    fitWithRestrictions:"Kısıtlamayla uygun",
    unfit:"Uygun değil",
    additionalCertificatesHelp:"Kaynakçı, fitter ve aşağıda yer almayan diğer mesleki sertifikalarınızı ekleyin.",
    stcwHelp:"Hazır STCW satırlarında yalnızca sertifika numaranızı, veriliş bilgilerini ve geçerliliği girin. İstediğiniz zaman başka sertifika ekleyebilirsiniz.",
    customCertificate:"Diğer STCW Sertifikası",
    customCertificateName:"Sertifika adı",
    automaticCodeShort:"OTO",
    stcwSp:"Uluslararası Emniyet Yönetimi (ISM Kodu)",
    stcwSh:"Belirlenmiş Güvenlik Görevleri (DSD)",
    stcwSi:"Güvenlik Farkındalık Eğitimi",
    stcwSl:"Can Kurtarma Araçları ve Kurtarma Botları Kullanma Yeterliği (PSCRB)",
    stcwSo:"Temel Emniyet Eğitimi (BST)",
    stcwSa:"Kimyasal Tanker Sertifikası (SA)",
    institute:"Kurum",
    place:"Yer",
    rank:"Rütbe",
    vessel:"Gemi",
    vesselPhoto:"Gemi fotoğrafı",
    company:"Şirket",
    vesselType:"Gemi Tipi",
    flag:"Bayrak",
    signOn:"Katılış",
    signOff:"Ayrılış",
    imoNumber:"IMO Numarası",
    lookupVessel:"IMO ile Gemiyi Bul",
    lookupSuccess:"Bağlı veya açık gemi kaynağında bulunan bilgiler eklendi. Değerleri doğrulayın ve eksik alanları tamamlayın.",
    lookupFailed:"Gemi bilgileri alınamadı. IMO numarasını kontrol edip alanları elle tamamlayın.",
    lookupManualHint:"Geçerli IMO numarasını girerek mevcut gemi bilgilerini getirin. Sağlayıcının döndürmediği alanlar düzenlenebilir kalır.",
    mmsi:"MMSI",
    callSign:"Çağrı İşareti",
    buildYear:"İnşa Yılı",
    lengthOverall:"Tam Boy (m)",
    netTonnage:"Net Tonaj",
    referenceDetails:"Referans İletişim Bilgileri",
    referenceName:"Şirket Yetkilisi / Referans Kişi",
    referenceCompanyEmail:"Şirket E-postası",
    referenceCompanyPhone:"Şirket Telefonu",
    referencePhone:"Yetkili Kişi Telefonu",
    seaRequiredMessage:"{row}. deniz tecrübesi için zorunlu gemi ve referans alanlarını tamamlayın: {fields}.",
    serviceDocument:"Hizmet belgesi",
    addServiceDocument:"Hizmet Belgesi Ekle",
    replaceServiceDocument:"Hizmet Belgesini Değiştir",
    serviceDocumentHelp:"Fotoğraf çekin, arşivinizden görsel seçin veya mevcut PDF dosyasını ekleyin. Görseller PDF'e dönüştürülerek güvenli biçimde saklanır.",
    serviceDocumentChooseTitle:"Hizmet belgesini nasıl eklemek istersiniz?",
    serviceDocumentCamera:"Fotoğraf Çek",
    serviceDocumentLibrary:"Fotoğraf Arşivinden Seç",
    serviceDocumentPdf:"Dosyalardan PDF Seç",
    serviceDocumentRequired:"Hizmet belgesi",
    serviceDocumentSelected:"Belge: {name}",
    serviceDocumentUploading:"Hizmet belgesi kaydediliyor...",
    serviceDocumentUploaded:"Hizmet belgesi güvenli biçimde kaydedildi.",
    serviceDocumentFailed:"Hizmet belgesi kaydedilemedi. Giriş yapıp yeniden deneyin.",
    serviceDocumentInvalid:"PDF, JPEG, PNG veya WebP belge seçin.",
    serviceDocumentTooLarge:"Hizmet belgesi 45 MB'tan büyük olamaz.",
    serviceDocumentLink:"Hizmet belgesini görüntüle",
    saveExperience:"Tecrübeyi Kaydet",
    experienceSaved:"Kaydedildi ve CV'ye eklendi",
    experienceNeedsSave:"Zorunlu alanları tamamlayıp bu tecrübeyi kaydedin.",
    experienceSaving:"Tecrübe kaydediliyor ve referans doğrulama kaydı oluşturuluyor...",
    experienceSavedAlert:"Deniz tecrübesi kaydedildi ve CV'ye eklendi.",
    referenceNotificationSent:" Referans doğrulama bildirimi AllonaHub'a gönderildi.",
    referenceNotificationQueued:" Referans doğrulama bildirimi güvenli kuyruğa alındı.",
    experienceSaveFailed:"Deniz tecrübesi kaydedilemedi.",
    experienceDateInvalid:"Ayrılış tarihi katılış tarihinden önce olamaz.",

    addAdditional:"+ Ek Sertifika Ekle",
    addSTCW:"+ STCW Sertifikası Ekle",
    addSea:"+ Deniz Tecrübesi Ekle",
    deleteRow:"Satırı Sil",
    deleteCertificate:"Sertifikayı Sil",
    deleteExperience:"Tecrübeyi Sil",
    noteHelp:"Pozisyonunuz, sertifikalarınız ve deniz tecrübenizden profesyonel özet oluşturulması için bu alanı boş bırakın.",
    notePlaceholder:"İsteğe bağlı kişisel not",
    generateSummary:"Bilgilerimden Özet Oluştur",
    summaryGenerated:"Profesyonel özet CV bilgilerinizden oluşturuldu.",
    removePhotoFailed:"Fotoğraf hesabınızdan silinemedi. Lütfen yeniden deneyin.",
    photoRemoved:"Profil fotoğrafı silindi.",
    saveDraft:"Kaydet",
    backToTop:"Başa Dön",
    downloadPdf:"PDF İndir · 7 USD",
    clearForm:"Temizle",
    cvLanguage:"CV dili",
    photoAlt:"CV profil fotoğrafı",
    draftSaved:"Maritime CV taslağınız siz temizleyene kadar kayıtlı kalır.",
    accountDraftSaved:"Maritime CV taslağınız kaydedildi. Global CV oluşturmak için zorunlu alanları tamamlayın.",
    accountDraftSavedFinalFailed:"Taslağınız kaydedildi ancak güvenli son kayıt tamamlanamadı. Eksik alanları veya cihaz doğrulamasını kontrol edip yeniden kaydedin.",
    accountSaved:"Maritime CV bilgileriniz ve fotoğrafınız hesabınıza kaydedildi.",
    accountSaving:"Maritime CV hesabınıza kaydediliyor...",
    accountLoading:"Kayıtlı Maritime CV bilgileriniz yükleniyor...",
    accountLoaded:"Kayıtlı Maritime CV bilgileriniz açıldı.",
    accountStart:"Maritime CV'nizin hesabınıza eklenebilmesi için ilgili alanları doldurun.",
    accountFieldsRequired:"Maritime CV'nizin hesabınıza eklenebilmesi için ilgili alanları doldurun.",
    signIn:"Giriş yapın",
    accountSaveFailed:"Maritime CV hesabınıza kaydedilemedi. Lütfen tekrar deneyin.",
    accountLoginRequired:"Maritime CV'nizi hesabınıza kaydetmek için giriş yapın.",
    draftSaveFailed:"CV taslağı kaydedilemedi. Tarayıcı depolama ayarlarını kontrol edin.",
    identityLockedTitle:"Kişisel bilgiler güvenle kilitlendi",
    identityLockedBody:"İlk kayıttan sonra kişisel bilgiler bu formdan temizlenemez veya değiştirilemez. Fotoğrafınızı değiştirmeye devam edebilirsiniz.",
    identityLockedField:"Bu kişisel bilgi kilitlidir. Değişiklik için destekten doğrulanmış düzeltme talebi açın.",
    identitySupportButton:"Düzeltme talebi oluştur",
    identitySupportTitle:"Kişisel bilgi düzeltme talebi",
    identitySupportLead:"Hesap güvenliği için kilitli kimlik bilgileri yalnız destek incelemesinden sonra değiştirilir.",
    identitySupportMessage:"Hangi bilginin neden düzeltilmesi gerektiğini açıklayın",
    identitySupportPlaceholder:"Yanlış bilgiyi, doğru bilgiyi ve değişiklik nedenini yazın.",
    identitySupportCancel:"Vazgeç",
    identitySupportSend:"Güvenli gönder",
    identitySupportDetailRequired:"İstenen düzeltmeyi en az 10 karakterle açıklayın.",
    identitySupportSending:"Güvenli destek talebiniz oluşturuluyor...",
    identitySupportSent:"Kimlik düzeltme talebiniz güvenli biçimde gönderildi.",
    identitySupportAlreadyOpen:"Zaten açık bir kimlik düzeltme talebiniz var.",
    identitySupportFailed:"Destek talebi oluşturulamadı.",
    identityAlreadyRegistered:"Bu kişi sistemde kayıtlıdır. Bilgiler size aitse destekle iletişime geçin.",
    identityChangeBlocked:"Kaydedilmiş kişisel bilgiler yalnız destek doğrulamasıyla değiştirilebilir.",
    deviceAlreadyBound:"Bu cihaz başka bir hesaba bağlıdır. Hesabınıza erişemiyorsanız destekle iletişime geçin.",
    deviceSecurityFailed:"Güvenli cihaz tanımlaması tamamlanamadı. Tarayıcı güvenlik ayarlarınızı kontrol edin.",
    passkeyUnsupported:"Bu tarayıcı güvenli cihaz doğrulamasını desteklemiyor. Güncel Safari, Chrome veya Edge kullanın.",
    passkeyCancelled:"Cihaz doğrulaması iptal edildi veya süresi doldu.",
    passkeyRequired:"Kaydetmek için Touch ID, Face ID veya ekran kilidinizle doğrulayın.",
    passkeyFailed:"Güvenli cihaz doğrulaması başarısız oldu. Yeniden deneyin.",
    passkeyUnavailable:"Güvenli cihaz doğrulaması geçici olarak kullanılamıyor.",
    resetConfirmLocked:"Kişisel bilgiler dışındaki tüm bilgiler temizlensin mi? Kilitli kimlik bilgileriniz ve fotoğrafınız korunacaktır.",
    resetConfirm:"Tüm bilgiler temizlensin mi?",
    photoInvalid:"Profil fotoğrafı JPEG, PNG veya WebP formatında ve en fazla 12 MB olmalıdır.",
    photoUnsafe:"Profil fotoğrafı güvenli biçimde okunamadı.",
    photoReadFailed:"Profil fotoğrafı okunamadı.",
    rowLimit:"Bu bölüme en fazla 50 satır eklenebilir.",
    pdfLibraryFailed:"PDF kütüphanesi yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.",
    pdfPreviewMissing:"PDF önizlemesi bulunamadı. Sayfayı yenileyip yeniden deneyin.",
    pdfGenerationFailed:"PDF oluşturulamadı. Lütfen yeniden deneyin.",
    pdfLoginRequired:"PDF indirmeden önce giriş yapın.",
    pdfSaveRequired:"PDF indirmeden önce Maritime CV'nizi kaydedin.",
    pdfPaymentSecurityFailed:"Güvenli ödeme adresi doğrulanamadı.",
    pdfPaymentFailed:"7 USD tutarındaki PDF ödemesi başlatılamadı. CV'yi kaydetmek ve düzenlemek ücretsiz kalır."
  },

    az: {
    formTitle:"CV Məlumatları",
    moduleSubtitle:"Dənizçilik karyera məlumatlarınızı bir profildə idarə edin",
    back:"Geri Qayıt",
    home:"Ana səhifə",
    moduleReturn:"Modula qayıt",
    documents:"Sənədlərim",
    globalCv:"Global CV",
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
    birthDate:"Doğum tarixi",
    birthPlace:"Doğum yeri",
    nationality:"Vətəndaşlıq",
    gender:"Cins",
    marital:"Ailə Vəziyyəti",
    selectGender:"Cinsi seçin",
    genderMale:"Kişi",
    genderFemale:"Qadın",
    selectMaritalStatus:"Ailə vəziyyətini seçin",
    maritalSingle:"Subay",
    maritalMarried:"Evli",
    maritalDivorced:"Boşanmış",
    maritalWidowed:"Dul",
    maritalSeparated:"Ayrı yaşayır",
    address:"Daimi Ünvan",
    airport:"Ən Yaxın Hava Limanı",
    photo:"FOTO",
    removePhoto:"Şəkli Sil",
    photoHelp:"Aydın portret şəkli əlavə edin. İstədiyiniz vaxt silib başqa şəkil yükləyə bilərsiniz.",

    height:"Boy",
    weight:"Çəki",
    eyes:"Göz Rəngi",
    hair:"Saç Rəngi",
    shoes:"İş Ayaqqabısı",
    overall:"Kombinezon Ölçüsü",
    selectEyeColor:"Göz rəngini seçin",
    selectHairColor:"Saç rəngini seçin",
    selectShoeSize:"Ayaqqabı ölçüsünü seçin",
    selectOverallSize:"Kombinezon ölçüsünü seçin",
    colorBrown:"Qəhvəyi",
    colorBlack:"Qara",
    colorBlue:"Mavi",
    colorGreen:"Yaşıl",
    colorHazel:"Fındıq rəngi",
    colorGrey:"Boz",
    colorBlond:"Sarı",
    colorRed:"Qızılı-qırmızı",
    colorWhite:"Ağ",
    hairBald:"Keçəl",
    optionOther:"Digər",

    mobile:"Mobil",
    email:"E-poçt Ünvanı",
    kinName:"Yaxın Şəxs",
    kinPhone:"Telefon",
    kinRelation:"Qohumluq Dərəcəsi",
    kinAddress:"Ünvan",
    selectRelationship:"Qohumluq dərəcəsini seçin",
    relationshipSpouse:"Həyat yoldaşı",
    relationshipParent:"Ana / Ata",
    relationshipChild:"Övlad",
    relationshipSibling:"Bacı / Qardaş",

    document:"Sənəd",
    number:"Nömrə",
    placeOfIssue:"Verilmə Yeri",
    issued:"Verilmə Tarixi",
    valid:"Etibarlıdır",
    selectPassportType:"Pasport növünü seçin",
    passportOrdinary:"Ümumvətəndaş pasportu",
    passportDiplomatic:"Diplomatik pasport",
    passportService:"Xidməti / rəsmi pasport",
    passportSpecial:"Xüsusi pasport",
    passportTemporary:"Müvəqqəti / təcili pasport",
    passportRefugee:"Qaçqın səyahət sənədi",

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
    selectSkillLevel:"Səviyyəni seçin",
    skillGood:"Yaxşı",
    skillIntermediate:"Orta",
    skillBasic:"Əsas",

    grade:"Dərəcə",
    validityPeriod:"Etibarlılıq Müddəti",
    dateOfIssue:"Verilmə Tarixi",
    dateOfExpiry:"Bitmə Tarixi",
    dateIssued:"Verilmə Tarixi",
    dateExpiry:"Bitmə Tarixi",

    classGrade:"Sinif / Dərəcə",
    issuingCountry:"Verən Ölkə",
    certificate:"Sertifikat",
    expires:"Etibarlılıq",
    limitations:"Məhdudiyyətlər",
    competencyHelp:"Zabit səriştəsi, qaynaqçı, fitter və ya digər peşə səriştəsi sertifikatınızı buraya əlavə edin.",
    tradeSpecialty:"Sertifikatlı peşə ixtisası",
    selectTradeSpecialty:"Əlavə peşə ixtisası yoxdur",
    tradeWelder:"Qaynaqçı",
    tradeFlameCutter:"Alovla Kəsmə Mütəxəssisi",
    tradeFitter:"Fitter",
    tradeSpecialtyHelp:"Yalnız müvafiq peşə sertifikatınız varsa seçin. Seçim CV-də vəzifənizin yanında göstərilir.",

    courseName:"Kurs / Sertifikat",
    certificateCode:"Sertifikat Kodu",
    certificateNumber:"Sertifikat No.",
    certificateNumberPlaceholder:"Koddan sonrakı nömrəni yazın",
    unlimited:"Müddətsiz / Limitsiz",
    requiredBadge:"Məcburi",
    optionalBadge:"İstəyə bağlı",
    includeInCv:"CV-də göstər",
    requiredCvMessage:"Yadda saxlamadan, endirmədən və ya Global CV yaratmadan əvvəl məcburi sahələri tamamlayın: {fields}.",
    medicalFitness:"Tibbi uyğunluq",
    selectMedicalFitness:"Tibbi uyğunluğu seçin",
    fit:"Uyğundur",
    fitWithRestrictions:"Məhdudiyyətlə uyğundur",
    unfit:"Uyğun deyil",
    additionalCertificatesHelp:"Qaynaqçı, fitter və aşağıda göstərilməyən digər peşə sertifikatlarınızı əlavə edin.",
    stcwHelp:"Hazır STCW sətirlərində yalnız sertifikat nömrəsini, verilmə məlumatlarını və etibarlılığı daxil edin. İstədiyiniz vaxt başqa sertifikat əlavə edə bilərsiniz.",
    customCertificate:"Digər STCW Sertifikatı",
    customCertificateName:"Sertifikat adı",
    automaticCodeShort:"AUTO",
    stcwSp:"Beynəlxalq Təhlükəsizliyin İdarə Edilməsi (ISM Kodu)",
    stcwSh:"Təyin Edilmiş Təhlükəsizlik Vəzifələri (DSD)",
    stcwSi:"Təhlükəsizlik üzrə Məlumatlandırma Təlimi",
    stcwSl:"Xilasetmə Vasitələri və Xilasedici Qayıqlar üzrə Hazırlıq (PSCRB)",
    stcwSo:"Əsas Təhlükəsizlik Hazırlığı (BST)",
    stcwSa:"Kimyəvi Tanker Sertifikatı (SA)",
    institute:"Qurum",
    place:"Yer",
    rank:"Rütbə",
    vessel:"Gəmi",
    vesselPhoto:"Gəmi fotosu",
    company:"Şirkət",
    vesselType:"Gəmi Tipi",
    flag:"Bayraq",
    signOn:"Giriş",
    signOff:"Çıxış",
    imoNumber:"IMO Nömrəsi",
    lookupVessel:"IMO ilə Gəmini Tap",
    lookupSuccess:"Bağlı və ya açıq gəmi mənbəyində tapılan məlumatlar əlavə edildi. Dəyərləri yoxlayın və çatışmayan sahələri tamamlayın.",
    lookupFailed:"Gəmi məlumatları alınmadı. IMO nömrəsini yoxlayıb sahələri əl ilə tamamlayın.",
    lookupManualHint:"Mövcud gəmi məlumatlarını gətirmək üçün etibarlı IMO nömrəsini daxil edin. Təchizatçının qaytarmadığı sahələr redaktə edilə bilər.",
    mmsi:"MMSI",
    callSign:"Çağırış İşarəsi",
    buildYear:"İnşa İli",
    lengthOverall:"Ümumi Uzunluq (m)",
    netTonnage:"Net Tonaj",
    referenceDetails:"Referans Əlaqə Məlumatları",
    referenceName:"Şirkət Nümayəndəsi / Referans Şəxs",
    referenceCompanyEmail:"Şirkət E-poçtu",
    referenceCompanyPhone:"Şirkət Telefonu",
    referencePhone:"Səlahiyyətli Şəxsin Telefonu",
    seaRequiredMessage:"{row}-ci dəniz təcrübəsi üçün məcburi gəmi və referans sahələrini tamamlayın: {fields}.",
    serviceDocument:"Dəniz xidməti sənədi",
    addServiceDocument:"Xidmət Sənədi Əlavə Et",
    replaceServiceDocument:"Xidmət Sənədini Dəyişdir",
    serviceDocumentHelp:"Şəkil çəkin, qalereyadan şəkil seçin və ya mövcud PDF faylını əlavə edin. Şəkillər PDF-ə çevrilərək təhlükəsiz saxlanılır.",
    serviceDocumentChooseTitle:"Xidmət sənədini necə əlavə etmək istəyirsiniz?",
    serviceDocumentCamera:"Şəkil Çək",
    serviceDocumentLibrary:"Foto Qalereyadan Seç",
    serviceDocumentPdf:"Fayllardan PDF Seç",
    serviceDocumentRequired:"Dəniz xidməti sənədi",
    serviceDocumentSelected:"Sənəd: {name}",
    serviceDocumentUploading:"Xidmət sənədi saxlanılır...",
    serviceDocumentUploaded:"Xidmət sənədi təhlükəsiz saxlanıldı.",
    serviceDocumentFailed:"Xidmət sənədi saxlanmadı. Daxil olub yenidən cəhd edin.",
    serviceDocumentInvalid:"PDF, JPEG, PNG və ya WebP sənədi seçin.",
    serviceDocumentTooLarge:"Xidmət sənədi 45 MB-dan böyük ola bilməz.",
    serviceDocumentLink:"Xidmət sənədinə bax",
    saveExperience:"Təcrübəni Yadda Saxla",
    experienceSaved:"Yadda saxlanıldı və CV-yə əlavə edildi",
    experienceNeedsSave:"Məcburi sahələri tamamlayıb bu təcrübəni yadda saxlayın.",
    experienceSaving:"Təcrübə saxlanılır və referans yoxlama qeydi yaradılır...",
    experienceSavedAlert:"Dəniz təcrübəsi yadda saxlanıldı və CV-yə əlavə edildi.",
    referenceNotificationSent:" Referans yoxlama bildirişi AllonaHub-a göndərildi.",
    referenceNotificationQueued:" Referans yoxlama bildirişi təhlükəsiz növbəyə alındı.",
    experienceSaveFailed:"Dəniz təcrübəsi yadda saxlanmadı.",
    experienceDateInvalid:"Çıxış tarixi giriş tarixindən əvvəl ola bilməz.",

    addAdditional:"+ Əlavə Sertifikat Əlavə Et",
    addSTCW:"+ STCW Sertifikatı Əlavə Et",
    addSea:"+ Dəniz Təcrübəsi Əlavə Et",
    deleteRow:"Sətri Sil",
    deleteCertificate:"Sertifikatı Sil",
    deleteExperience:"Təcrübəni Sil",
    noteHelp:"Vəzifə, sertifikat və dəniz təcrübənizə əsasən peşəkar xülasə hazırlanması üçün bu sahəni boş saxlayın.",
    notePlaceholder:"İstəyə bağlı şəxsi qeyd",
    generateSummary:"Məlumatlarımdan Xülasə Yarat",
    summaryGenerated:"Peşəkar xülasə CV məlumatlarınızdan yaradıldı.",
    removePhotoFailed:"Şəkil hesabınızdan silinə bilmədi. Yenidən cəhd edin.",
    photoRemoved:"Profil şəkli silindi.",
    saveDraft:"Yadda saxla",
    backToTop:"Başa qayıt",
    downloadPdf:"PDF endir · 7 USD",
    clearForm:"Təmizlə",
    cvLanguage:"CV dili",
    photoAlt:"CV profil fotosu",
    draftSaved:"Maritime CV qaralamanız siz təmizləyənədək yadda saxlanacaq.",
    accountDraftSaved:"Maritime CV qaralamanız yadda saxlanıldı. Global CV yaratmaq üçün məcburi sahələri tamamlayın.",
    accountDraftSavedFinalFailed:"Qaralamanız yadda saxlanıldı, lakin təhlükəsiz yekun qeyd tamamlanmadı. Çatışmayan sahələri və ya cihaz təsdiqini yoxlayıb yenidən yadda saxlayın.",
    accountSaved:"Maritime CV məlumatlarınız və şəkliniz hesabınıza yazıldı.",
    accountSaving:"Maritime CV hesabınıza yazılır...",
    accountLoading:"Saxlanmış Maritime CV məlumatlarınız yüklənir...",
    accountLoaded:"Saxlanmış Maritime CV məlumatlarınız açıldı.",
    accountStart:"Maritime CV-nin hesabınıza əlavə edilməsi üçün müvafiq sahələri doldurun.",
    accountFieldsRequired:"Maritime CV-nin hesabınıza əlavə edilməsi üçün müvafiq sahələri doldurun.",
    signIn:"Daxil olun",
    accountSaveFailed:"Maritime CV hesabınıza yazıla bilmədi. Yenidən cəhd edin.",
    accountLoginRequired:"Maritime CV-ni hesabınıza yazmaq üçün daxil olun.",
    draftSaveFailed:"CV qaralaması saxlanmadı. Brauzer yaddaşı ayarlarını yoxlayın.",
    identityLockedTitle:"Şəxsi məlumatlar təhlükəsiz şəkildə kilidləndi",
    identityLockedBody:"İlk yadda saxlamadan sonra şəxsi məlumatlar bu formadan silinə və ya dəyişdirilə bilməz. Şəkli dəyişməyə davam edə bilərsiniz.",
    identityLockedField:"Bu şəxsi məlumat kilidlidir. Dəyişiklik üçün dəstəkdən təsdiqlənmiş düzəliş sorğusu yaradın.",
    identitySupportButton:"Düzəliş sorğusu yarat",
    identitySupportTitle:"Şəxsi məlumat düzəlişi",
    identitySupportLead:"Hesab təhlükəsizliyi üçün kilidli şəxsiyyət məlumatları yalnız dəstək yoxlamasından sonra dəyişdirilir.",
    identitySupportMessage:"Hansı məlumatın niyə düzəldilməli olduğunu izah edin",
    identitySupportPlaceholder:"Yanlış məlumatı, düzgün məlumatı və dəyişiklik səbəbini yazın.",
    identitySupportCancel:"Ləğv et",
    identitySupportSend:"Təhlükəsiz göndər",
    identitySupportDetailRequired:"İstənilən düzəlişi ən azı 10 simvolla izah edin.",
    identitySupportSending:"Təhlükəsiz dəstək sorğunuz yaradılır...",
    identitySupportSent:"Şəxsiyyət düzəlişi sorğunuz təhlükəsiz şəkildə göndərildi.",
    identitySupportAlreadyOpen:"Artıq açıq şəxsiyyət düzəlişi sorğunuz var.",
    identitySupportFailed:"Dəstək sorğusu yaradıla bilmədi.",
    identityAlreadyRegistered:"Bu şəxs sistemdə qeydiyyatdadır. Məlumatlar sizə aiddirsə, dəstəklə əlaqə saxlayın.",
    identityChangeBlocked:"Yadda saxlanmış şəxsi məlumatlar yalnız dəstək təsdiqi ilə dəyişdirilə bilər.",
    deviceAlreadyBound:"Bu cihaz başqa hesaba bağlıdır. Hesabınıza daxil ola bilmirsinizsə, dəstəklə əlaqə saxlayın.",
    deviceSecurityFailed:"Təhlükəsiz cihaz tanınması tamamlanmadı. Brauzer təhlükəsizlik ayarlarını yoxlayın.",
    passkeyUnsupported:"Bu brauzer təhlükəsiz cihaz təsdiqini dəstəkləmir. Yeni Safari, Chrome və ya Edge istifadə edin.",
    passkeyCancelled:"Cihaz təsdiqi ləğv edildi və ya vaxtı bitdi.",
    passkeyRequired:"Yadda saxlamaq üçün Touch ID, Face ID və ya ekran kilidi ilə təsdiqləyin.",
    passkeyFailed:"Təhlükəsiz cihaz təsdiqi uğursuz oldu. Yenidən cəhd edin.",
    passkeyUnavailable:"Təhlükəsiz cihaz təsdiqi müvəqqəti olaraq əlçatan deyil.",
    resetConfirmLocked:"Şəxsi məlumatlardan başqa bütün məlumatlar silinsin? Kilidli şəxsiyyət məlumatlarınız və şəkliniz qorunacaq.",
    resetConfirm:"Bütün məlumatlar təmizlənsin?",
    photoInvalid:"Profil fotosu JPEG, PNG və ya WebP formatında və ən çox 12 MB olmalıdır.",
    photoUnsafe:"Profil fotosu təhlükəsiz şəkildə oxunmadı.",
    photoReadFailed:"Profil fotosu oxunmadı.",
    rowLimit:"Bu bölməyə ən çox 50 sətir əlavə edilə bilər.",
    pdfLibraryFailed:"PDF kitabxanası yüklənmədi. Bağlantını yoxlayıb yenidən cəhd edin.",
    pdfPreviewMissing:"PDF önizləməsi tapılmadı. Səhifəni yeniləyib təkrar cəhd edin.",
    pdfGenerationFailed:"PDF yaradıla bilmədi. Yenidən cəhd edin.",
    pdfLoginRequired:"PDF endirməzdən əvvəl daxil olun.",
    pdfSaveRequired:"PDF endirməzdən əvvəl Maritime CV-ni yadda saxlayın.",
    pdfPaymentSecurityFailed:"Təhlükəsiz ödəniş ünvanı təsdiqlənmədi.",
    pdfPaymentFailed:"7 USD məbləğində PDF ödənişi başladılmadı. CV-ni saxlamaq və redaktə etmək pulsuz qalır."
  },
    ru: {
    formTitle:"Информация CV",
    moduleSubtitle:"Управляйте данными морской карьеры в одном профиле",
    back:"Назад",
    home:"Главная",
    moduleReturn:"В модуль",
    documents:"Мои документы",
    globalCv:"Global CV",
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
    birthDate:"Дата рождения",
    birthPlace:"Место рождения",
    nationality:"Гражданство",
    gender:"Пол",
    marital:"Семейное Положение",
    selectGender:"Выберите пол",
    genderMale:"Мужской",
    genderFemale:"Женский",
    selectMaritalStatus:"Выберите семейное положение",
    maritalSingle:"Не состоит в браке",
    maritalMarried:"Состоит в браке",
    maritalDivorced:"Разведён(а)",
    maritalWidowed:"Вдовец / вдова",
    maritalSeparated:"Живёт отдельно",
    address:"Постоянный Адрес",
    airport:"Ближайший Аэропорт",
    photo:"ФОТО",
    removePhoto:"Удалить фото",
    photoHelp:"Добавьте чёткую портретную фотографию. Её можно удалить и заменить в любое время.",

    height:"Рост",
    weight:"Вес",
    eyes:"Цвет Глаз",
    hair:"Цвет Волос",
    shoes:"Защитная Обувь",
    overall:"Размер Комбинезона",
    selectEyeColor:"Выберите цвет глаз",
    selectHairColor:"Выберите цвет волос",
    selectShoeSize:"Выберите размер обуви",
    selectOverallSize:"Выберите размер комбинезона",
    colorBrown:"Карий",
    colorBlack:"Чёрный",
    colorBlue:"Голубой",
    colorGreen:"Зелёный",
    colorHazel:"Ореховый",
    colorGrey:"Серый",
    colorBlond:"Светлый",
    colorRed:"Рыжий",
    colorWhite:"Белый",
    hairBald:"Без волос",
    optionOther:"Другое",

    mobile:"Мобильный",
    email:"Электронная Почта",
    kinName:"Ближайший Родственник",
    kinPhone:"Телефон",
    kinRelation:"Степень Родства",
    kinAddress:"Адрес",
    selectRelationship:"Выберите степень родства",
    relationshipSpouse:"Супруг(а)",
    relationshipParent:"Родитель",
    relationshipChild:"Ребёнок",
    relationshipSibling:"Брат / сестра",

    document:"Документ",
    number:"Номер",
    placeOfIssue:"Место Выдачи",
    issued:"Выдан",
    valid:"Действителен",
    selectPassportType:"Выберите тип паспорта",
    passportOrdinary:"Обычный заграничный паспорт",
    passportDiplomatic:"Дипломатический паспорт",
    passportService:"Служебный / официальный паспорт",
    passportSpecial:"Специальный паспорт",
    passportTemporary:"Временный / экстренный паспорт",
    passportRefugee:"Проездной документ беженца",

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
    selectSkillLevel:"Выберите уровень",
    skillGood:"Хорошо",
    skillIntermediate:"Средне",
    skillBasic:"Базовый",

    grade:"Степень",
    validityPeriod:"Срок Действия",
    dateOfIssue:"Дата Выдачи",
    dateOfExpiry:"Срок Действия",
    dateIssued:"Дата Выдачи",
    dateExpiry:"Срок Действия",

    classGrade:"Класс / Степень",
    issuingCountry:"Страна Выдачи",
    certificate:"Сертификат",
    expires:"Истекает",
    limitations:"Ограничения",
    competencyHelp:"Добавьте сюда диплом судоводителя, сварщика, фиттера или другое профессиональное свидетельство.",
    tradeSpecialty:"Подтверждённая рабочая специальность",
    selectTradeSpecialty:"Без дополнительной специальности",
    tradeWelder:"Сварщик",
    tradeFlameCutter:"Газорезчик",
    tradeFitter:"Фиттер",
    tradeSpecialtyHelp:"Выберите только при наличии соответствующего профессионального сертификата. Специальность будет указана рядом с должностью в CV.",

    courseName:"Курс / Сертификат",
    certificateCode:"Код Сертификата",
    certificateNumber:"Номер Сертификата",
    certificateNumberPlaceholder:"Введите номер после кода",
    unlimited:"Бессрочно / Без ограничений",
    requiredBadge:"Обязательно",
    optionalBadge:"Необязательно",
    includeInCv:"Показывать в CV",
    requiredCvMessage:"Перед сохранением, скачиванием или созданием Global CV заполните обязательные поля: {fields}.",
    medicalFitness:"Медицинская годность",
    selectMedicalFitness:"Выберите статус годности",
    fit:"Годен",
    fitWithRestrictions:"Годен с ограничениями",
    unfit:"Не годен",
    additionalCertificatesHelp:"Добавьте свидетельства сварщика, фиттера и другие профессиональные сертификаты, которых нет ниже.",
    stcwHelp:"В готовых строках STCW укажите только номер, сведения о выдаче и срок действия. Другой сертификат можно добавить в любое время.",
    customCertificate:"Другой Сертификат STCW",
    customCertificateName:"Название сертификата",
    automaticCodeShort:"AUTO",
    stcwSp:"Международное управление безопасностью (Кодекс ISM)",
    stcwSh:"Назначенные обязанности по охране (DSD)",
    stcwSi:"Подготовка по осведомлённости в области охраны",
    stcwSl:"Подготовка по спасательным шлюпкам, плотам и дежурным шлюпкам (PSCRB)",
    stcwSo:"Начальная подготовка по безопасности (BST)",
    stcwSa:"Сертификат химического танкера (SA)",
    institute:"Учреждение",
    place:"Место",
    rank:"Должность",
    vessel:"Судно",
    vesselPhoto:"Фотография судна",
    company:"Компания",
    vesselType:"Тип Судна",
    flag:"Флаг",
    signOn:"Посадка",
    signOff:"Списание",
    imoNumber:"Номер IMO",
    lookupVessel:"Найти судно по IMO",
    lookupSuccess:"Добавлены сведения из подключенного или открытого реестра судов. Проверьте значения и заполните недостающие поля.",
    lookupFailed:"Не удалось получить сведения о судне. Проверьте номер IMO и заполните поля вручную.",
    lookupManualHint:"Введите действительный номер IMO для получения доступных характеристик судна. Поля, не возвращенные поставщиком, остаются редактируемыми.",
    mmsi:"MMSI",
    callSign:"Позывной",
    buildYear:"Год Постройки",
    lengthOverall:"Наибольшая Длина (м)",
    netTonnage:"Чистый Тоннаж",
    referenceDetails:"Контактные Данные Рекомендателя",
    referenceName:"Представитель Компании / Рекомендатель",
    referenceCompanyEmail:"E-mail Компании",
    referenceCompanyPhone:"Телефон Компании",
    referencePhone:"Телефон Представителя",
    seaRequiredMessage:"Заполните обязательные сведения о судне и рекомендателе для опыта № {row}: {fields}.",
    serviceDocument:"Документ о морском стаже",
    addServiceDocument:"Добавить Документ о Стаже",
    replaceServiceDocument:"Заменить Документ о Стаже",
    serviceDocumentHelp:"Сфотографируйте документ, выберите изображение из галереи или готовый PDF. Изображение будет преобразовано в PDF и сохранено безопасно.",
    serviceDocumentChooseTitle:"Как добавить документ о стаже?",
    serviceDocumentCamera:"Сфотографировать",
    serviceDocumentLibrary:"Выбрать из фотогалереи",
    serviceDocumentPdf:"Выбрать PDF из файлов",
    serviceDocumentRequired:"Документ о морском стаже",
    serviceDocumentSelected:"Документ: {name}",
    serviceDocumentUploading:"Документ о стаже сохраняется...",
    serviceDocumentUploaded:"Документ о стаже безопасно сохранён.",
    serviceDocumentFailed:"Не удалось сохранить документ о стаже. Войдите и повторите попытку.",
    serviceDocumentInvalid:"Выберите документ PDF, JPEG, PNG или WebP.",
    serviceDocumentTooLarge:"Размер документа не должен превышать 45 МБ.",
    serviceDocumentLink:"Посмотреть документ о стаже",
    saveExperience:"Сохранить Опыт",
    experienceSaved:"Сохранено и добавлено в CV",
    experienceNeedsSave:"Заполните обязательные поля и сохраните этот опыт.",
    experienceSaving:"Опыт сохраняется, запись проверки рекомендации создаётся...",
    experienceSavedAlert:"Морской опыт сохранён и добавлен в CV.",
    referenceNotificationSent:" Уведомление о проверке рекомендации отправлено в AllonaHub.",
    referenceNotificationQueued:" Уведомление о проверке рекомендации помещено в защищённую очередь.",
    experienceSaveFailed:"Не удалось сохранить морской опыт.",
    experienceDateInvalid:"Дата списания не может быть раньше даты посадки.",

    addAdditional:"+ Добавить Сертификат",
    addSTCW:"+ Добавить STCW",
    addSea:"+ Добавить Морской Опыт",
    deleteRow:"Удалить Строку",
    deleteCertificate:"Удалить Сертификат",
    deleteExperience:"Удалить Опыт",
    noteHelp:"Оставьте поле пустым, чтобы создать профессиональное резюме по должности, сертификатам и морскому опыту.",
    notePlaceholder:"Необязательное личное примечание",
    generateSummary:"Создать Резюме по Моим Данным",
    summaryGenerated:"Профессиональное резюме создано по данным CV.",
    removePhotoFailed:"Не удалось удалить фотографию из учетной записи. Повторите попытку.",
    photoRemoved:"Фотография профиля удалена.",
    saveDraft:"Сохранить",
    backToTop:"В начало",
    downloadPdf:"Скачать PDF · 7 USD",
    clearForm:"Очистить",
    cvLanguage:"Язык CV",
    photoAlt:"Фото профиля CV",
    draftSaved:"Черновик Maritime CV будет храниться, пока вы сами его не очистите.",
    accountDraftSaved:"Черновик Maritime CV сохранён. Заполните обязательные поля, чтобы создать Global CV.",
    accountDraftSavedFinalFailed:"Черновик сохранён, но защищённое финальное сохранение не завершено. Проверьте недостающие поля или подтверждение устройства и сохраните снова.",
    accountSaved:"Maritime CV и фотография сохранены в вашей учетной записи.",
    accountSaving:"Maritime CV сохраняется в вашей учетной записи...",
    accountLoading:"Загружается сохранённый Maritime CV...",
    accountLoaded:"Сохранённый Maritime CV открыт.",
    accountStart:"Заполните соответствующие поля, чтобы добавить Maritime CV в свою учётную запись.",
    accountFieldsRequired:"Заполните соответствующие поля, чтобы добавить Maritime CV в свою учётную запись.",
    signIn:"Войти",
    accountSaveFailed:"Не удалось сохранить Maritime CV. Повторите попытку.",
    accountLoginRequired:"Войдите, чтобы сохранить Maritime CV в учетной записи.",
    draftSaveFailed:"Не удалось сохранить черновик CV. Проверьте настройки хранилища браузера.",
    identityLockedTitle:"Личные данные надежно заблокированы",
    identityLockedBody:"После первого сохранения личные данные нельзя удалить или изменить в этой форме. Фотографию можно заменить.",
    identityLockedField:"Эти личные данные заблокированы. Для изменения создайте подтвержденный запрос в поддержку.",
    identitySupportButton:"Запросить исправление",
    identitySupportTitle:"Исправление личных данных",
    identitySupportLead:"Для безопасности аккаунта заблокированные данные меняются только после проверки поддержкой.",
    identitySupportMessage:"Объясните, какие данные и почему нужно исправить",
    identitySupportPlaceholder:"Укажите неверные данные, правильные данные и причину изменения.",
    identitySupportCancel:"Отмена",
    identitySupportSend:"Отправить безопасно",
    identitySupportDetailRequired:"Опишите исправление минимум в 10 символах.",
    identitySupportSending:"Создается защищенный запрос в поддержку...",
    identitySupportSent:"Запрос на исправление данных безопасно отправлен.",
    identitySupportAlreadyOpen:"У вас уже есть открытый запрос на исправление данных.",
    identitySupportFailed:"Не удалось создать запрос в поддержку.",
    identityAlreadyRegistered:"Этот человек уже зарегистрирован. Если данные принадлежат вам, обратитесь в поддержку.",
    identityChangeBlocked:"Сохраненные личные данные можно изменить только после проверки поддержкой.",
    deviceAlreadyBound:"Это устройство связано с другим аккаунтом. Если у вас нет доступа, обратитесь в поддержку.",
    deviceSecurityFailed:"Не удалось безопасно определить устройство. Проверьте настройки безопасности браузера.",
    passkeyUnsupported:"Этот браузер не поддерживает безопасную проверку устройства. Используйте актуальный Safari, Chrome или Edge.",
    passkeyCancelled:"Проверка устройства отменена или истекло время ожидания.",
    passkeyRequired:"Для сохранения подтвердите действие через Touch ID, Face ID или блокировку экрана.",
    passkeyFailed:"Безопасная проверка устройства не пройдена. Повторите попытку.",
    passkeyUnavailable:"Безопасная проверка устройства временно недоступна.",
    resetConfirmLocked:"Удалить все данные, кроме личных? Заблокированные данные и фотография будут сохранены.",
    resetConfirm:"Очистить всю информацию?",
    photoInvalid:"Фото профиля должно быть в формате JPEG, PNG или WebP и не превышать 12 МБ.",
    photoUnsafe:"Не удалось безопасно прочитать фото профиля.",
    photoReadFailed:"Не удалось прочитать фото профиля.",
    rowLimit:"В этот раздел можно добавить не более 50 строк.",
    pdfLibraryFailed:"Не удалось загрузить библиотеку PDF. Проверьте соединение и повторите попытку.",
    pdfPreviewMissing:"Предпросмотр PDF не найден. Обновите страницу и повторите попытку.",
    pdfGenerationFailed:"Не удалось создать PDF. Повторите попытку.",
    pdfLoginRequired:"Войдите в аккаунт перед скачиванием PDF.",
    pdfSaveRequired:"Сохраните Maritime CV перед скачиванием PDF.",
    pdfPaymentSecurityFailed:"Не удалось проверить безопасный адрес оплаты.",
    pdfPaymentFailed:"Не удалось начать оплату PDF стоимостью 7 USD. Сохранение и редактирование CV остаются бесплатными."
  }
};

function t(key){
  return translations[currentLang]?.[key] || translations.en[key] || key;
}

function lockedIdentityControl(target){
  return target instanceof Element ? target.closest(".cv-identity-locked") : null;
}

function hideIdentityFieldNotice(){
  window.clearTimeout(identityFieldNoticeTimer);
  document.querySelector(".cv-identity-field-notice")?.remove();
}

function showIdentityFieldNotice(control){
  if(!(control instanceof HTMLElement)) return;
  hideIdentityFieldNotice();
  const notice = document.createElement("div");
  notice.className = "cv-identity-field-notice";
  notice.setAttribute("role", "status");
  notice.textContent = t("identityLockedField");
  document.body.appendChild(notice);
  const fieldRect = control.getBoundingClientRect();
  const noticeRect = notice.getBoundingClientRect();
  const margin = 10;
  const left = Math.min(Math.max(margin, fieldRect.left), Math.max(margin, window.innerWidth - noticeRect.width - margin));
  const below = fieldRect.bottom + 8;
  const top = below + noticeRect.height <= window.innerHeight - margin
    ? below
    : Math.max(margin, fieldRect.top - noticeRect.height - 8);
  notice.style.left = `${Math.round(left)}px`;
  notice.style.top = `${Math.round(top)}px`;
  identityFieldNoticeTimer = window.setTimeout(hideIdentityFieldNotice, 3800);
}

function applyMaritimeIdentityLock(lock){
  const locked = Boolean(lock && lock.locked);
  const requested = new Set(Array.isArray(lock?.fields) ? lock.fields : []);
  const fields = immutableIdentityFieldIds.filter(id => !requested.size || requested.has(id));
  identityLockState = Object.freeze({ locked, fields: locked ? fields : [] });
  const active = new Set(identityLockState.fields);

  immutableIdentityFieldIds.forEach(id => {
    const control = document.getElementById(id);
    if(!control) return;
    const fieldLocked = locked && active.has(id);
    if("readOnly" in control) control.readOnly = fieldLocked;
    control.classList.toggle("cv-identity-locked", fieldLocked);
    if(fieldLocked){
      control.setAttribute("aria-readonly", "true");
      if(control instanceof HTMLSelectElement) control.setAttribute("aria-disabled", "true");
      control.dataset.identityLockedValue = control.value;
      control.title = t("identityLockedField");
    } else {
      control.removeAttribute("aria-readonly");
      control.removeAttribute("aria-disabled");
      delete control.dataset.identityLockedValue;
      control.removeAttribute("title");
    }
  });

  const notice = document.querySelector("[data-cv-identity-lock-notice]");
  if(notice) notice.hidden = !locked;
  document.body.classList.toggle("has-maritime-identity-lock", locked);
}

document.addEventListener("pointerdown", event => {
  const control = lockedIdentityControl(event.target);
  if(!control) return;
  event.preventDefault();
  showIdentityFieldNotice(control);
}, true);

document.addEventListener("keydown", event => {
  const control = lockedIdentityControl(event.target);
  if(!control || !["Enter", " ", "ArrowDown", "ArrowUp", "Backspace", "Delete"].includes(event.key)) return;
  event.preventDefault();
  showIdentityFieldNotice(control);
}, true);

document.addEventListener("change", event => {
  const control = lockedIdentityControl(event.target);
  if(!control) return;
  const savedValue = control.dataset.identityLockedValue;
  if(typeof savedValue === "string" && control.value !== savedValue) control.value = savedValue;
  event.preventDefault();
  event.stopImmediatePropagation();
  showIdentityFieldNotice(control);
}, true);

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
  document.dispatchEvent(new CustomEvent("allonahub:maritime-cv-language", { detail: { language: currentLang } }));
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
  const fieldNotice = document.querySelector(".cv-identity-field-notice");
  if(fieldNotice) fieldNotice.textContent = t("identityLockedField");
  associateEditorLabels();
  markRequiredCvLabels();
  applyMaritimeIdentityLock(identityLockState);
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
      <input type="date" value="${escapeAttr(normalizeDateInput(item.issue))}" data-cv-row="additional" data-cv-index="${index}" data-cv-key="issue">

      <label>Cert. No</label>
      <input value="${escapeAttr(item.cert)}" data-cv-row="additional" data-cv-index="${index}" data-cv-key="cert">

      <label>${t("dateExpiry")}</label>
      <input type="date" value="${escapeAttr(normalizeDateInput(item.expiry))}" data-cv-row="additional" data-cv-index="${index}" data-cv-key="expiry">

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
      <td>${escapeHTML(translateDynamicValue(item.name, "semantic"))}</td>
      <td>${escapeHTML(translateDynamicValue(item.institute, "organization"))}</td>
      <td>${escapeHTML(translateDynamicValue(item.place, "proper"))}</td>
      <td>${escapeHTML(formatDisplayDate(item.issue))}</td>
      <td>${escapeHTML(item.cert)}</td>
      <td>${escapeHTML(formatDisplayDate(item.expiry))}</td>
    `;

    tbody.appendChild(tr);
  });
}

const certificateCodeStopWords = new Set([
  "a", "an", "and", "certificate", "course", "for", "in", "of", "the", "training",
  "belgesi", "belge", "egitimi", "kursu", "sertifika", "sertifikasi", "ve",
  "kurs", "sertifikat", "sertifikati", "telim", "ve",
  "dlya", "i", "kurs", "obuchenie", "sertifikat"
]);
const certificateCodeTransliteration = Object.freeze({
  "ı":"i", "ə":"e", "ğ":"g", "ş":"s", "ç":"c", "ö":"o", "ü":"u",
  "а":"a", "б":"b", "в":"v", "г":"g", "д":"d", "е":"e", "ё":"e", "ж":"zh", "з":"z", "и":"i", "й":"y",
  "к":"k", "л":"l", "м":"m", "н":"n", "о":"o", "п":"p", "р":"r", "с":"s", "т":"t", "у":"u", "ф":"f",
  "х":"h", "ц":"ts", "ч":"ch", "ш":"sh", "щ":"sh", "ъ":"", "ы":"y", "ь":"", "э":"e", "ю":"yu", "я":"ya"
});

function certificateCodeWords(value){
  const transliterated = Array.from(String(value || "").toLowerCase(), character => certificateCodeTransliteration[character] ?? character).join("");
  return transliterated.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
}

function deriveCertificateCode(value){
  const words = certificateCodeWords(value);
  const significant = words.filter(word => !certificateCodeStopWords.has(word));
  const source = significant.length ? significant : words;
  if(!source.length) return "";
  if(source.length === 1) return source[0].slice(0, 4).toUpperCase();
  return source.map(word => word[0]).join("").slice(0, 8).toUpperCase();
}

function updateStcwCardPresentation(index){
  const row = stcwData[index];
  const card = document.querySelector(`[data-cv-stcw-card="${index}"]`);
  if(!row || !card) return;
  const preset = stcwPresets.find(entry => entry.id === row.presetId) || null;
  const code = String(row.code || preset?.code || "").toUpperCase();
  const title = preset && !preset.editableTitle ? t(preset.titleKey) : String(row.name || t(preset?.titleKey || "customCertificate"));
  const badge = card.querySelector(".cv-certificate-code");
  const heading = card.querySelector(".cv-stcw-card-head h3");
  const numberPrefix = card.querySelector(".cv-certificate-number-field span");
  const codeInput = card.querySelector('[data-cv-key="code"]');
  if(badge) badge.textContent = code || t("automaticCodeShort");
  if(heading) heading.textContent = title;
  if(numberPrefix) numberPrefix.textContent = code || "-";
  if(codeInput && codeInput.value !== code) codeInput.value = code;
}

function renderSTCWInputs(){
  const box = document.getElementById("stcwInputs");
  if(!box) return;

  box.innerHTML = "";

  stcwData.forEach((item, index) => {
    const preset = stcwPresets.find(entry => entry.id === item.presetId) || null;
    if(!preset && item.name && !item.code) item.code = deriveCertificateCode(item.name);
    const code = String(item.code || preset?.code || "").toUpperCase();
    const title = preset && !preset.editableTitle ? t(preset.titleKey) : "";
    const editableTitle = !preset || preset.editableTitle;
    const div = document.createElement("div");
    div.className = `group cv-repeat-group cv-stcw-card${preset ? " is-preset" : " is-custom"}${item.included === "false" ? " is-excluded" : ""}`;
    div.dataset.cvStcwCard = String(index);

    div.innerHTML = `
      <div class="cv-stcw-card-head">
        <span class="cv-certificate-code">${escapeHTML(code || t("automaticCodeShort"))}</span>
        <h3>${escapeHTML(title || item.name || t(preset?.titleKey || "customCertificate"))}</h3>
        <span class="cv-requirement-badge${preset?.required ? " is-required" : ""}">${t(preset?.required ? "requiredBadge" : "optionalBadge")}</span>
      </div>

      ${preset?.id === "sa" ? `<label class="cv-include-check"><input type="checkbox" data-cv-row="stcw" data-cv-index="${index}" data-cv-key="included" ${item.included !== "false" ? "checked" : ""}><span>${t("includeInCv")}</span></label>` : ""}

      ${editableTitle ? `
        <label>${t("courseName")}</label>
        <input value="${escapeAttr(item.name)}" placeholder="${escapeAttr(t(preset?.titleKey || "customCertificateName"))}" data-cv-row="stcw" data-cv-index="${index}" data-cv-key="name">
      ` : ""}

      ${preset ? "" : `
        <label>${t("certificateCode")}</label>
        <input class="cv-code-input" value="${escapeAttr(code)}" maxlength="8" data-cv-row="stcw" data-cv-index="${index}" data-cv-key="code">
      `}

      <label>${t("certificateNumber")}</label>
      <div class="cv-certificate-number-field">
        <span>${escapeHTML(code || "-")}</span>
        <input value="${escapeAttr(item.number || item.cert)}" placeholder="${escapeAttr(t("certificateNumberPlaceholder"))}" data-cv-row="stcw" data-cv-index="${index}" data-cv-key="number" ${preset?.required ? "required aria-required=\"true\"" : ""}>
      </div>

      <label>${t("institute")}</label>
      <input value="${escapeAttr(item.institute)}" data-cv-row="stcw" data-cv-index="${index}" data-cv-key="institute">

      <label>${t("place")}</label>
      <input value="${escapeAttr(item.place)}" data-cv-row="stcw" data-cv-index="${index}" data-cv-key="place">

      <div class="row2">
        <div>
          <label>${t("dateIssued")}</label>
          <input type="date" value="${escapeAttr(normalizeDateInput(item.issue))}" data-cv-row="stcw" data-cv-index="${index}" data-cv-key="issue" ${preset?.required ? "required aria-required=\"true\"" : ""}>
        </div>

        <div>
          <label>${t("rank")}</label>
          <input value="${escapeAttr(item.rank)}" data-cv-row="stcw" data-cv-index="${index}" data-cv-key="rank">
        </div>
      </div>

      <div class="cv-validity-row">
        <div>
          <label>${t("dateExpiry")}</label>
          <input type="date" value="${escapeAttr(normalizeDateInput(item.expiry))}" data-cv-row="stcw" data-cv-index="${index}" data-cv-key="expiry" ${item.unlimited === "true" ? "disabled" : ""}>
        </div>
        <label class="cv-unlimited-check">
          <input type="checkbox" data-cv-row="stcw" data-cv-index="${index}" data-cv-key="unlimited" ${item.unlimited === "true" ? "checked" : ""}>
          <span>${t("unlimited")}</span>
        </label>
      </div>

      ${preset ? "" : `<button type="button" class="secondary" data-cv-action="remove-stcw" data-cv-index="${index}">${t("deleteCertificate")}</button>`}
    `;

    box.appendChild(div);
  });
  associateEditorLabels(box);
}

function updateSTCW(index, key, value){
  const rowIndex = Number(index);
  if(!Number.isInteger(rowIndex) || rowIndex < 0 || !stcwData[rowIndex] || !repeatRowKeys.stcw.includes(key)) return;
  const nextValue = String(value ?? "").slice(0, maxRepeatFieldLength);
  stcwData[rowIndex][key] = key === "code" ? nextValue.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) : nextValue;
  if(key === "name" && !stcwData[rowIndex].presetId) stcwData[rowIndex].code = deriveCertificateCode(nextValue);
  if(key === "unlimited" && nextValue === "true") stcwData[rowIndex].expiry = "";
  if(key === "unlimited" || key === "included") renderSTCWInputs();
  else if(key === "name" || key === "code") updateStcwCardPresentation(rowIndex);
  renderSTCW();
  autoSaveCV();
}
  function addSTCW(){
  if(stcwData.length >= maxRepeatRows){
    alert(t("rowLimit"));
    return;
  }
  stcwData.push(newStcwRow());

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

  stcwData.filter(item => item.included !== "false").forEach(item => {
    const tr = document.createElement("tr");
    const preset = stcwPresets.find(entry => entry.id === item.presetId) || null;
    const certificateTitle = preset && !item.name ? t(preset.titleKey) : translateDynamicValue(item.name || t(preset?.titleKey || "customCertificate"), "semantic");
    const code = String(item.code || preset?.code || "").toUpperCase();
    const number = String(item.number || item.cert || "").trim();
    const certificateNumber = code && number && !number.toUpperCase().startsWith(`${code}-`) ? `${code}-${number}` : number || code;
    const expiry = item.unlimited === "true" ? t("unlimited") : formatDisplayDate(item.expiry);

    tr.innerHTML = `
      <td>${escapeHTML(certificateTitle)}</td>
      <td>${escapeHTML(translateDynamicValue(item.institute, "organization"))}</td>
      <td>${escapeHTML(translateDynamicValue(item.place, "proper"))}</td>
      <td>${escapeHTML(formatDisplayDate(item.issue))}</td>
      <td>${escapeHTML(translateDynamicValue(item.rank, "semantic"))}</td>
      <td>${escapeHTML(certificateNumber)}</td>
      <td>${escapeHTML(expiry)}</td>
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
    div.className = "group cv-repeat-group cv-sea-card";
    const vesselPhotoUrl = trustedVesselPhotoUrl(item.vesselPhotoUrl);
    const vesselPhotoSourceUrl = trustedVesselPhotoSourceUrl(item.vesselPhotoSourceUrl);
    const vesselPhotoCredit = String(item.vesselPhotoCredit || "VesselFinder").slice(0, 80);
    const vesselPhotoMarkup = vesselPhotoUrl
      ? `<figure class="cv-vessel-photo cv-vessel-photo--editor">${vesselPhotoSourceUrl ? `<a href="${escapeAttr(vesselPhotoSourceUrl)}" target="_blank" rel="noopener noreferrer"><img src="${escapeAttr(vesselPhotoUrl)}" crossorigin="anonymous" referrerpolicy="no-referrer" alt="${escapeAttr(`${item.vessel || t("vessel")} · ${t("vesselPhoto")}`)}"></a>` : `<img src="${escapeAttr(vesselPhotoUrl)}" crossorigin="anonymous" referrerpolicy="no-referrer" alt="${escapeAttr(`${item.vessel || t("vessel")} · ${t("vesselPhoto")}`)}">`}<figcaption>${escapeHTML(t("vesselPhoto"))} · ${escapeHTML(vesselPhotoCredit)}</figcaption></figure>`
      : "";

    div.innerHTML = `
      <h3>${t("seaExperience")} ${index + 1}</h3>
      ${vesselPhotoMarkup}

      <label class="cv-required-label">${t("imoNumber")}</label>
      <div class="cv-imo-lookup-row">
        <input inputmode="numeric" maxlength="7" required aria-required="true" aria-label="${escapeAttr(t("imoNumber"))}" value="${escapeAttr(item.imo)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="imo">
        <button type="button" class="secondary" data-cv-action="lookup-sea-imo" data-cv-index="${index}">${t("lookupVessel")}</button>
      </div>
      <p class="cv-field-help">${t("lookupManualHint")}</p>

      <label class="cv-required-label">${t("vessel")}</label>
      <input required aria-required="true" value="${escapeAttr(item.vessel)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="vessel">

      <label class="cv-required-label">${t("company")}</label>
      <input required aria-required="true" value="${escapeAttr(item.company)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="company">

      <div class="row2">
        <div>
          <label class="cv-required-label">${t("vesselType")}</label>
          <input required aria-required="true" value="${escapeAttr(item.type)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="type">
        </div>
        <div>
          <label class="cv-required-label">${t("flag")}</label>
          <input required aria-required="true" value="${escapeAttr(item.flag)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="flag">
        </div>
      </div>

      <div class="row2">
        <div>
          <label class="cv-required-label">${t("mmsi")}</label>
          <input inputmode="numeric" required aria-required="true" value="${escapeAttr(item.mmsi)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="mmsi">
        </div>
        <div>
          <label>${t("callSign")}</label>
          <input value="${escapeAttr(item.callSign)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="callSign">
        </div>
      </div>

      <div class="row2">
        <div>
          <label class="cv-required-label">DWT</label>
          <input required aria-required="true" value="${escapeAttr(item.dwt)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="dwt">
        </div>

        <div>
          <label class="cv-required-label">GRT</label>
          <input required aria-required="true" value="${escapeAttr(item.grt)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="grt">
        </div>
      </div>

      <div class="row2">
        <div>
          <label>${t("netTonnage")}</label>
          <input inputmode="decimal" value="${escapeAttr(item.netTonnage)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="netTonnage">
        </div>
        <div>
          <label>${t("buildYear")}</label>
          <input inputmode="numeric" value="${escapeAttr(item.buildYear)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="buildYear">
        </div>
      </div>

      <label>${t("lengthOverall")}</label>
      <input inputmode="decimal" value="${escapeAttr(item.lengthOverall)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="lengthOverall">

      <label class="cv-required-label">${t("rank")}</label>
      <input required aria-required="true" value="${escapeAttr(item.rank)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="rank">

      <div class="row2">
        <div>
          <label class="cv-required-label">${t("signOn")}</label>
          <input type="date" required aria-required="true" value="${escapeAttr(normalizeDateInput(item.signon))}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="signon">
        </div>

        <div>
          <label class="cv-required-label">${t("signOff")}</label>
          <input type="date" required aria-required="true" value="${escapeAttr(normalizeDateInput(item.signoff))}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="signoff">
        </div>
      </div>

      <div class="cv-sea-reference-fields">
        <h4>${t("referenceDetails")}</h4>
        <label class="cv-required-label">${t("referenceName")}</label>
        <input required aria-required="true" value="${escapeAttr(item.referenceName)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="referenceName">
        <label class="cv-required-label">${t("referenceCompanyEmail")}</label>
        <input type="email" required aria-required="true" value="${escapeAttr(item.referenceCompanyEmail)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="referenceCompanyEmail">
        <div class="row2">
          <div>
            <label class="cv-required-label">${t("referenceCompanyPhone")}</label>
            <input type="tel" required aria-required="true" value="${escapeAttr(item.referenceCompanyPhone)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="referenceCompanyPhone">
          </div>
          <div>
            <label class="cv-required-label">${t("referencePhone")}</label>
            <input type="tel" required aria-required="true" value="${escapeAttr(item.referencePhone)}" data-cv-row="sea" data-cv-index="${index}" data-cv-key="referencePhone">
          </div>
        </div>
      </div>

      <div class="cv-sea-document-panel${item.serviceDocumentStatus === "uploading" ? " is-uploading" : item.serviceDocumentId ? " is-ready" : ""}">
        <strong>${t("serviceDocument")}</strong>
        <p>${item.serviceDocumentId
          ? t("serviceDocumentSelected").replace("{name}", escapeHTML(item.serviceDocumentName || t("serviceDocument")))
          : t("serviceDocumentHelp")}</p>
        <span class="cv-sea-document-status" role="status" aria-live="polite">${item.serviceDocumentStatus === "uploading"
          ? t("serviceDocumentUploading")
          : item.serviceDocumentStatus === "failed"
          ? t("serviceDocumentFailed")
          : item.serviceDocumentId
          ? t("serviceDocumentUploaded")
          : ""}</span>
        <div class="cv-sea-document-choice" data-cv-service-document-choice="${index}" hidden>
          <span>${t("serviceDocumentChooseTitle")}</span>
          <div class="cv-sea-document-choice-actions">
            <button type="button" class="secondary" data-cv-action="choose-sea-document-source" data-cv-source="camera" data-cv-index="${index}">${t("serviceDocumentCamera")}</button>
            <button type="button" class="secondary" data-cv-action="choose-sea-document-source" data-cv-source="library" data-cv-index="${index}">${t("serviceDocumentLibrary")}</button>
            <button type="button" class="secondary" data-cv-action="choose-sea-document-source" data-cv-source="pdf" data-cv-index="${index}">${t("serviceDocumentPdf")}</button>
          </div>
        </div>
        <input class="cv-sea-document-input" type="file" accept="image/jpeg,image/png,image/webp,image/*" capture="environment" data-cv-service-document data-cv-source="camera" data-cv-index="${index}" aria-label="${escapeAttr(t("serviceDocumentCamera"))}">
        <input class="cv-sea-document-input" type="file" accept="image/jpeg,image/png,image/webp,image/*" data-cv-service-document data-cv-source="library" data-cv-index="${index}" aria-label="${escapeAttr(t("serviceDocumentLibrary"))}">
        <input class="cv-sea-document-input" type="file" accept="application/pdf,.pdf" data-cv-service-document data-cv-source="pdf" data-cv-index="${index}" aria-label="${escapeAttr(t("serviceDocumentPdf"))}">
      </div>

      <div class="cv-sea-save-state ${item.saved === "true" ? "is-saved" : "is-pending"}" role="status" aria-live="polite">
        ${item.saved === "true" ? t("experienceSaved") : t("experienceNeedsSave")}
      </div>

      <div class="cv-sea-actions">
        <button type="button" class="secondary cv-sea-delete" data-cv-action="remove-sea" data-cv-index="${index}">${t("deleteExperience")}</button>
        <button type="button" class="secondary" data-cv-action="choose-sea-document" data-cv-index="${index}"${item.serviceDocumentStatus === "uploading" ? " disabled" : ""}>${item.serviceDocumentId ? t("replaceServiceDocument") : t("addServiceDocument")}</button>
        <button type="button" data-cv-action="save-sea" data-cv-index="${index}"${item.serviceDocumentStatus === "uploading" ? " disabled" : ""}>${t("saveExperience")}</button>
      </div>
    `;

    box.appendChild(div);
    div.querySelector(".cv-vessel-photo--editor img")?.addEventListener("error", () => div.querySelector(".cv-vessel-photo--editor")?.remove(), { once:true });
  });
  associateEditorLabels(box);
}

function updateSea(index, key, value){
  const rowIndex = Number(index);
  if(!Number.isInteger(rowIndex) || rowIndex < 0 || !seaData[rowIndex] || !repeatRowKeys.sea.includes(key)) return;
  const clean = String(value ?? "").slice(0, maxRepeatFieldLength);
  seaData[rowIndex][key] = key === "imo" ? clean.replace(/\D/g, "").slice(0, 7) : clean;
  if(key === "imo"){
    seaData[rowIndex].vesselPhotoUrl = "";
    seaData[rowIndex].vesselPhotoSourceUrl = "";
    seaData[rowIndex].vesselPhotoCredit = "";
  }
  seaData[rowIndex].saved = "false";
  const state = document.querySelector(`.cv-sea-card [data-cv-index="${rowIndex}"]`)?.closest(".cv-sea-card")?.querySelector(".cv-sea-save-state");
  if(state){
    state.className = "cv-sea-save-state is-pending";
    state.textContent = t("experienceNeedsSave");
  }
  renderSea();
  autoSaveCV();
}

function seaRowHasData(row){
  const ignored = new Set(["rowId", "lookupProvider", "lookupFetchedAt", "serviceDocumentStatus", "saved"]);
  return repeatRowKeys.sea.some(key => !ignored.has(key) && String(row?.[key] || "").trim());
}

function seaServiceDocumentUrl(documentId){
  const id = String(documentId || "").trim();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return "";
  return `https://allonahub.com/pages/ecosystem/maritime-service-document.html?id=${encodeURIComponent(id)}`;
}

function openSeaServiceDocumentPicker(index){
  const rowIndex = Number(index);
  if(!Number.isInteger(rowIndex) || rowIndex < 0 || !seaData[rowIndex]) return;
  document.querySelectorAll("[data-cv-service-document-choice]").forEach(panel => {
    if(panel.getAttribute("data-cv-service-document-choice") !== String(rowIndex)) panel.hidden = true;
  });
  const choice = document.querySelector(`[data-cv-service-document-choice="${rowIndex}"]`);
  if(choice) choice.hidden = !choice.hidden;
}

function openSeaServiceDocumentSource(index, source){
  const rowIndex = Number(index);
  const normalizedSource = String(source || "");
  if(!Number.isInteger(rowIndex) || rowIndex < 0 || !seaData[rowIndex] || !["camera", "library", "pdf"].includes(normalizedSource)) return;
  const choice = document.querySelector(`[data-cv-service-document-choice="${rowIndex}"]`);
  if(choice) choice.hidden = true;
  document.querySelector(`[data-cv-service-document][data-cv-index="${rowIndex}"][data-cv-source="${normalizedSource}"]`)?.click();
}

function imageElement(file){
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SEA_SERVICE_IMAGE_INVALID"));
    };
    image.src = url;
  });
}

async function prepareSeaServicePdf(file){
  if(file.type === "application/pdf" || /\.pdf$/i.test(file.name || "")){
    return { blob:file, name:String(file.name || "sea-service-document.pdf").replace(/[^a-z0-9._ -]+/gi, "-").slice(0, 180) };
  }
  if(!/^image\/(jpeg|png|webp)$/i.test(file.type || "")) throw new Error("SEA_SERVICE_DOCUMENT_INVALID");
  const JsPdf = window.jspdf && window.jspdf.jsPDF;
  if(typeof JsPdf !== "function") throw new Error("SEA_SERVICE_PDF_LIBRARY_MISSING");
  const image = await imageElement(file);
  const maxDimension = 2600;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { alpha:false });
  if(!context) throw new Error("SEA_SERVICE_IMAGE_INVALID");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const orientation = canvas.width > canvas.height ? "landscape" : "portrait";
  const pdf = new JsPdf({ orientation, unit:"mm", format:"a4", compress:true });
  const pageWidth = orientation === "landscape" ? 297 : 210;
  const pageHeight = orientation === "landscape" ? 210 : 297;
  const ratio = Math.min((pageWidth - 18) / canvas.width, (pageHeight - 18) / canvas.height);
  const width = canvas.width * ratio;
  const height = canvas.height * ratio;
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", (pageWidth - width) / 2, (pageHeight - height) / 2, width, height, undefined, "FAST");
  const base = String(file.name || "sea-service-document").replace(/\.[^.]+$/, "").replace(/[^a-z0-9._ -]+/gi, "-").slice(0, 170);
  return { blob:pdf.output("blob"), name:`${base || "sea-service-document"}.pdf` };
}

async function attachSeaServiceDocument(index, file){
  const rowIndex = Number(index);
  const row = seaData[rowIndex];
  if(!Number.isInteger(rowIndex) || rowIndex < 0 || !row || !(file instanceof File)) return;
  if(!file.size || file.size > maxSeaServiceDocumentBytes){
    alert(t("serviceDocumentTooLarge"));
    return;
  }
  const validType = file.type === "application/pdf" || /^image\/(jpeg|png|webp)$/i.test(file.type || "") || /\.(pdf|jpe?g|png|webp)$/i.test(file.name || "");
  if(!validType){
    alert(t("serviceDocumentInvalid"));
    return;
  }
  row.serviceDocumentStatus = "uploading";
  row.saved = "false";
  renderSeaInputs();
  renderSea();
  try{
    if(!window.AllonaMaritimeCvAccount || typeof window.AllonaMaritimeCvAccount.archiveSeaServiceDocument !== "function") throw new Error("SEA_SERVICE_UPLOAD_UNAVAILABLE");
    const prepared = await prepareSeaServicePdf(file);
    const result = await window.AllonaMaritimeCvAccount.archiveSeaServiceDocument(prepared.blob, row.rowId, prepared.name);
    row.serviceDocumentId = String(result?.document?.id || "");
    row.serviceDocumentName = String(result?.document?.original_file_name || prepared.name).slice(0, maxRepeatFieldLength);
    row.serviceDocumentSize = String(result?.document?.file_size_bytes || prepared.blob.size || "");
    row.serviceDocumentStatus = "uploaded";
    row.saved = "false";
    persistCV();
  } catch(error){
    row.serviceDocumentStatus = "failed";
    alert(t("serviceDocumentFailed"));
  }
  renderSeaInputs();
  renderSea();
  autoSaveCV();
}

const requiredSeaFields = Object.freeze([
  ["imo", "imoNumber"], ["vessel", "vessel"], ["company", "company"], ["type", "vesselType"], ["flag", "flag"],
  ["mmsi", "mmsi"], ["dwt", "DWT"], ["grt", "GRT"], ["rank", "rank"], ["signon", "signOn"], ["signoff", "signOff"],
  ["referenceName", "referenceName"], ["referenceCompanyEmail", "referenceCompanyEmail"],
  ["referenceCompanyPhone", "referenceCompanyPhone"], ["referencePhone", "referencePhone"], ["serviceDocumentId", "serviceDocumentRequired"]
]);

function validateSeaExperience(index, options){
  const rowIndex = Number(index);
  const row = seaData[rowIndex];
  if(!Number.isInteger(rowIndex) || rowIndex < 0 || !row) return false;
  const card = document.querySelector(`[data-cv-row="sea"][data-cv-index="${rowIndex}"]`)?.closest(".cv-sea-card");
  card?.querySelectorAll(".cv-field-invalid").forEach(node => node.classList.remove("cv-field-invalid"));
  card?.querySelectorAll('[aria-invalid="true"]').forEach(node => node.removeAttribute("aria-invalid"));
  const missing = [];
  let firstInvalid = null;
  requiredSeaFields.forEach(([key, labelKey]) => {
    const value = String(row[key] || "").trim();
    const invalid = !value || (key === "imo" && !validImo(value)) || (key === "referenceCompanyEmail" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
    if(!invalid) return;
    const control = key === "serviceDocumentId"
      ? card?.querySelector(".cv-sea-document-panel")
      : card?.querySelector(`[data-cv-key="${key}"]`);
    invalidateCvControl(control);
    firstInvalid = firstInvalid || control;
    missing.push(labelKey === "DWT" || labelKey === "GRT" ? labelKey : t(labelKey));
  });
  const start = dateValue(row.signon);
  const end = dateValue(row.signoff);
  if(start && end && end < start){
    const control = card?.querySelector('[data-cv-key="signoff"]');
    invalidateCvControl(control);
    firstInvalid = firstInvalid || control;
    missing.push(t("experienceDateInvalid"));
  }
  if(missing.length && options?.announce !== false){
    alert(t("seaRequiredMessage").replace("{row}", String(rowIndex + 1)).replace("{fields}", [...new Set(missing)].join(", ")));
    firstInvalid?.scrollIntoView({ block:"center", behavior:"smooth" });
    firstInvalid?.focus?.({ preventScroll:true });
  }
  return !missing.length;
}

async function saveSeaExperience(index){
  const rowIndex = Number(index);
  if(!validateSeaExperience(rowIndex)) return;
  const row = seaData[rowIndex];
  const button = document.querySelector(`[data-cv-action="save-sea"][data-cv-index="${rowIndex}"]`);
  const state = button?.closest(".cv-sea-card")?.querySelector(".cv-sea-save-state");
  const previousSaved = row.saved;
  row.saved = "true";
  row.serviceDocumentStatus = "uploaded";
  if(button){
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  }
  if(state){
    state.className = "cv-sea-save-state is-pending";
    state.textContent = t("experienceSaving");
  }
  try{
    if(!window.AllonaMaritimeCvAccount || typeof window.AllonaMaritimeCvAccount.saveSeaExperience !== "function") throw new Error("MARITIME_REFERENCE_SAVE_UNAVAILABLE");
    const result = await window.AllonaMaritimeCvAccount.saveSeaExperience(getCVData(), rowIndex);
    persistCV();
    renderSeaInputs();
    renderSea();
    syncCV();
    const sent = result?.notification?.status === "sent";
    alert(t("experienceSavedAlert") + t(sent ? "referenceNotificationSent" : "referenceNotificationQueued"));
  } catch(error){
    row.saved = previousSaved === "true" ? "true" : "false";
    renderSeaInputs();
    renderSea();
    alert(t("experienceSaveFailed"));
  } finally {
    const nextButton = document.querySelector(`[data-cv-action="save-sea"][data-cv-index="${rowIndex}"]`);
    if(nextButton){
      nextButton.disabled = false;
      nextButton.removeAttribute("aria-busy");
    }
  }
}

function validImo(value){
  const imo = String(value || "").replace(/\D/g, "").slice(0, 7);
  if(!/^\d{7}$/.test(imo)) return false;
  const checksum = imo.slice(0, 6).split("").reduce((sum, digit, index) => sum + Number(digit) * (7 - index), 0) % 10;
  return checksum === Number(imo[6]);
}

async function lookupSeaVessel(index, button){
  const rowIndex = Number(index);
  const row = seaData[rowIndex];
  if(!Number.isInteger(rowIndex) || !row) return;
  if(!validImo(row.imo)){
    alert(t("lookupFailed"));
    return;
  }
  if(!window.AllonaMaritimeCommerce || typeof window.AllonaMaritimeCommerce.lookupVessel !== "function"){
    alert(t("lookupFailed"));
    return;
  }
  if(button){
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  }
  try{
    const result = await window.AllonaMaritimeCommerce.lookupVessel(row.imo);
    const vessel = result.vessel || {};
    const values = {
      imo:vessel.imo,
      vessel:vessel.vessel_name,
      company:vessel.company_name,
      type:vessel.vessel_type,
      flag:vessel.flag,
      dwt:vessel.dwt,
      grt:vessel.grt,
      netTonnage:vessel.net_tonnage,
      buildYear:vessel.build_year,
      mmsi:vessel.mmsi,
      callSign:vessel.call_sign,
      lengthOverall:vessel.length_overall_m
    };
    Object.entries(values).forEach(([key, value]) => {
      if(value !== null && value !== undefined && value !== "" && !String(row[key] || "").trim()) row[key] = String(value);
    });
    row.lookupProvider = String(vessel.provider || "marinetraffic");
    row.lookupFetchedAt = String(vessel.fetched_at || new Date().toISOString());
    row.vesselPhotoUrl = trustedVesselPhotoUrl(vessel.vessel_photo_url);
    row.vesselPhotoSourceUrl = trustedVesselPhotoSourceUrl(vessel.vessel_photo_source_url || vessel.provider_source_url);
    row.vesselPhotoCredit = row.vesselPhotoUrl ? String(vessel.vessel_photo_credit || "VesselFinder").slice(0, 80) : "";
    row.saved = "false";
    renderSeaInputs();
    renderSea();
    autoSaveCV();
    alert(t("lookupSuccess"));
  } catch(error){
    alert(t("lookupFailed"));
  } finally{
    if(button){
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  }
}
  function addSea(){
  if(seaData.length >= maxRepeatRows){
    alert(t("rowLimit"));
    return;
  }
  seaData.push(newSeaRow());

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

  seaData.filter(item => item.saved === "true").forEach(item => {
    const photoUrl = trustedVesselPhotoUrl(item.vesselPhotoUrl);
    if(photoUrl){
      const photoRow = document.createElement("tr");
      photoRow.className = "cv-sea-photo-row";
      const sourceUrl = trustedVesselPhotoSourceUrl(item.vesselPhotoSourceUrl);
      const credit = String(item.vesselPhotoCredit || "VesselFinder").slice(0, 80);
      const imageMarkup = `<img src="${escapeAttr(photoUrl)}" crossorigin="anonymous" referrerpolicy="no-referrer" alt="${escapeAttr(`${item.vessel || t("vessel")} · ${t("vesselPhoto")}`)}">`;
      photoRow.innerHTML = `<td colspan="9"><figure class="cv-vessel-photo">${sourceUrl ? `<a href="${escapeAttr(sourceUrl)}" target="_blank" rel="noopener noreferrer">${imageMarkup}</a>` : imageMarkup}<figcaption>${escapeHTML(t("vesselPhoto"))} · ${escapeHTML(credit)}</figcaption></figure></td>`;
      photoRow.querySelector("img")?.addEventListener("error", () => photoRow.remove(), { once:true });
      tbody.appendChild(photoRow);
    }
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${escapeHTML(translateDynamicValue(item.vessel, "vessel"))}<br><small>IMO: ${escapeHTML(item.imo)}</small></td>
      <td>${escapeHTML(translateDynamicValue(item.company, "organization"))}</td>
      <td>${escapeHTML(translateDynamicValue(item.type, "semantic"))}</td>
      <td>${escapeHTML(translateDynamicValue(item.flag, "semantic"))}</td>
      <td>${escapeHTML(item.dwt)}</td>
      <td>${escapeHTML(item.grt)}</td>
      <td>${escapeHTML(translateDynamicValue(item.rank, "semantic"))}</td>
      <td>${escapeHTML(formatDisplayDate(item.signon))}</td>
      <td>${escapeHTML(formatDisplayDate(item.signoff))}</td>
    `;

    tbody.appendChild(tr);
    const details = document.createElement("tr");
    details.className = "cv-sea-detail-row";
    const serviceUrl = seaServiceDocumentUrl(item.serviceDocumentId);
    details.innerHTML = `<td colspan="9"><strong>${escapeHTML(t("referenceDetails"))}:</strong> ${escapeHTML(translateDynamicValue(item.referenceName, "proper"))} · ${escapeHTML(item.referenceCompanyEmail)} · ${escapeHTML(t("referenceCompanyPhone"))}: ${escapeHTML(item.referenceCompanyPhone)} · ${escapeHTML(t("referencePhone"))}: ${escapeHTML(item.referencePhone)}<br><strong>${escapeHTML(t("mmsi"))}:</strong> ${escapeHTML(item.mmsi)} · <strong>${escapeHTML(t("callSign"))}:</strong> ${escapeHTML(item.callSign)} · <strong>${escapeHTML(t("buildYear"))}:</strong> ${escapeHTML(item.buildYear)} · <strong>${escapeHTML(t("netTonnage"))}:</strong> ${escapeHTML(item.netTonnage)} · <strong>${escapeHTML(t("lengthOverall"))}:</strong> ${escapeHTML(item.lengthOverall)}${serviceUrl ? `<br><a class="cv-service-document-link" href="${escapeAttr(serviceUrl)}" target="_blank" rel="noopener">${escapeHTML(t("serviceDocumentLink"))}: ${escapeHTML(item.serviceDocumentName || t("serviceDocument"))}</a>` : ""}</td>`;
    tbody.appendChild(details);
  });
}

function getCVData(){
  const fields = {};

  textFields.forEach(id => {
    fields[id] = String(valueOf(id)).slice(0, maxTextLength);
  });
  if(summaryMode === "auto") fields.note = generatedProfessionalSummary().slice(0, maxTextLength);

  const photo = document.getElementById("cv_photo")?.getAttribute("src") || "";
  return {
    lang: currentLang,
    summaryMode,
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

const requiredCvFields = Object.freeze([
  ["position", "position"], ["familyName", "familyName"], ["firstName", "firstName"], ["fatherName", "fatherName"],
  ["birthDate", "birthDate"], ["birthPlace", "birthPlace"], ["nationality", "nationality"], ["gender", "gender"],
  ["marital", "marital"], ["address", "address"], ["airport", "airport"],
  ["mobile", "mobile"], ["email", "email"], ["passportDoc", "document"], ["passportNo", "number"], ["passportCountry", "issuingCountry"],
  ["passportIssued", "issued"], ["passportValid", "valid"], ["seamanBookNo", "seamanBookNo"],
  ["seamanBookIssued", "issued"], ["seamanBookValid", "valid"], ["medicalDoc", "document"],
  ["medicalFitness", "medicalFitness"], ["medicalIssue", "dateOfIssue"], ["medicalExpiry", "dateOfExpiry"]
]);

function markRequiredCvLabels(){
  requiredCvFields.forEach(([id]) => {
    const control = document.getElementById(id);
    if(!control) return;
    control.required = true;
    control.setAttribute("aria-required", "true");
    const label = document.querySelector(`label[for="${id}"]`) || control.previousElementSibling;
    if(label instanceof HTMLLabelElement) label.classList.add("cv-required-label");
  });
  const photoLabel = document.querySelector('label[for="photoInput"]');
  if(photoLabel) photoLabel.classList.add("cv-required-label");
}

function clearCvValidation(){
  document.querySelectorAll(".cv-field-invalid").forEach(node => node.classList.remove("cv-field-invalid"));
  document.querySelectorAll('[aria-invalid="true"]').forEach(node => node.removeAttribute("aria-invalid"));
}

function invalidateCvControl(control){
  if(!control) return;
  control.classList.add("cv-field-invalid");
  control.setAttribute("aria-invalid", "true");
}

function validateMaritimeCV(options){
  clearCvValidation();
  const missing = [];
  let firstInvalid = null;
  requiredCvFields.forEach(([id, labelKey]) => {
    const control = document.getElementById(id);
    if(control && !String(control.value || "").trim()) {
      invalidateCvControl(control);
      firstInvalid = firstInvalid || control;
      missing.push(t(labelKey));
    }
  });
  const photo = document.getElementById("cv_photo");
  if(!photo || photo.hidden || !String(photo.getAttribute("src") || "").trim()) {
    const photoControl = document.getElementById("photoInput");
    invalidateCvControl(photoControl);
    firstInvalid = firstInvalid || photoControl;
    missing.push(t("photo"));
  }
  stcwPresets.filter(preset => preset.required).forEach(preset => {
    const index = stcwData.findIndex(row => row.presetId === preset.id || String(row.code || "").toUpperCase() === preset.code);
    const row = index >= 0 ? stcwData[index] : null;
    const complete = row && row.included !== "false" && String(row.number || row.cert || "").trim() && normalizeDateInput(row.issue)
      && (row.unlimited === "true" || normalizeDateInput(row.expiry));
    if(complete) return;
    const control = index >= 0 ? document.querySelector(`[data-cv-row="stcw"][data-cv-index="${index}"][data-cv-key="number"]`) : null;
    const card = control?.closest(".cv-stcw-card") || null;
    if(card) card.classList.add("cv-field-invalid");
    if(control) control.setAttribute("aria-invalid", "true");
    firstInvalid = firstInvalid || control || card;
    missing.push(`${preset.code} ${t("certificate")}`);
  });
  seaData.forEach((row, index) => {
    const hasExperience = seaRowHasData(row);
    if(!hasExperience) return;
    const rowMissing = [];
    requiredSeaFields.forEach(([key, labelKey]) => {
      const value = String(row[key] || "").trim();
      const invalid = !value || (key === "imo" && !validImo(value)) || (key === "referenceCompanyEmail" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
      if(!invalid) return;
      const control = key === "serviceDocumentId"
        ? document.querySelector(`[data-cv-service-document][data-cv-index="${index}"]`)?.closest(".cv-sea-document-panel")
        : document.querySelector(`[data-cv-row="sea"][data-cv-index="${index}"][data-cv-key="${key}"]`);
      invalidateCvControl(control);
      firstInvalid = firstInvalid || control;
      rowMissing.push(labelKey === "DWT" || labelKey === "GRT" ? labelKey : t(labelKey));
    });
    const start = dateValue(row.signon);
    const end = dateValue(row.signoff);
    if(start && end && end < start){
      const control = document.querySelector(`[data-cv-row="sea"][data-cv-index="${index}"][data-cv-key="signoff"]`);
      invalidateCvControl(control);
      firstInvalid = firstInvalid || control;
      rowMissing.push(t("experienceDateInvalid"));
    }
    if(row.saved !== "true"){
      const control = document.querySelector(`[data-cv-action="save-sea"][data-cv-index="${index}"]`);
      invalidateCvControl(control);
      firstInvalid = firstInvalid || control;
      rowMissing.push(t("saveExperience"));
    }
    if(rowMissing.length) missing.push(t("seaRequiredMessage").replace("{row}", String(index + 1)).replace("{fields}", rowMissing.join(", ")));
  });
  if(!missing.length) return true;
  if(options?.announce !== false) alert(t("requiredCvMessage").replace("{fields}", [...new Set(missing)].join(", ")));
  if(firstInvalid) {
    firstInvalid.scrollIntoView({ block:"center", behavior:"smooth" });
    if(typeof firstInvalid.focus === "function") firstInvalid.focus({ preventScroll:true });
  }
  return false;
}

async function saveCV(){
  const readyForGlobalCv = validateMaritimeCV({ announce:false });
  if(autoSaveTimer){
    window.clearTimeout(autoSaveTimer);
    autoSaveTimer = 0;
  }
  const localSaved = persistCV();
  if(window.AllonaMaritimeCvAccount && typeof window.AllonaMaritimeCvAccount.save === "function"){
    try{
      const result = await window.AllonaMaritimeCvAccount.save(getCVData(), { finalize:readyForGlobalCv });
      alert(t(result?.finalized ? "accountSaved" : "accountDraftSaved"));
    } catch(error){
      const errorKeys = {
        AUTH_REQUIRED:"accountLoginRequired",
        MARITIME_IDENTITY_ALREADY_REGISTERED:"identityAlreadyRegistered",
        MARITIME_IDENTITY_LOCKED:"identityChangeBlocked",
        MARITIME_DEVICE_ALREADY_BOUND:"deviceAlreadyBound",
        MARITIME_DEVICE_KEY_REQUIRED:"deviceSecurityFailed",
        MARITIME_DEVICE_BINDING_REQUIRED:"deviceSecurityFailed",
        MARITIME_PASSKEY_UNSUPPORTED:"passkeyUnsupported",
        MARITIME_PASSKEY_CANCELLED:"passkeyCancelled",
        MARITIME_PASSKEY_VERIFICATION_REQUIRED:"passkeyRequired",
        MARITIME_PASSKEY_VERIFICATION_FAILED:"passkeyFailed",
        MARITIME_PASSKEY_SECURITY_UNAVAILABLE:"passkeyUnavailable"
      };
      alert(t(error?.draftSaved ? "accountDraftSavedFinalFailed" : (errorKeys[error && error.code] || "accountSaveFailed")));
    }
    return;
  }
  alert(localSaved ? t("draftSaved") : t("draftSaveFailed"));
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

function normalizeDateInput(value){
  const clean = String(value || "").trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const localized = clean.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if(!localized) return "";
  return `${localized[3]}-${localized[2].padStart(2, "0")}-${localized[1].padStart(2, "0")}`;
}

function formatDisplayDate(value){
  const normalized = normalizeDateInput(value);
  if(!normalized) return String(value || "");
  const [year, month, day] = normalized.split("-");
  return currentLang === "en" ? `${day}/${month}/${year}` : `${day}.${month}.${year}`;
}

function normalizeStcwRows(rows){
  const presetRows = new Map();
  const customRows = [];

  rows.forEach(row => {
    const clean = { ...newStcwRow(), ...row };
    const removedSePreset = clean.presetId === "se";
    const hasSeCertificateData = ["name", "institute", "place", "issue", "rank", "cert", "number", "expiry"]
      .some(key => String(clean[key] || "").trim());
    if(removedSePreset && !hasSeCertificateData) return;
    if(removedSePreset) clean.presetId = "";
    const legacyNumber = String(clean.number || clean.cert || "").trim();
    const legacyMatch = legacyNumber.match(/^(SP|SH|SI|SL|SO|SA|SE)[\s-]*(.*)$/i);
    if(!clean.code && legacyMatch) clean.code = legacyMatch[1].toUpperCase();
    if(!clean.number) clean.number = legacyMatch ? legacyMatch[2] : legacyNumber;
    clean.code = String(clean.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    clean.unlimited = clean.unlimited === "true" || /^(no limit|unlimited|limitsiz|müddətsiz|бессрочно)$/i.test(String(clean.expiry || "").trim()) ? "true" : "false";
    clean.included = clean.included === "false" ? "false" : "true";
    if(clean.unlimited === "true") clean.expiry = "";

    const preset = stcwPresets.find(entry => entry.id === clean.presetId || entry.code === clean.code);
    if(preset && !presetRows.has(preset.id)) {
      clean.presetId = preset.id;
      clean.code = preset.code;
      presetRows.set(preset.id, clean);
    } else {
      customRows.push(clean);
    }
  });

  return [
    ...stcwPresets.map(preset => presetRows.get(preset.id) || newStcwRow(preset)),
    ...customRows
  ].slice(0, maxRepeatRows);
}

function normalizeSeaRows(rows){
  return rows.map(row => {
    const clean = { ...newSeaRow(), ...row };
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean.rowId)) clean.rowId = createSeaRowId();
    if(clean.saved !== "true" && clean.saved !== "false") clean.saved = seaRowHasData(clean) ? "true" : "false";
    if(clean.serviceDocumentId && !clean.serviceDocumentStatus) clean.serviceDocumentStatus = "uploaded";
    return clean;
  }).slice(0, maxRepeatRows);
}
function applyCVData(data){
  if(!data || typeof data !== "object") return;

    if(data.lang && translations[data.lang]){
      currentLang = data.lang;
      const langSelect = document.getElementById("langSelect");
      if(langSelect) langSelect.value = currentLang;
    }

    summaryMode = data.summaryMode === "custom" || (!data.summaryMode && String(data.fields?.note || "").trim()) ? "custom" : "auto";

    if(data.fields && typeof data.fields === "object" && !Array.isArray(data.fields)){
      textFields.forEach(id => {
        const el = document.getElementById(id);
        if(el){
          const value = String(data.fields[id] ?? "").slice(0, maxTextLength);
          el.value = id === "note" && summaryMode === "auto" ? "" : (el instanceof HTMLInputElement && el.type === "date" ? normalizeDateInput(value) : value);
        }
      });
    }

    additionalData = sanitizeDraftRows(data.additionalData, repeatRowKeys.additional);
    stcwData = normalizeStcwRows(sanitizeDraftRows(data.stcwData, repeatRowKeys.stcw));
    seaData = normalizeSeaRows(sanitizeDraftRows(data.seaData, repeatRowKeys.sea));

    if(data.photo && cvDraftStore?.isSafePhotoDataUrl(data.photo)){
      setMaritimeCvPhoto(data.photo);
    }
}

function loadCV(){
  applyCVData(cvDraftStore?.read());
}

function setMaritimeCvPhoto(url){
  const img = document.getElementById("cv_photo");
  const empty = document.getElementById("emptyPhoto");
  const remove = document.querySelector('[data-cv-action="remove-photo"]');
  const safeUrl = String(url || "");

  if(img){
    if(safeUrl){
      img.src = safeUrl;
      img.hidden = false;
    } else {
      img.removeAttribute("src");
      img.hidden = true;
    }
  }
  if(empty) empty.hidden = Boolean(safeUrl);
  if(remove) remove.hidden = !safeUrl;
}

async function removePhoto(){
  try{
    if(window.AllonaMaritimeCvAccount && typeof window.AllonaMaritimeCvAccount.removePhoto === "function"){
      await window.AllonaMaritimeCvAccount.removePhoto();
    }
    setMaritimeCvPhoto("");
    if(photoInput) photoInput.value = "";
    autoSaveCV();
    alert(t("photoRemoved"));
  } catch(error){
    alert(t("removePhotoFailed"));
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
      setMaritimeCvPhoto(photoData);

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
  const identityLocked = identityLockState.locked;
  const lockedFields = new Set(identityLockState.fields);
  const ok = confirm(t(identityLocked ? "resetConfirmLocked" : "resetConfirm"));
  if(!ok) return;

  textFields.forEach(id => {
    if(identityLocked && lockedFields.has(id)) return;
    const el = document.getElementById(id);
    if(el){
      el.value = "";
    }
  });

  additionalData = [];
  stcwData = stcwPresets.map(newStcwRow);
  seaData = [];
  summaryMode = "auto";

  const fileInput = document.getElementById("photoInput");

  if(!identityLocked) setMaritimeCvPhoto("");

  if(fileInput && !identityLocked){
    fileInput.value = "";
  }

  if(autoSaveTimer){
    window.clearTimeout(autoSaveTimer);
    autoSaveTimer = 0;
  }
  if(identityLocked) persistCV();
  else cvDraftStore?.clear();

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

  const requestedImo = new URLSearchParams(window.location.search).get("imo");
  if(validImo(requestedImo)){
    let row = seaData.find(item => item.imo === requestedImo);
    if(!row && seaData.length < maxRepeatRows){
      row = newSeaRow();
      seaData.push(row);
    }
    if(row) row.imo = requestedImo;
  }

  translatePage();
  renderAdditionalInputs();
  renderSTCWInputs();
  renderSeaInputs();
  syncCV();
  document.body.dataset.maritimeCvReady = "true";
  document.dispatchEvent(new Event("allonahub:maritime-cv-ready"));
});

window.getMaritimeCVData = getCVData;
window.validateMaritimeCV = validateMaritimeCV;
window.changeLanguage = changeLanguage;
window.saveCV = saveCV;
window.resetForm = resetForm;
window.addAdditional = addAdditional;
window.removeAdditional = removeAdditional;
window.updateAdditional = updateAdditional;
window.addSTCW = addSTCW;
window.removeSTCW = removeSTCW;
window.updateSTCW = updateSTCW;
window.addSea = addSea;
window.removeSea = removeSea;
window.updateSea = updateSea;
window.lookupSeaVessel = lookupSeaVessel;
window.openSeaServiceDocumentPicker = openSeaServiceDocumentPicker;
window.openSeaServiceDocumentSource = openSeaServiceDocumentSource;
window.attachSeaServiceDocument = attachSeaServiceDocument;
window.saveSeaExperience = saveSeaExperience;
window.removePhoto = removePhoto;
window.generateSummary = generateSummary;
window.setSummaryModeFromInput = setSummaryModeFromInput;
window.syncCV = syncCV;
window.autoSaveCV = autoSaveCV;
window.setMaritimeCvPhoto = setMaritimeCvPhoto;
window.applyMaritimeCVData = function(data){
  applyCVData(data);
  renderAdditionalInputs();
  renderSTCWInputs();
  renderSeaInputs();
  syncCV();
  translatePage();
};
window.applyMaritimeIdentityLock = applyMaritimeIdentityLock;
  const valueTranslations = {
  excellent:{ en:"Excellent", tr:"Mükemmel", az:"Əla", ru:"Отлично" },
  good:{ en:"Good", tr:"İyi", az:"Yaxşı", ru:"Хорошо" },
  average:{ en:"Average", tr:"Orta", az:"Orta", ru:"Средний" },
  poor:{ en:"Basic", tr:"Temel", az:"Əsas", ru:"Базовый" },

  single:{ en:"Single", tr:"Bekar", az:"Subay", ru:"Холост" },
  married:{ en:"Married", tr:"Evli", az:"Evli", ru:"Женат" },
  divorced:{ en:"Divorced", tr:"Boşanmış", az:"Boşanmış", ru:"Разведён(а)" },
  widowed:{ en:"Widowed", tr:"Dul", az:"Dul", ru:"Вдовец / вдова" },
  separated:{ en:"Separated", tr:"Ayrı yaşıyor", az:"Ayrı yaşayır", ru:"Живёт отдельно" },
  spouse:{ en:"Spouse", tr:"Eş", az:"Həyat yoldaşı", ru:"Супруг(а)" },
  parent:{ en:"Parent", tr:"Anne / Baba", az:"Ana / Ata", ru:"Родитель" },
  child:{ en:"Child", tr:"Çocuk", az:"Övlad", ru:"Ребёнок" },
  sibling:{ en:"Sibling", tr:"Kardeş", az:"Bacı / Qardaş", ru:"Брат / сестра" },
  other:{ en:"Other", tr:"Diğer", az:"Digər", ru:"Другое" },
  ordinaryPassport:{ en:"Ordinary passport", tr:"Umuma mahsus pasaport", az:"Ümumvətəndaş pasportu", ru:"Обычный заграничный паспорт" },
  diplomaticPassport:{ en:"Diplomatic passport", tr:"Diplomatik pasaport", az:"Diplomatik pasport", ru:"Дипломатический паспорт" },
  servicePassport:{ en:"Service / official passport", tr:"Hizmet / resmî pasaport", az:"Xidməti / rəsmi pasport", ru:"Служебный / официальный паспорт" },
  specialPassport:{ en:"Special passport", tr:"Hususi pasaport", az:"Xüsusi pasport", ru:"Специальный паспорт" },
  temporaryPassport:{ en:"Temporary / emergency passport", tr:"Geçici / acil pasaport", az:"Müvəqqəti / təcili pasport", ru:"Временный / экстренный паспорт" },
  refugeeTravelDocument:{ en:"Refugee travel document", tr:"Mülteci seyahat belgesi", az:"Qaçqın səyahət sənədi", ru:"Проездной документ беженца" },

  azerbaijan:{ en:"Azerbaijan", tr:"Azerbaycan", az:"Azərbaycan", ru:"Азербайджан" },
  turkey:{ en:"Turkey", tr:"Türkiye", az:"Türkiyə", ru:"Турция" },
  russia:{ en:"Russia", tr:"Rusya", az:"Rusiya", ru:"Россия" },
  baku:{ en:"Baku", tr:"Bakü", az:"Bakı", ru:"Баку" },

  oiler:{ en:"Oiler", tr:"Yağcı", az:"Yağçı", ru:"Моторист" },
  motorman:{ en:"Motorman", tr:"Makine Tayfası", az:"Motorçu", ru:"Моторист" },
  cadet:{ en:"Cadet", tr:"Stajyer", az:"Kadet", ru:"Кадет" },
  captain:{ en:"Captain", tr:"Kaptan", az:"Kapitan", ru:"Капитан" },
  engineer:{ en:"Engineer", tr:"Mühendis", az:"Mühəndis", ru:"Инженер" },
  fitter:{ en:"Fitter", tr:"Fitter", az:"Fitter", ru:"Фиттер" },
  welder:{ en:"Welder", tr:"Kaynakçı", az:"Qaynaqçı", ru:"Сварщик" },
  bosun:{ en:"Bosun", tr:"Lostromo", az:"Bosman", ru:"Боцман" },
  ableSeaman:{ en:"Able Seaman", tr:"Usta Gemici", az:"Bacarıqlı Matros", ru:"Квалифицированный Матрос" },
  ordinarySeaman:{ en:"Ordinary Seaman", tr:"Gemici", az:"Matros", ru:"Матрос" },
  chiefOfficer:{ en:"Chief Officer", tr:"Birinci Zabit", az:"Baş Köməkçi", ru:"Старший Помощник" },
  secondOfficer:{ en:"Second Officer", tr:"İkinci Zabit", az:"İkinci Köməkçi", ru:"Второй Помощник" },
  thirdOfficer:{ en:"Third Officer", tr:"Üçüncü Zabit", az:"Üçüncü Köməkçi", ru:"Третий Помощник" },
  chiefEngineer:{ en:"Chief Engineer", tr:"Başmühendis", az:"Baş Mühəndis", ru:"Старший Механик" },
  secondEngineer:{ en:"Second Engineer", tr:"İkinci Mühendis", az:"İkinci Mühəndis", ru:"Второй Механик" },
  electrician:{ en:"Electrician", tr:"Elektrikçi", az:"Elektrik", ru:"Электрик" },
  cook:{ en:"Cook", tr:"Aşçı", az:"Aşpaz", ru:"Повар" },
  steward:{ en:"Steward", tr:"Kamarot", az:"Stüard", ru:"Стюард" },
  male:{ en:"Male", tr:"Erkek", az:"Kişi", ru:"Мужской" },
  female:{ en:"Female", tr:"Kadın", az:"Qadın", ru:"Женский" },
  brown:{ en:"Brown", tr:"Kahverengi", az:"Qəhvəyi", ru:"Карий" },
  black:{ en:"Black", tr:"Siyah", az:"Qara", ru:"Чёрный" },
  blue:{ en:"Blue", tr:"Mavi", az:"Mavi", ru:"Голубой" },
  green:{ en:"Green", tr:"Yeşil", az:"Yaşıl", ru:"Зелёный" },
  hazel:{ en:"Hazel", tr:"Ela", az:"Fındıq rəngi", ru:"Ореховый" },
  grey:{ en:"Grey", tr:"Gri", az:"Boz", ru:"Серый" },
  blond:{ en:"Blond", tr:"Sarı", az:"Sarı", ru:"Светлый" },
  red:{ en:"Red", tr:"Kızıl", az:"Qızılı-qırmızı", ru:"Рыжий" },
  white:{ en:"White", tr:"Beyaz", az:"Ağ", ru:"Белый" },
  bald:{ en:"Bald", tr:"Kel", az:"Keçəl", ru:"Без волос" },
  flameCutter:{ en:"Flame Cutter", tr:"Alevle Kesim Uzmanı", az:"Alovla Kəsmə Mütəxəssisi", ru:"Газорезчик" },
  generalCargo:{ en:"General Cargo", tr:"Genel Kargo", az:"Ümumi Yük Gəmisi", ru:"Сухогруз" },
  bulkCarrier:{ en:"Bulk Carrier", tr:"Dökme Yük Gemisi", az:"Quru Yük Gəmisi", ru:"Балкер" },
  containerShip:{ en:"Container Ship", tr:"Konteyner Gemisi", az:"Konteyner Gəmisi", ru:"Контейнеровоз" },
  tanker:{ en:"Tanker", tr:"Tanker", az:"Tanker", ru:"Танкер" },
  tugboat:{ en:"Tugboat", tr:"Römorkör", az:"Yedək Gəmisi", ru:"Буксир" },
  unlimited:{ en:"Unlimited", tr:"Süresiz", az:"Müddətsiz", ru:"Бессрочно" },
  fit:{ en:"Fit", tr:"Uygun", az:"Uyğundur", ru:"Годен" },
  fitWithRestrictions:{ en:"Fit with restrictions", tr:"Kısıtlamayla uygun", az:"Məhdudiyyətlə uyğundur", ru:"Годен с ограничениями" },
  unfit:{ en:"Unfit", tr:"Uygun değil", az:"Uyğun deyil", ru:"Не годен" }
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

const fieldLocalizationContexts = Object.freeze({
  position:"semantic",
  familyName:"name",
  firstName:"name",
  fatherName:"name",
  birth:"proper",
  birthDate:"date",
  birthPlace:"proper",
  nationality:"semantic",
  gender:"semantic",
  marital:"semantic",
  address:"freeText",
  airport:"proper",
  height:"number",
  weight:"number",
  eyes:"semantic",
  hair:"semantic",
  shoes:"number",
  overall:"semantic",
  mobile:"contact",
  email:"contact",
  kinName:"name",
  kinPhone:"contact",
  kinRelation:"semantic",
  kinAddress:"freeText",
  passportDoc:"semantic",
  passportNo:"identifier",
  passportCountry:"semantic",
  passportPlace:"proper",
  passportIssued:"date",
  passportValid:"date",
  windows:"semantic",
  office:"semantic",
  internet:"semantic",
  seamanBookNo:"identifier",
  seamanBookPlace:"proper",
  seamanBookIssued:"date",
  seamanBookValid:"date",
  seafarerIdNo:"identifier",
  seafarerIdPlace:"proper",
  seafarerIdIssued:"date",
  seafarerIdValid:"date",
  schoolName:"organization",
  schoolPlace:"proper",
  schoolGrade:"semantic",
  schoolFrom:"date",
  schoolTo:"date",
  azSpeak:"semantic",
  azRead:"semantic",
  azWrite:"semantic",
  trSpeak:"semantic",
  trRead:"semantic",
  trWrite:"semantic",
  enSpeak:"semantic",
  enRead:"semantic",
  enWrite:"semantic",
  ruSpeak:"semantic",
  ruRead:"semantic",
  ruWrite:"semantic",
  medicalDoc:"semantic",
  medicalFitness:"semantic",
  medicalGrade:"semantic",
  medicalPlace:"proper",
  medicalIssue:"date",
  medicalExpiry:"date",
  tradeSpecialty:"semantic",
  competencyClass:"semantic",
  competencyCountry:"semantic",
  competencyCertificate:"identifier",
  competencyIssued:"date",
  competencyExpires:"date",
  competencyLimit:"freeText",
  note:"freeText"
});

function translateUserValue(value, context){
  const raw = String(value || "");
  const localizer = window.AllonaMaritimeCvValueLocalizer;
  if(localizer && typeof localizer.localize === "function"){
    const localized = localizer.localize(raw, currentLang, fieldLocalizationContexts[context] || context || "semantic");
    if(localized !== raw) return localized;
  }
  const key = normalizeText(raw);

  for(const itemKey in valueTranslations){
    const item = valueTranslations[itemKey];
    const canonicalKey = normalizeText(itemKey.replace(/([a-z0-9])([A-Z])/g, "$1_$2"));
    const matched = canonicalKey === key || Object.values(item).some(v => normalizeText(v) === key);

    if(matched){
      return item[currentLang] || raw;
    }
  }

  return raw;
}

function translateDynamicValue(value, context){
  return translateUserValue(value, context || "semantic");
}

function displayPosition(){
  const position = translateUserValue(valueOf("position"), "position");
  const specialty = translateUserValue(valueOf("tradeSpecialty"), "tradeSpecialty");
  if(position && specialty) return `${position} (${specialty})`;
  return position || specialty;
}

function dateValue(value){
  const normalized = normalizeDateInput(value);
  if(!normalized) return null;
  const date = new Date(`${normalized}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function seaServiceDays(){
  return seaData.filter(row => row.saved === "true").reduce((total, row) => {
    const start = dateValue(row.signon);
    const end = dateValue(row.signoff);
    if(!start || !end || end < start) return total;
    return total + Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  }, 0);
}

function serviceDuration(days){
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const remainingDays = (days % 365) % 30;
  const parts = [];
  const labels = {
    en: { year: "year", years: "years", month: "month", months: "months", day: "day", days: "days" },
    tr: { year: "yıl", years: "yıl", month: "ay", months: "ay", day: "gün", days: "gün" },
    az: { year: "il", years: "il", month: "ay", months: "ay", day: "gün", days: "gün" },
    ru: { year: "год", years: "лет", month: "месяц", months: "месяцев", day: "день", days: "дней" }
  }[currentLang];
  if(years) parts.push(`${years} ${years === 1 ? labels.year : labels.years}`);
  if(months) parts.push(`${months} ${months === 1 ? labels.month : labels.months}`);
  if(remainingDays || !parts.length) parts.push(`${remainingDays} ${remainingDays === 1 ? labels.day : labels.days}`);
  return parts.join(" ");
}

function completedCertificateCount(){
  return [...additionalData, ...stcwData.filter(row => row.included !== "false")].filter(row => String(row.cert || row.number || row.issue || row.institute || "").trim()).length;
}

function generatedProfessionalSummary(){
  const name = [
    translateUserValue(valueOf("firstName"), "firstName"),
    translateUserValue(valueOf("familyName"), "familyName")
  ].filter(Boolean).join(" ").trim();
  const role = displayPosition();
  const experienceRows = seaData.filter(row => row.saved === "true" && String(row.vessel || row.company || row.rank || row.signon || "").trim());
  const days = seaServiceDays();
  const certificateCount = completedCertificateCount();
  const vesselTypes = [...new Set(experienceRows.map(row => translateDynamicValue(row.type)).filter(Boolean))].slice(0, 3);
  const hasDigitalSkills = [valueOf("windows"), valueOf("office"), valueOf("internet")].some(Boolean);
  const languageCount = ["az", "tr", "en", "ru"].filter(code => [valueOf(`${code}Speak`), valueOf(`${code}Read`), valueOf(`${code}Write`)].some(Boolean)).length;

  const subject = name || ({ en: "The candidate", tr: "Aday", az: "Namizəd", ru: "Кандидат" }[currentLang]);
  const profession = role || ({ en: "maritime professional", tr: "denizcilik profesyoneli", az: "dənizçilik mütəxəssisi", ru: "морской специалист" }[currentLang]);
  const sentences = [];

  if(currentLang === "tr"){
    sentences.push(experienceRows.length
      ? `${subject}, ${profession} pozisyonunda ${days ? serviceDuration(days) : `${experienceRows.length} gemi kaydı`} deniz hizmeti tecrübesine sahiptir.`
      : `${subject}, ${profession} pozisyonunda göreve ve uygun denizcilik fırsatlarını değerlendirmeye hazırdır.`);
    if(vesselTypes.length) sentences.push(`${vesselTypes.join(", ")} tipi gemilerde kayıtlı çalışma deneyimi bulunmaktadır.`);
    if(certificateCount) sentences.push(`CV profilinde ${certificateCount} denizcilik ve mesleki sertifika kaydı yer almaktadır.`);
    if(languageCount || hasDigitalSkills) sentences.push(`${languageCount ? `${languageCount} dilde beyan edilmiş iletişim yetkinliği` : ""}${languageCount && hasDigitalSkills ? " ve " : ""}${hasDigitalSkills ? "bilgisayar kullanma becerileri" : ""} ile gemi operasyonlarına uyum sağlayabilir.`);
  } else if(currentLang === "az"){
    sentences.push(experienceRows.length
      ? `${subject}, ${profession} vəzifəsində ${days ? serviceDuration(days) : `${experienceRows.length} gəmi qeydi`} dəniz xidməti təcrübəsinə malikdir.`
      : `${subject}, ${profession} vəzifəsində işə başlamağa və uyğun dənizçilik imkanlarını dəyərləndirməyə hazırdır.`);
    if(vesselTypes.length) sentences.push(`${vesselTypes.join(", ")} tipli gəmilərdə qeyd edilmiş iş təcrübəsi vardır.`);
    if(certificateCount) sentences.push(`CV profilində ${certificateCount} dənizçilik və peşə sertifikatı qeydi mövcuddur.`);
    if(languageCount || hasDigitalSkills) sentences.push(`${languageCount ? `${languageCount} dil üzrə göstərilmiş ünsiyyət bacarığı` : ""}${languageCount && hasDigitalSkills ? " və " : ""}${hasDigitalSkills ? "kompüter bacarıqları" : ""} ilə gəmi əməliyyatlarına uyğunlaşa bilər.`);
  } else if(currentLang === "ru"){
    sentences.push(experienceRows.length
      ? `${subject} имеет морской стаж ${days ? serviceDuration(days) : `по ${experienceRows.length} судам`} в должности ${profession}.`
      : `${subject} готов к работе в должности ${profession} и к рассмотрению подходящих морских вакансий.`);
    if(vesselTypes.length) sentences.push(`Имеется заявленный опыт работы на судах типов: ${vesselTypes.join(", ")}.`);
    if(certificateCount) sentences.push(`В профиле CV указано морских и профессиональных сертификатов: ${certificateCount}.`);
    if(languageCount || hasDigitalSkills) sentences.push(`${languageCount ? `Заявлены навыки общения на ${languageCount} языках` : ""}${languageCount && hasDigitalSkills ? " и " : ""}${hasDigitalSkills ? "навыки работы с компьютером" : ""}, необходимые для адаптации к судовым операциям.`);
  } else {
    sentences.push(experienceRows.length
      ? `${subject} has ${days ? serviceDuration(days) : `recorded service across ${experienceRows.length} vessels`} of sea-service experience as ${profession}.`
      : `${subject} is ready to work as ${profession} and pursue suitable maritime assignments.`);
    if(vesselTypes.length) sentences.push(`Recorded experience includes ${vesselTypes.join(", ")} vessels.`);
    if(certificateCount) sentences.push(`The CV profile lists ${certificateCount} maritime and professional certificate record${certificateCount === 1 ? "" : "s"}.`);
    if(languageCount || hasDigitalSkills) sentences.push(`${languageCount ? `Declared communication skills in ${languageCount} languages` : ""}${languageCount && hasDigitalSkills ? " and " : ""}${hasDigitalSkills ? "computer proficiency" : ""} support readiness for vessel operations.`);
  }

  return sentences.join(" ");
}

function setSummaryModeFromInput(value){
  summaryMode = String(value || "").trim() ? "custom" : "auto";
}

function generateSummary(){
  summaryMode = "auto";
  const note = document.getElementById("note");
  if(note) note.value = "";
  syncCV();
  autoSaveCV();
  alert(t("summaryGenerated"));
}

function syncCV(){
  textFields.forEach(id => {
    const raw = id === "note" && summaryMode === "auto" ? generatedProfessionalSummary() : (dateFieldIds.has(id) ? formatDisplayDate(valueOf(id)) : valueOf(id));
    const translated = id === "position" ? displayPosition() : id === "note" && summaryMode === "auto" ? raw : translateUserValue(raw, id);
    setCV(id, escapeHTML(translated).replace(/\n/g, "<br>"));
  });

  renderAdditionals();
  renderSTCW();
  renderSea();
}
