import { createHash } from "node:crypto";
import { z } from "zod";
import { config } from "../config.js";
import { autoDefenseStatus } from "../lib/auto-defense.js";
import {
  auditEvent,
  authContext,
  hasMfa,
  hasRole,
  isAdmin,
  isPartner,
  mfaRequiredForRole,
  supabaseAdmin
} from "../lib/supabase.js";
import { cvCheckoutPayload, iyzicoPost, orderCheckoutPayload, partnerPaymentIntentCheckoutPayload } from "../lib/iyzico.js";

const uuidSchema = z.string().uuid();
const emailSchema = z.string().email().max(180);
const phoneSchema = z.string().trim().max(40).optional().default("");
const orderItemSchema = z.object({
  product_id: uuidSchema,
  quantity: z.coerce.number().int().min(1).max(99)
});

const createOrderSchema = z.object({
  customer_name: z.string().trim().min(2).max(160),
  customer_email: emailSchema,
  customer_phone: phoneSchema,
  city: z.string().trim().min(2).max(90),
  address: z.string().trim().min(10).max(1200),
  items: z.array(orderItemSchema).min(1).max(30),
  coupon_code: z.string().trim().max(40).optional().nullable()
});

const orderCheckoutSchema = z.object({
  orderId: uuidSchema
});

const publicPartnerIntentCheckoutSchema = z.object({
  intentId: uuidSchema,
  customer_name: z.string().trim().min(2).max(160),
  customer_email: emailSchema,
  customer_phone: phoneSchema
});

const cvCheckoutSchema = z.object({
  buyerEmail: emailSchema.optional(),
  buyerPhone: phoneSchema
});

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  severity: z.enum(["debug", "info", "warning", "critical"]).optional(),
  actorId: uuidSchema.optional(),
  action: z.string().trim().max(140).optional(),
  resourceType: z.string().trim().max(120).optional(),
  resourceId: z.string().trim().max(180).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
});

const clientLocationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  accuracy_m: z.coerce.number().min(0).max(100000).optional(),
  city: z.string().trim().max(120).optional(),
  region: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional()
}).refine((value) => {
  const hasLatitude = value.latitude !== undefined;
  const hasLongitude = value.longitude !== undefined;
  return hasLatitude === hasLongitude || (!hasLatitude && !hasLongitude);
}, "Konum enlem ve boylam birlikte gönderilmelidir.");

const clientSecurityEventSchema = z.object({
  category: z.enum(["account", "profile", "order", "payment", "partner", "support", "legal_notice", "fraud_signal", "location_consent"]).default("fraud_signal"),
  action: z.string().trim().min(3).max(90).regex(/^[a-z0-9_.:-]+$/i),
  resource_type: z.string().trim().max(90).optional(),
  resource_id: z.string().trim().max(180).optional(),
  severity: z.enum(["debug", "info", "warning", "critical"]).optional().default("info"),
  page: z.string().trim().max(220).optional(),
  location_consent: z.boolean().optional().default(false),
  location: clientLocationSchema.optional(),
  evidence_tags: z.array(z.string().trim().max(60)).max(12).optional().default([]),
  metadata: z.record(z.unknown()).optional().default({})
});

const authorityRequestSchema = z.object({
  authority_type: z.enum(["police", "prosecutor", "court", "regulator", "other_public_authority"]),
  reference_no: z.string().trim().min(2).max(140),
  requester_name: z.string().trim().max(160).optional().default(""),
  requester_title: z.string().trim().max(160).optional().default(""),
  contact_channel: z.string().trim().max(240).optional().default(""),
  legal_basis: z.string().trim().min(8).max(1200),
  scope_summary: z.string().trim().min(8).max(1600),
  due_at: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional().default({})
});

