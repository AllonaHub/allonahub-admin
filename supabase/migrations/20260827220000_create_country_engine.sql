-- AllonaHub 2030 country engine foundation.
-- Additive and shadow-mode by default: this migration does not route existing
-- orders, payments, tax, invoice or shipment traffic through the new engine.

create extension if not exists pgcrypto;

create or replace function public.set_country_engine_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  country_code text not null unique check (country_code ~ '^[A-Z]{2}$'),
  country_name text not null,
  native_name text not null,
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  currency_symbol text not null default '',
  default_language text not null check (default_language ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  timezone text not null,
  phone_prefix text not null default '',
  tax_configuration jsonb not null default '{}'::jsonb,
  invoice_configuration jsonb not null default '{}'::jsonb,
  payment_configuration jsonb not null default '{}'::jsonb,
  shipping_configuration jsonb not null default '{}'::jsonb,
  marketplace_configuration jsonb not null default '{}'::jsonb,
  legal_configuration jsonb not null default '{}'::jsonb,
  data_protection_configuration jsonb not null default '{}'::jsonb,
  data_region text,
  status text not null default 'disabled'
    check (status in ('active', 'coming_soon', 'disabled')),
  launch_stage text not null default 'DISABLED'
    check (launch_stage in ('DISABLED', 'PLANNING', 'INTEGRATION', 'INTERNAL_TEST', 'BETA', 'PUBLIC')),
  configuration jsonb not null default '{"enforcement_mode":"shadow"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (launch_stage <> 'PUBLIC' or status = 'active'),
  check (status <> 'disabled' or launch_stage = 'DISABLED')
);

create table if not exists public.country_languages (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  language_code text not null check (language_code ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  native_label text not null,
  is_default boolean not null default false,
  enabled boolean not null default false,
  public_visible boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_id, language_code)
);

create unique index if not exists country_languages_one_default_idx
  on public.country_languages(country_id)
  where is_default;

create table if not exists public.country_currencies (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  currency_symbol text not null default '',
  is_default boolean not null default false,
  display_enabled boolean not null default false,
  transaction_enabled boolean not null default false,
  settlement_enabled boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_id, currency_code)
);

create unique index if not exists country_currencies_one_default_idx
  on public.country_currencies(country_id)
  where is_default;

create table if not exists public.country_modules (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  module_key text not null check (module_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  enabled boolean not null default false,
  beta boolean not null default false,
  public_visible boolean not null default false,
  partner_registration_enabled boolean not null default false,
  transaction_enabled boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  approval_reference text,
  activated_by uuid references public.profiles(id) on delete set null,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_id, module_key),
  check (enabled or not (beta or public_visible or partner_registration_enabled or transaction_enabled))
);

