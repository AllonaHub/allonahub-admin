-- Security Phase 2: harden Supabase Storage upload policy boundaries.
-- Blocks empty MIME metadata, dangerous double extensions, and public SVG uploads.

create or replace function public.storage_object_filename(p_name text)
returns text
language sql
immutable
as $$
  select lower(coalesce(nullif(regexp_replace(coalesce(p_name, ''), '^.*/', ''), ''), ''));
$$;

create or replace function public.storage_object_has_dangerous_extension(p_name text)
returns boolean
language sql
immutable
as $$
  select public.storage_object_filename(p_name) ~
    '\.(php|phtml|phar|asp|aspx|jsp|jspx|js|mjs|cjs|html|htm|svg|sh|bash|zsh|cmd|bat|ps1|exe|dll|so|dylib|jar|py|rb|pl|cgi|wasm)(\.|$)';
$$;

create or replace function public.storage_object_mimetype(p_metadata jsonb)
returns text
language sql
immutable
as $$
  select lower(trim(coalesce(p_metadata ->> 'mimetype', p_metadata ->> 'mimeType', p_metadata ->> 'contentType', '')));
$$;

create or replace function public.storage_object_is_safe_image(p_name text, p_metadata jsonb)
returns boolean
language sql
immutable
as $$
  select
    public.storage_object_filename(p_name) ~ '^[a-z0-9][a-z0-9._/-]{0,240}\.(jpg|jpeg|png|webp)$'
    and public.storage_object_has_dangerous_extension(p_name) = false
    and public.storage_object_mimetype(p_metadata) in ('image/jpeg', 'image/png', 'image/webp');
$$;

create or replace function public.storage_object_is_safe_partner_document(p_name text, p_metadata jsonb)
returns boolean
language sql
immutable
as $$
  select
    public.storage_object_filename(p_name) ~ '^[a-z0-9][a-z0-9._/-]{0,240}\.(pdf|jpg|jpeg|png|webp)$'
    and public.storage_object_has_dangerous_extension(p_name) = false
    and public.storage_object_mimetype(p_metadata) in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp');
$$;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    update storage.buckets
      set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
      where id in ('product-images', 'brand-assets');

    update storage.buckets
      set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
      where id = 'partner-documents';
  end if;

  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "product_images_partner_upload" on storage.objects';
    execute 'create policy "product_images_partner_upload"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = ''product-images''
        and public.is_partner_or_admin()
        and public.storage_object_is_safe_image(name, metadata)
      )';

    execute 'drop policy if exists "product_images_partner_update_own" on storage.objects';
    execute 'create policy "product_images_partner_update_own"
      on storage.objects for update
      to authenticated
      using (bucket_id = ''product-images'' and public.is_partner_or_admin() and owner = auth.uid())
      with check (
        bucket_id = ''product-images''
        and public.is_partner_or_admin()
        and owner = auth.uid()
        and public.storage_object_is_safe_image(name, metadata)
      )';

    execute 'drop policy if exists "partner_documents_owner_upload" on storage.objects';
    execute 'create policy "partner_documents_owner_upload"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = ''partner-documents''
        and public.is_partner_or_admin()
        and owner = auth.uid()
        and public.storage_object_is_safe_partner_document(name, metadata)
      )';
  end if;
end $$;

revoke all on function public.storage_object_filename(text) from public, anon;
revoke all on function public.storage_object_has_dangerous_extension(text) from public, anon;
revoke all on function public.storage_object_mimetype(jsonb) from public, anon;
revoke all on function public.storage_object_is_safe_image(text, jsonb) from public, anon;
revoke all on function public.storage_object_is_safe_partner_document(text, jsonb) from public, anon;

grant execute on function public.storage_object_filename(text) to authenticated;
grant execute on function public.storage_object_has_dangerous_extension(text) to authenticated;
grant execute on function public.storage_object_mimetype(jsonb) to authenticated;
grant execute on function public.storage_object_is_safe_image(text, jsonb) to authenticated;
grant execute on function public.storage_object_is_safe_partner_document(text, jsonb) to authenticated;

comment on function public.storage_object_is_safe_image(text, jsonb) is
  'Security Phase 2: requires safe image extension, non-dangerous filename, and explicit raster MIME metadata.';

comment on function public.storage_object_is_safe_partner_document(text, jsonb) is
  'Security Phase 2: requires safe partner document extension, non-dangerous filename, and explicit PDF/raster MIME metadata.';
