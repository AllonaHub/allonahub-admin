create extension if not exists pgcrypto;

create table if not exists public.partner_businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  partner_code text not null unique default ('PRT-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  legal_name text,
  display_name text not null,
  partner_type text not null default 'shop'
    check (partner_type in ('shop', 'food', 'taxi', 'courier', 'market', 'service', 'maritime', 'legal', 'health', 'beauty', 'hotel', 'real_estate', 'default')),
  email text,
  phone text,
  country text,
  city text,
  description text,
  logo_url text,
  status text not null default 'active'
    check (status in ('draft', 'review', 'active', 'paused', 'suspended', 'archived')),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'review', 'verified', 'rejected')),
  trust_score integer not null default 70 check (trust_score between 0 and 100),
  level integer not null default 1 check (level between 1 and 99),
  xp integer not null default 0 check (xp >= 0),
  default_commission_rate numeric(5,4) not null default 0.1200 check (default_commission_rate >= 0 and default_commission_rate <= 0.9000),
  preferred_cargo_company text,
  settlement_iban text,
  settlement_account_name text,
  payout_schedule text not null default 'weekly' check (payout_schedule in ('daily', 'weekly', 'biweekly', 'monthly')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_businesses_owner_idx
  on public.partner_businesses(owner_id, status, created_at desc);

create table if not exists public.partner_locations (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  name text not null,
  location_type text not null default 'branch'
    check (location_type in ('branch', 'vehicle', 'taxi', 'warehouse', 'event', 'mobile')),
  city text,
  district text,
  address text,
  phone text,
  is_default boolean not null default false,
  latitude numeric(10,7),
  longitude numeric(10,7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_locations_partner_idx
  on public.partner_locations(partner_id, is_default desc, created_at desc);

create table if not exists public.partner_staff (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  staff_role text not null default 'cashier'
    check (staff_role in ('owner', 'manager', 'cashier', 'driver', 'courier', 'accounting', 'support')),
  permissions jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'invited', 'paused', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_staff_partner_idx
  on public.partner_staff(partner_id, status, created_at desc);

create table if not exists public.partner_devices (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  location_id uuid references public.partner_locations(id) on delete set null,
  assigned_user_id uuid references public.profiles(id) on delete set null,
  device_label text not null,
  device_type text not null default 'android_softpos'
    check (device_type in ('android_softpos', 'ios_tap_to_pay', 'physical_pos', 'qr_stand', 'web_terminal', 'taxi_terminal')),
  provider text not null default 'allonapay'
    check (provider in ('allonapay', 'bank_softpos', 'bank_payment_link', 'visa_tap_to_phone', 'mastercard_tap_on_phone', 'bank_pos', 'manual')),
  capability jsonb not null default '{"qr": true, "nfc": false, "link": true}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'paused', 'blocked', 'retired')),
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_devices_partner_idx
  on public.partner_devices(partner_id, status, created_at desc);

create table if not exists public.partner_qr_codes (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  location_id uuid references public.partner_locations(id) on delete set null,
  title text not null,
  qr_type text not null default 'static'
    check (qr_type in ('static', 'table', 'product', 'vehicle', 'campaign')),
  payload_url text,
  short_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_qr_codes_partner_idx
  on public.partner_qr_codes(partner_id, status, created_at desc);

create table if not exists public.partner_payment_intents (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  location_id uuid references public.partner_locations(id) on delete set null,
  device_id uuid references public.partner_devices(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  channel text not null default 'qr'
    check (channel in ('qr', 'nfc', 'payment_link', 'web_pos', 'physical_pos', 'cash', 'wallet')),
  provider text not null default 'allonapay'
    check (provider in ('allonapay', 'bank_checkout', 'bank_payment_link', 'bank_softpos', 'visa_tap_to_phone', 'mastercard_tap_on_phone', 'bank_pos', 'manual')),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'TRY',
  description text,
  customer_name text,
  customer_phone text,
  customer_email text,
  status text not null default 'created'
    check (status in ('created', 'awaiting_payment', 'provider_pending', 'paid', 'failed', 'cancelled', 'expired', 'refunded')),
  provider_reference text,
  provider_status text,
  payment_url text,
  qr_payload text,
  receipt_url text,
  expires_at timestamptz not null default (now() + interval '20 minutes'),
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_payment_intents_partner_idx
  on public.partner_payment_intents(partner_id, status, created_at desc);
create index if not exists partner_payment_intents_order_idx
  on public.partner_payment_intents(order_id);

create table if not exists public.partner_transactions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  payment_intent_id uuid references public.partner_payment_intents(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  transaction_type text not null default 'payment'
    check (transaction_type in ('payment', 'refund', 'chargeback', 'adjustment', 'payout')),
  channel text not null default 'qr',
  provider text not null default 'allonapay',
  gross_amount numeric(12,2) not null default 0,
  commission_rate numeric(5,4) not null default 0.1200,
  commission_amount numeric(12,2) not null default 0,
  net_amount numeric(12,2) not null default 0,
  currency text not null default 'TRY',
  status text not null default 'pending'
    check (status in ('pending', 'authorized', 'paid', 'settled', 'failed', 'refunded', 'cancelled')),
  provider_reference text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists partner_transactions_partner_idx
  on public.partner_transactions(partner_id, status, occurred_at desc);

create table if not exists public.partner_payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  gross_amount numeric(12,2) not null default 0,
  commission_amount numeric(12,2) not null default 0,
  net_amount numeric(12,2) not null default 0,
  currency text not null default 'TRY',
  status text not null default 'scheduled'
    check (status in ('scheduled', 'review', 'approved', 'paid', 'blocked', 'failed')),
  payout_reference text,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_payouts_partner_idx
  on public.partner_payouts(partner_id, status, period_end desc);

create table if not exists public.partner_support_tickets (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  category text not null default 'general'
    check (category in ('general', 'product', 'order', 'payment', 'qr_nfc', 'cargo', 'payout', 'technical')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  title text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'waiting', 'resolved', 'closed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_support_tickets_partner_idx
  on public.partner_support_tickets(partner_id, status, created_at desc);

drop trigger if exists partner_businesses_set_updated_at on public.partner_businesses;
create trigger partner_businesses_set_updated_at
  before update on public.partner_businesses
  for each row execute function public.set_updated_at();

drop trigger if exists partner_locations_set_updated_at on public.partner_locations;
create trigger partner_locations_set_updated_at
  before update on public.partner_locations
  for each row execute function public.set_updated_at();

drop trigger if exists partner_staff_set_updated_at on public.partner_staff;
create trigger partner_staff_set_updated_at
  before update on public.partner_staff
  for each row execute function public.set_updated_at();

drop trigger if exists partner_devices_set_updated_at on public.partner_devices;
create trigger partner_devices_set_updated_at
  before update on public.partner_devices
  for each row execute function public.set_updated_at();

drop trigger if exists partner_qr_codes_set_updated_at on public.partner_qr_codes;
create trigger partner_qr_codes_set_updated_at
  before update on public.partner_qr_codes
  for each row execute function public.set_updated_at();

drop trigger if exists partner_payment_intents_set_updated_at on public.partner_payment_intents;
create trigger partner_payment_intents_set_updated_at
  before update on public.partner_payment_intents
  for each row execute function public.set_updated_at();

drop trigger if exists partner_payouts_set_updated_at on public.partner_payouts;
create trigger partner_payouts_set_updated_at
  before update on public.partner_payouts
  for each row execute function public.set_updated_at();

drop trigger if exists partner_support_tickets_set_updated_at on public.partner_support_tickets;
create trigger partner_support_tickets_set_updated_at
  before update on public.partner_support_tickets
  for each row execute function public.set_updated_at();

create or replace function public.partner_member_has_access(target_partner_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.partner_businesses pb
    where pb.id = target_partner_id
      and pb.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.partner_staff ps
    where ps.partner_id = target_partner_id
      and ps.user_id = auth.uid()
      and ps.status = 'active'
  )
  or public.is_admin();
$$;

alter table public.partner_businesses enable row level security;
alter table public.partner_locations enable row level security;
alter table public.partner_staff enable row level security;
alter table public.partner_devices enable row level security;
alter table public.partner_qr_codes enable row level security;
alter table public.partner_payment_intents enable row level security;
alter table public.partner_transactions enable row level security;
alter table public.partner_payouts enable row level security;
alter table public.partner_support_tickets enable row level security;

drop policy if exists "partner_businesses_owner_or_admin" on public.partner_businesses;
create policy "partner_businesses_owner_or_admin"
  on public.partner_businesses for all
  to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "partner_locations_member_or_admin" on public.partner_locations;
create policy "partner_locations_member_or_admin"
  on public.partner_locations for all
  to authenticated
  using (public.partner_member_has_access(partner_id))
  with check (public.partner_member_has_access(partner_id));

drop policy if exists "partner_staff_member_or_admin" on public.partner_staff;
create policy "partner_staff_member_or_admin"
  on public.partner_staff for select
  to authenticated
  using (public.partner_member_has_access(partner_id));

drop policy if exists "partner_staff_owner_or_admin_write" on public.partner_staff;
create policy "partner_staff_owner_or_admin_write"
  on public.partner_staff for all
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.partner_businesses pb
      where pb.id = partner_staff.partner_id
        and pb.owner_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.partner_businesses pb
      where pb.id = partner_staff.partner_id
        and pb.owner_id = auth.uid()
    )
  );

drop policy if exists "partner_devices_member_or_admin" on public.partner_devices;
create policy "partner_devices_member_or_admin"
  on public.partner_devices for all
  to authenticated
  using (public.partner_member_has_access(partner_id))
  with check (public.partner_member_has_access(partner_id));

drop policy if exists "partner_qr_codes_member_or_admin" on public.partner_qr_codes;
create policy "partner_qr_codes_member_or_admin"
  on public.partner_qr_codes for all
  to authenticated
  using (public.partner_member_has_access(partner_id))
  with check (public.partner_member_has_access(partner_id));

drop policy if exists "partner_payment_intents_member_or_admin" on public.partner_payment_intents;
create policy "partner_payment_intents_member_or_admin"
  on public.partner_payment_intents for all
  to authenticated
  using (public.partner_member_has_access(partner_id))
  with check (public.partner_member_has_access(partner_id));

drop policy if exists "partner_transactions_member_or_admin" on public.partner_transactions;
create policy "partner_transactions_member_or_admin"
  on public.partner_transactions for select
  to authenticated
  using (public.partner_member_has_access(partner_id));

drop policy if exists "partner_payouts_member_or_admin" on public.partner_payouts;
create policy "partner_payouts_member_or_admin"
  on public.partner_payouts for select
  to authenticated
  using (public.partner_member_has_access(partner_id));

drop policy if exists "partner_support_tickets_member_or_admin" on public.partner_support_tickets;
create policy "partner_support_tickets_member_or_admin"
  on public.partner_support_tickets for all
  to authenticated
  using (public.partner_member_has_access(partner_id))
  with check (public.partner_member_has_access(partner_id));

comment on table public.partner_businesses is
  'AllonaHub Partner OS business account root. Keeps marketplace partners, taxi operators, shops and service providers additive to the existing profiles table.';

comment on table public.partner_payment_intents is
  'Unified payment request table for QR, NFC SoftPOS, payment link, physical POS, cash and wallet flows.';
