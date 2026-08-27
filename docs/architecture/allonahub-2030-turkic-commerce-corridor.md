# AllonaHub 2030 — Türk Dünyası Dijital Ticaret Koridoru

Durum: repository temeli hazır, production aktivasyonu yapılmadı
Tarih: 2026-08-27
Mimari ilke: `COUNTRY × MODULE × PARTNER × USER × COMMERCE`

## 1. Sonuç ve güvenlik sınırı

Bu çalışma mevcut AllonaHub sistemini yeniden yazmaz. Yeni Country Engine ve sınır ötesi ticaret modelleri mevcut tabloların üzerine additive ve shadow-mode bir katman olarak eklenir.

- Mevcut Türkiye sipariş, ödeme, vergi, KDV, fatura, HP ve partner davranışı migration tarafından yönlendirilmez.
- Country Engine production ortamında varsayılan olarak kapalıdır.
- Admin yazmaları ikinci ve ayrı bir production flag ile kapalıdır.
- Gümrük, devlet, AI çeviri, ödeme, e-dönüşüm veya lojistik için sahte provider yazılmamıştır.
- Türkiye dışındaki ülkeler production işlemine açık değildir.
- Kamu ortaklığı, endorsement veya kurumsal entegrasyon iddiası yoktur.
- Public impact sayaçları yalnız doğrulanmış ve açıkça `published` yapılmış aggregate kayıtlardan beslenir.

Migration dosyasının repository’de bulunması, production veritabanına uygulandığı anlamına gelmez. Production uygulaması için [country-engine-production-readiness.md](../runbooks/country-engine-production-readiness.md) izlenmelidir.

## 2. Mevcut sistem incelemesi

### Frontend

- Ana yayın kaynağı: `/index.html`
- Ortak kabuk: `/js/layout.v3.js`
- Ortak tema, dil ve çeviri davranışı: `/js/platform.js` + `/i18n/`
- Ortak ürün/para birimi davranışı: `/js/core.js`
- Shop: `/pages/commerce/`
- Kullanıcı hesabı: `/pages/account/`
- Partner: `/pages/partner/` ve `/partner/`
- Admin: `/admin/`
- Ekosistem modülleri: `/pages/ecosystem/`

Frontend HTML5/CSS3/vanilla JavaScript yapısında kalır. Ülke başına kopya frontend oluşturulmaz.

### Backend

- Fastify başlangıcı: `/backend/src/app.js`
- Runtime konfigürasyonu: `/backend/src/config.js`
- Ana API rotaları: `/backend/src/routes/index.js`
- Supabase auth/RLS bağlamı: `/backend/src/lib/supabase.js`
- Mevcut banka ödeme adapterı: `/backend/src/lib/bank-payment-provider.js`
- Partner entegrasyon sistemi: `/backend/src/lib/` ve `/backend/src/routes/index.js`
- e-Dönüşüm katmanı: `/backend/src/modules/e-invoicing/` ve `/backend/src/routes/e-invoicing.js`

Country Engine ayrı modül ve rota olarak eklenmiştir:

- `/backend/src/modules/platform/country-engine.js`
- `/backend/src/modules/platform/repository.js`
- `/backend/src/modules/platform/provider-contracts.js`
- `/backend/src/routes/platform.js`

### Authentication ve global kullanıcı

Mevcut `auth.users` ve `public.profiles` çifti global kimliğin kanonik kaynağıdır. İkinci bir kullanıcı hesabı tablosu oluşturulmamıştır.

`profiles.country`, geçmiş frontend akışlarıyla uyumluluk için korunur. Yeni ülke özellikleri `user_country_profiles` tablosunda tutulur. Böylece bir kullanıcı aynı global kimlikle birden çok ülke profiline sahip olabilir.

### Mevcut temel tablolar

- `profiles`: global kullanıcı ve rol
- `addresses`: kullanıcı adresleri
- `platform_modules`: global modül kataloğu
- `partner_businesses`: mevcut partner işletme kaydı
- `products`: ürün kataloğu
- `orders`, `order_items`: sipariş ve fiyat kayıtları
- `hp_ledger`, `user_rewards`: HP/ödül ekonomisi
- `partner_payment_intents`, `partner_transactions`, `partner_payouts`: partner finans akışı
- `partner_integration_*`: marketplace/feed bağlantıları
- `organizations`, `legal_entities`, `seller_profiles`, `invoice_*`: e-Dönüşüm domain’i

Bu tablolar kaldırılmamış, yeniden adlandırılmamış ve destructive backfill yapılmamıştır.

