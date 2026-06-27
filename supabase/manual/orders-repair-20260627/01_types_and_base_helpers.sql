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

do $$
begin
  create type public.order_status as enum ('pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_status as enum ('pending', 'awaiting_payment', 'paid', 'failed', 'refunded');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter type public.order_status add value if not exists 'awaiting_payment';
exception
  when undefined_object then null;
end $$;

do $$
begin
  alter type public.order_status add value if not exists 'paid';
exception
  when undefined_object then null;
end $$;

do $$
begin
  alter type public.payment_status add value if not exists 'unpaid';
exception
  when undefined_object then null;
end $$;

select
  '01_types_and_base_helpers' as step,
  to_regtype('public.order_status') is not null as order_status_exists,
  to_regtype('public.payment_status') is not null as payment_status_exists,
  to_regprocedure('public.set_updated_at()') is not null as set_updated_at_exists;
