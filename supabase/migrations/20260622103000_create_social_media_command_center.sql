create extension if not exists pgcrypto;

create table if not exists public.social_media_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null
    check (platform in ('instagram', 'facebook', 'threads', 'x', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'nsosyal', 'telegram', 'whatsapp', 'google_business', 'other')),
  display_name text not null check (length(trim(display_name)) between 2 and 160),
  handle text not null check (length(trim(handle)) between 2 and 160),
  account_url text not null default '',
  external_account_id text not null default '',
  connector_mode text not null default 'pending'
    check (connector_mode in ('pending', 'manual', 'server_webhook', 'native_api')),
  connection_status text not null default 'not_connected'
    check (connection_status in ('not_connected', 'connected', 'needs_reauth', 'disabled')),
  default_publish_mode text not null default 'draft_after_approval'
    check (default_publish_mode in ('draft_after_approval', 'scheduled_after_approval', 'direct_after_approval')),
  is_active boolean not null default true,
  platform_limits jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, handle)
);

create index if not exists social_media_accounts_platform_idx
  on public.social_media_accounts(platform, is_active, connection_status);

create table if not exists public.social_media_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 3 and 180),
  objective text not null default 'growth'
    check (objective in ('growth', 'traffic', 'conversion', 'retention', 'partner_acquisition', 'launch', 'community')),
  module_key text not null default 'ecosystem',
  funnel_stage text not null default 'awareness'
    check (funnel_stage in ('awareness', 'consideration', 'conversion', 'retention', 'advocacy')),
  audience text not null default 'AllonaHub takipcileri',
  status text not null default 'draft'
    check (status in ('draft', 'review', 'approved', 'active', 'completed', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  prepared_by uuid references public.profiles(id) on delete set null default auth.uid(),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_media_campaigns_status_idx
  on public.social_media_campaigns(status, objective, created_at desc);

create table if not exists public.social_media_assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.social_media_campaigns(id) on delete set null,
  title text not null check (length(trim(title)) between 2 and 180),
  asset_type text not null default 'image'
    check (asset_type in ('image', 'video', 'carousel', 'story', 'reel', 'short', 'document', 'link_preview')),
  asset_url text not null default '',
  alt_text text not null default '',
  prompt text not null default '',
  visual_fingerprint text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists social_media_assets_campaign_idx
  on public.social_media_assets(campaign_id, created_at desc);

create unique index if not exists social_media_assets_visual_fingerprint_unique
  on public.social_media_assets(visual_fingerprint)
  where visual_fingerprint is not null;

create table if not exists public.social_media_drafts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.social_media_campaigns(id) on delete set null,
  title text not null check (length(trim(title)) between 3 and 180),
  content_theme text not null default 'AllonaHub ecosystem growth',
  hook text not null default '',
  body text not null check (length(trim(body)) between 3 and 4000),
  cta text not null default '',
  landing_url text not null default '',
  language text not null default 'tr',
  status text not null default 'draft'
    check (status in ('draft', 'ready_for_review', 'needs_changes', 'approved', 'scheduled', 'publishing', 'published', 'blocked', 'archived')),
  uniqueness_status text not null default 'unchecked'
    check (uniqueness_status in ('unchecked', 'unique', 'duplicate_blocked', 'needs_review')),
  content_hash text not null,
  semantic_hash text not null,
  visual_hash text,
  duplicate_of uuid references public.social_media_drafts(id) on delete set null,
  scheduled_for timestamptz,
  prepared_by uuid references public.profiles(id) on delete set null default auth.uid(),
  submitted_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_media_drafts_status_idx
  on public.social_media_drafts(status, scheduled_for, created_at desc);

create index if not exists social_media_drafts_campaign_idx
  on public.social_media_drafts(campaign_id, created_at desc);

create unique index if not exists social_media_drafts_content_hash_unique
  on public.social_media_drafts(content_hash)
  where status <> 'archived';

create unique index if not exists social_media_drafts_semantic_hash_unique
  on public.social_media_drafts(semantic_hash)
  where status <> 'archived';

create unique index if not exists social_media_drafts_visual_hash_unique
  on public.social_media_drafts(visual_hash)
  where visual_hash is not null and status <> 'archived';

create table if not exists public.social_media_platform_posts (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.social_media_drafts(id) on delete cascade,
  account_id uuid not null references public.social_media_accounts(id) on delete restrict,
  platform text not null
    check (platform in ('instagram', 'facebook', 'threads', 'x', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'nsosyal', 'telegram', 'whatsapp', 'google_business', 'other')),
  post_type text not null default 'feed'
    check (post_type in ('feed', 'story', 'reel', 'short', 'video', 'carousel', 'pin', 'article', 'text')),
  caption text not null check (length(trim(caption)) between 1 and 4000),
  hashtags text[] not null default '{}'::text[],
  media_asset_ids uuid[] not null default '{}'::uuid[],
  platform_payload jsonb not null default '{}'::jsonb,
  approval_required boolean not null default true,
  status text not null default 'draft'
    check (status in ('draft', 'ready_for_review', 'approved', 'scheduled', 'queued', 'publishing', 'published', 'failed', 'cancelled', 'blocked')),
  scheduled_for timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  external_post_id text not null default '',
  external_url text not null default '',
  last_error text not null default '',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (draft_id, account_id)
);

create index if not exists social_media_platform_posts_status_idx
  on public.social_media_platform_posts(status, scheduled_for, platform, created_at desc);

create index if not exists social_media_platform_posts_account_idx
  on public.social_media_platform_posts(account_id, status, created_at desc);

create table if not exists public.social_media_dispatch_attempts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_media_platform_posts(id) on delete cascade,
  platform text not null,
  provider text not null default 'server_webhook',
  status text not null default 'queued'
    check (status in ('dry_run', 'queued', 'sent', 'failed', 'skipped')),
  request_id text not null default '',
  response_status integer,
  response_body text not null default '',
  error_message text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  attempted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists social_media_dispatch_attempts_post_idx
  on public.social_media_dispatch_attempts(post_id, created_at desc);

create table if not exists public.social_media_daily_plans (
  id uuid primary key default gen_random_uuid(),
  plan_date date not null,
  timezone text not null default 'Europe/Istanbul',
  objective text not null default 'growth',
  status text not null default 'draft'
    check (status in ('draft', 'ready_for_review', 'approved', 'executed', 'archived')),
  summary text not null default '',
  target_platforms text[] not null default '{}'::text[],
  draft_ids uuid[] not null default '{}'::uuid[],
  prepared_by uuid references public.profiles(id) on delete set null default auth.uid(),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_date, objective)
);

create index if not exists social_media_daily_plans_status_idx
  on public.social_media_daily_plans(status, plan_date desc);

create table if not exists public.social_media_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  rule_label text not null,
  is_enforced boolean not null default true,
  enforcement_layer text not null default 'backend_database',
  rule_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.social_media_rules (rule_key, rule_label, enforcement_layer, rule_config)
values
  ('no_exact_text_repeat', 'Exact same caption or message cannot be reused.', 'backend_database', '{"hash": "content_hash"}'::jsonb),
  ('no_semantic_repeat', 'Same-meaning social content must be blocked before approval.', 'backend_database', '{"hash": "semantic_hash"}'::jsonb),
  ('no_visual_repeat', 'Same visual or same visual prompt fingerprint cannot be reused.', 'backend_database', '{"hash": "visual_hash"}'::jsonb),
  ('approval_required', 'Every platform post requires Admin approval before queueing.', 'backend', '{"default": true}'::jsonb),
  ('server_only_tokens', 'Platform tokens stay on the server and are never exposed to frontend code.', 'backend', '{"secrets": "env_or_vault"}'::jsonb)
on conflict (rule_key) do nothing;

insert into public.social_media_accounts (platform, display_name, handle, account_url, connector_mode, connection_status, metadata)
values
  ('instagram', 'AllonaHub Instagram', 'allonahub', 'https://www.instagram.com/allonahub', 'pending', 'not_connected', '{"default_post_type": "reel"}'::jsonb),
  ('facebook', 'AllonaHub Facebook', 'allonahub', 'https://www.facebook.com/allonahub', 'pending', 'not_connected', '{"default_post_type": "feed"}'::jsonb),
  ('threads', 'AllonaHub Threads', 'allonahub', 'https://www.threads.net/@allonahub', 'pending', 'not_connected', '{"default_post_type": "text"}'::jsonb),
  ('x', 'AllonaHub X', 'allonahub', 'https://x.com/allonahub', 'pending', 'not_connected', '{"default_post_type": "text"}'::jsonb),
  ('linkedin', 'AllonaHub LinkedIn', 'allonahub', 'https://www.linkedin.com/company/allonahub', 'pending', 'not_connected', '{"default_post_type": "article"}'::jsonb),
  ('tiktok', 'AllonaHub TikTok', 'allonahub', 'https://www.tiktok.com/@allonahub', 'pending', 'not_connected', '{"default_post_type": "short"}'::jsonb),
  ('youtube', 'AllonaHub YouTube', 'allonahub', 'https://www.youtube.com/@allonahub', 'pending', 'not_connected', '{"default_post_type": "short"}'::jsonb),
  ('pinterest', 'AllonaHub Pinterest', 'allonahub', 'https://www.pinterest.com/allonahub', 'pending', 'not_connected', '{"default_post_type": "pin"}'::jsonb),
  ('nsosyal', 'AllonaHub Nsosyal', 'allonahub', 'https://nsosyal.com/allonahub', 'manual', 'not_connected', '{"default_post_type": "text"}'::jsonb)
on conflict (platform, handle) do nothing;

drop trigger if exists social_media_accounts_set_updated_at on public.social_media_accounts;
create trigger social_media_accounts_set_updated_at
  before update on public.social_media_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists social_media_campaigns_set_updated_at on public.social_media_campaigns;
create trigger social_media_campaigns_set_updated_at
  before update on public.social_media_campaigns
  for each row execute function public.set_updated_at();

drop trigger if exists social_media_drafts_set_updated_at on public.social_media_drafts;
create trigger social_media_drafts_set_updated_at
  before update on public.social_media_drafts
  for each row execute function public.set_updated_at();

drop trigger if exists social_media_platform_posts_set_updated_at on public.social_media_platform_posts;
create trigger social_media_platform_posts_set_updated_at
  before update on public.social_media_platform_posts
  for each row execute function public.set_updated_at();

drop trigger if exists social_media_daily_plans_set_updated_at on public.social_media_daily_plans;
create trigger social_media_daily_plans_set_updated_at
  before update on public.social_media_daily_plans
  for each row execute function public.set_updated_at();

drop trigger if exists social_media_rules_set_updated_at on public.social_media_rules;
create trigger social_media_rules_set_updated_at
  before update on public.social_media_rules
  for each row execute function public.set_updated_at();

drop trigger if exists social_media_accounts_no_delete on public.social_media_accounts;
create trigger social_media_accounts_no_delete
  before delete on public.social_media_accounts
  for each row execute function public.block_admin_ops_delete();

drop trigger if exists social_media_campaigns_no_delete on public.social_media_campaigns;
create trigger social_media_campaigns_no_delete
  before delete on public.social_media_campaigns
  for each row execute function public.block_admin_ops_delete();

drop trigger if exists social_media_assets_no_delete on public.social_media_assets;
create trigger social_media_assets_no_delete
  before delete on public.social_media_assets
  for each row execute function public.block_admin_ops_delete();

drop trigger if exists social_media_drafts_no_delete on public.social_media_drafts;
create trigger social_media_drafts_no_delete
  before delete on public.social_media_drafts
  for each row execute function public.block_admin_ops_delete();

drop trigger if exists social_media_platform_posts_no_delete on public.social_media_platform_posts;
create trigger social_media_platform_posts_no_delete
  before delete on public.social_media_platform_posts
  for each row execute function public.block_admin_ops_delete();

drop trigger if exists social_media_dispatch_attempts_no_delete on public.social_media_dispatch_attempts;
create trigger social_media_dispatch_attempts_no_delete
  before delete on public.social_media_dispatch_attempts
  for each row execute function public.block_admin_ops_delete();

drop trigger if exists social_media_daily_plans_no_delete on public.social_media_daily_plans;
create trigger social_media_daily_plans_no_delete
  before delete on public.social_media_daily_plans
  for each row execute function public.block_admin_ops_delete();

drop trigger if exists social_media_rules_no_delete on public.social_media_rules;
create trigger social_media_rules_no_delete
  before delete on public.social_media_rules
  for each row execute function public.block_admin_ops_delete();

alter table public.social_media_accounts enable row level security;
alter table public.social_media_campaigns enable row level security;
alter table public.social_media_assets enable row level security;
alter table public.social_media_drafts enable row level security;
alter table public.social_media_platform_posts enable row level security;
alter table public.social_media_dispatch_attempts enable row level security;
alter table public.social_media_daily_plans enable row level security;
alter table public.social_media_rules enable row level security;

drop policy if exists "social_media_accounts_admin_select" on public.social_media_accounts;
create policy "social_media_accounts_admin_select"
  on public.social_media_accounts for select
  to authenticated
  using (public.is_ops_admin() or public.is_super_admin());

drop policy if exists "social_media_accounts_ops_mutate" on public.social_media_accounts;
create policy "social_media_accounts_ops_mutate"
  on public.social_media_accounts for all
  to authenticated
  using (public.is_ops_admin())
  with check (public.is_ops_admin());

drop policy if exists "social_media_campaigns_admin_select" on public.social_media_campaigns;
create policy "social_media_campaigns_admin_select"
  on public.social_media_campaigns for select
  to authenticated
  using (public.is_ops_admin() or public.is_super_admin());

drop policy if exists "social_media_campaigns_ops_mutate" on public.social_media_campaigns;
create policy "social_media_campaigns_ops_mutate"
  on public.social_media_campaigns for all
  to authenticated
  using (public.is_ops_admin())
  with check (public.is_ops_admin());

drop policy if exists "social_media_assets_admin_select" on public.social_media_assets;
create policy "social_media_assets_admin_select"
  on public.social_media_assets for select
  to authenticated
  using (public.is_ops_admin() or public.is_super_admin());

drop policy if exists "social_media_assets_ops_mutate" on public.social_media_assets;
create policy "social_media_assets_ops_mutate"
  on public.social_media_assets for all
  to authenticated
  using (public.is_ops_admin())
  with check (public.is_ops_admin());

drop policy if exists "social_media_drafts_admin_select" on public.social_media_drafts;
create policy "social_media_drafts_admin_select"
  on public.social_media_drafts for select
  to authenticated
  using (public.is_ops_admin() or public.is_super_admin());

drop policy if exists "social_media_drafts_ops_mutate" on public.social_media_drafts;
create policy "social_media_drafts_ops_mutate"
  on public.social_media_drafts for all
  to authenticated
  using (public.is_ops_admin())
  with check (public.is_ops_admin());

drop policy if exists "social_media_platform_posts_admin_select" on public.social_media_platform_posts;
create policy "social_media_platform_posts_admin_select"
  on public.social_media_platform_posts for select
  to authenticated
  using (public.is_ops_admin() or public.is_super_admin());

drop policy if exists "social_media_platform_posts_ops_mutate" on public.social_media_platform_posts;
create policy "social_media_platform_posts_ops_mutate"
  on public.social_media_platform_posts for all
  to authenticated
  using (public.is_ops_admin())
  with check (public.is_ops_admin());

drop policy if exists "social_media_dispatch_attempts_admin_select" on public.social_media_dispatch_attempts;
create policy "social_media_dispatch_attempts_admin_select"
  on public.social_media_dispatch_attempts for select
  to authenticated
  using (public.is_ops_admin() or public.is_super_admin());

drop policy if exists "social_media_dispatch_attempts_ops_insert" on public.social_media_dispatch_attempts;
create policy "social_media_dispatch_attempts_ops_insert"
  on public.social_media_dispatch_attempts for insert
  to authenticated
  with check (public.is_ops_admin());

drop policy if exists "social_media_daily_plans_admin_select" on public.social_media_daily_plans;
create policy "social_media_daily_plans_admin_select"
  on public.social_media_daily_plans for select
  to authenticated
  using (public.is_ops_admin() or public.is_super_admin());

drop policy if exists "social_media_daily_plans_ops_mutate" on public.social_media_daily_plans;
create policy "social_media_daily_plans_ops_mutate"
  on public.social_media_daily_plans for all
  to authenticated
  using (public.is_ops_admin())
  with check (public.is_ops_admin());

drop policy if exists "social_media_rules_admin_select" on public.social_media_rules;
create policy "social_media_rules_admin_select"
  on public.social_media_rules for select
  to authenticated
  using (public.is_ops_admin() or public.is_super_admin());

drop policy if exists "social_media_rules_ops_update" on public.social_media_rules;
create policy "social_media_rules_ops_update"
  on public.social_media_rules for update
  to authenticated
  using (public.is_ops_admin())
  with check (public.is_ops_admin());

revoke all on public.social_media_accounts from anon;
revoke all on public.social_media_campaigns from anon;
revoke all on public.social_media_assets from anon;
revoke all on public.social_media_drafts from anon;
revoke all on public.social_media_platform_posts from anon;
revoke all on public.social_media_dispatch_attempts from anon;
revoke all on public.social_media_daily_plans from anon;
revoke all on public.social_media_rules from anon;

grant select, insert, update on public.social_media_accounts to authenticated;
grant select, insert, update on public.social_media_campaigns to authenticated;
grant select, insert, update on public.social_media_assets to authenticated;
grant select, insert, update on public.social_media_drafts to authenticated;
grant select, insert, update on public.social_media_platform_posts to authenticated;
grant select, insert on public.social_media_dispatch_attempts to authenticated;
grant select, insert, update on public.social_media_daily_plans to authenticated;
grant select, update on public.social_media_rules to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.social_media_accounts to service_role;
    grant all on public.social_media_campaigns to service_role;
    grant all on public.social_media_assets to service_role;
    grant all on public.social_media_drafts to service_role;
    grant all on public.social_media_platform_posts to service_role;
    grant all on public.social_media_dispatch_attempts to service_role;
    grant all on public.social_media_daily_plans to service_role;
    grant all on public.social_media_rules to service_role;
  end if;
end $$;

comment on table public.social_media_accounts is
  'AllonaHub social media account inventory. Secrets are not stored here; tokens stay in server env or a vault.';

comment on table public.social_media_drafts is
  'Canonical social content drafts with exact, semantic and visual uniqueness fingerprints.';

comment on table public.social_media_platform_posts is
  'Per-platform social post variants queued only after Admin approval.';

comment on table public.social_media_dispatch_attempts is
  'Immutable delivery attempts for approved social posts, including dry-run and connector-pending states.';

comment on table public.social_media_rules is
  'Operational social media growth rules enforced by backend and database constraints.';
