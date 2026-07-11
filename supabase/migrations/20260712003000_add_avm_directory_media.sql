alter table public.mall_directory_items
  add column if not exists image_alt text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mall_directory_items_media_valid'
      and conrelid = 'public.mall_directory_items'::regclass
  ) then
    alter table public.mall_directory_items
      add constraint mall_directory_items_media_valid
      check (
        (
          (image_url is null and btrim(image_alt) = '')
          or (
            image_url is not null
            and image_url ~* '^https?://[^[:space:]]+$'
            and char_length(btrim(image_alt)) between 3 and 300
          )
        )
        and (status <> 'active' or image_url is not null)
      ) not valid;
  end if;
end;
$$;
