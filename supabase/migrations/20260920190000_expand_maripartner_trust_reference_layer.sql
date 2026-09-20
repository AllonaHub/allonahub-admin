create extension if not exists pgcrypto;

-- Company identity and recruiter authority are time-bound. Partner account status alone
-- must never be treated as authority to create a verified employer reference.
create table if not exists public.maritime_company_verification_cycles (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','in_review','verified','changes_requested','rejected','expired','revoked')),
  verification_level text not null default 'identity' check (verification_level in ('identity','registry','enhanced')),
  evidence_snapshot jsonb not null default '{}'::jsonb,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  expires_at timestamptz,
  supersedes_id uuid references public.maritime_company_verification_cycles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maritime_company_verification_expiry check (expires_at is null or expires_at > created_at)
);

create table if not exists public.maritime_recruiter_authorities (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  authority_scope text[] not null default array['hiring']::text[],
  status text not null default 'pending' check (status in ('pending','active','suspended','expired','revoked')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, user_id),
  constraint maritime_recruiter_authority_expiry check (expires_at is null or expires_at > created_at)
);

insert into public.maritime_company_verification_cycles (
  partner_id, status, verification_level, evidence_snapshot, verified_at, expires_at
)
select business.id, 'verified', 'identity', '{"source":"existing_verified_partner_migration"}'::jsonb,
       now(), now() + interval '365 days'
from public.partner_businesses business
where business.partner_type = 'maritime'
  and business.status = 'active'
  and business.verification_status = 'verified'
  and not exists (
    select 1 from public.maritime_company_verification_cycles cycle
    where cycle.partner_id = business.id and cycle.status = 'verified' and (cycle.expires_at is null or cycle.expires_at > now())
  );

insert into public.maritime_recruiter_authorities (
  partner_id, user_id, authority_scope, status, approved_at, expires_at
)
select business.id, business.owner_id, array['hiring','employment_reference']::text[], 'active', now(), now() + interval '365 days'
from public.partner_businesses business
where business.partner_type = 'maritime'
  and business.status = 'active'
  and business.verification_status = 'verified'
on conflict (partner_id, user_id) do nothing;

