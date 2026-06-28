(function () {
  const sync = window.AllonaProfileSync;
  const client = sync && sync.createClient ? sync.createClient() : null;
  const walletKey = "allonahub_user_coupons_v1";
  const readKey = "allonahub_user_notification_reads_v1";

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

  function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
  }

  function normalizeStatus(value) {
    return String(value || "").trim().toLocaleLowerCase("tr-TR");
  }

  function orderNo(order) {
    return order?.order_no || order?.order_number || order?.id || "Sipariş";
  }

  function localCoupons(user) {
    const wallet = safeJson(walletKey, {});
    const list = wallet[userKey(user)];
    return Array.isArray(list) ? list : [];
  }

  function readStore(user) {
    const all = safeJson(readKey, {});
    const list = all[userKey(user)];
    return Array.isArray(list) ? list : [];
  }

  function writeReadStore(user, ids) {
    try {
      const all = safeJson(readKey, {});
      all[userKey(user)] = Array.from(new Set(ids || [])).slice(0, 200);
      localStorage.setItem(readKey, JSON.stringify(all));
    } catch (error) {
      // Read state is local convenience only.
    }
  }

  async function loadSession() {
    if (!client || !sync || !sync.load) return null;
    try {
      return await sync.load(client);
    } catch (error) {
      return null;
    }
  }

  async function optionalRows(query) {
    try {
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      return [];
    }
  }

  async function loadOrders(user) {
    if (!client || !user) return [];
    return optionalRows(
      client
        .from("orders")
        .select("id, order_no, order_number, order_status, status, payment_status, total, grand_total, created_at, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10)
    );
  }

  async function loadTickets(user) {
    if (!client || !user) return [];
    return optionalRows(
      client
        .from("support_tickets")
        .select("id, title, message, status, category, priority, metadata, created_at, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12)
    );
  }

  async function loadRemoteCoupons(user) {
    if (!client || !user) return [];
    return optionalRows(
      client
        .from("user_coupons")
        .select("id, code, title, status, source, assigned_at, used_at")
        .eq("user_id", user.id)
        .order("assigned_at", { ascending: false })
        .limit(12)
    );
  }

  function notification(id, type, title, message, createdAt, href, tone) {
    return {
      id,
      type,
      title,
      message,
      created_at: createdAt || new Date().toISOString(),
      href: href || "/pages/account/user-panel.html",
      tone: tone || "info"
    };
  }

  function orderNotifications(orders) {
    return (orders || []).map((order) => {
      const status = normalizeStatus(order.order_status || order.status || "pending");
      const payment = normalizeStatus(order.payment_status || "pending");
      const title = status.includes("delivered") || status.includes("teslim")
        ? "Sipariş teslim edildi"
        : status.includes("shipped") || status.includes("kargo")
          ? "Sipariş kargoda"
          : payment.includes("paid") || payment.includes("ödendi")
            ? "Ödeme alındı"
            : "Sipariş güncellemesi";
      return notification(
        `order:${order.id}:${order.updated_at || order.created_at || ""}`,
        "order",
        title,
        `${orderNo(order)} için durum: ${order.order_status || order.status || "pending"}.`,
        order.updated_at || order.created_at,
        `/pages/account/order-detail.html?id=${encodeURIComponent(order.id)}`,
        status.includes("cancel") || status.includes("refund") ? "warning" : "info"
      );
    });
  }

  function ticketNotifications(tickets) {
    return (tickets || []).map((ticket) => {
      const refund = /iade|iptal|refund|cancel/i.test(`${ticket.title || ""} ${ticket.message || ""} ${ticket.category || ""}`);
      const status = normalizeStatus(ticket.status || "open");
      const title = refund
        ? (status.includes("resolved") || status.includes("closed") ? "İade/iptal talebi sonuçlandı" : "İade/iptal talebi alındı")
        : "Destek talebi güncellendi";
      return notification(
        `ticket:${ticket.id}:${ticket.updated_at || ticket.created_at || ""}`,
        "support",
        title,
        ticket.title || ticket.message || "Talebin ekip tarafından inceleniyor.",
        ticket.updated_at || ticket.created_at,
        "/pages/account/bildirimler.html",
        status.includes("resolved") || status.includes("closed") ? "success" : "warning"
      );
    });
  }

  function couponNotifications(user, remoteCoupons) {
    const byCode = new Map();
    [...(remoteCoupons || []), ...localCoupons(user)].forEach((coupon) => {
      if (!coupon || !coupon.code) return;
      byCode.set(String(coupon.code).toUpperCase(), coupon);
    });
    return Array.from(byCode.values()).slice(0, 8).map((coupon) => notification(
      `coupon:${String(coupon.code).toUpperCase()}:${coupon.status || "active"}`,
      "coupon",
      coupon.status === "used" ? "Kupon kullanıldı" : "Kupon hesabında",
      `${coupon.title || coupon.code} ${coupon.status === "used" ? "kullanılmış görünüyor." : "alışverişte kullanılabilir."}`,
      coupon.used_at || coupon.assigned_at || coupon.created_at,
      "/pages/commerce/kuponlar.html",
      coupon.status === "used" ? "success" : "info"
    ));
  }

  function profileNotifications(profile) {
    const items = [];
    if (!profile?.full_name || !profile?.phone || !profile?.profession_name || profile.profession_name === "Diğer Meslek") {
      items.push(notification(
        "profile:complete",
        "profile",
        "Profilini tamamla",
        "Meslek, telefon ve temel bilgilerini tamamladığında panel önerileri daha doğru çalışır.",
        new Date().toISOString(),
        "/pages/account/profil.html",
        "warning"
      ));
    }
    if (profile?.last_daily_login_date !== todayKey()) {
      items.push(notification(
        `daily-login:${todayKey()}`,
        "task",
        "Günlük giriş hazır",
        "Bugünkü düşük değerli görev HP ve XP ödülünü panelden alabilirsin.",
        new Date().toISOString(),
        "/pages/account/user-panel.html",
        "success"
      ));
    }
    return items;
  }

  async function load(options) {
    const loaded = options?.user ? options : await loadSession();
    const user = loaded?.user || null;
    const profile = loaded?.profile || null;
    if (!user) {
      return {
        user: null,
        notifications: [
          notification("guest:login", "account", "Bildirimler için giriş yap", "Sipariş, kupon ve destek bildirimlerini görmek için hesabına giriş yap.", new Date().toISOString(), "/pages/account/user.html", "warning")
        ],
        unreadCount: 1
      };
    }

    const [orders, tickets, remoteCoupons] = await Promise.all([
      loadOrders(user),
      loadTickets(user),
      loadRemoteCoupons(user)
    ]);
    const notifications = [
      ...profileNotifications(profile || {}),
      ...orderNotifications(orders),
      ...ticketNotifications(tickets),
      ...couponNotifications(user, remoteCoupons)
    ]
      .filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 40);

    const readIds = new Set(readStore(user));
    return {
      user,
      profile,
      notifications,
      unreadCount: notifications.filter((item) => !readIds.has(item.id)).length
    };
  }

  function markAllRead(user, notifications) {
    if (!user) return;
    writeReadStore(user, (notifications || []).map((item) => item.id));
  }

  window.AllonaUserNotifications = {
    load,
    markAllRead,
    formatDate
  };
})();
