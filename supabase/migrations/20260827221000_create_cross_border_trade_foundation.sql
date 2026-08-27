-- AllonaHub 2030 cross-border, B2B, logistics, translation and impact foundation.
-- All provider-facing records are contracts/configuration only. No customs,
-- government, carrier, payment, fiscal or AI API is called by this migration.

create extension if not exists pgcrypto;

create table if not exists public.trade_corridors (
  id uuid primary key default gen_random_uuid(),
  origin_country_id uuid not null references public.countries(id) on delete cascade,
  destination_country_id uuid not null references public.countries(id) on delete cascade,
  corridor_key text not null unique check (corridor_key ~ '^[A-Z]{2}-[A-Z]{2}$'),
  status text not null default 'disabled'
    check (status in ('disabled', 'planning', 'integration', 'internal_test', 'beta', 'public')),
  commerce_enabled boolean not null default false,
  b2b_enabled boolean not null default false,
  logistics_enabled boolean not null default false,
  rewards_enabled boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  approval_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origin_country_id <> destination_country_id),
  check (
    not (commerce_enabled or b2b_enabled or logistics_enabled or rewards_enabled)
    or (
      status in ('beta', 'public')
      and nullif(btrim(approval_reference), '') is not null
    )
  )
);

create table if not exists public.exchange_rate_snapshots (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  quote_currency text not null check (quote_currency ~ '^[A-Z]{3}$'),
  exchange_rate numeric(30,12) not null check (exchange_rate > 0),
  source text not null,
  source_reference text,
  observed_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check (base_currency <> quote_currency)
);

create table if not exists public.product_trade_profiles (
  product_id uuid primary key references public.products(id) on delete cascade,
  origin_country_id uuid references public.countries(id) on delete set null,
  manufacturer_country_id uuid references public.countries(id) on delete set null,
  export_status text not null default 'not_assessed'
    check (export_status in ('not_assessed', 'review', 'eligible', 'restricted', 'prohibited')),
  customs_classification text,
  export_document_requirements jsonb not null default '[]'::jsonb,
  restricted_product_status text not null default 'not_assessed'
    check (restricted_product_status in ('not_assessed', 'review', 'clear', 'restricted', 'prohibited')),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_country_availability (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  country_id uuid not null references public.countries(id) on delete cascade,
  availability_status text not null default 'unavailable'
    check (availability_status in ('unavailable', 'review', 'coming_soon', 'available', 'suspended', 'prohibited')),
  public_visible boolean not null default false,
  transaction_enabled boolean not null default false,
  local_currency text check (local_currency is null or local_currency ~ '^[A-Z]{3}$'),
  local_price numeric(18,4) check (local_price is null or local_price >= 0),
  price_source text,
  shipping_configuration jsonb not null default '{}'::jsonb,
  restriction_configuration jsonb not null default '{}'::jsonb,
  approval_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, country_id),
  check (not transaction_enabled or (public_visible and availability_status = 'available')),
  check (not public_visible or availability_status in ('coming_soon', 'available'))
);

create table if not exists public.order_currency_snapshots (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade unique,
  transaction_currency text not null check (transaction_currency ~ '^[A-Z]{3}$'),
  settlement_currency text not null check (settlement_currency ~ '^[A-Z]{3}$'),
  exchange_rate numeric(30,12) not null check (exchange_rate > 0),
  exchange_rate_source text not null,
  exchange_rate_timestamp timestamptz not null,
  original_amount numeric(18,4) not null check (original_amount >= 0),
  converted_amount numeric(18,4) not null check (converted_amount >= 0),
  exchange_rate_snapshot_id uuid references public.exchange_rate_snapshots(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.cross_border_order_contexts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade unique,
  origin_country_id uuid not null references public.countries(id) on delete restrict,
  destination_country_id uuid not null references public.countries(id) on delete restrict,
  corridor_id uuid references public.trade_corridors(id) on delete set null,
  transaction_type text not null default 'b2c'
    check (transaction_type in ('b2c', 'b2b', 'service')),
  customs_status text not null default 'not_required_or_not_assessed'
    check (customs_status in ('not_required_or_not_assessed', 'review', 'documents_required', 'submitted', 'cleared', 'held', 'rejected')),
  tax_status text not null default 'not_assessed'
    check (tax_status in ('not_assessed', 'review', 'calculated', 'confirmed', 'blocked')),
  compliance_status text not null default 'not_assessed'
    check (compliance_status in ('not_assessed', 'review', 'approved', 'blocked')),
  return_configuration_snapshot jsonb not null default '{}'::jsonb,
  delivery_estimate_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origin_country_id <> destination_country_id)
);

