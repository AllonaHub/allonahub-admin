(function () {
  "use strict";

  const App = window.Allona = window.Allona || {};
  const languageCodes = ["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"];
  const localeCodes = { tr: "tr-TR", az: "az-AZ", kk: "kk-KZ", uz: "uz-UZ", ky: "ky-KG", en: "en-GB", de: "de-DE", ru: "ru-RU", ar: "ar-SA" };
  const view = document.body && document.body.dataset.maritimeView || "jobs";
  const root = document.querySelector("[data-portal-root]");
  let session = null;
  let jobs = [];
  let candidateMatches = [];
  let activeFilter = "all";
  let activeTopic = "fraud";
  let renderedLanguage = "";
  let accountProfile = null;
  let profileClient = null;
  let autoPreferenceState = { enabled: false, updated_at: null };
  let smartApplicationState = { run: null, matches: [], application_drafts: [], application_readiness: { documents_state: "unknown", has_saved_maritime_cv: false, has_confirmed_maritime_cv: false } };
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
    maritimeCvNav: ["Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV"],
    uploadDocumentsNav: ["Belgelerim", "Sənədlərim", "Құжаттарым", "Hujjatlarim", "Документтерим", "My Documents", "Meine Dokumente", "Мои документы", "مستنداتي"],
    smartAccountNav: ["Global CV", "Global CV", "Global CV", "Global CV", "Global CV", "Global CV", "Global CV", "Global CV", "Global CV"],
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
    documentsTitle: ["Belgelerim", "Sənədlərim", "Құжаттарым", "Hujjatlarim", "Документтерим", "My Documents", "Meine Dokumente", "Мои документы", "مستنداتي"],
    documentsLead: ["Denizcilik PDF belgelerinizi hesabınızda güvenle saklayın. Bu alan belgeleri okumaz ve Maritime CV bilgilerinizi değiştirmez.", "Dənizçilik PDF sənədlərinizi hesabınızda təhlükəsiz saxlayın. Bu sahə sənədləri oxumur və Maritime CV məlumatlarını dəyişmir.", "Теңізге қатысты PDF құжаттарыңызды аккаунтта қауіпсіз сақтаңыз. Бұл бөлім құжаттарды оқымайды және Maritime CV деректерін өзгертпейді.", "Dengizchilik PDF hujjatlaringizni hisobingizda xavfsiz saqlang. Bu bo‘lim hujjatlarni o‘qimaydi va Maritime CV maʼlumotlarini o‘zgartirmaydi.", "Деңизчилик PDF документтериңизди аккаунтуңузда коопсуз сактаңыз. Бул бөлүм документтерди окубайт жана Maritime CV маалыматын өзгөртпөйт.", "Store your maritime PDF documents securely in your account. This area does not read documents or change your Maritime CV data.", "Speichern Sie Ihre maritimen PDF-Dokumente sicher in Ihrem Konto. Dieser Bereich liest keine Dokumente und ändert Ihre Maritime-CV-Daten nicht.", "Безопасно храните морские PDF-документы в аккаунте. Этот раздел не считывает документы и не изменяет данные Maritime CV.", "احفظ مستنداتك البحرية بصيغة PDF بأمان في حسابك. لا يقرأ هذا القسم المستندات ولا يغير بيانات Maritime CV."],
    smartAccountTitle: ["Global CV", "Global CV", "Global CV", "Global CV", "Global CV", "Global CV", "Global CV", "Global CV", "Global CV"],
    smartAccountLead: ["Maritime CV'nizde kaydettiğiniz bilgiler ve fotoğrafla oluşturulan uluslararası başvuru CV'nizi görüntüleyin.", "Maritime CV-də saxladığınız məlumat və foto ilə yaradılan beynəlxalq müraciət CV-nizə baxın.", "Maritime CV-де сақталған деректер мен фотодан жасалған халықаралық өтінім түйіндемесін көріңіз.", "Maritime CV-da saqlangan maʼlumot va surat asosida yaratilgan xalqaro ariza CV-ni ko‘ring.", "Maritime CV-де сакталган маалымат жана сүрөт менен түзүлгөн эл аралык арыз CV-син көрүңүз.", "View the international application CV created from the information and photo saved in your Maritime CV.", "Zeigen Sie den internationalen Bewerbungslebenslauf an, der aus den Daten und dem Foto Ihres Maritime CV erstellt wurde.", "Просматривайте международное резюме, созданное из данных и фотографии в вашем Maritime CV.", "اعرض السيرة الذاتية الدولية التي تم إنشاؤها من المعلومات والصورة المحفوظة في Maritime CV."],
    smartAccountAddDocument: ["Maritime CV'yi Düzenle", "Maritime CV-ni redaktə et", "Maritime CV-ді өңдеу", "Maritime CV-ni tahrirlash", "Maritime CV-ни түзөтүү", "Edit Maritime CV", "Maritime CV bearbeiten", "Изменить Maritime CV", "تعديل Maritime CV"],
    globalPassportHelpLabel: ["Global CV hakkında bilgi", "Global CV haqqında məlumat", "Global CV туралы ақпарат", "Global CV haqida maʼlumot", "Global CV жөнүндө маалымат", "About Global CV", "Informationen zum Global CV", "О Global CV", "حول Global CV"],
    globalPassportHelpTitle: ["Global CV Nedir?", "Global CV nədir?", "Global CV деген не?", "Global CV nima?", "Global CV деген эмне?", "What Is Global CV?", "Was ist Global CV?", "Что такое Global CV?", "ما هو Global CV؟"],
    globalPassportHelpBody: ["Global CV, Maritime CV'nizde kendi onayınızla kaydettiğiniz deniz hizmeti, yeterlilik, sertifika, referans ve iletişim bilgilerini profesyonel bir başvuru düzeninde birleştirir. Bilgilerinizi bir kez güncellediğinizde başvurularınızda aynı düzenli kariyer özeti kullanılabilir.", "Global CV Maritime CV-də öz təsdiqinizlə saxladığınız dəniz xidməti, səriştə, sertifikat, istinad və əlaqə məlumatlarını peşəkar müraciət formatında birləşdirir. Məlumatı yenilədikdə eyni nizamlı karyera xülasəsi müraciətlərinizdə istifadə oluna bilər.", "Global CV Maritime CV-де өзіңіз растаған теңіз өтілі, біліктілік, сертификат, ұсыным және байланыс деректерін кәсіби өтінім пішіміне біріктіреді. Деректер жаңартылғанда сол реттелген мансап түйіндемесі өтінімдерде қолданылады.", "Global CV Maritime CV-da o‘zingiz tasdiqlab saqlagan dengiz xizmati, malaka, sertifikat, tavsiya va aloqa maʼlumotlarini professional ariza shaklida jamlaydi. Maʼlumot yangilanganda shu tartibli kasbiy xulosa arizalarda ishlatiladi.", "Global CV Maritime CV-де өзүңүз ырастап сактаган деңиз кызматы, квалификация, сертификат, сунуш жана байланыш маалыматын кесипкөй арыз форматына бириктирет. Маалымат жаңырганда ошол иреттүү карьера жыйынтыгы арыздарда колдонулат.", "Global CV combines the sea service, qualifications, certificates, references, and contact details you approve in Maritime CV into a professional application format. Update your information once and reuse the same organized career summary in applications.", "Global CV bündelt die von Ihnen im Maritime CV bestätigten Dienstzeiten, Befähigungen, Zertifikate, Referenzen und Kontaktdaten in einem professionellen Bewerbungsformat. Aktualisierte Angaben stehen danach geordnet für Bewerbungen bereit.", "Global CV объединяет подтвержденные вами в Maritime CV сведения о стаже, квалификации, сертификатах, рекомендациях и контактах в профессиональном формате. После обновления единое структурированное резюме используется в заявках.", "يجمع Global CV الخدمة البحرية والمؤهلات والشهادات والمراجع وبيانات الاتصال التي تعتمدها في Maritime CV ضمن صيغة مهنية للتقديم. حدّث معلوماتك مرة واحدة واستخدم الملخص المهني المنظم في طلباتك."],
    globalPassportHelpWorldwide: ["Global CV, dünyanın farklı bölgelerindeki denizcilik şirketlerine yapılan uluslararası iş başvurularında kullanılmak üzere hazırlanır.", "Global CV dünyanın müxtəlif bölgələrindəki dənizçilik şirkətlərinə beynəlxalq iş müraciətlərində istifadə üçün hazırlanır.", "Global CV әлемнің әр өңіріндегі теңіз компанияларына халықаралық жұмыс өтінімдерінде қолдануға арналған.", "Global CV dunyoning turli hududlaridagi dengizchilik kompaniyalariga xalqaro ish arizalarida foydalanish uchun tayyorlanadi.", "Global CV дүйнөнүн ар кайсы аймактарындагы деңизчилик компанияларына эл аралык жумуш арыздарында колдонуу үчүн даярдалат.", "Global CV is designed for international job applications to maritime companies in different regions of the world.", "Global CV ist für internationale Bewerbungen bei Seefahrtunternehmen in verschiedenen Regionen der Welt konzipiert.", "Global CV предназначен для международных заявок в морские компании разных регионов мира.", "تم إعداد Global CV للاستخدام في طلبات العمل الدولية لدى شركات بحرية في مناطق مختلفة من العالم."],
    globalPassportHelpPrivacy: ["Kontrol sizde kalır: yalnız Maritime CV'nizde kaydedip onayladığınız bilgiler kullanılır. Global CV resmî kimlik, pasaport, sertifika veya yeterlilik belgesi değildir ve bunların yerine geçmez.", "Nəzarət sizdə qalır: yalnız Maritime CV-də saxlayıb təsdiqlədiyiniz məlumat istifadə olunur. Global CV rəsmi şəxsiyyət, pasport, sertifikat və ya səriştə sənədi deyil və onları əvəz etmir.", "Бақылау өзіңізде: Maritime CV-де сақтап, растаған деректер ғана пайдаланылады. Global CV ресми жеке куәлік, паспорт, сертификат немесе біліктілік құжаты емес және оларды алмастырмайды.", "Nazorat sizda: faqat Maritime CV-da saqlab tasdiqlagan maʼlumotlaringiz ishlatiladi. Global CV rasmiy shaxsni tasdiqlovchi hujjat, pasport, sertifikat yoki malaka hujjati emas va ularning o‘rnini bosmaydi.", "Көзөмөл сизде: Maritime CV-де сактап ырастаган маалымат гана колдонулат. Global CV расмий инсандык документ, паспорт, сертификат же квалификация документи эмес жана аларды алмаштырбайт.", "You remain in control: only information you save and approve in Maritime CV is used. Global CV is not an official identity document, passport, certificate, or qualification and does not replace any of them.", "Sie behalten die Kontrolle: Verwendet werden nur Angaben, die Sie im Maritime CV speichern und bestätigen. Global CV ist kein amtlicher Ausweis, Pass, Zertifikat oder Befähigungsnachweis und ersetzt diese Dokumente nicht.", "Контроль остается у вас: используются только сведения, сохраненные и подтвержденные вами в Maritime CV. Global CV не является удостоверением личности, паспортом, сертификатом или документом о квалификации и не заменяет их.", "تبقى السيطرة بيدك: لا تُستخدم إلا المعلومات التي تحفظها وتعتمدها في Maritime CV. لا يُعد Global CV وثيقة هوية رسمية أو جواز سفر أو شهادة أو إثبات مؤهل ولا يحل محل أي منها."],
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
    minimumExperience: ["En az deneyim", "Minimum təcrübə", "Ең аз тәжірибе", "Eng kam tajriba", "Эң аз тажрыйба", "Minimum experience", "Mindesterfahrung", "Минимальный опыт", "الحد الأدنى للخبرة"],
    months: ["ay", "ay", "ай", "oy", "ай", "months", "Monate", "месяцев", "أشهر"],
    salary: ["Maaş", "Maaş", "Жалақы", "Maosh", "Айлык", "Salary", "Gehalt", "Зарплата", "الراتب"],
    joiningDate: ["Katılım tarihi", "Qoşulma tarixi", "Қосылу күні", "Qo‘shilish sanasi", "Кошулуу күнү", "Joining date", "Einstiegsdatum", "Дата посадки", "تاريخ الالتحاق"],
    joiningPort: ["Katılım limanı", "Qoşulma limanı", "Қосылу порты", "Qo‘shilish porti", "Кошулуу порту", "Joining port", "Einstiegshafen", "Порт посадки", "ميناء الالتحاق"],
    currentPort: ["Şirket onaylı mevcut konum", "Şirkətin təsdiqlədiyi cari mövqe", "Компания растаған ағымдағы орын", "Kompaniya tasdiqlagan joriy joylashuv", "Компания ырастаган учурдагы жайгашуу", "Company-confirmed location", "Vom Unternehmen bestätigter Standort", "Текущее местоположение, подтвержденное компанией", "الموقع الحالي المؤكد من الشركة"],
    nextPort: ["Sonraki liman", "Növbəti liman", "Келесі порт", "Keyingi port", "Кийинки порт", "Next port", "Nächster Hafen", "Следующий порт", "الميناء التالي"],
    vesselSpecs: ["Gemi bilgisi", "Gəmi məlumatı", "Кеме мәліметі", "Kema maʼlumoti", "Кеме маалыматы", "Vessel details", "Schiffsdaten", "Данные судна", "بيانات السفينة"],
    routeRisk: ["Rota riski", "Marşrut riski", "Маршрут тәуекелі", "Yo‘nalish xavfi", "Багыт коркунучу", "Route risk", "Routenrisiko", "Риск маршрута", "مخاطر المسار"],
    noWarZone: ["Şirketin bildirdiğine göre geminin planlanan rotası savaş bölgesinden geçmiyor", "Şirkətin bildirdiyinə görə gəminin planlaşdırılan marşrutu müharibə zonasından keçmir", "Компания мәліметіне сай кеменің жоспарланған бағыты соғыс аймағынан өтпейді", "Kompaniya maʼlumotiga ko‘ra, kemaning rejalashtirilgan yo‘nalishi urush hududidan o‘tmaydi", "Компаниянын маалыматына ылайык, кеменин пландалган багыты согуш аймагынан өтпөйт", "According to the company, the vessel's planned route does not pass through a war zone", "Nach Angaben des Unternehmens führt die geplante Route des Schiffes nicht durch ein Kriegsgebiet", "По данным компании, запланированный маршрут судна не проходит через зону боевых действий", "وفقاً للشركة، لا يمر المسار المخطط للسفينة عبر منطقة حرب"],
    sixMonths: ["6 ay", "6 ay", "6 ай", "6 oy", "6 ай", "6 months", "6 Monate", "6 месяцев", "6 أشهر"],
    globalRoute: ["Global", "Qlobal", "Жаһандық", "Global", "Глобалдык", "Global", "Global", "Международный", "عالمي"],
    europeRoute: ["Avrupa", "Avropa", "Еуропа", "Yevropa", "Европа", "Europe", "Europa", "Европа", "أوروبا"],
    internationalRoute: ["Uluslararası", "Beynəlxalq", "Халықаралық", "Xalqaro", "Эл аралык", "International", "International", "Международный", "دولي"],
    apply: ["Başvur", "Müraciət et", "Өтінім беру", "Ariza berish", "Арыз берүү", "Apply", "Bewerben", "Откликнуться", "تقديم"],
    applied: ["Başvuruldu", "Müraciət edildi", "Өтінім берілді", "Ariza berildi", "Арыз берилди", "Applied", "Beworben", "Заявка отправлена", "تم التقديم"],
    applicationBlockedTitle: ["Bu ilana başvuru yapamazsınız", "Bu elana müraciət edə bilməzsiniz", "Бұл жұмысқа өтініш бере алмайсыз", "Bu eʼlonga ariza bera olmaysiz", "Бул орунга арыз бере албайсыз", "You cannot apply for this job", "Sie können sich nicht auf diese Stelle bewerben", "Вы не можете подать заявку на эту вакансию", "لا يمكنك التقدم لهذه الوظيفة"],
    applicationDialogClose: ["Kapat", "Bağla", "Жабу", "Yopish", "Жабуу", "Close", "Schließen", "Закрыть", "إغلاق"],
    qualificationMismatchTemplate: ["CV'nizdeki rütbe bu ilan için uygun değil. Size uygun ilanlara göz atabilirsiniz.", "CV-nizdəki rütbə bu elana uyğun deyil. Sizə uyğun elanlara baxa bilərsiniz.", "Түйіндемеңіздегі дәреже бұл орынға сәйкес емес. Өзіңізге сай орындарды қараңыз.", "CV dagi unvoningiz bu eʼlonga mos emas. Oʻzingizga mos ishlarni ko‘ring.", "CVдеги даражаңыз бул орунга туура келбейт. Өзүңүзгө ылайык орундарды караңыз.", "The rank in your CV does not match this role. Please explore positions suited to your rank.", "Ihr Rang im Lebenslauf passt nicht zu dieser Stelle. Sehen Sie sich passende Stellen an.", "Звание в вашем резюме не соответствует этой вакансии. Посмотрите подходящие вакансии.", "رتبتك في سيرتك الذاتية لا تناسب هذه الوظيفة. اطلع على الوظائف المناسبة لك."],
    requirementsMismatch: ["CV'niz bu ilanın diğer koşullarıyla eşleşmiyor. Size uygun ilanlara göz atabilirsiniz.", "CV-niz bu elanın digər şərtlərinə uyğun gəlmir. Sizə uyğun elanlara baxa bilərsiniz.", "Түйіндемеңіз бұл орынның басқа талаптарына сәйкес емес. Өзіңізге сай орындарды қараңыз.", "CV bu eʼlonning boshqa talablariga mos emas. Oʻzingizga mos ishlarni ko‘ring.", "CVңиз бул орундагы башка шарттарга туура келбейт. Өзүңүзгө ылайык орундарды караңыз.", "Your CV does not meet the other requirements for this role. Please explore suitable positions.", "Ihr Lebenslauf erfüllt die weiteren Anforderungen dieser Stelle nicht. Sehen Sie sich passende Stellen an.", "Ваше резюме не соответствует другим условиям вакансии. Посмотрите подходящие вакансии.", "سيرتك الذاتية لا تستوفي المتطلبات الأخرى لهذه الوظيفة. اطلع على الوظائف المناسبة لك."],
    automaticApplicationSubmitted: ["Otomatik Başvuru Yapıldı", "Avtomatik müraciət edildi", "Автоматты өтінім жіберілді", "Avtomatik ariza yuborildi", "Автоматтык арыз жөнөтүлдү", "Applied Automatically", "Automatisch beworben", "Автоматическая заявка отправлена", "تم التقديم تلقائياً"],
    uploadDocuments: ["Belgelerini Yükle", "Sənədlərini yüklə", "Құжаттарыңды жүкте", "Hujjatlaringizni yuklang", "Документтериңизди жүктөңүз", "Upload Documents", "Dokumente hochladen", "Загрузить документы", "تحميل المستندات"],
    documentsMissingReason: ["Uygun ilanları belirleyebilmemiz için denizcilik belgelerinizi yükleyin.", "Uyğun elanları müəyyən etmək üçün dənizçilik sənədlərinizi yükləyin.", "Сәйкес вакансияларды анықтау үшін теңіз құжаттарыңызды жүктеңіз.", "Mos ishlarni aniqlashimiz uchun dengizchilik hujjatlaringizni yuklang.", "Ылайыктуу жумуштарды аныктоо үчүн деңизчилик документтериңизди жүктөңүз.", "Upload your maritime documents so we can identify matching listings.", "Laden Sie Ihre Seefahrtsdokumente hoch, damit passende Stellen ermittelt werden können.", "Загрузите морские документы, чтобы мы могли определить подходящие вакансии.", "حمّل مستنداتك البحرية لنتمكن من تحديد الوظائف المناسبة."],
    reviewDocuments: ["Belgelerini Tamamla", "Sənədlərini tamamla", "Құжаттарыңды аяқта", "Hujjatlaringizni yakunlang", "Документтериңизди толуктаңыз", "Complete Documents", "Dokumente vervollständigen", "Завершить документы", "استكمال المستندات"],
    documentsPendingReason: ["Belgeleriniz yüklendi. İnceleme ve onay adımlarını tamamlayın.", "Sənədləriniz yüklənib. Yoxlama və təsdiq addımlarını tamamlayın.", "Құжаттарыңыз жүктелді. Тексеру және растау қадамдарын аяқтаңыз.", "Hujjatlaringiz yuklandi. Tekshirish va tasdiqlash bosqichlarini yakunlang.", "Документтериңиз жүктөлдү. Текшерүү жана ырастоо кадамдарын бүтүрүңүз.", "Your documents are uploaded. Complete the review and confirmation steps.", "Ihre Dokumente wurden hochgeladen. Schließen Sie Prüfung und Bestätigung ab.", "Документы загружены. Завершите проверку и подтверждение.", "تم تحميل مستنداتك. أكمل خطوات المراجعة والتأكيد."],
    completeMaritimeCv: ["Maritime CV'ni Tamamla", "Maritime CV-ni tamamla", "Maritime CV-ді аяқта", "Maritime CV-ni yakunlang", "Maritime CV-ни толуктаңыз", "Complete Maritime CV", "Maritime CV vervollständigen", "Заполнить Maritime CV", "استكمال Maritime CV"],
    maritimeCvMissingReason: ["Yeterliliğinizi ilanlarla eşleştirebilmek için Maritime CV'nizi tamamlayın.", "Səriştənizi elanlarla uyğunlaşdırmaq üçün Maritime CV-ni tamamlayın.", "Біліктілігіңізді вакансиялармен сәйкестендіру үшін Maritime CV-ді аяқтаңыз.", "Malakangizni ishlar bilan moslashtirish uchun Maritime CV-ni yakunlang.", "Квалификацияңызды жумуштарга дал келтирүү үчүн Maritime CV-ни толуктаңыз.", "Complete your Maritime CV so your qualifications can be matched with listings.", "Vervollständigen Sie Ihr Maritime CV, damit Ihre Qualifikationen abgeglichen werden können.", "Заполните Maritime CV, чтобы сопоставить квалификацию с вакансиями.", "أكمل Maritime CV لمطابقة مؤهلاتك مع الوظائف."],
    completeGlobalCv: ["Önce Global CV'yi tamamlayın", "Əvvəlcə Global CV-ni tamamlayın", "Алдымен Global CV-ді толтырыңыз", "Avval Global CV-ni to‘ldiring", "Адегенде Global CV-ни толуктаңыз", "Complete Global CV first", "Global CV zuerst vervollständigen", "Сначала заполните Global CV", "أكمل Global CV أولاً"],
    globalCvMissingReason: ["İlan uygunluğunuzu hesaplamak için Global CV'nizi oluşturun.", "Elan uyğunluğunuzu hesablamaq üçün Global CV-ni yaradın.", "Вакансияға сәйкестікті есептеу үшін Global CV жасаңыз.", "Ishga mosligingizni hisoblash uchun Global CV yarating.", "Жумушка шайкештигиңизди эсептөө үчүн Global CV түзүңүз.", "Create your Global CV so listing eligibility can be calculated.", "Erstellen Sie Ihr Global CV, damit die Stelleneignung berechnet werden kann.", "Создайте Global CV, чтобы рассчитать соответствие вакансии.", "أنشئ Global CV لحساب مدى توافقك مع الوظيفة."],
    confirmGlobalCv: ["Önce Global CV'yi onaylayın", "Əvvəlcə Global CV-ni təsdiqləyin", "Алдымен Global CV-ді растаңыз", "Avval Global CV-ni tasdiqlang", "Адегенде Global CV-ни ырастагыла", "Confirm Global CV first", "Global CV zuerst bestätigen", "Сначала подтвердите Global CV", "أكد Global CV أولاً"],
    confirmGlobalCvReason: ["Başvurmadan önce Global CV'nizdeki bilgileri kontrol edip onaylayın.", "Müraciətdən əvvəl Global CV məlumatlarını yoxlayıb təsdiqləyin.", "Өтінім бермес бұрын Global CV деректерін тексеріп, растаңыз.", "Ariza berishdan oldin Global CV maʼlumotlarini tekshirib tasdiqlang.", "Арыз берүүдөн мурда Global CV маалыматын текшерип ырастагыла.", "Review and confirm your Global CV before applying.", "Prüfen und bestätigen Sie Ihr Global CV vor der Bewerbung.", "Перед откликом проверьте и подтвердите Global CV.", "راجع Global CV وأكده قبل التقديم."],
    notEligibleForPosition: ["Yeterlilik Eşleşmedi", "Səriştə uyğun gəlmədi", "Біліктілік сәйкес келмеді", "Malaka mos kelmadi", "Квалификация дал келген жок", "Qualification Not Matched", "Qualifikation stimmt nicht überein", "Квалификация не совпала", "المؤهل غير متطابق"],
    notEligibleReason: ["Bu ilan için yeterliliğiniz eşleşmiyor.", "Bu elan üçün səriştəniz uyğun gəlmir.", "Бұл вакансияға біліктілігіңіз сәйкес келмейді.", "Bu ish uchun malakangiz mos kelmaydi.", "Бул жумушка квалификацияңыз дал келбейт.", "Your qualifications do not match this listing.", "Ihre Qualifikationen stimmen mit dieser Stelle nicht überein.", "Ваша квалификация не соответствует этой вакансии.", "مؤهلاتك لا تتطابق مع هذه الوظيفة."],
    refreshEligibility: ["Eşleştirmeyi Güncelle", "Uyğunluğu yenilə", "Сәйкестікті жаңарту", "Moslikni yangilang", "Шайкештикти жаңыртуу", "Refresh Match", "Abgleich aktualisieren", "Обновить соответствие", "تحديث المطابقة"],
    refreshEligibilityReason: ["CV veya ilan bilgileri değişti. Uygunluk eşleştirmenizi güncelleyin.", "CV və ya elan məlumatı dəyişib. Uyğunluq yoxlamasını yeniləyin.", "CV немесе вакансия деректері өзгерді. Сәйкестікті жаңартыңыз.", "CV yoki ish maʼlumoti o‘zgardi. Moslikni yangilang.", "CV же жумуш маалыматы өзгөрдү. Шайкештикти жаңыртыңыз.", "Your CV or the listing changed. Refresh the eligibility match.", "Ihr CV oder die Stelle wurde geändert. Aktualisieren Sie den Abgleich.", "CV или вакансия изменились. Обновите проверку соответствия.", "تغيرت بيانات CV أو الوظيفة. حدّث مطابقة الأهلية."],
    listingRequirementsPending: ["İlan Bilgileri Hazırlanıyor", "Elan məlumatı hazırlanır", "Вакансия деректері дайындалуда", "Ish maʼlumoti tayyorlanmoqda", "Жумуш маалыматы даярдалууда", "Listing Details Pending", "Stellendaten werden vorbereitet", "Данные вакансии готовятся", "جارٍ إعداد بيانات الوظيفة"],
    listingRequirementsPendingReason: ["Bu ilanın yeterlilik kriterleri tamamlandığında başvuru açılacaktır.", "Elanın səriştə meyarları tamamlandıqda müraciət açılacaq.", "Вакансия талаптары толық болғанда өтінім ашылады.", "Ish malaka mezonlari tayyor bo‘lganda ariza ochiladi.", "Жумуштун квалификация талаптары даяр болгондо арыз ачылат.", "Applications will open when this listing's qualification criteria are complete.", "Bewerbungen werden geöffnet, sobald die Qualifikationskriterien vollständig sind.", "Подача откроется после заполнения требований к квалификации.", "سيفتح التقديم بعد اكتمال معايير المؤهل لهذه الوظيفة."],
    eligibilityUnavailable: ["Kontrol Bekleniyor", "Yoxlama gözlənilir", "Тексеру күтілуде", "Tekshiruv kutilmoqda", "Текшерүү күтүлүүдө", "Check Pending", "Prüfung ausstehend", "Ожидается проверка", "بانتظار التحقق"],
    eligibilityUnavailableReason: ["Bilgileriniz şu anda kontrol edilemiyor. Lütfen biraz sonra yeniden deneyin.", "Məlumatınız hazırda yoxlanıla bilmir. Bir az sonra yenidən cəhd edin.", "Деректеріңіз қазір тексерілмейді. Кейінірек қайталап көріңіз.", "Maʼlumotlaringiz hozir tekshirilmayapti. Birozdan keyin qayta urinib ko‘ring.", "Маалыматыңыз азыр текшерилбей жатат. Бир аздан кийин кайра аракет кылыңыз.", "Your information cannot be checked right now. Please try again shortly.", "Ihre Angaben können derzeit nicht geprüft werden. Versuchen Sie es später erneut.", "Сейчас данные нельзя проверить. Повторите попытку позже.", "تعذر التحقق من بياناتك حالياً. حاول مرة أخرى بعد قليل."],
    applicationConfirm: ["CV'niz bu ilana uygundur. Başvuruyu doğrulanmış firmaya göndermek istiyor musunuz?", "CV-niz bu elana uyğundur. Müraciəti təsdiqlənmiş şirkətə göndərmək istəyirsiniz?", "CV осы орынға сәйкес. Өтінімді расталған компанияға жібересіз бе?", "CV bu eʼlonga mos. Arizani tasdiqlangan kompaniyaga yuborasizmi?", "CV бул жарыяга туура келет. Арызды текшерилген компанияга жөнөтөсүзбү?", "Your CV matches this listing. Submit the application to the verified company?", "Ihr CV passt zu dieser Stelle. Bewerbung an das verifizierte Unternehmen senden?", "Ваш CV подходит. Отправить заявку проверенной компании?", "سيرتك مطابقة. هل تريد إرسال الطلب إلى الشركة الموثقة؟"],
    matchedJobs: ["Eşleşen ilanlar", "Uyğun elanlar", "Сәйкес хабарландырулар", "Mos eʼlonlar", "Дал келген жарыялар", "Matched jobs", "Passende Stellen", "Подходящие вакансии", "الوظائف المطابقة"],
    rankCompatible: ["Rütbene uygun", "Rütbənizə uyğun", "Шеніңізге сай", "Unvoningizga mos", "Даражаңызга ылайык", "Matches your rank", "Passend zu Ihrem Rang", "По вашему званию", "مناسب لرتبتك"],
    shareDocumentsConsent: ["Başvur ve belgelerimi bu firmayla paylaş", "Müraciət et və sənədlərimi bu şirkətlə paylaş", "Өтініш беріп, құжаттарымды осы компаниямен бөлісу", "Ariza berish va hujjatlarimni kompaniyaga ulashish", "Арыз берүү жана документтеримди компанияга бөлүшүү", "Apply and share my documents with this company", "Bewerben und Dokumente mit diesem Unternehmen teilen", "Подать заявку и поделиться документами с компанией", "تقديم الطلب ومشاركة مستنداتي مع الشركة"],
    shareDocumentsCheckbox: ["Belgelerimin ve bilgilerimin bu firmayla paylaşılmasına izin veriyorum.", "Sənədlərimin və məlumatlarımın bu şirkətlə paylaşılmasına icazə verirəm.", "Құжаттарым мен мәліметтерімді осы компаниямен бөлісуге келісемін.", "Hujjatlarim va maʼlumotlarimni ushbu kompaniya bilan ulashishga roziman.", "Документтеримди жана маалыматтарымды бул компания менен бөлүшүүгө уруксат берем.", "I allow my documents and information to be shared with this company.", "Ich stimme zu, dass meine Dokumente und Angaben mit diesem Unternehmen geteilt werden.", "Разрешаю передать мои документы и данные этой компании.", "أوافق على مشاركة مستنداتي وبياناتي مع هذه الشركة."],
    shareDocumentsRequired: ["Başvurmak için önce belge ve bilgi paylaşımına izin verin.", "Müraciət etmək üçün əvvəlcə sənəd və məlumat paylaşımına icazə verin.", "Өтініш беру үшін алдымен құжаттар мен деректерді бөлісуге келісіңіз.", "Ariza berish uchun avval hujjat va maʼlumotlarni ulashishga rozilik bering.", "Арыз берүү үчүн адегенде документ жана маалымат бөлүшүүгө уруксат бериңиз.", "To apply, first allow your documents and information to be shared.", "Stimmen Sie vor der Bewerbung der Weitergabe Ihrer Dokumente und Angaben zu.", "Для отклика сначала разрешите передачу документов и данных.", "للتقديم، وافق أولاً على مشاركة مستنداتك وبياناتك."],
    shareDocumentsRequiredTitle: ["Paylaşım izni gerekli", "Paylaşım icazəsi lazımdır", "Бөлісуге келісім қажет", "Ulashishga rozilik kerak", "Бөлүшүүгө уруксат керек", "Sharing permission required", "Zustimmung zur Weitergabe erforderlich", "Нужно согласие на передачу", "مطلوب إذن المشاركة"],
    shareDocumentsConfirm: ["Bu ilana başvurarak Maritime CV'nizin ve yüklediğiniz belgelerin yalnızca bu doğrulanmış firmadaki yetkili kişilerce görüntülenmesine izin veriyorsunuz. Devam edilsin mi?", "Bu elana müraciət edərək Maritime CV-nizin və yüklədiyiniz sənədlərin yalnız bu təsdiqlənmiş şirkətin səlahiyyətli şəxslərinə görünməsinə icazə verirsiniz. Davam edilsin?", "Осы жұмысқа өтініш беру арқылы Maritime CV және құжаттарыңызды тек расталған компания өкілдеріне көрсетесіз. Жалғастырасыз ба?", "Ariza bilan Maritime CV va hujjatlaringiz faqat tasdiqlangan kompaniya vakillariga ko‘rinadi. Davom etilsinmi?", "Бул орунга арыз берип, Maritime CV жана документтериңизди текшерилген компаниянын ыйгарым укуктуу өкүлдөрүнө көрсөтүүгө уруксат бересиз. Улантасызбы?", "By applying, you allow authorized people at this verified company to view your Maritime CV and uploaded documents for this job only. Continue?", "Mit der Bewerbung erlauben Sie den Berechtigten dieses verifizierten Unternehmens, Ihr Maritime CV und Ihre Dokumente nur für diese Stelle einzusehen. Fortfahren?", "Подавая заявку, вы разрешаете уполномоченным представителям этой проверенной компании просматривать ваше Maritime CV и документы только для этой вакансии. Продолжить?", "بتقديم الطلب، تسمح للمخولين لدى هذه الشركة الموثقة بعرض سيرتك البحرية ومستنداتك لهذه الوظيفة فقط. هل تتابع؟"],
    applicationSending: ["Uygunluk doğrulanıyor ve başvuru gönderiliyor...", "Uyğunluq yoxlanılır və müraciət göndərilir...", "Сәйкестік тексеріліп, өтінім жіберілуде...", "Moslik tekshirilib, ariza yuborilmoqda...", "Шайкештик текшерилип, арыз жөнөтүлүүдө...", "Checking eligibility and submitting...", "Eignung wird geprüft und Bewerbung gesendet...", "Проверяем соответствие и отправляем заявку...", "جارٍ التحقق من الأهلية وإرسال الطلب..."],
    applicationFailed: ["Başvuru gönderilemedi. Global CV eşleşmenizi yenileyip tekrar deneyin.", "Müraciət göndərilmədi. Global CV uyğunluğunu yeniləyib yenidən cəhd edin.", "Өтінім жіберілмеді. Global CV сәйкестігін жаңартып көріңіз.", "Ariza yuborilmadi. Global CV mosligini yangilab qayta urinib ko‘ring.", "Арыз жөнөтүлгөн жок. Global CV шайкештигин жаңыртып кайталаңыз.", "Application could not be submitted. Refresh your Global CV match and try again.", "Bewerbung konnte nicht gesendet werden. Aktualisieren Sie Ihren Global-CV-Abgleich.", "Заявка не отправлена. Обновите сопоставление Global CV.", "تعذر إرسال الطلب. حدّث مطابقة Global CV وحاول مجدداً."],
    jobSafeSummary: ["Pozisyon doğrulanmış firma havuzunda yayınlanır. Ayrıntılı şirket bilgileri yalnızca kabul edilen başvuruda görünür.", "Vəzifə təsdiqlənmiş şirkət hovuzunda yayımlanır. Ətraflı şirkət məlumatı yalnız qəbul edilən müraciətdə görünür.", "Лауазым расталған компаниялар пулында жарияланады. Толық дерек тек қабылданған өтінімде көрінеді.", "Lavozim tasdiqlangan kompaniyalar tizimida eʼlon qilinadi. Batafsil maʼlumot faqat qabul qilingan arizada ko‘rinadi.", "Кызмат текшерилген компаниялар тизмесинде жарыяланат. Толук маалымат кабыл алынган арызда гана көрүнөт.", "The position is published in the verified company pool. Full company details appear only after acceptance.", "Die Stelle wird im Pool verifizierter Unternehmen veröffentlicht. Details erscheinen erst nach Annahme.", "Вакансия размещена в пуле проверенных компаний. Полные данные видны только после принятия заявки.", "تُنشر الوظيفة ضمن مجموعة الشركات الموثقة، ولا تظهر التفاصيل الكاملة إلا بعد قبول الطلب."],
    noJobsTitle: ["Uygun ilan bulunamadı", "Uyğun elan tapılmadı", "Сәйкес вакансия табылмады", "Mos eʼlon topilmadi", "Ылайыктуу жарыя табылган жок", "No matching listings", "Keine passenden Stellen", "Подходящих вакансий нет", "لا توجد وظائف مطابقة"],
    noJobsLead: ["Aramanızı değiştirin veya tüm pozisyonları yeniden görüntüleyin.", "Axtarışı dəyişin və ya bütün vəzifələri yenidən göstərin.", "Іздеуді өзгертіңіз немесе барлық орынды қайта көрсетіңіз.", "Qidiruvni o‘zgartiring yoki barcha lavozimlarni ko‘ring.", "Издөөнү өзгөртүңүз же бардык кызматтарды көрүңүз.", "Change your search or show all positions again.", "Ändern Sie die Suche oder zeigen Sie alle Stellen.", "Измените поиск или покажите все вакансии.", "غيّر البحث أو اعرض جميع الوظائف من جديد."],
    jobsCount: ["açık ilan", "açıq elan", "ашық орын", "ochiq eʼlon", "ачык жумуш", "open listings", "offene Stellen", "открытых вакансий", "وظائف متاحة"],
    applicationSaved: ["Başvurunuz kaydedildi. Durumunu Başvurularım sayfasından takip edebilirsiniz.", "Müraciətiniz saxlanıldı. Vəziyyəti Müraciətlərim səhifəsindən izləyə bilərsiniz.", "Өтінім сақталды. Күйін Өтінімдерім бетінен бақылай аласыз.", "Arizangiz saqlandi. Holatini Arizalarim sahifasidan kuzating.", "Арызыңыз сакталды. Абалын Арыздарым барагынан көрүңүз.", "Your application was saved. Track it from My Applications.", "Ihre Bewerbung wurde gespeichert. Verfolgen Sie sie unter Meine Bewerbungen.", "Заявка сохранена. Следите за ней в разделе «Мои заявки».", "تم حفظ طلبك. تابعه من صفحة طلباتي."],

    loginRequiredTitle: ["Bu alan için giriş yapın", "Bu sahə üçün daxil olun", "Бұл бөлімге кіру қажет", "Bu bo‘lim uchun kiring", "Бул бөлүм үчүн кириңиз", "Sign in to continue", "Zum Fortfahren anmelden", "Войдите, чтобы продолжить", "سجّل الدخول للمتابعة"],
    loginRequiredLead: ["Kişisel AllonaHub hesabınızla giriş yapın. Ayrı bir denizci hesap türü seçmeniz gerekmez; denizcilik profiliniz yüklediğiniz belgelerden, yalnızca sizin onayınızla oluşturulur.", "Şəxsi AllonaHub hesabınızla daxil olun. Ayrı dənizçi hesab növü seçməyə ehtiyac yoxdur; dənizçilik profiliniz yüklədiyiniz sənədlərdən yalnız təsdiqinizlə yaradılır.", "Жеке AllonaHub аккаунтыңызбен кіріңіз. Теңізшіге арналған бөлек аккаунт түрін таңдаудың қажеті жоқ; теңіз профиліңіз жүктеген құжаттарыңыздан тек сіздің растауыңызбен жасалады.", "Shaxsiy AllonaHub hisobingiz bilan kiring. Alohida dengizchi hisob turini tanlash shart emas; dengizchilik profilingiz yuklagan hujjatlaringizdan faqat tasdig‘ingiz bilan yaratiladi.", "Жеке AllonaHub аккаунтуңуз менен кириңиз. Өзүнчө деңизчи аккаунт түрүн тандоонун кереги жок; деңизчилик профилиңиз жүктөгөн документтериңизден сиздин ырастооңуз менен гана түзүлөт.", "Sign in with your personal AllonaHub account. You do not need to select a separate seafarer account type; your maritime profile is created from your documents only after your approval.", "Melden Sie sich mit Ihrem persönlichen AllonaHub-Konto an. Ein eigener Seefahrer-Kontotyp ist nicht erforderlich; Ihr maritimes Profil wird erst nach Ihrer Bestätigung aus Ihren Dokumenten erstellt.", "Войдите в личный аккаунт AllonaHub. Выбирать отдельный тип аккаунта моряка не нужно; морской профиль создается из загруженных документов только после вашего подтверждения.", "سجّل الدخول بحساب AllonaHub الشخصي. لا تحتاج إلى اختيار نوع حساب منفصل للبحّارة؛ يُنشأ ملفك البحري من مستنداتك بعد موافقتك فقط."],
    loginButton: ["Giriş Yap", "Daxil ol", "Кіру", "Kirish", "Кирүү", "Sign In", "Anmelden", "Войти", "تسجيل الدخول"],
    personalAccountRequiredTitle: ["Kişisel hesapla devam edin", "Şəxsi hesabla davam edin", "Жеке аккаунтпен жалғастырыңыз", "Shaxsiy hisob bilan davom eting", "Жеке аккаунт менен улантыңыз", "Continue with a personal account", "Mit einem persönlichen Konto fortfahren", "Продолжите с личным аккаунтом", "تابع باستخدام حساب شخصي"],
    personalAccountRequiredLead: ["Şu anda bir şirket hesabıyla giriş yaptınız. Maritime CV, belgeler, Global CV, başvurular ve iş teklifleri kişiye özel olduğu için bu alan yalnızca ayrı bir kişisel AllonaHub hesabında açılır.", "Hazırda şirkət hesabı ilə daxil olmusunuz. Maritime CV, sənədlər, Global CV, müraciətlər və iş təklifləri şəxsi olduğuna görə bu sahə yalnız ayrıca şəxsi AllonaHub hesabında açılır.", "Қазір компания аккаунтымен кірдіңіз. Maritime CV, құжаттар, Global CV, өтінімдер мен ұсыныстар жеке болғандықтан, бұл бөлім бөлек жеке AllonaHub аккаунтында ашылады.", "Hozir kompaniya hisobi bilan kirgansiz. Maritime CV, hujjatlar, Global CV, arizalar va ish takliflari shaxsiy bo‘lgani uchun bu bo‘lim alohida shaxsiy AllonaHub hisobida ochiladi.", "Учурда компания аккаунту менен кирдиңиз. Maritime CV, документтер, Global CV, арыздар жана жумуш сунуштары жеке болгондуктан, бул бөлүм өзүнчө жеке AllonaHub аккаунтунда ачылат.", "You are currently signed in with a company account. Maritime CV, documents, Global CV, applications, and offers are personal, so this area opens only in a separate personal AllonaHub account.", "Sie sind mit einem Unternehmenskonto angemeldet. Maritime CV, Dokumente, Global CV, Bewerbungen und Angebote sind personenbezogen und nur in einem separaten persönlichen AllonaHub-Konto verfügbar.", "Сейчас вы вошли через аккаунт компании. Maritime CV, документы, Global CV, заявки и предложения являются личными и доступны только в отдельном личном аккаунте AllonaHub.", "أنت مسجّل الدخول بحساب شركة. وبما أن Maritime CV والمستندات وGlobal CV والطلبات والعروض بيانات شخصية، فلا يفتح هذا القسم إلا في حساب AllonaHub شخصي منفصل."],
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
    autoDescription: ["Bilgileriniz ve belgeleriniz tamamlandıktan, profiliniz doğrulandıktan ve Maritime CV ile Global CV hazırlandıktan sonra akıllı platform, siz uyurken bile kriterlerinize uyan açık iş ilanlarını tarar ve verdiğiniz izin kapsamında sizin yerinize otomatik başvuru yapar.", "Məlumat və sənədləriniz tamamlandıqdan, profiliniz təsdiqləndikdən, Maritime CV və Global CV hazır olduqdan sonra ağıllı platforma uyğun açıq işləri yoxlayır və icazəniz çərçivəsində sizin yerinizə müraciət edir.", "Деректер мен құжаттар толық, профиль расталған, Maritime CV және Global CV дайын болғанда платформа сәйкес бос орындарды қарап, рұқсатыңыз аясында өтінім береді.", "Maʼlumot va hujjatlaringiz to‘liq, profilingiz tasdiqlangan, Maritime CV va Global CV tayyor bo‘lgach, platforma mos ishlarni topib, ruxsatingiz doirasida ariza beradi.", "Маалымат жана документтер толук, профиль текшерилип, Maritime CV жана Global CV даяр болгондо платформа ылайыктуу жумуштарды карап, уруксатыңыздын негизинде арыз берет.", "After your information and documents are complete, your profile is verified, and Maritime CV and Global CV are ready, the platform scans matching jobs and applies on your behalf within your permission.", "Sobald Angaben und Dokumente vollständig, Ihr Profil verifiziert sowie Maritime CV und Global CV bereit sind, durchsucht die Plattform passende Stellen und bewirbt sich mit Ihrer Einwilligung.", "Когда данные и документы заполнены, профиль подтвержден, а Maritime CV и Global CV готовы, платформа ищет подходящие вакансии и подает заявки в рамках вашего разрешения.", "بعد اكتمال البيانات والمستندات والتحقق من الملف وتجهيز Maritime CV وGlobal CV، تبحث المنصة عن الوظائف المناسبة وتتقدم نيابة عنك ضمن إذنك."],
    profileReady: ["Tamamlanmış Profil", "Tamamlanmış profil", "Толық профиль", "To‘liq profil", "Толук профиль", "Complete Profile", "Vollständiges Profil", "Заполненный профиль", "ملف مكتمل"],
    profileReadyDesc: ["Kimlik, yeterlilik ve iş tercihleri", "Şəxsiyyət, səriştə və iş seçimləri", "Жеке дерек, біліктілік және жұмыс талғамы", "Shaxs, malaka va ish tanlovlari", "Жеке маалымат, квалификация жана жумуш тандоосу", "Identity, qualifications, and job preferences", "Identität, Qualifikationen und Jobwünsche", "Личные данные, квалификация и предпочтения", "الهوية والمؤهلات وتفضيلات العمل"],
    maritimeCv: ["Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV"],
    maritimeCvDesc: ["Onaylı deniz hizmeti ve sertifikalar", "Təsdiqli dəniz xidməti və sertifikatlar", "Расталған теңіз өтілі мен сертификаттар", "Tasdiqlangan dengiz xizmati va sertifikatlar", "Текшерилген деңиз кызматы жана сертификаттар", "Approved sea service and certificates", "Bestätigte Seefahrtzeiten und Zertifikate", "Подтвержденный морской стаж и сертификаты", "الخدمة البحرية والشهادات المعتمدة"],
    globalPassport: ["Global CV", "Global CV", "Global CV", "Global CV", "Global CV", "Global CV", "Global CV", "Global CV", "Global CV"],
    globalPassportDesc: ["Doğrulanmış küresel uygunluk özeti", "Təsdiqlənmiş qlobal uyğunluq xülasəsi", "Расталған жаһандық сәйкестік қорытындысы", "Tasdiqlangan global muvofiqlik xulosasi", "Текшерилген глобалдык шайкештик жыйынтыгы", "Verified global readiness summary", "Verifizierte globale Eignungsübersicht", "Подтвержденный глобальный профиль готовности", "ملخص الجاهزية العالمية الموثق"],
    pendingCheck: ["Kontrol bekleniyor", "Yoxlama gözlənilir", "Тексеру күтілуде", "Tekshiruv kutilmoqda", "Текшерүү күтүлүүдө", "Check pending", "Prüfung ausstehend", "Ожидает проверки", "بانتظار التحقق"],
    autoControlTitle: ["Otomatik başvuru tercihi", "Avtomatik müraciət seçimi", "Автоматты өтінім таңдауы", "Avtomatik ariza tanlovi", "Автоматтык арыз тандоосу", "Auto-apply preference", "Einstellung für automatische Bewerbung", "Настройка автоподачи", "تفضيل التقديم التلقائي"],
    autoControlLead: ["Etkinleştirme tercihiniz kaydedilir. Başvurular yalnız profil ve belge kontrolleri tamamlandığında başlar.", "Seçiminiz saxlanılır. Müraciətlər yalnız profil və sənədlər yoxlandıqdan sonra başlayır.", "Таңдау сақталады. Өтінімдер профиль мен құжат тексерілген соң басталады.", "Tanlov saqlanadi. Arizalar profil va hujjatlar tekshirilgandan keyin boshlanadi.", "Тандоо сакталат. Арыздар профиль жана документтер текшерилгенден кийин башталат.", "Your preference is saved. Applications start only after profile and document checks are complete.", "Ihre Einstellung wird gespeichert. Bewerbungen starten erst nach Profil- und Dokumentenprüfung.", "Настройка сохраняется. Подача начнется только после проверки профиля и документов.", "يتم حفظ تفضيلك، ولا تبدأ الطلبات إلا بعد اكتمال فحص الملف والمستندات."],
    enableAuto: ["Otomatik Başvuruyu Etkinleştir", "Avtomatik müraciəti aktiv et", "Автоматты өтінімді қосу", "Avtomatik arizani yoqish", "Автоматтык арызды иштетүү", "Enable Auto Apply", "Automatische Bewerbung aktivieren", "Включить автоподачу", "تفعيل التقديم التلقائي"],
    disableAuto: ["Otomatik Başvuruyu Durdur", "Avtomatik müraciəti dayandır", "Автоматты өтінімді тоқтату", "Avtomatik arizani to‘xtatish", "Автоматтык арызды токтотуу", "Pause Auto Apply", "Automatische Bewerbung pausieren", "Приостановить автоподачу", "إيقاف التقديم التلقائي"],
    autoSaved: ["Tercihiniz kaydedildi. Profil ve belge kontrolleri tamamlanınca otomatik başvuru başlayacaktır.", "Seçiminiz saxlanıldı. Profil və sənəd yoxlamaları tamamlananda avtomatik müraciət başlayacaq.", "Таңдау сақталды. Профиль мен құжат тексерілген соң автоматты өтінім басталады.", "Tanlov saqlandi. Profil va hujjatlar tekshirilgach avtomatik ariza boshlanadi.", "Тандоо сакталды. Профиль жана документтер текшерилгенден кийин автоматтык арыз башталат.", "Your preference was saved. Auto apply will begin after profile and document checks are complete.", "Ihre Einstellung wurde gespeichert. Der Start erfolgt nach Profil- und Dokumentenprüfung.", "Настройка сохранена. Автоподача начнется после проверки профиля и документов.", "تم حفظ تفضيلك، وسيبدأ التقديم بعد اكتمال فحص الملف والمستندات."],
    autoPaused: ["Otomatik başvuru tercihi durduruldu.", "Avtomatik müraciət seçimi dayandırıldı.", "Автоматты өтінім тоқтатылды.", "Avtomatik ariza to‘xtatildi.", "Автоматтык арыз токтотулду.", "Auto apply was paused.", "Automatische Bewerbung wurde pausiert.", "Автоподача приостановлена.", "تم إيقاف التقديم التلقائي."],
    autoSaving: ["Tercihiniz güvenli biçimde kaydediliyor...", "Seçiminiz təhlükəsiz şəkildə saxlanılır...", "Таңдауыңыз қауіпсіз сақталуда...", "Tanlovingiz xavfsiz saqlanmoqda...", "Тандооңуз коопсуз сакталууда...", "Saving your preference securely...", "Ihre Einstellung wird sicher gespeichert...", "Настройка безопасно сохраняется...", "جارٍ حفظ تفضيلك بأمان..."],
    autoSaveFailed: ["Otomatik başvuru tercihi kaydedilemedi. Global CV'nizi ve uygunluk durumunuzu kontrol edip yeniden deneyin.", "Avtomatik müraciət seçimi saxlanılmadı. Global CV və uyğunluq vəziyyətinizi yoxlayıb yenidən cəhd edin.", "Автоматты өтінім баптауы сақталмады. Global CV мен сәйкестік күйін тексеріп, қайталап көріңіз.", "Avtomatik ariza tanlovi saqlanmadi. Global CV va moslik holatini tekshirib qayta urinib ko‘ring.", "Автоматтык арыз тандоосу сакталган жок. Global CV жана шайкештик абалын текшерип кайра аракет кылыңыз.", "Auto-apply preference could not be saved. Check your Global CV and eligibility, then try again.", "Die Einstellung konnte nicht gespeichert werden. Prüfen Sie Global CV und Eignung und versuchen Sie es erneut.", "Настройку автоподачи сохранить не удалось. Проверьте Global CV и соответствие, затем повторите попытку.", "تعذر حفظ تفضيل التقديم التلقائي. تحقق من Global CV وحالة الأهلية ثم حاول مجدداً."],
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

  function language() {
    const stored = String(localStorage.getItem("allona.language") || document.documentElement.lang || "tr").toLowerCase();
    return languageCodes.includes(stored) ? stored : "tr";
  }

  function text(key) {
    return translations[language()][key] || translations.tr[key] || key;
  }

  function formatText(key, values) {
    return Object.entries(values || {}).reduce(function (result, entry) {
      return result.replaceAll(`{${entry[0]}}`, String(entry[1] == null ? "" : entry[1]));
    }, text(key));
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
      const documents = nav.querySelector('[data-view-link="documents"]');
      if (!documents) return;

      if (!nav.querySelector('[data-view-link="maritime-cv"]')) {
        const cvLink = document.createElement("a");
        cvLink.className = "maritime-cv-nav";
        cvLink.href = portalUrl("maritime-cv.html");
        cvLink.dataset.viewLink = "maritime-cv";
        cvLink.dataset.portalI18n = "maritimeCvNav";
        cvLink.textContent = text("maritimeCvNav");
        documents.insertAdjacentElement("beforebegin", cvLink);
      }

      if (!nav.querySelector('[data-view-link="smart"]')) {
        const globalCvLink = document.createElement("a");
        globalCvLink.className = "maritime-smart-nav";
        globalCvLink.href = portalUrl("maritime-smart-account.html");
        globalCvLink.dataset.viewLink = "smart";
        globalCvLink.dataset.portalI18n = "smartAccountNav";
        globalCvLink.textContent = text("smartAccountNav");
        documents.insertAdjacentElement("afterend", globalCvLink);
      }
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

  function departmentForRank(rankCode) {
    const rank = String(rankCode || "").trim().toLowerCase();
    if (["master", "chief_officer", "second_officer", "third_officer", "deck_cadet", "bosun", "able_seaman", "ordinary_seaman", "deck_boy"].includes(rank)) return "deck";
    if (["chief_engineer", "second_engineer", "third_engineer", "fourth_engineer", "engine_cadet", "engine_bosun", "able_engine_rating", "motorman", "oiler", "wiper", "fitter", "welder", "pumpman"].includes(rank)) return "engine";
    if (["eto", "electro_technical_rating", "electrician"].includes(rank)) return "electrical";
    if (["chief_cook", "cook", "steward"].includes(rank)) return "hotel";
    return "all";
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
        const requirements = item.matching_requirements && typeof item.matching_requirements === "object" ? item.matching_requirements : {};
        const vessel = requirements.vessel_public_profile && typeof requirements.vessel_public_profile === "object" ? requirements.vessel_public_profile : {};
        return {
          id: item.id,
          smartJobId: item.smart_job_id || null,
          reference: `AH-${String(item.id).slice(0, 8).toUpperCase()}`,
          title: compact(item.title, 140),
          summary: compact(item.summary, 360),
          location: compact(item.location_label, 120) || text("globalRoute"),
          contract: compact(item.detail_label, 120) || text("sixMonths"),
          experienceMonths: Number(requirements.minimum_sea_service_months) || 0,
          salary: requirements.salary && Number(requirements.salary.amount) ? Number(requirements.salary.amount).toLocaleString(localeCodes[language()] || "tr-TR") + " " + compact(requirements.salary.currency, 6) : "",
          joiningDate: compact(requirements.joining_date, 10),
          joiningPort: compact(requirements.joining_port, 120),
          currentPort: compact(requirements.current_port, 120),
          nextPort: compact(requirements.next_port, 120),
          tradingArea: compact(requirements.trading_area_label, 120),
          warRisk: compact(requirements.war_risk_label, 180),
          warRiskStatus: compact(requirements.war_risk_status, 60),
          warRiskNote: compact(requirements.war_risk_note, 240),
          vesselType: compact(vessel.vessel_type, 120),
          vesselFlag: compact(vessel.flag_state, 80),
          vesselDwt: Number(vessel.deadweight) || null,
          vesselGt: Number(vessel.gross_tonnage) || null,
          hasOperationalDetails: Boolean(requirements.joining_date || requirements.salary || requirements.vessel_public_profile),
          department: departmentForRank(requirements.rank_code),
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

  function smartMatchFor(job) {
    if (!job || !job.smartJobId) return null;
    return (smartApplicationState.matches || []).find(function (match) { return match.job_id === job.smartJobId; }) || null;
  }

  function smartDraftFor(job) {
    if (!job || !job.smartJobId) return null;
    return (smartApplicationState.application_drafts || []).find(function (draft) { return draft.job_id === job.smartJobId; }) || null;
  }

  function jobApplicationGate(job) {
    if (!session) return { disabled: false, applied: false, label: "apply", reason: "" };
    const draft = smartDraftFor(job);
    if (draft && draft.status === "submitted") return { disabled: true, applied: true, label: "applied", reason: "" };
    const readiness = smartApplicationState.application_readiness || {};
    if (readiness.has_saved_maritime_cv !== true) {
      return { blocked: true, disabled: false, applied: false, label: "apply", actionLabel: "completeMaritimeCv", reason: text("maritimeCvMissingReason"), href: portalUrl("maritime-cv.html"), tone: "action" };
    }
    if (!job.smartJobId) return { blocked: true, disabled: false, applied: false, label: "apply", reason: text("listingRequirementsPendingReason"), tone: "pending" };
    return { disabled: false, applied: false, label: "apply", reason: "" };
  }

  async function loadSmartApplicationState() {
    smartApplicationState = { run: null, matches: [], application_drafts: [], application_readiness: { documents_state: "unknown", has_saved_maritime_cv: false, has_confirmed_maritime_cv: false } };
    if (!session?.access_token) return smartApplicationState;
    const base = String(App.config && App.config.apiBaseUrl || "https://api.allonahub.com").replace(/\/$/, "");
    try {
      const response = await fetch(`${base}/v1/maritime/smart-account`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${session.access_token}` }
      });
      const payload = await response.json().catch(function () { return {}; });
      if (!response.ok || payload.ok !== true) return smartApplicationState;
      smartApplicationState = {
        run: payload.run || null,
        matches: Array.isArray(payload.matches) ? payload.matches : [],
        application_drafts: Array.isArray(payload.application_drafts) ? payload.application_drafts : [],
        application_readiness: payload.application_readiness || smartApplicationState.application_readiness
      };
    } catch (error) {}
    return smartApplicationState;
  }

  async function smartApplicationApi(path, options) {
    if (!session?.access_token) throw new Error("AUTH_REQUIRED");
    if (!App.cvAccess || typeof App.cvAccess.getDeviceKey !== "function") throw new Error("Güvenli cihaz doğrulaması hazırlanamadı.");
    if (!window.AllonaMaritimePasskey || typeof window.AllonaMaritimePasskey.authorize !== "function") throw new Error("Güvenli cihaz doğrulaması bu tarayıcıda kullanılamıyor.");
    const base = String(App.config && App.config.apiBaseUrl || "https://api.allonahub.com").replace(/\/$/, "");
    const securityHeaders = {
      "X-Allona-Device-Key": await App.cvAccess.getDeviceKey(),
      "X-Allona-Passkey-Proof": await window.AllonaMaritimePasskey.authorize()
    };
    const response = await fetch(`${base}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        ...securityHeaders,
        ...(options?.headers || {})
      }
    });
    const payload = await response.json().catch(function () { return {}; });
    if (!response.ok || payload.ok !== true) {
      const error = new Error(payload.message || "APPLICATION_FAILED");
      error.code = payload.code || payload.error || "";
      throw error;
    }
    smartApplicationState = {
      run: payload.run || smartApplicationState.run,
      matches: Array.isArray(payload.matches) ? payload.matches : smartApplicationState.matches,
      application_drafts: Array.isArray(payload.application_drafts) ? payload.application_drafts : smartApplicationState.application_drafts,
      application_readiness: payload.application_readiness || smartApplicationState.application_readiness
    };
    return payload;
  }

  function jobApplicationAction(job, gate) {
    const icon = gate.applied ? "fa-check" : "fa-paper-plane";
    const content = `<i class="fa-solid ${icon}" aria-hidden="true"></i>${escapeHtml(text(gate.applied ? gate.label : "apply"))}`;
    const consent = gate.applied ? "" : `<label class="maritime-job-consent"><input type="checkbox" data-job-share-consent="${escapeHtml(job.id)}"><span>${escapeHtml(text("shareDocumentsCheckbox"))}</span></label>`;
    return `<button class="maritime-button maritime-button--primary" type="button" data-apply-job="${escapeHtml(job.id)}" ${gate.applied ? "disabled" : ""}>${content}</button>${consent}`;
  }

  function jobCard(job) {
    const gate = jobApplicationGate(job);
    const vesselFacts = [job.vesselType, job.vesselDwt ? job.vesselDwt.toLocaleString(localeCodes[language()] || "tr-TR") + " DWT" : "", job.vesselGt ? job.vesselGt.toLocaleString(localeCodes[language()] || "tr-TR") + " GT" : "", job.vesselFlag].filter(Boolean).join(" · ");
    const highlights = job.hasOperationalDetails ? `<div class="maritime-job-highlights"><strong>${escapeHtml(job.salary || "-")}</strong><span>${escapeHtml(text("minimumExperience"))}: ${escapeHtml(String(job.experienceMonths))} ${escapeHtml(text("months"))}</span><span>${escapeHtml(text("joiningDate"))}: ${escapeHtml(job.joiningDate ? dateLabel(job.joiningDate) : "-")}</span></div>` : "";
    const metadata = job.hasOperationalDetails
      ? `<div class="maritime-job-meta"><span><b>${escapeHtml(text("vesselSpecs"))}</b>${escapeHtml(vesselFacts || "-")}</span><span><b>${escapeHtml(text("contract"))}</b>${escapeHtml(job.contract)}</span><span><b>${escapeHtml(text("route"))}</b>${escapeHtml(job.tradingArea || job.location)}</span><span><b>${escapeHtml(text("joiningPort"))}</b>${escapeHtml(job.joiningPort || "-")}</span><span><b>${escapeHtml(text("currentPort"))}</b>${escapeHtml(job.currentPort || "-")}</span><span><b>${escapeHtml(text("nextPort"))}</b>${escapeHtml(job.nextPort || "-")}</span>${job.warRisk ? `<span class="is-risk"><b>${escapeHtml(text("routeRisk"))}</b>${escapeHtml([job.warRiskStatus === "no_known_listed_area" ? text("noWarZone") : job.warRisk, job.warRiskNote].filter(Boolean).join(" · "))}</span>` : ""}</div>`
      : `<div class="maritime-job-meta"><span><b>${escapeHtml(text("department"))}</b>${escapeHtml(departmentLabel(job.department))}</span><span><b>${escapeHtml(text("contract"))}</b>${escapeHtml(job.contract)}</span><span><b>${escapeHtml(text("route"))}</b>${escapeHtml(job.location)}</span></div>`;
    const matched = session && candidateMatches.find((match) => match.job_id === job.smartJobId && match.rank_compatible === true);
    return `<article class="maritime-job-card" data-job-id="${escapeHtml(job.id)}" data-department="${escapeHtml(job.department)}">
      <div class="maritime-job-head"><div class="maritime-job-title"><span class="maritime-reference">${escapeHtml(job.reference)}</span><h3>${escapeHtml(job.title)}</h3></div><span class="maritime-verified-badge"><i class="fa-solid fa-circle-check" aria-hidden="true"></i>${escapeHtml(text("verifiedCompany"))}</span>${matched ? `<span class="maritime-match-badge">${escapeHtml(text(matched.eligible ? "matchedJobs" : "rankCompatible"))}</span>` : ""}</div>
      ${highlights}
      <p class="maritime-job-description">${escapeHtml(job.summary)}</p>
      ${metadata}
      <div class="maritime-job-actions"><span class="maritime-reference">${escapeHtml(text("companyHidden"))}</span><div class="maritime-job-action-group">${jobApplicationAction(job, gate)}</div></div>
    </article>`;
  }

  function applicationDialogMarkup() {
    return `<dialog class="maritime-application-dialog" data-application-dialog aria-labelledby="maritimeApplicationDialogTitle" aria-describedby="maritimeApplicationDialogMessage"><div class="maritime-application-dialog-shell"><button class="maritime-application-dialog-close" type="button" data-application-dialog-close aria-label="${escapeHtml(text("applicationDialogClose"))}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button><div class="maritime-application-dialog-icon" aria-hidden="true"><i class="fa-solid fa-shield-halved"></i></div><div class="maritime-application-dialog-copy"><span class="maritime-reference">AllonaHub Denizcilik</span><h2 id="maritimeApplicationDialogTitle">${escapeHtml(text("applicationBlockedTitle"))}</h2><p id="maritimeApplicationDialogMessage" data-application-dialog-message></p></div><div class="maritime-application-dialog-actions"><a class="maritime-button maritime-button--primary" href="#" data-application-dialog-action hidden></a><button class="maritime-button" type="button" data-application-dialog-close>${escapeHtml(text("applicationDialogClose"))}</button></div></div></dialog>`;
  }

  function closeApplicationDialog() {
    const dialog = document.querySelector("[data-application-dialog]");
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
  }

  function showApplicationDialog(gate) {
    const dialog = document.querySelector("[data-application-dialog]");
    if (!dialog) return;
    const message = dialog.querySelector("[data-application-dialog-message]");
    const title = dialog.querySelector("#maritimeApplicationDialogTitle");
    if (title) title.textContent = gate.title || text("applicationBlockedTitle");
    const action = dialog.querySelector("[data-application-dialog-action]");
    if (message) message.textContent = gate.reason || text("applicationFailed");
    if (action) {
      if (gate.href) {
        action.href = gate.href;
        action.textContent = text(gate.actionLabel || "refreshEligibility");
        action.hidden = false;
      } else {
        action.hidden = true;
        action.removeAttribute("href");
      }
    }
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function renderJobResults() {
    const grid = document.querySelector("[data-jobs-grid]");
    if (!grid) return;
    const query = compact(new URLSearchParams(window.location.search).get("q"), 80).toLocaleLowerCase(localeCodes[language()] || "tr-TR");
    const filtered = jobs.filter(function (job) {
      const departmentMatch = activeFilter === "all" || job.department === activeFilter;
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
    if (!job) return;
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
    const notice = document.querySelector("[data-jobs-notice]");
    const gate = jobApplicationGate(job);
    if (gate.applied) return;
    if (gate.blocked) {
      showApplicationDialog(gate);
      return;
    }
    const consent = Array.from(document.querySelectorAll("[data-job-share-consent]")).find(function (input) { return input.dataset.jobShareConsent === jobId; });
    if (!consent || !consent.checked) {
      showApplicationDialog({ title: text("shareDocumentsRequiredTitle"), reason: text("shareDocumentsRequired") });
      return;
    }
    if (notice) { notice.textContent = text("applicationSending"); notice.className = "maritime-notice is-visible"; }
    try {
      await smartApplicationApi("/v1/maritime/manual-applications", {
        method: "POST",
        body: JSON.stringify({ job_id: job.smartJobId, share_documents: true })
      });
      await loadSmartApplicationState();
      renderJobResults();
      if (notice) { notice.textContent = text("applicationSaved"); notice.className = "maritime-notice is-visible is-success"; notice.scrollIntoView({ block: "nearest" }); }
    } catch (error) {
      await loadSmartApplicationState();
      renderJobResults();
      const serverMessage = compact(error && error.message, 320);
      showApplicationDialog({ reason: error?.code === "RANK_MISMATCH" ? text("qualificationMismatchTemplate")
        : error?.code === "MARITIME_CV_REQUIRED" ? text("maritimeCvMissingReason")
          : serverMessage && !/^[A-Z0-9_]+$/.test(serverMessage) ? serverMessage : text("applicationFailed") });
    }
  }

  async function renderJobs() {
    candidateMatches = [];
    const [liveJobs] = await Promise.all([loadPublicJobs(), loadSmartApplicationState()]);
    if (session?.access_token && smartApplicationState.run?.status === "user_confirmed") {
      try {
        const base = String(App.config && App.config.apiBaseUrl || "https://api.allonahub.com").replace(/\/$/, "");
        const response = await fetch(`${base}/v1/maritime/smart-account/refresh-matches`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, Accept: "application/json" }
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload.ok === true) {
          smartApplicationState = {
            run: payload.run || smartApplicationState.run,
            matches: Array.isArray(payload.matches) ? payload.matches : [],
            application_drafts: Array.isArray(payload.application_drafts) ? payload.application_drafts : [],
            application_readiness: payload.application_readiness || smartApplicationState.application_readiness
          };
        }
      } catch (error) {
        // The existing eligibility notice remains visible if a refresh is unavailable.
      }
    }
    if (session?.access_token) {
      try {
        const base = String(App.config && App.config.apiBaseUrl || "https://api.allonahub.com").replace(/\/$/, "");
        const response = await fetch(`${base}/v1/maritime/candidate-matches`, {
          headers: { Authorization: `Bearer ${session.access_token}`, Accept: "application/json" }
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload.ok === true && Array.isArray(payload.matches)) candidateMatches = payload.matches;
      } catch (error) {
        // Keep the public listing available if the candidate matching API is unavailable.
      }
    }
    jobs = liveJobs;
    const matchedCount = jobs.filter(function (job) { return candidateMatches.some((match) => match.job_id === job.smartJobId && match.rank_compatible === true); }).length;
    root.innerHTML = `<section class="maritime-toolbar"><div class="maritime-toolbar-copy"><h2>${escapeHtml(text("openJobs"))}</h2><p>${escapeHtml(text("openJobsLead"))}</p></div><div class="maritime-jobs-counters">${session && matchedCount ? `<strong class="maritime-match-counter" aria-label="${escapeHtml(text("rankCompatible"))}: ${matchedCount}">${escapeHtml(text("rankCompatible"))}<span>${matchedCount}</span></strong>` : ""}<strong class="maritime-reference" data-jobs-count></strong></div></section>
      <div class="maritime-filter-rail" role="toolbar" aria-label="${escapeHtml(text("openJobs"))}">${[["all", "filterAll"], ["deck", "filterDeck"], ["engine", "filterEngine"], ["electrical", "filterElectrical"], ["hotel", "filterHotel"]].map(function (item) { return `<button type="button" data-job-filter="${item[0]}" aria-pressed="${item[0] === activeFilter}">${escapeHtml(text(item[1]))}</button>`; }).join("")}</div>
      <div class="maritime-notice" role="status" aria-live="polite" data-jobs-notice></div><section class="maritime-job-grid" data-jobs-grid></section>${applicationDialogMarkup()}`;
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
      let result = await App.supabase.from("maritime_hiring_applications").select("id,job_id,status,submission_mode,submitted_at,updated_at,metadata").eq("seafarer_user_id", userId()).order("created_at", { ascending: false }).limit(100);
      if (result.error && /submission_mode/i.test(String(result.error.message || ""))) {
        result = await App.supabase.from("maritime_hiring_applications").select("id,job_id,status,submitted_at,updated_at,metadata").eq("seafarer_user_id", userId()).order("created_at", { ascending: false }).limit(100);
      }
      if (result.error) return [];
      return (result.data || []).map(function (item) {
        const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
        const submissionMode = item.submission_mode === "automatic" || metadata.application_mode === "automatic" ? "automatic" : "manual";
        return { id: item.id, job_id: item.job_id, job_title: compact(metadata.job_title, 140) || text("genericPosition"), job_reference: compact(metadata.job_reference, 40) || `AH-${String(item.job_id).slice(0, 8).toUpperCase()}`, status: item.status, submission_mode: submissionMode, applied_at: item.submitted_at || item.updated_at, location: compact(metadata.location_label, 120), contract: compact(metadata.detail_label, 120) };
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
    const rows = remote;
    if (!rows.length) {
      root.innerHTML = `<section class="maritime-empty"><div><i class="fa-solid fa-clipboard-list" aria-hidden="true"></i><h2>${escapeHtml(text("noApplicationsTitle"))}</h2><p>${escapeHtml(text("noApplicationsLead"))}</p><a class="maritime-button maritime-button--primary" href="${escapeHtml(portalUrl("maritime-jobs.html"))}">${escapeHtml(text("browseJobs"))}</a></div></section>`;
      return;
    }
    const reviewing = rows.filter(function (item) { return ["submitted", "drafted", "awaiting_candidate_approval", "shortlisted", "interviewing"].includes(item.status); }).length;
    const accepted = rows.filter(function (item) { return ["offer_sent", "offer_accepted", "hired"].includes(item.status); }).length;
    root.innerHTML = `<section class="maritime-summary-strip"><article><strong>${rows.length}</strong><span>${escapeHtml(text("totalApplications"))}</span></article><article><strong>${reviewing}</strong><span>${escapeHtml(text("reviewing"))}</span></article><article><strong>${accepted}</strong><span>${escapeHtml(text("accepted"))}</span></article></section><section class="maritime-record-grid">${rows.map(function (item) { const statusKey = applicationStatusKey(item.status); const automaticBadge = item.submission_mode === "automatic" ? `<span class="maritime-application-mode"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>${escapeHtml(text("automaticApplicationSubmitted"))}</span>` : ""; return `<article class="maritime-record-card"><div class="maritime-record-head"><div><span class="maritime-reference">${escapeHtml(item.job_reference || "")}</span><h3>${escapeHtml(item.job_title || text("genericPosition"))}</h3></div><div class="maritime-record-badges">${automaticBadge}<span class="maritime-status-badge" data-status="${escapeHtml(item.status)}">${escapeHtml(text(statusKey))}</span></div></div><p>${escapeHtml(text("applicationFor"))}</p><div class="maritime-record-meta"><span><b>${escapeHtml(text("appliedAt"))}</b>${escapeHtml(dateLabel(item.applied_at))}</span><span><b>${escapeHtml(text("statusLabel"))}</b>${escapeHtml(text(statusKey))}</span><span><b>${escapeHtml(text("route"))}</b>${escapeHtml(item.location || text("globalRoute"))}</span></div></article>`; }).join("")}</section>`;
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
    const rows = remote;
    if (!rows.length) {
      root.innerHTML = `<section class="maritime-section-heading"><h2>${escapeHtml(text("offersTitle"))}</h2><p>${escapeHtml(text("offersPrivacy"))}</p></section><section class="maritime-empty"><div><i class="fa-solid fa-envelope-open" aria-hidden="true"></i><h2>${escapeHtml(text("noOffersTitle"))}</h2><p>${escapeHtml(text("noOffersLead"))}</p><a class="maritime-button" href="${escapeHtml(portalUrl("maritime-applications.html"))}">${escapeHtml(text("applicationsNav"))}</a></div></section>`;
      return;
    }
    root.innerHTML = `<section class="maritime-section-heading"><h2>${escapeHtml(text("offersTitle"))}</h2><p>${escapeHtml(text("offersPrivacy"))}</p></section><section class="maritime-record-grid">${rows.map(function (item) { const visible = item.company_contact_visible === true; return `<article class="maritime-record-card"><div class="maritime-record-head"><div><span class="maritime-reference">${escapeHtml(item.job_reference || "")}</span><h3>${escapeHtml(item.job_title || text("genericPosition"))}</h3></div><span class="maritime-status-badge" data-status="${escapeHtml(item.offer_status || "sent")}">${escapeHtml(text("offerSent"))}</span></div><div class="maritime-record-meta"><span><b>${escapeHtml(text("offerStatus"))}</b>${escapeHtml(text("offerSent"))}</span><span><b>${escapeHtml(text("appliedAt"))}</b>${escapeHtml(dateLabel(item.created_at || item.updated_at))}</span></div><div class="maritime-offer-contact"><strong>${escapeHtml(visible && item.company_name ? item.company_name : text("contactHidden"))}</strong>${visible ? `<p>${escapeHtml([item.company_email, item.company_phone].filter(Boolean).join(" · "))}</p>` : ""}</div></article>`; }).join("")}</section>`;
  }

  async function loadAutoPreference() {
    autoPreferenceState = { enabled: false, updated_at: null };
    if (!session?.access_token) return autoPreferenceState;
    const base = String(App.config && App.config.apiBaseUrl || "https://api.allonahub.com").replace(/\/$/, "");
    try {
      const response = await fetch(`${base}/v1/maritime/auto-apply`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${session.access_token}` }
      });
      const payload = await response.json().catch(function () { return {}; });
      if (!response.ok || payload.ok !== true) throw new Error(payload.message || "AUTO_APPLY_LOAD_FAILED");
      autoPreferenceState = payload.preference || autoPreferenceState;
    } catch (error) {
      autoPreferenceState.load_error = true;
    }
    return autoPreferenceState;
  }

  async function renderAuto() {
    if (!session) return authGate();
    const preference = await loadAutoPreference();
    const noticeKey = preference.load_error ? "autoSaveFailed" : preference.updated_at ? (preference.enabled ? "autoSaved" : "autoPaused") : "";
    root.innerHTML = `<section class="maritime-auto-layout"><div class="maritime-auto-copy"><h2>${escapeHtml(text("autoHeading"))}</h2><p>${escapeHtml(text("autoDescription"))}</p><div class="maritime-readiness-list"><div class="maritime-readiness-item"><i class="fa-solid fa-user-check" aria-hidden="true"></i><span><strong>${escapeHtml(text("profileReady"))}</strong><small>${escapeHtml(text("profileReadyDesc"))}</small></span><span class="maritime-readiness-state">${escapeHtml(text("pendingCheck"))}</span></div><div class="maritime-readiness-item"><i class="fa-solid fa-file-lines" aria-hidden="true"></i><span><strong>${escapeHtml(text("maritimeCv"))}</strong><small>${escapeHtml(text("maritimeCvDesc"))}</small></span><span class="maritime-readiness-state">${escapeHtml(text("pendingCheck"))}</span></div><div class="maritime-readiness-item"><i class="fa-solid fa-passport" aria-hidden="true"></i><span><strong>${escapeHtml(text("globalPassport"))}</strong><small>${escapeHtml(text("globalPassportDesc"))}</small></span><span class="maritime-readiness-state">${escapeHtml(text("pendingCheck"))}</span></div></div></div><aside class="maritime-auto-control"><h2>${escapeHtml(text("autoControlTitle"))}</h2><p>${escapeHtml(text("autoControlLead"))}</p><button class="maritime-button maritime-button--primary" type="button" data-auto-toggle aria-pressed="${preference.enabled === true}"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>${escapeHtml(text(preference.enabled === true ? "disableAuto" : "enableAuto"))}</button><a class="maritime-button" href="${escapeHtml(portalUrl("maritime-smart-account.html"))}">${escapeHtml(text("prepareCv"))}</a><div class="maritime-notice ${noticeKey ? "is-visible" : ""} ${preference.load_error ? "is-error" : preference.updated_at ? "is-success" : ""}" role="status" aria-live="polite" data-auto-notice>${noticeKey ? escapeHtml(text(noticeKey)) : ""}</div></aside></section>`;
  }

  async function toggleAutoPreference(button) {
    const notice = document.querySelector("[data-auto-notice]");
    const nextEnabled = autoPreferenceState.enabled !== true;
    button.disabled = true;
    if (notice) {
      notice.textContent = text("autoSaving");
      notice.className = "maritime-notice is-visible";
    }
    try {
      const payload = await smartApplicationApi("/v1/maritime/auto-apply", {
        method: "POST",
        body: JSON.stringify({ enabled: nextEnabled, confirmation: true })
      });
      autoPreferenceState = payload.preference || { enabled: nextEnabled, updated_at: new Date().toISOString() };
      await renderAuto();
    } catch (error) {
      button.disabled = false;
      if (notice) {
        const serverMessage = compact(error && error.message, 320);
        notice.textContent = serverMessage && !/^[A-Z0-9_]+$/.test(serverMessage) ? serverMessage : text("autoSaveFailed");
        notice.className = "maritime-notice is-visible is-error";
      }
    }
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
          ${accountAction(portalUrl("maritime-cv.html"), "fa-pen-to-square", "maritimeCvNav", "maritime-account-action--smart")}
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
        const saved = await App.supabase.from("profiles").update({ avatar_url: avatarUrl })
          .eq("id", userId()).select("id").maybeSingle();
        if (saved.error || !saved.data) throw saved.error || new Error("profile_unavailable");
        const result = await App.supabase.auth.updateUser({ data: { avatar_url: null, avatar: null } });
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
      if (event.target.closest("[data-application-dialog-close]")) {
        closeApplicationDialog();
        return;
      }
      const applicationDialog = event.target.closest("[data-application-dialog]");
      if (applicationDialog && event.target === applicationDialog) {
        closeApplicationDialog();
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
        toggleAutoPreference(toggle);
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
    if (view === "account" && session && context && context.type === "partner") {
      const destination = App.auth && App.auth.accountHome
        ? App.auth.accountHome(context.type, context)
        : "/pages/partner/maripartner.html";
      window.location.replace(destination);
      return;
    }
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
    else if (view === "auto") await renderAuto();
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
