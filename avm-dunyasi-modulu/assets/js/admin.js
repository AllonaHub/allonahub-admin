(function () {
  const state = {
    data: null,
    selectedMallId: null,
    activeTab: "dashboard",
    auditLogs: [
      {
        actor: "AVM Admin",
        action: "Panel açıldı",
        target: "AVM Dünyası",
        risk: "low",
        at: new Date().toLocaleString("tr-TR"),
      },
    ],
  };

  const byId = (id) => document.getElementById(id);
  const formatCurrency = (value, currency = "TRY") =>
    new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);

  function renderCategoryOptions(selected = "") {
    const categories = state.data ? state.data.categories : window.AVM_SEED_DATA.categories;
    return categories
      .map((category) => `<option value="${category}" ${category === selected ? "selected" : ""}>${category}</option>`)
      .join("");
  }

  function addCategoryMeta(record) {
    const findCategory = state.data.findCategory || window.AVM_SEED_DATA.findCategory;
    const createCategoryId = state.data.categoryId || window.AVM_SEED_DATA.categoryId;
    const category = typeof findCategory === "function" ? findCategory(record.category) : null;

    if (!category) {
      return {
        ...record,
        categoryId: createCategoryId ? createCategoryId(record.category || "") : record.category,
        mainCategory: record.category,
        categoryPath: record.category ? [record.category] : [],
      };
    }

    return {
      ...record,
      categoryId: category.id,
      mainCategory: category.rootTitle,
      categoryPath: category.path,
    };
  }

  const tabs = [
    ["dashboard", "Genel Bakış"],
    ["profile", "AVM Profili"],
    ["stores", "Mağazalar"],
    ["restaurants", "Restoranlar"],
    ["products", "Ürünler"],
    ["campaigns", "Kampanyalar"],
    ["coupons", "Kuponlar"],
    ["events", "Etkinlikler"],
    ["map", "Kat Planı"],
    ["reviews", "Değerlendirmeler"],
    ["orders", "Siparişler"],
    ["approvals", "Onay Kuyruğu"],
    ["audit", "Audit Log"],
    ["settings", "Ayarlar"],
  ];

  function selectedMall() {
    return state.data.malls.find((mall) => mall.id === state.selectedMallId) || state.data.malls[0];
  }

  function mallStores(type) {
    return state.data.stores.filter((store) => {
      const matchesMall = store.mallId === state.selectedMallId;
      if (!type) return matchesMall;
      return matchesMall && store.type === type;
    });
  }

  function mallProducts(includeDrafts = true) {
    return state.data.products.filter((product) => {
      if (product.mallId !== state.selectedMallId) return false;
      return includeDrafts || product.status === "published";
    });
  }

  function mallCampaigns() {
    return state.data.campaigns.filter((campaign) => campaign.mallId === state.selectedMallId);
  }

  function mallCoupons() {
    return state.data.coupons.filter((coupon) => coupon.mallId === state.selectedMallId);
  }

  function mallEvents() {
    return state.data.events.filter((event) => event.mallId === state.selectedMallId);
  }

  function addAudit(action, target, risk = "low") {
    state.auditLogs.unshift({
      actor: "AVM Admin",
      action,
      target,
      risk,
      at: new Date().toLocaleString("tr-TR"),
    });
    if (state.activeTab === "audit") renderPanel();
  }

  function renderShell() {
    const mall = selectedMall();
    byId("adminMallName").textContent = mall.name;
    byId("adminMallLocation").textContent = `${mall.city} / ${mall.district}`;
    byId("adminSource").textContent = window.AVMDataClient.hasConfig()
      ? "Supabase bağlantısı aktif"
      : "Seed veri, yerel yönetim modu";

    byId("mallSelect").innerHTML = state.data.malls
      .map((item) => `<option value="${item.id}" ${item.id === state.selectedMallId ? "selected" : ""}>${item.name} - ${item.city}</option>`)
      .join("");

    byId("adminTabs").innerHTML = tabs
      .map(
        ([id, label]) =>
          `<button class="tab-button ${state.activeTab === id ? "is-active" : ""}" data-admin-tab="${id}">${label}</button>`
      )
      .join("");
  }

  function renderKpis() {
    const stores = mallStores();
    const products = mallProducts();
    const campaigns = mallCampaigns();
    const coupons = mallCoupons();
    const pendingItems = [
      ...stores.filter((item) => item.approvalStatus === "pending"),
      ...products.filter((item) => item.status === "draft"),
      ...campaigns.filter((item) => item.status === "pending"),
    ];

    return `
      <section class="kpi-grid">
        <article class="kpi-card"><span>Mağaza/İşletme</span><strong>${stores.length}</strong><small>AVM içi kayıt</small></article>
        <article class="kpi-card"><span>Restoran</span><strong>${mallStores("restaurant").length}</strong><small>Yeme içme alanı</small></article>
        <article class="kpi-card"><span>Ürün</span><strong>${products.length}</strong><small>Shop vitrini</small></article>
        <article class="kpi-card"><span>Bekleyen Onay</span><strong>${pendingItems.length}</strong><small>İçerik kuyruğu</small></article>
        <article class="kpi-card"><span>Aktif Kampanya</span><strong>${campaigns.filter((item) => item.status === "published").length}</strong><small>Tarih kontrollü</small></article>
        <article class="kpi-card"><span>Kupon Kullanımı</span><strong>${coupons.reduce((sum, item) => sum + item.used, 0)}</strong><small>Toplam kullanım</small></article>
      </section>
    `;
  }

  function statusBadge(value) {
    return `<span class="status-badge status-${value}">${value}</span>`;
  }

  function renderDashboard() {
    const mall = selectedMall();
    return `
      ${renderKpis()}
      <section class="admin-grid two-columns">
        <article class="panel-block">
          <h2>Operasyon Sağlığı</h2>
          <ul class="check-list">
            <li><strong>Çalışma saatleri:</strong> Normal, hafta sonu ve özel gün alanları kontrol edilmeli.</li>
            <li><strong>İçerik onayı:</strong> Mağaza, kampanya, kupon ve etkinlik yayınları audit log ile izlenmeli.</li>
            <li><strong>Shop vitrini:</strong> Ürün görseli, fiyat, stok, puan ve mağaza eşleşmesi zorunlu.</li>
            <li><strong>Harita:</strong> Kat, ünite no ve servis noktaları yayın öncesi doğrulanmalı.</li>
          </ul>
        </article>
        <article class="panel-block">
          <h2>Seçili AVM</h2>
          <dl class="definition-list">
            <div><dt>Ad</dt><dd>${mall.name}</dd></div>
            <div><dt>Konum</dt><dd>${mall.city} / ${mall.district}</dd></div>
            <div><dt>Partner durumu</dt><dd>${mall.partnerStatus}</dd></div>
            <div><dt>Doğrulama</dt><dd>${mall.verificationStatus}</dd></div>
          </dl>
        </article>
      </section>
      <section class="panel-block">
        <div class="section-heading">
          <h2>Yatay Ürün Vitrini Önizlemesi</h2>
          <a class="text-link" href="index.html?mall=${mall.id}">Kullanıcı ekranında aç</a>
        </div>
        ${renderProductRail()}
      </section>
    `;
  }

  function renderProfile() {
    const mall = selectedMall();
    return `
      <section class="admin-grid two-columns">
        <form class="panel-block admin-form" data-form="profile">
          <h2>AVM Profili</h2>
          <label>AVM adı<input name="name" value="${mall.name}" required></label>
          <label>Şehir<input name="city" value="${mall.city}" required></label>
          <label>İlçe<input name="district" value="${mall.district}" required></label>
          <label>Adres<textarea name="address" rows="3">Adres, yol tarifi ve ulaşım bilgisi girilecek.</textarea></label>
          <label>İletişim<input name="phone" value="+90 000 000 00 00"></label>
          <label>Web sitesi<input name="website" value="https://"></label>
          <button class="primary-button" type="submit">Profili Kaydet</button>
        </form>
        <article class="panel-block">
          <h2>Yayın Kontrolü</h2>
          <ul class="check-list">
            <li>Logo ve kapak görseli Supabase Storage üzerinden gelmeli.</li>
            <li>Özel gün saatleri ayrı tarih aralığıyla tutulmalı.</li>
            <li>Adres değişikliği yayın öncesi admin onayına düşmeli.</li>
            <li>AVM partneri sadece kendi AVM kaydını düzenleyebilmeli.</li>
          </ul>
        </article>
      </section>
    `;
  }

  function renderStoresTable(type) {
    const rows = mallStores(type);
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ad</th>
              <th>Kategori</th>
              <th>Kat</th>
              <th>Ünite</th>
              <th>Puan</th>
              <th>Durum</th>
              <th>Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map(
                      (store) => `
                        <tr>
                          <td>${store.name}</td>
                          <td>${store.mainCategory || store.category}</td>
                          <td>${store.floor}</td>
                          <td>${store.unit}</td>
                          <td>${store.rating}</td>
                          <td>${statusBadge(store.approvalStatus)}</td>
                          <td><button class="secondary-button small-button" data-admin-action="approve-store" data-id="${store.id}">Onayla</button></td>
                        </tr>
                      `
                    )
                    .join("")
                : `<tr><td colspan="7">Kayıt yok.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;
  }

  function renderStoreForm(type) {
    const title = type === "restaurant" ? "Restoran Ekle" : "Mağaza/İşletme Ekle";
    return `
      <form class="panel-block admin-form" data-form="store" data-store-type="${type || "store"}">
        <h2>${title}</h2>
        <label>Ad<input name="name" placeholder="Marka veya işletme adı" required></label>
        <label>Kategori
          <select name="category" required>
            ${renderCategoryOptions(type === "restaurant" ? "Restoran & Kafe" : "")}
          </select>
        </label>
        <label>Kat<input name="floor" placeholder="L1, L2, B1" required></label>
        <label>Mağaza no<input name="unit" placeholder="112" required></label>
        <label>Telefon<input name="phone" placeholder="+90"></label>
        <label>Görsel URL<input name="image" placeholder="Supabase Storage veya CDN URL"></label>
        <button class="primary-button" type="submit">Taslak Oluştur</button>
      </form>
    `;
  }

  function renderStores(type) {
    return `
      <section class="admin-grid form-and-table">
        ${renderStoreForm(type)}
        <article class="panel-block">
          <div class="section-heading">
            <h2>${type === "restaurant" ? "Restoranlar" : "Mağazalar ve İşletmeler"}</h2>
            <button class="secondary-button" data-admin-action="export" data-export="${type || "stores"}">CSV Dışa Aktar</button>
          </div>
          ${renderStoresTable(type)}
        </article>
      </section>
    `;
  }

  function renderProductRail() {
    const products = mallProducts(false);
    return `
      <div class="product-rail admin-product-rail">
        ${
          products.length
            ? products
                .map(
                  (product) => `
                    <article class="product-card">
                      <div class="product-image">
                        <img src="${product.image}" alt="${product.name}" loading="lazy">
                        <span>${product.badge}</span>
                      </div>
                      <div class="product-body">
                        <span class="eyebrow">${product.mainCategory || product.category}</span>
                        <h3>${product.name}</h3>
                        <div class="rating-line"><span class="stars">★★★★★</span><span>${product.rating} (${product.reviewCount})</span></div>
                        <strong>${formatCurrency(product.price, product.currency)}</strong>
                        <div class="button-row">
                          <button class="secondary-button" type="button">Sepete Ekle</button>
                          <button class="primary-button" type="button">Hemen Al</button>
                        </div>
                      </div>
                    </article>
                  `
                )
                .join("")
            : `<article class="empty-state wide">Yayınlanmış ürün yok.</article>`
        }
      </div>
    `;
  }

  function renderProducts() {
    const products = mallProducts();
    return `
      <section class="admin-grid form-and-table">
        <form class="panel-block admin-form" data-form="product">
          <h2>Ürün Ekle</h2>
          <label>Ürün adı<input name="name" placeholder="Ürün adı" required></label>
          <label>Mağaza
            <select name="storeId" required>
              ${mallStores().map((store) => `<option value="${store.id}">${store.name}</option>`).join("")}
            </select>
          </label>
          <label>Kategori
            <select name="category" required>
              ${renderCategoryOptions()}
            </select>
          </label>
          <label>Fiyat<input name="price" type="number" min="1" placeholder="1299" required></label>
          <label>Stok<input name="stock" type="number" min="0" placeholder="20" required></label>
          <label>Görsel URL<input name="image" placeholder="Supabase Storage public URL" required></label>
          <button class="primary-button" type="submit">Ürünü Taslak Kaydet</button>
        </form>
        <article class="panel-block">
          <div class="section-heading">
            <h2>Ürün Yönetimi</h2>
            <button class="secondary-button" data-admin-action="export" data-export="products">CSV Dışa Aktar</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Ürün</th><th>Kategori</th><th>Fiyat</th><th>Stok</th><th>Puan</th><th>Durum</th><th>Aksiyon</th></tr></thead>
              <tbody>
                ${
                  products.length
                    ? products
                        .map(
                          (product) => `
                            <tr>
                              <td>${product.name}</td>
                              <td>${product.mainCategory || product.category}</td>
                              <td>${formatCurrency(product.price, product.currency)}</td>
                              <td>${product.stock}</td>
                              <td>${product.rating}</td>
                              <td>${statusBadge(product.status)}</td>
                              <td><button class="secondary-button small-button" data-admin-action="publish-product" data-id="${product.id}">Yayınla</button></td>
                            </tr>
                          `
                        )
                        .join("")
                    : `<tr><td colspan="7">Ürün yok.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </article>
      </section>
      <section class="panel-block">
        <div class="section-heading">
          <h2>Kullanıcı Vitrini Önizlemesi</h2>
          <span class="muted">Ürünler yüklendikten sonra yatay kaydırmalı görünür.</span>
        </div>
        ${renderProductRail()}
      </section>
    `;
  }

  function renderCampaigns() {
    const campaigns = mallCampaigns();
    return `
      <section class="admin-grid form-and-table">
        <form class="panel-block admin-form" data-form="campaign">
          <h2>Kampanya Oluştur</h2>
          <label>Başlık<input name="title" required></label>
          <label>Başlangıç<input name="startsAt" type="date" required></label>
          <label>Bitiş<input name="endsAt" type="date" required></label>
          <label>Koşullar<textarea name="condition" rows="3" required></textarea></label>
          <button class="primary-button" type="submit">Onaya Gönder</button>
        </form>
        <article class="panel-block">
          <h2>Kampanyalar</h2>
          ${renderSimpleTable(campaigns, ["title", "startsAt", "endsAt", "status"], "campaign")}
        </article>
      </section>
    `;
  }

  function renderCoupons() {
    const coupons = mallCoupons();
    return `
      <section class="admin-grid form-and-table">
        <form class="panel-block admin-form" data-form="coupon">
          <h2>Kupon Oluştur</h2>
          <label>Başlık<input name="title" required></label>
          <label>Kod<input name="code" required></label>
          <label>Limit<input name="limit" type="number" min="1" required></label>
          <label>Son tarih<input name="expiresAt" type="date" required></label>
          <button class="primary-button" type="submit">Kuponu Kaydet</button>
        </form>
        <article class="panel-block">
          <h2>Kuponlar</h2>
          ${renderSimpleTable(coupons, ["title", "code", "limit", "used", "status", "expiresAt"], "coupon")}
        </article>
      </section>
    `;
  }

  function renderEvents() {
    const events = mallEvents();
    return `
      <section class="admin-grid form-and-table">
        <form class="panel-block admin-form" data-form="event">
          <h2>Etkinlik Oluştur</h2>
          <label>Başlık<input name="title" required></label>
          <label>Lokasyon<input name="location" required></label>
          <label>Tarih ve saat<input name="startsAt" type="datetime-local" required></label>
          <button class="primary-button" type="submit">Etkinliği Yayınla</button>
        </form>
        <article class="panel-block">
          <h2>Etkinlikler</h2>
          ${renderSimpleTable(events, ["title", "location", "startsAt", "status"], "event")}
        </article>
      </section>
    `;
  }

  function renderSimpleTable(rows, keys, entity) {
    return `
      <div class="table-wrap">
        <table>
          <thead><tr>${keys.map((key) => `<th>${key}</th>`).join("")}<th>Aksiyon</th></tr></thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map(
                      (row) => `
                        <tr>
                          ${keys.map((key) => `<td>${key === "status" ? statusBadge(row[key]) : row[key] || "-"}</td>`).join("")}
                          <td><button class="secondary-button small-button" data-admin-action="approve-${entity}" data-id="${row.id}">Onayla</button></td>
                        </tr>
                      `
                    )
                    .join("")
                : `<tr><td colspan="${keys.length + 1}">Kayıt yok.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;
  }

  function renderMap() {
    return `
      <section class="admin-grid two-columns">
        <article class="panel-block">
          <h2>Kat Planı ve Pin Yönetimi</h2>
          <div class="floor-map">
            ${mallStores()
              .map(
                (store, index) =>
                  `<button style="left:${10 + (index % 4) * 21}%;top:${18 + (index % 3) * 22}%;" title="${store.name}">${store.unit}</button>`
              )
              .join("")}
          </div>
        </article>
        <article class="panel-block">
          <h2>Harita Yayın Kontrolleri</h2>
          <ul class="check-list">
            <li>Her mağazada kat, ünite no ve kategori zorunlu.</li>
            <li>Pin konumu AVM yönetimi tarafından onaylanmalı.</li>
            <li>Harita yüklenmezse kullanıcıya liste alternatifi gösterilmeli.</li>
            <li>Servis noktaları mağazalardan ayrı tipte tutulmalı.</li>
          </ul>
        </article>
      </section>
    `;
  }

  function renderReviews() {
    const rows = state.data.reviews.filter((review) => review.mallId === state.selectedMallId);
    return `
      <section class="panel-block">
        <h2>Değerlendirmeler ve Moderasyon</h2>
        ${renderSimpleTable(rows, ["author", "targetType", "rating", "text", "status"], "review")}
      </section>
    `;
  }

  function renderOrders() {
    const products = mallProducts(false).slice(0, 4);
    const rows = products.map((product, index) => ({
      id: `order-${index + 1}`,
      no: `AVM-${1000 + index}`,
      customer: ["Ayşe D.", "Kerem S.", "Selin Y.", "Murat T."][index],
      product: product.name,
      amount: formatCurrency(product.price, product.currency),
      status: index % 2 === 0 ? "paid" : "reserved",
    }));
    return `
      <section class="panel-block">
        <div class="section-heading">
          <h2>Sipariş ve Rezervasyon İzleme</h2>
          <span class="muted">Sepete ekle ve hemen al aksiyonlarının operasyon görünümü.</span>
        </div>
        ${renderSimpleTable(rows, ["no", "customer", "product", "amount", "status"], "order")}
      </section>
    `;
  }

  function renderApprovals() {
    const pending = [
      ...mallStores().filter((item) => item.approvalStatus === "pending").map((item) => ({ ...item, entity: "store" })),
      ...mallProducts().filter((item) => item.status === "draft").map((item) => ({ ...item, entity: "product" })),
      ...mallCampaigns().filter((item) => item.status === "pending").map((item) => ({ ...item, entity: "campaign" })),
    ];

    return `
      <section class="panel-block">
        <h2>İçerik Onay Kuyruğu</h2>
        <div class="approval-list">
          ${
            pending.length
              ? pending
                  .map(
                    (item) => `
                      <article class="approval-item">
                        <div>
                          <span class="eyebrow">${item.entity}</span>
                          <h3>${item.name || item.title}</h3>
                          <p>${item.category || item.condition || "Yayın öncesi kontrol gerekli."}</p>
                        </div>
                        <div class="button-row">
                          <button class="secondary-button" data-admin-action="reject" data-id="${item.id}" data-entity="${item.entity}">Revizyon İste</button>
                          <button class="primary-button" data-admin-action="approve-any" data-id="${item.id}" data-entity="${item.entity}">Onayla</button>
                        </div>
                      </article>
                    `
                  )
                  .join("")
              : `<article class="empty-state">Bekleyen onay yok.</article>`
          }
        </div>
      </section>
    `;
  }

  function renderAudit() {
    return `
      <section class="panel-block">
        <h2>Audit Log</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Zaman</th><th>Aktör</th><th>İşlem</th><th>Hedef</th><th>Risk</th></tr></thead>
            <tbody>
              ${state.auditLogs
                .map(
                  (log) => `<tr><td>${log.at}</td><td>${log.actor}</td><td>${log.action}</td><td>${log.target}</td><td>${statusBadge(log.risk)}</td></tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderSettings() {
    const config = window.AVMDataClient.getConfig();
    return `
      <section class="admin-grid two-columns">
        <form class="panel-block admin-form" data-form="supabase">
          <h2>Supabase Bağlantısı</h2>
          <label>Project URL<input name="url" value="${config.url}" placeholder="https://project.supabase.co"></label>
          <label>Anon key<textarea name="anonKey" rows="4" placeholder="Supabase anon public key">${config.anonKey}</textarea></label>
          <button class="primary-button" type="submit">Bağlantıyı Kaydet</button>
        </form>
        <article class="panel-block">
          <h2>Yüksek Standart Kontroller</h2>
          <ul class="check-list">
            <li>RLS aktif olmadan canlı admin panel yayına alınmamalı.</li>
            <li>Partner kullanıcısı sadece kendi partner_id kapsamındaki kayıtları görmeli.</li>
            <li>Görsel yükleme dosya tipi, boyut ve zararlı içerik kontrolünden geçmeli.</li>
            <li>Silme işlemleri soft delete, audit log ve geri alma süreciyle yapılmalı.</li>
            <li>CSV dışa aktarma yetki ve log kontrolüne bağlanmalı.</li>
          </ul>
        </article>
      </section>
    `;
  }

  function renderPanel() {
    const panel = byId("adminPanel");
    const renderers = {
      dashboard: renderDashboard,
      profile: renderProfile,
      stores: () => renderStores("store"),
      restaurants: () => renderStores("restaurant"),
      products: renderProducts,
      campaigns: renderCampaigns,
      coupons: renderCoupons,
      events: renderEvents,
      map: renderMap,
      reviews: renderReviews,
      orders: renderOrders,
      approvals: renderApprovals,
      audit: renderAudit,
      settings: renderSettings,
    };

    panel.innerHTML = (renderers[state.activeTab] || renderDashboard)();
    renderShell();
  }

  function readForm(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function createStore(form) {
    const payload = readForm(form);
    const type = form.dataset.storeType || "store";
    const id = `${type}-${window.AVM_SEED_DATA.slugify(payload.name)}-${Date.now()}`;
    state.data.stores.unshift(addCategoryMeta({
      id,
      mallId: state.selectedMallId,
      name: payload.name,
      type,
      category: payload.category,
      floor: payload.floor,
      unit: payload.unit,
      phone: payload.phone,
      image: payload.image || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80",
      status: "draft",
      approvalStatus: "pending",
      rating: 0,
      reviewCount: 0,
    }));
    addAudit("Taslak oluşturdu", payload.name, "medium");
  }

  function createProduct(form) {
    const payload = readForm(form);
    const store = state.data.stores.find((item) => item.id === payload.storeId);
    const id = `product-${window.AVM_SEED_DATA.slugify(payload.name)}-${Date.now()}`;
    state.data.products.unshift(addCategoryMeta({
      id,
      mallId: state.selectedMallId,
      storeId: payload.storeId,
      name: payload.name,
      category: payload.category,
      price: Number(payload.price),
      currency: "TRY",
      stock: Number(payload.stock),
      rating: 0,
      reviewCount: 0,
      image: payload.image,
      badge: store ? store.name : "Yeni",
      status: "draft",
    }));
    addAudit("Ürün taslağı oluşturdu", payload.name, "medium");
  }

  function createCampaign(form) {
    const payload = readForm(form);
    state.data.campaigns.unshift({
      id: `campaign-${Date.now()}`,
      mallId: state.selectedMallId,
      title: payload.title,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
      condition: payload.condition,
      cta: "Detayları Gör",
      status: "pending",
    });
    addAudit("Kampanyayı onaya gönderdi", payload.title, "medium");
  }

  function createCoupon(form) {
    const payload = readForm(form);
    state.data.coupons.unshift({
      id: `coupon-${Date.now()}`,
      mallId: state.selectedMallId,
      storeId: mallStores()[0] ? mallStores()[0].id : "",
      title: payload.title,
      code: payload.code,
      limit: Number(payload.limit),
      used: 0,
      status: "active",
      expiresAt: payload.expiresAt,
    });
    addAudit("Kupon oluşturdu", payload.code, "medium");
  }

  function createEvent(form) {
    const payload = readForm(form);
    state.data.events.unshift({
      id: `event-${Date.now()}`,
      mallId: state.selectedMallId,
      title: payload.title,
      location: payload.location,
      startsAt: payload.startsAt,
      status: "published",
    });
    addAudit("Etkinlik yayınladı", payload.title, "medium");
  }

  function approveEntity(entity, id) {
    const maps = {
      store: state.data.stores,
      product: state.data.products,
      campaign: state.data.campaigns,
      coupon: state.data.coupons,
      event: state.data.events,
      review: state.data.reviews,
    };
    const collection = maps[entity];
    if (!collection) return;
    const item = collection.find((entry) => entry.id === id);
    if (!item) return;
    item.status = "published";
    if ("approvalStatus" in item) item.approvalStatus = "approved";
    addAudit("Onayladı", item.name || item.title || id, "high");
  }

  function exportCsv(type) {
    const collections = {
      stores: mallStores(),
      store: mallStores("store"),
      restaurant: mallStores("restaurant"),
      products: mallProducts(),
      campaigns: mallCampaigns(),
    };
    const rows = collections[type] || collections.stores;
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const csv = [
      headers.join(","),
      ...rows.map((row) => headers.map((key) => JSON.stringify(row[key] || "")).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedMall().name}-${type}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    addAudit("CSV dışa aktardı", type, "medium");
  }

  function bindEvents() {
    byId("mallSelect").addEventListener("change", (event) => {
      state.selectedMallId = event.target.value;
      addAudit("AVM değiştirdi", selectedMall().name);
      renderPanel();
    });

    document.body.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-admin-tab]");
      if (tab) {
        state.activeTab = tab.dataset.adminTab;
        renderPanel();
        return;
      }

      const action = event.target.closest("[data-admin-action]");
      if (!action) return;

      const id = action.dataset.id;
      if (action.dataset.adminAction === "approve-store") approveEntity("store", id);
      if (action.dataset.adminAction === "publish-product") approveEntity("product", id);
      if (action.dataset.adminAction === "approve-any") approveEntity(action.dataset.entity, id);
      if (action.dataset.adminAction.startsWith("approve-")) {
        approveEntity(action.dataset.adminAction.replace("approve-", ""), id);
      }
      if (action.dataset.adminAction === "reject") {
        addAudit("Revizyon istedi", id, "medium");
      }
      if (action.dataset.adminAction === "export") {
        exportCsv(action.dataset.export);
      }
      renderPanel();
    });

    document.body.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-form]");
      if (!form) return;
      event.preventDefault();

      if (form.dataset.form === "profile") {
        const payload = readForm(form);
        const mall = selectedMall();
        Object.assign(mall, payload);
        addAudit("AVM profilini güncelledi", mall.name, "high");
      }
      if (form.dataset.form === "store") createStore(form);
      if (form.dataset.form === "product") createProduct(form);
      if (form.dataset.form === "campaign") createCampaign(form);
      if (form.dataset.form === "coupon") createCoupon(form);
      if (form.dataset.form === "event") createEvent(form);
      if (form.dataset.form === "supabase") {
        const payload = readForm(form);
        window.AVMDataClient.saveConfig(payload.url, payload.anonKey);
        addAudit("Supabase bağlantısını kaydetti", "Ayarlar", "high");
      }

      form.reset();
      renderPanel();
    });
  }

  async function init() {
    state.data = await window.AVMDataClient.loadAll();
    const urlMall = new URLSearchParams(window.location.search).get("mall");
    state.selectedMallId =
      urlMall && state.data.malls.some((mall) => mall.id === urlMall) ? urlMall : state.data.malls[0].id;
    renderShell();
    renderPanel();
    bindEvents();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
