begin;

create table if not exists public.maritime_vessel_lookup_cache (
  imo_number text primary key check (imo_number ~ '^[0-9]{7}$'),
  provider text not null check (provider in ('marinetraffic', 'wikidata')),
  vessel_payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.maritime_vessel_lookup_cache
  drop constraint if exists maritime_vessel_lookup_cache_provider_check;

alter table public.maritime_vessel_lookup_cache
  add constraint maritime_vessel_lookup_cache_provider_check
  check (provider in ('marinetraffic', 'wikidata'));

comment on column public.maritime_vessel_lookup_cache.provider is
  'Source used for cached vessel particulars. MarineTraffic is preferred when configured; Wikidata is the CC0 fallback.';

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null
    and not exists (
      select 1
      from pg_trigger
      where tgname = 'maritime_vessel_lookup_cache_set_updated_at'
        and tgrelid = 'public.maritime_vessel_lookup_cache'::regclass
        and not tgisinternal
    ) then
    create trigger maritime_vessel_lookup_cache_set_updated_at
      before update on public.maritime_vessel_lookup_cache
      for each row execute function public.set_updated_at();
  end if;
end;
$$;

alter table public.maritime_vessel_lookup_cache enable row level security;
revoke all on public.maritime_vessel_lookup_cache from public, anon, authenticated;

commit;
