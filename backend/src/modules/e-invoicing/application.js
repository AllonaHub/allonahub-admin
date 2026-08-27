import { randomUUID } from "node:crypto";
import { config } from "../../config.js";
import { supabaseAdmin } from "../../lib/supabase.js";
import {
  calculateInvoiceLine,
  decimalToInteger,
  integerToDecimal,
  roundDivide,
  sumInvoiceLines
} from "./money.js";
import { decideDocumentType } from "./decision-engine.js";
import { resolveBoundCredential } from "./credential-store.js";
import { EInvoicingError } from "./errors.js";
import { deterministicHex, invoiceIdempotencyKey, jobIdempotencyKey } from "./idempotency.js";
import { createInvoiceProvider } from "./invoice-providers.js";
import { resolveSellerContext } from "./seller-resolver.js";
import { createSalesChannelProvider, effectiveSalesChannelCapabilities } from "./sales-channels.js";
import { assertInvoiceTransition, isStaleProviderStatus } from "./state-machine.js";

const DOCUMENT_BUCKET = "private-invoice-documents";
const ORDER_INVOICE_EVENTS = new Set([
  "PAYMENT_COMPLETED",
  "ORDER_CONFIRMED",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
  "MANUAL"
]);

function safeErrorCode(error, fallback = "JOB_FAILED") {
  const candidate = String(error?.code || "").trim().toUpperCase();
  return /^[A-Z][A-Z0-9_]{2,79}$/.test(candidate) ? candidate : fallback;
}

function safeJobFailure(error) {
  const code = safeErrorCode(error, "EXTERNAL_OPERATION_FAILED");
  return {
    code,
    message: `e-Dönüşüm işi ${code} koduyla tamamlanamadı. Ayrıntılar correlation/request ID üzerinden incelenmelidir.`,
    retryable: error?.retryable === true
  };
}

function databaseError(error, operation) {
  return new EInvoicingError("e-Dönüşüm veritabanı işlemi tamamlanamadı.", {
    code: "E_INVOICING_DATABASE_ERROR",
    statusCode: 503,
    retryable: true,
    details: { operation, databaseCode: error?.code || null }
  });
}

function requireData(result, operation) {
  if (result.error) throw databaseError(result.error, operation);
  return result.data;
}

async function reserveInvoiceDocumentOperation(invoiceId, operationType) {
  const result = await supabaseAdmin.rpc("reserve_invoice_document_operation", {
    p_invoice_id: invoiceId,
    p_operation_type: operationType
  });
  if (result.error?.code === "23514") {
    throw new EInvoicingError("İade ve iptal iş akışları aynı satış faturasında birlikte başlatılamaz.", {
      code: "INVOICE_DOCUMENT_OPERATION_CONFLICT",
      statusCode: 409,
      retryable: false
    });
  }
  return requireData(result, "reserve_invoice_document_operation");
}

async function authorizeProviderCall(job, sourceInvoiceId, operationType) {
  const authorized = requireData(await supabaseAdmin.rpc("mark_invoice_job_provider_call_started", {
    p_job_id: job.id,
    p_lock_token: job.lock_token,
    p_source_invoice_id: sourceInvoiceId,
    p_operation_type: operationType
  }), "authorize_invoice_provider_call");
  if (authorized !== true) {
    throw new EInvoicingError("Belge iş akışı dış provider çağrısından önce geçerliliğini kaybetti.", {
      code: "PROVIDER_CALL_OPERATION_GUARD_FAILED",
      statusCode: 409,
      retryable: false
    });
  }
}

function sameMoney(left, right) {
  try {
    return decimalToInteger(left ?? "0", 2) === decimalToInteger(right ?? "0", 2);
  } catch {
    return false;
  }
}

function invoiceItemFromOrderItem(item) {
  const requiredTaxFields = ["tax_rate", "tax_amount", "invoice_line_total", "unit_code"];
  const missing = requiredTaxFields.filter((key) => item[key] === null || item[key] === undefined || item[key] === "");
  if (missing.length) {
    throw new EInvoicingError("Sipariş kaleminin fatura/vergi dağılımı eksik.", {
      code: "TAX_ALLOCATION_MISSING",
      statusCode: 409,
      retryable: false,
      details: { orderItemId: item.id, missing }
    });
  }
  const line = calculateInvoiceLine({
    quantity: item.quantity,
    unitPrice: item.unit_price ?? item.price,
    discountAmount: item.discount_amount ?? "0.00",
    taxRate: item.tax_rate
  });
  if (!sameMoney(line.tax, item.tax_amount) || !sameMoney(line.total, item.invoice_line_total)) {
    throw new EInvoicingError("Sipariş kalemi vergi/toplam kontrolünden geçmedi.", {
      code: "TAX_ALLOCATION_MISMATCH",
      statusCode: 409,
      retryable: false,
      details: { orderItemId: item.id }
    });
  }
  return {
    order_item_id: item.id,
    product_id: item.product_id,
    sku: item.sku || null,
    barcode: item.barcode || null,
    description: item.product_name || "Ürün",
    quantity: String(item.quantity),
    unit_code: item.unit_code,
    unit_price: String(item.unit_price ?? item.price),
    discount_amount: line.discount,
    tax_rate: String(item.tax_rate),
    tax_amount: line.tax,
    line_total: line.total
  };
}

function customerSnapshot(profile) {
  if (!profile) return {};
  return {
    profile_type: profile.profile_type,
    name: profile.name || null,
    surname: profile.surname || null,
    company_name: profile.company_name || null,
    tax_number: profile.tax_number || null,
    tax_office: profile.tax_office || null,
    billing_address: profile.billing_address || {},
    email: profile.email || null,
    taxpayer_status: profile.taxpayer_status || "unknown",
    taxpayer_status_source: profile.taxpayer_status_source || "unverified",
    taxpayer_status_checked_at: profile.taxpayer_status_checked_at || null
  };
}

function customerProfileReady(profile) {
  const address = profile?.billing_address || {};
  if (!String(profile?.email || "").trim() || !String(address.line1 || "").trim() || !String(address.city || "").trim() || !String(address.country || "").trim()) return false;
  if (profile.profile_type === "individual") return Boolean(String(profile.name || "").trim() && String(profile.surname || "").trim());
  if (profile.profile_type === "corporate") return Boolean(String(profile.company_name || "").trim() && String(profile.tax_number || "").trim() && String(profile.tax_office || "").trim());
  return false;
}

function requireProviderCapability(provider, capability) {
  if (provider.getCapabilities()?.[capability] !== true) {
    throw new EInvoicingError("Fatura sağlayıcısı bu iş akışını desteklemiyor.", {
      code: `PROVIDER_${String(capability).toUpperCase()}_UNSUPPORTED`,
      statusCode: 422,
      retryable: false,
      details: { provider: provider.providerKey, capability }
    });
  }
}

function runtimeInvoiceProvider(providerKey) {
  const key = String(providerKey || "").trim().toLowerCase();
  if (key === "mock" && !config.eInvoicing.mockProviderEnabled) {
    throw new EInvoicingError("Mock fatura sağlayıcısı bu ortamda kapalı.", {
      code: "MOCK_PROVIDER_DISABLED",
      statusCode: 503,
      retryable: false
    });
  }
  return createInvoiceProvider(key);
}

async function transitionWorkflow(table, id, nextStatus, allowedCurrentStatuses, patch = {}) {
  const current = requireData(await supabaseAdmin.from(table).select("*").eq("id", id).single(), `load_${table}_workflow`);
  if (current.status === nextStatus) return current;
  if (!allowedCurrentStatuses.includes(current.status)) {
    throw new EInvoicingError("Belge iş akışı beklenen durumda değil.", {
      code: "WORKFLOW_STATUS_CONFLICT",
      statusCode: 409,
      retryable: false,
      details: { table, workflowId: id, status: current.status, nextStatus }
    });
  }
  return requireData(await supabaseAdmin
    .from(table)
    .update({ ...patch, status: nextStatus })
    .eq("id", id)
    .eq("status", current.status)
    .select("*")
    .single(), `transition_${table}_workflow`);
}

async function ensureWorkflowProcessing(table, id) {
  let workflow = requireData(await supabaseAdmin.from(table).select("*").eq("id", id).single(), `load_${table}_workflow`);
  if (workflow.status === "COMPLETED") return workflow;
  if (["REQUESTED", "REVIEW", "FAILED"].includes(workflow.status)) {
    workflow = await transitionWorkflow(table, id, "QUEUED", [workflow.status]);
  }
  if (workflow.status === "QUEUED") {
    workflow = await transitionWorkflow(table, id, "PROCESSING", ["QUEUED"]);
  }
  if (workflow.status !== "PROCESSING") {
    throw new EInvoicingError("Belge iş akışı işlenebilir durumda değil.", {
      code: "WORKFLOW_NOT_PROCESSABLE",
      statusCode: 409,
      retryable: false,
      details: { table, workflowId: id, status: workflow.status }
    });
  }
  return workflow;
}

export async function appendInvoiceEvent({ invoice, action, requestId = null, actor = null, oldState = null, newState = null, metadata = {} }) {
  const { error } = await supabaseAdmin.from("invoice_events").insert({
    invoice_id: invoice.id,
    organization_id: invoice.organization_id,
    actor_id: actor?.id || null,
    actor_role: actor?.role || null,
    action,
    old_state: oldState,
    new_state: newState,
    request_id: requestId,
    correlation_id: invoice.correlation_id || requestId,
    metadata
  });
  if (error) throw databaseError(error, "append_invoice_event");
}

export async function transitionInvoice(invoice, nextStatus, patch = {}, event = {}) {
  assertInvoiceTransition(invoice.status, nextStatus);
  const cleanPatch = Object.fromEntries(Object.entries(patch || {}).filter(([, value]) => value !== undefined));
  const updated = requireData(await supabaseAdmin.rpc("transition_invoice_with_event", {
    p_invoice_id: invoice.id,
    p_expected_status: invoice.status,
    p_next_status: nextStatus,
    p_patch: cleanPatch,
    p_action: event.action || "invoice.status_changed",
    p_actor_id: event.actor?.id || null,
    p_actor_role: event.actor?.role || null,
    p_request_id: event.requestId || null,
    p_metadata: event.metadata || {}
  }), "transition_invoice");
  return Array.isArray(updated) ? updated[0] : updated;
}

export async function completeInvoiceCancellation(invoice, { providerReference = null, action, requestId, metadata = {} } = {}) {
  const completed = requireData(await supabaseAdmin.rpc("complete_invoice_cancellation_with_event", {
    p_invoice_id: invoice.id,
    p_expected_invoice_status: invoice.status,
    p_provider_reference: providerReference || invoice.provider_document_id || null,
    p_action: action || "invoice.provider_cancellation_confirmed",
    p_request_id: requestId || null,
    p_metadata: metadata
  }), "complete_invoice_cancellation");
  return Array.isArray(completed) ? completed[0] : completed;
}

export async function rejectInvoiceReturnRequest({ invoiceReturnId, reason, requestId, actor }) {
  const result = await supabaseAdmin.rpc("reject_invoice_return_request", {
    p_return_id: invoiceReturnId,
    p_actor_id: actor?.id || null,
    p_actor_role: actor?.role || "unknown",
    p_request_id: requestId || null,
    p_reason: reason
  });
  if (result.error?.code === "23514") {
    throw new EInvoicingError("Provider çağrısı başlamış veya iade işi etkin olduğu için rezervasyon serbest bırakılamaz.", {
      code: "RETURN_REJECTION_UNSAFE",
      statusCode: 409,
      retryable: false
    });
  }
  if (result.error?.code === "22023") {
    throw new EInvoicingError("İade reddetme gerekçesi geçersiz.", {
      code: "RETURN_REJECTION_REASON_INVALID",
      statusCode: 422,
      retryable: false
    });
  }
  const rejected = requireData(result, "reject_invoice_return_request");
  return Array.isArray(rejected) ? rejected[0] : rejected;
}

export async function enqueueInvoiceJob({ invoice, jobType, payload = {}, requestId = null, scope = "v1", maxAttempts = 4 }) {
  // Channel delivery is a single logical side effect per invoice/account.
  // Auto and manual callers must converge on the same outbox row.
  const effectiveScope = jobType === "UPLOAD_TO_CHANNEL" ? "delivery" : scope;
  const key = jobIdempotencyKey({
    jobType,
    organizationId: invoice.organization_id,
    invoiceId: invoice.id,
    scope: effectiveScope
  });
  const row = {
    organization_id: invoice.organization_id,
    legal_entity_id: invoice.legal_entity_id,
    seller_id: invoice.seller_id,
    order_id: invoice.order_id,
    sub_order_id: invoice.sub_order_id,
    invoice_id: invoice.id,
    job_type: jobType,
    payload,
    idempotency_key: key,
    max_attempts: Math.max(1, Math.min(Number(maxAttempts || 4), 20)),
    request_id: requestId,
    correlation_id: requestId
  };
  const inserted = await supabaseAdmin.from("invoice_jobs").insert(row).select("*").single();
  if (!inserted.error) return { job: inserted.data, duplicate: false };
  if (inserted.error.code !== "23505") throw databaseError(inserted.error, "enqueue_invoice_job");
  let existingResult = await supabaseAdmin.from("invoice_jobs").select("*").eq("idempotency_key", key).maybeSingle();
  if (!existingResult.error && !existingResult.data && jobType === "UPLOAD_TO_CHANNEL") {
    existingResult = await supabaseAdmin.from("invoice_jobs")
      .select("*")
      .eq("invoice_id", invoice.id)
      .eq("job_type", "UPLOAD_TO_CHANNEL")
      .in("status", ["PENDING", "PROCESSING", "RETRY_SCHEDULED"])
      .maybeSingle();
  }
  const existing = requireData(existingResult, "get_existing_invoice_job");
  if (!existing) throw databaseError(inserted.error, "enqueue_invoice_job_unique_conflict");
  return { job: existing, duplicate: true };
}

