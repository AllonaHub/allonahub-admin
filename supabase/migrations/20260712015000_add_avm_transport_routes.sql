create table if not exists public.mall_transport_routes (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid not null references public.mall_centers(id) on delete cascade,
  public_id text not null,
  mode text not null check (mode in ('metro', 'bus', 'shuttle', 'minibus', 'taxi', 'walking', 'cycling')),
  title text not null,
  origin_label text not null,
  destination_label text not null,
  stop_name text,
  route_number text,
  schedule_text text,
  duration_text text,
  fare_text text,
  accessibility_text text,
  directions_text text not null,
  directions_url text,
  service_status text not null default 'operating'
    check (service_status in ('operating', 'limited', 'suspended', 'planned')),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mall_id, public_id),
  check (length(trim(public_id)) between 2 and 180),
  check (length(trim(title)) between 2 and 180),
  check (length(trim(origin_label)) between 2 and 180),
  check (length(trim(destination_label)) between 2 and 180),
  check (stop_name is null or length(trim(stop_name)) between 2 and 180),
  check (route_number is null or length(trim(route_number)) between 1 and 80),
  check (schedule_text is null or length(trim(schedule_text)) between 2 and 500),
  check (duration_text is null or length(trim(duration_text)) between 2 and 120),
  check (fare_text is null or length(trim(fare_text)) between 2 and 500),
  check (accessibility_text is null or length(trim(accessibility_text)) between 2 and 500),
  check (length(trim(directions_text)) between 2 and 1000),
  check (
    directions_url is null
    or (
      length(trim(directions_url)) <= 1000
      and trim(directions_url) ~* '^https?://[^[:space:]]+$'
    )
  ),
  check (display_order between 1 and 10000),
  check (
    status <> 'active'
    or (
      schedule_text is not null
      and directions_url is not null
      and service_status <> 'planned'
    )
  )
);

create index if not exists mall_transport_routes_mall_status_order_idx
  on public.mall_transport_routes(mall_id, status, display_order);

create index if not exists mall_transport_routes_mall_mode_service_idx
  on public.mall_transport_routes(mall_id, mode, service_status);

drop trigger if exists mall_transport_routes_set_updated_at on public.mall_transport_routes;
create trigger mall_transport_routes_set_updated_at
  before update on public.mall_transport_routes
  for each row execute function public.set_updated_at();

alter table public.mall_transport_routes enable row level security;

drop policy if exists "mall_transport_routes_read_active" on public.mall_transport_routes;
create policy "mall_transport_routes_read_active"
  on public.mall_transport_routes for select
  using (
    status = 'active'
    and exists (
      select 1
      from public.mall_centers center
      where center.id = mall_transport_routes.mall_id
        and center.status = 'active'
    )
  );

drop policy if exists "mall_transport_routes_admin_all" on public.mall_transport_routes;
create policy "mall_transport_routes_admin_all"
  on public.mall_transport_routes for all
  using (public.is_admin())
  with check (public.is_admin());
