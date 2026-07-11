create table if not exists public.mall_directory_interactions (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid not null references public.mall_centers(id) on delete cascade,
  directory_item_id uuid references public.mall_directory_items(id) on delete set null,
  directory_public_id text not null,
  visitor_session_id uuid not null,
  interaction_type text not null check (
    interaction_type in ('detail_view', 'route_open', 'plan_add', 'cta_open', 'website_open', 'phone_open', 'share')
  ),
  source_page text not null check (source_page in ('avm-dunyasi', 'avm-detay')),
  interaction_date date not null default ((now() at time zone 'Europe/Istanbul')::date),
  created_at timestamptz not null default now(),
  check (length(trim(directory_public_id)) between 1 and 180)
);

create index if not exists mall_directory_interactions_mall_date_idx
  on public.mall_directory_interactions(mall_id, interaction_date desc, created_at desc);

create index if not exists mall_directory_interactions_item_type_idx
  on public.mall_directory_interactions(directory_item_id, interaction_type, created_at desc);

create unique index if not exists mall_directory_interactions_daily_unique
  on public.mall_directory_interactions(directory_item_id, visitor_session_id, interaction_type, interaction_date);

create or replace function public.normalize_mall_directory_interaction()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target public.mall_directory_items%rowtype;
begin
  if new.directory_item_id is null then
    raise exception 'AVM katalog etkileşimi aktif bir yayın hedefine bağlanmalıdır.';
  end if;

  select *
  into target
  from public.mall_directory_items
  where id = new.directory_item_id
    and mall_id = new.mall_id
    and status = 'active'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
    and (item_type <> 'deals' or (terms_text is not null and length(trim(terms_text)) >= 3))
    and exists (
      select 1
      from public.mall_centers center
      where center.id = new.mall_id
        and center.status = 'active'
    );

  if not found then
    raise exception 'Aktif ve güncel AVM katalog hedefi bulunamadı.';
  end if;

  new.directory_public_id := target.public_id;
  new.interaction_date := (now() at time zone 'Europe/Istanbul')::date;
  return new;
end;
$$;

drop trigger if exists mall_directory_interactions_normalize on public.mall_directory_interactions;
create trigger mall_directory_interactions_normalize
  before insert on public.mall_directory_interactions
  for each row execute function public.normalize_mall_directory_interaction();

alter table public.mall_directory_interactions enable row level security;

drop policy if exists "mall_directory_interactions_insert_public" on public.mall_directory_interactions;
create policy "mall_directory_interactions_insert_public"
  on public.mall_directory_interactions for insert
  with check (
    directory_item_id is not null
    and source_page in ('avm-dunyasi', 'avm-detay')
    and exists (
      select 1
      from public.mall_directory_items item
      where item.id = mall_directory_interactions.directory_item_id
        and item.mall_id = mall_directory_interactions.mall_id
        and item.status = 'active'
        and (item.starts_at is null or item.starts_at <= now())
        and (item.ends_at is null or item.ends_at >= now())
        and (item.item_type <> 'deals' or (item.terms_text is not null and length(trim(item.terms_text)) >= 3))
        and exists (
          select 1
          from public.mall_centers center
          where center.id = mall_directory_interactions.mall_id
            and center.status = 'active'
        )
    )
  );

drop policy if exists "mall_directory_interactions_admin_read" on public.mall_directory_interactions;
create policy "mall_directory_interactions_admin_read"
  on public.mall_directory_interactions for select
  using (public.is_admin());

drop policy if exists "mall_directory_interactions_partner_read_own" on public.mall_directory_interactions;
create policy "mall_directory_interactions_partner_read_own"
  on public.mall_directory_interactions for select
  using (
    public.is_partner_or_admin()
    and exists (
      select 1
      from public.mall_partner_submissions submission
      where submission.published_item_id = mall_directory_interactions.directory_item_id
        and submission.submitted_by = auth.uid()
        and submission.module_key = 'mall'
        and submission.visibility_status = 'published'
    )
  );
