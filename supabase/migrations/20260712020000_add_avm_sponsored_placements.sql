alter table public.mall_ad_slots
  add column if not exists creative_image_url text,
  add column if not exists creative_image_alt text not null default '',
  add column if not exists cta_label text,
  add column if not exists cta_url text,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz;

alter table public.mall_partner_submissions
  drop constraint if exists mall_partner_submissions_media_valid,
  drop constraint if exists mall_partner_submissions_schedule_valid;

alter table public.mall_partner_submissions
  add constraint mall_partner_submissions_media_valid
  check (
    (
      (media_url is null and btrim(media_alt) = '')
      or (
        media_url is not null
        and media_url ~* '^https?://[^[:space:]]+$'
        and char_length(btrim(media_alt)) between 3 and 300
      )
    )
    and (
      status in ('changes_requested', 'rejected', 'archived')
      or media_url is not null
    )
  ) not valid,
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
      status in ('changes_requested', 'rejected', 'archived')
      or request_type not in ('campaign', 'event', 'advertising')
      or (requested_start_date is not null and requested_end_date is not null)
    )
  ) not valid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mall_ad_slots_publication_valid'
      and conrelid = 'public.mall_ad_slots'::regclass
  ) then
    alter table public.mall_ad_slots
      add constraint mall_ad_slots_publication_valid
      check (
        (
          (creative_image_url is null and btrim(creative_image_alt) = '')
          or (
            creative_image_url is not null
            and creative_image_alt is not null
            and creative_image_url ~* '^https?://[^[:space:]]+$'
            and char_length(btrim(creative_image_alt)) between 3 and 300
          )
        )
        and (
          (cta_label is null and cta_url is null)
          or (
            cta_label is not null
            and cta_url is not null
            and char_length(btrim(cta_label)) between 2 and 80
            and cta_url ~* '^https?://[^[:space:]]+$'
          )
        )
        and (
          (starts_at is null and ends_at is null)
          or (starts_at is not null and ends_at is not null and starts_at < ends_at)
        )
        and (
          status <> 'active'
          or (
            creative_image_url is not null
            and char_length(btrim(creative_image_alt)) between 3 and 300
            and char_length(btrim(description)) between 3 and 2000
            and char_length(btrim(cta_label)) between 2 and 80
            and cta_url is not null
            and starts_at is not null
            and ends_at is not null
          )
        )
      ) not valid;
  end if;
end;
$$;

drop policy if exists "mall_ad_slots_read_active" on public.mall_ad_slots;
create policy "mall_ad_slots_read_active"
  on public.mall_ad_slots for select
  using (
    public.is_admin()
    or (
      status = 'active'
      and creative_image_url is not null
      and char_length(btrim(creative_image_alt)) >= 3
      and char_length(btrim(cta_label)) >= 2
      and cta_url ~* '^https?://[^[:space:]]+$'
      and starts_at is not null
      and ends_at is not null
      and starts_at <= now()
      and ends_at >= now()
    )
  );

create or replace function public.sync_mall_ad_slot_creative_from_submission()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.request_type <> 'advertising' or new.published_ad_slot_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.published_ad_slot_id is not distinct from new.published_ad_slot_id
     and old.media_url is not distinct from new.media_url
     and old.media_alt is not distinct from new.media_alt
     and old.requested_start_date is not distinct from new.requested_start_date
     and old.requested_end_date is not distinct from new.requested_end_date then
    return new;
  end if;

  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    update public.mall_ad_slots
    set creative_image_url = new.media_url,
        creative_image_alt = coalesce(new.media_alt, ''),
        starts_at = new.requested_start_date::timestamp at time zone 'Europe/Istanbul',
        ends_at = ((new.requested_end_date + 1)::timestamp at time zone 'Europe/Istanbul') - interval '1 millisecond'
    where id = new.published_ad_slot_id
      and status = 'draft';
  end if;
  return new;
end;
$$;

drop trigger if exists mall_partner_submission_sync_ad_creative on public.mall_partner_submissions;
create trigger mall_partner_submission_sync_ad_creative
  after insert or update of published_ad_slot_id, media_url, media_alt, requested_start_date, requested_end_date
  on public.mall_partner_submissions
  for each row execute function public.sync_mall_ad_slot_creative_from_submission();

update public.mall_ad_slots as slot
set creative_image_url = submission.media_url,
    creative_image_alt = coalesce(submission.media_alt, ''),
    starts_at = submission.requested_start_date::timestamp at time zone 'Europe/Istanbul',
    ends_at = ((submission.requested_end_date + 1)::timestamp at time zone 'Europe/Istanbul') - interval '1 millisecond'
from public.mall_partner_submissions as submission
where submission.request_type = 'advertising'
  and submission.published_ad_slot_id = slot.id
  and slot.status = 'draft';

comment on column public.mall_ad_slots.creative_image_url is 'Approved public sponsor creative image URL. Required for active visitor placement.';
comment on column public.mall_ad_slots.cta_url is 'Approved public sponsor destination. Active placements render it with rel=sponsored.';
comment on column public.mall_ad_slots.starts_at is 'Sponsor placement publication start stored in UTC; admin input is Europe/Istanbul.';
comment on column public.mall_ad_slots.ends_at is 'Sponsor placement publication end stored in UTC; admin input is Europe/Istanbul.';
