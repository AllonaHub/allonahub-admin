-- General account documents are private, durable server records. The older
-- browser-only document page must never be the source of truth.
create table if not exists public.account_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('certificate', 'health', 'diploma', 'professional', 'contract', 'passport_seafarer', 'stcw', 'medical_maritime')),
  title text not null check (char_length(title) between 1 and 160),
  note text not null default '' check (char_length(note) <= 1000),
  file_name text not null check (char_length(file_name) between 1 and 180),
  file_type text not null check (file_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  file_size_bytes integer not null check (file_size_bytes between 1 and 8388608),
  storage_path text not null unique,
  legacy_local_id text,
  status text not null default 'stored' check (status in ('stored', 'pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (user_id, legacy_local_id),
  check (storage_path = user_id::text || '/' || id::text)
);

create index if not exists account_documents_owner_created_idx
  on public.account_documents (user_id, created_at desc);

alter table public.account_documents enable row level security;
revoke all on public.account_documents from anon;
grant select, insert, delete on public.account_documents to authenticated;

drop policy if exists account_documents_owner_read on public.account_documents;
create policy account_documents_owner_read on public.account_documents
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists account_documents_owner_insert on public.account_documents;
create policy account_documents_owner_insert on public.account_documents
  for insert to authenticated with check (
    user_id = (select auth.uid()) and status = 'stored'
  );

drop policy if exists account_documents_owner_delete on public.account_documents;
create policy account_documents_owner_delete on public.account_documents
  for delete to authenticated using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'account-documents', 'account-documents', false, 8388608,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.account_document_upload_capacity()
returns boolean language sql stable security definer
set search_path = pg_catalog, storage
as $$
  select (select auth.uid()) is not null and (
    select count(*) from storage.objects
    where bucket_id = 'account-documents'
      and (storage.foldername(name))[1] = (select auth.uid())::text
  ) < 20;
$$;
revoke all on function public.account_document_upload_capacity() from public;
grant execute on function public.account_document_upload_capacity() to authenticated;

drop policy if exists account_documents_owner_storage_read on storage.objects;
create policy account_documents_owner_storage_read on storage.objects
  for select to authenticated using (
    bucket_id = 'account-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists account_documents_owner_storage_insert on storage.objects;
create policy account_documents_owner_storage_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'account-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$'
    and public.account_document_upload_capacity()
  );

drop policy if exists account_documents_owner_storage_delete on storage.objects;
create policy account_documents_owner_storage_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'account-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
