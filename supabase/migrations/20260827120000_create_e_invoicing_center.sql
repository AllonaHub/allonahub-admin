-- AllonaHub central multi-tenant e-transformation and invoicing center.
-- Additive only: no production rows are deleted and no legacy seller is guessed.

create extension if not exists pgcrypto;

-- Supabase RPC/RLS endpoints are public authorization boundaries in their own
-- right. Privileged tenant writes must retain the same AAL2 step-up guarantee
-- as the Fastify routes even when a caller talks to the Data API directly.
create or replace function public.e_invoicing_has_write_assurance()
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce(auth.role(), '') = 'service_role'
    or current_setting('request.jwt.claim.role', true) = 'service_role'
    or public.has_mfa();
$$;

revoke all on function public.e_invoicing_has_write_assurance() from public, anon;
grant execute on function public.e_invoicing_has_write_assurance() to authenticated, service_role;

comment on function public.e_invoicing_has_write_assurance() is
  'Requires an AAL2 user session for privileged e-invoicing tenant writes; service_role remains available to audited backend operations.';

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'viewer'
    check (member_role in ('owner', 'admin', 'finance', 'operator', 'viewer')),
  status text not null default 'active' check (status in ('invited', 'active', 'paused', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create or replace function public.add_organization_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  if new.created_by is not null then
    insert into public.organization_members (organization_id, user_id, member_role, status)
    values (new.id, new.created_by, 'owner', 'active')
    on conflict (organization_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_add_creator_owner on public.organizations;
create trigger organizations_add_creator_owner
  after insert on public.organizations
  for each row execute function public.add_organization_creator_as_owner();

create table if not exists public.legal_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  legal_name text not null,
  display_name text,
  country_code text not null default 'TR' check (char_length(country_code) = 2),
  tax_number text,
  tax_office text,
  mersis_number text,
  billing_address jsonb not null default '{}'::jsonb,
  contact_email text,
  status text not null default 'draft' check (status in ('draft', 'review', 'active', 'paused', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_entity_members (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'viewer'
    check (member_role in ('owner', 'admin', 'finance', 'operator', 'viewer')),
  status text not null default 'active' check (status in ('invited', 'active', 'paused', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (legal_entity_id, user_id)
);

create table if not exists public.seller_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  partner_business_id uuid,
  seller_code text not null,
  display_name text not null,
  status text not null default 'draft' check (status in ('draft', 'review', 'active', 'paused', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, seller_code)
);

do $$
begin
  if to_regclass('public.partner_businesses') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'seller_profiles_partner_business_id_fkey'
         and conrelid = 'public.seller_profiles'::regclass
     ) then
    alter table public.seller_profiles
      add constraint seller_profiles_partner_business_id_fkey
      foreign key (partner_business_id) references public.partner_businesses(id) on delete set null;
  end if;
end $$;

create table if not exists public.sales_channels (
  id uuid primary key default gen_random_uuid(),
  channel_key text not null unique,
  display_name text not null,
  provider_class text not null,
  capabilities jsonb not null default '{}'::jsonb,
  stage text not null default 'skeleton' check (stage in ('local', 'available', 'skeleton', 'disabled')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.sales_channels (channel_key, display_name, provider_class, capabilities, stage)
values
  ('trendyol', 'Trendyol', 'TrendyolProvider', '{"orders":false,"returns":false,"cancellations":false,"invoiceUpload":false,"invoiceMetadata":false,"products":false,"inventory":false,"prices":false}'::jsonb, 'skeleton'),
  ('hepsiburada', 'Hepsiburada', 'HepsiburadaProvider', '{"orders":false,"returns":false,"cancellations":false,"invoiceUpload":false,"invoiceMetadata":false,"products":false,"inventory":false,"prices":false}'::jsonb, 'skeleton'),
  ('n11', 'N11', 'N11Provider', '{"orders":false,"returns":false,"cancellations":false,"invoiceUpload":false,"invoiceMetadata":false,"products":false,"inventory":false,"prices":false}'::jsonb, 'skeleton'),
  ('pazarama', 'Pazarama', 'PazaramaProvider', '{"orders":false,"returns":false,"cancellations":false,"invoiceUpload":false,"invoiceMetadata":false,"products":false,"inventory":false,"prices":false}'::jsonb, 'skeleton'),
  ('ciceksepeti', 'Çiçeksepeti', 'CicekSepetiProvider', '{"orders":false,"returns":false,"cancellations":false,"invoiceUpload":false,"invoiceMetadata":false,"products":false,"inventory":false,"prices":false}'::jsonb, 'skeleton'),
  ('pttavm', 'PTTAVM', 'PttAvmProvider', '{"orders":false,"returns":false,"cancellations":false,"invoiceUpload":false,"invoiceMetadata":false,"products":false,"inventory":false,"prices":false}'::jsonb, 'skeleton'),
  ('shopier', 'Shopier', 'ShopierProvider', '{"orders":false,"returns":false,"cancellations":false,"invoiceUpload":false,"invoiceMetadata":false,"products":false,"inventory":false,"prices":false}'::jsonb, 'skeleton'),
  ('amazon', 'Amazon', 'AmazonProvider', '{"orders":false,"returns":false,"cancellations":false,"invoiceUpload":false,"invoiceMetadata":false,"products":false,"inventory":false,"prices":false}'::jsonb, 'skeleton'),
  ('allonahub', 'AllonaHub Marketplace', 'AllonaHubProvider', '{"orders":false,"returns":false,"cancellations":false,"invoiceUpload":false,"invoiceMetadata":true,"products":false,"inventory":false,"prices":false}'::jsonb, 'local'),
  ('allona_shop', 'Allona Shop', 'AllonaHubProvider', '{"orders":false,"returns":false,"cancellations":false,"invoiceUpload":false,"invoiceMetadata":true,"products":false,"inventory":false,"prices":false}'::jsonb, 'local'),
  ('custom_api', 'Custom API', 'CustomApiProvider', '{"orders":false,"returns":false,"cancellations":false,"invoiceUpload":false,"invoiceMetadata":false,"products":false,"inventory":false,"prices":false}'::jsonb, 'skeleton')
on conflict (channel_key) do nothing;

create table if not exists public.sales_channel_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  seller_id uuid not null references public.seller_profiles(id) on delete restrict,
  sales_channel_id uuid not null references public.sales_channels(id) on delete restrict,
  account_name text not null,
  external_account_id text,
  environment text not null default 'sandbox' check (environment in ('local', 'sandbox', 'production')),
  credential_reference text,
  capability_overrides jsonb not null default '{}'::jsonb,
  sync_settings jsonb not null default '{}'::jsonb,
  status text not null default 'disconnected'
    check (status in ('disconnected', 'pending', 'connected', 'error', 'paused')),
  last_tested_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    credential_reference is null
    or credential_reference ~ '^vault:[A-Za-z0-9_./:-]+$'
    or credential_reference ~ '^(env|secret):INVOICE_[A-Z0-9_]+$'
  )
);

create unique index if not exists sales_channel_accounts_external_unique
  on public.sales_channel_accounts(sales_channel_id, external_account_id)
  where external_account_id is not null;

create table if not exists public.sales_channel_account_members (
  id uuid primary key default gen_random_uuid(),
  sales_channel_account_id uuid not null references public.sales_channel_accounts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'viewer'
    check (member_role in ('owner', 'admin', 'finance', 'operator', 'viewer')),
  status text not null default 'active' check (status in ('invited', 'active', 'paused', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sales_channel_account_id, user_id)
);

create table if not exists public.invoice_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  legal_entity_id uuid not null references public.legal_entities(id) on delete cascade,
  profile_name text not null,
  document_prefix text,
  default_scenario text not null default 'TEMELFATURA',
  default_currency text not null default 'TRY' check (char_length(default_currency) = 3),
  default_unit_code text not null default 'C62',
  tax_configuration jsonb not null default '{}'::jsonb,
  notes text,
  is_default boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'review', 'active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (legal_entity_id, profile_name)
);

create unique index if not exists invoice_profiles_one_default_per_legal_entity
  on public.invoice_profiles(legal_entity_id) where is_default and status = 'active';

create table if not exists public.invoice_provider_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  legal_entity_id uuid not null references public.legal_entities(id) on delete cascade,
  provider_key text not null,
  account_label text not null,
  environment text not null default 'sandbox' check (environment in ('mock', 'sandbox', 'production')),
  credential_reference text,
  capabilities jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'disconnected'
    check (status in ('disconnected', 'pending', 'connected', 'error', 'paused')),
  last_tested_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (legal_entity_id, provider_key, account_label),
  check (
    (provider_key = 'mock' and environment = 'mock' and credential_reference is null)
    or (
      provider_key <> 'mock'
      and environment in ('sandbox', 'production')
      and (
        (status = 'disconnected' and credential_reference is null)
        or credential_reference ~ '^vault:[A-Za-z0-9_./:-]+$'
        or credential_reference ~ '^(env|secret):INVOICE_[A-Z0-9_]+$'
      )
    )
  )
);

-- Secret references are provisioned by a trusted server-side operator and
-- bound to one tenant, integration key and purpose. Browser users cannot
-- register arbitrary environment/vault identifiers.
create table if not exists public.integration_credential_bindings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  legal_entity_id uuid not null references public.legal_entities(id) on delete cascade,
  integration_type text not null check (integration_type in ('invoice_provider', 'sales_channel')),
  integration_key text not null,
  purpose text not null check (purpose in ('api', 'webhook')),
  credential_reference text not null,
  status text not null default 'active' check (status in ('active', 'rotating', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    credential_reference ~ '^vault:[A-Za-z0-9_./:-]+$'
    or credential_reference ~ '^(env|secret):INVOICE_[A-Z0-9_]+$'
  ),
  unique (organization_id, legal_entity_id, integration_type, integration_key, purpose, credential_reference)
);

create index if not exists integration_credential_bindings_lookup_idx
  on public.integration_credential_bindings(
    organization_id, legal_entity_id, integration_type, integration_key, purpose, credential_reference
  ) where status in ('active', 'rotating');

create table if not exists public.invoice_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  legal_entity_id uuid not null references public.legal_entities(id) on delete cascade,
  sales_channel_account_id uuid references public.sales_channel_accounts(id) on delete cascade,
  invoice_profile_id uuid references public.invoice_profiles(id) on delete set null,
  invoice_provider_account_id uuid references public.invoice_provider_accounts(id) on delete set null,
  trigger_event text not null default 'MANUAL'
    check (trigger_event in ('PAYMENT_COMPLETED', 'ORDER_CONFIRMED', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'MANUAL')),
  document_type_fallback text not null default 'MANUAL_REVIEW'
    check (document_type_fallback in ('MANUAL_REVIEW', 'E_INVOICE', 'E_ARCHIVE')),
  retry_delays_seconds integer[] not null default array[60, 300, 900, 3600],
  max_retry_count integer not null default 4 check (max_retry_count between 1 and 20),
  auto_upload_to_channel boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists invoice_settings_scope_unique
  on public.invoice_settings(legal_entity_id, coalesce(sales_channel_account_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists public.customer_invoice_profiles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) on delete cascade default auth.uid(),
  profile_type text not null check (profile_type in ('individual', 'corporate')),
  name text,
  surname text,
  company_name text,
  tax_number text,
  tax_office text,
  billing_address jsonb not null default '{}'::jsonb,
  email text,
  taxpayer_status text not null default 'unknown'
    check (taxpayer_status in ('unknown', 'e_invoice', 'not_e_invoice', 'manual_review')),
  taxpayer_status_source text not null default 'unverified'
    check (taxpayer_status_source in ('unverified', 'provider_query', 'manual_admin')),
  taxpayer_status_checked_at timestamptz,
  taxpayer_status_provider_account_id uuid references public.invoice_provider_accounts(id) on delete set null,
  is_default boolean not null default false,
  status text not null default 'active' check (status in ('active', 'paused', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (profile_type = 'individual' and nullif(trim(coalesce(name, '')), '') is not null)
    or
    (profile_type = 'corporate' and nullif(trim(coalesce(company_name, '')), '') is not null)
  ),
  check (
    (taxpayer_status_source = 'unverified' and taxpayer_status in ('unknown', 'manual_review') and taxpayer_status_checked_at is null and taxpayer_status_provider_account_id is null)
    or (taxpayer_status_source = 'provider_query' and taxpayer_status in ('e_invoice', 'not_e_invoice') and taxpayer_status_checked_at is not null and taxpayer_status_provider_account_id is not null)
    or (taxpayer_status_source = 'manual_admin' and taxpayer_status in ('e_invoice', 'not_e_invoice', 'manual_review') and taxpayer_status_checked_at is not null)
  )
);

create unique index if not exists customer_invoice_profiles_one_default
  on public.customer_invoice_profiles(customer_id) where is_default and status = 'active';

alter table if exists public.orders
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists sales_channel_account_id uuid references public.sales_channel_accounts(id) on delete set null,
  add column if not exists sales_channel text,
  add column if not exists sales_channel_order_id text,
  add column if not exists customer_invoice_profile_id uuid references public.customer_invoice_profiles(id) on delete set null,
  add column if not exists imported_at timestamptz,
  add column if not exists invoice_allocation_status text not null default 'PENDING',
  add column if not exists expected_seller_sub_order_count integer,
  add column if not exists invoice_allocation_completed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_invoice_allocation_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_invoice_allocation_status_check
      check (invoice_allocation_status in ('PENDING', 'COMPLETE', 'NEEDS_REVIEW'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_expected_seller_sub_order_count_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_expected_seller_sub_order_count_check
      check (expected_seller_sub_order_count is null or expected_seller_sub_order_count > 0);
  end if;
end $$;

-- Preserve the legacy delivery-status workflow while making all new financial
-- routing fields server-only. Customer profile attachment is the sole
-- authenticated non-delivery exception and is validated against order owner.
create or replace function public.protect_order_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if new.customer_invoice_profile_id is distinct from old.customer_invoice_profile_id
     and old.user_id = auth.uid()
     and (to_jsonb(new) - array['customer_invoice_profile_id', 'updated_at'])
         = (to_jsonb(old) - array['customer_invoice_profile_id', 'updated_at'])
     and exists (
       select 1 from public.customer_invoice_profiles cip
       where cip.id = new.customer_invoice_profile_id
         and cip.customer_id = auth.uid()
         and cip.status = 'active'
     ) then
    return new;
  end if;

  if not (public.order_has_partner_item(old.id) or public.is_courier_or_admin()) then
    raise exception 'Forbidden order update' using errcode = '42501';
  end if;

  if new.id is distinct from old.id
    or new.order_no is distinct from old.order_no
    or new.order_number is distinct from old.order_number
    or new.user_id is distinct from old.user_id
    or new.address_id is distinct from old.address_id
    or new.customer_name is distinct from old.customer_name
    or new.customer_email is distinct from old.customer_email
    or new.customer_phone is distinct from old.customer_phone
    or new.city is distinct from old.city
    or new.address is distinct from old.address
    or new.subtotal is distinct from old.subtotal
    or new.shipping is distinct from old.shipping
    or new.discount is distinct from old.discount
    or new.total is distinct from old.total
    or new.discount_total is distinct from old.discount_total
    or new.hp_discount is distinct from old.hp_discount
    or new.coupon_discount is distinct from old.coupon_discount
    or new.shipping_total is distinct from old.shipping_total
    or new.grand_total is distinct from old.grand_total
    or new.payment_status is distinct from old.payment_status
    or new.admin_note is distinct from old.admin_note
    or new.fraud_status is distinct from old.fraud_status
    or new.organization_id is distinct from old.organization_id
    or new.sales_channel_account_id is distinct from old.sales_channel_account_id
    or new.sales_channel is distinct from old.sales_channel
    or new.sales_channel_order_id is distinct from old.sales_channel_order_id
    or new.customer_invoice_profile_id is distinct from old.customer_invoice_profile_id
    or new.imported_at is distinct from old.imported_at
    or new.invoice_allocation_status is distinct from old.invoice_allocation_status
    or new.expected_seller_sub_order_count is distinct from old.expected_seller_sub_order_count
    or new.invoice_allocation_completed_at is distinct from old.invoice_allocation_completed_at
  then
    raise exception 'Only delivery status and tracking fields can be updated' using errcode = '42501';
  end if;

  if new.status is distinct from old.status
    and new.status not in ('preparing', 'shipped', 'delivered') then
    raise exception 'Partner status update is not allowed' using errcode = '42501';
  end if;
  if new.order_status is distinct from old.order_status
    and new.order_status not in ('preparing', 'shipped', 'delivered') then
    raise exception 'Partner order status update is not allowed' using errcode = '42501';
  end if;
  if new.partner_status is distinct from old.partner_status
    and coalesce(new.partner_status, '') not in ('preparing', 'shipped', 'delivered') then
    raise exception 'Partner shipment status update is not allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_protect_non_admin_update on public.orders;
create trigger orders_protect_non_admin_update
  before update on public.orders
  for each row execute function public.protect_order_update();

create unique index if not exists orders_channel_external_unique
  on public.orders(sales_channel_account_id, sales_channel_order_id)
  where sales_channel_account_id is not null and sales_channel_order_id is not null;

create table if not exists public.seller_sub_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  seller_id uuid not null references public.seller_profiles(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete cascade,
  sales_channel_account_id uuid references public.sales_channel_accounts(id) on delete set null,
  sub_order_key text not null default 'default',
  external_sub_order_id text,
  currency text not null default 'TRY' check (char_length(currency) = 3),
  subtotal numeric(18,2) not null default 0,
  discount_total numeric(18,2) not null default 0,
  shipping_total numeric(18,2) not null default 0,
  shipping_tax_rate numeric(9,4),
  shipping_tax_amount numeric(18,2),
  tax_total numeric(18,2) not null default 0,
  grand_total numeric(18,2) not null default 0,
  resolution_status text not null default 'NEEDS_REVIEW'
    check (resolution_status in ('RESOLVED', 'NEEDS_REVIEW', 'BLOCKED')),
  resolution_error_code text,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'CONFIRMED', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (shipping_total = 0 and coalesce(shipping_tax_amount, 0) = 0)
    or (shipping_total > 0 and shipping_tax_rate is not null and shipping_tax_amount is not null and shipping_tax_amount >= 0 and shipping_tax_amount <= shipping_total)
  ),
  unique (order_id, seller_id, sub_order_key)
);

-- Durable inbox for lifecycle events. An upstream event is acknowledged only
-- after the complete seller allocation snapshot has been consumed.
create table if not exists public.invoice_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_key text not null,
  event_type text not null
    check (event_type in ('PAYMENT_COMPLETED', 'ORDER_CONFIRMED', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'MANUAL')),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PROCESSING', 'SUCCEEDED', 'NEEDS_REVIEW')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  processing_started_at timestamptz,
  lock_token uuid,
  lock_expires_at timestamptz,
  locked_by text,
  processed_at timestamptz,
  last_error_code text,
  request_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, event_key)
);

create index if not exists invoice_order_events_pending_idx
  on public.invoice_order_events(status, available_at, created_at)
  where status = 'PENDING';

create or replace function public.claim_invoice_order_event(
  p_event_id uuid,
  p_lock_token uuid,
  p_locked_by text,
  p_request_id text,
  p_lease_seconds integer default 300
)
returns public.invoice_order_events
language plpgsql
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
declare
  current_event public.invoice_order_events;
  claimed_event public.invoice_order_events;
  lease_seconds integer := greatest(30, least(coalesce(p_lease_seconds, 300), 3600));
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode = '42501'; end if;
  if p_lock_token is null then raise exception 'Lock token is required.' using errcode = '22023'; end if;
  select ioe.* into current_event from public.invoice_order_events ioe where ioe.id = p_event_id for update;
  if current_event.id is null then raise exception 'Order event not found.' using errcode = 'P0002'; end if;
  if not (
    (current_event.status = 'PENDING' and current_event.available_at <= now())
    or (current_event.status = 'PROCESSING' and current_event.lock_expires_at < now())
  ) then return null; end if;
  update public.invoice_order_events ioe
  set status = 'PROCESSING',
      attempt_count = ioe.attempt_count + 1,
      processing_started_at = now(),
      lock_token = p_lock_token,
      lock_expires_at = now() + make_interval(secs => lease_seconds),
      locked_by = left(coalesce(p_locked_by, 'order-event-worker'), 200),
      request_id = coalesce(p_request_id, ioe.request_id),
      last_error_code = null,
      updated_at = now()
  where ioe.id = current_event.id
  returning ioe.* into claimed_event;
  return claimed_event;
end;
$$;

create or replace function public.renew_invoice_order_event_lease(
  p_event_id uuid,
  p_lock_token uuid,
  p_lease_seconds integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
declare
  renewed_count integer;
  lease_seconds integer := greatest(30, least(coalesce(p_lease_seconds, 300), 3600));
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode = '42501'; end if;
  update public.invoice_order_events
  set lock_expires_at = now() + make_interval(secs => lease_seconds), updated_at = now()
  where id = p_event_id and status = 'PROCESSING' and lock_token = p_lock_token and lock_expires_at > now();
  get diagnostics renewed_count = row_count;
  return renewed_count = 1;
end;
$$;

revoke all on function public.claim_invoice_order_event(uuid, uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.renew_invoice_order_event_lease(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_invoice_order_event(uuid, uuid, text, text, integer) to service_role;
grant execute on function public.renew_invoice_order_event_lease(uuid, uuid, integer) to service_role;

alter table if exists public.order_items
  add column if not exists partner_id uuid references public.profiles(id) on delete set null,
  add column if not exists seller_id uuid references public.seller_profiles(id) on delete set null,
  add column if not exists seller_sub_order_id uuid references public.seller_sub_orders(id) on delete set null,
  add column if not exists external_order_item_id text,
  add column if not exists sku text,
  add column if not exists barcode text,
  add column if not exists unit_code text,
  add column if not exists discount_amount numeric(18,2),
  add column if not exists tax_rate numeric(9,4),
  add column if not exists tax_amount numeric(18,2),
  add column if not exists invoice_line_total numeric(18,2);

create index if not exists order_items_seller_sub_order_idx
  on public.order_items(seller_sub_order_id, created_at);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  seller_id uuid not null references public.seller_profiles(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  sub_order_id uuid references public.seller_sub_orders(id) on delete restrict,
  customer_id uuid references public.profiles(id) on delete set null,
  customer_invoice_profile_id uuid references public.customer_invoice_profiles(id) on delete restrict,
  sales_channel text,
  sales_channel_account_id uuid references public.sales_channel_accounts(id) on delete set null,
  sales_channel_order_id text,
  provider text not null,
  provider_account_id uuid references public.invoice_provider_accounts(id) on delete restrict,
  invoice_profile_id uuid references public.invoice_profiles(id) on delete restrict,
  provider_document_id text,
  document_scope text not null default 'CUSTOMER_SALE'
    check (document_scope in ('CUSTOMER_SALE', 'COMMISSION', 'RETURN')),
  original_invoice_id uuid references public.invoices(id) on delete restrict,
  document_type text not null check (document_type in ('E_INVOICE', 'E_ARCHIVE', 'RETURN', 'COMMISSION')),
  constraint invoices_document_scope_type_check check (
    (document_scope = 'CUSTOMER_SALE' and document_type in ('E_INVOICE', 'E_ARCHIVE'))
    or (document_scope = 'RETURN' and document_type = 'RETURN')
    or (document_scope = 'COMMISSION' and document_type = 'COMMISSION')
  ),
  scenario text,
  ettn_uuid uuid,
  invoice_number text,
  issue_date date,
  currency text not null default 'TRY' check (char_length(currency) = 3),
  subtotal numeric(18,2) not null default 0,
  discount_total numeric(18,2) not null default 0,
  shipping_total numeric(18,2) not null default 0,
  shipping_tax_rate numeric(9,4),
  shipping_tax_amount numeric(18,2) not null default 0,
  tax_total numeric(18,2) not null default 0,
  grand_total numeric(18,2) not null default 0,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'QUEUED', 'PROCESSING', 'ISSUED', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCEL_PENDING', 'CANCELLED', 'RETURNED', 'FAILED', 'NEEDS_REVIEW')),
  customer_profile_snapshot jsonb not null default '{}'::jsonb,
  pdf_reference text,
  xml_reference text,
  idempotency_key text not null unique,
  error_code text,
  error_message text,
  retry_count integer not null default 0 check (retry_count >= 0),
  issued_at timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (subtotal >= 0 and discount_total >= 0 and shipping_total >= 0 and shipping_tax_amount >= 0 and shipping_tax_amount <= shipping_total and tax_total >= 0 and grand_total >= 0),
  check (shipping_total = 0 or shipping_tax_rate is not null)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoices_document_scope_type_check'
      and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices add constraint invoices_document_scope_type_check check (
      (document_scope = 'CUSTOMER_SALE' and document_type in ('E_INVOICE', 'E_ARCHIVE'))
      or (document_scope = 'RETURN' and document_type = 'RETURN')
      or (document_scope = 'COMMISSION' and document_type = 'COMMISSION')
    );
  end if;
end $$;

create index if not exists invoices_tenant_status_idx
  on public.invoices(organization_id, legal_entity_id, status, created_at desc);
create index if not exists invoices_order_idx on public.invoices(order_id, sub_order_id, created_at desc);
create index if not exists invoices_customer_idx on public.invoices(customer_id, created_at desc);
create unique index if not exists invoices_provider_document_idx
  on public.invoices(provider_account_id, provider_document_id)
  where provider_document_id is not null;
create unique index if not exists invoices_customer_sale_scope_unique
  on public.invoices(organization_id, seller_id, order_id, sub_order_id)
  where document_scope = 'CUSTOMER_SALE'
    and order_id is not null
    and sub_order_id is not null
    and document_type in ('E_INVOICE', 'E_ARCHIVE');

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  order_item_id uuid references public.order_items(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  sku text,
  barcode text,
  description text not null,
  quantity numeric(18,4) not null check (quantity > 0),
  unit_code text not null default 'C62',
  unit_price numeric(18,4) not null check (unit_price >= 0),
  discount_amount numeric(18,2) not null default 0 check (discount_amount >= 0),
  tax_rate numeric(9,4) not null default 0 check (tax_rate >= 0),
  tax_amount numeric(18,2) not null default 0 check (tax_amount >= 0),
  line_total numeric(18,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index if not exists invoice_items_invoice_idx on public.invoice_items(invoice_id, created_at);
create unique index if not exists invoice_items_invoice_order_item_unique
  on public.invoice_items(invoice_id, order_item_id);

create or replace function public.protect_completed_order_item_allocation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  target_order_id uuid;
  source_order_id uuid;
  allocation_complete boolean;
  financial_change boolean := true;
begin
  if tg_op = 'INSERT' then
    target_order_id := new.order_id;
    source_order_id := new.order_id;
  elsif tg_op = 'DELETE' then
    target_order_id := old.order_id;
    source_order_id := old.order_id;
  else
    target_order_id := new.order_id;
    source_order_id := old.order_id;
  end if;
  if tg_op = 'UPDATE' then
    financial_change :=
      new.order_id is distinct from old.order_id
      or new.product_id is distinct from old.product_id
      or new.product_name is distinct from old.product_name
      or new.quantity is distinct from old.quantity
      or new.price is distinct from old.price
      or new.unit_price is distinct from old.unit_price
      or new.partner_id is distinct from old.partner_id
      or new.seller_id is distinct from old.seller_id
      or new.seller_sub_order_id is distinct from old.seller_sub_order_id
      or new.sku is distinct from old.sku
      or new.barcode is distinct from old.barcode
      or new.unit_code is distinct from old.unit_code
      or new.discount_amount is distinct from old.discount_amount
      or new.tax_rate is distinct from old.tax_rate
      or new.tax_amount is distinct from old.tax_amount
      or new.invoice_line_total is distinct from old.invoice_line_total;
  end if;
  if not financial_change then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  -- Serialize item financial mutations with allocation completion. This closes
  -- the PENDING->COMPLETE snapshot race in both transaction directions.
  perform 1 from public.orders o
  where o.id in (target_order_id, source_order_id)
  order by o.id
  for update;

  select exists (
    select 1 from public.orders o
    where o.invoice_allocation_status = 'COMPLETE'
      and o.id in (target_order_id, source_order_id)
  ) into allocation_complete;
  if coalesce(allocation_complete, false) then
    raise exception 'Completed order seller allocation is immutable.' using errcode = '23514';
  end if;
  if tg_op <> 'INSERT' and exists (
    select 1 from public.invoice_items ii where ii.order_item_id = old.id
  ) then
    raise exception 'Invoiced order item financial allocation is immutable.' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists order_items_protect_completed_allocation on public.order_items;
create trigger order_items_protect_completed_allocation
  before insert or update or delete on public.order_items
  for each row execute function public.protect_completed_order_item_allocation();

create table if not exists public.invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  action text not null,
  old_state jsonb,
  new_state jsonb,
  request_id text,
  correlation_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists invoice_events_trace_idx
  on public.invoice_events(invoice_id, created_at desc);
create index if not exists invoice_events_request_idx
  on public.invoice_events(request_id) where request_id is not null;

create table if not exists public.invoice_webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  provider_account_id uuid not null references public.invoice_provider_accounts(id) on delete restrict,
  invoice_id uuid references public.invoices(id) on delete set null,
  provider_event_id text not null,
  event_type text,
  event_timestamp timestamptz not null,
  nonce text,
  signature_valid boolean not null default false,
  replay_detected boolean not null default false,
  processing_status text not null default 'RECEIVED'
    check (processing_status in ('RECEIVED', 'VERIFIED', 'PROCESSING', 'PROCESSED', 'REJECTED', 'FAILED')),
  processing_started_at timestamptz,
  sanitized_payload jsonb not null default '{}'::jsonb,
  request_id text,
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider_account_id, provider_event_id)
);

drop index if exists public.invoice_webhook_events_nonce_unique;
create unique index invoice_webhook_events_nonce_unique
  on public.invoice_webhook_events(provider_account_id, nonce)
  where nonce is not null and signature_valid;

create table if not exists public.invoice_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  legal_entity_id uuid references public.legal_entities(id) on delete restrict,
  seller_id uuid references public.seller_profiles(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  sub_order_id uuid references public.seller_sub_orders(id) on delete restrict,
  invoice_id uuid references public.invoices(id) on delete restrict,
  job_type text not null
    check (job_type in ('CREATE_DOCUMENT', 'FETCH_ARTIFACTS', 'REFRESH_STATUS', 'UPLOAD_TO_CHANNEL', 'CANCEL_DOCUMENT', 'CREATE_RETURN_DOCUMENT')),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'RETRY_SCHEDULED', 'NEEDS_REVIEW')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  idempotency_key text not null unique,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 4 check (max_attempts between 1 and 20),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  lock_expires_at timestamptz,
  lock_token uuid,
  locked_by text,
  provider_call_started_at timestamptz,
  last_error_code text,
  last_error_message text,
  request_id text,
  correlation_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.invoice_jobs
  add column if not exists provider_call_started_at timestamptz;

-- Existing attempted jobs predate the explicit network-boundary marker. Mark
-- them conservatively so an ambiguous historical provider call can never be
-- treated as safe to abandon.
update public.invoice_jobs
set provider_call_started_at = coalesce(provider_call_started_at, locked_at, updated_at, created_at)
where job_type in ('CREATE_DOCUMENT', 'CREATE_RETURN_DOCUMENT', 'CANCEL_DOCUMENT')
  and attempt_count > 0
  and provider_call_started_at is null;

create index if not exists invoice_jobs_claim_idx
  on public.invoice_jobs(status, next_attempt_at, created_at)
  where status in ('PENDING', 'PROCESSING', 'RETRY_SCHEDULED');

create unique index if not exists invoice_jobs_one_active_channel_upload
  on public.invoice_jobs(invoice_id)
  where job_type = 'UPLOAD_TO_CHANNEL'
    and status in ('PENDING', 'PROCESSING', 'RETRY_SCHEDULED');

create table if not exists public.invoice_failures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  invoice_id uuid references public.invoices(id) on delete set null,
  job_id uuid references public.invoice_jobs(id) on delete set null,
  failure_stage text not null,
  error_code text,
  error_message text not null,
  retryable boolean not null default false,
  attempt_number integer not null default 0,
  request_id text,
  correlation_id text,
  context jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists invoice_failures_open_idx
  on public.invoice_failures(organization_id, created_at desc)
  where resolved_at is null;

create table if not exists public.invoice_channel_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  sales_channel_account_id uuid not null references public.sales_channel_accounts(id) on delete restrict,
  channel_key text not null,
  delivery_type text not null check (delivery_type in ('PDF_XML', 'METADATA')),
  status text not null default 'PENDING' check (status in ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'NEEDS_REVIEW')),
  external_reference text,
  sanitized_result jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  delivered_at timestamptz,
  processing_started_at timestamptz,
  lock_expires_at timestamptz,
  lock_token uuid,
  job_id uuid references public.invoice_jobs(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_channel_deliveries_processing_lease_check check (
    (status = 'PROCESSING' and processing_started_at is not null and lock_expires_at is not null and lock_token is not null and job_id is not null)
    or (status <> 'PROCESSING' and processing_started_at is null and lock_expires_at is null and lock_token is null and job_id is null)
  )
);

alter table public.invoice_channel_deliveries
  add column if not exists lock_expires_at timestamptz,
  add column if not exists job_id uuid references public.invoice_jobs(id) on delete restrict;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoice_channel_deliveries_processing_lease_check'
      and conrelid = 'public.invoice_channel_deliveries'::regclass
  ) then
    alter table public.invoice_channel_deliveries
      add constraint invoice_channel_deliveries_processing_lease_check check (
        (status = 'PROCESSING' and processing_started_at is not null and lock_expires_at is not null and lock_token is not null and job_id is not null)
        or (status <> 'PROCESSING' and processing_started_at is null and lock_expires_at is null and lock_token is null and job_id is null)
      );
  end if;
end $$;

create index if not exists invoice_channel_deliveries_invoice_idx
  on public.invoice_channel_deliveries(invoice_id, created_at desc);

create table if not exists public.invoice_returns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  original_invoice_id uuid not null references public.invoices(id) on delete restrict,
  return_invoice_id uuid references public.invoices(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  reason_code text,
  reason_note text,
  idempotency_key text not null unique,
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  currency text not null default 'TRY' check (char_length(currency) = 3),
  subtotal numeric(18,2) not null default 0 check (subtotal >= 0),
  tax_total numeric(18,2) not null default 0 check (tax_total >= 0),
  grand_total numeric(18,2) not null default 0 check (grand_total >= 0),
  status text not null default 'REQUESTED'
    check (status in ('REQUESTED', 'REVIEW', 'QUEUED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'FAILED', 'NEEDS_REVIEW')),
  requested_by uuid references public.profiles(id) on delete set null,
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 1000),
  rejected_by uuid references public.profiles(id) on delete set null,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invoice_returns add column if not exists rejection_reason text;
alter table public.invoice_returns add column if not exists rejected_by uuid references public.profiles(id) on delete set null;
alter table public.invoice_returns add column if not exists rejected_at timestamptz;

create table if not exists public.invoice_return_items (
  id uuid primary key default gen_random_uuid(),
  invoice_return_id uuid not null references public.invoice_returns(id) on delete restrict,
  original_invoice_item_id uuid not null references public.invoice_items(id) on delete restrict,
  quantity numeric(18,4) not null check (quantity > 0),
  amount numeric(18,2) not null check (amount >= 0),
  tax_amount numeric(18,2) not null default 0 check (tax_amount >= 0),
  created_at timestamptz not null default now(),
  unique (invoice_return_id, original_invoice_item_id)
);

-- The original item row is locked so two concurrent partial-return requests
-- cannot reserve more than the invoiced quantity under different request keys.
create or replace function public.enforce_invoice_return_quantity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  original_quantity numeric(18,4);
  original_invoice uuid;
  workflow_original_invoice uuid;
  reserved_quantity numeric(18,4);
begin
  select ii.quantity, ii.invoice_id
    into original_quantity, original_invoice
  from public.invoice_items ii
  where ii.id = new.original_invoice_item_id
  for update;

  if original_invoice is null then
    raise exception 'Original invoice item does not exist.' using errcode = '23503';
  end if;

  select ir.original_invoice_id
    into workflow_original_invoice
  from public.invoice_returns ir
  where ir.id = new.invoice_return_id;

  if workflow_original_invoice is distinct from original_invoice then
    raise exception 'Return item does not belong to the workflow original invoice.' using errcode = '23514';
  end if;

  select coalesce(sum(iri.quantity), 0)
    into reserved_quantity
  from public.invoice_return_items iri
  join public.invoice_returns ir on ir.id = iri.invoice_return_id
  where iri.original_invoice_item_id = new.original_invoice_item_id
    and iri.id is distinct from new.id
    and ir.status <> 'REJECTED';

  if reserved_quantity + new.quantity > original_quantity then
    raise exception 'Returned quantity exceeds original invoice quantity.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists invoice_return_items_validate_quantity on public.invoice_return_items;
create trigger invoice_return_items_validate_quantity
  before insert or update of invoice_return_id, original_invoice_item_id, quantity
  on public.invoice_return_items
  for each row execute function public.enforce_invoice_return_quantity();

create table if not exists public.invoice_cancellations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  order_cancelled_at timestamptz,
  reason_code text,
  reason_note text,
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null default 'REQUESTED'
    check (status in ('REQUESTED', 'REVIEW', 'QUEUED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'FAILED', 'NEEDS_REVIEW')),
  provider_reference text,
  requested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists invoice_cancellations_one_workflow_per_invoice
  on public.invoice_cancellations(invoice_id);

-- A sale invoice may enter the return domain or the cancellation domain, but
-- never both. RETURN remains active after completed partial returns so the
-- original document cannot later be cancelled as if no return existed.
create table if not exists public.invoice_document_operation_guards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  operation_type text not null check (operation_type in ('RETURN', 'CANCELLATION')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'RELEASED')),
  reservation_expires_at timestamptz not null default (now() + interval '5 minutes'),
  released_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  released_at timestamptz,
  check (
    (status = 'ACTIVE' and released_at is null)
    or (status = 'RELEASED' and released_at is not null)
  )
);

alter table public.invoice_document_operation_guards
  add column if not exists reservation_expires_at timestamptz not null default (now() + interval '5 minutes');

create unique index if not exists invoice_document_operation_one_active
  on public.invoice_document_operation_guards(invoice_id)
  where status = 'ACTIVE';

create table if not exists public.commission_billing_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  seller_id uuid not null references public.seller_profiles(id) on delete restrict,
  partner_business_id uuid,
  settlement_period_start date not null,
  settlement_period_end date not null,
  currency text not null default 'TRY' check (char_length(currency) = 3),
  gross_sales numeric(18,2) not null default 0,
  returns_total numeric(18,2) not null default 0,
  commission_total numeric(18,2) not null default 0,
  service_fee_total numeric(18,2) not null default 0,
  shipping_deduction_total numeric(18,2) not null default 0,
  other_deduction_total numeric(18,2) not null default 0,
  net_payable numeric(18,2) not null default 0,
  generated_invoice_id uuid references public.invoices(id) on delete set null,
  idempotency_key text not null unique,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'REVIEW', 'QUEUED', 'ISSUED', 'CANCELLED', 'FAILED', 'NEEDS_REVIEW')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (settlement_period_end >= settlement_period_start)
);

create table if not exists public.commission_billing_items (
  id uuid primary key default gen_random_uuid(),
  commission_document_id uuid not null references public.commission_billing_documents(id) on delete restrict,
  source_type text not null check (source_type in ('SALE', 'RETURN', 'COMMISSION', 'SERVICE_FEE', 'SHIPPING', 'OTHER')),
  source_id uuid,
  description text not null,
  quantity numeric(18,4) not null default 1 check (quantity > 0),
  unit_amount numeric(18,4) not null default 0,
  tax_rate numeric(9,4) not null default 0 check (tax_rate >= 0),
  tax_amount numeric(18,2) not null default 0,
  line_total numeric(18,2) not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists commission_billing_period_unique
  on public.commission_billing_documents(organization_id, seller_id, settlement_period_start, settlement_period_end);

create table if not exists public.invoice_reconciliation_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  seller_id uuid references public.seller_profiles(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  commission_document_id uuid references public.commission_billing_documents(id) on delete set null,
  partner_payout_id uuid,
  partner_transaction_id uuid,
  period_start date,
  period_end date,
  currency text not null default 'TRY' check (char_length(currency) = 3),
  gross_sales numeric(18,2) not null default 0,
  returns_total numeric(18,2) not null default 0,
  cancellations_total numeric(18,2) not null default 0,
  commission_total numeric(18,2) not null default 0,
  service_fees numeric(18,2) not null default 0,
  shipping_deductions numeric(18,2) not null default 0,
  other_deductions numeric(18,2) not null default 0,
  net_payable numeric(18,2) not null default 0,
  recorded_payout numeric(18,2) not null default 0,
  variance numeric(18,2) not null default 0,
  status text not null default 'OPEN'
    check (status in ('OPEN', 'MATCHED', 'MISMATCH', 'REVIEW', 'RESOLVED')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.partner_payouts') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'invoice_reconciliation_partner_payout_fkey'
         and conrelid = 'public.invoice_reconciliation_records'::regclass
     ) then
    alter table public.invoice_reconciliation_records
      add constraint invoice_reconciliation_partner_payout_fkey
      foreign key (partner_payout_id) references public.partner_payouts(id) on delete set null;
  end if;

  if to_regclass('public.partner_transactions') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'invoice_reconciliation_partner_transaction_fkey'
         and conrelid = 'public.invoice_reconciliation_records'::regclass
     ) then
    alter table public.invoice_reconciliation_records
      add constraint invoice_reconciliation_partner_transaction_fkey
      foreign key (partner_transaction_id) references public.partner_transactions(id) on delete set null;
  end if;
end $$;

create index if not exists invoice_reconciliation_scope_idx
  on public.invoice_reconciliation_records(organization_id, status, period_end desc);

-- Fail closed when individually valid foreign keys form a cross-tenant chain.
-- Application validation is useful, but cannot be the only protection for
-- legal-entity selection and financial records.
create or replace function public.enforce_e_invoicing_tenant_integrity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  immutable_key text;
  old_row jsonb;
  new_row jsonb;
begin
  if tg_op = 'UPDATE' then
    old_row := to_jsonb(old);
    new_row := to_jsonb(new);

    -- Tenant parents are immutable. Moving a parent row would silently move
    -- visibility while existing children retain their original tenant ids.
    foreach immutable_key in array array['organization_id'] loop
      if old_row ? immutable_key and old_row->immutable_key is distinct from new_row->immutable_key then
        raise exception 'Tenant parent key % is immutable on %.', immutable_key, tg_table_name using errcode = '23514';
      end if;
    end loop;
    if tg_table_name <> 'order_items' then
      foreach immutable_key in array array['legal_entity_id', 'seller_id', 'order_id', 'sub_order_id', 'sales_channel_account_id'] loop
        if old_row ? immutable_key and old_row->immutable_key is distinct from new_row->immutable_key then
          raise exception 'Tenant relationship key % is immutable on %.', immutable_key, tg_table_name using errcode = '23514';
        end if;
      end loop;
    end if;
    if tg_table_name = 'seller_profiles'
       and old_row->'partner_business_id' is distinct from new_row->'partner_business_id' then
      raise exception 'Seller partner business relationship is immutable.' using errcode = '23514';
    end if;
    if tg_table_name = 'sales_channel_accounts'
       and old_row->'sales_channel_id' is distinct from new_row->'sales_channel_id' then
      raise exception 'Sales channel account provider is immutable.' using errcode = '23514';
    end if;
    if tg_table_name = 'order_items' then
      if old.order_id is distinct from new.order_id then
        raise exception 'Order item parent order is immutable.' using errcode = '23514';
      end if;
      if old.seller_id is not null and old.seller_id is distinct from new.seller_id then
        raise exception 'Resolved order item seller is immutable.' using errcode = '23514';
      end if;
      if old.seller_sub_order_id is not null and old.seller_sub_order_id is distinct from new.seller_sub_order_id then
        raise exception 'Resolved order item sub-order is immutable.' using errcode = '23514';
      end if;
    end if;
    if tg_table_name = 'invoices' then
      foreach immutable_key in array array[
        'customer_id', 'customer_invoice_profile_id', 'provider_account_id',
        'invoice_profile_id', 'original_invoice_id', 'document_scope',
        'document_type', 'provider', 'currency'
      ] loop
        if old_row->immutable_key is distinct from new_row->immutable_key then
          raise exception 'Financial identity key % is immutable on invoices.', immutable_key using errcode = '23514';
        end if;
      end loop;
    end if;
    if tg_table_name in ('invoice_items', 'invoice_events', 'invoice_channel_deliveries', 'invoice_cancellations')
       and old_row->'invoice_id' is distinct from new_row->'invoice_id' then
      raise exception 'Invoice parent is immutable on %.', tg_table_name using errcode = '23514';
    end if;
    if tg_table_name = 'invoice_items'
       and old_row->'order_item_id' is distinct from new_row->'order_item_id' then
      raise exception 'Invoice item source is immutable.' using errcode = '23514';
    end if;
    if tg_table_name = 'invoice_webhook_events'
       and old.invoice_id is not null and old.invoice_id is distinct from new.invoice_id then
      raise exception 'Matched webhook invoice is immutable.' using errcode = '23514';
    end if;
    if tg_table_name = 'invoice_jobs' then
      if old.invoice_id is distinct from new.invoice_id
         or old.job_type is distinct from new.job_type
         or old.idempotency_key is distinct from new.idempotency_key
         or old.payload is distinct from new.payload then
        raise exception 'Invoice job identity and payload are immutable.' using errcode = '23514';
      end if;
    end if;
    if tg_table_name = 'invoice_document_operation_guards'
       and (old.invoice_id is distinct from new.invoice_id
         or old.operation_type is distinct from new.operation_type) then
      raise exception 'Invoice document operation identity is immutable.' using errcode = '23514';
    end if;
    if tg_table_name = 'invoice_failures'
       and (old.invoice_id is distinct from new.invoice_id or old.job_id is distinct from new.job_id) then
      raise exception 'Invoice failure parent links are immutable.' using errcode = '23514';
    end if;
    if tg_table_name = 'invoice_channel_deliveries'
       and old.sales_channel_account_id is distinct from new.sales_channel_account_id then
      raise exception 'Invoice channel delivery account is immutable.' using errcode = '23514';
    end if;
    if tg_table_name = 'invoice_returns' then
      if old.original_invoice_id is distinct from new.original_invoice_id then
        raise exception 'Return workflow original invoice is immutable.' using errcode = '23514';
      end if;
      if old.return_invoice_id is not null and old.return_invoice_id is distinct from new.return_invoice_id then
        raise exception 'Return workflow document is immutable after assignment.' using errcode = '23514';
      end if;
    end if;
    if tg_table_name = 'invoice_return_items'
       and (old.invoice_return_id is distinct from new.invoice_return_id
         or old.original_invoice_item_id is distinct from new.original_invoice_item_id) then
      raise exception 'Return item parent links are immutable.' using errcode = '23514';
    end if;
    if tg_table_name = 'commission_billing_documents'
       and old.generated_invoice_id is not null
       and old.generated_invoice_id is distinct from new.generated_invoice_id then
      raise exception 'Commission generated invoice is immutable after assignment.' using errcode = '23514';
    end if;
    if tg_table_name = 'invoice_reconciliation_records' then
      if old.invoice_id is not null and old.invoice_id is distinct from new.invoice_id then
        raise exception 'Reconciliation invoice is immutable after assignment.' using errcode = '23514';
      end if;
      if old.commission_document_id is not null and old.commission_document_id is distinct from new.commission_document_id then
        raise exception 'Reconciliation commission document is immutable after assignment.' using errcode = '23514';
      end if;
    end if;
  end if;

  if tg_table_name = 'legal_entities' then
    if new.status = 'active' and (
      nullif(trim(coalesce(new.tax_number, '')), '') is null
      or nullif(trim(coalesce(new.billing_address->>'line1', '')), '') is null
      or nullif(trim(coalesce(new.billing_address->>'city', '')), '') is null
      or nullif(trim(coalesce(new.billing_address->>'country', new.country_code, '')), '') is null
      or (upper(coalesce(new.country_code, '')) = 'TR' and nullif(trim(coalesce(new.tax_office, '')), '') is null)
    ) then
      raise exception 'Active legal entity requires tax identity and complete billing address.' using errcode = '23514';
    end if;

  elsif tg_table_name = 'seller_profiles' then
    if not exists (select 1 from public.legal_entities le where le.id = new.legal_entity_id and le.organization_id = new.organization_id) then
      raise exception 'Seller legal entity tenant mismatch.' using errcode = '23514';
    end if;

  elsif tg_table_name = 'sales_channel_accounts' then
    if not exists (
      select 1 from public.seller_profiles sp
      where sp.id = new.seller_id and sp.organization_id = new.organization_id and sp.legal_entity_id = new.legal_entity_id
    ) then raise exception 'Sales channel seller tenant mismatch.' using errcode = '23514'; end if;

  elsif tg_table_name in ('invoice_profiles', 'invoice_provider_accounts') then
    if not exists (select 1 from public.legal_entities le where le.id = new.legal_entity_id and le.organization_id = new.organization_id) then
      raise exception 'Invoice configuration legal entity tenant mismatch.' using errcode = '23514';
    end if;

  elsif tg_table_name = 'invoice_settings' then
    if not exists (select 1 from public.legal_entities le where le.id = new.legal_entity_id and le.organization_id = new.organization_id) then
      raise exception 'Invoice settings legal entity tenant mismatch.' using errcode = '23514';
    end if;
    if new.sales_channel_account_id is not null and not exists (
      select 1 from public.sales_channel_accounts sca where sca.id = new.sales_channel_account_id and sca.organization_id = new.organization_id and sca.legal_entity_id = new.legal_entity_id
    ) then raise exception 'Invoice settings channel account tenant mismatch.' using errcode = '23514'; end if;
    if new.invoice_profile_id is not null and not exists (
      select 1 from public.invoice_profiles ip where ip.id = new.invoice_profile_id and ip.organization_id = new.organization_id and ip.legal_entity_id = new.legal_entity_id
    ) then raise exception 'Invoice settings profile tenant mismatch.' using errcode = '23514'; end if;
    if new.invoice_provider_account_id is not null and not exists (
      select 1 from public.invoice_provider_accounts ipa where ipa.id = new.invoice_provider_account_id and ipa.organization_id = new.organization_id and ipa.legal_entity_id = new.legal_entity_id
    ) then raise exception 'Invoice settings provider tenant mismatch.' using errcode = '23514'; end if;

  elsif tg_table_name = 'seller_sub_orders' then
    if not exists (
      select 1 from public.seller_profiles sp where sp.id = new.seller_id and sp.organization_id = new.organization_id and sp.legal_entity_id = new.legal_entity_id
    ) then raise exception 'Sub-order seller tenant mismatch.' using errcode = '23514'; end if;
    if not exists (select 1 from public.orders o where o.id = new.order_id) then
      raise exception 'Sub-order parent order does not exist.' using errcode = '23514';
    end if;
    if new.sales_channel_account_id is not null and not exists (
      select 1 from public.sales_channel_accounts sca
      where sca.id = new.sales_channel_account_id and sca.organization_id = new.organization_id and sca.legal_entity_id = new.legal_entity_id and sca.seller_id = new.seller_id
    ) then raise exception 'Sub-order channel account tenant mismatch.' using errcode = '23514'; end if;

  elsif tg_table_name = 'order_items' then
    if (new.seller_id is null) <> (new.seller_sub_order_id is null) then
      raise exception 'Order item seller and seller sub-order must be assigned together.' using errcode = '23514';
    end if;
    if new.seller_sub_order_id is not null and not exists (
      select 1
      from public.seller_sub_orders sso
      join public.orders o on o.id = sso.order_id
      where sso.id = new.seller_sub_order_id
        and sso.order_id = new.order_id
        and sso.seller_id = new.seller_id
    ) then raise exception 'Order item seller/sub-order mismatch.' using errcode = '23514'; end if;

  elsif tg_table_name = 'invoices' then
    if not exists (
      select 1 from public.seller_profiles sp where sp.id = new.seller_id and sp.organization_id = new.organization_id and sp.legal_entity_id = new.legal_entity_id
    ) then raise exception 'Invoice seller tenant mismatch.' using errcode = '23514'; end if;
    if new.order_id is not null then
      perform 1 from public.orders o where o.id = new.order_id for update;
      if not exists (
        select 1 from public.orders o
        where o.id = new.order_id
          and (
            new.sub_order_id is not null
            or o.organization_id is null
            or o.organization_id = new.organization_id
          )
      ) then
        raise exception 'Invoice order scope mismatch.' using errcode = '23514';
      end if;
      if tg_op = 'INSERT' and new.document_scope = 'CUSTOMER_SALE' and not exists (
        select 1
        from public.orders o
        join public.customer_invoice_profiles cip on cip.id = new.customer_invoice_profile_id
        where o.id = new.order_id
          and o.customer_invoice_profile_id = new.customer_invoice_profile_id
          and cip.customer_id = o.user_id
          and cip.status = 'active'
          and new.customer_id = o.user_id
      ) then
        raise exception 'Invoice customer profile no longer matches the locked order.' using errcode = '23514';
      end if;
      if tg_op = 'INSERT' and new.document_scope = 'RETURN' and not exists (
        select 1
        from public.invoices oi
        where oi.id = new.original_invoice_id
          and oi.order_id = new.order_id
          and oi.customer_id = new.customer_id
          and oi.customer_invoice_profile_id = new.customer_invoice_profile_id
      ) then
        raise exception 'Return invoice customer profile does not match the original invoice.' using errcode = '23514';
      end if;
    end if;
    if new.sub_order_id is not null and not exists (
      select 1 from public.seller_sub_orders sso
      where sso.id = new.sub_order_id and sso.organization_id = new.organization_id and sso.legal_entity_id = new.legal_entity_id
        and sso.seller_id = new.seller_id and sso.order_id = new.order_id
        and sso.sales_channel_account_id is not distinct from new.sales_channel_account_id
    ) then raise exception 'Invoice sub-order tenant mismatch.' using errcode = '23514'; end if;
    if new.sales_channel_account_id is not null and not exists (
      select 1 from public.sales_channel_accounts sca
      where sca.id = new.sales_channel_account_id and sca.organization_id = new.organization_id and sca.legal_entity_id = new.legal_entity_id and sca.seller_id = new.seller_id
    ) then raise exception 'Invoice channel account tenant mismatch.' using errcode = '23514'; end if;
    if new.invoice_profile_id is not null and not exists (
      select 1 from public.invoice_profiles ip where ip.id = new.invoice_profile_id and ip.organization_id = new.organization_id and ip.legal_entity_id = new.legal_entity_id
    ) then raise exception 'Invoice profile tenant mismatch.' using errcode = '23514'; end if;
    if new.provider_account_id is not null and not exists (
      select 1 from public.invoice_provider_accounts ipa
      where ipa.id = new.provider_account_id and ipa.organization_id = new.organization_id and ipa.legal_entity_id = new.legal_entity_id and ipa.provider_key = new.provider
    ) then raise exception 'Invoice provider account tenant mismatch.' using errcode = '23514'; end if;
    if new.original_invoice_id is not null and not exists (
      select 1 from public.invoices oi
      where oi.id = new.original_invoice_id and oi.organization_id = new.organization_id and oi.legal_entity_id = new.legal_entity_id and oi.seller_id = new.seller_id and oi.currency = new.currency
    ) then raise exception 'Return/original invoice tenant mismatch.' using errcode = '23514'; end if;

  elsif tg_table_name = 'invoice_items' then
    if not exists (select 1 from public.invoices i where i.id = new.invoice_id) then
      raise exception 'Invoice item parent does not exist.' using errcode = '23503';
    end if;
    if new.order_item_id is not null and not exists (
      select 1
      from public.invoices i
      join public.order_items oi on oi.id = new.order_item_id
      where i.id = new.invoice_id
        and oi.order_id = i.order_id
        and (i.sub_order_id is null or oi.seller_sub_order_id = i.sub_order_id)
        and (i.seller_id is null or oi.seller_id = i.seller_id)
    ) then raise exception 'Invoice item does not belong to the invoice seller/sub-order.' using errcode = '23514'; end if;

  elsif tg_table_name = 'invoice_events' then
    if not exists (
      select 1 from public.invoices i
      where i.id = new.invoice_id and i.organization_id = new.organization_id
    ) then raise exception 'Invoice event tenant mismatch.' using errcode = '23514'; end if;

  elsif tg_table_name = 'invoice_webhook_events' then
    if not exists (
      select 1 from public.invoice_provider_accounts ipa
      where ipa.id = new.provider_account_id and ipa.organization_id = new.organization_id
    ) then raise exception 'Webhook provider tenant mismatch.' using errcode = '23514'; end if;
    if new.invoice_id is not null and not exists (
      select 1 from public.invoices i
      where i.id = new.invoice_id
        and i.organization_id = new.organization_id
        and i.provider_account_id = new.provider_account_id
    ) then raise exception 'Webhook invoice/provider tenant mismatch.' using errcode = '23514'; end if;

  elsif tg_table_name = 'invoice_jobs' then
    if new.invoice_id is not null and not exists (
      select 1 from public.invoices i
      where i.id = new.invoice_id
        and i.organization_id = new.organization_id
        and i.legal_entity_id is not distinct from new.legal_entity_id
        and i.seller_id is not distinct from new.seller_id
        and i.order_id is not distinct from new.order_id
        and i.sub_order_id is not distinct from new.sub_order_id
    ) then raise exception 'Invoice job tenant context mismatch.' using errcode = '23514'; end if;
    if new.invoice_id is null and new.legal_entity_id is not null and not exists (
      select 1 from public.legal_entities le where le.id = new.legal_entity_id and le.organization_id = new.organization_id
    ) then raise exception 'Invoice job legal entity tenant mismatch.' using errcode = '23514'; end if;
    if new.invoice_id is null and new.seller_id is not null and not exists (
      select 1 from public.seller_profiles sp
      where sp.id = new.seller_id and sp.organization_id = new.organization_id
        and (new.legal_entity_id is null or sp.legal_entity_id = new.legal_entity_id)
    ) then raise exception 'Invoice job seller tenant mismatch.' using errcode = '23514'; end if;
    if new.invoice_id is null and new.sub_order_id is not null and not exists (
      select 1 from public.seller_sub_orders sso
      where sso.id = new.sub_order_id and sso.organization_id = new.organization_id
        and (new.seller_id is null or sso.seller_id = new.seller_id)
        and (new.order_id is null or sso.order_id = new.order_id)
    ) then raise exception 'Invoice job sub-order tenant mismatch.' using errcode = '23514'; end if;
    if new.job_type = 'CREATE_RETURN_DOCUMENT' and not exists (
      select 1
      from public.invoice_returns ir
      join public.invoice_document_operation_guards idog
        on idog.invoice_id = ir.original_invoice_id
       and idog.operation_type = 'RETURN'
       and idog.status = 'ACTIVE'
      where ir.id = nullif(new.payload->>'invoiceReturnId', '')::uuid
        and ir.return_invoice_id = new.invoice_id
        and ir.status <> 'REJECTED'
    ) then raise exception 'Return document job requires an active return workflow guard.' using errcode = '23514'; end if;

  elsif tg_table_name = 'invoice_failures' then
    if new.invoice_id is not null and not exists (
      select 1 from public.invoices i where i.id = new.invoice_id and i.organization_id = new.organization_id
    ) then raise exception 'Invoice failure tenant mismatch.' using errcode = '23514'; end if;
    if new.job_id is not null and not exists (
      select 1 from public.invoice_jobs j
      where j.id = new.job_id and j.organization_id = new.organization_id
        and (new.invoice_id is null or j.invoice_id = new.invoice_id)
    ) then raise exception 'Invoice failure job tenant mismatch.' using errcode = '23514'; end if;

  elsif tg_table_name = 'invoice_channel_deliveries' then
    if not exists (
      select 1
      from public.invoices i
      join public.sales_channel_accounts sca on sca.id = new.sales_channel_account_id
      join public.sales_channels sc on sc.id = sca.sales_channel_id
      where i.id = new.invoice_id
        and i.organization_id = new.organization_id
        and i.sales_channel_account_id = new.sales_channel_account_id
        and sca.organization_id = new.organization_id
        and sc.channel_key = new.channel_key
    ) then raise exception 'Invoice channel delivery tenant mismatch.' using errcode = '23514'; end if;

  elsif tg_table_name = 'invoice_returns' then
    if not exists (select 1 from public.invoices oi where oi.id = new.original_invoice_id and oi.organization_id = new.organization_id) then
      raise exception 'Return workflow original invoice tenant mismatch.' using errcode = '23514';
    end if;
    if new.return_invoice_id is not null and not exists (
      select 1 from public.invoices ri
      where ri.id = new.return_invoice_id and ri.organization_id = new.organization_id and ri.original_invoice_id = new.original_invoice_id and ri.document_type = 'RETURN'
    ) then raise exception 'Return workflow document mismatch.' using errcode = '23514'; end if;
    if tg_op = 'INSERT' and not exists (
      select 1 from public.invoice_document_operation_guards idog
      where idog.invoice_id = new.original_invoice_id
        and idog.organization_id = new.organization_id
        and idog.operation_type = 'RETURN'
        and idog.status = 'ACTIVE'
    ) then raise exception 'Return workflow requires an active return operation guard.' using errcode = '23514'; end if;

  elsif tg_table_name = 'invoice_cancellations' then
    if not exists (select 1 from public.invoices i where i.id = new.invoice_id and i.organization_id = new.organization_id) then
      raise exception 'Cancellation workflow invoice tenant mismatch.' using errcode = '23514';
    end if;
    if tg_op = 'INSERT' and not exists (
      select 1 from public.invoice_document_operation_guards idog
      where idog.invoice_id = new.invoice_id
        and idog.organization_id = new.organization_id
        and idog.operation_type = 'CANCELLATION'
        and idog.status = 'ACTIVE'
    ) then raise exception 'Cancellation workflow requires an active cancellation operation guard.' using errcode = '23514'; end if;

  elsif tg_table_name = 'invoice_document_operation_guards' then
    if not exists (
      select 1 from public.invoices i
      where i.id = new.invoice_id
        and i.organization_id = new.organization_id
        and i.document_scope = 'CUSTOMER_SALE'
        and i.document_type in ('E_INVOICE', 'E_ARCHIVE')
    ) then raise exception 'Document operation guard invoice context is invalid.' using errcode = '23514'; end if;

  elsif tg_table_name = 'commission_billing_documents' then
    if not exists (
      select 1 from public.seller_profiles sp where sp.id = new.seller_id and sp.organization_id = new.organization_id and sp.legal_entity_id = new.legal_entity_id
    ) then raise exception 'Commission seller tenant mismatch.' using errcode = '23514'; end if;
    if new.partner_business_id is not null and not exists (
      select 1 from public.seller_profiles sp
      where sp.id = new.seller_id and sp.partner_business_id = new.partner_business_id
    ) then raise exception 'Commission partner business mismatch.' using errcode = '23514'; end if;
    if new.generated_invoice_id is not null and not exists (
      select 1 from public.invoices i
      where i.id = new.generated_invoice_id and i.organization_id = new.organization_id
        and i.legal_entity_id = new.legal_entity_id and i.seller_id = new.seller_id
        and i.currency = new.currency and i.document_type = 'COMMISSION'
    ) then raise exception 'Commission generated invoice tenant mismatch.' using errcode = '23514'; end if;

  elsif tg_table_name = 'commission_billing_items' then
    if not exists (
      select 1 from public.commission_billing_documents cbd where cbd.id = new.commission_document_id
    ) then raise exception 'Commission item parent does not exist.' using errcode = '23503'; end if;
    if new.source_id is not null and new.source_type = 'SALE' and not exists (
      select 1
      from public.commission_billing_documents cbd
      join public.invoices i on i.id = new.source_id
      where cbd.id = new.commission_document_id
        and i.organization_id = cbd.organization_id and i.seller_id = cbd.seller_id
    ) then raise exception 'Commission sale source tenant mismatch.' using errcode = '23514'; end if;
    if new.source_id is not null and new.source_type = 'RETURN' and not exists (
      select 1
      from public.commission_billing_documents cbd
      join public.invoice_returns ir on ir.id = new.source_id
      join public.invoices i on i.id = ir.original_invoice_id
      where cbd.id = new.commission_document_id
        and i.organization_id = cbd.organization_id and i.seller_id = cbd.seller_id
    ) then raise exception 'Commission return source tenant mismatch.' using errcode = '23514'; end if;

  elsif tg_table_name = 'invoice_reconciliation_records' then
    if not exists (select 1 from public.legal_entities le where le.id = new.legal_entity_id and le.organization_id = new.organization_id) then
      raise exception 'Reconciliation legal entity tenant mismatch.' using errcode = '23514';
    end if;
    if new.seller_id is not null and not exists (
      select 1 from public.seller_profiles sp where sp.id = new.seller_id and sp.organization_id = new.organization_id and sp.legal_entity_id = new.legal_entity_id
    ) then raise exception 'Reconciliation seller tenant mismatch.' using errcode = '23514'; end if;
    if new.invoice_id is not null and not exists (
      select 1 from public.invoices i
      where i.id = new.invoice_id and i.organization_id = new.organization_id
        and i.legal_entity_id = new.legal_entity_id
        and (new.seller_id is null or i.seller_id = new.seller_id)
        and i.currency = new.currency
    ) then raise exception 'Reconciliation invoice tenant mismatch.' using errcode = '23514'; end if;
    if new.commission_document_id is not null and not exists (
      select 1 from public.commission_billing_documents cbd
      where cbd.id = new.commission_document_id and cbd.organization_id = new.organization_id
        and cbd.legal_entity_id = new.legal_entity_id
        and (new.seller_id is null or cbd.seller_id = new.seller_id)
        and cbd.currency = new.currency
    ) then raise exception 'Reconciliation commission document tenant mismatch.' using errcode = '23514'; end if;
    if new.partner_payout_id is not null and not exists (
      select 1
      from public.partner_payouts pp
      join public.seller_profiles sp on sp.id = new.seller_id and sp.partner_business_id = pp.partner_id
      where pp.id = new.partner_payout_id and sp.organization_id = new.organization_id and pp.currency = new.currency
    ) then raise exception 'Reconciliation payout tenant mismatch.' using errcode = '23514'; end if;
    if new.partner_transaction_id is not null and not exists (
      select 1
      from public.partner_transactions pt
      join public.seller_profiles sp on sp.id = new.seller_id and sp.partner_business_id = pt.partner_id
      where pt.id = new.partner_transaction_id and sp.organization_id = new.organization_id and pt.currency = new.currency
    ) then raise exception 'Reconciliation transaction tenant mismatch.' using errcode = '23514'; end if;
  end if;
  return new;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'legal_entities', 'seller_profiles', 'sales_channel_accounts', 'invoice_profiles', 'invoice_provider_accounts',
    'invoice_settings', 'seller_sub_orders', 'order_items', 'invoices', 'invoice_items', 'invoice_events', 'invoice_return_items',
    'invoice_webhook_events', 'invoice_jobs', 'invoice_failures', 'invoice_channel_deliveries', 'invoice_returns',
    'invoice_document_operation_guards',
    'invoice_cancellations', 'commission_billing_documents', 'commission_billing_items', 'invoice_reconciliation_records'
  ] loop
    execute format('drop trigger if exists %I_tenant_integrity on public.%I', target_table, target_table);
    execute format(
      'create trigger %I_tenant_integrity before insert or update on public.%I for each row execute function public.enforce_e_invoicing_tenant_integrity()',
      target_table,
      target_table
    );
  end loop;
end $$;

create or replace function public.get_invoice_plan_amounts(p_order_id uuid, p_sub_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select jsonb_build_object(
    'sub_order', jsonb_build_object(
      'id', sso.id,
      'currency', sso.currency,
      'subtotal', sso.subtotal::text,
      'discount_total', sso.discount_total::text,
      'shipping_total', sso.shipping_total::text,
      'shipping_tax_rate', case when sso.shipping_tax_rate is null then null else sso.shipping_tax_rate::text end,
      'shipping_tax_amount', case when sso.shipping_tax_amount is null then null else sso.shipping_tax_amount::text end,
      'tax_total', sso.tax_total::text,
      'grand_total', sso.grand_total::text
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'order_id', oi.order_id,
        'product_id', oi.product_id,
        'product_name', oi.product_name,
        'sku', oi.sku,
        'barcode', oi.barcode,
        'quantity', oi.quantity::text,
        'price', oi.price::text,
        'unit_price', oi.unit_price::text,
        'discount_amount', case when oi.discount_amount is null then null else oi.discount_amount::text end,
        'tax_rate', case when oi.tax_rate is null then null else oi.tax_rate::text end,
        'tax_amount', case when oi.tax_amount is null then null else oi.tax_amount::text end,
        'invoice_line_total', case when oi.invoice_line_total is null then null else oi.invoice_line_total::text end,
        'unit_code', oi.unit_code
      ) order by oi.created_at, oi.id)
      from public.order_items oi
      where oi.order_id = p_order_id and oi.seller_sub_order_id = p_sub_order_id
    ), '[]'::jsonb)
  )
  from public.seller_sub_orders sso
  join public.orders o on o.id = sso.order_id
  where sso.id = p_sub_order_id
    and sso.order_id = p_order_id
    and o.invoice_allocation_status = 'COMPLETE'
    and o.expected_seller_sub_order_count is not null;
$$;

create or replace function public.get_invoice_return_amounts(p_invoice_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ii.id,
        'order_item_id', ii.order_item_id,
        'product_id', ii.product_id,
        'sku', ii.sku,
        'barcode', ii.barcode,
        'description', ii.description,
        'quantity', ii.quantity::text,
        'unit_code', ii.unit_code,
        'unit_price', ii.unit_price::text,
        'discount_amount', ii.discount_amount::text,
        'tax_rate', ii.tax_rate::text,
        'tax_amount', ii.tax_amount::text,
        'line_total', ii.line_total::text
      ) order by ii.created_at, ii.id)
      from public.invoice_items ii where ii.invoice_id = p_invoice_id
    ), '[]'::jsonb),
    'prior_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'original_invoice_item_id', iri.original_invoice_item_id,
        'quantity', iri.quantity::text,
        'amount', iri.amount::text,
        'tax_amount', iri.tax_amount::text
      ) order by iri.created_at, iri.id)
      from public.invoice_return_items iri
      join public.invoice_returns ir on ir.id = iri.invoice_return_id
      where ir.original_invoice_id = p_invoice_id and ir.status <> 'REJECTED'
    ), '[]'::jsonb)
  );
