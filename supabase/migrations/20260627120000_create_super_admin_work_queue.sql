create extension if not exists pgcrypto;

create table if not exists public.super_admin_work_queue (
  id uuid primary key default gen_random_uuid(),
  source_module text not null
    check (source_module in ('admin_ops', 'avm', 'food', 'taxi', 'social_media', 'partner', 'user_panel', 'security', 'legal', 'release', 'system', 'other')),
  target_type text not null,
  target_id text,
  title text not null check (length(trim(title)) between 3 and 220),
  summary text not null default '',
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  risk_level text not null default 'medium'
    check (risk_level in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'waiting_owner', 'decided', 'resolved', 'cancelled')),
  owner_user_id uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  decision_required boolean not null default true,
  decision text
    check (decision is null or decision in ('approved', 'rejected', 'deferred', 'escalated', 'resolved')),
  decision_reason text,
  metadata jsonb not null default '{}'::jsonb,
  audit_event_id uuid references public.security_audit_events(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.super_admin_work_queue
  add column if not exists source_module text not null default 'other',
  add column if not exists target_type text not null default 'operation',
  add column if not exists target_id text,
  add column if not exists title text not null default 'Super Admin işi',
  add column if not exists summary text not null default '',
  add column if not exists priority text not null default 'normal',
  add column if not exists risk_level text not null default 'medium',
  add column if not exists status text not null default 'open',
  add column if not exists owner_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists due_at timestamptz,
  add column if not exists decision_required boolean not null default true,
  add column if not exists decision text,
  add column if not exists decision_reason text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists audit_event_id uuid references public.security_audit_events(id) on delete set null,
  add column if not exists created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  add column if not exists updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists decided_by uuid references public.profiles(id) on delete set null,
  add column if not exists decided_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists super_admin_work_queue_status_idx
  on public.super_admin_work_queue(status, priority, risk_level, created_at desc);
create index if not exists super_admin_work_queue_module_idx
  on public.super_admin_work_queue(source_module, status, created_at desc);
create index if not exists super_admin_work_queue_target_idx
  on public.super_admin_work_queue(target_type, target_id);
create index if not exists super_admin_work_queue_owner_idx
  on public.super_admin_work_queue(owner_user_id, status, due_at);
create index if not exists super_admin_work_queue_due_idx
  on public.super_admin_work_queue(due_at)
  where due_at is not null and status in ('open', 'in_progress', 'waiting_owner');

drop trigger if exists super_admin_work_queue_set_updated_at on public.super_admin_work_queue;
create trigger super_admin_work_queue_set_updated_at
  before update on public.super_admin_work_queue
  for each row execute function public.set_updated_at();

create or replace function public.block_super_admin_work_queue_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'super_admin_work_queue records are not deletable from client roles';
end;
$$;

drop trigger if exists super_admin_work_queue_no_delete on public.super_admin_work_queue;
create trigger super_admin_work_queue_no_delete
  before delete on public.super_admin_work_queue
  for each row execute function public.block_super_admin_work_queue_delete();

alter table public.super_admin_work_queue enable row level security;

drop policy if exists "super_admin_work_queue_owner_select" on public.super_admin_work_queue;
create policy "super_admin_work_queue_owner_select"
  on public.super_admin_work_queue for select
  to authenticated
  using (public.is_super_admin_owner());

drop policy if exists "super_admin_work_queue_no_client_insert" on public.super_admin_work_queue;
create policy "super_admin_work_queue_no_client_insert"
  on public.super_admin_work_queue for insert
  to authenticated
  with check (false);

drop policy if exists "super_admin_work_queue_no_client_update" on public.super_admin_work_queue;
create policy "super_admin_work_queue_no_client_update"
  on public.super_admin_work_queue for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists "super_admin_work_queue_no_client_delete" on public.super_admin_work_queue;
create policy "super_admin_work_queue_no_client_delete"
  on public.super_admin_work_queue for delete
  to authenticated
  using (false);

revoke all on public.super_admin_work_queue from anon;
grant select on public.super_admin_work_queue to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.super_admin_work_queue to service_role;
  end if;
end $$;

comment on table public.super_admin_work_queue is
  'Owner-only Super Admin work queue that unifies module approvals, incidents, release gates, support escalations and security risks.';
