# Country Engine production readiness runbook

Bu runbook migration dosyalarını production’a uygulamak için otomatik yetki vermez. Canlı veritabanı, backend deploy ve ülke/modül aktivasyonu ayrı owner onayı gerektirir.

## 1. Ön koşullar

- Production Supabase migration geçmişinin salt-okunur export’u
- `countries`, `country_modules`, `partner_passports`, `orders`, `products`, `hp_ledger` isim çakışması kontrolü
- Mevcut RLS policy ve helper function export’u
- Son veritabanı backup/PITR doğrulaması
- Staging ortamı ve test admin, super-admin, partner, customer hesapları
- Backend secret’ları frontend’e sızdırmayan environment doğrulaması

Production başlangıç flag’leri:

```dotenv
COUNTRY_ENGINE_ENABLED=false
COUNTRY_ENGINE_ADMIN_WRITES_ENABLED=false
COUNTRY_ENGINE_PUBLIC_IMPACT_ENABLED=false
```

## 2. Migration sırası

```text
supabase/migrations/20260827220000_create_country_engine.sql
supabase/migrations/20260827221000_create_cross_border_trade_foundation.sql
```

Önce staging’de uygulanır. İki dosya ikinci kez çalıştırılarak idempotency ve seed koruması test edilir.

## 3. Staging schema doğrulaması

```sql
select country_code, status, launch_stage, configuration
from public.countries
order by country_code;

select c.country_code, cm.module_key, cm.enabled, cm.beta,
       cm.public_visible, cm.partner_registration_enabled,
       cm.transaction_enabled, cm.approval_reference
from public.country_modules cm
join public.countries c on c.id = cm.country_id
order by c.country_code, cm.module_key;

select corridor_key, status, commerce_enabled, b2b_enabled,
       logistics_enabled, rewards_enabled
from public.trade_corridors
order by corridor_key;

select table_name, row_security
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'countries', 'country_modules', 'user_country_profiles',
    'partner_passports', 'trade_requests', 'trade_offers',
    'shipments', 'impact_metric_snapshots'
  )
order by table_name;
```

Beklenen güvenli başlangıç:

- TR country kaydı `PUBLIC / active`, fakat `configuration.enforcement_mode = shadow`
- Country Engine içindeki TR `transaction_enabled` flag’leri kapalı; mevcut legacy checkout bundan bağımsız olarak çalışmaya devam eder
- AZ/KZ/UZ/KG production transaction’ı kapalı
- tüm trade corridor flag’leri kapalı
- cross-border HP ve cashout kapalı
- provider assignment tablosunda production-ready aktif route yok
- impact tablosunda seed/sahte sayı yok

## 4. RLS ve state-machine testleri

Customer hesabı:

- yalnız kendi `user_country_profiles` ve `user_legal_acceptances` satırını okuyabilmeli
- başka kullanıcının ülke profilini okuyamamalı
- Country Control tablolarına doğrudan yazamamalı

Partner hesabı:

- yalnız üyesi olduğu partner passport/approval kayıtlarını okuyabilmeli
- trade request’i yalnız draft olarak oluşturabilmeli
- compliance veya publication alanını onaylayamamalı
- kendi teklifini accepted/rejected yapamamalı
- başka partnerin private teklifini okuyamamalı

Admin hesabı:

- Country Control snapshot okuyabilmeli
- MFA yoksa admin endpoint’i 403 vermeli
- `admin` rolü country/module PATCH yapamamalı

Super-admin hesabı:

- MFA + write flag olmadan PATCH yapamamalı
- approval reference olmadan exposure artıran değişiklik yapamamalı
- stale `expected_updated_at` ile 409 almalı
- audit event oluşmalı

Anon:

- yalnız `published`, verified ve no-personal-data impact satırlarını görebilmeli
- partner, shipment, offer, provider ve country configuration tablolarını doğrudan okuyamamalı

## 5. Backend smoke

Backend syntax ve unit test:

```bash
cd backend
npm run check
npm run test:platform
```

Flag kapalıyken:

- `GET /health` ve mevcut checkout/order/partner endpoint’leri değişmeden çalışmalı
- `GET /v1/platform/impact` boş ve `published=false` dönmeli
- country activation endpoint’leri işlem yapmamalı

Read flag açıkken:

- `GET /v1/platform/countries` yalnız disabled olmayan ülke dizinini dönmeli
- public response tax/payment/legal configuration veya credential reference içermemeli
- `GET /v1/admin/country-control` MFA’lı admin dışında açılmamalı

## 6. Frontend smoke

- `/index.html` 320px, 768px, 1440px viewport
- sabit kullanıcı/partner/HP sayısı görünmemeli
- doğrulanmış impact kaydı yoksa tüm sayaçlar `—` kalmalı
- `/pages/ecosystem/turkic-world.html` public açılmalı
- Country Engine kapalıysa yol haritası editoryal olarak görünmeli, canlı aktivasyon iddiası göstermemeli
- `/admin/country-control.html` yetkisiz kullanıcıyı admin login’e yönlendirmeli
- yeni KK/UZ/KY dil seçenekleri seçilebilmeli; original Türkçe metin DOM kaynak olarak korunmalı
- KZT/UZS/KGS seçimi currency UI’ı bozup TRY tutarını sessizce değiştirmemeli

## 7. Production shadow açılışı

İlk production release’te yalnız:

```dotenv
COUNTRY_ENGINE_ENABLED=true
COUNTRY_ENGINE_ADMIN_WRITES_ENABLED=false
COUNTRY_ENGINE_PUBLIC_IMPACT_ENABLED=false
```

kullanılır. Mevcut checkout Country Engine’e bağlanmaz.

Public impact ancak doğrulanmış gerçek pipeline ve yayın onayı sonrası açılır. Admin writes ancak MFA/RLS/audit ve provider-readiness testleri tamamlandıktan sonra ayrı release ile açılır.

## 8. Ülke/module activation gate

Her activation için:

- legal review
- privacy/data residency review
- payment provider production readiness
- tax/fiscal document readiness
- logistics/customs readiness gerekiyorsa doğrulama
- restricted products rule source
- partner onboarding/approval
- monitoring, alert ve rollback owner’ı
- approval reference

zorunludur.

Transaction açılışı, yalnız bir checkbox değişikliği olarak değerlendirilmez.

## 9. Rollback

Önce flag’ler kapatılır:

```dotenv
COUNTRY_ENGINE_ADMIN_WRITES_ENABLED=false
COUNTRY_ENGINE_PUBLIC_IMPACT_ENABLED=false
COUNTRY_ENGINE_ENABLED=false
```

Ardından backend/static release normal revert commit’iyle geri alınır. Additive tablolar bırakılır; tablo drop normal rollback değildir. Veri silme gerekiyorsa export + dependency audit + ayrı destructive migration + owner onayı gerekir.

## 10. Production tamamlanma kanıtı

Aşağıdakiler görülmeden production hazır denmez:

- Supabase migration history’de iki migration
- staging ve production schema diff sonucu
- RLS test raporu
- backend deploy revision
- health + public + admin smoke sonucu
- Country Control snapshot
- flag değerleri
- audit event örneği
- mevcut TR checkout/payment/invoice regresyon sonucu

Migration veya deploy uygulanmadıysa raporda açıkça “repository hazır, production uygulanmadı” yazılır.