## 3. Hedef mimari

```text
Global identity (auth.users + profiles)
                  |
                  v
Country Engine -> Country Modules -> Provider Routes
      |                  |                 |
      v                  v                 v
User Country       Partner Passport   Payment / Tax / Fiscal
Profiles           Country Approval   Logistics / Translation
      |                  |                 |
      +------------------+-----------------+
                         |
                         v
          Domestic + Cross-Border Commerce
                         |
              Orders / B2B / Shipments
                         |
                         v
          Verified aggregate impact metrics
```

Country Engine kararları tek servis sınırında çözülür. Uygulama koduna yüzlerce `if country === "TR"` kontrolü eklenmez.

## 4. Country Engine

### `countries`

Merkezi ülke kaydı şu alanları içerir:

- ISO ülke kodu, görünen ve yerel ad
- varsayılan para birimi, sembol, dil, saat dilimi, telefon prefix’i
- tax, invoice, payment, shipping, marketplace, legal ve data-protection configuration
- `data_region`
- `status`: `active`, `coming_soon`, `disabled`
- `launch_stage`: `DISABLED`, `PLANNING`, `INTEGRATION`, `INTERNAL_TEST`, `BETA`, `PUBLIC`
- `configuration.enforcement_mode`

Türkiye `PUBLIC / active` başlangıç kaydıdır; ancak `enforcement_mode=shadow` olduğu için mevcut production davranışını ele almaz. AZ, KZ, UZ ve KG planlama kaydıdır.

### `country_modules`

Her ülke/modül satırı aşağıdaki bağımsız kontrolleri taşır:

- `enabled`
- `beta`
- `public_visible`
- `partner_registration_enabled`
- `transaction_enabled`
- `configuration`
- `approval_reference`

Global `platform_modules` katalogdur; `country_modules` aynı modülün ülke aktivasyonudur. Kod kopyası oluşturulmaz.

### Aktivasyon kuralları

- Kapalı modül public, partner kaydı veya transaction durumuna getirilemez.
- Ülke `BETA` veya `PUBLIC` değilse modül public yapılamaz.
- Transaction açmak için production-ready ödeme provider rotası gerekir.
- Ülke veya modül görünürlüğünü artıran değişiklikte onay referansı gerekir.
- Lansman aşamaları tek tek ilerler; `PLANNING` durumundan doğrudan `PUBLIC` durumuna geçilemez.
- Admin write endpoint’i MFA + `super_admin` + production write flag ister.
- `expected_updated_at` ile optimistic concurrency uygulanır.
- Ülke/modül güncellemesi ile `country_configuration_events` kanıt satırı aynı database transaction/RPC içinde yazılır; optimistic timestamp uyuşmazsa ikisi de oluşmaz.
- Merkezi security audit log’a aynı isteğin ikinci, append-only kopyası gönderilir; aktivasyonun zorunlu atomik kanıtı `country_configuration_events` satırıdır.

## 5. One Allona Account

### Global kalan veriler

- Supabase Auth user ID
- global profil ve rol
- global hesap yaşam döngüsü
- platform genelindeki güvenlik/MFA bağlamı

### Ülkeye göre ayrılan veriler

`user_country_profiles` şunları tutar:

- yerel telefon
- billing ve tax profile
- payment preferences (ham kart verisi yasaktır)
- delivery preferences
- KYC durumu
- partner durumu
- yerel izinler
- data region

Kullanıcı kendi iletişim/fatura/teslimat tercihlerini yönetebilir; ancak `kyc_status`, `partner_status`, ülke kimliği ve `data_region` alanlarını kendi kendine onaylayamaz. Bu alanlar database trigger’ıyla admin/service iş akışına ayrılmıştır.

Mevcut `addresses` tablosuna nullable `country_code` eklenir. Eski free-text ülke kayıtları otomatik tahmin edilmez ve backfill edilmez.

## 6. Sözleşme ve privacy versiyonları

- `legal_document_versions`: ülke, belge türü, dil, versiyon, içerik URL’si, hash, yürürlük tarihi
- `user_legal_acceptances`: kullanıcının kabul ettiği tam belge versiyonu, zaman ve hashlenmiş kanıt referansları

Kabul satırları browser’dan update/delete edilemez. Yeni bir metin yeni versiyon ve yeni kabul kaydı gerektirir.
Browser kabulü yalnız aktif belgenin gerçek `version` değeriyle kaydedilebilir; aktif belge içeriği ve hash’i yerinde değiştirilemez.

