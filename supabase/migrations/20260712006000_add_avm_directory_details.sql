alter table public.mall_directory_items
  add column if not exists contact_phone text,
  add column if not exists website_url text,
  add column if not exists cta_url text,
  add column if not exists cta_label text,
  add column if not exists terms_text text;

alter table public.mall_directory_items
  drop constraint if exists mall_directory_items_details_valid;

alter table public.mall_directory_items
  add constraint mall_directory_items_details_valid check (
    (contact_phone is null or length(trim(contact_phone)) between 3 and 40)
    and (
      website_url is null
      or (
        length(website_url) <= 500
        and website_url ~* '^https?://[^[:space:]]+$'
      )
    )
    and (
      (cta_url is null and cta_label is null)
      or (
        cta_url is not null
        and length(cta_url) <= 500
        and cta_url ~* '^https?://[^[:space:]]+$'
        and cta_label is not null
        and length(trim(cta_label)) between 2 and 80
      )
    )
    and (terms_text is null or length(trim(terms_text)) between 3 and 5000)
  );

create or replace function public.sync_mall_partner_submission_directory_details()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.published_item_id is null
    or new.destination_url is null
    or trim(new.destination_url) !~* '^https?://[^[:space:]]+$' then
    return new;
  end if;

  update public.mall_directory_items
  set cta_url = trim(new.destination_url),
      cta_label = case new.request_type
        when 'tenant_profile' then 'Resmi Siteyi Aç'
        when 'campaign' then 'Kampanyaya Git'
        when 'event' then 'Etkinlik Bilgisini Aç'
        else 'Detayı Aç'
      end
  where id = new.published_item_id
    and mall_id = new.mall_id;

  return new;
end;
$$;

drop trigger if exists mall_partner_submissions_sync_directory_details on public.mall_partner_submissions;
create trigger mall_partner_submissions_sync_directory_details
  after insert or update of destination_url, published_item_id, request_type
  on public.mall_partner_submissions
  for each row execute function public.sync_mall_partner_submission_directory_details();

update public.mall_directory_items item
set cta_url = trim(submission.destination_url),
    cta_label = case submission.request_type
      when 'tenant_profile' then 'Resmi Siteyi Aç'
      when 'campaign' then 'Kampanyaya Git'
      when 'event' then 'Etkinlik Bilgisini Aç'
      else 'Detayı Aç'
    end
from public.mall_partner_submissions submission
where submission.published_item_id = item.id
  and submission.mall_id = item.mall_id
  and submission.destination_url is not null
  and trim(submission.destination_url) ~* '^https?://[^[:space:]]+$'
  and item.cta_url is null;

alter table public.mall_directory_items
  drop constraint if exists mall_directory_active_deal_terms;

alter table public.mall_directory_items
  add constraint mall_directory_active_deal_terms check (
    status <> 'active'
    or item_type <> 'deals'
    or (terms_text is not null and length(trim(terms_text)) between 3 and 5000)
  ) not valid;

drop policy if exists "mall_campaign_redemptions_insert_public" on public.mall_campaign_redemptions;
create policy "mall_campaign_redemptions_insert_public"
  on public.mall_campaign_redemptions for insert
  with check (
    status = 'new'
    and source_page in ('avm-dunyasi', 'avm-detay')
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