create table if not exists public.country_restricted_product_rules (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  direction text not null default 'both'
    check (direction in ('import', 'export', 'both')),
  category_key text,
  product_attribute_match jsonb not null default '{}'::jsonb,
  rule_status text not null default 'draft'
    check (rule_status in ('draft', 'legal_review', 'active', 'retired')),
  decision text not null default 'review'
    check (decision in ('allow', 'review', 'restrict', 'prohibit')),
  requirements jsonb not null default '{}'::jsonb,
  source_reference text,
  approval_reference text,
  effective_from timestamptz,
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.localized_content (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null
    check (entity_type in ('product', 'partner', 'trade_request', 'trade_offer', 'message', 'job', 'event', 'opportunity')),
  entity_id text not null,
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  source_language text not null check (source_language ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  target_language text not null check (target_language ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  original_content text not null,
  original_content_hash text not null check (original_content_hash ~ '^[a-f0-9]{64}$'),
  translated_content text not null,
  provider_key text,
  provider_reference text,
  status text not null default 'machine_draft'
    check (status in ('machine_draft', 'human_review', 'approved', 'rejected', 'stale')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id, field_key, source_language, target_language, original_content_hash),
  check (source_language <> target_language)
);

create table if not exists public.translation_jobs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  field_key text not null,
  source_language text not null,
  target_language text not null,
  original_content_hash text not null,
  provider_key text,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  error_code text,
  error_message text,
  scheduled_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.trade_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique default ('TRQ-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  buyer_partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  origin_country_id uuid not null references public.countries(id) on delete restrict,
  category text not null,
  request_type text not null
    check (request_type in ('buy', 'source_supplier', 'find_distributor', 'find_manufacturer', 'service', 'logistics', 'partnership')),
  title text not null,
  description text not null,
  quantity numeric(18,4) check (quantity is null or quantity > 0),
  quantity_unit text,
  budget_min numeric(18,4) check (budget_min is null or budget_min >= 0),
  budget_max numeric(18,4) check (budget_max is null or budget_max >= 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  deadline date,
  verification_required boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft', 'review', 'published', 'paused', 'matched', 'closed', 'rejected', 'expired')),
  compliance_status text not null default 'not_assessed'
    check (compliance_status in ('not_assessed', 'review', 'approved', 'blocked')),
  metadata jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (budget_min is null or budget_max is null or budget_max >= budget_min),
  check (
    status not in ('published', 'matched')
    or (published_at is not null and compliance_status = 'approved')
  )
);

create table if not exists public.trade_request_target_countries (
  trade_request_id uuid not null references public.trade_requests(id) on delete cascade,
  country_id uuid not null references public.countries(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (trade_request_id, country_id)
);

create table if not exists public.trade_offers (
  id uuid primary key default gen_random_uuid(),
  offer_no text not null unique default ('TRO-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  trade_request_id uuid not null references public.trade_requests(id) on delete cascade,
  offering_partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  description text not null,
  quantity numeric(18,4) check (quantity is null or quantity > 0),
  unit text,
  unit_price numeric(18,4) check (unit_price is null or unit_price >= 0),
  total_amount numeric(18,4) check (total_amount is null or total_amount >= 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  delivery_terms text,
  estimated_delivery jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  verification_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'under_review', 'accepted', 'rejected', 'withdrawn', 'expired')),
  metadata jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trade_request_id, offering_partner_id),
  check (status not in ('submitted', 'under_review', 'accepted', 'rejected') or submitted_at is not null),
  check (status not in ('accepted', 'rejected') or decided_at is not null)
);

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  shipment_no text not null unique default ('SHP-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  order_id uuid references public.orders(id) on delete set null,
  partner_id uuid references public.partner_businesses(id) on delete set null,
  origin_country_id uuid not null references public.countries(id) on delete restrict,
  destination_country_id uuid not null references public.countries(id) on delete restrict,
  provider_key text,
  carrier text,
  service text,
  tracking_number text,
  tracking_url text,
  customs_status text not null default 'not_required_or_not_assessed'
    check (customs_status in ('not_required_or_not_assessed', 'documents_required', 'submitted', 'in_clearance', 'cleared', 'held', 'rejected')),
  status text not null default 'draft'
    check (status in ('draft', 'quoted', 'booked', 'picked_up', 'in_transit', 'customs', 'out_for_delivery', 'delivered', 'exception', 'returned', 'cancelled')),
  estimated_delivery timestamptz,
  actual_delivery timestamptz,
  quote_snapshot jsonb not null default '{}'::jsonb,
  customs_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origin_country_id <> destination_country_id)
);

create table if not exists public.compliance_assessments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null
    check (entity_type in ('product', 'order', 'partner', 'trade_request', 'trade_offer', 'shipment')),
  entity_id text not null,
  country_id uuid references public.countries(id) on delete set null,
  corridor_id uuid references public.trade_corridors(id) on delete set null,
  assessment_type text not null
    check (assessment_type in ('privacy', 'kyc', 'aml', 'sanctions', 'restricted_product', 'age', 'consumer', 'tax', 'customs', 'seller')),
  decision text not null default 'not_assessed'
    check (decision in ('not_assessed', 'review', 'approved', 'blocked', 'not_applicable')),
  rule_set_id uuid references public.compliance_rule_sets(id) on delete set null,
  evidence jsonb not null default '{}'::jsonb,
  decision_reason text,
  provider_reference text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_api_clients (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.partner_businesses(id) on delete cascade,
  client_key text not null unique default ('cli_' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 24))),
  display_name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'revoked')),
  scopes text[] not null default '{}'::text[],
  allowed_country_codes text[] not null default '{}'::text[],
  rate_limit_per_minute integer not null default 60 check (rate_limit_per_minute between 1 and 10000),
  credential_reference text,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  api_client_id uuid not null references public.integration_api_clients(id) on delete cascade,
  endpoint_url text not null,
  event_types text[] not null default '{}'::text[],
  signing_secret_reference text,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'disabled')),
  failure_count integer not null default 0 check (failure_count >= 0),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.integration_webhook_endpoints(id) on delete cascade,
  event_type text not null,
  event_id text not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'delivered', 'failed', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  response_status integer,
  response_summary text,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (endpoint_id, event_id)
);

