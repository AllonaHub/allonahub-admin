import { createHash, createHmac } from "node:crypto";
import { z } from "zod";
import { config } from "../config.js";
import { autoDefenseStatus } from "../lib/auto-defense.js";
import { buildSocialMediaDailyPackage, SOCIAL_MEDIA_PUBLIC_DAILY_PLATFORMS } from "../lib/social-media-daily-package.js";
import { dispatchSocialMediaPost, socialMediaDispatchStatus, testSocialMediaConnector } from "../lib/social-media-dispatch.js";
import {
  acknowledgeSecurityAlarm,
  resolveSecurityAlarm,
  securityAlertStatus,
  sendSecurityAlert,
  updateRuntimeProtection
} from "../lib/security-alerts.js";
import {
  notifyPaymentProviderRefundCancellation,
  paymentProviderDispatchStatus
} from "../lib/payment-provider-dispatch.js";
import { decryptSecretValue, encryptSecretValue, secretVaultStatus } from "../lib/secret-vault.js";
import {
  auditEvent,
  authContext,
  hasMfa,
  hasRole,
  isAdmin,
  isSuperAdmin,
  isPartner,
  mfaRequiredForRole,
  supabaseAdmin,
  supabasePublic
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

const authTurnstileSchema = z.object({
  action: z.string().trim().min(2).max(32).regex(/^[a-z0-9_-]+$/i).optional().default("form_submit"),
  turnstileToken: z.string().trim().max(4096).optional().default("")
});

const authLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(512),
  turnstileToken: z.string().trim().max(4096).optional().default("")
});

const authProfileSchema = z.object({
  country: z.string().trim().max(90).optional().default(""),
  sector_key: z.string().trim().max(90).optional().default(""),
  sector_name: z.string().trim().max(140).optional().default(""),
  profession_key: z.string().trim().max(90).optional().default(""),
  profession_name: z.string().trim().max(140).optional().default(""),
  profession_title: z.string().trim().max(180).optional().default(""),
  module: z.string().trim().max(90).optional().default(""),
  greeting: z.string().trim().max(180).optional().default("")
}).optional().default({});

const authRegisterSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(512),
  full_name: z.string().trim().min(2).max(160),
  phone: phoneSchema,
  profile: authProfileSchema,
  turnstileToken: z.string().trim().max(4096).optional().default("")
});

const authForgotPasswordSchema = z.object({
  email: emailSchema,
  turnstileToken: z.string().trim().max(4096).optional().default("")
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
  order_status: z.enum(["preparing", "shipped", "delivered"]).optional(),
  tracking_number: z.string().trim().max(120).optional().nullable()
});

const partnerRefundCancellationDecisionSchema = z.object({
  action: z.enum(["approve_cancellation", "approve_refund", "reject_request"]),
  reason: z.string().trim().min(6).max(1200),
  note: z.string().trim().max(1200).optional().default("")
});

const INTEGRATION_PROVIDERS = [
  "generic_feed",
  "woocommerce",
  "shopify",
  "trendyol",
  "hepsiburada",
  "n11",
  "ciceksepeti",
  "pazarama",
  "custom_api"
];

const INTEGRATION_SECRET_DEFINITIONS = {
  generic_feed: [{ key: "FEED_URL", label: "Feed URL", required: true }],
  woocommerce: [
    { key: "API_BASE_URL", label: "Mağaza URL", required: true },
    { key: "CONSUMER_KEY", label: "Consumer key", required: true },
    { key: "CONSUMER_SECRET", label: "Consumer secret", required: true }
  ],
  shopify: [
    { key: "SHOP_DOMAIN", label: "Shop domain", required: true },
    { key: "ACCESS_TOKEN", label: "Admin API token", required: true }
  ],
  trendyol: [
    { key: "SUPPLIER_ID", label: "Supplier ID", required: true },
    { key: "API_KEY", label: "API key", required: true },
    { key: "API_SECRET", label: "API secret", required: true }
  ],
  hepsiburada: [
    { key: "MERCHANT_ID", label: "Merchant ID", required: true },
    { key: "API_KEY", label: "API key", required: true },
    { key: "API_SECRET", label: "API secret", required: true }
  ],
  n11: [
    { key: "APP_KEY", label: "App key", required: true },
    { key: "APP_SECRET", label: "App secret", required: true }
  ],
  ciceksepeti: [{ key: "API_KEY", label: "API key", required: true }],
  pazarama: [
    { key: "API_KEY", label: "API key", required: true },
    { key: "API_SECRET", label: "API secret", required: true }
  ],
  custom_api: [
    { key: "API_BASE_URL", label: "API URL", required: true },
    { key: "ACCESS_TOKEN", label: "Access token", required: false },
    { key: "WEBHOOK_SECRET", label: "Webhook secret", required: false }
  ]
};

const partnerIntegrationSchema = z.object({
  id: uuidSchema.optional(),
  provider: z.enum(INTEGRATION_PROVIDERS),
  display_name: z.string().trim().min(2).max(160),
  connection_mode: z.enum(["generic_feed", "native_api", "webhook", "manual"]).optional(),
  direction: z.enum(["inbound", "outbound", "bidirectional"]).optional().default("inbound"),
  status: z.enum(["draft", "active", "paused", "needs_attention", "disabled", "archived"]).optional().default("draft"),
  plan_tier: z.enum(["free", "premium", "enterprise"]).optional().default("free"),
  sync_mode: z.enum(["manual", "scheduled", "webhook"]).optional().default("manual"),
  sync_interval_minutes: z.coerce.number().int().min(15).max(10080).optional().default(1440),
  import_enabled: z.coerce.boolean().optional().default(true),
  export_enabled: z.coerce.boolean().optional().default(false),
  default_publish_status: z.enum(["draft", "active"]).optional().default("draft"),
  settings: z.record(z.unknown()).optional().default({}),
  secrets: z.record(z.string().min(1).max(16000)).optional().default({})
});

const partnerIntegrationSyncSchema = z.object({
  mode: z.enum(["preview", "apply"]).optional().default("preview"),
  direction: z.enum(["inbound", "outbound"]).optional().default("inbound"),
  trigger_source: z.enum(["manual", "cron", "webhook", "admin", "system"]).optional().default("manual"),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

const rewardsLedgerSchema = z.object({
  userId: uuidSchema.optional(),
  amount: z.coerce.number().min(-100000).max(100000),
  reason: z.string().trim().min(2).max(180),
  reference: z.string().trim().max(120).optional()
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

const SOCIAL_MEDIA_PLATFORMS = [
  "instagram",
  "facebook",
  "threads",
  "x",
  "linkedin",
  "tiktok",
  "youtube",
  "pinterest",
  "nsosyal",
  "telegram",
  "whatsapp",
  "google_business",
  "other"
];

const SOCIAL_MEDIA_DEFAULT_TARGET_PLATFORMS = [
  "instagram",
  "facebook",
  "threads",
  "x",
  "linkedin",
  "tiktok",
  "youtube",
  "pinterest",
  "nsosyal",
  "telegram",
  "whatsapp",
  "google_business"
];

const socialMediaPlatformSchema = z.enum(SOCIAL_MEDIA_PLATFORMS);
const socialMediaPostTypeSchema = z.enum(["feed", "story", "reel", "short", "video", "carousel", "pin", "article", "text"]);

const socialHashtagSchema = z.string().trim().max(60).transform((value) => {
  const clean = value.replace(/^#+/, "").replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 60);
  return clean ? `#${clean}` : "";
});

const socialMediaAccountSchema = z.object({
  platform: socialMediaPlatformSchema,
  display_name: z.string().trim().min(2).max(160),
  handle: z.string().trim().min(2).max(160).transform((value) => value.replace(/^@/, "").toLowerCase()),
  account_url: z.string().trim().max(500).optional().default(""),
  external_account_id: z.string().trim().max(220).optional().default(""),
  connector_mode: z.enum(["pending", "manual", "server_webhook", "native_api"]).optional().default("pending"),
  connection_status: z.enum(["not_connected", "connected", "needs_reauth", "disabled"]).optional().default("not_connected"),
  default_publish_mode: z.enum(["draft_after_approval", "scheduled_after_approval", "direct_after_approval"]).optional().default("draft_after_approval"),
  is_active: z.boolean().optional().default(true),
  platform_limits: z.record(z.unknown()).optional().default({}),
  metadata: z.record(z.unknown()).optional().default({})
});

const socialMediaCampaignSchema = z.object({
  title: z.string().trim().min(3).max(180),
  objective: z.enum(["growth", "traffic", "conversion", "retention", "partner_acquisition", "launch", "community"]).optional().default("growth"),
  module_key: z.string().trim().min(2).max(80).optional().default("ecosystem"),
  funnel_stage: z.enum(["awareness", "consideration", "conversion", "retention", "advocacy"]).optional().default("awareness"),
  audience: z.string().trim().min(2).max(240).optional().default("AllonaHub takipcileri"),
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional().default({})
});

const socialMediaPlatformOverrideSchema = z.object({
  caption: z.string().trim().min(1).max(4000).optional(),
  hashtags: z.array(socialHashtagSchema).max(20).optional(),
  post_type: socialMediaPostTypeSchema.optional(),
  scheduled_for: z.string().datetime().optional().nullable(),
  platform_payload: z.record(z.unknown()).optional().default({})
});

const socialMediaDraftSchema = z.object({
  campaign_id: uuidSchema.optional().nullable(),
  title: z.string().trim().min(3).max(180),
  content_theme: z.string().trim().min(2).max(220).optional().default("AllonaHub ecosystem growth"),
  hook: z.string().trim().max(400).optional().default(""),
  body: z.string().trim().min(3).max(4000),
  cta: z.string().trim().max(400).optional().default(""),
  landing_url: z.string().trim().max(700).optional().default(""),
  language: z.string().trim().min(2).max(12).optional().default("tr"),
  scheduled_for: z.string().datetime().optional().nullable(),
  target_platforms: z.array(socialMediaPlatformSchema).min(1).max(13).optional().default(SOCIAL_MEDIA_DEFAULT_TARGET_PLATFORMS),
  post_type: socialMediaPostTypeSchema.optional().default("feed"),
  hashtags: z.array(socialHashtagSchema).max(20).optional().default([]),
  media_asset_ids: z.array(uuidSchema).max(20).optional().default([]),
  visual_fingerprint: z.string().trim().max(220).optional().default(""),
  platform_payload: z.record(z.unknown()).optional().default({}),
  platform_overrides: z.record(socialMediaPlatformOverrideSchema).optional().default({}),
  metadata: z.record(z.unknown()).optional().default({})
});

const socialMediaDraftApprovalSchema = z.object({
  scheduled_for: z.string().datetime().optional().nullable(),
  publish_now: z.boolean().optional().default(false),
  approval_note: z.string().trim().max(900).optional().default("")
});

const socialMediaDailyPlanSchema = z.object({
  plan_date: z.string().date(),
  objective: z.string().trim().min(2).max(80).optional().default("growth"),
  summary: z.string().trim().max(1600).optional().default(""),
  target_platforms: z.array(socialMediaPlatformSchema).min(1).max(13).optional().default(SOCIAL_MEDIA_DEFAULT_TARGET_PLATFORMS),
  draft_ids: z.array(uuidSchema).max(40).optional().default([]),
  metadata: z.record(z.unknown()).optional().default({})
});

const httpsUrlOptionalSchema = z.string().trim().max(1200).optional().default("").refine((value) => (
  !value || /^https:\/\//i.test(value)
), "URL https:// ile başlamalı.");

const socialMediaDailyPackageSchema = z.object({
  plan_date: z.string().date().optional(),
  objective: z.string().trim().min(2).max(80).optional().default("growth"),
  landing_url: httpsUrlOptionalSchema.default("https://allonahub.com/"),
  target_platforms: z.array(socialMediaPlatformSchema).min(1).max(13).optional().default(SOCIAL_MEDIA_PUBLIC_DAILY_PLATFORMS),
  auto_submit: z.boolean().optional().default(true),
  generate_assets: z.boolean().optional().default(true),
  force_new: z.boolean().optional().default(false),
  variant: z.coerce.number().int().min(0).max(30).optional().default(0)
});

const socialMediaAssetPrepareSchema = z.object({
  limit: z.coerce.number().int().min(1).max(30).optional().default(10)
});

const socialMediaAssetCleanupSchema = z.object({
  retention_days: z.coerce.number().int().min(1).max(30).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(500),
  dry_run: z.boolean().optional().default(false)
});

const socialMediaPostMediaSchema = z.object({
  image_url: httpsUrlOptionalSchema,
  video_url: httpsUrlOptionalSchema,
  link: httpsUrlOptionalSchema,
  platform_payload: z.record(z.unknown()).optional().default({})
});

const socialMediaSecretSchema = z.object({
  account_id: uuidSchema.optional().nullable(),
  platform: socialMediaPlatformSchema,
  secret_key: z.string().trim().min(2).max(90).regex(/^[A-Z0-9_:-]+$/),
  secret_value: z.string().min(6).max(16000),
  expires_at: z.string().datetime().optional().nullable()
});

const socialMediaConnectionTestSchema = z.object({
  account_id: uuidSchema.optional().nullable(),
  platform: socialMediaPlatformSchema
});

const adminAuditLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
  severity: z.enum(["debug", "info", "warning", "critical"]).optional()
});

const riskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
const SUPER_ADMIN_RELEASE_APPROVAL_TYPES = [
  "publish_static",
  "deploy_backend",
  "apply_supabase_migration",
  "main_commit_push",
  "panel_change",
  "risk_override"
];
const SUPER_ADMIN_GRANTABLE_ROLES = ["customer", "partner", "courier", "admin", "super_admin"];
const BACKEND_BUILD_MARKER = "super-admin-actions-20260625-actions8";
const SUPER_ADMIN_WORK_QUEUE_SOURCE_MODULES = ["admin_ops", "avm", "food", "taxi", "social_media", "partner", "user_panel", "security", "legal", "release", "system", "other"];
const SUPER_ADMIN_WORK_QUEUE_STATUSES = ["open", "in_progress", "waiting_owner", "decided", "resolved", "cancelled"];
const SUPER_ADMIN_WORK_QUEUE_PRIORITIES = ["low", "normal", "high", "urgent"];
const SUPER_ADMIN_WORK_QUEUE_DECISIONS = ["approved", "rejected", "deferred", "escalated", "resolved"];

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

const superAdminReleaseApprovalSchema = z.object({
  approval_type: z.enum(SUPER_ADMIN_RELEASE_APPROVAL_TYPES),
  target_ref: z.string().trim().min(1).max(180).optional().default("main"),
  target_summary: z.string().trim().min(3).max(1200),
  risk_level: riskLevelSchema.optional().default("critical"),
  metadata: z.record(z.unknown()).optional().default({})
});

const superAdminReleaseApprovalDecisionSchema = z.object({
  reason: z.string().trim().min(6).max(1200)
});

const superAdminAlarmDecisionSchema = z.object({
  reason: z.string().trim().min(6).max(1200)
});

const superAdminAlarmProtectionSchema = z.object({
  action: z.enum(["clear", "lock_api", "lock_payments", "lock_orders", "unlock_api", "unlock_payments", "unlock_orders"]),
  reason: z.string().trim().min(6).max(1200)
});

const superAdminRefundCancellationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(120).optional().default(80),
  status: z.enum(["all", "cancelled", "refunded", "pending_signal"]).optional().default("all"),
  search: z.string().trim().max(120).optional().default("")
});

const superAdminRefundCancellationActionSchema = z.object({
  action: z.enum(["mark_review", "approve_cancellation", "approve_refund", "reject_request", "add_note"]),
  reason: z.string().trim().min(6).max(1200),
  note: z.string().trim().max(1200).optional().default("")
});

const superAdminPermissionUpdateSchema = z.object({
  role: z.enum(SUPER_ADMIN_GRANTABLE_ROLES).optional(),
  account_status: z.enum(["active", "passive", "suspended"]).optional(),
  risk_level: riskLevelSchema.optional(),
  flagged_suspicious: z.boolean().optional(),
  reason: z.string().trim().min(6).max(900)
}).refine((value) => (
  value.role !== undefined ||
  value.account_status !== undefined ||
  value.risk_level !== undefined ||
  value.flagged_suspicious !== undefined
), "En az bir yetki alanı güncellenmelidir.");

const superAdminOwnerRepairSchema = z.object({
  reason: z.string().trim().min(6).max(900).optional().default("Owner access mismatch repair")
});

const superAdminWorkQueueQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(80),
  status: z.enum(SUPER_ADMIN_WORK_QUEUE_STATUSES).optional(),
  source_module: z.enum(SUPER_ADMIN_WORK_QUEUE_SOURCE_MODULES).optional(),
  risk_level: riskLevelSchema.optional()
});

const superAdminWorkQueueUpdateSchema = z.object({
  status: z.enum(SUPER_ADMIN_WORK_QUEUE_STATUSES).optional(),
  priority: z.enum(SUPER_ADMIN_WORK_QUEUE_PRIORITIES).optional(),
  risk_level: riskLevelSchema.optional(),
  owner_user_id: uuidSchema.nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
  summary: z.string().trim().max(1800).optional(),
  reason: z.string().trim().min(6).max(900)
}).refine((value) => (
  value.status !== undefined ||
  value.priority !== undefined ||
  value.risk_level !== undefined ||
  value.owner_user_id !== undefined ||
  value.due_at !== undefined ||
  value.summary !== undefined
), "En az bir iş kuyruğu alanı güncellenmelidir.");

const superAdminWorkQueueDecisionSchema = z.object({
  decision: z.enum(SUPER_ADMIN_WORK_QUEUE_DECISIONS),
  reason: z.string().trim().min(6).max(1200),
  status: z.enum(["decided", "resolved", "waiting_owner"]).optional()
});

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
  { module_key: "mall", name: "AVM Dünyası", category: "commerce" },
  { module_key: "travel", name: "Seyahat & Turizm", category: "travel" },
  { module_key: "health", name: "Sağlık", category: "services" },
  { module_key: "maritime", name: "Denizcilik", category: "services" },
  { module_key: "legal", name: "Hukuk", category: "services" },
  { module_key: "consulting", name: "Danışmanlık", category: "services" },
  { module_key: "real_estate", name: "Gayrimenkul", category: "marketplace" },
  { module_key: "automotive", name: "Otomotiv", category: "marketplace" },
  { module_key: "education", name: "Eğitim", category: "services" },
  { module_key: "career", name: "Kariyer", category: "services" },
  { module_key: "finance", name: "Finans", category: "finance" },
  { module_key: "events", name: "Eğlence & Etkinlik", category: "services" },
  { module_key: "pet", name: "Evcil Hayvan", category: "services" },
  { module_key: "technology", name: "Teknoloji", category: "marketplace" },
  { module_key: "sports_fitness", name: "Spor & Fitness", category: "services" },
  { module_key: "beauty", name: "Güzellik & Kozmetik", category: "services" },
  { module_key: "insurance", name: "Sigorta", category: "finance" },
  { module_key: "courier", name: "Kurye & Teslimat", category: "logistics" },
  { module_key: "home_services", name: "Ev Hizmetleri", category: "services" },
  { module_key: "logistics", name: "Kargo & Lojistik", category: "logistics" },
  { module_key: "moving", name: "Nakliye", category: "logistics" },
  { module_key: "organization", name: "Organizasyon & Düğün", category: "services" },
  { module_key: "agriculture", name: "Allona Tarım", category: "services" },
  { module_key: "construction", name: "İnşaat & Yapı", category: "services" },
  { module_key: "engineering", name: "Mühendislik", category: "services" },
  { module_key: "trade", name: "Trade", category: "commerce" },
  { module_key: "hospitality", name: "Otelcilik", category: "travel" },
  { module_key: "other_services", name: "Diğer hizmetler", category: "services" }
];

const SUPER_ADMIN_CONTROL_LINKS = [
  { key: "operations", label: "Sipariş / Operasyon Yönetimi", view: "operations", target: "owner_view", risk_level: "high" },
  { key: "finance", label: "Finans / Ödeme Yönetimi", view: "finance", target: "owner_view", risk_level: "critical" },
  { key: "content", label: "Kupon / Kampanya / İçerik Yönetimi", view: "content", target: "owner_view", risk_level: "high" },
  { key: "users", label: "Kullanıcı Yönetimi", view: "users", target: "owner_view", risk_level: "high" },
  { key: "partners", label: "Partner Yönetimi", view: "partners", target: "owner_view", risk_level: "high" },
  { key: "permissions", label: "Yetki Merkezi", view: "permissions", target: "owner_view", risk_level: "critical" },
  { key: "modules", label: "Modül Yönetimi", view: "modules", target: "owner_view", risk_level: "high" },
  { key: "shop", label: "AllonaShop", href: "../pages/commerce/allonashop.html", target: "redirect", risk_level: "medium" },
  { key: "market", label: "Allona Market", href: "../pages/commerce/allonamarket.html", target: "redirect", risk_level: "medium" },
  { key: "food", label: "Allona Yemek", href: "../pages/commerce/allonayemek.html", target: "redirect", risk_level: "medium" },
  { key: "taxi", label: "Allona Taksi", href: "../pages/ecosystem/allonataksi.html", target: "redirect", risk_level: "medium" },
  { key: "legal_center", label: "Yasal Merkez", href: "../legal/index.html", target: "redirect", risk_level: "low" },
  { key: "security_policy", label: "Güvenlik Politikası", href: "../pages/legal/guvenlik-politikasi.html", target: "redirect", risk_level: "low" }
];

const SUPER_ADMIN_MODULE_INTELLIGENCE = [
  { module_key: "shop", name: "Allona Shop", href: "../pages/commerce/allonashop.html", category: "commerce", phase: "live", maturity: "transactional", operations: ["catalog", "orders", "payments", "coupons", "partner_commission"] },
  { module_key: "food", name: "Allona Yemek", href: "../pages/commerce/allonayemek.html", category: "commerce", phase: "live", maturity: "transactional", operations: ["restaurant_onboarding", "menu", "courier", "orders", "coupons"] },
  { module_key: "market", name: "Allona Market", href: "../pages/commerce/allonamarket.html", category: "commerce", phase: "live", maturity: "transactional", operations: ["store_inventory", "orders", "delivery", "campaigns"] },
  { module_key: "taxi", name: "Allona Taksi", href: "../pages/ecosystem/allonataksi.html", category: "transport", phase: "live", maturity: "operational", operations: ["driver_verification", "ride_dispatch", "map", "fare_controls", "incident_alerts"] },
  { module_key: "mall", name: "AVM Dünyası", href: "../pages/ecosystem/allonaavm.html", category: "commerce", phase: "current", maturity: "content", operations: ["tenant_applications", "campaigns", "store_directory"] },
  { module_key: "travel", name: "Seyahat & Turizm", href: "../pages/ecosystem/allonaseyahat.html", category: "travel", phase: "current", maturity: "content", operations: ["hotel_requests", "ticketing", "tour_applications"] },
  { module_key: "real_estate", name: "Gayrimenkul", href: "../pages/ecosystem/allonagayrimenkul.html", category: "marketplace", phase: "current", maturity: "lead", operations: ["listing_review", "broker_verification", "lead_routing"] },
  { module_key: "maritime", name: "Denizcilik", href: "../pages/ecosystem/allonadenizcilik.html", category: "services", phase: "current", maturity: "lead", operations: ["crew_applications", "document_review", "partner_verification"] },
  { module_key: "legal", name: "Hukuk", href: "../pages/ecosystem/allonahukuk.html", category: "services", phase: "current", maturity: "lead", operations: ["lawyer_verification", "case_intake", "document_review"] },
  { module_key: "consulting", name: "Danışmanlık", href: "../pages/ecosystem/allonadanismanlik.html", category: "services", phase: "current", maturity: "lead", operations: ["expert_verification", "appointment", "lead_routing"] },
  { module_key: "education", name: "Eğitim", href: "../pages/ecosystem/allonaegitim.html", category: "services", phase: "current", maturity: "lead", operations: ["course_review", "trainer_verification", "enrollment"] },
  { module_key: "career", name: "Kariyer", href: "../pages/career/allonakariyer.html", category: "services", phase: "current", maturity: "lead", operations: ["cv_access", "employer_applications", "payment_access"] },
  { module_key: "finance", name: "Finans", href: "../pages/ecosystem/allonafinans.html", category: "finance", phase: "current", maturity: "controlled", operations: ["payment_status", "payouts", "commission", "refunds"] },
  { module_key: "automotive", name: "Otomotiv", href: "../pages/ecosystem/allonaotomotiv.html", category: "marketplace", phase: "current", maturity: "lead", operations: ["listing_review", "dealer_verification", "lead_routing"] },
  { module_key: "events", name: "Eğlence & Etkinlik", href: "../pages/ecosystem/allonaeglence.html", category: "services", phase: "current", maturity: "lead", operations: ["event_listing", "vendor_review", "ticket_request"] },
  { module_key: "pet", name: "Evcil Hayvan", href: "../pages/ecosystem/allonaevcilhayvan.html", category: "services", phase: "current", maturity: "lead", operations: ["vet_verification", "appointment", "listing_review"] },
  { module_key: "technology", name: "Teknoloji", href: "../pages/ecosystem/allonateknoloji.html", category: "marketplace", phase: "current", maturity: "lead", operations: ["product_review", "service_partner", "support_request"] },
  { module_key: "sports_fitness", name: "Spor & Fitness", href: "../pages/ecosystem/allonasporfitness.html", category: "services", phase: "current", maturity: "lead", operations: ["trainer_verification", "membership_request", "appointment"] },
  { module_key: "beauty", name: "Güzellik & Kozmetik", href: "../pages/ecosystem/allonaguzellik.html", category: "services", phase: "current", maturity: "lead", operations: ["salon_verification", "appointment", "product_review"] },
  { module_key: "insurance", name: "Sigorta", href: "../pages/ecosystem/allonasigorta.html", category: "finance", phase: "current", maturity: "controlled", operations: ["quote_request", "agent_verification", "risk_review"] },
  { module_key: "courier", name: "Kurye & Teslimat", href: "../pages/ecosystem/allonakurye.html", category: "logistics", phase: "current", maturity: "operational", operations: ["courier_verification", "dispatch", "delivery_status"] },
  { module_key: "home_services", name: "Ev Hizmetleri", href: "../pages/ecosystem/allonaevhizmetleri.html", category: "services", phase: "current", maturity: "lead", operations: ["provider_verification", "service_request", "appointment"] },
  { module_key: "logistics", name: "Kargo & Lojistik", href: "../pages/ecosystem/allonalojistik.html", category: "logistics", phase: "current", maturity: "operational", operations: ["carrier_verification", "shipment_request", "warehouse"] },
  { module_key: "moving", name: "Nakliye", href: "../pages/ecosystem/allonanakliye.html", category: "logistics", phase: "current", maturity: "lead", operations: ["quote_request", "vehicle_verification", "job_status"] },
  { module_key: "organization", name: "Organizasyon & Düğün", href: "../pages/ecosystem/allonaorganizasyon.html", category: "services", phase: "current", maturity: "lead", operations: ["vendor_verification", "package_review", "booking_request"] },
  { module_key: "agriculture", name: "Allona Tarım", href: "../pages/ecosystem/allonatarim.html", category: "services", phase: "current", maturity: "lead", operations: ["supplier_verification", "product_review", "insurance_request"] },
  { module_key: "construction", name: "İnşaat & Yapı", href: "../pages/ecosystem/allonainsaat.html", category: "services", phase: "current", maturity: "lead", operations: ["contractor_verification", "project_request", "document_review"] },
  { module_key: "engineering", name: "Mühendislik", href: "../pages/ecosystem/allonamuhendislik.html", category: "services", phase: "current", maturity: "lead", operations: ["engineer_verification", "project_request", "document_review"] },
  { module_key: "trade", name: "Trade", href: "../pages/ecosystem/allonatrade.html", category: "commerce", phase: "current", maturity: "controlled", operations: ["import_export_request", "company_verification", "risk_review"] },
  { module_key: "hospitality", name: "Otelcilik", href: "../pages/ecosystem/allonaotelcilik.html", category: "travel", phase: "current", maturity: "lead", operations: ["property_verification", "booking_request", "partner_review"] },
  { module_key: "health", name: "Allona Sağlık", href: "../pages/ecosystem/allonasaglik.html", category: "services", phase: "current", maturity: "controlled", operations: ["provider_verification", "appointment", "document_review", "risk_review"] }
];

const SUPER_ADMIN_FUTURE_OPERATIONS = [
  { key: "ai_risk_prediction", label: "AI risk tahmin hattı", risk_level: "high", status: "planned" },
  { key: "module_content_approval", label: "Modül içerik onay yayını", risk_level: "medium", status: "ready_for_backend" },
  { key: "partner_document_vault", label: "Partner belge kasası", risk_level: "high", status: "planned" },
  { key: "finance_payout_gate", label: "Hakediş ve payout onay kapısı", risk_level: "critical", status: "ready_for_backend" },
  { key: "incident_war_room", label: "Kritik olay savaş odası", risk_level: "critical", status: "planned" }
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

function sha256Text(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
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

function parseAuthPayload(schema, body) {
  const parsed = schema.safeParse(body || {});
  if (!parsed.success) throw httpError("İstek doğrulanamadı.", 400);
  return parsed.data;
}

function authEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function authEmailHash(value) {
  return createHash("sha256").update(authEmail(value)).digest("hex");
}

function authEmailDomain(value) {
  return authEmail(value).split("@")[1] || "";
}

function resetPasswordRedirectUrl() {
  return new URL("/pages/account/reset-password.html", `${config.siteUrl}/`).href;
}

function publicAuthUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || "",
    email_confirmed_at: user.email_confirmed_at || null,
    created_at: user.created_at || null,
    user_metadata: {
      full_name: user.user_metadata?.full_name || "",
      phone: user.user_metadata?.phone || "",
      country: user.user_metadata?.country || "",
      sector_key: user.user_metadata?.sector_key || "",
      sector_name: user.user_metadata?.sector_name || "",
      profession_key: user.user_metadata?.profession_key || "",
      profession_name: user.user_metadata?.profession_name || "",
      profession_title: user.user_metadata?.profession_title || "",
      module: user.user_metadata?.module || ""
    }
  };
}

