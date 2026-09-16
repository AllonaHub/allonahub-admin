import crypto from "node:crypto";
import { z } from "zod";
import { config } from "../config.js";
import { bankPaymentPost, maritimePdfCheckoutPayload } from "../lib/bank-payment-provider.js";
import { ensureMaritimeCustomerProfile } from "../lib/maritime-customer-profile.js";
import { isValidImoNumber, lookupVesselByImo, normalizeImoNumber } from "../lib/maritime-vessel-provider.js";
import { auditEvent, authContext, supabaseAdmin } from "../lib/supabase.js";

const productSchema = z.enum(["maritime_cv_pdf", "global_cv_pdf"]);
const checkoutSchema = z.object({ product: productSchema }).strict();
const authorizeSchema = z.object({
  product: productSchema,
  idempotency_key: z.string().uuid()
}).strict();
const imoParamsSchema = z.object({ imo: z.string().trim().max(24) }).strict();

function httpError(message, statusCode = 400, code = "MARITIME_COMMERCE_REQUEST_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.exposeCode = true;
  return error;
}

function assertDb(result, message) {
  if (result.error) throw httpError(message, 503, "MARITIME_COMMERCE_DATABASE_ERROR");
  return result.data;
}

function parseRpcJson(value, message) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      throw httpError(message, 503, "MARITIME_COMMERCE_DATABASE_ERROR");
    }
  }
  return value || {};
}

function deviceKey(request) {
  const value = String(request.headers["x-allona-device-key"] || "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(value)) {
    throw httpError("Güvenli cihaz tanımlaması tamamlanamadı.", 400, "MARITIME_DEVICE_KEY_REQUIRED");
  }
  return value;
}

