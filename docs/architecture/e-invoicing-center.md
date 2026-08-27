# AllonaHub Merkezi e-Dönüşüm ve Fatura Yönetim Merkezi

## Amaç ve güvenlik sınırı

Bu modül; AllonaHub, Allona Shop, marketplace partnerleri, bağımsız işletmeler ve çoklu şirket/mağaza yapılarını aynı fatura çekirdeğinde yönetmek için tasarlanmıştır. Satış kanalı ile e-Dönüşüm sağlayıcısı birbirinden bağımsızdır.

İlk sürümde yalnız `MockInvoiceProvider` belge üretir. Gerçek bir özel entegratör için resmi API sözleşmesi, test ortamı, credential referansı ve açık production onayı olmadan dış sisteme belge gönderilmez.

Canlı Supabase migration geçmişi bu repository incelemesi sırasında sorgulanmadığından production uygulamasından önce salt-okunur şema karşılaştırması zorunludur.

## Mevcut sistem analizi ve yeniden kullanım

| Mevcut alan | Karar |
| --- | --- |
| `profiles` ve Supabase Auth | Kimlik kaynağı olarak korunur. Global rol, tenant yetkisinin yerine kullanılmaz. |
| `partner_businesses` / `partner_staff` | Partner işletmesi ve mevcut üyelik kaynağı olarak korunur; legal entity veya seller ile eş anlamlı sayılmaz. |
| `products.partner_id` / `order_items.partner_id` | Legacy eşleme sinyali olarak tutulur. Legal seller kimliği olmadığı için otomatik ve kesin kaynak sayılmaz. |
| `orders` / `order_items` | Ana sipariş katmanı korunur ve yalnız nullable, geriye uyumlu alanlarla genişletilir. Satıcı bazlı ayrım ayrı sub-order katmanındadır. |
| `partner_integrations` | Ürün import/export connector alanı olarak korunur. Satış kanalı mağaza hesabı veya fatura sağlayıcı hesabı yerine kullanılmaz. |
| `partner_transactions` / `partner_payouts` | Mutabakat girdisi olarak kullanılabilir. Komisyon faturası veya iade belgesi yerine geçmez. |
| `security_audit_events` | Platform genelindeki append-oriented audit kaydı olarak kullanılmaya devam eder. Fatura yaşam döngüsündeki ayrıntılı zincir ayrıca `invoice_events` içindedir. |
| Supabase Storage | Yeni PDF/XML alanı ayrı ve private bucket içindedir. Public URL üretilmez. |
| Mevcut Edge Functions | `create-bank-checkout`, `bank-payment-callback` ve `create-cv-checkout` ödeme/CV akışları olarak korunur. Fatura provider çağrısı bu fonksiyonlara eklenmez; ayrı backend job worker kullanılır. |

### Tespit edilen uyumluluk riskleri

- `order_items` için eski partner RLS kuralı, bir partnerin aynı siparişteki diğer satıcı kalemlerini de okuyabilmesine neden olabilir. Yeni migration bu kuralı yalnız ilgili satıra daraltır.
- Sipariş oluşturmanın iki yolu vardır. `create_transaction_order` partner bilgisini taşırken eski `create_secure_order` yolu aynı garantiyi vermez. Eksik legacy satırlar otomatik eşlenmez.
- Mevcut partner API'si kullanıcının ilk işletmesini seçer; açık organization/legal entity/store context'i yoktur.
- Mevcut connector capability bilgisi veritabanı, backend ve frontend arasında farklılaşmıştır. Yeni satış kanalı capability kaynağı provider registry'dir.
- Mevcut connector secret kasası normal tabloda ciphertext tutar. Yeni e-Dönüşüm hesaplarında yalnız `credential_reference` tutulur.
- Checkout fatura bilgilerini serbest adres metnine gömer. Fatura motoru bu metni resmi müşteri fatura profili saymaz.

## Domain hiyerarşisi

