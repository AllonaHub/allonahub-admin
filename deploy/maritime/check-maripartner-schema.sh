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
    'maritime_reviewer_passes', 'maritime_reviewer_decisions'
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

  if to_regprocedure('public.maritime_transfer_hiring_case(uuid,uuid,uuid,uuid,text,jsonb,uuid)') is null then
    raise exception 'MariPartner atomic handover function is missing';
  end if;

  if has_function_privilege('anon', 'public.maritime_transfer_hiring_case(uuid,uuid,uuid,uuid,text,jsonb,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.maritime_transfer_hiring_case(uuid,uuid,uuid,uuid,text,jsonb,uuid)', 'EXECUTE') then
    raise exception 'Direct client execution detected on MariPartner handover function';
  end if;

  if pg_get_functiondef('public.maritime_transfer_hiring_case(uuid,uuid,uuid,uuid,text,jsonb,uuid)'::regprocedure)
      not ilike '%security definer%set search_path = public, pg_temp%' then
    raise exception 'MariPartner handover function is missing hardened SECURITY DEFINER settings';
  end if;

  if to_regprocedure('public.maritime_record_reviewer_decision(uuid,text,text)') is null then
    raise exception 'MariPartner atomic reviewer decision function is missing';
  end if;

  if has_function_privilege('anon', 'public.maritime_record_reviewer_decision(uuid,text,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.maritime_record_reviewer_decision(uuid,text,text)', 'EXECUTE') then
    raise exception 'Direct client execution detected on MariPartner reviewer decision function';
  end if;

  if pg_get_functiondef('public.maritime_record_reviewer_decision(uuid,text,text)'::regprocedure)
      not ilike '%security definer%set search_path = public, pg_temp%' then
    raise exception 'MariPartner reviewer decision function is missing hardened SECURITY DEFINER settings';
  end if;

  if exists (
    select 1
    from (values ('token'), ('code'), ('reviewer_contact')) as forbidden(column_name)
    where exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'maritime_reviewer_passes'
        and information_schema.columns.column_name = forbidden.column_name
    )
  ) then
    raise exception 'MariPartner stores a raw reviewer secret or contact value';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'maritime_evidence_requests'
      and column_name = 'candidate_consent_status'
  ) then
    raise exception 'MariPartner candidate consent state is missing';
  end if;
end
$maripartner_check$;
SQL

echo "MariPartner schema check passed."
