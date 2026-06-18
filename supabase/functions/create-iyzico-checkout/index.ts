import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const encoder = new TextEncoder();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
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
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
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
      return json({ error: "Unauthorized" }, 401);
    }

    const { orderId, buyer = {} } = await req.json();
    if (!orderId) return json({ error: "orderId is required" }, 400);
    if (!buyer.identityNumber) return json({ error: "identityNumber is required" }, 400);

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
    if (!order) return json({ error: "Order not found" }, 404);

    const adminRoles = ["admin", "super_admin"];
    if (order.user_id !== authData.user.id && !adminRoles.includes(profile?.role)) {
      return json({ error: "Forbidden" }, 403);
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
        identityNumber: String(buyer.identityNumber),
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
      await admin.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
      return json({ error: result.errorMessage || "iyzico checkout could not be initialized", details: result }, 400);
    }

    await admin
      .from("orders")
      .update({
        payment_status: "awaiting_payment"
      })
      .eq("id", order.id);

    return json({
      paymentPageUrl: result.paymentPageUrl,
      token: result.token
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
