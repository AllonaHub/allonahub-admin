import { supabaseAdmin } from "../../lib/supabase.js";
import { platformError } from "./errors.js";

const COUNTRY_FIELDS = [
  "id", "country_code", "country_name", "native_name", "currency_code",
  "currency_symbol", "default_language", "timezone", "phone_prefix",
  "status", "launch_stage", "data_region", "configuration", "updated_at"
].join(",");

function databaseFailure(label, error) {
  return platformError(
    "COUNTRY_ENGINE_DATA_UNAVAILABLE",
    "Country Engine verisi şu anda alınamadı.",
    503,
    { label, databaseCode: error?.code || null }
  );
}

function atomicChangeFailure(label, error) {
  const message = `${error?.message || ""} ${error?.details || ""}`;
  if (message.includes("COUNTRY_UPDATE_CONFLICT")) {
    return platformError("COUNTRY_UPDATE_CONFLICT", "Ülke kaydı başka bir oturumda değişti. Yenileyip tekrar deneyin.", 409);
  }
  if (message.includes("COUNTRY_MODULE_UPDATE_CONFLICT")) {
    return platformError("COUNTRY_MODULE_UPDATE_CONFLICT", "Modül kaydı başka bir oturumda değişti. Yenileyip tekrar deneyin.", 409);
  }
  if (message.includes("COUNTRY_MODULE_NOT_FOUND")) {
    return platformError("COUNTRY_MODULE_NOT_FOUND", "Ülke modül kaydı bulunamadı.", 404);
  }
  if (message.includes("COUNTRY_NOT_FOUND")) {
    return platformError("COUNTRY_NOT_FOUND", "Ülke kaydı bulunamadı.", 404);
  }
  return databaseFailure(label, error);
}

