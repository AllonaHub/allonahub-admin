#!/usr/bin/env bash
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-${POSTGRES_URL:-}}}"

if [ -z "$DB_URL" ]; then
  echo "Set SUPABASE_DB_URL, DATABASE_URL or POSTGRES_URL before checking the maritime hiring core schema." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to check the maritime hiring core schema." >&2
  exit 1
fi

psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 <<'SQL'
do $maritime_hiring_core_check$
declare
  expected_table text;
  expected_policy record;
  helper_name text;
begin
  if to_regprocedure('public.partner_member_has_access(uuid)') is null
    or to_regprocedure('public.is_admin()') is null
    or to_regprocedure('public.has_mfa()') is null then
    raise exception 'Maritime hiring core requires Partner OS and MFA security helpers first';
  end if;

  foreach helper_name in array array[
    'public.maritime_can_access_partner(uuid)',
    'public.maritime_partner_member_without_admin(uuid)',
    'public.maritime_can_access_candidate_room(uuid)',
    'public.maritime_can_access_hiring_room(uuid)',
    'public.maritime_can_access_crew_room(uuid)',
    'public.maritime_can_access_connect_thread(uuid)',
    'public.maritime_can_access_connect_thread_content(uuid)',
    'public.maritime_valid_hiring_transition(text,text)',
    'public.maritime_record_access_event(uuid,text,uuid,text,text,text,jsonb)'
  ] loop
    if to_regprocedure(helper_name) is null then
      raise exception 'Missing maritime hiring helper function: %', helper_name;
    end if;
  end loop;

  foreach expected_table in array array[
    'maritime_seafarer_workspaces',
    'maritime_readiness_passports',
    'maritime_readiness_items',
    'maritime_document_intakes',
    'maritime_smart_portrait_reviews',
    'maritime_cv_generations',
    'maritime_work_status_events',
    'maritime_vessel_profiles',
    'maritime_jobs',
    'maritime_job_versions',
    'maritime_job_assistant_drafts',
    'maritime_hiring_applications',
    'maritime_match_results',
    'maritime_hiring_rooms',
    'maritime_private_candidate_rooms',
    'maritime_crew_rooms',
    'maritime_crew_room_members',
    'maritime_connect_provider_adapters',
    'maritime_connect_threads',
    'maritime_connect_messages',
    'maritime_connect_broadcasts',
    'maritime_connect_sessions',
    'maritime_interviews',
    'maritime_work_relationships',
    'maritime_reference_requests',
    'maritime_reference_responses',
    'maritime_offers_contracts',
    'maritime_urgent_crew_requests',
    'maritime_bulk_invite_batches',
    'maritime_favorite_candidates',
    'maritime_crew_matrix_snapshots',
    'maritime_relief_rehire_plans',
    'maritime_billing_events',
    'maritime_trust_cases',
    'maritime_sensitive_access_requests',
    'maritime_access_grants',
    'maritime_access_events',
    'maritime_permission_matrix',
    'maritime_entity_versions',
    'maritime_workflow_transition_log',
    'maritime_trust_badges'
  ] loop
    if to_regclass(format('public.%I', expected_table)) is null then
      raise exception 'Missing maritime hiring core table: %', expected_table;
    end if;

    if not (
      select relation.relrowsecurity
      from pg_class relation
      where relation.oid = to_regclass(format('public.%I', expected_table))
    ) then
      raise exception 'RLS is not enabled for maritime hiring core table: %', expected_table;
    end if;

    if has_table_privilege('anon', format('public.%I', expected_table), 'SELECT')
      or has_table_privilege('anon', format('public.%I', expected_table), 'INSERT')
      or has_table_privilege('anon', format('public.%I', expected_table), 'UPDATE')
      or has_table_privilege('anon', format('public.%I', expected_table), 'DELETE')
      or has_table_privilege('authenticated', format('public.%I', expected_table), 'INSERT')
      or has_table_privilege('authenticated', format('public.%I', expected_table), 'UPDATE')
      or has_table_privilege('authenticated', format('public.%I', expected_table), 'DELETE') then
      raise exception 'Unsafe client table privilege detected on maritime hiring core table: %', expected_table;
    end if;
  end loop;

  for expected_policy in
    select * from (values
      ('maritime_seafarer_workspaces', 'maritime_seafarer_workspaces_select_own_or_admin'),
      ('maritime_readiness_passports', 'maritime_readiness_passports_select_own_or_admin'),
      ('maritime_document_intakes', 'maritime_document_intakes_select_own_or_admin'),
      ('maritime_vessel_profiles', 'maritime_partner_tables_select_partner_or_admin'),
      ('maritime_jobs', 'maritime_jobs_select_partner_or_admin'),
      ('maritime_hiring_applications', 'maritime_applications_select_participant'),
      ('maritime_match_results', 'maritime_match_results_select_participant'),
      ('maritime_hiring_rooms', 'maritime_hiring_rooms_select_partner_or_admin'),
      ('maritime_private_candidate_rooms', 'maritime_candidate_rooms_select_participant'),
      ('maritime_crew_rooms', 'maritime_crew_rooms_select_partner_or_member'),
      ('maritime_connect_threads', 'maritime_connect_threads_select_participant'),
      ('maritime_connect_messages', 'maritime_connect_messages_select_thread_participant'),
      ('maritime_trust_cases', 'maritime_trust_cases_select_admin'),
      ('maritime_sensitive_access_requests', 'maritime_sensitive_access_requests_select_admin'),
      ('maritime_access_events', 'maritime_access_events_select_authorized'),
      ('maritime_permission_matrix', 'maritime_permission_matrix_select_admin'),
      ('maritime_trust_badges', 'maritime_trust_badges_select_authorized')
    ) as policies(table_name, policy_name)
  loop
    if not exists (
      select 1
      from pg_policies policy
      where policy.schemaname = 'public'
        and policy.tablename = expected_policy.table_name
        and policy.policyname = expected_policy.policy_name
    ) then
      raise exception 'Missing maritime hiring core RLS policy: %.%', expected_policy.table_name, expected_policy.policy_name;
    end if;
  end loop;

  if not exists (
    select 1
    from public.maritime_connect_provider_adapters
    where provider_key = 'webrtc_provider_pending'
      and status = 'planned'
      and default_recording_policy = 'not_recorded'
      and capabilities ? 'video'
  ) then
    raise exception 'Maritime Connect provider abstraction seed is missing or unsafe';
  end if;

  if exists (
    select 1
    from public.maritime_connect_provider_adapters
    where coalesce(secret_ref, '') ~ '(sk_|AKIA|eyJ|-----BEGIN|secret=|token=)'
  ) then
    raise exception 'Provider adapter secret_ref appears to contain a raw secret value';
  end if;

  if coalesce(
    pg_get_functiondef(to_regprocedure('public.maritime_can_access_connect_thread_content(uuid)')) ilike '%is_admin%',
    true
  ) then
    raise exception 'Connect message content helper must not grant default admin/God Mode access';
  end if;

  if not exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'maritime_connect_messages'
      and policy.policyname = 'maritime_connect_messages_select_thread_participant'
      and policy.qual ilike '%maritime_can_access_connect_thread_content%'
  ) then
    raise exception 'Connect messages must use the content-only participant access helper';
  end if;

  if not exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'maritime_reference_responses'
      and policy.policyname = 'maritime_reference_responses_select_authorized'
      and policy.qual ilike '%visibility_scope%'
      and policy.qual ilike '%authorized_company_only%'
      and policy.qual ilike '%candidate_only%'
      and policy.qual not ilike '%public.is_admin%'
  ) then
    raise exception 'Reference responses must stay visibility-scoped and must not expose employer references by default admin access';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.maritime_sensitive_access_requests'::regclass
      and conname = 'maritime_sensitive_access_timebox'
      and pg_get_constraintdef(oid) ilike '%24 hours%'
  ) then
    raise exception 'Sensitive access requests are missing the 24 hour timebox constraint';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.maritime_trust_badges'::regclass
      and conname = 'maritime_trust_badges_gold_requires_review'
  ) then
    raise exception 'Verified Gold badge evidence constraint is missing';
  end if;

  if not public.maritime_valid_hiring_transition('submitted', 'shortlisted')
    or public.maritime_valid_hiring_transition('hired', 'offer_sent') then
    raise exception 'Maritime hiring application transition guard is not enforcing terminal states';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'maritime_access_events_append_only'
      and tgrelid = 'public.maritime_access_events'::regclass
  )
    or not exists (
      select 1
      from pg_trigger
      where tgname = 'maritime_workflow_transition_log_append_only'
        and tgrelid = 'public.maritime_workflow_transition_log'::regclass
    ) then
    raise exception 'Maritime append-only audit triggers are missing';
  end if;

  if not exists (
    select 1
    from public.maritime_permission_matrix
    where actor_role = 'admin_ops'
      and workspace_scope = 'trust_communication_oversight'
      and action_key = 'view_sensitive_content'
      and decision = 'dual_approval_required'
      and requires_case = true
      and requires_mfa = true
  ) then
    raise exception 'Trust oversight sensitive-content access rule is missing';
  end if;
end
$maritime_hiring_core_check$;
SQL

echo "Maritime hiring core schema check passed."
