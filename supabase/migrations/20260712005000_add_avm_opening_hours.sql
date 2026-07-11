create table if not exists public.mall_hours_profiles (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid not null references public.mall_centers(id) on delete cascade,
  directory_item_id uuid references public.mall_directory_items(id) on delete cascade,
  public_id text not null,
  title text not null,
  scope text not null
    check (scope in ('mall', 'stores', 'dining', 'cinema', 'parking', 'entertainment', 'services', 'directory_item')),
  display_order integer not null default 100,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mall_id, public_id),
  check (length(trim(public_id)) between 2 and 180),
  check (length(trim(title)) between 2 and 180),
  check (display_order between 1 and 10000),
  check (
    (scope = 'directory_item' and directory_item_id is not null)
    or (scope <> 'directory_item' and directory_item_id is null)
  )
);

create table if not exists public.mall_weekly_hours (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.mall_hours_profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  is_24_hours boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, day_of_week),
  check (note is null or length(trim(note)) between 2 and 300),
  check (
    (is_closed and not is_24_hours and opens_at is null and closes_at is null)
    or (is_24_hours and not is_closed and opens_at is null and closes_at is null)
    or (
      not is_closed
      and not is_24_hours
      and opens_at is not null
      and closes_at is not null
      and opens_at <> closes_at
    )
  )
);

create table if not exists public.mall_special_hours (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.mall_hours_profiles(id) on delete cascade,
  service_date date not null,
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  is_24_hours boolean not null default false,
  note text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, service_date),
  check (note is null or length(trim(note)) between 2 and 300),
  check (
    (is_closed and not is_24_hours and opens_at is null and closes_at is null)
    or (is_24_hours and not is_closed and opens_at is null and closes_at is null)
    or (
      not is_closed
      and not is_24_hours
      and opens_at is not null
      and closes_at is not null
      and opens_at <> closes_at
    )
  )
);

create index if not exists mall_hours_profiles_mall_status_order_idx
  on public.mall_hours_profiles(mall_id, status, display_order);

create unique index if not exists mall_hours_profiles_scope_unique
  on public.mall_hours_profiles(mall_id, scope)
  where directory_item_id is null and status in ('draft', 'active');

create unique index if not exists mall_hours_profiles_directory_unique
  on public.mall_hours_profiles(mall_id, directory_item_id)
  where directory_item_id is not null and status in ('draft', 'active');

create index if not exists mall_weekly_hours_profile_day_idx
  on public.mall_weekly_hours(profile_id, day_of_week);

create index if not exists mall_special_hours_profile_date_status_idx
  on public.mall_special_hours(profile_id, service_date, status);

create or replace function public.validate_mall_hours_profile()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  weekly_day_count integer;
begin
  if new.directory_item_id is not null and not exists (
    select 1
    from public.mall_directory_items item
    where item.id = new.directory_item_id
      and item.mall_id = new.mall_id
  ) then
    raise exception 'Çalışma saati profili aynı AVM merkezindeki katalog kaydına bağlanmalıdır.';
  end if;

  if new.status = 'active' then
    if tg_op = 'INSERT' then
      raise exception 'Çalışma saati profili önce taslak oluşturulmalı, yedi günlük program tamamlandıktan sonra aktifleştirilmelidir.';
    end if;

    select count(distinct day_of_week)
      into weekly_day_count
    from public.mall_weekly_hours
    where profile_id = new.id;

    if weekly_day_count <> 7 then
      raise exception 'Aktif çalışma saati profili haftanın yedi günü için kayıt içermelidir.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.protect_active_mall_weekly_hours()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.mall_hours_profiles profile
    where profile.id = old.profile_id
      and profile.status = 'active'
  ) then
    if tg_op = 'DELETE' then
      raise exception 'Aktif çalışma saati profilinin günleri silinemez; önce profil taslağa alınmalıdır.';
    end if;
    if new.profile_id is distinct from old.profile_id
      or new.day_of_week is distinct from old.day_of_week then
      raise exception 'Aktif çalışma saati profilinin gün kimliği değiştirilemez; önce profil taslağa alınmalıdır.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists mall_hours_profiles_validate on public.mall_hours_profiles;
create trigger mall_hours_profiles_validate
  before insert or update of mall_id, directory_item_id, scope, status on public.mall_hours_profiles
  for each row execute function public.validate_mall_hours_profile();

drop trigger if exists mall_weekly_hours_protect_active on public.mall_weekly_hours;
create trigger mall_weekly_hours_protect_active
  before delete or update of profile_id, day_of_week on public.mall_weekly_hours
  for each row execute function public.protect_active_mall_weekly_hours();

drop trigger if exists mall_hours_profiles_set_updated_at on public.mall_hours_profiles;
create trigger mall_hours_profiles_set_updated_at
  before update on public.mall_hours_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists mall_weekly_hours_set_updated_at on public.mall_weekly_hours;
create trigger mall_weekly_hours_set_updated_at
  before update on public.mall_weekly_hours
  for each row execute function public.set_updated_at();

drop trigger if exists mall_special_hours_set_updated_at on public.mall_special_hours;
create trigger mall_special_hours_set_updated_at
  before update on public.mall_special_hours
  for each row execute function public.set_updated_at();

alter table public.mall_hours_profiles enable row level security;
alter table public.mall_weekly_hours enable row level security;
alter table public.mall_special_hours enable row level security;

drop policy if exists "mall_hours_profiles_read_active" on public.mall_hours_profiles;
create policy "mall_hours_profiles_read_active"
  on public.mall_hours_profiles for select
  using (
    status = 'active'
    and exists (
      select 1
      from public.mall_centers center
      where center.id = mall_id
        and center.status = 'active'
    )
  );

drop policy if exists "mall_hours_profiles_admin_all" on public.mall_hours_profiles;
create policy "mall_hours_profiles_admin_all"
  on public.mall_hours_profiles for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "mall_weekly_hours_read_active" on public.mall_weekly_hours;
create policy "mall_weekly_hours_read_active"
  on public.mall_weekly_hours for select
  using (
    exists (
      select 1
      from public.mall_hours_profiles profile
      join public.mall_centers center on center.id = profile.mall_id
      where profile.id = profile_id
        and profile.status = 'active'
        and center.status = 'active'
    )
  );

drop policy if exists "mall_weekly_hours_admin_all" on public.mall_weekly_hours;
create policy "mall_weekly_hours_admin_all"
  on public.mall_weekly_hours for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "mall_special_hours_read_active" on public.mall_special_hours;
create policy "mall_special_hours_read_active"
  on public.mall_special_hours for select
  using (
    status = 'active'
    and exists (
      select 1
      from public.mall_hours_profiles profile
      join public.mall_centers center on center.id = profile.mall_id
      where profile.id = profile_id
        and profile.status = 'active'
        and center.status = 'active'
    )
  );

drop policy if exists "mall_special_hours_admin_all" on public.mall_special_hours;
create policy "mall_special_hours_admin_all"
  on public.mall_special_hours for all
  using (public.is_admin())
  with check (public.is_admin());
