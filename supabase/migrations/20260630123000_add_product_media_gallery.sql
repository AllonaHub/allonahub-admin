alter table if exists public.products
  add column if not exists media_gallery jsonb not null default '[]'::jsonb;

alter table if exists public.products
  add column if not exists video_url text;

update public.products
set media_gallery = jsonb_build_array(image_url)
where image_url is not null
  and trim(image_url) <> ''
  and (
    media_gallery is null
    or media_gallery = '[]'::jsonb
  );

create index if not exists products_media_gallery_gin_idx
  on public.products using gin (media_gallery);

comment on column public.products.media_gallery is 'Partner product gallery URLs. First image_url remains the canonical cover image; gallery stores up to eight public image URLs.';
comment on column public.products.video_url is 'Optional public product video URL uploaded by partner or supplied by integration.';
