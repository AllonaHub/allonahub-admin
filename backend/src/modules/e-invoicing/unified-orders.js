import { supabaseAdmin } from "../../lib/supabase.js";
import { calculateIncludedTax, calculateInvoiceLine, decimalToInteger, integerToDecimal, sumInvoiceLines } from "./money.js";
import { EInvoicingError } from "./errors.js";

function databaseFailure(error) {
  throw new EInvoicingError("Unified order seller çözümlemesi atomik olarak tamamlanamadı.", {
    code: "UNIFIED_ORDER_RESOLUTION_FAILED",
    statusCode: error?.code === "40001" ? 409 : 503,
    retryable: error?.code === "40001",
    details: { databaseCode: error?.code || null }
  });
}

export async function resolveUnifiedSellerSubOrder(input, { db = supabaseAdmin, actorId = null, allowUnassigned = false } = {}) {
  if (!db) throw new EInvoicingError("Unified order veritabanı bağlamı zorunludur.", { code: "UNIFIED_ORDER_DB_CONTEXT_REQUIRED", statusCode: 500 });
  const itemIds = input.items.map((item) => item.orderItemId);
  if (new Set(itemIds).size !== itemIds.length) {
    throw new EInvoicingError("Aynı sipariş kalemi iki kez çözümlenemez.", { code: "DUPLICATE_ORDER_ITEM_ALLOCATION", statusCode: 422 });
  }
  const loaded = await supabaseAdmin.from("order_items")
    .select("id, order_id, quantity, price, unit_price")
    .eq("order_id", input.orderId)
    .in("id", itemIds);
  if (loaded.error) databaseFailure(loaded.error);
  if ((loaded.data || []).length !== itemIds.length) {
    throw new EInvoicingError("Bir veya daha fazla sipariş kalemi bulunamadı.", { code: "ORDER_ITEM_NOT_FOUND", statusCode: 404 });
  }
  const byId = new Map(loaded.data.map((item) => [item.id, item]));
  const allocations = input.items.map((allocation) => {
    const item = byId.get(allocation.orderItemId);
    const quantity = String(item.quantity);
    const unitPrice = String(item.unit_price ?? item.price);
    const calculated = calculateInvoiceLine({
      quantity,
      unitPrice,
      discountAmount: allocation.discountAmount,
      taxRate: allocation.taxRate
    });
    return {
      item_id: item.id,
      expected_quantity: quantity,
      expected_unit_price: unitPrice,
      unit_code: allocation.unitCode,
      discount_amount: calculated.discount,
      tax_rate: allocation.taxRate,
      tax_amount: calculated.tax,
      line_total: calculated.total,
      sku: allocation.sku || null,
      barcode: allocation.barcode || null,
      calculated
    };
  });
  const lineTotals = sumInvoiceLines(allocations.map((item) => item.calculated));
  const shippingTotal = integerToDecimal(decimalToInteger(input.shippingTotal || "0.00", 2), 2);
  if (decimalToInteger(shippingTotal, 2) > 0n && !input.shippingTaxRate) {
    throw new EInvoicingError("Kargo tutarı için açık vergi oranı zorunludur.", { code: "SHIPPING_TAX_RATE_REQUIRED", statusCode: 422 });
  }
  const shippingTaxAmount = input.shippingTaxRate
    ? calculateIncludedTax({ grossAmount: shippingTotal, taxRate: input.shippingTaxRate })
    : "0.00";
  if (input.shippingTaxAmount !== null && input.shippingTaxAmount !== undefined) {
    const suppliedShippingTax = integerToDecimal(decimalToInteger(input.shippingTaxAmount, 2), 2);
    if (suppliedShippingTax !== shippingTaxAmount) {
      throw new EInvoicingError("Kargo KDV tutarı, vergi dahil kargo bedeli ve oranıyla uyuşmuyor.", {
        code: "SHIPPING_TAX_AMOUNT_MISMATCH",
        statusCode: 422,
        retryable: false
      });
    }
  }
  const taxTotal = integerToDecimal(decimalToInteger(lineTotals.taxTotal, 2) + decimalToInteger(shippingTaxAmount, 2), 2);
  const grandTotal = integerToDecimal(decimalToInteger(lineTotals.grandTotal, 2) + decimalToInteger(shippingTotal, 2), 2);
  const result = await db.rpc("resolve_unified_seller_sub_order", {
    p_organization_id: input.organizationId,
    p_legal_entity_id: input.legalEntityId,
    p_seller_id: input.sellerId,
    p_order_id: input.orderId,
    p_sales_channel_account_id: input.salesChannelAccountId,
    p_sub_order_key: input.subOrderKey,
    p_currency: input.currency,
    p_subtotal: lineTotals.subtotal,
    p_discount_total: lineTotals.discountTotal,
    p_shipping_total: shippingTotal,
    p_shipping_tax_rate: input.shippingTaxRate || null,
    p_shipping_tax_amount: shippingTaxAmount,
    p_tax_total: taxTotal,
    p_grand_total: grandTotal,
    p_items: allocations.map(({ calculated, ...item }) => item),
    p_actor_id: actorId,
    p_allow_unassigned: allowUnassigned === true
  });
  if (result.error) databaseFailure(result.error);
  return {
    subOrder: result.data,
    totals: {
      subtotal: lineTotals.subtotal,
      discountTotal: lineTotals.discountTotal,
      shippingTotal,
      shippingTaxAmount,
      taxTotal,
      grandTotal,
      currency: input.currency
    }
  };
}
