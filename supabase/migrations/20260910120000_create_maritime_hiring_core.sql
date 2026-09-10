create extension if not exists pgcrypto;

create table if not exists public.maritime_seafarer_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references public.profiles(id) on delete cascade,
  workspace_status text not null default 'active'
    check (workspace_status in ('draft', 'active', 'paused', 'restricted', 'archived')),
  current_work_status text not null default 'unknown'
    check (current_work_status in ('unknown', 'available_now', 'available_from_date', 'onboard', 'on_leave', 'not_available')),
  availability_status text not null default 'unknown'
    check (availability_status in ('unknown', 'fresh', 'stale', 'expired', 'blocked')),
  availability_confirmed_at timestamptz,
  availability_stale_after timestamptz,
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  readiness_level text not null default 'unverified'
    check (readiness_level in ('unverified', 'draft', 'ready_review', 'verified_ready', 'blocked')),
  pro_membership_status text not null default 'none'
    check (pro_membership_status in ('none', 'trial', 'active', 'past_due', 'cancelled')),
  verified_gold_status text not null default 'none'
    check (verified_gold_status in ('none', 'pending_review', 'verified', 'expired', 'revoked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maritime_readiness_passports (
  id uuid primary key default gen_random_uuid(),
  seafarer_user_id uuid not null unique references public.profiles(id) on delete cascade,
  passport_status text not null default 'draft'
    check (passport_status in ('draft', 'user_confirmed', 'verification_pending', 'verified', 'stale', 'suspended', 'archived')),
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  current_work_status text not null default 'unknown'
    check (current_work_status in ('unknown', 'available_now', 'available_from_date', 'onboard', 'on_leave', 'not_available')),
  availability_status text not null default 'unknown'
    check (availability_status in ('unknown', 'fresh', 'stale', 'expired', 'blocked')),
  passport_version integer not null default 1 check (passport_version > 0),
  published_snapshot_hash text,
  last_user_confirmed_at timestamptz,
  last_verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maritime_readiness_items (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.maritime_readiness_passports(id) on delete cascade,
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null
    check (item_type in ('identity', 'rank', 'stcw_certificate', 'medical', 'passport', 'seaman_book', 'visa', 'sea_service', 'language', 'availability', 'preference', 'portrait', 'cv', 'reference')),
  source_type text not null default 'user_claim'
    check (source_type in ('user_claim', 'ocr_user_confirmed', 'employer_attested', 'registry_verified', 'reviewer_verified', 'provider_verified', 'system_derived')),
  trust_level text not null default 'unverified'
    check (trust_level in ('unverified', 'machine_read', 'user_confirmed', 'employer_confirmed', 'registry_confirmed', 'reviewer_confirmed', 'disputed', 'expired', 'revoked')),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending_user_confirmation', 'pending_review', 'verified', 'rejected', 'expired', 'revoked', 'disputed')),
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source_label text,
  source_reference_hash text,
  value_summary text,
  value_payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  user_confirmed_at timestamptz,
  verified_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maritime_document_intakes (
  id uuid primary key default gen_random_uuid(),
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'classified', 'ocr_draft', 'user_confirmed', 'verification_pending', 'verified', 'rejected', 'quarantined', 'expired', 'revoked')),
  document_type text not null default 'unknown',
  storage_bucket text not null,
  storage_path text not null,
  file_sha256 text,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  ocr_confidence numeric(4,3) check (ocr_confidence is null or (ocr_confidence >= 0 and ocr_confidence <= 1)),
  classification_confidence numeric(4,3) check (classification_confidence is null or (classification_confidence >= 0 and classification_confidence <= 1)),
  user_confirmation_required boolean not null default true,
  confirmed_by_user_at timestamptz,
  retention_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maritime_document_intakes_confirmed_requires_user
    check (status <> 'user_confirmed' or confirmed_by_user_at is not null)
);

create table if not exists public.maritime_smart_portrait_reviews (
  id uuid primary key default gen_random_uuid(),
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  source_document_id uuid references public.maritime_document_intakes(id) on delete set null,
  status text not null default 'pending_user_review'
    check (status in ('pending_user_review', 'approved_by_user', 'rejected_by_user', 'verification_pending', 'published', 'withdrawn')),
  identity_change_detected boolean not null default false,
  original_storage_path text,
  processed_storage_path text,
  user_approved_at timestamptz,
  reviewer_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maritime_smart_portrait_no_identity_change
    check (identity_change_detected = false or status in ('pending_user_review', 'rejected_by_user', 'withdrawn'))
);

create table if not exists public.maritime_cv_generations (
  id uuid primary key default gen_random_uuid(),
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  passport_id uuid references public.maritime_readiness_passports(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'generated', 'pending_user_approval', 'approved_by_user', 'revoked', 'expired')),
  template_version text not null default 'maritime-cv-v1',
  input_snapshot_hash text not null,
  generated_storage_path text,
  user_approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maritime_work_status_events (
  id uuid primary key default gen_random_uuid(),
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  work_status text not null
    check (work_status in ('available_now', 'available_from_date', 'onboard', 'on_leave', 'not_available', 'unknown')),
  availability_status text not null default 'fresh'
    check (availability_status in ('fresh', 'stale', 'expired', 'blocked')),
  source_type text not null default 'user_confirmation'
    check (source_type in ('user_confirmation', 'employer_signal', 'contract_event', 'system_expiry', 'admin_review')),
  signal_at timestamptz not null default now(),
  stale_after timestamptz not null,
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.maritime_vessel_profiles (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  imo_number text,
  vessel_name text not null,
  vessel_type text,
  flag_state text,
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'verified', 'changes_requested', 'suspended', 'archived')),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending_review', 'verified', 'expired', 'revoked', 'rejected')),
  profile_version integer not null default 1 check (profile_version > 0),
  verified_at timestamptz,
  reapproval_required boolean not null default false,
  last_change_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maritime_jobs (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  vessel_profile_id uuid references public.maritime_vessel_profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  job_reference text not null default ('MJ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  status text not null default 'draft'
    check (status in ('draft', 'structured', 'pending_review', 'open', 'paused', 'closed', 'cancelled', 'filled')),
  rank_code text,
  job_title text not null,
  contract_start date,
  contract_end date,
  hard_gates jsonb not null default '{}'::jsonb,
  preference_weights jsonb not null default '{}'::jsonb,
  structured_requirements jsonb not null default '{}'::jsonb,
  source_free_text text,
  rule_version text not null default 'maritime-match-v1',
  job_version integer not null default 1 check (job_version > 0),
  submitted_at timestamptz,
  opened_at timestamptz,
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maritime_jobs_contract_dates_check
    check (contract_end is null or contract_start is null or contract_end >= contract_start)
);

create table if not exists public.maritime_job_versions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.maritime_jobs(id) on delete cascade,
  version integer not null check (version > 0),
  snapshot jsonb not null default '{}'::jsonb,
  snapshot_hash text not null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (job_id, version)
);

create table if not exists public.maritime_job_assistant_drafts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  status text not null default 'draft'
    check (status in ('draft', 'needs_review', 'approved_for_job', 'discarded')),
  source_free_text text not null,
  structured_requirements jsonb not null default '{}'::jsonb,
  model_version text,
  input_snapshot_hash text,
  user_approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maritime_hiring_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.maritime_jobs(id) on delete cascade,
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'drafted'
    check (status in ('drafted', 'awaiting_candidate_approval', 'submitted', 'withdrawn', 'shortlisted', 'interviewing', 'offer_sent', 'offer_accepted', 'offer_declined', 'hired', 'rejected', 'closed')),
  candidate_consent_snapshot jsonb not null default '{}'::jsonb,
  evidence_package_hash text,
  submitted_at timestamptz,
  withdrawn_at timestamptz,
  decision_reason text,
  last_stage_changed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, seafarer_user_id)
);

