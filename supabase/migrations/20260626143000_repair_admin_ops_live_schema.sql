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

create or replace function public.is_ops_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_app_role() in ('admin', 'super_admin')
    and public.has_mfa();
$$;

comment on function public.is_ops_admin() is
  'Strict Admin Panel role helper. Allows MFA-verified Admin and Super Admin users to use the limited operations console; Super Admin-only controls remain outside the Admin Panel.';

alter table if exists public.partner_applications
  add column if not exists documents jsonb not null default '[]'::jsonb,
  add column if not exists review_stage text not null default 'new',
  add column if not exists admin_recommendation text,
  add column if not exists risk_level text not null default 'info',
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if to_regclass('public.partner_applications') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'partner_applications_review_stage_allowed'
        and conrelid = to_regclass('public.partner_applications')
    ) then
    alter table public.partner_applications
      add constraint partner_applications_review_stage_allowed
      check (review_stage in ('new', 'in_review', 'recommendation_ready', 'sent_to_super_admin', 'closed'))
      not valid;
  end if;

  if to_regclass('public.partner_applications') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'partner_applications_admin_recommendation_allowed'
        and conrelid = to_regclass('public.partner_applications')
    ) then
    alter table public.partner_applications
      add constraint partner_applications_admin_recommendation_allowed
      check (admin_recommendation is null or admin_recommendation in ('approve', 'reject', 'needs_super_admin'))
      not valid;
  end if;

  if to_regclass('public.partner_applications') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'partner_applications_risk_level_allowed'
        and conrelid = to_regclass('public.partner_applications')
    ) then
    alter table public.partner_applications
      add constraint partner_applications_risk_level_allowed
      check (risk_level in ('info', 'warning', 'critical'))
      not valid;
  end if;
end $$;

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  kind text not null default 'system',
  severity text not null default 'info',
  title text not null default 'Admin bildirimi',
  message text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.admin_notifications
  add column if not exists user_id uuid references public.profiles(id) on delete set null,
  add column if not exists kind text not null default 'system',
  add column if not exists severity text not null default 'info',
  add column if not exists title text not null default 'Admin bildirimi',
  add column if not exists message text not null default '',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists is_read boolean not null default false,
  add column if not exists read_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

create index if not exists admin_notifications_kind_created_idx
  on public.admin_notifications(kind, created_at desc);
create index if not exists admin_notifications_user_created_idx
  on public.admin_notifications(user_id, created_at desc);
create index if not exists admin_notifications_severity_created_idx
  on public.admin_notifications(severity, created_at desc);

create table if not exists public.admin_operation_notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  target_type text not null
    check (target_type in ('user', 'partner_application', 'partner_business', 'order', 'support_ticket', 'partner_support_ticket', 'content_module', 'security_alert')),
  target_id text not null,
  note_type text not null default 'general'
    check (note_type in ('general', 'risk', 'review', 'support', 'callback')),
  body text not null check (length(trim(body)) between 3 and 1600),
  visibility text not null default 'admin'
    check (visibility in ('admin', 'super_admin')),
  created_at timestamptz not null default now()
);

alter table public.admin_operation_notes
  add column if not exists author_id uuid references public.profiles(id) on delete restrict default auth.uid(),
  add column if not exists target_type text,
  add column if not exists target_id text,
  add column if not exists note_type text default 'general',
  add column if not exists body text,
  add column if not exists visibility text default 'admin',
  add column if not exists created_at timestamptz not null default now();

create index if not exists admin_operation_notes_target_idx
  on public.admin_operation_notes(target_type, target_id, created_at desc);
create index if not exists admin_operation_notes_author_idx
  on public.admin_operation_notes(author_id, created_at desc);

