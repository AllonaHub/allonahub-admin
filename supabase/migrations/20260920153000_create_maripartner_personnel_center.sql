create extension if not exists pgcrypto;

create table if not exists public.maritime_talent_refresh_campaigns (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  private_candidate_room_id uuid references public.maritime_private_candidate_rooms(id) on delete cascade,
  job_id uuid references public.maritime_jobs(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  filters jsonb not null default '{}'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sent', 'responded', 'expired', 'cancelled')),
  scheduled_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maritime_talent_refresh_expiry_check check (expires_at > scheduled_at)
);

create table if not exists public.maritime_talent_refresh_requests (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.maritime_talent_refresh_campaigns(id) on delete cascade,
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  candidate_room_id uuid not null references public.maritime_private_candidate_rooms(id) on delete cascade,
  notification_id uuid,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sent', 'responded', 'expired', 'cancelled')),
  response_code text
    check (response_code is null or response_code in ('available', 'unavailable', 'date_changed', 'not_interested')),
  available_from date,
  response_note text,
  response_payload jsonb not null default '{}'::jsonb,
  confirmed_fields jsonb not null default '[]'::jsonb,
  changed_fields jsonb not null default '[]'::jsonb,
  request_source text not null default 'maripartner_in_app_task',
  last_confirmed_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, seafarer_user_id)
);

