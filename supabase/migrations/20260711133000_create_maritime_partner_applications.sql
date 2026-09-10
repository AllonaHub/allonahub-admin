create extension if not exists pgcrypto;

create table if not exists public.maritime_partner_applications (
  id uuid primary key default gen_random_uuid(),
  reference_no text not null unique
    default ('MPA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  client_request_id uuid not null unique,
  user_id uuid references auth.users(id) on delete set null,
  module_key text not null default 'maritime'
    check (module_key = 'maritime'),
  status text not null default 'pending'
    check (status in ('pending', 'in_review', 'approved', 'rejected', 'withdrawn')),
  partner_role text not null
    check (partner_role in ('shipowner', 'broker', 'agency', 'crewing', 'port_service', 'technical_service', 'other')),
  company_name text not null
    check (char_length(company_name) between 2 and 160),
  contact_name text not null
    check (char_length(contact_name) between 2 and 140),
  email text not null
    check (char_length(email) <= 180 and email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  email_hash char(64) not null
    check (email_hash ~ '^[a-f0-9]{64}$'),
  phone text not null
    check (char_length(phone) between 7 and 40),
  company_type text not null
    check (company_type in ('sole-proprietor', 'limited', 'joint-stock', 'cooperative', 'individual', 'other')),
  country text not null
    check (char_length(country) between 2 and 90),
  city text not null
    check (char_length(city) between 2 and 90),
  website text not null default ''
    check (char_length(website) <= 500),
  message text not null
    check (char_length(message) between 10 and 1200),
  privacy_consent_at timestamptz not null default now(),
  retention_until timestamptz not null default (now() + interval '730 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists maritime_partner_applications_status_created_idx
  on public.maritime_partner_applications(module_key, status, created_at desc);
create index if not exists maritime_partner_applications_email_hash_idx
  on public.maritime_partner_applications(email_hash, created_at desc);

drop trigger if exists maritime_partner_applications_set_updated_at on public.maritime_partner_applications;
create trigger maritime_partner_applications_set_updated_at
  before update on public.maritime_partner_applications
  for each row execute function public.set_updated_at();

alter table public.maritime_partner_applications enable row level security;

drop policy if exists "maritime_partner_applications_admin_select" on public.maritime_partner_applications;
create policy "maritime_partner_applications_admin_select"
  on public.maritime_partner_applications for select to authenticated
  using (public.is_admin());

revoke all on public.maritime_partner_applications from anon, authenticated;
grant select on public.maritime_partner_applications to authenticated;
grant all on public.maritime_partner_applications to service_role;

comment on table public.maritime_partner_applications is
  'Private maritime partner onboarding applications. Public clients cannot read or write this table; creation is restricted to the backend API.';
comment on column public.maritime_partner_applications.email_hash is
  'Lowercase email SHA-256 used for audit correlation without copying raw email into audit metadata.';