async function loadApplicableInvoiceSettings(invoice) {
  if (!invoice?.legal_entity_id) return null;
  let request = supabaseAdmin.from("invoice_settings")
    .select("id, max_retry_count, retry_delays_seconds, auto_upload_to_channel")
    .eq("legal_entity_id", invoice.legal_entity_id)
    .eq("is_active", true);
  if (invoice.sales_channel_account_id) {
    request = request.or(`sales_channel_account_id.eq.${invoice.sales_channel_account_id},sales_channel_account_id.is.null`)
      .order("sales_channel_account_id", { ascending: false, nullsFirst: false });
  } else {
    request = request.is("sales_channel_account_id", null);
  }
  return requireData(await request.limit(1).maybeSingle(), "load_applicable_invoice_settings");
}

async function retryDelaysForJob(job) {
  try {
    let settings = null;
    if (job.payload?.invoiceSettingsId) {
      settings = requireData(await supabaseAdmin.from("invoice_settings")
        .select("retry_delays_seconds")
        .eq("id", job.payload.invoiceSettingsId)
        .maybeSingle(), "load_job_retry_settings");
    } else if (job.invoice_id) {
      const invoice = requireData(await supabaseAdmin.from("invoices")
        .select("legal_entity_id, sales_channel_account_id")
        .eq("id", job.invoice_id)
        .maybeSingle(), "load_job_retry_invoice");
      settings = await loadApplicableInvoiceSettings(invoice);
    }
    const configured = Array.isArray(settings?.retry_delays_seconds)
      ? settings.retry_delays_seconds.map(Number).filter((value) => Number.isInteger(value) && value > 0 && value <= 86400)
      : [];
    if (configured.length) return configured;
  } catch {
    // Fall through to the environment-level safe retry schedule.
  }
  return config.eInvoicing.retryDelaysSeconds.length ? config.eInvoicing.retryDelaysSeconds : [60, 300, 900, 3600];
}

async function bestEffortMarkInvoiceNeedsReview({ invoiceId, error, requestId, actor, action }) {
  try {
    const current = requireData(await supabaseAdmin.from("invoices").select("*").eq("id", invoiceId).maybeSingle(), "load_invoice_for_needs_review");
    if (!current || current.status === "NEEDS_REVIEW" || !canSafeTransition(current.status, "NEEDS_REVIEW")) return;
    await transitionInvoice(current, "NEEDS_REVIEW", {
      error_code: error?.code || "INVOICE_PLAN_INCOMPLETE",
      error_message: String(error?.message || "Invoice plan incomplete").slice(0, 2000)
    }, { action, requestId, actor });
  } catch {
    // The original planning error remains authoritative if the secondary
    // audit/status marker cannot be persisted.
  }
}

async function bestEffortMarkWorkflowNeedsReview(table, id) {
  if (!id) return;
  try {
    const current = requireData(await supabaseAdmin.from(table).select("id, status").eq("id", id).maybeSingle(), `load_${table}_for_needs_review`);
    if (!current || current.status === "NEEDS_REVIEW" || !["REQUESTED", "REVIEW", "QUEUED", "PROCESSING", "FAILED"].includes(current.status)) return;
    await transitionWorkflow(table, current.id, "NEEDS_REVIEW", [current.status]);
  } catch {
    // Do not hide the primary planning failure.
  }
}

export async function planInvoiceForSubOrder({ orderId, subOrderId, requestId, actor }) {
  const resolution = await resolveSellerContext({ db: supabaseAdmin, orderId, subOrderId });
  if (resolution.status !== "RESOLVED") {
    throw new EInvoicingError("Satıcı ve fatura hesabı kesin olarak çözümlenemedi.", {
      code: resolution.errorCode || "SELLER_RESOLUTION_FAILED",
      statusCode: 409,
      retryable: false,
      details: resolution.details
    });
  }

  const profileId = resolution.order.customer_invoice_profile_id;
  if (!profileId) {
    throw new EInvoicingError("Siparişe bağlı yapılandırılmış müşteri fatura profili bulunamadı.", {
      code: "CUSTOMER_INVOICE_PROFILE_MISSING",
      statusCode: 409,
      retryable: false
    });
  }
  const customerProfile = requireData(await supabaseAdmin
    .from("customer_invoice_profiles")
    .select("*")
    .eq("id", profileId)
    .eq("customer_id", resolution.order.user_id)
    .eq("status", "active")
    .maybeSingle(), "load_customer_invoice_profile");
  if (!customerProfile) {
    throw new EInvoicingError("Müşteri fatura profili etkin değil.", { code: "CUSTOMER_INVOICE_PROFILE_INACTIVE", statusCode: 409 });
  }
  if (!customerProfileReady(customerProfile)) {
    throw new EInvoicingError("Müşteri fatura profili zorunlu kimlik, e-posta veya adres alanlarını içermiyor.", { code: "CUSTOMER_INVOICE_PROFILE_INCOMPLETE", statusCode: 409, retryable: false });
  }

  const provider = runtimeInvoiceProvider(resolution.providerAccount.provider_key);
  if (resolution.providerAccount.environment === "production" && !config.eInvoicing.providerCallsEnabled) {
    throw new EInvoicingError("Production fatura sağlayıcı çağrıları kapalı.", {
      code: "PRODUCTION_PROVIDER_CALLS_DISABLED",
      statusCode: 503,
      retryable: false
    });
  }
  const decision = await decideDocumentType({
    provider,
    customer: {
      taxpayerStatus: customerProfile.taxpayer_status,
      taxpayerStatusVerified: ["provider_query", "manual_admin"].includes(customerProfile.taxpayer_status_source)
        && Boolean(customerProfile.taxpayer_status_checked_at)
    },
    settings: resolution.settings,
    // External taxpayer queries belong to a provider worker/refresh flow.
    // Planning stays a short, idempotent database operation.
    allowProviderQuery: false
  });
  if (decision.status !== "RESOLVED") {
    throw new EInvoicingError("Belge tipi otomatik olarak belirlenemedi.", {
      code: decision.errorCode || "DOCUMENT_TYPE_UNRESOLVED",
      statusCode: 409,
      retryable: false
    });
  }

  const exactPlan = requireData(await supabaseAdmin.rpc("get_invoice_plan_amounts", {
    p_order_id: orderId,
    p_sub_order_id: resolution.subOrder.id
  }), "load_invoice_plan_amounts");
  const exactSubOrder = exactPlan?.sub_order;
  const orderItems = exactPlan?.items || [];
  if (!exactSubOrder) {
    throw new EInvoicingError("Sub-order parasal bağlamı bulunamadı.", { code: "SUB_ORDER_AMOUNTS_MISSING", statusCode: 409, retryable: false });
  }
  if (!orderItems?.length) {
    throw new EInvoicingError("Sub-order için faturalandırılabilir kalem bulunamadı.", { code: "INVOICE_ITEMS_MISSING", statusCode: 409 });
  }
  const items = orderItems.map(invoiceItemFromOrderItem);
  const calculatedTotals = sumInvoiceLines(items.map((item) => calculateInvoiceLine({
    quantity: item.quantity,
    unitPrice: item.unit_price,
    discountAmount: item.discount_amount,
    taxRate: item.tax_rate
  })));
  const shippingTotal = decimalToInteger(exactSubOrder.shipping_total, 2);
  const shippingTaxMissing = shippingTotal > 0n && (exactSubOrder.shipping_tax_rate === null || exactSubOrder.shipping_tax_amount === null);
  if (shippingTaxMissing) {
    throw new EInvoicingError("Kargo vergi dağılımı açıkça tanımlanmadan fatura oluşturulamaz.", {
      code: "SHIPPING_TAX_ALLOCATION_MISSING",
      statusCode: 409,
      retryable: false,
      details: { subOrderId: resolution.subOrder.id }
    });
  }
  const shippingTax = decimalToInteger(exactSubOrder.shipping_tax_amount || "0.00", 2);
  const grandWithShipping = integerToDecimal(
    decimalToInteger(calculatedTotals.grandTotal, 2) + shippingTotal,
    2
  );
  const taxWithShipping = integerToDecimal(decimalToInteger(calculatedTotals.taxTotal, 2) + shippingTax, 2);
  if (
    !sameMoney(calculatedTotals.subtotal, exactSubOrder.subtotal)
    || !sameMoney(calculatedTotals.discountTotal, exactSubOrder.discount_total)
    || !sameMoney(taxWithShipping, exactSubOrder.tax_total)
    || !sameMoney(grandWithShipping, exactSubOrder.grand_total)
  ) {
    throw new EInvoicingError("Sub-order toplamları fatura kalemleriyle mutabık değil.", {
      code: "INVOICE_HEADER_TOTAL_MISMATCH",
      statusCode: 409,
      retryable: false,
      details: { subOrderId: resolution.subOrder.id }
    });
  }
  const key = invoiceIdempotencyKey({
    organizationId: resolution.subOrder.organization_id,
    sellerId: resolution.seller.id,
    orderId,
    subOrderId: resolution.subOrder.id,
    documentType: decision.documentType
  });
  const salesChannel = resolution.salesChannelAccount.sales_channels?.channel_key || resolution.order.sales_channel;
  const row = {
    organization_id: resolution.subOrder.organization_id,
    legal_entity_id: resolution.legalEntity.id,
    seller_id: resolution.seller.id,
    order_id: orderId,
    sub_order_id: resolution.subOrder.id,
    customer_id: resolution.order.user_id,
    customer_invoice_profile_id: customerProfile.id,
    sales_channel: salesChannel,
    sales_channel_account_id: resolution.salesChannelAccount.id,
    sales_channel_order_id: resolution.order.sales_channel_order_id,
    provider: resolution.providerAccount.provider_key,
    provider_account_id: resolution.providerAccount.id,
    invoice_profile_id: resolution.invoiceProfile.id,
    document_type: decision.documentType,
    scenario: resolution.invoiceProfile.default_scenario,
    issue_date: new Date().toISOString().slice(0, 10),
    currency: exactSubOrder.currency,
    subtotal: exactSubOrder.subtotal,
    discount_total: exactSubOrder.discount_total,
    shipping_total: exactSubOrder.shipping_total,
    shipping_tax_rate: exactSubOrder.shipping_tax_rate,
    shipping_tax_amount: exactSubOrder.shipping_tax_amount || "0.00",
    tax_total: exactSubOrder.tax_total,
    grand_total: exactSubOrder.grand_total,
    customer_profile_snapshot: customerSnapshot(customerProfile),
    idempotency_key: key
  };

  const inserted = await supabaseAdmin.from("invoices").insert(row).select("*").single();
  if (inserted.error?.code === "23505") {
    let existing = requireData(await supabaseAdmin.from("invoices").select("*").eq("idempotency_key", key).maybeSingle(), "load_duplicate_invoice");
    if (!existing) {
      const logicalConflict = requireData(await supabaseAdmin.from("invoices")
        .select("id, document_type, status")
        .eq("organization_id", resolution.subOrder.organization_id)
        .eq("seller_id", resolution.seller.id)
        .eq("order_id", orderId)
        .eq("sub_order_id", resolution.subOrder.id)
        .eq("document_scope", "CUSTOMER_SALE")
        .maybeSingle(), "load_logical_invoice_conflict");
      throw new EInvoicingError("Bu satıcı alt siparişi için farklı belge tipiyle bir fatura zaten mevcut.", {
        code: "INVOICE_SCOPE_ALREADY_EXISTS",
        statusCode: 409,
        retryable: false,
        details: { invoiceId: logicalConflict?.id || null, documentType: logicalConflict?.document_type || null, status: logicalConflict?.status || null }
      });
    }
    const existingJob = requireData(await supabaseAdmin.from("invoice_jobs").select("*").eq("invoice_id", existing.id).eq("job_type", "CREATE_DOCUMENT").maybeSingle(), "load_duplicate_invoice_job");
    if (existingJob || ["ISSUED", "SENT", "ACCEPTED", "REJECTED", "CANCEL_PENDING", "CANCELLED", "RETURNED"].includes(existing.status)) {
      return { invoice: existing, duplicate: true, repaired: false, job: existingJob };
    }
    if (existing.status === "PROCESSING") {
      throw new EInvoicingError("Fatura PROCESSING durumunda fakat oluşturma işi bulunamadı.", {
        code: "INVOICE_JOB_INCONSISTENT",
        statusCode: 409,
        retryable: false,
        details: { invoiceId: existing.id }
      });
    }
    requireData(await supabaseAdmin.from("invoice_items").upsert(
      items.map((item) => ({ ...item, invoice_id: existing.id })),
      { onConflict: "invoice_id,order_item_id", ignoreDuplicates: false }
    ), "repair_invoice_items");
    await appendInvoiceEvent({ invoice: existing, action: "invoice.plan_repaired", requestId, actor, metadata: { decision_source: decision.source } });
    if (["DRAFT", "FAILED", "NEEDS_REVIEW"].includes(existing.status)) {
      existing = await transitionInvoice(existing, "QUEUED", { error_code: null, error_message: null }, { action: "invoice.repaired_and_queued", requestId, actor });
    }
    if (existing.status !== "QUEUED") {
      throw new EInvoicingError("Fatura planı otomatik olarak onarılamadı.", { code: "INVOICE_PLAN_REPAIR_FAILED", statusCode: 409, retryable: false });
    }
    const repairedJob = await enqueueInvoiceJob({
      invoice: existing,
      jobType: "CREATE_DOCUMENT",
      requestId,
      maxAttempts: resolution.settings.max_retry_count || 4,
      payload: { invoiceSettingsId: resolution.settings.id }
    });
    return { invoice: existing, duplicate: true, repaired: true, job: repairedJob.job };
  }
  const invoice = requireData(inserted, "insert_invoice");
  try {
    requireData(await supabaseAdmin.from("invoice_items").insert(items.map((item) => ({ ...item, invoice_id: invoice.id }))), "insert_invoice_items");
    await appendInvoiceEvent({ invoice, action: "invoice.draft_created", requestId, actor, newState: { status: "DRAFT" }, metadata: { decision_source: decision.source } });
    const queued = await transitionInvoice(invoice, "QUEUED", {}, { action: "invoice.queued", requestId, actor });
    const enqueued = await enqueueInvoiceJob({
      invoice: queued,
      jobType: "CREATE_DOCUMENT",
      requestId,
      maxAttempts: resolution.settings.max_retry_count || 4,
      payload: { invoiceSettingsId: resolution.settings.id }
    });
    return { invoice: queued, duplicate: false, job: enqueued.job };
  } catch (error) {
    await bestEffortMarkInvoiceNeedsReview({ invoiceId: invoice.id, error, requestId, actor, action: "invoice.plan_incomplete" });
    throw error;
  }
}

