(function () {
  const mobileQuery = window.matchMedia("(max-width: 760px)");
  const responsiveExperience = document.body && document.body.dataset.maritimeExperience === "responsive";
  const languageCodes = ["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"];
  const languageNames = {
    tr: "Türkçe",
    az: "Azərbaycanca",
    kk: "Қазақша",
    uz: "Oʻzbekcha",
    ky: "Кыргызча",
    en: "English",
    de: "Deutsch",
    ru: "Русский",
    ar: "العربية"
  };

  // Each row follows languageCodes so every visible phrase stays complete in all nine languages.
  const copyRows = {
    pageTitle: ["Allona Denizcilik | AllonaHub", "Allona Dənizçilik | AllonaHub", "Allona Теңіз ісі | AllonaHub", "Allona Dengizchilik | AllonaHub", "Allona Деңизчилик | AllonaHub", "Allona Maritime | AllonaHub", "Allona Seefahrt | AllonaHub", "Allona Морское дело | AllonaHub", "Allona للملاحة البحرية | AllonaHub"],
    pageDescription: ["AllonaHub Denizcilik: denizcilik iş ilanları, Crew CV, belge ve başvuru takibi.", "AllonaHub Dənizçilik: dənizçilik iş elanları, Crew CV, sənəd və müraciət izləmə.", "AllonaHub Теңіз ісі: теңіздегі бос жұмыс орындары, Crew CV, құжаттар мен өтінімдерді бақылау.", "AllonaHub Dengizchilik: dengizchilik ish eʼlonlari, Crew CV, hujjatlar va arizalarni kuzatish.", "AllonaHub Деңизчилик: деңиздеги жумуш жарыялары, Crew CV, документтерди жана арыздарды көзөмөлдөө.", "AllonaHub Maritime: maritime jobs, Crew CV, documents and application tracking.", "AllonaHub Seefahrt: maritime Stellen, Crew CV, Dokumente und Bewerbungsverfolgung.", "AllonaHub Морское дело: вакансии, Crew CV, документы и отслеживание заявок.", "AllonaHub للملاحة البحرية: وظائف بحرية وملف Crew CV ومستندات ومتابعة الطلبات."],
    skipContent: ["Ana içeriğe geç", "Əsas məzmuna keç", "Негізгі мазмұнға өту", "Asosiy tarkibga oʻtish", "Негизги мазмунга өтүү", "Skip to main content", "Zum Hauptinhalt", "Перейти к основному содержанию", "الانتقال إلى المحتوى الرئيسي"],
    experienceLabel: ["Allona Denizcilik", "Allona Dənizçilik", "Allona Теңіз ісі", "Allona Dengizchilik", "Allona Деңизчилик", "Allona Maritime", "Allona Seefahrt", "Allona Морское дело", "Allona للملاحة البحرية"],
    homeLabel: ["AllonaHub ana sayfa", "AllonaHub ana səhifəsi", "AllonaHub басты беті", "AllonaHub bosh sahifasi", "AllonaHub башкы бети", "AllonaHub home", "AllonaHub Startseite", "Главная AllonaHub", "الصفحة الرئيسية لـ AllonaHub"],
    brandModule: ["Denizcilik", "Dənizçilik", "Теңіз ісі", "Dengizchilik", "Деңизчилик", "Maritime", "Seefahrt", "Морское дело", "الملاحة البحرية"],
    signIn: ["Giriş Yap", "Daxil ol", "Кіру", "Kirish", "Кирүү", "Sign In", "Anmelden", "Войти", "تسجيل الدخول"],
    myAccount: ["Hesabım", "Hesabım", "Менің аккаунтым", "Mening hisobim", "Менин аккаунтум", "My Account", "Mein Konto", "Мой аккаунт", "حسابي"],
    menuLabel: ["Denizcilik menüsü", "Dənizçilik menyusu", "Теңіз ісі мәзірі", "Dengizchilik menyusi", "Деңизчилик менюсу", "Maritime menu", "Seefahrt-Menü", "Меню морского раздела", "قائمة الملاحة البحرية"],
    jobListings: ["İş İlanları", "İş elanları", "Жұмыс орындары", "Ish eʼlonlari", "Жумуш жарыялары", "Job Listings", "Stellenangebote", "Вакансии", "الوظائف"],
    myApplications: ["Başvurularım", "Müraciətlərim", "Өтінімдерім", "Arizalarim", "Арыздарым", "My Applications", "Meine Bewerbungen", "Мои заявки", "طلباتي"],
    jobOffers: ["İş Tekliflerim", "İş təkliflərim", "Жұмыс ұсыныстарым", "Ish takliflarim", "Жумуш сунуштарым", "Job Offers", "Jobangebote", "Предложения работы", "عروض العمل"],
    autoApply: ["Otomatik Başvuru", "Avtomatik müraciət", "Автоматты өтінім", "Avtomatik ariza", "Автоматтык арыз", "Auto Apply", "Automatische Bewerbung", "Автоподача", "التقديم التلقائي"],
    complaint: ["Şikayet", "Şikayət", "Шағым", "Shikoyat", "Даттануу", "Complaint", "Beschwerde", "Жалоба", "شكوى"],
    searchLabel: ["Denizcilik iş ilanı ara", "Dənizçilik iş elanı axtar", "Теңіздегі жұмысты іздеу", "Dengizchilik ishini qidirish", "Деңиздеги жумушту издөө", "Search maritime jobs", "Maritime Stellen suchen", "Поиск морских вакансий", "البحث عن وظائف بحرية"],
    searchPlaceholder: ["Pozisyon veya sertifika ara", "Vəzifə və ya sertifikat axtar", "Лауазым немесе сертификат іздеу", "Lavozim yoki sertifikatni qidiring", "Кызмат ордун же сертификатты издеңиз", "Search position or certificate", "Position oder Zertifikat suchen", "Должность или сертификат", "ابحث عن وظيفة أو شهادة"],
    searchButton: ["Ara", "Axtar", "Іздеу", "Qidirish", "Издөө", "Search", "Suchen", "Найти", "بحث"],
    commissionFreeLabel: ["Komisyonsuz iş başvurusu", "Komissiyasız iş müraciəti", "Комиссиясыз жұмысқа өтінім", "Komissiyasiz ishga ariza", "Комиссиясыз жумушка арыз", "Commission-free job application", "Provisionsfreie Bewerbung", "Отклик без комиссии", "طلب وظيفة من دون عمولة"],
    commissionFree: ["Komisyonsuz", "Komissiyasız", "Комиссиясыз", "Komissiyasiz", "Комиссиясыз", "Commission Free", "Provisionsfrei", "Без комиссии", "من دون عمولة"],
    noApplicationFee: ["İş başvurularında ücret alınmaz", "İş müraciətlərinə görə ödəniş alınmır", "Жұмысқа өтінім үшін ақы алынбайды", "Ishga ariza uchun haq olinmaydi", "Жумушка арыз үчүн акы алынбайт", "No fee is charged for job applications", "Keine Gebühr für Bewerbungen", "Плата за отклик не взимается", "لا تُفرض رسوم على طلبات العمل"],
    safetyTitle: ["UYARI!", "XƏBƏRDARLIQ!", "ЕСКЕРТУ!", "OGOHLANTIRISH!", "ЭСКЕРТҮҮ!", "WARNING!", "WARNUNG!", "ВНИМАНИЕ!", "تحذير!"],
    safetyText: ["Komisyon veya ücret talep edenlere itibar etmeyiniz ve hiçbir koşulda ödeme yapmayınız. Bu platformdaki firmalar yalnızca doğrulanmış mavi rozetli firmalar olacaktır.", "Komissiya və ya ödəniş tələb edənlərə etibar etməyin və heç bir halda ödəniş etməyin. Bu platformada yalnız təsdiqlənmiş mavi nişanlı şirkətlər olacaq.", "Комиссия немесе төлем сұрағандарға сенбеңіз және еш жағдайда ақша төлемеңіз. Бұл платформада тек расталған көк белгісі бар компаниялар болады.", "Komissiya yoki to‘lov so‘raganlarga ishonmang va hech qanday holatda pul to‘lamang. Ushbu platformada faqat tasdiqlangan ko‘k nishonli kompaniyalar bo‘ladi.", "Комиссия же акы сурагандарга ишенбеңиз жана эч кандай шартта төлөбөңүз. Бул платформада текшерилген көк белгиси бар компаниялар гана болот.", "Do not trust anyone asking for a commission or fee, and never make a payment. This platform will only feature verified companies with a blue badge.", "Vertrauen Sie niemandem, der Provisionen oder Gebühren verlangt, und leisten Sie unter keinen Umständen Zahlungen. Auf dieser Plattform werden ausschließlich verifizierte Unternehmen mit blauem Haken vertreten sein.", "Не доверяйте тем, кто требует комиссию или оплату, и ни при каких условиях не переводите деньги. На этой платформе будут представлены только проверенные компании с синей отметкой.", "لا تثق بمن يطلب عمولة أو رسوماً، ولا تدفع أي مبلغ تحت أي ظرف. لن تضم هذه المنصة إلا الشركات الموثقة ذات الشارة الزرقاء."],
    heroTitle: ["Denizdeki yeni işini bul.", "Dənizdə yeni işini tap.", "Теңіздегі жаңа жұмысыңды тап.", "Dengizdagi yangi ishingizni toping.", "Деңиздеги жаңы жумушуңузду табыңыз.", "Find your next job at sea.", "Finden Sie Ihren neuen Job auf See.", "Найдите новую работу в море.", "اعثر على وظيفتك الجديدة في البحر."],
    heroLead: ["Denizcilik pozisyonlarını incele, Crew profilini tamamla ve başvurularını tek hesabından takip et.", "Dənizçilik vəzifələrinə bax, Crew profilini tamamla və müraciətlərini bir hesabdan izlə.", "Теңіздегі лауазымдарды қарап, Crew профиліңді толтыр және өтінімдеріңді бір аккаунттан бақыла.", "Dengizchilik lavozimlarini ko‘ring, Crew profilingizni to‘ldiring va arizalaringizni bitta hisobdan kuzating.", "Деңизчилик кызматтарын карап, Crew профилиңизди толтуруңуз жана арыздарыңызды бир аккаунттан көзөмөлдөңүз.", "Explore maritime positions, complete your Crew profile, and track applications from one account.", "Entdecken Sie maritime Stellen, vervollständigen Sie Ihr Crew-Profil und verfolgen Sie Bewerbungen in einem Konto.", "Просматривайте морские вакансии, заполните профиль Crew и отслеживайте заявки в одном аккаунте.", "استعرض الوظائف البحرية، وأكمل ملف Crew، وتابع طلباتك من حساب واحد."],
    marsohTagline: ["Denizcilerin küresel sohbet ağı", "Dənizçilərin qlobal söhbət şəbəkəsi", "Теңізшілердің жаһандық сұхбат желісі", "Dengizchilarning global suhbat tarmogʻi", "Деңизчилердин дүйнөлүк баарлашуу тармагы", "The global chat network for seafarers", "Das globale Chatnetzwerk für Seeleute", "Глобальная сеть общения моряков", "شبكة الدردشة العالمية للبحارة"],
    marsohAria: ["MarSoh sohbet alanını aç", "MarSoh söhbət sahəsini aç", "MarSoh сұхбат аймағын ашу", "MarSoh suhbat maydonini ochish", "MarSoh баарлашуу аймагын ачуу", "Open the MarSoh chat area", "MarSoh-Chatbereich öffnen", "Открыть чат MarSoh", "فتح مساحة دردشة MarSoh"],
    viewJobs: ["İş İlanlarını Gör", "İş elanlarına bax", "Вакансияларды көру", "Ish eʼlonlarini ko‘rish", "Жумуш жарыяларын көрүү", "View Job Listings", "Stellenangebote ansehen", "Смотреть вакансии", "عرض الوظائف"],
    createCrewCv: ["Crew CV Oluştur", "Crew CV yarat", "Crew CV жасау", "Crew CV yaratish", "Crew CV түзүү", "Create Crew CV", "Crew CV erstellen", "Создать Crew CV", "إنشاء Crew CV"],
    openPositions: ["Açık Pozisyonlar", "Açıq vəzifələr", "Ашық лауазымдар", "Ochiq lavozimlar", "Ачык кызматтар", "Open Positions", "Offene Stellen", "Открытые вакансии", "الوظائف المتاحة"],
    companyInfoRule: ["Firma bilgileri yalnızca kabul edilen başvuruda açılır.", "Şirkət məlumatları yalnız qəbul edilmiş müraciətdə açılır.", "Компания ақпараты тек қабылданған өтінімде ашылады.", "Kompaniya maʼlumotlari faqat qabul qilingan arizada ochiladi.", "Компаниянын маалыматы кабыл алынган арызда гана ачылат.", "Company details are revealed only after an application is accepted.", "Unternehmensdaten werden erst nach Annahme der Bewerbung angezeigt.", "Данные компании открываются только после принятия заявки.", "تظهر بيانات الشركة فقط بعد قبول الطلب."],
    viewAll: ["Tümü", "Hamısı", "Барлығы", "Barchasi", "Баары", "All", "Alle", "Все", "الكل"],
    jobsRailLabel: ["Denizcilik iş ilanları", "Dənizçilik iş elanları", "Теңіз жұмыстары", "Dengizchilik ish eʼlonlari", "Деңиз жумуштары", "Maritime jobs", "Maritime Stellen", "Морские вакансии", "الوظائف البحرية"],
    jobEngineer: ["2. Mühendis", "2-ci mühəndis", "Екінші механик", "Ikkinchi mexanik", "Экинчи механик", "Second Engineer", "Zweiter Ingenieur", "Второй механик", "المهندس الثاني"],
    jobEngineerDesc: ["Uzakyol seferi, 6 aylık kontrat. Doğrulanmış denizcilik partneri.", "Uzaq səfər, 6 aylıq müqavilə. Təsdiqlənmiş dənizçilik partneri.", "Алыс сапар, 6 айлық келісімшарт. Расталған теңіз серіктесі.", "Uzoq safar, 6 oylik shartnoma. Tasdiqlangan dengizchilik hamkori.", "Алыскы сапар, 6 айлык келишим. Текшерилген деңизчилик өнөктөшү.", "Ocean-going voyage, 6-month contract. Verified maritime partner.", "Hochseefahrt, 6-Monats-Vertrag. Verifizierter maritimer Partner.", "Дальний рейс, контракт на 6 месяцев. Проверенный морской партнер.", "رحلة بحرية بعيدة، عقد لمدة 6 أشهر. شريك بحري موثق."],
    urgent: ["Acil", "Təcili", "Шұғыл", "Shoshilinch", "Шашылыш", "Urgent", "Dringend", "Срочно", "عاجل"],
    applicationOpen: ["Başvuru açık", "Müraciət açıqdır", "Өтінім ашық", "Ariza ochiq", "Арыз ачык", "Applications open", "Bewerbung offen", "Прием заявок открыт", "التقديم مفتوح"],
    reviewListing: ["İlanı incele", "Elana bax", "Вакансияны қарау", "Eʼlonni ko‘rish", "Жарыяны көрүү", "View listing", "Stelle ansehen", "Открыть вакансию", "عرض الوظيفة"],
    jobAbleSeaman: ["Usta Gemici", "Bacarıqlı matros", "Білікті матрос", "Malakali matros", "Дасыккан матрос", "Able Seaman", "Vollmatrose", "Квалифицированный матрос", "بحّار ماهر"],
    jobAbleSeamanDesc: ["Avrupa seferi, 6 aylık kontrat. Doğrulanmış denizcilik partneri.", "Avropa səfəri, 6 aylıq müqavilə. Təsdiqlənmiş dənizçilik partneri.", "Еуропа бағыты, 6 айлық келісімшарт. Расталған теңіз серіктесі.", "Yevropa safari, 6 oylik shartnoma. Tasdiqlangan dengizchilik hamkori.", "Европа сапары, 6 айлык келишим. Текшерилген деңизчилик өнөктөшү.", "European voyage, 6-month contract. Verified maritime partner.", "Europafahrt, 6-Monats-Vertrag. Verifizierter maritimer Partner.", "Европейский рейс, контракт на 6 месяцев. Проверенный морской партнер.", "رحلة أوروبية، عقد لمدة 6 أشهر. شريك بحري موثق."],
    experience24Months: ["24 ay deneyim", "24 ay təcrübə", "24 ай тәжірибе", "24 oy tajriba", "24 ай тажрыйба", "24 months experience", "24 Monate Erfahrung", "Опыт 24 месяца", "خبرة 24 شهراً"],
    cvRequired: ["CV gerekli", "CV tələb olunur", "CV қажет", "CV talab qilinadi", "CV талап кылынат", "CV required", "CV erforderlich", "Требуется CV", "السيرة الذاتية مطلوبة"],
    jobChiefOfficer: ["Baş Zabit", "Baş zabit", "Аға көмекші", "Bosh yordamchi", "Башкы жардамчы", "Chief Officer", "Erster Offizier", "Старший помощник", "كبير الضباط"],
    jobChiefOfficerDesc: ["Uluslararası sefer, vardiya sorumluluğu. Doğrulanmış denizcilik partneri.", "Beynəlxalq səfər, növbə məsuliyyəti. Təsdiqlənmiş dənizçilik partneri.", "Халықаралық сапар, вахта жауапкершілігі. Расталған теңіз серіктесі.", "Xalqaro safar, navbatchilik masʼuliyati. Tasdiqlangan dengizchilik hamkori.", "Эл аралык сапар, нөөмөт жоопкерчилиги. Текшерилген деңизчилик өнөктөшү.", "International voyage with watchkeeping responsibility. Verified maritime partner.", "Internationale Fahrt mit Wachverantwortung. Verifizierter maritimer Partner.", "Международный рейс, ответственность за вахту. Проверенный морской партнер.", "رحلة دولية مع مسؤولية المناوبة. شريك بحري موثق."],
    englishLanguage: ["İngilizce", "İngilis dili", "Ағылшын тілі", "Ingliz tili", "Англис тили", "English", "Englisch", "Английский", "الإنجليزية"],
    jobOiler: ["Yağcı", "Motorçu", "Моторшы", "Motorchi", "Моторчу", "Oiler", "Öler", "Моторист", "مزيّت المحركات"],
    jobOilerDesc: ["Makine departmanı, kontrat açık. Doğrulanmış denizcilik partneri.", "Maşın şöbəsi, müqavilə açıqdır. Təsdiqlənmiş dənizçilik partneri.", "Машина бөлімі, келісімшарт ашық. Расталған теңіз серіктесі.", "Mashina bo‘limi, shartnoma ochiq. Tasdiqlangan dengizchilik hamkori.", "Машина бөлүмү, келишим ачык. Текшерилген деңизчилик өнөктөшү.", "Engine department, contract open. Verified maritime partner.", "Maschinenabteilung, Vertrag offen. Verifizierter maritimer Partner.", "Машинное отделение, контракт открыт. Проверенный морской партнер.", "قسم المحركات، العقد متاح. شريك بحري موثق."],
    experienced: ["Deneyimli", "Təcrübəli", "Тәжірибелі", "Tajribali", "Тажрыйбалуу", "Experienced", "Erfahren", "С опытом", "ذو خبرة"],
    application: ["Başvuru", "Müraciət", "Өтінім", "Ariza", "Арыз", "Apply", "Bewerbung", "Отклик", "تقديم"],
    privacyNote: ["Firma adı ve iletişim bilgileri yalnızca kabul edilen başvurunun güvenli hesap ekranında görüntülenir.", "Şirkətin adı və əlaqə məlumatları yalnız qəbul edilmiş müraciətin təhlükəsiz hesab ekranında göstərilir.", "Компания атауы мен байланыс деректері тек қабылданған өтінімнің қауіпсіз аккаунт бетінде көрсетіледі.", "Kompaniya nomi va aloqa maʼlumotlari faqat qabul qilingan arizaning xavfsiz hisob sahifasida ko‘rsatiladi.", "Компаниянын аталышы жана байланыш маалыматы кабыл алынган арыздын коопсуз аккаунт экранында гана көрсөтүлөт.", "The company name and contact details are shown only in the secure account view of an accepted application.", "Firmenname und Kontaktdaten werden nur im sicheren Konto einer angenommenen Bewerbung angezeigt.", "Название и контакты компании показываются только в защищенном аккаунте после принятия заявки.", "لا يظهر اسم الشركة وبيانات الاتصال إلا في شاشة الحساب الآمنة للطلب المقبول."],
    crewPreparation: ["Crew Hazırlığı", "Crew hazırlığı", "Crew дайындығы", "Crew tayyorgarligi", "Crew даярдыгы", "Crew Preparation", "Crew-Vorbereitung", "Подготовка Crew", "تجهيز Crew"],
    completeProfile: ["Başvuru öncesi profilini tamamla.", "Müraciətdən əvvəl profilini tamamla.", "Өтінім бермес бұрын профиліңді толтыр.", "Ariza berishdan oldin profilingizni to‘ldiring.", "Арыз берүүдөн мурун профилиңизди толтуруңуз.", "Complete your profile before applying.", "Vervollständigen Sie Ihr Profil vor der Bewerbung.", "Заполните профиль перед подачей заявки.", "أكمل ملفك قبل التقديم."],
    maritimeCvDesc: ["Deniz hizmeti, yeterlilik ve sertifikalarını tek profilde topla.", "Dəniz xidməti, səriştə və sertifikatlarını bir profildə topla.", "Теңіз қызметін, біліктіліктерің мен сертификаттарыңды бір профильге жина.", "Dengiz xizmati, malaka va sertifikatlaringizni bitta profilga jamlang.", "Деңиз кызматын, квалификацияларыңызды жана сертификаттарыңызды бир профилге топтоңуз.", "Collect your sea service, qualifications, and certificates in one profile.", "Bündeln Sie Seefahrtzeiten, Qualifikationen und Zertifikate in einem Profil.", "Соберите морской стаж, квалификации и сертификаты в одном профиле.", "اجمع خدمتك البحرية ومؤهلاتك وشهاداتك في ملف واحد."],
    myDocuments: ["Belgelerim", "Sənədlərim", "Құжаттарым", "Hujjatlarim", "Документтерим", "My Documents", "Meine Dokumente", "Мои документы", "مستنداتي"],
    documentsDesc: ["STCW ve denizci belgelerini kontrol et.", "STCW və dənizçi sənədlərini yoxla.", "STCW және теңізші құжаттарын тексер.", "STCW va dengizchi hujjatlarini tekshiring.", "STCW жана деңизчи документтерин текшериңиз.", "Review your STCW and seafarer documents.", "Prüfen Sie Ihre STCW- und Seefahrerdokumente.", "Проверьте документы STCW и документы моряка.", "راجع مستندات STCW ومستندات البحّار."],
    applicationsDesc: ["Başvuru durumlarını hesabından takip et.", "Müraciət statuslarını hesabından izlə.", "Өтінім күйлерін аккаунтыңнан бақыла.", "Arizalar holatini hisobingizdan kuzating.", "Арыздардын абалын аккаунтуңуздан көзөмөлдөңүз.", "Track application status from your account.", "Verfolgen Sie den Bewerbungsstatus in Ihrem Konto.", "Отслеживайте статус заявок в аккаунте.", "تابع حالة طلباتك من حسابك."],
    maritimeMarket: ["Denizcilik Pazarı", "Dənizçilik bazarı", "Теңіз нарығы", "Dengizchilik bozori", "Деңизчилик базары", "Maritime Market", "Maritimer Markt", "Морской рынок", "السوق البحري"],
    marketLead: ["İş arayan denizci için gerekli bağlantılar.", "İş axtaran dənizçi üçün lazım olan bağlantılar.", "Жұмыс іздейтін теңізшіге қажетті сілтемелер.", "Ish izlayotgan dengizchi uchun kerakli havolalar.", "Жумуш издеген деңизчи үчүн керектүү шилтемелер.", "Useful links for seafarers looking for work.", "Wichtige Links für arbeitsuchende Seeleute.", "Полезные ссылки для моряков, ищущих работу.", "روابط مفيدة للبحّارة الباحثين عن عمل."],
    marketRailLabel: ["Denizcilik pazarı", "Dənizçilik bazarı", "Теңіз нарығы", "Dengizchilik bozori", "Деңизчилик базары", "Maritime market", "Maritimer Markt", "Морской рынок", "السوق البحري"],
    crewEquipment: ["Crew Ekipmanları", "Crew avadanlıqları", "Crew жабдықтары", "Crew jihozlari", "Crew жабдыктары", "Crew Equipment", "Crew-Ausrüstung", "Снаряжение Crew", "معدات Crew"],
    crewEquipmentDesc: ["İş kıyafeti, güvenlik ekipmanı ve denizcilik ihtiyaçlarını ara.", "İş geyimi, təhlükəsizlik avadanlığı və dənizçilik ehtiyaclarını axtar.", "Жұмыс киімін, қауіпсіздік жабдығын және теңізге қажетті заттарды ізде.", "Ish kiyimi, xavfsizlik jihozlari va dengizchilik ehtiyojlarini qidiring.", "Жумуш кийимин, коопсуздук жабдыгын жана деңизчилик керектөөлөрүн издеңиз.", "Find workwear, safety equipment, and maritime essentials.", "Finden Sie Arbeitskleidung, Sicherheitsausrüstung und maritimen Bedarf.", "Найдите спецодежду, средства безопасности и морское снаряжение.", "ابحث عن ملابس العمل ومعدات السلامة والاحتياجات البحرية."],
    viewProducts: ["Ürünleri gör", "Məhsullara bax", "Өнімдерді көру", "Mahsulotlarni ko‘rish", "Товарларды көрүү", "View products", "Produkte ansehen", "Смотреть товары", "عرض المنتجات"],
    trainingCertificates: ["Eğitim ve Sertifika", "Təlim və sertifikat", "Оқу және сертификат", "Taʼlim va sertifikat", "Окутуу жана сертификат", "Training and Certification", "Schulung und Zertifizierung", "Обучение и сертификация", "التدريب والشهادات"],
    trainingDesc: ["Mesleki eğitim ve sertifika seçeneklerine ulaş.", "Peşəkar təlim və sertifikat seçimlərinə çat.", "Кәсіби оқу мен сертификат нұсқаларына қол жеткіз.", "Kasbiy taʼlim va sertifikat variantlariga o‘ting.", "Кесиптик окутуу жана сертификат тандоолоруна жетиңиз.", "Access professional training and certification options.", "Finden Sie berufliche Schulungen und Zertifizierungen.", "Получите доступ к профессиональному обучению и сертификации.", "اطّلع على خيارات التدريب المهني والشهادات."],
    viewTraining: ["Eğitimleri gör", "Təlimlərə bax", "Оқуларды көру", "Taʼlimlarni ko‘rish", "Окутууларды көрүү", "View training", "Schulungen ansehen", "Смотреть обучение", "عرض الدورات"],
    applicationSupport: ["Başvuru Desteği", "Müraciət dəstəyi", "Өтінімге қолдау", "Ariza bo‘yicha yordam", "Арыз боюнча колдоо", "Application Support", "Bewerbungshilfe", "Помощь с заявкой", "دعم التقديم"],
    supportDesc: ["Hesap, CV ve başvuru adımlarında destek al.", "Hesab, CV və müraciət addımlarında dəstək al.", "Аккаунт, CV және өтінім қадамдары бойынша көмек ал.", "Hisob, CV va ariza bosqichlarida yordam oling.", "Аккаунт, CV жана арыз кадамдары боюнча жардам алыңыз.", "Get help with your account, CV, and application steps.", "Erhalten Sie Hilfe bei Konto, CV und Bewerbung.", "Получите помощь с аккаунтом, CV и подачей заявки.", "احصل على المساعدة في الحساب والسيرة الذاتية وخطوات التقديم."],
    goToSupport: ["Desteğe git", "Dəstəyə keç", "Қолдауға өту", "Yordamga o‘tish", "Колдоого өтүү", "Go to support", "Zum Support", "Перейти в поддержку", "الانتقال إلى الدعم"],
    languageSelector: ["Dil seçimi", "Dil seçimi", "Тіл таңдау", "Til tanlash", "Тил тандоо", "Language selection", "Sprachauswahl", "Выбор языка", "اختيار اللغة"],
    themeSelector: ["Tema seçimi", "Tema seçimi", "Тақырып таңдау", "Mavzuni tanlash", "Теманы тандоо", "Theme selection", "Themenauswahl", "Выбор темы", "اختيار السمة"],
    themeOcean: ["Deniz", "Dəniz", "Теңіз", "Dengiz", "Деңиз", "Ocean", "Meer", "Море", "البحر"],
    themeWhite: ["Açık", "Açıq", "Ашық", "Yorugʻ", "Жарык", "Light", "Hell", "Светлая", "فاتح"],
    themeSunset: ["Gün Batımı", "Gün batımı", "Күн батуы", "Quyosh botishi", "Күн батышы", "Sunset", "Sonnenuntergang", "Закат", "الغروب"],
    themeTurquoise: ["Turkuaz", "Firuzəyi", "Көгілдір", "Feruza", "Бирюза", "Turquoise", "Türkis", "Бирюзовая", "فيروزي"],
    searchPrefix: ["denizcilik", "dənizçilik", "теңіз ісі", "dengizchilik", "деңизчилик", "maritime", "seefahrt", "морские вакансии", "وظائف بحرية"],
    searchDefault: ["denizcilik iş ilanları", "dənizçilik iş elanları", "теңіздегі жұмыс орындары", "dengizchilik ish eʼlonlari", "деңиздеги жумуш жарыялары", "maritime job listings", "maritime Stellenangebote", "морские вакансии", "وظائف بحرية"],
    paymentMethodsLabel: ["Desteklenen ödeme yöntemleri", "Dəstəklənən ödəniş üsulları", "Қолдау көрсетілетін төлем әдістері", "Qo‘llab-quvvatlanadigan to‘lov usullari", "Колдоого алынган төлөм ыкмалары", "Supported payment methods", "Unterstützte Zahlungsmethoden", "Поддерживаемые способы оплаты", "طرق الدفع المدعومة"],
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
    rightsReserved: ["Tüm hakları saklıdır.", "Bütün hüquqlar qorunur.", "Барлық құқықтар қорғалған.", "Barcha huquqlar himoyalangan.", "Бардык укуктар корголгон.", "All rights reserved.", "Alle Rechte vorbehalten.", "Все права защищены.", "جميع الحقوق محفوظة."]
  };

  const translations = Object.fromEntries(languageCodes.map(function (code, index) {
    return [code, Object.fromEntries(Object.entries(copyRows).map(function (entry) {
      return [entry[0], entry[1][index]];
    }))];
  }));

  function mobileOnly() {
    return responsiveExperience || mobileQuery.matches;
  }

  function currentLanguage(event) {
    const requested = event && event.detail && event.detail.language;
    const stored = requested || localStorage.getItem("allona.language") || document.documentElement.lang || "tr";
    const normalized = String(stored).toLowerCase();
    return languageCodes.includes(normalized) ? normalized : "tr";
  }

  function footerColumnMap() {
    return [
      null,
      { title: "shopping", links: ["products", null, "experienceLabel", "allonaFood", null, "coupons", "favorites", "orders"] },
      { title: "customer", links: ["aboutUs", "contact", "supportCenter", "academy", "myDocuments", "notifications", "delivery", "returns"] },
      { title: "ecosystem", links: ["allModules", "partnerApplication", "coupon", null, "career", "partnerMembership"] },
      { title: "legal", links: ["distanceSales", "preliminaryInfo", "privacyPolicy", "kvkkNotice", "cookiePolicy", "terms", "securityPolicy"] }
    ];
  }

  function setNodeText(node, value) {
    if (node && value && node.textContent !== value) node.textContent = value;
  }

  function setOptionText(option, value) {
    if (!option || !value) return;
    const textNode = Array.from(option.childNodes).find(function (node) {
      return node.nodeType === 3;
    });
    if (textNode) {
      if (textNode.nodeValue.trim() !== value) textNode.nodeValue = value;
      return;
    }
    option.appendChild(document.createTextNode(value));
  }

  function applyFooterLanguage(copy) {
    const footer = document.querySelector(".site-footer");
    if (!footer) return false;
    footer.setAttribute("data-no-translate", "");
    const columns = Array.from(footer.querySelectorAll(".footer-grid .footer-col"));
    const introParagraphs = columns[0] ? columns[0].querySelectorAll(":scope > p") : [];
    setNodeText(introParagraphs[0], copy.footerIntro);
    setNodeText(introParagraphs[2], copy.footerLocation);

    footerColumnMap().forEach(function (mapping, index) {
      if (!mapping || !columns[index]) return;
      const heading = columns[index].querySelector("h3");
      setNodeText(heading, copy[mapping.title]);
      Array.from(columns[index].querySelectorAll(":scope > a")).forEach(function (link, linkIndex) {
        const key = mapping.links[linkIndex];
        if (key) setNodeText(link, copy[key]);
      });
    });

    const social = footer.querySelector(".social-icons");
    if (social) social.setAttribute("aria-label", copy.socialLinksLabel);
    const payment = footer.querySelector(".footer-payment-strip");
    if (payment) payment.setAttribute("aria-label", copy.paymentMethodsLabel);
    const bottom = footer.querySelector(".footer-bottom");
    if (bottom) {
      const copyright = bottom.querySelector(":scope > span:first-child");
      setNodeText(copyright, `© ${new Date().getFullYear()} AllonaHub. ${copy.rightsReserved}`);
      const links = bottom.querySelectorAll(".footer-bottom__links a");
      const keys = ["terms", "privacyPolicy", "cookiePolicy"];
      links.forEach(function (link, index) {
        setNodeText(link, copy[keys[index]]);
      });
    }
    return true;
  }

  function localizeLanguageControl(language, copy) {
    const slot = document.querySelector(".mobile-maritime__control-slot");
    if (!slot) return false;
    const languageButton = slot.querySelector(".platform-language-btn");
    const themeButton = slot.querySelector(".platform-theme-btn");
    if (!languageButton || !themeButton) return false;

    languageButton.title = copy.languageSelector;
    languageButton.setAttribute("aria-label", copy.languageSelector);
    themeButton.title = copy.themeSelector;
    themeButton.setAttribute("aria-label", copy.themeSelector);
    const languageMenu = languageButton.closest("[data-platform-control]").querySelector("[data-platform-menu]");
    if (languageMenu) languageMenu.setAttribute("aria-label", copy.languageSelector);
    const themeMenu = themeButton.closest("[data-platform-control]").querySelector("[data-platform-menu]");
    if (themeMenu) themeMenu.setAttribute("aria-label", copy.themeSelector);
    slot.querySelectorAll("[data-language-option]").forEach(function (option) {
      const code = option.dataset.languageOption;
      option.hidden = !languageCodes.includes(code);
      setNodeText(option, languageNames[code]);
    });
    const themeKeys = { ocean: "themeOcean", white: "themeWhite", sunset: "themeSunset", turquoise: "themeTurquoise" };
    slot.querySelectorAll("[data-theme-option]").forEach(function (option) {
      setOptionText(option, copy[themeKeys[option.dataset.themeOption]]);
    });
    return true;
  }

  function applyMaritimeLanguage(event) {
    const language = currentLanguage(event);
    const copy = translations[language];
    document.querySelectorAll("[data-maritime-i18n]").forEach(function (node) {
      const value = copy[node.dataset.maritimeI18n];
      setNodeText(node, value);
    });
    document.querySelectorAll("[data-maritime-i18n-aria]").forEach(function (node) {
      const value = copy[node.dataset.maritimeI18nAria];
      if (value) node.setAttribute("aria-label", value);
    });
    document.querySelectorAll("[data-maritime-i18n-placeholder]").forEach(function (node) {
      const value = copy[node.dataset.maritimeI18nPlaceholder];
      if (value) node.setAttribute("placeholder", value);
    });
    document.title = copy.pageTitle;
    const description = document.querySelector("[data-maritime-description]");
    if (description) description.setAttribute("content", copy.pageDescription);
    const account = document.querySelector("[data-maritime-mobile-account]");
    if (account) setNodeText(account, account.dataset.maritimeAuthenticated === "true" ? copy.myAccount : copy.signIn);
    localizeLanguageControl(language, copy);
    applyFooterLanguage(copy);
  }

  let accountRevision = 0;
  let accountTimer = null;
  let accountSubscription = null;
  let signInHref = "";

  function renderAccountState(user) {
    const authenticated = Boolean(user && user.id);
    const navigation = document.querySelector("[data-maritime-auth-nav]");
    if (navigation) navigation.hidden = !authenticated;
    const link = document.querySelector("[data-maritime-mobile-account]");
    if (link) {
      if (!signInHref) signInHref = link.getAttribute("href");
      link.href = authenticated ? "../account/user-panel.html" : signInHref;
      link.dataset.maritimeAuthenticated = String(authenticated);
    }
    applyMaritimeLanguage();
  }

  function resetAccountState() {
    accountRevision += 1;
    window.clearTimeout(accountTimer);
    renderAccountState(null);
  }

  async function updateAccountLink() {
    const revision = ++accountRevision;
    try {
      const auth = window.Allona && window.Allona.supabase && window.Allona.supabase.auth;
      // A cached profile alone must not reveal the signed-in navigation.
      const result = auth ? await auth.getUser() : null;
      if (revision !== accountRevision) return;
      renderAccountState(result && !result.error && result.data ? result.data.user : null);
    } catch (error) {
      if (revision === accountRevision) renderAccountState(null);
    }
  }

  function watchAccountState() {
    if (!signInHref) renderAccountState(null);
    const auth = window.Allona && window.Allona.supabase && window.Allona.supabase.auth;
    if (!accountSubscription && auth && auth.onAuthStateChange) {
      const listener = auth.onAuthStateChange(function (event, session) {
        if (event === "SIGNED_OUT" || event === "USER_DELETED" || !session || !session.user) {
          resetAccountState();
          return;
        }
        accountRevision += 1;
        window.clearTimeout(accountTimer);
        // Run outside the Supabase auth callback to avoid its session lock.
        accountTimer = window.setTimeout(updateAccountLink, 0);
      });
      accountSubscription = listener.data.subscription;
    }
    updateAccountLink();
  }

  function setupSearch() {
    const form = document.querySelector("[data-maritime-mobile-search]");
    if (!form || form.dataset.maritimeSearchReady === "true") return;
    form.dataset.maritimeSearchReady = "true";
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const query = String(new FormData(form).get("q") || "").trim();
      window.location.href = `maritime-jobs.html?q=${encodeURIComponent(query)}`;
    });
  }

  function logoMarkup(label, source, extraClass) {
    return `<span class="mobile-payment-logo ${extraClass || ""}" role="listitem" aria-label="${label}"><img src="${source}" alt="${label}"></span>`;
  }

  function enhanceFooter() {
    if (!mobileOnly()) return false;
    const strip = document.querySelector(".site-footer .footer-payment-strip");
    if (!strip) return false;
    const storeButtons = document.querySelector(".site-footer .store-buttons");
    if (storeButtons) storeButtons.hidden = true;
    if (strip.dataset.mobileLogosReady !== "true") {
      strip.dataset.mobileLogosReady = "true";
      strip.setAttribute("role", "list");
      strip.innerHTML = [
        logoMarkup("TROY", "https://www.troyodeme.com/upload/cmspagefile/image/anasayfa/TROY-Logo-Tagline.png", "mobile-payment-logo--troy"),
        logoMarkup("Visa", "https://cdn.simpleicons.org/visa/1434CB"),
        logoMarkup("Mastercard", "https://cdn.simpleicons.org/mastercard/EB001B"),
        logoMarkup("American Express", "https://cdn.simpleicons.org/americanexpress/006FCF"),
        logoMarkup("PayPal", "https://cdn.simpleicons.org/paypal/003087"),
        logoMarkup("Google Pay", "https://cdn.simpleicons.org/googlepay/3C4043"),
        logoMarkup("Apple Pay", "https://cdn.simpleicons.org/applepay/000000")
      ].join("");
    }
    applyMaritimeLanguage();
    return true;
  }

  function watchMountedUi() {
    if (enhanceFooter() && localizeLanguageControl(currentLanguage(), translations[currentLanguage()])) return;
    const observer = new MutationObserver(function () {
      const footerReady = enhanceFooter();
      const controlsReady = localizeLanguageControl(currentLanguage(), translations[currentLanguage()]);
      if (footerReady && controlsReady) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(function () {
      observer.disconnect();
      applyMaritimeLanguage();
    }, 10000);
  }

  document.addEventListener("DOMContentLoaded", function () {
    setupSearch();
    applyMaritimeLanguage();
    watchAccountState();
    watchMountedUi();
  });
  window.addEventListener("pagehide", function () {
    resetAccountState();
    if (accountSubscription) accountSubscription.unsubscribe();
    accountSubscription = null;
  });
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) watchAccountState();
  });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") updateAccountLink();
  });
  document.addEventListener("allona:language-changed", applyMaritimeLanguage);
  document.addEventListener("allona:layout-ready", applyMaritimeLanguage);
  document.addEventListener("click", function (event) {
    const option = event.target.closest(".mobile-maritime__control-slot [data-language-option]");
    if (option) applyMaritimeLanguage({ detail: { language: option.dataset.languageOption } });
  });
})();
