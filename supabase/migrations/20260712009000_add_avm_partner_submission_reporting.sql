create index if not exists mall_partner_submissions_reporting_idx
  on public.mall_partner_submissions(mall_id, module_key, created_at desc, status, visibility_status, request_type);

create or replace function public.get_mall_partner_submission_summary(
  report_mall_id uuid,
  report_start_date date default null,
  report_end_date date default null
)
returns table (
  total_count bigint,
  awaiting_action_count bigint,
  approved_count bigint,
  published_count bigint,
  tenant_count bigint,
  campaign_count bigint,
  event_count bigint,
  advertising_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*) as total_count,
    count(*) filter (where submission.status in ('new', 'in_review', 'changes_requested')) as awaiting_action_count,
    count(*) filter (where submission.status = 'approved') as approved_count,
    count(*) filter (where submission.visibility_status = 'published') as published_count,
    count(*) filter (where submission.request_type = 'tenant_profile') as tenant_count,
    count(*) filter (where submission.request_type = 'campaign') as campaign_count,
    count(*) filter (where submission.request_type = 'event') as event_count,
    count(*) filter (where submission.request_type = 'advertising') as advertising_count
  from public.mall_partner_submissions submission
  where (select public.is_partner_or_admin())
    and submission.module_key = 'mall'
    and submission.mall_id = report_mall_id
    and (
      report_start_date is null
      or submission.created_at >= (report_start_date::timestamp at time zone 'Europe/Istanbul')
    )
    and (
      report_end_date is null
      or submission.created_at < ((report_end_date + 1)::timestamp at time zone 'Europe/Istanbul')
    );
$$;
