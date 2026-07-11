alter table public.mall_leads
  add column if not exists interest_type text not null default 'platform'
  check (interest_type in ('platform', 'leasing', 'advertising', 'events'));

create table if not exists public.mall_floor_zones (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid references public.mall_centers(id) on delete cascade,
  public_id text not null unique,
  title text not null,
  floor_label text not null default 'Zemin Kat',
  zone_type text not null check (zone_type in ('stores', 'events', 'dining', 'parking', 'services')),
  route_hint text not null default '',
  management_metric text not null default '',
  description text not null default '',
  display_order integer not null default 999,
  status text not null default 'draft' check (status in ('active', 'draft', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mall_ad_slots (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid references public.mall_centers(id) on delete cascade,
  public_id text not null unique,
  title text not null,
  slot_type text not null check (slot_type in ('sponsored_listing', 'event_area', 'digital_screen', 'banner', 'popup_lead')),
  placement text not null,
  description text not null default '',
  lead_goal text not null default '',
  display_order integer not null default 999,
  status text not null default 'draft' check (status in ('active', 'draft', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists mall_floor_zones_set_updated_at on public.mall_floor_zones;
create trigger mall_floor_zones_set_updated_at
  before update on public.mall_floor_zones
  for each row execute function public.set_updated_at();

drop trigger if exists mall_ad_slots_set_updated_at on public.mall_ad_slots;
create trigger mall_ad_slots_set_updated_at
  before update on public.mall_ad_slots
  for each row execute function public.set_updated_at();

alter table public.mall_floor_zones enable row level security;
alter table public.mall_ad_slots enable row level security;

drop policy if exists "mall_floor_zones_read_active" on public.mall_floor_zones;
create policy "mall_floor_zones_read_active"
  on public.mall_floor_zones for select
  using (status = 'active' or public.is_admin());

drop policy if exists "mall_floor_zones_admin_all" on public.mall_floor_zones;
create policy "mall_floor_zones_admin_all"
  on public.mall_floor_zones for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "mall_ad_slots_read_active" on public.mall_ad_slots;
create policy "mall_ad_slots_read_active"
  on public.mall_ad_slots for select
  using (status = 'active' or public.is_admin());

drop policy if exists "mall_ad_slots_admin_all" on public.mall_ad_slots;
create policy "mall_ad_slots_admin_all"
  on public.mall_ad_slots for all
  using (public.is_admin())
  with check (public.is_admin());
