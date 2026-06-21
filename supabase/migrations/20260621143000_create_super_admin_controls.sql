create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'passive', 'suspended')),
  add column if not exists flagged_suspicious boolean not null default false,
  add column if not exists risk_level text not null default 'low'
    check (risk_level in ('low', 'medium', 'high', 'critical')),
  add column if not exists suspended_until timestamptz,
  add column if not exists last_admin_note text;

create index if not exists profiles_account_status_idx
  on public.profiles(account_status, created_at desc);

create index if not exists profiles_risk_level_idx
  on public.profiles(risk_level, flagged_suspicious, created_at desc);

create table if not exists public.super_admin_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  label text not null,
  setting_value jsonb not null default 'null'::jsonb,
  value_type text not null default 'string'
    check (value_type in ('boolean', 'number', 'string', 'json')),
  category text not null default 'system',
  risk_level text not null default 'medium'
    check (risk_level in ('low', 'medium', 'high', 'critical')),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists super_admin_settings_category_idx
  on public.super_admin_settings(category, setting_key);

drop trigger if exists super_admin_settings_set_updated_at on public.super_admin_settings;
create trigger super_admin_settings_set_updated_at
  before update on public.super_admin_settings
  for each row execute function public.set_updated_at();

create table if not exists public.platform_modules (
  id uuid primary key default gen_random_uuid(),
  module_key text not null unique,
  name text not null,
  category text not null default 'services',
  is_active boolean not null default true,
  is_visible boolean not null default true,
  commission_rate numeric(5,4) not null default 0.1200
    check (commission_rate >= 0 and commission_rate <= 0.9000),
  application_status text not null default 'open'
    check (application_status in ('open', 'review_only', 'closed')),
  content_config jsonb not null default '{}'::jsonb,
  sort_order integer not null default 100,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_modules_visibility_idx
  on public.platform_modules(is_active, is_visible, sort_order);

drop trigger if exists platform_modules_set_updated_at on public.platform_modules;
create trigger platform_modules_set_updated_at
  before update on public.platform_modules
  for each row execute function public.set_updated_at();

insert into public.super_admin_settings (setting_key, label, setting_value, value_type, category, risk_level)
values
  ('maintenance_mode', 'Bakım modu', 'false'::jsonb, 'boolean', 'system', 'critical'),
  ('orders_paused', 'Siparişleri geçici durdur', 'false'::jsonb, 'boolean', 'commerce', 'high'),
  ('payments_paused', 'Ödemeleri geçici durdur', 'false'::jsonb, 'boolean', 'finance', 'critical'),
  ('partner_applications_paused', 'Yeni partner başvurularını durdur', 'false'::jsonb, 'boolean', 'partner', 'high'),
  ('default_commission_rate', 'Varsayılan komisyon oranı', '0.12'::jsonb, 'number', 'finance', 'medium'),
  ('minimum_payout_amount', 'Minimum ödeme tutarı', '500'::jsonb, 'number', 'finance', 'medium')
on conflict (setting_key) do nothing;

insert into public.platform_modules (module_key, name, category, commission_rate, sort_order)
values
  ('shop', 'Shop', 'commerce', 0.1200, 10),
  ('food', 'Yemek', 'commerce', 0.1200, 20),
  ('market', 'Market', 'commerce', 0.1200, 30),
  ('taxi', 'Taksi', 'transport', 0.1000, 40),
  ('health', 'Sağlık', 'services', 0.1200, 50),
  ('maritime', 'Denizcilik', 'services', 0.1200, 60),
  ('legal', 'Hukuk', 'services', 0.1200, 70),
  ('consulting', 'Danışmanlık', 'services', 0.1200, 80),
  ('real_estate', 'Gayrimenkul', 'marketplace', 0.0800, 90),
  ('automotive', 'Otomotiv', 'marketplace', 0.0800, 100),
  ('education', 'Eğitim', 'services', 0.1200, 110),
  ('other_services', 'Diğer hizmetler', 'services', 0.1200, 120)
on conflict (module_key) do nothing;

alter table public.super_admin_settings enable row level security;
alter table public.platform_modules enable row level security;

drop policy if exists "super_admin_settings_select_super_admin" on public.super_admin_settings;
create policy "super_admin_settings_select_super_admin"
  on public.super_admin_settings for select
  to authenticated
  using (public.is_super_admin());

drop policy if exists "platform_modules_select_super_admin" on public.platform_modules;
create policy "platform_modules_select_super_admin"
  on public.platform_modules for select
  to authenticated
  using (public.is_super_admin());

drop policy if exists "super_admin_settings_no_client_insert" on public.super_admin_settings;
create policy "super_admin_settings_no_client_insert"
  on public.super_admin_settings for insert
  to authenticated
  with check (false);

drop policy if exists "super_admin_settings_no_client_update" on public.super_admin_settings;
create policy "super_admin_settings_no_client_update"
  on public.super_admin_settings for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists "super_admin_settings_no_client_delete" on public.super_admin_settings;
create policy "super_admin_settings_no_client_delete"
  on public.super_admin_settings for delete
  to authenticated
  using (false);

drop policy if exists "platform_modules_no_client_insert" on public.platform_modules;
create policy "platform_modules_no_client_insert"
  on public.platform_modules for insert
  to authenticated
  with check (false);

drop policy if exists "platform_modules_no_client_update" on public.platform_modules;
create policy "platform_modules_no_client_update"
  on public.platform_modules for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists "platform_modules_no_client_delete" on public.platform_modules;
create policy "platform_modules_no_client_delete"
  on public.platform_modules for delete
  to authenticated
  using (false);

revoke all on public.super_admin_settings from anon;
revoke all on public.platform_modules from anon;
grant select on public.super_admin_settings to authenticated;
grant select on public.platform_modules to authenticated;

comment on table public.super_admin_settings is
  'Security-first Super Admin controlled platform settings. Browser clients can only read through MFA verified super_admin RLS; writes are backend/audited only.';

comment on table public.platform_modules is
  'AllonaHub ecosystem module control plane for activation, visibility, commission and application status.';
