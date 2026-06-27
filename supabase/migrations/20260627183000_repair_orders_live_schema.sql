create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  create type public.order_status as enum ('pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'awaiting_payment', 'paid', 'failed', 'refunded');
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.order_status add value if not exists 'awaiting_payment';
exception when undefined_object then null;
end $$;

do $$ begin
  alter type public.order_status add value if not exists 'paid';
exception when undefined_object then null;
end $$;

do $$ begin
  alter type public.payment_status add value if not exists 'unpaid';
exception when undefined_object then null;
end $$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique default ('ALN-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  customer_name text not null default '',
  customer_email text not null default '',
  customer_phone text,
  city text not null default '',
  address text not null default '',
  subtotal numeric(12,2) not null default 0,
  shipping numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  order_status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'pending',
  tracking_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders
  add column if not exists order_no text,
  add column if not exists user_id uuid,
  add column if not exists customer_name text not null default '',
  add column if not exists customer_email text not null default '',
  add column if not exists customer_phone text,
  add column if not exists city text not null default '',
  add column if not exists address text not null default '',
  add column if not exists subtotal numeric(12,2) not null default 0,
  add column if not exists shipping numeric(12,2) not null default 0,
  add column if not exists discount numeric(12,2) not null default 0,
  add column if not exists total numeric(12,2) not null default 0,
  add column if not exists order_status public.order_status not null default 'pending',
  add column if not exists payment_status public.payment_status not null default 'pending',
  add column if not exists tracking_number text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists order_number text,
  add column if not exists address_id uuid,
  add column if not exists status text not null default 'pending',
  add column if not exists discount_total numeric(12,2) not null default 0,
  add column if not exists hp_discount numeric(12,2) not null default 0,
  add column if not exists coupon_discount numeric(12,2) not null default 0,
  add column if not exists shipping_total numeric(12,2) not null default 0,
  add column if not exists grand_total numeric(12,2) not null default 0,
  add column if not exists partner_status text not null default 'new',
  add column if not exists cargo_company text,
  add column if not exists admin_note text,
  add column if not exists fraud_status text not null default 'normal';

do $$
declare
  v_has_trigger boolean;
begin
  select exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.orders'::regclass
      and tgname = 'orders_protect_non_admin_update'
      and not tgisinternal
  ) into v_has_trigger;

  if v_has_trigger then
    execute 'alter table public.orders disable trigger orders_protect_non_admin_update';
  end if;

  begin
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'order_no') then
      execute $sql$
        update public.orders
        set order_no = coalesce(nullif(order_no, ''), 'ALN-' || to_char(coalesce(created_at, now()), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 8)))
        where order_no is null or order_no = ''
      $sql$;
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'order_number')
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'order_no') then
      execute $sql$
        update public.orders
        set order_number = coalesce(nullif(order_number, ''), order_no)
        where order_number is null or order_number = ''
      $sql$;
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'status') then
      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'order_status') then
        execute $sql$
          update public.orders
          set status = coalesce(nullif(status, ''), order_status::text, 'pending')
          where status is null or status = ''
        $sql$;
      else
        execute $sql$
          update public.orders
          set status = coalesce(nullif(status, ''), 'pending')
          where status is null or status = ''
        $sql$;
      end if;
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'discount_total')
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'discount') then
      execute $sql$
        update public.orders
        set discount_total = coalesce(nullif(discount_total, 0), discount, 0)
      $sql$;
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'coupon_discount')
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'discount') then
      execute $sql$
        update public.orders
        set coupon_discount = coalesce(nullif(coupon_discount, 0), discount, 0)
      $sql$;
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'shipping_total')
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'shipping') then
      execute $sql$
        update public.orders
        set shipping_total = coalesce(nullif(shipping_total, 0), shipping, 0)
      $sql$;
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'grand_total')
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'total') then
      execute $sql$
        update public.orders
        set grand_total = coalesce(nullif(grand_total, 0), total, 0)
      $sql$;
    end if;
  exception when others then
    if v_has_trigger then
      execute 'alter table public.orders enable trigger orders_protect_non_admin_update';
    end if;
    raise;
  end;

  if v_has_trigger then
    execute 'alter table public.orders enable trigger orders_protect_non_admin_update';
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'order_no') then
    execute 'create index if not exists orders_order_no_idx on public.orders(order_no)';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'order_number') then
    execute 'create index if not exists orders_order_number_idx on public.orders(order_number) where order_number is not null';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'user_id')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'created_at') then
    execute 'create index if not exists orders_user_idx on public.orders(user_id, created_at desc)';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'order_status')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'payment_status') then
    execute 'create index if not exists orders_status_idx on public.orders(order_status, payment_status)';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'status')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'payment_status')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'created_at') then
    execute 'create index if not exists orders_status_created_idx on public.orders(status, payment_status, created_at desc)';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'fraud_status')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'created_at') then
    execute 'create index if not exists orders_fraud_status_idx on public.orders(fraud_status, created_at desc)';
  end if;
