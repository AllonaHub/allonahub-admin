# e-Dönüşüm Production Hazırlık Kontrolü

## 1. Salt-okunur keşif

- Canlı migration geçmişini ve tablo/kolon/policy listesini export et.
- `orders`, `order_items`, `partner_businesses`, `partner_staff`, `partner_integrations`, `partner_transactions`, `partner_payouts` şemalarını repository ile karşılaştır.
- `order_items` partner RLS kuralının başka satıcı kalemlerini açmadığını doğrula.
- Mevcut bucket ve object policy listesini kontrol et.

## 2. Staging migration

- Migration'ı boş staging veritabanında uygula.
- Aynı migration'ı ikinci kez çalıştırarak idempotency kontrolü yap.
- Production benzeri kopyada mevcut sipariş/ürün/partner satırlarının değişmediğini doğrula.
- Eski ve satıcısı belirsiz siparişlerin otomatik faturaya dönüşmediğini doğrula.
- `resolve_unified_seller_sub_order` RPC'sinde tenant/store/item toplamı hatalarının transaction'ı tamamen geri aldığını doğrula.
- `complete_order_invoice_allocation` çağrısından önce hiçbir event'in fatura oluşturmadığını; eksik kalem, yanlış seller veya yanlış beklenen sub-order sayısının completion'ı tamamen geri aldığını doğrula.
- `COMPLETE` tahsisatta seller/store/adet/fiyat/vergi mutasyonlarının reddedildiğini, müşteri teslimat durumunun güncellenebildiğini doğrula.
- `CUSTOMER_SALE/E_INVOICE|E_ARCHIVE`, `RETURN/RETURN` ve `COMMISSION/COMMISSION` scope/type eşleşmesi dışındaki satırların database tarafından reddedildiğini doğrula.
- PostgreSQL sürümünün `security_invoker` view desteği için 15 veya üstü olduğunu doğrula.

## 3. RLS matrisi

- Organization owner yalnız kendi organization verisini görür.
- Legal entity üyesi yalnız yetkili şirketleri görür.
- Store üyesi yalnız yetkili mağazayı görür.
- Partner A, Partner B fatura/kalem/job/failure/provider hesabını göremez.
- Müşteri yalnız kendi `orders.user_id` ile bağlı faturaları görür.
- Müşteri ve partner private bucket objesini doğrudan listeleyemez.
- Müşteri kendi `taxpayer_status`, doğrulama kaynağı veya zamanını direct Supabase write ile değiştiremez.
- Admin rolü ve MFA gerektiren backend aksiyonları ayrıca doğrulanır.
- Global profili `customer` olsa bile açık legal entity/store üyeliği bulunan işletme kullanıcısının yalnız kendi tenant'ını okuyabildiğini; yönetim işlemlerinde AAL2 ve manager/owner/accounting kontrolünün uygulandığını doğrula.

## 4. Mock provider kabul senaryoları

- Tek sipariş / tek satıcı / tek fatura.
- Tek sipariş / üç satıcı / üç ayrı fatura.
- Aynı idempotency key ile eşzamanlı iki enqueue / tek fatura.
- Ambiguous seller / `NEEDS_REVIEW` / dış çağrı yok.
- `CREATE_DOCUMENT` başarılı, `UPLOAD_TO_CHANNEL` başarısız / yeni fatura yok.
- Kısmi tek kalem iadesi.
- Bir kalemin kısmi adet iadesi.
- Aynı fatura için eşzamanlı iade ve iptal isteğinde yalnız bir operation guard kazanır; karşı domain provider çağrısı yapmaz.
- Provider çağrısı başlamamış iade talebini MFA ile reddet; miktarın serbest kaldığını, job'ın claim edilemediğini ve audit zincirini doğrula.
- `provider_call_started_at` işaretli veya artifact/ETTN almış iade talebinin reddedilip miktarı serbest bırakılamadığını doğrula.
- Sipariş iptali varken fatura iptalinin ayrı beklemesi.
- Geçersiz status transition reddi.
- Hatalı imza, eski timestamp ve duplicate webhook reddi.
- Retry gecikmeleri ve maksimum deneme sonrası `NEEDS_REVIEW`.
- Manuel retry sırasında invoice/workflow/job durumlarının aynı transaction'da kaldığı doğrulanır.
- Uzun provider çağrısında lease heartbeat ve lease kaybı senaryosu doğrulanır.
- Uzun kanal çağrısında job ve delivery lease heartbeat birlikte yenilenir; expired worker renew/complete/fail edemez ve iki aktif upload job'ı oluşamaz.
- Son lease süresi dolduğunda job, invoice ve iade/iptal workflow'ünün birlikte `NEEDS_REVIEW` durumuna geçtiğini doğrula.
- Her `trigger_event` için aynı stabil `eventId` ile internal order event girişini iki kez çağır; durable inbox'ta tek event, tek invoice/job ve görünür duplicate sonucu bekle.
- Event işlenirken lease heartbeat, worker çökmesi sonrası reclaim ve eski worker'ın fenced completion reddini doğrula.
- Ayarla uyuşmayan event'in fatura üretmeden `SKIPPED`, çözümlenemeyen seller zincirinin `NEEDS_REVIEW` döndürdüğünü doğrula.

