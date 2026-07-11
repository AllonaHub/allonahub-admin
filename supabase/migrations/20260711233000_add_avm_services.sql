create table if not exists public.mall_services (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid not null references public.mall_centers(id) on delete cascade,
  floor_zone_id uuid references public.mall_floor_zones(id) on delete set null,
  public_id text not null,
  title text not null,
  category text not null
    check (category in ('parking', 'transport', 'accessibility', 'family', 'guest_services', 'amenities')),
  description text not null,
  floor_label text not null,
  route_hint text,
  operating_hours text,
  availability_status text not null default 'available'
    check (availability_status in ('available', 'limited', 'temporarily_unavailable', 'scheduled')),
  availability_note text,
  is_accessibility_service boolean not null default false,
  display_order integer not null default 100,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mall_id, public_id),
  check (length(trim(public_id)) between 2 and 180),
  check (length(trim(title)) between 2 and 180),
  check (length(trim(description)) between 2 and 1500),
  check (length(trim(floor_label)) between 1 and 120),
  check (route_hint is null or length(route_hint) <= 500),
  check (operating_hours is null or length(operating_hours) <= 240),
  check (availability_note is null or length(availability_note) <= 500),
  check (
    availability_status = 'available'
    or (availability_note is not null and length(trim(availability_note)) between 2 and 500)
  ),
  check (display_order between 1 and 10000)
);

create index if not exists mall_services_mall_status_order_idx
  on public.mall_services(mall_id, status, display_order);

create index if not exists mall_services_mall_category_availability_idx
  on public.mall_services(mall_id, category, availability_status);

create or replace function public.validate_mall_service_floor_zone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.floor_zone_id is not null and not exists (
    select 1
    from public.mall_floor_zones zone
    where zone.id = new.floor_zone_id
      and zone.mall_id = new.mall_id
  ) then
    raise exception 'Hizmetin kat planı bölgesi aynı AVM merkezine ait olmalıdır.';
  end if;
  return new;
end;
$$;

drop trigger if exists mall_services_validate_floor_zone on public.mall_services;
create trigger mall_services_validate_floor_zone
  before insert or update of mall_id, floor_zone_id on public.mall_services
  for each row execute function public.validate_mall_service_floor_zone();

drop trigger if exists mall_services_set_updated_at on public.mall_services;
create trigger mall_services_set_updated_at
  before update on public.mall_services
  for each row execute function public.set_updated_at();

alter table public.mall_services enable row level security;

drop policy if exists "mall_services_read_active" on public.mall_services;
create policy "mall_services_read_active"
  on public.mall_services for select
  using (status = 'active');

drop policy if exists "mall_services_admin_all" on public.mall_services;
create policy "mall_services_admin_all"
  on public.mall_services for all
  using (public.is_admin())
  with check (public.is_admin());
