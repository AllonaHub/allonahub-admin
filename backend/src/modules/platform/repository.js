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

function isoDaysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function impactMetric({ metricKey, value, periodStart, periodEnd, dataSource, aggregationMethod, unit = "count" }) {
  return {
    metric_key: metricKey,
    country_id: null,
    corridor_id: null,
    period_start: periodStart,
    period_end: periodEnd,
    numeric_value: Number(value || 0),
    currency: null,
    unit,
    data_source: dataSource,
    aggregation_method: aggregationMethod,
    verified_at: periodEnd,
    published_at: periodEnd,
    source_status: "live_aggregate"
  };
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

async function countRows(query, label) {
  const { count, error } = await query;
  if (error) throw databaseFailure(label, error);
  return Number(count || 0);
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

  activeProfilesQuery() {
    const now = new Date().toISOString();
    return this.client
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("account_status", "active")
      .eq("flagged_suspicious", false)
      .or(`suspended_until.is.null,suspended_until.lt.${now}`);
  }

  async sumHpEarnedSince(periodStart) {
    let total = 0;
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await this.client
        .from("hp_ledger")
        .select("amount")
        .eq("type", "earn")
        .gte("created_at", periodStart)
        .range(from, from + pageSize - 1);
      if (error) {
        if (["42P01", "PGRST205"].includes(error.code)) return null;
        throw databaseFailure("hp_ledger", error);
      }
      const page = data || [];
      total += page.reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0)), 0);
      if (page.length < pageSize) break;
      from += pageSize;
    }
    return total;
  }

  async listLivePublicImpact() {
    const periodEnd = new Date().toISOString();
    const newUsersPeriodStart = isoDaysAgo(7);
    const hpPeriodStart = isoDaysAgo(7);
    const [activeUsers, activePartners, newUsers, hpEarned] = await Promise.all([
      countRows(this.activeProfilesQuery(), "impact_active_users"),
      countRows(
        this.client
          .from("partner_businesses")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .eq("verification_status", "verified"),
        "impact_active_partners"
      ),
      countRows(
        this.activeProfilesQuery().gte("created_at", newUsersPeriodStart),
        "impact_new_users"
      ),
      this.sumHpEarnedSince(hpPeriodStart)
    ]);

    const metrics = [
      impactMetric({
        metricKey: "active_user_count",
        value: activeUsers,
        periodStart: null,
        periodEnd,
        dataSource: "public.profiles",
        aggregationMethod: "account_status='active', flagged_suspicious=false ve suspended_until bos veya gecmis olan profil sayisi"
      }),
      impactMetric({
        metricKey: "active_partner_count",
        value: activePartners,
        periodStart: null,
        periodEnd,
        dataSource: "public.partner_businesses",
        aggregationMethod: "status='active' ve verification_status='verified' olan partner sayisi"
      }),
      impactMetric({
        metricKey: "new_user_count",
        value: newUsers,
        periodStart: newUsersPeriodStart,
        periodEnd,
        dataSource: "public.profiles",
        aggregationMethod: "son 7 gunde olusan aktif profil sayisi"
      })
    ];

    const sourceNotes = [
      "crew_count: kanonik crew basvuru/profil kaynagi yok; profil metninden tahmin edilmedi"
    ];

    if (hpEarned !== null) {
      metrics.push(impactMetric({
        metricKey: "hp_points_issued",
        value: hpEarned,
        periodStart: hpPeriodStart,
        periodEnd,
        dataSource: "public.hp_ledger",
        aggregationMethod: "son 7 gunde olusan pozitif earn hareketlerinin toplami",
        unit: "hp"
      }));
    } else {
      sourceNotes.push("hp_points_issued: public.hp_ledger kaynagina ulasilamadi");
    }

    return { metrics, sourceNotes };
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
