import { createHash } from "node:crypto";
import { z } from "zod";
import { config } from "../config.js";
import {
  auditEvent,
  authContext,
  hasMfa,
  hasRole,
  supabaseAdmin
} from "../lib/supabase.js";
import {
  createArtifactSignedUrl,
  completeInvoiceCancellation,
  completeOrderInvoiceAllocation,
  enqueueInvoiceJob,
  planInvoiceForSubOrder,
  planInvoiceReturn,
  processDurableOrderInvoiceEvent,
  processPendingOrderInvoiceEvents,
  processInvoiceJobs,
  rejectInvoiceReturnRequest,
  requestInvoiceCancellation,
  transitionInvoice
} from "../modules/e-invoicing/application.js";
import { assertCredentialBinding, resolveBoundCredential } from "../modules/e-invoicing/credential-store.js";
import { isCustomerInvoiceVisible } from "../modules/e-invoicing/customer-visibility.js";
import { EInvoicingError } from "../modules/e-invoicing/errors.js";
import { invoiceProviderCatalog, createInvoiceProvider } from "../modules/e-invoicing/invoice-providers.js";
import { deterministicHex } from "../modules/e-invoicing/idempotency.js";
import { decimalToInteger, integerToDecimal } from "../modules/e-invoicing/money.js";
import { createSalesChannelProvider, effectiveSalesChannelCapabilities, salesChannelCatalog } from "../modules/e-invoicing/sales-channels.js";
import { canTransitionInvoice, INVOICE_STATUSES, isStaleProviderStatus } from "../modules/e-invoicing/state-machine.js";
import { resolveUnifiedSellerSubOrder } from "../modules/e-invoicing/unified-orders.js";

function isEInvoicingPath(pathname) {
  return pathname === "/v1/e-invoicing"
    || pathname.startsWith("/v1/e-invoicing/")
    || pathname === "/v1/cron/e-invoicing"
    || pathname.startsWith("/v1/cron/e-invoicing/")
    || pathname === "/v1/internal/e-invoicing"
    || pathname.startsWith("/v1/internal/e-invoicing/")
    || pathname === "/v1/account/invoice-profiles"
    || pathname.startsWith("/v1/account/invoice-profiles/")
    || /^\/v1\/account\/orders\/[^/]+\/(?:invoices|invoice-profile|invoice-profiles)$/.test(pathname);
}

function assertEInvoicingEnabled() {
  if (!config.eInvoicing.enabled) {
    throw httpError("e-Dönüşüm modülü kapalı.", 404, "E_INVOICING_DISABLED");
  }
}

const uuid = z.string().uuid();
const listQuerySchema = z.object({
  organizationId: uuid,
  legalEntityId: uuid.optional(),
  sellerId: uuid.optional(),
  channelAccountId: uuid.optional(),
  status: z.string().trim().max(60).optional(),
  documentType: z.string().trim().max(60).optional(),
  provider: z.string().trim().max(80).optional(),
  search: z.string().trim().max(120).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  page: z.coerce.number().int().min(1).max(100000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25)
});
const planSchema = z.object({
  organizationId: uuid,
  legalEntityId: uuid,
  sellerId: uuid,
  orderId: uuid,
  subOrderId: uuid
});
const bulkPlanSchema = z.object({
  organizationId: uuid,
  legalEntityId: uuid,
  sellerId: uuid,
  items: z.array(z.object({ orderId: uuid, subOrderId: uuid })).min(1).max(50)
}).superRefine((value, ctx) => {
  const keys = new Set();
  value.items.forEach((item, index) => {
    const key = `${item.orderId}:${item.subOrderId}`;
    if (keys.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["items", index], message: "Aynı sipariş/sub-order çifti tekrarlanamaz." });
    keys.add(key);
  });
});
const orderInvoiceEventSchema = z.object({
  orderId: uuid,
  event: z.enum(["PAYMENT_COMPLETED", "ORDER_CONFIRMED", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "MANUAL"]),
  eventId: z.string().trim().min(1).max(240).optional()
});
const completeOrderAllocationSchema = z.object({ orderId: uuid, expectedSubOrderCount: z.coerce.number().int().min(1).max(1000) });
const artifactParamsSchema = z.object({ invoiceId: uuid, kind: z.enum(["pdf", "xml"]) });
const bulkSchema = z.object({
  organizationId: uuid,
  invoiceIds: z.array(uuid).min(1).max(50),
  action: z.enum(["RETRY", "REFRESH_STATUS", "UPLOAD_TO_CHANNEL", "PDF", "XML"])
});
const organizationSchema = z.object({
  name: z.string().trim().min(2).max(180),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
});
const providerAccountSchema = z.object({
  organizationId: uuid,
  legalEntityId: uuid,
  providerKey: z.enum(["mock", "provider_a", "provider_b", "provider_c"]),
  accountLabel: z.string().trim().min(2).max(120),
  environment: z.enum(["mock", "sandbox", "production"]),
  credentialReference: z.string().trim().max(300).optional().nullable(),
  webhookSecretReference: z.string().trim().max(300).optional().nullable()
});
const legalEntitySchema = z.object({
  organizationId: uuid,
  legalName: z.string().trim().min(2).max(240),
  displayName: z.string().trim().max(180).optional().nullable(),
  countryCode: z.string().trim().length(2).optional().default("TR"),
  taxNumber: z.string().trim().max(32).optional().nullable(),
  taxOffice: z.string().trim().max(160).optional().nullable(),
  contactEmail: z.string().email().max(180).optional().nullable(),
  billingAddress: z.record(z.string(), z.unknown()).optional().default({})
});
const sellerSchema = z.object({
  organizationId: uuid,
  legalEntityId: uuid,
  partnerBusinessId: uuid.optional().nullable(),
  sellerCode: z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9._-]+$/),
  displayName: z.string().trim().min(2).max(180)
});
const channelAccountSchema = z.object({
  organizationId: uuid,
  legalEntityId: uuid,
  sellerId: uuid,
  channelKey: z.enum(["trendyol", "hepsiburada", "n11", "pazarama", "ciceksepeti", "pttavm", "shopier", "amazon", "allonahub", "allona_shop", "custom_api"]),
  accountName: z.string().trim().min(2).max(160),
  externalAccountId: z.string().trim().max(180).optional().nullable(),
  environment: z.enum(["local", "sandbox", "production"]).optional(),
  credentialReference: z.string().trim().max(300).optional().nullable()
});
const invoiceProfileSchema = z.object({
  organizationId: uuid,
  legalEntityId: uuid,
  profileName: z.string().trim().min(2).max(160),
  documentPrefix: z.string().trim().max(20).optional().nullable(),
  defaultScenario: z.string().trim().min(2).max(80).optional().default("TEMELFATURA"),
  defaultCurrency: z.string().trim().length(3).optional().default("TRY"),
  defaultUnitCode: z.string().trim().min(2).max(20).optional().default("C62"),
  taxConfiguration: z.record(z.string(), z.unknown()).optional().default({}),
  isDefault: z.boolean().optional().default(false)
});
const customerInvoiceProfileSchema = z.object({
  profileType: z.enum(["individual", "corporate"]),
  name: z.string().trim().max(120).optional().nullable(),
  surname: z.string().trim().max(120).optional().nullable(),
  companyName: z.string().trim().max(240).optional().nullable(),
  taxNumber: z.string().trim().max(32).optional().nullable(),
  taxOffice: z.string().trim().max(160).optional().nullable(),
  billingAddress: z.record(z.string(), z.unknown()),
  email: z.string().email().max(180).optional().nullable(),
  isDefault: z.boolean().optional().default(false)
}).superRefine((value, ctx) => {
  if (value.profileType === "individual" && !value.name) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["name"], message: "Bireysel profil adı zorunludur." });
  if (value.profileType === "individual" && !value.surname) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["surname"], message: "Bireysel profil soyadı zorunludur." });
  if (value.profileType === "corporate" && !value.companyName) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["companyName"], message: "Kurumsal profil şirket adı zorunludur." });
  if (value.profileType === "corporate" && !value.taxNumber) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["taxNumber"], message: "Kurumsal profil vergi numarası zorunludur." });
  if (value.profileType === "corporate" && !value.taxOffice) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["taxOffice"], message: "Kurumsal profil vergi dairesi zorunludur." });
  if (!value.email) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Fatura e-postası zorunludur." });
  for (const field of ["line1", "city", "country"]) {
    if (!String(value.billingAddress?.[field] || "").trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["billingAddress", field], message: `Fatura adresi ${field} alanı zorunludur.` });
  }
});
const settingSchema = z.object({
  organizationId: uuid,
  legalEntityId: uuid,
  salesChannelAccountId: uuid.optional().nullable(),
  invoiceProfileId: uuid,
  invoiceProviderAccountId: uuid,
  triggerEvent: z.enum(["PAYMENT_COMPLETED", "ORDER_CONFIRMED", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "MANUAL"]),
  documentTypeFallback: z.enum(["MANUAL_REVIEW", "E_INVOICE", "E_ARCHIVE"]),
  autoUploadToChannel: z.boolean().optional().default(false),
  maxRetryCount: z.coerce.number().int().min(1).max(20).optional().default(4)
});
const configStatusSchema = z.object({
  organizationId: uuid,
  status: z.enum(["draft", "review", "active", "paused", "archived"]),
  confirmation: z.string().trim().max(80)
});
const connectionStatusSchema = z.object({
  organizationId: uuid,
  status: z.enum(["paused", "disconnected"]),
  confirmation: z.literal("BAGLANTI_DURUMUNU_GUNCELLE")
});
const returnSchema = z.object({
  organizationId: uuid,
  idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  reasonCode: z.string().trim().max(80).optional().nullable(),
  reasonNote: z.string().trim().max(1000).optional().nullable(),
  items: z.array(z.object({
    originalInvoiceItemId: uuid,
    quantity: z.string().trim().regex(/^\d+(?:\.\d{1,4})?$/)
  })).min(1).max(200)
});
const returnLookupSchema = z.object({
  organizationId: uuid,
  idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/)
});
const returnRejectionSchema = z.object({
  organizationId: uuid,
  reason: z.string().trim().min(3).max(1000),
  confirmation: z.literal("IADE_TALEBINI_REDDET")
});
const cancellationSchema = z.object({
  organizationId: uuid,
  reasonCode: z.string().trim().max(80).optional().nullable(),
  reasonNote: z.string().trim().max(1000).optional().nullable()
});
const unifiedOrderResolutionSchema = z.object({
  organizationId: uuid,
  legalEntityId: uuid,
  sellerId: uuid,
  orderId: uuid,
  salesChannelAccountId: uuid,
  subOrderKey: z.string().trim().min(1).max(160).optional().default("default"),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  shippingTotal: z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/).optional().default("0.00"),
  shippingTaxRate: z.string().trim().regex(/^\d+(?:\.\d{1,4})?$/).optional().nullable(),
  shippingTaxAmount: z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/).optional().nullable(),
  allowUnassigned: z.boolean().optional().default(false),
  items: z.array(z.object({
    orderItemId: uuid,
    unitCode: z.string().trim().min(1).max(20),
    discountAmount: z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/).optional().default("0.00"),
    taxRate: z.string().trim().regex(/^\d+(?:\.\d{1,4})?$/),
    sku: z.string().trim().max(180).optional().nullable(),
    barcode: z.string().trim().max(180).optional().nullable()
  })).min(1).max(200)
});

function httpError(message, statusCode, code = "REQUEST_ERROR", details = null) {
  return new EInvoicingError(message, { statusCode, code, details });
}

function istanbulDayBoundary(date, end = false) {
  const instant = new Date(`${date}T${end ? "23:59:59.999" : "00:00:00.000"}+03:00`);
  return instant.toISOString();
}

function istanbulCalendarDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(date)
    .reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function legalEntityReady(entity) {
  const address = entity?.billing_address || {};
  if (!String(entity?.tax_number || "").trim()) return false;
  if (!String(address.line1 || "").trim() || !String(address.city || "").trim() || !String(address.country || entity?.country_code || "").trim()) return false;
  if (String(entity?.country_code || "").toUpperCase() === "TR" && !String(entity?.tax_office || "").trim()) return false;
  return true;
}

async function requireUser(request, { roles = [], mfa = false } = {}) {
  const ctx = await authContext(request);
  if (!ctx?.user) throw httpError("Oturum doğrulanamadı.", 401, "AUTH_REQUIRED");
  if (roles.length && !hasRole(ctx.profile, roles)) throw httpError("Bu işlem için yetkiniz yok.", 403, "ROLE_REQUIRED");
  if (mfa && !hasMfa(ctx)) {
    throw httpError("Bu finansal işlem için iki aşamalı doğrulama gerekli.", 403, "MFA_REQUIRED");
  }
  return ctx;
}

async function assertOrganizationAccess(ctx, organizationId, { manage = false } = {}) {
  const rpc = manage ? "organization_member_can_manage" : "organization_visible_to_user";
  const { data, error } = await ctx.db.rpc(rpc, { target_organization_id: organizationId });
  if (error) throw httpError("Tenant yetki kontrolü tamamlanamadı.", 503, "TENANT_ACCESS_CHECK_FAILED");
  if (data !== true) throw httpError("Bu organizasyon için yetkiniz yok.", 403, "TENANT_ACCESS_DENIED");
}

async function assertLegalEntityManage(ctx, organizationId, legalEntityId) {
  const [{ data: legalEntity, error: legalEntityError }, { data: canManage, error: manageError }] = await Promise.all([
    ctx.db.from("legal_entities").select("id, organization_id").eq("id", legalEntityId).maybeSingle(),
    ctx.db.rpc("legal_entity_member_can_manage", { target_legal_entity_id: legalEntityId })
  ]);
  if (legalEntityError || manageError) throw httpError("Şirket yetki kontrolü tamamlanamadı.", 503, "LEGAL_ENTITY_ACCESS_CHECK_FAILED");
  if (!legalEntity || legalEntity.organization_id !== organizationId) throw httpError("Şirket tenant eşleşmesi geçersiz.", 409, "LEGAL_ENTITY_TENANT_MISMATCH");
  if (canManage !== true) throw httpError("Bu şirket yapılandırmasını yönetme yetkiniz yok.", 403, "LEGAL_ENTITY_MANAGE_DENIED");
  return legalEntity;
}

