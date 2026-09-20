(function () {
  "use strict";

  const copy = {
    tr: {
      headingLogin: "hesabına giriş yap",
      headingRegister: "hesabını oluştur",
      headingForgot: "şifreni sıfırla",
      leadLogin: "Tek hesapla AllonaHub ekosistemindeki tüm hizmetlere, HP dünyasına, kuponlara ve premium avantajlara eriş.",
      leadRegister: "Yeni hesabını oluştur; mesleğine uygun panel, bildirimler ve avantajlar tek profilde açılsın.",
      leadForgot: "Hesabına güvenli şekilde geri dönebilmen için e-posta adresine doğrulama bağlantısı gönder.",
      titleLogin: "AllonaHub Kullanıcı Girişi",
      titleRegister: "AllonaHub Kayıt Ol",
      titleForgot: "AllonaHub Şifre Sıfırlama",
      tabLogin: "Giriş Yap",
      tabRegister: "Kayıt Ol",
      tabForgot: "Şifremi Unuttum",
      methodEmail: "E-posta ile giriş",
      methodPhone: "Telefon ile giriş",
      email: "E-posta",
      password: "Şifre",
      loginButton: "Giriş Yap",
      phoneLead: "Ülkenizi seçin; doğrulama kodu seçtiğiniz ülke koduyla telefonunuza gönderilsin.",
      phone: "Telefon numarası",
      sendCode: "Doğrulama Kodu Gönder",
      otp: "6 haneli doğrulama kodu",
      verifyCode: "Kodu Doğrula ve Devam Et",
      or: "veya",
      googleLogin: "Google ile Giriş Yap",
      appleLogin: "Apple / iCloud ile Giriş Yap",
      googleRegister: "Google ile Kayıt Ol",
      appleRegister: "Apple / iCloud ile Kayıt Ol",
      partnerLogin: "Partner Girişi",
      securityCenter: "Güvenlik merkezi",
      fullName: "Ad Soyad",
      sector: "Sektör Seçiniz *",
      profession: "Meslek ara ve seç *",
      professionNote: "Meslek seçimi zorunludur. Panel, iş ilanı ve bildirimler seçtiğiniz mesleğe göre kişiselleştirilir.",
      createPassword: "Şifre oluştur",
      repeatPassword: "Şifreyi tekrar gir",
      passwordMismatch: "Şifreler aynı değil.",
      createAccount: "Ücretsiz Hesap Oluştur",
      resetButton: "Şifre Sıfırlama Linki Gönder",
      resetNote: "Güvenlik nedeniyle doğrulama bağlantısı e-posta ile gönderilecektir.",
      countrySearch: "Ülke adı veya kod yaz...",
      challengeLogin: "Giriş güvenlik doğrulaması",
      challengeRegister: "Kayıt güvenlik doğrulaması",
      challengeForgot: "Şifre sıfırlama güvenlik doğrulaması",
      appleUnavailable: "Apple / iCloud girişi henüz etkin değil. Yönetici Apple sağlayıcısını etkinleştirdiğinde bu düğme otomatik açılır.",
      phoneUnavailable: "SMS ile giriş henüz etkin değil. Telefon sağlayıcısı açıldığında bu alan otomatik kullanılabilir.",
      invalidPhone: "Geçerli bir telefon numarası girin.",
      codeSent: "Doğrulama kodu {phone} numarasına gönderildi.",
      invalidCode: "6 haneli doğrulama kodunu girin.",
      phoneVerified: "Telefon doğrulandı. Hesabınıza yönlendiriliyorsunuz.",
      phoneError: "SMS işlemi tamamlanamadı. Numarayı kontrol edip tekrar deneyin.",
      oauthError: "Bu hesapla giriş başlatılamadı. Lütfen tekrar deneyin.",
      tooMany: "Çok fazla deneme yapıldı. Lütfen kısa süre sonra tekrar deneyin."
    },
    az: {
      headingLogin: "hesabınıza daxil olun", headingRegister: "hesabınızı yaradın", headingForgot: "şifrənizi yeniləyin",
      leadLogin: "Bir hesabla AllonaHub ekosistemindəki bütün xidmətlərə, HP dünyasına, kuponlara və premium üstünlüklərə çatın.", leadRegister: "Yeni hesabınızı yaradın; peşənizə uyğun panel, bildirişlər və üstünlüklər bir profildə açılsın.", leadForgot: "Hesabınıza təhlükəsiz qayıtmaq üçün e-poçtunuza təsdiq keçidi göndərin.",
      titleLogin: "AllonaHub Giriş", titleRegister: "AllonaHub Qeydiyyat", titleForgot: "AllonaHub Şifrə Yeniləmə",
      tabLogin: "Daxil ol", tabRegister: "Qeydiyyat", tabForgot: "Şifrəmi unutdum", methodEmail: "E-poçtla daxil ol", methodPhone: "Telefonla daxil ol", email: "E-poçt", password: "Şifrə", loginButton: "Daxil ol", phoneLead: "Ölkənizi seçin; təsdiq kodu seçdiyiniz ölkə kodu ilə telefonunuza göndərilsin.", phone: "Telefon nömrəsi", sendCode: "Təsdiq kodu göndər", otp: "6 rəqəmli təsdiq kodu", verifyCode: "Kodu təsdiqlə və davam et", or: "və ya", googleLogin: "Google ilə daxil ol", appleLogin: "Apple / iCloud ilə daxil ol", googleRegister: "Google ilə qeydiyyat", appleRegister: "Apple / iCloud ilə qeydiyyat", partnerLogin: "Partnyor girişi", securityCenter: "Təhlükəsizlik mərkəzi", fullName: "Ad Soyad", sector: "Sektor seçin *", profession: "Peşə axtarın və seçin *", professionNote: "Peşə seçimi məcburidir. Panel, iş elanları və bildirişlər peşənizə görə fərdiləşdirilir.", createPassword: "Şifrə yaradın", repeatPassword: "Şifrəni təkrar yazın", passwordMismatch: "Şifrələr eyni deyil.", createAccount: "Pulsuz hesab yarat", resetButton: "Şifrə yeniləmə keçidi göndər", resetNote: "Təhlükəsizlik üçün təsdiq keçidi e-poçtla göndəriləcək.", countrySearch: "Ölkə adı və ya kod yazın...", challengeLogin: "Giriş təhlükəsizlik yoxlaması", challengeRegister: "Qeydiyyat təhlükəsizlik yoxlaması", challengeForgot: "Şifrə yeniləmə yoxlaması", appleUnavailable: "Apple / iCloud girişi hələ aktiv deyil.", phoneUnavailable: "SMS ilə giriş hələ aktiv deyil.", invalidPhone: "Düzgün telefon nömrəsi daxil edin.", codeSent: "Təsdiq kodu {phone} nömrəsinə göndərildi.", invalidCode: "6 rəqəmli təsdiq kodunu daxil edin.", phoneVerified: "Telefon təsdiqləndi. Hesabınıza yönləndirilirsiniz.", phoneError: "SMS əməliyyatı tamamlanmadı.", oauthError: "Bu hesabla giriş başladıla bilmədi.", tooMany: "Çox sayda cəhd edildi. Bir az sonra yenidən sınayın."
    },
    en: {
      headingLogin: "sign in to your account", headingRegister: "create your account", headingForgot: "reset your password",
      leadLogin: "Use one account to access every AllonaHub service, HP benefits, coupons and premium advantages.", leadRegister: "Create your account and bring your profession-based dashboard, notifications and benefits into one profile.", leadForgot: "Send a verification link to your email to securely regain access to your account.",
      titleLogin: "AllonaHub Sign In", titleRegister: "Create an AllonaHub Account", titleForgot: "Reset AllonaHub Password",
      tabLogin: "Sign In", tabRegister: "Register", tabForgot: "Forgot Password", methodEmail: "Sign in with email", methodPhone: "Sign in with phone", email: "Email", password: "Password", loginButton: "Sign In", phoneLead: "Choose your country and we will send the verification code using its calling code.", phone: "Phone number", sendCode: "Send Verification Code", otp: "6-digit verification code", verifyCode: "Verify Code and Continue", or: "or", googleLogin: "Sign in with Google", appleLogin: "Sign in with Apple / iCloud", googleRegister: "Register with Google", appleRegister: "Register with Apple / iCloud", partnerLogin: "Partner Sign In", securityCenter: "Security center", fullName: "Full name", sector: "Select sector *", profession: "Search and select profession *", professionNote: "A profession is required. Your dashboard, job listings and notifications are tailored to your selection.", createPassword: "Create password", repeatPassword: "Repeat password", passwordMismatch: "Passwords do not match.", createAccount: "Create Free Account", resetButton: "Send Password Reset Link", resetNote: "For security, the verification link will be sent by email.", countrySearch: "Type a country name or code...", challengeLogin: "Sign-in security check", challengeRegister: "Registration security check", challengeForgot: "Password reset security check", appleUnavailable: "Apple / iCloud sign-in is not enabled yet. This button will become available automatically when the provider is enabled.", phoneUnavailable: "SMS sign-in is not enabled yet. This section will become available automatically when the phone provider is enabled.", invalidPhone: "Enter a valid phone number.", codeSent: "A verification code was sent to {phone}.", invalidCode: "Enter the 6-digit verification code.", phoneVerified: "Phone verified. Redirecting to your account.", phoneError: "The SMS request could not be completed. Check the number and try again.", oauthError: "Sign-in with this account could not be started. Please try again.", tooMany: "Too many attempts. Please try again shortly."
    },
    de: {
      headingLogin: "bei Ihrem Konto anmelden", headingRegister: "Ihr Konto erstellen", headingForgot: "Ihr Passwort zurücksetzen", leadLogin: "Mit einem Konto greifen Sie auf alle AllonaHub-Dienste, HP-Vorteile, Gutscheine und Premium-Vorteile zu.", leadRegister: "Erstellen Sie Ihr Konto und bündeln Sie berufsspezifische Inhalte in einem Profil.", leadForgot: "Senden Sie einen Bestätigungslink an Ihre E-Mail-Adresse, um sicher zurückzukehren.", titleLogin: "AllonaHub Anmeldung", titleRegister: "AllonaHub Registrierung", titleForgot: "AllonaHub Passwort zurücksetzen", tabLogin: "Anmelden", tabRegister: "Registrieren", tabForgot: "Passwort vergessen", methodEmail: "Mit E-Mail anmelden", methodPhone: "Mit Telefon anmelden", email: "E-Mail", password: "Passwort", loginButton: "Anmelden", phoneLead: "Wählen Sie Ihr Land; der Code wird mit der passenden Vorwahl gesendet.", phone: "Telefonnummer", sendCode: "Bestätigungscode senden", otp: "6-stelliger Bestätigungscode", verifyCode: "Code bestätigen und fortfahren", or: "oder", googleLogin: "Mit Google anmelden", appleLogin: "Mit Apple / iCloud anmelden", googleRegister: "Mit Google registrieren", appleRegister: "Mit Apple / iCloud registrieren", partnerLogin: "Partner-Anmeldung", securityCenter: "Sicherheitscenter", fullName: "Vor- und Nachname", sector: "Branche wählen *", profession: "Beruf suchen und wählen *", professionNote: "Die Berufsauswahl ist erforderlich. Dashboard, Stellen und Mitteilungen werden darauf abgestimmt.", createPassword: "Passwort erstellen", repeatPassword: "Passwort wiederholen", passwordMismatch: "Passwörter stimmen nicht überein.", createAccount: "Kostenloses Konto erstellen", resetButton: "Link zum Zurücksetzen senden", resetNote: "Der Bestätigungslink wird aus Sicherheitsgründen per E-Mail gesendet.", countrySearch: "Land oder Vorwahl eingeben...", challengeLogin: "Sicherheitsprüfung für Anmeldung", challengeRegister: "Sicherheitsprüfung für Registrierung", challengeForgot: "Sicherheitsprüfung für Passwort", appleUnavailable: "Apple / iCloud-Anmeldung ist noch nicht aktiviert.", phoneUnavailable: "SMS-Anmeldung ist noch nicht aktiviert.", invalidPhone: "Geben Sie eine gültige Telefonnummer ein.", codeSent: "Ein Bestätigungscode wurde an {phone} gesendet.", invalidCode: "Geben Sie den 6-stelligen Code ein.", phoneVerified: "Telefon bestätigt. Sie werden weitergeleitet.", phoneError: "Die SMS-Anfrage konnte nicht abgeschlossen werden.", oauthError: "Die Anmeldung konnte nicht gestartet werden.", tooMany: "Zu viele Versuche. Bitte versuchen Sie es später erneut."
    },
    ru: {
      headingLogin: "войдите в свой аккаунт", headingRegister: "создайте свой аккаунт", headingForgot: "сбросьте пароль", leadLogin: "Один аккаунт для всех сервисов AllonaHub, HP, купонов и premium-преимуществ.", leadRegister: "Создайте аккаунт и соберите профессиональную панель и уведомления в одном профиле.", leadForgot: "Получите ссылку на e-mail для безопасного восстановления доступа.", titleLogin: "Вход AllonaHub", titleRegister: "Регистрация AllonaHub", titleForgot: "Сброс пароля AllonaHub", tabLogin: "Войти", tabRegister: "Регистрация", tabForgot: "Забыл пароль", methodEmail: "Вход по e-mail", methodPhone: "Вход по телефону", email: "E-mail", password: "Пароль", loginButton: "Войти", phoneLead: "Выберите страну; код будет отправлен с её телефонным кодом.", phone: "Номер телефона", sendCode: "Отправить код", otp: "6-значный код", verifyCode: "Подтвердить и продолжить", or: "или", googleLogin: "Войти через Google", appleLogin: "Войти через Apple / iCloud", googleRegister: "Регистрация через Google", appleRegister: "Регистрация через Apple / iCloud", partnerLogin: "Вход для партнёров", securityCenter: "Центр безопасности", fullName: "Имя и фамилия", sector: "Выберите сектор *", profession: "Найти и выбрать профессию *", professionNote: "Выбор профессии обязателен. Панель, вакансии и уведомления будут настроены для вас.", createPassword: "Создать пароль", repeatPassword: "Повторить пароль", passwordMismatch: "Пароли не совпадают.", createAccount: "Создать бесплатный аккаунт", resetButton: "Отправить ссылку для сброса", resetNote: "Ссылка будет отправлена по e-mail.", countrySearch: "Введите страну или код...", challengeLogin: "Проверка безопасности входа", challengeRegister: "Проверка безопасности регистрации", challengeForgot: "Проверка сброса пароля", appleUnavailable: "Вход Apple / iCloud пока не включён.", phoneUnavailable: "Вход по SMS пока не включён.", invalidPhone: "Введите корректный номер.", codeSent: "Код отправлен на {phone}.", invalidCode: "Введите 6-значный код.", phoneVerified: "Телефон подтверждён. Переходим в аккаунт.", phoneError: "Не удалось выполнить SMS-запрос.", oauthError: "Не удалось начать вход.", tooMany: "Слишком много попыток. Повторите позже."
    },
    ar: {
      headingLogin: "سجل الدخول إلى حسابك", headingRegister: "أنشئ حسابك", headingForgot: "أعد تعيين كلمة المرور", leadLogin: "حساب واحد لجميع خدمات AllonaHub ومزايا HP والقسائم والمزايا المميزة.", leadRegister: "أنشئ حسابك واجمع لوحة المهنة والإشعارات والمزايا في ملف واحد.", leadForgot: "أرسل رابط تحقق إلى بريدك لاستعادة الوصول بأمان.", titleLogin: "تسجيل دخول AllonaHub", titleRegister: "التسجيل في AllonaHub", titleForgot: "إعادة تعيين كلمة مرور AllonaHub", tabLogin: "تسجيل الدخول", tabRegister: "إنشاء حساب", tabForgot: "نسيت كلمة المرور", methodEmail: "الدخول بالبريد", methodPhone: "الدخول بالهاتف", email: "البريد الإلكتروني", password: "كلمة المرور", loginButton: "تسجيل الدخول", phoneLead: "اختر بلدك لإرسال الرمز بمفتاح الاتصال المناسب.", phone: "رقم الهاتف", sendCode: "إرسال رمز التحقق", otp: "رمز تحقق من 6 أرقام", verifyCode: "تأكيد الرمز والمتابعة", or: "أو", googleLogin: "الدخول بواسطة Google", appleLogin: "الدخول بواسطة Apple / iCloud", googleRegister: "التسجيل بواسطة Google", appleRegister: "التسجيل بواسطة Apple / iCloud", partnerLogin: "دخول الشريك", securityCenter: "مركز الأمان", fullName: "الاسم الكامل", sector: "اختر القطاع *", profession: "ابحث عن المهنة واخترها *", professionNote: "اختيار المهنة مطلوب. سيتم تخصيص اللوحة والوظائف والإشعارات لك.", createPassword: "إنشاء كلمة مرور", repeatPassword: "أعد كتابة كلمة المرور", passwordMismatch: "كلمتا المرور غير متطابقتين.", createAccount: "إنشاء حساب مجاني", resetButton: "إرسال رابط إعادة التعيين", resetNote: "سيُرسل رابط التحقق عبر البريد للأمان.", countrySearch: "اكتب اسم البلد أو الرمز...", challengeLogin: "فحص أمان الدخول", challengeRegister: "فحص أمان التسجيل", challengeForgot: "فحص أمان إعادة التعيين", appleUnavailable: "تسجيل Apple / iCloud غير مفعل حاليًا.", phoneUnavailable: "تسجيل الدخول برسالة SMS غير مفعل حاليًا.", invalidPhone: "أدخل رقم هاتف صحيحًا.", codeSent: "تم إرسال رمز إلى {phone}.", invalidCode: "أدخل رمز التحقق المكون من 6 أرقام.", phoneVerified: "تم تحقق الهاتف. جارٍ التوجيه إلى حسابك.", phoneError: "تعذر إكمال طلب SMS.", oauthError: "تعذر بدء تسجيل الدخول.", tooMany: "محاولات كثيرة. حاول مرة أخرى لاحقًا."
    }
  };

  copy.kk = Object.assign({}, copy.en, {
    headingLogin: "тіркелгіңізге кіріңіз", headingRegister: "тіркелгі жасаңыз", headingForgot: "құпия сөзді қалпына келтіріңіз", leadLogin: "Бір тіркелгімен AllonaHub қызметтеріне, HP, купондарға және premium артықшылықтарға қол жеткізіңіз.", leadRegister: "Жаңа тіркелгі жасап, кәсіби тақта мен хабарламаларды бір профильге жинаңыз.", leadForgot: "Тіркелгіге қауіпсіз қайту үшін e-mail мекенжайыңызға растау сілтемесін жіберіңіз.", titleLogin: "AllonaHub кіру", titleRegister: "AllonaHub тіркелу", titleForgot: "AllonaHub құпия сөзін қалпына келтіру", tabLogin: "Кіру", tabRegister: "Тіркелу", tabForgot: "Құпия сөзді ұмыттым", methodEmail: "E-mail арқылы кіру", methodPhone: "Телефонмен кіру", password: "Құпия сөз", loginButton: "Кіру", phoneLead: "Еліңізді таңдаңыз; растау коды сол елдің кодымен жіберіледі.", phone: "Телефон нөмірі", sendCode: "Растау кодын жіберу", otp: "6 таңбалы растау коды", verifyCode: "Кодты растап, жалғастыру", or: "немесе", googleLogin: "Google арқылы кіру", appleLogin: "Apple / iCloud арқылы кіру", googleRegister: "Google арқылы тіркелу", appleRegister: "Apple / iCloud арқылы тіркелу", partnerLogin: "Серіктес кіруі", securityCenter: "Қауіпсіздік орталығы", fullName: "Аты-жөні", sector: "Саланы таңдаңыз *", profession: "Мамандықты іздеп, таңдаңыз *", professionNote: "Мамандықты таңдау міндетті. Тақта, бос орындар және хабарламалар таңдауыңызға сай теңшеледі.", createPassword: "Құпия сөз жасау", repeatPassword: "Құпия сөзді қайталау", passwordMismatch: "Құпия сөздер сәйкес емес.", createAccount: "Тегін тіркелгі жасау", resetButton: "Қалпына келтіру сілтемесін жіберу", resetNote: "Растау сілтемесі e-mail арқылы жіберіледі.", countrySearch: "Ел атын немесе кодын жазыңыз...", challengeLogin: "Кіру қауіпсіздігін тексеру", challengeRegister: "Тіркелу қауіпсіздігін тексеру", challengeForgot: "Құпия сөзді қалпына келтіруді тексеру", appleUnavailable: "Apple / iCloud арқылы кіру әзірге қосылмаған.", phoneUnavailable: "SMS арқылы кіру әзірге қосылмаған.", invalidPhone: "Жарамды телефон нөмірін енгізіңіз.", codeSent: "Растау коды {phone} нөміріне жіберілді.", invalidCode: "6 таңбалы кодты енгізіңіз.", phoneVerified: "Телефон расталды. Тіркелгіге бағытталудасыз.", phoneError: "SMS өтінімін аяқтау мүмкін болмады.", oauthError: "Бұл тіркелгімен кіруді бастау мүмін болмады.", tooMany: "Өте көп әрекет. Біраздан кейін қайталаңыз."
  });
  copy.uz = Object.assign({}, copy.en, {
    headingLogin: "hisobingizga kiring", headingRegister: "hisobingizni yarating", headingForgot: "parolingizni tiklang", leadLogin: "Bitta hisob bilan barcha AllonaHub xizmatlari, HP, kuponlar va premium afzalliklardan foydalaning.", leadRegister: "Yangi hisob yarating va kasbingizga mos panel, bildirishnomalar hamda afzalliklarni bir profilda jamlang.", leadForgot: "Hisobga xavfsiz qaytish uchun e-pochtangizga tasdiqlash havolasini yuboring.", titleLogin: "AllonaHub kirish", titleRegister: "AllonaHub ro'yxatdan o'tish", titleForgot: "AllonaHub parolni tiklash", tabLogin: "Kirish", tabRegister: "Ro'yxatdan o'tish", tabForgot: "Parolni unutdim", methodEmail: "E-pochta bilan kirish", methodPhone: "Telefon bilan kirish", email: "E-pochta", password: "Parol", loginButton: "Kirish", phoneLead: "Mamlakatingizni tanlang; tasdiqlash kodi tegishli mamlakat kodi bilan yuboriladi.", phone: "Telefon raqami", sendCode: "Tasdiqlash kodini yuborish", otp: "6 xonali tasdiqlash kodi", verifyCode: "Kodni tasdiqlash va davom etish", or: "yoki", googleLogin: "Google bilan kirish", appleLogin: "Apple / iCloud bilan kirish", googleRegister: "Google bilan ro'yxatdan o'tish", appleRegister: "Apple / iCloud bilan ro'yxatdan o'tish", partnerLogin: "Hamkor kirishi", securityCenter: "Xavfsizlik markazi", fullName: "Ism-familiya", sector: "Sohani tanlang *", profession: "Kasbni qidiring va tanlang *", professionNote: "Kasb tanlash majburiy. Panel, ish e'lonlari va bildirishnomalar tanlovingizga moslashtiriladi.", createPassword: "Parol yarating", repeatPassword: "Parolni takrorlang", passwordMismatch: "Parollar mos emas.", createAccount: "Bepul hisob yaratish", resetButton: "Parolni tiklash havolasini yuborish", resetNote: "Tasdiqlash havolasi e-pochta orqali yuboriladi.", countrySearch: "Mamlakat nomi yoki kodini yozing...", challengeLogin: "Kirish xavfsizlik tekshiruvi", challengeRegister: "Ro'yxatdan o'tish xavfsizlik tekshiruvi", challengeForgot: "Parolni tiklash xavfsizlik tekshiruvi", appleUnavailable: "Apple / iCloud orqali kirish hali yoqilmagan.", phoneUnavailable: "SMS orqali kirish hali yoqilmagan.", invalidPhone: "To'g'ri telefon raqamini kiriting.", codeSent: "Tasdiqlash kodi {phone} raqamiga yuborildi.", invalidCode: "6 xonali tasdiqlash kodini kiriting.", phoneVerified: "Telefon tasdiqlandi. Hisobingizga yo'naltirilmoqda.", phoneError: "SMS so'rovi bajarilmadi.", oauthError: "Bu hisob bilan kirishni boshlab bo'lmadi.", tooMany: "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring."
  });
  copy.ky = Object.assign({}, copy.en, {
    headingLogin: "аккаунтуңузга кириңиз", headingRegister: "аккаунтуңузду түзүңүз", headingForgot: "сырсөзүңүздү калыбына келтириңиз", leadLogin: "Бир аккаунт менен AllonaHub кызматтарына, HP, купондорго жана premium артыкчылыктарга жетиңиз.", leadRegister: "Жаңы аккаунт түзүп, кесиптик панелди жана билдирүүлөрдү бир профилге топтоңуз.", leadForgot: "Аккаунтка коопсуз кайтуу үчүн e-mail'иңизге тастыктоо шилтемесин жөнөтүңүз.", titleLogin: "AllonaHub кирүү", titleRegister: "AllonaHub каттоо", titleForgot: "AllonaHub сырсөзүн калыбына келтирүү", tabLogin: "Кирүү", tabRegister: "Каттоо", tabForgot: "Сырсөздү унуттум", methodEmail: "E-mail менен кирүү", methodPhone: "Телефон менен кирүү", password: "Сырсөз", loginButton: "Кирүү", phoneLead: "Өлкөңүздү тандаңыз; тастыктоо коду ошол өлкөнүн коду менен жөнөтүлөт.", phone: "Телефон номуру", sendCode: "Тастыктоо кодун жөнөтүү", otp: "6 орундуу тастыктоо коду", verifyCode: "Кодду тастыктап, улантуу", or: "же", googleLogin: "Google менен кирүү", appleLogin: "Apple / iCloud менен кирүү", googleRegister: "Google менен каттоо", appleRegister: "Apple / iCloud менен каттоо", partnerLogin: "Өнөктөш кирүүсү", securityCenter: "Коопсуздук борбору", fullName: "Аты-жөнү", sector: "Тармакты тандаңыз *", profession: "Кесипти издеп, тандаңыз *", professionNote: "Кесипти тандоо милдеттүү. Панель, вакансиялар жана билдирүүлөр тандооңузга ылайыкташтырылат.", createPassword: "Сырсөз түзүү", repeatPassword: "Сырсөздү кайталоо", passwordMismatch: "Сырсөздөр дал келбейт.", createAccount: "Акысыз аккаунт түзүү", resetButton: "Калыбына келтирүү шилтемесин жөнөтүү", resetNote: "Тастыктоо шилтемеси e-mail аркылуу жөнөтүлөт.", countrySearch: "Өлкөнүн атын же кодун жазыңыз...", challengeLogin: "Кирүү коопсуздугун текшерүү", challengeRegister: "Каттоо коопсуздугун текшерүү", challengeForgot: "Сырсөздү калыбына келтирүүнү текшерүү", appleUnavailable: "Apple / iCloud менен кирүү азырынча иштетиле элек.", phoneUnavailable: "SMS менен кирүү азырынча иштетиле элек.", invalidPhone: "Жарактуу телефон номурун киргизиңиз.", codeSent: "Тастыктоо коду {phone} номуруна жөнөтүлдү.", invalidCode: "6 орундуу кодду киргизиңиз.", phoneVerified: "Телефон тастыкталды. Аккаунтуңузга багытталуудасыз.", phoneError: "SMS суроосу аягына чыккан жок.", oauthError: "Бул аккаунт менен кирүүнү баштоо мүмкүн болбоду.", tooMany: "Өтө көп аракет. Бир аздан кийин кайра аракет кылыңыз."
  });

  Object.assign(copy.tr, {
    leadRegister: "Ad, soyad, telefon ve e-posta bilgilerinle hesabını güvenli ve hızlı şekilde oluştur.",
    firstName: "Ad",
    lastName: "Soyad",
    requiredFirstName: "Ad zorunludur.",
    requiredLastName: "Soyad zorunludur.",
    invalidEmail: "Geçerli bir e-posta adresi giriniz.",
    passwordTooShort: "Şifre en az 8 karakter olmalıdır.",
    registerSuccess: "Kayıt başarılı. E-posta doğrulaması için gelen kutunu kontrol et.",
    registerError: "Kayıt oluşturulamadı. Lütfen bilgilerinizi kontrol edin.",
    accountExists: "Bu e-posta adresiyle zaten bir hesap var. Giriş yapın veya şifrenizi sıfırlayın.",
    challengeRequired: "Robot doğrulamasını tamamlayıp yeniden deneyin.",
    verificationTitle: "E-posta doğrulaması bekleniyor",
    verificationHelp: "Gelen kutusu ve spam klasörünü kontrol edin. Bağlantı gelmediyse yeniden gönderin.",
    resendConfirmation: "Doğrulama e-postasını yeniden gönder",
    resendConfirmationSuccess: "Hesap doğrulama bekliyorsa yeni e-posta gönderim isteği alındı. Gelen kutusu ve spam klasörünü kontrol edin.",
    resendConfirmationError: "Doğrulama e-postası gönderilemedi. Lütfen daha sonra yeniden deneyin.",
    emailRateLimited: "Doğrulama e-postası gönderim sınırına ulaşıldı. Kısa süre sonra yeniden deneyin veya Google ile kayıt olun.",
    back: "Geri Dön",
    home: "Ana Sayfa",
    moduleReturn: "Modüle Dön"
  });
  Object.assign(copy.az, {
    leadRegister: "Ad, soyad, telefon və e-poçt məlumatlarınızla hesabınızı təhlükəsiz və sürətli yaradın.",
    firstName: "Ad",
    lastName: "Soyad",
    requiredFirstName: "Adınızı daxil edin.",
    requiredLastName: "Soyadınızı daxil edin.",
    invalidEmail: "Düzgün e-poçt ünvanı daxil edin.",
    passwordTooShort: "Şifrə ən azı 8 simvoldan ibarət olmalıdır.",
    registerSuccess: "Qeydiyyat uğurla tamamlandı. E-poçt təsdiqi üçün gələnlər qutusunu yoxlayın.",
    registerError: "Qeydiyyat tamamlanmadı. Məlumatlarınızı yoxlayın.",
    accountExists: "Bu e-poçt ünvanı ilə artıq hesab var. Daxil olun və ya şifrənizi yeniləyin.",
    challengeRequired: "Robot yoxlamasını tamamlayıb yenidən sınayın.",
    verificationTitle: "E-poçt təsdiqi gözlənilir",
    verificationHelp: "Gələnlər və spam qovluğunu yoxlayın. Keçid gəlməyibsə yenidən göndərin.",
    resendConfirmation: "Təsdiq e-poçtunu yenidən göndər",
    resendConfirmationSuccess: "Hesab təsdiq gözləyirsə yeni e-poçt göndərmə sorğusu qəbul edildi. Gələnlər və spam qovluğunu yoxlayın.",
    resendConfirmationError: "Təsdiq e-poçtu göndərilə bilmədi. Daha sonra yenidən sınayın.",
    emailRateLimited: "Təsdiq e-poçtu göndərmə limiti dolub. Bir az sonra yenidən sınayın və ya Google ilə qeydiyyatdan keçin.",
    back: "Geri qayıt",
    home: "Ana səhifə",
    moduleReturn: "Modula qayıt"
  });
  Object.assign(copy.en, {
    leadRegister: "Create your account quickly and securely with your first name, last name, phone number and email.",
    firstName: "First name",
    lastName: "Last name",
    requiredFirstName: "First name is required.",
    requiredLastName: "Last name is required.",
    invalidEmail: "Enter a valid email address.",
    passwordTooShort: "Your password must be at least 8 characters.",
    registerSuccess: "Registration successful. Check your inbox to verify your email.",
    registerError: "Your account could not be created. Please check your details.",
    accountExists: "An account already exists for this email. Sign in or reset your password.",
    challengeRequired: "Complete the robot verification and try again.",
    verificationTitle: "Email verification pending",
    verificationHelp: "Check your inbox and spam folder. Resend the message if the link has not arrived.",
    resendConfirmation: "Resend verification email",
    resendConfirmationSuccess: "If the account is awaiting verification, a new email request was accepted. Check your inbox and spam folder.",
    resendConfirmationError: "The verification email could not be sent. Please try again later.",
    emailRateLimited: "The verification email limit has been reached. Try again shortly or register with Google.",
    back: "Go Back",
    home: "Home",
    moduleReturn: "Back to Module"
  });
  Object.assign(copy.de, {
    leadRegister: "Erstellen Sie Ihr Konto schnell und sicher mit Vorname, Nachname, Telefonnummer und E-Mail-Adresse.",
    firstName: "Vorname",
    lastName: "Nachname",
    requiredFirstName: "Der Vorname ist erforderlich.",
    requiredLastName: "Der Nachname ist erforderlich.",
    invalidEmail: "Geben Sie eine gültige E-Mail-Adresse ein.",
    passwordTooShort: "Das Passwort muss mindestens 8 Zeichen lang sein.",
    registerSuccess: "Registrierung erfolgreich. Prüfen Sie Ihren Posteingang, um Ihre E-Mail-Adresse zu bestätigen.",
    registerError: "Das Konto konnte nicht erstellt werden. Prüfen Sie Ihre Angaben.",
    accountExists: "Für diese E-Mail-Adresse besteht bereits ein Konto. Melden Sie sich an oder setzen Sie Ihr Passwort zurück.",
    challengeRequired: "Schließen Sie die Sicherheitsprüfung ab und versuchen Sie es erneut.",
    verificationTitle: "E-Mail-Bestätigung ausstehend",
    verificationHelp: "Prüfen Sie Posteingang und Spam-Ordner. Senden Sie die Nachricht erneut, falls kein Link angekommen ist.",
    resendConfirmation: "Bestätigungs-E-Mail erneut senden",
    resendConfirmationSuccess: "Falls das Konto auf Bestätigung wartet, wurde eine neue E-Mail-Anfrage angenommen.",
    resendConfirmationError: "Die Bestätigungs-E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.",
    emailRateLimited: "Das Sendelimit für Bestätigungs-E-Mails wurde erreicht. Versuchen Sie es später erneut oder registrieren Sie sich mit Google.",
    back: "Zurück",
    home: "Startseite",
    moduleReturn: "Zurück zum Modul"
  });
  Object.assign(copy.ru, {
    leadRegister: "Быстро и безопасно создайте аккаунт, указав имя, фамилию, телефон и e-mail.",
    firstName: "Имя",
    lastName: "Фамилия",
    requiredFirstName: "Введите имя.",
    requiredLastName: "Введите фамилию.",
    invalidEmail: "Введите корректный адрес электронной почты.",
    passwordTooShort: "Пароль должен содержать не менее 8 символов.",
    registerSuccess: "Регистрация завершена. Проверьте почту для подтверждения адреса.",
    registerError: "Не удалось создать аккаунт. Проверьте введённые данные.",
    accountExists: "Для этого адреса уже существует аккаунт. Войдите или сбросьте пароль.",
    challengeRequired: "Завершите проверку безопасности и повторите попытку.",
    verificationTitle: "Ожидается подтверждение e-mail",
    verificationHelp: "Проверьте входящие и папку спам. Если ссылка не пришла, отправьте письмо повторно.",
    resendConfirmation: "Отправить письмо повторно",
    resendConfirmationSuccess: "Если аккаунт ожидает подтверждения, новый запрос на отправку письма принят.",
    resendConfirmationError: "Не удалось отправить письмо подтверждения. Повторите попытку позже.",
    emailRateLimited: "Достигнут лимит писем подтверждения. Повторите позже или зарегистрируйтесь через Google.",
    back: "Назад",
    home: "Главная",
    moduleReturn: "Вернуться в модуль"
  });
  Object.assign(copy.ar, {
    leadRegister: "أنشئ حسابك بسرعة وأمان باستخدام الاسم واسم العائلة ورقم الهاتف والبريد الإلكتروني.",
    firstName: "الاسم",
    lastName: "اسم العائلة",
    requiredFirstName: "الاسم مطلوب.",
    requiredLastName: "اسم العائلة مطلوب.",
    invalidEmail: "أدخل عنوان بريد إلكتروني صحيحًا.",
    passwordTooShort: "يجب ألا تقل كلمة المرور عن 8 أحرف.",
    registerSuccess: "تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيد العنوان.",
    registerError: "تعذر إنشاء الحساب. يرجى التحقق من بياناتك.",
    accountExists: "يوجد حساب بهذا البريد الإلكتروني. سجل الدخول أو أعد تعيين كلمة المرور.",
    challengeRequired: "أكمل التحقق الأمني ثم حاول مرة أخرى.",
    verificationTitle: "التحقق من البريد الإلكتروني قيد الانتظار",
    verificationHelp: "تحقق من صندوق الوارد ومجلد الرسائل غير المرغوب فيها. أعد الإرسال إذا لم يصل الرابط.",
    resendConfirmation: "إعادة إرسال بريد التحقق",
    resendConfirmationSuccess: "إذا كان الحساب ينتظر التحقق فقد تم قبول طلب إرسال بريد جديد.",
    resendConfirmationError: "تعذر إرسال بريد التحقق. حاول مرة أخرى لاحقًا.",
    emailRateLimited: "تم بلوغ حد رسائل التحقق. حاول لاحقًا أو سجّل بواسطة Google.",
    back: "رجوع",
    home: "الصفحة الرئيسية",
    moduleReturn: "العودة إلى الوحدة"
  });
  Object.assign(copy.kk, {
    leadRegister: "Аты-жөніңізді, телефон нөміріңізді және e-mail мекенжайыңызды енгізіп, тіркелгіні жылдам әрі қауіпсіз жасаңыз.",
    firstName: "Аты",
    lastName: "Тегі",
    requiredFirstName: "Атыңызды енгізіңіз.",
    requiredLastName: "Тегіңізді енгізіңіз.",
    invalidEmail: "Жарамды e-mail мекенжайын енгізіңіз.",
    passwordTooShort: "Құпия сөз кемінде 8 таңбадан тұруы керек.",
    registerSuccess: "Тіркелу сәтті аяқталды. E-mail мекенжайын растау үшін поштаңызды тексеріңіз.",
    registerError: "Тіркелгі жасалмады. Мәліметтеріңізді тексеріңіз.",
    accountExists: "Бұл e-mail үшін тіркелгі бар. Кіріңіз немесе құпия сөзді қалпына келтіріңіз.",
    challengeRequired: "Қауіпсіздік тексеруін аяқтап, қайта көріңіз.",
    verificationTitle: "E-mail растауы күтілуде",
    verificationHelp: "Кіріс және спам қалталарын тексеріңіз. Сілтеме келмесе, хатты қайта жіберіңіз.",
    resendConfirmation: "Растау хатын қайта жіберу",
    resendConfirmationSuccess: "Тіркелгі растауды күтсе, жаңа хат жіберу сұрауы қабылданды.",
    resendConfirmationError: "Растау хаты жіберілмеді. Кейінірек қайталаңыз.",
    emailRateLimited: "Растау хаттарының шегіне жетті. Кейінірек қайталаңыз немесе Google арқылы тіркеліңіз.",
    back: "Артқа",
    home: "Басты бет",
    moduleReturn: "Модульге оралу"
  });
  Object.assign(copy.uz, {
    leadRegister: "Ism, familiya, telefon raqami va e-pochta orqali hisobingizni tez va xavfsiz yarating.",
    firstName: "Ism",
    lastName: "Familiya",
    requiredFirstName: "Ismingizni kiriting.",
    requiredLastName: "Familiyangizni kiriting.",
    invalidEmail: "To'g'ri e-pochta manzilini kiriting.",
    passwordTooShort: "Parol kamida 8 ta belgidan iborat bo'lishi kerak.",
    registerSuccess: "Ro'yxatdan o'tish yakunlandi. E-pochtani tasdiqlash uchun kiruvchi xatlarni tekshiring.",
    registerError: "Hisob yaratilmadi. Ma'lumotlaringizni tekshiring.",
    accountExists: "Bu e-pochta uchun hisob mavjud. Kiring yoki parolni tiklang.",
    challengeRequired: "Xavfsizlik tekshiruvini yakunlab, qayta urinib ko'ring.",
    verificationTitle: "E-pochta tasdig'i kutilmoqda",
    verificationHelp: "Kiruvchi va spam papkalarini tekshiring. Havola kelmasa, xatni qayta yuboring.",
    resendConfirmation: "Tasdiqlash xatini qayta yuborish",
    resendConfirmationSuccess: "Hisob tasdiqni kutayotgan bo'lsa, yangi xat yuborish so'rovi qabul qilindi.",
    resendConfirmationError: "Tasdiqlash xati yuborilmadi. Keyinroq qayta urinib ko'ring.",
    emailRateLimited: "Tasdiqlash xatlari limiti tugadi. Keyinroq urinib ko'ring yoki Google bilan ro'yxatdan o'ting.",
    back: "Orqaga",
    home: "Bosh sahifa",
    moduleReturn: "Modulga qaytish"
  });
  Object.assign(copy.ky, {
    leadRegister: "Атыңыз, фамилияңыз, телефон номериңиз жана e-mail менен аккаунтуңузду тез жана коопсуз түзүңүз.",
    firstName: "Аты",
    lastName: "Фамилиясы",
    requiredFirstName: "Атыңызды киргизиңиз.",
    requiredLastName: "Фамилияңызды киргизиңиз.",
    invalidEmail: "Жарактуу e-mail дарегин киргизиңиз.",
    passwordTooShort: "Сырсөз кеминде 8 белгиден турушу керек.",
    registerSuccess: "Каттоо аяктады. E-mail дарегин тастыктоо үчүн почтаңызды текшериңиз.",
    registerError: "Аккаунт түзүлгөн жок. Маалыматтарыңызды текшериңиз.",
    accountExists: "Бул e-mail үчүн аккаунт бар. Кириңиз же сырсөздү калыбына келтириңиз.",
    challengeRequired: "Коопсуздук текшерүүсүн бүтүрүп, кайра аракет кылыңыз.",
    verificationTitle: "E-mail тастыктоосу күтүлүүдө",
    verificationHelp: "Кирген каттарды жана спам папкасын текшериңиз. Шилтеме келбесе, катты кайра жөнөтүңүз.",
    resendConfirmation: "Тастыктоо катын кайра жөнөтүү",
    resendConfirmationSuccess: "Аккаунт тастыктоону күтүп жатса, жаңы кат жөнөтүү өтүнүчү кабыл алынды.",
    resendConfirmationError: "Тастыктоо каты жөнөтүлгөн жок. Кийинчерээк кайра аракет кылыңыз.",
    emailRateLimited: "Тастыктоо каттарынын чеги бүттү. Кийинчерээк кайталаңыз же Google менен катталыңыз.",
    back: "Артка",
    home: "Башкы бет",
    moduleReturn: "Модулга кайтуу"
  });

  const emailCodeCopy = {
    tr: {
      verificationHelp: "Gelen kutusu ve spam klasöründeki 6 haneli kodu girin.",
      verificationCodeLabel: "6 haneli doğrulama kodu",
      verifyEmailCode: "Kodu Doğrula",
      verificationCodeInvalid: "6 haneli doğrulama kodunu girin.",
      verificationCodeSuccess: "E-posta adresiniz doğrulandı. Hesabınıza güvenle giriş yapabilirsiniz.",
      verificationCodeError: "Doğrulama tamamlanamadı. Yeni kod isteyip tekrar deneyin.",
      resendConfirmation: "Yeni kod gönder"
    },
    az: {
      verificationHelp: "Gələnlər və spam qovluğundakı 6 rəqəmli kodu daxil edin.",
      verificationCodeLabel: "6 rəqəmli təsdiq kodu",
      verifyEmailCode: "Kodu təsdiqlə",
      verificationCodeInvalid: "6 rəqəmli təsdiq kodunu daxil edin.",
      verificationCodeSuccess: "E-poçt ünvanınız təsdiqləndi. Hesabınıza təhlükəsiz daxil ola bilərsiniz.",
      verificationCodeError: "Təsdiq tamamlanmadı. Yeni kod istəyib yenidən sınayın.",
      resendConfirmation: "Yeni kod göndər"
    },
    en: {
      verificationHelp: "Enter the 6-digit code from your inbox or spam folder.",
      verificationCodeLabel: "6-digit verification code",
      verifyEmailCode: "Verify Code",
      verificationCodeInvalid: "Enter the 6-digit verification code.",
      verificationCodeSuccess: "Your email address is verified. You can now sign in securely.",
      verificationCodeError: "Verification could not be completed. Request a new code and try again.",
      resendConfirmation: "Send new code"
    },
    de: {
      verificationHelp: "Geben Sie den 6-stelligen Code aus Ihrem Posteingang oder Spam-Ordner ein.",
      verificationCodeLabel: "6-stelliger Bestätigungscode",
      verifyEmailCode: "Code bestätigen",
      verificationCodeInvalid: "Geben Sie den 6-stelligen Bestätigungscode ein.",
      verificationCodeSuccess: "Ihre E-Mail-Adresse wurde bestätigt. Sie können sich jetzt sicher anmelden.",
      verificationCodeError: "Die Bestätigung konnte nicht abgeschlossen werden. Fordern Sie einen neuen Code an.",
      resendConfirmation: "Neuen Code senden"
    },
    ru: {
      verificationHelp: "Введите 6-значный код из входящих или папки спам.",
      verificationCodeLabel: "6-значный код подтверждения",
      verifyEmailCode: "Подтвердить код",
      verificationCodeInvalid: "Введите 6-значный код подтверждения.",
      verificationCodeSuccess: "Адрес электронной почты подтверждён. Теперь можно безопасно войти.",
      verificationCodeError: "Не удалось завершить подтверждение. Запросите новый код и повторите попытку.",
      resendConfirmation: "Отправить новый код"
    },
    ar: {
      verificationHelp: "أدخل الرمز المكون من 6 أرقام من صندوق الوارد أو الرسائل غير المرغوب فيها.",
      verificationCodeLabel: "رمز تحقق من 6 أرقام",
      verifyEmailCode: "تأكيد الرمز",
      verificationCodeInvalid: "أدخل رمز التحقق المكون من 6 أرقام.",
      verificationCodeSuccess: "تم تأكيد بريدك الإلكتروني. يمكنك الآن تسجيل الدخول بأمان.",
      verificationCodeError: "تعذر إكمال التحقق. اطلب رمزًا جديدًا وحاول مرة أخرى.",
      resendConfirmation: "إرسال رمز جديد"
    },
    kk: {
      verificationHelp: "Кіріс немесе спам қалтасындағы 6 таңбалы кодты енгізіңіз.",
      verificationCodeLabel: "6 таңбалы растау коды",
      verifyEmailCode: "Кодты растау",
      verificationCodeInvalid: "6 таңбалы растау кодын енгізіңіз.",
      verificationCodeSuccess: "E-mail мекенжайыңыз расталды. Енді қауіпсіз кіре аласыз.",
      verificationCodeError: "Растау аяқталмады. Жаңа код сұрап, қайталап көріңіз.",
      resendConfirmation: "Жаңа код жіберу"
    },
    uz: {
      verificationHelp: "Kiruvchi yoki spam papkasidagi 6 xonali kodni kiriting.",
      verificationCodeLabel: "6 xonali tasdiqlash kodi",
      verifyEmailCode: "Kodni tasdiqlash",
      verificationCodeInvalid: "6 xonali tasdiqlash kodini kiriting.",
      verificationCodeSuccess: "E-pochta manzilingiz tasdiqlandi. Endi xavfsiz kirishingiz mumkin.",
      verificationCodeError: "Tasdiqlash yakunlanmadi. Yangi kod so'rab, qayta urinib ko'ring.",
      resendConfirmation: "Yangi kod yuborish"
    },
    ky: {
      verificationHelp: "Кирген каттар же спам папкасындагы 6 орундуу кодду киргизиңиз.",
      verificationCodeLabel: "6 орундуу тастыктоо коду",
      verifyEmailCode: "Кодду тастыктоо",
      verificationCodeInvalid: "6 орундуу тастыктоо кодун киргизиңиз.",
      verificationCodeSuccess: "E-mail дарегиңиз тастыкталды. Эми коопсуз кире аласыз.",
      verificationCodeError: "Тастыктоо аяктаган жок. Жаңы код сурап, кайра аракет кылыңыз.",
      resendConfirmation: "Жаңы код жөнөтүү"
    }
  };
  Object.entries(emailCodeCopy).forEach(([language, messages]) => Object.assign(copy[language], messages));

  const pageSections = {
    tr: {
      search: "Ara", searchPlaceholder: "HP, kupon, üyelik, destek veya güvenlik ara...", coupon: "Kupon", premium: "Premium",
      joinTitle: "Ekosisteme katıl", joinLead: "Partner olmak isteyen işletmeler başvuru formuna geçebilir; mevcut partnerler panel girişinden hesaplarına ulaşabilir.", partnerApply: "Partner Başvurusu Yap",
      advantagesTitle: "AllonaHub Avantajları", viewAll: "Tümünü Gör", hpWorld: "HP Dünyası", hpWorldDesc: "Alışveriş, görev ve partner işlemlerinden HP kazan. HP ile kupon oluştur ve avantajlardan yararlan.",
      professionPanel: "Mesleğe Özel Panel", professionPanelDesc: "Denizci, doktor, çiftçi, avukat veya farklı meslek grupları için kişiselleştirilmiş deneyim.",
      smartNotifications: "Akıllı Bildirimler", smartNotificationsDesc: "İş ilanları, kampanyalar ve partner fırsatları mesleğine göre sana özel gösterilir.",
      premiumAdvantages: "Premium Avantajlar", premiumAdvantagesDesc: "A+, Gold, Elite Black ve Legend üyelikleri ile özel fırsatların kilidini aç."
    },
    az: {
      search: "Axtar", searchPlaceholder: "HP, kupon, üzvlük, dəstək və ya təhlükəsizlik axtar...", coupon: "Kupon", premium: "Premium",
      joinTitle: "Ekosistemə qoşul", joinLead: "Partner olmaq istəyən müəssisələr müraciət formasına keçə, mövcud partnerlər isə panel girişindən hesablarına daxil ola bilər.", partnerApply: "Partner müraciəti et",
      advantagesTitle: "AllonaHub üstünlükləri", viewAll: "Hamısına bax", hpWorld: "HP dünyası", hpWorldDesc: "Alış-veriş, tapşırıq və partner əməliyyatlarından HP qazan. HP ilə kupon yarat və üstünlüklərdən yararlan.",
      professionPanel: "Peşəyə uyğun panel", professionPanelDesc: "Dənizçi, həkim, fermer, hüquqşünas və digər peşə qrupları üçün fərdiləşdirilmiş təcrübə.",
      smartNotifications: "Ağıllı bildirişlər", smartNotificationsDesc: "İş elanları, kampaniyalar və partner imkanları peşənə uyğun göstərilir.",
      premiumAdvantages: "Premium üstünlüklər", premiumAdvantagesDesc: "A+, Gold, Elite Black və Legend üzvlükləri ilə xüsusi imkanları aç."
    },
    en: {
      search: "Search", searchPlaceholder: "Search HP, coupons, membership, support or security...", coupon: "Coupons", premium: "Premium",
      joinTitle: "Join the ecosystem", joinLead: "Businesses that want to become partners can open the application form; existing partners can access their accounts from the partner login.", partnerApply: "Apply as a Partner",
      advantagesTitle: "AllonaHub Benefits", viewAll: "View All", hpWorld: "HP World", hpWorldDesc: "Earn HP from shopping, tasks and partner transactions. Create coupons with HP and enjoy the benefits.",
      professionPanel: "Profession-Specific Panel", professionPanelDesc: "A personalized experience for seafarers, doctors, farmers, lawyers and other professional groups.",
      smartNotifications: "Smart Notifications", smartNotificationsDesc: "Job listings, campaigns and partner opportunities are shown according to your profession.",
      premiumAdvantages: "Premium Benefits", premiumAdvantagesDesc: "Unlock special opportunities with A+, Gold, Elite Black and Legend memberships."
    },
    de: {
      search: "Suchen", searchPlaceholder: "HP, Coupons, Mitgliedschaft, Support oder Sicherheit suchen...", coupon: "Coupons", premium: "Premium",
      joinTitle: "Dem Ökosystem beitreten", joinLead: "Unternehmen können das Partnerformular öffnen; bestehende Partner erreichen ihr Konto über den Partner-Login.", partnerApply: "Partnerantrag stellen",
      advantagesTitle: "AllonaHub Vorteile", viewAll: "Alle anzeigen", hpWorld: "HP-Welt", hpWorldDesc: "Sammeln Sie HP durch Einkäufe, Aufgaben und Partnertransaktionen. Erstellen Sie Coupons mit HP und nutzen Sie Vorteile.",
      professionPanel: "Berufsspezifisches Panel", professionPanelDesc: "Eine personalisierte Erfahrung für Seeleute, Ärzte, Landwirte, Juristen und weitere Berufsgruppen.",
      smartNotifications: "Intelligente Benachrichtigungen", smartNotificationsDesc: "Stellenangebote, Kampagnen und Partnerchancen werden passend zu Ihrem Beruf angezeigt.",
      premiumAdvantages: "Premium-Vorteile", premiumAdvantagesDesc: "Schalten Sie mit A+, Gold, Elite Black und Legend besondere Möglichkeiten frei."
    },
    ru: {
      search: "Поиск", searchPlaceholder: "Поиск HP, купонов, подписки, поддержки или безопасности...", coupon: "Купоны", premium: "Premium",
      joinTitle: "Присоединиться к экосистеме", joinLead: "Новые компании могут открыть форму заявки, а действующие партнёры войти в аккаунт через партнёрский вход.", partnerApply: "Подать заявку партнёра",
      advantagesTitle: "Преимущества AllonaHub", viewAll: "Показать все", hpWorld: "Мир HP", hpWorldDesc: "Получайте HP за покупки, задания и операции партнёров. Создавайте купоны за HP и пользуйтесь преимуществами.",
      professionPanel: "Панель по профессии", professionPanelDesc: "Персонализированный интерфейс для моряков, врачей, фермеров, юристов и других специалистов.",
      smartNotifications: "Умные уведомления", smartNotificationsDesc: "Вакансии, кампании и предложения партнёров показываются с учётом вашей профессии.",
      premiumAdvantages: "Преимущества Premium", premiumAdvantagesDesc: "Откройте особые возможности с подписками A+, Gold, Elite Black и Legend."
    },
    ar: {
      search: "بحث", searchPlaceholder: "ابحث عن HP أو القسائم أو العضوية أو الدعم أو الأمان...", coupon: "القسائم", premium: "بريميوم",
      joinTitle: "انضم إلى المنظومة", joinLead: "يمكن للأنشطة الراغبة في الشراكة فتح نموذج الطلب، ويمكن للشركاء الحاليين دخول حساباتهم من صفحة الشركاء.", partnerApply: "تقديم طلب شراكة",
      advantagesTitle: "مزايا AllonaHub", viewAll: "عرض الكل", hpWorld: "عالم HP", hpWorldDesc: "اكسب HP من التسوق والمهام ومعاملات الشركاء، وأنشئ قسائم واستفد من المزايا.",
      professionPanel: "لوحة مخصصة للمهنة", professionPanelDesc: "تجربة مخصصة للبحارة والأطباء والمزارعين والمحامين وغيرهم من أصحاب المهن.",
      smartNotifications: "إشعارات ذكية", smartNotificationsDesc: "تظهر الوظائف والحملات وفرص الشركاء بما يتناسب مع مهنتك.",
      premiumAdvantages: "مزايا بريميوم", premiumAdvantagesDesc: "افتح فرصًا خاصة مع عضويات A+ وGold وElite Black وLegend."
    },
    kk: {
      search: "Іздеу", searchPlaceholder: "HP, купон, мүшелік, қолдау немесе қауіпсіздікті іздеу...", coupon: "Купон", premium: "Premium",
      joinTitle: "Экожүйеге қосылу", joinLead: "Серіктес болғысы келетін компаниялар өтінім нысанын аша алады, ал қазіргі серіктестер панель арқылы тіркелгісіне кіреді.", partnerApply: "Серіктестік өтінім беру",
      advantagesTitle: "AllonaHub артықшылықтары", viewAll: "Барлығын көру", hpWorld: "HP әлемі", hpWorldDesc: "Сатып алу, тапсырма және серіктес операцияларынан HP жинаңыз. HP арқылы купон жасап, артықшылықтарды пайдаланыңыз.",
      professionPanel: "Мамандыққа арналған панель", professionPanelDesc: "Теңізші, дәрігер, фермер, заңгер және басқа мамандықтарға арналған жеке тәжірибе.",
      smartNotifications: "Ақылды хабарландырулар", smartNotificationsDesc: "Жұмыс орындары, науқандар және серіктес мүмкіндіктері мамандығыңызға сай көрсетіледі.",
      premiumAdvantages: "Premium артықшылықтары", premiumAdvantagesDesc: "A+, Gold, Elite Black және Legend мүшеліктерімен арнайы мүмкіндіктерді ашыңыз."
    },
    uz: {
      search: "Qidirish", searchPlaceholder: "HP, kupon, a'zolik, yordam yoki xavfsizlikni qidiring...", coupon: "Kupon", premium: "Premium",
      joinTitle: "Ekotizimga qo'shiling", joinLead: "Hamkor bo'lishni istagan korxonalar ariza shaklini ochishi, amaldagi hamkorlar esa panel orqali hisobiga kirishi mumkin.", partnerApply: "Hamkorlik arizasini yuborish",
      advantagesTitle: "AllonaHub afzalliklari", viewAll: "Barchasini ko'rish", hpWorld: "HP dunyosi", hpWorldDesc: "Xaridlar, vazifalar va hamkorlik amallaridan HP ishlang. HP bilan kupon yarating va afzalliklardan foydalaning.",
      professionPanel: "Kasbga mos panel", professionPanelDesc: "Dengizchi, shifokor, fermer, huquqshunos va boshqa kasb guruhlari uchun moslashtirilgan tajriba.",
      smartNotifications: "Aqlli bildirishnomalar", smartNotificationsDesc: "Ish e'lonlari, kampaniyalar va hamkorlik imkoniyatlari kasbingizga mos ko'rsatiladi.",
      premiumAdvantages: "Premium afzalliklar", premiumAdvantagesDesc: "A+, Gold, Elite Black va Legend a'zoliklari bilan maxsus imkoniyatlarni oching."
    },
    ky: {
      search: "Издөө", searchPlaceholder: "HP, купон, мүчөлүк, колдоо же коопсуздукту издеңиз...", coupon: "Купон", premium: "Premium",
      joinTitle: "Экосистемага кошулуу", joinLead: "Өнөктөш болгусу келген ишканалар арыз формасын ача алат, ал эми учурдагы өнөктөштөр панель аркылуу аккаунтуна кирет.", partnerApply: "Өнөктөштүк арыз берүү",
      advantagesTitle: "AllonaHub артыкчылыктары", viewAll: "Баарын көрүү", hpWorld: "HP дүйнөсү", hpWorldDesc: "Соода, тапшырма жана өнөктөш операцияларынан HP топтоңуз. HP менен купон түзүп, артыкчылыктарды колдонуңуз.",
      professionPanel: "Кесипке ылайык панель", professionPanelDesc: "Деңизчи, дарыгер, фермер, юрист жана башка кесип топтору үчүн жекелештирилген тажрыйба.",
      smartNotifications: "Акылдуу билдирмелер", smartNotificationsDesc: "Жумуш жарыялары, өнөктөш кампаниялары жана мүмкүнчүлүктөр кесибиңизге ылайык көрсөтүлөт.",
      premiumAdvantages: "Premium артыкчылыктар", premiumAdvantagesDesc: "A+, Gold, Elite Black жана Legend мүчөлүктөрү менен атайын мүмкүнчүлүктөрдү ачыңыз."
    }
  };
  Object.entries(pageSections).forEach(function (entry) {
    Object.assign(copy[entry[0]], entry[1]);
  });

  let activeTab = "login";
  let capabilities = null;

  function runtime() {
    return window.AllonaAuthRuntime || null;
  }

  function language() {
    const selected = String(localStorage.getItem("allona.language") || document.documentElement.lang || "tr").toLowerCase();
    return copy[selected] ? selected : "tr";
  }

  function t(key, replacements) {
    const pack = copy[language()] || copy.tr;
    let value = String(pack[key] || copy.tr[key] || key);
    Object.entries(replacements || {}).forEach(function (entry) {
      value = value.replaceAll("{" + entry[0] + "}", String(entry[1]));
    });
    return value;
  }

  function text(id, value) {
    const node = document.getElementById(id);
    if (node && node.textContent !== value) node.textContent = value;
  }

  function placeholder(id, value) {
    const node = document.getElementById(id);
    if (node && node.getAttribute("placeholder") !== value) node.setAttribute("placeholder", value);
  }

  function label(forId, value) {
    const node = document.querySelector('label[for="' + forId + '"]');
    if (node && node.textContent !== value) node.textContent = value;
  }

  function applyChallengeLabels() {
    document.querySelectorAll("[data-security-challenge]").forEach(function (host) {
      const action = host.dataset.securityChallenge;
      const value = action === "register" ? t("challengeRegister") : action === "forgot_password" ? t("challengeForgot") : t("challengeLogin");
      const label = host.querySelector(".allonahub-turnstile__label");
      if (label && label.textContent !== value) label.textContent = value;
      host.setAttribute("aria-label", value);
    });
  }

  function applyTranslations() {
    const selectedLanguage = language();
    document.documentElement.lang = selectedLanguage;
    document.documentElement.dir = selectedLanguage === "ar" ? "rtl" : "ltr";
    text("authBackLabel", t("back"));
    text("authHomeLink", t("home"));
    const moduleReturn = document.querySelector("#authModuleReturn span");
    if (moduleReturn && moduleReturn.textContent !== t("moduleReturn")) moduleReturn.textContent = t("moduleReturn");
    text("authTabLogin", t("tabLogin"));
    text("authTabRegister", t("tabRegister"));
    text("authTabForgot", t("tabForgot"));
    document.querySelectorAll("[data-auth-text]").forEach(function (node) {
      const value = t(node.dataset.authText);
      if (node.textContent !== value) node.textContent = value;
    });
    placeholder("loginEmail", t("email"));
    placeholder("userSearchInput", t("searchPlaceholder"));
    placeholder("loginPassword", t("password"));
    placeholder("firstName", t("firstName"));
    placeholder("lastName", t("lastName"));
    placeholder("registerEmail", t("email"));
    placeholder("registerPhone", t("phone"));
    placeholder("password1", t("createPassword"));
    placeholder("password2", t("repeatPassword"));
    placeholder("forgotEmail", t("email"));
    label("firstName", t("firstName"));
    label("lastName", t("lastName"));
    label("registerEmail", t("email"));
    label("registerPhone", t("phone"));
    label("password1", t("createPassword"));
    label("password2", t("repeatPassword"));
    document.querySelectorAll(".country-search").forEach(function (node) {
      if (node.getAttribute("placeholder") !== t("countrySearch")) node.setAttribute("placeholder", t("countrySearch"));
    });
    text("passwordWarning", t("passwordMismatch"));
    if (typeof window.checkPasswords === "function") window.checkPasswords();
    else text("registerBtn", t("createAccount"));
    const resetButton = document.querySelector("#forgot > .btn");
    if (resetButton && resetButton.textContent !== t("resetButton")) resetButton.textContent = t("resetButton");
    const resetNote = document.querySelector("#forgot > p");
    if (resetNote && resetNote.textContent !== t("resetNote")) resetNote.textContent = t("resetNote");
    const partnerButton = document.querySelector("#login .partner-panel-btn");
    if (partnerButton && partnerButton.textContent !== t("partnerLogin")) partnerButton.textContent = t("partnerLogin");
    const securityLink = document.querySelector("#login .link-row a");
    if (securityLink && securityLink.textContent !== t("securityCenter")) securityLink.textContent = t("securityCenter");
    applyChallengeLabels();
    renderTab(activeTab, true);
    updateProviderControls();
  }

  function renderTab(tab, skipTranslations) {
    activeTab = ["login", "register", "forgot"].includes(tab) ? tab : "login";
    const suffix = activeTab === "register" ? "Register" : activeTab === "forgot" ? "Forgot" : "Login";
    const heading = document.querySelector("[data-auth-heading]");
    const lead = document.getElementById("authLead");
    if (heading && heading.textContent !== t("heading" + suffix)) heading.textContent = t("heading" + suffix);
    if (lead && lead.textContent !== t("lead" + suffix)) lead.textContent = t("lead" + suffix);
    document.title = t("title" + suffix);
    if (!skipTranslations) applyTranslations();
  }

  function showMessage(message) {
    const rt = runtime();
    if (rt && rt.showMessage) rt.showMessage(message);
  }

  function updateProviderControls() {
    document.querySelectorAll("[data-auth-provider]").forEach(function (button) {
      const unavailable = Boolean(capabilities && capabilities.google === false);
      button.disabled = unavailable;
      button.setAttribute("aria-disabled", String(unavailable));
      if (unavailable) button.title = t("oauthError");
      else button.removeAttribute("title");
    });
  }

  async function loadCapabilities() {
    const app = window.Allona || {};
    const config = app.config || {};
    if (!config.supabaseUrl || !config.supabaseAnonKey) return;
    try {
      const response = await fetch(String(config.supabaseUrl).replace(/\/$/, "") + "/auth/v1/settings", {
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: "Bearer " + config.supabaseAnonKey
        }
      });
      if (!response.ok) return;
      const settings = await response.json();
      const external = settings && settings.external ? settings.external : {};
      capabilities = {
        google: external.google !== false,
        email: external.email !== false
      };
      updateProviderControls();
    } catch (error) {
      capabilities = null;
    }
  }

  async function loginWithOAuth() {
    if (capabilities && capabilities.google === false) {
      showMessage(t("oauthError"));
      return;
    }
    const rt = runtime();
    if (!rt || !rt.client) {
      showMessage(t("oauthError"));
      return;
    }
    try {
      if (rt.setManualAuth) rt.setManualAuth(true);
      const returnTo = rt.safeReturnTo ? rt.safeReturnTo("user-panel.html") : new URL("user-panel.html", window.location.href).href;
      const redirect = new URL("/pages/account/user.html", window.location.origin);
      redirect.searchParams.set("returnTo", returnTo);
      const options = { redirectTo: redirect.href };
      options.queryParams = { access_type: "offline", prompt: "select_account" };
      sessionStorage.setItem("allonahub.oauth.returnTo", returnTo);
      sessionStorage.setItem("allonahub.oauth.mode", activeTab === "register" ? "register" : "login");
      const result = await rt.client.auth.signInWithOAuth({ provider: "google", options: options });
      if (result.error) throw result.error;
    } catch (error) {
      if (rt.setManualAuth) rt.setManualAuth(false);
      showMessage(t("oauthError"));
    }
  }

  function init() {
    const selectedTab = document.querySelector("[data-auth-tab].active");
    activeTab = selectedTab && selectedTab.dataset.authTab || "login";
    applyTranslations();
    loadCapabilities();
    const observer = new MutationObserver(function (mutations) {
      if (mutations.some(function (mutation) { return mutation.addedNodes && mutation.addedNodes.length; })) applyChallengeLabels();
    });
    const loginBox = document.querySelector(".login-box");
    if (loginBox) observer.observe(loginBox, { childList: true, subtree: true });
  }

  window.AllonaAuthPage = {
    applyTranslations: applyTranslations,
    loadCapabilities: loadCapabilities,
    loginWithOAuth: loginWithOAuth,
    renderTab: renderTab,
    translate: t
  };

  document.addEventListener("allona:language-changed", applyTranslations);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
