(function () {
  "use strict";

  const coreKeys = [
    "back", "home", "module", "searchAria", "searchPlaceholder", "search", "title", "lead",
    "mfaTitle", "mfaDesc", "cloudflareTitle", "cloudflareDesc", "approvalTitle", "approvalDesc", "tabsAria", "loginTab", "forgotTab",
    "applyTab", "email", "password", "loginButton", "googleLogin", "forgotDesc", "resetButton",
    "backLogin", "companyName", "contactName", "phone", "taxNumber", "taxOffice", "companyTypeSelect", "website",
    "city", "country", "sectorSelect", "businessDesc", "submit", "clear", "lookup", "citySelect",
    "other", "loading", "submitting", "loggingIn", "challengeLogin", "challengeLookup", "challengeApply"
  ];

  const packs = {
    tr: {
      core: [
        "Geri Dön", "Ana Sayfa", "Modüle Dön", "Partner araması", "Partner hesabı, başvuru veya destek ara...", "Ara",
        "Partner Girişi", "Mevcut partnerler giriş yapabilir, yeni işletmeler başvuru oluşturabilir.",
        "MFA Zorunlu", "Partner panel erişimi iki aşamalı doğrulama ile korunur.", "Cloudflare Kontrolü", "Giriş ve başvuru robot doğrulamasından geçer.", "Onaylı Yayın",
        "Başvurular admin kontrolü sonrası aktif edilir.", "Partner giriş, şifre sıfırlama ve başvuru sekmeleri",
        "Giriş", "Şifremi Unuttum", "Başvuru", "E-posta", "Şifre", "Partner Paneline Giriş", "Google ile Giriş",
        "Partner hesabına kayıtlı e-posta adresini yaz; şifre yenileme bağlantısını güvenli şekilde gönderelim.",
        "Şifre Sıfırlama Linki Gönder", "Girişe Dön", "Firma / İşletme Adı", "Yetkili Ad Soyad", "Telefon numarası",
        "Vergi / VAT Numarası", "Vergi Dairesi", "Şirket Türü Seç", "Web Sitesi (opsiyonel)", "İl / Şehir",
        "Ülke", "Sektör Seç", "Kısa açıklama: İşletmeniz ne yapıyor? Hangi ürün/hizmetleri sunacaksınız?",
        "Başvuruyu Gönder", "Tümünü Temizle", "Bilgileri Getir", "İl / Şehir seç", "Diğer",
        "Sorgulanıyor...", "Gönderiliyor...", "Giriş yapılıyor...", "Giriş için robot olmadığınızı doğrulayın.", "Şirket bilgisi sorgusu için robot olmadığınızı doğrulayın.", "Başvuru için robot olmadığınızı doğrulayın."
      ],
      companyTypes: ["Şahıs Şirketi", "Limited Şirket", "Anonim Şirket", "Kooperatif", "Dernek / Vakıf", "Bireysel Hizmet Sağlayıcı"],
      sectors: [
        "AllonaHub / E-Ticaret", "Restoran & Yemek", "Market", "Kurye & Lojistik", "Taksi & Ulaşım",
        "Sağlık & Klinik", "Eczane", "Güzellik & Kozmetik", "Spor & Fitness", "Hukuk & Danışmanlık",
        "İK & Kariyer", "Denizcilik / Maritime", "Eğitim", "Finans", "Seyahat & Turizm", "Otel & Konaklama",
        "Gayrimenkul", "Otomotiv", "Etkinlik & Eğlence", "Ev Hizmetleri", "Petshop & Evcil Hayvan",
        "Mobilya & Dekorasyon", "Teknoloji & Elektronik", "Moda & Giyim", "Takı & Aksesuar", "Anne & Çocuk",
        "Kitap & Kırtasiye", "Sanat & Tasarım", "Yapı Market & Tadilat", "Diğer Hizmetler"
      ]
    },
    az: {
      core: [
        "Geri qayıt", "Ana səhifə", "Modula qayıt", "Partner axtarışı", "Partner hesabı, müraciət və ya dəstək axtar...", "Axtar",
        "Partner girişi", "Mövcud partnerlər daxil ola, yeni müəssisələr müraciət yarada bilər.",
        "MFA məcburidir", "Partner panelinə giriş iki mərhələli doğrulama ilə qorunur.", "Cloudflare yoxlaması", "Giriş və müraciət robot yoxlamasından keçir.", "Təsdiqli yayım",
        "Müraciətlər admin yoxlamasından sonra aktiv edilir.", "Partner girişi, şifrə yeniləmə və müraciət bölmələri",
        "Giriş", "Şifrəmi unutdum", "Müraciət", "E-poçt", "Şifrə", "Partner panelinə giriş", "Google ilə giriş",
        "Partner hesabında qeydiyyatda olan e-poçtu yazın; şifrə yeniləmə linkini təhlükəsiz göndərək.",
        "Şifrə yeniləmə linkini göndər", "Girişə qayıt", "Şirkət / müəssisə adı", "Səlahiyyətli şəxsin adı və soyadı", "Telefon nömrəsi",
        "Vergi / VAT nömrəsi", "Vergi idarəsi", "Şirkət növünü seç", "Veb sayt (istəyə bağlı)", "Şəhər",
        "Ölkə", "Sektoru seç", "Qısa məlumat: Müəssisəniz nə edir? Hansı məhsul və xidmətləri təqdim edəcəksiniz?",
        "Müraciəti göndər", "Hamısını təmizlə", "Məlumatları gətir", "Şəhər seç", "Digər",
        "Sorğulanır...", "Göndərilir...", "Giriş edilir...", "Giriş üçün robot olmadığınızı doğrulayın.", "Şirkət məlumatı sorğusu üçün robot olmadığınızı doğrulayın.", "Müraciət üçün robot olmadığınızı doğrulayın."
      ],
      companyTypes: ["Fərdi sahibkar", "Məhdud məsuliyyətli cəmiyyət", "Səhmdar cəmiyyəti", "Kooperativ", "Assosiasiya / Fond", "Fərdi xidmət təminatçısı"],
      sectors: [
        "AllonaHub / E-ticarət", "Restoran və yemək", "Market", "Kuryer və logistika", "Taksi və nəqliyyat",
        "Səhiyyə və klinika", "Aptek", "Gözəllik və kosmetika", "İdman və fitnes", "Hüquq və məsləhət",
        "İnsan resursları və karyera", "Dənizçilik", "Təhsil", "Maliyyə", "Səyahət və turizm", "Otel və yerləşmə",
        "Daşınmaz əmlak", "Avtomobil", "Tədbir və əyləncə", "Ev xidmətləri", "Heyvan mağazası",
        "Mebel və dekorasiya", "Texnologiya və elektronika", "Moda və geyim", "Zinət əşyaları və aksesuar", "Ana və uşaq",
        "Kitab və dəftərxana", "İncəsənət və dizayn", "Tikinti materialları və təmir", "Digər xidmətlər"
      ]
    },
    en: {
      core: [
        "Go Back", "Home", "Back to Module", "Partner search", "Search partner account, application or support...", "Search",
        "Partner Login", "Existing partners can sign in and new businesses can submit an application.",
        "MFA Required", "Partner panel access is protected with two-factor authentication.", "Cloudflare Check", "Login and application are protected by bot verification.", "Approved Publishing",
        "Applications are activated after admin review.", "Partner login, password reset and application tabs",
        "Login", "Forgot Password", "Application", "Email", "Password", "Enter Partner Panel", "Sign in with Google",
        "Enter the email registered to your partner account; we will securely send a password reset link.",
        "Send Password Reset Link", "Back to Login", "Company / Business Name", "Authorized Full Name", "Phone number", "Tax / VAT Number",
        "Tax Office", "Select Company Type", "Website (optional)", "City", "Country", "Select Sector",
        "Short description: What does your business do? Which products or services will you offer?",
        "Submit Application", "Clear All", "Retrieve Details", "Select City", "Other", "Checking...", "Sending...", "Signing in...", "Confirm that you are not a robot to sign in.", "Confirm that you are not a robot for the company lookup.", "Confirm that you are not a robot to submit the application."
      ],
      companyTypes: ["Sole Proprietorship", "Limited Company", "Joint Stock Company", "Cooperative", "Association / Foundation", "Independent Service Provider"],
      sectors: [
        "AllonaHub / E-Commerce", "Restaurant & Food", "Grocery", "Courier & Logistics", "Taxi & Transportation",
        "Health & Clinic", "Pharmacy", "Beauty & Cosmetics", "Sports & Fitness", "Legal & Consulting",
        "HR & Careers", "Maritime", "Education", "Finance", "Travel & Tourism", "Hotel & Accommodation",
        "Real Estate", "Automotive", "Events & Entertainment", "Home Services", "Pet Shop & Pets",
        "Furniture & Decoration", "Technology & Electronics", "Fashion & Clothing", "Jewelry & Accessories", "Mother & Child",
        "Books & Stationery", "Art & Design", "Building Supplies & Renovation", "Other Services"
      ]
    },
    de: {
      core: [
        "Zurück", "Startseite", "Zurück zum Modul", "Partnersuche", "Partnerkonto, Bewerbung oder Support suchen...", "Suchen",
        "Partner-Login", "Bestehende Partner können sich anmelden, neue Unternehmen können sich bewerben.",
        "MFA erforderlich", "Der Zugang zum Partnerbereich ist durch Zwei-Faktor-Authentifizierung geschützt.", "Cloudflare-Prüfung", "Anmeldung und Bewerbung werden durch eine Bot-Prüfung geschützt.", "Freigeschaltete Veröffentlichung",
        "Bewerbungen werden nach der Prüfung durch das Admin-Team aktiviert.", "Partner-Login, Passwort-Reset und Bewerbung",
        "Anmelden", "Passwort vergessen", "Bewerbung", "E-Mail", "Passwort", "Zum Partnerbereich", "Mit Google anmelden",
        "Geben Sie die E-Mail Ihres Partnerkontos ein; wir senden den Link zum Zurücksetzen sicher zu.",
        "Link zum Zurücksetzen senden", "Zurück zur Anmeldung", "Firmen- / Geschäftsname", "Name der verantwortlichen Person", "Telefonnummer",
        "Steuer- / USt-Nummer", "Finanzamt", "Unternehmensform wählen", "Website (optional)", "Stadt", "Land", "Branche wählen",
        "Kurzbeschreibung: Was macht Ihr Unternehmen? Welche Produkte oder Dienstleistungen bieten Sie an?",
        "Bewerbung senden", "Alles löschen", "Daten abrufen", "Stadt wählen", "Sonstige", "Wird geprüft...", "Wird gesendet...", "Anmeldung läuft...", "Bestätigen Sie für die Anmeldung, dass Sie kein Roboter sind.", "Bestätigen Sie für die Firmensuche, dass Sie kein Roboter sind.", "Bestätigen Sie für die Bewerbung, dass Sie kein Roboter sind."
      ],
      companyTypes: ["Einzelunternehmen", "Gesellschaft mit beschränkter Haftung", "Aktiengesellschaft", "Genossenschaft", "Verein / Stiftung", "Selbstständiger Dienstleister"],
      sectors: [
        "AllonaHub / E-Commerce", "Restaurant & Essen", "Lebensmittelmarkt", "Kurier & Logistik", "Taxi & Verkehr",
        "Gesundheit & Klinik", "Apotheke", "Beauty & Kosmetik", "Sport & Fitness", "Recht & Beratung",
        "Personal & Karriere", "Schifffahrt", "Bildung", "Finanzen", "Reisen & Tourismus", "Hotel & Unterkunft",
        "Immobilien", "Automobil", "Veranstaltungen & Unterhaltung", "Haushaltsdienste", "Tierbedarf & Haustiere",
        "Möbel & Dekoration", "Technologie & Elektronik", "Mode & Bekleidung", "Schmuck & Accessoires", "Mutter & Kind",
        "Bücher & Schreibwaren", "Kunst & Design", "Baumarkt & Renovierung", "Weitere Dienstleistungen"
      ]
    },
    ru: {
      core: [
        "Назад", "Главная", "Вернуться в модуль", "Поиск партнёра", "Поиск аккаунта партнёра, заявки или поддержки...", "Поиск",
        "Вход для партнёров", "Действующие партнёры могут войти, а новые компании могут подать заявку.",
        "MFA обязательно", "Доступ к панели партнёра защищён двухфакторной аутентификацией.", "Проверка Cloudflare", "Вход и подача заявки защищены проверкой от роботов.", "Публикация после одобрения",
        "Заявки активируются после проверки администратором.", "Вход партнёра, сброс пароля и подача заявки",
        "Вход", "Забыли пароль", "Заявка", "Эл. почта", "Пароль", "Войти в панель партнёра", "Войти через Google",
        "Введите e-mail партнёрского аккаунта; мы безопасно отправим ссылку для сброса пароля.",
        "Отправить ссылку для сброса", "Вернуться ко входу", "Название компании", "ФИО ответственного", "Номер телефона",
        "Налоговый номер / VAT", "Налоговая инспекция", "Выберите тип компании", "Веб-сайт (необязательно)", "Город", "Страна", "Выберите отрасль",
        "Кратко опишите компанию: чем она занимается и какие товары или услуги предлагает?",
        "Отправить заявку", "Очистить всё", "Получить данные", "Выберите город", "Другое", "Проверка...", "Отправка...", "Выполняется вход...", "Подтвердите, что вы не робот, чтобы войти.", "Подтвердите, что вы не робот, для поиска компании.", "Подтвердите, что вы не робот, чтобы отправить заявку."
      ],
      companyTypes: ["Индивидуальный предприниматель", "Общество с ограниченной ответственностью", "Акционерное общество", "Кооператив", "Ассоциация / Фонд", "Частный поставщик услуг"],
      sectors: [
        "AllonaHub / Электронная торговля", "Ресторан и питание", "Продуктовый магазин", "Курьер и логистика", "Такси и транспорт",
        "Здоровье и клиника", "Аптека", "Красота и косметика", "Спорт и фитнес", "Право и консалтинг",
        "HR и карьера", "Морское дело", "Образование", "Финансы", "Путешествия и туризм", "Отель и размещение",
        "Недвижимость", "Автомобили", "Мероприятия и развлечения", "Домашние услуги", "Зоомагазин и питомцы",
        "Мебель и декор", "Технологии и электроника", "Мода и одежда", "Украшения и аксессуары", "Мать и ребёнок",
        "Книги и канцтовары", "Искусство и дизайн", "Стройматериалы и ремонт", "Другие услуги"
      ]
    },
    ar: {
      core: [
        "رجوع", "الصفحة الرئيسية", "العودة إلى الوحدة", "بحث الشركاء", "ابحث عن حساب شريك أو طلب أو دعم...", "بحث",
        "دخول الشريك", "يمكن للشركاء الحاليين تسجيل الدخول ويمكن للأنشطة الجديدة تقديم طلب.",
        "المصادقة المتعددة إلزامية", "دخول لوحة الشريك محمي بالمصادقة الثنائية.", "تحقق Cloudflare", "تسجيل الدخول والطلب محميان بالتحقق من الروبوت.", "نشر بعد الموافقة",
        "يتم تفعيل الطلبات بعد مراجعة الإدارة.", "تبويبات دخول الشريك وإعادة كلمة المرور والطلب",
        "دخول", "نسيت كلمة المرور", "طلب", "البريد الإلكتروني", "كلمة المرور", "دخول لوحة الشريك", "الدخول عبر Google",
        "أدخل البريد المسجل في حساب الشريك لنرسل رابط إعادة تعيين كلمة المرور بأمان.",
        "إرسال رابط إعادة التعيين", "العودة إلى الدخول", "اسم الشركة / النشاط", "اسم المسؤول الكامل", "رقم الهاتف",
        "الرقم الضريبي / VAT", "مكتب الضرائب", "اختر نوع الشركة", "الموقع الإلكتروني (اختياري)", "المدينة", "الدولة", "اختر القطاع",
        "وصف مختصر: ماذا يقدم نشاطك؟ وما المنتجات أو الخدمات التي ستعرضها؟",
        "إرسال الطلب", "مسح الكل", "جلب البيانات", "اختر المدينة", "أخرى", "جارٍ التحقق...", "جارٍ الإرسال...", "جارٍ الدخول...", "أكد أنك لست روبوتًا لتسجيل الدخول.", "أكد أنك لست روبوتًا للبحث عن بيانات الشركة.", "أكد أنك لست روبوتًا لإرسال الطلب."
      ],
      companyTypes: ["منشأة فردية", "شركة محدودة المسؤولية", "شركة مساهمة", "تعاونية", "جمعية / مؤسسة", "مقدم خدمة مستقل"],
      sectors: [
        "AllonaHub / التجارة الإلكترونية", "مطعم وطعام", "بقالة", "توصيل وخدمات لوجستية", "تاكسي ونقل",
        "صحة وعيادة", "صيدلية", "جمال ومستحضرات تجميل", "رياضة ولياقة", "قانون واستشارات",
        "موارد بشرية ومسار مهني", "الملاحة البحرية", "تعليم", "تمويل", "سفر وسياحة", "فندق وإقامة",
        "عقارات", "سيارات", "فعاليات وترفيه", "خدمات منزلية", "متجر حيوانات أليفة",
        "أثاث وديكور", "تقنية وإلكترونيات", "أزياء وملابس", "مجوهرات وإكسسوارات", "الأم والطفل",
        "كتب وقرطاسية", "فن وتصميم", "مواد بناء وتجديد", "خدمات أخرى"
      ]
    },
    kk: {
      core: [
        "Артқа", "Басты бет", "Модульге оралу", "Серіктес іздеу", "Серіктес тіркелгісін, өтінімді немесе қолдауды іздеу...", "Іздеу",
        "Серіктес кіруі", "Қазіргі серіктестер кіре алады, жаңа компаниялар өтінім бере алады.",
        "MFA міндетті", "Серіктес панеліне кіру екі факторлы растаумен қорғалған.", "Cloudflare тексеруі", "Кіру және өтінім робот тексеруімен қорғалған.", "Мақұлданған жариялау",
        "Өтінімдер әкімші тексергеннен кейін іске қосылады.", "Серіктес кіруі, құпия сөзді қалпына келтіру және өтінім бөлімдері",
        "Кіру", "Құпия сөзді ұмыттым", "Өтінім", "E-mail", "Құпия сөз", "Серіктес панеліне кіру", "Google арқылы кіру",
        "Серіктес тіркелгісіндегі e-mail мекенжайын енгізіңіз; қалпына келтіру сілтемесін қауіпсіз жібереміз.",
        "Қалпына келтіру сілтемесін жіберу", "Кіруге оралу", "Компания / кәсіпорын атауы", "Жауапты адамның аты-жөні", "Телефон нөмірі",
        "Салық / VAT нөмірі", "Салық басқармасы", "Компания түрін таңдаңыз", "Веб-сайт (міндетті емес)", "Қала", "Ел", "Саланы таңдаңыз",
        "Қысқаша сипаттама: Компанияңыз немен айналысады және қандай өнім не қызмет ұсынады?",
        "Өтінімді жіберу", "Барлығын тазалау", "Деректерді алу", "Қаланы таңдаңыз", "Басқа", "Тексерілуде...", "Жіберілуде...", "Кіру орындалуда...", "Кіру үшін робот емес екеніңізді растаңыз.", "Компания деректерін іздеу үшін робот емес екеніңізді растаңыз.", "Өтінім беру үшін робот емес екеніңізді растаңыз."
      ],
      companyTypes: ["Жеке кәсіпкер", "Жауапкершілігі шектеулі серіктестік", "Акционерлік қоғам", "Кооператив", "Қауымдастық / Қор", "Жеке қызмет көрсетуші"],
      sectors: [
        "AllonaHub / Электрондық сауда", "Мейрамхана және тағам", "Маркет", "Курьер және логистика", "Такси және көлік",
        "Денсаулық және клиника", "Дәріхана", "Сұлулық және косметика", "Спорт және фитнес", "Құқық және кеңес беру",
        "HR және мансап", "Теңіз ісі", "Білім", "Қаржы", "Саяхат және туризм", "Қонақүй және тұру",
        "Жылжымайтын мүлік", "Автокөлік", "Іс-шара және ойын-сауық", "Үй қызметтері", "Үй жануарлары дүкені",
        "Жиһаз және безендіру", "Технология және электроника", "Сән және киім", "Зергерлік бұйымдар", "Ана және бала",
        "Кітап және кеңсе тауарлары", "Өнер және дизайн", "Құрылыс және жөндеу", "Басқа қызметтер"
      ]
    },
    uz: {
      core: [
        "Orqaga", "Bosh sahifa", "Modulga qaytish", "Hamkor qidiruvi", "Hamkor hisobi, ariza yoki yordamni qidiring...", "Qidirish",
        "Hamkor kirishi", "Amaldagi hamkorlar kirishi, yangi korxonalar esa ariza yuborishi mumkin.",
        "MFA majburiy", "Hamkor paneliga kirish ikki bosqichli tasdiqlash bilan himoyalangan.", "Cloudflare tekshiruvi", "Kirish va ariza robot tekshiruvi bilan himoyalangan.", "Tasdiqlangan nashr",
        "Arizalar administrator tekshiruvidan keyin faollashtiriladi.", "Hamkor kirishi, parolni tiklash va ariza bo'limlari",
        "Kirish", "Parolni unutdim", "Ariza", "E-pochta", "Parol", "Hamkor paneliga kirish", "Google bilan kirish",
        "Hamkor hisobida ro'yxatdan o'tgan e-pochtani kiriting; parolni tiklash havolasini xavfsiz yuboramiz.",
        "Tiklash havolasini yuborish", "Kirishga qaytish", "Kompaniya / korxona nomi", "Mas'ul shaxsning ism-familiyasi", "Telefon raqami",
        "Soliq / VAT raqami", "Soliq idorasi", "Kompaniya turini tanlang", "Veb-sayt (ixtiyoriy)", "Shahar", "Mamlakat", "Sohani tanlang",
        "Qisqa tavsif: Korxonangiz nima qiladi va qanday mahsulot yoki xizmatlarni taklif etadi?",
        "Arizani yuborish", "Barchasini tozalash", "Ma'lumotlarni olish", "Shaharni tanlang", "Boshqa", "Tekshirilmoqda...", "Yuborilmoqda...", "Kirilmoqda...", "Kirish uchun robot emasligingizni tasdiqlang.", "Kompaniya ma'lumotlarini qidirish uchun robot emasligingizni tasdiqlang.", "Ariza yuborish uchun robot emasligingizni tasdiqlang."
      ],
      companyTypes: ["Yakka tartibdagi tadbirkor", "Mas'uliyati cheklangan jamiyat", "Aksiyadorlik jamiyati", "Kooperativ", "Uyushma / Jamg'arma", "Mustaqil xizmat ko'rsatuvchi"],
      sectors: [
        "AllonaHub / Elektron savdo", "Restoran va ovqat", "Market", "Kuryer va logistika", "Taksi va transport",
        "Sog'liq va klinika", "Dorixona", "Go'zallik va kosmetika", "Sport va fitnes", "Huquq va maslahat",
        "HR va karyera", "Dengizchilik", "Ta'lim", "Moliya", "Sayohat va turizm", "Mehmonxona va turar joy",
        "Ko'chmas mulk", "Avtomobil", "Tadbir va ko'ngilochar", "Uy xizmatlari", "Uy hayvonlari do'koni",
        "Mebel va bezak", "Texnologiya va elektronika", "Moda va kiyim", "Zargarlik va aksessuar", "Ona va bola",
        "Kitob va kanselyariya", "San'at va dizayn", "Qurilish mollari va ta'mirlash", "Boshqa xizmatlar"
      ]
    },
    ky: {
      core: [
        "Артка", "Башкы бет", "Модулга кайтуу", "Өнөктөш издөө", "Өнөктөш аккаунтун, арызды же колдоону издеңиз...", "Издөө",
        "Өнөктөш кирүүсү", "Учурдагы өнөктөштөр кире алат, жаңы ишканалар арыз бере алат.",
        "MFA милдеттүү", "Өнөктөш панелине кирүү эки факторлуу текшерүү менен корголот.", "Cloudflare текшерүүсү", "Кирүү жана арыз робот текшерүүсү менен корголот.", "Бекитилген жарыялоо",
        "Арыздар администратор текшергенден кийин иштетилет.", "Өнөктөш кирүүсү, сырсөздү калыбына келтирүү жана арыз бөлүмдөрү",
        "Кирүү", "Сырсөздү унуттум", "Арыз", "E-mail", "Сырсөз", "Өнөктөш панелине кирүү", "Google менен кирүү",
        "Өнөктөш аккаунтундагы e-mail дарегин киргизиңиз; калыбына келтирүү шилтемесин коопсуз жөнөтөбүз.",
        "Калыбына келтирүү шилтемесин жөнөтүү", "Кирүүгө кайтуу", "Компания / ишкананын аталышы", "Жооптуу адамдын аты-жөнү", "Телефон номери",
        "Салык / VAT номери", "Салык кызматы", "Компаниянын түрүн тандаңыз", "Веб-сайт (милдеттүү эмес)", "Шаар", "Өлкө", "Тармакты тандаңыз",
        "Кыскача сүрөттөмө: Ишканаңыз эмне кылат жана кандай өнүм же кызмат сунуштайт?",
        "Арызды жөнөтүү", "Баарын тазалоо", "Маалыматтарды алуу", "Шаарды тандаңыз", "Башка", "Текшерилүүдө...", "Жөнөтүлүүдө...", "Кирүү аткарылууда...", "Кирүү үчүн робот эмес экениңизди ырастаңыз.", "Компания маалыматын издөө үчүн робот эмес экениңизди ырастаңыз.", "Арыз жөнөтүү үчүн робот эмес экениңизди ырастаңыз."
      ],
      companyTypes: ["Жеке ишкер", "Жоопкерчилиги чектелген коом", "Акционердик коом", "Кооператив", "Бирикме / Фонд", "Жеке кызмат көрсөтүүчү"],
      sectors: [
        "AllonaHub / Электрондук соода", "Ресторан жана тамак-аш", "Маркет", "Курьер жана логистика", "Такси жана транспорт",
        "Саламаттык жана клиника", "Дарыкана", "Сулуулук жана косметика", "Спорт жана фитнес", "Укук жана кеңеш берүү",
        "HR жана карьера", "Деңиз иши", "Билим берүү", "Каржы", "Саякат жана туризм", "Мейманкана жана турак жай",
        "Кыймылсыз мүлк", "Автомобиль", "Иш-чара жана көңүл ачуу", "Үй кызматтары", "Үй жаныбарлары дүкөнү",
        "Эмерек жана жасалга", "Технология жана электроника", "Мода жана кийим", "Зер буюмдар жана аксессуар", "Эне жана бала",
        "Китеп жана кеңсе товарлары", "Өнөр жана дизайн", "Курулуш материалдары жана оңдоо", "Башка кызматтар"
      ]
    }
  };

  const locales = { tr: "tr-TR", az: "az-AZ", en: "en", de: "de-DE", ru: "ru-RU", ar: "ar", kk: "kk-KZ", uz: "uz-UZ", ky: "ky-KG" };
  const runtimeLanguages = ["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"];
  const runtimeRows = {
    resetFailed: ["Şifre sıfırlama şu anda başlatılamadı. Lütfen daha sonra tekrar deneyin.", "Şifrə yeniləmə hazırda başlamadı. Daha sonra yenidən cəhd edin.", "Құпиясөзді қалпына келтіру басталмады. Кейінірек қайталаңыз.", "Parolni tiklash hozir boshlanmadi. Keyinroq qayta urinib ko‘ring.", "Сырсөздү жаңылоо азыр башталган жок. Кийинчерээк кайталаңыз.", "Password reset could not start. Please try again later.", "Das Zurücksetzen des Passworts konnte nicht gestartet werden. Versuchen Sie es später erneut.", "Не удалось начать сброс пароля. Повторите попытку позже.", "تعذر بدء إعادة تعيين كلمة المرور. يرجى المحاولة لاحقاً."],
    mfaUnavailable: ["Partner güvenliği için MFA altyapısı yüklenemedi.", "Partner təhlükəsizliyi üçün MFA sistemi yüklənmədi.", "Серіктес қауіпсіздігі үшін MFA жүйесі жүктелмеді.", "Hamkor xavfsizligi uchun MFA tizimi yuklanmadi.", "Өнөктөш коопсуздугу үчүн MFA системасы жүктөлгөн жок.", "The partner MFA security system could not be loaded.", "Das MFA-Sicherheitssystem für Partner konnte nicht geladen werden.", "Не удалось загрузить систему MFA для партнёров.", "تعذر تحميل نظام التحقق المتعدد للشركاء."],
    mfaCheckFailed: ["MFA durumu kontrol edilemedi. Lütfen tekrar deneyin.", "MFA vəziyyəti yoxlanılmadı. Yenidən cəhd edin.", "MFA күйі тексерілмеді. Қайталап көріңіз.", "MFA holati tekshirilmadi. Qayta urinib ko‘ring.", "MFA абалы текшерилген жок. Кайра аракет кылыңыз.", "MFA status could not be checked. Please try again.", "Der MFA-Status konnte nicht geprüft werden. Bitte erneut versuchen.", "Не удалось проверить статус MFA. Повторите попытку.", "تعذر التحقق من حالة MFA. يرجى المحاولة مجدداً."],
    mfaRequired: ["Partner paneli için iki aşamalı doğrulama zorunludur. MFA ekranına yönlendiriliyorsunuz.", "Partner paneli üçün iki mərhələli doğrulama tələb olunur. MFA səhifəsinə yönləndirilirsiniz.", "Серіктес панелі үшін екі сатылы растау қажет. MFA бетіне өтесіз.", "Hamkor paneli uchun ikki bosqichli tasdiqlash talab qilinadi. MFA sahifasiga yo‘naltirilmoqdasiz.", "Өнөктөш панели үчүн эки баскычтуу ырастоо керек. MFA барагына багытталуудасыз.", "Two-factor verification is required for the partner panel. Redirecting to MFA.", "Für den Partnerbereich ist Zwei-Faktor-Authentifizierung erforderlich. Weiterleitung zur MFA.", "Для панели партнёра нужна двухфакторная проверка. Переход к MFA.", "يتطلب دخول لوحة الشريك التحقق بخطوتين. جارٍ الانتقال إلى MFA."],
    googleFailed: ["Google ile partner girişi başlatılamadı. Lütfen daha sonra tekrar deneyin.", "Google ilə partner girişi başlamadı. Daha sonra yenidən cəhd edin.", "Google арқылы серіктеске кіру басталмады. Кейінірек қайталаңыз.", "Google orqali hamkor kirishi boshlanmadi. Keyinroq qayta urinib ko‘ring.", "Google аркылуу өнөктөшкө кирүү башталган жок. Кийинчерээк кайталаңыз.", "Google partner sign-in could not start. Please try again later.", "Google-Partneranmeldung konnte nicht gestartet werden. Versuchen Sie es später erneut.", "Не удалось начать вход партнёра через Google. Повторите позже.", "تعذر بدء دخول الشريك عبر Google. يرجى المحاولة لاحقاً."],
    googleEmailMissing: ["Google hesabından e-posta bilgisi alınamadı.", "Google hesabından e-poçt alınmadı.", "Google аккаунтынан пошта мекенжайы алынбады.", "Google hisobidan elektron pochta olinmadi.", "Google аккаунтунан электрондук почта алынган жок.", "The email address could not be retrieved from Google.", "Die E-Mail-Adresse konnte nicht von Google abgerufen werden.", "Не удалось получить почту из аккаунта Google.", "تعذر الحصول على البريد الإلكتروني من Google."],
    googleChecking: ["Google oturumu kontrol ediliyor...", "Google sessiyası yoxlanılır...", "Google сеансы тексерілуде...", "Google sessiyasi tekshirilmoqda...", "Google сеансы текшерилүүдө...", "Checking the Google session...", "Google-Sitzung wird geprüft...", "Проверка сеанса Google...", "جارٍ التحقق من جلسة Google..."],
    sessionInvalid: ["Oturum güvenli şekilde doğrulanamadı. Lütfen tekrar deneyin.", "Sessiya təhlükəsiz doğrulanmadı. Yenidən cəhd edin.", "Сеанс қауіпсіз расталмады. Қайталап көріңіз.", "Sessiya xavfsiz tasdiqlanmadi. Qayta urinib ko‘ring.", "Сеанс коопсуз ырасталган жок. Кайра аракет кылыңыз.", "The session could not be securely verified. Please try again.", "Die Sitzung konnte nicht sicher bestätigt werden. Bitte erneut versuchen.", "Не удалось безопасно проверить сеанс. Повторите попытку.", "تعذر التحقق من الجلسة بأمان. يرجى المحاولة مجدداً."],
    wrongPortal: ["Bu sayfa yalnız kullanıcı ve partner girişi içindir. Admin girişleri buradan açılamaz.", "Bu səhifə yalnız istifadəçi və partner girişi üçündür. İdarəçi girişi burada mümkün deyil.", "Бұл бет пайдаланушы мен серіктеске арналған. Әкімші бұл жерден кіре алмайды.", "Bu sahifa faqat foydalanuvchi va hamkor kirishi uchun. Administrator bu yerdan kira olmaydi.", "Бул барак колдонуучу жана өнөктөш үчүн. Администратор бул жерден кире албайт.", "This page is for users and partners only. Administrators must use their dedicated sign-in page.", "Diese Seite ist für Nutzer und Partner. Administratoren müssen ihren eigenen Zugang verwenden.", "Эта страница для пользователей и партнёров. Администраторам нужен отдельный вход.", "هذه الصفحة للمستخدمين والشركاء فقط. يجب على المسؤولين استخدام صفحة الدخول المخصصة."],
    serviceUnavailable: ["Başvuru servisi yapılandırılmadı.", "Müraciət xidməti qurulmayıb.", "Өтінім қызметі бапталмаған.", "Ariza xizmati sozlanmagan.", "Арыз кызматы жөндөлгөн эмес.", "The application service is not configured.", "Der Antragsdienst ist nicht konfiguriert.", "Сервис заявок не настроен.", "خدمة الطلبات غير مهيأة."],
    required: ["{field} alanını doldurun.", "{field} sahəsini doldurun.", "{field} өрісін толтырыңыз.", "{field} maydonini to‘ldiring.", "{field} талаасын толтуруңуз.", "Complete the {field} field.", "Füllen Sie das Feld {field} aus.", "Заполните поле «{field}».", "يرجى ملء حقل {field}."],
    invalidEmail: ["Geçerli bir e-posta adresi giriniz.", "Düzgün e-poçt ünvanı daxil edin.", "Жарамды электрондық пошта мекенжайын енгізіңіз.", "To‘g‘ri elektron pochta manzilini kiriting.", "Жарактуу электрондук почта дарегин киргизиңиз.", "Enter a valid email address.", "Geben Sie eine gültige E-Mail-Adresse ein.", "Введите действительный адрес электронной почты.", "أدخل عنوان بريد إلكتروني صالحاً."],
    invalidWebsite: ["Web sitesi adresini kontrol et.", "Veb sayt ünvanını yoxlayın.", "Веб-сайт мекенжайын тексеріңіз.", "Veb-sayt manzilini tekshiring.", "Веб-сайт дарегин текшериңиз.", "Check the website address.", "Überprüfen Sie die Website-Adresse.", "Проверьте адрес сайта.", "تحقق من عنوان الموقع الإلكتروني."],
    phoneShort: ["Telefon numarası çok kısa görünüyor.", "Telefon nömrəsi çox qısadır.", "Телефон нөмірі тым қысқа.", "Telefon raqami juda qisqa.", "Телефон номери өтө кыска.", "The phone number is too short.", "Die Telefonnummer ist zu kurz.", "Номер телефона слишком короткий.", "رقم الهاتف قصير جداً."],
    phoneLong: ["Telefon numarası çok uzun görünüyor.", "Telefon nömrəsi çox uzundur.", "Телефон нөмірі тым ұзын.", "Telefon raqami juda uzun.", "Телефон номери өтө узун.", "The phone number is too long.", "Die Telefonnummer ist zu lang.", "Номер телефона слишком длинный.", "رقم الهاتف طويل جداً."],
    submitted: ["Başvurunuz alındı. Admin inceleme kuyruğuna düştü.", "Müraciətiniz alındı və idarəçi yoxlamasına göndərildi.", "Өтініміңіз қабылданып, әкімші тексеруіне жіберілді.", "Arizangiz qabul qilindi va administrator tekshiruviga yuborildi.", "Арызыңыз кабыл алынып, администратордун текшерүүсүнө жөнөтүлдү.", "Your application was received and sent for administrator review.", "Ihr Antrag wurde empfangen und zur Prüfung weitergeleitet.", "Заявка получена и передана на проверку администратору.", "تم استلام طلبك وإرساله لمراجعة الإدارة."],
    cleared: ["Başvuru formu temizlendi.", "Müraciət forması təmizləndi.", "Өтінім нысаны тазартылды.", "Ariza shakli tozalandi.", "Арыз формасы тазаланды.", "The application form was cleared.", "Das Antragsformular wurde geleert.", "Форма заявки очищена.", "تم مسح نموذج الطلب."],
    submitFailed: ["Başvuru gönderilemedi. Lütfen daha sonra tekrar deneyin.", "Müraciət göndərilmədi. Daha sonra yenidən cəhd edin.", "Өтінім жіберілмеді. Кейінірек қайталап көріңіз.", "Ariza yuborilmadi. Keyinroq qayta urinib ko‘ring.", "Арыз жөнөтүлгөн жок. Кийинчерээк кайра аракет кылыңыз.", "The application could not be sent. Please try again later.", "Der Antrag konnte nicht gesendet werden. Versuchen Sie es später erneut.", "Не удалось отправить заявку. Повторите попытку позже.", "تعذر إرسال الطلب. يرجى المحاولة لاحقاً."],
    rateLimit: ["Çok fazla deneme. Lütfen kısa süre sonra tekrar deneyin.", "Çox sayda cəhd edildi. Bir az sonra yenidən cəhd edin.", "Әрекет тым көп. Біраздан кейін қайталап көріңіз.", "Urinishlar juda ko‘p. Birozdan keyin qayta urinib ko‘ring.", "Аракеттер өтө көп. Бир аздан кийин кайра аракет кылыңыз.", "Too many attempts. Please try again shortly.", "Zu viele Versuche. Versuchen Sie es in Kürze erneut.", "Слишком много попыток. Повторите немного позже.", "محاولات كثيرة جداً. يرجى المحاولة بعد قليل."],
    credentials: ["E-posta ve şifrenizi kontrol edin.", "E-poçt və şifrənizi yoxlayın.", "Электрондық пошта мен құпиясөзді тексеріңіз.", "Elektron pochta va parolingizni tekshiring.", "Электрондук почтаңызды жана сырсөзүңүздү текшериңиз.", "Check your email and password.", "Überprüfen Sie E-Mail und Passwort.", "Проверьте электронную почту и пароль.", "تحقق من بريدك الإلكتروني وكلمة المرور."],
    loginFailed: ["Giriş sırasında hata oluştu. Lütfen tekrar deneyin.", "Giriş zamanı xəta yarandı. Yenidən cəhd edin.", "Кіру кезінде қате болды. Қайталап көріңіз.", "Kirishda xato yuz berdi. Qayta urinib ko‘ring.", "Кирүүдө ката кетти. Кайра аракет кылыңыз.", "Sign-in failed. Please try again.", "Die Anmeldung ist fehlgeschlagen. Bitte erneut versuchen.", "Ошибка входа. Повторите попытку.", "تعذر تسجيل الدخول. يرجى المحاولة مجدداً."],
    inactive: ["Partner hesabınız henüz aktif değil.", "Partner hesabınız hələ aktiv deyil.", "Серіктес аккаунтыңыз әлі белсенді емес.", "Hamkor hisobingiz hali faol emas.", "Өнөктөш аккаунтуңуз азырынча активдүү эмес.", "Your partner account is not active yet.", "Ihr Partnerkonto ist noch nicht aktiv.", "Ваш партнёрский аккаунт ещё не активирован.", "حساب الشريك الخاص بك غير نشط بعد."],
    noPartner: ["Bu e-posta için partner kaydı bulunamadı.", "Bu e-poçt üçün partner qeydiyyatı tapılmadı.", "Бұл электрондық поштаға серіктес тіркелмеген.", "Bu elektron pochta uchun hamkor qaydi topilmadi.", "Бул электрондук почта үчүн өнөктөш каттоосу табылган жок.", "No partner registration was found for this email.", "Für diese E-Mail wurde kein Partnerkonto gefunden.", "Для этой почты не найдена регистрация партнёра.", "لم يتم العثور على تسجيل شريك لهذا البريد الإلكتروني."],
    resetSent: ["Eğer bu e-posta aktif bir partner hesabına kayıtlıysa şifre sıfırlama bağlantısı gönderildi.", "Bu e-poçt aktiv partner hesabına bağlıdırsa, şifrə yeniləmə linki göndərildi.", "Бұл пошта белсенді серіктеске тиесілі болса, құпиясөзді жаңарту сілтемесі жіберілді.", "Bu pochta faol hamkor hisobiga tegishli bo‘lsa, parolni tiklash havolasi yuborildi.", "Бул почта активдүү өнөктөшкө таандык болсо, сырсөздү жаңылоо шилтемеси жөнөтүлдү.", "If this email belongs to an active partner account, a password reset link has been sent.", "Falls diese E-Mail zu einem aktiven Partnerkonto gehört, wurde ein Link zum Zurücksetzen gesendet.", "Если почта привязана к активному партнёру, ссылка для сброса пароля отправлена.", "إذا كان هذا البريد مرتبطاً بحساب شريك نشط، فقد أُرسل رابط إعادة تعيين كلمة المرور."],
    searchEmpty: ["Arama yapmak için kelime yaz.", "Axtarış üçün söz yazın.", "Іздеу сөзін енгізіңіз.", "Qidirish uchun so‘z kiriting.", "Издөө үчүн сөз жазыңыз.", "Enter a search term.", "Geben Sie einen Suchbegriff ein.", "Введите поисковый запрос.", "أدخل كلمة للبحث."],
    challengeForgot: ["Şifre sıfırlama için robot olmadığınızı doğrulayın.", "Şifrəni yeniləmək üçün robot olmadığınızı doğrulayın.", "Құпиясөзді жаңарту үшін робот емес екеніңізді растаңыз.", "Parolni tiklash uchun robot emasligingizni tasdiqlang.", "Сырсөздү жаңылоо үчүн робот эмес экениңизди ырастаңыз.", "Confirm that you are not a robot to reset your password.", "Bestätigen Sie zum Zurücksetzen, dass Sie kein Roboter sind.", "Подтвердите, что вы не робот, для сброса пароля.", "أكد أنك لست روبوتاً لإعادة تعيين كلمة المرور."],
    challengeRetry: ["Güvenlik kontrolünü yeniden dene", "Təhlükəsizlik yoxlamasını təkrarla", "Қауіпсіздік тексеруін қайталау", "Xavfsizlik tekshiruvini takrorlash", "Коопсуздук текшерүүсүн кайталоо", "Retry security check", "Sicherheitsprüfung wiederholen", "Повторить проверку безопасности", "إعادة محاولة التحقق الأمني"],
    challengeRequired: ["Önce robot doğrulamasını tamamlayın.", "Əvvəlcə robot yoxlamasını tamamlayın.", "Алдымен робот тексеруін аяқтаңыз.", "Avval robot tekshiruvini yakunlang.", "Адегенде робот текшерүүсүн аяктаңыз.", "Complete the robot verification first.", "Schließen Sie zuerst die Roboterprüfung ab.", "Сначала пройдите проверку на робота.", "أكمل التحقق من الروبوت أولاً."],
    challengeLoading: ["Güvenlik kontrolü yeniden hazırlanıyor...", "Təhlükəsizlik yoxlaması yenidən hazırlanır...", "Қауіпсіздік тексеруі қайта дайындалуда...", "Xavfsizlik tekshiruvi qayta tayyorlanmoqda...", "Коопсуздук текшерүүсү кайра даярдалууда...", "Preparing the security check again...", "Sicherheitsprüfung wird erneut vorbereitet...", "Проверка безопасности подготавливается...", "جارٍ إعادة إعداد التحقق الأمني..."],
    challengeRenewed: ["Güvenlik kontrolü yenilendi. Lütfen doğrulamayı tamamlayın.", "Təhlükəsizlik yoxlaması yeniləndi. Yoxlamanı tamamlayın.", "Қауіпсіздік тексеруі жаңартылды. Тексеруді аяқтаңыз.", "Xavfsizlik tekshiruvi yangilandi. Tekshiruvni yakunlang.", "Коопсуздук текшерүүсү жаңыланды. Текшерүүнү аяктаңыз.", "The security check was refreshed. Please complete verification.", "Die Sicherheitsprüfung wurde erneuert. Bitte schließen Sie sie ab.", "Проверка обновлена. Завершите подтверждение.", "تم تحديث التحقق الأمني. يرجى إكماله."],
    challengeExpired: ["Güvenlik doğrulamasının süresi doldu. Lütfen tekrar doğrulayın.", "Təhlükəsizlik yoxlamasının vaxtı bitdi. Yenidən doğrulayın.", "Қауіпсіздік растауының мерзімі өтті. Қайта растаңыз.", "Xavfsizlik tasdig‘i muddati tugadi. Qayta tasdiqlang.", "Коопсуздук ырастоосунун мөөнөтү бүттү. Кайра ырастаңыз.", "Security verification expired. Please verify again.", "Die Sicherheitsprüfung ist abgelaufen. Bitte erneut bestätigen.", "Срок проверки истёк. Пройдите её снова.", "انتهت صلاحية التحقق الأمني. يرجى التحقق مجدداً."],
    challengeTimeout: ["Güvenlik kontrolü zaman aşımına uğradı.", "Təhlükəsizlik yoxlamasının vaxtı bitdi.", "Қауіпсіздік тексеруінің уақыты бітті.", "Xavfsizlik tekshiruvi vaqti tugadi.", "Коопсуздук текшерүүсүнүн убактысы бүттү.", "The security check timed out.", "Zeitüberschreitung bei der Sicherheitsprüfung.", "Время проверки безопасности истекло.", "انتهت مهلة التحقق الأمني."],
    challengeUnavailable: ["Robot doğrulaması şu anda kullanılamıyor.", "Robot yoxlaması hazırda əlçatan deyil.", "Робот тексеруі қазір қолжетімсіз.", "Robot tekshiruvi hozir mavjud emas.", "Робот текшерүүсү азыр жеткиликсиз.", "Robot verification is currently unavailable.", "Die Roboterprüfung ist derzeit nicht verfügbar.", "Проверка на робота сейчас недоступна.", "التحقق من الروبوت غير متاح حالياً."],
    challengeFailed: ["Robot doğrulaması tamamlanamadı.", "Robot yoxlaması tamamlanmadı.", "Робот тексеруі аяқталмады.", "Robot tekshiruvi yakunlanmadi.", "Робот текшерүүсү аяктаган жок.", "Robot verification could not be completed.", "Die Roboterprüfung konnte nicht abgeschlossen werden.", "Не удалось завершить проверку на робота.", "تعذر إكمال التحقق من الروبوت."],
    challengeUnsupported: ["Bu tarayıcı güvenlik kontrolünü desteklemiyor. Güncel Safari, Chrome veya Edge ile yeniden deneyin.", "Bu brauzer yoxlamanı dəstəkləmir. Yenilənmiş Safari, Chrome və ya Edge ilə cəhd edin.", "Бұл браузер тексеруді қолдамайды. Жаңартылған Safari, Chrome немесе Edge қолданыңыз.", "Bu brauzer tekshiruvni qo‘llamaydi. Yangilangan Safari, Chrome yoki Edge bilan urinib ko‘ring.", "Бул браузер текшерүүнү колдобойт. Жаңыртылган Safari, Chrome же Edge колдонуңуз.", "This browser does not support the security check. Try an up-to-date Safari, Chrome or Edge.", "Dieser Browser unterstützt die Prüfung nicht. Verwenden Sie aktuelles Safari, Chrome oder Edge.", "Браузер не поддерживает проверку. Используйте актуальную версию Safari, Chrome или Edge.", "هذا المتصفح لا يدعم التحقق الأمني. استخدم إصداراً حديثاً من Safari أو Chrome أو Edge."]
  };
  const runtimeAliases = {
    "Robot doğrulaması tamamlanmadı. Kutucuğu işaretleyip tekrar deneyin.": "challengeRequired",
    "Şifre sıfırlama başlatılamadı.": "resetFailed",
    "E-posta veya şifre doğru değil.": "credentials",
    "Google oturumu güvenli şekilde doğrulanamadı. Lütfen tekrar deneyin.": "sessionInvalid",
    "Google oturumu tamamlanamadı. Lütfen tekrar deneyin.": "sessionInvalid",
    "Bu Google hesabı için aktif partner kaydı bulunamadı.": "noPartner",
    "Güvenlik kontrolünün süresi doldu; yenileniyor...": "challengeLoading",
    "Robot doğrulaması yeniden hazırlanıyor. Lütfen birkaç saniye sonra tekrar deneyin.": "challengeLoading",
    "Güvenlik kontrolü tamamlanamadı. Bağlantınızı kontrol edip yeniden deneyin.": "challengeFailed",
    "Geçerli bir e-posta gir.": "invalidEmail",
    "Giriş başarısız. Lütfen bilgilerinizi kontrol edin.": "credentials",
    "Çok sık başvuru denemesi yapıldı. Lütfen biraz bekleyin.": "rateLimit",
    "Kısa sürede çok fazla giriş denemesi yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.": "rateLimit",
    "Başvuru şu anda kaydedilemedi.": "submitFailed",
    "Robot doğrulaması zaman aşımına uğradı.": "challengeTimeout",
    "Robot doğrulaması zamanında yüklenemedi.": "challengeTimeout",
    "Robot doğrulaması yüklenemedi.": "challengeUnavailable",
    "Robot doğrulaması başlatılamadı.": "challengeUnavailable",
    "Robot doğrulaması başarısız oldu.": "challengeFailed",
    "Robot doğrulaması süresi doldu.": "challengeExpired",
    "Güvenlik kontrolü yenilenemedi. Lütfen yeniden deneyin.": "challengeUnavailable"
  };
  const requiredFields = {
    "Firma / İşletme adı zorunlu.": "companyName", "Yetkili ad soyad zorunlu.": "contactName",
    "Telefon numarası zorunlu.": "phone", "Vergi numarası zorunlu.": "taxNumber",
    "Şirket türü seçiniz.": "companyTypeSelect", "Şehir bilgisi zorunlu.": "city",
    "Ülke bilgisi zorunlu.": "country", "Sektör seçmelisin.": "sectorSelect"
  };
  const regionOverrides = {
    az: { TR: "Türkiyə" },
    kk: { TR: "Түркия" },
    uz: { TR: "Turkiya" },
    ky: { TR: "Түркия" }
  };

  function localizedRegionName(code, language, displayNames) {
    return regionOverrides[language]?.[code] || displayNames?.of(code) || code;
  }
  const textSources = new WeakMap();
  const attributeSources = new WeakMap();
  let translating = false;
  const translationMaps = new Map();

  function currentLanguage() {
    const selected = String(localStorage.getItem("allona.language") || document.documentElement.lang || "tr").toLowerCase();
    return packs[selected] ? selected : "tr";
  }

  function mapFor(language) {
    const selected = packs[language] ? language : "tr";
    if (translationMaps.has(selected)) return translationMaps.get(selected);
    const translated = packs[selected];
    const map = new Map();
    coreKeys.forEach(function (key, index) { map.set(packs.tr.core[index], translated.core[index]); });
    packs.tr.companyTypes.forEach(function (value, index) { map.set(value, translated.companyTypes[index]); });
    packs.tr.sectors.forEach(function (value, index) { map.set(value, translated.sectors[index]); });
    const index = runtimeLanguages.indexOf(selected);
    Object.values(runtimeRows).forEach(function (row) { map.set(row[0], row[index]); });
    Object.entries(runtimeAliases).forEach(function ([source, key]) { map.set(source, runtimeRows[key][index]); });
    Object.entries(requiredFields).forEach(function ([source, key]) { map.set(source, runtimeRows.required[index].replace("{field}", coreValue(key, selected))); });
    translationMaps.set(selected, map);
    return map;
  }

  function translateText(value, language) {
    const source = String(value || "").trim();
    return mapFor(language || currentLanguage()).get(source) || String(value || "");
  }

  const fieldConfig = {
    partnerSearchInput: ["searchPlaceholder", "searchAria"],
    loginEmail: ["email", "email"],
    loginPassword: ["password", "password"],
    forgotPartnerEmail: ["email", "email"],
    contact_name: ["contactName", "contactName"],
    email: ["email", "email"],
    phone: ["phone", "phone"],
    tax_number: ["taxNumber", "taxNumber"],
    partner_name: ["companyName", "companyName"],
    tax_office: ["taxOffice", "taxOffice"],
    website: ["website", "website"],
    message: ["businessDesc", "businessDesc"]
  };

  function coreValue(key, language) {
    return packs[language].core[coreKeys.indexOf(key)];
  }

  function localizeFields(language) {
    Object.entries(fieldConfig).forEach(function (entry) {
      const node = document.getElementById(entry[0]);
      if (!node) return;
      node.placeholder = coreValue(entry[1][0], language);
      node.setAttribute("aria-label", coreValue(entry[1][1], language));
    });
    const tabs = document.querySelector(".tabs[role='tablist']");
    if (tabs) tabs.setAttribute("aria-label", coreValue("tabsAria", language));
    const labels = {
      countryCode: "phone", country: "country", company_type: "companyTypeSelect", city: "city", category: "sectorSelect"
    };
    Object.entries(labels).forEach(function (entry) {
      const node = document.getElementById(entry[0]);
      if (node) node.setAttribute("aria-label", coreValue(entry[1], language));
    });
  }

  function localizeTextNode(node, language) {
    if (!textSources.has(node)) {
      textSources.set(node, node.__partnerSourceText || node.textContent);
    }
    const original = textSources.get(node);
    const source = String(original || "").trim();
    if (!source) return;
    const translated = mapFor(language).get(source) || source;
    const next = String(original).replace(source, translated);
    if (node.textContent !== next) node.textContent = next;
  }

  function localizeElement(node, language) {
    if (!(node instanceof Element)) return;
    // Password visibility owns its language labels and changes them on every toggle.
    if (node.closest(".password-visibility-toggle")) return;
    const owner = node.closest("[data-no-translate]");
    if (owner && !owner.hasAttribute("data-partner-i18n")) return;
    if (!["SCRIPT", "STYLE", "OPTION"].includes(node.tagName)) {
      Array.from(node.childNodes).forEach(function (child) {
        if (child.nodeType === Node.TEXT_NODE) localizeTextNode(child, language);
      });
    }
    if (!["SCRIPT", "STYLE"].includes(node.tagName)) {
      let stored = attributeSources.get(node);
      if (!stored) {
        stored = {};
        attributeSources.set(node, stored);
      }
      ["placeholder", "aria-label", "title"].forEach(function (attribute) {
        if (!node.hasAttribute(attribute)) return;
        if (!stored[attribute]) stored[attribute] = node[`__partnerSource_${attribute}`] || node.getAttribute(attribute);
        const translated = mapFor(language).get(stored[attribute]) || stored[attribute];
        if (node.getAttribute(attribute) !== translated) node.setAttribute(attribute, translated);
      });
    }
  }

  function localizeSelectOptions(language) {
    const pack = packs[language];
    const companySelect = document.getElementById("company_type");
    const sectorSelect = document.getElementById("category");
    [[companySelect, pack.companyTypes, "companyTypeSelect"], [sectorSelect, pack.sectors, "sectorSelect"]].forEach(function (entry) {
      if (!entry[0]) return;
      Array.from(entry[0].options).forEach(function (option, index) {
        if (index === 0) {
          const placeholder = coreValue(entry[2], language);
          if (option.textContent !== placeholder) option.textContent = placeholder;
          return;
        }
        if (!option.dataset.sourceValue) option.dataset.sourceValue = option.value || option.textContent;
        option.value = option.dataset.sourceValue;
        const translated = entry[1][index - 1] || option.dataset.sourceValue;
        if (option.textContent !== translated) option.textContent = translated;
      });
    });

    const citySelect = document.getElementById("city");
    if (citySelect && citySelect.options[0]) {
      const placeholder = coreValue("citySelect", language);
      if (citySelect.options[0].textContent !== placeholder) citySelect.options[0].textContent = placeholder;
    }
    if (citySelect) {
      Array.from(citySelect.options).forEach(function (option) {
        const other = coreValue("other", language);
        const label = option.value === "Diğer" ? other : option.value;
        if (option.value && option.textContent !== label) option.textContent = label;
      });
    }
  }

  function localizeCountries(language) {
    let displayNames;
    try { displayNames = new Intl.DisplayNames([locales[language]], { type: "region" }); } catch (error) { displayNames = null; }
    const countrySelect = document.getElementById("country");
    if (countrySelect && displayNames) {
      Array.from(countrySelect.options).forEach(function (option) {
        const translated = localizedRegionName(option.value, language, displayNames) || option.dataset.name || option.textContent;
        if (option.textContent !== translated) option.textContent = translated;
      });
    }

    const phoneRegions = [
      ["TR"], ["AZ"], ["US", "CA"], ["GB"], ["DE"], ["FR"], ["IT"], ["ES"], ["NL"], ["BE"], ["CH"], ["AT"],
      ["RU", "KZ"], ["UA"], ["AE"], ["SA"], ["QA"], ["KW"], ["BH"], ["OM"], ["EG"], ["MA"], ["TN"], ["DZ"],
      ["CN"], ["JP"], ["KR"], ["IN"], ["ID"], ["MY"], ["SG"], ["AU"], ["NZ"], ["BR"], ["MX"], ["ZA"]
    ];
    const phoneSelect = document.getElementById("countryCode");
    if (phoneSelect && displayNames) {
      Array.from(phoneSelect.options).forEach(function (option, index) {
        const regions = phoneRegions[index] || [];
        const flag = String(option.textContent || "").trim().split(/\s+/)[0];
        const names = regions.map(function (code) { return localizedRegionName(code, language, displayNames); }).join(" / ");
        const translated = `${flag} ${names} ${option.value}`;
        if (names && option.textContent !== translated) option.textContent = translated;
      });
    }
  }

  function localizePage(language) {
    if (translating) return;
    translating = true;
    const selected = packs[language] ? language : currentLanguage();
    try {
      document.documentElement.lang = selected;
      document.documentElement.dir = selected === "ar" ? "rtl" : "ltr";
      document.title = "AllonaHub | " + coreValue("title", selected);
      document.querySelectorAll("body *").forEach(function (node) { localizeElement(node, selected); });
      localizeFields(selected);
      localizeSelectOptions(selected);
      localizeCountries(selected);
      const notice = document.getElementById("notice");
      if (notice?.dataset.partnerMessage) {
        const translated = translateText(notice.dataset.partnerMessage, selected);
        if (notice.textContent !== translated) notice.textContent = translated;
      }
    } finally {
      translating = false;
    }
  }

  function mainSiteOrigin() {
    const hostname = String(window.location.hostname || "").toLowerCase();
    if (["allonahub.com", "www.allonahub.com", "partner.allonahub.com"].includes(hostname)) return "https://allonahub.com";
    return window.location.origin;
  }

  function moduleContextUrl() {
    const candidates = [new URLSearchParams(window.location.search).get("returnTo"), document.referrer];
    const allowedHosts = new Set([window.location.hostname, "allonahub.com", "www.allonahub.com"]);
    for (const candidate of candidates) {
      if (!candidate) continue;
      try {
        const target = new URL(decodeURIComponent(candidate), mainSiteOrigin());
        if (!allowedHosts.has(target.hostname)) continue;
        if (/^\/pages\/ecosystem\/[^/]+\.html$/i.test(target.pathname) || /^\/denizcilik-modulu(?:\/|$)/i.test(target.pathname)) return target.href;
      } catch (error) {}
    }
    return "";
  }

  function configureNavigation() {
    const home = document.getElementById("partnerHomeLink");
    const moduleLink = document.getElementById("partnerModuleReturn");
    const moduleTarget = moduleContextUrl();
    if (home) home.href = new URL("/index.html", mainSiteOrigin()).href;
    if (moduleLink) {
      moduleLink.hidden = !moduleTarget;
      if (moduleTarget) moduleLink.href = moduleTarget;
    }
  }

  window.goBackToPreviousPage = function () {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = moduleContextUrl() || new URL("/index.html", mainSiteOrigin()).href;
  };

  window.AllonaPartnerEntry = { translateText: translateText, translatePage: localizePage, moduleContextUrl: moduleContextUrl };

  document.addEventListener("allona:language-changed", function (event) {
    localizePage(event.detail && event.detail.language);
  });

  document.addEventListener("DOMContentLoaded", function () {
    configureNavigation();
    localizePage(currentLanguage());
    const country = document.getElementById("country");
    if (country) country.addEventListener("change", function () { localizePage(currentLanguage()); });
    const observer = new MutationObserver(function () { localizePage(currentLanguage()); });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();
