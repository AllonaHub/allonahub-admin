alter table public.maritime_freight_offers
  add column if not exists accepted_at timestamptz;

update public.maritime_freight_offers
set accepted_at = coalesce(updated_at, now())
where status = 'accepted' and accepted_at is null;

alter table public.maritime_freight_offers
  drop constraint if exists maritime_freight_offers_accepted_timestamp;
alter table public.maritime_freight_offers
  add constraint maritime_freight_offers_accepted_timestamp
    check (status <> 'accepted' or accepted_at is not null);

create unique index if not exists maritime_freight_request_events_accepted_unique
  on public.maritime_freight_request_events(freight_request_id)
  where event_type = 'accepted';

create or replace function public.accept_maritime_freight_offer(
  p_request_id uuid,
  p_offer_id uuid,
  p_user_id uuid
)
returns table (
  freight_request_id uuid,
  request_reference_no text,
  request_status text,
  freight_offer_id uuid,
  offer_reference_no text,
  offer_status text,
  accepted_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_row public.maritime_freight_requests%rowtype;
  offer_row public.maritime_freight_offers%rowtype;
  accepted_time timestamptz := now();
begin
  if p_user_id is null then
    raise exception using errcode = 'P0002', message = 'MARITIME_REQUEST_NOT_FOUND';
  end if;

  select request.*
  into request_row
  from public.maritime_freight_requests request
  where request.id = p_request_id
    and request.user_id = p_user_id
    and request.module_key = 'maritime'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'MARITIME_REQUEST_NOT_FOUND';
  end if;

  select offer.*
  into offer_row
  from public.maritime_freight_offers offer
  where offer.id = p_offer_id
    and offer.freight_request_id = p_request_id
    and offer.module_key = 'maritime'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'MARITIME_OFFER_NOT_FOUND';
  end if;

  if request_row.status = 'accepted' then
    if offer_row.status <> 'accepted' then
      raise exception using errcode = 'P0001', message = 'MARITIME_OTHER_OFFER_ACCEPTED';
    end if;

    return query select
      request_row.id,
      request_row.reference_no,
      request_row.status,
      offer_row.id,
      offer_row.offer_reference,
      offer_row.status,
      offer_row.accepted_at;
    return;
  end if;

  if request_row.status not in ('matching', 'quoted') then
    raise exception using errcode = 'P0001', message = 'MARITIME_REQUEST_NOT_ACCEPTABLE';
  end if;

  if offer_row.status <> 'submitted' then
    raise exception using errcode = 'P0001', message = 'MARITIME_OFFER_NOT_ACCEPTABLE';
  end if;

  if offer_row.valid_until <= accepted_time then
    raise exception using errcode = 'P0001', message = 'MARITIME_OFFER_EXPIRED';
  end if;

  if exists (
    select 1
    from public.maritime_freight_offers accepted_offer
    where accepted_offer.freight_request_id = p_request_id
      and accepted_offer.status = 'accepted'
      and accepted_offer.id <> p_offer_id
  ) then
    raise exception using errcode = 'P0001', message = 'MARITIME_OTHER_OFFER_ACCEPTED';
  end if;

  update public.maritime_freight_offers offer
  set status = 'rejected'
  where offer.freight_request_id = p_request_id
    and offer.id <> p_offer_id
    and offer.status = 'submitted';

  update public.maritime_freight_offers offer
  set status = 'accepted',
      accepted_at = accepted_time
  where offer.id = p_offer_id
    and offer.status = 'submitted'
  returning offer.* into offer_row;

  if not found then
    raise exception using errcode = 'P0001', message = 'MARITIME_OFFER_STATE_CHANGED';
  end if;

  update public.maritime_freight_requests request
  set status = 'accepted'
  where request.id = p_request_id
    and request.status in ('matching', 'quoted')
  returning request.* into request_row;

  if not found then
    raise exception using errcode = 'P0001', message = 'MARITIME_REQUEST_STATE_CHANGED';
  end if;

  insert into public.maritime_freight_request_events (
    freight_request_id,
    actor_user_id,
    event_type,
    event_payload
  ) values (
    p_request_id,
    p_user_id,
    'accepted',
    jsonb_build_object('offer_id', p_offer_id)
  )
  on conflict do nothing;

  return query select
    request_row.id,
    request_row.reference_no,
    request_row.status,
    offer_row.id,
    offer_row.offer_reference,
    offer_row.status,
    offer_row.accepted_at;
end;
$$;

revoke all on function public.accept_maritime_freight_offer(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_maritime_freight_offer(uuid, uuid, uuid) to service_role;

comment on function public.accept_maritime_freight_offer(uuid, uuid, uuid) is
  'Atomically accepts one unexpired published maritime freight offer for its request owner, rejects competing submitted offers, updates the request and appends an event. Service role only.';
comment on column public.maritime_freight_offers.accepted_at is
  'Server-controlled timestamp set only when the offer is atomically accepted.';
