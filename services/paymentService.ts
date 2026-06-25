type SupabaseClientLike = {
  from: (table: string) => any;
  rpc?: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
};

type ProviderResponse = {
  providerPaymentId?: string;
  status?: string;
  raw?: Record<string, unknown>;
  verifiedByServer?: boolean;
};

type PaymentError = {
  code?: string;
  message?: string;
  raw?: Record<string, unknown>;
};

async function loadOrder(supabase: SupabaseClientLike, orderId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("id,user_id,grand_total,total,payment_status,status")
    .eq("id", orderId)
    .single();

  if (error || !data) throw new Error(error?.message || "Order not found");
  return data;
}

export async function createPaymentAttempt(supabase: SupabaseClientLike, orderId: string) {
  const order = await loadOrder(supabase, orderId);
  const amount = Number(order.grand_total ?? order.total ?? 0);
  if (!amount || amount <= 0) throw new Error("Payment amount must be positive");

  const { data, error } = await supabase
    .from("payment_attempts")
    .insert({
      order_id: order.id,
      user_id: order.user_id,
      provider: "iyzico",
      status: "created",
      amount,
      currency: "TRY"
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message || "Payment attempt could not be created");
  return data;
}

export async function markPaymentPending(supabase: SupabaseClientLike, paymentAttemptId: string) {
  const { data, error } = await supabase
    .from("payment_attempts")
    .update({ status: "pending" })
    .eq("id", paymentAttemptId)
    .select("*")
    .single();

  if (error) throw new Error(error.message || "Payment attempt could not be marked pending");
  await syncOrderPaymentStatus(supabase, data.order_id);
  return data;
}

export async function markPaymentPaid(
  supabase: SupabaseClientLike,
  paymentAttemptId: string,
  providerResponse: ProviderResponse
) {
  if (!providerResponse?.verifiedByServer) {
    throw new Error("Payment can only be marked paid after server-side provider verification");
  }

  const { data, error } = await supabase
    .from("payment_attempts")
    .update({
      status: "paid",
      provider_payment_id: providerResponse.providerPaymentId || null,
      raw_response: providerResponse.raw || providerResponse
    })
    .eq("id", paymentAttemptId)
    .select("*")
    .single();

  if (error) throw new Error(error.message || "Payment attempt could not be marked paid");
  await syncOrderPaymentStatus(supabase, data.order_id);
  return data;
}

export async function markPaymentFailed(
  supabase: SupabaseClientLike,
  paymentAttemptId: string,
  errorPayload: PaymentError
) {
  const { data, error } = await supabase
    .from("payment_attempts")
    .update({
      status: "failed",
      error_code: errorPayload?.code || null,
      error_message: errorPayload?.message || "Payment failed",
      raw_response: errorPayload?.raw || errorPayload || {}
    })
    .eq("id", paymentAttemptId)
    .select("*")
    .single();

  if (error) throw new Error(error.message || "Payment attempt could not be marked failed");
  await syncOrderPaymentStatus(supabase, data.order_id);
  return data;
}

export async function markPaymentRefunded(
  supabase: SupabaseClientLike,
  paymentAttemptId: string,
  providerResponse: ProviderResponse
) {
  if (!providerResponse?.verifiedByServer) {
    throw new Error("Refund state requires server-side provider verification");
  }

  const { data, error } = await supabase
    .from("payment_attempts")
    .update({
      status: "refunded",
      raw_response: providerResponse.raw || providerResponse
    })
    .eq("id", paymentAttemptId)
    .select("*")
    .single();

  if (error) throw new Error(error.message || "Payment attempt could not be marked refunded");
  await syncOrderPaymentStatus(supabase, data.order_id);
  return data;
}

export async function syncOrderPaymentStatus(supabase: SupabaseClientLike, orderId: string) {
  const { data: attempts, error } = await supabase
    .from("payment_attempts")
    .select("status,created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message || "Payment attempts could not be loaded");

  const latestStatus = attempts?.[0]?.status || "created";
  const paymentStatus =
    attempts?.some((item: any) => item.status === "paid") ? "paid" :
    attempts?.some((item: any) => item.status === "refunded") ? "refunded" :
    latestStatus === "failed" ? "failed" :
    latestStatus === "pending" ? "pending" :
    "unpaid";

  const orderPatch: Record<string, string> = { payment_status: paymentStatus };
  if (paymentStatus === "paid") orderPatch.status = "paid";
  if (paymentStatus === "refunded") orderPatch.status = "refunded";

  const { data, error: updateError } = await supabase
    .from("orders")
    .update(orderPatch)
    .eq("id", orderId)
    .select("*")
    .single();

  if (updateError) throw new Error(updateError.message || "Order payment status could not be synced");
  return data;
}
