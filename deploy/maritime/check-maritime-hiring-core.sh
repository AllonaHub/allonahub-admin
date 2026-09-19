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
    'public.maritime_record_access_event(uuid,text,uuid,text,text,text,jsonb)',
    'public.confirm_maritime_document_extraction(uuid,jsonb)',
    'public.prepare_maritime_smart_account(uuid,text,text,jsonb,jsonb)',
    'public.confirm_maritime_smart_account(uuid,boolean)',
    'public.create_maritime_application_drafts(uuid,uuid[],boolean)',
    'public.submit_maritime_application(uuid,boolean)',
    'public.apply_maritime_automatic_applications(uuid,uuid)',
    'public.set_maritime_auto_apply_preference(boolean,boolean)',
    'public.maritime_auto_apply_after_run_confirmation()',
    'public.maritime_auto_apply_after_match_change()',
    'public.set_maritime_availability(text,date,boolean)',
    'public.enforce_maritime_application_match_firewall()',
    'public.maritime_device_registration_allowed(text)',
    'public.maritime_check_device_access(uuid,text)',
    'public.maritime_bind_device_to_user(uuid,text,text,text)',
    'public.save_locked_maritime_cv_profile(uuid,jsonb,integer,text,text)',
    'public.support_replace_maritime_cv_identity(uuid,jsonb,uuid,uuid)',
    'public.grant_maritime_pdf_entitlement(uuid,text,text)',
    'public.consume_maritime_pdf_download(uuid,text,text,uuid)',
    'public.marsoh_can_read_channel(uuid)',
    'public.marsoh_sender_is_blocked(uuid)',
    'public.marsoh_visible_messages(uuid,timestamp with time zone,integer)',
    'public.marsoh_accept_text_message(uuid,uuid,uuid,text,uuid,text,text,text,text,text,text,text,numeric,text,text,text,text,text)',
    'public.marsoh_admin_decide_message(uuid,uuid,text,text)',
    'public.marsoh_admin_remove_published_messages(uuid,text,uuid)'
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
    'maritime_document_batches',
    'maritime_document_extractions',
    'maritime_cv_profiles',
    'maritime_cv_identity_locks',
    'maritime_cv_device_bindings',
    'maritime_smart_portrait_reviews',
    'maritime_cv_generations',
    'maritime_work_status_events',
    'maritime_vessel_profiles',
    'maritime_jobs',
    'maritime_job_versions',
    'maritime_job_assistant_drafts',
    'maritime_hiring_applications',
    'maritime_match_results',
    'maritime_smart_account_runs',
    'maritime_application_permission_batches',
    'maritime_auto_apply_preferences',
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
    'maritime_trust_badges',
    'maritime_commerce_settings',
    'maritime_premium_features',
    'maritime_premium_memberships',
    'maritime_pdf_payments',
    'maritime_pdf_entitlements',
    'maritime_pdf_downloads',
    'maritime_vessel_lookup_cache',
    'maritime_reference_verification_requests',
    'maritime_employment_reference_claims',
    'maritime_partner_reference_reviews',
    'marsoh_channels',
    'marsoh_channel_memberships',
    'marsoh_messages',
    'marsoh_moderation_decisions',
    'marsoh_published_messages',
    'marsoh_translation_cache',
    'marsoh_message_reactions',
    'marsoh_user_blocks',
    'marsoh_message_reports',
    'marsoh_user_sanctions',
    'marsoh_rate_limit_events',
    'marsoh_audit_events',
    'marsoh_topic_cards'
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
      ('maritime_document_batches', 'maritime_document_batches_select_own_or_admin'),
      ('maritime_document_extractions', 'maritime_document_extractions_select_own_or_admin'),
      ('maritime_cv_profiles', 'maritime_cv_profiles_select_own_or_admin'),
      ('maritime_vessel_profiles', 'maritime_partner_tables_select_partner_or_admin'),
      ('maritime_jobs', 'maritime_jobs_select_partner_or_admin'),
      ('maritime_hiring_applications', 'maritime_applications_select_participant'),
      ('maritime_match_results', 'maritime_match_results_select_participant'),
      ('maritime_smart_account_runs', 'maritime_smart_account_runs_select_own_or_admin'),
      ('maritime_application_permission_batches', 'maritime_application_permission_batches_select_own_or_admin'),
      ('maritime_auto_apply_preferences', 'maritime_auto_apply_preferences_select_own_or_admin'),
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
    from storage.buckets
    where id = 'maritime-private-documents'
      and public = false
      and file_size_limit = 47185920
  ) or not exists (
    select 1
    from storage.buckets
    where id = 'maritime-profile-photos'
      and public = false
      and file_size_limit = 2097152
  ) then
    raise exception 'Private maritime storage buckets are missing or unsafe';
  end if;

  if has_function_privilege('anon', 'public.confirm_maritime_document_extraction(uuid,jsonb)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.confirm_maritime_document_extraction(uuid,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.prepare_maritime_smart_account(uuid,text,text,jsonb,jsonb)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.prepare_maritime_smart_account(uuid,text,text,jsonb,jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.submit_maritime_application(uuid,boolean)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.submit_maritime_application(uuid,boolean)', 'EXECUTE') then
    raise exception 'Maritime Global Passport function grants are unsafe';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'public.maritime_hiring_applications'::regclass
      and trigger_row.tgname = 'maritime_application_match_firewall'
      and not trigger_row.tgisinternal
  ) or has_function_privilege('authenticated', 'public.enforce_maritime_application_match_firewall()', 'EXECUTE') then
    raise exception 'Maritime application matching firewall is missing or unsafe';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'maritime_hiring_applications'
      and column_name = 'submission_mode'
      and is_nullable = 'NO'
      and column_default ilike '%manual%'
  ) or not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.maritime_hiring_applications'::regclass
      and conname = 'maritime_hiring_applications_submission_mode_check'
      and pg_get_constraintdef(oid) ilike '%manual%'
      and pg_get_constraintdef(oid) ilike '%automatic%'
  ) then
    raise exception 'Maritime application submission source boundary is incomplete';
  end if;

  if has_function_privilege('anon', 'public.set_maritime_auto_apply_preference(boolean,boolean)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.set_maritime_auto_apply_preference(boolean,boolean)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.apply_maritime_automatic_applications(uuid,uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.apply_maritime_automatic_applications(uuid,uuid)', 'EXECUTE')
    or not exists (
      select 1
      from pg_trigger trigger_row
      where trigger_row.tgrelid = 'public.maritime_smart_account_runs'::regclass
        and trigger_row.tgname = 'maritime_auto_apply_run_confirmation'
        and not trigger_row.tgisinternal
    ) or not exists (
      select 1
      from pg_trigger trigger_row
      where trigger_row.tgrelid = 'public.maritime_match_results'::regclass
        and trigger_row.tgname = 'maritime_auto_apply_match_change'
        and not trigger_row.tgisinternal
    ) then
    raise exception 'Maritime automatic application consent boundary is missing or unsafe';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'public.maritime_cv_profiles'::regclass
      and trigger_row.tgname = 'maritime_cv_profiles_identity_lock'
      and not trigger_row.tgisinternal
  )
    or has_function_privilege('authenticated', 'public.save_locked_maritime_cv_profile(uuid,jsonb,integer,text,text)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.save_locked_maritime_cv_profile(uuid,jsonb,integer,text,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.support_replace_maritime_cv_identity(uuid,jsonb,uuid,uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.support_replace_maritime_cv_identity(uuid,jsonb,uuid,uuid)', 'EXECUTE') then
    raise exception 'Maritime CV identity lock functions, trigger, or grants are unsafe';
  end if;

  if has_function_privilege('authenticated', 'public.grant_maritime_pdf_entitlement(uuid,text,text)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.grant_maritime_pdf_entitlement(uuid,text,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.consume_maritime_pdf_download(uuid,text,text,uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.consume_maritime_pdf_download(uuid,text,text,uuid)', 'EXECUTE')
    or exists (
      select 1 from public.maritime_commerce_settings
      where premium_surface_enabled or premium_entitlements_enabled
    ) then
    raise exception 'Hidden Maritime Premium or PDF entitlement boundary is unsafe';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.maritime_vessel_lookup_cache'::regclass
      and conname = 'maritime_vessel_lookup_cache_provider_check'
      and pg_get_constraintdef(oid) ilike '%marinetraffic%'
      and pg_get_constraintdef(oid) ilike '%vesselfinder_public%'
      and pg_get_constraintdef(oid) ilike '%wikidata%'
  ) then
    raise exception 'Maritime vessel lookup cache provider constraint is incomplete';
  end if;

  if has_table_privilege('authenticated', 'public.marsoh_messages', 'SELECT')
    or has_table_privilege('authenticated', 'public.marsoh_messages', 'INSERT')
    or has_table_privilege('authenticated', 'public.marsoh_moderation_decisions', 'SELECT')
    or has_table_privilege('authenticated', 'public.marsoh_message_reactions', 'SELECT')
    or not has_table_privilege('authenticated', 'public.marsoh_published_messages', 'SELECT')
    or not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'marsoh_published_messages'
    ) then
    raise exception 'MarSoh moderation or Realtime publication boundary is unsafe';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.marsoh_message_reactions'::regclass
      and conname = 'marsoh_message_reactions_emoji_check'
      and pg_get_constraintdef(oid) like '%🧭%'
      and pg_get_constraintdef(oid) like '%🫡%'
      and pg_get_constraintdef(oid) like '%😊%'
  ) then
    raise exception 'MarSoh reaction constraint is incomplete';
  end if;

  if not exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'marsoh_published_messages'
      and policy.policyname = 'marsoh_published_member_select'
      and policy.qual ilike '%sender_user_id <> auth.uid()%'
      and policy.qual ilike '%marsoh_sender_is_blocked%'
  ) then
    raise exception 'MarSoh published-message RLS does not protect sender moderation state or user blocks';
  end if;

  if has_function_privilege('authenticated', 'public.marsoh_admin_remove_published_messages(uuid,text,uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.marsoh_admin_remove_published_messages(uuid,text,uuid)', 'EXECUTE')
    or exists (
      select 1
      from (values ('created_by'), ('updated_by'), ('updated_at')) as expected(column_name)
      where not exists (
        select 1
        from information_schema.columns column_info
        where column_info.table_schema = 'public'
          and column_info.table_name = 'marsoh_topic_cards'
          and column_info.column_name = expected.column_name
      )
    ) then
    raise exception 'MarSoh management function grants or topic audit columns are incomplete';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.maritime_cv_identity_locks'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%person_fingerprint%'
  )
    or not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.maritime_cv_device_bindings'::regclass
        and contype = 'p'
        and pg_get_constraintdef(oid) ilike '%device_fingerprint%'
    ) then
    raise exception 'Maritime CV identity or device uniqueness constraint is missing';
  end if;

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
