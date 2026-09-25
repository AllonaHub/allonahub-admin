create table if not exists public.maritime_joining_operations (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  offer_id uuid not null unique references public.maritime_offers_contracts(id) on delete restrict,
  application_id uuid not null references public.maritime_hiring_applications(id) on delete restrict,
  job_id uuid not null references public.maritime_jobs(id) on delete restrict,
  seafarer_user_id uuid not null references public.profiles(id) on delete restrict,
  joining_date date,
  joining_port text not null default '',
  arrival_airport text not null default '',
  arrival_at timestamptz,
  flight_status text not null default 'not_needed' check (flight_status in ('not_needed','company_arranging','requested','confirmed')),
  hotel_status text not null default 'not_needed' check (hotel_status in ('not_needed','company_arranging','requested','confirmed')),
  transfer_status text not null default 'not_needed' check (transfer_status in ('not_needed','company_arranging','requested','confirmed')),
  boarding_status text not null default 'pending' check (boarding_status in ('pending','confirmed')),
  hotel_nights integer check (hotel_nights between 1 and 30),
  request_note text not null default '',
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists maritime_joining_operations_partner_updated_idx on public.maritime_joining_operations(partner_id, updated_at desc);
alter table public.maritime_joining_operations enable row level security;
revoke all on public.maritime_joining_operations from public, anon, authenticated;
grant select, insert, update on public.maritime_joining_operations to service_role;
comment on table public.maritime_joining_operations is 'Tenant-private joining coordination; requested services are not confirmed bookings.';
