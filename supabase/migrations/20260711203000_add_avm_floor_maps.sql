create table if not exists public.mall_floor_maps (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid references public.mall_centers(id) on delete cascade,
  public_id text not null unique,
  title text not null,
  floor_label text not null default 'Zemin Kat',
  image_url text,
  image_alt text not null default '',
  native_width_px integer check (native_width_px is null or native_width_px > 0),
  native_height_px integer check (native_height_px is null or native_height_px > 0),
  storage_bucket text not null default 'mall-assets',
  storage_path text,
  display_order integer not null default 999,
  status text not null default 'draft' check (status in ('active', 'draft', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mall_floor_maps_mall_status_idx
  on public.mall_floor_maps(mall_id, status, display_order);

drop trigger if exists mall_floor_maps_set_updated_at on public.mall_floor_maps;
create trigger mall_floor_maps_set_updated_at
  before update on public.mall_floor_maps
  for each row execute function public.set_updated_at();

alter table public.mall_floor_maps enable row level security;

drop policy if exists "mall_floor_maps_read_active" on public.mall_floor_maps;
create policy "mall_floor_maps_read_active"
  on public.mall_floor_maps for select
  using (status = 'active' or public.is_admin());

drop policy if exists "mall_floor_maps_admin_all" on public.mall_floor_maps;
create policy "mall_floor_maps_admin_all"
  on public.mall_floor_maps for all
  using (public.is_admin())
  with check (public.is_admin());
