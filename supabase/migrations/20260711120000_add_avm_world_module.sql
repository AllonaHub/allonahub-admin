create table if not exists public.mall_centers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  city text not null default 'İstanbul',
  district text,
  address text,
  phone text,
  website_url text,
  hero_image_url text,
  status text not null default 'draft' check (status in ('active', 'draft', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mall_directory_items (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid references public.mall_centers(id) on delete cascade,
  public_id text not null unique,
  item_type text not null check (item_type in ('stores', 'events', 'deals', 'dining')),
  title text not null,
  category text not null,
  floor_label text not null default 'Tüm AVM',
  description text not null default '',
  image_url text,
  image_alt text not null default '',
  tags text[] not null default '{}',
  estimated_minutes integer not null default 20,
  touch_score integer not null default 3,
  display_order integer not null default 999,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('active', 'draft', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mall_leads (
  id uuid primary key default gen_random_uuid(),
  mall_name text not null,
  contact_role text not null,
  email text not null,
  phone text not null,
  need_summary text,
  mall_size text,
  source_page text not null default 'avm-partner',
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists mall_centers_set_updated_at on public.mall_centers;
create trigger mall_centers_set_updated_at
  before update on public.mall_centers
  for each row execute function public.set_updated_at();

drop trigger if exists mall_directory_items_set_updated_at on public.mall_directory_items;
create trigger mall_directory_items_set_updated_at
  before update on public.mall_directory_items
  for each row execute function public.set_updated_at();

drop trigger if exists mall_leads_set_updated_at on public.mall_leads;
create trigger mall_leads_set_updated_at
  before update on public.mall_leads
  for each row execute function public.set_updated_at();

alter table public.mall_centers enable row level security;
alter table public.mall_directory_items enable row level security;
alter table public.mall_leads enable row level security;

drop policy if exists "mall_centers_read_active" on public.mall_centers;
create policy "mall_centers_read_active"
  on public.mall_centers for select
  using (status = 'active' or public.is_admin());

drop policy if exists "mall_centers_admin_all" on public.mall_centers;
create policy "mall_centers_admin_all"
  on public.mall_centers for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "mall_directory_read_active" on public.mall_directory_items;
create policy "mall_directory_read_active"
  on public.mall_directory_items for select
  using (status = 'active' or public.is_admin());

drop policy if exists "mall_directory_admin_all" on public.mall_directory_items;
create policy "mall_directory_admin_all"
  on public.mall_directory_items for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "mall_leads_insert_public" on public.mall_leads;
create policy "mall_leads_insert_public"
  on public.mall_leads for insert
  with check (status = 'new');

drop policy if exists "mall_leads_admin_read" on public.mall_leads;
create policy "mall_leads_admin_read"
  on public.mall_leads for select
  using (public.is_admin());

drop policy if exists "mall_leads_admin_update" on public.mall_leads;
create policy "mall_leads_admin_update"
  on public.mall_leads for update
  using (public.is_admin())
  with check (public.is_admin());

insert into public.mall_centers (slug, name, city, status)
values ('allona-avm-dunyasi', 'AVM Merkezi', 'İstanbul', 'draft')
on conflict (slug) do nothing;