```text
Organization
  ├─ Organization Members
  └─ Legal Entity / Company
       ├─ Legal Entity Members
       ├─ Invoice Profile
       ├─ Invoice Provider Account
       └─ Seller
            └─ Sales Channel Account / Store
                 ├─ Store Members
                 ├─ Orders
                 └─ Seller Sub-orders
                      └─ Invoices
```

Bir kullanıcı organization, legal entity veya mağaza hesabı düzeyinde yetkilendirilebilir. Erişim frontend filtresine bırakılmaz; RLS ve backend tenant context birlikte doğrular.

## Uçtan uca akış

```text
SalesChannelProvider
  -> Unified Order
  -> Seller Sub-order
  -> Seller Resolver
  -> Invoice Profile + Provider Account
  -> Trigger Rule
  -> CREATE_DOCUMENT job
  -> InvoiceProvider
  -> PDF/XML/ETTN/status
  -> UPLOAD_TO_CHANNEL job
  -> SalesChannelProvider
```

`CREATE_DOCUMENT` ve `UPLOAD_TO_CHANNEL` ayrı işlerdir. Kanal yüklemesi başarısız olduğunda fatura yeniden oluşturulmaz.

Unified order yazımı `resolve_unified_seller_sub_order` RPC'si üzerinden tek transaction'da yapılır. RPC; organization, legal entity, seller ve bağlı mağaza hesabını doğrular; sipariş başlığını, sub-order'ı ve ilgili order item vergi dağılımlarını birlikte kilitleyip günceller; kalem ve başlık toplamları birebir uyuşmazsa hiçbir değişikliği commit etmez. Legacy siparişler açık seller/vergi dağılımı verilmeden otomatik backfill edilmez.

Ana sipariş, satıcı tenant'larından bağımsız bir ticari zarf olabilir. Her kalem doğrulanmış bir `seller_sub_order` altında çözümlenmeden sipariş faturalamaya hazır sayılmaz. Kaynak servis beklenen sub-order sayısını vererek `complete_order_invoice_allocation` RPC'sini çağırır; RPC siparişi kilitler, bütün kalemleri ve bütün sub-order toplamlarını yeniden hesaplar ve ancak eksiksizse `invoice_allocation_status=COMPLETE` yapar. Tamamlanmış tahsisatın satıcı, mağaza, adet, fiyat veya vergi alanları sonradan sessizce değiştirilemez.

Sipariş yaşam döngüsü olayları servis-auth korumalı `POST /v1/internal/e-invoicing/order-events` girişinde `invoice_order_events` durable inbox tablosuna, kaynak sistemden gelen stabil `eventId` ile yazılır. Worker satırı lease/heartbeat ile claim eder; tahsisat tamamlanmamışsa retry veya `NEEDS_REVIEW` üretir, tamamlanmışsa yalnız eşleşen `trigger_event` ayarları için satıcı sub-order başına plan oluşturur. Aynı event ve aynı fatura database unique constraint'leri nedeniyle tekrar üretilemez. Checkout/payment/shipping servisleri olayı yalnız kendi transaction commit'inden sonra yayınlamalıdır.

## Seller Resolver güvenlik kuralı

Resolver aşağıdaki zinciri eksiksiz doğrular:

```text
Order
  -> Sales Channel Account
  -> Seller Sub-order
  -> Seller
  -> Legal Entity
  -> Active Invoice Profile
  -> Active Invoice Provider Account
```

Eksik, çelişkili veya birden fazla eşleşme varsa sonuç `NEEDS_REVIEW` olur. `products.partner_id`, mağaza adı, e-posta, VKN veya metin benzerliği üzerinden tahmin yapılmaz.

## Belge tipi karar motoru

1. Önceden doğrulanmış müşteri mükellef durumu varsa bu güvenli snapshot kullanılır. Durum ancak `provider_query` veya `manual_admin` kaynağı ve doğrulama zamanı birlikte mevcutsa güvenilir sayılır.
2. Durum bilinmiyorsa legal entity/store ayarındaki yapılandırılmış fallback okunur.
3. Fallback `manual_review` ise dış çağrı yapmadan `NEEDS_REVIEW` olur.

