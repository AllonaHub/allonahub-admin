do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mall_directory_items_schedule_valid'
      and conrelid = 'public.mall_directory_items'::regclass
  ) then
    alter table public.mall_directory_items
      add constraint mall_directory_items_schedule_valid
      check (
        (
          (starts_at is null and ends_at is null)
          or (starts_at is not null and ends_at is not null and ends_at >= starts_at)
        )
        and (
          status <> 'active'
          or item_type not in ('events', 'deals')
          or (starts_at is not null and ends_at is not null)
        )
      ) not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mall_partner_submissions_schedule_valid'
      and conrelid = 'public.mall_partner_submissions'::regclass
  ) then
    alter table public.mall_partner_submissions
      add constraint mall_partner_submissions_schedule_valid
      check (
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
      ) not valid;
  end if;
end;
$$;