async function assertSellerManage(ctx, organizationId, legalEntityId, sellerId) {
  const [{ data: seller, error: sellerError }, { data: canManage, error: manageError }] = await Promise.all([
    ctx.db.from("seller_profiles").select("id, organization_id, legal_entity_id").eq("id", sellerId).maybeSingle(),
    ctx.db.rpc("seller_member_can_manage", { target_seller_id: sellerId })
  ]);
  if (sellerError || manageError) throw httpError("Satıcı yetki kontrolü tamamlanamadı.", 503, "SELLER_ACCESS_CHECK_FAILED");
  if (!seller || seller.organization_id !== organizationId || seller.legal_entity_id !== legalEntityId) {
    throw httpError("Satıcı tenant eşleşmesi geçersiz.", 409, "SELLER_TENANT_MISMATCH");
  }
  if (canManage !== true) throw httpError("Bu satıcı yapılandırmasını yönetme yetkiniz yok.", 403, "SELLER_MANAGE_DENIED");
  return seller;
}

async function assertSalesChannelAccountManage(ctx, account) {
  if (!account?.id || !account.organization_id || !account.legal_entity_id || !account.seller_id) {
    throw httpError("Satış kanalı hesabı tenant bağlamı eksik.", 409, "SALES_CHANNEL_ACCOUNT_CONTEXT_INVALID");
  }
  const result = await ctx.db.rpc("sales_channel_account_member_can_manage", { target_account_id: account.id });
  if (result.error) throw httpError("Mağaza yönetim yetkisi doğrulanamadı.", 503, "SALES_CHANNEL_ACCOUNT_MANAGE_CHECK_FAILED");
  if (result.data !== true) throw httpError("Bu mağaza hesabını yönetme yetkiniz yok.", 403, "SALES_CHANNEL_ACCOUNT_MANAGE_DENIED");
  return account;
}

async function assertInvoiceManage(ctx, invoiceId, organizationId) {
  const { data: invoice, error } = await ctx.db.from("invoices").select("id, organization_id, legal_entity_id, seller_id").eq("id", invoiceId).maybeSingle();
  if (error) throw httpError("Fatura yetkisi doğrulanamadı.", 503, "INVOICE_ACCESS_CHECK_FAILED");
  if (!invoice || invoice.organization_id !== organizationId) throw httpError("Fatura bulunamadı veya tenant eşleşmiyor.", 404, "INVOICE_NOT_FOUND");
  const [legalManage, sellerManage] = await Promise.all([
    ctx.db.rpc("legal_entity_member_can_manage", { target_legal_entity_id: invoice.legal_entity_id }),
    ctx.db.rpc("seller_member_can_manage", { target_seller_id: invoice.seller_id })
  ]);
  if (legalManage.error || sellerManage.error) throw httpError("Fatura yönetim yetkisi doğrulanamadı.", 503, "INVOICE_MANAGE_CHECK_FAILED");
  if (legalManage.data !== true && sellerManage.data !== true) throw httpError("Bu fatura iş akışını yönetme yetkiniz yok.", 403, "INVOICE_MANAGE_DENIED");
  return invoice;
}

async function assertInvoiceAccess(ctx, invoiceId) {
  const { data, error } = await ctx.db.from("invoices").select("id, organization_id, customer_id").eq("id", invoiceId).maybeSingle();
  if (error) throw httpError("Fatura yetkisi doğrulanamadı.", 503, "INVOICE_ACCESS_CHECK_FAILED");
  if (!data) throw httpError("Fatura bulunamadı.", 404, "INVOICE_NOT_FOUND");
  return data;
}

function sanitizeWebhook(value, depth = 0) {
  if (depth > 5) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeWebhook(item, depth + 1));
  if (typeof value === "object") {
    const blocked = /authorization|token|secret|password|private|identity|tax_number|address|email|phone/i;
    return Object.fromEntries(Object.entries(value).slice(0, 150).map(([key, item]) => [
      key,
      blocked.test(key) ? "[redacted]" : sanitizeWebhook(item, depth + 1)
    ]));
  }
  return typeof value === "string" ? value.slice(0, 2000) : value;
}

function applyInvoiceFilters(builder, query) {
  let request = builder.eq("organization_id", query.organizationId);
  if (query.legalEntityId) request = request.eq("legal_entity_id", query.legalEntityId);
  if (query.sellerId) request = request.eq("seller_id", query.sellerId);
  if (query.channelAccountId) request = request.eq("sales_channel_account_id", query.channelAccountId);
  if (query.status) request = request.eq("status", query.status.toUpperCase());
  if (query.documentType) request = request.eq("document_type", query.documentType.toUpperCase());
  if (query.provider) request = request.eq("provider", query.provider.toLowerCase());
  if (query.from) request = request.gte("created_at", istanbulDayBoundary(query.from));
  if (query.to) request = request.lte("created_at", istanbulDayBoundary(query.to, true));
  if (query.search) {
    const search = query.search.replace(/[,()%]/g, " ").replace(/\s+/g, " ").trim();
    if (search) request = request.or(`invoice_number.ilike.%${search}%,sales_channel_order_id.ilike.%${search}%,provider_document_id.ilike.%${search}%`);
  }
  return request;
}

function csvCell(value) {
  const source = String(value ?? "");
  const normalized = source.replace(/\r\n|\n|\r/g, " ");
  const text = /^[=+\-@\t\r]/.test(source) ? `'${normalized}` : normalized;
  return `"${text.replace(/"/g, '""')}"`;
}

function pick(record, fields) {
  if (!record) return null;
  return Object.fromEntries(fields.filter((field) => record[field] !== undefined).map((field) => [field, record[field]]));
}

function operationResponse(result) {
  return {
    duplicate: result.duplicate === true,
    invoice: pick(result.invoice, [
      "id", "organization_id", "legal_entity_id", "seller_id", "order_id", "sub_order_id",
      "original_invoice_id", "document_type", "document_scope", "currency", "subtotal",
      "discount_total", "shipping_total", "tax_total", "grand_total", "status",
      "invoice_number", "ettn_uuid", "provider", "provider_document_id", "created_at", "updated_at"
    ]),
    job: pick(result.job, ["id", "invoice_id", "job_type", "status", "attempt_count", "max_attempts", "next_attempt_at", "request_id", "correlation_id"]),
    invoiceReturn: pick(result.invoiceReturn, ["id", "original_invoice_id", "return_invoice_id", "currency", "subtotal", "tax_total", "grand_total", "status", "created_at", "updated_at"]),
    cancellation: pick(result.cancellation, ["id", "invoice_id", "order_id", "reason_code", "status", "provider_reference", "created_at", "updated_at"])
  };
}

async function dashboard(db, query) {
  const today = istanbulCalendarDate();
  const startToday = new Date(istanbulDayBoundary(today));
  const startMonth = new Date(istanbulDayBoundary(`${today.slice(0, 7)}-01`));
  let request = db
    .from("invoice_api_rows")
    .select("id, document_type, status, grand_total, currency, sales_channel, created_at")
    .eq("organization_id", query.organizationId)
    .gte("created_at", startMonth.toISOString());
  if (query.legalEntityId) request = request.eq("legal_entity_id", query.legalEntityId);
  if (query.sellerId) request = request.eq("seller_id", query.sellerId);
  if (query.channelAccountId) request = request.eq("sales_channel_account_id", query.channelAccountId);
  const { data, error } = await request.limit(10001);
  if (error) throw httpError("Dashboard verileri alınamadı.", 503, "DASHBOARD_QUERY_FAILED");
  if ((data || []).length > 10000) throw httpError("Dashboard kapsamı 10.000 belgeyi aşıyor; tarih veya tenant filtresi daraltılmalı.", 422, "DASHBOARD_SCOPE_TOO_LARGE");
  const summary = {
    today: 0,
    month: data.length,
    totalAmount: {},
    eInvoice: 0,
    eArchive: 0,
    pending: 0,
    successful: 0,
    failed: 0,
    cancelled: 0,
    returned: 0,
    byChannel: {}
  };
  data.forEach((invoice) => {
    if (new Date(invoice.created_at) >= startToday) summary.today += 1;
    if (invoice.document_type === "E_INVOICE") summary.eInvoice += 1;
    if (invoice.document_type === "E_ARCHIVE") summary.eArchive += 1;
    if (["ISSUED", "SENT", "ACCEPTED"].includes(invoice.status)) summary.successful += 1;
    if (["DRAFT", "QUEUED", "PROCESSING", "NEEDS_REVIEW"].includes(invoice.status)) summary.pending += 1;
    if (["FAILED", "REJECTED"].includes(invoice.status)) summary.failed += 1;
    if (invoice.status === "CANCELLED") summary.cancelled += 1;
    if (invoice.document_type === "RETURN" && ["ISSUED", "SENT", "ACCEPTED"].includes(invoice.status)) summary.returned += 1;
    const currency = invoice.currency || "TRY";
    summary.totalAmount[currency] = (summary.totalAmount[currency] || 0n) + decimalToInteger(invoice.grand_total, 2);
    const channel = invoice.sales_channel || "unknown";
    summary.byChannel[channel] = (summary.byChannel[channel] || 0) + 1;
  });
  summary.totalAmount = Object.fromEntries(Object.entries(summary.totalAmount).map(([currency, value]) => [currency, integerToDecimal(value, 2)]));
  return summary;
}

async function audit(request, ctx, action, resourceType, resourceId, metadata = {}, severity = "info") {
  await auditEvent({
    request,
    actorId: ctx.user.id,
    actorRole: ctx.profile.role,
    action,
    resourceType,
    resourceId,
    severity,
    source: "e_invoicing",
    purpose: "financial_operations",
    evidenceTags: ["e_invoicing", resourceType],
    metadata
  });
}

async function addArtifactAvailability(rows) {
  const items = Array.isArray(rows) ? rows : rows ? [rows] : [];
  const invoiceIds = [...new Set(items.map((item) => item?.id).filter(Boolean))];
  if (!invoiceIds.length) return Array.isArray(rows) ? [] : rows;
  const artifacts = await supabaseAdmin.from("invoices").select("id, provider, provider_document_id, provider_account_id, sales_channel_account_id, document_scope, document_type, pdf_reference, xml_reference, status").in("id", invoiceIds);
  if (artifacts.error) throw httpError("Fatura belge durumu alınamadı.", 503, "INVOICE_ARTIFACT_STATUS_FAILED");
  const providerAccountIds = [...new Set((artifacts.data || []).map((item) => item.provider_account_id).filter(Boolean))];
  const channelAccountIds = [...new Set((artifacts.data || []).map((item) => item.sales_channel_account_id).filter(Boolean))];
  const [providerAccounts, channelAccounts, operationGuards, returnWorkflows, cancellationWorkflows] = await Promise.all([
    providerAccountIds.length
      ? supabaseAdmin.from("invoice_provider_accounts").select("id, provider_key, environment, status").in("id", providerAccountIds)
      : { data: [], error: null },
    channelAccountIds.length
      ? supabaseAdmin.from("sales_channel_accounts").select("id, environment, status, capability_overrides, sales_channels(channel_key)").in("id", channelAccountIds)
      : { data: [], error: null },
    supabaseAdmin.from("invoice_document_operation_guards")
      .select("invoice_id, operation_type, reservation_expires_at")
      .in("invoice_id", invoiceIds)
      .eq("status", "ACTIVE"),
    supabaseAdmin.from("invoice_returns").select("original_invoice_id").in("original_invoice_id", invoiceIds),
    supabaseAdmin.from("invoice_cancellations").select("invoice_id").in("invoice_id", invoiceIds)
  ]);
  if (providerAccounts.error || channelAccounts.error || operationGuards.error || returnWorkflows.error || cancellationWorkflows.error) throw httpError("Fatura işlem yetenekleri alınamadı.", 503, "INVOICE_OPERATION_CAPABILITIES_FAILED");
  const providerAccountMap = new Map((providerAccounts.data || []).map((item) => [item.id, item]));
  const channelAccountMap = new Map((channelAccounts.data || []).map((item) => [item.id, item]));
  const workflowInvoiceIds = new Set([
    ...(returnWorkflows.data || []).map((item) => item.original_invoice_id),
    ...(cancellationWorkflows.data || []).map((item) => item.invoice_id)
  ]);
  const operationGuardMap = new Map((operationGuards.data || []).map((item) => [item.invoice_id, item]));
  const availability = new Map((artifacts.data || []).map((item) => {
    const providerAccount = providerAccountMap.get(item.provider_account_id);
    const channelAccount = channelAccountMap.get(item.sales_channel_account_id);
    const providerCapabilities = createInvoiceProvider(item.provider).getCapabilities();
    const channelKey = channelAccount?.sales_channels?.channel_key;
    const localChannel = ["allonahub", "allona_shop"].includes(channelKey);
    const channelCapabilities = channelKey
      ? effectiveSalesChannelCapabilities(channelKey, channelAccount.capability_overrides || {})
      : {};
    const providerOutboundAllowed = Boolean(
      providerAccount?.status === "connected"
      && providerAccount.provider_key === item.provider
      && !(providerAccount.environment === "production" && !config.eInvoicing.providerCallsEnabled)
      && !(item.provider === "mock" && !config.eInvoicing.mockProviderEnabled)
    );
    const customerSaleDocument = item.document_scope === "CUSTOMER_SALE"
      && ["E_INVOICE", "E_ARCHIVE"].includes(item.document_type);
    const operationGuard = operationGuardMap.get(item.id);
    const expiredPreWorkflowGuard = operationGuard
      && new Date(operationGuard.reservation_expires_at).getTime() <= Date.now()
      && !workflowInvoiceIds.has(item.id);
    const activeOperation = expiredPreWorkflowGuard ? null : operationGuard?.operation_type || null;
    return [item.id, {
      has_pdf: Boolean(item.pdf_reference),
      has_xml: Boolean(item.xml_reference),
      can_refresh_status: Boolean(
        item.provider_document_id
        && providerAccount?.status === "connected"
        && providerAccount.provider_key === item.provider
        && providerCapabilities.documentStatus === true
        && !(providerAccount.environment === "production" && !config.eInvoicing.providerCallsEnabled)
        && !(item.provider === "mock" && !config.eInvoicing.mockProviderEnabled)
      ),
      can_upload_to_channel: Boolean(
        item.status === "ISSUED"
        && channelAccount?.status === "connected"
        && (localChannel || config.eInvoicing.channelCallsEnabled)
        && (channelCapabilities.invoiceUpload === true || channelCapabilities.invoiceMetadata === true)
      ),
      can_create_return: Boolean(
        customerSaleDocument
        && ["ISSUED", "SENT", "ACCEPTED"].includes(item.status)
        && activeOperation !== "CANCELLATION"
        && providerOutboundAllowed
        && providerCapabilities.returns === true
      ),
      can_cancel: Boolean(
        customerSaleDocument
        && ["ISSUED", "SENT", "ACCEPTED"].includes(item.status)
        && activeOperation === null
        && item.provider_document_id
        && providerOutboundAllowed
        && providerCapabilities.cancellation === true
      )
    }];
  }));
  const enriched = items.map((item) => ({
    ...item,
    has_pdf: availability.get(item.id)?.has_pdf === true,
    has_xml: availability.get(item.id)?.has_xml === true,
    can_refresh_status: availability.get(item.id)?.can_refresh_status === true,
    can_upload_to_channel: availability.get(item.id)?.can_upload_to_channel === true,
    can_create_return: availability.get(item.id)?.can_create_return === true,
    can_cancel: availability.get(item.id)?.can_cancel === true
  }));
  return Array.isArray(rows) ? enriched : enriched[0] || null;
}