const evidenceReportSchema = z.object({
  request_id: uuidSchema.optional(),
  case_reference: z.string().trim().min(2).max(140),
  legal_basis: z.string().trim().min(8).max(1200),
  purpose: z.string().trim().min(8).max(240).default("Yetkili makam talebi ve hukuki uyuşmazlık incelemesi"),
  actor_id: uuidSchema.optional(),
  resource_type: z.string().trim().max(120).optional(),
  resource_id: z.string().trim().max(180).optional(),
  action: z.string().trim().max(140).optional(),
  severity: z.enum(["debug", "info", "warning", "critical"]).optional(),
  request_id_filter: z.string().trim().max(120).optional(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(500)
});

const partnerPaymentIntentSchema = z.object({
  channel: z.enum(["qr", "nfc", "payment_link", "web_pos", "physical_pos", "cash", "wallet"]).default("qr"),
  provider: z.enum([
    "allonapay",
    "iyzico_checkout",
    "iyzico_link",
    "iyzico_cep_pos",
    "visa_tap_to_phone",
    "mastercard_tap_on_phone",
    "bank_pos",
    "manual"
  ]).optional(),
  amount: z.coerce.number().min(1).max(250000),
  currency: z.string().trim().length(3).optional().default("TRY"),
  description: z.string().trim().max(240).optional().default(""),
  customer_name: z.string().trim().max(160).optional().default(""),
  customer_phone: z.string().trim().max(40).optional().default(""),
  customer_email: emailSchema.optional().or(z.literal("")).default(""),
  location_id: uuidSchema.optional(),
  device_id: uuidSchema.optional(),
  order_id: uuidSchema.optional(),
  expires_in_minutes: z.coerce.number().int().min(3).max(1440).optional().default(20)
});

const partnerSupportTicketSchema = z.object({
  category: z.enum(["general", "product", "order", "payment", "qr_nfc", "cargo", "payout", "technical"]).default("general"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  title: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(2000)
});

const partnerProfileUpdateSchema = z.object({
  display_name: z.string().trim().min(2).max(160).optional(),
  legal_name: z.string().trim().max(180).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  city: z.string().trim().max(90).optional().nullable(),
  country: z.string().trim().max(90).optional().nullable(),
  description: z.string().trim().max(1200).optional().nullable(),
  logo_url: z.string().trim().max(700).optional().nullable(),
  preferred_cargo_company: z.string().trim().max(120).optional().nullable(),
  payout_schedule: z.enum(["daily", "weekly", "biweekly", "monthly"]).optional()
});

const partnerOrderStatusSchema = z.object({
  orderId: uuidSchema,
  order_status: z.enum(["confirmed", "preparing", "shipped", "delivered", "cancelled"]).optional(),
  tracking_number: z.string().trim().max(120).optional().nullable()
});

function clientIp(request) {
  return String(request.headers["cf-connecting-ip"] || request.ip || "0.0.0.0").split(",")[0].trim();
}

function requestHostname(request) {
  return String(request.headers.host || "").split(":")[0].trim().toLowerCase();
}

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sha256Json(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function assertEvidenceWindow(from, to) {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) {
    throw httpError("Delil raporu tarih aralığı geçersiz.", 400);
  }
  const maxWindowMs = 366 * 24 * 60 * 60 * 1000;
  if (toMs - fromMs > maxWindowMs) {
    throw httpError("Delil raporu aralığı en fazla 366 gün olabilir.", 400);
  }
}

function evidenceFilters(payload) {
  return {
    actor_id: payload.actor_id || null,
    resource_type: payload.resource_type || null,
    resource_id: payload.resource_id || null,
    action: payload.action || null,
    severity: payload.severity || null,
    request_id: payload.request_id_filter || null,
    from: payload.from,
    to: payload.to,
    limit: payload.limit
  };
}

async function queryEvidenceEvents(payload) {
  let dbQuery = supabaseAdmin
    .from("security_audit_events")
    .select([
      "id",
      "actor_id",
      "actor_role",
      "action",
      "resource_type",
      "resource_id",
      "severity",
      "ip_address",
      "user_agent",
      "request_id",
      "source",
      "purpose",
      "location_basis",
      "geo_country",
      "geo_region",
      "geo_city",
      "geo_latitude",
      "geo_longitude",
      "geo_accuracy_m",
      "previous_hash",
      "event_hash",
      "evidence_tags",
      "metadata",
      "created_at"
    ].join(", "))
    .gte("created_at", payload.from)
    .lte("created_at", payload.to)
    .order("created_at", { ascending: true })
    .limit(payload.limit);

  if (payload.actor_id) dbQuery = dbQuery.eq("actor_id", payload.actor_id);
  if (payload.resource_type) dbQuery = dbQuery.eq("resource_type", payload.resource_type);
  if (payload.resource_id) dbQuery = dbQuery.eq("resource_id", payload.resource_id);
  if (payload.action) dbQuery = dbQuery.eq("action", payload.action);
  if (payload.severity) dbQuery = dbQuery.eq("severity", payload.severity);
  if (payload.request_id_filter) dbQuery = dbQuery.eq("request_id", payload.request_id_filter);

  const { data, error } = await dbQuery;
  if (error) throw error;
  return data || [];
}

function assertPaymentsEnabled() {
  if (config.paymentsDisabled) {
    throw httpError("Ödeme sistemi geçici olarak koruma modunda.", 503);
  }
}

function redirect(reply, target) {
  return reply.code(303).header("Location", target).send();
}

function assertAdminBoundary(request) {
  const hostname = requestHostname(request);
  if (config.adminHosts.length && hostname && !config.adminHosts.includes(hostname)) {
    throw httpError("Admin ağı doğrulanamadı.", 403);
  }

  const ip = clientIp(request);
  if (config.adminIpAllowlist.length && !config.adminIpAllowlist.includes(ip)) {
    throw httpError("Admin IP doğrulaması başarısız.", 403);
  }
}

async function requireAuth(request, options = {}) {
  const ctx = await authContext(request);
  const action = options.action || "auth.required";

  if (!ctx?.user) {
    await auditEvent({
      request,
      action: "auth.denied",
      severity: "warning",
      metadata: { action, path: request.url.split("?")[0] }
    });
    throw httpError("Oturum doğrulanamadı.", 401);
  }

  if (options.roles?.length && !hasRole(ctx.profile, options.roles)) {
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "authz.denied",
      severity: "warning",
      metadata: { action, required_roles: options.roles }
    });
    throw httpError("Bu işlem için yetkiniz yok.", 403);
  }

  if (options.mfa && mfaRequiredForRole(ctx.profile.role) && !hasMfa(ctx)) {
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "mfa.required",
      severity: "warning",
      metadata: { action, aal: ctx.authenticatorAssuranceLevel }
    });
    throw httpError("Bu işlem için iki aşamalı doğrulama gerekli.", 403);
  }

  if (options.adminBoundary) {
    try {
      assertAdminBoundary(request);
    } catch (error) {
      await auditEvent({
        request,
        actorId: ctx.user.id,
        actorRole: ctx.profile.role,
        action: "admin.boundary_denied",
        severity: "critical",
        metadata: { hostname: requestHostname(request), ip: clientIp(request) }
      });
      throw error;
    }
  }

  return ctx;
}

async function getOrderForPayment(orderId, ctx) {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order) {
    const notFound = new Error("Sipariş bulunamadı.");
    notFound.statusCode = 404;
    throw notFound;
  }
  if (order.user_id !== ctx.user.id && !isAdmin(ctx.profile)) {
    const forbidden = new Error("Bu sipariş için yetkiniz yok.");
    forbidden.statusCode = 403;
    throw forbidden;
  }
  return order;
}

async function initializeIyzicoCheckout({ order, ctx, request }) {
  const uriPath = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
  const callbackUrl = `${config.apiUrl}/v1/payments/iyzico/callback?orderId=${encodeURIComponent(order.id)}`;
  const payload = orderCheckoutPayload({
    order,
    userId: ctx.user.id,
    callbackUrl,
    ip: clientIp(request)
  });

  const { ok, result } = await iyzicoPost(uriPath, payload);
  if (!ok || result.status !== "success") {
    await supabaseAdmin.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
    request.log.warn({ orderId: order.id, iyzicoStatus: result.status }, "iyzico checkout failed");
    const error = new Error("Ödeme oturumu başlatılamadı.");
    error.statusCode = 400;
    throw error;
  }

  await supabaseAdmin
    .from("orders")
    .update({ payment_status: "awaiting_payment" })
    .eq("id", order.id);

  return {
    paymentPageUrl: result.paymentPageUrl,
    token: result.token
  };
}

async function queryIyzicoCheckoutDetail(token, conversationId) {
  const uriPath = "/payment/iyzipos/checkoutform/auth/ecom/detail";
  return iyzicoPost(uriPath, {
    locale: "tr",
    conversationId,
    token
  });
}

async function bodyOrQuery(request) {
  if (request.method === "GET") return request.query || {};
  return {
    ...(request.query || {}),
    ...(request.body || {})
  };
}

function publicPaymentBaseUrl(request) {
  const fromConfig = config.siteUrl || `${request.protocol || "https"}://${request.headers.host || "allonahub.com"}`;
  return String(fromConfig).replace(/\/$/, "");
}