## 5. Gerçek provider açılışı

- GİB onaylı sağlayıcının güncel resmi dokümantasyonu arşivlenir.
- Sandbox base URL ve production base URL ayrı tanımlanır.
- Credential değeri database'e yazılmaz; yalnız `credential_reference` saklanır.
- Credential referansı service-only `integration_credential_bindings` tablosunda doğru organization/legal entity/integration key/purpose ile bağlanır; yanlış tenant veya yanlış amaçla yeniden kullanım reddedilir.
- Secret okuma yetkisi sadece backend runtime kimliğine verilir.
- `vault:*` referansları için backend secret-manager resolver kurulup salt-okunur erişimle test edilir; resolver yoksa production provider açılmaz.
- Webhook signature algoritması ve timestamp toleransı resmi dokümanla doğrulanır.
- Canlı provider capability sonuçları UI capability matrisiyle eşleştirilir.
- Provider create operasyonunun upstream idempotency anahtarını kabul ettiği ve aynı anahtarda aynı belgeyi döndürdüğü resmi sözleşme/sandbox testiyle doğrulanır.
- Provider `idempotentCreate` ve `synchronousArtifacts` şartlarını karşılamıyorsa asenkron artifact/status job'ları ayrıca uygulanmadan hesap etkinleştirilmez.
- Feature flag başlangıçta kapalı tutulur.
- Provider için `E_INVOICING_PROVIDER_CALLS_ENABLED`, harici satış kanalı için `E_INVOICING_CHANNEL_CALLS_ENABLED` ayrı ayrı kapalı tutulur.

## 6. Operasyon onayı

- Her legal entity için fatura profili ve provider hesabı doğrulanır.
- Active legal entity için vergi kimliği, ülkeye göre vergi dairesi ve eksiksiz fatura adresi; müşteri profili için türüne göre zorunlu kimlik/e-posta/adres alanları doğrulanır.
- Her mağaza için seller/legal entity eşlemesi iki kişi tarafından kontrol edilir.
- Tetikleme olayı admin tarafından açıkça seçilir; varsayılan `MANUAL` korunur.
- Checkout, ödeme ve kargo servislerinin önce bütün seller sub-order'ları çözüp allocation completion yaptığı, ardından yalnız transaction commit sonrasında stabil `eventId` ile `POST /v1/internal/e-invoicing/order-events` olayı ürettiği doğrulanır.
- e-Fatura/e-Arşiv fallback tercihi açıkça seçilir; belirsiz durum `manual_review` kalır.
- İlk canlı belge düşük riskli kontrollü siparişle oluşturulur.
- Provider sonucu, PDF, XML, ETTN, numara ve pazaryeri geri aktarımı ayrı ayrı doğrulanır.

## 7. Geri dönüş ve gözlem

- Production create/upload worker feature flag'leri ayrı kapatılabilir olmalıdır; worker kapanması durable order inbox ve job kayıtlarını silmez.
- Kuyruk kapatılsa bile mevcut belge kayıtları ve audit zinciri korunur.
- Hata ekranında request ID, invoice ID, job ID, provider document ID ve channel upload job zinciri izlenir.
- Secret, tam vergi numarası, kimlik numarası, adres ve raw yetkilendirme header'ı loglarda bulunmamalıdır.
- Provider/kanal istisna metinlerinin failure tablosuna veya 5xx loguna ham header, credential ya da request config taşımadığı doğrulanır; operasyon takibi güvenli error code ve correlation ID ile yapılır.
