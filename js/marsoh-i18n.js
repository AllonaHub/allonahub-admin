(function () {
  "use strict";

  const COPY = {
    tr: {
      skip: "Mesajlara geç", back: "Geri Dön", home: "Ana Sayfa", module: "Modüle Dön", language: "Dil",
      loginRequired: "MarSoh'u kullanmak için aktif AllonaHub hesabınızla giriş yapın.", signIn: "Giriş Yap",
      tagline: "Denizcilerin küresel sohbet ağı", rooms: "Odalar", live: "Canlı", notifications: "Bildirim tercihi",
      notifyAll: "Tümü", notifyMentions: "Yalnızca bahsetmeler", notifyMuted: "Sessiz", todayTopic: "Bugünün deniz konusu",
      older: "Önceki mesajları yükle", newMessages: "Yeni mesajlar", listening: "Dinleniyor…", messageLabel: "Mesaj",
      messagePlaceholder: "Denizcilik hakkında bir şey yazın", safeCommunity: "Güvenli topluluk", roomInfo: "Oda bilgisi",
      roomInfoText: "MarSoh, denizcilerin tecrübe ve fikir paylaşımı içindir.", rules: "Topluluk kuralları",
      ruleContact: "İletişim bilgisi ve dış bağlantı paylaşmayın.", ruleRecruitment: "İş ilanı veya personel arama paylaşmayın.",
      ruleRespect: "Saygılı, güvenli ve konuya uygun konuşun.", ruleMoney: "Komisyon, ödeme veya aracılık talep etmeyin.",
      seaSafety: "Denizde güvenlik", seaSafetyText: "Acil bir durumda sohbet yerine geminizin resmi acil durum prosedürünü izleyin.",
      close: "Kapat", sending: "Gönderiliyor…", sent: "Gönderildi", failed: "Gönderilemedi", retry: "Tekrar dene", remove: "Sil",
      edit: "Düzenle", report: "Bildir", block: "Kullanıcıyı engelle", translate: "Çevir", showOriginal: "Orijinali göster",
      automaticTranslation: "Otomatik çeviri", translationUnavailable: "Çeviri şu anda kullanılamıyor", emptyTitle: "Sohbeti başlatın",
      emptyBody: "Denizcilikle ilgili güvenli bir konu açın. Kişisel iletişim bilgisi veya iş ilanı paylaşmayın.",
      networkFailed: "Gönderilemedi — bağlantıyı kontrol edin", communityFailed: "Gönderilemedi — topluluk kurallarına aykırı ifade",
      contactFailed: "Gönderilemedi — iletişim bilgisi paylaşımı yasaktır", micDenied: "Mikrofon izni verilmedi.",
      micTimeout: "Konuşma algılanamadı. Tekrar deneyin.", micError: "Sesle yazma şu anda kullanılamıyor.",
      chooseReaction: "Tepki bırak", reportSaved: "Bildiriminiz alındı.", blocked: "Kullanıcı engellendi.",
      actionTitle: "Mesaj işlemleri", reportReason: "Bildirme nedeni", cancel: "Vazgeç", loadFailed: "MarSoh şu anda yüklenemedi.",
      memberRoom: "Güvenli topluluk odası", unread: "okunmamış", messages: "mesaj", homeLabel: "AllonaHub ana sayfa",
      breadcrumbLabel: "Sayfa bağlantıları", chatLanguage: "Sohbet dili", closeRooms: "Odaları kapat", openRooms: "Sohbet odalarını aç",
      openRules: "Topluluk kurallarını aç", closeRules: "Topluluk kurallarını kapat",
      jumpLatest: "En yeni mesaja dön", emojiPicker: "Emoji seçici", chooseEmoji: "Emoji seç", voiceTyping: "Sesle yaz", sendMessage: "Mesaj gönder",
      verifiedCompany: "Doğrulanmış şirket", verifiedSeafarer: "Doğrulanmış denizci", reasonSpam: "Spam", reasonHarassment: "Taciz veya hakaret",
      reasonFraud: "Dolandırıcılık", reasonRecruitment: "İş ilanı veya personel arama", reasonContact: "İletişim bilgisi paylaşımı", reasonOther: "Diğer"
    },
    az: {
      skip: "Mesajlara keç", back: "Geri qayıt", home: "Ana səhifə", module: "Modula qayıt", language: "Dil",
      loginRequired: "MarSoh-dan istifadə etmək üçün aktiv AllonaHub hesabınızla daxil olun.", signIn: "Daxil ol",
      tagline: "Dənizçilərin qlobal söhbət şəbəkəsi", rooms: "Otaqlar", live: "Canlı", notifications: "Bildiriş seçimi",
      notifyAll: "Hamısı", notifyMentions: "Yalnız qeydlər", notifyMuted: "Səssiz", todayTopic: "Günün dəniz mövzusu",
      older: "Əvvəlki mesajları yüklə", newMessages: "Yeni mesajlar", listening: "Dinlənilir…", messageLabel: "Mesaj",
      messagePlaceholder: "Dənizçilik haqqında yazın", safeCommunity: "Təhlükəsiz icma", roomInfo: "Otaq məlumatı",
      roomInfoText: "MarSoh dənizçilərin təcrübə və fikir paylaşması üçündür.", rules: "İcma qaydaları",
      ruleContact: "Əlaqə məlumatı və xarici keçid paylaşmayın.", ruleRecruitment: "İş elanı və ya işçi axtarışı paylaşmayın.",
      ruleRespect: "Hörmətli, təhlükəsiz və mövzuya uyğun danışın.", ruleMoney: "Komissiya, ödəniş və ya vasitəçilik tələb etməyin.",
      seaSafety: "Dənizdə təhlükəsizlik", seaSafetyText: "Təcili halda söhbət əvəzinə gəminizin rəsmi təcili prosedurunu izləyin.",
      close: "Bağla", sending: "Göndərilir…", sent: "Göndərildi", failed: "Göndərilmədi", retry: "Yenidən sına", remove: "Sil",
      edit: "Düzəlt", report: "Şikayət et", block: "İstifadəçini blokla", translate: "Tərcümə et", showOriginal: "Orijinalı göstər",
      automaticTranslation: "Avtomatik tərcümə", translationUnavailable: "Tərcümə hazırda əlçatan deyil", emptyTitle: "Söhbətə başlayın",
      emptyBody: "Dənizçiliklə bağlı təhlükəsiz mövzu açın. Şəxsi əlaqə məlumatı və ya iş elanı paylaşmayın.",
      networkFailed: "Göndərilmədi — bağlantını yoxlayın", communityFailed: "Göndərilmədi — icma qaydalarına zidd ifadə",
      contactFailed: "Göndərilmədi — əlaqə məlumatı paylaşmaq qadağandır", micDenied: "Mikrofon icazəsi verilmədi.",
      micTimeout: "Nitq aşkarlanmadı. Yenidən sınayın.", micError: "Səslə yazma hazırda əlçatan deyil.",
      chooseReaction: "Reaksiya ver", reportSaved: "Şikayətiniz qəbul edildi.", blocked: "İstifadəçi bloklandı.",
      actionTitle: "Mesaj əməliyyatları", reportReason: "Şikayət səbəbi", cancel: "Ləğv et", loadFailed: "MarSoh hazırda yüklənmədi.",
      memberRoom: "Təhlükəsiz icma otağı", unread: "oxunmamış", messages: "mesaj", homeLabel: "AllonaHub ana səhifəsi",
      breadcrumbLabel: "Səhifə bağlantıları", chatLanguage: "Söhbət dili", closeRooms: "Otaqları bağla", openRooms: "Söhbət otaqlarını aç",
      openRules: "İcma qaydalarını aç", closeRules: "İcma qaydalarını bağla",
      jumpLatest: "Ən yeni mesaja keç", emojiPicker: "Emoji seçimi", chooseEmoji: "Emoji seç", voiceTyping: "Səslə yaz", sendMessage: "Mesaj göndər",
      verifiedCompany: "Təsdiqlənmiş şirkət", verifiedSeafarer: "Təsdiqlənmiş dənizçi", reasonSpam: "Spam", reasonHarassment: "Təqib və ya təhqir",
      reasonFraud: "Dələduzluq", reasonRecruitment: "İş elanı və ya işçi axtarışı", reasonContact: "Əlaqə məlumatı paylaşımı", reasonOther: "Digər"
    },
    en: {
      skip: "Skip to messages", back: "Go Back", home: "Home", module: "Back to Module", language: "Language",
      loginRequired: "Sign in with an active AllonaHub account to use MarSoh.", signIn: "Sign In",
      tagline: "The global chat network for seafarers", rooms: "Rooms", live: "Live", notifications: "Notifications",
      notifyAll: "All", notifyMentions: "Mentions only", notifyMuted: "Muted", todayTopic: "Today's sea topic",
      older: "Load older messages", newMessages: "New messages", listening: "Listening…", messageLabel: "Message",
      messagePlaceholder: "Write about maritime life", safeCommunity: "Safe community", roomInfo: "Room information",
      roomInfoText: "MarSoh is for seafarers to share experience and ideas.", rules: "Community rules",
      ruleContact: "Do not share contact details or external links.", ruleRecruitment: "Do not post job ads or personnel searches.",
      ruleRespect: "Keep the conversation respectful, safe, and on topic.", ruleMoney: "Do not request commission, payment, or brokerage.",
      seaSafety: "Safety at sea", seaSafetyText: "In an emergency, follow your vessel's official emergency procedure instead of chat.",
      close: "Close", sending: "Sending…", sent: "Sent", failed: "Failed", retry: "Retry", remove: "Delete",
      edit: "Edit", report: "Report", block: "Block user", translate: "Translate", showOriginal: "Show original",
      automaticTranslation: "Automatic translation", translationUnavailable: "Translation is currently unavailable", emptyTitle: "Start the conversation",
      emptyBody: "Open a safe maritime topic. Do not share personal contact details or job ads.",
      networkFailed: "Failed — check your connection", communityFailed: "Failed — expression violates community rules",
      contactFailed: "Failed — sharing contact details is prohibited", micDenied: "Microphone permission was denied.",
      micTimeout: "No speech was detected. Try again.", micError: "Voice typing is currently unavailable.",
      chooseReaction: "Add reaction", reportSaved: "Your report was received.", blocked: "User blocked.",
      actionTitle: "Message actions", reportReason: "Report reason", cancel: "Cancel", loadFailed: "MarSoh could not be loaded.",
      memberRoom: "Safe community room", unread: "unread", messages: "messages", homeLabel: "AllonaHub home",
      breadcrumbLabel: "Page links", chatLanguage: "Chat language", closeRooms: "Close rooms", openRooms: "Open chat rooms",
      openRules: "Open community rules", closeRules: "Close community rules",
      jumpLatest: "Jump to latest message", emojiPicker: "Emoji picker", chooseEmoji: "Choose emoji", voiceTyping: "Voice typing", sendMessage: "Send message",
      verifiedCompany: "Verified company", verifiedSeafarer: "Verified seafarer", reasonSpam: "Spam", reasonHarassment: "Harassment or abuse",
      reasonFraud: "Fraud", reasonRecruitment: "Job ad or personnel search", reasonContact: "Contact information sharing", reasonOther: "Other"
    }
  };

  function normalize(language) { return ["tr", "az", "en"].includes(language) ? language : "tr"; }
  function current() { return normalize(localStorage.getItem("allona.language") || document.documentElement.lang || "tr"); }
  function t(key, language) { const lang = normalize(language || current()); return COPY[lang][key] || COPY.tr[key] || key; }
  function localized(value, language) { const source = value && typeof value === "object" ? value : {}; return source[normalize(language || current())] || source.en || source.tr || source.az || ""; }
  function apply(language) {
    const lang = normalize(language || current());
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-marsoh-copy]").forEach((element) => { element.textContent = t(element.dataset.marsohCopy, lang); });
    document.querySelectorAll("[data-marsoh-placeholder]").forEach((element) => { element.placeholder = t(element.dataset.marsohPlaceholder, lang); });
    document.querySelectorAll("[data-marsoh-aria]").forEach((element) => { element.setAttribute("aria-label", t(element.dataset.marsohAria, lang)); });
    document.querySelectorAll("[data-marsoh-title]").forEach((element) => { element.title = t(element.dataset.marsohTitle, lang); });
    const select = document.querySelector("[data-marsoh-language]");
    if (select) select.value = lang;
    document.dispatchEvent(new CustomEvent("marsoh:language", { detail: { language: lang } }));
    return lang;
  }

  window.MarSohI18n = { COPY, current, t, localized, apply, normalize };
})();
