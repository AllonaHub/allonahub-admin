create table if not exists public.mall_partner_submissions (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid not null references public.mall_centers(id) on delete cascade,
  submitted_by uuid default auth.uid() references public.profiles(id) on delete set null,
  module_key text not null default 'mall' check (module_key = 'mall'),
  request_type text not null check (request_type in ('tenant_profile', 'campaign', 'event', 'advertising')),
  brand_name text not null,
  submission_title text not null,
  submission_summary text not null default '',
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  requested_visibility text not null default 'standard'
    check (requested_visibility in ('standard', 'featured', 'sponsored', 'event_area')),
  destination_url text,
  media_url text,
  media_alt text not null default '',
  requested_start_date date,
  requested_end_date date,
  budget_range text not null default 'not_specified'
    check (budget_range in ('not_specified', 'under_50000', '50000_150000', '150000_500000', 'over_500000')),
  status text not null default 'new'
    check (status in ('new', 'in_review', 'changes_requested', 'approved', 'rejected', 'archived')),
  visibility_status text not null default 'not_published'
    check (visibility_status in ('not_published', 'scheduled', 'published', 'hidden')),
  published_item_id uuid references public.mall_directory_items(id) on delete set null,
  published_ad_slot_id uuid references public.mall_ad_slots(id) on delete set null,
  source_page text not null default 'partner-panel',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (visibility_status not in ('scheduled', 'published') or status = 'approved'),
  check (length(trim(brand_name)) between 1 and 140),
  check (length(trim(submission_title)) between 1 and 180),
  check (length(trim(submission_summary)) between 1 and 2500),
  check (length(trim(contact_name)) between 1 and 140),
  check (length(trim(contact_email)) between 3 and 220),
  check (contact_phone is null or length(contact_phone) <= 40),
  check (destination_url is null or length(destination_url) <= 500),
  check (
    requested_end_date is null
    or requested_start_date is null
    or requested_end_date >= requested_start_date
  ),
  check (
    (request_type = 'advertising' and published_item_id is null)
    or (request_type <> 'advertising' and published_ad_slot_id is null)
  )
);

create index if not exists mall_partner_submissions_mall_status_idx
  on public.mall_partner_submissions(mall_id, status, created_at desc);

create index if not exists mall_partner_submissions_owner_created_idx
  on public.mall_partner_submissions(submitted_by, created_at desc);

drop trigger if exists mall_partner_submissions_set_updated_at on public.mall_partner_submissions;
create trigger mall_partner_submissions_set_updated_at
  before update on public.mall_partner_submissions
  for each row execute function public.set_updated_at();

create or replace function public.validate_mall_partner_submission_publication()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_is_ready boolean;
  required_target_status text;
begin
  if new.visibility_status not in ('scheduled', 'published') then
    return new;
  end if;

  if new.status <> 'approved' then
    raise exception 'Planlı veya yayındaki bir AVM talebi onaylı olmalıdır.';
  end if;

  required_target_status := case
    when new.visibility_status = 'scheduled' then 'draft'
    else 'active'
  end;

  if new.request_type = 'advertising' then
    if new.published_ad_slot_id is null or new.published_item_id is not null then
      raise exception 'Reklam talebi aktif bir reklam alanına bağlanmalıdır.';
    end if;
    select exists (
      select 1
      from public.mall_ad_slots
      where id = new.published_ad_slot_id
        and mall_id = new.mall_id
        and status = required_target_status
    ) into target_is_ready;
  else
    if new.published_item_id is null or new.published_ad_slot_id is not null then
      raise exception 'Yayın talebi aktif bir AVM katalog kaydına bağlanmalıdır.';
    end if;
    select exists (
      select 1
      from public.mall_directory_items
      where id = new.published_item_id
        and mall_id = new.mall_id
        and status = required_target_status
    ) into target_is_ready;
  end if;

  if not target_is_ready then
    if new.visibility_status = 'scheduled' then
      raise exception 'Planlı AVM talebinin bağlı yayın hedefi taslak olmalıdır.';
    end if;
    raise exception 'Yayındaki AVM talebinin bağlı yayın hedefi aktif olmalıdır.';
  end if;

  return new;
