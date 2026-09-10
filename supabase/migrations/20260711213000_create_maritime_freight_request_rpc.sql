create or replace function public.create_maritime_freight_request(
  p_client_request_id uuid,
  p_user_id uuid,
  p_cargo_type text,
  p_load_port text,
  p_discharge_port text,
  p_quantity numeric,
  p_quantity_unit text,
  p_laycan_start date
)
returns table (
  id uuid,
  reference_no text,
  module_key text,
  status text,
  created_at timestamptz,
  request_created boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_row public.maritime_freight_requests%rowtype;
  created_value boolean := false;
begin
  if p_client_request_id is null or p_user_id is null then
    raise exception using errcode = 'P0002', message = 'MARITIME_REQUEST_IDENTITY_REQUIRED';
  end if;

  if p_laycan_start is null
    or p_laycan_start < current_date
    or p_laycan_start > current_date + 730 then
    raise exception using errcode = 'P0001', message = 'MARITIME_LAYCAN_WINDOW_INVALID';
  end if;

  insert into public.maritime_freight_requests (
    client_request_id,
    user_id,
    module_key,
    status,
    cargo_type,
    load_port,
    discharge_port,
    quantity,
    quantity_unit,
    laycan_start,
    source
  ) values (
    p_client_request_id,
    p_user_id,
    'maritime',
    'submitted',
    p_cargo_type,
    btrim(p_load_port),
    btrim(p_discharge_port),
    p_quantity,
    p_quantity_unit,
    p_laycan_start,
    'web'
  )
  on conflict (user_id, client_request_id) do nothing
  returning * into request_row;

  created_value := found;

  if not created_value then
    select request.*
    into request_row
    from public.maritime_freight_requests request
    where request.user_id = p_user_id
      and request.client_request_id = p_client_request_id;

    if not found then
      raise exception using errcode = 'P0002', message = 'MARITIME_REQUEST_NOT_FOUND';
    end if;
  end if;

  insert into public.maritime_freight_request_events (
    freight_request_id,
    actor_user_id,
    event_type,
    event_payload
  ) values (
    request_row.id,
    p_user_id,
    'submitted',
    jsonb_build_object('module_key', 'maritime')
  )
  on conflict (freight_request_id) where event_type = 'submitted' do nothing;

  return query select
    request_row.id,
    request_row.reference_no,
    request_row.module_key,
    request_row.status,
    request_row.created_at,
    created_value;
end;
$$;

revoke all on function public.create_maritime_freight_request(uuid, uuid, text, text, text, numeric, text, date)
  from public, anon, authenticated;
grant execute on function public.create_maritime_freight_request(uuid, uuid, text, text, text, numeric, text, date)
  to service_role;

comment on function public.create_maritime_freight_request(uuid, uuid, text, text, text, numeric, text, date) is
  'Atomically creates one idempotent maritime freight request and its submitted event. Execution is restricted to the backend service role.';
