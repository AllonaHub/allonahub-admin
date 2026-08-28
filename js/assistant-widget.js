(function () {
  const App = window.Allona = window.Allona || {};
  const SCRIPT = document.currentScript;
  const VERSION = "20260828-address1";
  const STORAGE_KEY = "allonahub_assistant_conversation_id";
  const RATE_KEY = "allonahub_assistant_rate";
  const RAW_URL_PATTERN = /https?:\/\/[^\s<>"')]+/gi;
  const MAX_ACTION_BUTTONS = 3;
  const CHANNELS = ["webchat", "telegram", "partner_panel", "admin_panel", "whatsapp", "instagram", "facebook"];
  const CONTACT_CHANNELS = {
    whatsapp: SCRIPT && SCRIPT.dataset.whatsappUrl || `https://wa.me/905427781868?text=${encodeURIComponent("Merhaba AllonaHub, canlı destek almak istiyorum.")}`,
    telegram: SCRIPT && SCRIPT.dataset.telegramUrl || "https://t.me/AllonaHub_Bot"
  };
  const QUICK_OPTIONS = [
    { label: "Sipariş", message: "Siparişimi sorgulamak istiyorum" },
    { label: "Partner", message: "Partner başvurusu yapmak istiyorum" },
    { label: "CV Oluştur", message: "CV oluşturmak istiyorum" },
    { label: "Denizcilik", message: "Denizcilik iş ilanları hakkında bilgi almak istiyorum" },
    { label: "Akademi", message: "AllonaHub Akademi hakkında bilgi almak istiyorum" },
    { label: "Destek Talebi", message: "Destek talebi oluşturmak istiyorum", ticket: true }
  ];
  const LOCAL_LINKS = {
    services: "/index.html#modules",
    search: "/pages/search/arama.html",
    support: "/pages/company/destek.html",
    contact: "/pages/company/iletisim.html",
    about: "/pages/company/hakkimizda.html",
    academy: "/allonahub-akademi.html",
    premium: "/pages/account/premium.html",
    partner: "/pages/partner/partner.html",
    login: "/pages/account/user.html",
    forgotPassword: "/pages/account/user.html?tab=forgot",
    profile: "/pages/account/profil.html",
    addresses: "/pages/account/addresses.html",
    orders: "/pages/account/orders.html",
    career: "/pages/career/allonakariyer.html",
    smartCv: "/pages/career/career-cv-form.html",
    maritime: "/pages/ecosystem/allonadenizcilik.html",
    maritimeCv: "/pages/career/cv-form.html",
    legalCenter: "/legal/index.html"
  };

  function escapeHTML(value) {
    if (App.core && App.core.escapeHTML) return App.core.escapeHTML(value);
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeText(value, max) {
    return String(value ?? "")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max || 1600);
  }

  function safeActionUrl(value) {
    try {
      const url = new URL(String(value || ""), window.location.href);
      return /^https?:$/i.test(url.protocol) ? url.href : "";
    } catch (error) {
      return "";
    }
  }

  function normalizeAssistantAction(action) {
    if (!action || action.type !== "open_url" || !action.label || !action.url) return null;
    const href = safeActionUrl(action.url);
    if (!href) return null;
    return {
      type: "open_url",
      label: normalizeText(action.label, 44),
      url: href
    };
  }

  function assistantActionButtons(actions) {
    const seen = new Set();
    const cleanActions = [];
    (Array.isArray(actions) ? actions : []).forEach((action) => {
      if (cleanActions.length >= MAX_ACTION_BUTTONS) return;
      const cleanAction = normalizeAssistantAction(action);
      if (!cleanAction) return;
      const key = cleanAction.url.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      cleanActions.push(cleanAction);
    });
    return cleanActions;
  }

  function stripUrlsForActions(text, actions) {
    let clean = normalizeText(text, 1600);
    if (!Array.isArray(actions) || !actions.length) return clean;
    clean = clean
      .replace(RAW_URL_PATTERN, "")
      .replace(/\s*\|\s*/g, " ")
      .replace(/\(\s*\)/g, "")
      .replace(/\[\s*\]/g, "")
      .replace(/\s+([.,;:!?])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim();
    clean = clean
      .replace(/\s*(?:buradan|şuradan|suradan|bu bağlantıdan|bu baglantidan|aşağıdaki bağlantıdan|asagidaki baglantidan)\s*[:：]?\s*$/iu, ".")
      .replace(/\s*[:：]\s*([.!?])?$/u, function (_match, punct) { return punct || "."; })
      .replace(/\s+\./g, ".")
      .replace(/\.{2,}/g, ".")
      .trim();
    return clean || "Size en uygun adımı seçebilmeniz için aşağıdaki seçenekleri hazırladım.";
  }

  function wantsRawUrlText(value) {
    if (wantsTextOnly(value)) return false;
    const normalized = String(value || "")
      .toLocaleLowerCase("tr-TR")
      .replace(/ı/g, "i")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    const explicitTerms = ["link", "linki", "linkini", "url", "baglanti", "baglantisi", "baglantisini"];
    const pageAddressPattern = /\b(?:sayfa|sayfanin|sayfasinin|site|web|internet)\s+(?:adresi|adresini|adres)\b|\b(?:adresi|adresini)\s+(?:gonder|gonderir|gonderebilir|paylas|paylasir|ver|yaz|atar)\b/u;
    return explicitTerms.some((term) => normalized.includes(term)) || pageAddressPattern.test(normalized);
  }

  function wantsTextOnly(value) {
    const normalized = String(value || "")
      .toLocaleLowerCase("tr-TR")
      .replace(/ı/g, "i")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    return ["link atma", "link verme", "link gonderme", "url atma", "url verme", "adres atma", "adres verme", "baglanti atma", "baglanti verme", "buton atma", "buton verme", "buton gonderme", "sadece anlat", "sadece metin", "metin olarak anlat"]
      .some((term) => normalized.includes(term));
  }

  function rawUrlReplyForRequest(message, reply) {
    if (!wantsRawUrlText(message)) return reply;
    const target = assistantActionButtons(reply && reply.actions || [])[0];
    if (!target) return reply;
    return {
      message: `${normalizeText(target.label, 44)} bağlantısı: ${target.url}`,
      actions: []
    };
  }

  function textOnlyReplyForRequest(message, reply) {
    if (!wantsTextOnly(message)) return reply;
    return {
      message: stripUrlsForActions(reply && reply.message || "Memnuniyetle yardımcı olayım. Size kısa ve net şekilde anlatayım.", [{ type: "open_url", label: "Kaldır", url: window.location.href }]),
      actions: []
    };
  }

  function pageAction(label, key) {
    return { type: "open_url", label, url: LOCAL_LINKS[key] || LOCAL_LINKS.support };
  }

  function hasAny(normalized, terms) {
    return terms.some((term) => normalized.includes(term));
  }

  function localAssistantReply(message) {
    const normalized = String(message || "")
      .toLocaleLowerCase("tr-TR")
      .replace(/ı/g, "i")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (hasAny(normalized, ["nasilsin", "nasil gidiyor", "iyi misin", "keyfin nasil"])) {
      return {
        message: "İyiyim, teşekkür ederim. Umarım senin de günün güzel geçiyordur. AllonaHub; alışverişten kariyere, denizcilikten partnerliğe kadar çok katmanlı ve kazandıran bir platform deneyimi sunmak için tasarlandı. Ne yapmak istediğini yazarsan seni en doğru adıma yönlendireyim.",
        actions: [pageAction("Hizmetler", "services"), pageAction("CV Oluştur", "smartCv"), pageAction("Destek", "support")]
      };
    }

    if (hasAny(normalized, ["merhaba", "selam", "iyi gunler", "iyi aksamlar", "hello", "hi"])) {
      return {
        message: "Merhaba, yazdığın için teşekkür ederim. AllonaHub’da sipariş, partner başvurusu, CV oluşturma, denizcilik, akademi ve destek konularında sana yardımcı olabilirim. Kısaca ne yapmak istediğini yaz; ben seni doğru sayfaya ve doğru adıma götüreyim.",
        actions: [pageAction("CV Oluştur", "smartCv"), pageAction("Partner Ol", "partner"), pageAction("Hizmetler", "services"), pageAction("Destek", "support")]
      };
    }

    if (hasAny(normalized, ["sen kimsin", "kimsin", "ne yapabilirsin", "neler yapabilirsin", "bot musun", "asistan misin", "nasil yardimci olursun"])) {
      return {
        message: "Ben AllonaHub AI destek asistanıyım. Sipariş, hesap, CV-kariyer, denizcilik, partnerlik, akademi, HP/kupon, ödeme, iade ve platform kullanımı gibi konularda sana kısa ve doğru cevap vermeye çalışırım. Özel işlem gerekiyorsa seni güvenli sayfaya veya destek ekibine yönlendiririm.",
        actions: [pageAction("Hizmetler", "services"), pageAction("CV Oluştur", "smartCv"), pageAction("Destek / SSS", "support")]
      };
    }

    if (hasAny(normalized, ["nasil baslayabilirim", "nereden baslayayim", "nereden baslamaliyim", "nereden baslayacagim", "baslangic", "yol goster", "beni yonlendir", "ne yapmaliyim"])) {
      return {
        message: "Tabii, birlikte en doğru başlangıcı seçelim. İş arıyorsan CV oluşturma, işletme veya satış tarafındaysan partner başvurusu, platformu keşfetmek istiyorsan hizmetler alanı en hızlı adımdır. Hedefini bir cümleyle yazarsan cevabı doğrudan o yola göre hazırlarım.",
        actions: [pageAction("Hizmetler", "services"), pageAction("CV Oluştur", "smartCv"), pageAction("Partner Ol", "partner")]
      };
    }

    if (hasAny(normalized, ["ucretsiz mi", "ucretli mi", "bedava", "para oder miyim", "odeme gerekiyor mu", "ucret odemeden", "masraf olur mu"])) {
      return {
        message: "AllonaHub’u keşfetmek, bilgi almak ve uygun hizmet yolunu seçmek için önce ücretsiz şekilde ilerleyebilirsin. Ücretli paket, komisyon veya ödeme gerektiren bir işlem varsa ilgili adımda ayrıca görünür; onayın olmadan ödeme akışına sokulmazsın.",
        actions: [pageAction("Hizmetler", "services"), pageAction("Premium", "premium"), pageAction("Partner Ol", "partner")]
      };
    }

    if (hasAny(normalized, ["sifremi unuttum", "sifre sifirlama", "sifre yenileme", "parolami unuttum", "parola sifirlama", "giris yapamiyorum", "hesabima giremiyorum", "hesap erisimi", "reset password"])) {
      return {
        message: "Tabii, hesap erişimini güvenli şekilde toparlayalım. Şifreni sohbetten istemem; Giriş sayfasındaki Şifremi Unuttum alanına kayıtlı e-posta adresini yazıp sıfırlama bağlantısını talep et. E-posta gelmezse spam klasörünü kontrol et; sorun sürerse destek ekibine kısa bir kayıt bırakabilirsin.",
        actions: [pageAction("Şifremi Unuttum", "forgotPassword"), pageAction("Giriş Yap", "login"), pageAction("Destek", "support")]
      };
    }

    if (hasAny(normalized, ["adresimi nasil", "adresimi degistir", "adres degistirme", "adres guncelle", "adres ekle", "yeni adres", "teslimat adresi", "fatura adresi", "adreslerim", "adres bilgisi"])) {
      return {
        message: "Tabii, adres işlemini güvenli şekilde yönlendireyim. Giriş yaptıktan sonra Adreslerim alanından teslimat veya fatura adresi ekleyebilir, mevcut adresini düzenleyebilir ve varsayılan adresini seçebilirsin. Tam adres bilgisini sohbet içinde paylaşmana gerek yok; özel hata alırsan destek ekibi kayıt üzerinden yardımcı olur.",
        actions: [pageAction("Adreslerim", "addresses"), pageAction("Profil", "profile"), pageAction("Giriş Yap", "login")]
      };
    }

    if (hasAny(normalized, ["hangi hizmet", "hangi modul", "bana uygun", "ne secmeliyim", "hangisini secmeliyim", "shop mu market mi", "yemek mi market mi", "kariyer mi denizcilik mi", "cv mi denizcilik mi"])) {
      return {
        message: "Size uygun modülü seçmek için niyete göre ilerleyelim: ürün alışverişi için Shop, günlük ihtiyaç için Market, yemek için Allona Yemek, iş ve özgeçmiş için Kariyer/CV, gemi ve crew tarafı için Denizcilik doğru başlangıçtır. Hedefinizi tek cümleyle yazarsanız sizi en uygun modüle yönlendiririm.",
        actions: [pageAction("Hizmetler", "services"), pageAction("Arama", "search"), pageAction("Destek / SSS", "support")]
      };
    }

    if (hasAny(normalized, ["allonahub nedir", "allona hub nedir", "allonahub kimdir", "hakkimizda", "hakkinda", "platform nedir"])) {
      return {
        message: "AllonaHub; alışveriş, yemek, market, taksi, kariyer, denizcilik, akademi, partnerlik, HP/kupon ve destek katmanlarını tek ekosistemde toplayan dijital platformdur. Daha detaylı kurumsal bilgi için Hakkımızda sayfasına, sık sorulan konular için destek alanına geçebilirsin.",
        actions: [pageAction("Hakkımızda", "about"), pageAction("Hizmetler", "services"), pageAction("Destek / SSS", "support")]
      };
    }

    if (hasAny(normalized, ["cv nasil", "cv olusturma nasil", "cv nasil olusturulur", "cv nasil olustururum", "cv hazirlama", "ozgecmis nasil", "ozgecmis hazirla"])) {
      return {
        message: "Tabii, CV oluşturmayı adım adım sadeleştirelim. Önce iletişim ve deneyim bilgilerini gir, sonra eğitim/sertifika/yetenek alanlarını tamamla, son olarak PDF çıktısını kontrol edip uygun kariyer veya denizcilik başvurusuna geç. Hangi alan için CV hazırladığını yazarsan metni ona göre daha güçlü hale getirmene de yardımcı olurum.",
        actions: [pageAction("CV Oluştur", "smartCv"), pageAction("Kariyer", "career"), pageAction("Denizcilik CV", "maritimeCv")]
      };
    }

    if (hasAny(normalized, ["cv", "ozgecmis", "kariyer", "is basvurusu", "is ilani", "is ariyorum"])) {
      return {
        message: "Kariyer tarafında en iyi başlangıç güçlü bir CV hazırlamak. Akıllı CV oluşturucuyla bilgilerini düzenleyebilir, PDF üretebilir ve uygun kariyer/başvuru adımlarına geçebilirsin.",
        actions: [pageAction("CV Oluştur", "smartCv"), pageAction("Kariyer", "career"), pageAction("Denizcilik CV", "maritimeCv")]
      };
    }

    if (hasAny(normalized, ["denizcilik", "gemi", "crew", "kaptan", "liman", "navlun"])) {
      return {
        message: "Denizcilik için doğru yerdesin. Allona Denizcilik; crew, CV, sertifika, gemi/liman operasyonu, navlun ve denizcilik başvurularını tek akışta toplamak için kurgulandı.",
        actions: [pageAction("Denizcilik", "maritime"), pageAction("Denizcilik CV", "maritimeCv"), pageAction("CV Oluştur", "smartCv")]
      };
    }

    if (hasAny(normalized, ["akademi", "egitim", "kurs", "sertifika", "rehber"])) {
      return {
        message: "AllonaHub Akademi; platformu, partnerliği, kariyer süreçlerini ve dijital ticaret adımlarını daha anlaşılır hale getiren eğitim/rehber alanıdır. İstersen seni Akademi sayfasına yönlendireyim.",
        actions: [pageAction("Akademi", "academy"), pageAction("Kariyer", "career"), pageAction("Destek", "support")]
      };
    }

    if (hasAny(normalized, ["partner", "satici", "magaza ac", "isletme", "komisyon"])) {
      return {
        message: "Partnerlik için işletme bilgilerin, kategori ve iletişim detaylarınla başvuru akışına geçebilirsin. Onay sonrası ürün, sipariş, kampanya ve ödeme süreçleri partner panelinden yönetilir.",
        actions: [pageAction("Partner Ol", "partner"), pageAction("Destek", "support")]
      };
    }

    if (hasAny(normalized, ["nasil siparis", "siparis nasil", "siparis ver", "siparis olustur", "alisveris nasil", "urun nasil alirim", "urun satin alma", "satin alma nasil"])) {
      return {
        message: "Tabii, sipariş vermeyi kısa şekilde anlatalım. Önce ürünü veya hizmeti seç, varsa kupon/HP avantajını kontrol et, ürünü sepete ekle ve ödeme adımında adres ile teslimat bilgisini onayla. Sipariş sonrası durum ve takip bilgisini Siparişlerim alanından görebilirsin.",
        actions: [pageAction("Allona Shop", "shop"), pageAction("Sepet", "cart"), pageAction("Kuponlar", "coupons")]
      };
    }

    if (hasAny(normalized, ["siparis", "kargo", "teslimat", "iade", "iptal"])) {
      return {
        message: "Sipariş ve teslimat konularında güvenli bilgi için giriş yapılmış hesap üzerinden Siparişlerim alanı kullanılmalı. Siparişe özel sorun varsa destek kaydı açman en sağlıklı yol olur.",
        actions: [pageAction("Siparişlerim", "orders"), pageAction("Destek", "support")]
      };
    }

    return {
      message: "Seni anladım. Bu konuda en doğru yönlendirmeyi yapabilmem için isteğini bir cümle daha net yazabilir misin? İstersen CV, denizcilik, partnerlik, sipariş, akademi veya destek başlıklarından biriyle başlayabiliriz.",
      actions: [pageAction("Hizmetler", "services"), pageAction("Destek / SSS", "support"), pageAction("İletişim", "contact")]
    };
  }

  let mobileLockScrollY = 0;

  function isMobileAssistantView() {
    return window.matchMedia("(max-width:520px)").matches;
  }

  function setAssistantMobileLock(value) {
    const shouldLock = Boolean(value && isMobileAssistantView());
    const html = document.documentElement;
    const body = document.body;
    if (!body) return;

    if (shouldLock && !body.classList.contains("ah-assistant-mobile-lock")) {
      mobileLockScrollY = window.scrollY || window.pageYOffset || 0;
      html.classList.add("ah-assistant-mobile-lock");
      body.classList.add("ah-assistant-mobile-lock");
      body.style.top = `-${mobileLockScrollY}px`;
      return;
    }

    if (!shouldLock && body.classList.contains("ah-assistant-mobile-lock")) {
      const restoreY = Math.abs(parseInt(body.style.top || "0", 10)) || mobileLockScrollY;
      html.classList.remove("ah-assistant-mobile-lock");
      body.classList.remove("ah-assistant-mobile-lock");
      body.style.top = "";
      window.scrollTo(0, restoreY);
      mobileLockScrollY = 0;
    }
  }

  function apiBaseUrl() {
    const configured = String(App.config && App.config.apiBaseUrl || "").replace(/\/$/, "");
    if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) return "http://localhost:3000";
    return configured || "https://api.allonahub.com";
  }

  function configuredChannel(options) {
    const raw = String(
      options && options.channel ||
      SCRIPT && SCRIPT.dataset.channel ||
      document.body && document.body.dataset.assistantChannel ||
      "webchat"
    ).toLowerCase();
    return CHANNELS.includes(raw) ? raw : "webchat";
  }

  function conversationId() {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) return existing;
      const created = `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(STORAGE_KEY, created);
      return created;
    } catch (error) {
      return `web-${Date.now()}`;
    }
  }

  function rateAllowed() {
    const now = Date.now();
    let hits = [];
    try {
      hits = JSON.parse(localStorage.getItem(RATE_KEY) || "[]");
    } catch (error) {
      hits = [];
    }
    hits = hits.filter((time) => now - Number(time) < 60000);
    if (hits.length >= 12) return false;
    hits.push(now);
    try {
      localStorage.setItem(RATE_KEY, JSON.stringify(hits));
    } catch (error) {
      // Widget can continue without client-side persistence.
    }
    return true;
  }

  async function authHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (!App.auth || !App.auth.getSession) return headers;
    try {
      const session = await App.auth.getSession();
      if (session && session.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
    } catch (error) {
      // Public webchat still works without an authenticated session.
    }
    return headers;
  }

  function styles() {
    if (document.getElementById("allonahub-assistant-widget-style")) return;
    const style = document.createElement("style");
    style.id = "allonahub-assistant-widget-style";
    style.textContent = `
      .ah-assistant{--as-bg:var(--ah-bg,#020814);--as-bg-mid:var(--ah-bg-mid,#061b33);--as-bg-strong:var(--ah-bg-strong,#031326);--as-panel-bg:var(--ah-bg-strong,#ffffff);--as-panel-text:var(--ah-ink,#102033);--as-muted:var(--ah-muted,rgba(16,32,51,.68));--as-line:var(--ah-line,rgba(16,32,51,.14));--as-primary:var(--ah-primary-strong,var(--sea,#0b72ff));--as-primary-soft:var(--ah-primary,var(--sea-2,#00a8c8));--as-accent:var(--ah-accent,var(--gold,#f4b000));--as-accent-text:#061b33;--as-surface:var(--ah-soft,#f6f9fc);--as-card-bg:var(--ah-card,#ffffff);--as-shadow:var(--ah-shadow,0 24px 80px rgba(16,32,51,.24));position:fixed;right:20px;bottom:20px;z-index:2147483000;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--as-panel-text);display:grid;justify-items:end;gap:10px;color-scheme:light dark}
      body[data-theme="white"] .ah-assistant,body[data-theme="corporate"] .ah-assistant{--as-panel-bg:#ffffff;--as-panel-text:#102033;--as-muted:rgba(16,32,51,.68);--as-surface:#f6f9fc;--as-card-bg:#ffffff;--as-line:rgba(16,32,51,.12);--as-shadow:0 24px 80px rgba(16,32,51,.22)}
      .ah-assistant *{box-sizing:border-box;letter-spacing:0}
      .ah-assistant__button{position:relative;width:66px;height:66px;border:1px solid color-mix(in srgb,var(--as-primary-soft) 36%,transparent);border-radius:22px;background:linear-gradient(145deg,var(--as-bg-mid) 0%,var(--as-primary) 58%,var(--as-primary-soft) 100%);color:#fff;box-shadow:0 18px 46px color-mix(in srgb,var(--as-primary) 32%,transparent),0 0 0 6px color-mix(in srgb,var(--as-accent) 12%,transparent);font-weight:900;cursor:pointer;display:grid;place-items:center;overflow:hidden;isolation:isolate;transition:transform .18s ease,box-shadow .18s ease}
      .ah-assistant__button:before{content:"";position:absolute;inset:-38%;background:conic-gradient(from 120deg,color-mix(in srgb,var(--as-accent) 92%,white),color-mix(in srgb,var(--as-primary-soft) 52%,transparent),rgba(255,255,255,.82),color-mix(in srgb,var(--as-accent) 92%,white));animation:ahAssistSpin 5.5s linear infinite;opacity:.72;z-index:-2}
      .ah-assistant__button:after{content:"";position:absolute;inset:3px;border-radius:19px;background:linear-gradient(145deg,var(--as-bg-strong),color-mix(in srgb,var(--as-primary) 70%,var(--as-bg-mid)));z-index:-1}
      .ah-assistant__button:hover{transform:translateY(-2px);box-shadow:0 22px 54px color-mix(in srgb,var(--as-primary) 38%,transparent),0 0 0 7px color-mix(in srgb,var(--as-accent) 14%,transparent)}
      .ah-assistant__button-mark{position:relative;display:grid;place-items:center;width:44px;height:44px;border-radius:16px;background:radial-gradient(circle at 35% 20%,rgba(255,255,255,.94),rgba(255,255,255,.1) 42%,rgba(0,229,255,.16));box-shadow:inset 0 0 18px rgba(255,255,255,.16)}
      .ah-assistant__button-mark b{font-size:25px;line-height:1;color:var(--as-accent);text-shadow:0 0 12px color-mix(in srgb,var(--as-accent) 42%,transparent)}
      .ah-assistant__button-mark i{position:absolute;right:-5px;bottom:-4px;display:grid;place-items:center;min-width:22px;height:22px;border-radius:999px;background:var(--as-accent);color:var(--as-accent-text);font-style:normal;font-size:10px;font-weight:1000;box-shadow:0 6px 14px rgba(0,0,0,.22)}
      .ah-assistant__channels{position:absolute;right:2px;bottom:78px;display:grid;gap:10px;width:min(210px,calc(100vw - 32px));max-height:min(276px,calc(100vh - 118px));overflow-y:auto;padding:4px;opacity:0;transform:translateY(14px) scale(.96);pointer-events:none;transition:opacity .2s ease,transform .2s ease;scrollbar-width:none}
      .ah-assistant__channels::-webkit-scrollbar{display:none}
      .ah-assistant--actions-open .ah-assistant__channels{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}
      .ah-assistant__channel{width:100%;min-height:58px;border:1px solid color-mix(in srgb,var(--as-line) 70%,rgba(255,255,255,.22));border-radius:18px;padding:10px 12px;display:grid;grid-template-columns:42px 1fr;align-items:center;gap:10px;text-decoration:none;color:#fff;background:linear-gradient(145deg,var(--as-bg-mid),var(--as-bg-strong));box-shadow:0 14px 34px rgba(2,8,20,.32);cursor:pointer;text-align:left}
      .ah-assistant__channel:hover{transform:translateY(-1px);border-color:color-mix(in srgb,var(--as-primary-soft) 58%,transparent)}
      .ah-assistant__channel-icon{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;font-weight:1000;font-size:13px;color:#061b33;background:#fff}
      .ah-assistant__channel strong{display:block;font-size:13px;line-height:1.15;color:#fff}
      .ah-assistant__channel small{display:block;margin-top:3px;font-size:11px;line-height:1.2;color:rgba(255,255,255,.72)}
      .ah-assistant__channel--chat .ah-assistant__channel-icon{background:linear-gradient(135deg,var(--as-accent),#fff1a8)}
      .ah-assistant__channel--whatsapp .ah-assistant__channel-icon{background:#25d366;color:#fff}
      .ah-assistant__channel--telegram .ah-assistant__channel-icon{background:#27a7e7;color:#fff}
      .ah-assistant__panel{position:absolute;right:0;bottom:72px;width:min(380px,calc(100vw - 32px));height:min(620px,calc(100vh - 112px));background:var(--as-panel-bg);color:var(--as-panel-text);border:1px solid var(--as-line);border-radius:8px;box-shadow:var(--as-shadow);display:none;overflow:hidden}
      .ah-assistant--open .ah-assistant__panel{display:grid;grid-template-rows:auto 1fr auto}
      .ah-assistant__head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 14px 12px;background:linear-gradient(145deg,var(--as-bg-mid),var(--as-bg-strong));color:#fff;border-bottom:1px solid color-mix(in srgb,var(--as-line) 70%,transparent)}
      .ah-assistant__title{display:grid;gap:2px;min-width:0}
      .ah-assistant__title strong{font-size:15px;line-height:1.2}
      .ah-assistant__title span{font-size:12px;line-height:1.3;color:rgba(255,255,255,.78)}
      .ah-assistant__close{width:34px;height:34px;border:0;border-radius:6px;background:rgba(255,255,255,.12);color:#fff;font-size:22px;line-height:1;cursor:pointer}
      .ah-assistant__messages{padding:14px;overflow:auto;background:var(--as-surface);display:flex;flex-direction:column;gap:10px;color:var(--as-panel-text)}
      .ah-assistant__msg{max-width:88%;padding:10px 12px;border-radius:8px;font-size:14px;line-height:1.42;white-space:pre-wrap;overflow-wrap:anywhere}
      .ah-assistant__msg--assistant{align-self:flex-start;background:var(--as-card-bg);color:var(--as-panel-text);border:1px solid var(--as-line);box-shadow:0 10px 24px color-mix(in srgb,var(--as-bg) 10%,transparent)}
      .ah-assistant__msg--user{align-self:flex-end;background:linear-gradient(145deg,var(--as-primary),var(--as-primary-soft));color:#fff;border:1px solid color-mix(in srgb,var(--as-primary-soft) 40%,transparent);box-shadow:0 10px 24px color-mix(in srgb,var(--as-primary) 18%,transparent)}
      .ah-assistant__msg--status{align-self:center;background:transparent;color:var(--as-muted);font-size:12px;padding:2px}
      .ah-assistant__msg-text{white-space:pre-wrap}
      .ah-assistant__actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:10px}
      .ah-assistant__action{display:flex;align-items:center;justify-content:center;min-height:36px;padding:8px 9px;border:1px solid color-mix(in srgb,var(--as-primary) 30%,var(--as-line));border-radius:7px;background:color-mix(in srgb,var(--as-primary-soft) 12%,var(--as-panel-bg));color:var(--as-panel-text);text-decoration:none;font-size:12px;font-weight:800;line-height:1.2;text-align:center;overflow-wrap:anywhere}
      .ah-assistant__action:hover{background:color-mix(in srgb,var(--as-primary-soft) 22%,var(--as-panel-bg));border-color:color-mix(in srgb,var(--as-primary) 50%,var(--as-line))}
      .ah-assistant__foot{position:relative;min-width:0}
      .ah-assistant__quick-drawer{position:relative}
      .ah-assistant__quick-toggle{display:none}
      .ah-assistant__quick{display:flex;gap:6px;flex-wrap:wrap;padding:10px 12px;border-top:1px solid var(--as-line);background:var(--as-panel-bg)}
      .ah-assistant__quick button{border:1px solid color-mix(in srgb,var(--as-primary) 30%,var(--as-line));background:color-mix(in srgb,var(--as-primary-soft) 12%,var(--as-panel-bg));color:var(--as-panel-text);border-radius:6px;padding:7px 9px;font-size:12px;font-weight:700;cursor:pointer}
      .ah-assistant__quick button:hover{background:color-mix(in srgb,var(--as-primary-soft) 22%,var(--as-panel-bg))}
      .ah-assistant__form{display:grid;grid-template-columns:1fr auto;gap:8px;padding:12px;border-top:1px solid var(--as-line);background:var(--as-panel-bg)}
      .ah-assistant__input{width:100%;min-height:42px;max-height:110px;resize:none;border:1px solid var(--as-line);border-radius:6px;padding:10px 11px;font:inherit;font-size:14px;line-height:1.35;outline:none;background:var(--as-surface);color:var(--as-panel-text)}
      .ah-assistant__input::placeholder{color:var(--as-muted)}
      .ah-assistant__input:focus{border-color:var(--as-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--as-primary) 16%,transparent)}
      .ah-assistant__send{width:46px;height:42px;border:0;border-radius:6px;background:var(--as-accent);color:var(--as-accent-text);font-weight:900;cursor:pointer}
      .ah-assistant__send[disabled]{opacity:.56;cursor:not-allowed}
      body[data-theme] .ah-assistant .ah-assistant__panel{background:var(--as-panel-bg) !important;border-color:var(--as-line) !important;box-shadow:var(--as-shadow) !important;color:var(--as-panel-text) !important}
      body[data-theme] .ah-assistant .ah-assistant__head{background:linear-gradient(145deg,var(--as-bg-mid),var(--as-bg-strong)) !important;border-bottom-color:color-mix(in srgb,var(--as-line) 70%,transparent) !important;color:#fff !important}
      body[data-theme] .ah-assistant .ah-assistant__head :where(strong,button){color:#fff !important}
      body[data-theme] .ah-assistant .ah-assistant__title span{color:rgba(255,255,255,.78) !important}
      body[data-theme] .ah-assistant .ah-assistant__messages{background:var(--as-surface) !important;color:var(--as-panel-text) !important}
      body[data-theme] .ah-assistant .ah-assistant__msg--assistant{background:var(--as-card-bg) !important;border-color:var(--as-line) !important;color:var(--as-panel-text) !important}
      body[data-theme] .ah-assistant .ah-assistant__msg--assistant .ah-assistant__msg-text{color:var(--as-panel-text) !important}
      body[data-theme] .ah-assistant .ah-assistant__msg--user{background:linear-gradient(145deg,var(--as-primary),var(--as-primary-soft)) !important;color:#fff !important}
      body[data-theme] .ah-assistant .ah-assistant__msg--user .ah-assistant__msg-text{color:#fff !important}
      body[data-theme] .ah-assistant .ah-assistant__msg--status{color:var(--as-muted) !important}
      body[data-theme] .ah-assistant .ah-assistant__quick,body[data-theme] .ah-assistant .ah-assistant__form{background:var(--as-panel-bg) !important;border-color:var(--as-line) !important}
      body[data-theme] .ah-assistant .ah-assistant__quick-toggle{background:var(--as-accent) !important;color:var(--as-accent-text) !important}
      body[data-theme] .ah-assistant .ah-assistant__action,body[data-theme] .ah-assistant .ah-assistant__quick button{background:color-mix(in srgb,var(--as-primary-soft) 12%,var(--as-panel-bg)) !important;border-color:color-mix(in srgb,var(--as-primary) 30%,var(--as-line)) !important;color:var(--as-panel-text) !important}
      body[data-theme] .ah-assistant .ah-assistant__action:hover,body[data-theme] .ah-assistant .ah-assistant__quick button:hover{background:color-mix(in srgb,var(--as-primary-soft) 22%,var(--as-panel-bg)) !important}
      body[data-theme] .ah-assistant .ah-assistant__input{background:var(--as-surface) !important;border-color:var(--as-line) !important;color:var(--as-panel-text) !important}
      body[data-theme] .ah-assistant .ah-assistant__input::placeholder{color:var(--as-muted) !important}
      body[data-theme] .ah-assistant .ah-assistant__send{background:var(--as-accent) !important;color:var(--as-accent-text) !important}
      body[data-theme] .ah-assistant .ah-assistant__channel,body[data-theme] .ah-assistant .ah-assistant__channel :where(strong,small){color:#fff !important}
      body[data-theme] .ah-assistant .ah-assistant__channel-icon{color:#061b33 !important}
      body[data-theme] .ah-assistant .ah-assistant__channel--whatsapp .ah-assistant__channel-icon,body[data-theme] .ah-assistant .ah-assistant__channel--telegram .ah-assistant__channel-icon{color:#fff !important}
      body[data-theme] .ah-assistant.ah-assistant--quick-open .ah-assistant__quick{opacity:1 !important;visibility:visible !important;pointer-events:auto !important}
      body[data-theme] .ah-assistant.ah-assistant--quick-open .ah-assistant__quick-drawer{transform:translateX(0) !important}
      @supports not (color:color-mix(in srgb,#fff 50%,#000)){.ah-assistant__button{border-color:rgba(255,255,255,.36);box-shadow:0 18px 46px rgba(0,122,255,.34),0 0 0 6px rgba(255,215,0,.08)}.ah-assistant__button:before{background:conic-gradient(from 120deg,rgba(255,215,0,.95),rgba(0,229,255,.45),rgba(255,255,255,.82),rgba(255,215,0,.95))}.ah-assistant__button:after{background:linear-gradient(145deg,var(--as-bg-strong),var(--as-bg-mid))}.ah-assistant__button:hover{box-shadow:0 22px 54px rgba(0,122,255,.42),0 0 0 7px rgba(255,215,0,.12)}.ah-assistant__channel{border-color:rgba(255,255,255,.26)}.ah-assistant__channel:hover{border-color:rgba(0,229,255,.5)}.ah-assistant__head{border-bottom-color:var(--as-line)}body[data-theme] .ah-assistant .ah-assistant__head{border-bottom-color:var(--as-line) !important}.ah-assistant__msg--assistant{box-shadow:0 10px 24px rgba(2,8,20,.12)}.ah-assistant__msg--user{border-color:rgba(255,255,255,.24);box-shadow:0 10px 24px rgba(0,122,255,.18)}.ah-assistant__action,.ah-assistant__quick button{border-color:var(--as-line);background:var(--as-surface)}body[data-theme] .ah-assistant .ah-assistant__action,body[data-theme] .ah-assistant .ah-assistant__quick button{border-color:var(--as-line) !important;background:var(--as-surface) !important}.ah-assistant__action:hover,.ah-assistant__quick button:hover{background:var(--as-panel-bg)}body[data-theme] .ah-assistant .ah-assistant__action:hover,body[data-theme] .ah-assistant .ah-assistant__quick button:hover{background:var(--as-panel-bg) !important}.ah-assistant__input:focus{box-shadow:0 0 0 3px rgba(11,114,255,.14)}}
      @keyframes ahAssistSpin{to{transform:rotate(360deg)}}
      @media (max-width:520px){.ah-assistant{right:12px;bottom:12px}.ah-assistant__panel{right:0;bottom:68px;width:calc(100vw - 24px);height:min(600px,calc(100vh - 92px))}.ah-assistant--open .ah-assistant__panel{grid-template-rows:auto minmax(0,1fr) auto}.ah-assistant__button{width:60px;height:60px;border-radius:20px}.ah-assistant__button:after{border-radius:17px}.ah-assistant__button-mark{width:40px;height:40px}.ah-assistant__channels{right:0;bottom:70px;width:min(198px,calc(100vw - 24px));max-height:min(236px,calc(100vh - 100px))}.ah-assistant__channel{min-height:54px;border-radius:16px}.ah-assistant__actions{grid-template-columns:1fr}.ah-assistant__messages{padding-bottom:18px}.ah-assistant__quick-drawer{position:absolute;right:-1px;bottom:calc(100% + 8px);z-index:3;display:grid;grid-template-columns:38px minmax(0,1fr);align-items:end;width:min(304px,calc(100vw - 56px));transform:translateX(calc(100% - 38px));transition:transform .22s ease;pointer-events:none}.ah-assistant--quick-open .ah-assistant__quick-drawer{transform:translateX(0)}.ah-assistant__quick-toggle{display:grid;place-items:center;width:38px;min-height:48px;border:0;border-radius:8px 0 0 8px;background:var(--as-accent);color:var(--as-accent-text);font-size:22px;font-weight:1000;line-height:1;box-shadow:0 14px 34px rgba(2,8,20,.26);cursor:pointer;pointer-events:auto}.ah-assistant__quick-toggle span{display:block;transition:transform .2s ease}.ah-assistant--quick-open .ah-assistant__quick-toggle span{transform:rotate(180deg)}.ah-assistant__quick{max-height:166px;overflow:auto;display:flex;align-content:flex-start;gap:7px;padding:10px;border:1px solid var(--as-line);border-radius:8px 0 0 8px;background:var(--as-panel-bg);box-shadow:0 18px 52px rgba(2,8,20,.28);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .18s ease,visibility .18s ease}.ah-assistant--quick-open .ah-assistant__quick{opacity:1;visibility:visible;pointer-events:auto}.ah-assistant__quick button{min-height:34px;padding:7px 9px}.ah-assistant__form{padding:10px;grid-template-columns:minmax(0,1fr) 44px}.ah-assistant__input{min-height:40px}.ah-assistant__send{width:44px;height:40px}}
      @media (max-width:520px){html.ah-assistant-mobile-lock,body.ah-assistant-mobile-lock{overflow:hidden!important;height:100%!important;overscroll-behavior:none!important}body.ah-assistant-mobile-lock{position:fixed!important;inset:0!important;width:100%!important;touch-action:none!important}.ah-assistant.ah-assistant--open{position:fixed;inset:0;right:auto;bottom:auto;width:100dvw;height:100dvh;display:block;justify-items:stretch;gap:0}.ah-assistant.ah-assistant--open .ah-assistant__button,.ah-assistant.ah-assistant--open .ah-assistant__channels{display:none}.ah-assistant.ah-assistant--open .ah-assistant__panel{position:fixed;inset:0;width:100dvw;height:100dvh;max-width:none;max-height:none;border:0;border-radius:0;box-shadow:none;display:grid;grid-template-rows:auto minmax(0,1fr) auto}.ah-assistant.ah-assistant--open .ah-assistant__head{display:grid;grid-template-columns:auto minmax(0,1fr);justify-content:start;align-items:center;gap:10px;padding:calc(10px + env(safe-area-inset-top,0px)) 12px 10px}.ah-assistant.ah-assistant--open .ah-assistant__close{order:-1;width:auto;min-width:76px;height:38px;padding:0 12px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:0;border-radius:8px}.ah-assistant.ah-assistant--open .ah-assistant__close:before{content:"‹";font-size:26px;line-height:1}.ah-assistant.ah-assistant--open .ah-assistant__close:after{content:"Geri";font-size:13px;font-weight:900;line-height:1}.ah-assistant.ah-assistant--open .ah-assistant__title strong{font-size:14px}.ah-assistant.ah-assistant--open .ah-assistant__title span{font-size:11px}.ah-assistant.ah-assistant--open .ah-assistant__messages{min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;padding:14px 12px 18px}.ah-assistant.ah-assistant--open .ah-assistant__foot{padding-bottom:env(safe-area-inset-bottom,0px)}.ah-assistant.ah-assistant--open .ah-assistant__quick-drawer{right:0;bottom:calc(100% + 10px)}}
    `;
    document.head.appendChild(style);
  }

  function appendActions(item, actions) {
    const cleanActions = assistantActionButtons(actions);
    if (!cleanActions.length) return;

    const grid = document.createElement("div");
    grid.className = "ah-assistant__actions";
    cleanActions.forEach((action) => {
      const href = safeActionUrl(action.url);
      if (!href) return;
      const link = document.createElement("a");
      link.className = "ah-assistant__action";
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = normalizeText(action.label, 44);
      grid.appendChild(link);
    });

    if (grid.children.length) item.appendChild(grid);
  }

  function appendMessage(messages, role, text, actions) {
    const item = document.createElement("div");
    item.className = `ah-assistant__msg ah-assistant__msg--${role}`;
    const cleanActions = role === "assistant" ? assistantActionButtons(actions) : [];
    const textNode = document.createElement("div");
    textNode.className = "ah-assistant__msg-text";
    textNode.textContent = role === "assistant" ? stripUrlsForActions(text, cleanActions) : text;
    item.appendChild(textNode);
    if (role === "assistant") appendActions(item, cleanActions);
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
    return item;
  }

  function widgetMarkup() {
    const quickButtons = QUICK_OPTIONS.map((option) => {
      const attr = option.ticket ? "data-assistant-ticket" : "data-assistant-quick";
      return `<button type="button" ${attr}="${escapeHTML(option.message)}">${escapeHTML(option.label)}</button>`;
    }).join("");

    return `
      <div class="ah-assistant__channels" id="allonahub-assistant-channels" aria-label="Hızlı destek kanalları" data-assistant-channels>
        <button class="ah-assistant__channel ah-assistant__channel--chat" type="button" data-assistant-open-chat>
          <span class="ah-assistant__channel-icon" aria-hidden="true">AI</span>
          <span><strong>AI Asistan</strong><small>Web chat desteği</small></span>
        </button>
        <a class="ah-assistant__channel ah-assistant__channel--whatsapp" href="${CONTACT_CHANNELS.whatsapp}" target="_blank" rel="noopener noreferrer" data-assistant-channel-link>
          <span class="ah-assistant__channel-icon" aria-hidden="true">WA</span>
          <span><strong>WhatsApp</strong><small>Hızlı destek hattı</small></span>
        </a>
        <a class="ah-assistant__channel ah-assistant__channel--telegram" href="${CONTACT_CHANNELS.telegram}" target="_blank" rel="noopener noreferrer" data-assistant-channel-link>
          <span class="ah-assistant__channel-icon" aria-hidden="true">TG</span>
          <span><strong>Telegram</strong><small>Topluluk ve destek</small></span>
        </a>
      </div>
      <button class="ah-assistant__button" type="button" aria-label="AllonaHub hızlı destek seçeneklerini aç" aria-controls="allonahub-assistant-channels" aria-expanded="false" data-assistant-toggle>
        <span class="ah-assistant__button-mark" aria-hidden="true"><b>?</b><i>AI</i></span>
      </button>
      <section class="ah-assistant__panel" aria-label="AllonaHub destek asistanı">
        <header class="ah-assistant__head">
          <div class="ah-assistant__title">
            <strong>AllonaHub Destek</strong>
            <span>AI asistan</span>
          </div>
          <button class="ah-assistant__close" type="button" aria-label="Kapat" data-assistant-close>&times;</button>
        </header>
        <div class="ah-assistant__messages" data-assistant-messages></div>
        <div class="ah-assistant__foot">
          <div class="ah-assistant__quick-drawer">
            <button class="ah-assistant__quick-toggle" type="button" aria-label="Hazır seçenekleri aç" aria-expanded="false" aria-controls="allonahub-assistant-quick" data-assistant-quick-toggle>
              <span aria-hidden="true">‹</span>
            </button>
            <div class="ah-assistant__quick" id="allonahub-assistant-quick">
              ${quickButtons}
            </div>
          </div>
          <form class="ah-assistant__form" data-assistant-form>
            <textarea class="ah-assistant__input" rows="1" maxlength="1600" placeholder="Mesajınızı yazın" data-assistant-input></textarea>
            <button class="ah-assistant__send" type="submit" aria-label="Gönder" title="Gönder">›</button>
          </form>
        </div>
      </section>
    `;
  }

  async function postMessage(message, options) {
    const payload = {
      message,
      channel: options.channel,
      conversationId: conversationId(),
      createSupportTicket: Boolean(options.createSupportTicket),
      metadata: {
        widget_version: VERSION,
        url: window.location.href,
        page_title: document.title || "",
        referrer: document.referrer || "",
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      }
    };

    const response = await fetch(`${apiBaseUrl()}/v1/assistant/messages`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) {
      throw new Error(body.message || "Asistan yanıtı alınamadı.");
    }
    return body;
  }

  function mount(options) {
    if (document.querySelector("[data-allonahub-assistant-widget]")) return;
    styles();

    const state = {
      channel: configuredChannel(options),
      busy: false
    };

    const root = document.createElement("div");
    root.className = "ah-assistant";
    root.setAttribute("data-allonahub-assistant-widget", "");
    root.innerHTML = widgetMarkup();
    document.body.appendChild(root);

    const messages = root.querySelector("[data-assistant-messages]");
    const input = root.querySelector("[data-assistant-input]");
    const form = root.querySelector("[data-assistant-form]");
    const sendButton = root.querySelector(".ah-assistant__send");
    const toggleButton = root.querySelector("[data-assistant-toggle]");
    const quickToggleButton = root.querySelector("[data-assistant-quick-toggle]");
    const closeButton = root.querySelector("[data-assistant-close]");

    appendMessage(messages, "assistant", "Merhaba, AllonaHub AI destek asistanına hoş geldiniz. Sipariş, CV-kariyer, denizcilik, partnerlik, akademi ve destek konularında size hızlıca yardımcı olurum. Ne yapmak istediğinizi yazın; sizi en doğru adıma yönlendireyim.");

    function setActionsOpen(value) {
      root.classList.toggle("ah-assistant--actions-open", Boolean(value));
      if (toggleButton) toggleButton.setAttribute("aria-expanded", value ? "true" : "false");
    }

    function setQuickOpen(value) {
      root.classList.toggle("ah-assistant--quick-open", Boolean(value));
      const quick = root.querySelector(".ah-assistant__quick");
      const drawer = root.querySelector(".ah-assistant__quick-drawer");
      if (quick) {
        if (value) {
          quick.style.setProperty("opacity", "1", "important");
          quick.style.setProperty("visibility", "visible", "important");
          quick.style.setProperty("pointer-events", "auto", "important");
        } else {
          quick.style.removeProperty("opacity");
          quick.style.removeProperty("visibility");
          quick.style.removeProperty("pointer-events");
        }
      }
      if (drawer) {
        if (value) {
          drawer.style.setProperty("transform", "translateX(0)", "important");
        } else {
          drawer.style.removeProperty("transform");
        }
      }
      if (quickToggleButton) {
        quickToggleButton.setAttribute("aria-expanded", value ? "true" : "false");
        quickToggleButton.setAttribute("aria-label", value ? "Hazır seçenekleri kapat" : "Hazır seçenekleri aç");
      }
    }

    function setChatOpen(value) {
      root.classList.toggle("ah-assistant--open", Boolean(value));
      setAssistantMobileLock(value);
      if (closeButton) closeButton.setAttribute("aria-label", value && isMobileAssistantView() ? "Geri dön" : "Kapat");
      if (value) {
        setActionsOpen(false);
        input.focus();
      } else {
        setQuickOpen(false);
      }
    }

    function setBusy(value) {
      state.busy = value;
      sendButton.disabled = value;
      input.disabled = value;
    }

    async function submit(text, extra) {
      const clean = normalizeText(text, 1600);
      if (!clean || state.busy) return;
      if (!rateAllowed()) {
        appendMessage(messages, "status", "Çok sık mesaj gönderildi. Lütfen biraz bekleyin.");
        return;
      }

      appendMessage(messages, "user", clean);
      input.value = "";
      setBusy(true);
      const status = appendMessage(messages, "status", "Yanıt hazırlanıyor...");
      try {
        const result = await postMessage(clean, {
          channel: state.channel,
          createSupportTicket: extra && extra.createSupportTicket
        });
        status.remove();
        appendMessage(messages, "assistant", result.message || "Canlı destek için Telegram veya WhatsApp hattımızdan bize ulaşabilirsiniz.", result.actions || []);
      } catch (error) {
        status.remove();
        const fallback = textOnlyReplyForRequest(clean, rawUrlReplyForRequest(clean, localAssistantReply(clean)));
        appendMessage(messages, "assistant", fallback.message || error.message || "Şu anda yanıt veremedim. Lütfen daha sonra tekrar deneyin.", fallback.actions || []);
      } finally {
        setBusy(false);
        setQuickOpen(false);
        input.focus();
      }
    }

    toggleButton.addEventListener("click", () => {
      const next = !root.classList.contains("ah-assistant--actions-open");
      setChatOpen(false);
      setActionsOpen(next);
    });

    root.querySelector("[data-assistant-open-chat]").addEventListener("click", () => {
      setChatOpen(true);
    });

    root.querySelector("[data-assistant-close]").addEventListener("click", () => {
      setChatOpen(false);
    });

    if (quickToggleButton) {
      quickToggleButton.addEventListener("click", () => {
        setQuickOpen(!root.classList.contains("ah-assistant--quick-open"));
      });
    }

    root.querySelectorAll("[data-assistant-channel-link]").forEach((link) => {
      link.addEventListener("click", () => setActionsOpen(false));
    });

    document.addEventListener("click", (event) => {
      if (!root.contains(event.target)) {
        setActionsOpen(false);
        setQuickOpen(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setActionsOpen(false);
        setChatOpen(false);
        setQuickOpen(false);
      }
    });

    window.addEventListener("resize", () => {
      setAssistantMobileLock(root.classList.contains("ah-assistant--open"));
      if (closeButton) {
        closeButton.setAttribute("aria-label", root.classList.contains("ah-assistant--open") && isMobileAssistantView() ? "Geri dön" : "Kapat");
      }
    });

    root.querySelectorAll("[data-assistant-quick]").forEach((button) => {
      button.addEventListener("click", () => {
        setQuickOpen(false);
        submit(button.dataset.assistantQuick || "");
      });
    });

    root.querySelectorAll("[data-assistant-ticket]").forEach((button) => {
      button.addEventListener("click", () => {
        setQuickOpen(false);
        submit(button.dataset.assistantTicket || "", { createSupportTicket: true });
      });
    });

    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 110)}px`;
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submit(input.value);
    });
  }

  App.assistantWidget = {
    mount,
    open() {
      const root = document.querySelector("[data-allonahub-assistant-widget]");
      if (root) {
        root.classList.remove("ah-assistant--actions-open", "ah-assistant--quick-open");
        root.classList.add("ah-assistant--open");
        setAssistantMobileLock(true);
        root.querySelector("[data-assistant-toggle]")?.setAttribute("aria-expanded", "false");
        root.querySelector("[data-assistant-quick-toggle]")?.setAttribute("aria-expanded", "false");
        root.querySelector("[data-assistant-close]")?.setAttribute("aria-label", isMobileAssistantView() ? "Geri dön" : "Kapat");
        const quick = root.querySelector(".ah-assistant__quick");
        const drawer = root.querySelector(".ah-assistant__quick-drawer");
        if (quick) quick.removeAttribute("style");
        if (drawer) drawer.removeAttribute("style");
      }
    },
    close() {
      const root = document.querySelector("[data-allonahub-assistant-widget]");
      if (root) {
        root.classList.remove("ah-assistant--open", "ah-assistant--actions-open", "ah-assistant--quick-open");
        setAssistantMobileLock(false);
        root.querySelector("[data-assistant-toggle]")?.setAttribute("aria-expanded", "false");
        root.querySelector("[data-assistant-quick-toggle]")?.setAttribute("aria-expanded", "false");
        root.querySelector("[data-assistant-close]")?.setAttribute("aria-label", "Kapat");
        const quick = root.querySelector(".ah-assistant__quick");
        const drawer = root.querySelector(".ah-assistant__quick-drawer");
        if (quick) quick.removeAttribute("style");
        if (drawer) drawer.removeAttribute("style");
      }
    }
  };

  const autoMount = !SCRIPT || SCRIPT.dataset.autoMount !== "false";
  if (autoMount) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => mount());
    } else {
      mount();
    }
  }
})();
