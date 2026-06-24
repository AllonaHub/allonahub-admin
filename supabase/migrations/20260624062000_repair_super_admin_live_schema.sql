create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_app_role()
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce((
    select role::text
    from public.profiles
    where id = auth.uid()
    limit 1
  ), 'anonymous');
$$;

create or replace function public.current_auth_aal()
returns text
language sql
stable
as $$
  select coalesce(nullif(auth.jwt() ->> 'aal', ''), 'aal1');
$$;

create or replace function public.has_mfa()
returns boolean
language sql
stable
as $$
  select public.current_auth_aal() = 'aal2';
$$;

alter table if exists public.profiles
  add column if not exists account_status text not null default 'active',
  add column if not exists flagged_suspicious boolean not null default false,
  add column if not exists risk_level text not null default 'low',
  add column if not exists suspended_until timestamptz,
  add column if not exists last_admin_note text;

create index if not exists profiles_account_status_idx
  on public.profiles(account_status, created_at desc);
create index if not exists profiles_risk_level_idx
  on public.profiles(risk_level, flagged_suspicious, created_at desc);

create table if not exists public.security_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  action text not null,
  resource_type text,
  resource_id text,
  severity text not null default 'info'
    check (severity in ('debug', 'info', 'warning', 'critical')),
  ip_address text,
  user_agent text,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  source text not null default 'backend',
  purpose text not null default 'security_audit',
  location_basis text not null default 'none',
  geo_country text,
  geo_region text,
  geo_city text,
  geo_latitude numeric,
  geo_longitude numeric,
  geo_accuracy_m numeric,
  retention_until timestamptz,
  evidence_tags text[] not null default '{}',
  event_hash text,
  previous_event_hash text,
  created_at timestamptz not null default now()
);

alter table public.security_audit_events
  add column if not exists source text not null default 'backend',
  add column if not exists purpose text not null default 'security_audit',
  add column if not exists location_basis text not null default 'none',
  add column if not exists geo_country text,
  add column if not exists geo_region text,
  add column if not exists geo_city text,
  add column if not exists geo_latitude numeric,
  add column if not exists geo_longitude numeric,
  add column if not exists geo_accuracy_m numeric,
  add column if not exists retention_until timestamptz,
  add column if not exists evidence_tags text[] not null default '{}',
  add column if not exists event_hash text,
  add column if not exists previous_event_hash text;

create index if not exists security_audit_events_created_at_idx
  on public.security_audit_events (created_at desc);
create index if not exists security_audit_events_actor_idx
  on public.security_audit_events (actor_id, created_at desc);
create index if not exists security_audit_events_action_idx
  on public.security_audit_events (action, created_at desc);
create index if not exists security_audit_events_resource_idx
  on public.security_audit_events (resource_type, resource_id, created_at desc);
create index if not exists security_audit_events_source_purpose_idx
  on public.security_audit_events (source, purpose, created_at desc);
create index if not exists security_audit_events_evidence_tags_idx
  on public.security_audit_events using gin(evidence_tags);

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

create table if not exists public.super_admin_owner_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  email text,
  status text not null default 'active'
    check (status in ('active', 'paused', 'revoked')),
  label text not null default 'AllonaHub owner',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint super_admin_owner_identity_present
    check (user_id is not null or nullif(email, '') is not null),
  constraint super_admin_owner_email_lowercase
    check (email is null or email = lower(email))
);

