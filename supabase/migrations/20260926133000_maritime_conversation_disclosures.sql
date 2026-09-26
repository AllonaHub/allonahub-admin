create table if not exists public.maritime_conversation_disclosures (
  candidate_room_id uuid primary key references public.maritime_private_candidate_rooms(id) on delete cascade,
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  visible_fields text[] not null default '{}',
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  constraint maritime_conversation_disclosures_fields_check check (
    visible_fields <@ array['vessel_type','flag_state','deadweight_tonnage','gross_tonnage','trading_area','joining_port','vessel_name','imo_number','current_port','next_port']::text[]
  )
);

alter table public.maritime_conversation_disclosures enable row level security;
revoke all on public.maritime_conversation_disclosures from public, anon, authenticated;
grant all on public.maritime_conversation_disclosures to service_role;
