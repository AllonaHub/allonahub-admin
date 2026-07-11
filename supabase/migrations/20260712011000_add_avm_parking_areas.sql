create table if not exists public.mall_parking_areas (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid not null references public.mall_centers(id) on delete cascade,
  floor_zone_id uuid references public.mall_floor_zones(id) on delete restrict,
  hours_profile_id uuid references public.mall_hours_profiles(id) on delete restrict,
  public_id text not null,
  title text not null,
  level_label text not null,
  entrance_label text not null,
  directions_text text,
  directions_url text,
  capacity_total integer not null,
  accessible_spaces integer not null default 0,
  family_spaces integer not null default 0,
  ev_charging_spaces integer not null default 0,
  motorcycle_spaces integer not null default 0,
  max_height_m numeric(4, 2),
  pricing_text text,
  best_for text,
  availability_status text not null default 'unknown'
    check (availability_status in ('unknown', 'available', 'limited', 'full', 'closed')),
  spaces_available integer,
  availability_updated_at timestamptz,
  availability_source text not null default 'manual'
    check (availability_source in ('manual', 'integration')),
  display_order integer not null default 100,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mall_id, public_id),
  check (length(trim(public_id)) between 2 and 180),
  check (length(trim(title)) between 2 and 180),
  check (length(trim(level_label)) between 1 and 120),
  check (length(trim(entrance_label)) between 1 and 180),
  check (directions_text is null or length(trim(directions_text)) between 2 and 1000),
  check (
    directions_url is null
    or (
      length(trim(directions_url)) <= 1000
      and trim(directions_url) ~* '^https?://[^[:space:]]+$'
    )
  ),
  check (capacity_total between 1 and 100000),
  check (accessible_spaces between 0 and capacity_total),
  check (family_spaces between 0 and capacity_total),
  check (ev_charging_spaces between 0 and capacity_total),
  check (motorcycle_spaces between 0 and capacity_total),
  check (max_height_m is null or max_height_m between 1.00 and 10.00),
  check (pricing_text is null or length(trim(pricing_text)) between 2 and 1000),
  check (best_for is null or length(trim(best_for)) between 2 and 500),
  check (display_order between 1 and 10000),
  check (
    (
      availability_status = 'unknown'
      and spaces_available is null
      and availability_updated_at is null
    )
    or (
      availability_status in ('available', 'limited')
      and spaces_available between 1 and capacity_total
      and availability_updated_at is not null
    )
    or (
      availability_status in ('full', 'closed')
      and spaces_available = 0
      and availability_updated_at is not null
    )
  ),
  check (
    status <> 'active'
    or (
      floor_zone_id is not null
      and hours_profile_id is not null
      and directions_text is not null
      and pricing_text is not null
    )
  )
);

create index if not exists mall_parking_areas_mall_status_order_idx
  on public.mall_parking_areas(mall_id, status, display_order);

create index if not exists mall_parking_areas_mall_availability_idx
  on public.mall_parking_areas(mall_id, availability_status, availability_updated_at desc);

create or replace function public.validate_mall_parking_area()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  zone_status text;
  profile_status text;
begin
  if new.availability_updated_at is not null
    and new.availability_updated_at > now() + interval '5 minutes' then
    raise exception 'Otopark doluluk zamanı gelecekte olamaz.';
  end if;

  if new.floor_zone_id is not null then
    select zone.status
      into zone_status
    from public.mall_floor_zones zone
    where zone.id = new.floor_zone_id
      and zone.mall_id = new.mall_id;

    if not found then
      raise exception 'Otopark kat planı bölgesi aynı AVM merkezine ait olmalıdır.';
    end if;
  end if;

  if new.hours_profile_id is not null then
    select profile.status
      into profile_status
    from public.mall_hours_profiles profile
    where profile.id = new.hours_profile_id
      and profile.mall_id = new.mall_id
      and profile.scope = 'parking';

    if not found then
      raise exception 'Otopark çalışma saati profili aynı AVM merkezindeki parking kapsamına ait olmalıdır.';
    end if;
  end if;

  if new.status = 'active' then
    if zone_status is distinct from 'active' then
      raise exception 'Aktif otopark alanı aktif bir kat planı bölgesine bağlanmalıdır.';
    end if;
    if profile_status is distinct from 'active' then
      raise exception 'Aktif otopark alanı aktif bir parking çalışma saati profiline bağlanmalıdır.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.protect_active_mall_parking_zone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.mall_parking_areas parking
    where parking.floor_zone_id = old.id
      and parking.status = 'active'
  ) and (
    new.mall_id is distinct from old.mall_id
    or new.status is distinct from 'active'
  ) then
    raise exception 'Aktif otopark alanının kat planı bölgesi değiştirilemez; önce otopark alanını taslağa alın.';
  end if;
  return new;
end;
$$;

create or replace function public.protect_active_mall_parking_hours()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.mall_parking_areas parking
    where parking.hours_profile_id = old.id
      and parking.status = 'active'
  ) and (
    new.mall_id is distinct from old.mall_id
    or new.scope is distinct from 'parking'
    or new.status is distinct from 'active'
  ) then
    raise exception 'Aktif otopark alanının çalışma saati profili değiştirilemez; önce otopark alanını taslağa alın.';
  end if;
  return new;
end;
$$;

drop trigger if exists mall_parking_areas_validate on public.mall_parking_areas;
create trigger mall_parking_areas_validate
  before insert or update of mall_id, floor_zone_id, hours_profile_id, availability_updated_at, status on public.mall_parking_areas
  for each row execute function public.validate_mall_parking_area();

drop trigger if exists mall_floor_zones_protect_active_parking on public.mall_floor_zones;
create trigger mall_floor_zones_protect_active_parking
  before update of mall_id, status on public.mall_floor_zones
  for each row execute function public.protect_active_mall_parking_zone();

drop trigger if exists mall_hours_profiles_protect_active_parking on public.mall_hours_profiles;
create trigger mall_hours_profiles_protect_active_parking
  before update of mall_id, scope, status on public.mall_hours_profiles
  for each row execute function public.protect_active_mall_parking_hours();

drop trigger if exists mall_parking_areas_set_updated_at on public.mall_parking_areas;
create trigger mall_parking_areas_set_updated_at
  before update on public.mall_parking_areas
  for each row execute function public.set_updated_at();

alter table public.mall_parking_areas enable row level security;

drop policy if exists "mall_parking_areas_read_active" on public.mall_parking_areas;
create policy "mall_parking_areas_read_active"
  on public.mall_parking_areas for select
  using (
    status = 'active'
    and exists (
      select 1
      from public.mall_centers center
      where center.id = mall_parking_areas.mall_id
        and center.status = 'active'
    )
  );

drop policy if exists "mall_parking_areas_admin_all" on public.mall_parking_areas;
create policy "mall_parking_areas_admin_all"
  on public.mall_parking_areas for all
  using (public.is_admin())
  with check (public.is_admin());