create table if not exists public.impact_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null check (metric_key ~ '^[a-z][a-z0-9_.-]{1,99}$'),
  country_id uuid references public.countries(id) on delete set null,
  corridor_id uuid references public.trade_corridors(id) on delete set null,
  period_start date not null,
  period_end date not null,
  numeric_value numeric(30,6) not null,
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  unit text not null default 'count',
  data_source text not null,
  aggregation_method text not null,
  verification_status text not null default 'draft'
    check (verification_status in ('draft', 'review', 'verified', 'published', 'rejected')),
  contains_personal_data boolean not null default false,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  check (verification_status <> 'published' or (verified_at is not null and published_at is not null)),
  check (verification_status <> 'published' or contains_personal_data = false),
  unique nulls not distinct (metric_key, country_id, corridor_id, period_start, period_end, currency)
);

-- Optional country context for installations that already have an HP ledger.
-- Some legacy production schemas store HP only on profiles, so the foundation
-- must not invent or replace a ledger. Re-running this migration after a real
-- hp_ledger is introduced will create the context table safely.
do $$
begin
  if to_regclass('public.hp_ledger') is not null then
    execute $ddl$
      create table if not exists public.hp_ledger_country_contexts (
        hp_ledger_id uuid primary key references public.hp_ledger(id) on delete cascade,
        earning_country_id uuid references public.countries(id) on delete set null,
        spending_country_id uuid references public.countries(id) on delete set null,
        cross_border_redemption boolean not null default false,
        policy_snapshot jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        check (not cross_border_redemption or (earning_country_id is not null and spending_country_id is not null))
      )
    $ddl$;
  end if;
end $$;

create index if not exists trade_corridors_status_idx
  on public.trade_corridors(status, origin_country_id, destination_country_id);
create index if not exists exchange_rate_snapshots_pair_idx
  on public.exchange_rate_snapshots(base_currency, quote_currency, observed_at desc);
create index if not exists product_country_availability_country_idx
  on public.product_country_availability(country_id, availability_status, public_visible, product_id);
create index if not exists cross_border_order_contexts_corridor_idx
  on public.cross_border_order_contexts(corridor_id, created_at desc);
create index if not exists restricted_product_rules_country_idx
  on public.country_restricted_product_rules(country_id, rule_status, direction, category_key);
create index if not exists localized_content_lookup_idx
  on public.localized_content(entity_type, entity_id, field_key, target_language, status);
create index if not exists translation_jobs_queue_idx
  on public.translation_jobs(status, scheduled_at)
  where status in ('queued', 'failed');
