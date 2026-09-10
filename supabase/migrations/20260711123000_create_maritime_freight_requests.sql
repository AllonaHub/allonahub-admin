create extension if not exists pgcrypto;

create table if not exists public.maritime_freight_requests (
  id uuid primary key default gen_random_uuid(),
  reference_no text not null unique
    default ('MFR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  client_request_id uuid not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  module_key text not null default 'maritime'
    check (module_key = 'maritime'),
  status text not null default 'submitted'
    check (status in ('submitted', 'in_review', 'matching', 'quoted', 'accepted', 'cancelled', 'closed')),
  cargo_type text not null
    check (cargo_type in ('bulk', 'general-cargo', 'container', 'tanker')),
  load_port text not null
    check (char_length(load_port) between 2 and 80),
  discharge_port text not null
    check (char_length(discharge_port) between 2 and 80),
  quantity numeric(14,2) not null
    check (quantity >= 1 and quantity <= 1000000),
  quantity_unit text not null
    check (quantity_unit in ('MT', 'CBM', 'TEU')),
  laycan_start date not null,
  source text not null default 'web'
    check (source in ('web', 'partner', 'admin', 'api')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maritime_freight_requests_ports_differ
    check (lower(btrim(load_port)) <> lower(btrim(discharge_port))),
  constraint maritime_freight_requests_user_client_unique
    unique (user_id, client_request_id)
);

create index if not exists maritime_freight_requests_user_created_idx
  on public.maritime_freight_requests(user_id, created_at desc);
create index if not exists maritime_freight_requests_status_created_idx
  on public.maritime_freight_requests(module_key, status, created_at desc);

drop trigger if exists maritime_freight_requests_set_updated_at on public.maritime_freight_requests;
create trigger maritime_freight_requests_set_updated_at
  before update on public.maritime_freight_requests
  for each row execute function public.set_updated_at();

create table if not exists public.maritime_freight_request_events (
  id uuid primary key default gen_random_uuid(),
  freight_request_id uuid not null references public.maritime_freight_requests(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null
    check (event_type in ('submitted', 'review_started', 'matching_started', 'quote_added', 'accepted', 'cancelled', 'closed')),
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists maritime_freight_request_events_request_created_idx
  on public.maritime_freight_request_events(freight_request_id, created_at desc);
create unique index if not exists maritime_freight_request_events_submitted_unique
  on public.maritime_freight_request_events(freight_request_id)
  where event_type = 'submitted';
create unique index if not exists maritime_freight_request_events_cancelled_unique
  on public.maritime_freight_request_events(freight_request_id)
  where event_type = 'cancelled';

alter table public.maritime_freight_requests enable row level security;
alter table public.maritime_freight_request_events enable row level security;

drop policy if exists "maritime_freight_requests_select_own_or_admin" on public.maritime_freight_requests;
create policy "maritime_freight_requests_select_own_or_admin"
  on public.maritime_freight_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "maritime_freight_requests_admin_update" on public.maritime_freight_requests;
create policy "maritime_freight_requests_admin_update"
  on public.maritime_freight_requests for update to authenticated
  using (public.is_admin())
  with check (public.is_admin() and module_key = 'maritime');

drop policy if exists "maritime_freight_request_events_select_related" on public.maritime_freight_request_events;
create policy "maritime_freight_request_events_select_related"
  on public.maritime_freight_request_events for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.maritime_freight_requests request
      where request.id = maritime_freight_request_events.freight_request_id
        and request.user_id = auth.uid()
    )
  );

revoke all on public.maritime_freight_requests from anon, authenticated;
revoke all on public.maritime_freight_request_events from anon, authenticated;
grant select on public.maritime_freight_requests to authenticated;
grant select on public.maritime_freight_request_events to authenticated;
grant all on public.maritime_freight_requests to service_role;
grant all on public.maritime_freight_request_events to service_role;

comment on table public.maritime_freight_requests is
  'Authenticated Allona Denizcilik freight requests. Writes are accepted only through the backend API; users can read only their own rows through RLS.';
comment on column public.maritime_freight_requests.client_request_id is
  'Client-generated idempotency key scoped to the authenticated user.';
comment on table public.maritime_freight_request_events is
  'Append-only operational history for maritime freight request status changes.';
