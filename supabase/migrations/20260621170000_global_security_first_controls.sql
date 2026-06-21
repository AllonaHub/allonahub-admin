create extension if not exists pgcrypto;

do $$ begin
  alter type public.app_role add value if not exists 'user';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.app_role add value if not exists 'employer';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.app_role add value if not exists 'maritime_crew';
exception when duplicate_object then null;
end $$;

create or replace function public.current_app_role()
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce((
    select case role::text
      when 'customer' then 'user'
      else role::text
    end
    from public.profiles
    where id = auth.uid()
    limit 1
  ), 'anonymous');
$$;

create or replace function public.is_standard_user()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_app_role() = 'user';
$$;

create or replace function public.is_employer_or_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select (
    public.current_app_role() = 'employer'
    and public.has_mfa()
  ) or public.is_admin();
$$;

create or replace function public.is_maritime_crew_or_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select (
    public.current_app_role() = 'maritime_crew'
    and public.has_mfa()
  ) or public.is_admin();
$$;

drop policy if exists "profiles_insert_own_customer" on public.profiles;
create policy "profiles_insert_own_user"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid() and role::text in ('customer', 'user'));

alter table if exists public.orders
  add column if not exists iyzico_token text,
  add column if not exists payment_provider_reference text,
  add column if not exists paid_at timestamptz;

create index if not exists orders_payment_provider_reference_idx
  on public.orders(payment_provider_reference)
  where payment_provider_reference is not null;

create unique index if not exists partner_transactions_one_payment_per_intent_idx
  on public.partner_transactions(payment_intent_id, transaction_type)
  where payment_intent_id is not null and transaction_type = 'payment';

drop policy if exists "partner_applications_insert_public" on public.partner_applications;
drop policy if exists "partner_applications_backend_only_insert" on public.partner_applications;
create policy "partner_applications_backend_only_insert"
  on public.partner_applications for insert
  with check (false);

revoke insert, update, delete on public.partner_applications from anon;
revoke insert, delete on public.partner_applications from authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant insert, update, select on public.partner_applications to service_role;
    grant execute on function public.is_standard_user() to service_role;
    grant execute on function public.is_employer_or_admin() to service_role;
    grant execute on function public.is_maritime_crew_or_admin() to service_role;
  end if;
end $$;

grant execute on function public.is_standard_user() to authenticated;
grant execute on function public.is_employer_or_admin() to authenticated;
grant execute on function public.is_maritime_crew_or_admin() to authenticated;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values
      ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
      ('brand-assets', 'brand-assets', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
      ('partner-documents', 'partner-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update set
      public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
  end if;

  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "product_images_public_read" on storage.objects';
    execute 'create policy "product_images_public_read"
      on storage.objects for select
      using (bucket_id = ''product-images'')';

    execute 'drop policy if exists "product_images_partner_upload" on storage.objects';
    execute 'create policy "product_images_partner_upload"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = ''product-images''
        and public.is_partner_or_admin()
        and lower(name) ~ ''\.(jpg|jpeg|png|webp)$''
        and coalesce(metadata ->> ''mimetype'', '''') in ('''', ''image/jpeg'', ''image/png'', ''image/webp'')
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
        and lower(name) ~ ''\.(jpg|jpeg|png|webp)$''
        and coalesce(metadata ->> ''mimetype'', '''') in ('''', ''image/jpeg'', ''image/png'', ''image/webp'')
      )';

    execute 'drop policy if exists "partner_documents_owner_upload" on storage.objects';
    execute 'create policy "partner_documents_owner_upload"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = ''partner-documents''
        and public.is_partner_or_admin()
        and owner = auth.uid()
        and lower(name) ~ ''\.(pdf|jpg|jpeg|png|webp)$''
        and coalesce(metadata ->> ''mimetype'', '''') in ('''', ''application/pdf'', ''image/jpeg'', ''image/png'', ''image/webp'')
      )';

    execute 'drop policy if exists "partner_documents_owner_or_admin_read" on storage.objects';
    execute 'create policy "partner_documents_owner_or_admin_read"
      on storage.objects for select
      to authenticated
      using (bucket_id = ''partner-documents'' and (owner = auth.uid() or public.is_admin()))';
  end if;
end $$;

comment on function public.current_app_role() is
  'Canonical AllonaHub role helper. Legacy customer is normalized to user for new security policy logic.';

comment on index partner_transactions_one_payment_per_intent_idx is
  'Replay protection: one paid transaction row per partner payment intent.';
