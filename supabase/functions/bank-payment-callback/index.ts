import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();

function allowedOrigin(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const configured = (Deno.env.get("ALLOWED_ORIGINS") || Deno.env.get("SITE_URL") || "https://allonahub.com")
    .split(",")
    .map((item) => item.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const local = ["http://localhost:3000", "http://localhost:5173", "http://localhost:5176", "http://127.0.0.1:3000", "http://127.0.0.1:5173", "http://127.0.0.1:5176"];
  const allowList = [...configured, ...local];
  return allowList.includes(origin.replace(/\/$/, "")) ? origin : configured[0] || "https://allonahub.com";
}

function corsHeaders(req: Request) {
  return {
    "Access-Control-Allow-Origin": allowedOrigin(req),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin"
  };
}

function response(req: Request, body: string, status = 200, contentType = "text/plain") {
  return new Response(body, {
    status,
    headers: { ...corsHeaders(req), "Content-Type": contentType }
  });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} secret is not configured.`);
  return value;
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

async function bankPaymentAuthorization(apiKey: string, secretKey: string, uriPath: string, body: string) {
  const randomKey = `${Date.now()}${crypto.getRandomValues(new Uint32Array(1))[0]}`;
  const signature = await hmacSha256Hex(`${randomKey}${uriPath}${body}`, secretKey);
  const authorizationString = `apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`;
  return {
    randomKey,
    authorization: `AllonaPay ${btoa(authorizationString)}`
  };
}

function legacyOrderPayload(payload: Record<string, unknown>) {
  const next = { ...payload };
  delete next.status;
  if (next.order_status === "paid") next.order_status = "confirmed";
  if (next.order_status === "awaiting_payment") next.order_status = "pending";
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

async function tokenFromRequest(req: Request) {
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token");
  if (queryToken) return queryToken;

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await req.json();
    return body.token;
  }
  if (contentType.includes("form")) {
    const form = await req.formData();
    return String(form.get("token") || "");
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return response(req, "ok");
  }

  try {
    const supabaseUrl = env("SUPABASE_URL");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const apiKey = env("BANK_PAYMENT_API_KEY");
    const secretKey = env("BANK_PAYMENT_SECRET_KEY");
    const bankPaymentBaseUrl = Deno.env.get("BANK_PAYMENT_API_URL") || "https://bank-api.example.com";
    const siteUrl = Deno.env.get("SITE_URL") || "https://allonahub.com";
    const admin = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");
    const cvPaymentId = url.searchParams.get("cvPaymentId");
    const token = await tokenFromRequest(req);
    if (!orderId && !cvPaymentId) return response(req, "Missing payment reference", 400);
    if (orderId && !/^[0-9a-f-]{36}$/i.test(orderId)) return response(req, "Invalid payment reference", 400);
    if (cvPaymentId && !/^[0-9a-f-]{36}$/i.test(cvPaymentId)) return response(req, "Invalid payment reference", 400);
    if (!token || token.length > 500) return response(req, "Missing token", 400);

    const uriPath = "/payments/detail";
    const payload = {
      locale: "tr",
      conversationId: cvPaymentId || orderId || token,
      token
    };
    const body = JSON.stringify(payload);
    const auth = await bankPaymentAuthorization(apiKey, secretKey, uriPath, body);
    const bankPaymentResponse = await fetch(`${bankPaymentBaseUrl}${uriPath}`, {
      method: "POST",
      headers: {
        "Authorization": auth.authorization,
        "x-allona-rnd": auth.randomKey,
        "Content-Type": "application/json"
      },
      body
    });
    const result = await bankPaymentResponse.json();

    const paymentStatus = result.status === "success" && result.paymentStatus === "SUCCESS" ? "paid" : "failed";
    const orderStatus = paymentStatus === "paid" ? "paid" : "pending";

    if (cvPaymentId) {
      const { data: cvPayment, error: cvPaymentError } = await admin
        .from("cv_payments")
        .select("*")
        .eq("id", cvPaymentId)
        .maybeSingle();
      if (cvPaymentError) throw cvPaymentError;
      if (!cvPayment) return response(req, "CV payment not found", 404);

      let shouldCreditCV = false;
      if (paymentStatus === "paid") {
        const { data: updatedPayment, error: updatePaymentError } = await admin
          .from("cv_payments")
          .update({
            status: paymentStatus,
            provider_reference: token
          })
          .eq("id", cvPaymentId)
          .neq("status", "paid")
          .select("id")
          .maybeSingle();
        if (updatePaymentError) throw updatePaymentError;
        shouldCreditCV = Boolean(updatedPayment);
      } else if (cvPayment.status !== "paid") {
        const { error: updatePaymentError } = await admin
          .from("cv_payments")
          .update({
            status: paymentStatus,
            provider_reference: token
          })
          .eq("id", cvPaymentId);
        if (updatePaymentError) throw updatePaymentError;
      }

      if (paymentStatus === "paid" && shouldCreditCV) {
        const { data: access, error: accessError } = await admin
          .from("cv_access_accounts")
          .select("*")
          .eq("user_id", cvPayment.user_id)
          .maybeSingle();
        if (accessError) throw accessError;

        if (access) {
          const { error: creditError } = await admin
            .from("cv_access_accounts")
            .update({
              paid_credits: Number(access.paid_credits || 0) + 1
            })
            .eq("user_id", cvPayment.user_id);
          if (creditError) throw creditError;
        } else {
          const { error: insertAccessError } = await admin
            .from("cv_access_accounts")
            .insert({
              user_id: cvPayment.user_id,
              free_limit: 0,
              free_used: 0,
              paid_credits: 1,
              risk_reason: "paid_before_cv_access"
            });
          if (insertAccessError) throw insertAccessError;
        }
      }

      const target = `${siteUrl.replace(/\/$/, "")}/pages/career/career-cv-form.html?payment=${paymentStatus}`;
      return Response.redirect(target, 303);
    }

    await updateOrder(admin, orderId, {
      payment_status: paymentStatus,
      order_status: orderStatus,
      status: orderStatus
    });

    const target = `${siteUrl.replace(/\/$/, "")}/pages/commerce/order-success.html?payment=${paymentStatus}&id=${encodeURIComponent(orderId || "")}`;
    return Response.redirect(target, 303);
  } catch (error) {
    console.error("bank-payment-callback failed", error);
    return response(req, "Payment callback could not be completed", 500);
  }
});
