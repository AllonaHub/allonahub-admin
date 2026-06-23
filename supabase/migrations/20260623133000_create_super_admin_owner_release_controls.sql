create extension if not exists pgcrypto;

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

create unique index if not exists super_admin_owner_access_user_idx
  on public.super_admin_owner_access(user_id)
  where user_id is not null;

create unique index if not exists super_admin_owner_access_email_idx
  on public.super_admin_owner_access(email)
  where email is not null;

create index if not exists super_admin_owner_access_status_idx
  on public.super_admin_owner_access(status, created_at desc);

drop trigger if exists super_admin_owner_access_set_updated_at on public.super_admin_owner_access;
create trigger super_admin_owner_access_set_updated_at
  before update on public.super_admin_owner_access
  for each row execute function public.set_updated_at();

create or replace function public.is_super_admin_owner()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_super_admin()
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

create index if not exists super_admin_release_approvals_status_idx
  on public.super_admin_release_approvals(status, created_at desc);

create index if not exists super_admin_release_approvals_type_idx
  on public.super_admin_release_approvals(approval_type, created_at desc);

create index if not exists super_admin_release_approvals_requested_by_idx
  on public.super_admin_release_approvals(requested_by, created_at desc);

drop trigger if exists super_admin_release_approvals_set_updated_at on public.super_admin_release_approvals;
create trigger super_admin_release_approvals_set_updated_at
  before update on public.super_admin_release_approvals
  for each row execute function public.set_updated_at();

alter table public.super_admin_owner_access enable row level security;
alter table public.super_admin_release_approvals enable row level security;

drop policy if exists "super_admin_owner_access_owner_select" on public.super_admin_owner_access;
create policy "super_admin_owner_access_owner_select"
  on public.super_admin_owner_access for select
  to authenticated
  using (public.is_super_admin_owner());

drop policy if exists "super_admin_owner_access_no_client_insert" on public.super_admin_owner_access;
create policy "super_admin_owner_access_no_client_insert"
  on public.super_admin_owner_access for insert
  to authenticated
  with check (false);

drop policy if exists "super_admin_owner_access_no_client_update" on public.super_admin_owner_access;
create policy "super_admin_owner_access_no_client_update"
  on public.super_admin_owner_access for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists "super_admin_owner_access_no_client_delete" on public.super_admin_owner_access;
create policy "super_admin_owner_access_no_client_delete"
  on public.super_admin_owner_access for delete
  to authenticated
  using (false);

drop policy if exists "super_admin_release_approvals_owner_select" on public.super_admin_release_approvals;
create policy "super_admin_release_approvals_owner_select"
  on public.super_admin_release_approvals for select
  to authenticated
  using (public.is_super_admin_owner());

drop policy if exists "super_admin_release_approvals_no_client_insert" on public.super_admin_release_approvals;
create policy "super_admin_release_approvals_no_client_insert"
  on public.super_admin_release_approvals for insert
  to authenticated
  with check (false);

drop policy if exists "super_admin_release_approvals_no_client_update" on public.super_admin_release_approvals;
create policy "super_admin_release_approvals_no_client_update"
  on public.super_admin_release_approvals for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists "super_admin_release_approvals_no_client_delete" on public.super_admin_release_approvals;
create policy "super_admin_release_approvals_no_client_delete"
  on public.super_admin_release_approvals for delete
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

revoke all on public.super_admin_owner_access from anon;
revoke all on public.super_admin_release_approvals from anon;
grant select on public.super_admin_owner_access to authenticated;
grant select on public.super_admin_release_approvals to authenticated;

do $$
begin
  grant all on public.super_admin_owner_access to service_role;
  grant all on public.super_admin_release_approvals to service_role;
exception
  when undefined_object then null;
end $$;

comment on table public.super_admin_owner_access is
  'Owner-only lock for the AllonaHub Super Admin surface. Seed exactly the founder user id or lowercase email with service_role/SQL.';

comment on table public.super_admin_release_approvals is
  'Audited owner approvals for publish, deploy, migration and main commit/push workflows. Browser clients cannot write.';
