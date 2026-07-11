create extension if not exists pgcrypto;

do $$ begin
  create type public.payment_status as enum ('pending', 'awaiting_payment', 'paid', 'failed', 'refunded');
exception when duplicate_object then null;
end $$;

create table if not exists public.cv_device_accounts (
  device_key text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_agent text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (device_key, user_id)
);

create index if not exists cv_device_accounts_user_idx
  on public.cv_device_accounts(user_id, first_seen_at);

create table if not exists public.cv_access_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  device_key text,
  free_limit integer not null default 2 check (free_limit >= 0),
  free_used integer not null default 0 check (free_used >= 0),
  paid_credits integer not null default 0 check (paid_credits >= 0),
  is_risky boolean not null default false,
  risk_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cv_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  device_key text,
  generation_type text not null check (generation_type in ('free', 'paid_credit')),
  cv_title text,
  created_at timestamptz not null default now()
);

create table if not exists public.cv_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  amount numeric(12,2) not null default 149.99 check (amount >= 0),
  currency text not null default 'TRY',
  status public.payment_status not null default 'pending',
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  kind text not null,
  severity text not null default 'info',
  title text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists admin_notifications_kind_created_idx
  on public.admin_notifications(kind, created_at desc);
create index if not exists cv_payments_user_status_idx
  on public.cv_payments(user_id, status, created_at desc);
create index if not exists cv_generations_user_created_idx
  on public.cv_generations(user_id, created_at desc);

drop trigger if exists cv_access_accounts_set_updated_at on public.cv_access_accounts;
create trigger cv_access_accounts_set_updated_at
  before update on public.cv_access_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists cv_payments_set_updated_at on public.cv_payments;
create trigger cv_payments_set_updated_at
  before update on public.cv_payments
  for each row execute function public.set_updated_at();

