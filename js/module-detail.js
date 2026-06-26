(function () {
  const params = new URLSearchParams(window.location.search);
  const rawQuery = safeText(params.get("q") || params.get("topic") || "AllonaHub");
  const rawModule = safeText(params.get("module") || params.get("source") || "");

  const profiles = [
    {
      keys: ["denizcilik", "maritime", "crew", "navlun", "gemi", "liman", "chartering", "broker"],
      title: "Allona Denizcilik",
      accent: "#00b4d8",
      moduleUrl: "allonadenizcilik.html",
      partnerLabel: "Denizcilik Partneri Ol",
      lead: "Crew, navlun, gemi, brokerlik, liman, acente ve operasyon süreçleri tek profesyonel maritime akışında toplanır.",
      cards: ["Crew ve sertifika kontrolü", "Yük, rota ve navlun talebi", "Gemi ilanı ve broker eşleşmesi", "Operasyon ve evrak takibi"]
    },
    {
      keys: ["kariyer", "is", "iş", "uzaktan", "freelance", "staj", "yazılım", "satis", "satış", "mezun"],
      title: "Allona Kariyer",
      accent: "#4cc9f0",
      moduleUrl: "../career/allonakariyer.html",
      partnerLabel: "İşveren Partneri Ol",
      lead: "İlan, aday, CV ve başvuru süreçleri sektör seçimine uygun şekilde yönetilecek kariyer alanına bağlanır.",
      cards: ["Meslek ve çalışma modeli", "Akıllı CV yönlendirmesi", "Başvuru takip altyapısı", "İşveren panel eşleşmesi"]
    },
    {
      keys: ["saglik", "sağlık", "doktor", "klinik", "eczane", "dis", "diş", "psikolog", "vitamin", "bakım"],
      title: "Allona Sağlık",
      accent: "#35d07f",
      moduleUrl: "allonasaglik.html",
      partnerLabel: "Sağlık Partneri Ol",
      lead: "Klinik, doktor, eczane, bakım ve randevu ihtiyaçları güvenli başvuru ve takip mantığıyla ayrıştırılır.",
      cards: ["Randevu veya talep", "Klinik/uzman profili", "Güvenli bilgilendirme", "Panelden süreç takibi"]
    },
    {
      keys: ["guzellik", "güzellik", "kozmetik", "spa", "lazer", "kuaför", "kuafor", "makyaj"],
      title: "Allona Güzellik",
      accent: "#ff8ccf",
      moduleUrl: "allonaguzellik.html",
      partnerLabel: "Güzellik Partneri Ol",
      lead: "Bakım, güzellik merkezi, kozmetik, randevu ve kampanya akışları premium hizmet deneyimine dönüştürülür.",
      cards: ["Randevu planı", "Hizmet paketi", "Kupon ve HP avantajı", "Partner merkez seçimi"]
    },
    {
      keys: ["seyahat", "tatil", "otel", "uçak", "ucak", "tur", "transfer", "vize", "rota"],
      title: "Allona Seyahat",
      accent: "#28c7ff",
      moduleUrl: "allonaseyahat.html",
      partnerLabel: "Seyahat Partneri Ol",
      lead: "Otel, bilet, tur, transfer ve vize ihtiyaçları rezervasyon odaklı net bir akışla sunulur.",
      cards: ["Rota ve tarih", "Rezervasyon ön talebi", "Transfer bağlantısı", "Seyahat sigortası"]
    },
    {
      keys: ["sigorta", "poliçe", "police", "kasko", "konut", "hayat", "hasar"],
      title: "Allona Sigorta",
      accent: "#90dbf4",
      moduleUrl: "allonasigorta.html",
      partnerLabel: "Sigorta Partneri Ol",
      lead: "Araç, sağlık, seyahat, konut ve işletme sigortaları için teklif, poliçe ve hasar akışı hazırlanır.",
      cards: ["Teklif karşılaştırma", "Poliçe takibi", "Hasar bildirimi", "Finans ve ödeme bağlantısı"]
    },
    {
      keys: ["egitim", "eğitim", "kurs", "üniversite", "universite", "dil", "sertifika", "akademy", "academy"],
      title: "Allona Eğitim",
      accent: "#7cdaff",
      moduleUrl: "allonaegitim.html",
      partnerLabel: "Eğitim Partneri Ol",
      lead: "Kurs, sertifika, üniversite başvurusu ve online eğitim süreçleri öğrenci odaklı bir alana bağlanır.",
      cards: ["Program keşfi", "Sertifika takibi", "Başvuru dosyası", "Kariyer bağlantısı"]
    },
    {
      keys: ["finans", "kredi", "pos", "yatırım", "yatirim", "mevduat", "kobi", "finansman"],
      title: "Allona Finans",
      accent: "#58d68d",
      moduleUrl: "allonafinans.html",
      partnerLabel: "Finans Partneri Ol",
      lead: "Finansman, POS, kredi ve teklif süreçleri sadece bilgi veren değil, başvuruya hazırlayan bir yapıda sunulur.",
      cards: ["Ön talep", "Teklif karşılaştırma", "Partner finans ürünü", "Ödeme/kupon bağlantısı"]
    },
    {
      keys: ["hukuk", "avukat", "sözleşme", "sozlesme", "icra", "aile", "ceza", "arabuluculuk"],
      title: "Allona Hukuk",
      accent: "#8ec5ff",
      moduleUrl: "allonahukuk.html",
      partnerLabel: "Hukuk Partneri Ol",
      lead: "Hukuki ihtiyaçlar konu, belge, uzmanlık alanı ve güvenli danışmanlık başvurusu olarak ayrıştırılır.",
      cards: ["Konu seçimi", "Belge hazırlığı", "Uzman eşleşmesi", "Güvenli görüşme talebi"]
    },
    {
      keys: ["organizasyon", "dugun", "düğün", "nişan", "nisan", "kına", "kina", "catering", "balayı"],
      title: "Allona Organizasyon",
      accent: "#ffd166",
      moduleUrl: "allonaorganizasyon.html",
      partnerLabel: "Organizasyon Partneri Ol",
      lead: "Düğün, davet, kurumsal etkinlik ve paket planlama süreçleri teklif odaklı bir deneyime dönüşür.",
      cards: ["Paket planı", "Mekan ve ekip", "Bütçe kontrolü", "Süreç takibi"]
    },
    {
      keys: ["kurye", "teslimat", "express", "motor", "kargo"],
      title: "Allona Kurye",
      accent: "#00f5d4",
      moduleUrl: "allonakurye.html",
      partnerLabel: "Kurye Partneri Ol",
      lead: "Yemek, market, shop kargo ve express teslimat talepleri operasyon takibine uygun şekilde kurulur.",
      cards: ["Teslimat türü", "Alış ve varış adresi", "Kurye eşleşmesi", "Canlı takip hazırlığı"]
    },
    {
      keys: ["lojistik", "fulfillment", "ihracat", "ithalat", "gümrük", "gumruk", "depo", "soğuk", "soguk"],
      title: "Allona Lojistik",
      accent: "#00bbf9",
      moduleUrl: "allonalojistik.html",
      partnerLabel: "Lojistik Partneri Ol",
      lead: "Kargo, depo, fulfillment, ihracat ve ağır yük süreçleri işletme ölçeğinde akışa hazırlanır.",
      cards: ["Gönderi profili", "Depo/fulfillment", "Gümrük adımı", "Sevkiyat raporu"]
    },
    {
      keys: ["nakliye", "tasima", "taşıma", "evden", "ofis", "asansörlü", "asansorlu", "paketleme"],
      title: "Allona Nakliye",
      accent: "#f9844a",
      moduleUrl: "allonanakliye.html",
      partnerLabel: "Nakliye Partneri Ol",
      lead: "Ev, ofis, parça eşya, paketleme ve sigortalı taşıma süreçleri teklif ve planlama odaklı ilerler.",
      cards: ["Eşya ve rota", "Araç/ekip seçimi", "Sigorta bilgisi", "Taşınma planı"]
    },
    {
      keys: ["ev", "hizmetleri", "temizlik", "tesisat", "elektrik", "boya", "montaj", "tamir", "bahçe"],
      title: "Allona Ev Hizmetleri",
      accent: "#f9c74f",
      moduleUrl: "allonaevhizmetleri.html",
      partnerLabel: "Ev Hizmeti Partneri Ol",
      lead: "Temizlik, tesisat, elektrik, boya ve bakım işleri randevu ve teklif mantığıyla kullanıcıya anlatılır.",
      cards: ["Hizmet türü", "Randevu zamanı", "Usta/ekip seçimi", "İş tamamlanma takibi"]
    },
    {
      keys: ["evcil", "pet", "veteriner", "mama", "sahiplendirme", "petshop", "kuaför", "otel"],
      title: "Allona Evcil Hayvan",
      accent: "#f4a261",
      moduleUrl: "allonaevcilhayvan.html",
      partnerLabel: "Pet Partneri Ol",
      lead: "Veteriner, petshop, sahiplendirme, kayıp ilanı ve bakım ihtiyaçları tek pet profiliyle eşleşir.",
      cards: ["Pet profili", "Veteriner randevusu", "Ürün ve bakım", "Aşı/evrak takibi"]
    },
    {
      keys: ["otomotiv", "arac", "araç", "ekspertiz", "kiralama", "yedek", "servis", "galeri"],
      title: "Allona Otomotiv",
      accent: "#ffbf69",
      moduleUrl: "allonaotomotiv.html",
      partnerLabel: "Otomotiv Partneri Ol",
      lead: "Araç alım-satım, ekspertiz, kiralama, servis ve finansman bağlantıları tek otomotiv akışında toplanır.",
      cards: ["Araç profili", "Ekspertiz", "Finansman bağlantısı", "Servis/garanti"]
    },
    {
      keys: ["teknoloji", "garanti", "elektronik", "yazılım", "yazilim", "ai", "cihaz"],
      title: "Allona Teknoloji",
      accent: "#64dfdf",
      moduleUrl: "allonateknoloji.html",
      partnerLabel: "Teknoloji Partneri Ol",
      lead: "Elektronik, yazılım, garanti, cihaz ve dijital çözüm başlıkları teknik destek akışına hazırlanır.",
      cards: ["Ürün/cihaz bilgisi", "Garanti takibi", "Teknik servis", "Dijital çözüm talebi"]
    },
    {
      keys: ["tarim", "tarım", "tohum", "gübre", "gubre", "çiftçi", "ciftci", "fiyat"],
      title: "Allona Tarım",
      accent: "#80ed99",
      moduleUrl: "allonatarim.html",
      partnerLabel: "Tarım Partneri Ol",
      lead: "Tohum, gübre, ürün fiyatları, danışmanlık ve çiftçi ihtiyaçları üretim odaklı şekilde ayrıştırılır.",
      cards: ["Ürün/fiyat takibi", "Tedarik talebi", "Danışmanlık", "Çiftçi destek akışı"]
    },
    {
      keys: ["insaat", "inşaat", "yapi", "yapı", "müteahhit", "muteahhit", "mimarlık", "tadilat", "malzeme"],
      title: "Allona İnşaat",
      accent: "#adb5bd",
      moduleUrl: "allonainsaat.html",
      partnerLabel: "Yapı Partneri Ol",
      lead: "Proje, teklif, yapı market, mimarlık, mühendislik ve tadilat ihtiyaçları proje akışında toplanır.",
      cards: ["Proje tipi", "Malzeme ve ekip", "Teklif karşılaştırma", "Saha takip hazırlığı"]
    },
    {
      keys: ["eglence", "eğlence", "etkinlik", "bilet", "konser", "festival", "tiyatro", "sinema", "futbol"],
      title: "Allona Eğlence",
      accent: "#ff6bcb",
      moduleUrl: "allonaeglence.html",
      partnerLabel: "Etkinlik Partneri Ol",
      lead: "Bilet, etkinlik, konser, maç ve VIP loca deneyimleri QR bilet ve rezervasyon akışına hazırlanır.",
      cards: ["Etkinlik seçimi", "Bilet/koltuk", "QR giriş", "HP avantajı"]
    },
    {
      keys: ["spor", "fitness", "pilates", "yoga", "antrenör", "antrenor", "supplement"],
      title: "Allona Spor & Fitness",
      accent: "#95d5b2",
      moduleUrl: "allonasporfitness.html",
      partnerLabel: "Spor Partneri Ol",
      lead: "Spor salonu, antrenör, yoga, pilates, supplement ve ekipman başlıkları sağlıklı yaşam akışına bağlanır.",
      cards: ["Program seçimi", "Randevu/üyelik", "Ürün ve ekipman", "HP motivasyon akışı"]
    }
  ];

  function safeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, 160);
  }

  function normalize(value) {
    return safeText(value).toLocaleLowerCase("tr-TR");
  }

  function titleCase(value) {
    return safeText(value)
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toLocaleUpperCase("tr-TR") + part.slice(1))
      .join(" ");
  }

  function pickProfile() {
    const haystack = normalize(`${rawModule} ${rawQuery}`);
    return profiles.find((profile) => profile.keys.some((key) => haystack.includes(key))) || {
      keys: [],
      title: "AllonaHub Ekosistemi",
      accent: "#00e5ff",
      moduleUrl: "../../index.html#modules",
      partnerLabel: "Ekosisteme Katıl",
      lead: "Seçilen hizmet, kategori veya başlık AllonaHub ortak tasarım sistemi içinde bilgi ve aksiyon sayfası olarak hazırlanır.",
      cards: ["Modül bilgisi", "Kullanıcı aksiyonu", "Partner eşleşmesi", "Panel takibi"]
    };
  }

  function topicFromQuery(profile) {
    const original = safeText(rawQuery || profile.title);
    const words = original.split(" ").filter(Boolean);
    const leadingHints = new Set([
      "allona", "hub", "ekosistem", "kategori",
      "denizcilik", "maritime",
      "kariyer", "is", "iş",
      "saglik", "sağlık",
      "guzellik", "güzellik", "kozmetik",
      "seyahat", "tatil",
      "sigorta",
      "egitim", "eğitim",
      "finans",
      "hukuk",
      "organizasyon", "dugun", "düğün",
      "kurye", "teslimat",
      "lojistik", "kargo",
      "nakliye", "tasima", "taşıma",
      "ev", "hizmetleri",
      "evcil", "hayvan", "pet",
      "otomotiv", "arac", "araç",
      "teknoloji",
      "tarim", "tarım",
      "insaat", "inşaat", "yapi", "yapı",
      "eglence", "eğlence", "etkinlik", "bilet",
      "spor", "fitness"
    ]);
    while (words.length > 1 && leadingHints.has(normalize(words[0]))) {
      words.shift();
    }
    const topic = safeText(words.join(" ")) || original || profile.title.replace(/^Allona\s+/i, "");
    return titleCase(topic);
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function setText(selector, text) {
    const node = document.querySelector(selector);
    if (node) node.textContent = text;
  }

  function setHref(selector, href) {
    const node = document.querySelector(selector);
    if (node) node.href = href;
  }

  function makeLink(label, href, primary) {
    const a = document.createElement("a");
    a.className = primary ? "detail-btn detail-btn--primary" : "detail-btn";
    a.href = href;
    a.textContent = label;
    return a;
  }

  function makeCard(title, copy) {
    const card = document.createElement("article");
    card.className = "detail-card";
    const b = document.createElement("b");
    b.textContent = title;
    const p = document.createElement("p");
    p.textContent = copy;
    card.append(b, p);
    return card;
  }

  function makeStep(index, title, copy) {
    const step = document.createElement("article");
    step.className = "detail-step";
    const small = document.createElement("small");
    small.textContent = String(index);
    const b = document.createElement("b");
    b.textContent = title;
    const p = document.createElement("p");
    p.textContent = copy;
    step.append(small, b, p);
    return step;
  }

  function relativeLoginUrl() {
    const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    return `../account/user.html?returnTo=${returnTo}`;
  }

  function partnerUrl(profile, topic) {
    return `../partner/partner.html?module=${encodeURIComponent(profile.title)}&intent=application&q=${encodeURIComponent(topic)}`;
  }

  function render() {
    const profile = pickProfile();
    const topic = topicFromQuery(profile);
    const title = `${profile.title}: ${topic}`;
    document.body.style.setProperty("--detail-accent", profile.accent);
    document.title = `${title} | AllonaHub`;

    setText("[data-detail-eyebrow]", profile.title);
    setText("[data-detail-title]", title);
    setText("[data-detail-lead]", `${profile.lead} Bu sayfa "${topic}" başlığı için kullanıcıya ne yapacağını, hangi bilgiler gerektiğini ve hangi AllonaHub akışına devam edeceğini açıklar.`);
    setText("[data-detail-panel-title]", `${topic} Akışı`);
    setText("[data-detail-panel-copy]", "Tıklanan boş alan artık alakasız sayfaya gitmez; bu konu için açıklama, talep, panel ve partner bağlantısı sunar.");
    setText("[data-detail-panel-meta]", "Tema, dil altyapısı ve ortak footer ile uyumlu");
    setText("[data-detail-scope-title]", `${topic} için hazırlanan yapı`);
    setText("[data-detail-scope-copy]", `${profile.title} içinde ${topic} başlığına özel bilgi, süreç ve sonraki adım kartları.`);
    setText("[data-detail-input-title]", title);
    setText("[data-detail-input-need]", `${topic} için ihtiyacınızı seçin, kısa açıklama girin ve giriş yaptıktan sonra ilgili panel akışından takip edin.`);
    setText("[data-detail-note]", `${profile.title} modülünde ${topic} başlığı için gerçek backend verisi hazır olduğunda bu sayfa ilan, başvuru, teklif veya randevu kayıtlarını gösterecek şekilde genişletilebilir. Şimdilik kullanıcıyı bilgilendiren ve doğru aksiyona yönlendiren güvenli bir ara katman olarak çalışır.`);

    const actions = document.querySelector("[data-detail-actions]");
    if (actions) {
      actions.replaceChildren(
        makeLink("Giriş Yap ve Talep Oluştur", relativeLoginUrl(), true),
        makeLink(profile.partnerLabel, partnerUrl(profile, topic), false),
        makeLink("Ana Modüle Dön", profile.moduleUrl, false)
      );
    }
    setHref("[data-detail-login]", relativeLoginUrl());

    const cards = document.querySelector("[data-detail-cards]");
    if (cards) {
      cards.replaceChildren(
        ...profile.cards.map((cardTitle, index) => makeCard(cardTitle, [
          `${topic} ihtiyacını doğru bilgi alanlarıyla anlatır.`,
          "Kullanıcı, giriş yaptıktan sonra kendi panelinde süreci takip eder.",
          "Partner tarafı başvuru veya teklif akışına bağlanır.",
          "HP, kupon, bildirim ve güvenli işlem altyapısına hazır kalır."
        ][index] || "Bu başlık AllonaHub ekosistemindeki ilgili modüle bağlanır."))
      );
    }

    const flow = document.querySelector("[data-detail-flow]");
    if (flow) {
      flow.replaceChildren(
        makeStep(1, "Bilgi", `${topic} için gerekli temel bilgiler kullanıcıya sade şekilde gösterilir.`),
        makeStep(2, "Giriş", "Kişisel işlem gerekiyorsa kullanıcı güvenli giriş ekranına yönlenir."),
        makeStep(3, "Talep", "Talep, başvuru, randevu veya teklif mantığı modüle göre ayrıştırılır."),
        makeStep(4, "Eşleşme", "Uygun partner, ilan, ürün, uzman veya hizmet veren akışa dahil edilir."),
        makeStep(5, "Takip", "Bildirim, panel, HP ve geçmiş kayıtlarıyla süreç izlenebilir hale gelir.")
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
