(function () {
  "use strict";

  const App = window.Allona = window.Allona || {};
  const languageCodes = ["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"];
  const localeCodes = { tr: "tr-TR", az: "az-AZ", kk: "kk-KZ", uz: "uz-UZ", ky: "ky-KG", en: "en-GB", de: "de-DE", ru: "ru-RU", ar: "ar-SA" };
  const state = { session: null, payload: null, busy: false, selected: new Set(), initialized: false, cvOpen: false, autoPrepared: false };

  const copyRows = {
    loading: ["Akıllı hesap yükleniyor", "Ağıllı hesab yüklənir", "Ақылды аккаунт жүктелуде", "Aqlli hisob yuklanmoqda", "Акылдуу аккаунт жүктөлүүдө", "Loading smart account", "Smart-Konto wird geladen", "Умный аккаунт загружается", "جارٍ تحميل الحساب الذكي"],
    smartKicker: ["Tek Tık Akıllı Hazırlık", "Bir toxunuşla ağıllı hazırlıq", "Бір рет басып ақылды дайындау", "Bir bosishda aqlli tayyorlash", "Бир басуу менен акылдуу даярдык", "One-click smart setup", "Intelligente Einrichtung mit einem Klick", "Умная подготовка одним нажатием", "إعداد ذكي بنقرة واحدة"],
    prepareTitle: ["Maritime CV'nizden Global CV oluşturun", "Maritime CV-dən Global CV yaradın", "Maritime CV деректерінен Global CV жасаңыз", "Maritime CV-dan Global CV yarating", "Maritime CV-ден Global CV түзүңүз", "Create Global CV from your Maritime CV", "Global CV aus Ihrem Maritime CV erstellen", "Создайте Global CV из Maritime CV", "أنشئ Global CV من Maritime CV"],
    prepareLead: ["Sistem Maritime CV'nize kaydettiğiniz bilgileri ve fotoğrafı kullanarak uluslararası başvurular için düzenli bir Global CV hazırlar.", "Sistem Maritime CV-də saxladığınız məlumat və foto ilə beynəlxalq müraciətlər üçün səliqəli Global CV hazırlayır.", "Жүйе Maritime CV-де сақталған деректер мен фотоны пайдаланып халықаралық өтінімдерге арналған Global CV дайындайды.", "Tizim Maritime CV-da saqlangan maʼlumot va surat asosida xalqaro arizalar uchun Global CV tayyorlaydi.", "Система Maritime CV-де сакталган маалымат жана сүрөт менен эл аралык арыздар үчүн Global CV даярдайт.", "The system uses the information and photo saved in Maritime CV to prepare an organized Global CV for international applications.", "Das System erstellt aus den im Maritime CV gespeicherten Daten und dem Foto einen geordneten Global CV für internationale Bewerbungen.", "Система использует данные и фотографию из Maritime CV для подготовки Global CV к международным заявкам.", "يستخدم النظام المعلومات والصورة المحفوظة في Maritime CV لإعداد Global CV منظم لطلبات العمل الدولية."],
    prepareButton: ["Global CV'mi Oluştur", "Global CV-mi yarat", "Global CV жасау", "Global CV-ni yaratish", "Global CV түзүү", "Create My Global CV", "Meinen Global CV erstellen", "Создать Global CV", "إنشاء Global CV"],
    refreshButton: ["Maritime CV'den Güncelle", "Maritime CV-dən yenilə", "Maritime CV-ден жаңарту", "Maritime CV-dan yangilash", "Maritime CV-ден жаңыртуу", "Update from Maritime CV", "Aus Maritime CV aktualisieren", "Обновить из Maritime CV", "تحديث من Maritime CV"],
    availableNow: ["Şimdi İşe Hazırım", "İndi işə hazıram", "Қазір жұмысқа дайынмын", "Hozir ishga tayyorman", "Азыр ишке даярмын", "I Am Available Now", "Ich bin jetzt verfügbar", "Я готов к работе сейчас", "أنا متاح للعمل الآن"],
    availableNowDone: ["İşe hazır durumunuz kaydedildi ve eşleşmeler yenilendi.", "İşə hazır vəziyyətiniz saxlanıldı və uyğunluqlar yeniləndi.", "Жұмысқа дайын күйіңіз сақталып, сәйкестіктер жаңартылды.", "Ishga tayyor holatingiz saqlandi va mosliklar yangilandi.", "Ишке даяр абалыңыз сакталды жана дал келүүлөр жаңыртылды.", "Your available-now status was saved and matches were refreshed.", "Ihre sofortige Verfügbarkeit wurde gespeichert und die Abgleiche aktualisiert.", "Готовность к работе сохранена, совпадения обновлены.", "تم حفظ جاهزيتك للعمل الآن وتحديث المطابقات."],
    privacy: ["Yalnız sizin onayladığınız bilgiler kullanılır. Belgeler ve iletişim bilgileriniz firmalara açılmaz.", "Yalnız təsdiqlədiyiniz məlumatlar istifadə olunur. Sənədlər və əlaqə məlumatlarınız şirkətlərə açılmır.", "Тек өзіңіз растаған деректер пайдаланылады. Құжаттар мен байланыс деректері компанияларға ашылмайды.", "Faqat siz tasdiqlagan maʼlumotlar ishlatiladi. Hujjat va aloqa maʼlumotlari kompaniyalarga ochilmaydi.", "Сиз ырастаган маалыматтар гана колдонулат. Документтер жана байланыш маалыматы компанияларга ачылбайт.", "Only information you confirmed is used. Your documents and contact details are not disclosed to companies.", "Es werden nur bestätigte Angaben verwendet. Dokumente und Kontaktdaten werden Unternehmen nicht offengelegt.", "Используются только подтвержденные вами данные. Документы и контакты компаниям не раскрываются.", "لا تُستخدم إلا المعلومات التي أكّدتها، ولا تُكشف مستنداتك أو بيانات اتصالك للشركات."],
    confirmationRule: ["Akıllı profil ve CV siz onaylamadan kesinleşmez. Hiçbir başvuru ayrıca son onayınız olmadan gönderilmez.", "Ağıllı profil və CV siz təsdiqləmədən yekunlaşmır. Heç bir müraciət ayrıca son təsdiqiniz olmadan göndərilmir.", "Ақылды профиль мен CV сіз растамайынша бекітілмейді. Еш өтінім жеке соңғы растаусыз жіберілмейді.", "Aqlli profil va CV siz tasdiqlamaguncha yakunlanmaydi. Hech bir ariza alohida yakuniy tasdiqsiz yuborilmaydi.", "Акылдуу профиль жана CV сиз ырастамайынча бекитилбейт. Эч бир арыз өзүнчө акыркы ырастоосуз жөнөтүлбөйт.", "The smart profile and CV are not finalized without your approval. No application is submitted without a separate final confirmation.", "Smart-Profil und CV werden erst nach Ihrer Freigabe final. Keine Bewerbung wird ohne separate Endbestätigung versendet.", "Умный профиль и CV не утверждаются без вашего согласия. Ни одна заявка не отправляется без отдельного финального подтверждения.", "لا يُعتمد الملف الذكي أو السيرة دون موافقتك، ولا يُرسل أي طلب دون تأكيد نهائي منفصل."],
    readiness: ["Hesap Hazırlığı", "Hesab hazırlığı", "Аккаунт дайындығы", "Hisob tayyorligi", "Аккаунт даярдыгы", "Account Readiness", "Kontobereitschaft", "Готовность аккаунта", "جاهزية الحساب"],
    ready: ["Başvuruya hazır", "Müraciətə hazır", "Өтінімге дайын", "Arizaga tayyor", "Арызга даяр", "Ready to apply", "Bewerbungsbereit", "Готов к подаче", "جاهز للتقديم"],
    needsAttention: ["Tamamlanması gerekenler var", "Tamamlanmalı hissələr var", "Толықтыру қажет", "To‘ldirish kerak", "Толуктоо керек", "Needs attention", "Ergänzungen erforderlich", "Требуется дополнение", "يحتاج إلى استكمال"],
    profileDraft: ["Kontrolünüzü bekliyor", "Yoxlamanızı gözləyir", "Тексеруіңізді күтуде", "Tekshiruvingizni kutmoqda", "Текшерүүңүздү күтөт", "Awaiting your review", "Wartet auf Ihre Prüfung", "Ожидает проверки", "بانتظار مراجعتك"],
    profileConfirmed: ["Sizin tarafınızdan onaylandı", "Sizin tərəfinizdən təsdiqləndi", "Сіз растадыңыз", "Siz tasdiqladingiz", "Сиз ырастагансыз", "Confirmed by you", "Von Ihnen bestätigt", "Подтверждено вами", "مؤكد من قبلك"],
    confirmProfile: ["Akıllı Profil ve CV Doğru, Onayla", "Ağıllı profil və CV doğrudur, təsdiqlə", "Ақылды профиль мен CV дұрыс, растау", "Aqlli profil va CV to‘g‘ri, tasdiqlash", "Акылдуу профиль жана CV туура, ырастоо", "Smart Profile and CV Are Correct, Confirm", "Smart-Profil und CV korrekt, bestätigen", "Умный профиль и CV верны, подтвердить", "الملف الذكي والسيرة صحيحان، تأكيد"],
    profileSummary: ["Akıllı Profil Özeti", "Ağıllı profil xülasəsi", "Ақылды профиль қорытындысы", "Aqlli profil xulosasi", "Акылдуу профиль жыйынтыгы", "Smart Profile Summary", "Smart-Profilübersicht", "Сводка умного профиля", "ملخص الملف الذكي"],
    rank: ["Rütbe", "Rütbə", "Атақ", "Unvon", "Наам", "Rank", "Rang", "Звание", "الرتبة"],
    seaDays: ["Deniz hizmeti", "Dəniz xidməti", "Теңіз қызметі", "Dengiz xizmati", "Деңиз кызматы", "Sea service", "Seefahrtzeit", "Морской стаж", "الخدمة البحرية"],
    days: ["gün", "gün", "күн", "kun", "күн", "days", "Tage", "дней", "يوم"],
    certificates: ["Sertifika", "Sertifikat", "Сертификат", "Sertifikat", "Сертификат", "Certificates", "Zertifikate", "Сертификаты", "الشهادات"],
    languages: ["Dil", "Dil", "Тіл", "Til", "Тил", "Languages", "Sprachen", "Языки", "اللغات"],
    documents: ["Arşiv belgesi", "Arxiv sənədi", "Мұрағат құжаты", "Arxiv hujjati", "Архив документи", "Archived documents", "Archivierte Dokumente", "Архивные документы", "المستندات المحفوظة"],
    missingTitle: ["Tamamlanması Gerekenler", "Tamamlanmalı hissələr", "Толықтырылуы керек", "To‘ldirilishi kerak", "Толукталышы керек", "Items to Complete", "Noch zu ergänzen", "Что нужно дополнить", "عناصر يجب استكمالها"],
    nothingMissing: ["Temel alanlar tamamlandı.", "Əsas sahələr tamamlandı.", "Негізгі өрістер толтырылды.", "Asosiy maydonlar to‘ldirildi.", "Негизги талаалар толукталды.", "Core fields are complete.", "Kernangaben sind vollständig.", "Основные поля заполнены.", "الحقول الأساسية مكتملة."],
    expiryTitle: ["Belge Süre Takibi", "Sənəd müddəti izləmə", "Құжат мерзімін бақылау", "Hujjat muddatini kuzatish", "Документ мөөнөтүн көзөмөлдөө", "Document Expiry Tracking", "Dokumentenfristen", "Контроль сроков документов", "متابعة صلاحية المستندات"],
    noExpiry: ["Yaklaşan veya geçmiş süre bulunmuyor.", "Yaxınlaşan və ya keçmiş müddət yoxdur.", "Жақында аяқталатын не өткен мерзім жоқ.", "Yaqinlashgan yoki o‘tgan muddat yo‘q.", "Жакындаган же өткөн мөөнөт жок.", "No upcoming or expired documents.", "Keine bevorstehenden oder abgelaufenen Fristen.", "Нет приближающихся или истекших сроков.", "لا توجد مستندات قاربت على الانتهاء أو انتهت."],
    expired: ["Süresi doldu", "Müddəti bitib", "Мерзімі өтті", "Muddati tugagan", "Мөөнөтү бүткөн", "Expired", "Abgelaufen", "Истек", "منتهي الصلاحية"],
    remaining: ["kaldı", "qalıb", "қалды", "qoldi", "калды", "remaining", "verbleibend", "осталось", "متبقي"],
    matchesTitle: ["Doğrulanmış İş Eşleşmeleri", "Təsdiqlənmiş iş uyğunluqları", "Тексерілген жұмыс сәйкестіктері", "Tasdiqlangan ish mosliklari", "Текшерилген жумуш дал келүүлөрү", "Verified Job Matches", "Verifizierte Jobabgleiche", "Совпадения с проверенными вакансиями", "مطابقات الوظائف الموثقة"],
    matchesLead: ["Puanın nasıl oluştuğunu görün. Firma kimliği ve iletişim bilgileri başvuru kabul edilene kadar gizli kalır.", "Balın necə yarandığını görün. Şirkət kimliyi və əlaqə məlumatları müraciət qəbul edilənədək gizli qalır.", "Ұпайдың қалай құрылғанын көріңіз. Компания және байланыс деректері өтінім қабылданғанша жасырын.", "Ball qanday shakllanganini ko‘ring. Kompaniya va aloqa maʼlumotlari ariza qabul qilinmaguncha yashirin.", "Упай кантип түзүлгөнүн көрүңүз. Компания жана байланыш маалыматы арыз кабыл алынганга чейин жашыруун.", "See how each score was calculated. Company identity and contact details stay hidden until acceptance.", "Sehen Sie die Punkteberechnung. Unternehmensidentität und Kontakte bleiben bis zur Annahme verborgen.", "Посмотрите расчет балла. Компания и контакты скрыты до принятия заявки.", "اطلع على كيفية احتساب النتيجة. تبقى هوية الشركة وبيانات الاتصال مخفية حتى قبول الطلب."],
    noMatches: ["Şu anda kriterleri tamamlanmış doğrulanmış ilan bulunmuyor. Hesabınız yeni ilanlar için hazır tutulacak.", "Hazırda meyarları tamamlanmış təsdiqli elan yoxdur. Hesabınız yeni elanlara hazır saxlanacaq.", "Қазір талаптары толық тексерілген вакансия жоқ. Аккаунтыңыз жаңа вакансияларға дайын сақталады.", "Hozir mezonlari to‘liq tasdiqlangan eʼlon yo‘q. Hisobingiz yangi eʼlonlarga tayyor turadi.", "Азыр критерийлери толук текшерилген жарыя жок. Аккаунтуңуз жаңы жарыяларга даяр сакталат.", "No verified listing with complete criteria is available right now. Your account will stay ready for new listings.", "Derzeit gibt es keine verifizierte Stelle mit vollständigen Kriterien. Ihr Konto bleibt für neue Stellen bereit.", "Сейчас нет проверенных вакансий с полными критериями. Аккаунт останется готовым к новым вакансиям.", "لا توجد حاليًا وظيفة موثقة بمعايير مكتملة. سيبقى حسابك جاهزًا للوظائف الجديدة."],
    score: ["Uyum", "Uyğunluq", "Сәйкестік", "Moslik", "Дал келүү", "Match", "Übereinstimmung", "Совпадение", "التطابق"],
    eligible: ["Taslak hazırlamaya uygun", "Layihə hazırlamağa uyğundur", "Өтінім жобасына жарамды", "Ariza loyihasiga mos", "Арыз долбооруна ылайыктуу", "Eligible for an application draft", "Für Bewerbungsentwurf geeignet", "Подходит для черновика заявки", "مؤهل لمسودة طلب"],
    notEligible: ["Önce eksikleri tamamlayın", "Əvvəlcə çatışmazlıqları tamamlayın", "Алдымен кемшіліктерді толықтырыңыз", "Avval kamchiliklarni to‘ldiring", "Адегенде кемчиликтерди толуктаңыз", "Complete missing items first", "Fehlende Angaben zuerst ergänzen", "Сначала заполните недостающее", "أكمل النواقص أولًا"],
    select: ["Seç", "Seç", "Таңдау", "Tanlash", "Тандоо", "Select", "Auswählen", "Выбрать", "تحديد"],
    missingRequirement: ["Eksik koşul", "Çatışmayan şərt", "Жетіспейтін талап", "Yetishmayotgan shart", "Жетишпеген шарт", "Missing requirement", "Fehlende Anforderung", "Недостающее требование", "متطلب ناقص"],
    prepareDrafts: ["Seçilen Başvuru Taslaklarını Hazırla", "Seçilmiş müraciət layihələrini hazırla", "Таңдалған өтінім жобаларын дайындау", "Tanlangan ariza loyihalarini tayyorlash", "Тандалган арыз долбоорлорун даярдоо", "Prepare Selected Application Drafts", "Ausgewählte Bewerbungsentwürfe vorbereiten", "Подготовить выбранные черновики заявок", "جهّز مسودات الطلبات المحددة"],
    confirmFirst: ["Önce akıllı profil ve CV özetini onaylayın.", "Əvvəlcə ağıllı profil və CV xülasəsini təsdiqləyin.", "Алдымен ақылды профиль мен CV қорытындысын растаңыз.", "Avval aqlli profil va CV xulosasini tasdiqlang.", "Адегенде акылдуу профиль жана CV жыйынтыгын ырастагыла.", "Confirm the smart profile and CV summary first.", "Bestätigen Sie zuerst Smart-Profil und CV-Übersicht.", "Сначала подтвердите умный профиль и сводку CV.", "أكد الملف الذكي وملخص السيرة أولًا."],
    draftsTitle: ["Hazırlanan Başvuru Taslakları", "Hazırlanmış müraciət layihələri", "Дайын өтінім жобалары", "Tayyorlangan ariza loyihalari", "Даярдалган арыз долбоорлору", "Prepared Application Drafts", "Vorbereitete Bewerbungsentwürfe", "Подготовленные черновики заявок", "مسودات الطلبات الجاهزة"],
    noDrafts: ["Henüz başvuru taslağı hazırlanmadı.", "Hələ müraciət layihəsi hazırlanmayıb.", "Өтінім жобасы әлі дайындалмады.", "Hali ariza loyihasi tayyorlanmagan.", "Азырынча арыз долбоору даярдала элек.", "No application drafts have been prepared yet.", "Noch keine Bewerbungsentwürfe vorbereitet.", "Черновики заявок еще не подготовлены.", "لم تُجهز مسودات طلبات بعد."],
    draftReady: ["Son gönderim onayınızı bekliyor", "Son göndərmə təsdiqinizi gözləyir", "Соңғы жіберу растауын күтуде", "Yakuniy yuborish tasdig‘ini kutmoqda", "Акыркы жөнөтүү ырастооңузду күтөт", "Awaiting your final submission confirmation", "Wartet auf Ihre Versandbestätigung", "Ожидает финального подтверждения отправки", "بانتظار تأكيد الإرسال النهائي"],
    submitApplication: ["Kontrol Ettim, Başvuruyu Gönder", "Yoxladım, müraciəti göndər", "Тексердім, өтінімді жіберу", "Tekshirdim, arizani yuborish", "Текшердим, арызды жөнөтүү", "Reviewed, Submit Application", "Geprüft, Bewerbung absenden", "Проверено, отправить заявку", "راجعت، إرسال الطلب"],
    submitted: ["Başvuru gönderildi", "Müraciət göndərildi", "Өтінім жіберілді", "Ariza yuborildi", "Арыз жөнөтүлдү", "Application submitted", "Bewerbung gesendet", "Заявка отправлена", "تم إرسال الطلب"],
    finalConfirm: ["Bu başvurunun doğrulanmış firmaya gönderilmesini onaylıyor musunuz? Bu işlem yalnız seçtiğiniz başvuruyu gönderir.", "Bu müraciətin təsdiqli şirkətə göndərilməsini təsdiqləyirsiniz? Bu əməliyyat yalnız seçdiyiniz müraciəti göndərir.", "Осы өтінімді тексерілген компанияға жіберуді растайсыз ба? Тек таңдалған өтінім жіберіледі.", "Bu arizani tasdiqlangan kompaniyaga yuborishni tasdiqlaysizmi? Faqat tanlangan ariza yuboriladi.", "Бул арызды текшерилген компанияга жөнөтүүнү ырастайсызбы? Тандалган арыз гана жөнөтүлөт.", "Confirm sending this application to the verified company? Only this selected application will be submitted.", "Diese Bewerbung an das verifizierte Unternehmen senden? Nur diese Bewerbung wird versendet.", "Подтвердить отправку этой заявки проверенной компании? Будет отправлена только выбранная заявка.", "هل تؤكد إرسال هذا الطلب إلى الشركة الموثقة؟ سيُرسل هذا الطلب المحدد فقط."],
    prepareDone: ["Global CV hazırlandı. Bilgileri kontrol edip onaylayın.", "Global CV hazırlandı. Məlumatı yoxlayıb təsdiqləyin.", "Global CV дайын. Деректерді тексеріп растаңыз.", "Global CV tayyor. Maʼlumotni tekshirib tasdiqlang.", "Global CV даяр. Маалыматты текшерип ырастагыла.", "Global CV is ready. Review and confirm the information.", "Global CV ist bereit. Angaben prüfen und bestätigen.", "Global CV готов. Проверьте и подтвердите данные.", "Global CV جاهز. راجع المعلومات وأكدها."],
    confirmDone: ["Akıllı profiliniz ve CV özetiniz onaylandı.", "Ağıllı profiliniz və CV xülasəniz təsdiqləndi.", "Ақылды профиль мен CV қорытындысы расталды.", "Aqlli profil va CV xulosasi tasdiqlandi.", "Акылдуу профиль жана CV жыйынтыгы ырасталды.", "Your smart profile and CV summary were confirmed.", "Smart-Profil und CV-Übersicht wurden bestätigt.", "Умный профиль и сводка CV подтверждены.", "تم تأكيد ملفك الذكي وملخص السيرة."],
    draftsDone: ["Başvuru taslakları hazır. Her ilanı kontrol edip ayrı ayrı gönderebilirsiniz.", "Müraciət layihələri hazırdır. Hər elanı yoxlayıb ayrıca göndərə bilərsiniz.", "Өтінім жобалары дайын. Әр вакансияны тексеріп, бөлек жібере аласыз.", "Ariza loyihalari tayyor. Har bir eʼlonni tekshirib alohida yuboring.", "Арыз долбоорлору даяр. Ар бир жарыяны текшерип өзүнчө жөнөтүңүз.", "Application drafts are ready. Review and submit each listing separately.", "Bewerbungsentwürfe sind bereit. Jede Stelle einzeln prüfen und senden.", "Черновики готовы. Проверьте и отправьте каждую заявку отдельно.", "مسودات الطلبات جاهزة. راجع كل وظيفة وأرسلها بشكل منفصل."],
    requestError: ["İşlem tamamlanamadı. Lütfen tekrar deneyin.", "Əməliyyat tamamlanmadı. Yenidən cəhd edin.", "Әрекет аяқталмады. Қайталап көріңіз.", "Amal tugallanmadi. Qayta urinib ko‘ring.", "Аракет аяктаган жок. Кайра аракет кылыңыз.", "The action could not be completed. Please try again.", "Aktion konnte nicht abgeschlossen werden. Bitte erneut versuchen.", "Не удалось завершить действие. Повторите попытку.", "تعذر إكمال العملية. حاول مرة أخرى."],
    passkeyError: ["Devam etmek için Touch ID, Face ID veya ekran kilidinizle cihazınızı doğrulayın.", "Davam etmək üçün Touch ID, Face ID və ya ekran kilidi ilə cihazınızı təsdiqləyin.", "Жалғастыру үшін құрылғыны Touch ID, Face ID немесе экран құлпы арқылы растаңыз.", "Davom etish uchun qurilmangizni Touch ID, Face ID yoki ekran qulfi bilan tasdiqlang.", "Улантуу үчүн түзмөгүңүздү Touch ID, Face ID же экран кулпусу менен ырастаңыз.", "Verify your device with Touch ID, Face ID or your screen lock to continue.", "Bestätigen Sie Ihr Gerät mit Touch ID, Face ID oder der Bildschirmsperre.", "Для продолжения подтвердите устройство через Touch ID, Face ID или блокировку экрана.", "للمتابعة، تحقّق من جهازك باستخدام Touch ID أو Face ID أو قفل الشاشة."],
    documentRequired: ["Global CV oluşturmak için önce Maritime CV'nizde ad, soyad, doğum tarihi, pozisyon ve fotoğrafınızı kaydedin.", "Global CV yaratmaq üçün əvvəlcə Maritime CV-də ad, soyad, doğum tarixi, vəzifə və fotonu saxlayın.", "Global CV жасау үшін алдымен Maritime CV-де аты-жөніңізді, туған күніңізді, лауазымыңызды және фотоны сақтаңыз.", "Global CV yaratish uchun avval Maritime CV-da ism, familiya, tug‘ilgan sana, lavozim va suratni saqlang.", "Global CV түзүү үчүн адегенде Maritime CV-де аты-жөнүңүздү, туулган күнүңүздү, кызматыңызды жана сүрөттү сактаңыз.", "Before creating Global CV, save your first name, family name, date of birth, position, and photo in Maritime CV.", "Speichern Sie vor der Erstellung von Global CV Vorname, Familienname, Geburtsdatum, Position und Foto im Maritime CV.", "Перед созданием Global CV сохраните в Maritime CV имя, фамилию, дату рождения, должность и фотографию.", "قبل إنشاء Global CV احفظ الاسم واسم العائلة وتاريخ الميلاد والوظيفة والصورة في Maritime CV."],
    uploadDocuments: ["Belgelerim", "Sənədlərim", "Құжаттарым", "Hujjatlarim", "Документтерим", "My Documents", "Meine Dokumente", "Мои документы", "مستنداتي"],
    actionCenter: ["Akıllı İşlem Merkezi", "Ağıllı əməliyyat mərkəzi", "Ақылды әрекет орталығы", "Aqlli amallar markazi", "Акылдуу аракет борбору", "Smart Action Center", "Intelligentes Aktionszentrum", "Центр умных действий", "مركز الإجراءات الذكية"],
    actionCenterLead: ["Hesabınız için sıradaki işleri buradan tek tıkla tamamlayın.", "Hesabınız üçün növbəti işləri buradan bir toxunuşla tamamlayın.", "Аккаунтыңызға қажетті келесі әрекеттерді бір рет басып орындаңыз.", "Hisobingiz uchun keyingi ishlarni shu yerdan bir bosishda bajaring.", "Аккаунтуңуз үчүн кийинки иштерди бул жерден бир басуу менен бүтүрүңүз.", "Complete the next account actions here with one click.", "Erledigen Sie die nächsten Kontoaktionen hier mit einem Klick.", "Выполните следующие действия для аккаунта одним нажатием.", "أكمل إجراءات الحساب التالية من هنا بنقرة واحدة."],
    viewCv: ["Global CV'yi Gör", "Global CV-ni göstər", "Global CV-ді көру", "Global CV-ni ko‘rish", "Global CV-ни көрүү", "View Global CV", "Global CV ansehen", "Посмотреть Global CV", "عرض Global CV"],
    cvActionLead: ["Maritime CV'nizde kaydettiğiniz bilgilerden oluşturulan başvuru CV'nizi kontrol edin.", "Maritime CV-də saxladığınız məlumatdan yaradılan müraciət CV-ni yoxlayın.", "Maritime CV деректерінен жасалған өтінім түйіндемесін тексеріңіз.", "Maritime CV maʼlumotidan yaratilgan ariza CV-ni tekshiring.", "Maritime CV маалыматынан түзүлгөн арыз CV-син текшериңиз.", "Review the application CV created from the information saved in Maritime CV.", "Prüfen Sie den aus Ihrem Maritime CV erstellten Bewerbungslebenslauf.", "Проверьте резюме, созданное из данных Maritime CV.", "راجع سيرة التقديم المنشأة من بيانات Maritime CV."],
    completeDocuments: ["Maritime CV'yi Tamamla", "Maritime CV-ni tamamla", "Maritime CV-ді толықтыру", "Maritime CV-ni to‘ldirish", "Maritime CV-ни толуктоо", "Complete Maritime CV", "Maritime CV vervollständigen", "Заполнить Maritime CV", "استكمال Maritime CV"],
    documentsActionLead: ["Global CV'deki bilgileri değiştirmek için Maritime CV'nizi düzenleyip yeniden kaydedin.", "Global CV məlumatını dəyişmək üçün Maritime CV-ni redaktə edib yenidən saxlayın.", "Global CV деректерін өзгерту үшін Maritime CV-ді өңдеп қайта сақтаңыз.", "Global CV maʼlumotini o‘zgartirish uchun Maritime CV-ni tahrirlab qayta saqlang.", "Global CV маалыматын өзгөртүү үчүн Maritime CV-ни түзөтүп кайра сактаңыз.", "Edit and save Maritime CV again to change the information in Global CV.", "Bearbeiten und speichern Sie Maritime CV erneut, um Angaben im Global CV zu ändern.", "Чтобы изменить Global CV, отредактируйте и снова сохраните Maritime CV.", "لتغيير معلومات Global CV عدّل Maritime CV واحفظه مرة أخرى."],
    prepareAll: ["Tüm Uygun Taslakları Hazırla", "Bütün uyğun layihələri hazırla", "Барлық сәйкес жобаларды дайындау", "Barcha mos loyihalarni tayyorlash", "Бардык ылайыктуу долбоорлорду даярдоо", "Prepare All Eligible Drafts", "Alle geeigneten Entwürfe vorbereiten", "Подготовить все подходящие черновики", "تجهيز كل المسودات المؤهلة"],
    prepareAllLead: ["Uygun ilanlar için taslak hazırlanır; hiçbir başvuru gönderilmez.", "Uyğun elanlar üçün layihə hazırlanır; heç bir müraciət göndərilmir.", "Сәйкес вакансияларға жобалар жасалады; ешбір өтінім жіберілмейді.", "Mos eʼlonlar uchun loyihalar tayyorlanadi; hech bir ariza yuborilmaydi.", "Ылайыктуу жарыяларга долбоор даярдалат; эч бир арыз жөнөтүлбөйт.", "Drafts are prepared for eligible jobs; no application is submitted.", "Für geeignete Stellen werden Entwürfe erstellt; nichts wird versendet.", "Для подходящих вакансий создаются черновики; заявки не отправляются.", "تُجهز مسودات للوظائف المؤهلة دون إرسال أي طلب."],
    noEligible: ["Şu anda taslak hazırlanabilecek yeni uygun ilan yok.", "Hazırda layihə hazırlana bilən yeni uyğun elan yoxdur.", "Қазір жоба жасауға болатын жаңа сәйкес вакансия жоқ.", "Hozir loyiha tayyorlanadigan yangi mos eʼlon yo‘q.", "Азыр долбоор даярдай турган жаңы ылайыктуу жарыя жок.", "There is no new eligible job to prepare right now.", "Derzeit gibt es keine neue geeignete Stelle für einen Entwurf.", "Сейчас нет новых подходящих вакансий для черновика.", "لا توجد حاليًا وظيفة مؤهلة جديدة لإعداد مسودة."],
    cvTitle: ["Global CV", "Global CV", "Global CV", "Global CV", "Global CV", "Global CV", "Global CV", "Global CV", "Global CV"],
    savePdf: ["Global CV PDF İndir", "Global CV PDF endir", "Global CV PDF жүктеу", "Global CV PDF yuklab olish", "Global CV PDF жүктөп алуу", "Download Global CV PDF", "Global CV PDF herunterladen", "Скачать Global CV PDF", "تنزيل Global CV PDF"],
    pdfPaymentFailed: ["15 USD tutarındaki Global CV PDF ödemesi başlatılamadı. Global CV oluşturmak ve güncellemek ücretsiz kalır.", "15 USD məbləğində Global CV PDF ödənişi başladılmadı. Global CV yaratmaq və yeniləmək pulsuz qalır.", "15 USD Global CV PDF төлемі басталмады. Global CV жасау және жаңарту тегін қалады.", "15 USD Global CV PDF to‘lovi boshlanmadi. Global CV yaratish va yangilash bepul qoladi.", "15 USD Global CV PDF төлөмү башталган жок. Global CV түзүү жана жаңыртуу акысыз бойдон калат.", "The $15 Global CV PDF payment could not be started. Creating and updating Global CV remains free.", "Die Zahlung von 15 USD für das Global-CV-PDF konnte nicht gestartet werden. Erstellen und Aktualisieren bleiben kostenlos.", "Не удалось начать оплату Global CV PDF стоимостью 15 USD. Создание и обновление Global CV остаются бесплатными.", "تعذر بدء دفع 15 دولارا لتنزيل Global CV PDF. يظل إنشاء Global CV وتحديثه مجانيا."],
    pdfGenerationFailed: ["PDF hazırlanırken teknik bir hata oluştu. Kayıtlı CV'niz değişmedi.", "PDF hazırlanarkən texniki xəta baş verdi. Saxlanmış CV dəyişməyib.", "PDF дайындауда техникалық қате. Сақталған CV өзгермеді.", "PDF tayyorlashda texnik xato. Saqlangan CV o‘zgarmadi.", "PDF даярдоодо техникалык ката. Сакталган CV өзгөргөн жок.", "A technical error occurred while preparing the PDF. Your saved CV is unchanged.", "Technischer Fehler beim Erstellen des PDFs. Ihr gespeicherter CV bleibt unverändert.", "Техническая ошибка при создании PDF. Сохранённое CV не изменилось.", "حدث خطأ تقني أثناء إعداد PDF. لم تتغير سيرتك المحفوظة."],
    pdfNetworkFailed: ["İndirme servisine ulaşılamadı. Kayıtlı CV'niz değişmedi. Bağlantınızı kontrol edip yeniden deneyin.", "Endirmə xidmətinə qoşulmaq olmadı. Saxlanmış CV dəyişməyib. Bağlantını yoxlayıb yenidən cəhd edin.", "Жүктеу қызметі қолжетімсіз. Сақталған CV өзгермеді. Қосылымды тексеріңіз.", "Yuklab olish xizmatiga ulanib bo‘lmadi. CV o‘zgarmadi. Ulanishni tekshiring.", "Жүктөө кызматына туташуу мүмкүн эмес. CV өзгөргөн жок. Байланышты текшериңиз.", "The download service could not be reached. Your saved CV is unchanged. Check your connection and retry.", "Der Download-Dienst ist nicht erreichbar. Ihr CV bleibt gespeichert. Prüfen Sie die Verbindung.", "Сервис скачивания недоступен. CV сохранено. Проверьте соединение и повторите попытку.", "تعذر الاتصال بخدمة التنزيل. سيرتك محفوظة. تحقق من الاتصال وأعد المحاولة."],
    pdfPaymentUnavailable: ["Ücretli PDF indirme için ödeme bağlantısı henüz etkin değil. CV kaydetme, görüntüleme ve Global CV oluşturma ücretsiz olarak kullanılabilir.", "Ödənişli PDF endirmə üçün ödəniş bağlantısı hələ aktiv deyil. CV saxlamaq, baxmaq və Global CV yaratmaq pulsuzdur.", "Ақылы PDF жүктеу үшін төлем әлі қосылмаған. CV сақтау, көру және Global CV жасау тегін.", "Pullik PDF uchun to‘lov hali yoqilmagan. CV saqlash, ko‘rish va Global CV yaratish bepul.", "Акы төлөнүүчү PDF үчүн төлөм иштей элек. CV сактоо, көрүү жана Global CV түзүү акысыз.", "Paid PDF downloads are not available yet. Saving, viewing and creating Global CV remain free.", "Bezahlte PDF-Downloads sind noch nicht verfügbar. Speichern, Ansehen und Global-CV-Erstellung bleiben kostenlos.", "Оплата скачивания PDF ещё не подключена. Сохранение, просмотр и создание Global CV бесплатны.", "تنزيل PDF المدفوع غير متاح بعد. يظل حفظ السيرة وعرضها وإنشاء Global CV مجانياً."],
    pdfDeviceFailed: ["İndirme için cihaz doğrulaması tamamlanmalı. Maritime CV'yi açıp kaydetme doğrulamasını tamamlayın.", "Endirmə üçün cihaz təsdiqi lazımdır. Maritime CV-də saxlama təsdiqini tamamlayın.", "Жүктеу үшін құрылғыны растаңыз. Maritime CV сақтау растауын аяқтаңыз.", "Yuklash uchun qurilmani tasdiqlang. Maritime CV saqlash tasdiqini yakunlang.", "Жүктөө үчүн түзмөктү ырастаңыз. Maritime CV сактоо ырастоосун бүтүрүңүз.", "Device verification is required for this download. Open Maritime CV and complete the save verification.", "Bestätigen Sie Ihr Gerät über den Speichervorgang in Maritime CV.", "Для скачивания подтвердите устройство при сохранении Maritime CV.", "يلزم التحقق من الجهاز. افتح Maritime CV وأكمل تأكيد الحفظ."],
    pdfSaveRequired: ["PDF indirmeden önce Maritime CV'nizi kaydedin.", "PDF endirmədən əvvəl Maritime CV-ni saxlayın.", "PDF жүктемес бұрын Maritime CV сақтаңыз.", "PDF yuklashdan oldin Maritime CV-ni saqlang.", "PDF жүктөөдөн мурун Maritime CV сактаңыз.", "Save Maritime CV before downloading the PDF.", "Speichern Sie Maritime CV vor dem PDF-Download.", "Сохраните Maritime CV перед скачиванием PDF.", "احفظ Maritime CV قبل تنزيل PDF."],
    pdfPaymentSecurityFailed: ["Güvenli ödeme adresi doğrulanamadı. İndirme durduruldu.", "Təhlükəsiz ödəniş ünvanı təsdiqlənmədi. Endirmə dayandırıldı.", "Төлем мекенжайы расталмады. Жүктеу тоқтатылды.", "To‘lov manzili tasdiqlanmadi. Yuklash to‘xtatildi.", "Төлөм дареги ырасталган жок. Жүктөө токтотулду.", "The secure payment address could not be verified. Download stopped.", "Die sichere Zahlungsadresse konnte nicht bestätigt werden. Download gestoppt.", "Безопасный адрес оплаты не подтверждён. Скачивание остановлено.", "تعذر التحقق من عنوان الدفع الآمن. تم إيقاف التنزيل."],
    pdfLoginRequired: ["Global CV PDF indirmek için giriş yapın.", "Global CV PDF endirmək üçün daxil olun.", "Global CV PDF жүктеу үшін жүйеге кіріңіз.", "Global CV PDF yuklab olish uchun tizimga kiring.", "Global CV PDF жүктөп алуу үчүн кириңиз.", "Sign in to download the Global CV PDF.", "Melden Sie sich an, um das Global-CV-PDF herunterzuladen.", "Войдите, чтобы скачать Global CV PDF.", "سجل الدخول لتنزيل Global CV PDF."],
    close: ["Kapat", "Bağla", "Жабу", "Yopish", "Жабуу", "Close", "Schließen", "Закрыть", "إغلاق"],
    personalDetails: ["Kişisel Bilgiler", "Şəxsi məlumatlar", "Жеке мәліметтер", "Shaxsiy maʼlumotlar", "Жеке маалыматтар", "Personal Details", "Persönliche Angaben", "Личные данные", "البيانات الشخصية"],
    nationality: ["Uyruk", "Vətəndaşlıq", "Азаматтық", "Fuqarolik", "Жарандык", "Nationality", "Staatsangehörigkeit", "Гражданство", "الجنسية"],
    birthDate: ["Doğum tarihi", "Doğum tarixi", "Туған күні", "Tug‘ilgan sana", "Туулган күнү", "Date of birth", "Geburtsdatum", "Дата рождения", "تاريخ الميلاد"],
    endorsementsTitle: ["Yetki ve Onaylar", "Səlahiyyət və təsdiqlər", "Өкілеттіктер мен растамалар", "Vakolat va tasdiqlar", "Укуктар жана ырастоолор", "Endorsements", "Befähigungsvermerke", "Подтверждения квалификации", "التأييدات والصلاحيات"],
    restrictionsTitle: ["Kısıtlamalar", "Məhdudiyyətlər", "Шектеулер", "Cheklovlar", "Чектөөлөр", "Restrictions", "Einschränkungen", "Ограничения", "القيود"],
    serviceHistory: ["Deniz Hizmeti Geçmişi", "Dəniz xidməti tarixçəsi", "Теңіз қызметінің тарихы", "Dengiz xizmati tarixi", "Деңиз кызматынын тарыхы", "Sea Service History", "Seefahrtverlauf", "История морской службы", "سجل الخدمة البحرية"],
    vessel: ["Gemi", "Gəmi", "Кеме", "Kema", "Кеме", "Vessel", "Schiff", "Судно", "السفينة"],
    present: ["Devam ediyor", "Davam edir", "Жалғасуда", "Davom etmoqda", "Уланууда", "Present", "Aktuell", "По настоящее время", "مستمر"],
    sourceNote: ["Bu Global CV, Maritime CV'nizde kendi onayınızla kaydettiğiniz bilgilerden oluşturulmuştur.", "Bu Global CV Maritime CV-də öz təsdiqinizlə saxladığınız məlumatdan yaradılıb.", "Бұл Global CV Maritime CV-де өзіңіз растаған деректерден жасалды.", "Bu Global CV Maritime CV-da o‘zingiz tasdiqlab saqlagan maʼlumotdan yaratildi.", "Бул Global CV Maritime CV-де өзүңүз ырастап сактаган маалыматтан түзүлдү.", "This Global CV was created from information you saved and approved in Maritime CV.", "Dieser Global CV wurde aus den von Ihnen im Maritime CV gespeicherten und bestätigten Angaben erstellt.", "Этот Global CV создан из данных, сохраненных и подтвержденных вами в Maritime CV.", "تم إنشاء Global CV من المعلومات التي حفظتها واعتمدتها في Maritime CV."],
    cvProfileLabel: ["AllonaHub Denizci Profili", "AllonaHub Dənizçi Profili", "AllonaHub Теңізші Профилі", "AllonaHub Dengizchi Profili", "AllonaHub Деңизчи Профили", "AllonaHub Seafarer Profile", "AllonaHub Seefahrerprofil", "Профиль моряка AllonaHub", "ملف البحار في AllonaHub"],
    cvIdentity: ["Kimlik ve Uygunluk", "Şəxsiyyət və uyğunluq", "Жеке деректер және жарамдылық", "Shaxs va yaroqlilik", "Жеке маалымат жана жарактуулук", "Identity and Fitness", "Identität und Tauglichkeit", "Личные данные и пригодность", "الهوية واللياقة"],
    cvCredentialLedger: ["Otomatik Yeterlilik Kayıtları", "Avtomatik səriştə qeydləri", "Автоматты біліктілік жазбалары", "Avtomatik malaka qaydlari", "Автоматтык квалификация жазуулары", "Automatic Credential Records", "Automatische Befähigungsnachweise", "Автоматические записи квалификаций", "سجلات المؤهلات التلقائية"],
    cvCredentialLead: ["Kodlar, numaralar ve tarihler kaydettiğiniz Maritime CV bilgilerinden alınır.", "Kodlar, nömrələr və tarixlər saxladığınız Maritime CV məlumatlarından alınır.", "Кодтар, нөмірлер және күндер сақталған Maritime CV деректерінен алынады.", "Kodlar, raqamlar va sanalar saqlangan Maritime CV maʼlumotlaridan olinadi.", "Коддор, номерлер жана даталар сакталган Maritime CV маалыматтарынан алынат.", "Codes, numbers, and dates come from your saved Maritime CV.", "Codes, Nummern und Daten stammen aus Ihrem gespeicherten Maritime CV.", "Коды, номера и даты берутся из сохранённого Maritime CV.", "تُؤخذ الرموز والأرقام والتواريخ من Maritime CV المحفوظ."],
    cvAutoRead: ["Maritime CV'den", "Maritime CV-dən", "Maritime CV-ден", "Maritime CV-dan", "Maritime CV-ден", "From Maritime CV", "Aus dem Maritime CV", "Из Maritime CV", "من Maritime CV"],
    cvDocumentNumber: ["Belge no", "Sənəd no", "Құжат №", "Hujjat raqami", "Документ №", "Document no.", "Dokument-Nr.", "Номер документа", "رقم المستند"],
    certificateSerial: ["Sertifika seri no", "Sertifikat seriya no", "Сертификат сериясы №", "Sertifikat seriya raqami", "Сертификаттын сериясы №", "Certificate serial", "Zertifikatsseriennummer", "Серийный номер сертификата", "الرقم التسلسلي للشهادة"],
    endorsementNumber: ["Endorsement no", "Təsdiq nömrəsi", "Растау нөмірі", "Tasdiq raqami", "Ырастоо номери", "Endorsement no.", "Endorsement-Nr.", "Номер подтверждения", "رقم التصديق"],
    approvalAuthority: ["Onay makamı", "Təsdiq orqanı", "Бекіткен орган", "Tasdiqlovchi organ", "Ырастоочу орган", "Approval authority", "Genehmigungsbehörde", "Орган утверждения", "جهة الاعتماد"],
    approvalReference: ["Onay / karar referansı", "Təsdiq / qərar istinadı", "Бекіту / шешім сілтемесі", "Tasdiq / qaror havolasi", "Ырастоо / чечим шилтемеси", "Approval / resolution reference", "Genehmigungs- / Beschlussreferenz", "Ссылка на утверждение / решение", "مرجع الاعتماد / القرار"],
    coursePeriod: ["Eğitim dönemi", "Təlim dövrü", "Оқу кезеңі", "Taʼlim davri", "Окуу мөөнөтү", "Training period", "Ausbildungszeitraum", "Период обучения", "فترة التدريب"],
    cvIssuingAuthority: ["Düzenleyen", "Verən qurum", "Берген мекеме", "Bergan tashkilot", "Берген мекеме", "Issued by", "Ausgestellt von", "Кем выдан", "الجهة المصدرة"],
    cvIssueDate: ["Düzenleme", "Verilmə", "Берілген күні", "Berilgan sana", "Берилген күнү", "Issued", "Ausgestellt", "Выдан", "تاريخ الإصدار"],
    cvExpiryDate: ["Geçerlilik", "Etibarlılıq", "Жарамдылық", "Amal qilish", "Жарактуулук", "Valid until", "Gültig bis", "Действителен до", "صالح حتى"],
    cvLanguages: ["Dil Yetkinliği", "Dil bacarıqları", "Тіл дағдылары", "Til ko‘nikmalari", "Тил жөндөмдөрү", "Language Skills", "Sprachkenntnisse", "Языковые навыки", "المهارات اللغوية"],
    cvProfessionalDetails: ["Mesleki Detaylar", "Peşəkar məlumatlar", "Кәсіби мәліметтер", "Kasbiy maʼlumotlar", "Кесиптик маалыматтар", "Professional Details", "Berufliche Angaben", "Профессиональные сведения", "البيانات المهنية"],
    fit: ["Uygun", "Uyğundur", "Жарамды", "Yaroqli", "Жарактуу", "Fit", "Tauglich", "Годен", "لائق"],
    fitWithRestrictions: ["Kısıtlı uygun", "Məhdudiyyətlə uyğundur", "Шектеумен жарамды", "Cheklov bilan yaroqli", "Чектөө менен жарактуу", "Fit with restrictions", "Tauglich mit Einschränkungen", "Годен с ограничениями", "لائق مع قيود"],
    unfit: ["Uygun değil", "Uyğun deyil", "Жарамсыз", "Yaroqsiz", "Жараксыз", "Unfit", "Nicht tauglich", "Не годен", "غير لائق"],
    notStated: ["Belirtilmemiş", "Göstərilməyib", "Көрсетілмеген", "Ko‘rsatilmagan", "Көрсөтүлгөн эмес", "Not stated", "Nicht angegeben", "Не указано", "غير مذكور"]
  };

  Object.assign(copyRows, {
    cvProfessionalSummary: ["Mesleki Özet", "Peşəkar xülasə", "Кәсіби қорытынды", "Kasbiy xulosa", "Кесиптик жыйынтык", "Professional Summary", "Berufliches Profil", "Профессиональное резюме", "الملخص المهني"],
    cvCompetencies: ["Belgeyle Doğrulanmış Yetkinlikler", "Sənədlə təsdiqlənmiş səriştələr", "Құжатпен расталған құзыреттер", "Hujjat bilan tasdiqlangan vakolatlar", "Документ менен ырасталган компетенциялар", "Document-Verified Competencies", "Dokumentengeprüfte Kompetenzen", "Компетенции, подтвержденные документами", "الكفاءات المثبتة بالمستندات"],
    cvCompetencyLead: ["Bu alan yalnız yeterlilik ve eğitim belgelerinden doğrulanabilen mesleki güçlü yönleri gösterir.", "Bu bölmə yalnız ixtisas və təlim sənədləri ilə təsdiqlənən peşəkar güclü tərəfləri göstərir.", "Бұл бөлімде тек біліктілік және оқу құжаттарымен расталған кәсіби күшті жақтар көрсетіледі.", "Bu bo‘lim faqat malaka va taʼlim hujjatlari bilan tasdiqlangan kasbiy kuchli tomonlarni ko‘rsatadi.", "Бул бөлүм квалификация жана окуу документтери менен ырасталган кесиптик күчтүү жактарды гана көрсөтөт.", "This section shows only professional strengths supported by competency and training documents.", "Dieser Abschnitt zeigt nur durch Befähigungs- und Ausbildungsnachweise belegte berufliche Stärken.", "В этом разделе указаны только профессиональные сильные стороны, подтвержденные квалификационными и учебными документами.", "يعرض هذا القسم نقاط القوة المهنية المثبتة فقط بوثائق الكفاءة والتدريب."],
    cvSkills: ["Ek Mesleki ve Teknik Beceriler", "Əlavə peşəkar və texniki bacarıqlar", "Қосымша кәсіби және техникалық дағдылар", "Qo‘shimcha kasbiy va texnik ko‘nikmalar", "Кошумча кесиптик жана техникалык көндүмдөр", "Additional Professional and Technical Skills", "Zusätzliche berufliche und technische Fähigkeiten", "Дополнительные профессиональные и технические навыки", "المهارات المهنية والتقنية الإضافية"],
    cvAchievements: ["Başarılar ve Takdirler", "Nailiyyətlər və təltiflər", "Жетістіктер мен марапаттар", "Yutuqlar va eʼtiroflar", "Жетишкендиктер жана сыйлыктар", "Achievements and Recognition", "Erfolge und Auszeichnungen", "Достижения и награды", "الإنجازات والتقدير"],
    cvExperienceOverview: ["Tecrübe Özeti", "Təcrübə xülasəsi", "Тәжірибе қорытындысы", "Tajriba xulosasi", "Тажрыйба жыйынтыгы", "Experience Overview", "Erfahrungsübersicht", "Обзор опыта", "ملخص الخبرة"],
    cvSeaServicePending: ["Maritime CV'nize gemi adı, şirket, bayrak, görev, tarihler, tonaj ve makine bilgilerini eklediğinizde deniz hizmetiniz burada görünür.", "Maritime CV-yə gəmi adı, şirkət, bayraq, vəzifə, tarixlər, tonaj və mühərrik məlumatlarını əlavə etdikdə dəniz xidmətiniz burada görünür.", "Maritime CV-ге кеме, компания, ту, қызмет, күндер, тоннаж және қозғалтқыш деректерін қосқанда теңіз өтілі осында көрінеді.", "Maritime CV-ga kema, kompaniya, bayroq, lavozim, sanalar, tonnaj va dvigatel maʼlumotlarini qo‘shganingizda dengiz xizmatingiz shu yerda ko‘rinadi.", "Maritime CV-ге кеме, компания, желек, кызмат, даталар, тоннаж жана кыймылдаткыч маалыматтарын кошкондо деңиз кызматыңыз бул жерде көрүнөт.", "Your sea service appears here after you add vessel, company, flag, rank, dates, tonnage, and engine details to Maritime CV.", "Ihre Seefahrtzeit erscheint hier, sobald Sie Schiff, Unternehmen, Flagge, Funktion, Zeiten, Tonnage und Maschinendaten im Maritime CV ergänzen.", "Морской стаж появится здесь после добавления в Maritime CV судна, компании, флага, должности, дат, тоннажа и двигателя.", "تظهر خدمتك البحرية هنا بعد إضافة السفينة والشركة والعلم والوظيفة والتواريخ والحمولة والمحرك إلى Maritime CV."],
    cvContact: ["İletişim", "Əlaqə", "Байланыс", "Aloqa", "Байланыш", "Contact", "Kontakt", "Контакты", "التواصل"],
    cvPhysical: ["Fiziksel Bilgiler", "Fiziki məlumatlar", "Дене деректері", "Jismoniy maʼlumotlar", "Физикалык маалымат", "Physical Details", "Körperdaten", "Физические данные", "البيانات الجسدية"],
    cvDocumentsTitle: ["Kimlik ve Seyahat Belgeleri", "Şəxsiyyət və səyahət sənədləri", "Жеке және жол жүру құжаттары", "Shaxsiy va safar hujjatlari", "Жеке жана саякат документтери", "Identity and Travel Documents", "Identitäts- und Reisedokumente", "Удостоверения и проездные документы", "وثائق الهوية والسفر"],
    nationalId: ["Kimlik belgesi", "Şəxsiyyət vəsiqəsi", "Жеке куәлік", "Shaxsni tasdiqlovchi hujjat", "Жеке күбөлүк", "National identity document", "Nationaler Ausweis", "Удостоверение личности", "وثيقة الهوية الوطنية"],
    seamanRecordBook: ["Gemiadamı hizmet defteri", "Dənizçi xidmət kitabçası", "Теңізші қызмет кітапшасы", "Dengizchi xizmat daftari", "Деңизчи кызмат китепчеси", "Seaman's record book", "Seefahrtsdienstbuch", "Книжка учета морской службы", "سجل خدمة البحار"],
    visa: ["Vize", "Viza", "Виза", "Viza", "Виза", "Visa", "Visum", "Виза", "التأشيرة"],
    cvEducation: ["Eğitim", "Təhsil", "Білім", "Taʼlim", "Билим", "Education", "Ausbildung", "Образование", "التعليم"],
    cvMedical: ["Sağlık Kayıtları", "Tibbi qeydlər", "Медициналық жазбалар", "Tibbiy yozuvlar", "Медициналык жазуулар", "Medical Records", "Medizinische Nachweise", "Медицинские записи", "السجلات الطبية"],
    cvVaccinations: ["Aşı Kayıtları", "Peyvənd qeydləri", "Вакцина жазбалары", "Emlash yozuvlari", "Эмдөө жазуулары", "Vaccination Records", "Impfnachweise", "Записи о вакцинации", "سجلات التطعيم"],
    cvReferences: ["Referanslar", "Referanslar", "Ұсынымдар", "Tavsiyalar", "Сунуштар", "References", "Referenzen", "Рекомендации", "المراجع"],
    familyName: ["Soyadı", "Soyadı", "Тегі", "Familiya", "Фамилиясы", "Family name", "Nachname", "Фамилия", "اسم العائلة"],
    givenNames: ["Adı / adları", "Adı / adları", "Аты-жөні", "Ismi / ismlari", "Аты / аттары", "Given name(s)", "Vorname(n)", "Имя / имена", "الاسم / الأسماء"],
    birthPlace: ["Doğum yeri", "Doğum yeri", "Туған жері", "Tug‘ilgan joy", "Туулган жери", "Place of birth", "Geburtsort", "Место рождения", "مكان الميلاد"],
    gender: ["Cinsiyet", "Cins", "Жынысы", "Jinsi", "Жынысы", "Gender", "Geschlecht", "Пол", "الجنس"],
    maritalStatus: ["Medeni durum", "Ailə vəziyyəti", "Отбасылық жағдайы", "Oilaviy holat", "Үй-бүлөлүк абалы", "Marital status", "Familienstand", "Семейное положение", "الحالة الاجتماعية"],
    email: ["E-posta", "E-poçt", "Эл. пошта", "E-pochta", "Эл. почта", "Email", "E-Mail", "Эл. почта", "البريد الإلكتروني"],
    phone: ["Telefon", "Telefon", "Телефон", "Telefon", "Телефон", "Phone", "Telefon", "Телефон", "الهاتف"],
    secondPhone: ["İkinci telefon", "İkinci telefon", "Қосымша телефон", "Ikkinchi telefon", "Экинчи телефон", "Secondary phone", "Zweites Telefon", "Дополнительный телефон", "هاتف إضافي"],
    address: ["İkamet adresi", "Yaşayış ünvanı", "Тұрақты мекенжай", "Doimiy manzil", "Туруктуу дарек", "Permanent address", "Wohnadresse", "Постоянный адрес", "العنوان الدائم"],
    airport: ["En yakın havalimanı", "Ən yaxın hava limanı", "Ең жақын әуежай", "Eng yaqin aeroport", "Эң жакын аэропорт", "Nearest airport", "Nächster Flughafen", "Ближайший аэропорт", "أقرب مطار"],
    height: ["Boy", "Boy", "Бойы", "Bo‘yi", "Бою", "Height", "Größe", "Рост", "الطول"],
    weight: ["Kilo", "Çəki", "Салмағы", "Vazn", "Салмак", "Weight", "Gewicht", "Вес", "الوزن"],
    eyeColour: ["Göz rengi", "Göz rəngi", "Көз түсі", "Ko‘z rangi", "Көздүн түсү", "Eye colour", "Augenfarbe", "Цвет глаз", "لون العينين"],
    hairColour: ["Saç rengi", "Saç rəngi", "Шаш түсі", "Soch rangi", "Чачтын түсү", "Hair colour", "Haarfarbe", "Цвет волос", "لون الشعر"],
    shoeSize: ["Ayakkabı no", "Ayaqqabı ölçüsü", "Аяқ киім өлшемі", "Poyabzal o‘lchami", "Бут кийим өлчөмү", "Shoe size", "Schuhgröße", "Размер обуви", "مقاس الحذاء"],
    overallSize: ["Tulum bedeni", "Kombinezon ölçüsü", "Комбинезон өлшемі", "Kombinezon o‘lchami", "Комбинезон өлчөмү", "Overall size", "Overall-Größe", "Размер спецодежды", "مقاس البدلة"],
    issuingCountry: ["Düzenleyen ülke", "Verən ölkə", "Берген ел", "Bergan davlat", "Берген өлкө", "Issuing country", "Ausstellungsland", "Страна выдачи", "بلد الإصدار"],
    issuePlace: ["Düzenleme yeri", "Verilmə yeri", "Берілген жер", "Berilgan joy", "Берилген жер", "Place of issue", "Ausstellungsort", "Место выдачи", "مكان الإصدار"],
    noExpiry: ["Süresiz", "Müddətsiz", "Мерзімсіз", "Muddatsiz", "Мөөнөтсүз", "No expiry", "Unbefristet", "Бессрочно", "بلا انتهاء"],
    stcwReferences: ["STCW referansları", "STCW istinadları", "STCW сілтемелері", "STCW havolalari", "STCW шилтемелери", "STCW references", "STCW-Referenzen", "Ссылки STCW", "مراجع STCW"],
    qualification: ["Yeterlilik", "Səriştə", "Біліктілік", "Malaka", "Квалификация", "Qualification", "Qualifikation", "Квалификация", "المؤهل"],
    fieldOfStudy: ["Bölüm", "İxtisas", "Мамандығы", "Yo‘nalish", "Адистик", "Field of study", "Fachrichtung", "Специальность", "التخصص"],
    medicalResult: ["Sonuç", "Nəticə", "Нәтиже", "Natija", "Натыйжа", "Result", "Ergebnis", "Результат", "النتيجة"],
    dose: ["Doz", "Doza", "Доза", "Doza", "Доза", "Dose", "Dosis", "Доза", "الجرعة"],
    desiredSalary: ["Talep edilen ücret", "İstənilən əmək haqqı", "Қалаған жалақы", "Kutilayotgan ish haqi", "Каалаган эмгек акы", "Desired salary", "Gehaltswunsch", "Желаемая зарплата", "الراتب المطلوب"],
    availability: ["Göreve başlama durumu", "İşə başlama vəziyyəti", "Жұмысқа шығу мүмкіндігі", "Ish boshlash holati", "Ишке чыгуу абалы", "Availability", "Verfügbarkeit", "Готовность к выходу", "الجاهزية للعمل"],
    company: ["Şirket", "Şirkət", "Компания", "Kompaniya", "Компания", "Company", "Unternehmen", "Компания", "الشركة"],
    flag: ["Bayrak", "Bayraq", "Ту", "Bayroq", "Желек", "Flag", "Flagge", "Флаг", "العلم"],
    vesselType: ["Gemi tipi", "Gəmi növü", "Кеме түрі", "Kema turi", "Кеме түрү", "Vessel type", "Schiffstyp", "Тип судна", "نوع السفينة"],
    grt: ["GRT", "GRT", "GRT", "GRT", "GRT", "GRT", "BRZ", "GRT", "GRT"],
    dwt: ["DWT", "DWT", "DWT", "DWT", "DWT", "DWT", "DWT", "DWT", "DWT"],
    netTonnage: ["Net tonaj", "Net tonaj", "Таза тоннаж", "Sof tonnaj", "Таза тоннаж", "Net tonnage", "Nettoraumzahl", "Чистый тоннаж", "الحمولة الصافية"],
    mmsi: ["MMSI", "MMSI", "MMSI", "MMSI", "MMSI", "MMSI", "MMSI", "MMSI", "MMSI"],
    callSign: ["Çağrı işareti", "Çağırış işarəsi", "Шақыру белгісі", "Chaqiruv belgisi", "Чакыруу белгиси", "Call sign", "Rufzeichen", "Позывной", "إشارة النداء"],
    buildYear: ["İnşa yılı", "İnşa ili", "Жасалған жылы", "Qurilgan yil", "Курулган жылы", "Year built", "Baujahr", "Год постройки", "سنة البناء"],
    lengthOverall: ["Tam boy", "Ümumi uzunluq", "Жалпы ұзындық", "Umumiy uzunlik", "Жалпы узундук", "Length overall", "Länge über alles", "Наибольшая длина", "الطول الكلي"],
    referenceName: ["Yetkili / referans kişi", "Səlahiyyətli / referans şəxs", "Уәкілетті / ұсыным беруші", "Vakil / tavsiya beruvchi", "Ыйгарым укуктуу / сунуштоочу", "Authorized / reference person", "Bevollmächtigte Referenzperson", "Представитель / рекомендатель", "المخول / الشخص المرجعي"],
    companyPhone: ["Şirket telefonu", "Şirkət telefonu", "Компания телефоны", "Kompaniya telefoni", "Компания телефону", "Company phone", "Unternehmenstelefon", "Телефон компании", "هاتف الشركة"],
    engine: ["Ana makine", "Baş mühərrik", "Негізгі қозғалтқыш", "Asosiy dvigatel", "Негизги кыймылдаткыч", "Main engine", "Hauptmaschine", "Главный двигатель", "المحرك الرئيسي"],
    period: ["Hizmet dönemi", "Xidmət dövrü", "Қызмет мерзімі", "Xizmat davri", "Кызмат мөөнөтү", "Service period", "Dienstzeit", "Период службы", "فترة الخدمة"],
    serviceRecords: ["Hizmet kaydı", "Xidmət qeydi", "Қызмет жазбасы", "Xizmat qaydi", "Кызмат жазуусу", "Service records", "Dienstnachweise", "Записи службы", "سجلات الخدمة"],
    verifiedDays: ["Doğrulanmış gün", "Təsdiqlənmiş gün", "Расталған күн", "Tasdiqlangan kun", "Ырасталган күн", "Verified days", "Bestätigte Tage", "Подтвержденные дни", "الأيام الموثقة"],
    employerCvPrivacy: ["Acil durum kişisi bu CV'de gösterilmez. İletişim ve kimlik ayrıntıları yalnız izin verilen işe alım aşamasında paylaşılır.", "Təcili əlaqə şəxsi bu CV-də göstərilmir. Əlaqə və şəxsiyyət təfərrüatları yalnız icazə verilən işə qəbul mərhələsində paylaşılır.", "Төтенше байланыс бұл CV-де көрсетілмейді. Байланыс және жеке деректер тек рұқсат етілген жұмысқа алу кезеңінде беріледі.", "Favqulodda aloqa bu CV da ko‘rsatilmaydi. Aloqa va shaxsiy maʼlumotlar faqat ruxsat etilgan yollash bosqichida beriladi.", "Шашылыш байланыш бул CVде көрсөтүлбөйт. Байланыш жана жеке маалымат уруксат берилген жалдоо этабында гана бөлүшүлөт.", "Emergency contacts are excluded. Contact and identity details are shared only at the permitted hiring stage.", "Notfallkontakte sind ausgeschlossen. Kontakt- und Identitätsdaten werden nur in der freigegebenen Einstellungsphase geteilt.", "Экстренные контакты исключены. Контактные и идентификационные данные раскрываются только на разрешенном этапе найма.", "تُستبعد جهات اتصال الطوارئ، ولا تُشارك بيانات الاتصال والهوية إلا في مرحلة التوظيف المسموح بها."]
  });

  const missingLabels = {
    identity: ["Kimlik bilgileri", "Şəxsiyyət məlumatları", "Жеке деректер", "Shaxsiy maʼlumotlar", "Жеке маалымат", "Identity details", "Identitätsangaben", "Личные данные", "بيانات الهوية"],
    rank: ["Rütbe / yeterlilik", "Rütbə / səriştə", "Атақ / біліктілік", "Unvon / malaka", "Наам / квалификация", "Rank / competency", "Rang / Befähigung", "Звание / квалификация", "الرتبة / الكفاءة"],
    certificates: ["Sertifikalar", "Sertifikatlar", "Сертификаттар", "Sertifikatlar", "Сертификаттар", "Certificates", "Zertifikate", "Сертификаты", "الشهادات"],
    certificate: ["Sertifika", "Sertifikat", "Сертификат", "Sertifikat", "Сертификат", "Certificate", "Zertifikat", "Сертификат", "شهادة"],
    sea_service: ["Deniz hizmeti", "Dəniz xidməti", "Теңіз қызметі", "Dengiz xizmati", "Деңиз кызматы", "Sea service", "Seefahrtzeit", "Морской стаж", "الخدمة البحرية"],
    medical: ["Sağlık uygunluğu", "Tibbi uyğunluq", "Медициналық жарамдылық", "Tibbiy yaroqlilik", "Медициналык жарактуулук", "Medical fitness", "Medizinische Tauglichkeit", "Медицинская годность", "اللياقة الطبية"],
    passport: ["Pasaport", "Pasport", "Паспорт", "Pasport", "Паспорт", "Passport", "Reisepass", "Паспорт", "جواز السفر"],
    seaman_book: ["Gemiadamı cüzdanı", "Dənizçi kitabçası", "Теңізші кітапшасы", "Dengizchi daftarchasi", "Деңизчи китепчеси", "Seafarer's book", "Seefahrtsbuch", "Мореходная книжка", "دفتر البحار"],
    languages: ["Dil bilgileri", "Dil bilikləri", "Тіл білімі", "Til bilimi", "Тил билүү", "Language skills", "Sprachkenntnisse", "Знание языков", "المهارات اللغوية"],
    language: ["Dil", "Dil", "Тіл", "Til", "Тил", "Language", "Sprache", "Язык", "اللغة"],
    sea_service_days: ["Eksik deniz hizmeti günü", "Çatışmayan dəniz xidməti günü", "Жетіспейтін теңіз қызметі күні", "Yetishmayotgan dengiz xizmati kuni", "Жетишпеген деңиз кызматы күнү", "Missing sea-service days", "Fehlende Seefahrtstage", "Недостающие дни стажа", "أيام الخدمة البحرية الناقصة"],
    medical: ["Sağlık uygunluğu", "Tibbi uyğunluq", "Медициналық жарамдылық", "Tibbiy yaroqlilik", "Медициналык жарактуулук", "Medical fitness", "Medizinische Tauglichkeit", "Медицинская годность", "اللياقة الطبية"],
    availability: ["İşe başlama uygunluğu", "İşə başlama uyğunluğu", "Жұмысқа шығу дайындығы", "Ish boshlash imkoniyati", "Ишке чыгуу даярдыгы", "Availability", "Verfügbarkeit", "Готовность к работе", "التوفر للعمل"],
    job_requirements_incomplete: ["İlan koşulları firma tarafından tamamlanmalı", "Elan şərtləri şirkət tərəfindən tamamlanmalıdır", "Вакансия талаптарын компания толықтыруы керек", "Eʼlon shartlarini kompaniya to‘ldirishi kerak", "Жарыя шарттарын компания толукташы керек", "The company must complete the job requirements", "Das Unternehmen muss die Stellenanforderungen vervollständigen", "Компания должна дополнить требования вакансии", "يجب على الشركة استكمال متطلبات الوظيفة"]
  };

  const rankLabels = {
    master: ["Kaptan", "Kapitan", "Капитан", "Kapitan", "Капитан", "Master", "Kapitän", "Капитан", "الربان"],
    chief_officer: ["Birinci Zabit", "Baş köməkçi", "Аға көмекші", "Bosh yordamchi", "Башкы жардамчы", "Chief Officer", "Erster Offizier", "Старший помощник", "كبير الضباط"],
    second_officer: ["İkinci Zabit", "İkinci köməkçi", "Екінші көмекші", "Ikkinchi yordamchi", "Экинчи жардамчы", "Second Officer", "Zweiter Offizier", "Второй помощник", "الضابط الثاني"],
    third_officer: ["Üçüncü Zabit", "Üçüncü köməkçi", "Үшінші көмекші", "Uchinchi yordamchi", "Үчүнчү жардамчы", "Third Officer", "Dritter Offizier", "Третий помощник", "الضابط الثالث"],
    deck_cadet: ["Güverte Stajyeri", "Göyərtə kursantı", "Палуба курсанты", "Paluba kursanti", "Палуба курсанты", "Deck Cadet", "Deckskadett", "Палубный кадет", "متدرب سطح"],
    chief_engineer: ["Başmühendis", "Baş mühəndis", "Бас механик", "Bosh mexanik", "Башкы механик", "Chief Engineer", "Leitender Ingenieur", "Старший механик", "كبير المهندسين"],
    second_engineer: ["İkinci Mühendis", "İkinci mühəndis", "Екінші механик", "Ikkinchi mexanik", "Экинчи механик", "Second Engineer", "Zweiter Ingenieur", "Второй механик", "المهندس الثاني"],
    third_engineer: ["Üçüncü Mühendis", "Üçüncü mühəndis", "Үшінші механик", "Uchinchi mexanik", "Үчүнчү механик", "Third Engineer", "Dritter Ingenieur", "Третий механик", "المهندس الثالث"],
    fourth_engineer: ["Dördüncü Mühendis", "Dördüncü mühəndis", "Төртінші механик", "To‘rtinchi mexanik", "Төртүнчү механик", "Fourth Engineer", "Vierter Ingenieur", "Четвертый механик", "المهندس الرابع"],
    engine_cadet: ["Makine Stajyeri", "Maşın kursantı", "Машина курсанты", "Mexanika kursanti", "Механика курсанты", "Engine Cadet", "Maschinenkadett", "Курсант-механик", "متدرب محركات"],
    eto: ["Elektroteknik Zabiti", "Elektrotexniki zabit", "Электротехникалық офицер", "Elektrotexnika ofitseri", "Электротехникалык офицер", "Electro-Technical Officer", "Elektrotechnischer Offizier", "Электромеханик", "ضابط كهربائي تقني"],
    electrician: ["Gemi Elektrikçisi", "Gəmi elektrikçisi", "Кеме электршісі", "Kema elektrigi", "Кеме электриги", "Ship Electrician", "Schiffselektriker", "Судовой электрик", "كهربائي السفينة"],
    electro_technical_rating: ["Elektro-Teknik Tayfa", "Elektrotexniki heyət", "Электротехникалық қатардағы маман", "Elektrotexnik reyting", "Электротехникалык катардагы адис", "Electro-Technical Rating", "Elektrotechnische Fachkraft", "Электротехнический рядовой", "فني كهربائي بحري"],
    bosun: ["Lostromo", "Bosman", "Боцман", "Botsman", "Боцман", "Bosun", "Bootsmann", "Боцман", "رئيس البحارة"],
    able_seaman: ["Usta Gemici", "Bacarıqlı matros", "Білікті матрос", "Malakali matros", "Квалификациялуу матрос", "Able Seaman", "Vollmatrose", "Квалифицированный матрос", "بحار مؤهل"],
    ordinary_seaman: ["Gemici", "Matros", "Матрос", "Matros", "Матрос", "Ordinary Seaman", "Leichtmatrose", "Матрос", "بحار عادي"],
    deck_boy: ["Miço / Güverte Tayfası", "Göyərtə heyəti", "Палуба матросы", "Paluba yordamchisi", "Палуба жардамчысы", "Deck Boy", "Decksjunge", "Юнга", "متدرب سطح"],
    engine_bosun: ["Makine Lostromosu", "Maşın bosmanı", "Машина боцманы", "Mashina botsmani", "Машина боцманы", "Engine Bosun", "Maschinenbootsmann", "Машинный боцман", "رئيس طاقم المحركات"],
    able_engine_rating: ["Usta Yağcı / Usta Makine Tayfası", "İxtisaslı maşın heyəti", "Білікті машина маманы", "Malakali mashina xodimi", "Квалификациялуу машина адиси", "Able Seafarer Engine", "Vollmatrose Maschine", "Квалифицированный моторист", "بحار محركات مؤهل"],
    motorman: ["Motorman / Motorcu", "Motorçu", "Моторшы", "Motorchi", "Моторчу", "Motorman", "Motorenwärter", "Моторист", "عامل محركات"],
    oiler: ["Yağcı", "Motorçu", "Моторист", "Motorchi", "Моторист", "Oiler", "Motorenwärter", "Моторист", "عامل زيوت"],
    wiper: ["Silici / Makine Tayfası", "Silici", "Машина бөлімінің көмекшісі", "Mashina yordamchisi", "Машина жардамчысы", "Wiper", "Maschinenhelfer", "Машинный дневальный", "مساعد غرفة المحركات"],
    fitter: ["Fitter", "Fitter", "Слесарь", "Chilangar", "Слесарь", "Fitter", "Schlosser", "Слесарь", "فني تركيب"],
    welder: ["Kaynakçı", "Qaynaqçı", "Дәнекерлеуші", "Payvandchi", "Ширетүүчү", "Welder", "Schweißer", "Сварщик", "لحام"],
    pumpman: ["Pompaman", "Nasosçu", "Сорғы маманы", "Nasoschi", "Насосчу", "Pumpman", "Pumpenmann", "Донкерман", "مشغل المضخات"],
    chief_cook: ["Baş Aşçı", "Baş aşpaz", "Бас аспаз", "Bosh oshpaz", "Башкы ашпозчу", "Chief Cook", "Chefkoch", "Шеф-повар", "رئيس الطهاة"],
    cook: ["Aşçı", "Aşpaz", "Аспаз", "Oshpaz", "Ашпозчу", "Cook", "Koch", "Повар", "طباخ"],
    steward: ["Kamarot", "Stüard", "Стюард", "Styuard", "Стюард", "Steward", "Steward", "Стюард", "مضيف" ]
  };

  const languageLabels = {
    english: ["İngilizce", "İngilis dili", "Ағылшын тілі", "Ingliz tili", "Англис тили", "English", "Englisch", "Английский", "الإنجليزية"],
    turkish: ["Türkçe", "Türk dili", "Түрік тілі", "Turk tili", "Түрк тили", "Turkish", "Türkisch", "Турецкий", "التركية"],
    azerbaijani: ["Azerbaycanca", "Azərbaycan dili", "Әзербайжан тілі", "Ozarbayjon tili", "Азербайжан тили", "Azerbaijani", "Aserbaidschanisch", "Азербайджанский", "الأذربيجانية"],
    kazakh: ["Kazakça", "Qazax dili", "Қазақ тілі", "Qozoq tili", "Казак тили", "Kazakh", "Kasachisch", "Казахский", "الكازاخية"],
    uzbek: ["Özbekçe", "Özbək dili", "Өзбек тілі", "O‘zbek tili", "Өзбек тили", "Uzbek", "Usbekisch", "Узбекский", "الأوزبكية"],
    kyrgyz: ["Kırgızca", "Qırğız dili", "Қырғыз тілі", "Qirg‘iz tili", "Кыргыз тили", "Kyrgyz", "Kirgisisch", "Киргизский", "القيرغيزية"],
    german: ["Almanca", "Alman dili", "Неміс тілі", "Nemis tili", "Немис тили", "German", "Deutsch", "Немецкий", "الألمانية"],
    russian: ["Rusça", "Rus dili", "Орыс тілі", "Rus tili", "Орус тили", "Russian", "Russisch", "Русский", "الروسية"],
    arabic: ["Arapça", "Ərəb dili", "Араб тілі", "Arab tili", "Араб тили", "Arabic", "Arabisch", "Арабский", "العربية"]
  };

  function language() {
    const raw = String(localStorage.getItem("allona.language") || document.documentElement.lang || "tr").toLowerCase();
    return languageCodes.includes(raw) ? raw : "tr";
  }

  function rowText(row) {
    return row && (row[languageCodes.indexOf(language())] || row[0]) || "";
  }

  function text(key) {
    return rowText(copyRows[key]) || key;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" }[character];
    });
  }

  function folded(value) {
    return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/[^a-zA-Z0-9]+/g, " ").trim().toLowerCase();
  }

  function localizedValue(value, fallback) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return String(source[language()] || source.en || source.tr || fallback || "").trim();
  }

  function localizedList(value, fallback) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const selected = Array.isArray(source[language()]) ? source[language()].filter(Boolean) : [];
    return selected.length ? selected : (Array.isArray(fallback) ? fallback.filter(Boolean) : []);
  }

  function localizedRank(value, canonical) {
    if (canonical && rankLabels[canonical]) return rowText(rankLabels[canonical]);
    const target = folded(value);
    if (!target) return String(value || "").trim();
    const aliases = {
      captain: "master", kaptan: "master", master: "master",
      "chief officer": "chief_officer", "chief mate": "chief_officer", "birinci zabit": "chief_officer",
      "second officer": "second_officer", "ikinci zabit": "second_officer",
      "third officer": "third_officer", "ucuncu zabit": "third_officer",
      "chief engineer": "chief_engineer", "bas muhendis": "chief_engineer",
      "second engineer": "second_engineer", "third engineer": "third_engineer", "fourth engineer": "fourth_engineer",
      "deck cadet": "deck_cadet", "guverte kadeti": "deck_cadet", "engine cadet": "engine_cadet", "makine kadeti": "engine_cadet", "electro technical officer": "eto",
      electrician: "electrician", "electro technical rating": "electro_technical_rating", etr: "electro_technical_rating",
      bosun: "bosun", boatswain: "bosun", lostromo: "bosun", reis: "bosun", "able seaman": "able_seaman",
      "ordinary seaman": "ordinary_seaman", "deck boy": "deck_boy", mico: "deck_boy", "engine bosun": "engine_bosun", "makine lostromosu": "engine_bosun",
      "able engine rating": "able_engine_rating", "able seafarer engine": "able_engine_rating", "usta yagci": "able_engine_rating", "usta makine tayfasi": "able_engine_rating",
      oiler: "oiler", motorman: "motorman", motorcu: "motorman", wiper: "wiper", silici: "wiper", fitter: "fitter", welder: "welder", kaynakci: "welder",
      pumpman: "pumpman", pompaman: "pumpman", pompaci: "pumpman", postman: "pumpman", "chief cook": "chief_cook", cook: "cook", steward: "steward"
    };
    let key = aliases[target];
    if (!key) {
      for (const [rankKey, row] of Object.entries(rankLabels)) {
        if (row.some(function (label) { return folded(label) === target; })) { key = rankKey; break; }
      }
    }
    return key && rankLabels[key] ? rowText(rankLabels[key]) : String(value || "").trim();
  }

  function localizedLanguageName(value) {
    const target = folded(value);
    const aliases = {
      english: "english", ingilizce: "english", ingilis: "english",
      turkish: "turkish", turkce: "turkish", turk: "turkish",
      azerbaijani: "azerbaijani", azerbaycanca: "azerbaijani", azerbaycan: "azerbaijani",
      kazakh: "kazakh", kazakca: "kazakh", qazaq: "kazakh",
      uzbek: "uzbek", ozbekce: "uzbek", ozbek: "uzbek",
      kyrgyz: "kyrgyz", kirgizca: "kyrgyz", qirgiz: "kyrgyz",
      german: "german", almanca: "german", deutsch: "german",
      russian: "russian", rusca: "russian", rus: "russian",
      arabic: "arabic", arapca: "arabic", arab: "arabic"
    };
    const key = aliases[target];
    return key && languageLabels[key] ? rowText(languageLabels[key]) : String(value || "").trim();
  }

  function safeAvatar(value) {
    const raw = String(value || "").trim();
    if (/^data:image\/(?:png|jpe?g|webp);base64,/i.test(raw) && raw.length <= 2000000) return raw;
    if (/^https:\/\//i.test(raw) && raw.length <= 2048) return raw;
    if (/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//i.test(raw) && raw.length <= 2048) return raw;
    return "";
  }

  function initials(value) {
    const parts = String(value || "AH").trim().split(/\s+/).filter(Boolean);
    return (parts.slice(0, 2).map(function (part) { return part.charAt(0); }).join("") || "AH").toLocaleUpperCase(localeCodes[language()] || "tr-TR");
  }

  function apiBase() {
    return String(App.config && App.config.apiBaseUrl || "https://api.allonahub.com").replace(/\/$/, "");
  }

  async function deviceKey() {
    if (!App.cvAccess || typeof App.cvAccess.getDeviceKey !== "function") throw new Error("MARITIME_DEVICE_KEY_REQUIRED");
    return App.cvAccess.getDeviceKey();
  }

  async function passkeyHeaders() {
    if (!window.AllonaMaritimePasskey || typeof window.AllonaMaritimePasskey.authorize !== "function") throw new Error("MARITIME_PASSKEY_UNSUPPORTED");
    return { "X-Allona-Passkey-Proof": await window.AllonaMaritimePasskey.authorize() };
  }

  function actionErrorText(error) {
    return String(error?.code || "").startsWith("MARITIME_PASSKEY_") ? text("passkeyError") : text("requestError");
  }

  async function api(path, options) {
    const session = App.auth && App.auth.getSession ? await App.auth.getSession() : null;
    if (!session?.access_token) throw new Error("AUTH_REQUIRED");
    if (state.session?.user?.id && session.user?.id !== state.session.user.id) throw new Error("AUTH_REQUIRED");
    const response = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.access_token}`,
        "X-Allona-Device-Key": await deviceKey(),
        ...(options && options.body ? { "Content-Type": "application/json" } : {}),
        ...(options && options.headers || {})
      }
    });
    const payload = await response.json().catch(function () { return {}; });
    if (!response.ok || payload.ok !== true) {
      const error = new Error(payload.message || "REQUEST_FAILED");
      error.status = response.status;
      error.code = payload.code || payload.error || "";
      throw error;
    }
    return payload;
  }

  function root() {
    return document.querySelector("[data-portal-root]");
  }

  function setNotice(message, tone) {
    const target = document.querySelector("[data-smart-notice]");
    if (!target) return;
    target.textContent = message || "";
    target.className = `maritime-notice${message ? " is-visible" : ""}${tone ? ` is-${tone}` : ""}`;
  }

  function dateLabel(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return new Intl.DateTimeFormat(localeCodes[language()] || "tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  }

  function missingLabel(value) {
    const raw = String(value || "");
    const [code, detail] = raw.split(":");
    const label = rowText(missingLabels[code]) || code.replace(/_/g, " ");
    return detail ? `${label}: ${detail}` : label;
  }

  function summaryMetric(icon, value, label) {
    return `<article><i class="fa-solid ${icon}" aria-hidden="true"></i><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></article>`;
  }

  function valueList(values) {
    const rows = Array.isArray(values) ? values.filter(Boolean) : [];
    return rows.length
      ? `<div class="maritime-cv-chip-list">${rows.map(function (value) { return `<span>${escapeHtml(value)}</span>`; }).join("")}</div>`
      : `<p class="maritime-cv-empty">${escapeHtml(text("notStated"))}</p>`;
  }

  function medicalValue(value) {
    const key = { fit: "fit", fit_with_restrictions: "fitWithRestrictions", unfit: "unfit", not_stated: "notStated" }[value] || "notStated";
    return text(key);
  }

  function cvCertificateRecords(cv) {
    const records = Array.isArray(cv.certificate_records) ? cv.certificate_records.filter(Boolean) : [];
    if (records.length) return records;
    return (Array.isArray(cv.qualifications) ? cv.qualifications : []).filter(Boolean).map(function (code) {
      return { code, document_number: null, title: null, title_i18n: {}, issuing_authority: null, issue_date: null, expiry_date: null };
    });
  }

  function cvFact(label, value, options) {
    const settings = options || {};
    let resolved = value;
    if (settings.date && value) resolved = dateLabel(value);
    if (resolved === null || resolved === undefined || resolved === "") return "";
    return `<div${settings.wide ? ' class="maritime-cv-fact--wide"' : ""}><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(resolved)}</dd></div>`;
  }

  function cvFacts(rows, className) {
    const content = rows.filter(Boolean).join("");
    return content ? `<dl class="maritime-cv-facts${className ? ` ${className}` : ""}">${content}</dl>` : `<p class="maritime-cv-empty">${escapeHtml(text("notStated"))}</p>`;
  }

  function cvSection(title, content, className, lead) {
    return `<section class="maritime-cv-v4-section${className ? ` ${className}` : ""}"><header><div><h3>${escapeHtml(title)}</h3>${lead ? `<p>${escapeHtml(lead)}</p>` : ""}</div></header>${content || `<p class="maritime-cv-empty">${escapeHtml(text("notStated"))}</p>`}</section>`;
  }

  function cvDocumentLabel(kind, label) {
    if (label) return label;
    const labels = {
      passport: rowText(missingLabels.passport),
      seafarer_book: rowText(missingLabels.seaman_book),
      seaman_record_book: text("seamanRecordBook"),
      national_id: text("nationalId"),
      visa: text("visa")
    };
    return labels[kind] || text("cvDocumentsTitle");
  }

  function currencyLabel(amount, currency) {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) return "";
    const code = String(currency || "").toUpperCase();
    try {
      return code.length === 3
        ? new Intl.NumberFormat(localeCodes[language()] || "tr-TR", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(numeric)
        : `${new Intl.NumberFormat(localeCodes[language()] || "tr-TR").format(numeric)} ${code}`.trim();
    } catch (error) {
      return `${numeric} ${code}`.trim();
    }
  }

  function cvPreviewMarkup(run) {
    const snapshot = run.smart_snapshot || {};
    const profile = snapshot.profile || {};
    const cv = snapshot.cv_draft || {};
    const service = Array.isArray(cv.sea_service) ? cv.sea_service : [];
    const certificateRecords = cvCertificateRecords(cv);
    const languageRows = Array.isArray(cv.languages) ? cv.languages.filter(Boolean) : [];
    const identityDocuments = Array.isArray(cv.identity_documents) ? cv.identity_documents.filter(Boolean) : [];
    const educationRows = Array.isArray(cv.education) ? cv.education.filter(Boolean) : [];
    const medicalRows = Array.isArray(cv.medical_records) ? cv.medical_records.filter(Boolean) : [];
    const vaccinationRows = Array.isArray(cv.vaccinations) ? cv.vaccinations.filter(Boolean) : [];
    const referenceRows = Array.isArray(cv.references) ? cv.references.filter(Boolean) : [];
    const skillRows = Array.isArray(cv.skills) ? cv.skills.filter(Boolean) : [];
    const achievementRows = Array.isArray(cv.achievements) ? cv.achievements.filter(Boolean) : [];
    const competencyRows = Array.isArray(cv.competency_highlights) ? cv.competency_highlights.filter(Boolean) : [];
    const experience = cv.experience_overview || {};
    const contact = cv.contact || {};
    const physical = cv.physical_profile || {};
    const headline = localizedValue(cv.headline_i18n, localizedRank(cv.headline, profile.canonical_rank)) || text("notStated");
    const nationality = localizedValue(cv.nationality_i18n, cv.nationality) || text("notStated");
    const holderName = cv.holder_name || text("cvTitle");
    const salary = currencyLabel(cv.desired_salary_amount, cv.desired_salary_currency);
    const professionalSummary = localizedValue(cv.professional_summary_i18n, cv.professional_summary);
    const identityFacts = cvFacts([
      cvFact(text("familyName"), cv.family_name),
      cvFact(text("givenNames"), cv.given_names),
      cvFact(text("nationality"), nationality),
      cvFact(text("birthDate"), cv.date_of_birth, { date: true }),
      cvFact(text("birthPlace"), cv.place_of_birth),
      cvFact(text("gender"), cv.gender),
      cvFact(text("maritalStatus"), cv.marital_status),
      cvFact(rowText(missingLabels.medical), medicalValue(cv.medical_fitness))
    ]);
    const contactFacts = cvFacts([
      cvFact(text("email"), contact.email, { wide: true }),
      cvFact(text("phone"), contact.phone),
      cvFact(text("secondPhone"), contact.secondary_phone),
      cvFact(text("address"), contact.permanent_address, { wide: true }),
      cvFact(text("airport"), contact.nearest_airport),
      cvFact(text("desiredSalary"), salary),
      cvFact(text("availability"), cv.availability_text)
    ]);
    const physicalFacts = cvFacts([
      cvFact(text("height"), physical.height_cm ? `${physical.height_cm} cm` : ""),
      cvFact(text("weight"), physical.weight_kg ? `${physical.weight_kg} kg` : ""),
      cvFact(text("eyeColour"), physical.eye_color),
      cvFact(text("hairColour"), physical.hair_color),
      cvFact(text("shoeSize"), physical.shoe_size),
      cvFact(text("overallSize"), physical.overall_size)
    ]);
    const documentMarkup = identityDocuments.map(function (row) {
      const expiry = row.validity_status === "non_expiring" ? text("noExpiry") : row.expiry_date ? dateLabel(row.expiry_date) : text("notStated");
      return `<article class="maritime-cv-record"><strong>${escapeHtml(cvDocumentLabel(row.kind, row.label))}</strong>${cvFacts([
        cvFact(text("cvDocumentNumber"), row.document_number),
        cvFact(text("issuingCountry"), row.issuing_country),
        cvFact(text("cvIssuingAuthority"), row.issuing_authority),
        cvFact(text("issuePlace"), row.place_of_issue),
        cvFact(text("cvIssueDate"), row.issue_date, { date: true }),
        cvFact(text("cvExpiryDate"), expiry)
      ], "maritime-cv-facts--compact")}</article>`;
    }).join("");
    const credentialMarkup = certificateRecords.map(function (row) {
      const title = localizedValue(row.title_i18n, row.title) || text("notStated");
      const capacity = localizedValue(row.rank_or_capacity_i18n, localizedRank(row.rank_or_capacity));
      const expiry = row.validity_status === "non_expiring" ? text("noExpiry") : row.expiry_date ? dateLabel(row.expiry_date) : text("notStated");
      return `<article class="maritime-cv-record maritime-cv-record--credential"><span class="maritime-cv-code">${escapeHtml(row.code || "CERT")}</span><div><strong>${escapeHtml(title)}</strong>${capacity ? `<p>${escapeHtml(capacity)}</p>` : ""}${cvFacts([
        cvFact(text("cvDocumentNumber"), row.document_number),
        cvFact(text("certificateSerial"), row.certificate_serial),
        cvFact(text("endorsementNumber"), row.endorsement_number),
        cvFact(text("issuingCountry"), row.issuing_country),
        cvFact(text("cvIssuingAuthority"), row.issuing_authority),
        cvFact(text("approvalAuthority"), row.approval_authority),
        cvFact(text("approvalReference"), row.approval_reference),
        cvFact(text("issuePlace"), row.place_of_issue),
        cvFact(text("coursePeriod"), [row.course_start_date ? dateLabel(row.course_start_date) : "", row.course_end_date ? dateLabel(row.course_end_date) : ""].filter(Boolean).join(" - ")),
        cvFact(text("cvIssueDate"), row.issue_date, { date: true }),
        cvFact(text("cvExpiryDate"), expiry),
        cvFact(text("stcwReferences"), Array.isArray(row.stcw_references) ? row.stcw_references.join(", ") : "")
      ], "maritime-cv-facts--compact")}</div></article>`;
    }).join("");
    const educationMarkup = educationRows.map(function (row) {
      const qualification = localizedValue(row.qualification_i18n, row.qualification);
      const study = localizedValue(row.field_of_study_i18n, row.field_of_study);
      return `<article class="maritime-cv-record"><strong>${escapeHtml(row.institution || qualification || text("cvEducation"))}</strong>${cvFacts([
        cvFact(text("qualification"), qualification),
        cvFact(text("fieldOfStudy"), study),
        cvFact(text("issuePlace"), [row.city, row.country].filter(Boolean).join(", ")),
        cvFact(text("period"), [row.start_date ? dateLabel(row.start_date) : "", row.graduation_date || row.end_date ? dateLabel(row.graduation_date || row.end_date) : ""].filter(Boolean).join(" - "))
      ], "maritime-cv-facts--compact")}</article>`;
    }).join("");
    const medicalMarkup = medicalRows.map(function (row) {
      const expiry = row.validity_status === "non_expiring" ? text("noExpiry") : row.expiry_date ? dateLabel(row.expiry_date) : text("notStated");
      return `<article class="maritime-cv-record"><strong>${escapeHtml(String(row.record_type || text("cvMedical")).replace(/_/g, " "))}</strong>${cvFacts([
        cvFact(text("cvDocumentNumber"), row.document_number),
        cvFact(text("medicalResult"), medicalValue(row.result)),
        cvFact(text("cvIssuingAuthority"), row.issuing_authority),
        cvFact(text("cvIssueDate"), row.issue_date, { date: true }),
        cvFact(text("cvExpiryDate"), expiry)
      ], "maritime-cv-facts--compact")}</article>`;
    }).join("");
    const vaccinationMarkup = vaccinationRows.map(function (row) {
      const expiry = row.validity_status === "non_expiring" ? text("noExpiry") : row.expiry_date ? dateLabel(row.expiry_date) : text("notStated");
      return `<article class="maritime-cv-record"><strong>${escapeHtml(localizedValue(row.vaccine_name_i18n, row.vaccine_name) || text("cvVaccinations"))}</strong>${cvFacts([
        cvFact(text("dose"), row.dose),
        cvFact(text("cvDocumentNumber"), row.document_number),
        cvFact(text("cvIssuingAuthority"), row.issuing_authority),
        cvFact(text("cvIssueDate"), row.issue_date, { date: true }),
        cvFact(text("cvExpiryDate"), expiry)
      ], "maritime-cv-facts--compact")}</article>`;
    }).join("");
    const languageMarkup = languageRows.map(function (entry) {
      const languageName = localizedValue(entry.language_i18n, localizedLanguageName(entry.language));
      const level = localizedValue(entry.level_i18n, entry.level) || text("notStated");
      return `<span><b>${escapeHtml(languageName)}</b><small>${escapeHtml(level)}</small></span>`;
    }).join("");
    const serviceMarkup = service.map(function (row) {
      const serviceRank = localizedValue(row && row.rank_i18n, localizedRank(row && row.rank));
      const vesselType = localizedValue(row && row.vessel_type_i18n, row && row.vessel_type);
      const period = [row && row.sign_on_date ? dateLabel(row.sign_on_date) : "", row && row.sign_off_date ? dateLabel(row.sign_off_date) : text("present")].filter(Boolean).join(" - ");
      return `<article class="maritime-cv-service-row"><header><div><strong>${escapeHtml(row.vessel_name || text("vessel"))}</strong><p>${escapeHtml([serviceRank, vesselType].filter(Boolean).join(" · ") || text("notStated"))}</p></div><span>${escapeHtml(period)}</span></header>${cvFacts([
        cvFact("IMO", row.imo_number),
        cvFact(text("company"), row.company_name),
        cvFact(text("flag"), row.flag),
        cvFact(text("vesselType"), vesselType),
        cvFact(text("seaDays"), row.total_days ? `${row.total_days} ${text("days")}` : ""),
        cvFact(text("grt"), row.gross_tonnage),
        cvFact(text("dwt"), row.deadweight_tonnage),
        cvFact(text("netTonnage"), row.net_tonnage),
        cvFact(text("mmsi"), row.mmsi),
        cvFact(text("callSign"), row.call_sign),
        cvFact(text("buildYear"), row.build_year),
        cvFact(text("lengthOverall"), row.length_overall_m ? `${row.length_overall_m} m` : ""),
        cvFact(text("referenceName"), row.reference_name),
        cvFact(text("email"), row.reference_company_email),
        cvFact(text("companyPhone"), row.reference_company_phone),
        cvFact(text("phone"), row.reference_phone),
        cvFact(text("engine"), [row.engine_make_model, row.engine_power_kw ? `${row.engine_power_kw} kW` : ""].filter(Boolean).join(" · "))
      ], "maritime-cv-facts--service")}</article>`;
    }).join("");
    const referencesMarkup = referenceRows.map(function (row) {
      return `<article class="maritime-cv-record"><strong>${escapeHtml(row.name || row.company || text("cvReferences"))}</strong>${cvFacts([
        cvFact(text("company"), row.company),
        cvFact(text("rank"), row.position),
        cvFact(text("phone"), row.phone),
        cvFact(text("companyPhone"), row.company_phone),
        cvFact(text("email"), row.email)
      ], "maritime-cv-facts--compact")}</article>`;
    }).join("");
    const competencyMarkup = valueList(competencyRows.map(function (row) {
      const label = localizedValue(row.label_i18n, row.label);
      return [row.code, label].filter(Boolean).join(" · ");
    }));
    const skillsMarkup = valueList(skillRows.map(function (row) {
      return localizedValue(row.name_i18n, row.name);
    }));
    const achievementsMarkup = achievementRows.map(function (row) {
      const title = localizedValue(row.title_i18n, row.title);
      return `<article class="maritime-cv-record"><strong>${escapeHtml(title)}</strong>${row.details ? `<p>${escapeHtml(row.details)}</p>` : ""}${row.date ? cvFacts([cvFact(text("cvIssueDate"), row.date, { date: true })], "maritime-cv-facts--compact") : ""}</article>`;
    }).join("");
    const experienceMarkup = Number(experience.record_count) > 0 ? cvFacts([
      cvFact(text("serviceRecords"), String(experience.record_count)),
      cvFact(text("verifiedDays"), String(Number(experience.total_days) || 0)),
      cvFact(text("vessel"), Array.isArray(experience.vessels) ? experience.vessels.join(", ") : ""),
      cvFact(text("company"), Array.isArray(experience.companies) ? experience.companies.join(", ") : ""),
      cvFact(text("vesselType"), Array.isArray(experience.vessel_types) ? experience.vessel_types.join(", ") : ""),
      cvFact(text("rank"), Array.isArray(experience.ranks) ? experience.ranks.join(", ") : "")
    ], "maritime-cv-facts--service") : "";
    return `<dialog class="maritime-cv-dialog" data-cv-dialog aria-labelledby="maritime-cv-title" tabindex="-1">
      <div class="maritime-cv-sheet">
        <div class="maritime-cv-toolbar"><strong>${escapeHtml(text(run.status === "user_confirmed" ? "profileConfirmed" : "profileDraft"))}</strong><button type="button" data-close-cv aria-label="${escapeHtml(text("close"))}" title="${escapeHtml(text("close"))}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>
        <div class="maritime-cv-scroll" data-cv-scroll tabindex="0" role="region" aria-labelledby="maritime-cv-title">
        <div class="maritime-cv-layout maritime-cv-layout--v4">
          <span class="maritime-cv-neon-rail" aria-hidden="true"></span>
          <div class="maritime-cv-body">
            <header class="maritime-cv-profile-head">
              <div class="maritime-cv-head"><span>${escapeHtml(text("cvProfileLabel"))}</span><h2 id="maritime-cv-title">${escapeHtml(holderName)}</h2><p>${escapeHtml(headline)}</p></div>
              <div class="maritime-cv-v4-brand"><span>ALLONA HUB</span><strong>${escapeHtml(text("cvTitle"))}</strong></div>
            </header>
            ${professionalSummary ? cvSection(text("cvProfessionalSummary"), `<p class="maritime-cv-summary-copy">${escapeHtml(professionalSummary)}</p>`) : ""}
            ${competencyRows.length ? cvSection(text("cvCompetencies"), competencyMarkup, "maritime-cv-competencies-v6", text("cvCompetencyLead")) : ""}
            <div class="maritime-cv-v4-grid maritime-cv-v4-grid--three">
              ${cvSection(text("cvIdentity"), identityFacts)}
              ${cvSection(text("cvContact"), contactFacts)}
              ${cvSection(text("cvPhysical"), physicalFacts)}
            </div>
            ${cvSection(text("cvDocumentsTitle"), documentMarkup ? `<div class="maritime-cv-record-list maritime-cv-record-list--two">${documentMarkup}</div>` : "")}
            ${cvSection(text("cvCredentialLedger"), credentialMarkup ? `<div class="maritime-cv-record-list">${credentialMarkup}</div>` : "", "maritime-cv-credentials-v4", text("cvCredentialLead"))}
            <div class="maritime-cv-v4-grid maritime-cv-v4-grid--two">
              ${cvSection(text("endorsementsTitle"), valueList(localizedList(cv.endorsements_i18n, cv.endorsements)))}
              ${cvSection(text("restrictionsTitle"), valueList(localizedList(cv.restrictions_i18n, cv.restrictions)))}
            </div>
            ${skillRows.length ? cvSection(text("cvSkills"), skillsMarkup, "maritime-cv-skills-v6") : ""}
            ${achievementRows.length ? cvSection(text("cvAchievements"), `<div class="maritime-cv-record-list maritime-cv-record-list--two">${achievementsMarkup}</div>`) : ""}
            ${cvSection(text("cvEducation"), educationMarkup ? `<div class="maritime-cv-record-list maritime-cv-record-list--two">${educationMarkup}</div>` : "")}
            <div class="maritime-cv-v4-grid maritime-cv-v4-grid--two">
              ${cvSection(text("cvMedical"), medicalMarkup ? `<div class="maritime-cv-record-list">${medicalMarkup}</div>` : "")}
              ${cvSection(text("cvVaccinations"), vaccinationMarkup ? `<div class="maritime-cv-record-list">${vaccinationMarkup}</div>` : "")}
            </div>
            ${experienceMarkup ? cvSection(text("cvExperienceOverview"), experienceMarkup, "maritime-cv-experience-v6") : ""}
            ${cvSection(text("serviceHistory"), serviceMarkup ? `<div class="maritime-cv-service-list">${serviceMarkup}</div>` : `<p class="maritime-cv-summary-copy">${escapeHtml(text("cvSeaServicePending"))}</p>`, "maritime-cv-service-v4")}
            <div class="maritime-cv-v4-grid maritime-cv-v4-grid--two">
              ${cvSection(text("cvLanguages"), languageMarkup ? `<div class="maritime-cv-language-list maritime-cv-language-list--v4">${languageMarkup}</div>` : "")}
              ${cvSection(text("cvReferences"), referencesMarkup ? `<div class="maritime-cv-record-list">${referencesMarkup}</div>` : "")}
            </div>
            <div class="maritime-cv-v4-notes"><p class="maritime-cv-source"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i>${escapeHtml(text("sourceNote"))}</p><p><i class="fa-solid fa-lock" aria-hidden="true"></i>${escapeHtml(text("employerCvPrivacy"))}</p></div>
          </div>
          <span class="maritime-cv-neon-rail" aria-hidden="true"></span>
        </div>
        </div>
        <div class="maritime-cv-actions">
          <button class="maritime-button maritime-button--primary" type="button" data-print-cv><i class="fa-solid fa-file-pdf" aria-hidden="true"></i>${escapeHtml(text("savePdf"))}</button>
          <button class="maritime-button" type="button" data-close-cv><i class="fa-solid fa-xmark" aria-hidden="true"></i>${escapeHtml(text("close"))}</button>
        </div>
        <div class="maritime-notice" role="status" aria-live="polite" data-pdf-notice></div>
      </div>
    </dialog>`;
  }

  function smartActionsMarkup(run, matches, drafts) {
    const draftedJobs = new Set(drafts.map(function (draft) { return draft.job_id; }));
    const eligibleCount = matches.filter(function (match) { return match.eligible && !draftedJobs.has(match.job_id); }).length;
    const readiness = run.smart_snapshot && run.smart_snapshot.readiness || {};
    const needsProfileDetails = (readiness.missing_items || []).length > 0 || (readiness.expiry_alerts || []).length > 0;
    const canPrepare = run.status === "user_confirmed" && eligibleCount > 0;
    return `<section class="maritime-smart-actions">
      <div class="maritime-document-section-head"><span class="maritime-document-kicker">${escapeHtml(text("smartKicker"))}</span><h2>${escapeHtml(text("actionCenter"))}</h2><p>${escapeHtml(text("actionCenterLead"))}</p></div>
      <div class="maritime-smart-action-rail">
        <article><i class="fa-solid fa-id-card" aria-hidden="true"></i><div><h3>${escapeHtml(text("viewCv"))}</h3><p>${escapeHtml(text("cvActionLead"))}</p></div><button class="maritime-button" type="button" data-open-cv>${escapeHtml(text("viewCv"))}</button></article>
        <article data-attention="${needsProfileDetails}"><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i><div><h3>${escapeHtml(text("completeDocuments"))}</h3><p>${escapeHtml(text("documentsActionLead"))}</p></div><a class="maritime-button${needsProfileDetails ? " maritime-button--danger" : ""}" href="maritime-cv.html">${escapeHtml(text("completeDocuments"))}</a></article>
        <article><i class="fa-solid fa-bolt" aria-hidden="true"></i><div><h3>${escapeHtml(text("prepareAll"))}</h3><p>${escapeHtml(canPrepare ? text("prepareAllLead") : run.status !== "user_confirmed" ? text("confirmFirst") : text("noEligible"))}</p></div><button class="maritime-button maritime-button--primary" type="button" data-prepare-all ${canPrepare ? "" : "disabled"}><span>${eligibleCount}</span>${escapeHtml(text("prepareAll"))}</button></article>
      </div>
    </section>`;
  }

  function readinessMarkup(run) {
    const snapshot = run.smart_snapshot || {};
    const profile = snapshot.profile || {};
    const readiness = snapshot.readiness || {};
    const missing = Array.isArray(readiness.missing_items) ? readiness.missing_items : [];
    const alerts = Array.isArray(readiness.expiry_alerts) ? readiness.expiry_alerts : [];
    const ready = readiness.ready_to_apply === true;
    const confirmed = run.status === "user_confirmed";
    const score = Math.max(0, Math.min(100, Number(readiness.score) || 0));
    return `<section class="maritime-smart-command">
      <div class="maritime-smart-command-copy">
        <span class="maritime-document-kicker">${escapeHtml(text("smartKicker"))}</span>
        <h2>${escapeHtml(text("profileSummary"))}</h2>
        <p>${escapeHtml(text("confirmationRule"))}</p>
        <div class="maritime-smart-status"><span class="${ready ? "is-ready" : "is-warning"}"><i class="fa-solid ${ready ? "fa-circle-check" : "fa-circle-exclamation"}" aria-hidden="true"></i>${escapeHtml(text(ready ? "ready" : "needsAttention"))}</span><small>${escapeHtml(text(confirmed ? "profileConfirmed" : "profileDraft"))}</small></div>
        <div class="maritime-smart-command-actions">
          ${confirmed ? "" : `<button class="maritime-button maritime-button--primary" type="button" data-confirm-smart><i class="fa-solid fa-check-double" aria-hidden="true"></i>${escapeHtml(text("confirmProfile"))}</button>`}
          ${profile.current_work_status === "available_now" ? "" : `<button class="maritime-button maritime-button--availability" type="button" data-available-now><i class="fa-solid fa-person-circle-check" aria-hidden="true"></i>${escapeHtml(text("availableNow"))}</button>`}
          <button class="maritime-button" type="button" data-prepare-smart><i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>${escapeHtml(text("refreshButton"))}</button>
        </div>
      </div>
      <aside class="maritime-smart-score" style="--smart-score:${score * 3.6}deg"><div><strong>${score}%</strong><span>${escapeHtml(text("readiness"))}</span></div></aside>
    </section>
    <section class="maritime-smart-metrics">
      ${summaryMetric("fa-user-tie", profile.rank || "-", text("rank"))}
      ${summaryMetric("fa-ship", `${Number(profile.total_sea_service_days) || 0} ${text("days")}`, text("seaDays"))}
      ${summaryMetric("fa-certificate", String((profile.certificate_codes || []).length), text("certificates"))}
      ${summaryMetric("fa-language", String((profile.languages || []).length), text("languages"))}
      ${summaryMetric("fa-file-shield", String(readiness.archived_document_count ?? readiness.confirmed_document_count ?? 0), text("documents"))}
    </section>
    <section class="maritime-smart-two-column">
      <article class="maritime-smart-list-panel"><h2><i class="fa-solid fa-list-check" aria-hidden="true"></i>${escapeHtml(text("missingTitle"))}</h2>${missing.length ? `<div class="maritime-smart-chip-rail">${missing.map(function (item) { return `<span>${escapeHtml(missingLabel(item))}</span>`; }).join("")}</div>` : `<p class="maritime-smart-positive"><i class="fa-solid fa-circle-check" aria-hidden="true"></i>${escapeHtml(text("nothingMissing"))}</p>`}</article>
      <article class="maritime-smart-list-panel"><h2><i class="fa-solid fa-calendar-check" aria-hidden="true"></i>${escapeHtml(text("expiryTitle"))}</h2>${alerts.length ? `<div class="maritime-smart-expiry-rail">${alerts.map(function (alert) { const expired = alert.days_remaining < 0; return `<span data-severity="${escapeHtml(alert.severity)}"><strong>${escapeHtml(alert.source_label || missingLabel(alert.item_type))}</strong><small>${escapeHtml(dateLabel(alert.expires_at))}</small><b>${escapeHtml(expired ? text("expired") : `${alert.days_remaining} ${text("days")} ${text("remaining")}`)}</b></span>`; }).join("")}</div>` : `<p class="maritime-smart-positive"><i class="fa-solid fa-circle-check" aria-hidden="true"></i>${escapeHtml(text("noExpiry"))}</p>`}</article>
    </section>`;
  }

  function matchComponent(component) {
    const percent = Math.round((Number(component.earned) || 0) / Math.max(1, Number(component.weight) || 1) * 100);
    return `<span title="${escapeHtml(component.code)}"><i style="--component-score:${percent}%"></i><small>${escapeHtml(missingLabel(component.code))}</small></span>`;
  }

  function matchCard(match, draftByJob, confirmed) {
    const draft = draftByJob.get(match.job_id);
    const selectable = confirmed && match.eligible && !draft;
    const missing = Array.isArray(match.missing_requirements) ? match.missing_requirements : [];
    return `<article class="maritime-smart-match" data-eligible="${match.eligible === true}">
      <div class="maritime-smart-match-head"><div><span>${escapeHtml(match.job_reference || "")}</span><h3>${escapeHtml(match.job_title || "")}</h3></div><strong>${Math.round(Number(match.score) || 0)}<small>% ${escapeHtml(text("score"))}</small></strong></div>
      <div class="maritime-smart-components">${(match.components || []).map(matchComponent).join("")}</div>
      <p class="maritime-smart-eligibility"><i class="fa-solid ${match.eligible ? "fa-circle-check" : "fa-circle-exclamation"}" aria-hidden="true"></i>${escapeHtml(text(match.eligible ? "eligible" : "notEligible"))}</p>
      ${missing.length ? `<p class="maritime-smart-missing"><b>${escapeHtml(text("missingRequirement"))}:</b> ${escapeHtml(missing.map(missingLabel).join(" · "))}</p>` : ""}
      ${selectable ? `<label class="maritime-smart-select"><input type="checkbox" value="${escapeHtml(match.job_id)}" data-select-match ${state.selected.has(match.job_id) ? "checked" : ""}><span>${escapeHtml(text("select"))}</span></label>` : ""}
      ${draft ? `<span class="maritime-smart-draft-state"><i class="fa-solid fa-file-circle-check" aria-hidden="true"></i>${escapeHtml(draft.status === "submitted" ? text("submitted") : text("draftReady"))}</span>` : ""}
    </article>`;
  }

  function matchesMarkup(run, matches, drafts) {
    const confirmed = run.status === "user_confirmed";
    const draftByJob = new Map(drafts.map(function (draft) { return [draft.job_id, draft]; }));
    const selectableCount = matches.filter(function (match) { return match.eligible && !draftByJob.has(match.job_id); }).length;
    return `<section class="maritime-smart-section">
      <div class="maritime-document-section-head maritime-document-review-head"><div><span class="maritime-document-kicker">${escapeHtml(text("score"))}</span><h2>${escapeHtml(text("matchesTitle"))}</h2></div><p>${escapeHtml(text("matchesLead"))}</p></div>
      ${matches.length ? `<div class="maritime-smart-match-rail">${matches.map(function (match) { return matchCard(match, draftByJob, confirmed); }).join("")}</div>` : `<div class="maritime-smart-empty"><i class="fa-solid fa-satellite-dish" aria-hidden="true"></i><p>${escapeHtml(text("noMatches"))}</p></div>`}
      ${matches.length && selectableCount ? `<div class="maritime-smart-draft-action"><button class="maritime-button maritime-button--primary" type="button" data-prepare-drafts ${!confirmed || !state.selected.size ? "disabled" : ""}><i class="fa-solid fa-file-circle-plus" aria-hidden="true"></i>${escapeHtml(text("prepareDrafts"))}</button><small>${escapeHtml(text(confirmed ? "confirmationRule" : "confirmFirst"))}</small></div>` : ""}
    </section>`;
  }

  function draftsMarkup(drafts) {
    return `<section class="maritime-smart-section"><div class="maritime-document-section-head"><span class="maritime-document-kicker">${escapeHtml(text("draftsTitle"))}</span><h2>${escapeHtml(text("draftsTitle"))}</h2></div>${drafts.length ? `<div class="maritime-smart-drafts">${drafts.map(function (draft) { const submitted = draft.status === "submitted"; return `<article><div><span>${escapeHtml(draft.job_reference || "")}</span><h3>${escapeHtml(draft.job_title || "")}</h3><p>${escapeHtml(text(submitted ? "submitted" : "draftReady"))}</p></div>${submitted ? `<strong><i class="fa-solid fa-circle-check" aria-hidden="true"></i>${escapeHtml(text("submitted"))}</strong>` : `<button class="maritime-button maritime-button--danger" type="button" data-submit-application="${escapeHtml(draft.id)}"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i>${escapeHtml(text("submitApplication"))}</button>`}</article>`; }).join("")}</div>` : `<div class="maritime-smart-empty"><i class="fa-solid fa-file-circle-plus" aria-hidden="true"></i><p>${escapeHtml(text("noDrafts"))}</p></div>`}</section>`;
  }

  function render() {
    const target = root();
    if (!target) return;
    const cvScrollTop = target.querySelector("[data-cv-scroll]")?.scrollTop || 0;
    const payload = state.payload || {};
    if (!payload.run) {
      closeCv();
      target.innerHTML = `<section class="maritime-smart-onboarding"><div><span class="maritime-document-kicker">${escapeHtml(text("smartKicker"))}</span><h2>${escapeHtml(text("prepareTitle"))}</h2><p>${escapeHtml(text("prepareLead"))}</p><button class="maritime-button maritime-button--primary" type="button" data-prepare-smart><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>${escapeHtml(text("prepareButton"))}</button><small><i class="fa-solid fa-lock" aria-hidden="true"></i>${escapeHtml(text("privacy"))}</small></div></section><div class="maritime-notice" role="status" aria-live="polite" data-smart-notice></div>`;
      return;
    }
    const matches = Array.isArray(payload.matches) ? payload.matches : [];
    const drafts = Array.isArray(payload.application_drafts) ? payload.application_drafts : [];
    target.innerHTML = `${readinessMarkup(payload.run)}<div class="maritime-notice" role="status" aria-live="polite" data-smart-notice></div>${smartActionsMarkup(payload.run, matches, drafts)}${matchesMarkup(payload.run, matches, drafts)}${draftsMarkup(drafts)}${cvPreviewMarkup(payload.run)}`;
    if (state.cvOpen) openCv(cvScrollTop);
    setBusy(state.busy);
  }

  function setBusy(busy) {
    state.busy = busy;
    document.querySelectorAll("[data-prepare-smart], [data-confirm-smart], [data-available-now], [data-prepare-drafts], [data-prepare-all], [data-submit-application], [data-print-cv]").forEach(function (button) {
      if (busy) button.disabled = true;
      else if (button.hasAttribute("data-prepare-drafts")) button.disabled = state.payload?.run?.status !== "user_confirmed" || !state.selected.size;
      else button.disabled = false;
    });
  }

  async function load() {
    state.payload = await api("/v1/maritime/smart-account");
    if (!state.payload.run && !state.autoPrepared) {
      state.autoPrepared = true;
      try {
        state.payload = await api("/v1/maritime/smart-account/prepare", { method: "POST", body: JSON.stringify({}) });
      } catch (error) {
        if (error.status !== 409) throw error;
      }
    }
    state.selected.clear();
    if (new URLSearchParams(window.location.search).get("openCv") === "1" && state.payload.run) state.cvOpen = true;
    render();
  }

  async function prepare() {
    if (state.busy) return;
    setBusy(true);
    try {
      state.payload = await api("/v1/maritime/smart-account/prepare", { method: "POST", body: JSON.stringify({}) });
      state.selected.clear();
      render();
      setNotice(text("prepareDone"), "success");
    } catch (error) {
      setNotice(error.status === 409 ? text("documentRequired") : text("requestError"), "error");
      if (error.status === 409 && !state.payload?.run) {
        const target = root();
        if (target) target.insertAdjacentHTML("beforeend", `<a class="maritime-button maritime-button--danger" href="maritime-cv.html"><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>${escapeHtml(text("completeDocuments"))}</a>`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirmSmart() {
    const run = state.payload && state.payload.run;
    if (!run || state.busy) return;
    setBusy(true);
    try {
      state.payload = await api(`/v1/maritime/smart-account/${encodeURIComponent(run.id)}/confirm`, { method: "POST", headers: await passkeyHeaders(), body: JSON.stringify({ confirmation: true }) });
      render();
      setNotice(text("confirmDone"), "success");
    } catch (error) {
      setNotice(actionErrorText(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function setAvailableNow() {
    if (state.busy) return;
    setBusy(true);
    try {
      await api("/v1/maritime/smart-account/availability", { method: "PATCH", body: JSON.stringify({ confirmation: true, work_status: "available_now", available_from: null }) });
      state.payload = await api("/v1/maritime/smart-account/prepare", { method: "POST", body: JSON.stringify({}) });
      state.selected.clear();
      render();
      setNotice(text("availableNowDone"), "success");
    } catch (error) {
      setNotice(text("requestError"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function prepareDrafts() {
    const run = state.payload && state.payload.run;
    if (!run || run.status !== "user_confirmed" || !state.selected.size || state.busy) return;
    setBusy(true);
    try {
      state.payload = await api(`/v1/maritime/smart-account/${encodeURIComponent(run.id)}/application-drafts`, { method: "POST", headers: await passkeyHeaders(), body: JSON.stringify({ confirmation: true, job_ids: Array.from(state.selected) }) });
      state.selected.clear();
      render();
      setNotice(text("draftsDone"), "success");
    } catch (error) {
      setNotice(actionErrorText(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function prepareAllDrafts() {
    const run = state.payload && state.payload.run;
    const drafts = Array.isArray(state.payload && state.payload.application_drafts) ? state.payload.application_drafts : [];
    const draftedJobs = new Set(drafts.map(function (draft) { return draft.job_id; }));
    const jobIds = (Array.isArray(state.payload && state.payload.matches) ? state.payload.matches : [])
      .filter(function (match) { return match.eligible && !draftedJobs.has(match.job_id); })
      .slice(0, 50)
      .map(function (match) { return match.job_id; });
    if (!run || run.status !== "user_confirmed" || !jobIds.length || state.busy) {
      setNotice(text("noEligible"), "error");
      return;
    }
    state.selected = new Set(jobIds);
    await prepareDrafts();
  }

  function openCv(scrollTop = 0) {
    const dialog = document.querySelector("[data-cv-dialog]");
    if (!dialog || dialog.open) return;
    state.cvOpen = true;
    document.documentElement.classList.add("maritime-cv-open");
    dialog.showModal();
    dialog.querySelector("[data-cv-scroll]").scrollTop = scrollTop;
    dialog.querySelector("[data-close-cv]").focus({ preventScroll: true });
  }

  function closeCv() {
    state.cvOpen = false;
    document.documentElement.classList.remove("maritime-cv-open");
    const dialog = document.querySelector("[data-cv-dialog]");
    if (dialog && typeof dialog.close === "function" && dialog.open) dialog.close();
  }

  async function waitForPdfAssets(root) {
    const fonts = root.ownerDocument.fonts;
    if (fonts?.ready) await fonts.ready.catch(() => undefined);
    const images = Array.from(root.querySelectorAll("img"));
    await Promise.all(images.map(function (image) {
      if (image.complete) return Promise.resolve();
      return new Promise(function (resolve) {
        const done = function () { resolve(); };
        image.addEventListener("load", done, { once: true });
        image.addEventListener("error", done, { once: true });
        window.setTimeout(done, 8000);
      });
    }));
  }

  function globalCvBreakpoints(layout, scale) {
    const layoutRect = layout.getBoundingClientRect();
    const candidates = Array.from(layout.querySelectorAll([
      ".maritime-cv-profile-head",
      ".maritime-cv-v4-section",
      ".maritime-cv-v4-grid",
      ".maritime-cv-record",
      ".maritime-cv-service-row",
      ".maritime-cv-v4-notes"
    ].join(","))).map(function (element) {
      const rect = element.getBoundingClientRect();
      return Math.round((rect.bottom - layoutRect.top) * scale);
    }).filter(function (value) {
      return value > 0 && value < layoutRect.height * scale;
    });
    return Array.from(new Set(candidates)).sort(function (first, second) { return first - second; });
  }

  function addGlobalCvPages(pdf, canvas, breakpoints) {
    const margin = 8;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = pageHeight - margin * 2;
    const maximumSliceHeight = Math.floor(canvas.width * contentHeight / contentWidth);
    let start = 0;
    let pageIndex = 0;

    while (start < canvas.height) {
      const target = Math.min(canvas.height, start + maximumSliceHeight);
      const minimumUsefulBreak = start + Math.floor(maximumSliceHeight * 0.55);
      const safeBreaks = breakpoints.filter(function (point) { return point > minimumUsefulBreak && point <= target; });
      const end = target === canvas.height ? target : (safeBreaks.at(-1) || target);
      const sliceHeight = Math.max(1, end - start);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceHeight;
      const context = slice.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, slice.width, slice.height);
      context.drawImage(canvas, 0, start, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
      const renderedHeight = sliceHeight * contentWidth / canvas.width;
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL("image/jpeg", 1), "JPEG", margin, margin, contentWidth, renderedHeight, undefined, "FAST");
      start = end;
      pageIndex += 1;
    }
  }

  async function printCv() {
    if (state.busy) return;
    setBusy(true);
    const pdfNotice = document.querySelector("[data-pdf-notice]");
    if (pdfNotice) { pdfNotice.textContent = ""; pdfNotice.className = "maritime-notice"; }
    try {
      const html2canvas = window.html2canvas;
      const JsPdf = window.jspdf && window.jspdf.jsPDF;
      if (typeof html2canvas !== "function" || typeof JsPdf !== "function" || !window.AllonaMaritimePdfNames) {
        const error = new Error("MARITIME_PDF_LIBRARY_UNAVAILABLE");
        error.code = "MARITIME_PDF_LIBRARY_UNAVAILABLE";
        throw error;
      }
      const run = state.payload && state.payload.run;
      const cv = run && run.smart_snapshot && run.smart_snapshot.cv_draft || {};
      const fileName = window.AllonaMaritimePdfNames.globalCv(cv.given_names, cv.family_name, cv.holder_name);
      openCv();
      const layout = document.querySelector(".maritime-cv-layout");
      if (!layout) throw new Error("GLOBAL_CV_PREVIEW_MISSING");
      await waitForPdfAssets(layout);
      const captureScale = 2.25;
      let breakpoints = [];
      const canvas = await html2canvas(layout, {
        scale: captureScale,
        useCORS: true,
        backgroundColor: "#ffffff",
        imageTimeout: 15000,
        logging: false,
        windowWidth: 1040,
        onclone: async function (clonedDocument, clonedLayout) {
          // PDF-only dimensions must never resize or scroll the visible preview.
          clonedDocument.body.classList.add("maritime-pdf-capture");
          const scroller = clonedDocument.querySelector("[data-cv-scroll]");
          if (scroller) scroller.scrollTop = 0;
          await waitForPdfAssets(clonedLayout);
          breakpoints = globalCvBreakpoints(clonedLayout, captureScale);
        }
      });
      const pdf = new JsPdf("p", "mm", "a4", true);
      pdf.setProperties({
        title: `Global CV - ${String(cv.holder_name || [cv.given_names, cv.family_name].filter(Boolean).join(" ")).trim()}`,
        subject: "AllonaHub Global CV",
        author: "AllonaHub"
      });
      addGlobalCvPages(pdf, canvas, breakpoints);
      if (!window.AllonaMaritimeCommerce || typeof window.AllonaMaritimeCommerce.authorizeOrCheckout !== "function") {
        const error = new Error("MARITIME_COMMERCE_UNAVAILABLE");
        error.code = "MARITIME_COMMERCE_UNAVAILABLE";
        throw error;
      }
      const authorization = await window.AllonaMaritimeCommerce.authorizeOrCheckout("global_cv_pdf");
      if (!authorization) return;
      await pdf.save(fileName, { returnPromise: true });
    } catch (error) {
      const code = String(error?.code || "");
      const key = window.AllonaMaritimeCommerce?.pdfErrorKey ? window.AllonaMaritimeCommerce.pdfErrorKey(error) : code === "AUTH_REQUIRED"
        ? "pdfLoginRequired"
        : code.includes("PAYMENT") || error?.status === 402 || error?.status === 503
        ? "pdfPaymentFailed"
        : "pdfGenerationFailed";
      setNotice(text(key), "error");
      const currentPdfNotice = document.querySelector("[data-pdf-notice]");
      if (currentPdfNotice) {
        currentPdfNotice.textContent = text(key);
        currentPdfNotice.className = "maritime-notice is-visible is-error";
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitApplication(applicationId) {
    if (!applicationId || state.busy || !window.confirm(text("finalConfirm"))) return;
    setBusy(true);
    try {
      state.payload = await api(`/v1/maritime/application-drafts/${encodeURIComponent(applicationId)}/submit`, { method: "POST", headers: await passkeyHeaders(), body: JSON.stringify({ confirmation: true }) });
      render();
      setNotice(text("submitted"), "success");
    } catch (error) {
      setNotice(actionErrorText(error), "error");
    } finally {
      setBusy(false);
    }
  }

  function bind() {
    document.addEventListener("cancel", function (event) {
      if (!event.target.matches("[data-cv-dialog]")) return;
      event.preventDefault();
      closeCv();
    }, true);
    document.addEventListener("close", function (event) {
      if (event.target.matches("[data-cv-dialog]") && event.target.isConnected && !event.target.open) closeCv();
    }, true);
    document.addEventListener("click", function (event) {
      if (event.target.closest("[data-prepare-smart]")) return prepare();
      if (event.target.closest("[data-confirm-smart]")) return confirmSmart();
      if (event.target.closest("[data-available-now]")) return setAvailableNow();
      if (event.target.closest("[data-prepare-drafts]")) return prepareDrafts();
      if (event.target.closest("[data-prepare-all]")) return prepareAllDrafts();
      if (event.target.closest("[data-open-cv]")) return openCv();
      if (event.target.closest("[data-close-cv]")) return closeCv();
      if (event.target.closest("[data-print-cv]")) return printCv();
      if (event.target.matches("[data-cv-dialog]")) return closeCv();
      const submit = event.target.closest("[data-submit-application]");
      if (submit) submitApplication(submit.dataset.submitApplication);
    });
    document.addEventListener("change", function (event) {
      const checkbox = event.target.closest("[data-select-match]");
      if (!checkbox) return;
      if (checkbox.checked) state.selected.add(checkbox.value);
      else state.selected.delete(checkbox.value);
      const button = document.querySelector("[data-prepare-drafts]");
      if (button) button.disabled = state.busy || !state.selected.size;
    });
  }

  async function initialize(event) {
    state.session = event && event.detail && event.detail.session || null;
    if (!state.session) return;
    if (!state.initialized) {
      state.initialized = true;
      bind();
    }
    const target = root();
    if (target) target.innerHTML = `<section class="maritime-smart-loading" aria-live="polite"><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i><strong>${escapeHtml(text("loading"))}</strong></section>`;
    try {
      await load();
    } catch (error) {
      if (target) target.innerHTML = `<section class="maritime-smart-onboarding"><div><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><h2>${escapeHtml(text("requestError"))}</h2><button class="maritime-button" type="button" data-prepare-smart>${escapeHtml(text("refreshButton"))}</button></div></section><div class="maritime-notice" role="status" aria-live="polite" data-smart-notice></div>`;
    }
  }

  document.addEventListener("allona:maritime-smart-account-ready", initialize);
  document.addEventListener("allona:language-changed", function () {
    if (state.session && state.payload) render();
  });
})();