create or replace function public.ensure_cv_access(
  p_device_key text,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_device_key text := nullif(trim(coalesce(p_device_key, '')), '');
  v_first_user uuid;
  v_device_count integer := 0;
  v_is_risky boolean := false;
  v_access public.cv_access_accounts%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_device_key is null then
    v_device_key := 'unknown:' || v_user_id::text;
  end if;

  insert into public.cv_device_accounts (device_key, user_id, user_agent, last_seen_at)
  values (v_device_key, v_user_id, left(coalesce(p_user_agent, ''), 500), now())
  on conflict (device_key, user_id) do update
    set last_seen_at = now(),
        user_agent = left(coalesce(excluded.user_agent, public.cv_device_accounts.user_agent, ''), 500);

  select user_id
    into v_first_user
  from public.cv_device_accounts
  where device_key = v_device_key
  order by first_seen_at asc
  limit 1;

  select count(distinct user_id)
    into v_device_count
  from public.cv_device_accounts
  where device_key = v_device_key;

  v_is_risky := v_first_user is not null and v_first_user <> v_user_id;

  insert into public.cv_access_accounts (
    user_id,
    device_key,
    free_limit,
    free_used,
    paid_credits,
    is_risky,
    risk_reason
  )
  values (
    v_user_id,
    v_device_key,
    case when v_is_risky then 0 else 2 end,
    0,
    0,
    v_is_risky,
    case when v_is_risky then 'same_device_multiple_accounts' else null end
  )
  on conflict (user_id) do update
    set device_key = coalesce(public.cv_access_accounts.device_key, excluded.device_key),
        is_risky = public.cv_access_accounts.is_risky or excluded.is_risky,
        risk_reason = case
          when public.cv_access_accounts.is_risky or excluded.is_risky
            then coalesce(public.cv_access_accounts.risk_reason, excluded.risk_reason)
          else null
        end,
        updated_at = now()
  returning * into v_access;

  if v_is_risky and not exists (
    select 1
    from public.admin_notifications
    where kind = 'cv_device_risk'
      and user_id = v_user_id
      and metadata ->> 'device_key' = v_device_key
  ) then
    insert into public.admin_notifications (user_id, kind, severity, title, message, metadata)
    values (
      v_user_id,
      'cv_device_risk',
      'risk',
      'Riskli CV profili',
      'Aynı cihaz üzerinden ikinci veya daha sonraki bir hesap CV hakkı talep etti. Bu hesaba ücretsiz CV hakkı tanımlanmadı.',
      jsonb_build_object(
        'device_key', v_device_key,
        'device_account_count', v_device_count,
        'first_user_id', v_first_user,
        'risk_reason', 'same_device_multiple_accounts'
      )
    );
  end if;

  return jsonb_build_object(
    'user_id', v_access.user_id,
    'free_limit', v_access.free_limit,
    'free_used', v_access.free_used,
    'remaining_free', greatest(v_access.free_limit - v_access.free_used, 0),
    'paid_credits', v_access.paid_credits,
    'is_risky', v_access.is_risky,
    'risk_reason', v_access.risk_reason,
    'device_account_count', v_device_count
  );
end;
$$;

create or replace function public.claim_cv_generation(
  p_device_key text,
  p_cv_title text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_device_key text := nullif(trim(coalesce(p_device_key, '')), '');
  v_access public.cv_access_accounts%rowtype;
  v_generation_type text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform public.ensure_cv_access(v_device_key, p_user_agent);

  select *
    into v_access
  from public.cv_access_accounts
  where user_id = v_user_id
  for update;

  if v_access.free_used < v_access.free_limit then
    update public.cv_access_accounts
      set free_used = free_used + 1,
          updated_at = now()
      where user_id = v_user_id
      returning * into v_access;
    v_generation_type := 'free';
  elsif v_access.paid_credits > 0 then
    update public.cv_access_accounts
      set paid_credits = paid_credits - 1,
          updated_at = now()
      where user_id = v_user_id
      returning * into v_access;
    v_generation_type := 'paid_credit';
  else
    return jsonb_build_object(
      'allowed', false,
      'payment_required', true,
      'payment_url', '/pages/career/cv-payment.html?reason=limit',
      'remaining_free', 0,
      'paid_credits', v_access.paid_credits,
      'is_risky', v_access.is_risky
    );
  end if;

  insert into public.cv_generations (user_id, device_key, generation_type, cv_title)
  values (v_user_id, v_device_key, v_generation_type, left(coalesce(p_cv_title, ''), 180));

  return jsonb_build_object(
    'allowed', true,
    'payment_required', false,
    'generation_type', v_generation_type,
    'remaining_free', greatest(v_access.free_limit - v_access.free_used, 0),
    'paid_credits', v_access.paid_credits,
    'is_risky', v_access.is_risky
  );
end;
$$;

create or replace function public.report_cv_device_signal(
  p_device_key text,
  p_email text default null,
  p_context text default 'register_attempt',
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device_key text := nullif(trim(coalesce(p_device_key, '')), '');
  v_known_count integer := 0;
begin
  if v_device_key is null then
    return jsonb_build_object('reported', false, 'reason', 'missing_device_key');
  end if;

  select count(distinct user_id)
    into v_known_count
  from public.cv_device_accounts
  where device_key = v_device_key;

  if v_known_count = 0 then
    return jsonb_build_object('reported', false, 'known_accounts', 0);
  end if;

  if not exists (
    select 1
    from public.admin_notifications
    where kind = 'cv_device_signup_attempt'
      and metadata ->> 'device_key' = v_device_key
      and metadata ->> 'email' = coalesce(p_email, '')
      and created_at > now() - interval '12 hours'
  ) then
    insert into public.admin_notifications (kind, severity, title, message, metadata)
    values (
      'cv_device_signup_attempt',
      'risk',
      'Aynı cihazdan yeni hesap denemesi',
      'Daha önce CV hakkı kullanılan bir cihazdan yeni hesap açma denemesi yapıldı.',
      jsonb_build_object(
        'device_key', v_device_key,
        'known_account_count', v_known_count,
        'email', coalesce(p_email, ''),
        'context', coalesce(p_context, 'register_attempt'),
        'user_agent', left(coalesce(p_user_agent, ''), 500)
      )
    );
  end if;

  return jsonb_build_object('reported', true, 'known_accounts', v_known_count);
end;
$$;

alter table public.cv_device_accounts enable row level security;
alter table public.cv_access_accounts enable row level security;
alter table public.cv_generations enable row level security;
alter table public.cv_payments enable row level security;
alter table public.admin_notifications enable row level security;

drop policy if exists "cv_device_accounts_select_own_or_admin" on public.cv_device_accounts;
create policy "cv_device_accounts_select_own_or_admin"
  on public.cv_device_accounts for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "cv_device_accounts_admin_all" on public.cv_device_accounts;
create policy "cv_device_accounts_admin_all"
  on public.cv_device_accounts for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cv_access_select_own_or_admin" on public.cv_access_accounts;
create policy "cv_access_select_own_or_admin"
  on public.cv_access_accounts for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "cv_access_admin_all" on public.cv_access_accounts;
create policy "cv_access_admin_all"
  on public.cv_access_accounts for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cv_generations_select_own_or_admin" on public.cv_generations;
create policy "cv_generations_select_own_or_admin"
  on public.cv_generations for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "cv_generations_admin_all" on public.cv_generations;
create policy "cv_generations_admin_all"
  on public.cv_generations for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cv_payments_select_own_or_admin" on public.cv_payments;
create policy "cv_payments_select_own_or_admin"
  on public.cv_payments for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "cv_payments_admin_all" on public.cv_payments;
create policy "cv_payments_admin_all"
  on public.cv_payments for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin_notifications_select_admin" on public.admin_notifications;
create policy "admin_notifications_select_admin"
  on public.admin_notifications for select
  using (public.is_admin());

drop policy if exists "admin_notifications_admin_all" on public.admin_notifications;
create policy "admin_notifications_admin_all"
  on public.admin_notifications for all
  using (public.is_admin())
  with check (public.is_admin());

grant execute on function public.ensure_cv_access(text, text) to authenticated;
grant execute on function public.claim_cv_generation(text, text, text) to authenticated;
grant execute on function public.report_cv_device_signal(text, text, text, text) to anon, authenticated;
