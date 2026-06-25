create extension if not exists pgcrypto;

create table if not exists public.taxi_vehicle_classes (
  service_key text primary key,
  module_scope text not null default 'allona_taksi' check (module_scope = 'allona_taksi'),
  label text not null,
  short_description text not null default '',
  base_fare numeric(12,2) not null default 0 check (base_fare >= 0),
  per_km_fare numeric(12,2) not null default 0 check (per_km_fare >= 0),
  per_min_fare numeric(12,2) not null default 0 check (per_min_fare >= 0),
  minimum_fare numeric(12,2) not null default 0 check (minimum_fare >= 0),
  reserve_fee numeric(12,2) not null default 0 check (reserve_fee >= 0),
  airport_fee numeric(12,2) not null default 0 check (airport_fee >= 0),
  surge_multiplier numeric(5,2) not null default 1 check (surge_multiplier >= 1),
  hp_rate numeric(8,2) not null default 18 check (hp_rate > 0),
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists taxi_vehicle_classes_set_updated_at on public.taxi_vehicle_classes;
create trigger taxi_vehicle_classes_set_updated_at
  before update on public.taxi_vehicle_classes
  for each row execute function public.set_updated_at();

create table if not exists public.taxi_drivers (
  id uuid primary key default gen_random_uuid(),
  module_scope text not null default 'allona_taksi' check (module_scope = 'allona_taksi'),
  profile_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  public_code text not null unique,
  phone_masked text,
  service_keys text[] not null default array['ekonomik']::text[],
  service_label text not null default 'Ekonomik',
  vehicle_make text not null default '',
  vehicle_model text not null default '',
  vehicle_color text not null default '',
  vehicle_plate text not null,
  rating numeric(3,2) not null default 4.80 check (rating >= 1 and rating <= 5),
  completed_trips integer not null default 0 check (completed_trips >= 0),
  hp_reward integer not null default 20 check (hp_reward >= 0),
  is_verified boolean not null default false,
  is_female_driver boolean not null default false,
  airport_permit boolean not null default false,
  accepts_cash boolean not null default true,
  accepts_card boolean not null default true,
  accepts_coupon boolean not null default true,
  is_public boolean not null default true,
  availability_status text not null default 'online' check (availability_status in ('online', 'busy', 'offline', 'suspended')),
  current_lat numeric(10,6) not null,
  current_lng numeric(10,6) not null,
  current_heading integer not null default 0 check (current_heading >= 0 and current_heading <= 359),
  current_speed_kmh numeric(6,2) not null default 0 check (current_speed_kmh >= 0),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists taxi_drivers_vehicle_plate_unique
  on public.taxi_drivers(vehicle_plate)
  where module_scope = 'allona_taksi';
create index if not exists taxi_drivers_public_status_idx
  on public.taxi_drivers(module_scope, is_public, availability_status, last_seen_at desc);
create index if not exists taxi_drivers_profile_idx on public.taxi_drivers(profile_id);

drop trigger if exists taxi_drivers_set_updated_at on public.taxi_drivers;
create trigger taxi_drivers_set_updated_at
  before update on public.taxi_drivers
  for each row execute function public.set_updated_at();

create table if not exists public.taxi_destinations (
  id uuid primary key default gen_random_uuid(),
  module_scope text not null default 'allona_taksi' check (module_scope = 'allona_taksi'),
  label text not null,
  short_label text not null,
  category text not null default 'city' check (category in ('city', 'airport', 'business', 'event', 'hospital', 'hotel')),
  lat numeric(10,6) not null,
  lng numeric(10,6) not null,
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists taxi_destinations_active_idx
  on public.taxi_destinations(module_scope, is_active, priority, label);

drop trigger if exists taxi_destinations_set_updated_at on public.taxi_destinations;
create trigger taxi_destinations_set_updated_at
  before update on public.taxi_destinations
  for each row execute function public.set_updated_at();

create table if not exists public.taxi_ride_requests (
  id uuid primary key default gen_random_uuid(),
  module_scope text not null default 'allona_taksi' check (module_scope = 'allona_taksi'),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  status text not null default 'requested' check (status in ('draft', 'requested', 'matched', 'arriving', 'on_trip', 'completed', 'cancelled')),
  pickup_label text not null,
  pickup_lat numeric(10,6) not null,
  pickup_lng numeric(10,6) not null,
  dropoff_label text not null,
  dropoff_lat numeric(10,6) not null,
  dropoff_lng numeric(10,6) not null,
  service_key text not null references public.taxi_vehicle_classes(service_key),
  payment_method text not null default 'allona-cash' check (payment_method in ('allona-cash', 'card', 'cash', 'coupon')),
  profile_type text not null default 'personal' check (profile_type in ('personal', 'business', 'airport')),
  reserve_at timestamptz,
  prefer_female_driver boolean not null default false,
  matched_driver_id uuid references public.taxi_drivers(id) on delete set null,
  estimated_distance_km numeric(8,2) not null default 0 check (estimated_distance_km >= 0),
  estimated_minutes integer not null default 0 check (estimated_minutes >= 0),
  fare_min numeric(12,2) not null default 0 check (fare_min >= 0),
  fare_max numeric(12,2) not null default 0 check (fare_max >= 0),
  hp_reward integer not null default 0 check (hp_reward >= 0),
  safety_pin text not null,
  safety_features jsonb not null default '{}'::jsonb,
  share_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists taxi_ride_requests_user_created_idx
  on public.taxi_ride_requests(user_id, created_at desc);
create index if not exists taxi_ride_requests_driver_status_idx
  on public.taxi_ride_requests(matched_driver_id, status, created_at desc);

drop trigger if exists taxi_ride_requests_set_updated_at on public.taxi_ride_requests;
create trigger taxi_ride_requests_set_updated_at
  before update on public.taxi_ride_requests
  for each row execute function public.set_updated_at();

create table if not exists public.taxi_ride_events (
  id uuid primary key default gen_random_uuid(),
  ride_request_id uuid not null references public.taxi_ride_requests(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists taxi_ride_events_request_created_idx
  on public.taxi_ride_events(ride_request_id, created_at desc);

alter table public.taxi_vehicle_classes enable row level security;
alter table public.taxi_drivers enable row level security;
alter table public.taxi_destinations enable row level security;
alter table public.taxi_ride_requests enable row level security;
alter table public.taxi_ride_events enable row level security;

drop policy if exists "taxi_vehicle_classes_public_select" on public.taxi_vehicle_classes;
create policy "taxi_vehicle_classes_public_select" on public.taxi_vehicle_classes
  for select to anon, authenticated
  using (module_scope = 'allona_taksi' and is_active);

drop policy if exists "taxi_vehicle_classes_admin_write" on public.taxi_vehicle_classes;
create policy "taxi_vehicle_classes_admin_write" on public.taxi_vehicle_classes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "taxi_destinations_public_select" on public.taxi_destinations;
create policy "taxi_destinations_public_select" on public.taxi_destinations
  for select to anon, authenticated
  using (module_scope = 'allona_taksi' and is_active);

drop policy if exists "taxi_destinations_admin_write" on public.taxi_destinations;
create policy "taxi_destinations_admin_write" on public.taxi_destinations
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "taxi_drivers_public_select" on public.taxi_drivers;
create policy "taxi_drivers_public_select" on public.taxi_drivers
  for select to anon, authenticated
  using (
    module_scope = 'allona_taksi'
    and is_public
    and availability_status in ('online', 'busy')
  );

drop policy if exists "taxi_drivers_partner_insert" on public.taxi_drivers;
create policy "taxi_drivers_partner_insert" on public.taxi_drivers
  for insert to authenticated
  with check (
    public.is_admin()
    or (public.is_partner_or_admin() and profile_id = auth.uid())
  );

drop policy if exists "taxi_drivers_partner_update" on public.taxi_drivers;
create policy "taxi_drivers_partner_update" on public.taxi_drivers
  for update to authenticated
  using (
    public.is_admin()
    or (public.is_partner_or_admin() and profile_id = auth.uid())
  )
  with check (
    public.is_admin()
    or (public.is_partner_or_admin() and profile_id = auth.uid())
  );

drop policy if exists "taxi_ride_requests_select_own_or_driver_or_admin" on public.taxi_ride_requests;
create policy "taxi_ride_requests_select_own_or_driver_or_admin" on public.taxi_ride_requests
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.taxi_drivers d
      where d.id = taxi_ride_requests.matched_driver_id
        and d.profile_id = auth.uid()
    )
  );

drop policy if exists "taxi_ride_requests_insert_own" on public.taxi_ride_requests;
create policy "taxi_ride_requests_insert_own" on public.taxi_ride_requests
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "taxi_ride_requests_update_own_or_driver_or_admin" on public.taxi_ride_requests;
create policy "taxi_ride_requests_update_own_or_driver_or_admin" on public.taxi_ride_requests
  for update to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.taxi_drivers d
      where d.id = taxi_ride_requests.matched_driver_id
        and d.profile_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.taxi_drivers d
      where d.id = taxi_ride_requests.matched_driver_id
        and d.profile_id = auth.uid()
    )
  );

drop policy if exists "taxi_ride_events_select_related" on public.taxi_ride_events;
create policy "taxi_ride_events_select_related" on public.taxi_ride_events
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.taxi_ride_requests r
      left join public.taxi_drivers d on d.id = r.matched_driver_id
      where r.id = taxi_ride_events.ride_request_id
        and (r.user_id = auth.uid() or d.profile_id = auth.uid())
    )
  );