create table if not exists public.maritime_evidence_templates (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  name text not null,
  hiring_stage text not null
    check (hiring_stage in ('search', 'shortlist', 'conditional_hire', 'onboarding')),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maritime_evidence_requirements (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.maritime_evidence_templates(id) on delete cascade,
  requirement_key text not null,
  label text not null,
  source_type text not null check (source_type in ('company_rule', 'official_rule')),
  official_source_url text,
  sensitivity text not null default 'metadata'
    check (sensitivity in ('metadata', 'standard', 'sensitive')),
  required boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (template_id, requirement_key),
  constraint maritime_evidence_official_source_check
    check (source_type <> 'official_rule' or official_source_url is not null)
);

create table if not exists public.maritime_evidence_requests (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  template_id uuid not null references public.maritime_evidence_templates(id) on delete restrict,
  job_id uuid references public.maritime_jobs(id) on delete set null,
  candidate_room_id uuid not null references public.maritime_private_candidate_rooms(id) on delete cascade,
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'requested'
    check (status in ('requested', 'candidate_action', 'complete', 'expired', 'cancelled')),
  requirement_snapshot jsonb not null default '[]'::jsonb,
  sensitive_access_request_id uuid references public.maritime_sensitive_access_requests(id) on delete set null,
  purpose text not null,
  candidate_consent_status text not null default 'pending'
    check (candidate_consent_status in ('pending', 'accepted', 'declined')),
  candidate_responded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maritime_hiring_sla_policies (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  stage text not null check (stage in (
    'shortlist_review', 'technical_review', 'manager_decision', 'offer_preparation',
    'candidate_response', 'joining_preparation'
  )),
  target_minutes integer not null check (target_minutes between 15 and 525600),
  primary_role text not null,
  primary_user_id uuid references public.profiles(id) on delete set null,
  backup_user_id uuid references public.profiles(id) on delete set null,
  notify_before_minutes integer not null default 60 check (notify_before_minutes >= 0),
  escalation_after_minutes integer not null default 0 check (escalation_after_minutes >= 0),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, stage)
);

create table if not exists public.maritime_hiring_sla_instances (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  policy_id uuid not null references public.maritime_hiring_sla_policies(id) on delete restrict,
  hiring_room_id uuid not null references public.maritime_hiring_rooms(id) on delete cascade,
  candidate_room_id uuid references public.maritime_private_candidate_rooms(id) on delete set null,
  stage text not null,
  status text not null default 'on_time'
    check (status in ('on_time', 'approaching', 'overdue', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  due_at timestamptz not null,
  completed_at timestamptz,
  extended_until timestamptz,
  extension_reason text,
  last_reminded_at timestamptz,
  escalated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hiring_room_id, stage, started_at)
);

create table if not exists public.maritime_hiring_case_ownership (
  hiring_room_id uuid primary key references public.maritime_hiring_rooms(id) on delete cascade,
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  backup_user_id uuid references public.profiles(id) on delete set null,
  last_completed_action text,
  waiting_party text check (waiting_party is null or waiting_party in ('company', 'candidate', 'reviewer', 'system')),
  next_action text,
  next_action_at timestamptz,
  issue_note text,
  last_candidate_contact_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id) on delete restrict
);

create table if not exists public.maritime_hiring_handovers (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  hiring_room_id uuid not null references public.maritime_hiring_rooms(id) on delete cascade,
  previous_owner_user_id uuid not null references public.profiles(id) on delete restrict,
  new_owner_user_id uuid not null references public.profiles(id) on delete restrict,
  backup_user_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  structured_summary jsonb not null default '{}'::jsonb,
  transferred_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint maritime_hiring_handover_owner_check check (previous_owner_user_id <> new_owner_user_id)
);

create table if not exists public.maritime_reviewer_passes (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  candidate_room_id uuid not null references public.maritime_private_candidate_rooms(id) on delete cascade,
  job_id uuid references public.maritime_jobs(id) on delete set null,
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  reviewer_name text not null,
  reviewer_contact_hash text not null,
  purpose text not null,
  allowed_fields jsonb not null default '[]'::jsonb,
  download_allowed boolean not null default false,
  token_hash text not null unique,
  code_hash text not null,
  max_uses integer not null default 1 check (max_uses between 1 and 20),
  use_count integer not null default 0 check (use_count >= 0),
  status text not null default 'active'
    check (status in ('active', 'used', 'expired', 'revoked', 'closed')),
  expires_at timestamptz not null,
  last_accessed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maritime_reviewer_pass_expiry_check check (expires_at > created_at)
);

create table if not exists public.maritime_reviewer_decisions (
  id uuid primary key default gen_random_uuid(),
  pass_id uuid not null references public.maritime_reviewer_passes(id) on delete cascade,
  decision text not null check (decision in ('approved', 'not_suitable', 'comment')),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists maritime_talent_refresh_partner_idx
  on public.maritime_talent_refresh_campaigns(partner_id, status, created_at desc);
create index if not exists maritime_talent_refresh_candidate_idx
  on public.maritime_talent_refresh_requests(seafarer_user_id, status, created_at desc);
create index if not exists maritime_evidence_requests_partner_idx
  on public.maritime_evidence_requests(partner_id, status, created_at desc);
create index if not exists maritime_evidence_requests_candidate_idx
  on public.maritime_evidence_requests(seafarer_user_id, status, created_at desc);
create index if not exists maritime_sla_instances_partner_due_idx
  on public.maritime_hiring_sla_instances(partner_id, status, due_at);
create index if not exists maritime_handovers_partner_case_idx
  on public.maritime_hiring_handovers(partner_id, hiring_room_id, created_at desc);
create index if not exists maritime_reviewer_passes_partner_idx
  on public.maritime_reviewer_passes(partner_id, status, expires_at);

create or replace function public.maritime_transfer_hiring_case(
  p_partner_id uuid,
  p_hiring_room_id uuid,
  p_new_owner_user_id uuid,
  p_backup_user_id uuid,
  p_reason text,
  p_summary jsonb,
  p_actor_user_id uuid
)
returns table(ownership_id uuid, handover_id uuid, previous_owner_user_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_owner uuid;
  inserted_handover uuid;
begin
  if not exists (
    select 1 from public.maritime_hiring_rooms room
    where room.id = p_hiring_room_id
      and room.partner_id = p_partner_id
      and room.status in ('active', 'paused')
  ) then
    raise exception 'HIRING_CASE_NOT_OPEN';
  end if;

  select owner_user_id into current_owner
  from public.maritime_hiring_case_ownership
  where hiring_room_id = p_hiring_room_id
  for update;

  current_owner := coalesce(current_owner, p_actor_user_id);
  if current_owner = p_new_owner_user_id then
    raise exception 'HANDOVER_OWNER_UNCHANGED';
  end if;

  insert into public.maritime_hiring_case_ownership (
    hiring_room_id, partner_id, owner_user_id, backup_user_id,
    last_completed_action, waiting_party, next_action, next_action_at,
    issue_note, last_candidate_contact_at, updated_by, updated_at
  ) values (
    p_hiring_room_id, p_partner_id, p_new_owner_user_id, p_backup_user_id,
    p_summary ->> 'last_completed_action', p_summary ->> 'waiting_party',
    p_summary ->> 'next_action', nullif(p_summary ->> 'next_action_at', '')::timestamptz,
    p_summary ->> 'issue_note', nullif(p_summary ->> 'last_candidate_contact_at', '')::timestamptz,
    p_actor_user_id, now()
  )
  on conflict (hiring_room_id) do update set
    owner_user_id = excluded.owner_user_id,
    backup_user_id = excluded.backup_user_id,
    last_completed_action = excluded.last_completed_action,
    waiting_party = excluded.waiting_party,
    next_action = excluded.next_action,
    next_action_at = excluded.next_action_at,
    issue_note = excluded.issue_note,
    last_candidate_contact_at = excluded.last_candidate_contact_at,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  insert into public.maritime_hiring_handovers (
    partner_id, hiring_room_id, previous_owner_user_id, new_owner_user_id,
    backup_user_id, reason, structured_summary, transferred_by
  ) values (
    p_partner_id, p_hiring_room_id, current_owner, p_new_owner_user_id,
    p_backup_user_id, p_reason, p_summary, p_actor_user_id
  ) returning id into inserted_handover;

  return query select p_hiring_room_id, inserted_handover, current_owner;
end;
$$;

revoke all on function public.maritime_transfer_hiring_case(uuid, uuid, uuid, uuid, text, jsonb, uuid) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.maritime_transfer_hiring_case(uuid, uuid, uuid, uuid, text, jsonb, uuid) to service_role;
  end if;
end $$;

create or replace function public.maritime_record_reviewer_decision(
  p_pass_id uuid,
  p_decision text,
  p_comment text
)
returns table(decision_id uuid, use_count integer, pass_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_pass public.maritime_reviewer_passes%rowtype;
  inserted_decision uuid;
  next_use_count integer;
  next_status text;
begin
  if p_decision not in ('approved', 'not_suitable', 'comment') then
    raise exception 'REVIEW_DECISION_INVALID';
  end if;
  if p_decision = 'comment' and nullif(btrim(p_comment), '') is null then
    raise exception 'REVIEW_COMMENT_REQUIRED';
  end if;

  select * into current_pass
  from public.maritime_reviewer_passes
  where id = p_pass_id
  for update;

  if current_pass.id is null
    or current_pass.status <> 'active'
    or current_pass.expires_at <= now()
    or current_pass.use_count >= current_pass.max_uses then
    raise exception 'REVIEW_PASS_NOT_ACTIVE';
  end if;

  insert into public.maritime_reviewer_decisions(pass_id, decision, comment)
  values (p_pass_id, p_decision, nullif(btrim(p_comment), ''))
  returning id into inserted_decision;

  next_use_count := current_pass.use_count + 1;
  next_status := case when next_use_count >= current_pass.max_uses then 'used' else 'active' end;

  update public.maritime_reviewer_passes
  set use_count = next_use_count,
      status = next_status,
      updated_at = now()
  where id = p_pass_id;

  return query select inserted_decision, next_use_count, next_status;
end;
$$;

revoke all on function public.maritime_record_reviewer_decision(uuid, text, text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.maritime_record_reviewer_decision(uuid, text, text) to service_role;
  end if;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'maritime_talent_refresh_campaigns', 'maritime_talent_refresh_requests',
    'maritime_evidence_templates', 'maritime_evidence_requirements', 'maritime_evidence_requests',
    'maritime_hiring_sla_policies', 'maritime_hiring_sla_instances',
    'maritime_hiring_case_ownership', 'maritime_hiring_handovers',
    'maritime_reviewer_passes', 'maritime_reviewer_decisions'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant all on public.%I to service_role', table_name);
    end if;
  end loop;
end $$;

comment on table public.maritime_talent_refresh_campaigns is 'Partner-scoped refresh jobs for candidates already present in an authorized private candidate room.';
comment on table public.maritime_evidence_requests is 'Minimum-necessary hiring evidence requests; sensitive access remains delegated to maritime_sensitive_access_requests.';
comment on table public.maritime_hiring_sla_instances is 'Server-time SLA state for active hiring rooms.';
comment on table public.maritime_hiring_handovers is 'Append-only recruiter handover ledger; ownership updates are executed transactionally by the API.';
comment on table public.maritime_reviewer_passes is 'Hashed, expiring, field-scoped external reviewer passes. Raw tokens and one-time codes are never stored.';
comment on function public.maritime_record_reviewer_decision(uuid, text, text) is 'Atomically records a reviewer decision and consumes one pass use under a row lock.';
