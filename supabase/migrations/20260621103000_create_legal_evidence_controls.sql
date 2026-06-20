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

alter table public.security_audit_events
  add column if not exists source text not null default 'backend'
    check (source in ('backend', 'client', 'auto_defense', 'payment_provider', 'admin', 'system', 'edge_function')),
  add column if not exists purpose text not null default 'security_audit',
  add column if not exists location_basis text not null default 'none'
    check (location_basis in ('none', 'explicit_user_permission', 'contract_performance', 'legal_obligation', 'legitimate_interest', 'public_authority_request')),
  add column if not exists geo_country text,
  add column if not exists geo_region text,
  add column if not exists geo_city text,
  add column if not exists geo_latitude numeric(10,7),
  add column if not exists geo_longitude numeric(10,7),
  add column if not exists geo_accuracy_m numeric(10,2),
  add column if not exists previous_hash text,
  add column if not exists event_hash text,
  add column if not exists retention_until timestamptz,
  add column if not exists evidence_tags text[] not null default '{}'::text[];

update public.security_audit_events
set retention_until = coalesce(retention_until, created_at + interval '365 days')
where retention_until is null;

create unique index if not exists security_audit_events_event_hash_idx
  on public.security_audit_events(event_hash)
  where event_hash is not null;

create index if not exists security_audit_events_retention_idx
  on public.security_audit_events(retention_until, created_at desc);

create index if not exists security_audit_events_source_purpose_idx
  on public.security_audit_events(source, purpose, created_at desc);

create index if not exists security_audit_events_evidence_tags_idx
  on public.security_audit_events using gin(evidence_tags);