## 7. Allona Partner Passport

Mevcut `partner_businesses` işletme kaydı korunur. Üzerine bire bir `partner_passports` eklenir.

- global `allona_partner_id`
- home country
- sektör
- doğrulama seviyesi
- ihracat yapabilirlik durumu
- hizmet verilen ülkeler
- desteklenen diller
- B2B/B2C modları
- lojistik kapasite configuration
- güven/işlem snapshot alanları

`partner_country_approvals`, aynı partnerin her hedef ülkedeki durumunu ayrı tutar. Örnek: TR approved, AZ pending, KZ unavailable.

`partner_verification_reviews`, Unverified → Verified Business → Verified Exporter → Trusted Partner → Elite Partner akışının admin kanıt ve karar kaydıdır. Rozet otomatik verilmez.

## 8. Cross-Border Commerce Engine

### Ürün

- `product_trade_profiles.origin_country_id`: ürün menşei
- `product_country_availability`: ürünün satışa/görünürlüğe açık olduğu ülkeler
- `country_restricted_product_rules`: ülke ve yön bazlı restriction/veri kaynağı

Menşe ülke ile satışa açık ülkeler birbirine karıştırılmaz.

### Sipariş ve kur snapshot’ı

Legacy `orders` tablosuna nullable alanlar eklenir:

- `transaction_currency`
- `settlement_currency`
- `exchange_rate`
- `exchange_rate_source`
- `exchange_rate_timestamp`
- `original_amount`
- `converted_amount`

`exchange_rate_snapshots` provider/source gözlemini immutable saklar. `order_currency_snapshots`, sipariş anındaki tam finans snapshot’ıdır. Geçmiş sipariş daha sonraki kurla yeniden hesaplanmaz.

Legacy `orders` üzerindeki yedi kur alanı ya birlikte boş ya birlikte dolu olabilir; ilk atomik snapshot sonrasında database trigger bu alanların değiştirilmesini engeller.

### Cross-border context

`cross_border_order_contexts`, yerel order kaydına şunları ekler:

- origin/destination country
- corridor
- B2B/B2C/service türü
- customs, tax ve compliance durumları
- iade ve teslimat tahmini snapshot’ları

`trade_corridors`, TR-AZ, AZ-TR, TR-KZ, KZ-TR, TR-UZ, UZ-TR, TR-KG ve KG-TR başlangıç yol haritasını `planning` durumunda tutar. Commerce, B2B, logistics ve rewards flag’leri kapalıdır.

## 9. Multi-language ve AI translation

Mevcut merkezi i18n katmanı korunur. Aşağıdaki dil seçenekleri eklenmiştir:

- `tr` Türkçe
- `az` Azərbaycan dili
- `kk` Қазақша
- `uz` Oʻzbekcha
- `ky` Кыргызча
- `en` English
- mevcut `ru`, `de`, `ar` paketleri korunur

`localized_content`, original content’i hash ve metin olarak korur; çeviri ayrı alandadır. `translation_jobs` asenkron provider kuyruğudur.

Backend `TranslationProvider` sözleşmesi vardır, fakat gerçek AI provider bağlı değildir. Bir AI çevirisi varsayılan olarak yayınlanmış kabul edilmez; machine draft/human review/approved yaşam döngüsü vardır.

### SEO URL planı

Mevcut URL’ler bu fazda değiştirilmez. Gelecekte `/tr/`, `/az/`, `/en/` yapısına geçişten önce:

1. tüm mevcut indexlenebilir URL’ler export edilir,
2. locale canonical/hreflang matrisi hazırlanır,
3. bire bir 301 redirect haritası test edilir,
4. sitemap’ler locale bazlı üretilir,
5. Search Console ve log bazlı 404 kontrolü tamamlanır.

Redirect planı olmadan toplu URL migration yapılmaz.

## 10. B2B Trade Network

`trade_requests` alıcı partner, kaynak ülke, kategori, talep türü, açıklama, adet, bütçe, para birimi, tarih, doğrulama zorunluluğu ve durum bilgilerini tutar.

Hedef ülkeler array yerine `trade_request_target_countries` junction tablosundadır. Bu, filtreleme ve ülke bazlı policy için daha güvenlidir.

`trade_offers`, talebe verilen partner teklifidir. Teklif sahibi ticari alanları yazar; alıcı yalnız karar alanlarını değiştirebilir. Partner kendi teklifini accepted/rejected yapamaz. Trade request publication ve compliance kararı admin kontrollüdür.