drop policy if exists "taxi_ride_events_insert_related" on public.taxi_ride_events;
create policy "taxi_ride_events_insert_related" on public.taxi_ride_events
  for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.taxi_ride_requests r
      left join public.taxi_drivers d on d.id = r.matched_driver_id
      where r.id = taxi_ride_events.ride_request_id
        and (r.user_id = auth.uid() or d.profile_id = auth.uid())
    )
  );

create or replace function public.create_taxi_ride_request(
  p_pickup_label text,
  p_pickup_lat numeric,
  p_pickup_lng numeric,
  p_dropoff_label text,
  p_dropoff_lat numeric,
  p_dropoff_lng numeric,
  p_service_key text,
  p_payment_method text,
  p_profile_type text,
  p_reserve_at timestamptz,
  p_prefer_female_driver boolean,
  p_matched_driver_id uuid,
  p_estimated_distance_km numeric,
  p_estimated_minutes integer,
  p_fare_min numeric,
  p_fare_max numeric,
  p_hp_reward integer,
  p_safety_features jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.taxi_ride_requests;
  v_pin text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.taxi_vehicle_classes
    where service_key = p_service_key
      and module_scope = 'allona_taksi'
      and is_active
  ) then
    raise exception 'Invalid taxi service';
  end if;

  v_pin := lpad((floor(random() * 9000)::int + 1000)::text, 4, '0');

  insert into public.taxi_ride_requests (
    user_id,
    pickup_label,
    pickup_lat,
    pickup_lng,
    dropoff_label,
    dropoff_lat,
    dropoff_lng,
    service_key,
    payment_method,
    profile_type,
    reserve_at,
    prefer_female_driver,
    matched_driver_id,
    estimated_distance_km,
    estimated_minutes,
    fare_min,
    fare_max,
    hp_reward,
    safety_pin,
    safety_features,
    status
  )
  values (
    v_user_id,
    left(coalesce(p_pickup_label, ''), 240),
    p_pickup_lat,
    p_pickup_lng,
    left(coalesce(p_dropoff_label, ''), 240),
    p_dropoff_lat,
    p_dropoff_lng,
    p_service_key,
    coalesce(p_payment_method, 'allona-cash'),
    coalesce(p_profile_type, 'personal'),
    p_reserve_at,
    coalesce(p_prefer_female_driver, false),
    p_matched_driver_id,
    greatest(coalesce(p_estimated_distance_km, 0), 0),
    greatest(coalesce(p_estimated_minutes, 0), 0),
    greatest(coalesce(p_fare_min, 0), 0),
    greatest(coalesce(p_fare_max, 0), 0),
    greatest(coalesce(p_hp_reward, 0), 0),
    v_pin,
    coalesce(p_safety_features, '{}'::jsonb),
    case when p_matched_driver_id is null then 'requested' else 'matched' end
  )
  returning * into v_request;

  insert into public.taxi_ride_events (ride_request_id, actor_user_id, event_type, event_payload)
  values (
    v_request.id,
    v_user_id,
    'ride_requested',
    jsonb_build_object(
      'service_key', v_request.service_key,
      'matched_driver_id', v_request.matched_driver_id,
      'fare_min', v_request.fare_min,
      'fare_max', v_request.fare_max
    )
  );

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'safety_pin', v_request.safety_pin,
    'share_token', v_request.share_token,
    'matched_driver_id', v_request.matched_driver_id,
    'fare_min', v_request.fare_min,
    'fare_max', v_request.fare_max,
    'hp_reward', v_request.hp_reward
  );
