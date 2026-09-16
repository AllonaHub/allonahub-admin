begin;

alter table public.maritime_vessel_lookup_cache
  drop constraint if exists maritime_vessel_lookup_cache_provider_check;

alter table public.maritime_vessel_lookup_cache
  add constraint maritime_vessel_lookup_cache_provider_check
  check (provider in ('marinetraffic', 'vesselfinder_public', 'wikidata'));

comment on column public.maritime_vessel_lookup_cache.provider is
  'Source used for cached vessel particulars. MarineTraffic is preferred when configured; VesselFinder public particulars are the current keyless fallback. Wikidata remains accepted only for legacy cache cleanup.';

delete from public.maritime_vessel_lookup_cache
where provider = 'wikidata';

commit;
