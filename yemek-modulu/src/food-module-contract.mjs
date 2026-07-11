export const FOOD_MODULE_NAMESPACE = "food";

export const FOOD_TABLES = Object.freeze({
  partners: "food_partners",
  partnerMemberships: "food_partner_memberships",
  categories: "food_categories",
  products: "food_products",
  productMedia: "food_product_media",
  productVariants: "food_product_variants",
  optionGroups: "food_product_option_groups",
  productOptions: "food_product_options",
  userFavorites: "food_user_favorites",
  orders: "food_orders",
  orderItems: "food_order_items",
  orderEvents: "food_order_events",
  deliveryHandoffs: "food_delivery_handoffs",
  deliveryEvents: "food_delivery_events",
  auditLogs: "food_audit_logs",
  moduleSetups: "food_module_setups"
});

export const FOOD_BUTTON_ACTIONS = Object.freeze({
  selectCategory: {
    table: FOOD_TABLES.categories,
    event: "food.category.select",
    requiredState: ["category_slug"],
    resultState: "filtered_products"
  },
  openProduct: {
    table: FOOD_TABLES.products,
    event: "food.product.open",
    requiredState: ["product_id"],
    resultState: "product_detail"
  },
  addToCart: {
    table: FOOD_TABLES.products,
    event: "food.cart.add_item",
    requiredState: ["product_id", "quantity"],
    resultState: "cart"
  },
  updateCartQuantity: {
    table: FOOD_TABLES.products,
    event: "food.cart.update_quantity",
    requiredState: ["product_id", "quantity"],
    resultState: "cart"
  },
  removeFromCart: {
    table: FOOD_TABLES.products,
    event: "food.cart.remove_item",
    requiredState: ["product_id"],
    resultState: "cart"
  },
  toggleFavorite: {
    table: FOOD_TABLES.userFavorites,
    event: "food.favorite.toggle",
    requiredState: ["user_id", "product_id"],
    resultState: "favorite_state"
  },
  submitOrder: {
    table: FOOD_TABLES.orders,
    event: "food.order.submit",
    requiredState: ["user_id", "partner_id", "items", "delivery_address"],
    resultState: "order"
  },
  partnerCreateProduct: {
    table: FOOD_TABLES.products,
    event: "food.partner.product.create",
    requiredState: ["partner_id", "name", "price", "category_id"],
    resultState: "draft_product"
  },
  partnerUploadImage: {
    table: FOOD_TABLES.productMedia,
    bucket: "food-product-images",
    event: "food.partner.product_image.upload",
    requiredState: ["partner_id", "product_id", "file", "alt_text"],
    resultState: "product_media"
  },
  partnerSubmitForReview: {
    table: FOOD_TABLES.products,
    event: "food.partner.product.submit_for_review",
    requiredState: ["product_id", "partner_id"],
    resultState: "pending_review_product"
  },
  adminApproveProduct: {
    table: FOOD_TABLES.products,
    event: "food.admin.product.approve",
    requiredState: ["product_id", "admin_user_id"],
    resultState: "active_product"
  },
  markSoldOut: {
    table: FOOD_TABLES.products,
    event: "food.partner.product.mark_sold_out",
    requiredState: ["product_id", "partner_id"],
    resultState: "sold_out_product"
  },
  createCourierHandoff: {
    table: FOOD_TABLES.deliveryHandoffs,
    event: "food.delivery_handoff.create",
    requiredState: ["order_id", "partner_id", "pickup_location", "dropoff_location"],
    resultState: "delivery_handoff"
  },
  trackCourierHandoff: {
    table: FOOD_TABLES.deliveryEvents,
    event: "food.delivery_handoff.track",
    requiredState: ["handoff_id"],
    resultState: "delivery_events"
  }
});

export const FOOD_IMAGE_KEYWORDS = Object.freeze({
  "tavuk-doner-durum": ["tavuk", "doner", "durum"],
  lahmacun: ["lahmacun"],
  "mercimek-corbasi": ["mercimek", "corba"],
  "fistikli-baklava": ["fistik", "baklava"]
});