create table if not exists public.integration_provider_definitions (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique check (provider_key ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  provider_type text not null
    check (provider_type in ('payment', 'logistics', 'fiscal_document', 'tax', 'translation', 'customs', 'currency', 'marketplace')),
  display_name text not null,
  contract_version text not null default 'v1',
  implementation_status text not null default 'planned'
    check (implementation_status in ('planned', 'adapter_ready', 'integration_test', 'production_ready', 'disabled')),
  configuration_schema jsonb not null default '{}'::jsonb,
  capabilities jsonb not null default '{}'::jsonb,
  documentation_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.country_provider_assignments (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  module_key text not null default '*' check (module_key = '*' or module_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  provider_type text not null
    check (provider_type in ('payment', 'logistics', 'fiscal_document', 'tax', 'translation', 'customs', 'currency', 'marketplace')),
  provider_key text not null references public.integration_provider_definitions(provider_key),
  environment text not null default 'production'
    check (environment in ('sandbox', 'staging', 'production')),
  priority integer not null default 100 check (priority between 1 and 9999),
  enabled boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  credential_reference text,
  approval_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_id, module_key, provider_type, provider_key, environment),
  check (not enabled or nullif(btrim(approval_reference), '') is not null)
);

create table if not exists public.tax_rule_sets (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  rule_key text not null check (rule_key ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  version text not null,
  status text not null default 'draft'
    check (status in ('draft', 'review', 'active', 'retired')),
  transaction_scope text not null default 'all'
    check (transaction_scope in ('all', 'b2c', 'b2b', 'domestic', 'cross_border')),
  partner_type text,
  product_category text,
  rules jsonb not null default '{}'::jsonb,
  effective_from timestamptz,
  effective_until timestamptz,
  approval_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_id, rule_key, version)
);

create table if not exists public.compliance_rule_sets (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references public.countries(id) on delete cascade,
  rule_key text not null check (rule_key ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  category text not null
    check (category in ('privacy', 'data_protection', 'consumer_rights', 'distance_sales', 'kyc', 'aml', 'sanctions', 'restricted_products', 'age_restrictions', 'seller_verification', 'cross_border')),
  version text not null,
  status text not null default 'draft'
    check (status in ('draft', 'legal_review', 'active', 'retired')),
  rules jsonb not null default '{}'::jsonb,
  effective_from timestamptz,
  effective_until timestamptz,
  approval_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (country_id, rule_key, version)
);

create table if not exists public.country_reward_policies (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade unique,
  policy_status text not null default 'planned'
    check (policy_status in ('planned', 'shadow', 'active', 'paused')),
  earning_rules jsonb not null default '{}'::jsonb,
  spending_rules jsonb not null default '{}'::jsonb,
  campaign_rules jsonb not null default '{}'::jsonb,
  expiry_rules jsonb not null default '{}'::jsonb,
  transfer_eligible boolean not null default false,
  cross_border_redemption_enabled boolean not null default false,
  cashout_enabled boolean not null default false,
  regulatory_approval_reference text,
  approval_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not cashout_enabled or nullif(btrim(regulatory_approval_reference), '') is not null),
  check (
    not (transfer_eligible or cross_border_redemption_enabled or cashout_enabled)
    or nullif(btrim(approval_reference), '') is not null
  )
);

create table if not exists public.user_country_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  country_id uuid not null references public.countries(id) on delete cascade,
  local_phone text,
  billing_profile jsonb not null default '{}'::jsonb,
  tax_profile jsonb not null default '{}'::jsonb,
  payment_preferences jsonb not null default '{}'::jsonb,
  delivery_preferences jsonb not null default '{}'::jsonb,
  kyc_status text not null default 'not_started'
    check (kyc_status in ('not_started', 'pending', 'review', 'verified', 'rejected', 'expired')),
  partner_status text not null default 'none'
    check (partner_status in ('none', 'pending', 'approved', 'rejected', 'suspended')),
  local_permissions jsonb not null default '{}'::jsonb,
  data_region text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, country_id)
);

create table if not exists public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references public.countries(id) on delete cascade,
  document_type text not null
    check (document_type in ('privacy_policy', 'terms', 'distance_sales', 'consumer_notice', 'marketing_consent', 'data_transfer_consent', 'partner_terms', 'b2b_terms')),
  language_code text not null check (language_code ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  version text not null,
  title text not null,
  content_url text not null,
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'draft'
    check (status in ('draft', 'legal_review', 'active', 'retired')),
  effective_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (country_id, document_type, language_code, version),
  check (status <> 'active' or (effective_at is not null and content_sha256 is not null))
);

create table if not exists public.user_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  document_id uuid not null references public.legal_document_versions(id) on delete restrict,
  consent_version text not null,
  acceptance_source text not null default 'web'
    check (acceptance_source in ('web', 'mobile', 'partner_panel', 'admin_assisted', 'api')),
  data_region text,
  ip_hash text,
  user_agent_hash text,
  evidence jsonb not null default '{}'::jsonb,
  accepted_at timestamptz not null default now(),
  unique (user_id, document_id)
);

