create table if not exists public.marsoh_rejected_evidence (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid not null references public.marsoh_channels(id) on delete cascade,
  body text not null check (char_length(body) <= 2000),
  language text not null,
  category text not null,
  rule_code text not null,
  content_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists marsoh_rejected_evidence_recent_idx
  on public.marsoh_rejected_evidence(created_at desc);

alter table public.marsoh_rejected_evidence enable row level security;
revoke all on table public.marsoh_rejected_evidence from public, anon, authenticated;
grant all on table public.marsoh_rejected_evidence to service_role;

drop trigger if exists marsoh_rejected_evidence_immutable on public.marsoh_rejected_evidence;
create trigger marsoh_rejected_evidence_immutable
  before update or delete on public.marsoh_rejected_evidence
  for each row execute function public.marsoh_audit_append_only();