## 11. Logistics, tax, fiscal document ve payment orchestration

Provider sözleşmeleri:

- `PaymentProvider`
- `LogisticsProvider`
- `FiscalDocumentProvider`
- `TaxProvider`
- `TranslationProvider`
- `CustomsProvider`
- `CurrencyProvider`
- `MarketplaceProvider`

`integration_provider_definitions` adapter metadata’sını, `country_provider_assignments` ülke/modül routing kararını tutar. Raw credential yasaktır; yalnız vault `credential_reference` saklanabilir.

Mevcut banka ödeme ve e-Dönüşüm sistemleri silinmez. Bu provider contract’larına kontrollü adapter yazılana kadar Country Engine onları çağırmaz.

`shipments` provider-independent modeldir: origin, destination, carrier, service, tracking, customs status, ETA ve actual delivery. Gerçek carrier API olmadan quote/tracking üretilmez.

Tax rule set’leri ülke, işlem kapsamı, partner türü ve kategori bazında versiyonlanır. Türkiye için yalnız `draft / inherit_existing_logic / enforced=false` kaydı vardır; mevcut KDV davranışı değişmez.

## 12. Compliance ve data residency

`compliance_rule_sets` şu alanları versiyonlar:

- privacy ve data protection
- consumer rights ve distance sales
- KYC / AML / sanctions
- restricted products ve age restrictions
- seller verification
- cross-border restrictions

`compliance_assessments`, ürün/order/partner/trade request/offer/shipment için karar ve kanıt referansını saklar. Ülke seçimi tek başına “hukuka uygun” sonucu üretmez.

`data_region` hem ülke configuration’ında hem user-country profile’da bulunur. Bu bir hukuki sonuç değildir; gelecekte veri aktarım ve residency kararlarının uygulanacağı bağlamdır.

## 13. HP ve Turkic World Rewards

HP mevcut loyalty/reward points niteliğinde kalır.

- `country_reward_policies` earning, spending, campaign ve expiry kurallarını ülkeye göre taşır.
- transfer, cross-border redemption ve cashout varsayılan olarak kapalıdır.
- cashout ancak `regulatory_approval_reference` varsa configuration’da açılabilir; buna rağmen ayrıca kod/deploy onayı gerekir.
- `hp_ledger_country_contexts`, mevcut HP ledger satırına kazanım ve kullanım ülke snapshot’ı ekler.

Mevcut profillerdeki legacy `cashout_balance` alanı, nakde dönüşümün hukuken veya operasyonel olarak aktif olduğu anlamına gelmez.

## 14. Admin yüzeyleri

### Country Control Center

`/admin/country-control.html`:

- ülke status ve launch stage
- ülke/modül activation matrisi
- koridor görünümü
- gerçek tablo count’ları
- impact evidence listesi
- read-only / write-enabled durumu

Yazma yalnız backend üzerinden ve production write flag açıkken yapılır.

### Turkic World Command Center

İlk sürüm gerçek count ve doğrulanmış impact evidence gösterir. Cross-border GMV, top corridors, top categories, exporting/importing partners ve jobs gibi metrikler veri pipeline’ı ve doğrulama yöntemi oluşturulana kadar `—` kalır.

## 15. Public Turkic World Hub ve impact

- Public hub: `/pages/ecosystem/turkic-world.html`
- Public impact API: `GET /v1/platform/impact`
- Public country API: `GET /v1/platform/countries`

Impact kaydı yalnız şu koşullarda public olur:

- `verification_status = published`
- `verified_at` ve `published_at` dolu
- `contains_personal_data = false`
- data source ve aggregation method dolu

Public sayfa veri yoksa `0` veya örnek sayı göstermez; `—` gösterir.
Yayımlanmış impact evidence yerinde değiştirilemez; düzeltme ayrı bir snapshot olarak üretilir.

## 16. Open Integration Platform

`integration_api_clients`, üçüncü taraf API client metadata’sını ve scope’ları tutar. `integration_webhook_endpoints` endpoint ve event tiplerini, `integration_webhook_deliveries` teslimat kuyruğunu tutar.

Raw client secret veya webhook signing secret veritabanı satırında tutulmaz; yalnız secret vault referansı kullanılabilir.

Planlanan API kategorileri:

- Products
- Orders
- Inventory
- Partners
- Payments
- Invoices
- Shipping
- B2B
- Career
- Maritime
- Analytics
- Webhooks

## 17. Government / institutional mode