export function registerEInvoicingRoutes(app) {
  app.addHook("preHandler", async (request) => {
    const pathname = String(request.url || "").split("?")[0];
    if (isEInvoicingPath(pathname)) assertEInvoicingEnabled();
  });

  app.get("/v1/e-invoicing/catalog", async (request) => {
    await requireUser(request);
    return {
      ok: true,
      enabled: config.eInvoicing.enabled,
      productionProviderCallsEnabled: config.eInvoicing.providerCallsEnabled,
      externalChannelCallsEnabled: config.eInvoicing.channelCallsEnabled,
      workerEnabled: config.eInvoicing.workerEnabled,
      salesChannels: salesChannelCatalog(),
      invoiceProviders: invoiceProviderCatalog()
    };
  });

  app.get("/v1/e-invoicing/context", async (request) => {
    const ctx = await requireUser(request);
    const organizations = (await ctx.db.from("organizations").select("id, name, slug, status").order("name")).data || [];
    const organizationIds = organizations.map((item) => item.id);
    if (!organizationIds.length) return {
      ok: true,
      organizations: [],
      legalEntities: [],
      sellers: [],
      channelAccounts: [],
      providerAccounts: [],
      invoiceProfiles: [],
      invoiceSettings: []
    };
    const [legalEntities, sellers, channelAccounts, providerAccounts, invoiceProfiles, invoiceSettings] = await Promise.all([
      ctx.db.from("legal_entities").select("id, organization_id, legal_name, display_name, status").in("organization_id", organizationIds).order("legal_name"),
      ctx.db.from("seller_profiles").select("id, organization_id, legal_entity_id, seller_code, display_name, status").in("organization_id", organizationIds).order("display_name"),
      ctx.db.from("sales_channel_accounts").select("id, organization_id, legal_entity_id, seller_id, account_name, external_account_id, environment, status, capabilities:capability_overrides, sales_channels(channel_key, display_name, capabilities)").in("organization_id", organizationIds).order("account_name"),
      ctx.db.from("invoice_provider_accounts").select("id, organization_id, legal_entity_id, provider_key, account_label, environment, capabilities, status, last_tested_at, last_error_code").in("organization_id", organizationIds).order("account_label"),
      ctx.db.from("invoice_profiles").select("id, organization_id, legal_entity_id, profile_name, document_prefix, default_scenario, default_currency, default_unit_code, is_default, status").in("organization_id", organizationIds).order("profile_name"),
      ctx.db.from("invoice_settings").select("id, organization_id, legal_entity_id, sales_channel_account_id, invoice_profile_id, invoice_provider_account_id, trigger_event, document_type_fallback, retry_delays_seconds, max_retry_count, auto_upload_to_channel, is_active").in("organization_id", organizationIds).order("created_at", { ascending: false })
    ]);
    const [legalManageResults, sellerManageResults, accountManageResults] = await Promise.all([
      Promise.all((legalEntities.data || []).map(async (item) => {
        const result = await ctx.db.rpc("legal_entity_member_can_manage", { target_legal_entity_id: item.id });
        return [item.id, !result.error && result.data === true];
      })),
      Promise.all((sellers.data || []).map(async (item) => {
        const result = await ctx.db.rpc("seller_member_can_manage", { target_seller_id: item.id });
        return [item.id, !result.error && result.data === true];
      })),
      Promise.all((channelAccounts.data || []).map(async (item) => {
        const result = await ctx.db.rpc("sales_channel_account_member_can_manage", { target_account_id: item.id });
        return [item.id, !result.error && result.data === true];
      }))
    ]);
    const legalCanManage = new Map(legalManageResults);
    const sellerCanManage = new Map(sellerManageResults);
    const accountCanManage = new Map(accountManageResults);
    return {
      ok: true,
      organizations,
      legalEntities: (legalEntities.data || []).map((item) => ({ ...item, can_manage: legalCanManage.get(item.id) === true })),
      sellers: (sellers.data || []).map((item) => ({ ...item, can_manage: sellerCanManage.get(item.id) === true })),
      channelAccounts: (channelAccounts.data || []).map((account) => ({
        ...account,
        can_manage: accountCanManage.get(account.id) === true,
        capabilities: effectiveSalesChannelCapabilities(
          account.sales_channels?.channel_key,
          account.capabilities || {}
        )
      })),
      providerAccounts: (providerAccounts.data || []).map((item) => ({ ...item, can_manage: legalCanManage.get(item.legal_entity_id) === true })),
      invoiceProfiles: (invoiceProfiles.data || []).map((item) => ({ ...item, can_manage: legalCanManage.get(item.legal_entity_id) === true })),
      invoiceSettings: (invoiceSettings.data || []).map((item) => ({ ...item, can_manage: legalCanManage.get(item.legal_entity_id) === true })),
      warnings: [legalEntities.error, sellers.error, channelAccounts.error, providerAccounts.error, invoiceProfiles.error, invoiceSettings.error]
        .filter(Boolean)
        .map(() => "Bazı tenant tabloları henüz hazır değil.")
    };
  });

  app.get("/v1/e-invoicing/dashboard", async (request) => {
    const ctx = await requireUser(request);
    const query = listQuerySchema.pick({ organizationId: true, legalEntityId: true, sellerId: true, channelAccountId: true }).parse(request.query || {});
    await assertOrganizationAccess(ctx, query.organizationId);
    return { ok: true, summary: await dashboard(ctx.db, query) };
  });

  app.get("/v1/e-invoicing/invoices", async (request) => {
    const ctx = await requireUser(request);
    const query = listQuerySchema.parse(request.query || {});
    await assertOrganizationAccess(ctx, query.organizationId);
    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    const base = ctx.db.from("invoice_api_rows").select(
      "id, organization_id, legal_entity_id, seller_id, order_id, sub_order_id, sales_channel, sales_channel_account_id, sales_channel_order_id, provider, provider_document_id, document_scope, document_type, scenario, ettn_uuid, invoice_number, issue_date, currency, grand_total, status, error_code, retry_count, created_at, updated_at",
      { count: "exact" }
    );
    const result = await applyInvoiceFilters(base, query).order("created_at", { ascending: false }).range(from, to);
    if (result.error) throw httpError("Fatura listesi alınamadı.", 503, "INVOICE_LIST_FAILED");
    return { ok: true, items: await addArtifactAvailability(result.data || []), page: query.page, pageSize: query.pageSize, total: result.count || 0 };
  });

  app.get("/v1/e-invoicing/reports/invoices.csv", async (request, reply) => {
    const ctx = await requireUser(request);
    const query = listQuerySchema.parse(request.query || {});
    await assertOrganizationAccess(ctx, query.organizationId);
    const base = ctx.db.from("invoice_api_rows").select("id, invoice_number, ettn_uuid, sales_channel, sales_channel_order_id, provider, provider_document_id, document_type, issue_date, currency, subtotal, discount_total, shipping_total, shipping_tax_amount, tax_total, grand_total, status, error_code, created_at");
    const result = await applyInvoiceFilters(base, query).order("created_at", { ascending: false }).limit(10000);
    if (result.error) throw httpError("Fatura raporu oluşturulamadı.", 503, "INVOICE_REPORT_FAILED");
    const headers = ["id", "invoice_number", "ettn_uuid", "sales_channel", "sales_channel_order_id", "provider", "provider_document_id", "document_type", "issue_date", "currency", "subtotal", "discount_total", "shipping_total", "tax_total", "grand_total", "status", "error_code", "created_at"];
    const lines = [headers.map(csvCell).join(","), ...(result.data || []).map((row) => headers.map((key) => csvCell(row[key])).join(","))];
    await audit(request, ctx, "invoice.report.exported", "invoice_report", null, { organization_id: query.organizationId, row_count: result.data?.length || 0, format: "csv" });
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="allonahub-invoices-${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(`\uFEFF${lines.join("\r\n")}`);
  });

  app.get("/v1/e-invoicing/resources/:resource", async (request) => {
    const ctx = await requireUser(request);
    const query = listQuerySchema.parse(request.query || {});
    await assertOrganizationAccess(ctx, query.organizationId);
    const resources = {
      jobs: { table: "invoice_jobs", select: "id, invoice_id, job_type, status, attempt_count, max_attempts, next_attempt_at, last_error_code, request_id, correlation_id, created_at, updated_at", invoiceColumn: "invoice_id", statusColumn: "status" },
      failures: { table: "invoice_failures", select: "id, invoice_id, job_id, failure_stage, error_code, error_message, retryable, attempt_number, request_id, correlation_id, resolved_at, created_at", invoiceColumn: "invoice_id" },
      returns: { table: "invoice_returns", select: "id, original_invoice_id, return_invoice_id, order_id, reason_code, rejection_reason, rejected_at, currency, grand_total, status, created_at, updated_at", invoiceColumn: "original_invoice_id", statusColumn: "status" },
      cancellations: { table: "invoice_cancellations", select: "id, invoice_id, order_id, reason_code, status, provider_reference, created_at, updated_at", invoiceColumn: "invoice_id", statusColumn: "status" },
      commissions: { table: "commission_billing_documents", select: "id, legal_entity_id, seller_id, settlement_period_start, settlement_period_end, currency, gross_sales, returns_total, commission_total, service_fee_total, net_payable, generated_invoice_id, status, created_at", directScope: true, statusColumn: "status" },
      reconciliation: { table: "invoice_reconciliation_records", select: "id, legal_entity_id, seller_id, invoice_id, period_start, period_end, currency, gross_sales, returns_total, cancellations_total, commission_total, service_fees, shipping_deductions, other_deductions, net_payable, recorded_payout, variance, status, created_at", directScope: true, statusColumn: "status" },
      audit: { table: "invoice_events", select: "id, invoice_id, actor_id, actor_role, action, old_state, new_state, request_id, correlation_id, metadata, created_at", invoiceColumn: "invoice_id" }
    };
    const definition = resources[String(request.params.resource || "")];
    if (!definition) throw httpError("Kaynak bulunamadı.", 404, "RESOURCE_NOT_FOUND");
    const from = (query.page - 1) * query.pageSize;
    let builder = ctx.db.from(definition.table).select(definition.select, { count: "exact" }).eq("organization_id", query.organizationId);
    if (definition.directScope) {
      if (query.legalEntityId) builder = builder.eq("legal_entity_id", query.legalEntityId);
      if (query.sellerId) builder = builder.eq("seller_id", query.sellerId);
      if (query.channelAccountId) {
        return { ok: true, items: [], total: 0, page: query.page, pageSize: query.pageSize, warning: "Bu finansal domain mağaza hesabına değil şirket/satıcı kapsamına bağlıdır." };
      }
    } else if (definition.invoiceColumn && (query.legalEntityId || query.sellerId || query.channelAccountId)) {
      let invoiceScope = ctx.db.from("invoices").select("id").eq("organization_id", query.organizationId);
      if (query.legalEntityId) invoiceScope = invoiceScope.eq("legal_entity_id", query.legalEntityId);
      if (query.sellerId) invoiceScope = invoiceScope.eq("seller_id", query.sellerId);
      if (query.channelAccountId) invoiceScope = invoiceScope.eq("sales_channel_account_id", query.channelAccountId);
      const scoped = await invoiceScope.limit(10001);
      if (scoped.error) throw httpError("Kaynak tenant kapsamı doğrulanamadı.", 503, "RESOURCE_SCOPE_FAILED");
      if ((scoped.data || []).length > 10000) throw httpError("Kaynak kapsamı çok geniş; filtreleri daraltın.", 422, "RESOURCE_SCOPE_TOO_LARGE");
      const invoiceIds = (scoped.data || []).map((invoice) => invoice.id);
      if (!invoiceIds.length) return { ok: true, items: [], total: 0, page: query.page, pageSize: query.pageSize };
      builder = builder.in(definition.invoiceColumn, invoiceIds);
    }
    if (query.status && definition.statusColumn) builder = builder.eq(definition.statusColumn, query.status.toUpperCase());
    if (query.from) builder = builder.gte("created_at", istanbulDayBoundary(query.from));
    if (query.to) builder = builder.lte("created_at", istanbulDayBoundary(query.to, true));
    const result = await builder.order("created_at", { ascending: false }).range(from, from + query.pageSize - 1);
    if (result.error) throw httpError("e-Dönüşüm kaynağı alınamadı.", 503, "RESOURCE_LIST_FAILED");
    let resourceItems = result.data || [];
    if (String(request.params.resource || "") === "returns" && resourceItems.length) {
      const originalIds = [...new Set(resourceItems.map((item) => item.original_invoice_id).filter(Boolean))];
      const returnInvoiceIds = [...new Set(resourceItems.map((item) => item.return_invoice_id).filter(Boolean))];
      const [originalInvoices, returnInvoices, returnJobs] = await Promise.all([
        ctx.db.from("invoices").select("id, legal_entity_id, seller_id").in("id", originalIds),
        returnInvoiceIds.length
          ? supabaseAdmin.from("invoices").select("id, status, provider_document_id, ettn_uuid, invoice_number, issued_at, pdf_reference, xml_reference").in("id", returnInvoiceIds)
          : { data: [], error: null },
        returnInvoiceIds.length
          ? supabaseAdmin.from("invoice_jobs").select("invoice_id, status, provider_call_started_at").eq("job_type", "CREATE_RETURN_DOCUMENT").in("invoice_id", returnInvoiceIds)
          : { data: [], error: null }
      ]);
      if (originalInvoices.error || returnInvoices.error || returnJobs.error) throw httpError("İade işlem yetkileri alınamadı.", 503, "RETURN_OPERATION_AVAILABILITY_FAILED");
      const originalMap = new Map((originalInvoices.data || []).map((item) => [item.id, item]));
      const returnInvoiceMap = new Map((returnInvoices.data || []).map((item) => [item.id, item]));
      const jobMap = new Map();
      for (const job of returnJobs.data || []) {
        const jobs = jobMap.get(job.invoice_id) || [];
        jobs.push(job);
        jobMap.set(job.invoice_id, jobs);
      }
      resourceItems = resourceItems.map((item) => {
        const original = originalMap.get(item.original_invoice_id) || {};
        const returnInvoice = returnInvoiceMap.get(item.return_invoice_id);
        const jobs = jobMap.get(item.return_invoice_id) || [];
        const documentSafe = !returnInvoice || (
          ["DRAFT", "QUEUED", "FAILED", "NEEDS_REVIEW"].includes(returnInvoice.status)
          && !returnInvoice.provider_document_id
          && !returnInvoice.ettn_uuid
          && !returnInvoice.invoice_number
          && !returnInvoice.issued_at
          && !returnInvoice.pdf_reference
          && !returnInvoice.xml_reference
        );
        const jobsSafe = jobs.every((job) => !["PROCESSING", "SUCCEEDED"].includes(job.status) && !job.provider_call_started_at);
        return {
          ...item,
          legal_entity_id: original.legal_entity_id || null,
          seller_id: original.seller_id || null,
          can_reject: ["REQUESTED", "REVIEW", "QUEUED", "FAILED", "NEEDS_REVIEW"].includes(item.status) && documentSafe && jobsSafe
        };
      });
    }
    return { ok: true, items: resourceItems, total: result.count || 0, page: query.page, pageSize: query.pageSize };
  });

  app.post("/v1/e-invoicing/unified-orders/resolve", async (request, reply) => {
    const ctx = await requireUser(request, { mfa: true });
    if (!config.eInvoicing.enabled) throw httpError("e-Dönüşüm modülü kapalı.", 503, "E_INVOICING_DISABLED");
    const input = unifiedOrderResolutionSchema.parse(request.body || {});
    await assertSellerManage(ctx, input.organizationId, input.legalEntityId, input.sellerId);
    if (input.allowUnassigned && !hasRole(ctx.profile, ["super_admin"])) {
      throw httpError("Provenance bulunmayan kalemleri yalnız super admin açık override ile çözümleyebilir.", 403, "UNASSIGNED_ORDER_OVERRIDE_DENIED");
    }
    const result = await resolveUnifiedSellerSubOrder(input, {
      db: supabaseAdmin,
      actorId: ctx.user.id,
      allowUnassigned: input.allowUnassigned === true && hasRole(ctx.profile, ["super_admin"])
    });
    await audit(request, ctx, "unified_order.seller_sub_order_resolved", "seller_sub_order", result.subOrder?.id || null, {
      organization_id: input.organizationId,
      legal_entity_id: input.legalEntityId,
      seller_id: input.sellerId,
      order_id: input.orderId,
      sales_channel_account_id: input.salesChannelAccountId,
      item_count: input.items.length,
      totals: result.totals
    }, "warning");
    return reply.code(200).send({ ok: true, ...result });
  });

  app.post("/v1/e-invoicing/invoices/plan", async (request, reply) => {
    const ctx = await requireUser(request, { roles: ["admin", "super_admin"], mfa: true });
    if (!config.eInvoicing.enabled) throw httpError("e-Dönüşüm modülü kapalı.", 503, "E_INVOICING_DISABLED");
    const input = planSchema.parse(request.body || {});
    const visible = await ctx.db.from("seller_sub_orders").select("id, organization_id, legal_entity_id, seller_id").eq("id", input.subOrderId).eq("order_id", input.orderId).maybeSingle();
    if (visible.error || !visible.data) throw httpError("Sub-order bulunamadı veya yetkiniz yok.", 404, "SUB_ORDER_NOT_FOUND");
    if (visible.data.organization_id !== input.organizationId
        || visible.data.legal_entity_id !== input.legalEntityId
        || visible.data.seller_id !== input.sellerId) {
      throw httpError("Sub-order seçili organizasyon/şirket/satıcı bağlamıyla eşleşmiyor.", 409, "MANUAL_INVOICE_TENANT_CONTEXT_MISMATCH");
    }
    await assertOrganizationAccess(ctx, input.organizationId, { manage: true });
    const result = await planInvoiceForSubOrder({ orderId: input.orderId, subOrderId: input.subOrderId, requestId: request.id, actor: { id: ctx.user.id, role: ctx.profile.role } });
    await audit(request, ctx, "invoice.plan", "invoice", result.invoice.id, { duplicate: result.duplicate, order_id: input.orderId, sub_order_id: input.subOrderId });
    return reply.code(result.duplicate ? 200 : 202).send({ ok: true, ...operationResponse(result) });
  });

  app.post("/v1/e-invoicing/invoices/plan-bulk", async (request, reply) => {
    const ctx = await requireUser(request, { roles: ["admin", "super_admin"], mfa: true });
    if (!config.eInvoicing.enabled) throw httpError("e-Dönüşüm modülü kapalı.", 503, "E_INVOICING_DISABLED");
    const input = bulkPlanSchema.parse(request.body || {});
    await assertOrganizationAccess(ctx, input.organizationId, { manage: true });
    const results = [];
    for (const item of input.items) {
      try {
        const visible = await ctx.db.from("seller_sub_orders")
          .select("id, organization_id, legal_entity_id, seller_id")
          .eq("id", item.subOrderId)
          .eq("order_id", item.orderId)
          .maybeSingle();
        if (visible.error || !visible.data) throw httpError("Sub-order bulunamadı veya yetkiniz yok.", 404, "SUB_ORDER_NOT_FOUND");
        if (visible.data.organization_id !== input.organizationId
            || visible.data.legal_entity_id !== input.legalEntityId
            || visible.data.seller_id !== input.sellerId) {
          throw httpError("Sub-order seçili tenant bağlamıyla eşleşmiyor.", 409, "MANUAL_INVOICE_TENANT_CONTEXT_MISMATCH");
        }
        const planned = await planInvoiceForSubOrder({
          orderId: item.orderId,
          subOrderId: item.subOrderId,
          requestId: request.id,
          actor: { id: ctx.user.id, role: ctx.profile.role }
        });
        results.push({ orderId: item.orderId, subOrderId: item.subOrderId, invoiceId: planned.invoice.id, jobId: planned.job?.id || null, duplicate: planned.duplicate === true });
      } catch (error) {
        results.push({ orderId: item.orderId, subOrderId: item.subOrderId, error: error.code || "BULK_PLAN_ITEM_FAILED", message: error.message });
      }
    }
    await audit(request, ctx, "invoice.bulk_plan", "invoice_batch", null, {
      organization_id: input.organizationId,
      legal_entity_id: input.legalEntityId,
      seller_id: input.sellerId,
      item_count: input.items.length,
      accepted_count: results.filter((item) => !item.error).length,
      failed_count: results.filter((item) => item.error).length
    }, "warning");
    return reply.code(202).send({ ok: true, results });
  });

  app.post("/v1/e-invoicing/invoices/:invoiceId/returns", async (request, reply) => {
    const ctx = await requireUser(request, { mfa: true });
    if (!config.eInvoicing.enabled) throw httpError("e-Dönüşüm modülü kapalı.", 503, "E_INVOICING_DISABLED");
    const invoiceId = uuid.parse(request.params.invoiceId);
    const input = returnSchema.parse(request.body || {});
    await assertInvoiceManage(ctx, invoiceId, input.organizationId);
    const result = await planInvoiceReturn({
      originalInvoiceId: invoiceId,
      items: input.items,
      reasonCode: input.reasonCode,
      reasonNote: input.reasonNote,
      idempotencyToken: input.idempotencyKey,
      requestId: request.id,
      actor: { id: ctx.user.id, role: ctx.profile.role }
    });
    await audit(request, ctx, "invoice.return_requested", "invoice_return", result.invoiceReturn.id, {
      original_invoice_id: invoiceId,
      return_invoice_id: result.invoice.id,
      duplicate: result.duplicate,
      item_count: input.items.length
    }, "warning");
    return reply.code(result.duplicate ? 200 : 202).send({ ok: true, ...operationResponse(result) });
  });

  app.get("/v1/e-invoicing/invoices/:invoiceId/returns/by-idempotency", async (request) => {
    const ctx = await requireUser(request);
    const invoiceId = uuid.parse(request.params.invoiceId);
    const input = returnLookupSchema.parse(request.query || {});
    const invoice = await assertInvoiceManage(ctx, invoiceId, input.organizationId);
    const key = `invoice:return:${invoice.organization_id}:${invoice.id}:${deterministicHex(input.idempotencyKey, 40)}`;
    const workflow = await supabaseAdmin.from("invoice_returns")
      .select("id, original_invoice_id, return_invoice_id, status, currency, subtotal, tax_total, grand_total, created_at, updated_at")
      .eq("original_invoice_id", invoice.id)
      .eq("idempotency_key", key)
      .maybeSingle();
    if (workflow.error) throw httpError("İade isteği uzlaştırılamadı.", 503, "RETURN_RECONCILIATION_FAILED");
    if (!workflow.data) throw httpError("Bu idempotency anahtarıyla iade isteği bulunamadı.", 404, "RETURN_REQUEST_NOT_FOUND");
    const job = workflow.data.return_invoice_id
      ? await supabaseAdmin.from("invoice_jobs")
        .select("id, status, attempt_count, next_attempt_at, last_error_code")
        .eq("invoice_id", workflow.data.return_invoice_id)
        .eq("job_type", "CREATE_RETURN_DOCUMENT")
        .maybeSingle()
      : { data: null, error: null };
    if (job.error) throw httpError("İade işi uzlaştırılamadı.", 503, "RETURN_RECONCILIATION_FAILED");
    return { ok: true, found: true, invoiceReturn: workflow.data, job: job.data || null };
  });

  app.post("/v1/e-invoicing/returns/:returnId/reject", async (request) => {
    const ctx = await requireUser(request, { mfa: true });
    const returnId = uuid.parse(request.params.returnId);
    const input = returnRejectionSchema.parse(request.body || {});
    const workflow = await supabaseAdmin.from("invoice_returns")
      .select("id, organization_id, original_invoice_id")
      .eq("id", returnId)
      .maybeSingle();
    if (workflow.error || !workflow.data || workflow.data.organization_id !== input.organizationId) {
      throw httpError("İade iş akışı bulunamadı.", 404, "RETURN_WORKFLOW_NOT_FOUND");
    }
    await assertInvoiceManage(ctx, workflow.data.original_invoice_id, input.organizationId);
    const rejected = await rejectInvoiceReturnRequest({
      invoiceReturnId: returnId,
      reason: input.reason,
      requestId: request.id,
      actor: { id: ctx.user.id, role: ctx.profile.role }
    });
    await audit(request, ctx, "invoice.return_request_rejected", "invoice_return", returnId, {
      organization_id: input.organizationId,
      original_invoice_id: workflow.data.original_invoice_id,
      reason: input.reason
    }, "warning");
    return { ok: true, invoiceReturn: pick(rejected, ["id", "original_invoice_id", "return_invoice_id", "status", "rejection_reason", "rejected_at", "updated_at"]) };
  });

  app.post("/v1/e-invoicing/invoices/:invoiceId/cancellations", async (request, reply) => {
    const ctx = await requireUser(request, { mfa: true });
    if (!config.eInvoicing.enabled) throw httpError("e-Dönüşüm modülü kapalı.", 503, "E_INVOICING_DISABLED");
    const invoiceId = uuid.parse(request.params.invoiceId);
    const input = cancellationSchema.parse(request.body || {});
    await assertInvoiceManage(ctx, invoiceId, input.organizationId);
    const result = await requestInvoiceCancellation({
      invoiceId,
      reasonCode: input.reasonCode,
      reasonNote: input.reasonNote,
      requestId: request.id,
      actor: { id: ctx.user.id, role: ctx.profile.role }
    });
    await audit(request, ctx, "invoice.cancellation_requested", "invoice_cancellation", result.cancellation.id, {
      invoice_id: invoiceId,
      duplicate: result.duplicate,
      reason_code: input.reasonCode || null
    }, "warning");
    return reply.code(result.duplicate ? 200 : 202).send({ ok: true, ...operationResponse(result) });
  });

  app.post("/v1/e-invoicing/invoices/bulk", async (request) => {
    const ctx = await requireUser(request, { roles: ["admin", "super_admin"], mfa: true });
    if (!config.eInvoicing.enabled) throw httpError("e-Dönüşüm modülü kapalı.", 503, "E_INVOICING_DISABLED");
    const input = bulkSchema.parse(request.body || {});
    await assertOrganizationAccess(ctx, input.organizationId, { manage: ["RETRY", "REFRESH_STATUS", "UPLOAD_TO_CHANNEL"].includes(input.action) });
    const { data: invoices, error } = await supabaseAdmin.from("invoices").select("*").eq("organization_id", input.organizationId).in("id", input.invoiceIds);
    if (error) throw httpError("Faturalar yüklenemedi.", 503, "BULK_INVOICE_LOAD_FAILED");
    if ((invoices || []).length !== new Set(input.invoiceIds).size) throw httpError("Bir veya daha fazla fatura bulunamadı.", 404, "BULK_INVOICE_NOT_FOUND");
    const results = [];
    for (let invoice of invoices) {
      try {
        if (input.action === "PDF" || input.action === "XML") {
          results.push({ invoiceId: invoice.id, ...(await createArtifactSignedUrl({ invoice, kind: input.action.toLowerCase(), expiresIn: config.eInvoicing.artifactSignedUrlSeconds })) });
          continue;
        }
        if (input.action === "RETRY") {
          const latest = await supabaseAdmin.from("invoice_jobs").select("*").eq("invoice_id", invoice.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (latest.error || !latest.data) throw httpError("Retry edilecek mevcut iş bulunamadı; manuel inceleme gerekir.", 409, "RETRY_JOB_NOT_FOUND");
          const job = latest.data;
          if (job.status === "PROCESSING") throw httpError("İş etkin worker lease'i altında; zorla retry yapılamaz.", 409, "JOB_LEASE_ACTIVE");
          const attemptCount = Number(job.attempt_count || 0);
          const maxAttempts = Math.min(Math.max(Number(job.max_attempts || 1), 1), 20);
          if (attemptCount >= maxAttempts || attemptCount >= 20) {
            throw httpError("İş maksimum retry sınırına ulaştı; manuel inceleme gerekiyor.", 409, "JOB_NEEDS_REVIEW");
          }
          if (["PENDING", "RETRY_SCHEDULED"].includes(job.status)) {
            results.push({ invoiceId: invoice.id, job: pick(job, ["id", "job_type", "status", "next_attempt_at"]), duplicate: true });
            continue;
          }
          if (!["FAILED", "NEEDS_REVIEW"].includes(job.status)) throw httpError("Son iş retry için uygun durumda değil.", 409, "JOB_NOT_RETRYABLE");

          const retried = await supabaseAdmin.rpc("retry_invoice_job", {
            p_job_id: job.id,
            p_actor_id: ctx.user.id,
            p_actor_role: ctx.profile.role,
            p_request_id: request.id
          });
          if (retried.error || !retried.data) throw httpError("Fatura, iş akışı ve job atomik olarak retry durumuna alınamadı.", 409, "RETRY_JOB_UPDATE_FAILED");
          const updatedJob = Array.isArray(retried.data) ? retried.data[0] : retried.data;
          results.push({ invoiceId: invoice.id, job: pick(updatedJob, ["id", "job_type", "status", "next_attempt_at"]) });
        } else {
          const jobType = input.action === "UPLOAD_TO_CHANNEL" ? "UPLOAD_TO_CHANNEL" : "REFRESH_STATUS";
          if (jobType === "UPLOAD_TO_CHANNEL") {
            if (invoice.status !== "ISSUED") {
              throw httpError("Yalnız ISSUED durumundaki fatura satış kanalına gönderilebilir.", 409, "INVOICE_NOT_READY_FOR_CHANNEL_UPLOAD");
            }
            if (!invoice.sales_channel_account_id) {
              throw httpError("Fatura bir satış kanalı hesabına bağlı değil.", 409, "INVOICE_CHANNEL_ACCOUNT_MISSING");
            }
            const accountResult = await supabaseAdmin.from("sales_channel_accounts")
              .select("id, status, capability_overrides, sales_channels(channel_key)")
              .eq("id", invoice.sales_channel_account_id)
              .maybeSingle();
            if (accountResult.error || !accountResult.data) {
              throw httpError("Faturanın satış kanalı hesabı bulunamadı.", 409, "INVOICE_CHANNEL_ACCOUNT_NOT_FOUND");
            }
            if (accountResult.data.status !== "connected") {
              throw httpError("Satış kanalı hesabı bağlı değil.", 409, "CHANNEL_ACCOUNT_NOT_CONNECTED");
            }
            const channelKey = accountResult.data.sales_channels?.channel_key || invoice.sales_channel;
            if (!["allonahub", "allona_shop"].includes(channelKey) && !config.eInvoicing.channelCallsEnabled) {
              throw httpError("Harici satış kanalı çağrıları kapalı.", 503, "SALES_CHANNEL_CALLS_DISABLED");
            }
            const capabilities = effectiveSalesChannelCapabilities(channelKey, accountResult.data.capability_overrides || {});
            if (!capabilities.invoiceUpload && !capabilities.invoiceMetadata) {
              throw httpError("Satış kanalı fatura geri aktarımını desteklemiyor.", 422, "CHANNEL_INVOICE_UPLOAD_UNSUPPORTED");
            }
          } else {
            if (!invoice.provider_document_id) {
              throw httpError("Provider belge kimliği olmadan durum sorgulanamaz.", 409, "PROVIDER_DOCUMENT_ID_MISSING");
            }
            const providerAccount = await supabaseAdmin.from("invoice_provider_accounts")
              .select("id, provider_key, environment, status")
              .eq("id", invoice.provider_account_id)
              .maybeSingle();
            if (providerAccount.error || !providerAccount.data || providerAccount.data.status !== "connected" || providerAccount.data.provider_key !== invoice.provider) {
              throw httpError("Fatura sağlayıcı hesabı bağlı veya tutarlı değil.", 409, "INVOICE_PROVIDER_ACCOUNT_NOT_CONNECTED");
            }
            if (providerAccount.data.environment === "production" && !config.eInvoicing.providerCallsEnabled) {
              throw httpError("Production provider durum sorgulamaları kapalı.", 503, "PRODUCTION_PROVIDER_CALLS_DISABLED");
            }
            if (invoice.provider === "mock" && !config.eInvoicing.mockProviderEnabled) {
              throw httpError("Mock provider bu ortamda kapalı.", 503, "MOCK_PROVIDER_DISABLED");
            }
            if (createInvoiceProvider(invoice.provider).getCapabilities().documentStatus !== true) {
              throw httpError("Fatura sağlayıcısı durum sorgulamayı desteklemiyor.", 422, "PROVIDER_DOCUMENT_STATUS_UNSUPPORTED");
            }
          }
          const scope = jobType === "UPLOAD_TO_CHANNEL" ? "manual_upload" : `${input.action.toLowerCase()}:${request.id}`;
          const enqueued = await enqueueInvoiceJob({ invoice, jobType, requestId: request.id, scope });
          results.push({ invoiceId: invoice.id, job: enqueued.job, duplicate: enqueued.duplicate });
        }
      } catch (itemError) {
        results.push({ invoiceId: invoice.id, error: itemError.code || "BULK_ITEM_FAILED", message: itemError.message });
      }
    }
    await audit(request, ctx, `invoice.bulk.${input.action.toLowerCase()}`, "invoice_batch", null, { organization_id: input.organizationId, invoice_ids: input.invoiceIds, result_count: results.length }, "warning");
    return { ok: true, action: input.action, results };
  });

  app.get("/v1/e-invoicing/invoices/:invoiceId/artifacts/:kind", async (request) => {
    const ctx = await requireUser(request);
    const params = artifactParamsSchema.parse(request.params || {});
    await assertInvoiceAccess(ctx, params.invoiceId);
    const { data: invoice, error } = await supabaseAdmin.from("invoices").select("*").eq("id", params.invoiceId).single();
    if (error) throw httpError("Fatura bulunamadı.", 404, "INVOICE_NOT_FOUND");
    const artifact = await createArtifactSignedUrl({ invoice, kind: params.kind, expiresIn: config.eInvoicing.artifactSignedUrlSeconds });
    await audit(request, ctx, `invoice.artifact.${params.kind}`, "invoice", invoice.id, { signed_url_seconds: artifact.expiresIn });
    return { ok: true, ...artifact };
  });

  app.get("/v1/e-invoicing/invoices/:invoiceId", async (request) => {
    const ctx = await requireUser(request);
    const invoiceId = uuid.parse(request.params.invoiceId);
    await assertInvoiceAccess(ctx, invoiceId);
    const [invoiceResult, itemsResult] = await Promise.all([
      ctx.db.from("invoice_api_rows")
        .select("id, organization_id, legal_entity_id, seller_id, order_id, sub_order_id, original_invoice_id, document_type, document_scope, invoice_number, issue_date, currency, subtotal, discount_total, shipping_total, tax_total, grand_total, status, sales_channel, sales_channel_account_id, created_at")
        .eq("id", invoiceId)
        .maybeSingle(),
      ctx.db.from("invoice_items")
        .select("id, order_item_id, product_id, sku, barcode, description, quantity, unit_code, unit_price, discount_amount, tax_rate, tax_amount, line_total")
        .eq("invoice_id", invoiceId)
        .order("created_at")
    ]);
    if (invoiceResult.error || !invoiceResult.data) throw httpError("Fatura bulunamadı.", 404, "INVOICE_NOT_FOUND");
    if (itemsResult.error) throw httpError("Fatura kalemleri alınamadı.", 503, "INVOICE_ITEMS_LOAD_FAILED");
    const itemIds = (itemsResult.data || []).map((item) => item.id);
    const returnWorkflows = itemIds.length
      ? await supabaseAdmin.from("invoice_returns").select("id").eq("original_invoice_id", invoiceId).neq("status", "REJECTED")
      : { data: [], error: null };
    if (returnWorkflows.error) throw httpError("İade edilebilir miktarlar alınamadı.", 503, "RETURNABLE_QUANTITY_LOAD_FAILED");
    const workflowIds = (returnWorkflows.data || []).map((item) => item.id);
    const returned = workflowIds.length
      ? await supabaseAdmin.from("invoice_return_items").select("original_invoice_item_id, quantity").in("original_invoice_item_id", itemIds).in("invoice_return_id", workflowIds)
      : { data: [], error: null };
    if (returned.error) throw httpError("İade edilebilir miktarlar alınamadı.", 503, "RETURNABLE_QUANTITY_LOAD_FAILED");
    const returnedByItem = new Map();
    for (const row of returned.data || []) {
      const current = returnedByItem.get(row.original_invoice_item_id) || 0n;
      returnedByItem.set(row.original_invoice_item_id, current + decimalToInteger(row.quantity, 4));
    }
    const items = (itemsResult.data || []).map((item) => {
      const originalQuantity = decimalToInteger(item.quantity, 4);
      const remaining = originalQuantity - (returnedByItem.get(item.id) || 0n);
      return { ...item, returnable_quantity: integerToDecimal(remaining > 0n ? remaining : 0n, 4) };
    });
    return { ok: true, invoice: await addArtifactAvailability(invoiceResult.data), items };
  });

  app.get("/v1/account/orders/:orderId/invoices", async (request) => {
    const ctx = await requireUser(request);
    const orderId = uuid.parse(request.params.orderId);
    const { data: order, error: orderError } = await supabaseAdmin.from("orders").select("id, user_id, customer_invoice_profile_id").eq("id", orderId).maybeSingle();
    if (orderError || !order || order.user_id !== ctx.user.id) throw httpError("Sipariş bulunamadı.", 404, "ORDER_NOT_FOUND");
    const { data, error } = await supabaseAdmin.from("invoice_api_rows")
      .select("id, customer_id, seller_id, document_scope, document_type, provider_document_id, ettn_uuid, invoice_number, issue_date, issued_at, currency, grand_total, status, created_at")
      .eq("order_id", orderId)
      .eq("customer_id", ctx.user.id)
      .order("created_at", { ascending: false });
    if (error) throw httpError("Sipariş faturaları alınamadı.", 503, "CUSTOMER_INVOICE_LIST_FAILED");
    const visibleInvoices = (data || []).filter(isCustomerInvoiceVisible);
    const invoiceIds = visibleInvoices.map((invoice) => invoice.id);
    const sellerIds = [...new Set(visibleInvoices.map((invoice) => invoice.seller_id).filter(Boolean))];
    const artifacts = invoiceIds.length
      ? await supabaseAdmin.from("invoices").select("id, pdf_reference, xml_reference").in("id", invoiceIds)
      : { data: [], error: null };
    if (artifacts.error) throw httpError("Fatura belge durumu alınamadı.", 503, "CUSTOMER_ARTIFACT_STATUS_FAILED");
    const sellers = sellerIds.length
      ? await supabaseAdmin.from("seller_profiles").select("id, display_name").in("id", sellerIds)
      : { data: [], error: null };
    if (sellers.error) throw httpError("Fatura satıcı bilgileri alınamadı.", 503, "CUSTOMER_SELLER_LIST_FAILED");
    const artifactMap = new Map((artifacts.data || []).map((item) => [item.id, item]));
    const sellerMap = new Map((sellers.data || []).map((seller) => [seller.id, { display_name: seller.display_name }]));
    return {
      ok: true,
      customerInvoiceProfileId: order.customer_invoice_profile_id || null,
      profileLocked: visibleInvoices.some((invoice) => invoice.document_scope === "CUSTOMER_SALE"),
      items: visibleInvoices.map((invoice) => {
        const {
          customer_id,
          document_scope,
          provider_document_id,
          ettn_uuid,
          issued_at,
          ...customerInvoice
        } = invoice;
        return {
          ...customerInvoice,
          seller: sellerMap.get(invoice.seller_id) || null,
          hasPdf: Boolean(artifactMap.get(invoice.id)?.pdf_reference),
          hasXml: Boolean(artifactMap.get(invoice.id)?.xml_reference)
        };
      })
    };
  });

  app.post("/v1/e-invoicing/organizations", async (request, reply) => {
    const ctx = await requireUser(request, { mfa: true });
    const input = organizationSchema.parse(request.body || {});
    const result = await ctx.db.rpc("create_e_invoicing_organization", { p_name: input.name, p_slug: input.slug });
    if (result.error?.code === "23505") throw httpError("Organization slug zaten kullanılıyor.", 409, "ORGANIZATION_SLUG_EXISTS");
    if (result.error) throw httpError("Organization ve owner üyeliği atomik olarak oluşturulamadı.", 503, "ORGANIZATION_CREATE_FAILED");
    const organization = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!organization) throw httpError("Organization oluşturulamadı.", 503, "ORGANIZATION_CREATE_FAILED");
    await audit(request, ctx, "organization.created", "organization", organization.id, {});
    return reply.code(201).send({ ok: true, organization });
  });

  app.post("/v1/e-invoicing/legal-entities", async (request, reply) => {
    const ctx = await requireUser(request, { mfa: true });
    const input = legalEntitySchema.parse(request.body || {});
    await assertOrganizationAccess(ctx, input.organizationId, { manage: true });
    const { data, error } = await supabaseAdmin.from("legal_entities").insert({
      organization_id: input.organizationId,
      legal_name: input.legalName,
      display_name: input.displayName || null,
      country_code: input.countryCode.toUpperCase(),
      tax_number: input.taxNumber || null,
      tax_office: input.taxOffice || null,
      billing_address: input.billingAddress,
      contact_email: input.contactEmail || null,
      status: "draft"
    }).select("id, organization_id, legal_name, display_name, country_code, tax_office, contact_email, status, created_at").single();
    if (error) throw httpError("Şirket kaydı oluşturulamadı.", 503, "LEGAL_ENTITY_CREATE_FAILED");
    await audit(request, ctx, "legal_entity.created", "legal_entity", data.id, { organization_id: input.organizationId });
    return reply.code(201).send({ ok: true, legalEntity: data });
  });

  app.post("/v1/e-invoicing/sellers", async (request, reply) => {
    const ctx = await requireUser(request, { mfa: true });
    const input = sellerSchema.parse(request.body || {});
    await assertOrganizationAccess(ctx, input.organizationId, { manage: true });
    const { data: legalEntity } = await supabaseAdmin.from("legal_entities").select("id, organization_id").eq("id", input.legalEntityId).eq("organization_id", input.organizationId).maybeSingle();
    if (!legalEntity) throw httpError("Legal entity organization ile eşleşmiyor.", 409, "LEGAL_ENTITY_TENANT_MISMATCH");
    let partnerBusinessId = null;
    if (input.partnerBusinessId) {
      if (!hasRole(ctx.profile, ["super_admin"])) {
        throw httpError("Partner işletmesi bağlantısını yalnız super admin yapabilir.", 403, "PARTNER_BUSINESS_LINK_FORBIDDEN");
      }
      const { data: partnerBusiness, error: partnerBusinessError } = await supabaseAdmin
        .from("partner_businesses")
        .select("id")
        .eq("id", input.partnerBusinessId)
        .eq("status", "active")
        .eq("verification_status", "verified")
        .maybeSingle();
      if (partnerBusinessError) throw httpError("Partner işletmesi doğrulanamadı.", 503, "PARTNER_BUSINESS_LOOKUP_FAILED");
      if (!partnerBusiness) {
        throw httpError("Partner işletmesi etkin ve doğrulanmış olmalıdır.", 409, "PARTNER_BUSINESS_NOT_VERIFIED");
      }
      partnerBusinessId = partnerBusiness.id;
    }
    const { data, error } = await supabaseAdmin.from("seller_profiles").insert({
      organization_id: input.organizationId,
      legal_entity_id: input.legalEntityId,
      partner_business_id: partnerBusinessId,
      seller_code: input.sellerCode,
      display_name: input.displayName,
      status: "draft"
    }).select("id, organization_id, legal_entity_id, partner_business_id, seller_code, display_name, status, created_at").single();
    if (error?.code === "23505") throw httpError("Satıcı kodu zaten kullanılıyor.", 409, "SELLER_CODE_EXISTS");
    if (error) throw httpError("Satıcı oluşturulamadı.", 503, "SELLER_CREATE_FAILED");
    await audit(request, ctx, "seller.created", "seller", data.id, { legal_entity_id: input.legalEntityId });
    return reply.code(201).send({ ok: true, seller: data });
  });

  app.post("/v1/e-invoicing/sales-channel-accounts", async (request, reply) => {
    const ctx = await requireUser(request, { mfa: true });
    const input = channelAccountSchema.parse(request.body || {});
    await assertSellerManage(ctx, input.organizationId, input.legalEntityId, input.sellerId);
    const localChannel = ["allonahub", "allona_shop"].includes(input.channelKey);
    const channelEnvironment = input.environment || (localChannel ? "local" : "sandbox");
    if (localChannel && channelEnvironment !== "local") throw httpError("Yerel kanal hesabı local ortam kullanmalıdır.", 422, "LOCAL_CHANNEL_ENVIRONMENT_REQUIRED");
    if (!localChannel && channelEnvironment === "local") throw httpError("Harici kanal local ortam kullanamaz.", 422, "EXTERNAL_CHANNEL_ENVIRONMENT_INVALID");
    if (localChannel && input.credentialReference) throw httpError("Yerel kanal credential kabul etmez.", 422, "LOCAL_CHANNEL_CREDENTIAL_FORBIDDEN");
    if (!localChannel && !input.credentialReference) throw httpError("Harici satış kanalı credential reference zorunludur.", 422, "CREDENTIAL_REFERENCE_REQUIRED");
    if (input.credentialReference) {
      await assertCredentialBinding({
        db: supabaseAdmin,
        reference: input.credentialReference,
        organizationId: input.organizationId,
        legalEntityId: input.legalEntityId,
        integrationType: "sales_channel",
        integrationKey: input.channelKey,
        purpose: "api"
      });
    }
    const [{ data: seller }, { data: channel }] = await Promise.all([
      supabaseAdmin.from("seller_profiles").select("id, organization_id, legal_entity_id").eq("id", input.sellerId).maybeSingle(),
      supabaseAdmin.from("sales_channels").select("id, channel_key, capabilities").eq("channel_key", input.channelKey).maybeSingle()
    ]);
    if (!seller || seller.organization_id !== input.organizationId || seller.legal_entity_id !== input.legalEntityId) {
      throw httpError("Satıcı tenant eşleşmesi geçersiz.", 409, "SELLER_TENANT_MISMATCH");
    }
    if (!channel) throw httpError("Satış kanalı bulunamadı.", 404, "SALES_CHANNEL_NOT_FOUND");
    const { data, error } = await supabaseAdmin.from("sales_channel_accounts").insert({
      organization_id: input.organizationId,
      legal_entity_id: input.legalEntityId,
      seller_id: input.sellerId,
      sales_channel_id: channel.id,
      account_name: input.accountName,
      external_account_id: input.externalAccountId || null,
      environment: channelEnvironment,
      credential_reference: input.credentialReference || null,
      status: "pending"
    }).select("id, organization_id, legal_entity_id, seller_id, sales_channel_id, account_name, external_account_id, capability_overrides, status, created_at").single();
    if (error) throw httpError("Satış kanalı hesabı oluşturulamadı.", 503, "SALES_CHANNEL_ACCOUNT_CREATE_FAILED");
    await audit(request, ctx, "sales_channel_account.created", "sales_channel_account", data.id, { channel: input.channelKey, seller_id: input.sellerId });
    return reply.code(201).send({ ok: true, channelAccount: data, connected: false });
  });

  app.post("/v1/e-invoicing/invoice-profiles", async (request, reply) => {
    const ctx = await requireUser(request, { mfa: true });
    const input = invoiceProfileSchema.parse(request.body || {});
    await assertLegalEntityManage(ctx, input.organizationId, input.legalEntityId);
    const { data, error } = await supabaseAdmin.from("invoice_profiles").insert({
      organization_id: input.organizationId,
      legal_entity_id: input.legalEntityId,
      profile_name: input.profileName,
      document_prefix: input.documentPrefix || null,
      default_scenario: input.defaultScenario,
      default_currency: input.defaultCurrency.toUpperCase(),
      default_unit_code: input.defaultUnitCode,
      tax_configuration: input.taxConfiguration,
      is_default: input.isDefault,
      status: "draft"
    }).select("id, organization_id, legal_entity_id, profile_name, document_prefix, default_scenario, default_currency, default_unit_code, is_default, status, created_at").single();
    if (error) throw httpError("Fatura profili oluşturulamadı.", 503, "INVOICE_PROFILE_CREATE_FAILED");
    await audit(request, ctx, "invoice_profile.created", "invoice_profile", data.id, { legal_entity_id: input.legalEntityId });
    return reply.code(201).send({ ok: true, invoiceProfile: data });
  });

  app.post("/v1/e-invoicing/sales-channel-accounts/:accountId/test", async (request) => {
    const ctx = await requireUser(request, { mfa: true });
    const accountId = uuid.parse(request.params.accountId);
    const { data: account, error } = await supabaseAdmin.from("sales_channel_accounts").select("*, sales_channels(channel_key)").eq("id", accountId).maybeSingle();
    if (error || !account) throw httpError("Satış kanalı hesabı bulunamadı.", 404, "SALES_CHANNEL_ACCOUNT_NOT_FOUND");
    await assertSalesChannelAccountManage(ctx, account);
    const channelKey = account.sales_channels?.channel_key;
    const localChannel = ["allonahub", "allona_shop"].includes(channelKey);
    if (!localChannel && !config.eInvoicing.channelCallsEnabled) throw httpError("Harici satış kanalı çağrıları kapalı.", 503, "SALES_CHANNEL_CALLS_DISABLED");
    const provider = createSalesChannelProvider(channelKey, ["allonahub", "allona_shop"].includes(channelKey) ? {
      testConnection: async () => ({ ok: true, local: true, channel: channelKey })
    } : {});
    const credentials = localChannel ? null : await resolveBoundCredential({
      db: supabaseAdmin,
      reference: account.credential_reference,
      organizationId: account.organization_id,
      legalEntityId: account.legal_entity_id,
      integrationType: "sales_channel",
      integrationKey: channelKey,
      purpose: "api"
    });
    try {
      const result = await provider.testConnection({ accountId: account.id, credentials, environment: account.environment });
      await supabaseAdmin.from("sales_channel_accounts").update({ status: "connected", last_tested_at: new Date().toISOString(), last_error_code: null }).eq("id", account.id);
      await audit(request, ctx, "sales_channel_account.test_succeeded", "sales_channel_account", account.id, { channel: channelKey });
      return { ok: true, result, capabilities: provider.getCapabilities() };
    } catch (testError) {
      await supabaseAdmin.from("sales_channel_accounts").update({ status: "error", last_tested_at: new Date().toISOString(), last_error_code: testError.code || "CONNECTION_TEST_FAILED" }).eq("id", account.id);
      await audit(request, ctx, "sales_channel_account.test_failed", "sales_channel_account", account.id, { channel: channelKey, error_code: testError.code || "CONNECTION_TEST_FAILED" }, "warning");
      throw testError;
    }
  });

  app.patch("/v1/e-invoicing/sales-channel-accounts/:accountId/status", async (request) => {
    const ctx = await requireUser(request, { mfa: true });
    const accountId = uuid.parse(request.params.accountId);
    const input = connectionStatusSchema.parse(request.body || {});
    const existing = await supabaseAdmin.from("sales_channel_accounts").select("id, organization_id, legal_entity_id, seller_id, status").eq("id", accountId).maybeSingle();
    if (existing.error || !existing.data || existing.data.organization_id !== input.organizationId) throw httpError("Satış kanalı hesabı bulunamadı.", 404, "SALES_CHANNEL_ACCOUNT_NOT_FOUND");
    await assertSalesChannelAccountManage(ctx, existing.data);
    const updated = await supabaseAdmin.from("sales_channel_accounts").update({ status: input.status }).eq("id", accountId).eq("organization_id", input.organizationId).select("id, status, updated_at").single();
    if (updated.error) throw httpError("Satış kanalı durumu güncellenemedi.", 503, "SALES_CHANNEL_STATUS_UPDATE_FAILED");
    await audit(request, ctx, "sales_channel_account.status_changed", "sales_channel_account", accountId, { old_status: existing.data.status, new_status: input.status }, "warning");
    return { ok: true, account: updated.data };
  });

  app.post("/v1/account/invoice-profiles", async (request, reply) => {
    const ctx = await requireUser(request);
    const input = customerInvoiceProfileSchema.parse(request.body || {});
    if (input.isDefault) {
      await supabaseAdmin.from("customer_invoice_profiles").update({ is_default: false }).eq("customer_id", ctx.user.id).eq("status", "active");
    }
    const { data, error } = await supabaseAdmin.from("customer_invoice_profiles").insert({
      customer_id: ctx.user.id,
      profile_type: input.profileType,
      name: input.profileType === "individual" ? input.name || null : null,
      surname: input.profileType === "individual" ? input.surname || null : null,
      company_name: input.profileType === "corporate" ? input.companyName || null : null,
      tax_number: input.profileType === "corporate" ? input.taxNumber || null : null,
      tax_office: input.profileType === "corporate" ? input.taxOffice || null : null,
      billing_address: input.billingAddress,
      email: input.email || ctx.user.email || null,
      taxpayer_status: "unknown",
      taxpayer_status_source: "unverified",
      taxpayer_status_checked_at: null,
      taxpayer_status_provider_account_id: null,
      is_default: input.isDefault,
      status: "active"
    }).select("id, profile_type, name, surname, company_name, tax_office, billing_address, email, taxpayer_status, is_default, status, created_at").single();
    if (error) throw httpError("Müşteri fatura profili kaydedilemedi.", 503, "CUSTOMER_INVOICE_PROFILE_CREATE_FAILED");
    await audit(request, ctx, "customer_invoice_profile.created", "customer_invoice_profile", data.id, { profile_type: input.profileType, is_default: input.isDefault });
    return reply.code(201).send({ ok: true, profile: data });
  });

  app.post("/v1/account/orders/:orderId/invoice-profiles", async (request, reply) => {
    const ctx = await requireUser(request);
    const orderId = uuid.parse(request.params.orderId);
    const input = customerInvoiceProfileSchema.parse(request.body || {});
    const result = await ctx.db.rpc("create_and_attach_order_invoice_profile", {
      p_order_id: orderId,
      p_profile_type: input.profileType,
      p_name: input.profileType === "individual" ? input.name || null : null,
      p_surname: input.profileType === "individual" ? input.surname || null : null,
      p_company_name: input.profileType === "corporate" ? input.companyName || null : null,
      p_tax_number: input.profileType === "corporate" ? input.taxNumber || null : null,
      p_tax_office: input.profileType === "corporate" ? input.taxOffice || null : null,
      p_billing_address: input.billingAddress,
      p_email: input.email || ctx.user.email || null,
      p_is_default: input.isDefault
    });
    if (result.error?.code === "23505") throw httpError("Fatura oluşturulduktan sonra yeni profil siparişe bağlanamaz.", 409, "INVOICE_ALREADY_EXISTS");
    if (result.error?.code === "P0002") throw httpError("Sipariş bulunamadı veya size ait değil.", 404, "ORDER_NOT_FOUND");
    if (result.error?.code === "42501") throw httpError("Sipariş fatura profili için yetkiniz yok.", 403, "ORDER_INVOICE_PROFILE_FORBIDDEN");
    if (result.error?.code === "22023") throw httpError("Müşteri fatura profili alanları geçersiz.", 422, "CUSTOMER_INVOICE_PROFILE_INVALID");
    if (result.error) throw httpError("Fatura profili ve sipariş bağlantısı atomik olarak oluşturulamadı.", 503, "CUSTOMER_INVOICE_PROFILE_ATTACH_FAILED");
    const profile = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!profile) throw httpError("Fatura profili oluşturulamadı.", 503, "CUSTOMER_INVOICE_PROFILE_ATTACH_FAILED");
    await audit(request, ctx, "customer_invoice_profile.created_and_attached", "customer_invoice_profile", profile.profile_id, { order_id: orderId, is_default: profile.is_default });
    return reply.code(201).send({ ok: true, profile });
  });

  app.get("/v1/account/invoice-profiles", async (request) => {
    const ctx = await requireUser(request);
    const { data, error } = await ctx.db.from("customer_invoice_profiles")
      .select("id, profile_type, name, surname, company_name, tax_number, tax_office, billing_address, email, taxpayer_status, is_default, status, created_at, updated_at")
      .eq("customer_id", ctx.user.id)
      .neq("status", "deleted")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw httpError("Fatura profilleri alınamadı.", 503, "CUSTOMER_INVOICE_PROFILE_LIST_FAILED");
    return { ok: true, items: data || [] };
  });

  app.patch("/v1/account/orders/:orderId/invoice-profile", async (request) => {
    const ctx = await requireUser(request);
    const orderId = uuid.parse(request.params.orderId);
    const profileId = uuid.parse(request.body?.profileId);
    const result = await ctx.db.rpc("attach_order_invoice_profile", {
      p_order_id: orderId,
      p_profile_id: profileId
    });
    if (result.error) {
      if (result.error.code === "23505") {
        throw httpError("Fatura oluşturulduktan sonra sipariş profili değiştirilemez.", 409, "INVOICE_ALREADY_EXISTS");
      }
      if (result.error.code === "22023") {
        throw httpError("Seçilen fatura profilinde zorunlu kimlik, e-posta veya adres alanları eksik.", 422, "CUSTOMER_INVOICE_PROFILE_INCOMPLETE");
      }
      if (result.error.code === "P0002") {
        throw httpError("Sipariş veya aktif fatura profili bulunamadı.", 404, "ORDER_OR_INVOICE_PROFILE_NOT_FOUND");
      }
      if (result.error.code === "42501") {
        throw httpError("Sipariş fatura profili için yetkiniz yok.", 403, "ORDER_INVOICE_PROFILE_FORBIDDEN");
      }
      throw httpError("Sipariş fatura profili atomik olarak güncellenemedi.", 503, "ORDER_INVOICE_PROFILE_UPDATE_FAILED");
    }
    const order = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!order) throw httpError("Sipariş fatura profili güncellenemedi.", 503, "ORDER_INVOICE_PROFILE_UPDATE_FAILED");
    await audit(request, ctx, "order.invoice_profile_attached", "order", order.id, { invoice_profile_id: order.customer_invoice_profile_id });
    return { ok: true, order };
  });

  app.post("/v1/e-invoicing/provider-accounts", async (request, reply) => {
    const ctx = await requireUser(request, { mfa: true });
    const input = providerAccountSchema.parse(request.body || {});
    await assertLegalEntityManage(ctx, input.organizationId, input.legalEntityId);
    if (input.providerKey === "mock" && !config.eInvoicing.mockProviderEnabled) throw httpError("Mock provider kapalı.", 503, "MOCK_PROVIDER_DISABLED");
    if (input.providerKey === "mock" && input.environment !== "mock") throw httpError("Mock provider yalnız mock environment kullanabilir.", 422, "MOCK_ENVIRONMENT_REQUIRED");
    if (input.providerKey !== "mock" && input.environment === "mock") throw httpError("Gerçek provider skeleton'ı sandbox veya production environment kullanmalıdır.", 422, "PROVIDER_ENVIRONMENT_INVALID");
    if (input.providerKey === "mock" && input.credentialReference) throw httpError("Mock provider credential kabul etmez.", 422, "MOCK_CREDENTIAL_FORBIDDEN");
    if (input.providerKey !== "mock" && !input.credentialReference) throw httpError("Gerçek provider credential reference zorunludur.", 422, "CREDENTIAL_REFERENCE_REQUIRED");
    if (input.credentialReference) {
      await assertCredentialBinding({
        db: supabaseAdmin,
        reference: input.credentialReference,
        organizationId: input.organizationId,
        legalEntityId: input.legalEntityId,
        integrationType: "invoice_provider",
        integrationKey: input.providerKey,
        purpose: "api"
      });
    }
    if (input.webhookSecretReference) {
      await assertCredentialBinding({
        db: supabaseAdmin,
        reference: input.webhookSecretReference,
        organizationId: input.organizationId,
        legalEntityId: input.legalEntityId,
        integrationType: "invoice_provider",
        integrationKey: input.providerKey,
        purpose: "webhook"
      });
    }
    const provider = createInvoiceProvider(input.providerKey);
    const productionReady = input.providerKey === "mock" ? false : Object.values(provider.getCapabilities()).some(Boolean);
    const status = input.providerKey === "mock" ? "connected" : "disconnected";
    const { data, error } = await supabaseAdmin.from("invoice_provider_accounts").insert({
      organization_id: input.organizationId,
      legal_entity_id: input.legalEntityId,
      provider_key: input.providerKey,
      account_label: input.accountLabel,
      environment: input.environment,
      credential_reference: input.credentialReference || null,
      capabilities: provider.getCapabilities(),
      settings: input.webhookSecretReference ? { webhook_secret_reference: input.webhookSecretReference } : {},
      status
    }).select("id, organization_id, legal_entity_id, provider_key, account_label, environment, capabilities, status, created_at").single();
    if (error) throw httpError("Provider hesabı kaydedilemedi.", 503, "PROVIDER_ACCOUNT_CREATE_FAILED");
    await audit(request, ctx, "invoice_provider_account.created", "invoice_provider_account", data.id, { provider: input.providerKey, environment: input.environment, production_ready: productionReady });
    return reply.code(201).send({ ok: true, providerAccount: data, productionReady });
  });

  app.post("/v1/e-invoicing/provider-accounts/:accountId/test", async (request) => {
    const ctx = await requireUser(request, { mfa: true });
    const accountId = uuid.parse(request.params.accountId);
    const { data: account, error } = await supabaseAdmin.from("invoice_provider_accounts").select("*").eq("id", accountId).maybeSingle();
    if (error || !account) throw httpError("Provider hesabı bulunamadı.", 404, "PROVIDER_ACCOUNT_NOT_FOUND");
    await assertLegalEntityManage(ctx, account.organization_id, account.legal_entity_id);
    if (account.environment === "production" && !config.eInvoicing.providerCallsEnabled) throw httpError("Production provider test çağrıları kapalı.", 503, "PRODUCTION_PROVIDER_CALLS_DISABLED");
    const provider = createInvoiceProvider(account.provider_key);
    const credentials = account.provider_key === "mock" ? null : await resolveBoundCredential({
      db: supabaseAdmin,
      reference: account.credential_reference,
      organizationId: account.organization_id,
      legalEntityId: account.legal_entity_id,
      integrationType: "invoice_provider",
      integrationKey: account.provider_key,
      purpose: "api"
    });
    try {
      const result = await provider.testConnection({ credentials, environment: account.environment });
      await supabaseAdmin.from("invoice_provider_accounts").update({ status: "connected", capabilities: provider.getCapabilities(), last_tested_at: new Date().toISOString(), last_error_code: null }).eq("id", account.id);
      await audit(request, ctx, "invoice_provider_account.test_succeeded", "invoice_provider_account", account.id, { provider: account.provider_key, environment: account.environment });
      return { ok: true, result, capabilities: provider.getCapabilities() };
    } catch (testError) {
      await supabaseAdmin.from("invoice_provider_accounts").update({ status: "error", last_tested_at: new Date().toISOString(), last_error_code: testError.code || "CONNECTION_TEST_FAILED" }).eq("id", account.id);
      await audit(request, ctx, "invoice_provider_account.test_failed", "invoice_provider_account", account.id, { provider: account.provider_key, error_code: testError.code || "CONNECTION_TEST_FAILED" }, "warning");
      throw testError;
    }
  });

  app.patch("/v1/e-invoicing/provider-accounts/:accountId/status", async (request) => {
    const ctx = await requireUser(request, { mfa: true });
    const accountId = uuid.parse(request.params.accountId);
    const input = connectionStatusSchema.parse(request.body || {});
    const existing = await supabaseAdmin.from("invoice_provider_accounts").select("id, organization_id, legal_entity_id, status").eq("id", accountId).maybeSingle();
    if (existing.error || !existing.data || existing.data.organization_id !== input.organizationId) throw httpError("Provider hesabı bulunamadı.", 404, "PROVIDER_ACCOUNT_NOT_FOUND");
    await assertLegalEntityManage(ctx, existing.data.organization_id, existing.data.legal_entity_id);
    const updated = await supabaseAdmin.from("invoice_provider_accounts").update({ status: input.status }).eq("id", accountId).eq("organization_id", input.organizationId).select("id, status, updated_at").single();
    if (updated.error) throw httpError("Provider hesabı durumu güncellenemedi.", 503, "PROVIDER_STATUS_UPDATE_FAILED");
    await audit(request, ctx, "invoice_provider_account.status_changed", "invoice_provider_account", accountId, { old_status: existing.data.status, new_status: input.status }, "warning");
    return { ok: true, account: updated.data };
  });

  app.patch("/v1/e-invoicing/config/:resource/:id/status", async (request) => {
    const ctx = await requireUser(request, { mfa: true });
    const id = uuid.parse(request.params.id);
    const input = configStatusSchema.parse(request.body || {});
    if (input.confirmation !== "DURUMU_GUNCELLE") throw httpError("Durum değişikliği onayı geçersiz.", 422, "STATUS_CONFIRMATION_REQUIRED");
    const resources = {
      "legal-entities": { table: "legal_entities", organizationColumn: "organization_id", legalEntityColumn: null },
      sellers: { table: "seller_profiles", organizationColumn: "organization_id", legalEntityColumn: "legal_entity_id" },
      "invoice-profiles": { table: "invoice_profiles", organizationColumn: "organization_id", legalEntityColumn: "legal_entity_id" }
    };
    const definition = resources[String(request.params.resource || "")];
    if (!definition) throw httpError("Yapılandırma kaynağı bulunamadı.", 404, "CONFIG_RESOURCE_NOT_FOUND");
    const fields = [definition.organizationColumn, definition.legalEntityColumn, ...(String(request.params.resource || "") === "legal-entities" ? ["country_code", "tax_number", "tax_office", "billing_address"] : [])].filter(Boolean).join(", ");
    const existing = await supabaseAdmin.from(definition.table).select(fields).eq("id", id).maybeSingle();
    if (existing.error || !existing.data || existing.data[definition.organizationColumn] !== input.organizationId) {
      throw httpError("Yapılandırma kaydı bulunamadı.", 404, "CONFIG_RESOURCE_NOT_FOUND");
    }
    if (definition.legalEntityColumn) {
      await assertLegalEntityManage(ctx, input.organizationId, existing.data[definition.legalEntityColumn]);
    } else {
      await assertOrganizationAccess(ctx, input.organizationId, { manage: true });
    }
    if (String(request.params.resource || "") === "legal-entities" && input.status === "active" && !legalEntityReady(existing.data)) {
      throw httpError("Şirket etkinleştirilmeden önce vergi kimliği ve eksiksiz fatura adresi zorunludur.", 422, "LEGAL_ENTITY_INVOICE_PROFILE_INCOMPLETE");
    }
    if (String(request.params.resource || "") === "invoice-profiles" && input.status === "active") {
      const activated = await supabaseAdmin.rpc("activate_invoice_profile", {
        p_profile_id: id,
        p_organization_id: input.organizationId
      });
      if (activated.error?.code === "23514") throw httpError("Arşivlenmiş fatura profili etkinleştirilemez.", 409, "INVOICE_PROFILE_ACTIVATION_INVALID");
      if (activated.error || !activated.data) throw httpError("Fatura profili atomik olarak etkinleştirilemedi.", 503, "INVOICE_PROFILE_ACTIVATION_FAILED");
      const item = Array.isArray(activated.data) ? activated.data[0] : activated.data;
      await audit(request, ctx, "invoice_profile.activated", "invoice_profiles", id, { status: "active", default_switch: item?.is_default === true }, "warning");
      return { ok: true, item };
    }
    const { data, error } = await supabaseAdmin.from(definition.table).update({ status: input.status }).eq("id", id).eq(definition.organizationColumn, input.organizationId).select("id, status, updated_at").maybeSingle();
    if (error || !data) throw httpError("Yapılandırma durumu güncellenemedi.", 404, "CONFIG_STATUS_UPDATE_FAILED");
    await audit(request, ctx, "e_invoicing.config_status_changed", definition.table, id, { status: input.status }, "warning");
    return { ok: true, item: data };
  });

  app.put("/v1/e-invoicing/settings", async (request) => {
    const ctx = await requireUser(request, { mfa: true });
    const input = settingSchema.parse(request.body || {});
    await assertLegalEntityManage(ctx, input.organizationId, input.legalEntityId);
    const [profileResult, providerResult, channelResult] = await Promise.all([
      supabaseAdmin.from("invoice_profiles").select("id, organization_id, legal_entity_id, status").eq("id", input.invoiceProfileId).maybeSingle(),
      supabaseAdmin.from("invoice_provider_accounts").select("id, organization_id, legal_entity_id, status").eq("id", input.invoiceProviderAccountId).maybeSingle(),
      input.salesChannelAccountId
        ? supabaseAdmin.from("sales_channel_accounts").select("id, organization_id, legal_entity_id, status, capability_overrides, sales_channels(channel_key)").eq("id", input.salesChannelAccountId).maybeSingle()
        : Promise.resolve({ data: null, error: null })
    ]);
    if (profileResult.error || providerResult.error || channelResult.error) throw httpError("Fatura ayarı bağlantıları doğrulanamadı.", 503, "INVOICE_SETTINGS_DEPENDENCY_LOOKUP_FAILED");
    if (!profileResult.data || profileResult.data.organization_id !== input.organizationId || profileResult.data.legal_entity_id !== input.legalEntityId || profileResult.data.status !== "active") {
      throw httpError("Etkin fatura profili seçilmelidir.", 422, "INVOICE_SETTINGS_PROFILE_INVALID");
    }
    if (!providerResult.data || providerResult.data.organization_id !== input.organizationId || providerResult.data.legal_entity_id !== input.legalEntityId || providerResult.data.status !== "connected") {
      throw httpError("Bağlı fatura provider hesabı seçilmelidir.", 422, "INVOICE_SETTINGS_PROVIDER_INVALID");
    }
    if (input.salesChannelAccountId && (!channelResult.data || channelResult.data.organization_id !== input.organizationId || channelResult.data.legal_entity_id !== input.legalEntityId)) {
      throw httpError("Satış kanalı hesabı tenant ile eşleşmiyor.", 422, "INVOICE_SETTINGS_CHANNEL_INVALID");
    }
    if (input.autoUploadToChannel) {
      if (!channelResult.data) throw httpError("Otomatik kanal aktarımı için belirli bir mağaza seçilmelidir.", 422, "AUTO_UPLOAD_CHANNEL_REQUIRED");
      if (channelResult.data.status !== "connected") throw httpError("Otomatik aktarım için mağaza hesabı bağlı olmalıdır.", 422, "AUTO_UPLOAD_CHANNEL_NOT_CONNECTED");
      const channelKey = channelResult.data.sales_channels?.channel_key;
      const localChannel = ["allonahub", "allona_shop"].includes(channelKey);
      const capabilities = effectiveSalesChannelCapabilities(channelKey, channelResult.data.capability_overrides || {});
      if (!capabilities.invoiceUpload && !capabilities.invoiceMetadata) throw httpError("Seçili mağaza fatura geri aktarımını desteklemiyor.", 422, "AUTO_UPLOAD_CHANNEL_UNSUPPORTED");
      if (!localChannel && !config.eInvoicing.channelCallsEnabled) throw httpError("Harici satış kanalı çağrıları kapalıyken otomatik aktarım etkinleştirilemez.", 503, "SALES_CHANNEL_CALLS_DISABLED");
    }
    const row = {
      organization_id: input.organizationId,
      legal_entity_id: input.legalEntityId,
      sales_channel_account_id: input.salesChannelAccountId || null,
      invoice_profile_id: input.invoiceProfileId,
      invoice_provider_account_id: input.invoiceProviderAccountId,
      trigger_event: input.triggerEvent,
      document_type_fallback: input.documentTypeFallback,
      auto_upload_to_channel: input.autoUploadToChannel,
      max_retry_count: input.maxRetryCount,
      is_active: true
    };
    let existingQuery = supabaseAdmin.from("invoice_settings").select("id").eq("legal_entity_id", input.legalEntityId);
    existingQuery = input.salesChannelAccountId
      ? existingQuery.eq("sales_channel_account_id", input.salesChannelAccountId)
      : existingQuery.is("sales_channel_account_id", null);
    const existing = await existingQuery.maybeSingle();
    const result = existing.data
      ? await supabaseAdmin.from("invoice_settings").update(row).eq("id", existing.data.id).select("*").single()
      : await supabaseAdmin.from("invoice_settings").insert(row).select("*").single();
    if (result.error) throw httpError("Fatura ayarı kaydedilemedi.", 503, "INVOICE_SETTINGS_SAVE_FAILED");
    await audit(request, ctx, "invoice_settings.saved", "invoice_settings", result.data.id, { trigger_event: input.triggerEvent, document_type_fallback: input.documentTypeFallback, auto_upload_to_channel: input.autoUploadToChannel }, "warning");
    return { ok: true, settings: result.data };
  });

  app.post("/v1/cron/e-invoicing/jobs", async (request) => {
    const secret = String(request.headers["x-cron-secret"] || "");
    if (!config.cronSecret || secret !== config.cronSecret) throw httpError("Cron doğrulanamadı.", 401, "CRON_AUTH_FAILED");
    const orderEvents = await processPendingOrderInvoiceEvents({ limit: config.eInvoicing.jobBatchSize, requestId: request.id });
    const jobs = await processInvoiceJobs({ workerId: `cron:${request.id}`, limit: config.eInvoicing.jobBatchSize });
    return { ok: true, ...jobs, orderEvents };
  });

  app.post("/v1/internal/e-invoicing/order-allocation-complete", async (request) => {
    const secret = String(request.headers["x-cron-secret"] || "");
    if (!config.cronSecret || secret !== config.cronSecret) throw httpError("Servis olayı doğrulanamadı.", 401, "INTERNAL_EVENT_AUTH_FAILED");
    if (!config.eInvoicing.enabled) throw httpError("e-Dönüşüm modülü kapalı.", 503, "E_INVOICING_DISABLED");
    const input = completeOrderAllocationSchema.parse(request.body || {});
    const result = await completeOrderInvoiceAllocation({ orderId: input.orderId, expectedSubOrderCount: input.expectedSubOrderCount, requestId: request.id });
    await auditEvent({
      request,
      actorRole: "system",
      action: "invoice.order_allocation_completed",
      resourceType: "order",
      resourceId: input.orderId,
      severity: "warning",
      source: "e_invoicing",
      purpose: "financial_operations",
      evidenceTags: ["e_invoicing", "seller_allocation"],
      metadata: { expected_sub_order_count: input.expectedSubOrderCount, pending_event_count: result.pendingEvents.processed }
    });
    return { ok: true, ...result };
  });

  app.post("/v1/internal/e-invoicing/order-events", async (request, reply) => {
    const secret = String(request.headers["x-cron-secret"] || "");
    if (!config.cronSecret || secret !== config.cronSecret) throw httpError("Servis olayı doğrulanamadı.", 401, "INTERNAL_EVENT_AUTH_FAILED");
    if (!config.eInvoicing.enabled) throw httpError("e-Dönüşüm modülü kapalı.", 503, "E_INVOICING_DISABLED");
    const input = orderInvoiceEventSchema.parse(request.body || {});
    const result = await processDurableOrderInvoiceEvent({
      orderId: input.orderId,
      event: input.event,
      eventKey: input.eventId || `${input.orderId}:${input.event}`,
      requestId: request.id,
      actor: { id: null, role: "system" }
    });
    await auditEvent({
      request,
      actorRole: "system",
      action: "invoice.order_event_consumed",
      resourceType: "order",
      resourceId: input.orderId,
      severity: result.needsReview ? "warning" : "info",
      source: "e_invoicing",
      purpose: "financial_operations",
      evidenceTags: ["e_invoicing", "order_event"],
      metadata: {
        event: input.event,
        sub_order_count: result.subOrderCount,
        planned: result.planned,
        duplicate: result.duplicate,
        skipped: result.skipped,
        needs_review: result.needsReview,
        result_codes: [...new Set(result.results.map((item) => item.errorCode).filter(Boolean))]
      }
    });
    const statusCode = result.processing ? 202 : result.needsReview > 0 || result.durableStatus === "PENDING" ? 409 : 200;
    return reply.code(statusCode).send({ ok: result.needsReview === 0, ...result });
  });

  app.post("/v1/e-invoicing/webhooks/:providerAccountId", async (request, reply) => {
    const providerAccountId = uuid.parse(request.params.providerAccountId);
    const { data: account, error: accountError } = await supabaseAdmin.from("invoice_provider_accounts").select("*").eq("id", providerAccountId).maybeSingle();
    if (accountError || !account) throw httpError("Webhook hesabı bulunamadı.", 404, "WEBHOOK_ACCOUNT_NOT_FOUND");
    if (account.provider_key === "mock" && !config.eInvoicing.mockProviderEnabled) throw httpError("Mock provider kapalı.", 503, "MOCK_PROVIDER_DISABLED");
    const provider = createInvoiceProvider(account.provider_key);
    const timestamp = String(request.headers["x-invoice-timestamp"] || "");
    const signature = String(request.headers["x-invoice-signature"] || "");
    const nonce = String(request.headers["x-invoice-nonce"] || "").slice(0, 200) || null;
    const rawBody = request.rawBody || Buffer.from(JSON.stringify(request.body || {}));
    const secretReference = account.settings?.webhook_secret_reference;
    if (!secretReference) throw httpError("Webhook için ayrı secret reference yapılandırılmadı.", 503, "WEBHOOK_SECRET_REFERENCE_MISSING");
    const secret = await resolveBoundCredential({
      db: supabaseAdmin,
      reference: secretReference,
      organizationId: account.organization_id,
      legalEntityId: account.legal_entity_id,
      integrationType: "invoice_provider",
      integrationKey: account.provider_key,
      purpose: "webhook"
    });
    const validation = provider.validateWebhook({ rawBody, signature, timestamp, secret, toleranceSeconds: config.eInvoicing.webhookToleranceSeconds });
    // The event id must come from the signed body. An unsigned header must not
    // be able to turn the same signed payload into a new replay identity.
    const suppliedEventId = String(request.body?.id || request.body?.event_id || "").slice(0, 240);
    const invalidId = `invalid:${createHash("sha256").update(rawBody).update(signature).digest("hex")}`;
    const providerEventId = validation.valid && suppliedEventId ? suppliedEventId : invalidId;
    const eventTime = Number(timestamp);
    const received = await supabaseAdmin.from("invoice_webhook_events").insert({
      organization_id: account.organization_id,
      provider_account_id: account.id,
      provider_event_id: providerEventId,
      event_type: String(request.body?.type || "unknown").slice(0, 120),
      event_timestamp: Number.isFinite(eventTime) ? new Date(eventTime * 1000).toISOString() : new Date().toISOString(),
      nonce,
      signature_valid: validation.valid,
      replay_detected: false,
      processing_status: validation.valid ? "VERIFIED" : "REJECTED",
      sanitized_payload: sanitizeWebhook(request.body || {}),
      request_id: request.id,
      error_code: validation.code
    }).select("*").single();
    let storedEvent = received.data || null;
    let resumed = false;
    if (received.error?.code === "23505") {
      const existing = await supabaseAdmin.from("invoice_webhook_events")
        .select("*")
        .eq("provider_account_id", account.id)
        .eq("provider_event_id", providerEventId)
        .maybeSingle();
      if (existing.error) throw httpError("Webhook tekrar kaydı doğrulanamadı.", 503, "WEBHOOK_DUPLICATE_LOOKUP_FAILED");
      let existingEvent = existing.data;
      if (existingEvent?.processing_status === "PROCESSING" && validation.valid) {
        const staleBefore = new Date(Date.now() - Math.max(config.eInvoicing.webhookToleranceSeconds, 300) * 1000).toISOString();
        const recovered = await supabaseAdmin.from("invoice_webhook_events")
          .update({ processing_status: "VERIFIED", processing_started_at: null, error_code: "WEBHOOK_PROCESSING_LEASE_EXPIRED" })
          .eq("id", existingEvent.id)
          .eq("processing_status", "PROCESSING")
          .lt("processing_started_at", staleBefore)
          .select("*")
          .maybeSingle();
        if (recovered.error) throw httpError("Webhook işleme lease'i doğrulanamadı.", 503, "WEBHOOK_RECOVERY_FAILED");
        if (!recovered.data) return reply.code(202).send({ ok: true, duplicate: true, processing: true, replayProtected: true });
        existingEvent = recovered.data;
      }
      if (!existingEvent || existingEvent.processing_status !== "VERIFIED" || !validation.valid) {
        return reply.code(200).send({ ok: true, duplicate: true, replayProtected: true, status: existing.data?.processing_status || "DUPLICATE_NONCE" });
      }
      storedEvent = existingEvent;
      resumed = true;
    }
    if (received.error && received.error.code !== "23505") throw httpError("Webhook audit kaydı oluşturulamadı.", 503, "WEBHOOK_EVENT_STORE_FAILED");
    if (!validation.valid) return reply.code(401).send({ ok: false, error: validation.code });
    const claim = await supabaseAdmin.from("invoice_webhook_events")
      .update({ processing_status: "PROCESSING", processing_started_at: new Date().toISOString(), error_code: null })
      .eq("id", storedEvent.id)
      .eq("processing_status", "VERIFIED")
      .select("*")
      .maybeSingle();
    if (claim.error) throw httpError("Webhook işleme kilidi alınamadı.", 503, "WEBHOOK_CLAIM_FAILED");
    if (!claim.data) return reply.code(202).send({ ok: true, duplicate: true, processing: true, replayProtected: true });
    storedEvent = claim.data;
    let event;
    try {
      event = provider.processWebhook({ payload: request.body || {} });
    } catch (processingError) {
      await supabaseAdmin.from("invoice_webhook_events").update({ processing_status: "VERIFIED", processing_started_at: null, error_code: "WEBHOOK_PROCESSING_RETRY", processed_at: null }).eq("id", storedEvent.id).eq("processing_status", "PROCESSING");
      throw processingError;
    }
    if (!event.providerEventId || event.providerEventId !== suppliedEventId || !event.providerDocumentId) {
      const invalid = await supabaseAdmin.from("invoice_webhook_events").update({ processing_status: "FAILED", error_code: "WEBHOOK_PAYLOAD_INVALID", processed_at: new Date().toISOString() }).eq("id", storedEvent.id).eq("processing_status", "PROCESSING");
      if (invalid.error) throw httpError("Geçersiz webhook sonucu kaydedilemedi.", 503, "WEBHOOK_FAILURE_STORE_FAILED");
      throw httpError("Webhook payload doğrulanamadı.", 422, "WEBHOOK_PAYLOAD_INVALID");
    }
    let invoice = null;
    try {
      const lookup = await supabaseAdmin.from("invoices").select("*").eq("provider_account_id", account.id).eq("provider_document_id", event.providerDocumentId).maybeSingle();
      if (lookup.error) throw lookup.error;
      invoice = lookup.data;
      if (!invoice) {
        const pending = await supabaseAdmin.from("invoice_webhook_events").update({ processing_status: "VERIFIED", processing_started_at: null, error_code: "WEBHOOK_INVOICE_MATCH_PENDING", processed_at: null }).eq("id", storedEvent.id).eq("processing_status", "PROCESSING");
        if (pending.error) throw pending.error;
        return reply.code(202).send({ ok: true, processed: false, pendingMatch: true, resumed });
      }
      const verifiedCancellationConfirmation = event.status === "CANCELLED" && ["CANCEL_PENDING", "FAILED", "NEEDS_REVIEW", "RETURNED"].includes(invoice.status);
      if (isStaleProviderStatus(invoice.status, event.status)) {
        event.status = invoice.status;
      } else if (!INVOICE_STATUSES.includes(event.status) || (!verifiedCancellationConfirmation && !canTransitionInvoice(invoice.status, event.status))) {
        if (canTransitionInvoice(invoice.status, "NEEDS_REVIEW")) {
          await transitionInvoice(invoice, "NEEDS_REVIEW", { error_code: "PROVIDER_STATUS_TRANSITION_INVALID" }, { action: "invoice.provider_webhook_needs_review", requestId: request.id, metadata: { provider_status: event.status } });
        }
        const failed = await supabaseAdmin.from("invoice_webhook_events").update({ invoice_id: invoice.id, processing_status: "FAILED", error_code: "PROVIDER_STATUS_TRANSITION_INVALID", processed_at: new Date().toISOString() }).eq("id", storedEvent.id).eq("processing_status", "PROCESSING");
        if (failed.error) throw failed.error;
        throw httpError("Provider durumu fatura yaşam döngüsüyle uyuşmuyor.", 409, "PROVIDER_STATUS_TRANSITION_INVALID");
      }
      if (invoice.status !== event.status) {
        if (event.status === "CANCELLED") {
          await completeInvoiceCancellation(invoice, {
            providerReference: event.providerDocumentId,
            action: "invoice.provider_webhook_cancelled",
            requestId: request.id,
            metadata: { event_type: event.eventType, provider_event_id: event.providerEventId }
          });
        } else {
          await transitionInvoice(invoice, event.status, {}, { action: "invoice.provider_webhook", requestId: request.id, metadata: { event_type: event.eventType, provider_event_id: event.providerEventId } });
        }
      }
    } catch (processingError) {
      if (processingError?.code !== "PROVIDER_STATUS_TRANSITION_INVALID") {
        await supabaseAdmin.from("invoice_webhook_events").update({ processing_status: "VERIFIED", processing_started_at: null, error_code: "WEBHOOK_PROCESSING_RETRY", processed_at: null }).eq("id", storedEvent.id).eq("processing_status", "PROCESSING");
      }
      throw processingError;
    }
    const completed = await supabaseAdmin.from("invoice_webhook_events").update({ invoice_id: invoice.id, processing_status: "PROCESSED", processed_at: new Date().toISOString() }).eq("id", storedEvent.id).eq("processing_status", "PROCESSING");
    if (completed.error) throw httpError("Webhook tamamlanma kaydı yazılamadı.", 503, "WEBHOOK_COMPLETE_FAILED");
    return { ok: true, processed: true, resumed, invoiceId: invoice?.id || null };
  });
}
