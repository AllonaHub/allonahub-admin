create extension if not exists pgcrypto;

create table if not exists public.admin_permission_profiles (
  profile_key text primary key
    check (profile_key ~ '^[a-z0-9_.:-]{2,80}$'),
  label text not null,
  description text not null default '',
  permissions jsonb not null default '{}'::jsonb,
  approval_rules jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_permission_assignments (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  profile_key text not null references public.admin_permission_profiles(profile_key) on delete restrict,
  granted_by uuid references public.profiles(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'paused', 'revoked')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  notes text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (admin_user_id)
);

create index if not exists admin_permission_assignments_status_idx
  on public.admin_permission_assignments(status, profile_key, starts_at, expires_at);

create table if not exists public.super_admin_admin_ops_interventions (
  id uuid primary key default gen_random_uuid(),
  intervened_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  admin_user_id uuid references public.profiles(id) on delete set null,
  intervention_type text not null
    check (intervention_type in ('permission_assignment', 'approval_decision', 'emergency_alert', 'admin_panel_override')),
  target_type text not null default 'admin_ops',
  target_id text,
  reason text not null check (length(trim(reason)) between 3 and 1200),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists super_admin_admin_ops_interventions_admin_idx
  on public.super_admin_admin_ops_interventions(admin_user_id, created_at desc);

create table if not exists public.platform_emergency_alerts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  approved_by uuid references public.profiles(id) on delete set null,
  source_request_id uuid references public.admin_approval_requests(id) on delete set null,
  title text not null check (length(trim(title)) between 3 and 160),
  message text not null check (length(trim(message)) between 3 and 1600),
  severity text not null default 'warning'
    check (severity in ('info', 'warning', 'critical')),
  scope text not null default 'admin'
    check (scope in ('admin', 'platform')),
  delivery_channels text[] not null default array['banner']::text[],
  sound_enabled boolean not null default false,
  status text not null default 'pending_super_admin'
    check (status in ('draft', 'pending_super_admin', 'active', 'resolved', 'expired', 'cancelled')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_emergency_alerts_active_idx
  on public.platform_emergency_alerts(status, scope, severity, starts_at desc);

create table if not exists public.platform_notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade default auth.uid(),
  browser_notifications_enabled boolean not null default false,
  sound_enabled boolean not null default false,
  emergency_sound_enabled boolean not null default false,
  muted_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_alert_acknowledgements (
  alert_id uuid not null references public.platform_emergency_alerts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  acknowledged_at timestamptz not null default now(),
  primary key (alert_id, user_id)
);

drop trigger if exists admin_permission_profiles_set_updated_at on public.admin_permission_profiles;
create trigger admin_permission_profiles_set_updated_at
  before update on public.admin_permission_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists admin_permission_assignments_set_updated_at on public.admin_permission_assignments;
create trigger admin_permission_assignments_set_updated_at
  before update on public.admin_permission_assignments
  for each row execute function public.set_updated_at();

drop trigger if exists platform_emergency_alerts_set_updated_at on public.platform_emergency_alerts;
create trigger platform_emergency_alerts_set_updated_at
  before update on public.platform_emergency_alerts
  for each row execute function public.set_updated_at();

drop trigger if exists platform_notification_preferences_set_updated_at on public.platform_notification_preferences;
create trigger platform_notification_preferences_set_updated_at
  before update on public.platform_notification_preferences
  for each row execute function public.set_updated_at();

insert into public.admin_permission_profiles (
  profile_key,
  label,
  description,
  permissions,
  approval_rules
)
values
  (
    'ops_default',
    'Operasyon Admin',
    'Gunluk operasyon, inceleme, not, risk isareti ve Super Admin onay talebi.',
    jsonb_build_object(
      'dashboard.view', true,
      'users.view', true,
      'users.note', true,
      'users.flag', true,
      'applications.view', true,
      'applications.review', true,
      'partners.view', true,
      'partners.note', true,
      'orders.view', true,
      'orders.flag', true,
      'content.view', true,
      'content.propose', true,
      'support.view', true,
      'support.update', true,
      'security.view', true,
      'reports.view', true,
      'audit.view', true,
      'approvals.view', true,
      'approvals.request', true,
      'emergency.view', true,
      'emergency.request', true,
      'permissions.view', true,
      'users.delete', false,
      'commission.change', false,
      'finance.change', false,
      'super_admin.create', false,
      'system_settings.change', false
    ),
    jsonb_build_object(
      'partner_final_decision', 'super_admin_required',
      'content_publish', 'super_admin_required',
      'emergency_publish', 'super_admin_required',
      'finance_or_commission_change', 'blocked'
    )
  ),
  (
    'ops_lead',
    'Operasyon Lideri',
    'Daha genis operasyon inceleme yetkisi; nihai kritik kararlar Super Admin onaylidir.',
    jsonb_build_object(
      'dashboard.view', true,
      'users.view', true,
      'users.note', true,
      'users.flag', true,
      'applications.view', true,
      'applications.review', true,
      'partners.view', true,
      'partners.note', true,
      'orders.view', true,
      'orders.flag', true,
      'content.view', true,
      'content.propose', true,
      'support.view', true,
      'support.update', true,
      'security.view', true,
      'reports.view', true,
      'audit.view', true,
      'approvals.view', true,
      'approvals.request', true,
      'emergency.view', true,
      'emergency.request', true,
      'permissions.view', true,
      'users.delete', false,
      'commission.change', false,
      'finance.change', false,
      'super_admin.create', false,
      'system_settings.change', false
    ),
    jsonb_build_object(
      'partner_final_decision', 'super_admin_required',
      'content_publish', 'super_admin_required',
      'emergency_publish', 'super_admin_required',
      'finance_or_commission_change', 'blocked'
    )
  ),
  (
    'support_admin',
    'Destek Admin',
    'Destek talepleri, kullanici notu ve sinirli operasyon goruntuleme.',
    jsonb_build_object(
      'dashboard.view', true,
      'users.view', true,
      'users.note', true,
      'users.flag', false,
      'applications.view', true,
      'applications.review', false,
      'partners.view', true,
      'partners.note', true,
      'orders.view', true,
      'orders.flag', false,
      'content.view', false,
      'content.propose', false,
      'support.view', true,
      'support.update', true,
      'security.view', false,
      'reports.view', true,
      'audit.view', false,
      'approvals.view', true,
      'approvals.request', false,
      'emergency.view', true,
      'emergency.request', false,
      'permissions.view', true,
      'users.delete', false,
      'commission.change', false,
      'finance.change', false,
      'super_admin.create', false,
      'system_settings.change', false
    ),
    jsonb_build_object(
      'partner_final_decision', 'blocked',
      'content_publish', 'blocked',
      'emergency_publish', 'super_admin_required',
      'finance_or_commission_change', 'blocked'
    )
  )
on conflict (profile_key) do update
  set label = excluded.label,
      description = excluded.description,
      permissions = excluded.permissions,
      approval_rules = excluded.approval_rules,
      updated_at = now();

insert into public.admin_permission_assignments (
  admin_user_id,
  profile_key,
  granted_by,
  notes,
  metadata
)
select
  p.id,
  'ops_default',
  null,
  'Launch bootstrap: existing admin role receives limited ops profile until Super Admin adjusts it.',
  jsonb_build_object('source', 'launch_migration', 'assigned_at', now())
from public.profiles p
where p.role = 'admin'
on conflict (admin_user_id) do nothing;

create or replace function public.admin_has_permission(p_permission text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(bool_or((app.permissions ->> p_permission)::boolean), false)
  from public.admin_permission_assignments apa
  join public.admin_permission_profiles app on app.profile_key = apa.profile_key
  where apa.admin_user_id = auth.uid()
    and apa.status = 'active'
    and app.is_active = true
    and apa.starts_at <= now()
    and (apa.expires_at is null or apa.expires_at > now())
    and public.is_ops_admin();
$$;

alter table public.admin_permission_profiles enable row level security;
alter table public.admin_permission_assignments enable row level security;
alter table public.super_admin_admin_ops_interventions enable row level security;
alter table public.platform_emergency_alerts enable row level security;
alter table public.platform_notification_preferences enable row level security;
alter table public.platform_alert_acknowledgements enable row level security;

drop policy if exists "admin_permission_profiles_ops_select" on public.admin_permission_profiles;
create policy "admin_permission_profiles_ops_select"
  on public.admin_permission_profiles for select
  to authenticated
  using (public.is_ops_admin() or public.is_super_admin());

drop policy if exists "admin_permission_profiles_super_admin_insert" on public.admin_permission_profiles;
create policy "admin_permission_profiles_super_admin_insert"
  on public.admin_permission_profiles for insert
  to authenticated
  with check (public.is_super_admin());

drop policy if exists "admin_permission_profiles_super_admin_update" on public.admin_permission_profiles;
create policy "admin_permission_profiles_super_admin_update"
  on public.admin_permission_profiles for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "admin_permission_assignments_select_assigned_or_super" on public.admin_permission_assignments;
create policy "admin_permission_assignments_select_assigned_or_super"
  on public.admin_permission_assignments for select
  to authenticated
  using ((admin_user_id = auth.uid() and public.is_ops_admin()) or public.is_super_admin());

drop policy if exists "admin_permission_assignments_super_admin_insert" on public.admin_permission_assignments;
create policy "admin_permission_assignments_super_admin_insert"
  on public.admin_permission_assignments for insert
  to authenticated
  with check (public.is_super_admin());

drop policy if exists "admin_permission_assignments_super_admin_update" on public.admin_permission_assignments;
create policy "admin_permission_assignments_super_admin_update"
  on public.admin_permission_assignments for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "super_admin_admin_ops_interventions_super_admin_select" on public.super_admin_admin_ops_interventions;
create policy "super_admin_admin_ops_interventions_super_admin_select"
  on public.super_admin_admin_ops_interventions for select
  to authenticated
  using (public.is_super_admin());

drop policy if exists "super_admin_admin_ops_interventions_super_admin_insert" on public.super_admin_admin_ops_interventions;
create policy "super_admin_admin_ops_interventions_super_admin_insert"
  on public.super_admin_admin_ops_interventions for insert
  to authenticated
  with check (public.is_super_admin() and intervened_by = auth.uid());

drop policy if exists "platform_emergency_alerts_public_active_select" on public.platform_emergency_alerts;

drop policy if exists "platform_emergency_alerts_admin_select" on public.platform_emergency_alerts;
create policy "platform_emergency_alerts_admin_select"
  on public.platform_emergency_alerts for select
  to authenticated
  using (public.is_ops_admin() or public.is_super_admin());

drop policy if exists "platform_emergency_alerts_ops_admin_request" on public.platform_emergency_alerts;
create policy "platform_emergency_alerts_ops_admin_request"
  on public.platform_emergency_alerts for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and status = 'pending_super_admin'
    and public.admin_has_permission('emergency.request')
  );

drop policy if exists "platform_emergency_alerts_super_admin_all" on public.platform_emergency_alerts;
create policy "platform_emergency_alerts_super_admin_all"
  on public.platform_emergency_alerts for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "platform_notification_preferences_own_select" on public.platform_notification_preferences;
create policy "platform_notification_preferences_own_select"
  on public.platform_notification_preferences for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "platform_notification_preferences_own_insert" on public.platform_notification_preferences;
create policy "platform_notification_preferences_own_insert"
  on public.platform_notification_preferences for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "platform_notification_preferences_own_update" on public.platform_notification_preferences;
create policy "platform_notification_preferences_own_update"
  on public.platform_notification_preferences for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "platform_alert_acknowledgements_own_select" on public.platform_alert_acknowledgements;
create policy "platform_alert_acknowledgements_own_select"
  on public.platform_alert_acknowledgements for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "platform_alert_acknowledgements_own_insert" on public.platform_alert_acknowledgements;
create policy "platform_alert_acknowledgements_own_insert"
  on public.platform_alert_acknowledgements for insert
  to authenticated
  with check (user_id = auth.uid());

revoke all on public.admin_permission_profiles from anon;
revoke all on public.admin_permission_assignments from anon;
revoke all on public.super_admin_admin_ops_interventions from anon;
revoke all on public.platform_emergency_alerts from anon;
revoke all on public.platform_notification_preferences from anon;
revoke all on public.platform_alert_acknowledgements from anon;

grant select on public.admin_permission_profiles to authenticated;
grant select on public.admin_permission_assignments to authenticated;
grant select, insert on public.super_admin_admin_ops_interventions to authenticated;
grant select, insert, update on public.platform_emergency_alerts to authenticated;
grant select, insert, update on public.platform_notification_preferences to authenticated;
grant select, insert on public.platform_alert_acknowledgements to authenticated;
grant execute on function public.admin_has_permission(text) to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.admin_permission_profiles to service_role;
    grant all on public.admin_permission_assignments to service_role;
    grant all on public.super_admin_admin_ops_interventions to service_role;
    grant all on public.platform_emergency_alerts to service_role;
    grant all on public.platform_notification_preferences to service_role;
    grant all on public.platform_alert_acknowledgements to service_role;
    grant execute on function public.admin_has_permission(text) to service_role;
  end if;
end $$;

comment on table public.admin_permission_profiles is
  'Super Admin approved Admin Panel permission profiles. Admins do not receive Super Admin capabilities here.';

comment on table public.admin_permission_assignments is
  'Assignment of limited Admin Panel capability profiles to admin-role users.';

comment on table public.platform_emergency_alerts is
  'Super Admin approved emergency/banner/sound notification feed for the platform.';
