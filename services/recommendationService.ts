type SupabaseClientLike = {
  from: (table: string) => any;
};

async function listRecentEntityIds(supabase: SupabaseClientLike, userId: string, entityType: string) {
  const { data } = await supabase
    .from("user_recent_views")
    .select("entity_id,module")
    .eq("user_id", userId)
    .eq("entity_type", entityType)
    .order("viewed_at", { ascending: false })
    .limit(20);

  return data || [];
}

export async function getRecommendedProducts(supabase: SupabaseClientLike, userId: string) {
  const recent = await listRecentEntityIds(supabase, userId, "product");
  const { data: favorites } = await supabase
    .from("user_favorites")
    .select("entity_id,module")
    .eq("user_id", userId)
    .eq("entity_type", "product")
    .limit(20);

  const seedIds = [...recent, ...(favorites || [])].map((item: any) => item.entity_id).filter(Boolean);
  let query = supabase
    .from("products")
    .select("*")
    .eq("approval_status", "approved")
    .eq("status", "active")
    .order("ranking_score", { ascending: false })
    .limit(16);

  if (seedIds.length) query = query.not("id", "in", `(${seedIds.join(",")})`);
  const { data, error } = await query;
  if (error) throw new Error(error.message || "Recommended products could not be loaded");
  return data || [];
}

export async function getRecommendedCoupons(supabase: SupabaseClientLike, userId: string) {
  const { data: rewards } = await supabase
    .from("user_rewards")
    .select("hp_balance,premium_tier")
    .eq("user_id", userId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("is_active", true)
    .lte("hp_required", Number(rewards?.hp_balance || 0))
    .order("priority", { ascending: false })
    .limit(12);

  if (error) throw new Error(error.message || "Recommended coupons could not be loaded");
  return data || [];
}

export async function getRecommendedModules(supabase: SupabaseClientLike, userId: string) {
  const { data: events } = await supabase
    .from("user_events")
    .select("module")
    .eq("user_id", userId)
    .eq("event_type", "module_click")
    .limit(20);

  const seen = new Set((events || []).map((item: any) => item.module).filter(Boolean));
  const { data, error } = await supabase
    .from("platform_modules")
    .select("*")
    .eq("is_visible", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message || "Recommended modules could not be loaded");
  return (data || []).sort((a: any, b: any) => Number(seen.has(a.slug)) - Number(seen.has(b.slug)));
}

export async function getNextBestAction(supabase: SupabaseClientLike, userId: string) {
  const { data: orders } = await supabase.from("orders").select("id").eq("user_id", userId).limit(1);
  const { data: carts } = await supabase.from("carts").select("id").eq("user_id", userId).eq("status", "active").limit(1);
  const { data: coupons } = await supabase.from("coupon_redemptions").select("id").eq("user_id", userId).limit(1);

  if (carts?.length) return { key: "return_to_cart", title: "Sepetine don", href: "/pages/commerce/cart.html" };
  if (!orders?.length) return { key: "first_order", title: "Ilk siparis firsatini kullan", href: "/pages/commerce/coupon-center.html" };
  if (!coupons?.length) return { key: "coupon_center", title: "Kupon Merkezi'ni incele", href: "/pages/commerce/coupon-center.html" };
  return { key: "discover", title: "Sana uygun urunleri kesfet", href: "/pages/search/discover.html" };
}

export async function getPersonalizedHomeSections(supabase: SupabaseClientLike, userId: string) {
  const { data: sections, error } = await supabase
    .from("home_sections")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message || "Home sections could not be loaded");
  const nextBestAction = await getNextBestAction(supabase, userId);
  return { sections: sections || [], nextBestAction };
}
