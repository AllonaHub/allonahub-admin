#!/usr/bin/env bash
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-${POSTGRES_URL:-}}}"

if [ -z "$DB_URL" ]; then
  echo "Set SUPABASE_DB_URL, DATABASE_URL or POSTGRES_URL before checking MariPartner." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to check the MariPartner schema." >&2
  exit 1
fi

psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 <<'SQL'
do $maripartner_check$
declare
  table_name text;
begin
  foreach table_name in array array[
    'maritime_talent_refresh_campaigns', 'maritime_talent_refresh_requests',
    'maritime_evidence_templates', 'maritime_evidence_requirements', 'maritime_evidence_requests',
    'maritime_hiring_sla_policies', 'maritime_hiring_sla_instances',
    'maritime_hiring_case_ownership', 'maritime_hiring_handovers',
    'maritime_reviewer_passes', 'maritime_reviewer_decisions',
    'maritime_company_verification_cycles', 'maritime_recruiter_authorities',
    'maritime_vessel_company_relationships', 'maritime_evidence_assertions',
    'maritime_verification_checks', 'maritime_employer_reference_matches',
    'maritime_employer_references', 'maritime_employer_reference_ratings',
    'maritime_employer_reference_answers', 'maritime_employer_reference_versions',
    'maritime_employer_reference_moderation', 'maritime_employer_reference_access_logs',
    'maritime_employer_reference_disputes', 'maritime_partner_notifications',
    'maritime_match_evaluations', 'maritime_sea_service_conflicts', 'maritime_decision_records', 'maritime_automation_policies',
    'maritime_automation_executions', 'maritime_consent_receipts',
    'maritime_trust_case_events', 'maritime_trust_appeals',
    'maritime_data_rights_requests', 'maritime_legal_holds',
    'maritime_interview_template_versions', 'maritime_interview_reviews',
    'maritime_integration_connections', 'maritime_import_jobs',
    'maritime_webhook_deliveries', 'maritime_metric_snapshots',
    'maritime_partner_notification_preferences', 'maritime_partner_saved_searches',
    'maritime_partner_operation_requests'
  ] loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'Missing MariPartner table: %', table_name;
    end if;

    if not (select relrowsecurity from pg_class where oid = to_regclass(format('public.%I', table_name))) then
      raise exception 'RLS is not enabled for MariPartner table: %', table_name;
    end if;

    if has_table_privilege('anon', format('public.%I', table_name), 'SELECT')
      or has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT')
      or has_table_privilege('anon', format('public.%I', table_name), 'INSERT')
      or has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT')
      or has_table_privilege('authenticated', format('public.%I', table_name), 'UPDATE')
      or has_table_privilege('authenticated', format('public.%I', table_name), 'DELETE') then
      raise exception 'Direct client privilege detected on MariPartner table: %', table_name;
    end if;
  end loop;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'maritime_urgent_crew_requests'
      and indexname = 'maritime_urgent_crew_requests_idempotency_uidx'
  ) then
    raise exception 'MariPartner urgent crew idempotency index is missing';
  end if;

  if to_regprocedure('public.maritime_transfer_hiring_case(uuid,uuid,uuid,uuid,text,jsonb,uuid)') is null then
    raise exception 'MariPartner atomic handover function is missing';
  end if;

  if has_function_privilege('anon', 'public.maritime_transfer_hiring_case(uuid,uuid,uuid,uuid,text,jsonb,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.maritime_transfer_hiring_case(uuid,uuid,uuid,uuid,text,jsonb,uuid)', 'EXECUTE') then
    raise exception 'Direct client execution detected on MariPartner handover function';
  end if;

  if not exists (
    select 1
    from pg_proc procedure
    where procedure.oid = 'public.maritime_transfer_hiring_case(uuid,uuid,uuid,uuid,text,jsonb,uuid)'::regprocedure
      and procedure.prosecdef
      and coalesce(procedure.proconfig, array[]::text[]) @> array['search_path=public, pg_temp']::text[]
  ) then
    raise exception 'MariPartner handover function is missing hardened SECURITY DEFINER settings';
  end if;

  if to_regprocedure('public.maritime_record_reviewer_decision(uuid,text,text)') is null then
    raise exception 'MariPartner atomic reviewer decision function is missing';
  end if;

  if has_function_privilege('anon', 'public.maritime_record_reviewer_decision(uuid,text,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.maritime_record_reviewer_decision(uuid,text,text)', 'EXECUTE') then
    raise exception 'Direct client execution detected on MariPartner reviewer decision function';
  end if;

  if not exists (
    select 1
    from pg_proc procedure
    where procedure.oid = 'public.maritime_record_reviewer_decision(uuid,text,text)'::regprocedure
      and procedure.prosecdef
      and coalesce(procedure.proconfig, array[]::text[]) @> array['search_path=public, pg_temp']::text[]
  ) then
    raise exception 'MariPartner reviewer decision function is missing hardened SECURITY DEFINER settings';
  end if;

  if exists (
    select 1
    from (values ('token'), ('code'), ('reviewer_contact')) as forbidden(column_name)
    where exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and information_schema.columns.table_name = 'maritime_reviewer_passes'
        and information_schema.columns.column_name = forbidden.column_name
    )
  ) then
    raise exception 'MariPartner stores a raw reviewer secret or contact value';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and information_schema.columns.table_name = 'maritime_evidence_requests'
      and column_name = 'candidate_consent_status'
  ) then
    raise exception 'MariPartner candidate consent state is missing';
  end if;

  if has_function_privilege('anon', 'public.maritime_guard_reference_approval()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.maritime_guard_reference_approval()', 'EXECUTE') then
    raise exception 'Direct client execution detected on employer reference approval guard';
  end if;

  if not exists (
    select 1
    from pg_proc procedure
    where procedure.oid = 'public.maritime_guard_reference_approval()'::regprocedure
      and procedure.prosecdef
      and coalesce(procedure.proconfig, array[]::text[]) @> array['search_path=public, pg_temp']::text[]
  ) then
    raise exception 'Employer reference guard is missing hardened SECURITY DEFINER settings';
  end if;

  if to_regprocedure('public.sync_verified_partner_business_roles()') is null
    or to_regprocedure('public.sync_verified_partner_staff_role()') is null then
    raise exception 'Verified partner account role synchronization functions are missing';
  end if;

  if has_function_privilege('anon', 'public.sync_verified_partner_business_roles()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.sync_verified_partner_business_roles()', 'EXECUTE')
    or has_function_privilege('anon', 'public.sync_verified_partner_staff_role()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.sync_verified_partner_staff_role()', 'EXECUTE') then
    raise exception 'Direct client execution detected on verified partner role synchronization';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.partner_businesses'::regclass
      and tgname = 'partner_businesses_sync_verified_roles'
      and not tgisinternal
  ) or not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.partner_staff'::regclass
      and tgname = 'partner_staff_sync_verified_role'
      and not tgisinternal
  ) then
    raise exception 'Verified partner account role synchronization triggers are missing';
  end if;

  if not exists (
    select 1 from storage.buckets
    where id = 'maritime-partner-logos'
      and public = true
      and file_size_limit = 2097152
      and allowed_mime_types = array['image/webp']::text[]
  ) then
    raise exception 'MariPartner company logo bucket is missing or unsafe';
  end if;

  if to_regclass('public.maritime_candidate_document_grants') is null then
    raise exception 'Candidate document permission table is missing';
  end if;

  if not exists (
    select 1 from pg_class c
    where c.oid = 'public.maritime_candidate_document_grants'::regclass
      and c.relrowsecurity
  ) or has_table_privilege('authenticated', 'public.maritime_candidate_document_grants', 'SELECT')
    or has_table_privilege('authenticated', 'public.maritime_candidate_document_grants', 'INSERT')
    or has_table_privilege('authenticated', 'public.maritime_candidate_document_grants', 'UPDATE') then
    raise exception 'Candidate document permissions must be server-only and RLS protected';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and roles::text like '%authenticated%'
      and (
        coalesce(qual, '') like '%maritime-partner-logos%'
        or coalesce(with_check, '') like '%maritime-partner-logos%'
      )
  ) then
    raise exception 'MariPartner logo bucket must not allow direct authenticated writes';
  end if;
end
$maripartner_check$;
SQL

echo "MariPartner schema check passed."
