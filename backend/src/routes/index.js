import { createHash } from "node:crypto";
import { z } from "zod";
import { config } from "../config.js";
import { autoDefenseStatus } from "../lib/auto-defense.js";
import {
  auditEvent,
  authContext,
  hasMfa,
  hasRole,
  isAdmin,
  isSuperAdmin,
  isPartner,
  mfaRequiredForRole,
  supabaseAdmin
} from "../lib/supabase.js";
import { cvCheckoutPayload, iyzicoPost, orderCheckoutPayload, partnerPaymentIntentCheckoutPayload } from "../lib/iyzico.js";

const uuidSchema = z.string().uuid();
const emailSchema = z.string().email().max(180);
const phoneSchema = z.string().trim().max(40).optional().default("");
const orderItemSchema = z.object({
  product_id: uuidSchema,
  quantity: z.coerce.number().int().min(1).max(99)
});

const createOrderSchema = z.object({
  customer_name: z.string().trim().min(2).max(160),
  customer_email: emailSchema,
  customer_phone: phoneSchema,
  city: z.string().trim().min(2).max(90),
  address: z.string().trim().min(10).max(1200),
  items: z.array(orderItemSchema).min(1).max(30),
  coupon_code: z.string().trim().max(40).optional().nullable()
});

const orderCheckoutSchema = z.object({
  orderId: uuidSchema
});

const publicPartnerIntentCheckoutSchema = z.object({
  intentId: uuidSchema,
  customer_name: z.string().trim().min(2).max(160),
  customer_email: emailSchema,
  customer_phone: phoneSchema
});

const cvCheckoutSchema = z.object({
  buyerEmail: emailSchema.optional(),
  buyerPhone: phoneSchema
});

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  severity: z.enum(["debug", "info", "warning", "critical"]).optional(),
  actorId: uuidSchema.optional(),
  action: z.string().trim().max(140).optional(),
  resourceType: z.string().trim().max(120).optional(),
  resourceId: z.string().trim().max(180).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
});

const clientLocationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  accuracy_m: z.coerce.number().min(0).max(100000).optional(),
  city: z.string().trim().max(120).optional(),
  region: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional()
}).refine((value) => {
  const hasLatitude = value.latitude !== undefined;
  const hasLongitude = value.longitude !== undefined;
  return hasLatitude === hasLongitude || (!hasLatitude && !hasLongitude);
}, "Konum enlem ve boylam birlikte gönderilmelidir.");

const clientSecurityEventSchema = z.object({
  category: z.enum(["account", "profile", "order", "payment", "partner", "support", "legal_notice", "fraud_signal", "location_consent"]).default("fraud_signal"),
  action: z.string().trim().min(3).max(90).regex(/^[a-z0-9_.:-]+$/i),
  resource_type: z.string().trim().max(90).optional(),
  resource_id: z.string().trim().max(180).optional(),
  severity: z.enum(["debug", "info", "warning", "critical"]).optional().default("info"),
  page: z.string().trim().max(220).optional(),
  location_consent: z.boolean().optional().default(false),
  location: clientLocationSchema.optional(),
  evidence_tags: z.array(z.string().trim().max(60)).max(12).optional().default([]),
  metadata: z.record(z.unknown()).optional().default({})
});

const authorityRequestSchema = z.object({
  authority_type: z.enum(["police", "prosecutor", "court", "regulator", "other_public_authority"]),
  reference_no: z.string().trim().min(2).max(140),
  requester_name: z.string().trim().max(160).optional().default(""),
  requester_title: z.string().trim().max(160).optional().default(""),
  contact_channel: z.string().trim().max(240).optional().default(""),
  legal_basis: z.string().trim().min(8).max(1200),
  scope_summary: z.string().trim().min(8).max(1600),
  due_at: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional().default({})
});

const evidenceReportSchema = z.object({
  request_id: uuidSchema.optional(),
  case_reference: z.string().trim().min(2).max(140),
  legal_basis: z.string().trim().min(8).max(1200),
  purpose: z.string().trim().min(8).max(240).default("Yetkili makam talebi ve hukuki uyuşmazlık incelemesi"),
  actor_id: uuidSchema.optional(),
  resource_type: z.string().trim().max(120).optional(),
  resource_id: z.string().trim().max(180).optional(),
  action: z.string().trim().max(140).optional(),
  severity: z.enum(["debug", "info", "warning", "critical"]).optional(),
  request_id_filter: z.string().trim().max(120).optional(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(500)
});

const partnerPaymentIntentSchema = z.object({
  channel: z.enum(["qr", "nfc", "payment_link", "web_pos", "physical_pos", "cash", "wallet"]).default("qr"),
  provider: z.enum([
    "allonapay",
    "iyzico_checkout",
    "iyzico_link",
    "iyzico_cep_pos",
    "visa_tap_to_phone",
    "mastercard_tap_on_phone",
    "bank_pos",
    "manual"
  ]).optional(),
  amount: z.coerce.number().min(1).max(250000),
  currency: z.string().trim().length(3).optional().default("TRY"),
  description: z.string().trim().max(240).optional().default(""),
  customer_name: z.string().trim().max(160).optional().default(""),
  customer_phone: z.string().trim().max(40).optional().default(""),
  customer_email: emailSchema.optional().or(z.literal("")).default(""),
  location_id: uuidSchema.optional(),
  device_id: uuidSchema.optional(),
  order_id: uuidSchema.optional(),
  expires_in_minutes: z.coerce.number().int().min(3).max(1440).optional().default(20)
});

const partnerSupportTicketSchema = z.object({
  category: z.enum(["general", "product", "order", "payment", "qr_nfc", "cargo", "payout", "technical"]).default("general"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  title: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(2000)
});

const partnerProfileUpdateSchema = z.object({
  display_name: z.string().trim().min(2).max(160).optional(),
  legal_name: z.string().trim().max(180).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  city: z.string().trim().max(90).optional().nullable(),
  country: z.string().trim().max(90).optional().nullable(),
  description: z.string().trim().max(1200).optional().nullable(),
  logo_url: z.string().trim().max(700).optional().nullable(),
  preferred_cargo_company: z.string().trim().max(120).optional().nullable(),
  payout_schedule: z.enum(["daily", "weekly", "biweekly", "monthly"]).optional()
});

const partnerOrderStatusSchema = z.object({
  orderId: uuidSchema,
  order_status: z.enum(["confirmed", "preparing", "shipped", "delivered", "cancelled"]).optional(),
  tracking_number: z.string().trim().max(120).optional().nullable()
});

const adminListQuerySchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  status: z.string().trim().max(80).optional().default(""),
  limit: z.coerce.number().int().min(1).max(200).optional().default(80)
});

const adminNoteSchema = z.object({
  body: z.string().trim().min(3).max(1600),
  note_type: z.enum(["general", "risk", "review", "support", "callback"]).optional().default("general")
});

const adminFlagSchema = z.object({
  reason: z.string().trim().min(3).max(1200),
  severity: z.enum(["info", "warning", "critical"]).optional().default("warning")
});

const partnerApplicationActionSchema = z.object({
  action: z.enum(["start_review", "recommend_approve", "recommend_reject", "send_super_admin"]),
  reason: z.string().trim().min(3).max(1200),
  risk_level: z.enum(["info", "warning", "critical"]).optional().default("info")
});

const supportStatusSchema = z.object({
  source: z.enum(["user", "partner"]),
  status: z.enum(["open", "in_progress", "resolved"]),
  note: z.string().trim().max(1200).optional().default("")
});

const contentProposalSchema = z.object({
  content_scope: z.enum(["home_module", "banner", "campaign", "page", "legal"]),
  title: z.string().trim().min(3).max(180),
  summary: z.string().trim().min(3).max(1600),
  payload: z.record(z.unknown()).optional().default({})
});

const adminAuditLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
  severity: z.enum(["debug", "info", "warning", "critical"]).optional()
});

const riskLevelSchema = z.enum(["low", "medium", "high", "critical"]);

const superAdminUserUpdateSchema = z.object({
  account_status: z.enum(["active", "passive", "suspended"]).optional(),
  flagged_suspicious: z.boolean().optional(),
  risk_level: riskLevelSchema.optional(),
  note: z.string().trim().max(800).optional().default("")
}).refine((value) => (
  value.account_status !== undefined ||
  value.flagged_suspicious !== undefined ||
  value.risk_level !== undefined ||
  Boolean(value.note)
), "En az bir kullanıcı alanı güncellenmelidir.");

const partnerApplicationDecisionSchema = z.object({
  decision: z.enum(["review", "approved", "rejected"]),
  reason: z.string().trim().max(800).optional().default(""),
  commission_rate: z.coerce.number().min(0).max(0.9).optional(),
  store_status: z.enum(["review", "active", "paused", "suspended"]).optional()
});

const superAdminSettingUpdateSchema = z.object({
  value: z.unknown(),
  reason: z.string().trim().max(900).optional().default("")
});

const superAdminModuleUpdateSchema = z.object({
  is_active: z.boolean().optional(),
  is_visible: z.boolean().optional(),
  commission_rate: z.coerce.number().min(0).max(0.9).optional(),
  application_status: z.enum(["open", "review_only", "closed"]).optional(),
  content_config: z.record(z.unknown()).optional()
}).refine((value) => Object.keys(value).length > 0, "En az bir modül alanı güncellenmelidir.");

const DEFAULT_SUPER_ADMIN_SETTINGS = [
  { key: "maintenance_mode", label: "Bakım modu", value: false, value_type: "boolean", risk_level: "critical", category: "system" },
  { key: "orders_paused", label: "Siparişleri geçici durdur", value: false, value_type: "boolean", risk_level: "high", category: "commerce" },
  { key: "payments_paused", label: "Ödemeleri geçici durdur", value: false, value_type: "boolean", risk_level: "critical", category: "finance" },
  { key: "partner_applications_paused", label: "Yeni partner başvurularını durdur", value: false, value_type: "boolean", risk_level: "high", category: "partner" },
  { key: "default_commission_rate", label: "Varsayılan komisyon oranı", value: 0.12, value_type: "number", risk_level: "medium", category: "finance" },
  { key: "minimum_payout_amount", label: "Minimum ödeme tutarı", value: 500, value_type: "number", risk_level: "medium", category: "finance" }
];

const DEFAULT_PLATFORM_MODULES = [
  { module_key: "shop", name: "Shop", category: "commerce" },
  { module_key: "food", name: "Yemek", category: "commerce" },
  { module_key: "market", name: "Market", category: "commerce" },
  { module_key: "taxi", name: "Taksi", category: "transport" },
  { module_key: "health", name: "Sağlık", category: "services" },
  { module_key: "maritime", name: "Denizcilik", category: "services" },
  { module_key: "legal", name: "Hukuk", category: "services" },
  { module_key: "consulting", name: "Danışmanlık", category: "services" },
  { module_key: "real_estate", name: "Gayrimenkul", category: "marketplace" },
  { module_key: "automotive", name: "Otomotiv", category: "marketplace" },
  { module_key: "education", name: "Eğitim", category: "services" },
  { module_key: "other_services", name: "Diğer hizmetler", category: "services" }
];

function clientIp(request) {
  return String(request.headers["cf-connecting-ip"] || request.ip || "0.0.0.0").split(",")[0].trim();
}

function requestHostname(request) {
  return String(request.headers.host || "").split(":")[0].trim().toLowerCase();
}

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sha256Json(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function assertEvidenceWindow(from, to) {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) {
    throw httpError("Delil raporu tarih aralığı geçersiz.", 400);
  }
  const maxWindowMs = 366 * 24 * 60 * 60 * 1000;
  if (toMs - fromMs > maxWindowMs) {
    throw httpError("Delil raporu aralığı en fazla 366 gün olabilir.", 400);
  }
}

function evidenceFilters(payload) {
  return {
    actor_id: payload.actor_id || null,
    resource_type: payload.resource_type || null,
    resource_id: payload.resource_id || null,
    action: payload.action || null,
    severity: payload.severity || null,
    request_id: payload.request_id_filter || null,
    from: payload.from,
    to: payload.to,
    limit: payload.limit
  };
}

async function queryEvidenceEvents(payload) {
  let dbQuery = supabaseAdmin
    .from("security_audit_events")
    .select([
      "id",
      "actor_id",
      "actor_role",
      "action",
      "resource_type",
      "resource_id",
      "severity",
      "ip_address",
      "user_agent",
      "request_id",
      "source",
      "purpose",
      "location_basis",
      "geo_country",
      "geo_region",
      "geo_city",
      "geo_latitude",
      "geo_longitude",
      "geo_accuracy_m",
      "previous_hash",
      "event_hash",
      "evidence_tags",
      "metadata",
      "created_at"
    ].join(", "))
    .gte("created_at", payload.from)
    .lte("created_at", payload.to)
    .order("created_at", { ascending: true })
    .limit(payload.limit);

  if (payload.actor_id) dbQuery = dbQuery.eq("actor_id", payload.actor_id);
  if (payload.resource_type) dbQuery = dbQuery.eq("resource_type", payload.resource_type);
  if (payload.resource_id) dbQuery = dbQuery.eq("resource_id", payload.resource_id);
  if (payload.action) dbQuery = dbQuery.eq("action", payload.action);
  if (payload.severity) dbQuery = dbQuery.eq("severity", payload.severity);
  if (payload.request_id_filter) dbQuery = dbQuery.eq("request_id", payload.request_id_filter);

  const { data, error } = await dbQuery;
  if (error) throw error;
  return data || [];
}

