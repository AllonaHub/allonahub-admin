create extension if not exists pgcrypto;

create table if not exists public.partner_integration_connectors (
  provider text primary key
    check (provider in ('generic_feed', 'woocommerce', 'shopify', 'trendyol', 'hepsiburada', 'n11', 'ciceksepeti', 'pazarama', 'custom_api')),
  label text not null,
  category text not null default 'commerce'
    check (category in ('commerce', 'marketplace', 'feed', 'erp', 'custom')),
  connector_mode text not null default 'generic_feed'
    check (connector_mode in ('generic_feed', 'native_api', 'webhook', 'manual')),
  availability text not null default 'free'
    check (availability in ('free', 'premium', 'enterprise', 'planned')),
  stage text not null default 'enabled'
    check (stage in ('enabled', 'starter', 'premium_ready', 'planned')),
  inbound_supported boolean not null default true,
  outbound_supported boolean not null default false,
  free_enabled boolean not null default false,
  premium_ready boolean not null default false,
  secret_schema jsonb not null default '[]'::jsonb,
  default_settings jsonb not null default '{}'::jsonb,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_integrations (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  provider text not null references public.partner_integration_connectors(provider),
  display_name text not null,
  connection_mode text not null default 'generic_feed'
    check (connection_mode in ('generic_feed', 'native_api', 'webhook', 'manual')),
  direction text not null default 'inbound'
    check (direction in ('inbound', 'outbound', 'bidirectional')),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'needs_attention', 'disabled', 'archived')),
  plan_tier text not null default 'free'
    check (plan_tier in ('free', 'premium', 'enterprise')),
  sync_mode text not null default 'manual'
    check (sync_mode in ('manual', 'scheduled', 'webhook')),
  sync_interval_minutes integer not null default 1440 check (sync_interval_minutes between 15 and 10080),
  next_sync_at timestamptz,
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  import_enabled boolean not null default true,
  export_enabled boolean not null default false,
  default_publish_status text not null default 'draft'
    check (default_publish_status in ('draft', 'active')),
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_integration_secrets (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  integration_id uuid not null references public.partner_integrations(id) on delete cascade,
  secret_key text not null check (secret_key ~ '^[A-Z0-9_:-]{2,90}$'),
  secret_label text not null default '',
  encrypted_value text not null,
  status text not null default 'active'
    check (status in ('active', 'needs_rotation', 'disabled')),
  expires_at timestamptz,
  last_verified_at timestamptz,
  last_used_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_integration_field_mappings (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  integration_id uuid not null references public.partner_integrations(id) on delete cascade,
  source_field text not null,
  target_field text not null,
  transform_rule text not null default 'copy'
    check (transform_rule in ('copy', 'number', 'money', 'stock', 'slug', 'category_map', 'status_map', 'boolean', 'custom')),
  default_value text,
  is_required boolean not null default false,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_integration_runs (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  integration_id uuid references public.partner_integrations(id) on delete set null,
  direction text not null default 'inbound'
    check (direction in ('inbound', 'outbound', 'bidirectional')),
  trigger_source text not null default 'manual'
    check (trigger_source in ('manual', 'cron', 'webhook', 'admin', 'system')),
  run_mode text not null default 'preview'
    check (run_mode in ('preview', 'apply')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'success', 'partial', 'failed', 'skipped', 'cancelled')),
  checked_count integer not null default 0 check (checked_count >= 0),
  created_count integer not null default 0 check (created_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  error_message text,
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.partner_integration_product_links (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  integration_id uuid not null references public.partner_integrations(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  external_product_id text not null,
  external_variant_id text,
  external_sku text,
  source_hash text,
  sync_status text not null default 'linked'
    check (sync_status in ('linked', 'created', 'updated', 'skipped', 'failed', 'archived')),
  last_payload jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_integration_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  integration_id uuid not null references public.partner_integrations(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  action text not null default 'upsert'
    check (action in ('create', 'update', 'upsert', 'stock_price', 'archive', 'delete')),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'success', 'failed', 'cancelled')),
  priority integer not null default 100 check (priority between 1 and 999),
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_message text,
  scheduled_at timestamptz not null default now(),
  processed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_integrations_partner_idx
  on public.partner_integrations(partner_id, status, provider, updated_at desc);
create index if not exists partner_integrations_sync_idx
  on public.partner_integrations(status, sync_mode, next_sync_at)
  where import_enabled = true;

create unique index if not exists partner_integration_secrets_unique_idx
  on public.partner_integration_secrets(integration_id, secret_key);
create index if not exists partner_integration_secrets_partner_idx
  on public.partner_integration_secrets(partner_id, status, updated_at desc);

create unique index if not exists partner_integration_field_mappings_unique_idx
  on public.partner_integration_field_mappings(integration_id, target_field);

create index if not exists partner_integration_runs_partner_idx
  on public.partner_integration_runs(partner_id, started_at desc);
create index if not exists partner_integration_runs_integration_idx
  on public.partner_integration_runs(integration_id, started_at desc);

create unique index if not exists partner_integration_product_links_unique_idx
  on public.partner_integration_product_links(integration_id, external_product_id, coalesce(external_variant_id, ''));
create index if not exists partner_integration_product_links_product_idx
  on public.partner_integration_product_links(product_id);

create index if not exists partner_integration_publish_jobs_queue_idx
  on public.partner_integration_publish_jobs(status, scheduled_at, priority)
  where status in ('queued', 'failed');
create index if not exists partner_integration_publish_jobs_partner_idx
  on public.partner_integration_publish_jobs(partner_id, status, created_at desc);

drop trigger if exists partner_integration_connectors_set_updated_at on public.partner_integration_connectors;
create trigger partner_integration_connectors_set_updated_at
  before update on public.partner_integration_connectors
  for each row execute function public.set_updated_at();

drop trigger if exists partner_integrations_set_updated_at on public.partner_integrations;
create trigger partner_integrations_set_updated_at
  before update on public.partner_integrations
  for each row execute function public.set_updated_at();

drop trigger if exists partner_integration_secrets_set_updated_at on public.partner_integration_secrets;
create trigger partner_integration_secrets_set_updated_at
  before update on public.partner_integration_secrets
  for each row execute function public.set_updated_at();

drop trigger if exists partner_integration_field_mappings_set_updated_at on public.partner_integration_field_mappings;
create trigger partner_integration_field_mappings_set_updated_at
  before update on public.partner_integration_field_mappings
  for each row execute function public.set_updated_at();

drop trigger if exists partner_integration_product_links_set_updated_at on public.partner_integration_product_links;
create trigger partner_integration_product_links_set_updated_at
  before update on public.partner_integration_product_links
  for each row execute function public.set_updated_at();

drop trigger if exists partner_integration_publish_jobs_set_updated_at on public.partner_integration_publish_jobs;
create trigger partner_integration_publish_jobs_set_updated_at
  before update on public.partner_integration_publish_jobs
  for each row execute function public.set_updated_at();

alter table public.partner_integration_connectors enable row level security;
alter table public.partner_integrations enable row level security;
alter table public.partner_integration_secrets enable row level security;
alter table public.partner_integration_field_mappings enable row level security;
alter table public.partner_integration_runs enable row level security;
alter table public.partner_integration_product_links enable row level security;
alter table public.partner_integration_publish_jobs enable row level security;

drop policy if exists "partner_integration_connectors_read" on public.partner_integration_connectors;
create policy "partner_integration_connectors_read"
  on public.partner_integration_connectors for select
  using (true);

drop policy if exists "partner_integration_connectors_admin_write" on public.partner_integration_connectors;
create policy "partner_integration_connectors_admin_write"
  on public.partner_integration_connectors for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "partner_integrations_member_or_admin" on public.partner_integrations;
create policy "partner_integrations_member_or_admin"
  on public.partner_integrations for all
  to authenticated
  using (public.partner_member_has_access(partner_id))
  with check (public.partner_member_has_access(partner_id));

drop policy if exists "partner_integration_secrets_no_client_select" on public.partner_integration_secrets;
create policy "partner_integration_secrets_no_client_select"
  on public.partner_integration_secrets for select
  to authenticated
  using (false);

drop policy if exists "partner_integration_secrets_no_client_insert" on public.partner_integration_secrets;
create policy "partner_integration_secrets_no_client_insert"
  on public.partner_integration_secrets for insert
  to authenticated
  with check (false);

drop policy if exists "partner_integration_secrets_no_client_update" on public.partner_integration_secrets;
create policy "partner_integration_secrets_no_client_update"
  on public.partner_integration_secrets for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists "partner_integration_field_mappings_member_or_admin" on public.partner_integration_field_mappings;
create policy "partner_integration_field_mappings_member_or_admin"
  on public.partner_integration_field_mappings for all
  to authenticated
  using (public.partner_member_has_access(partner_id))
  with check (public.partner_member_has_access(partner_id));

drop policy if exists "partner_integration_runs_member_or_admin" on public.partner_integration_runs;
create policy "partner_integration_runs_member_or_admin"
  on public.partner_integration_runs for select
  to authenticated
  using (public.partner_member_has_access(partner_id));

drop policy if exists "partner_integration_product_links_member_or_admin" on public.partner_integration_product_links;
create policy "partner_integration_product_links_member_or_admin"
  on public.partner_integration_product_links for all
  to authenticated
  using (public.partner_member_has_access(partner_id))
  with check (public.partner_member_has_access(partner_id));

drop policy if exists "partner_integration_publish_jobs_member_or_admin" on public.partner_integration_publish_jobs;
create policy "partner_integration_publish_jobs_member_or_admin"
  on public.partner_integration_publish_jobs for all
  to authenticated
  using (public.partner_member_has_access(partner_id))
  with check (public.partner_member_has_access(partner_id));

revoke all on public.partner_integration_secrets from anon;
revoke all on public.partner_integration_secrets from authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.partner_integration_connectors to service_role;
    grant all on public.partner_integrations to service_role;
    grant all on public.partner_integration_secrets to service_role;
    grant all on public.partner_integration_field_mappings to service_role;
    grant all on public.partner_integration_runs to service_role;
    grant all on public.partner_integration_product_links to service_role;
    grant all on public.partner_integration_publish_jobs to service_role;
  end if;
end $$;

insert into public.partner_integration_connectors (
  provider, label, category, connector_mode, availability, stage,
  inbound_supported, outbound_supported, free_enabled, premium_ready,
  secret_schema, default_settings, sort_order
) values
  (
    'generic_feed', 'CSV / JSON Feed', 'feed', 'generic_feed', 'free', 'enabled',
    true, false, true, true,
    '[{"key":"FEED_URL","label":"Feed URL","required":true}]'::jsonb,
    '{"default_publish_status":"draft","max_preview_rows":50}'::jsonb,
    10
  ),
  (
    'woocommerce', 'WooCommerce', 'commerce', 'native_api', 'free', 'starter',
    true, true, true, true,
    '[{"key":"API_BASE_URL","label":"Mağaza URL","required":true},{"key":"CONSUMER_KEY","label":"Consumer key","required":true},{"key":"CONSUMER_SECRET","label":"Consumer secret","required":true}]'::jsonb,
    '{"default_publish_status":"draft","endpoint":"/wp-json/wc/v3/products"}'::jsonb,
    20
  ),
  (
    'shopify', 'Shopify', 'commerce', 'native_api', 'premium', 'premium_ready',
    true, true, false, true,
    '[{"key":"SHOP_DOMAIN","label":"Shop domain","required":true},{"key":"ACCESS_TOKEN","label":"Admin API token","required":true}]'::jsonb,
    '{"default_publish_status":"draft","api":"admin_graphql"}'::jsonb,
    30
  ),
  (
    'trendyol', 'Trendyol Pazaryeri', 'marketplace', 'native_api', 'premium', 'premium_ready',
    true, true, false, true,
    '[{"key":"SUPPLIER_ID","label":"Supplier ID","required":true},{"key":"API_KEY","label":"API key","required":true},{"key":"API_SECRET","label":"API secret","required":true}]'::jsonb,
    '{"default_publish_status":"draft","marketplace":"trendyol"}'::jsonb,
    40
  ),
  (
    'hepsiburada', 'Hepsiburada', 'marketplace', 'native_api', 'premium', 'premium_ready',
    true, true, false, true,
    '[{"key":"MERCHANT_ID","label":"Merchant ID","required":true},{"key":"API_KEY","label":"API key","required":true},{"key":"API_SECRET","label":"API secret","required":true}]'::jsonb,
    '{"default_publish_status":"draft","marketplace":"hepsiburada"}'::jsonb,
    50
  ),
  (
    'n11', 'n11', 'marketplace', 'native_api', 'premium', 'premium_ready',
    true, true, false, true,
    '[{"key":"APP_KEY","label":"App key","required":true},{"key":"APP_SECRET","label":"App secret","required":true}]'::jsonb,
    '{"default_publish_status":"draft","marketplace":"n11"}'::jsonb,
    60
  ),
  (
    'ciceksepeti', 'Çiçeksepeti', 'marketplace', 'native_api', 'premium', 'planned',
    true, true, false, true,
    '[{"key":"API_KEY","label":"API key","required":true}]'::jsonb,
    '{"default_publish_status":"draft","marketplace":"ciceksepeti"}'::jsonb,
    70
  ),
  (
    'pazarama', 'Pazarama', 'marketplace', 'native_api', 'premium', 'planned',
    true, true, false, true,
    '[{"key":"API_KEY","label":"API key","required":true},{"key":"API_SECRET","label":"API secret","required":true}]'::jsonb,
    '{"default_publish_status":"draft","marketplace":"pazarama"}'::jsonb,
    80
  ),
  (
    'custom_api', 'Özel API', 'custom', 'native_api', 'enterprise', 'premium_ready',
    true, true, false, true,
    '[{"key":"API_BASE_URL","label":"API URL","required":true},{"key":"ACCESS_TOKEN","label":"Access token","required":false},{"key":"WEBHOOK_SECRET","label":"Webhook secret","required":false}]'::jsonb,
    '{"default_publish_status":"draft","requires_mapping":true}'::jsonb,
    90
  )
on conflict (provider) do update set
  label = excluded.label,
  category = excluded.category,
  connector_mode = excluded.connector_mode,
  availability = excluded.availability,
  stage = excluded.stage,
  inbound_supported = excluded.inbound_supported,
  outbound_supported = excluded.outbound_supported,
  free_enabled = excluded.free_enabled,
  premium_ready = excluded.premium_ready,
  secret_schema = excluded.secret_schema,
  default_settings = excluded.default_settings,
  sort_order = excluded.sort_order,
  updated_at = now();

comment on table public.partner_integration_connectors is
  'AllonaHub integration connector catalog. Free connectors are active now; premium_ready connectors can be opened later with a single connector flag and env policy.';

comment on table public.partner_integrations is
  'Partner-owned integration connections for inbound product import and future outbound marketplace publishing.';

comment on table public.partner_integration_secrets is
  'Encrypted server-side API credentials for partner integrations. Client roles cannot read or mutate rows directly.';

comment on table public.partner_integration_publish_jobs is
  'Future outbound publish queue for pushing AllonaHub product changes to external platforms.';