Provider `checkTaxpayerStatus` özelliği desteklenebilir; ancak harici mükellef sorgusu kullanıcı HTTP plan isteğinin içinde çalıştırılmaz. Gerçek provider eklendiğinde sorgu, credential kullanan ayrı ve idempotent bir refresh/job akışına bağlanmalıdır.

Vergi veya hukuki eşikler uygulama koduna kontrolsüz sabit olarak yazılmaz. İlk güvenli varsayılan `MANUAL` tetikleme ve `manual_review` belge tipi fallback'idir.

Müşteri API'si `taxpayer_status` kabul etmez ve authenticated kullanıcı bu kolonu doğrudan değiştiremez. Bireysel profilde ad, soyad, e-posta ve eksiksiz adres; kurumsal profilde unvan, vergi numarası, vergi dairesi, e-posta ve eksiksiz adres server-side doğrulanır. Yeni profil ile sipariş bağlantısı tek RPC transaction'ında yapılır; arada fatura planlanırsa profil kaydı da rollback olur. Legacy eksik profiller planlama aşamasında fail-closed kalır.

Aktif legal entity için vergi kimliği ve eksiksiz fatura adresi database trigger, activation endpoint'i ve Seller Resolver tarafından birlikte doğrulanır. Taslak şirket eksik tutulabilir; eksik kayıt faturalamaya etkinleştirilemez.

## Para ve vergi doğruluğu

- Veritabanında tutarlar `numeric` kolonlarda tutulur.
- Backend sınırlarında tutarlar decimal string olarak taşınır.
- Toplama, çıkarma, çarpma ve yuvarlama integer minor-unit / `BigInt` yardımcılarıyla yapılır.
- Fatura ekranı belgenin kendi para birimini gösterir; kullanıcı tercihindeki döviz kuruna çevrilmez.
- Satır toplamları ve belge toplamları provider çağrısından önce yeniden doğrulanır.

## Idempotency

Belge anahtarı aşağıdaki sabit kapsamı içerir:

```text
invoice:create:{organization_id}:{seller_id}:{order_id}:{sub_order_id}:{document_type}
```

`invoices.idempotency_key` veritabanında benzersizdir. Job'ların da ayrı benzersiz idempotency anahtarı vardır. Uygulama kontrolü tek başına yeterli kabul edilmez.

Kanal teslimi de bağımsız ve kalıcıdır. Her invoice/channel account/delivery type için tek `invoice_channel_deliveries.idempotency_key` kullanılır. Otomatik ve manuel gönderim aynı `UPLOAD_TO_CHANNEL` job kapsamına birleşir; başarısız veya belirsiz kanal aktarımı yeni fatura ya da paralel ikinci teslim oluşturmaz.

## Job/outbox modeli

Uygulanan job türleri:

- `CREATE_DOCUMENT`
- `REFRESH_STATUS`
- `UPLOAD_TO_CHANNEL`
- `CANCEL_DOCUMENT`
- `CREATE_RETURN_DOCUMENT`

`FETCH_ARTIFACTS` şema enumunda gelecek providerlar için rezerve edilmiştir; worker implementasyonu olmadığı için bugün enqueue/retry edilmez. Bu sürümde kabul edilen provider sözleşmesi `idempotentCreate=true` ve `synchronousArtifacts=true` yeteneklerini zorunlu tutar; belge oluşturma yanıtında doğrulanmış `ISSUED` durumu, provider belge kimliği, ETTN, fatura numarası, PDF ve XML birlikte gelmelidir. Asenkron çalışan bir provider bu akışa doğrudan bağlanamaz.

Worker satırları atomik bir SQL fonksiyonuyla `FOR UPDATE SKIP LOCKED` kullanarak tek tek claim eder ve uzun provider çağrılarında lease heartbeat yeniler. Lease, attempt, max attempt ve `next_attempt_at` alanları aynı kayıtta tutulur. Varsayılan gecikme planı yapılandırılabilir; örnek plan 1, 5, 15 ve 60 dakikadır. Son deneme sonrası kayıt `NEEDS_REVIEW` olur. Manuel retry; invoice/workflow/job durumlarını tek database transaction'ında değiştirir.