$$;

create or replace function public.invoice_is_fully_returned(p_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (select 1 from public.invoice_items where invoice_id = p_invoice_id)
    and not exists (
      select 1
      from public.invoice_items ii
      where ii.invoice_id = p_invoice_id
        and coalesce((
          select sum(iri.quantity)
          from public.invoice_return_items iri
          join public.invoice_returns ir on ir.id = iri.invoice_return_id
          where iri.original_invoice_item_id = ii.id and ir.status = 'COMPLETED'
        ), 0) <> ii.quantity
    );
$$;

revoke all on function public.get_invoice_plan_amounts(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_invoice_return_amounts(uuid) from public, anon, authenticated;
revoke all on function public.invoice_is_fully_returned(uuid) from public, anon, authenticated;
grant execute on function public.get_invoice_plan_amounts(uuid, uuid) to service_role;
grant execute on function public.get_invoice_return_amounts(uuid) to service_role;
grant execute on function public.invoice_is_fully_returned(uuid) to service_role;

create or replace function public.attach_order_invoice_profile(p_order_id uuid, p_profile_id uuid)
returns table(id uuid, customer_invoice_profile_id uuid, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select * into v_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found or v_order.user_id is distinct from v_user_id then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.customer_invoice_profiles cip
    where cip.id = p_profile_id and cip.customer_id = v_user_id and cip.status = 'active'
  ) then
    raise exception 'Customer invoice profile not found.' using errcode = 'P0002';
  end if;
  if exists (
    select 1
    from public.customer_invoice_profiles cip
    where cip.id = p_profile_id
      and (
        nullif(trim(coalesce(cip.email, '')), '') is null
        or nullif(trim(coalesce(cip.billing_address->>'line1', '')), '') is null
        or nullif(trim(coalesce(cip.billing_address->>'city', '')), '') is null
        or nullif(trim(coalesce(cip.billing_address->>'country', '')), '') is null
        or (cip.profile_type = 'individual' and (
          nullif(trim(coalesce(cip.name, '')), '') is null
          or nullif(trim(coalesce(cip.surname, '')), '') is null
        ))
        or (cip.profile_type = 'corporate' and (
          nullif(trim(coalesce(cip.company_name, '')), '') is null
          or nullif(trim(coalesce(cip.tax_number, '')), '') is null
          or nullif(trim(coalesce(cip.tax_office, '')), '') is null
        ))
      )
  ) then
    raise exception 'Customer invoice profile is incomplete.' using errcode = '22023';
  end if;
  if exists (select 1 from public.invoices i where i.order_id = p_order_id) then
    raise exception 'Invoice already exists.' using errcode = '23505';
  end if;

  return query
  update public.orders o
  set customer_invoice_profile_id = p_profile_id,
      updated_at = now()
  where o.id = p_order_id
  returning o.id, o.customer_invoice_profile_id, o.updated_at;
end;
$$;

revoke all on function public.attach_order_invoice_profile(uuid, uuid) from public, anon;
grant execute on function public.attach_order_invoice_profile(uuid, uuid) to authenticated;

create or replace function public.create_and_attach_order_invoice_profile(
  p_order_id uuid,
  p_profile_type text,
  p_name text default null,
  p_surname text default null,
  p_company_name text default null,
  p_tax_number text default null,
  p_tax_office text default null,
  p_billing_address jsonb default '{}'::jsonb,
  p_email text default null,
  p_is_default boolean default false
)
returns table(
  profile_id uuid,
  order_id uuid,
  profile_type text,
  name text,
  surname text,
  company_name text,
  tax_office text,
  billing_address jsonb,
  email text,
  taxpayer_status text,
  is_default boolean,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_profile public.customer_invoice_profiles%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select * into v_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found or v_order.user_id is distinct from v_user_id then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.invoices i where i.order_id = p_order_id) then
    raise exception 'Invoice already exists.' using errcode = '23505';
  end if;
  if p_profile_type not in ('individual', 'corporate')
     or (p_profile_type = 'individual' and nullif(trim(coalesce(p_name, '')), '') is null)
     or (p_profile_type = 'individual' and nullif(trim(coalesce(p_surname, '')), '') is null)
     or (p_profile_type = 'corporate' and nullif(trim(coalesce(p_company_name, '')), '') is null)
     or (p_profile_type = 'corporate' and nullif(trim(coalesce(p_tax_number, '')), '') is null)
     or (p_profile_type = 'corporate' and nullif(trim(coalesce(p_tax_office, '')), '') is null)
     or nullif(trim(coalesce(p_email, '')), '') is null
     or nullif(trim(coalesce(p_billing_address->>'line1', '')), '') is null
     or nullif(trim(coalesce(p_billing_address->>'city', '')), '') is null
     or nullif(trim(coalesce(p_billing_address->>'country', '')), '') is null
     or length(coalesce(p_name, '')) > 120
     or length(coalesce(p_surname, '')) > 120
     or length(coalesce(p_company_name, '')) > 240
     or length(coalesce(p_tax_number, '')) > 32
     or length(coalesce(p_tax_office, '')) > 160
     or length(coalesce(p_email, '')) > 180
     or jsonb_typeof(coalesce(p_billing_address, '{}'::jsonb)) <> 'object' then
    raise exception 'Customer invoice profile fields are invalid.' using errcode = '22023';
  end if;

  if coalesce(p_is_default, false) then
    update public.customer_invoice_profiles
    set is_default = false, updated_at = now()
    where customer_id = v_user_id and status = 'active' and is_default;
  end if;

  insert into public.customer_invoice_profiles (
    customer_id, profile_type, name, surname, company_name, tax_number, tax_office,
    billing_address, email, taxpayer_status, taxpayer_status_source,
    taxpayer_status_checked_at, taxpayer_status_provider_account_id,
    is_default, status
  ) values (
    v_user_id, p_profile_type,
    case when p_profile_type = 'individual' then nullif(trim(p_name), '') else null end,
    case when p_profile_type = 'individual' then nullif(trim(p_surname), '') else null end,
    case when p_profile_type = 'corporate' then nullif(trim(p_company_name), '') else null end,
    case when p_profile_type = 'corporate' then nullif(trim(p_tax_number), '') else null end,
    case when p_profile_type = 'corporate' then nullif(trim(p_tax_office), '') else null end,
    coalesce(p_billing_address, '{}'::jsonb), nullif(trim(p_email), ''),
    'unknown', 'unverified', null, null, coalesce(p_is_default, false), 'active'
  ) returning * into v_profile;

  update public.orders o
  set customer_invoice_profile_id = v_profile.id,
      updated_at = now()
  where o.id = p_order_id;

  return query select
    v_profile.id, v_order.id, v_profile.profile_type, v_profile.name, v_profile.surname,
    v_profile.company_name, v_profile.tax_office, v_profile.billing_address, v_profile.email,
    v_profile.taxpayer_status, v_profile.is_default, v_profile.status, v_profile.created_at;
end;
$$;

revoke all on function public.create_and_attach_order_invoice_profile(uuid, text, text, text, text, text, text, jsonb, text, boolean) from public, anon;
grant execute on function public.create_and_attach_order_invoice_profile(uuid, text, text, text, text, text, text, jsonb, text, boolean) to authenticated;

create or replace function public.create_e_invoicing_organization(p_name text, p_slug text)
returns table(id uuid, name text, slug text, status text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization public.organizations%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  if not public.e_invoicing_has_write_assurance() then
    raise exception 'MFA required.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2
     or trim(coalesce(p_slug, '')) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Organization fields are invalid.' using errcode = '22023';
  end if;

  insert into public.organizations(name, slug, created_by)
  values (left(trim(p_name), 180), left(trim(p_slug), 100), v_user_id)
  returning * into v_organization;

  return query select v_organization.id, v_organization.name, v_organization.slug, v_organization.status, v_organization.created_at;
end;
$$;

revoke all on function public.create_e_invoicing_organization(text, text) from public, anon;
grant execute on function public.create_e_invoicing_organization(text, text) to authenticated;

create or replace function public.resolve_unified_seller_sub_order(
  p_organization_id uuid,
  p_legal_entity_id uuid,
  p_seller_id uuid,
  p_order_id uuid,
  p_sales_channel_account_id uuid,
  p_sub_order_key text,
  p_currency text,
  p_subtotal numeric,
  p_discount_total numeric,
  p_shipping_total numeric,
  p_shipping_tax_rate numeric,
  p_shipping_tax_amount numeric,
  p_tax_total numeric,
  p_grand_total numeric,
  p_items jsonb,
  p_actor_id uuid,
  p_allow_unassigned boolean default false
)
returns public.seller_sub_orders
language plpgsql
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
declare
  v_order public.orders%rowtype;
  v_sub_order public.seller_sub_orders;
  v_channel_key text;
  v_item_count integer;
  v_distinct_item_count integer;
  v_current_subtotal numeric(18,2);
  v_current_discount numeric(18,2);
  v_current_tax numeric(18,2);
  v_current_grand numeric(18,2);
  v_partner_business_id uuid;
  v_existing_sub_order public.seller_sub_orders;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode = '42501'; end if;
  if upper(coalesce(p_currency, '')) !~ '^[A-Z]{3}$' then
    raise exception 'Currency is invalid.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 200 then
    raise exception 'Resolved item allocations are invalid.' using errcode = '22023';
  end if;

  select o.* into v_order from public.orders o where o.id = p_order_id for update;
  if v_order.id is null then raise exception 'Order not found.' using errcode = 'P0002'; end if;
  if v_order.invoice_allocation_status = 'COMPLETE' then
    raise exception 'Completed order seller allocation is immutable.' using errcode = '23514';
  end if;
  select sp.partner_business_id into v_partner_business_id
  from public.seller_profiles sp
    where sp.id = p_seller_id and sp.organization_id = p_organization_id
      and sp.legal_entity_id = p_legal_entity_id and sp.status = 'active';
  if not found then raise exception 'Active seller tenant context is invalid.' using errcode = '23514'; end if;
  select sc.channel_key into v_channel_key
  from public.sales_channel_accounts sca
  join public.sales_channels sc on sc.id = sca.sales_channel_id
  where sca.id = p_sales_channel_account_id
    and sca.organization_id = p_organization_id
    and sca.legal_entity_id = p_legal_entity_id
    and sca.seller_id = p_seller_id
    and sca.status = 'connected';
  if v_channel_key is null then raise exception 'Connected sales channel account context is invalid.' using errcode = '23514'; end if;
  if v_order.sales_channel is not null and v_order.sales_channel <> v_channel_key then
    raise exception 'Order is already assigned to another sales channel.' using errcode = '23514';
  end if;

  select count(*), count(distinct allocation.item_id)
  into v_item_count, v_distinct_item_count
  from jsonb_to_recordset(p_items) as allocation(item_id uuid);
  if v_item_count <> v_distinct_item_count then raise exception 'Duplicate order item allocation.' using errcode = '22023'; end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_items) as allocation(
      item_id uuid, expected_quantity numeric, expected_unit_price numeric,
      unit_code text, discount_amount numeric, tax_rate numeric,
      tax_amount numeric, line_total numeric
    )
    where allocation.item_id is null
       or allocation.expected_quantity is null
       or allocation.expected_quantity <= 0
       or allocation.expected_unit_price is null
       or allocation.expected_unit_price < 0
       or nullif(trim(coalesce(allocation.unit_code, '')), '') is null
       or allocation.discount_amount is null
       or allocation.discount_amount < 0
       or allocation.tax_rate is null
       or allocation.tax_rate < 0
       or allocation.tax_amount is null
       or allocation.tax_amount < 0
       or allocation.line_total is null
       or allocation.line_total < 0
  ) then raise exception 'Order item allocation contains invalid numeric or unit data.' using errcode = '22023'; end if;

  perform 1
  from public.order_items oi
  join jsonb_to_recordset(p_items) as allocation(
    item_id uuid, expected_quantity numeric, expected_unit_price numeric,
    unit_code text, discount_amount numeric, tax_rate numeric,
    tax_amount numeric, line_total numeric, sku text, barcode text
  ) on allocation.item_id = oi.id
  where oi.order_id = p_order_id
  for update of oi;
  if not found then raise exception 'Order items not found.' using errcode = 'P0002'; end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as allocation(item_id uuid, expected_quantity numeric, expected_unit_price numeric)
    left join public.order_items oi on oi.id = allocation.item_id and oi.order_id = p_order_id
    where oi.id is null
       or allocation.expected_quantity is null
       or allocation.expected_unit_price is null
       or oi.quantity::numeric <> allocation.expected_quantity
       or coalesce(oi.unit_price, oi.price)::numeric <> allocation.expected_unit_price
  ) then raise exception 'Order item price or quantity snapshot changed.' using errcode = '40001'; end if;

  if not coalesce(p_allow_unassigned, false) then
    if p_actor_id is null then raise exception 'Actor id is required for partner allocation.' using errcode = '42501'; end if;
    if exists (
      select 1
      from jsonb_to_recordset(p_items) as allocation(item_id uuid)
      join public.order_items oi on oi.id = allocation.item_id and oi.order_id = p_order_id
      where not (
        oi.seller_id = p_seller_id
        or (
          oi.seller_id is null
          and v_partner_business_id is not null
          and exists (
            select 1
            from public.partner_businesses pb
            left join public.partner_staff ps
              on ps.partner_id = pb.id
             and ps.user_id = p_actor_id
             and ps.status = 'active'
             and ps.staff_role in ('owner', 'manager')
            where pb.id = v_partner_business_id
              and pb.status = 'active'
              and pb.verification_status = 'verified'
              and oi.partner_id = pb.owner_id
              and (pb.owner_id = p_actor_id or ps.id is not null)
          )
        )
      )
    ) then raise exception 'Order item provenance does not authorize this seller allocation.' using errcode = '42501'; end if;
  end if;

  select sso.* into v_existing_sub_order
  from public.seller_sub_orders sso
  where sso.order_id = p_order_id
    and sso.seller_id = p_seller_id
    and sso.sub_order_key = left(coalesce(nullif(trim(p_sub_order_key), ''), 'default'), 160)
  for update;

  if v_existing_sub_order.id is not null then
    if v_existing_sub_order.organization_id <> p_organization_id
       or v_existing_sub_order.legal_entity_id <> p_legal_entity_id
       or v_existing_sub_order.sales_channel_account_id is distinct from p_sales_channel_account_id
       or v_existing_sub_order.currency <> upper(p_currency) then
      raise exception 'Existing sub-order financial identity conflicts with the request.' using errcode = '23514';
    end if;
    if exists (select 1 from public.invoices i where i.sub_order_id = v_existing_sub_order.id) then
      raise exception 'Invoiced sub-order allocation is immutable.' using errcode = '23514';
    end if;
  end if;

  if exists (
    select 1
    from public.invoice_items ii
    join jsonb_to_recordset(p_items) as allocation(item_id uuid) on allocation.item_id = ii.order_item_id
  ) then raise exception 'Invoiced order item allocation is immutable.' using errcode = '23514'; end if;

  update public.orders
  set sales_channel = coalesce(sales_channel, v_channel_key),
      imported_at = coalesce(imported_at, now()),
      updated_at = now()
  where id = p_order_id;

  insert into public.seller_sub_orders(
    organization_id, legal_entity_id, seller_id, order_id, sales_channel_account_id,
    sub_order_key, currency, subtotal, discount_total, shipping_total,
    shipping_tax_rate, shipping_tax_amount, tax_total, grand_total,
    resolution_status, resolution_error_code
  ) values (
    p_organization_id, p_legal_entity_id, p_seller_id, p_order_id, p_sales_channel_account_id,
    left(coalesce(nullif(trim(p_sub_order_key), ''), 'default'), 160), upper(p_currency),
    p_subtotal, p_discount_total, p_shipping_total,
    p_shipping_tax_rate, p_shipping_tax_amount, p_tax_total, p_grand_total,
    'RESOLVED', null
  )
  on conflict (order_id, seller_id, sub_order_key) do update
  set subtotal = excluded.subtotal,
      discount_total = excluded.discount_total,
      shipping_total = excluded.shipping_total,
      shipping_tax_rate = excluded.shipping_tax_rate,
      shipping_tax_amount = excluded.shipping_tax_amount,
      tax_total = excluded.tax_total,
      grand_total = excluded.grand_total,
      resolution_status = 'RESOLVED',
      resolution_error_code = null,
      updated_at = now()
  returning * into v_sub_order;

  if exists (
    select 1
    from public.order_items oi
    join jsonb_to_recordset(p_items) as allocation(item_id uuid) on allocation.item_id = oi.id
    where oi.seller_sub_order_id is not null and oi.seller_sub_order_id <> v_sub_order.id
  ) then raise exception 'Order item is already assigned to another seller sub-order.' using errcode = '23514'; end if;

  update public.order_items oi
  set seller_id = p_seller_id,
      seller_sub_order_id = v_sub_order.id,
      sku = nullif(left(allocation.sku, 180), ''),
      barcode = nullif(left(allocation.barcode, 180), ''),
      unit_code = left(allocation.unit_code, 20),
      discount_amount = allocation.discount_amount,
      tax_rate = allocation.tax_rate,
      tax_amount = allocation.tax_amount,
      invoice_line_total = allocation.line_total,
      updated_at = now()
  from jsonb_to_recordset(p_items) as allocation(
    item_id uuid, expected_quantity numeric, expected_unit_price numeric,
    unit_code text, discount_amount numeric, tax_rate numeric,
    tax_amount numeric, line_total numeric, sku text, barcode text
  )
  where oi.id = allocation.item_id and oi.order_id = p_order_id;

  select
    coalesce(sum(round(coalesce(oi.unit_price, oi.price)::numeric * oi.quantity::numeric, 2)), 0),
    coalesce(sum(oi.discount_amount), 0),
    coalesce(sum(oi.tax_amount), 0),
    coalesce(sum(oi.invoice_line_total), 0)
  into v_current_subtotal, v_current_discount, v_current_tax, v_current_grand
  from public.order_items oi
  where oi.seller_sub_order_id = v_sub_order.id;

  if v_current_subtotal <> round(p_subtotal, 2)
     or v_current_discount <> round(p_discount_total, 2)
     or v_current_tax + coalesce(p_shipping_tax_amount, 0) <> round(p_tax_total, 2)
     or v_current_grand + p_shipping_total <> round(p_grand_total, 2) then
    raise exception 'Resolved sub-order totals do not match item allocations.' using errcode = '23514';
  end if;

  return v_sub_order;
