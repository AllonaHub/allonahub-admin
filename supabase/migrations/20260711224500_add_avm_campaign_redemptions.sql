create table if not exists public.mall_campaign_redemptions (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid not null references public.mall_centers(id) on delete cascade,
  directory_item_id uuid references public.mall_directory_items(id) on delete set null,
  directory_public_id text not null,
  visitor_session_id uuid not null,
  action_type text not null default 'save_interest'
    check (action_type in ('save_interest', 'redeem_request')),
  campaign_title text not null,
  campaign_category text,
  floor_label text,
  visitor_email text,
  source_page text not null default 'avm-dunyasi',
  status text not null default 'new' check (status in ('new', 'reviewed', 'exported', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(directory_public_id)) between 1 and 180),
  check (length(trim(campaign_title)) between 1 and 220),
  check (campaign_category is null or length(campaign_category) <= 120),
  check (floor_label is null or length(floor_label) <= 120),
  check (visitor_email is null or length(visitor_email) between 3 and 220)
);

create index if not exists mall_campaign_redemptions_mall_status_idx
  on public.mall_campaign_redemptions(mall_id, status, created_at desc);

create index if not exists mall_campaign_redemptions_directory_item_idx
  on public.mall_campaign_redemptions(directory_item_id, created_at desc);

create unique index if not exists mall_campaign_redemptions_session_campaign_unique
  on public.mall_campaign_redemptions(directory_item_id, visitor_session_id, action_type);

create or replace function public.normalize_mall_campaign_redemption()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  campaign_record public.mall_directory_items%rowtype;
begin
  select *
  into campaign_record
  from public.mall_directory_items
  where id = new.directory_item_id
    and mall_id = new.mall_id
    and item_type = 'deals'
    and status = 'active'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now());

  if not found then
    raise exception 'Aktif AVM kampanya kaydı bulunamadı.';
  end if;

  new.directory_public_id := campaign_record.public_id;
  new.campaign_title := campaign_record.title;
  new.campaign_category := campaign_record.category;
  new.floor_label := campaign_record.floor_label;
  new.visitor_email := nullif(trim(new.visitor_email), '');
  return new;
end;
$$;

drop trigger if exists mall_campaign_redemptions_normalize on public.mall_campaign_redemptions;
create trigger mall_campaign_redemptions_normalize
  before insert on public.mall_campaign_redemptions
  for each row execute function public.normalize_mall_campaign_redemption();

drop trigger if exists mall_campaign_redemptions_set_updated_at on public.mall_campaign_redemptions;
create trigger mall_campaign_redemptions_set_updated_at
  before update on public.mall_campaign_redemptions
  for each row execute function public.set_updated_at();

alter table public.mall_campaign_redemptions enable row level security;

drop policy if exists "mall_campaign_redemptions_insert_public" on public.mall_campaign_redemptions;
create policy "mall_campaign_redemptions_insert_public"
  on public.mall_campaign_redemptions for insert
  with check (
    status = 'new'
    and source_page = 'avm-dunyasi'
    and action_type = 'save_interest'
    and directory_item_id is not null
    and exists (
      select 1
      from public.mall_directory_items campaign
      where campaign.id = mall_campaign_redemptions.directory_item_id
        and campaign.mall_id = mall_campaign_redemptions.mall_id
        and campaign.item_type = 'deals'
        and campaign.status = 'active'
        and (campaign.starts_at is null or campaign.starts_at <= now())
        and (campaign.ends_at is null or campaign.ends_at >= now())
    )
  );

drop policy if exists "mall_campaign_redemptions_admin_read" on public.mall_campaign_redemptions;
create policy "mall_campaign_redemptions_admin_read"
  on public.mall_campaign_redemptions for select
  using (public.is_admin());

drop policy if exists "mall_campaign_redemptions_partner_read_own_campaigns" on public.mall_campaign_redemptions;
create policy "mall_campaign_redemptions_partner_read_own_campaigns"
  on public.mall_campaign_redemptions for select
  using (
    public.is_partner_or_admin()
    and exists (
      select 1
      from public.mall_partner_submissions submission
      where submission.module_key = 'mall'
        and submission.request_type = 'campaign'
        and submission.submitted_by = auth.uid()
        and submission.published_item_id = mall_campaign_redemptions.directory_item_id
    )
  );

drop policy if exists "mall_campaign_redemptions_admin_update" on public.mall_campaign_redemptions;
create policy "mall_campaign_redemptions_admin_update"
  on public.mall_campaign_redemptions for update
  using (public.is_admin())
  with check (public.is_admin());