function compactRow(row) {
  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

function authUserMetadata(payload) {
  const profile = payload.profile || {};
  return compactRow({
    full_name: payload.full_name,
    phone: payload.phone,
    country: profile.country,
    sector_key: profile.sector_key,
    sector_name: profile.sector_name,
    profession_key: profile.profession_key,
    profession_name: profile.profession_name,
    profession_title: profile.profession_title,
    module: profile.module,
    greeting: profile.greeting
  });
}

async function upsertAuthProfile(user, payload, request) {
  if (!user?.id) return;
  const profile = payload.profile || {};
  const row = compactRow({
    id: user.id,
    email: user.email || payload.email,
    full_name: payload.full_name,
    phone: payload.phone,
    country: profile.country,
    sector_key: profile.sector_key,
    sector_name: profile.sector_name,
    profession_key: profile.profession_key,
    profession_name: profile.profession_name,
    profession_title: profile.profession_title,
    module: profile.module
  });

  if (Object.keys(row).length <= 1) return;

  const { error } = await supabaseAdmin
    .from("profiles")
    .upsert(row, { onConflict: "id" });

  if (!error) return;

  request?.log?.warn({ error: error.message, userId: user.id }, "Auth profile sync failed");
  await auditEvent({
    request,
    actorId: user.id,
    actorRole: "customer",
    action: "auth.profile_sync_failed",
    severity: looksLikeMissingSchema(error) ? "warning" : "critical",
    metadata: {
      code: error.code || null,
      message: error.message || null
    },
    evidenceTags: ["auth", "profile_sync"]
  });
}

async function verifyTurnstile(request, action, token) {
  const expectedAction = String(action || "form_submit").trim().slice(0, 32) || "form_submit";

  if (!config.turnstile.secretKey) {
    if (config.turnstile.strict) {
      throw httpError("Robot doğrulaması sunucuda yapılandırılmadı.", 503);
    }
    return { ok: true, skipped: true, action: expectedAction };
  }

  if (!token) {
    await auditEvent({
      request,
      action: "auth.turnstile_missing",
      severity: "warning",
      metadata: { action: expectedAction },
      evidenceTags: ["auth", "turnstile"]
    });
    throw httpError("Robot doğrulaması gerekli.", 400);
  }

  const body = new URLSearchParams();
  body.set("secret", config.turnstile.secretKey);
  body.set("response", token);
  const ip = clientIp(request);
  if (ip) body.set("remoteip", ip);

  let response;
  try {
    response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
  } catch (error) {
    request?.log?.warn({ error: error.message, action: expectedAction }, "Turnstile verification request failed");
    throw httpError("Robot doğrulaması şu an tamamlanamıyor.", 503);
  }

  const result = await response.json().catch(() => ({}));
  const tokenAction = String(result.action || "").trim();
  const actionMismatch = tokenAction && tokenAction !== expectedAction;

  if (!response.ok || !result.success || actionMismatch) {
    await auditEvent({
      request,
      action: "auth.turnstile_failed",
      severity: "warning",
      metadata: {
        action: expectedAction,
        token_action: tokenAction || null,
        errors: Array.isArray(result["error-codes"]) ? result["error-codes"].slice(0, 8) : []
      },
      evidenceTags: ["auth", "turnstile"]
    });
    throw httpError("Robot doğrulaması başarısız oldu.", 403);
  }

  return {
    ok: true,
    skipped: false,
    action: tokenAction || expectedAction
  };
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

function superAdminOwnerEmail(ctx) {
  return String(ctx?.user?.email || ctx?.profile?.email || "").trim().toLowerCase();
}

function envOwnerMatch(ctx) {
  const email = superAdminOwnerEmail(ctx);
  return {
    configured: Boolean(config.superAdmin.ownerUserIds.length || config.superAdmin.ownerEmails.length),
    matchedByUserId: Boolean(ctx?.user?.id && config.superAdmin.ownerUserIds.includes(ctx.user.id)),
    matchedByEmail: Boolean(email && config.superAdmin.ownerEmails.includes(email)),
    email
  };
}

async function querySuperAdminOwnerAccess(ctx) {
  const email = superAdminOwnerEmail(ctx);
  const status = {
    configured: false,
    matched: false,
    source: "",
    warning: null
  };

  const activeCount = await supabaseAdmin
    .from("super_admin_owner_access")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  if (activeCount.error) {
    if (looksLikeMissingSchema(activeCount.error)) {
      status.warning = schemaWarning("super_admin_owner_access", activeCount.error);
      return status;
    }
    throw activeCount.error;
  }

  status.configured = Number(activeCount.count || 0) > 0;
  if (!status.configured) return status;

  if (ctx?.user?.id) {
    const byUserId = await supabaseAdmin
      .from("super_admin_owner_access")
      .select("id")
      .eq("status", "active")
      .eq("user_id", ctx.user.id)
      .limit(1)
      .maybeSingle();
    if (byUserId.error && !looksLikeMissingSchema(byUserId.error)) throw byUserId.error;
    if (byUserId.data) {
      status.matched = true;
      status.source = "database_user_id";
      return status;
    }
  }

  if (email) {
    const byEmail = await supabaseAdmin
      .from("super_admin_owner_access")
      .select("id")
      .eq("status", "active")
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    if (byEmail.error && !looksLikeMissingSchema(byEmail.error)) throw byEmail.error;
    if (byEmail.data) {
      status.matched = true;
      status.source = "database_email";
    }
  }

  return status;
}

async function activeSuperAdminOwnerRows() {
  const { data, error } = await supabaseAdmin
    .from("super_admin_owner_access")
    .select("id, user_id, email, status, label, metadata, created_at, updated_at")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    if (looksLikeMissingSchema(error)) {
      throw httpError("super_admin_owner_access migration üretim Supabase projesine uygulanmalı.", 503);
    }
    throw error;
  }

  return data || [];
}

async function profileForOwnerRef(row) {
  if (row?.user_id) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role, account_status")
      .eq("id", row.user_id)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  const email = String(row?.email || "").trim().toLowerCase();
  if (!email) return null;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role, account_status")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function resolveSuperAdminOwner(ctx) {
  const env = envOwnerMatch(ctx);
  if (env.matchedByUserId || env.matchedByEmail) {
    return {
      configured: true,
      matched: true,
      source: env.matchedByUserId ? "env_user_id" : "env_email",
      user_id: ctx.user.id,
      email: env.email,
      warning: null
    };
  }

  const db = await querySuperAdminOwnerAccess(ctx);
  return {
    configured: env.configured || db.configured,
    matched: db.matched,
    source: db.source || "",
    user_id: ctx.user.id,
    email: env.email,
    warning: db.warning
  };
}

function ownerPreflightNextStep(owner) {
  if (owner.warning) {
    return "super_admin_owner_access migration üretim Supabase projesine uygulanmalı.";
  }
  if (!owner.configured) {
    return "Owner kilidi için active super_admin_owner_access satırı veya server env allowlist eklenmeli.";
  }
  if (!owner.matched) {
    return "Giriş yapılan owner e-postası veya Supabase user id active owner kaydıyla eşleşmeli.";
  }
  return "Owner kilidi doğrulandı; MFA ve rol adımlarını tamamlayıp paneli yeniden aç.";
}

async function superAdminOwnerPreflight(ctx) {
  const env = envOwnerMatch(ctx);
  const db = await querySuperAdminOwnerAccess(ctx);
  const matchedByEnv = env.matchedByUserId || env.matchedByEmail;
  const owner = {
    configured: env.configured || db.configured,
    matched: matchedByEnv || db.matched,
    source: matchedByEnv ? (env.matchedByUserId ? "env_user_id" : "env_email") : (db.source || ""),
    email: env.email || "",
    env: {
      configured: env.configured,
      matched_by_user_id: env.matchedByUserId,
      matched_by_email: env.matchedByEmail
    },
    database: {
      configured: db.configured,
      matched: db.matched,
      source: db.source || "",
      warning: db.warning || null
    },
    warning: db.warning || null
  };
  owner.next_step = ownerPreflightNextStep(owner);
  return owner;
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

async function requireOwnerCandidate(request, action) {
  const ctx = await requireAuth(request, {
    adminBoundary: true,
    action
  });

  if (!hasMfa(ctx)) {
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.owner_mfa_required",
      severity: "critical",
      source: "admin",
      purpose: "super_admin_owner_bootstrap",
      evidenceTags: ["super_admin", "owner_lock", "mfa_required"],
      metadata: { requested_action: action, aal: ctx.authenticatorAssuranceLevel }
    });
    throw httpError("Bu işlem için iki aşamalı doğrulama gerekli.", 403);
  }

  const owner = await resolveSuperAdminOwner(ctx);
  if (!owner.configured) {
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.owner_config_missing",
      severity: "critical",
      source: "admin",
      purpose: "super_admin_owner_lock",
      evidenceTags: ["super_admin", "owner_lock", "fail_closed"],
      metadata: {
        requested_action: action,
        owner_user_id: owner.user_id,
        owner_email_presented: owner.email || null,
        warning: owner.warning?.message || null
      }
    });
    throw httpError("Süper Admin owner kilidi yapılandırılmadı. SUPER_ADMIN_OWNER_USER_IDS veya SUPER_ADMIN_OWNER_EMAILS zorunlu.", 503);
  }

  if (!owner.matched) {
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.owner_denied",
      severity: "critical",
      source: "admin",
      purpose: "super_admin_owner_lock",
      evidenceTags: ["super_admin", "owner_lock", "access_denied"],
      metadata: {
        requested_action: action,
        user_id: owner.user_id,
        email: owner.email || null,
        configured_by_env: Boolean(config.superAdmin.ownerUserIds.length || config.superAdmin.ownerEmails.length)
      }
    });
    throw httpError("Bu panele sadece kayıtlı Super Admin sahibi erişebilir.", 403);
  }

  ctx.superAdminOwner = owner;
  return ctx;
}

async function requireSuperAdmin(request, action) {
  const ctx = await requireAuth(request, {
    roles: ["admin", "super_admin"],
    mfa: true,
    adminBoundary: true,
    action
  });

  const owner = await resolveSuperAdminOwner(ctx);
  if (!owner.configured) {
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.owner_config_missing",
      severity: "critical",
      source: "admin",
      purpose: "super_admin_owner_lock",
      evidenceTags: ["super_admin", "owner_lock", "fail_closed"],
      metadata: {
        requested_action: action,
        owner_user_id: owner.user_id,
        owner_email_presented: owner.email || null,
        warning: owner.warning?.message || null
      }
    });
    throw httpError("Süper Admin owner kilidi yapılandırılmadı. SUPER_ADMIN_OWNER_USER_IDS veya SUPER_ADMIN_OWNER_EMAILS zorunlu.", 503);
  }

  if (!owner.matched) {
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.owner_denied",
      severity: "critical",
      source: "admin",
      purpose: "super_admin_owner_lock",
      evidenceTags: ["super_admin", "owner_lock", "access_denied"],
      metadata: {
        requested_action: action,
        user_id: owner.user_id,
        email: owner.email || null,
        configured_by_env: Boolean(config.superAdmin.ownerUserIds.length || config.superAdmin.ownerEmails.length)
      }
    });
    throw httpError("Bu panele sadece kayıtlı Super Admin sahibi erişebilir.", 403);
  }

  if (!isSuperAdmin(ctx.profile)) {
    if (!hasRole(ctx.profile, "admin")) {
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

    ctx.superAdminOwnerBootstrap = true;
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.owner_bootstrap_access",
      severity: "critical",
      source: "admin",
      purpose: "super_admin_owner_bootstrap",
      evidenceTags: ["super_admin", "owner_lock", "bootstrap"],
      metadata: {
        requested_action: action,
        owner_source: owner.source || "unknown",
        role: ctx.profile.role
      }
    });
  }

  ctx.superAdminOwner = owner;
  return ctx;
}

function looksLikeMissingSchema(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""} ${error?.code || ""}`;
  return /does not exist|schema cache|PGRST20|PGRST30|PGRST202|42P01|42703|42883|relation .* not found|column .* not found|function .* not found/i.test(message);
}

function looksLikeSuperAdminPermissionGate(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""} ${error?.code || ""}`;
  return /Only the Super Admin owner|Super Admin role requires active owner_access|is_super_admin_owner|owner can update permissions|owner_access|permission denied|not authorized|not allowed|P0001|42501/i.test(message);
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

function superAdminAuditSeverity(riskLevel) {
  if (riskLevel === "critical") return "critical";
  if (riskLevel === "high") return "warning";
  return "info";
}

function releaseApprovalPublic(row) {
  return {
    id: row.id,
    approval_type: row.approval_type,
    target_ref: row.target_ref,
    target_summary: row.target_summary,
    status: row.status,
    risk_level: row.risk_level,
    requested_by: row.requested_by,
    approved_by: row.approved_by,
    approved_at: row.approved_at,
    dispatched_at: row.dispatched_at,
    webhook_status: row.webhook_status,
    webhook_response: row.webhook_response || {},
    metadata: row.metadata || {},
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function moduleOperationMapPublic(moduleRows = []) {
  const byKey = new Map((moduleRows || []).map((item) => [item.module_key, item]));
  return SUPER_ADMIN_MODULE_INTELLIGENCE.map((item, index) => {
    const configured = byKey.get(item.module_key);
    return {
      ...item,
      sort_order: configured?.sort_order ?? (index + 1) * 10,
      is_active: configured?.is_active ?? true,
      is_visible: configured?.is_visible ?? true,
      commission_rate: configured?.commission_rate ?? 0.12,
      application_status: configured?.application_status || "open",
      content_config: configured?.content_config || {},
      source: configured ? "database" : "homepage_map"
    };
  });
}

function permissionChangePublic(row) {
  return {
    id: row.id,
    target_user_id: row.target_user_id,
    actor_id: row.actor_id,
    action: row.action,
    old_role: row.old_role,
    new_role: row.new_role,
    old_account_status: row.old_account_status,
    new_account_status: row.new_account_status,
    old_risk_level: row.old_risk_level,
    new_risk_level: row.new_risk_level,
    reason: row.reason || "",
    risk_level: row.risk_level,
    metadata: row.metadata || {},
    created_at: row.created_at
  };
}

async function bootstrapOwnerSelfSuperAdminPermission({ before, body, ctx }) {
  if (before.id !== ctx.user.id || body.role !== "super_admin") {
    throw httpError("Owner bootstrap sadece kendi hesabını Super Admin yapmak için kullanılabilir.", 403);
  }

  const updatePayload = {
    role: "super_admin",
    account_status: body.account_status || "active",
    risk_level: body.risk_level || before.risk_level || "low",
    flagged_suspicious: body.flagged_suspicious ?? before.flagged_suspicious ?? false,
    last_admin_note: body.reason,
    updated_at: new Date().toISOString()
  };

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("profiles")
    .update(updatePayload)
    .eq("id", before.id)
    .select("*")
    .single();
  if (updateError) throw updateError;

  const changeRisk = "critical";
  const { data: change, error: changeError } = await supabaseAdmin
    .from("super_admin_permission_changes")
    .insert({
      target_user_id: before.id,
      actor_id: ctx.user.id,
      action: "owner_bootstrap_super_admin",
      old_role: before.role || "admin",
      new_role: updated.role || "super_admin",
      old_account_status: before.account_status || "active",
      new_account_status: updated.account_status || "active",
      old_risk_level: before.risk_level || "low",
      new_risk_level: updated.risk_level || "low",
      reason: body.reason,
      risk_level: changeRisk,
      metadata: {
        target_email: updated.email || before.email || null,
        owner_source: ctx.superAdminOwner?.source || "unknown",
        bootstrap: true
      }
    })
    .select("*")
    .single();
  if (changeError) {
    if (looksLikeMissingSchema(changeError)) {
      throw httpError("super_admin_permission_changes migration henüz uygulanmamış.", 503);
    }
    throw changeError;
  }

  return { profile: updated, change };
}

async function serviceRoleUpdateProfilePermission({ before, body, ctx, fallbackReason = "rpc_missing" }) {
  const updatePayload = compactRow({
    role: body.role,
    account_status: body.account_status,
    risk_level: body.risk_level,
    flagged_suspicious: body.flagged_suspicious,
    last_admin_note: body.reason,
    updated_at: new Date().toISOString()
  });

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("profiles")
    .update(updatePayload)
    .eq("id", before.id)
    .select("*")
    .single();
  if (updateError) throw updateError;

  const { data: persisted, error: verifyError } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", before.id)
    .single();
  if (verifyError) throw verifyError;

  const mismatches = Object.entries({
    role: body.role,
    account_status: body.account_status,
    risk_level: body.risk_level,
    flagged_suspicious: body.flagged_suspicious
  }).filter(([field, expected]) => (
    expected !== undefined && persisted && persisted[field] !== expected
  ));
  if (mismatches.length) {
    throw httpError(`Yetki güncellemesi veritabanında doğrulanamadı: ${mismatches.map(([field]) => field).join(", ")}`, 502);
  }

  const changeRisk = body.role === "super_admin" || body.account_status === "suspended"
    ? "critical"
    : (body.role === "admin" || body.risk_level === "high" || body.risk_level === "critical" ? "high" : "medium");

  const { data: changeRow, error: changeError } = await supabaseAdmin
    .from("super_admin_permission_changes")
    .insert({
      target_user_id: before.id,
      actor_id: ctx.user.id,
      action: "owner_service_role_permission_update",
      old_role: before.role || "customer",
      new_role: persisted.role || updated.role || before.role || "customer",
      old_account_status: before.account_status || "active",
      new_account_status: persisted.account_status || updated.account_status || before.account_status || "active",
      old_risk_level: before.risk_level || "low",
      new_risk_level: persisted.risk_level || updated.risk_level || before.risk_level || "low",
      reason: body.reason,
      risk_level: changeRisk,
      metadata: {
        target_email: persisted.email || updated.email || before.email || null,
        owner_source: ctx.superAdminOwner?.source || "unknown",
        fallback: "service_role_after_require_super_admin",
        fallback_reason: fallbackReason
      }
    })
    .select("*")
    .single();

  if (changeError && !looksLikeMissingSchema(changeError)) throw changeError;

  return { profile: persisted || updated, change: changeError ? null : changeRow };
}

async function ownerSelfBootstrapSuperAdmin({ ctx, request }) {
  const reason = "Owner self bootstrap from Super Admin entry gate";
  const { data: before, error: beforeError } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", ctx.user.id)
    .maybeSingle();
  if (beforeError) throw beforeError;

  const nowIso = new Date().toISOString();
  const commonPayload = compactRow({
    email: ctx.user.email || before?.email || "",
    full_name: before?.full_name || ctx.user.user_metadata?.full_name || "",
    role: "super_admin",
    account_status: "active",
    risk_level: before?.risk_level || "low",
    flagged_suspicious: before?.flagged_suspicious ?? false,
    last_admin_note: reason,
    updated_at: nowIso
  });
  const fallbackPayload = compactRow({
    email: ctx.user.email || before?.email || "",
    full_name: before?.full_name || ctx.user.user_metadata?.full_name || "",
    role: "super_admin",
    updated_at: nowIso
  });

  async function writeProfile(payload) {
    if (before) {
      return supabaseAdmin
        .from("profiles")
        .update(payload)
        .eq("id", ctx.user.id)
        .select("*")
        .single();
    }
    return supabaseAdmin
      .from("profiles")
      .upsert({ id: ctx.user.id, ...payload }, { onConflict: "id" })
      .select("*")
      .single();
  }

  let { data: updated, error: updateError } = await writeProfile(commonPayload);
  if (updateError && looksLikeMissingSchema(updateError)) {
    const retry = await writeProfile(fallbackPayload);
    updated = retry.data;
    updateError = retry.error;
  }
  if (updateError) throw updateError;

  let change = null;
  const { data: changeRow, error: changeError } = await supabaseAdmin
    .from("super_admin_permission_changes")
    .insert({
      target_user_id: ctx.user.id,
      actor_id: ctx.user.id,
      action: "owner_self_bootstrap_super_admin",
      old_role: before?.role || "customer",
      new_role: updated.role || "super_admin",
      old_account_status: before?.account_status || "active",
      new_account_status: updated.account_status || "active",
      old_risk_level: before?.risk_level || "low",
      new_risk_level: updated.risk_level || "low",
      reason,
      risk_level: "critical",
      metadata: {
        target_email: updated.email || ctx.user.email || null,
        owner_source: ctx.superAdminOwner?.source || "unknown",
        bootstrap: true,
        self_service: true
      }
    })
    .select("*")
    .single();
  if (!changeError) {
    change = changeRow;
  } else if (!looksLikeMissingSchema(changeError)) {
    throw changeError;
  }

  await auditEvent({
    request,
    actorId: ctx.user.id,
    actorRole: before?.role || "customer",
    action: "super_admin.owner_self_bootstrap_completed",
    severity: "critical",
    source: "admin",
    resourceType: "profiles",
    resourceId: ctx.user.id,
    purpose: "super_admin_owner_bootstrap",
    evidenceTags: ["super_admin", "owner_lock", "bootstrap", "role_change"],
    metadata: {
      old_role: before?.role || "customer",
      new_role: updated.role || "super_admin",
      owner_source: ctx.superAdminOwner?.source || "unknown",
      permission_change_logged: Boolean(change)
    }
  });

  return { profile: updated, change };
}

async function repairOwnerAccessForCurrentAdmin({ ctx, request, reason }) {
  const email = superAdminOwnerEmail(ctx);
  if (!email) {
    throw httpError("Owner eşleştirme için oturum e-postası bulunamadı.", 400);
  }

  const owner = await superAdminOwnerPreflight(ctx);
  if (owner.warning) {
    throw httpError(owner.warning.message || "Owner tablosu doğrulanamadı.", 503);
  }
  if (owner.matched) {
    return {
      repaired: false,
      owner,
      message: "Owner kaydı zaten bu oturumla eşleşiyor."
    };
  }
  if (!owner.database.configured) {
    throw httpError("Aktif Supabase owner kaydı bulunamadı; önce owner satırı oluşturulmalı.", 409);
  }

  const rows = await activeSuperAdminOwnerRows();
  if (rows.length !== 1) {
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.owner_access_repair_blocked",
      severity: "critical",
      source: "admin",
      purpose: "super_admin_owner_repair",
      evidenceTags: ["super_admin", "owner_lock", "repair_blocked"],
      metadata: {
        reason: "active_owner_row_count",
        active_owner_rows: rows.length
      }
    });
    throw httpError("Owner eşleştirme için tam olarak bir active owner satırı olmalı. Çoklu kayıt varsa Supabase üzerinden manuel onay gerekli.", 409);
  }

  const activeRow = rows[0];
  const existingProfile = await profileForOwnerRef(activeRow);
  if (existingProfile && existingProfile.id !== ctx.user.id) {
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.owner_access_repair_blocked",
      severity: "critical",
      source: "admin",
      purpose: "super_admin_owner_repair",
      resourceType: "super_admin_owner_access",
      resourceId: activeRow.id,
      evidenceTags: ["super_admin", "owner_lock", "repair_blocked"],
      metadata: {
        reason: "owner_row_points_to_existing_profile",
        owner_profile_id: existingProfile.id,
        owner_profile_role: existingProfile.role || null
      }
    });
    throw httpError("Aktif owner kaydı başka geçerli profile bağlı. Güvenlik için panelden otomatik devralma kapatıldı; Supabase SQL onayı gerekli.", 409);
  }

  const previousMetadata = activeRow.metadata && typeof activeRow.metadata === "object" ? activeRow.metadata : {};
  const repairMetadata = {
    ...previousMetadata,
    last_owner_repair: {
      repaired_at: new Date().toISOString(),
      repaired_by: ctx.user.id,
      repaired_email: email,
      previous_user_id: activeRow.user_id || null,
      previous_email: activeRow.email || null,
      reason
    }
  };

  const { data: repairedRow, error: repairError } = await supabaseAdmin
    .from("super_admin_owner_access")
    .update({
      user_id: ctx.user.id,
      email,
      status: "active",
      label: activeRow.label || "AllonaHub primary owner",
      metadata: repairMetadata,
      updated_at: new Date().toISOString()
    })
    .eq("id", activeRow.id)
    .select("id, user_id, email, status, label, metadata, created_at, updated_at")
    .single();

  if (repairError) throw repairError;

  ctx.superAdminOwner = {
    configured: true,
    matched: true,
    source: "database_repair",
    user_id: ctx.user.id,
    email,
    warning: null
  };

  let bootstrap = null;
  try {
    bootstrap = await ownerSelfBootstrapSuperAdmin({ ctx, request });
  } catch (error) {
    request?.log?.warn({ error: error.message, userId: ctx.user.id }, "Owner repair completed but self bootstrap failed");
  }

  await auditEvent({
    request,
    actorId: ctx.user.id,
    actorRole: ctx.profile.role,
    action: "super_admin.owner_access_repaired",
    severity: "critical",
    source: "admin",
    purpose: "super_admin_owner_repair",
    resourceType: "super_admin_owner_access",
    resourceId: repairedRow.id,
    evidenceTags: ["super_admin", "owner_lock", "repair", "break_glass"],
    metadata: {
      previous_user_id: activeRow.user_id || null,
      previous_email: activeRow.email || null,
      new_user_id: ctx.user.id,
      new_email: email,
      role_before: ctx.profile.role,
      bootstrap_completed: Boolean(bootstrap?.profile?.role === "super_admin"),
      reason
    }
  });

  return {
    repaired: true,
    owner,
    row: repairedRow,
    bootstrap
  };
}

async function isRegisteredSuperAdminOwnerCandidate(userId, email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (userId && config.superAdmin.ownerUserIds.includes(userId)) return true;
  if (normalizedEmail && config.superAdmin.ownerEmails.includes(normalizedEmail)) return true;

  const activeCount = await supabaseAdmin
    .from("super_admin_owner_access")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .or([
      userId ? `user_id.eq.${userId}` : "",
      normalizedEmail ? `email.eq.${normalizedEmail}` : ""
    ].filter(Boolean).join(","));
  if (activeCount.error) {
    if (looksLikeMissingSchema(activeCount.error)) return false;
    throw activeCount.error;
  }
  return Number(activeCount.count || 0) > 0;
}

