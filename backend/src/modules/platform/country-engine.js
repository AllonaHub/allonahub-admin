import { platformError } from "./errors.js";

export const COUNTRY_LAUNCH_STAGES = Object.freeze([
  "DISABLED",
  "PLANNING",
  "INTEGRATION",
  "INTERNAL_TEST",
  "BETA",
  "PUBLIC"
]);

export const COUNTRY_STATUSES = Object.freeze(["active", "coming_soon", "disabled"]);

const LAUNCH_STAGE_TRANSITIONS = Object.freeze({
  DISABLED: new Set(["DISABLED", "PLANNING"]),
  PLANNING: new Set(["DISABLED", "PLANNING", "INTEGRATION"]),
  INTEGRATION: new Set(["PLANNING", "INTEGRATION", "INTERNAL_TEST"]),
  INTERNAL_TEST: new Set(["INTEGRATION", "INTERNAL_TEST", "BETA"]),
  BETA: new Set(["INTERNAL_TEST", "BETA", "PUBLIC"]),
  PUBLIC: new Set(["BETA", "PUBLIC"])
});

const STATUS_TRANSITIONS = Object.freeze({
  disabled: new Set(["disabled", "coming_soon"]),
  coming_soon: new Set(["disabled", "coming_soon", "active"]),
  active: new Set(["active", "coming_soon"])
});

const ACTIVATION_FIELDS = Object.freeze([
  "enabled",
  "beta",
  "public_visible",
  "partner_registration_enabled",
  "transaction_enabled"
]);

export function normalizeCountryCode(value) {
  const code = String(value || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    throw platformError("INVALID_COUNTRY_CODE", "Ülke kodu ISO alpha-2 biçiminde olmalıdır.", 400);
  }
  return code;
}

export function normalizeModuleKey(value) {
  const key = String(value || "").trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(key)) {
    throw platformError("INVALID_MODULE_KEY", "Modül anahtarı doğrulanamadı.", 400);
  }
  return key;
}

function publicCountry(country) {
  return {
    countryCode: country.country_code,
    countryName: country.country_name,
    nativeName: country.native_name,
    currencyCode: country.currency_code,
    currencySymbol: country.currency_symbol,
    defaultLanguage: country.default_language,
    timezone: country.timezone,
    phonePrefix: country.phone_prefix,
    status: country.status,
    launchStage: country.launch_stage,
    updatedAt: country.updated_at
  };
}

function publicModule(module) {
  return {
    moduleKey: module.module_key,
    enabled: Boolean(module.enabled),
    beta: Boolean(module.beta),
    publicVisible: Boolean(module.public_visible),
    partnerRegistrationEnabled: Boolean(module.partner_registration_enabled),
    transactionEnabled: Boolean(module.transaction_enabled),
    updatedAt: module.updated_at
  };
}

function publicLanguage(language) {
  return {
    code: language.language_code,
    nativeLabel: language.native_label,
    isDefault: Boolean(language.is_default)
  };
}

function publicCurrency(currency) {
  return {
    code: currency.currency_code,
    symbol: currency.currency_symbol,
    isDefault: Boolean(currency.is_default),
    transactionEnabled: Boolean(currency.transaction_enabled),
    settlementEnabled: Boolean(currency.settlement_enabled)
  };
}

function hasProductionPaymentRoute(context, moduleKey) {
  return (context.providers || []).some((assignment) => (
    assignment.provider_type === "payment"
    && assignment.enabled
    && assignment.environment === "production"
    && ["*", moduleKey].includes(assignment.module_key)
    && assignment.integration_provider_definitions?.implementation_status === "production_ready"
  ));
}

function activationRequested(current, patch) {
  return ACTIVATION_FIELDS.some((field) => patch[field] === true && current[field] !== true);
}

export class CountryEngine {
  constructor(repository) {
    if (!repository) throw new TypeError("CountryEngine repository is required");
    this.repository = repository;
  }

  async listPublicCountries() {
    const countries = await this.repository.listCountries();
    return countries
      .filter((country) => country.status !== "disabled")
      .map(publicCountry);
  }

  async getPublicContext(countryCode) {
    const code = normalizeCountryCode(countryCode);
    const context = await this.repository.getCountryContext(code);
    if (!context?.country || context.country.status === "disabled") {
      throw platformError("COUNTRY_NOT_AVAILABLE", "Bu ülke henüz yayın dizininde değil.", 404);
    }
    return {
      country: publicCountry(context.country),
      modules: (context.modules || [])
        .filter((module) => module.public_visible)
        .map(publicModule),
      languages: (context.languages || [])
        .filter((language) => language.enabled && language.public_visible)
        .map(publicLanguage),
      currencies: (context.currencies || [])
        .filter((currency) => currency.display_enabled)
        .map(publicCurrency),
      rewards: context.rewardPolicy
        ? {
            policyStatus: context.rewardPolicy.policy_status,
            transferEligible: Boolean(context.rewardPolicy.transfer_eligible),
            crossBorderRedemptionEnabled: Boolean(context.rewardPolicy.cross_border_redemption_enabled),
            cashoutEnabled: Boolean(context.rewardPolicy.cashout_enabled)
          }
        : null
    };
  }

