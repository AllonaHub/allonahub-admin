alter table public.mall_directory_items
  add column if not exists floor_zone_id uuid references public.mall_floor_zones(id) on delete set null;

create index if not exists mall_directory_items_floor_zone_idx
  on public.mall_directory_items(mall_id, floor_zone_id);

create or replace function public.validate_mall_directory_floor_zone()
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
    raise exception 'Katalog kaydının kat planı bölgesi aynı AVM merkezine ait olmalıdır.';
  end if;
  return new;
end;
$$;

drop trigger if exists mall_directory_items_validate_floor_zone on public.mall_directory_items;
create trigger mall_directory_items_validate_floor_zone
  before insert or update of mall_id, floor_zone_id on public.mall_directory_items
  for each row execute function public.validate_mall_directory_floor_zone();
