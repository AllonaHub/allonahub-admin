create index if not exists mall_accessibility_requests_reporting_idx
  on public.mall_accessibility_requests(mall_id, visit_at, status, service_type);

create or replace function public.get_mall_accessibility_request_report(
  report_mall_id uuid,
  report_status text default null,
  report_service_type text default null,
  report_search text default null,
  report_start_date date default null,
  report_end_date date default null,
  report_limit integer default 50,
  report_offset integer default 0
)
returns table (
  request_id uuid,
  visitor_name text,
  service_type text,
  visit_at timestamptz,
  party_size integer,
  contact_phone text,
  contact_email text,
  meeting_point text,
  request_note text,
  status text,
  admin_note text,
  created_at timestamptz,
  total_count bigint,
  new_count bigint,
  confirmed_count bigint,
  completed_count bigint,
  cancelled_count bigint,
  archived_count bigint,
  visitors_sum bigint,
  upcoming_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select
      request.id as request_id,
      request.visitor_name,
      request.service_type,
      request.visit_at,
      request.party_size,
      request.contact_phone,
      request.contact_email,
      request.meeting_point,
      request.request_note,
      request.status,
      request.admin_note,
      request.created_at
    from public.mall_accessibility_requests request
    where (select public.is_admin())
      and request.mall_id = report_mall_id
      and (report_status is null or request.status = report_status)
      and (report_service_type is null or request.service_type = report_service_type)
      and (
        report_start_date is null
        or request.visit_at >= (report_start_date::timestamp at time zone 'Europe/Istanbul')
      )
      and (
        report_end_date is null
        or request.visit_at < ((report_end_date + 1)::timestamp at time zone 'Europe/Istanbul')
      )
      and (
        nullif(trim(report_search), '') is null
        or position(
          lower(trim(report_search)) in lower(concat_ws(
            ' ',
            request.visitor_name,
            request.contact_phone,
            request.contact_email,
            request.meeting_point,
            request.request_note,
            request.admin_note
          ))
        ) > 0
      )
  )
  select
    filtered.request_id,
    filtered.visitor_name,
    filtered.service_type,
    filtered.visit_at,
    filtered.party_size,
    filtered.contact_phone,
    filtered.contact_email,
    filtered.meeting_point,
    filtered.request_note,
    filtered.status,
    filtered.admin_note,
    filtered.created_at,
    count(*) over () as total_count,
    count(*) filter (where filtered.status = 'new') over () as new_count,
    count(*) filter (where filtered.status = 'confirmed') over () as confirmed_count,
    count(*) filter (where filtered.status = 'completed') over () as completed_count,
    count(*) filter (where filtered.status = 'cancelled') over () as cancelled_count,
    count(*) filter (where filtered.status = 'archived') over () as archived_count,
    coalesce(sum(filtered.party_size) over (), 0)::bigint as visitors_sum,
    count(*) filter (
      where filtered.visit_at >= now()
        and filtered.status in ('new', 'confirmed')
    ) over () as upcoming_count
  from filtered
  order by filtered.visit_at asc, filtered.request_id
  limit least(greatest(coalesce(report_limit, 50), 1), 200)
  offset greatest(coalesce(report_offset, 0), 0);
$$;