export async function processOrderInvoiceEvent({ orderId, event, requestId, actor = null }) {
  const normalizedEvent = String(event || "").trim().toUpperCase();
  if (!ORDER_INVOICE_EVENTS.has(normalizedEvent)) {
    throw new EInvoicingError("Sipariş fatura tetikleme olayı desteklenmiyor.", {
      code: "INVOICE_TRIGGER_EVENT_INVALID",
      statusCode: 422,
      retryable: false
    });
  }

  const subOrders = requireData(await supabaseAdmin
    .from("seller_sub_orders")
    .select("id")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true }), "load_order_invoice_trigger_sub_orders") || [];
  const order = requireData(await supabaseAdmin.from("orders")
    .select("id, invoice_allocation_status, expected_seller_sub_order_count")
    .eq("id", orderId)
    .maybeSingle(), "load_order_invoice_trigger_order");

  const summary = {
    orderId,
    event: normalizedEvent,
    subOrderCount: subOrders.length,
    planned: 0,
    duplicate: 0,
    skipped: 0,
    needsReview: 0,
    results: []
  };

  if (!order) {
    summary.needsReview = 1;
    summary.results.push({ subOrderId: null, status: "NEEDS_REVIEW", errorCode: "ORDER_NOT_FOUND" });
    return summary;
  }
  if (order.invoice_allocation_status !== "COMPLETE" || !order.expected_seller_sub_order_count) {
    summary.needsReview = 1;
    summary.results.push({ subOrderId: null, status: "NEEDS_REVIEW", errorCode: "ORDER_SELLER_ALLOCATION_INCOMPLETE" });
    return summary;
  }
  if (subOrders.length !== Number(order.expected_seller_sub_order_count)) {
    summary.needsReview = 1;
    summary.results.push({ subOrderId: null, status: "NEEDS_REVIEW", errorCode: "ORDER_SELLER_ALLOCATION_COUNT_MISMATCH" });
    return summary;
  }

  if (!subOrders.length) {
    summary.needsReview = 1;
    summary.results.push({
      subOrderId: null,
      status: "NEEDS_REVIEW",
      errorCode: "SUB_ORDER_MISSING"
    });
    return summary;
  }

  for (const subOrder of subOrders) {
    let resolution;
    try {
      resolution = await resolveSellerContext({ db: supabaseAdmin, orderId, subOrderId: subOrder.id });
    } catch (error) {
      summary.needsReview += 1;
      summary.results.push({
        subOrderId: subOrder.id,
        status: "NEEDS_REVIEW",
        errorCode: safeErrorCode(error, "SELLER_RESOLUTION_FAILED"),
        retryable: error?.retryable === true
      });
      continue;
    }

    if (resolution.status !== "RESOLVED") {
      summary.needsReview += 1;
      summary.results.push({
        subOrderId: subOrder.id,
        status: "NEEDS_REVIEW",
        errorCode: safeErrorCode({ code: resolution.errorCode }, "SELLER_RESOLUTION_FAILED")
      });
      continue;
    }

    const configuredEvent = String(resolution.settings.trigger_event || "MANUAL").toUpperCase();
    if (configuredEvent !== normalizedEvent) {
      summary.skipped += 1;
      summary.results.push({
        subOrderId: subOrder.id,
        status: "SKIPPED",
        configuredEvent
      });
      continue;
    }

    try {
      const planned = await planInvoiceForSubOrder({
        orderId,
        subOrderId: subOrder.id,
        requestId,
        actor
      });
      if (planned.duplicate) summary.duplicate += 1;
      else summary.planned += 1;
      summary.results.push({
        subOrderId: subOrder.id,
        invoiceId: planned.invoice.id,
        jobId: planned.job?.id || null,
        status: planned.duplicate ? "DUPLICATE" : "PLANNED",
        repaired: planned.repaired === true
      });
    } catch (error) {
      summary.needsReview += 1;
      summary.results.push({
        subOrderId: subOrder.id,
        status: "NEEDS_REVIEW",
        errorCode: safeErrorCode(error, "INVOICE_PLAN_FAILED"),
        retryable: error?.retryable === true
      });
    }
  }

  return summary;
}

const TRANSIENT_ORDER_EVENT_CODES = new Set([
  "ORDER_SELLER_ALLOCATION_INCOMPLETE",
  "ORDER_SELLER_ALLOCATION_COUNT_MISMATCH",
  "SUB_ORDER_MISSING",
  "SALES_CHANNEL_ACCOUNT_PAUSED",
  "INVOICE_PROVIDER_ACCOUNT_PAUSED"
]);

function storedOrderEventResult(row, overrides = {}) {
  return {
    orderId: row.order_id,
    event: row.event_type,
    durableEventId: row.id,
    durableStatus: row.status,
    eventDuplicate: overrides.eventDuplicate === true,
    processing: overrides.processing === true,
    subOrderCount: 0,
    planned: 0,
    duplicate: 0,
    skipped: 0,
    needsReview: row.status === "NEEDS_REVIEW" ? 1 : 0,
    results: row.last_error_code
      ? [{ subOrderId: null, status: row.status, errorCode: row.last_error_code }]
      : [],
    ...overrides
  };
}

async function claimAndProcessOrderEvent(row, { requestId, actor = null } = {}) {
  if (row.status === "SUCCEEDED") return storedOrderEventResult(row, { eventDuplicate: true });
  if (row.status === "NEEDS_REVIEW") return storedOrderEventResult(row, { eventDuplicate: true });
  const lockToken = randomUUID();
  const leaseSeconds = Math.max(60, Math.min(config.eInvoicing.jobLeaseSeconds, 3600));
  const claimed = requireData(await supabaseAdmin.rpc("claim_invoice_order_event", {
    p_event_id: row.id,
    p_lock_token: lockToken,
    p_locked_by: `order-event:${requestId || "worker"}`,
    p_request_id: requestId || row.request_id,
    p_lease_seconds: leaseSeconds
  }), "claim_invoice_order_event");
  if (!claimed) return storedOrderEventResult(row, { eventDuplicate: true, processing: row.status === "PROCESSING" });

  let leaseLost = false;
  let renewal = Promise.resolve();
  const heartbeatMs = Math.max(10_000, Math.min(Math.floor(leaseSeconds * 1000 / 3), 60_000));
  const heartbeat = setInterval(() => {
    renewal = renewal.then(async () => {
      const renewed = requireData(await supabaseAdmin.rpc("renew_invoice_order_event_lease", {
        p_event_id: claimed.id,
        p_lock_token: lockToken,
        p_lease_seconds: leaseSeconds
      }), "renew_invoice_order_event_lease");
      if (renewed !== true) leaseLost = true;
    }).catch(() => { leaseLost = true; });
  }, heartbeatMs);

  try {
    const result = await processOrderInvoiceEvent({
      orderId: claimed.order_id,
      event: claimed.event_type,
      requestId: requestId || claimed.request_id,
      actor
    });
    const failedResults = result.results.filter((item) => item.status === "NEEDS_REVIEW" || item.errorCode);
    const errorCode = failedResults[0]?.errorCode || null;
    clearInterval(heartbeat);
    await renewal;
    if (leaseLost) throw new EInvoicingError("Sipariş olayı worker lease'i kaybedildi.", { code: "ORDER_EVENT_LEASE_LOST", statusCode: 503, retryable: true });
    const transient = result.needsReview > 0
      && failedResults.length > 0
      && failedResults.every((item) => TRANSIENT_ORDER_EVENT_CODES.has(item.errorCode) || item.retryable === true);
    const status = result.needsReview > 0 ? (transient ? "PENDING" : "NEEDS_REVIEW") : "SUCCEEDED";
    const delaySeconds = Math.min(3600, [60, 300, 900, 3600][Math.min(Number(claimed.attempt_count || 1) - 1, 3)]);
    const availableAt = transient ? new Date(Date.now() + delaySeconds * 1000).toISOString() : claimed.available_at;
    const completed = requireData(await supabaseAdmin.from("invoice_order_events")
      .update({
        status,
        available_at: availableAt,
        processing_started_at: null,
        lock_token: null,
        lock_expires_at: null,
        locked_by: null,
        processed_at: status === "SUCCEEDED" ? new Date().toISOString() : null,
        last_error_code: errorCode,
        updated_at: new Date().toISOString()
      })
      .eq("id", claimed.id)
      .eq("status", "PROCESSING")
      .eq("lock_token", lockToken)
      .select("*")
      .single(), "complete_invoice_order_event");
    return { ...result, durableEventId: completed.id, durableStatus: completed.status, eventDuplicate: false, processing: false };
  } catch (error) {
    clearInterval(heartbeat);
    await renewal;
    const delaySeconds = Math.min(3600, [60, 300, 900, 3600][Math.min(Number(claimed.attempt_count || 1) - 1, 3)]);
    await supabaseAdmin.from("invoice_order_events").update({
      status: "PENDING",
      available_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
      processing_started_at: null,
      lock_token: null,
      lock_expires_at: null,
      locked_by: null,
      last_error_code: safeErrorCode(error, "ORDER_EVENT_PROCESSING_FAILED"),
      updated_at: new Date().toISOString()
    }).eq("id", claimed.id).eq("status", "PROCESSING").eq("lock_token", lockToken);
    throw error;
  }
}

export async function processDurableOrderInvoiceEvent({ orderId, event, eventKey, requestId, actor = null }) {
  const normalizedEvent = String(event || "").trim().toUpperCase();
  const normalizedKey = String(eventKey || `${orderId}:${normalizedEvent}`).trim().slice(0, 240);
  let stored = await supabaseAdmin.from("invoice_order_events").insert({
    order_id: orderId,
    event_key: normalizedKey,
    event_type: normalizedEvent,
    request_id: requestId
  }).select("*").single();
  let eventDuplicate = false;
  if (stored.error?.code === "23505") {
    stored = await supabaseAdmin.from("invoice_order_events").select("*").eq("order_id", orderId).eq("event_key", normalizedKey).maybeSingle();
    eventDuplicate = true;
  }
  const row = requireData(stored, "store_invoice_order_event");
  if (!row) throw new EInvoicingError("Sipariş olayı kaydedilemedi.", { code: "ORDER_EVENT_STORE_FAILED", statusCode: 503, retryable: true });
  if (row.event_type !== normalizedEvent) {
    throw new EInvoicingError("Aynı event key farklı olay türü için kullanılamaz.", { code: "ORDER_EVENT_KEY_CONFLICT", statusCode: 409, retryable: false });
  }
  const result = await claimAndProcessOrderEvent(row, { requestId, actor });
  return { ...result, eventDuplicate: eventDuplicate || result.eventDuplicate === true };
}

