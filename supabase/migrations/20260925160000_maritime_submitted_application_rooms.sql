-- A final, explicit candidate submission creates the partner's private
-- application room. Drafts and merely computed matches never open access.
-- Earlier rank comparisons could mis-handle non-Latin titles. Recompute
-- existing matches before allowing another application from those runs.
update public.maritime_match_results
set hard_gate_status = 'stale', stale_after = now()
where hard_gate_status <> 'stale';

create or replace function public.open_maritime_candidate_room_on_submission()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status <> 'submitted' or old.status = 'submitted'
     or new.candidate_consent_snapshot ->> 'final_submission_confirmed' <> 'true' then
    return new;
  end if;
  insert into public.maritime_private_candidate_rooms (
    partner_id, job_id, application_id, seafarer_user_id,
    status, purpose, candidate_visible, created_by, metadata
  ) values (
    new.partner_id, new.job_id, new.id, new.seafarer_user_id,
    'active', 'candidate_hiring', true, new.seafarer_user_id,
    jsonb_build_object('source', 'candidate_submitted_application')
  ) on conflict (partner_id, job_id, seafarer_user_id) do update
    set application_id = excluded.application_id, updated_at = now()
    where maritime_private_candidate_rooms.status in ('active', 'offer', 'hired')
      and maritime_private_candidate_rooms.candidate_visible = true;
  return new;
end;
$$;
revoke all on function public.open_maritime_candidate_room_on_submission() from public, anon, authenticated;

drop trigger if exists maritime_application_open_candidate_room on public.maritime_hiring_applications;
create trigger maritime_application_open_candidate_room
after update of status on public.maritime_hiring_applications
for each row execute function public.open_maritime_candidate_room_on_submission();

insert into public.maritime_private_candidate_rooms (
  partner_id, job_id, application_id, seafarer_user_id,
  status, purpose, candidate_visible, created_by, metadata
)
select a.partner_id, a.job_id, a.id, a.seafarer_user_id,
  'active', 'candidate_hiring', true, a.seafarer_user_id,
  jsonb_build_object('source', 'candidate_submitted_application')
from public.maritime_hiring_applications a
where a.status = 'submitted'
  and a.candidate_consent_snapshot ->> 'final_submission_confirmed' = 'true'
on conflict (partner_id, job_id, seafarer_user_id) do update
  set application_id = excluded.application_id, updated_at = now()
  where maritime_private_candidate_rooms.status in ('active', 'offer', 'hired')
    and maritime_private_candidate_rooms.candidate_visible = true;
