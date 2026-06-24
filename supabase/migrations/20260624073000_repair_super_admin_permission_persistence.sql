create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'passive', 'suspended')),
  add column if not exists flagged_suspicious boolean not null default false,
  add column if not exists risk_level text not null default 'low'
    check (risk_level in ('low', 'medium', 'high', 'critical')),
  add column if not exists suspended_until timestamptz,
  add column if not exists last_admin_note text;

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

create index if not exists super_admin_permission_changes_target_idx
  on public.super_admin_permission_changes(target_user_id, created_at desc);

create index if not exists super_admin_permission_changes_actor_idx
  on public.super_admin_permission_changes(actor_id, created_at desc);

alter table public.super_admin_permission_changes enable row level security;

drop policy if exists "super_admin_permission_changes_owner_select" on public.super_admin_permission_changes;
create policy "super_admin_permission_changes_owner_select"
  on public.super_admin_permission_changes for select
  to authenticated
  using (public.is_super_admin_owner());

drop policy if exists "super_admin_permission_changes_no_client_insert" on public.super_admin_permission_changes;
create policy "super_admin_permission_changes_no_client_insert"
  on public.super_admin_permission_changes for insert
  to authenticated
  with check (false);

drop policy if exists "super_admin_permission_changes_no_client_update" on public.super_admin_permission_changes;
create policy "super_admin_permission_changes_no_client_update"
  on public.super_admin_permission_changes for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists "super_admin_permission_changes_no_client_delete" on public.super_admin_permission_changes;
create policy "super_admin_permission_changes_no_client_delete"
  on public.super_admin_permission_changes for delete
  to authenticated
  using (false);

revoke all on public.super_admin_permission_changes from anon;
grant select on public.super_admin_permission_changes to authenticated;

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

    if new.role is distinct from old.role
      and coalesce(auth.role(), '') <> 'service_role'
      and not public.is_super_admin() then
      raise exception 'Only MFA verified super admin or backend service role can change roles';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.super_admin_update_profile_permission(
  p_target_user_id uuid,
  p_role text default null,
  p_account_status text default null,
  p_risk_level text default null,
  p_flagged_suspicious boolean default null,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_before public.profiles%rowtype;
  v_after public.profiles%rowtype;
  v_change public.super_admin_permission_changes%rowtype;
  v_risk text := 'medium';
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_super_admin_owner() then
    raise exception 'Only the Super Admin owner can update permissions';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 6 then
    raise exception 'Permission update reason is required';
  end if;

  select *
    into v_before
    from public.profiles
    where id = p_target_user_id
    for update;

  if not found then
    raise exception 'Target profile not found';
  end if;

  if p_role is not null and p_role not in ('customer', 'partner', 'courier', 'admin', 'super_admin') then
    raise exception 'Invalid role';
  end if;

  if p_account_status is not null and p_account_status not in ('active', 'passive', 'suspended') then
    raise exception 'Invalid account status';
  end if;

  if p_risk_level is not null and p_risk_level not in ('low', 'medium', 'high', 'critical') then
    raise exception 'Invalid risk level';
  end if;

  if p_target_user_id = v_actor_id then
    if p_role is not null and p_role <> 'super_admin' then
      raise exception 'Owner cannot demote the active Super Admin session';
    end if;
    if p_account_status is not null and p_account_status <> 'active' then
      raise exception 'Owner cannot deactivate the active Super Admin session';
    end if;
  end if;

  if p_role = 'super_admin' and not exists (
    select 1
    from public.super_admin_owner_access owner_access
    where owner_access.status = 'active'
      and (
        owner_access.user_id = p_target_user_id
        or (
          owner_access.email is not null
          and owner_access.email = lower(coalesce(v_before.email, ''))
        )
      )
  ) then
    raise exception 'Super Admin role requires active owner_access record';
  end if;

  v_risk := case
    when p_role = 'super_admin' or p_account_status = 'suspended' then 'critical'
    when p_role = 'admin' or p_risk_level in ('high', 'critical') then 'high'
    else 'medium'
  end;

  update public.profiles
    set role = coalesce(p_role, role),
        account_status = coalesce(p_account_status, account_status),
        risk_level = coalesce(p_risk_level, risk_level),
        flagged_suspicious = coalesce(p_flagged_suspicious, flagged_suspicious),
        last_admin_note = trim(p_reason),
        updated_at = now()
    where id = p_target_user_id
    returning * into v_after;

  insert into public.super_admin_permission_changes (
    target_user_id,
    actor_id,
    action,
    old_role,
    new_role,
    old_account_status,
    new_account_status,
    old_risk_level,
    new_risk_level,
    reason,
    risk_level,
    metadata
  )
  values (
    p_target_user_id,
    v_actor_id,
    'role_permission_update',
    v_before.role,
    v_after.role,
    coalesce(v_before.account_status, 'active'),
    coalesce(v_after.account_status, 'active'),
    coalesce(v_before.risk_level, 'low'),
    coalesce(v_after.risk_level, 'low'),
    trim(p_reason),
    v_risk,
    jsonb_build_object(
      'target_email', v_after.email,
      'flagged_suspicious', coalesce(v_after.flagged_suspicious, false),
      'source', 'super_admin_owner_console'
    )
  )
  returning * into v_change;

  return jsonb_build_object(
    'profile', to_jsonb(v_after),
    'change', to_jsonb(v_change)
  );
end;
$$;

revoke all on function public.super_admin_update_profile_permission(uuid, text, text, text, boolean, text) from public;
grant execute on function public.super_admin_update_profile_permission(uuid, text, text, text, boolean, text) to authenticated;

comment on function public.protect_profile_security_fields() is
  'Protects profile role changes. MFA verified super admin or backend service_role can change role fields through audited APIs.';

comment on function public.super_admin_update_profile_permission(uuid, text, text, text, boolean, text) is
  'Owner-only permission update RPC that persists role, status and risk changes with an audit-side change row.';

select pg_notify('pgrst', 'reload schema');
