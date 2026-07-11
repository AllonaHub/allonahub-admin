create index if not exists mall_leads_reporting_idx
  on public.mall_leads(created_at desc, status, interest_type);

create or replace function public.get_mall_lead_report(
  report_status text default null,
  report_interest_type text default null,
  report_search text default null,
  report_start_date date default null,
  report_end_date date default null,
  report_limit integer default 50,
  report_offset integer default 0
)
returns table (
  lead_id uuid,
  mall_name text,
  contact_role text,
  email text,
  phone text,
  need_summary text,
  mall_size text,
  interest_type text,
  source_page text,
  status text,
  created_at timestamptz,
  total_count bigint,
  new_count bigint,
  contacted_count bigint,
  qualified_count bigint,
  archived_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select
      lead.id as lead_id,
      lead.mall_name,
      lead.contact_role,
      lead.email,
      lead.phone,
      lead.need_summary,
      lead.mall_size,
      lead.interest_type,
      lead.source_page,
      lead.status,
      lead.created_at
    from public.mall_leads lead
    where (select public.is_admin())
      and (report_status is null or lead.status = report_status)
      and (report_interest_type is null or lead.interest_type = report_interest_type)
      and (
        report_start_date is null
        or lead.created_at >= (report_start_date::timestamp at time zone 'Europe/Istanbul')
      )
      and (
        report_end_date is null
        or lead.created_at < ((report_end_date + 1)::timestamp at time zone 'Europe/Istanbul')
      )
      and (
        nullif(trim(report_search), '') is null
        or position(
          lower(trim(report_search)) in lower(concat_ws(
            ' ',
            lead.mall_name,
            lead.contact_role,
            lead.email,
            lead.phone,
            lead.need_summary,
            lead.mall_size,
            lead.interest_type,
            lead.source_page
          ))
        ) > 0
      )
  )
  select
    filtered.lead_id,
    filtered.mall_name,
    filtered.contact_role,
    filtered.email,
    filtered.phone,
    filtered.need_summary,
    filtered.mall_size,
    filtered.interest_type,
    filtered.source_page,
    filtered.status,
    filtered.created_at,
    count(*) over () as total_count,
    count(*) filter (where filtered.status = 'new') over () as new_count,
    count(*) filter (where filtered.status = 'contacted') over () as contacted_count,
    count(*) filter (where filtered.status = 'qualified') over () as qualified_count,
    count(*) filter (where filtered.status = 'archived') over () as archived_count
  from filtered
  order by filtered.created_at desc, filtered.lead_id
  limit least(greatest(coalesce(report_limit, 50), 1), 200)
  offset greatest(coalesce(report_offset, 0), 0);
$$;
