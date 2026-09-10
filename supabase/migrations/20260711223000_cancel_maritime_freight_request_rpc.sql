create or replace function public.cancel_maritime_freight_request(
  p_request_id uuid,
  p_user_id uuid
)
returns table (
  id uuid,
  reference_no text,
  module_key text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  previous_status text,
  request_cancelled boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_row public.maritime_freight_requests%rowtype;
  prior_status text := null;
  cancelled_value boolean := false;
begin
  if p_request_id is null or p_user_id is null then
    raise exception using errcode = 'P0002', message = 'MARITIME_REQUEST_IDENTITY_REQUIRED';
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

  if request_row.status = 'cancelled' then
    insert into public.maritime_freight_request_events (
      freight_request_id,
      actor_user_id,
      event_type,
      event_payload
    ) values (
      request_row.id,
      p_user_id,
      'cancelled',
      '{}'::jsonb
    )
    on conflict (freight_request_id) where event_type = 'cancelled' do nothing;
  else
    if request_row.status not in ('submitted', 'in_review') then
      raise exception using errcode = 'P0001', message = 'MARITIME_REQUEST_NOT_CANCELLABLE';
    end if;

    prior_status := request_row.status;

    update public.maritime_freight_requests request
    set status = 'cancelled'
    where request.id = request_row.id
    returning request.* into request_row;

    insert into public.maritime_freight_request_events (
      freight_request_id,
      actor_user_id,
      event_type,
      event_payload
    ) values (
      request_row.id,
      p_user_id,
      'cancelled',
      jsonb_build_object('previous_status', prior_status)
    )
    on conflict (freight_request_id) where event_type = 'cancelled' do nothing;

    cancelled_value := true;
  end if;

  return query select
    request_row.id,
    request_row.reference_no,
    request_row.module_key,
    request_row.status,
    request_row.created_at,
    request_row.updated_at,
    prior_status,
    cancelled_value;
end;
$$;

revoke all on function public.cancel_maritime_freight_request(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cancel_maritime_freight_request(uuid, uuid)
  to service_role;

comment on function public.cancel_maritime_freight_request(uuid, uuid) is
  'Atomically owner-validates and cancels an eligible maritime freight request while appending one idempotent cancelled event. Execution is restricted to the backend service role.';
