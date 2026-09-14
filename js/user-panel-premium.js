(function () {
  const sync = window.AllonaProfileSync;
  const client = sync && sync.createClient ? sync.createClient() : null;
  let currentUser = null;
  let currentProfile = null;
  let maritimeActivity = [];
  let maritimeActivityLoaded = false;
  let profileSyncBound = false;
  const couponWalletKey = "allonahub_user_coupons_v1";
  const couponHpRewards = {
    WELCOME10: 100,
    PARTNER15: 150,
    HP20: 200
  };

  const moduleCards = {
    maritime: [
      ["fa-briefcase", "İş İlanları", "Açık denizcilik pozisyonlarını incele", "/pages/ecosystem/maritime-jobs.html"],
      ["fa-list-check", "Başvurularım", "Başvuru durumlarını takip et", "/pages/ecosystem/maritime-applications.html"],
      ["fa-envelope-open-text", "İş Tekliflerim", "Firmalardan gelen teklifleri görüntüle", "/pages/ecosystem/maritime-offers.html"],
      ["fa-wand-magic-sparkles", "Otomatik Başvuru", "Akıllı başvuru tercihini yönet", "/pages/ecosystem/maritime-auto-apply.html"],
      ["fa-shield-halved", "Şikayet", "İhbar, ITF, hukuk ve öneri merkezi", "/pages/ecosystem/maritime-complaints.html"],
      ["fa-ship", "Maritime CV", "Denizcilik CV formunu aç", "/pages/career/cv-form.html?source=maritime&position=Maritime+Crew"],
      ["fa-certificate", "Belgeler", "STCW ve sertifika takibi", "/pages/account/belgeler.html"],
      ["fa-anchor", "Denizcilik Modülü", "Denizcilik ana ekranına dön", "/pages/ecosystem/allonadenizcilik.html"]
    ],
    health: [
      ["fa-user-doctor", "Sağlık Profili", "Uzmanlık ve hizmet bilgileri", "/pages/ecosystem/allonasaglik.html"],
      ["fa-calendar-check", "Randevular", "Hasta ve randevu alanı", "/pages/ecosystem/allonasaglik.html"],
      ["fa-file-waveform", "Akıllı CV", "Sağlık kariyer CV'si", "cv"]
    ],
    agriculture: [
      ["fa-seedling", "Tarım Profili", "Üretici ve bölge bilgileri", "/pages/ecosystem/allonatarim.html"],
      ["fa-tractor", "Ekipman", "Makine ve hizmet talepleri", "/pages/ecosystem/allonatarim.html"],
      ["fa-file-lines", "Akıllı CV", "Tarım kariyer CV'si", "cv"]
    ],
    legal: [
      ["fa-scale-balanced", "Hukuk Profili", "Danismanlik ve dosyalar", "/pages/ecosystem/allonahukuk.html"],
      ["fa-file-signature", "Belgeler", "Sozlesme ve evrak takibi", "/pages/account/belgeler.html"],
      ["fa-file-lines", "Akilli CV", "Hukuk kariyer CV'si", "cv"]
    ],
    education: [
      ["fa-graduation-cap", "Egitim Profili", "Kurs ve sertifika bilgileri", "/pages/ecosystem/allonaegitim.html"],
      ["fa-book-open", "Kurslar", "Egitim icerikleri", "/pages/ecosystem/allonaegitim.html"],
      ["fa-file-lines", "Akilli CV", "Egitim kariyer CV'si", "cv"]
    ],
    technology: [
      ["fa-code", "Teknoloji Profili", "Proje ve portföy alanı", "/pages/ecosystem/teknoloji.html"],
      ["fa-shield-halved", "AI & Güvenlik", "Dijital yetenekler", "/pages/ecosystem/teknoloji.html"],
      ["fa-file-lines", "Akıllı CV", "Teknoloji kariyer CV'si", "cv"]
    ],
    business: [
      ["fa-chart-line", "İş Profili", "Satış ve finans alanı", "/pages/career/allonakariyer.html"],
      ["fa-handshake", "Partnerlik", "AllonaHub partner fırsatları", "/pages/partner/partner.html"],
      ["fa-file-lines", "Akıllı CV", "Kariyer CV'si oluştur", "cv"]
    ],
    food: [
      ["fa-utensils", "Restoran Profili", "Gıda ve restoran alanı", "/pages/commerce/allonayemek.html"],
      ["fa-store", "Market Bağlantısı", "Ürün ve kampanya yönetimi", "/pages/commerce/allonamarket.html"],
      ["fa-file-lines", "Akıllı CV", "Gıda sektörü CV'si", "cv"]
    ],
    transport: [
      ["fa-truck-fast", "Lojistik Profili", "Kurye ve tasima alani", "/pages/ecosystem/allonalojistik.html"],
      ["fa-taxi", "Taksi Bağlantısı", "Sürücü ve rota fırsatları", "/pages/ecosystem/allonataksi.html"],
      ["fa-file-lines", "Akıllı CV", "Ulaşım sektörü CV'si", "cv"]
    ],
    general: [
      ["fa-user", "Profil", "Dijital kimliğini tamamla", "/pages/account/profil.html"],
      ["fa-ticket", "Kuponlar", "HP ve kupon avantajları", "/pages/commerce/kuponlar.html"],
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

  function formatHp(value) {
    return `${formatNumber(value)} HP`;
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (error) {
      return fallback;
    }
  }

  function userKey(user) {
    return user && user.id ? `user:${user.id}` : "guest";
  }

  function couponBaseCode(code) {
    return String(code || "").toUpperCase().replace(/-HP$/, "").replace(/-\d+$/, "");
  }

  function getLocalCoupons(user) {
    const wallet = safeJson(couponWalletKey, {});
    const list = wallet[userKey(user)];
    return Array.isArray(list) ? list : [];
  }

  function couponHpReward(coupon) {
    const base = couponBaseCode(coupon?.code);
    return Math.max(0, Number(coupon?.hp_reward || couponHpRewards[base] || 0));
  }

  function couponAwardId(coupon) {
    return `coupon:${couponBaseCode(coupon?.code)}`;
  }

  function bucketLabel(bucket) {
    if (bucket === "daily") return "Günlük Görev HP";
    if (bucket === "shopping") return "Alışveriş HP";
    if (bucket === "conversion") return "Kupon Dönüşümü";
    return "Diğer HP";
  }

  function hpBuckets(profile) {
    const total = Math.max(0, Number(profile?.hp || 0));
    const daily = Math.max(0, Number(profile?.cashout_balance || 0));
    const shopping = Math.max(0, Number(profile?.hub_cash || profile?.wallet_balance || 0));
    const other = Math.max(0, total - daily - shopping);
    return { total, daily, shopping, other };
  }

  function showStatus(message) {
    const node = $("#panelStatus");
    if (!node) return;
    node.textContent = message;
    node.classList.add("is-visible");
    window.clearTimeout(showStatus.timer);
    showStatus.timer = window.setTimeout(() => node.classList.remove("is-visible"), 2600);
  }

  function localDateKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function dailyRewardKey() {
    return `allonahub.daily-login.${currentUser?.id || "guest"}.${localDateKey()}`;
  }

  function dailyRewardValues() {
    const level = Math.max(1, Number(currentProfile?.level || 1));
    return {
      hp: Math.max(20, Math.round(level * 8)),
      xp: Math.max(20, Math.round(level * 10)),
      streak: 1
    };
  }

  function profileFirstName(profile) {
    return String(profile.full_name || "Üye").trim().split(/\s+/)[0] || "Üye";
  }

  function isMaritimeContext(profile) {
    const requestedModule = String(new URLSearchParams(window.location.search).get("module") || "").trim().toLowerCase();
    return profile?.module === "maritime" || ["maritime", "allonadenizcilik"].includes(requestedModule);
  }

  function setNotificationCount(value) {
    const badge = $("[data-user-notification-count]");
    if (!badge) return;
    const total = Math.max(0, Number(value || 0));
    badge.textContent = total > 99 ? "99+" : String(total);
    badge.hidden = total === 0;
    badge.setAttribute("aria-label", `${total} yeni denizcilik iş teklifi`);
  }

  function goTo(target) {
    if (!target) return;
    if (target === "cv") {
      window.location.href = sync?.cvTarget
        ? sync.cvTarget(currentProfile || sync.storedProfile())
        : "/pages/career/cv-form.html";
      return;
    }
    window.location.href = target;
  }

  async function claimDailyLoginReward() {
    if (!client || !sync || !sync.updateEconomy || !currentUser) {
      goTo("/pages/account/gorevler.html");
      return;
    }

    const key = dailyRewardKey();
    const today = localDateKey();
    if (localStorage.getItem(key) || currentProfile?.last_daily_login_date === today) {
      showStatus("Bugünkü günlük giriş ödülün zaten işlendi.");
      return;
    }

    const reward = dailyRewardValues();
    try {
      const updated = await sync.updateEconomy(client, {
        ...reward,
        cashout_balance: reward.hp,
        last_daily_login_date: today,
        last_daily_login_at: new Date().toISOString()
      });
      currentProfile = updated;
      renderPanel(updated);
      localStorage.setItem(key, JSON.stringify({ ...reward, claimed_at: new Date().toISOString() }));
      if (sync.recordHpLedger) {
        sync.recordHpLedger(currentUser, {
          id: `daily-login:${today}`,
          bucket: "daily",
          title: "Günlük giriş ödülü",
          source: "Günlük görev",
          amount: reward.hp,
          note: "Günlük görev HP'si tek başına kupona çevrilemez; alışveriş HP'siyle birlikte kullanılabilir."
        });
      }
      showStatus(`+${reward.hp} HP ve +${reward.xp} XP hesabına işlendi.`);
    } catch (error) {
      console.error("Günlük giriş ödülü işlenemedi:", error);
      showStatus("Günlük giriş ödülü güvenli şekilde işlenemedi.");
    }
  }

  function handlePanelAction(action) {
    if (action === "daily-login") {
      claimDailyLoginReward();
      return;
    }
    goTo(action);
  }

  function bindNavigation() {
    document.querySelectorAll("[data-go], [data-panel-action]").forEach((node) => {
      node.addEventListener("click", () => {
        if (node.dataset.panelAction) {
          handlePanelAction(node.dataset.panelAction);
          return;
        }
        goTo(node.dataset.go);
      });
    });

    document.querySelectorAll("[data-hp-breakdown]").forEach((node) => {
      node.addEventListener("click", (event) => {
        event.preventDefault();
        showHpInfo(node.dataset.hpBreakdown || "total");
      });
    });

    document.querySelectorAll("[data-hp-info-close]").forEach((node) => {
      node.addEventListener("click", hideHpInfo);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideHpInfo();
    });

    const searchForm = $("[data-panel-search-form]");
    if (searchForm) {
      searchForm.addEventListener("submit", (event) => {
        event.preventDefault();
        panelSearch();
      });
    }

    const copyButton = $("[data-copy-user-id]");
    if (copyButton) copyButton.addEventListener("click", copyUserId);
  }

  async function reconcileCouponHp(profile) {
    if (!client || !sync || !sync.updateEconomy || !sync.recordHpLedger || !currentUser) return profile;
    const seenAwardIds = new Set();
    const pendingCoupons = getLocalCoupons(currentUser).filter((coupon) => {
      const amount = couponHpReward(coupon);
      const id = couponAwardId(coupon);
      if (seenAwardIds.has(id)) return false;
      seenAwardIds.add(id);
      return amount > 0 && (!sync.hasHpLedgerEntry || !sync.hasHpLedgerEntry(currentUser, id));
    });
    if (!pendingCoupons.length) return profile;

    const totalHp = pendingCoupons.reduce((sum, coupon) => sum + couponHpReward(coupon), 0);
    try {
      const updated = await sync.updateEconomy(client, {
        hp: totalHp,
        hub_cash: totalHp
      });
      pendingCoupons.forEach((coupon) => {
        sync.recordHpLedger(currentUser, {
          id: couponAwardId(coupon),
          bucket: "shopping",
          title: coupon.title || coupon.code || "Tanımlı kupon",
          source: "Tanımlı kupon",
          amount: couponHpReward(coupon),
          note: "Kupon avantajı alışverişten kazanılan HP olarak işlendi."
        });
      });
      showStatus(`${formatHp(totalHp)} tanımlı kuponlardan alışveriş HP'ne eklendi.`);
      return updated;
    } catch (error) {
      console.warn("Tanımlı kupon HP uzlaştırması tamamlanamadı:", error);
      return profile;
    }
  }

  function ledgerRows(type, profile) {
    const buckets = hpBuckets(profile);
    const ledger = sync && sync.getHpLedger ? sync.getHpLedger(currentUser) : [];
    const allowed = type === "total" ? ["daily", "shopping", "other"] : [type];
    const rows = ledger
      .filter((entry) => entry && allowed.includes(entry.bucket || "other") && Number(entry.amount || 0) > 0)
      .map((entry) => ({
        source: entry.source || "AllonaHub",
        type: bucketLabel(entry.bucket),
        detail: `${entry.title || "HP hareketi"}${entry.note ? ` - ${entry.note}` : ""}`,
        amount: Number(entry.amount || 0)
      }));

    const ledgerTotals = rows.reduce((acc, row) => {
      const key = row.type;
      acc[key] = (acc[key] || 0) + row.amount;
      return acc;
    }, {});

    const addBalanceRow = (bucket, amount, title, note) => {
      if (!amount) return;
      const label = bucketLabel(bucket);
      const known = ledgerTotals[label] || 0;
      const remainder = Math.round((amount - known) * 100) / 100;
      if (!remainder) return;
      rows.push({
        source: title,
        type: label,
        detail: note,
        amount: remainder
      });
    };

    if (type === "total" || type === "daily") {
      addBalanceRow("daily", buckets.daily, "Günlük görev bakiyesi", "Günlük giriş ve görevlerden kalan kayıtlı HP.");
    }
    if (type === "total" || type === "shopping") {
      addBalanceRow("shopping", buckets.shopping, "Alışveriş HP bakiyesi", "Normal alışveriş ve kupon avantajlarından kalan kayıtlı HP.");
    }
    if (type === "total") {
      addBalanceRow("other", buckets.other, "Başlangıç ve profil HP", "Profil başlangıcı, seviye veya önceki HP kayıtları.");
    }

    return rows;
  }

  function hpInfoCopy(type) {
    if (type === "daily") {
      return {
        title: "Günlük Görev HP",
        text: "Günlük giriş ve görevlerden gelen HP burada izlenir. Bu HP tek başına kupona çevrilmez; alışveriş HP'siyle birlikte kullanılabilir."
      };
    }
    if (type === "shopping") {
      return {
        title: "Alışverişten Kazanılan HP",
        text: "Normal alışverişlerden ve tanımlı kupon avantajlarından gelen HP bu alanda görünür. Puan dükkanındaki kupon dönüşümünde öncelikli olarak bu HP kullanılır."
      };
    }
    return {
      title: "Toplam HP",
      text: "Toplam HP; günlük görev HP'si, alışverişten kazanılan HP ve varsa önceki profil HP kayıtlarının birleşimidir."
    };
  }

  function showHpInfo(type) {
    const modal = $("#hpInfoModal");
    const rowsTarget = $("#hpInfoRows");
    const totalTarget = $("#hpInfoTotal");
    if (!modal || !rowsTarget || !currentProfile) return;

    const copy = hpInfoCopy(type);
    const rows = ledgerRows(type, currentProfile);
    const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

    setText("#hpInfoTitle", copy.title);
    setText("#hpInfoText", copy.text);
    rowsTarget.innerHTML = rows.length ? rows.map((row) => `
      <tr>
        <td>${escapeHTML(row.source)}</td>
        <td>${escapeHTML(row.type)}</td>
        <td>${escapeHTML(row.detail)}</td>
        <td>${formatHp(row.amount)}</td>
      </tr>
    `).join("") : `
      <tr>
        <td colspan="3">Bu kategori için henüz HP kaydı yok.</td>
        <td>0 HP</td>
      </tr>
    `;
    if (totalTarget) totalTarget.textContent = formatHp(total);
    modal.hidden = false;
  }

  function hideHpInfo() {
    const modal = $("#hpInfoModal");
    if (modal) modal.hidden = true;
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
    const requestedModule = (() => {
      try {
        const value = String(new URLSearchParams(window.location.search).get("module") || "").trim().toLowerCase();
        if (value === "allonadenizcilik") return "maritime";
        return Object.prototype.hasOwnProperty.call(moduleCards, value) ? value : "";
      } catch (error) {
        return "";
      }
    })();
    const list = moduleCards[requestedModule || profile.module] || moduleCards.general;
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
    const isMaritime = isMaritimeContext(profile);
    const hpMultiplier = Math.max(20, Math.round((profile.level || 1) * 8));
    const items = isMaritime
      ? maritimeActivityLoaded
        ? maritimeActivity
        : [{ icon: "fa-spinner", title: "Denizcilik alanı hazırlanıyor", text: "Güvenli hesap bilgileri yükleniyor", amount: "...", state: "YÜKLENİYOR" }]
      : [
          { icon: "fa-gift", title: "Günlük Giriş", text: "Bugün giriş yapıldı", amount: `+${hpMultiplier} HP`, state: "TAMAMLANDI" },
          { icon: "fa-store", title: isMaritime ? "Maritime Profil" : "AllonaHub", text: "Profil eşleşmesi güncellendi", amount: "+30 HP", state: "TAMAMLANDI" },
          { icon: "fa-bullseye", title: "Görev Tamamlandı", text: "Profil merkezi kontrol edildi", amount: "+20 HP", state: "TAMAMLANDI" }
        ];
    const box = $("#transactionList");
    if (!box) return;
    box.innerHTML = items.map((item) => {
      const content = `
        <span class="transaction-icon"><i class="fa-solid ${escapeHTML(item.icon)}"></i></span>
        <span><b>${escapeHTML(item.title)}</b><span>${escapeHTML(item.text)}</span></span>
        <span><strong>${escapeHTML(item.amount)}</strong><small>${escapeHTML(item.state)}</small></span>
        <span class="metric-arrow"><i class="fa-solid fa-chevron-right"></i></span>
      `;
      return item.href
        ? `<a class="transaction premium-glass" href="${escapeHTML(item.href)}">${content}</a>`
        : `<article class="transaction premium-glass">${content}</article>`;
    }).join("");
  }

  async function loadMaritimeActivity(profile) {
    setNotificationCount(0);
    maritimeActivity = [];
    maritimeActivityLoaded = false;
    if (!isMaritimeContext(profile)) return;
    const userId = currentUser?.id || "device";
    const readList = (name) => {
      try {
        const rows = JSON.parse(localStorage.getItem(`allonahub.maritime.${name}.v1.${userId}`) || "[]");
        return Array.isArray(rows) ? rows : [];
      } catch (error) {
        return [];
      }
    };
    const applications = readList("applications");
    const offers = readList("offers");
    let autoApply = {};
    try {
      autoApply = JSON.parse(localStorage.getItem(`allonahub.maritime.autoApply.v1.${userId}`) || "{}");
    } catch (error) {}
    maritimeActivity = [
      { icon: "fa-list-check", title: "Başvurularım", text: "Denizcilik başvurularının durumunu takip et", amount: String(applications.length), state: "BAŞVURU", href: "/pages/ecosystem/maritime-applications.html" },
      { icon: "fa-envelope-open-text", title: "İş Tekliflerim", text: "Firmalardan gelen izinli teklifleri görüntüle", amount: String(offers.length), state: "TEKLİF", href: "/pages/ecosystem/maritime-offers.html" },
      { icon: "fa-wand-magic-sparkles", title: "Otomatik Başvuru", text: "Akıllı başvuru tercihini yönet", amount: autoApply.enabled === true ? "AÇIK" : "KAPALI", state: "OTOMATİK", href: "/pages/ecosystem/maritime-auto-apply.html" }
    ];
    setNotificationCount(offers.length);
    maritimeActivityLoaded = true;
    renderTransactions(profile);
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
    setText("#cashoutValue", formatNumber(profile.cashout_balance || 0));
    setText("#hubCashValue", formatNumber(profile.hub_cash || profile.wallet_balance || 0));
    setText("#nextLevelLabel", levelInfo.next ? `Lv.${levelInfo.next.level} ${levelInfo.next.name}` : "Legend Member");
    setText("#xpTotal", `${formatNumber(levelInfo.xp)} / ${formatNumber(levelInfo.nextMin)} XP`);
    setText("#xpPercent", `${levelInfo.progress}%`);
    setText("#remainingXp", levelInfo.remaining > 0 ? `${formatNumber(levelInfo.remaining)} XP sonra yeni seviye` : "Zirve seviyedesin");
    setText("#professionLine", `${profile.sector_name || "Genel"} / ${profile.profession_name || "AllonaHub Üyesi"}`);
    setText("#cvActionText", sync.isMaritimeProfile(profile) ? "Denizcilik CV Oluştur" : "Akıllı CV Oluştur");
    setText("#levelBonus", levelInfo.current.bonus);
    const requestedModule = String(new URLSearchParams(window.location.search).get("module") || "").trim().toLowerCase();
    const maritimeContext = ["maritime", "allonadenizcilik"].includes(requestedModule);
    setText("#moduleHint", maritimeContext ? "Denizcilik işlemleri için alanlar hazırlandı." : `${profile.profession_title || "Üye"} profiline göre alanlar hazırlandı.`);

    const bar = $("#xpProgressBar");
    if (bar) bar.style.width = `${levelInfo.progress}%`;

    const cvButton = $("#cvAction");
    if (cvButton) cvButton.dataset.go = "cv";

    renderAvatar(profile);
    renderModules(profile);
    renderTransactions(profile);
  }

  function isCurrentUserProfile(profile) {
    if (!profile || !currentUser) return false;
    return [profile.id, profile.user_id].filter(Boolean).includes(currentUser.id);
  }

  function applyProfileUpdate(profile) {
    if (!isCurrentUserProfile(profile)) return;
    renderPanel(profile);
    showStatus("Profil bilgilerin panele yansıtıldı.");
  }

  function bindProfileSyncEvents() {
    if (profileSyncBound || !sync) return;
    profileSyncBound = true;

    window.addEventListener(sync.PROFILE_EVENT || "allonahub:profile-updated", (event) => {
      applyProfileUpdate(event.detail);
    });

    window.addEventListener("storage", (event) => {
      if (event.key !== sync.STORAGE_KEY || !event.newValue) return;
      try {
        applyProfileUpdate(JSON.parse(event.newValue));
      } catch (error) {
        // The next page load will read the stored profile again.
      }
    });

    try {
      if ("BroadcastChannel" in window) {
        const channel = new BroadcastChannel(sync.PROFILE_CHANNEL || "allonahub-profile-sync");
        channel.onmessage = (event) => {
          if (!event.data || event.data.type !== (sync.PROFILE_EVENT || "allonahub:profile-updated")) return;
          applyProfileUpdate(event.data.profile);
        };
      }
    } catch (error) {
      // Storage events and reloads keep the panel in sync when BroadcastChannel is unavailable.
    }
  }

  async function initPanel() {
    bindNavigation();
    if (!client || !sync) {
      showStatus("Supabase bağlantısı hazırlanamadı.");
      return;
    }

    try {
      const accountAccess = window.Allona && window.Allona.auth && window.Allona.auth.requireAccountType
        ? await window.Allona.auth.requireAccountType("customer", { redirect: true })
        : null;
      if (!accountAccess) return;
      const loaded = await sync.load(client);
      if (!loaded || !loaded.user) {
        window.location.href = "/pages/account/user.html";
        return;
      }
      currentUser = loaded.user;
      const profile = await reconcileCouponHp(loaded.profile);
      renderPanel(profile);
      loadMaritimeActivity(profile);
      bindProfileSyncEvents();
    } catch (error) {
      console.error("Kullanıcı paneli yüklenemedi:", error);
      showStatus("Panel bilgileri güvenli şekilde yüklenemedi. Lütfen tekrar giriş yap.");
    }
  }

  function panelSearch() {
    const input = $("#panelSearchInput");
    const q = (input?.value || "").toLocaleLowerCase("tr-TR").trim();
    if (!q) return;
    if (/cv|özgeçmiş|kariyer/.test(q)) return goTo("cv");
    if (/hp|kupon|puan|cash|bakiye/.test(q)) return goTo("/pages/commerce/kuponlar.html");
    if (/profil|hesap|foto/.test(q)) return goTo("/pages/account/profil.html");
    if (/belge|sertifika/.test(q)) return goTo("/pages/account/belgeler.html");
    if (/maritime|denizcilik|gemi işi|iş ilanı/.test(q)) return goTo("/pages/ecosystem/maritime-jobs.html");
    if (/premium|seviye|level/.test(q)) return goTo("/pages/account/premium.html");
    window.location.href = `/pages/search/arama.html?q=${encodeURIComponent(q)}`;
  }

  async function copyUserId() {
    const value = $("#memberNo")?.textContent || sync.makeUserId(currentUser);
    try {
      await navigator.clipboard.writeText(value);
      showStatus("AllonaHub ID kopyalandı.");
    } catch (error) {
      showStatus(value);
    }
  }

  window.logoutUser = async function logoutUser() {
    if (client) await client.auth.signOut();
    localStorage.removeItem(sync.STORAGE_KEY);
    window.location.href = "/pages/account/user.html";
  };

  document.addEventListener("DOMContentLoaded", initPanel);
})();
