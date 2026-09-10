# MVP READINESS

AllonaHub halka açık açılışına yalnızca aşağıdaki sistemler çalışır, test edilmiş ve onaylanmış olduğunda izin verilir.

## Zorunlu Açılış Kilidi

1. Süper Admin Paneli
2. Admin Paneli
3. Kullanıcı Paneli
4. Partner Paneli
5. Sipariş Sistemi
6. iyzico Ödeme Sistemi
7. HP / Kupon Sistemi
8. Finans ve Komisyon Merkezi
9. Bildirim Sistemi
10. Hetzner Backend Geçişi

## Transaction Core Durumu

Bu çalışma Transaction Core MVP katmanını kurar:

- Supabase adres RLS ve tek varsayılan adres kuralı.
- Supabase aktif sepet ve sepet kalemi tabloları.
- Server-side sipariş oluşturma RPC'si.
- Ürün fiyatı, stok, kupon, HP ve kargo toplamlarının server-side doğrulanması.
- Kullanıcı Kupon Merkezi.
- Admin sipariş, kupon ve HP/XP ekranları.
- Partner sipariş kalemi görünümü ve sınırlı durum güncelleme akışı.
- iyzico ödeme başlatma/callback durumlarının yeni sipariş alanlarıyla uyumu.

## Canlı Açılış Öncesi Zorunlu Testler

- Kullanıcı adres ekleyebilmeli, varsayılan adres seçebilmeli ve adres silebilmeli.
- Ürün sepete eklenmeli; aynı ürün tekrar eklenince quantity artmalı.
- Sepet boşken checkout engellenmeli.
- Adres yokken checkout engellenmeli.
- Kupon süresi, kullanım limiti ve minimum sepet tutarı doğru çalışmalı.
- HP indirimi günlük/sipariş limitlerine uymalı ve toplamı negatif yapmamalı.
- Sipariş oluşunca aktif sepet `completed` olmalı.
- iyzico ödeme başlatma sayfası açılmalı; kart bilgisi yalnız iyzico ekranında girilmeli.
- iyzico callback başarılı ödemede siparişi `paid`, başarısız ödemede `failed/pending` yapmalı.
- Partner sadece kendi sipariş kalemlerini görmeli.
- Partner sadece `preparing`, `shipped`, `delivered` durumlarına güncelleyebilmeli.
- Admin tüm siparişleri görmeli, fraud/status/admin note alanlarını yönetebilmeli.
- Kullanıcı başka kullanıcının siparişini görememeli.
- Frontend fiyat manipülasyonu yapılsa bile RPC ürün fiyatını Supabase ürün tablosundan yeniden hesaplamalı.

## Operasyon Notu

HP gerçek para cüzdanı değildir. MVP'de yalnızca indirim hakkı, kupon avantajı ve kampanya hakkı olarak gösterilir. Nakit çekim ve gerçek para bakiyesi gösterimi kapalıdır.

## Denizcilik Modülü Yayın Kilidi

