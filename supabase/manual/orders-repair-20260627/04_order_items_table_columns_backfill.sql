create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid,
  partner_id uuid,
  product_name text not null default '',
  quantity integer not null default 1 check (quantity > 0),
  price numeric(12,2) not null default 0 check (price >= 0),
  unit_price numeric(12,2) not null default 0,
  total_price numeric(12,2) not null default 0,
  partner_commission_rate numeric(5,2) not null default 0,
  platform_commission numeric(12,2) not null default 0,
  partner_net_earning numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.order_items
  add column if not exists order_id uuid,
  add column if not exists product_id uuid,
  add column if not exists partner_id uuid,
  add column if not exists product_name text not null default '',
  add column if not exists quantity integer not null default 1,
  add column if not exists price numeric(12,2) not null default 0,
  add column if not exists unit_price numeric(12,2) not null default 0,
  add column if not exists total_price numeric(12,2) not null default 0,
  add column if not exists partner_commission_rate numeric(5,2) not null default 0,
  add column if not exists platform_commission numeric(12,2) not null default 0,
  add column if not exists partner_net_earning numeric(12,2) not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_items' and column_name = 'unit_price')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_items' and column_name = 'price') then
    execute $sql$
      update public.order_items
      set unit_price = case when unit_price = 0 then price else unit_price end
    $sql$;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_items' and column_name = 'total_price')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_items' and column_name = 'price')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_items' and column_name = 'quantity') then
    execute $sql$
      update public.order_items
      set total_price = case when total_price = 0 then price * quantity else total_price end
    $sql$;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_items' and column_name = 'partner_net_earning')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_items' and column_name = 'price')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_items' and column_name = 'quantity')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_items' and column_name = 'platform_commission') then
    execute $sql$
      update public.order_items
      set partner_net_earning = case when partner_net_earning = 0 then greatest(0, price * quantity - platform_commission) else partner_net_earning end
    $sql$;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_items' and column_name = 'order_id') then
    execute 'create index if not exists order_items_order_idx on public.order_items(order_id)';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_items' and column_name = 'partner_id')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_items' and column_name = 'created_at') then
    execute 'create index if not exists order_items_partner_idx on public.order_items(partner_id, created_at desc)';
  end if;
end $$;

drop trigger if exists order_items_set_updated_at on public.order_items;
create trigger order_items_set_updated_at
  before update on public.order_items
  for each row execute function public.set_updated_at();

select
  '04_order_items_table_columns_backfill' as step,
  to_regclass('public.order_items') is not null as order_items_table_exists,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_items' and column_name = 'partner_id') as partner_id_exists,
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'order_items' and indexname = 'order_items_order_idx') as order_index_exists,
  exists (select 1 from pg_trigger where tgrelid = 'public.order_items'::regclass and tgname = 'order_items_set_updated_at') as updated_at_trigger_exists;