create index if not exists trade_requests_discovery_idx
  on public.trade_requests(status, origin_country_id, category, published_at desc);
create index if not exists trade_request_targets_country_idx
  on public.trade_request_target_countries(country_id, trade_request_id);
create index if not exists trade_offers_request_idx
  on public.trade_offers(trade_request_id, status, created_at desc);
create index if not exists shipments_order_idx
  on public.shipments(order_id, created_at desc);
create index if not exists shipments_corridor_idx
  on public.shipments(origin_country_id, destination_country_id, status, created_at desc);
create index if not exists compliance_assessments_entity_idx
  on public.compliance_assessments(entity_type, entity_id, assessment_type, created_at desc);
create index if not exists integration_api_clients_partner_idx
  on public.integration_api_clients(partner_id, status, created_at desc);
create index if not exists webhook_deliveries_queue_idx
  on public.integration_webhook_deliveries(status, next_attempt_at, created_at)
  where status in ('queued', 'failed');
create index if not exists impact_metric_snapshots_public_idx
  on public.impact_metric_snapshots(verification_status, metric_key, period_end desc)
  where verification_status = 'published';

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'trade_corridors', 'product_trade_profiles', 'product_country_availability',
    'cross_border_order_contexts', 'country_restricted_product_rules',
    'localized_content', 'trade_requests', 'trade_offers', 'shipments',
    'compliance_assessments', 'integration_api_clients',
    'integration_webhook_endpoints', 'impact_metric_snapshots'
  ] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_country_engine_updated_at()',
      table_name,
      table_name
    );
  end loop;
end $$;

create or replace function public.prevent_exchange_rate_snapshot_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Exchange-rate snapshots are immutable';
end;
$$;

drop trigger if exists exchange_rate_snapshots_immutable on public.exchange_rate_snapshots;
create trigger exchange_rate_snapshots_immutable
  before update or delete on public.exchange_rate_snapshots
  for each row execute function public.prevent_exchange_rate_snapshot_mutation();

create or replace function public.prevent_order_currency_snapshot_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Order currency snapshots are immutable';
end;
$$;

drop trigger if exists order_currency_snapshots_immutable on public.order_currency_snapshots;
create trigger order_currency_snapshots_immutable
  before update on public.order_currency_snapshots
  for each row execute function public.prevent_order_currency_snapshot_update();

create or replace function public.guard_published_impact_snapshot()
returns trigger
language plpgsql
as $$
begin
  if old.verification_status = 'published'
    and (to_jsonb(new) - 'updated_at') <> (to_jsonb(old) - 'updated_at') then
    raise exception 'Published impact evidence is immutable; publish a correction snapshot';
  end if;
  return new;
end;
$$;

drop trigger if exists impact_metric_snapshots_published_guard on public.impact_metric_snapshots;
create trigger impact_metric_snapshots_published_guard
  before update on public.impact_metric_snapshots
  for each row execute function public.guard_published_impact_snapshot();

create or replace function public.guard_trade_request_partner_state()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  privileged boolean := public.is_admin()
    or coalesce(auth.role(), '') = 'service_role'
    or current_setting('request.jwt.claim.role', true) = 'service_role';
begin
  if privileged then return new; end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.compliance_status <> 'not_assessed' or new.published_at is not null then
      raise exception 'Trade request must enter through draft review';
    end if;
    return new;
  end if;

  if new.compliance_status is distinct from old.compliance_status
    or new.published_at is distinct from old.published_at then
    raise exception 'Trade request compliance and publication are admin-controlled';
  end if;
  if new.buyer_partner_id is distinct from old.buyer_partner_id
    or new.created_by is distinct from old.created_by then
    raise exception 'Trade request ownership is immutable';
  end if;
  if new.status not in ('draft', 'review', 'paused', 'closed') then
    raise exception 'Trade request state requires admin approval';
  end if;
  if old.status in ('published', 'matched', 'closed', 'rejected', 'expired')
    and new.status is distinct from old.status then
    raise exception 'Published or decided trade request requires admin workflow';
  end if;
  if old.status = 'draft' and new.status not in ('draft', 'review', 'closed') then
    raise exception 'Draft trade request transition is not allowed';
  end if;
  if old.status = 'review' and new.status not in ('draft', 'review', 'paused', 'closed') then
    raise exception 'Review trade request transition is not allowed';
  end if;
  if old.status = 'paused' and new.status not in ('review', 'paused', 'closed') then
    raise exception 'Paused trade request transition is not allowed';
  end if;
  return new;
