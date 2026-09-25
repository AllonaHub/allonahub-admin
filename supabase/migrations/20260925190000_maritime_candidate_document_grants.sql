create table if not exists public.maritime_candidate_document_grants (
  id uuid primary key default gen_random_uuid(),
  candidate_room_id uuid not null references public.maritime_private_candidate_rooms(id) on delete cascade,
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  purpose text not null,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  expires_at timestamptz not null,
  unique (candidate_room_id)
);

create index if not exists maritime_candidate_document_grants_candidate_idx
  on public.maritime_candidate_document_grants (seafarer_user_id, status, requested_at desc);

alter table public.maritime_candidate_document_grants enable row level security;
revoke all on public.maritime_candidate_document_grants from anon, authenticated;
grant all on public.maritime_candidate_document_grants to service_role;