create table if not exists public.maritime_match_results (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.maritime_jobs(id) on delete cascade,
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  application_id uuid references public.maritime_hiring_applications(id) on delete set null,
  hard_gate_status text not null default 'needs_data'
    check (hard_gate_status in ('passed', 'failed', 'needs_data', 'stale')),
  hard_gate_reasons jsonb not null default '[]'::jsonb,
  preference_score numeric(5,2) check (preference_score is null or (preference_score >= 0 and preference_score <= 100)),
  score_reasons jsonb not null default '[]'::jsonb,
  rule_version text not null,
  score_version text not null,
  input_snapshot_hash text not null,
  input_snapshot jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  stale_after timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.maritime_hiring_rooms (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  job_id uuid references public.maritime_jobs(id) on delete set null,
  vessel_profile_id uuid references public.maritime_vessel_profiles(id) on delete set null,
  status text not null default 'active'
    check (status in ('draft', 'active', 'paused', 'filled', 'closed', 'archived')),
  purpose text not null default 'company_hiring',
  selected_application_id uuid references public.maritime_hiring_applications(id) on delete set null,
  backup_application_id uuid references public.maritime_hiring_applications(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maritime_private_candidate_rooms (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  job_id uuid references public.maritime_jobs(id) on delete set null,
  application_id uuid references public.maritime_hiring_applications(id) on delete set null,
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  hiring_room_id uuid references public.maritime_hiring_rooms(id) on delete set null,
  status text not null default 'active'
    check (status in ('draft', 'active', 'paused', 'offer', 'hired', 'closed', 'archived')),
  purpose text not null default 'candidate_hiring',
  expires_at timestamptz,
  candidate_visible boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, job_id, seafarer_user_id)
);

create table if not exists public.maritime_crew_rooms (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  vessel_profile_id uuid references public.maritime_vessel_profiles(id) on delete set null,
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'active', 'locked', 'closed', 'archived')),
  join_window_start date,
  join_window_end date,
  privacy_mode text not null default 'minimum_required'
    check (privacy_mode in ('minimum_required', 'expanded_with_consent')),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maritime_crew_rooms_join_window_check
    check (join_window_end is null or join_window_start is null or join_window_end >= join_window_start)
);

create table if not exists public.maritime_crew_room_members (
  id uuid primary key default gen_random_uuid(),
  crew_room_id uuid not null references public.maritime_crew_rooms(id) on delete cascade,
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  application_id uuid references public.maritime_hiring_applications(id) on delete set null,
  member_status text not null default 'invited'
    check (member_status in ('invited', 'active', 'left', 'removed', 'completed')),
  visible_profile_fields jsonb not null default '{"name": true, "rank": true, "joining": true}'::jsonb,
  joined_at timestamptz,
  left_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (crew_room_id, seafarer_user_id)
);

create table if not exists public.maritime_connect_provider_adapters (
  provider_key text primary key,
  provider_name text not null,
  provider_type text not null default 'webrtc'
    check (provider_type in ('webrtc', 'messaging', 'storage', 'scheduling', 'manual')),
  status text not null default 'planned'
    check (status in ('planned', 'sandbox', 'active', 'paused', 'retired')),
  capabilities jsonb not null default '{}'::jsonb,
  config_public jsonb not null default '{}'::jsonb,
  secret_ref text,
  default_recording_policy text not null default 'not_recorded'
    check (default_recording_policy in ('not_recorded', 'explicit_consent_required', 'recorded_with_consent')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.maritime_connect_provider_adapters (
  provider_key,
  provider_name,
  provider_type,
  status,
  capabilities,
  config_public,
  default_recording_policy
) values (
  'webrtc_provider_pending',
  'WebRTC Provider Pending',
  'webrtc',
  'planned',
  '{"text": true, "voice_note": true, "file_share": true, "scheduling": true, "audio": true, "video": true}'::jsonb,
  '{"business_logic": "allona", "media_runtime": "external_provider"}'::jsonb,
  'not_recorded'
) on conflict (provider_key) do nothing;

create table if not exists public.maritime_connect_threads (
  id uuid primary key default gen_random_uuid(),
  thread_scope text not null
    check (thread_scope in ('private_candidate', 'company_hiring', 'crew_room', 'trust_case')),
  candidate_room_id uuid references public.maritime_private_candidate_rooms(id) on delete cascade,
  hiring_room_id uuid references public.maritime_hiring_rooms(id) on delete cascade,
  crew_room_id uuid references public.maritime_crew_rooms(id) on delete cascade,
  partner_id uuid references public.partner_businesses(id) on delete cascade,
  seafarer_user_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'paused', 'locked', 'closed', 'archived')),
  purpose text not null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maritime_connect_threads_single_room_check
    check (num_nonnulls(candidate_room_id, hiring_room_id, crew_room_id) <= 1),
  constraint maritime_connect_threads_scope_room_check
    check (
      (thread_scope = 'private_candidate' and candidate_room_id is not null and seafarer_user_id is not null)
      or (thread_scope = 'company_hiring' and hiring_room_id is not null)
      or (thread_scope = 'crew_room' and crew_room_id is not null)
      or (thread_scope = 'trust_case')
    )
);

create table if not exists public.maritime_connect_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.maritime_connect_threads(id) on delete cascade,
  sender_user_id uuid references public.profiles(id) on delete set null default auth.uid(),
  message_type text not null default 'text'
    check (message_type in ('text', 'voice_note', 'file', 'system', 'interview_event', 'offer_event', 'document_request')),
  body text,
  attachment_path text,
  delivery_status text not null default 'sent'
    check (delivery_status in ('draft', 'sent', 'delivered', 'read', 'failed', 'retracted')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maritime_connect_messages_content_check
    check (body is not null or attachment_path is not null or message_type in ('system', 'interview_event', 'offer_event'))
);

