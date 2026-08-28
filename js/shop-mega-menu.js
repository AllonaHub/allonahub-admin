(function () {
  const App = window.Allona = window.Allona || {};
  const menuItems = [
    {
      label: "Kadın",
      category: "Kadın",
      query: "Kadın",
      sidebar: ["Kadın Giyim", "Kadın Ayakkabı", "Kadın Çanta", "Kadın İç Giyim", "Kadın Aksesuar", "Sezon & Stil"],
      groups: [
        ["Kadın Giyim", ["Elbise", "Bluz & Tunik", "Gömlek", "T-Shirt", "Pantolon", "Jean", "Etek", "Ceket & Yelek", "Kaban & Mont", "Kazak & Hırka", "Sweatshirt", "Şort"]],
        ["Ayakkabı", ["Sneaker", "Topuklu Ayakkabı", "Bot", "Çizme", "Sandalet", "Terlik", "Babet", "Loafer"]],
        ["Çanta", ["Omuz Çantası", "Sırt Çantası", "El Çantası", "Cüzdan", "Makyaj Çantası", "Valiz"]],
        ["İç Giyim", ["Pijama", "Sütyen", "Külot", "Çorap", "Ev Giyim", "Body", "Tayt", "Plaj Giyim"]],
        ["Aksesuar", ["Kolye", "Küpe", "Bileklik", "Yüzük", "Şal", "Saç Aksesuarı"]],
        ["Sezon & Stil", ["Tesettür Giyim", "Büyük Beden", "Alt Üst Takım", "Abiye Elbise", "Mezuniyet Elbisesi", "Tulum & Salopet", "Kimono & Kaftan", "Trençkot", "Yağmurluk", "Gelinlik"]]
      ],
      feature: ["Kadın kategorisini derinleştir", "Trendyol ana navigasyonundaki kadın giyim, ayakkabı, çanta ve aksesuar kırılımları tek panelde.", "Kadın Ürünleri", "Kadın"],
      tiles: ["Elbise", "Bluz & Tunik", "Büyük Beden", "Tesettür", "Ayakkabı", "Çanta"]
    },
    {
      label: "Erkek",
      category: "Erkek",
      query: "Erkek",
      sidebar: ["Erkek Giyim", "Erkek Ayakkabı", "Erkek Aksesuar", "Spor Giyim", "Bakım"],
      groups: [
        ["Erkek Giyim", ["Gömlek", "T-shirt", "Sweatshirt", "Pantolon", "Jean", "Takım Elbise", "Ceket", "Mont"]],
        ["Ayakkabı", ["Spor Ayakkabı", "Klasik Ayakkabı", "Bot", "Sneaker", "Terlik", "Outdoor Ayakkabı"]],
        ["Aksesuar", ["Saat", "Cüzdan", "Kemer", "Gözlük", "Çanta", "Şapka"]],
        ["Spor", ["Eşofman", "Forma", "Antrenman", "Outdoor Giyim", "Koşu", "Fitness"]],
        ["Kişisel Bakım", ["Parfüm", "Tıraş", "Saç Bakım", "Deodorant", "Cilt Bakım", "Bakım Seti"]]
      ],
      feature: ["Erkek alışverişini netleştir", "Giyim, ayakkabı ve aksesuar ürünleri doğru alt kategoriyle listelenir.", "Erkek Ürünleri", "Erkek"],
      tiles: ["Gömlek", "Sneaker", "Saat", "Cüzdan", "Takım", "Outdoor"]
    },
    {
      label: "Elektronik",
      category: "Elektronik",
      query: "Elektronik",
      sidebar: ["Bilgisayar & Tablet", "Telefon & Aksesuar", "TV, Görüntü & Ses", "Beyaz Eşya", "Oyun & Konsol", "Yazıcı & Ofis"],
      groups: [
        ["Bilgisayar & Tablet", ["Laptop", "Tablet", "Masaüstü Bilgisayar", "Oyuncu Bilgisayarı", "Mini PC", "2'si 1 Arada"]],
        ["Telefon & Aksesuar", ["Cep Telefonu", "Akıllı Saat", "Telefon Kılıfı", "Şarj Cihazı", "Powerbank", "Bluetooth Kulaklık"]],
        ["Bilgisayar Parçaları", ["Anakart", "Ekran Kartı", "Bellek RAM", "İşlemci", "SSD", "Kasa ve Güç Kaynağı"]],
        ["TV & Beyaz Eşya", ["Televizyon", "Beyaz Eşya", "Buzdolabı", "Çamaşır Makinesi", "Bulaşık Makinesi", "Klima"]],
        ["Ağ, Modem & Akıllı Ev", ["Modem", "Router", "Access Point", "Akıllı Ev", "Akıllı Sensör", "Güvenlik Kamerası"]],
        ["Çevre Birimleri", ["Monitör", "Klavye", "Mouse", "Kulaklık", "Webcam", "Yazıcı"]],
        ["Oyuncu Donanımları", ["Gaming Laptop", "Oyuncu Mouse", "Oyuncu Kulaklığı", "Mekanik Klavye", "Oyun Kolu", "RGB Ekipman"]],
        ["Yazılım & Veri", ["Yazılım Ürünleri", "Antivirüs", "Office Yazılımı", "Harici Disk", "USB Bellek", "Hafıza Kartı"]]
      ],
      feature: ["Teknoloji alışverişini hızlandır", "Bilgisayar, tablet ve aksesuar ihtiyacını alt kategorilerle tek panelden keşfet.", "Elektroniği İncele", "Elektronik"],
      tiles: ["Monitörler", "RTX Laptoplar", "Akıllı Ev", "Yazılım & Güvenlik", "Veri Depolama", "Kulaklık & Ses"]
    },
    {
      label: "Ayakkabı & Çanta",
      category: "Ayakkabı & Çanta",
      query: "Ayakkabı Çanta",
      sidebar: ["Kadın Ayakkabı", "Erkek Ayakkabı", "Çanta", "Valiz", "Aksesuar"],
      groups: [
        ["Kadın Ayakkabı", ["Sneaker", "Topuklu", "Bot", "Çizme", "Sandalet", "Terlik"]],
        ["Erkek Ayakkabı", ["Spor Ayakkabı", "Klasik Ayakkabı", "Bot", "Outdoor Ayakkabı", "Loafer", "Terlik"]],
        ["Çanta", ["Omuz Çantası", "Sırt Çantası", "El Çantası", "Laptop Çantası", "Bel Çantası", "Cüzdan"]],
        ["Seyahat", ["Valiz", "Kabin Boy", "Seyahat Çantası", "Organizer", "Pasaportluk", "Bagaj Aksesuarı"]],
        ["Bakım", ["Ayakkabı Bakım", "Deri Bakım", "Çanta Askısı", "Tabanlık", "Bağcık", "Koruyucu Sprey"]]
      ],
      feature: ["Ayakkabı ve çanta ayrı vitrin", "Trendyol ana kategorisindeki ayakkabı & çanta bölümü doğrudan ürün eşlemesine bağlandı.", "Ayakkabı & Çanta", "Ayakkabı Çanta"],
      tiles: ["Sneaker", "Omuz Çantası", "Valiz", "Bot", "Cüzdan", "Laptop Çantası"]
    },
    {
      label: "Moda & Takı",
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
      label: "Ev & Yaşam",
      category: "Ev & Yaşam",
      query: "Ev Yaşam",
      sidebar: ["Ev Tekstili", "Mobilya", "Mutfak", "Dekorasyon", "Kırtasiye & Ofis"],
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
      label: "Oto, Bahçe & Yapı Market",
      category: "Oto, Bahçe & Yapı Market",
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
      label: "Spor & Outdoor",
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
      label: "Kozmetik & Kişisel Bakım",
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
      label: "Süpermarket & Pet Shop",
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
      label: "Kitap, Müzik & Hobi",
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
      label: "Saat & Aksesuar",
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

  const extraAliases = {
    "ayakkabi": "Ayakkabı & Çanta",
    "ayakkabi-canta": "Ayakkabı & Çanta",
    "abiye-elbise": "Kadın",
    "alt-ust-takim": "Kadın",
    "beyaz-esya": "Elektronik",
    "bilgisayar": "Elektronik",
    "bluz-tunik": "Kadın",
    "bluz-tunik-bustiyer": "Kadın",
    "buyuk-beden": "Kadın",
    "canta": "Ayakkabı & Çanta",
    "ceket-yelek": "Kadın",
    "cep-telefonu": "Elektronik",
    "ev-ofis": "Ev & Yaşam",
    "ev-yasam": "Ev & Yaşam",
    "erkek-giyim": "Erkek",
    "hepsiburada": "",
    "kadin-giyim": "Kadın",
    "kaban-mont": "Kadın",
    "kazak-hirka": "Kadın",
    "kimono-kaftan": "Kadın",
    "kitap-muzik-film-hobi": "Kitap & Hobi",
    "kirtasiye-ofis": "Ev & Yaşam",
    "kisisel-bakim": "Kozmetik",
    "kozmetik-kisisel-bakim": "Kozmetik",
    "mezuniyet-elbisesi": "Kadın",
    "mezuniyet-elbiseleri": "Kadın",
    "moda": "Moda",
    "oto-bahce-yapi-market": "Oto, Bahçe & Yapı Market",
    "pardosu-trenckot": "Kadın",
    "pet-shop": "Süpermarket",
    "petshop": "Süpermarket",
    "plaj-giyim": "Kadın",
    "saat": "Saat & Aksesuar",
    "saat-taki": "Saat & Aksesuar",
    "spor": "Spor & Outdoor",
    "supermarket-pet-shop": "Süpermarket",
    "tesettur": "Kadın",
    "tesettur-giyim": "Kadın",
    "telefon": "Elektronik",
    "tulum-salopet": "Kadın",
    "tv-beyaz-esya": "Elektronik"
  };

  const categoryPages = {
    "Kadın": "shop-kadin.html",
    "Erkek": "shop-erkek.html",
    "Elektronik": "shop-elektronik.html",
    "Ayakkabı & Çanta": "shop-ayakkabi-canta.html",
    "Moda": "shop-moda-taki.html",
    "Ev & Yaşam": "shop-ev-yasam.html",
    "Oto, Bahçe & Yapı Market": "shop-oto-bahce-yapi-market.html",
    "Anne & Çocuk": "shop-anne-cocuk.html",
    "Spor & Outdoor": "shop-spor-outdoor.html",
    "Kozmetik": "shop-kozmetik-kisisel-bakim.html",
    "Süpermarket": "shop-supermarket-pet-shop.html",
    "Kitap & Hobi": "shop-kitap-muzik-hobi.html",
    "Saat & Aksesuar": "shop-saat-aksesuar.html"
  };

  function escapeHTML(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function categoryPage(category) {
    const item = menuItems.find((entry) => entry.category === category || entry.label === category) || resolveCategory(category);
    return item ? categoryPages[item.category] || "shop.html" : "shop.html";
  }

  function href(query, category) {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (query) params.set("q", query);
    const page = category ? categoryPage(category) : "shop.html";
    const queryString = params.toString();
    return queryString ? `${page}?${queryString}` : page;
  }

  function renderLink(label, category, className) {
    return `<a${className ? ` class="${className}"` : ""} href="${escapeHTML(href(label, category))}">${escapeHTML(label)}</a>`;
  }

  function bestGroupIndex(sidebarLabel, groups, fallbackIndex) {
    const sidebarNorm = normalizeText(sidebarLabel);
    const matchIndex = groups.findIndex(([title]) => {
      const titleNorm = normalizeText(title);
      return titleNorm && (sidebarNorm.includes(titleNorm) || titleNorm.includes(sidebarNorm));
    });
    return matchIndex >= 0 ? matchIndex : Math.min(fallbackIndex, Math.max(groups.length - 1, 0));
  }

  function renderSidebarLink(label, category, groups, index) {
    const targetIndex = bestGroupIndex(label, groups, index);
    const className = index === 0 ? "is-active" : "";
    return `<a${className ? ` class="${className}"` : ""} href="${escapeHTML(href(label, category))}" data-shop-sidebar-link data-shop-group-index="${targetIndex}">${escapeHTML(label)}</a>`;
  }

  function renderGroup(group, category, index) {
    const [title, links] = group;
    const activeClass = index === 0 ? " is-active" : "";
    return `
      <div class="shop-mega-col${activeClass}" data-shop-mega-group data-shop-group-index="${index}">
        <h3>${escapeHTML(title)}</h3>
        ${links.map((link) => renderLink(link, category)).join("")}
      </div>
    `;
  }

  function renderItem(item) {
    const [featureTitle, featureText, featureCta, featureQuery] = item.feature;
    return `
      <div class="shop-category-item">
        <a class="shop-category-trigger" href="${escapeHTML(href("", item.category))}" title="${escapeHTML(item.label)}" aria-haspopup="true" aria-expanded="false">${escapeHTML(item.label)}</a>
        <div class="shop-category-mega" role="menu" aria-label="${escapeHTML(item.label)} kategorileri">
          <div class="shop-mega-sidebar" aria-label="${escapeHTML(item.label)} alt kategorileri">
            ${item.sidebar.map((link, index) => renderSidebarLink(link, item.category, item.groups, index)).join("")}
          </div>
          <div class="shop-mega-content">
            ${item.groups.map((group, index) => renderGroup(group, item.category, index)).join("")}
          </div>
          <div class="shop-mega-spotlight">
            <div class="shop-mega-feature">
              <small>${escapeHTML(item.label)}</small>
              <strong>${escapeHTML(featureTitle)}</strong>
              <span>${escapeHTML(featureText)}</span>
              <a class="shop-mega-cta" href="${escapeHTML(href(featureQuery, item.category))}">${escapeHTML(featureCta)}</a>
            </div>
            <div class="shop-mega-tile-grid">
              ${item.tiles.map((tile) => `
                <a class="shop-mega-tile" href="${escapeHTML(href(tile, item.category))}">
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
    const page = window.location.pathname.split("/").pop();
    nav.querySelectorAll(".shop-category-trigger").forEach((trigger) => {
      const text = trigger.textContent.toLocaleLowerCase("tr-TR");
      const item = menuItems.find((entry) => entry.label === trigger.textContent.trim());
      const isActive = Boolean(text && (category.includes(text) || query.includes(text) || (item && categoryPages[item.category] === page)));
      trigger.classList.toggle("is-active", isActive);
      if (isActive) trigger.setAttribute("aria-current", "page");
      else trigger.removeAttribute("aria-current");
    });
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ı/g, "i")
      .replace(/İ/g, "i")
      .toLocaleLowerCase("tr-TR")
      .replace(/&/g, " ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function itemTerms(item) {
    return [
      item.label,
      item.category,
      item.query,
      ...(item.sidebar || []),
      ...(item.tiles || []),
      ...(item.groups || []).flatMap(([title, links]) => [title, ...(links || [])])
    ].filter(Boolean);
  }

  const categoryLookup = new Map();
  const categoryTermLookup = new Map();

  menuItems.forEach((item) => {
    const terms = [...new Set(itemTerms(item).map(normalizeText).filter(Boolean))];
    terms.forEach((term) => {
      if (!categoryLookup.has(term)) categoryLookup.set(term, item);
    });
    categoryTermLookup.set(item.category, terms);
  });

  Object.entries(extraAliases).forEach(([alias, category]) => {
    if (!category) return;
    const item = menuItems.find((entry) => entry.category === category || entry.label === category);
    if (item) {
      const normalizedAlias = normalizeText(alias);
      categoryLookup.set(normalizedAlias, item);
      const terms = categoryTermLookup.get(item.category) || [];
      if (normalizedAlias && !terms.includes(normalizedAlias)) {
        categoryTermLookup.set(item.category, [...terms, normalizedAlias]);
      }
    }
  });

  function resolveCategory(value) {
    const normalized = normalizeText(value);
    return categoryLookup.get(normalized) || null;
  }

  function productText(product) {
    const categoryLabel = App.core?.labelFromValue ? App.core.labelFromValue(product?.category, "") : product?.category;
    return [
      product?.name,
      product?.product_name,
      product?.description,
      categoryLabel,
      product?.brand,
      product?.seller_name,
      product?.seller_public_name,
      product?.store_name,
      product?.meta_title,
      product?.meta_description
    ].filter(Boolean).join(" ");
  }

  function cleanCategoryLabel(value) {
    const label = App.core?.labelFromValue ? App.core.labelFromValue(value, "") : String(value || "");
    const normalized = normalizeText(label);
    return label && label !== "[object Object]" && normalized !== "genel" ? label : "";
  }

  function productMatchesCategory(product, selectedCategory) {
    const rawSelected = String(selectedCategory || "").trim();
    if (!rawSelected) return true;

    const selectedNorm = normalizeText(rawSelected);
    const productCategoryValue = cleanCategoryLabel(product?.category);
    const productCategoryNorm = normalizeText(productCategoryValue || "");
    const productHaystack = normalizeText(productText(product));
    const selectedItem = resolveCategory(rawSelected);

    if (productCategoryNorm === selectedNorm || productHaystack.includes(selectedNorm)) return true;
    if (!selectedItem) return false;

    const rootTerms = categoryTermLookup.get(selectedItem.category) || [];
    if (rootTerms.includes(productCategoryNorm)) return true;
    return rootTerms.some((term) => term.length >= 4 && productHaystack.includes(term));
  }

  function categoryOptions(productList) {
    const roots = menuItems.map((item) => cleanCategoryLabel(item.category));
    const productCategories = (productList || [])
      .map((product) => cleanCategoryLabel(product.category))
      .filter(Boolean);
    return [...new Set([...roots, ...productCategories])].sort((a, b) => a.localeCompare(b, "tr"));
  }

  function closeMenus(nav) {
    nav.querySelectorAll(".shop-category-item.is-open").forEach((item) => {
      item.classList.remove("is-open");
      item.querySelector(".shop-category-trigger")?.setAttribute("aria-expanded", "false");
    });
  }

  function activateSidebarGroup(item, groupIndex = 0) {
    const panel = item?.querySelector(".shop-category-mega");
    if (!panel) return;
    const links = [...panel.querySelectorAll("[data-shop-sidebar-link]")];
    const groups = [...panel.querySelectorAll("[data-shop-mega-group]")];
    if (!groups.length) return;
    const targetIndex = Math.max(0, Math.min(Number(groupIndex) || 0, groups.length - 1));
    panel.classList.add("is-guided");
    links.forEach((link) => {
      link.classList.toggle("is-active", Number(link.dataset.shopGroupIndex) === targetIndex);
    });
    groups.forEach((group, index) => {
      group.classList.toggle("is-active", index === targetIndex);
    });
  }

  function openMenuItem(nav, item) {
    closeMenus(nav);
    item.classList.add("is-open");
    item.querySelector(".shop-category-trigger")?.setAttribute("aria-expanded", "true");
    const activeLink = item.querySelector("[data-shop-sidebar-link].is-active") || item.querySelector("[data-shop-sidebar-link]");
    activateSidebarGroup(item, activeLink?.dataset.shopGroupIndex || 0);
  }

  function bindMenuInteractions(nav) {
    if (nav.dataset.shopMegaBound === "true") return;
    nav.dataset.shopMegaBound = "true";
    let closeTimer = 0;

    nav.addEventListener("pointerenter", (event) => {
      const item = event.target.closest(".shop-category-item");
      if (!item || !nav.contains(item)) return;
      window.clearTimeout(closeTimer);
      openMenuItem(nav, item);
    }, true);

    nav.addEventListener("focusin", (event) => {
      const item = event.target.closest(".shop-category-item");
      if (!item || !nav.contains(item)) return;
      openMenuItem(nav, item);
      const sidebarLink = event.target.closest("[data-shop-sidebar-link]");
      if (sidebarLink) activateSidebarGroup(item, sidebarLink.dataset.shopGroupIndex);
    });

    nav.addEventListener("pointerover", (event) => {
      if (event.target.closest(".shop-category-mega, .shop-category-trigger")) {
        window.clearTimeout(closeTimer);
      }
      const sidebarLink = event.target.closest("[data-shop-sidebar-link]");
      if (!sidebarLink || !nav.contains(sidebarLink)) return;
      const item = sidebarLink.closest(".shop-category-item");
      if (!item) return;
      window.clearTimeout(closeTimer);
      activateSidebarGroup(item, sidebarLink.dataset.shopGroupIndex);
    });

    nav.addEventListener("pointerleave", (event) => {
      if (event.relatedTarget && nav.contains(event.relatedTarget)) return;
      closeTimer = window.setTimeout(() => closeMenus(nav), 180);
    });

    nav.addEventListener("keydown", (event) => {
      const current = event.target.closest(".shop-category-item");
      if (!current) return;
      const items = [...nav.querySelectorAll(".shop-category-item")];
      const index = items.indexOf(current);
      if (event.key === "Escape") {
        closeMenus(nav);
        current.querySelector(".shop-category-trigger")?.focus();
      }
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        const next = items[(index + 1) % items.length];
        next.querySelector(".shop-category-trigger")?.focus();
        openMenuItem(nav, next);
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        const prev = items[(index - 1 + items.length) % items.length];
        prev.querySelector(".shop-category-trigger")?.focus();
        openMenuItem(nav, prev);
      }
    });

    nav.addEventListener("click", (event) => {
      const trigger = event.target.closest(".shop-category-trigger");
      if (!trigger || !nav.contains(trigger)) return;
      const item = trigger.closest(".shop-category-item");
      const panel = item?.querySelector(".shop-category-mega");
      if (!panel || window.getComputedStyle(panel).display === "none") return;
      closeMenus(nav);
    });
  }

  function renderMenus() {
    document.querySelectorAll("[data-shop-mega-menu]").forEach((nav) => {
      nav.innerHTML = menuItems.map(renderItem).join("");
      nav.dataset.shopMegaReady = "true";
      markActive(nav);
      bindMenuInteractions(nav);
    });
  }

  App.shopCategories = {
    items: menuItems,
    normalizeText,
    categoryPage,
    resolveCategory,
    productMatchesCategory,
    categoryOptions
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderMenus);
  } else {
    renderMenus();
  }
})();
