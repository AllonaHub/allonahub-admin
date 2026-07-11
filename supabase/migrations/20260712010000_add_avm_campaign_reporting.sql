create index if not exists mall_campaign_redemptions_reporting_idx
  on public.mall_campaign_redemptions(mall_id, created_at desc, status, action_type, directory_item_id);

create or replace function public.get_mall_campaign_redemption_report(
  report_mall_id uuid,
  report_status text default null,
  report_action_type text default null,
  report_directory_item_id uuid default null,
  report_category text default null,
  report_partner_submission_id uuid default null,
  report_requested_visibility text default null,
  report_start_date date default null,
  report_end_date date default null,
  report_limit integer default 50,
  report_offset integer default 0
)
returns table (
  redemption_id uuid,
  directory_item_id uuid,
  directory_public_id text,
  campaign_title text,
  campaign_category text,
  floor_label text,
  visitor_email text,
  action_type text,
  source_page text,
  status text,
  created_at timestamptz,
  partner_submission_id uuid,
  partner_brand_name text,
  partner_requested_visibility text,
  partner_visibility_status text,
  total_count bigint,
  new_count bigint,
  reviewed_count bigint,
  exported_count bigint,
  archived_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with enriched as (
    select
      redemption.id as redemption_id,
      redemption.directory_item_id,
      redemption.directory_public_id,
      redemption.campaign_title,
      redemption.campaign_category,
      redemption.floor_label,
      redemption.visitor_email,
      redemption.action_type,
      redemption.source_page,
      redemption.status,
      redemption.created_at,
      partner.id as partner_submission_id,
      partner.brand_name as partner_brand_name,
      partner.requested_visibility as partner_requested_visibility,
      partner.visibility_status as partner_visibility_status
    from public.mall_campaign_redemptions redemption
    left join lateral (
      select
        submission.id,
        submission.brand_name,
        submission.requested_visibility,
        submission.visibility_status
      from public.mall_partner_submissions submission
      where submission.mall_id = redemption.mall_id
        and submission.module_key = 'mall'
        and submission.request_type = 'campaign'
        and submission.published_item_id = redemption.directory_item_id
      order by submission.created_at desc, submission.id
      limit 1
    ) partner on true
    where (select public.is_admin())
      and redemption.mall_id = report_mall_id
  ),
  filtered as (
    select *
    from enriched
    where (report_status is null or enriched.status = report_status)
      and (report_action_type is null or enriched.action_type = report_action_type)
      and (report_directory_item_id is null or enriched.directory_item_id = report_directory_item_id)
      and (report_category is null or enriched.campaign_category = report_category)
      and (report_partner_submission_id is null or enriched.partner_submission_id = report_partner_submission_id)
      and (report_requested_visibility is null or enriched.partner_requested_visibility = report_requested_visibility)
      and (
        report_start_date is null
        or enriched.created_at >= (report_start_date::timestamp at time zone 'Europe/Istanbul')
      )
      and (
        report_end_date is null
        or enriched.created_at < ((report_end_date + 1)::timestamp at time zone 'Europe/Istanbul')
      )
  )
  select
    filtered.redemption_id,
    filtered.directory_item_id,
    filtered.directory_public_id,
    filtered.campaign_title,
    filtered.campaign_category,
    filtered.floor_label,
    filtered.visitor_email,
    filtered.action_type,
    filtered.source_page,
    filtered.status,
    filtered.created_at,
    filtered.partner_submission_id,
    filtered.partner_brand_name,
    filtered.partner_requested_visibility,
    filtered.partner_visibility_status,
    count(*) over () as total_count,
    count(*) filter (where filtered.status = 'new') over () as new_count,
    count(*) filter (where filtered.status = 'reviewed') over () as reviewed_count,
    count(*) filter (where filtered.status = 'exported') over () as exported_count,
    count(*) filter (where filtered.status = 'archived') over () as archived_count
  from filtered
  order by filtered.created_at desc, filtered.redemption_id
  limit least(greatest(coalesce(report_limit, 50), 1), 200)
  offset greatest(coalesce(report_offset, 0), 0);
$$;

create or replace function public.get_mall_campaign_redemption_dimensions(
  report_mall_id uuid
)
returns table (
  campaign_options jsonb,
  category_options jsonb,
  partner_options jsonb,
  visibility_options jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with dimension_rows as (
    select
      redemption.directory_item_id,
      redemption.campaign_title,
      redemption.campaign_category,
      partner.id as partner_submission_id,
      partner.brand_name as partner_brand_name,
      partner.requested_visibility as partner_requested_visibility
    from public.mall_campaign_redemptions redemption
    left join lateral (
      select
        submission.id,
        submission.brand_name,
        submission.requested_visibility
      from public.mall_partner_submissions submission
      where submission.mall_id = redemption.mall_id
        and submission.module_key = 'mall'
        and submission.request_type = 'campaign'
        and submission.published_item_id = redemption.directory_item_id
      order by submission.created_at desc, submission.id
      limit 1
    ) partner on true
    where (select public.is_admin())
      and redemption.mall_id = report_mall_id
  )
  select
    coalesce((
      select jsonb_agg(
        jsonb_build_object('value', option.value, 'label', option.label)
        order by option.label, option.value
      )
      from (
        select directory_item_id::text as value, min(campaign_title) as label
        from dimension_rows
        where directory_item_id is not null
        group by directory_item_id
      ) option
    ), '[]'::jsonb) as campaign_options,
    coalesce((
      select jsonb_agg(
        jsonb_build_object('value', option.value, 'label', option.value)
        order by option.value
      )
      from (
        select distinct campaign_category as value
        from dimension_rows
        where nullif(trim(campaign_category), '') is not null
      ) option
    ), '[]'::jsonb) as category_options,
    coalesce((
      select jsonb_agg(
        jsonb_build_object('value', option.value, 'label', option.label)
        order by option.label, option.value
      )
      from (
        select partner_submission_id::text as value, max(partner_brand_name) as label
        from dimension_rows
        where partner_submission_id is not null
        group by partner_submission_id
      ) option
    ), '[]'::jsonb) as partner_options,
    coalesce((
      select jsonb_agg(
        jsonb_build_object('value', option.value, 'label', option.value)
        order by option.value
      )
      from (
        select distinct partner_requested_visibility as value
        from dimension_rows
        where nullif(trim(partner_requested_visibility), '') is not null
      ) option
    ), '[]'::jsonb) as visibility_options;
$$;

create or replace function public.get_mall_campaign_redemption_summary(
  report_directory_item_ids uuid[]
)
returns table (
  directory_item_id uuid,
  total_count bigint,
  recent_count bigint,
  last_redemption_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    redemption.directory_item_id,
    count(*) as total_count,
    count(*) filter (where redemption.created_at >= now() - interval '30 days') as recent_count,
    max(redemption.created_at) as last_redemption_at
  from public.mall_campaign_redemptions redemption
  where (select public.is_partner_or_admin())
    and cardinality(coalesce(report_directory_item_ids, '{}'::uuid[])) > 0
    and redemption.directory_item_id = any(report_directory_item_ids)
    and redemption.action_type = 'save_interest'
    and redemption.status <> 'archived'
  group by redemption.directory_item_id
  order by count(*) desc, redemption.directory_item_id;
$$;
