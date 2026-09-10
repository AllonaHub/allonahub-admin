alter table public.maritime_freight_request_events
  drop constraint if exists maritime_freight_request_events_event_type_check;
alter table public.maritime_freight_request_events
  add constraint maritime_freight_request_events_event_type_check
    check (event_type in (
      'submitted',
      'review_started',
      'matching_started',
      'match_declined',
      'match_expired',
      'quote_added',
      'offer_withdrawn',
      'offer_expired',
      'accepted',
      'cancelled',
      'closed'
    ));

create unique index if not exists maritime_freight_request_events_match_expired_unique
  on public.maritime_freight_request_events(
    freight_request_id,
    (event_payload ->> 'match_id'),
    (event_payload ->> 'match_expires_at')
  )
  where event_type = 'match_expired';

create unique index if not exists maritime_freight_request_events_offer_expired_unique
  on public.maritime_freight_request_events(
    freight_request_id,
    (event_payload ->> 'offer_id')
  )
  where event_type = 'offer_expired';

create or replace function public.reconcile_maritime_freight_expirations(
  p_limit integer default 100
)
returns table (
  expired_offer_count integer,
  expired_match_count integer,
  reconciled_request_count integer,
  reconciled_terminal_match_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  candidate record;
  match_row public.maritime_freight_matches%rowtype;
  request_row public.maritime_freight_requests%rowtype;
  offer_row public.maritime_freight_offers%rowtype;
  offer_found boolean;
  state_changed boolean;
  next_request_status text;
  reconcile_time timestamptz := now();
begin
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception using errcode = 'P0001', message = 'MARITIME_RECONCILE_LIMIT_INVALID';
  end if;

  expired_offer_count := 0;
  expired_match_count := 0;
  reconciled_request_count := 0;
  reconciled_terminal_match_count := 0;

  for candidate in
    select freight_match.id
    from public.maritime_freight_matches freight_match
    join public.maritime_freight_requests candidate_request
      on candidate_request.id = freight_match.freight_request_id
      and candidate_request.module_key = 'maritime'
    left join public.maritime_freight_offers freight_offer
      on freight_offer.match_id = freight_match.id
      and freight_offer.module_key = 'maritime'
    where freight_match.module_key = 'maritime'
      and (
        (
          candidate_request.status in ('matching', 'quoted')
          and (
            (
              freight_offer.status = 'submitted'
              and freight_offer.valid_until <= reconcile_time
            )
            or (
              freight_match.status in ('invited', 'accepted')
              and freight_match.expires_at <= reconcile_time
            )
          )
        )
        or (
          candidate_request.status = 'accepted'
          and (
            (
              freight_offer.status = 'accepted'
              and freight_match.status <> 'accepted'
            )
            or (
              coalesce(freight_offer.status, '') <> 'accepted'
              and freight_match.status <> 'closed'
            )
          )
        )
        or (
          candidate_request.status in ('cancelled', 'closed')
          and freight_match.status <> 'closed'
        )
      )
    order by case when candidate_request.status in ('accepted', 'cancelled', 'closed') then 0 else 1 end,
    least(
      freight_match.expires_at,
      coalesce(freight_offer.valid_until, freight_match.expires_at)
    ), freight_match.id
    limit p_limit
  loop
    select freight_match.*
    into match_row
    from public.maritime_freight_matches freight_match
    where freight_match.id = candidate.id
      and freight_match.module_key = 'maritime'
    for update skip locked;

    if not found then
      continue;
    end if;

    select request.*
    into request_row
    from public.maritime_freight_requests request
    where request.id = match_row.freight_request_id
      and request.module_key = 'maritime'
    for update;

    if not found then
      continue;
    end if;

    select freight_offer.*
    into offer_row
    from public.maritime_freight_offers freight_offer
    where freight_offer.match_id = match_row.id
      and freight_offer.module_key = 'maritime'
    for update;
    offer_found := found;
    state_changed := false;

    if request_row.status = 'accepted'
      and offer_found
      and offer_row.status = 'accepted' then
      if match_row.status <> 'accepted' then
        update public.maritime_freight_matches freight_match
        set status = 'accepted'
        where freight_match.id = match_row.id
          and freight_match.status <> 'accepted'
        returning freight_match.* into match_row;

        if found then
          reconciled_terminal_match_count := reconciled_terminal_match_count + 1;
        end if;
      end if;
      continue;
    elsif request_row.status in ('accepted', 'cancelled', 'closed') then
      if match_row.status <> 'closed' then
        update public.maritime_freight_matches freight_match
        set status = 'closed'
        where freight_match.id = match_row.id
          and freight_match.status <> 'closed'
        returning freight_match.* into match_row;

        if found then
          reconciled_terminal_match_count := reconciled_terminal_match_count + 1;
        end if;
      end if;
      continue;
    end if;

    if offer_found
      and offer_row.status = 'submitted'
      and offer_row.valid_until <= reconcile_time then
      update public.maritime_freight_offers freight_offer
      set status = 'expired'
      where freight_offer.id = offer_row.id
        and freight_offer.status = 'submitted'
      returning freight_offer.* into offer_row;

      if not found then
        continue;
      end if;

      if match_row.status <> 'closed' then
        update public.maritime_freight_matches freight_match
        set status = 'closed'
        where freight_match.id = match_row.id
        returning freight_match.* into match_row;
      end if;

      expired_offer_count := expired_offer_count + 1;
      state_changed := true;

      if request_row.status in ('matching', 'quoted') then
        insert into public.maritime_freight_request_events (
          freight_request_id,
          actor_user_id,
          event_type,
          event_payload
        ) values (
          request_row.id,
          null,
          'offer_expired',
          jsonb_build_object(
            'match_id', match_row.id,
            'offer_id', offer_row.id,
            'expired_at', reconcile_time
          )
        )
        on conflict do nothing;
      end if;
    elsif match_row.status in ('invited', 'accepted')
      and match_row.expires_at <= reconcile_time then
      update public.maritime_freight_matches freight_match
      set status = 'closed'
      where freight_match.id = match_row.id
        and freight_match.status in ('invited', 'accepted')
      returning freight_match.* into match_row;

      if not found then
        continue;
      end if;

      expired_match_count := expired_match_count + 1;
      state_changed := true;

      if request_row.status in ('matching', 'quoted') then
        insert into public.maritime_freight_request_events (
          freight_request_id,
          actor_user_id,
          event_type,
          event_payload
        ) values (
          request_row.id,
          null,
          'match_expired',
          jsonb_build_object(
            'match_id', match_row.id,
            'match_expires_at', match_row.expires_at,
            'expired_at', reconcile_time
          )
        )
        on conflict do nothing;
      end if;
    end if;

    if not state_changed or request_row.status not in ('matching', 'quoted') then
      continue;
    end if;

    if exists (
      select 1
      from public.maritime_freight_offers active_offer
      where active_offer.freight_request_id = request_row.id
        and active_offer.module_key = 'maritime'
        and active_offer.status = 'submitted'
        and active_offer.valid_until > reconcile_time
    ) then
      next_request_status := 'quoted';
    elsif exists (
      select 1
      from public.maritime_freight_matches active_match
      where active_match.freight_request_id = request_row.id
        and active_match.module_key = 'maritime'
        and active_match.status = 'invited'
        and active_match.expires_at > reconcile_time
        and not exists (
          select 1
          from public.maritime_freight_offers used_offer
          where used_offer.match_id = active_match.id
        )
    ) then
      next_request_status := 'matching';
    else
      next_request_status := 'in_review';
    end if;

    if request_row.status <> next_request_status then
      update public.maritime_freight_requests request
      set status = next_request_status
      where request.id = request_row.id
        and request.status = request_row.status
      returning request.* into request_row;

      if found then
        reconciled_request_count := reconciled_request_count + 1;
      end if;
    end if;
  end loop;

  return next;
end;
$$;

revoke all on function public.reconcile_maritime_freight_expirations(integer) from public, anon, authenticated;
grant execute on function public.reconcile_maritime_freight_expirations(integer) to service_role;

comment on function public.reconcile_maritime_freight_expirations(integer) is
  'Atomically expires stale maritime work and reconciles terminal-request matches in bounded match-first batches. Service role only.';
