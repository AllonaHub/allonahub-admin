alter table public.profiles
  add column if not exists email text,
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists birth_date date,
  add column if not exists bio text,
  add column if not exists sector_key text,
  add column if not exists sector_name text,
  add column if not exists profession_key text,
  add column if not exists profession_name text,
  add column if not exists profession_title text,
  add column if not exists module text,
  add column if not exists experience_year integer,
  add column if not exists profile_visible boolean not null default true,
  add column if not exists contact_locked boolean not null default true,
  add column if not exists avatar_url text,
  add column if not exists hp integer not null default 250,
  add column if not exists xp integer not null default 0,
  add column if not exists level integer not null default 1,
  add column if not exists streak integer not null default 0,
  add column if not exists cashout_balance numeric(12,2) not null default 0,
  add column if not exists hub_cash numeric(12,2) not null default 0,
  add column if not exists wallet_balance numeric(12,2) not null default 0,
  add column if not exists premium_level text not null default 'Basic';

create index if not exists profiles_module_idx on public.profiles(module);
create index if not exists profiles_profession_key_idx on public.profiles(profession_key);
