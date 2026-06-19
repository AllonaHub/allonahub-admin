import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

const encoder = new TextEncoder();

function response(body: string, status = 200, contentType = "text/plain") {
  return new Response(body, {
    status,
    headers: { ...corsHeaders, "Content-Type": contentType }
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

async function iyzicoAuthorization(apiKey: string, secretKey: string, uriPath: string, body: string) {
  const randomKey = `${Date.now()}${crypto.getRandomValues(new Uint32Array(1))[0]}`;
  const signature = await hmacSha256Hex(`${randomKey}${uriPath}${body}`, secretKey);
  const authorizationString = `apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`;
  return {
    randomKey,
    authorization: `IYZWSv2 ${btoa(authorizationString)}`
  };
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
    return response("ok");
  }

  try {
    const supabaseUrl = env("SUPABASE_URL");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const apiKey = env("IYZICO_API_KEY");
    const secretKey = env("IYZICO_SECRET_KEY");
    const iyzicoBaseUrl = Deno.env.get("IYZICO_BASE_URL") || "https://sandbox-api.iyzipay.com";
    const siteUrl = Deno.env.get("SITE_URL") || "https://allonahub.com";
    const admin = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");
    const cvPaymentId = url.searchParams.get("cvPaymentId");
    const token = await tokenFromRequest(req);
    if (!orderId && !cvPaymentId) return response("Missing orderId or cvPaymentId", 400);
    if (!token) return response("Missing token", 400);

    const uriPath = "/payment/iyzipos/checkoutform/auth/ecom/detail";
    const payload = {
      locale: "tr",
      conversationId: cvPaymentId || orderId || token,
      token
    };
    const body = JSON.stringify(payload);
    const auth = await iyzicoAuthorization(apiKey, secretKey, uriPath, body);
    const iyzicoResponse = await fetch(`${iyzicoBaseUrl}${uriPath}`, {
      method: "POST",
      headers: {
        "Authorization": auth.authorization,
        "x-iyzi-rnd": auth.randomKey,
        "Content-Type": "application/json"
      },
      body
    });
    const result = await iyzicoResponse.json();

    const paymentStatus = result.status === "success" && result.paymentStatus === "SUCCESS" ? "paid" : "failed";
    const orderStatus = paymentStatus === "paid" ? "confirmed" : "pending";

    if (cvPaymentId) {
      const { data: cvPayment, error: cvPaymentError } = await admin
        .from("cv_payments")
        .select("*")
        .eq("id", cvPaymentId)
        .maybeSingle();
      if (cvPaymentError) throw cvPaymentError;
      if (!cvPayment) return response("CV payment not found", 404);

      let shouldCreditCV = false;
      if (paymentStatus === "paid") {
        const { data: updatedPayment, error: updatePaymentError } = await admin
          .from("cv_payments")
          .update({
            status: paymentStatus,
            iyzico_token: token
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
            iyzico_token: token
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

      const target = `${siteUrl.replace(/\/$/, "")}/career-cv-form.html?payment=${paymentStatus}`;
      return Response.redirect(target, 303);
    }

    const query = admin
      .from("orders")
      .update({
        payment_status: paymentStatus,
        order_status: orderStatus
      })
      .eq("id", orderId);
    const { error } = await query;
    if (error) throw error;

    const target = `${siteUrl.replace(/\/$/, "")}/orders.html?payment=${paymentStatus}`;
    return Response.redirect(target, 303);
  } catch (error) {
    return response(error instanceof Error ? error.message : "Unexpected error", 500);
  }
});
