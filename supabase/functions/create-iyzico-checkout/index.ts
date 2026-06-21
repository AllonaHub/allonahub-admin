import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();

function allowedOrigin(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const configured = (Deno.env.get("ALLOWED_ORIGINS") || Deno.env.get("SITE_URL") || "https://allonahub.com")
    .split(",")
    .map((item) => item.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const local = ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"];
  const allowList = [...configured, ...local];
  return allowList.includes(origin.replace(/\/$/, "")) ? origin : configured[0] || "https://allonahub.com";
}

function corsHeaders(req: Request) {
  return {
    "Access-Control-Allow-Origin": allowedOrigin(req),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" }
  });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} secret is not configured.`);
  return value;
}

function amount(value: unknown) {
  return Number(Number(value || 0).toFixed(2));
}

function legacyOrderPayload(payload: Record<string, unknown>) {
  const next = { ...payload };
  delete next.status;
  if (next.order_status === "awaiting_payment") next.order_status = "pending";
  if (next.order_status === "paid") next.order_status = "confirmed";
  return next;
}

function shouldRetryLegacyOrderUpdate(error: unknown) {
  const message = String((error as { message?: string })?.message || error || "");
  return /status|order_status|schema cache|invalid input value/i.test(message);
}

async function updateOrder(admin: ReturnType<typeof createClient>, orderId: string, payload: Record<string, unknown>) {
  const { error } = await admin.from("orders").update(payload).eq("id", orderId);
  if (!error) return;
  if (!shouldRetryLegacyOrderUpdate(error)) throw error;
  const retry = await admin.from("orders").update(legacyOrderPayload(payload)).eq("id", orderId);
  if (retry.error) throw retry.error;
}

function splitName(fullName: string) {
  const parts = String(fullName || "Allona Müşteri").trim().split(/\s+/);
  const name = parts.shift() || "Allona";
  const surname = parts.join(" ") || "Müşteri";
  return { name, surname };
}

async function hmacSha256Hex(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function iyzicoAuthorization(apiKey: string, secretKey: string, uriPath: string, body: string) {
  const randomKey = `${Date.now()}${crypto.getRandomValues(new Uint32Array(1))[0]}`;
  const signature = await hmacSha256Hex(`${randomKey}${uriPath}${body}`, secretKey);
  const authorizationString = `apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`;
  return {
    randomKey,
    authorization: `IYZWSv2 ${btoa(authorizationString)}`
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed" }, 405);
  }

  try {
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 20000) return json(req, { error: "Request body is too large" }, 413);
    const supabaseUrl = env("SUPABASE_URL");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const apiKey = env("IYZICO_API_KEY");
    const secretKey = env("IYZICO_SECRET_KEY");
    const iyzicoBaseUrl = Deno.env.get("IYZICO_BASE_URL") || "https://sandbox-api.iyzipay.com";
    const callbackUrlBase = Deno.env.get("IYZICO_CALLBACK_URL") || `${supabaseUrl}/functions/v1/iyzico-callback`;

    const admin = createClient(supabaseUrl, serviceKey);
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !authData.user) {
      return json(req, { error: "Unauthorized" }, 401);
    }

    const { orderId, buyer = {} } = await req.json().catch(() => ({}));
    if (!orderId || !/^[0-9a-f-]{36}$/i.test(String(orderId))) return json(req, { error: "Invalid order" }, 400);
    const identityNumber = String(buyer.identityNumber || "11111111111").replace(/\D/g, "") || "11111111111";

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return json(req, { error: "Order not found" }, 404);

    const adminRoles = ["admin", "super_admin"];
    if (order.user_id !== authData.user.id && !adminRoles.includes(profile?.role)) {
      return json(req, { error: "Forbidden" }, 403);
    }

    const shipping = order.shipping_address || {
      address: order.address,
      city: order.city
    };
    const billing = order.billing_address || shipping;
    const { name, surname } = splitName(order.customer_name);
    const uriPath = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
    const callbackUrl = `${callbackUrlBase}?orderId=${encodeURIComponent(order.id)}`;

    const iyzicoPayload = {
      locale: "tr",
      conversationId: order.id,
      price: amount(order.subtotal),
      paidPrice: amount(order.total_amount ?? order.total),
      currency: "TRY",
      basketId: order.order_no || order.order_number || order.id,
      paymentGroup: "PRODUCT",
      callbackUrl,
      enabledInstallments: [1, 2, 3, 6, 9],
      buyer: {
        id: authData.user.id,
        name,
        surname,
        identityNumber,
        email: order.customer_email,
        gsmNumber: order.customer_phone || "",
        registrationAddress: shipping.address || "",
        city: shipping.city || "İstanbul",
        country: "Turkey",
        zipCode: shipping.zip_code || "34000",
        ip: buyer.ip || req.headers.get("x-forwarded-for") || "0.0.0.0"
      },
      shippingAddress: {
        address: shipping.address || "",
        zipCode: shipping.zip_code || "34000",
        contactName: order.customer_name,
        city: shipping.city || "İstanbul",
        country: "Turkey"
      },
      billingAddress: {
        address: billing.address || shipping.address || "",
        zipCode: shipping.zip_code || "34000",
        contactName: order.customer_name,
        city: billing.city || shipping.city || "İstanbul",
        country: "Turkey"
      },
      basketItems: (order.order_items || []).map((item: Record<string, unknown>) => {
        const quantity = Number(item.quantity || 1);
        const unitPrice = Number(item.price || item.unit_price || 0);
        const totalPrice = item.total_price ?? unitPrice * quantity;
        return {
          id: String(item.product_id || item.id),
          price: amount(totalPrice),
          name: String(item.product_name || "AllonaHub Ürün"),
          category1: String((item.product_snapshot as Record<string, unknown> | null)?.category || "Genel"),
          itemType: "PHYSICAL"
        };
      })
    };

    const body = JSON.stringify(iyzicoPayload);
    const auth = await iyzicoAuthorization(apiKey, secretKey, uriPath, body);
    const response = await fetch(`${iyzicoBaseUrl}${uriPath}`, {
      method: "POST",
      headers: {
        "Authorization": auth.authorization,
        "x-iyzi-rnd": auth.randomKey,
        "Content-Type": "application/json"
      },
      body
    });

    const result = await response.json();
    if (!response.ok || result.status !== "success") {
      await updateOrder(admin, order.id, {
        payment_status: "failed",
        status: "pending",
        order_status: "pending"
      });
      console.error("iyzico checkout failed", { orderId: order.id, result });
      return json(req, { error: "Ödeme oturumu başlatılamadı." }, 400);
    }

    await updateOrder(admin, order.id, {
      payment_status: "awaiting_payment",
      status: "awaiting_payment",
      order_status: "awaiting_payment"
    });

    return json(req, {
      paymentPageUrl: result.paymentPageUrl,
      token: result.token
    });
  } catch (error) {
    console.error("create-iyzico-checkout failed", error);
    return json(req, { error: "Ödeme işlemi şu anda başlatılamadı." }, 500);
  }
});