end;
$$;

drop trigger if exists mall_partner_submissions_validate_publication on public.mall_partner_submissions;
create trigger mall_partner_submissions_validate_publication
  before insert or update on public.mall_partner_submissions
  for each row execute function public.validate_mall_partner_submission_publication();

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

create or replace function public.sync_mall_partner_submission_target_status()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  has_blocking_submission boolean;
begin
  if old.status <> 'active' and new.status = 'active' then
    if tg_table_name = 'mall_directory_items' then
      select exists (
        select 1
        from public.mall_partner_submissions
        where published_item_id = new.id
          and (status <> 'approved' or visibility_status <> 'scheduled')
      ) into has_blocking_submission;
      if has_blocking_submission then
        raise exception 'Bağlı partner talebi onaylanıp planlanmadan AVM katalog kaydı aktifleştirilemez.';
      end if;
      update public.mall_partner_submissions
      set visibility_status = 'published'
      where published_item_id = new.id
        and status = 'approved'
        and visibility_status = 'scheduled';
    elsif tg_table_name = 'mall_ad_slots' then
      select exists (
        select 1
        from public.mall_partner_submissions
        where published_ad_slot_id = new.id
          and (status <> 'approved' or visibility_status <> 'scheduled')
      ) into has_blocking_submission;
      if has_blocking_submission then
        raise exception 'Bağlı partner talebi onaylanıp planlanmadan reklam alanı aktifleştirilemez.';
      end if;
      update public.mall_partner_submissions
      set visibility_status = 'published'
      where published_ad_slot_id = new.id
        and status = 'approved'
        and visibility_status = 'scheduled';
    end if;
  elsif old.status is distinct from new.status and new.status <> 'active' then
    if tg_table_name = 'mall_directory_items' then
      update public.mall_partner_submissions
      set visibility_status = case when old.status = 'active' then 'hidden' else 'not_published' end
      where published_item_id = new.id
        and visibility_status in ('scheduled', 'published');
    elsif tg_table_name = 'mall_ad_slots' then
      update public.mall_partner_submissions
      set visibility_status = case when old.status = 'active' then 'hidden' else 'not_published' end
      where published_ad_slot_id = new.id
        and visibility_status in ('scheduled', 'published');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists mall_directory_items_sync_partner_submission on public.mall_directory_items;
create trigger mall_directory_items_sync_partner_submission
  after update of status on public.mall_directory_items
  for each row execute function public.sync_mall_partner_submission_target_status();

drop trigger if exists mall_ad_slots_sync_partner_submission on public.mall_ad_slots;
create trigger mall_ad_slots_sync_partner_submission
  after update of status on public.mall_ad_slots
  for each row execute function public.sync_mall_partner_submission_target_status();

alter table public.mall_partner_submissions enable row level security;

drop policy if exists "mall_partner_submissions_insert_own" on public.mall_partner_submissions;
create policy "mall_partner_submissions_insert_own"
  on public.mall_partner_submissions for insert
  with check (
    public.is_partner_or_admin()
    and submitted_by = auth.uid()
    and module_key = 'mall'
    and status = 'new'
    and visibility_status = 'not_published'
  );

drop policy if exists "mall_partner_submissions_read_own_or_admin" on public.mall_partner_submissions;
create policy "mall_partner_submissions_read_own_or_admin"
  on public.mall_partner_submissions for select
  using (
    public.is_admin()
    or (public.is_partner_or_admin() and submitted_by = auth.uid())
  );

drop policy if exists "mall_partner_submissions_admin_update" on public.mall_partner_submissions;
create policy "mall_partner_submissions_admin_update"
  on public.mall_partner_submissions for update
  using (public.is_admin())
  with check (public.is_admin());