end;
$$;

drop trigger if exists trade_requests_partner_state_guard on public.trade_requests;
create trigger trade_requests_partner_state_guard
  before insert or update on public.trade_requests
  for each row execute function public.guard_trade_request_partner_state();

create or replace function public.guard_trade_request_target_state()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  privileged boolean := public.is_admin()
    or coalesce(auth.role(), '') = 'service_role'
    or current_setting('request.jwt.claim.role', true) = 'service_role';
  parent_status text;
  request_id uuid;
begin
  if privileged then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'DELETE' then
    request_id := old.trade_request_id;
  else
    request_id := new.trade_request_id;
  end if;

  select status into parent_status
  from public.trade_requests
  where id = request_id;

  if parent_status is null or parent_status not in ('draft', 'review', 'paused') then
    raise exception 'Published or decided trade request targets are admin-controlled';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists trade_request_targets_state_guard on public.trade_request_target_countries;
create trigger trade_request_targets_state_guard
  before insert or update or delete on public.trade_request_target_countries
  for each row execute function public.guard_trade_request_target_state();

create or replace function public.guard_trade_offer_party_state()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  privileged boolean := public.is_admin()
    or coalesce(auth.role(), '') = 'service_role'
    or current_setting('request.jwt.claim.role', true) = 'service_role';
  offerer_access boolean;
  buyer_access boolean;
begin
  if privileged then return new; end if;
  offerer_access := public.partner_member_has_access(new.offering_partner_id);
  select public.partner_member_has_access(tr.buyer_partner_id)
    into buyer_access
  from public.trade_requests tr
  where tr.id = new.trade_request_id;

  if tg_op = 'INSERT' then
    if not offerer_access or new.status not in ('draft', 'submitted') then
      raise exception 'Trade offer must be created by the offering partner';
    end if;
    return new;
  end if;

  if buyer_access and not offerer_access then
    if old.status not in ('submitted', 'under_review') then
      raise exception 'Only a submitted offer can be reviewed or decided';
    end if;
    if new.status not in ('under_review', 'accepted', 'rejected') then
      raise exception 'Buyer may only decide the offer';
    end if;
    if (to_jsonb(new) - array['status', 'decided_at', 'updated_at'])
       <> (to_jsonb(old) - array['status', 'decided_at', 'updated_at']) then
      raise exception 'Buyer cannot rewrite offer commercial fields';
    end if;
    return new;
  end if;

  if offerer_access then
    if old.status in ('accepted', 'rejected', 'withdrawn', 'expired') then
      raise exception 'Decided or withdrawn trade offer is immutable';
    end if;
    if old.status = 'draft' and new.status not in ('draft', 'submitted', 'withdrawn') then
      raise exception 'Offering partner cannot accept or reject its own offer';
    end if;
    if old.status in ('submitted', 'under_review') then
      if new.status <> 'withdrawn' then
        raise exception 'Submitted offer may only be withdrawn by the offering partner';
      end if;
      if (to_jsonb(new) - array['status', 'updated_at'])
         <> (to_jsonb(old) - array['status', 'updated_at']) then
        raise exception 'Submitted offer commercial fields are immutable';
      end if;
    end if;
    return new;
  end if;

  raise exception 'Trade offer access denied';
end;
$$;

drop trigger if exists trade_offers_party_state_guard on public.trade_offers;
create trigger trade_offers_party_state_guard
  before insert or update on public.trade_offers
  for each row execute function public.guard_trade_offer_party_state();

