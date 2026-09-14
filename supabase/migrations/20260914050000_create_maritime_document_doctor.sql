create table if not exists public.maritime_document_batches (
  id uuid primary key default gen_random_uuid(),
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'uploading'
    check (status in ('uploading', 'analyzing', 'review_required', 'confirmed', 'partially_confirmed', 'failed')),
  file_count integer not null check (file_count between 1 and 20),
  total_size_bytes bigint not null check (total_size_bytes between 1 and 157286400),
  confirmed_document_count integer not null default 0 check (confirmed_document_count >= 0),
  analysis_consent_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.maritime_document_intakes
  add column if not exists batch_id uuid references public.maritime_document_batches(id) on delete cascade,
  add column if not exists original_file_name text,
  add column if not exists upload_completed_at timestamptz,
  add column if not exists analysis_started_at timestamptz,
  add column if not exists analysis_completed_at timestamptz,
  add column if not exists analysis_error text;

alter table public.maritime_document_intakes
  drop constraint if exists maritime_document_intakes_status_check;
alter table public.maritime_document_intakes
  add constraint maritime_document_intakes_status_check
  check (status in (
    'pending_upload', 'uploaded', 'analysis_queued', 'analyzing', 'pending_user_confirmation',
    'user_confirmed', 'verification_pending', 'verified', 'rejected', 'quarantined',
    'analysis_failed', 'expired', 'revoked', 'classified', 'ocr_draft'
  ));

alter table public.maritime_document_intakes
  drop constraint if exists maritime_document_intakes_file_size_limit;
alter table public.maritime_document_intakes
  add constraint maritime_document_intakes_file_size_limit
  check (file_size_bytes is null or file_size_bytes between 1 and 47185920);

create table if not exists public.maritime_document_extractions (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.maritime_document_intakes(id) on delete cascade,
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending_user_confirmation'
    check (status in ('pending_user_confirmation', 'confirmed', 'rejected', 'superseded', 'failed')),
  provider text not null,
  model_version text not null,
  extraction_version integer not null default 1 check (extraction_version > 0),
  extracted_payload jsonb not null default '{}'::jsonb,
  overall_confidence numeric(4,3) check (overall_confidence is null or overall_confidence between 0 and 1),
  warnings jsonb not null default '[]'::jsonb,
  user_corrections jsonb not null default '{}'::jsonb,
  confirmed_payload jsonb,
  confirmed_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (intake_id, extraction_version),
  constraint maritime_document_extractions_confirmed_check
    check (status <> 'confirmed' or (confirmed_payload is not null and confirmed_at is not null)),
  constraint maritime_document_extractions_rejected_check
    check (status <> 'rejected' or rejected_at is not null)
);

create table if not exists public.maritime_cv_profiles (
  id uuid primary key default gen_random_uuid(),
  seafarer_user_id uuid not null unique references public.profiles(id) on delete cascade,
  profile_status text not null default 'draft'
    check (profile_status in ('draft', 'user_confirmed', 'verification_pending', 'verified', 'stale', 'restricted')),
  profile_payload jsonb not null default '{}'::jsonb,
  source_document_ids uuid[] not null default '{}'::uuid[],
  completion_percent integer not null default 0 check (completion_percent between 0 and 100),
  last_user_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists maritime_document_batches_user_idx
  on public.maritime_document_batches(seafarer_user_id, created_at desc);
create index if not exists maritime_document_intakes_batch_idx
  on public.maritime_document_intakes(batch_id, created_at);
create index if not exists maritime_document_extractions_user_status_idx
  on public.maritime_document_extractions(seafarer_user_id, status, created_at desc);

drop trigger if exists maritime_document_batches_set_updated_at on public.maritime_document_batches;
create trigger maritime_document_batches_set_updated_at
  before update on public.maritime_document_batches
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_document_extractions_set_updated_at on public.maritime_document_extractions;
create trigger maritime_document_extractions_set_updated_at
  before update on public.maritime_document_extractions
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_cv_profiles_set_updated_at on public.maritime_cv_profiles;
create trigger maritime_cv_profiles_set_updated_at
  before update on public.maritime_cv_profiles
  for each row execute function public.set_updated_at();

alter table public.maritime_document_batches enable row level security;
alter table public.maritime_document_extractions enable row level security;
alter table public.maritime_cv_profiles enable row level security;

drop policy if exists maritime_document_batches_select_own_or_admin on public.maritime_document_batches;
create policy maritime_document_batches_select_own_or_admin
  on public.maritime_document_batches for select to authenticated
  using (seafarer_user_id = auth.uid() or public.is_admin());

drop policy if exists maritime_document_extractions_select_own_or_admin on public.maritime_document_extractions;
create policy maritime_document_extractions_select_own_or_admin
  on public.maritime_document_extractions for select to authenticated
  using (seafarer_user_id = auth.uid() or public.is_admin());

drop policy if exists maritime_cv_profiles_select_own_or_admin on public.maritime_cv_profiles;
create policy maritime_cv_profiles_select_own_or_admin
  on public.maritime_cv_profiles for select to authenticated
  using (seafarer_user_id = auth.uid() or public.is_admin());

revoke all on public.maritime_document_batches from anon, authenticated;
revoke all on public.maritime_document_extractions from anon, authenticated;
revoke all on public.maritime_cv_profiles from anon, authenticated;
grant select on public.maritime_document_batches to authenticated;
grant select on public.maritime_document_extractions to authenticated;
grant select on public.maritime_cv_profiles to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.maritime_document_batches to service_role;
    grant all on public.maritime_document_extractions to service_role;
    grant all on public.maritime_cv_profiles to service_role;
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'maritime-private-documents',
  'maritime-private-documents',
  false,
  47185920,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'maritime-profile-photos',
  'maritime-profile-photos',
  false,
  2097152,
  array['image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.maritime_jsonb_array_union(first_value jsonb, second_value jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(jsonb_agg(value order by value::text), '[]'::jsonb)
  from (
    select distinct value
    from jsonb_array_elements(
      (case when jsonb_typeof(first_value) = 'array' then first_value else '[]'::jsonb end)
      ||
      (case when jsonb_typeof(second_value) = 'array' then second_value else '[]'::jsonb end)
    ) as valueset(value)
  ) unique_values;
$$;

create or replace function public.maritime_merge_cv_payload(current_payload jsonb, incoming_payload jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_strip_nulls(
    coalesce(current_payload, '{}'::jsonb)
    || jsonb_strip_nulls(coalesce(incoming_payload, '{}'::jsonb))
    || jsonb_build_object(
      'suitable_positions', public.maritime_jsonb_array_union(current_payload -> 'suitable_positions', incoming_payload -> 'suitable_positions'),
      'certificate_codes', public.maritime_jsonb_array_union(current_payload -> 'certificate_codes', incoming_payload -> 'certificate_codes'),
      'certificate_records', public.maritime_jsonb_array_union(current_payload -> 'certificate_records', incoming_payload -> 'certificate_records'),
      'identity_documents', public.maritime_jsonb_array_union(current_payload -> 'identity_documents', incoming_payload -> 'identity_documents'),
      'education', public.maritime_jsonb_array_union(current_payload -> 'education', incoming_payload -> 'education'),
      'medical_records', public.maritime_jsonb_array_union(current_payload -> 'medical_records', incoming_payload -> 'medical_records'),
      'vaccinations', public.maritime_jsonb_array_union(current_payload -> 'vaccinations', incoming_payload -> 'vaccinations'),
      'endorsements', public.maritime_jsonb_array_union(current_payload -> 'endorsements', incoming_payload -> 'endorsements'),
      'restrictions', public.maritime_jsonb_array_union(current_payload -> 'restrictions', incoming_payload -> 'restrictions'),
      'sea_service', public.maritime_jsonb_array_union(current_payload -> 'sea_service', incoming_payload -> 'sea_service'),
      'languages', public.maritime_jsonb_array_union(current_payload -> 'languages', incoming_payload -> 'languages'),
      'emergency_contacts', public.maritime_jsonb_array_union(current_payload -> 'emergency_contacts', incoming_payload -> 'emergency_contacts'),
      'references', public.maritime_jsonb_array_union(current_payload -> 'references', incoming_payload -> 'references'),
      'field_evidence', public.maritime_jsonb_array_union(current_payload -> 'field_evidence', incoming_payload -> 'field_evidence'),
      'source_languages', public.maritime_jsonb_array_union(current_payload -> 'source_languages', incoming_payload -> 'source_languages'),
      'contact', coalesce(current_payload -> 'contact', '{}'::jsonb) || coalesce(incoming_payload -> 'contact', '{}'::jsonb),
      'physical_profile', coalesce(current_payload -> 'physical_profile', '{}'::jsonb) || coalesce(incoming_payload -> 'physical_profile', '{}'::jsonb),
      'notes', public.maritime_jsonb_array_union(current_payload -> 'notes', incoming_payload -> 'notes')
    )
  );
$$;

create or replace function public.maritime_cv_completion(payload jsonb)
returns integer
language sql
immutable
set search_path = public
as $$
  select least(100,
    (case when nullif(payload ->> 'holder_name', '') is not null then 10 else 0 end)
    + (case when nullif(payload ->> 'nationality', '') is not null then 10 else 0 end)
    + (case when nullif(payload ->> 'date_of_birth', '') is not null then 10 else 0 end)
    + (case when nullif(payload ->> 'rank', '') is not null then 15 else 0 end)
    + (case when jsonb_array_length(coalesce(payload -> 'suitable_positions', '[]'::jsonb)) > 0 then 10 else 0 end)
    + (case when jsonb_array_length(coalesce(payload -> 'certificate_codes', '[]'::jsonb)) > 0
                  or jsonb_array_length(coalesce(payload -> 'certificate_records', '[]'::jsonb)) > 0 then 20 else 0 end)
    + (case when jsonb_array_length(coalesce(payload -> 'sea_service', '[]'::jsonb)) > 0 then 10 else 0 end)
    + (case when (payload ->> 'medical_fitness') in ('fit', 'fit_with_restrictions')
                  or jsonb_array_length(coalesce(payload -> 'medical_records', '[]'::jsonb)) > 0 then 10 else 0 end)
    + (case when jsonb_array_length(coalesce(payload -> 'identity_documents', '[]'::jsonb)) > 0 then 5 else 0 end)
  );
$$;

create or replace function public.confirm_maritime_document_extraction(
  p_extraction_id uuid,
  p_confirmed_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  extraction_row public.maritime_document_extractions%rowtype;
  intake_row public.maritime_document_intakes%rowtype;
  passport_id uuid;
  cv_row public.maritime_cv_profiles%rowtype;
  merged_payload jsonb;
  now_value timestamptz := now();
  expiry_value timestamptz;
  summary_text text;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_confirmed_payload) <> 'object' or octet_length(p_confirmed_payload::text) > 900000 then
    raise exception 'invalid confirmed payload' using errcode = '22023';
  end if;
  if coalesce(p_confirmed_payload ->> 'document_type', '') not in (
    'seafarer_book', 'passport', 'stcw_certificate', 'competency_certificate',
    'medical_certificate', 'sea_service_record', 'training_certificate', 'visa',
    'cv', 'other', 'unknown'
  ) then
    raise exception 'invalid document type' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(array[
      'suitable_positions', 'certificate_codes', 'certificate_records', 'identity_documents', 'education',
      'medical_records', 'vaccinations', 'endorsements', 'restrictions', 'sea_service', 'languages',
      'emergency_contacts', 'references', 'source_languages', 'field_evidence', 'notes', 'warnings'
    ]) as required_array(key)
    where p_confirmed_payload ? required_array.key
      and jsonb_typeof(p_confirmed_payload -> required_array.key) is distinct from 'array'
  ) then
    raise exception 'invalid confirmed payload arrays' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'customer') then
    raise exception 'customer account required' using errcode = '42501';
  end if;
  if coalesce((p_confirmed_payload ->> 'reader_version')::integer, 0) < 1 then
    raise exception 'invalid document reader version' using errcode = '22023';
  end if;
  if nullif(p_confirmed_payload ->> 'date_of_birth', '') is not null
     and (p_confirmed_payload ->> 'date_of_birth') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'invalid date of birth' using errcode = '22023';
  end if;
  if nullif(p_confirmed_payload ->> 'expiry_date', '') is not null then
    if (p_confirmed_payload ->> 'expiry_date') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'invalid expiry date' using errcode = '22023';
    end if;
    expiry_value := ((p_confirmed_payload ->> 'expiry_date')::date + time '23:59:59') at time zone 'UTC';
  end if;

  select * into extraction_row
  from public.maritime_document_extractions
  where id = p_extraction_id
    and seafarer_user_id = auth.uid()
  for update;

  if extraction_row.id is null then
    raise exception 'extraction not found' using errcode = 'P0002';
  end if;
  if extraction_row.status = 'confirmed' then
    return jsonb_build_object('extraction_id', extraction_row.id, 'status', 'confirmed', 'idempotent', true);
  end if;
  if extraction_row.status <> 'pending_user_confirmation' then
    raise exception 'extraction state conflict' using errcode = 'P0001';
  end if;

  select * into intake_row
  from public.maritime_document_intakes
  where id = extraction_row.intake_id
    and seafarer_user_id = auth.uid()
  for update;

  if intake_row.id is null then
    raise exception 'document intake not found' using errcode = 'P0002';
  end if;

  select * into cv_row
  from public.maritime_cv_profiles
  where seafarer_user_id = auth.uid()
  for update;

  if nullif(cv_row.profile_payload ->> 'date_of_birth', '') is not null
     and nullif(p_confirmed_payload ->> 'date_of_birth', '') is not null
     and (cv_row.profile_payload ->> 'date_of_birth') <> (p_confirmed_payload ->> 'date_of_birth') then
    raise exception 'maritime document identity conflict' using errcode = '22023';
  end if;

  update public.maritime_document_extractions
  set status = 'confirmed',
      user_corrections = p_confirmed_payload,
      confirmed_payload = p_confirmed_payload,
      confirmed_at = now_value
  where id = extraction_row.id;

  update public.maritime_document_intakes
  set status = 'user_confirmed',
      document_type = coalesce(nullif(p_confirmed_payload ->> 'document_type', ''), document_type),
      confirmed_by_user_at = now_value
  where id = intake_row.id;

  insert into public.maritime_readiness_passports (
    seafarer_user_id,
    passport_status,
    last_user_confirmed_at,
    metadata
  ) values (
    auth.uid(),
    'user_confirmed',
    now_value,
    jsonb_build_object('latest_source_document_id', intake_row.id)
  )
  on conflict (seafarer_user_id) do update
  set passport_status = case
        when maritime_readiness_passports.passport_status in ('verified', 'verification_pending') then maritime_readiness_passports.passport_status
        else 'user_confirmed'
      end,
      last_user_confirmed_at = now_value,
      metadata = maritime_readiness_passports.metadata || jsonb_build_object('latest_source_document_id', intake_row.id)
  returning id into passport_id;

  summary_text := concat_ws(' · ',
    nullif(p_confirmed_payload ->> 'document_title', ''),
    nullif(p_confirmed_payload ->> 'document_number', ''),
    nullif(p_confirmed_payload ->> 'expiry_date', '')
  );

  if coalesce(nullif(p_confirmed_payload ->> 'holder_name', ''), nullif(p_confirmed_payload ->> 'nationality', ''), nullif(p_confirmed_payload ->> 'date_of_birth', '')) is not null then
    insert into public.maritime_readiness_items (
      passport_id, seafarer_user_id, item_type, source_type, trust_level, verification_status,
      confidence, source_label, source_reference_hash, value_summary, value_payload, user_confirmed_at, expires_at
    ) values (
      passport_id, auth.uid(), 'identity', 'ocr_user_confirmed', 'user_confirmed', 'pending_review',
      extraction_row.overall_confidence, intake_row.original_file_name, coalesce(intake_row.file_sha256, intake_row.id::text),
      coalesce(nullif(p_confirmed_payload ->> 'holder_name', ''), 'Kimlik bilgileri'), p_confirmed_payload, now_value, expiry_value
    );
  end if;

  if nullif(p_confirmed_payload ->> 'rank', '') is not null or jsonb_array_length(coalesce(p_confirmed_payload -> 'suitable_positions', '[]'::jsonb)) > 0 then
    insert into public.maritime_readiness_items (
      passport_id, seafarer_user_id, item_type, source_type, trust_level, verification_status,
      confidence, source_label, source_reference_hash, value_summary, value_payload, user_confirmed_at, expires_at
    ) values (
      passport_id, auth.uid(), 'rank', 'ocr_user_confirmed', 'user_confirmed', 'pending_review',
      extraction_row.overall_confidence, intake_row.original_file_name, coalesce(intake_row.file_sha256, intake_row.id::text),
      coalesce(nullif(p_confirmed_payload ->> 'rank', ''), 'Pozisyon yeterliliği'), p_confirmed_payload, now_value, expiry_value
    );
  end if;

  if jsonb_array_length(coalesce(p_confirmed_payload -> 'certificate_codes', '[]'::jsonb)) > 0
     or jsonb_array_length(coalesce(p_confirmed_payload -> 'certificate_records', '[]'::jsonb)) > 0
     or (p_confirmed_payload ->> 'document_type') in ('stcw_certificate', 'competency_certificate', 'training_certificate') then
    insert into public.maritime_readiness_items (
      passport_id, seafarer_user_id, item_type, source_type, trust_level, verification_status,
      confidence, source_label, source_reference_hash, value_summary, value_payload, user_confirmed_at, expires_at
    ) values (
      passport_id, auth.uid(), 'stcw_certificate', 'ocr_user_confirmed', 'user_confirmed', 'pending_review',
      extraction_row.overall_confidence, intake_row.original_file_name, coalesce(intake_row.file_sha256, intake_row.id::text),
      coalesce(nullif(summary_text, ''), 'Denizcilik sertifikası'), p_confirmed_payload, now_value, expiry_value
    );
  end if;

  if jsonb_array_length(coalesce(p_confirmed_payload -> 'sea_service', '[]'::jsonb)) > 0 then
    insert into public.maritime_readiness_items (
      passport_id, seafarer_user_id, item_type, source_type, trust_level, verification_status,
      confidence, source_label, source_reference_hash, value_summary, value_payload, user_confirmed_at, expires_at
    ) values (
      passport_id, auth.uid(), 'sea_service', 'ocr_user_confirmed', 'user_confirmed', 'pending_review',
      extraction_row.overall_confidence, intake_row.original_file_name, coalesce(intake_row.file_sha256, intake_row.id::text),
      'Onaylı deniz hizmeti kaydı', p_confirmed_payload, now_value, expiry_value
    );
  end if;

  if (p_confirmed_payload ->> 'document_type') = 'medical_certificate' or (p_confirmed_payload ->> 'medical_fitness') <> 'not_stated' then
    insert into public.maritime_readiness_items (
      passport_id, seafarer_user_id, item_type, source_type, trust_level, verification_status,
      confidence, source_label, source_reference_hash, value_summary, value_payload, user_confirmed_at, expires_at
    ) values (
      passport_id, auth.uid(), 'medical', 'ocr_user_confirmed', 'user_confirmed', 'pending_review',
      extraction_row.overall_confidence, intake_row.original_file_name, coalesce(intake_row.file_sha256, intake_row.id::text),
      coalesce(nullif(summary_text, ''), 'Sağlık uygunluk belgesi'), p_confirmed_payload, now_value, expiry_value
    );
  end if;

  if jsonb_array_length(coalesce(p_confirmed_payload -> 'languages', '[]'::jsonb)) > 0 then
    insert into public.maritime_readiness_items (
      passport_id, seafarer_user_id, item_type, source_type, trust_level, verification_status,
      confidence, source_label, source_reference_hash, value_summary, value_payload, user_confirmed_at, expires_at
    ) values (
      passport_id, auth.uid(), 'language', 'ocr_user_confirmed', 'user_confirmed', 'pending_review',
      extraction_row.overall_confidence, intake_row.original_file_name, coalesce(intake_row.file_sha256, intake_row.id::text),
      'Onaylı dil bilgileri', p_confirmed_payload, now_value, expiry_value
    );
  end if;

  if (p_confirmed_payload ->> 'document_type') in ('passport', 'seafarer_book', 'visa', 'cv') then
    insert into public.maritime_readiness_items (
      passport_id, seafarer_user_id, item_type, source_type, trust_level, verification_status,
      confidence, source_label, source_reference_hash, value_summary, value_payload, user_confirmed_at, expires_at
    ) values (
      passport_id,
      auth.uid(),
      case p_confirmed_payload ->> 'document_type'
        when 'passport' then 'passport'
        when 'seafarer_book' then 'seaman_book'
        when 'visa' then 'visa'
        else 'cv'
      end,
      'ocr_user_confirmed',
      'user_confirmed',
      'pending_review',
      extraction_row.overall_confidence,
      intake_row.original_file_name,
      coalesce(intake_row.file_sha256, intake_row.id::text),
      coalesce(nullif(summary_text, ''), nullif(p_confirmed_payload ->> 'document_title', ''), 'Onaylı denizcilik belgesi'),
      p_confirmed_payload,
      now_value,
      expiry_value
    );
  end if;

  merged_payload := public.maritime_merge_cv_payload(coalesce(cv_row.profile_payload, '{}'::jsonb), p_confirmed_payload);

  insert into public.maritime_cv_profiles (
    seafarer_user_id,
    profile_status,
    profile_payload,
    source_document_ids,
    completion_percent,
    last_user_confirmed_at
  ) values (
    auth.uid(),
    'user_confirmed',
    merged_payload,
    array[intake_row.id],
    public.maritime_cv_completion(merged_payload),
    now_value
  )
  on conflict (seafarer_user_id) do update
  set profile_status = case
        when maritime_cv_profiles.profile_status in ('verified', 'verification_pending') then maritime_cv_profiles.profile_status
        else 'user_confirmed'
      end,
      profile_payload = excluded.profile_payload,
      source_document_ids = (
        select array_agg(distinct document_id)
        from unnest(maritime_cv_profiles.source_document_ids || excluded.source_document_ids) as document_id
      ),
      completion_percent = excluded.completion_percent,
      last_user_confirmed_at = now_value;

  if intake_row.batch_id is not null then
    update public.maritime_document_batches batch
    set confirmed_document_count = (
          select count(*)
          from public.maritime_document_intakes intake
          where intake.batch_id = batch.id
            and intake.status in ('user_confirmed', 'verification_pending', 'verified')
        ),
        status = case
          when not exists (
            select 1 from public.maritime_document_intakes intake
            where intake.batch_id = batch.id
              and intake.status not in ('user_confirmed', 'verification_pending', 'verified', 'rejected')
          ) then case
            when exists (
              select 1 from public.maritime_document_intakes intake
              where intake.batch_id = batch.id and intake.status = 'rejected'
            ) then 'partially_confirmed'
            else 'confirmed'
          end
          else 'review_required'
        end
    where batch.id = intake_row.batch_id;
  end if;

  return jsonb_build_object(
    'extraction_id', extraction_row.id,
    'document_id', intake_row.id,
    'status', 'confirmed',
    'completion_percent', public.maritime_cv_completion(merged_payload),
    'passport_id', passport_id
  );
end;
$$;

revoke all on function public.maritime_jsonb_array_union(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.maritime_merge_cv_payload(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.maritime_cv_completion(jsonb) from public, anon, authenticated;
revoke all on function public.confirm_maritime_document_extraction(uuid, jsonb) from public, anon;
grant execute on function public.confirm_maritime_document_extraction(uuid, jsonb) to authenticated;

comment on table public.maritime_document_batches is 'Groups multiple private seafarer documents into one upload and review workflow.';
comment on table public.maritime_document_extractions is 'Machine-read document drafts. No value becomes profile data before explicit user confirmation.';
comment on table public.maritime_cv_profiles is 'Consolidated, user-confirmed maritime CV source assembled from multiple document extractions.';
comment on function public.confirm_maritime_document_extraction(uuid, jsonb) is 'Atomically confirms one owned extraction and merges it into readiness and Maritime CV records.';