async function requireCustomer(request, action) {
  const ctx = await authContext(request);
  if (!ctx?.user) throw httpError("Oturum doğrulanamadı.", 401, "AUTH_REQUIRED");
  await ensureMaritimeCustomerProfile(ctx);
  const access = await supabaseAdmin.rpc("maritime_check_device_access", {
    p_user_id: ctx.user.id,
    p_device_key: deviceKey(request)
  });
  const result = parseRpcJson(assertDb(access, "Cihaz erişimi doğrulanamadı."), "Cihaz erişimi doğrulanamadı.");
  if (result.allowed !== true) {
    throw httpError("Bu cihaz başka bir hesaba bağlıdır veya güvenli cihaz kaydı tamamlanmamıştır.", 409, result.code || "MARITIME_DEVICE_BINDING_REQUIRED");
  }
  await supabaseAdmin.from("maritime_premium_memberships").upsert({ user_id: ctx.user.id }, { onConflict: "user_id", ignoreDuplicates: true });
  return ctx;
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

async function sourceVersion(userId, product) {
  if (product === "maritime_cv_pdf") {
    const profile = assertDb(await supabaseAdmin
      .from("maritime_cv_profiles")
      .select("profile_payload,updated_at")
      .eq("seafarer_user_id", userId)
      .maybeSingle(), "Maritime CV sürümü okunamadı.");
    if (!profile) throw httpError("Önce Maritime CV'nizi kaydedin.", 409, "MARITIME_CV_REQUIRED");
    return sha256(`${profile.updated_at || ""}:${JSON.stringify(profile.profile_payload || {})}`);
  }

  const run = assertDb(await supabaseAdmin
    .from("maritime_smart_account_runs")
    .select("id,input_snapshot_hash,smart_snapshot,updated_at")
    .eq("seafarer_user_id", userId)
    .in("status", ["draft", "user_confirmed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle(), "Global CV sürümü okunamadı.");
  if (!run) throw httpError("Önce Global CV'nizi oluşturun.", 409, "GLOBAL_CV_REQUIRED");
  return String(run.input_snapshot_hash || sha256(`${run.updated_at || ""}:${JSON.stringify(run.smart_snapshot || {})}`));
}

function productPrice(settings, product) {
  return Number(product === "maritime_cv_pdf" ? settings.maritime_cv_pdf_price : settings.global_cv_pdf_price);
}

function productReturnPath(product) {
  return product === "global_cv_pdf"
    ? "/pages/ecosystem/maritime-smart-account.html?openCv=1"
    : "/pages/ecosystem/maritime-cv.html";
}

export function registerMaritimeCommerceRoutes(app) {
  app.get("/v1/maritime/commerce/status", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.commerce.status");
    const settings = assertDb(await supabaseAdmin
      .from("maritime_commerce_settings")
      .select("maritime_cv_pdf_price,global_cv_pdf_price,currency")
      .eq("singleton", true)
      .single(), "Denizcilik PDF fiyatları okunamadı.");
    const entitlements = assertDb(await supabaseAdmin
      .from("maritime_pdf_entitlements")
      .select("product,initial_downloads_remaining,refresh_downloads_remaining,last_download_source_version")
      .eq("user_id", ctx.user.id), "Denizcilik PDF hakları okunamadı.") || [];
    const totals = Object.fromEntries(["maritime_cv_pdf", "global_cv_pdf"].map((product) => {
      const rows = entitlements.filter((entry) => entry.product === product);
      return [product, {
        initial_downloads_remaining: rows.reduce((sum, entry) => sum + Number(entry.initial_downloads_remaining || 0), 0),
        refresh_downloads_remaining: rows.reduce((sum, entry) => sum + Number(entry.refresh_downloads_remaining || 0), 0)
      }];
    }));
    return {
      ok: true,
      currency: settings.currency,
      products: {
        maritime_cv_pdf: { price: productPrice(settings, "maritime_cv_pdf"), ...totals.maritime_cv_pdf },
        global_cv_pdf: { price: productPrice(settings, "global_cv_pdf"), ...totals.global_cv_pdf }
      }
    };
  });

  app.post("/v1/maritime/pdf-download/authorize", {
    config: { rateLimit: { max: 20, timeWindow: "10 minutes" } }
  }, async (request, reply) => {
    const ctx = await requireCustomer(request, "maritime.pdf_download.authorize");
    const input = authorizeSchema.parse(request.body || {});
    const currentSourceVersion = await sourceVersion(ctx.user.id, input.product);
    const rpc = await supabaseAdmin.rpc("consume_maritime_pdf_download", {
      p_user_id: ctx.user.id,
      p_product: input.product,
      p_source_version: currentSourceVersion,
      p_idempotency_key: input.idempotency_key
    });
    const result = parseRpcJson(assertDb(rpc, "PDF indirme hakkı doğrulanamadı."), "PDF indirme hakkı doğrulanamadı.");
    if (result.allowed !== true) {
      return reply.code(402).send({
        ok: false,
        error: "MARITIME_PDF_PAYMENT_REQUIRED",
        message: "Bu PDF indirmesi için ödeme gereklidir.",
        product: input.product,
        price: Number(result.price || 0),
        currency: result.currency || "USD"
      });
    }
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.pdf_download_authorized",
      resourceType: "maritime_pdf_download",
      resourceId: result.download_id,
      metadata: { product: input.product, access_source: result.access_source, source_version: currentSourceVersion }
    });
    return { ok: true, product: input.product, download_id: result.download_id, access_source: result.access_source };
  });

  app.post("/v1/maritime/pdf-checkout", {
    config: { rateLimit: { max: 5, timeWindow: "10 minutes" } }
  }, async (request) => {
    if (config.paymentsDisabled) throw httpError("Ödeme sistemi geçici olarak koruma modunda.", 503, "PAYMENTS_DISABLED");
    const ctx = await requireCustomer(request, "maritime.pdf_checkout");
    const input = checkoutSchema.parse(request.body || {});
    const settings = assertDb(await supabaseAdmin
      .from("maritime_commerce_settings")
      .select("maritime_cv_pdf_price,global_cv_pdf_price,currency")
      .eq("singleton", true)
      .single(), "Denizcilik PDF fiyatları okunamadı.");
    const amount = productPrice(settings, input.product);
    if (!Number.isFinite(amount) || amount <= 0 || settings.currency !== "USD") {
      throw httpError("PDF fiyatlandırması güvenli biçimde doğrulanamadı.", 503, "MARITIME_PDF_PRICE_INVALID");
    }
    const recent = await supabaseAdmin
      .from("maritime_pdf_payments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.user.id)
      .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
    assertDb(recent, "Ödeme deneme sınırı doğrulanamadı.");
    if (Number(recent.count || 0) >= 5) {
      throw httpError("Çok sık ödeme denemesi yapıldı. Lütfen biraz bekleyin.", 429, "MARITIME_PDF_CHECKOUT_RATE_LIMITED");
    }

    const payment = assertDb(await supabaseAdmin
      .from("maritime_pdf_payments")
      .insert({ user_id: ctx.user.id, product: input.product, amount, currency: "USD", status: "pending" })
      .select("*")
      .single(), "PDF ödeme kaydı oluşturulamadı.");
    const callbackUrl = `${config.apiUrl}/v1/payments/bank/callback?maritimePaymentId=${encodeURIComponent(payment.id)}`;
    const checkoutPayload = maritimePdfCheckoutPayload({
      payment,
      profile: ctx.profile,
      user: ctx.user,
      callbackUrl,
      ip: request.ip
    });

    try {
      const { ok, result } = await bankPaymentPost(config.bankPayment.checkoutPath, checkoutPayload);
      if (!ok || result.status !== "success" || !result.paymentPageUrl) {
        throw httpError("PDF ödeme oturumu başlatılamadı.", 400, "MARITIME_PDF_CHECKOUT_FAILED");
      }
      assertDb(await supabaseAdmin.from("maritime_pdf_payments").update({
        status: "awaiting_payment",
        provider_reference: result.token || null,
        provider_status: result.status || "initialized"
      }).eq("id", payment.id), "PDF ödeme kaydı güncellenemedi.");
      await auditEvent({
        request,
        actorId: ctx.user.id,
        actorRole: ctx.profile.role,
        action: "maritime.pdf_checkout_initialized",
        resourceType: "maritime_pdf_payment",
        resourceId: payment.id,
        metadata: { product: input.product, amount, currency: "USD" }
      });
      return {
        ok: true,
        paymentPageUrl: result.paymentPageUrl,
        token: result.token,
        maritimePaymentId: payment.id,
        product: input.product,
        amount,
        currency: "USD"
      };
    } catch (error) {
      await supabaseAdmin.from("maritime_pdf_payments").update({
        status: "failed",
        provider_status: String(error?.code || "checkout_failed").slice(0, 120)
      }).eq("id", payment.id);
      throw error;
    }
  });

  app.get("/v1/maritime/vessels/:imo", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } }
  }, async (request) => {
    const ctx = await requireCustomer(request, "maritime.vessel_lookup");
    const input = imoParamsSchema.parse(request.params || {});
    const imo = normalizeImoNumber(input.imo);
    if (!isValidImoNumber(imo)) {
      throw httpError("Geçerli, yedi haneli ve kontrol basamağı doğru bir IMO numarası girin.", 400, "MARITIME_IMO_INVALID");
    }
    const cached = assertDb(await supabaseAdmin
      .from("maritime_vessel_lookup_cache")
      .select("vessel_payload,fetched_at,expires_at")
      .eq("imo_number", imo)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle(), "IMO önbelleği okunamadı.");
    let vessel = cached?.vessel_payload || null;
    let cacheHit = Boolean(vessel);
    if (!vessel) {
      vessel = await lookupVesselByImo(imo);
      const fetchedAt = vessel.fetched_at || new Date().toISOString();
      const expiresAt = new Date(Date.parse(fetchedAt) + config.maritimeVesselLookup.cacheHours * 3600000).toISOString();
      assertDb(await supabaseAdmin.from("maritime_vessel_lookup_cache").upsert({
        imo_number: imo,
        provider: vessel.provider,
        vessel_payload: vessel,
        fetched_at: fetchedAt,
        expires_at: expiresAt
      }, { onConflict: "imo_number" }), "IMO önbelleği güncellenemedi.");
      cacheHit = false;
    }
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "maritime.vessel_lookup_completed",
      resourceType: "maritime_vessel",
      resourceId: null,
      metadata: { imo, provider: vessel.provider, cache_hit: cacheHit }
    });
    return { ok: true, vessel, cache_hit: cacheHit };
  });
}

export const maritimeCommerceInternals = Object.freeze({ sourceVersion, productReturnPath });