-- Add nullable snapshots to legacy orders for query compatibility. No existing
-- amount is converted or backfilled, so historical prices cannot be rewritten.
do $$
begin
  if to_regclass('public.orders') is not null then
    alter table public.orders
      add column if not exists transaction_currency text,
      add column if not exists settlement_currency text,
      add column if not exists exchange_rate numeric(30,12),
      add column if not exists exchange_rate_source text,
      add column if not exists exchange_rate_timestamp timestamptz,
      add column if not exists original_amount numeric(18,4),
      add column if not exists converted_amount numeric(18,4);

    if not exists (
      select 1 from pg_constraint
      where conname = 'orders_currency_snapshot_valid'
        and conrelid = 'public.orders'::regclass
    ) then
      alter table public.orders
        add constraint orders_currency_snapshot_valid check (
          (transaction_currency is null or transaction_currency ~ '^[A-Z]{3}$')
          and (settlement_currency is null or settlement_currency ~ '^[A-Z]{3}$')
          and (exchange_rate is null or exchange_rate > 0)
          and (original_amount is null or original_amount >= 0)
          and (converted_amount is null or converted_amount >= 0)
          and (
            (
              transaction_currency is null
              and settlement_currency is null
              and exchange_rate is null
              and exchange_rate_source is null
              and exchange_rate_timestamp is null
              and original_amount is null
              and converted_amount is null
            )
            or (
              transaction_currency is not null
              and settlement_currency is not null
              and exchange_rate is not null
              and nullif(btrim(exchange_rate_source), '') is not null
              and exchange_rate_timestamp is not null
              and original_amount is not null
              and converted_amount is not null
            )
          )
        ) not valid;
    end if;
  end if;

  if to_regclass('public.products') is not null then
    alter table public.products add column if not exists origin_country_code text;
    if not exists (
      select 1 from pg_constraint
      where conname = 'products_origin_country_code_fkey'
        and conrelid = 'public.products'::regclass
    ) then
      alter table public.products
        add constraint products_origin_country_code_fkey
        foreign key (origin_country_code) references public.countries(country_code) not valid;
    end if;
  end if;
end $$;

create or replace function public.guard_legacy_order_currency_snapshot()
returns trigger
language plpgsql
as $$
begin
  if old.transaction_currency is not null and (
    new.transaction_currency is distinct from old.transaction_currency
    or new.settlement_currency is distinct from old.settlement_currency
    or new.exchange_rate is distinct from old.exchange_rate
    or new.exchange_rate_source is distinct from old.exchange_rate_source
    or new.exchange_rate_timestamp is distinct from old.exchange_rate_timestamp
    or new.original_amount is distinct from old.original_amount
    or new.converted_amount is distinct from old.converted_amount
  ) then
    raise exception 'Legacy order currency snapshot fields are immutable after capture';
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.orders') is not null then
    drop trigger if exists orders_currency_snapshot_guard on public.orders;
    create trigger orders_currency_snapshot_guard
      before update on public.orders
      for each row execute function public.guard_legacy_order_currency_snapshot();
  end if;
end $$;

insert into public.trade_corridors (
  origin_country_id, destination_country_id, corridor_key, status,
  commerce_enabled, b2b_enabled, logistics_enabled, rewards_enabled, configuration
)
select origin.id, destination.id, seed.corridor_key, 'planning', false, false, false, false,
       '{"enforcement_mode":"shadow","requires_legal_and_provider_readiness":true}'::jsonb
from (
  values
    ('TR', 'AZ', 'TR-AZ'), ('AZ', 'TR', 'AZ-TR'),
    ('TR', 'KZ', 'TR-KZ'), ('KZ', 'TR', 'KZ-TR'),
    ('TR', 'UZ', 'TR-UZ'), ('UZ', 'TR', 'UZ-TR'),
    ('TR', 'KG', 'TR-KG'), ('KG', 'TR', 'KG-TR')
) as seed(origin_code, destination_code, corridor_key)
join public.countries origin on origin.country_code = seed.origin_code
join public.countries destination on destination.country_code = seed.destination_code
on conflict (corridor_key) do nothing;

alter table public.trade_corridors enable row level security;
alter table public.exchange_rate_snapshots enable row level security;
alter table public.product_trade_profiles enable row level security;
alter table public.product_country_availability enable row level security;
alter table public.order_currency_snapshots enable row level security;
alter table public.cross_border_order_contexts enable row level security;
alter table public.country_restricted_product_rules enable row level security;
alter table public.localized_content enable row level security;
alter table public.translation_jobs enable row level security;
alter table public.trade_requests enable row level security;
alter table public.trade_request_target_countries enable row level security;
alter table public.trade_offers enable row level security;
alter table public.shipments enable row level security;
alter table public.compliance_assessments enable row level security;
alter table public.integration_api_clients enable row level security;
alter table public.integration_webhook_endpoints enable row level security;
alter table public.integration_webhook_deliveries enable row level security;
alter table public.impact_metric_snapshots enable row level security;
do $$
begin
  if to_regclass('public.hp_ledger_country_contexts') is not null then
    execute 'alter table public.hp_ledger_country_contexts enable row level security';
  end if;
end $$;

drop policy if exists "trade_corridors_admin_read" on public.trade_corridors;
create policy "trade_corridors_admin_read" on public.trade_corridors
  for select to authenticated using (public.is_admin());
