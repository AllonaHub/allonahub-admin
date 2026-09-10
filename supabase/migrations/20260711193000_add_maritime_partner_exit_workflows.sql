alter table public.maritime_freight_request_events
  drop constraint if exists maritime_freight_request_events_event_type_check;
alter table public.maritime_freight_request_events
  add constraint maritime_freight_request_events_event_type_check
    check (event_type in (
      'submitted',
      'review_started',
      'matching_started',
      'match_declined',
      'quote_added',
      'offer_withdrawn',
      'accepted',
      'cancelled',
      'closed'
    ));

create unique index if not exists maritime_freight_request_events_match_declined_unique
  on public.maritime_freight_request_events(
    freight_request_id,
    (event_payload ->> 'match_id')
  )
  where event_type = 'match_declined';

create unique index if not exists maritime_freight_request_events_offer_withdrawn_unique
  on public.maritime_freight_request_events(
    freight_request_id,
    (event_payload ->> 'match_id')
  )
  where event_type = 'offer_withdrawn';

create or replace function public.decline_maritime_freight_match(
  p_match_id uuid,
  p_partner_user_id uuid
)
returns table (
  freight_match_id uuid,
  match_status text,
  freight_request_id uuid,
  request_status text,
  state_changed boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  match_row public.maritime_freight_matches%rowtype;
  request_row public.maritime_freight_requests%rowtype;
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

  select request.*
  into request_row
  from public.maritime_freight_requests request
  where request.id = match_row.freight_request_id
    and request.module_key = 'maritime'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'MARITIME_REQUEST_NOT_FOUND';
  end if;

  if match_row.status = 'declined' then
    return query select match_row.id, match_row.status, request_row.id, request_row.status, false;
    return;
  end if;

  if match_row.status <> 'invited' or match_row.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'MARITIME_MATCH_NOT_DECLINABLE';
  end if;

  if exists (
    select 1
    from public.maritime_freight_offers offer
    where offer.match_id = match_row.id
  ) then
    raise exception using errcode = 'P0001', message = 'MARITIME_MATCH_HAS_OFFER';
  end if;

  update public.maritime_freight_matches freight_match
  set status = 'declined'
  where freight_match.id = match_row.id
    and freight_match.status = 'invited'
  returning freight_match.* into match_row;

  if not found then
    raise exception using errcode = 'P0001', message = 'MARITIME_MATCH_STATE_CHANGED';
  end if;

  if request_row.status = 'matching'
    and not exists (
      select 1
      from public.maritime_freight_matches other_match
      where other_match.freight_request_id = request_row.id
        and other_match.id <> match_row.id
        and other_match.status in ('invited', 'accepted')
        and other_match.expires_at > now()
    )
    and not exists (
      select 1
      from public.maritime_freight_offers active_offer
      where active_offer.freight_request_id = request_row.id
        and active_offer.status = 'submitted'
    ) then
    update public.maritime_freight_requests request
    set status = 'in_review'
    where request.id = request_row.id
      and request.status = 'matching'
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
    'match_declined',
    jsonb_build_object('match_id', match_row.id)
  )
  on conflict do nothing;

  return query select match_row.id, match_row.status, request_row.id, request_row.status, true;
end;
$$;

create or replace function public.withdraw_maritime_freight_offer(
  p_match_id uuid,
  p_partner_user_id uuid
)
returns table (
  freight_match_id uuid,
  match_status text,
  freight_offer_id uuid,
  offer_status text,
  freight_request_id uuid,
  request_status text,
  state_changed boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  match_row public.maritime_freight_matches%rowtype;
  request_row public.maritime_freight_requests%rowtype;
  offer_row public.maritime_freight_offers%rowtype;
  changed boolean := false;
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
  where offer.match_id = match_row.id
    and offer.broker_user_id = p_partner_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'MARITIME_OFFER_NOT_FOUND';
  end if;

  if offer_row.status = 'withdrawn' then
    if match_row.status <> 'closed' then
      update public.maritime_freight_matches freight_match
      set status = 'closed'
      where freight_match.id = match_row.id
      returning freight_match.* into match_row;
      changed := true;
    end if;
  else
    if offer_row.status <> 'submitted' or request_row.status = 'accepted' then
      raise exception using errcode = 'P0001', message = 'MARITIME_OFFER_NOT_WITHDRAWABLE';
    end if;

    update public.maritime_freight_offers offer
    set status = 'withdrawn'
    where offer.id = offer_row.id
      and offer.status = 'submitted'
    returning offer.* into offer_row;

    if not found then
      raise exception using errcode = 'P0001', message = 'MARITIME_OFFER_STATE_CHANGED';
    end if;

    update public.maritime_freight_matches freight_match
    set status = 'closed'
    where freight_match.id = match_row.id
    returning freight_match.* into match_row;
    changed := true;
  end if;

  if request_row.status = 'quoted'
    and not exists (
      select 1
      from public.maritime_freight_offers other_offer
      where other_offer.freight_request_id = request_row.id
        and other_offer.id <> offer_row.id
        and other_offer.status = 'submitted'
    ) then
    if exists (
      select 1
      from public.maritime_freight_matches other_match
      where other_match.freight_request_id = request_row.id
        and other_match.id <> match_row.id
        and other_match.status in ('invited', 'accepted')
        and other_match.expires_at > now()
    ) then
      update public.maritime_freight_requests request
      set status = 'matching'
      where request.id = request_row.id
        and request.status = 'quoted'
      returning request.* into request_row;
    else
      update public.maritime_freight_requests request
      set status = 'in_review'
      where request.id = request_row.id
        and request.status = 'quoted'
      returning request.* into request_row;
    end if;
  end if;

  if changed then
    insert into public.maritime_freight_request_events (
      freight_request_id,
      actor_user_id,
      event_type,
      event_payload
    ) values (
      request_row.id,
      p_partner_user_id,
      'offer_withdrawn',
      jsonb_build_object('match_id', match_row.id, 'offer_id', offer_row.id)
    )
    on conflict do nothing;
  end if;

  return query select
    match_row.id,
    match_row.status,
    offer_row.id,
    offer_row.status,
    request_row.id,
    request_row.status,
    changed;
end;
$$;

revoke all on function public.decline_maritime_freight_match(uuid, uuid) from public, anon, authenticated;
grant execute on function public.decline_maritime_freight_match(uuid, uuid) to service_role;
revoke all on function public.withdraw_maritime_freight_offer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.withdraw_maritime_freight_offer(uuid, uuid) to service_role;

comment on function public.decline_maritime_freight_match(uuid, uuid) is
  'Atomically declines an unquoted partner-owned freight match and returns the request to review when no active matching work remains.';
comment on function public.withdraw_maritime_freight_offer(uuid, uuid) is
  'Atomically withdraws a submitted partner-owned offer before acceptance, closes its match and recalculates the request workflow state.';
