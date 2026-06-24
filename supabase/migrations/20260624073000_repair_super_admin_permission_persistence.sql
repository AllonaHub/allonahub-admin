create extension if not exists pgcrypto;

alter table public.profiles add column if not exists account_status text default 'active';
alter table public.profiles add column if not exists flagged_suspicious boolean default false;
alter table public.profiles add column if not exists risk_level text default 'low';
alter table public.profiles add column if not exists suspended_until timestamptz;
alter table public.profiles add column if not exists last_admin_note text;
alter table public.profiles add column if not exists updated_at timestamptz default now();

update public.profiles
set
  account_status = coalesce(account_status, 'active'),
  flagged_suspicious = coalesce(flagged_suspicious, false),
  risk_level = coalesce(risk_level, 'low'),
  updated_at = coalesce(updated_at, now())
where
  account_status is null
  or flagged_suspicious is null
  or risk_level is null
  or updated_at is null;

create table if not exists public.super_admin_permission_changes (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid,
  actor_id uuid,
  action text not null default 'role_permission_update',
  old_role text,
  new_role text,
  old_account_status text,
  new_account_status text,
  old_risk_level text,
  new_risk_level text,
  reason text not null,
  risk_level text not null default 'high',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists super_admin_permission_changes_target_idx
  on public.super_admin_permission_changes(target_user_id, created_at desc);

create index if not exists super_admin_permission_changes_actor_idx
  on public.super_admin_permission_changes(actor_id, created_at desc);

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
      and coalesce(auth.role(), '') <> 'service_role' then
      raise exception 'Only audited backend service role can change profile roles';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_security_fields on public.profiles;
create trigger profiles_protect_security_fields
  before update on public.profiles
  for each row execute function public.protect_profile_security_fields();

comment on function public.protect_profile_security_fields() is
  'Protects profile role changes. Super Admin role, status and risk writes go through audited backend service_role APIs.';

select pg_notify('pgrst', 'reload schema');