  async moduleCapability(countryCode, moduleKey) {
    const code = normalizeCountryCode(countryCode);
    const key = normalizeModuleKey(moduleKey);
    const context = await this.repository.getCountryContext(code);
    if (!context?.country || context.country.status === "disabled") {
      return { allowed: false, reason: "COUNTRY_DISABLED", countryCode: code, moduleKey: key };
    }
    const module = (context.modules || []).find((item) => item.module_key === key);
    if (!module) return { allowed: false, reason: "MODULE_NOT_CONFIGURED", countryCode: code, moduleKey: key };
    if (!module.enabled) return { allowed: false, reason: "MODULE_DISABLED", countryCode: code, moduleKey: key };
    if (!module.public_visible) return { allowed: false, reason: "MODULE_NOT_PUBLIC", countryCode: code, moduleKey: key };
    return {
      allowed: true,
      countryCode: code,
      moduleKey: key,
      beta: Boolean(module.beta),
      partnerRegistrationEnabled: Boolean(module.partner_registration_enabled),
      transactionEnabled: Boolean(module.transaction_enabled)
    };
  }

  validateCountryPatch(current, patch, approvalReference) {
    if (!current) throw platformError("COUNTRY_NOT_FOUND", "Ülke kaydı bulunamadı.", 404);
    const nextStatus = patch.status ?? current.status;
    const nextStage = patch.launch_stage ?? current.launch_stage;
    if (!COUNTRY_STATUSES.includes(nextStatus) || !COUNTRY_LAUNCH_STAGES.includes(nextStage)) {
      throw platformError("INVALID_COUNTRY_STATE", "Ülke durumu doğrulanamadı.", 400);
    }
    if (!STATUS_TRANSITIONS[current.status]?.has(nextStatus)) {
      throw platformError("COUNTRY_STATUS_TRANSITION_BLOCKED", "Ülke statüsü bu adımda doğrudan değiştirilemez.", 409);
    }
    if (!LAUNCH_STAGE_TRANSITIONS[current.launch_stage]?.has(nextStage)) {
      throw platformError("COUNTRY_STAGE_TRANSITION_BLOCKED", "Ülke lansman aşaması sıradaki kontrollü adıma geçirilmelidir.", 409);
    }
    const raisesExposure = nextStatus === "active" && current.status !== "active"
      || ["BETA", "PUBLIC"].includes(nextStage) && nextStage !== current.launch_stage;
    if (raisesExposure && !String(approvalReference || "").trim()) {
      throw platformError("APPROVAL_REFERENCE_REQUIRED", "Yayın veya beta açılışı için onay referansı gereklidir.", 400);
    }
    if (nextStage === "PUBLIC" && nextStatus !== "active") {
      throw platformError("PUBLIC_COUNTRY_MUST_BE_ACTIVE", "PUBLIC ülke statüsü active olmalıdır.", 409);
    }
    if (nextStatus === "disabled" && nextStage !== "DISABLED") {
      throw platformError("DISABLED_COUNTRY_STAGE_MISMATCH", "Disabled ülkenin lansman aşaması DISABLED olmalıdır.", 409);
    }
    return { status: nextStatus, launch_stage: nextStage };
  }

  validateModulePatch(context, current, patch, approvalReference) {
    if (!context?.country || !current) {
      throw platformError("COUNTRY_MODULE_NOT_FOUND", "Ülke modül kaydı bulunamadı.", 404);
    }
    const proposed = { ...current, ...patch };
    if (activationRequested(current, patch) && !String(approvalReference || "").trim()) {
      throw platformError("APPROVAL_REFERENCE_REQUIRED", "Modül açılışı için onay referansı gereklidir.", 400);
    }
    if (!proposed.enabled && (proposed.beta || proposed.public_visible || proposed.partner_registration_enabled || proposed.transaction_enabled)) {
      throw platformError("MODULE_STATE_INCONSISTENT", "Kapalı modül yayın, partner kaydı veya işleme açılamaz.", 409);
    }
    if (proposed.beta && !["BETA", "PUBLIC"].includes(context.country.launch_stage)) {
      throw platformError("COUNTRY_NOT_BETA_READY", "Ülke BETA aşamasına gelmeden modül beta olarak işaretlenemez.", 409);
    }
    if (proposed.public_visible && !["BETA", "PUBLIC"].includes(context.country.launch_stage)) {
      throw platformError("COUNTRY_NOT_PUBLIC_READY", "Ülke BETA veya PUBLIC aşamasına gelmeden modül yayınlanamaz.", 409);
    }
    if (proposed.transaction_enabled) {
      if (!["BETA", "PUBLIC"].includes(context.country.launch_stage)) {
        throw platformError("COUNTRY_NOT_TRANSACTION_READY", "Ülke BETA veya PUBLIC aşamasına gelmeden işlem açılamaz.", 409);
      }
      if (!hasProductionPaymentRoute(context, current.module_key)) {
        throw platformError("PAYMENT_PROVIDER_NOT_READY", "Production-ready ödeme rotası doğrulanmadan işlem açılamaz.", 409);
      }
    }
    return Object.fromEntries(ACTIVATION_FIELDS.map((field) => [field, Boolean(proposed[field])]));
  }
}
