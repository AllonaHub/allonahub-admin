(function () {
  const sync = window.AllonaProfileSync;
  const client = sync && sync.createClient ? sync.createClient() : null;
  let currentUser = null;
  let currentProfile = null;

  const moduleCards = {
    maritime: [
      ["fa-ship", "Maritime CV", "Denizcilik CV formunu aç", "cv"],
      ["fa-certificate", "Belgeler", "STCW ve sertifika takibi", "belgeler.html"],
      ["fa-briefcase", "Gemi İşleri", "Pozisyona uygun ilanlar", "allonadenizcilik.html"]
    ],
    health: [
      ["fa-user-doctor", "Sağlık Profili", "Uzmanlık ve hizmet bilgileri", "allonasaglik.html"],
      ["fa-calendar-check", "Randevular", "Hasta ve randevu alanı", "allonasaglik.html"],
      ["fa-file-waveform", "Akıllı CV", "Sağlık kariyer CV'si", "cv"]
    ],
    agriculture: [
      ["fa-seedling", "Tarım Profili", "Üretici ve bölge bilgileri", "allonatarim.html"],
      ["fa-tractor", "Ekipman", "Makine ve hizmet talepleri", "allonatarim.html"],
      ["fa-file-lines", "Akıllı CV", "Tarım kariyer CV'si", "cv"]
    ],
    legal: [
      ["fa-scale-balanced", "Hukuk Profili", "Danismanlik ve dosyalar", "allonahukuk.html"],
      ["fa-file-signature", "Belgeler", "Sozlesme ve evrak takibi", "belgeler.html"],
      ["fa-file-lines", "Akilli CV", "Hukuk kariyer CV'si", "cv"]
    ],
    education: [
      ["fa-graduation-cap", "Egitim Profili", "Kurs ve sertifika bilgileri", "allonaegitim.html"],
      ["fa-book-open", "Kurslar", "Egitim icerikleri", "allonaegitim.html"],
      ["fa-file-lines", "Akilli CV", "Egitim kariyer CV'si", "cv"]
    ],
    technology: [
      ["fa-code", "Teknoloji Profili", "Proje ve portföy alanı", "teknoloji.html"],
      ["fa-shield-halved", "AI & Güvenlik", "Dijital yetenekler", "teknoloji.html"],
      ["fa-file-lines", "Akıllı CV", "Teknoloji kariyer CV'si", "cv"]
    ],
    business: [
      ["fa-chart-line", "İş Profili", "Satış ve finans alanı", "allonakariyer.html"],
      ["fa-handshake", "Partnerlik", "AllonaHub partner fırsatları", "partner.html"],
      ["fa-file-lines", "Akıllı CV", "Kariyer CV'si oluştur", "cv"]
    ],
    food: [
      ["fa-utensils", "Restoran Profili", "Gıda ve restoran alanı", "allonayemek.html"],
      ["fa-store", "Market Bağlantısı", "Ürün ve kampanya yönetimi", "allonamarket.html"],
      ["fa-file-lines", "Akıllı CV", "Gıda sektörü CV'si", "cv"]
    ],
    transport: [
      ["fa-truck-fast", "Lojistik Profili", "Kurye ve tasima alani", "allonalojistik.html"],
      ["fa-taxi", "Taksi Bağlantısı", "Sürücü ve rota fırsatları", "allonataksi.html"],
      ["fa-file-lines", "Akıllı CV", "Ulaşım sektörü CV'si", "cv"]
    ],
    general: [
      ["fa-user", "Profil", "Dijital kimliğini tamamla", "profil.html"],
      ["fa-ticket", "Kuponlar", "HP ve kupon avantajları", "kuponlar.html"],
      ["fa-file-lines", "Akıllı CV", "Mesleğine uygun CV oluştur", "cv"]
    ]
  };

  function $(selector) {
    return document.querySelector(selector);
  }

  function setText(selector, value) {
    const node = $(selector);
    if (node) node.textContent = value;
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("tr-TR");
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 2
    });
  }

  function showStatus(message) {
    const node = $("#panelStatus");
    if (!node) return;
    node.textContent = message;
    node.classList.add("is-visible");
    window.clearTimeout(showStatus.timer);
    showStatus.timer = window.setTimeout(() => node.classList.remove("is-visible"), 2600);
  }

  function profileFirstName(profile) {
    return String(profile.full_name || "Üye").trim().split(/\s+/)[0] || "Üye";
  }

  function goTo(target) {
    if (!target) return;
    if (target === "cv") {
      window.location.href = sync.cvTarget(currentProfile || sync.storedProfile());
      return;
    }
    window.location.href = target;
  }

  function bindNavigation() {
    document.querySelectorAll("[data-go]").forEach((node) => {
      node.addEventListener("click", () => goTo(node.dataset.go));
    });

    const search = $("#panelSearchInput");
    if (search) {
      search.addEventListener("keydown", (event) => {
        if (event.key === "Enter") panelSearch();
      });
    }
  }

  function renderAvatar(profile) {
    const initials = sync.initials(profile.full_name);
    const avatar = sync.safeAvatarUrl ? sync.safeAvatarUrl(profile.avatar_url || profile.avatar || "") : (profile.avatar_url || profile.avatar || "");
    const nodes = ["#profileAvatar", "#miniAvatar"];
    nodes.forEach((selector) => {
      const node = $(selector);
      if (!node) return;
      node.textContent = avatar ? "" : initials;
      node.style.backgroundImage = avatar ? `url("${avatar}")` : "";
      node.setAttribute("aria-label", `${profile.full_name} profil fotoğrafı`);
    });
  }

  function renderModules(profile) {
    const list = moduleCards[profile.module] || moduleCards.general;
    const box = $("#moduleGrid");
    if (!box) return;
    box.innerHTML = list.map(([icon, title, text, target]) => `
      <button class="action-tile premium-glass" type="button" data-go="${target}">
        <span class="action-icon"><i class="fa-solid ${icon}"></i></span>
        <b>${title}</b>
        <span class="sr-only">${text}</span>
      </button>
    `).join("");
    box.querySelectorAll("[data-go]").forEach((node) => {
      node.addEventListener("click", () => goTo(node.dataset.go));
    });
  }

  function renderTransactions(profile) {
    const hpMultiplier = Math.max(20, Math.round((profile.level || 1) * 8));
    const items = [
      ["fa-gift", "Günlük Giriş", "Bugün giriş yapıldı", `+${hpMultiplier} HP`],
      ["fa-store", profile.module === "maritime" ? "Maritime Profil" : "AllonaHub", "Profil eşleşmesi güncellendi", "+30 HP"],
      ["fa-bullseye", "Görev Tamamlandı", "Profil merkezi kontrol edildi", "+20 HP"]
    ];
    const box = $("#transactionList");
    if (!box) return;
    box.innerHTML = items.map(([icon, title, text, amount]) => `
      <article class="transaction premium-glass">
        <span class="transaction-icon"><i class="fa-solid ${icon}"></i></span>
        <span><b>${title}</b><span>${text}</span></span>
        <span><strong>${amount}</strong><small>TAMAMLANDI</small></span>
        <span class="metric-arrow"><i class="fa-solid fa-chevron-right"></i></span>
      </article>
    `).join("");
  }

  function renderPanel(profile) {
    const levelInfo = sync.levelFromXp(profile.xp);
    currentProfile = { ...profile, level: levelInfo.current.level, level_name: levelInfo.current.name };
    document.body.dataset.levelTheme = levelInfo.current.key;
    document.documentElement.style.setProperty("--panel-accent", levelInfo.current.accent);

    setText("#firstName", profileFirstName(profile));
    setText("#fullName", profile.full_name || "AllonaHub Üyesi");
    setText("#memberNo", profile.member_no || sync.makeUserId(currentUser));
    setText("#tierName", levelInfo.current.name);
    setText("#levelName", levelInfo.current.name);
    setText("#levelNumber", `Lv.${levelInfo.current.level}`);
    setText("#xpBadge", `Lv.${levelInfo.current.level}`);
    setText("#streakValue", `${formatNumber(profile.streak || 0)} Günlük Streak`);
    setText("#hpValue", formatNumber(profile.hp || 0));
    setText("#cashoutValue", formatMoney(profile.cashout_balance || 0));
    setText("#hubCashValue", formatMoney(profile.hub_cash || profile.wallet_balance || 0));
    setText("#nextLevelLabel", levelInfo.next ? `Lv.${levelInfo.next.level} ${levelInfo.next.name}` : "Legend Member");
    setText("#xpTotal", `${formatNumber(levelInfo.xp)} / ${formatNumber(levelInfo.nextMin)} XP`);
    setText("#xpPercent", `${levelInfo.progress}%`);
    setText("#remainingXp", levelInfo.remaining > 0 ? `${formatNumber(levelInfo.remaining)} XP sonra yeni seviye` : "Zirve seviyedesin");
    setText("#professionLine", `${profile.sector_name || "Genel"} / ${profile.profession_name || "AllonaHub Üyesi"}`);
    setText("#cvActionText", sync.isMaritimeProfile(profile) ? "Denizcilik CV Oluştur" : "Akıllı CV Oluştur");
    setText("#levelBonus", levelInfo.current.bonus);
    setText("#moduleHint", `${profile.profession_title || "Üye"} profiline göre alanlar hazırlandı.`);

    const bar = $("#xpProgressBar");
    if (bar) bar.style.width = `${levelInfo.progress}%`;

    const cvButton = $("#cvAction");
    if (cvButton) cvButton.dataset.go = "cv";

    renderAvatar(profile);
    renderModules(profile);
    renderTransactions(profile);
  }

  async function initPanel() {
    if (!client || !sync) {
      showStatus("Supabase bağlantısı hazırlanamadı.");
      return;
    }

    try {
      const loaded = await sync.load(client);
      if (!loaded || !loaded.user) {
        window.location.href = "user.html";
        return;
      }
      currentUser = loaded.user;
      renderPanel(loaded.profile);
      bindNavigation();
    } catch (error) {
      console.error("Kullanıcı paneli yüklenemedi:", error);
      showStatus("Panel bilgileri güvenli şekilde yüklenemedi. Lütfen tekrar giriş yap.");
    }
  }

  window.panelSearch = function panelSearch() {
    const input = $("#panelSearchInput");
    const q = (input?.value || "").toLocaleLowerCase("tr-TR").trim();
    if (!q) return;
    if (/cv|özgeçmiş|kariyer/.test(q)) return goTo("cv");
    if (/hp|kupon|puan|cash|bakiye/.test(q)) return goTo("kuponlar.html");
    if (/profil|hesap|foto/.test(q)) return goTo("profil.html");
    if (/belge|sertifika/.test(q)) return goTo("belgeler.html");
    if (/premium|seviye|level/.test(q)) return goTo("premium.html");
    window.location.href = `arama.html?q=${encodeURIComponent(q)}`;
  };

  window.copyUserId = async function copyUserId() {
    const value = $("#memberNo")?.textContent || sync.makeUserId(currentUser);
    try {
      await navigator.clipboard.writeText(value);
      showStatus("AllonaHub ID kopyalandı.");
    } catch (error) {
      showStatus(value);
    }
  };

  window.logoutUser = async function logoutUser() {
    if (client) await client.auth.signOut();
    localStorage.removeItem(sync.STORAGE_KEY);
    window.location.href = "user.html";
  };

  document.addEventListener("DOMContentLoaded", initPanel);
})();
