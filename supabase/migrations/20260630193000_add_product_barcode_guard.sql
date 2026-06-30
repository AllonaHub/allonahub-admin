alter table if exists public.products
  add column if not exists barcode text;

create index if not exists products_partner_barcode_idx
  on public.products(partner_id, barcode)
  where barcode is not null and btrim(barcode) <> '';

do $$
begin
  if to_regclass('public.products_partner_barcode_unique_idx') is null then
    if exists (
      select 1
      from public.products
      where barcode is not null and btrim(barcode) <> ''
      group by partner_id, barcode
      having count(*) > 1
    ) then
      raise notice 'products_partner_barcode_unique_idx skipped because duplicate barcodes already exist.';
    else
      create unique index products_partner_barcode_unique_idx
        on public.products(partner_id, barcode)
        where barcode is not null and btrim(barcode) <> '';
    end if;
  end if;
end $$;

comment on column public.products.barcode is 'Partner-visible product barcode/GTIN used to prevent duplicate product creation and improve variant matching.';
