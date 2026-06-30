import { createHash, createHmac, randomBytes } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import net from "node:net";
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

const currencyRatesQuerySchema = z.object({
  base: z.string().trim().length(3).regex(/^[a-z]{3}$/i).optional().default(config.currency.baseCurrency || "TRY")
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

const nullablePartnerProductText = (max) => z.preprocess(
  (value) => value === "" ? null : value,
  z.string().trim().max(max).nullable().optional()
);

const partnerProductMediaGallerySchema = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return value.split(/[\n,]+/);
    }
  }
  return [];
}, z.array(z.string().trim().max(1200).refine((value) => (
  !value || /^https?:\/\//i.test(value)
), "Galeri URL http/https formatında olmalı.")).max(8).optional());

const partnerProductListQuerySchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  status: z.string().trim().max(80).optional().default("all"),
  limit: z.coerce.number().int().min(1).max(500).optional().default(300)
});

const partnerProductUpdateSchema = z.object({
  name: z.string().trim().min(2).max(180).optional(),
  product_name: z.string().trim().min(2).max(180).optional(),
  description: nullablePartnerProductText(1800),
  price: z.coerce.number().min(0).max(10000000).optional(),
  stock: z.coerce.number().int().min(0).max(1000000).optional(),
  image_url: nullablePartnerProductText(900),
  media_gallery: partnerProductMediaGallerySchema,
  video_url: nullablePartnerProductText(1200),
  category: nullablePartnerProductText(120),
  brand: nullablePartnerProductText(140),
  sku: nullablePartnerProductText(90),
  module_key: z.enum(["shop", "market", "food", "taxi", "service"]).optional(),
  catalog_scope: z.enum(["shop", "market", "food", "taxi", "service"]).optional(),
  seller_public_name: nullablePartnerProductText(140),
  seller_legal_name: nullablePartnerProductText(180),
  seller_city: nullablePartnerProductText(90),
  seller_contact: nullablePartnerProductText(180),
  seller_tax_number_masked: nullablePartnerProductText(40),
  invoice_responsibility: nullablePartnerProductText(320),
  seller_disclosure: nullablePartnerProductText(420),
  meta_title: nullablePartnerProductText(180),
  meta_description: nullablePartnerProductText(300)
}).refine((value) => Object.keys(value).length > 0, {
  message: "Guncellenecek urun alani gonderilmedi."
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
  limit: z.coerce.number().int().min(1).max(500).optional(),
  confirm_apply: z.string().trim().max(120).optional().default(""),
  approval_note: z.string().trim().max(500).optional().default("")
});

const partnerIntegrationPublishJobSchema = z.object({
  product_ids: z.array(uuidSchema).min(1).max(100),
  action: z.enum(["create", "update", "upsert", "stock_price", "archive", "delete"]).optional().default("upsert"),
  priority: z.coerce.number().int().min(1).max(999).optional().default(100),
  scheduled_at: z.string().datetime().optional()
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

const adminProductReviewDecisionSchema = z.object({
  decision: z.enum(["approved", "needs_review", "rejected"]),
  reason: z.string().trim().min(3).max(1200)
});

const adminProductReviewBulkDecisionSchema = adminProductReviewDecisionSchema.extend({
  product_ids: z.array(uuidSchema).min(1).max(100),
  only_auto_approvable: z.boolean().optional().default(false)
});

const automationActionSchema = z.enum(["publish_safe_products"]);

const automationRunSchema = z.object({
  apply: z.boolean().optional().default(false),
  actions: z.array(automationActionSchema).optional().default(["publish_safe_products"]),
  limit: z.coerce.number().int().min(1).max(80).optional().default(40),
  reason: z.string().trim().max(900).optional().default("")
});

const automationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(120).optional().default(80)
});

const partnerApplicationActionSchema = z.object({
  action: z.enum(["start_review", "recommend_approve", "recommend_reject", "send_super_admin"]),
  reason: z.string().trim().min(3).max(1200),
  risk_level: z.enum(["info", "warning", "critical"]).optional().default("info")
});

const partnerApplicationActionRequestSchema = partnerApplicationActionSchema.extend({
  application_id: uuidSchema
});

const publicPartnerApplicationSchema = z.object({
  partner_name: z.string().trim().max(160).optional().default(""),
  company_name: z.string().trim().max(160).optional().default(""),
  contact_name: z.string().trim().min(2).max(140),
  email: emailSchema,
  phone: z.string().trim().min(7).max(40),
  tax_number: z.string().trim().min(2).max(60),
  tax_office: z.string().trim().max(120).optional().default(""),
  company_type: z.string().trim().min(2).max(120),
  website: z.string().trim().max(240).optional().default(""),
  city: z.string().trim().min(2).max(90),
  country: z.string().trim().min(2).max(90),
  category: z.string().trim().min(2).max(140),
  message: z.string().trim().max(1600).optional().default(""),
  company_lookup: z.record(z.unknown()).optional().default({}),
  turnstileToken: z.string().trim().max(4096).optional().default("")
}).refine((value) => value.company_name || value.partner_name, {
  message: "Firma / işletme adı zorunlu.",
  path: ["company_name"]
});

