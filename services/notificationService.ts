type SupabaseClientLike = {
  from: (table: string) => any;
};

type NotificationPayload = {
  title: string;
  body: string;
  notification_type: string;
  module?: string;
  entity_type?: string;
  entity_id?: string;
  action_url?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  metadata?: Record<string, unknown>;
};

export async function createNotification(
  supabase: SupabaseClientLike,
  userId: string,
  payload: NotificationPayload
) {
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      module: "all",
      priority: "normal",
      metadata: {},
      ...payload
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message || "Notification could not be created");
  return data;
}

export async function markAsRead(supabase: SupabaseClientLike, notificationId: string, userId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw new Error(error.message || "Notification could not be marked read");
  return data;
}

export async function markAllAsRead(supabase: SupabaseClientLike, userId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_read", false)
    .select("id");

  if (error) throw new Error(error.message || "Notifications could not be marked read");
  return data || [];
}

export async function getUnreadCount(supabase: SupabaseClientLike, userId: string) {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) throw new Error(error.message || "Unread count could not be loaded");
  return count || 0;
}

export async function sendOrderStatusNotification(supabase: SupabaseClientLike, orderId: string) {
  const { data: order, error } = await supabase
    .from("orders")
    .select("id,user_id,status,order_status,order_number,order_no")
    .eq("id", orderId)
    .single();

  if (error || !order) throw new Error(error?.message || "Order not found");
  return createNotification(supabase, order.user_id, {
    title: "Siparis durumun guncellendi",
    body: `${order.order_number || order.order_no || "Siparis"} durumu: ${order.status || order.order_status}`,
    notification_type: "order_status",
    module: "shop",
    entity_type: "order",
    entity_id: order.id,
    action_url: `/pages/account/order-detail.html?id=${order.id}`
  });
}

export async function sendCouponReminder(supabase: SupabaseClientLike, userId: string, couponId: string) {
  const { data: coupon } = await supabase.from("coupons").select("id,title,code,ends_at").eq("id", couponId).single();
  return createNotification(supabase, userId, {
    title: "Kuponunun bitmesine az kaldi",
    body: `${coupon?.title || coupon?.code || "Kupon"} firsatini suresi dolmadan kullan.`,
    notification_type: "coupon_reminder",
    module: coupon?.module || "shop",
    entity_type: "coupon",
    entity_id: couponId,
    action_url: "/pages/commerce/coupon-center.html"
  });
}

export async function sendHpRewardNotification(
  supabase: SupabaseClientLike,
  userId: string,
  hpAmount: number,
  reason: string
) {
  return createNotification(supabase, userId, {
    title: "HP/XP avantaji kazandin",
    body: `${hpAmount} HP kazandin. ${reason || "Avantajlarim alanindan takip edebilirsin."}`,
    notification_type: "hp_reward",
    module: "all",
    action_url: "/pages/account/rewards.html"
  });
}

export async function sendPremiumProgressNotification(supabase: SupabaseClientLike, userId: string) {
  return createNotification(supabase, userId, {
    title: "Seviye ilerlemene az kaldi",
    body: "HP/XP gorevlerini tamamlayarak yeni avantaj seviyesine yaklasabilirsin.",
    notification_type: "premium_progress",
    module: "all",
    action_url: "/pages/account/premium.html"
  });
}

export async function sendAbandonedCartNotification(supabase: SupabaseClientLike, userId: string) {
  return createNotification(supabase, userId, {
    title: "Sepetindeki urunler seni bekliyor",
    body: "Siparisini tamamlamak icin sepetine donebilirsin.",
    notification_type: "abandoned_cart",
    module: "shop",
    action_url: "/pages/commerce/cart.html"
  });
}

export async function sendFavoriteReminder(supabase: SupabaseClientLike, userId: string, productId: string) {
  return createNotification(supabase, userId, {
    title: "Favorindeki urun icin yeni firsat var",
    body: "Favorine ekledigin urun icin avantajli bir donem basladi.",
    notification_type: "favorite_price_drop",
    module: "shop",
    entity_type: "product",
    entity_id: productId,
    action_url: `/pages/commerce/product.html?id=${productId}`
  });
}
