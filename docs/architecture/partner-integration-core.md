# Partner Integration Core

AllonaHub Partner Integration Core, partner ürünlerini dış kaynaklardan AllonaHub kataloğuna almak ve ileride AllonaHub ürünlerini dış platformlara yayınlamak için kurulan ücretsiz başlangıç altyapısıdır.

## Başlangıç Kapsamı

- Ücretsiz açık: `generic_feed` ve `woocommerce`
- Hazır ama kapalı: `shopify`, `trendyol`, `hepsiburada`, `n11`, `custom_api`
- Güvenli varsayılan: dışarıdan çekilen ürünler `draft` durumunda bekletilir
- Panel: Partner OS > Entegrasyonlar
- Cron: `POST /v1/cron/integrations/sync`
- API secretleri: server-side AES-256-GCM vault ile saklanır, frontend'e geri dönmez

## Veritabanı

Migration:

```text
supabase/migrations/20260628120000_create_partner_integration_core.sql
```

Ana tablolar:

- `partner_integration_connectors`: Connector kataloğu ve free/premium bayrakları
- `partner_integrations`: Partner bağlantıları
- `partner_integration_secrets`: Şifreli API/feed bilgileri
- `partner_integration_runs`: Test/senkron çalışma logları
- `partner_integration_product_links`: Dış ürün ID ile AllonaHub ürün ID eşleşmesi
- `partner_integration_field_mappings`: Gelecek kategori/alan eşleme kuralları
- `partner_integration_publish_jobs`: Gelecek outbound yayın kuyruğu

## Backend Bayrakları

```text
PARTNER_INTEGRATIONS_ENABLED=true
PARTNER_INTEGRATIONS_PREMIUM_ENABLED=false
PARTNER_INTEGRATIONS_OUTBOUND_ENABLED=false
PARTNER_INTEGRATIONS_REMOTE_FETCH_ENABLED=true
PARTNER_INTEGRATIONS_MAX_PREVIEW_ROWS=50
PARTNER_INTEGRATIONS_MAX_APPLY_ROWS=100
PARTNER_INTEGRATIONS_FETCH_TIMEOUT_MS=12000
```

Premium connectorları kod değiştirmeden açmak:

```sql
update public.partner_integration_connectors
set free_enabled = true,
    stage = 'enabled',
    updated_at = now()
where provider in ('shopify', 'trendyol', 'hepsiburada', 'n11');
```

Outbound yayın katmanını açmak için backend env:

```text
PARTNER_INTEGRATIONS_OUTBOUND_ENABLED=true
```

## API

- `GET /v1/partner/integrations`
- `POST /v1/partner/integrations`
- `POST /v1/partner/integrations/:integrationId/test`
- `POST /v1/partner/integrations/:integrationId/sync`
- `POST /v1/cron/integrations/sync`

`sync` endpointi iki mod taşır:

- `preview`: Dış kaynaktan ürünleri okur, ürün tablosuna yazmaz
- `apply`: Ürünleri `products` tablosuna işler ve `partner_integration_product_links` eşleşmesini yazar

Partner paneli başlangıçta yalnızca güvenli `preview` çalıştırır. `apply` modu backend tarafında hazırdır ve operasyonel onayla açılmalıdır.

## Ücretlendirme Yolu

Bugünkü teklif ücretsiz partner kazanımı içindir. İleride paketleme:

- Free: CSV/JSON feed, WooCommerce preview, manuel senkron
- Premium: Shopify/Trendyol/Hepsiburada/n11, zamanlı senkron, yüksek limit
- Enterprise: Özel API, outbound yayın kuyruğu, özel field mapping, SLA destek

Bu ayrım `partner_integration_connectors.availability`, `free_enabled`, backend env bayrakları ve partner plan kontrolleriyle yönetilir.