create table if not exists public.partner_passports (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade unique,
  allona_partner_id text not null unique default ('ALP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  home_country_id uuid references public.countries(id) on delete set null,
  sector_key text,
  verification_level text not null default 'unverified'
    check (verification_level in ('unverified', 'verified_business', 'verified_exporter', 'trusted_partner', 'elite_partner')),
  export_capability_status text not null default 'not_assessed'
    check (export_capability_status in ('not_assessed', 'pending', 'approved', 'restricted', 'rejected')),
  service_country_codes text[] not null default '{}'::text[],
  supported_languages text[] not null default '{}'::text[],
  commerce_modes text[] not null default '{}'::text[],
  logistics_capability jsonb not null default '{}'::jsonb,
  rating_snapshot numeric(4,2) check (rating_snapshot is null or rating_snapshot between 0 and 5),
  transaction_count_snapshot bigint not null default 0 check (transaction_count_snapshot >= 0),
  trust_score_snapshot integer check (trust_score_snapshot between 0 and 100),
  status text not null default 'active'
    check (status in ('active', 'review', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_country_approvals (
  id uuid primary key default gen_random_uuid(),
  partner_passport_id uuid not null references public.partner_passports(id) on delete cascade,
  country_id uuid not null references public.countries(id) on delete cascade,
  approval_status text not null default 'unavailable'
    check (approval_status in ('unavailable', 'pending', 'review', 'approved', 'rejected', 'suspended')),
  allowed_modules text[] not null default '{}'::text[],
  b2b_enabled boolean not null default false,
  b2c_enabled boolean not null default false,
  requirements jsonb not null default '{}'::jsonb,
  decision_reason text,
  approval_reference text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_passport_id, country_id),
  check (
    approval_status <> 'approved'
    or (
      approved_by is not null
      and approved_at is not null
      and nullif(btrim(approval_reference), '') is not null
    )
  )
);

create table if not exists public.partner_verification_reviews (
  id uuid primary key default gen_random_uuid(),
  partner_passport_id uuid not null references public.partner_passports(id) on delete cascade,
  requested_level text not null
    check (requested_level in ('verified_business', 'verified_exporter', 'trusted_partner', 'elite_partner')),
  status text not null default 'pending'
    check (status in ('pending', 'review', 'approved', 'rejected', 'expired', 'revoked')),
  criteria_snapshot jsonb not null default '{}'::jsonb,
  evidence_references jsonb not null default '[]'::jsonb,
  decision_reason text,
  approval_reference text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status <> 'approved'
    or (
      reviewed_by is not null
      and reviewed_at is not null
      and nullif(btrim(approval_reference), '') is not null
    )
  )
);

create table if not exists public.country_configuration_events (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  module_id uuid references public.country_modules(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  reason text not null,
  approval_reference text,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

create index if not exists countries_status_stage_idx
  on public.countries(status, launch_stage, country_code);
create index if not exists country_modules_country_visibility_idx
  on public.country_modules(country_id, public_visible, enabled, module_key);
create index if not exists country_modules_transaction_idx
  on public.country_modules(country_id, transaction_enabled, module_key)
  where transaction_enabled;
create index if not exists country_provider_assignments_route_idx
  on public.country_provider_assignments(country_id, module_key, provider_type, enabled, priority);
create index if not exists tax_rule_sets_active_idx
  on public.tax_rule_sets(country_id, status, effective_from desc);
create index if not exists compliance_rule_sets_active_idx
  on public.compliance_rule_sets(country_id, category, status, effective_from desc);
create index if not exists user_country_profiles_user_idx
  on public.user_country_profiles(user_id, country_id);
create index if not exists legal_document_versions_lookup_idx
  on public.legal_document_versions(country_id, document_type, language_code, status, effective_at desc);
create index if not exists user_legal_acceptances_user_idx
  on public.user_legal_acceptances(user_id, accepted_at desc);
create index if not exists partner_passports_home_country_idx
  on public.partner_passports(home_country_id, verification_level, status);
create index if not exists partner_country_approvals_country_idx
  on public.partner_country_approvals(country_id, approval_status, updated_at desc);
create index if not exists partner_verification_reviews_queue_idx
  on public.partner_verification_reviews(status, requested_level, created_at);
create index if not exists country_configuration_events_country_idx
  on public.country_configuration_events(country_id, created_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'countries', 'country_languages', 'country_currencies', 'country_modules',
    'integration_provider_definitions', 'country_provider_assignments',
    'tax_rule_sets', 'compliance_rule_sets', 'country_reward_policies',
    'user_country_profiles', 'legal_document_versions', 'partner_passports',
    'partner_country_approvals', 'partner_verification_reviews'
  ] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_country_engine_updated_at()',
      table_name,
      table_name
    );
  end loop;
end $$;

create or replace function public.guard_user_country_profile_controlled_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  privileged boolean := public.is_admin() or coalesce(auth.role(), '') = 'service_role';
begin
  if privileged then return new; end if;

  if tg_op = 'INSERT' then
    if new.kyc_status <> 'not_started'
      or new.partner_status <> 'none'
      or new.data_region is not null then
      raise exception 'KYC, partner approval and data region are controlled fields';
    end if;
    return new;
  end if;

  if new.user_id is distinct from old.user_id
    or new.country_id is distinct from old.country_id
    or new.kyc_status is distinct from old.kyc_status
    or new.partner_status is distinct from old.partner_status
    or new.data_region is distinct from old.data_region then
    raise exception 'KYC, partner approval, identity and data region are controlled fields';
  end if;
  return new;
end;
$$;

drop trigger if exists user_country_profiles_controlled_fields on public.user_country_profiles;
create trigger user_country_profiles_controlled_fields
  before insert or update on public.user_country_profiles
  for each row execute function public.guard_user_country_profile_controlled_fields();

create or replace function public.validate_user_legal_acceptance()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  document_record public.legal_document_versions%rowtype;
  privileged boolean := public.is_admin() or coalesce(auth.role(), '') = 'service_role';
begin
  if tg_op = 'UPDATE' then
    raise exception 'Legal acceptance evidence is immutable';
  end if;
  if privileged then return new; end if;

  select * into document_record
  from public.legal_document_versions
  where id = new.document_id;

  if not found
    or document_record.status <> 'active'
    or document_record.effective_at is null
    or document_record.effective_at > now() then
    raise exception 'Only an active legal document can be accepted';
  end if;
  if new.consent_version <> document_record.version then
    raise exception 'Consent version must match the legal document version';
  end if;
  return new;
end;
$$;

drop trigger if exists user_legal_acceptances_validate on public.user_legal_acceptances;
create trigger user_legal_acceptances_validate
  before insert or update on public.user_legal_acceptances
  for each row execute function public.validate_user_legal_acceptance();

create or replace function public.guard_active_legal_document_content()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.status in ('active', 'retired') and (
    new.country_id is distinct from old.country_id
    or new.document_type is distinct from old.document_type
    or new.language_code is distinct from old.language_code
    or new.version is distinct from old.version
    or new.title is distinct from old.title
    or new.content_url is distinct from old.content_url
    or new.content_sha256 is distinct from old.content_sha256
    or new.effective_at is distinct from old.effective_at
  ) then
    raise exception 'Active legal document content is immutable; create a new version';
  end if;
  return new;
end;
$$;

drop trigger if exists legal_document_versions_content_guard on public.legal_document_versions;
create trigger legal_document_versions_content_guard
  before update on public.legal_document_versions
  for each row execute function public.guard_active_legal_document_content();

create or replace function public.apply_country_state_change(
  p_country_id uuid,
  p_status text,
  p_launch_stage text,
  p_expected_updated_at timestamptz,
  p_actor_id uuid,
  p_reason text,
  p_approval_reference text,
  p_request_id text
)
returns public.countries
language plpgsql
security invoker
set search_path = public
as $$
declare
  before_record public.countries%rowtype;
  after_record public.countries%rowtype;
begin
  if coalesce(length(btrim(p_reason)), 0) < 10 then
    raise exception using errcode = 'P0001', message = 'COUNTRY_CHANGE_REASON_REQUIRED';
  end if;

  select * into before_record
  from public.countries
  where id = p_country_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'COUNTRY_NOT_FOUND';
  end if;
  if p_expected_updated_at is null or before_record.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'COUNTRY_UPDATE_CONFLICT';
  end if;

  update public.countries
  set status = p_status,
      launch_stage = p_launch_stage
  where id = p_country_id
  returning * into after_record;

  insert into public.country_configuration_events (
    country_id, actor_id, action, reason, approval_reference,
    before_state, after_state, request_id
  ) values (
    p_country_id,
    p_actor_id,
    'country.state_changed',
    p_reason,
    nullif(btrim(p_approval_reference), ''),
    jsonb_build_object('status', before_record.status, 'launch_stage', before_record.launch_stage),
    jsonb_build_object('status', after_record.status, 'launch_stage', after_record.launch_stage),
    p_request_id
  );

  return after_record;
end;
$$;

create or replace function public.apply_country_module_change(
  p_module_id uuid,
  p_enabled boolean,
  p_beta boolean,
  p_public_visible boolean,
  p_partner_registration_enabled boolean,
  p_transaction_enabled boolean,
  p_expected_updated_at timestamptz,
  p_actor_id uuid,
  p_reason text,
  p_approval_reference text,
  p_request_id text,
  p_activation_raised boolean
)
returns public.country_modules
language plpgsql
security invoker
set search_path = public
as $$
declare
  before_record public.country_modules%rowtype;
  after_record public.country_modules%rowtype;
begin
  if coalesce(length(btrim(p_reason)), 0) < 10 then
    raise exception using errcode = 'P0001', message = 'COUNTRY_CHANGE_REASON_REQUIRED';
  end if;

  select * into before_record
  from public.country_modules
  where id = p_module_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'COUNTRY_MODULE_NOT_FOUND';
  end if;
  if p_expected_updated_at is null or before_record.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'COUNTRY_MODULE_UPDATE_CONFLICT';
  end if;

  update public.country_modules
  set enabled = p_enabled,
      beta = p_beta,
      public_visible = p_public_visible,
      partner_registration_enabled = p_partner_registration_enabled,
      transaction_enabled = p_transaction_enabled,
      approval_reference = coalesce(nullif(btrim(p_approval_reference), ''), approval_reference),
      activated_by = case when p_activation_raised then p_actor_id else activated_by end,
      activated_at = case when p_activation_raised then now() else activated_at end
  where id = p_module_id
  returning * into after_record;

  insert into public.country_configuration_events (
    country_id, module_id, actor_id, action, reason, approval_reference,
    before_state, after_state, request_id
  ) values (
    before_record.country_id,
    p_module_id,
    p_actor_id,
    'country.module_changed',
    p_reason,
    nullif(btrim(p_approval_reference), ''),
    jsonb_build_object(
      'enabled', before_record.enabled,
      'beta', before_record.beta,
      'public_visible', before_record.public_visible,
      'partner_registration_enabled', before_record.partner_registration_enabled,
      'transaction_enabled', before_record.transaction_enabled
    ),
    jsonb_build_object(
      'enabled', after_record.enabled,
      'beta', after_record.beta,
      'public_visible', after_record.public_visible,
      'partner_registration_enabled', after_record.partner_registration_enabled,
      'transaction_enabled', after_record.transaction_enabled
    ),
    p_request_id
  );

  return after_record;
end;
$$;

revoke all on function public.apply_country_state_change(
  uuid, text, text, timestamptz, uuid, text, text, text
) from public, anon, authenticated;
revoke all on function public.apply_country_module_change(
  uuid, boolean, boolean, boolean, boolean, boolean, timestamptz,
  uuid, text, text, text, boolean
) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.apply_country_state_change(
      uuid, text, text, timestamptz, uuid, text, text, text
    ) to service_role;
    grant execute on function public.apply_country_module_change(
      uuid, boolean, boolean, boolean, boolean, boolean, timestamptz,
      uuid, text, text, text, boolean
    ) to service_role;
  end if;
end $$;

-- Keep legacy address behavior unchanged. The new country code remains nullable
-- until a separate, verified backfill maps historical free-text countries.
do $$
begin
  if to_regclass('public.addresses') is not null then
    alter table public.addresses add column if not exists country_code text;
    if not exists (
      select 1 from pg_constraint
      where conname = 'addresses_country_code_format'
        and conrelid = 'public.addresses'::regclass
    ) then
      alter table public.addresses
        add constraint addresses_country_code_format
        check (country_code is null or country_code ~ '^[A-Z]{2}$') not valid;
    end if;
    if not exists (
      select 1 from pg_constraint
      where conname = 'addresses_country_code_fkey'
        and conrelid = 'public.addresses'::regclass
    ) then
      alter table public.addresses
        add constraint addresses_country_code_fkey
        foreign key (country_code) references public.countries(country_code) not valid;
    end if;
  end if;
end $$;

-- Extend the existing global module catalog without changing existing rows.
do $$
begin
  if to_regclass('public.platform_modules') is not null then
    insert into public.platform_modules (module_key, name, category, is_active, is_visible, commission_rate, sort_order)
    values
      ('b2b', 'B2B Trade Network', 'commerce', false, false, 0, 200),
      ('logistics', 'Lojistik', 'transport', false, false, 0, 210),
      ('career', 'Kariyer', 'services', false, false, 0, 220),
      ('travel', 'Seyahat', 'services', false, false, 0, 230),
      ('events', 'Etkinlikler', 'services', false, false, 0, 240),
      ('opportunities', 'Ticari Fırsatlar', 'commerce', false, false, 0, 250),
      ('partners', 'Doğrulanmış Partnerler', 'marketplace', false, false, 0, 260),
      ('turkic_world', 'Türk Dünyası', 'ecosystem', false, false, 0, 270)
    on conflict (module_key) do nothing;
  end if;
end $$;

insert into public.countries (
  country_code, country_name, native_name, currency_code, currency_symbol,
  default_language, timezone, phone_prefix, tax_configuration,
  invoice_configuration, payment_configuration, shipping_configuration,
  marketplace_configuration, legal_configuration, data_protection_configuration,
  data_region, status, launch_stage, configuration
) values
  (
    'TR', 'Türkiye', 'Türkiye', 'TRY', '₺', 'tr', 'Europe/Istanbul', '+90',
    '{"mode":"inherit_existing_logic","enforced_by_country_engine":false}'::jsonb,
    '{"contract":"FiscalDocumentProvider","enforced_by_country_engine":false}'::jsonb,
    '{"contract":"PaymentProvider","enforced_by_country_engine":false}'::jsonb,
    '{"contract":"LogisticsProvider","enforced_by_country_engine":false}'::jsonb,
    '{"review_status":"required"}'::jsonb,
    '{"review_status":"required"}'::jsonb,
    '{"review_status":"required"}'::jsonb,
    'TR', 'active', 'PUBLIC',
    '{"enforcement_mode":"shadow","production_behavior_unchanged":true}'::jsonb
  ),
  (
    'AZ', 'Azerbaycan', 'Azərbaycan', 'AZN', '₼', 'az', 'Asia/Baku', '+994',
    '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    '{"review_status":"required"}'::jsonb,
    '{"review_status":"required"}'::jsonb,
    null, 'coming_soon', 'PLANNING', '{"enforcement_mode":"shadow"}'::jsonb
  ),
  (
    'KZ', 'Kazakistan', 'Қазақстан', 'KZT', '₸', 'kk', 'Asia/Almaty', '+7',
    '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    '{"review_status":"required"}'::jsonb,
    '{"review_status":"required"}'::jsonb,
    null, 'coming_soon', 'PLANNING', '{"enforcement_mode":"shadow"}'::jsonb
  ),
  (
    'UZ', 'Özbekistan', 'Oʻzbekiston', 'UZS', 'soʻm', 'uz', 'Asia/Tashkent', '+998',
    '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    '{"review_status":"required"}'::jsonb,
    '{"review_status":"required"}'::jsonb,
    null, 'coming_soon', 'PLANNING', '{"enforcement_mode":"shadow"}'::jsonb
  ),
  (
    'KG', 'Kırgızistan', 'Кыргызстан', 'KGS', 'сом', 'ky', 'Asia/Bishkek', '+996',
    '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    '{"review_status":"required"}'::jsonb,
    '{"review_status":"required"}'::jsonb,
    null, 'coming_soon', 'PLANNING', '{"enforcement_mode":"shadow"}'::jsonb
  )
on conflict (country_code) do nothing;

insert into public.country_languages (
  country_id, language_code, native_label, is_default, enabled, public_visible
)
select c.id, seed.language_code, seed.native_label, seed.is_default, seed.enabled, seed.public_visible
from (
  values
    ('TR', 'tr', 'Türkçe', true, true, true),
    ('TR', 'en', 'English', false, true, true),
    ('TR', 'az', 'Azərbaycan dili', false, true, true),
    ('AZ', 'az', 'Azərbaycan dili', true, true, true),
    ('AZ', 'tr', 'Türkçe', false, true, true),
    ('AZ', 'en', 'English', false, true, true),
    ('KZ', 'kk', 'Қазақша', true, false, false),
    ('KZ', 'en', 'English', false, false, false),
    ('KZ', 'ru', 'Русский', false, false, false),
    ('UZ', 'uz', 'Oʻzbekcha', true, false, false),
    ('UZ', 'en', 'English', false, false, false),
    ('KG', 'ky', 'Кыргызча', true, false, false),
    ('KG', 'en', 'English', false, false, false),
    ('KG', 'ru', 'Русский', false, false, false)
) as seed(country_code, language_code, native_label, is_default, enabled, public_visible)
join public.countries c on c.country_code = seed.country_code
on conflict (country_id, language_code) do nothing;

insert into public.country_currencies (
  country_id, currency_code, currency_symbol, is_default,
  display_enabled, transaction_enabled, settlement_enabled
)
select c.id, seed.currency_code, seed.currency_symbol, seed.is_default,
       seed.display_enabled, seed.transaction_enabled, seed.settlement_enabled
from (
  values
    ('TR', 'TRY', '₺', true, true, true, true),
    ('TR', 'USD', '$', false, true, false, false),
    ('TR', 'EUR', '€', false, true, false, false),
    ('AZ', 'AZN', '₼', true, true, false, false),
    ('AZ', 'USD', '$', false, true, false, false),
    ('AZ', 'EUR', '€', false, true, false, false),
    ('KZ', 'KZT', '₸', true, false, false, false),
    ('KZ', 'USD', '$', false, false, false, false),
    ('KZ', 'EUR', '€', false, false, false, false),
    ('UZ', 'UZS', 'soʻm', true, false, false, false),
    ('UZ', 'USD', '$', false, false, false, false),
    ('UZ', 'EUR', '€', false, false, false, false),
    ('KG', 'KGS', 'сом', true, false, false, false),
    ('KG', 'USD', '$', false, false, false, false),
    ('KG', 'EUR', '€', false, false, false, false)
) as seed(country_code, currency_code, currency_symbol, is_default, display_enabled, transaction_enabled, settlement_enabled)
join public.countries c on c.country_code = seed.country_code
on conflict (country_id, currency_code) do nothing;

insert into public.country_modules (
  country_id, module_key, enabled, beta, public_visible,
  partner_registration_enabled, transaction_enabled, configuration
)
select c.id, m.module_key, false, false, false, false, false,
       '{"enforcement_mode":"shadow"}'::jsonb
from public.countries c
cross join (
  values ('shop'), ('food'), ('market'), ('services'), ('logistics'), ('career'),
         ('maritime'), ('travel'), ('b2b'), ('events'), ('opportunities'),
         ('partners'), ('turkic_world')
) as m(module_key)
on conflict (country_id, module_key) do nothing;

update public.country_modules cm
set enabled = true,
    public_visible = true,
    partner_registration_enabled = cm.module_key = 'shop',
    transaction_enabled = false,
    configuration = cm.configuration || '{"inherits_legacy_behavior":true,"enforced_by_country_engine":false}'::jsonb
from public.countries c
where cm.country_id = c.id
  and c.country_code = 'TR'
  and cm.module_key in ('shop', 'food', 'market', 'maritime', 'career', 'travel', 'logistics', 'turkic_world')
  and cm.approval_reference is null
  and not (cm.configuration ? 'inherits_legacy_behavior');

update public.country_modules cm
set enabled = true,
    beta = false,
    public_visible = false,
    partner_registration_enabled = false,
    transaction_enabled = false,
    configuration = cm.configuration || '{"roadmap_only":true}'::jsonb
from public.countries c
where cm.country_id = c.id
  and c.country_code = 'AZ'
  and cm.module_key = 'shop'
  and cm.approval_reference is null
  and not (cm.configuration ? 'roadmap_only');

insert into public.tax_rule_sets (
  country_id, rule_key, version, status, transaction_scope, rules
)
select id, 'legacy_tr_passthrough', '1', 'draft', 'all',
       '{"mode":"inherit_existing_logic","enforced":false,"requires_legal_review":true}'::jsonb
from public.countries
where country_code = 'TR'
on conflict (country_id, rule_key, version) do nothing;

insert into public.country_reward_policies (
  country_id, policy_status, earning_rules, spending_rules, campaign_rules,
  expiry_rules, transfer_eligible, cross_border_redemption_enabled, cashout_enabled
)
select id,
       case when country_code = 'TR' then 'shadow' else 'planned' end,
       '{"mode":"inherit_existing_hp_rules","enforced":false}'::jsonb,
       '{"mode":"inherit_existing_hp_rules","enforced":false}'::jsonb,
       '{}'::jsonb,
       '{}'::jsonb,
       false,
       false,
       false
from public.countries
on conflict (country_id) do nothing;

alter table public.countries enable row level security;
alter table public.country_languages enable row level security;
alter table public.country_currencies enable row level security;
alter table public.country_modules enable row level security;
alter table public.integration_provider_definitions enable row level security;
alter table public.country_provider_assignments enable row level security;
alter table public.tax_rule_sets enable row level security;
alter table public.compliance_rule_sets enable row level security;
alter table public.country_reward_policies enable row level security;
alter table public.user_country_profiles enable row level security;
alter table public.legal_document_versions enable row level security;
alter table public.user_legal_acceptances enable row level security;
alter table public.partner_passports enable row level security;
alter table public.partner_country_approvals enable row level security;
alter table public.partner_verification_reviews enable row level security;
alter table public.country_configuration_events enable row level security;

drop policy if exists "countries_admin_read" on public.countries;
create policy "countries_admin_read" on public.countries
  for select to authenticated using (public.is_admin());
drop policy if exists "country_languages_admin_read" on public.country_languages;
create policy "country_languages_admin_read" on public.country_languages
  for select to authenticated using (public.is_admin());
drop policy if exists "country_currencies_admin_read" on public.country_currencies;
create policy "country_currencies_admin_read" on public.country_currencies
  for select to authenticated using (public.is_admin());
drop policy if exists "country_modules_admin_read" on public.country_modules;
create policy "country_modules_admin_read" on public.country_modules
  for select to authenticated using (public.is_admin());
drop policy if exists "integration_provider_definitions_admin_read" on public.integration_provider_definitions;
create policy "integration_provider_definitions_admin_read" on public.integration_provider_definitions
  for select to authenticated using (public.is_admin());
drop policy if exists "country_provider_assignments_admin_read" on public.country_provider_assignments;
create policy "country_provider_assignments_admin_read" on public.country_provider_assignments
  for select to authenticated using (public.is_admin());
drop policy if exists "tax_rule_sets_admin_read" on public.tax_rule_sets;
create policy "tax_rule_sets_admin_read" on public.tax_rule_sets
  for select to authenticated using (public.is_admin());
drop policy if exists "compliance_rule_sets_admin_read" on public.compliance_rule_sets;
create policy "compliance_rule_sets_admin_read" on public.compliance_rule_sets
  for select to authenticated using (public.is_admin());
drop policy if exists "country_reward_policies_admin_read" on public.country_reward_policies;
create policy "country_reward_policies_admin_read" on public.country_reward_policies
  for select to authenticated using (public.is_admin());

drop policy if exists "user_country_profiles_own_select" on public.user_country_profiles;
create policy "user_country_profiles_own_select" on public.user_country_profiles
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "user_country_profiles_own_insert" on public.user_country_profiles;
create policy "user_country_profiles_own_insert" on public.user_country_profiles
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "user_country_profiles_own_update" on public.user_country_profiles;
create policy "user_country_profiles_own_update" on public.user_country_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "user_country_profiles_own_delete" on public.user_country_profiles;
create policy "user_country_profiles_own_delete" on public.user_country_profiles
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "legal_document_versions_active_read" on public.legal_document_versions;
create policy "legal_document_versions_active_read" on public.legal_document_versions
  for select to anon, authenticated
  using (status = 'active' and effective_at is not null and effective_at <= now());
drop policy if exists "legal_document_versions_admin_read" on public.legal_document_versions;
create policy "legal_document_versions_admin_read" on public.legal_document_versions
  for select to authenticated using (public.is_admin());

drop policy if exists "user_legal_acceptances_own_select" on public.user_legal_acceptances;
create policy "user_legal_acceptances_own_select" on public.user_legal_acceptances
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "user_legal_acceptances_own_insert" on public.user_legal_acceptances;
create policy "user_legal_acceptances_own_insert" on public.user_legal_acceptances
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "partner_passports_member_read" on public.partner_passports;
create policy "partner_passports_member_read" on public.partner_passports
  for select to authenticated
  using (public.partner_member_has_access(partner_id));
drop policy if exists "partner_country_approvals_member_read" on public.partner_country_approvals;
create policy "partner_country_approvals_member_read" on public.partner_country_approvals
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.partner_passports pp
      where pp.id = partner_country_approvals.partner_passport_id
        and public.partner_member_has_access(pp.partner_id)
    )
  );
drop policy if exists "partner_verification_reviews_member_read" on public.partner_verification_reviews;
create policy "partner_verification_reviews_member_read" on public.partner_verification_reviews
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.partner_passports pp
      where pp.id = partner_verification_reviews.partner_passport_id
        and public.partner_member_has_access(pp.partner_id)
    )
  );
drop policy if exists "country_configuration_events_admin_read" on public.country_configuration_events;
create policy "country_configuration_events_admin_read" on public.country_configuration_events
  for select to authenticated using (public.is_admin());

comment on table public.countries is
  'Central country configuration. Existing production behavior remains outside this engine until explicit enforcement is enabled.';
comment on table public.user_country_profiles is
  'Country-specific attributes linked to one global Supabase Auth identity. Payment preferences must never contain raw card data.';
comment on table public.partner_passports is
  'One global partner identity; selling or serving a country still requires a separate partner_country_approvals row.';
comment on table public.country_provider_assignments is
  'Provider routing metadata only. credential_reference may point to a vault entry; raw credentials are forbidden.';
comment on table public.country_reward_policies is
  'HP remains a loyalty/reward unit. Cross-border redemption, transfer and cashout are disabled by default.';
comment on table public.user_legal_acceptances is
  'Append-oriented evidence of the exact document version accepted by a user. Browser clients cannot update or delete rows.';
