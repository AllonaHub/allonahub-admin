alter table public.partner_integrations
  add column if not exists last_test_at timestamptz,
  add column if not exists last_test_status text,
  add column if not exists last_test_message text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'partner_integrations_last_test_status_check'
      and conrelid = 'public.partner_integrations'::regclass
  ) then
    alter table public.partner_integrations
      add constraint partner_integrations_last_test_status_check
      check (last_test_status is null or last_test_status in ('success', 'warning', 'failed', 'skipped'));
  end if;
end $$;

alter table public.partner_integration_runs
  add column if not exists warning_count integer not null default 0 check (warning_count >= 0),
  add column if not exists applied_by uuid references public.profiles(id) on delete set null,
  add column if not exists approval_note text;

alter table public.partner_integration_product_links
  add column if not exists compliance_status text not null default 'pending',
  add column if not exists last_validation_warnings jsonb not null default '[]'::jsonb;

alter table public.partner_integration_publish_jobs
  drop constraint if exists partner_integration_publish_jobs_status_check;

alter table public.partner_integration_publish_jobs
  add constraint partner_integration_publish_jobs_status_check
  check (status in ('queued', 'processing', 'success', 'failed', 'skipped', 'cancelled'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'partner_integration_product_links_compliance_status_check'
      and conrelid = 'public.partner_integration_product_links'::regclass
  ) then
    alter table public.partner_integration_product_links
      add constraint partner_integration_product_links_compliance_status_check
      check (compliance_status in ('pending', 'needs_review', 'approved', 'rejected'));
  end if;
end $$;

alter table public.products
  add column if not exists name text,
  add column if not exists product_name text,
  add column if not exists description text,
  add column if not exists price numeric not null default 0,
  add column if not exists stock integer not null default 0,
  add column if not exists image_url text,
  add column if not exists category text,
  add column if not exists brand text,
  add column if not exists status text not null default 'draft',
  add column if not exists sku text,
  add column if not exists partner_code text,
  add column if not exists partner_email text,
  add column if not exists module_key text not null default 'shop',
  add column if not exists catalog_scope text,
  add column if not exists integration_source text,
  add column if not exists integration_external_id text,
  add column if not exists slug text,
  add column if not exists meta_title text,
  add column if not exists meta_description text,
  add column if not exists seller_public_name text,
  add column if not exists seller_kind text not null default 'Platform satıcısı',
  add column if not exists seller_legal_name text,
  add column if not exists seller_city text,
  add column if not exists seller_contact text,
  add column if not exists seller_tax_number_masked text,
  add column if not exists invoice_responsibility text,
  add column if not exists seller_disclosure text,
  add column if not exists compliance_review_status text not null default 'pending',
  add column if not exists compliance_notes text;

update public.products
set
  name = coalesce(nullif(name, ''), nullif(product_name, ''), 'Ürün'),
  product_name = coalesce(nullif(product_name, ''), nullif(name, ''), 'Ürün'),
  description = coalesce(description, ''),
  price = coalesce(price, 0),
  stock = coalesce(stock, 0),
  category = coalesce(nullif(category, ''), 'Genel'),
  status = coalesce(nullif(status, ''), 'draft');

alter table public.products
  alter column product_name set default 'Ürün',
  alter column name set default 'Ürün',
  alter column price set default 0,
  alter column stock set default 0,
  alter column status set default 'draft';

update public.products
set module_key = 'shop'
where module_key is null
   or module_key not in ('shop', 'market', 'food', 'taxi', 'service');

alter table public.products
  alter column module_key set default 'shop',
  alter column module_key set not null;

do $$
begin
  update public.products
  set catalog_scope = coalesce(
    nullif(catalog_scope, ''),
    case when module_key in ('shop', 'market', 'food', 'taxi', 'service') then module_key else null end,
    'shop'
  )
  where catalog_scope is null
     or catalog_scope = '';
end $$;

update public.products
set
  slug = coalesce(
    nullif(slug, ''),
    lower(trim(both '-' from regexp_replace(coalesce(name, product_name, sku, id::text), '[^a-zA-Z0-9]+', '-', 'g')))
  ),
  meta_title = coalesce(nullif(meta_title, ''), name, product_name),
  meta_description = coalesce(nullif(meta_description, ''), left(coalesce(description, name, product_name, ''), 300))
where slug is null
   or slug = ''
   or meta_title is null
   or meta_title = ''
   or meta_description is null
   or meta_description = '';

update public.products
set compliance_review_status = coalesce(nullif(compliance_review_status, ''), 'pending')
where compliance_review_status is null
   or compliance_review_status = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_module_key_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_module_key_check
      check (module_key in ('shop', 'market', 'food', 'taxi', 'service'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_catalog_scope_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_catalog_scope_check
      check (catalog_scope is null or catalog_scope in ('shop', 'market', 'food', 'taxi', 'service'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_compliance_review_status_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_compliance_review_status_check
      check (compliance_review_status in ('pending', 'approved', 'rejected', 'needs_review'));
  end if;
end $$;

create index if not exists products_module_status_idx
  on public.products(module_key, status, created_at desc);

create index if not exists products_compliance_review_idx
  on public.products(compliance_review_status, status, created_at desc);

create index if not exists products_partner_integration_source_idx
  on public.products(partner_id, integration_source, integration_external_id);

do $$
begin
  if to_regclass('public.products_partner_integration_external_unique_idx') is null then
    if exists (
      select 1
      from public.products
      where partner_id is not null
        and integration_source is not null
        and integration_external_id is not null
      group by partner_id, integration_source, integration_external_id
      having count(*) > 1
    ) then
      raise notice 'products_partner_integration_external_unique_idx skipped because duplicate imported products already exist.';
    else
      execute $sql$
        create unique index products_partner_integration_external_unique_idx
          on public.products(partner_id, integration_source, integration_external_id)
          where integration_source is not null
            and integration_external_id is not null
      $sql$;
    end if;
  end if;
end $$;

create index if not exists partner_integrations_last_test_idx
  on public.partner_integrations(partner_id, last_test_status, last_test_at desc);
