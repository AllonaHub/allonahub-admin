begin;

-- Preserve the existing writer, tenant checks, matching gates and grants.
-- Archived PDFs are optional for a user-entered, explicitly confirmed CV.
do $migration$
declare
  definition text := pg_get_functiondef('public.prepare_maritime_smart_account(uuid,text,text,jsonb,jsonb)'::regprocedure);
  old_guard text := $old$  if not exists (
    select 1 from public.maritime_document_intakes
    where seafarer_user_id = p_seafarer_user_id
      and status in ('user_confirmed', 'verification_pending', 'verified')
  ) then
    raise exception 'confirmed maritime documents required' using errcode = 'P0001';
  end if;$old$;
  new_guard text := $new$  -- Confirmed manual CVs do not depend on the retired OCR workflow.
  if not exists (
    select 1 from public.maritime_cv_profiles cv
    join public.maritime_cv_identity_locks identity_lock
      on identity_lock.user_id = cv.seafarer_user_id
    where cv.seafarer_user_id = p_seafarer_user_id
      and cv.profile_payload ->> 'data_origin' = 'user_entered_maritime_cv'
      and cv.profile_status in ('user_confirmed', 'verification_pending', 'verified')
      and cv.last_user_confirmed_at is not null
  ) and not exists (
    select 1 from public.maritime_document_intakes
    where seafarer_user_id = p_seafarer_user_id
      and status in ('user_confirmed', 'verification_pending', 'verified')
  ) then
    raise exception 'confirmed maritime CV or documents required' using errcode = 'P0001';
  end if;$new$;
begin
  if strpos(definition, new_guard) > 0 then return; end if;
  if strpos(definition, old_guard) = 0 then
    raise exception 'Unexpected Global CV source guard; review before applying migration';
  end if;
  execute replace(definition, old_guard, new_guard);
end;
$migration$;

notify pgrst, 'reload schema';
commit;
