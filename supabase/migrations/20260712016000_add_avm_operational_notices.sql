create table if not exists public.mall_operational_notices (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid not null references public.mall_centers(id) on delete cascade,
  public_id text not null,
  notice_type text not null check (notice_type in ('general', 'access', 'transport', 'parking', 'service', 'event')),
  severity text not null default 'info' check (severity in ('info', 'advisory', 'urgent')),
  title text not null,
  summary text not null,
  affected_area text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  cta_label text,
  cta_url text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mall_id, public_id),
  check (length(trim(public_id)) between 2 and 180),
  check (length(trim(title)) between 2 and 180),
  check (length(trim(summary)) between 2 and 1000),
  check (affected_area is null or length(trim(affected_area)) between 2 and 300),
  check (ends_at > starts_at),
  check (
    (cta_label is null and cta_url is null)
    or (
      length(trim(cta_label)) between 2 and 80
      and length(trim(cta_url)) <= 1000
      and trim(cta_url) ~* '^https?://[^[:space:]]+$'
    )
  ),
  check (display_order between 1 and 10000)
);

create index if not exists mall_operational_notices_active_window_idx
  on public.mall_operational_notices(mall_id, status, starts_at, ends_at, display_order);

drop trigger if exists mall_operational_notices_set_updated_at on public.mall_operational_notices;
create trigger mall_operational_notices_set_updated_at
  before update on public.mall_operational_notices
  for each row execute function public.set_updated_at();

alter table public.mall_operational_notices enable row level security;

drop policy if exists "mall_operational_notices_read_current" on public.mall_operational_notices;
create policy "mall_operational_notices_read_current"
  on public.mall_operational_notices for select
  using (
    status = 'active'
    and starts_at <= now()
    and ends_at >= now()
    and exists (
      select 1 from public.mall_centers center
      where center.id = mall_operational_notices.mall_id
        and center.status = 'active'
    )
  );

drop policy if exists "mall_operational_notices_admin_all" on public.mall_operational_notices;
create policy "mall_operational_notices_admin_all"
  on public.mall_operational_notices for all
  using (public.is_admin())
  with check (public.is_admin());
