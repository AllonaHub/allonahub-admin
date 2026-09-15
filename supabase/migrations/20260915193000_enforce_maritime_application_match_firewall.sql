create or replace function public.enforce_maritime_application_match_firewall()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  run_id_value uuid;
begin
  if new.status not in ('drafted', 'awaiting_candidate_approval', 'submitted') then
    return new;
  end if;

  begin
    run_id_value := nullif(new.metadata ->> 'smart_account_run_id', '')::uuid;
  exception when others then
    raise exception 'valid smart account run required' using errcode = 'P0001';
  end;

  if run_id_value is null or not exists (
    select 1
    from public.maritime_smart_account_runs run
    join public.maritime_match_results match
      on match.smart_account_run_id = run.id
     and match.seafarer_user_id = run.seafarer_user_id
    where run.id = run_id_value
      and run.seafarer_user_id = new.seafarer_user_id
      and run.status = 'user_confirmed'
      and run.rule_version = 'maritime-smart-account-v6'
      and coalesce((run.smart_snapshot #>> '{readiness,ready_to_apply}')::boolean, false)
      and match.job_id = new.job_id
      and match.hard_gate_status = 'passed'
      and match.stale_after > now()
      and coalesce((match.metadata ->> 'eligible')::boolean, false)
  ) then
    raise exception 'current eligible CV match required' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists maritime_application_match_firewall on public.maritime_hiring_applications;
create trigger maritime_application_match_firewall
  before insert or update of status, job_id, seafarer_user_id, metadata on public.maritime_hiring_applications
  for each row execute function public.enforce_maritime_application_match_firewall();

update public.maritime_smart_account_runs
set status = 'superseded'
where status in ('draft', 'user_confirmed')
  and rule_version <> 'maritime-smart-account-v6';

update public.maritime_match_results match
set hard_gate_status = 'stale',
    stale_after = now()
where match.hard_gate_status <> 'stale'
  and exists (
    select 1
    from public.maritime_smart_account_runs run
    where run.id = match.smart_account_run_id
      and run.rule_version <> 'maritime-smart-account-v6'
  );

revoke all on function public.enforce_maritime_application_match_firewall() from public, anon, authenticated;
grant execute on function public.enforce_maritime_application_match_firewall() to service_role;

comment on function public.enforce_maritime_application_match_firewall() is
  'Fail-closed guard: application drafts and submissions require a current v6 user-confirmed CV match that passed every hard gate.';