end;
$$;

revoke all on function public.create_taxi_ride_request(
  text, numeric, numeric, text, numeric, numeric, text, text, text, timestamptz,
  boolean, uuid, numeric, integer, numeric, numeric, integer, jsonb
) from public;
grant execute on function public.create_taxi_ride_request(
  text, numeric, numeric, text, numeric, numeric, text, text, text, timestamptz,
  boolean, uuid, numeric, integer, numeric, numeric, integer, jsonb
) to authenticated;

insert into public.taxi_vehicle_classes (
  service_key,
  label,
  short_description,
  base_fare,
  per_km_fare,
  per_min_fare,
  minimum_fare,
  reserve_fee,
  airport_fee,
  surge_multiplier,
  hp_rate,
  sort_order
)
values
  ('ekonomik', 'Ekonomik', 'Uygun fiyatlı şehir içi yolculuk', 72, 21, 2.90, 110, 45, 0, 1.00, 18, 10),
  ('konfor', 'Konfor', 'Geniş araç ve yüksek puanlı sürücüler', 95, 27, 3.40, 145, 55, 0, 1.18, 16, 20),
  ('vip', 'VIP', 'Premium araç, havalimanı ve özel transfer', 170, 42, 5.20, 260, 85, 80, 1.55, 12, 30),
  ('aile', 'Aile', 'Bagaj ve çocuklu yolculuklara uygun araç', 110, 29, 3.70, 165, 60, 0, 1.24, 15, 40)
