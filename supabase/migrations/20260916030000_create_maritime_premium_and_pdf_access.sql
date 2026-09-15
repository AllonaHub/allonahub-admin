create extension if not exists pgcrypto;

create table if not exists public.maritime_commerce_settings (
  singleton boolean primary key default true check (singleton),
  premium_surface_enabled boolean not null default false,
  premium_entitlements_enabled boolean not null default false,
  premium_price numeric(12,2) not null default 79.00 check (premium_price >= 0),
  maritime_cv_pdf_price numeric(12,2) not null default 7.00 check (maritime_cv_pdf_price >= 0),
  global_cv_pdf_price numeric(12,2) not null default 15.00 check (global_cv_pdf_price >= 0),
  currency text not null default 'USD' check (currency = 'USD'),
  maritime_cv_refresh_downloads_per_purchase integer not null default 1 check (maritime_cv_refresh_downloads_per_purchase between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.maritime_commerce_settings (singleton)
values (true)
on conflict (singleton) do update
set premium_surface_enabled = false,
    premium_entitlements_enabled = false,
    premium_price = 79.00,
    maritime_cv_pdf_price = 7.00,
    global_cv_pdf_price = 15.00,
    currency = 'USD',
    maritime_cv_refresh_downloads_per_purchase = 1,
    updated_at = now();

create table if not exists public.maritime_premium_features (
  feature_key text primary key,
  display_order integer not null check (display_order > 0),
  premium_only_when_enabled boolean not null default true,
  launch_state text not null default 'hidden' check (launch_state in ('hidden', 'available', 'retired')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.maritime_premium_features (feature_key, display_order, premium_only_when_enabled, metadata)
values
  ('maritime_cv_pdf_download', 1, true, '{"label":"Maritime CV PDF download"}'::jsonb),
  ('global_cv_pdf_download', 2, true, '{"label":"Global CV PDF download"}'::jsonb),
  ('document_services', 3, false, '{"label":"Document upload and storage","always_free":true}'::jsonb),
  ('unlimited_applications', 4, true, '{"label":"Unlimited applications"}'::jsonb),
  ('smart_matching', 5, true, '{"label":"Smart matching"}'::jsonb),
  ('automatic_applications', 6, true, '{"label":"Automatic applications"}'::jsonb),
  ('campaign_access', 7, true, '{"label":"Campaign access"}'::jsonb),
  ('reviews_and_ratings', 8, true, '{"label":"Comments and ratings"}'::jsonb),
  ('unlimited_pdf_generation', 9, true, '{"label":"Unlimited PDF generation"}'::jsonb),
  ('priority_visibility', 10, true, '{"label":"Priority visibility"}'::jsonb),
  ('global_cv_create_update', 11, false, '{"label":"Global CV creation and updates","always_free":true}'::jsonb)
on conflict (feature_key) do update
set display_order = excluded.display_order,
    premium_only_when_enabled = excluded.premium_only_when_enabled,
    launch_state = 'hidden',
    metadata = excluded.metadata,
    updated_at = now();

create table if not exists public.maritime_premium_memberships (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan_key text not null default 'free' check (plan_key in ('free', 'premium')),
  status text not null default 'inactive' check (status in ('inactive', 'trialing', 'active', 'past_due', 'cancelled', 'expired')),
  starts_at timestamptz,
  expires_at timestamptz,
  provider text,
  provider_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.maritime_premium_memberships (user_id)
select profile.id
from public.profiles profile
on conflict (user_id) do nothing;

create or replace function public.ensure_maritime_premium_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.maritime_premium_memberships (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_ensure_maritime_premium_membership on public.profiles;
create trigger profiles_ensure_maritime_premium_membership
  after insert on public.profiles
  for each row execute function public.ensure_maritime_premium_membership();

create table if not exists public.maritime_pdf_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product text not null check (product in ('maritime_cv_pdf', 'global_cv_pdf')),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'USD' check (currency = 'USD'),
  status text not null default 'pending' check (status in ('pending', 'awaiting_payment', 'paid', 'failed', 'refunded')),
  provider text not null default 'bank_payment',
  provider_reference text,
  provider_status text,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists maritime_pdf_payments_user_status_idx
  on public.maritime_pdf_payments(user_id, status, created_at desc);

create table if not exists public.maritime_pdf_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  payment_id uuid not null unique references public.maritime_pdf_payments(id) on delete restrict,
  product text not null check (product in ('maritime_cv_pdf', 'global_cv_pdf')),
  initial_downloads_remaining integer not null default 1 check (initial_downloads_remaining between 0 and 10),
  refresh_downloads_remaining integer not null default 0 check (refresh_downloads_remaining between 0 and 10),
  last_download_source_version text,
  last_downloaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists maritime_pdf_entitlements_user_product_idx
  on public.maritime_pdf_entitlements(user_id, product, created_at);

create table if not exists public.maritime_pdf_downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product text not null check (product in ('maritime_cv_pdf', 'global_cv_pdf')),
  source_version text not null,
  idempotency_key uuid not null,
  access_source text not null check (access_source in ('paid_download', 'refresh_download', 'premium')),
  entitlement_id uuid references public.maritime_pdf_entitlements(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists maritime_pdf_downloads_user_product_idx
  on public.maritime_pdf_downloads(user_id, product, created_at desc);

create table if not exists public.maritime_vessel_lookup_cache (
  imo_number text primary key check (imo_number ~ '^[0-9]{7}$'),
  provider text not null check (provider in ('marinetraffic')),
  vessel_payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists maritime_commerce_settings_set_updated_at on public.maritime_commerce_settings;
create trigger maritime_commerce_settings_set_updated_at
  before update on public.maritime_commerce_settings
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_premium_features_set_updated_at on public.maritime_premium_features;
create trigger maritime_premium_features_set_updated_at
  before update on public.maritime_premium_features
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_premium_memberships_set_updated_at on public.maritime_premium_memberships;
create trigger maritime_premium_memberships_set_updated_at
  before update on public.maritime_premium_memberships
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_pdf_payments_set_updated_at on public.maritime_pdf_payments;
create trigger maritime_pdf_payments_set_updated_at
  before update on public.maritime_pdf_payments
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_pdf_entitlements_set_updated_at on public.maritime_pdf_entitlements;
create trigger maritime_pdf_entitlements_set_updated_at
  before update on public.maritime_pdf_entitlements
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_vessel_lookup_cache_set_updated_at on public.maritime_vessel_lookup_cache;
create trigger maritime_vessel_lookup_cache_set_updated_at
  before update on public.maritime_vessel_lookup_cache
  for each row execute function public.set_updated_at();

create or replace function public.grant_maritime_pdf_entitlement(
  p_payment_id uuid,
  p_provider_reference text,
  p_provider_status text default 'SUCCESS'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.maritime_pdf_payments%rowtype;
  v_settings public.maritime_commerce_settings%rowtype;
  v_entitlement public.maritime_pdf_entitlements%rowtype;
begin
  select * into v_payment
  from public.maritime_pdf_payments
  where id = p_payment_id
  for update;

  if v_payment.id is null then
    raise exception 'MARITIME_PDF_PAYMENT_NOT_FOUND';
  end if;

  select * into v_settings
  from public.maritime_commerce_settings
  where singleton = true;

  update public.maritime_pdf_payments
  set status = 'paid',
      provider_reference = nullif(trim(coalesce(p_provider_reference, '')), ''),
      provider_status = nullif(trim(coalesce(p_provider_status, 'SUCCESS')), ''),
      paid_at = coalesce(paid_at, now()),
      updated_at = now()
  where id = p_payment_id;

  insert into public.maritime_pdf_entitlements (
    user_id,
    payment_id,
    product,
    initial_downloads_remaining,
    refresh_downloads_remaining
  ) values (
    v_payment.user_id,
    v_payment.id,
    v_payment.product,
    1,
    case when v_payment.product = 'maritime_cv_pdf'
      then coalesce(v_settings.maritime_cv_refresh_downloads_per_purchase, 1)
      else 0
    end
  )
  on conflict (payment_id) do update
    set updated_at = now()
  returning * into v_entitlement;

  return jsonb_build_object(
    'ok', true,
    'payment_id', v_payment.id,
    'entitlement_id', v_entitlement.id,
    'product', v_entitlement.product
  );
end;
$$;

create or replace function public.consume_maritime_pdf_download(
  p_user_id uuid,
  p_product text,
  p_source_version text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.maritime_commerce_settings%rowtype;
  v_membership public.maritime_premium_memberships%rowtype;
  v_entitlement public.maritime_pdf_entitlements%rowtype;
  v_download public.maritime_pdf_downloads%rowtype;
  v_price numeric(12,2);
  v_access_source text;
begin
  if p_user_id is null or p_idempotency_key is null then
    raise exception 'MARITIME_PDF_DOWNLOAD_IDENTITY_REQUIRED';
  end if;
  if p_product not in ('maritime_cv_pdf', 'global_cv_pdf') then
    raise exception 'MARITIME_PDF_PRODUCT_INVALID';
  end if;
  if nullif(trim(coalesce(p_source_version, '')), '') is null then
    raise exception 'MARITIME_PDF_SOURCE_VERSION_REQUIRED';
  end if;

  select * into v_download
  from public.maritime_pdf_downloads
  where user_id = p_user_id
    and idempotency_key = p_idempotency_key;
  if v_download.id is not null then
    return jsonb_build_object(
      'ok', true,
      'allowed', true,
      'download_id', v_download.id,
      'access_source', v_download.access_source,
      'idempotent', true
    );
  end if;

  select * into v_settings
  from public.maritime_commerce_settings
  where singleton = true;
  v_price := case when p_product = 'maritime_cv_pdf'
    then coalesce(v_settings.maritime_cv_pdf_price, 7.00)
    else coalesce(v_settings.global_cv_pdf_price, 15.00)
  end;

  select * into v_membership
  from public.maritime_premium_memberships
  where user_id = p_user_id;

  if coalesce(v_settings.premium_entitlements_enabled, false)
    and v_membership.plan_key = 'premium'
    and v_membership.status in ('trialing', 'active')
    and (v_membership.starts_at is null or v_membership.starts_at <= now())
    and (v_membership.expires_at is null or v_membership.expires_at > now()) then
    v_access_source := 'premium';
  else
    select * into v_entitlement
    from public.maritime_pdf_entitlements
    where user_id = p_user_id
      and product = p_product
      and initial_downloads_remaining > 0
    order by created_at asc
    limit 1
    for update;

    if v_entitlement.id is not null then
      update public.maritime_pdf_entitlements
      set initial_downloads_remaining = initial_downloads_remaining - 1,
          last_download_source_version = p_source_version,
          last_downloaded_at = now(),
          updated_at = now()
      where id = v_entitlement.id;
      v_access_source := 'paid_download';
    elsif p_product = 'maritime_cv_pdf' then
      select * into v_entitlement
      from public.maritime_pdf_entitlements
      where user_id = p_user_id
        and product = p_product
        and refresh_downloads_remaining > 0
        and last_downloaded_at is not null
        and last_download_source_version is distinct from p_source_version
      order by created_at asc
      limit 1
      for update;

      if v_entitlement.id is not null then
        update public.maritime_pdf_entitlements
        set refresh_downloads_remaining = refresh_downloads_remaining - 1,
            last_download_source_version = p_source_version,
            last_downloaded_at = now(),
            updated_at = now()
        where id = v_entitlement.id;
        v_access_source := 'refresh_download';
      end if;
    end if;
  end if;

  if v_access_source is null then
    return jsonb_build_object(
      'ok', true,
      'allowed', false,
      'product', p_product,
      'price', v_price,
      'currency', coalesce(v_settings.currency, 'USD')
    );
  end if;

  insert into public.maritime_pdf_downloads (
    user_id,
    product,
    source_version,
    idempotency_key,
    access_source,
    entitlement_id
  ) values (
    p_user_id,
    p_product,
    p_source_version,
    p_idempotency_key,
    v_access_source,
    v_entitlement.id
  )
  returning * into v_download;

  return jsonb_build_object(
    'ok', true,
    'allowed', true,
    'download_id', v_download.id,
    'access_source', v_download.access_source,
    'idempotent', false
  );
end;
$$;

alter table public.maritime_commerce_settings enable row level security;
alter table public.maritime_premium_features enable row level security;
alter table public.maritime_premium_memberships enable row level security;
alter table public.maritime_pdf_payments enable row level security;
alter table public.maritime_pdf_entitlements enable row level security;
alter table public.maritime_pdf_downloads enable row level security;
alter table public.maritime_vessel_lookup_cache enable row level security;

drop policy if exists maritime_premium_memberships_select_own on public.maritime_premium_memberships;
create policy maritime_premium_memberships_select_own
on public.maritime_premium_memberships for select
to authenticated
using (user_id = auth.uid());

drop policy if exists maritime_pdf_payments_select_own on public.maritime_pdf_payments;
create policy maritime_pdf_payments_select_own
on public.maritime_pdf_payments for select
to authenticated
using (user_id = auth.uid());

drop policy if exists maritime_pdf_entitlements_select_own on public.maritime_pdf_entitlements;
create policy maritime_pdf_entitlements_select_own
on public.maritime_pdf_entitlements for select
to authenticated
using (user_id = auth.uid());

drop policy if exists maritime_pdf_downloads_select_own on public.maritime_pdf_downloads;
create policy maritime_pdf_downloads_select_own
on public.maritime_pdf_downloads for select
to authenticated
using (user_id = auth.uid());

revoke all on public.maritime_commerce_settings from public, anon, authenticated;
revoke all on public.maritime_premium_features from public, anon, authenticated;
revoke all on public.maritime_premium_memberships from public, anon, authenticated;
revoke all on public.maritime_pdf_payments from public, anon, authenticated;
revoke all on public.maritime_pdf_entitlements from public, anon, authenticated;
revoke all on public.maritime_pdf_downloads from public, anon, authenticated;
revoke all on public.maritime_vessel_lookup_cache from public, anon, authenticated;

grant select on public.maritime_premium_memberships to authenticated;
grant select on public.maritime_pdf_payments to authenticated;
grant select on public.maritime_pdf_entitlements to authenticated;
grant select on public.maritime_pdf_downloads to authenticated;

revoke all on function public.ensure_maritime_premium_membership() from public, anon, authenticated;
revoke all on function public.grant_maritime_pdf_entitlement(uuid, text, text) from public, anon, authenticated;
revoke all on function public.consume_maritime_pdf_download(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.grant_maritime_pdf_entitlement(uuid, text, text) to service_role;
grant execute on function public.consume_maritime_pdf_download(uuid, text, text, uuid) to service_role;
