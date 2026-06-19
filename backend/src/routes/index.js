import { z } from "zod";
import { config } from "../config.js";
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
import { cvCheckoutPayload, iyzicoPost, orderCheckoutPayload } from "../lib/iyzico.js";

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

const cvCheckoutSchema = z.object({
  buyerEmail: emailSchema.optional(),
  buyerPhone: phoneSchema
});

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  severity: z.enum(["debug", "info", "warning", "critical"]).optional()
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

  app.all("/v1/payments/iyzico/callback", async (request, reply) => {
    assertPaymentsEnabled();
    const payload = await bodyOrQuery(request);
    const token = String(payload.token || "").trim();
    const orderId = payload.orderId ? uuidSchema.parse(payload.orderId) : "";
    const cvPaymentId = payload.cvPaymentId ? uuidSchema.parse(payload.cvPaymentId) : "";

    if (!token || token.length > 500 || (!orderId && !cvPaymentId)) {
      await auditEvent({
        request,
        action: "payment.callback_invalid",
        severity: "critical",
        metadata: { provider: "iyzico", has_order_id: Boolean(orderId), has_cv_payment_id: Boolean(cvPaymentId) }
      });
      return reply.code(400).send({ ok: false, message: "Ödeme referansı doğrulanamadı." });
    }

    const { ok, result } = await queryIyzicoCheckoutDetail(token, cvPaymentId || orderId || token);
    const paymentStatus = ok && result.status === "success" && result.paymentStatus === "SUCCESS" ? "paid" : "failed";
    await auditEvent({
      request,
      action: "payment.callback_verified",
      resourceType: cvPaymentId ? "cv_payment" : "order",
      resourceId: cvPaymentId || orderId,
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

      return redirect(reply, `${config.siteUrl}/career-cv-form.html?payment=${paymentStatus}`);
    }

    const orderStatus = paymentStatus === "paid" ? "confirmed" : "pending";
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ payment_status: paymentStatus, order_status: orderStatus })
      .eq("id", orderId);
    if (error) throw error;

    return redirect(reply, `${config.siteUrl}/orders.html?payment=${paymentStatus}`);
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
      .select("id, actor_id, actor_role, action, resource_type, resource_id, severity, ip_address, request_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(query.limit);
    if (query.severity) dbQuery = dbQuery.eq("severity", query.severity);

    const { data, error } = await dbQuery;
    if (error) throw error;
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "admin.security.audit_events_viewed",
      resourceType: "security_audit_events",
      metadata: { limit: query.limit, severity: query.severity || "all" }
    });
    return { ok: true, events: data || [] };
  });
}
