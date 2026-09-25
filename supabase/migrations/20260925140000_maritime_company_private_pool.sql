create table if not exists public.maritime_company_private_candidates (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  full_name text not null check (length(full_name) between 2 and 160),
  rank_code text not null,
  email text,
  phone text,
  available_from date,
  vessel_type text,
  source text not null default 'company_pool' check (source = 'company_pool'),
  imported_by uuid not null references auth.users(id),
  import_batch_id uuid not null,
  import_row_number integer not null check (import_row_number between 2 and 501),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, import_batch_id, import_row_number)
);
create index if not exists maritime_company_private_candidates_partner_rank_idx on public.maritime_company_private_candidates(partner_id, rank_code, created_at desc);
alter table public.maritime_company_private_candidates enable row level security;
revoke all on public.maritime_company_private_candidates from public, anon, authenticated;
comment on table public.maritime_company_private_candidates is 'Company-owned private recruitment leads; separate from AllonaHub applications. Access only via authenticated, tenant-scoped server routes.';
