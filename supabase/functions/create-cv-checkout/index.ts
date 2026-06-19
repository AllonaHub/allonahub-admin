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
  const parts = String(fullName || "Allona CV Müşteri").trim().split(/\s+/);
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
    const cvPrice = amount(Deno.env.get("CV_PRICE_TRY") || "149.99");

    const admin = createClient(supabaseUrl, serviceKey);
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !authData.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const bodyData = await req.json().catch(() => ({}));
    const identityNumber = "11111111111";
    const buyerEmail = String(bodyData.buyerEmail || authData.user.email || "");
    const buyerPhone = String(bodyData.buyerPhone || authData.user.phone || "");

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, phone")
      .eq("id", authData.user.id)
      .maybeSingle();

    const { data: payment, error: paymentError } = await admin
      .from("cv_payments")
      .insert({
        user_id: authData.user.id,
        amount: cvPrice,
        currency: "TRY",
        status: "pending"
      })
      .select("*")
      .single();
    if (paymentError) throw paymentError;

    const { name, surname } = splitName(profile?.full_name || authData.user.email || "");
    const uriPath = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
    const callbackUrl = `${callbackUrlBase}?cvPaymentId=${encodeURIComponent(payment.id)}`;

    const iyzicoPayload = {
      locale: "tr",
      conversationId: payment.id,
      price: cvPrice,
      paidPrice: cvPrice,
      currency: "TRY",
      basketId: `CV-${payment.id}`,
      paymentGroup: "PRODUCT",
      callbackUrl,
      enabledInstallments: [1, 2, 3, 6, 9],
      buyer: {
        id: authData.user.id,
        name,
        surname,
        identityNumber,
        email: buyerEmail || authData.user.email,
        gsmNumber: buyerPhone || profile?.phone || "",
        registrationAddress: "AllonaHub Dijital CV",
        city: "İstanbul",
        country: "Turkey",
        zipCode: "34000",
        ip: req.headers.get("x-forwarded-for") || "0.0.0.0"
      },
      shippingAddress: {
        address: "AllonaHub Dijital CV",
        zipCode: "34000",
        contactName: `${name} ${surname}`,
        city: "İstanbul",
        country: "Turkey"
      },
      billingAddress: {
        address: "AllonaHub Dijital CV",
        zipCode: "34000",
        contactName: `${name} ${surname}`,
        city: "İstanbul",
        country: "Turkey"
      },
      basketItems: [
        {
          id: `cv-credit-${payment.id}`,
          price: cvPrice,
          name: "AllonaHub Akıllı CV Üretim Kredisi",
          category1: "Kariyer",
          itemType: "VIRTUAL"
        }
      ]
    };

    const requestBody = JSON.stringify(iyzicoPayload);
    const auth = await iyzicoAuthorization(apiKey, secretKey, uriPath, requestBody);
    const response = await fetch(`${iyzicoBaseUrl}${uriPath}`, {
      method: "POST",
      headers: {
        "Authorization": auth.authorization,
        "x-iyzi-rnd": auth.randomKey,
        "Content-Type": "application/json"
      },
      body: requestBody
    });

    const result = await response.json();
    if (!response.ok || result.status !== "success") {
      await admin.from("cv_payments").update({ status: "failed" }).eq("id", payment.id);
      return json({ error: result.errorMessage || "CV payment checkout could not be initialized", details: result }, 400);
    }

    await admin
      .from("cv_payments")
      .update({
        status: "awaiting_payment",
        iyzico_token: result.token || null
      })
      .eq("id", payment.id);

    return json({
      paymentPageUrl: result.paymentPageUrl,
      token: result.token,
      cvPaymentId: payment.id
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
