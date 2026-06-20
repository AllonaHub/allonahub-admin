create table if not exists public.user_coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  code text not null,
  title text not null,
  discount_type text not null check (discount_type in ('fixed', 'percent')),
  discount_value numeric(12,2) not null check (discount_value >= 0),
  source text not null default 'campaign' check (source in ('campaign', 'hp_conversion')),
  status text not null default 'active' check (status in ('active', 'used', 'expired', 'cancelled')),
  assigned_at timestamptz not null default now(),
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);

create index if not exists user_coupons_user_status_idx
  on public.user_coupons(user_id, status, assigned_at desc);

drop trigger if exists user_coupons_set_updated_at on public.user_coupons;
create trigger user_coupons_set_updated_at
  before update on public.user_coupons
  for each row execute function public.set_updated_at();

alter table public.user_coupons enable row level security;

drop policy if exists "user_coupons_select_own_or_admin" on public.user_coupons;
create policy "user_coupons_select_own_or_admin"
  on public.user_coupons for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "user_coupons_insert_own_or_admin" on public.user_coupons;
create policy "user_coupons_insert_own_or_admin"
  on public.user_coupons for insert
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "user_coupons_update_own_or_admin" on public.user_coupons;
create policy "user_coupons_update_own_or_admin"
  on public.user_coupons for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
