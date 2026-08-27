import crypto from "node:crypto";
import { config } from "../config.js";

function amount(value) {
  return Number(Number(value || 0).toFixed(2));
}

export function splitName(fullName, fallback = "Allona Müşteri") {
  const parts = String(fullName || fallback).trim().split(/\s+/);
  const name = parts.shift() || "Allona";
  const surname = parts.join(" ") || "Müşteri";
  return { name, surname };
}

async function hmacSha256Hex(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function bankPaymentConfigured() {
  return Boolean(config.bankPayment.apiKey && config.bankPayment.secretKey && config.bankPayment.baseUrl);
}

function bankPaymentConfigError() {
  const error = new Error("Ödeme sağlayıcısı yapılandırılmadı.");
  error.statusCode = 503;
  error.code = "BANK_PAYMENT_NOT_CONFIGURED";
  return error;
}

async function authorization(uriPath, body) {
  if (!bankPaymentConfigured()) throw bankPaymentConfigError();
  const randomKey = `${Date.now()}${crypto.randomInt(100000, 999999999)}`;
  const signature = await hmacSha256Hex(`${randomKey}${uriPath}${body}`, config.bankPayment.secretKey);
  const authorizationString = `apiKey:${config.bankPayment.apiKey}&randomKey:${randomKey}&signature:${signature}`;
  return {
    randomKey,
    value: `AllonaPay ${Buffer.from(authorizationString).toString("base64")}`
  };
}

export async function bankPaymentPost(uriPath, payload) {
  if (!bankPaymentConfigured()) throw bankPaymentConfigError();
  const body = JSON.stringify(payload);
  const auth = await authorization(uriPath, body);
  const response = await fetch(`${config.bankPayment.baseUrl}${uriPath}`, {
    method: "POST",
    headers: {
      Authorization: auth.value,
      "x-allona-rnd": auth.randomKey,
      "Content-Type": "application/json"
    },
    body
  });
  const result = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, result };
}

export function bankRefundPayload({ conversationId, paymentTransactionId, price, currency = "TRY", ip, reason = "OTHER", description = "" }) {
  return {
    locale: "tr",
    conversationId,
    paymentTransactionId,
    price: amount(price),
    currency,
    ip: ip || "0.0.0.0",
    reason,
    description: String(description || "AllonaHub refund cancellation approval").slice(0, 255)
  };
}

export function bankCancelPayload({ conversationId, paymentId, ip }) {
  return {
    locale: "tr",
    conversationId,
    paymentId,
    ip: ip || "0.0.0.0"
  };
}

export function orderCheckoutPayload({ order, userId, callbackUrl, ip }) {
  const shipping = order.shipping_address || { address: order.address, city: order.city };
  const billing = order.billing_address || shipping;
  const { name, surname } = splitName(order.customer_name);

  return {
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
      id: userId,
      name,
      surname,
      identityNumber: "11111111111",
      email: order.customer_email,
      gsmNumber: order.customer_phone || "",
      registrationAddress: shipping.address || order.address || "",
      city: shipping.city || order.city || "İstanbul",
      country: "Turkey",
      zipCode: shipping.zip_code || "34000",
      ip: ip || "0.0.0.0"
    },
    shippingAddress: {
      address: shipping.address || order.address || "",
      zipCode: shipping.zip_code || "34000",
      contactName: order.customer_name,
      city: shipping.city || order.city || "İstanbul",
      country: "Turkey"
    },
    billingAddress: {
      address: billing.address || shipping.address || order.address || "",
      zipCode: billing.zip_code || shipping.zip_code || "34000",
      contactName: order.customer_name,
      city: billing.city || shipping.city || order.city || "İstanbul",
      country: "Turkey"
    },
    basketItems: (order.order_items || []).map((item) => ({
      id: String(item.product_id || item.id),
      price: amount(Number(item.price || item.unit_price || 0) * Number(item.quantity || 1)),
      name: String(item.product_name || "AllonaHub Ürün").slice(0, 255),
      category1: "Genel",
      itemType: "PHYSICAL"
    }))
  };
}

export function cvCheckoutPayload({ payment, profile, user, callbackUrl, ip }) {
  const { name, surname } = splitName(profile?.full_name || user.email || "Allona CV Müşteri", "Allona CV Müşteri");
  const cvPrice = amount(payment.amount || config.cvPriceTry);

  return {
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
      id: user.id,
      name,
      surname,
      identityNumber: "11111111111",
      email: user.email,
      gsmNumber: profile?.phone || "",
      registrationAddress: "AllonaHub Dijital CV",
      city: "İstanbul",
      country: "Turkey",
      zipCode: "34000",
      ip: ip || "0.0.0.0"
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
}

export function partnerPaymentIntentCheckoutPayload({ intent, business, buyer, callbackUrl, ip }) {
  const { name, surname } = splitName(buyer?.customer_name || intent.customer_name || "Allona Müşteri");
  const amountValue = amount(intent.amount);
  const partnerName = business?.display_name || business?.legal_name || "AllonaHub Partner";

  return {
    locale: "tr",
    conversationId: intent.id,
    price: amountValue,
    paidPrice: amountValue,
    currency: intent.currency || "TRY",
    basketId: `PARTNER-${intent.id}`,
    paymentGroup: "PRODUCT",
    callbackUrl,
    enabledInstallments: [1, 2, 3, 6, 9],
    buyer: {
      id: String(buyer?.customer_email || intent.customer_email || intent.id).slice(0, 255),
      name,
      surname,
      identityNumber: "11111111111",
      email: buyer?.customer_email || intent.customer_email,
      gsmNumber: buyer?.customer_phone || intent.customer_phone || "",
      registrationAddress: business?.city || "AllonaHub Partner Ödeme",
      city: business?.city || "İstanbul",
      country: business?.country || "Turkey",
      zipCode: "34000",
      ip: ip || "0.0.0.0"
    },
    shippingAddress: {
      address: business?.city || "AllonaHub Partner Ödeme",
      zipCode: "34000",
      contactName: `${name} ${surname}`,
      city: business?.city || "İstanbul",
      country: business?.country || "Turkey"
    },
    billingAddress: {
      address: business?.city || "AllonaHub Partner Ödeme",
      zipCode: "34000",
      contactName: `${name} ${surname}`,
      city: business?.city || "İstanbul",
      country: business?.country || "Turkey"
    },
    basketItems: [
      {
        id: `partner-payment-${intent.id}`,
        price: amountValue,
        name: String(intent.description || `${partnerName} ödeme`).slice(0, 255),
        category1: "AllonaHub Partner",
        itemType: "VIRTUAL"
      }
    ]
  };
}
