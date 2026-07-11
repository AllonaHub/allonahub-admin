alter table public.mall_directory_items
  drop constraint if exists mall_directory_items_schedule_valid;

alter table public.mall_partner_submissions
  drop constraint if exists mall_partner_submissions_schedule_valid;

update public.mall_directory_items
set status = 'draft'
where status = 'active'
  and not (
    (
      (starts_at is null and ends_at is null)
      or (starts_at is not null and ends_at is not null and ends_at >= starts_at)
    )
    and (
      item_type not in ('events', 'deals')
      or (starts_at is not null and ends_at is not null)
    )
  );

update public.mall_partner_submissions
set
  status = 'changes_requested',
  visibility_status = 'not_published',
  review_note = case
    when coalesce(review_note, '') like '%Yayın takvimi eksik veya geçersiz.%' then review_note
    when nullif(btrim(coalesce(review_note, '')), '') is null then 'Yayın takvimi eksik veya geçersiz.'
    else review_note || E'\n' || 'Yayın takvimi eksik veya geçersiz.'
  end
where status not in ('changes_requested', 'rejected', 'archived')
  and not (
    (
      (requested_start_date is null and requested_end_date is null)
      or (
        requested_start_date is not null
        and requested_end_date is not null
        and requested_end_date >= requested_start_date
      )
    )
    and (
      request_type not in ('campaign', 'event')
      or (requested_start_date is not null and requested_end_date is not null)
    )
  );

alter table public.mall_directory_items
  add constraint mall_directory_items_schedule_valid
  check (
    status <> 'active'
    or (
      (
        (starts_at is null and ends_at is null)
        or (starts_at is not null and ends_at is not null and ends_at >= starts_at)
      )
      and (
        item_type not in ('events', 'deals')
        or (starts_at is not null and ends_at is not null)
      )
    )
  ) not valid;

alter table public.mall_partner_submissions
  add constraint mall_partner_submissions_schedule_valid
  check (
    status in ('changes_requested', 'rejected', 'archived')
    or (
      (
        (requested_start_date is null and requested_end_date is null)
        or (
          requested_start_date is not null
          and requested_end_date is not null
          and requested_end_date >= requested_start_date
        )
      )
      and (
        request_type not in ('campaign', 'event')
        or (requested_start_date is not null and requested_end_date is not null)
      )
    )
  ) not valid;

alter table public.mall_directory_items
  validate constraint mall_directory_items_schedule_valid;

alter table public.mall_partner_submissions
  validate constraint mall_partner_submissions_schedule_valid;
