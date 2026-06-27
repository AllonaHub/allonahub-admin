alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "orders_select_own_or_admin" on public.orders;
create policy "orders_select_own_or_admin"
  on public.orders for select
  to authenticated
  using (
    user_id::text = auth.uid()::text
    or public.is_admin()
    or public.order_has_partner_item(orders.id)
  );

drop policy if exists "orders_insert_own" on public.orders;
drop policy if exists "orders_insert_via_rpc_only" on public.orders;
drop policy if exists "orders_insert_via_secure_rpc_only" on public.orders;
create policy "orders_insert_via_rpc_only"
  on public.orders for insert
  to authenticated
  with check (false);

drop policy if exists "orders_update_admin_or_partner_delivery" on public.orders;
drop policy if exists "orders_update_admin" on public.orders;
create policy "orders_update_admin"
  on public.orders for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "order_items_select_own_or_admin" on public.order_items;
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
  );

drop policy if exists "order_items_insert_own" on public.order_items;
drop policy if exists "order_items_insert_via_rpc_only" on public.order_items;
drop policy if exists "order_items_insert_via_secure_rpc_only" on public.order_items;
create policy "order_items_insert_via_rpc_only"
  on public.order_items for insert
  to authenticated
  with check (false);

drop policy if exists "order_items_admin_update" on public.order_items;
create policy "order_items_admin_update"
  on public.order_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

select
  '06_orders_rls_policies' as step,
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and policyname = 'orders_select_own_or_admin') as orders_select_policy_exists,
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and policyname = 'orders_insert_via_rpc_only') as orders_insert_policy_exists,
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'order_items' and policyname = 'order_items_select_own_or_admin') as order_items_select_policy_exists;