async function dispatchSuperAdminReleaseApproval(approval, request) {
  if (!config.superAdmin.gitOpsEnabled) {
    return {
      status: "approved",
      dispatched: false,
      webhook_status: null,
      webhook_response: {
        code: "GITOPS_DISABLED",
        message: "Güvenli yayın webhook'u kapalı; onay kaydı audit altında bekliyor."
      }
    };
  }

  if (!config.superAdmin.releaseWebhookUrl || !config.superAdmin.releaseWebhookSecret) {
    return {
      status: "approved",
      dispatched: false,
      webhook_status: null,
      webhook_response: {
        code: "GITOPS_NOT_CONFIGURED",
        message: "Yayın onayı audit log'a kaydedildi; güvenli deploy webhook'u henüz yapılandırılmadığı için manuel deploy bekliyor."
      }
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.superAdmin.releaseWebhookTimeoutMs);
  try {
    const response = await fetch(config.superAdmin.releaseWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Allona-Super-Admin-Secret": config.superAdmin.releaseWebhookSecret
      },
      signal: controller.signal,
      body: JSON.stringify({
        approval_id: approval.id,
        approval_type: approval.approval_type,
        target_ref: approval.target_ref,
        target_summary: approval.target_summary,
        risk_level: approval.risk_level,
        metadata: approval.metadata || {}
      })
    });
    const text = await response.text().catch(() => "");
    return {
      status: response.ok ? "dispatched" : "failed",
      dispatched: response.ok,
      webhook_status: response.status,
      webhook_response: {
        ok: response.ok,
        body: text.slice(0, 1800)
      }
    };
  } catch (error) {
    request.log.warn({ error: error.message, approvalId: approval.id }, "Super Admin release webhook failed");
    return {
      status: "failed",
      dispatched: false,
      webhook_status: null,
      webhook_response: {
        code: "WEBHOOK_ERROR",
        message: error.name === "AbortError" ? "Yayın webhook zaman aşımına uğradı." : error.message
      }
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function tableHealth(label, table) {
  const result = await runAdminQuery(
    label,
    supabaseAdmin.from(table).select("id", { count: "exact", head: true }),
    null
  );
  return {
    label,
    table,
    ok: !result.warning,
    count: result.count || 0,
    warning: result.warning || null
  };
}

async function superAdminActionHealth(ctx, request) {
  const checks = await Promise.all([
    tableHealth("profiles_write_target", "profiles"),
    tableHealth("partner_applications_write_target", "partner_applications"),
    tableHealth("super_admin_settings_write_target", "super_admin_settings"),
    tableHealth("platform_modules_write_target", "platform_modules"),
    tableHealth("super_admin_work_queue_write_target", "super_admin_work_queue"),
    tableHealth("super_admin_release_approvals_write_target", "super_admin_release_approvals"),
    tableHealth("security_audit_events_audit_target", "security_audit_events"),
    tableHealth("super_admin_permission_changes_audit_target", "super_admin_permission_changes")
  ]);
  const warnings = checks.filter((item) => !item.ok).map((item) => item.warning).filter(Boolean);
  const gitopsReady = Boolean(config.superAdmin.gitOpsEnabled && config.superAdmin.releaseWebhookUrl && config.superAdmin.releaseWebhookSecret);

  await auditEvent({
    request,
    actorId: ctx.user.id,
    actorRole: ctx.profile.role,
    action: "super_admin.action_health_checked",
    source: "admin",
    resourceType: "super_admin_action_health",
    severity: warnings.length || !gitopsReady ? "warning" : "info",
    metadata: {
      warning_count: warnings.length,
      gitops_enabled: config.superAdmin.gitOpsEnabled,
      release_webhook_configured: Boolean(config.superAdmin.releaseWebhookUrl && config.superAdmin.releaseWebhookSecret),
      service_role_permission_fallback: true,
      service_role_permission_fallback_scope: "after_require_super_admin_owner_mfa"
    }
  });

  return {
    ok: true,
    actions: {
      navigation: { ok: true, mode: "frontend_event_delegation" },
      users_update: { ok: checks.find((item) => item.table === "profiles")?.ok === true, endpoint: "PATCH /v1/control-center/users/:userId" },
      permissions_update: {
        ok: checks.find((item) => item.table === "profiles")?.ok === true,
        endpoint: "PATCH /v1/control-center/permissions/:userId",
        service_role_fallback: true,
        fallback_scope: "after_require_super_admin_owner_mfa"
      },
      partner_decision: { ok: checks.find((item) => item.table === "partner_applications")?.ok === true, endpoint: "PATCH /v1/control-center/partner-applications/:applicationId" },
      settings_update: { ok: checks.find((item) => item.table === "super_admin_settings")?.ok === true, endpoint: "PATCH /v1/control-center/settings/:settingKey" },
      modules_update: { ok: checks.find((item) => item.table === "platform_modules")?.ok === true, endpoint: "PATCH /v1/control-center/modules/:moduleKey" },
      work_queue: {
        ok: checks.find((item) => item.table === "super_admin_work_queue")?.ok === true,
        endpoint: "GET/PATCH/POST /v1/control-center/work-queue"
      },
      release_approval: {
        ok: checks.find((item) => item.table === "super_admin_release_approvals")?.ok === true,
        endpoint: "POST /v1/control-center/release-approvals",
        dispatch_ready: gitopsReady
      },
      audit_log: { ok: checks.find((item) => item.table === "security_audit_events")?.ok === true, endpoint: "GET /v1/control-center/audit-log" }
    },
    gitops: {
      enabled: config.superAdmin.gitOpsEnabled,
      release_webhook_configured: Boolean(config.superAdmin.releaseWebhookUrl && config.superAdmin.releaseWebhookSecret),
      dispatch_ready: gitopsReady,
      message: gitopsReady
        ? "Yayın onayı güvenli webhook'a gönderilir."
        : "Yayın onayı audit kaydı oluşturur; gerçek deploy için SUPER_ADMIN_GITOPS_ENABLED, SUPER_ADMIN_RELEASE_WEBHOOK_URL ve SUPER_ADMIN_RELEASE_WEBHOOK_SECRET gerekir."
    },
    checks,
    schema_warnings: warnings
  };
}

async function requireOpsAdmin(request, action) {
  const ctx = await requireAuth(request, {
    roles: ["admin", "super_admin"],
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

const SOCIAL_STOP_WORDS = new Set([
  "ve",
  "ile",
  "icin",
  "için",
  "bir",
  "bu",
  "da",
  "de",
  "mi",
  "mu",
  "the",
  "and",
  "for",
  "allona",
  "allonahub",
  "hub",
  "hemen",
  "bugun",
  "bugün"
]);

function normalizeSocialText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .toLocaleLowerCase("tr-TR")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s#@_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function socialContentHash(payload) {
  return sha256Text([
    payload.language || "tr",
    normalizeSocialText(payload.title),
    normalizeSocialText(payload.hook),
    normalizeSocialText(payload.body),
    normalizeSocialText(payload.cta),
    String(payload.landing_url || "").trim().toLowerCase()
  ].join("|"));
}

function socialSemanticHash(payload) {
  const tokens = normalizeSocialText([
    payload.content_theme,
    payload.title,
    payload.hook,
    payload.body,
    payload.cta,
    payload.landing_url
  ].join(" "))
    .split(" ")
    .map((token) => token.replace(/^#+|^@+/, ""))
    .filter((token) => token.length > 2 && !SOCIAL_STOP_WORDS.has(token))
    .slice(0, 120);
  const uniqueSorted = [...new Set(tokens)].sort().slice(0, 80);
  return sha256Text(uniqueSorted.join("|"));
}

function socialVisualHash(payload) {
  const visual = String(payload.visual_fingerprint || "").trim();
  if (visual) return sha256Text(normalizeSocialText(visual));
  const assetIds = (payload.media_asset_ids || []).filter(Boolean).sort();
  if (assetIds.length) return sha256Text(assetIds.join("|"));
  return null;
}

function compactHash(value) {
  return String(value || "").slice(0, 12);
}

function platformPostType(platform, fallback) {
  const defaults = {
    instagram: "reel",
    facebook: "feed",
    threads: "text",
    x: "text",
    linkedin: "article",
    tiktok: "short",
    youtube: "short",
    pinterest: "pin",
    nsosyal: "text",
    telegram: "text",
    whatsapp: "text",
    google_business: "feed"
  };
  return defaults[platform] || fallback || "feed";
}

function normalizeHashtags(tags) {
  return [...new Set((tags || []).map((tag) => String(tag || "").trim()).filter(Boolean))].slice(0, 20);
}

function todayInSocialTimezone() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.socialMedia.defaultTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function socialWebhookSignature(secret, body) {
  if (!secret) return "";
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

const SOCIAL_CONNECTOR_SECRET_DEFINITIONS = Object.freeze({
  instagram: [
    { key: "IG_USER_ID", label: "Instagram Business/Creator ID", required: true },
    { key: "ACCESS_TOKEN", label: "Instagram content publishing access token", required: true }
  ],
  facebook: [
    { key: "PAGE_ID", label: "Facebook Page ID", required: true },
    { key: "PAGE_ACCESS_TOKEN", label: "Facebook Page access token", required: true }
  ],
  threads: [
    { key: "THREADS_USER_ID", label: "Threads user ID", required: true },
    { key: "ACCESS_TOKEN", label: "Threads publishing access token", required: true }
  ],
  x: [
    { key: "ACCESS_TOKEN", label: "X OAuth user access token", required: true },
    { key: "REFRESH_TOKEN", label: "X OAuth refresh token", required: false },
    { key: "CLIENT_ID", label: "X OAuth client ID", required: false },
    { key: "CLIENT_SECRET", label: "X OAuth client secret", required: false }
  ],
  linkedin: [
    { key: "ORGANIZATION_URN", label: "LinkedIn organization URN", required: true },
    { key: "ACCESS_TOKEN", label: "LinkedIn posting access token", required: true }
  ],
  tiktok: [
    { key: "OPEN_ID", label: "TikTok creator open ID", required: false },
    { key: "ACCESS_TOKEN", label: "TikTok Content Posting access token", required: true },
    { key: "REFRESH_TOKEN", label: "TikTok refresh token", required: false }
  ],
  youtube: [
    { key: "CHANNEL_ID", label: "YouTube channel ID", required: true },
    { key: "CLIENT_ID", label: "Google OAuth client ID", required: true },
    { key: "CLIENT_SECRET", label: "Google OAuth client secret", required: true },
    { key: "REFRESH_TOKEN", label: "YouTube OAuth refresh token", required: true },
    { key: "ACCESS_TOKEN", label: "Temporary YouTube access token", required: false }
  ],
  pinterest: [
    { key: "BOARD_ID", label: "Pinterest board ID", required: true },
    { key: "ACCESS_TOKEN", label: "Pinterest pins access token", required: true }
  ],
  nsosyal: [
    { key: "DISPATCH_WEBHOOK_URL", label: "Nsosyal manual/dispatcher webhook URL", required: true },
    { key: "DISPATCH_WEBHOOK_SECRET", label: "Nsosyal dispatcher secret", required: false }
  ],
  telegram: [
    { key: "BOT_TOKEN", label: "Telegram bot token", required: true },
    { key: "CHANNEL_ID", label: "Telegram channel or chat ID", required: true }
  ],
  whatsapp: [
    { key: "PHONE_NUMBER_ID", label: "WhatsApp Business phone number ID", required: true },
    { key: "ACCESS_TOKEN", label: "WhatsApp Business access token", required: true },
    { key: "DEFAULT_RECIPIENT_PHONE", label: "Default approved recipient phone", required: false },
    { key: "DEFAULT_TEMPLATE_NAME", label: "Default WhatsApp template name", required: false }
  ],
  google_business: [
    { key: "ACCOUNT_ID", label: "Google Business Profile account ID", required: true },
    { key: "LOCATION_ID", label: "Google Business Profile location ID", required: true },
    { key: "CLIENT_ID", label: "Google OAuth client ID", required: true },
    { key: "CLIENT_SECRET", label: "Google OAuth client secret", required: true },
    { key: "REFRESH_TOKEN", label: "Google Business refresh token", required: true },
    { key: "ACCESS_TOKEN", label: "Temporary Google Business access token", required: false }
  ]
});

function secretContext({ platform, accountId, secretKey }) {
  return `${platform}:${accountId || "global"}:${secretKey}`;
}

function secretDefinitionsFor(platform) {
  return SOCIAL_CONNECTOR_SECRET_DEFINITIONS[platform] || [];
}

function findSecretDefinition(platform, secretKey) {
  return secretDefinitionsFor(platform).find((item) => item.key === secretKey);
}

function connectionSecretStatuses(secretRows) {
  const rows = secretRows || [];
  return Object.fromEntries(Object.entries(SOCIAL_CONNECTOR_SECRET_DEFINITIONS).map(([platform, definitions]) => {
    const platformRows = rows.filter((row) => row.platform === platform && row.status !== "disabled");
    const secrets = definitions.map((definition) => {
      const row = platformRows.find((item) => item.secret_key === definition.key);
      return {
        ...definition,
        present: Boolean(row),
        status: row?.status || "missing",
        updated_at: row?.updated_at || null,
        expires_at: row?.expires_at || null,
        last_verified_at: row?.last_verified_at || null
      };
    });
    const required = secrets.filter((item) => item.required);
    const ready = required.length > 0 && required.every((item) => item.present && item.status === "active");
    return [platform, {
      platform,
      ready,
      missing_required: required.filter((item) => !item.present).map((item) => item.key),
      secrets
    }];
  }));
}

async function loadConnectorSecrets({ platform, accountId, warnings }) {
  let query = supabaseAdmin
    .from("social_media_connector_secrets")
    .select("id, account_id, platform, secret_key, encrypted_value, status")
    .eq("platform", platform)
    .eq("status", "active");
  if (accountId) {
    query = query.or(`account_id.eq.${accountId},account_id.is.null`);
  } else {
    query = query.is("account_id", null);
  }

  const rows = await optionalQuery(query, [], warnings, "social_media_connector_secrets");
  const result = {};
  const orderedRows = [...rows].sort((a, b) => Number(Boolean(a.account_id)) - Number(Boolean(b.account_id)));
  for (const row of orderedRows) {
    try {
      result[row.secret_key] = decryptSecretValue(row.encrypted_value, secretContext({
        platform: row.platform,
        accountId: row.account_id || null,
        secretKey: row.secret_key
      }));
    } catch (error) {
      warnings.push(`${platform}/${row.secret_key}: Secret cozulemedi veya encryption key degisti.`);
    }
  }
  return result;
}

async function findSocialDuplicate({ contentHash, semanticHash, visualHash, excludeId = null }) {
  const filters = [
    `content_hash.eq.${contentHash}`,
    `semantic_hash.eq.${semanticHash}`
  ];
  if (visualHash) filters.push(`visual_hash.eq.${visualHash}`);

  let query = supabaseAdmin
    .from("social_media_drafts")
    .select("id, title, status, content_hash, semantic_hash, visual_hash, created_at")
    .neq("status", "archived")
    .or(filters.join(","))
    .order("created_at", { ascending: false })
    .limit(1);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) {
    if (looksLikeMissingSchema(error)) return null;
    throw error;
  }
  return data?.[0] || null;
}

function promptOnlySocialAsset(asset, metadata = {}) {
  return {
    provider: "prompt_only",
    status: "manual_required",
    asset_url: "",
    image_url: "",
    video_url: "",
    alt_text: asset.alt_text || "",
    metadata
  };
}

function failedSocialAsset(asset, provider, message, metadata = {}) {
  return {
    provider,
    status: "generation_failed",
    asset_url: "",
    image_url: "",
    video_url: "",
    alt_text: asset.alt_text || "",
    metadata: {
      ...metadata,
      error: String(message || "Asset generation failed.").slice(0, 500)
    }
  };
}

function socialAssetHasPreparedMedia(asset) {
  const metadata = asset?.metadata || {};
  return Boolean(asset?.asset_url || metadata.image_url || metadata.video_url);
}

function cleanStoragePart(value, fallback = "asset") {
  const cleaned = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || fallback;
}

function extensionFromMime(contentType) {
  const type = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg") return "jpg";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  if (type === "video/mp4") return "mp4";
  return "png";
}

function storageObjectSize(item) {
  return Number(item?.metadata?.size || item?.metadata?.contentLength || item?.metadata?.ContentLength || 0);
}

function storageObjectTimestamp(item) {
  return item?.updated_at || item?.created_at || item?.last_accessed_at || item?.metadata?.lastModified || "";
}

function isStorageFolder(item) {
  return !item?.id && !storageObjectSize(item) && !item?.metadata?.mimetype;
}

async function listStoragePath(bucket, path = "") {
  const rows = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(path, {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" }
    });
    if (error) throw new Error(`${bucket}/${path}: ${error.message}`);
    const items = data || [];
    rows.push(...items);
    if (items.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function walkStoragePath(bucket, path = "") {
  const items = await listStoragePath(bucket, path);
  const files = [];
  for (const item of items) {
    const fullPath = path ? `${path}/${item.name}` : item.name;
    if (isStorageFolder(item)) {
      files.push(...await walkStoragePath(bucket, fullPath));
      continue;
    }
    files.push({
      path: fullPath,
      size: storageObjectSize(item),
      updatedAt: storageObjectTimestamp(item)
    });
  }
  return files;
}

async function cleanupSocialMediaAssetStorage({ retentionDays, limit, dryRun }) {
  const bucket = String(config.socialMedia.assetStorageBucket || "").trim();
  const prefix = String(config.socialMedia.assetStoragePrefix || "").replace(/^\/+|\/+$/g, "");
  if (!bucket || !prefix) {
    throw new Error("SOCIAL_MEDIA_ASSET_STORAGE_BUCKET ve SOCIAL_MEDIA_ASSET_STORAGE_PREFIX dolu olmalı.");
  }

  const days = Math.max(1, Number(retentionDays || config.socialMedia.assetRetentionDays || 2));
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const files = await walkStoragePath(bucket, prefix);
  const candidates = files
    .map((file) => ({ ...file, parsedDate: file.updatedAt ? new Date(file.updatedAt) : null }))
    .filter((file) => file.parsedDate && !Number.isNaN(file.parsedDate.getTime()) && file.parsedDate < cutoff)
    .sort((a, b) => a.parsedDate - b.parsedDate)
    .slice(0, Math.max(1, Math.min(Number(limit || 500), 1000)));

  const totalBytes = candidates.reduce((sum, file) => sum + file.size, 0);
  const deletedPaths = [];

  if (!dryRun && candidates.length) {
    for (let index = 0; index < candidates.length; index += 100) {
      const batch = candidates.slice(index, index + 100).map((file) => file.path);
      const { error } = await supabaseAdmin.storage.from(bucket).remove(batch);
      if (error) throw new Error(`${bucket}: ${error.message}`);
      deletedPaths.push(...batch);
    }
  }

  return {
    bucket,
    prefix,
    retention_days: days,
    cutoff: cutoff.toISOString(),
    scanned: files.length,
    matched: candidates.length,
    deleted: dryRun ? 0 : deletedPaths.length,
    dry_run: Boolean(dryRun),
    estimated_freed_bytes: totalBytes,
    sample_paths: candidates.slice(0, 20).map((file) => file.path)
  };
}

async function ensureSocialAssetBucket(warnings) {
  const bucket = String(config.socialMedia.assetStorageBucket || "").trim();
  if (!bucket) return false;
  const { error } = await supabaseAdmin.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: config.socialMedia.maxMediaBytes
  });
  if (!error) return true;
  if (/already|exists|duplicate/i.test(error.message || "")) return true;
  warnings.push(`Asset storage bucket hazirlanamadi: ${error.message || "unknown"}`);
  return false;
}

async function uploadSocialAssetBytes({ bytes, contentType, asset, packageMeta, warnings }) {
  const bucket = String(config.socialMedia.assetStorageBucket || "").trim();
  if (!await ensureSocialAssetBucket(warnings)) {
    throw new Error("SOCIAL_MEDIA_ASSET_STORAGE_BUCKET hazir degil.");
  }
  if (bytes.byteLength > config.socialMedia.maxMediaBytes) {
    throw new Error("Uretilen asset izin verilen medya boyutunu asti.");
  }

  const extension = extensionFromMime(contentType);
  const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const datePart = cleanStoragePart(packageMeta?.plan_date || new Date().toISOString().slice(0, 10), "daily");
  const assetPart = cleanStoragePart(asset.visual_fingerprint || asset.title || digest, "asset");
  const prefix = cleanStoragePart(config.socialMedia.assetStoragePrefix || "social-media", "social-media");
  const path = `${prefix}/${datePart}/${assetPart}-${digest}.${extension}`;

  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, bytes, {
    contentType: contentType || "image/png",
    cacheControl: "31536000",
    upsert: false
  });
  if (error && !/already|exists|duplicate/i.test(error.message || "")) {
    throw new Error(error.message || "Asset storage upload failed.");
  }

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  const publicUrl = String(data?.publicUrl || "");
  if (!publicUrl) throw new Error("Asset public URL alinamadi.");
  return { publicUrl, path, bucket };
}

function parseOpenAiImageItem(item) {
  const b64 = String(item?.b64_json || "").trim();
  if (b64) {
    return { bytes: Buffer.from(b64, "base64"), contentType: "image/png", source: "b64_json" };
  }
  return null;
}

async function fetchOpenAiImageUrl(item) {
  const url = String(item?.url || "").trim();
  if (!/^https:\/\//i.test(url)) return null;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`OpenAI image URL fetch failed: HTTP ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return {
    bytes: Buffer.from(arrayBuffer),
    contentType: response.headers.get("content-type") || "image/png",
    source: "url"
  };
}

function socialAssetPrompt(asset, packageMeta) {
  const platforms = Array.isArray(asset.platforms) ? asset.platforms.join(", ") : "";
  return [
    asset.prompt || asset.visual_concept || asset.title || "AllonaHub social media visual",
    "Brand: AllonaHub.",
    "Style: clean modern SaaS dashboard, realistic interface lighting, premium business visual.",
    "Do not include readable text, real personal data, platform logos, or fake UI secrets.",
    platforms ? `Target platforms: ${platforms}.` : "",
    packageMeta?.plan_date ? `Campaign date: ${packageMeta.plan_date}.` : "",
    packageMeta?.objective ? `Objective: ${packageMeta.objective}.` : ""
  ].filter(Boolean).join("\n");
}

async function requestSocialAssetFromOpenAi({ asset, packageMeta, warnings }) {
  if (!config.socialMedia.assetGenerationEnabled) {
    return promptOnlySocialAsset(asset);
  }
  if (config.socialMedia.assetGenerationProvider !== "openai") {
    warnings.push(`Asset provider desteklenmiyor: ${config.socialMedia.assetGenerationProvider}`);
    return promptOnlySocialAsset(asset, { provider: config.socialMedia.assetGenerationProvider });
  }
  if (!config.socialMedia.assetOpenAiApiKey) {
    warnings.push("SOCIAL_MEDIA_ASSET_OPENAI_API_KEY eksik; asset manual_required kaldi.");
    return promptOnlySocialAsset(asset, { missing: "SOCIAL_MEDIA_ASSET_OPENAI_API_KEY" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(15000, config.socialMedia.sendTimeoutMs * 4));
  try {
    const response = await fetch(config.socialMedia.assetOpenAiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.socialMedia.assetOpenAiApiKey}`
      },
      body: JSON.stringify({
        model: config.socialMedia.assetOpenAiModel,
        prompt: socialAssetPrompt(asset, packageMeta),
        size: config.socialMedia.assetOpenAiSize,
        n: 1
      }),
      signal: controller.signal
    });
    const text = await response.text();
    let parsed = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = {};
    }
    if (!response.ok) {
      const message = parsed?.error?.message || parsed?.message || `HTTP ${response.status}`;
      warnings.push(`OpenAI asset generation basarisiz: ${message}`);
      return failedSocialAsset(asset, "openai_image", message, {
        response_status: response.status,
        error_code: parsed?.error?.code || null,
        error_type: parsed?.error?.type || null
      });
    }

    const item = Array.isArray(parsed?.data) ? parsed.data[0] : null;
    const image = parseOpenAiImageItem(item) || await fetchOpenAiImageUrl(item);
    if (!image?.bytes?.byteLength) {
      throw new Error("OpenAI image payload bos dondu.");
    }

    const uploaded = await uploadSocialAssetBytes({
      bytes: image.bytes,
      contentType: image.contentType,
      asset,
      packageMeta,
      warnings
    });

    return {
      provider: "openai_image",
      status: "url_ready",
      asset_url: uploaded.publicUrl,
      image_url: uploaded.publicUrl,
      video_url: "",
      alt_text: item?.revised_prompt || asset.alt_text || asset.title || "",
      metadata: {
        model: config.socialMedia.assetOpenAiModel,
        size: config.socialMedia.assetOpenAiSize,
        source: image.source,
        storage_bucket: uploaded.bucket,
        storage_path: uploaded.path
      }
    };
  } catch (error) {
    const message = error?.name === "AbortError" ? "timeout" : (error?.message || "OpenAI asset generation failed.");
    warnings.push(`OpenAI asset generation hatasi: ${message}`);
    return failedSocialAsset(asset, "openai_image", message);
  } finally {
    clearTimeout(timeout);
  }
}

async function requestSocialAssetFromWebhook({ request, asset, packageMeta, warnings }) {
  if (!config.socialMedia.assetWebhookUrl) {
    return requestSocialAssetFromOpenAi({ asset, packageMeta, warnings });
  }

  const body = JSON.stringify({
    event: "allonahub.social_media.asset_prepare",
    request_id: request?.id || "",
    dry_run: socialMediaDispatchStatus().dry_run,
    asset,
    package: packageMeta
  });
  const headers = {
    "Content-Type": "application/json",
    "X-AllonaHub-Event": "social_media.asset_prepare",
    "X-AllonaHub-Request-Id": request?.id || ""
  };
  const signed = socialWebhookSignature(config.socialMedia.assetWebhookSecret, body);
  if (signed) headers["X-AllonaHub-Signature"] = signed;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(5000, config.socialMedia.sendTimeoutMs * 2));
  try {
    const response = await fetch(config.socialMedia.assetWebhookUrl, {
      method: "POST",
      headers,
      body,
      signal: controller.signal
    });
    const text = await response.text();
    let parsed = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = {};
    }
    if (!response.ok) {
      warnings.push(`Asset webhook basarisiz: HTTP ${response.status}`);
      return {
        provider: "asset_webhook",
        status: "generation_failed",
        asset_url: "",
        image_url: "",
        video_url: "",
        alt_text: asset.alt_text || "",
        metadata: { response_status: response.status, response_body: text.slice(0, 500) }
      };
    }
    return {
      provider: "asset_webhook",
      status: parsed.status || "url_ready",
      asset_url: String(parsed.asset_url || parsed.image_url || parsed.video_url || ""),
      image_url: String(parsed.image_url || parsed.asset_url || ""),
      video_url: String(parsed.video_url || ""),
      alt_text: String(parsed.alt_text || asset.alt_text || ""),
      metadata: parsed.metadata || {}
    };
  } catch (error) {
    warnings.push(`Asset webhook hatasi: ${error?.name === "AbortError" ? "timeout" : (error?.message || "unknown")}`);
    return {
      provider: "asset_webhook",
      status: "generation_failed",
      asset_url: "",
      image_url: "",
      video_url: "",
      alt_text: asset.alt_text || "",
      metadata: { error: error?.message || "Asset webhook failed." }
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function createSocialAssetForPackage({ request, ctx = null, generatedPackage, warnings, generateAssets = true }) {
  const asset = generatedPackage.asset;
  if (!asset) return null;

  const existing = await optionalQuery(
    supabaseAdmin
      .from("social_media_assets")
      .select("*")
      .eq("visual_fingerprint", asset.visual_fingerprint)
      .limit(1),
    [],
    warnings,
    "social_media_assets"
  );
  const existingAsset = existing[0] || null;
  const packageMeta = {
    plan_date: generatedPackage.plan_date,
    objective: generatedPackage.objective,
    target_platforms: generatedPackage.target_platforms
  };
  const shouldPrepareExistingAsset =
    Boolean(existingAsset)
    && generateAssets
    && !socialAssetHasPreparedMedia(existingAsset)
    && (Boolean(config.socialMedia.assetWebhookUrl) || Boolean(config.socialMedia.assetGenerationEnabled));
  if (existingAsset && !shouldPrepareExistingAsset) return existingAsset;

  const prepared = generateAssets
    ? await requestSocialAssetFromWebhook({
        request,
        asset,
        packageMeta,
        warnings
      })
    : {
        provider: "prompt_only",
        status: "manual_required",
        asset_url: "",
        image_url: "",
        video_url: "",
        alt_text: asset.alt_text || "",
        metadata: {}
      };

  if (existingAsset) {
    const existingMetadata = existingAsset.metadata || {};
    const updatedAsset = await optionalMutation(
      supabaseAdmin
        .from("social_media_assets")
        .update({
          asset_type: prepared.video_url && !prepared.image_url ? "video" : (existingAsset.asset_type || asset.asset_type),
          asset_url: prepared.asset_url || existingAsset.asset_url || "",
          alt_text: prepared.alt_text || existingAsset.alt_text || asset.alt_text || "",
          prompt: existingAsset.prompt || asset.prompt || "",
          metadata: {
            ...existingMetadata,
            prepared_from: existingMetadata.prepared_from || "daily_package_generator",
            provider: prepared.provider || existingMetadata.provider || "prompt_only",
            status: prepared.status || existingMetadata.status || "manual_required",
            platforms: asset.platforms || existingMetadata.platforms || [],
            image_url: prepared.image_url || existingMetadata.image_url || "",
            video_url: prepared.video_url || existingMetadata.video_url || "",
            webhook_metadata: prepared.metadata || existingMetadata.webhook_metadata || {},
            package_date: generatedPackage.plan_date
          }
        })
        .eq("id", existingAsset.id)
        .select("*")
        .single(),
      warnings,
      "social_media_assets"
    );
    return updatedAsset || existingAsset;
  }

  return optionalMutation(
    supabaseAdmin
      .from("social_media_assets")
      .insert({
        title: asset.title,
        asset_type: prepared.video_url && !prepared.image_url ? "video" : asset.asset_type,
        asset_url: prepared.asset_url || "",
        alt_text: prepared.alt_text || asset.alt_text || "",
        prompt: asset.prompt || "",
        visual_fingerprint: asset.visual_fingerprint,
        metadata: {
          prepared_from: "daily_package_generator",
          provider: prepared.provider,
          status: prepared.status,
          platforms: asset.platforms || [],
          image_url: prepared.image_url || "",
          video_url: prepared.video_url || "",
          webhook_metadata: prepared.metadata || {},
          package_date: generatedPackage.plan_date
        },
        created_by: ctx?.user?.id || null
      })
      .select("*")
      .single(),
    warnings,
    "social_media_assets"
  );
}

function socialAssetRowToPackageMeta(row) {
  const metadata = row?.metadata || {};
  const platforms = Array.isArray(metadata.platforms) && metadata.platforms.length
    ? metadata.platforms
    : SOCIAL_MEDIA_PUBLIC_DAILY_PLATFORMS;
  return {
    plan_date: metadata.package_date || todayInSocialTimezone(),
    objective: metadata.objective || "growth",
    target_platforms: platforms
  };
}

function socialAssetRowToAssetInput(row) {
  const metadata = row?.metadata || {};
  const platforms = Array.isArray(metadata.platforms) ? metadata.platforms : [];
  return {
    id: row.id,
    title: row.title || "AllonaHub social media asset",
    asset_type: row.asset_type || "image",
    prompt: row.prompt || "",
    visual_concept: metadata.visual_concept || row.prompt || "",
    visual_fingerprint: row.visual_fingerprint || "",
    platforms,
    alt_text: row.alt_text || ""
  };
}

async function applyPreparedSocialAsset({ row, asset, prepared, packageMeta, warnings }) {
  const existingMetadata = row.metadata || {};
  const preparedMetadata = prepared?.metadata && typeof prepared.metadata === "object" && !Array.isArray(prepared.metadata)
    ? prepared.metadata
    : {};
  const imageUrl = String(prepared?.image_url || "");
  const videoUrl = String(prepared?.video_url || "");
  const assetUrl = String(prepared?.asset_url || imageUrl || videoUrl || row.asset_url || "");
  const nextAssetType = videoUrl && !imageUrl ? "video" : (assetUrl ? "image" : (row.asset_type || asset.asset_type || "image"));

  const updated = await optionalMutation(
    supabaseAdmin
      .from("social_media_assets")
      .update({
        asset_type: nextAssetType,
        asset_url: assetUrl,
        alt_text: prepared?.alt_text || row.alt_text || asset.alt_text || "",
        prompt: row.prompt || asset.prompt || "",
        metadata: {
          ...existingMetadata,
          prepared_from: existingMetadata.prepared_from || "asset_prepare_endpoint",
          provider: prepared?.provider || existingMetadata.provider || "prompt_only",
          status: prepared?.status || existingMetadata.status || (assetUrl ? "url_ready" : "manual_required"),
          platforms: asset.platforms || existingMetadata.platforms || [],
          image_url: imageUrl || existingMetadata.image_url || "",
          video_url: videoUrl || existingMetadata.video_url || "",
          webhook_metadata: preparedMetadata,
          package_date: existingMetadata.package_date || packageMeta.plan_date,
          prepared_at: new Date().toISOString()
        }
      })
      .eq("id", row.id)
      .select("*")
      .single(),
    warnings,
    "social_media_assets"
  );
  return updated || row;
}

async function syncPreparedAssetToPlatformPosts({ assetRow, warnings }) {
  if (!assetRow?.id || !socialAssetHasPreparedMedia(assetRow)) return 0;
  const metadata = assetRow.metadata || {};
  const imageUrl = String(metadata.image_url || (assetRow.asset_type === "image" ? assetRow.asset_url : "") || "");
  const videoUrl = String(metadata.video_url || (assetRow.asset_type !== "image" ? assetRow.asset_url : "") || "");
  const assetUrl = String(assetRow.asset_url || imageUrl || videoUrl || "");
  if (!assetUrl) return 0;

  const posts = await optionalQuery(
    supabaseAdmin
      .from("social_media_platform_posts")
      .select("id, platform, media_asset_ids, platform_payload")
      .order("created_at", { ascending: false })
      .limit(240),
    [],
    warnings,
    "social_media_platform_posts"
  );

  const linkedPosts = posts.filter((post) => (
    (Array.isArray(post.media_asset_ids) && post.media_asset_ids.includes(assetRow.id))
    || post.platform_payload?.asset_id === assetRow.id
  ));
  let updatedCount = 0;
  for (const post of linkedPosts) {
    const nextPayload = {
      ...(post.platform_payload || {}),
      asset_id: assetRow.id,
      asset_url: assetUrl,
      asset_status: metadata.status || "url_ready"
    };
    if (imageUrl) nextPayload.image_url = imageUrl;
    if (videoUrl) nextPayload.video_url = videoUrl;
    await optionalMutation(
      supabaseAdmin
        .from("social_media_platform_posts")
        .update({
          platform_payload: nextPayload,
          last_error: ""
        })
        .eq("id", post.id)
        .select("id"),
      warnings,
      "social_media_platform_posts"
    );
    updatedCount += 1;
  }
  return updatedCount;
}

async function prepareSocialMediaAssets({ request, ctx, limit }) {
  const warnings = [];
  const dispatchStatus = socialMediaDispatchStatus();
  if (!dispatchStatus.asset_generation_ready) {
    throw httpError("Asset generator hazir degil. SOCIAL_MEDIA_ASSET_GENERATION_ENABLED/SOCIAL_MEDIA_ASSET_OPENAI_API_KEY/SOCIAL_MEDIA_ASSET_STORAGE_BUCKET ayarlanmali.", 409);
  }

  const rows = await optionalQuery(
    supabaseAdmin
      .from("social_media_assets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(80),
    [],
    warnings,
    "social_media_assets"
  );
  const missingAssets = rows
    .filter((row) => {
      if (socialAssetHasPreparedMedia(row)) return false;
      const status = String(row.metadata?.status || "").trim();
      return !status || ["manual_required", "prompt_ready", "generation_failed"].includes(status);
    })
    .slice(0, Math.max(1, Math.min(Number(limit || 10), 30)));

  const preparedRows = [];
  for (const row of missingAssets) {
    const packageMeta = socialAssetRowToPackageMeta(row);
    const asset = socialAssetRowToAssetInput(row);
    const prepared = await requestSocialAssetFromWebhook({ request, asset, packageMeta, warnings });
    const updated = await applyPreparedSocialAsset({ row, asset, prepared, packageMeta, warnings });
    const syncedPosts = await syncPreparedAssetToPlatformPosts({ assetRow: updated, warnings });
    preparedRows.push({
      asset_id: updated.id,
      title: updated.title,
      status: updated.metadata?.status || "",
      asset_url: updated.asset_url || "",
      provider: updated.metadata?.provider || "",
      synced_posts: syncedPosts
    });
  }

  const auditPayload = {
    request,
    action: ctx ? "admin.ops.social_media_assets_prepared" : "cron.social_media_assets_prepared",
    resourceType: "social_media_asset",
    severity: preparedRows.some((row) => row.asset_url) ? "info" : "warning",
    metadata: {
      count: preparedRows.length,
      statuses: preparedRows.map((row) => row.status),
      warning_count: warnings.length
    }
  };
  if (ctx) {
    await auditedOpsEvent({ ...auditPayload, ctx });
  } else {
    await auditEvent({
      ...auditPayload,
      source: "cron",
      purpose: "social_media_assets_prepare",
      evidenceTags: ["social_media_asset", "cron"]
    });
  }

  return {
    ok: true,
    prepared: preparedRows,
    warnings,
    dispatch: socialMediaDispatchStatus()
  };
}

function attachAssetToDraftPayload(payload, asset) {
  if (!asset) return payload;
  const metadata = asset.metadata || {};
  const imageUrl = String(metadata.image_url || (asset.asset_type === "image" ? asset.asset_url : "") || "");
  const videoUrl = String(metadata.video_url || (asset.asset_type !== "image" ? asset.asset_url : "") || "");
  const mediaAssetIds = [...new Set([...(payload.media_asset_ids || []), asset.id].filter(Boolean))];
  const platformOverrides = Object.fromEntries(Object.entries(payload.platform_overrides || {}).map(([platform, override]) => {
    const nextPayload = {
      ...(override.platform_payload || {}),
      asset_id: asset.id,
      asset_url: asset.asset_url || "",
      asset_status: metadata.status || "prompt_ready"
    };
    if (imageUrl) nextPayload.image_url = imageUrl;
    if (videoUrl) nextPayload.video_url = videoUrl;
    return [platform, {
      ...override,
      platform_payload: nextPayload
    }];
  }));

  return {
    ...payload,
    media_asset_ids: mediaAssetIds,
    platform_payload: {
      ...(payload.platform_payload || {}),
      asset_id: asset.id,
      asset_url: asset.asset_url || "",
      asset_status: metadata.status || "prompt_ready",
      image_url: imageUrl || payload.platform_payload?.image_url || "",
      video_url: videoUrl || payload.platform_payload?.video_url || ""
    },
    platform_overrides: platformOverrides
  };
}

async function createSocialDraftWithPosts({
  request,
  ctx = null,
  payload,
  initialStatus = "draft",
  postStatus = "draft",
  auditAction = "admin.ops.social_media_draft_created",
  auditSource = "admin"
}) {
  const warnings = [];
  const contentHash = socialContentHash(payload);
  const semanticHash = socialSemanticHash(payload);
  const visualHash = socialVisualHash(payload);
  const duplicate = await findSocialDuplicate({ contentHash, semanticHash, visualHash });

  if (duplicate) {
    if (ctx) {
      await auditedOpsEvent({
        request,
        ctx,
        action: "admin.ops.social_media_duplicate_blocked",
        resourceType: "social_media_draft",
        resourceId: duplicate.id,
        severity: "warning",
        metadata: {
          requested_title: payload.title,
          duplicate_title: duplicate.title,
          content_hash: compactHash(contentHash),
          semantic_hash: compactHash(semanticHash),
          visual_hash: compactHash(visualHash)
        }
      });
    } else {
      await auditEvent({
        request,
        action: "cron.social_media_duplicate_blocked",
        resourceType: "social_media_draft",
        resourceId: duplicate.id,
        severity: "warning",
        source: "cron",
        purpose: "social_media_daily_package",
        metadata: {
          requested_title: payload.title,
          duplicate_title: duplicate.title,
          content_hash: compactHash(contentHash),
          semantic_hash: compactHash(semanticHash),
          visual_hash: compactHash(visualHash)
        }
      });
    }
    throw httpError(`Tekrar icerik engellendi. Benzer kayit: ${duplicate.title}`, 409);
  }

  const now = new Date().toISOString();
  const draft = await optionalMutation(
    supabaseAdmin
      .from("social_media_drafts")
      .insert({
        campaign_id: payload.campaign_id || null,
        title: payload.title,
        content_theme: payload.content_theme,
        hook: payload.hook,
        body: payload.body,
        cta: payload.cta,
        landing_url: payload.landing_url,
        language: payload.language,
        status: initialStatus,
        uniqueness_status: "unique",
        content_hash: contentHash,
        semantic_hash: semanticHash,
        visual_hash: visualHash,
        scheduled_for: payload.scheduled_for || null,
        prepared_by: ctx?.user?.id || null,
        submitted_by: initialStatus === "ready_for_review" ? (ctx?.user?.id || null) : null,
        submitted_at: initialStatus === "ready_for_review" ? now : null,
        metadata: {
          ...payload.metadata,
          target_platforms: payload.target_platforms,
          hashtags: payload.hashtags,
          media_asset_ids: payload.media_asset_ids,
          platform_payload: payload.platform_payload,
          platform_overrides: payload.platform_overrides
        }
      })
      .select("*")
      .single(),
    warnings,
    "social_media_drafts"
  );

  const accounts = await optionalQuery(
    supabaseAdmin
      .from("social_media_accounts")
      .select("*")
      .eq("is_active", true)
      .in("platform", payload.target_platforms),
    [],
    warnings,
    "social_media_accounts"
  );

  if (!accounts.length) warnings.push("Aktif sosyal medya hesabi bulunamadi; taslak olustu ama platform varyasyonu uretilmedi.");
  const posts = await createPlatformPostsForDraft({ draft, payload, accounts, warnings, status: postStatus });

  if (ctx) {
    await auditedOpsEvent({
      request,
      ctx,
      action: auditAction,
      resourceType: "social_media_draft",
      resourceId: draft.id,
      metadata: {
        title: draft.title,
        platforms: payload.target_platforms,
        post_count: posts.length,
        content_hash: compactHash(contentHash),
        semantic_hash: compactHash(semanticHash),
        visual_hash: compactHash(visualHash)
      }
    });
  } else {
    await auditEvent({
      request,
      action: auditAction,
      resourceType: "social_media_draft",
      resourceId: draft.id,
      severity: "info",
      source: auditSource,
      purpose: "social_media_daily_package",
      metadata: {
        title: draft.title,
        platforms: payload.target_platforms,
        post_count: posts.length,
        content_hash: compactHash(contentHash),
        semantic_hash: compactHash(semanticHash),
        visual_hash: compactHash(visualHash)
      }
    });
  }

  return { draft, posts, warnings };
}

async function loadSocialMediaCenterData(warnings, query = {}) {
  const [accounts, campaigns, assets, drafts, posts, attempts, plans, rules, secretRows] = await Promise.all([
    optionalQuery(
      supabaseAdmin
        .from("social_media_accounts")
        .select("*")
        .order("platform", { ascending: true }),
      [],
      warnings,
      "social_media_accounts"
    ),
    optionalQuery(
      supabaseAdmin
        .from("social_media_campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60),
      [],
      warnings,
      "social_media_campaigns"
    ),
    optionalQuery(
      supabaseAdmin
        .from("social_media_assets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80),
      [],
      warnings,
      "social_media_assets"
    ),
    optionalQuery(
      supabaseAdmin
        .from("social_media_drafts")
        .select("*, campaign:social_media_campaigns(id, title, objective, module_key)")
        .order("created_at", { ascending: false })
        .limit(Number(query.limit || 80)),
      [],
      warnings,
      "social_media_drafts"
    ),
    optionalQuery(
      supabaseAdmin
        .from("social_media_platform_posts")
        .select("*, account:social_media_accounts(id, platform, display_name, handle, account_url, connector_mode, connection_status)")
        .order("created_at", { ascending: false })
        .limit(240),
      [],
      warnings,
      "social_media_platform_posts"
    ),
    optionalQuery(
      supabaseAdmin
        .from("social_media_dispatch_attempts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80),
      [],
      warnings,
      "social_media_dispatch_attempts"
    ),
    optionalQuery(
      supabaseAdmin
        .from("social_media_daily_plans")
        .select("*")
        .order("plan_date", { ascending: false })
        .limit(30),
      [],
      warnings,
      "social_media_daily_plans"
    ),
    optionalQuery(
      supabaseAdmin
        .from("social_media_rules")
        .select("*")
        .order("rule_key", { ascending: true }),
      [],
      warnings,
      "social_media_rules"
    ),
    optionalQuery(
      supabaseAdmin
        .from("social_media_connector_secrets")
        .select("id, account_id, platform, secret_key, secret_label, status, expires_at, last_verified_at, updated_at")
        .order("platform", { ascending: true })
        .order("secret_key", { ascending: true }),
      [],
      warnings,
      "social_media_connector_secrets"
    )
  ]);

  const status = String(query.status || "").trim();
  const search = cleanSearch(query.search || "").toLocaleLowerCase("tr-TR");
  const filteredDrafts = drafts.filter((draft) => {
    if (status && draft.status !== status) return false;
    if (!search) return true;
    return `${draft.title || ""} ${draft.body || ""} ${draft.content_theme || ""}`.toLocaleLowerCase("tr-TR").includes(search);
  });

  return {
    accounts,
    campaigns,
    assets,
    drafts: filteredDrafts,
    posts,
    attempts,
    plans,
    rules,
    connections: connectionSecretStatuses(secretRows),
    vault: secretVaultStatus(),
    dispatch: socialMediaDispatchStatus()
  };
}

async function createPlatformPostsForDraft({ draft, payload, accounts, warnings, status = "draft" }) {
  const platformOverrides = payload.platform_overrides || {};
  const basePlatformPayload = payload.platform_payload || {};
  const rows = accounts.map((account) => {
    const override = platformOverrides[account.platform] || {};
    const caption = override.caption || [payload.hook, payload.body, payload.cta].filter(Boolean).join("\n\n");
    return {
      draft_id: draft.id,
      account_id: account.id,
      platform: account.platform,
      post_type: override.post_type || platformPostType(account.platform, payload.post_type),
      caption,
      hashtags: normalizeHashtags(override.hashtags || payload.hashtags || []),
      media_asset_ids: payload.media_asset_ids || [],
      platform_payload: {
        ...basePlatformPayload,
        ...(override.platform_payload || {})
      },
      status,
      scheduled_for: override.scheduled_for || payload.scheduled_for || null
    };
  });
  if (!rows.length) return [];

  return optionalMutation(
    supabaseAdmin
      .from("social_media_platform_posts")
      .insert(rows)
      .select("*"),
    warnings,
    "social_media_platform_posts"
  );
}

async function dispatchDueSocialMediaPosts({ request, ctx = null, limit = config.socialMedia.maxDispatchBatch }) {
  const warnings = [];
  const now = new Date().toISOString();
  const posts = await optionalQuery(
    supabaseAdmin
      .from("social_media_platform_posts")
      .select("*, draft:social_media_drafts(*), account:social_media_accounts(*)")
      .in("status", ["approved", "scheduled", "queued"])
      .order("scheduled_for", { ascending: true, nullsFirst: true })
      .limit(Math.max(1, Math.min(Number(limit || 20), 50))),
    [],
    warnings,
    "social_media_platform_posts"
  );

  const duePosts = posts.filter((post) => !post.scheduled_for || new Date(post.scheduled_for).toISOString() <= now);
  const results = [];

  for (const post of duePosts) {
    await supabaseAdmin
      .from("social_media_platform_posts")
      .update({ status: "publishing", last_error: "" })
      .eq("id", post.id);

    const connectorSecrets = post.account?.connector_mode === "native_api"
      ? await loadConnectorSecrets({ platform: post.platform, accountId: post.account_id, warnings })
      : {};

    const result = await dispatchSocialMediaPost({
      post,
      draft: post.draft,
      account: post.account,
      requestId: request?.id || "",
      connectorSecrets
    });

    await supabaseAdmin
      .from("social_media_dispatch_attempts")
      .insert({
        post_id: post.id,
        platform: post.platform,
        provider: result.provider,
        status: result.status,
        request_id: request?.id || "",
        response_status: result.responseStatus,
        response_body: result.responseBody || "",
        error_message: result.errorMessage || "",
        metadata: {
          dry_run: result.status === "dry_run",
          account_id: post.account_id,
          connector_mode: post.account?.connector_mode || "pending"
        },
        attempted_by: ctx?.user?.id || null
      });

    const nextStatus = result.status === "sent" ? "published" : (result.status === "failed" ? "failed" : "queued");
    const updatePayload = {
      status: nextStatus,
      external_post_id: result.externalPostId || post.external_post_id || "",
      external_url: result.externalUrl || post.external_url || "",
      last_error: result.errorMessage || "",
      published_at: result.status === "sent" ? new Date().toISOString() : post.published_at
    };
    await supabaseAdmin
      .from("social_media_platform_posts")
      .update(updatePayload)
      .eq("id", post.id);

    results.push({ post_id: post.id, platform: post.platform, status: result.status, next_status: nextStatus, error: result.errorMessage || "" });
  }

  return { results, warnings };
}

async function generateSocialDailyPackageRecords({ request, ctx = null, options = {}, source = "admin" }) {
  const warnings = [];
  const planDate = options.plan_date || todayInSocialTimezone();
  const objective = options.objective || "growth";
  const targetPlatforms = options.target_platforms?.length ? options.target_platforms : SOCIAL_MEDIA_PUBLIC_DAILY_PLATFORMS;
  const landingUrl = options.landing_url || `${config.siteUrl}/`;

  const existingPlans = await optionalQuery(
    supabaseAdmin
      .from("social_media_daily_plans")
      .select("*")
      .eq("plan_date", planDate)
      .eq("objective", objective)
      .limit(1),
    [],
    warnings,
    "social_media_daily_plans"
  );
  const existingPlan = existingPlans[0] || null;
  if (existingPlan && !options.force_new && Array.isArray(existingPlan.draft_ids) && existingPlan.draft_ids.length) {
    return {
      skipped: true,
      reason: "daily_package_exists",
      plan: existingPlan,
      draft: null,
      posts: [],
      asset: null,
      package: null,
      warnings
    };
  }

  let generatedPackage = null;
  let draftResult = null;
  let asset = null;
  let lastError = null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    generatedPackage = buildSocialMediaDailyPackage({
      planDate,
      objective,
      landingUrl,
      targetPlatforms,
      variant: Number(options.variant || 0) + attempt
    });
    asset = await createSocialAssetForPackage({
      request,
      ctx,
      generatedPackage,
      warnings,
      generateAssets: options.generate_assets !== false
    });
    const payload = attachAssetToDraftPayload(generatedPackage.draft, asset);
    try {
      draftResult = await createSocialDraftWithPosts({
        request,
        ctx,
        payload,
        initialStatus: options.auto_submit === false ? "draft" : "ready_for_review",
        postStatus: options.auto_submit === false ? "draft" : "ready_for_review",
        auditAction: source === "cron" ? "cron.social_media_daily_package_created" : "admin.ops.social_media_daily_package_created",
        auditSource: source
      });
      break;
    } catch (error) {
      lastError = error;
      if (error?.statusCode !== 409 && error?.status !== 409) throw error;
      warnings.push(`Gunluk paket varyanti tekrar nedeniyle atlandi: ${attempt}`);
    }
  }

  if (!draftResult) throw lastError || httpError("Gunluk sosyal medya paketi olusturulamadi.", 409);

  const draftIds = [...new Set([...(existingPlan?.draft_ids || []), draftResult.draft.id])];
  const plan = await optionalMutation(
    supabaseAdmin
      .from("social_media_daily_plans")
      .upsert({
        plan_date: planDate,
        objective,
        timezone: config.socialMedia.defaultTimezone,
        status: options.auto_submit === false ? "draft" : "ready_for_review",
        summary: generatedPackage.summary,
        target_platforms: targetPlatforms,
        draft_ids: draftIds,
        prepared_by: ctx?.user?.id || existingPlan?.prepared_by || null,
        metadata: {
          ...(existingPlan?.metadata || {}),
          prepared_from: "daily_package_generator",
          source,
          generated_at: new Date().toISOString(),
          asset_id: asset?.id || null,
          package_title: generatedPackage.title,
          package_summary: generatedPackage.summary
        }
      }, { onConflict: "plan_date,objective" })
      .select("*")
      .single(),
    warnings,
    "social_media_daily_plans"
  );

  return {
    skipped: false,
    reason: "",
    plan,
    draft: draftResult.draft,
    posts: draftResult.posts,
    asset,
    package: generatedPackage,
    warnings: [...warnings, ...draftResult.warnings]
  };
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
  if (!looksLikeMissingSchema(error)) {
    error.operationLabel = label;
    throw error;
  }
  warnings.push(`${label}: Supabase migration veya policy production veritabaninda eksik gorunuyor.`);
  if (count !== null && count !== undefined) return { data: fallback, count: 0 };
  return fallback;
}

async function optionalMutation(query, warnings, label) {
  const { data, error } = await query;
  if (!error) return data;
  if (!looksLikeMissingSchema(error)) {
    error.operationLabel = label;
    throw error;
  }
  warnings.push(`${label}: Supabase migration veya policy production veritabaninda eksik gorunuyor.`);
  throw httpError(`${label} icin gerekli Supabase tablo/policy eksik. Migration uygulanmali.`, 409);
}

function refundCancellationKind(order) {
  const orderStatus = String(order?.order_status || order?.status || "").toLowerCase();
  const paymentStatus = String(order?.payment_status || "").toLowerCase();
  if (paymentStatus === "refunded" || orderStatus === "refunded") return "refund";
  if (orderStatus === "cancelled") return "cancellation";
  return "signal";
}

function refundCancellationReason({ order, notes = [], flags = [], tickets = [] } = {}) {
  const firstFlag = (flags || []).find((item) => item.reason);
  const firstNote = (notes || []).find((item) => item.body);
  const firstTicket = (tickets || []).find((item) => item.message || item.title);
  return firstFlag?.reason || firstNote?.body || firstTicket?.message || firstTicket?.title || order?.cancellation_reason || order?.refund_reason || "";
}

function refundCancellationPublic(order, extras = {}) {
  const kind = extras.type || refundCancellationKind(order);
  const riskLevel = extras.risk_level || (kind === "refund" ? "critical" : (kind === "cancellation" ? "high" : "medium"));
  const reason = refundCancellationReason({ order, ...extras });
  return {
    id: order.id,
    type: kind,
    order_no: order.order_no || order.order_number || order.id,
    customer_name: order.customer_name || "",
    customer_email: order.customer_email || "",
    customer_phone: order.customer_phone || "",
    total: Number(order.total || order.grand_total || 0),
    order_status: order.order_status || order.status || "",
    payment_status: order.payment_status || "",
    reason,
    risk_level: riskLevel,
    created_at: order.created_at,
    updated_at: order.updated_at,
    notes: extras.notes || [],
    flags: extras.flags || [],
    tickets: extras.tickets || [],
    provider_dispatch: extras.provider_dispatch || null,
    provider_status: paymentProviderDispatchStatus(),
    order_items: extras.order_items || order.order_items || [],
    request_status: extras.request_status || null,
    decision_required: Boolean(extras.decision_required),
    partner_decision: extras.partner_decision || null,
    partner_total: Number(extras.partner_total || 0),
    source_ticket_id: extras.source_ticket_id || null,
    source_ticket_status: extras.source_ticket_status || null,
    signal_at: extras.signal_at || order.updated_at || order.created_at || null
  };
}

async function updateRefundCancellationOrder(orderId, payload, warnings) {
  const selectColumns = "id, order_no, customer_email, total, order_status, payment_status, updated_at";
  const runUpdate = (updatePayload) => supabaseAdmin
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId)
    .select(selectColumns)
    .single();

  let { data, error } = await runUpdate(payload);
  if (!error) return data;

  if (Object.prototype.hasOwnProperty.call(payload, "status") && looksLikeMissingSchema(error)) {
    const fallbackPayload = { ...payload };
    delete fallbackPayload.status;
    warnings.push("orders.status: opsiyonel durum kolonu production veritabaninda eksik gorunuyor; order_status uzerinden guncellendi.");
    ({ data, error } = await runUpdate(fallbackPayload));
    if (!error) return data;
  }

  if (!looksLikeMissingSchema(error)) {
    error.operationLabel = "orders";
    throw error;
  }
  warnings.push("orders: Supabase migration veya policy production veritabaninda eksik gorunuyor.");
  throw httpError("orders icin gerekli Supabase tablo/policy eksik. Migration uygulanmali.", 409);
}

function refundCancellationSupportFilter(search) {
  const terms = ["iade", "iptal", "geri ödeme", "geri odeme", "refund", "cancel"];
  const clean = cleanSearch(search);
  const filters = terms.flatMap((term) => [
    `title.ilike.%${term}%`,
    `message.ilike.%${term}%`
  ]);
  if (clean) {
    filters.push(`title.ilike.%${clean}%`, `message.ilike.%${clean}%`);
  }
  return filters.join(",");
}

async function loadOrderPaymentProviderContext(orderId, warnings) {
  const providerWarnings = warnings || [];
  const context = {};
  const providerOrder = await optionalQuery(
    supabaseAdmin
      .from("orders")
      .select("id, payment_provider_reference, paid_at")
      .eq("id", orderId)
      .maybeSingle(),
    null,
    providerWarnings,
    "orders_provider_context"
  ).catch((error) => {
    if (!looksLikeMissingSchema(error)) throw error;
    providerWarnings.push("orders_provider_context: payment provider referans kolonları production şemasında eksik görünüyor.");
    return null;
  });
  if (providerOrder?.payment_provider_reference) {
    context.payment_id = providerOrder.payment_provider_reference;
    context.provider_reference = providerOrder.payment_provider_reference;
    context.source = "orders.payment_provider_reference";
  }
  if (providerOrder?.paid_at) context.paid_at = providerOrder.paid_at;

  const transaction = await optionalQuery(
    supabaseAdmin
      .from("partner_transactions")
      .select("id, provider, provider_reference, gross_amount, currency, metadata, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1),
    [],
    providerWarnings,
    "partner_transactions"
  ).catch((error) => {
    if (!looksLikeMissingSchema(error)) throw error;
    providerWarnings.push("partner_transactions: ödeme sağlayıcı transaction kaydı bulunamadı veya şema eksik.");
    return [];
  });
  const row = Array.isArray(transaction) ? transaction[0] : null;
  if (row) {
    context.provider = row.provider || context.provider;
    context.payment_id = context.payment_id || row.provider_reference || null;
    context.provider_reference = context.provider_reference || row.provider_reference || null;
    context.payment_transaction_id = row.metadata?.payment_transaction_id || row.metadata?.paymentTransactionId || null;
    context.gross_amount = Number(row.gross_amount || 0);
    context.currency = row.currency || "TRY";
    context.source = context.source || "partner_transactions";
  }
  return context;
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

function workQueueRiskFromSeverity(severity) {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "high";
  if (severity === "debug") return "low";
  return "medium";
}

function workQueuePriorityFromRisk(riskLevel) {
  if (riskLevel === "critical") return "urgent";
  if (riskLevel === "high") return "high";
  if (riskLevel === "low") return "low";
  return "normal";
}

function workQueuePublic(row, source = "stored") {
  const riskLevel = row.risk_level || "medium";
  return {
    id: row.id,
    source,
    source_module: row.source_module || "other",
    target_type: row.target_type || "operation",
    target_id: row.target_id || "",
    title: row.title || "Super Admin işi",
    summary: row.summary || "",
    priority: row.priority || workQueuePriorityFromRisk(riskLevel),
    risk_level: riskLevel,
    status: row.status || "open",
    owner_user_id: row.owner_user_id || null,
    due_at: row.due_at || null,
    decision_required: row.decision_required !== false,
    decision: row.decision || null,
    decision_reason: row.decision_reason || "",
    metadata: row.metadata || {},
    audit_event_id: row.audit_event_id || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    decided_at: row.decided_at || null,
    actionable: source === "stored"
  };
}

function derivedWorkQueueItem({ id, sourceModule, targetType, targetId, title, summary, riskLevel = "medium", status = "open", createdAt, metadata = {} }) {
  return workQueuePublic({
    id,
    source_module: sourceModule,
    target_type: targetType,
    target_id: targetId,
    title,
    summary,
    risk_level: riskLevel,
    priority: workQueuePriorityFromRisk(riskLevel),
    status,
    decision_required: true,
    metadata,
    created_at: createdAt,
    updated_at: createdAt
  }, "derived");
}

async function loadDerivedSuperAdminWorkQueue({ limit, status, sourceModule, riskLevel }) {
  const fallbackLimit = Math.min(Number(limit || 80), 80);
  const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const [
    approvalRequests,
    contentProposals,
    supportTickets,
    releaseApprovals,
    securityEvents
  ] = await Promise.all([
    runAdminQuery(
      "work_queue_admin_approval_requests",
      supabaseAdmin
        .from("admin_approval_requests")
        .select("*")
        .eq("status", "pending_super_admin")
        .order("created_at", { ascending: false })
        .limit(30),
      []
    ),
    runAdminQuery(
      "work_queue_content_change_proposals",
      supabaseAdmin
        .from("content_change_proposals")
        .select("*")
        .eq("status", "pending_super_admin")
        .order("created_at", { ascending: false })
        .limit(30),
      []
    ),
    runAdminQuery(
      "work_queue_support_tickets",
      supabaseAdmin
        .from("support_tickets")
        .select("*")
        .in("status", ["open", "in_progress"])
        .in("priority", ["high", "urgent"])
        .order("created_at", { ascending: false })
        .limit(30),
      []
    ),
    runAdminQuery(
      "work_queue_release_approvals",
      supabaseAdmin
        .from("super_admin_release_approvals")
        .select("*")
        .in("status", ["pending", "approved", "failed"])
        .order("created_at", { ascending: false })
        .limit(30),
      []
    ),
    runAdminQuery(
      "work_queue_security_events",
      supabaseAdmin
        .from("security_audit_events")
        .select("*")
        .in("severity", ["warning", "critical"])
        .gte("created_at", since48h)
        .order("created_at", { ascending: false })
        .limit(40),
      []
    )
  ]);

  const warnings = [approvalRequests, contentProposals, supportTickets, releaseApprovals, securityEvents]
    .map((item) => item.warning)
    .filter(Boolean);
  const items = [
    ...(approvalRequests.data || []).map((item) => derivedWorkQueueItem({
      id: `approval:${item.id}`,
      sourceModule: "admin_ops",
      targetType: item.target_type || "admin_approval_request",
      targetId: item.target_id || item.id,
      title: item.summary || "Admin onayı bekliyor",
      summary: `${item.request_type || "approval"} / ${item.status || "pending_super_admin"}`,
      riskLevel: "high",
      createdAt: item.created_at,
      metadata: { admin_approval_request_id: item.id, proposed_action: item.proposed_action || {} }
    })),
    ...(contentProposals.data || []).map((item) => derivedWorkQueueItem({
      id: `content:${item.id}`,
      sourceModule: item.content_scope === "legal" ? "legal" : "admin_ops",
      targetType: "content_change_proposal",
      targetId: item.id,
      title: item.title || "İçerik önerisi",
      summary: item.summary || item.content_scope || "",
      riskLevel: item.content_scope === "legal" ? "critical" : "medium",
      createdAt: item.created_at,
      metadata: { content_scope: item.content_scope, payload: item.payload || {} }
    })),
    ...(supportTickets.data || []).map((item) => derivedWorkQueueItem({
      id: `support:${item.id}`,
      sourceModule: item.category === "taxi" ? "taxi" : (item.requester_type === "partner" ? "partner" : "user_panel"),
      targetType: "support_ticket",
      targetId: item.id,
      title: item.title || "Destek talebi",
      summary: `${item.category || "general"} / ${item.priority || "normal"} / ${item.status || "open"}`,
      riskLevel: item.priority === "urgent" ? "critical" : "high",
      createdAt: item.created_at,
      metadata: { requester_type: item.requester_type, category: item.category }
    })),
    ...(releaseApprovals.data || []).map((item) => derivedWorkQueueItem({
      id: `release:${item.id}`,
      sourceModule: "release",
      targetType: "super_admin_release_approval",
      targetId: item.id,
      title: item.target_summary || item.approval_type || "Yayın onayı",
      summary: `${item.approval_type || "release"} / ${item.status || "pending"} / ${item.target_ref || "main"}`,
      riskLevel: item.risk_level || "critical",
      status: item.status === "failed" ? "waiting_owner" : "open",
      createdAt: item.created_at,
      metadata: { approval_type: item.approval_type, webhook_status: item.webhook_status || null }
    })),
    ...(securityEvents.data || []).map((item) => derivedWorkQueueItem({
      id: `security:${item.id}`,
      sourceModule: "security",
      targetType: item.resource_type || "security_audit_event",
      targetId: item.resource_id || item.id,
      title: item.action || "Güvenlik olayı",
      summary: `${item.severity || "warning"} / IP ${item.ip_address || "-"}`,
      riskLevel: workQueueRiskFromSeverity(item.severity),
      createdAt: item.created_at,
      metadata: { audit_event_id: item.id, actor_role: item.actor_role || null }
    }))
  ];

  const filtered = items
    .filter((item) => !status || item.status === status)
    .filter((item) => !sourceModule || item.source_module === sourceModule)
    .filter((item) => !riskLevel || item.risk_level === riskLevel)
    .sort((a, b) => {
      const priorityScore = { urgent: 4, high: 3, normal: 2, low: 1 };
      const riskScore = { critical: 4, high: 3, medium: 2, low: 1 };
      const scoreA = (priorityScore[a.priority] || 0) + (riskScore[a.risk_level] || 0);
      const scoreB = (priorityScore[b.priority] || 0) + (riskScore[b.risk_level] || 0);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    })
    .slice(0, fallbackLimit);

  return { items: filtered, warnings };
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

function partnerOrderItems(order, ownerId, isAdminUser, userId = ownerId) {
  return (order?.order_items || []).filter((item) => {
    const product = item.product || item.products || {};
    return isAdminUser || product.partner_id === ownerId || product.partner_id === userId || item.partner_id === ownerId || item.partner_id === userId;
  });
}

function partnerCanAccessOrder(order, ownerId, isAdminUser, userId = ownerId) {
  return partnerOrderItems(order, ownerId, isAdminUser, userId).length > 0;
}

function summarizePartnerOrders(orders, ownerId, isAdminUser, userId = ownerId) {
  return (orders || [])
    .map((order) => {
      const partnerItems = partnerOrderItems(order, ownerId, isAdminUser, userId);
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

function refundCancellationSignalType(order, tickets = [], flags = []) {
  const raw = [
    ...tickets.map((ticket) => ticket.metadata?.request_type || ticket.metadata?.type || ticket.category),
    ...flags.map((flag) => flag.metadata?.request_type || flag.metadata?.refund_kind || flag.metadata?.partner_decision),
    refundCancellationKind(order)
  ].find(Boolean);
  const normalized = String(raw || "").toLowerCase();
  if (/cancel|cancellation|iptal/.test(normalized)) return "cancellation";
  if (/refund|return|iade|geri/.test(normalized)) return "refund";

  const text = [
    ...tickets.flatMap((ticket) => [ticket.title, ticket.message]),
    ...flags.map((flag) => flag.reason)
  ].join(" ").toLocaleLowerCase("tr-TR");
  if (/iptal|cancel|cancellation/.test(text)) return "cancellation";
  if (/iade|refund|return|geri ödeme|geri odeme/.test(text)) return "refund";
  return "signal";
}

function refundCancellationFlagMatches(flag) {
  const text = [
    flag?.reason,
    flag?.metadata?.partner_decision,
    flag?.metadata?.admin_action,
    flag?.metadata?.super_admin_action,
    flag?.metadata?.dispute_status,
    flag?.metadata?.request_type
  ].join(" ").toLocaleLowerCase("tr-TR");
  return /refund|iade|return|iptal|cancel|cancellation|geri ödeme|geri odeme|ihtilaf|dispute/.test(text);
}

function refundCancellationTicketMatchesOrder(ticket, order) {
  const metadata = ticket?.metadata || {};
  if (metadata.order_id && String(metadata.order_id) === String(order.id)) return true;
  const haystack = [ticket?.title, ticket?.message, metadata.order_no, metadata.order_number, metadata.order_id]
    .join(" ")
    .toLocaleLowerCase("tr-TR");
  return [order.id, order.order_no, order.order_number, order.customer_email]
    .filter(Boolean)
    .some((value) => haystack.includes(String(value).toLocaleLowerCase("tr-TR")));
}

function partnerRefundCancellationSummary(items) {
  return {
    total: items.length,
    pending_partner: items.filter((item) => item.request_status === "pending_partner").length,
    disputes: items.filter((item) => item.request_status === "dispute_admin_review").length,
    approved: items.filter((item) => item.request_status === "approved").length,
    refunded: items.filter((item) => item.type === "refund").length,
    cancelled: items.filter((item) => item.type === "cancellation").length
  };
}

async function loadPartnerRefundCancellations({ orders, ownerId, userId, isAdminUser, limit = 120, warnings }) {
  const scopedOrders = (orders || []).filter((order) => partnerCanAccessOrder(order, ownerId, isAdminUser, userId));
  if (!scopedOrders.length) {
    const items = [];
    return { items, summary: partnerRefundCancellationSummary(items), warnings };
  }

  const orderIds = scopedOrders.map((order) => String(order.id));
  const [tickets, flags] = await Promise.all([
    optionalQuery(
      supabaseAdmin
        .from("support_tickets")
        .select("id, user_id, requester_type, category, priority, title, message, status, metadata, created_at, updated_at, profile:profiles(id, full_name, email, phone)")
        .or(refundCancellationSupportFilter(""))
        .order("created_at", { ascending: false })
        .limit(Math.min(Math.max(limit, 40), 200)),
      [],
      warnings,
      "support_tickets"
    ),
    optionalQuery(
      supabaseAdmin
        .from("admin_operation_flags")
        .select("id, flag_type, severity, reason, status, metadata, target_id, created_at, updated_at")
        .eq("target_type", "order")
        .in("target_id", orderIds)
        .order("created_at", { ascending: false })
        .limit(240),
      [],
      warnings,
      "admin_operation_flags"
    )
  ]);

  const items = scopedOrders.map((order) => {
    const orderTickets = (tickets || []).filter((ticket) => refundCancellationTicketMatchesOrder(ticket, order));
    const orderFlags = (flags || [])
      .filter((flag) => String(flag.target_id) === String(order.id))
      .filter(refundCancellationFlagMatches);
    const terminalKind = refundCancellationKind(order);
    if (!orderTickets.length && !orderFlags.length && terminalKind === "signal") return null;

    const rejectedFlag = orderFlags.find((flag) => flag.metadata?.partner_decision === "reject_request" || flag.metadata?.dispute_status === "admin_review_required");
    const approvedFlag = orderFlags.find((flag) => ["approve_refund", "approve_cancellation"].includes(flag.metadata?.partner_decision));
    const openTicket = orderTickets.find((ticket) => ["open", "in_progress"].includes(ticket.status));
    const requestStatus = rejectedFlag
      ? "dispute_admin_review"
      : (approvedFlag || terminalKind !== "signal" ? "approved" : (openTicket ? "pending_partner" : "signal"));
    const signalDates = [
      ...orderTickets.map((ticket) => ticket.updated_at || ticket.created_at),
      ...orderFlags.map((flag) => flag.updated_at || flag.created_at),
      order.updated_at,
      order.created_at
    ].filter(Boolean);
    const partnerItems = partnerOrderItems(order, ownerId, isAdminUser, userId);
    const partnerTotal = partnerItems.reduce((sum, item) => sum + Number(item.price || item.unit_price || 0) * Number(item.quantity || 1), 0);

    return refundCancellationPublic(order, {
      type: refundCancellationSignalType(order, orderTickets, orderFlags),
      risk_level: rejectedFlag ? "critical" : (openTicket ? "high" : undefined),
      tickets: orderTickets,
      flags: orderFlags,
      order_items: partnerItems,
      request_status: requestStatus,
      decision_required: requestStatus === "pending_partner",
      partner_decision: rejectedFlag?.metadata?.partner_decision || approvedFlag?.metadata?.partner_decision || null,
      partner_total: Number(partnerTotal.toFixed(2)),
      source_ticket_id: orderTickets[0]?.id || null,
      source_ticket_status: orderTickets[0]?.status || null,
      signal_at: signalDates.sort((a, b) => new Date(b) - new Date(a))[0] || null
    });
  }).filter(Boolean)
    .sort((a, b) => new Date(b.signal_at || b.updated_at || b.created_at || 0) - new Date(a.signal_at || a.updated_at || a.created_at || 0))
    .slice(0, limit);

  return { items, summary: partnerRefundCancellationSummary(items), warnings };
}

function partnerMetrics({ business, products, orders, paymentIntents, transactions, payouts, tickets, refundCancellations = [] }) {
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
    refund_cancellation_pending_count: refundCancellations.filter((item) => item.request_status === "pending_partner").length,
    refund_cancellation_dispute_count: refundCancellations.filter((item) => item.request_status === "dispute_admin_review").length,
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

function integrationConnectorFallbackRows() {
  return [
    {
      provider: "generic_feed",
      label: "CSV / JSON Feed",
      category: "feed",
      connector_mode: "generic_feed",
      availability: "free",
      stage: "enabled",
      inbound_supported: true,
      outbound_supported: false,
      free_enabled: true,
      premium_ready: true,
      secret_schema: INTEGRATION_SECRET_DEFINITIONS.generic_feed,
      default_settings: { default_publish_status: "draft", max_preview_rows: 50 },
      sort_order: 10
    },
    {
      provider: "woocommerce",
      label: "WooCommerce",
      category: "commerce",
      connector_mode: "native_api",
      availability: "free",
      stage: "starter",
      inbound_supported: true,
      outbound_supported: true,
      free_enabled: true,
      premium_ready: true,
      secret_schema: INTEGRATION_SECRET_DEFINITIONS.woocommerce,
      default_settings: { default_publish_status: "draft" },
      sort_order: 20
    },
    {
      provider: "shopify",
      label: "Shopify",
      category: "commerce",
      connector_mode: "native_api",
      availability: "premium",
      stage: "premium_ready",
      inbound_supported: true,
      outbound_supported: true,
      free_enabled: false,
      premium_ready: true,
      secret_schema: INTEGRATION_SECRET_DEFINITIONS.shopify,
      default_settings: { default_publish_status: "draft" },
      sort_order: 30
    },
    {
      provider: "trendyol",
      label: "Trendyol Pazaryeri",
      category: "marketplace",
      connector_mode: "native_api",
      availability: "premium",
      stage: "premium_ready",
      inbound_supported: true,
      outbound_supported: true,
      free_enabled: false,
      premium_ready: true,
      secret_schema: INTEGRATION_SECRET_DEFINITIONS.trendyol,
      default_settings: { default_publish_status: "draft" },
      sort_order: 40
    },
    {
      provider: "custom_api",
      label: "Özel API",
      category: "custom",
      connector_mode: "native_api",
      availability: "enterprise",
      stage: "premium_ready",
      inbound_supported: true,
      outbound_supported: true,
      free_enabled: false,
      premium_ready: true,
      secret_schema: INTEGRATION_SECRET_DEFINITIONS.custom_api,
      default_settings: { default_publish_status: "draft", requires_mapping: true },
      sort_order: 90
    }
  ];
}

function integrationSecretDefinitions(provider) {
  return INTEGRATION_SECRET_DEFINITIONS[provider] || [];
}

function integrationSecretContext(integrationId, secretKey) {
  return `partner_integration:${integrationId}:${secretKey}`;
}

function normalizeIntegrationSecretKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_:-]/g, "_")
    .slice(0, 90);
}

function connectorAllowsUse(connector) {
  if (!connector) return false;
  if (connector.free_enabled) return true;
  if (connector.availability === "premium") return config.integrations.premiumEnabled;
  if (connector.availability === "enterprise") return config.integrations.premiumEnabled;
  return false;
}

function connectorForProvider(connectors, provider) {
  return (connectors || []).find((item) => item.provider === provider)
    || integrationConnectorFallbackRows().find((item) => item.provider === provider)
    || null;
}

async function partnerIntegrationConnectors(warnings = []) {
  try {
    const rows = await optionalQuery(
      supabaseAdmin
        .from("partner_integration_connectors")
        .select("*")
        .order("sort_order", { ascending: true }),
      integrationConnectorFallbackRows(),
      warnings,
      "partner_integration_connectors"
    );
    return (rows || integrationConnectorFallbackRows()).map((connector) => ({
      ...connector,
      active_now: connectorAllowsUse(connector),
      outbound_active_now: Boolean(connector.outbound_supported && config.integrations.outboundEnabled && connectorAllowsUse(connector))
    }));
  } catch (error) {
    if (!looksLikeMissingSchema(error)) throw error;
    warnings.push("partner_integration_connectors: Supabase migration production veritabaninda eksik gorunuyor.");
    return integrationConnectorFallbackRows().map((connector) => ({
      ...connector,
      active_now: connectorAllowsUse(connector),
      outbound_active_now: false
    }));
  }
}

async function loadPartnerIntegration(business, integrationId) {
  const { data, error } = await supabaseAdmin
    .from("partner_integrations")
    .select("*")
    .eq("id", integrationId)
    .eq("partner_id", business.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw httpError("Entegrasyon bulunamadı.", 404);
  return data;
}

async function loadIntegrationSecrets(integrationId) {
  const { data, error } = await supabaseAdmin
    .from("partner_integration_secrets")
    .select("id, integration_id, secret_key, encrypted_value, status")
    .eq("integration_id", integrationId)
    .eq("status", "active");
  if (error) throw error;

  const secrets = {};
  for (const row of data || []) {
    secrets[row.secret_key] = decryptSecretValue(row.encrypted_value, integrationSecretContext(integrationId, row.secret_key));
  }
  return secrets;
}

function requireIntegrationSecrets(provider, secrets) {
  const missing = integrationSecretDefinitions(provider)
    .filter((definition) => definition.required && !String(secrets[definition.key] || "").trim())
    .map((definition) => definition.key);
  if (missing.length) {
    throw httpError(`Eksik entegrasyon bilgisi: ${missing.join(", ")}`, 409);
  }
}

function parseCsvRows(text) {
  const raw = String(text || "");
  const firstLine = raw.split(/\r?\n/).find((line) => line.trim()) || "";
  const delimiter = [";", "\t", ","].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const next = raw[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);

  const headers = (rows.shift() || []).map((header) => String(header || "").trim());
  return rows.map((values) => headers.reduce((entry, header, index) => {
    entry[header] = values[index] ?? "";
    return entry;
  }, {}));
}

function jsonProductRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.products)) return payload.products;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result?.products)) return payload.result.products;
  return [];
}

function firstValue(row, keys) {
  for (const key of keys) {
    if (row && Object.prototype.hasOwnProperty.call(row, key) && row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return "";
}

function numberFrom(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const normalized = String(value || "")
    .replace(/\s/g, "")
    .replace(/[₺$€]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function backendSlug(value) {
  return String(value || "urun")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "urun";
}

function imageFromRow(row) {
  const raw = firstValue(row, ["image_url", "image", "imageUrl", "thumbnail", "photo", "foto", "gorsel"]);
  if (raw) return String(raw).trim();
  if (Array.isArray(row?.images) && row.images.length) {
    const first = row.images[0];
    if (typeof first === "string") return first;
    return String(first?.src || first?.url || "").trim();
  }
  return "";
}

function normalizeIntegrationProduct(row, integration, index) {
  const name = String(firstValue(row, ["name", "product_name", "title", "urun_adi", "ürün adı", "ad"]) || "").trim();
  if (!name) return null;

  const externalId = String(firstValue(row, ["id", "product_id", "external_id", "sku", "code", "stok_kodu"]) || `row-${index + 1}`).trim();
  const variantId = String(firstValue(row, ["variant_id", "variation_id", "external_variant_id"]) || "").trim();
  const sku = String(firstValue(row, ["sku", "stock_code", "stok_kodu", "urun_kodu"]) || externalId).trim();
  const settings = integration.settings || {};
  const moduleKey = ["shop", "market", "food", "service"].includes(settings.module_key) ? settings.module_key : "shop";

  return {
    external_product_id: externalId,
    external_variant_id: variantId || null,
    external_sku: sku,
    name,
    description: String(firstValue(row, ["description", "short_description", "summary", "aciklama", "açıklama"]) || "").trim().slice(0, 1800),
    price: Math.max(0, numberFrom(firstValue(row, ["price", "regular_price", "sale_price", "fiyat", "tutar"]))),
    stock: Math.max(0, Math.floor(numberFrom(firstValue(row, ["stock", "stock_quantity", "inventory_quantity", "stok", "adet"])))),
    image_url: imageFromRow(row),
    category: String(firstValue(row, ["category", "categories", "kategori"]) || settings.default_category || "Genel").trim().slice(0, 90),
    brand: String(firstValue(row, ["brand", "vendor", "marka"]) || settings.default_brand || "").trim().slice(0, 120),
    module_key: moduleKey,
    raw: row
  };
}

function sourceHashFor(value) {
  return createHash("sha256").update(JSON.stringify(value || {})).digest("hex");
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, config.integrations.fetchTimeoutMs));
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchGenericFeedRows(secrets) {
  const feedUrl = String(secrets.FEED_URL || "").trim();
  if (!/^https?:\/\//i.test(feedUrl)) throw httpError("Feed URL http veya https olmalı.", 400);
  const response = await fetchWithTimeout(feedUrl, {
    headers: { Accept: "application/json,text/csv,text/plain;q=0.9,*/*;q=0.5" }
  });
  if (!response.ok) throw httpError(`Feed okunamadı: HTTP ${response.status}`, 502);
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const text = await response.text();
  if (contentType.includes("json") || /^[\s\r\n]*[\[{]/.test(text)) {
    return jsonProductRows(JSON.parse(text));
  }
  return parseCsvRows(text);
}

async function fetchWooCommerceRows(secrets, limit) {
  const baseUrl = String(secrets.API_BASE_URL || "").trim().replace(/\/$/, "");
  const consumerKey = String(secrets.CONSUMER_KEY || "").trim();
  const consumerSecret = String(secrets.CONSUMER_SECRET || "").trim();
  if (!/^https?:\/\//i.test(baseUrl)) throw httpError("WooCommerce mağaza URL http veya https olmalı.", 400);
  const url = new URL(`${baseUrl}/wp-json/wc/v3/products`);
  url.searchParams.set("per_page", String(Math.min(Math.max(limit || 50, 1), 100)));
  url.searchParams.set("status", "publish");
  const response = await fetchWithTimeout(url.href, {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64")}`
    }
  });
  if (!response.ok) throw httpError(`WooCommerce ürünleri okunamadı: HTTP ${response.status}`, 502);
  return jsonProductRows(await response.json());
}

async function fetchIntegrationRows(integration, secrets, limit) {
  if (!config.integrations.remoteFetchEnabled) {
    throw httpError("Uzaktan ürün okuma şu anda kapalı.", 503);
  }
  if (integration.provider === "generic_feed") return fetchGenericFeedRows(secrets, limit);
  if (integration.provider === "woocommerce") return fetchWooCommerceRows(secrets, limit);
  throw httpError("Bu connector altyapıda hazır, canlı senkron premium açılış bayrağı bekliyor.", 409);
}

async function applyIntegrationProducts({ business, integration, products }) {
  const result = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  const externalIds = products.map((item) => item.external_product_id).filter(Boolean);
  const { data: existingLinks, error: linkError } = await supabaseAdmin
    .from("partner_integration_product_links")
    .select("*")
    .eq("integration_id", integration.id)
    .in("external_product_id", externalIds.length ? externalIds : ["__none__"]);
  if (linkError) throw linkError;

  const linkMap = new Map((existingLinks || []).map((link) => [`${link.external_product_id}:${link.external_variant_id || ""}`, link]));

  for (const item of products) {
    const key = `${item.external_product_id}:${item.external_variant_id || ""}`;
    const hash = sourceHashFor(item.raw);
    const existing = linkMap.get(key);
    try {
      if (existing?.source_hash === hash && existing.product_id) {
        result.skipped += 1;
        continue;
      }

      const productPayload = {
        name: item.name,
        description: item.description,
        price: item.price,
        stock: item.stock,
        image_url: item.image_url || null,
        category: item.category || "Genel",
        module_key: item.module_key || "shop",
        status: integration.default_publish_status || "draft",
        slug: backendSlug(`${item.name}-${integration.provider}-${item.external_product_id}-${item.external_variant_id || ""}`),
        meta_title: item.name,
        meta_description: item.description,
        brand: item.brand || business.display_name || "",
        partner_id: business.owner_id
      };

      let productId = existing?.product_id || null;
      if (productId) {
        const { error: productUpdateError } = await supabaseAdmin
          .from("products")
          .update(productPayload)
          .eq("id", productId);
        if (productUpdateError) throw productUpdateError;
        result.updated += 1;
      } else {
        const { data: product, error: productInsertError } = await supabaseAdmin
          .from("products")
          .insert(productPayload)
          .select("id")
          .single();
        if (productInsertError) throw productInsertError;
        productId = product.id;
        result.created += 1;
      }

      const linkPayload = {
        partner_id: business.id,
        integration_id: integration.id,
        product_id: productId,
        external_product_id: item.external_product_id,
        external_variant_id: item.external_variant_id,
        external_sku: item.external_sku || null,
        source_hash: hash,
        sync_status: productId === existing?.product_id ? "updated" : "created",
        last_payload: item.raw || {},
        last_synced_at: new Date().toISOString()
      };

      if (existing) {
        const { error: updateLinkError } = await supabaseAdmin
          .from("partner_integration_product_links")
          .update(linkPayload)
          .eq("id", existing.id);
        if (updateLinkError) throw updateLinkError;
      } else {
        const { error: insertLinkError } = await supabaseAdmin
          .from("partner_integration_product_links")
          .insert(linkPayload);
        if (insertLinkError) throw insertLinkError;
      }
    } catch (error) {
      result.failed += 1;
      result.errors.push({ external_product_id: item.external_product_id, message: error.message });
    }
  }

  return result;
}

async function runPartnerIntegrationSync({ business, integration, payload, request }) {
  if (payload.direction === "outbound" && !config.integrations.outboundEnabled) {
    throw httpError("Dış platformlara yayın şu anda premium açılış bayrağı bekliyor.", 409);
  }
  if (payload.mode === "apply" && payload.direction === "outbound") {
    throw httpError("Outbound publish kuyruğu hazır, canlı gönderim henüz kapalı.", 409);
  }

  const limit = Math.min(
    Math.max(Number(payload.limit || (payload.mode === "apply" ? config.integrations.maxApplyRows : config.integrations.maxPreviewRows)), 1),
    payload.mode === "apply" ? config.integrations.maxApplyRows : config.integrations.maxPreviewRows
  );

  const { data: run, error: runError } = await supabaseAdmin
    .from("partner_integration_runs")
    .insert({
      partner_id: business.id,
      integration_id: integration.id,
      direction: payload.direction,
      trigger_source: payload.trigger_source,
      run_mode: payload.mode,
      status: "running",
      summary: { provider: integration.provider, limit }
    })
    .select("*")
    .single();
  if (runError) throw runError;

  try {
    const secrets = await loadIntegrationSecrets(integration.id);
    requireIntegrationSecrets(integration.provider, secrets);
    const rawRows = await fetchIntegrationRows(integration, secrets, limit);
    const products = rawRows
      .slice(0, limit)
      .map((row, index) => normalizeIntegrationProduct(row, integration, index))
      .filter(Boolean);

    let applyResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
    if (payload.mode === "apply") {
      applyResult = await applyIntegrationProducts({ business, integration, products });
    }

    const status = applyResult.failed > 0 ? "partial" : "success";
    const summary = {
      provider: integration.provider,
      mode: payload.mode,
      preview: products.slice(0, 12).map((item) => ({
        external_product_id: item.external_product_id,
        name: item.name,
        price: item.price,
        stock: item.stock,
        category: item.category,
        module_key: item.module_key
      })),
      errors: applyResult.errors.slice(0, 10)
    };

    const { data: updatedRun, error: updateRunError } = await supabaseAdmin
      .from("partner_integration_runs")
      .update({
        status,
        checked_count: products.length,
        created_count: applyResult.created,
        updated_count: applyResult.updated,
        skipped_count: applyResult.skipped,
        failed_count: applyResult.failed,
        summary,
        finished_at: new Date().toISOString()
      })
      .eq("id", run.id)
      .select("*")
      .single();
    if (updateRunError) throw updateRunError;

    const nextSyncAt = integration.sync_mode === "scheduled"
      ? new Date(Date.now() + Number(integration.sync_interval_minutes || 1440) * 60 * 1000).toISOString()
      : integration.next_sync_at;
    await supabaseAdmin
      .from("partner_integrations")
      .update({
        status: integration.status === "draft" ? "active" : integration.status,
        last_sync_at: new Date().toISOString(),
        last_success_at: status === "success" ? new Date().toISOString() : integration.last_success_at,
        last_error_at: status === "partial" ? new Date().toISOString() : null,
        last_error_message: status === "partial" ? `${applyResult.failed} ürün işlenemedi.` : null,
        next_sync_at: nextSyncAt
      })
      .eq("id", integration.id);

    await auditEvent({
      request,
      actorId: request?.integrationActorId || null,
      actorRole: request?.integrationActorRole || "system",
      action: "partner.integration_sync_completed",
      resourceType: "partner_integration",
      resourceId: integration.id,
      metadata: { provider: integration.provider, mode: payload.mode, status, checked_count: products.length }
    });

    return updatedRun;
  } catch (error) {
    await supabaseAdmin
      .from("partner_integration_runs")
      .update({
        status: "failed",
        error_message: error.message || "Entegrasyon senkronu tamamlanamadı.",
        failed_count: 1,
        summary: { provider: integration.provider, message: error.message },
        finished_at: new Date().toISOString()
      })
      .eq("id", run.id);

    await supabaseAdmin
      .from("partner_integrations")
      .update({
        status: "needs_attention",
        last_error_at: new Date().toISOString(),
        last_error_message: error.message || "Entegrasyon senkronu tamamlanamadı."
      })
      .eq("id", integration.id);

    throw error;
  }
}

export function registerRoutes(app) {
  const aliasRoute = (method, paths, handler) => {
    for (const path of paths) {
      app[method](path, handler);
    }
  };
  const opsGet = (suffix, handler) => aliasRoute("get", [`/v1/admin/ops${suffix}`, `/v1/ops-console${suffix}`], handler);
  const opsPost = (suffix, handler) => aliasRoute("post", [`/v1/admin/ops${suffix}`, `/v1/ops-console${suffix}`], handler);
  const opsPatch = (suffix, handler) => aliasRoute("patch", [`/v1/admin/ops${suffix}`, `/v1/ops-console${suffix}`], handler);
  const superPaths = (suffix) => [`/v1/super-admin${suffix}`, `/v1/control-center${suffix}`, `/v1/owner-console${suffix}`];
  const superGet = (suffix, handler) => aliasRoute("get", superPaths(suffix), handler);
  const superPost = (suffix, handler) => aliasRoute("post", superPaths(suffix), handler);
  const superPatch = (suffix, handler) => aliasRoute("patch", superPaths(suffix), handler);

	  app.get("/health", async () => ({
	    ok: true,
	    service: "allonahub-backend",
	    build: BACKEND_BUILD_MARKER,
	    super_admin_action_health_route: true,
	    time: new Date().toISOString()
	  }));

  app.get("/ready", async (_request, reply) => {
    const { error } = await supabaseAdmin.from("profiles").select("id", { count: "exact", head: true });
    if (error) {
      return reply.code(503).send({ ok: false, message: "Supabase bağlantısı hazır değil." });
    }
    return { ok: true };
  });

  app.post("/v1/auth/turnstile", async (request) => {
    const payload = parseAuthPayload(authTurnstileSchema, request.body);
    const challenge = await verifyTurnstile(request, payload.action, payload.turnstileToken);
    await auditEvent({
      request,
      action: "auth.turnstile_verified",
      severity: "info",
      metadata: {
        action: payload.action,
        skipped: challenge.skipped
      },
      evidenceTags: ["auth", "turnstile"]
    });
    return { ok: true, skipped: challenge.skipped };
  });

  app.post("/v1/auth/login", async (request, reply) => {
    const payload = parseAuthPayload(authLoginSchema, request.body);
    const email = authEmail(payload.email);
    await verifyTurnstile(request, "login", payload.turnstileToken);

    const { data, error } = await supabasePublic.auth.signInWithPassword({
      email,
      password: payload.password
    });

    if (error || !data?.session || !data?.user) {
      await auditEvent({
        request,
        action: "auth.login_failed",
        severity: "warning",
        metadata: {
          email_hash: authEmailHash(email),
          email_domain: authEmailDomain(email),
          code: error?.code || null
        },
        evidenceTags: ["auth", "login", "failed"]
      });
      return reply.code(401).send({ ok: false, message: "E-posta veya şifre doğru değil." });
    }

    await auditEvent({
      request,
      actorId: data.user.id,
      actorRole: "customer",
      action: "auth.login_success",
      severity: "info",
      metadata: {
        email_domain: authEmailDomain(email),
        aal: data.session?.user?.aal || "aal1"
      },
      evidenceTags: ["auth", "login"]
    });

    return {
      ok: true,
      user: publicAuthUser(data.user),
      session: data.session
    };
  });

  app.post("/v1/auth/register", async (request, reply) => {
    const payload = parseAuthPayload(authRegisterSchema, request.body);
    const email = authEmail(payload.email);
    await verifyTurnstile(request, "register", payload.turnstileToken);

    const { data, error } = await supabasePublic.auth.signUp({
      email,
      password: payload.password,
      options: {
        data: authUserMetadata(payload),
        emailRedirectTo: new URL("/pages/account/user.html?tab=login", `${config.siteUrl}/`).href
      }
    });

    if (error || !data?.user) {
      await auditEvent({
        request,
        action: "auth.register_failed",
        severity: "warning",
        metadata: {
          email_hash: authEmailHash(email),
          email_domain: authEmailDomain(email),
          code: error?.code || null
        },
        evidenceTags: ["auth", "register", "failed"]
      });
      return reply.code(400).send({ ok: false, message: "Kayıt oluşturulamadı. Lütfen bilgilerinizi kontrol edin." });
    }

    await upsertAuthProfile(data.user, { ...payload, email }, request);

    await auditEvent({
      request,
      actorId: data.user.id,
      actorRole: "customer",
      action: "auth.register_success",
      severity: "info",
      metadata: {
        email_domain: authEmailDomain(email),
        session_created: Boolean(data.session)
      },
      evidenceTags: ["auth", "register"]
    });

    return reply.code(201).send({
      ok: true,
      user: publicAuthUser(data.user),
      session: data.session || null
    });
  });

  app.post("/v1/auth/forgot-password", async (request, reply) => {
    const payload = parseAuthPayload(authForgotPasswordSchema, request.body);
    const email = authEmail(payload.email);
    await verifyTurnstile(request, "forgot_password", payload.turnstileToken);

    const { error } = await supabasePublic.auth.resetPasswordForEmail(email, {
      redirectTo: resetPasswordRedirectUrl()
    });

    await auditEvent({
      request,
      action: error ? "auth.password_reset_delivery_failed" : "auth.password_reset_requested",
      severity: error ? "warning" : "info",
      metadata: {
        email_hash: authEmailHash(email),
        email_domain: authEmailDomain(email),
        redirect_to: resetPasswordRedirectUrl(),
        code: error?.code || null
      },
      evidenceTags: ["auth", "password_reset"]
    });

    if (error) {
      request.log.warn({ error: error.message, emailDomain: authEmailDomain(email) }, "Password reset email could not be requested");
    }

    return reply.code(202).send({ ok: true });
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

    const orders = summarizePartnerOrders(ordersResult.data || [], ownerId, isAdminUser, ctx.user.id);
    const refundWarnings = [];
    const refundCancellations = await loadPartnerRefundCancellations({
      orders,
      ownerId,
      userId: ctx.user.id,
      isAdminUser,
      warnings: refundWarnings,
      limit: 120
    });
    const metrics = partnerMetrics({
      business,
      products: productsResult.data || [],
      orders,
      paymentIntents: intentsResult.data || [],
      transactions: transactionsResult.data || [],
      payouts: payoutsResult.data || [],
      tickets: ticketsResult.data || [],
      refundCancellations: refundCancellations.items
    });
    const integrationWarnings = [];
    const [integrationConnectors, integrations, integrationRuns, integrationSecretRows] = await Promise.all([
      partnerIntegrationConnectors(integrationWarnings),
      optionalQuery(
        supabaseAdmin
          .from("partner_integrations")
          .select("*")
          .eq("partner_id", business.id)
          .order("updated_at", { ascending: false }),
        [],
        integrationWarnings,
        "partner_integrations"
      ),
      optionalQuery(
        supabaseAdmin
          .from("partner_integration_runs")
          .select("*")
          .eq("partner_id", business.id)
          .order("started_at", { ascending: false })
          .limit(30),
        [],
        integrationWarnings,
        "partner_integration_runs"
      ),
      optionalQuery(
        supabaseAdmin
          .from("partner_integration_secrets")
          .select("integration_id, secret_key, status, last_verified_at, updated_at")
          .eq("partner_id", business.id)
          .order("secret_key", { ascending: true }),
        [],
        integrationWarnings,
        "partner_integration_secrets"
      )
    ]);

    const secretStatusesByIntegration = (integrationSecretRows || []).reduce((map, row) => {
      if (!map[row.integration_id]) map[row.integration_id] = [];
      map[row.integration_id].push({
        secret_key: row.secret_key,
        status: row.status,
        last_verified_at: row.last_verified_at,
        updated_at: row.updated_at
      });
      return map;
    }, {});
    const integrationRows = (integrations || []).map((integration) => ({
      ...integration,
      secrets: secretStatusesByIntegration[integration.id] || []
    }));

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "partner.os_viewed",
      resourceType: "partner_business",
      resourceId: business.id,
      metadata: {
        product_count: metrics.product_count,
        order_count: metrics.order_count,
        refund_cancellation_count: refundCancellations.summary.total,
        integration_count: integrationRows.length
      }
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
      refundCancellations: refundCancellations.items,
      refundCancellationSummary: refundCancellations.summary,
      refundWarnings,
      integrations: integrationRows,
      integrationConnectors,
      integrationRuns: integrationRuns || [],
      integrationWarnings,
      metrics,
      recommendations: partnerRecommendations(metrics, devicesResult.data || [])
    };
  });

  app.get("/v1/partner/refund-cancellations", async (request) => {
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      action: "partner.refund_cancellations.list"
    });
    const business = await ensurePartnerBusiness(ctx, request);
    const ownerId = business.owner_id || ctx.user.id;
    const isAdminUser = isAdmin(ctx.profile);
    const query = z.object({
      limit: z.coerce.number().int().min(1).max(120).optional().default(80)
    }).parse(request.query || {});
    const warnings = [];
    const orderRows = await optionalQuery(
      supabaseAdmin
        .from("orders")
        .select("*, order_items(*, product:products(id, name, category, partner_id))")
        .order("created_at", { ascending: false })
        .limit(200),
      [],
      warnings,
      "orders"
    );
    const refundCancellations = await loadPartnerRefundCancellations({
      orders: orderRows,
      ownerId,
      userId: ctx.user.id,
      isAdminUser,
      limit: query.limit,
      warnings
    });

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "partner.refund_cancellations_viewed",
      resourceType: "partner_business",
      resourceId: business.id,
      metadata: {
        total: refundCancellations.summary.total,
        pending_partner: refundCancellations.summary.pending_partner,
        disputes: refundCancellations.summary.disputes
      }
    });

    return {
      ok: true,
      items: refundCancellations.items,
      summary: refundCancellations.summary,
      provider_status: paymentProviderDispatchStatus(),
      warnings
    };
  });

  app.post("/v1/partner/refund-cancellations/:orderId/decision", async (request) => {
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      action: "partner.refund_cancellation.decision"
    });
    const { orderId } = z.object({ orderId: uuidSchema }).parse(request.params || {});
    const body = partnerRefundCancellationDecisionSchema.parse(request.body || {});
    const business = await ensurePartnerBusiness(ctx, request);
    const ownerId = business.owner_id || ctx.user.id;
    const isAdminUser = isAdmin(ctx.profile);
    const warnings = [];
    const before = await optionalQuery(
      supabaseAdmin
        .from("orders")
        .select("*, order_items(*, product:products(id, name, category, partner_id))")
        .eq("id", orderId)
        .maybeSingle(),
      null,
      warnings,
      "orders"
    );
    if (!before) throw httpError("Sipariş bulunamadı.", 404);
    if (!partnerCanAccessOrder(before, ownerId, isAdminUser, ctx.user.id)) {
      throw httpError("Bu sipariş için iade/iptal kararı verme yetkiniz yok.", 403);
    }
    const currentRefundState = await loadPartnerRefundCancellations({
      orders: [before],
      ownerId,
      userId: ctx.user.id,
      isAdminUser,
      limit: 5,
      warnings
    });
    const currentRefundItem = currentRefundState.items.find((item) => String(item.id) === String(orderId));
    if (!isAdminUser && !currentRefundItem?.decision_required) {
      throw httpError("Bu sipariş için partner kararı bekleyen iade/iptal talebi bulunmuyor.", 409);
    }
    if (!isAdminUser && currentRefundItem?.type === "cancellation" && body.action === "approve_refund") {
      throw httpError("İptal talebi iade olarak onaylanamaz.", 409);
    }
    if (!isAdminUser && currentRefundItem?.type === "refund" && body.action === "approve_cancellation") {
      throw httpError("İade talebi iptal olarak onaylanamaz.", 409);
    }

    let updated = before;
    let providerDispatch = null;
    const updatePayload = {};
    if (body.action === "approve_cancellation") {
      updatePayload.order_status = "cancelled";
      updatePayload.status = "cancelled";
    }
    if (body.action === "approve_refund") {
      updatePayload.order_status = "refunded";
      updatePayload.status = "refunded";
      updatePayload.payment_status = "refunded";
    }
    if (Object.keys(updatePayload).length) {
      updated = {
        ...before,
        ...(await updateRefundCancellationOrder(orderId, updatePayload, warnings)),
        order_items: before.order_items || []
      };
      const providerContext = await loadOrderPaymentProviderContext(orderId, warnings);
      providerDispatch = await notifyPaymentProviderRefundCancellation({
        action: body.action,
        order: updated,
        context: providerContext,
        reason: body.reason,
        note: body.note,
        actorId: ctx.user.id,
        ip: clientIp(request)
      });
    }

    const actionLabels = {
      approve_cancellation: "Partner iptal talebini kabul etti",
      approve_refund: "Partner iade talebini kabul etti",
      reject_request: "Partner talebi reddetti ve admin ihtilaf incelemesine gönderdi"
    };
    const noteBody = [
      `${actionLabels[body.action]}: ${body.reason}`,
      body.note ? `Ek açıklama: ${body.note}` : "",
      body.action === "reject_request" ? "Ödeme kuruluşu bildirimi yapılmadı; admin hakem kararı bekleniyor." : ""
    ].filter(Boolean).join("\n").slice(0, 1550);
    const flagStatus = body.action === "reject_request" ? "in_review" : "resolved";
    const flagSeverity = body.action === "approve_refund" || body.action === "reject_request" ? "critical" : "warning";
    const metadata = {
      partner_action: body.action,
      partner_decision: body.action,
      partner_business_id: business.id,
      partner_owner_id: ownerId,
      order_status_before: before.order_status || before.status || null,
      payment_status_before: before.payment_status || null,
      order_status_after: updated.order_status || updated.status || null,
      payment_status_after: updated.payment_status || null,
      provider_dispatch: providerDispatch,
      dispute_status: body.action === "reject_request" ? "admin_review_required" : null,
      payment_provider_notified: Boolean(providerDispatch?.ok)
    };

    const notePromise = optionalMutation(
      supabaseAdmin
        .from("admin_operation_notes")
        .insert({
          author_id: ctx.user.id,
          target_type: "order",
          target_id: orderId,
          note_type: body.action === "reject_request" ? "support" : "review",
          visibility: "admin",
          body: noteBody
        })
        .select("*")
        .single(),
      warnings,
      "admin_operation_notes"
    );
    const flagPromise = optionalMutation(
      supabaseAdmin
        .from("admin_operation_flags")
        .insert({
          flagged_by: ctx.user.id,
          target_type: "order",
          target_id: orderId,
          flag_type: "risky_order",
          severity: flagSeverity,
          status: flagStatus,
          reason: noteBody.slice(0, 1150),
          metadata
        })
        .select("*")
        .single(),
      warnings,
      "admin_operation_flags"
    );
    const supportTicketPromise = body.action === "reject_request"
      ? optionalMutation(
          supabaseAdmin
            .from("support_tickets")
            .insert({
              user_id: ctx.user.id,
              requester_type: "partner",
              category: "refund_cancellation",
              priority: "urgent",
              title: `İade/iptal ihtilafı - ${before.order_no || before.order_number || orderId}`.slice(0, 176),
              message: [
                "Partner iade/iptal talebini reddetti ve admin hakem incelemesine gönderdi.",
                `Sipariş: ${before.order_no || before.order_number || orderId}`,
                `Partner: ${business.display_name || business.legal_name || business.id}`,
                `Karar nedeni: ${body.reason}`,
                body.note ? `Partner açıklaması: ${body.note}` : ""
              ].filter(Boolean).join("\n").slice(0, 2900),
              status: "open",
              metadata: {
                source: "partner_panel",
                order_id: orderId,
                order_no: before.order_no || before.order_number || orderId,
                request_type: currentRefundItem?.type || refundCancellationSignalType(before),
                partner_business_id: business.id,
                partner_decision: "reject_request",
                dispute_status: "admin_review_required",
                payment_provider_notified: false
              }
            })
            .select("id, status, created_at")
            .single(),
          warnings,
          "support_tickets"
        )
      : Promise.resolve(null);
    const [note, flag, supportTicket] = await Promise.all([notePromise, flagPromise, supportTicketPromise]);

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: `partner.refund_cancellation_${body.action}`,
      resourceType: "order",
      resourceId: orderId,
      severity: flagSeverity,
      purpose: "partner_refund_cancellation_control",
      evidenceTags: ["partner_os", "refund_cancellation", body.action],
      metadata: {
        reason: body.reason,
        note: body.note || null,
        partner_business_id: business.id,
        note_id: note?.id || null,
        flag_id: flag?.id || null,
        support_ticket_id: supportTicket?.id || null,
        provider_dispatch: providerDispatch
      }
    });

    return {
      ok: true,
      item: refundCancellationPublic(updated, {
        type: body.action === "approve_cancellation" ? "cancellation" : (body.action === "approve_refund" ? "refund" : (currentRefundItem?.type || refundCancellationSignalType(before))),
        notes: [note].filter(Boolean),
        flags: [flag].filter(Boolean),
        provider_dispatch: providerDispatch,
        request_status: body.action === "reject_request" ? "dispute_admin_review" : "approved",
        decision_required: false,
        partner_decision: body.action,
        order_items: partnerOrderItems(before, ownerId, isAdminUser, ctx.user.id)
      }),
      note,
      flag,
      support_ticket: supportTicket,
      provider_dispatch: providerDispatch,
      warnings
    };
  });

  app.get("/v1/partner/integrations", async (request) => {
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      action: "partner.integrations.list"
    });
    const business = await ensurePartnerBusiness(ctx, request);
    const warnings = [];
    const connectors = await partnerIntegrationConnectors(warnings);
    const [integrations, runs, secretRows] = await Promise.all([
      optionalQuery(
        supabaseAdmin
          .from("partner_integrations")
          .select("*")
          .eq("partner_id", business.id)
          .order("updated_at", { ascending: false }),
        [],
        warnings,
        "partner_integrations"
      ),
      optionalQuery(
        supabaseAdmin
          .from("partner_integration_runs")
          .select("*")
          .eq("partner_id", business.id)
          .order("started_at", { ascending: false })
          .limit(30),
        [],
        warnings,
        "partner_integration_runs"
      ),
      optionalQuery(
        supabaseAdmin
          .from("partner_integration_secrets")
          .select("integration_id, secret_key, status, last_verified_at, updated_at")
          .eq("partner_id", business.id)
          .order("secret_key", { ascending: true }),
        [],
        warnings,
        "partner_integration_secrets"
      )
    ]);

    const secretStatusesByIntegration = (secretRows || []).reduce((map, row) => {
      if (!map[row.integration_id]) map[row.integration_id] = [];
      map[row.integration_id].push({
        secret_key: row.secret_key,
        status: row.status,
        last_verified_at: row.last_verified_at,
        updated_at: row.updated_at
      });
      return map;
    }, {});

    return {
      ok: true,
      connectors,
      integrations: (integrations || []).map((integration) => ({
        ...integration,
        secrets: secretStatusesByIntegration[integration.id] || []
      })),
      runs,
      warnings,
      policy: {
        enabled: config.integrations.enabled,
        premium_enabled: config.integrations.premiumEnabled,
        outbound_enabled: config.integrations.outboundEnabled,
        max_preview_rows: config.integrations.maxPreviewRows,
        max_apply_rows: config.integrations.maxApplyRows
      }
    };
  });

  app.post("/v1/partner/integrations", async (request, reply) => {
    if (!config.integrations.enabled) throw httpError("Partner entegrasyonları şu anda kapalı.", 503);
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      action: "partner.integration.upsert"
    });
    const business = await ensurePartnerBusiness(ctx, request);
    const payload = partnerIntegrationSchema.parse(request.body || {});
    const connectors = await partnerIntegrationConnectors([]);
    const connector = connectorForProvider(connectors, payload.provider);
    if (!connector) throw httpError("Bu connector tanımlı değil.", 400);
    if (!connectorAllowsUse(connector)) {
      throw httpError("Bu connector premium açılış bayrağı bekliyor.", 409);
    }
    if (payload.export_enabled && !config.integrations.outboundEnabled) {
      throw httpError("Dış platformlara yayın şu anda premium açılış bayrağı bekliyor.", 409);
    }

    const nextSyncAt = payload.sync_mode === "scheduled"
      ? new Date(Date.now() + Number(payload.sync_interval_minutes || 1440) * 60 * 1000).toISOString()
      : null;
    const planTier = connector.availability === "free" ? "free" : connector.availability === "enterprise" ? "enterprise" : "premium";
    const row = {
      partner_id: business.id,
      provider: payload.provider,
      display_name: payload.display_name,
      connection_mode: payload.connection_mode || connector.connector_mode || "generic_feed",
      direction: payload.export_enabled ? "bidirectional" : payload.direction,
      status: payload.status,
      plan_tier: payload.plan_tier === "free" ? planTier : payload.plan_tier,
      sync_mode: payload.sync_mode,
      sync_interval_minutes: payload.sync_interval_minutes,
      next_sync_at: nextSyncAt,
      import_enabled: payload.import_enabled,
      export_enabled: payload.export_enabled,
      default_publish_status: payload.default_publish_status,
      settings: {
        ...(connector.default_settings || {}),
        ...(payload.settings || {}),
        onboarding_offer: "free_partner_acquisition",
        upgrade_path: connector.premium_ready ? "premium_connector_pack" : "starter"
      },
      updated_by: ctx.user.id
    };

    let integration;
    if (payload.id) {
      const existing = await loadPartnerIntegration(business, payload.id);
      const { data, error } = await supabaseAdmin
        .from("partner_integrations")
        .update(row)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      integration = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from("partner_integrations")
        .insert({ ...row, created_by: ctx.user.id })
        .select("*")
        .single();
      if (error) throw error;
      integration = data;
    }

    const secretStatuses = [];
    for (const [rawKey, rawValue] of Object.entries(payload.secrets || {})) {
      const secretValue = String(rawValue || "").trim();
      if (!secretValue) continue;
      const secretKey = normalizeIntegrationSecretKey(rawKey);
      if (!secretKey) continue;
      const definition = integrationSecretDefinitions(payload.provider).find((item) => item.key === secretKey) || { label: secretKey };
      const encryptedValue = encryptSecretValue(secretValue, integrationSecretContext(integration.id, secretKey));
      const { data: secret, error: secretError } = await supabaseAdmin
        .from("partner_integration_secrets")
        .upsert({
          partner_id: business.id,
          integration_id: integration.id,
          secret_key: secretKey,
          secret_label: definition.label || secretKey,
          encrypted_value: encryptedValue,
          status: "active",
          updated_by: ctx.user.id
        }, { onConflict: "integration_id,secret_key" })
        .select("integration_id, secret_key, status, last_verified_at, updated_at")
        .single();
      if (secretError) throw secretError;
      secretStatuses.push(secret);
    }

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: payload.id ? "partner.integration_updated" : "partner.integration_created",
      resourceType: "partner_integration",
      resourceId: integration.id,
      metadata: {
        provider: integration.provider,
        sync_mode: integration.sync_mode,
        import_enabled: integration.import_enabled,
        export_enabled: integration.export_enabled,
        secret_keys: Object.keys(payload.secrets || {}).map(normalizeIntegrationSecretKey)
      }
    });

    return reply.code(payload.id ? 200 : 201).send({
      ok: true,
      integration: { ...integration, secrets: secretStatuses }
    });
  });

  app.post("/v1/partner/integrations/:integrationId/test", async (request) => {
    if (!config.integrations.enabled) throw httpError("Partner entegrasyonları şu anda kapalı.", 503);
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      action: "partner.integration.test"
    });
    const business = await ensurePartnerBusiness(ctx, request);
    const integrationId = uuidSchema.parse(request.params.integrationId);
    const integration = await loadPartnerIntegration(business, integrationId);
    const secrets = await loadIntegrationSecrets(integration.id);
    requireIntegrationSecrets(integration.provider, secrets);

    const now = new Date().toISOString();
    const keys = Object.keys(secrets);
    await supabaseAdmin
      .from("partner_integration_secrets")
      .update({ last_verified_at: now, updated_by: ctx.user.id })
      .eq("integration_id", integration.id)
      .in("secret_key", keys.length ? keys : ["__none__"]);
    const { data: updated, error } = await supabaseAdmin
      .from("partner_integrations")
      .update({
        status: integration.status === "draft" || integration.status === "needs_attention" ? "active" : integration.status,
        last_error_at: null,
        last_error_message: null,
        updated_by: ctx.user.id
      })
      .eq("id", integration.id)
      .select("*")
      .single();
    if (error) throw error;

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "partner.integration_tested",
      resourceType: "partner_integration",
      resourceId: integration.id,
      metadata: { provider: integration.provider, secret_count: keys.length }
    });

    return {
      ok: true,
      integration: updated,
      result: {
        status: "configuration_ready",
        provider: integration.provider,
        checked_secret_keys: keys,
        remote_probe: config.integrations.remoteFetchEnabled ? "available_during_sync" : "disabled"
      }
    };
  });

  app.post("/v1/partner/integrations/:integrationId/sync", async (request) => {
    if (!config.integrations.enabled) throw httpError("Partner entegrasyonları şu anda kapalı.", 503);
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      action: "partner.integration.sync"
    });
    const business = await ensurePartnerBusiness(ctx, request);
    const integrationId = uuidSchema.parse(request.params.integrationId);
    const integration = await loadPartnerIntegration(business, integrationId);
    const payload = partnerIntegrationSyncSchema.parse(request.body || {});
    request.integrationActorId = ctx.user.id;
    request.integrationActorRole = ctx.profile.role;
    const run = await runPartnerIntegrationSync({ business, integration, payload, request });
    return { ok: true, run };
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
      .select("id, order_status, tracking_number, order_items(partner_id, product:products(id, partner_id))")
      .eq("id", payload.orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) throw httpError("Sipariş bulunamadı.", 404);
    const canUpdate = isAdmin(ctx.profile) || (order.order_items || []).some((item) => item.partner_id === ctx.user.id || item.product?.partner_id === ctx.user.id);
    if (!canUpdate) throw httpError("Bu siparişi güncelleme yetkiniz yok.", 403);

    const updatePayload = {};
    if (payload.order_status) {
      updatePayload.order_status = payload.order_status;
      updatePayload.status = payload.order_status;
      updatePayload.partner_status = payload.order_status;
    }
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

  superGet("/owner-session", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.owner_session.view");
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.owner_session_viewed",
      source: "admin",
      resourceType: "super_admin_owner_session",
      metadata: {
        owner_source: ctx.superAdminOwner?.source || "unknown",
        gitops_enabled: config.superAdmin.gitOpsEnabled
      }
    });

    return {
      ok: true,
      owner: {
        user_id: ctx.user.id,
        email: superAdminOwnerEmail(ctx),
        role: ctx.profile.role,
        source: ctx.superAdminOwner?.source || "unknown",
        mfa_verified: ctx.mfaVerified === true,
        owner_locked: true,
        bootstrap_required: ctx.superAdminOwnerBootstrap === true
      },
      gitops: {
        enabled: config.superAdmin.gitOpsEnabled,
        release_webhook_configured: Boolean(config.superAdmin.releaseWebhookUrl && config.superAdmin.releaseWebhookSecret)
      },
      control_links: SUPER_ADMIN_CONTROL_LINKS
    };
  });

  superGet("/owner-preflight", async (request) => {
    const ctx = await requireAuth(request, {
      adminBoundary: true,
      action: "super_admin.owner_preflight"
    });
    if (!hasMfa(ctx)) {
      await auditEvent({
        request,
        actorId: ctx.user.id,
        actorRole: ctx.profile.role,
        action: "super_admin.owner_preflight_mfa_required",
        severity: "warning",
        source: "admin",
        purpose: "super_admin_owner_lock_diagnostics",
        evidenceTags: ["super_admin", "owner_lock", "mfa_required"],
        metadata: { aal: ctx.authenticatorAssuranceLevel }
      });
      throw httpError("Bu işlem için iki aşamalı doğrulama gerekli.", 403);
    }
    const owner = await superAdminOwnerPreflight(ctx);
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.owner_preflight_viewed",
      severity: owner.matched ? "warning" : "critical",
      source: "admin",
      purpose: "super_admin_owner_lock_diagnostics",
      evidenceTags: ["super_admin", "owner_lock", "preflight"],
      metadata: {
        owner_configured: owner.configured,
        owner_matched: owner.matched,
        owner_source: owner.source || "none",
        env_configured: owner.env.configured,
        db_configured: owner.database.configured,
        db_warning: owner.warning?.message || null
      }
    });

    return {
      ok: true,
      preflight: {
        user_id: ctx.user.id,
        email: owner.email || superAdminOwnerEmail(ctx),
        role: ctx.profile.role,
        mfa_verified: ctx.mfaVerified === true,
        owner
      }
    };
  });

  superPost("/owner-bootstrap", async (request) => {
    const ctx = await requireOwnerCandidate(request, "super_admin.owner_bootstrap.self");
    const result = await ownerSelfBootstrapSuperAdmin({ ctx, request });
    return {
      ok: true,
      profile: publicProfile(result.profile),
      change: result.change ? permissionChangePublic(result.change) : null
    };
  });

  superPost("/owner-access-repair", async (request) => {
    const ctx = await requireAuth(request, {
      roles: ["admin", "super_admin"],
      mfa: true,
      adminBoundary: true,
      action: "super_admin.owner_access_repair"
    });
    const body = superAdminOwnerRepairSchema.parse(request.body || {});
    const result = await repairOwnerAccessForCurrentAdmin({
      ctx,
      request,
      reason: body.reason
    });

    return {
      ok: true,
      repaired: result.repaired,
      message: result.message || "Owner kaydı bu oturumla eşleştirildi.",
      owner_access: result.row ? {
        id: result.row.id,
        user_id: result.row.user_id,
        email: result.row.email,
        status: result.row.status,
        label: result.row.label,
        updated_at: result.row.updated_at
      } : null,
      profile: result.bootstrap?.profile ? publicProfile(result.bootstrap.profile) : null,
      change: result.bootstrap?.change ? permissionChangePublic(result.bootstrap.change) : null,
      bootstrap_completed: Boolean(result.bootstrap?.profile?.role === "super_admin")
    };
  });

  superGet("/command-center", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.command_center.view");
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
      readyCheck,
      releaseRows,
      recentSecurity,
      moduleRows
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
      runAdminQuery("database_ready", supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }), null),
      runAdminQuery(
        "super_admin_release_approvals",
        supabaseAdmin
          .from("super_admin_release_approvals")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20),
        []
      ),
      runAdminQuery(
        "super_admin_recent_security",
        supabaseAdmin
          .from("security_audit_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(30),
        []
      ),
      runAdminQuery(
        "platform_modules_command_center",
        supabaseAdmin
          .from("platform_modules")
          .select("*")
          .order("sort_order", { ascending: true }),
        []
      )
    ]);

    [users, partners, orders, pendingApplications, securityAlerts, revenueRows, readyCheck, releaseRows, recentSecurity, moduleRows]
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
    const releaseApprovals = (releaseRows.data || []).map(releaseApprovalPublic);
    const recentEvents = recentSecurity.data || [];
    const moduleMap = moduleOperationMapPublic(moduleRows.data || []);
    const criticalEvents = recentEvents.filter((event) => event.severity === "critical");
    const unresolvedApprovals = releaseApprovals.filter((item) => ["approved", "failed", "pending"].includes(item.status));
    const inactiveModules = moduleMap.filter((item) => item.is_active !== true || item.is_visible !== true);

    const risks = [
      config.emergencyApiDisabled ? {
        severity: "critical",
        title: "Acil API koruması aktif",
        message: "EMERGENCY_API_DISABLED true; canlı işlem akışı kapalı."
      } : null,
      config.maintenanceMode ? {
        severity: "high",
        title: "Bakım modu açık",
        message: "Platform bakım modunda çalışıyor."
      } : null,
      config.paymentsDisabled ? {
        severity: "critical",
        title: "Ödemeler durduruldu",
        message: "PAYMENTS_DISABLED true; ödeme akışı kapalı."
      } : null,
      securityAlerts.count > 0 ? {
        severity: "high",
        title: "Güvenlik uyarısı",
        message: `${securityAlerts.count} uyarı son 24 saatte audit akışına düştü.`
      } : null,
      pendingApplications.count > 0 ? {
        severity: "medium",
        title: "Bekleyen partner başvurusu",
        message: `${pendingApplications.count} başvuru karar bekliyor.`
      } : null,
      unresolvedApprovals.length > 0 ? {
        severity: "high",
        title: "Yayın onayı takibi",
        message: `${unresolvedApprovals.length} yayın/onay kaydı takip istiyor.`
      } : null,
      inactiveModules.length > 0 ? {
        severity: "medium",
        title: "Modül görünürlük uyarısı",
        message: `${inactiveModules.length} ana sayfa modülü pasif veya gizli görünüyor.`
      } : null,
      ...warnings.map((warning) => ({
        severity: "medium",
        title: warning.label || "Supabase şema uyarısı",
        message: warning.message || "Migration kontrol edilmeli."
      }))
    ].filter(Boolean);

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.command_center_viewed",
      source: "admin",
      resourceType: "super_admin_command_center",
      metadata: {
        risk_count: risks.length,
        warning_count: warnings.length,
        release_approval_count: releaseApprovals.length,
        homepage_module_count: moduleMap.length
      }
    });

    return {
      ok: true,
      owner: {
        user_id: ctx.user.id,
        email: superAdminOwnerEmail(ctx),
        source: ctx.superAdminOwner?.source || "unknown",
        owner_locked: true,
        role: ctx.profile.role,
        bootstrap_required: ctx.superAdminOwnerBootstrap === true
      },
      summary: {
        total_users: users.count,
        total_partners: partners.count,
        total_orders: orders.count,
        daily_revenue: Number(dailyRevenue.toFixed(2)),
        pending_applications: pendingApplications.count,
        security_alerts_24h: securityAlerts.count,
        critical_events_sample: criticalEvents.length,
        release_approvals: releaseApprovals.length,
        homepage_modules: moduleMap.length,
        future_operations: SUPER_ADMIN_FUTURE_OPERATIONS.length
      },
      system_health: {
        api: "online",
        build: BACKEND_BUILD_MARKER,
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
      risks,
      recent_security_events: recentEvents,
      release_approvals: releaseApprovals,
      module_map: {
        modules: moduleMap,
        future_operations: SUPER_ADMIN_FUTURE_OPERATIONS,
        inactive_count: inactiveModules.length
      },
      control_links: SUPER_ADMIN_CONTROL_LINKS,
      gitops: {
        enabled: config.superAdmin.gitOpsEnabled,
        release_webhook_configured: Boolean(config.superAdmin.releaseWebhookUrl && config.superAdmin.releaseWebhookSecret)
      },
      schema_warnings: warnings
    };
  });

  superGet("/action-health", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.action_health.view");
    return superAdminActionHealth(ctx, request);
  });

  superGet("/alarm-status", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.alarm_status.view");
    const status = securityAlertStatus();
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.alarm_status_viewed",
      source: "admin",
      resourceType: "security_alarm",
      severity: "info",
      metadata: {
        channels: status.channels,
        min_severity: status.min_severity
      }
    });
    return { ok: true, alarm: status };
  });

  superPost("/alarm-test", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.alarm_test.send");
    const result = await sendSecurityAlert({
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.alarm_test",
      resourceType: "security_alarm",
      resourceId: "manual-test",
      severity: "critical",
      ipAddress: clientIp(request),
      source: "admin",
      purpose: "security_alarm_test",
      metadata: {
        owner_source: ctx.superAdminOwner?.source || "unknown",
        requested_from: "super_admin_panel"
      }
    }, { force: true, channel: "manual_test", activateIncident: false });
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.alarm_test_sent",
      source: "admin",
      resourceType: "security_alarm",
      resourceId: "manual-test",
      severity: "warning",
      metadata: {
        channels: result.channels || {},
        alert_status: result.status || {}
      }
    });
    return { ok: true, result };
  });

  superPost("/alarm-acknowledge", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.alarm_acknowledge");
    const body = superAdminAlarmDecisionSchema.parse(request.body || {});
    const incident = acknowledgeSecurityAlarm({
      actorId: ctx.user.id,
      reason: body.reason
    });
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.alarm_acknowledged",
      source: "admin",
      resourceType: "security_alarm",
      severity: "warning",
      metadata: {
        reason: body.reason,
        incident
      }
    });
    return { ok: true, incident };
  });

  superPost("/alarm-resolve", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.alarm_resolve");
    const body = superAdminAlarmDecisionSchema.parse(request.body || {});
    const incident = resolveSecurityAlarm({
      actorId: ctx.user.id,
      reason: body.reason
    });
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.alarm_resolved",
      source: "admin",
      resourceType: "security_alarm",
      severity: "warning",
      metadata: {
        reason: body.reason,
        incident
      }
    });
    return { ok: true, incident };
  });

  superPost("/alarm-protection", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.alarm_protection.update");
    const body = superAdminAlarmProtectionSchema.parse(request.body || {});
    const protection = updateRuntimeProtection(body.action, ctx.user.id, body.reason);
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.alarm_protection_updated",
      source: "admin",
      resourceType: "security_alarm_protection",
      resourceId: body.action,
      severity: ["clear", "unlock_api", "unlock_payments", "unlock_orders"].includes(body.action) ? "warning" : "critical",
      metadata: {
        action: body.action,
        reason: body.reason,
        protection
      }
    });
    return { ok: true, protection };
  });

  superGet("/refund-cancellations", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.refund_cancellations.list");
    const queryParams = superAdminRefundCancellationQuerySchema.parse(request.query || {});
    const warnings = [];
    const search = cleanSearch(queryParams.search);

    let ordersQuery = supabaseAdmin
      .from("orders")
      .select("id, order_no, order_number, user_id, customer_name, customer_email, customer_phone, total, grand_total, order_status, status, payment_status, created_at, updated_at")
      .or("order_status.in.(cancelled,refunded),status.in.(cancelled,refunded),payment_status.eq.refunded")
      .order("updated_at", { ascending: false })
      .limit(queryParams.limit);
    if (queryParams.status === "cancelled") ordersQuery = ordersQuery.in("order_status", ["cancelled"]);
    if (queryParams.status === "refunded") ordersQuery = ordersQuery.or("order_status.eq.refunded,status.eq.refunded,payment_status.eq.refunded");
    const filter = textSearchFilter(["order_no", "order_number", "customer_name", "customer_email", "customer_phone"], search);
    if (filter) ordersQuery = ordersQuery.or(filter);

    let ticketQuery = supabaseAdmin
      .from("support_tickets")
      .select("id, user_id, requester_type, category, priority, title, message, status, metadata, created_at, updated_at, profile:profiles(id, full_name, email, phone)")
      .or(refundCancellationSupportFilter(search))
      .order("created_at", { ascending: false })
      .limit(Math.min(queryParams.limit, 40));
    if (queryParams.status === "pending_signal") ticketQuery = ticketQuery.in("status", ["open", "in_progress"]);

    const [orders, tickets] = await Promise.all([
      optionalQuery(ordersQuery, [], warnings, "orders"),
      optionalQuery(ticketQuery, [], warnings, "support_tickets")
    ]);

    const items = (orders || []).map((order) => refundCancellationPublic(order));
    const ticketSignals = queryParams.status === "all" || queryParams.status === "pending_signal"
      ? (tickets || []).map((ticket) => ({
          id: `ticket:${ticket.id}`,
          type: "support_signal",
          ticket_id: ticket.id,
          order_no: ticket.metadata?.order_no || ticket.metadata?.order_id || "Destek talebi",
          customer_name: ticket.profile?.full_name || "",
          customer_email: ticket.profile?.email || "",
          customer_phone: ticket.profile?.phone || "",
          total: 0,
          order_status: "pending_signal",
          payment_status: "",
          reason: ticket.message || ticket.title || "",
          risk_level: ticket.priority === "urgent" ? "critical" : "high",
          created_at: ticket.created_at,
          updated_at: ticket.updated_at,
          tickets: [ticket],
          notes: [],
          flags: [],
          order_items: []
        }))
      : [];

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.refund_cancellations_viewed",
      source: "admin",
      resourceType: "refund_cancellation",
      severity: "info",
      metadata: {
        status: queryParams.status,
        search: search || null,
        order_count: items.length,
        support_signal_count: ticketSignals.length,
        warning_count: warnings.length
      }
    });

    return {
      ok: true,
      items: [...items, ...ticketSignals].slice(0, queryParams.limit),
      summary: {
        total: items.length + ticketSignals.length,
        refunded: items.filter((item) => item.type === "refund").length,
        cancelled: items.filter((item) => item.type === "cancellation").length,
        support_signals: ticketSignals.length,
        action_required: ticketSignals.length + items.filter((item) => item.type === "refund").length
      },
      warnings
    };
  });

  superGet("/refund-cancellations/:orderId", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.refund_cancellations.detail");
    const { orderId } = z.object({ orderId: uuidSchema }).parse(request.params || {});
    const warnings = [];
    const order = await optionalQuery(
      supabaseAdmin
        .from("orders")
        .select("*, order_items(*, product:products(id, name, category, partner_id))")
        .eq("id", orderId)
        .maybeSingle(),
      null,
      warnings,
      "orders"
    );
    if (!order) throw httpError("Sipariş bulunamadı.", 404);

    const supportFilters = [
      order.order_no ? `title.ilike.%${order.order_no}%` : "",
      order.order_no ? `message.ilike.%${order.order_no}%` : "",
      order.order_number ? `title.ilike.%${order.order_number}%` : "",
      order.order_number ? `message.ilike.%${order.order_number}%` : "",
      order.customer_email ? `title.ilike.%${order.customer_email}%` : "",
      order.customer_email ? `message.ilike.%${order.customer_email}%` : ""
    ].filter(Boolean).join(",");

    const [notes, flags, tickets] = await Promise.all([
      optionalQuery(
        supabaseAdmin
          .from("admin_operation_notes")
          .select("id, note_type, body, visibility, created_at, author:profiles(id, full_name)")
          .eq("target_type", "order")
          .eq("target_id", orderId)
          .order("created_at", { ascending: false })
          .limit(40),
        [],
        warnings,
        "admin_operation_notes"
      ),
      optionalQuery(
        supabaseAdmin
          .from("admin_operation_flags")
          .select("id, flag_type, severity, reason, status, metadata, created_at, updated_at")
          .eq("target_type", "order")
          .eq("target_id", orderId)
          .order("created_at", { ascending: false })
          .limit(30),
        [],
        warnings,
        "admin_operation_flags"
      ),
      supportFilters
        ? optionalQuery(
            supabaseAdmin
              .from("support_tickets")
              .select("id, requester_type, category, priority, title, message, status, metadata, created_at, updated_at, profile:profiles(id, full_name, email, phone)")
              .or(supportFilters)
              .order("created_at", { ascending: false })
              .limit(20),
            [],
            warnings,
            "support_tickets"
          )
        : Promise.resolve([])
    ]);

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.refund_cancellation_detail_viewed",
      source: "admin",
      resourceType: "order",
      resourceId: orderId,
      severity: "info",
      metadata: {
        note_count: notes.length,
        flag_count: flags.length,
        support_signal_count: tickets.length
      }
    });

    return {
      ok: true,
      item: refundCancellationPublic(order, {
        notes,
        flags,
        tickets,
        provider_dispatch: flags.find((flag) => flag.metadata?.provider_dispatch)?.metadata?.provider_dispatch || null,
        order_items: order.order_items || []
      }),
      warnings
    };
  });

  superPost("/refund-cancellations/:orderId/action", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.refund_cancellations.action");
    const { orderId } = z.object({ orderId: uuidSchema }).parse(request.params || {});
    const body = superAdminRefundCancellationActionSchema.parse(request.body || {});
    const warnings = [];
    const before = await optionalQuery(
      supabaseAdmin
        .from("orders")
        .select("id, order_no, order_number, customer_email, total, grand_total, order_status, status, payment_status")
        .eq("id", orderId)
        .maybeSingle(),
      null,
      warnings,
      "orders"
    );
    if (!before) throw httpError("Sipariş bulunamadı.", 404);

    let updated = before;
    const updatePayload = {};
    if (body.action === "approve_cancellation") {
      updatePayload.order_status = "cancelled";
      updatePayload.status = "cancelled";
    }
    if (body.action === "approve_refund") {
      updatePayload.order_status = "refunded";
      updatePayload.status = "refunded";
      updatePayload.payment_status = "refunded";
    }
    if (Object.keys(updatePayload).length) {
      updated = await optionalMutation(
        supabaseAdmin
          .from("orders")
          .update(updatePayload)
          .eq("id", orderId)
          .select("id, order_no, order_number, customer_email, total, grand_total, order_status, status, payment_status, updated_at")
          .single(),
        warnings,
        "orders"
      );
    }

    const actionLabels = {
      mark_review: "İncelemeye alındı",
      approve_cancellation: "İptal onaylandı",
      approve_refund: "İade onaylandı",
      reject_request: "Talep reddedildi",
      add_note: "Not eklendi"
    };
    const noteBody = [
      `${actionLabels[body.action]}: ${body.reason}`,
      body.note ? `Ek açıklama: ${body.note}` : ""
    ].filter(Boolean).join("\n");
    const providerContext = await loadOrderPaymentProviderContext(orderId, warnings);
    const providerDispatch = await notifyPaymentProviderRefundCancellation({
      action: body.action,
      order: updated,
      context: providerContext,
      reason: body.reason,
      note: body.note,
      actorId: ctx.user.id,
      ip: clientIp(request)
    });

    const [note, flag] = await Promise.all([
      optionalMutation(
        supabaseAdmin
          .from("admin_operation_notes")
          .insert({
            author_id: ctx.user.id,
            target_type: "order",
            target_id: orderId,
            note_type: "review",
            visibility: "super_admin",
            body: noteBody
          })
          .select("*")
          .single(),
        warnings,
        "admin_operation_notes"
      ),
      optionalMutation(
        supabaseAdmin
          .from("admin_operation_flags")
          .insert({
            flagged_by: ctx.user.id,
            target_type: "order",
            target_id: orderId,
            flag_type: "risky_order",
            severity: body.action === "approve_refund" ? "critical" : "warning",
            status: body.action === "mark_review" ? "in_review" : "resolved",
            reason: noteBody,
            metadata: {
              super_admin_action: body.action,
              order_status_before: before.order_status || before.status || null,
              payment_status_before: before.payment_status || null,
              order_status_after: updated.order_status || updated.status || null,
              payment_status_after: updated.payment_status || null,
              provider_dispatch: providerDispatch
            }
          })
          .select("*")
          .single(),
        warnings,
        "admin_operation_flags"
      )
    ]);

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: `super_admin.refund_cancellation_${body.action}`,
      source: "admin",
      resourceType: "order",
      resourceId: orderId,
      severity: body.action === "approve_refund" ? "critical" : "warning",
      purpose: "refund_cancellation_control",
      evidenceTags: ["super_admin", "refund_cancellation", body.action],
      metadata: {
        reason: body.reason,
        note: body.note || null,
        old_value: before,
        new_value: updated,
        note_id: note?.id || null,
        flag_id: flag?.id || null,
        provider_dispatch: providerDispatch
      }
    });

    return {
      ok: true,
      item: refundCancellationPublic(updated, { notes: [note].filter(Boolean), flags: [flag].filter(Boolean), provider_dispatch: providerDispatch }),
      note,
      flag,
      provider_dispatch: providerDispatch,
      warnings
    };
  });

  superGet("/work-queue", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.work_queue.list");
    const queryParams = superAdminWorkQueueQuerySchema.parse(request.query || {});
    const warnings = [];

    let storedQuery = supabaseAdmin
      .from("super_admin_work_queue")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(queryParams.limit);
    if (queryParams.status) storedQuery = storedQuery.eq("status", queryParams.status);
    if (queryParams.source_module) storedQuery = storedQuery.eq("source_module", queryParams.source_module);
    if (queryParams.risk_level) storedQuery = storedQuery.eq("risk_level", queryParams.risk_level);

    const stored = await runAdminQuery("super_admin_work_queue", storedQuery, []);
    if (stored.warning) warnings.push(stored.warning);
    const derived = await loadDerivedSuperAdminWorkQueue({
      limit: queryParams.limit,
      status: queryParams.status,
      sourceModule: queryParams.source_module,
      riskLevel: queryParams.risk_level
    });
    warnings.push(...derived.warnings);

    const storedItems = (stored.data || []).map((item) => workQueuePublic(item));
    const items = [...storedItems, ...derived.items]
      .sort((a, b) => {
        const priorityScore = { urgent: 4, high: 3, normal: 2, low: 1 };
        const riskScore = { critical: 4, high: 3, medium: 2, low: 1 };
        const scoreA = (priorityScore[a.priority] || 0) + (riskScore[a.risk_level] || 0);
        const scoreB = (priorityScore[b.priority] || 0) + (riskScore[b.risk_level] || 0);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      })
      .slice(0, queryParams.limit);

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.work_queue_viewed",
      source: "admin",
      resourceType: "super_admin_work_queue",
      metadata: {
        stored_count: storedItems.length,
        derived_count: derived.items.length,
        status: queryParams.status || "all",
        source_module: queryParams.source_module || "all",
        risk_level: queryParams.risk_level || "all",
        warning_count: warnings.length
      }
    });

    return {
      ok: true,
      items,
      summary: {
        total: items.length,
        stored: storedItems.length,
        derived: derived.items.length,
        urgent: items.filter((item) => item.priority === "urgent" || item.risk_level === "critical").length,
        waiting_owner: items.filter((item) => item.status === "waiting_owner").length,
        actionable: items.filter((item) => item.actionable).length
      },
      filters: {
        source_modules: SUPER_ADMIN_WORK_QUEUE_SOURCE_MODULES,
        statuses: SUPER_ADMIN_WORK_QUEUE_STATUSES,
        risk_levels: ["low", "medium", "high", "critical"]
      },
      schema_warnings: warnings
    };
  });

  superPatch("/work-queue/:itemId", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.work_queue.update");
    const { itemId } = z.object({ itemId: uuidSchema }).parse(request.params || {});
    const body = superAdminWorkQueueUpdateSchema.parse(request.body || {});
    const { data: before, error: beforeError } = await supabaseAdmin
      .from("super_admin_work_queue")
      .select("*")
      .eq("id", itemId)
      .maybeSingle();
    if (beforeError) {
      if (looksLikeMissingSchema(beforeError)) throw httpError("super_admin_work_queue migration henüz uygulanmamış.", 503);
      throw beforeError;
    }
    if (!before) throw httpError("İş kuyruğu kaydı bulunamadı.", 404);

    const updatePayload = {
      updated_by: ctx.user.id
    };
    ["status", "priority", "risk_level", "owner_user_id", "due_at", "summary"].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(body, key)) updatePayload[key] = body[key];
    });

    const { data: updated, error } = await supabaseAdmin
      .from("super_admin_work_queue")
      .update(updatePayload)
      .eq("id", itemId)
      .select("*")
      .single();
    if (error) throw error;

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.work_queue_updated",
      resourceType: "super_admin_work_queue",
      resourceId: itemId,
      severity: updated.risk_level === "critical" ? "critical" : "warning",
      source: "admin",
      purpose: "super_admin_work_queue",
      evidenceTags: ["super_admin", "work_queue", updated.source_module || "other"],
      metadata: {
        old_value: before,
        new_value: updated,
        reason: body.reason
      }
    });

    return { ok: true, item: workQueuePublic(updated) };
  });

  superPost("/work-queue/:itemId/decision", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.work_queue.decide");
    const { itemId } = z.object({ itemId: uuidSchema }).parse(request.params || {});
    const body = superAdminWorkQueueDecisionSchema.parse(request.body || {});
    const { data: before, error: beforeError } = await supabaseAdmin
      .from("super_admin_work_queue")
      .select("*")
      .eq("id", itemId)
      .maybeSingle();
    if (beforeError) {
      if (looksLikeMissingSchema(beforeError)) throw httpError("super_admin_work_queue migration henüz uygulanmamış.", 503);
      throw beforeError;
    }
    if (!before) throw httpError("İş kuyruğu kaydı bulunamadı.", 404);

    const status = body.status || (body.decision === "resolved" ? "resolved" : "decided");
    const { data: updated, error } = await supabaseAdmin
      .from("super_admin_work_queue")
      .update({
        status,
        decision: body.decision,
        decision_reason: body.reason,
        decided_by: ctx.user.id,
        decided_at: new Date().toISOString(),
        updated_by: ctx.user.id
      })
      .eq("id", itemId)
      .select("*")
      .single();
    if (error) throw error;

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.work_queue_decided",
      resourceType: "super_admin_work_queue",
      resourceId: itemId,
      severity: updated.risk_level === "critical" ? "critical" : "warning",
      source: "admin",
      purpose: "super_admin_work_queue",
      evidenceTags: ["super_admin", "work_queue", body.decision],
      metadata: {
        old_status: before.status,
        new_status: updated.status,
        decision: body.decision,
        reason: body.reason,
        source_module: updated.source_module
      }
    });

    return { ok: true, item: workQueuePublic(updated) };
  });

  superGet("/release-approvals", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.release_approvals.list");
    const queryParams = z.object({
      limit: z.coerce.number().int().min(1).max(100).optional().default(50),
      status: z.enum(["pending", "approved", "dispatched", "failed", "cancelled"]).optional(),
      approval_type: z.enum(SUPER_ADMIN_RELEASE_APPROVAL_TYPES).optional()
    }).parse(request.query || {});

    let query = supabaseAdmin
      .from("super_admin_release_approvals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(queryParams.limit);
    if (queryParams.status) query = query.eq("status", queryParams.status);
    if (queryParams.approval_type) query = query.eq("approval_type", queryParams.approval_type);

    const result = await runAdminQuery("super_admin_release_approvals", query, []);
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.release_approvals_viewed",
      source: "admin",
      resourceType: "super_admin_release_approvals",
      metadata: {
        limit: queryParams.limit,
        status: queryParams.status || "all",
        approval_type: queryParams.approval_type || "all",
        warning: Boolean(result.warning)
      }
    });

    return {
      ok: true,
      approvals: (result.data || []).map(releaseApprovalPublic),
      schema_warnings: result.warning ? [result.warning] : []
    };
  });

  superPost("/release-approvals", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.release_approvals.create");
    const body = superAdminReleaseApprovalSchema.parse(request.body || {});
    const insertPayload = {
      approval_type: body.approval_type,
      target_ref: body.target_ref,
      target_summary: body.target_summary,
      status: "pending",
      risk_level: body.risk_level,
      requested_by: ctx.user.id,
      metadata: normalizeJsonValue({
        ...body.metadata,
        approval_gate: "detail_review_required",
        owner_source: ctx.superAdminOwner?.source || "unknown",
        request_host: requestHostname(request),
        request_ip: clientIp(request)
      })
    };

    const { data, error } = await supabaseAdmin
      .from("super_admin_release_approvals")
      .insert(insertPayload)
      .select("*")
      .single();
    if (error) {
      if (looksLikeMissingSchema(error)) {
        throw httpError("super_admin_release_approvals migration henüz uygulanmamış.", 503);
      }
      throw error;
    }

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.release_approval_requested",
      resourceType: "super_admin_release_approval",
      resourceId: data.id,
      severity: superAdminAuditSeverity(body.risk_level),
      source: "admin",
      purpose: "release_control",
      evidenceTags: ["super_admin", "release_approval", "pending_owner_review", body.approval_type],
      metadata: {
        approval_type: body.approval_type,
        target_ref: body.target_ref,
        status: data.status,
        dispatched: false,
        webhook_status: null,
        gitops_enabled: config.superAdmin.gitOpsEnabled,
        approval_gate: "detail_review_required"
      }
    });

    return {
      ok: true,
      approval: releaseApprovalPublic(data),
      dispatch: {
        status: "pending",
        dispatched: false,
        webhook_status: null,
        webhook_response: {
          code: "PENDING_OWNER_REVIEW",
          message: "Yayın onayı oluşturuldu; deploy/main/migration işlemi owner detay onayı bekliyor."
        }
      },
      schema_warnings: []
    };
  });

  superPost("/release-approvals/:approvalId/approve", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.release_approvals.approve");
    const { approvalId } = z.object({ approvalId: uuidSchema }).parse(request.params || {});
    const body = superAdminReleaseApprovalDecisionSchema.parse(request.body || {});
    const { data: before, error: beforeError } = await supabaseAdmin
      .from("super_admin_release_approvals")
      .select("*")
      .eq("id", approvalId)
      .maybeSingle();
    if (beforeError) {
      if (looksLikeMissingSchema(beforeError)) {
        throw httpError("super_admin_release_approvals migration henüz uygulanmamış.", 503);
      }
      throw beforeError;
    }
    if (!before) throw httpError("Yayın onayı kaydı bulunamadı.", 404);
    if (before.status !== "pending") {
      throw httpError("Bu yayın onayı zaten karara bağlanmış.", 409);
    }

    const approvedAt = new Date().toISOString();
    const { data: approved, error: approveError } = await supabaseAdmin
      .from("super_admin_release_approvals")
      .update({
        status: "approved",
        approved_by: ctx.user.id,
        approved_at: approvedAt,
        metadata: normalizeJsonValue({
          ...(before.metadata || {}),
          owner_source: ctx.superAdminOwner?.source || "unknown",
          approval_reason: body.reason,
          approved_from: "super_admin_detail_review"
        }),
        updated_at: approvedAt
      })
      .eq("id", approvalId)
      .eq("status", "pending")
      .select("*")
      .single();
    if (approveError) throw approveError;

    const dispatch = await dispatchSuperAdminReleaseApproval(approved, request);
    const updatePayload = {
      status: dispatch.status,
      webhook_status: dispatch.webhook_status,
      webhook_response: normalizeJsonValue(dispatch.webhook_response || {}),
      dispatched_at: dispatch.dispatched ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("super_admin_release_approvals")
      .update(updatePayload)
      .eq("id", approvalId)
      .select("*")
      .single();
    let dispatchUpdateWarning = null;
    let approval = updated;
    if (updateError) {
      if (!looksLikeMissingSchema(updateError)) throw updateError;
      dispatchUpdateWarning = schemaWarning("super_admin_release_approvals_dispatch_columns", updateError);
      approval = {
        ...approved,
        webhook_status: dispatch.webhook_status,
        webhook_response: dispatch.webhook_response || {},
        status: dispatch.status || approved.status
      };
    }

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.release_approval_approved",
      resourceType: "super_admin_release_approval",
      resourceId: approvalId,
      severity: superAdminAuditSeverity(approval.risk_level),
      source: "admin",
      purpose: "release_control",
      evidenceTags: ["super_admin", "release_approval", "owner_approved", approval.approval_type],
      metadata: {
        approval_type: approval.approval_type,
        target_ref: approval.target_ref,
        status: approval.status,
        dispatched: dispatch.dispatched,
        webhook_status: dispatch.webhook_status,
        reason: body.reason,
        dispatch_update_warning: dispatchUpdateWarning?.message || null
      }
    });

    return {
      ok: true,
      approval: releaseApprovalPublic(approval),
      dispatch,
      schema_warnings: dispatchUpdateWarning ? [dispatchUpdateWarning] : []
    };
  });

  superGet("/module-map", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.module_map.view");
    const result = await runAdminQuery(
      "platform_modules_module_map",
      supabaseAdmin
        .from("platform_modules")
        .select("*")
        .order("sort_order", { ascending: true }),
      []
    );
    const modules = moduleOperationMapPublic(result.data || []);
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.module_map_viewed",
      source: "admin",
      resourceType: "super_admin_module_map",
      metadata: {
        homepage_module_count: modules.length,
        warning: Boolean(result.warning)
      }
    });

    return {
      ok: true,
      modules,
      future_operations: SUPER_ADMIN_FUTURE_OPERATIONS,
      schema_warnings: result.warning ? [result.warning] : []
    };
  });

  superGet("/permissions", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.permissions.list");
    const queryParams = z.object({
      limit: z.coerce.number().int().min(1).max(200).optional().default(120),
      search: z.string().trim().max(80).optional().default(""),
      role: z.enum(SUPER_ADMIN_GRANTABLE_ROLES).optional()
    }).parse(request.query || {});
    const warnings = [];

    let usersQuery = supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(queryParams.limit);
    if (queryParams.role) usersQuery = usersQuery.eq("role", queryParams.role);
    if (queryParams.search) {
      const clean = queryParams.search.replace(/[%_,]/g, " ").trim();
      if (clean) {
        const like = `%${clean}%`;
        usersQuery = usersQuery.or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`);
      }
    }

    const [usersResult, changesResult] = await Promise.all([
      runAdminQuery("super_admin_permission_profiles", usersQuery, []),
      runAdminQuery(
        "super_admin_permission_changes",
        supabaseAdmin
          .from("super_admin_permission_changes")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(80),
        []
      )
    ]);
    [usersResult, changesResult].filter((item) => item.warning).forEach((item) => warnings.push(item.warning));

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.permissions_viewed",
      source: "admin",
      resourceType: "super_admin_permissions",
      metadata: {
        user_count: usersResult.count,
        role: queryParams.role || "all",
        search: Boolean(queryParams.search),
        warning_count: warnings.length
      }
    });

    return {
      ok: true,
      users: (usersResult.data || []).map(publicProfile),
      count: usersResult.count,
      allowed_roles: SUPER_ADMIN_GRANTABLE_ROLES,
      guardrails: {
        super_admin_requires_owner: true,
        reason_required: true,
        self_demote_blocked: true
      },
      recent_changes: (changesResult.data || []).map(permissionChangePublic),
      schema_warnings: warnings
    };
  });

  superPatch("/permissions/:userId", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.permissions.update");
    const { userId } = z.object({ userId: uuidSchema }).parse(request.params || {});
    const body = superAdminPermissionUpdateSchema.parse(request.body || {});
    const { data: before, error: beforeError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (beforeError) throw beforeError;
    if (!before) throw httpError("Yetki verilecek kullanıcı bulunamadı.", 404);

    if (userId === ctx.user.id) {
      if (body.role && body.role !== "super_admin") {
        throw httpError("Owner kendi Super Admin rolünü düşüremez.", 400);
      }
      if (body.account_status && body.account_status !== "active") {
        throw httpError("Owner kendi hesabını pasif veya askıda yapamaz.", 400);
      }
    }

    if (body.role === "super_admin") {
      const allowedOwner = await isRegisteredSuperAdminOwnerCandidate(before.id, before.email);
      if (!allowedOwner) {
        await auditEvent({
          request,
          actorId: ctx.user.id,
          actorRole: ctx.profile.role,
          action: "super_admin.permission_super_admin_denied",
          resourceType: "profile",
          resourceId: userId,
          severity: "critical",
          source: "admin",
          purpose: "permission_control",
          evidenceTags: ["super_admin", "permission_denied", "owner_lock"],
          metadata: {
            target_email: before.email || null,
            reason: body.reason
          }
        });
        throw httpError("Super Admin rolü sadece owner allowlist veya owner_access kaydındaki kullanıcıya verilebilir.", 403);
      }
    }

    let permissionResult;
    if (ctx.superAdminOwnerBootstrap) {
      permissionResult = await bootstrapOwnerSelfSuperAdminPermission({ before, body, ctx });
    } else {
      permissionResult = await serviceRoleUpdateProfilePermission({
        before,
        body,
        ctx,
        fallbackReason: "backend_owner_verified_service_role"
      });
    }

    const updated = permissionResult?.profile;
    const change = permissionResult?.change;
    if (!updated) throw httpError("Yetki güncellemesi tamamlandı ancak profil cevabı alınamadı.", 502);
    const changeRisk = change?.risk_level || (body.role === "super_admin" || body.account_status === "suspended" ? "critical" : (body.role === "admin" ? "high" : "medium"));

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.permission_updated",
      resourceType: "profile",
      resourceId: userId,
      severity: changeRisk === "critical" ? "critical" : "warning",
      source: "admin",
      purpose: "permission_control",
      evidenceTags: ["super_admin", "permission_update", updated.role || "customer"],
      metadata: {
        old_value: {
          role: before.role || "customer",
          account_status: before.account_status || "active",
          risk_level: before.risk_level || "low",
          flagged_suspicious: Boolean(before.flagged_suspicious)
        },
        new_value: {
          role: updated.role || "customer",
          account_status: updated.account_status || "active",
          risk_level: updated.risk_level || "low",
          flagged_suspicious: Boolean(updated.flagged_suspicious)
        },
        reason: body.reason,
        change_recorded: Boolean(change)
      }
    });

    return {
      ok: true,
      user: publicProfile(updated),
      change: change ? permissionChangePublic(change) : null,
      schema_warnings: []
    };
  });

  superGet("/dashboard", async (request) => {
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

  superGet("/users", async (request) => {
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

  superPatch("/users/:userId", async (request) => {
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

  superGet("/partners", async (request) => {
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

  superPatch("/partner-applications/:applicationId", async (request) => {
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

  superGet("/security", async (request) => {
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

  superGet("/settings", async (request) => {
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

  superPatch("/settings/:settingKey", async (request) => {
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

  superGet("/modules", async (request) => {
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

  superPatch("/modules/:moduleKey", async (request) => {
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

  superGet("/audit-log", async (request) => {
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

  opsGet("/bootstrap", async (request) => {
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
        can_request_super_admin_approval: true,
        can_manage_social_media: true
      },
      dashboard,
      warnings
    };
  });

  opsGet("/dashboard", async (request) => {
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

  opsGet("/users", async (request) => {
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

  opsGet("/users/:userId", async (request) => {
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

  opsPost("/users/:userId/notes", async (request, reply) => {
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

  opsPost("/users/:userId/flag", async (request, reply) => {
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

  opsGet("/partner-applications", async (request) => {
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

  opsGet("/partner-applications/:applicationId", async (request) => {
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

  opsPatch("/partner-applications/:applicationId/review", async (request) => {
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

  opsGet("/partners", async (request) => {
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

  opsGet("/orders", async (request) => {
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

  opsGet("/orders/:orderId", async (request) => {
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

  opsPost("/orders/:orderId/risk-flag", async (request, reply) => {
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

  opsGet("/refund-cancellations", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.refund_cancellations.list");
    const queryParams = superAdminRefundCancellationQuerySchema.parse(request.query || {});
    const warnings = [];
    const search = cleanSearch(queryParams.search);

    let ordersQuery = supabaseAdmin
      .from("orders")
      .select("id, order_no, user_id, customer_name, customer_email, customer_phone, total, order_status, payment_status, created_at, updated_at")
      .or("order_status.in.(cancelled,refunded),payment_status.eq.refunded")
      .order("updated_at", { ascending: false })
      .limit(queryParams.limit);
    if (queryParams.status === "cancelled") ordersQuery = ordersQuery.in("order_status", ["cancelled"]);
    if (queryParams.status === "refunded") ordersQuery = ordersQuery.or("order_status.eq.refunded,payment_status.eq.refunded");
    const filter = textSearchFilter(["order_no", "customer_name", "customer_email", "customer_phone"], search);
    if (filter) ordersQuery = ordersQuery.or(filter);

    let ticketQuery = supabaseAdmin
      .from("support_tickets")
      .select("id, user_id, requester_type, category, priority, title, message, status, metadata, created_at, updated_at, profile:profiles(id, full_name, email, phone)")
      .or(refundCancellationSupportFilter(search))
      .order("created_at", { ascending: false })
      .limit(Math.min(queryParams.limit, 40));
    if (queryParams.status === "pending_signal") ticketQuery = ticketQuery.in("status", ["open", "in_progress"]);

    const [orders, tickets] = await Promise.all([
      optionalQuery(ordersQuery, [], warnings, "orders"),
      optionalQuery(ticketQuery, [], warnings, "support_tickets")
    ]);

    const items = (orders || []).map((order) => refundCancellationPublic(order));
    const ticketSignals = queryParams.status === "all" || queryParams.status === "pending_signal"
      ? (tickets || []).map((ticket) => ({
          id: `ticket:${ticket.id}`,
          type: "support_signal",
          ticket_id: ticket.id,
          order_no: ticket.metadata?.order_no || ticket.metadata?.order_id || "Destek talebi",
          customer_name: ticket.profile?.full_name || "",
          customer_email: ticket.profile?.email || "",
          customer_phone: ticket.profile?.phone || "",
          total: 0,
          order_status: "pending_signal",
          payment_status: "",
          reason: ticket.message || ticket.title || "",
          risk_level: ticket.priority === "urgent" ? "critical" : "high",
          created_at: ticket.created_at,
          updated_at: ticket.updated_at,
          tickets: [ticket],
          notes: [],
          flags: [],
          order_items: []
        }))
      : [];

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.refund_cancellations_viewed",
      resourceType: "refund_cancellation",
      severity: "info",
      metadata: {
        status: queryParams.status,
        search: search || null,
        order_count: items.length,
        support_signal_count: ticketSignals.length,
        warning_count: warnings.length
      }
    });

    return {
      ok: true,
      items: [...items, ...ticketSignals].slice(0, queryParams.limit),
      summary: {
        total: items.length + ticketSignals.length,
        refunded: items.filter((item) => item.type === "refund").length,
        cancelled: items.filter((item) => item.type === "cancellation").length,
        support_signals: ticketSignals.length,
        action_required: ticketSignals.length + items.filter((item) => item.type === "refund").length
      },
      warnings
    };
  });

  opsGet("/refund-cancellations/:orderId", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.refund_cancellations.detail");
    const { orderId } = z.object({ orderId: uuidSchema }).parse(request.params || {});
    const warnings = [];
    const order = await optionalQuery(
      supabaseAdmin
        .from("orders")
        .select("*, order_items(*, product:products(id, name, category, partner_id))")
        .eq("id", orderId)
        .maybeSingle(),
      null,
      warnings,
      "orders"
    );
    if (!order) throw httpError("Sipariş bulunamadı.", 404);

    const supportFilters = [
      order.order_no ? `title.ilike.%${order.order_no}%` : "",
      order.order_no ? `message.ilike.%${order.order_no}%` : "",
      order.order_number ? `title.ilike.%${order.order_number}%` : "",
      order.order_number ? `message.ilike.%${order.order_number}%` : "",
      order.customer_email ? `title.ilike.%${order.customer_email}%` : "",
      order.customer_email ? `message.ilike.%${order.customer_email}%` : ""
    ].filter(Boolean).join(",");

    const [notes, flags, tickets] = await Promise.all([
      optionalQuery(
        supabaseAdmin
          .from("admin_operation_notes")
          .select("id, note_type, body, visibility, created_at, author:profiles(id, full_name)")
          .eq("target_type", "order")
          .eq("target_id", orderId)
          .order("created_at", { ascending: false })
          .limit(40),
        [],
        warnings,
        "admin_operation_notes"
      ),
      optionalQuery(
        supabaseAdmin
          .from("admin_operation_flags")
          .select("id, flag_type, severity, reason, status, metadata, created_at, updated_at")
          .eq("target_type", "order")
          .eq("target_id", orderId)
          .order("created_at", { ascending: false })
          .limit(30),
        [],
        warnings,
        "admin_operation_flags"
      ),
      supportFilters
        ? optionalQuery(
            supabaseAdmin
              .from("support_tickets")
              .select("id, requester_type, category, priority, title, message, status, metadata, created_at, updated_at, profile:profiles(id, full_name, email, phone)")
              .or(supportFilters)
              .order("created_at", { ascending: false })
              .limit(20),
            [],
            warnings,
            "support_tickets"
          )
        : Promise.resolve([])
    ]);

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.refund_cancellation_detail_viewed",
      resourceType: "order",
      resourceId: orderId,
      severity: "info",
      metadata: {
        note_count: notes.length,
        flag_count: flags.length,
        support_signal_count: tickets.length
      }
    });

    return {
      ok: true,
      item: refundCancellationPublic(order, {
        notes,
        flags,
        tickets,
        provider_dispatch: flags.find((flag) => flag.metadata?.provider_dispatch)?.metadata?.provider_dispatch || null,
        order_items: order.order_items || []
      }),
      warnings
    };
  });

  opsPost("/refund-cancellations/:orderId/action", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.refund_cancellations.action");
    const { orderId } = z.object({ orderId: uuidSchema }).parse(request.params || {});
    const body = superAdminRefundCancellationActionSchema.parse(request.body || {});
    const warnings = [];
    const before = await optionalQuery(
      supabaseAdmin
        .from("orders")
        .select("id, order_no, customer_email, total, order_status, payment_status")
        .eq("id", orderId)
        .maybeSingle(),
      null,
      warnings,
      "orders"
    );
    if (!before) throw httpError("Sipariş bulunamadı.", 404);

    let updated = before;
    const updatePayload = {};
    if (body.action === "approve_cancellation") {
      updatePayload.order_status = "cancelled";
      updatePayload.status = "cancelled";
    }
    if (body.action === "approve_refund") {
      updatePayload.order_status = "refunded";
      updatePayload.status = "refunded";
      updatePayload.payment_status = "refunded";
    }
    if (Object.keys(updatePayload).length) {
      updated = await updateRefundCancellationOrder(orderId, updatePayload, warnings);
    }

    const actionLabels = {
      mark_review: "İncelemeye alındı",
      approve_cancellation: "İptal onaylandı",
      approve_refund: "İade onaylandı",
      reject_request: "Talep reddedildi",
      add_note: "Not eklendi"
    };
    const noteBody = [
      `${actionLabels[body.action]}: ${body.reason}`,
      body.note ? `Ek açıklama: ${body.note}` : ""
    ].filter(Boolean).join("\n");
    const providerContext = await loadOrderPaymentProviderContext(orderId, warnings);
    const providerDispatch = await notifyPaymentProviderRefundCancellation({
      action: body.action,
      order: updated,
      context: providerContext,
      reason: body.reason,
      note: body.note,
      actorId: ctx.user.id,
      ip: clientIp(request)
    });

    const [note, flag] = await Promise.all([
      optionalMutation(
        supabaseAdmin
          .from("admin_operation_notes")
          .insert({
            author_id: ctx.user.id,
            target_type: "order",
            target_id: orderId,
            note_type: "review",
            visibility: "admin",
            body: noteBody
          })
          .select("*")
          .single(),
        warnings,
        "admin_operation_notes"
      ),
      optionalMutation(
        supabaseAdmin
          .from("admin_operation_flags")
          .insert({
            flagged_by: ctx.user.id,
            target_type: "order",
            target_id: orderId,
            flag_type: "risky_order",
            severity: body.action === "approve_refund" ? "critical" : "warning",
            status: body.action === "mark_review" ? "in_review" : "resolved",
            reason: noteBody,
            metadata: {
              admin_action: body.action,
              order_status_before: before.order_status || before.status || null,
              payment_status_before: before.payment_status || null,
              order_status_after: updated.order_status || updated.status || null,
              payment_status_after: updated.payment_status || null,
              provider_dispatch: providerDispatch
            }
          })
          .select("*")
          .single(),
        warnings,
        "admin_operation_flags"
      )
    ]);

    await auditedOpsEvent({
      request,
      ctx,
      action: `admin.ops.refund_cancellation_${body.action}`,
      resourceType: "order",
      resourceId: orderId,
      severity: body.action === "approve_refund" ? "critical" : "warning",
      metadata: {
        reason: body.reason,
        note: body.note || null,
        old_value: before,
        new_value: updated,
        note_id: note?.id || null,
        flag_id: flag?.id || null,
        provider_dispatch: providerDispatch
      }
    });

    return {
      ok: true,
      item: refundCancellationPublic(updated, { notes: [note].filter(Boolean), flags: [flag].filter(Boolean), provider_dispatch: providerDispatch }),
      note,
      flag,
      provider_dispatch: providerDispatch,
      warnings
    };
  });

  opsGet("/support-tickets", async (request) => {
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

  opsPatch("/support-tickets/:ticketId/status", async (request) => {
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

  opsPost("/support-tickets/:ticketId/notes", async (request, reply) => {
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

  opsGet("/content-proposals", async (request) => {
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

  opsPost("/content-proposals", async (request, reply) => {
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

  opsGet("/social-media", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.social_media.list");
    const query = adminListQuerySchema.parse(request.query || {});
    const warnings = [];
    const social = await loadSocialMediaCenterData(warnings, query);

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.social_media_viewed",
      resourceType: "social_media_center",
      metadata: {
        search: query.search || null,
        status: query.status || null,
        draft_count: social.drafts.length,
        post_count: social.posts.length,
        warning_count: warnings.length
      }
    });

    return { ok: true, social, warnings };
  });

  opsPost("/social-media/accounts", async (request, reply) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.social_media.account_upsert");
    const payload = socialMediaAccountSchema.parse(request.body || {});
    const warnings = [];
    const account = await optionalMutation(
      supabaseAdmin
        .from("social_media_accounts")
        .upsert({
          ...payload,
          updated_by: ctx.user.id
        }, { onConflict: "platform,handle" })
        .select("*")
        .single(),
      warnings,
      "social_media_accounts"
    );

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.social_media_account_upserted",
      resourceType: "social_media_account",
      resourceId: account.id,
      metadata: { platform: account.platform, connector_mode: account.connector_mode, connection_status: account.connection_status }
    });

    return reply.code(201).send({ ok: true, account, warnings });
  });

  opsPost("/social-media/secrets", async (request, reply) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.social_media.secret_upsert");
    const payload = socialMediaSecretSchema.parse(request.body || {});
    const definition = findSecretDefinition(payload.platform, payload.secret_key);
    if (!definition) {
      throw httpError("Bu platform icin tanimli olmayan secret anahtari.", 400);
    }

    const warnings = [];
    const accountId = payload.account_id || null;
    const encryptedValue = encryptSecretValue(payload.secret_value, secretContext({
      platform: payload.platform,
      accountId,
      secretKey: payload.secret_key
    }));

    let existingQuery = supabaseAdmin
      .from("social_media_connector_secrets")
      .select("id")
      .eq("platform", payload.platform)
      .eq("secret_key", payload.secret_key);
    existingQuery = accountId ? existingQuery.eq("account_id", accountId) : existingQuery.is("account_id", null);
    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError) {
      if (looksLikeMissingSchema(existingError)) {
        throw httpError("social_media_connector_secrets migration uygulanmali.", 409);
      }
      throw existingError;
    }

    const row = {
      account_id: accountId,
      platform: payload.platform,
      secret_key: payload.secret_key,
      secret_label: definition.label,
      encrypted_value: encryptedValue,
      status: "active",
      expires_at: payload.expires_at || null,
      updated_by: ctx.user.id
    };

    const secret = existing
      ? await optionalMutation(
          supabaseAdmin
            .from("social_media_connector_secrets")
            .update(row)
            .eq("id", existing.id)
            .select("id, account_id, platform, secret_key, secret_label, status, expires_at, last_verified_at, updated_at")
            .single(),
          warnings,
          "social_media_connector_secrets"
        )
      : await optionalMutation(
          supabaseAdmin
            .from("social_media_connector_secrets")
            .insert({
              ...row,
              created_by: ctx.user.id
            })
            .select("id, account_id, platform, secret_key, secret_label, status, expires_at, last_verified_at, updated_at")
            .single(),
          warnings,
          "social_media_connector_secrets"
        );

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.social_media_secret_upserted",
      resourceType: "social_media_connector_secret",
      resourceId: secret.id,
      severity: "critical",
      metadata: {
        platform: payload.platform,
        secret_key: payload.secret_key,
        account_id: accountId,
        rotated: Boolean(existing),
        value_length: payload.secret_value.length
      }
    });

    return reply.code(existing ? 200 : 201).send({ ok: true, secret, warnings });
  });

  opsPost("/social-media/connections/test", async (request, reply) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.social_media.connection_test");
    const payload = socialMediaConnectionTestSchema.parse(request.body || {});
    const warnings = [];
    const definitions = secretDefinitionsFor(payload.platform);
    const accountId = payload.account_id || null;
    const connectorSecrets = await loadConnectorSecrets({
      platform: payload.platform,
      accountId,
      warnings
    });
    const missingRequired = definitions
      .filter((definition) => definition.required && !connectorSecrets[definition.key])
      .map((definition) => definition.key);

    if (missingRequired.length) {
      const result = {
        provider: "native_api_test",
        status: "skipped",
        responseStatus: null,
        responseBody: "",
        externalPostId: "",
        externalUrl: "",
        errorMessage: `Eksik zorunlu secret: ${missingRequired.join(", ")}`
      };

      await auditedOpsEvent({
        request,
        ctx,
        action: "admin.ops.social_media_connection_test_skipped",
        resourceType: "social_media_connector",
        severity: "warning",
        metadata: {
          platform: payload.platform,
          account_id: accountId,
          missing_required: missingRequired
        }
      });

      return reply.code(200).send({ ok: false, result, missing_required: missingRequired, warnings });
    }

    let result;
    try {
      result = await testSocialMediaConnector({
        platform: payload.platform,
        secrets: connectorSecrets
      });
    } catch (error) {
      result = {
        provider: "native_api_test",
        status: "failed",
        responseStatus: null,
        responseBody: "",
        externalPostId: "",
        externalUrl: "",
        errorMessage: error?.name === "AbortError" ? "Connector test timed out." : (error?.message || "Connector test failed.")
      };
    }

    const verified = result.status === "verified";
    if (verified) {
      let secretUpdate = supabaseAdmin
        .from("social_media_connector_secrets")
        .update({ last_verified_at: new Date().toISOString(), updated_by: ctx.user.id })
        .eq("platform", payload.platform)
        .eq("status", "active");
      secretUpdate = accountId ? secretUpdate.or(`account_id.eq.${accountId},account_id.is.null`) : secretUpdate.is("account_id", null);
      await optionalMutation(secretUpdate.select("id"), warnings, "social_media_connector_secrets");
    }

    let accountUpdate = supabaseAdmin
      .from("social_media_accounts")
      .update({
        connection_status: verified ? "connected" : "needs_reauth",
        updated_by: ctx.user.id
      })
      .eq("platform", payload.platform);
    if (accountId) accountUpdate = accountUpdate.eq("id", accountId);
    await optionalMutation(accountUpdate.select("id, platform, connection_status"), warnings, "social_media_accounts");

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.social_media_connection_tested",
      resourceType: "social_media_connector",
      severity: verified ? "info" : "warning",
      metadata: {
        platform: payload.platform,
        account_id: accountId,
        status: result.status,
        response_status: result.responseStatus,
        error: result.errorMessage || ""
      }
    });

    return reply.code(200).send({ ok: verified, result, warnings });
  });

  opsPost("/social-media/campaigns", async (request, reply) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.social_media.campaign_create");
    const payload = socialMediaCampaignSchema.parse(request.body || {});
    const warnings = [];
    const campaign = await optionalMutation(
      supabaseAdmin
        .from("social_media_campaigns")
        .insert({
          ...payload,
          prepared_by: ctx.user.id
        })
        .select("*")
        .single(),
      warnings,
      "social_media_campaigns"
    );

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.social_media_campaign_created",
      resourceType: "social_media_campaign",
      resourceId: campaign.id,
      metadata: { objective: campaign.objective, module_key: campaign.module_key }
    });

    return reply.code(201).send({ ok: true, campaign, warnings });
  });

  opsPost("/social-media/daily-package/generate", async (request, reply) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.social_media.daily_package_generate");
    const payload = socialMediaDailyPackageSchema.parse(request.body || {});
    const result = await generateSocialDailyPackageRecords({
      request,
      ctx,
      options: payload,
      source: "admin"
    });

    await auditedOpsEvent({
      request,
      ctx,
      action: result.skipped ? "admin.ops.social_media_daily_package_skipped" : "admin.ops.social_media_daily_package_ready",
      resourceType: "social_media_daily_plan",
      resourceId: result.plan?.id || null,
      severity: result.skipped ? "info" : "warning",
      metadata: {
        plan_date: payload.plan_date || todayInSocialTimezone(),
        objective: payload.objective,
        skipped: result.skipped,
        draft_id: result.draft?.id || null,
        post_count: result.posts.length,
        asset_id: result.asset?.id || null,
        warning_count: result.warnings.length
      }
    });

    return reply.code(result.skipped ? 200 : 201).send({ ok: true, ...result });
  });

  opsPost("/social-media/assets/prepare", async (request, reply) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.social_media.assets_prepare");
    const payload = socialMediaAssetPrepareSchema.parse(request.body || {});
    const result = await prepareSocialMediaAssets({ request, ctx, limit: payload.limit });
    return reply.code(200).send(result);
  });

  opsPost("/social-media/drafts", async (request, reply) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.social_media.draft_create");
    const payload = socialMediaDraftSchema.parse(request.body || {});
    const { draft, posts, warnings } = await createSocialDraftWithPosts({
      request,
      ctx,
      payload,
      initialStatus: "draft",
      postStatus: "draft",
      auditAction: "admin.ops.social_media_draft_created"
    });
    return reply.code(201).send({ ok: true, draft, posts, warnings });
  });

  opsPost("/social-media/posts/:postId/media", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.social_media.post_media_update");
    const postId = uuidSchema.parse(request.params.postId);
    const payload = socialMediaPostMediaSchema.parse(request.body || {});
    const warnings = [];
    const existingRows = await optionalQuery(
      supabaseAdmin
        .from("social_media_platform_posts")
        .select("*")
        .eq("id", postId)
        .limit(1),
      [],
      warnings,
      "social_media_platform_posts"
    );
    const existing = existingRows[0];
    if (!existing) throw httpError("Platform postu bulunamadi.", 404);

    const nextPayload = {
      ...(existing.platform_payload || {}),
      ...(payload.platform_payload || {})
    };
    if (payload.image_url) nextPayload.image_url = payload.image_url;
    if (payload.video_url) nextPayload.video_url = payload.video_url;
    if (payload.link) {
      nextPayload.link = payload.link;
      nextPayload.landing_url = payload.link;
    }

    const post = await optionalMutation(
      supabaseAdmin
        .from("social_media_platform_posts")
        .update({
          platform_payload: nextPayload,
          last_error: ""
        })
        .eq("id", postId)
        .select("*")
        .single(),
      warnings,
      "social_media_platform_posts"
    );

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.social_media_post_media_updated",
      resourceType: "social_media_platform_post",
      resourceId: post.id,
      metadata: {
        platform: post.platform,
        has_image_url: Boolean(nextPayload.image_url),
        has_video_url: Boolean(nextPayload.video_url),
        has_link: Boolean(nextPayload.link || nextPayload.landing_url)
      }
    });

    return { ok: true, post, warnings };
  });

  opsPost("/social-media/drafts/:draftId/submit", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.social_media.draft_submit");
    const draftId = uuidSchema.parse(request.params.draftId);
    const warnings = [];
    const draft = await optionalMutation(
      supabaseAdmin
        .from("social_media_drafts")
        .update({
          status: "ready_for_review",
          submitted_by: ctx.user.id,
          submitted_at: new Date().toISOString()
        })
        .eq("id", draftId)
        .in("status", ["draft", "needs_changes"])
        .select("*")
        .single(),
      warnings,
      "social_media_drafts"
    );

    await optionalMutation(
      supabaseAdmin
        .from("social_media_platform_posts")
        .update({ status: "ready_for_review" })
        .eq("draft_id", draftId)
        .in("status", ["draft", "blocked"])
        .select("id"),
      warnings,
      "social_media_platform_posts"
    );

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.social_media_draft_submitted",
      resourceType: "social_media_draft",
      resourceId: draft.id,
      metadata: { title: draft.title }
    });

    return { ok: true, draft, warnings };
  });

  opsPost("/social-media/drafts/:draftId/approve", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.social_media.draft_approve");
    const draftId = uuidSchema.parse(request.params.draftId);
    const payload = socialMediaDraftApprovalSchema.parse(request.body || {});
    const warnings = [];
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("social_media_drafts")
      .select("*")
      .eq("id", draftId)
      .maybeSingle();
    if (existingError) {
      if (looksLikeMissingSchema(existingError)) throw httpError("social_media_drafts migration uygulanmali.", 409);
      throw existingError;
    }
    if (!existing) throw httpError("Sosyal medya taslagi bulunamadi.", 404);
    if (existing.uniqueness_status !== "unique") throw httpError("Benzersizlik kontrolu gecmeyen taslak onaylanamaz.", 409);

    const duplicate = await findSocialDuplicate({
      contentHash: existing.content_hash,
      semanticHash: existing.semantic_hash,
      visualHash: existing.visual_hash,
      excludeId: existing.id
    });
    if (duplicate) throw httpError(`Tekrar icerik engellendi. Benzer kayit: ${duplicate.title}`, 409);

    const scheduledFor = payload.publish_now ? new Date().toISOString() : (payload.scheduled_for || existing.scheduled_for || null);
    const draftStatus = scheduledFor ? "scheduled" : "approved";
    const postStatus = scheduledFor ? "scheduled" : "approved";
    const draft = await optionalMutation(
      supabaseAdmin
        .from("social_media_drafts")
        .update({
          status: draftStatus,
          scheduled_for: scheduledFor,
          approved_by: ctx.user.id,
          approved_at: new Date().toISOString(),
          metadata: {
            ...(existing.metadata || {}),
            approval_note: payload.approval_note || ""
          }
        })
        .eq("id", draftId)
        .select("*")
        .single(),
      warnings,
      "social_media_drafts"
    );

    const postUpdatePayload = {
      status: postStatus,
      approved_by: ctx.user.id,
      approved_at: new Date().toISOString(),
      last_error: ""
    };
    if (scheduledFor) postUpdatePayload.scheduled_for = scheduledFor;

    await optionalMutation(
      supabaseAdmin
        .from("social_media_platform_posts")
        .update(postUpdatePayload)
        .eq("draft_id", draftId)
        .in("status", ["draft", "ready_for_review", "approved", "scheduled", "queued"])
        .select("id"),
      warnings,
      "social_media_platform_posts"
    );

    let dispatch = { results: [], warnings: [] };
    if (payload.publish_now) {
      dispatch = await dispatchDueSocialMediaPosts({ request, ctx, limit: config.socialMedia.maxDispatchBatch });
      warnings.push(...dispatch.warnings);
    }

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.social_media_draft_approved",
      resourceType: "social_media_draft",
      resourceId: draft.id,
      severity: payload.publish_now ? "warning" : "info",
      metadata: {
        title: draft.title,
        publish_now: payload.publish_now,
        scheduled_for: scheduledFor,
        dispatch_count: dispatch.results.length
      }
    });

    return { ok: true, draft, dispatch, warnings };
  });

  opsPost("/social-media/posts/:postId/dispatch", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.social_media.post_dispatch");
    const postId = uuidSchema.parse(request.params.postId);
    const warnings = [];
    await optionalMutation(
      supabaseAdmin
        .from("social_media_platform_posts")
        .update({
          status: "queued",
          scheduled_for: new Date().toISOString(),
          last_error: ""
        })
        .eq("id", postId)
        .in("status", ["approved", "scheduled", "queued", "failed"])
        .select("id"),
      warnings,
      "social_media_platform_posts"
    );
    const dispatch = await dispatchDueSocialMediaPosts({ request, ctx, limit: 5 });
    warnings.push(...dispatch.warnings);

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.social_media_post_dispatch_requested",
      resourceType: "social_media_platform_post",
      resourceId: postId,
      severity: "warning",
      metadata: { result_count: dispatch.results.length }
    });

    return { ok: true, dispatch, warnings };
  });

  opsPost("/social-media/dispatch-due", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.social_media.dispatch_due");
    const dispatch = await dispatchDueSocialMediaPosts({ request, ctx, limit: config.socialMedia.maxDispatchBatch });

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.social_media_dispatch_due_requested",
      resourceType: "social_media_dispatch",
      severity: "warning",
      metadata: { result_count: dispatch.results.length, warning_count: dispatch.warnings.length }
    });

    return { ok: true, dispatch };
  });

  opsPost("/social-media/daily-plans", async (request, reply) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.social_media.daily_plan_create");
    const payload = socialMediaDailyPlanSchema.parse(request.body || {});
    const warnings = [];
    const plan = await optionalMutation(
      supabaseAdmin
        .from("social_media_daily_plans")
        .upsert({
          plan_date: payload.plan_date,
          objective: payload.objective,
          timezone: config.socialMedia.defaultTimezone,
          summary: payload.summary,
          target_platforms: payload.target_platforms,
          draft_ids: payload.draft_ids,
          prepared_by: ctx.user.id,
          metadata: payload.metadata
        }, { onConflict: "plan_date,objective" })
        .select("*")
        .single(),
      warnings,
      "social_media_daily_plans"
    );

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.social_media_daily_plan_upserted",
      resourceType: "social_media_daily_plan",
      resourceId: plan.id,
      metadata: { plan_date: plan.plan_date, objective: plan.objective, draft_count: plan.draft_ids?.length || 0 }
    });

    return reply.code(201).send({ ok: true, plan, warnings });
  });

  opsGet("/security-monitoring", async (request) => {
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

  opsGet("/reports", async (request) => {
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

  opsGet("/audit-log", async (request) => {
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

  async function recordRewardsLedger(request, legacyAlias = false) {
    const ctx = await requireAuth(request, {
      roles: ["admin", "super_admin"],
      mfa: true,
      adminBoundary: true,
      action: legacyAlias ? "rewards.ledger_legacy_alias" : "rewards.ledger"
    });
    const body = rewardsLedgerSchema.parse(request.body || {});

    const targetUserId = body.userId || ctx.user.id;
    const { error } = await supabaseAdmin
      .from("admin_notifications")
      .insert({
        user_id: targetUserId,
        kind: "rewards_ledger",
        severity: "info",
        title: "HP/Kupon işlem kaydı",
        message: body.reason,
        metadata: {
          amount: body.amount,
          reference: body.reference || "",
          requested_by: ctx.user.id,
          legacy_alias: legacyAlias
        }
      });
    if (error) throw error;
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: legacyAlias ? "rewards.ledger_recorded_legacy_alias" : "rewards.ledger_recorded",
      resourceType: "user",
      resourceId: targetUserId,
      severity: "warning",
      metadata: { amount: body.amount, reference: body.reference || "", legacy_alias: legacyAlias }
    });
    return { ok: true };
  }

  app.post("/v1/rewards/ledger", async (request) => {
    return recordRewardsLedger(request, false);
  });

  app.post("/v1/hp-wallet/ledger", async (request) => {
    return recordRewardsLedger(request, true);
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

  app.post("/v1/cron/integrations/sync", async (request) => {
    if (!config.cronSecret || request.headers["x-cron-secret"] !== config.cronSecret) {
      await auditEvent({
        request,
        action: "cron.integrations_sync_denied",
        severity: "critical",
        metadata: { path: request.url.split("?")[0] }
      });
      throw httpError("Cron yetkisi doğrulanamadı.", 401);
    }

    if (!config.integrations.enabled) {
      return { ok: true, skipped: true, reason: "PARTNER_INTEGRATIONS_ENABLED=false" };
    }

    const { data, error } = await supabaseAdmin
      .from("partner_integrations")
      .select("*, partner:partner_businesses(*)")
      .eq("status", "active")
      .eq("sync_mode", "scheduled")
      .eq("import_enabled", true)
      .lte("next_sync_at", new Date().toISOString())
      .order("next_sync_at", { ascending: true })
      .limit(20);
    if (error) {
      if (looksLikeMissingSchema(error)) {
        return { ok: true, skipped: true, reason: "partner_integration_core_migration_missing" };
      }
      throw error;
    }

    const results = [];
    request.integrationActorRole = "system";
    for (const integration of data || []) {
      if (!integration.partner) {
        results.push({ integration_id: integration.id, status: "skipped", reason: "partner_missing" });
        continue;
      }
      try {
        const scheduledMode = integration.settings?.scheduled_run_mode === "apply" ? "apply" : "preview";
        const run = await runPartnerIntegrationSync({
          business: integration.partner,
          integration,
          request,
          payload: {
            mode: scheduledMode,
            direction: "inbound",
            trigger_source: "cron",
            limit: scheduledMode === "apply" ? config.integrations.maxApplyRows : config.integrations.maxPreviewRows
          }
        });
        results.push({ integration_id: integration.id, status: run.status, run_id: run.id });
      } catch (runError) {
        results.push({ integration_id: integration.id, status: "failed", message: runError.message });
      }
    }

    await auditEvent({
      request,
      action: "cron.integrations_sync_completed",
      resourceType: "partner_integration",
      metadata: { checked: results.length, failed: results.filter((item) => item.status === "failed").length }
    });

    return { ok: true, checked: results.length, results };
  });

  app.post("/v1/cron/social-media-daily-drafts", async (request) => {
    if (!config.cronSecret || request.headers["x-cron-secret"] !== config.cronSecret) {
      await auditEvent({
        request,
        action: "cron.social_media_daily_drafts_denied",
        severity: "critical",
        metadata: { path: request.url.split("?")[0] }
      });
      const error = new Error("Cron yetkisi doğrulanamadı.");
      error.statusCode = 401;
      throw error;
    }

    if (!config.socialMedia.dailyDraftsEnabled) {
      return {
        ok: true,
        skipped: true,
        reason: "SOCIAL_MEDIA_DAILY_DRAFTS_ENABLED=false"
      };
    }

    const payload = socialMediaDailyPackageSchema.parse(request.body || {});
    const result = await generateSocialDailyPackageRecords({
      request,
      options: {
        ...payload,
        auto_submit: true,
        force_new: false
      },
      source: "cron"
    });

    await auditEvent({
      request,
      action: result.skipped ? "cron.social_media_daily_package_skipped" : "cron.social_media_daily_package_ready",
      resourceType: "social_media_daily_plan",
      resourceId: result.plan?.id || null,
      severity: result.skipped ? "info" : "warning",
      source: "cron",
      purpose: "social_media_daily_package",
      metadata: {
        plan_date: payload.plan_date || todayInSocialTimezone(),
        objective: payload.objective,
        skipped: result.skipped,
        draft_id: result.draft?.id || null,
        post_count: result.posts.length,
        warning_count: result.warnings.length
      }
    });

    return { ok: true, ...result };
  });

  app.post("/v1/cron/social-media-assets-prepare", async (request) => {
    if (!config.cronSecret || request.headers["x-cron-secret"] !== config.cronSecret) {
      await auditEvent({
        request,
        action: "cron.social_media_assets_prepare_denied",
        severity: "critical",
        metadata: { path: request.url.split("?")[0] }
      });
      const error = new Error("Cron yetkisi doğrulanamadı.");
      error.statusCode = 401;
      throw error;
    }

    const payload = socialMediaAssetPrepareSchema.parse(request.body || {});
    const result = await prepareSocialMediaAssets({ request, ctx: null, limit: payload.limit });
    return { ok: true, ...result };
  });

  app.post("/v1/cron/social-media-assets-cleanup", async (request) => {
    if (!config.cronSecret || request.headers["x-cron-secret"] !== config.cronSecret) {
      await auditEvent({
        request,
        action: "cron.social_media_assets_cleanup_denied",
        severity: "critical",
        metadata: { path: request.url.split("?")[0] }
      });
      const error = new Error("Cron yetkisi doğrulanamadı.");
      error.statusCode = 401;
      throw error;
    }

    const payload = socialMediaAssetCleanupSchema.parse(request.body || {});
    const result = await cleanupSocialMediaAssetStorage({
      retentionDays: payload.retention_days,
      limit: payload.limit,
      dryRun: payload.dry_run
    });

    await auditEvent({
      request,
      action: "cron.social_media_assets_cleaned",
      resourceType: "storage_bucket",
      resourceId: result.bucket,
      severity: result.deleted ? "warning" : "info",
      source: "cron",
      purpose: "social_media_asset_retention",
      metadata: result
    });

    return { ok: true, cleanup: result };
  });

  app.post("/v1/cron/social-media-dispatch", async (request) => {
    if (!config.cronSecret || request.headers["x-cron-secret"] !== config.cronSecret) {
      await auditEvent({
        request,
        action: "cron.social_media_dispatch_denied",
        severity: "critical",
        metadata: { path: request.url.split("?")[0] }
      });
      const error = new Error("Cron yetkisi doğrulanamadı.");
      error.statusCode = 401;
      throw error;
    }

    const dispatch = await dispatchDueSocialMediaPosts({ request, limit: config.socialMedia.maxDispatchBatch });
    await auditEvent({
      request,
      action: "cron.social_media_dispatch_checked",
      resourceType: "social_media_dispatch",
      severity: dispatch.results.length ? "warning" : "info",
      metadata: {
        result_count: dispatch.results.length,
        warning_count: dispatch.warnings.length,
        dry_run: socialMediaDispatchStatus().dry_run
      }
    });

    return { ok: true, dispatch };
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
