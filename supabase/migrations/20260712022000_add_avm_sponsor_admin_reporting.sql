create index if not exists mall_ad_slot_interactions_mall_slot_date_idx
  on public.mall_ad_slot_interactions(mall_id, ad_slot_id, interaction_date desc, created_at desc);

create or replace function public.get_mall_ad_slot_interaction_report(
  report_mall_id uuid,
  report_ad_slot_id uuid default null,
  report_slot_type text default null,
  report_interaction_type text default null,
  report_start_date date default null,
  report_end_date date default null,
  report_limit integer default 50,
  report_offset integer default 0
)
returns table (
  interaction_id uuid,
  ad_slot_id uuid,
  ad_slot_public_id text,
  interaction_type text,
  source_page text,
  interaction_date date,
  created_at timestamptz,
  slot_title text,
  slot_type text,
  placement text,
  total_count bigint,
  impression_count bigint,
  click_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select
      interaction.id as interaction_id,
      interaction.ad_slot_id,
      interaction.ad_slot_public_id,
      interaction.interaction_type,
      interaction.source_page,
      interaction.interaction_date,
      interaction.created_at,
      slot.title as slot_title,
      slot.slot_type,
      slot.placement
    from public.mall_ad_slot_interactions interaction
    join public.mall_ad_slots slot on slot.id = interaction.ad_slot_id
    where (select public.is_admin())
      and interaction.mall_id = report_mall_id
      and (report_ad_slot_id is null or interaction.ad_slot_id = report_ad_slot_id)
      and (report_slot_type is null or slot.slot_type = report_slot_type)
      and (report_interaction_type is null or interaction.interaction_type = report_interaction_type)
      and (report_start_date is null or interaction.interaction_date >= report_start_date)
      and (report_end_date is null or interaction.interaction_date <= report_end_date)
  )
  select
    filtered.interaction_id,
    filtered.ad_slot_id,
    filtered.ad_slot_public_id,
    filtered.interaction_type,
    filtered.source_page,
    filtered.interaction_date,
    filtered.created_at,
    filtered.slot_title,
    filtered.slot_type,
    filtered.placement,
    count(*) over () as total_count,
    count(*) filter (where filtered.interaction_type = 'impression') over () as impression_count,
    count(*) filter (where filtered.interaction_type = 'click') over () as click_count
  from filtered
  order by filtered.created_at desc, filtered.interaction_id
  limit least(greatest(coalesce(report_limit, 50), 1), 200)
  offset greatest(coalesce(report_offset, 0), 0);
$$;

comment on function public.get_mall_ad_slot_interaction_report(uuid, uuid, text, text, date, date, integer, integer)
  is 'Admin-only filtered and paginated AVM sponsor interaction operations report with exact window totals.';
