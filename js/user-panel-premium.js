(function () {
  const sync = window.AllonaProfileSync;
  const client = sync && sync.createClient ? sync.createClient() : null;
  let currentUser = null;
  let currentProfile = null;
  let profileSyncBound = false;
  let refundRequestType = "refund";
  let refundOrdersCache = [];
  let refundTicketsCache = [];
  const couponWalletKey = "allonahub_user_coupons_v1";
  const refundWindowDays = 14;
  const couponHpRewards = {
    WELCOME10: 100,
    PARTNER15: 150,
    HP20: 200
  };

  const moduleCards = {
    maritime: [
      ["fa-ship", "Maritime CV", "Denizcilik CV formunu aç", "cv"],
      ["fa-certificate", "Belgeler", "STCW ve sertifika takibi", "/pages/account/belgeler.html"],
      ["fa-briefcase", "Gemi İşleri", "Pozisyona uygun ilanlar", "/pages/ecosystem/allonadenizcilik.html"]
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

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
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

  function normalizeStatus(value) {
    return String(value || "").trim().toLocaleLowerCase("tr-TR");
  }

  function orderNumber(order) {
    return order?.order_no || order?.order_number || order?.id || "Sipariş";
  }

  function orderTotal(order) {
    return Number(order?.grand_total || order?.total_amount || order?.total || 0);
  }

  function refundSubmittedKey() {
    return `allonahub.refundCancellationRequests.${currentUser?.id || "guest"}`;
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

  function goTo(target) {
    if (!target) return;
    if (target === "cv") {
      window.location.href = sync.cvTarget(currentProfile || sync.storedProfile());
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
    if (action === "refund-cancellation") {
      openRefundCenter();
      return;
    }
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
      if (event.key === "Escape") {
        hideHpInfo();
        hideRefundCenter();
      }
    });

    document.querySelectorAll("[data-refund-center-close]").forEach((node) => {
      node.addEventListener("click", hideRefundCenter);
    });

    document.querySelectorAll("[data-refund-request-kind]").forEach((node) => {
      node.addEventListener("click", () => {
        refundRequestType = node.dataset.refundRequestKind === "cancellation" ? "cancellation" : "refund";
        document.querySelectorAll("[data-refund-request-kind]").forEach((tab) => {
          tab.classList.toggle("is-active", tab === node);
        });
        renderRefundOrders();
        setRefundStatus(`${refundKindTitle(refundRequestType)} talebi için sipariş uygunluğu kontrol edildi.`);
      });
    });

    const search = $("#panelSearchInput");
    if (search) {
      search.addEventListener("keydown", (event) => {
        if (event.key === "Enter") panelSearch();
      });
    }
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

  function refundKindTitle(kind) {
    return kind === "cancellation" ? "İptal" : "İade";
  }

  function refundKindText(kind) {
    return kind === "cancellation" ? "iptal" : "iade";
  }

  function refundOrderBaseDate(order, kind) {
    if (kind === "refund") {
      return order?.delivered_at || order?.completed_at || order?.fulfilled_at || order?.created_at || order?.updated_at || "";
    }
    return order?.created_at || order?.updated_at || "";
  }

  function refundWindowInfo(order, kind) {
    const baseValue = refundOrderBaseDate(order, kind);
    const baseDate = baseValue ? new Date(baseValue) : null;
    if (!baseDate || Number.isNaN(baseDate.getTime())) {
      return { within: false, daysLeft: 0, deadline: null, baseDate: null };
    }
    const deadline = new Date(baseDate.getTime() + refundWindowDays * 24 * 60 * 60 * 1000);
    const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return {
      within: Date.now() <= deadline.getTime(),
      daysLeft: Math.max(0, daysLeft),
      deadline,
      baseDate
    };
  }

  function hasStatus(status, values) {
    return values.some((value) => status.includes(value));
  }

  function analyzeRefundOrder(order, kind) {
    const orderStatus = normalizeStatus(order?.order_status || order?.status || "");
    const paymentStatus = normalizeStatus(order?.payment_status || "");
    const windowInfo = refundWindowInfo(order, kind);
    const closed = hasStatus(orderStatus, ["cancelled", "canceled", "iptal", "refunded", "iade edildi", "returned"]);
    const alreadyRefunded = paymentStatus.includes("refunded") || orderStatus.includes("refunded") || orderStatus.includes("iade edildi");

    if (!windowInfo.baseDate) {
      return { eligible: false, reason: "Sipariş tarihi net olmadığı için talep açılamaz.", windowInfo };
    }
    if (!windowInfo.within) {
      return { eligible: false, reason: `${refundWindowDays} günlük talep süresi geçmiş.`, windowInfo };
    }
    if (closed || alreadyRefunded) {
      return { eligible: false, reason: "Bu sipariş kapatılmış veya daha önce işleme alınmış.", windowInfo };
    }

    if (kind === "cancellation") {
      const shippedOrDelivered = hasStatus(orderStatus, ["shipped", "kargoda", "delivered", "teslim", "completed", "tamamlandı"]);
      if (shippedOrDelivered) {
        return { eligible: false, reason: "Sipariş kargo/teslimat aşamasında olduğu için iptal yerine iade süreci değerlendirilir.", windowInfo };
      }
      return { eligible: true, reason: `${windowInfo.daysLeft} gün içinde iptal talebi oluşturulabilir.`, windowInfo };
    }

    const returnableStage = hasStatus(orderStatus, ["delivered", "teslim", "completed", "tamamlandı"]);
    if (!returnableStage) {
      return { eligible: false, reason: "Sipariş teslim/tamamlandı aşamasına geçmeden iade yerine iptal talebi değerlendirilir.", windowInfo };
    }

    const unpaid = hasStatus(paymentStatus, ["unpaid", "pending", "awaiting_payment", "failed", "başarısız", "odenmedi", "ödenmedi"]);
    if (unpaid) {
      return { eligible: false, reason: "Ödeme tamamlanmadığı için iade talebi açılamaz.", windowInfo };
    }
    return { eligible: true, reason: `${windowInfo.daysLeft} gün içinde iade talebi oluşturulabilir.`, windowInfo };
  }

  function submittedRequests() {
    return safeJson(refundSubmittedKey(), {});
  }

  function recordSubmittedRequest(kind, order, ticket) {
    const records = submittedRequests();
    records[`${kind}:${order.id}`] = {
      ticket_id: ticket?.id || "",
      status: ticket?.status || "open",
      created_at: ticket?.created_at || new Date().toISOString(),
      order_no: orderNumber(order)
    };
    try {
      localStorage.setItem(refundSubmittedKey(), JSON.stringify(records));
    } catch (error) {
      // The database ticket is the source of truth; local storage only prevents duplicate taps.
    }
  }

  function ticketMatchesKind(ticket, kind) {
    const metadata = ticket?.metadata || {};
    const metadataType = normalizeStatus(metadata.request_type || metadata.type || "");
    if (metadataType) {
      if (kind === "refund") return /refund|iade|return/.test(metadataType);
      return /cancel|iptal|cancellation/.test(metadataType);
    }
    const text = normalizeStatus(`${ticket?.title || ""} ${ticket?.message || ""}`);
    return kind === "refund" ? /iade|refund|return/.test(text) : /iptal|cancel|cancellation/.test(text);
  }

  function existingRefundRequest(order, kind) {
    const local = submittedRequests()[`${kind}:${order.id}`];
    if (local) return local;

    const id = String(order?.id || "");
    const no = String(orderNumber(order));
    return refundTicketsCache.find((ticket) => {
      if (!ticketMatchesKind(ticket, kind)) return false;
      const metadata = ticket.metadata || {};
      const body = `${ticket.title || ""} ${ticket.message || ""}`;
      return String(metadata.order_id || "") === id
        || String(metadata.order_no || "") === no
        || (no.length > 3 && body.includes(no));
    });
  }

  async function loadRefundOrders() {
    if (!client || !currentUser) return [];
    const run = (select) => client
      .from("orders")
      .select(select)
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(40);

    let { data, error } = await run("*, order_items(*)");
    if (error) {
      ({ data, error } = await run("*"));
    }
    if (error) throw error;
    return data || [];
  }

  async function loadRefundTickets() {
    if (!client || !currentUser) return [];
    const { data, error } = await client
      .from("support_tickets")
      .select("id, title, message, status, metadata, created_at")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(80);
    if (error) {
      console.warn("İade/iptal destek talepleri okunamadı:", error);
      return [];
    }
    return (data || []).filter((ticket) => ticketMatchesKind(ticket, "refund") || ticketMatchesKind(ticket, "cancellation"));
  }

  function setRefundStatus(message) {
    const node = $("#refundCenterStatus");
    if (node) node.textContent = message;
  }

  function refundOrderMarkup(order, result, submitted, isEligibleList) {
    const kindTitle = refundKindTitle(refundRequestType);
    const kindText = refundKindText(refundRequestType);
    const statusText = [order.order_status || order.status || "pending", order.payment_status || ""].filter(Boolean).join(" / ");
    const items = Array.isArray(order.order_items) ? order.order_items.length : 0;
    const state = submitted ? "Talep alındı" : (result.eligible ? `${kindTitle} edilebilir` : `${kindTitle} edilemez`);
    const rowClass = result.eligible && !submitted && isEligibleList ? "refund-order-row" : "refund-order-row is-disabled";
    const action = result.eligible && isEligibleList
      ? `
        <div class="refund-order-actions">
          ${submitted ? "" : `
            <label class="refund-check">
              <input type="checkbox" data-refund-order-check>
              ${kindTitle} edilebilir
            </label>
          `}
          <button class="refund-submit" type="button" data-refund-order-submit ${submitted ? "disabled" : "disabled"}>
            ${submitted ? "Talep alındı" : `${kindTitle} talebi oluştur`}
          </button>
        </div>
      `
      : "";
    return `
      <article class="${rowClass}" data-refund-order-id="${escapeHTML(order.id || "")}">
        <div class="refund-order-main">
          <strong>${escapeHTML(orderNumber(order))}</strong>
          <span>${formatDate(order.created_at)}${items ? ` / ${items} ürün` : ""}</span>
        </div>
        <div class="refund-order-meta">
          <b>${formatMoney(orderTotal(order))}</b>
          <span>${escapeHTML(statusText || "Durum hazırlanıyor")}</span>
        </div>
        <div class="refund-order-state">
          <b>${escapeHTML(state)}</b>
          <span>${escapeHTML(submitted ? "Açık talebiniz ekip tarafından inceleniyor." : result.reason)}</span>
          ${result.windowInfo?.deadline ? `<span>${escapeHTML(kindText)} son tarihi: ${formatDate(result.windowInfo.deadline)}</span>` : ""}
        </div>
        ${action}
      </article>
    `;
  }

  function renderRefundOrders() {
    const eligibleTarget = $("#refundEligibleOrders");
    const expiredTarget = $("#refundExpiredOrders");
    if (!eligibleTarget || !expiredTarget) return;

    const rows = refundOrdersCache.map((order) => {
      const result = analyzeRefundOrder(order, refundRequestType);
      const submitted = existingRefundRequest(order, refundRequestType);
      return { order, result, submitted };
    });
    const eligible = rows.filter((row) => row.result.eligible || row.submitted);
    const expired = rows.filter((row) => !row.result.eligible && !row.submitted);

    setText("#refundEligibleCount", `${eligible.length} sipariş`);
    setText("#refundExpiredCount", `${expired.length} sipariş`);
    eligibleTarget.innerHTML = eligible.length
      ? eligible.map((row) => refundOrderMarkup(row.order, row.result, row.submitted, true)).join("")
      : `<div class="refund-empty">Bu talep türü için şu anda uygun sipariş bulunmuyor.</div>`;
    expiredTarget.innerHTML = expired.length
      ? expired.map((row) => refundOrderMarkup(row.order, row.result, row.submitted, false)).join("")
      : `<div class="refund-empty">Geçmiş sipariş kaydı bulunmuyor.</div>`;

    eligibleTarget.querySelectorAll(".refund-order-row").forEach((row) => {
      const check = row.querySelector("[data-refund-order-check]");
      const button = row.querySelector("[data-refund-order-submit]");
      if (!check || !button) return;
      check.addEventListener("change", () => {
        button.disabled = !check.checked;
      });
      button.addEventListener("click", () => submitRefundRequest(row.dataset.refundOrderId, row, button));
    });
  }

  async function submitRefundRequest(orderId, row, button) {
    const order = refundOrdersCache.find((item) => String(item.id) === String(orderId));
    const check = row?.querySelector("[data-refund-order-check]");
    if (!order || !check?.checked) {
      setRefundStatus("Talep oluşturmadan önce uygunluk kutucuğunu işaretlemelisin.");
      return;
    }

    const result = analyzeRefundOrder(order, refundRequestType);
    if (!result.eligible || existingRefundRequest(order, refundRequestType)) {
      renderRefundOrders();
      setRefundStatus("Bu sipariş için yeni talep oluşturulamadı.");
      return;
    }

    const kindTitle = refundKindTitle(refundRequestType);
    const kindText = refundKindText(refundRequestType);
    const title = `${kindTitle} Talebi - ${orderNumber(order)}`.slice(0, 176);
    const message = [
      `Kullanıcı panelinden ${kindText} talebi oluşturuldu.`,
      `Sipariş: ${orderNumber(order)}`,
      `Tutar: ${formatMoney(orderTotal(order))}`,
      `Sipariş durumu: ${order.order_status || order.status || "pending"}`,
      `Ödeme durumu: ${order.payment_status || "belirtilmemiş"}`,
      `Kural durumu: ${result.reason}`
    ].join("\n");
    const payload = {
      user_id: currentUser.id,
      requester_type: "user",
      category: "refund_cancellation",
      priority: "normal",
      title,
      message,
      status: "open",
      metadata: {
        source: "user_panel",
        request_type: refundRequestType,
        order_id: order.id,
        order_no: orderNumber(order),
        order_status: order.order_status || order.status || "",
        payment_status: order.payment_status || "",
        total: orderTotal(order),
        rule_window_days: refundWindowDays,
        eligible_until: result.windowInfo?.deadline ? result.windowInfo.deadline.toISOString() : null,
        created_from_panel_at: new Date().toISOString()
      }
    };

    button.disabled = true;
    button.textContent = "Gönderiliyor";
    setRefundStatus(`${kindTitle} talebin güvenli şekilde oluşturuluyor.`);
    try {
      const { data, error } = await client
        .from("support_tickets")
        .insert(payload)
        .select("id, status, created_at")
        .single();
      if (error) throw error;
      const ticket = {
        ...data,
        title: payload.title,
        message: payload.message,
        metadata: payload.metadata,
        status: data?.status || "open"
      };
      refundTicketsCache.unshift(ticket);
      recordSubmittedRequest(refundRequestType, order, ticket);
      renderRefundOrders();
      setRefundStatus(`${kindTitle} talebin alındı. Ekip incelemesi başladığında panelden takip edilebilir.`);
      showStatus(`${kindTitle} talebi oluşturuldu.`);
    } catch (error) {
      console.error("İade/iptal talebi oluşturulamadı:", error);
      button.textContent = `${kindTitle} talebi oluştur`;
      button.disabled = !check.checked;
      setRefundStatus("Talep oluşturulamadı. Lütfen daha sonra tekrar dene veya destek ekibine ulaş.");
    }
  }

  async function openRefundCenter() {
    const modal = $("#refundCenterModal");
    if (!modal) return;
    modal.hidden = false;
    setRefundStatus("Son siparişlerin hazırlanıyor.");
    setText("#refundEligibleCount", "0 sipariş");
    setText("#refundExpiredCount", "0 sipariş");
    const eligibleTarget = $("#refundEligibleOrders");
    const expiredTarget = $("#refundExpiredOrders");
    if (eligibleTarget) eligibleTarget.innerHTML = `<div class="refund-empty">Siparişler yükleniyor.</div>`;
    if (expiredTarget) expiredTarget.innerHTML = "";

    try {
      const [orders, tickets] = await Promise.all([loadRefundOrders(), loadRefundTickets()]);
      refundOrdersCache = (orders || []).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      refundTicketsCache = tickets || [];
      renderRefundOrders();
      setRefundStatus(refundOrdersCache.length
        ? `${refundOrdersCache.length} sipariş ${refundWindowDays} günlük kural ve sipariş durumuna göre kontrol edildi.`
        : "Henüz sipariş kaydın bulunmuyor.");
    } catch (error) {
      console.error("İade/iptal merkezi yüklenemedi:", error);
      refundOrdersCache = [];
      refundTicketsCache = [];
      renderRefundOrders();
      setRefundStatus("Siparişler şu anda yüklenemedi. Lütfen tekrar dene.");
    }
  }

  function hideRefundCenter() {
    const modal = $("#refundCenterModal");
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
    const list = moduleCards[profile.module] || moduleCards.general;
    const box = $("#moduleGrid");
    if (!box) return;
    box.innerHTML = list.map(([icon, title, text, target]) => `
      <button class="account-menu-row" type="button" data-go="${target}">
        <span><i class="fa-solid ${icon}"></i> ${title}</span>
        <small>${text}</small>
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
      <article class="account-transaction">
        <span><i class="fa-solid ${icon}"></i> <b>${title}</b></span>
        <small>${text}</small>
        <strong>${amount}</strong>
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
    setText("#cashoutValue", formatNumber(profile.cashout_balance || 0));
    setText("#hubCashValue", formatNumber(profile.hub_cash || profile.wallet_balance || 0));
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
    if (!client || !sync) {
      showStatus("Supabase bağlantısı hazırlanamadı.");
      return;
    }

    try {
      const loaded = await sync.load(client);
      if (!loaded || !loaded.user) {
        window.location.href = "/pages/account/user.html";
        return;
      }
      currentUser = loaded.user;
      const profile = await reconcileCouponHp(loaded.profile);
      renderPanel(profile);
      bindProfileSyncEvents();
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
    if (/iade|iptal|sipariş|siparis|refund|cancel/.test(q)) return openRefundCenter();
    if (/hp|kupon|puan|cash|bakiye/.test(q)) return goTo("/pages/commerce/kuponlar.html");
    if (/profil|hesap|foto/.test(q)) return goTo("/pages/account/profil.html");
    if (/belge|sertifika/.test(q)) return goTo("/pages/account/belgeler.html");
    if (/premium|seviye|level/.test(q)) return goTo("/pages/account/premium.html");
    window.location.href = `/pages/search/arama.html?q=${encodeURIComponent(q)}`;
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
    window.location.href = "/pages/account/user.html";
  };

  document.addEventListener("DOMContentLoaded", initPanel);
})();
