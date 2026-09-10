create extension if not exists pgcrypto;

create table if not exists public.maritime_freight_offers (
  id uuid primary key default gen_random_uuid(),
  offer_reference text not null unique
    default ('MFO-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  client_offer_id uuid not null,
  freight_request_id uuid not null references public.maritime_freight_requests(id) on delete cascade,
  broker_user_id uuid not null references auth.users(id) on delete restrict,
  module_key text not null default 'maritime'
    check (module_key = 'maritime'),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'accepted', 'rejected', 'withdrawn', 'expired')),
  broker_display_name text not null
    check (char_length(broker_display_name) between 2 and 140),
  company_display_name text not null
    check (char_length(company_display_name) between 2 and 180),
  amount numeric(14,2) not null
    check (amount > 0 and amount <= 1000000000),
  currency text not null
    check (currency in ('USD', 'EUR', 'TRY', 'GBP')),
  pricing_basis text not null
    check (pricing_basis in ('lumpsum', 'per_mt', 'per_cbm', 'per_teu')),
  transit_days integer
    check (transit_days is null or transit_days between 1 and 365),
  terms_summary text not null default ''
    check (char_length(terms_summary) <= 1200),
  valid_until timestamptz not null,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maritime_freight_offers_valid_window
    check (valid_until > created_at),
  constraint maritime_freight_offers_broker_request_unique
    unique (freight_request_id, broker_user_id),
  constraint maritime_freight_offers_broker_client_unique
    unique (broker_user_id, client_offer_id)
);

create index if not exists maritime_freight_offers_request_status_idx
  on public.maritime_freight_offers(freight_request_id, status, submitted_at desc);
create index if not exists maritime_freight_offers_broker_created_idx
  on public.maritime_freight_offers(broker_user_id, created_at desc);
create unique index if not exists maritime_freight_offers_one_accepted_per_request
  on public.maritime_freight_offers(freight_request_id)
  where status = 'accepted';

drop trigger if exists maritime_freight_offers_set_updated_at on public.maritime_freight_offers;
create trigger maritime_freight_offers_set_updated_at
  before update on public.maritime_freight_offers
  for each row execute function public.set_updated_at();

alter table public.maritime_freight_offers enable row level security;

drop policy if exists "maritime_freight_offers_select_authorized" on public.maritime_freight_offers;
create policy "maritime_freight_offers_select_authorized"
  on public.maritime_freight_offers for select to authenticated
  using (
    public.is_admin()
    or (
      broker_user_id = auth.uid()
      and public.is_partner_or_admin()
    )
    or (
      status in ('submitted', 'accepted', 'rejected', 'expired')
      and exists (
        select 1
        from public.maritime_freight_requests request
        where request.id = maritime_freight_offers.freight_request_id
          and request.user_id = auth.uid()
          and request.module_key = 'maritime'
      )
    )
  );

revoke all on public.maritime_freight_offers from anon, authenticated;
grant select on public.maritime_freight_offers to authenticated;
grant all on public.maritime_freight_offers to service_role;

comment on table public.maritime_freight_offers is
  'Private maritime freight offers. Request owners see only published offer states; MFA partners see only their own offers and MFA admins see operational records.';
comment on column public.maritime_freight_offers.client_offer_id is
  'Partner-generated idempotency key scoped to the broker user.';