end;
$$;

revoke all on function public.resolve_unified_seller_sub_order(uuid, uuid, uuid, uuid, uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, uuid, boolean) from public, anon, authenticated;
grant execute on function public.resolve_unified_seller_sub_order(uuid, uuid, uuid, uuid, uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, uuid, boolean) to service_role;

create or replace function public.complete_order_invoice_allocation(
  p_order_id uuid,
  p_expected_sub_order_count integer
)
returns public.orders
language plpgsql
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
declare
  current_order public.orders;
  updated_order public.orders;
  actual_sub_order_count integer;
  order_item_count integer;
  assigned_item_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;
  if p_expected_sub_order_count is null or p_expected_sub_order_count < 1 or p_expected_sub_order_count > 1000 then
    raise exception 'Expected seller sub-order count is invalid.' using errcode = '22023';
  end if;

  select o.* into current_order from public.orders o where o.id = p_order_id for update;
  if current_order.id is null then raise exception 'Order not found.' using errcode = 'P0002'; end if;
  if current_order.invoice_allocation_status = 'COMPLETE' then
    if current_order.expected_seller_sub_order_count <> p_expected_sub_order_count then
      raise exception 'Completed allocation count cannot change.' using errcode = '23514';
    end if;
    return current_order;
  end if;

  select count(*) into actual_sub_order_count
  from public.seller_sub_orders sso
  where sso.order_id = p_order_id and sso.resolution_status = 'RESOLVED';
  if actual_sub_order_count <> p_expected_sub_order_count then
    raise exception 'Resolved seller sub-order count does not match expected count.' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.seller_sub_orders sso
    where sso.order_id = p_order_id and sso.resolution_status <> 'RESOLVED'
  ) then raise exception 'Order has unresolved seller sub-orders.' using errcode = '23514'; end if;

  select count(*), count(*) filter (where oi.seller_id is not null and oi.seller_sub_order_id is not null)
  into order_item_count, assigned_item_count
  from public.order_items oi
  where oi.order_id = p_order_id;
  if order_item_count < 1 or assigned_item_count <> order_item_count then
    raise exception 'Every order item must be assigned before allocation completion.' using errcode = '23514';
  end if;
  if exists (
    select 1
    from public.order_items oi
    left join public.seller_sub_orders sso on sso.id = oi.seller_sub_order_id
    where oi.order_id = p_order_id
      and (sso.id is null or sso.order_id <> p_order_id or sso.seller_id <> oi.seller_id)
  ) then raise exception 'Order item seller allocation is inconsistent.' using errcode = '23514'; end if;
  if exists (
    select 1
    from public.seller_sub_orders sso
    left join lateral (
      select
        count(*) as item_count,
        coalesce(sum(round(coalesce(oi.unit_price, oi.price)::numeric * oi.quantity::numeric, 2)), 0) as subtotal,
        coalesce(sum(oi.discount_amount), 0) as discount_total,
        coalesce(sum(oi.tax_amount), 0) as item_tax_total,
        coalesce(sum(oi.invoice_line_total), 0) as item_grand_total,
        count(*) filter (
          where oi.quantity is null or oi.quantity <= 0
             or coalesce(oi.unit_price, oi.price) is null
             or oi.discount_amount is null or oi.tax_rate is null
             or oi.tax_amount is null or oi.invoice_line_total is null
             or nullif(trim(coalesce(oi.unit_code, '')), '') is null
        ) as invalid_count
      from public.order_items oi
      where oi.order_id = p_order_id and oi.seller_sub_order_id = sso.id
    ) totals on true
    where sso.order_id = p_order_id
      and (
        totals.item_count < 1
        or totals.invalid_count > 0
        or totals.subtotal <> sso.subtotal
        or totals.discount_total <> sso.discount_total
        or totals.item_tax_total + coalesce(sso.shipping_tax_amount, 0) <> sso.tax_total
        or totals.item_grand_total + sso.shipping_total <> sso.grand_total
      )
  ) then raise exception 'Seller sub-order totals do not match the final item allocation.' using errcode = '23514'; end if;

  update public.orders o
  set invoice_allocation_status = 'COMPLETE',
      expected_seller_sub_order_count = p_expected_sub_order_count,
      invoice_allocation_completed_at = now(),
      updated_at = now()
  where o.id = p_order_id
  returning o.* into updated_order;
  return updated_order;
