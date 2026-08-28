import { z } from "zod";
import { config } from "../config.js";
import {
  auditEvent,
  authContext,
  hasMfa,
  isAdmin,
  isSuperAdmin
} from "../lib/supabase.js";
import { CountryEngine, normalizeCountryCode, normalizeModuleKey } from "../modules/platform/country-engine.js";
import { platformError } from "../modules/platform/errors.js";
import { CountryRepository } from "../modules/platform/repository.js";

const countryParamsSchema = z.object({
  countryCode: z.string().trim().min(2).max(2)
});

const moduleParamsSchema = countryParamsSchema.extend({
  moduleKey: z.string().trim().min(2).max(64)
});

const countryPatchSchema = z.object({
  status: z.enum(["active", "coming_soon", "disabled"]).optional(),
  launch_stage: z.enum(["DISABLED", "PLANNING", "INTEGRATION", "INTERNAL_TEST", "BETA", "PUBLIC"]).optional(),
  reason: z.string().trim().min(10).max(900),
  approval_reference: z.string().trim().max(180).optional().default(""),
  expected_updated_at: z.string().datetime({ offset: true })
}).strict().refine((payload) => payload.status !== undefined || payload.launch_stage !== undefined, {
  message: "En az bir ülke durumu alanı değişmelidir."
});

const modulePatchSchema = z.object({
  enabled: z.boolean().optional(),
  beta: z.boolean().optional(),
  public_visible: z.boolean().optional(),
  partner_registration_enabled: z.boolean().optional(),
  transaction_enabled: z.boolean().optional(),
  reason: z.string().trim().min(10).max(900),
  approval_reference: z.string().trim().max(180).optional().default(""),
  expected_updated_at: z.string().datetime({ offset: true })
}).strict().refine((payload) => [
  "enabled", "beta", "public_visible", "partner_registration_enabled", "transaction_enabled"
].some((field) => payload[field] !== undefined), {
  message: "En az bir modül alanı değişmelidir."
});

function assertEngineEnabled() {
  if (!config.countryEngine.enabled) {
    throw platformError(
      "COUNTRY_ENGINE_DISABLED",
      "Country Engine production aktivasyonu henüz yapılmadı.",
      404
    );
  }
}

async function requireCountryAdmin(request, { write = false } = {}) {
  const ctx = await authContext(request);
  if (!ctx) throw platformError("AUTH_REQUIRED", "Oturum gerekli.", 401);
  if (!isAdmin(ctx.profile)) throw platformError("ADMIN_REQUIRED", "Admin yetkisi gerekli.", 403);
  if (!hasMfa(ctx)) throw platformError("MFA_REQUIRED", "Bu işlem için iki aşamalı doğrulama gerekli.", 403);
  if (write && !isSuperAdmin(ctx.profile)) {
    throw platformError("SUPER_ADMIN_REQUIRED", "Ülke aktivasyonu yalnız super-admin tarafından değiştirilebilir.", 403);
  }
  if (write && !config.countryEngine.adminWritesEnabled) {
    throw platformError(
      "COUNTRY_ENGINE_WRITES_DISABLED",
      "Country Engine yazma kilidi production ortamında kapalı.",
      423
    );
  }
  return ctx;
}

function countryMap(snapshot) {
  return Object.fromEntries(snapshot.countries.map((country) => [country.id, country.country_code]));
}

function publicImpactPayload(items) {
  return items.map((item) => ({
    metricKey: item.metric_key,
    countryId: item.country_id,
    corridorId: item.corridor_id,
    periodStart: item.period_start,
    periodEnd: item.period_end,
    value: Number(item.numeric_value),
    currency: item.currency,
    unit: item.unit,
    dataSource: item.data_source,
    aggregationMethod: item.aggregation_method,
    verifiedAt: item.verified_at,
    publishedAt: item.published_at,
    sourceStatus: item.source_status || "published_snapshot"
  }));
}

