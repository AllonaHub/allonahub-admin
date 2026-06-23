create extension if not exists pgcrypto;

create table if not exists public.super_admin_permission_changes (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null default 'role_permission_update',
  old_role text,
  new_role text,
  old_account_status text,
  new_account_status text,
  old_risk_level text,
  new_risk_level text,
  reason text not null,
  risk_level text not null default 'high'
    check (risk_level in ('low', 'medium', 'high', 'critical')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists super_admin_permission_changes_target_idx
  on public.super_admin_permission_changes(target_user_id, created_at desc);

create index if not exists super_admin_permission_changes_actor_idx
  on public.super_admin_permission_changes(actor_id, created_at desc);

alter table public.super_admin_permission_changes enable row level security;

drop policy if exists "super_admin_permission_changes_owner_select" on public.super_admin_permission_changes;
create policy "super_admin_permission_changes_owner_select"
  on public.super_admin_permission_changes for select
  to authenticated
  using (public.is_super_admin_owner());

drop policy if exists "super_admin_permission_changes_no_client_insert" on public.super_admin_permission_changes;
create policy "super_admin_permission_changes_no_client_insert"
  on public.super_admin_permission_changes for insert
  to authenticated
  with check (false);

drop policy if exists "super_admin_permission_changes_no_client_update" on public.super_admin_permission_changes;
create policy "super_admin_permission_changes_no_client_update"
  on public.super_admin_permission_changes for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists "super_admin_permission_changes_no_client_delete" on public.super_admin_permission_changes;
create policy "super_admin_permission_changes_no_client_delete"
  on public.super_admin_permission_changes for delete
  to authenticated
  using (false);

revoke all on public.super_admin_permission_changes from anon;
grant select on public.super_admin_permission_changes to authenticated;

do $$
begin
  grant all on public.super_admin_permission_changes to service_role;
exception
  when undefined_object then null;
end $$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_app_role() = 'super_admin'
    and public.has_mfa()
    and exists (
      select 1
      from public.super_admin_owner_access owner_access
      where owner_access.status = 'active'
        and (
          owner_access.user_id = auth.uid()
          or (
            owner_access.email is not null
            and owner_access.email = lower(coalesce(auth.jwt() ->> 'email', ''))
          )
        )
    );
$$;

insert into public.platform_modules (module_key, name, category, commission_rate, sort_order, content_config)
values
  ('shop', 'Allona Shop', 'commerce', 0.1200, 10, '{"href":"../pages/commerce/allonashop.html","maturity":"transactional"}'::jsonb),
  ('food', 'Allona Yemek', 'commerce', 0.1200, 20, '{"href":"../pages/commerce/allonayemek.html","maturity":"transactional"}'::jsonb),
  ('market', 'Allona Market', 'commerce', 0.1200, 30, '{"href":"../pages/commerce/allonamarket.html","maturity":"transactional"}'::jsonb),
  ('taxi', 'Allona Taksi', 'transport', 0.1000, 40, '{"href":"../pages/ecosystem/allonataksi.html","maturity":"operational"}'::jsonb),
  ('mall', 'AVM Dünyası', 'commerce', 0.1200, 50, '{"href":"../pages/ecosystem/allonaavm.html","maturity":"content"}'::jsonb),
  ('travel', 'Seyahat & Turizm', 'travel', 0.1200, 60, '{"href":"../pages/ecosystem/allonaseyahat.html","maturity":"lead"}'::jsonb),
  ('real_estate', 'Gayrimenkul', 'marketplace', 0.0800, 70, '{"href":"../pages/ecosystem/allonagayrimenkul.html","maturity":"lead"}'::jsonb),
  ('maritime', 'Denizcilik', 'services', 0.1200, 80, '{"href":"../pages/ecosystem/denizcilik.html","maturity":"lead"}'::jsonb),
  ('legal', 'Hukuk', 'services', 0.1200, 90, '{"href":"../pages/ecosystem/allonahukuk.html","maturity":"lead"}'::jsonb),
  ('consulting', 'Danışmanlık', 'services', 0.1200, 100, '{"href":"../pages/ecosystem/allonadanismanlik.html","maturity":"lead"}'::jsonb),
  ('education', 'Eğitim', 'services', 0.1200, 110, '{"href":"../pages/ecosystem/allonaegitim.html","maturity":"lead"}'::jsonb),
  ('career', 'Kariyer', 'services', 0.1200, 120, '{"href":"../pages/career/allonakariyer.html","maturity":"lead"}'::jsonb),
  ('finance', 'Finans', 'finance', 0.0600, 130, '{"href":"../pages/ecosystem/allonafinans.html","maturity":"controlled"}'::jsonb),
  ('automotive', 'Otomotiv', 'marketplace', 0.0800, 140, '{"href":"../pages/ecosystem/allonaotomotiv.html","maturity":"lead"}'::jsonb),
  ('events', 'Eğlence & Etkinlik', 'services', 0.1200, 150, '{"href":"../pages/ecosystem/allonaeglence.html","maturity":"lead"}'::jsonb),
  ('pet', 'Evcil Hayvan', 'services', 0.1200, 160, '{"href":"../pages/ecosystem/allonaevcilhayvan.html","maturity":"lead"}'::jsonb),
  ('technology', 'Teknoloji', 'marketplace', 0.1000, 170, '{"href":"../pages/ecosystem/allonateknoloji.html","maturity":"lead"}'::jsonb),
  ('sports_fitness', 'Spor & Fitness', 'services', 0.1200, 180, '{"href":"../pages/ecosystem/allonasporfitness.html","maturity":"lead"}'::jsonb),
  ('beauty', 'Güzellik & Kozmetik', 'services', 0.1200, 190, '{"href":"../pages/ecosystem/allonaguzellik.html","maturity":"lead"}'::jsonb),
  ('insurance', 'Sigorta', 'finance', 0.0800, 200, '{"href":"../pages/ecosystem/allonasigorta.html","maturity":"controlled"}'::jsonb),
  ('courier', 'Kurye & Teslimat', 'logistics', 0.1000, 210, '{"href":"../pages/ecosystem/allonakurye.html","maturity":"operational"}'::jsonb),
  ('home_services', 'Ev Hizmetleri', 'services', 0.1200, 220, '{"href":"../pages/ecosystem/allonaevhizmetleri.html","maturity":"lead"}'::jsonb),
  ('logistics', 'Kargo & Lojistik', 'logistics', 0.1000, 230, '{"href":"../pages/ecosystem/allonalojistik.html","maturity":"operational"}'::jsonb),
  ('moving', 'Nakliye', 'logistics', 0.1000, 240, '{"href":"../pages/ecosystem/allonanakliye.html","maturity":"lead"}'::jsonb),
  ('organization', 'Organizasyon & Düğün', 'services', 0.1200, 250, '{"href":"../pages/ecosystem/allonaorganizasyon.html","maturity":"lead"}'::jsonb),
  ('agriculture', 'Allona Tarım', 'services', 0.1200, 260, '{"href":"../pages/ecosystem/allonatarim.html","maturity":"lead"}'::jsonb),
  ('construction', 'İnşaat & Yapı', 'services', 0.1200, 270, '{"href":"../pages/ecosystem/allonainsaat.html","maturity":"lead"}'::jsonb),
  ('engineering', 'Mühendislik', 'services', 0.1200, 280, '{"href":"../pages/ecosystem/allonamuhendislik.html","maturity":"lead"}'::jsonb),
  ('trade', 'Trade', 'commerce', 0.0800, 290, '{"href":"../pages/ecosystem/allonatrade.html","maturity":"controlled"}'::jsonb),
  ('hospitality', 'Otelcilik', 'travel', 0.1200, 300, '{"href":"../pages/ecosystem/allonaotelcilik.html","maturity":"lead"}'::jsonb),
  ('health', 'Allona Sağlık', 'services', 0.1200, 310, '{"href":"../pages/ecosystem/allonasaglik.html","maturity":"controlled"}'::jsonb)
on conflict (module_key) do update set
  name = excluded.name,
  category = excluded.category,
  sort_order = excluded.sort_order,
  content_config = public.platform_modules.content_config || excluded.content_config,
  updated_at = now();

create or replace function public.super_admin_update_profile_permission(
  p_target_user_id uuid,
  p_role text default null,
  p_account_status text default null,
  p_risk_level text default null,
  p_flagged_suspicious boolean default null,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_before public.profiles%rowtype;
  v_after public.profiles%rowtype;
  v_change public.super_admin_permission_changes%rowtype;
  v_risk text := 'medium';
begin
  if not public.is_super_admin_owner() then
    raise exception 'Only the Super Admin owner can update permissions';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 6 then
    raise exception 'Permission update reason is required';
  end if;

  select *
    into v_before
    from public.profiles
    where id = p_target_user_id
    for update;

  if not found then
    raise exception 'Target profile not found';
  end if;

  if p_role is not null and p_role not in ('customer', 'partner', 'courier', 'admin', 'super_admin') then
    raise exception 'Invalid role';
  end if;

  if p_account_status is not null and p_account_status not in ('active', 'passive', 'suspended') then
    raise exception 'Invalid account status';
  end if;

  if p_risk_level is not null and p_risk_level not in ('low', 'medium', 'high', 'critical') then
    raise exception 'Invalid risk level';
  end if;

  if p_target_user_id = v_actor_id then
    if p_role is not null and p_role <> 'super_admin' then
      raise exception 'Owner cannot demote the active Super Admin session';
    end if;
    if p_account_status is not null and p_account_status <> 'active' then
      raise exception 'Owner cannot deactivate the active Super Admin session';
    end if;
  end if;

  if p_role = 'super_admin' and not exists (
    select 1
    from public.super_admin_owner_access owner_access
    where owner_access.status = 'active'
      and (
        owner_access.user_id = p_target_user_id
        or (
          owner_access.email is not null
          and owner_access.email = lower(coalesce(v_before.email, ''))
        )
      )
  ) then
    raise exception 'Super Admin role requires active owner_access record';
  end if;

  v_risk := case
    when p_role = 'super_admin' or p_account_status = 'suspended' then 'critical'
    when p_role = 'admin' then 'high'
    else 'medium'
  end;

  update public.profiles
    set role = coalesce(p_role, role),
        account_status = coalesce(p_account_status, account_status),
        risk_level = coalesce(p_risk_level, risk_level),
        flagged_suspicious = coalesce(p_flagged_suspicious, flagged_suspicious),
        last_admin_note = trim(p_reason),
        updated_at = now()
    where id = p_target_user_id
    returning * into v_after;

  insert into public.super_admin_permission_changes (
    target_user_id,
    actor_id,
    action,
    old_role,
    new_role,
    old_account_status,
    new_account_status,
    old_risk_level,
    new_risk_level,
    reason,
    risk_level,
    metadata
  )
  values (
    p_target_user_id,
    v_actor_id,
    'role_permission_update',
    v_before.role,
    v_after.role,
    coalesce(v_before.account_status, 'active'),
    coalesce(v_after.account_status, 'active'),
    coalesce(v_before.risk_level, 'low'),
    coalesce(v_after.risk_level, 'low'),
    trim(p_reason),
    v_risk,
    jsonb_build_object(
      'target_email', v_after.email,
      'flagged_suspicious', coalesce(v_after.flagged_suspicious, false)
    )
  )
  returning * into v_change;

  return jsonb_build_object(
    'profile', to_jsonb(v_after),
    'change', to_jsonb(v_change)
  );
end;
$$;

revoke all on function public.super_admin_update_profile_permission(uuid, text, text, text, boolean, text) from public;
grant execute on function public.super_admin_update_profile_permission(uuid, text, text, text, boolean, text) to authenticated;

comment on table public.super_admin_permission_changes is
  'Owner-only immutable-ish permission change journal for Super Admin role, status and risk updates.';

comment on function public.super_admin_update_profile_permission(uuid, text, text, text, boolean, text) is
  'Security-definer permission gate. Requires MFA verified Super Admin owner and records a permission change row in one transaction.';