end;
$$;

revoke all on function public.complete_order_invoice_allocation(uuid, integer) from public, anon, authenticated;
grant execute on function public.complete_order_invoice_allocation(uuid, integer) to service_role;

create or replace view public.invoice_api_rows
with (security_invoker = true)
as
select
  id, organization_id, legal_entity_id, seller_id, order_id, sub_order_id,
  customer_id, customer_invoice_profile_id, sales_channel, sales_channel_account_id, sales_channel_order_id,
  provider, provider_document_id, document_scope, original_invoice_id,
  document_type, scenario, ettn_uuid, invoice_number, issue_date, currency,
  subtotal::text as subtotal,
  discount_total::text as discount_total,
  shipping_total::text as shipping_total,
  shipping_tax_rate::text as shipping_tax_rate,
  shipping_tax_amount::text as shipping_tax_amount,
  tax_total::text as tax_total,
  grand_total::text as grand_total,
  status, error_code, retry_count, issued_at, sent_at, accepted_at, cancelled_at,
  created_at, updated_at
from public.invoices;

grant select on public.invoice_api_rows to authenticated, service_role;

-- All timestamps on mutable configuration and operational records are maintained centrally.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'organizations', 'organization_members', 'legal_entities', 'legal_entity_members',
    'seller_profiles', 'sales_channels', 'sales_channel_accounts', 'sales_channel_account_members',
    'invoice_profiles', 'invoice_provider_accounts', 'invoice_settings', 'customer_invoice_profiles',
    'seller_sub_orders', 'invoices', 'invoice_jobs', 'invoice_channel_deliveries', 'invoice_returns', 'invoice_cancellations',
    'commission_billing_documents', 'invoice_reconciliation_records'
  ] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', target_table, target_table);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      target_table,
      target_table
    );
  end loop;
