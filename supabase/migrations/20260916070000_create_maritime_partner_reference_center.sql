create table if not exists public.maritime_employment_reference_claims (
  id uuid primary key default gen_random_uuid(),
  reference_request_id uuid references public.maritime_reference_verification_requests(id) on delete set null,
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  experience_id uuid not null,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  imo_number text not null check (imo_number ~ '^[0-9]{7}$'),
  candidate_public_id text not null,
  candidate_name text not null,
  vessel_name text not null,
  source_company_name text,
  rank_name text,
  service_start date,
  service_end date,
  service_document_id uuid references public.maritime_document_intakes(id) on delete set null,
  status text not null default 'awaiting_partner'
    check (status in ('awaiting_partner', 'partner_reviewed', 'withdrawn')),
  first_matched_at timestamptz,
  last_partner_review_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seafarer_user_id, experience_id, fingerprint),
  constraint maritime_employment_reference_service_dates_check
    check (service_end is null or service_start is null or service_end >= service_start)
);

create index if not exists maritime_employment_reference_claims_imo_idx
  on public.maritime_employment_reference_claims(imo_number, status, created_at desc);

create table if not exists public.maritime_partner_reference_reviews (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.maritime_employment_reference_claims(id) on delete cascade,
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  reviewer_user_id uuid references public.profiles(id) on delete set null,
  decision text not null check (decision in ('confirmed', 'denied', 'needs_review')),
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (claim_id, partner_id)
);

create index if not exists maritime_partner_reference_reviews_partner_idx
  on public.maritime_partner_reference_reviews(partner_id, reviewed_at desc);

create index if not exists maritime_vessel_profiles_partner_imo_idx
  on public.maritime_vessel_profiles(partner_id, imo_number, verification_status, status)
  where imo_number is not null;

drop trigger if exists maritime_employment_reference_claims_set_updated_at
  on public.maritime_employment_reference_claims;
create trigger maritime_employment_reference_claims_set_updated_at
  before update on public.maritime_employment_reference_claims
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_partner_reference_reviews_set_updated_at
  on public.maritime_partner_reference_reviews;
create trigger maritime_partner_reference_reviews_set_updated_at
  before update on public.maritime_partner_reference_reviews
  for each row execute function public.set_updated_at();

alter table public.maritime_employment_reference_claims enable row level security;
alter table public.maritime_partner_reference_reviews enable row level security;

revoke all on public.maritime_employment_reference_claims from anon, authenticated;
revoke all on public.maritime_partner_reference_reviews from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.maritime_employment_reference_claims to service_role;
    grant all on public.maritime_partner_reference_reviews to service_role;
  end if;
end
$$;

comment on table public.maritime_employment_reference_claims is
  'Private employment-reference claims matched to approved maritime partners only through verified IMO vessel profiles.';

comment on table public.maritime_partner_reference_reviews is
  'Auditable partner decisions confirming, denying, or escalating a claimed historical employment record.';

comment on column public.maritime_employment_reference_claims.candidate_name is
  'Limited partner verification identity. Contact, passport, address, birth and emergency-contact data are intentionally excluded.';
