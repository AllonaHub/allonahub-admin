(function () {
  "use strict";

  const App = window.Allona = window.Allona || {};
  const languageCodes = ["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"];
  const localeCodes = { tr: "tr-TR", az: "az-AZ", kk: "kk-KZ", uz: "uz-UZ", ky: "ky-KG", en: "en-GB", de: "de-DE", ru: "ru-RU", ar: "ar-SA" };
  const view = document.body && document.body.dataset.maritimeView || "jobs";
  const root = document.querySelector("[data-portal-root]");
  let session = null;
  let jobs = [];
  let activeFilter = "all";
  let activeTopic = "fraud";
  let renderedLanguage = "";
  let accountProfile = null;
  let profileClient = null;
  const maritimeBasePath = "/pages/ecosystem/";

  function portalUrl(file) {
    const path = `${maritimeBasePath}${String(file || "").replace(/^\/+/, "")}`;
    return App.core && App.core.url ? App.core.url(path) : path;
  }

  const copyRows = {
    moduleName: ["Denizcilik", "Dənizçilik", "Теңіз ісі", "Dengizchilik", "Деңизчилик", "Maritime", "Seefahrt", "Морское дело", "الملاحة البحرية"],
    searchPlaceholder: ["Pozisyon veya sertifika ara", "Vəzifə və ya sertifikat axtar", "Лауазым немесе сертификат іздеу", "Lavozim yoki sertifikatni qidiring", "Кызмат ордун же сертификатты издеңиз", "Search position or certificate", "Position oder Zertifikat suchen", "Должность или сертификат", "ابحث عن وظيفة أو شهادة"],
    searchLabel: ["Denizcilik iş ilanı ara", "Dənizçilik iş elanı axtar", "Теңіздегі жұмысты іздеу", "Dengizchilik ishini qidirish", "Деңиздеги жумушту издөө", "Search maritime jobs", "Maritime Stellen suchen", "Поиск морских вакансий", "البحث عن وظائف بحرية"],
    search: ["Ara", "Axtar", "Іздеу", "Qidirish", "Издөө", "Search", "Suchen", "Найти", "بحث"],
    back: ["Geri Dön", "Geri qayıt", "Артқа", "Orqaga", "Артка", "Back", "Zurück", "Назад", "رجوع"],
    home: ["Ana Sayfa", "Ana səhifə", "Басты бет", "Bosh sahifa", "Башкы бет", "Home", "Startseite", "Главная", "الصفحة الرئيسية"],
    moduleReturn: ["Modüle Dön", "Modula qayıt", "Модульге оралу", "Modulga qaytish", "Модулга кайтуу", "Back to Module", "Zum Modul", "В модуль", "العودة إلى الوحدة"],
    signIn: ["Giriş Yap", "Daxil ol", "Кіру", "Kirish", "Кирүү", "Sign In", "Anmelden", "Войти", "تسجيل الدخول"],
    myAccount: ["Kişisel Hesabım", "Şəxsi hesabım", "Жеке аккаунтым", "Shaxsiy hisobim", "Жеке аккаунтум", "My Personal Account", "Mein persönliches Konto", "Мой личный аккаунт", "حسابي الشخصي"],
    companyPanel: ["Şirket Paneli", "Şirkət paneli", "Компания панелі", "Kompaniya paneli", "Компания панели", "Company Panel", "Unternehmensbereich", "Панель компании", "لوحة الشركة"],
    workspaceNav: ["Denizcilik çalışma alanı", "Dənizçilik iş sahəsi", "Теңіз жұмысы кеңістігі", "Dengizchilik ish maydoni", "Деңизчилик иш мейкиндиги", "Maritime workspace", "Maritimer Arbeitsbereich", "Рабочая зона моряка", "مساحة العمل البحرية"],
    uploadDocumentsNav: ["Belgelerim", "Sənədlərim", "Құжаттарым", "Hujjatlarim", "Документтерим", "My Documents", "Meine Dokumente", "Мои документы", "مستنداتي"],
    smartAccountNav: ["GP CV", "GP CV", "GP CV", "GP CV", "GP CV", "GP CV", "GP CV", "GP CV", "GP CV"],
    jobsNav: ["İş İlanları", "İş elanları", "Жұмыс орындары", "Ish eʼlonlari", "Жумуш жарыялары", "Job Listings", "Stellenangebote", "Вакансии", "الوظائف"],
    applicationsNav: ["Başvurularım", "Müraciətlərim", "Өтінімдерім", "Arizalarim", "Арыздарым", "My Applications", "Meine Bewerbungen", "Мои заявки", "طلباتي"],
    offersNav: ["İş Tekliflerim", "İş təkliflərim", "Жұмыс ұсыныстарым", "Ish takliflarim", "Жумуш сунуштарым", "Job Offers", "Jobangebote", "Предложения работы", "عروض العمل"],
    autoNav: ["Otomatik Başvuru", "Avtomatik müraciət", "Автоматты өтінім", "Avtomatik ariza", "Автоматтык арыз", "Auto Apply", "Automatische Bewerbung", "Автоподача", "التقديم التلقائي"],
    complaintsNav: ["Şikayet", "Şikayət", "Шағым", "Shikoyat", "Даттануу", "Complaint", "Beschwerde", "Жалоба", "شكوى"],

    jobsTitle: ["Açık Denizcilik Pozisyonları", "Açıq dənizçilik vəzifələri", "Ашық теңіз лауазымдары", "Ochiq dengizchilik lavozimlari", "Ачык деңизчилик кызматтары", "Open Maritime Positions", "Offene maritime Stellen", "Открытые морские вакансии", "الوظائف البحرية المتاحة"],
    jobsLead: ["Doğrulanmış firmaların açık pozisyonlarını inceleyin ve uygun ilanlara güvenle başvurun.", "Təsdiqlənmiş şirkətlərin açıq vəzifələrinə baxın və uyğun elanlara təhlükəsiz müraciət edin.", "Расталған компаниялардың бос орындарын қарап, сәйкес жұмысқа қауіпсіз өтінім беріңіз.", "Tasdiqlangan kompaniyalarning ochiq lavozimlarini ko‘ring va mos ishga xavfsiz ariza bering.", "Текшерилген компаниялардын ачык кызматтарын көрүп, ылайыктуу жумушка коопсуз арыз бериңиз.", "Review open positions from verified companies and apply safely to suitable jobs.", "Prüfen Sie offene Stellen verifizierter Unternehmen und bewerben Sie sich sicher.", "Просматривайте вакансии проверенных компаний и безопасно откликайтесь.", "استعرض الوظائف المتاحة لدى الشركات الموثقة وقدّم بأمان للوظائف المناسبة."],
    applicationsTitle: ["Başvurularım", "Müraciətlərim", "Өтінімдерім", "Arizalarim", "Арыздарым", "My Applications", "Meine Bewerbungen", "Мои заявки", "طلباتي"],
    applicationsLead: ["Başvurduğunuz ilanları ve güncel değerlendirme durumlarını tek ekrandan takip edin.", "Müraciət etdiyiniz elanları və cari qiymətləndirmə vəziyyətini bir ekrandan izləyin.", "Өтінім берген орындар мен олардың күйін бір экраннан бақылаңыз.", "Ariza bergan ishlaringiz va ularning holatini bitta ekranda kuzating.", "Арыз берген жумуштарды жана алардын абалын бир экрандан көзөмөлдөңүз.", "Track every application and its current review status from one screen.", "Verfolgen Sie alle Bewerbungen und ihren aktuellen Status auf einem Bildschirm.", "Отслеживайте все заявки и их текущий статус на одном экране.", "تابع جميع الوظائف التي تقدمت إليها وحالة المراجعة من شاشة واحدة."],
    offersTitle: ["Gelen İş Tekliflerim", "Gələn iş təkliflərim", "Келген жұмыс ұсыныстарым", "Kelgan ish takliflarim", "Келген жумуш сунуштарым", "My Incoming Job Offers", "Meine eingegangenen Jobangebote", "Мои предложения работы", "عروض العمل الواردة"],
    offersLead: ["Uygun bulunduğunuz pozisyonlar için gönderilen teklifleri ve izinli firma iletişim bilgilerini görüntüleyin.", "Uyğun görüldüyünüz vəzifələr üçün göndərilən təklifləri və icazəli şirkət əlaqə məlumatlarını görün.", "Сізге сай орындар бойынша ұсыныстарды және рұқсат етілген компания байланысын көріңіз.", "Mos topilgan lavozimlar bo‘yicha takliflar va ruxsat etilgan kompaniya aloqalarini ko‘ring.", "Сизге ылайыктуу кызматтар боюнча сунуштарды жана уруксат берилген компания байланышын көрүңүз.", "View offers for matched positions and company contact details only when permission is granted.", "Sehen Sie Angebote für passende Stellen und freigegebene Unternehmenskontakte.", "Просматривайте предложения по подходящим вакансиям и разрешенные контакты компаний.", "اعرض العروض للوظائف المناسبة وبيانات اتصال الشركة عند السماح بذلك."],
    autoTitle: ["Otomatik Başvuru", "Avtomatik müraciət", "Автоматты өтінім", "Avtomatik ariza", "Автоматтык арыз", "Auto Apply", "Automatische Bewerbung", "Автоподача", "التقديم التلقائي"],
    autoLead: ["Profiliniz tamamlandığında uygun denizcilik işlerini sizin için sürekli takip eden akıllı başvuru alanı.", "Profiliniz tamamlandıqda uyğun dənizçilik işlərini davamlı izləyən ağıllı müraciət sahəsi.", "Профиль аяқталғанда лайықты теңіз жұмыстарын үздіксіз бақылайтын ақылды өтінім аймағы.", "Profilingiz tayyor bo‘lganda mos dengiz ishlarini doimiy kuzatadigan aqlli ariza maydoni.", "Профилиңиз даяр болгондо ылайыктуу деңиз жумуштарын туруктуу көзөмөлдөгөн акылдуу арыз аймагы.", "A smart application area that continuously monitors suitable maritime jobs after your profile is complete.", "Ein intelligenter Bereich, der nach Abschluss Ihres Profils passende maritime Stellen überwacht.", "Умный раздел, который постоянно отслеживает подходящие морские вакансии после заполнения профиля.", "مساحة ذكية تتابع الوظائف البحرية المناسبة باستمرار بعد اكتمال ملفك."],
    complaintsTitle: ["Denizcilik Şikayet ve Öneri Merkezi", "Dənizçilik şikayət və təklif mərkəzi", "Теңіз шағымдары мен ұсыныстары", "Dengizchilik shikoyat va taklif markazi", "Деңизчилик даттануу жана сунуш борбору", "Maritime Complaints and Suggestions", "Maritime Beschwerden und Vorschläge", "Морские жалобы и предложения", "مركز الشكاوى والاقتراحات البحرية"],
    complaintsLead: ["Dolandırıcılık ihbarı, ITF bildirimi, hukuki destek talebi veya geliştirme önerinizi doğru ekibe iletin.", "Dələduzluq ihbarı, ITF müraciəti, hüquqi dəstək tələbi və ya inkişaf təklifinizi doğru komandaya göndərin.", "Алаяқтық туралы хабарды, ITF өтінімін, заң көмегін немесе ұсынысты тиісті топқа жіберіңіз.", "Firibgarlik xabari, ITF murojaati, huquqiy yordam yoki taklifingizni tegishli jamoaga yuboring.", "Алдамчылык кабарын, ITF арызын, укуктук жардамды же сунушту тиешелүү топко жөнөтүңүз.", "Send a fraud report, ITF request, legal support request, or improvement suggestion to the right team.", "Senden Sie Betrugsmeldungen, ITF-Anliegen, Rechtsanfragen oder Vorschläge an das zuständige Team.", "Направьте сообщение о мошенничестве, обращение ITF, запрос юрпомощи или предложение нужной команде.", "أرسل بلاغ الاحتيال أو طلب ITF أو الدعم القانوني أو اقتراح التطوير إلى الفريق المختص."],
    accountTitle: ["Denizcilik Hesabım", "Dənizçilik hesabım", "Теңіз аккаунтым", "Dengizchilik hisobim", "Деңизчилик аккаунтум", "My Maritime Account", "Mein Seefahrtkonto", "Мой морской аккаунт", "حسابي البحري"],
    accountLead: ["Profilinizi ve denizcilik iş süreçlerinizi sade bir ekrandan yönetin.", "Profilinizi və dənizçilik iş proseslərinizi sadə bir ekrandan idarə edin.", "Профиль мен теңіздегі жұмыс үдерістерін қарапайым бір экраннан басқарыңыз.", "Profil va dengizchilik ish jarayonlarini sodda bir ekrandan boshqaring.", "Профилиңизди жана деңизчилик жумуш процесстерин жөнөкөй бир экрандан башкарыңыз.", "Manage your profile and maritime job activity from one simple screen.", "Verwalten Sie Ihr Profil und Ihre maritimen Bewerbungen auf einer übersichtlichen Seite.", "Управляйте профилем и морскими вакансиями на одном простом экране.", "أدر ملفك ونشاطك الوظيفي البحري من شاشة بسيطة واحدة."],
    documentsTitle: ["Belgelerim ve Global Pasaport", "Sənədlərim və Global Pasport", "Құжаттарым және Global Passport", "Hujjatlarim va Global Passport", "Документтерим жана Global Passport", "My Documents and Global Passport", "Meine Dokumente und Global Passport", "Мои документы и Global Passport", "مستنداتي وجواز السفر العالمي"],
    documentsLead: ["PDF belgelerinizi yükleyin; sistem Global Pasaportunuzu oluştursun, siz kontrol edip onaylayın.", "PDF sənədlərinizi yükləyin; sistem Global Pasportunuzu yaratsın, siz yoxlayıb təsdiqləyin.", "PDF құжаттарыңызды жүктеңіз; жүйе Global Passport профилін жасап, сіз тексеріп растайсыз.", "PDF hujjatlaringizni yuklang; tizim Global Passport profilingizni yaratsin, siz tekshirib tasdiqlang.", "PDF документтериңизди жүктөңүз; система Global Passport профилин түзсүн, сиз текшерип ырастайсыз.", "Upload your PDF documents; the system creates your Global Passport for you to review and confirm.", "Laden Sie Ihre PDF-Dokumente hoch; das System erstellt Ihren Global Passport zur Prüfung und Bestätigung.", "Загрузите PDF-документы; система создаст Global Passport для проверки и подтверждения.", "ارفع مستندات PDF ليُنشئ النظام جواز سفرك العالمي وتراجعه ثم تؤكده."],
    smartAccountTitle: ["Global Pasaport CV", "Global Pasport CV", "Global Passport CV", "Global Passport CV", "Global Passport CV", "Global Passport CV", "Global-Passport-CV", "Global Passport CV", "السيرة الذاتية لجواز السفر العالمي"],
    smartAccountLead: ["GP CV'nizi görüntüleyin; yeni hizmet, sertifika veya referans belgesi ekleyerek Global Pasaportunuzu güncel tutun.", "GP CV-yə baxın; yeni xidmət, sertifikat və ya istinad sənədi əlavə edərək Global Pasportunuzu aktual saxlayın.", "GP CV құжатын көріп, жаңа қызмет, сертификат немесе ұсыным құжатын қосу арқылы Global Passport деректерін жаңартып отырыңыз.", "GP CV-ni ko‘ring; yangi xizmat, sertifikat yoki tavsiya hujjatini qo‘shib Global Passport maʼlumotlarini yangilab boring.", "GP CV-ни көрүп, жаңы кызмат, сертификат же сунуш документин кошуу менен Global Passport маалыматын жаңыртып туруңуз.", "View your GP CV and keep your Global Passport current by adding new service, certificate, or reference documents.", "Zeigen Sie Ihren GP CV an und halten Sie den Global Passport mit neuen Dienstzeit-, Zertifikats- oder Referenznachweisen aktuell.", "Просматривайте GP CV и обновляйте Global Passport, добавляя новые документы о стаже, сертификаты или рекомендации.", "اعرض GP CV وحافظ على تحديث جواز السفر العالمي بإضافة مستندات خدمة أو شهادات أو مراجع جديدة."],
    smartAccountAddDocument: ["Belge Ekle", "Sənəd əlavə et", "Құжат қосу", "Hujjat qo‘shish", "Документ кошуу", "Add Document", "Dokument hinzufügen", "Добавить документ", "إضافة مستند"],
    globalPassportHelpLabel: ["Global Pasaport hakkında bilgi", "Global Pasport haqqında məlumat", "Global Passport туралы ақпарат", "Global Passport haqida maʼlumot", "Global Passport жөнүндө маалымат", "About Global Passport", "Informationen zum Global Passport", "О Global Passport", "حول جواز السفر العالمي"],
    globalPassportHelpTitle: ["Global Pasaport Nedir?", "Global Pasport nədir?", "Global Passport деген не?", "Global Passport nima?", "Global Passport деген эмне?", "What Is Global Passport?", "Was ist der Global Passport?", "Что такое Global Passport?", "ما هو جواز السفر العالمي؟"],
    globalPassportHelpBody: ["Global Pasaport, denizcilik kariyerinizin yaşayan dijital özetidir. Deniz hizmetiniz, yeterlilikleriniz, sertifikalarınız, referanslarınız ve mesleki bilgileriniz tek, düzenli ve sürekli güncellenebilen bir profilde birleşir. Yeni bir kontrat veya belge eklediğinizde sistem bilgileri okur, onayınızdan sonra doğru bölüme işler ve GP CV'nizi günceller. Böylece deneyiminiz şirketler tarafından daha hızlı anlaşılır; doğrulanmış ilanlarla eşleştirme ve başvuru hazırlığı daha isabetli yapılır.", "Global Pasport dənizçilik karyeranızın yaşayan rəqəmsal xülasəsidir. Dəniz xidmətiniz, səriştələriniz, sertifikatlarınız, istinadlarınız və peşəkar məlumatlarınız vahid, nizamlı və daim yenilənə bilən profildə birləşir. Yeni müqavilə və ya sənəd əlavə etdikdə sistem məlumatı oxuyur, təsdiqinizdən sonra düzgün bölməyə yazır və GP CV-ni yeniləyir. Beləliklə təcrübəniz şirkətlər tərəfindən daha tez anlaşılır, təsdiqli elanlarla uyğunlaşdırma və müraciət hazırlığı daha dəqiq aparılır.", "Global Passport – теңіздегі мансабыңыздың үнемі жаңарып отыратын цифрлық қорытындысы. Теңіз қызметі, біліктілік, сертификаттар, ұсынымдар және кәсіби деректер бір реттелген профильде бірігеді. Жаңа келісімшарт немесе құжат қосылғанда жүйе оны оқып, сіз растағаннан кейін тиісті бөлімге енгізеді және GP CV-ді жаңартады. Осылайша компаниялар тәжірибеңізді тез түсініп, тексерілген вакансиялармен сәйкестендіру мен өтінім дайындау дәлірек орындалады.", "Global Passport dengizchilik faoliyatingizning doim yangilanadigan raqamli xulosasidir. Dengiz xizmati, malaka, sertifikatlar, tavsiyalar va kasbiy maʼlumotlar bitta tartibli profilda jamlanadi. Yangi kontrakt yoki hujjat qo‘shilganda tizim uni o‘qiydi, tasdig‘ingizdan so‘ng tegishli bo‘limga kiritadi va GP CV-ni yangilaydi. Shunda kompaniyalar tajribangizni tezroq anglaydi, tasdiqlangan eʼlonlar bilan moslashtirish va ariza tayyorlash aniqroq bo‘ladi.", "Global Passport деңизчилик карьераңыздын дайыма жаңыланып турган санарип жыйынтыгы. Деңиз кызматы, квалификация, сертификаттар, сунуштар жана кесиптик маалыматтар бир иреттүү профилде биригет. Жаңы контракт же документ кошулганда система аны окуп, сиз ырастагандан кийин туура бөлүмгө киргизет жана GP CV-ни жаңыртат. Ошентип компаниялар тажрыйбаңызды тез түшүнүп, текшерилген вакансияларга дал келтирүү жана арыз даярдоо так жүргүзүлөт.", "Global Passport is the living digital record of your maritime career. It brings your sea service, qualifications, certificates, references, and professional details into one organized profile that grows with you. When you add a new contract or document, the system reads it, places approved details in the right section, and refreshes your GP CV. Companies can understand your experience faster, while verified-job matching and application preparation become more precise.", "Der Global Passport ist die fortlaufende digitale Übersicht Ihrer Seefahrtkarriere. Dienstzeiten, Befähigungen, Zertifikate, Referenzen und berufliche Angaben werden in einem geordneten, laufend aktualisierbaren Profil zusammengeführt. Bei einem neuen Vertrag oder Dokument liest das System die Angaben aus, ordnet bestätigte Daten richtig zu und aktualisiert Ihren GP CV. Unternehmen erfassen Ihre Erfahrung schneller; Abgleich mit verifizierten Stellen und Bewerbungsvorbereitung werden präziser.", "Global Passport — это постоянно обновляемая цифровая история вашей морской карьеры. Морской стаж, квалификации, сертификаты, рекомендации и профессиональные сведения объединяются в одном упорядоченном профиле. При добавлении нового контракта или документа система считывает данные, после вашего подтверждения помещает их в нужный раздел и обновляет GP CV. Компаниям проще быстро оценить опыт, а подбор проверенных вакансий и подготовка заявок становятся точнее.", "جواز السفر العالمي هو السجل الرقمي المتجدد لمسيرتك البحرية. يجمع خدمتك البحرية ومؤهلاتك وشهاداتك ومراجعك وبياناتك المهنية في ملف واحد منظم يتطور معك. عند إضافة عقد أو مستند جديد، يقرأ النظام البيانات ويضع المعلومات التي توافق عليها في القسم الصحيح ويحدث GP CV. وبذلك تفهم الشركات خبرتك بسرعة أكبر وتصبح مطابقة الوظائف الموثقة وتجهيز الطلبات أكثر دقة."],
    globalPassportHelpWorldwide: ["Tek bir ülkeye bağlı değildir. Dünyanın her yerindeki denizcilik şirketlerine sunulabilen ve uluslararası iş başvurularında kullanılmak üzere hazırlanmış global bir kariyer pasaportudur.", "Tək bir ölkəyə bağlı deyil. Dünyanın hər yerindəki dənizçilik şirkətlərinə təqdim edilə bilən və beynəlxalq iş müraciətləri üçün hazırlanmış qlobal karyera pasportudur.", "Ол бір елмен шектелмейді. Әлемнің кез келген жеріндегі теңіз компанияларына ұсынуға және халықаралық жұмыс өтінімдерінде пайдалануға арналған жаһандық мансап паспорты.", "U bitta mamlakat bilan cheklanmaydi. Dunyoning istalgan joyidagi dengizchilik kompaniyalariga taqdim etish va xalqaro ish arizalarida foydalanish uchun yaratilgan global karyera pasportidir.", "Ал бир өлкө менен чектелбейт. Дүйнөнүн бардык жериндеги деңизчилик компанияларына көрсөтүүгө жана эл аралык жумуш арыздарында колдонууга арналган глобалдык карьера паспорту.", "It is not tied to one country. It is a global career passport designed for international job applications and presentation to maritime companies anywhere in the world.", "Er ist nicht an ein einzelnes Land gebunden. Als globaler Karrierepass ist er für internationale Bewerbungen und die Vorlage bei Seefahrtunternehmen weltweit konzipiert.", "Он не привязан к одной стране. Это глобальный карьерный паспорт для международных заявок и представления морским компаниям в любой точке мира.", "لا يرتبط بدولة واحدة، بل هو جواز مهني عالمي صُمم لطلبات العمل الدولية ولتقديمه إلى الشركات البحرية في أي مكان في العالم."],
    globalPassportHelpPrivacy: ["Kontrol sizde kalır: yalnız onayladığınız bilgiler kaydedilir ve şirketlerle yalnız izin verdiğiniz kapsamda paylaşılır. Global Pasaport resmî belgelerin yerine geçmez; onları profesyonel ve doğrulanabilir bir kariyer görünümünde bir araya getirir.", "Nəzarət sizdə qalır: yalnız təsdiqlədiyiniz məlumat saxlanılır və şirkətlərlə yalnız icazə verdiyiniz həcmdə paylaşılır. Global Pasport rəsmi sənədləri əvəz etmir; onları peşəkar və yoxlanıla bilən karyera görünüşündə birləşdirir.", "Бақылау өзіңізде: тек растаған деректер сақталып, компанияларға тек рұқсат еткен көлемде беріледі. Global Passport ресми құжаттарды алмастырмайды, оларды кәсіби әрі тексерілетін мансап көрінісіне біріктіреді.", "Nazorat sizda qoladi: faqat tasdiqlagan maʼlumotlaringiz saqlanadi va kompaniyalarga faqat ruxsat bergan doirada ulashiladi. Global Passport rasmiy hujjatlar o‘rnini bosmaydi; ularni professional va tekshiriladigan karyera ko‘rinishida birlashtiradi.", "Көзөмөл сизде калат: сиз ырастаган маалымат гана сакталат жана компанияларга уруксат берген чекте гана бөлүшүлөт. Global Passport расмий документтерди алмаштырбайт; аларды кесипкөй жана текшерилүүчү карьера көрүнүшүнө бириктирет.", "You remain in control: only details you approve are saved and shared with companies within the permission you grant. Global Passport does not replace official documents; it organizes them into a professional, verifiable career view.", "Sie behalten die Kontrolle: Nur bestätigte Angaben werden gespeichert und nur im freigegebenen Umfang geteilt. Der Global Passport ersetzt keine amtlichen Dokumente, sondern bündelt sie in einer professionellen, prüfbaren Karriereübersicht.", "Контроль остается у вас: сохраняются только подтвержденные данные, а компаниям они передаются лишь в разрешенном вами объеме. Global Passport не заменяет официальные документы, а объединяет их в профессиональное и проверяемое представление карьеры.", "تبقى السيطرة بيدك: لا تُحفظ إلا المعلومات التي توافق عليها ولا تُشارك مع الشركات إلا ضمن النطاق الذي تسمح به. لا يحل جواز السفر العالمي محل المستندات الرسمية، بل ينظمها في عرض مهني قابل للتحقق لمسيرتك."],
    globalPassportHelpClose: ["Açıklamayı kapat", "Açıqlamanı bağla", "Түсіндірмені жабу", "Izohni yopish", "Түшүндүрмөнү жабуу", "Close explanation", "Erklärung schließen", "Закрыть описание", "إغلاق الشرح"],
    maritimeAccount: ["Kişisel Denizcilik Profili", "Şəxsi dənizçilik profili", "Жеке теңіз профилі", "Shaxsiy dengizchilik profili", "Жеке деңизчилик профили", "Personal Maritime Profile", "Persönliches Seefahrtprofil", "Личный морской профиль", "ملف بحري شخصي"],
    seafarerStatusLabel: ["Denizci durumu", "Dənizçi statusu", "Теңізші мәртебесі", "Dengizchi holati", "Деңизчи абалы", "Seafarer status", "Seefahrerstatus", "Статус моряка", "حالة البحار"],
    seafarerStatusApproved: ["Belgelere göre denizci profili onaylandı", "Sənədlərə əsasən dənizçi profili təsdiqləndi", "Құжаттар бойынша теңізші профилі расталды", "Hujjatlarga ko‘ra dengizchi profili tasdiqlandi", "Документтер боюнча деңизчи профили ырасталды", "Seafarer profile approved from documents", "Seefahrerprofil anhand der Dokumente bestätigt", "Профиль моряка подтверждён по документам", "تم اعتماد ملف البحار بناءً على المستندات"],
    seafarerStatusReview: ["Belge incelemesi gerekiyor", "Sənəd yoxlaması tələb olunur", "Құжаттарды тексеру қажет", "Hujjatlarni tekshirish kerak", "Документтерди текшерүү керек", "Document review required", "Dokumentenprüfung erforderlich", "Требуется проверка документов", "مراجعة المستندات مطلوبة"],
    seafarerStatusEvidence: ["Denizcilik belgesi tamamlanmalı", "Dənizçilik sənədi tamamlanmalıdır", "Теңіз құжатын толықтыру қажет", "Dengizchilik hujjatini to‘ldirish kerak", "Деңизчилик документин толуктоо керек", "Maritime evidence required", "Maritimer Nachweis erforderlich", "Требуется морской документ", "يلزم استكمال مستند بحري"],
    seafarerStatusPending: ["Belge doğrulaması bekleniyor", "Sənəd təsdiqi gözlənilir", "Құжатты растау күтілуде", "Hujjat tasdig‘i kutilmoqda", "Документти ырастоо күтүлүүдө", "Document confirmation pending", "Dokumentenbestätigung ausstehend", "Ожидается подтверждение документов", "بانتظار تأكيد المستندات"],
    seafarerStatusNote: ["Bu durum, sizin kontrol edip onayladığınız belge içeriklerinin sistem incelemesine dayanır. Düzenleyen kurumun resmî teyidi gerektiğinde ayrıca yapılır.", "Bu status yoxlayıb təsdiqlədiyiniz sənəd məzmununun sistem analizinə əsaslanır. Sənədi verən qurumun rəsmi təsdiqi lazım olduqda ayrıca aparılır.", "Бұл мәртебе сіз тексеріп растаған құжат мазмұнын жүйелік талдауға негізделеді. Құжатты берген мекеменің ресми растауы қажет болса, бөлек жүргізіледі.", "Bu holat siz tekshirgan va tasdiqlagan hujjat mazmunining tizim tahliliga asoslanadi. Hujjatni bergan tashkilotning rasmiy tasdig‘i zarur bo‘lsa, alohida amalga oshiriladi.", "Бул абал сиз текшерип ырастаган документтин мазмунун системалык талдоого негизделет. Документти берген мекеменин расмий ырастоосу керек болсо, өзүнчө жүргүзүлөт.", "This status is based on system analysis of document details you reviewed and confirmed. Official issuer verification is performed separately when required.", "Dieser Status basiert auf der Systemanalyse der von Ihnen geprüften und bestätigten Dokumentangaben. Eine amtliche Prüfung durch den Aussteller erfolgt bei Bedarf separat.", "Этот статус основан на системном анализе данных документов, которые вы проверили и подтвердили. Официальная проверка у выдавшей организации при необходимости проводится отдельно.", "تعتمد هذه الحالة على تحليل النظام لمحتوى المستندات التي راجعتها وأكدتها. ويُجرى التحقق الرسمي من الجهة المصدرة بشكل منفصل عند الحاجة."],
    changePhoto: ["Profil Fotoğrafı Ekle", "Profil şəkli əlavə et", "Профиль суретін қосу", "Profil rasmini qo‘shish", "Профиль сүрөтүн кошуу", "Add Profile Photo", "Profilfoto hinzufügen", "Добавить фото профиля", "إضافة صورة الملف الشخصي"],
    replacePhoto: ["Fotoğrafı Değiştir", "Şəkli dəyişdir", "Суретті өзгерту", "Rasmni o‘zgartirish", "Сүрөттү өзгөртүү", "Change Photo", "Foto ändern", "Изменить фото", "تغيير الصورة"],
    photoHint: ["JPEG, PNG veya WebP. En fazla 2 MB.", "JPEG, PNG və ya WebP. Maksimum 2 MB.", "JPEG, PNG немесе WebP. Ең көбі 2 МБ.", "JPEG, PNG yoki WebP. Eng ko‘pi 2 MB.", "JPEG, PNG же WebP. Эң көп 2 МБ.", "JPEG, PNG, or WebP. Up to 2 MB.", "JPEG, PNG oder WebP. Maximal 2 MB.", "JPEG, PNG или WebP. До 2 МБ.", "JPEG أو PNG أو WebP، بحد أقصى 2 ميجابايت."],
    accountActions: ["Hesap İşlemleri", "Hesab əməliyyatları", "Аккаунт әрекеттері", "Hisob amallari", "Аккаунт аракеттери", "Account Actions", "Kontofunktionen", "Действия аккаунта", "إجراءات الحساب"],
    maritimeCvAction: ["Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "السيرة البحرية"],
    documentsAction: ["Belgelerim", "Sənədlərim", "Құжаттарым", "Hujjatlarim", "Документтерим", "My Documents", "Meine Dokumente", "Мои документы", "مستنداتي"],
    signOut: ["Çıkış Yap", "Çıxış et", "Шығу", "Chiqish", "Чыгуу", "Sign Out", "Abmelden", "Выйти", "تسجيل الخروج"],
    photoSaving: ["Fotoğraf kaydediliyor...", "Şəkil saxlanılır...", "Сурет сақталуда...", "Rasm saqlanmoqda...", "Сүрөт сакталууда...", "Saving photo...", "Foto wird gespeichert...", "Сохранение фото...", "جارٍ حفظ الصورة..."],
    photoSaved: ["Profil fotoğrafınız kaydedildi.", "Profil şəkliniz saxlanıldı.", "Профиль суреті сақталды.", "Profil rasmingiz saqlandi.", "Профиль сүрөтүңүз сакталды.", "Your profile photo was saved.", "Ihr Profilfoto wurde gespeichert.", "Фото профиля сохранено.", "تم حفظ صورة ملفك الشخصي."],
    photoError: ["Fotoğraf kaydedilemedi. Lütfen tekrar deneyin.", "Şəkil saxlanılmadı. Yenidən cəhd edin.", "Сурет сақталмады. Қайталап көріңіз.", "Rasm saqlanmadi. Qayta urinib ko‘ring.", "Сүрөт сакталган жок. Кайра аракет кылыңыз.", "The photo could not be saved. Please try again.", "Das Foto konnte nicht gespeichert werden. Bitte erneut versuchen.", "Не удалось сохранить фото. Повторите попытку.", "تعذر حفظ الصورة. حاول مرة أخرى."],
    photoTypeError: ["JPEG, PNG veya WebP biçiminde bir fotoğraf seçin.", "JPEG, PNG və ya WebP formatında şəkil seçin.", "JPEG, PNG немесе WebP суретін таңдаңыз.", "JPEG, PNG yoki WebP rasmni tanlang.", "JPEG, PNG же WebP сүрөтүн тандаңыз.", "Choose a JPEG, PNG, or WebP photo.", "Wählen Sie ein JPEG-, PNG- oder WebP-Foto.", "Выберите фото JPEG, PNG или WebP.", "اختر صورة بصيغة JPEG أو PNG أو WebP."],
    photoSizeError: ["Fotoğraf en fazla 2 MB olabilir.", "Şəkil maksimum 2 MB ola bilər.", "Сурет 2 МБ-тан аспауы керек.", "Rasm 2 MB dan oshmasligi kerak.", "Сүрөт 2 МБдан ашпашы керек.", "The photo must be 2 MB or smaller.", "Das Foto darf höchstens 2 MB groß sein.", "Размер фото не должен превышать 2 МБ.", "يجب ألا يتجاوز حجم الصورة 2 ميجابايت."],

    openJobs: ["Tüm Açık İş İlanları", "Bütün açıq iş elanları", "Барлық ашық вакансiyalar", "Barcha ochiq ish eʼlonlari", "Бардык ачык жумуштар", "All Open Job Listings", "Alle offenen Stellen", "Все открытые вакансии", "جميع الوظائف المتاحة"],
    openJobsLead: ["Doğrulanmış firmalardan gelen tüm açık pozisyonları inceleyin. Firma kimliği başvurunuz kabul edildiğinde açılır.", "Təsdiqlənmiş şirkətlərdən gələn bütün açıq vəzifələrə baxın. Şirkətin kimliyi müraciətiniz qəbul ediləndə açılır.", "Расталған компаниялардың барлық ашық орындарын қараңыз. Компания атауы өтініміңіз қабылданғанда ашылады.", "Tasdiqlangan kompaniyalarning barcha ochiq lavozimlarini ko‘ring. Kompaniya nomi arizangiz qabul qilinganda ochiladi.", "Текшерилген компаниялардын бардык ачык кызматтарын көрүңүз. Компаниянын аты арызыңыз кабыл алынганда ачылат.", "Review every open position from verified companies. Company identity is revealed after your application is accepted.", "Prüfen Sie alle offenen Stellen verifizierter Unternehmen. Die Unternehmensidentität wird nach Annahme Ihrer Bewerbung sichtbar.", "Просматривайте все вакансии проверенных компаний. Компания раскрывается после принятия вашей заявки.", "استعرض جميع الوظائف المتاحة لدى الشركات الموثقة، وتظهر هوية الشركة بعد قبول طلبك."],
    filterAll: ["Tümü", "Hamısı", "Барлығы", "Barchasi", "Баары", "All", "Alle", "Все", "الكل"],
    filterDeck: ["Güverte", "Göyərtə", "Палуба", "Paluba", "Палуба", "Deck", "Deck", "Палуба", "السطح"],
    filterEngine: ["Makine", "Maşın", "Машина", "Mashina", "Машина", "Engine", "Maschine", "Машинное отделение", "المحركات"],
    filterElectrical: ["Elektrik", "Elektrik", "Электр", "Elektr", "Электр", "Electrical", "Elektro", "Электрика", "الكهرباء"],
    filterHotel: ["Servis", "Xidmət", "Қызмет", "Xizmat", "Кызмат", "Service", "Service", "Сервис", "الخدمات"],
    verifiedCompany: ["Mavi rozetli firma", "Mavi nişanlı şirkət", "Көк белгісі бар компания", "Ko‘k nishonli kompaniya", "Көк белгиси бар компания", "Blue-badge company", "Unternehmen mit blauem Haken", "Компания с синей отметкой", "شركة ذات شارة زرقاء"],
    companyHidden: ["Firma kimliği kabul sonrası açılır", "Şirkət kimliyi qəbuldan sonra açılır", "Компания өтінім қабылданғанда ашылады", "Kompaniya ariza qabul qilinganda ochiladi", "Компания арыз кабыл алынганда ачылат", "Company identity opens after acceptance", "Unternehmensidentität nach Annahme sichtbar", "Компания раскрывается после принятия", "تظهر هوية الشركة بعد القبول"],
    department: ["Departman", "Şöbə", "Бөлім", "Bo‘lim", "Бөлүм", "Department", "Abteilung", "Отдел", "القسم"],
    contract: ["Kontrat", "Müqavilə", "Келісімшарт", "Shartnoma", "Келишим", "Contract", "Vertrag", "Контракт", "العقد"],
    route: ["Sefer", "Səfər", "Бағыт", "Yo‘nalish", "Багыт", "Route", "Fahrtgebiet", "Рейс", "الرحلة"],
    sixMonths: ["6 ay", "6 ay", "6 ай", "6 oy", "6 ай", "6 months", "6 Monate", "6 месяцев", "6 أشهر"],
    globalRoute: ["Global", "Qlobal", "Жаһандық", "Global", "Глобалдык", "Global", "Global", "Международный", "عالمي"],
    europeRoute: ["Avrupa", "Avropa", "Еуропа", "Yevropa", "Европа", "Europe", "Europa", "Европа", "أوروبا"],
    internationalRoute: ["Uluslararası", "Beynəlxalq", "Халықаралық", "Xalqaro", "Эл аралык", "International", "International", "Международный", "دولي"],
    apply: ["Başvur", "Müraciət et", "Өтінім беру", "Ariza berish", "Арыз берүү", "Apply", "Bewerben", "Откликнуться", "تقديم"],
    applied: ["Başvuruldu", "Müraciət edildi", "Өтінім берілді", "Ariza berildi", "Арыз берилди", "Applied", "Beworben", "Заявка отправлена", "تم التقديم"],
    jobSafeSummary: ["Pozisyon doğrulanmış firma havuzunda yayınlanır. Ayrıntılı şirket bilgileri yalnızca kabul edilen başvuruda görünür.", "Vəzifə təsdiqlənmiş şirkət hovuzunda yayımlanır. Ətraflı şirkət məlumatı yalnız qəbul edilən müraciətdə görünür.", "Лауазым расталған компаниялар пулында жарияланады. Толық дерек тек қабылданған өтінімде көрінеді.", "Lavozim tasdiqlangan kompaniyalar tizimida eʼlon qilinadi. Batafsil maʼlumot faqat qabul qilingan arizada ko‘rinadi.", "Кызмат текшерилген компаниялар тизмесинде жарыяланат. Толук маалымат кабыл алынган арызда гана көрүнөт.", "The position is published in the verified company pool. Full company details appear only after acceptance.", "Die Stelle wird im Pool verifizierter Unternehmen veröffentlicht. Details erscheinen erst nach Annahme.", "Вакансия размещена в пуле проверенных компаний. Полные данные видны только после принятия заявки.", "تُنشر الوظيفة ضمن مجموعة الشركات الموثقة، ولا تظهر التفاصيل الكاملة إلا بعد قبول الطلب."],
    noJobsTitle: ["Uygun ilan bulunamadı", "Uyğun elan tapılmadı", "Сәйкес вакансия табылмады", "Mos eʼlon topilmadi", "Ылайыктуу жарыя табылган жок", "No matching listings", "Keine passenden Stellen", "Подходящих вакансий нет", "لا توجد وظائف مطابقة"],
    noJobsLead: ["Aramanızı değiştirin veya tüm pozisyonları yeniden görüntüleyin.", "Axtarışı dəyişin və ya bütün vəzifələri yenidən göstərin.", "Іздеуді өзгертіңіз немесе барлық орынды қайта көрсетіңіз.", "Qidiruvni o‘zgartiring yoki barcha lavozimlarni ko‘ring.", "Издөөнү өзгөртүңүз же бардык кызматтарды көрүңүз.", "Change your search or show all positions again.", "Ändern Sie die Suche oder zeigen Sie alle Stellen.", "Измените поиск или покажите все вакансии.", "غيّر البحث أو اعرض جميع الوظائف من جديد."],
    jobsCount: ["açık ilan", "açıq elan", "ашық орын", "ochiq eʼlon", "ачык жумуш", "open listings", "offene Stellen", "открытых вакансий", "وظائف متاحة"],
    applicationSaved: ["Başvurunuz kaydedildi. Durumunu Başvurularım sayfasından takip edebilirsiniz.", "Müraciətiniz saxlanıldı. Vəziyyəti Müraciətlərim səhifəsindən izləyə bilərsiniz.", "Өтінім сақталды. Күйін Өтінімдерім бетінен бақылай аласыз.", "Arizangiz saqlandi. Holatini Arizalarim sahifasidan kuzating.", "Арызыңыз сакталды. Абалын Арыздарым барагынан көрүңүз.", "Your application was saved. Track it from My Applications.", "Ihre Bewerbung wurde gespeichert. Verfolgen Sie sie unter Meine Bewerbungen.", "Заявка сохранена. Следите за ней в разделе «Мои заявки».", "تم حفظ طلبك. تابعه من صفحة طلباتي."],

    loginRequiredTitle: ["Bu alan için giriş yapın", "Bu sahə üçün daxil olun", "Бұл бөлімге кіру қажет", "Bu bo‘lim uchun kiring", "Бул бөлүм үчүн кириңиз", "Sign in to continue", "Zum Fortfahren anmelden", "Войдите, чтобы продолжить", "سجّل الدخول للمتابعة"],
    loginRequiredLead: ["Kişisel AllonaHub hesabınızla giriş yapın. Ayrı bir denizci hesap türü seçmeniz gerekmez; denizcilik profiliniz yüklediğiniz belgelerden, yalnızca sizin onayınızla oluşturulur.", "Şəxsi AllonaHub hesabınızla daxil olun. Ayrı dənizçi hesab növü seçməyə ehtiyac yoxdur; dənizçilik profiliniz yüklədiyiniz sənədlərdən yalnız təsdiqinizlə yaradılır.", "Жеке AllonaHub аккаунтыңызбен кіріңіз. Теңізшіге арналған бөлек аккаунт түрін таңдаудың қажеті жоқ; теңіз профиліңіз жүктеген құжаттарыңыздан тек сіздің растауыңызбен жасалады.", "Shaxsiy AllonaHub hisobingiz bilan kiring. Alohida dengizchi hisob turini tanlash shart emas; dengizchilik profilingiz yuklagan hujjatlaringizdan faqat tasdig‘ingiz bilan yaratiladi.", "Жеке AllonaHub аккаунтуңуз менен кириңиз. Өзүнчө деңизчи аккаунт түрүн тандоонун кереги жок; деңизчилик профилиңиз жүктөгөн документтериңизден сиздин ырастооңуз менен гана түзүлөт.", "Sign in with your personal AllonaHub account. You do not need to select a separate seafarer account type; your maritime profile is created from your documents only after your approval.", "Melden Sie sich mit Ihrem persönlichen AllonaHub-Konto an. Ein eigener Seefahrer-Kontotyp ist nicht erforderlich; Ihr maritimes Profil wird erst nach Ihrer Bestätigung aus Ihren Dokumenten erstellt.", "Войдите в личный аккаунт AllonaHub. Выбирать отдельный тип аккаунта моряка не нужно; морской профиль создается из загруженных документов только после вашего подтверждения.", "سجّل الدخول بحساب AllonaHub الشخصي. لا تحتاج إلى اختيار نوع حساب منفصل للبحّارة؛ يُنشأ ملفك البحري من مستنداتك بعد موافقتك فقط."],
    loginButton: ["Giriş Yap", "Daxil ol", "Кіру", "Kirish", "Кирүү", "Sign In", "Anmelden", "Войти", "تسجيل الدخول"],
    personalAccountRequiredTitle: ["Kişisel hesapla devam edin", "Şəxsi hesabla davam edin", "Жеке аккаунтпен жалғастырыңыз", "Shaxsiy hisob bilan davom eting", "Жеке аккаунт менен улантыңыз", "Continue with a personal account", "Mit einem persönlichen Konto fortfahren", "Продолжите с личным аккаунтом", "تابع باستخدام حساب شخصي"],
    personalAccountRequiredLead: ["Şu anda bir şirket hesabıyla giriş yaptınız. Belgeler, Global Pasaport, başvurular ve iş teklifleri kişiye özel olduğu için bu alan yalnızca ayrı bir kişisel AllonaHub hesabında açılır.", "Hazırda şirkət hesabı ilə daxil olmusunuz. Sənədlər, Global Pasport, müraciətlər və iş təklifləri şəxsi olduğuna görə bu sahə yalnız ayrıca şəxsi AllonaHub hesabında açılır.", "Қазір компания аккаунтымен кірдіңіз. Құжаттар, Global Passport, өтінімдер мен жұмыс ұсыныстары жеке болғандықтан, бұл бөлім бөлек жеке AllonaHub аккаунтында ғана ашылады.", "Hozir kompaniya hisobi bilan kirgansiz. Hujjatlar, Global Passport, arizalar va ish takliflari shaxsiy bo‘lgani uchun bu bo‘lim faqat alohida shaxsiy AllonaHub hisobida ochiladi.", "Учурда компания аккаунту менен кирдиңиз. Документтер, Global Passport, арыздар жана жумуш сунуштары жеке болгондуктан, бул бөлүм өзүнчө жеке AllonaHub аккаунтунда гана ачылат.", "You are currently signed in with a company account. Documents, Global Passport, applications and job offers are personal, so this area opens only in a separate personal AllonaHub account.", "Sie sind derzeit mit einem Unternehmenskonto angemeldet. Dokumente, Global Passport, Bewerbungen und Jobangebote sind personenbezogen und stehen daher nur in einem separaten persönlichen AllonaHub-Konto zur Verfügung.", "Сейчас вы вошли через аккаунт компании. Документы, Global Passport, заявки и предложения работы являются личными, поэтому этот раздел доступен только в отдельном личном аккаунте AllonaHub.", "أنت مسجّل الدخول حالياً بحساب شركة. ولأن المستندات وجواز السفر العالمي والطلبات وعروض العمل بيانات شخصية، فلا يفتح هذا القسم إلا في حساب AllonaHub شخصي منفصل."],
    personalAccountRule: ["İlk kayıtta denizci seçimi yoktur. Normal kişisel kayıt yeterlidir; mesleki yeterlilikleriniz belgeleriniz okunduktan ve siz onayladıktan sonra belirlenir. Şirket ve kişisel hesap için farklı e-posta adresleri kullanın.", "İlk qeydiyyatda dənizçi seçimi yoxdur. Adi şəxsi qeydiyyat kifayətdir; peşə səriştələriniz sənədlər oxunduqdan və siz təsdiqlədikdən sonra müəyyən edilir. Şirkət və şəxsi hesab üçün fərqli e-poçt ünvanlarından istifadə edin.", "Алғашқы тіркеуде теңізші таңдауы жоқ. Қалыпты жеке тіркеу жеткілікті; кәсіби біліктіліктер құжаттар оқылып, сіз растағаннан кейін анықталады. Компания және жеке аккаунт үшін әртүрлі электрондық пошта мекенжайларын пайдаланыңыз.", "Birinchi ro‘yxatdan o‘tishda dengizchi tanlovi yo‘q. Oddiy shaxsiy ro‘yxatdan o‘tish yetarli; kasbiy malakangiz hujjatlar o‘qilib, siz tasdiqlaganingizdan keyin aniqlanadi. Kompaniya va shaxsiy hisob uchun boshqa-boshqa e-pochta manzillaridan foydalaning.", "Биринчи каттоодо деңизчи тандоосу жок. Кадимки жеке каттоо жетиштүү; кесиптик квалификацияңыз документтер окулуп, сиз ырастагандан кийин аныкталат. Компания жана жеке аккаунт үчүн ар башка электрондук почта даректерин колдонуңуз.", "There is no seafarer selection during registration. A standard personal registration is enough; your professional qualifications are identified after your documents are read and you approve the results. Use different email addresses for company and personal accounts.", "Bei der Registrierung gibt es keine Auswahl „Seefahrer“. Eine normale persönliche Registrierung genügt; Ihre beruflichen Qualifikationen werden nach dem Auslesen Ihrer Dokumente und Ihrer Bestätigung ermittelt. Verwenden Sie für Unternehmens- und persönliches Konto unterschiedliche E-Mail-Adressen.", "При регистрации не нужно выбирать тип «моряк». Достаточно обычного личного аккаунта; профессиональная квалификация определяется после чтения документов и вашего подтверждения. Для аккаунта компании и личного аккаунта используйте разные адреса электронной почты.", "لا يوجد اختيار «بحّار» عند التسجيل. يكفي إنشاء حساب شخصي عادي؛ وتُحدَّد مؤهلاتك المهنية بعد قراءة مستنداتك وموافقتك على النتائج. استخدم بريداً إلكترونياً مختلفاً لحساب الشركة والحساب الشخصي."],
    switchToPersonalAccount: ["Kişisel Hesapla Giriş Yap", "Şəxsi hesabla daxil ol", "Жеке аккаунтпен кіру", "Shaxsiy hisob bilan kirish", "Жеке аккаунт менен кирүү", "Sign In with Personal Account", "Mit persönlichem Konto anmelden", "Войти в личный аккаунт", "تسجيل الدخول بحساب شخصي"],
    createPersonalAccount: ["Yeni Kişisel Hesap Oluştur", "Yeni şəxsi hesab yarat", "Жаңа жеке аккаунт ашу", "Yangi shaxsiy hisob yaratish", "Жаңы жеке аккаунт түзүү", "Create Personal Account", "Persönliches Konto erstellen", "Создать личный аккаунт", "إنشاء حساب شخصي"],
    noApplicationsTitle: ["Henüz başvurunuz yok", "Hələ müraciətiniz yoxdur", "Әзірге өтінім жоқ", "Hozircha ariza yo‘q", "Азырынча арыз жок", "No applications yet", "Noch keine Bewerbungen", "Заявок пока нет", "لا توجد طلبات بعد"],
    noApplicationsLead: ["Açık iş ilanlarından bir pozisyon seçtiğinizde başvurunuz ve durumu burada görünür.", "Açıq iş elanından vəzifə seçəndə müraciət və vəziyyəti burada görünəcək.", "Ашық орынға өтінім бергенде оның күйі осында көрінеді.", "Ochiq ishga ariza berganingizda holati shu yerda ko‘rinadi.", "Ачык жумушка арыз бергениңизде абалы ушул жерде көрүнөт.", "When you apply to an open position, the application and status appear here.", "Wenn Sie sich bewerben, erscheinen Bewerbung und Status hier.", "После отклика заявка и ее статус появятся здесь.", "عند التقديم لوظيفة ستظهر الطلب وحالته هنا."],
    browseJobs: ["İş İlanlarını İncele", "İş elanlarına bax", "Вакансияларды көру", "Ish eʼlonlarini ko‘rish", "Жумуштарды көрүү", "Browse Job Listings", "Stellen ansehen", "Смотреть вакансии", "استعراض الوظائف"],
    applicationFor: ["Bu ilan için başvuruldu", "Bu elan üçün müraciət edildi", "Осы орынға өтінім берілді", "Bu eʼlon uchun ariza berildi", "Бул жарыяга арыз берилди", "Applied to this listing", "Für diese Stelle beworben", "Заявка на эту вакансию", "تم التقديم لهذه الوظيفة"],
    appliedAt: ["Başvuru tarihi", "Müraciət tarixi", "Өтінім күні", "Ariza sanasi", "Арыз күнү", "Application date", "Bewerbungsdatum", "Дата заявки", "تاريخ التقديم"],
    statusLabel: ["Durum", "Vəziyyət", "Күй", "Holat", "Абал", "Status", "Status", "Статус", "الحالة"],
    statusSubmitted: ["Başvuruldu", "Müraciət edildi", "Өтінім берілді", "Ariza berildi", "Арыз берилди", "Submitted", "Eingereicht", "Подано", "تم التقديم"],
    statusReview: ["İncelemede", "İcmaldadır", "Қаралуда", "Ko‘rib chiqilmoqda", "Каралууда", "Under Review", "In Prüfung", "На рассмотрении", "قيد المراجعة"],
    statusShortlist: ["Kısa listede", "Qısa siyahıda", "Қысқа тізімде", "Qisqa ro‘yxatda", "Кыска тизмеде", "Shortlisted", "Vorausgewählt", "В коротком списке", "ضمن القائمة المختصرة"],
    statusAccepted: ["Kabul edildi", "Qəbul edildi", "Қабылданды", "Qabul qilindi", "Кабыл алынды", "Accepted", "Angenommen", "Принято", "تم القبول"],
    totalApplications: ["Toplam Başvuru", "Ümumi müraciət", "Барлық өтінім", "Jami ariza", "Жалпы арыз", "Total Applications", "Bewerbungen gesamt", "Всего заявок", "إجمالي الطلبات"],
    reviewing: ["Değerlendirilen", "Qiymətləndirilən", "Қаралуда", "Ko‘rib chiqilayotgan", "Каралып жаткан", "In Review", "In Prüfung", "На рассмотрении", "قيد التقييم"],
    accepted: ["Kabul Edilen", "Qəbul edilən", "Қабылданған", "Qabul qilingan", "Кабыл алынган", "Accepted", "Angenommen", "Принято", "مقبولة"],

    noOffersTitle: ["Henüz iş teklifi yok", "Hələ iş təklifi yoxdur", "Әзірге ұсыныс жоқ", "Hozircha ish taklifi yo‘q", "Азырынча жумуш сунушу жок", "No job offers yet", "Noch keine Jobangebote", "Предложений пока нет", "لا توجد عروض بعد"],
    noOffersLead: ["Bir firma başvurunuzu uygun bulup teklif gönderdiğinde bildirim ve teklif ayrıntıları burada görünür.", "Şirkət müraciətinizi uyğun görüb təklif göndərəndə məlumat burada görünəcək.", "Компания өтінімді мақұлдап ұсыныс жібергенде ол осында көрінеді.", "Kompaniya arizangizni maʼqullab taklif yuborsa, bu yerda ko‘rinadi.", "Компания арызыңызды жактырып сунуш жөнөткөндө бул жерде көрүнөт.", "When a company approves your application and sends an offer, its details appear here.", "Wenn ein Unternehmen Ihre Bewerbung annimmt und ein Angebot sendet, erscheint es hier.", "Когда компания одобрит заявку и отправит предложение, оно появится здесь.", "عندما تقبل شركة طلبك وترسل عرضاً ستظهر التفاصيل هنا."],
    offersPrivacy: ["Firma iletişim bilgileri yalnızca firma paylaşım izni verdiğinde ve teklif aktif olduğunda açılır.", "Şirkət əlaqəsi yalnız paylaşım icazəsi olduqda və təklif aktivkən açılır.", "Компания байланысы тек рұқсат беріліп, ұсыныс белсенді болғанда ашылады.", "Kompaniya aloqasi faqat ruxsat berilgan va taklif faol bo‘lganda ochiladi.", "Компаниянын байланышы уруксат берилгенде жана сунуш активдүү болгондо ачылат.", "Company contact details open only when sharing is permitted and the offer is active.", "Unternehmenskontakte werden nur bei Freigabe und aktivem Angebot sichtbar.", "Контакты компании открываются только при разрешении и активном предложении.", "لا تظهر بيانات اتصال الشركة إلا عند السماح بالمشاركة وكون العرض نشطاً."],
    offerStatus: ["Teklif durumu", "Təklif vəziyyəti", "Ұсыныс күйі", "Taklif holati", "Сунуш абалы", "Offer status", "Angebotsstatus", "Статус предложения", "حالة العرض"],
    offerSent: ["Teklif gönderildi", "Təklif göndərildi", "Ұсыныс жіберілді", "Taklif yuborildi", "Сунуш жөнөтүлдү", "Offer sent", "Angebot gesendet", "Предложение отправлено", "تم إرسال العرض"],
    contactHidden: ["Firma iletişimi henüz paylaşılmadı", "Şirkət əlaqəsi hələ paylaşılmayıb", "Компания байланысы әлі ашылмады", "Kompaniya aloqasi hali ochilmagan", "Компаниянын байланышы ачыла элек", "Company contact is not shared yet", "Unternehmenskontakt noch nicht freigegeben", "Контакты компании пока скрыты", "لم تتم مشاركة بيانات الشركة بعد"],

    autoHeading: ["Siz uyurken bile uygun işlere başvurur", "Siz yatarkən belə uyğun işlərə müraciət edir", "Сіз ұйықтап жатқанда да лайықты жұмысқа өтінім береді", "Siz uxlayotganda ham mos ishlarga ariza beradi", "Сиз уктап жатканда да ылайыктуу жумушка арыз берет", "Applies to suitable jobs even while you sleep", "Bewirbt sich auch im Schlaf auf passende Stellen", "Откликается на подходящие вакансии, пока вы спите", "يتقدم للوظائف المناسبة حتى أثناء نومك"],
    autoDescription: ["Bilgileriniz ve belgeleriniz tamamlandıktan, profiliniz doğrulandıktan ve Maritime CV ile Global Passport hazırlandıktan sonra akıllı platform, siz uyurken bile kriterlerinize uyan tüm açık iş ilanlarını tarar ve verdiğiniz izin kapsamında sizin yerinize otomatik başvuru yapar.", "Məlumat və sənədləriniz tamamlandıqdan, profiliniz təsdiqləndikdən, Maritime CV və Global Passport hazır olduqdan sonra ağıllı platforma siz yatarkən belə meyarlarınıza uyğun bütün açıq işləri yoxlayır və icazəniz çərçivəsində sizin yerinizə müraciət edir.", "Деректер мен құжаттар толық, профиль расталған, Maritime CV және Global Passport дайын болғанда ақылды платформа сіз ұйықтап жатқанда да барлық сәйкес бос орынды қарап, рұқсатыңыз аясында өтінім береді.", "Maʼlumot va hujjatlaringiz to‘liq, profilingiz tasdiqlangan, Maritime CV va Global Passport tayyor bo‘lgach, aqlli platforma siz uxlayotganda ham barcha mos ishlarni topib, ruxsatingiz doirasida ariza beradi.", "Маалымат жана документтер толук, профиль текшерилип, Maritime CV жана Global Passport даяр болгондо акылдуу платформа сиз уктап жатканда да бардык ылайыктуу жумуштарды карап, уруксатыңыздын негизинде арыз берет.", "After your information and documents are complete, your profile is verified, and your Maritime CV and Global Passport are ready, the smart platform scans every matching open job, even while you sleep, and applies on your behalf within your permission.", "Sobald Angaben und Dokumente vollständig, Ihr Profil verifiziert sowie Maritime CV und Global Passport bereit sind, durchsucht die Plattform auch im Schlaf alle passenden Stellen und bewirbt sich mit Ihrer Einwilligung.", "Когда данные и документы заполнены, профиль подтвержден, а Maritime CV и Global Passport готовы, платформа даже во время вашего сна ищет все подходящие вакансии и подает заявки в рамках вашего разрешения.", "بعد اكتمال بياناتك ومستنداتك والتحقق من ملفك وتجهيز Maritime CV وGlobal Passport، تفحص المنصة الذكية جميع الوظائف المناسبة حتى أثناء نومك وتتقدم نيابة عنك ضمن إذنك."],
    profileReady: ["Tamamlanmış Profil", "Tamamlanmış profil", "Толық профиль", "To‘liq profil", "Толук профиль", "Complete Profile", "Vollständiges Profil", "Заполненный профиль", "ملف مكتمل"],
    profileReadyDesc: ["Kimlik, yeterlilik ve iş tercihleri", "Şəxsiyyət, səriştə və iş seçimləri", "Жеке дерек, біліктілік және жұмыс талғамы", "Shaxs, malaka va ish tanlovlari", "Жеке маалымат, квалификация жана жумуш тандоосу", "Identity, qualifications, and job preferences", "Identität, Qualifikationen und Jobwünsche", "Личные данные, квалификация и предпочтения", "الهوية والمؤهلات وتفضيلات العمل"],
    maritimeCv: ["Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV"],
    maritimeCvDesc: ["Onaylı deniz hizmeti ve sertifikalar", "Təsdiqli dəniz xidməti və sertifikatlar", "Расталған теңіз өтілі мен сертификаттар", "Tasdiqlangan dengiz xizmati va sertifikatlar", "Текшерилген деңиз кызматы жана сертификаттар", "Approved sea service and certificates", "Bestätigte Seefahrtzeiten und Zertifikate", "Подтвержденный морской стаж и сертификаты", "الخدمة البحرية والشهادات المعتمدة"],
    globalPassport: ["Global Passport", "Global Passport", "Global Passport", "Global Passport", "Global Passport", "Global Passport", "Global Passport", "Global Passport", "Global Passport"],
    globalPassportDesc: ["Doğrulanmış küresel uygunluk özeti", "Təsdiqlənmiş qlobal uyğunluq xülasəsi", "Расталған жаһандық сәйкестік қорытындысы", "Tasdiqlangan global muvofiqlik xulosasi", "Текшерилген глобалдык шайкештик жыйынтыгы", "Verified global readiness summary", "Verifizierte globale Eignungsübersicht", "Подтвержденный глобальный профиль готовности", "ملخص الجاهزية العالمية الموثق"],
    pendingCheck: ["Kontrol bekleniyor", "Yoxlama gözlənilir", "Тексеру күтілуде", "Tekshiruv kutilmoqda", "Текшерүү күтүлүүдө", "Check pending", "Prüfung ausstehend", "Ожидает проверки", "بانتظار التحقق"],
    autoControlTitle: ["Otomatik başvuru tercihi", "Avtomatik müraciət seçimi", "Автоматты өтінім таңдауы", "Avtomatik ariza tanlovi", "Автоматтык арыз тандоосу", "Auto-apply preference", "Einstellung für automatische Bewerbung", "Настройка автоподачи", "تفضيل التقديم التلقائي"],
    autoControlLead: ["Etkinleştirme tercihiniz kaydedilir. Başvurular yalnız profil ve belge kontrolleri tamamlandığında başlar.", "Seçiminiz saxlanılır. Müraciətlər yalnız profil və sənədlər yoxlandıqdan sonra başlayır.", "Таңдау сақталады. Өтінімдер профиль мен құжат тексерілген соң басталады.", "Tanlov saqlanadi. Arizalar profil va hujjatlar tekshirilgandan keyin boshlanadi.", "Тандоо сакталат. Арыздар профиль жана документтер текшерилгенден кийин башталат.", "Your preference is saved. Applications start only after profile and document checks are complete.", "Ihre Einstellung wird gespeichert. Bewerbungen starten erst nach Profil- und Dokumentenprüfung.", "Настройка сохраняется. Подача начнется только после проверки профиля и документов.", "يتم حفظ تفضيلك، ولا تبدأ الطلبات إلا بعد اكتمال فحص الملف والمستندات."],
    enableAuto: ["Otomatik Başvuruyu Etkinleştir", "Avtomatik müraciəti aktiv et", "Автоматты өтінімді қосу", "Avtomatik arizani yoqish", "Автоматтык арызды иштетүү", "Enable Auto Apply", "Automatische Bewerbung aktivieren", "Включить автоподачу", "تفعيل التقديم التلقائي"],
    disableAuto: ["Otomatik Başvuruyu Durdur", "Avtomatik müraciəti dayandır", "Автоматты өтінімді тоқтату", "Avtomatik arizani to‘xtatish", "Автоматтык арызды токтотуу", "Pause Auto Apply", "Automatische Bewerbung pausieren", "Приостановить автоподачу", "إيقاف التقديم التلقائي"],
    autoSaved: ["Tercihiniz kaydedildi. Profil ve belge kontrolleri tamamlanınca otomatik başvuru başlayacaktır.", "Seçiminiz saxlanıldı. Profil və sənəd yoxlamaları tamamlananda avtomatik müraciət başlayacaq.", "Таңдау сақталды. Профиль мен құжат тексерілген соң автоматты өтінім басталады.", "Tanlov saqlandi. Profil va hujjatlar tekshirilgach avtomatik ariza boshlanadi.", "Тандоо сакталды. Профиль жана документтер текшерилгенден кийин автоматтык арыз башталат.", "Your preference was saved. Auto apply will begin after profile and document checks are complete.", "Ihre Einstellung wurde gespeichert. Der Start erfolgt nach Profil- und Dokumentenprüfung.", "Настройка сохранена. Автоподача начнется после проверки профиля и документов.", "تم حفظ تفضيلك، وسيبدأ التقديم بعد اكتمال فحص الملف والمستندات."],
    autoPaused: ["Otomatik başvuru tercihi durduruldu.", "Avtomatik müraciət seçimi dayandırıldı.", "Автоматты өтінім тоқтатылды.", "Avtomatik ariza to‘xtatildi.", "Автоматтык арыз токтотулду.", "Auto apply was paused.", "Automatische Bewerbung wurde pausiert.", "Автоподача приостановлена.", "تم إيقاف التقديم التلقائي."],
    prepareCv: ["CV ve Belgeleri Tamamla", "CV və sənədləri tamamla", "CV мен құжаттарды толтыру", "CV va hujjatlarni to‘ldirish", "CV жана документтерди толуктоо", "Complete CV and Documents", "CV und Dokumente vervollständigen", "Заполнить CV и документы", "استكمال السيرة والمستندات"],

    complaintOptions: ["Bildirim türünü seçin", "Bildiriş növünü seçin", "Хабар түрін таңдаңыз", "Xabar turini tanlang", "Билдирүү түрүн тандаңыз", "Choose a report type", "Meldungsart auswählen", "Выберите тип обращения", "اختر نوع البلاغ"],
    complaintOptionsLead: ["Seçiminiz formun konusunu ve ilgili destek akışını otomatik hazırlar.", "Seçiminiz formun mövzusunu və dəstək axınını avtomatik hazırlayır.", "Таңдау форма тақырыбы мен қолдау бағытын дайындайды.", "Tanlov forma mavzusi va yordam yo‘nalishini tayyorlaydi.", "Тандоо форманын темасын жана колдоо багытын даярдайт.", "Your choice prepares the form subject and the right support route.", "Ihre Auswahl bereitet Betreff und zuständigen Support vor.", "Выбор настроит тему формы и нужный канал поддержки.", "يجهز اختيارك موضوع النموذج ومسار الدعم المناسب."],
    fraudTitle: ["Dolandırıcılık İhbarı", "Dələduzluq ihbarı", "Алаяқтық туралы хабар", "Firibgarlik xabari", "Алдамчылык тууралуу кабар", "Fraud Report", "Betrugsmeldung", "Сообщить о мошенничестве", "بلاغ احتيال"],
    fraudDesc: ["Ücret isteyen, sahte firma veya şüpheli iş ilanını bildirin.", "Ödəniş istəyən, saxta şirkət və ya şübhəli elanı bildirin.", "Ақша сұраған, жалған компания немесе күмәнді жұмысты хабарлаңыз.", "Pul so‘ragan, soxta kompaniya yoki shubhali ishni bildiring.", "Акча сураган, жасалма компания же шектүү жумушту билдириңиз.", "Report fee requests, fake companies, or suspicious job listings.", "Melden Sie Gebührenforderungen, falsche Firmen oder verdächtige Stellen.", "Сообщите о требовании оплаты, фальшивой компании или подозрительной вакансии.", "أبلغ عن طلب رسوم أو شركة وهمية أو وظيفة مشبوهة."],
    itfTitle: ["ITF Şikayeti Başvurusu", "ITF şikayəti müraciəti", "ITF шағым өтінімі", "ITF shikoyati murojaati", "ITF даттануу арызы", "ITF Complaint Request", "ITF-Beschwerdeanfrage", "Обращение по жалобе ITF", "طلب شكوى ITF"],
    itfDesc: ["ITF kapsamında değerlendirilmesini istediğiniz denizci çalışma sorununu iletin.", "ITF çərçivəsində baxılmasını istədiyiniz dənizçi əmək problemini göndərin.", "ITF аясында қаралуы тиіс теңізші еңбек мәселесін жіберіңіз.", "ITF doirasida ko‘rib chiqilishi kerak bo‘lgan dengizchi mehnat muammosini yuboring.", "ITF алкагында каралышы керек болгон деңизчи эмгек маселесин жөнөтүңүз.", "Send a seafarer employment issue you want reviewed under the ITF scope.", "Senden Sie ein Seearbeitsproblem zur Prüfung im ITF-Kontext.", "Отправьте проблему занятости моряка для рассмотрения в рамках ITF.", "أرسل مشكلة عمل بحّار ترغب في مراجعتها ضمن نطاق ITF."],
    legalTitle: ["Hukuki Destek", "Hüquqi dəstək", "Заң көмегі", "Huquqiy yordam", "Укуктук жардам", "Legal Support", "Rechtliche Unterstützung", "Юридическая помощь", "دعم قانوني"],
    legalDesc: ["Sözleşme, ücret, çalışma koşulu veya hak kaybı için destek isteyin.", "Müqavilə, əmək haqqı, iş şəraiti və ya hüquq itkisi üçün dəstək istəyin.", "Шарт, жалақы, еңбек жағдайы немесе құқық бұзылуы бойынша көмек сұраңыз.", "Shartnoma, ish haqi, mehnat sharoiti yoki huquq buzilishi uchun yordam so‘rang.", "Келишим, айлык, эмгек шарты же укук бузуу боюнча жардам сураңыз.", "Request help with contracts, wages, working conditions, or loss of rights.", "Fordern Sie Hilfe bei Vertrag, Lohn, Arbeitsbedingungen oder Rechtsverlust an.", "Запросите помощь по договору, оплате, условиям труда или нарушению прав.", "اطلب الدعم بشأن العقد أو الأجر أو ظروف العمل أو فقدان الحقوق."],
    suggestionTitle: ["Öneriler", "Təkliflər", "Ұсыныстар", "Takliflar", "Сунуштар", "Suggestions", "Vorschläge", "Предложения", "اقتراحات"],
    suggestionDesc: ["Sitede nelerin olmasını ve hangi alanların geliştirilmesini istediğinizi yazın.", "Saytda nələrin olmasını və hansı sahələrin inkişafını istədiyinizi yazın.", "Сайтта нені көргіңіз келетінін және нені жақсарту керегін жазыңыз.", "Saytda nimalar bo‘lishini va qaysi joylarni rivojlantirishni istashingizni yozing.", "Сайтта эмнелер болушун жана кайсы жерлер өнүктүрүлүшүн каалаарыңызды жазыңыз.", "Tell us what you want on the site and what should be improved.", "Teilen Sie uns mit, was Sie auf der Website wünschen und was verbessert werden soll.", "Расскажите, что вы хотите видеть на сайте и что следует улучшить.", "أخبرنا بما تريد إضافته إلى الموقع وما الذي ينبغي تطويره."],
    formTitle: ["Bildiriminizi gönderin", "Bildirişinizi göndərin", "Хабарды жіберіңіз", "Xabaringizni yuboring", "Билдирүүңүздү жөнөтүңүз", "Send your report", "Meldung senden", "Отправьте обращение", "أرسل بلاغك"],
    formLead: ["Seçtiğiniz konu destek ekibimize e-posta olarak iletilir.", "Seçdiyiniz mövzu dəstək komandamıza e-poçtla göndərilir.", "Таңдалған тақырып қолдау тобына электрондық пошта арқылы жіберіледі.", "Tanlangan mavzu yordam jamoamizga e-pochta orqali yuboriladi.", "Тандалган тема колдоо тобубузга электрондук почта аркылуу жөнөтүлөт.", "The selected topic is emailed to our support team.", "Das ausgewählte Thema wird per E-Mail an unser Support-Team gesendet.", "Выбранная тема будет отправлена нашей поддержке по электронной почте.", "يُرسل الموضوع المختار إلى فريق الدعم عبر البريد الإلكتروني."],
    name: ["Ad Soyad", "Ad Soyad", "Аты-жөні", "Ism familiya", "Аты-жөнү", "Full Name", "Vor- und Nachname", "Имя и фамилия", "الاسم الكامل"],
    email: ["E-posta", "E-poçt", "Электрондық пошта", "E-pochta", "Электрондук почта", "Email", "E-Mail", "Электронная почта", "البريد الإلكتروني"],
    phone: ["Telefon", "Telefon", "Телефон", "Telefon", "Телефон", "Phone", "Telefon", "Телефон", "الهاتف"],
    message: ["Açıklamanız", "Açıqlamanız", "Сипаттамаңыз", "Izohingiz", "Түшүндүрмөңүз", "Your message", "Ihre Nachricht", "Ваше сообщение", "رسالتك"],
    send: ["Gönder", "Göndər", "Жіберу", "Yuborish", "Жөнөтүү", "Send", "Senden", "Отправить", "إرسال"],
    sending: ["Gönderiliyor...", "Göndərilir...", "Жіберілуде...", "Yuborilmoqda...", "Жөнөтүлүүдө...", "Sending...", "Wird gesendet...", "Отправка...", "جارٍ الإرسال..."],
    sent: ["Bildiriminiz destek ekibimize başarıyla gönderildi.", "Bildirişiniz dəstək komandamıza uğurla göndərildi.", "Хабар қолдау тобына сәтті жіберілді.", "Xabaringiz yordam jamoamizga muvaffaqiyatli yuborildi.", "Билдирүүңүз колдоо тобубузга ийгиликтүү жөнөтүлдү.", "Your report was sent successfully to our support team.", "Ihre Meldung wurde erfolgreich an unser Support-Team gesendet.", "Обращение успешно отправлено в службу поддержки.", "تم إرسال بلاغك بنجاح إلى فريق الدعم."],
    sendError: ["Bildirim gönderilemedi. Lütfen tekrar deneyin veya info@allonahub.com adresine yazın.", "Bildiriş göndərilmədi. Yenidən sınayın və ya info@allonahub.com ünvanına yazın.", "Хабар жіберілмеді. Қайталап көріңіз немесе info@allonahub.com мекенжайына жазыңыз.", "Xabar yuborilmadi. Qayta urinib ko‘ring yoki info@allonahub.com manziliga yozing.", "Билдирүү жөнөтүлгөн жок. Кайра аракет кылыңыз же info@allonahub.com дарегине жазыңыз.", "The report could not be sent. Try again or email info@allonahub.com.", "Die Meldung konnte nicht gesendet werden. Versuchen Sie es erneut oder schreiben Sie an info@allonahub.com.", "Не удалось отправить обращение. Повторите попытку или напишите на info@allonahub.com.", "تعذر إرسال البلاغ. حاول مجدداً أو راسل info@allonahub.com."],
    rateLimit: ["Çok fazla gönderim denediniz. Lütfen bir süre sonra tekrar deneyin.", "Çox sayda göndəriş sınadınız. Bir müddət sonra yenidən cəhd edin.", "Тым көп әрекет жасалды. Кейінірек қайталап көріңіз.", "Juda ko‘p urinish bo‘ldi. Keyinroq qayta urinib ko‘ring.", "Өтө көп аракет болду. Кийинчерээк кайра аракет кылыңыз.", "Too many attempts. Please try again later.", "Zu viele Versuche. Bitte versuchen Sie es später erneut.", "Слишком много попыток. Повторите позже.", "محاولات كثيرة جداً. حاول مرة أخرى لاحقاً."],
    requiredFields: ["Zorunlu alanları eksiksiz doldurun.", "Məcburi sahələri tam doldurun.", "Міндетті өрістерді толық толтырыңыз.", "Majburiy maydonlarni to‘liq to‘ldiring.", "Милдеттүү талааларды толук толтуруңуз.", "Complete all required fields.", "Füllen Sie alle Pflichtfelder aus.", "Заполните все обязательные поля.", "أكمل جميع الحقول المطلوبة."],
    formSafety: ["Kimlik belgesi, banka şifresi veya kart bilgisi göndermeyin.", "Şəxsiyyət sənədi, bank şifrəsi və ya kart məlumatı göndərməyin.", "Жеке құжат, банк құпиясөзін немесе карта дерегін жібермеңіз.", "Shaxsiy hujjat, bank paroli yoki karta maʼlumotini yubormang.", "Жеке документ, банк сырсөзү же карта маалыматын жөнөтпөңүз.", "Do not send identity documents, bank passwords, or card details.", "Senden Sie keine Ausweisdokumente, Bankpasswörter oder Kartendaten.", "Не отправляйте документы, банковские пароли или данные карт.", "لا ترسل وثائق الهوية أو كلمات مرور البنك أو بيانات البطاقة."],
    genericPosition: ["Denizcilik pozisyonu", "Dənizçilik vəzifəsi", "Теңіз лауазымы", "Dengizchilik lavozimi", "Деңизчилик кызматы", "Maritime position", "Maritime Stelle", "Морская вакансия", "وظيفة بحرية"]
  };

  const translations = Object.fromEntries(languageCodes.map(function (code, index) {
    return [code, Object.fromEntries(Object.entries(copyRows).map(function (entry) { return [entry[0], entry[1][index]]; }))];
  }));

  const seedJobs = [
    { id: "mar-2e", reference: "AH-MAR-2E", titles: ["2. Mühendis", "2-ci Mühəndis", "2-механик", "2-mexanik", "2-механик", "Second Engineer", "Zweiter Ingenieur", "Второй механик", "المهندس الثاني"], department: "engine", route: "globalRoute" },
    { id: "mar-ab", reference: "AH-MAR-AB", titles: ["Usta Gemici", "Bacarıqlı dənizçi", "Білікті матрос", "Malakali matros", "Квалификациялуу матрос", "Able Seaman", "Vollmatrose", "Квалифицированный матрос", "بحّار ماهر"], department: "deck", route: "europeRoute" },
    { id: "mar-co", reference: "AH-MAR-CO", titles: ["Baş Zabit", "Baş zabit", "Аға көмекші", "Bosh ofitser", "Башкы офицер", "Chief Officer", "Erster Offizier", "Старший помощник", "كبير الضباط"], department: "deck", route: "internationalRoute" },
    { id: "mar-oil", reference: "AH-MAR-OIL", titles: ["Yağcı", "Yağçı", "Моторшы", "Moylovchi", "Моторчу", "Oiler", "Öler", "Моторист", "عامل زيوت"], department: "engine", route: "globalRoute" },
    { id: "mar-eto", reference: "AH-MAR-ETO", titles: ["Elektro Teknik Zabiti", "Elektrotexniki zabit", "Электротехник офицер", "Elektrotexnik ofitser", "Электротехник офицер", "Electro-Technical Officer", "Elektrotechnischer Offizier", "Электромеханик", "ضابط تقني كهربائي"], department: "electrical", route: "internationalRoute" },
    { id: "mar-cook", reference: "AH-MAR-CK", titles: ["Gemi Aşçısı", "Gəmi aşpazı", "Кеме аспазы", "Kema oshpazi", "Кеме ашпозчусу", "Ship's Cook", "Schiffskoch", "Судовой повар", "طاهي السفينة"], department: "hotel", route: "globalRoute" }
  ];

  function language() {
    const stored = String(localStorage.getItem("allona.language") || document.documentElement.lang || "tr").toLowerCase();
    return languageCodes.includes(stored) ? stored : "tr";
  }

  function text(key) {
    return translations[language()][key] || translations.tr[key] || key;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character];
    });
  }

  function compact(value, max) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max || 240);
  }

  function userId() {
    return session && session.user && session.user.id || "";
  }

  function loginUrl(returnPath) {
    const target = returnPath || `${window.location.pathname}${window.location.search}`;
    return `../account/user.html?returnTo=${encodeURIComponent(target)}`;
  }

  function accountSwitchUrl(tab) {
    const params = new URLSearchParams({
      returnTo: `${window.location.pathname}${window.location.search}`,
      forceLogin: "1"
    });
    if (tab) params.set("tab", tab);
    return `../account/user.html?${params.toString()}`;
  }

  function storageKey(type) {
    return `allonahub.maritime.${type}.v1.${userId() || "device"}`;
  }

  function readList(type) {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey(type)) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function writeList(type, rows) {
    localStorage.setItem(storageKey(type), JSON.stringify(rows.slice(0, 100)));
  }

  function dateLabel(value) {
    const date = new Date(value || Date.now());
    if (!Number.isFinite(date.getTime())) return "";
    return new Intl.DateTimeFormat(localeCodes[language()] || "tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  }

  function setStaticTranslations() {
    document.documentElement.lang = language();
    document.documentElement.dir = language() === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-portal-i18n]").forEach(function (node) {
      const value = text(node.dataset.portalI18n);
      if (value) node.textContent = value;
    });
    document.querySelectorAll("[data-portal-i18n-placeholder]").forEach(function (node) {
      const value = text(node.dataset.portalI18nPlaceholder);
      if (value) node.setAttribute("placeholder", value);
    });
    document.querySelectorAll("[data-portal-i18n-aria]").forEach(function (node) {
      const value = text(node.dataset.portalI18nAria);
      if (value) node.setAttribute("aria-label", value);
    });
    document.querySelectorAll("[data-portal-i18n-title]").forEach(function (node) {
      const value = text(node.dataset.portalI18nTitle);
      if (value) node.setAttribute("title", value);
    });
    const pageMap = {
      jobs: ["jobsTitle", "jobsLead"], applications: ["applicationsTitle", "applicationsLead"], offers: ["offersTitle", "offersLead"],
      auto: ["autoTitle", "autoLead"], complaints: ["complaintsTitle", "complaintsLead"], account: ["accountTitle", "accountLead"],
      documents: ["documentsTitle", "documentsLead"], smart: ["smartAccountTitle", "smartAccountLead"]
    };
    const pageCopy = pageMap[view] || pageMap.jobs;
    const title = document.querySelector("[data-portal-title]");
    const lead = document.querySelector("[data-portal-lead]");
    if (title) title.textContent = text(pageCopy[0]);
    if (lead) lead.textContent = text(pageCopy[1]);
    const searchInput = document.querySelector("[data-portal-search] input[name='q']");
    const query = new URLSearchParams(window.location.search).get("q");
    if (searchInput && query && !searchInput.value) searchInput.value = compact(query, 80);
    document.title = `${text(pageCopy[0])} | AllonaHub`;
  }

  function ensureSmartNavigation() {
    document.querySelectorAll(".maritime-portal-nav").forEach(function (nav) {
      if (nav.querySelector('[data-view-link="smart"]')) return;
      const documents = nav.querySelector('[data-view-link="documents"]');
      if (!documents) return;
      const link = document.createElement("a");
      link.className = "maritime-smart-nav";
      link.href = portalUrl("maritime-smart-account.html");
      link.dataset.viewLink = "smart";
      link.dataset.portalI18n = "smartAccountNav";
      link.textContent = text("smartAccountNav");
      documents.insertAdjacentElement("afterend", link);
    });
  }

  async function syncSession() {
    session = App.auth && App.auth.getSession ? await App.auth.getSession() : null;
    const account = document.querySelector("[data-portal-account]");
    if (session) {
      const context = App.auth && App.auth.getAccountContext ? await App.auth.getAccountContext(session.user) : null;
      if (account) {
        const isPartner = context && context.type === "partner";
        account.href = App.auth && App.auth.accountHome ? App.auth.accountHome(context && context.type || "customer", context) : "/pages/account/user-panel.html";
        account.dataset.portalI18n = isPartner ? "companyPanel" : "myAccount";
        account.textContent = text(isPartner ? "companyPanel" : "myAccount");
      }
      return context;
    } else {
      if (account) {
        account.href = loginUrl();
        account.dataset.portalI18n = "signIn";
        account.textContent = text("signIn");
      }
      return null;
    }
  }

  function departmentLabel(code) {
    return text({ deck: "filterDeck", engine: "filterEngine", electrical: "filterElectrical", hotel: "filterHotel" }[code] || "filterAll");
  }

  function normalizedSeedJobs() {
    const index = languageCodes.indexOf(language());
    return seedJobs.map(function (job) {
      return {
        ...job,
        title: job.titles[index] || job.titles[0],
        summary: text("jobSafeSummary"),
        contract: text("sixMonths"),
        location: text(job.route),
        verified: true
      };
    });
  }

  async function loadPublicJobs() {
    const base = String(App.config && App.config.apiBaseUrl || "").replace(/\/$/, "");
    if (!base) return [];
    const controller = new AbortController();
    const timeout = window.setTimeout(function () { controller.abort(); }, 4500);
    try {
      const response = await fetch(`${base}/v1/public/maritime/listings?type=crew_position&limit=48`, { headers: { Accept: "application/json" }, signal: controller.signal });
      if (!response.ok) return [];
      const payload = await response.json();
      if (!payload || payload.ok !== true || !Array.isArray(payload.listings)) return [];
      return payload.listings.filter(function (item) {
        const published = Date.parse(item.published_at);
        const expires = item.expires_at ? Date.parse(item.expires_at) : null;
        return item && item.module_key === "maritime" && item.listing_type === "crew_position" && item.status === "active"
          && Number.isFinite(published) && published <= Date.now() && (expires === null || Number.isFinite(expires) && expires > Date.now());
      }).map(function (item) {
        return {
          id: item.id,
          reference: `AH-${String(item.id).slice(0, 8).toUpperCase()}`,
          title: compact(item.title, 140),
          summary: compact(item.summary, 360),
          location: compact(item.location_label, 120) || text("globalRoute"),
          contract: compact(item.detail_label, 120) || text("sixMonths"),
          department: "all",
          verified: true,
          live: true
        };
      }).filter(function (item) { return item.title && item.summary; });
    } catch (error) {
      return [];
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function applicationRows() {
    return readList("applications");
  }

  function isApplied(jobId) {
    return applicationRows().some(function (item) { return item.job_id === jobId && item.status !== "withdrawn"; });
  }

  function jobCard(job) {
    const applied = isApplied(job.id);
    return `<article class="maritime-job-card" data-job-id="${escapeHtml(job.id)}" data-department="${escapeHtml(job.department)}">
      <div class="maritime-job-head"><div class="maritime-job-title"><span class="maritime-reference">${escapeHtml(job.reference)}</span><h3>${escapeHtml(job.title)}</h3></div><span class="maritime-verified-badge"><i class="fa-solid fa-circle-check" aria-hidden="true"></i>${escapeHtml(text("verifiedCompany"))}</span></div>
      <p class="maritime-job-description">${escapeHtml(job.summary)}</p>
      <div class="maritime-job-meta"><span><b>${escapeHtml(text("department"))}</b>${escapeHtml(departmentLabel(job.department))}</span><span><b>${escapeHtml(text("contract"))}</b>${escapeHtml(job.contract)}</span><span><b>${escapeHtml(text("route"))}</b>${escapeHtml(job.location)}</span></div>
      <div class="maritime-job-actions"><span class="maritime-reference">${escapeHtml(text("companyHidden"))}</span><button class="maritime-button maritime-button--primary" type="button" data-apply-job="${escapeHtml(job.id)}" ${applied ? "disabled" : ""}><i class="fa-solid ${applied ? "fa-check" : "fa-paper-plane"}" aria-hidden="true"></i>${escapeHtml(text(applied ? "applied" : "apply"))}</button></div>
    </article>`;
  }

  function renderJobResults() {
    const grid = document.querySelector("[data-jobs-grid]");
    if (!grid) return;
    const query = compact(new URLSearchParams(window.location.search).get("q"), 80).toLocaleLowerCase(localeCodes[language()] || "tr-TR");
    const filtered = jobs.filter(function (job) {
      const departmentMatch = activeFilter === "all" || job.department === activeFilter || job.department === "all";
      const searchMatch = !query || `${job.title} ${job.summary} ${job.location} ${departmentLabel(job.department)}`.toLocaleLowerCase(localeCodes[language()] || "tr-TR").includes(query);
      return departmentMatch && searchMatch;
    });
    const count = document.querySelector("[data-jobs-count]");
    if (count) count.textContent = `${filtered.length} ${text("jobsCount")}`;
    grid.innerHTML = filtered.length ? filtered.map(jobCard).join("") : `<div class="maritime-empty" style="grid-column:1/-1"><div><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><h2>${escapeHtml(text("noJobsTitle"))}</h2><p>${escapeHtml(text("noJobsLead"))}</p><a class="maritime-button" href="${escapeHtml(portalUrl("maritime-jobs.html"))}">${escapeHtml(text("filterAll"))}</a></div></div>`;
    const focusId = new URLSearchParams(window.location.search).get("job");
    if (focusId) {
      const card = grid.querySelector(`[data-job-id="${window.CSS && CSS.escape ? CSS.escape(focusId) : focusId}"]`);
      if (card) card.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  async function applyToJob(jobId) {
    const job = jobs.find(function (item) { return item.id === jobId; });
    if (!job || isApplied(jobId)) return;
    if (!session) {
      const target = new URL(window.location.href);
      target.searchParams.set("apply", jobId);
      window.location.href = loginUrl(`${target.pathname}${target.search}`);
      return;
    }
    const access = App.auth && App.auth.requireAccountType
      ? await App.auth.requireAccountType("customer", { user: session.user, redirect: true })
      : null;
    if (!access) return;
    const rows = applicationRows();
    rows.unshift({
      id: `application-${job.id}-${Date.now()}`,
      job_id: job.id,
      job_title: job.title,
      job_reference: job.reference,
      status: "submitted",
      applied_at: new Date().toISOString(),
      location: job.location,
      contract: job.contract,
      company_contact_visible: false
    });
    writeList("applications", rows);
    renderJobResults();
    const notice = document.querySelector("[data-jobs-notice]");
    if (notice) {
      notice.textContent = text("applicationSaved");
      notice.classList.add("is-visible");
      notice.scrollIntoView({ block: "nearest" });
    }
  }

  async function renderJobs() {
    const liveJobs = await loadPublicJobs();
    jobs = liveJobs.length ? liveJobs : normalizedSeedJobs();
    root.innerHTML = `<section class="maritime-toolbar"><div class="maritime-toolbar-copy"><h2>${escapeHtml(text("openJobs"))}</h2><p>${escapeHtml(text("openJobsLead"))}</p></div><strong class="maritime-reference" data-jobs-count></strong></section>
      <div class="maritime-filter-rail" role="toolbar" aria-label="${escapeHtml(text("openJobs"))}">${[["all", "filterAll"], ["deck", "filterDeck"], ["engine", "filterEngine"], ["electrical", "filterElectrical"], ["hotel", "filterHotel"]].map(function (item) { return `<button type="button" data-job-filter="${item[0]}" aria-pressed="${item[0] === activeFilter}">${escapeHtml(text(item[1]))}</button>`; }).join("")}</div>
      <div class="maritime-notice" role="status" aria-live="polite" data-jobs-notice></div><section class="maritime-job-grid" data-jobs-grid></section>`;
    renderJobResults();
    const pendingId = new URLSearchParams(window.location.search).get("apply");
    if (pendingId && session) await applyToJob(pendingId);
  }

  function authGate() {
    root.innerHTML = `<section class="maritime-auth-gate"><div><i class="fa-solid fa-user-shield" aria-hidden="true"></i><h2>${escapeHtml(text("loginRequiredTitle"))}</h2><p>${escapeHtml(text("loginRequiredLead"))}</p><a class="maritime-button maritime-button--primary" href="${escapeHtml(loginUrl())}">${escapeHtml(text("loginButton"))}</a></div></section>`;
  }

  function personalAccountGate(context) {
    const accountHome = App.auth && App.auth.accountHome
      ? App.auth.accountHome(context && context.type || "partner", context)
      : "../partner/partner-panel.html";
    root.innerHTML = `<section class="maritime-auth-gate maritime-account-type-gate"><div><i class="fa-solid fa-building-shield" aria-hidden="true"></i><h2>${escapeHtml(text("personalAccountRequiredTitle"))}</h2><p>${escapeHtml(text("personalAccountRequiredLead"))}</p><small>${escapeHtml(text("personalAccountRule"))}</small><div class="maritime-auth-gate-actions"><a class="maritime-button maritime-button--primary" href="${escapeHtml(accountSwitchUrl("login"))}">${escapeHtml(text("switchToPersonalAccount"))}</a><a class="maritime-button" href="${escapeHtml(accountSwitchUrl("register"))}">${escapeHtml(text("createPersonalAccount"))}</a><a class="maritime-button" href="${escapeHtml(accountHome)}">${escapeHtml(text("companyPanel"))}</a></div></div></section>`;
  }

  async function liveApplications() {
    if (!session || !App.supabase) return [];
    try {
      const result = await App.supabase.from("maritime_hiring_applications").select("id,job_id,status,submitted_at,updated_at,metadata").eq("seafarer_user_id", userId()).order("created_at", { ascending: false }).limit(100);
      if (result.error) return [];
      return (result.data || []).map(function (item) {
        const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
        return { id: item.id, job_id: item.job_id, job_title: compact(metadata.job_title, 140) || text("genericPosition"), job_reference: compact(metadata.job_reference, 40) || `AH-${String(item.job_id).slice(0, 8).toUpperCase()}`, status: item.status, applied_at: item.submitted_at || item.updated_at, location: compact(metadata.location_label, 120), contract: compact(metadata.detail_label, 120) };
      });
    } catch (error) {
      return [];
    }
  }

  function applicationStatusKey(status) {
    if (["shortlisted", "interviewing"].includes(status)) return "statusShortlist";
    if (["offer_sent", "offer_accepted", "hired"].includes(status)) return "statusAccepted";
    if (["submitted", "drafted", "awaiting_candidate_approval"].includes(status)) return "statusSubmitted";
    return "statusReview";
  }

  async function renderApplications() {
    if (!session) return authGate();
    const remote = await liveApplications();
    const local = applicationRows();
    const seen = new Set();
    const rows = [...remote, ...local].filter(function (item) { const key = item.id || `${item.job_id}-${item.applied_at}`; if (seen.has(key)) return false; seen.add(key); return true; });
    if (!rows.length) {
      root.innerHTML = `<section class="maritime-empty"><div><i class="fa-solid fa-clipboard-list" aria-hidden="true"></i><h2>${escapeHtml(text("noApplicationsTitle"))}</h2><p>${escapeHtml(text("noApplicationsLead"))}</p><a class="maritime-button maritime-button--primary" href="${escapeHtml(portalUrl("maritime-jobs.html"))}">${escapeHtml(text("browseJobs"))}</a></div></section>`;
      return;
    }
    const reviewing = rows.filter(function (item) { return ["submitted", "drafted", "awaiting_candidate_approval", "shortlisted", "interviewing"].includes(item.status); }).length;
    const accepted = rows.filter(function (item) { return ["offer_sent", "offer_accepted", "hired"].includes(item.status); }).length;
    root.innerHTML = `<section class="maritime-summary-strip"><article><strong>${rows.length}</strong><span>${escapeHtml(text("totalApplications"))}</span></article><article><strong>${reviewing}</strong><span>${escapeHtml(text("reviewing"))}</span></article><article><strong>${accepted}</strong><span>${escapeHtml(text("accepted"))}</span></article></section><section class="maritime-record-grid">${rows.map(function (item) { const statusKey = applicationStatusKey(item.status); return `<article class="maritime-record-card"><div class="maritime-record-head"><div><span class="maritime-reference">${escapeHtml(item.job_reference || "")}</span><h3>${escapeHtml(item.job_title || text("genericPosition"))}</h3></div><span class="maritime-status-badge" data-status="${escapeHtml(item.status)}">${escapeHtml(text(statusKey))}</span></div><p>${escapeHtml(text("applicationFor"))}</p><div class="maritime-record-meta"><span><b>${escapeHtml(text("appliedAt"))}</b>${escapeHtml(dateLabel(item.applied_at))}</span><span><b>${escapeHtml(text("statusLabel"))}</b>${escapeHtml(text(statusKey))}</span><span><b>${escapeHtml(text("route"))}</b>${escapeHtml(item.location || text("globalRoute"))}</span></div></article>`; }).join("")}</section>`;
  }

  async function liveOffers() {
    if (!session || !App.supabase) return [];
    try {
      const result = await App.supabase.from("maritime_offers_contracts").select("id,application_id,job_id,offer_status,expires_at,created_at,updated_at,metadata").eq("seafarer_user_id", userId()).order("created_at", { ascending: false }).limit(100);
      if (result.error) return [];
      return (result.data || []).map(function (item) { const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {}; return { ...item, job_title: compact(metadata.job_title, 140) || text("genericPosition"), job_reference: compact(metadata.job_reference, 40) || `AH-${String(item.job_id).slice(0, 8).toUpperCase()}`, company_name: compact(metadata.company_name, 140), company_email: compact(metadata.company_email, 180), company_phone: compact(metadata.company_phone, 40), company_contact_visible: metadata.company_contact_visible === true || metadata.company_contact_allowed === true }; });
    } catch (error) {
      return [];
    }
  }

  async function renderOffers() {
    if (!session) return authGate();
    const remote = await liveOffers();
    const local = readList("offers");
    const rows = [...remote, ...local];
    if (!rows.length) {
      root.innerHTML = `<section class="maritime-section-heading"><h2>${escapeHtml(text("offersTitle"))}</h2><p>${escapeHtml(text("offersPrivacy"))}</p></section><section class="maritime-empty"><div><i class="fa-solid fa-envelope-open" aria-hidden="true"></i><h2>${escapeHtml(text("noOffersTitle"))}</h2><p>${escapeHtml(text("noOffersLead"))}</p><a class="maritime-button" href="${escapeHtml(portalUrl("maritime-applications.html"))}">${escapeHtml(text("applicationsNav"))}</a></div></section>`;
      return;
    }
    root.innerHTML = `<section class="maritime-section-heading"><h2>${escapeHtml(text("offersTitle"))}</h2><p>${escapeHtml(text("offersPrivacy"))}</p></section><section class="maritime-record-grid">${rows.map(function (item) { const visible = item.company_contact_visible === true; return `<article class="maritime-record-card"><div class="maritime-record-head"><div><span class="maritime-reference">${escapeHtml(item.job_reference || "")}</span><h3>${escapeHtml(item.job_title || text("genericPosition"))}</h3></div><span class="maritime-status-badge" data-status="${escapeHtml(item.offer_status || "sent")}">${escapeHtml(text("offerSent"))}</span></div><div class="maritime-record-meta"><span><b>${escapeHtml(text("offerStatus"))}</b>${escapeHtml(text("offerSent"))}</span><span><b>${escapeHtml(text("appliedAt"))}</b>${escapeHtml(dateLabel(item.created_at || item.updated_at))}</span></div><div class="maritime-offer-contact"><strong>${escapeHtml(visible && item.company_name ? item.company_name : text("contactHidden"))}</strong>${visible ? `<p>${escapeHtml([item.company_email, item.company_phone].filter(Boolean).join(" · "))}</p>` : ""}</div></article>`; }).join("")}</section>`;
  }

  function autoPreference() {
    try { return JSON.parse(localStorage.getItem(storageKey("autoApply")) || "{}"); } catch (error) { return {}; }
  }

  function renderAuto() {
    if (!session) return authGate();
    const preference = autoPreference();
    root.innerHTML = `<section class="maritime-auto-layout"><div class="maritime-auto-copy"><h2>${escapeHtml(text("autoHeading"))}</h2><p>${escapeHtml(text("autoDescription"))}</p><div class="maritime-readiness-list"><div class="maritime-readiness-item"><i class="fa-solid fa-user-check" aria-hidden="true"></i><span><strong>${escapeHtml(text("profileReady"))}</strong><small>${escapeHtml(text("profileReadyDesc"))}</small></span><span class="maritime-readiness-state">${escapeHtml(text("pendingCheck"))}</span></div><div class="maritime-readiness-item"><i class="fa-solid fa-file-lines" aria-hidden="true"></i><span><strong>${escapeHtml(text("maritimeCv"))}</strong><small>${escapeHtml(text("maritimeCvDesc"))}</small></span><span class="maritime-readiness-state">${escapeHtml(text("pendingCheck"))}</span></div><div class="maritime-readiness-item"><i class="fa-solid fa-passport" aria-hidden="true"></i><span><strong>${escapeHtml(text("globalPassport"))}</strong><small>${escapeHtml(text("globalPassportDesc"))}</small></span><span class="maritime-readiness-state">${escapeHtml(text("pendingCheck"))}</span></div></div></div><aside class="maritime-auto-control"><h2>${escapeHtml(text("autoControlTitle"))}</h2><p>${escapeHtml(text("autoControlLead"))}</p><button class="maritime-button maritime-button--primary" type="button" data-auto-toggle aria-pressed="${preference.enabled === true}"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>${escapeHtml(text(preference.enabled === true ? "disableAuto" : "enableAuto"))}</button><a class="maritime-button" href="${escapeHtml(portalUrl("maritime-smart-account.html"))}">${escapeHtml(text("prepareCv"))}</a><div class="maritime-notice ${preference.updated_at ? "is-visible" : ""}" role="status" aria-live="polite" data-auto-notice>${preference.updated_at ? escapeHtml(text(preference.enabled ? "autoSaved" : "autoPaused")) : ""}</div></aside></section>`;
  }

  function accountInitials(name) {
    const parts = compact(name, 120).split(" ").filter(Boolean);
    return (parts.slice(0, 2).map(function (part) { return part[0]; }).join("") || "AH").toLocaleUpperCase(localeCodes[language()] || "tr-TR");
  }

  function safeAvatar(value) {
    const sync = window.AllonaProfileSync;
    if (sync && sync.safeAvatarUrl) return sync.safeAvatarUrl(value);
    const raw = String(value || "").trim();
    return /^data:image\/(png|jpe?g|webp);base64,/i.test(raw) || /^https?:\/\//i.test(raw) ? raw : "";
  }

  async function loadAccountProfile() {
    const metadata = session && session.user && session.user.user_metadata || {};
    accountProfile = {
      id: userId(),
      user_id: userId(),
      full_name: compact(metadata.full_name || metadata.name || session.user.email && session.user.email.split("@")[0] || "AllonaHub", 120),
      email: compact(session.user.email, 180),
      avatar: safeAvatar(metadata.avatar_url || metadata.avatar || ""),
      avatar_url: safeAvatar(metadata.avatar_url || metadata.avatar || ""),
      module: "maritime"
    };
    const sync = window.AllonaProfileSync;
    if (!sync || !sync.createClient || !sync.load) return accountProfile;
    try {
      profileClient = profileClient || sync.createClient();
      const loaded = await sync.load(profileClient);
      if (loaded && loaded.profile) accountProfile = { ...accountProfile, ...loaded.profile, email: accountProfile.email, module: "maritime" };
    } catch (error) {}
    return accountProfile;
  }

  async function loadSeafarerClassification() {
    const pending = { status: "not_assessed", system_approved: false };
    if (!session || !session.access_token) return pending;
    const base = String(App.config && App.config.apiBaseUrl || "https://api.allonahub.com").replace(/\/$/, "");
    try {
      const response = await fetch(`${base}/v1/maritime/smart-account`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${session.access_token}` }
      });
      const payload = await response.json().catch(function () { return {}; });
      if (!response.ok || payload.ok !== true) return pending;
      const readiness = payload.run && payload.run.smart_snapshot && payload.run.smart_snapshot.readiness || {};
      const status = ["system_approved", "review_required", "evidence_required", "not_assessed"].includes(readiness.seafarer_status)
        ? readiness.seafarer_status
        : "not_assessed";
      return { status, system_approved: readiness.seafarer_system_approved === true };
    } catch (error) {
      return pending;
    }
  }

  function seafarerStatusCopy(status) {
    if (status === "system_approved") return "seafarerStatusApproved";
    if (status === "review_required") return "seafarerStatusReview";
    if (status === "evidence_required") return "seafarerStatusEvidence";
    return "seafarerStatusPending";
  }

  function accountAction(href, icon, labelKey, modifier) {
    return `<a class="maritime-account-action ${modifier || ""}" href="${escapeHtml(href)}"><i class="fa-solid ${icon}" aria-hidden="true"></i><span>${escapeHtml(text(labelKey))}</span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></a>`;
  }

  async function renderAccount() {
    if (!session) return authGate();
    const [profile, classification] = await Promise.all([loadAccountProfile(), loadSeafarerClassification()]);
    const name = compact(profile.full_name, 120) || "AllonaHub";
    const avatar = safeAvatar(profile.avatar_url || profile.avatar || "");
    const classificationKey = seafarerStatusCopy(classification.status);
    root.innerHTML = `<section class="maritime-account-layout">
      <aside class="maritime-account-profile">
        <div class="maritime-account-avatar" data-account-avatar>${avatar ? `<img src="${escapeHtml(avatar)}" alt="">` : `<span>${escapeHtml(accountInitials(name))}</span>`}</div>
        <h2>${escapeHtml(name)}</h2>
        <p>${escapeHtml(profile.email || session.user.email || "")}</p>
        <span class="maritime-account-badge"><i class="fa-solid fa-anchor" aria-hidden="true"></i>${escapeHtml(text("maritimeAccount"))}</span>
        <div class="maritime-seafarer-status" data-status="${escapeHtml(classification.status)}">
          <span><i class="fa-solid ${classification.system_approved ? "fa-circle-check" : "fa-clock"}" aria-hidden="true"></i><b>${escapeHtml(text("seafarerStatusLabel"))}</b></span>
          <strong>${escapeHtml(text(classificationKey))}</strong>
          <small>${escapeHtml(text("seafarerStatusNote"))}</small>
        </div>
        <label class="maritime-button maritime-button--primary maritime-photo-button" for="maritimeAvatarInput"><i class="fa-solid fa-camera" aria-hidden="true"></i><span data-account-photo-label>${escapeHtml(text(avatar ? "replacePhoto" : "changePhoto"))}</span></label>
        <input class="maritime-photo-input" id="maritimeAvatarInput" type="file" accept="image/jpeg,image/png,image/webp" data-account-photo>
        <small>${escapeHtml(text("photoHint"))}</small>
        <div class="maritime-notice" role="status" aria-live="polite" data-account-status></div>
      </aside>
      <section class="maritime-account-actions" aria-labelledby="maritimeAccountActionsTitle">
        <h2 id="maritimeAccountActionsTitle">${escapeHtml(text("accountActions"))}</h2>
        <div class="maritime-account-action-grid">
          ${accountAction(portalUrl("maritime-jobs.html"), "fa-briefcase", "jobsNav")}
          ${accountAction(portalUrl("maritime-applications.html"), "fa-list-check", "applicationsNav")}
          ${accountAction(portalUrl("maritime-offers.html"), "fa-envelope-open-text", "offersNav")}
          ${accountAction(portalUrl("maritime-auto-apply.html"), "fa-wand-magic-sparkles", "autoNav")}
          ${accountAction(portalUrl("maritime-smart-account.html"), "fa-file-lines", "smartAccountNav", "maritime-account-action--smart")}
          ${accountAction(portalUrl("maritime-documents.html"), "fa-folder-open", "uploadDocumentsNav", "maritime-account-action--danger")}
          ${accountAction(portalUrl("maritime-complaints.html"), "fa-shield-halved", "complaintsNav")}
        </div>
        <button class="maritime-account-signout" type="button" data-account-signout><i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>${escapeHtml(text("signOut"))}</button>
      </section>
    </section>`;
  }

  function resizedAvatar(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = function () {
        const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/webp", 0.84));
      };
      image.onerror = function () { URL.revokeObjectURL(url); reject(new Error("image_read_failed")); };
      image.src = url;
    });
  }

  async function saveAccountPhoto(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const status = root.querySelector("[data-account-status]");
    const label = root.querySelector("[data-account-photo-label]");
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const showStatus = function (message) {
      if (!status) return;
      status.textContent = message;
      status.classList.add("is-visible");
    };
    if (!allowed.includes(file.type)) {
      showStatus(text("photoTypeError"));
      input.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showStatus(text("photoSizeError"));
      input.value = "";
      return;
    }
    showStatus(text("photoSaving"));
    try {
      const avatarUrl = safeAvatar(await resizedAvatar(file));
      if (!avatarUrl) throw new Error("invalid_avatar");
      const sync = window.AllonaProfileSync;
      const nextProfile = { ...accountProfile, avatar: avatarUrl, avatar_url: avatarUrl, module: "maritime", updated_at: new Date().toISOString() };
      if (sync && sync.save) {
        profileClient = profileClient || sync.createClient();
        accountProfile = await sync.save(profileClient, nextProfile);
      } else if (App.supabase && App.supabase.auth) {
        const result = await App.supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });
        if (result.error) throw result.error;
        accountProfile = nextProfile;
      } else {
        throw new Error("profile_unavailable");
      }
      const avatar = root.querySelector("[data-account-avatar]");
      if (avatar) avatar.innerHTML = `<img src="${escapeHtml(avatarUrl)}" alt="">`;
      if (label) label.textContent = text("replacePhoto");
      showStatus(text("photoSaved"));
    } catch (error) {
      showStatus(text("photoError"));
    } finally {
      input.value = "";
    }
  }

  function complaintTopicButton(topic, icon, titleKey, descKey) {
    return `<button class="maritime-topic-button" type="button" data-complaint-topic="${topic}" aria-pressed="${activeTopic === topic}"><i class="fa-solid ${icon}" aria-hidden="true"></i><strong>${escapeHtml(text(titleKey))}</strong><span>${escapeHtml(text(descKey))}</span></button>`;
  }

  function topicKeys(topic) {
    return { fraud: ["fraudTitle", "fraudDesc"], itf: ["itfTitle", "itfDesc"], legal: ["legalTitle", "legalDesc"], suggestion: ["suggestionTitle", "suggestionDesc"] }[topic] || ["fraudTitle", "fraudDesc"];
  }

  function renderComplaints() {
    const topic = new URLSearchParams(window.location.search).get("topic");
    if (["fraud", "itf", "legal", "suggestion"].includes(topic)) activeTopic = topic;
    const selected = topicKeys(activeTopic);
    root.innerHTML = `<section class="maritime-section-heading"><h2>${escapeHtml(text("complaintOptions"))}</h2><p>${escapeHtml(text("complaintOptionsLead"))}</p></section><section class="maritime-complaint-topics">${complaintTopicButton("fraud", "fa-triangle-exclamation", "fraudTitle", "fraudDesc")}${complaintTopicButton("itf", "fa-life-ring", "itfTitle", "itfDesc")}${complaintTopicButton("legal", "fa-scale-balanced", "legalTitle", "legalDesc")}${complaintTopicButton("suggestion", "fa-lightbulb", "suggestionTitle", "suggestionDesc")}</section><form class="maritime-complaint-form" data-complaint-form><h2 data-complaint-form-title>${escapeHtml(text(selected[0]))}</h2><p data-complaint-form-lead>${escapeHtml(text(selected[1]))}</p><input type="hidden" name="subject" value="${escapeHtml(text(selected[0]))}" data-complaint-subject><input type="hidden" name="category" value="maritime_${activeTopic}"><input type="hidden" name="page_url" value="${escapeHtml(window.location.href)}"><div class="maritime-field"><label for="maritimeComplaintName">${escapeHtml(text("name"))}</label><input id="maritimeComplaintName" name="name" type="text" autocomplete="name" maxlength="120" required></div><div class="maritime-field"><label for="maritimeComplaintEmail">${escapeHtml(text("email"))}</label><input id="maritimeComplaintEmail" name="email" type="email" autocomplete="email" maxlength="180" required></div><div class="maritime-field"><label for="maritimeComplaintPhone">${escapeHtml(text("phone"))}</label><input id="maritimeComplaintPhone" name="phone" type="tel" autocomplete="tel" maxlength="30"></div><div class="maritime-field maritime-form-full"><label for="maritimeComplaintMessage">${escapeHtml(text("message"))}</label><textarea id="maritimeComplaintMessage" name="message" maxlength="4000" required></textarea></div><p class="maritime-reference maritime-form-full">${escapeHtml(text("formSafety"))}</p><div class="maritime-notice" role="status" aria-live="polite" data-complaint-status></div><div class="maritime-form-actions"><button class="maritime-button maritime-button--primary" type="submit" data-complaint-submit><i class="fa-solid fa-paper-plane" aria-hidden="true"></i>${escapeHtml(text("send"))}</button></div></form>`;
    if (session && session.user) {
      const email = root.querySelector("#maritimeComplaintEmail");
      const name = root.querySelector("#maritimeComplaintName");
      if (email) email.value = session.user.email || "";
      if (name) name.value = compact(session.user.user_metadata && session.user.user_metadata.full_name, 120);
    }
  }

  function complaintRateAllowed() {
    const key = "allonahub.maritime.complaintRate.v1";
    const now = Date.now();
    let rows = [];
    try { rows = JSON.parse(localStorage.getItem(key) || "[]"); } catch (error) {}
    rows = Array.isArray(rows) ? rows.filter(function (time) { return Number(time) > now - 3600000; }) : [];
    if (rows.length >= 3) return false;
    rows.push(now);
    localStorage.setItem(key, JSON.stringify(rows));
    return true;
  }

  async function submitComplaint(form) {
    const status = form.querySelector("[data-complaint-status]");
    const submit = form.querySelector("[data-complaint-submit]");
    if (!form.reportValidity()) {
      status.textContent = text("requiredFields");
      status.classList.add("is-visible");
      return;
    }
    if (!complaintRateAllowed()) {
      status.textContent = text("rateLimit");
      status.classList.add("is-visible");
      return;
    }
    submit.disabled = true;
    submit.textContent = text("sending");
    try {
      const config = App.config && App.config.emailjs || {};
      if (!window.emailjs || !config.serviceId || !config.templateId || !config.publicKey) throw new Error("email_unavailable");
      window.emailjs.init(config.publicKey);
      await window.emailjs.sendForm(config.serviceId, config.templateId, form);
      status.textContent = text("sent");
      status.classList.add("is-visible");
      const currentEmail = session && session.user && session.user.email || "";
      form.reset();
      form.querySelector("[data-complaint-subject]").value = text(topicKeys(activeTopic)[0]);
      form.querySelector('[name="category"]').value = `maritime_${activeTopic}`;
      if (currentEmail) form.querySelector('[name="email"]').value = currentEmail;
    } catch (error) {
      status.textContent = text("sendError");
      status.classList.add("is-visible");
    } finally {
      submit.disabled = false;
      submit.innerHTML = `<i class="fa-solid fa-paper-plane" aria-hidden="true"></i>${escapeHtml(text("send"))}`;
    }
  }

  function setGlobalPassportHelp(open, restoreFocus) {
    const toggle = document.querySelector("[data-global-passport-help-toggle]");
    const card = document.querySelector("[data-global-passport-help-card]");
    if (!toggle || !card) return;
    toggle.setAttribute("aria-expanded", String(open));
    card.hidden = !open;
    if (open) card.scrollTop = 0;
    else if (restoreFocus) toggle.focus({ preventScroll: true });
  }

  function bindEvents() {
    document.addEventListener("click", function (event) {
      const helpToggle = event.target.closest("[data-global-passport-help-toggle]");
      if (helpToggle) {
        setGlobalPassportHelp(helpToggle.getAttribute("aria-expanded") !== "true");
        return;
      }
      if (event.target.closest("[data-global-passport-help-close]")) {
        setGlobalPassportHelp(false, true);
        return;
      }
      const openHelp = document.querySelector('[data-global-passport-help-toggle][aria-expanded="true"]');
      if (openHelp && !event.target.closest(".maritime-global-passport-help")) setGlobalPassportHelp(false);
      const back = event.target.closest("[data-go-back]");
      if (back) {
        let referrer = null;
        try {
          referrer = document.referrer ? new URL(document.referrer, window.location.href) : null;
        } catch (error) {}
        if (referrer && referrer.origin === window.location.origin && history.length > 1) history.back();
        else window.location.href = portalUrl("allonadenizcilik.html");
        return;
      }
      const signOut = event.target.closest("[data-account-signout]");
      if (signOut) {
        signOut.disabled = true;
        Promise.resolve(App.auth && App.auth.signOut ? App.auth.signOut({ redirect: false }) : null)
          .then(function () { window.location.href = portalUrl("allonadenizcilik.html"); })
          .catch(function () { signOut.disabled = false; });
        return;
      }
      const filter = event.target.closest("[data-job-filter]");
      if (filter) {
        activeFilter = filter.dataset.jobFilter || "all";
        document.querySelectorAll("[data-job-filter]").forEach(function (node) { node.setAttribute("aria-pressed", String(node === filter)); });
        renderJobResults();
        return;
      }
      const apply = event.target.closest("[data-apply-job]");
      if (apply) {
        applyToJob(apply.dataset.applyJob);
        return;
      }
      const toggle = event.target.closest("[data-auto-toggle]");
      if (toggle && session) {
        const current = autoPreference();
        localStorage.setItem(storageKey("autoApply"), JSON.stringify({ enabled: current.enabled !== true, updated_at: new Date().toISOString() }));
        renderAuto();
        return;
      }
      const topic = event.target.closest("[data-complaint-topic]");
      if (topic) {
        activeTopic = topic.dataset.complaintTopic;
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("topic", activeTopic);
        history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}`);
        renderComplaints();
      }
    });

    document.addEventListener("submit", function (event) {
      const search = event.target.closest("[data-portal-search]");
      if (search) {
        event.preventDefault();
        const query = compact(new FormData(search).get("q"), 80);
        window.location.href = `${portalUrl("maritime-jobs.html")}?q=${encodeURIComponent(query)}`;
        return;
      }
      const complaint = event.target.closest("[data-complaint-form]");
      if (complaint) {
        event.preventDefault();
        submitComplaint(complaint);
      }
    });

    document.addEventListener("change", function (event) {
      const photo = event.target.closest("[data-account-photo]");
      if (photo) saveAccountPhoto(photo);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && document.querySelector('[data-global-passport-help-toggle][aria-expanded="true"]')) {
        setGlobalPassportHelp(false, true);
      }
    });
  }

  async function renderView() {
    renderedLanguage = language();
    setStaticTranslations();
    const context = await syncSession();
    const customerOnly = ["applications", "offers", "auto", "account", "documents", "smart"].includes(view);
    if (customerOnly && session && (!context || context.type !== "customer")) {
      personalAccountGate(context);
      return;
    }
    document.querySelectorAll("[data-view-link]").forEach(function (link) {
      if (link.dataset.viewLink === view) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    if (view === "jobs") await renderJobs();
    else if (view === "applications") await renderApplications();
    else if (view === "offers") await renderOffers();
    else if (view === "auto") renderAuto();
    else if (view === "account") await renderAccount();
    else if (view === "documents") {
      if (!session) authGate();
      else document.dispatchEvent(new CustomEvent("allona:maritime-documents-ready", { detail: { session, context } }));
    }
    else if (view === "smart") {
      if (!session) authGate();
      else document.dispatchEvent(new CustomEvent("allona:maritime-smart-account-ready", { detail: { session, context } }));
    }
    else renderComplaints();
  }

  async function init() {
    if (!root) return;
    const main = document.querySelector(".maritime-portal-main");
    if (main) main.setAttribute("data-no-translate", "");
    ensureSmartNavigation();
    bindEvents();
    await renderView();
    document.addEventListener("allona:language-changed", function (event) {
      const nextLanguage = event && event.detail && event.detail.language || language();
      if (nextLanguage === renderedLanguage) return;
      renderView();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
