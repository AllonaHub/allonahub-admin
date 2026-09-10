alter table public.maritime_public_listings
  add column if not exists partner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists client_listing_id uuid,
  add column if not exists submission_source text not null default 'admin',
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists review_note text not null default '';

alter table public.maritime_partner_applications
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists review_note text not null default '';

alter table public.maritime_partner_applications
  drop constraint if exists maritime_partner_applications_review_note_length;
alter table public.maritime_partner_applications
  add constraint maritime_partner_applications_review_note_length
    check (char_length(review_note) <= 800);

alter table public.maritime_public_listings
  drop constraint if exists maritime_public_listings_status_check;
alter table public.maritime_public_listings
  add constraint maritime_public_listings_status_check
    check (status in ('draft', 'pending_review', 'active', 'paused', 'rejected', 'archived'));

alter table public.maritime_public_listings
  drop constraint if exists maritime_public_listings_submission_source_check;
alter table public.maritime_public_listings
  add constraint maritime_public_listings_submission_source_check
    check (submission_source in ('admin', 'partner', 'import'));

alter table public.maritime_public_listings
  drop constraint if exists maritime_public_listings_review_note_length;
alter table public.maritime_public_listings
  add constraint maritime_public_listings_review_note_length
    check (char_length(review_note) <= 800);

alter table public.maritime_public_listings
  drop constraint if exists maritime_public_listings_partner_identity;
alter table public.maritime_public_listings
  add constraint maritime_public_listings_partner_identity
    check (
      submission_source <> 'partner'
      or (
        partner_user_id is not null
        and client_listing_id is not null
        and submitted_at is not null
      )
    );

create unique index if not exists maritime_public_listings_partner_client_unique
  on public.maritime_public_listings(partner_user_id, client_listing_id)
  where partner_user_id is not null and client_listing_id is not null;
create index if not exists maritime_public_listings_partner_status_idx
  on public.maritime_public_listings(partner_user_id, status, created_at desc)
  where partner_user_id is not null;
create index if not exists maritime_public_listings_review_queue_idx
  on public.maritime_public_listings(status, submitted_at asc)
  where status = 'pending_review';

drop policy if exists "maritime_public_listings_partner_select_own" on public.maritime_public_listings;
create policy "maritime_public_listings_partner_select_own"
  on public.maritime_public_listings for select to authenticated
  using (
    partner_user_id = auth.uid()
    and public.is_partner_or_admin()
  );

revoke insert, update, delete on public.maritime_public_listings from anon, authenticated;

comment on column public.maritime_public_listings.partner_user_id is
  'Owner of a partner-submitted maritime listing. Privileged reads require partner/admin MFA through RLS.';
comment on column public.maritime_public_listings.client_listing_id is
  'Client-generated idempotency key scoped to the partner user.';
comment on column public.maritime_public_listings.review_note is
  'Non-public moderation note returned only to the submitting partner and authorized admins.';
comment on column public.maritime_partner_applications.review_note is
  'Private moderation note for MFA-protected maritime partner application review.';