end $$;

create or replace function public.prevent_invoice_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Financial event records are append-only.' using errcode = '42501';
end;
$$;

drop trigger if exists invoice_events_append_only on public.invoice_events;
create trigger invoice_events_append_only
  before update or delete on public.invoice_events
  for each row execute function public.prevent_invoice_event_mutation();

drop trigger if exists invoice_webhook_events_append_only_delete on public.invoice_webhook_events;
create trigger invoice_webhook_events_append_only_delete
  before delete on public.invoice_webhook_events
  for each row execute function public.prevent_invoice_event_mutation();

create or replace function public.protect_invoice_webhook_envelope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  transition_allowed boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.processing_status not in ('VERIFIED', 'REJECTED') then
      raise exception 'Webhook events must start VERIFIED or REJECTED.' using errcode = '23514';
    end if;
    if new.processing_status = 'VERIFIED' and (not new.signature_valid or new.replay_detected) then
      raise exception 'Unverified or replayed webhook cannot start VERIFIED.' using errcode = '23514';
    end if;
    if new.processing_started_at is not null or new.processed_at is not null then
      raise exception 'New webhook event cannot start with processing timestamps.' using errcode = '23514';
    end if;
    return new;
  end if;
  if new.organization_id is distinct from old.organization_id
     or new.provider_account_id is distinct from old.provider_account_id
     or new.provider_event_id is distinct from old.provider_event_id
     or new.event_type is distinct from old.event_type
     or new.event_timestamp is distinct from old.event_timestamp
     or new.nonce is distinct from old.nonce
     or new.signature_valid is distinct from old.signature_valid
     or new.replay_detected is distinct from old.replay_detected
     or new.sanitized_payload is distinct from old.sanitized_payload
     or new.request_id is distinct from old.request_id
     or new.received_at is distinct from old.received_at then
    raise exception 'Webhook audit envelope is immutable.' using errcode = '42501';
  end if;
  if old.processing_status in ('PROCESSED', 'REJECTED', 'FAILED')
     and new.processing_status is distinct from old.processing_status then
    raise exception 'Webhook terminal status is immutable.' using errcode = '23514';
  end if;
  if new.processing_status is distinct from old.processing_status then
    transition_allowed := case old.processing_status
      when 'VERIFIED' then new.processing_status = 'PROCESSING'
      when 'PROCESSING' then new.processing_status in ('VERIFIED', 'PROCESSED', 'FAILED')
      else false
    end;
    if not transition_allowed then
      raise exception 'Invalid webhook processing transition: % -> %', old.processing_status, new.processing_status using errcode = '23514';
    end if;
  end if;
  if new.processing_status = 'PROCESSED'
     and (not old.signature_valid or old.replay_detected) then
    raise exception 'Unverified or replayed webhook cannot be processed.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists invoice_webhook_events_protect_envelope on public.invoice_webhook_events;
create trigger invoice_webhook_events_protect_envelope
  before insert or update on public.invoice_webhook_events
  for each row execute function public.protect_invoice_webhook_envelope();

create or replace function public.enforce_invoice_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  allowed boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'DRAFT' then
      raise exception 'New invoices must start in DRAFT.' using errcode = '23514';
    end if;
    return new;
  end if;
  if new.status = old.status then
    return new;
  end if;

  allowed := case old.status
    when 'DRAFT' then new.status in ('QUEUED', 'FAILED', 'NEEDS_REVIEW')
    when 'QUEUED' then new.status in ('PROCESSING', 'FAILED', 'NEEDS_REVIEW')
    when 'PROCESSING' then new.status in ('ISSUED', 'FAILED', 'NEEDS_REVIEW')
    when 'ISSUED' then new.status in ('SENT', 'ACCEPTED', 'REJECTED', 'CANCEL_PENDING', 'RETURNED', 'NEEDS_REVIEW')
    when 'SENT' then new.status in ('ACCEPTED', 'REJECTED', 'CANCEL_PENDING', 'RETURNED', 'FAILED', 'NEEDS_REVIEW')
    when 'ACCEPTED' then new.status in ('CANCEL_PENDING', 'RETURNED', 'NEEDS_REVIEW')
    when 'REJECTED' then new.status = 'NEEDS_REVIEW'
    when 'CANCEL_PENDING' then new.status in ('CANCELLED', 'FAILED', 'NEEDS_REVIEW')
    when 'FAILED' then new.status in ('QUEUED', 'NEEDS_REVIEW')
    when 'NEEDS_REVIEW' then new.status in ('DRAFT', 'QUEUED', 'CANCEL_PENDING', 'FAILED')
    when 'RETURNED' then new.status in ('CANCEL_PENDING', 'CANCELLED')
    else false
  end;

  if not allowed then
    raise exception 'Invalid invoice status transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;
  if new.status = 'CANCELLED' and not exists (
    select 1 from public.invoice_cancellations ic
    where ic.invoice_id = new.id and ic.status = 'COMPLETED'
  ) then
    raise exception 'Invoice cancellation workflow is not completed.' using errcode = '23514';
  end if;
  if new.status = 'RETURNED' and (
    not exists (select 1 from public.invoice_items ii where ii.invoice_id = new.id)
    or not exists (
      select 1 from public.invoice_returns ir
      where ir.original_invoice_id = new.id and ir.status = 'COMPLETED'
    )
    or exists (
      select 1
      from public.invoice_items ii
      where ii.invoice_id = new.id
        and coalesce((
          select sum(iri.quantity)
          from public.invoice_return_items iri
          join public.invoice_returns ir on ir.id = iri.invoice_return_id
          where iri.original_invoice_item_id = ii.id and ir.status = 'COMPLETED'
        ), 0) <> ii.quantity
    )
  ) then
    raise exception 'Invoice return workflow does not cover all original quantities.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_validate_status_transition on public.invoices;
create trigger invoices_validate_status_transition
  before insert or update on public.invoices
  for each row execute function public.enforce_invoice_status_transition();

create or replace function public.transition_invoice_with_event(
  p_invoice_id uuid,
  p_expected_status text,
  p_next_status text,
  p_patch jsonb default '{}'::jsonb,
  p_action text default 'invoice.status_changed',
  p_actor_id uuid default null,
  p_actor_role text default null,
  p_request_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.invoices
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  current_row public.invoices;
  updated_row public.invoices;
  unsupported_key text;
begin
  select * into current_row from public.invoices where id = p_invoice_id for update;
  if current_row.id is null then raise exception 'Invoice not found.' using errcode = 'P0002'; end if;
  if current_row.status is distinct from p_expected_status then
    raise exception 'Invoice status changed concurrently.' using errcode = '40001';
  end if;
  select key into unsupported_key
  from jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) key
  where key not in (
    'provider_document_id', 'ettn_uuid', 'invoice_number', 'issue_date',
    'pdf_reference', 'xml_reference', 'issued_at', 'sent_at', 'accepted_at',
    'cancelled_at', 'error_code', 'error_message', 'retry_count'
  )
  limit 1;
  if unsupported_key is not null then
    raise exception 'Unsupported invoice transition patch key: %', unsupported_key using errcode = '22023';
  end if;

  update public.invoices i
  set status = p_next_status,
      provider_document_id = case when p_patch ? 'provider_document_id' then p_patch->>'provider_document_id' else i.provider_document_id end,
      ettn_uuid = case when p_patch ? 'ettn_uuid' then nullif(p_patch->>'ettn_uuid', '')::uuid else i.ettn_uuid end,
      invoice_number = case when p_patch ? 'invoice_number' then p_patch->>'invoice_number' else i.invoice_number end,
      issue_date = case when p_patch ? 'issue_date' then nullif(p_patch->>'issue_date', '')::date else i.issue_date end,
      pdf_reference = case when p_patch ? 'pdf_reference' then p_patch->>'pdf_reference' else i.pdf_reference end,
      xml_reference = case when p_patch ? 'xml_reference' then p_patch->>'xml_reference' else i.xml_reference end,
      issued_at = case when p_patch ? 'issued_at' then nullif(p_patch->>'issued_at', '')::timestamptz else i.issued_at end,
      sent_at = case when p_patch ? 'sent_at' then nullif(p_patch->>'sent_at', '')::timestamptz else i.sent_at end,
      accepted_at = case when p_patch ? 'accepted_at' then nullif(p_patch->>'accepted_at', '')::timestamptz else i.accepted_at end,
      cancelled_at = case when p_patch ? 'cancelled_at' then nullif(p_patch->>'cancelled_at', '')::timestamptz else i.cancelled_at end,
      error_code = case when p_patch ? 'error_code' then p_patch->>'error_code' else i.error_code end,
      error_message = case when p_patch ? 'error_message' then p_patch->>'error_message' else i.error_message end,
      retry_count = case when p_patch ? 'retry_count' then (p_patch->>'retry_count')::integer else i.retry_count end,
      updated_at = now()
  where i.id = current_row.id and i.status = p_expected_status
  returning i.* into updated_row;

  if updated_row.id is null then raise exception 'Invoice transition lost concurrent update.' using errcode = '40001'; end if;
  insert into public.invoice_events (
    invoice_id, organization_id, actor_id, actor_role, action,
    old_state, new_state, request_id, correlation_id, metadata
  ) values (
    updated_row.id, updated_row.organization_id, p_actor_id, p_actor_role,
    coalesce(nullif(p_action, ''), 'invoice.status_changed'),
    jsonb_build_object('status', current_row.status),
    jsonb_build_object('status', updated_row.status),
    p_request_id, p_request_id, coalesce(p_metadata, '{}'::jsonb)
  );
  return updated_row;
end;
$$;