export function normalizeFoodText(value) {
  return String(value ?? "")
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function assertFoodModuleIsolation(name) {
  if (!String(name).startsWith("food_")) {
    throw new Error(`Yemek modülü kaynağı food_ prefix'i kullanmalı: ${name}`);
  }

  return true;
}

export function resolveButtonAction(actionKey) {
  const action = FOOD_BUTTON_ACTIONS[actionKey];

  if (!action) {
    throw new Error(`Tanımsız yemek modülü aksiyonu: ${actionKey}`);
  }

  if (action.table) {
    assertFoodModuleIsolation(action.table);
  }

  if (!String(action.event).startsWith("food.")) {
    throw new Error(`Yemek modülü event'i food. prefix'i kullanmalı: ${action.event}`);
  }

  return action;
}

export function inferImageNameMatch(product) {
  const slug = product.slug || normalizeFoodText(product.name);
  const expectedKeywords = [
    ...new Set(FOOD_IMAGE_KEYWORDS[slug] ?? normalizeFoodText(product.name).split("-"))
  ];
  const searchable = [
    product.image_url,
    product.image_alt,
    product.image_generation_prompt,
    product.media_caption,
    product.media_review_note
  ]
    .map(normalizeFoodText)
    .join(" ");

  const matchedKeywords = expectedKeywords.filter((keyword) =>
    searchable.includes(normalizeFoodText(keyword))
  );
  const score = expectedKeywords.length === 0 ? 0 : matchedKeywords.length / expectedKeywords.length;

  return {
    status: score >= 0.5 ? "approved" : "needs_review",
    score,
    matchedKeywords,
    expectedKeywords
  };
}

export function validateFoodProductForSale(product) {
  const missing = [];
  const warnings = [];

  if (!product.partner_id) missing.push("partner_id");
  if (!product.name) missing.push("name");
  if (!product.slug) missing.push("slug");
  if (!product.category_id && !product.category_slug) missing.push("category");
  if (!product.description || product.description.length < 20) missing.push("description");
  if (!Number.isFinite(Number(product.price)) || Number(product.price) <= 0) missing.push("price");
  if (!product.currency) missing.push("currency");
  if (!product.image_url) missing.push("image_url");
  if (!product.image_alt) missing.push("image_alt");
  if (!Array.isArray(product.allergens)) missing.push("allergens");
  if (!Array.isArray(product.ingredients) || product.ingredients.length === 0) missing.push("ingredients");
  if (!product.stock_status) missing.push("stock_status");
  if (!Number.isFinite(Number(product.prep_time_minutes)) || Number(product.prep_time_minutes) <= 0) {
    missing.push("prep_time_minutes");
  }

  if (product.status !== "active" && product.status !== "approved") {
    warnings.push("Ürün kullanıcı tarafında görünmeden önce approved veya active olmalı.");
  }

  if (product.stock_status === "sold_out") {
    missing.push("sellable_stock");
  }

  const imageMatch = inferImageNameMatch(product);
  if (product.image_match_status !== "approved" && imageMatch.status !== "approved") {
    missing.push("image_name_match");
  }

  if (!product.courier_required && !product.pickup_only) {
    warnings.push("Teslimat veya gel-al modu açıkça belirtilmeli.");
  }

  return {
    ready: missing.length === 0,
    missing,
    warnings,
    imageMatch
  };
}

export function buildPartnerProductPayload(input, context) {
  if (!context?.partnerId) {
    throw new Error("partnerId zorunlu");
  }

  const slug = input.slug || normalizeFoodText(input.name);

  return {
    partner_id: context.partnerId,
    category_id: input.category_id,
    name: String(input.name ?? "").trim(),
    slug,
    description: String(input.description ?? "").trim(),
    price: Number(input.price),
    currency: input.currency || "TRY",
    status: input.status || "draft",
    stock_status: input.stock_status || "in_stock",
    stock_quantity: Number.isFinite(Number(input.stock_quantity)) ? Number(input.stock_quantity) : null,
    prep_time_minutes: Number(input.prep_time_minutes || 20),
    ingredients: Array.isArray(input.ingredients) ? input.ingredients : [],
    allergens: Array.isArray(input.allergens) ? input.allergens : [],
    tags: Array.isArray(input.tags) ? input.tags : [],
    image_url: input.image_url || null,
    image_alt: input.image_alt || null,
    image_match_status: input.image_match_status || "unchecked",
    courier_required: input.courier_required ?? true,
    created_by: context.userId ?? null
  };
}

export function buildCourierHandoffPayload(order) {
  if (!order?.id) throw new Error("order.id zorunlu");
  if (!order.partner_id) throw new Error("order.partner_id zorunlu");
  if (!order.pickup_location) throw new Error("pickup_location zorunlu");
  if (!order.dropoff_location) throw new Error("dropoff_location zorunlu");

  return {
    schema_version: "food-courier-handoff.v1",
    source_module: FOOD_MODULE_NAMESPACE,
    source_event: "food.delivery_handoff.create",
    external_order_id: order.id,
    partner_id: order.partner_id,
    pickup_location: order.pickup_location,
    dropoff_location: order.dropoff_location,
    customer_note: order.delivery_note ?? null,
    ready_at: order.ready_at ?? null,
    package_count: Number(order.package_count || 1),
    temperature_handling: order.temperature_handling || "hot",
    payment: {
      payment_status: order.payment_status ?? "unknown",
      collect_cash: Boolean(order.collect_cash)
    },
    items: (order.items ?? []).map((item) => ({
      product_id: item.product_id,
      name: item.name,
      quantity: Number(item.quantity || 1),
      package_note: item.package_note ?? null
    }))
  };
}

export function listUnwiredFoodButtons(renderedButtonKeys) {
  const known = new Set(Object.keys(FOOD_BUTTON_ACTIONS));
  return renderedButtonKeys.filter((key) => !known.has(key));
}
