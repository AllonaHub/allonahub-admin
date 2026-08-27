import { EInvoicingError } from "./errors.js";

function review(errorCode, details = {}) {
  return Object.freeze({ status: "NEEDS_REVIEW", errorCode, details });
}

function legalEntityReady(entity) {
  const address = entity?.billing_address || {};
  return Boolean(
    String(entity?.tax_number || "").trim()
    && String(address.line1 || "").trim()
    && String(address.city || "").trim()
    && String(address.country || entity?.country_code || "").trim()
    && (String(entity?.country_code || "").toUpperCase() !== "TR" || String(entity?.tax_office || "").trim())
  );
}

async function one(query, label) {
  const { data, error } = await query;
  if (error) {
    throw new EInvoicingError(`${label} sorgusu tamamlanamadı.`, {
      code: "SELLER_RESOLVER_DATABASE_ERROR",
      statusCode: 503,
      retryable: true,
      details: { label, databaseCode: error.code || null }
    });
  }
  return data || null;
}

export async function resolveSellerContext({ db, orderId, subOrderId = null }) {
  if (!db || !orderId) return review("RESOLVER_INPUT_INCOMPLETE");

  let subOrder;
  if (subOrderId) {
    subOrder = await one(
      db.from("seller_sub_orders").select("*").eq("id", subOrderId).eq("order_id", orderId).maybeSingle(),
      "seller_sub_order"
    );
  } else {
    const { data, error } = await db.from("seller_sub_orders").select("*").eq("order_id", orderId).limit(2);
    if (error) throw new EInvoicingError("Sub-order sorgusu tamamlanamadı.", { code: "SELLER_RESOLVER_DATABASE_ERROR", statusCode: 503, retryable: true });
    if (!data?.length) return review("SUB_ORDER_MISSING", { orderId });
    if (data.length !== 1) return review("SUB_ORDER_AMBIGUOUS", { orderId, count: data.length });
    [subOrder] = data;
  }
  if (!subOrder) return review("SUB_ORDER_NOT_FOUND", { orderId, subOrderId });
  if (subOrder.resolution_status !== "RESOLVED") {
    return review(subOrder.resolution_error_code || "SUB_ORDER_NOT_RESOLVED", { subOrderId: subOrder.id });
  }

  const seller = await one(db.from("seller_profiles").select("*").eq("id", subOrder.seller_id).maybeSingle(), "seller");
  if (!seller || seller.status !== "active") return review("SELLER_INACTIVE_OR_MISSING", { sellerId: subOrder.seller_id });
  if (seller.organization_id !== subOrder.organization_id || seller.legal_entity_id !== subOrder.legal_entity_id) {
    return review("SELLER_TENANT_MISMATCH", { subOrderId: subOrder.id });
  }

  const legalEntity = await one(db.from("legal_entities").select("*").eq("id", seller.legal_entity_id).maybeSingle(), "legal_entity");
  if (!legalEntity || legalEntity.status !== "active") return review("LEGAL_ENTITY_INACTIVE_OR_MISSING", { legalEntityId: seller.legal_entity_id });
  if (!legalEntityReady(legalEntity)) return review("LEGAL_ENTITY_INVOICE_PROFILE_INCOMPLETE", { legalEntityId: seller.legal_entity_id });
  if (legalEntity.organization_id !== subOrder.organization_id) {
    return review("LEGAL_ENTITY_TENANT_MISMATCH", { legalEntityId: legalEntity.id, subOrderId: subOrder.id });
  }

  const order = await one(db.from("orders").select("*").eq("id", orderId).maybeSingle(), "order");
  if (!order) return review("ORDER_NOT_FOUND", { orderId });
  if (order.invoice_allocation_status !== "COMPLETE" || !order.expected_seller_sub_order_count) {
    return review("ORDER_SELLER_ALLOCATION_INCOMPLETE", { orderId, allocationStatus: order.invoice_allocation_status || null });
  }
  const accountId = subOrder.sales_channel_account_id || order.sales_channel_account_id;
  if (!accountId) return review("SALES_CHANNEL_ACCOUNT_MISSING", { orderId, subOrderId: subOrder.id });

  const salesChannelAccount = await one(
    db.from("sales_channel_accounts").select("*, sales_channels(channel_key, display_name, capabilities)").eq("id", accountId).maybeSingle(),
    "sales_channel_account"
  );
  if (salesChannelAccount?.status === "paused") {
    return review("SALES_CHANNEL_ACCOUNT_PAUSED", { salesChannelAccountId: accountId });
  }
  if (!salesChannelAccount || salesChannelAccount.status !== "connected") {
    return review("SALES_CHANNEL_ACCOUNT_NOT_CONNECTED", { salesChannelAccountId: accountId });
  }
  if (salesChannelAccount.organization_id !== subOrder.organization_id || salesChannelAccount.seller_id !== seller.id || salesChannelAccount.legal_entity_id !== legalEntity.id) {
    return review("SALES_CHANNEL_TENANT_MISMATCH", { salesChannelAccountId: accountId });
  }

  const specificSettings = await one(
    db.from("invoice_settings").select("*").eq("legal_entity_id", legalEntity.id).eq("sales_channel_account_id", accountId).eq("is_active", true).maybeSingle(),
    "invoice_settings"
  );
  const globalSettings = specificSettings ? null : await one(
    db.from("invoice_settings").select("*").eq("legal_entity_id", legalEntity.id).is("sales_channel_account_id", null).eq("is_active", true).maybeSingle(),
    "invoice_settings"
  );
  const settings = specificSettings || globalSettings;
  if (!settings) return review("INVOICE_SETTINGS_MISSING", { legalEntityId: legalEntity.id, salesChannelAccountId: accountId });
  if (settings.organization_id !== subOrder.organization_id || settings.legal_entity_id !== legalEntity.id || (settings.sales_channel_account_id && settings.sales_channel_account_id !== accountId)) {
    return review("INVOICE_SETTINGS_TENANT_MISMATCH", { invoiceSettingsId: settings.id });
  }
  if (!settings.invoice_profile_id || !settings.invoice_provider_account_id) {
    return review("INVOICE_SETTINGS_INCOMPLETE", { invoiceSettingsId: settings.id });
  }

  const [invoiceProfile, providerAccount] = await Promise.all([
    one(db.from("invoice_profiles").select("*").eq("id", settings.invoice_profile_id).eq("status", "active").maybeSingle(), "invoice_profile"),
    one(db.from("invoice_provider_accounts").select("*").eq("id", settings.invoice_provider_account_id).maybeSingle(), "invoice_provider_account")
  ]);
  if (!invoiceProfile) return review("INVOICE_PROFILE_INACTIVE_OR_MISSING", { invoiceProfileId: settings.invoice_profile_id });
  if (providerAccount?.status === "paused") {
    return review("INVOICE_PROVIDER_ACCOUNT_PAUSED", { providerAccountId: settings.invoice_provider_account_id });
  }
  if (!providerAccount || providerAccount.status !== "connected") {
    return review("INVOICE_PROVIDER_ACCOUNT_NOT_CONNECTED", { providerAccountId: settings.invoice_provider_account_id });
  }
  if (invoiceProfile.organization_id !== subOrder.organization_id || providerAccount.organization_id !== subOrder.organization_id || invoiceProfile.legal_entity_id !== legalEntity.id || providerAccount.legal_entity_id !== legalEntity.id) {
    return review("INVOICE_CONFIGURATION_TENANT_MISMATCH", { legalEntityId: legalEntity.id });
  }

  return Object.freeze({
    status: "RESOLVED",
    order,
    subOrder,
    seller,
    legalEntity,
    salesChannelAccount,
    invoiceProfile,
    providerAccount,
    settings
  });
}
