create extension if not exists pgcrypto;

create table if not exists public.maritime_public_listings (
  id uuid primary key default gen_random_uuid(),
  module_key text not null default 'maritime'
    check (module_key = 'maritime'),
  listing_type text not null
    check (listing_type in ('crew_position', 'vessel')),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'archived')),
  title text not null
    check (char_length(title) between 2 and 140),
  summary text not null
    check (char_length(summary) between 10 and 360),
  location_label text not null default ''
    check (char_length(location_label) <= 120),
  detail_label text not null default ''
    check (char_length(detail_label) <= 120),
  sort_order integer not null default 100
    check (sort_order between 0 and 10000),
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maritime_public_listings_valid_window
    check (expires_at is null or expires_at > published_at)
);

create index if not exists maritime_public_listings_active_idx
  on public.maritime_public_listings(module_key, listing_type, status, sort_order, published_at desc);

drop trigger if exists maritime_public_listings_set_updated_at on public.maritime_public_listings;
create trigger maritime_public_listings_set_updated_at
  before update on public.maritime_public_listings
  for each row execute function public.set_updated_at();

alter table public.maritime_public_listings enable row level security;

drop policy if exists "maritime_public_listings_public_active_select" on public.maritime_public_listings;
create policy "maritime_public_listings_public_active_select"
  on public.maritime_public_listings for select to anon, authenticated
  using (
    module_key = 'maritime'
    and status = 'active'
    and published_at <= now()
    and (expires_at is null or expires_at > now())
  );

drop policy if exists "maritime_public_listings_admin_select" on public.maritime_public_listings;
create policy "maritime_public_listings_admin_select"
  on public.maritime_public_listings for select to authenticated
  using (public.is_admin());

revoke all on public.maritime_public_listings from anon, authenticated;
grant select on public.maritime_public_listings to anon, authenticated;
grant all on public.maritime_public_listings to service_role;

comment on table public.maritime_public_listings is
  'Public-safe crew and vessel listing summaries. Anonymous reads are restricted by RLS to active, published, non-expired maritime rows.';
