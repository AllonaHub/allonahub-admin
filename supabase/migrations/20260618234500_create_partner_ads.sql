create table if not exists public.partner_ads (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.profiles(id) on delete set null default auth.uid(),
  product_id uuid references public.products(id) on delete set null,
  placement text not null default 'allonashop_hero',
  title text not null,
  subtitle text,
  campaign_text text,
  image_url text,
  cta_label text not null default 'İncele',
  link_url text,
  priority integer not null default 0,
  status public.product_status not null default 'active',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_ads_placement_status_idx
  on public.partner_ads(placement, status, priority desc, created_at desc);

create index if not exists partner_ads_partner_idx
  on public.partner_ads(partner_id);

drop trigger if exists partner_ads_set_updated_at on public.partner_ads;
create trigger partner_ads_set_updated_at
  before update on public.partner_ads
  for each row execute function public.set_updated_at();

alter table public.partner_ads enable row level security;

drop policy if exists "partner_ads_read_active" on public.partner_ads;
create policy "partner_ads_read_active"
  on public.partner_ads for select
  using (
    status = 'active'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

drop policy if exists "partner_ads_admin_all" on public.partner_ads;
create policy "partner_ads_admin_all"
  on public.partner_ads for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "partner_ads_partner_insert" on public.partner_ads;
create policy "partner_ads_partner_insert"
  on public.partner_ads for insert
  with check (public.is_partner_or_admin() and partner_id = auth.uid());

drop policy if exists "partner_ads_partner_update_own" on public.partner_ads;
create policy "partner_ads_partner_update_own"
  on public.partner_ads for update
  using (public.is_partner_or_admin() and partner_id = auth.uid())
  with check (public.is_partner_or_admin() and partner_id = auth.uid());