const partnerCompanyLookupSchema = z.object({
  country: z.string().trim().max(90).optional().default(""),
  country_code: z.string().trim().max(8).optional().default(""),
  tax_number: z.string().trim().min(2).max(60),
  turnstileToken: z.string().trim().max(4096).optional().default("")
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
const BACKEND_BUILD_MARKER = "admin-alarm-external-threats-20260629-1";
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

const PARTNER_APPROVAL_TYPES = ["shop", "food", "market", "service"];

const partnerApplicationDecisionSchema = z.object({
  decision: z.enum(["review", "approved", "rejected"]),
  reason: z.string().trim().max(800).optional().default(""),
  commission_rate: z.coerce.number().min(0).max(0.9).optional(),
  store_status: z.enum(["review", "active", "paused", "suspended"]).optional(),
  partner_type: z.enum(PARTNER_APPROVAL_TYPES).optional()
});

const partnerApplicationDecisionRequestSchema = partnerApplicationDecisionSchema.extend({
  application_id: uuidSchema
});

const superAdminPartnerInviteSchema = z.object({
  company_name: z.string().trim().min(2).max(160),
  contact_name: z.string().trim().min(2).max(140),
  email: emailSchema,
  phone: z.string().trim().max(40).optional().default(""),
  tax_number: z.string().trim().max(60).optional().default(""),
  tax_office: z.string().trim().max(120).optional().default(""),
  company_type: z.string().trim().max(120).optional().default(""),
  city: z.string().trim().max(90).optional().default(""),
  country: z.string().trim().max(90).optional().default("Türkiye"),
  category: z.string().trim().max(140).optional().default("AllonaHub Partner"),
  website: z.string().trim().max(240).optional().default(""),
  message: z.string().trim().max(1600).optional().default("Super Admin panelinden doğrudan partner oluşturuldu."),
  partner_type: z.enum(PARTNER_APPROVAL_TYPES).optional().default("shop"),
  commission_rate: z.coerce.number().min(0).max(0.9).optional().default(0.12),
  store_status: z.enum(["review", "active", "paused", "suspended"]).optional().default("active"),
  reason: z.string().trim().min(6).max(900).optional().default("Super Admin panelinden doğrudan partner daveti oluşturuldu.")
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

const MODULE_SUBDOMAIN_BY_KEY = {
  shop: "shop",
  food: "yemek",
  market: "market",
  taxi: "taksi",
  mall: "avm",
  travel: "seyahat",
  health: "saglik",
  maritime: "denizcilik",
  legal: "hukuk",
  consulting: "danismanlik",
  real_estate: "emlak",
  automotive: "otomotiv",
  education: "egitim",
  career: "kariyer",
  finance: "finans",
  events: "eglence",
  pet: "pet",
  technology: "teknoloji",
  sports_fitness: "spor",
  beauty: "guzellik",
  insurance: "sigorta",
  courier: "kurye",
  home_services: "evhizmetleri",
  logistics: "lojistik",
  moving: "nakliye",
  organization: "organizasyon",
  agriculture: "tarim",
  construction: "insaat",
  engineering: "muhendislik",
  trade: "trade",
  hospitality: "otelcilik"
};

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

const currencyRatesCache = new Map();

function normalizeCurrencyCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : "";
}

function currencyRatesUrl(base) {
  const template = config.currency.ratesUrl || "https://open.er-api.com/v6/latest/{base}";
  const href = String(template).replace("{base}", encodeURIComponent(base));
  let parsed;
  try {
    parsed = new URL(href);
  } catch {
    throw httpError("Kur sağlayıcı adresi geçerli değil.", 500);
  }
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw httpError("Kur sağlayıcı protokolü desteklenmiyor.", 500);
  }
  return parsed.href;
}

async function fetchCurrencyRates(base, request) {
  const cacheKey = normalizeCurrencyCode(base) || normalizeCurrencyCode(config.currency.baseCurrency) || "TRY";
  const cached = currencyRatesCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - Number(cached.fetchedAt || 0) < Number(config.currency.cacheMs || 0)) {
    return { ...cached.payload, cache: "hit" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(config.currency.timeoutMs || 8000));
  try {
    const endpoint = currencyRatesUrl(cacheKey);
    const response = await fetch(endpoint, {
      headers: {
        accept: "application/json",
        "user-agent": "AllonaHub-CurrencyProxy/1.0"
      },
      signal: controller.signal
    });
    if (!response.ok) throw httpError("Kur sağlayıcı yanıt vermedi.", 502);
    const payload = await response.json();
    if (payload.result && payload.result !== "success") throw httpError("Kur sağlayıcı başarılı yanıt döndürmedi.", 502);
    const rates = payload.rates || payload.conversion_rates || {};
    if (!rates || typeof rates !== "object" || !Object.keys(rates).length) {
      throw httpError("Kur listesi alınamadı.", 502);
    }
    const normalized = {
      ok: true,
      result: "success",
      provider: payload.provider || "ExchangeRate-API",
      base_code: normalizeCurrencyCode(payload.base_code || payload.base || cacheKey) || cacheKey,
      rates,
      time_last_update_unix: Number(payload.time_last_update_unix || 0) || Math.floor(now / 1000),
      fetched_at: new Date(now).toISOString(),
      cache: "miss"
    };
    currencyRatesCache.set(cacheKey, { fetchedAt: now, payload: normalized });
    return normalized;
  } catch (error) {
    request.log.warn({ err: error, base: cacheKey }, "Currency rates proxy failed");
    if (cached) return { ...cached.payload, cache: "stale" };
    throw error.statusCode ? error : httpError("Kur bilgisi şu anda alınamadı.", 502);
  } finally {
    clearTimeout(timer);
  }
}

function sha256Json(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sha256Text(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

const PRODUCT_IMAGE_CONTENT_TYPES = new Map([
  ["avif", "image/avif"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"]
]);

function productImageContentType(path) {
  const extension = String(path || "").split(".").pop().toLowerCase();
  return PRODUCT_IMAGE_CONTENT_TYPES.get(extension) || "application/octet-stream";
}

function normalizeProductImagePath(rawPath) {
  let decoded = "";
  try {
    decoded = decodeURIComponent(String(rawPath || ""));
  } catch {
    throw httpError("Urun gorseli yolu gecersiz.", 400);
  }

  const path = decoded.replace(/^\/+/, "");
  const parts = path.split("/");
  const extension = path.split(".").pop().toLowerCase();
  const invalid = (
    !path ||
    path.length > 900 ||
    !path.startsWith("products/") ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.includes("//") ||
    parts.some((part) => !part || part === "." || part === "..") ||
    !PRODUCT_IMAGE_CONTENT_TYPES.has(extension) ||
    !/^[a-z0-9._/-]+$/i.test(path)
  );
  if (invalid) throw httpError("Urun gorseli bulunamadi.", 404);
  return path;
}

function mediaCacheHeaders(reply, path) {
  const ttl = Math.max(3600, Number(config.productMedia.cacheMaxAgeSeconds || 31536000));
  const etag = `"product-image-${sha256Text(path).slice(0, 24)}"`;
  reply.header("Cache-Control", `public, max-age=${ttl}, s-maxage=${ttl}, immutable`);
  reply.header("CDN-Cache-Control", `public, max-age=${ttl}`);
  reply.header("Cloudflare-CDN-Cache-Control", `public, max-age=${ttl}`);
  reply.header("ETag", etag);
  reply.header("Vary", "Accept-Encoding");
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Cross-Origin-Resource-Policy", "cross-origin");
  reply.header("X-Content-Type-Options", "nosniff");
  return etag;
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

async function userOwnsActivePartnerBusiness(userId) {
  if (!userId) return false;
  try {
    const { data, error } = await supabaseAdmin
      .from("partner_businesses")
      .select("id")
      .eq("owner_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (error) return false;
    return Boolean(data?.id);
  } catch (error) {
    return false;
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
    if (options.roles.includes("partner") && await userOwnsActivePartnerBusiness(ctx.user.id)) {
      ctx.profile = { ...ctx.profile, role: "partner" };
      ctx.partnerBusinessRoleGranted = true;
    } else {
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

function auditEventSearchText(event) {
  return [
    event?.severity,
    event?.action,
    event?.resource_type,
    event?.resource_id,
    event?.actor_role,
    event?.source,
    event?.purpose,
    event?.metadata ? JSON.stringify(event.metadata) : ""
  ].filter(Boolean).join(" ").toLowerCase();
}

function isPrivilegedAuditActor(event) {
  return ["admin", "super_admin"].includes(String(event?.actor_role || "").toLowerCase());
}

function isTrustedPrivilegedAuditEvent(event) {
  const raw = auditEventSearchText(event);
  if (!isPrivilegedAuditActor(event)) return false;
  if (event?.source !== "admin") return false;
  if (/authz\.denied|auth\.denied|owner_denied|role_denied|permission_super_admin_denied|boundary_denied|mfa_required|unauthorized|forbidden/.test(raw)) return false;
  if (/attack|intrusion|breach|compromise|bruteforce|sql|xss|csrf|red_zone|blocked_ip|suspicious_ip/.test(raw)) return false;
  return true;
}

function isExternalSecurityAuditEvent(event) {
  const raw = auditEventSearchText(event);
  if (isTrustedPrivilegedAuditEvent(event)) return false;
  if (isPrivilegedAuditActor(event) && event?.source === "admin" && !/authz\.denied|auth\.denied|owner_denied|role_denied|permission_super_admin_denied|boundary_denied/.test(raw)) {
    return false;
  }
  return /authz\.denied|auth\.denied|owner_denied|role_denied|permission_super_admin_denied|boundary_denied|red_zone|attack|intrusion|breach|compromise|bruteforce|sql|xss|csrf|auto_defense|blocked_ip|suspicious_ip/.test(raw);
}

function securityRiskSeverity(event) {
  return isExternalSecurityAuditEvent(event) ? (event?.severity || "warning") : "low";
}

function securityEventPublic(event) {
  return {
    ...event,
    risk_severity: securityRiskSeverity(event),
    trusted_internal: isTrustedPrivilegedAuditEvent(event),
    external_threat: isExternalSecurityAuditEvent(event)
  };
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
      ...moduleSubdomainPublic(item.module_key),
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

function moduleSubdomainPublic(moduleKey) {
  const subdomain = MODULE_SUBDOMAIN_BY_KEY[moduleKey];
  if (!subdomain) return {};
  return {
    subdomain,
    subdomain_url: `https://${subdomain}.allonahub.com`
  };
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
  if (!error && data === true) return ctx;

  if (isAdmin(ctx.profile) && hasMfa(ctx)) {
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "admin.ops.boundary_fallback_allowed",
      resourceType: "admin_ops",
      severity: "warning",
      source: "admin",
      purpose: "admin_operations",
      metadata: {
        requested_action: action,
        db_role_check_error: error?.message || null,
        db_role_check_result: data ?? null,
        fallback: "backend_role_mfa_admin_boundary_verified"
      },
      evidenceTags: ["admin_ops", "boundary_fallback"]
    });
    return ctx;
  }

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
      db_role_check_error: error?.message || null,
      db_role_check_result: data ?? null
    }
  });
  throw httpError("Admin Panel yetki sınırı doğrulanamadı.", 403);
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

function normalizedReviewValue(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function productNeedsAdminReview(product = {}) {
  const status = normalizedReviewValue(product.status);
  const reviewStatus = normalizedReviewValue(
    product.compliance_review_status
      || product.review_status
      || product.approval_status
      || product.moderation_status
  );
  const hasPartnerOrImportSignal = Boolean(
    product.partner_id
      || product.partner_code
      || product.partner_email
      || product.integration_source
      || product.integration_external_id
  );
  const closedReviewStatuses = new Set(["approved", "rejected"]);
  const closedProductStatuses = new Set(["active", "approved", "published", "archived", "rejected", "deleted", "hidden"]);
  const waitingReviewStatuses = new Set(["pending", "needs_review", "review", "in_review", "draft", "submitted", "awaiting_review", "waiting_review"]);
  const waitingProductStatuses = new Set(["", "draft", "pending", "review", "in_review", "needs_review", "submitted", "awaiting_review", "waiting_review"]);

  if (closedReviewStatuses.has(reviewStatus) || ["archived", "rejected", "deleted", "hidden"].includes(status)) return false;
  if (waitingReviewStatuses.has(reviewStatus)) return hasPartnerOrImportSignal || waitingProductStatuses.has(status);
  if (waitingProductStatuses.has(status)) return true;
  return hasPartnerOrImportSignal && !closedProductStatuses.has(status);
}

const productReviewFieldLabels = {
  name: "Ürün adı",
  product_name: "Ürün adı",
  description: "Açıklama",
  meta_title: "SEO başlığı",
  meta_description: "SEO açıklaması",
  category: "Kategori",
  brand: "Marka",
  seller_disclosure: "Satıcı bilgilendirme",
  invoice_responsibility: "Fatura sorumluluğu"
};

const productReviewPolicyRules = [
  {
    code: "prohibited_or_illegal_terms",
    severity: "critical",
    requiresRevision: true,
    fields: ["name", "product_name", "description", "meta_title", "meta_description", "category", "brand"],
    pattern: /\b(sahte|replika|kaçak|kacak|yasadışı|yasadisi|uyuşturucu|uyusturucu|narkotik|silah|tabanca|tüfek|tufek|patlayıcı|patlayici|çalıntı|calinti|kumar|bahis)\b/i,
    title: "Yasaklı veya hukuki riskli ifade",
    suggestion: "Ürün adı, kategori veya açıklamadaki yasaklı/kaçak/hukuki riskli ifadeyi kaldırıp mevzuata uygun ürün içeriğiyle değiştirin."
  },
  {
    code: "regulated_health_claim",
    severity: "critical",
    requiresRevision: true,
    fields: ["name", "product_name", "description", "meta_title", "meta_description"],
    pattern: /(%100\s*(kesin|garanti)|kesin\s+(çözüm|cozum|tedavi)|mucize|garantili\s+tedavi|doktor\s+onaylı|doktor\s+onayli|bakanlık\s+onaylı|bakanlik\s+onayli|reçetesiz\s+ilaç|recetesiz\s+ilac)/i,
    title: "Sağlık/performans iddiası",
    suggestion: "İspatlanamayan sağlık, tedavi, kesin sonuç veya resmi onay iddialarını açıklamadan çıkarın."
  },
  {
    code: "contact_information_in_content",
    severity: "critical",
    requiresRevision: true,
    fields: ["description", "meta_description", "seller_disclosure"],
    pattern: /((\+?90\s*)?0?\s*5\d{2}[\s().-]*\d{3}[\s().-]*\d{2}[\s().-]*\d{2}|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|https?:\/\/|www\.|wa\.me|whatsapp|telegram|instagram|tiktok|facebook|x\.com|\.com\b|\.net\b|\.org\b)/i,
    title: "Açıklamada harici iletişim/yönlendirme",
    suggestion: "Telefon, e-posta, sosyal medya, WhatsApp veya dış link bilgisini ürün açıklamasından kaldırın; iletişim AllonaHub akışı üzerinden yürümeli."
  },
  {
    code: "return_exchange_payment_bypass",
    severity: "critical",
    requiresRevision: true,
    fields: ["description", "meta_description", "seller_disclosure"],
    pattern: /(iade\s+(yok|kabul\s+edilmez|alınmaz|alinmaz)|değişim\s+(yok|kabul\s+edilmez)|degisim\s+(yok|kabul\s+edilmez)|cayma\s+hakkı\s+yok|cayma\s+hakki\s+yok|kapıda\s+ödeme|kapida\s+odeme|iban|havale|eft|elden\s+ödeme|elden\s+odeme|whatsapp'tan\s+sipariş|whatsapptan\s+siparis)/i,
    title: "İade/değişim veya ödeme akışını bozan ifade",
    suggestion: "İade/değişim yasağı, IBAN/havale/elden ödeme veya platform dışı sipariş yönlendirmesi içeren metni kaldırın."
  },
  {
    code: "violence_or_hate_content",
    severity: "critical",
    requiresRevision: true,
    fields: ["name", "product_name", "description", "meta_title", "meta_description"],
    pattern: /(nefret\s+söylemi|nefret\s+soylemi|ırkçı|irkci|şiddet\s+çağrısı|siddet\s+cagrisi|terör|teror|örgüt|orgut)/i,
    title: "Şiddet/nefret içerik riski",
    suggestion: "Şiddet, nefret veya terör çağrışımı yapan ifadeleri kaldırın ve ürünü hukuka uygun şekilde yeniden tanımlayın."
  }
];

function productReviewFieldText(product = {}, field) {
  return String(product[field] || "").trim();
}

function addProductReviewReason(reasons, reason) {
  if (!reason?.code) return;
  const key = `${reason.code}:${reason.field || ""}`;
  if (reasons.some((item) => `${item.code}:${item.field || ""}` === key)) return;
  reasons.push(reason);
}

function productReviewRuleReasons(product = {}) {
  const reasons = [];
  for (const rule of productReviewPolicyRules) {
    for (const field of rule.fields) {
      const value = productReviewFieldText(product, field);
      if (!value || !rule.pattern.test(value)) continue;
      addProductReviewReason(reasons, {
        code: rule.code,
        severity: rule.severity,
        field,
        field_label: productReviewFieldLabels[field] || field,
        title: rule.title,
        message: `${productReviewFieldLabels[field] || field} alanında politika/hukuk riski olabilecek ifade bulundu.`,
        suggestion: rule.suggestion,
        requires_revision: Boolean(rule.requiresRevision)
      });
    }
  }
  return reasons;
}

function productOperationalReviewReasons(product = {}) {
  const reasons = [];
  const price = Number(product.price || 0);
  const stock = Number(product.stock ?? 0);
  const description = String(product.description || "").trim();
  if (!product.image_url && !product.image) {
    addProductReviewReason(reasons, {
      code: "image_missing",
      severity: "warning",
      field: "image_url",
      field_label: "Ürün görseli",
      title: "Görsel eksik",
      message: "Ürün görseli yok veya yüklenmemiş görünüyor.",
      suggestion: "Görsel kalite kontrolü yapın; bu tek başına zorunlu revizyon değildir.",
      requires_revision: false
    });
  }
  if (!description || description.length < 20) {
    addProductReviewReason(reasons, {
      code: "description_short",
      severity: "warning",
      field: "description",
      field_label: "Açıklama",
      title: "Açıklama kısa",
      message: "Açıklama müşteri için yetersiz olabilir.",
      suggestion: "Gerekirse açıklama kalitesini artırın; politika riski yoksa ürün yayına alınabilir.",
      requires_revision: false
    });
  }
  if (price <= 0) {
    addProductReviewReason(reasons, {
      code: "price_missing",
      severity: "info",
      field: "price",
      field_label: "Fiyat",
      title: "Fiyat yok",
      message: "Fiyat 0 veya boş görünüyor.",
      suggestion: "Fiyat operasyonel kontroldür; hukuki/politika revizyonu olarak işaretlenmez.",
      requires_revision: false
    });
  }
  if (stock <= 0) {
    addProductReviewReason(reasons, {
      code: "stock_missing",
      severity: "info",
      field: "stock",
      field_label: "Stok",
      title: "Stok yok",
      message: "Stok 0 veya boş görünüyor.",
      suggestion: "Stok operasyonel kontroldür; hukuki/politika revizyonu olarak işaretlenmez.",
      requires_revision: false
    });
  }
  return reasons;
}

function productReviewAutomation(product = {}) {
  const reasons = [
    ...productReviewRuleReasons(product),
    ...productOperationalReviewReasons(product)
  ];
  const revisionRequired = reasons.some((reason) => reason.requires_revision);
  const criticalCount = reasons.filter((reason) => reason.severity === "critical").length;
  const warningCount = reasons.filter((reason) => reason.severity === "warning").length;
  const infoCount = reasons.filter((reason) => reason.severity === "info").length;
  const score = Math.min(100, criticalCount * 45 + warningCount * 18 + infoCount * 6);
  const riskLevel = criticalCount ? "critical" : warningCount ? "warning" : infoCount ? "info" : "clear";
  const lane = revisionRequired ? "needs_revision" : warningCount ? "watch" : "ready";

  return {
    risk_level: riskLevel,
    lane,
    score,
    auto_approvable: !revisionRequired,
    revision_required: revisionRequired,
    reasons,
    checked_fields: ["name", "description", "meta_title", "meta_description", "category", "brand", "seller_disclosure", "image_url", "media_gallery", "video_url", "price", "stock"]
  };
}

function attachProductReviewAutomation(product = {}) {
  return {
    ...product,
    review_automation: productReviewAutomation(product)
  };
}

function productReviewMatchesAutomationStatus(product = {}, statusFilter = "") {
  const filter = normalizedReviewValue(statusFilter);
  if (!filter || filter === "all") return true;
  const automation = product.review_automation || productReviewAutomation(product);
  const status = normalizedReviewValue(product.status);
  const reviewStatus = normalizedReviewValue(product.compliance_review_status || product.review_status || product.approval_status);
  const notes = String(product.compliance_notes || "").toLocaleLowerCase("tr-TR");

  if (filter === "ready") return automation.lane === "ready" && automation.auto_approvable;
  if (filter === "watch") return automation.lane === "watch" && automation.auto_approvable;
  if (filter === "risk" || filter === "risky") return automation.revision_required || automation.risk_level === "critical" || automation.lane === "needs_revision";
  if (filter === "needs_revision") return automation.revision_required || reviewStatus === "needs_review" || status === "needs_review";
  if (filter === "revised") return reviewStatus === "pending" && /revizyon|revision|düzelt|duzelt/i.test(notes);
  return status === filter || reviewStatus === filter;
}

function productReviewAutomationSummary(products = []) {
  const summary = {
    total: products.length,
    ready: 0,
    watch: 0,
    needs_revision: 0,
    critical: 0,
    warning: 0,
    info: 0,
    auto_approvable: 0,
    revised: 0
  };
  for (const product of products) {
    const automation = product.review_automation || productReviewAutomation(product);
    if (automation.lane === "ready") summary.ready += 1;
    if (automation.lane === "watch") summary.watch += 1;
    if (automation.lane === "needs_revision") summary.needs_revision += 1;
    if (automation.risk_level === "critical") summary.critical += 1;
    if (automation.risk_level === "warning") summary.warning += 1;
    if (automation.risk_level === "info") summary.info += 1;
    if (automation.auto_approvable) summary.auto_approvable += 1;
    if (productReviewMatchesAutomationStatus(product, "revised")) summary.revised += 1;
  }
  return summary;
}

function productReviewDecisionPayload(decision, reason, nowIso = new Date().toISOString()) {
  const nextStatus = decision === "approved" ? "active" : decision === "rejected" ? "archived" : "draft";
  return {
    status: nextStatus,
    compliance_review_status: decision,
    compliance_notes: reason,
    updated_at: nowIso
  };
}

function productReviewRevisionReason(product = {}, baseReason = "") {
  const automation = product.review_automation || productReviewAutomation(product);
  const requiredReasons = automation.reasons.filter((reason) => reason.requires_revision);
  if (!requiredReasons.length) return baseReason;
  const details = requiredReasons
    .map((reason) => `- ${reason.field_label || reason.field}: ${reason.title}. ${reason.suggestion}`)
    .join("\n");
  return `${baseReason}\n\nOtomasyon tespiti:\n${details}`.trim().slice(0, 1200);
}

function productAutoPublishCandidate(product = {}) {
  const automation = product.review_automation || productReviewAutomation(product);
  const price = Number(product.price || 0);
  const stock = Number(product.stock ?? 0);
  const description = String(product.description || "").trim();
  const galleryImage = Array.isArray(product.media_gallery) ? product.media_gallery.find(Boolean) : "";
  const image = String(product.image_url || galleryImage || product.image || "").trim();
  return Boolean(
    productNeedsAdminReview(product)
      && automation.auto_approvable
      && automation.lane === "ready"
      && automation.risk_level === "clear"
      && !automation.revision_required
      && price > 0
      && stock > 0
      && description.length >= 20
      && image
  );
}

function automationRiskRank(riskLevel) {
  const rank = { critical: 5, high: 4, warning: 3, medium: 2, info: 1, low: 1, clear: 0 };
  return rank[String(riskLevel || "").toLowerCase()] ?? 2;
}

function automationItem({ lane, type, targetId, title, summary, riskLevel = "medium", action = "", createdAt = null, metadata = {} }) {
  return {
    id: `${lane}:${type}:${targetId || title || Date.now()}`,
    lane,
    type,
    target_id: targetId || "",
    title: title || "Otomasyon kaydı",
    summary: summary || "",
    risk_level: riskLevel,
    action,
    created_at: createdAt,
    metadata
  };
}

function productAutomationSummaryText(product = {}) {
  const automation = product.review_automation || productReviewAutomation(product);
  if (!automation.reasons.length) return "Politika, görsel, fiyat, stok ve açıklama kuralları geçti.";
  return automation.reasons
    .slice(0, 3)
    .map((reason) => `${reason.field_label || reason.field || "Alan"}: ${reason.title || reason.message || "Kontrol"}`)
    .join(" · ");
}

function productAutomationItem(product = {}, lane = "admin_queue") {
  const automation = product.review_automation || productReviewAutomation(product);
  const riskLevel = automation.risk_level === "critical"
    ? "critical"
    : automation.risk_level === "warning"
      ? "high"
      : automation.risk_level === "info"
        ? "medium"
        : "low";
  const action = lane === "auto_ready"
    ? "Otomatik yayına alınabilir"
    : automation.revision_required
      ? "Admin revizyon bildirimi göndermeli"
      : "Admin kontrol edebilir";
  return automationItem({
    lane,
    type: "product",
    targetId: product.id,
    title: product.name || product.product_name || product.sku || "Ürün onayı",
    summary: productAutomationSummaryText(product),
    riskLevel,
    action,
    createdAt: product.created_at || product.updated_at || null,
    metadata: {
      partner_id: product.partner_id || null,
      seller: product.seller_public_name || product.seller_legal_name || product.partner_email || "",
      status: product.status || "",
      review_status: product.compliance_review_status || product.review_status || product.approval_status || "",
      automation
    }
  });
}

function automationSupportRisk(ticket = {}) {
  const priority = String(ticket.priority || "").toLowerCase();
  const text = `${ticket.category || ""} ${ticket.title || ""} ${ticket.message || ""}`.toLocaleLowerCase("tr-TR");
  if (priority === "urgent" || /kvkk|hukuk|mahkeme|savcı|savci|güvenlik|guvenlik|dolandırıcılık|dolandiricilik|chargeback|ters ibraz/i.test(text)) return "critical";
  if (priority === "high" || /iade|iptal|refund|cancel|ödeme|odeme|hakediş|hakedis|dispute|ihtilaf/i.test(text)) return "high";
  return "medium";
}

function automationSupportItem(ticket = {}, source = "user") {
  const riskLevel = automationSupportRisk(ticket);
  return automationItem({
    lane: riskLevel === "critical" ? "super_admin_queue" : "admin_queue",
    type: source === "partner" ? "partner_support_ticket" : "support_ticket",
    targetId: ticket.id,
    title: ticket.title || (source === "partner" ? "Partner destek talebi" : "Destek talebi"),
    summary: `${ticket.category || "general"} / ${ticket.priority || "normal"} / ${ticket.status || "open"}`,
    riskLevel,
    action: riskLevel === "critical" ? "Süper admin kararı gerekir" : "Admin aksiyonu gerekir",
    createdAt: ticket.created_at || null,
    metadata: {
      source,
      requester_type: ticket.requester_type || source,
      category: ticket.category || "",
      priority: ticket.priority || "",
      status: ticket.status || ""
    }
  });
}

function automationApplicationRisk(application = {}) {
  const metadata = partnerApplicationMetadata(application);
  const risk = String(application.risk_level || metadata.risk_level || "").toLowerCase();
  const recommendation = String(application.admin_recommendation || metadata.admin_recommendation || "").toLowerCase();
  const status = String(application.status || "").toLowerCase();
  if (status === "pending_super_admin" || recommendation === "needs_super_admin" || ["critical", "high"].includes(risk)) return "high";
  return "medium";
}

function automationSortItems(items = []) {
  return [...items].sort((a, b) => {
    const riskDelta = automationRiskRank(b.risk_level) - automationRiskRank(a.risk_level);
    if (riskDelta) return riskDelta;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
}

function automationRules() {
  return [
    {
      key: "safe_product_publish",
      title: "Temiz ürünleri otomatik yayına al",
      summary: "Politika riski olmayan, fiyatı, stoğu, görseli ve açıklaması tamam ürünler manuel onaya bekletilmez.",
      auto_apply: true,
      action: "publish_safe_products"
    },
    {
      key: "product_revision_required",
      title: "Politika/hukuk riski olan ürünü admine düşür",
      summary: "Yasaklı ifade, harici iletişim, iade/değişim yasağı veya ödeme akışı dışına çıkaran metin varsa revizyon gerekçesiyle admin kuyruğuna alınır.",
      auto_apply: false,
      action: "admin_review"
    },
    {
      key: "money_and_dispute_guardrail",
      title: "İade, iptal ve ödeme kararını otomatik onaylama",
      summary: "Finansal kararlar partner/admin kararına ve ihtilaf durumunda süper admin hakemliğine bırakılır.",
      auto_apply: false,
      action: "manual_decision"
    },
    {
      key: "owner_only_escalation",
      title: "İçerik, yayın, güvenlik ve kritik yetki işlerini süper admine taşı",
      summary: "pending_super_admin içerikler, release onayları ve dış güvenlik sinyalleri owner console iş kuyruğuna düşer.",
      auto_apply: false,
      action: "super_admin_review"
    }
  ];
}

function automationSchemaWarningObjects(warnings = []) {
  return [...new Set(warnings)].map((message) => ({
    label: "automation",
    code: "AUTOMATION_SCHEMA_WARNING",
    message
  }));
}

async function buildOpsAutomationSnapshot(options = {}) {
  const limit = Math.min(Math.max(Number(options.limit || 80), 1), 120);
  const apply = options.apply === true;
  const actions = new Set(options.actions && options.actions.length ? options.actions : ["publish_safe_products"]);
  const warnings = [];
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const fetchLimit = Math.max(180, Math.min(600, limit * 5));

  const [
    productRows,
    applicationRows,
    supportTickets,
    partnerSupportTickets,
    approvalRequests,
    contentProposals,
    releaseApprovals,
    securityEvents
  ] = await Promise.all([
    optionalQuery(
      supabaseAdmin
        .from("products")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(fetchLimit),
      [],
      warnings,
      "products"
    ),
    optionalQuery(
      supabaseAdmin
        .from("partner_applications")
        .select("*")
        .in("status", ["pending", "review", "pending_super_admin"])
        .order("created_at", { ascending: false })
        .limit(80),
      [],
      warnings,
      "partner_applications"
    ),
    optionalQuery(
      supabaseAdmin
        .from("support_tickets")
        .select("*")
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(80),
      [],
      warnings,
      "support_tickets"
    ),
    optionalQuery(
      supabaseAdmin
        .from("partner_support_tickets")
        .select("*")
        .in("status", ["open", "waiting", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(80),
      [],
      warnings,
      "partner_support_tickets"
    ),
    optionalQuery(
      supabaseAdmin
        .from("admin_approval_requests")
        .select("*")
        .eq("status", "pending_super_admin")
        .order("created_at", { ascending: false })
        .limit(80),
      [],
      warnings,
      "admin_approval_requests"
    ),
    optionalQuery(
      supabaseAdmin
        .from("content_change_proposals")
        .select("*")
        .eq("status", "pending_super_admin")
        .order("created_at", { ascending: false })
        .limit(80),
      [],
      warnings,
      "content_change_proposals"
    ),
    optionalQuery(
      supabaseAdmin
        .from("super_admin_release_approvals")
        .select("*")
        .in("status", ["pending", "approved", "failed"])
        .order("created_at", { ascending: false })
        .limit(60),
      [],
      warnings,
      "super_admin_release_approvals"
    ),
    optionalQuery(
      supabaseAdmin
        .from("security_audit_events")
        .select("*")
        .in("severity", ["warning", "critical"])
        .gte("created_at", since24h)
        .order("created_at", { ascending: false })
        .limit(120),
      [],
      warnings,
      "security_audit_events"
    )
  ]);

  let products = (productRows || [])
    .filter(productNeedsAdminReview)
    .map(attachProductReviewAutomation);
  let autoReady = products
    .filter(productAutoPublishCandidate)
    .map((product) => productAutomationItem(product, "auto_ready"));
  const autoReadyProductById = new Map(products.filter(productAutoPublishCandidate).map((product) => [String(product.id), product]));
  const adminQueue = [];
  const superAdminQueue = [];
  const watchlist = [];
  const contentProposalIds = new Set((contentProposals || []).map((proposal) => String(proposal.id)));

  for (const product of products) {
    const automation = product.review_automation || productReviewAutomation(product);
    if (productAutoPublishCandidate(product)) continue;
    if (automation.revision_required || automation.risk_level === "critical") {
      adminQueue.push(productAutomationItem(product, "admin_queue"));
    } else {
      watchlist.push(productAutomationItem(product, "watchlist"));
    }
  }

  for (const application of applicationRows || []) {
    const riskLevel = automationApplicationRisk(application);
    const item = automationItem({
      lane: riskLevel === "high" ? "super_admin_queue" : "admin_queue",
      type: "partner_application",
      targetId: application.id,
      title: application.company_name || application.partner_name || application.contact_name || "Partner başvurusu",
      summary: `${application.status || "pending"} / ${application.category || application.company_type || "partner"}`,
      riskLevel,
      action: riskLevel === "high" ? "Süper admin kararı gerekir" : "Admin incelemesi gerekir",
      createdAt: application.created_at || null,
      metadata: {
        email: application.email || "",
        city: application.city || "",
        category: application.category || "",
        status: application.status || ""
      }
    });
    if (item.lane === "super_admin_queue") superAdminQueue.push(item);
    else adminQueue.push(item);
  }

  for (const ticket of supportTickets || []) {
    const item = automationSupportItem(ticket, "user");
    if (item.lane === "super_admin_queue") superAdminQueue.push(item);
    else if (automationRiskRank(item.risk_level) >= automationRiskRank("high")) adminQueue.push(item);
    else watchlist.push(item);
  }

  for (const ticket of partnerSupportTickets || []) {
    const item = automationSupportItem(ticket, "partner");
    if (item.lane === "super_admin_queue") superAdminQueue.push(item);
    else if (automationRiskRank(item.risk_level) >= automationRiskRank("high")) adminQueue.push(item);
    else watchlist.push(item);
  }

  for (const request of approvalRequests || []) {
    if (contentProposalIds.has(String(request.target_id || ""))) continue;
    superAdminQueue.push(automationItem({
      lane: "super_admin_queue",
      type: "admin_approval_request",
      targetId: request.id,
      title: request.summary || request.request_type || "Admin onayı",
      summary: `${request.request_type || "approval"} / ${request.status || "pending_super_admin"}`,
      riskLevel: "high",
      action: "Süper admin onayı gerekir",
      createdAt: request.created_at || null,
      metadata: {
        target_type: request.target_type || "",
        target_id: request.target_id || "",
        proposed_action: request.proposed_action || {}
      }
    }));
  }

  for (const proposal of contentProposals || []) {
    superAdminQueue.push(automationItem({
      lane: "super_admin_queue",
      type: "content_change_proposal",
      targetId: proposal.id,
      title: proposal.title || "İçerik önerisi",
      summary: proposal.summary || proposal.content_scope || "",
      riskLevel: proposal.content_scope === "legal" ? "critical" : "high",
      action: "Süper admin içerik onayı gerekir",
      createdAt: proposal.created_at || null,
      metadata: {
        content_scope: proposal.content_scope || "",
        status: proposal.status || "",
        payload: proposal.payload || {}
      }
    }));
  }

  for (const approval of releaseApprovals || []) {
    superAdminQueue.push(automationItem({
      lane: "super_admin_queue",
      type: "super_admin_release_approval",
      targetId: approval.id,
      title: approval.target_summary || approval.approval_type || "Yayın onayı",
      summary: `${approval.approval_type || "release"} / ${approval.status || "pending"} / ${approval.target_ref || "main"}`,
      riskLevel: approval.risk_level || "critical",
      action: "Owner onayı veya yayın takibi gerekir",
      createdAt: approval.created_at || null,
      metadata: {
        status: approval.status || "",
        target_ref: approval.target_ref || "",
        webhook_status: approval.webhook_status || null
      }
    }));
  }

  for (const event of (securityEvents || []).filter(isExternalSecurityAuditEvent)) {
    superAdminQueue.push(automationItem({
      lane: "super_admin_queue",
      type: "security_audit_event",
      targetId: event.id,
      title: event.action || "Güvenlik olayı",
      summary: `${event.severity || "warning"} / ${event.resource_type || "system"} / IP ${event.ip_address || "-"}`,
      riskLevel: workQueueRiskFromSeverity(securityRiskSeverity(event)),
      action: "Süper admin güvenlik incelemesi gerekir",
      createdAt: event.created_at || null,
      metadata: {
        actor_role: event.actor_role || "",
        source: event.source || "",
        purpose: event.purpose || ""
      }
    }));
  }

  const applied = {
    products_published: [],
    skipped: []
  };

  if (apply && actions.has("publish_safe_products")) {
    const nowIso = new Date().toISOString();
    const reason = options.reason || "Otomasyon: düşük riskli ürün kuralları geçti; ürün yayına alındı.";
    const candidates = autoReady
      .map((item) => autoReadyProductById.get(String(item.target_id)))
      .filter(Boolean)
      .slice(0, Math.min(limit, 80));

    for (const product of candidates) {
      const { product: updated, removedFields } = await updatePartnerProductRow(
        product.id,
        productReviewDecisionPayload("approved", reason, nowIso)
      );
      if (removedFields.length) {
        warnings.push(...removedFields.map((field) => `products.${field}: production şemasında yok; bu alan atlandı.`));
      }
      applied.products_published.push({
        id: updated.id,
        title: updated.name || updated.product_name || product.name || product.product_name || "Ürün",
        status: updated.status || "active",
        updated_at: updated.updated_at || nowIso
      });
    }

    const appliedIds = new Set(applied.products_published.map((item) => String(item.id)));
    autoReady = autoReady.filter((item) => !appliedIds.has(String(item.target_id)));

    if (options.ctx && options.request) {
      const auditPayload = {
        request: options.request,
        actorId: options.ctx.user.id,
        actorRole: options.ctx.profile.role,
        action: options.mode === "super_admin" ? "super_admin.automation_run" : "admin.ops.automation_run",
        source: "admin",
        resourceType: "automation",
        severity: applied.products_published.length ? "warning" : "info",
        purpose: options.mode === "super_admin" ? "super_admin_automation" : "admin_operations",
        evidenceTags: ["automation", "product_review"],
        metadata: {
          actions: [...actions],
          applied_product_count: applied.products_published.length,
          reason
        }
      };
      if (options.mode === "super_admin") {
        await auditEvent(auditPayload);
      } else {
        await auditedOpsEvent({
          request: options.request,
          ctx: options.ctx,
          action: "admin.ops.automation_run",
          resourceType: "automation",
          severity: applied.products_published.length ? "warning" : "info",
          metadata: auditPayload.metadata
        });
      }
    }
  }

  const sortedAutoReady = automationSortItems(autoReady);
  const sortedAdminQueue = automationSortItems(adminQueue);
  const sortedSuperAdminQueue = automationSortItems(superAdminQueue);
  const sortedWatchlist = automationSortItems(watchlist);
  const criticalCount = [...sortedAdminQueue, ...sortedSuperAdminQueue, ...sortedWatchlist]
    .filter((item) => item.risk_level === "critical").length;

  return {
    checked_at: new Date().toISOString(),
    mode: options.mode || "admin",
    summary: {
      auto_ready: sortedAutoReady.length,
      admin_required: sortedAdminQueue.length,
      super_admin_required: sortedSuperAdminQueue.length,
      watchlist: sortedWatchlist.length,
      critical: criticalCount,
      applied: applied.products_published.length,
      action_required: sortedAdminQueue.length + sortedSuperAdminQueue.length
    },
    queues: {
      auto_ready: sortedAutoReady.slice(0, limit),
      admin_queue: sortedAdminQueue.slice(0, limit),
      super_admin_queue: sortedSuperAdminQueue.slice(0, limit),
      watchlist: sortedWatchlist.slice(0, limit)
    },
    applied,
    rules: automationRules(),
    warnings: [...new Set(warnings)]
  };
}

function productMatchesAdminReviewSearch(product = {}, search) {
  const term = cleanSearch(search).toLocaleLowerCase("tr-TR");
  if (!term) return true;
  return [
    product.name,
    product.product_name,
    product.category,
    product.brand,
    product.seller_public_name,
    product.seller_legal_name,
    product.sku,
    product.integration_source,
    product.integration_external_id,
    product.partner_code,
    product.partner_email
  ].some((value) => String(value || "").toLocaleLowerCase("tr-TR").includes(term));
}

function partnerProductOwnerIds(business, ctx) {
  return [...new Set([
    business?.owner_id,
    ctx?.user?.id,
    business?.id
  ].filter(Boolean).map(String))];
}

function partnerProductMatchesSearch(product = {}, search) {
  const term = cleanSearch(search).toLocaleLowerCase("tr-TR");
  if (!term) return true;
  return [
    product.name,
    product.product_name,
    product.description,
    product.category,
    product.brand,
    product.sku,
    product.seller_public_name,
    product.seller_legal_name,
    product.integration_source,
    product.integration_external_id
  ].some((value) => String(value || "").toLocaleLowerCase("tr-TR").includes(term));
}

function partnerProductMatchesStatus(product = {}, statusFilter = "all") {
  const filter = normalizedReviewValue(statusFilter);
  if (!filter || filter === "all") return true;
  const status = normalizedReviewValue(product.status);
  const reviewStatus = normalizedReviewValue(product.compliance_review_status || product.review_status || product.approval_status);
  if (filter === "low_stock") return Number(product.stock || 0) > 0 && Number(product.stock || 0) <= 5;
  if (filter === "out_of_stock") return Number(product.stock || 0) <= 0;
  if (filter === "pending") return ["pending", "review", "in_review", "submitted", "awaiting_review", "waiting_review", "needs_review"].includes(reviewStatus) || ["pending", "review", "in_review", "submitted", "awaiting_review", "waiting_review", "needs_review"].includes(status);
  if (filter === "needs_review") return reviewStatus === "needs_review" || status === "needs_review";
  if (filter === "approved") return reviewStatus === "approved";
  if (filter === "rejected") return reviewStatus === "rejected" || status === "rejected" || status === "archived";
  return status === filter || reviewStatus === filter;
}

function partnerProductSummary(products = []) {
  const variantGroups = new Set(products
    .filter((product) => Number(product.variant_automation?.group_size || 0) > 1)
    .map((product) => product.variant_automation?.group_key)
    .filter(Boolean));
  return {
    total: products.length,
    active: products.filter((product) => normalizedReviewValue(product.status) === "active").length,
    pending: products.filter((product) => partnerProductMatchesStatus(product, "pending")).length,
    needs_review: products.filter((product) => productNeedsAdminReview(product)).length,
    low_stock: products.filter((product) => Number(product.stock || 0) > 0 && Number(product.stock || 0) <= 5).length,
    out_of_stock: products.filter((product) => Number(product.stock || 0) <= 0).length,
    rejected: products.filter((product) => partnerProductMatchesStatus(product, "rejected")).length,
    variant_groups: variantGroups.size,
    variant_products: products.filter((product) => Number(product.variant_automation?.group_size || 0) > 1).length
  };
}

function productVariantLinkPayload(link = {}) {
  const payload = link.last_payload && typeof link.last_payload === "object" && !Array.isArray(link.last_payload)
    ? link.last_payload
    : {};
  return payload.allonahub_variant && typeof payload.allonahub_variant === "object" ? payload.allonahub_variant : {};
}

function productVariantSignal(product = {}, link = null) {
  const variant = productVariantLinkPayload(link || {});
  const barcode = String(variant.barcode || product.barcode || "").trim();
  const productCode = String(variant.product_code || product.sku || link?.external_sku || "").trim();
  const sourceGroupKey = String(variant.group_key || "").trim();
  const sourceMatchKey = String(variant.match_key || link?.external_variant_id || link?.external_sku || product.integration_external_id || product.sku || "").trim();
  const imageUrl = String(product.image_url || "").trim();
  const imageSignature = String(variant.image_signature || variantImageSignature(imageUrl) || "").trim();
  const modelRoot = usefulModelRoot(variant.model_root || productModelRoot(product.brand, product.name, product.product_name, product.category));
  const color = String(variant.color || colorFromText(product.name, product.product_name, product.sku, imageUrl) || "").trim();
  const size = String(variant.size || "").trim();
  const groupKey = normalizedIntegrationCode(sourceGroupKey || modelRoot || product.integration_external_id || product.sku || product.id);
  const matchKey = normalizedIntegrationCode(barcode || productCode || sourceMatchKey || imageSignature || product.id);
  const source = sourceGroupKey
    ? "external_group"
    : barcode
      ? "barcode"
      : productCode
        ? "product_code"
        : modelRoot && imageSignature
          ? "model_image"
          : modelRoot
            ? "model_name"
            : "single_product";
  const confidence = source === "external_group"
    ? 0.96
    : source === "barcode"
      ? 0.92
      : source === "product_code"
        ? 0.86
        : source === "model_image"
          ? 0.74
          : source === "model_name"
            ? 0.62
            : 0.35;
  return {
    group_key: groupKey,
    match_key: matchKey,
    barcode,
    product_code: productCode,
    color,
    size,
    image_signature: imageSignature,
    model_root: modelRoot,
    source,
    confidence
  };
}

function variantLabel(signal = {}) {
  return [signal.color, signal.size].filter(Boolean).join(" / ") || "Standart";
}

function attachVariantGroups(products = [], linksByProductId = new Map()) {
  const enriched = products.map((product) => {
    const link = linksByProductId.get(String(product.id)) || null;
    const signal = productVariantSignal(product, link);
    return {
      ...product,
      variant_automation: {
        ...signal,
        label: variantLabel(signal),
        group_size: 1,
        group_stock: Number(product.stock || 0),
        price_range: {
          min: Number(product.price || 0),
          max: Number(product.price || 0)
        },
        siblings: [],
        reasons: [
          signal.source === "external_group" ? "Dış platform varyant grup kodu eşleşti." : "",
          signal.barcode ? "Barkod/GTIN varyant kimliği olarak kullanıldı." : "",
          signal.color ? "Renk adı ürün veya görsel URL bilgisinden çıkarıldı." : "",
          signal.image_signature && signal.source === "model_image" ? "Görsel dosya imzası model adıyla birlikte değerlendirildi." : ""
        ].filter(Boolean)
      }
    };
  });

  const groups = new Map();
  for (const product of enriched) {
    const key = product.variant_automation.group_key || String(product.id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(product);
  }

  return enriched.map((product) => {
    const group = groups.get(product.variant_automation.group_key) || [product];
    const prices = group.map((item) => Number(item.price || 0)).filter((value) => Number.isFinite(value));
    const siblings = group
      .filter((item) => String(item.id) !== String(product.id))
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        name: item.name || item.product_name || "",
        image_url: item.image_url || "",
        sku: item.sku || "",
        status: item.status || "",
        price: Number(item.price || 0),
        stock: Number(item.stock || 0),
        color: item.variant_automation.color || "",
        size: item.variant_automation.size || "",
        label: item.variant_automation.label || "Varyant"
      }));
    return {
      ...product,
      variant_automation: {
        ...product.variant_automation,
        group_size: group.length,
        group_stock: group.reduce((total, item) => total + Number(item.stock || 0), 0),
        price_range: {
          min: prices.length ? Math.min(...prices) : 0,
          max: prices.length ? Math.max(...prices) : 0
        },
        siblings
      }
    };
  });
}

async function loadPartnerOwnedProduct(productId, business, ctx) {
  const ownerIds = partnerProductOwnerIds(business, ctx);
  const { data: product, error } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();
  if (error && looksLikeMissingSchema(error)) {
    throw httpError("products migration production veritabaninda eksik gorunuyor.", 503);
  }
  if (error) throw error;
  if (!product) throw httpError("Ürün bulunamadı.", 404);

  const belongsToPartner = ownerIds.includes(String(product.partner_id || ""))
    || (business.partner_code && String(product.partner_code || "") === String(business.partner_code))
    || (business.email && String(product.partner_email || "").toLowerCase() === String(business.email).toLowerCase());
  if (!belongsToPartner) {
    throw httpError("Bu ürünü düzenleme yetkiniz yok.", 403);
  }
  return product;
}

function missingColumnFromError(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  const match = message.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+(?:of relation\s+"?products"?\s+)?does not exist/i)
    || message.match(/Could not find the\s+'?([a-zA-Z0-9_]+)'?\s+column/i)
    || message.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+not found/i);
  return match ? match[1] : "";
}

async function updatePartnerProductRow(productId, payload) {
  const requiredReviewColumns = new Set(["status", "compliance_review_status", "compliance_notes"]);
  const updatePayload = { ...payload };
  const removed = new Set();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from("products")
      .update(updatePayload)
      .eq("id", productId)
      .select("*")
      .single();
    if (!error) return { product: data, appliedFields: Object.keys(updatePayload), removedFields: [...removed] };

    const missingColumn = missingColumnFromError(error);
    if (missingColumn && Object.prototype.hasOwnProperty.call(updatePayload, missingColumn) && !requiredReviewColumns.has(missingColumn)) {
      delete updatePayload[missingColumn];
      removed.add(missingColumn);
      continue;
    }
    if (looksLikeMissingSchema(error) && Object.prototype.hasOwnProperty.call(updatePayload, "updated_at")) {
      delete updatePayload.updated_at;
      removed.add("updated_at");
      continue;
    }
    if (looksLikeMissingSchema(error) && requiredReviewColumns.has(missingColumn)) {
      throw httpError("products ürün onay alanları canlı veritabanında eksik. Migration uygulanmalı.", 503);
    }
    throw error;
  }

  throw httpError("Ürün revizyonu canlı veritabanı şeması nedeniyle tamamlanamadı.", 409);
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
        .select("id, actor_role, action, severity, resource_type, resource_id, ip_address, source, purpose, metadata, created_at")
        .in("severity", ["warning", "critical"])
        .order("created_at", { ascending: false })
        .limit(80),
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

  const securityThreatEvents = (securityEvents || []).filter(isExternalSecurityAuditEvent).slice(0, 8).map(securityEventPublic);
  const automation = await buildOpsAutomationSnapshot({ limit: 40, mode: "admin" });
  warnings.push(...automation.warnings);

  return {
    metrics: {
      daily_users: Number(usersToday.count || 0),
      daily_partner_applications: Number(applicationsToday.count || 0),
      pending_applications: Number(pendingApplications.count || 0),
      recent_orders: recentOrders.length,
      open_support_tickets: Number(userTickets.count || 0) + Number(partnerTickets.count || 0),
      system_alerts: notifications.length + securityThreatEvents.length + flags.length + Number(automation.summary.action_required || 0)
    },
    recentOrders,
    automation,
    alerts: [
      ...flags.map((item) => ({
        id: item.id,
        type: "flag",
        severity: item.severity,
        title: item.flag_type,
        message: item.reason,
        created_at: item.created_at
      })),
      ...securityThreatEvents.map((item) => ({
        id: item.id,
        type: "security",
        severity: item.risk_severity || item.severity,
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
    ...(securityEvents.data || []).filter(isExternalSecurityAuditEvent).map((item) => derivedWorkQueueItem({
      id: `security:${item.id}`,
      sourceModule: "security",
      targetType: item.resource_type || "security_audit_event",
      targetId: item.resource_id || item.id,
      title: item.action || "Güvenlik olayı",
      summary: `${item.severity || "warning"} / IP ${item.ip_address || "-"}`,
      riskLevel: workQueueRiskFromSeverity(securityRiskSeverity(item)),
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

function partnerApplicationMetadata(application) {
  const metadata = application?.metadata;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) return metadata;
  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch (error) {
      return {};
    }
  }
  return {};
}

function normalizePartnerApprovalType(value) {
  const raw = String(value || "").toLocaleLowerCase("tr-TR");
  if (!raw) return "";
  if (/\b(food|yemek|restoran|restaurant|lokanta|kafe|cafe|menü|menu|paket servis|fast food)\b/i.test(raw)) return "food";
  if (/\b(market|grocery|bakkal|süpermarket|supermarket|manav|şarküteri|sarkuteri)\b/i.test(raw)) return "market";
  if (/\b(service|hizmet|danışman|danisman|klinik|sağlık|saglik|güzellik|guzellik|kuaför|kuafor|nakliye|lojistik|kurye|taksi|otel|emlak|hukuk|eğitim|egitim)\b/i.test(raw)) return "service";
  if (/\b(shop|ürün|urun|mağaza|magaza|satıcı|satici|e-ticaret|eticaret|pazaryeri|perakende|ticaret)\b/i.test(raw)) return "shop";
  return PARTNER_APPROVAL_TYPES.includes(raw) ? raw : "";
}

const EU_VIES_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DE", "DK", "EE", "EL", "ES", "FI", "FR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK"
]);

const COMPANY_COUNTRY_ALIASES = new Map([
  ["TURKIYE", "TR"], ["TÜRKİYE", "TR"], ["TURKEY", "TR"], ["TR", "TR"],
  ["ALMANYA", "DE"], ["GERMANY", "DE"], ["DE", "DE"],
  ["FRANSA", "FR"], ["FRANCE", "FR"], ["FR", "FR"],
  ["ITALYA", "IT"], ["İTALYA", "IT"], ["ITALY", "IT"], ["IT", "IT"],
  ["ISPANYA", "ES"], ["İSPANYA", "ES"], ["SPAIN", "ES"], ["ES", "ES"],
  ["HOLLANDA", "NL"], ["NETHERLANDS", "NL"], ["NL", "NL"],
  ["BELCIKA", "BE"], ["BELÇİKA", "BE"], ["BELGIUM", "BE"], ["BE", "BE"],
  ["AVUSTURYA", "AT"], ["AUSTRIA", "AT"], ["AT", "AT"],
  ["IRLANDA", "IE"], ["İRLANDA", "IE"], ["IRELAND", "IE"], ["IE", "IE"],
  ["PORTEKIZ", "PT"], ["PORTEKİZ", "PT"], ["PORTUGAL", "PT"], ["PT", "PT"],
  ["POLONYA", "PL"], ["POLAND", "PL"], ["PL", "PL"],
  ["ROMANYA", "RO"], ["ROMANIA", "RO"], ["RO", "RO"],
  ["YUNANISTAN", "EL"], ["YUNANİSTAN", "EL"], ["GREECE", "EL"], ["GR", "EL"], ["EL", "EL"]
]);

function normalizeCompanyCountryCode(country, explicitCode = "") {
  const explicit = String(explicitCode || "").trim().toUpperCase();
  if (explicit) return explicit === "GR" ? "EL" : explicit;
  const raw = String(country || "").trim().toLocaleUpperCase("tr-TR");
  if (COMPANY_COUNTRY_ALIASES.has(raw)) return COMPANY_COUNTRY_ALIASES.get(raw);
  const ascii = raw
    .replace(/İ/g, "I")
    .replace(/Ş/g, "S")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C");
  return COMPANY_COUNTRY_ALIASES.get(ascii) || ascii.slice(0, 2);
}

function normalizeTaxNumberForCountry(countryCode, taxNumber) {
  let raw = String(taxNumber || "").trim().toUpperCase().replace(/\s+/g, "");
  raw = raw.replace(/[^A-Z0-9]/g, "");
  if (countryCode && raw.startsWith(countryCode)) raw = raw.slice(countryCode.length);
  if (countryCode === "EL" && raw.startsWith("GR")) raw = raw.slice(2);
  return raw;
}

function validateTurkishIdentityNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!/^[1-9]\d{10}$/.test(digits)) return false;
  const nums = digits.split("").map(Number);
  const odd = nums[0] + nums[2] + nums[4] + nums[6] + nums[8];
  const even = nums[1] + nums[3] + nums[5] + nums[7];
  return ((odd * 7 - even) % 10 + 10) % 10 === nums[9]
    && nums.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10 === nums[10];
}

function validateTurkishTaxNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!/^\d{10}$/.test(digits)) return false;
  const nums = digits.split("").map(Number);
  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    const transformed = (nums[index] + 9 - index) % 10;
    let check = transformed === 0 ? 0 : (transformed * (2 ** (9 - index))) % 9;
    if (transformed !== 0 && check === 0) check = 9;
    sum += check;
  }
  return (10 - (sum % 10)) % 10 === nums[9];
}

function companyLookupValidation(countryCode, normalizedTaxNumber) {
  if (countryCode === "TR") {
    const taxType = normalizedTaxNumber.length === 11 ? "tckn" : "vkn";
    return {
      tax_number_type: taxType,
      valid_format: taxType === "tckn"
        ? validateTurkishIdentityNumber(normalizedTaxNumber)
        : validateTurkishTaxNumber(normalizedTaxNumber)
    };
  }
  if (EU_VIES_COUNTRIES.has(countryCode)) {
    return { tax_number_type: "eu_vat", valid_format: /^[A-Z0-9]{2,14}$/.test(normalizedTaxNumber) };
  }
  return { tax_number_type: "tax_number", valid_format: normalizedTaxNumber.length >= 2 };
}

function xmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlText(xml, tag) {
  const match = String(xml || "").match(new RegExp(`<(?:\\\\w+:)?${tag}>([\\\\s\\\\S]*?)</(?:\\\\w+:)?${tag}>`, "i"));
  if (!match) return "";
  return match[1]
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .trim();
}

async function companyLookupFetchWithTimeout(url, options = {}, timeoutMs = config.companyLookup.timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function lookupEuVatCompany({ countryCode, taxNumber, request }) {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
  <soapenv:Header/>
  <soapenv:Body>
    <urn:checkVat>
      <urn:countryCode>${xmlEscape(countryCode)}</urn:countryCode>
      <urn:vatNumber>${xmlEscape(taxNumber)}</urn:vatNumber>
    </urn:checkVat>
  </soapenv:Body>
</soapenv:Envelope>`;
  const response = await companyLookupFetchWithTimeout("https://ec.europa.eu/taxation_customs/vies/services/checkVatService", {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: ""
    },
    body
  });
  const text = await response.text();
  if (!response.ok) throw httpError(`VIES servisi yanıt vermedi: HTTP ${response.status}`, 502);
  const valid = /^true$/i.test(xmlText(text, "valid"));
  const legalName = xmlText(text, "name");
  const address = xmlText(text, "address");
  await auditEvent({
    request,
    action: "partner.company_lookup_vies",
    resourceType: "company_lookup",
    resourceId: `${countryCode}${taxNumber}`,
    severity: valid ? "info" : "warning",
    source: "server",
    evidenceTags: ["partner", "company_lookup", "vies"],
    metadata: { country_code: countryCode, valid }
  });
  return {
    ok: true,
    provider: "eu_vies",
    status: valid ? "verified" : "not_found",
    verified: valid,
    company: valid ? {
      legal_name: legalName && legalName !== "---" ? legalName : "",
      display_name: legalName && legalName !== "---" ? legalName : "",
      address,
      country_code: countryCode,
      country: countryCode,
      tax_number: `${countryCode}${taxNumber}`
    } : null,
    source: "European Commission VIES",
    fetched_at: new Date().toISOString()
  };
}

function normalizeCompanyProviderPayload(payload, fallback = {}) {
  const source = payload?.company || payload?.data || payload?.result || payload || {};
  const legalName = source.legal_name || source.company_name || source.title || source.name || source.unvan || source.unvan_ad || "";
  return {
    legal_name: String(legalName || "").trim(),
    display_name: String(source.display_name || source.trade_name || source.brand || legalName || "").trim(),
    tax_office: String(source.tax_office || source.vergi_dairesi || "").trim(),
    company_type: String(source.company_type || source.type || source.sirket_turu || "").trim(),
    city: String(source.city || source.il || fallback.city || "").trim(),
    country: String(source.country || fallback.country || "").trim(),
    address: String(source.address || source.adres || "").trim(),
    website: String(source.website || source.web_site || "").trim(),
    tax_number: String(source.tax_number || source.vkn || source.tckn || fallback.tax_number || "").trim(),
    status: String(source.status || source.durum || "").trim()
  };
}

async function lookupTurkeyCompany({ taxNumber, request }) {
  const validation = companyLookupValidation("TR", taxNumber);
  if (!validation.valid_format) {
    return {
      ok: true,
      provider: "tr_tax_validation",
      status: "invalid_format",
      verified: false,
      company: null,
      source: "local_format_validation",
      fetched_at: new Date().toISOString(),
      message: validation.tax_number_type === "tckn" ? "TCKN formatı doğrulanamadı." : "VKN formatı doğrulanamadı.",
      validation
    };
  }
  if (!config.companyLookup.turkeyApiUrl) {
    return {
      ok: false,
      provider: "tr_authorized_provider",
      status: "provider_unconfigured",
      verified: false,
      company: null,
      source: "authorized_provider_required",
      fetched_at: new Date().toISOString(),
      message: "Türkiye VKN/TCKN için canlı şirket bilgisi resmi veya yetkili entegratör servisi gerektirir. COMPANY_LOOKUP_TR_API_URL bağlanınca bu buton otomatik doldurur.",
      validation
    };
  }
  const headers = { "Content-Type": "application/json" };
  if (config.companyLookup.turkeyApiToken) headers.Authorization = `Bearer ${config.companyLookup.turkeyApiToken}`;
  const response = await companyLookupFetchWithTimeout(config.companyLookup.turkeyApiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ tax_number: taxNumber, country_code: "TR" })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(payload.message || `Türkiye şirket servisi yanıt vermedi: HTTP ${response.status}`, 502);
  const company = normalizeCompanyProviderPayload(payload, { country: "Türkiye", tax_number: taxNumber });
  await auditEvent({
    request,
    action: "partner.company_lookup_tr",
    resourceType: "company_lookup",
    resourceId: taxNumber,
    severity: company.legal_name ? "info" : "warning",
    source: "server",
    evidenceTags: ["partner", "company_lookup", "turkey"],
    metadata: { provider_configured: true, found: Boolean(company.legal_name) }
  });
  return {
    ok: true,
    provider: "tr_authorized_provider",
    status: company.legal_name ? "verified" : "not_found",
    verified: Boolean(company.legal_name),
    company: company.legal_name ? company : null,
    source: config.companyLookup.turkeyApiUrl,
    fetched_at: new Date().toISOString(),
    validation
  };
}

function partnerApprovalTypeForApplication(application, requestedType) {
  const metadata = partnerApplicationMetadata(application);
  const explicit = normalizePartnerApprovalType(requestedType)
    || normalizePartnerApprovalType(metadata.partner_type)
    || normalizePartnerApprovalType(metadata.module_key)
    || normalizePartnerApprovalType(metadata.catalog_scope);
  if (explicit) return explicit;

  const haystack = [
    metadata.category,
    metadata.company_type,
    metadata.message,
    application?.company_name,
    application?.contact_name
  ].filter(Boolean).join(" ");

  return normalizePartnerApprovalType(haystack) || "shop";
}

function partnerInviteRedirectUrl() {
  const target = new URL("/pages/account/reset-password.html", `${config.siteUrl}/`);
  target.searchParams.set("returnTo", "/pages/partner/partner-panel.html");
  return target.href;
}

function temporaryPartnerPassword() {
  return `${randomBytes(30).toString("base64url")}Aa1!`;
}

function partnerAuthMetadata(application, partnerType) {
  const metadata = partnerApplicationMetadata(application);
  return compactRow({
    full_name: application.contact_name || application.company_name,
    phone: application.phone,
    company_name: application.company_name,
    partner_type: partnerType,
    module: partnerType,
    city: metadata.city,
    country: metadata.country,
    source: "partner_application_approval"
  });
}

async function findAuthUserByEmail(email, request) {
  const target = authEmail(email);
  if (!target || typeof supabaseAdmin.auth?.admin?.listUsers !== "function") return null;

  const perPage = 1000;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) {
      request?.log?.warn({ error: error.message, email_hash: authEmailHash(target) }, "Partner auth user lookup failed");
      throw httpError("Partner Auth kullanıcısı kontrol edilemedi. Supabase service-role yetkisini kontrol edin.", 503);
    }

    const users = Array.isArray(data?.users) ? data.users : [];
    const found = users.find((user) => authEmail(user.email) === target);
    if (found) return found;
    if (users.length < perPage) return null;
  }

  request?.log?.warn({ email_hash: authEmailHash(target) }, "Partner auth user lookup reached page cap");
  return null;
}

async function resolveAuthUserById(userId, fallbackEmail, request) {
  if (!userId) return null;
  if (typeof supabaseAdmin.auth?.admin?.getUserById !== "function") {
    return { id: userId, email: fallbackEmail || "" };
  }
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user) {
    request?.log?.warn({ error: error?.message, userId }, "Partner auth user id lookup failed");
    return null;
  }
  return data.user;
}

function authUserMatchesEmail(user, email) {
  const userEmail = authEmail(user?.email);
  const targetEmail = authEmail(email);
  return Boolean(user?.id && targetEmail && (!userEmail || userEmail === targetEmail));
}

async function sendPartnerAccessEmail(email, request, source) {
  const target = authEmail(email);
  const redirectTo = partnerInviteRedirectUrl();
  if (!target) return { sent: false, error: "missing_email", redirect_to: redirectTo };
  if (typeof supabasePublic.auth?.resetPasswordForEmail !== "function") {
    return { sent: false, error: "supabase_reset_password_unavailable", redirect_to: redirectTo };
  }
  try {
    const { error } = await supabasePublic.auth.resetPasswordForEmail(target, { redirectTo });
    if (error) {
      request?.log?.warn({
        error: error.message,
        email_hash: authEmailHash(target),
        source
      }, "Partner access email delivery request failed");
      return { sent: false, error: error.message || "delivery_failed", redirect_to: redirectTo };
    }
    return { sent: true, error: "", redirect_to: redirectTo };
  } catch (error) {
    request?.log?.warn({
      error: error?.message,
      email_hash: authEmailHash(target),
      source
    }, "Partner access email delivery request crashed");
    return { sent: false, error: error?.message || "delivery_failed", redirect_to: redirectTo };
  }
}

function partnerAuthResult(user, options = {}) {
  return {
    user,
    created: Boolean(options.created),
    invite_sent: Boolean(options.inviteSent),
    password_reset_sent: Boolean(options.passwordResetSent),
    access_email_sent: Boolean(options.inviteSent || options.passwordResetSent || options.accessEmailSent),
    access_email_error: options.accessEmailError || "",
    access_email_type: options.accessEmailType || (options.inviteSent ? "invite" : options.passwordResetSent ? "password_reset" : "")
  };
}

async function ensurePartnerAuthUser(application, partnerType, request) {
  const email = authEmail(application.email);
  if (!email) throw httpError("Başvuruda geçerli e-posta yok.", 400);

  const existingById = await resolveAuthUserById(application.user_id, email, request);
  if (existingById && authUserMatchesEmail(existingById, email)) {
    const accessEmail = await sendPartnerAccessEmail(email, request, "existing_by_id");
    return partnerAuthResult(existingById, {
      passwordResetSent: accessEmail.sent,
      accessEmailError: accessEmail.error,
      accessEmailType: "password_reset"
    });
  }
  if (existingById) {
    request?.log?.warn({
      userId: existingById.id,
      existing_email_hash: authEmailHash(existingById.email || ""),
      application_email_hash: authEmailHash(email)
    }, "Partner application user_id email mismatch ignored");
  }

  const existingByEmail = await findAuthUserByEmail(email, request);
  if (existingByEmail) {
    const accessEmail = await sendPartnerAccessEmail(email, request, "existing_by_email");
    return partnerAuthResult(existingByEmail, {
      passwordResetSent: accessEmail.sent,
      accessEmailError: accessEmail.error,
      accessEmailType: "password_reset"
    });
  }

  const metadata = partnerAuthMetadata(application, partnerType);
  const redirectTo = partnerInviteRedirectUrl();
  let lastError = null;

  if (typeof supabaseAdmin.auth?.admin?.inviteUserByEmail === "function") {
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: metadata,
      redirectTo
    });
    if (!error && data?.user) {
      return partnerAuthResult(data.user, {
        created: true,
        inviteSent: true,
        accessEmailType: "invite"
      });
    }
    lastError = error;
    if (/already|registered|exists/i.test(String(error?.message || ""))) {
      const user = await findAuthUserByEmail(email, request);
      if (user) {
        const accessEmail = await sendPartnerAccessEmail(email, request, "invite_existing_user");
        return partnerAuthResult(user, {
          passwordResetSent: accessEmail.sent,
          accessEmailError: accessEmail.error,
          accessEmailType: "password_reset"
        });
      }
    }
  }

  if (typeof supabaseAdmin.auth?.admin?.createUser === "function") {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPartnerPassword(),
      email_confirm: true,
      user_metadata: metadata,
      app_metadata: { role: "partner" }
    });
    if (!error && data?.user) {
      const accessEmail = await sendPartnerAccessEmail(email, request, "created_auth_user");
      return partnerAuthResult(data.user, {
        created: true,
        passwordResetSent: accessEmail.sent,
        accessEmailError: accessEmail.error,
        accessEmailType: "password_reset"
      });
    }
    lastError = error || lastError;
  }

  throw httpError(`Partner Auth kullanıcısı otomatik oluşturulamadı: ${lastError?.message || "Supabase Admin API kullanılamıyor."}`, 503);
}

async function syncPartnerAuthMetadata(user, application, partnerType, request) {
  if (!user?.id || typeof supabaseAdmin.auth?.admin?.updateUserById !== "function") return;
  const userMetadata = {
    ...(user.user_metadata || {}),
    ...partnerAuthMetadata(application, partnerType)
  };
  const currentRole = String(user.app_metadata?.role || "").toLowerCase();
  const appMetadata = ["admin", "super_admin"].includes(currentRole)
    ? user.app_metadata
    : { ...(user.app_metadata || {}), role: "partner" };

  const updatePayload = {
    user_metadata: userMetadata,
    app_metadata: appMetadata
  };
  if (!user.email_confirmed_at) {
    updatePayload.email_confirm = true;
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, updatePayload);
  if (!error) return;
  request?.log?.warn({ error: error.message, userId: user.id }, "Partner auth metadata sync failed");
}

async function ensurePartnerProfile(user, application, partnerType) {
  const metadata = partnerApplicationMetadata(application);
  const { data: current, error: currentError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, phone, country, city, role, module")
    .eq("id", user.id)
    .maybeSingle();
  if (currentError && !looksLikeMissingSchema(currentError)) throw currentError;

  const currentRole = String(current?.role || user.app_metadata?.role || "").toLowerCase();
  const nextRole = ["admin", "super_admin"].includes(currentRole) ? currentRole : "partner";
  const row = compactRow({
    id: user.id,
    email: current?.email || user.email || application.email,
    full_name: current?.full_name || application.contact_name || application.company_name,
    phone: current?.phone || application.phone,
    country: current?.country || metadata.country,
    city: current?.city || metadata.city,
    role: nextRole,
    module: current?.module || partnerType,
    updated_at: new Date().toISOString()
  });

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

function partnerBusinessMetadata(existingBusiness, application, partnerType, ctx, reason, nowIso) {
  const existing = existingBusiness?.metadata && typeof existingBusiness.metadata === "object" ? existingBusiness.metadata : {};
  const applicationMetadata = partnerApplicationMetadata(application);
  return {
    ...existing,
    enabled_modules: [partnerType],
    module_permissions: {
      ...(existing.module_permissions && typeof existing.module_permissions === "object" ? existing.module_permissions : {}),
      [partnerType]: {
        enabled: true,
        write: true,
        approved_at: nowIso,
        approved_by: ctx.user.id
      }
    },
    partner_modules: [
      { key: partnerType, enabled: true, write: true }
    ],
    approved_from_application_id: application.id,
    approved_by: ctx.user.id,
    approval_reason: reason || "",
    activated_by_super_admin: true,
    activated_at: nowIso,
    application_metadata: applicationMetadata
  };
}

async function upsertApprovedPartnerBusiness({ application, user, partnerType, body, ctx, nowIso }) {
  const { data: existingBusiness, error: existingBusinessError } = await supabaseAdmin
    .from("partner_businesses")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingBusinessError && !looksLikeMissingSchema(existingBusinessError)) throw existingBusinessError;
  if (existingBusinessError) throw httpError("partner_businesses tablosu production Supabase projesinde hazır değil.", 409);

  const metadata = partnerApplicationMetadata(application);
  const businessPayload = {
    owner_id: user.id,
    display_name: application.company_name || application.contact_name || user.email,
    legal_name: application.company_name || application.contact_name || user.email,
    partner_type: partnerType,
    email: authEmail(application.email || user.email),
    phone: application.phone || null,
    country: metadata.country || null,
    city: metadata.city || null,
    status: body.store_status || "active",
    verification_status: "verified",
    default_commission_rate: body.commission_rate ?? 0.12,
    metadata: partnerBusinessMetadata(existingBusiness, application, partnerType, ctx, body.reason, nowIso)
  };

  const query = existingBusiness
    ? supabaseAdmin.from("partner_businesses").update(businessPayload).eq("id", existingBusiness.id).select("*").single()
    : supabaseAdmin.from("partner_businesses").insert(businessPayload).select("*").single();
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function updatePartnerApplicationApproved({ application, user, partnerType, body, ctx, nowIso }) {
  const metadata = partnerApplicationMetadata(application);
  const approvalMetadata = {
    ...metadata,
    approved_by: ctx.user.id,
    approved_at: nowIso,
    partner_type: partnerType,
    activation_source: "super_admin_approval",
    approval_reason: body.reason || ""
  };
  const richPayload = {
    user_id: user.id,
    status: "approved",
    review_stage: "closed",
    admin_recommendation: "approve",
    reviewed_by: ctx.user.id,
    reviewed_at: nowIso,
    metadata: approvalMetadata,
    updated_at: nowIso
  };

  const { data, error } = await supabaseAdmin
    .from("partner_applications")
    .update(richPayload)
    .eq("id", application.id)
    .select("*")
    .single();
  if (!error) return data;
  if (!looksLikeMissingSchema(error)) throw error;

  const { data: fallbackData, error: fallbackError } = await supabaseAdmin
    .from("partner_applications")
    .update({
      user_id: user.id,
      status: "approved",
      updated_at: nowIso
    })
    .eq("id", application.id)
    .select("*")
    .single();
  if (fallbackError) throw fallbackError;
  return fallbackData;
}

async function closePartnerApprovalRequests(applicationId, decision, ctx, nowIso, request) {
  const nextStatus = decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : null;
  if (!nextStatus) return;
  const { error } = await supabaseAdmin
    .from("admin_approval_requests")
    .update({
      status: nextStatus,
      decided_by: ctx.user.id,
      decided_at: nowIso
    })
    .eq("target_type", "partner_application")
    .eq("target_id", applicationId)
    .eq("status", "pending_super_admin");
  if (error && !looksLikeMissingSchema(error)) {
    request?.log?.warn({ error: error.message, applicationId }, "Partner approval request close failed");
  }
}

async function activateApprovedPartnerApplication({ application, body, ctx, request }) {
  const nowIso = new Date().toISOString();
  const partnerType = partnerApprovalTypeForApplication(application, body.partner_type);
  const authResult = await ensurePartnerAuthUser(application, partnerType, request);
  await syncPartnerAuthMetadata(authResult.user, application, partnerType, request);
  const profile = await ensurePartnerProfile(authResult.user, application, partnerType);
  const partnerBusiness = await upsertApprovedPartnerBusiness({
    application,
    user: authResult.user,
    partnerType,
    body,
    ctx,
    nowIso
  });
  const approvedApplication = await updatePartnerApplicationApproved({
    application,
    user: authResult.user,
    partnerType,
    body,
    ctx,
    nowIso
  });
  await closePartnerApprovalRequests(application.id, "approved", ctx, nowIso, request);

  return {
    application: approvedApplication,
    partnerBusiness,
    profile,
    partnerType,
    auth: {
      user_id: authResult.user.id,
      email: authResult.user.email || application.email,
      created: authResult.created,
      invite_sent: authResult.invite_sent,
      password_reset_sent: authResult.password_reset_sent,
      access_email_sent: authResult.access_email_sent,
      access_email_error: authResult.access_email_error,
      access_email_type: authResult.access_email_type
    }
  };
}

async function createDirectPartnerApplication({ body, ctx, request, nowIso }) {
  const email = authEmail(body.email);
  const metadata = {
    source: "super_admin_direct_invite",
    tax_office: body.tax_office,
    company_type: body.company_type,
    website: body.website,
    city: body.city,
    country: body.country,
    category: body.category,
    message: body.message,
    partner_type: body.partner_type,
    created_by: ctx.user.id,
    created_at: nowIso,
    approval_reason: body.reason
  };

  const richPayload = compactRow({
    company_name: body.company_name,
    contact_name: body.contact_name,
    email,
    phone: body.phone,
    tax_number: body.tax_number || `DIRECT-${authEmailHash(email).slice(0, 10)}`,
    status: "review",
    review_stage: "sent_to_super_admin",
    admin_recommendation: "approve",
    risk_level: "info",
    reviewed_by: ctx.user.id,
    reviewed_at: nowIso,
    metadata
  });

  const { data, error } = await supabaseAdmin
    .from("partner_applications")
    .insert(richPayload)
    .select("*")
    .single();
  if (!error) return data;
  if (!looksLikeMissingSchema(error)) throw error;

  request?.log?.warn({ error: error.message }, "Direct partner invite rich application insert failed; trying legacy payload");
  const legacyPayload = compactRow({
    company_name: body.company_name,
    contact_name: body.contact_name,
    email,
    phone: body.phone,
    tax_number: body.tax_number || `DIRECT-${authEmailHash(email).slice(0, 10)}`,
    status: "pending"
  });

  const { data: legacyData, error: legacyError } = await supabaseAdmin
    .from("partner_applications")
    .insert(legacyPayload)
    .select("*")
    .single();
  if (legacyError) throw legacyError;
  return { ...legacyData, metadata };
}

async function decidePartnerApplicationRequest({ request, applicationId, body, ctx = null }) {
  const actorCtx = ctx || await requireSuperAdmin(request, "super_admin.partner_application.decide");
  const { data: before, error: beforeError } = await supabaseAdmin
    .from("partner_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();
  if (beforeError) throw beforeError;
  if (!before) throw httpError("Partner başvurusu bulunamadı.", 404);

  let application = null;
  let partnerBusiness = null;
  let activation = null;
  const nowIso = new Date().toISOString();

  if (body.decision === "approved") {
    activation = await activateApprovedPartnerApplication({ application: before, body, ctx: actorCtx, request });
    application = activation.application;
    partnerBusiness = activation.partnerBusiness;
  } else {
    const applicationPayload = {
      status: body.decision,
      updated_at: nowIso
    };

    const { data: updatedApplication, error: updateError } = await supabaseAdmin
      .from("partner_applications")
      .update(applicationPayload)
      .eq("id", applicationId)
      .select("*")
      .single();
    if (updateError) throw updateError;
    application = updatedApplication;
    await closePartnerApprovalRequests(applicationId, body.decision, actorCtx, nowIso, request);
  }

  await auditEvent({
    request,
    actorId: actorCtx.user.id,
    actorRole: actorCtx.profile.role,
    action: actorCtx.profile.role === "super_admin" ? "super_admin.partner_application_decided" : "admin.ops.partner_application_decided",
    resourceType: "partner_application",
    resourceId: applicationId,
    severity: body.decision === "approved" ? "warning" : "info",
    source: "admin",
    evidenceTags: [actorCtx.profile.role === "super_admin" ? "super_admin" : "admin_ops", "partner_application"],
    metadata: {
      old_value: { status: before.status },
      new_value: {
        status: application.status,
        commission_rate: body.commission_rate ?? null,
        store_status: body.store_status || null,
        partner_business_id: partnerBusiness?.id || null,
        partner_type: activation?.partnerType || body.partner_type || null,
        auth_user_id: activation?.auth?.user_id || application.user_id || null,
        auth_user_created: activation?.auth?.created || false,
        invite_sent: activation?.auth?.invite_sent || false,
        password_reset_sent: activation?.auth?.password_reset_sent || false,
        access_email_sent: activation?.auth?.access_email_sent || false,
        access_email_type: activation?.auth?.access_email_type || null,
        access_email_error: activation?.auth?.access_email_error || null
      },
      reason: body.reason || ""
    }
  });

  return { ok: true, application, partner_business: partnerBusiness, activation };
}

async function reviewPartnerApplicationRequest({ request, applicationId, payload }) {
  const ctx = await requireOpsAdmin(request, "admin.ops.partner_applications.review");
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
  const currentApplication = await optionalQuery(
    supabaseAdmin
      .from("partner_applications")
      .select("metadata")
      .eq("id", applicationId)
      .maybeSingle(),
    null,
    warnings,
    "partner_applications"
  );
  const existingMetadata = currentApplication?.metadata && typeof currentApplication.metadata === "object"
    ? currentApplication.metadata
    : {};

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
          ...existingMetadata,
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
      provider: "hepsiburada",
      label: "Hepsiburada",
      category: "marketplace",
      connector_mode: "native_api",
      availability: "premium",
      stage: "premium_ready",
      inbound_supported: true,
      outbound_supported: true,
      free_enabled: false,
      premium_ready: true,
      secret_schema: INTEGRATION_SECRET_DEFINITIONS.hepsiburada,
      default_settings: { default_publish_status: "draft" },
      sort_order: 50
    },
    {
      provider: "n11",
      label: "n11",
      category: "marketplace",
      connector_mode: "native_api",
      availability: "premium",
      stage: "premium_ready",
      inbound_supported: true,
      outbound_supported: true,
      free_enabled: false,
      premium_ready: true,
      secret_schema: INTEGRATION_SECRET_DEFINITIONS.n11,
      default_settings: { default_publish_status: "draft" },
      sort_order: 60
    },
    {
      provider: "ciceksepeti",
      label: "Çiçeksepeti",
      category: "marketplace",
      connector_mode: "native_api",
      availability: "premium",
      stage: "planned",
      inbound_supported: true,
      outbound_supported: false,
      free_enabled: false,
      premium_ready: false,
      secret_schema: INTEGRATION_SECRET_DEFINITIONS.ciceksepeti,
      default_settings: { default_publish_status: "draft" },
      sort_order: 70
    },
    {
      provider: "pazarama",
      label: "Pazarama",
      category: "marketplace",
      connector_mode: "native_api",
      availability: "premium",
      stage: "planned",
      inbound_supported: true,
      outbound_supported: false,
      free_enabled: false,
      premium_ready: false,
      secret_schema: INTEGRATION_SECRET_DEFINITIONS.pazarama,
      default_settings: { default_publish_status: "draft" },
      sort_order: 80
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

function connectorReady(connector) {
  if (!connector) return false;
  return connector.stage !== "planned" && connector.premium_ready !== false;
}

function connectorAllowsImport(connector) {
  return Boolean(connectorReady(connector) && connector.inbound_supported);
}

function connectorAllowsUse(connector) {
  if (!connectorReady(connector)) return false;
  if (connector.free_enabled) return true;
  if (connector.availability === "premium") return config.integrations.premiumEnabled;
  if (connector.availability === "enterprise") return config.integrations.premiumEnabled;
  return false;
}

function partnerIntegrationPlanTier(business = {}) {
  const metadata = business.metadata || {};
  const raw = String(metadata.integration_plan || metadata.plan_tier || metadata.subscription_tier || "").toLowerCase();
  if (["enterprise", "kurumsal"].includes(raw)) return "enterprise";
  if (["premium", "pro", "professional"].includes(raw)) return "premium";
  if (Number(business.level || 0) >= 20) return "enterprise";
  if (Number(business.level || 0) >= 5) return "premium";
  return "free";
}

function partnerCanUseConnector(connector, business, options = {}) {
  if (!options.fullIntegration) return connectorAllowsImport(connector);
  if (!connectorAllowsUse(connector) || !connector.outbound_supported || !config.integrations.outboundEnabled) return false;
  if (connector.availability === "free" || connector.free_enabled) return true;
  const tier = partnerIntegrationPlanTier(business);
  if (connector.availability === "enterprise") return tier === "enterprise";
  return ["premium", "enterprise"].includes(tier);
}

function connectorForProvider(connectors, provider) {
  return (connectors || []).find((item) => item.provider === provider)
    || integrationConnectorFallbackRows().find((item) => item.provider === provider)
    || null;
}

function partnerIntegrationPolicy() {
  return {
    enabled: config.integrations.enabled,
    premium_enabled: config.integrations.premiumEnabled,
    outbound_enabled: config.integrations.outboundEnabled,
    apply_enabled: config.integrations.applyEnabled,
    scheduled_apply_enabled: config.integrations.scheduledApplyEnabled,
    require_apply_confirmation: config.integrations.requireApplyConfirmation,
    apply_confirmation_text: config.integrations.applyConfirmationText,
    force_draft_on_apply: config.integrations.forceDraftOnApply,
    free_import_enabled: true,
    full_integration_requires_premium: true,
    full_integration_enabled: config.integrations.outboundEnabled,
    remote_fetch_enabled: config.integrations.remoteFetchEnabled,
    block_private_fetch_targets: config.integrations.blockPrivateFetchTargets,
    allowed_fetch_hosts: config.integrations.allowedFetchHosts,
    max_preview_rows: config.integrations.maxPreviewRows,
    max_apply_rows: config.integrations.maxApplyRows,
    max_test_rows: config.integrations.maxTestRows
  };
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
      active_now: connectorAllowsImport(connector),
      outbound_active_now: Boolean(connector.outbound_supported && config.integrations.outboundEnabled && connectorAllowsUse(connector))
    }));
  } catch (error) {
    if (!looksLikeMissingSchema(error)) throw error;
    warnings.push("partner_integration_connectors: Supabase migration production veritabaninda eksik gorunuyor.");
    return integrationConnectorFallbackRows().map((connector) => ({
      ...connector,
      active_now: connectorAllowsImport(connector),
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

function isPrivateIpAddress(address) {
  if (!address) return true;
  if (net.isIPv4(address)) {
    const parts = address.split(".").map((part) => Number(part));
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    return false;
  }
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === "::1"
      || normalized === "::"
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
      || normalized.startsWith("fe80:")
      || normalized.startsWith("::ffff:127.")
      || normalized.startsWith("::ffff:10.")
      || normalized.startsWith("::ffff:192.168.");
  }
  return true;
}

function hostnameAllowed(hostname) {
  const allowedHosts = config.integrations.allowedFetchHosts || [];
  if (!allowedHosts.length) return true;
  const normalized = String(hostname || "").toLowerCase();
  return allowedHosts.some((allowed) => {
    const rule = String(allowed || "").toLowerCase();
    if (!rule) return false;
    if (rule.startsWith("*.")) return normalized.endsWith(rule.slice(1));
    return normalized === rule || normalized.endsWith(`.${rule}`);
  });
}

async function assertSafeIntegrationUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw httpError("Entegrasyon URL adresi http veya https olmalı.", 400);
  }
  if (!hostnameAllowed(parsed.hostname)) {
    throw httpError("Bu entegrasyon hostu allowlist dışında.", 403);
  }
  if (config.integrations.blockPrivateFetchTargets) {
    const records = await dnsLookup(parsed.hostname, { all: true, verbatim: true });
    if (!records.length || records.some((record) => isPrivateIpAddress(record.address))) {
      throw httpError("Private/internal IP hedeflerine entegrasyon isteği engellendi.", 403);
    }
  }
  return parsed;
}

const INTEGRATION_BARCODE_KEYS = ["barcode", "barCode", "Barcode", "barkod", "gtin", "GTIN", "ean", "ean13", "EAN", "upc", "UPC"];
const INTEGRATION_PRODUCT_CODE_KEYS = ["sku", "stock_code", "stockCode", "stok_kodu", "urun_kodu", "ürün_kodu", "product_code", "productCode", "code", "model_code", "modelCode", "tuketim_kodu", "tüketim_kodu"];
const INTEGRATION_GROUP_CODE_KEYS = ["productMainId", "mainProductId", "item_group_id", "group_id", "groupCode", "model_code", "modelCode", "parent_id", "parentId"];
const INTEGRATION_COLOR_KEYS = ["color", "colour", "renk", "variant_color", "variantColor", "option_color", "option1", "attribute_color"];
const INTEGRATION_SIZE_KEYS = ["size", "beden", "variant_size", "variantSize", "option_size", "option2", "attribute_size"];
const PRODUCT_COLOR_TOKENS = new Map([
  ["siyah", "Siyah"],
  ["black", "Siyah"],
  ["beyaz", "Beyaz"],
  ["white", "Beyaz"],
  ["kirmizi", "Kırmızı"],
  ["kırmızı", "Kırmızı"],
  ["red", "Kırmızı"],
  ["mavi", "Mavi"],
  ["blue", "Mavi"],
  ["lacivert", "Lacivert"],
  ["navy", "Lacivert"],
  ["yesil", "Yeşil"],
  ["yeşil", "Yeşil"],
  ["green", "Yeşil"],
  ["sari", "Sarı"],
  ["sarı", "Sarı"],
  ["yellow", "Sarı"],
  ["turuncu", "Turuncu"],
  ["orange", "Turuncu"],
  ["pembe", "Pembe"],
  ["pink", "Pembe"],
  ["mor", "Mor"],
  ["purple", "Mor"],
  ["gri", "Gri"],
  ["gray", "Gri"],
  ["grey", "Gri"],
  ["bej", "Bej"],
  ["beige", "Bej"],
  ["kahverengi", "Kahverengi"],
  ["brown", "Kahverengi"],
  ["krem", "Krem"],
  ["cream", "Krem"],
  ["altin", "Altın"],
  ["altın", "Altın"],
  ["gold", "Altın"],
  ["gumus", "Gümüş"],
  ["gümüş", "Gümüş"],
  ["silver", "Gümüş"]
]);

function integrationRowValue(row, variant, keys) {
  return firstValue(row, keys) || firstValue(variant || {}, keys);
}

function normalizedIntegrationCode(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9._:-]/g, "")
    .toUpperCase()
    .slice(0, 160);
}

function normalizeVariantText(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function colorFromText(...values) {
  const normalized = normalizeVariantText(values.filter(Boolean).join(" "));
  if (!normalized) return "";
  const tokens = normalized.split(" ");
  for (const token of tokens) {
    if (PRODUCT_COLOR_TOKENS.has(token)) return PRODUCT_COLOR_TOKENS.get(token);
  }
  for (const [token, label] of PRODUCT_COLOR_TOKENS.entries()) {
    if (normalized.includes(` ${token} `) || normalized.startsWith(`${token} `) || normalized.endsWith(` ${token}`)) return label;
  }
  const hexMatch = normalized.match(/\b[0-9a-f]{6}\b/i);
  return hexMatch ? `#${hexMatch[0].toUpperCase()}` : "";
}

function variantImageSignature(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = /^https?:\/\//i.test(raw) ? new URL(raw) : null;
    const path = parsed ? parsed.pathname : raw;
    const filename = decodeURIComponent(path.split("/").filter(Boolean).pop() || path);
    return normalizeVariantText(filename).replace(/\b(jpg|jpeg|png|webp|avif|gif)\b/g, "").trim().slice(0, 120);
  } catch {
    return normalizeVariantText(raw).slice(0, 120);
  }
}

function productModelRoot(...values) {
  const normalized = normalizeVariantText(values.filter(Boolean).join(" "));
  if (!normalized) return "";
  const colorTokens = new Set([...PRODUCT_COLOR_TOKENS.keys()].map(normalizeVariantText));
  return normalized
    .split(" ")
    .filter((token) => token.length > 1)
    .filter((token) => !colorTokens.has(token))
    .filter((token) => !/^(xs|s|m|l|xl|xxl|xxxl|standart|std|renk|beden|adet|numara)$/.test(token))
    .filter((token) => !/^\d{1,2}$/.test(token))
    .slice(0, 9)
    .join("-")
    .slice(0, 120);
}

function usefulModelRoot(value) {
  const root = String(value || "").trim();
  if (!root || root.length < 6) return "";
  if (["urun", "urun-genel", "genel", "product", "product-general"].includes(root)) return "";
  return root;
}

function imageFromVariant(row, variant) {
  const raw = integrationRowValue(row, variant, ["image_url", "image", "imageUrl", "thumbnail", "photo", "foto", "gorsel"]);
  if (raw) return String(raw).trim();
  if (Array.isArray(variant?.images) && variant.images.length) {
    const first = variant.images[0];
    if (typeof first === "string") return first;
    return String(first?.src || first?.url || "").trim();
  }
  return imageFromRow(row);
}

function integrationProductRows(row, integration, index) {
  const variants = Array.isArray(row?.variants) && row.variants.length ? row.variants : [null];
  const rows = [];
  for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
    const normalized = normalizeIntegrationProduct(row, integration, index, variants[variantIndex], variantIndex, variants.length);
    if (normalized) rows.push(normalized);
  }
  return rows;
}

function normalizeIntegrationProduct(row, integration, index, variantOverride = null, variantIndex = 0, variantCount = 1) {
  const name = String(firstValue(row, ["name", "product_name", "title", "urun_adi", "ürün adı", "ad"]) || "").trim();
  if (!name) return null;
  const firstVariant = variantOverride || (Array.isArray(row?.variants) && row.variants.length ? row.variants[0] : {});
  const firstCategory = Array.isArray(row?.categories) && row.categories.length ? row.categories[0] : null;

  const barcode = String(integrationRowValue(row, firstVariant, INTEGRATION_BARCODE_KEYS) || "").trim();
  const productCode = String(integrationRowValue(row, firstVariant, INTEGRATION_PRODUCT_CODE_KEYS) || "").trim();
  const groupCode = String(integrationRowValue(row, firstVariant, INTEGRATION_GROUP_CODE_KEYS) || "").trim();
  const explicitExternalId = String(firstValue(row, ["id", "product_id", "external_id", "sku", "code", "stok_kodu"]) || firstVariant.product_id || "").trim();
  const externalId = String(groupCode || explicitExternalId || productCode || barcode || `row-${index + 1}`).trim();
  const explicitVariantId = String(firstValue(row, ["variant_id", "variation_id", "external_variant_id"]) || firstVariant.id || "").trim();
  const variantId = String(explicitVariantId || barcode || productCode || (variantCount > 1 ? `variant-${variantIndex + 1}` : "")).trim();
  const sku = String(productCode || barcode || firstVariant.sku || externalId).trim();
  const imageUrl = imageFromVariant(row, firstVariant);
  const color = String(integrationRowValue(row, firstVariant, INTEGRATION_COLOR_KEYS) || colorFromText(name, imageUrl, firstVariant.title, firstVariant.name) || "").trim();
  const size = String(integrationRowValue(row, firstVariant, INTEGRATION_SIZE_KEYS) || "").trim();
  const modelRoot = usefulModelRoot(productModelRoot(name, firstValue(row, ["model", "model_name", "modelName"]), groupCode, explicitExternalId));
  const imageSignature = variantImageSignature(imageUrl);
  const variantGroupKey = normalizedIntegrationCode(groupCode || modelRoot || explicitExternalId || externalId);
  const variantMatchKey = normalizedIntegrationCode(barcode || productCode || variantId || sku || externalId);
  const settings = integration.settings || {};
  const moduleKey = ["shop", "market", "food", "service"].includes(settings.module_key) ? settings.module_key : "shop";
  const categoryValue = firstValue(row, ["category", "categoryName", "productMainId", "categories", "kategori"])
    || (typeof firstCategory === "string" ? firstCategory : firstCategory?.name)
    || settings.default_category
    || "Genel";

  return {
    external_product_id: externalId,
    external_variant_id: variantId || null,
    external_sku: sku,
    barcode,
    product_code: productCode,
    variant_group_key: variantGroupKey,
    variant_match_key: variantMatchKey,
    variant_color: color,
    variant_size: size,
    variant_image_signature: imageSignature,
    variant_model_root: modelRoot,
    variant_source: groupCode ? "group_code" : modelRoot ? "name_model" : imageSignature ? "image_signature" : "external_id",
    name,
    description: String(firstValue(row, ["description", "body_html", "short_description", "summary", "aciklama", "açıklama"]) || "").replace(/<[^>]*>/g, " ").trim().slice(0, 1800),
    price: Math.max(0, numberFrom(firstValue(row, ["price", "regular_price", "sale_price", "listPrice", "salePrice", "fiyat", "tutar"]) || firstVariant.price)),
    stock: Math.max(0, Math.floor(numberFrom(firstValue(row, ["stock", "stock_quantity", "inventory_quantity", "quantity", "availableQuantity", "stok", "adet"]) || firstVariant.inventory_quantity))),
    image_url: imageUrl,
    category: String(categoryValue).trim().slice(0, 90),
    brand: String(firstValue(row, ["brand", "vendor", "marka"]) || settings.default_brand || "").trim().slice(0, 120),
    module_key: moduleKey,
    raw: row
  };
}

function sourceHashFor(value) {
  return createHash("sha256").update(JSON.stringify(value || {})).digest("hex");
}

const RESTRICTED_INTEGRATION_PRODUCT_PATTERNS = [
  ["Alkol ve tütün ürünü", /\b(alkol|alkollü|bira|şarap|rakı|viski|votka|tütün|sigara|puro|nargile|elektronik sigara|vape)\b/i],
  ["Silah, patlayıcı veya kesici saldırı ürünü", /\b(silah|tabanca|tüfek|mermi|fişek|patlayıcı|bomba|sustalı|elektro şok|şok cihazı)\b/i],
  ["İlaç veya reçeteli sağlık ürünü", /\b(reçeteli|ilaç|antibiyotik|hormon|steroid|anabolik|uyuşturucu|narkotik|cbd|kenevir|esrar)\b/i],
  ["Kumar, bahis veya şans oyunu", /\b(kumar|bahis|casino|poker|rulet|iddaa kuponu|şans oyunu)\b/i],
  ["Yetişkin içerik veya hizmet", /\b(yetişkin|erotik|escort|cinsel|pornografik)\b/i],
  ["Canlı hayvan veya kontrol gerektiren hayvan satışı", /\b(canlı hayvan|yavru kedi|yavru köpek|evcil hayvan satışı)\b/i]
];

function integrationProductCompliance(product) {
  const errors = [];
  const warnings = [];
  const text = [product.name, product.category, product.brand, product.description].map((value) => String(value || "")).join(" ");
  const restricted = RESTRICTED_INTEGRATION_PRODUCT_PATTERNS.find(([, pattern]) => pattern.test(text));
  if (restricted) errors.push(`${restricted[0]} otomatik import kapsamı dışında.`);
  if (!product.name || product.name.length < 2) errors.push("Ürün adı eksik.");
  if (Number(product.price || 0) < 0) errors.push("Fiyat negatif olamaz.");
  if (Number(product.price || 0) === 0) warnings.push("Fiyat 0 görünüyor; yayına almadan önce kontrol edilmeli.");
  if (Number(product.stock || 0) < 0) errors.push("Stok negatif olamaz.");
  if (!["shop", "market", "food", "service"].includes(product.module_key)) errors.push("Geçersiz kanal seçimi.");
  if (product.image_url && !/^https?:\/\//i.test(product.image_url)) warnings.push("Görsel URL http/https formatında değil.");
  if (!product.category || product.category === "Genel") warnings.push("Kategori genel görünüyor; eşleme iyileştirilebilir.");
  return {
    status: errors.length ? "rejected" : warnings.length ? "needs_review" : "pending",
    errors,
    warnings
  };
}

function integrationProductPreview(product) {
  return {
    external_product_id: product.external_product_id,
    external_variant_id: product.external_variant_id || null,
    variant_group_key: product.variant_group_key || "",
    variant_match_key: product.variant_match_key || "",
    barcode: product.barcode || "",
    product_code: product.product_code || "",
    variant_color: product.variant_color || "",
    variant_size: product.variant_size || "",
    variant_source: product.variant_source || "",
    name: product.name,
    price: product.price,
    stock: product.stock,
    category: product.category,
    module_key: product.module_key,
    auto_approved: integrationProductAutoApproved(product, product.compliance),
    compliance_status: product.compliance?.status || "pending",
    compliance_warnings: product.compliance?.warnings || [],
    compliance_errors: product.compliance?.errors || []
  };
}

async function fetchWithTimeout(url, options = {}) {
  await assertSafeIntegrationUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, config.integrations.fetchTimeoutMs));
  try {
    return await fetch(url, { ...options, redirect: "manual", signal: controller.signal });
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

function shopifyDomain(value) {
  const raw = String(value || "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  if (!raw) throw httpError("Shopify domain zorunlu.", 400);
  return raw.includes(".") ? raw : `${raw}.myshopify.com`;
}

async function fetchShopifyRows(secrets, limit) {
  const domain = shopifyDomain(secrets.SHOP_DOMAIN);
  const token = String(secrets.ACCESS_TOKEN || "").trim();
  const url = new URL(`https://${domain}/admin/api/2024-10/products.json`);
  url.searchParams.set("limit", String(Math.min(Math.max(limit || 50, 1), 250)));
  const response = await fetchWithTimeout(url.href, {
    headers: {
      Accept: "application/json",
      "X-Shopify-Access-Token": token
    }
  });
  if (!response.ok) throw httpError(`Shopify ürünleri okunamadı: HTTP ${response.status}`, 502);
  const payload = await response.json();
  return jsonProductRows(payload.products || payload);
}

async function fetchTrendyolRows(secrets, limit) {
  const supplierId = String(secrets.SUPPLIER_ID || "").trim();
  const apiKey = String(secrets.API_KEY || "").trim();
  const apiSecret = String(secrets.API_SECRET || "").trim();
  const url = new URL(`https://apigw.trendyol.com/integration/product/sellers/${encodeURIComponent(supplierId)}/products/approved`);
  url.searchParams.set("supplierId", supplierId);
  url.searchParams.set("page", "0");
  url.searchParams.set("size", String(Math.min(Math.max(limit || 50, 1), 100)));
  const response = await fetchWithTimeout(url.href, {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
      "User-Agent": `${supplierId} - AllonaHub`
    }
  });
  if (!response.ok) throw httpError(`Trendyol ürünleri okunamadı: HTTP ${response.status}`, 502);
  const payload = await response.json();
  return jsonProductRows(payload.content || payload.products || payload);
}

async function fetchHepsiburadaRows(secrets, limit) {
  const merchantId = String(secrets.MERCHANT_ID || "").trim();
  const apiKey = String(secrets.API_KEY || "").trim();
  const apiSecret = String(secrets.API_SECRET || "").trim();
  const url = new URL(`https://mpop.hepsiburada.com/product/api/products/all-products-of-merchant/${encodeURIComponent(merchantId)}`);
  url.searchParams.set("page", "0");
  url.searchParams.set("size", String(Math.min(Math.max(limit || 50, 1), 100)));
  const response = await fetchWithTimeout(url.href, {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
      "User-Agent": merchantId
    }
  });
  if (!response.ok) throw httpError(`Hepsiburada ürünleri okunamadı: HTTP ${response.status}`, 502);
  const payload = await response.json();
  return jsonProductRows(payload.data || payload.listings || payload.products || payload);
}

async function fetchN11Rows(secrets, limit) {
  const appKey = String(secrets.APP_KEY || "").trim();
  const appSecret = String(secrets.APP_SECRET || "").trim();
  const url = new URL("https://api.n11.com/rest/product/seller-products");
  url.searchParams.set("page", "0");
  url.searchParams.set("size", String(Math.min(Math.max(limit || 50, 1), 100)));
  const response = await fetchWithTimeout(url.href, {
    headers: {
      Accept: "application/json",
      appkey: appKey,
      appsecret: appSecret,
      Authorization: `Basic ${Buffer.from(`${appKey}:${appSecret}`).toString("base64")}`
    }
  });
  if (!response.ok) throw httpError(`n11 ürünleri okunamadı: HTTP ${response.status}`, 502);
  const payload = await response.json();
  return jsonProductRows(payload.content || payload.data || payload.products || payload.items || payload);
}

async function fetchCustomApiRows(secrets, limit) {
  const baseUrl = String(secrets.API_BASE_URL || "").trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(baseUrl)) throw httpError("Özel API URL http veya https olmalı.", 400);
  const url = new URL(baseUrl);
  if (!url.searchParams.has("limit")) url.searchParams.set("limit", String(Math.min(Math.max(limit || 50, 1), 500)));
  const token = String(secrets.ACCESS_TOKEN || "").trim();
  const response = await fetchWithTimeout(url.href, {
    headers: {
      Accept: "application/json,text/csv,text/plain;q=0.9,*/*;q=0.5",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  if (!response.ok) throw httpError(`Özel API ürünleri okunamadı: HTTP ${response.status}`, 502);
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const text = await response.text();
  if (contentType.includes("json") || /^[\s\r\n]*[\[{]/.test(text)) {
    return jsonProductRows(JSON.parse(text));
  }
  return parseCsvRows(text);
}

async function fetchIntegrationRows(integration, secrets, limit) {
  if (!config.integrations.remoteFetchEnabled) {
    throw httpError("Uzaktan ürün okuma şu anda kapalı.", 503);
  }
  if (integration.provider === "generic_feed") return fetchGenericFeedRows(secrets, limit);
  if (integration.provider === "woocommerce") return fetchWooCommerceRows(secrets, limit);
  if (integration.provider === "shopify") return fetchShopifyRows(secrets, limit);
  if (integration.provider === "trendyol") return fetchTrendyolRows(secrets, limit);
  if (integration.provider === "hepsiburada") return fetchHepsiburadaRows(secrets, limit);
  if (integration.provider === "n11") return fetchN11Rows(secrets, limit);
  if (integration.provider === "custom_api") return fetchCustomApiRows(secrets, limit);
  throw httpError("Bu connector için canlı ürün okuma adaptörü henüz aktif değil.", 409);
}

function productStatusForIntegrationApply(integration) {
  if (config.integrations.forceDraftOnApply) return "draft";
  return integration.default_publish_status === "active" ? "active" : "draft";
}

function integrationProductIdentity(item) {
  return normalizedIntegrationCode(item.variant_match_key || item.external_variant_id || item.external_product_id) || String(item.external_product_id || "");
}

function integrationProductAutoApproved(item, compliance) {
  const review = compliance || integrationProductCompliance(item);
  const description = String(item.description || "").trim();
  const image = String(item.image_url || "").trim();
  const category = String(item.category || "").trim();
  return Boolean(
    !review.errors.length
    && !review.warnings.length
    && Number(item.price || 0) > 0
    && Number(item.stock || 0) > 0
    && description.length >= 20
    && /^https?:\/\//i.test(image)
    && category
    && category !== "Genel"
  );
}

function integrationProductSku(integration, item) {
  const rawSku = String(item.external_sku || item.variant_match_key || item.external_product_id || "").trim();
  const prefix = integration.provider.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 12) || "INT";
  return `${prefix}-${backendSlug(rawSku || item.name).toUpperCase()}`.slice(0, 48);
}

function partnerPublicName(business) {
  return business.display_name || business.legal_name || "AllonaHub Partner";
}

function integrationProductPayload({ business, integration, item }) {
  const sellerName = partnerPublicName(business);
  const compliance = item.compliance || integrationProductCompliance(item);
  const autoApproved = integrationProductAutoApproved(item, compliance);
  const status = autoApproved ? "active" : productStatusForIntegrationApply(integration);
  const complianceStatus = autoApproved
    ? "approved"
    : compliance.status === "rejected"
      ? "rejected"
      : compliance.warnings.length
        ? "needs_review"
        : "pending";
  const identity = integrationProductIdentity(item);
  return {
    name: item.name,
    product_name: item.name,
    description: item.description,
    price: item.price,
    stock: item.stock,
    image_url: item.image_url || null,
    category: item.category || "Genel",
    module_key: item.module_key || "shop",
    catalog_scope: item.module_key || "shop",
    status,
    slug: backendSlug(`${item.name}-${integration.provider}-${item.external_product_id}-${item.external_variant_id || ""}`),
    meta_title: item.name,
    meta_description: item.description,
    brand: item.brand || sellerName,
    partner_id: business.owner_id,
    partner_code: business.partner_code || business.id,
    partner_email: business.email || null,
    seller_public_name: sellerName,
    seller_kind: "Partner satıcı",
    seller_legal_name: business.legal_name || "",
    seller_city: business.city || "",
    seller_contact: business.email || business.phone || "",
    seller_tax_number_masked: "",
    invoice_responsibility: "Fatura ve satış sonrası sorumluluk ilgili partner/satıcı kaydına göre yürütülür.",
    seller_disclosure: "Satıcı bilgileri sipariş onayı öncesinde ve faturada gösterilir; destek AllonaHub üzerinden yürütülür.",
    compliance_review_status: complianceStatus,
    compliance_notes: [
      `Entegrasyon importu: ${integration.provider}.`,
      autoApproved
        ? "Risksiz entegrasyon ürünü otomasyon tarafından onaylandı ve yayına alındı."
        : status === "draft"
          ? "Ürün taslak olarak admin/operasyon kontrolüne alındı."
          : "Ürün aktif import edildi.",
      item.barcode ? `Barkod: ${item.barcode}.` : "",
      item.product_code ? `Ürün kodu: ${item.product_code}.` : "",
      item.variant_color ? `Varyant renk: ${item.variant_color}.` : "",
      item.variant_size ? `Varyant beden/ölçü: ${item.variant_size}.` : "",
      ...compliance.errors,
      ...compliance.warnings
    ].filter(Boolean).join(" ").slice(0, 1200),
    sku: integrationProductSku(integration, item),
    integration_source: integration.provider,
    integration_external_id: identity
  };
}

async function applyIntegrationProducts({ business, integration, products }) {
  const result = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [], warnings: [] };
  const externalIds = products.map((item) => item.external_product_id).filter(Boolean);
  const identityIds = products.map(integrationProductIdentity).filter(Boolean);
  const productPartnerId = business.owner_id || business.id;
  const { data: existingLinks, error: linkError } = await supabaseAdmin
    .from("partner_integration_product_links")
    .select("*")
    .eq("integration_id", integration.id)
    .in("external_product_id", externalIds.length ? externalIds : ["__none__"]);
  if (linkError) throw linkError;

  const linkMap = new Map((existingLinks || []).map((link) => [`${link.external_product_id}:${link.external_variant_id || ""}`, link]));
  const { data: existingProducts, error: productLookupError } = await supabaseAdmin
    .from("products")
    .select("id, integration_external_id")
    .eq("partner_id", productPartnerId)
    .eq("integration_source", integration.provider)
    .in("integration_external_id", identityIds.length ? identityIds : ["__none__"]);
  if (productLookupError) throw productLookupError;

  const productMap = new Map();
  for (const product of existingProducts || []) {
    if (product.integration_external_id && !productMap.has(product.integration_external_id)) {
      productMap.set(product.integration_external_id, product);
    }
  }

  for (const item of products) {
    const identity = integrationProductIdentity(item);
    const key = `${item.external_product_id}:${item.external_variant_id || ""}`;
    const hash = sourceHashFor(item.raw);
    const existing = linkMap.get(key);
    try {
      const compliance = item.compliance || integrationProductCompliance(item);
      if (compliance.errors.length) {
        result.failed += 1;
        result.errors.push({ external_product_id: item.external_product_id, message: compliance.errors.join(" ") });
        continue;
      }
      if (compliance.warnings.length) {
        result.warnings.push({ external_product_id: item.external_product_id, warnings: compliance.warnings });
      }
      const autoApproved = integrationProductAutoApproved(item, compliance);
      if (existing?.source_hash === hash && existing.product_id && !autoApproved) {
        result.skipped += 1;
        continue;
      }

      const productPayload = integrationProductPayload({ business, integration, item: { ...item, compliance } });

      const existingProduct = existing?.product_id ? null : productMap.get(identity);
      let productId = existing?.product_id || existingProduct?.id || null;
      const productAlreadyExists = Boolean(productId);
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
        productMap.set(identity, product);
        result.created += 1;
      }
      const lastPayload = item.raw && typeof item.raw === "object" && !Array.isArray(item.raw)
        ? { ...item.raw }
        : { value: item.raw };
      lastPayload.allonahub_variant = {
        barcode: item.barcode || "",
        product_code: item.product_code || "",
        group_key: item.variant_group_key || "",
        match_key: item.variant_match_key || "",
        color: item.variant_color || "",
        size: item.variant_size || "",
        image_signature: item.variant_image_signature || "",
        model_root: item.variant_model_root || "",
        source: item.variant_source || "",
        integration_identity: identity
      };

      const linkPayload = {
        partner_id: business.id,
        integration_id: integration.id,
        product_id: productId,
        external_product_id: item.external_product_id,
        external_variant_id: item.external_variant_id,
        external_sku: item.external_sku || null,
        source_hash: hash,
        sync_status: productAlreadyExists ? "updated" : "created",
        compliance_status: productPayload.compliance_review_status,
        last_validation_warnings: compliance.warnings || [],
        last_payload: lastPayload,
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
  if (payload.direction === "inbound" && !integration.import_enabled) {
    throw httpError("Bu entegrasyonda içe aktarım kapalı.", 409);
  }
  if (payload.direction === "outbound" && !config.integrations.outboundEnabled) {
    throw httpError("Dış platformlara yayın şu anda premium açılış bayrağı bekliyor.", 409);
  }
  if (payload.mode === "apply") {
    if (!config.integrations.applyEnabled) {
      throw httpError("Kataloğa aktarım şu anda kapalı.", 409);
    }
    if (payload.trigger_source === "cron" && !config.integrations.scheduledApplyEnabled) {
      throw httpError("Zamanlı kataloğa aktarım şu anda kapalı.", 409);
    }
    if (
      payload.trigger_source !== "cron"
      && config.integrations.requireApplyConfirmation
      && payload.confirm_apply !== config.integrations.applyConfirmationText
    ) {
      throw httpError("Kataloğa aktarım onayı eşleşmedi.", 409);
    }
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
      applied_by: payload.mode === "apply" ? request?.integrationActorId || null : null,
      approval_note: payload.mode === "apply" ? payload.approval_note || "Kontrollü katalog aktarımı." : null,
      summary: { provider: integration.provider, limit, policy: partnerIntegrationPolicy() }
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
      .flatMap((row, index) => integrationProductRows(row, integration, index))
      .slice(0, limit)
      .filter(Boolean)
      .map((product) => ({ ...product, compliance: integrationProductCompliance(product) }));
    const invalidProducts = products.filter((product) => product.compliance.errors.length);
    const validProducts = products.filter((product) => !product.compliance.errors.length);

    let applyResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [], warnings: [] };
    if (payload.mode === "apply") {
      applyResult = await applyIntegrationProducts({ business, integration, products: validProducts });
    }

    const warningCount = products.reduce((total, product) => total + product.compliance.warnings.length, 0);
    const validationErrors = invalidProducts.map((product) => ({
      external_product_id: product.external_product_id,
      message: product.compliance.errors.join(" ")
    }));
    const status = applyResult.failed > 0 || invalidProducts.length > 0 ? "partial" : "success";
    const summary = {
      provider: integration.provider,
      mode: payload.mode,
      publish_status: productStatusForIntegrationApply(integration),
      force_draft_on_apply: config.integrations.forceDraftOnApply,
      checked_count: products.length,
      valid_count: validProducts.length,
      invalid_count: invalidProducts.length,
      warning_count: warningCount,
      auto_approved_count: validProducts.filter((product) => integrationProductAutoApproved(product, product.compliance)).length,
      preview: products.slice(0, 12).map(integrationProductPreview),
      errors: [...validationErrors, ...applyResult.errors].slice(0, 10),
      warnings: applyResult.warnings.slice(0, 10)
    };

    const { data: updatedRun, error: updateRunError } = await supabaseAdmin
      .from("partner_integration_runs")
      .update({
        status,
        checked_count: products.length,
        created_count: applyResult.created,
        updated_count: applyResult.updated,
        skipped_count: applyResult.skipped,
        failed_count: applyResult.failed + invalidProducts.length,
        warning_count: warningCount,
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
        last_error_message: status === "partial" ? `${applyResult.failed + invalidProducts.length} ürün işlenemedi veya kontrol bekliyor.` : null,
        next_sync_at: nextSyncAt
      })
      .eq("id", integration.id);

    await supabaseAdmin
      .from("partner_integration_secrets")
      .update({ last_used_at: new Date().toISOString() })
      .eq("integration_id", integration.id)
      .eq("status", "active");

    await auditEvent({
      request,
      actorId: request?.integrationActorId || null,
      actorRole: request?.integrationActorRole || "system",
      action: "partner.integration_sync_completed",
      resourceType: "partner_integration",
      resourceId: integration.id,
      metadata: {
        provider: integration.provider,
        mode: payload.mode,
        status,
        checked_count: products.length,
        invalid_count: invalidProducts.length,
        warning_count: warningCount
      }
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

function wooCommerceProductPayload(product, action) {
  const basePayload = {
    name: product.name,
    type: "simple",
    regular_price: String(Number(product.price || 0).toFixed(2)),
    description: product.description || "",
    short_description: product.meta_description || product.description || "",
    manage_stock: true,
    stock_quantity: Math.max(0, Math.floor(Number(product.stock || 0))),
    status: product.status === "active" ? "publish" : "draft",
    sku: product.sku || undefined
  };
  if (product.image_url && /^https?:\/\//i.test(product.image_url)) {
    basePayload.images = [{ src: product.image_url }];
  }
  if (action === "stock_price") {
    return {
      regular_price: basePayload.regular_price,
      manage_stock: true,
      stock_quantity: basePayload.stock_quantity
    };
  }
  if (action === "archive") return { status: "draft" };
  return basePayload;
}

async function dispatchWooCommercePublishJob({ job, integration, product }) {
  const secrets = await loadIntegrationSecrets(integration.id);
  requireIntegrationSecrets("woocommerce", secrets);
  const { data: existingLink, error: linkError } = await supabaseAdmin
    .from("partner_integration_product_links")
    .select("*")
    .eq("integration_id", integration.id)
    .eq("product_id", product.id)
    .maybeSingle();
  if (linkError) throw linkError;

  const baseUrl = String(secrets.API_BASE_URL || "").trim().replace(/\/$/, "");
  const consumerKey = String(secrets.CONSUMER_KEY || "").trim();
  const consumerSecret = String(secrets.CONSUMER_SECRET || "").trim();
  const externalProductId = existingLink?.external_product_id || "";
  const isUpdate = Boolean(externalProductId) && job.action !== "create";
  const isDelete = job.action === "delete" && Boolean(externalProductId);
  const url = new URL(`${baseUrl}/wp-json/wc/v3/products${isUpdate || isDelete ? `/${externalProductId}` : ""}`);
  if (isDelete) url.searchParams.set("force", "false");

  const response = await fetchWithTimeout(url.href, {
    method: isDelete ? "DELETE" : isUpdate ? "PUT" : "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64")}`
    },
    body: isDelete ? undefined : JSON.stringify(wooCommerceProductPayload(product, job.action))
  });
  const resultText = await response.text();
  let resultBody = {};
  try {
    resultBody = resultText ? JSON.parse(resultText) : {};
  } catch {
    resultBody = { raw: resultText.slice(0, 1000) };
  }
  if (!response.ok) throw httpError(`WooCommerce yayın gönderimi başarısız: HTTP ${response.status}`, 502);
  const resolvedExternalId = String(resultBody.id || externalProductId || "");
  if (!resolvedExternalId) throw httpError("WooCommerce yanıtında ürün ID dönmedi.", 502);

  const linkPayload = {
    partner_id: integration.partner_id,
    integration_id: integration.id,
    product_id: product.id,
    external_product_id: resolvedExternalId,
    external_sku: product.sku || null,
    source_hash: sourceHashFor(product),
    sync_status: isDelete ? "archived" : isUpdate ? "updated" : "created",
    compliance_status: product.compliance_review_status || "pending",
    last_payload: resultBody || {},
    last_synced_at: new Date().toISOString()
  };
  if (existingLink) {
    const { error } = await supabaseAdmin.from("partner_integration_product_links").update(linkPayload).eq("id", existingLink.id);
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin.from("partner_integration_product_links").insert(linkPayload);
    if (error) throw error;
  }

  return {
    provider: "woocommerce",
    external_product_id: resolvedExternalId,
    status: resultBody.status || "ok"
  };
}

async function dispatchIntegrationPublishJob(job) {
  const integration = job.integration;
  const product = job.product;
  if (!integration) throw httpError("Yayın işi entegrasyon kaydı olmadan çalışamaz.", 409);
  if (!product) throw httpError("Yayın işi ürün kaydı olmadan çalışamaz.", 409);
  if (!integration.export_enabled) throw httpError("Bu entegrasyonda dışarı yayın kapalı.", 409);
  if (integration.provider === "woocommerce") {
    return dispatchWooCommercePublishJob({ job, integration, product });
  }
  throw httpError("Bu connector için canlı outbound gönderici premium connector fazında açılacak.", 409);
}

async function processIntegrationPublishJobs({ request, limit = 20 }) {
  if (!config.integrations.outboundEnabled) {
    return { ok: true, skipped: true, reason: "PARTNER_INTEGRATIONS_OUTBOUND_ENABLED=false", processed: 0, results: [] };
  }
  const { data: jobs, error } = await supabaseAdmin
    .from("partner_integration_publish_jobs")
    .select("*, integration:partner_integrations(*), product:products(*)")
    .in("status", ["queued", "failed"])
    .lte("scheduled_at", new Date().toISOString())
    .order("priority", { ascending: true })
    .order("scheduled_at", { ascending: true })
    .limit(Math.max(1, Math.min(Number(limit || 20), 100)));
  if (error) {
    if (looksLikeMissingSchema(error)) {
      return { ok: true, skipped: true, reason: "partner_integration_publish_jobs_migration_missing", processed: 0, results: [] };
    }
    throw error;
  }

  const results = [];
  for (const job of jobs || []) {
    await supabaseAdmin
      .from("partner_integration_publish_jobs")
      .update({ status: "processing", processed_at: null, error_message: null })
      .eq("id", job.id);
    try {
      const result = await dispatchIntegrationPublishJob(job);
      await supabaseAdmin
        .from("partner_integration_publish_jobs")
        .update({ status: "success", result, processed_at: new Date().toISOString(), error_message: null })
        .eq("id", job.id);
      results.push({ job_id: job.id, status: "success", result });
    } catch (error) {
      const status = error.statusCode === 409 ? "skipped" : "failed";
      await supabaseAdmin
        .from("partner_integration_publish_jobs")
        .update({
          status,
          result: { message: error.message },
          error_message: error.message,
          processed_at: new Date().toISOString()
        })
        .eq("id", job.id);
      results.push({ job_id: job.id, status, message: error.message });
    }
  }

  await auditEvent({
    request,
    action: "cron.integrations_publish_completed",
    resourceType: "partner_integration_publish_job",
    metadata: {
      processed: results.length,
      failed: results.filter((item) => item.status === "failed").length,
      skipped: results.filter((item) => item.status === "skipped").length
    }
  });

  return { ok: true, processed: results.length, results };
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

  app.get("/v1/currency/rates", async (request, reply) => {
    const query = currencyRatesQuerySchema.parse(request.query || {});
    const base = normalizeCurrencyCode(query.base) || normalizeCurrencyCode(config.currency.baseCurrency) || "TRY";
    const payload = await fetchCurrencyRates(base, request);
    reply.header("Cache-Control", "public, max-age=900, stale-while-revalidate=43200");
    return payload;
  });

  app.get("/v1/media/product-images/*", async (request, reply) => {
    const path = normalizeProductImagePath(request.params["*"]);
    const etag = mediaCacheHeaders(reply, path);
    if (request.headers["if-none-match"] === etag) {
      return reply.code(304).send();
    }

    const bucket = config.productMedia.storageBucket || "product-images";
    const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
    if (error || !data) {
      throw httpError("Urun gorseli bulunamadi.", 404);
    }

    const bytes = Buffer.from(await data.arrayBuffer());
    reply.type(data.type || productImageContentType(path));
    reply.header("Content-Length", String(bytes.byteLength));
    return reply.send(bytes);
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

  app.post("/v1/partner-company-lookup", async (request) => {
    const payload = parseAuthPayload(partnerCompanyLookupSchema, request.body);
    await verifyTurnstile(request, "partner_company_lookup", payload.turnstileToken);
    const countryCode = normalizeCompanyCountryCode(payload.country, payload.country_code);
    const normalizedTaxNumber = normalizeTaxNumberForCountry(countryCode, payload.tax_number);
    const validation = companyLookupValidation(countryCode, normalizedTaxNumber);

    if (!validation.valid_format) {
      return {
        ok: true,
        provider: countryCode === "TR" ? "tr_tax_validation" : EU_VIES_COUNTRIES.has(countryCode) ? "eu_vies" : "local_format_validation",
        status: "invalid_format",
        verified: false,
        company: null,
        country_code: countryCode,
        normalized_tax_number: normalizedTaxNumber,
        validation,
        message: "Vergi numarası formatı doğrulanamadı."
      };
    }

    if (countryCode === "TR") {
      const result = await lookupTurkeyCompany({ taxNumber: normalizedTaxNumber, request });
      return { ...result, country_code: countryCode, normalized_tax_number: normalizedTaxNumber };
    }
    if (EU_VIES_COUNTRIES.has(countryCode)) {
      const result = await lookupEuVatCompany({ countryCode, taxNumber: normalizedTaxNumber, request });
      return { ...result, country_code: countryCode, normalized_tax_number: normalizedTaxNumber, validation };
    }

    return {
      ok: false,
      provider: "unsupported_country",
      status: "provider_unavailable",
      verified: false,
      company: null,
      country_code: countryCode,
      normalized_tax_number: normalizedTaxNumber,
      validation,
      message: "Bu ülke için şirket bilgisi otomatik çekme sağlayıcısı henüz bağlı değil."
    };
  });

  app.post("/v1/partner-applications", async (request, reply) => {
    const payload = parseAuthPayload(publicPartnerApplicationSchema, request.body);
    const companyName = (payload.company_name || payload.partner_name).trim();
    await verifyTurnstile(request, "partner_application", payload.turnstileToken);

    if (payload.website) {
      try {
        const parsedWebsite = new URL(payload.website);
        if (!["http:", "https:"].includes(parsedWebsite.protocol)) {
          throw httpError("Web sitesi adresi geçerli değil.", 400);
        }
      } catch (error) {
        if (error.statusCode) throw error;
        throw httpError("Web sitesi adresi geçerli değil.", 400);
      }
    }

    const settings = await supabaseAdmin
      .from("super_admin_settings")
      .select("setting_value")
      .eq("setting_key", "partner_applications_paused")
      .maybeSingle();
    const pausedSetting = settings.data?.setting_value;
    if (!settings.error && (pausedSetting === true || pausedSetting === "true" || pausedSetting?.value === true)) {
      throw httpError("Yeni partner başvuruları geçici olarak durduruldu.", 423);
    }

    const email = authEmail(payload.email);
    const recent = await supabaseAdmin
      .from("partner_applications")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    if (!recent.error && Number(recent.count || 0) >= 2) {
      throw httpError("Bu e-posta için bugün çok fazla başvuru alındı.", 429);
    }

    const warnings = [];
    const application = await optionalMutation(
      supabaseAdmin
        .from("partner_applications")
        .insert({
          company_name: companyName,
          contact_name: payload.contact_name,
          email,
          phone: payload.phone,
          tax_number: payload.tax_number,
          status: "pending",
          review_stage: "new",
          risk_level: "info",
          metadata: {
            source: "partner_public_form",
            tax_office: payload.tax_office,
            company_type: payload.company_type,
            website: payload.website,
            city: payload.city,
            country: payload.country,
            category: payload.category,
            message: payload.message,
            company_lookup: payload.company_lookup || {},
            submitted_at: new Date().toISOString()
          }
        })
        .select("id, company_name, contact_name, email, status, review_stage, created_at")
        .single(),
      warnings,
      "partner_applications"
    );

    await auditEvent({
      request,
      action: "partner_application.submitted",
      resourceType: "partner_application",
      resourceId: application.id,
      severity: "info",
      source: "client",
      evidenceTags: ["partner", "application", "public_form"],
      metadata: {
        company_name: companyName,
        email_hash: authEmailHash(email),
        city: payload.city,
        country: payload.country,
        category: payload.category,
        company_lookup_status: payload.company_lookup?.status || null,
        company_lookup_provider: payload.company_lookup?.provider || null
      }
    });

    return reply.code(201).send({ ok: true, application, warnings });
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

  app.get("/v1/partner/products", async (request) => {
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      action: "partner.products.list"
    });
    const query = partnerProductListQuerySchema.parse(request.query || {});
    const business = await ensurePartnerBusiness(ctx, request);
    const ownerIds = partnerProductOwnerIds(business, ctx);
    const warnings = [];

    const productQueries = [
      optionalQuery(
        supabaseAdmin
          .from("products")
          .select("*")
          .in("partner_id", ownerIds)
          .order("created_at", { ascending: false })
          .limit(query.limit),
        [],
        warnings,
        "products"
      )
    ];
    if (business.partner_code) {
      productQueries.push(optionalQuery(
        supabaseAdmin
          .from("products")
          .select("*")
          .eq("partner_code", business.partner_code)
          .order("created_at", { ascending: false })
          .limit(query.limit),
        [],
        warnings,
        "products.partner_code"
      ));
    }
    if (business.email) {
      productQueries.push(optionalQuery(
        supabaseAdmin
          .from("products")
          .select("*")
          .eq("partner_email", business.email)
          .order("created_at", { ascending: false })
          .limit(query.limit),
        [],
        warnings,
        "products.partner_email"
      ));
    }

    const productGroups = await Promise.all(productQueries);
    const productsById = new Map();
    for (const row of productGroups.flat()) {
      if (row?.id && !productsById.has(row.id)) productsById.set(row.id, row);
    }

    const reviewProducts = [...productsById.values()]
      .filter((product) => partnerProductMatchesSearch(product, query.search))
      .filter((product) => partnerProductMatchesStatus(product, query.status))
      .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")))
      .slice(0, query.limit)
      .map(attachProductReviewAutomation);
    const productIds = reviewProducts.map((product) => product.id).filter(Boolean);
    const linkRows = await optionalQuery(
      supabaseAdmin
        .from("partner_integration_product_links")
        .select("product_id, external_product_id, external_variant_id, external_sku, last_payload, updated_at, last_synced_at")
        .in("product_id", productIds.length ? productIds : ["00000000-0000-0000-0000-000000000000"]),
      [],
      warnings,
      "partner_integration_product_links"
    );
    const linksByProductId = new Map();
    for (const link of linkRows || []) {
      if (link?.product_id && !linksByProductId.has(String(link.product_id))) linksByProductId.set(String(link.product_id), link);
    }
    const products = attachVariantGroups(reviewProducts, linksByProductId);

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "partner.products_viewed",
      resourceType: "partner_business",
      resourceId: business.id,
      metadata: {
        search: query.search || null,
        status: query.status || "all",
        count: products.length,
        warning_count: warnings.length
      }
    });

    return {
      ok: true,
      business,
      products,
      summary: partnerProductSummary(products),
      warnings
    };
  });

  app.patch("/v1/partner/products/:productId", async (request) => {
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      action: "partner.products.update"
    });
    const productId = uuidSchema.parse(request.params.productId);
    const body = partnerProductUpdateSchema.parse(request.body || {});
    const business = await ensurePartnerBusiness(ctx, request);
    const before = await loadPartnerOwnedProduct(productId, business, ctx);

    const has = (field) => Object.prototype.hasOwnProperty.call(body, field);
    const cleanNullable = (value) => value === null ? null : String(value ?? "").trim();
    const updatePayload = {};
    const nextName = has("name") ? body.name : has("product_name") ? body.product_name : "";

    if (nextName) {
      updatePayload.name = nextName;
      updatePayload.product_name = nextName;
      updatePayload.slug = backendSlug(`${nextName}-${productId}`);
      if (!has("meta_title")) updatePayload.meta_title = nextName;
    }
    [
      "description",
      "image_url",
      "video_url",
      "category",
      "brand",
      "sku",
      "seller_public_name",
      "seller_legal_name",
      "seller_city",
      "seller_contact",
      "seller_tax_number_masked",
      "invoice_responsibility",
      "seller_disclosure",
      "meta_title",
      "meta_description"
    ].forEach((field) => {
      if (has(field)) updatePayload[field] = cleanNullable(body[field]);
    });
    if (has("media_gallery")) updatePayload.media_gallery = (body.media_gallery || []).slice(0, 8);
    if (has("price")) updatePayload.price = Number(body.price || 0);
    if (has("stock")) updatePayload.stock = Number(body.stock || 0);
    if (has("module_key")) updatePayload.module_key = body.module_key;
    if (has("catalog_scope")) updatePayload.catalog_scope = body.catalog_scope;

    const nowIso = new Date().toISOString();
    const changedFields = Object.keys(body);
    const instantFields = new Set(["price", "stock"]);
    const onlyInstantUpdate = changedFields.length > 0 && changedFields.every((field) => instantFields.has(field));
    const previousReviewStatus = normalizedReviewValue(before.compliance_review_status || before.review_status || before.approval_status);
    const previousStatus = normalizedReviewValue(before.status);

    if (onlyInstantUpdate) {
      if (previousStatus === "active" || previousReviewStatus === "approved") {
        updatePayload.status = previousStatus === "archived" ? "archived" : "active";
      }
      updatePayload.compliance_notes = "Partner fiyat/stok güncellemesi uygulandı.";
    } else {
      updatePayload.status = "draft";
      updatePayload.compliance_review_status = "pending";
      updatePayload.compliance_notes = "Partner ürün revizyonu admin onayına gönderildi.";
    }
    updatePayload.updated_at = nowIso;

    const { product, appliedFields, removedFields } = await updatePartnerProductRow(productId, updatePayload);

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: onlyInstantUpdate ? "partner.product_stock_price_updated" : "partner.product_revision_submitted",
      resourceType: "product",
      resourceId: productId,
      metadata: {
        changed_fields: Object.keys(body),
        applied_fields: appliedFields,
        ignored_missing_fields: removedFields,
        previous_status: before.status || null,
        previous_compliance_review_status: before.compliance_review_status || null,
        next_status: product.status || "draft",
        next_compliance_review_status: product.compliance_review_status || "pending"
      }
    });

    return {
      ok: true,
      product,
      message: onlyInstantUpdate
        ? "Fiyat/stok güncellendi."
        : "Ürün revizyonu admin onayına gönderildi.",
      warnings: removedFields.map((field) => `products.${field}: üretim şemasında yok; bu alan atlandı.`)
    };
  });

  app.post("/v1/partner/products/:productId/publish", async (request) => {
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      action: "partner.products.publish"
    });
    const productId = uuidSchema.parse(request.params.productId);
    const business = await ensurePartnerBusiness(ctx, request);
    const before = await loadPartnerOwnedProduct(productId, business, ctx);
    const reviewStatus = normalizedReviewValue(before.compliance_review_status || before.review_status || before.approval_status);
    if (reviewStatus !== "approved") {
      throw httpError("Bu ürün yayına alınmadan önce admin onayı bekliyor.", 409);
    }

    const { product, removedFields } = await updatePartnerProductRow(productId, {
      status: "active",
      compliance_notes: "Partner onaylı ürünü yayına aldı.",
      updated_at: new Date().toISOString()
    });

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "partner.product_published",
      resourceType: "product",
      resourceId: productId,
      metadata: {
        previous_status: before.status || null,
        compliance_review_status: before.compliance_review_status || null
      }
    });

    return {
      ok: true,
      product,
      message: "Ürün yayına alındı.",
      warnings: removedFields.map((field) => `products.${field}: üretim şemasında yok; bu alan atlandı.`)
    };
  });

  app.delete("/v1/partner/products/:productId", async (request) => {
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      action: "partner.products.archive"
    });
    const productId = uuidSchema.parse(request.params.productId);
    const business = await ensurePartnerBusiness(ctx, request);
    const before = await loadPartnerOwnedProduct(productId, business, ctx);
    const { product, removedFields } = await updatePartnerProductRow(productId, {
      status: "archived",
      compliance_review_status: "rejected",
      compliance_notes: "Partner ürünü panelden arşivledi.",
      updated_at: new Date().toISOString()
    });

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "partner.product_archived",
      resourceType: "product",
      resourceId: productId,
      metadata: {
        previous_status: before.status || null,
        previous_compliance_review_status: before.compliance_review_status || null
      }
    });

    return {
      ok: true,
      product,
      message: "Ürün arşivlendi ve yayından kaldırıldı.",
      warnings: removedFields.map((field) => `products.${field}: üretim şemasında yok; bu alan atlandı.`)
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
    const partnerWarnings = [];

    const [
      products,
      orderRows,
      locations,
      devices,
      qrCodes,
      paymentIntents,
      transactions,
      payouts,
      tickets
    ] = await Promise.all([
      optionalQuery(
        supabaseAdmin
          .from("products")
          .select("*")
          .eq("partner_id", ownerId)
          .order("created_at", { ascending: false })
          .limit(200),
        [],
        partnerWarnings,
        "products"
      ),
      optionalQuery(
        supabaseAdmin
          .from("orders")
          .select("*, order_items(*, product:products(id, name, category, partner_id))")
          .order("created_at", { ascending: false })
          .limit(120),
        [],
        partnerWarnings,
        "orders"
      ),
      optionalQuery(
        supabaseAdmin
          .from("partner_locations")
          .select("*")
          .eq("partner_id", business.id)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false }),
        [],
        partnerWarnings,
        "partner_locations"
      ),
      optionalQuery(
        supabaseAdmin
          .from("partner_devices")
          .select("*")
          .eq("partner_id", business.id)
          .order("created_at", { ascending: false }),
        [],
        partnerWarnings,
        "partner_devices"
      ),
      optionalQuery(
        supabaseAdmin
          .from("partner_qr_codes")
          .select("*")
          .eq("partner_id", business.id)
          .order("created_at", { ascending: false }),
        [],
        partnerWarnings,
        "partner_qr_codes"
      ),
      optionalQuery(
        supabaseAdmin
          .from("partner_payment_intents")
          .select("*")
          .eq("partner_id", business.id)
          .order("created_at", { ascending: false })
          .limit(120),
        [],
        partnerWarnings,
        "partner_payment_intents"
      ),
      optionalQuery(
        supabaseAdmin
          .from("partner_transactions")
          .select("*")
          .eq("partner_id", business.id)
          .order("occurred_at", { ascending: false })
          .limit(120),
        [],
        partnerWarnings,
        "partner_transactions"
      ),
      optionalQuery(
        supabaseAdmin
          .from("partner_payouts")
          .select("*")
          .eq("partner_id", business.id)
          .order("period_end", { ascending: false })
          .limit(24),
        [],
        partnerWarnings,
        "partner_payouts"
      ),
      optionalQuery(
        supabaseAdmin
          .from("partner_support_tickets")
          .select("*")
          .eq("partner_id", business.id)
          .order("created_at", { ascending: false })
          .limit(80),
        [],
        partnerWarnings,
        "partner_support_tickets"
      )
    ]);

    const orders = summarizePartnerOrders(orderRows || [], ownerId, isAdminUser, ctx.user.id);
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
      products: products || [],
      orders,
      paymentIntents: paymentIntents || [],
      transactions: transactions || [],
      payouts: payouts || [],
      tickets: tickets || [],
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
        integration_count: integrationRows.length,
        warning_count: partnerWarnings.length + refundWarnings.length + integrationWarnings.length
      }
    });

    return {
      ok: true,
      business,
      products: products || [],
      orders,
      locations: locations || [],
      devices: devices || [],
      qrCodes: qrCodes || [],
      paymentIntents: paymentIntents || [],
      transactions: transactions || [],
      payouts: payouts || [],
      tickets: tickets || [],
      partnerWarnings,
      refundCancellations: refundCancellations.items,
      refundCancellationSummary: refundCancellations.summary,
      refundWarnings,
      integrations: integrationRows,
      integrationConnectors,
      integrationRuns: integrationRuns || [],
      integrationWarnings,
      integrationPolicy: { ...partnerIntegrationPolicy(), partner_plan_tier: partnerIntegrationPlanTier(business) },
      metrics,
      recommendations: partnerRecommendations(metrics, devices || [])
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
      policy: { ...partnerIntegrationPolicy(), partner_plan_tier: partnerIntegrationPlanTier(business) }
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
    const wantsFullIntegration = Boolean(payload.export_enabled || payload.direction === "outbound" || payload.direction === "bidirectional");
    if (!partnerCanUseConnector(connector, business, { fullIntegration: wantsFullIntegration })) {
      throw httpError(wantsFullIntegration
        ? "Tam entegrasyon premium üyelik ve dış platform yayın izni gerektirir."
        : "Bu connector ile ücretsiz ürün çekme şu anda aktif değil.", 409);
    }
    if (wantsFullIntegration && !config.integrations.outboundEnabled) {
      throw httpError("Dış platformlara yayın şu anda premium açılış bayrağı bekliyor.", 409);
    }

    const nextSyncAt = payload.sync_mode === "scheduled"
      ? new Date(Date.now() + Number(payload.sync_interval_minutes || 1440) * 60 * 1000).toISOString()
      : null;
    const planTier = !wantsFullIntegration ? "free" : connector.availability === "enterprise" ? "enterprise" : "premium";
    const partnerTier = partnerIntegrationPlanTier(business);
    const row = {
      partner_id: business.id,
      provider: payload.provider,
      display_name: payload.display_name,
      connection_mode: payload.connection_mode || connector.connector_mode || "generic_feed",
      direction: wantsFullIntegration ? "bidirectional" : "inbound",
      status: payload.status,
      plan_tier: planTier,
      sync_mode: payload.sync_mode,
      sync_interval_minutes: payload.sync_interval_minutes,
      next_sync_at: nextSyncAt,
      import_enabled: payload.import_enabled,
      export_enabled: wantsFullIntegration,
      default_publish_status: payload.default_publish_status,
      settings: {
        ...(connector.default_settings || {}),
        ...(payload.settings || {}),
        onboarding_offer: "free_partner_acquisition",
        upgrade_path: connector.premium_ready ? "premium_connector_pack" : "starter",
        partner_plan_tier: partnerTier
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
    const probeRemote = z.object({ probe_remote: z.coerce.boolean().optional().default(false) }).parse(request.body || {}).probe_remote;
    const integration = await loadPartnerIntegration(business, integrationId);
    const secrets = await loadIntegrationSecrets(integration.id);
    requireIntegrationSecrets(integration.provider, secrets);
    let remoteProbe = config.integrations.remoteFetchEnabled ? "available_during_sync" : "disabled";
    const now = new Date().toISOString();
    const keys = Object.keys(secrets);

    try {
      if (probeRemote && config.integrations.remoteFetchEnabled) {
        const rows = await fetchIntegrationRows(integration, secrets, config.integrations.maxTestRows);
        const products = rows.slice(0, config.integrations.maxTestRows)
          .flatMap((row, index) => integrationProductRows(row, integration, index))
          .slice(0, config.integrations.maxTestRows)
          .filter(Boolean)
          .map((product) => ({ ...product, compliance: integrationProductCompliance(product) }));
        const invalidCount = products.filter((product) => product.compliance.errors.length).length;
        const warningCount = products.reduce((total, product) => total + product.compliance.warnings.length, 0);
        remoteProbe = {
          status: invalidCount ? "warning" : "success",
          rows_read: rows.length,
          valid_count: products.length - invalidCount,
          invalid_count: invalidCount,
          warning_count: warningCount,
          sample: products.map(integrationProductPreview)
        };
      }
    } catch (error) {
      await supabaseAdmin
        .from("partner_integrations")
        .update({
          status: "needs_attention",
          last_test_at: now,
          last_test_status: "failed",
          last_test_message: error.message || "Remote test başarısız.",
          last_error_at: now,
          last_error_message: error.message || "Remote test başarısız.",
          updated_by: ctx.user.id
        })
        .eq("id", integration.id);
      throw error;
    }

    const secretUpdate = { last_verified_at: now, updated_by: ctx.user.id };
    if (probeRemote) secretUpdate.last_used_at = now;
    await supabaseAdmin
      .from("partner_integration_secrets")
      .update(secretUpdate)
      .eq("integration_id", integration.id)
      .in("secret_key", keys.length ? keys : ["__none__"]);
    const testStatus = remoteProbe?.status === "warning" ? "warning" : "success";
    const { data: updated, error } = await supabaseAdmin
      .from("partner_integrations")
      .update({
        status: integration.status === "draft" || integration.status === "needs_attention" ? "active" : integration.status,
        last_test_at: now,
        last_test_status: testStatus,
        last_test_message: probeRemote && remoteProbe?.rows_read !== undefined ? `${remoteProbe.rows_read} kayıt okunabildi.` : "Secret konfigürasyonu doğrulandı.",
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
      metadata: {
        provider: integration.provider,
        secret_count: keys.length,
        probe_status: remoteProbe?.status || "skipped",
        rows_read: remoteProbe?.rows_read || 0
      }
    });

    return {
      ok: true,
      integration: updated,
      result: {
        status: testStatus,
        provider: integration.provider,
        checked_secret_keys: keys,
        remote_probe: remoteProbe
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

  app.post("/v1/partner/integrations/:integrationId/publish-jobs", async (request, reply) => {
    if (!config.integrations.enabled) throw httpError("Partner entegrasyonları şu anda kapalı.", 503);
    if (!config.integrations.outboundEnabled) throw httpError("Dış platformlara yayın şu anda premium açılış bayrağı bekliyor.", 409);
    const ctx = await requireAuth(request, {
      roles: ["partner", "admin", "super_admin"],
      action: "partner.integration.publish"
    });
    const business = await ensurePartnerBusiness(ctx, request);
    const ownerId = business.owner_id || ctx.user.id;
    const integrationId = uuidSchema.parse(request.params.integrationId);
    const integration = await loadPartnerIntegration(business, integrationId);
    if (!integration.export_enabled) throw httpError("Bu entegrasyonda dış platformlara yayın kapalı.", 409);
    const payload = partnerIntegrationPublishJobSchema.parse(request.body || {});
    const { data: products, error: productError } = await supabaseAdmin
      .from("products")
      .select("id, name, status, partner_id")
      .in("id", payload.product_ids)
      .eq("partner_id", ownerId);
    if (productError) throw productError;
    if ((products || []).length !== payload.product_ids.length) {
      throw httpError("Bazı ürünler bulunamadı veya bu partner hesabına ait değil.", 404);
    }

    const rows = payload.product_ids.map((productId) => ({
      partner_id: business.id,
      integration_id: integration.id,
      product_id: productId,
      action: payload.action,
      priority: payload.priority,
      payload: { source: "partner_panel", requested_by: ctx.user.id },
      scheduled_at: payload.scheduled_at || new Date().toISOString(),
      created_by: ctx.user.id
    }));
    const { data: jobs, error: jobError } = await supabaseAdmin
      .from("partner_integration_publish_jobs")
      .insert(rows)
      .select("*");
    if (jobError) throw jobError;

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "partner.integration_publish_jobs_created",
      resourceType: "partner_integration",
      resourceId: integration.id,
      metadata: { provider: integration.provider, action: payload.action, product_count: rows.length }
    });

    return reply.code(201).send({ ok: true, jobs });
  });

  opsGet("/integrations", async (request) => {
    await requireAuth(request, {
      roles: ["admin", "super_admin"],
      action: "ops.integrations.list",
      mfa: true
    });
    const query = z.object({
      provider: z.string().trim().max(40).optional().default(""),
      status: z.string().trim().max(40).optional().default(""),
      limit: z.coerce.number().int().min(1).max(200).optional().default(80)
    }).parse(request.query || {});
    const warnings = [];
    let integrationQuery = supabaseAdmin
      .from("partner_integrations")
      .select("*, partner:partner_businesses(id, owner_id, partner_code, display_name, legal_name, status, verification_status, level, metadata)")
      .order("updated_at", { ascending: false })
      .limit(query.limit);
    if (query.provider) integrationQuery = integrationQuery.eq("provider", query.provider);
    if (query.status) integrationQuery = integrationQuery.eq("status", query.status);

    const [integrations, runs, publishJobs] = await Promise.all([
      optionalQuery(integrationQuery, [], warnings, "partner_integrations"),
      optionalQuery(
        supabaseAdmin
          .from("partner_integration_runs")
          .select("*, integration:partner_integrations(provider, display_name)")
          .order("started_at", { ascending: false })
          .limit(80),
        [],
        warnings,
        "partner_integration_runs"
      ),
      optionalQuery(
        supabaseAdmin
          .from("partner_integration_publish_jobs")
          .select("*, integration:partner_integrations(provider, display_name), product:products(id, name, status)")
          .order("created_at", { ascending: false })
          .limit(80),
        [],
        warnings,
        "partner_integration_publish_jobs"
      )
    ]);

    return {
      ok: true,
      policy: partnerIntegrationPolicy(),
      integrations,
      runs,
      publishJobs,
      warnings
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
      runAdminQuery(
        "security_alerts_24h",
        supabaseAdmin
          .from("security_audit_events")
          .select("id, actor_role, action, resource_type, resource_id, severity, ip_address, source, purpose, metadata, created_at")
          .in("severity", ["warning", "critical"])
          .gte("created_at", since24h)
          .order("created_at", { ascending: false })
          .limit(500),
        []
      ),
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
    const recentEvents = (recentSecurity.data || []).map(securityEventPublic);
    const threatEvents24h = (securityAlerts.data || []).filter(isExternalSecurityAuditEvent);
    const moduleMap = moduleOperationMapPublic(moduleRows.data || []);
    const criticalEvents = recentEvents.filter((event) => event.external_threat && event.severity === "critical");
    const unresolvedApprovals = releaseApprovals.filter((item) => ["approved", "failed", "pending"].includes(item.status));
    const inactiveModules = moduleMap.filter((item) => item.is_active !== true || item.is_visible !== true);
    const automation = await buildOpsAutomationSnapshot({ limit: 60, mode: "super_admin" });
    warnings.push(...automationSchemaWarningObjects(automation.warnings));

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
      threatEvents24h.length > 0 ? {
        severity: "high",
        title: "Güvenlik uyarısı",
        message: `${threatEvents24h.length} dış güvenlik uyarısı son 24 saatte audit akışına düştü.`
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
      automation.summary.critical > 0 ? {
        severity: "critical",
        title: "Otomasyon kritik kuyruğu",
        message: `${automation.summary.critical} kritik kayıt süper admin veya admin kararı bekliyor.`
      } : null,
      automation.summary.super_admin_required > 0 ? {
        severity: "high",
        title: "Otomasyon owner kuyruğu",
        message: `${automation.summary.super_admin_required} kayıt süper admin onayı veya incelemesi istiyor.`
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
        security_alerts_24h: threatEvents24h.length,
        critical_events_sample: criticalEvents.length,
        release_approvals: releaseApprovals.length,
        homepage_modules: moduleMap.length,
        automation_action_required: automation.summary.action_required,
        automation_auto_ready: automation.summary.auto_ready,
        automation_super_admin_required: automation.summary.super_admin_required,
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
      automation,
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

  superGet("/automation", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.automation.view");
    const query = automationQuerySchema.parse(request.query || {});
    const automation = await buildOpsAutomationSnapshot({ limit: query.limit, mode: "super_admin" });

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.automation_viewed",
      source: "admin",
      resourceType: "automation",
      severity: automation.summary.critical ? "warning" : "info",
      purpose: "super_admin_automation",
      evidenceTags: ["super_admin", "automation"],
      metadata: {
        auto_ready: automation.summary.auto_ready,
        action_required: automation.summary.action_required,
        super_admin_required: automation.summary.super_admin_required,
        warning_count: automation.warnings.length
      }
    });

    return {
      ok: true,
      automation,
      schema_warnings: automationSchemaWarningObjects(automation.warnings)
    };
  });

  superPost("/automation/run", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.automation.run");
    const body = automationRunSchema.parse(request.body || {});
    const automation = await buildOpsAutomationSnapshot({
      limit: body.limit,
      apply: body.apply,
      actions: body.actions,
      reason: body.reason,
      ctx,
      request,
      mode: "super_admin"
    });

    return {
      ok: true,
      automation,
      schema_warnings: automationSchemaWarningObjects(automation.warnings)
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
      runAdminQuery(
        "security_alerts_24h",
        supabaseAdmin
          .from("security_audit_events")
          .select("id, actor_role, action, resource_type, resource_id, severity, ip_address, source, purpose, metadata, created_at")
          .in("severity", ["warning", "critical"])
          .gte("created_at", since24h)
          .order("created_at", { ascending: false })
          .limit(500),
        []
      ),
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

    const automation = await buildOpsAutomationSnapshot({ limit: 50, mode: "super_admin" });
    warnings.push(...automationSchemaWarningObjects(automation.warnings));

    const dailyRevenue = (revenueRows.data || [])
      .reduce((sum, order) => sum + Number(order.total || 0), 0);
    const threatEvents24h = (securityAlerts.data || []).filter(isExternalSecurityAuditEvent);
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
        security_alerts_24h: threatEvents24h.length
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
          security_alerts: threatEvents24h.length,
          automation_action_required: automation.summary.action_required,
          automation_auto_ready: automation.summary.auto_ready,
          automation_super_admin_required: automation.summary.super_admin_required
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
        automation,
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
        .select("*", { count: "exact" })
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

  superPost("/partners", async (request) => {
    const ctx = await requireSuperAdmin(request, "super_admin.partner.direct_invite");
    const body = superAdminPartnerInviteSchema.parse(request.body || {});
    const nowIso = new Date().toISOString();
    const application = await createDirectPartnerApplication({ body, ctx, request, nowIso });
    const activation = await activateApprovedPartnerApplication({
      application,
      body: {
        decision: "approved",
        reason: body.reason,
        commission_rate: body.commission_rate,
        store_status: body.store_status,
        partner_type: body.partner_type
      },
      ctx,
      request
    });

    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "super_admin.partner_direct_invite_created",
      resourceType: "partner_business",
      resourceId: activation.partnerBusiness?.id || null,
      severity: "warning",
      source: "admin",
      evidenceTags: ["super_admin", "partner", "direct_invite"],
      metadata: {
        application_id: activation.application?.id || application.id,
        partner_type: activation.partnerType,
        auth_user_id: activation.auth?.user_id,
        auth_user_created: activation.auth?.created || false,
        invite_sent: activation.auth?.invite_sent || false,
        password_reset_sent: activation.auth?.password_reset_sent || false,
        access_email_sent: activation.auth?.access_email_sent || false,
        access_email_type: activation.auth?.access_email_type || null,
        access_email_error: activation.auth?.access_email_error || null,
        email_hash: authEmailHash(body.email),
        reason: body.reason
      }
    });

    return {
      ok: true,
      application: activation.application,
      partner_business: activation.partnerBusiness,
      activation
    };
  });

  superPatch("/partner-applications/:applicationId", async (request) => {
    const { applicationId } = z.object({ applicationId: uuidSchema }).parse(request.params || {});
    const body = partnerApplicationDecisionSchema.parse(request.body || {});
    return decidePartnerApplicationRequest({ request, applicationId, body });
  });

  superPost("/partner-application-decisions", async (request) => {
    const payload = partnerApplicationDecisionRequestSchema.parse(request.body || {});
    const { application_id: applicationId, ...body } = payload;
    return decidePartnerApplicationRequest({ request, applicationId, body });
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

    const failedAuth = await runAdminQuery(
      "super_admin_failed_auth_24h",
      supabaseAdmin
        .from("security_audit_events")
        .select("id, actor_role, action, resource_type, resource_id, severity, ip_address, source, purpose, metadata, created_at")
        .in("action", ["auth.denied", "authz.denied", "mfa.required", "admin.boundary_denied"])
        .gte("created_at", since24h)
        .order("created_at", { ascending: false })
        .limit(500),
      []
    );
    if (failedAuth.warning) warnings.push(failedAuth.warning);

    const publicEvents = (events.data || []).map(securityEventPublic);
    const threatEvents = publicEvents.filter((event) => event.external_threat);
    const failedAuthThreats = (failedAuth.data || []).filter(isExternalSecurityAuditEvent);
    const criticalEvents = threatEvents.filter((event) => event.severity === "critical").length;
    const suspiciousIps = Object.entries(threatEvents
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
        failed_auth_24h: failedAuthThreats.length,
        critical_event_sample_count: criticalEvents
      }
    });

    return {
      ok: true,
      security: {
        metrics: {
          failed_auth_24h: failedAuthThreats.length,
          critical_events_sample: criticalEvents,
          suspicious_ip_count: suspiciousIps.length,
          blocked_ip_count: autoDefense.blockedIpCount
        },
        suspicious_ips: suspiciousIps,
        recent_events: publicEvents,
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

    const modulesWithSubdomains = modules.map((item) => ({
      ...item,
      ...moduleSubdomainPublic(item.module_key)
    }));

    return {
      ok: true,
      modules: modulesWithSubdomains,
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

  opsGet("/automation", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.automation.view");
    const query = automationQuerySchema.parse(request.query || {});
    const automation = await buildOpsAutomationSnapshot({ limit: query.limit, mode: "admin" });

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.automation_viewed",
      resourceType: "automation",
      severity: automation.summary.critical ? "warning" : "info",
      metadata: {
        auto_ready: automation.summary.auto_ready,
        action_required: automation.summary.action_required,
        super_admin_required: automation.summary.super_admin_required,
        warning_count: automation.warnings.length
      }
    });

    return {
      ok: true,
      automation,
      warnings: automation.warnings
    };
  });

  opsPost("/automation/run", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.automation.run");
    const body = automationRunSchema.parse(request.body || {});
    const automation = await buildOpsAutomationSnapshot({
      limit: body.limit,
      apply: body.apply,
      actions: body.actions,
      reason: body.reason,
      ctx,
      request,
      mode: "admin"
    });

    return {
      ok: true,
      automation,
      warnings: automation.warnings
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
    const applicationId = uuidSchema.parse(request.params.applicationId);
    const payload = partnerApplicationActionSchema.parse(request.body || {});
    return reviewPartnerApplicationRequest({ request, applicationId, payload });
  });

  opsPost("/partner-application-reviews", async (request) => {
    const payload = partnerApplicationActionRequestSchema.parse(request.body || {});
    const { application_id: applicationId, ...body } = payload;
    return reviewPartnerApplicationRequest({ request, applicationId, payload: body });
  });

  opsPost("/partner-application-decisions", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.partner_applications.decide");
    const payload = partnerApplicationDecisionRequestSchema.parse(request.body || {});
    const { application_id: applicationId, ...body } = payload;
    return decidePartnerApplicationRequest({ request, applicationId, body, ctx });
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

  opsGet("/product-reviews", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.product_reviews.list");
    const query = adminListQuerySchema.parse(request.query || {});
    const warnings = [];
    const fetchLimit = Math.min(Math.max(query.limit * 3, 200), 600);
    const dbQuery = supabaseAdmin
      .from("products")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(fetchLimit);

    const rows = await optionalQuery(dbQuery, [], warnings, "products");
    let products = (rows || [])
      .filter(productNeedsAdminReview)
      .filter((product) => productMatchesAdminReviewSearch(product, query.search))
      .map(attachProductReviewAutomation);
    if (query.status) {
      products = products.filter((product) => productReviewMatchesAutomationStatus(product, query.status));
    }
    const summary = productReviewAutomationSummary(products);
    products = products.slice(0, query.limit);

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.product_reviews_viewed",
      resourceType: "product",
      metadata: {
        search: query.search || null,
        status: query.status || null,
        fetched_count: rows.length,
        count: products.length,
        warning_count: warnings.length
      }
    });

    return { ok: true, products, summary, warnings };
  });

  opsPost("/product-reviews/bulk-decision", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.product_reviews.decide");
    const body = adminProductReviewBulkDecisionSchema.parse(request.body || {});
    const warnings = [];
    const nowIso = new Date().toISOString();
    const { data: rows, error: rowsError } = await supabaseAdmin
      .from("products")
      .select("*")
      .in("id", body.product_ids);
    if (rowsError && looksLikeMissingSchema(rowsError)) {
      throw httpError("products ürün onay alanları canlı veritabanında eksik. Migration uygulanmalı.", 503);
    }
    if (rowsError) throw rowsError;

    const productById = new Map((rows || []).map((product) => [String(product.id), product]));
    const missingIds = body.product_ids.filter((productId) => !productById.has(String(productId)));
    const products = body.product_ids
      .map((productId) => productById.get(String(productId)))
      .filter(Boolean)
      .map(attachProductReviewAutomation);
    const updatedProducts = [];
    const skipped = missingIds.map((productId) => ({
      product_id: productId,
      reason: "Ürün bulunamadı."
    }));

    for (const product of products) {
      const automation = product.review_automation || productReviewAutomation(product);
      if (body.decision === "approved" && body.only_auto_approvable && !automation.auto_approvable) {
        skipped.push({
          product_id: product.id,
          name: product.name || product.product_name || "",
          reason: "Otomasyon bu üründe revizyon riski gördüğü için toplu güvenli onaydan çıkarıldı.",
          review_automation: automation
        });
        continue;
      }

      const reason = body.decision === "needs_review"
        ? productReviewRevisionReason(product, body.reason)
        : body.reason;
      const { product: updated, removedFields } = await updatePartnerProductRow(
        product.id,
        productReviewDecisionPayload(body.decision, reason, nowIso)
      );
      if (removedFields.length) {
        warnings.push(...removedFields.map((field) => `products.${field}: üretim şemasında yok; bu alan atlandı.`));
      }
      updatedProducts.push(attachProductReviewAutomation(updated));
    }

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.product_reviews_bulk_decided",
      resourceType: "product",
      severity: body.decision === "approved" ? "info" : "warning",
      metadata: {
        decision: body.decision,
        requested_count: body.product_ids.length,
        updated_count: updatedProducts.length,
        skipped_count: skipped.length,
        only_auto_approvable: Boolean(body.only_auto_approvable),
        reason: body.reason
      }
    });

    return {
      ok: true,
      products: updatedProducts,
      skipped,
      summary: productReviewAutomationSummary(updatedProducts),
      warnings: [...new Set(warnings)]
    };
  });

  opsPost("/product-reviews/:productId/decision", async (request) => {
    const ctx = await requireOpsAdmin(request, "admin.ops.product_reviews.decide");
    const productId = uuidSchema.parse(request.params.productId);
    const body = adminProductReviewDecisionSchema.parse(request.body || {});
    const nowIso = new Date().toISOString();

    const { data: before, error: beforeError } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("id", productId)
      .maybeSingle();
    if (beforeError && looksLikeMissingSchema(beforeError)) {
      throw httpError("products ürün onay alanları canlı veritabanında eksik. Migration uygulanmalı.", 503);
    }
    if (beforeError) throw beforeError;
    if (!before) throw httpError("Ürün bulunamadı.", 404);

    const reason = body.decision === "needs_review"
      ? productReviewRevisionReason(before, body.reason)
      : body.reason;
    const updatePayload = productReviewDecisionPayload(body.decision, reason, nowIso);
    const nextStatus = updatePayload.status;
    const { product, removedFields } = await updatePartnerProductRow(productId, updatePayload);
    const warnings = removedFields.map((field) => `products.${field}: üretim şemasında yok; bu alan atlandı.`);

    await auditedOpsEvent({
      request,
      ctx,
      action: "admin.ops.product_review_decided",
      resourceType: "product",
      resourceId: productId,
      severity: body.decision === "approved" ? "info" : "warning",
      metadata: {
        decision: body.decision,
        status: nextStatus,
        previous_status: before.status || null,
        previous_compliance_review_status: before.compliance_review_status || null,
        integration_source: before.integration_source || null,
        reason
      }
    });

    return { ok: true, product: attachProductReviewAutomation(product), warnings };
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
          .eq("severity", "critical")
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
        const scheduledMode = integration.settings?.scheduled_run_mode === "apply" && config.integrations.scheduledApplyEnabled
          ? "apply"
          : "preview";
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

  app.post("/v1/cron/integrations/publish", async (request) => {
    if (!config.cronSecret || request.headers["x-cron-secret"] !== config.cronSecret) {
      await auditEvent({
        request,
        action: "cron.integrations_publish_denied",
        severity: "critical",
        metadata: { path: request.url.split("?")[0] }
      });
      throw httpError("Cron yetkisi doğrulanamadı.", 401);
    }
    return processIntegrationPublishJobs({ request, limit: 20 });
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
