create extension if not exists pgcrypto;

create table if not exists public.maritime_freight_rates (
  id uuid primary key default gen_random_uuid(),
  route text not null,
  origin text not null,
  destination text not null,
  transit_days integer not null check (transit_days > 0),
  carrier text not null,
  mode text not null check (mode in ('FCL', 'LCL', 'Ro-Ro')),
  container_type text not null,
  price_usd numeric(12, 2) not null check (price_usd >= 0),
  validity date not null,
  status text not null default 'Yeni',
  capacity text not null,
  updated_at_label text,
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.maritime_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  base text not null,
  verified boolean not null default false,
  rating numeric(3, 2) not null default 0,
  phone text not null,
  email text not null,
  website text not null,
  lanes text[] not null default '{}',
  services text[] not null default '{}',
  response_time text not null,
  active_offers integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.maritime_consultants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text not null,
  city text not null,
  experience text not null,
  rating numeric(3, 2) not null default 0,
  email text not null,
  phone text not null,
  specialties text[] not null default '{}',
  next_slot text not null,
  price_try numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.maritime_posts (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  owner text not null,
  route text not null,
  published_at_label text,
  price_usd numeric(12, 2) not null default 0,
  status text not null default 'Yayinda',
  content text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.maritime_quote_requests (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text not null,
  origin text not null,
  destination text not null,
  cargo_type text not null,
  container_type text not null,
  target_date date not null,
  budget_usd numeric(12, 2) not null default 0,
  status text not null default 'Yeni Talep',
  created_at_label text,
  created_at timestamptz not null default now()
);

create table if not exists public.maritime_support_tickets (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  owner text not null,
  priority text not null check (priority in ('Yuksek', 'Orta', 'Dusuk')),
  status text not null default 'Yeni',
  updated_at_label text,
  created_at timestamptz not null default now()
);

alter table public.maritime_freight_rates enable row level security;
alter table public.maritime_companies enable row level security;
alter table public.maritime_consultants enable row level security;
alter table public.maritime_posts enable row level security;
alter table public.maritime_quote_requests enable row level security;
alter table public.maritime_support_tickets enable row level security;

drop policy if exists "public read freight rates" on public.maritime_freight_rates;
drop policy if exists "public read companies" on public.maritime_companies;
drop policy if exists "public read consultants" on public.maritime_consultants;
drop policy if exists "public read posts" on public.maritime_posts;
drop policy if exists "public read quote requests" on public.maritime_quote_requests;
drop policy if exists "public read support tickets" on public.maritime_support_tickets;
drop policy if exists "public insert freight rates" on public.maritime_freight_rates;
drop policy if exists "public insert posts" on public.maritime_posts;
drop policy if exists "public insert quote requests" on public.maritime_quote_requests;
drop policy if exists "public insert support tickets" on public.maritime_support_tickets;

create policy "public read freight rates" on public.maritime_freight_rates for select using (true);
create policy "public read companies" on public.maritime_companies for select using (true);
create policy "public read consultants" on public.maritime_consultants for select using (true);
create policy "public read posts" on public.maritime_posts for select using (status = 'Yayinda');
create policy "public read quote requests" on public.maritime_quote_requests for select using (true);
create policy "public read support tickets" on public.maritime_support_tickets for select using (true);

create policy "public insert freight rates" on public.maritime_freight_rates for insert with check (true);
create policy "public insert posts" on public.maritime_posts for insert with check (true);
create policy "public insert quote requests" on public.maritime_quote_requests for insert with check (true);
create policy "public insert support tickets" on public.maritime_support_tickets for insert with check (true);

create index if not exists maritime_freight_rates_route_idx on public.maritime_freight_rates (route);
create index if not exists maritime_freight_rates_mode_idx on public.maritime_freight_rates (mode);
create index if not exists maritime_posts_route_idx on public.maritime_posts (route);
create index if not exists maritime_quote_requests_status_idx on public.maritime_quote_requests (status);