create table if not exists public.maritime_vessel_company_relationships (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  vessel_profile_id uuid references public.maritime_vessel_profiles(id) on delete set null,
  imo_number text not null check (imo_number ~ '^[0-9]{7}$'),
  company_name text,
  relationship_role text not null check (relationship_role in ('owner','manager','operator','crewing_agent','employer','authorized_representative')),
  valid_from date,
  valid_until date,
  verification_status text not null default 'partner_asserted' check (verification_status in ('partner_asserted','registry_verified','admin_verified','disputed','rejected','revoked')),
  evidence_assertion_id uuid,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maritime_vessel_company_dates check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

create table if not exists public.maritime_evidence_assertions (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('company','recruiter','vessel','sea_service','reference','candidate')),
  subject_id uuid not null,
  assertion_key text not null,
  asserted_value jsonb not null default '{}'::jsonb,
  source_type text not null check (source_type in ('user_input','uploaded_document','company_attestation','registry','admin_review','system_derivation')),
  source_reference_hash text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','pending','verified','conflicted','rejected','expired','revoked')),
  confidence numeric(5,2) check (confidence is null or confidence between 0 and 100),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.maritime_vessel_company_relationships
  drop constraint if exists maritime_vessel_company_relationships_evidence_assertion_id_fkey;
alter table public.maritime_vessel_company_relationships
  add constraint maritime_vessel_company_relationships_evidence_assertion_id_fkey
  foreign key (evidence_assertion_id) references public.maritime_evidence_assertions(id) on delete set null;

create table if not exists public.maritime_verification_checks (
  id uuid primary key default gen_random_uuid(),
  assertion_id uuid not null references public.maritime_evidence_assertions(id) on delete cascade,
  check_type text not null check (check_type in ('format','cross_source','registry','human_review','expiry','duplicate','conflict')),
  result text not null check (result in ('passed','failed','inconclusive','not_available')),
  reason_code text not null,
  explanation text,
  provider text,
  checked_by uuid references public.profiles(id) on delete set null,
  checked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.maritime_employer_reference_matches (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.maritime_employment_reference_claims(id) on delete cascade,
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  relationship_id uuid references public.maritime_vessel_company_relationships(id) on delete set null,
  match_level text not null check (match_level in ('exact_verified','strong_match','possible_match','conflict','rejected')),
  confidence numeric(5,2) not null check (confidence between 0 and 100),
  reason_codes jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','superseded')),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (claim_id, partner_id)
);

create table if not exists public.maritime_employer_references (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.maritime_employer_reference_matches(id) on delete restrict,
  claim_id uuid not null references public.maritime_employment_reference_claims(id) on delete restrict,
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','submitted','automated_screening','needs_review','approved','rejected','withdrawn','superseded','expired')),
  version_number integer not null default 1 check (version_number > 0),
  comment text check (comment is null or char_length(comment) <= 2000),
  average_score numeric(4,2) check (average_score is null or average_score between 1 and 10),
  high_impact_negative boolean not null default false,
  requires_second_review boolean not null default false,
  first_reviewed_by uuid references public.profiles(id) on delete set null,
  first_reviewed_at timestamptz,
  second_reviewed_by uuid references public.profiles(id) on delete set null,
  second_reviewed_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, version_number),
  constraint maritime_employer_reference_second_reviewer check (second_reviewed_by is null or second_reviewed_by <> first_reviewed_by),
  constraint maritime_employer_reference_high_impact_guard check (status <> 'approved' or requires_second_review = false or second_reviewed_by is not null)
);

create table if not exists public.maritime_employer_reference_ratings (
  reference_id uuid not null references public.maritime_employer_references(id) on delete cascade,
  category_key text not null check (category_key in ('professional_competence','safety_awareness','rule_compliance','teamwork','communication','reliability','punctuality','problem_solving','leadership','technical_knowledge','equipment_care','watchkeeping','stress_management','adaptability','rehire_willingness')),
  score smallint check (score between 1 and 10),
  not_applicable boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (reference_id, category_key),
  constraint maritime_reference_rating_value check ((not_applicable and score is null) or (not not_applicable and score is not null))
);

create table if not exists public.maritime_employer_reference_answers (
  reference_id uuid not null references public.maritime_employer_references(id) on delete cascade,
  question_key text not null check (question_key in ('employment_confirmed','rank_confirmed','service_dates_confirmed','completed_contract','eligible_for_rehire')),
  answer text not null check (answer in ('yes','no','unknown')),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  primary key (reference_id, question_key)
);

create table if not exists public.maritime_employer_reference_versions (
  id uuid primary key default gen_random_uuid(),
  reference_id uuid not null references public.maritime_employer_references(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  snapshot_hash text not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  snapshot jsonb not null,
  change_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (reference_id, version_number)
);

create table if not exists public.maritime_employer_reference_moderation (
  id uuid primary key default gen_random_uuid(),
  reference_id uuid not null references public.maritime_employer_references(id) on delete cascade,
  stage text not null check (stage in ('automated_screening','first_review','second_review','appeal_review')),
  decision text not null check (decision in ('pending','approved','rejected','needs_changes','escalated')),
  rule_codes jsonb not null default '[]'::jsonb,
  explanation text,
  reviewer_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.maritime_employer_reference_access_logs (
  id uuid primary key default gen_random_uuid(),
  reference_id uuid not null references public.maritime_employer_references(id) on delete cascade,
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('list','view_summary','view_detail','create','submit','withdraw','moderate','dispute')),
  purpose text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.maritime_employer_reference_disputes (
  id uuid primary key default gen_random_uuid(),
  reference_id uuid not null references public.maritime_employer_references(id) on delete restrict,
  opened_by_partner_id uuid references public.partner_businesses(id) on delete set null,
  opened_by_user_id uuid references public.profiles(id) on delete set null,
  reason text not null check (char_length(trim(reason)) between 12 and 2000),
  status text not null default 'open' check (status in ('open','triage','awaiting_evidence','resolved','rejected','closed')),
  resolution text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maritime_partner_notifications (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  recipient_user_id uuid references public.profiles(id) on delete set null,
  notification_type text not null,
  title text not null,
  message text not null,
  resource_type text,
  resource_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

-- Explainable decision and user-controlled automation records.
create table if not exists public.maritime_match_evaluations (
  id uuid primary key default gen_random_uuid(),
  match_result_id uuid references public.maritime_match_results(id) on delete cascade,
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  decision text not null check (decision in ('eligible','ineligible','needs_data','manual_override')),
  reason_codes jsonb not null default '[]'::jsonb,
  explanation text not null,
  rule_version text not null,
  overridden_by uuid references public.profiles(id) on delete set null,
  override_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.maritime_sea_service_conflicts (
  id uuid primary key default gen_random_uuid(),
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  left_relationship_id uuid references public.maritime_work_relationships(id) on delete cascade,
  right_relationship_id uuid references public.maritime_work_relationships(id) on delete cascade,
  conflict_type text not null check (conflict_type in ('date_overlap','imo_mismatch','rank_mismatch','company_mismatch','duplicate_claim','source_conflict')),
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','triage','resolved','dismissed')),
  reason_codes jsonb not null default '[]'::jsonb,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint maritime_sea_service_conflict_distinct check (left_relationship_id is null or right_relationship_id is null or left_relationship_id <> right_relationship_id)
);

create table if not exists public.maritime_decision_records (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.partner_businesses(id) on delete cascade,
  seafarer_user_id uuid references public.profiles(id) on delete cascade,
  decision_type text not null check (decision_type in ('match','shortlist','interview','reference','offer','automation')),
  decision text not null,
  reason_codes jsonb not null default '[]'::jsonb,
  explanation text not null,
  input_snapshot_hash text check (input_snapshot_hash is null or input_snapshot_hash ~ '^[0-9a-f]{64}$'),
  rule_version text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  overridden boolean not null default false,
  override_reason text,
  created_at timestamptz not null default now(),
  constraint maritime_decision_override_reason check (not overridden or nullif(btrim(override_reason), '') is not null)
);

create table if not exists public.maritime_automation_policies (
  id uuid primary key default gen_random_uuid(),
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null default 'off' check (mode in ('off','prepare_only','apply_with_consent')),
  allowed_rank_codes jsonb not null default '[]'::jsonb,
  allowed_vessel_types jsonb not null default '[]'::jsonb,
  daily_limit integer not null default 0 check (daily_limit between 0 and 100),
  requires_material_change_confirmation boolean not null default true,
  consent_receipt_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seafarer_user_id)
);

create table if not exists public.maritime_automation_executions (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.maritime_automation_policies(id) on delete cascade,
  job_id uuid not null references public.maritime_jobs(id) on delete cascade,
  match_evaluation_id uuid references public.maritime_match_evaluations(id) on delete set null,
  idempotency_key text not null unique,
  action text not null check (action in ('prepared','submitted','skipped','blocked','withdrawn')),
  reason_codes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.maritime_consent_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null,
  policy_version text not null,
  scope jsonb not null default '{}'::jsonb,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  receipt_hash text not null unique check (receipt_hash ~ '^[0-9a-f]{64}$')
);

alter table public.maritime_automation_policies
  drop constraint if exists maritime_automation_policies_consent_receipt_id_fkey;
alter table public.maritime_automation_policies
  add constraint maritime_automation_policies_consent_receipt_id_fkey
  foreign key (consent_receipt_id) references public.maritime_consent_receipts(id) on delete set null;

create table if not exists public.maritime_trust_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.maritime_trust_cases(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  actor_user_id uuid references public.profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.maritime_trust_appeals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.maritime_trust_cases(id) on delete restrict,
  appellant_user_id uuid references public.profiles(id) on delete set null,
  appellant_partner_id uuid references public.partner_businesses(id) on delete set null,
  reason text not null check (char_length(trim(reason)) between 12 and 2000),
  status text not null default 'submitted' check (status in ('submitted','triage','in_review','upheld','overturned','closed')),
  reviewer_user_id uuid references public.profiles(id) on delete set null,
  second_reviewer_user_id uuid references public.profiles(id) on delete set null,
  decision_reason text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint maritime_trust_appeal_distinct_reviewers check (second_reviewer_user_id is null or second_reviewer_user_id <> reviewer_user_id)
);

create table if not exists public.maritime_data_rights_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references public.profiles(id) on delete cascade,
  request_type text not null check (request_type in ('access','export','correction','restriction','deletion')),
  status text not null default 'submitted' check (status in ('submitted','identity_check','in_progress','completed','partially_denied','denied','cancelled')),
  legal_hold_applied boolean not null default false,
  due_at timestamptz not null default (now() + interval '30 days'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maritime_legal_holds (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid not null,
  reason text not null,
  status text not null default 'active' check (status in ('active','released')),
  created_by uuid references public.profiles(id) on delete set null,
  released_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  released_at timestamptz
);

create table if not exists public.maritime_interview_template_versions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  template_key text not null,
  version_number integer not null check (version_number > 0),
  title text not null,
  questions jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','active','retired')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (partner_id, template_key, version_number)
);

create table if not exists public.maritime_interview_reviews (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.maritime_interviews(id) on delete cascade,
  template_version_id uuid not null references public.maritime_interview_template_versions(id) on delete restrict,
  reviewer_user_id uuid references public.profiles(id) on delete set null,
  answers jsonb not null default '{}'::jsonb,
  recommendation text check (recommendation in ('advance','hold','decline','second_review')),
  quality_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.maritime_integration_connections (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  provider_key text not null,
  connection_type text not null check (connection_type in ('import','webhook','readonly_query')),
  status text not null default 'disabled' check (status in ('disabled','pending','active','error','revoked')),
  feature_flag text not null,
  credential_reference text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, provider_key, connection_type)
);

create table if not exists public.maritime_import_jobs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references public.maritime_integration_connections(id) on delete set null,
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  status text not null default 'preview' check (status in ('preview','validated','importing','completed','failed','cancelled')),
  row_count integer not null default 0 check (row_count >= 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  validation_report jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.maritime_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.maritime_integration_connections(id) on delete cascade,
  event_key text not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'queued' check (status in ('queued','sending','delivered','failed','dead_letter')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.maritime_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.partner_businesses(id) on delete cascade,
  metric_key text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  metric_value numeric not null,
  dimensions jsonb not null default '{}'::jsonb,
  source_version text not null,
  created_at timestamptz not null default now(),
  constraint maritime_metric_period check (period_end > period_start)
);

create index if not exists maritime_company_verification_partner_idx on public.maritime_company_verification_cycles(partner_id,status,expires_at desc);
create index if not exists maritime_recruiter_authority_partner_idx on public.maritime_recruiter_authorities(partner_id,user_id,status,expires_at);
create index if not exists maritime_vessel_company_history_idx on public.maritime_vessel_company_relationships(partner_id,imo_number,valid_from,valid_until);
create index if not exists maritime_reference_matches_partner_idx on public.maritime_employer_reference_matches(partner_id,status,match_level,created_at desc);
create index if not exists maritime_employer_references_partner_idx on public.maritime_employer_references(partner_id,status,created_at desc);
create index if not exists maritime_employer_references_seafarer_idx on public.maritime_employer_references(seafarer_user_id,status,approved_at desc);
create index if not exists maritime_reference_moderation_queue_idx on public.maritime_employer_reference_moderation(decision,stage,created_at);
create index if not exists maritime_reference_access_idx on public.maritime_employer_reference_access_logs(reference_id,created_at desc);
create index if not exists maritime_partner_notifications_idx on public.maritime_partner_notifications(partner_id,is_read,created_at desc);
create index if not exists maritime_match_evaluations_partner_idx on public.maritime_match_evaluations(partner_id,seafarer_user_id,created_at desc);
create index if not exists maritime_sea_service_conflicts_user_idx on public.maritime_sea_service_conflicts(seafarer_user_id,status,severity,created_at desc);
create index if not exists maritime_decision_records_partner_idx on public.maritime_decision_records(partner_id,decision_type,created_at desc);
create index if not exists maritime_trust_appeals_status_idx on public.maritime_trust_appeals(status,created_at desc);
create index if not exists maritime_metric_snapshots_partner_idx on public.maritime_metric_snapshots(partner_id,metric_key,period_end desc);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'maritime_company_verification_cycles','maritime_recruiter_authorities','maritime_vessel_company_relationships',
    'maritime_evidence_assertions','maritime_verification_checks','maritime_employer_reference_matches',
    'maritime_employer_references','maritime_employer_reference_ratings','maritime_employer_reference_answers',
    'maritime_employer_reference_versions','maritime_employer_reference_moderation','maritime_employer_reference_access_logs',
    'maritime_employer_reference_disputes','maritime_partner_notifications','maritime_match_evaluations','maritime_sea_service_conflicts','maritime_decision_records','maritime_automation_policies',
    'maritime_automation_executions','maritime_consent_receipts','maritime_trust_case_events',
    'maritime_trust_appeals','maritime_data_rights_requests','maritime_legal_holds',
    'maritime_interview_template_versions','maritime_interview_reviews','maritime_integration_connections',
    'maritime_import_jobs','maritime_webhook_deliveries','maritime_metric_snapshots'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant all on public.%I to service_role', table_name);
    end if;
  end loop;
end $$;

create or replace function public.maritime_guard_reference_approval()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    if new.high_impact_negative and (new.second_reviewed_by is null or new.second_reviewed_by = new.first_reviewed_by) then
      raise exception 'MARITIME_REFERENCE_SECOND_REVIEW_REQUIRED';
    end if;
    if not exists (
      select 1 from public.maritime_employer_reference_matches m
      where m.id = new.match_id and m.partner_id = new.partner_id and m.status = 'accepted'
        and m.match_level in ('exact_verified','strong_match')
    ) then
      raise exception 'MARITIME_REFERENCE_VERIFIED_RELATIONSHIP_REQUIRED';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists maritime_guard_reference_approval_trigger on public.maritime_employer_references;
create trigger maritime_guard_reference_approval_trigger
  before update of status on public.maritime_employer_references
  for each row execute function public.maritime_guard_reference_approval();

revoke all on function public.maritime_guard_reference_approval() from public, anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'maritime_company_verification_cycles','maritime_recruiter_authorities','maritime_vessel_company_relationships',
    'maritime_evidence_assertions','maritime_employer_reference_matches','maritime_employer_references',
    'maritime_employer_reference_disputes','maritime_automation_policies','maritime_data_rights_requests',
    'maritime_integration_connections'
  ] loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_set_updated_at', table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', table_name || '_set_updated_at', table_name);
  end loop;
end $$;

comment on table public.maritime_employer_references is 'Company-only, moderated and versioned employer references. Never project to candidate, CV or public endpoints.';
comment on table public.maritime_vessel_company_relationships is 'Historical vessel-company authority windows; current ownership alone is insufficient for former-worker matching.';
comment on table public.maritime_employer_reference_access_logs is 'Append-only access trail for every private employer-reference read and decision.';
comment on function public.maritime_guard_reference_approval() is 'Database guard requiring an accepted historical match and an independent second reviewer for high-impact negative references.';
