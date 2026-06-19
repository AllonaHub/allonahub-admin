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

async function authorization(uriPath, body) {
  const randomKey = `${Date.now()}${crypto.randomInt(100000, 999999999)}`;
  const signature = await hmacSha256Hex(`${randomKey}${uriPath}${body}`, config.iyzico.secretKey);
  const authorizationString = `apiKey:${config.iyzico.apiKey}&randomKey:${randomKey}&signature:${signature}`;
  return {
    randomKey,
    value: `IYZWSv2 ${Buffer.from(authorizationString).toString("base64")}`
  };
}

export async function iyzicoPost(uriPath, payload) {
  const body = JSON.stringify(payload);
  const auth = await authorization(uriPath, body);
  const response = await fetch(`${config.iyzico.baseUrl}${uriPath}`, {
    method: "POST",
    headers: {
      Authorization: auth.value,
      "x-iyzi-rnd": auth.randomKey,
      "Content-Type": "application/json"
    },
    body
  });
  const result = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, result };
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