on conflict (service_key) do update
set label = excluded.label,
    short_description = excluded.short_description,
    base_fare = excluded.base_fare,
    per_km_fare = excluded.per_km_fare,
    per_min_fare = excluded.per_min_fare,
    minimum_fare = excluded.minimum_fare,
    reserve_fee = excluded.reserve_fee,
    airport_fee = excluded.airport_fee,
    surge_multiplier = excluded.surge_multiplier,
    hp_rate = excluded.hp_rate,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

insert into public.taxi_drivers (
  id,
  display_name,
  public_code,
  phone_masked,
  service_keys,
  service_label,
  vehicle_make,
  vehicle_model,
  vehicle_color,
  vehicle_plate,
  rating,
  completed_trips,
  hp_reward,
  is_verified,
  is_female_driver,
  airport_permit,
  availability_status,
  current_lat,
  current_lng,
  current_heading,
  current_speed_kmh,
  last_seen_at
)
values
  ('11111111-1111-4111-8111-111111111104', 'Ahmet K.', 'AT-104', '+90 532 *** 10 04', array['ekonomik','aile'], 'Ekonomik', 'Toyota', 'Corolla Hybrid', 'Beyaz', '34 AT 104', 4.90, 1482, 20, true, false, true, 'online', 41.014600, 28.976700, 84, 18, now()),
  ('11111111-1111-4111-8111-111111111218', 'Mehmet A.', 'AT-218', '+90 532 *** 21 18', array['konfor','aile'], 'Konfor', 'Skoda', 'Superb', 'Siyah', '34 AH 218', 4.80, 1194, 25, true, false, true, 'online', 41.004800, 28.989600, 205, 12, now()),
  ('11111111-1111-4111-8111-111111111331', 'Selin T.', 'AT-331', '+90 532 *** 33 10', array['ekonomik','konfor'], 'Kadın Sürücü', 'Hyundai', 'Ioniq', 'Mavi', '34 AL 331', 5.00, 934, 30, true, true, false, 'online', 41.018200, 28.966000, 28, 15, now()),
  ('11111111-1111-4111-8111-111111111442', 'VIP Transfer', 'AT-442', '+90 532 *** 44 20', array['vip'], 'VIP', 'Mercedes', 'Vito', 'Siyah', '34 VIP 442', 5.00, 621, 50, true, false, true, 'busy', 41.032800, 28.983900, 145, 9, now()),
  ('11111111-1111-4111-8111-111111111509', 'Allona 509', 'AT-509', '+90 532 *** 50 09', array['aile','konfor'], 'Aile', 'Volkswagen', 'Caddy', 'Gri', '34 AIL 509', 4.80, 802, 24, true, false, false, 'online', 40.998700, 28.972800, 305, 11, now()),
  ('11111111-1111-4111-8111-111111111612', 'Derya M.', 'AT-612', '+90 532 *** 61 20', array['konfor','vip'], 'Kadın Konfor', 'BMW', 'iX1', 'Lacivert', '34 DRY 612', 4.90, 718, 34, true, true, true, 'online', 41.011200, 28.954600, 64, 16, now())
