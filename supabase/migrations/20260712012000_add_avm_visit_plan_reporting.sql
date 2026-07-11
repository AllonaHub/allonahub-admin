create index if not exists mall_visit_plans_reporting_idx
  on public.mall_visit_plans(mall_id, created_at desc, status);

create or replace function public.get_mall_visit_plan_report(
  report_mall_id uuid,
  report_status text default null,
  report_search text default null,
  report_start_date date default null,
  report_end_date date default null,
  report_limit integer default 50,
  report_offset integer default 0
)
returns table (
  plan_id uuid,
  contact_email text,
  visitor_note text,
  selected_item_ids text[],
  selected_item_titles text[],
  total_stops integer,
  total_minutes integer,
  total_touch_score integer,
  source_page text,
  status text,
  created_at timestamptz,
  total_count bigint,
  new_count bigint,
  reviewed_count bigint,
  actioned_count bigint,
  archived_count bigint,
  stops_sum bigint,
  minutes_sum bigint,
  touch_score_sum bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select
      plan.id as plan_id,
      plan.contact_email,
      plan.visitor_note,
      plan.selected_item_ids,
      plan.selected_item_titles,
      plan.total_stops,
      plan.total_minutes,
      plan.total_touch_score,
      plan.source_page,
      plan.status,
      plan.created_at
    from public.mall_visit_plans plan
    where (select public.is_admin())
      and plan.mall_id = report_mall_id
      and (report_status is null or plan.status = report_status)
      and (
        report_start_date is null
        or plan.created_at >= (report_start_date::timestamp at time zone 'Europe/Istanbul')
      )
      and (
        report_end_date is null
        or plan.created_at < ((report_end_date + 1)::timestamp at time zone 'Europe/Istanbul')
      )
      and (
        nullif(trim(report_search), '') is null
        or position(
          lower(trim(report_search)) in lower(concat_ws(
            ' ',
            plan.contact_email,
            plan.visitor_note,
            array_to_string(plan.selected_item_titles, ' '),
            array_to_string(plan.selected_item_ids, ' '),
            plan.source_page
          ))
        ) > 0
      )
  )
  select
    filtered.plan_id,
    filtered.contact_email,
    filtered.visitor_note,
    filtered.selected_item_ids,
    filtered.selected_item_titles,
    filtered.total_stops,
    filtered.total_minutes,
    filtered.total_touch_score,
    filtered.source_page,
    filtered.status,
    filtered.created_at,
    count(*) over () as total_count,
    count(*) filter (where filtered.status = 'new') over () as new_count,
    count(*) filter (where filtered.status = 'reviewed') over () as reviewed_count,
    count(*) filter (where filtered.status = 'actioned') over () as actioned_count,
    count(*) filter (where filtered.status = 'archived') over () as archived_count,
    sum(filtered.total_stops) over () as stops_sum,
    sum(filtered.total_minutes) over () as minutes_sum,
    sum(filtered.total_touch_score) over () as touch_score_sum
  from filtered
  order by filtered.created_at desc, filtered.plan_id
  limit least(greatest(coalesce(report_limit, 50), 1), 200)
  offset greatest(coalesce(report_offset, 0), 0);
$$;