function assertPaymentsEnabled() {
  if (config.paymentsDisabled) {
    throw httpError("Ödeme sistemi geçici olarak koruma modunda.", 503);
  }
}

function redirect(reply, target) {
  return reply.code(303).header("Location", target).send();
}

function assertAdminBoundary(request) {
  const hostname = requestHostname(request);
  if (config.adminHosts.length && hostname && !config.adminHosts.includes(hostname)) {
    throw httpError("Admin ağı doğrulanamadı.", 403);
  }

  const ip = clientIp(request);
  if (config.adminIpAllowlist.length && !config.adminIpAllowlist.includes(ip)) {
    throw httpError("Admin IP doğrulaması başarısız.", 403);
  }
}

async function requireAuth(request, options = {}) {
  const ctx = await authContext(request);
  const action = options.action || "auth.required";

  if (!ctx?.user) {
    await auditEvent({
      request,
      action: "auth.denied",
      severity: "warning",
      metadata: { action, path: request.url.split("?")[0] }
    });
    throw httpError("Oturum doğrulanamadı.", 401);
  }

  if (options.roles?.length && !hasRole(ctx.profile, options.roles)) {
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "authz.denied",
      severity: "warning",
      metadata: { action, required_roles: options.roles }
    });
    throw httpError("Bu işlem için yetkiniz yok.", 403);
  }

  if (options.mfa && mfaRequiredForRole(ctx.profile.role) && !hasMfa(ctx)) {
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "mfa.required",
      severity: "warning",
      metadata: { action, aal: ctx.authenticatorAssuranceLevel }
    });
    throw httpError("Bu işlem için iki aşamalı doğrulama gerekli.", 403);
  }

  if (options.adminBoundary) {
    try {
      assertAdminBoundary(request);
    } catch (error) {
      await auditEvent({
        request,
        actorId: ctx.user.id,
        actorRole: ctx.profile.role,
        action: "admin.boundary_denied",
        severity: "critical",
        metadata: { hostname: requestHostname(request), ip: clientIp(request) }
      });
      throw error;
    }
  }

  return ctx;
}

async function requireSuperAdmin(request, action) {
  const ctx = await requireAuth(request, {
    roles: ["super_admin"],
    mfa: true,
    adminBoundary: true,
    action
  });

  if (!isSuperAdmin(ctx.profile)) {
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.role_denied",
      severity: "critical",
      metadata: { requested_action: action }
    });
    throw httpError("Bu işlem için Super Admin yetkisi gerekli.", 403);
  }

  return ctx;
}

function looksLikeMissingSchema(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""} ${error?.code || ""}`;
  return /does not exist|schema cache|PGRST20|PGRST30|42P01|42703|relation .* not found|column .* not found/i.test(message);
}

function schemaWarning(label, error) {
  return {
    label,
    code: error?.code || "SCHEMA_WARNING",
    message: error?.message || "Supabase şeması bu sorgu için hazır değil."
  };
}

async function runAdminQuery(label, query, fallback) {
  const { data, error, count } = await query;
  if (error) {
    if (looksLikeMissingSchema(error)) {
      return { data: fallback, count: 0, warning: schemaWarning(label, error) };
    }
    throw error;
  }
  return { data: data ?? fallback, count: count ?? (Array.isArray(data) ? data.length : 0), warning: null };
}

async function countAdminRows(label, table, configure) {
  let query = supabaseAdmin.from(table).select("id", { count: "exact", head: true });
  if (configure) query = configure(query);
  const result = await runAdminQuery(label, query, null);
  return { count: result.count || 0, warning: result.warning };
}

async function requireOpsAdmin(request, action) {
  const ctx = await requireAuth(request, {
    roles: ["admin"],
    mfa: true,
    adminBoundary: true,
    action
  });

  const { data, error } = await ctx.db.rpc("is_ops_admin");
  if (error || data !== true) {
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "admin.ops.boundary_denied",
      resourceType: "admin_ops",
      severity: "critical",
      source: "admin",
      purpose: "admin_operations",
      metadata: {
        requested_action: action,
        db_role_check_error: error?.message || null
      }
    });
    throw httpError("Admin Panel yetki sınırı doğrulanamadı.", 403);
  }

  return ctx;
}

async function auditedOpsEvent({ request, ctx, action, resourceType = null, resourceId = null, severity = "info", metadata = {} }) {
  await auditEvent({
    request,
    actorId: ctx.user.id,
    actorRole: ctx.profile.role,
    action,
    resourceType,
    resourceId,
    severity,
    source: "admin",
    purpose: "admin_operations",
    evidenceTags: ["admin_ops", resourceType || "operation"],
    metadata
  });
}

function startOfTodayIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

function cleanSearch(value) {
  return String(value || "")
    .replace(/[,%]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function textSearchFilter(columns, value) {
  const term = cleanSearch(value);
  if (!term) return "";
  return columns.map((column) => `${column}.ilike.%${term}%`).join(",");
}

function normalizePartnerSupportStatus(status) {
  if (status === "waiting") return "in_progress";
  if (status === "closed") return "resolved";
  return ["open", "in_progress", "resolved"].includes(status) ? status : "open";
}

function toPartnerSupportStatus(status) {
  if (status === "in_progress") return "waiting";
  return status;
}

async function optionalQuery(query, fallback, warnings, label) {
  const { data, error, count } = await query;
  if (!error) {
    if (count !== null && count !== undefined) return { data: data || fallback, count };
    return data || fallback;
  }
  if (!looksLikeMissingSchema(error)) throw error;
  warnings.push(`${label}: Supabase migration veya policy production veritabaninda eksik gorunuyor.`);
  if (count !== null && count !== undefined) return { data: fallback, count: 0 };
  return fallback;
}

async function optionalMutation(query, warnings, label) {
  const { data, error } = await query;
  if (!error) return data;
  if (!looksLikeMissingSchema(error)) throw error;
  warnings.push(`${label}: Supabase migration veya policy production veritabaninda eksik gorunuyor.`);
  throw httpError(`${label} icin gerekli Supabase tablo/policy eksik. Migration uygulanmali.`, 409);
}

async function loadAdminDashboardData(warnings) {
  const today = startOfTodayIso();
  const [
    usersToday,
    applicationsToday,
    pendingApplications,
    recentOrders,
    userTickets,
    partnerTickets,
    notifications,
    securityEvents,
    flags
  ] = await Promise.all([
    optionalQuery(
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", today),
      [],
      warnings,
      "profiles"
    ),
    optionalQuery(
      supabaseAdmin.from("partner_applications").select("id", { count: "exact", head: true }).gte("created_at", today),
      [],
      warnings,
      "partner_applications"
    ),
    optionalQuery(
      supabaseAdmin.from("partner_applications").select("id", { count: "exact", head: true }).in("status", ["pending", "review"]),
      [],
      warnings,
      "partner_applications"
    ),
    optionalQuery(
      supabaseAdmin
        .from("orders")
        .select("id, order_no, customer_name, customer_email, total, order_status, payment_status, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
      [],
      warnings,
      "orders"
    ),
    optionalQuery(
      supabaseAdmin.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
      [],
      warnings,
      "support_tickets"
    ),
    optionalQuery(
      supabaseAdmin.from("partner_support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "waiting"]),
      [],
      warnings,
      "partner_support_tickets"
    ),
    optionalQuery(
      supabaseAdmin
        .from("admin_notifications")
        .select("id, kind, severity, title, message, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
      [],
      warnings,
      "admin_notifications"
    ),
    optionalQuery(
      supabaseAdmin
        .from("security_audit_events")
        .select("id, action, severity, resource_type, resource_id, created_at")
        .in("severity", ["warning", "critical"])
        .order("created_at", { ascending: false })
        .limit(8),
      [],
      warnings,
      "security_audit_events"
    ),
    optionalQuery(
      supabaseAdmin
        .from("admin_operation_flags")
        .select("id, target_type, target_id, flag_type, severity, reason, status, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(8),
      [],
      warnings,
      "admin_operation_flags"
    )
  ]);

  return {
    metrics: {
      daily_users: Number(usersToday.count || 0),
      daily_partner_applications: Number(applicationsToday.count || 0),
      pending_applications: Number(pendingApplications.count || 0),
      recent_orders: recentOrders.length,
      open_support_tickets: Number(userTickets.count || 0) + Number(partnerTickets.count || 0),
      system_alerts: notifications.length + securityEvents.length + flags.length
    },
    recentOrders,
    alerts: [
      ...flags.map((item) => ({
        id: item.id,
        type: "flag",
        severity: item.severity,
        title: item.flag_type,
        message: item.reason,
        created_at: item.created_at
      })),
      ...securityEvents.map((item) => ({
        id: item.id,
        type: "security",
        severity: item.severity,
        title: item.action,
        message: `${item.resource_type || "system"} ${item.resource_id || ""}`.trim(),
        created_at: item.created_at
      })),
      ...notifications.map((item) => ({
        id: item.id,
        type: item.kind,
        severity: item.severity,
        title: item.title,
        message: item.message,
        created_at: item.created_at
      }))
    ].slice(0, 12)
  };
}

function publicProfile(profile) {
  return {
    id: profile.id,
    full_name: profile.full_name || "",
    email: profile.email || "",
    phone: profile.phone || "",
    role: profile.role || "customer",
    account_status: profile.account_status || "active",
    flagged_suspicious: Boolean(profile.flagged_suspicious),
    risk_level: profile.risk_level || "low",
    suspended_until: profile.suspended_until || null,
    last_admin_note: profile.last_admin_note || "",
    created_at: profile.created_at || null,
    updated_at: profile.updated_at || null
  };
}

function criticalSettingNeedsReason(settingKey, value, reason) {
  const criticalKeys = new Set(["maintenance_mode", "orders_paused", "payments_paused", "partner_applications_paused"]);
  if (!criticalKeys.has(settingKey)) return false;
  if (value !== true) return false;
  return String(reason || "").trim().length < 6;
}

function normalizeJsonValue(value) {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

async function getOrderForPayment(orderId, ctx) {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order) {
    const notFound = new Error("Sipariş bulunamadı.");
    notFound.statusCode = 404;
    throw notFound;
  }
  if (order.user_id !== ctx.user.id && !isAdmin(ctx.profile)) {
    const forbidden = new Error("Bu sipariş için yetkiniz yok.");
    forbidden.statusCode = 403;
    throw forbidden;
  }
  return order;
}

async function initializeIyzicoCheckout({ order, ctx, request }) {
  const uriPath = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
  const callbackUrl = `${config.apiUrl}/v1/payments/iyzico/callback?orderId=${encodeURIComponent(order.id)}`;
  const payload = orderCheckoutPayload({
    order,
    userId: ctx.user.id,
    callbackUrl,
    ip: clientIp(request)
  });

  const { ok, result } = await iyzicoPost(uriPath, payload);
  if (!ok || result.status !== "success") {
    await supabaseAdmin.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
    request.log.warn({ orderId: order.id, iyzicoStatus: result.status }, "iyzico checkout failed");
    const error = new Error("Ödeme oturumu başlatılamadı.");
    error.statusCode = 400;
    throw error;
  }

  await supabaseAdmin
    .from("orders")
    .update({ payment_status: "awaiting_payment" })
    .eq("id", order.id);

  return {
    paymentPageUrl: result.paymentPageUrl,
    token: result.token
  };
}

async function queryIyzicoCheckoutDetail(token, conversationId) {
  const uriPath = "/payment/iyzipos/checkoutform/auth/ecom/detail";
  return iyzicoPost(uriPath, {
    locale: "tr",
    conversationId,
    token
  });
}

async function bodyOrQuery(request) {
  if (request.method === "GET") return request.query || {};
  return {
    ...(request.query || {}),
    ...(request.body || {})
  };
}

function publicPaymentBaseUrl(request) {
  const fromConfig = config.siteUrl || `${request.protocol || "https"}://${request.headers.host || "allonahub.com"}`;
  return String(fromConfig).replace(/\/$/, "");
}

function partnerProviderForChannel(channel, provider) {
  if (provider) return provider;
  if (channel === "nfc") return "iyzico_cep_pos";
  if (channel === "payment_link") return "iyzico_link";
  if (channel === "physical_pos") return "bank_pos";
  if (channel === "cash") return "manual";
  return "iyzico_checkout";
}

function partnerPaymentStatusLabel(status) {
  const labels = {
    created: "Oluşturuldu",
    awaiting_payment: "Ödeme bekliyor",
    provider_pending: "Sağlayıcı bekliyor",
    paid: "Ödendi",
    failed: "Başarısız",
    cancelled: "İptal",
    expired: "Süresi doldu",
    refunded: "İade"
  };
  return labels[status] || "Oluşturuldu";
}

