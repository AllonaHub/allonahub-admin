create table if not exists public.career_cv_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  photo_path text,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 262144),
  check (photo_path is null or photo_path = user_id::text || '/photo')
);

alter table public.career_cv_profiles enable row level security;
revoke all on public.career_cv_profiles from anon;
grant select, insert, update, delete on public.career_cv_profiles to authenticated;

drop policy if exists career_cv_owner_read on public.career_cv_profiles;
create policy career_cv_owner_read on public.career_cv_profiles
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists career_cv_owner_insert on public.career_cv_profiles;
create policy career_cv_owner_insert on public.career_cv_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists career_cv_owner_update on public.career_cv_profiles;
create policy career_cv_owner_update on public.career_cv_profiles
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists career_cv_owner_delete on public.career_cv_profiles;
create policy career_cv_owner_delete on public.career_cv_profiles
  for delete to authenticated using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'career-cv-photos', 'career-cv-photos', false, 4194304,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists career_cv_photo_owner_read on storage.objects;
create policy career_cv_photo_owner_read on storage.objects
  for select to authenticated using (
    bucket_id = 'career-cv-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists career_cv_photo_owner_insert on storage.objects;
create policy career_cv_photo_owner_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'career-cv-photos'
    and name = (select auth.uid())::text || '/photo'
  );
drop policy if exists career_cv_photo_owner_update on storage.objects;
create policy career_cv_photo_owner_update on storage.objects
  for update to authenticated using (
    bucket_id = 'career-cv-photos'
    and name = (select auth.uid())::text || '/photo'
  ) with check (
    bucket_id = 'career-cv-photos'
    and name = (select auth.uid())::text || '/photo'
  );
drop policy if exists career_cv_photo_owner_delete on storage.objects;
create policy career_cv_photo_owner_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'career-cv-photos'
    and name = (select auth.uid())::text || '/photo'
  );
