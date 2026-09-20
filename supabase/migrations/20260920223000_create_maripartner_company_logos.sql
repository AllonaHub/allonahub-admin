-- MariPartner company identity images are public brand assets, but uploads are
-- issued only through short-lived service-side signed upload tokens.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'maritime-partner-logos',
  'maritime-partner-logos',
  true,
  2097152,
  array['image/webp']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No authenticated INSERT/UPDATE/DELETE policy is created intentionally.
-- The backend creates a short-lived signed upload token after tenant, role,
-- MFA and manager checks. Public access is read-only through the bucket URL.