end $$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

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

do $$
begin
  execute $sql$
    create or replace function public.order_has_partner_item(target_order_id uuid)
    returns boolean
    language sql
    security definer
    set search_path = public
    as $body$
      select exists (
        select 1
        from public.order_items oi
        where oi.order_id = target_order_id
          and oi.partner_id::text = auth.uid()::text
      );
    $body$;
  $sql$;
end $$;

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "orders_select_own_or_admin" on public.orders;
do $$
begin
  execute $sql$
    create policy "orders_select_own_or_admin"
      on public.orders for select
      to authenticated
      using (
        user_id::text = auth.uid()::text
        or public.is_admin()
        or public.order_has_partner_item(orders.id)
      )
  $sql$;
end $$;

drop policy if exists "orders_insert_own" on public.orders;
drop policy if exists "orders_insert_via_rpc_only" on public.orders;
drop policy if exists "orders_insert_via_secure_rpc_only" on public.orders;
do $$
begin
  execute $sql$
    create policy "orders_insert_via_rpc_only"
      on public.orders for insert
      to authenticated
      with check (false)
  $sql$;
end $$;

drop policy if exists "orders_update_admin_or_partner_delivery" on public.orders;
drop policy if exists "orders_update_admin" on public.orders;
do $$
begin
  execute $sql$
    create policy "orders_update_admin"
      on public.orders for update
      to authenticated
      using (public.is_admin())
      with check (public.is_admin())
  $sql$;
end $$;

drop policy if exists "order_items_select_own_or_admin" on public.order_items;
do $$
begin
  execute $sql$
    create policy "order_items_select_own_or_admin"
      on public.order_items for select
      to authenticated
      using (
        public.is_admin()
        or partner_id::text = auth.uid()::text
        or exists (
          select 1 from public.orders
          where orders.id = order_items.order_id
            and orders.user_id::text = auth.uid()::text
        )
        or public.order_has_partner_item(order_items.order_id)
      )
  $sql$;
end $$;

drop policy if exists "order_items_insert_own" on public.order_items;
drop policy if exists "order_items_insert_via_rpc_only" on public.order_items;
drop policy if exists "order_items_insert_via_secure_rpc_only" on public.order_items;
do $$
begin
  execute $sql$
    create policy "order_items_insert_via_rpc_only"
      on public.order_items for insert
      to authenticated
      with check (false)
  $sql$;
end $$;

drop policy if exists "order_items_admin_update" on public.order_items;
do $$
begin
  execute $sql$
    create policy "order_items_admin_update"
      on public.order_items for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin())
  $sql$;
end $$;

grant select, insert, update on public.orders to authenticated;
grant select, insert, update on public.order_items to authenticated;
grant execute on function public.order_has_partner_item(uuid) to authenticated;

notify pgrst, 'reload schema';

select
  'orders_repair_validation' as check_name,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'orders'
  ) as orders_table_exists,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'order_number'
  ) as order_number_column_exists,
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'orders_select_own_or_admin'
  ) as orders_select_policy_exists,
  to_regprocedure('public.order_has_partner_item(uuid)') is not null as order_partner_helper_exists;
