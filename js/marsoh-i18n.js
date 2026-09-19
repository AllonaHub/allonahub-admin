(function () {
  "use strict";

  const SUPPORTED = ["tr", "az", "en", "de", "ru", "ar", "kk", "uz", "ky"];
  const SPEECH_LOCALES = {
    tr: "tr-TR", az: "az-AZ", en: "en-US", de: "de-DE", ru: "ru-RU",
    ar: "ar-SA", kk: "kk-KZ", uz: "uz-UZ", ky: "ky-KG"
  };

  const COPY = {
    tr: {
      skip: "Mesajlara geç", back: "Geri Dön", home: "Ana Sayfa", module: "Modüle Dön", language: "Dil",
      loginRequired: "MarSoh'u kullanmak için aktif AllonaHub hesabınızla giriş yapın.", signIn: "Giriş Yap",
      tagline: "Denizcilerin küresel sohbet ağı", rooms: "Odalar", live: "Canlı", offline: "Çevrimdışı", connecting: "Bağlanıyor",
      notifications: "Bildirim tercihi", notifyAll: "Tümü", notifyMentions: "Yalnızca bahsetmeler", notifyMuted: "Sessiz",
      todayTopic: "Bugünün deniz konusu", older: "Önceki mesajları yükle", newMessages: "Yeni mesajlar",
      listening: "Dinleniyor…", listeningHint: "Konuşmanız yazıya çevriliyor. Bitirmek için mikrofona dokunun.", stopListening: "Dinlemeyi durdur",
      messageLabel: "Mesaj", messagePlaceholder: "Denizcilik hakkında bir şey yazın", characters: "karakter",
      safeCommunity: "Güvenli topluluk", roomInfo: "Oda bilgisi", roomInfoText: "MarSoh, denizcilerin tecrübe ve fikir paylaşımı içindir.",
      rules: "Topluluk kuralları", ruleContact: "İletişim bilgisi ve dış bağlantı paylaşmayın.",
      ruleRecruitment: "İş ilanı veya personel arama paylaşmayın.", ruleRespect: "Saygılı, güvenli ve konuya uygun konuşun.",
      ruleMoney: "Komisyon, ödeme veya aracılık talep etmeyin.", seaSafety: "Denizde güvenlik",
      seaSafetyText: "Acil bir durumda sohbet yerine geminizin resmi acil durum prosedürünü izleyin.",
      close: "Kapat", sending: "Gönderiliyor…", sent: "Gönderildi", failed: "Gönderilemedi", retry: "Tekrar dene", remove: "Sil",
      edit: "Düzenle", report: "Bildir", block: "Kullanıcıyı engelle", translate: "Çevir", translating: "Çevriliyor…",
      translateTo: "Hangi dile çevrilsin?", showOriginal: "Çeviriyi gizle", automaticTranslation: "Otomatik çeviri",
      translationUnavailable: "Çeviri şu anda kullanılamıyor", emptyTitle: "Sohbeti başlatın",
      emptyBody: "Denizcilikle ilgili güvenli bir konu açın. Kişisel iletişim bilgisi veya iş ilanı paylaşmayın.",
      networkFailed: "Gönderilemedi — bağlantıyı kontrol edin", communityFailed: "Gönderilemedi — topluluk kurallarına aykırı ifade",
      contactFailed: "Gönderilemedi — iletişim bilgisi paylaşımı yasaktır", micDenied: "Mikrofon izni verilmedi.",
      micTimeout: "Konuşma algılanamadı. Tekrar deneyin.", micError: "Sesle yazma şu anda kullanılamıyor.",
      micUnsupported: "Bu tarayıcı sesle yazmayı desteklemiyor.", chooseReaction: "Tepki bırak", reactions: "Tepkiler",
      reportSaved: "Bildiriminiz alındı.", blocked: "Kullanıcı engellendi.", actionTitle: "Mesaj işlemleri",
      reportReason: "Bildirme nedeni", cancel: "Vazgeç", loadFailed: "MarSoh şu anda yüklenemedi.",
      memberRoom: "Güvenli topluluk odası", unread: "okunmamış", messages: "mesaj", homeLabel: "AllonaHub ana sayfa",
      breadcrumbLabel: "Sayfa bağlantıları", chatLanguage: "Sohbet dili", closeRooms: "Odaları kapat", openRooms: "Sohbet odalarını aç",
      openRules: "Topluluk kurallarını aç", closeRules: "Topluluk kurallarını kapat", jumpLatest: "En yeni mesaja dön",
      emojiPicker: "Emoji seçici", chooseEmoji: "Emoji seç", voiceTyping: "Sesle yaz", sendMessage: "Mesaj gönder",
      verifiedCompany: "Doğrulanmış şirket", verifiedSeafarer: "Doğrulanmış denizci", reasonSpam: "Spam",
      reasonHarassment: "Taciz veya hakaret", reasonFraud: "Dolandırıcılık", reasonRecruitment: "İş ilanı veya personel arama",
      reasonContact: "İletişim bilgisi paylaşımı", reasonOther: "Diğer", tapForReaction: "Tepki bırakmak için mesaja dokunun"
    },
    az: {
      skip: "Mesajlara keç", back: "Geri qayıt", home: "Ana səhifə", module: "Modula qayıt", language: "Dil",
      loginRequired: "MarSoh-dan istifadə etmək üçün aktiv AllonaHub hesabınızla daxil olun.", signIn: "Daxil ol",
      tagline: "Dənizçilərin qlobal söhbət şəbəkəsi", rooms: "Otaqlar", live: "Canlı", offline: "Oflayn", connecting: "Qoşulur",
      notifications: "Bildiriş seçimi", notifyAll: "Hamısı", notifyMentions: "Yalnız qeydlər", notifyMuted: "Səssiz",
      todayTopic: "Günün dəniz mövzusu", older: "Əvvəlki mesajları yüklə", newMessages: "Yeni mesajlar",
      listening: "Dinlənilir…", listeningHint: "Danışığınız mətnə çevrilir. Bitirmək üçün mikrofona toxunun.", stopListening: "Dinləməni dayandır",
      messageLabel: "Mesaj", messagePlaceholder: "Dənizçilik haqqında yazın", characters: "simvol",
      safeCommunity: "Təhlükəsiz icma", roomInfo: "Otaq məlumatı", roomInfoText: "MarSoh dənizçilərin təcrübə və fikir paylaşması üçündür.",
      rules: "İcma qaydaları", ruleContact: "Əlaqə məlumatı və xarici keçid paylaşmayın.",
      ruleRecruitment: "İş elanı və ya işçi axtarışı paylaşmayın.", ruleRespect: "Hörmətli, təhlükəsiz və mövzuya uyğun danışın.",
      ruleMoney: "Komissiya, ödəniş və ya vasitəçilik tələb etməyin.", seaSafety: "Dənizdə təhlükəsizlik",
      seaSafetyText: "Təcili halda söhbət əvəzinə gəminizin rəsmi təcili prosedurunu izləyin.",
      close: "Bağla", sending: "Göndərilir…", sent: "Göndərildi", failed: "Göndərilmədi", retry: "Yenidən sına", remove: "Sil",
      edit: "Düzəlt", report: "Şikayət et", block: "İstifadəçini blokla", translate: "Tərcümə et", translating: "Tərcümə olunur…",
      translateTo: "Hansı dilə tərcümə edilsin?", showOriginal: "Tərcüməni gizlət", automaticTranslation: "Avtomatik tərcümə",
      translationUnavailable: "Tərcümə hazırda əlçatan deyil", emptyTitle: "Söhbətə başlayın",
      emptyBody: "Dənizçiliklə bağlı təhlükəsiz mövzu açın. Şəxsi əlaqə məlumatı və ya iş elanı paylaşmayın.",
      networkFailed: "Göndərilmədi — bağlantını yoxlayın", communityFailed: "Göndərilmədi — icma qaydalarına zidd ifadə",
      contactFailed: "Göndərilmədi — əlaqə məlumatı paylaşmaq qadağandır", micDenied: "Mikrofon icazəsi verilmədi.",
      micTimeout: "Nitq aşkarlanmadı. Yenidən sınayın.", micError: "Səslə yazma hazırda əlçatan deyil.",
      micUnsupported: "Bu brauzer səslə yazmanı dəstəkləmir.", chooseReaction: "Reaksiya ver", reactions: "Reaksiyalar",
      reportSaved: "Şikayətiniz qəbul edildi.", blocked: "İstifadəçi bloklandı.", actionTitle: "Mesaj əməliyyatları",
      reportReason: "Şikayət səbəbi", cancel: "Ləğv et", loadFailed: "MarSoh hazırda yüklənmir.",
      memberRoom: "Təhlükəsiz icma otağı", unread: "oxunmamış", messages: "mesaj", homeLabel: "AllonaHub ana səhifəsi",
      breadcrumbLabel: "Səhifə bağlantıları", chatLanguage: "Söhbət dili", closeRooms: "Otaqları bağla", openRooms: "Söhbət otaqlarını aç",
      openRules: "İcma qaydalarını aç", closeRules: "İcma qaydalarını bağla", jumpLatest: "Ən yeni mesaja keç",
      emojiPicker: "Emoji seçimi", chooseEmoji: "Emoji seç", voiceTyping: "Səslə yaz", sendMessage: "Mesaj göndər",
      verifiedCompany: "Təsdiqlənmiş şirkət", verifiedSeafarer: "Təsdiqlənmiş dənizçi", reasonSpam: "Spam",
      reasonHarassment: "Təqib və ya təhqir", reasonFraud: "Dələduzluq", reasonRecruitment: "İş elanı və ya işçi axtarışı",
      reasonContact: "Əlaqə məlumatı paylaşımı", reasonOther: "Digər", tapForReaction: "Reaksiya vermək üçün mesaja toxunun"
    },
    en: {
      skip: "Skip to messages", back: "Go Back", home: "Home", module: "Back to Module", language: "Language",
      loginRequired: "Sign in with an active AllonaHub account to use MarSoh.", signIn: "Sign In",
      tagline: "The global chat network for seafarers", rooms: "Rooms", live: "Live", offline: "Offline", connecting: "Connecting",
      notifications: "Notifications", notifyAll: "All", notifyMentions: "Mentions only", notifyMuted: "Muted",
      todayTopic: "Today's sea topic", older: "Load older messages", newMessages: "New messages",
      listening: "Listening…", listeningHint: "Your speech is becoming editable text. Tap the microphone to finish.", stopListening: "Stop listening",
      messageLabel: "Message", messagePlaceholder: "Write about maritime life", characters: "characters",
      safeCommunity: "Safe community", roomInfo: "Room information", roomInfoText: "MarSoh is for seafarers to share experience and ideas.",
      rules: "Community rules", ruleContact: "Do not share contact details or external links.",
      ruleRecruitment: "Do not post job ads or personnel searches.", ruleRespect: "Keep the conversation respectful, safe, and on topic.",
      ruleMoney: "Do not request commission, payment, or brokerage.", seaSafety: "Safety at sea",
      seaSafetyText: "In an emergency, follow your vessel's official emergency procedure instead of chat.",
      close: "Close", sending: "Sending…", sent: "Sent", failed: "Failed", retry: "Retry", remove: "Delete",
      edit: "Edit", report: "Report", block: "Block user", translate: "Translate", translating: "Translating…",
      translateTo: "Translate into which language?", showOriginal: "Hide translation", automaticTranslation: "Automatic translation",
      translationUnavailable: "Translation is currently unavailable", emptyTitle: "Start the conversation",
      emptyBody: "Open a safe maritime topic. Do not share personal contact details or job ads.",
      networkFailed: "Failed — check your connection", communityFailed: "Failed — expression violates community rules",
      contactFailed: "Failed — sharing contact details is prohibited", micDenied: "Microphone permission was denied.",
      micTimeout: "No speech was detected. Try again.", micError: "Voice typing is currently unavailable.",
      micUnsupported: "This browser does not support voice typing.", chooseReaction: "Add reaction", reactions: "Reactions",
      reportSaved: "Your report was received.", blocked: "User blocked.", actionTitle: "Message actions",
      reportReason: "Report reason", cancel: "Cancel", loadFailed: "MarSoh could not be loaded.",
      memberRoom: "Safe community room", unread: "unread", messages: "messages", homeLabel: "AllonaHub home",
      breadcrumbLabel: "Page links", chatLanguage: "Chat language", closeRooms: "Close rooms", openRooms: "Open chat rooms",
      openRules: "Open community rules", closeRules: "Close community rules", jumpLatest: "Jump to latest message",
      emojiPicker: "Emoji picker", chooseEmoji: "Choose emoji", voiceTyping: "Voice typing", sendMessage: "Send message",
      verifiedCompany: "Verified company", verifiedSeafarer: "Verified seafarer", reasonSpam: "Spam",
      reasonHarassment: "Harassment or abuse", reasonFraud: "Fraud", reasonRecruitment: "Job ad or personnel search",
      reasonContact: "Contact information sharing", reasonOther: "Other", tapForReaction: "Tap the message to add a reaction"
    }
  };

  const SECONDARY = {
    de: ["Zu den Nachrichten", "Zurück", "Startseite", "Zurück zum Modul", "Sprache", "Das globale Chatnetzwerk für Seeleute", "Räume", "Online", "Offline", "Verbindung wird hergestellt", "Benachrichtigungen", "Alle", "Nur Erwähnungen", "Stumm", "Heutiges Seethema", "Ältere Nachrichten laden", "Neue Nachrichten", "Hört zu…", "Ihre Sprache wird in bearbeitbaren Text umgewandelt. Zum Beenden auf das Mikrofon tippen.", "Diktat beenden", "Nachricht", "Über das Leben auf See schreiben", "Zeichen", "Sichere Gemeinschaft", "Rauminformation", "MarSoh dient Seeleuten zum Austausch von Erfahrungen und Ideen.", "Gemeinschaftsregeln", "Keine Kontaktdaten oder externen Links teilen.", "Keine Stellenanzeigen oder Personalsuchen veröffentlichen.", "Respektvoll, sicher und beim Thema bleiben.", "Keine Provisionen, Zahlungen oder Vermittlung verlangen.", "Sicherheit auf See", "Befolgen Sie im Notfall das offizielle Notfallverfahren Ihres Schiffes statt des Chats.", "Schließen", "Wird gesendet…", "Gesendet", "Fehlgeschlagen", "Erneut versuchen", "Löschen", "Bearbeiten", "Melden", "Benutzer blockieren", "Übersetzen", "Wird übersetzt…", "In welche Sprache übersetzen?", "Übersetzung ausblenden", "Automatische Übersetzung", "Übersetzung ist derzeit nicht verfügbar", "Gespräch beginnen", "Starten Sie ein sicheres maritimes Thema. Teilen Sie keine Kontaktdaten oder Stellenanzeigen.", "Fehlgeschlagen — Verbindung prüfen", "Fehlgeschlagen — Verstoß gegen Gemeinschaftsregeln", "Fehlgeschlagen — Kontaktdaten sind verboten", "Mikrofonzugriff wurde verweigert.", "Keine Sprache erkannt. Bitte erneut versuchen.", "Spracheingabe ist derzeit nicht verfügbar.", "Dieser Browser unterstützt keine Spracheingabe.", "Reaktion hinzufügen", "Reaktionen", "Ihre Meldung wurde aufgenommen.", "Benutzer blockiert.", "Nachrichtenaktionen", "Grund der Meldung", "Abbrechen", "MarSoh konnte nicht geladen werden.", "Sicherer Gemeinschaftsraum", "ungelesen", "Nachrichten", "AllonaHub-Startseite", "Seitenlinks", "Chatsprache", "Räume schließen", "Chaträume öffnen", "Gemeinschaftsregeln öffnen", "Gemeinschaftsregeln schließen", "Zur neuesten Nachricht", "Emoji-Auswahl", "Emoji wählen", "Spracheingabe", "Nachricht senden", "Verifiziertes Unternehmen", "Verifizierter Seemann", "Spam", "Belästigung oder Beleidigung", "Betrug", "Stellenanzeige oder Personalsuche", "Teilen von Kontaktdaten", "Sonstiges", "Nachricht antippen, um zu reagieren"],
    ru: ["К сообщениям", "Назад", "Главная", "К модулю", "Язык", "Глобальная сеть общения моряков", "Комнаты", "В сети", "Не в сети", "Подключение", "Уведомления", "Все", "Только упоминания", "Без звука", "Морская тема дня", "Загрузить предыдущие сообщения", "Новые сообщения", "Слушаю…", "Речь преобразуется в редактируемый текст. Нажмите на микрофон, чтобы завершить.", "Остановить диктовку", "Сообщение", "Напишите о морской жизни", "символов", "Безопасное сообщество", "Информация о комнате", "MarSoh создан для обмена опытом и идеями между моряками.", "Правила сообщества", "Не публикуйте контакты и внешние ссылки.", "Не публикуйте вакансии или поиск персонала.", "Общайтесь уважительно, безопасно и по теме.", "Не требуйте комиссию, оплату или посредничество.", "Безопасность на море", "В чрезвычайной ситуации следуйте официальной процедуре судна, а не советам в чате.", "Закрыть", "Отправляется…", "Отправлено", "Не отправлено", "Повторить", "Удалить", "Изменить", "Пожаловаться", "Заблокировать пользователя", "Перевести", "Переводится…", "На какой язык перевести?", "Скрыть перевод", "Автоматический перевод", "Перевод сейчас недоступен", "Начните разговор", "Начните безопасную морскую тему. Не публикуйте контакты или вакансии.", "Не отправлено — проверьте соединение", "Не отправлено — нарушение правил сообщества", "Не отправлено — публикация контактов запрещена", "Доступ к микрофону запрещен.", "Речь не распознана. Попробуйте снова.", "Голосовой ввод сейчас недоступен.", "Этот браузер не поддерживает голосовой ввод.", "Добавить реакцию", "Реакции", "Жалоба принята.", "Пользователь заблокирован.", "Действия с сообщением", "Причина жалобы", "Отмена", "Не удалось загрузить MarSoh.", "Безопасная комната", "непрочитано", "сообщений", "Главная AllonaHub", "Ссылки страницы", "Язык чата", "Закрыть комнаты", "Открыть комнаты", "Открыть правила", "Закрыть правила", "К последнему сообщению", "Выбор эмодзи", "Выбрать эмодзи", "Голосовой ввод", "Отправить сообщение", "Проверенная компания", "Проверенный моряк", "Спам", "Домогательство или оскорбление", "Мошенничество", "Вакансия или поиск персонала", "Публикация контактов", "Другое", "Нажмите на сообщение, чтобы добавить реакцию"],
    ar: ["الانتقال إلى الرسائل", "رجوع", "الرئيسية", "العودة إلى الوحدة", "اللغة", "شبكة المحادثة العالمية للبحارة", "الغرف", "متصل", "غير متصل", "جارٍ الاتصال", "الإشعارات", "الكل", "الإشارات فقط", "صامت", "موضوع البحر اليوم", "تحميل الرسائل السابقة", "رسائل جديدة", "جارٍ الاستماع…", "يتم تحويل كلامك إلى نص قابل للتعديل. اضغط على الميكروفون للإنهاء.", "إيقاف الاستماع", "رسالة", "اكتب عن الحياة البحرية", "حرفًا", "مجتمع آمن", "معلومات الغرفة", "MarSoh مخصص لتبادل الخبرات والأفكار بين البحارة.", "قواعد المجتمع", "لا تشارك معلومات الاتصال أو الروابط الخارجية.", "لا تنشر إعلانات وظائف أو طلبات توظيف.", "تحدث باحترام وأمان والتزم بالموضوع.", "لا تطلب عمولة أو دفعًا أو وساطة.", "السلامة في البحر", "في حالات الطوارئ اتبع إجراءات الطوارئ الرسمية للسفينة بدلًا من المحادثة.", "إغلاق", "جارٍ الإرسال…", "تم الإرسال", "تعذر الإرسال", "إعادة المحاولة", "حذف", "تعديل", "إبلاغ", "حظر المستخدم", "ترجمة", "جارٍ الترجمة…", "إلى أي لغة تريد الترجمة؟", "إخفاء الترجمة", "ترجمة آلية", "الترجمة غير متاحة حاليًا", "ابدأ المحادثة", "ابدأ موضوعًا بحريًا آمنًا. لا تشارك معلومات الاتصال أو إعلانات الوظائف.", "تعذر الإرسال — تحقق من الاتصال", "تعذر الإرسال — المحتوى يخالف قواعد المجتمع", "تعذر الإرسال — مشاركة معلومات الاتصال محظورة", "لم يتم منح إذن الميكروفون.", "لم يتم اكتشاف كلام. حاول مرة أخرى.", "الكتابة الصوتية غير متاحة حاليًا.", "هذا المتصفح لا يدعم الكتابة الصوتية.", "إضافة تفاعل", "التفاعلات", "تم استلام بلاغك.", "تم حظر المستخدم.", "إجراءات الرسالة", "سبب البلاغ", "إلغاء", "تعذر تحميل MarSoh.", "غرفة مجتمع آمنة", "غير مقروء", "رسالة", "صفحة AllonaHub الرئيسية", "روابط الصفحة", "لغة المحادثة", "إغلاق الغرف", "فتح غرف المحادثة", "فتح قواعد المجتمع", "إغلاق القواعد", "الانتقال إلى أحدث رسالة", "منتقي الرموز", "اختيار رمز", "الكتابة الصوتية", "إرسال الرسالة", "شركة موثقة", "بحار موثق", "رسائل مزعجة", "مضايقة أو إساءة", "احتيال", "إعلان وظيفة أو طلب موظفين", "مشاركة معلومات الاتصال", "أخرى", "اضغط على الرسالة لإضافة تفاعل"],
    kk: ["Хабарламаларға өту", "Артқа", "Басты бет", "Модульге оралу", "Тіл", "Теңізшілердің жаһандық сұхбат желісі", "Бөлмелер", "Онлайн", "Офлайн", "Қосылуда", "Хабарландырулар", "Барлығы", "Тек атап өтулер", "Дыбыссыз", "Бүгінгі теңіз тақырыбы", "Алдыңғы хабарламаларды жүктеу", "Жаңа хабарламалар", "Тыңдап тұр…", "Сөзіңіз өңделетін мәтінге айналуда. Аяқтау үшін микрофонды басыңыз.", "Тыңдауды тоқтату", "Хабарлама", "Теңіз өмірі туралы жазыңыз", "таңба", "Қауіпсіз қауымдастық", "Бөлме туралы", "MarSoh теңізшілердің тәжірибе мен ой бөлісуіне арналған.", "Қауымдастық ережелері", "Байланыс деректерін немесе сыртқы сілтемелерді бөліспеңіз.", "Жұмыс жарнамасын немесе қызметкер іздеуді жарияламаңыз.", "Құрметпен, қауіпсіз және тақырып бойынша сөйлесіңіз.", "Комиссия, төлем немесе делдалдық сұрамаңыз.", "Теңіздегі қауіпсіздік", "Төтенше жағдайда чаттың орнына кеменің ресми рәсімін орындаңыз.", "Жабу", "Жіберілуде…", "Жіберілді", "Жіберілмеді", "Қайталау", "Жою", "Өзгерту", "Шағымдану", "Пайдаланушыны бұғаттау", "Аудару", "Аударылуда…", "Қай тілге аудару керек?", "Аударманы жасыру", "Автоматты аударма", "Аударма қазір қолжетімсіз", "Сұхбатты бастаңыз", "Қауіпсіз теңіз тақырыбын бастаңыз. Байланыс деректерін немесе жұмыс жарнамасын бөліспеңіз.", "Жіберілмеді — қосылымды тексеріңіз", "Жіберілмеді — қауымдастық ережесіне қайшы", "Жіберілмеді — байланыс деректерін бөлісуге тыйым салынған", "Микрофонға рұқсат берілмеді.", "Сөйлеу анықталмады. Қайталап көріңіз.", "Дауыспен теру қазір қолжетімсіз.", "Бұл браузер дауыспен теруді қолдамайды.", "Реакция қосу", "Реакциялар", "Шағымыңыз қабылданды.", "Пайдаланушы бұғатталды.", "Хабарлама әрекеттері", "Шағым себебі", "Бас тарту", "MarSoh жүктелмеді.", "Қауіпсіз қауымдастық бөлмесі", "оқылмаған", "хабарлама", "AllonaHub басты беті", "Бет сілтемелері", "Сұхбат тілі", "Бөлмелерді жабу", "Сұхбат бөлмелерін ашу", "Ережелерді ашу", "Ережелерді жабу", "Соңғы хабарламаға өту", "Эмодзи таңдау", "Эмодзи таңдау", "Дауыспен теру", "Хабарлама жіберу", "Расталған компания", "Расталған теңізші", "Спам", "Қудалау немесе қорлау", "Алаяқтық", "Жұмыс жарнамасы немесе қызметкер іздеу", "Байланыс деректерін бөлісу", "Басқа", "Реакция қосу үшін хабарламаны басыңыз"],
    uz: ["Xabarlarga o'tish", "Orqaga", "Bosh sahifa", "Modulga qaytish", "Til", "Dengizchilarning global suhbat tarmog'i", "Xonalar", "Onlayn", "Oflayn", "Ulanmoqda", "Bildirishnomalar", "Barchasi", "Faqat eslatmalar", "Ovozsiz", "Bugungi dengiz mavzusi", "Oldingi xabarlarni yuklash", "Yangi xabarlar", "Tinglanmoqda…", "Nutqingiz tahrirlanadigan matnga aylantirilmoqda. Tugatish uchun mikrofonni bosing.", "Tinglashni to'xtatish", "Xabar", "Dengiz hayoti haqida yozing", "belgi", "Xavfsiz hamjamiyat", "Xona ma'lumoti", "MarSoh dengizchilarning tajriba va fikr almashishi uchun.", "Hamjamiyat qoidalari", "Aloqa ma'lumotlari yoki tashqi havolalarni ulashmang.", "Ish e'loni yoki xodim qidiruvini joylamang.", "Hurmat bilan, xavfsiz va mavzuga mos gaplashing.", "Komissiya, to'lov yoki vositachilik so'ramang.", "Dengizdagi xavfsizlik", "Favqulodda vaziyatda chat o'rniga kemaning rasmiy tartibiga amal qiling.", "Yopish", "Yuborilmoqda…", "Yuborildi", "Yuborilmadi", "Qayta urinish", "O'chirish", "Tahrirlash", "Xabar berish", "Foydalanuvchini bloklash", "Tarjima", "Tarjima qilinmoqda…", "Qaysi tilga tarjima qilinsin?", "Tarjimani yashirish", "Avtomatik tarjima", "Tarjima hozir mavjud emas", "Suhbatni boshlang", "Xavfsiz dengiz mavzusini boshlang. Aloqa ma'lumotlari yoki ish e'lonlarini ulashmang.", "Yuborilmadi — ulanishni tekshiring", "Yuborilmadi — hamjamiyat qoidalariga zid", "Yuborilmadi — aloqa ma'lumotlarini ulashish taqiqlangan", "Mikrofon ruxsati berilmadi.", "Nutq aniqlanmadi. Qayta urinib ko'ring.", "Ovoz bilan yozish hozir mavjud emas.", "Bu brauzer ovoz bilan yozishni qo'llamaydi.", "Reaksiya qo'shish", "Reaksiyalar", "Xabaringiz qabul qilindi.", "Foydalanuvchi bloklandi.", "Xabar amallari", "Xabar berish sababi", "Bekor qilish", "MarSoh yuklanmadi.", "Xavfsiz hamjamiyat xonasi", "o'qilmagan", "xabar", "AllonaHub bosh sahifasi", "Sahifa havolalari", "Suhbat tili", "Xonalarni yopish", "Suhbat xonalarini ochish", "Qoidalarni ochish", "Qoidalarni yopish", "Eng yangi xabarga o'tish", "Emoji tanlash", "Emoji tanlash", "Ovoz bilan yozish", "Xabar yuborish", "Tasdiqlangan kompaniya", "Tasdiqlangan dengizchi", "Spam", "Ta'qib yoki haqorat", "Firibgarlik", "Ish e'loni yoki xodim qidiruvi", "Aloqa ma'lumotini ulashish", "Boshqa", "Reaksiya qo'shish uchun xabarni bosing"],
    ky: ["Билдирүүлөргө өтүү", "Артка", "Башкы бет", "Модулга кайтуу", "Тил", "Деңизчилердин глобалдык баарлашуу тармагы", "Бөлмөлөр", "Онлайн", "Офлайн", "Туташууда", "Эскертмелер", "Баары", "Эскерүүлөр гана", "Үнсүз", "Бүгүнкү деңиз темасы", "Мурунку билдирүүлөрдү жүктөө", "Жаңы билдирүүлөр", "Угуп жатат…", "Сөзүңүз түзөтүлүүчү текстке айланууда. Бүтүрүү үчүн микрофонду басыңыз.", "Угууну токтотуу", "Билдирүү", "Деңиз жашоосу жөнүндө жазыңыз", "белги", "Коопсуз коомчулук", "Бөлмө маалыматы", "MarSoh деңизчилердин тажрыйба жана ой бөлүшүүсү үчүн.", "Коомчулук эрежелери", "Байланыш маалыматтарын же тышкы шилтемелерди бөлүшпөңүз.", "Жумуш жарыясын же кызматкер издөөнү жарыялабаңыз.", "Урматтуу, коопсуз жана тема боюнча сүйлөшүңүз.", "Комиссия, төлөм же ортомчулук сурабаңыз.", "Деңиздеги коопсуздук", "Өзгөчө кырдаалда чаттын ордуна кеменин расмий жол-жобосун аткарыңыз.", "Жабуу", "Жөнөтүлүүдө…", "Жөнөтүлдү", "Жөнөтүлгөн жок", "Кайра аракет", "Өчүрүү", "Түзөтүү", "Билдирүү", "Колдонуучуну бөгөттөө", "Которуу", "Которулууда…", "Кайсы тилге которулсун?", "Котормону жашыруу", "Автоматтык котормо", "Котормо азыр жеткиликсиз", "Маекти баштаңыз", "Коопсуз деңиз темасын баштаңыз. Байланыш маалыматтарын же жумуш жарыясын бөлүшпөңүз.", "Жөнөтүлгөн жок — байланышты текшериңиз", "Жөнөтүлгөн жок — коомчулук эрежесине каршы", "Жөнөтүлгөн жок — байланыш маалыматтарын бөлүшүүгө тыюу салынган", "Микрофонго уруксат берилген жок.", "Сөз аныкталган жок. Кайра аракет кылыңыз.", "Үн менен жазуу азыр жеткиликсиз.", "Бул браузер үн менен жазууну колдобойт.", "Реакция кошуу", "Реакциялар", "Билдирүүңүз кабыл алынды.", "Колдонуучу бөгөттөлдү.", "Билдирүү аракеттери", "Билдирүүнүн себеби", "Жокко чыгаруу", "MarSoh жүктөлгөн жок.", "Коопсуз коомчулук бөлмөсү", "окулбаган", "билдирүү", "AllonaHub башкы бети", "Бет шилтемелери", "Маек тили", "Бөлмөлөрдү жабуу", "Маек бөлмөлөрүн ачуу", "Эрежелерди ачуу", "Эрежелерди жабуу", "Эң жаңы билдирүүгө өтүү", "Эмодзи тандоо", "Эмодзи тандоо", "Үн менен жазуу", "Билдирүү жөнөтүү", "Ырасталган компания", "Ырасталган деңизчи", "Спам", "Куугунтук же мазактоо", "Алдамчылык", "Жумуш жарыясы же кызматкер издөө", "Байланыш маалыматын бөлүшүү", "Башка", "Реакция кошуу үчүн билдирүүнү басыңыз"]
  };

  const SECONDARY_KEYS = [
    "skip", "back", "home", "module", "language", "tagline", "rooms", "live", "offline", "connecting",
    "notifications", "notifyAll", "notifyMentions", "notifyMuted", "todayTopic", "older", "newMessages", "listening", "listeningHint", "stopListening",
    "messageLabel", "messagePlaceholder", "characters", "safeCommunity", "roomInfo", "roomInfoText", "rules", "ruleContact", "ruleRecruitment", "ruleRespect", "ruleMoney",
    "seaSafety", "seaSafetyText", "close", "sending", "sent", "failed", "retry", "remove", "edit", "report", "block", "translate", "translating", "translateTo",
    "showOriginal", "automaticTranslation", "translationUnavailable", "emptyTitle", "emptyBody", "networkFailed", "communityFailed", "contactFailed", "micDenied", "micTimeout",
    "micError", "micUnsupported", "chooseReaction", "reactions", "reportSaved", "blocked", "actionTitle", "reportReason", "cancel", "loadFailed", "memberRoom", "unread",
    "messages", "homeLabel", "breadcrumbLabel", "chatLanguage", "closeRooms", "openRooms", "openRules", "closeRules", "jumpLatest", "emojiPicker", "chooseEmoji", "voiceTyping",
    "sendMessage", "verifiedCompany", "verifiedSeafarer", "reasonSpam", "reasonHarassment", "reasonFraud", "reasonRecruitment", "reasonContact", "reasonOther", "tapForReaction"
  ];

  for (const [language, values] of Object.entries(SECONDARY)) {
    COPY[language] = Object.fromEntries(SECONDARY_KEYS.map((key, index) => [key, values[index]]));
    COPY[language].loginRequired = {
      de: "Melden Sie sich mit einem aktiven AllonaHub-Konto an, um MarSoh zu nutzen.",
      ru: "Войдите в активную учетную запись AllonaHub, чтобы пользоваться MarSoh.",
      ar: "سجّل الدخول بحساب AllonaHub نشط لاستخدام MarSoh.",
      kk: "MarSoh қолдану үшін белсенді AllonaHub тіркелгісімен кіріңіз.",
      uz: "MarSoh'dan foydalanish uchun faol AllonaHub hisobingizga kiring.",
      ky: "MarSoh колдонуу үчүн активдүү AllonaHub аккаунтуңуз менен кириңиз."
    }[language];
    COPY[language].signIn = { de: "Anmelden", ru: "Войти", ar: "تسجيل الدخول", kk: "Кіру", uz: "Kirish", ky: "Кирүү" }[language];
  }

  const EXTRAS = {
    tr: {
      worldRoom: "Dünya Genel", countryRoom: "{country} Odası",
      defaultPinned: "Kişisel iletişim bilgisi, iş ilanı veya ücret talebi paylaşmayın.",
      sentNotice: "Mesajlar güvenlik amacıyla otomatik olarak denetlenebilir, geciktirilebilir veya dağıtılmayabilir; Gönderildi bilgisi teslim veya okunma garantisi değildir."
    },
    az: {
      worldRoom: "Dünya söhbəti", countryRoom: "{country} otağı",
      defaultPinned: "Şəxsi əlaqə məlumatı, iş elanı və ya ödəniş tələbi paylaşmayın.",
      sentNotice: "Mesajlar təhlükəsizlik məqsədilə avtomatik yoxlanıla, gecikdirilə və ya paylanmaya bilər; Göndərildi məlumatı çatdırılma və ya oxunma zəmanəti deyil."
    },
    en: {
      worldRoom: "World Chat", countryRoom: "{country} Room",
      defaultPinned: "Do not share personal contact details, job ads, or payment requests.",
      sentNotice: "Messages may be automatically reviewed, delayed, or withheld for safety; Sent does not guarantee delivery or reading."
    },
    de: {
      worldRoom: "Weltweiter Chat", countryRoom: "Raum {country}",
      defaultPinned: "Teilen Sie keine persönlichen Kontaktdaten, Stellenanzeigen oder Zahlungsaufforderungen.",
      sentNotice: "Nachrichten können aus Sicherheitsgründen automatisch geprüft, verzögert oder zurückgehalten werden; Gesendet garantiert weder Zustellung noch Lesen."
    },
    ru: {
      worldRoom: "Мировой чат", countryRoom: "Комната: {country}",
      defaultPinned: "Не публикуйте личные контакты, вакансии или требования оплаты.",
      sentNotice: "В целях безопасности сообщения могут автоматически проверяться, задерживаться или не распространяться; статус Отправлено не гарантирует доставку или прочтение."
    },
    ar: {
      worldRoom: "المحادثة العالمية", countryRoom: "غرفة {country}",
      defaultPinned: "لا تشارك بيانات الاتصال الشخصية أو إعلانات الوظائف أو طلبات الدفع.",
      sentNotice: "قد تخضع الرسائل للمراجعة الآلية أو التأخير أو الحجب لأغراض السلامة؛ حالة تم الإرسال لا تضمن التسليم أو القراءة."
    },
    kk: {
      worldRoom: "Әлемдік чат", countryRoom: "{country} бөлмесі",
      defaultPinned: "Жеке байланыс деректерін, жұмыс жарнамаларын немесе төлем талаптарын бөліспеңіз.",
      sentNotice: "Қауіпсіздік үшін хабарламалар автоматты түрде тексерілуі, кешіктірілуі немесе таратылмауы мүмкін; Жөнелтілді күйі жеткізілгеніне не оқылғанына кепілдік бермейді."
    },
    uz: {
      worldRoom: "Jahon suhbati", countryRoom: "{country} xonasi",
      defaultPinned: "Shaxsiy aloqa ma'lumotlari, ish e'lonlari yoki to'lov talablarini ulashmang.",
      sentNotice: "Xabarlar xavfsizlik uchun avtomatik tekshirilishi, kechiktirilishi yoki tarqatilmasligi mumkin; Yuborildi holati yetkazilgan yoki o'qilganini kafolatlamaydi."
    },
    ky: {
      worldRoom: "Дүйнөлүк маек", countryRoom: "{country} бөлмөсү",
      defaultPinned: "Жеке байланыш маалыматтарын, жумуш жарыяларын же төлөм талаптарын бөлүшпөңүз.",
      sentNotice: "Коопсуздук үчүн билдирүүлөр автоматтык түрдө текшерилиши, кечигиши же таратылбай калышы мүмкүн; Жөнөтүлдү абалы жеткирилгенине же окулганына кепилдик бербейт."
    }
  };
  for (const language of SUPPORTED) Object.assign(COPY[language], EXTRAS[language]);

  function normalize(language) {
    const normalized = String(language || "").trim().toLowerCase().split("-")[0];
    return SUPPORTED.includes(normalized) ? normalized : "tr";
  }
  function current() { return normalize(localStorage.getItem("allona.language") || document.documentElement.lang || "tr"); }
  function t(key, language) { const lang = normalize(language || current()); return COPY[lang]?.[key] || COPY.en[key] || COPY.tr[key] || key; }
  function localized(value, language) {
    const source = value && typeof value === "object" ? value : {};
    const lang = normalize(language || current());
    return source[lang] || source.en || source.tr || source.az || "";
  }
  function apply(language) {
    const lang = normalize(language || current());
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-marsoh-copy]").forEach((element) => { element.textContent = t(element.dataset.marsohCopy, lang); });
    document.querySelectorAll("[data-marsoh-placeholder]").forEach((element) => { element.placeholder = t(element.dataset.marsohPlaceholder, lang); });
    document.querySelectorAll("[data-marsoh-aria]").forEach((element) => { element.setAttribute("aria-label", t(element.dataset.marsohAria, lang)); });
    document.querySelectorAll("[data-marsoh-title]").forEach((element) => { element.title = t(element.dataset.marsohTitle, lang); });
    const select = document.querySelector("[data-marsoh-language]");
    if (select) select.value = lang;
    document.dispatchEvent(new CustomEvent("marsoh:language", { detail: { language: lang } }));
    return lang;
  }

  window.MarSohI18n = { COPY, SUPPORTED, SPEECH_LOCALES, current, t, localized, apply, normalize };
})();