drop policy if exists "exchange_rate_snapshots_admin_read" on public.exchange_rate_snapshots;
create policy "exchange_rate_snapshots_admin_read" on public.exchange_rate_snapshots
  for select to authenticated using (public.is_admin());
drop policy if exists "product_trade_profiles_partner_read" on public.product_trade_profiles;
create policy "product_trade_profiles_partner_read" on public.product_trade_profiles
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_trade_profiles.product_id
        and (p.partner_id::text = auth.uid()::text or p.partner_id is null)
    )
  );
drop policy if exists "product_country_availability_public_read" on public.product_country_availability;
create policy "product_country_availability_public_read" on public.product_country_availability
  for select to anon, authenticated
  using (public_visible and availability_status in ('coming_soon', 'available'));
drop policy if exists "product_country_availability_admin_read" on public.product_country_availability;
create policy "product_country_availability_admin_read" on public.product_country_availability
  for select to authenticated using (public.is_admin());

drop policy if exists "order_currency_snapshots_order_read" on public.order_currency_snapshots;
create policy "order_currency_snapshots_order_read" on public.order_currency_snapshots
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_currency_snapshots.order_id and o.user_id = auth.uid()
    )
  );
drop policy if exists "cross_border_order_contexts_order_read" on public.cross_border_order_contexts;
create policy "cross_border_order_contexts_order_read" on public.cross_border_order_contexts
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = cross_border_order_contexts.order_id and o.user_id = auth.uid()
    )
  );
drop policy if exists "restricted_product_rules_admin_read" on public.country_restricted_product_rules;
create policy "restricted_product_rules_admin_read" on public.country_restricted_product_rules
  for select to authenticated using (public.is_admin());

drop policy if exists "localized_content_admin_read" on public.localized_content;
create policy "localized_content_admin_read" on public.localized_content
  for select to authenticated using (public.is_admin());
drop policy if exists "translation_jobs_admin_read" on public.translation_jobs;
create policy "translation_jobs_admin_read" on public.translation_jobs
  for select to authenticated using (public.is_admin());

drop policy if exists "trade_requests_network_read" on public.trade_requests;
create policy "trade_requests_network_read" on public.trade_requests
  for select to authenticated
  using (
    status = 'published'
    or public.partner_member_has_access(buyer_partner_id)
    or public.is_admin()
  );
drop policy if exists "trade_requests_partner_insert" on public.trade_requests;
create policy "trade_requests_partner_insert" on public.trade_requests
  for insert to authenticated
  with check (public.partner_member_has_access(buyer_partner_id) and created_by = auth.uid());
drop policy if exists "trade_requests_partner_update" on public.trade_requests;
create policy "trade_requests_partner_update" on public.trade_requests
  for update to authenticated
  using (public.partner_member_has_access(buyer_partner_id))
  with check (public.partner_member_has_access(buyer_partner_id));

drop policy if exists "trade_request_targets_network_read" on public.trade_request_target_countries;
create policy "trade_request_targets_network_read" on public.trade_request_target_countries
  for select to authenticated
  using (
    exists (
      select 1 from public.trade_requests tr
      where tr.id = trade_request_target_countries.trade_request_id
        and (tr.status = 'published' or public.partner_member_has_access(tr.buyer_partner_id) or public.is_admin())
    )
  );
drop policy if exists "trade_request_targets_buyer_write" on public.trade_request_target_countries;
create policy "trade_request_targets_buyer_write" on public.trade_request_target_countries
  for all to authenticated
  using (
    exists (
      select 1 from public.trade_requests tr
      where tr.id = trade_request_target_countries.trade_request_id
        and public.partner_member_has_access(tr.buyer_partner_id)
    )
  )
  with check (
    exists (
      select 1 from public.trade_requests tr
      where tr.id = trade_request_target_countries.trade_request_id
        and public.partner_member_has_access(tr.buyer_partner_id)
    )
  );

drop policy if exists "trade_offers_parties_read" on public.trade_offers;
create policy "trade_offers_parties_read" on public.trade_offers
  for select to authenticated
  using (
    public.partner_member_has_access(offering_partner_id)
    or exists (
      select 1 from public.trade_requests tr
      where tr.id = trade_offers.trade_request_id
        and public.partner_member_has_access(tr.buyer_partner_id)
    )
    or public.is_admin()
  );
drop policy if exists "trade_offers_partner_insert" on public.trade_offers;
create policy "trade_offers_partner_insert" on public.trade_offers
  for insert to authenticated
  with check (public.partner_member_has_access(offering_partner_id) and created_by = auth.uid());
