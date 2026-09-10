create or replace function public.accept_maritime_freight_offer_v2(
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
  accepted_at timestamptz,
  previous_status text,
  acceptance_changed boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_row public.maritime_freight_requests%rowtype;
  offer_row public.maritime_freight_offers%rowtype;
  accepted_result record;
  prior_request_status text;
  already_accepted boolean := false;
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

  prior_request_status := request_row.status;
  already_accepted := request_row.status = 'accepted' and offer_row.status = 'accepted';

  select *
  into accepted_result
  from public.accept_maritime_freight_offer(p_request_id, p_offer_id, p_user_id);

  if not found then
    raise exception using errcode = 'P0001', message = 'MARITIME_ACCEPTANCE_RESULT_MISSING';
  end if;

  return query select
    accepted_result.freight_request_id,
    accepted_result.request_reference_no,
    accepted_result.request_status,
    accepted_result.freight_offer_id,
    accepted_result.offer_reference_no,
    accepted_result.offer_status,
    accepted_result.accepted_at,
    prior_request_status,
    not already_accepted;
end;
$$;

revoke all on function public.accept_maritime_freight_offer_v2(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.accept_maritime_freight_offer_v2(uuid, uuid, uuid)
  to service_role;

comment on function public.accept_maritime_freight_offer_v2(uuid, uuid, uuid) is
  'Locks owner request and offer before invoking the atomic acceptance workflow, returning whether this call changed state so concurrent retries cannot duplicate audit effects. Service role only.';
