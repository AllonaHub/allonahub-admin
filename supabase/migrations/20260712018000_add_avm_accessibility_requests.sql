create table if not exists public.mall_accessibility_requests (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid not null references public.mall_centers(id) on delete cascade,
  visitor_name text not null,
  service_type text not null
    check (service_type in ('wheelchair', 'guided_assistance', 'hearing_support', 'visual_support', 'family_support', 'other')),
  visit_at timestamptz not null,
  party_size integer not null default 1 check (party_size between 1 and 20),
  contact_phone text,
  contact_email text,
  meeting_point text,
  request_note text,
  consent_ack boolean not null default false,
  source_page text not null default 'avm-dunyasi' check (source_page = 'avm-dunyasi'),
  status text not null default 'new' check (status in ('new', 'confirmed', 'completed', 'cancelled', 'archived')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(visitor_name)) between 2 and 120),
  check (contact_phone is null or length(trim(contact_phone)) between 7 and 40),
  check (contact_email is null or length(trim(contact_email)) between 3 and 220),
  check (contact_phone is not null or contact_email is not null),
  check (meeting_point is null or length(trim(meeting_point)) between 2 and 180),
  check (request_note is null or length(trim(request_note)) between 2 and 1000),
  check (admin_note is null or length(trim(admin_note)) between 2 and 1000),
  check (consent_ack)
);

create index if not exists mall_accessibility_requests_operations_idx
  on public.mall_accessibility_requests(mall_id, status, visit_at, created_at desc);

drop trigger if exists mall_accessibility_requests_set_updated_at on public.mall_accessibility_requests;
create trigger mall_accessibility_requests_set_updated_at
  before update on public.mall_accessibility_requests
  for each row execute function public.set_updated_at();

alter table public.mall_accessibility_requests enable row level security;

drop policy if exists "mall_accessibility_requests_insert_public" on public.mall_accessibility_requests;
create policy "mall_accessibility_requests_insert_public"
  on public.mall_accessibility_requests for insert
  with check (
    status = 'new'
    and admin_note is null
    and consent_ack
    and visit_at >= now() + interval '55 minutes'
    and visit_at <= now() + interval '180 days'
    and exists (
      select 1
      from public.mall_centers center
      where center.id = mall_accessibility_requests.mall_id
        and center.status = 'active'
    )
  );

drop policy if exists "mall_accessibility_requests_admin_all" on public.mall_accessibility_requests;
create policy "mall_accessibility_requests_admin_all"
  on public.mall_accessibility_requests for all
  using (public.is_admin())
  with check (public.is_admin());
