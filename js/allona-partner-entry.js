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

  function currentLanguage() {
    const selected = String(localStorage.getItem("allona.language") || document.documentElement.lang || "tr").toLowerCase();
    return packs[selected] ? selected : "tr";
  }

  function mapFor(language) {
    const selected = packs[language] ? language : "tr";
    const translated = packs[selected];
    const map = new Map();
    coreKeys.forEach(function (key, index) { map.set(packs.tr.core[index], translated.core[index]); });
    packs.tr.companyTypes.forEach(function (value, index) { map.set(value, translated.companyTypes[index]); });
    packs.tr.sectors.forEach(function (value, index) { map.set(value, translated.sectors[index]); });
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
    if (!(node instanceof Element) || node.closest("[data-no-translate]")) return;
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
        if (option.value === "Diğer" && option.textContent !== other) option.textContent = other;
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
      document.querySelectorAll("body *").forEach(function (node) { localizeElement(node, selected); });
      localizeFields(selected);
      localizeSelectOptions(selected);
      localizeCountries(selected);
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