create table if not exists public.admin_operation_flags (
  id uuid primary key default gen_random_uuid(),
  flagged_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  target_type text not null
    check (target_type in ('user', 'partner_application', 'partner_business', 'order', 'support_ticket', 'partner_support_ticket', 'content_module', 'security_alert')),
  target_id text not null,
  flag_type text not null
    check (flag_type in ('suspicious_user', 'partner_review', 'risky_order', 'security_watch', 'content_review')),
  severity text not null default 'warning'
    check (severity in ('info', 'warning', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'in_review', 'resolved')),
  reason text not null check (length(trim(reason)) between 3 and 1200),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_operation_flags
  add column if not exists flagged_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  add column if not exists target_type text,
  add column if not exists target_id text,
  add column if not exists flag_type text,
  add column if not exists severity text default 'warning',
  add column if not exists status text default 'open',
  add column if not exists reason text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists admin_operation_flags_target_idx
  on public.admin_operation_flags(target_type, target_id, status, created_at desc);
create index if not exists admin_operation_flags_status_idx
  on public.admin_operation_flags(status, severity, created_at desc);

create table if not exists public.admin_approval_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  target_type text not null
    check (target_type in ('partner_application', 'partner_business', 'content_module', 'security_alert')),
  target_id text not null,
  request_type text not null
    check (request_type in ('partner_approval', 'partner_rejection', 'content_visibility', 'banner_campaign', 'security_escalation')),
  status text not null default 'pending_super_admin'
    check (status in ('pending_super_admin', 'approved', 'rejected', 'cancelled')),
  summary text not null check (length(trim(summary)) between 3 and 1600),
  proposed_action jsonb not null default '{}'::jsonb,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_approval_requests
  add column if not exists requested_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  add column if not exists target_type text,
  add column if not exists target_id text,
  add column if not exists request_type text,
  add column if not exists status text default 'pending_super_admin',
  add column if not exists summary text,
  add column if not exists proposed_action jsonb not null default '{}'::jsonb,
  add column if not exists decided_by uuid references public.profiles(id) on delete set null,
  add column if not exists decided_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists admin_approval_requests_status_idx
  on public.admin_approval_requests(status, request_type, created_at desc);
create index if not exists admin_approval_requests_target_idx
  on public.admin_approval_requests(target_type, target_id, created_at desc);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null default auth.uid(),
  requester_type text not null default 'user'
    check (requester_type in ('user', 'partner', 'guest')),
  category text not null default 'general',
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  title text not null check (length(trim(title)) between 3 and 180),
  message text not null check (length(trim(message)) between 3 and 3000),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  assigned_admin_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_tickets
  add column if not exists user_id uuid references public.profiles(id) on delete set null default auth.uid(),
  add column if not exists requester_type text default 'user',
  add column if not exists category text default 'general',
  add column if not exists priority text default 'normal',
  add column if not exists title text,
  add column if not exists message text,
  add column if not exists status text default 'open',
  add column if not exists assigned_admin_id uuid references public.profiles(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists support_tickets_user_status_idx
  on public.support_tickets(user_id, status, created_at desc);
create index if not exists support_tickets_status_idx
  on public.support_tickets(status, priority, created_at desc);

create table if not exists public.support_ticket_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null default auth.uid(),
  note_type text not null default 'internal'
    check (note_type in ('internal', 'reply', 'callback')),
  body text not null check (length(trim(body)) between 3 and 1600),
  created_at timestamptz not null default now()
);

alter table public.support_ticket_notes
  add column if not exists ticket_id uuid references public.support_tickets(id) on delete cascade,
  add column if not exists author_id uuid references public.profiles(id) on delete set null default auth.uid(),
  add column if not exists note_type text default 'internal',
  add column if not exists body text,
  add column if not exists created_at timestamptz not null default now();

create index if not exists support_ticket_notes_ticket_idx
  on public.support_ticket_notes(ticket_id, created_at desc);

create table if not exists public.content_change_proposals (
  id uuid primary key default gen_random_uuid(),
  proposed_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  content_scope text not null
    check (content_scope in ('home_module', 'banner', 'campaign', 'page', 'legal')),
  title text not null check (length(trim(title)) between 3 and 180),
  summary text not null check (length(trim(summary)) between 3 and 1600),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending_super_admin'
    check (status in ('pending_super_admin', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_change_proposals
  add column if not exists proposed_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  add column if not exists content_scope text,
  add column if not exists title text,
  add column if not exists summary text,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists status text default 'pending_super_admin',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists content_change_proposals_status_idx
  on public.content_change_proposals(status, content_scope, created_at desc);

drop trigger if exists admin_operation_flags_set_updated_at on public.admin_operation_flags;
create trigger admin_operation_flags_set_updated_at
  before update on public.admin_operation_flags
  for each row execute function public.set_updated_at();

drop trigger if exists admin_approval_requests_set_updated_at on public.admin_approval_requests;
create trigger admin_approval_requests_set_updated_at
  before update on public.admin_approval_requests
  for each row execute function public.set_updated_at();

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

drop trigger if exists content_change_proposals_set_updated_at on public.content_change_proposals;
create trigger content_change_proposals_set_updated_at
  before update on public.content_change_proposals
  for each row execute function public.set_updated_at();

create or replace function public.protect_admin_approval_request_decisions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and new.status in ('approved', 'rejected')
    and public.current_app_role() <> 'super_admin'
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'Only Super Admin can approve or reject Admin Panel requests';
  end if;

  return new;
end;
$$;

drop trigger if exists admin_approval_requests_protect_decisions on public.admin_approval_requests;
create trigger admin_approval_requests_protect_decisions
  before update on public.admin_approval_requests
  for each row execute function public.protect_admin_approval_request_decisions();

create or replace function public.block_admin_ops_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Admin operation records are not deletable from client roles';
end;
$$;

drop trigger if exists admin_operation_notes_no_delete on public.admin_operation_notes;
create trigger admin_operation_notes_no_delete
  before delete on public.admin_operation_notes
  for each row execute function public.block_admin_ops_delete();

drop trigger if exists admin_operation_flags_no_delete on public.admin_operation_flags;
create trigger admin_operation_flags_no_delete
  before delete on public.admin_operation_flags
  for each row execute function public.block_admin_ops_delete();

drop trigger if exists admin_approval_requests_no_delete on public.admin_approval_requests;
create trigger admin_approval_requests_no_delete
  before delete on public.admin_approval_requests
  for each row execute function public.block_admin_ops_delete();

drop trigger if exists support_tickets_no_delete on public.support_tickets;
create trigger support_tickets_no_delete
  before delete on public.support_tickets
  for each row execute function public.block_admin_ops_delete();

drop trigger if exists content_change_proposals_no_delete on public.content_change_proposals;
create trigger content_change_proposals_no_delete
  before delete on public.content_change_proposals
  for each row execute function public.block_admin_ops_delete();

alter table public.admin_notifications enable row level security;
alter table public.admin_operation_notes enable row level security;
alter table public.admin_operation_flags enable row level security;
alter table public.admin_approval_requests enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_notes enable row level security;
alter table public.content_change_proposals enable row level security;

drop policy if exists "admin_notifications_select_admin" on public.admin_notifications;
create policy "admin_notifications_select_admin"
  on public.admin_notifications for select
  to authenticated
  using (public.is_ops_admin());

drop policy if exists "admin_notifications_admin_all" on public.admin_notifications;
create policy "admin_notifications_admin_all"
  on public.admin_notifications for all
  to authenticated
  using (public.is_ops_admin())
  with check (public.is_ops_admin());

drop policy if exists "admin_operation_notes_ops_admin_select" on public.admin_operation_notes;
create policy "admin_operation_notes_ops_admin_select"
  on public.admin_operation_notes for select
  to authenticated
  using (public.is_ops_admin());

drop policy if exists "admin_operation_notes_ops_admin_insert" on public.admin_operation_notes;
create policy "admin_operation_notes_ops_admin_insert"
  on public.admin_operation_notes for insert
  to authenticated
  with check (public.is_ops_admin() and author_id = auth.uid());

drop policy if exists "admin_operation_flags_ops_admin_select" on public.admin_operation_flags;
create policy "admin_operation_flags_ops_admin_select"
  on public.admin_operation_flags for select
  to authenticated
  using (public.is_ops_admin());

drop policy if exists "admin_operation_flags_ops_admin_insert" on public.admin_operation_flags;
create policy "admin_operation_flags_ops_admin_insert"
  on public.admin_operation_flags for insert
  to authenticated
  with check (public.is_ops_admin() and flagged_by = auth.uid());

drop policy if exists "admin_operation_flags_ops_admin_update" on public.admin_operation_flags;
create policy "admin_operation_flags_ops_admin_update"
  on public.admin_operation_flags for update
  to authenticated
  using (public.is_ops_admin() and flagged_by = auth.uid())
  with check (public.is_ops_admin() and flagged_by = auth.uid() and status in ('open', 'in_review', 'resolved'));

drop policy if exists "admin_approval_requests_ops_admin_select" on public.admin_approval_requests;
create policy "admin_approval_requests_ops_admin_select"
  on public.admin_approval_requests for select
  to authenticated
  using (public.is_ops_admin());

drop policy if exists "admin_approval_requests_ops_admin_insert" on public.admin_approval_requests;
create policy "admin_approval_requests_ops_admin_insert"
  on public.admin_approval_requests for insert
  to authenticated
  with check (public.is_ops_admin() and requested_by = auth.uid() and status = 'pending_super_admin');

drop policy if exists "admin_approval_requests_ops_admin_cancel" on public.admin_approval_requests;
create policy "admin_approval_requests_ops_admin_cancel"
  on public.admin_approval_requests for update
  to authenticated
  using (public.is_ops_admin() and requested_by = auth.uid())
  with check (public.is_ops_admin() and requested_by = auth.uid() and status in ('pending_super_admin', 'cancelled'));

drop policy if exists "support_tickets_own_or_ops_admin_select" on public.support_tickets;
create policy "support_tickets_own_or_ops_admin_select"
  on public.support_tickets for select
  to authenticated
  using (user_id = auth.uid() or public.is_ops_admin());

drop policy if exists "support_tickets_own_insert" on public.support_tickets;
create policy "support_tickets_own_insert"
  on public.support_tickets for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_ops_admin());

drop policy if exists "support_tickets_ops_admin_update" on public.support_tickets;
create policy "support_tickets_ops_admin_update"
  on public.support_tickets for update
  to authenticated
  using (public.is_ops_admin())
  with check (public.is_ops_admin());

drop policy if exists "support_ticket_notes_ticket_owner_or_ops_admin_select" on public.support_ticket_notes;
create policy "support_ticket_notes_ticket_owner_or_ops_admin_select"
  on public.support_ticket_notes for select
  to authenticated
  using (
    public.is_ops_admin()
    or exists (
      select 1
      from public.support_tickets st
      where st.id = support_ticket_notes.ticket_id
        and st.user_id = auth.uid()
    )
  );

drop policy if exists "support_ticket_notes_ops_admin_insert" on public.support_ticket_notes;
create policy "support_ticket_notes_ops_admin_insert"
  on public.support_ticket_notes for insert
  to authenticated
  with check (public.is_ops_admin() and author_id = auth.uid());

drop policy if exists "content_change_proposals_ops_admin_select" on public.content_change_proposals;
create policy "content_change_proposals_ops_admin_select"
  on public.content_change_proposals for select
  to authenticated
  using (public.is_ops_admin());

drop policy if exists "content_change_proposals_ops_admin_insert" on public.content_change_proposals;
create policy "content_change_proposals_ops_admin_insert"
  on public.content_change_proposals for insert
  to authenticated
  with check (public.is_ops_admin() and proposed_by = auth.uid() and status = 'pending_super_admin');

drop policy if exists "content_change_proposals_ops_admin_cancel" on public.content_change_proposals;
create policy "content_change_proposals_ops_admin_cancel"
  on public.content_change_proposals for update
  to authenticated
  using (public.is_ops_admin() and proposed_by = auth.uid())
  with check (public.is_ops_admin() and proposed_by = auth.uid() and status in ('pending_super_admin', 'cancelled'));

revoke all on public.admin_notifications from anon;
revoke all on public.admin_operation_notes from anon;
revoke all on public.admin_operation_flags from anon;
revoke all on public.admin_approval_requests from anon;
revoke all on public.support_tickets from anon;
revoke all on public.support_ticket_notes from anon;
revoke all on public.content_change_proposals from anon;

grant select, insert, update on public.admin_notifications to authenticated;
grant select, insert on public.admin_operation_notes to authenticated;
grant select, insert, update on public.admin_operation_flags to authenticated;
grant select, insert, update on public.admin_approval_requests to authenticated;
grant select, insert, update on public.support_tickets to authenticated;
grant select, insert on public.support_ticket_notes to authenticated;
grant select, insert, update on public.content_change_proposals to authenticated;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_auth_aal() to authenticated;
grant execute on function public.has_mfa() to authenticated;
grant execute on function public.is_ops_admin() to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.admin_notifications to service_role;
    grant all on public.admin_operation_notes to service_role;
    grant all on public.admin_operation_flags to service_role;
    grant all on public.admin_approval_requests to service_role;
    grant all on public.support_tickets to service_role;
    grant all on public.support_ticket_notes to service_role;
    grant all on public.content_change_proposals to service_role;
    grant execute on function public.current_app_role() to service_role;
    grant execute on function public.current_auth_aal() to service_role;
    grant execute on function public.has_mfa() to service_role;
    grant execute on function public.is_ops_admin() to service_role;
  end if;
end $$;

comment on table public.admin_notifications is
  'Admin-only operational notifications for security, CV, rewards and system alerts.';

comment on table public.admin_operation_notes is
  'Admin Panel operational notes. Admins can add review/support/risk notes but cannot delete user data.';

comment on table public.admin_operation_flags is
  'Admin Panel review and risk flags for users, partner applications, partners, orders, support and security alerts.';

comment on table public.admin_approval_requests is
  'Admin Panel requests that must be decided in the separate Super Admin authority surface.';

comment on table public.support_tickets is
  'General user support ticket queue for the limited Admin Panel.';

comment on table public.content_change_proposals is
  'Content/banner/campaign proposals prepared by Admin and sent to Super Admin approval.';
