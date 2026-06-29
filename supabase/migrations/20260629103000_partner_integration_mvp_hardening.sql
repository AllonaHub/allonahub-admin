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
  add column if not exists sku text,
  add column if not exists partner_code text,
  add column if not exists partner_email text,
  add column if not exists catalog_scope text,
  add column if not exists integration_source text,
  add column if not exists integration_external_id text,
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

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'module_key'
  ) then
    execute $sql$
      update public.products
      set catalog_scope = coalesce(
        nullif(catalog_scope, ''),
        case when module_key in ('shop', 'market', 'food', 'taxi', 'service') then module_key else null end,
        'shop'
      )
      where catalog_scope is null
         or catalog_scope = ''
    $sql$;
  else
    update public.products
    set catalog_scope = coalesce(nullif(catalog_scope, ''), 'shop')
    where catalog_scope is null
       or catalog_scope = '';
  end if;
end $$;

update public.products
set compliance_review_status = coalesce(nullif(compliance_review_status, ''), 'pending')
where compliance_review_status is null
   or compliance_review_status = '';

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

create index if not exists products_partner_integration_source_idx
  on public.products(partner_id, integration_source, integration_external_id);

create index if not exists partner_integrations_last_test_idx
  on public.partner_integrations(partner_id, last_test_status, last_test_at desc);
