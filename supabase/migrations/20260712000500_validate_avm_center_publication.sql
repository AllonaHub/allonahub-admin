do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mall_centers_active_profile_complete'
      and conrelid = 'public.mall_centers'::regclass
  ) then
    alter table public.mall_centers
      add constraint mall_centers_active_profile_complete
      check (
        status <> 'active'
        or (
          btrim(name) <> ''
          and lower(btrim(name)) <> 'avm merkezi'
          and btrim(city) <> ''
          and district is not null
          and btrim(district) <> ''
          and address is not null
          and btrim(address) <> ''
          and phone is not null
          and btrim(phone) <> ''
          and website_url is not null
          and website_url ~* '^https?://[^[:space:]]+$'
          and hero_image_url is not null
          and hero_image_url ~* '^https?://[^[:space:]]+$'
        )
      ) not valid;
  end if;
end;
$$;
