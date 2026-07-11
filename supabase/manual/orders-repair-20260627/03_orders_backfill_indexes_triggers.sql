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
    execute $sql$
      update public.orders
      set order_no = coalesce(nullif(order_no, ''), 'ALN-' || to_char(coalesce(created_at, now()), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 8)))
      where order_no is null or order_no = ''
    $sql$;

    execute $sql$
      update public.orders
      set order_number = coalesce(nullif(order_number, ''), order_no)
      where order_number is null or order_number = ''
    $sql$;

    execute $sql$
      update public.orders
      set status = coalesce(nullif(status, ''), order_status::text, 'pending')
      where status is null or status = ''
    $sql$;

    execute $sql$
      update public.orders
      set discount_total = coalesce(nullif(discount_total, 0), discount, 0),
          coupon_discount = coalesce(nullif(coupon_discount, 0), discount, 0),
          shipping_total = coalesce(nullif(shipping_total, 0), shipping, 0),
          grand_total = coalesce(nullif(grand_total, 0), total, 0)
    $sql$;
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

create index if not exists orders_order_no_idx on public.orders(order_no);
create index if not exists orders_order_number_idx on public.orders(order_number) where order_number is not null;
create index if not exists orders_user_idx on public.orders(user_id, created_at desc);
create index if not exists orders_status_idx on public.orders(order_status, payment_status);
create index if not exists orders_status_created_idx on public.orders(status, payment_status, created_at desc);
create index if not exists orders_fraud_status_idx on public.orders(fraud_status, created_at desc);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

select
  '03_orders_backfill_indexes_triggers' as step,
  count(*) filter (where order_no is null or order_no = '') = 0 as order_no_backfilled,
  count(*) filter (where order_number is null or order_number = '') = 0 as order_number_backfilled,
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'orders' and indexname = 'orders_status_created_idx') as status_index_exists,
  exists (select 1 from pg_trigger where tgrelid = 'public.orders'::regclass and tgname = 'orders_set_updated_at') as updated_at_trigger_exists
from public.orders;