drop policy if exists "trade_offers_partner_update" on public.trade_offers;
create policy "trade_offers_partner_update" on public.trade_offers
  for update to authenticated
  using (public.partner_member_has_access(offering_partner_id))
  with check (public.partner_member_has_access(offering_partner_id));
drop policy if exists "trade_offers_buyer_decision_update" on public.trade_offers;
create policy "trade_offers_buyer_decision_update" on public.trade_offers
  for update to authenticated
  using (
    exists (
      select 1 from public.trade_requests tr
      where tr.id = trade_offers.trade_request_id
        and public.partner_member_has_access(tr.buyer_partner_id)
    )
  )
  with check (
    exists (
      select 1 from public.trade_requests tr
      where tr.id = trade_offers.trade_request_id
        and public.partner_member_has_access(tr.buyer_partner_id)
    )
  );

drop policy if exists "shipments_authorized_read" on public.shipments;
create policy "shipments_authorized_read" on public.shipments
  for select to authenticated
  using (
    public.is_admin()
    or (partner_id is not null and public.partner_member_has_access(partner_id))
    or exists (select 1 from public.orders o where o.id = shipments.order_id and o.user_id = auth.uid())
  );
drop policy if exists "compliance_assessments_admin_read" on public.compliance_assessments;
create policy "compliance_assessments_admin_read" on public.compliance_assessments
  for select to authenticated using (public.is_admin());

drop policy if exists "integration_api_clients_member_read" on public.integration_api_clients;
create policy "integration_api_clients_member_read" on public.integration_api_clients
  for select to authenticated
  using (public.is_admin() or (partner_id is not null and public.partner_member_has_access(partner_id)));
drop policy if exists "integration_webhook_endpoints_member_read" on public.integration_webhook_endpoints;
create policy "integration_webhook_endpoints_member_read" on public.integration_webhook_endpoints
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.integration_api_clients c
      where c.id = integration_webhook_endpoints.api_client_id
        and c.partner_id is not null
        and public.partner_member_has_access(c.partner_id)
    )
  );
drop policy if exists "integration_webhook_deliveries_member_read" on public.integration_webhook_deliveries;
create policy "integration_webhook_deliveries_member_read" on public.integration_webhook_deliveries
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.integration_webhook_endpoints e
      join public.integration_api_clients c on c.id = e.api_client_id
      where e.id = integration_webhook_deliveries.endpoint_id
        and c.partner_id is not null
        and public.partner_member_has_access(c.partner_id)
    )
  );

drop policy if exists "impact_metric_snapshots_public_read" on public.impact_metric_snapshots;
create policy "impact_metric_snapshots_public_read" on public.impact_metric_snapshots
  for select to anon, authenticated
  using (
    verification_status = 'published'
    and published_at is not null
    and published_at <= now()
    and contains_personal_data = false
  );
drop policy if exists "impact_metric_snapshots_admin_read" on public.impact_metric_snapshots;
create policy "impact_metric_snapshots_admin_read" on public.impact_metric_snapshots
  for select to authenticated using (public.is_admin());

do $$
begin
  if to_regclass('public.hp_ledger_country_contexts') is not null then
    execute 'drop policy if exists "hp_ledger_country_contexts_own_read" on public.hp_ledger_country_contexts';
    execute $policy$
      create policy "hp_ledger_country_contexts_own_read" on public.hp_ledger_country_contexts
        for select to authenticated
        using (
          public.is_admin()
          or exists (
            select 1 from public.hp_ledger h
            where h.id = hp_ledger_country_contexts.hp_ledger_id and h.user_id = auth.uid()
          )
        )
    $policy$;
  end if;
end $$;

comment on table public.exchange_rate_snapshots is
  'Immutable provider/source snapshot. Historical orders must never be recalculated with a later rate.';
comment on table public.localized_content is
  'Original content is retained alongside translations. AI output is a draft until its configured review state permits display.';
comment on table public.trade_requests is
  'B2B demand network. Publication does not represent an AllonaHub guarantee, government endorsement or completed transaction.';
comment on table public.shipments is
  'Provider-independent shipment state. Carrier/customs fields are factual records, not simulated integrations.';
comment on table public.impact_metric_snapshots is
  'Aggregate-only impact evidence. Public reads require verified publication and a no-personal-data declaration.';
comment on table public.integration_api_clients is
  'Open Integration Platform client metadata. Raw client secrets are forbidden; only a vault credential reference may be stored.';
