create extension if not exists pgcrypto;

create table if not exists public.maritime_freight_matches (
  id uuid primary key default gen_random_uuid(),
  freight_request_id uuid not null references public.maritime_freight_requests(id) on delete cascade,
  partner_user_id uuid not null references auth.users(id) on delete restrict,
  assigned_by uuid references auth.users(id) on delete set null,
  module_key text not null default 'maritime'
    check (module_key = 'maritime'),
  status text not null default 'invited'
    check (status in ('invited', 'accepted', 'declined', 'closed')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maritime_freight_matches_request_partner_unique
    unique (freight_request_id, partner_user_id),
  constraint maritime_freight_matches_valid_window
    check (expires_at > created_at)
);

create index if not exists maritime_freight_matches_partner_status_idx
  on public.maritime_freight_matches(partner_user_id, status, created_at desc);
create index if not exists maritime_freight_matches_request_status_idx
  on public.maritime_freight_matches(freight_request_id, status, created_at desc);

drop trigger if exists maritime_freight_matches_set_updated_at on public.maritime_freight_matches;
create trigger maritime_freight_matches_set_updated_at
  before update on public.maritime_freight_matches
  for each row execute function public.set_updated_at();

alter table public.maritime_freight_matches enable row level security;

drop policy if exists "maritime_freight_matches_partner_select_own" on public.maritime_freight_matches;
create policy "maritime_freight_matches_partner_select_own"
  on public.maritime_freight_matches for select to authenticated
  using (
    partner_user_id = auth.uid()
    and public.is_partner_or_admin()
  );

drop policy if exists "maritime_freight_matches_admin_select" on public.maritime_freight_matches;
create policy "maritime_freight_matches_admin_select"
  on public.maritime_freight_matches for select to authenticated
  using (public.is_admin());

revoke all on public.maritime_freight_matches from anon, authenticated;
grant select on public.maritime_freight_matches to authenticated;
grant all on public.maritime_freight_matches to service_role;

alter table public.maritime_freight_offers
  add column if not exists match_id uuid references public.maritime_freight_matches(id) on delete restrict;

create unique index if not exists maritime_freight_offers_match_unique
  on public.maritime_freight_offers(match_id)
  where match_id is not null;

create unique index if not exists maritime_freight_request_events_matching_unique
  on public.maritime_freight_request_events(freight_request_id)
  where event_type = 'matching_started';

create or replace function public.assign_maritime_freight_partner(
  p_request_id uuid,
  p_partner_user_id uuid,
  p_assigned_by uuid,
  p_expires_at timestamptz
)
returns table (
  freight_match_id uuid,
  freight_request_id uuid,
  assigned_partner_user_id uuid,
  match_status text,
  request_status text,
  match_expires_at timestamptz,
  match_created_at timestamptz,
  assignment_changed boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_row public.maritime_freight_requests%rowtype;
  match_row public.maritime_freight_matches%rowtype;
  assignment_changed_value boolean := false;
  match_found boolean := false;
begin
  if p_partner_user_id is null or p_assigned_by is null then
    raise exception using errcode = 'P0002', message = 'MARITIME_ASSIGNMENT_TARGET_NOT_FOUND';
  end if;

  if p_expires_at <= now() or p_expires_at > now() + interval '30 days' then
    raise exception using errcode = 'P0001', message = 'MARITIME_ASSIGNMENT_WINDOW_INVALID';
  end if;

  select freight_match.*
  into match_row
  from public.maritime_freight_matches freight_match
  where freight_match.freight_request_id = p_request_id
    and freight_match.partner_user_id = p_partner_user_id
  for update;
  match_found := found;

  select request.*
  into request_row
  from public.maritime_freight_requests request
  where request.id = p_request_id
    and request.module_key = 'maritime'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'MARITIME_REQUEST_NOT_FOUND';
  end if;

  if request_row.status not in ('submitted', 'in_review', 'matching', 'quoted') then
    raise exception using errcode = 'P0001', message = 'MARITIME_REQUEST_NOT_MATCHABLE';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_partner_user_id
      and profile.role = 'partner'
  ) or not exists (
    select 1
    from public.maritime_partner_applications application
    where application.user_id = p_partner_user_id
      and application.module_key = 'maritime'
      and application.status = 'approved'
      and application.partner_role in ('broker', 'shipowner', 'agency')
  ) then
    raise exception using errcode = 'P0001', message = 'MARITIME_PARTNER_NOT_ELIGIBLE';
  end if;

  if match_found then
    if match_row.status in ('declined', 'closed') or match_row.expires_at <= now() then
      if exists (
        select 1
        from public.maritime_freight_offers offer
        where offer.match_id = match_row.id
      ) then
        raise exception using errcode = 'P0001', message = 'MARITIME_MATCH_ALREADY_USED';
      end if;

      update public.maritime_freight_matches freight_match
      set status = 'invited',
          assigned_by = p_assigned_by,
          expires_at = p_expires_at
      where freight_match.id = match_row.id
      returning freight_match.* into match_row;
      assignment_changed_value := true;
    end if;

    if request_row.status in ('submitted', 'in_review') then
      update public.maritime_freight_requests request
      set status = 'matching'
      where request.id = p_request_id
      returning request.* into request_row;
      assignment_changed_value := true;
    end if;

    if assignment_changed_value then
      insert into public.maritime_freight_request_events (
        freight_request_id,
        actor_user_id,
        event_type,
        event_payload
      ) values (
        p_request_id,
        p_assigned_by,
        'matching_started',
        '{}'::jsonb
      )
      on conflict do nothing;
    end if;

    return query select
      match_row.id,
      match_row.freight_request_id,
      match_row.partner_user_id,
      match_row.status,
      request_row.status,
      match_row.expires_at,
      match_row.created_at,
      assignment_changed_value;
    return;
  end if;

  insert into public.maritime_freight_matches (
    freight_request_id,
    partner_user_id,
    assigned_by,
    module_key,
    status,
    expires_at
  ) values (
    p_request_id,
    p_partner_user_id,
    p_assigned_by,
    'maritime',
    'invited',
    p_expires_at
  )
  returning * into match_row;

  if request_row.status in ('submitted', 'in_review') then
    update public.maritime_freight_requests request
    set status = 'matching'
    where request.id = p_request_id
    returning request.* into request_row;
  end if;

  insert into public.maritime_freight_request_events (
    freight_request_id,
    actor_user_id,
    event_type,
    event_payload
  ) values (
    p_request_id,
    p_assigned_by,
    'matching_started',
    '{}'::jsonb
  )
  on conflict do nothing;

  return query select
    match_row.id,
    match_row.freight_request_id,
    match_row.partner_user_id,
    match_row.status,
    request_row.status,
    match_row.expires_at,
    match_row.created_at,
    true;
end;
$$;

create or replace function public.submit_maritime_freight_offer(
  p_match_id uuid,
  p_partner_user_id uuid,
  p_client_offer_id uuid,
  p_broker_display_name text,
  p_company_display_name text,
  p_amount numeric,
  p_currency text,
  p_pricing_basis text,
  p_transit_days integer,
  p_terms_summary text,
  p_valid_until timestamptz
)
returns table (
  freight_offer_id uuid,
  offer_reference_no text,
  freight_request_id uuid,
  request_status text,
  match_status text,
  offer_status text,
  offer_submitted_at timestamptz,
  offer_created boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  match_row public.maritime_freight_matches%rowtype;
  request_row public.maritime_freight_requests%rowtype;
  offer_row public.maritime_freight_offers%rowtype;
  submitted_time timestamptz := now();
begin
  select freight_match.*
  into match_row
  from public.maritime_freight_matches freight_match
  where freight_match.id = p_match_id
    and freight_match.partner_user_id = p_partner_user_id
    and freight_match.module_key = 'maritime'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'MARITIME_MATCH_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_partner_user_id
      and profile.role = 'partner'
  ) or not exists (
    select 1
    from public.maritime_partner_applications application
    where application.user_id = p_partner_user_id
      and application.module_key = 'maritime'
      and application.status = 'approved'
      and application.partner_role in ('broker', 'shipowner', 'agency')
  ) then
    raise exception using errcode = 'P0001', message = 'MARITIME_PARTNER_NOT_ELIGIBLE';
  end if;

  select request.*
  into request_row
  from public.maritime_freight_requests request
  where request.id = match_row.freight_request_id
    and request.module_key = 'maritime'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'MARITIME_REQUEST_NOT_FOUND';
  end if;

  select offer.*
  into offer_row
  from public.maritime_freight_offers offer
  where offer.freight_request_id = request_row.id
    and offer.broker_user_id = p_partner_user_id
  for update;

  if found then
    if offer_row.client_offer_id <> p_client_offer_id then
      raise exception using errcode = 'P0001', message = 'MARITIME_OFFER_ALREADY_SUBMITTED';
    end if;

    return query select
      offer_row.id,
      offer_row.offer_reference,
      offer_row.freight_request_id,
      request_row.status,
      match_row.status,
      offer_row.status,
      offer_row.submitted_at,
      false;
    return;
  end if;

  if match_row.status not in ('invited', 'accepted') or match_row.expires_at <= submitted_time then
    raise exception using errcode = 'P0001', message = 'MARITIME_MATCH_NOT_ACTIVE';
  end if;

  if p_valid_until <= submitted_time or p_valid_until > match_row.expires_at then
    raise exception using errcode = 'P0001', message = 'MARITIME_OFFER_WINDOW_INVALID';
  end if;

  if request_row.status not in ('matching', 'quoted') then
    raise exception using errcode = 'P0001', message = 'MARITIME_REQUEST_NOT_QUOTABLE';
  end if;

  insert into public.maritime_freight_offers (
    client_offer_id,
    freight_request_id,
    broker_user_id,
    match_id,
    module_key,
    status,
    broker_display_name,
    company_display_name,
    amount,
    currency,
    pricing_basis,
    transit_days,
    terms_summary,
    valid_until,
    submitted_at
  ) values (
    p_client_offer_id,
    request_row.id,
    p_partner_user_id,
    match_row.id,
    'maritime',
    'submitted',
    p_broker_display_name,
    p_company_display_name,
    p_amount,
    p_currency,
    p_pricing_basis,
    p_transit_days,
    p_terms_summary,
    p_valid_until,
    submitted_time
  )
  returning * into offer_row;

  update public.maritime_freight_matches freight_match
  set status = 'accepted'
  where freight_match.id = match_row.id
  returning freight_match.* into match_row;

  if request_row.status = 'matching' then
    update public.maritime_freight_requests request
    set status = 'quoted'
    where request.id = request_row.id
    returning request.* into request_row;
  end if;

  insert into public.maritime_freight_request_events (
    freight_request_id,
    actor_user_id,
    event_type,
    event_payload
  ) values (
    request_row.id,
    p_partner_user_id,
    'quote_added',
    jsonb_build_object('offer_id', offer_row.id)
  );

  return query select
    offer_row.id,
    offer_row.offer_reference,
    offer_row.freight_request_id,
    request_row.status,
    match_row.status,
    offer_row.status,
    offer_row.submitted_at,
    true;
end;
$$;

revoke all on function public.assign_maritime_freight_partner(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.assign_maritime_freight_partner(uuid, uuid, uuid, timestamptz) to service_role;
revoke all on function public.submit_maritime_freight_offer(uuid, uuid, uuid, text, text, numeric, text, text, integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.submit_maritime_freight_offer(uuid, uuid, uuid, text, text, numeric, text, text, integer, text, timestamptz) to service_role;

comment on table public.maritime_freight_matches is
  'Admin-created request-to-partner assignments. MFA partners can read only their own matches; all writes use service-role-only RPCs.';
comment on function public.assign_maritime_freight_partner(uuid, uuid, uuid, timestamptz) is
  'Atomically validates and assigns an approved maritime freight partner, advances the request to matching and appends the matching event.';
comment on function public.submit_maritime_freight_offer(uuid, uuid, uuid, text, text, numeric, text, text, integer, text, timestamptz) is
  'Atomically validates a partner match, creates one idempotent submitted offer, advances the request to quoted and appends a quote event.';
