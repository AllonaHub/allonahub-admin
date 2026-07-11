import {
  FOOD_TABLES,
  buildCourierHandoffPayload,
  buildPartnerProductPayload,
  validateFoodProductForSale
} from "./food-module-contract.mjs";

function requireSupabaseClient(supabase) {
  if (!supabase?.from) {
    throw new Error("Supabase client zorunlu");
  }
}

export async function fetchPublicFoodProducts(supabase, filters = {}) {
  requireSupabaseClient(supabase);

  let query = supabase
    .from("food_public_products")
    .select("*")
    .eq("status", "active")
    .order("is_featured", { ascending: false })
    .order("name", { ascending: true });

  if (filters.category_slug) {
    query = query.eq("category_slug", filters.category_slug);
  }

  if (filters.partner_id) {
    query = query.eq("partner_id", filters.partner_id);
  }

  return query;
}

export async function createPartnerFoodProduct(supabase, input, context) {
  requireSupabaseClient(supabase);

  const payload = buildPartnerProductPayload(input, context);

  return supabase
    .from(FOOD_TABLES.products)
    .insert(payload)
    .select("*")
    .single();
}

export async function submitPartnerProductForReview(supabase, product) {
  requireSupabaseClient(supabase);

  const readiness = validateFoodProductForSale({
    ...product,
    status: "approved"
  });

  if (!readiness.ready) {
    return {
      data: null,
      error: {
        code: "FOOD_PRODUCT_NOT_READY",
        message: `Ürün incelemeye gönderilemez: ${readiness.missing.join(", ")}`,
        details: readiness
      }
    };
  }

  return supabase
    .from(FOOD_TABLES.products)
    .update({
      status: "pending_review",
      submitted_at: new Date().toISOString()
    })
    .eq("id", product.id)
    .eq("partner_id", product.partner_id)
    .select("*")
    .single();
}

export async function createFoodOrder(supabase, orderPayload) {
  requireSupabaseClient(supabase);

  return supabase
    .from(FOOD_TABLES.orders)
    .insert(orderPayload)
    .select("*")
    .single();
}

export async function createCourierHandoff(supabase, order) {
  requireSupabaseClient(supabase);

  const payload = buildCourierHandoffPayload(order);

  return supabase
    .from(FOOD_TABLES.deliveryHandoffs)
    .insert({
      order_id: order.id,
      partner_id: order.partner_id,
      status: "pending",
      pickup_location: order.pickup_location,
      dropoff_location: order.dropoff_location,
      payload
    })
    .select("*")
    .single();
}

export async function markProductSoldOut(supabase, productId, partnerId) {
  requireSupabaseClient(supabase);

  return supabase
    .from(FOOD_TABLES.products)
    .update({
      status: "sold_out",
      stock_status: "sold_out",
      updated_at: new Date().toISOString()
    })
    .eq("id", productId)
    .eq("partner_id", partnerId)
    .select("*")
    .single();
}

