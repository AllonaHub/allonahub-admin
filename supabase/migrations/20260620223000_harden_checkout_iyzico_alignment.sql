alter table public.orders
  add column if not exists partner_status text,
  add column if not exists cargo_company text,
  add column if not exists approved_at timestamptz;

update public.orders
set partner_status = case
  when partner_status in ('new', 'approved', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded') then partner_status
  when partner_status in ('pending', '') or partner_status is null then 'new'
  else 'new'
end;

alter table public.orders
  alter column partner_status set default 'new',
  alter column partner_status set not null,
  alter column cargo_company set default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_partner_status_allowed'
  ) then
    alter table public.orders
      add constraint orders_partner_status_allowed
      check (partner_status in ('new', 'approved', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded'))
      not valid;
  end if;
end $$;

create index if not exists orders_partner_status_idx
  on public.orders(partner_status, created_at desc);

comment on column public.orders.partner_status is 'Partner fulfillment state. Customer checkout defaults to new and never stores card data.';
comment on column public.orders.cargo_company is 'Cargo company selected or assigned after checkout.';
comment on column public.orders.approved_at is 'Timestamp set when a partner/admin approves the order for preparation.';