create table if not exists public.maritime_connect_broadcasts (
  id uuid primary key default gen_random_uuid(),
  hiring_room_id uuid not null references public.maritime_hiring_rooms(id) on delete cascade,
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  message_template_hash text not null,
  candidate_count integer not null default 0 check (candidate_count >= 0),
  status text not null default 'queued'
    check (status in ('queued', 'expanding_to_private_threads', 'sent', 'partial_failed', 'failed', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maritime_connect_sessions (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.maritime_connect_threads(id) on delete cascade,
  provider_key text not null references public.maritime_connect_provider_adapters(provider_key),
  session_type text not null
    check (session_type in ('audio', 'video', 'screening', 'interview')),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'provider_pending', 'live', 'ended', 'cancelled', 'failed')),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  provider_session_ref text,
  recording_policy text not null default 'not_recorded'
    check (recording_policy in ('not_recorded', 'explicit_consent_required', 'recorded_with_consent')),
  recording_consent_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maritime_connect_sessions_schedule_check
    check (scheduled_end is null or scheduled_start is null or scheduled_end >= scheduled_start)
);

create table if not exists public.maritime_interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.maritime_hiring_applications(id) on delete set null,
  candidate_room_id uuid references public.maritime_private_candidate_rooms(id) on delete set null,
  connect_session_id uuid references public.maritime_connect_sessions(id) on delete set null,
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'scheduled'
    check (status in ('draft', 'scheduled', 'completed', 'no_show', 'cancelled', 'rescheduled')),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  scorecard jsonb not null default '{}'::jsonb,
  interviewer_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maritime_work_relationships (
  id uuid primary key default gen_random_uuid(),
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  partner_id uuid references public.partner_businesses(id) on delete set null,
  vessel_profile_id uuid references public.maritime_vessel_profiles(id) on delete set null,
  job_id uuid references public.maritime_jobs(id) on delete set null,
  rank_code text,
  start_date date,
  end_date date,
  verification_status text not null default 'claimed'
    check (verification_status in ('claimed', 'employer_attested', 'registry_verified', 'reviewer_verified', 'disputed', 'revoked')),
  source_reference_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maritime_work_relationship_dates_check
    check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.maritime_reference_requests (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.maritime_work_relationships(id) on delete restrict,
  requester_partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested', 'candidate_consent_pending', 'sent_to_authorized_employer', 'responded', 'declined', 'expired', 'revoked')),
  visibility_scope text not null default 'authorized_company_only'
    check (visibility_scope in ('authorized_company_only', 'candidate_only', 'trust_only')),
  requested_by uuid references public.profiles(id) on delete set null default auth.uid(),
  candidate_consent_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maritime_reference_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.maritime_reference_requests(id) on delete cascade,
  relationship_id uuid not null references public.maritime_work_relationships(id) on delete restrict,
  responder_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'submitted'
    check (status in ('draft', 'submitted', 'reviewed', 'restricted', 'revoked')),
  response_summary text,
  employer_reference_level text
    check (employer_reference_level is null or employer_reference_level in ('positive', 'neutral', 'negative', 'verification_only')),
  submitted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maritime_offers_contracts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.maritime_hiring_applications(id) on delete cascade,
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.maritime_jobs(id) on delete cascade,
  offer_status text not null default 'draft'
    check (offer_status in ('draft', 'sent', 'accepted', 'declined', 'withdrawn', 'expired', 'contracted')),
  contract_compare_status text not null default 'not_run'
    check (contract_compare_status in ('not_run', 'pending', 'matched', 'differences_found', 'blocked')),
  contract_snapshot_hash text,
  compare_result jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  signed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maritime_urgent_crew_requests (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  job_id uuid references public.maritime_jobs(id) on delete set null,
  vessel_profile_id uuid references public.maritime_vessel_profiles(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'open', 'matching', 'filled', 'cancelled', 'expired')),
  needed_by timestamptz not null,
  ranks jsonb not null default '[]'::jsonb,
  hard_gates jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maritime_bulk_invite_batches (
  id uuid primary key default gen_random_uuid(),
  hiring_room_id uuid not null references public.maritime_hiring_rooms(id) on delete cascade,
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  template_hash text not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'partial_failed', 'failed', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maritime_favorite_candidates (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  list_name text not null default 'default',
  reason text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (partner_id, seafarer_user_id, list_name)
);

create table if not exists public.maritime_crew_matrix_snapshots (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  vessel_profile_id uuid references public.maritime_vessel_profiles(id) on delete set null,
  matrix_version integer not null default 1 check (matrix_version > 0),
  snapshot jsonb not null default '{}'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  snapshot_hash text not null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.maritime_relief_rehire_plans (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  vessel_profile_id uuid references public.maritime_vessel_profiles(id) on delete set null,
  current_application_id uuid references public.maritime_hiring_applications(id) on delete set null,
  candidate_user_id uuid references public.profiles(id) on delete set null,
  target_join_date date,
  status text not null default 'draft'
    check (status in ('draft', 'monitoring', 'candidate_ready', 'invited', 'confirmed', 'paused', 'closed')),
  autopilot_mode text not null default 'assistive'
    check (autopilot_mode in ('off', 'assistive', 'requires_approval')),
  rule_version text not null default 'relief-rehire-v1',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maritime_billing_events (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  event_type text not null
    check (event_type in ('subscription_preview', 'invoice_created', 'payment_required', 'payment_completed', 'credit_granted', 'credit_used', 'refund_review')),
  status text not null default 'recorded'
    check (status in ('recorded', 'pending', 'completed', 'failed', 'void')),
  amount numeric(12,2) check (amount is null or amount >= 0),
  currency text,
  provider_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.maritime_trust_cases (
  id uuid primary key default gen_random_uuid(),
  case_reference text not null unique default ('MTC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  case_type text not null
    check (case_type in ('company_verification', 'document_verification', 'fraud_signal', 'communication_complaint', 'content_access', 'appeal', 'privacy_request')),
  status text not null default 'open'
    check (status in ('open', 'triage', 'awaiting_approval', 'approved', 'denied', 'resolved', 'closed', 'archived')),
  severity text not null default 'normal'
    check (severity in ('low', 'normal', 'high', 'critical')),
  subject_type text not null
    check (subject_type in ('seafarer', 'partner', 'job', 'room', 'message', 'document', 'vessel', 'offer', 'reference', 'system')),
  subject_id uuid,
  partner_id uuid references public.partner_businesses(id) on delete set null,
  seafarer_user_id uuid references public.profiles(id) on delete set null,
  opened_by uuid references public.profiles(id) on delete set null default auth.uid(),
  assigned_to uuid references public.profiles(id) on delete set null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maritime_sensitive_access_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.maritime_trust_cases(id) on delete cascade,
  requester_user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  approver_user_id uuid references public.profiles(id) on delete set null,
  second_approver_user_id uuid references public.profiles(id) on delete set null,
  access_scope text not null
    check (access_scope in ('message_content', 'document_content', 'voice_note', 'video_recording', 'passport_item', 'full_room')),
  purpose text not null,
  justification text not null,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'second_approval_required', 'denied', 'expired', 'revoked', 'used')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '4 hours'),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint maritime_sensitive_access_reason_length
    check (char_length(trim(justification)) between 12 and 1200),
  constraint maritime_sensitive_access_timebox
    check (expires_at > starts_at and expires_at <= starts_at + interval '24 hours')
);

create table if not exists public.maritime_access_grants (
  id uuid primary key default gen_random_uuid(),
  grantee_user_id uuid references public.profiles(id) on delete set null,
  grantor_user_id uuid references public.profiles(id) on delete set null default auth.uid(),
  seafarer_user_id uuid references public.profiles(id) on delete cascade,
  partner_id uuid references public.partner_businesses(id) on delete cascade,
  resource_type text not null,
  resource_id uuid not null,
  purpose text not null,
  status text not null default 'active'
    check (status in ('active', 'expired', 'revoked', 'used')),
  grant_token_hash char(64),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  case_id uuid references public.maritime_trust_cases(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint maritime_access_grants_expires_future
    check (expires_at > created_at)
);

create table if not exists public.maritime_access_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null default auth.uid(),
  grant_id uuid references public.maritime_access_grants(id) on delete set null,
  resource_type text not null,
  resource_id uuid not null,
  action text not null
    check (action in ('view', 'download', 'share', 'revoke', 'export', 'sensitive_access')),
  purpose text,
  case_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.maritime_permission_matrix (
  id uuid primary key default gen_random_uuid(),
  actor_role text not null,
  workspace_scope text not null,
  action_key text not null,
  decision text not null
    check (decision in ('allow', 'deny', 'case_required', 'dual_approval_required', 'service_role_only')),
  requires_mfa boolean not null default false,
  requires_case boolean not null default false,
  notes text,
  conditions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (actor_role, workspace_scope, action_key)
);

create table if not exists public.maritime_entity_versions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  version_number integer not null check (version_number > 0),
  snapshot_hash text not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  change_reason text,
  rollback_of_version integer,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, version_number)
);

create table if not exists public.maritime_workflow_transition_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  from_status text,
  to_status text not null,
  actor_user_id uuid references public.profiles(id) on delete set null default auth.uid(),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.maritime_trust_badges (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null
    check (entity_type in ('seafarer', 'partner', 'vessel')),
  entity_id uuid not null,
  badge_type text not null
    check (badge_type in ('verified_gold', 'pro_blue')),
  status text not null default 'active'
    check (status in ('active', 'pending', 'expired', 'revoked')),
  source_review_id uuid references public.maritime_trust_cases(id) on delete restrict,
  membership_reference text,
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint maritime_trust_badges_gold_requires_review
    check (badge_type <> 'verified_gold' or source_review_id is not null)
);

create index if not exists maritime_readiness_items_user_type_idx
  on public.maritime_readiness_items(seafarer_user_id, item_type, verification_status);
create index if not exists maritime_document_intakes_user_status_idx
  on public.maritime_document_intakes(seafarer_user_id, status, created_at desc);
create index if not exists maritime_work_status_events_user_idx
  on public.maritime_work_status_events(seafarer_user_id, signal_at desc);
create index if not exists maritime_vessel_profiles_partner_idx
  on public.maritime_vessel_profiles(partner_id, status, updated_at desc);
create index if not exists maritime_jobs_partner_status_idx
  on public.maritime_jobs(partner_id, status, created_at desc);
create index if not exists maritime_jobs_hard_gates_idx
  on public.maritime_jobs using gin(hard_gates);
create index if not exists maritime_applications_job_status_idx
  on public.maritime_hiring_applications(job_id, status, updated_at desc);
create index if not exists maritime_applications_candidate_idx
  on public.maritime_hiring_applications(seafarer_user_id, status, updated_at desc);
create index if not exists maritime_match_results_job_score_idx
  on public.maritime_match_results(job_id, hard_gate_status, preference_score desc);
create index if not exists maritime_candidate_rooms_participant_idx
  on public.maritime_private_candidate_rooms(partner_id, seafarer_user_id, status);
create index if not exists maritime_connect_threads_candidate_idx
  on public.maritime_connect_threads(candidate_room_id, status);
create index if not exists maritime_connect_messages_thread_idx
  on public.maritime_connect_messages(thread_id, created_at desc);
create index if not exists maritime_connect_sessions_thread_idx
  on public.maritime_connect_sessions(thread_id, scheduled_start desc);
create index if not exists maritime_trust_cases_status_idx
  on public.maritime_trust_cases(status, severity, created_at desc);
create index if not exists maritime_access_events_resource_idx
  on public.maritime_access_events(resource_type, resource_id, created_at desc);
create index if not exists maritime_access_events_actor_idx
  on public.maritime_access_events(actor_user_id, created_at desc);
create index if not exists maritime_access_grants_resource_idx
  on public.maritime_access_grants(resource_type, resource_id, status, expires_at);
create index if not exists maritime_workflow_transition_log_entity_idx
  on public.maritime_workflow_transition_log(entity_type, entity_id, created_at desc);
create index if not exists maritime_trust_badges_entity_idx
  on public.maritime_trust_badges(entity_type, entity_id, badge_type, status);

drop trigger if exists maritime_seafarer_workspaces_set_updated_at on public.maritime_seafarer_workspaces;
create trigger maritime_seafarer_workspaces_set_updated_at
  before update on public.maritime_seafarer_workspaces
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_readiness_passports_set_updated_at on public.maritime_readiness_passports;
create trigger maritime_readiness_passports_set_updated_at
  before update on public.maritime_readiness_passports
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_readiness_items_set_updated_at on public.maritime_readiness_items;
create trigger maritime_readiness_items_set_updated_at
  before update on public.maritime_readiness_items
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_document_intakes_set_updated_at on public.maritime_document_intakes;
create trigger maritime_document_intakes_set_updated_at
  before update on public.maritime_document_intakes
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_smart_portrait_reviews_set_updated_at on public.maritime_smart_portrait_reviews;
create trigger maritime_smart_portrait_reviews_set_updated_at
  before update on public.maritime_smart_portrait_reviews
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_cv_generations_set_updated_at on public.maritime_cv_generations;
create trigger maritime_cv_generations_set_updated_at
  before update on public.maritime_cv_generations
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_vessel_profiles_set_updated_at on public.maritime_vessel_profiles;
create trigger maritime_vessel_profiles_set_updated_at
  before update on public.maritime_vessel_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_jobs_set_updated_at on public.maritime_jobs;
create trigger maritime_jobs_set_updated_at
  before update on public.maritime_jobs
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_job_assistant_drafts_set_updated_at on public.maritime_job_assistant_drafts;
create trigger maritime_job_assistant_drafts_set_updated_at
  before update on public.maritime_job_assistant_drafts
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_hiring_applications_set_updated_at on public.maritime_hiring_applications;
create trigger maritime_hiring_applications_set_updated_at
  before update on public.maritime_hiring_applications
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_hiring_rooms_set_updated_at on public.maritime_hiring_rooms;
create trigger maritime_hiring_rooms_set_updated_at
  before update on public.maritime_hiring_rooms
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_private_candidate_rooms_set_updated_at on public.maritime_private_candidate_rooms;
create trigger maritime_private_candidate_rooms_set_updated_at
  before update on public.maritime_private_candidate_rooms
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_crew_rooms_set_updated_at on public.maritime_crew_rooms;
create trigger maritime_crew_rooms_set_updated_at
  before update on public.maritime_crew_rooms
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_connect_provider_adapters_set_updated_at on public.maritime_connect_provider_adapters;
create trigger maritime_connect_provider_adapters_set_updated_at
  before update on public.maritime_connect_provider_adapters
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_connect_threads_set_updated_at on public.maritime_connect_threads;
create trigger maritime_connect_threads_set_updated_at
  before update on public.maritime_connect_threads
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_connect_messages_set_updated_at on public.maritime_connect_messages;
create trigger maritime_connect_messages_set_updated_at
  before update on public.maritime_connect_messages
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_connect_broadcasts_set_updated_at on public.maritime_connect_broadcasts;
create trigger maritime_connect_broadcasts_set_updated_at
  before update on public.maritime_connect_broadcasts
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_connect_sessions_set_updated_at on public.maritime_connect_sessions;
create trigger maritime_connect_sessions_set_updated_at
  before update on public.maritime_connect_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_interviews_set_updated_at on public.maritime_interviews;
create trigger maritime_interviews_set_updated_at
  before update on public.maritime_interviews
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_work_relationships_set_updated_at on public.maritime_work_relationships;
create trigger maritime_work_relationships_set_updated_at
  before update on public.maritime_work_relationships
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_reference_requests_set_updated_at on public.maritime_reference_requests;
create trigger maritime_reference_requests_set_updated_at
  before update on public.maritime_reference_requests
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_reference_responses_set_updated_at on public.maritime_reference_responses;
create trigger maritime_reference_responses_set_updated_at
  before update on public.maritime_reference_responses
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_offers_contracts_set_updated_at on public.maritime_offers_contracts;
create trigger maritime_offers_contracts_set_updated_at
  before update on public.maritime_offers_contracts
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_urgent_crew_requests_set_updated_at on public.maritime_urgent_crew_requests;
create trigger maritime_urgent_crew_requests_set_updated_at
  before update on public.maritime_urgent_crew_requests
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_bulk_invite_batches_set_updated_at on public.maritime_bulk_invite_batches;
create trigger maritime_bulk_invite_batches_set_updated_at
  before update on public.maritime_bulk_invite_batches
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_relief_rehire_plans_set_updated_at on public.maritime_relief_rehire_plans;
create trigger maritime_relief_rehire_plans_set_updated_at
  before update on public.maritime_relief_rehire_plans
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_trust_cases_set_updated_at on public.maritime_trust_cases;
create trigger maritime_trust_cases_set_updated_at
  before update on public.maritime_trust_cases
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_permission_matrix_set_updated_at on public.maritime_permission_matrix;
create trigger maritime_permission_matrix_set_updated_at
  before update on public.maritime_permission_matrix
  for each row execute function public.set_updated_at();

create or replace function public.maritime_can_access_partner(p_partner_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select p_partner_id is not null and public.partner_member_has_access(p_partner_id);
$$;

create or replace function public.maritime_partner_member_without_admin(p_partner_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select p_partner_id is not null and (
    exists (
      select 1
      from public.partner_businesses business
      where business.id = p_partner_id
        and business.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.partner_staff staff
      where staff.partner_id = p_partner_id
        and staff.user_id = auth.uid()
        and staff.status = 'active'
    )
  );
$$;

create or replace function public.maritime_can_access_candidate_room(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.maritime_private_candidate_rooms room
    where room.id = p_room_id
      and (
        room.seafarer_user_id = auth.uid()
        or public.maritime_can_access_partner(room.partner_id)
      )
  );
$$;

create or replace function public.maritime_can_access_hiring_room(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.maritime_hiring_rooms room
    where room.id = p_room_id
      and public.maritime_can_access_partner(room.partner_id)
  );
$$;

create or replace function public.maritime_can_access_crew_room(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.maritime_crew_rooms room
    where room.id = p_room_id
      and public.maritime_can_access_partner(room.partner_id)
  )
  or exists (
    select 1
    from public.maritime_crew_room_members member
    where member.crew_room_id = p_room_id
      and member.seafarer_user_id = auth.uid()
      and member.member_status in ('invited', 'active', 'completed')
  );
$$;

create or replace function public.maritime_can_access_connect_thread(p_thread_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.maritime_connect_threads thread
    where thread.id = p_thread_id
      and (
        public.is_admin()
        or (thread.seafarer_user_id is not null and thread.seafarer_user_id = auth.uid())
        or (thread.partner_id is not null and public.maritime_can_access_partner(thread.partner_id))
        or (thread.candidate_room_id is not null and public.maritime_can_access_candidate_room(thread.candidate_room_id))
        or (thread.hiring_room_id is not null and public.maritime_can_access_hiring_room(thread.hiring_room_id))
        or (thread.crew_room_id is not null and public.maritime_can_access_crew_room(thread.crew_room_id))
      )
  );
$$;

create or replace function public.maritime_can_access_connect_thread_content(p_thread_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.maritime_connect_threads thread
    where thread.id = p_thread_id
      and (
        (thread.seafarer_user_id is not null and thread.seafarer_user_id = auth.uid())
        or (thread.partner_id is not null and public.maritime_partner_member_without_admin(thread.partner_id))
        or exists (
          select 1
          from public.maritime_private_candidate_rooms room
          where room.id = thread.candidate_room_id
            and (
              room.seafarer_user_id = auth.uid()
              or public.maritime_partner_member_without_admin(room.partner_id)
            )
        )
        or exists (
          select 1
          from public.maritime_hiring_rooms room
          where room.id = thread.hiring_room_id
            and public.maritime_partner_member_without_admin(room.partner_id)
        )
        or exists (
          select 1
          from public.maritime_crew_rooms room
          where room.id = thread.crew_room_id
            and public.maritime_partner_member_without_admin(room.partner_id)
        )
        or exists (
          select 1
          from public.maritime_crew_room_members member
          where member.crew_room_id = thread.crew_room_id
            and member.seafarer_user_id = auth.uid()
            and member.member_status in ('invited', 'active', 'completed')
        )
      )
  );
$$;

create or replace function public.maritime_valid_hiring_transition(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select case
    when p_to = p_from then true
    when p_from is null then p_to in ('drafted', 'awaiting_candidate_approval', 'submitted')
    when p_from = 'drafted' then p_to in ('awaiting_candidate_approval', 'submitted', 'withdrawn', 'closed')
    when p_from = 'awaiting_candidate_approval' then p_to in ('submitted', 'withdrawn', 'closed')
    when p_from = 'submitted' then p_to in ('shortlisted', 'withdrawn', 'rejected', 'closed')
    when p_from = 'shortlisted' then p_to in ('interviewing', 'offer_sent', 'rejected', 'withdrawn', 'closed')
    when p_from = 'interviewing' then p_to in ('shortlisted', 'offer_sent', 'rejected', 'withdrawn', 'closed')
    when p_from = 'offer_sent' then p_to in ('offer_accepted', 'offer_declined', 'withdrawn', 'closed')
    when p_from = 'offer_accepted' then p_to in ('hired', 'closed')
    when p_from in ('offer_declined', 'hired', 'rejected', 'withdrawn', 'closed') then false
    else false
  end;
$$;

create or replace function public.maritime_assert_hiring_application_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if not public.maritime_valid_hiring_transition(old.status, new.status) then
      raise exception 'invalid maritime hiring application transition: % -> %', old.status, new.status;
    end if;
    new.last_stage_changed_at := now();
  end if;

  return new;
end;
$$;

create or replace function public.maritime_log_hiring_application_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.maritime_workflow_transition_log (
      entity_type,
      entity_id,
      from_status,
      to_status,
      actor_user_id,
      reason,
      metadata
    ) values (
      'maritime_hiring_application',
      new.id,
      old.status,
      new.status,
      auth.uid(),
      new.decision_reason,
      jsonb_build_object('job_id', new.job_id, 'partner_id', new.partner_id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists maritime_hiring_applications_transition_guard on public.maritime_hiring_applications;
create trigger maritime_hiring_applications_transition_guard
  before update on public.maritime_hiring_applications
  for each row execute function public.maritime_assert_hiring_application_transition();

drop trigger if exists maritime_hiring_applications_transition_log on public.maritime_hiring_applications;
create trigger maritime_hiring_applications_transition_log
  after update on public.maritime_hiring_applications
  for each row execute function public.maritime_log_hiring_application_transition();

create or replace function public.maritime_assert_reference_relationship_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  relationship public.maritime_work_relationships%rowtype;
begin
  select *
  into relationship
  from public.maritime_work_relationships
  where id = new.relationship_id;

  if not found then
    raise exception 'reference relationship not found';
  end if;

  if relationship.seafarer_user_id is distinct from new.seafarer_user_id then
    raise exception 'reference request seafarer does not match relationship';
  end if;

  if relationship.verification_status not in ('employer_attested', 'registry_verified', 'reviewer_verified') then
    raise exception 'reference request requires verified work relationship';
  end if;

  return new;
end;
$$;

drop trigger if exists maritime_reference_requests_relationship_guard on public.maritime_reference_requests;
create trigger maritime_reference_requests_relationship_guard
  before insert or update of relationship_id, seafarer_user_id on public.maritime_reference_requests
  for each row execute function public.maritime_assert_reference_relationship_verified();

create or replace function public.block_maritime_append_only_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'maritime audit records are append-only';
end;
$$;

drop trigger if exists maritime_access_events_append_only on public.maritime_access_events;
create trigger maritime_access_events_append_only
  before update or delete on public.maritime_access_events
  for each row execute function public.block_maritime_append_only_mutation();

drop trigger if exists maritime_workflow_transition_log_append_only on public.maritime_workflow_transition_log;
create trigger maritime_workflow_transition_log_append_only
  before update or delete on public.maritime_workflow_transition_log
  for each row execute function public.block_maritime_append_only_mutation();

create or replace function public.maritime_record_access_event(
  p_actor_user_id uuid,
  p_resource_type text,
  p_resource_id uuid,
  p_action text,
  p_purpose text default null,
  p_case_reference text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  event_id uuid;
begin
  insert into public.maritime_access_events (
    actor_user_id,
    resource_type,
    resource_id,
    action,
    purpose,
    case_reference,
    metadata
  ) values (
    p_actor_user_id,
    p_resource_type,
    p_resource_id,
    p_action,
    p_purpose,
    p_case_reference,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into event_id;

  return event_id;
end;
$$;

alter table public.maritime_seafarer_workspaces enable row level security;
alter table public.maritime_readiness_passports enable row level security;
alter table public.maritime_readiness_items enable row level security;
alter table public.maritime_document_intakes enable row level security;
alter table public.maritime_smart_portrait_reviews enable row level security;
alter table public.maritime_cv_generations enable row level security;
alter table public.maritime_work_status_events enable row level security;
alter table public.maritime_vessel_profiles enable row level security;
alter table public.maritime_jobs enable row level security;
alter table public.maritime_job_versions enable row level security;
alter table public.maritime_job_assistant_drafts enable row level security;
alter table public.maritime_hiring_applications enable row level security;
alter table public.maritime_match_results enable row level security;
alter table public.maritime_hiring_rooms enable row level security;
alter table public.maritime_private_candidate_rooms enable row level security;
alter table public.maritime_crew_rooms enable row level security;
alter table public.maritime_crew_room_members enable row level security;
alter table public.maritime_connect_provider_adapters enable row level security;
alter table public.maritime_connect_threads enable row level security;
alter table public.maritime_connect_messages enable row level security;
alter table public.maritime_connect_broadcasts enable row level security;
alter table public.maritime_connect_sessions enable row level security;
alter table public.maritime_interviews enable row level security;
alter table public.maritime_work_relationships enable row level security;
alter table public.maritime_reference_requests enable row level security;
alter table public.maritime_reference_responses enable row level security;
alter table public.maritime_offers_contracts enable row level security;
alter table public.maritime_urgent_crew_requests enable row level security;
alter table public.maritime_bulk_invite_batches enable row level security;
alter table public.maritime_favorite_candidates enable row level security;
alter table public.maritime_crew_matrix_snapshots enable row level security;
alter table public.maritime_relief_rehire_plans enable row level security;
alter table public.maritime_billing_events enable row level security;
alter table public.maritime_trust_cases enable row level security;
alter table public.maritime_sensitive_access_requests enable row level security;
alter table public.maritime_access_grants enable row level security;
alter table public.maritime_access_events enable row level security;
alter table public.maritime_permission_matrix enable row level security;
alter table public.maritime_entity_versions enable row level security;
alter table public.maritime_workflow_transition_log enable row level security;
alter table public.maritime_trust_badges enable row level security;

drop policy if exists maritime_seafarer_workspaces_select_own_or_admin on public.maritime_seafarer_workspaces;
create policy maritime_seafarer_workspaces_select_own_or_admin
  on public.maritime_seafarer_workspaces for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists maritime_readiness_passports_select_own_or_admin on public.maritime_readiness_passports;
create policy maritime_readiness_passports_select_own_or_admin
  on public.maritime_readiness_passports for select
  to authenticated
  using (seafarer_user_id = auth.uid() or public.is_admin());

drop policy if exists maritime_readiness_items_select_own_or_admin on public.maritime_readiness_items;
create policy maritime_readiness_items_select_own_or_admin
  on public.maritime_readiness_items for select
  to authenticated
  using (seafarer_user_id = auth.uid() or public.is_admin());

drop policy if exists maritime_document_intakes_select_own_or_admin on public.maritime_document_intakes;
create policy maritime_document_intakes_select_own_or_admin
  on public.maritime_document_intakes for select
  to authenticated
  using (seafarer_user_id = auth.uid() or public.is_admin());

drop policy if exists maritime_smart_portrait_reviews_select_own_or_admin on public.maritime_smart_portrait_reviews;
create policy maritime_smart_portrait_reviews_select_own_or_admin
  on public.maritime_smart_portrait_reviews for select
  to authenticated
  using (seafarer_user_id = auth.uid() or public.is_admin());

drop policy if exists maritime_cv_generations_select_own_or_admin on public.maritime_cv_generations;
create policy maritime_cv_generations_select_own_or_admin
  on public.maritime_cv_generations for select
  to authenticated
  using (seafarer_user_id = auth.uid() or public.is_admin());

drop policy if exists maritime_work_status_events_select_own_or_admin on public.maritime_work_status_events;
create policy maritime_work_status_events_select_own_or_admin
  on public.maritime_work_status_events for select
  to authenticated
  using (seafarer_user_id = auth.uid() or public.is_admin());

drop policy if exists maritime_partner_tables_select_partner_or_admin on public.maritime_vessel_profiles;
create policy maritime_partner_tables_select_partner_or_admin
  on public.maritime_vessel_profiles for select
  to authenticated
  using (public.maritime_can_access_partner(partner_id));

drop policy if exists maritime_jobs_select_partner_or_admin on public.maritime_jobs;
create policy maritime_jobs_select_partner_or_admin
  on public.maritime_jobs for select
  to authenticated
  using (public.maritime_can_access_partner(partner_id));

drop policy if exists maritime_job_versions_select_partner_or_admin on public.maritime_job_versions;
create policy maritime_job_versions_select_partner_or_admin
  on public.maritime_job_versions for select
  to authenticated
  using (
    exists (
      select 1 from public.maritime_jobs job
      where job.id = maritime_job_versions.job_id
        and public.maritime_can_access_partner(job.partner_id)
    )
  );

drop policy if exists maritime_job_assistant_drafts_select_partner_or_admin on public.maritime_job_assistant_drafts;
create policy maritime_job_assistant_drafts_select_partner_or_admin
  on public.maritime_job_assistant_drafts for select
  to authenticated
  using (public.maritime_can_access_partner(partner_id));

drop policy if exists maritime_applications_select_participant on public.maritime_hiring_applications;
create policy maritime_applications_select_participant
  on public.maritime_hiring_applications for select
  to authenticated
  using (seafarer_user_id = auth.uid() or public.maritime_can_access_partner(partner_id));

drop policy if exists maritime_match_results_select_participant on public.maritime_match_results;
create policy maritime_match_results_select_participant
  on public.maritime_match_results for select
  to authenticated
  using (seafarer_user_id = auth.uid() or public.maritime_can_access_partner(partner_id));

drop policy if exists maritime_hiring_rooms_select_partner_or_admin on public.maritime_hiring_rooms;
create policy maritime_hiring_rooms_select_partner_or_admin
  on public.maritime_hiring_rooms for select
  to authenticated
  using (public.maritime_can_access_partner(partner_id));

drop policy if exists maritime_candidate_rooms_select_participant on public.maritime_private_candidate_rooms;
create policy maritime_candidate_rooms_select_participant
  on public.maritime_private_candidate_rooms for select
  to authenticated
  using (seafarer_user_id = auth.uid() or public.maritime_can_access_partner(partner_id));

drop policy if exists maritime_crew_rooms_select_partner_or_member on public.maritime_crew_rooms;
create policy maritime_crew_rooms_select_partner_or_member
  on public.maritime_crew_rooms for select
  to authenticated
  using (public.maritime_can_access_crew_room(id));

drop policy if exists maritime_crew_room_members_select_partner_or_self on public.maritime_crew_room_members;
create policy maritime_crew_room_members_select_partner_or_self
  on public.maritime_crew_room_members for select
  to authenticated
  using (seafarer_user_id = auth.uid() or public.maritime_can_access_crew_room(crew_room_id));

drop policy if exists maritime_connect_provider_adapters_select_admin on public.maritime_connect_provider_adapters;
create policy maritime_connect_provider_adapters_select_admin
  on public.maritime_connect_provider_adapters for select
  to authenticated
  using (public.is_admin());

drop policy if exists maritime_connect_threads_select_participant on public.maritime_connect_threads;
create policy maritime_connect_threads_select_participant
  on public.maritime_connect_threads for select
  to authenticated
  using (public.maritime_can_access_connect_thread(id));

drop policy if exists maritime_connect_messages_select_thread_participant on public.maritime_connect_messages;
create policy maritime_connect_messages_select_thread_participant
  on public.maritime_connect_messages for select
  to authenticated
  using (public.maritime_can_access_connect_thread_content(thread_id));

drop policy if exists maritime_connect_broadcasts_select_partner_or_admin on public.maritime_connect_broadcasts;
create policy maritime_connect_broadcasts_select_partner_or_admin
  on public.maritime_connect_broadcasts for select
  to authenticated
  using (public.maritime_can_access_partner(partner_id));

drop policy if exists maritime_connect_sessions_select_thread_participant on public.maritime_connect_sessions;
create policy maritime_connect_sessions_select_thread_participant
  on public.maritime_connect_sessions for select
  to authenticated
  using (public.maritime_can_access_connect_thread_content(thread_id));

drop policy if exists maritime_interviews_select_participant on public.maritime_interviews;
create policy maritime_interviews_select_participant
  on public.maritime_interviews for select
  to authenticated
  using (seafarer_user_id = auth.uid() or public.maritime_can_access_partner(partner_id));

drop policy if exists maritime_work_relationships_select_own_partner_or_admin on public.maritime_work_relationships;
create policy maritime_work_relationships_select_own_partner_or_admin
  on public.maritime_work_relationships for select
  to authenticated
  using (
    seafarer_user_id = auth.uid()
    or (partner_id is not null and public.maritime_can_access_partner(partner_id))
    or public.is_admin()
  );

drop policy if exists maritime_reference_requests_select_authorized on public.maritime_reference_requests;
create policy maritime_reference_requests_select_authorized
  on public.maritime_reference_requests for select
  to authenticated
  using (seafarer_user_id = auth.uid() or public.maritime_can_access_partner(requester_partner_id) or public.is_admin());

drop policy if exists maritime_reference_responses_select_authorized on public.maritime_reference_responses;
create policy maritime_reference_responses_select_authorized
  on public.maritime_reference_responses for select
  to authenticated
  using (
    exists (
      select 1
      from public.maritime_reference_requests request
      where request.id = maritime_reference_responses.request_id
        and (
          (
            request.visibility_scope = 'candidate_only'
            and request.seafarer_user_id = auth.uid()
          )
          or (
            request.visibility_scope = 'authorized_company_only'
            and public.maritime_partner_member_without_admin(request.requester_partner_id)
          )
        )
    )
  );

drop policy if exists maritime_offers_contracts_select_participant on public.maritime_offers_contracts;
create policy maritime_offers_contracts_select_participant
  on public.maritime_offers_contracts for select
  to authenticated
  using (seafarer_user_id = auth.uid() or public.maritime_can_access_partner(partner_id));

drop policy if exists maritime_urgent_crew_requests_select_partner_or_admin on public.maritime_urgent_crew_requests;
create policy maritime_urgent_crew_requests_select_partner_or_admin
  on public.maritime_urgent_crew_requests for select
  to authenticated
  using (public.maritime_can_access_partner(partner_id));

drop policy if exists maritime_bulk_invite_batches_select_partner_or_admin on public.maritime_bulk_invite_batches;
create policy maritime_bulk_invite_batches_select_partner_or_admin
  on public.maritime_bulk_invite_batches for select
  to authenticated
  using (public.maritime_can_access_partner(partner_id));

drop policy if exists maritime_favorite_candidates_select_partner_or_admin on public.maritime_favorite_candidates;
create policy maritime_favorite_candidates_select_partner_or_admin
  on public.maritime_favorite_candidates for select
  to authenticated
  using (public.maritime_can_access_partner(partner_id));

drop policy if exists maritime_crew_matrix_snapshots_select_partner_or_admin on public.maritime_crew_matrix_snapshots;
create policy maritime_crew_matrix_snapshots_select_partner_or_admin
  on public.maritime_crew_matrix_snapshots for select
  to authenticated
  using (public.maritime_can_access_partner(partner_id));

drop policy if exists maritime_relief_rehire_plans_select_partner_or_admin on public.maritime_relief_rehire_plans;
create policy maritime_relief_rehire_plans_select_partner_or_admin
  on public.maritime_relief_rehire_plans for select
  to authenticated
  using (public.maritime_can_access_partner(partner_id));

drop policy if exists maritime_billing_events_select_partner_or_admin on public.maritime_billing_events;
create policy maritime_billing_events_select_partner_or_admin
  on public.maritime_billing_events for select
  to authenticated
  using (public.maritime_can_access_partner(partner_id));

drop policy if exists maritime_trust_cases_select_admin on public.maritime_trust_cases;
create policy maritime_trust_cases_select_admin
  on public.maritime_trust_cases for select
  to authenticated
  using (public.is_admin());

drop policy if exists maritime_sensitive_access_requests_select_admin on public.maritime_sensitive_access_requests;
create policy maritime_sensitive_access_requests_select_admin
  on public.maritime_sensitive_access_requests for select
  to authenticated
  using (public.is_admin());

drop policy if exists maritime_access_grants_select_authorized on public.maritime_access_grants;
create policy maritime_access_grants_select_authorized
  on public.maritime_access_grants for select
  to authenticated
  using (
    grantee_user_id = auth.uid()
    or grantor_user_id = auth.uid()
    or seafarer_user_id = auth.uid()
    or (partner_id is not null and public.maritime_can_access_partner(partner_id))
    or public.is_admin()
  );

drop policy if exists maritime_access_events_select_authorized on public.maritime_access_events;
create policy maritime_access_events_select_authorized
  on public.maritime_access_events for select
  to authenticated
  using (
    actor_user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.maritime_access_grants grant_row
      where grant_row.id = maritime_access_events.grant_id
        and (
          grant_row.grantee_user_id = auth.uid()
          or grant_row.grantor_user_id = auth.uid()
          or grant_row.seafarer_user_id = auth.uid()
          or (grant_row.partner_id is not null and public.maritime_can_access_partner(grant_row.partner_id))
        )
    )
  );

drop policy if exists maritime_permission_matrix_select_admin on public.maritime_permission_matrix;
create policy maritime_permission_matrix_select_admin
  on public.maritime_permission_matrix for select
  to authenticated
  using (public.is_admin());

drop policy if exists maritime_entity_versions_select_admin on public.maritime_entity_versions;
create policy maritime_entity_versions_select_admin
  on public.maritime_entity_versions for select
  to authenticated
  using (public.is_admin());

drop policy if exists maritime_workflow_transition_log_select_admin on public.maritime_workflow_transition_log;
create policy maritime_workflow_transition_log_select_admin
  on public.maritime_workflow_transition_log for select
  to authenticated
  using (public.is_admin());

drop policy if exists maritime_trust_badges_select_authorized on public.maritime_trust_badges;
create policy maritime_trust_badges_select_authorized
  on public.maritime_trust_badges for select
  to authenticated
  using (
    public.is_admin()
    or (entity_type = 'seafarer' and entity_id = auth.uid())
    or (entity_type in ('partner', 'vessel') and status = 'active')
  );

revoke all on public.maritime_seafarer_workspaces from anon, authenticated;
revoke all on public.maritime_readiness_passports from anon, authenticated;
revoke all on public.maritime_readiness_items from anon, authenticated;
revoke all on public.maritime_document_intakes from anon, authenticated;
revoke all on public.maritime_smart_portrait_reviews from anon, authenticated;
revoke all on public.maritime_cv_generations from anon, authenticated;
revoke all on public.maritime_work_status_events from anon, authenticated;
revoke all on public.maritime_vessel_profiles from anon, authenticated;
revoke all on public.maritime_jobs from anon, authenticated;
revoke all on public.maritime_job_versions from anon, authenticated;
revoke all on public.maritime_job_assistant_drafts from anon, authenticated;
revoke all on public.maritime_hiring_applications from anon, authenticated;
revoke all on public.maritime_match_results from anon, authenticated;
revoke all on public.maritime_hiring_rooms from anon, authenticated;
revoke all on public.maritime_private_candidate_rooms from anon, authenticated;
revoke all on public.maritime_crew_rooms from anon, authenticated;
revoke all on public.maritime_crew_room_members from anon, authenticated;
revoke all on public.maritime_connect_provider_adapters from anon, authenticated;
revoke all on public.maritime_connect_threads from anon, authenticated;
revoke all on public.maritime_connect_messages from anon, authenticated;
revoke all on public.maritime_connect_broadcasts from anon, authenticated;
revoke all on public.maritime_connect_sessions from anon, authenticated;
revoke all on public.maritime_interviews from anon, authenticated;
revoke all on public.maritime_work_relationships from anon, authenticated;
revoke all on public.maritime_reference_requests from anon, authenticated;
revoke all on public.maritime_reference_responses from anon, authenticated;
revoke all on public.maritime_offers_contracts from anon, authenticated;
revoke all on public.maritime_urgent_crew_requests from anon, authenticated;
revoke all on public.maritime_bulk_invite_batches from anon, authenticated;
revoke all on public.maritime_favorite_candidates from anon, authenticated;
revoke all on public.maritime_crew_matrix_snapshots from anon, authenticated;
revoke all on public.maritime_relief_rehire_plans from anon, authenticated;
revoke all on public.maritime_billing_events from anon, authenticated;
revoke all on public.maritime_trust_cases from anon, authenticated;
revoke all on public.maritime_sensitive_access_requests from anon, authenticated;
revoke all on public.maritime_access_grants from anon, authenticated;
revoke all on public.maritime_access_events from anon, authenticated;
revoke all on public.maritime_permission_matrix from anon, authenticated;
revoke all on public.maritime_entity_versions from anon, authenticated;
revoke all on public.maritime_workflow_transition_log from anon, authenticated;
revoke all on public.maritime_trust_badges from anon, authenticated;

grant select on public.maritime_seafarer_workspaces to authenticated;
grant select on public.maritime_readiness_passports to authenticated;
grant select on public.maritime_readiness_items to authenticated;
grant select on public.maritime_document_intakes to authenticated;
grant select on public.maritime_smart_portrait_reviews to authenticated;
grant select on public.maritime_cv_generations to authenticated;
grant select on public.maritime_work_status_events to authenticated;
grant select on public.maritime_vessel_profiles to authenticated;
grant select on public.maritime_jobs to authenticated;
grant select on public.maritime_job_versions to authenticated;
grant select on public.maritime_job_assistant_drafts to authenticated;
grant select on public.maritime_hiring_applications to authenticated;
grant select on public.maritime_match_results to authenticated;
grant select on public.maritime_hiring_rooms to authenticated;
grant select on public.maritime_private_candidate_rooms to authenticated;
grant select on public.maritime_crew_rooms to authenticated;
grant select on public.maritime_crew_room_members to authenticated;
grant select on public.maritime_connect_provider_adapters to authenticated;
grant select on public.maritime_connect_threads to authenticated;
grant select on public.maritime_connect_messages to authenticated;
grant select on public.maritime_connect_broadcasts to authenticated;
grant select on public.maritime_connect_sessions to authenticated;
grant select on public.maritime_interviews to authenticated;
grant select on public.maritime_work_relationships to authenticated;
grant select on public.maritime_reference_requests to authenticated;
grant select on public.maritime_reference_responses to authenticated;
grant select on public.maritime_offers_contracts to authenticated;
grant select on public.maritime_urgent_crew_requests to authenticated;
grant select on public.maritime_bulk_invite_batches to authenticated;
grant select on public.maritime_favorite_candidates to authenticated;
grant select on public.maritime_crew_matrix_snapshots to authenticated;
grant select on public.maritime_relief_rehire_plans to authenticated;
grant select on public.maritime_billing_events to authenticated;
grant select on public.maritime_trust_cases to authenticated;
grant select on public.maritime_sensitive_access_requests to authenticated;
grant select on public.maritime_access_grants to authenticated;
grant select on public.maritime_access_events to authenticated;
grant select on public.maritime_permission_matrix to authenticated;
grant select on public.maritime_entity_versions to authenticated;
grant select on public.maritime_workflow_transition_log to authenticated;
grant select on public.maritime_trust_badges to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.maritime_seafarer_workspaces to service_role;
    grant all on public.maritime_readiness_passports to service_role;
    grant all on public.maritime_readiness_items to service_role;
    grant all on public.maritime_document_intakes to service_role;
    grant all on public.maritime_smart_portrait_reviews to service_role;
    grant all on public.maritime_cv_generations to service_role;
    grant all on public.maritime_work_status_events to service_role;
    grant all on public.maritime_vessel_profiles to service_role;
    grant all on public.maritime_jobs to service_role;
    grant all on public.maritime_job_versions to service_role;
    grant all on public.maritime_job_assistant_drafts to service_role;
    grant all on public.maritime_hiring_applications to service_role;
    grant all on public.maritime_match_results to service_role;
    grant all on public.maritime_hiring_rooms to service_role;
    grant all on public.maritime_private_candidate_rooms to service_role;
    grant all on public.maritime_crew_rooms to service_role;
    grant all on public.maritime_crew_room_members to service_role;
    grant all on public.maritime_connect_provider_adapters to service_role;
    grant all on public.maritime_connect_threads to service_role;
    grant all on public.maritime_connect_messages to service_role;
    grant all on public.maritime_connect_broadcasts to service_role;
    grant all on public.maritime_connect_sessions to service_role;
    grant all on public.maritime_interviews to service_role;
    grant all on public.maritime_work_relationships to service_role;
    grant all on public.maritime_reference_requests to service_role;
    grant all on public.maritime_reference_responses to service_role;
    grant all on public.maritime_offers_contracts to service_role;
    grant all on public.maritime_urgent_crew_requests to service_role;
    grant all on public.maritime_bulk_invite_batches to service_role;
    grant all on public.maritime_favorite_candidates to service_role;
    grant all on public.maritime_crew_matrix_snapshots to service_role;
    grant all on public.maritime_relief_rehire_plans to service_role;
    grant all on public.maritime_billing_events to service_role;
    grant all on public.maritime_trust_cases to service_role;
    grant all on public.maritime_sensitive_access_requests to service_role;
    grant all on public.maritime_access_grants to service_role;
    grant all on public.maritime_access_events to service_role;
    grant all on public.maritime_permission_matrix to service_role;
    grant all on public.maritime_entity_versions to service_role;
    grant all on public.maritime_workflow_transition_log to service_role;
    grant all on public.maritime_trust_badges to service_role;
    grant execute on function public.maritime_record_access_event(uuid, text, uuid, text, text, text, jsonb) to service_role;
  end if;
end $$;

revoke all on function public.maritime_can_access_partner(uuid) from anon;
revoke all on function public.maritime_partner_member_without_admin(uuid) from anon;
revoke all on function public.maritime_can_access_candidate_room(uuid) from anon;
revoke all on function public.maritime_can_access_hiring_room(uuid) from anon;
revoke all on function public.maritime_can_access_crew_room(uuid) from anon;
revoke all on function public.maritime_can_access_connect_thread(uuid) from anon;
revoke all on function public.maritime_can_access_connect_thread_content(uuid) from anon;
revoke all on function public.maritime_record_access_event(uuid, text, uuid, text, text, text, jsonb) from anon, authenticated;
grant execute on function public.maritime_can_access_partner(uuid) to authenticated;
grant execute on function public.maritime_partner_member_without_admin(uuid) to authenticated;
grant execute on function public.maritime_can_access_candidate_room(uuid) to authenticated;
grant execute on function public.maritime_can_access_hiring_room(uuid) to authenticated;
grant execute on function public.maritime_can_access_crew_room(uuid) to authenticated;
grant execute on function public.maritime_can_access_connect_thread(uuid) to authenticated;
grant execute on function public.maritime_can_access_connect_thread_content(uuid) to authenticated;

insert into public.maritime_permission_matrix (
  actor_role,
  workspace_scope,
  action_key,
  decision,
  requires_mfa,
  requires_case,
  notes,
  conditions
) values
  ('seafarer', 'seafarer_workspace', 'read_own_readiness_passport', 'allow', false, false, 'Candidate may read own passport and readiness evidence.', '{}'::jsonb),
  ('seafarer', 'private_candidate_room', 'read_other_candidates', 'deny', false, false, 'Candidate room isolation prevents candidate-to-candidate discovery.', '{}'::jsonb),
  ('partner_member', 'company_maritime_workspace', 'read_partner_jobs', 'allow', true, false, 'Partner tenant access is inherited from partner_businesses and partner_staff.', '{}'::jsonb),
  ('partner_member', 'company_maritime_workspace', 'bulk_message_candidates', 'service_role_only', true, false, 'Bulk messages must expand into separate private candidate threads.', '{"delivery": "one_to_one_only"}'::jsonb),
  ('partner_member', 'crew_room', 'open_post_hire_crew_room', 'service_role_only', true, false, 'Crew Room is post-hire only and requires privacy approval.', '{"mode": "minimum_required"}'::jsonb),
  ('admin_ops', 'trust_communication_oversight', 'view_metadata_risk_signals', 'allow', true, false, 'Default oversight exposes metadata, risk signals, complaints and audit history.', '{}'::jsonb),
  ('admin_ops', 'trust_communication_oversight', 'view_sensitive_content', 'dual_approval_required', true, true, 'Sensitive content requires case number, purpose, justification and time limit.', '{"max_hours": 24}'::jsonb),
  ('system', 'matching_engine', 'write_match_result', 'service_role_only', false, false, 'Hard gates and explainable score snapshots are written by trusted backend jobs.', '{}'::jsonb),
  ('system', 'document_doctor', 'finalize_ocr_result', 'service_role_only', false, false, 'OCR classification cannot become final without user confirmation.', '{"requires_user_confirmation": true}'::jsonb),
  ('billing', 'trust_badges', 'issue_verified_gold', 'deny', true, true, 'Verified Gold Tick is tied to verification evidence and cannot be purchased.', '{}'::jsonb),
  ('billing', 'trust_badges', 'issue_pro_blue', 'service_role_only', false, false, 'Pro Blue Tick is membership state and separate from verification.', '{}'::jsonb)
on conflict (actor_role, workspace_scope, action_key) do update
set
  decision = excluded.decision,
  requires_mfa = excluded.requires_mfa,
  requires_case = excluded.requires_case,
  notes = excluded.notes,
  conditions = excluded.conditions,
  updated_at = now();

comment on table public.maritime_seafarer_workspaces is 'Seafarer Workspace state for Allona Maritime autonomous hiring. Writes stay server controlled.';
comment on table public.maritime_readiness_passports is 'Readiness Passport header. This is a professional maritime identity, not a physical passport.';
comment on table public.maritime_readiness_items is 'Evidence items with source and trust level for readiness, verification and explainable matching.';
comment on table public.maritime_document_intakes is 'Smart Document Doctor intake records. OCR/classification must remain user-confirmed before finalization.';
comment on table public.maritime_vessel_profiles is 'Verified vessel profiles. Material vessel changes require reapproval through versioned review.';
comment on table public.maritime_jobs is 'Structured maritime jobs created from reviewed requirements and deterministic hard gates.';
comment on table public.maritime_match_results is 'Deterministic hard gate and explainable preference score snapshots for candidate matching.';
comment on table public.maritime_private_candidate_rooms is 'One candidate per room; candidates never share a room or see each other.';
comment on table public.maritime_hiring_rooms is 'Company-side multi-candidate workspace inside the existing Partner tenant model.';
comment on table public.maritime_crew_rooms is 'Post-hire Crew Room for minimum required operational information only.';
comment on table public.maritime_connect_provider_adapters is 'Provider abstraction for messaging and WebRTC media. Secret values are never stored here.';
comment on table public.maritime_trust_cases is 'Allona Trust oversight case metadata. Sensitive content access is controlled separately.';
comment on table public.maritime_sensitive_access_requests is 'Time-boxed sensitive content access request with purpose, case and justification.';
comment on table public.maritime_access_events is 'Append-only view/download/share/sensitive-access event log for Maritime resources.';
comment on table public.maritime_permission_matrix is 'Role, workspace and action decision matrix for Maritime access control.';
comment on table public.maritime_trust_badges is 'Verification and membership badges. Verified Gold requires review evidence; Pro Blue is separate membership state.';
