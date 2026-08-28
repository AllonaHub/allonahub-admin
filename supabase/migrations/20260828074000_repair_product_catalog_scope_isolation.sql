-- Repair commerce catalog isolation without deleting product data.
-- ALM-* is the canonical Allona Market seed prefix; ALY-* is the canonical Allona Yemek seed prefix.

alter table public.products
  add column if not exists module_key text,
  add column if not exists catalog_scope text;

update public.products
set
  module_key = coalesce(nullif(module_key, ''), 'shop'),
  catalog_scope = coalesce(nullif(catalog_scope, ''), nullif(module_key, ''), 'shop')
where module_key is null
   or module_key = ''
   or catalog_scope is null
   or catalog_scope = '';

update public.products
set
  module_key = 'market',
  catalog_scope = 'market'
where upper(coalesce(sku, '')) like 'ALM-%'
  and (
    module_key is distinct from 'market'
    or catalog_scope is distinct from 'market'
  );

update public.products
set
  module_key = 'food',
  catalog_scope = 'food'
where upper(coalesce(sku, '')) like 'ALY-%'
  and (
    module_key is distinct from 'food'
    or catalog_scope is distinct from 'food'
  );

create or replace function public.enforce_product_catalog_scope()
returns trigger
language plpgsql
as $$
declare
  sku_value text := upper(coalesce(new.sku, ''));
begin
  new.module_key := nullif(lower(trim(coalesce(new.module_key, ''))), '');
  new.catalog_scope := nullif(lower(trim(coalesce(new.catalog_scope, ''))), '');

  if new.module_key is null and new.catalog_scope is not null then
    new.module_key := new.catalog_scope;
  elsif new.catalog_scope is null and new.module_key is not null then
    new.catalog_scope := new.module_key;
  end if;

  if new.module_key is null or new.catalog_scope is null then
    raise exception 'Product module_key and catalog_scope are required.';
  end if;

  if new.module_key not in ('shop', 'market', 'food', 'taxi', 'service')
     or new.catalog_scope not in ('shop', 'market', 'food', 'taxi', 'service') then
    raise exception 'Product catalog scope is not allowed.';
  end if;

  if new.module_key <> new.catalog_scope then
    raise exception 'Product module_key and catalog_scope must match.';
  end if;

  if sku_value like 'ALM-%' and new.module_key <> 'market' then
    raise exception 'ALM product SKU must use market catalog scope.';
  end if;

  if sku_value like 'ALY-%' and new.module_key <> 'food' then
    raise exception 'ALY product SKU must use food catalog scope.';
  end if;

  return new;
end;
$$;

drop trigger if exists products_enforce_catalog_scope on public.products;

create trigger products_enforce_catalog_scope
before insert or update of module_key, catalog_scope, sku
on public.products
for each row
execute function public.enforce_product_catalog_scope();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_catalog_scope_required_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_catalog_scope_required_check
      check (catalog_scope is not null and catalog_scope in ('shop', 'market', 'food', 'taxi', 'service'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_module_catalog_scope_match_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_module_catalog_scope_match_check
      check (module_key = catalog_scope)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_alm_scope_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_alm_scope_check
      check (upper(coalesce(sku, '')) not like 'ALM-%' or module_key = 'market')
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_aly_scope_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_aly_scope_check
      check (upper(coalesce(sku, '')) not like 'ALY-%' or module_key = 'food')
      not valid;
  end if;
end $$;

create index if not exists products_catalog_scope_status_idx
  on public.products(catalog_scope, module_key, status, created_at desc);
