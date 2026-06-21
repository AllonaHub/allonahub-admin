import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();
const SECRET_ENV_NAMES = new Set([
  "SUPABASE_SERVICE_ROLE_KEY",
  "IYZICO_API_KEY",
  "IYZICO_SECRET_KEY"
]);

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
  if (!value) {
    throw new Error(SECRET_ENV_NAMES.has(name) ? "Required server secret is missing" : `${name} is not configured.`);
  }
  return value;
}

function safeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: "Error", message: "Unknown error" };
}

function safeIyzicoResult(result: Record<string, unknown>) {
  return {
    status: result.status,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
    paymentStatus: result.paymentStatus
  };
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
    return new Response("ok", { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed" }, 405);
  }

  try {
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 12000) return json(req, { error: "Request body is too large" }, 413);
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
      return json(req, { error: "Unauthorized" }, 401);
    }

    const bodyData = await req.json().catch(() => ({}));
    const identityNumber = "11111111111";
    const buyerEmail = String(bodyData.buyerEmail || authData.user.email || "");
    const buyerPhone = String(bodyData.buyerPhone || authData.user.phone || "");
    if (buyerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(buyerEmail)) {
      return json(req, { error: "Invalid buyer information" }, 400);
    }
    if (buyerPhone && buyerPhone.replace(/\D/g, "").length > 15) {
      return json(req, { error: "Invalid buyer information" }, 400);
    }

    const { count: recentCount, error: recentError } = await admin
      .from("cv_payments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authData.user.id)
      .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
    if (recentError) throw recentError;
    if (Number(recentCount || 0) >= 5) {
      return json(req, { error: "Çok sık ödeme denemesi yapıldı. Lütfen biraz bekleyin." }, 429);
    }

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
      console.error("CV iyzico checkout failed", { cvPaymentId: payment.id, result: safeIyzicoResult(result) });
      return json(req, { error: "CV ödeme oturumu başlatılamadı." }, 400);
    }

    await admin
      .from("cv_payments")
      .update({
        status: "awaiting_payment",
        iyzico_token: result.token || null
      })
      .eq("id", payment.id);

    return json(req, {
      paymentPageUrl: result.paymentPageUrl,
      token: result.token,
      cvPaymentId: payment.id
    });
  } catch (error) {
    console.error("create-cv-checkout failed", safeError(error));
    return json(req, { error: "CV ödeme işlemi şu anda başlatılamadı." }, 500);
  }
});