Kanal teslimi kendi lock token/job ID/expiry alanlarını taşır ve job heartbeat aynı transaction'da delivery expiry'sini de yeniler. Expired worker renew, complete veya fail edemez. Aktif bir invoice için database partial unique constraint aynı anda yalnız tek `UPLOAD_TO_CHANNEL` job'ına izin verir. Adaptera kalıcı delivery idempotency anahtarı iletilir.

Provider iptal sonucu, webhook veya status refresh üzerinden gelse de `invoice_cancellations` ve `invoices` tek database RPC'sinde tamamlanır. Lease kaybı nedeniyle `NEEDS_REVIEW` olmuş fakat sağlayıcıda gerçekten iptal edilmiş belge, doğrulanmış sonuçla önce `CANCEL_PENDING`, sonra `CANCELLED` durumuna kontrollü olarak alınır.

Aynı müşteri satış faturasında iade ve iptal domainleri `invoice_document_operation_guards` ile database seviyesinde karşılıklı dışlanır. Worker, provider ağ sınırını geçmeden hemen önce job lease'i, guard, workflow ve orijinal fatura durumunu tek RPC'de yeniden doğrular ve `provider_call_started_at` işaretini kalıcılaştırır. Bu işaret oluştuktan sonra belirsiz provider sonucu taşıyan bir iade rezervasyonu otomatik serbest bırakılamaz.

Provider çağrısı hiç başlamamış iade talebi, yetkili kullanıcı tarafından MFA, açık gerekçe ve audit kaydıyla reddedilebilir. RPC; workflow, return invoice, job ve orijinal kalemleri kilitler, job'ı claim edilemez hale getirir, return invoice'ı terminal hata durumuna alır ve en son miktar rezervasyonunu `REJECTED` ile serbest bırakır. Aktif/başarılı job, provider işareti, ETTN, belge numarası veya artifact varsa işlem fail-closed olur.

## Durum makineleri

Fatura durumları:

```text
DRAFT -> QUEUED -> PROCESSING -> ISSUED -> SENT -> ACCEPTED
                   |             |         |
                   v             v         v
                 FAILED       REJECTED  CANCEL_PENDING -> CANCELLED
                   |                       |
                   v                       v
              NEEDS_REVIEW              RETURNED
```

Geçersiz geçişler database trigger ve backend domain kontrolüyle reddedilir. Sipariş iptali, fatura iptali ve iade belgesi birbirinden ayrı state machine'lerdir.

## Webhook güvenliği

- Raw request body üzerinde HMAC/signature doğrulaması
- Sabit zamanlı karşılaştırma
- Timestamp tolerance
- Nonce/provider event ID replay koruması
- Database unique duplicate koruması
- Credential değerini loglamayan sanitizer
- Hassas müşteri alanlarını filtreleyen event payload özeti

Provider signature doğrulaması desteklemiyorsa webhook bağlantısı production-ready kabul edilmez.

## Provider sözleşmeleri

### Sales channel

`connectStore`, `testConnection`, `disconnectStore`, `fetchOrders`, `fetchOrder`, `fetchReturns`, `fetchCancellations`, `pushInvoice`, `pushInvoiceMetadata`, `syncProducts`, `syncInventory`, `syncPrices`, `getCapabilities`.

Trendyol, Hepsiburada, N11, Pazarama, Çiçeksepeti, PTTAVM, Shopier, Amazon ve Custom API ilk aşamada bütün capability'leri kapalı skeleton'dır. Mevcut ürün connectorları bu yeni sözleşmeye güvenli bir bridge yazılmadan capability olarak ilan edilmez. AllonaHub Marketplace ve Allona Shop yalnız yerel, kalıcı `invoiceMetadata` teslimini destekler. Resmi dokümantasyonu görülmeyen endpoint uydurulmaz.

### Invoice provider

`testConnection`, `checkTaxpayerStatus`, `createEInvoice`, `createEArchiveInvoice`, `getDocumentStatus`, `getPdf`, `getXml`, `cancelDocument`, `createReturnDocument`, `validateWebhook`, `processWebhook`, `getCapabilities`.