function rpcRow(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

async function rows(query, label) {
  const { data, error } = await query;
  if (error) throw databaseFailure(label, error);
  return data || [];
}

async function one(query, label) {
  const { data, error } = await query;
  if (error) throw databaseFailure(label, error);
  return data || null;
}

export class CountryRepository {
  constructor(client = supabaseAdmin) {
    this.client = client;
  }

  async listCountries() {
    return rows(
      this.client.from("countries").select(COUNTRY_FIELDS).order("country_code", { ascending: true }),
      "countries"
    );
  }

  async getCountryByCode(countryCode) {
    return one(
      this.client
        .from("countries")
        .select("*")
        .eq("country_code", countryCode)
        .maybeSingle(),
      "country"
    );
  }

  async getCountryContext(countryCode) {
    const country = await this.getCountryByCode(countryCode);
    if (!country) return null;
    const [modules, languages, currencies, providers, rewardPolicy] = await Promise.all([
      rows(
        this.client.from("country_modules").select("*").eq("country_id", country.id).order("module_key"),
        "country_modules"
      ),
      rows(
        this.client.from("country_languages").select("*").eq("country_id", country.id).order("is_default", { ascending: false }),
        "country_languages"
      ),
      rows(
        this.client.from("country_currencies").select("*").eq("country_id", country.id).order("is_default", { ascending: false }),
        "country_currencies"
      ),
      rows(
        this.client
          .from("country_provider_assignments")
          .select("*, integration_provider_definitions(provider_key, display_name, implementation_status, contract_version)")
          .eq("country_id", country.id)
          .order("priority"),
        "country_provider_assignments"
      ),
      one(
        this.client.from("country_reward_policies").select("*").eq("country_id", country.id).maybeSingle(),
        "country_reward_policies"
      )
    ]);
    return { country, modules, languages, currencies, providers, rewardPolicy };
  }

  async safeCount(table) {
    const { count, error } = await this.client.from(table).select("id", { count: "exact", head: true });
    if (error) return { value: null, warning: `${table}:unavailable` };
    return { value: Number(count || 0), warning: null };
  }

  async adminSnapshot() {
    const [countries, modules, languages, currencies, providers, corridors, impact, counts] = await Promise.all([
      this.listCountries(),
      rows(this.client.from("country_modules").select("*").order("module_key"), "country_modules"),
      rows(this.client.from("country_languages").select("*").order("language_code"), "country_languages"),
      rows(this.client.from("country_currencies").select("*").order("currency_code"), "country_currencies"),
      rows(
        this.client
          .from("country_provider_assignments")
          .select("*, integration_provider_definitions(provider_key, display_name, implementation_status, contract_version)")
          .order("priority"),
        "country_provider_assignments"
      ),
      rows(this.client.from("trade_corridors").select("*").order("corridor_key"), "trade_corridors"),
      rows(
        this.client
          .from("impact_metric_snapshots")
          .select("id, metric_key, country_id, corridor_id, period_start, period_end, numeric_value, currency, unit, data_source, verification_status, verified_at, published_at, updated_at")
          .order("period_end", { ascending: false })
          .limit(100),
        "impact_metric_snapshots"
      ),
      Promise.all([
        this.safeCount("profiles"),
        this.safeCount("partner_passports"),
        this.safeCount("trade_requests"),
        this.safeCount("cross_border_order_contexts"),
        this.safeCount("shipments")
      ])
    ]);

    const names = ["users", "partners", "tradeRequests", "crossBorderOrders", "shipments"];
    const metrics = Object.fromEntries(names.map((name, index) => [name, counts[index].value]));
    const warnings = counts.map((item) => item.warning).filter(Boolean);
    return { countries, modules, languages, currencies, providers, corridors, impact, metrics, warnings };
  }

  async listPublishedImpact() {
    const now = new Date().toISOString();
    const data = await rows(
      this.client
        .from("impact_metric_snapshots")
        .select("metric_key, country_id, corridor_id, period_start, period_end, numeric_value, currency, unit, data_source, aggregation_method, verified_at, published_at")
        .eq("verification_status", "published")
        .eq("contains_personal_data", false)
        .lte("published_at", now)
        .order("period_end", { ascending: false })
        .limit(250),
      "impact_metric_snapshots"
    );
    const latest = new Map();
    data.forEach((item) => {
      const key = `${item.metric_key}:${item.country_id || "global"}:${item.corridor_id || "all"}:${item.currency || "none"}`;
      if (!latest.has(key)) latest.set(key, item);
    });
    return [...latest.values()];
  }

  async applyCountryStateChange({ country, patch, expectedUpdatedAt, actorId, reason, approvalReference, requestId }) {
    const { data, error } = await this.client.rpc("apply_country_state_change", {
      p_country_id: country.id,
      p_status: patch.status,
      p_launch_stage: patch.launch_stage,
      p_expected_updated_at: expectedUpdatedAt,
      p_actor_id: actorId,
      p_reason: reason,
      p_approval_reference: approvalReference || null,
      p_request_id: requestId || null
    });
    if (error) throw atomicChangeFailure("country_state_change", error);
    const updated = rpcRow(data);
    if (!updated) throw databaseFailure("country_state_change", { code: "EMPTY_RPC_RESULT" });
    return updated;
  }

  async applyModuleChange({ module, patch, expectedUpdatedAt, actorId, reason, approvalReference, requestId, activationRaised }) {
    const { data, error } = await this.client.rpc("apply_country_module_change", {
      p_module_id: module.id,
      p_enabled: patch.enabled,
      p_beta: patch.beta,
      p_public_visible: patch.public_visible,
      p_partner_registration_enabled: patch.partner_registration_enabled,
      p_transaction_enabled: patch.transaction_enabled,
      p_expected_updated_at: expectedUpdatedAt,
      p_actor_id: actorId,
      p_reason: reason,
      p_approval_reference: approvalReference || null,
      p_request_id: requestId || null,
      p_activation_raised: Boolean(activationRaised)
    });
    if (error) throw atomicChangeFailure("country_module_change", error);
    const updated = rpcRow(data);
    if (!updated) throw databaseFailure("country_module_change", { code: "EMPTY_RPC_RESULT" });
    return updated;
  }
}
