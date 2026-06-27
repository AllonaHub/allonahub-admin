grant select, insert, update on public.orders to authenticated;
grant select, insert, update on public.order_items to authenticated;
grant execute on function public.order_has_partner_item(uuid) to authenticated;

notify pgrst, 'reload schema';

select
  '07_orders_repair_validation' as step,
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
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'order_items'
      and column_name = 'partner_id'
  ) as order_items_partner_id_exists,
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'orders_select_own_or_admin'
  ) as orders_select_policy_exists,
  to_regprocedure('public.order_has_partner_item(uuid)') is not null as order_partner_helper_exists;