export async function processPendingOrderInvoiceEvents({ orderId = null, limit = 25, requestId = null } = {}) {
  let stale = supabaseAdmin.from("invoice_order_events").update({
    status: "PENDING",
    processing_started_at: null,
    lock_token: null,
    lock_expires_at: null,
    locked_by: null,
    available_at: new Date().toISOString(),
    last_error_code: "ORDER_EVENT_PROCESSING_LEASE_EXPIRED",
    updated_at: new Date().toISOString()
  }).eq("status", "PROCESSING").lt("lock_expires_at", new Date().toISOString());
  if (orderId) stale = stale.eq("order_id", orderId);
  requireData(await stale, "recover_stale_invoice_order_events");

  let query = supabaseAdmin.from("invoice_order_events").select("*")
    .eq("status", "PENDING")
    .lte("available_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(Math.max(1, Math.min(Number(limit || 25), 100)));
  if (orderId) query = query.eq("order_id", orderId);
  const rows = requireData(await query, "load_pending_invoice_order_events") || [];
  const results = [];
  for (const row of rows) {
    try {
      results.push(await claimAndProcessOrderEvent(row, { requestId: requestId || row.request_id, actor: { id: null, role: "system" } }));
    } catch (error) {
      results.push({ durableEventId: row.id, orderId: row.order_id, errorCode: safeErrorCode(error, "ORDER_EVENT_PROCESSING_FAILED") });
    }
  }
  return { processed: results.length, results };
}

export async function completeOrderInvoiceAllocation({ orderId, expectedSubOrderCount, requestId = null }) {
  const completed = requireData(await supabaseAdmin.rpc("complete_order_invoice_allocation", {
    p_order_id: orderId,
    p_expected_sub_order_count: expectedSubOrderCount
  }), "complete_order_invoice_allocation");
  const order = Array.isArray(completed) ? completed[0] : completed;
  const pendingEvents = await processPendingOrderInvoiceEvents({ orderId, limit: 25, requestId });
  return { order, pendingEvents };
}

export async function planInvoiceReturn({
  originalInvoiceId,
  items: requestedItems,
  reasonCode = null,
  reasonNote = null,
  idempotencyToken,
  requestId,
  actor
}) {
  const original = requireData(await supabaseAdmin.from("invoices").select("*").eq("id", originalInvoiceId).maybeSingle(), "load_original_return_invoice");
  if (!original) {
    throw new EInvoicingError("Orijinal fatura bulunamadı.", { code: "ORIGINAL_INVOICE_NOT_FOUND", statusCode: 404, retryable: false });
  }
  if (!["ISSUED", "SENT", "ACCEPTED"].includes(original.status)) {
    throw new EInvoicingError("Fatura iade belgesi için uygun durumda değil.", {
      code: "INVOICE_NOT_RETURNABLE",
      statusCode: 409,
      retryable: false,
      details: { status: original.status }
    });
  }
  if (original.document_scope !== "CUSTOMER_SALE" || !["E_INVOICE", "E_ARCHIVE"].includes(original.document_type)) {
    throw new EInvoicingError("Yalnız müşteri satış faturaları için iade belgesi oluşturulabilir.", {
      code: "RETURN_DOCUMENT_SCOPE_INVALID",
      statusCode: 409,
      retryable: false
    });
  }
  if (!original.provider_account_id || !original.invoice_profile_id) {
    throw new EInvoicingError("Orijinal faturanın provider veya profil bağlantısı eksik.", {
      code: "RETURN_PROVIDER_CONTEXT_MISSING",
      statusCode: 409,
      retryable: false
    });
  }
  const token = String(idempotencyToken || "").trim();
  if (!token) {
    throw new EInvoicingError("İade isteği idempotency anahtarı zorunludur.", { code: "RETURN_IDEMPOTENCY_REQUIRED", statusCode: 422, retryable: false });
  }
  const idempotencyKey = `invoice:return:${original.organization_id}:${original.id}:${deterministicHex(token, 40)}`;
  const requestFingerprint = deterministicHex(JSON.stringify({
    items: (requestedItems || [])
      .map((item) => ({ id: String(item.originalInvoiceItemId || ""), quantity: String(item.quantity || "") }))
      .sort((left, right) => `${left.id}:${left.quantity}`.localeCompare(`${right.id}:${right.quantity}`)),
    reasonCode: reasonCode || null,
    reasonNote: reasonNote || null
  }), 64);
  const provider = runtimeInvoiceProvider(original.provider);
  requireProviderCapability(provider, "returns");
  const returnProviderAccount = requireData(await supabaseAdmin
    .from("invoice_provider_accounts")
    .select("*")
    .eq("id", original.provider_account_id)
    .single(), "load_return_provider_account");
  const returnSettings = await loadApplicableInvoiceSettings(original);

  let existingInvoice = requireData(await supabaseAdmin.from("invoices").select("*").eq("idempotency_key", idempotencyKey).maybeSingle(), "load_existing_return_invoice");
  if (existingInvoice) {
    let existingWorkflow = requireData(await supabaseAdmin.from("invoice_returns").select("*").eq("idempotency_key", idempotencyKey).maybeSingle(), "load_existing_return_workflow");
    const existingJob = requireData(await supabaseAdmin.from("invoice_jobs").select("*").eq("invoice_id", existingInvoice.id).eq("job_type", "CREATE_RETURN_DOCUMENT").maybeSingle(), "load_existing_return_job");
    if (!existingWorkflow) {
      throw new EInvoicingError("Önceki idempotent iade isteği eksik kaldı ve manuel inceleme gerekiyor.", {
        code: "RETURN_WORKFLOW_INCOMPLETE",
        statusCode: 409,
        retryable: false,
        details: { invoiceId: existingInvoice.id }
      });
    }
    if (existingWorkflow.status === "REJECTED") {
      throw new EInvoicingError("Reddedilmiş iade isteğinin idempotency anahtarı yeniden kullanılamaz.", {
        code: "RETURN_REQUEST_REJECTED",
        statusCode: 409,
        retryable: false,
        details: { invoiceReturnId: existingWorkflow.id }
      });
    }
    await reserveInvoiceDocumentOperation(original.id, "RETURN");
    if (existingWorkflow.request_fingerprint !== requestFingerprint) {
      throw new EInvoicingError("Aynı idempotency anahtarı farklı bir iade içeriğiyle kullanılamaz.", {
        code: "RETURN_IDEMPOTENCY_PAYLOAD_CONFLICT",
        statusCode: 409,
        retryable: false
      });
    }
    if (existingJob || existingWorkflow.status === "COMPLETED" || ["ISSUED", "SENT", "ACCEPTED"].includes(existingInvoice.status)) {
      return { invoice: existingInvoice, invoiceReturn: existingWorkflow, job: existingJob, duplicate: true, repaired: false };
    }
    assertProviderOutboundEnabled(original, returnProviderAccount);
    const [invoiceItemsResult, workflowItemsResult] = await Promise.all([
      supabaseAdmin.from("invoice_items").select("id").eq("invoice_id", existingInvoice.id).limit(1),
      supabaseAdmin.from("invoice_return_items").select("id").eq("invoice_return_id", existingWorkflow.id).limit(1)
    ]);
    const invoiceItems = requireData(invoiceItemsResult, "load_existing_return_invoice_items");
    const workflowItems = requireData(workflowItemsResult, "load_existing_return_workflow_items");
    if (!invoiceItems.length || !workflowItems.length || existingInvoice.status === "PROCESSING" || existingWorkflow.status === "PROCESSING") {
      throw new EInvoicingError("Eksik veya işlenmekte olan iade planı otomatik onarılamadı.", {
        code: "RETURN_PLAN_REPAIR_UNSAFE",
        statusCode: 409,
        retryable: false,
        details: { invoiceId: existingInvoice.id, workflowId: existingWorkflow.id }
      });
    }
    if (["REQUESTED", "REVIEW", "FAILED", "NEEDS_REVIEW"].includes(existingWorkflow.status)) {
      existingWorkflow = await transitionWorkflow("invoice_returns", existingWorkflow.id, "QUEUED", [existingWorkflow.status]);
    }
    if (["DRAFT", "FAILED", "NEEDS_REVIEW"].includes(existingInvoice.status)) {
      existingInvoice = await transitionInvoice(existingInvoice, "QUEUED", { error_code: null, error_message: null }, {
        action: "invoice.return_plan_repaired",
        requestId,
        actor,
        metadata: { invoice_return_id: existingWorkflow.id }
      });
    }
    if (existingInvoice.status !== "QUEUED" || existingWorkflow.status !== "QUEUED") {
      throw new EInvoicingError("İade planı otomatik olarak kuyruğa alınamadı.", { code: "RETURN_PLAN_REPAIR_FAILED", statusCode: 409, retryable: false });
    }
    const repairedJob = await enqueueInvoiceJob({
      invoice: existingInvoice,
      jobType: "CREATE_RETURN_DOCUMENT",
      requestId,
      scope: `return:${existingWorkflow.id}`,
      payload: { invoiceReturnId: existingWorkflow.id, invoiceSettingsId: returnSettings?.id || null },
      maxAttempts: returnSettings?.max_retry_count || 4
    });
    return { invoice: existingInvoice, invoiceReturn: existingWorkflow, job: repairedJob.job, duplicate: true, repaired: true };
  }

  assertProviderOutboundEnabled(original, returnProviderAccount);

  const exactReturn = requireData(await supabaseAdmin.rpc("get_invoice_return_amounts", {
    p_invoice_id: original.id
  }), "load_invoice_return_amounts");
  const originalItems = exactReturn?.items || [];
  if (!originalItems?.length) {
    throw new EInvoicingError("Orijinal fatura kalemleri bulunamadı.", { code: "ORIGINAL_INVOICE_ITEMS_MISSING", statusCode: 409, retryable: false });
  }

  const requestedById = new Map();
  for (const requested of requestedItems || []) {
    if (requestedById.has(requested.originalInvoiceItemId)) {
      throw new EInvoicingError("Aynı fatura kalemi iade isteğinde birden fazla kez kullanılamaz.", {
        code: "DUPLICATE_RETURN_ITEM",
        statusCode: 422,
        retryable: false
      });
    }
    requestedById.set(requested.originalInvoiceItemId, String(requested.quantity));
  }
  if (!requestedById.size) {
    throw new EInvoicingError("En az bir iade kalemi zorunludur.", { code: "RETURN_ITEMS_REQUIRED", statusCode: 422, retryable: false });
  }
  const originalById = new Map(originalItems.map((item) => [item.id, item]));
  for (const itemId of requestedById.keys()) {
    if (!originalById.has(itemId)) {
      throw new EInvoicingError("İade kalemi orijinal faturaya ait değil.", {
        code: "RETURN_ITEM_INVOICE_MISMATCH",
        statusCode: 409,
        retryable: false,
        details: { originalInvoiceItemId: itemId }
      });
    }
  }

  const priorRows = exactReturn?.prior_items || [];
  const priorByItem = new Map();
  for (const row of priorRows || []) {
    const list = priorByItem.get(row.original_invoice_item_id) || [];
    list.push(row);
    priorByItem.set(row.original_invoice_item_id, list);
  }

  const invoiceLines = [];
  const workflowLines = [];
  for (const [itemId, requestedQuantity] of requestedById.entries()) {
    const originalItem = originalById.get(itemId);
    const originalQuantity = decimalToInteger(originalItem.quantity, 4);
    const requestQuantity = decimalToInteger(requestedQuantity, 4);
    if (requestQuantity <= 0n) {
      throw new EInvoicingError("İade adedi sıfırdan büyük olmalıdır.", { code: "INVALID_RETURN_QUANTITY", statusCode: 422, retryable: false });
    }
    const unitPrice = decimalToInteger(originalItem.unit_price, 4);
    const prior = priorByItem.get(itemId) || [];
    const priorQuantity = prior.reduce((total, row) => total + decimalToInteger(row.quantity, 4), 0n);
    const remainingQuantity = originalQuantity - priorQuantity;
    if (remainingQuantity <= 0n || requestQuantity > remainingQuantity) {
      throw new EInvoicingError("İade adedi kalan fatura adedini aşıyor.", {
        code: "RETURN_QUANTITY_EXCEEDED",
        statusCode: 409,
        retryable: false,
        details: {
          originalInvoiceItemId: itemId,
          requested: integerToDecimal(requestQuantity, 4),
          remaining: integerToDecimal(remainingQuantity < 0n ? 0n : remainingQuantity, 4)
        }
      });
    }

    const originalDiscount = decimalToInteger(originalItem.discount_amount, 2);
    const originalTax = decimalToInteger(originalItem.tax_amount, 2);
    const priorDiscount = prior.reduce((total, row) => {
      const returnedQuantity = decimalToInteger(row.quantity, 4);
      const returnedGross = roundDivide(returnedQuantity * unitPrice, 1_000_000n);
      return total + (returnedGross - decimalToInteger(row.amount, 2));
    }, 0n);
    const priorTax = prior.reduce((total, row) => total + decimalToInteger(row.tax_amount, 2), 0n);
    const remainingDiscount = originalDiscount - priorDiscount;
    const remainingTax = originalTax - priorTax;
    if (remainingDiscount < 0n || remainingTax < 0n) {
      throw new EInvoicingError("Önceki iade dağılımı orijinal fatura tutarlarıyla uyuşmuyor.", {
        code: "RETURN_ALLOCATION_INCONSISTENT",
        statusCode: 409,
        retryable: false,
        details: { originalInvoiceItemId: itemId }
      });
    }
    const discountMinor = requestQuantity === remainingQuantity
      ? remainingDiscount
      : roundDivide(remainingDiscount * requestQuantity, remainingQuantity);
    const calculated = calculateInvoiceLine({
      quantity: integerToDecimal(requestQuantity, 4),
      unitPrice: originalItem.unit_price,
      discountAmount: integerToDecimal(discountMinor, 2),
      taxRate: originalItem.tax_rate
    });
    const calculatedTax = decimalToInteger(calculated.tax, 2);
    const taxMinor = requestQuantity === remainingQuantity
      ? remainingTax
      : (calculatedTax > remainingTax ? remainingTax : calculatedTax);
    const taxableMinor = decimalToInteger(calculated.taxable, 2);
    const line = {
      gross: calculated.gross,
      discount: calculated.discount,
      taxable: calculated.taxable,
      tax: integerToDecimal(taxMinor, 2),
      total: integerToDecimal(taxableMinor + taxMinor, 2)
    };
    invoiceLines.push({
      invoice_id: null,
      order_item_id: originalItem.order_item_id,
      product_id: originalItem.product_id,
      sku: originalItem.sku,
      barcode: originalItem.barcode,
      description: originalItem.description,
      quantity: integerToDecimal(requestQuantity, 4),
      unit_code: originalItem.unit_code,
      unit_price: String(originalItem.unit_price),
      discount_amount: line.discount,
      tax_rate: String(originalItem.tax_rate),
      tax_amount: line.tax,
      line_total: line.total,
      calculated: line
    });
    workflowLines.push({
      original_invoice_item_id: itemId,
      quantity: integerToDecimal(requestQuantity, 4),
      amount: line.taxable,
      tax_amount: line.tax
    });
  }

  const totals = sumInvoiceLines(invoiceLines.map((line) => line.calculated));
  const returnInvoiceRow = {
    organization_id: original.organization_id,
    legal_entity_id: original.legal_entity_id,
    seller_id: original.seller_id,
    order_id: original.order_id,
    sub_order_id: original.sub_order_id,
    customer_id: original.customer_id,
    customer_invoice_profile_id: original.customer_invoice_profile_id,
    sales_channel: original.sales_channel,
    sales_channel_account_id: original.sales_channel_account_id,
    sales_channel_order_id: original.sales_channel_order_id,
    provider: original.provider,
    provider_account_id: original.provider_account_id,
    invoice_profile_id: original.invoice_profile_id,
    document_scope: "RETURN",
    original_invoice_id: original.id,
    document_type: "RETURN",
    scenario: original.scenario,
    issue_date: new Date().toISOString().slice(0, 10),
    currency: original.currency,
    subtotal: totals.subtotal,
    discount_total: totals.discountTotal,
    shipping_total: "0.00",
    tax_total: totals.taxTotal,
    grand_total: totals.grandTotal,
    customer_profile_snapshot: original.customer_profile_snapshot || {},
    idempotency_key: idempotencyKey
  };

  await reserveInvoiceDocumentOperation(original.id, "RETURN");
  const inserted = await supabaseAdmin.from("invoices").insert(returnInvoiceRow).select("*").single();
  if (inserted.error?.code === "23505") {
    const existingInvoice = requireData(await supabaseAdmin.from("invoices").select("*").eq("idempotency_key", idempotencyKey).single(), "load_duplicate_return_invoice");
    const existingWorkflow = requireData(await supabaseAdmin.from("invoice_returns").select("*").eq("idempotency_key", idempotencyKey).maybeSingle(), "load_duplicate_return_workflow");
    const existingJob = existingWorkflow
      ? requireData(await supabaseAdmin.from("invoice_jobs").select("*").eq("invoice_id", existingInvoice.id).eq("job_type", "CREATE_RETURN_DOCUMENT").maybeSingle(), "load_duplicate_return_job")
      : null;
    if (!existingWorkflow) {
      throw new EInvoicingError("İade planı eş zamanlı olarak oluşturuluyor; aynı istek güvenle tekrar denenebilir.", {
        code: "RETURN_REQUEST_IN_PROGRESS",
        statusCode: 409,
        retryable: true,
        details: { invoiceId: existingInvoice.id }
      });
    }
    if (existingWorkflow.request_fingerprint !== requestFingerprint) {
      throw new EInvoicingError("Eş zamanlı iade isteği farklı bir içerik taşıyor.", { code: "RETURN_IDEMPOTENCY_PAYLOAD_CONFLICT", statusCode: 409, retryable: false });
    }
    if (existingJob || existingWorkflow.status === "COMPLETED" || ["ISSUED", "SENT", "ACCEPTED"].includes(existingInvoice.status)) {
      return { invoice: existingInvoice, invoiceReturn: existingWorkflow, job: existingJob, duplicate: true, repaired: false };
    }
    throw new EInvoicingError("İade planı henüz kuyruğa alınıyor; aynı istek güvenle tekrar denenebilir.", {
      code: "RETURN_REQUEST_IN_PROGRESS",
      statusCode: 409,
      retryable: true,
      details: { invoiceId: existingInvoice.id, workflowId: existingWorkflow.id }
    });
  }
  const returnInvoice = requireData(inserted, "insert_return_invoice");
  let workflow = null;
  try {
    workflow = requireData(await supabaseAdmin.from("invoice_returns").insert({
      organization_id: original.organization_id,
      original_invoice_id: original.id,
      return_invoice_id: returnInvoice.id,
      order_id: original.order_id,
      reason_code: reasonCode || null,
      reason_note: reasonNote || null,
      idempotency_key: idempotencyKey,
      request_fingerprint: requestFingerprint,
      currency: original.currency,
      subtotal: totals.subtotal,
      tax_total: totals.taxTotal,
      grand_total: totals.grandTotal,
      status: "REQUESTED",
      requested_by: actor?.id || null
    }).select("*").single(), "insert_return_workflow");
    requireData(await supabaseAdmin.from("invoice_return_items").insert(workflowLines.map((line) => ({ ...line, invoice_return_id: workflow.id }))), "insert_return_workflow_items");
    requireData(await supabaseAdmin.from("invoice_items").insert(invoiceLines.map(({ calculated, ...line }) => ({ ...line, invoice_id: returnInvoice.id }))), "insert_return_invoice_items");
    workflow = await transitionWorkflow("invoice_returns", workflow.id, "QUEUED", ["REQUESTED"]);
    await appendInvoiceEvent({
      invoice: returnInvoice,
      action: "invoice.return_draft_created",
      requestId,
      actor,
      newState: { status: "DRAFT" },
      metadata: { original_invoice_id: original.id, invoice_return_id: workflow.id }
    });
    const queued = await transitionInvoice(returnInvoice, "QUEUED", {}, { action: "invoice.return_queued", requestId, actor });
    const enqueued = await enqueueInvoiceJob({
      invoice: queued,
      jobType: "CREATE_RETURN_DOCUMENT",
      requestId,
      scope: `return:${workflow.id}`,
      payload: { invoiceReturnId: workflow.id, invoiceSettingsId: returnSettings?.id || null },
      maxAttempts: returnSettings?.max_retry_count || 4
    });
    return { invoice: queued, invoiceReturn: workflow, job: enqueued.job, duplicate: false };
  } catch (error) {
    await bestEffortMarkInvoiceNeedsReview({ invoiceId: returnInvoice.id, error, requestId, actor, action: "invoice.return_plan_incomplete" });
    await bestEffortMarkWorkflowNeedsReview("invoice_returns", workflow?.id);
    throw error;
  }
}

async function repairExistingCancellationPlan({ invoice, cancellation, requestId, actor }) {
  const job = requireData(await supabaseAdmin.from("invoice_jobs").select("*").eq("invoice_id", invoice.id).eq("job_type", "CANCEL_DOCUMENT").maybeSingle(), "load_existing_cancellation_job");
  if (job || (invoice.status === "CANCELLED" && cancellation.status === "COMPLETED")) {
    return { invoice, cancellation, job, duplicate: true, repaired: false };
  }
  if (invoice.status === "PROCESSING" || cancellation.status === "PROCESSING") {
    throw new EInvoicingError("İşlenmekte olan iptal planında job kaydı bulunamadı.", {
      code: "CANCELLATION_JOB_INCONSISTENT",
      statusCode: 409,
      retryable: false,
      details: { invoiceId: invoice.id, cancellationId: cancellation.id }
    });
  }
  if (!invoice.provider_document_id || !invoice.provider_account_id) {
    throw new EInvoicingError("Provider belge bağlantısı olmadan iptal planı onarılamaz.", { code: "CANCELLATION_PROVIDER_CONTEXT_MISSING", statusCode: 409, retryable: false });
  }
  const provider = runtimeInvoiceProvider(invoice.provider);
  requireProviderCapability(provider, "cancellation");
  const providerAccount = requireData(await supabaseAdmin.from("invoice_provider_accounts").select("*").eq("id", invoice.provider_account_id).single(), "load_repair_cancellation_provider_account");
  assertProviderOutboundEnabled(invoice, providerAccount);
  const settings = await loadApplicableInvoiceSettings(invoice);

  let repairedWorkflow = cancellation;
  if (["REQUESTED", "REVIEW", "FAILED", "NEEDS_REVIEW"].includes(repairedWorkflow.status)) {
    repairedWorkflow = await transitionWorkflow("invoice_cancellations", repairedWorkflow.id, "QUEUED", [repairedWorkflow.status]);
  }
  let repairedInvoice = invoice;
  if (["ISSUED", "SENT", "ACCEPTED", "RETURNED", "NEEDS_REVIEW"].includes(repairedInvoice.status)) {
    repairedInvoice = await transitionInvoice(repairedInvoice, "CANCEL_PENDING", { error_code: null, error_message: null }, {
      action: "invoice.cancellation_plan_repaired",
      requestId,
      actor,
      metadata: { cancellation_id: repairedWorkflow.id }
    });
  }
  if (repairedInvoice.status !== "CANCEL_PENDING" || repairedWorkflow.status !== "QUEUED") {
    throw new EInvoicingError("İptal planı otomatik olarak kuyruğa alınamadı.", { code: "CANCELLATION_PLAN_REPAIR_FAILED", statusCode: 409, retryable: false });
  }
  const repairedJob = await enqueueInvoiceJob({
    invoice: repairedInvoice,
    jobType: "CANCEL_DOCUMENT",
    requestId,
    scope: `cancellation:${repairedWorkflow.id}`,
    payload: { cancellationId: repairedWorkflow.id, reason: repairedWorkflow.reason_note || repairedWorkflow.reason_code || "", invoiceSettingsId: settings?.id || null },
    maxAttempts: settings?.max_retry_count || 4
  });
  return { invoice: repairedInvoice, cancellation: repairedWorkflow, job: repairedJob.job, duplicate: true, repaired: true };
}

export async function requestInvoiceCancellation({ invoiceId, reasonCode = null, reasonNote = null, requestId, actor }) {
  let invoice = requireData(await supabaseAdmin.from("invoices").select("*").eq("id", invoiceId).maybeSingle(), "load_cancellation_invoice");
  if (!invoice) throw new EInvoicingError("Fatura bulunamadı.", { code: "INVOICE_NOT_FOUND", statusCode: 404, retryable: false });
  const requestFingerprint = deterministicHex(JSON.stringify({ reasonCode: reasonCode || null, reasonNote: reasonNote || null }), 64);
  const existing = requireData(await supabaseAdmin.from("invoice_cancellations").select("*").eq("invoice_id", invoice.id).maybeSingle(), "load_existing_cancellation");
  if (existing) {
    await reserveInvoiceDocumentOperation(invoice.id, "CANCELLATION");
    if (existing.request_fingerprint !== requestFingerprint) {
      throw new EInvoicingError("Mevcut iptal isteği farklı bir gerekçeyle tekrar kullanılamaz.", { code: "CANCELLATION_REQUEST_CONFLICT", statusCode: 409, retryable: false });
    }
    return repairExistingCancellationPlan({ invoice, cancellation: existing, requestId, actor });
  }
  assertInvoiceTransition(invoice.status, "CANCEL_PENDING");
  if (!invoice.provider_document_id || !invoice.provider_account_id) {
    throw new EInvoicingError("Provider belge bağlantısı olmadan iptal başlatılamaz.", { code: "CANCELLATION_PROVIDER_CONTEXT_MISSING", statusCode: 409, retryable: false });
  }
  const provider = runtimeInvoiceProvider(invoice.provider);
  requireProviderCapability(provider, "cancellation");
  const providerAccount = requireData(await supabaseAdmin.from("invoice_provider_accounts").select("*").eq("id", invoice.provider_account_id).single(), "load_cancellation_provider_account");
  assertProviderOutboundEnabled(invoice, providerAccount);
  const cancellationSettings = await loadApplicableInvoiceSettings(invoice);
  await reserveInvoiceDocumentOperation(invoice.id, "CANCELLATION");

  const inserted = await supabaseAdmin.from("invoice_cancellations").insert({
    organization_id: invoice.organization_id,
    invoice_id: invoice.id,
    order_id: invoice.order_id,
    reason_code: reasonCode || null,
    reason_note: reasonNote || null,
    request_fingerprint: requestFingerprint,
    status: "REQUESTED",
    requested_by: actor?.id || null
  }).select("*").single();
  if (inserted.error?.code === "23505") {
    const cancellation = requireData(await supabaseAdmin.from("invoice_cancellations").select("*").eq("invoice_id", invoice.id).single(), "load_concurrent_cancellation");
    if (cancellation.request_fingerprint !== requestFingerprint) {
      throw new EInvoicingError("Eş zamanlı iptal isteği farklı bir gerekçe içeriyor.", { code: "CANCELLATION_REQUEST_CONFLICT", statusCode: 409, retryable: false });
    }
    throw new EInvoicingError("Aynı fatura için iptal planı eş zamanlı olarak oluşturuluyor; aynı istek güvenle tekrar denenebilir.", {
      code: "CANCELLATION_REQUEST_IN_PROGRESS",
      statusCode: 409,
      retryable: true,
      details: { cancellationId: cancellation.id }
    });
  }
  let cancellation = requireData(inserted, "insert_invoice_cancellation");
  try {
    invoice = await transitionInvoice(invoice, "CANCEL_PENDING", {}, {
      action: "invoice.cancellation_requested",
      requestId,
      actor,
      metadata: { cancellation_id: cancellation.id, reason_code: reasonCode || null }
    });
    cancellation = await transitionWorkflow("invoice_cancellations", cancellation.id, "QUEUED", ["REQUESTED"]);
    const enqueued = await enqueueInvoiceJob({
      invoice,
      jobType: "CANCEL_DOCUMENT",
      requestId,
      scope: `cancellation:${cancellation.id}`,
      payload: { cancellationId: cancellation.id, reason: reasonNote || reasonCode || "", invoiceSettingsId: cancellationSettings?.id || null },
      maxAttempts: cancellationSettings?.max_retry_count || 4
    });
    return { invoice, cancellation, job: enqueued.job, duplicate: false };
  } catch (error) {
    await bestEffortMarkWorkflowNeedsReview("invoice_cancellations", cancellation.id);
    await bestEffortMarkInvoiceNeedsReview({ invoiceId: invoice.id, error, requestId, actor, action: "invoice.cancellation_plan_incomplete" });
    throw error;
  }
}

async function loadJobInvoice(job) {
  const invoice = requireData(await supabaseAdmin.from("invoices").select("*").eq("id", job.invoice_id).single(), "load_job_invoice");
  const [items, providerAccount, settings] = await Promise.all([
    supabaseAdmin.from("invoice_items").select("*").eq("invoice_id", invoice.id).order("created_at"),
    supabaseAdmin.from("invoice_provider_accounts").select("*").eq("id", invoice.provider_account_id).single(),
    loadApplicableInvoiceSettings(invoice)
  ]);
  return {
    invoice,
    items: requireData(items, "load_job_invoice_items"),
    providerAccount: requireData(providerAccount, "load_job_provider_account"),
    settings
  };
}

function assertProviderAccountOperational(invoice, providerAccount) {
  if (!providerAccount
      || providerAccount.id !== invoice.provider_account_id
      || providerAccount.organization_id !== invoice.organization_id
      || providerAccount.legal_entity_id !== invoice.legal_entity_id
      || providerAccount.provider_key !== invoice.provider) {
    throw new EInvoicingError("Fatura provider hesabı tenant bağlamıyla uyuşmuyor.", {
      code: "INVOICE_PROVIDER_ACCOUNT_MISMATCH",
      statusCode: 409,
      retryable: false
    });
  }
  if (providerAccount.status !== "connected") {
    throw new EInvoicingError("Fatura provider hesabı bağlı değil.", {
      code: "INVOICE_PROVIDER_ACCOUNT_NOT_CONNECTED",
      statusCode: 409,
      retryable: false
    });
  }
  if (providerAccount.provider_key === "mock" && providerAccount.environment !== "mock") {
    throw new EInvoicingError("Mock provider ortamı tutarsız.", { code: "MOCK_PROVIDER_ENVIRONMENT_INVALID", statusCode: 409, retryable: false });
  }
  if (providerAccount.provider_key !== "mock" && !["sandbox", "production"].includes(providerAccount.environment)) {
    throw new EInvoicingError("Provider ortamı tutarsız.", { code: "PROVIDER_ENVIRONMENT_INVALID", statusCode: 409, retryable: false });
  }
}

function assertProviderOutboundEnabled(invoice, providerAccount) {
  assertProviderAccountOperational(invoice, providerAccount);
  if (providerAccount.environment === "production" && !config.eInvoicing.providerCallsEnabled) {
    throw new EInvoicingError("Production provider çağrıları kapalı.", { code: "PRODUCTION_PROVIDER_CALLS_DISABLED", statusCode: 503, retryable: false });
  }
}

async function providerCredentials(providerAccount) {
  if (providerAccount.provider_key === "mock") return null;
  if (!providerAccount.credential_reference) {
    throw new EInvoicingError("Provider credential reference eksik.", { code: "CREDENTIAL_REFERENCE_REQUIRED", statusCode: 409, retryable: false });
  }
  return resolveBoundCredential({
    db: supabaseAdmin,
    reference: providerAccount.credential_reference,
    organizationId: providerAccount.organization_id,
    legalEntityId: providerAccount.legal_entity_id,
    integrationType: "invoice_provider",
    integrationKey: providerAccount.provider_key,
    purpose: "api"
  });
}

function providerPayload(invoice, items) {
  return {
    idempotencyKey: invoice.idempotency_key,
    documentType: invoice.document_type,
    issueDate: invoice.issue_date || new Date().toISOString().slice(0, 10),
    currency: invoice.currency,
    subtotal: String(invoice.subtotal),
    discountTotal: String(invoice.discount_total),
    shippingTotal: String(invoice.shipping_total),
    shippingTaxRate: invoice.shipping_tax_rate === null ? null : String(invoice.shipping_tax_rate),
    shippingTaxAmount: String(invoice.shipping_tax_amount || "0.00"),
    taxTotal: String(invoice.tax_total),
    grandTotal: String(invoice.grand_total),
    customer: invoice.customer_profile_snapshot,
    items: items.map((item) => ({
      description: item.description,
      quantity: String(item.quantity),
      unitCode: item.unit_code,
      unitPrice: String(item.unit_price),
      discountAmount: String(item.discount_amount),
      taxRate: String(item.tax_rate),
      taxAmount: String(item.tax_amount),
      lineTotal: String(item.line_total)
    }))
  };
}

async function storeArtifact(invoice, kind, data) {
  const extension = kind === "pdf" ? "pdf" : "xml";
  const contentType = kind === "pdf" ? "application/pdf" : "application/xml";
  const path = `${invoice.organization_id}/${invoice.legal_entity_id}/${invoice.id}/${kind}.${extension}`;
  const { error } = await supabaseAdmin.storage.from(DOCUMENT_BUCKET).upload(path, data, {
    contentType,
    upsert: true,
    cacheControl: "private, max-age=0, no-store"
  });
  if (error) throw new EInvoicingError("Fatura belgesi private storage alanına yazılamadı.", { code: "INVOICE_ARTIFACT_STORAGE_FAILED", statusCode: 503, retryable: true });
  return path;
}

async function markOriginalReturnedIfFullyReturned(originalInvoiceId, requestId) {
  if (!originalInvoiceId) return false;
  const [originalResult, fullyReturnedResult] = await Promise.all([
    supabaseAdmin.from("invoices").select("*").eq("id", originalInvoiceId).maybeSingle(),
    supabaseAdmin.rpc("invoice_is_fully_returned", { p_invoice_id: originalInvoiceId })
  ]);
  const original = requireData(originalResult, "load_returned_original_invoice");
  const fullyReturned = requireData(fullyReturnedResult, "check_invoice_fully_returned") === true;
  if (!original) return false;
  if (!fullyReturned || original.status === "RETURNED") return fullyReturned;
  if (canSafeTransition(original.status, "RETURNED")) {
    await transitionInvoice(original, "RETURNED", {}, {
      action: "invoice.full_return_completed",
      requestId,
      metadata: { quantity_check: "database_exact" }
    });
  }
  return fullyReturned;
}

async function processCreateDocument(job) {
  const context = await loadJobInvoice(job);
  let invoice = context.invoice;
  if (["ISSUED", "SENT", "ACCEPTED"].includes(invoice.status) && invoice.provider_document_id) {
    if (invoice.document_type === "RETURN" && job.payload?.invoiceReturnId) {
      const workflow = requireData(await supabaseAdmin.from("invoice_returns").select("*").eq("id", job.payload.invoiceReturnId).single(), "load_issued_return_workflow");
      if (workflow.status !== "COMPLETED") {
        await ensureWorkflowProcessing("invoice_returns", workflow.id);
        await transitionWorkflow("invoice_returns", workflow.id, "COMPLETED", ["PROCESSING"], { return_invoice_id: invoice.id });
      }
      await markOriginalReturnedIfFullyReturned(invoice.original_invoice_id, job.request_id);
    }
    if (invoice.status === "ISSUED" && context.settings?.auto_upload_to_channel) {
      await enqueueInvoiceJob({
        invoice,
        jobType: "UPLOAD_TO_CHANNEL",
        requestId: job.request_id,
        scope: "initial_upload",
        maxAttempts: context.settings.max_retry_count || 4
      });
    }
    return { invoiceId: invoice.id, status: invoice.status, providerDocumentId: invoice.provider_document_id, idempotent: true };
  }
  assertProviderAccountOperational(invoice, context.providerAccount);
  if (!context.settings) {
    throw new EInvoicingError("Fatura ayarı artık etkin değil; belge oluşturma manuel incelemeye alındı.", {
      code: "INVOICE_SETTINGS_INACTIVE",
      statusCode: 409,
      retryable: false
    });
  }
  if (invoice.document_type === "RETURN" && job.payload?.invoiceReturnId) {
    await ensureWorkflowProcessing("invoice_returns", job.payload.invoiceReturnId);
  }
  if (invoice.status === "QUEUED") {
    invoice = await transitionInvoice(invoice, "PROCESSING", {}, { action: "invoice.processing", requestId: job.request_id });
  }
  if (invoice.status !== "PROCESSING") {
    throw new EInvoicingError("Fatura create job için uygun durumda değil.", { code: "INVOICE_NOT_PROCESSABLE", statusCode: 409, retryable: false });
  }
  if (context.providerAccount.environment === "production" && !config.eInvoicing.providerCallsEnabled) {
    throw new EInvoicingError("Production provider çağrıları kapalı.", { code: "PRODUCTION_PROVIDER_CALLS_DISABLED", statusCode: 503, retryable: false });
  }
  const provider = runtimeInvoiceProvider(context.providerAccount.provider_key);
  requireProviderCapability(provider, "idempotentCreate");
  requireProviderCapability(provider, "synchronousArtifacts");
  requireProviderCapability(provider, invoice.document_type === "E_INVOICE"
    ? "eInvoice"
    : invoice.document_type === "RETURN"
      ? "returns"
      : "eArchive");
  const credentials = await providerCredentials(context.providerAccount);
  const payload = providerPayload(invoice, context.items);
  let originalProviderContext = null;
  if (invoice.document_type === "RETURN") {
    originalProviderContext = requireData(await supabaseAdmin.from("invoices")
      .select("id, provider_document_id, ettn_uuid, invoice_number")
      .eq("id", invoice.original_invoice_id)
      .maybeSingle(), "load_return_original_provider_context");
    if (!originalProviderContext?.provider_document_id || !originalProviderContext.ettn_uuid || !originalProviderContext.invoice_number) {
      throw new EInvoicingError("İade belgesi için orijinal provider belge kimliği eksik.", {
        code: "RETURN_ORIGINAL_PROVIDER_CONTEXT_MISSING",
        statusCode: 409,
        retryable: false
      });
    }
    await authorizeProviderCall(job, originalProviderContext.id, "RETURN");
  }
  const result = invoice.document_type === "E_INVOICE"
    ? await provider.createEInvoice({ ...payload, credentials, environment: context.providerAccount.environment })
    : invoice.document_type === "RETURN"
      ? await provider.createReturnDocument({
          ...payload,
          credentials,
          environment: context.providerAccount.environment,
          originalInvoiceId: originalProviderContext.id,
          originalProviderDocumentId: originalProviderContext.provider_document_id,
          originalEttnUuid: originalProviderContext.ettn_uuid,
          originalInvoiceNumber: originalProviderContext.invoice_number
        })
      : await provider.createEArchiveInvoice({ ...payload, credentials, environment: context.providerAccount.environment });
  if (
    String(result?.status || "").toUpperCase() !== "ISSUED"
    || !result?.providerDocumentId
    || !result?.ettnUuid
    || !result?.invoiceNumber
    || !result?.pdf
    || !result?.xml
  ) {
    throw new EInvoicingError("Provider senkron ve eksiksiz ISSUED belge sonucu döndürmedi.", {
      code: "PROVIDER_ISSUE_RESULT_INCOMPLETE",
      statusCode: 502,
      retryable: false
    });
  }
  const [pdfReference, xmlReference] = await Promise.all([
    storeArtifact(invoice, "pdf", result.pdf),
    storeArtifact(invoice, "xml", result.xml)
  ]);
  const issued = await transitionInvoice(invoice, "ISSUED", {
    provider_document_id: result.providerDocumentId,
    ettn_uuid: result.ettnUuid,
    invoice_number: result.invoiceNumber,
    issue_date: result.issueDate,
    pdf_reference: pdfReference,
    xml_reference: xmlReference,
    issued_at: new Date().toISOString(),
    error_code: null,
    error_message: null
  }, { action: "invoice.issued", requestId: job.request_id, metadata: { provider: result.provider, production: result.production } });
  if (invoice.document_type === "RETURN" && job.payload?.invoiceReturnId) {
    await transitionWorkflow("invoice_returns", job.payload.invoiceReturnId, "COMPLETED", ["PROCESSING"], { return_invoice_id: issued.id });
    await markOriginalReturnedIfFullyReturned(invoice.original_invoice_id, job.request_id);
  }
  if (context.settings?.auto_upload_to_channel) {
    await enqueueInvoiceJob({ invoice: issued, jobType: "UPLOAD_TO_CHANNEL", requestId: job.request_id, scope: "initial_upload", maxAttempts: context.settings.max_retry_count || 4 });
  }
  return { invoiceId: issued.id, status: issued.status, providerDocumentId: issued.provider_document_id };
}

function canSafeTransition(from, to) {
  try {
    assertInvoiceTransition(from, to);
    return true;
  } catch {
    return false;
  }
}

async function processCancelDocument(job) {
  const { invoice, providerAccount } = await loadJobInvoice(job);
  if (invoice.status === "CANCELLED") {
    if (job.payload?.cancellationId) {
      const workflow = requireData(await supabaseAdmin.from("invoice_cancellations").select("*").eq("id", job.payload.cancellationId).single(), "load_cancelled_workflow");
      if (workflow.status !== "COMPLETED") {
        await ensureWorkflowProcessing("invoice_cancellations", workflow.id);
        await transitionWorkflow("invoice_cancellations", workflow.id, "COMPLETED", ["PROCESSING"], { provider_reference: invoice.provider_document_id });
      }
    }
    return { invoiceId: invoice.id, status: invoice.status, providerDocumentId: invoice.provider_document_id, idempotent: true };
  }
  assertProviderAccountOperational(invoice, providerAccount);
  if (invoice.status !== "CANCEL_PENDING") {
    throw new EInvoicingError("Fatura iptal için uygun durumda değil.", { code: "INVOICE_NOT_CANCELLABLE", statusCode: 409, retryable: false });
  }
  if (!invoice.provider_document_id) {
    throw new EInvoicingError("Provider belge kimliği olmadan iptal yapılamaz.", { code: "PROVIDER_DOCUMENT_ID_MISSING", statusCode: 409, retryable: false });
  }
  if (providerAccount.environment === "production" && !config.eInvoicing.providerCallsEnabled) {
    throw new EInvoicingError("Production provider çağrıları kapalı.", { code: "PRODUCTION_PROVIDER_CALLS_DISABLED", statusCode: 503, retryable: false });
  }
  let cancellationWorkflow = null;
  if (job.payload?.cancellationId) {
    cancellationWorkflow = await ensureWorkflowProcessing("invoice_cancellations", job.payload.cancellationId);
    if (cancellationWorkflow.status === "COMPLETED") {
      const cancelled = await transitionInvoice(invoice, "CANCELLED", { cancelled_at: new Date().toISOString() }, {
        action: "invoice.cancelled",
        requestId: job.request_id,
        metadata: { recovered_from_completed_workflow: true }
      });
      return { invoiceId: cancelled.id, status: cancelled.status, providerDocumentId: cancelled.provider_document_id, idempotent: true };
    }
  }
  const provider = runtimeInvoiceProvider(providerAccount.provider_key);
  requireProviderCapability(provider, "cancellation");
  const credentials = await providerCredentials(providerAccount);
  await authorizeProviderCall(job, invoice.id, "CANCELLATION");
  const result = await provider.cancelDocument({
    providerDocumentId: invoice.provider_document_id,
    reason: job.payload?.reason || "",
    idempotencyKey: job.idempotency_key,
    credentials,
    environment: providerAccount.environment
  });
  const cancellationStatus = String(result?.status || "").toUpperCase();
  if (cancellationStatus !== "CANCELLED") {
    const pending = ["PENDING", "PROCESSING", "CANCEL_PENDING"].includes(cancellationStatus);
    throw new EInvoicingError(
      pending ? "Provider iptal işlemini henüz tamamlamadı." : "Provider iptal sonucunu doğrulamadı.",
      {
        code: pending ? "PROVIDER_CANCELLATION_PENDING" : "PROVIDER_CANCELLATION_UNCONFIRMED",
        statusCode: pending ? 503 : 409,
        retryable: pending
      }
    );
  }
  const cancelled = await completeInvoiceCancellation(invoice, {
    providerReference: result.providerDocumentId || invoice.provider_document_id,
    action: "invoice.cancelled",
    requestId: job.request_id,
    metadata: { provider_status: result.status, cancellation_id: job.payload?.cancellationId || null }
  });
  return { invoiceId: cancelled.id, status: cancelled.status, providerDocumentId: cancelled.provider_document_id };
}

async function processRefreshStatus(job) {
  const { invoice, providerAccount } = await loadJobInvoice(job);
  assertProviderAccountOperational(invoice, providerAccount);
  if (!invoice.provider_document_id) {
    throw new EInvoicingError("Provider belge kimliği olmadan durum sorgulanamaz.", { code: "PROVIDER_DOCUMENT_ID_MISSING", statusCode: 409, retryable: false });
  }
  if (providerAccount.environment === "production" && !config.eInvoicing.providerCallsEnabled) {
    throw new EInvoicingError("Production provider çağrıları kapalı.", { code: "PRODUCTION_PROVIDER_CALLS_DISABLED", statusCode: 503, retryable: false });
  }
  const provider = runtimeInvoiceProvider(providerAccount.provider_key);
  requireProviderCapability(provider, "documentStatus");
  const credentials = await providerCredentials(providerAccount);
  const result = await provider.getDocumentStatus({ providerDocumentId: invoice.provider_document_id, credentials, environment: providerAccount.environment });
  const providerStatus = String(result?.status || "").toUpperCase();
  if (!providerStatus) {
    throw new EInvoicingError("Provider belge durumu boş döndü.", { code: "PROVIDER_STATUS_MISSING", statusCode: 502, retryable: true });
  }
  if (providerStatus === invoice.status) {
    return { invoiceId: invoice.id, status: invoice.status, providerDocumentId: invoice.provider_document_id, unchanged: true };
  }
  if (isStaleProviderStatus(invoice.status, providerStatus)) {
    return { invoiceId: invoice.id, status: invoice.status, providerDocumentId: invoice.provider_document_id, staleProviderStatus: providerStatus };
  }
  if (providerStatus === "CANCELLED" && ["CANCEL_PENDING", "FAILED", "NEEDS_REVIEW", "RETURNED"].includes(invoice.status)) {
    const cancelled = await completeInvoiceCancellation(invoice, {
      providerReference: invoice.provider_document_id,
      action: "invoice.provider_status_cancelled",
      requestId: job.request_id,
      metadata: { provider_status: providerStatus }
    });
    return { invoiceId: cancelled.id, status: cancelled.status, providerDocumentId: cancelled.provider_document_id };
  }
  if (!canSafeTransition(invoice.status, providerStatus)) {
    throw new EInvoicingError("Provider durumu geçerli fatura durum geçişiyle uyuşmuyor.", {
      code: "PROVIDER_STATUS_TRANSITION_INVALID",
      statusCode: 409,
      retryable: false,
      details: { currentStatus: invoice.status, providerStatus }
    });
  }
  const updated = await transitionInvoice(invoice, providerStatus, {}, {
    action: "invoice.provider_status_refreshed",
    requestId: job.request_id,
    metadata: { provider_status: providerStatus }
  });
  return { invoiceId: updated.id, status: updated.status, providerDocumentId: updated.provider_document_id };
}

async function processUploadToChannel(job) {
  const { invoice } = await loadJobInvoice(job);
  if (!["ISSUED", "SENT", "ACCEPTED"].includes(invoice.status)) {
    throw new EInvoicingError("Fatura kanal aktarımı için uygun durumda değil.", { code: "INVOICE_NOT_READY_FOR_CHANNEL_UPLOAD", statusCode: 409, retryable: false });
  }
  const account = requireData(await supabaseAdmin
    .from("sales_channel_accounts")
    .select("*, sales_channels(channel_key)")
    .eq("id", invoice.sales_channel_account_id)
    .single(), "load_upload_channel_account");
  if (account.status !== "connected") {
    throw new EInvoicingError("Satış kanalı hesabı bağlı değil.", { code: "CHANNEL_ACCOUNT_NOT_CONNECTED", statusCode: 409, retryable: false });
  }
  const channelKey = account.sales_channels?.channel_key || invoice.sales_channel;
  const localChannel = ["allonahub", "allona_shop"].includes(channelKey);
  if (!localChannel && !config.eInvoicing.channelCallsEnabled) {
    throw new EInvoicingError("Harici satış kanalı çağrıları kapalı.", { code: "SALES_CHANNEL_CALLS_DISABLED", statusCode: 503, retryable: false });
  }
  const provider = createSalesChannelProvider(channelKey, localChannel ? {
    pushInvoiceMetadata: async () => ({ accepted: true, local: true })
  } : {});
  const capabilities = effectiveSalesChannelCapabilities(channelKey, account.capability_overrides || {});
  const deliveryType = capabilities.invoiceUpload ? "PDF_XML" : capabilities.invoiceMetadata ? "METADATA" : null;
  if (!deliveryType) {
    throw new EInvoicingError("Satış kanalı fatura geri aktarımını desteklemiyor.", { code: "CHANNEL_INVOICE_UPLOAD_UNSUPPORTED", statusCode: 422, retryable: false });
  }
  const renewedLease = requireData(await supabaseAdmin.rpc("renew_invoice_job_lease", {
    p_job_id: job.id,
    p_lock_token: job.lock_token,
    p_lease_seconds: config.eInvoicing.jobLeaseSeconds
  }), "renew_upload_job_lease_before_delivery");
  if (renewedLease !== true) {
    throw new EInvoicingError("Kanal teslimi başlamadan job lease kaybedildi.", { code: "INVOICE_JOB_LEASE_LOST", statusCode: 503, retryable: true });
  }
  const currentJobLease = requireData(await supabaseAdmin.from("invoice_jobs")
    .select("lock_expires_at")
    .eq("id", job.id)
    .eq("status", "PROCESSING")
    .eq("lock_token", job.lock_token)
    .maybeSingle(), "load_upload_job_lease_before_delivery");
  if (!currentJobLease?.lock_expires_at) {
    throw new EInvoicingError("Kanal teslimi için etkin job lease bulunamadı.", { code: "INVOICE_JOB_LEASE_LOST", statusCode: 503, retryable: true });
  }
  const deliveryKey = `invoice:channel-delivery:${invoice.organization_id}:${invoice.id}:${account.id}:${deliveryType.toLowerCase()}`;
  const now = new Date().toISOString();
  const deliveryLeaseExpiresAt = currentJobLease.lock_expires_at;
  let deliveryResult = await supabaseAdmin.from("invoice_channel_deliveries").insert({
    organization_id: invoice.organization_id,
    invoice_id: invoice.id,
    sales_channel_account_id: account.id,
    channel_key: channelKey,
    delivery_type: deliveryType,
    status: "PROCESSING",
    processing_started_at: now,
    lock_expires_at: deliveryLeaseExpiresAt,
    lock_token: job.lock_token,
    job_id: job.id,
    idempotency_key: deliveryKey
  }).select("*").single();
  if (deliveryResult.error?.code === "23505") {
    deliveryResult = await supabaseAdmin.from("invoice_channel_deliveries").select("*").eq("idempotency_key", deliveryKey).single();
  }
  let delivery = requireData(deliveryResult, "claim_invoice_channel_delivery");
  if (delivery.status === "DELIVERED") {
    let recovered = invoice;
    if (invoice.status === "ISSUED") {
      recovered = await transitionInvoice(invoice, "SENT", { sent_at: delivery.delivered_at || now }, { action: "invoice.channel_sent_recovered", requestId: job.request_id, metadata: { channel: channelKey, delivery_id: delivery.id } });
    }
    return { invoiceId: recovered.id, status: recovered.status, channel: channelKey, deliveryId: delivery.id, duplicate: true };
  }
  if (delivery.status === "PROCESSING" && delivery.lock_token !== job.lock_token) {
    const reclaimed = await supabaseAdmin.from("invoice_channel_deliveries")
      .update({ processing_started_at: now, lock_expires_at: deliveryLeaseExpiresAt, lock_token: job.lock_token, job_id: job.id, updated_at: now })
      .eq("id", delivery.id)
      .eq("status", "PROCESSING")
      .lt("lock_expires_at", now)
      .select("*")
      .maybeSingle();
    if (reclaimed.error) throw databaseError(reclaimed.error, "reclaim_invoice_channel_delivery");
    if (!reclaimed.data) throw new EInvoicingError("Satış kanalı teslimi başka bir worker tarafından işleniyor.", { code: "CHANNEL_DELIVERY_IN_PROGRESS", statusCode: 503, retryable: true });
    delivery = reclaimed.data;
  } else if (["PENDING", "FAILED", "NEEDS_REVIEW"].includes(delivery.status)) {
    const reclaimed = await supabaseAdmin.from("invoice_channel_deliveries")
      .update({ status: "PROCESSING", processing_started_at: now, lock_expires_at: deliveryLeaseExpiresAt, lock_token: job.lock_token, job_id: job.id, updated_at: now })
      .eq("id", delivery.id)
      .in("status", ["PENDING", "FAILED", "NEEDS_REVIEW"])
      .select("*")
      .maybeSingle();
    if (reclaimed.error) throw databaseError(reclaimed.error, "reclaim_invoice_channel_delivery");
    if (!reclaimed.data) throw new EInvoicingError("Satış kanalı teslimi başka bir worker tarafından işleniyor.", { code: "CHANNEL_DELIVERY_IN_PROGRESS", statusCode: 503, retryable: true });
    delivery = reclaimed.data;
  }

  const safeAccount = {
    id: account.id,
    organizationId: account.organization_id,
    legalEntityId: account.legal_entity_id,
    sellerId: account.seller_id,
    externalAccountId: account.external_account_id,
    environment: account.environment
  };
  let result;
  try {
    const credentials = localChannel ? null : await resolveBoundCredential({
      db: supabaseAdmin,
      reference: account.credential_reference,
      organizationId: account.organization_id,
      legalEntityId: account.legal_entity_id,
      integrationType: "sales_channel",
      integrationKey: channelKey,
      purpose: "api"
    });
    result = deliveryType === "PDF_XML"
      ? await provider.pushInvoice({ invoice, account: safeAccount, credentials, environment: account.environment, idempotencyKey: deliveryKey })
      : await provider.pushInvoiceMetadata({
          invoice: { id: invoice.id, invoiceNumber: invoice.invoice_number, ettnUuid: invoice.ettn_uuid, documentType: invoice.document_type },
          account: safeAccount,
          credentials,
          environment: account.environment,
          idempotencyKey: deliveryKey
        });
    if (result?.accepted !== true) {
      throw new EInvoicingError("Satış kanalı fatura teslimini kabul etmedi.", { code: "CHANNEL_INVOICE_DELIVERY_UNCONFIRMED", statusCode: 502, retryable: true });
    }
    delivery = requireData(await supabaseAdmin.from("invoice_channel_deliveries").update({
      status: "DELIVERED",
      external_reference: String(result.externalReference || invoice.sales_channel_order_id || invoice.order_id || "").slice(0, 300) || null,
      sanitized_result: { accepted: true, local: result.local === true },
      delivered_at: new Date().toISOString(),
      processing_started_at: null,
      lock_expires_at: null,
      lock_token: null,
      job_id: null,
      updated_at: new Date().toISOString()
    }).eq("id", delivery.id).eq("status", "PROCESSING").eq("lock_token", job.lock_token).select("*").single(), "complete_invoice_channel_delivery");
  } catch (error) {
    await supabaseAdmin.from("invoice_channel_deliveries").update({ status: "FAILED", processing_started_at: null, lock_expires_at: null, lock_token: null, job_id: null, sanitized_result: { error_code: safeErrorCode(error, "CHANNEL_DELIVERY_FAILED") }, updated_at: new Date().toISOString() }).eq("id", delivery.id).eq("status", "PROCESSING").eq("lock_token", job.lock_token);
    throw error;
  }
  let updated = invoice;
  if (invoice.status === "ISSUED") {
    updated = await transitionInvoice(invoice, "SENT", { sent_at: delivery.delivered_at }, { action: "invoice.channel_sent", requestId: job.request_id, metadata: { channel: channelKey, delivery_id: delivery.id } });
  }
  return { invoiceId: updated.id, status: updated.status, channel: channelKey, deliveryId: delivery.id, accepted: true };
}

async function markJobWorkflowFailure(job, nextStatus) {
  const targets = [
    job.payload?.invoiceReturnId ? { table: "invoice_returns", id: job.payload.invoiceReturnId } : null,
    job.payload?.cancellationId ? { table: "invoice_cancellations", id: job.payload.cancellationId } : null
  ].filter(Boolean);
  for (const target of targets) {
    const current = requireData(await supabaseAdmin.from(target.table).select("id, status").eq("id", target.id).maybeSingle(), `load_failed_${target.table}_workflow`);
    if (!current || ["COMPLETED", "REJECTED", nextStatus].includes(current.status)) continue;
    const allowed = nextStatus === "FAILED"
      ? ["QUEUED", "PROCESSING"]
      : ["REQUESTED", "REVIEW", "QUEUED", "PROCESSING", "FAILED"];
    if (allowed.includes(current.status)) {
      requireData(await supabaseAdmin.from(target.table).update({ status: nextStatus }).eq("id", target.id).eq("status", current.status), `mark_failed_${target.table}_workflow`);
    }
  }
}

async function runWithJobLeaseHeartbeat(job, task) {
  const heartbeatEveryMs = Math.max(10_000, Math.min(Math.floor(config.eInvoicing.jobLeaseSeconds * 1000 / 3), 60_000));
  let stopped = false;
  let leaseLost = false;
  let timer = null;
  let inFlight = Promise.resolve();
  const renew = async () => {
    const result = await supabaseAdmin.rpc("renew_invoice_job_lease", {
      p_job_id: job.id,
      p_lock_token: job.lock_token,
      p_lease_seconds: config.eInvoicing.jobLeaseSeconds
    });
    if (result.error || result.data !== true) leaseLost = true;
  };
  const schedule = () => {
    if (stopped || leaseLost) return;
    timer = setTimeout(() => {
      inFlight = renew()
        .catch(() => { leaseLost = true; })
        .finally(schedule);
    }, heartbeatEveryMs);
    timer.unref?.();
  };
  schedule();
  let result;
  let taskError;
  try {
    result = await task();
  } catch (error) {
    taskError = error;
  } finally {
    stopped = true;
    if (timer) clearTimeout(timer);
    await inFlight;
  }
  if (taskError) throw taskError;
  if (leaseLost) {
    throw new EInvoicingError("Job lease yenilenemedi; provider idempotency anahtarıyla güvenli tekrar gerekir.", {
      code: "INVOICE_JOB_LEASE_LOST",
      statusCode: 503,
      retryable: true
    });
  }
  return result;
}

export async function processInvoiceJobs({ workerId = `worker-${randomUUID()}`, limit = 10 } = {}) {
  if (!config.eInvoicing.enabled || !config.eInvoicing.workerEnabled) {
    return { enabled: false, claimed: 0, succeeded: 0, failed: 0, needsReview: 0, results: [] };
  }
  const claimLimit = Math.min(Number(limit || 10), config.eInvoicing.jobBatchSize);
  const summary = { enabled: true, claimed: 0, succeeded: 0, failed: 0, needsReview: 0, results: [] };
  for (let index = 0; index < claimLimit; index += 1) {
    const claimed = requireData(await supabaseAdmin.rpc("claim_invoice_jobs", {
      p_worker_id: workerId,
      p_limit: 1,
      p_lease_seconds: config.eInvoicing.jobLeaseSeconds
    }), "claim_invoice_job") || [];
    const job = claimed[0];
    if (!job) break;
    summary.claimed += 1;
    try {
      const result = await runWithJobLeaseHeartbeat(job, async () => {
        if (job.job_type === "CREATE_DOCUMENT" || job.job_type === "CREATE_RETURN_DOCUMENT") return processCreateDocument(job);
        if (job.job_type === "UPLOAD_TO_CHANNEL") return processUploadToChannel(job);
        if (job.job_type === "CANCEL_DOCUMENT") return processCancelDocument(job);
        if (job.job_type === "REFRESH_STATUS") return processRefreshStatus(job);
        throw new EInvoicingError("Job türü henüz uygulanmadı.", { code: "JOB_TYPE_NOT_IMPLEMENTED", statusCode: 422, retryable: false });
      });
      requireData(await supabaseAdmin.rpc("complete_invoice_job", {
        p_job_id: job.id,
        p_lock_token: job.lock_token,
        p_result: result
      }), "complete_invoice_job");
      summary.succeeded += 1;
      summary.results.push({ jobId: job.id, status: "SUCCEEDED", result });
    } catch (error) {
      const failure = safeJobFailure(error);
      const delays = await retryDelaysForJob(job);
      const retryAfter = delays[Math.min(Math.max(job.attempt_count - 1, 0), delays.length - 1)] || 3600;
      const failedJob = requireData(await supabaseAdmin.rpc("fail_invoice_job", {
        p_job_id: job.id,
        p_lock_token: job.lock_token,
        p_error_code: failure.code,
        p_error_message: failure.message,
        p_retry_after_seconds: retryAfter,
        p_retryable: failure.retryable
      }), "fail_invoice_job");
      try {
        await markJobWorkflowFailure(job, failedJob.status === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : "FAILED");
      } catch {
        // The job and invoice failure records remain authoritative even if a
        // secondary workflow marker cannot be updated.
      }
      if (failedJob.status === "NEEDS_REVIEW") summary.needsReview += 1;
      else summary.failed += 1;
      summary.results.push({ jobId: job.id, status: failedJob.status, errorCode: failure.code });
      if (job.invoice_id && failedJob.status === "NEEDS_REVIEW" && ["CREATE_DOCUMENT", "CREATE_RETURN_DOCUMENT", "CANCEL_DOCUMENT"].includes(job.job_type)) {
        const { data: current } = await supabaseAdmin.from("invoices").select("*").eq("id", job.invoice_id).maybeSingle();
        if (current && !["CANCELLED", "RETURNED", "NEEDS_REVIEW"].includes(current.status)) {
          try {
            await transitionInvoice(current, "NEEDS_REVIEW", {
              error_code: failure.code,
              error_message: failure.message
            }, { action: "invoice.needs_review", requestId: job.request_id });
          } catch {
            // The database state guard remains authoritative; job failure is already persisted.
          }
        }
      }
    }
  }
  return summary;
}

export async function createArtifactSignedUrl({ invoice, kind, expiresIn = 60 }) {
  if (!["pdf", "xml"].includes(kind)) throw new EInvoicingError("Belge türü geçersiz.", { code: "INVALID_ARTIFACT_KIND", statusCode: 422 });
  const path = kind === "pdf" ? invoice.pdf_reference : invoice.xml_reference;
  if (!path) throw new EInvoicingError("Fatura belgesi henüz hazır değil.", { code: "INVOICE_ARTIFACT_NOT_READY", statusCode: 404 });
  const { data, error } = await supabaseAdmin.storage.from(DOCUMENT_BUCKET).createSignedUrl(path, Math.max(30, Math.min(Number(expiresIn || 60), 300)), {
    download: `${invoice.invoice_number || invoice.id}.${kind}`
  });
  if (error || !data?.signedUrl) throw new EInvoicingError("Güvenli belge bağlantısı oluşturulamadı.", { code: "SIGNED_URL_FAILED", statusCode: 503, retryable: true });
  return { signedUrl: data.signedUrl, expiresIn: Math.max(30, Math.min(Number(expiresIn || 60), 300)) };
}
