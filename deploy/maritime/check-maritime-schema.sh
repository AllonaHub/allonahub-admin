#!/usr/bin/env bash
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-${POSTGRES_URL:-}}}"

if [ -z "$DB_URL" ]; then
  echo "Set SUPABASE_DB_URL, DATABASE_URL or POSTGRES_URL before checking the maritime schema." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to check the maritime schema." >&2
  exit 1
fi

psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 <<'SQL'
do $maritime_check$
declare
  expected_table text;
  expected_policy record;
  offer_policy_expression text;
  listing_partner_policy_expression text;
  listing_public_policy_expression text;
  freight_create_function regprocedure;
  freight_cancel_function regprocedure;
  offer_accept_function regprocedure;
  offer_accept_v2_function regprocedure;
  freight_assign_function regprocedure;
  freight_submit_function regprocedure;
  freight_decline_function regprocedure;
  freight_withdraw_function regprocedure;
  freight_reconcile_function regprocedure;
begin
  if to_regprocedure('public.has_mfa()') is null
    or to_regprocedure('public.is_admin()') is null
    or to_regprocedure('public.is_partner_or_admin()') is null
    or not coalesce(
      pg_get_functiondef(to_regprocedure('public.is_admin()')) ilike '%has_mfa%',
      false
    )
    or not coalesce(
      pg_get_functiondef(to_regprocedure('public.is_partner_or_admin()')) ilike '%has_mfa%',
      false
    ) then
    raise exception 'Maritime privileged access helpers are missing MFA enforcement';
  end if;

  foreach expected_table in array array[
    'maritime_freight_requests',
    'maritime_freight_request_events',
    'maritime_partner_applications',
    'maritime_public_listings',
    'maritime_freight_offers',
    'maritime_freight_matches'
  ] loop
    if to_regclass(format('public.%I', expected_table)) is null then
      raise exception 'Missing maritime table: %', expected_table;
    end if;

    if not (
      select relation.relrowsecurity
      from pg_class relation
      where relation.oid = to_regclass(format('public.%I', expected_table))
    ) then
      raise exception 'RLS is not enabled for maritime table: %', expected_table;
    end if;

    if has_table_privilege('anon', format('public.%I', expected_table), 'INSERT')
      or has_table_privilege('anon', format('public.%I', expected_table), 'UPDATE')
      or has_table_privilege('anon', format('public.%I', expected_table), 'DELETE')
      or has_table_privilege('authenticated', format('public.%I', expected_table), 'INSERT')
      or has_table_privilege('authenticated', format('public.%I', expected_table), 'UPDATE')
      or has_table_privilege('authenticated', format('public.%I', expected_table), 'DELETE') then
      raise exception 'Direct client write privilege detected on maritime table: %', expected_table;
    end if;
  end loop;

  for expected_policy in
    select * from (values
      ('maritime_freight_requests', 'maritime_freight_requests_select_own_or_admin'),
      ('maritime_freight_requests', 'maritime_freight_requests_admin_update'),
      ('maritime_freight_request_events', 'maritime_freight_request_events_select_related'),
      ('maritime_partner_applications', 'maritime_partner_applications_admin_select'),
      ('maritime_public_listings', 'maritime_public_listings_public_active_select'),
      ('maritime_public_listings', 'maritime_public_listings_admin_select'),
      ('maritime_public_listings', 'maritime_public_listings_partner_select_own'),
      ('maritime_freight_offers', 'maritime_freight_offers_select_authorized'),
      ('maritime_freight_matches', 'maritime_freight_matches_partner_select_own'),
      ('maritime_freight_matches', 'maritime_freight_matches_admin_select')
    ) as policies(table_name, policy_name)
  loop
    if not exists (
      select 1
      from pg_policies policy
      where policy.schemaname = 'public'
        and policy.tablename = expected_policy.table_name
        and policy.policyname = expected_policy.policy_name
    ) then
      raise exception 'Missing maritime RLS policy: %.%', expected_policy.table_name, expected_policy.policy_name;
    end if;
  end loop;

  if not has_table_privilege('anon', 'public.maritime_public_listings', 'SELECT') then
    raise exception 'Anonymous active-listing read grant is missing';
  end if;

  if has_table_privilege('anon', 'public.maritime_freight_requests', 'SELECT')
    or has_table_privilege('anon', 'public.maritime_freight_request_events', 'SELECT')
    or has_table_privilege('anon', 'public.maritime_partner_applications', 'SELECT')
    or has_table_privilege('anon', 'public.maritime_freight_offers', 'SELECT')
    or has_table_privilege('anon', 'public.maritime_freight_matches', 'SELECT') then
    raise exception 'Anonymous read privilege detected on a private maritime table';
  end if;

  if not has_table_privilege('authenticated', 'public.maritime_freight_requests', 'SELECT')
    or not has_table_privilege('authenticated', 'public.maritime_freight_request_events', 'SELECT')
    or not has_table_privilege('authenticated', 'public.maritime_freight_offers', 'SELECT') then
    raise exception 'Authenticated freight tracking read grants are missing';
  end if;

  select policy.qual
  into offer_policy_expression
  from pg_policies policy
  where policy.schemaname = 'public'
    and policy.tablename = 'maritime_freight_offers'
    and policy.policyname = 'maritime_freight_offers_select_authorized';

  if offer_policy_expression is null
    or offer_policy_expression not ilike '%broker_user_id%auth.uid%'
    or offer_policy_expression not ilike '%maritime_freight_requests%request.user_id%auth.uid%'
    or offer_policy_expression not ilike '%submitted%accepted%rejected%expired%' then
    raise exception 'Maritime freight offer visibility policy does not match the owner/partner status boundary';
  end if;

  select policy.qual
  into listing_partner_policy_expression
  from pg_policies policy
  where policy.schemaname = 'public'
    and policy.tablename = 'maritime_public_listings'
    and policy.policyname = 'maritime_public_listings_partner_select_own';

  if listing_partner_policy_expression is null
    or listing_partner_policy_expression not ilike '%partner_user_id%auth.uid%'
    or listing_partner_policy_expression not ilike '%is_partner_or_admin%' then
    raise exception 'Maritime partner listing policy does not enforce owner plus MFA partner access';
  end if;

  select policy.qual
  into listing_public_policy_expression
  from pg_policies policy
  where policy.schemaname = 'public'
    and policy.tablename = 'maritime_public_listings'
    and policy.policyname = 'maritime_public_listings_public_active_select';

  if listing_public_policy_expression is null
    or listing_public_policy_expression not ilike '%module_key%maritime%'
    or listing_public_policy_expression not ilike '%status%active%'
    or listing_public_policy_expression not ilike '%published_at%now%'
    or listing_public_policy_expression not ilike '%expires_at%now%' then
    raise exception 'Maritime public listing policy does not enforce active publication windows';
  end if;

  if exists (
    select 1
    from (values
      ('partner_user_id'),
      ('client_listing_id'),
      ('submission_source'),
      ('submitted_at'),
      ('reviewed_at'),
      ('reviewed_by'),
      ('review_note')
    ) as expected(column_name)
    where not exists (
      select 1
      from information_schema.columns column_info
      where column_info.table_schema = 'public'
        and column_info.table_name = 'maritime_public_listings'
        and column_info.column_name = expected.column_name
    )
  ) then
    raise exception 'Maritime listing approval workflow columns are incomplete';
  end if;

  if exists (
    select 1
    from (values
      ('reviewed_at'),
      ('reviewed_by'),
      ('review_note')
    ) as expected(column_name)
    where not exists (
      select 1
      from information_schema.columns column_info
      where column_info.table_schema = 'public'
        and column_info.table_name = 'maritime_partner_applications'
        and column_info.column_name = expected.column_name
    )
  ) then
    raise exception 'Maritime partner application review columns are incomplete';
  end if;

  if not exists (
    select 1
    from information_schema.columns column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'maritime_freight_offers'
      and column_info.column_name = 'accepted_at'
  ) then
    raise exception 'Maritime freight offer acceptance timestamp is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_info
    where constraint_info.conrelid = 'public.maritime_public_listings'::regclass
      and constraint_info.conname = 'maritime_public_listings_status_check'
      and pg_get_constraintdef(constraint_info.oid) ilike '%pending_review%rejected%'
  ) then
    raise exception 'Maritime listing approval statuses are missing';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_info
    where constraint_info.conrelid = 'public.maritime_freight_request_events'::regclass
      and constraint_info.conname = 'maritime_freight_request_events_event_type_check'
      and pg_get_constraintdef(constraint_info.oid) ilike '%match_declined%'
      and pg_get_constraintdef(constraint_info.oid) ilike '%offer_withdrawn%'
      and pg_get_constraintdef(constraint_info.oid) ilike '%match_expired%'
      and pg_get_constraintdef(constraint_info.oid) ilike '%offer_expired%'
  ) then
    raise exception 'Maritime freight workflow event types are missing';
  end if;

  if to_regclass('public.maritime_freight_requests_user_client_unique') is null
    or to_regclass('public.maritime_partner_applications_client_request_id_key') is null
    or to_regclass('public.maritime_freight_request_events_submitted_unique') is null
    or to_regclass('public.maritime_freight_request_events_cancelled_unique') is null
    or to_regclass('public.maritime_freight_offers_broker_request_unique') is null
    or to_regclass('public.maritime_freight_offers_broker_client_unique') is null
    or to_regclass('public.maritime_freight_offers_one_accepted_per_request') is null
    or to_regclass('public.maritime_public_listings_partner_client_unique') is null
    or to_regclass('public.maritime_public_listings_review_queue_idx') is null
    or to_regclass('public.maritime_freight_request_events_accepted_unique') is null
    or to_regclass('public.maritime_freight_matches_request_partner_unique') is null
    or to_regclass('public.maritime_freight_offers_match_unique') is null
    or to_regclass('public.maritime_freight_request_events_matching_unique') is null
    or to_regclass('public.maritime_freight_request_events_match_declined_unique') is null
    or to_regclass('public.maritime_freight_request_events_offer_withdrawn_unique') is null
    or to_regclass('public.maritime_freight_request_events_match_expired_unique') is null
    or to_regclass('public.maritime_freight_request_events_offer_expired_unique') is null then
    raise exception 'A maritime idempotency or event uniqueness index is missing';
  end if;

  freight_create_function := to_regprocedure('public.create_maritime_freight_request(uuid,uuid,text,text,text,numeric,text,date)');
  if freight_create_function is null then
    raise exception 'Maritime freight request creation RPC is missing';
  end if;

  if not has_function_privilege('service_role', freight_create_function, 'EXECUTE')
    or has_function_privilege('anon', freight_create_function, 'EXECUTE')
    or has_function_privilege('authenticated', freight_create_function, 'EXECUTE') then
    raise exception 'Maritime freight request creation RPC execute grants are unsafe';
  end if;

  if not (
    select function_info.prosecdef
    from pg_proc function_info
    where function_info.oid = freight_create_function
  ) then
    raise exception 'Maritime freight request creation RPC must be SECURITY DEFINER';
  end if;

  if pg_get_functiondef(freight_create_function) not ilike '%on conflict%'
    or pg_get_functiondef(freight_create_function) not ilike '%maritime_freight_request_events%'
    or pg_get_functiondef(freight_create_function) not ilike '%''submitted''%'
    or pg_get_functiondef(freight_create_function) not ilike '%current_date + 730%'
    or pg_get_functiondef(freight_create_function) not ilike '%request_created%' then
    raise exception 'Maritime freight request creation RPC is missing atomic idempotent transitions';
  end if;

  freight_cancel_function := to_regprocedure('public.cancel_maritime_freight_request(uuid,uuid)');
  if freight_cancel_function is null then
    raise exception 'Maritime freight request cancellation RPC is missing';
  end if;

  if not has_function_privilege('service_role', freight_cancel_function, 'EXECUTE')
    or has_function_privilege('anon', freight_cancel_function, 'EXECUTE')
    or has_function_privilege('authenticated', freight_cancel_function, 'EXECUTE') then
    raise exception 'Maritime freight request cancellation RPC execute grants are unsafe';
  end if;

  if not (
    select function_info.prosecdef
    from pg_proc function_info
    where function_info.oid = freight_cancel_function
  ) then
    raise exception 'Maritime freight request cancellation RPC must be SECURITY DEFINER';
  end if;

  if pg_get_functiondef(freight_cancel_function) not ilike '%for update%'
    or pg_get_functiondef(freight_cancel_function) not ilike '%status = ''cancelled''%'
    or pg_get_functiondef(freight_cancel_function) not ilike '%maritime_freight_request_events%'
    or pg_get_functiondef(freight_cancel_function) not ilike '%on conflict%'
    or pg_get_functiondef(freight_cancel_function) not ilike '%request_cancelled%' then
    raise exception 'Maritime freight request cancellation RPC is missing atomic idempotent transitions';
  end if;

  offer_accept_function := to_regprocedure('public.accept_maritime_freight_offer(uuid,uuid,uuid)');
  if offer_accept_function is null then
    raise exception 'Maritime freight offer acceptance RPC is missing';
  end if;

  if not has_function_privilege('service_role', offer_accept_function, 'EXECUTE')
    or has_function_privilege('anon', offer_accept_function, 'EXECUTE')
    or has_function_privilege('authenticated', offer_accept_function, 'EXECUTE') then
    raise exception 'Maritime freight offer acceptance RPC execute grants are unsafe';
  end if;

  if pg_get_functiondef(offer_accept_function) not ilike '%for update%'
    or pg_get_functiondef(offer_accept_function) not ilike '%status = ''rejected''%'
    or pg_get_functiondef(offer_accept_function) not ilike '%status = ''accepted''%'
    or pg_get_functiondef(offer_accept_function) not ilike '%maritime_freight_request_events%' then
    raise exception 'Maritime freight offer acceptance RPC is missing atomic state transitions';
  end if;

  offer_accept_v2_function := to_regprocedure('public.accept_maritime_freight_offer_v2(uuid,uuid,uuid)');
  if offer_accept_v2_function is null then
    raise exception 'Maritime freight offer acceptance v2 RPC is missing';
  end if;

  if not has_function_privilege('service_role', offer_accept_v2_function, 'EXECUTE')
    or has_function_privilege('anon', offer_accept_v2_function, 'EXECUTE')
    or has_function_privilege('authenticated', offer_accept_v2_function, 'EXECUTE') then
    raise exception 'Maritime freight offer acceptance v2 RPC execute grants are unsafe';
  end if;

  if not (
    select function_info.prosecdef
    from pg_proc function_info
    where function_info.oid = offer_accept_v2_function
  ) then
    raise exception 'Maritime freight offer acceptance v2 RPC must be SECURITY DEFINER';
  end if;

  if pg_get_functiondef(offer_accept_v2_function) not ilike '%for update%'
    or pg_get_functiondef(offer_accept_v2_function) not ilike '%public.accept_maritime_freight_offer(p_request_id, p_offer_id, p_user_id)%'
    or pg_get_functiondef(offer_accept_v2_function) not ilike '%previous_status%'
    or pg_get_functiondef(offer_accept_v2_function) not ilike '%acceptance_changed%' then
    raise exception 'Maritime freight offer acceptance v2 RPC is missing locked idempotency reporting';
  end if;

  freight_assign_function := to_regprocedure('public.assign_maritime_freight_partner(uuid,uuid,uuid,timestamptz)');
  freight_submit_function := to_regprocedure('public.submit_maritime_freight_offer(uuid,uuid,uuid,text,text,numeric,text,text,integer,text,timestamptz)');
  if freight_assign_function is null or freight_submit_function is null then
    raise exception 'Maritime freight matching RPCs are missing';
  end if;

  if not has_function_privilege('service_role', freight_assign_function, 'EXECUTE')
    or has_function_privilege('anon', freight_assign_function, 'EXECUTE')
    or has_function_privilege('authenticated', freight_assign_function, 'EXECUTE')
    or not has_function_privilege('service_role', freight_submit_function, 'EXECUTE')
    or has_function_privilege('anon', freight_submit_function, 'EXECUTE')
    or has_function_privilege('authenticated', freight_submit_function, 'EXECUTE') then
    raise exception 'Maritime freight matching RPC execute grants are unsafe';
  end if;

  if pg_get_functiondef(freight_assign_function) not ilike '%for update%'
    or pg_get_functiondef(freight_assign_function) not ilike '%matching_started%'
    or pg_get_functiondef(freight_submit_function) not ilike '%for update%'
    or pg_get_functiondef(freight_submit_function) not ilike '%quote_added%'
    or pg_get_functiondef(freight_submit_function) not ilike '%status = ''quoted''%' then
    raise exception 'Maritime freight matching RPCs are missing atomic state transitions';
  end if;

  freight_decline_function := to_regprocedure('public.decline_maritime_freight_match(uuid,uuid)');
  freight_withdraw_function := to_regprocedure('public.withdraw_maritime_freight_offer(uuid,uuid)');
  if freight_decline_function is null or freight_withdraw_function is null then
    raise exception 'Maritime partner exit RPCs are missing';
  end if;

  if not has_function_privilege('service_role', freight_decline_function, 'EXECUTE')
    or has_function_privilege('anon', freight_decline_function, 'EXECUTE')
    or has_function_privilege('authenticated', freight_decline_function, 'EXECUTE')
    or not has_function_privilege('service_role', freight_withdraw_function, 'EXECUTE')
    or has_function_privilege('anon', freight_withdraw_function, 'EXECUTE')
    or has_function_privilege('authenticated', freight_withdraw_function, 'EXECUTE') then
    raise exception 'Maritime partner exit RPC execute grants are unsafe';
  end if;

  if pg_get_functiondef(freight_decline_function) not ilike '%for update%'
    or pg_get_functiondef(freight_decline_function) not ilike '%match_declined%'
    or pg_get_functiondef(freight_decline_function) not ilike '%status = ''in_review''%'
    or pg_get_functiondef(freight_withdraw_function) not ilike '%for update%'
    or pg_get_functiondef(freight_withdraw_function) not ilike '%offer_withdrawn%'
    or pg_get_functiondef(freight_withdraw_function) not ilike '%status = ''withdrawn''%'
    or pg_get_functiondef(freight_withdraw_function) not ilike '%status = ''closed''%' then
    raise exception 'Maritime partner exit RPCs are missing atomic state transitions';
  end if;

  freight_reconcile_function := to_regprocedure('public.reconcile_maritime_freight_expirations(integer)');
  if freight_reconcile_function is null then
    raise exception 'Maritime freight expiration reconciliation RPC is missing';
  end if;

  if not has_function_privilege('service_role', freight_reconcile_function, 'EXECUTE')
    or has_function_privilege('anon', freight_reconcile_function, 'EXECUTE')
    or has_function_privilege('authenticated', freight_reconcile_function, 'EXECUTE') then
    raise exception 'Maritime freight expiration reconciliation RPC execute grants are unsafe';
  end if;

  if pg_get_functiondef(freight_reconcile_function) not ilike '%for update skip locked%'
    or pg_get_functiondef(freight_reconcile_function) not ilike '%offer_expired%'
    or pg_get_functiondef(freight_reconcile_function) not ilike '%match_expired%'
    or pg_get_functiondef(freight_reconcile_function) not ilike '%status = ''expired''%'
    or pg_get_functiondef(freight_reconcile_function) not ilike '%next_request_status := ''quoted''%'
    or pg_get_functiondef(freight_reconcile_function) not ilike '%next_request_status := ''matching''%'
    or pg_get_functiondef(freight_reconcile_function) not ilike '%next_request_status := ''in_review''%'
    or pg_get_functiondef(freight_reconcile_function) not ilike '%reconciled_terminal_match_count%'
    or pg_get_functiondef(freight_reconcile_function) not ilike '%candidate_request.status = ''accepted''%'
    or pg_get_functiondef(freight_reconcile_function) not ilike '%offer_row.status = ''accepted''%' then
    raise exception 'Maritime freight expiration RPC is missing bounded atomic state reconciliation';
  end if;
end
$maritime_check$;
SQL

echo "Maritime schema checks passed."