create table if not exists public.super_admin_release_approvals (
  id uuid primary key default gen_random_uuid(),
  approval_type text not null
    check (approval_type in (
      'publish_static',
      'deploy_backend',
      'apply_supabase_migration',
      'main_commit_push',
      'panel_change',
      'risk_override'
    )),
  target_ref text not null default 'main',
  target_summary text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'dispatched', 'failed', 'cancelled')),
  risk_level text not null default 'critical'
    check (risk_level in ('low', 'medium', 'high', 'critical')),
  requested_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  dispatched_at timestamptz,
  webhook_status integer,
  webhook_response jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.super_admin_permission_changes (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null default 'role_permission_update',
  old_role text,
  new_role text,
  old_account_status text,
  new_account_status text,
  old_risk_level text,
  new_risk_level text,
  reason text not null,
  risk_level text not null default 'high'
    check (risk_level in ('low', 'medium', 'high', 'critical')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists super_admin_settings_category_idx
  on public.super_admin_settings(category, setting_key);
create index if not exists platform_modules_visibility_idx
  on public.platform_modules(is_active, is_visible, sort_order);
create unique index if not exists super_admin_owner_access_user_idx
  on public.super_admin_owner_access(user_id)
  where user_id is not null;
create unique index if not exists super_admin_owner_access_email_idx
  on public.super_admin_owner_access(email)
  where email is not null;
create index if not exists super_admin_owner_access_status_idx
  on public.super_admin_owner_access(status, created_at desc);
create index if not exists super_admin_release_approvals_status_idx
  on public.super_admin_release_approvals(status, created_at desc);
create index if not exists super_admin_release_approvals_type_idx
  on public.super_admin_release_approvals(approval_type, created_at desc);
create index if not exists super_admin_release_approvals_requested_by_idx
  on public.super_admin_release_approvals(requested_by, created_at desc);
create index if not exists super_admin_permission_changes_target_idx
  on public.super_admin_permission_changes(target_user_id, created_at desc);
create index if not exists super_admin_permission_changes_actor_idx
  on public.super_admin_permission_changes(actor_id, created_at desc);

drop trigger if exists super_admin_settings_set_updated_at on public.super_admin_settings;
create trigger super_admin_settings_set_updated_at
  before update on public.super_admin_settings
  for each row execute function public.set_updated_at();

drop trigger if exists platform_modules_set_updated_at on public.platform_modules;
create trigger platform_modules_set_updated_at
  before update on public.platform_modules
  for each row execute function public.set_updated_at();

drop trigger if exists super_admin_owner_access_set_updated_at on public.super_admin_owner_access;
create trigger super_admin_owner_access_set_updated_at
  before update on public.super_admin_owner_access
  for each row execute function public.set_updated_at();

drop trigger if exists super_admin_release_approvals_set_updated_at on public.super_admin_release_approvals;
create trigger super_admin_release_approvals_set_updated_at
  before update on public.super_admin_release_approvals
  for each row execute function public.set_updated_at();

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_app_role() = 'super_admin'
    and public.has_mfa()
    and exists (
      select 1
      from public.super_admin_owner_access owner_access
      where owner_access.status = 'active'
        and (
          owner_access.user_id = auth.uid()
          or (
            owner_access.email is not null
            and owner_access.email = lower(coalesce(auth.jwt() ->> 'email', ''))
          )
        )
    );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_app_role() in ('admin', 'super_admin') and public.has_mfa();
$$;

create or replace function public.is_super_admin_owner()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_super_admin();
$$;

alter table public.security_audit_events enable row level security;
alter table public.super_admin_settings enable row level security;
alter table public.platform_modules enable row level security;
alter table public.super_admin_owner_access enable row level security;
alter table public.super_admin_release_approvals enable row level security;
alter table public.super_admin_permission_changes enable row level security;

drop policy if exists "security_audit_events_select_admin" on public.security_audit_events;
create policy "security_audit_events_select_admin"
  on public.security_audit_events for select
  to authenticated
  using (public.is_admin());

drop policy if exists "security_audit_events_no_client_insert" on public.security_audit_events;
create policy "security_audit_events_no_client_insert"
  on public.security_audit_events for insert
  to authenticated
  with check (false);

drop policy if exists "security_audit_events_no_client_update" on public.security_audit_events;
create policy "security_audit_events_no_client_update"
  on public.security_audit_events for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists "security_audit_events_no_client_delete" on public.security_audit_events;
create policy "security_audit_events_no_client_delete"
  on public.security_audit_events for delete
  to authenticated
  using (false);

drop policy if exists "super_admin_settings_select_super_admin" on public.super_admin_settings;
drop policy if exists "super_admin_settings_select_super_admin_owner" on public.super_admin_settings;
create policy "super_admin_settings_select_super_admin_owner"
  on public.super_admin_settings for select
  to authenticated
  using (public.is_super_admin_owner());

drop policy if exists "platform_modules_select_super_admin" on public.platform_modules;
drop policy if exists "platform_modules_select_super_admin_owner" on public.platform_modules;
create policy "platform_modules_select_super_admin_owner"
  on public.platform_modules for select
  to authenticated
  using (public.is_super_admin_owner());

drop policy if exists "super_admin_owner_access_owner_select" on public.super_admin_owner_access;
create policy "super_admin_owner_access_owner_select"
  on public.super_admin_owner_access for select
  to authenticated
  using (public.is_super_admin_owner());

drop policy if exists "super_admin_release_approvals_owner_select" on public.super_admin_release_approvals;
create policy "super_admin_release_approvals_owner_select"
  on public.super_admin_release_approvals for select
  to authenticated
  using (public.is_super_admin_owner());

drop policy if exists "super_admin_permission_changes_owner_select" on public.super_admin_permission_changes;
create policy "super_admin_permission_changes_owner_select"
  on public.super_admin_permission_changes for select
  to authenticated
  using (public.is_super_admin_owner());

do $$
declare
  t text;
begin
  foreach t in array array[
    'super_admin_settings',
    'platform_modules',
    'super_admin_owner_access',
    'super_admin_release_approvals',
    'super_admin_permission_changes'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_no_client_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (false)', t || '_no_client_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_no_client_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (false) with check (false)', t || '_no_client_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_no_client_delete', t);
    execute format('create policy %I on public.%I for delete to authenticated using (false)', t || '_no_client_delete', t);
  end loop;
end $$;

revoke all on public.security_audit_events from anon;
revoke all on public.super_admin_settings from anon;
revoke all on public.platform_modules from anon;
revoke all on public.super_admin_owner_access from anon;
revoke all on public.super_admin_release_approvals from anon;
revoke all on public.super_admin_permission_changes from anon;

grant select on public.security_audit_events to authenticated;
grant select on public.super_admin_settings to authenticated;
grant select on public.platform_modules to authenticated;
grant select on public.super_admin_owner_access to authenticated;
grant select on public.super_admin_release_approvals to authenticated;
grant select on public.super_admin_permission_changes to authenticated;

do $$
begin
  grant all on public.security_audit_events to service_role;
  grant all on public.super_admin_settings to service_role;
  grant all on public.platform_modules to service_role;
  grant all on public.super_admin_owner_access to service_role;
  grant all on public.super_admin_release_approvals to service_role;
  grant all on public.super_admin_permission_changes to service_role;
exception
  when undefined_object then null;
end $$;

insert into public.super_admin_settings (setting_key, label, setting_value, value_type, category, risk_level)
values
  ('maintenance_mode', 'Bakım modu', 'false'::jsonb, 'boolean', 'system', 'critical'),
  ('orders_paused', 'Siparişleri geçici durdur', 'false'::jsonb, 'boolean', 'commerce', 'high'),
  ('payments_paused', 'Ödemeleri geçici durdur', 'false'::jsonb, 'boolean', 'finance', 'critical'),
  ('partner_applications_paused', 'Yeni partner başvurularını durdur', 'false'::jsonb, 'boolean', 'partner', 'high'),
  ('default_commission_rate', 'Varsayılan komisyon oranı', '0.12'::jsonb, 'number', 'finance', 'medium'),
  ('minimum_payout_amount', 'Minimum ödeme tutarı', '500'::jsonb, 'number', 'finance', 'medium')
on conflict (setting_key) do nothing;

insert into public.platform_modules (module_key, name, category, commission_rate, sort_order, content_config)
values
  ('shop', 'Allona Shop', 'commerce', 0.1200, 10, '{"href":"../pages/commerce/allonashop.html","maturity":"transactional"}'::jsonb),
  ('food', 'Allona Yemek', 'commerce', 0.1200, 20, '{"href":"../pages/commerce/allonayemek.html","maturity":"transactional"}'::jsonb),
  ('market', 'Allona Market', 'commerce', 0.1200, 30, '{"href":"../pages/commerce/allonamarket.html","maturity":"transactional"}'::jsonb),
  ('taxi', 'Allona Taksi', 'transport', 0.1000, 40, '{"href":"../pages/ecosystem/allonataksi.html","maturity":"operational"}'::jsonb),
  ('health', 'Allona Sağlık', 'services', 0.1200, 50, '{"href":"../pages/ecosystem/allonasaglik.html","maturity":"controlled"}'::jsonb),
  ('maritime', 'Denizcilik', 'services', 0.1200, 60, '{"href":"../pages/ecosystem/denizcilik.html","maturity":"lead"}'::jsonb),
  ('legal', 'Hukuk', 'services', 0.1200, 70, '{"href":"../pages/ecosystem/allonahukuk.html","maturity":"lead"}'::jsonb),
  ('consulting', 'Danışmanlık', 'services', 0.1200, 80, '{"href":"../pages/ecosystem/allonadanismanlik.html","maturity":"lead"}'::jsonb),
  ('real_estate', 'Gayrimenkul', 'marketplace', 0.0800, 90, '{"href":"../pages/ecosystem/allonagayrimenkul.html","maturity":"lead"}'::jsonb),
  ('automotive', 'Otomotiv', 'marketplace', 0.0800, 100, '{"href":"../pages/ecosystem/allonaotomotiv.html","maturity":"lead"}'::jsonb),
  ('education', 'Eğitim', 'services', 0.1200, 110, '{"href":"../pages/ecosystem/allonaegitim.html","maturity":"lead"}'::jsonb),
  ('other_services', 'Diğer hizmetler', 'services', 0.1200, 120, '{"maturity":"lead"}'::jsonb)
on conflict (module_key) do update set
  name = excluded.name,
  category = excluded.category,
  commission_rate = excluded.commission_rate,
  sort_order = excluded.sort_order,
  content_config = public.platform_modules.content_config || excluded.content_config,
  updated_at = now();

select pg_notify('pgrst', 'reload schema');
