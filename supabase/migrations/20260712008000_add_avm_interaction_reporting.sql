create index if not exists mall_directory_interactions_mall_type_date_idx
  on public.mall_directory_interactions(mall_id, interaction_type, interaction_date desc, created_at desc);

create or replace function public.get_mall_directory_interaction_report(
  report_mall_id uuid,
  report_interaction_type text default null,
  report_search text default null,
  report_start_date date default null,
  report_end_date date default null,
  report_limit integer default 50,
  report_offset integer default 0
)
returns table (
  interaction_id uuid,
  directory_item_id uuid,
  directory_public_id text,
  interaction_type text,
  source_page text,
  interaction_date date,
  created_at timestamptz,
  item_title text,
  item_category text,
  item_type text,
  floor_label text,
  total_count bigint,
  detail_count bigint,
  route_plan_count bigint,
  outbound_count bigint,
  share_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select
      interaction.id as interaction_id,
      interaction.directory_item_id,
      interaction.directory_public_id,
      interaction.interaction_type,
      interaction.source_page,
      interaction.interaction_date,
      interaction.created_at,
      item.title as item_title,
      item.category as item_category,
      item.item_type,
      item.floor_label
    from public.mall_directory_interactions interaction
    left join public.mall_directory_items item on item.id = interaction.directory_item_id
    where (select public.is_admin())
      and interaction.mall_id = report_mall_id
      and (report_interaction_type is null or interaction.interaction_type = report_interaction_type)
      and (report_start_date is null or interaction.interaction_date >= report_start_date)
      and (report_end_date is null or interaction.interaction_date <= report_end_date)
      and (
        nullif(trim(report_search), '') is null
        or position(
          lower(trim(report_search)) in lower(concat_ws(
            ' ',
            item.title,
            item.category,
            item.item_type,
            item.floor_label,
            interaction.directory_public_id,
            interaction.source_page
          ))
        ) > 0
      )
  )
  select
    filtered.interaction_id,
    filtered.directory_item_id,
    filtered.directory_public_id,
    filtered.interaction_type,
    filtered.source_page,
    filtered.interaction_date,
    filtered.created_at,
    filtered.item_title,
    filtered.item_category,
    filtered.item_type,
    filtered.floor_label,
    count(*) over () as total_count,
    count(*) filter (where filtered.interaction_type = 'detail_view') over () as detail_count,
    count(*) filter (where filtered.interaction_type in ('route_open', 'plan_add')) over () as route_plan_count,
    count(*) filter (where filtered.interaction_type in ('cta_open', 'website_open', 'phone_open')) over () as outbound_count,
    count(*) filter (where filtered.interaction_type = 'share') over () as share_count
  from filtered
  order by filtered.created_at desc, filtered.interaction_id
  limit least(greatest(coalesce(report_limit, 50), 1), 200)
  offset greatest(coalesce(report_offset, 0), 0);
$$;

create or replace function public.get_mall_directory_interaction_summary(
  report_directory_item_ids uuid[]
)
returns table (
  directory_item_id uuid,
  total_count bigint,
  detail_count bigint,
  route_plan_count bigint,
  outbound_count bigint,
  share_count bigint,
  recent_count bigint,
  last_interaction_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    interaction.directory_item_id,
    count(*) as total_count,
    count(*) filter (where interaction.interaction_type = 'detail_view') as detail_count,
    count(*) filter (where interaction.interaction_type in ('route_open', 'plan_add')) as route_plan_count,
    count(*) filter (where interaction.interaction_type in ('cta_open', 'website_open', 'phone_open')) as outbound_count,
    count(*) filter (where interaction.interaction_type = 'share') as share_count,
    count(*) filter (
      where interaction.interaction_date >= ((now() at time zone 'Europe/Istanbul')::date - 29)
    ) as recent_count,
    max(interaction.created_at) as last_interaction_at
  from public.mall_directory_interactions interaction
  where (select public.is_partner_or_admin())
    and cardinality(coalesce(report_directory_item_ids, '{}'::uuid[])) > 0
    and interaction.directory_item_id = any(report_directory_item_ids)
  group by interaction.directory_item_id
  order by count(*) desc, interaction.directory_item_id;
$$;
