import crypto from "node:crypto";
import { config } from "../config.js";
import { bankCancelPayload, bankPaymentPost, bankRefundPayload } from "./bank-payment-provider.js";

function amount(value) {
  return Number(Number(value || 0).toFixed(2));
}

function actionEventType(action) {
  const map = {
    mark_review: "refund_cancellation.review_opened",
    approve_cancellation: "refund_cancellation.cancellation_approved",
    approve_refund: "refund_cancellation.refund_approved",
    reject_request: "refund_cancellation.request_rejected",
    add_note: "refund_cancellation.note_added"
  };
  return map[action] || "refund_cancellation.updated";
}

function publicOrder(order = {}) {
  return {
    id: order.id || null,
    order_no: order.order_no || order.order_number || order.id || null,
    customer_email: order.customer_email || null,
    total: amount(order.total || order.grand_total || 0),
    currency: order.currency || "TRY",
    order_status: order.order_status || order.status || null,
    payment_status: order.payment_status || null,
    payment_provider: order.payment_provider || order.provider || "bank_checkout",
    provider_reference: order.payment_provider_reference || order.provider_reference || null,
    paid_at: order.paid_at || null
  };
}

function signature(body, secret) {
  if (!secret) return "";
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

async function postJson(url, payload, secret, timeoutMs) {
  if (!url) return { configured: false, sent: false, code: "WEBHOOK_NOT_CONFIGURED" };
  const raw = JSON.stringify(payload);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(Number(timeoutMs || 12000), 3000));
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Allona-Event": payload.event_type || "refund_cancellation.updated",
        "X-Allona-Provider-Signature": signature(raw, secret)
      },
      body: raw
    });
    const text = await response.text().catch(() => "");
    return {
      configured: true,
      sent: response.ok,
      status: response.status,
      body: text.slice(0, 1000)
    };
  } catch (error) {
    return {
      configured: true,
      sent: false,
      error: error.name === "AbortError" ? "timeout" : error.message
    };
  } finally {
    clearTimeout(timeout);
  }
}

function providerReference(order = {}, context = {}) {
  return {
    payment_id: context.payment_id || order.payment_provider_reference || order.provider_reference || null,
    payment_transaction_id: context.payment_transaction_id || order.payment_transaction_id || null,
    provider: context.provider || order.payment_provider || order.provider || "bank_checkout",
    source: context.source || (order.payment_provider_reference ? "orders" : "unknown")
  };
}

async function notifyBankPaymentNative({ action, order, context, reason, ip }) {
  const ref = providerReference(order, context);
  if (!["approve_refund", "approve_cancellation"].includes(action)) {
    return { configured: true, sent: false, skipped: true, code: "NATIVE_NOT_REQUIRED" };
  }
  if (!config.paymentProvider.nativeRefundsEnabled) {
    return { configured: true, sent: false, skipped: true, code: "NATIVE_REFUNDS_DISABLED" };
  }

  if (action === "approve_refund") {
    if (!ref.payment_transaction_id) {
      return { configured: true, sent: false, skipped: true, code: "MISSING_PAYMENT_TRANSACTION_ID" };
    }
    const payload = bankRefundPayload({
      conversationId: order.id,
      paymentTransactionId: ref.payment_transaction_id,
      price: order.total || order.grand_total || 0,
      currency: order.currency || "TRY",
      ip,
      description: reason
    });
    const response = await bankPaymentPost(config.bankPayment.refundPath, payload);
    return {
      configured: true,
      sent: response.ok && response.result?.status === "success",
      provider: "bank_payment",
      operation: "refund",
      status: response.status,
      result: response.result,
      reason
    };
  }

  if (!ref.payment_id) {
    return { configured: true, sent: false, skipped: true, code: "MISSING_PAYMENT_ID" };
  }
  const payload = bankCancelPayload({
    conversationId: order.id,
    paymentId: ref.payment_id,
    ip
  });
  const response = await bankPaymentPost(config.bankPayment.cancelPath, payload);
  return {
    configured: true,
    sent: response.ok && response.result?.status === "success",
    provider: "bank_payment",
    operation: "cancel",
    status: response.status,
    result: response.result,
    reason
  };
}

export function paymentProviderDispatchStatus() {
  return {
    webhook_configured: Boolean(config.paymentProvider.refundWebhookUrl),
    webhook_signed: Boolean(config.paymentProvider.refundWebhookSecret),
    native_refunds_enabled: Boolean(config.paymentProvider.nativeRefundsEnabled),
    bank_payment_configured: Boolean(config.bankPayment.apiKey && config.bankPayment.secretKey && config.bankPayment.baseUrl)
  };
}

export async function notifyPaymentProviderRefundCancellation({ action, order, context = {}, reason = "", note = "", actorId = "", ip = "" }) {
  const eventType = actionEventType(action);
  const payload = {
    ok: true,
    event_type: eventType,
    action,
    reason,
    note,
    actor_id: actorId || null,
    order: publicOrder({ ...order, ...context }),
    provider_reference: providerReference(order, context),
    created_at: new Date().toISOString(),
    site: config.siteUrl,
    api: config.apiUrl
  };

  const [webhook, bankPayment] = await Promise.all([
    postJson(
      config.paymentProvider.refundWebhookUrl,
      payload,
      config.paymentProvider.refundWebhookSecret,
      config.paymentProvider.refundWebhookTimeoutMs
    ),
    notifyBankPaymentNative({ action, order, context, reason, ip })
  ]);

  return {
    ok: Boolean(webhook.sent || bankPayment.sent),
    status: paymentProviderDispatchStatus(),
    payload,
    channels: {
      webhook,
      bankPayment
    }
  };
}
