alter table public.products
  add column if not exists seller_public_name text,
  add column if not exists seller_kind text not null default 'Platform satıcısı',
  add column if not exists seller_legal_name text,
  add column if not exists seller_city text,
  add column if not exists seller_contact text,
  add column if not exists seller_tax_number_masked text,
  add column if not exists invoice_responsibility text,
  add column if not exists seller_disclosure text,
  add column if not exists compliance_review_status text not null default 'pending',
  add column if not exists compliance_notes text;

update public.products
set
  seller_public_name = coalesce(nullif(seller_public_name, ''), nullif(brand, ''), 'AllonaHub'),
  seller_kind = coalesce(nullif(seller_kind, ''), case when partner_id is null then 'Platform satıcısı' else 'Partner satıcı' end),
  invoice_responsibility = coalesce(
    nullif(invoice_responsibility, ''),
    case
      when partner_id is null then 'Fatura ve satış sonrası süreçler AllonaHub resmi şirket kayıtlarıyla yürütülür.'
      else 'Fatura ve satış sonrası sorumluluk ilgili partner/satıcı kaydına göre yürütülür.'
    end
  ),
  seller_disclosure = coalesce(
    nullif(seller_disclosure, ''),
    case
      when partner_id is null then 'Satıcı, platform ve destek bilgileri AllonaHub yasal metinleri ve iletişim sayfasında yayınlanır.'
      else 'Satıcı bilgileri sipariş onayı öncesinde ve faturada gösterilir; destek AllonaHub üzerinden yürütülür.'
    end
  ),
  compliance_review_status = coalesce(nullif(compliance_review_status, ''), 'pending')
where seller_public_name is null
   or seller_kind is null
   or invoice_responsibility is null
   or seller_disclosure is null
   or compliance_review_status is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_compliance_review_status_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_compliance_review_status_check
      check (compliance_review_status in ('pending', 'approved', 'rejected', 'needs_review'));
  end if;
end $$;

create index if not exists products_compliance_review_idx
  on public.products(compliance_review_status, status, created_at desc);
