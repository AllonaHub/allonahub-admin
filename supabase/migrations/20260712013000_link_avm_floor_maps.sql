alter table public.mall_floor_zones
  add column if not exists floor_map_id uuid references public.mall_floor_maps(id) on delete restrict;

create index if not exists mall_floor_zones_floor_map_idx
  on public.mall_floor_zones(floor_map_id, status, display_order);

create index if not exists mall_floor_maps_floor_status_idx
  on public.mall_floor_maps(mall_id, floor_label, status, display_order);

with exact_matches as (
  select
    zone.id as zone_id,
    max(map.id::text)::uuid as floor_map_id,
    max(map.floor_label) as floor_label
  from public.mall_floor_zones zone
  join public.mall_floor_maps map
    on map.mall_id = zone.mall_id
   and lower(trim(map.floor_label)) = lower(trim(zone.floor_label))
   and map.status <> 'archived'
  where zone.floor_map_id is null
  group by zone.id
  having count(*) = 1
)
update public.mall_floor_zones zone
set
  floor_map_id = exact_matches.floor_map_id,
  floor_label = exact_matches.floor_label
from exact_matches
where zone.id = exact_matches.zone_id;

alter table public.mall_floor_maps
  drop constraint if exists mall_floor_maps_active_asset;

alter table public.mall_floor_maps
  add constraint mall_floor_maps_active_asset
  check (
    status <> 'active'
    or (
      mall_id is not null
      and image_url ~* '^https?://[^[:space:]]+$'
      and char_length(trim(image_alt)) between 3 and 300
      and native_width_px is not null
      and native_height_px is not null
      and storage_bucket = 'mall-assets'
      and nullif(trim(storage_path), '') is not null
    )
  ) not valid;

alter table public.mall_floor_zones
  drop constraint if exists mall_floor_zones_active_floor_map;

alter table public.mall_floor_zones
  add constraint mall_floor_zones_active_floor_map
  check (status <> 'active' or (mall_id is not null and floor_map_id is not null)) not valid;

create or replace function public.validate_mall_floor_map()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'active' and exists (
    select 1
    from public.mall_floor_maps other_map
    where other_map.mall_id = new.mall_id
      and other_map.id <> new.id
      and other_map.status = 'active'
      and lower(trim(other_map.floor_label)) = lower(trim(new.floor_label))
  ) then
    raise exception 'Aynı AVM ve kat için yalnızca bir aktif kat planı olabilir.';
  end if;

  if tg_op = 'UPDATE'
    and (
      new.mall_id is distinct from old.mall_id
      or new.floor_label is distinct from old.floor_label
    )
    and exists (
      select 1
      from public.mall_floor_zones zone
      where zone.floor_map_id = old.id
    ) then
    raise exception 'Bağlı bölgeler başka bir kat planına taşınmadan AVM veya kat etiketi değiştirilemez.';
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'active'
    and new.status <> 'active'
    and exists (
      select 1
      from public.mall_floor_zones zone
      where zone.floor_map_id = old.id
        and zone.status = 'active'
    ) then
    raise exception 'Aktif bölgeler taslağa alınmadan bağlı kat planı pasife çevrilemez.';
  end if;

  return new;
end;
$$;

drop trigger if exists mall_floor_maps_validate on public.mall_floor_maps;
create trigger mall_floor_maps_validate
  before insert or update on public.mall_floor_maps
  for each row execute function public.validate_mall_floor_map();

create or replace function public.validate_mall_floor_zone_map()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  linked_map public.mall_floor_maps%rowtype;
begin
  if new.floor_map_id is null then
    if new.status = 'active' then
      raise exception 'Aktif kat planı bölgesi bir kat görseline bağlanmalıdır.';
    end if;
    return new;
  end if;

  select *
  into linked_map
  from public.mall_floor_maps map
  where map.id = new.floor_map_id;

  if not found then
    raise exception 'Bağlı kat planı bulunamadı.';
  end if;

  if linked_map.mall_id is distinct from new.mall_id then
    raise exception 'Kat planı bölgesi yalnızca aynı AVM merkezindeki görsele bağlanabilir.';
  end if;

  if new.status = 'active' and linked_map.status <> 'active' then
    raise exception 'Bölge aktifleştirilmeden önce bağlı kat planı aktif olmalıdır.';
  end if;

  new.floor_label := linked_map.floor_label;
  return new;
end;
$$;

drop trigger if exists mall_floor_zones_validate_map on public.mall_floor_zones;
create trigger mall_floor_zones_validate_map
  before insert or update on public.mall_floor_zones
  for each row execute function public.validate_mall_floor_zone_map();