Kamu veya kurumsal raporlama için yalnız aggregate, verified ve kişisel veri içermeyen impact kayıtları kullanılabilir. Kurum bazlı API client gelecekte aynı Open Integration Platform üzerinde ayrı scope ve rate limit ile tanımlanabilir.

Herhangi bir kurum adı veya logosu ancak doğrulanmış yazılı yetki ve marka kullanım izni sonrası eklenebilir.

## 18. API sözleşmeleri

Public:

- `GET /v1/platform/countries`
- `GET /v1/platform/countries/:countryCode`
- `GET /v1/platform/countries/:countryCode/modules/:moduleKey`
- `GET /v1/platform/impact`

Admin:

- `GET /v1/admin/country-control`
- `PATCH /v1/admin/country-control/countries/:countryCode`
- `PATCH /v1/admin/country-control/countries/:countryCode/modules/:moduleKey`

Admin PATCH isteklerinde MFA, super-admin, reason, approval reference (aktivasyonda), optimistic timestamp ve audit gerekir.

## 19. Production rollout planı

### Faz 0 — Repository ve staging

1. Mevcut production migration geçmişi salt-okunur export edilir.
2. İki migration staging’de sırayla uygulanır.
3. İkinci kez uygulanarak idempotency kontrol edilir.
4. RLS, cross-tenant ve partner-offer state testleri çalıştırılır.
5. Backend flag’leri kapalıyken mevcut Türkiye smoke testleri yapılır.

### Faz 1 — Production shadow

1. Migration onaylı release penceresinde uygulanır.
2. `COUNTRY_ENGINE_ENABLED=true` yalnız read API’yi açar.
3. `COUNTRY_ENGINE_ADMIN_WRITES_ENABLED=false` kalır.
4. Mevcut checkout/payment/tax/invoice kodu Country Engine’e bağlanmaz.
5. 7–14 gün hata, latency ve şema uyumu izlenir.

### Faz 2 — Türkiye parity

1. Türkiye’nin mevcut davranışı configuration snapshot’larıyla karşılaştırılır.
2. Payment, tax ve fiscal adapter’ları gerçek provider sözleşmelerine bağlanır.
3. Staging parity ve finans mutabakatı tamamlanır.
4. Enforcement ayrı release ve rollback switch’iyle açılır.

### Faz 3 — Azerbaycan hazırlığı

1. Hukuki, privacy, consumer, tax, invoice ve payment gereksinimleri yetkili kaynaklarla tamamlanır.
2. Sandbox provider testleri yapılır.
3. Partner approval ve ürün restriction testleri yapılır.
4. INTERNAL_TEST → BETA → PUBLIC aşamaları sırayla ilerler.

### Faz 4 — KZ / UZ / KG

Aynı launch checklist ülke bazında tekrarlanır; TR veya AZ konfigürasyonu kopyalanıp hukuki kural sayılmaz.

## 20. Rollback

En hızlı ve güvenli rollback:

1. `COUNTRY_ENGINE_ADMIN_WRITES_ENABLED=false`
2. `COUNTRY_ENGINE_PUBLIC_IMPACT_ENABLED=false`
3. `COUNTRY_ENGINE_ENABLED=false`
4. backend/static release normal revert commit’iyle geri alınır

Migration additive olduğu için tablo drop etmek normal rollback değildir. Tablolar kullanılmadan yerinde kalabilir. Destructive database rollback ancak:

- veri export’u alındıktan,
- bağımlılık sorgusu yapıldıktan,
- ayrı owner onayı verildikten,
- staging’de drop sırası doğrulandıktan

sonra ayrı migration olarak hazırlanır. Production’da doğrudan `DROP ... CASCADE` kullanılmaz.

## 21. Bilinen sonraki işler

- Production migration geçmişi bu repository çalışmasında canlı Supabase’den doğrulanmadı.
- Country Engine henüz mevcut checkout’a enforcement yapmıyor.
- Provider registry’de production-ready ülke ataması yok.
- AI translation provider bağlı değil.
- Cross-border tax/customs/duties hesaplaması yok.
- Public impact için doğrulanmış metrik pipeline’ı yok.
- `/tr/`, `/az/`, `/en/` SEO URL migration’ı yapılmadı.
- Partner Passport backfill’i yapılmadı; mevcut partner ülke verisi tahmin edilmedi.
- Legacy order currency alanları backfill edilmedi.
- Government/institutional API scope’ları tanımlı modeldir; resmi bağlantı değildir.

Bu maddeler tamamlanmadan “uluslararası production hazır” sonucu verilemez.
