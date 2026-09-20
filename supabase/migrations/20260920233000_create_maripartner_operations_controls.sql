create extension if not exists pgcrypto;

alter table public.maritime_partner_notifications
  add column if not exists dedupe_key text;

alter table public.maritime_urgent_crew_requests
  add column if not exists idempotency_key uuid;

create unique index if not exists maritime_partner_notifications_dedupe_uidx
  on public.maritime_partner_notifications(partner_id, recipient_user_id, dedupe_key)
  where dedupe_key is not null;

create unique index if not exists maritime_urgent_crew_requests_idempotency_uidx
  on public.maritime_urgent_crew_requests(partner_id, created_by, idempotency_key)
  where idempotency_key is not null;

create index if not exists maritime_partner_notifications_recipient_unread_idx
  on public.maritime_partner_notifications(partner_id, recipient_user_id, is_read, created_at desc);

create table if not exists public.maritime_partner_notification_preferences (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  in_app_mode text not null default 'all' check (in_app_mode in ('all','important','muted')),
  email_digest text not null default 'off' check (email_digest in ('off','daily','weekly')),
  category_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, user_id)
);

create table if not exists public.maritime_partner_saved_searches (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  search_scope text not null default 'candidate_pool' check (search_scope in ('candidate_pool','smart_matches','replacement')),
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, owner_user_id, name)
);

create table if not exists public.maritime_partner_operation_requests (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  operation_type text not null check (operation_type in ('urgent_crew','replacement','bulk_invite','job_transition','notification_update')),
  idempotency_key uuid not null,
  resource_type text,
  resource_id uuid,
  request_hash char(64) not null check (request_hash ~ '^[0-9a-f]{64}$'),
  result_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (partner_id, actor_user_id, operation_type, idempotency_key)
);

create index if not exists maritime_partner_saved_searches_partner_idx
  on public.maritime_partner_saved_searches(partner_id, owner_user_id, updated_at desc);
create index if not exists maritime_partner_operation_requests_partner_idx
  on public.maritime_partner_operation_requests(partner_id, operation_type, created_at desc);

do $maripartner_operations_security$
declare
  table_name text;
begin
  foreach table_name in array array[
    'maritime_partner_notification_preferences',
    'maritime_partner_saved_searches',
    'maritime_partner_operation_requests'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
  end loop;
end
$maripartner_operations_security$;

drop trigger if exists maritime_partner_notification_preferences_set_updated_at on public.maritime_partner_notification_preferences;
create trigger maritime_partner_notification_preferences_set_updated_at
  before update on public.maritime_partner_notification_preferences
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_partner_saved_searches_set_updated_at on public.maritime_partner_saved_searches;
create trigger maritime_partner_saved_searches_set_updated_at
  before update on public.maritime_partner_saved_searches
  for each row execute function public.set_updated_at();

comment on table public.maritime_partner_operation_requests is
  'Server-only idempotency ledger for tenant-scoped MariPartner operations.';