revoke all on function public.transition_invoice_with_event(uuid, text, text, jsonb, text, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.transition_invoice_with_event(uuid, text, text, jsonb, text, uuid, text, text, jsonb) to service_role;

create or replace function public.enforce_invoice_cancellation_transition()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  allowed boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'REQUESTED' then
      raise exception 'New invoice cancellation workflows must start REQUESTED.' using errcode = '23514';
    end if;
    return new;
  end if;
  if new.status = old.status then return new; end if;
  allowed := case old.status
    when 'REQUESTED' then new.status in ('REVIEW', 'QUEUED', 'REJECTED', 'NEEDS_REVIEW')
    when 'REVIEW' then new.status in ('QUEUED', 'REJECTED', 'NEEDS_REVIEW')
    when 'QUEUED' then new.status in ('PROCESSING', 'FAILED', 'NEEDS_REVIEW')
    when 'PROCESSING' then new.status in ('COMPLETED', 'FAILED', 'NEEDS_REVIEW')
    when 'FAILED' then new.status in ('QUEUED', 'NEEDS_REVIEW')
    when 'NEEDS_REVIEW' then new.status in ('REVIEW', 'QUEUED', 'REJECTED')
    else false
  end;
  if not allowed then
    raise exception 'Invalid invoice cancellation status transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists invoice_cancellations_validate_transition on public.invoice_cancellations;
create trigger invoice_cancellations_validate_transition
  before insert or update of status on public.invoice_cancellations
  for each row execute function public.enforce_invoice_cancellation_transition();

-- A late asynchronous provider confirmation may arrive after the cancel job
-- was marked FAILED/NEEDS_REVIEW. Complete the workflow and invoice in one
-- transaction so the invoice CANCELLED invariant is never temporarily broken.
create or replace function public.complete_invoice_cancellation_with_event(
  p_invoice_id uuid,
  p_expected_invoice_status text,
  p_provider_reference text default null,
  p_action text default 'invoice.provider_cancellation_confirmed',
  p_request_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.invoices
language plpgsql
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
declare
  current_invoice public.invoices;
  workflow public.invoice_cancellations;
  updated_invoice public.invoices;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;
  select i.* into current_invoice from public.invoices i where i.id = p_invoice_id for update;
  if current_invoice.id is null then raise exception 'Invoice not found.' using errcode = 'P0002'; end if;
  if current_invoice.status = 'CANCELLED' then return current_invoice; end if;
  if current_invoice.status <> p_expected_invoice_status then
    raise exception 'Invoice status changed concurrently.' using errcode = '40001';
  end if;

  select ic.* into workflow
  from public.invoice_cancellations ic
  where ic.invoice_id = p_invoice_id and ic.status <> 'REJECTED'
  order by ic.created_at desc
  limit 1
  for update;
  if workflow.id is null then raise exception 'Cancellation workflow not found.' using errcode = 'P0002'; end if;

  if workflow.status in ('FAILED', 'NEEDS_REVIEW', 'REVIEW', 'REQUESTED') then
    update public.invoice_cancellations
    set status = 'QUEUED', updated_at = now()
    where id = workflow.id;
    workflow.status := 'QUEUED';
  end if;
  if workflow.status = 'QUEUED' then
    update public.invoice_cancellations
    set status = 'PROCESSING', updated_at = now()
    where id = workflow.id;
    workflow.status := 'PROCESSING';
  end if;
  if workflow.status = 'PROCESSING' then
    update public.invoice_cancellations
    set status = 'COMPLETED',
        provider_reference = coalesce(nullif(p_provider_reference, ''), provider_reference),
        updated_at = now()
    where id = workflow.id;
    workflow.status := 'COMPLETED';
  end if;
  if workflow.status <> 'COMPLETED' then
    raise exception 'Cancellation workflow cannot be completed.' using errcode = '23514';
  end if;

  if current_invoice.status = 'FAILED' then
    select * into current_invoice
    from public.transition_invoice_with_event(
      current_invoice.id,
      current_invoice.status,
      'NEEDS_REVIEW',
      jsonb_build_object('error_code', null, 'error_message', null),
      coalesce(nullif(p_action, ''), 'invoice.provider_cancellation_confirmed') || '.failed_recovered',
      null,
      'system',
      p_request_id,
      coalesce(p_metadata, '{}'::jsonb)
    );
  end if;

  if current_invoice.status = 'NEEDS_REVIEW' then
    select * into current_invoice
    from public.transition_invoice_with_event(
      current_invoice.id,
      current_invoice.status,
      'CANCEL_PENDING',
      jsonb_build_object('error_code', null, 'error_message', null),
      coalesce(nullif(p_action, ''), 'invoice.provider_cancellation_confirmed') || '.recovered',
      null,
      'system',
      p_request_id,
      coalesce(p_metadata, '{}'::jsonb)
    );
  end if;

  select * into updated_invoice
  from public.transition_invoice_with_event(
    current_invoice.id,
    current_invoice.status,
    'CANCELLED',
    jsonb_build_object('cancelled_at', now()),
    p_action,
    null,
    'system',
    p_request_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
  return updated_invoice;
end;
$$;

revoke all on function public.complete_invoice_cancellation_with_event(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.complete_invoice_cancellation_with_event(uuid, text, text, text, text, jsonb) to service_role;

create or replace function public.enforce_invoice_return_transition()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  allowed boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'REQUESTED' then
      raise exception 'New invoice return workflows must start REQUESTED.' using errcode = '23514';
    end if;
    return new;
  end if;
  if new.status = old.status then return new; end if;
  if new.status = 'REJECTED' then
    if nullif(trim(coalesce(new.rejection_reason, '')), '') is null
       or new.rejected_by is null
       or new.rejected_at is null then
      raise exception 'Rejected return workflow requires actor, reason and timestamp.' using errcode = '23514';
    end if;
    perform 1
    from public.invoice_items ii
    where ii.invoice_id = old.original_invoice_id
    order by ii.id
    for update;
    if new.return_invoice_id is not null and exists (
      select 1 from public.invoices ri
      where ri.id = new.return_invoice_id
        and (
          ri.status not in ('DRAFT', 'QUEUED', 'FAILED', 'NEEDS_REVIEW')
          or ri.provider_document_id is not null
          or ri.ettn_uuid is not null
          or ri.invoice_number is not null
          or ri.issued_at is not null
          or ri.pdf_reference is not null
          or ri.xml_reference is not null
        )
    ) then raise exception 'Issued or processing return document cannot be rejected.' using errcode = '23514'; end if;
    if exists (
      select 1 from public.invoice_jobs j
      where j.job_type = 'CREATE_RETURN_DOCUMENT'
        and j.organization_id = new.organization_id
        and j.payload->>'invoiceReturnId' = new.id::text
        and j.invoice_id is not distinct from new.return_invoice_id
        and (j.status in ('PENDING', 'PROCESSING', 'RETRY_SCHEDULED', 'SUCCEEDED') or j.provider_call_started_at is not null)
    ) then raise exception 'Active or dispatched return job prevents rejection.' using errcode = '23514'; end if;
  end if;
  allowed := case old.status
    when 'REQUESTED' then new.status in ('REVIEW', 'QUEUED', 'REJECTED', 'NEEDS_REVIEW')
    when 'REVIEW' then new.status in ('QUEUED', 'REJECTED', 'NEEDS_REVIEW')
    when 'QUEUED' then new.status in ('PROCESSING', 'FAILED', 'REJECTED', 'NEEDS_REVIEW')
    when 'PROCESSING' then new.status in ('COMPLETED', 'FAILED', 'NEEDS_REVIEW')
    when 'FAILED' then new.status in ('QUEUED', 'REJECTED', 'NEEDS_REVIEW')
    when 'NEEDS_REVIEW' then new.status in ('REVIEW', 'QUEUED', 'REJECTED')
    else false
  end;
  if not allowed then
    raise exception 'Invalid invoice return status transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists invoice_returns_validate_transition on public.invoice_returns;
create trigger invoice_returns_validate_transition
  before insert or update of status on public.invoice_returns
  for each row execute function public.enforce_invoice_return_transition();

-- Tenant access helpers are SECURITY DEFINER so table RLS does not recurse.
create or replace function public.organization_member_has_access(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.organization_members om
      where om.organization_id = target_organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    );
$$;

-- Visibility of the organization shell is deliberately separate from access to
-- all records in that organization. A store member must never inherit sibling
-- legal-entity, seller, store, invoice, provider, or customer data.
create or replace function public.organization_visible_to_user(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select public.organization_member_has_access(target_organization_id)
    or exists (
      select 1
      from public.legal_entity_members lem
      join public.legal_entities le on le.id = lem.legal_entity_id
      where le.organization_id = target_organization_id
        and lem.user_id = auth.uid()
        and lem.status = 'active'
    )
    or exists (
      select 1
      from public.sales_channel_account_members scam
      join public.sales_channel_accounts sca on sca.id = scam.sales_channel_account_id
      where sca.organization_id = target_organization_id
        and scam.user_id = auth.uid()
        and scam.status = 'active'
    )
    or exists (
      select 1
      from public.seller_profiles sp
      join public.partner_businesses pb on pb.id = sp.partner_business_id
      left join public.partner_staff ps
        on ps.partner_id = pb.id
       and ps.user_id = auth.uid()
       and ps.status = 'active'
       and ps.staff_role in ('owner', 'manager', 'accounting')
      where sp.organization_id = target_organization_id
        and pb.status = 'active'
        and pb.verification_status = 'verified'
        and (pb.owner_id = auth.uid() or ps.id is not null)
    );
$$;

create or replace function public.organization_member_can_manage(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select public.e_invoicing_has_write_assurance()
    and (
      public.is_admin()
      or exists (
        select 1 from public.organization_members om
        where om.organization_id = target_organization_id
          and om.user_id = auth.uid()
          and om.status = 'active'
          and om.member_role in ('owner', 'admin')
      )
    );
$$;

create or replace function public.legal_entity_member_has_access(target_legal_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.legal_entities le
      where le.id = target_legal_entity_id
        and public.organization_member_has_access(le.organization_id)
    )
    or exists (
      select 1 from public.legal_entity_members lem
      where lem.legal_entity_id = target_legal_entity_id
        and lem.user_id = auth.uid()
        and lem.status = 'active'
    );
$$;

create or replace function public.legal_entity_member_can_manage(target_legal_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select public.e_invoicing_has_write_assurance()
    and (
      public.is_admin()
      or exists (
        select 1
        from public.legal_entities le
        where le.id = target_legal_entity_id
          and public.organization_member_can_manage(le.organization_id)
      )
      or exists (
        select 1 from public.legal_entity_members lem
        where lem.legal_entity_id = target_legal_entity_id
          and lem.user_id = auth.uid()
          and lem.status = 'active'
          and lem.member_role in ('owner', 'admin')
      )
    );
$$;

create or replace function public.seller_member_has_access(target_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.seller_profiles sp
      where sp.id = target_seller_id
        and public.legal_entity_member_has_access(sp.legal_entity_id)
    )
    or exists (
      select 1
      from public.seller_profiles sp
      join public.partner_businesses pb on pb.id = sp.partner_business_id
      left join public.partner_staff ps
        on ps.partner_id = pb.id
       and ps.user_id = auth.uid()
       and ps.status = 'active'
       and ps.staff_role in ('owner', 'manager', 'accounting')
      where sp.id = target_seller_id
        and pb.status = 'active'
        and pb.verification_status = 'verified'
        and (pb.owner_id = auth.uid() or ps.id is not null)
    );
$$;

create or replace function public.seller_member_can_manage(target_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select public.e_invoicing_has_write_assurance()
    and (
      public.is_admin()
      or exists (
        select 1 from public.seller_profiles sp
        where sp.id = target_seller_id
          and public.legal_entity_member_can_manage(sp.legal_entity_id)
      )
      or exists (
        select 1
        from public.seller_profiles sp
        join public.partner_businesses pb on pb.id = sp.partner_business_id
        left join public.partner_staff ps
          on ps.partner_id = pb.id
         and ps.user_id = auth.uid()
         and ps.status = 'active'
         and ps.staff_role in ('owner', 'manager')
        where sp.id = target_seller_id
          and pb.status = 'active'
          and pb.verification_status = 'verified'
          and (pb.owner_id = auth.uid() or ps.id is not null)
      )
    );
$$;

revoke all on function public.seller_member_can_manage(uuid) from public, anon;
grant execute on function public.seller_member_can_manage(uuid) to authenticated, service_role;

create or replace function public.sales_channel_account_member_can_manage(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select public.e_invoicing_has_write_assurance()
    and (
      public.is_admin()
      or exists (
        select 1
        from public.sales_channel_accounts sca
        where sca.id = target_account_id
          and public.seller_member_can_manage(sca.seller_id)
      )
      or exists (
        select 1
        from public.sales_channel_account_members scam
        where scam.sales_channel_account_id = target_account_id
          and scam.user_id = auth.uid()
          and scam.status = 'active'
          and scam.member_role in ('owner', 'admin')
      )
    );
$$;

revoke all on function public.sales_channel_account_member_can_manage(uuid) from public, anon;
grant execute on function public.sales_channel_account_member_can_manage(uuid) to authenticated, service_role;

create or replace function public.sales_channel_account_member_has_access(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.sales_channel_accounts sca
      where sca.id = target_account_id
        and public.legal_entity_member_has_access(sca.legal_entity_id)
    )
    or exists (
      select 1 from public.sales_channel_account_members scam
      where scam.sales_channel_account_id = target_account_id
        and scam.user_id = auth.uid()
        and scam.status = 'active'
    );
$$;

create or replace function public.seller_visible_to_user(target_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select public.seller_member_has_access(target_seller_id)
    or exists (
      select 1
      from public.sales_channel_accounts sca
      join public.sales_channel_account_members scam
        on scam.sales_channel_account_id = sca.id
       and scam.user_id = auth.uid()
       and scam.status = 'active'
      where sca.seller_id = target_seller_id
    );
$$;

create or replace function public.invoice_record_has_access(target_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (
    select 1 from public.invoices i
    where i.id = target_invoice_id
      and (
        i.customer_id = auth.uid()
        or public.organization_member_has_access(i.organization_id)
        or public.legal_entity_member_has_access(i.legal_entity_id)
        or public.seller_member_has_access(i.seller_id)
        or (
          i.sales_channel_account_id is not null
          and public.sales_channel_account_member_has_access(i.sales_channel_account_id)
        )
      )
  );
$$;

create or replace function public.invoice_operational_record_has_access(target_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (
    select 1 from public.invoices i
    where i.id = target_invoice_id
      and (
        public.organization_member_has_access(i.organization_id)
        or public.legal_entity_member_has_access(i.legal_entity_id)
        or public.seller_member_has_access(i.seller_id)
        or (
          i.sales_channel_account_id is not null
          and public.sales_channel_account_member_has_access(i.sales_channel_account_id)
        )
      )
  );
$$;

create or replace function public.list_partner_order_summaries()
returns table(
  id uuid,
  order_number text,
  total text,
  order_status text,
  payment_status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  with authorized_sub_orders as (
    select distinct sso.id, sso.order_id, sso.grand_total
    from public.seller_sub_orders sso
    where public.is_admin()
      or public.seller_member_has_access(sso.seller_id)
      or (
        sso.sales_channel_account_id is not null
        and public.sales_channel_account_member_has_access(sso.sales_channel_account_id)
      )
  ),
  authorized_legacy_items as (
    select oi.order_id, coalesce(oi.invoice_line_total, oi.price * oi.quantity) as line_total
    from public.order_items oi
    where oi.seller_sub_order_id is null
      and (
        public.is_admin()
        or (
          oi.partner_id = auth.uid()
          and exists (
            select 1 from public.partner_businesses pb
            where pb.owner_id = auth.uid()
              and pb.status = 'active'
              and pb.verification_status = 'verified'
          )
        )
      )
  ),
  scoped_totals as (
    select amounts.order_id, sum(amounts.amount) as partner_total
    from (
      select aso.order_id, aso.grand_total as amount from authorized_sub_orders aso
      union all
      select ali.order_id, sum(ali.line_total) as amount
      from authorized_legacy_items ali
      group by ali.order_id
    ) amounts
    group by amounts.order_id
  )
  select
    o.id,
    coalesce(nullif(o.order_number, ''), nullif(o.order_no, ''), o.id::text),
    st.partner_total::text,
    o.order_status::text,
    o.payment_status::text,
    o.created_at
  from public.orders o
  join scoped_totals st on st.order_id = o.id
  where auth.uid() is not null
  order by o.created_at desc
  limit 200;
$$;

revoke all on function public.list_partner_order_summaries() from public, anon;
grant execute on function public.list_partner_order_summaries() to authenticated;

create or replace function public.activate_invoice_profile(
  p_profile_id uuid,
  p_organization_id uuid
)
returns public.invoice_profiles
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  target_profile public.invoice_profiles;
  activated_profile public.invoice_profiles;
begin
  select * into target_profile
  from public.invoice_profiles ip
  where ip.id = p_profile_id and ip.organization_id = p_organization_id;
  if target_profile.id is null then raise exception 'Invoice profile not found.' using errcode = 'P0002'; end if;

  -- Every activation for one legal entity takes the same parent lock first;
  -- concurrent default switches therefore cannot deadlock on A/B target rows.
  perform 1
  from public.legal_entities le
  where le.id = target_profile.legal_entity_id
    and le.organization_id = p_organization_id
  for update;

  select * into target_profile
  from public.invoice_profiles ip
  where ip.id = p_profile_id
    and ip.organization_id = p_organization_id
    and ip.legal_entity_id = target_profile.legal_entity_id
  for update;
  if target_profile.id is null then raise exception 'Invoice profile changed concurrently.' using errcode = '40001'; end if;
  if target_profile.status = 'archived' then
    raise exception 'Archived invoice profile cannot be activated.' using errcode = '23514';
  end if;

  perform 1
  from public.invoice_profiles ip
  where ip.legal_entity_id = target_profile.legal_entity_id
  order by ip.id
  for update;

  if target_profile.is_default then
    update public.invoice_profiles ip
    set is_default = false, updated_at = now()
    where ip.legal_entity_id = target_profile.legal_entity_id
      and ip.id <> target_profile.id
      and ip.is_default
      and ip.status = 'active';
  end if;

  update public.invoice_profiles ip
  set status = 'active', updated_at = now()
  where ip.id = target_profile.id
  returning * into activated_profile;
  return activated_profile;
end;
$$;

-- Serialize mutually exclusive financial document domains at the original
-- sales-invoice row. Same-domain RETURN reservations are reusable for later
-- partial returns; an opposite-domain reservation always fails closed.
create or replace function public.reserve_invoice_document_operation(
  p_invoice_id uuid,
  p_operation_type text
)
returns public.invoice_document_operation_guards
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  source_invoice public.invoices;
  active_guard public.invoice_document_operation_guards;
  requested_operation text := upper(trim(coalesce(p_operation_type, '')));
begin
  if requested_operation not in ('RETURN', 'CANCELLATION') then
    raise exception 'Unsupported invoice document operation.' using errcode = '22023';
  end if;

  select * into source_invoice
  from public.invoices i
  where i.id = p_invoice_id
  for update;
  if source_invoice.id is null then raise exception 'Invoice not found.' using errcode = 'P0002'; end if;
  if source_invoice.document_scope <> 'CUSTOMER_SALE'
     or source_invoice.document_type not in ('E_INVOICE', 'E_ARCHIVE') then
    raise exception 'Document operation requires a customer sale invoice.' using errcode = '23514';
  end if;

  if requested_operation = 'RETURN' then
    if source_invoice.status not in ('ISSUED', 'SENT', 'ACCEPTED') then
      raise exception 'Invoice is not returnable.' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.invoice_cancellations ic
      where ic.invoice_id = source_invoice.id and ic.status <> 'REJECTED'
    ) then raise exception 'Invoice already has a cancellation workflow.' using errcode = '23514'; end if;
  else
    if source_invoice.status not in ('ISSUED', 'SENT', 'ACCEPTED') then
      raise exception 'Invoice is not cancellable.' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.invoice_returns ir
      where ir.original_invoice_id = source_invoice.id and ir.status <> 'REJECTED'
    ) then raise exception 'Invoice already has a return workflow.' using errcode = '23514'; end if;
  end if;

  select * into active_guard
  from public.invoice_document_operation_guards idog
  where idog.invoice_id = source_invoice.id and idog.status = 'ACTIVE'
  for update;

  -- Recover only an expired pre-workflow reservation. Once a workflow or any
  -- provider evidence exists, the domain guard is permanent/fail-closed.
  if active_guard.id is not null
     and active_guard.operation_type <> requested_operation
     and active_guard.reservation_expires_at <= now()
     and not exists (
       select 1 from public.invoice_returns ir
       where ir.original_invoice_id = source_invoice.id
     )
     and not exists (
       select 1 from public.invoice_cancellations ic
       where ic.invoice_id = source_invoice.id
     )
     and not exists (
       select 1 from public.invoice_jobs j
       where j.invoice_id = source_invoice.id
         and j.job_type = 'CANCEL_DOCUMENT'
     )
     and not exists (
       select 1 from public.invoices ri
       where ri.original_invoice_id = source_invoice.id
         and ri.document_scope = 'RETURN'
         and (
           ri.status in ('PROCESSING', 'ISSUED', 'SENT', 'ACCEPTED', 'RETURNED')
           or ri.provider_document_id is not null
           or ri.ettn_uuid is not null
           or ri.invoice_number is not null
           or ri.issued_at is not null
         )
     ) then
    update public.invoice_document_operation_guards
    set status = 'RELEASED',
        released_reason = 'EXPIRED_PRE_WORKFLOW_RESERVATION',
        released_at = now(),
        updated_at = now()
    where id = active_guard.id;
    active_guard := null;
  end if;

  if active_guard.id is null then
    begin
      insert into public.invoice_document_operation_guards (
        organization_id, invoice_id, operation_type, status, reservation_expires_at
      ) values (
        source_invoice.organization_id, source_invoice.id, requested_operation, 'ACTIVE', now() + interval '5 minutes'
      ) returning * into active_guard;
    exception when unique_violation then
      select * into active_guard
      from public.invoice_document_operation_guards idog
      where idog.invoice_id = source_invoice.id and idog.status = 'ACTIVE'
      for update;
    end;
  end if;

  if active_guard.id is null or active_guard.operation_type <> requested_operation then
    raise exception 'Invoice has a conflicting document operation.' using errcode = '23514';
  end if;
  return active_guard;
end;
$$;

-- Persist the fact that an outbound provider call may have happened before
-- crossing the network boundary. This marker is never cleared by retry.
create or replace function public.mark_invoice_job_provider_call_started(
  p_job_id uuid,
  p_lock_token uuid,
  p_source_invoice_id uuid,
  p_operation_type text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  current_job public.invoice_jobs;
  source_invoice public.invoices;
  requested_operation text := upper(trim(coalesce(p_operation_type, '')));
  marked_id uuid;
begin
  select * into current_job
  from public.invoice_jobs j
  where j.id = p_job_id
    and j.status = 'PROCESSING'
    and j.lock_token = p_lock_token
    and j.lock_expires_at > now()
  for update;
  if current_job.id is null then return false; end if;

  select * into source_invoice
  from public.invoices i
  where i.id = p_source_invoice_id
  for update;
  if source_invoice.id is null then return false; end if;

  if requested_operation = 'RETURN' then
    if current_job.job_type <> 'CREATE_RETURN_DOCUMENT'
       or source_invoice.status not in ('ISSUED', 'SENT', 'ACCEPTED')
       or not exists (
         select 1
         from public.invoice_returns ir
         where ir.id = nullif(current_job.payload->>'invoiceReturnId', '')::uuid
           and ir.original_invoice_id = source_invoice.id
           and ir.return_invoice_id = current_job.invoice_id
           and ir.status in ('QUEUED', 'PROCESSING')
       )
       or exists (
         select 1 from public.invoice_cancellations ic
         where ic.invoice_id = source_invoice.id and ic.status <> 'REJECTED'
       ) then return false; end if;
  elsif requested_operation = 'CANCELLATION' then
    if current_job.job_type <> 'CANCEL_DOCUMENT'
       or current_job.invoice_id <> source_invoice.id
       or source_invoice.status <> 'CANCEL_PENDING'
       or not exists (
         select 1
         from public.invoice_cancellations ic
         where ic.id = nullif(current_job.payload->>'cancellationId', '')::uuid
           and ic.invoice_id = source_invoice.id
           and ic.status in ('QUEUED', 'PROCESSING')
       )
       or exists (
         select 1 from public.invoice_returns ir
         where ir.original_invoice_id = source_invoice.id and ir.status <> 'REJECTED'
       ) then return false; end if;
  else
    return false;
  end if;

  if not exists (
    select 1 from public.invoice_document_operation_guards idog
    where idog.invoice_id = source_invoice.id
      and idog.organization_id = source_invoice.organization_id
      and idog.operation_type = requested_operation
      and idog.status = 'ACTIVE'
  ) then return false; end if;

  update public.invoice_jobs j
  set provider_call_started_at = coalesce(j.provider_call_started_at, now()),
      updated_at = now()
  where j.id = p_job_id
    and j.status = 'PROCESSING'
    and j.lock_token = p_lock_token
    and j.lock_expires_at > now()
  returning j.id into marked_id;
  return marked_id is not null;
end;
$$;

-- Reject an unissued return request and release its quantity reservation only
-- when no provider network boundary was ever crossed. Rows are locked in one
-- transaction so a worker cannot be claimed after quantities are released.
create or replace function public.reject_invoice_return_request(
  p_return_id uuid,
  p_actor_id uuid,
  p_actor_role text,
  p_request_id text,
  p_reason text
)
returns public.invoice_returns
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  current_return public.invoice_returns;
  return_invoice public.invoices;
  previous_invoice_status text;
  result_return public.invoice_returns;
  normalized_reason text := left(trim(coalesce(p_reason, '')), 1000);
begin
  if char_length(normalized_reason) < 3 then
    raise exception 'Return rejection reason is required.' using errcode = '22023';
  end if;

  select * into current_return
  from public.invoice_returns ir
  where ir.id = p_return_id
  for update;
  if current_return.id is null then raise exception 'Return workflow not found.' using errcode = 'P0002'; end if;
  if current_return.status = 'REJECTED' then return current_return; end if;
  if current_return.status not in ('REQUESTED', 'REVIEW', 'QUEUED', 'FAILED', 'NEEDS_REVIEW') then
    raise exception 'Return workflow cannot be rejected in its current state.' using errcode = '23514';
  end if;

  perform 1
  from public.invoice_items ii
  where ii.invoice_id = current_return.original_invoice_id
  order by ii.id
  for update;

  if current_return.return_invoice_id is not null then
    select * into return_invoice
    from public.invoices i
    where i.id = current_return.return_invoice_id
    for update;
    if return_invoice.id is null then raise exception 'Return invoice not found.' using errcode = 'P0002'; end if;
    if return_invoice.status not in ('DRAFT', 'QUEUED', 'FAILED', 'NEEDS_REVIEW')
       or return_invoice.provider_document_id is not null
       or return_invoice.ettn_uuid is not null
       or return_invoice.invoice_number is not null
       or return_invoice.issued_at is not null
       or return_invoice.pdf_reference is not null
       or return_invoice.xml_reference is not null then
      raise exception 'Issued or processing return document cannot release its reservation.' using errcode = '23514';
    end if;
  end if;

  perform 1
  from public.invoice_jobs j
  where j.job_type = 'CREATE_RETURN_DOCUMENT'
    and j.organization_id = current_return.organization_id
    and j.payload->>'invoiceReturnId' = current_return.id::text
    and j.invoice_id is not distinct from current_return.return_invoice_id
  order by j.id
  for update;

  if exists (
    select 1 from public.invoice_jobs j
    where j.job_type = 'CREATE_RETURN_DOCUMENT'
      and j.organization_id = current_return.organization_id
      and j.payload->>'invoiceReturnId' = current_return.id::text
      and j.invoice_id is not distinct from current_return.return_invoice_id
      and (
        j.status in ('PROCESSING', 'SUCCEEDED')
        or j.provider_call_started_at is not null
      )
  ) then raise exception 'Return provider call may have started; reservation cannot be released.' using errcode = '23514'; end if;

  update public.invoice_jobs j
  set status = 'NEEDS_REVIEW',
      locked_at = null,
      lock_expires_at = null,
      lock_token = null,
      locked_by = null,
      next_attempt_at = now(),
      last_error_code = 'RETURN_REQUEST_REJECTED',
      last_error_message = 'Return request was rejected before any provider call started.',
      updated_at = now()
  where j.job_type = 'CREATE_RETURN_DOCUMENT'
    and j.organization_id = current_return.organization_id
    and j.payload->>'invoiceReturnId' = current_return.id::text
    and j.invoice_id is not distinct from current_return.return_invoice_id
    and j.status in ('PENDING', 'FAILED', 'RETRY_SCHEDULED', 'NEEDS_REVIEW');

  if return_invoice.id is not null then
    previous_invoice_status := return_invoice.status;
    update public.invoices i
    set status = 'FAILED',
        error_code = 'RETURN_REQUEST_REJECTED',
        error_message = 'Return request was rejected before provider dispatch.',
        updated_at = now()
    where i.id = return_invoice.id;

    insert into public.invoice_events (
      invoice_id, organization_id, actor_id, actor_role, action,
      old_state, new_state, request_id, correlation_id, metadata
    ) values (
      return_invoice.id, return_invoice.organization_id, p_actor_id, left(p_actor_role, 80),
      'invoice.return_request_rejected',
      jsonb_build_object('status', previous_invoice_status),
      jsonb_build_object('status', 'FAILED'),
      p_request_id, p_request_id,
      jsonb_build_object('invoice_return_id', current_return.id, 'reason', normalized_reason)
    );
  end if;

  update public.invoice_returns ir
  set status = 'REJECTED',
      rejection_reason = normalized_reason,
      rejected_by = p_actor_id,
      rejected_at = now(),
      updated_at = now()
  where ir.id = current_return.id and ir.status = current_return.status
  returning * into result_return;
  if result_return.id is null then raise exception 'Return workflow changed concurrently.' using errcode = '40001'; end if;

  update public.invoice_document_operation_guards idog
  set status = 'RELEASED',
      released_reason = 'ALL_RETURN_WORKFLOWS_REJECTED_BEFORE_PROVIDER_CALL',
      released_at = now(),
      updated_at = now()
  where idog.invoice_id = current_return.original_invoice_id
    and idog.operation_type = 'RETURN'
    and idog.status = 'ACTIVE'
    and not exists (
      select 1 from public.invoice_returns other_return
      where other_return.original_invoice_id = current_return.original_invoice_id
        and other_return.status <> 'REJECTED'
    );

  return result_return;
end;
$$;

-- Job claim uses SKIP LOCKED and a lease to prevent two workers from issuing one document.
create or replace function public.claim_invoice_jobs(
  p_worker_id text,
  p_limit integer default 10,
  p_lease_seconds integer default 120
)
returns setof public.invoice_jobs
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  stranded_job public.invoice_jobs;
  stranded_invoice_status text;
  stranded_workflow_id uuid;
begin
  if nullif(trim(coalesce(p_worker_id, '')), '') is null then
    raise exception 'worker id is required' using errcode = '22023';
  end if;

  -- Final expired leases are moved to NEEDS_REVIEW together with their
  -- invoice/workflow. This prevents an unretryable PROCESSING orphan.
  for stranded_job in
    select j.*
    from public.invoice_jobs j
    where j.status = 'PROCESSING'
      and j.lock_expires_at < now()
      and j.attempt_count >= j.max_attempts
    for update skip locked
  loop
    update public.invoice_jobs j
    set status = 'NEEDS_REVIEW',
        locked_at = null,
        lock_expires_at = null,
        lock_token = null,
        locked_by = null,
        last_error_code = 'WORKER_LEASE_EXPIRED_MAX_ATTEMPTS',
        last_error_message = 'Worker lease expired on the final allowed attempt.',
        updated_at = now()
    where j.id = stranded_job.id;

    if stranded_job.invoice_id is not null
       and stranded_job.job_type in ('CREATE_DOCUMENT', 'CREATE_RETURN_DOCUMENT', 'CANCEL_DOCUMENT') then
      select i.status into stranded_invoice_status
      from public.invoices i
      where i.id = stranded_job.invoice_id
      for update;
      if stranded_invoice_status in ('DRAFT', 'QUEUED', 'PROCESSING', 'FAILED', 'CANCEL_PENDING') then
        perform public.transition_invoice_with_event(
          stranded_job.invoice_id,
          stranded_invoice_status,
          'NEEDS_REVIEW',
          jsonb_build_object(
            'error_code', 'WORKER_LEASE_EXPIRED_MAX_ATTEMPTS',
            'error_message', 'Worker lease expired on the final allowed attempt.'
          ),
          'invoice.worker_lease_expired',
          null,
          'system',
          stranded_job.request_id,
          jsonb_build_object('job_id', stranded_job.id, 'job_type', stranded_job.job_type)
        );
      end if;
    end if;

    if stranded_job.job_type = 'CREATE_RETURN_DOCUMENT' then
      stranded_workflow_id := case
        when coalesce(stranded_job.payload->>'invoiceReturnId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (stranded_job.payload->>'invoiceReturnId')::uuid
        else null
      end;
      if stranded_workflow_id is not null then
        update public.invoice_returns
        set status = 'NEEDS_REVIEW', updated_at = now()
        where id = stranded_workflow_id
          and return_invoice_id = stranded_job.invoice_id
          and status in ('REQUESTED', 'REVIEW', 'QUEUED', 'PROCESSING', 'FAILED');
      end if;
    elsif stranded_job.job_type = 'CANCEL_DOCUMENT' then
      stranded_workflow_id := case
        when coalesce(stranded_job.payload->>'cancellationId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (stranded_job.payload->>'cancellationId')::uuid
        else null
      end;
      if stranded_workflow_id is not null then
        update public.invoice_cancellations
        set status = 'NEEDS_REVIEW', updated_at = now()
        where id = stranded_workflow_id
          and invoice_id = stranded_job.invoice_id
          and status in ('REQUESTED', 'REVIEW', 'QUEUED', 'PROCESSING', 'FAILED');
      end if;
    elsif stranded_job.job_type = 'UPLOAD_TO_CHANNEL' then
      update public.invoice_channel_deliveries
      set status = 'NEEDS_REVIEW',
          processing_started_at = null,
          lock_expires_at = null,
          lock_token = null,
          job_id = null,
          sanitized_result = jsonb_build_object('error_code', 'WORKER_LEASE_EXPIRED_MAX_ATTEMPTS'),
          updated_at = now()
      where invoice_id = stranded_job.invoice_id
        and job_id = stranded_job.id
        and status = 'PROCESSING';
    end if;

    insert into public.invoice_failures (
      organization_id, invoice_id, job_id, failure_stage, error_code, error_message,
      retryable, attempt_number, request_id, correlation_id
    ) values (
      stranded_job.organization_id, stranded_job.invoice_id, stranded_job.id, stranded_job.job_type,
      'WORKER_LEASE_EXPIRED_MAX_ATTEMPTS',
      'Worker lease expired on the final allowed attempt.',
      false, stranded_job.attempt_count, stranded_job.request_id, stranded_job.correlation_id
    );
  end loop;

  return query
  with candidates as (
    select j.id
    from public.invoice_jobs j
    left join public.invoices i on i.id = j.invoice_id
    left join public.invoice_provider_accounts ipa on ipa.id = i.provider_account_id
    left join public.sales_channel_accounts sca on sca.id = i.sales_channel_account_id
    where (
      (j.status in ('PENDING', 'RETRY_SCHEDULED') and j.next_attempt_at <= now())
      or (j.status = 'PROCESSING' and j.lock_expires_at < now())
    )
      and j.attempt_count < j.max_attempts
      and not (
        (j.job_type in ('CREATE_DOCUMENT', 'FETCH_ARTIFACTS', 'REFRESH_STATUS', 'CANCEL_DOCUMENT', 'CREATE_RETURN_DOCUMENT') and coalesce(ipa.status = 'paused', false))
        or (j.job_type = 'UPLOAD_TO_CHANNEL' and coalesce(sca.status = 'paused', false))
      )
    order by j.next_attempt_at, j.created_at
    for update of j skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 100))
  )
  update public.invoice_jobs j
  set status = 'PROCESSING',
      attempt_count = j.attempt_count + 1,
      locked_at = now(),
      lock_expires_at = now() + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 120), 3600))),
      lock_token = gen_random_uuid(),
      locked_by = left(p_worker_id, 160),
      updated_at = now()
  from candidates c
  where j.id = c.id
  returning j.*;
end;
$$;

create or replace function public.complete_invoice_job(
  p_job_id uuid,
  p_lock_token uuid,
  p_result jsonb default '{}'::jsonb
)
returns public.invoice_jobs
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  result_row public.invoice_jobs;
begin
  update public.invoice_jobs
  set status = 'SUCCEEDED',
      result = coalesce(p_result, '{}'::jsonb),
      completed_at = now(),
      locked_at = null,
      lock_expires_at = null,
      lock_token = null,
      locked_by = null,
      last_error_code = null,
      last_error_message = null,
      updated_at = now()
  where id = p_job_id
    and status = 'PROCESSING'
    and lock_token = p_lock_token
    and lock_expires_at > now()
  returning * into result_row;

  if result_row.id is null then
    raise exception 'Invoice job lease is invalid or expired.' using errcode = 'P0001';
  end if;
  return result_row;
end;
$$;

create or replace function public.renew_invoice_job_lease(
  p_job_id uuid,
  p_lock_token uuid,
  p_lease_seconds integer default 120
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  renewed boolean := false;
  renewed_job_type text;
  renewed_invoice_id uuid;
  renewed_until timestamptz;
begin
  update public.invoice_jobs
  set lock_expires_at = now() + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 120), 3600))),
      updated_at = now()
  where id = p_job_id
    and status = 'PROCESSING'
    and lock_token = p_lock_token
    and lock_expires_at > now()
  returning true, job_type, invoice_id, lock_expires_at
    into renewed, renewed_job_type, renewed_invoice_id, renewed_until;

  if coalesce(renewed, false) and renewed_job_type = 'UPLOAD_TO_CHANNEL' then
    update public.invoice_channel_deliveries
    set lock_expires_at = renewed_until,
        updated_at = now()
    where invoice_id = renewed_invoice_id
      and job_id = p_job_id
      and status = 'PROCESSING'
      and lock_token = p_lock_token;
  end if;
  return coalesce(renewed, false);
end;
$$;

create or replace function public.fail_invoice_job(
  p_job_id uuid,
  p_lock_token uuid,
  p_error_code text,
  p_error_message text,
  p_retry_after_seconds integer default 60,
  p_retryable boolean default true
)
returns public.invoice_jobs
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  current_job public.invoice_jobs;
  result_row public.invoice_jobs;
  next_status text;
  current_invoice_status text;
  workflow_id uuid;
begin
  select * into current_job
  from public.invoice_jobs
  where id = p_job_id
    and status = 'PROCESSING'
    and lock_token = p_lock_token
    and lock_expires_at > now()
  for update;

  if current_job.id is null then
    raise exception 'Invoice job lease is invalid or expired.' using errcode = 'P0001';
  end if;

  next_status := case
    when not coalesce(p_retryable, true) then 'NEEDS_REVIEW'
    when current_job.attempt_count >= current_job.max_attempts then 'NEEDS_REVIEW'
    else 'RETRY_SCHEDULED'
  end;

  update public.invoice_jobs
  set status = next_status,
      next_attempt_at = case
        when next_status = 'RETRY_SCHEDULED'
          then now() + make_interval(secs => greatest(1, least(coalesce(p_retry_after_seconds, 60), 86400)))
        else next_attempt_at
      end,
      locked_at = null,
      lock_expires_at = null,
      lock_token = null,
      locked_by = null,
      last_error_code = left(coalesce(p_error_code, 'JOB_FAILED'), 120),
      last_error_message = left(coalesce(p_error_message, 'Invoice job failed.'), 2000),
      updated_at = now()
  where id = current_job.id
  returning * into result_row;

  insert into public.invoice_failures (
    organization_id, invoice_id, job_id, failure_stage, error_code, error_message,
    retryable, attempt_number, request_id, correlation_id
  ) values (
    current_job.organization_id, current_job.invoice_id, current_job.id, current_job.job_type,
    left(coalesce(p_error_code, 'JOB_FAILED'), 120),
    left(coalesce(p_error_message, 'Invoice job failed.'), 2000),
    next_status = 'RETRY_SCHEDULED', current_job.attempt_count,
    current_job.request_id, current_job.correlation_id
  );

  if next_status = 'NEEDS_REVIEW'
     and current_job.invoice_id is not null
     and current_job.job_type in ('CREATE_DOCUMENT', 'CREATE_RETURN_DOCUMENT', 'CANCEL_DOCUMENT') then
    select i.status into current_invoice_status
    from public.invoices i
    where i.id = current_job.invoice_id
    for update;

    if current_invoice_status in ('DRAFT', 'QUEUED', 'PROCESSING', 'FAILED', 'CANCEL_PENDING') then
      perform public.transition_invoice_with_event(
        current_job.invoice_id,
        current_invoice_status,
        'NEEDS_REVIEW',
        jsonb_build_object(
          'error_code', left(coalesce(p_error_code, 'JOB_FAILED'), 120),
          'error_message', left(coalesce(p_error_message, 'Invoice job failed.'), 2000)
        ),
        'invoice.job_terminal_failure',
        null,
        'system',
        current_job.request_id,
        jsonb_build_object('job_id', current_job.id, 'job_type', current_job.job_type)
      );
    end if;

    if current_job.job_type = 'CREATE_RETURN_DOCUMENT' then
      workflow_id := case
        when coalesce(current_job.payload->>'invoiceReturnId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (current_job.payload->>'invoiceReturnId')::uuid
        else null
      end;
      if workflow_id is not null then
        update public.invoice_returns
        set status = 'NEEDS_REVIEW', updated_at = now()
        where id = workflow_id
          and return_invoice_id = current_job.invoice_id
          and status in ('REQUESTED', 'REVIEW', 'QUEUED', 'PROCESSING', 'FAILED');
      end if;
    elsif current_job.job_type = 'CANCEL_DOCUMENT' then
      workflow_id := case
        when coalesce(current_job.payload->>'cancellationId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (current_job.payload->>'cancellationId')::uuid
        else null
      end;
      if workflow_id is not null then
        update public.invoice_cancellations
        set status = 'NEEDS_REVIEW', updated_at = now()
        where id = workflow_id
          and invoice_id = current_job.invoice_id
          and status in ('REQUESTED', 'REVIEW', 'QUEUED', 'PROCESSING', 'FAILED');
      end if;
    end if;
  end if;

  return result_row;
end;
$$;

create or replace function public.retry_invoice_job(
  p_job_id uuid,
  p_actor_id uuid default null,
  p_actor_role text default null,
  p_request_id text default null
)
returns public.invoice_jobs
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  current_job public.invoice_jobs;
  current_invoice public.invoices;
  workflow_id uuid;
  workflow_status text;
  target_invoice_status text;
  result_job public.invoice_jobs;
begin
  select * into current_job
  from public.invoice_jobs j
  where j.id = p_job_id
  for update;

  if current_job.id is null then raise exception 'Invoice job not found.' using errcode = 'P0002'; end if;
  if current_job.status not in ('FAILED', 'NEEDS_REVIEW') then
    raise exception 'Invoice job is not retryable.' using errcode = '23514';
  end if;
  if current_job.attempt_count >= current_job.max_attempts or current_job.attempt_count >= 20 then
    raise exception 'Invoice job reached its retry limit.' using errcode = '23514';
  end if;
  if current_job.invoice_id is null then
    raise exception 'Retryable invoice job must reference an invoice.' using errcode = '23514';
  end if;

  select * into current_invoice
  from public.invoices i
  where i.id = current_job.invoice_id
  for update;
  if current_invoice.id is null then raise exception 'Invoice not found.' using errcode = 'P0002'; end if;

  if current_job.job_type in ('CREATE_DOCUMENT', 'CREATE_RETURN_DOCUMENT') then
    if current_invoice.status not in ('DRAFT', 'FAILED', 'NEEDS_REVIEW', 'QUEUED') then
      raise exception 'Invoice is not retryable for document creation.' using errcode = '23514';
    end if;
    target_invoice_status := 'QUEUED';
    if current_job.job_type = 'CREATE_RETURN_DOCUMENT' then
      workflow_id := nullif(current_job.payload->>'invoiceReturnId', '')::uuid;
      if workflow_id is null then raise exception 'Return workflow id is missing.' using errcode = '23514'; end if;
      select status into workflow_status
      from public.invoice_returns
      where id = workflow_id and return_invoice_id = current_job.invoice_id
      for update;
      if workflow_status is null then raise exception 'Return workflow not found.' using errcode = 'P0002'; end if;
      if workflow_status not in ('FAILED', 'NEEDS_REVIEW', 'QUEUED') then
        raise exception 'Return workflow is not retryable.' using errcode = '23514';
      end if;
      if workflow_status <> 'QUEUED' then
        update public.invoice_returns set status = 'QUEUED', updated_at = now() where id = workflow_id;
      end if;
    end if;
  elsif current_job.job_type = 'CANCEL_DOCUMENT' then
    if current_invoice.status not in ('ISSUED', 'SENT', 'ACCEPTED', 'RETURNED', 'NEEDS_REVIEW', 'CANCEL_PENDING') then
      raise exception 'Invoice is not retryable for cancellation.' using errcode = '23514';
    end if;
    target_invoice_status := 'CANCEL_PENDING';
    workflow_id := nullif(current_job.payload->>'cancellationId', '')::uuid;
    if workflow_id is null then raise exception 'Cancellation workflow id is missing.' using errcode = '23514'; end if;
    select status into workflow_status
    from public.invoice_cancellations
    where id = workflow_id and invoice_id = current_job.invoice_id
    for update;
    if workflow_status is null then raise exception 'Cancellation workflow not found.' using errcode = 'P0002'; end if;
    if workflow_status not in ('FAILED', 'NEEDS_REVIEW', 'QUEUED') then
      raise exception 'Cancellation workflow is not retryable.' using errcode = '23514';
    end if;
    if workflow_status <> 'QUEUED' then
      update public.invoice_cancellations set status = 'QUEUED', updated_at = now() where id = workflow_id;
    end if;
  elsif current_job.job_type not in ('UPLOAD_TO_CHANNEL', 'REFRESH_STATUS') then
    raise exception 'Invoice job type is not manually retryable.' using errcode = '23514';
  end if;

  if target_invoice_status is not null and current_invoice.status <> target_invoice_status then
    select * into current_invoice
    from public.transition_invoice_with_event(
      current_invoice.id,
      current_invoice.status,
      target_invoice_status,
      jsonb_build_object('error_code', null, 'error_message', null),
      case when current_job.job_type = 'CANCEL_DOCUMENT' then 'invoice.cancellation_manual_retry' else 'invoice.manual_retry' end,
      p_actor_id,
      p_actor_role,
      p_request_id,
      jsonb_build_object('job_type', current_job.job_type, 'job_id', current_job.id)
    );
  end if;

  update public.invoice_jobs j
  set status = 'RETRY_SCHEDULED',
      next_attempt_at = now(),
      locked_at = null,
      lock_expires_at = null,
      lock_token = null,
      locked_by = null,
      last_error_code = null,
      last_error_message = null,
      completed_at = null,
      result = null,
      updated_at = now()
  where j.id = current_job.id and j.status = current_job.status
  returning j.* into result_job;

  if result_job.id is null then raise exception 'Invoice job changed concurrently.' using errcode = '40001'; end if;
  return result_job;
end;
$$;

revoke all on function public.claim_invoice_jobs(text, integer, integer) from public, anon, authenticated;
revoke all on function public.activate_invoice_profile(uuid, uuid) from public, anon, authenticated;
revoke all on function public.reserve_invoice_document_operation(uuid, text) from public, anon, authenticated;
revoke all on function public.mark_invoice_job_provider_call_started(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.reject_invoice_return_request(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.complete_invoice_job(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.renew_invoice_job_lease(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.fail_invoice_job(uuid, uuid, text, text, integer, boolean) from public, anon, authenticated;
revoke all on function public.retry_invoice_job(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_invoice_jobs(text, integer, integer) to service_role;
grant execute on function public.activate_invoice_profile(uuid, uuid) to service_role;
grant execute on function public.reserve_invoice_document_operation(uuid, text) to service_role;
grant execute on function public.mark_invoice_job_provider_call_started(uuid, uuid, uuid, text) to service_role;
grant execute on function public.reject_invoice_return_request(uuid, uuid, text, text, text) to service_role;
grant execute on function public.complete_invoice_job(uuid, uuid, jsonb) to service_role;
grant execute on function public.renew_invoice_job_lease(uuid, uuid, integer) to service_role;
grant execute on function public.fail_invoice_job(uuid, uuid, text, text, integer, boolean) to service_role;
grant execute on function public.retry_invoice_job(uuid, uuid, text, text) to service_role;

-- Private artifacts. No client SELECT policy is created; backend service issues short-lived signed URLs.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'private-invoice-documents',
      'private-invoice-documents',
      false,
      15728640,
      array['application/pdf', 'application/xml', 'text/xml']
    )
    on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;

-- Correct the legacy multi-seller leak: direct partner RLS sees only its own rows.
-- Partner operational order access continues through the scoped backend API.
drop policy if exists "orders_select_own_or_admin" on public.orders;
create policy "orders_select_own_or_admin"
  on public.orders for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "order_items_select_own_or_admin" on public.order_items;
create policy "order_items_select_own_or_admin"
  on public.order_items for select
  to authenticated
  using (
    public.is_admin()
    or (
      seller_sub_order_id is null
      and partner_id = auth.uid()
      and exists (
        select 1 from public.partner_businesses pb
        where pb.owner_id = auth.uid()
          and pb.status = 'active'
          and pb.verification_status = 'verified'
      )
    )
    or (
      seller_sub_order_id is not null
      and exists (
        select 1 from public.seller_sub_orders sso
        where sso.id = order_items.seller_sub_order_id
          and (
            public.seller_member_has_access(sso.seller_id)
            or (
              sso.sales_channel_account_id is not null
              and public.sales_channel_account_member_has_access(sso.sales_channel_account_id)
            )
          )
      )
    )
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

-- RLS is enabled on every new tenant/financial table.
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.legal_entities enable row level security;
alter table public.legal_entity_members enable row level security;
alter table public.seller_profiles enable row level security;
alter table public.sales_channels enable row level security;
alter table public.sales_channel_accounts enable row level security;
alter table public.sales_channel_account_members enable row level security;
alter table public.invoice_profiles enable row level security;
alter table public.invoice_provider_accounts enable row level security;
alter table public.integration_credential_bindings enable row level security;
alter table public.invoice_settings enable row level security;
alter table public.customer_invoice_profiles enable row level security;
alter table public.seller_sub_orders enable row level security;
alter table public.invoice_order_events enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoice_events enable row level security;
alter table public.invoice_webhook_events enable row level security;
alter table public.invoice_jobs enable row level security;
alter table public.invoice_failures enable row level security;
alter table public.invoice_channel_deliveries enable row level security;
alter table public.invoice_returns enable row level security;
alter table public.invoice_return_items enable row level security;
alter table public.invoice_cancellations enable row level security;
alter table public.invoice_document_operation_guards enable row level security;
alter table public.commission_billing_documents enable row level security;
alter table public.commission_billing_items enable row level security;
alter table public.invoice_reconciliation_records enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select * from (values
      ('organizations', 'organizations_select_member'),
      ('organizations', 'organizations_insert_creator'),
      ('organizations', 'organizations_update_manager'),
      ('organization_members', 'organization_members_select_member'),
      ('organization_members', 'organization_members_manage'),
      ('legal_entities', 'legal_entities_select_member'),
      ('legal_entities', 'legal_entities_manage'),
      ('legal_entity_members', 'legal_entity_members_select'),
      ('legal_entity_members', 'legal_entity_members_manage'),
      ('seller_profiles', 'seller_profiles_select_member'),
      ('seller_profiles', 'seller_profiles_manage'),
      ('sales_channels', 'sales_channels_authenticated_read'),
      ('sales_channels', 'sales_channels_admin_manage'),
      ('sales_channel_accounts', 'sales_channel_accounts_select'),
      ('sales_channel_accounts', 'sales_channel_accounts_manage'),
      ('sales_channel_account_members', 'sales_channel_account_members_select'),
      ('sales_channel_account_members', 'sales_channel_account_members_manage'),
      ('invoice_profiles', 'invoice_profiles_select'),
      ('invoice_profiles', 'invoice_profiles_manage'),
      ('invoice_provider_accounts', 'invoice_provider_accounts_select'),
      ('invoice_provider_accounts', 'invoice_provider_accounts_manage'),
      ('invoice_settings', 'invoice_settings_select'),
      ('invoice_settings', 'invoice_settings_manage'),
      ('customer_invoice_profiles', 'customer_invoice_profiles_own_select'),
      ('customer_invoice_profiles', 'customer_invoice_profiles_own_insert'),
      ('customer_invoice_profiles', 'customer_invoice_profiles_own_update'),
      ('seller_sub_orders', 'seller_sub_orders_select'),
      ('invoices', 'invoices_select_authorized'),
      ('invoice_items', 'invoice_items_select_authorized'),
      ('invoice_events', 'invoice_events_select_authorized'),
      ('invoice_webhook_events', 'invoice_webhooks_tenant_read'),
      ('invoice_jobs', 'invoice_jobs_tenant_read'),
      ('invoice_failures', 'invoice_failures_tenant_read'),
      ('invoice_channel_deliveries', 'invoice_channel_deliveries_read'),
      ('invoice_returns', 'invoice_returns_authorized_read'),
      ('invoice_return_items', 'invoice_return_items_authorized_read'),
      ('invoice_cancellations', 'invoice_cancellations_authorized_read'),
      ('commission_billing_documents', 'commission_documents_tenant_read'),
      ('commission_billing_items', 'commission_items_tenant_read'),
      ('invoice_reconciliation_records', 'reconciliation_tenant_read')
    ) as policies(table_name, policy_name)
  loop
    execute format('drop policy if exists %I on public.%I', policy_row.policy_name, policy_row.table_name);
  end loop;
end $$;

create policy "organizations_select_member" on public.organizations for select to authenticated
  using (public.organization_visible_to_user(id));
create policy "organizations_insert_creator" on public.organizations for insert to authenticated
  with check (public.e_invoicing_has_write_assurance() and created_by = auth.uid());
create policy "organizations_update_manager" on public.organizations for update to authenticated
  using (public.organization_member_can_manage(id)) with check (public.organization_member_can_manage(id));

create policy "organization_members_select_member" on public.organization_members for select to authenticated
  using (public.organization_member_has_access(organization_id));
create policy "organization_members_manage" on public.organization_members for all to authenticated
  using (public.organization_member_can_manage(organization_id))
  with check (public.organization_member_can_manage(organization_id));

create policy "legal_entities_select_member" on public.legal_entities for select to authenticated
  using (public.legal_entity_member_has_access(id));
create policy "legal_entities_manage" on public.legal_entities for all to authenticated
  using (public.organization_member_can_manage(organization_id))
  with check (public.organization_member_can_manage(organization_id));

create policy "legal_entity_members_select" on public.legal_entity_members for select to authenticated
  using (public.legal_entity_member_has_access(legal_entity_id));
create policy "legal_entity_members_manage" on public.legal_entity_members for all to authenticated
  using (public.legal_entity_member_can_manage(legal_entity_id))
  with check (public.legal_entity_member_can_manage(legal_entity_id));

create policy "seller_profiles_select_member" on public.seller_profiles for select to authenticated
  using (public.seller_visible_to_user(id));
create policy "seller_profiles_manage" on public.seller_profiles for all to authenticated
  using (public.legal_entity_member_can_manage(legal_entity_id))
  with check (public.legal_entity_member_can_manage(legal_entity_id));

create policy "sales_channels_authenticated_read" on public.sales_channels for select to authenticated
  using (is_active or public.is_admin());
create policy "sales_channels_admin_manage" on public.sales_channels for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "sales_channel_accounts_select" on public.sales_channel_accounts for select to authenticated
  using (public.sales_channel_account_member_has_access(id));
create policy "sales_channel_accounts_manage" on public.sales_channel_accounts for all to authenticated
  using (public.legal_entity_member_can_manage(legal_entity_id))
  with check (public.legal_entity_member_can_manage(legal_entity_id));
create policy "sales_channel_account_members_select" on public.sales_channel_account_members for select to authenticated
  using (public.sales_channel_account_member_has_access(sales_channel_account_id));
create policy "sales_channel_account_members_manage" on public.sales_channel_account_members for all to authenticated
  using (
    exists (
      select 1 from public.sales_channel_accounts sca
      where sca.id = sales_channel_account_id
        and public.legal_entity_member_can_manage(sca.legal_entity_id)
    )
  ) with check (
    exists (
      select 1 from public.sales_channel_accounts sca
      where sca.id = sales_channel_account_id
        and public.legal_entity_member_can_manage(sca.legal_entity_id)
    )
  );

create policy "invoice_profiles_select" on public.invoice_profiles for select to authenticated
  using (public.legal_entity_member_has_access(legal_entity_id));
create policy "invoice_profiles_manage" on public.invoice_profiles for all to authenticated
  using (public.legal_entity_member_can_manage(legal_entity_id))
  with check (public.legal_entity_member_can_manage(legal_entity_id));
create policy "invoice_provider_accounts_select" on public.invoice_provider_accounts for select to authenticated
  using (public.legal_entity_member_has_access(legal_entity_id));
create policy "invoice_provider_accounts_manage" on public.invoice_provider_accounts for all to authenticated
  using (public.legal_entity_member_can_manage(legal_entity_id))
  with check (public.legal_entity_member_can_manage(legal_entity_id));
create policy "invoice_settings_select" on public.invoice_settings for select to authenticated
  using (public.legal_entity_member_has_access(legal_entity_id));
create policy "invoice_settings_manage" on public.invoice_settings for all to authenticated
  using (public.legal_entity_member_can_manage(legal_entity_id))
  with check (public.legal_entity_member_can_manage(legal_entity_id));

create policy "customer_invoice_profiles_own_select" on public.customer_invoice_profiles for select to authenticated
  using (customer_id = auth.uid() or public.is_admin());
create policy "customer_invoice_profiles_own_insert" on public.customer_invoice_profiles for insert to authenticated
  with check (customer_id = auth.uid());
create policy "customer_invoice_profiles_own_update" on public.customer_invoice_profiles for update to authenticated
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

create policy "seller_sub_orders_select" on public.seller_sub_orders for select to authenticated
  using (
    public.seller_member_has_access(seller_id)
    or (
      sales_channel_account_id is not null
      and public.sales_channel_account_member_has_access(sales_channel_account_id)
    )
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

create policy "invoices_select_authorized" on public.invoices for select to authenticated
  using (
    customer_id = auth.uid()
    or public.organization_member_has_access(organization_id)
    or public.legal_entity_member_has_access(legal_entity_id)
    or public.seller_member_has_access(seller_id)
    or (
      sales_channel_account_id is not null
      and public.sales_channel_account_member_has_access(sales_channel_account_id)
    )
  );
create policy "invoice_items_select_authorized" on public.invoice_items for select to authenticated
  using (public.invoice_record_has_access(invoice_id));
create policy "invoice_events_select_authorized" on public.invoice_events for select to authenticated
  using (public.invoice_operational_record_has_access(invoice_id));

create policy "invoice_webhooks_tenant_read" on public.invoice_webhook_events for select to authenticated
  using (
    public.organization_member_has_access(organization_id)
    or exists (
      select 1 from public.invoice_provider_accounts ipa
      where ipa.id = provider_account_id
        and public.legal_entity_member_has_access(ipa.legal_entity_id)
    )
  );
create policy "invoice_jobs_tenant_read" on public.invoice_jobs for select to authenticated
  using (
    public.organization_member_has_access(organization_id)
    or (invoice_id is not null and public.invoice_operational_record_has_access(invoice_id))
    or (seller_id is not null and public.seller_member_has_access(seller_id))
    or (
      sub_order_id is not null
      and exists (
        select 1 from public.seller_sub_orders sso
        where sso.id = sub_order_id
          and (
            public.seller_member_has_access(sso.seller_id)
            or (
              sso.sales_channel_account_id is not null
              and public.sales_channel_account_member_has_access(sso.sales_channel_account_id)
            )
          )
      )
    )
  );
create policy "invoice_failures_tenant_read" on public.invoice_failures for select to authenticated
  using (
    public.organization_member_has_access(organization_id)
    or (invoice_id is not null and public.invoice_operational_record_has_access(invoice_id))
  );
create policy "invoice_channel_deliveries_read" on public.invoice_channel_deliveries for select to authenticated
  using (public.invoice_operational_record_has_access(invoice_id));

create policy "invoice_returns_authorized_read" on public.invoice_returns for select to authenticated
  using (public.invoice_operational_record_has_access(original_invoice_id));
create policy "invoice_return_items_authorized_read" on public.invoice_return_items for select to authenticated
  using (
    exists (
      select 1 from public.invoice_returns ir
      where ir.id = invoice_return_id and public.invoice_operational_record_has_access(ir.original_invoice_id)
    )
  );
create policy "invoice_cancellations_authorized_read" on public.invoice_cancellations for select to authenticated
  using (public.invoice_operational_record_has_access(invoice_id));

create policy "commission_documents_tenant_read" on public.commission_billing_documents for select to authenticated
  using (public.legal_entity_member_has_access(legal_entity_id) or public.seller_member_has_access(seller_id));
create policy "commission_items_tenant_read" on public.commission_billing_items for select to authenticated
  using (
    exists (
      select 1 from public.commission_billing_documents cbd
      where cbd.id = commission_document_id
        and (public.legal_entity_member_has_access(cbd.legal_entity_id) or public.seller_member_has_access(cbd.seller_id))
    )
  );
create policy "reconciliation_tenant_read" on public.invoice_reconciliation_records for select to authenticated
  using (public.legal_entity_member_has_access(legal_entity_id) or public.seller_member_has_access(seller_id));

-- RLS decides which rows are visible; column grants also keep credential
-- references, customer snapshots, storage paths, idempotency keys and provider
-- error detail out of direct browser queries. The backend service role performs
-- privileged operations and returns explicit projections.
revoke all on public.integration_credential_bindings from anon, authenticated;
revoke all on public.invoice_order_events from anon, authenticated;
revoke all on public.invoice_document_operation_guards from anon, authenticated;

-- All connection and financial configuration writes pass through the audited
-- backend. This also prevents direct mutation of environment, provider key or
-- credential references even when a row-level manage policy is true.
revoke insert, update, delete on public.sales_channel_accounts from authenticated;
revoke insert, update, delete on public.invoice_provider_accounts from authenticated;
revoke insert, update, delete on public.invoice_profiles from authenticated;
revoke insert, update, delete on public.invoice_settings from authenticated;
revoke insert, update, delete on public.customer_invoice_profiles from authenticated;

revoke select on public.sales_channel_accounts from authenticated;
grant select (
  id, organization_id, legal_entity_id, seller_id, sales_channel_id,
  account_name, external_account_id, environment, capability_overrides, status,
  last_tested_at, last_error_code, created_at, updated_at
) on public.sales_channel_accounts to authenticated;

revoke select on public.invoice_provider_accounts from authenticated;
grant select (
  id, organization_id, legal_entity_id, provider_key, account_label,
  environment, capabilities, status, last_tested_at, last_error_code,
  created_at, updated_at
) on public.invoice_provider_accounts to authenticated;

revoke select on public.invoices from authenticated;
grant select (
  id, organization_id, legal_entity_id, seller_id, order_id, sub_order_id,
  customer_id, customer_invoice_profile_id, sales_channel, sales_channel_account_id, sales_channel_order_id,
  provider, provider_document_id, document_scope, original_invoice_id,
  document_type, scenario, ettn_uuid, invoice_number, issue_date, currency,
  subtotal, discount_total, shipping_total, shipping_tax_rate, shipping_tax_amount, tax_total, grand_total, status,
  error_code, retry_count, issued_at, sent_at, accepted_at, cancelled_at,
  created_at, updated_at
) on public.invoices to authenticated;

comment on table public.seller_sub_orders is
  'Seller-specific sub-orders. Legacy rows are not backfilled by guess; unresolved records remain NEEDS_REVIEW.';
comment on column public.invoice_provider_accounts.credential_reference is
  'Reference only (vault/env/secret URI). Never stores an API key, token, password, private key or webhook secret value.';
comment on table public.invoice_jobs is
  'Transactional outbox for invoice creation, artifact retrieval, status refresh, cancellation, return and channel upload.';
comment on table public.commission_billing_documents is
  'Commission billing domain, intentionally separate from customer sale invoices.';

notify pgrst, 'reload schema';
