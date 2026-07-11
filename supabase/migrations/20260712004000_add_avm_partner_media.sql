alter table public.mall_partner_submissions
  add column if not exists media_url text,
  add column if not exists media_alt text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mall_partner_submissions_media_valid'
      and conrelid = 'public.mall_partner_submissions'::regclass
  ) then
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
          or request_type = 'advertising'
          or media_url is not null
        )
      ) not valid;
  end if;
end;
$$;

create or replace function public.create_mall_partner_submission_target(target_submission_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  submission public.mall_partner_submissions%rowtype;
  target_id uuid;
  target_type text;
begin
  select *
  into submission
  from public.mall_partner_submissions
  where id = target_submission_id
  for update;

  if not found then
    raise exception 'AVM yayın talebi bulunamadı.';
  end if;

  if submission.status in ('rejected', 'archived') then
    raise exception 'Reddedilmiş veya arşivlenmiş AVM talebi yayın hedefine dönüştürülemez.';
  end if;

  if submission.request_type = 'advertising' then
    if submission.published_ad_slot_id is not null then
      return jsonb_build_object('target_type', 'ad_slot', 'target_id', submission.published_ad_slot_id);
    end if;

    insert into public.mall_ad_slots (
      mall_id, public_id, title, slot_type, placement, description, lead_goal, display_order, status
    ) values (
      submission.mall_id,
      'partner-submission-' || submission.id::text,
      submission.submission_title,
      case submission.requested_visibility
        when 'event_area' then 'event_area'
        when 'sponsored' then 'sponsored_listing'
        else 'banner'
      end,
      'Partner talebi: ' || submission.brand_name,
      submission.submission_summary,
      submission.submission_title,
      999,
      'draft'
    )
    returning id into target_id;

    update public.mall_partner_submissions
    set published_ad_slot_id = target_id,
        status = case when status = 'new' then 'in_review' else status end
    where id = submission.id;
    target_type := 'ad_slot';
  else
    if submission.published_item_id is not null then
      return jsonb_build_object('target_type', 'directory_item', 'target_id', submission.published_item_id);
    end if;

    insert into public.mall_directory_items (
      mall_id, public_id, item_type, title, category, floor_label, description, image_url, image_alt, tags,
      estimated_minutes, touch_score, display_order, starts_at, ends_at, status
    ) values (
      submission.mall_id,
      'partner-submission-' || submission.id::text,
      case submission.request_type
        when 'tenant_profile' then 'stores'
        when 'campaign' then 'deals'
        else 'events'
      end,
      submission.submission_title,
      case submission.request_type
        when 'tenant_profile' then 'Mağaza'
        when 'campaign' then 'Kampanya'
        else 'Etkinlik'
      end,
      'Tüm AVM',
      submission.submission_summary,
      submission.media_url,
      submission.media_alt,
      case
        when submission.requested_visibility in ('featured', 'sponsored') then array['featured']::text[]
        else '{}'::text[]
      end,
      20,
      case when submission.requested_visibility in ('featured', 'sponsored', 'event_area') then 5 else 3 end,
      999,
      submission.requested_start_date::timestamp at time zone 'Europe/Istanbul',
      ((submission.requested_end_date + 1)::timestamp at time zone 'Europe/Istanbul') - interval '1 millisecond',
      'draft'
    )
    returning id into target_id;

    update public.mall_partner_submissions
    set published_item_id = target_id,
        status = case when status = 'new' then 'in_review' else status end
    where id = submission.id;
    target_type := 'directory_item';
  end if;

  return jsonb_build_object('target_type', target_type, 'target_id', target_id);
end;
$$;
