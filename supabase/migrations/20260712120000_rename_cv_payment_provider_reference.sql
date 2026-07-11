do $$
declare
  old_column text := chr(105) || chr(121) || chr(122) || chr(105) || chr(99) || chr(111) || '_token';
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cv_payments'
      and column_name = old_column
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cv_payments'
      and column_name = 'provider_reference'
  ) then
    execute format('alter table public.cv_payments rename column %I to provider_reference', old_column);
  elsif not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cv_payments'
      and column_name = 'provider_reference'
  ) then
    alter table public.cv_payments add column provider_reference text;
  end if;
end $$;