async function ensurePartnerBusiness(ctx, request) {
  const { data: existing, error } = await supabaseAdmin
    .from("partner_businesses")
    .select("*")
    .eq("owner_id", ctx.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  const displayName = String(ctx.profile.full_name || ctx.user.user_metadata?.full_name || ctx.user.email || "Allona Partner").slice(0, 160);
  const { data: created, error: createError } = await supabaseAdmin
    .from("partner_businesses")
    .insert({
      owner_id: ctx.user.id,
      display_name: displayName,
      legal_name: displayName,
      email: ctx.user.email || null,
      phone: ctx.profile.phone || null,
      status: "active",
      verification_status: "pending",
      metadata: {
        created_from: "partner_os_auto_bootstrap"
      }
    })
    .select("*")
    .single();
  if (createError) throw createError;

  await auditEvent({
    request,
    actorId: ctx.user.id,
    actorRole: ctx.profile.role,
    action: "partner.business_auto_created",
    resourceType: "partner_business",
    resourceId: created.id,
    metadata: { display_name: displayName }
  });
  return created;
}

function summarizePartnerOrders(orders, ownerId, isAdminUser) {
  return (orders || [])
    .map((order) => {
      const partnerItems = (order.order_items || []).filter((item) => {
        const product = item.product || item.products || {};
        return isAdminUser || product.partner_id === ownerId;
      });
      if (!partnerItems.length) return null;
      const partnerTotal = partnerItems.reduce((sum, item) => sum + Number(item.price || item.unit_price || 0) * Number(item.quantity || 1), 0);
      return {
        ...order,
        partner_items: partnerItems,
        partner_total: Number(partnerTotal.toFixed(2))
      };
    })
    .filter(Boolean);
}

function partnerMetrics({ business, products, orders, paymentIntents, transactions, payouts, tickets }) {
  const paidIntents = paymentIntents.filter((intent) => intent.status === "paid");
  const openTickets = tickets.filter((ticket) => ["open", "waiting"].includes(ticket.status));
  const gross = transactions.reduce((sum, item) => sum + Number(item.gross_amount || 0), 0);
  const net = transactions.reduce((sum, item) => sum + Number(item.net_amount || 0), 0);
  const awaitingPayments = paymentIntents.filter((intent) => ["created", "awaiting_payment", "provider_pending"].includes(intent.status)).length;
  const paidToday = paidIntents
    .filter((intent) => new Date(intent.paid_at || intent.updated_at || intent.created_at).toDateString() === new Date().toDateString())
    .reduce((sum, intent) => sum + Number(intent.amount || 0), 0);
  const payoutPending = payouts
    .filter((payout) => ["scheduled", "review", "approved"].includes(payout.status))
    .reduce((sum, payout) => sum + Number(payout.net_amount || 0), 0);

  return {
    product_count: products.length,
    active_product_count: products.filter((product) => product.status === "active").length,
    low_stock_count: products.filter((product) => Number(product.stock || 0) <= 5).length,
    order_count: orders.length,
    open_order_count: orders.filter((order) => ["pending", "confirmed", "preparing"].includes(order.order_status || order.status)).length,
    awaiting_payment_count: awaitingPayments,
    paid_today: Number(paidToday.toFixed(2)),
    gross_volume: Number(gross.toFixed(2)),
    net_volume: Number(net.toFixed(2)),
    payout_pending: Number(payoutPending.toFixed(2)),
    open_ticket_count: openTickets.length,
    trust_score: Number(business.trust_score || 70),
    level: Number(business.level || 1)
  };
}

function partnerRecommendations(metrics, devices) {
  const tips = [];
  if (!devices.some((device) => device.status === "active" && device.device_type === "android_softpos")) {
    tips.push({
      title: "NFC SoftPOS cihazı bağla",
      body: "Taksi, kurye veya saha satışı yapan ekipler Android NFC cihazla kart kabul etmeye hazır hale gelir.",
      action: "NFC kurulumunu planla"
    });
  }
  if (metrics.low_stock_count > 0) {
    tips.push({
      title: "Stok riski var",
      body: `${metrics.low_stock_count} ürün kritik stok seviyesinde. Satış kaybetmeden stokları güncelle.`,
      action: "Stokları kontrol et"
    });
  }
  if (metrics.awaiting_payment_count > 0) {
    tips.push({
      title: "Ödeme bekleyen linkler",
      body: "Açık ödeme isteklerini müşteriye tekrar göndererek tahsilat hızını artırabilirsin.",
      action: "Ödemeleri aç"
    });
  }
  if (!tips.length) {
    tips.push({
      title: "Panel sağlıklı görünüyor",
      body: "Ürün, ödeme ve hakediş akışları düzenli. Yeni kampanya veya QR vitrin açmak için iyi zaman.",
      action: "Kampanya oluştur"
    });
  }
  return tips.slice(0, 4);
}

async function updateOrderPaymentFields(orderId, payload) {
  const { error } = await supabaseAdmin
    .from("orders")
    .update(payload)
    .eq("id", orderId);
  if (!error) return;

  if (!looksLikeMissingSchema(error)) throw error;
  const legacyPayload = { ...payload };
  delete legacyPayload.iyzico_token;
  delete legacyPayload.payment_provider_reference;
  delete legacyPayload.paid_at;
  const { error: legacyError } = await supabaseAdmin
    .from("orders")
    .update(legacyPayload)
    .eq("id", orderId);
  if (legacyError) throw legacyError;
}

export function registerRoutes(app) {
  app.get("/health", async () => ({
    ok: true,
    service: "allonahub-backend",
    time: new Date().toISOString()
  }));

  app.get("/ready", async (_request, reply) => {
    const { error } = await supabaseAdmin.from("profiles").select("id", { count: "exact", head: true });
    if (error) {
      return reply.code(503).send({ ok: false, message: "Supabase bağlantısı hazır değil." });
    }
    return { ok: true };
  });

  app.post("/v1/security/events", async (request, reply) => {
    const ctx = await requireAuth(request, { action: "security.client_event" });
    const payload = clientSecurityEventSchema.parse(request.body || {});
    const location = payload.location_consent ? payload.location || {} : {};
    const evidenceTags = [
      "client_event",
      payload.category,
      ...payload.evidence_tags
    ];

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: `client.${payload.category}.${payload.action}`.slice(0, 140),
      resourceType: payload.resource_type || "client_event",
      resourceId: payload.resource_id || null,
      severity: payload.severity,
      source: "client",
      purpose: "security_fraud_prevention",
      locationBasis: payload.location_consent ? "explicit_user_permission" : "none",
      location,
      evidenceTags,
      metadata: {
        page: payload.page || String(request.headers.referer || "").slice(0, 220),
        location_consent: payload.location_consent,
        client_metadata: payload.metadata
      }
    });

    return reply.code(202).send({ ok: true });
  });

  app.post("/v1/orders", async (request, reply) => {
    const ctx = await requireAuth(request, { action: "order.create" });
    const payload = createOrderSchema.parse(request.body || {});
    const { data, error } = await ctx.db.rpc("create_secure_order", {
      p_customer_name: payload.customer_name,
      p_customer_email: payload.customer_email,
      p_customer_phone: payload.customer_phone,
      p_city: payload.city,
      p_address: payload.address,
      p_items: payload.items,
      p_coupon_code: payload.coupon_code || null
    });
    if (error) throw error;
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "order.create",
      resourceType: "order",
      resourceId: data?.id || null,
      metadata: { item_count: payload.items.length, coupon: Boolean(payload.coupon_code) }
    });
    return reply.code(201).send({ ok: true, order: data });
  });

  app.post("/v1/payments/iyzico/checkout", async (request) => {
    assertPaymentsEnabled();
    const ctx = await requireAuth(request, { action: "payment.checkout", mfa: true });
    const payload = orderCheckoutSchema.parse(request.body || {});
    const order = await getOrderForPayment(payload.orderId, ctx);
    const checkout = await initializeIyzicoCheckout({ order, ctx, request });
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "payment.checkout_initialized",
      resourceType: "order",
      resourceId: order.id,
      metadata: { provider: "iyzico", amount: Number(order.total_amount ?? order.total ?? 0) }
    });
    return { ok: true, ...checkout };
  });

  app.post("/v1/public/partner-payment-intents/checkout", async (request) => {
    assertPaymentsEnabled();
    const payload = publicPartnerIntentCheckoutSchema.parse(request.body || {});
    const { data: intent, error: intentError } = await supabaseAdmin
      .from("partner_payment_intents")
      .select("*, partner:partner_businesses(*)")
      .eq("id", payload.intentId)
      .maybeSingle();
    if (intentError) throw intentError;
    if (!intent) throw httpError("Ödeme isteği bulunamadı.", 404);
    if (!["created", "awaiting_payment", "provider_pending"].includes(intent.status)) {
      throw httpError("Bu ödeme isteği artık tahsilata açık değil.", 409);
    }
    if (intent.expires_at && new Date(intent.expires_at).getTime() < Date.now()) {
      await supabaseAdmin
        .from("partner_payment_intents")
        .update({ status: "expired" })
        .eq("id", intent.id);
      throw httpError("Ödeme isteğinin süresi doldu.", 410);
    }
    if (intent.channel === "nfc") {
      throw httpError("NFC ödeme sertifikalı SoftPOS cihazında tamamlanmalıdır.", 409);
    }

    const uriPath = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
    const callbackUrl = `${config.apiUrl}/v1/payments/iyzico/callback?partnerPaymentIntentId=${encodeURIComponent(intent.id)}`;
    const checkoutPayload = partnerPaymentIntentCheckoutPayload({
      intent,
      business: intent.partner,
      buyer: payload,
      callbackUrl,
      ip: clientIp(request)
    });
    const { ok, result } = await iyzicoPost(uriPath, checkoutPayload);
    if (!ok || result.status !== "success") {
      await supabaseAdmin
        .from("partner_payment_intents")
        .update({ status: "failed", provider_status: result.status || "failed" })
        .eq("id", intent.id);
      await auditEvent({
        request,
        action: "partner.public_checkout_failed",
        resourceType: "partner_payment_intent",
        resourceId: intent.id,
        severity: "warning",
        metadata: { provider: "iyzico", provider_status: result.status || "unknown" }
      });
      throw httpError("Ödeme sayfası başlatılamadı.", 400);
    }

    const { error: updateError } = await supabaseAdmin
      .from("partner_payment_intents")
      .update({
        status: "awaiting_payment",
        provider: "iyzico_checkout",
        provider_reference: result.token || null,
        provider_status: result.status || "initialized",
        payment_url: result.paymentPageUrl || intent.payment_url,
        customer_name: payload.customer_name,
        customer_email: payload.customer_email,
        customer_phone: payload.customer_phone || intent.customer_phone || null
      })
      .eq("id", intent.id);
    if (updateError) throw updateError;

    await auditEvent({
      request,
      action: "partner.public_checkout_initialized",
      resourceType: "partner_payment_intent",
      resourceId: intent.id,
      metadata: { provider: "iyzico", amount: Number(intent.amount || 0), channel: intent.channel }
    });
    return { ok: true, paymentPageUrl: result.paymentPageUrl, token: result.token };
  });

  app.all("/v1/payments/iyzico/callback", async (request, reply) => {
    assertPaymentsEnabled();
    const payload = await bodyOrQuery(request);
    const token = String(payload.token || "").trim();
    const orderId = payload.orderId ? uuidSchema.parse(payload.orderId) : "";
    const cvPaymentId = payload.cvPaymentId ? uuidSchema.parse(payload.cvPaymentId) : "";
    const partnerPaymentIntentId = payload.partnerPaymentIntentId ? uuidSchema.parse(payload.partnerPaymentIntentId) : "";

    if (!token || token.length > 500 || (!orderId && !cvPaymentId && !partnerPaymentIntentId)) {
      await auditEvent({
        request,
        action: "payment.callback_invalid",
        severity: "critical",
        metadata: {
          provider: "iyzico",
          has_order_id: Boolean(orderId),
          has_cv_payment_id: Boolean(cvPaymentId),
          has_partner_payment_intent_id: Boolean(partnerPaymentIntentId)
        }
      });
      return reply.code(400).send({ ok: false, message: "Ödeme referansı doğrulanamadı." });
    }

    const { ok, result } = await queryIyzicoCheckoutDetail(token, partnerPaymentIntentId || cvPaymentId || orderId || token);
    const paymentStatus = ok && result.status === "success" && result.paymentStatus === "SUCCESS" ? "paid" : "failed";
    await auditEvent({
      request,
      action: "payment.callback_verified",
      resourceType: partnerPaymentIntentId ? "partner_payment_intent" : cvPaymentId ? "cv_payment" : "order",
      resourceId: partnerPaymentIntentId || cvPaymentId || orderId,
      severity: paymentStatus === "paid" ? "info" : "warning",
      metadata: {
        provider: "iyzico",
        provider_status: result.status || "unknown",
        payment_status: result.paymentStatus || "unknown"
      }
    });

    if (cvPaymentId) {
      const { data: payment, error: paymentError } = await supabaseAdmin
        .from("cv_payments")
        .select("*")
        .eq("id", cvPaymentId)
        .maybeSingle();
      if (paymentError) throw paymentError;
      if (!payment) return reply.code(404).send({ ok: false, message: "CV ödeme kaydı bulunamadı." });

      const { data: updatedPayment, error: updatePaymentError } = await supabaseAdmin
        .from("cv_payments")
        .update({ status: paymentStatus, iyzico_token: token })
        .eq("id", cvPaymentId)
        .neq("status", "paid")
        .select("id")
        .maybeSingle();
      if (updatePaymentError) throw updatePaymentError;

      if (paymentStatus === "paid" && updatedPayment) {
        const { data: access, error: accessError } = await supabaseAdmin
          .from("cv_access_accounts")
          .select("user_id, paid_credits")
          .eq("user_id", payment.user_id)
          .maybeSingle();
        if (accessError) throw accessError;

        if (access) {
          const { error: creditError } = await supabaseAdmin
            .from("cv_access_accounts")
            .update({ paid_credits: Number(access.paid_credits || 0) + 1 })
            .eq("user_id", payment.user_id);
          if (creditError) throw creditError;
        } else {
          const { error: insertAccessError } = await supabaseAdmin
            .from("cv_access_accounts")
            .insert({ user_id: payment.user_id, free_limit: 0, free_used: 0, paid_credits: 1, risk_reason: "paid_before_cv_access" });
          if (insertAccessError) throw insertAccessError;
        }
      }

      return redirect(reply, `${config.siteUrl}/pages/career/career-cv-form.html?payment=${paymentStatus}`);
    }

    if (partnerPaymentIntentId) {
      const { data: intent, error: intentError } = await supabaseAdmin
        .from("partner_payment_intents")
        .select("*, partner:partner_businesses(*)")
        .eq("id", partnerPaymentIntentId)
        .maybeSingle();
      if (intentError) throw intentError;
      if (!intent) return reply.code(404).send({ ok: false, message: "Partner ödeme isteği bulunamadı." });

      const { data: updatedIntent, error: updateIntentError } = await supabaseAdmin
        .from("partner_payment_intents")
        .update({
          status: paymentStatus,
          provider_status: result.paymentStatus || result.status || paymentStatus,
          provider_reference: result.paymentId || token,
          paid_at: paymentStatus === "paid" ? new Date().toISOString() : null
        })
        .eq("id", partnerPaymentIntentId)
        .neq("status", "paid")
        .select("id")
        .maybeSingle();
      if (updateIntentError) throw updateIntentError;

      if (paymentStatus === "paid" && updatedIntent) {
        const commissionRate = Number(intent.partner?.default_commission_rate || 0.12);
        const gross = Number(intent.amount || 0);
        const commissionAmount = Number((gross * commissionRate).toFixed(2));
        const { error: transactionError } = await supabaseAdmin
          .from("partner_transactions")
          .insert({
            partner_id: intent.partner_id,
            payment_intent_id: intent.id,
            order_id: intent.order_id || null,
            transaction_type: "payment",
            channel: intent.channel || "qr",
            provider: "iyzico_checkout",
            gross_amount: gross,
            commission_rate: commissionRate,
            commission_amount: commissionAmount,
            net_amount: Number((gross - commissionAmount).toFixed(2)),
            currency: intent.currency || "TRY",
            status: "paid",
            provider_reference: result.paymentId || token,
            metadata: { callback: "iyzico", conversation_id: result.conversationId || intent.id }
          });
        if (transactionError && transactionError.code !== "23505") throw transactionError;
      }

      return redirect(reply, `${config.siteUrl}/pages/partner/pay.html?intent=${partnerPaymentIntentId}&payment=${paymentStatus}`);
    }

    const orderStatus = paymentStatus === "paid" ? "confirmed" : "pending";
    await updateOrderPaymentFields(orderId, {
      payment_status: paymentStatus,
      order_status: orderStatus,
      payment_provider_reference: result.paymentId || token,
      paid_at: paymentStatus === "paid" ? new Date().toISOString() : null
    });

    return redirect(reply, `${config.siteUrl}/pages/account/orders.html?payment=${paymentStatus}`);
  });

  app.post("/v1/cv/checkout", async (request) => {
    assertPaymentsEnabled();
    const ctx = await requireAuth(request, { action: "cv.checkout", mfa: true });
    const payload = cvCheckoutSchema.parse(request.body || {});

    const { count: recentCount, error: recentError } = await supabaseAdmin
      .from("cv_payments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.user.id)
      .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
    if (recentError) throw recentError;
    if (Number(recentCount || 0) >= 5) {
      const error = new Error("Çok sık ödeme denemesi yapıldı. Lütfen biraz bekleyin.");
      error.statusCode = 429;
      throw error;
    }

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("cv_payments")
      .insert({ user_id: ctx.user.id, amount: config.cvPriceTry, currency: "TRY", status: "pending" })
      .select("*")
      .single();
    if (paymentError) throw paymentError;

    const uriPath = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
    const callbackUrl = `${config.apiUrl}/v1/payments/iyzico/callback?cvPaymentId=${encodeURIComponent(payment.id)}`;
    const checkoutPayload = cvCheckoutPayload({
      payment,
      profile: { ...ctx.profile, phone: payload.buyerPhone || ctx.profile.phone },
      user: { ...ctx.user, email: payload.buyerEmail || ctx.user.email },
      callbackUrl,
      ip: clientIp(request)
    });
    const { ok, result } = await iyzicoPost(uriPath, checkoutPayload);
    if (!ok || result.status !== "success") {
      await supabaseAdmin.from("cv_payments").update({ status: "failed" }).eq("id", payment.id);
      await auditEvent({
        request,
        actorId: ctx.user.id,
        actorRole: ctx.profile.role,
        action: "cv.checkout_failed",
        resourceType: "cv_payment",
        resourceId: payment.id,
        severity: "warning",
        metadata: { provider: "iyzico", provider_status: result.status || "unknown" }
      });
      const error = new Error("CV ödeme oturumu başlatılamadı.");
      error.statusCode = 400;
      throw error;
    }

    await supabaseAdmin
      .from("cv_payments")
      .update({ status: "awaiting_payment", iyzico_token: result.token || null })
      .eq("id", payment.id);

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "cv.checkout_initialized",
      resourceType: "cv_payment",
      resourceId: payment.id,
      metadata: { provider: "iyzico", amount: Number(payment.amount || config.cvPriceTry) }
    });
    return { ok: true, paymentPageUrl: result.paymentPageUrl, token: result.token, cvPaymentId: payment.id };
  });

  app.get("/v1/partner/commission/preview", async (request) => {
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      mfa: true,
      action: "partner.commission.preview"
    });
    if (!isPartner(ctx.profile)) {
      const error = new Error("Partner yetkisi gerekli.");
      error.statusCode = 403;
      throw error;
    }

    const rawOrderId = request.query?.orderId ? String(request.query.orderId) : undefined;
    const orderId = uuidSchema.optional().parse(rawOrderId);
    let query = supabaseAdmin
      .from("order_items")
      .select("id, order_id, quantity, price, product:products(id, name, partner_id)");
    if (orderId) query = query.eq("order_id", orderId);

    const { data, error } = await query.limit(200);
    if (error) throw error;

    const rows = (data || []).filter((item) => isAdmin(ctx.profile) || item.product?.partner_id === ctx.user.id);
    const gross = rows.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
    const commissionRate = 0.12;

    return {
      ok: true,
      gross,
      commissionRate,
      commissionAmount: Number((gross * commissionRate).toFixed(2)),
      partnerNet: Number((gross * (1 - commissionRate)).toFixed(2)),
      itemCount: rows.length
    };
  });

  app.get("/v1/partner/os", async (request) => {
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      action: "partner.os.overview"
    });
    const business = await ensurePartnerBusiness(ctx, request);
    const ownerId = business.owner_id || ctx.user.id;
    const isAdminUser = isAdmin(ctx.profile);

    const [
      productsResult,
      ordersResult,
      locationsResult,
      devicesResult,
      qrCodesResult,
      intentsResult,
      transactionsResult,
      payoutsResult,
      ticketsResult
    ] = await Promise.all([
      supabaseAdmin
        .from("products")
        .select("*")
        .eq("partner_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("orders")
        .select("*, order_items(*, product:products(id, name, category, partner_id))")
        .order("created_at", { ascending: false })
        .limit(120),
      supabaseAdmin
        .from("partner_locations")
        .select("*")
        .eq("partner_id", business.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("partner_devices")
        .select("*")
        .eq("partner_id", business.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("partner_qr_codes")
        .select("*")
        .eq("partner_id", business.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("partner_payment_intents")
        .select("*")
        .eq("partner_id", business.id)
        .order("created_at", { ascending: false })
        .limit(120),
      supabaseAdmin
        .from("partner_transactions")
        .select("*")
        .eq("partner_id", business.id)
        .order("occurred_at", { ascending: false })
        .limit(120),
      supabaseAdmin
        .from("partner_payouts")
        .select("*")
        .eq("partner_id", business.id)
        .order("period_end", { ascending: false })
        .limit(24),
      supabaseAdmin
        .from("partner_support_tickets")
        .select("*")
        .eq("partner_id", business.id)
        .order("created_at", { ascending: false })
        .limit(80)
    ]);

    const results = [productsResult, ordersResult, locationsResult, devicesResult, qrCodesResult, intentsResult, transactionsResult, payoutsResult, ticketsResult];
    const firstError = results.find((result) => result.error)?.error;
    if (firstError) throw firstError;

    const orders = summarizePartnerOrders(ordersResult.data || [], ownerId, isAdminUser);
    const metrics = partnerMetrics({
      business,
      products: productsResult.data || [],
      orders,
      paymentIntents: intentsResult.data || [],
      transactions: transactionsResult.data || [],
      payouts: payoutsResult.data || [],
      tickets: ticketsResult.data || []
    });

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "partner.os_viewed",
      resourceType: "partner_business",
      resourceId: business.id,
      metadata: { product_count: metrics.product_count, order_count: metrics.order_count }
    });

    return {
      ok: true,
      business,
      products: productsResult.data || [],
      orders,
      locations: locationsResult.data || [],
      devices: devicesResult.data || [],
      qrCodes: qrCodesResult.data || [],
      paymentIntents: intentsResult.data || [],
      transactions: transactionsResult.data || [],
      payouts: payoutsResult.data || [],
      tickets: ticketsResult.data || [],
      metrics,
      recommendations: partnerRecommendations(metrics, devicesResult.data || [])
    };
  });

  app.patch("/v1/partner/profile", async (request) => {
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      action: "partner.profile.update"
    });
    const business = await ensurePartnerBusiness(ctx, request);
    const payload = partnerProfileUpdateSchema.parse(request.body || {});
    const { data, error } = await supabaseAdmin
      .from("partner_businesses")
      .update(payload)
      .eq("id", business.id)
      .select("*")
      .single();
    if (error) throw error;

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "partner.profile_updated",
      resourceType: "partner_business",
      resourceId: business.id,
      metadata: { updated_fields: Object.keys(payload) }
    });
    return { ok: true, business: data };
  });

  app.post("/v1/partner/payment-intents", async (request, reply) => {
    assertPaymentsEnabled();
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      action: "partner.payment_intent.create"
    });
    const business = await ensurePartnerBusiness(ctx, request);
    const payload = partnerPaymentIntentSchema.parse(request.body || {});
    const provider = partnerProviderForChannel(payload.channel, payload.provider);
    const status = payload.channel === "cash" ? "paid" : payload.channel === "nfc" ? "provider_pending" : "awaiting_payment";
    const expiresAt = new Date(Date.now() + payload.expires_in_minutes * 60 * 1000).toISOString();

    const { data: intent, error } = await supabaseAdmin
      .from("partner_payment_intents")
      .insert({
        partner_id: business.id,
        location_id: payload.location_id || null,
        device_id: payload.device_id || null,
        order_id: payload.order_id || null,
        created_by: ctx.user.id,
        channel: payload.channel,
        provider,
        amount: Number(payload.amount.toFixed(2)),
        currency: payload.currency.toUpperCase(),
        description: payload.description || `${business.display_name} ödeme isteği`,
        customer_name: payload.customer_name || null,
        customer_phone: payload.customer_phone || null,
        customer_email: payload.customer_email || null,
        status,
        expires_at: expiresAt,
        metadata: {
          source: "partner_os",
          public_status_label: partnerPaymentStatusLabel(status),
          nfc_note: payload.channel === "nfc"
            ? "NFC tahsilat sertifikalı SoftPOS sağlayıcısı üzerinden tamamlanır."
            : null
        }
      })
      .select("*")
      .single();
    if (error) throw error;

    const publicParams = new URLSearchParams({
      intent: intent.id,
      amount: String(intent.amount),
      channel: intent.channel,
      partner: business.display_name || business.legal_name || "AllonaHub Partner"
    });
    const publicUrl = `${publicPaymentBaseUrl(request)}/pages/partner/pay.html?${publicParams.toString()}`;
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("partner_payment_intents")
      .update({
        payment_url: publicUrl,
        qr_payload: publicUrl,
        paid_at: payload.channel === "cash" ? new Date().toISOString() : null
      })
      .eq("id", intent.id)
      .select("*")
      .single();
    if (updateError) throw updateError;

    if (payload.channel === "cash") {
      const commissionRate = Number(business.default_commission_rate || 0.12);
      const gross = Number(payload.amount.toFixed(2));
      const commissionAmount = Number((gross * commissionRate).toFixed(2));
      const { error: transactionError } = await supabaseAdmin
        .from("partner_transactions")
        .insert({
          partner_id: business.id,
          payment_intent_id: intent.id,
          order_id: payload.order_id || null,
          transaction_type: "payment",
          channel: payload.channel,
          provider,
          gross_amount: gross,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          net_amount: Number((gross - commissionAmount).toFixed(2)),
          currency: payload.currency.toUpperCase(),
          status: "paid",
          metadata: { source: "partner_os_cash_record" }
        });
      if (transactionError) throw transactionError;
    }

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "partner.payment_intent_created",
      resourceType: "partner_payment_intent",
      resourceId: updated.id,
      metadata: { channel: payload.channel, provider, amount: payload.amount }
    });

    return reply.code(201).send({ ok: true, paymentIntent: updated });
  });

  app.post("/v1/partner/support-tickets", async (request, reply) => {
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      action: "partner.support_ticket.create"
    });
    const business = await ensurePartnerBusiness(ctx, request);
    const payload = partnerSupportTicketSchema.parse(request.body || {});
    const { data, error } = await supabaseAdmin
      .from("partner_support_tickets")
      .insert({
        partner_id: business.id,
        created_by: ctx.user.id,
        category: payload.category,
        priority: payload.priority,
        title: payload.title,
        message: payload.message
      })
      .select("*")
      .single();
    if (error) throw error;

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "partner.support_ticket_created",
      resourceType: "partner_support_ticket",
      resourceId: data.id,
      metadata: { category: payload.category, priority: payload.priority }
    });
    return reply.code(201).send({ ok: true, ticket: data });
  });

  app.patch("/v1/partner/orders/status", async (request) => {
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      action: "partner.order.status_update"
    });
    const payload = partnerOrderStatusSchema.parse(request.body || {});
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, order_status, tracking_number, order_items(product:products(id, partner_id))")
      .eq("id", payload.orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) throw httpError("Sipariş bulunamadı.", 404);
    const canUpdate = isAdmin(ctx.profile) || (order.order_items || []).some((item) => item.product?.partner_id === ctx.user.id);
    if (!canUpdate) throw httpError("Bu siparişi güncelleme yetkiniz yok.", 403);

    const updatePayload = {};
    if (payload.order_status) updatePayload.order_status = payload.order_status;
    if (Object.prototype.hasOwnProperty.call(payload, "tracking_number")) updatePayload.tracking_number = payload.tracking_number || null;
    const { data: updated, error } = await supabaseAdmin
      .from("orders")
      .update(updatePayload)
      .eq("id", payload.orderId)
      .select("*")
      .single();
    if (error) throw error;

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "partner.order_status_updated",
      resourceType: "order",
      resourceId: payload.orderId,
      metadata: updatePayload
    });
    return { ok: true, order: updated };
  });

  app.get("/v1/super-admin/dashboard", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.dashboard.view");
    const warnings = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      users,
      partners,
      orders,
      pendingApplications,
      securityAlerts,
      revenueRows,
      readyCheck
    ] = await Promise.all([
      countAdminRows("profiles_total", "profiles"),
      countAdminRows("partner_businesses_total", "partner_businesses"),
      countAdminRows("orders_total", "orders"),
      countAdminRows("partner_applications_pending", "partner_applications", (query) => query.in("status", ["pending", "review"])),
      countAdminRows("security_alerts_24h", "security_audit_events", (query) => query.in("severity", ["warning", "critical"]).gte("created_at", since24h)),
      runAdminQuery(
        "orders_daily_revenue",
        supabaseAdmin
          .from("orders")
          .select("total")
          .eq("payment_status", "paid")
          .gte("created_at", today.toISOString()),
        []
      ),
      runAdminQuery("database_ready", supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }), null)
    ]);

    [users, partners, orders, pendingApplications, securityAlerts, revenueRows, readyCheck]
      .filter((item) => item.warning)
      .forEach((item) => warnings.push(item.warning));

    if (partners.warning) {
      const partnerProfiles = await countAdminRows("partner_profiles_total", "profiles", (query) => query.eq("role", "partner"));
      if (partnerProfiles.warning) warnings.push(partnerProfiles.warning);
      partners.count = partnerProfiles.count;
    }

    const dailyRevenue = (revenueRows.data || [])
      .reduce((sum, order) => sum + Number(order.total || 0), 0);
    const autoDefense = autoDefenseStatus();

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.dashboard_viewed",
      source: "admin",
      resourceType: "super_admin_dashboard",
      metadata: {
        warning_count: warnings.length,
        security_alerts_24h: securityAlerts.count
      }
    });

    return {
      ok: true,
      dashboard: {
        metrics: {
          total_users: users.count,
          total_partners: partners.count,
          total_orders: orders.count,
          daily_revenue: Number(dailyRevenue.toFixed(2)),
          pending_applications: pendingApplications.count,
          security_alerts: securityAlerts.count
        },
        system_health: {
          api: "online",
          database: readyCheck.warning ? "warning" : "online",
          maintenance_mode: config.maintenanceMode,
          payments_disabled: config.paymentsDisabled,
          emergency_api_disabled: config.emergencyApiDisabled,
          auto_defense: {
            blocked_ip_count: autoDefense.blockedIpCount,
            strict_mode_until: autoDefense.strictModeUntil,
            recent_incident_count: autoDefense.recentIncidents.length
          }
        },
        schema_warnings: warnings
      }
    };
  });

  app.get("/v1/super-admin/users", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.users.list");
    const queryParams = z.object({
      limit: z.coerce.number().int().min(1).max(200).optional().default(80),
      role: z.enum(["customer", "partner", "courier", "admin", "super_admin"]).optional(),
      account_status: z.enum(["active", "passive", "suspended"]).optional(),
      search: z.string().trim().max(80).optional().default("")
    }).parse(request.query || {});

    let query = supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(queryParams.limit);

    if (queryParams.role) query = query.eq("role", queryParams.role);
    if (queryParams.account_status) query = query.eq("account_status", queryParams.account_status);
    if (queryParams.search) {
      const cleanSearch = queryParams.search.replace(/[%_,]/g, " ").trim();
      if (cleanSearch) {
        const like = `%${cleanSearch}%`;
        query = query.or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`);
      }
    }

    const result = await runAdminQuery("profiles_super_admin_list", query, []);
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.users_viewed",
      source: "admin",
      resourceType: "profiles",
      metadata: {
        limit: queryParams.limit,
        role: queryParams.role || "all",
        account_status: queryParams.account_status || "all",
        search: Boolean(queryParams.search)
      }
    });

    return {
      ok: true,
      users: (result.data || []).map(publicProfile),
      count: result.count,
      schema_warnings: result.warning ? [result.warning] : []
    };
  });

  app.patch("/v1/super-admin/users/:userId", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.users.update");
    const { userId } = z.object({ userId: uuidSchema }).parse(request.params || {});
    const body = superAdminUserUpdateSchema.parse(request.body || {});
    const { data: before, error: beforeError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (beforeError) throw beforeError;
    if (!before) throw httpError("Kullanıcı bulunamadı.", 404);

    const payload = {};
    if (body.account_status !== undefined) payload.account_status = body.account_status;
    if (body.flagged_suspicious !== undefined) payload.flagged_suspicious = body.flagged_suspicious;
    if (body.risk_level !== undefined) payload.risk_level = body.risk_level;
    if (body.note) payload.last_admin_note = body.note;
    payload.updated_at = new Date().toISOString();

    const { data: updated, error } = await supabaseAdmin
      .from("profiles")
      .update(payload)
      .eq("id", userId)
      .select("*")
      .single();
    if (error) throw error;

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.user_updated",
      resourceType: "profile",
      resourceId: userId,
      severity: body.account_status === "suspended" || body.risk_level === "critical" ? "critical" : "warning",
      source: "admin",
      evidenceTags: ["super_admin", "user_management"],
      metadata: {
        old_value: {
          account_status: before.account_status || "active",
          flagged_suspicious: Boolean(before.flagged_suspicious),
          risk_level: before.risk_level || "low",
          last_admin_note: before.last_admin_note || ""
        },
        new_value: {
          account_status: updated.account_status || "active",
          flagged_suspicious: Boolean(updated.flagged_suspicious),
          risk_level: updated.risk_level || "low",
          last_admin_note: updated.last_admin_note || ""
        }
      }
    });

    return { ok: true, user: publicProfile(updated) };
  });

  app.get("/v1/super-admin/partners", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.partners.list");
    const warnings = [];
    const applications = await runAdminQuery(
      "partner_applications_super_admin",
      supabaseAdmin
        .from("partner_applications")
        .select("*, profile:profiles(id, full_name, email, phone)", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(80),
      []
    );
    if (applications.warning) warnings.push(applications.warning);

    const businesses = await runAdminQuery(
      "partner_businesses_super_admin",
      supabaseAdmin
        .from("partner_businesses")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(80),
      []
    );
    if (businesses.warning) warnings.push(businesses.warning);

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.partners_viewed",
      source: "admin",
      resourceType: "partner_management",
      metadata: {
        application_count: applications.count,
        business_count: businesses.count
      }
    });

    return {
      ok: true,
      applications: applications.data || [],
      businesses: businesses.data || [],
      schema_warnings: warnings
    };
  });

  app.patch("/v1/super-admin/partner-applications/:applicationId", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.partner_application.decide");
    const { applicationId } = z.object({ applicationId: uuidSchema }).parse(request.params || {});
    const body = partnerApplicationDecisionSchema.parse(request.body || {});
    const { data: before, error: beforeError } = await supabaseAdmin
      .from("partner_applications")
      .select("*")
      .eq("id", applicationId)
      .maybeSingle();
    if (beforeError) throw beforeError;
    if (!before) throw httpError("Partner başvurusu bulunamadı.", 404);

    const applicationPayload = {
      status: body.decision,
      updated_at: new Date().toISOString()
    };

    const { data: application, error: updateError } = await supabaseAdmin
      .from("partner_applications")
      .update(applicationPayload)
      .eq("id", applicationId)
      .select("*")
      .single();
    if (updateError) throw updateError;

    let partnerBusiness = null;
    if (body.decision === "approved" && before.user_id) {
      const { data: existingBusiness, error: existingBusinessError } = await supabaseAdmin
        .from("partner_businesses")
        .select("*")
        .eq("owner_id", before.user_id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (existingBusinessError && !looksLikeMissingSchema(existingBusinessError)) throw existingBusinessError;

      if (!existingBusinessError) {
        const businessPayload = {
          owner_id: before.user_id,
          display_name: before.company_name,
          legal_name: before.company_name,
          email: before.email,
          phone: before.phone,
          status: body.store_status || "active",
          verification_status: "verified",
          default_commission_rate: body.commission_rate ?? 0.12,
          metadata: {
            approved_from_application_id: applicationId,
            approved_by: ctx.user.id,
            approval_reason: body.reason || ""
          }
        };

        const businessQuery = existingBusiness
          ? supabaseAdmin.from("partner_businesses").update(businessPayload).eq("id", existingBusiness.id).select("*").single()
          : supabaseAdmin.from("partner_businesses").insert(businessPayload).select("*").single();
        const { data: businessRow, error: businessError } = await businessQuery;
        if (businessError) throw businessError;
        partnerBusiness = businessRow;
      }
    }

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.partner_application_decided",
      resourceType: "partner_application",
      resourceId: applicationId,
      severity: body.decision === "approved" ? "warning" : "info",
      source: "admin",
      evidenceTags: ["super_admin", "partner_application"],
      metadata: {
        old_value: { status: before.status },
        new_value: {
          status: application.status,
          commission_rate: body.commission_rate ?? null,
          store_status: body.store_status || null,
          partner_business_id: partnerBusiness?.id || null
        },
        reason: body.reason || ""
      }
    });

    return { ok: true, application, partner_business: partnerBusiness };
  });

  app.get("/v1/super-admin/security", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.security.view");
    const warnings = [];
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const events = await runAdminQuery(
      "super_admin_security_events",
      supabaseAdmin
        .from("security_audit_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(120),
      []
    );
    if (events.warning) warnings.push(events.warning);

    const failedAuth = await countAdminRows("super_admin_failed_auth_24h", "security_audit_events", (query) => (
      query.in("action", ["auth.denied", "authz.denied", "mfa.required", "admin.boundary_denied"]).gte("created_at", since24h)
    ));
    if (failedAuth.warning) warnings.push(failedAuth.warning);

    const criticalEvents = (events.data || []).filter((event) => event.severity === "critical").length;
    const suspiciousIps = Object.entries((events.data || [])
      .filter((event) => event.ip_address && ["warning", "critical"].includes(event.severity))
      .reduce((acc, event) => {
        acc[event.ip_address] = (acc[event.ip_address] || 0) + 1;
        return acc;
      }, {}))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([ip, count]) => ({ ip, count }));

    const autoDefense = autoDefenseStatus();
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.security_viewed",
      source: "admin",
      resourceType: "security_center",
      metadata: {
        failed_auth_24h: failedAuth.count,
        critical_event_sample_count: criticalEvents
      }
    });

    return {
      ok: true,
      security: {
        metrics: {
          failed_auth_24h: failedAuth.count,
          critical_events_sample: criticalEvents,
          suspicious_ip_count: suspiciousIps.length,
          blocked_ip_count: autoDefense.blockedIpCount
        },
        suspicious_ips: suspiciousIps,
        recent_events: events.data || [],
        auto_defense: autoDefense
      },
      schema_warnings: warnings
    };
  });

  app.get("/v1/super-admin/settings", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.settings.list");
    const result = await runAdminQuery(
      "super_admin_settings",
      supabaseAdmin
        .from("super_admin_settings")
        .select("*")
        .order("category", { ascending: true })
        .order("setting_key", { ascending: true }),
      []
    );
    const settings = result.warning
      ? DEFAULT_SUPER_ADMIN_SETTINGS.map((item) => ({
          setting_key: item.key,
          label: item.label,
          setting_value: item.value,
          value_type: item.value_type,
          risk_level: item.risk_level,
          category: item.category,
          source: "default"
        }))
      : result.data;

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.settings_viewed",
      source: "admin",
      resourceType: "super_admin_settings",
      metadata: { warning: Boolean(result.warning) }
    });

    return {
      ok: true,
      settings,
      env_flags: {
        maintenance_mode: config.maintenanceMode,
        emergency_api_disabled: config.emergencyApiDisabled,
        payments_disabled: config.paymentsDisabled
      },
      schema_warnings: result.warning ? [result.warning] : []
    };
  });

  app.patch("/v1/super-admin/settings/:settingKey", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.settings.update");
    const { settingKey } = z.object({
      settingKey: z.string().trim().min(2).max(80).regex(/^[a-z0-9_.:-]+$/i)
    }).parse(request.params || {});
    const body = superAdminSettingUpdateSchema.parse(request.body || {});
    const cleanValue = normalizeJsonValue(body.value);

    if (criticalSettingNeedsReason(settingKey, cleanValue, body.reason)) {
      throw httpError("Kritik sistem ayarları için işlem nedeni zorunludur.", 400);
    }

    const { data: before, error: beforeError } = await supabaseAdmin
      .from("super_admin_settings")
      .select("*")
      .eq("setting_key", settingKey)
      .maybeSingle();
    if (beforeError && !looksLikeMissingSchema(beforeError)) throw beforeError;
    if (beforeError && looksLikeMissingSchema(beforeError)) {
      throw httpError("super_admin_settings migration henüz uygulanmamış.", 503);
    }

    const definition = DEFAULT_SUPER_ADMIN_SETTINGS.find((item) => item.key === settingKey);
    const row = {
      setting_key: settingKey,
      label: before?.label || definition?.label || settingKey,
      setting_value: cleanValue,
      value_type: before?.value_type || definition?.value_type || typeof cleanValue,
      risk_level: before?.risk_level || definition?.risk_level || "medium",
      category: before?.category || definition?.category || "system",
      updated_by: ctx.user.id,
      updated_at: new Date().toISOString()
    };

    const { data: updated, error } = await supabaseAdmin
      .from("super_admin_settings")
      .upsert(row, { onConflict: "setting_key" })
      .select("*")
      .single();
    if (error) throw error;

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.setting_updated",
      resourceType: "super_admin_setting",
      resourceId: settingKey,
      severity: updated.risk_level === "critical" ? "critical" : "warning",
      source: "admin",
      evidenceTags: ["super_admin", "system_settings"],
      metadata: {
        old_value: before?.setting_value ?? null,
        new_value: updated.setting_value,
        reason: body.reason || ""
      }
    });

    return { ok: true, setting: updated };
  });

  app.get("/v1/super-admin/modules", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.modules.list");
    const result = await runAdminQuery(
      "platform_modules",
      supabaseAdmin
        .from("platform_modules")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      []
    );
    const modules = result.warning
      ? DEFAULT_PLATFORM_MODULES.map((item, index) => ({
          ...item,
          is_active: true,
          is_visible: true,
          commission_rate: 0.12,
          application_status: "open",
          content_config: {},
          sort_order: index + 1,
          source: "default"
        }))
      : result.data;

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.modules_viewed",
      source: "admin",
      resourceType: "platform_modules",
      metadata: { warning: Boolean(result.warning) }
    });

    return {
      ok: true,
      modules,
      schema_warnings: result.warning ? [result.warning] : []
    };
  });

  app.patch("/v1/super-admin/modules/:moduleKey", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.modules.update");
    const { moduleKey } = z.object({
      moduleKey: z.string().trim().min(2).max(80).regex(/^[a-z0-9_.:-]+$/i)
    }).parse(request.params || {});
    const body = superAdminModuleUpdateSchema.parse(request.body || {});
    const { data: before, error: beforeError } = await supabaseAdmin
      .from("platform_modules")
      .select("*")
      .eq("module_key", moduleKey)
      .maybeSingle();
    if (beforeError && !looksLikeMissingSchema(beforeError)) throw beforeError;
    if (beforeError && looksLikeMissingSchema(beforeError)) {
      throw httpError("platform_modules migration henüz uygulanmamış.", 503);
    }

    const definition = DEFAULT_PLATFORM_MODULES.find((item) => item.module_key === moduleKey);
    const row = {
      module_key: moduleKey,
      name: before?.name || definition?.name || moduleKey,
      category: before?.category || definition?.category || "services",
      is_active: body.is_active ?? before?.is_active ?? true,
      is_visible: body.is_visible ?? before?.is_visible ?? true,
      commission_rate: body.commission_rate ?? before?.commission_rate ?? 0.12,
      application_status: body.application_status || before?.application_status || "open",
      content_config: normalizeJsonValue(body.content_config ?? before?.content_config ?? {}),
      updated_by: ctx.user.id,
      updated_at: new Date().toISOString()
    };

    const { data: updated, error } = await supabaseAdmin
      .from("platform_modules")
      .upsert(row, { onConflict: "module_key" })
      .select("*")
      .single();
    if (error) throw error;

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.module_updated",
      resourceType: "platform_module",
      resourceId: moduleKey,
      severity: "warning",
      source: "admin",
      evidenceTags: ["super_admin", "module_management"],
      metadata: {
        old_value: before,
        new_value: updated
      }
    });

    return { ok: true, module: updated };
  });

  app.get("/v1/super-admin/audit-log", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.audit_log.view");
    const query = auditQuerySchema.parse(request.query || {});
    let dbQuery = supabaseAdmin
      .from("security_audit_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(query.limit);
    if (query.severity) dbQuery = dbQuery.eq("severity", query.severity);
    if (query.actorId) dbQuery = dbQuery.eq("actor_id", query.actorId);
    if (query.action) dbQuery = dbQuery.eq("action", query.action);
    if (query.resourceType) dbQuery = dbQuery.eq("resource_type", query.resourceType);
    if (query.resourceId) dbQuery = dbQuery.eq("resource_id", query.resourceId);
    if (query.from) dbQuery = dbQuery.gte("created_at", query.from);
    if (query.to) dbQuery = dbQuery.lte("created_at", query.to);

    const result = await runAdminQuery("super_admin_audit_log", dbQuery, []);
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.audit_log_viewed",
      source: "admin",
      resourceType: "security_audit_events",
      metadata: {
        limit: query.limit,
        severity: query.severity || "all",
        warning: Boolean(result.warning)
      }
    });

    return {
      ok: true,
      events: result.data || [],
      schema_warnings: result.warning ? [result.warning] : []
    };
  });

  app.get("/v1/admin/ops/bootstrap", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.bootstrap");
    const warnings = [];
    const dashboard = await loadAdminDashboardData(warnings);

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.bootstrap_viewed",
      resourceType: "admin_ops",
      metadata: { warning_count: warnings.length }
    });

    return {
      ok: true,
      profile: {
        id: ctx.user.id,
        full_name: ctx.profile.full_name || ctx.user.email || "Admin",
        role: ctx.profile.role
      },
      capabilities: {
        can_delete_users: false,
        can_change_commission: false,
        can_change_finance_settings: false,
        can_create_super_admin: false,
        can_change_system_settings: false,
        can_create_operational_notes: true,
        can_create_review_flags: true,
        can_request_super_admin_approval: true
      },
      dashboard,
      warnings
    };
  });

  app.get("/v1/admin/ops/dashboard", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.dashboard");
    const warnings = [];
    const dashboard = await loadAdminDashboardData(warnings);

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.dashboard_viewed",
      resourceType: "dashboard",
      metadata: { warning_count: warnings.length }
    });

    return { ok: true, dashboard, warnings };
  });

  app.get("/v1/admin/ops/users", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.users.list");
    const query = adminListQuerySchema.parse(request.query || {});
    const warnings = [];
    let dbQuery = supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, phone, country, city, role, profile_visible, contact_locked, premium_level, hp, xp, created_at, updated_at")
      .neq("role", "super_admin")
      .order("created_at", { ascending: false })
      .limit(query.limit);
    const filter = textSearchFilter(["full_name", "email", "phone", "city"], query.search);
    if (filter) dbQuery = dbQuery.or(filter);
    if (query.status === "hidden") dbQuery = dbQuery.eq("profile_visible", false);
    const users = await optionalQuery(dbQuery, [], warnings, "profiles");

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.users_list_viewed",
      resourceType: "profile",
      metadata: { search: query.search || null, status: query.status || null, limit: query.limit, count: users.length }
    });

    return { ok: true, users, warnings };
  });

  app.get("/v1/admin/ops/users/:userId", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.users.detail");
    const userId = uuidSchema.parse(request.params.userId);
    const warnings = [];
    const profile = await optionalQuery(
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, phone, country, city, role, profile_visible, contact_locked, premium_level, hp, xp, created_at, updated_at")
        .eq("id", userId)
        .neq("role", "super_admin")
        .maybeSingle(),
      null,
      warnings,
      "profiles"
    );
    if (!profile) throw httpError("Kullanıcı bulunamadı veya görüntüleme yetkiniz yok.", 404);

    const [orders, notes, flags] = await Promise.all([
      optionalQuery(
        supabaseAdmin
          .from("orders")
          .select("id, order_no, total, order_status, payment_status, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
        [],
        warnings,
        "orders"
      ),
      optionalQuery(
        supabaseAdmin
          .from("admin_operation_notes")
          .select("id, note_type, body, created_at, author:profiles(id, full_name)")
          .eq("target_type", "user")
          .eq("target_id", userId)
          .order("created_at", { ascending: false })
          .limit(30),
        [],
        warnings,
        "admin_operation_notes"
      ),
      optionalQuery(
        supabaseAdmin
          .from("admin_operation_flags")
          .select("id, flag_type, severity, reason, status, created_at")
          .eq("target_type", "user")
          .eq("target_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
        [],
        warnings,
        "admin_operation_flags"
      )
    ]);

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.user_detail_viewed",
      resourceType: "profile",
      resourceId: userId,
      metadata: { order_count: orders.length, note_count: notes.length, flag_count: flags.length }
    });

    return { ok: true, profile, orders, notes, flags, warnings };
  });

  app.post("/v1/admin/ops/users/:userId/notes", async (request, reply) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.users.note");
    const userId = uuidSchema.parse(request.params.userId);
    const payload = adminNoteSchema.parse(request.body || {});
    const warnings = [];
    const note = await optionalMutation(
      supabaseAdmin
        .from("admin_operation_notes")
        .insert({
          author_id: ctx.user.id,
          target_type: "user",
          target_id: userId,
          note_type: payload.note_type,
          body: payload.body
        })
        .select("*")
        .single(),
      warnings,
      "admin_operation_notes"
    );
    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.user_note_created",
      resourceType: "profile",
      resourceId: userId,
      metadata: { note_type: payload.note_type }
    });
    return reply.code(201).send({ ok: true, note, warnings });
  });

  app.post("/v1/admin/ops/users/:userId/flag", async (request, reply) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.users.flag");
    const userId = uuidSchema.parse(request.params.userId);
    const payload = adminFlagSchema.parse(request.body || {});
    const warnings = [];
    const flag = await optionalMutation(
      supabaseAdmin
        .from("admin_operation_flags")
        .insert({
          flagged_by: ctx.user.id,
          target_type: "user",
          target_id: userId,
          flag_type: "suspicious_user",
          severity: payload.severity,
          reason: payload.reason,
          status: "open"
        })
        .select("*")
        .single(),
      warnings,
      "admin_operation_flags"
    );
    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.user_flagged",
      resourceType: "profile",
      resourceId: userId,
      severity: payload.severity,
      metadata: { flag_type: "suspicious_user" }
    });
    return reply.code(201).send({ ok: true, flag, warnings });
  });

  app.get("/v1/admin/ops/partner-applications", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.partner_applications.list");
    const query = adminListQuerySchema.parse(request.query || {});
    const warnings = [];
    let dbQuery = supabaseAdmin
      .from("partner_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(query.limit);
    const filter = textSearchFilter(["company_name", "contact_name", "email", "phone", "tax_number"], query.search);
    if (filter) dbQuery = dbQuery.or(filter);
    if (query.status) dbQuery = dbQuery.eq("status", query.status);
    const applications = await optionalQuery(dbQuery, [], warnings, "partner_applications");

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.partner_applications_viewed",
      resourceType: "partner_application",
      metadata: { search: query.search || null, status: query.status || null, count: applications.length }
    });

    return { ok: true, applications, warnings };
  });

  app.get("/v1/admin/ops/partner-applications/:applicationId", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.partner_applications.detail");
    const applicationId = uuidSchema.parse(request.params.applicationId);
    const warnings = [];
    const [application, notes, requests] = await Promise.all([
      optionalQuery(
        supabaseAdmin.from("partner_applications").select("*").eq("id", applicationId).maybeSingle(),
        null,
        warnings,
        "partner_applications"
      ),
      optionalQuery(
        supabaseAdmin
          .from("admin_operation_notes")
          .select("id, note_type, body, created_at, author:profiles(id, full_name)")
          .eq("target_type", "partner_application")
          .eq("target_id", applicationId)
          .order("created_at", { ascending: false })
          .limit(30),
        [],
        warnings,
        "admin_operation_notes"
      ),
      optionalQuery(
        supabaseAdmin
          .from("admin_approval_requests")
          .select("*")
          .eq("target_type", "partner_application")
          .eq("target_id", applicationId)
          .order("created_at", { ascending: false })
          .limit(20),
        [],
        warnings,
        "admin_approval_requests"
      )
    ]);
    if (!application) throw httpError("Partner başvurusu bulunamadı.", 404);

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.partner_application_detail_viewed",
      resourceType: "partner_application",
      resourceId: applicationId,
      metadata: { note_count: notes.length, approval_request_count: requests.length }
    });

    return { ok: true, application, notes, approvalRequests: requests, warnings };
  });

  app.patch("/v1/admin/ops/partner-applications/:applicationId/review", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.partner_applications.review");
    const applicationId = uuidSchema.parse(request.params.applicationId);
    const payload = partnerApplicationActionSchema.parse(request.body || {});
    const warnings = [];
    const nowIso = new Date().toISOString();
    const recommendation = payload.action === "recommend_approve"
      ? "approve"
      : payload.action === "recommend_reject"
      ? "reject"
      : payload.action === "send_super_admin"
      ? "needs_super_admin"
      : null;
    const reviewStage = payload.action === "start_review" ? "in_review" : "recommendation_ready";

    const application = await optionalMutation(
      supabaseAdmin
        .from("partner_applications")
        .update({
          status: "review",
          review_stage: reviewStage,
          admin_recommendation: recommendation,
          risk_level: payload.risk_level,
          reviewed_by: ctx.user.id,
          reviewed_at: nowIso,
          metadata: {
            last_admin_action: payload.action,
            last_admin_reason: payload.reason,
            last_admin_action_at: nowIso
          }
        })
        .eq("id", applicationId)
        .select("*")
        .single(),
      warnings,
      "partner_applications"
    );

    await optionalMutation(
      supabaseAdmin
        .from("admin_operation_notes")
        .insert({
          author_id: ctx.user.id,
          target_type: "partner_application",
          target_id: applicationId,
          note_type: "review",
          body: payload.reason
        }),
      warnings,
      "admin_operation_notes"
    );

    let approvalRequest = null;
    if (payload.action !== "start_review") {
      approvalRequest = await optionalMutation(
        supabaseAdmin
          .from("admin_approval_requests")
          .insert({
            requested_by: ctx.user.id,
            target_type: "partner_application",
            target_id: applicationId,
            request_type: recommendation === "reject" ? "partner_rejection" : "partner_approval",
            status: "pending_super_admin",
            summary: payload.reason,
            proposed_action: {
              action: payload.action,
              recommendation,
              risk_level: payload.risk_level
            }
          })
          .select("*")
          .single(),
        warnings,
        "admin_approval_requests"
      );
    }

    await auditedOpsEvent({
      request,
      ctx,
      action: `admin.ops.partner_application_${payload.action}`,
      resourceType: "partner_application",
      resourceId: applicationId,
      severity: payload.risk_level,
      metadata: { recommendation, approval_request_id: approvalRequest?.id || null }
    });

    return { ok: true, application, approvalRequest, warnings };
  });

  app.get("/v1/admin/ops/partners", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.partners.list");
    const query = adminListQuerySchema.parse(request.query || {});
    const warnings = [];
    let dbQuery = supabaseAdmin
      .from("partner_businesses")
      .select("id, owner_id, partner_code, display_name, legal_name, partner_type, email, phone, city, country, status, verification_status, trust_score, level, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(query.limit);
    const filter = textSearchFilter(["display_name", "legal_name", "email", "phone", "city", "partner_code"], query.search);
    if (filter) dbQuery = dbQuery.or(filter);
    if (query.status) dbQuery = dbQuery.eq("status", query.status);
    const partners = await optionalQuery(dbQuery, [], warnings, "partner_businesses");

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.partners_viewed",
      resourceType: "partner_business",
      metadata: { search: query.search || null, status: query.status || null, count: partners.length }
    });

    return { ok: true, partners, warnings };
  });

  app.get("/v1/admin/ops/orders", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.orders.list");
    const query = adminListQuerySchema.parse(request.query || {});
    const warnings = [];
    let dbQuery = supabaseAdmin
      .from("orders")
      .select("id, order_no, user_id, customer_name, customer_email, customer_phone, city, total, subtotal, shipping, discount, order_status, payment_status, tracking_number, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(query.limit);
    const filter = textSearchFilter(["order_no", "customer_name", "customer_email", "customer_phone", "city"], query.search);
    if (filter) dbQuery = dbQuery.or(filter);
    if (query.status) dbQuery = dbQuery.eq("order_status", query.status);
    const orders = await optionalQuery(dbQuery, [], warnings, "orders");

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.orders_viewed",
      resourceType: "order",
      metadata: { search: query.search || null, status: query.status || null, count: orders.length }
    });

    return { ok: true, orders, warnings };
  });

  app.get("/v1/admin/ops/orders/:orderId", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.orders.detail");
    const orderId = uuidSchema.parse(request.params.orderId);
    const warnings = [];
    const [order, notes, flags] = await Promise.all([
      optionalQuery(
        supabaseAdmin
          .from("orders")
          .select("*, order_items(*, product:products(id, name, category, partner_id))")
          .eq("id", orderId)
          .maybeSingle(),
        null,
        warnings,
        "orders"
      ),
      optionalQuery(
        supabaseAdmin
          .from("admin_operation_notes")
          .select("id, note_type, body, created_at, author:profiles(id, full_name)")
          .eq("target_type", "order")
          .eq("target_id", orderId)
          .order("created_at", { ascending: false })
          .limit(30),
        [],
        warnings,
        "admin_operation_notes"
      ),
      optionalQuery(
        supabaseAdmin
          .from("admin_operation_flags")
          .select("id, flag_type, severity, reason, status, created_at")
          .eq("target_type", "order")
          .eq("target_id", orderId)
          .order("created_at", { ascending: false })
          .limit(20),
        [],
        warnings,
        "admin_operation_flags"
      )
    ]);
    if (!order) throw httpError("Sipariş bulunamadı.", 404);

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.order_detail_viewed",
      resourceType: "order",
      resourceId: orderId,
      metadata: { item_count: order.order_items?.length || 0, note_count: notes.length, flag_count: flags.length }
    });

    return { ok: true, order, notes, flags, warnings };
  });

  app.post("/v1/admin/ops/orders/:orderId/risk-flag", async (request, reply) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.orders.risk_flag");
    const orderId = uuidSchema.parse(request.params.orderId);
    const payload = adminFlagSchema.parse(request.body || {});
    const warnings = [];
    const flag = await optionalMutation(
      supabaseAdmin
        .from("admin_operation_flags")
        .insert({
          flagged_by: ctx.user.id,
          target_type: "order",
          target_id: orderId,
          flag_type: "risky_order",
          severity: payload.severity,
          reason: payload.reason,
          status: "open"
        })
        .select("*")
        .single(),
      warnings,
      "admin_operation_flags"
    );
    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.order_risk_flagged",
      resourceType: "order",
      resourceId: orderId,
      severity: payload.severity,
      metadata: { flag_type: "risky_order" }
    });
    return reply.code(201).send({ ok: true, flag, warnings });
  });

  app.get("/v1/admin/ops/support-tickets", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.support.list");
    const query = adminListQuerySchema.parse(request.query || {});
    const warnings = [];
    let userTicketQuery = supabaseAdmin
      .from("support_tickets")
      .select("*, profile:profiles(id, full_name, email, phone)")
      .order("created_at", { ascending: false })
      .limit(query.limit);
    if (query.status) userTicketQuery = userTicketQuery.eq("status", query.status);
    let partnerTicketQuery = supabaseAdmin
      .from("partner_support_tickets")
      .select("*, partner:partner_businesses(id, display_name, partner_code)")
      .order("created_at", { ascending: false })
      .limit(query.limit);
    if (query.status) partnerTicketQuery = partnerTicketQuery.eq("status", toPartnerSupportStatus(query.status));

    const [userTickets, partnerTickets] = await Promise.all([
      optionalQuery(userTicketQuery, [], warnings, "support_tickets"),
      optionalQuery(partnerTicketQuery, [], warnings, "partner_support_tickets")
    ]);

    const search = cleanSearch(query.search).toLocaleLowerCase("tr-TR");
    const tickets = [
      ...userTickets.map((ticket) => ({ ...ticket, source: "user", requester_label: ticket.profile?.full_name || ticket.profile?.email || ticket.user_id || "Kullanıcı" })),
      ...partnerTickets.map((ticket) => ({
        ...ticket,
        source: "partner",
        requester_label: ticket.partner?.display_name || ticket.partner_id || "Partner",
        status: normalizePartnerSupportStatus(ticket.status)
      }))
    ]
      .filter((ticket) => {
        if (!search) return true;
        return `${ticket.title || ""} ${ticket.message || ""} ${ticket.requester_label || ""} ${ticket.category || ""}`
          .toLocaleLowerCase("tr-TR")
          .includes(search);
      })
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, query.limit);

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.support_tickets_viewed",
      resourceType: "support_ticket",
      metadata: { search: query.search || null, status: query.status || null, count: tickets.length }
    });

    return { ok: true, tickets, warnings };
  });

  app.patch("/v1/admin/ops/support-tickets/:ticketId/status", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.support.status");
    const ticketId = uuidSchema.parse(request.params.ticketId);
    const payload = supportStatusSchema.parse(request.body || {});
    const warnings = [];
    const table = payload.source === "partner" ? "partner_support_tickets" : "support_tickets";
    const status = payload.source === "partner" ? toPartnerSupportStatus(payload.status) : payload.status;
    const ticket = await optionalMutation(
      supabaseAdmin
        .from(table)
        .update({ status })
        .eq("id", ticketId)
        .select("*")
        .single(),
      warnings,
      table
    );
    if (payload.note) {
      await optionalMutation(
        supabaseAdmin
          .from("admin_operation_notes")
          .insert({
            author_id: ctx.user.id,
            target_type: payload.source === "partner" ? "partner_support_ticket" : "support_ticket",
            target_id: ticketId,
            note_type: "support",
            body: payload.note
          }),
        warnings,
        "admin_operation_notes"
      );
      if (payload.source === "user") {
        await optionalMutation(
          supabaseAdmin
            .from("support_ticket_notes")
            .insert({
              ticket_id: ticketId,
              author_id: ctx.user.id,
              note_type: "internal",
              body: payload.note
            }),
          warnings,
          "support_ticket_notes"
        );
      }
    }

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.support_ticket_status_updated",
      resourceType: payload.source === "partner" ? "partner_support_ticket" : "support_ticket",
      resourceId: ticketId,
      metadata: { status: payload.status, source: payload.source, has_note: Boolean(payload.note) }
    });

    return { ok: true, ticket, warnings };
  });

  app.post("/v1/admin/ops/support-tickets/:ticketId/notes", async (request, reply) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.support.note");
    const ticketId = uuidSchema.parse(request.params.ticketId);
    const source = z.enum(["user", "partner"]).parse(request.query?.source || "user");
    const payload = adminNoteSchema.parse(request.body || {});
    const warnings = [];
    const note = await optionalMutation(
      supabaseAdmin
        .from("admin_operation_notes")
        .insert({
          author_id: ctx.user.id,
          target_type: source === "partner" ? "partner_support_ticket" : "support_ticket",
          target_id: ticketId,
          note_type: "support",
          body: payload.body
        })
        .select("*")
        .single(),
      warnings,
      "admin_operation_notes"
    );
    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.support_ticket_note_created",
      resourceType: source === "partner" ? "partner_support_ticket" : "support_ticket",
      resourceId: ticketId,
      metadata: { source }
    });
    return reply.code(201).send({ ok: true, note, warnings });
  });

  app.get("/v1/admin/ops/content-proposals", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.content.list");
    const warnings = [];
    const proposals = await optionalQuery(
      supabaseAdmin
        .from("content_change_proposals")
        .select("*, proposer:profiles(id, full_name)")
        .order("created_at", { ascending: false })
        .limit(80),
      [],
      warnings,
      "content_change_proposals"
    );
    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.content_proposals_viewed",
      resourceType: "content_change_proposal",
      metadata: { count: proposals.length }
    });
    return { ok: true, proposals, warnings };
  });

  app.post("/v1/admin/ops/content-proposals", async (request, reply) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.content.propose");
    const payload = contentProposalSchema.parse(request.body || {});
    const warnings = [];
    const proposal = await optionalMutation(
      supabaseAdmin
        .from("content_change_proposals")
        .insert({
          proposed_by: ctx.user.id,
          content_scope: payload.content_scope,
          title: payload.title,
          summary: payload.summary,
          payload: payload.payload,
          status: "pending_super_admin"
        })
        .select("*")
        .single(),
      warnings,
      "content_change_proposals"
    );
    await optionalMutation(
      supabaseAdmin
        .from("admin_approval_requests")
        .insert({
          requested_by: ctx.user.id,
          target_type: "content_module",
          target_id: proposal.id,
          request_type: payload.content_scope === "banner" || payload.content_scope === "campaign" ? "banner_campaign" : "content_visibility",
          status: "pending_super_admin",
          summary: payload.summary,
          proposed_action: {
            content_scope: payload.content_scope,
            title: payload.title,
            payload: payload.payload
          }
        }),
      warnings,
      "admin_approval_requests"
    );
    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.content_proposal_created",
      resourceType: "content_change_proposal",
      resourceId: proposal.id,
      metadata: { content_scope: payload.content_scope }
    });
    return reply.code(201).send({ ok: true, proposal, warnings });
  });

  app.get("/v1/admin/ops/security-monitoring", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.security_monitoring");
    const warnings = [];
    const [events, flags, notifications] = await Promise.all([
      optionalQuery(
        supabaseAdmin
          .from("security_audit_events")
          .select("id, actor_id, actor_role, action, resource_type, resource_id, severity, ip_address, source, purpose, metadata, created_at")
          .or("severity.eq.warning,severity.eq.critical,action.ilike.%auth.denied%,action.ilike.%authz.denied%")
          .order("created_at", { ascending: false })
          .limit(80),
        [],
        warnings,
        "security_audit_events"
      ),
      optionalQuery(
        supabaseAdmin
          .from("admin_operation_flags")
          .select("*")
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(80),
        [],
        warnings,
        "admin_operation_flags"
      ),
      optionalQuery(
        supabaseAdmin
          .from("admin_notifications")
          .select("id, user_id, kind, severity, title, message, metadata, created_at")
          .order("created_at", { ascending: false })
          .limit(80),
        [],
        warnings,
        "admin_notifications"
      )
    ]);
    const autoDefense = autoDefenseStatus();
    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.security_monitoring_viewed",
      resourceType: "security_monitoring",
      metadata: { event_count: events.length, flag_count: flags.length, notification_count: notifications.length }
    });
    return { ok: true, events, flags, notifications, autoDefense, warnings };
  });

  app.get("/v1/admin/ops/reports", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.reports");
    const warnings = [];
    const dashboard = await loadAdminDashboardData(warnings);
    const [ordersToday, riskyOrders, supportResolved] = await Promise.all([
      optionalQuery(
        supabaseAdmin.from("orders").select("id", { count: "exact", head: true }).gte("created_at", startOfTodayIso()),
        [],
        warnings,
        "orders"
      ),
      optionalQuery(
        supabaseAdmin.from("admin_operation_flags").select("id", { count: "exact", head: true }).eq("target_type", "order").eq("status", "open"),
        [],
        warnings,
        "admin_operation_flags"
      ),
      optionalQuery(
        supabaseAdmin.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "resolved").gte("updated_at", startOfTodayIso()),
        [],
        warnings,
        "support_tickets"
      )
    ]);

    const reports = {
      daily_operations: dashboard.metrics,
      partner_application_report: {
        daily_new: dashboard.metrics.daily_partner_applications,
        pending: dashboard.metrics.pending_applications
      },
      order_report: {
        daily_orders: Number(ordersToday.count || 0),
        risky_open: Number(riskyOrders.count || 0)
      },
      user_activity_report: {
        daily_new_users: dashboard.metrics.daily_users
      },
      support_report: {
        open: dashboard.metrics.open_support_tickets,
        resolved_today: Number(supportResolved.count || 0)
      }
    };

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.reports_viewed",
      resourceType: "admin_report",
      metadata: reports
    });

    return { ok: true, reports, warnings };
  });

  app.get("/v1/admin/ops/audit-log", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.audit_log");
    const query = adminAuditLogQuerySchema.parse(request.query || {});
    const warnings = [];
    let dbQuery = supabaseAdmin
      .from("security_audit_events")
      .select("id, actor_id, actor_role, action, resource_type, resource_id, severity, ip_address, source, purpose, request_id, metadata, created_at")
      .eq("source", "admin")
      .order("created_at", { ascending: false })
      .limit(query.limit);
    if (query.severity) dbQuery = dbQuery.eq("severity", query.severity);
    const events = await optionalQuery(dbQuery, [], warnings, "security_audit_events");

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.audit_log_viewed",
      resourceType: "security_audit_events",
      metadata: { limit: query.limit, severity: query.severity || "all", count: events.length }
    });

    return { ok: true, events, warnings };
  });

  app.post("/v1/hp-wallet/ledger", async (request) => {
    const ctx = await requireAuth(request, {
      roles: ["admin", "super_admin"],
      mfa: true,
      adminBoundary: true,
      action: "hp_wallet.ledger"
    });
    const body = z.object({
      userId: uuidSchema.optional(),
      amount: z.coerce.number().min(-100000).max(100000),
      reason: z.string().trim().min(2).max(180),
      reference: z.string().trim().max(120).optional()
    }).parse(request.body || {});

    const targetUserId = body.userId || ctx.user.id;
    const { error } = await supabaseAdmin
      .from("admin_notifications")
      .insert({
        user_id: targetUserId,
        kind: "hp_wallet_ledger",
        severity: "info",
        title: "HP Wallet işlem kaydı",
        message: body.reason,
        metadata: {
          amount: body.amount,
          reference: body.reference || "",
          requested_by: ctx.user.id
        }
      });
    if (error) throw error;
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "hp_wallet.ledger_recorded",
      resourceType: "user",
      resourceId: targetUserId,
      severity: "warning",
      metadata: { amount: body.amount, reference: body.reference || "" }
    });
    return { ok: true };
  });

  app.post("/v1/cron/reconcile-payments", async (request) => {
    if (!config.cronSecret || request.headers["x-cron-secret"] !== config.cronSecret) {
      await auditEvent({
        request,
        action: "cron.reconcile_denied",
        severity: "critical",
        metadata: { path: request.url.split("?")[0] }
      });
      const error = new Error("Cron yetkisi doğrulanamadı.");
      error.statusCode = 401;
      throw error;
    }

    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_no, payment_status, created_at")
      .in("payment_status", ["pending", "awaiting_payment"])
      .lt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .limit(100);
    if (error) throw error;

    return {
      ok: true,
      checked: data?.length || 0,
      staleOrders: data || []
    };
  });

  app.post("/v1/admin/legal/authority-requests", async (request, reply) => {
    const ctx = await requireAuth(request, {
      roles: ["admin", "super_admin"],
      mfa: true,
      adminBoundary: true,
      action: "admin.legal.authority_request.create"
    });
    const payload = authorityRequestSchema.parse(request.body || {});
    const { data, error } = await supabaseAdmin
      .from("authority_disclosure_requests")
      .insert({
        authority_type: payload.authority_type,
        reference_no: payload.reference_no,
        requester_name: payload.requester_name || null,
        requester_title: payload.requester_title || null,
        contact_channel: payload.contact_channel || null,
        legal_basis: payload.legal_basis,
        scope_summary: payload.scope_summary,
        due_at: payload.due_at || null,
        opened_by: ctx.user.id,
        metadata: payload.metadata
      })
      .select("*")
      .single();
    if (error) throw error;

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "admin.legal.authority_request_registered",
      resourceType: "authority_disclosure_request",
      resourceId: data.id,
      severity: "warning",
      source: "admin",
      purpose: "public_authority_request_management",
      evidenceTags: ["legal_request", payload.authority_type],
      metadata: {
        authority_type: payload.authority_type,
        reference_no: payload.reference_no,
        scope_summary: payload.scope_summary
      }
    });

    return reply.code(201).send({ ok: true, authorityRequest: data });
  });

  app.post("/v1/admin/legal/evidence-report", async (request, reply) => {
    const ctx = await requireAuth(request, {
      roles: ["admin", "super_admin"],
      mfa: true,
      adminBoundary: true,
      action: "admin.legal.evidence_report.generate"
    });
    const payload = evidenceReportSchema.parse(request.body || {});
    assertEvidenceWindow(payload.from, payload.to);

    if (payload.request_id) {
      const { data: authorityRequest, error: requestError } = await supabaseAdmin
        .from("authority_disclosure_requests")
        .select("id, status")
        .eq("id", payload.request_id)
        .maybeSingle();
      if (requestError) throw requestError;
      if (!authorityRequest) throw httpError("Resmi makam talep kaydı bulunamadı.", 404);
    }

    const events = await queryEvidenceEvents(payload);
    const filters = evidenceFilters(payload);
    const firstEvent = events[0] || null;
    const lastEvent = events[events.length - 1] || null;
    const generatedAt = new Date().toISOString();
    const exportPayload = {
      generated_at: generatedAt,
      generated_by: ctx.user.id,
      case_reference: payload.case_reference,
      legal_basis: payload.legal_basis,
      purpose: payload.purpose,
      request_id: payload.request_id || null,
      filters,
      events
    };
    const exportHash = sha256Json(exportPayload);

    const { data: exportRow, error: exportError } = await supabaseAdmin
      .from("authority_disclosure_exports")
      .insert({
        request_id: payload.request_id || null,
        case_reference: payload.case_reference,
        legal_basis: payload.legal_basis,
        purpose: payload.purpose,
        filters,
        event_count: events.length,
        first_event_at: firstEvent?.created_at || null,
        last_event_at: lastEvent?.created_at || null,
        first_event_hash: firstEvent?.event_hash || null,
        last_event_hash: lastEvent?.event_hash || null,
        export_hash: exportHash,
        generated_by: ctx.user.id,
        metadata: {
          generated_at: generatedAt,
          request_id: payload.request_id || null
        }
      })
      .select("*")
      .single();
    if (exportError) throw exportError;

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "admin.legal.evidence_report_generated",
      resourceType: "authority_disclosure_export",
      resourceId: exportRow.id,
      severity: "warning",
      source: "admin",
      purpose: "public_authority_disclosure",
      evidenceTags: ["legal_export", "chain_of_custody"],
      metadata: {
        case_reference: payload.case_reference,
        request_id: payload.request_id || null,
        event_count: events.length,
        export_hash: exportHash,
        filters
      }
    });

    return reply.code(201).send({
      ok: true,
      report: {
        ...exportPayload,
        chain_of_custody: {
          export_id: exportRow.id,
          export_hash: exportHash,
          event_count: events.length,
          first_event_id: firstEvent?.id || null,
          last_event_id: lastEvent?.id || null,
          first_event_hash: firstEvent?.event_hash || null,
          last_event_hash: lastEvent?.event_hash || null,
          hash_algorithm: "sha256",
          note: "event_hash alanları veritabanındaki append-only audit zincirinden gelir; export_hash bu rapor gövdesinin SHA-256 özetidir."
        }
      }
    });
  });

  app.get("/v1/admin/security/audit-events", async (request) => {
    const ctx = await requireAuth(request, {
      roles: ["admin", "super_admin"],
      mfa: true,
      adminBoundary: true,
      action: "admin.security.audit_events"
    });
    const query = auditQuerySchema.parse(request.query || {});
    let dbQuery = supabaseAdmin
      .from("security_audit_events")
      .select([
        "id",
        "actor_id",
        "actor_role",
        "action",
        "resource_type",
        "resource_id",
        "severity",
        "ip_address",
        "user_agent",
        "request_id",
        "source",
        "purpose",
        "location_basis",
        "geo_country",
        "geo_region",
        "geo_city",
        "geo_latitude",
        "geo_longitude",
        "geo_accuracy_m",
        "previous_hash",
        "event_hash",
        "evidence_tags",
        "metadata",
        "created_at"
      ].join(", "))
      .order("created_at", { ascending: false })
      .limit(query.limit);
    if (query.severity) dbQuery = dbQuery.eq("severity", query.severity);
    if (query.actorId) dbQuery = dbQuery.eq("actor_id", query.actorId);
    if (query.action) dbQuery = dbQuery.eq("action", query.action);
    if (query.resourceType) dbQuery = dbQuery.eq("resource_type", query.resourceType);
    if (query.resourceId) dbQuery = dbQuery.eq("resource_id", query.resourceId);
    if (query.from) dbQuery = dbQuery.gte("created_at", query.from);
    if (query.to) dbQuery = dbQuery.lte("created_at", query.to);

    const { data, error } = await dbQuery;
    if (error) throw error;
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "admin.security.audit_events_viewed",
      resourceType: "security_audit_events",
      evidenceTags: ["admin_review", "audit_view"],
      metadata: {
        limit: query.limit,
        severity: query.severity || "all",
        actor_id: query.actorId || null,
        action: query.action || null,
        resource_type: query.resourceType || null,
        resource_id: query.resourceId || null,
        from: query.from || null,
        to: query.to || null
      }
    });
    return { ok: true, events: data || [] };
  });

  app.get("/v1/admin/security/auto-defense", async (request) => {
    const ctx = await requireAuth(request, {
      roles: ["admin", "super_admin"],
      mfa: true,
      adminBoundary: true,
      action: "admin.security.auto_defense"
    });
    const status = autoDefenseStatus();
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "admin.security.auto_defense_viewed",
      resourceType: "auto_defense",
      metadata: {
        blocked_ip_count: status.blockedIpCount,
        recent_incident_count: status.recentIncidents.length
      }
    });
    return { ok: true, autoDefense: status };
  });
}
