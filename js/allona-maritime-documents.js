(function () {
  "use strict";

  const App = window.Allona = window.Allona || {};
  const languageCodes = ["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"];
  const localeCodes = { tr: "tr-TR", az: "az-AZ", kk: "kk-KZ", uz: "uz-UZ", ky: "ky-KG", en: "en-GB", de: "de-DE", ru: "ru-RU", ar: "ar-SA" };
  const allowedTypes = ["application/pdf"];
  const maxFiles = 20;
  const maxFileBytes = 45 * 1024 * 1024;
  const maxBatchBytes = 150 * 1024 * 1024;
  const state = { session: null, files: [], remote: null, busy: false, photoBusy: false, pendingPhoto: null, initialized: false };

  const copyRows = {
    smartDoctor: ["Belgelerim", "Sənədlərim", "Құжаттарым", "Hujjatlarim", "Документтерим", "My Documents", "Meine Dokumente", "Мои документы", "مستنداتي"],
    uploadHeading: ["PDF belgelerinizi yükleyin", "PDF sənədlərinizi yükləyin", "PDF құжаттарыңызды жүктеңіз", "PDF hujjatlaringizni yuklang", "PDF документтериңизди жүктөңүз", "Upload your PDF documents", "PDF-Dokumente hochladen", "Загрузите PDF-документы", "ارفع مستندات PDF"],
    uploadLead: ["Tek seferde en fazla 20 PDF dosyası seçebilirsiniz.", "Bir dəfədə 20-yə qədər PDF faylı seçə bilərsiniz.", "Бір ретте 20 PDF файлына дейін таңдауға болады.", "Bir martada 20 tagacha PDF fayl tanlang.", "Бир жолу 20 PDF файлга чейин тандаңыз.", "Choose up to 20 PDF files at once.", "Wählen Sie bis zu 20 PDF-Dateien gleichzeitig.", "Выберите до 20 PDF-файлов за один раз.", "اختر ما يصل إلى 20 ملف PDF في المرة الواحدة."],
    chooseFiles: ["PDF belgelerini seçin", "PDF sənədlərini seçin", "PDF құжаттарын таңдаңыз", "PDF hujjatlarini tanlang", "PDF документтерин тандаңыз", "Choose PDF documents", "PDF-Dokumente auswählen", "Выбрать PDF-документы", "اختر مستندات PDF"],
    chooseFilesHint: ["PDF dosyalarını buraya bırakabilir veya cihazınızdan seçebilirsiniz.", "PDF fayllarını bura buraxa və ya cihazınızdan seçə bilərsiniz.", "PDF файлдарын осында апарыңыз немесе құрылғыдан таңдаңыз.", "PDF fayllarni shu yerga tashlang yoki qurilmadan tanlang.", "PDF файлдарды бул жерге таштаңыз же түзмөктөн тандаңыз.", "Drop PDF files here or choose them from your device.", "PDF-Dateien hier ablegen oder vom Gerät auswählen.", "Перетащите PDF-файлы сюда или выберите на устройстве.", "أسقط ملفات PDF هنا أو اخترها من جهازك."],
    fileLimits: ["Her dosya en fazla 45 MB, toplam paket en fazla 150 MB.", "Hər fayl ən çox 45 MB, ümumi paket ən çox 150 MB.", "Әр файл 45 МБ, жалпы пакет 150 МБ-тан аспауы керек.", "Har bir fayl 45 MB, jami paket 150 MB dan oshmasin.", "Ар бир файл 45 МБ, жалпы топтом 150 МБдан ашпасын.", "45 MB per file, 150 MB per batch.", "45 MB pro Datei, 150 MB pro Paket.", "До 45 МБ на файл и 150 МБ на пакет.", "45 ميجابايت لكل ملف و150 ميجابايت للحزمة."],
    selectedFiles: ["Seçilen belgeler", "Seçilmiş sənədlər", "Таңдалған құжаттар", "Tanlangan hujjatlar", "Тандалган документтер", "Selected documents", "Ausgewählte Dokumente", "Выбранные документы", "المستندات المحددة"],
    clear: ["Temizle", "Təmizlə", "Тазалау", "Tozalash", "Тазалоо", "Clear", "Leeren", "Очистить", "مسح"],
    analysisConsent: ["Belgelerimin yalnız denizcilik profilimi önceden doldurmak amacıyla güvenli belge analiz hizmeti tarafından işlenmesini kabul ediyorum.", "Sənədlərimin yalnız dənizçilik profilimi əvvəlcədən doldurmaq üçün təhlükəsiz sənəd analizi xidməti ilə işlənməsini qəbul edirəm.", "Құжаттарымның тек теңіз профилін алдын ала толтыру үшін қауіпсіз талдау қызметімен өңделуіне келісемін.", "Hujjatlarim faqat dengizchilik profilini oldindan to‘ldirish uchun xavfsiz tahlil xizmati bilan qayta ishlanishiga roziman.", "Документтерим деңизчилик профилимди алдын ала толтуруу үчүн гана коопсуз талдоо кызматы менен иштетилишине макулмун.", "I agree that my documents may be processed by the secure document analysis service only to prefill my maritime profile.", "Ich stimme der Verarbeitung meiner Dokumente ausschließlich zur Vorbefüllung meines Seefahrtprofils zu.", "Я согласен на обработку документов только для предварительного заполнения морского профиля.", "أوافق على معالجة مستنداتي فقط لملء ملفي البحري مسبقًا بواسطة خدمة التحليل الآمنة."],
    uploadAndAnalyze: ["Global Pasaportu Oluştur", "Global Pasportu yarat", "Global Passport жасау", "Global Passport yaratish", "Global Passport түзүү", "Create Global Passport", "Global Passport erstellen", "Создать Global Passport", "إنشاء جواز السفر العالمي"],
    updateModeTitle: ["Global Pasaporta Yeni Belge Ekle", "Global Pasporta yeni sənəd əlavə et", "Global Passport құжатына жаңа құжат қосу", "Global Passportga yangi hujjat qo‘shish", "Global Passportко жаңы документ кошуу", "Add a New Document to Global Passport", "Neues Dokument zum Global Passport hinzufügen", "Добавить новый документ в Global Passport", "إضافة مستند جديد إلى جواز السفر العالمي"],
    updateModeLead: ["Yeni kontrat, deniz hizmeti, sertifika veya referans belgeniz mevcut kayıtları silmeden analiz edilir. Siz onayladıktan sonra doğru bölüme eklenir.", "Yeni müqavilə, dəniz xidməti, sertifikat və ya istinad sənədi mövcud qeydlər silinmədən təhlil edilir. Təsdiqinizdən sonra düzgün bölməyə əlavə olunur.", "Жаңа келісімшарт, теңіз қызметі, сертификат немесе ұсыным құжаты бұрынғы жазбаларды өшірмей талданады. Сіз растағаннан кейін тиісті бөлімге қосылады.", "Yangi kontrakt, dengiz xizmati, sertifikat yoki tavsiya hujjati mavjud yozuvlarni o‘chirmasdan tahlil qilinadi. Tasdiqlaganingizdan keyin tegishli bo‘limga qo‘shiladi.", "Жаңы контракт, деңиз кызматы, сертификат же сунуш документи мурунку жазууларды өчүрбөй талданат. Сиз ырастагандан кийин туура бөлүмгө кошулат.", "Your new contract, sea-service, certificate, or reference document is analyzed without deleting existing records. After your approval, it is added to the correct section.", "Ein neuer Vertrag, Dienstzeit-, Zertifikats- oder Referenznachweis wird analysiert, ohne bestehende Einträge zu löschen. Nach Ihrer Bestätigung wird er dem richtigen Bereich hinzugefügt.", "Новый контракт, документ о стаже, сертификат или рекомендация анализируется без удаления прежних записей. После вашего подтверждения запись добавляется в нужный раздел.", "يُحلل العقد الجديد أو مستند الخدمة البحرية أو الشهادة أو المرجع دون حذف السجلات الحالية، ثم يُضاف إلى القسم الصحيح بعد موافقتك."],
    updateAndAnalyze: ["Belgeyi Ekle ve GP CV'yi Güncelle", "Sənədi əlavə et və GP CV-ni yenilə", "Құжатты қосып, GP CV жаңарту", "Hujjatni qo‘shish va GP CV-ni yangilash", "Документти кошуп, GP CV-ни жаңыртуу", "Add Document and Update GP CV", "Dokument hinzufügen und GP CV aktualisieren", "Добавить документ и обновить GP CV", "إضافة المستند وتحديث GP CV"],
    updateConfirmationRule: ["Yeni bilgi önce size gösterilir. Siz onaylamadan mevcut Global Pasaport veya GP CV kaydınız değişmez.", "Yeni məlumat əvvəlcə sizə göstərilir. Təsdiqiniz olmadan mövcud Global Pasport və ya GP CV qeydi dəyişmir.", "Жаңа дерек алдымен сізге көрсетіледі. Сіз растамайынша Global Passport немесе GP CV өзгермейді.", "Yangi maʼlumot avval sizga ko‘rsatiladi. Tasdiqlamaguningizcha Global Passport yoki GP CV o‘zgarmaydi.", "Жаңы маалымат адегенде сизге көрсөтүлөт. Сиз ырастамайынча Global Passport же GP CV өзгөрбөйт.", "New information is shown to you first. Your existing Global Passport and GP CV do not change until you approve it.", "Neue Angaben werden Ihnen zuerst angezeigt. Global Passport und GP CV ändern sich erst nach Ihrer Bestätigung.", "Новые данные сначала показываются вам. Global Passport и GP CV не изменятся без вашего подтверждения.", "تُعرض المعلومات الجديدة عليك أولًا، ولا يتغير جواز السفر العالمي أو GP CV قبل موافقتك."],
    confirmationRule: ["Hiçbir bilgi siz kontrol edip onaylamadan CV'nize kaydedilmez.", "Heç bir məlumat siz yoxlayıb təsdiqləmədən CV-yə yazılmır.", "Сіз тексеріп растамайынша ешбір дерек түйіндемеге жазылмайды.", "Siz tekshirib tasdiqlamaguncha hech bir maʼlumot CV ga yozilmaydi.", "Сиз текшерип ырастамайынча эч бир маалымат CVге жазылбайт.", "Nothing is saved to your CV until you review and confirm it.", "Nichts wird ohne Ihre Prüfung und Bestätigung im Lebenslauf gespeichert.", "Ничего не сохраняется в резюме без вашей проверки и подтверждения.", "لن يُحفظ شيء في سيرتك قبل المراجعة والتأكيد."],
    cvCompletion: ["Maritime CV tamamlanma", "Maritime CV tamamlanması", "Maritime CV толтырылуы", "Maritime CV to‘liqligi", "Maritime CV толуктугу", "Maritime CV completion", "Maritime-CV-Vollständigkeit", "Заполнение Maritime CV", "اكتمال السيرة البحرية"],
    whatSystemReads: ["Sistem neleri ayırır?", "Sistem nələri ayırır?", "Жүйе нені ажыратады?", "Tizim nimalarni ajratadi?", "Система эмнелерди бөлөт?", "What does the system extract?", "Was liest das System aus?", "Что извлекает система?", "ماذا يستخرج النظام؟"],
    readsIdentity: ["Belge türü, numarası ve düzenleyen kurum", "Sənəd növü, nömrəsi və verən qurum", "Құжат түрі, нөмірі және берген мекеме", "Hujjat turi, raqami va bergan tashkilot", "Документтин түрү, номери жана берген мекеме", "Document type, number, and issuing authority", "Dokumenttyp, Nummer und ausstellende Stelle", "Тип, номер и орган выдачи документа", "نوع المستند ورقمه والجهة المصدرة"],
    readsRank: ["Rütbe, yeterlilik ve uygun pozisyonlar", "Rütbə, səriştə və uyğun vəzifələr", "Атақ, біліктілік және лайықты лауазымдар", "Unvon, malaka va mos lavozimlar", "Наам, квалификация жана ылайыктуу кызматтар", "Rank, competency, and suitable positions", "Rang, Befähigung und passende Positionen", "Звание, квалификация и подходящие должности", "الرتبة والكفاءة والوظائف المناسبة"],
    readsCertificates: ["STCW ve diğer sertifika kodları", "STCW və digər sertifikat kodları", "STCW және басқа сертификат кодтары", "STCW va boshqa sertifikat kodlari", "STCW жана башка сертификат коддору", "STCW and other certificate codes", "STCW- und weitere Zertifikatscodes", "STCW и другие коды сертификатов", "رموز STCW والشهادات الأخرى"],
    readsDates: ["Başlangıç, bitiş ve geçerlilik tarihleri", "Başlanğıc, bitmə və etibarlılıq tarixləri", "Басталу, аяқталу және жарамдылық күндері", "Boshlanish, tugash va amal qilish sanalari", "Башталыш, аяктоо жана жарактуулук даталары", "Start, end, and expiry dates", "Beginn-, Ende- und Ablaufdaten", "Даты начала, окончания и действия", "تواريخ البدء والانتهاء والصلاحية"],
    readsService: ["Gemi, görev ve deniz hizmeti kayıtları", "Gəmi, vəzifə və dəniz xidməti qeydləri", "Кеме, міндет және теңіз қызметі жазбалары", "Kema, vazifa va dengiz xizmati qaydlari", "Кеме, милдет жана деңиз кызматы жазуулары", "Vessel, rank, and sea-service records", "Schiff, Funktion und Seefahrtzeiten", "Судно, должность и морской стаж", "السفينة والوظيفة وسجلات الخدمة البحرية"],
    privacyNote: ["Belgeler özel alanda tutulur. Şirketler dosyaları veya iletişim bilgilerinizi otomatik olarak göremez.", "Sənədlər özəl sahədə saxlanılır. Şirkətlər faylları və əlaqə məlumatlarınızı avtomatik görə bilməz.", "Құжаттар жеке кеңістікте сақталады. Компаниялар файлдар мен байланыс деректерін автоматты көрмейді.", "Hujjatlar yopiq maydonda saqlanadi. Kompaniyalar fayllar yoki aloqa maʼlumotlarini avtomatik ko‘rmaydi.", "Документтер жеке аймакта сакталат. Компаниялар файлдарды же байланыш маалыматтарын автоматтык көрбөйт.", "Documents stay private. Companies cannot automatically see the files or your contact details.", "Dokumente bleiben privat. Unternehmen sehen Dateien oder Kontaktdaten nicht automatisch.", "Документы хранятся приватно. Компании не видят файлы и контакты автоматически.", "تبقى المستندات خاصة ولا يمكن للشركات رؤية الملفات أو بيانات الاتصال تلقائيًا."],
    prepareSmartAccount: ["Akıllı Hesabımı Hazırla", "Ağıllı hesabımı hazırla", "Ақылды аккаунтымды дайындау", "Aqlli hisobimni tayyorlash", "Акылдуу аккаунтумду даярдоо", "Prepare My Smart Account", "Mein Smart-Konto vorbereiten", "Подготовить умный аккаунт", "جهّز حسابي الذكي"],
    reviewKicker: ["Belgelerim", "Sənədlərim", "Құжаттарым", "Hujjatlarim", "Документтерим", "My Documents", "Meine Dokumente", "Мои документы", "مستنداتي"],
    reviewHeading: ["Yüklenen Belgeler", "Yüklənmiş sənədlər", "Жүктелген құжаттар", "Yuklangan hujjatlar", "Жүктөлгөн документтер", "Uploaded Documents", "Hochgeladene Dokumente", "Загруженные документы", "المستندات المرفوعة"],
    reviewLead: ["Yüklediğiniz PDF belgelerini ve okuma durumlarını burada görebilirsiniz.", "Yüklədiyiniz PDF sənədlərini və oxunma vəziyyətini burada görə bilərsiniz.", "Жүктеген PDF құжаттары мен оқу күйін осы жерден көре аласыз.", "Yuklangan PDF hujjatlar va o‘qish holatini shu yerda ko‘ring.", "Жүктөлгөн PDF документтерди жана окуу абалын ушул жерден көрүңүз.", "View your uploaded PDF documents and their reading status here.", "Hier sehen Sie Ihre hochgeladenen PDF-Dokumente und deren Lesestatus.", "Здесь отображаются загруженные PDF-документы и статус их чтения.", "اعرض مستندات PDF المرفوعة وحالة قراءتها هنا."],
    globalPassportKicker: ["Oluşturulan Profil", "Yaradılan profil", "Жасалған профиль", "Yaratilgan profil", "Түзүлгөн профиль", "Generated Profile", "Erstelltes Profil", "Созданный профиль", "الملف المُنشأ"],
    globalPassportTitle: ["Global Pasaport Önizlemesi", "Global Pasport ön baxışı", "Global Passport алдын ала көрінісі", "Global Passport ko‘rinishi", "Global Passport алдын ала көрүнүшү", "Global Passport Preview", "Global-Passport-Vorschau", "Предпросмотр Global Passport", "معاينة جواز السفر العالمي"],
    globalPassportLead: ["Belgelerden okunan bilgileri kontrol edin. Yalnız doğruysa tek seferde onaylayın.", "Sənədlərdən oxunan məlumatları yoxlayın. Yalnız doğrudursa bir dəfə təsdiqləyin.", "Құжаттардан алынған деректерді тексеріп, дұрыс болса бір рет растаңыз.", "Hujjatlardan o‘qilgan maʼlumotlarni tekshiring va to‘g‘ri bo‘lsa bir marta tasdiqlang.", "Документтерден окулган маалыматты текшерип, туура болсо бир жолу ырастаңыз.", "Review the details extracted from your documents and confirm them once only if they are correct.", "Prüfen Sie die aus Ihren Dokumenten gelesenen Angaben und bestätigen Sie sie nur, wenn sie korrekt sind.", "Проверьте данные из документов и подтвердите их один раз, только если они верны.", "راجع البيانات المستخرجة من مستنداتك وأكدها مرة واحدة فقط إذا كانت صحيحة."],
    confirmGlobalPassport: ["Bilgiler Doğru, Global Pasaportu Onayla", "Məlumat doğrudur, Global Pasportu təsdiqlə", "Деректер дұрыс, Global Passport растау", "Maʼlumot to‘g‘ri, Global Passportni tasdiqlash", "Маалымат туура, Global Passport ырастоо", "Details Are Correct, Confirm Global Passport", "Angaben korrekt, Global Passport bestätigen", "Данные верны, подтвердить Global Passport", "البيانات صحيحة، تأكيد جواز السفر العالمي"],
    globalPassportConfirmed: ["Global Pasaportunuz onaylandı ve GP CV'niz hazırlandı.", "Global Pasportunuz təsdiqləndi və GP CV hazırlandı.", "Global Passport расталды және GP CV дайындалды.", "Global Passport tasdiqlandi va GP CV tayyorlandi.", "Global Passport ырасталды жана GP CV даярдалды.", "Your Global Passport was confirmed and your GP CV was prepared.", "Ihr Global Passport wurde bestätigt und Ihr GP CV vorbereitet.", "Global Passport подтвержден, GP CV подготовлен.", "تم تأكيد جواز السفر العالمي وإعداد GP CV."],
    globalPassportUpdated: ["Yeni belgeniz Global Pasaporta eklendi. GP CV ve iş eşleşmesi taslağınız güncellendi; yeni özeti kontrol edip onaylayın.", "Yeni sənəd Global Pasporta əlavə edildi. GP CV və iş uyğunluğu layihəsi yeniləndi; yeni xülasəni yoxlayıb təsdiqləyin.", "Жаңа құжат Global Passport деректеріне қосылды. GP CV және жұмыс сәйкестігі жобасы жаңартылды; жаңа қорытындыны тексеріп растаңыз.", "Yangi hujjat Global Passportga qo‘shildi. GP CV va ish mosligi loyihasi yangilandi; yangi xulosani tekshirib tasdiqlang.", "Жаңы документ Global Passportко кошулду. GP CV жана жумуш дал келүү долбоору жаңырды; жаңы жыйынтыкты текшерип ырастагыла.", "Your new document was added to Global Passport. The GP CV and job-match draft were refreshed; review and approve the new summary.", "Ihr neues Dokument wurde dem Global Passport hinzugefügt. GP CV und Jobabgleich-Entwurf wurden aktualisiert; prüfen und bestätigen Sie die neue Übersicht.", "Новый документ добавлен в Global Passport. Черновик GP CV и совпадений обновлен; проверьте и подтвердите новую сводку.", "أُضيف المستند الجديد إلى جواز السفر العالمي وتم تحديث مسودة GP CV ومطابقات الوظائف؛ راجع الملخص الجديد وأكده."],
    smartRefreshFailed: ["Belge kaydedildi; GP CV güncellemesi henüz tamamlanamadı. GP CV ekranındaki Yeniden Tara ve Güncelle düğmesini kullanın.", "Sənəd saxlanıldı; GP CV yeniləməsi hələ tamamlanmadı. GP CV ekranında Yenidən yoxla və yenilə düyməsini istifadə edin.", "Құжат сақталды, бірақ GP CV жаңартуы аяқталмады. GP CV экранындағы қайта тексеру және жаңарту түймесін қолданыңыз.", "Hujjat saqlandi, ammo GP CV yangilanishi tugallanmadi. GP CV ekranidagi qayta tekshirish va yangilash tugmasidan foydalaning.", "Документ сакталды, бирок GP CV жаңыртуусу бүтө элек. GP CV экранындагы кайра текшерип жаңыртуу баскычын колдонуңуз.", "The document was saved, but the GP CV refresh could not finish yet. Use Scan Again and Update on the GP CV screen.", "Das Dokument wurde gespeichert, aber der GP CV konnte noch nicht aktualisiert werden. Verwenden Sie im GP-CV-Bereich Neu prüfen und aktualisieren.", "Документ сохранен, но обновление GP CV пока не завершено. Используйте кнопку повторного сканирования на экране GP CV.", "تم حفظ المستند، لكن تحديث GP CV لم يكتمل بعد. استخدم زر إعادة الفحص والتحديث في شاشة GP CV."],
    globalPassportConfirming: ["Global Pasaport onaylanıyor", "Global Pasport təsdiqlənir", "Global Passport расталуда", "Global Passport tasdiqlanmoqda", "Global Passport ырасталууда", "Confirming Global Passport", "Global Passport wird bestätigt", "Подтверждение Global Passport", "جارٍ تأكيد جواز السفر العالمي"],
    viewMaritimeCv: ["GP CV'yi Gör", "GP CV-yə bax", "GP CV көру", "GP CV-ni ko‘rish", "GP CV көрүү", "View GP CV", "GP CV anzeigen", "Открыть GP CV", "عرض GP CV"],
    backToPanel: ["Panele Dön", "Panelə qayıt", "Панельге оралу", "Panelga qaytish", "Панелге кайтуу", "Back to Panel", "Zurück zum Konto", "Вернуться в панель", "العودة إلى اللوحة"],
    matchingJobs: ["Siteme Uygun İşler", "Mənə uyğun işlər", "Маған сәйкес жұмыстар", "Menga mos ishlar", "Мага ылайыктуу жумуштар", "Jobs That Match Me", "Passende Stellen", "Подходящие мне вакансии", "الوظائف المناسبة لي"],
    documentPageLinks: ["Belge sayfası bağlantıları", "Sənəd səhifəsi keçidləri", "Құжат бетінің сілтемелері", "Hujjat sahifasi havolalari", "Документ барагынын шилтемелери", "Document page links", "Links der Dokumentenseite", "Ссылки страницы документов", "روابط صفحة المستندات"],
    globalPassportSummary: ["PDF belgelerinden otomatik oluşturulan doğrulanabilir denizcilik profili", "PDF sənədlərindən avtomatik yaradılan yoxlanıla bilən dənizçilik profili", "PDF құжаттарынан автоматты жасалған тексерілетін теңіз профилі", "PDF hujjatlardan avtomatik yaratilgan tekshiriladigan dengizchilik profili", "PDF документтерден автоматтык түзүлгөн текшерилүүчү деңизчилик профили", "A verifiable maritime profile generated automatically from PDF documents", "Automatisch aus PDF-Dokumenten erstelltes prüfbares Seefahrtprofil", "Проверяемый морской профиль, автоматически созданный из PDF-документов", "ملف بحري قابل للتحقق تم إنشاؤه تلقائيًا من مستندات PDF"],
    maritimeLabel: ["ALLONAHUB DENİZCİLİK", "ALLONAHUB DƏNİZÇİLİK", "ALLONAHUB ТЕҢІЗ ІСІ", "ALLONAHUB DENGIZCHILIK", "ALLONAHUB ДЕҢИЗЧИЛИК", "ALLONAHUB MARITIME", "ALLONAHUB SEEVERKEHR", "ALLONAHUB МОРСКОЙ ПРОФИЛЬ", "ALLONAHUB للقطاع البحري"],
    sourceDocuments: ["Kaynak belge", "Mənbə sənəd", "Дереккөз құжат", "Manba hujjat", "Булак документ", "Source documents", "Quelldokumente", "Исходные документы", "المستندات المصدرية"],
    extractedRecords: ["Okunan kayıt", "Oxunan qeyd", "Оқылған жазба", "O‘qilgan yozuv", "Окулган жазуу", "Extracted records", "Ausgelesene Datensätze", "Извлеченные записи", "السجلات المستخرجة"],
    skills: ["Beceriler", "Bacarıqlar", "Дағдылар", "Ko‘nikmalar", "Көндүмдөр", "Skills", "Fähigkeiten", "Навыки", "المهارات"],
    achievements: ["Başarılar", "Nailiyyətlər", "Жетістіктер", "Yutuqlar", "Жетишкендиктер", "Achievements", "Erfolge", "Достижения", "الإنجازات"],
    experienceOverview: ["Deniz hizmeti özeti", "Dəniz xidməti xülasəsi", "Теңіз қызметінің қорытындысы", "Dengiz xizmati xulosasi", "Деңиз кызматынын жыйынтыгы", "Sea-service overview", "Überblick Seefahrtzeit", "Обзор морского стажа", "ملخص الخدمة البحرية"],
    serviceHistory: ["Deniz hizmeti geçmişi", "Dəniz xidməti tarixçəsi", "Теңіз қызметінің тарихы", "Dengiz xizmati tarixi", "Деңиз кызматынын тарыхы", "Sea-service history", "Seefahrtzeiten", "История морской службы", "سجل الخدمة البحرية"],
    qualification: ["Yeterlilik", "Səriştə", "Біліктілік", "Malaka", "Квалификация", "Qualification", "Qualifikation", "Квалификация", "المؤهل"],
    fieldOfStudy: ["Bölüm", "İxtisas", "Мамандығы", "Yo‘nalish", "Адистик", "Field of study", "Fachrichtung", "Специальность", "التخصص"],
    medicalResult: ["Sonuç", "Nəticə", "Нәтиже", "Natija", "Натыйжа", "Result", "Ergebnis", "Результат", "النتيجة"],
    dose: ["Doz", "Doza", "Доза", "Doza", "Доза", "Dose", "Dosis", "Доза", "الجرعة"],
    company: ["Şirket", "Şirkət", "Компания", "Kompaniya", "Компания", "Company", "Unternehmen", "Компания", "الشركة"],
    flag: ["Bayrak", "Bayraq", "Ту", "Bayroq", "Желек", "Flag", "Flagge", "Флаг", "العلم"],
    vesselType: ["Gemi tipi", "Gəmi növü", "Кеме түрі", "Kema turi", "Кеме түрү", "Vessel type", "Schiffstyp", "Тип судна", "نوع السفينة"],
    vessel: ["Gemi", "Gəmi", "Кеме", "Kema", "Кеме", "Vessel", "Schiff", "Судно", "السفينة"],
    period: ["Hizmet dönemi", "Xidmət dövrü", "Қызмет мерзімі", "Xizmat davri", "Кызмат мөөнөтү", "Service period", "Dienstzeit", "Период службы", "فترة الخدمة"],
    verifiedDays: ["Doğrulanmış gün", "Təsdiqlənmiş gün", "Расталған күн", "Tasdiqlangan kun", "Ырасталган күн", "Verified days", "Bestätigte Tage", "Подтвержденные дни", "الأيام الموثقة"],
    grt: ["GRT", "GRT", "GRT", "GRT", "GRT", "GRT", "BRZ", "GRT", "GRT"],
    dwt: ["DWT", "DWT", "DWT", "DWT", "DWT", "DWT", "DWT", "DWT", "DWT"],
    engine: ["Ana makine", "Baş mühərrik", "Негізгі қозғалтқыш", "Asosiy dvigatel", "Негизги кыймылдаткыч", "Main engine", "Hauptmaschine", "Главный двигатель", "المحرك الرئيسي"],
    certificateSerial: ["Sertifika seri no", "Sertifikat seriya no", "Сертификат сериясы №", "Sertifikat seriya raqami", "Сертификаттын сериясы №", "Certificate serial", "Zertifikatsseriennummer", "Серийный номер сертификата", "الرقم التسلسلي للشهادة"],
    endorsementNumber: ["Endorsement no", "Təsdiq nömrəsi", "Растау нөмірі", "Tasdiq raqami", "Ырастоо номери", "Endorsement no.", "Endorsement-Nr.", "Номер подтверждения", "رقم التصديق"],
    approvalAuthority: ["Onay makamı", "Təsdiq orqanı", "Бекіткен орган", "Tasdiqlovchi organ", "Ырастоочу орган", "Approval authority", "Genehmigungsbehörde", "Орган утверждения", "جهة الاعتماد"],
    approvalReference: ["Onay / karar referansı", "Təsdiq / qərar istinadı", "Бекіту / шешім сілтемесі", "Tasdiq / qaror havolasi", "Ырастоо / чечим шилтемеси", "Approval / resolution reference", "Genehmigungs- / Beschlussreferenz", "Ссылка на утверждение / решение", "مرجع الاعتماد / القرار"],
    coursePeriod: ["Eğitim dönemi", "Təlim dövrü", "Оқу кезеңі", "Taʼlim davri", "Окуу мөөнөтү", "Training period", "Ausbildungszeitraum", "Период обучения", "فترة التدريب"],
    noDocuments: ["Henüz belge yüklenmedi", "Hələ sənəd yüklənməyib", "Құжат әлі жүктелмеді", "Hali hujjat yuklanmagan", "Азырынча документ жүктөлгөн жок", "No documents yet", "Noch keine Dokumente", "Документы еще не загружены", "لا توجد مستندات بعد"],
    noDocumentsLead: ["İlk belge paketiniz analiz edildiğinde sonuçlar burada görünecek.", "İlk sənəd paketi təhlil ediləndə nəticələr burada görünəcək.", "Алғашқы құжат пакеті талданғанда нәтижелер осында көрінеді.", "Birinchi hujjat paketi tahlil qilinganda natijalar shu yerda ko‘rinadi.", "Биринчи документ топтому талданганда жыйынтыктар ушул жерде көрүнөт.", "Results will appear here after your first batch is analyzed.", "Ergebnisse erscheinen hier nach der ersten Analyse.", "Результаты появятся здесь после первого анализа.", "ستظهر النتائج هنا بعد تحليل الحزمة الأولى."],
    statusUploading: ["Belgeler güvenli alana yükleniyor", "Sənədlər təhlükəsiz sahəyə yüklənir", "Құжаттар қауіпсіз орынға жүктелуде", "Hujjatlar xavfsiz joyga yuklanmoqda", "Документтер коопсуз аймакка жүктөлүүдө", "Uploading documents securely", "Dokumente werden sicher hochgeladen", "Документы безопасно загружаются", "جارٍ رفع المستندات بأمان"],
    statusAnalyzing: ["Belge okunuyor ve bilgiler ayrıştırılıyor", "Sənəd oxunur və məlumat ayrılır", "Құжат оқылып, деректер бөлінуде", "Hujjat o‘qilib, maʼlumotlar ajratilmoqda", "Документ окулуп, маалымат бөлүнүүдө", "Reading and extracting document details", "Dokument wird gelesen und ausgewertet", "Документ читается и анализируется", "جارٍ قراءة المستند واستخراج البيانات"],
    statusComplete: ["Global Pasaport taslağınız hazır. Bilgileri kontrol edip onaylayın.", "Global Pasport layihəniz hazırdır. Məlumatları yoxlayıb təsdiqləyin.", "Global Passport жобасы дайын. Деректерді тексеріп растаңыз.", "Global Passport loyihasi tayyor. Maʼlumotlarni tekshirib tasdiqlang.", "Global Passport долбоору даяр. Маалыматты текшерип ырастагыла.", "Your Global Passport draft is ready. Review and confirm the details.", "Ihr Global-Passport-Entwurf ist bereit. Prüfen und bestätigen Sie die Angaben.", "Черновик Global Passport готов. Проверьте и подтвердите данные.", "مسودة جواز السفر العالمي جاهزة. راجع البيانات ثم أكدها."],
    selectDocuments: ["En az bir belge seçin.", "Ən az bir sənəd seçin.", "Кемінде бір құжат таңдаңыз.", "Kamida bitta hujjat tanlang.", "Кеминде бир документ тандаңыз.", "Choose at least one document.", "Wählen Sie mindestens ein Dokument.", "Выберите хотя бы один документ.", "اختر مستندًا واحدًا على الأقل."],
    consentRequired: ["Analiz iznini onaylamanız gerekiyor.", "Təhlil icazəsini təsdiqləməlisiniz.", "Талдауға келісім беру қажет.", "Tahlil roziligini tasdiqlashingiz kerak.", "Талдоо макулдугун ырасташыңыз керек.", "You must approve the analysis consent.", "Sie müssen der Analyse zustimmen.", "Необходимо согласие на анализ.", "يجب الموافقة على معالجة التحليل."],
    invalidType: ["Yalnız PDF dosyası yükleyebilirsiniz.", "Yalnız PDF faylı yükləyə bilərsiniz.", "Тек PDF файлын жүктеуге болады.", "Faqat PDF fayl yuklash mumkin.", "PDF файл гана жүктөөгө болот.", "Only PDF files are allowed.", "Nur PDF-Dateien sind erlaubt.", "Разрешены только PDF-файлы.", "يُسمح بملفات PDF فقط."],
    tooManyFiles: ["Bir seferde en fazla 20 belge yükleyebilirsiniz.", "Bir dəfədə ən çox 20 sənəd yükləyə bilərsiniz.", "Бір ретте 20 құжатқа дейін жүктеуге болады.", "Bir martada 20 tagacha hujjat yuklash mumkin.", "Бир жолу 20 документке чейин жүктөөгө болот.", "You can upload up to 20 documents at once.", "Sie können bis zu 20 Dokumente gleichzeitig hochladen.", "Можно загрузить до 20 документов за раз.", "يمكن رفع 20 مستندًا كحد أقصى في المرة الواحدة."],
    fileTooLarge: ["Dosyalardan biri 45 MB sınırını aşıyor.", "Fayllardan biri 45 MB həddini keçir.", "Файлдардың бірі 45 МБ шегінен асады.", "Fayllardan biri 45 MB limitdan oshadi.", "Файлдардын бири 45 МБ чектен ашат.", "One file exceeds the 45 MB limit.", "Eine Datei überschreitet 45 MB.", "Один из файлов превышает 45 МБ.", "أحد الملفات يتجاوز 45 ميجابايت."],
    batchTooLarge: ["Toplam belge boyutu 150 MB sınırını aşıyor.", "Ümumi sənəd ölçüsü 150 MB həddini keçir.", "Жалпы көлем 150 МБ шегінен асады.", "Jami hajm 150 MB limitdan oshadi.", "Жалпы көлөм 150 МБ чектен ашат.", "The batch exceeds the 150 MB limit.", "Das Paket überschreitet 150 MB.", "Общий размер превышает 150 МБ.", "يتجاوز الحجم الإجمالي 150 ميجابايت."],
    uploadFailed: ["Bazı belgeler tamamlanamadı. Dosyalarınız korunuyor; yeniden deneyebilirsiniz.", "Bəzi sənədlər tamamlanmadı. Fayllar qorunur; yenidən cəhd edin.", "Кейбір құжаттар аяқталмады. Файлдар сақталды; қайта байқап көріңіз.", "Baʼzi hujjatlar tugallanmadi. Fayllar saqlangan; qayta urinib ko‘ring.", "Айрым документтер бүтпөдү. Файлдар сакталды; кайра аракет кылыңыз.", "Some documents could not be completed. Your files are preserved; try again.", "Einige Dokumente konnten nicht abgeschlossen werden. Die Dateien bleiben erhalten.", "Некоторые документы не обработаны. Файлы сохранены; повторите попытку.", "تعذر إكمال بعض المستندات. تم حفظ الملفات ويمكن إعادة المحاولة."],
    loadFailed: ["Belge merkezi şu anda yüklenemedi.", "Sənəd mərkəzi hazırda yüklənmədi.", "Құжат орталығы қазір жүктелмеді.", "Hujjat markazi hozir yuklanmadi.", "Документ борбору азыр жүктөлгөн жок.", "The document center could not load.", "Das Dokumentencenter konnte nicht geladen werden.", "Не удалось загрузить центр документов.", "تعذر تحميل مركز المستندات."],
    pendingUpload: ["Yükleme bekliyor", "Yükləmə gözləyir", "Жүктеу күтілуде", "Yuklash kutilmoqda", "Жүктөө күтүлүүдө", "Waiting for upload", "Upload ausstehend", "Ожидает загрузки", "بانتظار الرفع"],
    analyzing: ["Analiz ediliyor", "Təhlil edilir", "Талдануда", "Tahlil qilinmoqda", "Талданууда", "Analyzing", "Wird analysiert", "Анализируется", "قيد التحليل"],
    reviewRequired: ["Kontrolünüz bekleniyor", "Yoxlamanız gözlənilir", "Тексеруіңіз күтілуде", "Tekshiruvingiz kutilmoqda", "Текшерүүңүз күтүлүүдө", "Your review is required", "Ihre Prüfung ist erforderlich", "Требуется ваша проверка", "بانتظار مراجعتك"],
    confirmed: ["Onaylandı", "Təsdiqləndi", "Расталды", "Tasdiqlandi", "Ырасталды", "Confirmed", "Bestätigt", "Подтверждено", "تم التأكيد"],
    rejected: ["Reddedildi", "Rədd edildi", "Қабылданбады", "Rad etildi", "Четке кагылды", "Rejected", "Abgelehnt", "Отклонено", "مرفوض"],
    analysisFailed: ["Analiz tekrar bekliyor", "Təhlil yenidən gözləyir", "Талдауды қайталау қажет", "Tahlilni qayta boshlash kerak", "Талдоону кайталоо керек", "Analysis needs retry", "Analyse erneut versuchen", "Требуется повторный анализ", "يلزم إعادة التحليل"],
    documentLabel: ["Belge", "Sənəd", "Құжат", "Hujjat", "Документ", "Document", "Dokument", "Документ", "مستند"],
    confidence: ["Okuma güveni", "Oxuma etibarı", "Оқу сенімділігі", "O‘qish ishonchi", "Окуу ишеними", "Reading confidence", "Lesesicherheit", "Точность чтения", "ثقة القراءة"],
    openDocument: ["Belgeyi Aç", "Sənədi aç", "Құжатты ашу", "Hujjatni ochish", "Документти ачуу", "Open Document", "Dokument öffnen", "Открыть документ", "فتح المستند"],
    retryAnalysis: ["Analizi Tekrarla", "Təhlili təkrarla", "Талдауды қайталау", "Tahlilni takrorlash", "Талдоону кайталоо", "Retry Analysis", "Analyse wiederholen", "Повторить анализ", "إعادة التحليل"],
    verifyDetails: ["Okunan bilgileri kontrol edin", "Oxunan məlumatları yoxlayın", "Алынған деректерді тексеріңіз", "O‘qilgan maʼlumotlarni tekshiring", "Окулган маалыматты текшериңиз", "Review the extracted details", "Ausgelesene Daten prüfen", "Проверьте извлеченные данные", "راجع البيانات المستخرجة"],
    documentType: ["Belge türü", "Sənəd növü", "Құжат түрі", "Hujjat turi", "Документтин түрү", "Document type", "Dokumenttyp", "Тип документа", "نوع المستند"],
    documentTitle: ["Belge başlığı", "Sənəd başlığı", "Құжат атауы", "Hujjat nomi", "Документтин аталышы", "Document title", "Dokumenttitel", "Название документа", "عنوان المستند"],
    holderName: ["Ad soyad", "Ad soyad", "Аты-жөні", "Ism familiya", "Аты-жөнү", "Full name", "Vollständiger Name", "Имя и фамилия", "الاسم الكامل"],
    documentNumber: ["Belge numarası", "Sənəd nömrəsi", "Құжат нөмірі", "Hujjat raqami", "Документтин номери", "Document number", "Dokumentnummer", "Номер документа", "رقم المستند"],
    issuingAuthority: ["Düzenleyen kurum", "Verən qurum", "Берген мекеме", "Bergan tashkilot", "Берген мекеме", "Issuing authority", "Ausstellende Stelle", "Орган выдачи", "الجهة المصدرة"],
    nationality: ["Uyruk", "Vətəndaşlıq", "Азаматтығы", "Fuqarolik", "Жарандыгы", "Nationality", "Staatsangehörigkeit", "Гражданство", "الجنسية"],
    dateOfBirth: ["Doğum tarihi", "Doğum tarixi", "Туған күні", "Tug‘ilgan sana", "Туулган күнү", "Date of birth", "Geburtsdatum", "Дата рождения", "تاريخ الميلاد"],
    issueDate: ["Başlangıç / düzenleme tarihi", "Başlanğıc / verilmə tarixi", "Басталу / берілген күні", "Boshlanish / berilgan sana", "Башталыш / берилген күнү", "Issue / start date", "Ausstellungs-/Startdatum", "Дата выдачи / начала", "تاريخ الإصدار / البدء"],
    expiryDate: ["Bitiş / geçerlilik tarihi", "Bitmə / etibarlılıq tarixi", "Аяқталу / жарамдылық күні", "Tugash / amal qilish sanasi", "Аяктоо / жарактуулук күнү", "End / expiry date", "End-/Ablaufdatum", "Дата окончания / действия", "تاريخ الانتهاء / الصلاحية"],
    rank: ["Rütbe / yeterlilik", "Rütbə / səriştə", "Атақ / біліктілік", "Unvon / malaka", "Наам / квалификация", "Rank / competency", "Rang / Befähigung", "Звание / квалификация", "الرتبة / الكفاءة"],
    suitablePositions: ["Uygun pozisyonlar", "Uyğun vəzifələr", "Лайықты лауазымдар", "Mos lavozimlar", "Ылайыктуу кызматтар", "Suitable positions", "Passende Positionen", "Подходящие должности", "الوظائف المناسبة"],
    certificateCodes: ["Sertifika kodları", "Sertifikat kodları", "Сертификат кодтары", "Sertifikat kodlari", "Сертификат коддору", "Certificate codes", "Zertifikatscodes", "Коды сертификатов", "رموز الشهادات"],
    autoCredentialsTitle: ["Belgelerden otomatik okunan yeterlilikler", "Sənədlərdən avtomatik oxunan səriştələr", "Құжаттардан автоматты оқылған біліктіліктер", "Hujjatlardan avtomatik o‘qilgan malakalar", "Документтерден автоматтык окулган квалификациялар", "Credentials read automatically from documents", "Automatisch aus Dokumenten gelesene Befähigungen", "Квалификации, автоматически считанные из документов", "المؤهلات المقروءة تلقائيًا من المستندات"],
    autoCredentialsLead: ["Kod, belge numarası, başlık ve geçerlilik tarihleri CV'nize elle yazmadan aktarılır.", "Kod, sənəd nömrəsi, başlıq və etibarlılıq tarixləri əl ilə yazılmadan CV-yə köçürülür.", "Код, құжат нөмірі, атауы мен жарамдылық мерзімі CV-ге қолмен енгізусіз көшіріледі.", "Kod, hujjat raqami, nomi va amal qilish sanalari CV ga qo‘lda kiritmasdan o‘tkaziladi.", "Код, документтин номери, аталышы жана жарактуулук мөөнөтү CVге кол менен жазылбастан өткөрүлөт.", "Code, document number, title, and validity dates are added to your CV without manual entry.", "Code, Dokumentnummer, Titel und Gültigkeitsdaten werden ohne manuelle Eingabe in den CV übernommen.", "Код, номер, название и срок действия переносятся в CV без ручного ввода.", "تُضاف الرموز وأرقام المستندات والعناوين وتواريخ الصلاحية إلى سيرتك دون إدخال يدوي."],
    certificateCode: ["Kod", "Kod", "Код", "Kod", "Код", "Code", "Code", "Код", "الرمز"],
    certificateTitle: ["Yeterlilik / belge", "Səriştə / sənəd", "Біліктілік / құжат", "Malaka / hujjat", "Квалификация / документ", "Credential / document", "Befähigung / Dokument", "Квалификация / документ", "المؤهل / المستند"],
    certificateCapacity: ["Rütbe / kapasite", "Rütbə / səlahiyyət", "Атақ / өкілеттік", "Unvon / vakolat", "Наам / ыйгарым укук", "Rank / capacity", "Rang / Funktion", "Звание / должность", "الرتبة / الصفة"],
    noAutoCredentials: ["Bu belgede ayrı bir yeterlilik kaydı okunmadı.", "Bu sənəddə ayrıca səriştə qeydi oxunmadı.", "Бұл құжаттан жеке біліктілік жазбасы оқылмады.", "Bu hujjatda alohida malaka qaydi o‘qilmadi.", "Бул документтен өзүнчө квалификация жазуусу окулган жок.", "No separate credential record was detected in this document.", "In diesem Dokument wurde kein eigener Befähigungsdatensatz erkannt.", "В этом документе отдельная запись о квалификации не найдена.", "لم يُكتشف سجل مؤهل مستقل في هذا المستند."],
    endorsements: ["Onaylar / ek yeterlilikler", "Təsdiqlər / əlavə səriştələr", "Растаулар / қосымша біліктіліктер", "Tasdiqlar / qo‘shimcha malakalar", "Ырастоолор / кошумча квалификациялар", "Endorsements / additional competencies", "Vermerke / Zusatzbefähigungen", "Подтверждения / дополнительные допуски", "التصديقات / الكفاءات الإضافية"],
    restrictions: ["Kısıtlamalar", "Məhdudiyyətlər", "Шектеулер", "Cheklovlar", "Чектөөлөр", "Restrictions", "Einschränkungen", "Ограничения", "القيود"],
    medicalFitness: ["Sağlık uygunluğu", "Sağlamlıq uyğunluğu", "Медициналық жарамдылық", "Tibbiy yaroqlilik", "Медициналык жарактуулук", "Medical fitness", "Medizinische Tauglichkeit", "Медицинская годность", "اللياقة الطبية"],
    seaService: ["Deniz hizmeti kayıtları", "Dəniz xidməti qeydləri", "Теңіз қызметі жазбалары", "Dengiz xizmati qaydlari", "Деңиз кызматы жазуулары", "Sea-service records", "Seefahrtzeiten", "Записи морского стажа", "سجلات الخدمة البحرية"],
    seaServiceHint: ["Her satır: Gemi | IMO | Gemi tipi | Görev | Başlangıç | Bitiş | Gün", "Hər sətir: Gəmi | IMO | Gəmi növü | Vəzifə | Başlanğıc | Bitiş | Gün", "Әр жол: Кеме | IMO | Түрі | Міндет | Басталу | Аяқталу | Күн", "Har satr: Kema | IMO | Turi | Vazifa | Boshlanish | Tugash | Kun", "Ар сап: Кеме | IMO | Түрү | Милдет | Башталыш | Аяктоо | Күн", "One line each: Vessel | IMO | Type | Rank | Start | End | Days", "Je Zeile: Schiff | IMO | Typ | Rang | Beginn | Ende | Tage", "Каждая строка: Судно | IMO | Тип | Должность | Начало | Конец | Дни", "كل سطر: السفينة | IMO | النوع | الوظيفة | البدء | الانتهاء | الأيام"],
    languages: ["Diller", "Dillər", "Тілдер", "Tillar", "Тилдер", "Languages", "Sprachen", "Языки", "اللغات"],
    languageHint: ["Her satır: Dil | Seviye", "Hər sətir: Dil | Səviyyə", "Әр жол: Тіл | Деңгей", "Har satr: Til | Daraja", "Ар сап: Тил | Деңгээл", "One line each: Language | Level", "Je Zeile: Sprache | Niveau", "Каждая строка: Язык | Уровень", "كل سطر: اللغة | المستوى"],
    notes: ["Ek notlar", "Əlavə qeydlər", "Қосымша ескертулер", "Qo‘shimcha izohlar", "Кошумча эскертүүлөр", "Additional notes", "Zusätzliche Hinweise", "Дополнительные примечания", "ملاحظات إضافية"],
    warnings: ["Kontrol notları", "Yoxlama qeydləri", "Тексеру ескертулері", "Tekshiruv eslatmalari", "Текшерүү эскертмелери", "Review notes", "Prüfhinweise", "Примечания к проверке", "ملاحظات المراجعة"],
    confirmDetails: ["Bilgiler Doğru, Onayla", "Məlumat doğrudur, təsdiqlə", "Деректер дұрыс, растау", "Maʼlumot to‘g‘ri, tasdiqlash", "Маалымат туура, ырастоо", "Details Are Correct, Confirm", "Angaben korrekt, bestätigen", "Данные верны, подтвердить", "البيانات صحيحة، تأكيد"],
    rejectDetails: ["Okuma Hatalı", "Oxuma yanlışdır", "Оқу қате", "O‘qish xato", "Окуу туура эмес", "Extraction Is Wrong", "Auslesung ist falsch", "Распознано неверно", "الاستخراج غير صحيح"],
    saving: ["Onay kaydediliyor", "Təsdiq saxlanılır", "Растау сақталуда", "Tasdiq saqlanmoqda", "Ырастоо сакталууда", "Saving confirmation", "Bestätigung wird gespeichert", "Сохранение подтверждения", "جارٍ حفظ التأكيد"],
    saved: ["Bilgiler CV profilinize kaydedildi.", "Məlumat CV profilinizə yazıldı.", "Деректер CV профиліңізге сақталды.", "Maʼlumot CV profilingizga saqlandi.", "Маалымат CV профилиңизге сакталды.", "Details were saved to your CV profile.", "Angaben wurden im CV-Profil gespeichert.", "Данные сохранены в профиле CV.", "تم حفظ البيانات في ملف السيرة."],
    removed: ["Analiz reddedildi; bilgiler CV'ye aktarılmadı.", "Təhlil rədd edildi; məlumat CV-yə ötürülmədi.", "Талдау қабылданбады; дерек CV-ге жазылмады.", "Tahlil rad etildi; maʼlumot CV ga yozilmadi.", "Талдоо четке кагылды; маалымат CVге жазылган жок.", "The extraction was rejected and not added to your CV.", "Die Auslesung wurde abgelehnt und nicht im CV gespeichert.", "Результат отклонен и не добавлен в CV.", "تم رفض الاستخراج ولم يُضف إلى السيرة."],
    fit: ["Uygun", "Uyğundur", "Жарамды", "Yaroqli", "Жарактуу", "Fit", "Tauglich", "Годен", "لائق"],
    fitWithRestrictions: ["Kısıtlamalı uygun", "Məhdudiyyətlə uyğundur", "Шектеумен жарамды", "Cheklov bilan yaroqli", "Чектөө менен жарактуу", "Fit with restrictions", "Mit Einschränkungen tauglich", "Годен с ограничениями", "لائق مع قيود"],
    unfit: ["Uygun değil", "Uyğun deyil", "Жарамсыз", "Yaroqsiz", "Жараксыз", "Unfit", "Nicht tauglich", "Не годен", "غير لائق"],
    notStated: ["Belgede belirtilmemiş", "Sənəddə göstərilməyib", "Құжатта көрсетілмеген", "Hujjatda ko‘rsatilmagan", "Документте көрсөтүлгөн эмес", "Not stated", "Nicht angegeben", "Не указано", "غير مذكور"]
  };

  Object.assign(copyRows, {
    readerVersion: ["Belge okuyucu sürümü", "Sənəd oxuyucu versiyası", "Құжат оқу нұсқасы", "Hujjat o‘quvchi versiyasi", "Документ окугуч версиясы", "Document reader version", "Dokumentenleser-Version", "Версия распознавания", "إصدار قارئ المستندات"],
    sourceEvidence: ["kaynak kanıt", "mənbə sübutu", "дерек дәлелі", "manba dalili", "булак далили", "source evidence", "Quellnachweise", "подтверждений источника", "دليل مصدر"],
    classifiedTemplate: ["Belge ailesi", "Sənəd ailəsi", "Құжат тобы", "Hujjat oilasi", "Документ тобу", "Document family", "Dokumentenfamilie", "Тип шаблона", "عائلة المستند"],
    uploadLead: ["Tek seferde en fazla 20 PDF dosyası seçebilirsiniz.", "Bir dəfədə 20-yə qədər PDF faylı seçə bilərsiniz.", "Бір ретте 20 PDF файлына дейін таңдауға болады.", "Bir martada 20 tagacha PDF fayl tanlang.", "Бир жолу 20 PDF файлга чейин тандаңыз.", "Choose up to 20 PDF files at once.", "Wählen Sie bis zu 20 PDF-Dateien gleichzeitig.", "Выберите до 20 PDF-файлов за один раз.", "اختر ما يصل إلى 20 ملف PDF في المرة الواحدة."],
    fileLimits: ["Her dosya en fazla 45 MB, toplam paket en fazla 150 MB.", "Hər fayl ən çox 45 MB, ümumi paket ən çox 150 MB.", "Әр файл 45 МБ, жалпы пакет 150 МБ-тан аспауы керек.", "Har bir fayl 45 MB, jami paket 150 MB dan oshmasin.", "Ар бир файл 45 МБ, жалпы топтом 150 МБдан ашпасын.", "45 MB per file, 150 MB per batch.", "45 MB pro Datei, 150 MB pro Paket.", "До 45 МБ на файл и 150 МБ на пакет.", "45 ميجابايت لكل ملف و150 ميجابايت للحزمة."],
    tooManyFiles: ["Bir seferde en fazla 20 belge yükleyebilirsiniz.", "Bir dəfədə ən çox 20 sənəd yükləyə bilərsiniz.", "Бір ретте 20 құжатқа дейін жүктеуге болады.", "Bir martada 20 tagacha hujjat yuklash mumkin.", "Бир жолу 20 документке чейин жүктөөгө болот.", "You can upload up to 20 documents at once.", "Sie können bis zu 20 Dokumente gleichzeitig hochladen.", "Можно загрузить до 20 документов за раз.", "يمكن رفع 20 مستندًا كحد أقصى في المرة الواحدة."],
    fileTooLarge: ["Dosyalardan biri 45 MB sınırını aşıyor.", "Fayllardan biri 45 MB həddini keçir.", "Файлдардың бірі 45 МБ шегінен асады.", "Fayllardan biri 45 MB limitdan oshadi.", "Файлдардын бири 45 МБ чектен ашат.", "One file exceeds the 45 MB limit.", "Eine Datei überschreitet 45 MB.", "Один из файлов превышает 45 МБ.", "أحد الملفات يتجاوز 45 ميجابايت."],
    batchTooLarge: ["Toplam belge boyutu 150 MB sınırını aşıyor.", "Ümumi sənəd ölçüsü 150 MB həddini keçir.", "Жалпы көлем 150 МБ шегінен асады.", "Jami hajm 150 MB limitdan oshadi.", "Жалпы көлөм 150 МБ чектен ашат.", "The batch exceeds the 150 MB limit.", "Das Paket überschreitet 150 MB.", "Общий размер превышает 150 МБ.", "يتجاوز الحجم الإجمالي 150 ميجابايت."],
    profilePhotoKicker: ["CV Fotoğrafı", "CV fotosu", "CV фотосы", "CV fotosurati", "CV сүрөтү", "CV Photo", "CV-Foto", "Фото для CV", "صورة السيرة"],
    profilePhotoTitle: ["Fotoğrafınızı CV standardına hazırlayın", "Fotonuzu CV standartına hazırlayın", "Фотоны CV стандартына дайындаңыз", "Suratingizni CV standartiga tayyorlang", "Сүрөтүңүздү CV стандартына даярдаңыз", "Prepare your photo for your CV", "Foto für den Lebenslauf vorbereiten", "Подготовьте фото для CV", "جهّز صورتك للسيرة"],
    profilePhotoLead: ["Fotoğraf cihazınızda işlenir; yüzünüz yeniden üretilmeden kişi arka plandan ayrılır ve arka plan beyaza çevrilir. Kaydetmeden önce sonucu siz kontrol edersiniz.", "Foto cihazınızda işlənir; üzünüz yenidən yaradılmadan şəxs fondan ayrılır və fon ağ edilir. Saxlamadan əvvəl nəticəni siz yoxlayırsınız.", "Фото құрылғыңызда өңделеді; бет қайта жасалмай, адам фоннан ажыратылып, фон ағартылады. Сақтар алдында нәтижені тексересіз.", "Surat qurilmangizda qayta ishlanadi; yuz qayta yaratilmaydi, shaxs fondan ajratilib fon oq qilinadi. Saqlashdan oldin tekshirasiz.", "Сүрөт түзмөгүңүздө иштетилет; жүз кайра түзүлбөй, адам фондон бөлүнүп, фон агартылат. Сактоодон мурда текшересиз.", "The photo is processed on your device. The person is separated from the background without regenerating the face, and the background is turned white. You review it before saving.", "Das Foto wird auf Ihrem Gerät verarbeitet. Die Person wird ohne Neugenerierung des Gesichts vom Hintergrund getrennt und der Hintergrund wird weiß. Vor dem Speichern prüfen Sie das Ergebnis.", "Фото обрабатывается на устройстве. Человек отделяется от фона без перерисовки лица, а фон становится белым. Перед сохранением вы проверяете результат.", "تُعالج الصورة على جهازك، ويُفصل الشخص عن الخلفية دون إعادة توليد الوجه ثم تصبح الخلفية بيضاء. تراجع النتيجة قبل الحفظ."],
    chooseProfilePhoto: ["Fotoğraf Seç / Değiştir", "Foto seç / dəyiş", "Фото таңдау / ауыстыру", "Surat tanlash / almashtirish", "Сүрөт тандоо / алмаштыруу", "Choose / Replace Photo", "Foto wählen / ersetzen", "Выбрать / заменить фото", "اختيار / استبدال الصورة"],
    saveProfilePhoto: ["Önizlemeyi Kaydet", "Ön baxışı saxla", "Алдын ала көріністі сақтау", "Ko‘rinishni saqlash", "Алдын ала көрүнүштү сактоо", "Save Preview", "Vorschau speichern", "Сохранить результат", "حفظ المعاينة"],
    deleteProfilePhoto: ["Fotoğrafı Sil", "Fotonu sil", "Фотоны жою", "Suratni o‘chirish", "Сүрөттү өчүрүү", "Delete Photo", "Foto löschen", "Удалить фото", "حذف الصورة"],
    profilePhotoHint: ["JPG, PNG veya WebP; en fazla 12 MB. Bu işlem resmi makamlarca onaylı biyometrik belge üretmez.", "JPG, PNG və ya WebP; ən çox 12 MB. Bu əməliyyat rəsmi təsdiqli biometrik sənəd yaratmır.", "JPG, PNG немесе WebP; 12 МБ-қа дейін. Бұл рәсім ресми биометриялық құжат жасамайды.", "JPG, PNG yoki WebP; 12 MB gacha. Bu jarayon rasmiy biometrik hujjat yaratmaydi.", "JPG, PNG же WebP; 12 МБга чейин. Бул расмий биометрикалык документ түзбөйт.", "JPG, PNG, or WebP; up to 12 MB. This does not create an officially certified biometric document.", "JPG, PNG oder WebP; bis 12 MB. Es entsteht kein amtlich zertifiziertes biometrisches Dokument.", "JPG, PNG или WebP; до 12 МБ. Это не является официальным биометрическим документом.", "JPG أو PNG أو WebP حتى 12 ميجابايت. لا تُنشئ هذه العملية مستندًا بيومتريًا معتمدًا رسميًا."],
    photoPreparing: ["Fotoğraf hazırlanıyor; yüz pikselleri yeniden üretilmiyor.", "Foto hazırlanır; üz pikselləri yenidən yaradılmır.", "Фото дайындалуда; бет пикселдері қайта жасалмайды.", "Surat tayyorlanmoqda; yuz piksellari qayta yaratilmaydi.", "Сүрөт даярдалууда; жүз пикселдери кайра түзүлбөйт.", "Preparing the photo without regenerating facial pixels.", "Foto wird vorbereitet; Gesichtspixel werden nicht neu erzeugt.", "Фото готовится без перерисовки пикселей лица.", "جارٍ تجهيز الصورة دون إعادة توليد بكسلات الوجه."],
    photoReview: ["Önizlemeyi kontrol edin. Doğruysa kaydedin.", "Ön baxışı yoxlayın. Doğrudursa saxlayın.", "Алдын ала көріністі тексеріп, дұрыс болса сақтаңыз.", "Ko‘rinishni tekshiring va to‘g‘ri bo‘lsa saqlang.", "Алдын ала көрүнүштү текшерип, туура болсо сактаңыз.", "Review the preview and save it only if it is correct.", "Vorschau prüfen und nur bei korrektem Ergebnis speichern.", "Проверьте результат и сохраните только если всё верно.", "راجع المعاينة واحفظها فقط إذا كانت صحيحة."],
    photoSaved: ["CV fotoğrafı güvenli alana kaydedildi.", "CV fotosu təhlükəsiz sahədə saxlanıldı.", "CV фотосы қауіпсіз жерде сақталды.", "CV surati xavfsiz joyga saqlandi.", "CV сүрөтү коопсуз аймакка сакталды.", "CV photo saved securely.", "CV-Foto sicher gespeichert.", "Фото для CV безопасно сохранено.", "حُفظت صورة السيرة بأمان."],
    photoDeleted: ["CV fotoğrafı silindi.", "CV fotosu silindi.", "CV фотосы жойылды.", "CV surati o‘chirildi.", "CV сүрөтү өчүрүлдү.", "CV photo deleted.", "CV-Foto gelöscht.", "Фото для CV удалено.", "حُذفت صورة السيرة."],
    photoNeedsReview: ["Arka plan tam ayrışmamış olabilir. Önizlemeyi dikkatle kontrol edin.", "Fon tam ayrılmamış ola bilər. Ön baxışı diqqətlə yoxlayın.", "Фон толық ажыратылмауы мүмкін. Нәтижені мұқият тексеріңіз.", "Fon to‘liq ajralmagan bo‘lishi mumkin. Natijani diqqat bilan tekshiring.", "Фон толук бөлүнбөшү мүмкүн. Натыйжаны кылдат текшериңиз.", "The background may not be fully separated. Review the preview carefully.", "Der Hintergrund ist möglicherweise nicht vollständig getrennt. Bitte genau prüfen.", "Фон мог отделиться не полностью. Внимательно проверьте результат.", "قد لا تكون الخلفية مفصولة بالكامل. راجع المعاينة بعناية."],
    photoFailed: ["Fotoğraf hazırlanamadı. Daha net ve aydınlık bir fotoğraf deneyin.", "Foto hazırlana bilmədi. Daha aydın foto sınayın.", "Фото дайындалмады. Анығырақ әрі жарық фото қолданыңыз.", "Surat tayyorlanmadi. Aniqroq va yorug‘ suratni sinang.", "Сүрөт даярдалган жок. Тагыраак жана жарык сүрөттү тандаңыз.", "The photo could not be prepared. Try a clearer, well-lit photo.", "Das Foto konnte nicht vorbereitet werden. Versuchen Sie ein klareres, gut beleuchtetes Foto.", "Не удалось подготовить фото. Попробуйте более четкий и светлый снимок.", "تعذر تجهيز الصورة. جرّب صورة أوضح وبإضاءة جيدة."],
    personalDetails: ["Kişisel ve iletişim bilgileri", "Şəxsi və əlaqə məlumatları", "Жеке және байланыс деректері", "Shaxsiy va aloqa maʼlumotlari", "Жеке жана байланыш маалыматы", "Personal and contact details", "Persönliche Daten und Kontakt", "Личные и контактные данные", "البيانات الشخصية وبيانات الاتصال"],
    contactDetails: ["İletişim bilgileri", "Əlaqə məlumatları", "Байланыс деректері", "Aloqa maʼlumotlari", "Байланыш маалыматы", "Contact details", "Kontaktdaten", "Контактные данные", "بيانات الاتصال"],
    familyName: ["Soyadı", "Soyadı", "Тегі", "Familiya", "Фамилиясы", "Family name", "Nachname", "Фамилия", "اسم العائلة"],
    givenNames: ["Adı / adları", "Adı / adları", "Аты-жөні", "Ismi / ismlari", "Аты / аттары", "Given name(s)", "Vorname(n)", "Имя / имена", "الاسم / الأسماء"],
    middleName: ["Baba / orta adı", "Ata / orta adı", "Әкесінің / орта аты", "Ota / o‘rta ism", "Атасынын / ортонку аты", "Middle name", "Zweiter Vorname", "Отчество / второе имя", "الاسم الأوسط"],
    placeOfBirth: ["Doğum yeri", "Doğum yeri", "Туған жері", "Tug‘ilgan joy", "Туулган жери", "Place of birth", "Geburtsort", "Место рождения", "مكان الميلاد"],
    gender: ["Cinsiyet", "Cins", "Жынысы", "Jinsi", "Жынысы", "Gender", "Geschlecht", "Пол", "الجنس"],
    maritalStatus: ["Medeni durum", "Ailə vəziyyəti", "Отбасылық жағдайы", "Oilaviy holat", "Үй-бүлөлүк абалы", "Marital status", "Familienstand", "Семейное положение", "الحالة الاجتماعية"],
    email: ["E-posta", "E-poçt", "Эл. пошта", "E-pochta", "Эл. почта", "Email", "E-Mail", "Эл. почта", "البريد الإلكتروني"],
    phone: ["Telefon", "Telefon", "Телефон", "Telefon", "Телефон", "Phone", "Telefon", "Телефон", "الهاتف"],
    secondaryPhone: ["İkinci telefon", "İkinci telefon", "Қосымша телефон", "Ikkinchi telefon", "Экинчи телефон", "Secondary phone", "Zweites Telefon", "Дополнительный телефон", "هاتف إضافي"],
    permanentAddress: ["İkamet adresi", "Yaşayış ünvanı", "Тұрақты мекенжай", "Doimiy manzil", "Туруктуу дарек", "Permanent address", "Wohnadresse", "Постоянный адрес", "العنوان الدائم"],
    nearestAirport: ["En yakın havalimanı", "Ən yaxın hava limanı", "Ең жақын әуежай", "Eng yaqin aeroport", "Эң жакын аэропорт", "Nearest airport", "Nächster Flughafen", "Ближайший аэропорт", "أقرب مطار"],
    physicalDetails: ["Fiziksel bilgiler", "Fiziki məlumatlar", "Дене деректері", "Jismoniy maʼlumotlar", "Физикалык маалымат", "Physical details", "Körperdaten", "Физические данные", "البيانات الجسدية"],
    heightCm: ["Boy (cm)", "Boy (sm)", "Бойы (см)", "Bo‘yi (sm)", "Бою (см)", "Height (cm)", "Größe (cm)", "Рост (см)", "الطول (سم)"],
    weightKg: ["Kilo (kg)", "Çəki (kq)", "Салмағы (кг)", "Vazn (kg)", "Салмак (кг)", "Weight (kg)", "Gewicht (kg)", "Вес (кг)", "الوزن (كجم)"],
    eyeColor: ["Göz rengi", "Göz rəngi", "Көз түсі", "Ko‘z rangi", "Көздүн түсү", "Eye colour", "Augenfarbe", "Цвет глаз", "لون العينين"],
    hairColor: ["Saç rengi", "Saç rəngi", "Шаш түсі", "Soch rangi", "Чачтын түсү", "Hair colour", "Haarfarbe", "Цвет волос", "لون الشعر"],
    shoeSize: ["Ayakkabı numarası", "Ayaqqabı ölçüsü", "Аяқ киім өлшемі", "Poyabzal o‘lchami", "Бут кийим өлчөмү", "Shoe size", "Schuhgröße", "Размер обуви", "مقاس الحذاء"],
    overallSize: ["Tulum bedeni", "Kombinezon ölçüsü", "Комбинезон өлшемі", "Kombinezon o‘lchami", "Комбинезон өлчөмү", "Overall size", "Overall-Größe", "Размер спецодежды", "مقاس البدلة"],
    detailedRecords: ["Belgeden okunan ayrıntılı kayıtlar", "Sənəddən oxunan ətraflı qeydlər", "Құжаттан алынған егжей-тегжейлі жазбалар", "Hujjatdan o‘qilgan batafsil yozuvlar", "Документтен окулган толук жазуулар", "Detailed records extracted from the document", "Detaillierte ausgelesene Datensätze", "Подробные записи из документа", "السجلات التفصيلية المستخرجة"],
    identityDocuments: ["Kimlik ve seyahat belgeleri", "Şəxsiyyət və səyahət sənədləri", "Жеке және жол жүру құжаттары", "Shaxsiy va safar hujjatlari", "Жеке жана саякат документтери", "Identity and travel documents", "Identitäts- und Reisedokumente", "Удостоверения и проездные документы", "وثائق الهوية والسفر"],
    education: ["Eğitim", "Təhsil", "Білім", "Taʼlim", "Билим", "Education", "Ausbildung", "Образование", "التعليم"],
    medicalRecords: ["Sağlık kayıtları", "Tibbi qeydlər", "Медициналық жазбалар", "Tibbiy yozuvlar", "Медициналык жазуулар", "Medical records", "Medizinische Nachweise", "Медицинские записи", "السجلات الطبية"],
    vaccinations: ["Aşı kayıtları", "Peyvənd qeydləri", "Вакцина жазбалары", "Emlash yozuvlari", "Эмдөө жазуулары", "Vaccination records", "Impfnachweise", "Записи о вакцинации", "سجلات التطعيم"],
    emergencyContacts: ["Acil durumda aranacak kişi (özel)", "Təcili əlaqə şəxsi (şəxsi)", "Төтенше байланыс (жеке)", "Favqulodda aloqa (maxfiy)", "Шашылыш байланыш (жеке)", "Emergency contact (private)", "Notfallkontakt (privat)", "Экстренный контакт (личный)", "جهة اتصال الطوارئ (خاصة)"],
    references: ["Referanslar", "Referanslar", "Ұсынымдар", "Tavsiyalar", "Сунуштар", "References", "Referenzen", "Рекомендации", "المراجع"],
    sourcePage: ["Kaynak sayfa", "Mənbə səhifəsi", "Дереккөз беті", "Manba sahifasi", "Булак барагы", "Source page", "Quellseite", "Страница-источник", "صفحة المصدر"],
    privateRecord: ["Bu bilgi şirket CV'sinde gösterilmez.", "Bu məlumat şirkət CV-sində göstərilmir.", "Бұл дерек компанияға арналған CV-де көрсетілмейді.", "Bu maʼlumot kompaniya CV sida ko‘rsatilmaydi.", "Бул маалымат компаниялык CVде көрсөтүлбөйт.", "This information is not shown on the employer CV.", "Diese Angabe erscheint nicht im Arbeitgeber-CV.", "Эта информация не показывается в CV для работодателя.", "لا تظهر هذه المعلومة في السيرة المقدمة للشركة."],
    validForever: ["Süresiz", "Müddətsiz", "Мерзімсіз", "Muddatsiz", "Мөөнөтсүз", "No expiry", "Unbefristet", "Бессрочно", "بلا انتهاء"],
    issuingCountry: ["Düzenleyen ülke", "Verən ölkə", "Берген ел", "Bergan davlat", "Берген өлкө", "Issuing country", "Ausstellungsland", "Страна выдачи", "بلد الإصدار"],
    placeOfIssue: ["Düzenleme yeri", "Verilmə yeri", "Берілген жер", "Berilgan joy", "Берилген жер", "Place of issue", "Ausstellungsort", "Место выдачи", "مكان الإصدار"],
    stcwReferences: ["STCW referansları", "STCW istinadları", "STCW сілтемелері", "STCW havolalari", "STCW шилтемелери", "STCW references", "STCW-Referenzen", "Ссылки STCW", "مراجع STCW"],
    professionalSummary: ["Mesleki özet", "Peşəkar xülasə", "Кәсіби қорытынды", "Kasbiy xulosa", "Кесиптик жыйынтык", "Professional summary", "Berufliches Profil", "Профессиональное резюме", "الملخص المهني"],
    desiredSalary: ["Talep edilen ücret", "İstənilən əmək haqqı", "Қалаған жалақы", "Kutilayotgan ish haqi", "Каалаган эмгек акы", "Desired salary", "Gehaltswunsch", "Желаемая зарплата", "الراتب المطلوب"],
    desiredSalaryCurrency: ["Ücret para birimi", "Əmək haqqı valyutası", "Жалақы валютасы", "Ish haqi valyutasi", "Эмгек акы валютасы", "Salary currency", "Gehaltswährung", "Валюта зарплаты", "عملة الراتب"],
    availability: ["Göreve başlama durumu", "İşə başlama vəziyyəti", "Жұмысқа шығу мүмкіндігі", "Ish boshlash holati", "Ишке чыгуу абалы", "Availability", "Verfügbarkeit", "Готовность к выходу", "الجاهزية للعمل"],
    seaServiceHint: ["Her satır: Gemi | Şirket | Bayrak | IMO | Gemi tipi | Görev | Başlangıç | Bitiş | Gün | GRT | DWT | Makine | kW", "Hər sətir: Gəmi | Şirkət | Bayraq | IMO | Gəmi növü | Vəzifə | Başlanğıc | Bitiş | Gün | GRT | DWT | Mühərrik | kW", "Әр жол: Кеме | Компания | Ту | IMO | Түрі | Міндет | Басталу | Аяқталу | Күн | GRT | DWT | Қозғалтқыш | kW", "Har satr: Kema | Kompaniya | Bayroq | IMO | Turi | Vazifa | Boshlanish | Tugash | Kun | GRT | DWT | Dvigatel | kW", "Ар сап: Кеме | Компания | Желек | IMO | Түрү | Милдет | Башталыш | Аяктоо | Күн | GRT | DWT | Кыймылдаткыч | kW", "One line each: Vessel | Company | Flag | IMO | Type | Rank | Start | End | Days | GRT | DWT | Engine | kW", "Je Zeile: Schiff | Unternehmen | Flagge | IMO | Typ | Rang | Beginn | Ende | Tage | BRZ | DWT | Motor | kW", "Каждая строка: Судно | Компания | Флаг | IMO | Тип | Должность | Начало | Конец | Дни | GRT | DWT | Двигатель | кВт", "كل سطر: السفينة | الشركة | العلم | IMO | النوع | الوظيفة | البدء | الانتهاء | الأيام | GRT | DWT | المحرك | kW"]
  });

  const documentTypeLabels = {
    seafarer_book: ["Gemiadamı cüzdanı", "Dənizçi kitabçası", "Теңізші кітапшасы", "Dengizchi daftarchasi", "Деңизчи китепчеси", "Seafarer's Book", "Seefahrtsbuch", "Мореходная книжка", "دفتر البحار"],
    passport: ["Pasaport", "Pasport", "Паспорт", "Pasport", "Паспорт", "Passport", "Reisepass", "Паспорт", "جواز السفر"],
    stcw_certificate: ["STCW sertifikası", "STCW sertifikatı", "STCW сертификаты", "STCW sertifikati", "STCW сертификаты", "STCW certificate", "STCW-Zertifikat", "Сертификат STCW", "شهادة STCW"],
    competency_certificate: ["Yeterlilik belgesi", "Səriştə sertifikatı", "Біліктілік куәлігі", "Malaka sertifikati", "Квалификация күбөлүгү", "Certificate of Competency", "Befähigungszeugnis", "Диплом о квалификации", "شهادة الكفاءة"],
    medical_certificate: ["Sağlık belgesi", "Tibbi arayış", "Медициналық анықтама", "Tibbiy sertifikat", "Медициналык күбөлүк", "Medical certificate", "Seediensttauglichkeitszeugnis", "Медицинская справка", "الشهادة الطبية"],
    sea_service_record: ["Deniz hizmeti kaydı", "Dəniz xidməti qeydi", "Теңіз қызметі жазбасы", "Dengiz xizmati qaydi", "Деңиз кызматынын жазуусу", "Sea-service record", "Seefahrtszeitennachweis", "Запись морского стажа", "سجل الخدمة البحرية"],
    training_certificate: ["Eğitim sertifikası", "Təlim sertifikatı", "Оқу сертификаты", "Ta'lim sertifikati", "Окуу сертификаты", "Training certificate", "Schulungszertifikat", "Сертификат обучения", "شهادة التدريب"],
    visa: ["Vize", "Viza", "Виза", "Viza", "Виза", "Visa", "Visum", "Виза", "تأشيرة"],
    cv: ["CV", "CV", "Түйіндеме", "CV", "CV", "CV", "Lebenslauf", "Резюме", "السيرة الذاتية"],
    other: ["Diğer", "Digər", "Басқа", "Boshqa", "Башка", "Other", "Sonstiges", "Другое", "أخرى"],
    unknown: ["Belirlenemedi", "Müəyyən edilmədi", "Анықталмады", "Aniqlanmadi", "Аныкталган жок", "Unknown", "Unbekannt", "Не определено", "غير محدد"]
  };

  function language() {
    const raw = String(localStorage.getItem("allona.language") || document.documentElement.lang || "tr").toLowerCase();
    return languageCodes.includes(raw) ? raw : "tr";
  }

  function text(key) {
    const row = copyRows[key];
    const index = languageCodes.indexOf(language());
    return row ? row[index] || row[0] : key;
  }

  function documentTypeLabel(type) {
    const row = documentTypeLabels[type] || documentTypeLabels.unknown;
    return row[languageCodes.indexOf(language())] || row[0];
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" }[character];
    });
  }

  function apiBase() {
    return String(App.config && App.config.apiBaseUrl || "https://api.allonahub.com").replace(/\/$/, "");
  }

  async function api(path, options) {
    const session = state.session || (App.auth && App.auth.getSession ? await App.auth.getSession() : null);
    if (!session?.access_token) throw new Error("AUTH_REQUIRED");
    const response = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.access_token}`,
        ...(options && options.body ? { "Content-Type": "application/json" } : {}),
        ...(options && options.headers || {})
      }
    });
    const payload = await response.json().catch(function () { return {}; });
    if (!response.ok || payload.ok !== true) {
      const error = new Error(payload.message || "REQUEST_FAILED");
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function formatBytes(value) {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function localizedValue(value, fallback) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return String(source[language()] || source.en || source.tr || fallback || "").trim();
  }

  function normalizedLocalizedText(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return Object.fromEntries(languageCodes.map(function (code) { return [code, String(source[code] || "").trim() || null]; }));
  }

  function normalizedLocalizedList(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return Object.fromEntries(languageCodes.map(function (code) {
      return [code, (Array.isArray(source[code]) ? source[code] : []).map(function (item) { return String(item || "").trim(); }).filter(Boolean).slice(0, 40)];
    }));
  }

  function dateLabel(value) {
    const raw = String(value || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const date = new Date(`${raw}T00:00:00.000Z`);
    return new Intl.DateTimeFormat(localeCodes[language()] || "tr-TR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
  }

  function fileId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `00000000-0000-4000-8000-${Math.random().toString(16).slice(2).padEnd(12, "0").slice(0, 12)}`;
  }

  function setStatus(message, tone) {
    const target = document.querySelector("[data-document-status]");
    if (!target) return;
    target.textContent = message || "";
    target.className = `maritime-notice${message ? " is-visible" : ""}${tone ? ` is-${tone}` : ""}`;
  }

  function setPhotoStatus(message, tone) {
    const target = document.querySelector("[data-profile-photo-status]");
    if (!target) return;
    target.textContent = message || "";
    target.className = `maritime-photo-status${message ? " is-visible" : ""}${tone ? ` is-${tone}` : ""}`;
  }

  function renderProfilePhoto() {
    const target = document.querySelector("[data-profile-photo-preview]");
    const save = document.querySelector("[data-profile-photo-save]");
    const remove = document.querySelector("[data-profile-photo-delete]");
    const url = state.pendingPhoto?.preview_url || state.remote?.profile_photo_url || "";
    if (target) target.innerHTML = url
      ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(text("profilePhotoKicker"))}">`
      : '<span><i class="fa-solid fa-user" aria-hidden="true"></i></span>';
    if (save) {
      save.hidden = !state.pendingPhoto;
      save.disabled = state.photoBusy;
    }
    if (remove) {
      remove.hidden = !state.pendingPhoto && !state.remote?.profile_photo_url;
      remove.disabled = state.photoBusy;
    }
  }

  async function prepareProfilePhoto(file) {
    if (!file || state.photoBusy) return;
    state.photoBusy = true;
    setPhotoStatus(text("photoPreparing"));
    renderProfilePhoto();
    try {
      if (!window.AllonaMaritimePhoto?.prepare) throw new Error("PHOTO_PROCESSOR_UNAVAILABLE");
      state.pendingPhoto = await window.AllonaMaritimePhoto.prepare(file);
      renderProfilePhoto();
      setPhotoStatus(state.pendingPhoto.needs_review ? text("photoNeedsReview") : text("photoReview"), state.pendingPhoto.needs_review ? "warning" : "success");
    } catch (error) {
      state.pendingPhoto = null;
      renderProfilePhoto();
      setPhotoStatus(text("photoFailed"), "error");
    } finally {
      state.photoBusy = false;
      renderProfilePhoto();
    }
  }

  async function saveProfilePhoto() {
    if (!state.pendingPhoto || state.photoBusy) return;
    state.photoBusy = true;
    renderProfilePhoto();
    setPhotoStatus(text("saving"));
    try {
      const prepared = state.pendingPhoto;
      const intent = await api("/v1/maritime/profile-photo/upload-intent", {
        method: "POST",
        body: JSON.stringify({ mime_type: "image/webp", size_bytes: prepared.blob.size })
      });
      const upload = intent.upload || {};
      const result = await App.supabase.storage.from(upload.bucket).uploadToSignedUrl(upload.path, upload.token, prepared.blob, { contentType: "image/webp", upsert: false });
      if (result.error) throw result.error;
      const confirmed = await api("/v1/maritime/profile-photo/confirm", {
        method: "POST",
        body: JSON.stringify({ confirmation: true, upload_id: upload.upload_id })
      });
      state.remote = { ...(state.remote || {}), profile_photo_url: confirmed.profile_photo_url || prepared.preview_url };
      state.pendingPhoto = null;
      renderProfilePhoto();
      setPhotoStatus(text("photoSaved"), "success");
    } catch (error) {
      setPhotoStatus(text("photoFailed"), "error");
    } finally {
      state.photoBusy = false;
      renderProfilePhoto();
    }
  }

  async function deleteProfilePhoto() {
    if (state.photoBusy) return;
    if (state.pendingPhoto) {
      state.pendingPhoto = null;
      renderProfilePhoto();
      setPhotoStatus("");
      return;
    }
    state.photoBusy = true;
    renderProfilePhoto();
    try {
      await api("/v1/maritime/profile-photo", { method: "DELETE" });
      state.remote = { ...(state.remote || {}), profile_photo_url: "" };
      setPhotoStatus(text("photoDeleted"), "success");
    } catch (error) {
      setPhotoStatus(text("photoFailed"), "error");
    } finally {
      state.photoBusy = false;
      renderProfilePhoto();
    }
  }

  function setProgress(show, label, detail, ratio) {
    const target = document.querySelector("[data-document-progress]");
    if (!target) return;
    target.hidden = !show;
    const bar = target.querySelector(":scope > span");
    const labelNode = target.querySelector("[data-document-progress-label]");
    const detailNode = target.querySelector("[data-document-progress-detail]");
    if (bar) bar.style.setProperty("--document-progress", `${Math.max(0, Math.min(100, Number(ratio) || 0))}%`);
    if (labelNode) labelNode.textContent = label || "";
    if (detailNode) detailNode.textContent = detail || "";
  }

  function validateFiles(files) {
    if (!files.length) throw new Error(text("selectDocuments"));
    if (files.length > maxFiles) throw new Error(text("tooManyFiles"));
    if (files.some(function (file) { return !allowedTypes.includes(file.type) || !/\.pdf$/i.test(file.name); })) throw new Error(text("invalidType"));
    if (files.some(function (file) { return file.size > maxFileBytes; })) throw new Error(text("fileTooLarge"));
    if (files.reduce(function (sum, file) { return sum + file.size; }, 0) > maxBatchBytes) throw new Error(text("batchTooLarge"));
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
    applyUpdateModeCopy();
  }

  function hasExistingGlobalPassport() {
    const profile = state.remote && state.remote.cv_profile;
    return Boolean(profile && profile.profile_payload && Object.keys(profile.profile_payload).length);
  }

  function isUpdateMode() {
    return new URLSearchParams(window.location.search).get("mode") === "update" || hasExistingGlobalPassport();
  }

  function applyUpdateModeCopy() {
    const updating = isUpdateMode();
    const note = document.querySelector("[data-passport-update-note]");
    const submitLabel = document.querySelector('[data-document-submit] [data-document-i18n]');
    const rule = document.querySelector(".maritime-document-upload-actions p[data-document-i18n]");
    if (note) note.hidden = !updating;
    if (submitLabel) {
      submitLabel.dataset.documentI18n = updating ? "updateAndAnalyze" : "uploadAndAnalyze";
      submitLabel.textContent = text(submitLabel.dataset.documentI18n);
    }
    if (rule) {
      rule.dataset.documentI18n = updating ? "updateConfirmationRule" : "confirmationRule";
      rule.textContent = text(rule.dataset.documentI18n);
    }
  }

  function renderSelection() {
    const section = document.querySelector("[data-document-selection]");
    const rail = document.querySelector("[data-document-file-rail]");
    const submit = document.querySelector("[data-document-submit]");
    if (!section || !rail || !submit) return;
    section.hidden = !state.files.length;
    submit.disabled = !state.files.length || state.busy;
    rail.innerHTML = state.files.map(function (item) {
      return `<article class="maritime-document-file-chip"><i class="fa-solid fa-file-pdf" aria-hidden="true"></i><span><strong>${escapeHtml(item.file.name)}</strong><small>${escapeHtml(formatBytes(item.file.size))}</small></span><button type="button" data-remove-file="${escapeHtml(item.id)}" aria-label="${escapeHtml(text("clear"))}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></article>`;
    }).join("");
  }

  function addFiles(fileList) {
    const existing = new Set(state.files.map(function (item) { return `${item.file.name}:${item.file.size}:${item.file.lastModified}`; }));
    const additions = Array.from(fileList || []).filter(function (file) {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    }).map(function (file) { return { id: fileId(), file }; });
    const next = state.files.concat(additions);
    try {
      validateFiles(next.map(function (item) { return item.file; }));
      state.files = next;
      setStatus("");
    } catch (error) {
      setStatus(error.message, "error");
    }
    renderSelection();
  }

  function statusLabel(status) {
    if (["pending_upload", "uploaded", "analysis_queued"].includes(status)) return text("pendingUpload");
    if (status === "analyzing") return text("analyzing");
    if (["pending_user_confirmation", "ocr_draft", "classified"].includes(status)) return text("reviewRequired");
    if (["user_confirmed", "verification_pending", "verified"].includes(status)) return text("confirmed");
    if (status === "rejected") return text("rejected");
    if (["analysis_failed", "quarantined"].includes(status)) return text("analysisFailed");
    return status || text("pendingUpload");
  }

  function inputValue(value) {
    return value == null ? "" : String(value);
  }

  function arrayText(value) {
    return Array.isArray(value) ? value.filter(Boolean).join(", ") : "";
  }

  function serviceText(rows) {
    return (Array.isArray(rows) ? rows : []).map(function (row) {
      return [row.vessel_name, row.company_name, row.flag, row.imo_number, row.vessel_type, row.rank, row.sign_on_date, row.sign_off_date, row.total_days, row.gross_tonnage, row.deadweight_tonnage, row.engine_make_model, row.engine_power_kw].map(inputValue).join(" | ");
    }).join("\n");
  }

  function languageText(rows) {
    return (Array.isArray(rows) ? rows : []).map(function (row) { return [row.language, row.level].map(inputValue).join(" | "); }).join("\n");
  }

  function documentTypeOptions(selected) {
    return Object.keys(documentTypeLabels).map(function (value) {
      return `<option value="${value}"${value === selected ? " selected" : ""}>${escapeHtml(documentTypeLabel(value))}</option>`;
    }).join("");
  }

  function medicalOptions(selected) {
    const options = [["not_stated", "notStated"], ["fit", "fit"], ["fit_with_restrictions", "fitWithRestrictions"], ["unfit", "unfit"]];
    return options.map(function ([value, key]) { return `<option value="${value}"${value === selected ? " selected" : ""}>${escapeHtml(text(key))}</option>`; }).join("");
  }

  function field(label, name, value, type) {
    return `<label class="maritime-document-field"><span>${escapeHtml(text(label))}</span><input name="${name}" type="${type || "text"}" value="${escapeHtml(inputValue(value))}" maxlength="240"></label>`;
  }

  function recordValue(label, value, options) {
    const settings = options || {};
    const resolved = settings.date && value ? dateLabel(value) : value;
    if (resolved === null || resolved === undefined || resolved === "") return "";
    return `<div><dt>${escapeHtml(text(label))}</dt><dd>${escapeHtml(resolved)}</dd></div>`;
  }

  function recordGroup(titleKey, rows, renderRow, privateNote) {
    const values = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (!values.length) return "";
    return `<section class="maritime-document-record-group"><header><h4>${escapeHtml(text(titleKey))}</h4>${privateNote ? `<small><i class="fa-solid fa-lock" aria-hidden="true"></i>${escapeHtml(text("privateRecord"))}</small>` : ""}</header><div class="maritime-document-record-list">${values.map(renderRow).join("")}</div></section>`;
  }

  function structuredRecordsMarkup(payload) {
    const sourceFact = function (row) { return recordValue("sourcePage", row.source_page); };
    const identity = recordGroup("identityDocuments", payload.identity_documents, function (row) {
      return `<div class="maritime-document-record-row"><strong>${escapeHtml(row.label || String(row.kind || "").replace(/_/g, " ") || text("documentLabel"))}</strong><dl>${recordValue("documentNumber", row.document_number)}${recordValue("issuingCountry", row.issuing_country)}${recordValue("issuingAuthority", row.issuing_authority)}${recordValue("placeOfIssue", row.place_of_issue)}${recordValue("issueDate", row.issue_date, { date: true })}${recordValue("expiryDate", row.validity_status === "non_expiring" ? text("validForever") : row.expiry_date, { date: row.validity_status !== "non_expiring" })}${sourceFact(row)}</dl></div>`;
    });
    const education = recordGroup("education", payload.education, function (row) {
      const title = localizedValue(row.qualification_i18n, row.qualification) || localizedValue(row.field_of_study_i18n, row.field_of_study) || text("education");
      return `<div class="maritime-document-record-row"><strong>${escapeHtml(title)}</strong><dl>${recordValue("issuingAuthority", row.institution)}${recordValue("placeOfIssue", [row.city, row.country].filter(Boolean).join(", "))}${recordValue("issueDate", row.start_date, { date: true })}${recordValue("expiryDate", row.graduation_date || row.end_date, { date: true })}${sourceFact(row)}</dl></div>`;
    });
    const medical = recordGroup("medicalRecords", payload.medical_records, function (row) {
      return `<div class="maritime-document-record-row"><strong>${escapeHtml(String(row.record_type || text("medicalRecords")).replace(/_/g, " "))}</strong><dl>${recordValue("documentNumber", row.document_number)}${recordValue("medicalFitness", row.result ? text({ fit: "fit", fit_with_restrictions: "fitWithRestrictions", unfit: "unfit" }[row.result] || "notStated") : "")}${recordValue("issuingAuthority", row.issuing_authority)}${recordValue("issueDate", row.issue_date, { date: true })}${recordValue("expiryDate", row.validity_status === "non_expiring" ? text("validForever") : row.expiry_date, { date: row.validity_status !== "non_expiring" })}${sourceFact(row)}</dl></div>`;
    });
    const vaccinations = recordGroup("vaccinations", payload.vaccinations, function (row) {
      return `<div class="maritime-document-record-row"><strong>${escapeHtml(localizedValue(row.vaccine_name_i18n, row.vaccine_name) || text("vaccinations"))}</strong><dl>${recordValue("documentNumber", row.document_number)}${recordValue("documentTitle", row.dose)}${recordValue("issuingAuthority", row.issuing_authority)}${recordValue("issueDate", row.issue_date, { date: true })}${recordValue("expiryDate", row.validity_status === "non_expiring" ? text("validForever") : row.expiry_date, { date: row.validity_status !== "non_expiring" })}${sourceFact(row)}</dl></div>`;
    });
    const emergency = recordGroup("emergencyContacts", payload.emergency_contacts, function (row) {
      return `<div class="maritime-document-record-row"><strong>${escapeHtml(row.name || text("emergencyContacts"))}</strong><dl>${recordValue("documentTitle", row.relationship)}${recordValue("phone", row.phone)}${recordValue("permanentAddress", row.address)}${sourceFact(row)}</dl></div>`;
    }, true);
    const references = recordGroup("references", payload.references, function (row) {
      return `<div class="maritime-document-record-row"><strong>${escapeHtml(row.name || row.company || text("references"))}</strong><dl>${recordValue("issuingAuthority", row.company)}${recordValue("rank", row.position)}${recordValue("phone", row.phone)}${recordValue("email", row.email)}${sourceFact(row)}</dl></div>`;
    });
    const groups = [identity, education, medical, vaccinations, emergency, references].filter(Boolean).join("");
    return groups ? `<section class="maritime-document-structured maritime-document-form-wide"><header><i class="fa-solid fa-table-list" aria-hidden="true"></i><h3>${escapeHtml(text("detailedRecords"))}</h3></header>${groups}</section>` : "";
  }

  function evidenceSourcePage(payload, fieldPath, value) {
    const normalized = String(value || "").trim();
    if (!normalized) return null;
    const evidence = Array.isArray(payload && payload.field_evidence) ? payload.field_evidence : [];
    const row = evidence.find(function (item) {
      return item && item.field_path === fieldPath
        && [item.normalized_value, item.value_as_printed].some(function (candidate) { return String(candidate || "").trim() === normalized; });
    });
    return row && Number.isInteger(row.source_page) ? row.source_page : null;
  }

  function certificateRecords(payload) {
    const explicit = Array.isArray(payload && payload.certificate_records) ? payload.certificate_records.filter(Boolean) : [];
    if (explicit.length) return explicit;
    const codes = Array.isArray(payload && payload.certificate_codes) ? payload.certificate_codes.filter(Boolean) : [];
    const isCertificate = ["stcw_certificate", "competency_certificate", "training_certificate"].includes(payload && payload.document_type);
    if (!codes.length && !isCertificate) return [];
    return (codes.length ? codes : [null]).map(function (code) {
      return {
        code,
        document_number: payload.document_number || null,
        title: payload.document_title || null,
        title_i18n: payload.document_title_i18n || {},
        issuing_country: payload.document_country || null,
        issuing_authority: payload.issuing_authority || null,
        place_of_issue: payload.place_of_issue || null,
        issue_date: payload.issue_date || null,
        expiry_date: payload.expiry_date || null,
        validity_status: payload.validity_status || (payload.expiry_date ? "dated" : "not_stated"),
        rank_or_capacity: payload.rank || null,
        rank_or_capacity_i18n: payload.rank_i18n || {},
        stcw_references: payload.stcw_references || [],
        source_page: evidenceSourcePage(payload, "document_number", payload.document_number),
        confidence: payload.confidence || 0
      };
    });
  }

  function certificateRecordsMarkup(payload) {
    const records = certificateRecords(payload);
    return `<section class="maritime-document-credentials maritime-document-form-wide"><header><span><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>${escapeHtml(text("autoCredentialsTitle"))}</span><small>${escapeHtml(text("autoCredentialsLead"))}</small></header>${records.length ? `<div class="maritime-document-credential-list">${records.map(function (row) {
      const title = localizedValue(row.title_i18n, row.title) || text("notStated");
      const capacity = localizedValue(row.rank_or_capacity_i18n, row.rank_or_capacity);
      const country = [row.issuing_country, row.place_of_issue].filter(Boolean).join(" · ");
      const stcw = Array.isArray(row.stcw_references) ? row.stcw_references.filter(Boolean).join(", ") : "";
      const expiry = row.validity_status === "non_expiring" ? text("validForever") : row.expiry_date ? dateLabel(row.expiry_date) : text("notStated");
      return `<article><strong>${escapeHtml(row.code || text("certificateCode"))}</strong><div><b>${escapeHtml(title)}</b>${capacity ? `<span>${escapeHtml(text("certificateCapacity"))}: ${escapeHtml(capacity)}</span>` : ""}${row.issuing_authority ? `<span>${escapeHtml(text("issuingAuthority"))}: ${escapeHtml(row.issuing_authority)}</span>` : ""}${country ? `<span>${escapeHtml(text("issuingCountry"))}: ${escapeHtml(country)}</span>` : ""}${stcw ? `<span>${escapeHtml(text("stcwReferences"))}: ${escapeHtml(stcw)}</span>` : ""}</div><dl><div><dt>${escapeHtml(text("documentNumber"))}</dt><dd>${escapeHtml(row.document_number || text("notStated"))}</dd></div><div><dt>${escapeHtml(text("issueDate"))}</dt><dd>${escapeHtml(row.issue_date ? dateLabel(row.issue_date) : text("notStated"))}</dd></div><div><dt>${escapeHtml(text("expiryDate"))}</dt><dd>${escapeHtml(expiry)}</dd></div>${row.source_page ? `<div><dt>${escapeHtml(text("sourcePage"))}</dt><dd>${escapeHtml(row.source_page)}</dd></div>` : ""}</dl></article>`;
    }).join("")}</div>` : `<p>${escapeHtml(text("noAutoCredentials"))}</p>`}</section>`;
  }

  function firstDraftValue(payloads, path) {
    for (const payload of payloads) {
      let value = payload;
      for (const key of path.split(".")) value = value && value[key];
      if (value !== null && value !== undefined && String(value).trim()) return value;
    }
    return null;
  }

  function mergedDraftObject(payloads, path, keys) {
    return keys.reduce(function (result, key) {
      const value = firstDraftValue(payloads, `${path}.${key}`);
      if (value !== null && value !== undefined && value !== "") result[key] = value;
      return result;
    }, {});
  }

  function mergedDraftRows(payloads, key, keyBuilder) {
    return uniqueDraftRows(payloads.flatMap(function (payload) {
      return Array.isArray(payload && payload[key]) ? payload[key] : [];
    }), keyBuilder);
  }

  function uniqueDraftRows(rows, keyBuilder) {
    const seen = new Set();
    return rows.filter(Boolean).filter(function (row) {
      const key = keyBuilder(row);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function globalPassportDraft() {
    const remote = state.remote || {};
    const extractionPayloads = (remote.extractions || [])
      .filter(function (row) { return !["rejected", "analysis_failed"].includes(row.status); })
      .map(function (row) { return row.confirmed_payload || row.extracted_payload; })
      .filter(Boolean);
    const confirmedProfile = remote.cv_profile && remote.cv_profile.profile_payload;
    const payloads = confirmedProfile ? extractionPayloads.concat([confirmedProfile]) : extractionPayloads;
    if (!payloads.length) return null;

    const documents = [];
    for (const payload of payloads) {
      if (payload.document_number || payload.document_title) {
        documents.push({
          label: payload.document_title || documentTypeLabel(payload.document_type),
          label_i18n: payload.document_title_i18n || {},
          document_number: payload.document_number,
          issuing_country: payload.document_country,
          issuing_authority: payload.issuing_authority,
          place_of_issue: payload.place_of_issue,
          issue_date: payload.issue_date,
          expiry_date: payload.expiry_date,
          validity_status: payload.validity_status,
          source_page: evidenceSourcePage(payload, "document_number", payload.document_number)
        });
      }
      documents.push(...(Array.isArray(payload.identity_documents) ? payload.identity_documents : []));
    }

    const credentials = uniqueDraftRows(payloads.flatMap(certificateRecords), function (row) {
      return [row.code, row.document_number, row.certificate_serial, row.title].map(function (value) { return String(value || "").toLowerCase(); }).join("|");
    });
    const identityDocuments = uniqueDraftRows(documents, function (row) {
      const number = String(row.document_number || "").toLowerCase();
      return number || [row.label, row.kind, row.issue_date].map(function (value) { return String(value || "").toLowerCase(); }).join("|");
    });
    const seaService = mergedDraftRows(payloads, "sea_service", function (row) {
      return [row.vessel_name, row.imo_number, row.rank, row.sign_on_date, row.sign_off_date].map(function (value) { return String(value || "").toLowerCase(); }).join("|");
    });
    const languages = mergedDraftRows(payloads, "languages", function (row) {
      return String(row.language || localizedValue(row.language_i18n, "")).toLowerCase();
    });
    const education = mergedDraftRows(payloads, "education", function (row) {
      return [row.institution, row.qualification, row.graduation_date].map(function (value) { return String(value || "").toLowerCase(); }).join("|");
    });
    const medicalRecords = mergedDraftRows(payloads, "medical_records", function (row) {
      return [row.record_type, row.document_number, row.expiry_date].map(function (value) { return String(value || "").toLowerCase(); }).join("|");
    });
    const vaccinations = mergedDraftRows(payloads, "vaccinations", function (row) {
      return [row.vaccine_name, row.document_number, row.dose].map(function (value) { return String(value || "").toLowerCase(); }).join("|");
    });
    const references = mergedDraftRows(payloads, "references", function (row) {
      return [row.name, row.company, row.position].map(function (value) { return String(value || "").toLowerCase(); }).join("|");
    });
    const skills = mergedDraftRows(payloads, "skills", function (row) {
      return String(row.name || localizedValue(row.name_i18n, "")).toLowerCase();
    });
    const achievements = mergedDraftRows(payloads, "achievements", function (row) {
      return [row.title, row.date].map(function (value) { return String(value || "").toLowerCase(); }).join("|");
    });
    const sessionMetadata = state.session?.user?.user_metadata || {};
    const holderName = firstDraftValue(payloads, "holder_name")
      || [firstDraftValue(payloads, "given_names"), firstDraftValue(payloads, "family_name")].filter(Boolean).join(" ")
      || sessionMetadata.full_name
      || sessionMetadata.name
      || state.session?.user?.email?.split("@")[0]
      || "AllonaHub";
    return {
      holder_name: holderName,
      family_name: firstDraftValue(payloads, "family_name"),
      given_names: firstDraftValue(payloads, "given_names"),
      nationality: localizedValue(firstDraftValue(payloads, "nationality_i18n"), firstDraftValue(payloads, "nationality")),
      date_of_birth: firstDraftValue(payloads, "date_of_birth"),
      place_of_birth: firstDraftValue(payloads, "place_of_birth"),
      gender: firstDraftValue(payloads, "gender"),
      marital_status: firstDraftValue(payloads, "marital_status"),
      rank: localizedValue(firstDraftValue(payloads, "rank_i18n"), firstDraftValue(payloads, "rank")),
      professional_summary: localizedValue(firstDraftValue(payloads, "professional_summary_i18n"), firstDraftValue(payloads, "professional_summary")) || text("globalPassportSummary"),
      desired_salary_amount: firstDraftValue(payloads, "desired_salary_amount"),
      desired_salary_currency: firstDraftValue(payloads, "desired_salary_currency"),
      availability_text: firstDraftValue(payloads, "availability_text"),
      medical_fitness: firstDraftValue(payloads, "medical_fitness"),
      contact: mergedDraftObject(payloads, "contact", ["email", "phone", "secondary_phone", "permanent_address", "nearest_airport"]),
      physical_profile: mergedDraftObject(payloads, "physical_profile", ["height_cm", "weight_kg", "eye_color", "hair_color", "shoe_size", "overall_size"]),
      identity_documents: identityDocuments,
      certificate_records: credentials,
      sea_service: seaService,
      languages,
      education,
      medical_records: medicalRecords,
      vaccinations,
      references,
      skills,
      achievements,
      endorsements: uniqueDraftRows(payloads.flatMap(function (payload) { return Array.isArray(payload.endorsements) ? payload.endorsements : []; }), function (value) { return String(value || "").toLowerCase(); }),
      restrictions: uniqueDraftRows(payloads.flatMap(function (payload) { return Array.isArray(payload.restrictions) ? payload.restrictions : []; }), function (value) { return String(value || "").toLowerCase(); }),
      source_document_count: new Set((remote.documents || []).map(function (row) { return row.id; })).size,
      extracted_record_count: identityDocuments.length + credentials.length + seaService.length + languages.length + education.length + medicalRecords.length + vaccinations.length + references.length + skills.length + achievements.length,
      pending_extraction_ids: (remote.extractions || []).filter(function (row) { return row.status === "pending_user_confirmation"; }).map(function (row) { return row.id; })
    };
  }

  function passportFact(labelKey, value, options) {
    const settings = options || {};
    if (value === null || value === undefined || value === "") return "";
    const shown = settings.date ? dateLabel(value) : value;
    return `<div><dt>${escapeHtml(text(labelKey))}</dt><dd>${escapeHtml(shown)}</dd></div>`;
  }

  function passportSection(titleKey, body, className, lead) {
    if (!body) return "";
    return `<section class="maritime-cv-v4-section ${className || ""}"><header><div><h3>${escapeHtml(text(titleKey))}</h3>${lead ? `<p>${escapeHtml(lead)}</p>` : ""}</div></header>${body}</section>`;
  }

  function passportInitials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return (parts.map(function (part) { return part[0]; }).join("") || "AH").toUpperCase();
  }

  function passportDocumentMarkup(row) {
    const expiry = row.validity_status === "non_expiring" ? text("validForever") : row.expiry_date ? dateLabel(row.expiry_date) : "";
    const title = localizedValue(row.label_i18n, row.label) || documentTypeLabel(row.kind || "unknown");
    const facts = [
      passportFact("documentNumber", row.document_number),
      passportFact("issuingCountry", row.issuing_country),
      passportFact("issuingAuthority", row.issuing_authority),
      passportFact("placeOfIssue", row.place_of_issue),
      passportFact("issueDate", row.issue_date, { date: true }),
      passportFact("expiryDate", expiry),
      passportFact("sourcePage", row.source_page)
    ].join("");
    return `<article class="maritime-cv-record"><strong>${escapeHtml(title)}</strong><dl class="maritime-cv-facts maritime-cv-facts--compact">${facts}</dl></article>`;
  }

  function passportCredentialMarkup(row) {
    const title = localizedValue(row.title_i18n, row.title) || row.code || text("notStated");
    const capacity = localizedValue(row.rank_or_capacity_i18n, row.rank_or_capacity);
    const facts = [
      passportFact("certificateCode", row.code),
      passportFact("documentNumber", row.document_number),
      passportFact("certificateSerial", row.certificate_serial),
      passportFact("endorsementNumber", row.endorsement_number),
      passportFact("certificateCapacity", capacity),
      passportFact("issuingCountry", row.issuing_country),
      passportFact("issuingAuthority", row.issuing_authority),
      passportFact("approvalAuthority", row.approval_authority),
      passportFact("approvalReference", row.approval_reference),
      passportFact("placeOfIssue", row.place_of_issue),
      passportFact("coursePeriod", [row.course_start_date ? dateLabel(row.course_start_date) : "", row.course_end_date ? dateLabel(row.course_end_date) : ""].filter(Boolean).join(" - ")),
      passportFact("issueDate", row.issue_date, { date: true }),
      passportFact("expiryDate", row.validity_status === "non_expiring" ? text("validForever") : row.expiry_date ? dateLabel(row.expiry_date) : ""),
      passportFact("stcwReferences", Array.isArray(row.stcw_references) ? row.stcw_references.join(" · ") : ""),
      passportFact("sourcePage", row.source_page)
    ].join("");
    return `<article class="maritime-cv-record maritime-cv-record--credential"><strong>${escapeHtml(row.code || "STCW")}</strong><div><strong>${escapeHtml(title)}</strong><dl class="maritime-cv-facts maritime-cv-facts--compact">${facts}</dl></div></article>`;
  }

  function passportServiceMarkup(row) {
    const facts = [
      passportFact("company", row.company_name),
      passportFact("flag", row.flag),
      passportFact("vesselType", localizedValue(row.vessel_type_i18n, row.vessel_type)),
      passportFact("rank", localizedValue(row.rank_i18n, row.rank)),
      passportFact("period", [row.sign_on_date ? dateLabel(row.sign_on_date) : "", row.sign_off_date ? dateLabel(row.sign_off_date) : ""].filter(Boolean).join(" - ")),
      passportFact("verifiedDays", row.total_days),
      passportFact("grt", row.gross_tonnage),
      passportFact("dwt", row.deadweight_tonnage),
      passportFact("engine", [row.engine_make_model, row.engine_power_kw ? `${row.engine_power_kw} kW` : ""].filter(Boolean).join(" · ")),
      passportFact("sourcePage", row.source_page)
    ].join("");
    return `<article class="maritime-cv-service-row"><header><strong>${escapeHtml(row.vessel_name || text("vessel"))}</strong><span>${escapeHtml(row.imo_number ? `IMO ${row.imo_number}` : "")}</span></header><dl class="maritime-cv-facts maritime-cv-facts--service">${facts}</dl></article>`;
  }

  function passportEducationMarkup(row) {
    const qualification = localizedValue(row.qualification_i18n, row.qualification);
    const study = localizedValue(row.field_of_study_i18n, row.field_of_study);
    const facts = [
      passportFact("qualification", qualification),
      passportFact("fieldOfStudy", study),
      passportFact("placeOfIssue", [row.city, row.country].filter(Boolean).join(", ")),
      passportFact("period", [row.start_date ? dateLabel(row.start_date) : "", row.graduation_date || row.end_date ? dateLabel(row.graduation_date || row.end_date) : ""].filter(Boolean).join(" - ")),
      passportFact("sourcePage", row.source_page)
    ].join("");
    return `<article class="maritime-cv-record"><strong>${escapeHtml(row.institution || qualification || text("education"))}</strong><dl class="maritime-cv-facts maritime-cv-facts--compact">${facts}</dl></article>`;
  }

  function passportMedicalMarkup(row) {
    const resultKey = { fit: "fit", fit_with_restrictions: "fitWithRestrictions", unfit: "unfit" }[row.result] || "notStated";
    const facts = [
      passportFact("documentNumber", row.document_number),
      passportFact("medicalResult", row.result ? text(resultKey) : ""),
      passportFact("issuingAuthority", row.issuing_authority),
      passportFact("placeOfIssue", row.place_of_issue),
      passportFact("issueDate", row.issue_date, { date: true }),
      passportFact("expiryDate", row.validity_status === "non_expiring" ? text("validForever") : row.expiry_date ? dateLabel(row.expiry_date) : ""),
      passportFact("sourcePage", row.source_page)
    ].join("");
    return `<article class="maritime-cv-record"><strong>${escapeHtml(String(row.record_type || text("medicalRecords")).replace(/_/g, " "))}</strong><dl class="maritime-cv-facts maritime-cv-facts--compact">${facts}</dl></article>`;
  }

  function passportVaccinationMarkup(row) {
    const title = localizedValue(row.vaccine_name_i18n, row.vaccine_name) || text("vaccinations");
    const facts = [
      passportFact("dose", row.dose),
      passportFact("documentNumber", row.document_number),
      passportFact("issuingAuthority", row.issuing_authority),
      passportFact("issueDate", row.issue_date, { date: true }),
      passportFact("expiryDate", row.validity_status === "non_expiring" ? text("validForever") : row.expiry_date ? dateLabel(row.expiry_date) : ""),
      passportFact("sourcePage", row.source_page)
    ].join("");
    return `<article class="maritime-cv-record"><strong>${escapeHtml(title)}</strong><dl class="maritime-cv-facts maritime-cv-facts--compact">${facts}</dl></article>`;
  }

  function passportReferenceMarkup(row) {
    const facts = [
      passportFact("company", row.company),
      passportFact("rank", row.position),
      passportFact("phone", row.phone),
      passportFact("email", row.email),
      passportFact("sourcePage", row.source_page)
    ].join("");
    return `<article class="maritime-cv-record"><strong>${escapeHtml(row.name || row.company || text("references"))}</strong><dl class="maritime-cv-facts maritime-cv-facts--compact">${facts}</dl></article>`;
  }

  function passportAchievementMarkup(row) {
    const title = localizedValue(row.title_i18n, row.title) || text("achievements");
    const facts = [passportFact("issueDate", row.date, { date: true }), passportFact("sourcePage", row.source_page)].join("");
    return `<article class="maritime-cv-record"><strong>${escapeHtml(title)}</strong>${row.details ? `<p>${escapeHtml(row.details)}</p>` : ""}<dl class="maritime-cv-facts maritime-cv-facts--compact">${facts}</dl></article>`;
  }

  function passportChipList(values) {
    const rows = values.filter(Boolean);
    return rows.length ? `<div class="maritime-cv-chip-list">${rows.map(function (value) { return `<span>${escapeHtml(value)}</span>`; }).join("")}</div>` : "";
  }

  function globalPassportPreviewMarkup(draft) {
    const identityFacts = [
      passportFact("familyName", draft.family_name),
      passportFact("givenNames", draft.given_names),
      passportFact("nationality", draft.nationality),
      passportFact("dateOfBirth", draft.date_of_birth, { date: true }),
      passportFact("placeOfBirth", draft.place_of_birth),
      passportFact("gender", draft.gender),
      passportFact("maritalStatus", draft.marital_status),
      passportFact("medicalFitness", draft.medical_fitness ? text({ fit: "fit", fit_with_restrictions: "fitWithRestrictions", unfit: "unfit" }[draft.medical_fitness] || "notStated") : ""),
      passportFact("rank", draft.rank)
    ].join("");
    const contactFacts = [
      passportFact("email", draft.contact.email),
      passportFact("phone", draft.contact.phone),
      passportFact("secondaryPhone", draft.contact.secondary_phone),
      passportFact("permanentAddress", draft.contact.permanent_address),
      passportFact("nearestAirport", draft.contact.nearest_airport),
      passportFact("desiredSalary", [draft.desired_salary_amount, draft.desired_salary_currency].filter(Boolean).join(" ")),
      passportFact("availability", draft.availability_text)
    ].join("");
    const physicalFacts = [
      passportFact("heightCm", draft.physical_profile.height_cm),
      passportFact("weightKg", draft.physical_profile.weight_kg),
      passportFact("eyeColor", draft.physical_profile.eye_color),
      passportFact("hairColor", draft.physical_profile.hair_color),
      passportFact("shoeSize", draft.physical_profile.shoe_size),
      passportFact("overallSize", draft.physical_profile.overall_size)
    ].join("");
    const photo = state.remote?.profile_photo_url;
    const documentMarkup = draft.identity_documents.map(passportDocumentMarkup).join("");
    const credentialMarkup = draft.certificate_records.map(passportCredentialMarkup).join("");
    const serviceMarkup = draft.sea_service.map(passportServiceMarkup).join("");
    const educationMarkup = draft.education.map(passportEducationMarkup).join("");
    const medicalMarkup = draft.medical_records.map(passportMedicalMarkup).join("");
    const vaccinationMarkup = draft.vaccinations.map(passportVaccinationMarkup).join("");
    const referenceMarkup = draft.references.map(passportReferenceMarkup).join("");
    const achievementMarkup = draft.achievements.map(passportAchievementMarkup).join("");
    const skillMarkup = passportChipList(draft.skills.map(function (row) { return localizedValue(row.name_i18n, row.name); }));
    const endorsementMarkup = passportChipList(draft.endorsements);
    const restrictionMarkup = passportChipList(draft.restrictions);
    const languageMarkup = draft.languages.map(function (row) {
      const name = localizedValue(row.language_i18n, row.language);
      const level = localizedValue(row.level_i18n, row.level);
      return `<span><b>${escapeHtml(name)}</b>${level ? `<small>${escapeHtml(level)}</small>` : ""}</span>`;
    }).join("");
    const sourceFacts = [passportFact("sourceDocuments", draft.source_document_count), passportFact("extractedRecords", draft.extracted_record_count)].join("");
    return `<div class="maritime-cv-layout maritime-cv-layout--v4">
      <span class="maritime-cv-neon-rail" aria-hidden="true"></span>
      <div class="maritime-cv-body">
        <header class="maritime-cv-profile-head">
          <div class="maritime-cv-avatar">${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(draft.holder_name)}">` : `<span>${escapeHtml(passportInitials(draft.holder_name))}</span>`}</div>
          <div class="maritime-cv-head"><span>${escapeHtml(text("maritimeLabel"))}</span><h2>${escapeHtml(draft.holder_name)}</h2><p>${escapeHtml(draft.rank || text("globalPassportSummary"))}</p></div>
          <div class="maritime-cv-v4-brand"><span>ALLONA HUB</span><strong>${escapeHtml(text("globalPassportTitle"))}</strong></div>
        </header>
        ${passportSection("professionalSummary", `<p class="maritime-cv-summary-copy">${escapeHtml(draft.professional_summary)}</p><dl class="maritime-cv-facts maritime-cv-facts--compact maritime-global-passport-source-facts">${sourceFacts}</dl>`)}
        <div class="maritime-cv-v4-grid maritime-cv-v4-grid--three">
          ${passportSection("personalDetails", `<dl class="maritime-cv-facts">${identityFacts}</dl>`)}
          ${passportSection("contactDetails", `<dl class="maritime-cv-facts">${contactFacts}</dl>`)}
          ${passportSection("physicalDetails", `<dl class="maritime-cv-facts">${physicalFacts}</dl>`)}
        </div>
        ${passportSection("identityDocuments", documentMarkup ? `<div class="maritime-cv-record-list maritime-cv-record-list--two">${documentMarkup}</div>` : "")}
        ${passportSection("autoCredentialsTitle", credentialMarkup ? `<div class="maritime-cv-record-list">${credentialMarkup}</div>` : "")}
        <div class="maritime-cv-v4-grid maritime-cv-v4-grid--two">
          ${passportSection("endorsements", endorsementMarkup)}
          ${passportSection("restrictions", restrictionMarkup)}
        </div>
        ${passportSection("skills", skillMarkup)}
        ${passportSection("achievements", achievementMarkup ? `<div class="maritime-cv-record-list maritime-cv-record-list--two">${achievementMarkup}</div>` : "")}
        ${passportSection("education", educationMarkup ? `<div class="maritime-cv-record-list maritime-cv-record-list--two">${educationMarkup}</div>` : "")}
        <div class="maritime-cv-v4-grid maritime-cv-v4-grid--two">
          ${passportSection("medicalRecords", medicalMarkup ? `<div class="maritime-cv-record-list">${medicalMarkup}</div>` : "")}
          ${passportSection("vaccinations", vaccinationMarkup ? `<div class="maritime-cv-record-list">${vaccinationMarkup}</div>` : "")}
        </div>
        ${passportSection("serviceHistory", serviceMarkup ? `<div class="maritime-cv-service-list">${serviceMarkup}</div>` : "")}
        <div class="maritime-cv-v4-grid maritime-cv-v4-grid--two">
          ${passportSection("languages", languageMarkup ? `<div class="maritime-cv-language-list maritime-cv-language-list--v4">${languageMarkup}</div>` : "")}
          ${passportSection("references", referenceMarkup ? `<div class="maritime-cv-record-list">${referenceMarkup}</div>` : "")}
        </div>
        <div class="maritime-cv-v4-notes"><p><i class="fa-solid fa-shield-halved" aria-hidden="true"></i>${escapeHtml(text("confirmationRule"))}</p><p><i class="fa-solid fa-lock" aria-hidden="true"></i>${escapeHtml(text("privacyNote"))}</p></div>
      </div>
      <span class="maritime-cv-neon-rail" aria-hidden="true"></span>
    </div>`;
  }

  function reviewCard(documentRow, extraction, index) {
    const status = extraction?.status || documentRow.status;
    const payload = extraction?.confirmed_payload || extraction?.extracted_payload || {};
    const pending = extraction?.status === "pending_user_confirmation";
    const retry = ["analysis_failed", "quarantined", "uploaded", "pending_upload"].includes(documentRow.status);
    const confidence = Math.round((Number(extraction?.overall_confidence ?? payload.confidence) || 0) * 100);
    const statusClass = ["user_confirmed", "verification_pending", "verified", "confirmed"].includes(status) ? "is-confirmed" : status === "rejected" ? "is-rejected" : pending ? "is-review" : "";
    const readerVersion = Number(payload.reader_version) || 0;
    const evidenceCount = Array.isArray(payload.field_evidence) ? payload.field_evidence.length : 0;
    const sourceMeta = [readerVersion ? `V${readerVersion}` : "", payload.document_country_code || "", evidenceCount ? `${evidenceCount} ${text("sourceEvidence")}` : ""].filter(Boolean).join(" · ");
    const summary = `<div class="maritime-document-card-summary"><span class="maritime-document-type-icon"><i class="fa-solid fa-file-pdf" aria-hidden="true"></i></span><span><strong>${escapeHtml(documentRow.original_file_name || payload.document_title || text("documentLabel"))}</strong><small>PDF · ${escapeHtml(formatBytes(documentRow.file_size_bytes))}${sourceMeta ? ` · ${escapeHtml(sourceMeta)}` : ""}</small></span><span class="maritime-document-state ${statusClass}">${escapeHtml(statusLabel(status))}</span></div>`;
    const utility = `<div class="maritime-document-card-utility"><button type="button" data-open-intake="${escapeHtml(documentRow.id)}"><i class="fa-solid fa-eye" aria-hidden="true"></i>${escapeHtml(text("openDocument"))}</button>${retry ? `<button type="button" data-retry-intake="${escapeHtml(documentRow.id)}"><i class="fa-solid fa-rotate" aria-hidden="true"></i>${escapeHtml(text("retryAnalysis"))}</button>` : ""}</div>`;
    return `<article class="maritime-document-review-card ${statusClass}">${summary}${utility}</article>`;
    /* The detailed field editor is intentionally retained below as a dormant fallback.
       The Belgelerim flow now uses the consolidated Global Passport preview and one approval. */
    if (!pending) return `<article class="maritime-document-review-card ${statusClass}">${summary}${utility}</article>`;

    return `<details class="maritime-document-review-card is-review"${index === 0 ? " open" : ""}><summary>${summary}</summary><form class="maritime-document-review-form" data-extraction-form="${escapeHtml(extraction.id)}">
      <div class="maritime-document-review-title"><div><h3>${escapeHtml(text("verifyDetails"))}</h3><p>${escapeHtml(text("confirmationRule"))}</p>${readerVersion ? `<div class="maritime-document-evidence-badges"><span><i class="fa-solid fa-microchip" aria-hidden="true"></i>${escapeHtml(text("readerVersion"))}: V${readerVersion}</span>${payload.template_family ? `<span><i class="fa-solid fa-layer-group" aria-hidden="true"></i>${escapeHtml(text("classifiedTemplate"))}: ${escapeHtml(payload.template_family)}</span>` : ""}<span><i class="fa-solid fa-location-crosshairs" aria-hidden="true"></i>${evidenceCount} ${escapeHtml(text("sourceEvidence"))}</span></div>` : ""}</div><span>${escapeHtml(text("confidence"))}: <b>${confidence}%</b></span></div>
      <div class="maritime-document-form-grid">
        <div class="maritime-document-form-subhead maritime-document-form-wide"><i class="fa-solid fa-file-lines" aria-hidden="true"></i><h3>${escapeHtml(text("detailedRecords"))}</h3></div>
        <label class="maritime-document-field"><span>${escapeHtml(text("documentType"))}</span><select name="document_type">${documentTypeOptions(payload.document_type)}</select></label>
        ${field("documentTitle", "document_title", payload.document_title)}
        ${field("issuingCountry", "document_country", payload.document_country)}
        <label class="maritime-document-field"><span>${escapeHtml(text("languages"))}</span><input name="source_languages" type="text" value="${escapeHtml(arrayText(payload.source_languages))}" maxlength="400"></label>
        <div class="maritime-document-form-subhead maritime-document-form-wide"><i class="fa-solid fa-user" aria-hidden="true"></i><h3>${escapeHtml(text("personalDetails"))}</h3></div>
        ${field("holderName", "holder_name", payload.holder_name)}
        ${field("familyName", "family_name", payload.family_name)}
        ${field("givenNames", "given_names", payload.given_names)}
        ${field("middleName", "middle_name", payload.middle_name)}
        ${field("documentNumber", "document_number", payload.document_number)}
        ${field("issuingAuthority", "issuing_authority", payload.issuing_authority)}
        ${field("nationality", "nationality", payload.nationality)}
        ${field("dateOfBirth", "date_of_birth", payload.date_of_birth, "date")}
        ${field("placeOfBirth", "place_of_birth", payload.place_of_birth)}
        ${field("gender", "gender", payload.gender)}
        ${field("maritalStatus", "marital_status", payload.marital_status)}
        ${field("issueDate", "issue_date", payload.issue_date, "date")}
        ${field("expiryDate", "expiry_date", payload.expiry_date, "date")}
        ${field("rank", "rank", payload.rank)}
        <label class="maritime-document-field"><span>${escapeHtml(text("medicalFitness"))}</span><select name="medical_fitness">${medicalOptions(payload.medical_fitness || "not_stated")}</select></label>
        <label class="maritime-document-field"><span>${escapeHtml(text("suitablePositions"))}</span><input name="suitable_positions" type="text" value="${escapeHtml(arrayText(payload.suitable_positions))}" maxlength="1800"></label>
        ${field("email", "contact_email", payload.contact?.email, "email")}
        ${field("phone", "contact_phone", payload.contact?.phone, "tel")}
        ${field("secondaryPhone", "contact_secondary_phone", payload.contact?.secondary_phone, "tel")}
        ${field("permanentAddress", "contact_permanent_address", payload.contact?.permanent_address)}
        ${field("nearestAirport", "contact_nearest_airport", payload.contact?.nearest_airport)}
        ${field("heightCm", "physical_height_cm", payload.physical_profile?.height_cm, "number")}
        ${field("weightKg", "physical_weight_kg", payload.physical_profile?.weight_kg, "number")}
        ${field("eyeColor", "physical_eye_color", payload.physical_profile?.eye_color)}
        ${field("hairColor", "physical_hair_color", payload.physical_profile?.hair_color)}
        ${field("shoeSize", "physical_shoe_size", payload.physical_profile?.shoe_size)}
        ${field("overallSize", "physical_overall_size", payload.physical_profile?.overall_size)}
        <label class="maritime-document-field maritime-document-form-wide"><span>${escapeHtml(text("professionalSummary"))}</span><textarea name="professional_summary" rows="3" maxlength="1200">${escapeHtml(inputValue(payload.professional_summary))}</textarea></label>
        ${field("desiredSalary", "desired_salary_amount", payload.desired_salary_amount, "number")}
        ${field("desiredSalaryCurrency", "desired_salary_currency", payload.desired_salary_currency)}
        ${field("availability", "availability_text", payload.availability_text)}
        ${certificateRecordsMarkup(payload)}
        ${structuredRecordsMarkup(payload)}
        <label class="maritime-document-field"><span>${escapeHtml(text("endorsements"))}</span><input name="endorsements" type="text" value="${escapeHtml(arrayText(payload.endorsements))}" maxlength="3600"></label>
        <label class="maritime-document-field"><span>${escapeHtml(text("restrictions"))}</span><input name="restrictions" type="text" value="${escapeHtml(arrayText(payload.restrictions))}" maxlength="3600"></label>
        <label class="maritime-document-field maritime-document-form-wide"><span>${escapeHtml(text("seaService"))}</span><textarea name="sea_service" rows="4" maxlength="12000">${escapeHtml(serviceText(payload.sea_service))}</textarea><small>${escapeHtml(text("seaServiceHint"))}</small></label>
        <label class="maritime-document-field maritime-document-form-wide"><span>${escapeHtml(text("languages"))}</span><textarea name="languages" rows="2" maxlength="2000">${escapeHtml(languageText(payload.languages))}</textarea><small>${escapeHtml(text("languageHint"))}</small></label>
        <label class="maritime-document-field maritime-document-form-wide"><span>${escapeHtml(text("notes"))}</span><textarea name="notes" rows="2" maxlength="8400">${escapeHtml((Array.isArray(payload.notes) ? payload.notes : []).join("\n"))}</textarea></label>
      </div>
      ${Array.isArray(payload.warnings) && payload.warnings.length ? `<div class="maritime-document-warnings"><strong>${escapeHtml(text("warnings"))}</strong><ul>${payload.warnings.map(function (warning) { return `<li>${escapeHtml(warning)}</li>`; }).join("")}</ul></div>` : ""}
      ${utility}
      <div class="maritime-document-review-actions"><button class="maritime-button maritime-button--danger-outline" type="button" data-reject-extraction="${escapeHtml(extraction.id)}"><i class="fa-solid fa-xmark" aria-hidden="true"></i>${escapeHtml(text("rejectDetails"))}</button><button class="maritime-button maritime-button--primary" type="submit"><i class="fa-solid fa-check" aria-hidden="true"></i>${escapeHtml(text("confirmDetails"))}</button></div>
    </form></details>`;
  }

  function renderGlobalPassport() {
    const section = document.querySelector("[data-global-passport-section]");
    const preview = document.querySelector("[data-global-passport-preview]");
    const confirm = document.querySelector("[data-confirm-global-passport]");
    const openCv = document.querySelector("[data-open-maritime-cv]");
    if (!section || !preview || !confirm || !openCv) return;
    const draft = globalPassportDraft();
    section.hidden = !draft;
    if (!draft) {
      preview.innerHTML = "";
      return;
    }
    preview.innerHTML = globalPassportPreviewMarkup(draft);
    const pending = draft.pending_extraction_ids.length > 0;
    confirm.hidden = !pending;
    confirm.disabled = state.busy;
    openCv.hidden = pending || !state.remote?.cv_profile;
  }

  function renderRemote() {
    const remote = state.remote || { documents: [], extractions: [], cv_profile: null };
    applyUpdateModeCopy();
    renderGlobalPassport();
    const list = document.querySelector("[data-document-review-list]");
    if (!list) return;
    const extractionMap = new Map((remote.extractions || []).map(function (item) { return [item.intake_id, item]; }));
    if (!remote.documents?.length) {
      list.innerHTML = `<article class="maritime-document-empty"><i class="fa-solid fa-file-shield" aria-hidden="true"></i><strong>${escapeHtml(text("noDocuments"))}</strong><span>${escapeHtml(text("noDocumentsLead"))}</span></article>`;
      return;
    }
    list.innerHTML = remote.documents.map(function (item, index) { return reviewCard(item, extractionMap.get(item.id), index); }).join("");
  }

  async function loadRemote() {
    try {
      state.remote = await api("/v1/maritime/documents", { method: "GET" });
      renderRemote();
    } catch (error) {
      setStatus(text("loadFailed"), "error");
    }
  }

  function splitValues(value) {
    return String(value || "").split(/[,;\n]+/).map(function (item) { return item.trim(); }).filter(Boolean).slice(0, 40);
  }

  function nullable(value) {
    const clean = String(value || "").trim();
    return clean || null;
  }

  function parseSeaService(value) {
    return String(value || "").split(/\n+/).map(function (line) { return line.trim(); }).filter(Boolean).slice(0, 80).map(function (line) {
      const parts = line.split("|").map(function (item) { return item.trim(); });
      const number = function (index) { const result = Number(parts[index]); return Number.isFinite(result) && result >= 0 ? result : null; };
      const days = Number.parseInt(parts[8], 10);
      return {
        vessel_name: nullable(parts[0]),
        company_name: nullable(parts[1]),
        flag: nullable(parts[2]),
        imo_number: /^\d{7}$/.test(parts[3] || "") ? parts[3] : null,
        vessel_type: nullable(parts[4]),
        rank: nullable(parts[5]),
        sign_on_date: /^\d{4}-\d{2}-\d{2}$/.test(parts[6] || "") ? parts[6] : null,
        sign_off_date: /^\d{4}-\d{2}-\d{2}$/.test(parts[7] || "") ? parts[7] : null,
        total_days: Number.isInteger(days) && days >= 0 ? days : null,
        gross_tonnage: number(9),
        deadweight_tonnage: number(10),
        engine_make_model: nullable(parts[11]),
        engine_power_kw: number(12)
      };
    });
  }

  function preserveSeaServiceTranslations(rows, originals) {
    return rows.map(function (row, index) {
      const original = Array.isArray(originals) ? originals[index] || {} : {};
      const unchanged = serviceText([row]) === serviceText([original]);
      return {
        ...row,
        vessel_type_i18n: unchanged ? normalizedLocalizedText(original.vessel_type_i18n) : normalizedLocalizedText({}),
        rank_i18n: unchanged ? normalizedLocalizedText(original.rank_i18n) : normalizedLocalizedText({}),
        source_page: unchanged && Number.isInteger(original.source_page) ? original.source_page : null,
        confidence: unchanged ? Math.max(0, Math.min(1, Number(original.confidence) || 0)) : 0
      };
    });
  }

  function parseLanguages(value) {
    return String(value || "").split(/\n+/).map(function (line) { return line.trim(); }).filter(Boolean).slice(0, 20).map(function (line) {
      const parts = line.split("|").map(function (item) { return item.trim(); });
      return { language: parts[0] || "", level: nullable(parts[1]) };
    }).filter(function (item) { return item.language; });
  }

  function preserveLanguageTranslations(rows, originals) {
    return rows.map(function (row, index) {
      const original = Array.isArray(originals) ? originals[index] || {} : {};
      const unchanged = languageText([row]) === languageText([original]);
      return {
        ...row,
        language_i18n: unchanged ? normalizedLocalizedText(original.language_i18n) : normalizedLocalizedText({}),
        level_i18n: unchanged ? normalizedLocalizedText(original.level_i18n) : normalizedLocalizedText({}),
        source_page: unchanged && Number.isInteger(original.source_page) ? original.source_page : null,
        confidence: unchanged ? Math.max(0, Math.min(1, Number(original.confidence) || 0)) : 0
      };
    });
  }

  function confirmationPayload(form, original) {
    const data = new FormData(form);
    const records = certificateRecords(original).slice(0, 40).map(function (row) {
      return {
        ...row,
        code: nullable(row.code),
        document_number: nullable(row.document_number),
        title: nullable(row.title),
        title_i18n: normalizedLocalizedText(row.title_i18n),
        issuing_country: nullable(row.issuing_country),
        issuing_authority: nullable(row.issuing_authority),
        place_of_issue: nullable(row.place_of_issue),
        issue_date: nullable(row.issue_date),
        expiry_date: nullable(row.expiry_date),
        validity_status: ["dated", "non_expiring", "not_stated"].includes(row.validity_status) ? row.validity_status : row.expiry_date ? "dated" : "not_stated",
        rank_or_capacity: nullable(row.rank_or_capacity),
        rank_or_capacity_i18n: normalizedLocalizedText(row.rank_or_capacity_i18n),
        stcw_references: Array.isArray(row.stcw_references) ? row.stcw_references.map(String).filter(Boolean).slice(0, 30) : [],
        source_page: Number.isInteger(row.source_page) ? row.source_page : null,
        confidence: Math.max(0, Math.min(1, Number(row.confidence) || 0))
      };
    });
    const certificateCodes = Array.from(new Set([...(Array.isArray(original.certificate_codes) ? original.certificate_codes : []), ...records.map(function (row) { return row.code; })].map(function (value) { return String(value || "").trim(); }).filter(Boolean))).slice(0, 40);
    const rank = nullable(data.get("rank"));
    const nationality = nullable(data.get("nationality"));
    const positions = splitValues(data.get("suitable_positions")).slice(0, 20);
    const endorsements = splitValues(data.get("endorsements")).slice(0, 30);
    const restrictions = splitValues(data.get("restrictions")).slice(0, 20);
    const sameList = function (first, second) { return JSON.stringify(first || []) === JSON.stringify(second || []); };
    return {
      ...original,
      document_type: String(data.get("document_type") || "unknown"),
      document_title: nullable(data.get("document_title")),
      document_country: nullable(data.get("document_country")),
      source_languages: splitValues(data.get("source_languages")).slice(0, 20),
      holder_name: nullable(data.get("holder_name")),
      family_name: nullable(data.get("family_name")),
      given_names: nullable(data.get("given_names")),
      middle_name: nullable(data.get("middle_name")),
      document_number: nullable(data.get("document_number")),
      issuing_authority: nullable(data.get("issuing_authority")),
      nationality,
      nationality_i18n: nationality === original.nationality ? normalizedLocalizedText(original.nationality_i18n) : normalizedLocalizedText({}),
      date_of_birth: nullable(data.get("date_of_birth")),
      place_of_birth: nullable(data.get("place_of_birth")),
      gender: nullable(data.get("gender")),
      marital_status: nullable(data.get("marital_status")),
      issue_date: nullable(data.get("issue_date")),
      expiry_date: nullable(data.get("expiry_date")),
      rank,
      rank_i18n: rank === original.rank ? normalizedLocalizedText(original.rank_i18n) : normalizedLocalizedText({}),
      suitable_positions: positions,
      suitable_positions_i18n: sameList(positions, original.suitable_positions) ? normalizedLocalizedList(original.suitable_positions_i18n) : normalizedLocalizedList({}),
      certificate_codes: certificateCodes,
      certificate_records: records,
      endorsements,
      endorsements_i18n: sameList(endorsements, original.endorsements) ? normalizedLocalizedList(original.endorsements_i18n) : normalizedLocalizedList({}),
      restrictions,
      restrictions_i18n: sameList(restrictions, original.restrictions) ? normalizedLocalizedList(original.restrictions_i18n) : normalizedLocalizedList({}),
      sea_service: preserveSeaServiceTranslations(parseSeaService(data.get("sea_service")), original.sea_service),
      languages: preserveLanguageTranslations(parseLanguages(data.get("languages")), original.languages),
      contact: {
        email: nullable(data.get("contact_email")),
        phone: nullable(data.get("contact_phone")),
        secondary_phone: nullable(data.get("contact_secondary_phone")),
        permanent_address: nullable(data.get("contact_permanent_address")),
        nearest_airport: nullable(data.get("contact_nearest_airport"))
      },
      physical_profile: {
        height_cm: Number(data.get("physical_height_cm")) || null,
        weight_kg: Number(data.get("physical_weight_kg")) || null,
        eye_color: nullable(data.get("physical_eye_color")),
        hair_color: nullable(data.get("physical_hair_color")),
        shoe_size: nullable(data.get("physical_shoe_size")),
        overall_size: nullable(data.get("physical_overall_size"))
      },
      professional_summary: nullable(data.get("professional_summary")),
      desired_salary_amount: Number(data.get("desired_salary_amount")) || null,
      desired_salary_currency: nullable(data.get("desired_salary_currency")),
      availability_text: nullable(data.get("availability_text")),
      medical_fitness: String(data.get("medical_fitness") || "not_stated"),
      notes: String(data.get("notes") || "").split(/\n+/).map(function (item) { return item.trim(); }).filter(Boolean).slice(0, 30)
    };
  }

  async function uploadAndAnalyze(form) {
    validateFiles(state.files.map(function (item) { return item.file; }));
    if (!form.elements.analysis_consent.checked) throw new Error(text("consentRequired"));
    state.busy = true;
    renderSelection();
    setStatus("");
    setProgress(true, text("statusUploading"), `0 / ${state.files.length}`, 3);
    try {
      const intent = await api("/v1/maritime/documents/upload-intents", {
        method: "POST",
        body: JSON.stringify({
          analysis_consent: true,
          files: state.files.map(function (item) { return { client_file_id: item.id, name: item.file.name, mime_type: "application/pdf", size_bytes: item.file.size }; })
        })
      });
      const fileMap = new Map(state.files.map(function (item) { return [item.id, item.file]; }));
      let completed = 0;
      let failed = 0;
      for (const upload of intent.uploads || []) {
        const file = fileMap.get(upload.client_file_id);
        try {
          const uploadResult = await App.supabase.storage.from(upload.bucket).uploadToSignedUrl(upload.path, upload.token, file, { contentType: "application/pdf", upsert: false });
          if (uploadResult.error) throw uploadResult.error;
          completed += 1;
          setProgress(true, text("statusAnalyzing"), `${completed} / ${state.files.length}`, Math.round(45 + completed / state.files.length * 50));
          await api(`/v1/maritime/documents/${encodeURIComponent(upload.intake_id)}/analyze`, { method: "POST", body: JSON.stringify({ language: language() }) });
        } catch (error) {
          failed += 1;
        }
      }
      state.files = [];
      form.reset();
      renderSelection();
      await loadRemote();
      setProgress(false);
      setStatus(failed ? text("uploadFailed") : text("statusComplete"), failed ? "error" : "success");
      if (!failed) document.querySelector("[data-global-passport-section]")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally {
      state.busy = false;
      renderSelection();
      if (document.querySelector("[data-document-progress]")?.hidden === false && !state.files.length) setProgress(false);
    }
  }

  async function retryAnalysis(intakeId, button) {
    button.disabled = true;
    setProgress(true, text("statusAnalyzing"), "", 60);
    try {
      await api(`/v1/maritime/documents/${encodeURIComponent(intakeId)}/analyze`, { method: "POST", body: JSON.stringify({ language: language() }) });
      await loadRemote();
      setStatus(text("statusComplete"), "success");
    } catch (error) {
      setStatus(text("uploadFailed"), "error");
    } finally {
      button.disabled = false;
      setProgress(false);
    }
  }

  async function openDocument(intakeId, button) {
    button.disabled = true;
    try {
      const result = await api(`/v1/maritime/documents/${encodeURIComponent(intakeId)}/download`, { method: "GET" });
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setStatus(text("loadFailed"), "error");
    } finally {
      button.disabled = false;
    }
  }

  async function refreshSmartAccountAfterDocumentChange() {
    try {
      await api("/v1/maritime/smart-account/prepare", { method: "POST", body: JSON.stringify({}) });
      return true;
    } catch (error) {
      return false;
    }
  }

  async function confirmGlobalPassport(button) {
    const pending = (state.remote?.extractions || []).filter(function (row) {
      return row.status === "pending_user_confirmation" && row.extracted_payload;
    });
    if (!pending.length || state.busy) return;
    const updating = hasExistingGlobalPassport();
    state.busy = true;
    button.disabled = true;
    renderSelection();
    setStatus(text("globalPassportConfirming"));
    setProgress(true, text("globalPassportConfirming"), `0 / ${pending.length}`, 5);
    let completed = 0;
    try {
      for (const extraction of pending) {
        await api(`/v1/maritime/document-extractions/${encodeURIComponent(extraction.id)}/confirm`, {
          method: "POST",
          body: JSON.stringify({ payload: extraction.extracted_payload, confirmation: true })
        });
        completed += 1;
        setProgress(true, text("globalPassportConfirming"), `${completed} / ${pending.length}`, Math.round(completed / pending.length * 100));
      }
      const refreshed = await refreshSmartAccountAfterDocumentChange();
      await loadRemote();
      setStatus(text(refreshed ? (updating ? "globalPassportUpdated" : "globalPassportConfirmed") : "smartRefreshFailed"), refreshed ? "success" : "error");
    } catch (error) {
      await loadRemote();
      setStatus(error.message || text("uploadFailed"), "error");
    } finally {
      state.busy = false;
      button.disabled = false;
      setProgress(false);
      renderSelection();
      renderGlobalPassport();
    }
  }

  async function confirmExtraction(form) {
    const extractionId = form.dataset.extractionForm;
    const extraction = (state.remote?.extractions || []).find(function (item) { return item.id === extractionId; });
    if (!extraction) return;
    if (state.busy) return;
    const updating = hasExistingGlobalPassport();
    const submit = form.querySelector('button[type="submit"]');
    state.busy = true;
    submit.disabled = true;
    renderSelection();
    setStatus(text("saving"));
    try {
      const payload = confirmationPayload(form, extraction.extracted_payload || {});
      await api(`/v1/maritime/document-extractions/${encodeURIComponent(extractionId)}/confirm`, { method: "POST", body: JSON.stringify({ payload, confirmation: true }) });
      const refreshed = await refreshSmartAccountAfterDocumentChange();
      await loadRemote();
      setStatus(text(refreshed ? (updating ? "globalPassportUpdated" : "globalPassportConfirmed") : "smartRefreshFailed"), refreshed ? "success" : "error");
    } catch (error) {
      setStatus(error.message || text("uploadFailed"), "error");
    } finally {
      state.busy = false;
      submit.disabled = false;
      renderSelection();
    }
  }

  async function rejectExtraction(extractionId, button) {
    button.disabled = true;
    try {
      await api(`/v1/maritime/document-extractions/${encodeURIComponent(extractionId)}/reject`, { method: "POST", body: JSON.stringify({ reason: "user_rejected_extraction" }) });
      await loadRemote();
      setStatus(text("removed"), "success");
    } catch (error) {
      setStatus(text("uploadFailed"), "error");
    } finally {
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
      uploadAndAnalyze(form).catch(function (error) { state.busy = false; renderSelection(); setProgress(false); setStatus(error.message || text("uploadFailed"), "error"); });
    });
    document.addEventListener("submit", function (event) {
      const reviewForm = event.target.closest("[data-extraction-form]");
      if (!reviewForm) return;
      event.preventDefault();
      confirmExtraction(reviewForm);
    });

    document.addEventListener("click", function (event) {
      const remove = event.target.closest("[data-remove-file]");
      if (remove) { state.files = state.files.filter(function (item) { return item.id !== remove.dataset.removeFile; }); renderSelection(); return; }
      if (event.target.closest("[data-clear-documents]")) { state.files = []; renderSelection(); setStatus(""); return; }
      const globalPassport = event.target.closest("[data-confirm-global-passport]");
      if (globalPassport) { confirmGlobalPassport(globalPassport); return; }
      const open = event.target.closest("[data-open-intake]");
      if (open) { openDocument(open.dataset.openIntake, open); return; }
      const retry = event.target.closest("[data-retry-intake]");
      if (retry) { retryAnalysis(retry.dataset.retryIntake, retry); return; }
      const reject = event.target.closest("[data-reject-extraction]");
      if (reject) rejectExtraction(reject.dataset.rejectExtraction, reject);
    });
  }

  async function initialize(detail) {
    state.session = detail?.session || state.session;
    if (!state.session) return;
    const access = App.auth && App.auth.requireAccountType ? await App.auth.requireAccountType("customer", { user: state.session.user, redirect: true }) : null;
    if (!access) return;
    applyTranslations();
    if (!state.initialized) {
      state.initialized = true;
      bindEvents();
      renderSelection();
    }
    await loadRemote();
  }

  document.addEventListener("allona:maritime-documents-ready", function (event) { initialize(event.detail || {}); });
  document.addEventListener("allona:language-changed", function () { applyTranslations(); renderSelection(); renderRemote(); });
})();