on conflict (id) do update
set display_name = excluded.display_name,
    phone_masked = excluded.phone_masked,
    service_keys = excluded.service_keys,
    service_label = excluded.service_label,
    vehicle_make = excluded.vehicle_make,
    vehicle_model = excluded.vehicle_model,
    vehicle_color = excluded.vehicle_color,
    vehicle_plate = excluded.vehicle_plate,
    rating = excluded.rating,
    completed_trips = excluded.completed_trips,
    hp_reward = excluded.hp_reward,
    is_verified = excluded.is_verified,
    is_female_driver = excluded.is_female_driver,
    airport_permit = excluded.airport_permit,
    availability_status = excluded.availability_status,
    current_lat = excluded.current_lat,
    current_lng = excluded.current_lng,
    current_heading = excluded.current_heading,
    current_speed_kmh = excluded.current_speed_kmh,
    last_seen_at = excluded.last_seen_at,
    is_public = true,
    updated_at = now();

insert into public.taxi_destinations (id, label, short_label, category, lat, lng, priority)
values
  ('22222222-2222-4222-8222-222222222001', 'Taksim Meydanı', 'Taksim', 'city', 41.036900, 28.985000, 10),
  ('22222222-2222-4222-8222-222222222002', 'Kadıköy İskele', 'Kadıköy', 'city', 40.990300, 29.022000, 20),
  ('22222222-2222-4222-8222-222222222003', 'Zorlu Center', 'Zorlu', 'business', 41.067700, 29.017300, 30),
  ('22222222-2222-4222-8222-222222222004', 'İstanbul Havalimanı', 'Havalimanı', 'airport', 41.275300, 28.751900, 40),
  ('22222222-2222-4222-8222-222222222005', 'Sabiha Gökçen Havalimanı', 'Sabiha', 'airport', 40.898600, 29.309200, 50),
  ('22222222-2222-4222-8222-222222222006', 'Maslak İş Merkezi', 'Maslak', 'business', 41.109900, 29.020400, 60)
on conflict (id) do update
set label = excluded.label,
    short_label = excluded.short_label,
    category = excluded.category,
    lat = excluded.lat,
    lng = excluded.lng,
    priority = excluded.priority,
    is_active = true,
    updated_at = now();
