do $$
declare
  name_column text;
  has_brand boolean;
  has_sku boolean;
  market_predicate text;
begin
  select case
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'products' and column_name = 'name'
    ) then 'name'
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'products' and column_name = 'product_name'
    ) then 'product_name'
    else null
  end into name_column;

  if name_column is null then
    raise notice 'Allona Market visual repair skipped: products table has no name/product_name column.';
    return;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'brand'
  ) into has_brand;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'sku'
  ) into has_sku;

  market_predicate = 'module_key = ''market'' or lower(coalesce(category, '''')) like ''market /%''';
  if has_brand then
    market_predicate = market_predicate || ' or lower(coalesce(brand, '''')) like ''%allona market%''';
  end if;
  if has_sku then
    market_predicate = market_predicate || ' or upper(coalesce(sku, '''')) like ''ALM-%''';
  end if;

  execute format(
    'update public.products
     set image_url = case
       when lower(coalesce(%1$I, '''') || '' '' || coalesce(category, '''')) ~ ''su|içecek|icecek|kaynak'' then ''/images/modules/market-water-pack.png''
       when lower(coalesce(%1$I, '''') || '' '' || coalesce(category, '''')) ~ ''kağıt|kagit|havlu|temizlik|deterjan|ev ihtiyaç|ev ihtiyac'' then ''/images/modules/market-paper-towels.png''
       when lower(coalesce(%1$I, '''') || '' '' || coalesce(category, '''')) ~ ''bebek|mendil|bakım|bakim|hijyen'' then ''/images/modules/market-baby-wipes.png''
       when lower(coalesce(%1$I, '''') || '' '' || coalesce(category, '''')) ~ ''atıştırmalık|atistirmalik|kahve|makarna|sos'' then ''/images/modules/market-snack-box.png''
       else ''/images/modules/market-light-v5.jpg''
     end,
     module_key = ''market''
     where (%2$s)
       and (
         image_url is null
         or image_url = ''''
         or image_url like ''%%images.unsplash.com%%''
         or image_url like ''%%source.unsplash.com%%''
       )',
    name_column,
    market_predicate
  );
end $$;