`MockInvoiceProvider` deterministik ve idempotent test çıktıları üretir. `ProviderA`, `ProviderB` ve `ProviderC` yalnız unsupported skeleton'dır. Gerçek adapter create/cancel/channel operasyonlarında kendisine verilen job idempotency anahtarını upstream servise taşımalı ve kalıcı kabul sonucunu doğrulamalıdır.

Provider ve harici kanal hesabında yalnız `vault:*`, `env:INVOICE_*` veya `secret:INVOICE_*` referansı tutulur. Referansın tek başına bilinmesi yetmez: service-only `integration_credential_bindings` kaydı referansı organization, legal entity, integration type, provider/channel key ve kullanım amacıyla bağlar. Browser bu tabloyu okuyamaz veya yazamaz. Vault referansının production'da çalışması için backend'e gerçek secret-manager resolver enjekte edilmelidir; binding veya resolver yoksa bağlantı güvenli biçimde durur.

## Arayüz sınırları

- Admin: `Finans -> e-Dönüşüm` tek ana giriş ve içeride dashboard, fatura/kuyruk/hata/iade/iptal/komisyon/mutabakat/audit bölümleri ile organization, şirket, seller, kanal, profil, provider ve tetikleme ayarı yönetimi.
- Partner/işletme kullanıcısı: global profil rolünden bağımsız olarak organization/legal entity/seller/store üyeliğiyle context seçer; yalnız yetkili tenant verisi gelir. Yazma işlemleri AAL2/MFA ve server-side owner/manager/accounting kontrolü ister.
- Müşteri: `Siparişlerim -> Sipariş -> Faturalar`; bir sipariş için birden çok satıcı faturası gösterilebilir.
- PDF/XML: public Storage URL'si gösterilmez. Authorization kontrollü backend kısa ömürlü signed URL üretir.
- Sipariş iadesi ile fatura iade belgesi, sipariş iptali ile fatura iptali ayrı etiketlenir.
- İade POST yanıtı kaybolursa UI, kullanıcı+invoice bağlamında saklanan canonical payload ve idempotency anahtarıyla lookup/replay yapar; kesin 4xx doğrulama hatasında bekleyen taslağı temizler.
- Admin manuel ve toplu fatura planlamasında organization/legal entity/seller bağlamını her order/sub-order çiftiyle server-side tam eşleştirir; 50 satıra kadar batch sonucu kalem bazında ve tek audit özetiyle döner.
- Varsayılan fatura profili aktivasyonu legal entity parent lock'ıyla atomiktir; yeni varsayılan etkinleştirilmeden önce eski aktif varsayılan aynı transaction'da kaldırılır.
- “Yerel olarak kapat” yalnız AllonaHub worker kullanımını durdurur. Gerçek upstream OAuth/session iptali adapter destekli ayrı, idempotent disconnect işi uygulanmadan UI tarafından vaat edilmez.

## Production'a geçiş kapıları

1. Canlı Supabase şeması salt-okunur olarak migration zinciriyle karşılaştırılır.
2. Yeni migration staging'de uygulanır ve cross-tenant RLS testleri çalıştırılır.
3. Private bucket ve signed URL yetkilendirmesi doğrulanır.
4. Mock provider ile çok-satıcı, duplicate, retry, webhook replay ve upload-failure senaryoları geçer.
5. Gerçek provider için resmi dokümantasyon, sandbox hesabı ve secret manager referansı sağlanır.
6. Vergi/fatura tetikleme kuralları yetkili kullanıcı tarafından yapılandırılır.
7. Sipariş, ödeme ve kargo servisleri bütün seller sub-order'ları çözdükten sonra allocation completion RPC'sini çağırır; commit sonrasında stabil event ID ile durable order event üretir.
8. Credential referansları service-only tenant binding kaydıyla eşleştirilir; browser veya normal authenticated rol bu kaydı yönetemez.
9. Provider ve kanal dış çağrıları iki ayrı feature flag ile, ayrı operasyon onaylarından sonra açılır.

Bu kapılar tamamlanmadan sistem production faturası göndermez.
