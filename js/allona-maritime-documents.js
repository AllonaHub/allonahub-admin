(function () {
  "use strict";

  const App = window.Allona = window.Allona || {};
  const languageCodes = ["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"];
  const state = { session: null, remote: null, files: [], busy: false, initialized: false };
  const maxFiles = 20;
  const maxFileBytes = 45 * 1024 * 1024;
  const maxBatchBytes = 150 * 1024 * 1024;
  const allowedTypes = ["application/pdf"];

  const copyRows = {
    globalCvNeedsConfirmation: ["CV taslağınız kayıtlı. Maritime CV sayfasında Kaydet'e basıp cihaz doğrulamasını tamamlayın.", "CV qaralamanız saxlanılıb. Maritime CV səhifəsində Saxla düyməsinə basıb cihaz doğrulamasını tamamlayın.", "CV жобасы сақталды. Maritime CV бетінде Сақтау түймесін басып, құрылғыны растауды аяқтаңыз.", "CV qoralamasi saqlandi. Maritime CV sahifasida Saqlash tugmasini bosib, qurilmani tasdiqlang.", "CV долбоору сакталды. Maritime CV барагында Сактоо баскычын басып, түзмөктү ырастоону бүтүрүңүз.", "Your CV draft is saved. Open Maritime CV, press Save and complete device verification.", "Ihr CV-Entwurf ist gespeichert. Öffnen Sie Maritime CV, drücken Sie Speichern und bestätigen Sie Ihr Gerät.", "Черновик CV сохранён. Откройте Maritime CV, нажмите Сохранить и завершите проверку устройства.", "تم حفظ مسودة سيرتك. افتح Maritime CV واضغط حفظ وأكمل التحقق من الجهاز."],
    maritimeCvKicker: ["Ana Bilgi Kaynağı", "Əsas məlumat mənbəyi", "Негізгі дерек көзі", "Asosiy maʼlumot manbai", "Негизги маалымат булагы", "Primary Information Source", "Primäre Datenquelle", "Основной источник данных", "مصدر المعلومات الأساسي"],
    maritimeCvTitle: ["Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV", "Maritime CV"],
    maritimeCvLead: ["Bilgilerinizi ve fotoğrafınızı kendiniz girin. Global CV yalnızca kaydettiğiniz bu bilgilerden hazırlanır.", "Məlumatlarınızı və şəklinizi özünüz daxil edin. Global CV yalnız saxladığınız bu məlumatlardan hazırlanır.", "Деректеріңіз бен фотосуретіңізді өзіңіз енгізіңіз. Global CV тек сақталған деректерден жасалады.", "Maʼlumotlaringiz va suratingizni o‘zingiz kiriting. Global CV faqat saqlangan maʼlumotlardan yaratiladi.", "Маалыматыңызды жана сүрөтүңүздү өзүңүз киргизиңиз. Global CV сакталган маалыматтан гана түзүлөт.", "Enter your details and photo yourself. Global CV is created only from the information you save.", "Geben Sie Ihre Daten und Ihr Foto selbst ein. Der Global CV wird nur aus Ihren gespeicherten Angaben erstellt.", "Введите данные и фотографию самостоятельно. Global CV создается только из сохраненных вами данных.", "أدخل بياناتك وصورتك بنفسك. يتم إنشاء Global CV فقط من المعلومات التي تحفظها."],
    maritimeCvMissing: ["Henüz Maritime CV kaydedilmedi", "Maritime CV hələ saxlanmayıb", "Maritime CV әлі сақталмаған", "Maritime CV hali saqlanmagan", "Maritime CV азырынча сакталган жок", "Maritime CV has not been saved yet", "Maritime CV wurde noch nicht gespeichert", "Maritime CV еще не сохранено", "لم يتم حفظ Maritime CV بعد"],
    maritimeCvReady: ["Maritime CV kayıtlı", "Maritime CV saxlanılıb", "Maritime CV сақталған", "Maritime CV saqlangan", "Maritime CV сакталды", "Maritime CV saved", "Maritime CV gespeichert", "Maritime CV сохранено", "تم حفظ Maritime CV"],
    openMaritimeCv: ["Maritime CV'yi Doldur", "Maritime CV-ni doldur", "Maritime CV толтыру", "Maritime CV-ni to‘ldirish", "Maritime CV-ни толтуруу", "Complete Maritime CV", "Maritime CV ausfüllen", "Заполнить Maritime CV", "تعبئة Maritime CV"],
    editMaritimeCv: ["Maritime CV'yi Düzenle", "Maritime CV-ni redaktə et", "Maritime CV өңдеу", "Maritime CV-ni tahrirlash", "Maritime CV-ни түзөтүү", "Edit Maritime CV", "Maritime CV bearbeiten", "Изменить Maritime CV", "تعديل Maritime CV"],
    documentsArchive: ["Belge Arşivi", "Sənəd arxivi", "Құжат мұрағаты", "Hujjatlar arxivi", "Документтер архиви", "Document Archive", "Dokumentenarchiv", "Архив документов", "أرشيف المستندات"],
    uploadHeading: ["PDF belgelerinizi yükleyin", "PDF sənədlərinizi yükləyin", "PDF құжаттарыңызды жүктеңіз", "PDF hujjatlaringizni yuklang", "PDF документтериңизди жүктөңүз", "Upload your PDF documents", "PDF-Dokumente hochladen", "Загрузите PDF-документы", "ارفع مستندات PDF"],
    uploadLead: ["Tek seferde en fazla 20 PDF seçebilirsiniz. Belgeler okunmaz ve CV alanlarını değiştirmez.", "Bir dəfədə ən çox 20 PDF seçə bilərsiniz. Sənədlər oxunmur və CV sahələrini dəyişmir.", "Бір ретте 20 PDF-ке дейін таңдауға болады. Құжаттар оқылмайды және CV өрістерін өзгертпейді.", "Bir martada 20 tagacha PDF tanlang. Hujjatlar o‘qilmaydi va CV maydonlarini o‘zgartirmaydi.", "Бир жолу 20га чейин PDF тандаңыз. Документтер окулбайт жана CV талааларын өзгөртпөйт.", "Select up to 20 PDFs at once. Documents are not read and do not change CV fields.", "Wählen Sie bis zu 20 PDFs. Dokumente werden nicht ausgelesen und ändern keine CV-Felder.", "Выберите до 20 PDF. Документы не распознаются и не изменяют поля CV.", "اختر ما يصل إلى 20 ملف PDF. لا تتم قراءة المستندات ولا تغير حقول السيرة."],
    chooseFiles: ["PDF belgelerini seçin", "PDF sənədlərini seçin", "PDF құжаттарын таңдаңыз", "PDF hujjatlarni tanlang", "PDF документтерди тандаңыз", "Choose PDF documents", "PDF-Dokumente auswählen", "Выберите PDF-документы", "اختر مستندات PDF"],
    chooseFilesHint: ["Dosyaları buraya bırakabilir veya cihazınızdan seçebilirsiniz.", "Faylları bura ata və ya cihazdan seçə bilərsiniz.", "Файлдарды осында тастаңыз немесе құрылғыдан таңдаңыз.", "Fayllarni shu yerga tashlang yoki qurilmadan tanlang.", "Файлдарды бул жерге таштаңыз же түзмөктөн тандаңыз.", "Drop files here or choose them from your device.", "Dateien hier ablegen oder vom Gerät auswählen.", "Перетащите файлы сюда или выберите на устройстве.", "اسحب الملفات هنا أو اخترها من جهازك."],
    fileLimits: ["Her dosya en fazla 45 MB, toplam seçim en fazla 150 MB.", "Hər fayl ən çox 45 MB, ümumi seçim 150 MB.", "Әр файл 45 МБ-қа, жалпысы 150 МБ-қа дейін.", "Har fayl 45 MB, jami tanlov 150 MB gacha.", "Ар бир файл 45 МБ, жалпысы 150 МБ чейин.", "Maximum 45 MB per file and 150 MB in total.", "Maximal 45 MB pro Datei und 150 MB insgesamt.", "До 45 МБ на файл и 150 МБ всего.", "بحد أقصى 45 ميغابايت لكل ملف و150 ميغابايت إجمالاً."],
    selectedFiles: ["Seçilen belgeler", "Seçilmiş sənədlər", "Таңдалған құжаттар", "Tanlangan hujjatlar", "Тандалган документтер", "Selected documents", "Ausgewählte Dokumente", "Выбранные документы", "المستندات المختارة"],
    clear: ["Temizle", "Təmizlə", "Тазалау", "Tozalash", "Тазалоо", "Clear", "Leeren", "Очистить", "مسح"],
    storageConsent: ["PDF belgelerimin özel hesabımda güvenli biçimde saklanmasını kabul ediyorum.", "PDF sənədlərimin şəxsi hesabımda təhlükəsiz saxlanmasını qəbul edirəm.", "PDF құжаттарымның жеке аккаунтымда қауіпсіз сақталуына келісемін.", "PDF hujjatlarim shaxsiy hisobimda xavfsiz saqlanishiga roziman.", "PDF документтеримдин жеке аккаунтумда коопсуз сакталуусуна макулмун.", "I agree that my PDF documents may be stored securely in my private account.", "Ich stimme der sicheren Speicherung meiner PDFs in meinem privaten Konto zu.", "Я согласен на безопасное хранение PDF в моей личной учетной записи.", "أوافق على حفظ مستندات PDF بأمان في حسابي الخاص."],
    saveDocuments: ["Belgeleri Kaydet", "Sənədləri saxla", "Құжаттарды сақтау", "Hujjatlarni saqlash", "Документтерди сактоо", "Save Documents", "Dokumente speichern", "Сохранить документы", "حفظ المستندات"],
    storageRule: ["Belgeleriniz yalnızca arşivlenir; içerikleri otomatik olarak okunmaz.", "Sənədlər yalnız arxivlənir; məzmun avtomatik oxunmur.", "Құжаттар тек мұрағатталады; мазмұны автоматты оқылмайды.", "Hujjatlar faqat arxivlanadi; mazmuni avtomatik o‘qilmaydi.", "Документтер архивге гана сакталат; мазмуну автоматтык окулбайт.", "Documents are archived only; their contents are not read automatically.", "Dokumente werden nur archiviert; Inhalte werden nicht automatisch ausgelesen.", "Документы только архивируются; содержимое автоматически не распознается.", "تُؤرشف المستندات فقط ولا تتم قراءة محتواها تلقائياً."],
    globalCvKicker: ["Profesyonel Çıktı", "Peşəkar nəticə", "Кәсіби нәтиже", "Professional natija", "Кесипкөй жыйынтык", "Professional Output", "Professionelle Ausgabe", "Профессиональный результат", "المخرج المهني"],
    globalCvTitle: ["Global CV", "Global CV", "Global CV", "Global CV", "Global CV", "Global CV", "Global CV", "Global CV", "Global CV"],
    globalCvLead: ["Kaydettiğiniz Maritime CV bilgileri ve fotoğrafınızla uluslararası başvurulara uygun Global CV'nizi oluşturun.", "Saxladığınız Maritime CV məlumatları və şəklinizlə beynəlxalq müraciətlər üçün Global CV yaradın.", "Сақталған Maritime CV деректері мен фотосуреттен халықаралық өтінімдерге арналған Global CV жасаңыз.", "Saqlangan Maritime CV maʼlumotlari va suratdan xalqaro arizalar uchun Global CV yarating.", "Сакталган Maritime CV маалыматы жана сүрөт менен эл аралык арыздар үчүн Global CV түзүңүз.", "Create a Global CV for international applications from your saved Maritime CV details and photo.", "Erstellen Sie aus Maritime CV und Foto einen Global CV für internationale Bewerbungen.", "Создайте Global CV для международных заявок из сохраненных данных Maritime CV и фотографии.", "أنشئ Global CV للتقديم الدولي من بيانات Maritime CV المحفوظة وصورتك."],
    createGlobalCv: ["Global CV'mi Oluştur", "Global CV-mi yarat", "Global CV жасау", "Global CV yaratish", "Global CV түзүү", "Create My Global CV", "Meinen Global CV erstellen", "Создать мой Global CV", "إنشاء Global CV الخاص بي"],
    globalCvNeedsMaritimeCv: ["Önce Maritime CV'nizi doldurup kaydedin.", "Əvvəl Maritime CV-ni doldurub saxlayın.", "Алдымен Maritime CV толтырып сақтаңыз.", "Avval Maritime CV-ni to‘ldirib saqlang.", "Адегенде Maritime CV-ни толтуруп сактаңыз.", "Complete and save your Maritime CV first.", "Füllen Sie zuerst Ihren Maritime CV aus und speichern Sie ihn.", "Сначала заполните и сохраните Maritime CV.", "أكمل Maritime CV واحفظه أولاً."],
    globalCvNeedsPhoto: ["Global CV için Maritime CV'nize fotoğraf ekleyip kaydedin.", "Global CV üçün Maritime CV-yə şəkil əlavə edib saxlayın.", "Global CV үшін Maritime CV-ге фото қосып сақтаңыз.", "Global CV uchun Maritime CV-ga surat qo‘shib saqlang.", "Global CV үчүн Maritime CV-ге сүрөт кошуп сактаңыз.", "Add and save a photo in Maritime CV before creating Global CV.", "Fügen Sie vor dem Global CV ein Foto im Maritime CV hinzu und speichern Sie es.", "Добавьте и сохраните фото в Maritime CV перед созданием Global CV.", "أضف صورة واحفظها في Maritime CV قبل إنشاء Global CV."],
    globalCvNeedsFields: ["Global CV için Maritime CV'nizdeki zorunlu kimlik ve pozisyon alanlarını tamamlayın.", "Global CV üçün Maritime CV-də məcburi şəxsiyyət və vəzifə sahələrini tamamlayın.", "Global CV үшін Maritime CV-дегі міндетті жеке дерек пен лауазым өрістерін толтырыңыз.", "Global CV uchun Maritime CV-dagi majburiy shaxsiy va lavozim maydonlarini to‘ldiring.", "Global CV үчүн Maritime CV-деги милдеттүү жеке маалымат жана кызмат талааларын толтуруңуз.", "Complete the required identity and position fields in Maritime CV before creating Global CV.", "Vervollständigen Sie die erforderlichen Identitäts- und Positionsangaben im Maritime CV.", "Заполните обязательные личные данные и должность в Maritime CV.", "أكمل حقول الهوية والوظيفة المطلوبة في Maritime CV قبل إنشاء Global CV."],
    globalCvCreating: ["Global CV hazırlanıyor...", "Global CV hazırlanır...", "Global CV дайындалуда...", "Global CV tayyorlanmoqda...", "Global CV даярдалууда...", "Creating Global CV...", "Global CV wird erstellt...", "Global CV создается...", "جارٍ إنشاء Global CV..."],
    reviewKicker: ["Belgelerim", "Sənədlərim", "Құжаттарым", "Hujjatlarim", "Документтерим", "My Documents", "Meine Dokumente", "Мои документы", "مستنداتي"],
    reviewHeading: ["Yüklenen Belgeler", "Yüklənmiş sənədlər", "Жүктелген құжаттар", "Yuklangan hujjatlar", "Жүктөлгөн документтер", "Uploaded Documents", "Hochgeladene Dokumente", "Загруженные документы", "المستندات المرفوعة"],
    reviewLead: ["Hesabınıza eklediğiniz PDF belgelerini burada görüntüleyebilirsiniz.", "Hesabınıza əlavə etdiyiniz PDF sənədləri burada görə bilərsiniz.", "Аккаунтқа қосқан PDF құжаттарын осында көріңіз.", "Hisobga qo‘shilgan PDF hujjatlarni shu yerda ko‘ring.", "Аккаунтка кошулган PDF документтерди бул жерден көрүңүз.", "View the PDF documents saved in your account here.", "Hier sehen Sie die in Ihrem Konto gespeicherten PDFs.", "Здесь отображаются PDF, сохраненные в вашей учетной записи.", "اعرض هنا مستندات PDF المحفوظة في حسابك."],
    noDocuments: ["Henüz belge yüklenmedi", "Hələ sənəd yüklənməyib", "Құжат әлі жүктелмеген", "Hali hujjat yuklanmagan", "Азырынча документ жүктөлгөн жок", "No documents uploaded yet", "Noch keine Dokumente hochgeladen", "Документы еще не загружены", "لم يتم رفع مستندات بعد"],
    noDocumentsLead: ["Eklediğiniz PDF belgeleri burada listelenecek.", "Əlavə etdiyiniz PDF sənədlər burada görünəcək.", "Қосылған PDF құжаттар осында көрсетіледі.", "Qo‘shilgan PDF hujjatlar shu yerda ko‘rinadi.", "Кошулган PDF документтер бул жерде көрүнөт.", "Your saved PDF documents will appear here.", "Gespeicherte PDFs erscheinen hier.", "Сохраненные PDF появятся здесь.", "ستظهر مستندات PDF المحفوظة هنا."],
    documentPageLinks: ["Belge sayfası bağlantıları", "Sənəd səhifəsi keçidləri", "Құжат бетінің сілтемелері", "Hujjat sahifasi havolalari", "Документ барагынын шилтемелери", "Document page links", "Links der Dokumentenseite", "Ссылки страницы документов", "روابط صفحة المستندات"],
    backToPanel: ["Panele Dön", "Panelə qayıt", "Панельге оралу", "Panelga qaytish", "Панелге кайтуу", "Back to Account", "Zum Konto", "Вернуться в кабинет", "العودة إلى الحساب"],
    matchingJobs: ["Bana Uygun İşler", "Mənə uyğun işlər", "Маған лайық жұмыстар", "Menga mos ishlar", "Мага ылайыктуу жумуштар", "Matching Jobs", "Passende Stellen", "Подходящие вакансии", "الوظائف المناسبة"],
    removeFile: ["Kaldır", "Sil", "Алып тастау", "Olib tashlash", "Алып салуу", "Remove", "Entfernen", "Удалить", "إزالة"],
    statusUploading: ["Belgeler kaydediliyor", "Sənədlər saxlanılır", "Құжаттар сақталуда", "Hujjatlar saqlanmoqda", "Документтер сакталууда", "Saving documents", "Dokumente werden gespeichert", "Сохранение документов", "جارٍ حفظ المستندات"],
    statusSaved: ["Belgeleriniz hesabınıza kaydedildi.", "Sənədlər hesabınıza yazıldı.", "Құжаттар аккаунтқа сақталды.", "Hujjatlar hisobingizga saqlandi.", "Документтер аккаунтуңузга сакталды.", "Your documents were saved to your account.", "Ihre Dokumente wurden gespeichert.", "Документы сохранены в учетной записи.", "تم حفظ المستندات في حسابك."],
    uploadFailed: ["Bazı belgeler kaydedilemedi. Lütfen tekrar deneyin.", "Bəzi sənədlər saxlanmadı. Yenidən cəhd edin.", "Кейбір құжаттар сақталмады. Қайталап көріңіз.", "Ayrim hujjatlar saqlanmadi. Qayta urinib ko‘ring.", "Айрым документтер сакталган жок. Кайра аракет кылыңыз.", "Some documents could not be saved. Please try again.", "Einige Dokumente konnten nicht gespeichert werden.", "Некоторые документы не удалось сохранить.", "تعذر حفظ بعض المستندات. حاول مرة أخرى."],
    invalidType: ["Yalnız PDF dosyası yükleyebilirsiniz.", "Yalnız PDF faylı yükləyə bilərsiniz.", "Тек PDF жүктеуге болады.", "Faqat PDF yuklash mumkin.", "PDF гана жүктөөгө болот.", "Only PDF files are allowed.", "Nur PDF-Dateien sind erlaubt.", "Разрешены только PDF.", "يُسمح بملفات PDF فقط."],
    tooLarge: ["Bir PDF 45 MB sınırını aşıyor.", "PDF 45 MB həddini aşır.", "PDF 45 МБ шегінен асты.", "PDF 45 MB chegaradan oshdi.", "PDF 45 МБ чегинен ашты.", "A PDF exceeds the 45 MB limit.", "Eine PDF überschreitet 45 MB.", "PDF превышает 45 МБ.", "يتجاوز ملف PDF حد 45 ميغابايت."],
    tooMany: ["En fazla 20 PDF seçebilirsiniz.", "Ən çox 20 PDF seçə bilərsiniz.", "20 PDF-ке дейін таңдаңыз.", "20 tagacha PDF tanlang.", "20га чейин PDF тандаңыз.", "You can select up to 20 PDFs.", "Sie können bis zu 20 PDFs auswählen.", "Можно выбрать до 20 PDF.", "يمكنك اختيار ما يصل إلى 20 ملف PDF."],
    totalTooLarge: ["Toplam seçim 150 MB sınırını aşıyor.", "Ümumi seçim 150 MB həddini aşır.", "Жалпы көлем 150 МБ-тан асты.", "Jami hajm 150 MB dan oshdi.", "Жалпы көлөм 150 МБ чегинен ашты.", "The total selection exceeds 150 MB.", "Die Gesamtauswahl überschreitet 150 MB.", "Общий размер превышает 150 МБ.", "يتجاوز الحجم الإجمالي 150 ميغابايت."],
    consentRequired: ["Belgeleri kaydetmek için saklama onayını işaretleyin.", "Sənədləri saxlamaq üçün razılığı işarələyin.", "Сақтау келісімін белгілеңіз.", "Saqlash roziligini belgilang.", "Сактоо макулдугун белгилеңиз.", "Accept document storage before saving.", "Stimmen Sie vor dem Speichern der Ablage zu.", "Подтвердите хранение документов.", "وافق على حفظ المستندات قبل المتابعة."],
    loadFailed: ["Bilgiler şu anda yüklenemedi.", "Məlumatlar indi yüklənmədi.", "Деректер жүктелмеді.", "Maʼlumotlar yuklanmadi.", "Маалымат жүктөлгөн жок.", "Information could not be loaded.", "Informationen konnten nicht geladen werden.", "Не удалось загрузить данные.", "تعذر تحميل المعلومات."],
    openDocument: ["Belgeyi Aç", "Sənədi aç", "Құжатты ашу", "Hujjatni ochish", "Документти ачуу", "Open Document", "Dokument öffnen", "Открыть документ", "فتح المستند"],
    deleteDocument: ["Belgeyi Sil", "Sənədi sil", "Құжатты жою", "Hujjatni o‘chirish", "Документти өчүрүү", "Delete Document", "Dokument löschen", "Удалить документ", "حذف المستند"],
    deleteDocumentConfirm: ["Bu belge özel arşivinizden kalıcı olarak silinsin mi?", "Bu sənəd şəxsi arxivinizdən həmişəlik silinsin?", "Бұл құжат жеке мұрағаттан біржола жойылсын ба?", "Bu hujjat shaxsiy arxivdan butunlay o‘chirilsinmi?", "Бул документ жеке архивден биротоло өчүрүлсүнбү?", "Permanently delete this document from your private archive?", "Dieses Dokument dauerhaft aus Ihrem privaten Archiv löschen?", "Навсегда удалить этот документ из личного архива?", "هل تريد حذف هذا المستند نهائياً من أرشيفك الخاص؟"],
    documentDeleted: ["Belge özel arşivinizden silindi.", "Sənəd şəxsi arxivinizdən silindi.", "Құжат жеке мұрағаттан жойылды.", "Hujjat shaxsiy arxivdan o‘chirildi.", "Документ жеке архивден өчүрүлдү.", "The document was deleted from your private archive.", "Das Dokument wurde aus Ihrem privaten Archiv gelöscht.", "Документ удалён из личного архива.", "تم حذف المستند من أرشيفك الخاص."],
    deleteFailed: ["Belge silinemedi. Maritime CV içinde kullanılıyorsa önce ilgili tecrübeyi güncelleyin.", "Sənəd silinmədi. Maritime CV-də istifadə olunursa əvvəl müvafiq təcrübəni yeniləyin.", "Құжат жойылмады. Maritime CV-де қолданылса, алдымен тәжірибені жаңартыңыз.", "Hujjat o‘chirilmadi. Maritime CV-da ishlatilsa, avval tajribani yangilang.", "Документ өчүрүлгөн жок. Maritime CV-де колдонулса, адегенде тажрыйбаны жаңыртыңыз.", "The document could not be deleted. If it is used in Maritime CV, update that experience first.", "Das Dokument konnte nicht gelöscht werden. Aktualisieren Sie zuerst den Eintrag im Maritime CV.", "Не удалось удалить документ. Если он используется в Maritime CV, сначала обновите запись.", "تعذر حذف المستند. إذا كان مستخدماً في Maritime CV فحدّث الخبرة أولاً."],
    storageUsage: ["Özel arşiv kullanımı", "Şəxsi arxiv istifadəsi", "Жеке мұрағатты пайдалану", "Shaxsiy arxivdan foydalanish", "Жеке архивди колдонуу", "Private archive usage", "Nutzung des privaten Archivs", "Использование личного архива", "استخدام الأرشيف الخاص"],
    documentSaved: ["Kaydedildi", "Saxlanıldı", "Сақталды", "Saqlandi", "Сакталды", "Saved", "Gespeichert", "Сохранено", "تم الحفظ"]
  };

  function language() {
    const code = document.documentElement.lang || localStorage.getItem("allonahub_language") || "tr";
    return languageCodes.includes(code) ? code : "tr";
  }

  function text(key) {
    const row = copyRows[key];
    return row ? row[languageCodes.indexOf(language())] || row[0] : key;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" }[character];
    });
  }

  function apiBase() {
    return String(App.config && App.config.apiBaseUrl || "https://api.allonahub.com").replace(/\/$/, "");
  }

  async function responsePayload(response) {
    const payload = await response.json().catch(function () { return {}; });
    if (!response.ok || payload.ok !== true) {
      const error = new Error(payload.message || "REQUEST_FAILED");
      error.status = response.status;
      error.code = response.status === 401 ? "AUTH_REQUIRED" : payload.code || payload.error || "REQUEST_FAILED";
      throw error;
    }
    return payload;
  }

  async function requestSession() {
    const current = App.auth && App.auth.getSession ? await App.auth.getSession() : null;
    if (!current?.access_token || (state.session?.user?.id && state.session.user.id !== current.user?.id)) {
      throw Object.assign(new Error("AUTH_REQUIRED"), { code: "AUTH_REQUIRED" });
    }
    return current;
  }

  async function api(path, options) {
    const session = await requestSession();
    const response = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.access_token}`,
        ...(options && options.body ? { "Content-Type": "application/json" } : {}),
        ...(options && options.headers || {})
      }
    });
    return responsePayload(response);
  }

  function setStatus(message, tone) {
    const target = document.querySelector("[data-document-status]");
    if (!target) return;
    target.textContent = message || "";
    target.className = `maritime-notice${message ? " is-visible" : ""}${tone ? ` is-${tone}` : ""}`;
  }

  function setProgress(visible, label, detail, percent) {
    const target = document.querySelector("[data-document-progress]");
    if (!target) return;
    target.hidden = !visible;
    if (!visible) return;
    target.style.setProperty("--document-progress", `${Math.max(0, Math.min(100, Number(percent) || 0))}%`);
    const labelTarget = target.querySelector("[data-document-progress-label]");
    const detailTarget = target.querySelector("[data-document-progress-detail]");
    if (labelTarget) labelTarget.textContent = label || "";
    if (detailTarget) detailTarget.textContent = detail || "";
  }

  function formatBytes(value) {
    const bytes = Math.max(0, Number(value) || 0);
    if (!bytes) return "0 KB";
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function validateFiles(files) {
    if (files.length > maxFiles) throw new Error(text("tooMany"));
    let total = 0;
    for (const file of files) {
      if (!allowedTypes.includes(file.type) && !/\.pdf$/i.test(file.name)) throw new Error(text("invalidType"));
      if (!file.size || file.size > maxFileBytes) throw new Error(text("tooLarge"));
      total += file.size;
    }
    if (total > maxBatchBytes) throw new Error(text("totalTooLarge"));
  }

  function addFiles(fileList) {
    const next = [...state.files];
    for (const file of Array.from(fileList || [])) {
      const duplicate = next.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified);
      if (!duplicate) next.push(file);
    }
    try {
      validateFiles(next);
      state.files = next;
      setStatus("");
    } catch (error) {
      setStatus(error.message, "error");
    }
    renderSelection();
  }

  function renderSelection() {
    const selection = document.querySelector("[data-document-selection]");
    const rail = document.querySelector("[data-document-file-rail]");
    const submit = document.querySelector("[data-document-submit]");
    if (selection) selection.hidden = state.files.length === 0;
    if (rail) rail.innerHTML = state.files.map(function (file, index) {
      return `<article><i class="fa-solid fa-file-pdf" aria-hidden="true"></i><span><strong>${escapeHtml(file.name)}</strong><small>${escapeHtml(formatBytes(file.size))}</small></span><button type="button" data-remove-file="${index}" aria-label="${escapeHtml(text("removeFile"))}" title="${escapeHtml(text("removeFile"))}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></article>`;
    }).join("");
    if (submit) submit.disabled = state.busy || state.files.length === 0;
  }

  function hasMaritimeCv() {
    return state.remote?.cv_profile?.profile_payload?.data_origin === "user_entered_maritime_cv";
  }

  function hasConfirmedMaritimeCv() {
    const profile = state.remote?.cv_profile;
    return Boolean(profile?.last_user_confirmed_at && ["user_confirmed", "verification_pending", "verified"].includes(profile.profile_status));
  }

  function renderCvSource() {
    const status = document.querySelector("[data-maritime-cv-status]");
    const link = document.querySelector("[data-maritime-cv-source] a[href='maritime-cv.html'] span");
    const create = document.querySelector("[data-create-global-cv]");
    const cvReady = hasMaritimeCv();
    const photoReady = state.remote?.profile_photo_ready === true;
    const fieldsReady = state.remote?.global_cv_readiness?.ready === true;
    const confirmed = hasConfirmedMaritimeCv();
    if (status) status.textContent = text(cvReady ? fieldsReady && !confirmed ? "globalCvNeedsConfirmation" : "maritimeCvReady" : "maritimeCvMissing");
    if (link) link.textContent = text(cvReady ? "editMaritimeCv" : "openMaritimeCv");
    if (create) {
      create.disabled = state.busy || !cvReady || !photoReady || !fieldsReady || !confirmed;
      create.title = !cvReady ? text("globalCvNeedsMaritimeCv") : !photoReady ? text("globalCvNeedsPhoto") : !fieldsReady ? text("globalCvNeedsFields") : !confirmed ? text("globalCvNeedsConfirmation") : "";
    }
  }

  function renderDocuments() {
    const list = document.querySelector("[data-document-review-list]");
    if (!list) return;
    const documents = Array.isArray(state.remote?.documents) ? state.remote.documents : [];
    const usage = state.remote?.storage_usage;
    const usageTarget = document.querySelector("[data-document-storage-usage]");
    if (usageTarget && usage) usageTarget.textContent = `${text("storageUsage")}: ${formatBytes(usage.used_bytes)} / ${formatBytes(usage.max_bytes)} · ${usage.file_count} / ${usage.max_files}`;
    if (!documents.length) {
      list.innerHTML = `<article class="maritime-document-empty"><i class="fa-solid fa-file-shield" aria-hidden="true"></i><strong>${escapeHtml(text("noDocuments"))}</strong><span>${escapeHtml(text("noDocumentsLead"))}</span></article>`;
      return;
    }
    list.innerHTML = documents.map(function (documentRow) {
      return `<article class="maritime-document-review-card is-confirmed"><div class="maritime-document-card-summary"><span class="maritime-document-type-icon"><i class="fa-solid fa-file-pdf" aria-hidden="true"></i></span><span><strong>${escapeHtml(documentRow.original_file_name || "PDF")}</strong><small>PDF · ${escapeHtml(formatBytes(documentRow.file_size_bytes))}</small></span><span class="maritime-document-state is-confirmed">${escapeHtml(text("documentSaved"))}</span></div><div class="maritime-document-card-utility"><button type="button" data-open-intake="${escapeHtml(documentRow.id)}"><i class="fa-solid fa-eye" aria-hidden="true"></i>${escapeHtml(text("openDocument"))}</button><button type="button" data-delete-intake="${escapeHtml(documentRow.id)}"><i class="fa-solid fa-trash-can" aria-hidden="true"></i>${escapeHtml(text("deleteDocument"))}</button></div></article>`;
    }).join("");
  }

  function applyTranslations() {
    document.querySelectorAll("[data-document-i18n]").forEach(function (node) {
      const value = text(node.dataset.documentI18n);
      if (value) node.textContent = value;
    });
    document.querySelectorAll("[data-document-i18n-aria]").forEach(function (node) {
      const value = text(node.dataset.documentI18nAria);
      if (value) node.setAttribute("aria-label", value);
    });
    renderSelection();
    renderCvSource();
    renderDocuments();
  }

  async function loadRemote() {
    try {
      state.remote = await api("/v1/maritime/documents", { method: "GET" });
      renderCvSource();
      renderDocuments();
    } catch (error) {
      setStatus(error.message || text("loadFailed"), "error");
    }
  }

  async function archiveFile(file) {
    const session = await requestSession();
    const response = await fetch(`${apiBase()}/v1/maritime/documents/archive`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/pdf",
        "X-Allona-File-Name": encodeURIComponent(file.name)
      },
      body: file
    });
    return responsePayload(response);
  }

  async function saveDocuments(form) {
    validateFiles(state.files);
    if (!form.elements.storage_consent.checked) throw new Error(text("consentRequired"));
    state.busy = true;
    renderSelection();
    setStatus("");
    let saved = 0;
    let failed = 0;
    try {
      for (const file of state.files) {
        setProgress(true, text("statusUploading"), `${saved + failed + 1} / ${state.files.length}`, Math.round((saved + failed) / state.files.length * 100));
        try {
          await archiveFile(file);
          saved += 1;
        } catch (error) {
          failed += 1;
        }
      }
      state.files = [];
      form.reset();
      await loadRemote();
      setStatus(failed ? text("uploadFailed") : text("statusSaved"), failed ? "error" : "success");
    } finally {
      state.busy = false;
      setProgress(false);
      renderSelection();
      renderCvSource();
    }
  }

  async function createGlobalCv(button) {
    if (state.busy) return;
    if (!hasMaritimeCv()) return setStatus(text("globalCvNeedsMaritimeCv"), "error");
    if (state.remote?.profile_photo_ready !== true) return setStatus(text("globalCvNeedsPhoto"), "error");
    if (state.remote?.global_cv_readiness?.ready !== true) return setStatus(text("globalCvNeedsFields"), "error");
    if (!hasConfirmedMaritimeCv()) return setStatus(text("globalCvNeedsConfirmation"), "error");
    state.busy = true;
    button.disabled = true;
    setStatus(text("globalCvCreating"));
    try {
      await api("/v1/maritime/smart-account/prepare", { method: "POST", body: JSON.stringify({}) });
      window.location.href = "maritime-smart-account.html?openCv=1&created=1";
    } catch (error) {
      setStatus(error.message || text("loadFailed"), "error");
      state.busy = false;
      renderCvSource();
    }
  }

  async function openDocument(intakeId, button) {
    button.disabled = true;
    try {
      const result = await api(`/v1/maritime/documents/${encodeURIComponent(intakeId)}/download`, { method: "GET" });
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setStatus(error.message || text("loadFailed"), "error");
    } finally {
      button.disabled = false;
    }
  }

  async function deleteDocument(intakeId, button) {
    if (!window.confirm(text("deleteDocumentConfirm"))) return;
    button.disabled = true;
    try {
      await api(`/v1/maritime/documents/${encodeURIComponent(intakeId)}`, { method: "DELETE" });
      await loadRemote();
      setStatus(text("documentDeleted"), "success");
    } catch (error) {
      setStatus(error.message && error.message !== "REQUEST_FAILED" ? error.message : text("deleteFailed"), "error");
      button.disabled = false;
    }
  }

  function bindEvents() {
    const input = document.querySelector("[data-document-files]");
    const dropzone = document.querySelector("[data-document-dropzone]");
    const form = document.querySelector("[data-document-upload-form]");
    if (input) input.addEventListener("change", function () { addFiles(input.files); input.value = ""; });
    if (dropzone) {
      ["dragenter", "dragover"].forEach(function (name) { dropzone.addEventListener(name, function (event) { event.preventDefault(); dropzone.classList.add("is-dragging"); }); });
      ["dragleave", "drop"].forEach(function (name) { dropzone.addEventListener(name, function (event) { event.preventDefault(); dropzone.classList.remove("is-dragging"); }); });
      dropzone.addEventListener("drop", function (event) { addFiles(event.dataTransfer && event.dataTransfer.files); });
    }
    if (form) form.addEventListener("submit", function (event) {
      event.preventDefault();
      saveDocuments(form).catch(function (error) {
        state.busy = false;
        setProgress(false);
        renderSelection();
        setStatus(error.message || text("uploadFailed"), "error");
      });
    });
    document.addEventListener("click", function (event) {
      const remove = event.target.closest("[data-remove-file]");
      if (remove) {
        state.files.splice(Number(remove.dataset.removeFile), 1);
        renderSelection();
        return;
      }
      if (event.target.closest("[data-clear-documents]")) {
        state.files = [];
        renderSelection();
        setStatus("");
        return;
      }
      const create = event.target.closest("[data-create-global-cv]");
      if (create) return createGlobalCv(create);
      const open = event.target.closest("[data-open-intake]");
      if (open) return openDocument(open.dataset.openIntake, open);
      const removeSaved = event.target.closest("[data-delete-intake]");
      if (removeSaved) deleteDocument(removeSaved.dataset.deleteIntake, removeSaved);
    });
  }

  async function initialize(detail) {
    state.session = detail?.session || state.session;
    if (!state.session) return;
    const access = App.auth && App.auth.requireAccountType ? await App.auth.requireAccountType("customer", { user: state.session.user, redirect: true }) : null;
    if (!access) return;
    if (!state.initialized) {
      state.initialized = true;
      bindEvents();
    }
    applyTranslations();
    await loadRemote();
  }

  document.addEventListener("allona:maritime-documents-ready", function (event) { initialize(event.detail || {}); });
  document.addEventListener("allona:language-changed", applyTranslations);
})();
