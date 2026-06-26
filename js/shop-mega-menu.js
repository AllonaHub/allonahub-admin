(function () {
  const menuItems = [
    {
      label: "Elektronik",
      category: "Elektronik",
      query: "Elektronik",
      sidebar: ["Bilgisayar & Tablet", "Telefon & Aksesuar", "TV, Görüntü & Ses", "Oyun & Konsol", "Yazıcı & Ofis"],
      groups: [
        ["Bilgisayar & Tablet", ["Laptop", "Tablet", "Masaüstü Bilgisayar", "Oyuncu Bilgisayarı", "Mini PC", "2'si 1 Arada"]],
        ["Bilgisayar Parçaları", ["Anakart", "Ekran Kartı", "Bellek RAM", "İşlemci", "SSD", "Kasa ve Güç Kaynağı"]],
        ["Ağ, Modem & Akıllı Ev", ["Modem", "Router", "Access Point", "Akıllı Ev", "Akıllı Sensör", "Güvenlik Kamerası"]],
        ["Çevre Birimleri", ["Monitör", "Klavye", "Mouse", "Kulaklık", "Webcam", "Yazıcı"]],
        ["Oyuncu Donanımları", ["Gaming Laptop", "Oyuncu Mouse", "Oyuncu Kulaklığı", "Mekanik Klavye", "Oyun Kolu", "RGB Ekipman"]],
        ["Yazılım & Veri", ["Yazılım Ürünleri", "Antivirüs", "Office Yazılımı", "Harici Disk", "USB Bellek", "Hafıza Kartı"]]
      ],
      feature: ["Teknoloji alışverişini hızlandır", "Bilgisayar, tablet ve aksesuar ihtiyacını alt kategorilerle tek panelden keşfet.", "Elektroniği İncele", "Elektronik"],
      tiles: ["Monitörler", "RTX Laptoplar", "Akıllı Ev", "Yazılım & Güvenlik", "Veri Depolama", "Kulaklık & Ses"]
    },
    {
      label: "Moda",
      category: "Moda",
      query: "Moda",
      sidebar: ["Kadın", "Erkek", "Ayakkabı & Çanta", "Takı & Aksesuar", "İç Giyim"],
      groups: [
        ["Kadın Giyim", ["Elbise", "Bluz", "Ceket", "Pantolon", "Kazak", "Dış Giyim"]],
        ["Erkek Giyim", ["Gömlek", "T-shirt", "Sweatshirt", "Pantolon", "Mont", "Takım"]],
        ["Ayakkabı", ["Sneaker", "Topuklu", "Bot", "Sandalet", "Klasik Ayakkabı", "Spor Ayakkabı"]],
        ["Çanta", ["Omuz Çantası", "Sırt Çantası", "El Çantası", "Cüzdan", "Valiz", "Laptop Çantası"]],
        ["Takı & Stil", ["Kolye", "Küpe", "Bileklik", "Yüzük", "Halhal", "Saç Aksesuarı"]],
        ["Tamamlayıcılar", ["Saat", "Gözlük", "Kemer", "Şapka", "Sezon Ürünleri", "Hediye Seti"]]
      ],
      feature: ["Stil kategorileri tek bakışta", "Giyimden takıya kadar popüler moda alanları dolu ve düzenli.", "Moda Ürünleri", "Moda"],
      tiles: ["Yeni Sezon", "Takı Koleksiyonu", "Çanta & Valiz", "Ayakkabı Seçimi", "Saat & Gözlük", "Premium Stil"]
    },
    {
      label: "Ev & Ofis",
      category: "Ev & Yaşam",
      query: "Ev Yaşam",
      sidebar: ["Ev Tekstili", "Mobilya", "Mutfak", "Kırtasiye & Ofis", "Dekorasyon"],
      groups: [
        ["Ev Yaşam", ["Mobilya", "Dekorasyon", "Aydınlatma", "Ev Tekstili", "Halı", "Duvar Dekoru"]],
        ["Mutfak & Sofra", ["Mutfak Gereçleri", "Sofra", "Kahve", "Tencere Tava", "Saklama", "Küçük Ev Aleti"]],
        ["Düzen & Temizlik", ["Düzenleyici", "Temizlik", "Banyo", "Çamaşır", "Ütü", "Depolama"]],
        ["Ofis & Kırtasiye", ["Defter", "Kalem", "Yazıcı Kağıdı", "Ofis Sandalyesi", "Masa", "Ajanda"]],
        ["Hobi & Yaşam", ["Hobi", "El İşi", "Bahçe", "Kamp Mutfağı", "Bitki Bakımı", "Seyahat"]],
        ["Ev Elektriği", ["Priz", "Uzatma Kablosu", "Ampul", "Akıllı Priz", "Kablo Düzenleyici", "Güvenlik"]]
      ],
      feature: ["Evi ve ofisi düzenle", "Ev, mutfak, dekorasyon ve ofis ihtiyaçlarını profesyonel bir katalog yapısıyla sun.", "Ev Yaşam", "Ev Yaşam"],
      tiles: ["Mutfak", "Ev Tekstili", "Ofis", "Dekorasyon", "Temizlik", "Aydınlatma"]
    },
    {
      label: "Oto & Yapı",
      category: "Oto & Yapı",
      query: "Oto Bahçe Yapı",
      sidebar: ["Oto Aksesuar", "Yapı Market", "Bahçe", "Elektrikli Alet", "Hırdavat"],
      groups: [
        ["Oto Aksesuar", ["Oto Bakım", "Telefon Tutucu", "Paspas", "Koltuk Kılıfı", "Kamera", "Oto Ses"]],
        ["Yapı Market", ["Boya", "Matkap", "El Aletleri", "Elektrik", "Tesisat", "İzolasyon"]],
        ["Bahçe", ["Bahçe Mobilyası", "Sulama", "Mangal", "Bitki", "Bahçe Aleti", "Dış Mekan"]],
        ["Tamir & Kurulum", ["Vida", "Tamir Seti", "Merdiven", "Ölçüm Aleti", "Koruyucu Ekipman", "Yedek Parça"]],
        ["Elektrikli Aletler", ["Şarjlı Matkap", "Testere", "Taşlama", "Zımpara", "Kaynak", "Kompresör"]],
        ["Güvenlik", ["Kilit", "Alarm", "Kamera Sistemi", "İş Güvenliği", "Reflektör", "Eldiven"]]
      ],
      feature: ["Tamirden bahçeye tek rota", "Oto, yapı market ve dış mekan ürünleri karar vermeyi kolaylaştıran bölümlerle ayrıldı.", "Yapı & Bahçe", "Yapı Market"],
      tiles: ["Oto Bakım", "Matkap Setleri", "Bahçe", "Boya", "Güvenlik", "Hırdavat"]
    },
    {
      label: "Anne & Çocuk",
      category: "Anne & Çocuk",
      query: "Anne Bebek Oyuncak",
      sidebar: ["Bebek", "Çocuk", "Oyuncak", "Okul", "Anne Bakım"],
      groups: [
        ["Bebek", ["Bebek Giyim", "Bebek Bakım", "Bebek Arabası", "Mama", "Bebek Bezi", "Bebek Odası"]],
        ["Çocuk", ["Çocuk Giyim", "Çocuk Ayakkabı", "Okul Çantası", "Kitap", "Kırtasiye", "Beslenme"]],
        ["Oyuncak", ["Eğitici Oyuncak", "Bebek Oyuncağı", "Puzzle", "Yapı Seti", "Figür", "Dijital Oyun"]],
        ["Anne", ["Hamile Giyim", "Emzirme", "Anne Bakım", "Çanta", "Sağlık", "Konfor Ürünleri"]],
        ["Güvenli Yaşam", ["Bebek Telsizi", "Güvenlik Kilidi", "Termometre", "Uyku Ürünleri", "Banyo", "Beslenme Seti"]],
        ["Parti & Etkinlik", ["Doğum Günü", "Kostüm", "Hediye", "Balon", "Oyun Alanı", "Sanat Seti"]]
      ],
      feature: ["Aile alışverişini kolaylaştır", "Anne, bebek ve çocuk kategorileri dolu, temiz ve hızlı taranır hale getirildi.", "Aile Ürünleri", "Anne Bebek"],
      tiles: ["Bebek Bakım", "Oyuncak", "Okul", "Anne Konfor", "Bebek Odası", "Hediye"]
    },
    {
      label: "Spor",
      category: "Spor & Outdoor",
      query: "Spor Outdoor",
      sidebar: ["Spor Giyim", "Fitness", "Outdoor", "Bisiklet", "Beslenme"],
      groups: [
        ["Spor Giyim", ["Spor Ayakkabı", "Eşofman", "Tayt", "Forma", "Spor Ceket", "Antrenman"]],
        ["Fitness", ["Dambıl", "Yoga Matı", "Direnç Bandı", "Kondisyon", "Ağırlık", "Pilates"]],
        ["Outdoor", ["Kamp", "Yürüyüş", "Çadır", "Uyku Tulumu", "Termos", "Outdoor Aydınlatma"]],
        ["Bisiklet & Deniz", ["Bisiklet", "Kask", "Pompa", "Deniz Sporu", "Yüzme", "Dalış"]],
        ["Takım Sporları", ["Futbol", "Basketbol", "Voleybol", "Tenis", "Raket", "Top"]],
        ["Beslenme", ["Protein", "Vitamin", "Shaker", "Enerji Bar", "Su Matarası", "Takviye"]]
      ],
      feature: ["Aktif yaşam kategorileri", "Spor, fitness ve outdoor ihtiyaçları tek panelde net gruplandı.", "Sporu Keşfet", "Spor"],
      tiles: ["Fitness", "Kamp", "Spor Ayakkabı", "Bisiklet", "Takviye", "Forma"]
    },
    {
      label: "Kozmetik",
      category: "Kozmetik",
      query: "Kozmetik",
      sidebar: ["Makyaj", "Cilt Bakım", "Saç Bakım", "Parfüm", "Kişisel Bakım"],
      groups: [
        ["Makyaj", ["Ruj", "Fondöten", "Maskara", "Allık", "Far", "Makyaj Fırçaları"]],
        ["Cilt Bakım", ["Nemlendirici", "Serum", "Güneş Kremi", "Temizleyici", "Tonik", "Maske"]],
        ["Saç Bakım", ["Şampuan", "Saç Kremi", "Saç Maskesi", "Şekillendirici", "Saç Boyası", "Tarak"]],
        ["Parfüm", ["Kadın Parfüm", "Erkek Parfüm", "Unisex Parfüm", "Deodorant", "Setler", "Vücut Spreyi"]],
        ["Kişisel Bakım", ["Ağız Bakım", "Tıraş", "Hijyen", "Epilasyon", "Banyo", "El Ayak Bakım"]],
        ["Dermokozmetik", ["Hassas Cilt", "Leke Bakımı", "Akneli Cilt", "Anti Aging", "Vücut Bakım", "Bebek Bakım"]]
      ],
      feature: ["Bakım rutini için hızlı seçim", "Makyaj, cilt, saç ve parfüm kategorileri net karar alanlarıyla ayrıldı.", "Bakımı İncele", "Kozmetik"],
      tiles: ["Cilt Bakım", "Parfüm", "Saç Bakım", "Makyaj", "Hijyen", "Güneş Koruma"]
    },
    {
      label: "Süpermarket",
      category: "Süpermarket",
      query: "Süpermarket Pet",
      sidebar: ["Gıda", "Temizlik", "Kişisel Hijyen", "Bebek Bezi", "Pet Shop"],
      groups: [
        ["Gıda", ["Kahvaltılık", "Atıştırmalık", "İçecek", "Organik", "Bakliyat", "Kahve"]],
        ["Temizlik", ["Çamaşır", "Bulaşık", "Yüzey Temizleyici", "Kağıt Ürünleri", "Çöp Torbası", "Oda Kokusu"]],
        ["Kişisel Hijyen", ["Sabun", "Şampuan", "Diş Bakım", "Islak Mendil", "Ped", "Dezenfektan"]],
        ["Bebek & Aile", ["Bebek Bezi", "Mama", "Bebek Temizlik", "Vitamin", "Sağlık", "İlk Yardım"]],
        ["Pet Shop", ["Kedi Maması", "Köpek Maması", "Kum", "Ödül Maması", "Oyuncak", "Bakım"]],
        ["Pratik Sepet", ["Çok Satan Market", "Kuponlu Ürün", "Hızlı Teslimat", "Aylık İhtiyaç", "Toplu Alım", "Ekonomik Paket"]]
      ],
      feature: ["Günlük ihtiyaç sepeti", "Market, temizlik ve pet shop kategorileri hızlı alışveriş için tek yerde.", "Market Sepeti", "Süpermarket"],
      tiles: ["Kahvaltılık", "Temizlik", "Pet Shop", "Bebek Bezi", "Kahve", "Hijyen"]
    },
    {
      label: "Kitap & Hobi",
      category: "Kitap & Hobi",
      query: "Kitap Hobi",
      sidebar: ["Kitap", "Müzik", "Film", "Hobi", "Koleksiyon"],
      groups: [
        ["Kitap", ["Roman", "Çocuk Kitabı", "Kişisel Gelişim", "İş Ekonomi", "Eğitim", "Sınav Hazırlık"]],
        ["Müzik", ["Enstrüman", "Gitar", "Piyano", "Aksesuar", "Mikrofon", "Ses Kayıt"]],
        ["Film & Oyun", ["Film", "Dizi", "Kutu Oyunu", "Puzzle", "Konsol Oyunu", "Kart Oyunu"]],
        ["Hobi", ["Boyama", "El İşi", "Makrome", "Model", "Fotoğraf", "Sanat Seti"]],
        ["Koleksiyon", ["Figür", "Plak", "Poster", "Özel Baskı", "Retro", "Hediye"]],
        ["Ofis & Okul", ["Defter", "Kalem", "Ajanda", "Çanta", "Masa Üstü", "Planlayıcı"]]
      ],
      feature: ["Hobi ve kültür alanları", "Kitap, müzik, film ve üretici hobi kategorileri dolu alt gruplarla açılıyor.", "Hobiye Git", "Hobi"],
      tiles: ["Roman", "Enstrüman", "Kutu Oyunu", "Sanat Seti", "Koleksiyon", "Okul"]
    },
    {
      label: "Saat & Takı",
      category: "Saat & Aksesuar",
      query: "Saat Takı Aksesuar",
      sidebar: ["Saat", "Takı", "Gözlük", "Çanta Aksesuar", "Hediye"],
      groups: [
        ["Saat", ["Kadın Saat", "Erkek Saat", "Akıllı Saat", "Spor Saat", "Klasik Saat", "Saat Kordonu"]],
        ["Takı", ["Kolye", "Küpe", "Bileklik", "Yüzük", "Halhal", "Set"]],
        ["Aksesuar", ["Gözlük", "Kemer", "Şapka", "Kartlık", "Cüzdan", "Anahtarlık"]],
        ["Çanta Tamamlayıcı", ["Çanta Askısı", "Makyaj Çantası", "Takı Kutusu", "Seyahat Çantası", "Organizer", "Valiz Aksesuar"]],
        ["Özel Gün", ["Hediye Seti", "Kutulu Ürün", "Sevgiliye Hediye", "Anneler Günü", "Doğum Günü", "Kurumsal Hediye"]],
        ["Bakım", ["Takı Bakımı", "Saat Bakımı", "Gözlük Temizliği", "Deri Bakım", "Saklama", "Koruma"]]
      ],
      feature: ["Detay ürünleri kaybolmasın", "Saat, takı ve aksesuarlar detaylı ama sade bir karar panelinde toplandı.", "Aksesuarı İncele", "Aksesuar"],
      tiles: ["Kolye", "Yüzük", "Saat", "Gözlük", "Hediye Seti", "Organizer"]
    }
  ];

  function escapeHTML(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function href(query, category) {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (query) params.set("q", query);
    return `shop.html?${params.toString()}`;
  }

  function renderLink(label, category, className) {
    return `<a${className ? ` class="${className}"` : ""} href="${escapeHTML(href(label))}">${escapeHTML(label)}</a>`;
  }

  function renderGroup(group, category) {
    const [title, links] = group;
    return `
      <div class="shop-mega-col">
        <h3>${escapeHTML(title)}</h3>
        ${links.map((link) => renderLink(link, category)).join("")}
      </div>
    `;
  }

  function renderItem(item) {
    const [featureTitle, featureText, featureCta, featureQuery] = item.feature;
    return `
      <div class="shop-category-item">
        <a class="shop-category-trigger" href="${escapeHTML(href(item.query))}" aria-haspopup="true">${escapeHTML(item.label)}</a>
        <div class="shop-category-mega" role="menu" aria-label="${escapeHTML(item.label)} kategorileri">
          <div class="shop-mega-sidebar" aria-label="${escapeHTML(item.label)} alt kategorileri">
            ${item.sidebar.map((link, index) => renderLink(link, item.category, index === 0 ? "is-active" : "")).join("")}
          </div>
          <div class="shop-mega-content">
            ${item.groups.map((group) => renderGroup(group, item.category)).join("")}
          </div>
          <div class="shop-mega-spotlight">
            <div class="shop-mega-feature">
              <small>${escapeHTML(item.label)}</small>
              <strong>${escapeHTML(featureTitle)}</strong>
              <span>${escapeHTML(featureText)}</span>
              <a class="shop-mega-cta" href="${escapeHTML(href(featureQuery))}">${escapeHTML(featureCta)}</a>
            </div>
            <div class="shop-mega-tile-grid">
              ${item.tiles.map((tile) => `
                <a class="shop-mega-tile" href="${escapeHTML(href(tile))}">
                  <strong>${escapeHTML(tile)}</strong>
                  <span>Hızlı keşif</span>
                </a>
              `).join("")}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function markActive(nav) {
    const params = new URLSearchParams(window.location.search);
    const category = (params.get("category") || "").toLocaleLowerCase("tr-TR");
    const query = (params.get("q") || "").toLocaleLowerCase("tr-TR");
    nav.querySelectorAll(".shop-category-trigger").forEach((trigger) => {
      const text = trigger.textContent.toLocaleLowerCase("tr-TR");
      const isActive = Boolean(text && (category.includes(text) || query.includes(text)));
      trigger.classList.toggle("is-active", isActive);
      if (isActive) trigger.setAttribute("aria-current", "page");
      else trigger.removeAttribute("aria-current");
    });
  }

  function renderMenus() {
    document.querySelectorAll("[data-shop-mega-menu]").forEach((nav) => {
      nav.innerHTML = menuItems.map(renderItem).join("");
      nav.dataset.shopMegaReady = "true";
      markActive(nav);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderMenus);
  } else {
    renderMenus();
  }
})();
