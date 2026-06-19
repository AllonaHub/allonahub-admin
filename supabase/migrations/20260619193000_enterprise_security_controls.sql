create extension if not exists pgcrypto;

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
  created_at timestamptz not null default now()
);

create index if not exists security_audit_events_created_at_idx
  on public.security_audit_events (created_at desc);

create index if not exists security_audit_events_actor_idx
  on public.security_audit_events (actor_id, created_at desc);

create index if not exists security_audit_events_action_idx
  on public.security_audit_events (action, created_at desc);

create index if not exists security_audit_events_resource_idx
  on public.security_audit_events (resource_type, resource_id, created_at desc);

alter table public.security_audit_events enable row level security;

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

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_app_role() = 'super_admin' and public.has_mfa();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_app_role() in ('admin', 'super_admin') and public.has_mfa();
$$;

create or replace function public.is_partner_or_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select (
    public.current_app_role() = 'partner'
    and public.has_mfa()
  ) or public.is_admin();
$$;

create or replace function public.is_courier_or_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select (
    public.current_app_role() = 'courier'
    and public.has_mfa()
  ) or public.is_admin();
$$;

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

revoke all on public.security_audit_events from anon;
grant select on public.security_audit_events to authenticated;

create or replace function public.log_security_event(
  p_actor_id uuid,
  p_actor_role text,
  p_action text,
  p_resource_type text default null,
  p_resource_id text default null,
  p_severity text default 'info',
  p_ip_address text default null,
  p_user_agent text default null,
  p_request_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if p_action is null or length(trim(p_action)) < 2 then
    raise exception 'Invalid security action';
  end if;

  insert into public.security_audit_events (
    actor_id,
    actor_role,
    action,
    resource_type,
    resource_id,
    severity,
    ip_address,
    user_agent,
    request_id,
    metadata
  )
  values (
    p_actor_id,
    nullif(left(coalesce(p_actor_role, ''), 80), ''),
    left(trim(p_action), 140),
    nullif(left(coalesce(p_resource_type, ''), 120), ''),
    nullif(left(coalesce(p_resource_id, ''), 180), ''),
    case when p_severity in ('debug', 'info', 'warning', 'critical') then p_severity else 'info' end,
    nullif(left(coalesce(p_ip_address, ''), 80), ''),
    nullif(left(coalesce(p_user_agent, ''), 500), ''),
    nullif(left(coalesce(p_request_id, ''), 120), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.log_security_event(
  uuid, text, text, text, text, text, text, text, text, jsonb
) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.log_security_event(
      uuid, text, text, text, text, text, text, text, text, jsonb
    ) to service_role;
  end if;
end $$;

create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'Profile id cannot be changed';
    end if;

    if new.role is distinct from old.role and not public.is_super_admin() then
      raise exception 'Only MFA verified super admin can change roles';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_security_fields on public.profiles;
create trigger profiles_protect_security_fields
  before update on public.profiles
  for each row execute function public.protect_profile_security_fields();

comment on table public.security_audit_events is
  'Append-only security audit stream for admin, payment, order, coupon, HP, refund, partner, cron and incident events.';

comment on function public.is_admin() is
  'Admin role helper requiring an MFA verified Supabase JWT aal2 claim.';

comment on function public.is_partner_or_admin() is
  'Partner/admin helper requiring MFA for partner/admin privileged data access.';
