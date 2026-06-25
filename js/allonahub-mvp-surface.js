(function () {
  const App = window.Allona = window.Allona || {};
  const mvp = App.mvp;
  const pageKey = document.body.dataset.mvpPage || "daily-center";

  const userNav = [
    ["Ana Sayfa", "/index.html"],
    ["Keşif", "/pages/search/discover.html"],
    ["Kupon Merkezi", "/pages/commerce/coupon-center.html"],
    ["Bildirimlerim", "/pages/account/notifications.html"],
    ["Siparişlerim", "/pages/account/orders.html"]
  ];

  const partnerNav = [
    ["Onboarding", "/pages/partner/onboarding.html"],
    ["Ürünler", "/pages/partner/products.html"],
    ["Kazanç", "/pages/partner/earnings-preview.html"],
    ["Kampanyalar", "/pages/partner/campaigns.html"],
    ["Payout", "/pages/partner/payouts.html"]
  ];

  const adminNav = [
    ["Partnerler", "/admin/partners.html"],
    ["Ürün Onayı", "/admin/product-reviews.html"],
    ["Ana Sayfa", "/admin/home-sections.html"],
    ["Finans", "/admin/finance.html"],
    ["Risk", "/admin/risk.html"],
    ["Kampanya", "/admin/campaigns.html"],
    ["Bildirim", "/admin/notifications.html"]
  ];

  const pageMeta = {
    "coupon-center": {
      scope: "user",
      eyebrow: "Kupon Merkezi",
      title: "Cüzdan-Kupon, HP/XP ve indirim hakların tek yerde",
      text: "Gerçek para cüzdanı değil; kupon, HP/XP, seviye avantajı ve kampanya hakkı olarak çalışan MVP avantaj merkezi."
    },
    discover: {
      scope: "user",
      eyebrow: "Keşif Motoru",
      title: "Onaylı ürünleri, güvenilir partnerleri ve kampanyaları keşfet",
      text: "Arama, modül, kategori, sponsorlu vitrin ve kalite puanı sinyalleriyle daha güvenli alışveriş deneyimi."
    },
    notifications: {
      scope: "user",
      eyebrow: "Bildirimlerim",
      title: "Sipariş, kupon, HP/XP ve destek bildirimlerin",
      text: "MVP'de in-app bildirimler aktif; e-posta, SMS ve push tercihleri entegrasyon için hazır bekler."
    },
    "partner-onboarding": {
      scope: "partner",
      eyebrow: "Partner Onboarding",
      title: "Doğrulanabilir partner başvuru ve yayın hazırlığı",
      text: "Başvuru, işletme bilgileri, ödeme bilgisi, ilk ürün ve admin onayı aşamaları tek akışta izlenir."
    },
    "partner-products": {
      scope: "partner",
      eyebrow: "Ürün Kalite Merkezi",
      title: "Ürünlerini kalite puanı ve onay durumuyla yönet",
      text: "70 altındaki ürün onaya gönderilemez; admin onayı olmadan kullanıcı tarafında yayınlanmaz."
    },
    "partner-product-form": {
      scope: "partner",
      eyebrow: "Ürün Ekle / Düzenle",
      title: "Kalite puanlı ürün formu ve AI yardımcı hazırlığı",
      text: "Başlık, açıklama, SEO, kategori, görsel, stok ve teslimat bilgisi tamamlandıkça kalite puanı yükselir."
    },
    "partner-earnings": {
      scope: "partner",
      eyebrow: "Kazanç Ön İzleme",
      title: "Satış fiyatı, komisyon ve net kazanç simülasyonu",
      text: "Partner yalnızca kendi komisyon profilini ve tahmini kesintilerini görüntüler."
    },
    "partner-campaigns": {
      scope: "partner",
      eyebrow: "Partner Kampanya Talebi",
      title: "Kampanya öner, admin onayını takip et",
      text: "Partner kampanyaları doğrudan kullanıcıya gönderilmez; admin onayı ve bildirim limitleriyle çalışır."
    },
    "partner-payouts": {
      scope: "partner",
      eyebrow: "Partner Alacakları",
      title: "Satış, komisyon, iade ve net ödeme özetin",
      text: "MVP'de ödeme talebi oluşturma kapalı; partner sadece kendi payout özetini görüntüler."
    },
    "admin-partners": {
      scope: "admin",
      eyebrow: "Admin Partner Denetimi",
      title: "Partner doğrulama, risk ve onboarding yönetimi",
      text: "Admin partnerleri onaylar, bilgi ister, askıya alır ve doğrulama loglarını izler."
    },
    "admin-product-reviews": {
      scope: "admin",
      eyebrow: "Ürün Onay Sistemi",
      title: "Onay bekleyen ürünleri kalite puanıyla incele",
      text: "Admin onay, revizyon veya red kararı verir; public katalog yalnızca approved ürünleri gösterir."
    },
    "admin-commission-profiles": {
      scope: "admin",
      eyebrow: "Komisyon Profilleri",
      title: "Partner komisyon profillerini yönet",
      text: "Varsayılan, yeni partner, premium ve stratejik oran profilleri buradan yönetilir."
    },
    "admin-home-sections": {
      scope: "admin",
      eyebrow: "Akıllı Ana Sayfa",
      title: "Ana sayfa bloklarını sırala ve aktif/pasif yönet",
      text: "Hero, modül kısayolları, kupon, sponsorlu vitrin, HP/XP görevleri ve favori blokları kontrol edilir."
    },
    "admin-reward-tasks": {
      scope: "admin",
      eyebrow: "HP/XP Görev Motoru",
      title: "Etik sadakat görevlerini ve ödül limitlerini yönet",
      text: "Günlük giriş küçük kalır; ana HP/XP gerçek değer üreten eylemlerden gelir."
    },
    "admin-user-events": {
      scope: "admin",
      eyebrow: "Kullanıcı Eventleri",
      title: "Keşif motoru için davranış verisi özeti",
      text: "Sayfa, ürün, kategori, arama, kupon ve modül etkileşimleri AI hazırlığı için toplanır."
    },
    "admin-finance": {
      scope: "admin",
      eyebrow: "Finans Merkezi",
      title: "Financial ledger, ödeme denemeleri ve partner alacakları",
      text: "Ledger kayıtları silinmez; düzeltmeler status veya adjustment kayıtlarıyla yapılır."
    },
    "admin-risk": {
      scope: "admin",
      eyebrow: "Fraud/Risk Kontrol",
      title: "Riskli sipariş, kullanıcı ve partner sinyalleri",
      text: "Çoklu ödeme hatası, iade yoğunluğu, yüksek kupon/HP kullanımı ve manuel flag kayıtları izlenir."
    },
    "admin-refunds": {
      scope: "admin",
      eyebrow: "Refund/Cancel Center",
      title: "İade, kısmi iade ve iptal taleplerini yönet",
      text: "Nihai iade/iptal kararı admin tarafındadır; partner yalnızca kendi kalemleriyle ilgili talebi görür."
    },
    "admin-payouts": {
      scope: "admin",
      eyebrow: "Partner Payout",
      title: "Dönem bazlı partner alacaklarını onayla",
      text: "Riskli partner ödemeleri held yapılabilir; paid işaretleme admin kontrolünde kalır."
    },
    "admin-campaigns": {
      scope: "admin",
      eyebrow: "CRM Kampanya Motoru",
      title: "Segment, kampanya ve teslimat yönetimi",
      text: "Partner talepleri pending_review gelir; admin onayı olmadan kullanıcıya gönderilmez."
    },
    "admin-segments": {
      scope: "admin",
      eyebrow: "CRM Segmentleri",
      title: "Kullanıcı segmentleri ve üyelikleri",
      text: "MVP'de manuel veya basit rule-based segmentler kullanılır; AI öneri motoruna hazırdır."
    },
    "admin-notifications": {
      scope: "admin",
      eyebrow: "Bildirim Yönetimi",
      title: "Sistem duyurusu ve bildirim geçmişi",
      text: "Kampanya bildirimleri tercihlere ve günlük limitlere uyar; güvenlik/sipariş bildirimleri önceliklidir."
    }
  };

  function navFor(scope) {
    if (scope === "admin") return adminNav;
    if (scope === "partner") return partnerNav;
    return userNav;
  }

  function shell(meta, body) {
    return `
      <div class="mvp-shell">
        <header class="mvp-topbar">
          <div class="mvp-topbar__inner">
            <a class="mvp-brand" href="${mvp.url("/index.html")}">
              <img src="${mvp.url("/images/brand/allona.logo.png")}" alt="AllonaHub">
              <span><span class="gold">Allona</span><span class="blue">Hub</span></span>
            </a>
            <nav class="mvp-nav" aria-label="MVP menü">
              ${navFor(meta.scope).map(([label, href]) => `<a href="${mvp.url(href)}">${mvp.escapeHTML(label)}</a>`).join("")}
            </nav>
            <div class="mvp-actions">
              <a href="${mvp.url("/pages/account/user.html")}">Giriş</a>
              <a href="${mvp.url("/pages/commerce/cart.html")}">Sepet</a>
            </div>
          </div>
        </header>
        <main class="mvp-main">
          <section class="mvp-hero">
            <div class="mvp-hero__copy">
              <p class="mvp-eyebrow">${mvp.escapeHTML(meta.eyebrow)}</p>
              <h1>${mvp.escapeHTML(meta.title)}</h1>
              <p>${mvp.escapeHTML(meta.text)}</p>
            </div>
            <aside class="mvp-hero__aside">
              <div class="mvp-stat-grid" data-mvp-stats>
                <div class="mvp-stat"><span>Durum</span><strong>MVP</strong></div>
                <div class="mvp-stat"><span>Güvenlik</span><strong>RLS</strong></div>
                <div class="mvp-stat"><span>Dil</span><strong>HP/XP</strong></div>
              </div>
              <div class="mvp-status">Gerçek para cüzdanı dili kullanılmaz; Cüzdan-Kupon, Kupon Merkezi, HP/XP ve Avantajlarım dili kullanılır.</div>
            </aside>
          </section>
          ${body}
        </main>
        <footer class="mvp-footer"><div class="mvp-footer__inner"><span>AllonaHub MVP Günlük Geliştirme Merkezi</span><span>Yerel preview / migration deploy bekler</span></div></footer>
      </div>
    `;
  }

  function status(message, type) {
    return `<div class="mvp-status ${type ? `mvp-status--${type}` : ""}">${mvp.escapeHTML(message)}</div>`;
  }

  function table(headers, rows, emptyText) {
    if (!rows.length) return `<div class="mvp-empty">${mvp.escapeHTML(emptyText || "Kayıt bulunamadı.")}</div>`;
    return `
      <div class="mvp-table-wrap">
        <table class="mvp-table">
          <thead><tr>${headers.map((item) => `<th>${mvp.escapeHTML(item)}</th>`).join("")}</tr></thead>
          <tbody>${rows.join("")}</tbody>
        </table>
      </div>
    `;
  }

  async function loadRows(tableName, options) {
    try {
      const { data, error } = await mvp.select(tableName, options || {});
      if (error) throw error;
      return data || [];
    } catch (error) {
      return [];
    }
  }

  function couponCard(coupon) {
    const value = coupon.discount_type === "percent" ? `%${coupon.discount_value}` : mvp.money(coupon.discount_value);
    return `
      <article class="mvp-card mvp-coupon">
        <span class="mvp-pill">${mvp.escapeHTML(coupon.module || "shop")}</span>
        <strong>${mvp.escapeHTML(value)}</strong>
        <h3>${mvp.escapeHTML(coupon.title || coupon.code || "Kupon")}</h3>
        <p>${mvp.escapeHTML(coupon.description || "Minimum sepet, süre ve kullanım limiti kuralları geçerlidir.")}</p>
        <small>${mvp.escapeHTML(coupon.badge_text || coupon.visibility || "public")}</small>
        <button class="mvp-btn" type="button" data-copy-code="${mvp.escapeHTML(coupon.code || "")}">Kodu Kullan</button>
      </article>
    `;
  }

  async function renderCouponCenter() {
    const [coupons, tasks] = await Promise.all([
      loadRows("coupons", { columns: "*", filters: [{ column: "is_active", value: true }], order: { column: "priority", ascending: false }, limit: 12 }),
      loadRows("reward_tasks", { columns: "*", filters: [{ column: "is_active", value: true }], limit: 8 })
    ]);
    return `
      <section class="mvp-section">
        <div class="mvp-section__head"><h2>Kullanılabilir Kuponlar</h2><span class="mvp-pill mvp-pill--gold">Cüzdan-Kupon</span></div>
        <div class="mvp-grid">${(coupons.length ? coupons : sampleCoupons()).map(couponCard).join("")}</div>
      </section>
      <section class="mvp-section">
        <div class="mvp-section__head"><h2>HP/XP Görevleri</h2><span class="mvp-pill">Para değildir</span></div>
        <div class="mvp-grid">${(tasks.length ? tasks : sampleTasks()).map((task) => `
          <article class="mvp-card">
            <h3>${mvp.escapeHTML(task.title)}</h3>
            <p>${mvp.escapeHTML(task.description || "")}</p>
            <p><strong>${Number(task.hp_reward || 0)} HP</strong> / <strong>${Number(task.xp_reward || 0)} XP</strong></p>
          </article>
        `).join("")}</div>
      </section>
    `;
  }

  async function renderDiscover() {
    const [products, categories, modules] = await Promise.all([
      loadRows("products", { columns: "*", filters: [{ column: "approval_status", value: "approved" }], order: { column: "ranking_score", ascending: false }, limit: 18 }),
      loadRows("product_categories", { columns: "*", filters: [{ column: "is_active", value: true }], order: { column: "sort_order", ascending: true }, limit: 20 }),
      loadRows("platform_modules", { columns: "*", filters: [{ column: "is_visible", value: true }], order: { column: "sort_order", ascending: true }, limit: 12 })
    ]);
    return `
      <section class="mvp-section mvp-panel">
        <form class="mvp-toolbar" data-discover-form>
          <input class="mvp-input" name="q" type="search" placeholder="Ürün, partner veya kategori ara">
          <select class="mvp-select" name="module">${modules.map((item) => `<option value="${mvp.escapeHTML(item.slug || item.module_key || "")}">${mvp.escapeHTML(item.name)}</option>`).join("")}</select>
          <button class="mvp-btn" type="submit">Ara</button>
        </form>
        <div class="mvp-toolbar">${(categories.length ? categories : sampleCategories()).map((item) => `<span class="mvp-pill">${mvp.escapeHTML(item.name)}</span>`).join("")}</div>
      </section>
      <section class="mvp-section">
        <div class="mvp-section__head"><h2>Keşif Sonuçları</h2><span class="mvp-pill">Sponsorlu etiket açık gösterilir</span></div>
        <div class="mvp-grid">${(products.length ? products : sampleProducts()).map(productCard).join("")}</div>
      </section>
    `;
  }

  function productCard(product) {
    return `
      <article class="mvp-card">
        <span class="mvp-pill ${product.is_sponsored ? "mvp-pill--gold" : ""}">${product.is_sponsored ? "Sponsorlu" : mvp.escapeHTML(product.category || "Onaylı")}</span>
        <h3>${mvp.escapeHTML(product.name || "Ürün")}</h3>
        <p>${mvp.escapeHTML(product.description || "Onaylı ürün açıklaması.")}</p>
        <p><strong>${mvp.money(product.price || 0)}</strong></p>
        <div class="mvp-progress" style="--value:${Math.min(100, Number(product.quality_score || 0))}%"><span></span></div>
      </article>
    `;
  }

  async function renderNotifications() {
    const user = await mvp.getUser();
    const [notifications, prefs] = user ? await Promise.all([
      loadRows("notifications", { columns: "*", order: { column: "created_at", ascending: false }, limit: 40 }),
      loadRows("notification_preferences", { columns: "*", limit: 1 })
    ]) : [[], []];
    const rows = notifications.map((item) => `
      <tr>
        <td><strong>${mvp.escapeHTML(item.title)}</strong><br><small>${mvp.escapeHTML(item.body)}</small></td>
        <td>${mvp.escapeHTML(item.notification_type)}</td>
        <td>${item.is_read ? "Okundu" : "<span class='mvp-pill mvp-pill--gold'>Yeni</span>"}</td>
        <td><button class="mvp-btn mvp-btn--ghost" data-read-notification="${mvp.escapeHTML(item.id)}">Okundu</button></td>
      </tr>
    `);
    return `
      <section class="mvp-section mvp-panel">
        <div class="mvp-section__head"><h2>Bildirim Tercihleri</h2><button class="mvp-btn" data-mark-all-read type="button">Tümünü Okundu Yap</button></div>
        <div class="mvp-grid mvp-grid--four">
          ${["Sipariş", "Kupon/HP", "Kampanya", "Güvenlik"].map((item) => `<article class="mvp-card"><h3>${item}</h3><p>In-app açık; dış kanallar entegrasyon için hazır.</p></article>`).join("")}
        </div>
      </section>
      <section class="mvp-section">${table(["Bildirim", "Tip", "Durum", "Aksiyon"], rows, user ? "Henüz bildirim yok." : "Bildirimleri görmek için giriş yap.")}</section>
    `;
  }

  function onboardingStepper() {
    const steps = ["Başvuru Bilgileri", "İşletme Bilgileri", "Ödeme Bilgileri", "İlk Ürün Ekleme", "Admin Onayı", "Yayına Hazır"];
    return `<div class="mvp-stepper">${steps.map((step, index) => `
      <div class="mvp-step"><b>${index + 1}</b><span>${mvp.escapeHTML(step)}</span><span class="mvp-pill">${index < 2 ? "Aktif" : "Bekliyor"}</span></div>
    `).join("")}</div>`;
  }

  async function renderPartnerOnboarding() {
    return `
      <section class="mvp-section mvp-grid mvp-grid--two">
        <div class="mvp-panel">${onboardingStepper()}</div>
        <form class="mvp-panel mvp-form" data-partner-onboarding-form>
          <label><span>Şirket Ünvanı</span><input class="mvp-input" name="company_title" required></label>
          <label><span>Vergi No</span><input class="mvp-input" name="tax_number"></label>
          <label><span>Yetkili Ad Soyad</span><input class="mvp-input" name="authorized_person_name" required></label>
          <label><span>Yetkili Telefon</span><input class="mvp-input" name="authorized_person_phone"></label>
          <label class="span-2"><span>IBAN</span><input class="mvp-input" name="iban"></label>
          <button class="mvp-btn span-2" type="submit">Bilgileri Kaydet</button>
        </form>
      </section>
    `;
  }

  async function renderPartnerProducts() {
    const products = await loadRows("products", { columns: "*", order: { column: "updated_at", ascending: false }, limit: 40 });
    const rows = products.map((item) => `
      <tr>
        <td><strong>${mvp.escapeHTML(item.name)}</strong><br><small>${mvp.escapeHTML(item.category || "")}</small></td>
        <td>${mvp.escapeHTML(item.approval_status || "draft")}</td>
        <td><div class="mvp-progress" style="--value:${Number(item.quality_score || 0)}%"><span></span></div>${Number(item.quality_score || 0)}/100</td>
        <td>${mvp.money(item.price || 0)}</td>
        <td><button class="mvp-btn mvp-btn--ghost" data-submit-review="${mvp.escapeHTML(item.id)}" ${Number(item.quality_score || 0) < 70 ? "disabled" : ""}>Onaya Gönder</button></td>
      </tr>
    `);
    return `
      <section class="mvp-section">
        <div class="mvp-section__head"><h2>Ürün Listesi</h2><a class="mvp-btn" href="${mvp.url("/pages/partner/products-new.html")}">Yeni Ürün</a></div>
        ${table(["Ürün", "Durum", "Kalite", "Fiyat", "Aksiyon"], rows, "Henüz ürün yok.")}
      </section>
    `;
  }

  async function renderPartnerProductForm() {
    return `
      <section class="mvp-section mvp-grid mvp-grid--two">
        <form class="mvp-panel mvp-form" data-product-quality-form>
          <label><span>Ürün adı</span><input class="mvp-input" name="name" required></label>
          <label><span>Kategori</span><input class="mvp-input" name="category"></label>
          <label><span>Fiyat</span><input class="mvp-input" name="price" type="number" step="0.01" min="0"></label>
          <label><span>Stok</span><input class="mvp-input" name="stock" type="number" min="0"></label>
          <label><span>SKU</span><input class="mvp-input" name="sku"></label>
          <label><span>Görsel URL</span><input class="mvp-input" name="image_url"></label>
          <label class="span-2"><span>Açıklama</span><textarea class="mvp-textarea" name="description"></textarea></label>
          <label class="span-2"><span>SEO Açıklaması</span><textarea class="mvp-textarea" name="seo_description"></textarea></label>
          <label class="span-2"><span>Kargo/Teslimat</span><input class="mvp-input" name="shipping_info"></label>
          <button class="mvp-btn span-2" type="submit">Taslak Ürünü Kaydet</button>
        </form>
        <aside class="mvp-panel">
          <h2>Kalite Puanı</h2>
          <div class="mvp-progress" style="--value:0%" data-quality-progress><span></span></div>
          <p data-quality-score>0/100</p>
          <div data-ai-helper>${status("Ürününüzün yayına alınma ihtimalini artırmak için kalite puanını en az 70'e çıkarın.")}</div>
        </aside>
      </section>
    `;
  }

  function renderEarnings() {
    return `
      <section class="mvp-section mvp-panel">
        <form class="mvp-form" data-earnings-form>
          <label><span>Satış Fiyatı</span><input class="mvp-input" name="price" type="number" value="1000" min="0" step="0.01"></label>
          <label><span>Komisyon %</span><input class="mvp-input" name="rate" type="number" value="10" min="0" step="0.01"></label>
          <label><span>Ödeme Kesintisi %</span><input class="mvp-input" name="fee" type="number" value="2.99" min="0" step="0.01"></label>
          <label><span>Sabit Hizmet Bedeli</span><input class="mvp-input" name="fixed" type="number" value="0" min="0" step="0.01"></label>
        </form>
        <div class="mvp-stat-grid" data-earnings-result></div>
      </section>
    `;
  }

  function genericForm(title, fields, tableName, formName) {
    return `
      <section class="mvp-section mvp-panel">
        <h2>${mvp.escapeHTML(title)}</h2>
        <form class="mvp-form" data-generic-form="${mvp.escapeHTML(formName || tableName)}" data-table="${mvp.escapeHTML(tableName)}">
          ${fields.map((field) => `
            <label class="${field.type === "textarea" ? "span-2" : ""}">
              <span>${mvp.escapeHTML(field.label)}</span>
              ${field.type === "textarea"
                ? `<textarea class="mvp-textarea" name="${field.name}"></textarea>`
                : `<input class="mvp-input" name="${field.name}" type="${field.type || "text"}">`}
            </label>
          `).join("")}
          <button class="mvp-btn span-2" type="submit">Kaydet</button>
        </form>
      </section>
    `;
  }

  async function renderPartnerCampaigns() {
    const campaigns = await loadRows("campaigns", { columns: "*", order: { column: "created_at", ascending: false }, limit: 30 });
    const rows = campaigns.map((item) => `<tr><td>${mvp.escapeHTML(item.title)}</td><td>${mvp.escapeHTML(item.campaign_type)}</td><td>${mvp.escapeHTML(item.status)}</td><td>${item.sent_count || 0}</td></tr>`);
    return genericForm("Kampanya Talebi Oluştur", [
      { label: "Başlık", name: "title" },
      { label: "Kampanya Tipi", name: "campaign_type" },
      { label: "Modül", name: "module" },
      { label: "Açıklama", name: "description", type: "textarea" }
    ], "campaigns", "partner-campaign") + `<section class="mvp-section">${table(["Başlık", "Tip", "Durum", "Gönderim"], rows, "Kampanya talebi yok.")}</section>`;
  }

  async function renderPartnerPayouts() {
    const rows = (await loadRows("partner_payouts", { columns: "*", order: { column: "created_at", ascending: false }, limit: 24 }))
      .map((item) => `<tr><td>${mvp.escapeHTML(item.period_start || "")} - ${mvp.escapeHTML(item.period_end || "")}</td><td>${mvp.money(item.gross_sales || item.gross_amount || 0)}</td><td>${mvp.money(item.platform_commission || item.commission_amount || 0)}</td><td>${mvp.money(item.net_payout || item.net_amount || 0)}</td><td>${mvp.escapeHTML(item.status)}</td></tr>`);
    return `<section class="mvp-section">${table(["Dönem", "Brüt", "Komisyon", "Net", "Durum"], rows, "Payout kaydı yok.")}</section>`;
  }

  async function renderAdminTable(tableName, headers, rowFn, options) {
    const rows = (await loadRows(tableName, options || { columns: "*", limit: 50 })).map(rowFn);
    return `<section class="mvp-section">${table(headers, rows, "Kayıt bulunamadı veya RLS erişimi yok.")}</section>`;
  }

  async function renderAdminPage(key) {
    const map = {
      "admin-partners": ["partners", ["Partner", "Doğrulama", "Risk", "Aşama"], (p) => `<tr><td>${mvp.escapeHTML(p.partner_name || p.company_title || p.email || "-")}</td><td>${mvp.escapeHTML(p.verification_status)}</td><td>${mvp.escapeHTML(p.risk_level)}</td><td>${mvp.escapeHTML(p.onboarding_step)}</td></tr>`],
      "admin-product-reviews": ["products", ["Ürün", "Durum", "Kalite", "Sponsorlu"], (p) => `<tr><td>${mvp.escapeHTML(p.name)}</td><td>${mvp.escapeHTML(p.approval_status)}</td><td>${Number(p.quality_score || 0)}/100</td><td>${p.is_sponsored ? "Evet" : "Hayır"}</td></tr>`],
      "admin-commission-profiles": ["commission_profiles", ["Profil", "Modül", "Komisyon", "Varsayılan"], (p) => `<tr><td>${mvp.escapeHTML(p.name)}</td><td>${mvp.escapeHTML(p.module)}</td><td>%${Number(p.commission_rate || 0)}</td><td>${p.is_default ? "Evet" : "Hayır"}</td></tr>`],
      "admin-home-sections": ["home_sections", ["Blok", "Tip", "Sıra", "Aktif"], (s) => `<tr><td>${mvp.escapeHTML(s.title)}</td><td>${mvp.escapeHTML(s.section_type)}</td><td>${s.sort_order}</td><td>${s.is_active ? "Evet" : "Hayır"}</td></tr>`],
      "admin-reward-tasks": ["reward_tasks", ["Görev", "Tip", "HP", "XP"], (t) => `<tr><td>${mvp.escapeHTML(t.title)}</td><td>${mvp.escapeHTML(t.task_type)}</td><td>${t.hp_reward}</td><td>${t.xp_reward}</td></tr>`],
      "admin-user-events": ["user_events", ["Event", "Modül", "Entity", "Tarih"], (e) => `<tr><td>${mvp.escapeHTML(e.event_type)}</td><td>${mvp.escapeHTML(e.module || "-")}</td><td>${mvp.escapeHTML(e.entity_type || "-")}</td><td>${mvp.escapeHTML(e.created_at || "")}</td></tr>`],
      "admin-finance": ["financial_ledger", ["Tip", "Yön", "Tutar", "Durum"], (l) => `<tr><td>${mvp.escapeHTML(l.transaction_type)}</td><td>${mvp.escapeHTML(l.direction)}</td><td>${mvp.money(l.amount)}</td><td>${mvp.escapeHTML(l.status)}</td></tr>`],
      "admin-risk": ["risk_events", ["Event", "Seviye", "Skor", "Durum"], (r) => `<tr><td>${mvp.escapeHTML(r.event_type)}</td><td>${mvp.escapeHTML(r.severity)}</td><td>${r.score}</td><td>${mvp.escapeHTML(r.status)}</td></tr>`],
      "admin-refunds": ["refund_requests", ["Sipariş", "Sebep", "Tutar", "Durum"], (r) => `<tr><td>${mvp.escapeHTML(r.order_id || "-")}</td><td>${mvp.escapeHTML(r.reason)}</td><td>${mvp.money(r.requested_amount)}</td><td>${mvp.escapeHTML(r.status)}</td></tr>`],
      "admin-payouts": ["partner_payouts", ["Partner", "Brüt", "Net", "Durum"], (p) => `<tr><td>${mvp.escapeHTML(p.partner_id || "-")}</td><td>${mvp.money(p.gross_sales || p.gross_amount || 0)}</td><td>${mvp.money(p.net_payout || p.net_amount || 0)}</td><td>${mvp.escapeHTML(p.status)}</td></tr>`],
      "admin-campaigns": ["campaigns", ["Kampanya", "Tip", "Durum", "Gönderim"], (c) => `<tr><td>${mvp.escapeHTML(c.title)}</td><td>${mvp.escapeHTML(c.campaign_type)}</td><td>${mvp.escapeHTML(c.status)}</td><td>${c.sent_count || 0}</td></tr>`],
      "admin-segments": ["user_segments", ["Segment", "Key", "Aktif", "Kural"], (s) => `<tr><td>${mvp.escapeHTML(s.name)}</td><td>${mvp.escapeHTML(s.segment_key)}</td><td>${s.is_active ? "Evet" : "Hayır"}</td><td><code>${mvp.escapeHTML(JSON.stringify(s.rules || {}))}</code></td></tr>`],
      "admin-notifications": ["notifications", ["Başlık", "Tip", "Öncelik", "Okundu"], (n) => `<tr><td>${mvp.escapeHTML(n.title)}</td><td>${mvp.escapeHTML(n.notification_type)}</td><td>${mvp.escapeHTML(n.priority)}</td><td>${n.is_read ? "Evet" : "Hayır"}</td></tr>`]
    };
    const config = map[key] || map["admin-partners"];
    return renderAdminTable(config[0], config[1], config[2], { columns: "*", order: { column: "created_at", ascending: false }, limit: 60 });
  }

  function sampleCoupons() {
    return [
      { code: "WELCOME", title: "İlk Sipariş Fırsatı", discount_type: "percent", discount_value: 10, module: "shop", badge_text: "first_order_only" },
      { code: "HPBLUE", title: "HP ile Açılabilir İndirim", discount_type: "fixed", discount_value: 75, module: "all", badge_text: "HP/XP" },
      { code: "PARTNER", title: "Partner Kampanyası", discount_type: "percent", discount_value: 15, module: "market", badge_text: "Partner Kampanyası" }
    ];
  }

  function sampleTasks() {
    return [
      { title: "Profilini tamamla", description: "20 HP / 20 XP", hp_reward: 20, xp_reward: 20 },
      { title: "İlk adresini ekle", description: "15 HP / 15 XP", hp_reward: 15, xp_reward: 15 },
      { title: "Kupon Merkezi'ni ziyaret et", description: "3 HP / 5 XP", hp_reward: 3, xp_reward: 5 }
    ];
  }

  function sampleCategories() {
    return ["Elektronik", "Ev & Yaşam", "Moda", "Kozmetik", "Spor & Outdoor", "Süpermarket"].map((name) => ({ name }));
  }

  function sampleProducts() {
    return [
      { name: "AllonaHub Premium Ürün", description: "Onaylı katalog ürünü ve kalite puanı örneği.", price: 999, quality_score: 86, category: "Shop" },
      { name: "Sponsorlu Vitrin Ürünü", description: "Sponsorlu etiketi açıkça görünen ürün alanı.", price: 1499, quality_score: 92, is_sponsored: true },
      { name: "Yeni Eklenen Ürün", description: "Public listede yalnızca approved ürünler görünür.", price: 499, quality_score: 78 }
    ];
  }

  function bindInteractions(root) {
    root.addEventListener("click", async (event) => {
      const code = event.target.closest("[data-copy-code]");
      if (code) {
        await navigator.clipboard?.writeText(code.dataset.copyCode || "");
        code.textContent = "Kod Kopyalandı";
      }

      const review = event.target.closest("[data-submit-review]");
      if (review) {
        try {
          await mvp.rpc("submit_product_for_review", { p_product_id: review.dataset.submitReview });
          review.textContent = "Gönderildi";
        } catch (error) {
          alert(error.message || "Onaya gönderilemedi.");
        }
      }

      const read = event.target.closest("[data-read-notification]");
      if (read) {
        try {
          await mvp.update("notifications", read.dataset.readNotification, { is_read: true, read_at: new Date().toISOString() });
          read.textContent = "Okundu";
        } catch (error) {}
      }

      const markAll = event.target.closest("[data-mark-all-read]");
      if (markAll) {
        const user = await mvp.getUser();
        const client = mvp.initSupabase();
        if (!user || !client) return;
        await client
          .from("notifications")
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .eq("is_read", false);
        markAll.textContent = "Okundu";
      }
    });

    root.addEventListener("input", (event) => {
      const form = event.target.closest("[data-product-quality-form]");
      if (!form) return;
      const draft = Object.fromEntries(new FormData(form).entries());
      const score = mvp.qualityScore(draft);
      const progress = root.querySelector("[data-quality-progress]");
      const label = root.querySelector("[data-quality-score]");
      const helper = root.querySelector("[data-ai-helper]");
      if (progress) progress.style.setProperty("--value", `${score}%`);
      if (label) label.textContent = `${score}/100`;
      if (helper) {
        const missing = mvp.PartnerProductAIHelper.detectMissingFields(draft);
        helper.innerHTML = missing.length
          ? `<div class="mvp-status">${missing.map(mvp.escapeHTML).join("<br>")}</div>`
          : `<div class="mvp-status mvp-status--success">Kalite puanı yayına gönderim için hazır.</div>`;
      }
    });

    root.addEventListener("input", (event) => {
      const form = event.target.closest("[data-earnings-form]");
      if (!form) return;
      renderEarningsResult(form);
    });

    root.addEventListener("submit", async (event) => {
      const productForm = event.target.closest("[data-product-quality-form]");
      if (productForm) {
        event.preventDefault();
        const user = await mvp.getUser();
        if (!user) {
          alert("Ürün kaydetmek için partner oturumu gerekli.");
          return;
        }
        const payload = Object.fromEntries(new FormData(productForm).entries());
        payload.price = Number(payload.price || 0);
        payload.stock = Number(payload.stock || 0);
        payload.status = "draft";
        payload.approval_status = "draft";
        payload.partner_id = user.id;
        try {
          await mvp.insert("products", payload);
          alert("Taslak ürün kaydedildi.");
        } catch (error) {
          alert(error.message || "Ürün kaydedilemedi.");
        }
        return;
      }

      const generic = event.target.closest("[data-generic-form]");
      if (generic) {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(generic).entries());
        if (generic.dataset.genericForm === "partner-campaign") {
          const partner = await mvp.currentPartner();
          if (!partner?.id) {
            alert("Kampanya talebi için partner kaydı bulunamadı.");
            return;
          }
          payload.partner_id = partner.id;
          payload.status = "pending_review";
        }
        try {
          await mvp.insert(generic.dataset.table, payload);
          alert("Kayıt oluşturuldu.");
        } catch (error) {
          alert(error.message || "Kayıt oluşturulamadı.");
        }
        return;
      }

      const onboarding = event.target.closest("[data-partner-onboarding-form]");
      if (onboarding) {
        event.preventDefault();
        const user = await mvp.getUser();
        if (!user) {
          alert("Partner bilgilerini kaydetmek için giriş gerekli.");
          return;
        }
        const payload = Object.fromEntries(new FormData(onboarding).entries());
        payload.user_id = user.id;
        payload.owner_id = user.id;
        payload.email = user.email || payload.authorized_person_email || "";
        payload.partner_name = payload.company_title || payload.authorized_person_name || "Allona Partner";
        payload.display_name = payload.partner_name;
        payload.verification_status = "under_review";
        payload.onboarding_step = "admin_review";
        payload.status = "pending";
        try {
          await mvp.upsert("partners", payload, { onConflict: "email" });
          alert("Partner onboarding bilgileri kaydedildi.");
        } catch (error) {
          alert(error.message || "Partner bilgileri kaydedilemedi.");
        }
      }
    });
  }

  function renderEarningsResult(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const price = Number(data.price || 0);
    const rate = Number(data.rate || 0);
    const fee = Number(data.fee || 0);
    const fixed = Number(data.fixed || 0);
    const commission = price * rate / 100;
    const paymentFee = price * fee / 100 + fixed;
    const net = Math.max(0, price - commission - paymentFee);
    const target = document.querySelector("[data-earnings-result]");
    if (!target) return;
    target.innerHTML = [
      ["Brüt Satış", mvp.money(price)],
      ["Platform Komisyonu", mvp.money(commission)],
      ["Ödeme Kesintisi", mvp.money(paymentFee)],
      ["Tahmini Net", mvp.money(net)]
    ].map(([label, value]) => `<div class="mvp-stat"><span>${label}</span><strong>${value}</strong></div>`).join("");
  }

  async function bodyFor(key) {
    if (key === "coupon-center") return renderCouponCenter();
    if (key === "discover") return renderDiscover();
    if (key === "notifications") return renderNotifications();
    if (key === "partner-onboarding") return renderPartnerOnboarding();
    if (key === "partner-products") return renderPartnerProducts();
    if (key === "partner-product-form") return renderPartnerProductForm();
    if (key === "partner-earnings") return renderEarnings();
    if (key === "partner-campaigns") return renderPartnerCampaigns();
    if (key === "partner-payouts") return renderPartnerPayouts();
    if (key.startsWith("admin-")) return renderAdminPage(key);
    return renderCouponCenter();
  }

  async function init() {
    const root = document.querySelector("[data-mvp-root]");
    if (!root || !mvp) return;
    const meta = pageMeta[pageKey] || pageMeta["coupon-center"];
    root.innerHTML = shell(meta, status("Yükleniyor..."));
    const content = await bodyFor(pageKey);
    root.innerHTML = shell(meta, content);
    bindInteractions(root);
    const earnings = root.querySelector("[data-earnings-form]");
    if (earnings) renderEarningsResult(earnings);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