export function registerPlatformRoutes(app) {
  const repository = new CountryRepository();
  const engine = new CountryEngine(repository);

  app.get("/v1/platform/countries", async () => {
    assertEngineEnabled();
    return { ok: true, countries: await engine.listPublicCountries() };
  });

  app.get("/v1/platform/countries/:countryCode", async (request) => {
    assertEngineEnabled();
    const params = countryParamsSchema.parse(request.params || {});
    return { ok: true, context: await engine.getPublicContext(params.countryCode) };
  });

  app.get("/v1/platform/countries/:countryCode/modules/:moduleKey", async (request) => {
    assertEngineEnabled();
    const params = moduleParamsSchema.parse(request.params || {});
    return {
      ok: true,
      capability: await engine.moduleCapability(params.countryCode, params.moduleKey)
    };
  });

  app.get("/v1/platform/impact", async () => {
    if (!config.countryEngine.enabled || !config.countryEngine.publicImpactEnabled) {
      return {
        ok: true,
        published: false,
        metrics: [],
        sourceStatus: "disabled",
        sourceNotes: ["Public impact aggregates are disabled in this environment."]
      };
    }
    const liveImpact = await repository.listLivePublicImpact();
    const metrics = publicImpactPayload(liveImpact.metrics);
    const required = new Set(["active_user_count", "active_partner_count", "new_user_count"]);
    const published = [...required].every((key) => metrics.some((metric) => (
      metric.metricKey === key && Number.isFinite(Number(metric.value))
    )));
    return {
      ok: true,
      published,
      sourceStatus: published ? "live_aggregate" : "incomplete",
      sourceNotes: liveImpact.sourceNotes,
      metrics
    };
  });

  app.get("/v1/admin/country-control", async (request) => {
    assertEngineEnabled();
    await requireCountryAdmin(request);
    const snapshot = await repository.adminSnapshot();
    return {
      ok: true,
      writeEnabled: Boolean(config.countryEngine.adminWritesEnabled),
      countryCodes: countryMap(snapshot),
      ...snapshot
    };
  });

  app.patch("/v1/admin/country-control/countries/:countryCode", async (request) => {
    assertEngineEnabled();
    const ctx = await requireCountryAdmin(request, { write: true });
    const params = countryParamsSchema.parse(request.params || {});
    const payload = countryPatchSchema.parse(request.body || {});
    const code = normalizeCountryCode(params.countryCode);
    const current = await repository.getCountryByCode(code);
    const validated = engine.validateCountryPatch(current, payload, payload.approval_reference);
    const updated = await repository.applyCountryStateChange({
      country: current,
      patch: validated,
      expectedUpdatedAt: payload.expected_updated_at,
      actorId: ctx.user.id,
      reason: payload.reason,
      approvalReference: payload.approval_reference,
      requestId: request.id
    });
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "country_engine.country_state_changed",
      resourceType: "country",
      resourceId: current.id,
      severity: "high",
      metadata: {
        country_code: code,
        before: { status: current.status, launch_stage: current.launch_stage },
        after: { status: updated.status, launch_stage: updated.launch_stage },
        approval_reference: payload.approval_reference || null,
        reason: payload.reason
      }
    });
    return { ok: true, country: updated };
  });

  app.patch("/v1/admin/country-control/countries/:countryCode/modules/:moduleKey", async (request) => {
    assertEngineEnabled();
    const ctx = await requireCountryAdmin(request, { write: true });
    const params = moduleParamsSchema.parse(request.params || {});
    const payload = modulePatchSchema.parse(request.body || {});
    const code = normalizeCountryCode(params.countryCode);
    const moduleKey = normalizeModuleKey(params.moduleKey);
    const context = await repository.getCountryContext(code);
    if (!context) throw platformError("COUNTRY_NOT_FOUND", "Ülke kaydı bulunamadı.", 404);
    const current = context.modules.find((module) => module.module_key === moduleKey);
    const validated = engine.validateModulePatch(context, current, payload, payload.approval_reference);
    const activationRaised = Object.keys(validated).some((field) => validated[field] && !current[field]);
    const updated = await repository.applyModuleChange({
      module: current,
      patch: validated,
      expectedUpdatedAt: payload.expected_updated_at,
      actorId: ctx.user.id,
      reason: payload.reason,
      approvalReference: payload.approval_reference,
      requestId: request.id,
      activationRaised
    });
    const beforeState = Object.fromEntries(Object.keys(validated).map((key) => [key, current[key]]));
    const afterState = Object.fromEntries(Object.keys(validated).map((key) => [key, updated[key]]));
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "country_engine.module_changed",
      resourceType: "country_module",
      resourceId: current.id,
      severity: updated.transaction_enabled ? "critical" : "high",
      metadata: {
        country_code: code,
        module_key: moduleKey,
        before: beforeState,
        after: afterState,
        approval_reference: payload.approval_reference || null,
        reason: payload.reason
      }
    });
    return { ok: true, module: updated };
  });
}