- `deploy/maritime/apply-maritime-migrations.sh` MFA enterprise security migration'ından sonra başarıyla tamamlanmalı.
- `deploy/maritime/check-maritime-schema.sh` altı denizcilik tablosunda RLS, policy, grant, RPC ve idempotency kontrollerini geçmeli.
- `deploy/maritime/check-maritime-hiring-core.sh` Seafarer Workspace, Readiness Passport, Company Maritime Workspace, Allona Connect, Private Candidate Room, Crew Room, Trust Oversight, time-boxed sensitive access ve append-only audit kontrollerini geçmeli.
- Yeni Maritime işe alım arayüzleri, ilgili backend endpointi ve RLS negative testleri olmadan çalışan ürün gibi gösterilmemeli; coverage matrix durumu `docs/architecture/allona-maritime-autonomous-hiring.md` içinde güncel tutulmalı.
- Super Admin Maritime Trust ekranı yalnız kalıcı `super_admin` rolü + MFA + owner kilidi ile açılmalı; owner bootstrap/admin geçişi bu endpointte yeterli sayılmamalı.
- Maritime Trust varsayılan yanıtı metadata/risk/şikayet/audit görünümüyle sınırlı kalmalı; mesaj gövdesi, dosya yolu/içeriği, görüşme kaydı, ham sensitive access gerekçesi ve metadata değerleri endpoint yanıtında bulunmamalı.
- Allona Verified Gold Tick yalnız doğrulama kanıtı ile verilmeli; Pro Blue Tick doğrulamadan ayrı üyelik göstergesi olarak kalmalı.
- Allona Connect media katmanı WebRTC provider abstraction üzerinden bağlanmalı; provider secret değerleri frontend, migration veya doküman içine yazılmamalı.
- Ara yayında Partner OS, API hatasında yerel ödeme/destek kaydı veya örnek cihaz verisi üretmemeli; canlı veri alınamazsa işlem açık hata durumuna düşmeli.
- Halka açık ilan sorgusu yalnızca aktif, yayın zamanı gelmiş, süresi dolmamış `module_key = maritime` kayıtlarını döndürmeli.
- Public crew/vessel alanlarında kötü niyetli başlık HTML çalıştırmamalı; vessel detay linki `module = maritime` bağlamını ve yalnız izinli `shipowner` rol ön seçimini korumalı.
- Crew CTA pozisyon ön dolgusu yalnız izinli maritime source ile çalışmalı, formun kayıtlı taslak yüklemesinden sonra uygulanmalı ve preview'da HTML çalıştırmamalı.
- URL pozisyon ön dolgusu sentetik input/auto-save tetikleyip mevcut CV taslağını pasif ziyarette değiştirmemeli; gerçek kullanıcı düzenlemesi normal auto-save davranışını sürdürmeli.
- Maritime CV PII taslağı `localStorage` içinde kalıcı tutulmamalı; sekmeye özel sürümlü taslak en fazla 2 saat yaşamalı, bozuk/süresi geçmiş/yanlış modüllü envelope silinmeli ve eski anahtar tek geçişten sonra kaldırılmalı.
- CV taslak yüklemesi yalnız allowlist alanları bağlamalı; metinleri 2000, tekrarlı satırları 50 ve satır alanlarını 300 karakterle sınırlamalı. Fotoğraf yalnız JPEG/PNG/WebP ve en fazla 2 MB olmalı; SVG/data URL enjeksiyonu önizlemeye ulaşmamalı.
- Hızlı CV düzenlemeleri debounce ile tek yazıma birleşmeli; bekleyen son değişiklik `pagehide` sırasında kaydedilmeli ve aynı sekmede geri yüklenirken bağımsız sekmeye taşınmamalı.
- Maritime CV araç çubuğunda dil, kaydetme, PDF ve temizleme kontrolleri 320/390 px görünümde kaydırma gerektirmeden tamamen görünmeli; sayfa yatay taşmamalı.
- Maritime CV PDF bağımlılıkları sabit sürüm + SHA-384 SRI, anonim CORS ve referrer kısıtıyla yüklenmeli; değiştirilmiş/eksik CDN yanıtı kod çalıştırmadan kontrollü tekrar uyarısına düşmeli.
- PDF üretimi tek uçuşlu olmalı; hızlı çift tetik yalnız bir dosya üretmeli, render hatasında `pdf-capture` ve düğme kilidi temizlenmeli, kullanıcı adından üretilen dosya adı yalnız güvenli karakterleri içermeli.
- Gerçek `html2canvas + jsPDF` smoke testinde dört CV sayfası indirilebilir, `%PDF-` imzalı ve anlamlı boyutta tek dosya üretmeli; indirme sonrası UI kilidi/capture sınıfı kalmamalı.
- Maritime CV DOM'unda inline event attribute bulunmamalı; statik alan ve dinamik sertifika/tecrübe işlemleri allowlist'li delegation ile çalışmalı, bilinmeyen satır tipi/alan/index yok sayılmalı.
- Ek sertifika, STCW ve deniz tecrübesi dizileri UI üzerinden de en fazla 50 satır kabul etmeli; dinamik listener dil değişimindeki yeniden render sonrasında çalışmayı sürdürmeli.
- Maritime CV sayfasında inline `<style>`, inline `<script>`, `style` attribute veya runtime `.style` yazımı bulunmamalı; sayfa CSS/JS'i yerel dış dosyalardan yüklenmeli ve fotoğraf görünürlüğü `hidden` durumu ile yönetilmeli.
- Dış dosyaya çıkarım sonrasında screen/print davranışı korunmalı; print görünümünde editör/toolbar gizlenmeli, A4 önizleme yaklaşık 210 mm genişlikte ve beyaz arka planda kalmalı.
- Maritime CV editöründeki statik ve dinamik kontrollerin tamamı programatik label/ARIA adına ve benzersiz deterministik ID'ye sahip olmalı; label tıklaması ilgili alanı odaklamalı ve dil becerisi adları seçili dille yenilenmeli.
- Belgenin `lang` değeri, toolbar metinleri, dil seçici adı, fotoğraf alt metni ve kullanıcı uyarıları EN/TR/AZ/RU seçimiyle birlikte değişmeli; dil tercihi depolaması kapalıyken değişim hata üretmemeli.
- E-posta alanı `type=email`, telefon alanları `type/inputmode=tel` kullanmalı; dört dilde toolbar metinleri 320 px'de kontrol sınırını aşmamalı.
- CV statik alanları yazma/depolama anında 2000, dinamik satır alanları 300 karakterle sınırlanmalı; programatik input olayı da kontrol/önizleme/taslak değerini aynı sınırda tutmalı.
- Dinamik update/remove fonksiyonları delegation dışında doğrudan çağrılsa da satır tipi key allowlist'ini ve 0-49 index sınırını kendi içinde doğrulamalı; `__proto__`, bilinmeyen key, negatif veya taşan index veri değiştirmemeli.
- Maritime CV profil fotoğrafı önizleme görselinde anlamlı `alt` metni bulunmalı.
- Denizcilik aramasında navlun form odağı, Maritime CV, maritime destek ve generic maritime detail rotaları ayrı ayrı çalışmalı; boş/bozuk hedef veya genel partner formuna düşüş olmamalı.
- Ana denizcilik ve Maritime CV hero'ları split text/media kullanmamalı; gerçek gemi/liman görseli tam yüzeyde, ürün adı H1 olarak ve değer önermesi destek metninde görünmeli.
- Hero copy/CTA/durum bandı 1440x900, 390x844 ve 320x568 boyutlarında çakışmamalı; belge yatay taşmamalı ve sonraki bölüm başlığı ilk viewport'ta görünür ipucu bırakmalı.
- Ana denizcilik ve Maritime CV geçiş sayfalarında ilk Tab hedefi görünür “Ana içeriğe geç” bağlantısı olmalı; 3 px odak halkası ilk karede görünmeli, Enter `main` odağına ve sonraki Tab ana içeriğe geçmeli.
- Denizcilik partner başvurusunda doğrulama hatası ilk hatalı alana odaklanmalı; ağ/servis hatası görünür uyarıya, başarı/duplicate sonucu odaklanabilir sonuç kutusuna düşmeli ve PII depolamaya yazılmamalı.
- Navlun talebi gerçek kullanıcı JWT'siyle oluşturulmalı; başka kullanıcının talebi okunamamalı veya iptal edilememeli.
- Navlun talebi ile ilk `submitted` olayı service-role-only RPC içinde atomik oluşmalı; event yazımı başarısızken talep tek başına kalmamalı ve aynı kullanıcı/idempotency kimliği ikinci kayıt ya da olay üretmemeli.
- Navlun formunda hızlı çift gönderim tek POST üretmeli; offline, zaman aşımı ve 429 sonrasında form tekrar açılmalı, taslak ile aynı güvenli `client_request_id` korunmalı.
- Laycan HTML sınırı backend ile aynı 730 günlük pencereyi kullanmalı; sekme depolaması kapalıysa girişli API gönderimi çalışmalı, oturumsuz kullanıcı taslağı kaybetmeden ekranda tutulmalı.
- Navlun iptali sadece `submitted` veya `in_review` durumunda, backend sahiplik kontrolüyle çalışmalı.
- Navlun iptal durumu ve tekil `cancelled` olayı service-role-only RPC içinde atomik oluşmalı; başka kullanıcının talebi 404, ilerlemiş talep 409 vermeli ve tekrar çağrı ikinci olay/audit üretmemeli.
- İptal UI ilk onay tıklamasında PATCH göndermemeli; offline/timeout/404/409/429/503 hatasında düğme yeniden etkinleşip `confirmed=false` olmalı, 401 giriş görünümüne dönmeli ve doğrulanmayan 200 yanıtı kartı değiştirmemeli.
- Talep sahibi taslak/geri çekilmiş broker tekliflerini görememeli; yalnız yayınlanmış teklif durumları kendi talebi altında görünmeli.
- Partner başka brokerın teklifini görememeli ve ayrıcalıklı teklif erişimi MFA olmadan çalışmamalı.
- Talep sahibi olmayan kullanıcı teklif kabul edememeli; başka talebe ait teklif kimliği aynı endpointte 404 vermeli.
- Süresi dolmuş, taslak, geri çekilmiş veya daha önce sonuçlanmış teklif kabul edilememeli.
- Teklif kabulünde seçilen teklif `accepted`, diğer açık teklifler `rejected`, navlun talebi `accepted` ve olay kaydı tek transaction içinde oluşmalı.
- Aynı kabul isteğinin tekrarı ikinci event üretmemeli; iki teklif yarışında yalnız biri kabul edilmeli.
- Eşzamanlı aynı teklif kabul çağrılarında RPC kilit altında yalnız bir `acceptance_changed = true` döndürmeli; HTTP yanıtlarından biri duplicate olmalı ve güvenlik audit'i yalnız bir kez yazılmalı.
- Kabul endpointi transaction dışı talep/teklif ön okuması yapmamalı; v2 RPC'nin talep/teklif kimliği, iki kabul durumu ve zaman alanı doğrulanmadan başarı dönmemeli.
- Teklif kabul UI ilk tıklamada PATCH göndermemeli ve işlem sürerken aynı talebin tüm teklif aksiyonlarını kilitlemeli; offline/timeout/404/409/429/503 sonrası bütün onaylar sıfırlanmalı, 401 giriş görünümüne dönmeli.
- Kabul yanıtındaki talep/teklif kimliği, iki `accepted` durumu ve `accepted_at` doğrulanmadan kart kabul edilmiş gösterilmemeli; timeout sonrası idempotent tekrar yeniden iki tıklamalı onay istemeli.
- Kullanıcı yalnız kendi navlun talebinin olay geçmişini görebilmeli; başka talebin event satırı RLS ile gelmemeli.
- Takip ekranı event payload içeriğini sorgulamamalı veya render etmemeli; bilinmeyen event türlerini göstermemeli.
- Ops Admin yalnız kullanıcı hesabına bağlı, `profiles.role = partner` ve onaylı `broker/shipowner/agency` başvurusu olan hesabı navlun talebine atayabilmeli.
- Partner yalnız kendi aktif eşleşmesini görebilmeli; başka `matchId` ile teklif gönderimi 404 vermeli.
- Partner teklif formu durum, broker/şirket adı veya eşleşme kimliğini body içinde belirleyememeli; bu alanlar route/backend/RPC sahipliğinde kalmalı.
- Teklif gönderiminde eşleşme `accepted`, teklif `submitted`, talep `quoted` ve `quote_added` olayı aynı transaction içinde oluşmalı; tekrar gönderim ikinci teklif/event üretmemeli.
- Partner yalnız kendi teklifsiz `invited` eşleşmesini iki aşamalı UI onayıyla reddedebilmeli; ilk dokunuş ağ isteği oluşturmamalı ve tekrar çağrı ikinci `match_declined` olayı üretmemeli.
- Partner yalnız kendi `submitted` teklifini talep kabul edilmeden önce iki aşamalı UI onayıyla geri çekebilmeli; teklif `withdrawn`, eşleşme `closed` olmalı ve kalan aktif işe göre talep durumu atomik hesaplanmalı.
- Başka partnere ait eşleşme reddi/teklif geri çekme istekleri 404 vermeli; MFA seviyesi `aal2` olmayan partner bu endpointleri kullanamamalı.
- Talep sahibi geri çekilmiş teklif satırını görmemeli, ancak allowlist içindeki `match_declined` ve `offer_withdrawn` olaylarını payload olmadan zaman çizelgesinde görebilmeli.
- Süresi dolan teklif `expired`, eşleşme `closed` olmalı; başka geçerli teklif/davet kalmadığında talep `in_review` durumuna dönmeli ve tekrar cron çağrısı ikinci süre sonu olayı üretmemeli.
- Süre sonu cron'u eksik/yanlış secret ile 401 vermeli; limit dışı batch reddedilmeli ve RPC `anon`/`authenticated` rollerince doğrudan çalıştırılamamalı.
- Onayı sonradan kaldırılan MFA partner kendi eşleşme geçmişini ve açık çıkış işlemlerini görebilmeli, ancak yeni teklif gönderememeli.
- Talep sahibi allowlist içindeki `match_expired` ve `offer_expired` olaylarını payload olmadan görebilmeli; süre dolmuş teklif için kabul CTA'sı oluşmamalı.
- Bildirim sayfası yalnız talep sahibinin allowlist navlun olaylarını göstermeli; `event_payload`, rota, tutar veya şart alanlarını sorgulamamalı ve bilinmeyen olay türünü render etmemeli.
- Oturumsuz bildirim sayfası veri sorgulamak yerine güvenli giriş CTA'sı göstermeli; kötü niyetli referans metni HTML olarak çalışmamalı.
- Partner OS davet rozeti yalnız aktif, teklifsiz ve süresi geçmemiş eşleşmeleri saymalı; reddetme sonrası sayıyı yerel sunucu sonucuyla hemen azaltmalı.
- Maritime kullanıcı paneli zil rozeti yalnız `quoted` talep sayısını göstermeli; sıfırda gizlenmeli ve okunmamış bildirim gibi etiketlenmemeli.
- Kullanıcı paneli son navlun hareketleri exact-field owner RLS sorgusundan gelmeli, event payload/bilinmeyen tür render edilmemeli ve satırlar UUID hash ile takip kartına bağlanmalı.
- Navlun activity sorgusu hata verirse panel kullanılabilir kalmalı; sahte Maritime HP işlemi üretmemeli ve gerçek takip CTA'sına düşmeli.
- Navlun bildirim CTA'sı yalnız UUID allowlist'li URL hash'i üretmeli; takip ekranı hedef kartı yükleme sonrası vurgulayıp klavye odağına almalı, bozuk hash'i yok saymalı.
- Deep-link hedefi mevcut filtrede görünmüyorsa ilk odakta filtre güvenle `all` durumuna dönmeli; kullanıcı sonraki filtre seçimini yapabilmeli.
- Talep kartları teklif/olay sorgularını beklemeden görünmeli; ana ve detay RLS okumaları timeout sonrası kullanılabilir hata/uyarı durumuna dönmeli, gecikmeli detay render'ı hedef kart odağını kaybetmemeli.
- Ana veya detay RLS okuması hata/timeout verdiğinde görünür `Yeniden Dene` kontrolü oluşmalı; hızlı çift tetik tek yeni yükleme turu başlatmalı, kartlar korunmalı ve tam başarıda kontrol gizlenmeli.
- Navlun takipte iptal ve teklif kabul gibi iki aşamalı aksiyonlar `aria-pressed` durumunu, bağlamlı erişilebilir adı, işlem sonrası kart odağını ve hata sonrası düğme odağını korumalı.
- Oturumsuz deep-link giriş CTA'sı yalnız doğrulanmış UUID hash'ini sabit takip sayfası `returnTo` değerinde korumalı; malformed hash giriş dönüşüne taşınmamalı.
- Maritime giriş CTA'ları CSP uyumlu `login.html` formuna gitmeli; login/register/forgot sayfalarında meta refresh, inline script/handler/style bulunmamalı ve auth geçişleri güvenli aynı-origin `returnTo` değerini korumalı.
- Dış-origin auth dönüşü kullanıcı paneli fallback'ine düşmeli; oturumsuz navlun taslağı login sonrası denizcilik intent'ine dönüp tüm alanları sekme depolamasından geri yüklemeli.
- Talep `accepted` olduğunda kazanan teklif eşleşmesi `accepted` kalmalı; reddedilen teklifler ve cevapsız davetler UI'da anında `closed` görünmeli, cron sonrası veritabanında da kapanmalı.
- Terminal eşleşme uzlaştırması yeni event üretmemeli, aynı batch tekrarında sayaç sıfır dönmeli ve kazanan eşleşmeyi kapatmamalı.
- Partner başvurusu Turnstile doğrulaması ve rate limit olmadan kabul edilmemeli; PII tarayıcı depolamasına veya audit metadata alanına yazılmamalı.
- Partner başvurusu ağ/429 hatasında PII'yi yalnız sayfa belleğinde ve aynı idempotency kimliğiyle korumalı; tekrar deneme eski Turnstile tokenını kullanmamalı, başarı/duplicate sonucunda PII temizlenmeli.
- `crypto.randomUUID()` bulunmayan tarayıcıda kimlik güvenli `crypto.getRandomValues()` ile üretilmeli; güvenli rastgelelik yoksa başvuru gönderilmemeli.
- Turnstile action değeri tam olarak `maritime_partner_application` olmalı; güvenlik bileşeni CSP'yi zayıflatan runtime stil etiketi veya HTML string enjeksiyonu üretmemeli.
- Onaylı denizcilik partneri olmayan veya MFA seviyesi `aal2` olmayan hesap ilan gönderememeli.
- Partner ilan formundan gelen durum değeri kabul edilmemeli; yeni ilan server-side `pending_review` başlamalı.
- Ops Admin dışındaki kullanıcı ilanı `active` yapamamalı; süresi dolmuş veya kuyruk durumu değişmiş ilan onaylanamamalı.
- Public ilan sorgusunda `pending_review`, `rejected`, `paused` ve başka partnere ait inceleme notları görünmemeli.
- Backend deploy sonrası yeni denizcilik endpointleri canlı domain üzerinden smoke test edilmeden modül üretime hazır sayılmamalı.