function partnerProviderForChannel(channel, provider) {
  if (provider) return provider;
  if (channel === "nfc") return "iyzico_cep_pos";
  if (channel === "payment_link") return "iyzico_link";
  if (channel === "physical_pos") return "bank_pos";
  if (channel === "cash") return "manual";
  return "iyzico_checkout";
}

function partnerPaymentStatusLabel(status) {
  const labels = {
    created: "Oluşturuldu",
    awaiting_payment: "Ödeme bekliyor",
    provider_pending: "Sağlayıcı bekliyor",
    paid: "Ödendi",
    failed: "Başarısız",
    cancelled: "İptal",
    expired: "Süresi doldu",
    refunded: "İade"
  };
  return labels[status] || "Oluşturuldu";
}

async function ensurePartnerBusiness(ctx, request) {
  const { data: existing, error } = await supabaseAdmin
    .from("partner_businesses")
    .select("*")
    .eq("owner_id", ctx.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  const displayName = String(ctx.profile.full_name || ctx.user.user_metadata?.full_name || ctx.user.email || "Allona Partner").slice(0, 160);
  const { data: created, error: createError } = await supabaseAdmin
    .from("partner_businesses")
    .insert({
      owner_id: ctx.user.id,
      display_name: displayName,
      legal_name: displayName,
      email: ctx.user.email || null,
      phone: ctx.profile.phone || null,
      status: "active",
      verification_status: "pending",
      metadata: {
        created_from: "partner_os_auto_bootstrap"
      }
    })
    .select("*")
    .single();
  if (createError) throw createError;

  await auditEvent({
    request,
    actorId: ctx.user.id,
    actorRole: ctx.profile.role,
    action: "partner.business_auto_created",
    resourceType: "partner_business",
    resourceId: created.id,
    metadata: { display_name: displayName }
  });
  return created;
}

function summarizePartnerOrders(orders, ownerId, isAdminUser) {
  return (orders || [])
    .map((order) => {
      const partnerItems = (order.order_items || []).filter((item) => {
        const product = item.product || item.products || {};
        return isAdminUser || product.partner_id === ownerId;
      });
      if (!partnerItems.length) return null;
      const partnerTotal = partnerItems.reduce((sum, item) => sum + Number(item.price || item.unit_price || 0) * Number(item.quantity || 1), 0);
      return {
        ...order,
        partner_items: partnerItems,
        partner_total: Number(partnerTotal.toFixed(2))
      };
    })
    .filter(Boolean);
}

function partnerMetrics({ business, products, orders, paymentIntents, transactions, payouts, tickets }) {
  const paidIntents = paymentIntents.filter((intent) => intent.status === "paid");
  const openTickets = tickets.filter((ticket) => ["open", "waiting"].includes(ticket.status));
  const gross = transactions.reduce((sum, item) => sum + Number(item.gross_amount || 0), 0);
  const net = transactions.reduce((sum, item) => sum + Number(item.net_amount || 0), 0);
  const awaitingPayments = paymentIntents.filter((intent) => ["created", "awaiting_payment", "provider_pending"].includes(intent.status)).length;
  const paidToday = paidIntents
    .filter((intent) => new Date(intent.paid_at || intent.updated_at || intent.created_at).toDateString() === new Date().toDateString())
    .reduce((sum, intent) => sum + Number(intent.amount || 0), 0);
  const payoutPending = payouts
    .filter((payout) => ["scheduled", "review", "approved"].includes(payout.status))
    .reduce((sum, payout) => sum + Number(payout.net_amount || 0), 0);

  return {
    product_count: products.length,
    active_product_count: products.filter((product) => product.status === "active").length,
    low_stock_count: products.filter((product) => Number(product.stock || 0) <= 5).length,
    order_count: orders.length,
    open_order_count: orders.filter((order) => ["pending", "confirmed", "preparing"].includes(order.order_status || order.status)).length,
    awaiting_payment_count: awaitingPayments,
    paid_today: Number(paidToday.toFixed(2)),
    gross_volume: Number(gross.toFixed(2)),
    net_volume: Number(net.toFixed(2)),
    payout_pending: Number(payoutPending.toFixed(2)),
    open_ticket_count: openTickets.length,
    trust_score: Number(business.trust_score || 70),
    level: Number(business.level || 1)
  };
}

function partnerRecommendations(metrics, devices) {
  const tips = [];
  if (!devices.some((device) => device.status === "active" && device.device_type === "android_softpos")) {
    tips.push({
      title: "NFC SoftPOS cihazı bağla",
      body: "Taksi, kurye veya saha satışı yapan ekipler Android NFC cihazla kart kabul etmeye hazır hale gelir.",
      action: "NFC kurulumunu planla"
    });
  }
  if (metrics.low_stock_count > 0) {
    tips.push({
      title: "Stok riski var",
      body: `${metrics.low_stock_count} ürün kritik stok seviyesinde. Satış kaybetmeden stokları güncelle.`,
      action: "Stokları kontrol et"
    });
  }
  if (metrics.awaiting_payment_count > 0) {
    tips.push({
      title: "Ödeme bekleyen linkler",
      body: "Açık ödeme isteklerini müşteriye tekrar göndererek tahsilat hızını artırabilirsin.",
      action: "Ödemeleri aç"
    });
  }
  if (!tips.length) {
    tips.push({
      title: "Panel sağlıklı görünüyor",
      body: "Ürün, ödeme ve hakediş akışları düzenli. Yeni kampanya veya QR vitrin açmak için iyi zaman.",
      action: "Kampanya oluştur"
    });
  }
  return tips.slice(0, 4);
}

export function registerRoutes(app) {
  app.get("/health", async () => ({
    ok: true,
    service: "allonahub-backend",
    time: new Date().toISOString()
  }));

  app.get("/ready", async (_request, reply) => {
    const { error } = await supabaseAdmin.from("profiles").select("id", { count: "exact", head: true });
    if (error) {
      return reply.code(503).send({ ok: false, message: "Supabase bağlantısı hazır değil." });
    }
    return { ok: true };
  });

  app.post("/v1/security/events", async (request, reply) => {
    const ctx = await requireAuth(request, { action: "security.client_event" });
    const payload = clientSecurityEventSchema.parse(request.body || {});
    const location = payload.location_consent ? payload.location || {} : {};
    const evidenceTags = [
      "client_event",
      payload.category,
      ...payload.evidence_tags
    ];

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: `client.${payload.category}.${payload.action}`.slice(0, 140),
      resourceType: payload.resource_type || "client_event",
      resourceId: payload.resource_id || null,
      severity: payload.severity,
      source: "client",
      purpose: "security_fraud_prevention",
      locationBasis: payload.location_consent ? "explicit_user_permission" : "none",
      location,
      evidenceTags,
      metadata: {
        page: payload.page || String(request.headers.referer || "").slice(0, 220),
        location_consent: payload.location_consent,
        client_metadata: payload.metadata
      }
    });

    return reply.code(202).send({ ok: true });
  });

  app.post("/v1/orders", async (request, reply) => {
    const ctx = await requireAuth(request, { action: "order.create" });
    const payload = createOrderSchema.parse(request.body || {});
    const { data, error } = await ctx.db.rpc("create_secure_order", {
      p_customer_name: payload.customer_name,
      p_customer_email: payload.customer_email,
      p_customer_phone: payload.customer_phone,
      p_city: payload.city,
      p_address: payload.address,
      p_items: payload.items,
      p_coupon_code: payload.coupon_code || null
    });
    if (error) throw error;
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "order.create",
      resourceType: "order",
      resourceId: data?.id || null,
      metadata: { item_count: payload.items.length, coupon: Boolean(payload.coupon_code) }
    });
    return reply.code(201).send({ ok: true, order: data });
  });

  app.post("/v1/payments/iyzico/checkout", async (request) => {
    assertPaymentsEnabled();
    const ctx = await requireAuth(request, { action: "payment.checkout", mfa: true });
    const payload = orderCheckoutSchema.parse(request.body || {});
    const order = await getOrderForPayment(payload.orderId, ctx);
    const checkout = await initializeIyzicoCheckout({ order, ctx, request });
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "payment.checkout_initialized",
      resourceType: "order",
      resourceId: order.id,
      metadata: { provider: "iyzico", amount: Number(order.total_amount ?? order.total ?? 0) }
    });
    return { ok: true, ...checkout };
  });

  app.post("/v1/public/partner-payment-intents/checkout", async (request) => {
    assertPaymentsEnabled();
    const payload = publicPartnerIntentCheckoutSchema.parse(request.body || {});
    const { data: intent, error: intentError } = await supabaseAdmin
      .from("partner_payment_intents")
      .select("*, partner:partner_businesses(*)")
      .eq("id", payload.intentId)
      .maybeSingle();
    if (intentError) throw intentError;
    if (!intent) throw httpError("Ödeme isteği bulunamadı.", 404);
    if (!["created", "awaiting_payment", "provider_pending"].includes(intent.status)) {
      throw httpError("Bu ödeme isteği artık tahsilata açık değil.", 409);
    }
    if (intent.expires_at && new Date(intent.expires_at).getTime() < Date.now()) {
      await supabaseAdmin
        .from("partner_payment_intents")
        .update({ status: "expired" })
        .eq("id", intent.id);
      throw httpError("Ödeme isteğinin süresi doldu.", 410);
    }
    if (intent.channel === "nfc") {
      throw httpError("NFC ödeme sertifikalı SoftPOS cihazında tamamlanmalıdır.", 409);
    }

    const uriPath = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
    const callbackUrl = `${config.apiUrl}/v1/payments/iyzico/callback?partnerPaymentIntentId=${encodeURIComponent(intent.id)}`;
    const checkoutPayload = partnerPaymentIntentCheckoutPayload({
      intent,
      business: intent.partner,
      buyer: payload,
      callbackUrl,
      ip: clientIp(request)
    });
    const { ok, result } = await iyzicoPost(uriPath, checkoutPayload);
    if (!ok || result.status !== "success") {
      await supabaseAdmin
        .from("partner_payment_intents")
        .update({ status: "failed", provider_status: result.status || "failed" })
        .eq("id", intent.id);
      await auditEvent({
        request,
        action: "partner.public_checkout_failed",
        resourceType: "partner_payment_intent",
        resourceId: intent.id,
        severity: "warning",
        metadata: { provider: "iyzico", provider_status: result.status || "unknown" }
      });
      throw httpError("Ödeme sayfası başlatılamadı.", 400);
    }

    const { error: updateError } = await supabaseAdmin
      .from("partner_payment_intents")
      .update({
        status: "awaiting_payment",
        provider: "iyzico_checkout",
        provider_reference: result.token || null,
        provider_status: result.status || "initialized",
        payment_url: result.paymentPageUrl || intent.payment_url,
        customer_name: payload.customer_name,
        customer_email: payload.customer_email,
        customer_phone: payload.customer_phone || intent.customer_phone || null
      })
      .eq("id", intent.id);
    if (updateError) throw updateError;

    await auditEvent({
      request,
      action: "partner.public_checkout_initialized",
      resourceType: "partner_payment_intent",
      resourceId: intent.id,
      metadata: { provider: "iyzico", amount: Number(intent.amount || 0), channel: intent.channel }
    });
    return { ok: true, paymentPageUrl: result.paymentPageUrl, token: result.token };
  });

  app.all("/v1/payments/iyzico/callback", async (request, reply) => {
    assertPaymentsEnabled();
    const payload = await bodyOrQuery(request);
    const token = String(payload.token || "").trim();
    const orderId = payload.orderId ? uuidSchema.parse(payload.orderId) : "";
    const cvPaymentId = payload.cvPaymentId ? uuidSchema.parse(payload.cvPaymentId) : "";
    const partnerPaymentIntentId = payload.partnerPaymentIntentId ? uuidSchema.parse(payload.partnerPaymentIntentId) : "";

    if (!token || token.length > 500 || (!orderId && !cvPaymentId && !partnerPaymentIntentId)) {
      await auditEvent({
        request,
        action: "payment.callback_invalid",
        severity: "critical",
        metadata: {
          provider: "iyzico",
          has_order_id: Boolean(orderId),
          has_cv_payment_id: Boolean(cvPaymentId),
          has_partner_payment_intent_id: Boolean(partnerPaymentIntentId)
        }
      });
      return reply.code(400).send({ ok: false, message: "Ödeme referansı doğrulanamadı." });
    }

    const { ok, result } = await queryIyzicoCheckoutDetail(token, partnerPaymentIntentId || cvPaymentId || orderId || token);
    const paymentStatus = ok && result.status === "success" && result.paymentStatus === "SUCCESS" ? "paid" : "failed";
    await auditEvent({
      request,
      action: "payment.callback_verified",
      resourceType: partnerPaymentIntentId ? "partner_payment_intent" : cvPaymentId ? "cv_payment" : "order",
      resourceId: partnerPaymentIntentId || cvPaymentId || orderId,
      severity: paymentStatus === "paid" ? "info" : "warning",
      metadata: {
        provider: "iyzico",
        provider_status: result.status || "unknown",
        payment_status: result.paymentStatus || "unknown"
      }
    });

    if (cvPaymentId) {
      const { data: payment, error: paymentError } = await supabaseAdmin
        .from("cv_payments")
        .select("*")
        .eq("id", cvPaymentId)
        .maybeSingle();
      if (paymentError) throw paymentError;
      if (!payment) return reply.code(404).send({ ok: false, message: "CV ödeme kaydı bulunamadı." });

      const { data: updatedPayment, error: updatePaymentError } = await supabaseAdmin
        .from("cv_payments")
        .update({ status: paymentStatus, iyzico_token: token })
        .eq("id", cvPaymentId)
        .neq("status", "paid")
        .select("id")
        .maybeSingle();
      if (updatePaymentError) throw updatePaymentError;

      if (paymentStatus === "paid" && updatedPayment) {
        const { data: access, error: accessError } = await supabaseAdmin
          .from("cv_access_accounts")
          .select("user_id, paid_credits")
          .eq("user_id", payment.user_id)
          .maybeSingle();
        if (accessError) throw accessError;

        if (access) {
          const { error: creditError } = await supabaseAdmin
            .from("cv_access_accounts")
            .update({ paid_credits: Number(access.paid_credits || 0) + 1 })
            .eq("user_id", payment.user_id);
          if (creditError) throw creditError;
        } else {
          const { error: insertAccessError } = await supabaseAdmin
            .from("cv_access_accounts")
            .insert({ user_id: payment.user_id, free_limit: 0, free_used: 0, paid_credits: 1, risk_reason: "paid_before_cv_access" });
          if (insertAccessError) throw insertAccessError;
        }
      }

      return redirect(reply, `${config.siteUrl}/pages/career/career-cv-form.html?payment=${paymentStatus}`);
    }

    if (partnerPaymentIntentId) {
      const { data: intent, error: intentError } = await supabaseAdmin
        .from("partner_payment_intents")
        .select("*, partner:partner_businesses(*)")
        .eq("id", partnerPaymentIntentId)
        .maybeSingle();
      if (intentError) throw intentError;
      if (!intent) return reply.code(404).send({ ok: false, message: "Partner ödeme isteği bulunamadı." });

      const { error: updateIntentError } = await supabaseAdmin
        .from("partner_payment_intents")
        .update({
          status: paymentStatus,
          provider_status: result.paymentStatus || result.status || paymentStatus,
          provider_reference: result.paymentId || token,
          paid_at: paymentStatus === "paid" ? new Date().toISOString() : null
        })
        .eq("id", partnerPaymentIntentId);
      if (updateIntentError) throw updateIntentError;

      if (paymentStatus === "paid") {
        const commissionRate = Number(intent.partner?.default_commission_rate || 0.12);
        const gross = Number(intent.amount || 0);
        const commissionAmount = Number((gross * commissionRate).toFixed(2));
        const { error: transactionError } = await supabaseAdmin
          .from("partner_transactions")
          .insert({
            partner_id: intent.partner_id,
            payment_intent_id: intent.id,
            order_id: intent.order_id || null,
            transaction_type: "payment",
            channel: intent.channel || "qr",
            provider: "iyzico_checkout",
            gross_amount: gross,
            commission_rate: commissionRate,
            commission_amount: commissionAmount,
            net_amount: Number((gross - commissionAmount).toFixed(2)),
            currency: intent.currency || "TRY",
            status: "paid",
            provider_reference: result.paymentId || token,
            metadata: { callback: "iyzico", conversation_id: result.conversationId || intent.id }
          });
        if (transactionError) throw transactionError;
      }

      return redirect(reply, `${config.siteUrl}/pages/partner/pay.html?intent=${partnerPaymentIntentId}&payment=${paymentStatus}`);
    }

    const orderStatus = paymentStatus === "paid" ? "confirmed" : "pending";
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ payment_status: paymentStatus, order_status: orderStatus })
      .eq("id", orderId);
    if (error) throw error;

    return redirect(reply, `${config.siteUrl}/pages/account/orders.html?payment=${paymentStatus}`);
  });

  app.post("/v1/cv/checkout", async (request) => {
    assertPaymentsEnabled();
    const ctx = await requireAuth(request, { action: "cv.checkout", mfa: true });
    const payload = cvCheckoutSchema.parse(request.body || {});

    const { count: recentCount, error: recentError } = await supabaseAdmin
      .from("cv_payments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.user.id)
      .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
    if (recentError) throw recentError;
    if (Number(recentCount || 0) >= 5) {
      const error = new Error("Çok sık ödeme denemesi yapıldı. Lütfen biraz bekleyin.");
      error.statusCode = 429;
      throw error;
    }

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("cv_payments")
      .insert({ user_id: ctx.user.id, amount: config.cvPriceTry, currency: "TRY", status: "pending" })
      .select("*")
      .single();
    if (paymentError) throw paymentError;

    const uriPath = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
    const callbackUrl = `${config.apiUrl}/v1/payments/iyzico/callback?cvPaymentId=${encodeURIComponent(payment.id)}`;
    const checkoutPayload = cvCheckoutPayload({
      payment,
      profile: { ...ctx.profile, phone: payload.buyerPhone || ctx.profile.phone },
      user: { ...ctx.user, email: payload.buyerEmail || ctx.user.email },
      callbackUrl,
      ip: clientIp(request)
    });
    const { ok, result } = await iyzicoPost(uriPath, checkoutPayload);
    if (!ok || result.status !== "success") {
      await supabaseAdmin.from("cv_payments").update({ status: "failed" }).eq("id", payment.id);
      await auditEvent({
        request,
        actorId: ctx.user.id,
        actorRole: ctx.profile.role,
        action: "cv.checkout_failed",
        resourceType: "cv_payment",
        resourceId: payment.id,
        severity: "warning",
        metadata: { provider: "iyzico", provider_status: result.status || "unknown" }
      });
      const error = new Error("CV ödeme oturumu başlatılamadı.");
      error.statusCode = 400;
      throw error;
    }

    await supabaseAdmin
      .from("cv_payments")
      .update({ status: "awaiting_payment", iyzico_token: result.token || null })
      .eq("id", payment.id);

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "cv.checkout_initialized",
      resourceType: "cv_payment",
      resourceId: payment.id,
      metadata: { provider: "iyzico", amount: Number(payment.amount || config.cvPriceTry) }
    });
    return { ok: true, paymentPageUrl: result.paymentPageUrl, token: result.token, cvPaymentId: payment.id };
  });

  app.get("/v1/partner/commission/preview", async (request) => {
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      mfa: true,
      action: "partner.commission.preview"
    });
    if (!isPartner(ctx.profile)) {
      const error = new Error("Partner yetkisi gerekli.");
      error.statusCode = 403;
      throw error;
    }

    const rawOrderId = request.query?.orderId ? String(request.query.orderId) : undefined;
    const orderId = uuidSchema.optional().parse(rawOrderId);
    let query = supabaseAdmin
      .from("order_items")
      .select("id, order_id, quantity, price, product:products(id, name, partner_id)");
    if (orderId) query = query.eq("order_id", orderId);

    const { data, error } = await query.limit(200);
    if (error) throw error;

    const rows = (data || []).filter((item) => isAdmin(ctx.profile) || item.product?.partner_id === ctx.user.id);
    const gross = rows.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
    const commissionRate = 0.12;

    return {
      ok: true,
      gross,
      commissionRate,
      commissionAmount: Number((gross * commissionRate).toFixed(2)),
      partnerNet: Number((gross * (1 - commissionRate)).toFixed(2)),
      itemCount: rows.length
    };
  });

  app.get("/v1/partner/os", async (request) => {
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      action: "partner.os.overview"
    });
    const business = await ensurePartnerBusiness(ctx, request);
    const ownerId = business.owner_id || ctx.user.id;
    const isAdminUser = isAdmin(ctx.profile);

    const [
      productsResult,
      ordersResult,
      locationsResult,
      devicesResult,
      qrCodesResult,
      intentsResult,
      transactionsResult,
      payoutsResult,
      ticketsResult
    ] = await Promise.all([
      supabaseAdmin
        .from("products")
        .select("*")
        .eq("partner_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("orders")
        .select("*, order_items(*, product:products(id, name, category, partner_id))")
        .order("created_at", { ascending: false })
        .limit(120),
      supabaseAdmin
        .from("partner_locations")
        .select("*")
        .eq("partner_id", business.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("partner_devices")
        .select("*")
        .eq("partner_id", business.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("partner_qr_codes")
        .select("*")
        .eq("partner_id", business.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("partner_payment_intents")
        .select("*")
        .eq("partner_id", business.id)
        .order("created_at", { ascending: false })
        .limit(120),
      supabaseAdmin
        .from("partner_transactions")
        .select("*")
        .eq("partner_id", business.id)
        .order("occurred_at", { ascending: false })
        .limit(120),
      supabaseAdmin
        .from("partner_payouts")
        .select("*")
        .eq("partner_id", business.id)
        .order("period_end", { ascending: false })
        .limit(24),
      supabaseAdmin
        .from("partner_support_tickets")
        .select("*")
        .eq("partner_id", business.id)
        .order("created_at", { ascending: false })
        .limit(80)
    ]);

    const results = [productsResult, ordersResult, locationsResult, devicesResult, qrCodesResult, intentsResult, transactionsResult, payoutsResult, ticketsResult];
    const firstError = results.find((result) => result.error)?.error;
    if (firstError) throw firstError;

    const orders = summarizePartnerOrders(ordersResult.data || [], ownerId, isAdminUser);
    const metrics = partnerMetrics({
      business,
      products: productsResult.data || [],
      orders,
      paymentIntents: intentsResult.data || [],
      transactions: transactionsResult.data || [],
      payouts: payoutsResult.data || [],
      tickets: ticketsResult.data || []
    });

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "partner.os_viewed",
      resourceType: "partner_business",
      resourceId: business.id,
      metadata: { product_count: metrics.product_count, order_count: metrics.order_count }
    });

    return {
      ok: true,
      business,
      products: productsResult.data || [],
      orders,
      locations: locationsResult.data || [],
      devices: devicesResult.data || [],
      qrCodes: qrCodesResult.data || [],
      paymentIntents: intentsResult.data || [],
      transactions: transactionsResult.data || [],
      payouts: payoutsResult.data || [],
      tickets: ticketsResult.data || [],
      metrics,
      recommendations: partnerRecommendations(metrics, devicesResult.data || [])
    };
  });

  app.patch("/v1/partner/profile", async (request) => {
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      action: "partner.profile.update"
    });
    const business = await ensurePartnerBusiness(ctx, request);
    const payload = partnerProfileUpdateSchema.parse(request.body || {});
    const { data, error } = await supabaseAdmin
      .from("partner_businesses")
      .update(payload)
      .eq("id", business.id)
      .select("*")
      .single();
    if (error) throw error;

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "partner.profile_updated",
      resourceType: "partner_business",
      resourceId: business.id,
      metadata: { updated_fields: Object.keys(payload) }
    });
    return { ok: true, business: data };
  });

  app.post("/v1/partner/payment-intents", async (request, reply) => {
    assertPaymentsEnabled();
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      action: "partner.payment_intent.create"
    });
    const business = await ensurePartnerBusiness(ctx, request);
    const payload = partnerPaymentIntentSchema.parse(request.body || {});
    const provider = partnerProviderForChannel(payload.channel, payload.provider);
    const status = payload.channel === "cash" ? "paid" : payload.channel === "nfc" ? "provider_pending" : "awaiting_payment";
    const expiresAt = new Date(Date.now() + payload.expires_in_minutes * 60 * 1000).toISOString();

    const { data: intent, error } = await supabaseAdmin
      .from("partner_payment_intents")
      .insert({
        partner_id: business.id,
        location_id: payload.location_id || null,
        device_id: payload.device_id || null,
        order_id: payload.order_id || null,
        created_by: ctx.user.id,
        channel: payload.channel,
        provider,
        amount: Number(payload.amount.toFixed(2)),
        currency: payload.currency.toUpperCase(),
        description: payload.description || `${business.display_name} ödeme isteği`,
        customer_name: payload.customer_name || null,
        customer_phone: payload.customer_phone || null,
        customer_email: payload.customer_email || null,
        status,
        expires_at: expiresAt,
        metadata: {
          source: "partner_os",
          public_status_label: partnerPaymentStatusLabel(status),
          nfc_note: payload.channel === "nfc"
            ? "NFC tahsilat sertifikalı SoftPOS sağlayıcısı üzerinden tamamlanır."
            : null
        }
      })
      .select("*")
      .single();
    if (error) throw error;

    const publicParams = new URLSearchParams({
      intent: intent.id,
      amount: String(intent.amount),
      channel: intent.channel,
      partner: business.display_name || business.legal_name || "AllonaHub Partner"
    });
    const publicUrl = `${publicPaymentBaseUrl(request)}/pages/partner/pay.html?${publicParams.toString()}`;
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("partner_payment_intents")
      .update({
        payment_url: publicUrl,
        qr_payload: publicUrl,
        paid_at: payload.channel === "cash" ? new Date().toISOString() : null
      })
      .eq("id", intent.id)
      .select("*")
      .single();
    if (updateError) throw updateError;

    if (payload.channel === "cash") {
      const commissionRate = Number(business.default_commission_rate || 0.12);
      const gross = Number(payload.amount.toFixed(2));
      const commissionAmount = Number((gross * commissionRate).toFixed(2));
      const { error: transactionError } = await supabaseAdmin
        .from("partner_transactions")
        .insert({
          partner_id: business.id,
          payment_intent_id: intent.id,
          order_id: payload.order_id || null,
          transaction_type: "payment",
          channel: payload.channel,
          provider,
          gross_amount: gross,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          net_amount: Number((gross - commissionAmount).toFixed(2)),
          currency: payload.currency.toUpperCase(),
          status: "paid",
          metadata: { source: "partner_os_cash_record" }
        });
      if (transactionError) throw transactionError;
    }

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "partner.payment_intent_created",
      resourceType: "partner_payment_intent",
      resourceId: updated.id,
      metadata: { channel: payload.channel, provider, amount: payload.amount }
    });

    return reply.code(201).send({ ok: true, paymentIntent: updated });
  });

  app.post("/v1/partner/support-tickets", async (request, reply) => {
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      action: "partner.support_ticket.create"
    });
    const business = await ensurePartnerBusiness(ctx, request);
    const payload = partnerSupportTicketSchema.parse(request.body || {});
    const { data, error } = await supabaseAdmin
      .from("partner_support_tickets")
      .insert({
        partner_id: business.id,
        created_by: ctx.user.id,
        category: payload.category,
        priority: payload.priority,
        title: payload.title,
        message: payload.message
      })
      .select("*")
      .single();
    if (error) throw error;

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "partner.support_ticket_created",
      resourceType: "partner_support_ticket",
      resourceId: data.id,
      metadata: { category: payload.category, priority: payload.priority }
    });
    return reply.code(201).send({ ok: true, ticket: data });
  });

  app.patch("/v1/partner/orders/status", async (request) => {
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      action: "partner.order.status_update"
    });
    const payload = partnerOrderStatusSchema.parse(request.body || {});
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, order_status, tracking_number, order_items(product:products(id, partner_id))")
      .eq("id", payload.orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) throw httpError("Sipariş bulunamadı.", 404);
    const canUpdate = isAdmin(ctx.profile) || (order.order_items || []).some((item) => item.product?.partner_id === ctx.user.id);
    if (!canUpdate) throw httpError("Bu siparişi güncelleme yetkiniz yok.", 403);

    const updatePayload = {};
    if (payload.order_status) updatePayload.order_status = payload.order_status;
    if (Object.prototype.hasOwnProperty.call(payload, "tracking_number")) updatePayload.tracking_number = payload.tracking_number || null;
    const { data: updated, error } = await supabaseAdmin
      .from("orders")
      .update(updatePayload)
      .eq("id", payload.orderId)
      .select("*")
      .single();
    if (error) throw error;

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "partner.order_status_updated",
      resourceType: "order",
      resourceId: payload.orderId,
      metadata: updatePayload
    });
    return { ok: true, order: updated };
  });

  app.post("/v1/hp-wallet/ledger", async (request) => {
    const ctx = await requireAuth(request, {
      roles: ["admin", "super_admin"],
      mfa: true,
      adminBoundary: true,
      action: "hp_wallet.ledger"
    });
    const body = z.object({
      userId: uuidSchema.optional(),
      amount: z.coerce.number().min(-100000).max(100000),
      reason: z.string().trim().min(2).max(180),
      reference: z.string().trim().max(120).optional()
    }).parse(request.body || {});

    const targetUserId = body.userId || ctx.user.id;
    const { error } = await supabaseAdmin
      .from("admin_notifications")
      .insert({
        user_id: targetUserId,
        kind: "hp_wallet_ledger",
        severity: "info",
        title: "HP Wallet işlem kaydı",
        message: body.reason,
        metadata: {
          amount: body.amount,
          reference: body.reference || "",
          requested_by: ctx.user.id
        }
      });
    if (error) throw error;
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "hp_wallet.ledger_recorded",
      resourceType: "user",
      resourceId: targetUserId,
      severity: "warning",
      metadata: { amount: body.amount, reference: body.reference || "" }
    });
    return { ok: true };
  });

  app.post("/v1/cron/reconcile-payments", async (request) => {
    if (!config.cronSecret || request.headers["x-cron-secret"] !== config.cronSecret) {
      await auditEvent({
        request,
        action: "cron.reconcile_denied",
        severity: "critical",
        metadata: { path: request.url.split("?")[0] }
      });
      const error = new Error("Cron yetkisi doğrulanamadı.");
      error.statusCode = 401;
      throw error;
    }

    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_no, payment_status, created_at")
      .in("payment_status", ["pending", "awaiting_payment"])
      .lt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .limit(100);
    if (error) throw error;

    return {
      ok: true,
      checked: data?.length || 0,
      staleOrders: data || []
    };
  });

  app.post("/v1/admin/legal/authority-requests", async (request, reply) => {
    const ctx = await requireAuth(request, {
      roles: ["admin", "super_admin"],
      mfa: true,
      adminBoundary: true,
      action: "admin.legal.authority_request.create"
    });
    const payload = authorityRequestSchema.parse(request.body || {});
    const { data, error } = await supabaseAdmin
      .from("authority_disclosure_requests")
      .insert({
        authority_type: payload.authority_type,
        reference_no: payload.reference_no,
        requester_name: payload.requester_name || null,
        requester_title: payload.requester_title || null,
        contact_channel: payload.contact_channel || null,
        legal_basis: payload.legal_basis,
        scope_summary: payload.scope_summary,
        due_at: payload.due_at || null,
        opened_by: ctx.user.id,
        metadata: payload.metadata
      })
      .select("*")
      .single();
    if (error) throw error;

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "admin.legal.authority_request_registered",
      resourceType: "authority_disclosure_request",
      resourceId: data.id,
      severity: "warning",
      source: "admin",
      purpose: "public_authority_request_management",
      evidenceTags: ["legal_request", payload.authority_type],
      metadata: {
        authority_type: payload.authority_type,
        reference_no: payload.reference_no,
        scope_summary: payload.scope_summary
      }
    });

    return reply.code(201).send({ ok: true, authorityRequest: data });
  });

  app.post("/v1/admin/legal/evidence-report", async (request, reply) => {
    const ctx = await requireAuth(request, {
      roles: ["admin", "super_admin"],
      mfa: true,
      adminBoundary: true,
      action: "admin.legal.evidence_report.generate"
    });
    const payload = evidenceReportSchema.parse(request.body || {});
    assertEvidenceWindow(payload.from, payload.to);

    if (payload.request_id) {
      const { data: authorityRequest, error: requestError } = await supabaseAdmin
        .from("authority_disclosure_requests")
        .select("id, status")
        .eq("id", payload.request_id)
        .maybeSingle();
      if (requestError) throw requestError;
      if (!authorityRequest) throw httpError("Resmi makam talep kaydı bulunamadı.", 404);
    }

    const events = await queryEvidenceEvents(payload);
    const filters = evidenceFilters(payload);
    const firstEvent = events[0] || null;
    const lastEvent = events[events.length - 1] || null;
    const generatedAt = new Date().toISOString();
    const exportPayload = {
      generated_at: generatedAt,
      generated_by: ctx.user.id,
      case_reference: payload.case_reference,
      legal_basis: payload.legal_basis,
      purpose: payload.purpose,
      request_id: payload.request_id || null,
      filters,
      events
    };
    const exportHash = sha256Json(exportPayload);

    const { data: exportRow, error: exportError } = await supabaseAdmin
      .from("authority_disclosure_exports")
      .insert({
        request_id: payload.request_id || null,
        case_reference: payload.case_reference,
        legal_basis: payload.legal_basis,
        purpose: payload.purpose,
        filters,
        event_count: events.length,
        first_event_at: firstEvent?.created_at || null,
        last_event_at: lastEvent?.created_at || null,
        first_event_hash: firstEvent?.event_hash || null,
        last_event_hash: lastEvent?.event_hash || null,
        export_hash: exportHash,
        generated_by: ctx.user.id,
        metadata: {
          generated_at: generatedAt,
          request_id: payload.request_id || null
        }
      })
      .select("*")
      .single();
    if (exportError) throw exportError;

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "admin.legal.evidence_report_generated",
      resourceType: "authority_disclosure_export",
      resourceId: exportRow.id,
      severity: "warning",
      source: "admin",
      purpose: "public_authority_disclosure",
      evidenceTags: ["legal_export", "chain_of_custody"],
      metadata: {
        case_reference: payload.case_reference,
        request_id: payload.request_id || null,
        event_count: events.length,
        export_hash: exportHash,
        filters
      }
    });

    return reply.code(201).send({
      ok: true,
      report: {
        ...exportPayload,
        chain_of_custody: {
          export_id: exportRow.id,
          export_hash: exportHash,
          event_count: events.length,
          first_event_id: firstEvent?.id || null,
          last_event_id: lastEvent?.id || null,
          first_event_hash: firstEvent?.event_hash || null,
          last_event_hash: lastEvent?.event_hash || null,
          hash_algorithm: "sha256",
          note: "event_hash alanları veritabanındaki append-only audit zincirinden gelir; export_hash bu rapor gövdesinin SHA-256 özetidir."
        }
      }
    });
  });

  app.get("/v1/admin/security/audit-events", async (request) => {
    const ctx = await requireAuth(request, {
      roles: ["admin", "super_admin"],
      mfa: true,
      adminBoundary: true,
      action: "admin.security.audit_events"
    });
    const query = auditQuerySchema.parse(request.query || {});
    let dbQuery = supabaseAdmin
      .from("security_audit_events")
      .select([
        "id",
        "actor_id",
        "actor_role",
        "action",
        "resource_type",
        "resource_id",
        "severity",
        "ip_address",
        "user_agent",
        "request_id",
        "source",
        "purpose",
        "location_basis",
        "geo_country",
        "geo_region",
        "geo_city",
        "geo_latitude",
        "geo_longitude",
        "geo_accuracy_m",
        "previous_hash",
        "event_hash",
        "evidence_tags",
        "metadata",
        "created_at"
      ].join(", "))
      .order("created_at", { ascending: false })
      .limit(query.limit);
    if (query.severity) dbQuery = dbQuery.eq("severity", query.severity);
    if (query.actorId) dbQuery = dbQuery.eq("actor_id", query.actorId);
    if (query.action) dbQuery = dbQuery.eq("action", query.action);
    if (query.resourceType) dbQuery = dbQuery.eq("resource_type", query.resourceType);
    if (query.resourceId) dbQuery = dbQuery.eq("resource_id", query.resourceId);
    if (query.from) dbQuery = dbQuery.gte("created_at", query.from);
    if (query.to) dbQuery = dbQuery.lte("created_at", query.to);

    const { data, error } = await dbQuery;
    if (error) throw error;
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "admin.security.audit_events_viewed",
      resourceType: "security_audit_events",
      evidenceTags: ["admin_review", "audit_view"],
      metadata: {
        limit: query.limit,
        severity: query.severity || "all",
        actor_id: query.actorId || null,
        action: query.action || null,
        resource_type: query.resourceType || null,
        resource_id: query.resourceId || null,
        from: query.from || null,
        to: query.to || null
      }
    });
    return { ok: true, events: data || [] };
  });

  app.get("/v1/admin/security/auto-defense", async (request) => {
    const ctx = await requireAuth(request, {
      roles: ["admin", "super_admin"],
      mfa: true,
      adminBoundary: true,
      action: "admin.security.auto_defense"
    });
    const status = autoDefenseStatus();
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "admin.security.auto_defense_viewed",
      resourceType: "auto_defense",
      metadata: {
        blocked_ip_count: status.blockedIpCount,
        recent_incident_count: status.recentIncidents.length
      }
    });
    return { ok: true, autoDefense: status };
  });
}