create or replace function public.append_security_audit_event(
  p_actor_id uuid,
  p_actor_role text,
  p_action text,
  p_resource_type text default null,
  p_resource_id text default null,
  p_severity text default 'info',
  p_ip_address text default null,
  p_user_agent text default null,
  p_request_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_source text default 'backend',
  p_purpose text default 'security_audit',
  p_location_basis text default 'none',
  p_location jsonb default '{}'::jsonb,
  p_evidence_tags text[] default '{}'::text[],
  p_retention_days integer default 365
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_created_at timestamptz := now();
  v_previous_hash text;
  v_event_hash text;
  v_location jsonb := coalesce(p_location, '{}'::jsonb);
  v_location_basis text := case
    when p_location_basis in ('explicit_user_permission', 'contract_performance', 'legal_obligation', 'legitimate_interest', 'public_authority_request')
      then p_location_basis
    else 'none'
  end;
  v_source text := case
    when p_source in ('backend', 'client', 'auto_defense', 'payment_provider', 'admin', 'system', 'edge_function')
      then p_source
    else 'backend'
  end;
  v_payload jsonb;
begin
  if p_action is null or length(trim(p_action)) < 2 then
    raise exception 'Invalid security action';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.security_audit_events.hash_chain'));

  select event_hash
    into v_previous_hash
  from public.security_audit_events
  where event_hash is not null
  order by created_at desc, id desc
  limit 1;

  v_payload := jsonb_build_object(
    'actor_id', p_actor_id,
    'actor_role', nullif(left(coalesce(p_actor_role, ''), 80), ''),
    'action', left(trim(p_action), 140),
    'resource_type', nullif(left(coalesce(p_resource_type, ''), 120), ''),
    'resource_id', nullif(left(coalesce(p_resource_id, ''), 180), ''),
    'severity', case when p_severity in ('debug', 'info', 'warning', 'critical') then p_severity else 'info' end,
    'ip_address', nullif(left(coalesce(p_ip_address, ''), 80), ''),
    'user_agent', nullif(left(coalesce(p_user_agent, ''), 500), ''),
    'request_id', nullif(left(coalesce(p_request_id, ''), 120), ''),
    'metadata', coalesce(p_metadata, '{}'::jsonb),
    'source', v_source,
    'purpose', left(trim(coalesce(p_purpose, 'security_audit')), 120),
    'location_basis', v_location_basis,
    'location', case when v_location_basis = 'none' then '{}'::jsonb else v_location end,
    'evidence_tags', coalesce(p_evidence_tags, '{}'::text[]),
    'created_at', v_created_at
  );

  v_event_hash := encode(digest(coalesce(v_previous_hash, '') || v_payload::text, 'sha256'), 'hex');

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
    metadata,
    source,
    purpose,
    location_basis,
    geo_country,
    geo_region,
    geo_city,
    geo_latitude,
    geo_longitude,
    geo_accuracy_m,
    previous_hash,
    event_hash,
    retention_until,
    evidence_tags,
    created_at
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
    coalesce(p_metadata, '{}'::jsonb),
    v_source,
    left(trim(coalesce(p_purpose, 'security_audit')), 120),
    v_location_basis,
    case when v_location_basis = 'none' then null else nullif(left(coalesce(v_location ->> 'country', ''), 80), '') end,
    case when v_location_basis = 'none' then null else nullif(left(coalesce(v_location ->> 'region', ''), 80), '') end,
    case when v_location_basis = 'none' then null else nullif(left(coalesce(v_location ->> 'city', ''), 120), '') end,
    case when v_location_basis = 'none' or coalesce(v_location ->> 'latitude', '') = '' then null else (v_location ->> 'latitude')::numeric end,
    case when v_location_basis = 'none' or coalesce(v_location ->> 'longitude', '') = '' then null else (v_location ->> 'longitude')::numeric end,
    case when v_location_basis = 'none' or coalesce(v_location ->> 'accuracy_m', '') = '' then null else (v_location ->> 'accuracy_m')::numeric end,
    v_previous_hash,
    v_event_hash,
    v_created_at + make_interval(days => greatest(30, least(coalesce(p_retention_days, 365), 3650))),
    coalesce(p_evidence_tags, '{}'::text[]),
    v_created_at
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.append_security_audit_event(
  uuid, text, text, text, text, text, text, text, text, jsonb, text, text, text, jsonb, text[], integer
) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.append_security_audit_event(
      uuid, text, text, text, text, text, text, text, text, jsonb, text, text, text, jsonb, text[], integer
    ) to service_role;
  end if;
end $$;

create or replace function public.block_security_audit_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'security_audit_events is append-only';
end;
$$;

drop trigger if exists security_audit_events_append_only on public.security_audit_events;
create trigger security_audit_events_append_only
  before update or delete on public.security_audit_events
  for each row execute function public.block_security_audit_event_mutation();

create table if not exists public.authority_disclosure_requests (
  id uuid primary key default gen_random_uuid(),
  authority_type text not null
    check (authority_type in ('police', 'prosecutor', 'court', 'regulator', 'other_public_authority')),
  reference_no text not null,
  requester_name text,
  requester_title text,
  contact_channel text,
  legal_basis text not null,
  scope_summary text not null,
  status text not null default 'received'
    check (status in ('received', 'validated', 'approved', 'fulfilled', 'rejected', 'closed')),
  due_at timestamptz,
  opened_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.authority_disclosure_exports (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.authority_disclosure_requests(id) on delete restrict,
  case_reference text not null,
  legal_basis text not null,
  purpose text not null,
  filters jsonb not null default '{}'::jsonb,
  event_count integer not null default 0 check (event_count >= 0),
  first_event_at timestamptz,
  last_event_at timestamptz,
  first_event_hash text,
  last_event_hash text,
  export_hash text not null,
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  disclosure_status text not null default 'generated'
    check (disclosure_status in ('generated', 'reviewed', 'delivered', 'withheld', 'voided')),
  metadata jsonb not null default '{}'::jsonb
);

drop trigger if exists authority_disclosure_requests_set_updated_at on public.authority_disclosure_requests;
create trigger authority_disclosure_requests_set_updated_at
  before update on public.authority_disclosure_requests
  for each row execute function public.set_updated_at();

create index if not exists authority_disclosure_requests_reference_idx
  on public.authority_disclosure_requests(reference_no, created_at desc);

create index if not exists authority_disclosure_requests_status_idx
  on public.authority_disclosure_requests(status, created_at desc);

create index if not exists authority_disclosure_exports_request_idx
  on public.authority_disclosure_exports(request_id, generated_at desc);

create index if not exists authority_disclosure_exports_hash_idx
  on public.authority_disclosure_exports(export_hash);

alter table public.authority_disclosure_requests enable row level security;
alter table public.authority_disclosure_exports enable row level security;

drop policy if exists "authority_requests_select_admin" on public.authority_disclosure_requests;
create policy "authority_requests_select_admin"
  on public.authority_disclosure_requests for select
  to authenticated
  using (public.is_admin());

drop policy if exists "authority_exports_select_admin" on public.authority_disclosure_exports;
create policy "authority_exports_select_admin"
  on public.authority_disclosure_exports for select
  to authenticated
  using (public.is_admin());

drop policy if exists "authority_requests_no_client_insert" on public.authority_disclosure_requests;
create policy "authority_requests_no_client_insert"
  on public.authority_disclosure_requests for insert
  to authenticated
  with check (false);

drop policy if exists "authority_exports_no_client_insert" on public.authority_disclosure_exports;
create policy "authority_exports_no_client_insert"
  on public.authority_disclosure_exports for insert
  to authenticated
  with check (false);

drop policy if exists "authority_requests_no_client_update" on public.authority_disclosure_requests;
create policy "authority_requests_no_client_update"
  on public.authority_disclosure_requests for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists "authority_exports_no_client_update" on public.authority_disclosure_exports;
create policy "authority_exports_no_client_update"
  on public.authority_disclosure_exports for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists "authority_requests_no_client_delete" on public.authority_disclosure_requests;
create policy "authority_requests_no_client_delete"
  on public.authority_disclosure_requests for delete
  to authenticated
  using (false);

drop policy if exists "authority_exports_no_client_delete" on public.authority_disclosure_exports;
create policy "authority_exports_no_client_delete"
  on public.authority_disclosure_exports for delete
  to authenticated
  using (false);

revoke all on public.authority_disclosure_requests from anon;
revoke all on public.authority_disclosure_exports from anon;
grant select on public.authority_disclosure_requests to authenticated;
grant select on public.authority_disclosure_exports to authenticated;

comment on table public.security_audit_events is
  'Append-only, hash-chained security and legal evidence stream for account, order, payment, partner, admin and incident events.';

comment on table public.authority_disclosure_requests is
  'Official police, prosecutor, court, regulator or public authority request register. Data is not disclosed without legal basis and admin review.';

comment on table public.authority_disclosure_exports is
  'Evidence report export register with filters, event counts and export hash for chain-of-custody verification.';
