(function () {
  const state = {
    data: null,
    selectedMallId: null,
  };

  const byId = (id) => document.getElementById(id);

  function selectedMall() {
    return state.data.malls.find((mall) => mall.id === state.selectedMallId) || state.data.malls[0];
  }

  function mallStores() {
    return state.data.stores.filter((store) => store.mallId === state.selectedMallId);
  }

  function renderMallOptions() {
    byId("partnerMallSelect").innerHTML = state.data.malls
      .map((mall) => `<option value="${mall.id}" ${mall.id === state.selectedMallId ? "selected" : ""}>${mall.name} - ${mall.city}</option>`)
      .join("");
  }

  function renderOverview() {
    const mall = selectedMall();
    const stores = mallStores();
    const products = state.data.products.filter((product) => product.mallId === mall.id);
    byId("partnerMallName").textContent = mall.name;
    byId("partnerMallLocation").textContent = `${mall.city} / ${mall.district}`;
    byId("partnerMallStatus").textContent = mall.partnerStatus === "partner-ready" ? "Partnerliğe hazır" : "Onboarding bekliyor";
    byId("partnerStoreCount").textContent = stores.length;
    byId("partnerProductCount").textContent = products.length;
    byId("partnerAdminLink").href = `admin.html?mall=${encodeURIComponent(mall.id)}`;
    byId("partnerPublicLink").href = `index.html?mall=${encodeURIComponent(mall.id)}`;
  }

  function renderSections() {
    const sections = [
      {
        title: "1. Partner Başvuru ve Sözleşme",
        items: ["Yetkili kişi bilgileri", "Vergi ve firma bilgileri", "KVKK aydınlatma metni", "Partner koşulları ve içerik sorumluluğu", "Rol ve sahiplik sınırları"],
      },
      {
        title: "2. AVM Profil Yönetimi",
        items: ["Logo ve kapak görselleri", "Adres, ulaşım ve iletişim", "Çalışma saatleri", "Özel gün istisnaları"],
      },
      {
        title: "3. Mağaza, İşletme ve Restoran Yönetimi",
        items: ["Marka ve kategori bilgileri", "Kat ve ünite no", "Telefon ve mağaza durumu", "Açılış/kapanış bildirimleri"],
      },
      {
        title: "4. Shop ve Ürün Vitrini",
        items: ["Ürün adı ve kategori", "Fiyat, stok ve para birimi", "Supabase Storage görselleri", "Sepete ekle ve hemen al akışı"],
      },
      {
        title: "5. Kampanya, Kupon ve Etkinlik",
        items: ["Tarih kontrollü kampanyalar", "Limitli kuponlar", "Etkinlik lokasyonu", "Açık kampanya koşulları", "Ticari ileti izni ayrı bildirim tercihleri"],
      },
      {
        title: "6. Onay, Moderasyon ve Audit",
        items: ["Taslak ve onay bekliyor durumları", "Admin revizyon notları", "Yayın ve arşiv kayıtları", "Kritik işlemlerde audit log"],
      },
      {
        title: "7. Raporlama ve Dışa Aktarma",
        items: ["Mağaza görüntülenmeleri", "Ürün tıklamaları", "Kupon kullanım oranı", "Yetkili CSV dışa aktarma"],
      },
      {
        title: "8. Destek ve Operasyon",
        items: ["Partner destek talebi", "Mağaza veri uyuşmazlığı", "Görsel kalite kontrolü", "Acil içerik pasifleştirme"],
      },
    ];

    byId("partnerSections").innerHTML = sections
      .map(
        (section) => `
          <article class="partner-section">
            <h2>${section.title}</h2>
            <ul>${section.items.map((item) => `<li>${item}</li>`).join("")}</ul>
          </article>
        `
      )
      .join("");
  }

  function renderChecklist() {
    const items = [
      "AVM partner kullanıcısı sadece kendi AVM kaydını görebilir.",
      "Partner başvurusunda vergi/firma bilgileri resmi kayıtlarla doğrulanır.",
      "KVKK aydınlatması ve gerekli sözleşme metinleri onay akışında görünür.",
      "Mağaza, restoran ve ürün değişiklikleri onay kuyruğuna düşer.",
      "Ürün görselleri Supabase Storage public URL veya signed URL ile gelir.",
      "Kampanya ve kuponlar tarih/limit dolduğunda otomatik pasifleşir.",
      "Kampanya, fiyat ve stok beyanları yanıltıcı reklam riski açısından kontrol edilir.",
      "Pazarlama ve ticari ileti izinleri zorunlu bildirimlerden ayrı tutulur.",
      "Sepete ekle ve hemen al aksiyonları ürün stok durumunu kontrol eder.",
      "Değerlendirmeler moderasyon filtresinden geçmeden öne çıkarılmaz.",
      "CSV dışa aktarma yetkili role ve audit log kaydına bağlıdır.",
      "Mobilde tablolar kart veya kendi içinde yatay kaydırma düzenine döner.",
    ];

    byId("partnerChecklist").innerHTML = items.map((item) => `<li>${item}</li>`).join("");
  }

  function bindEvents() {
    byId("partnerMallSelect").addEventListener("change", (event) => {
      state.selectedMallId = event.target.value;
      renderOverview();
      history.replaceState(null, "", `partner.html?mall=${encodeURIComponent(state.selectedMallId)}`);
    });
  }

  async function init() {
    state.data = await window.AVMDataClient.loadAll();
    const urlMall = new URLSearchParams(window.location.search).get("mall");
    state.selectedMallId =
      urlMall && state.data.malls.some((mall) => mall.id === urlMall) ? urlMall : state.data.malls[0].id;
    renderMallOptions();
    renderOverview();
    renderSections();
    renderChecklist();
    bindEvents();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
