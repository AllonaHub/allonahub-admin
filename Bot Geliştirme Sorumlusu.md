# Bot Geliştirme Sorumlusu

Bu rapor ALLONAHUB proje yönetimi kapsamında bot geliştirme alanında elimizde olanları, eksikleri, geliştirilmesi gereken başlıkları ve ileri adım uygulama rotasını tanımlar.

Rapor tarihi: 27 Haziran 2026

## Amaç

- ALLONAHUB içinde kullanıcı destek, hizmet yönlendirme, sosyal medya mesaj yönetimi, taksi destek akışı ve AVM rehberi için ortak bot geliştirme standardı oluşturmak.
- Botun yalnızca cevap veren bir sohbet alanı değil; doğru veriye dayanan, güvenli, ölçülebilir ve gerektiğinde insan desteğine devreden bir operasyon katmanı olmasını sağlamak.
- İlk MVP kapsamını, teknik mimariyi, veri ihtiyaçlarını, güvenlik kontrollerini ve sonraki fazları netleştirmek.

## Araştırma Yöntemi

- Yerel çalışma klasöründeki tüm proje dokümanları incelendi.
- `bot`, `chat`, `mesaj`, `whatsapp`, `telegram`, `otomasyon`, `asistan`, `destek`, `randevu`, `rezervasyon` anahtarlarıyla repo taraması yapıldı.
- Git durumu, remote bağlantısı ve takip edilen dosyalar kontrol edildi.
- Güncel teknik yön için OpenAI, WhatsApp Business Platform, Telegram Bot API, Discord Interactions ve OWASP LLM güvenlik kaynakları gözden geçirildi.

## Mevcut Repo Bulgusu

| Alan | Durum | Not |
| --- | --- | --- |
| Bot dokümanı | Yeni oluşturuldu | Bu dosya bot geliştirme ana raporu olarak eklendi. |
| Bot kodu | Yok | Backend, frontend chat widget, webhook veya bot servisi bulunamadı. |
| Bot akışları | Yok | Intent, senaryo, fallback, insan devri ve cevap şablonları tanımlı değil. |
| Bilgi tabanı | Kısmen var | Anasayfa, hizmetler, güvenlik, mobil, sosyal medya, taksi ve AVM dokümanları bot bilgisi için başlangıç olabilir. |
| Sosyal medya otomasyonu | Plan var | Sosyal medya dokümanı otomatik paylaşım rotasını tanımlıyor; DM/yorum botu henüz yok. |
| Taksi destek zemini | Var | Taksi modülünde destek, şikayet, iptal, ödeme ve bildirim akışları bot için güçlü aday. |
| AVM rehber zemini | Var | AVM, mağaza, kampanya, etkinlik, kupon ve harita bilgileri bot senaryolarına uygun. |
| Panel dokümanları | Var | Admin, Süper Admin, Partner ve User Panel raporları botun insan devri, destek kuyruğu, rol/yetki ve görünürlük modeline bağlanabilir. |
| Güvenlik standardı | Var | MFA, secret, API, rate limit, loglama ve hassas veri prensipleri tanımlı. |
| Mobil kalite standardı | Var | Chat widget ve mobil bot arayüzü için kırılım/test kriterleri mevcut. |
| Git remote | Yok | `git remote -v` boş döndü. |
| Takip edilen dosya | Yok | `git ls-files` boş döndü; mevcut dosyalar henüz izlenmiyor. |

## Bot İçin Neyimiz Var

- ALLONAHUB marka adı ve hizmet odaklı değer önerisi.
- Anasayfa ve hizmetler için kullanıcı odaklı içerik kriterleri.
- Güvenlik, mobil kalite ve günlük geliştirme kontrol listeleri.
- Taksi modülü için gerçek zamanlı destek, ödeme, iptal, şikayet ve operasyon senaryoları.
- AVM Dünyası için AVM, mağaza, kampanya, kupon, etkinlik, harita ve bildirim senaryoları.
- Sosyal medya için ürün/hizmet paylaşımı, kanal öncelikleri, API ve ölçümleme yönü.
- Admin, Süper Admin, Partner ve User Panel dokümanları sayesinde botun açacağı kayıtların kim tarafından görüleceği, onaylanacağı ve raporlanacağına dair güçlü panel zemini.

## Bot İçin Neyimiz Yok

- Botun ana hedefi ve ilk kanal kararı: web, WhatsApp, Telegram, Instagram DM, Discord veya uygulama içi chat.
- Bot persona ve marka dili: ne kadar resmi, ne kadar kısa, hangi kelimeler yasak, hangi durumlarda insan desteğine devreder.
- Intent listesi: hizmet sorma, teklif isteme, destek talebi, taksi sorunu, AVM arama, kampanya sorma, sosyal medya mesajı vb.
- SSS ve doğrulanmış cevap seti.
- Konuşma durumu ve ticket veri modeli.
- Webhook altyapısı, queue, scheduler, retry ve hata yönetimi.
- CRM, destek paneli veya operasyon paneli entegrasyonu.
- Bot cevaplarının loglanması, kalite ölçümü ve raporlama akışı.
- LLM/RAG kullanımı için bilgi tabanı, izinler, veri saklama ve güvenlik sınırları.
- Test seti: başarılı cevap, yanlış cevap, hassas veri, kötüye kullanım, spam, prompt injection, kanal bazlı regresyon.

## Öncelikli Sonuç

İlk bot işi için en doğru MVP, "ALLONAHUB Web Destek ve Hizmet Yönlendirme Botu" olmalı. Bunun sebebi mevcut dokümanların çoğunun hizmet, destek, mobil ve güvenlik temeli vermesi; web botunun WhatsApp veya Telegram gibi dış kanallara göre daha hızlı kontrol edilebilmesi; yanlış cevap riskinde insan devrinin kolay kurulabilmesidir.

İkinci adımda WhatsApp veya Telegram kanal adaptörü eklenebilir. Sosyal medya DM ve yorum otomasyonu ise sosyal medya envanteri ve hesap erişimleri netleştikten sonra fazlandırılmalıdır.

## Önerilen Bot Tipleri

| Bot Tipi | Amaç | Öncelik | Başlangıç Kapsamı |
| --- | --- | --- | --- |
| Web destek botu | Ziyaretçiyi hizmete, iletişime veya teklif akışına yönlendirmek | Kritik | Hizmet SSS, teklif yönlendirme, iletişim bilgisi, insan devri |
| WhatsApp destek botu | Mesajlaşma üzerinden hızlı müşteri desteği vermek | Yüksek | SSS, destek kaydı, teklif talebi, temsilciye aktarma |
| Telegram operasyon botu | Ekip içi hızlı bildirim ve günlük rapor almak | Orta | Gün sonu raporu, açık risk listesi, görev hatırlatma |
| Taksi destek botu | Yolculuk sırasında destek, iptal, ödeme ve şikayet triage yapmak | Yüksek | Yolculuk ID sorgusu, sorun sınıflandırma, acil destek devri |
| AVM rehber botu | AVM, mağaza, kampanya, etkinlik ve kupon sorularını yanıtlamak | Orta-Yüksek | AVM arama, mağaza bulma, kampanya/çalışma saati sorgusu |
| Sosyal medya DM botu | DM/yorumları sınıflandırmak ve uygun cevap taslakları üretmek | Orta | Mesaj etiketi, cevap önerisi, insan onayı |
| Sesli destek botu | Telefon veya uygulama içi sesli destek sağlamak | İleri faz | Realtime voice agent, çağrı özeti, temsilciye devretme |

## MVP Kapsamı

İlk MVP aşağıdaki dar kapsamla başlamalıdır:

- Web sitesinde veya test panelinde çalışan metin tabanlı chat arayüzü.
- Hizmetler, iletişim, teklif alma, çalışma süreci ve genel SSS cevapları.
- Taksi ve AVM konularında yalnızca yönlendirme ve destek kaydı; gerçek işlem yapmadan önce insan onayı.
- Kullanıcıdan ad, iletişim, konu, açıklama ve izinli kanal bilgisi alma.
- Bot cevabından emin değilse insan desteğine devretme.
- Tüm konuşmaları hassas veri maskeleme ile loglama.
- Günlük bot raporu: toplam görüşme, çözülen görüşme, devredilen görüşme, hatalı/cevapsız konu.

MVP dışında bırakılacaklar:

- Otomatik ödeme, ücret iadesi, yolculuk iptali veya kupon kullandırma gibi maddi etkisi olan işlemler.
- İnsan onayı olmadan sosyal medya yanıtı yayınlama.
- Kişisel veri veya konum verisini uzun süre saklama.
- Sesli bot ve çok kanallı tam otomasyon.

## Önerilen Mimari

| Katman | Görev | İlk Uygulama |
| --- | --- | --- |
| Kanal adaptörleri | Web, WhatsApp, Telegram, Discord veya sosyal medya DM mesajlarını standart formata çevirir | Önce web, sonra WhatsApp/Telegram |
| Webhook gateway | Dış kanallardan gelen istekleri doğrular, imza/secret kontrolü yapar | HTTPS endpoint ve kanal bazlı doğrulama |
| Konuşma orkestratörü | Kullanıcı niyeti, durum, geçmiş ve sonraki aksiyonu yönetir | Basit state machine + LLM cevabı |
| Bilgi tabanı | Hizmet, SSS, modül ve operasyon dokümanlarını cevap kaynağı yapar | Mevcut `.md` dosyalarından başlangıç |
| Araç katmanı | CRM, destek kaydı, taksi durum sorgusu, AVM arama gibi kontrollü işlemleri yapar | Sadece kayıt oluşturma ve arama |
| İnsan devri | Belirsiz, hassas veya yüksek riskli görüşmeyi temsilciye aktarır | Destek kuyruğu veya e-posta/panel |
| Log ve analitik | Konuşma kalitesi, hata, maliyet, gecikme ve dönüşümü izler | Günlük rapor dosyası/paneli |
| Güvenlik katmanı | Rate limit, secret, rol, input/output kontrolü ve veri maskeleme uygular | Güvenlik dokümanıyla uyumlu |

## AI Yaklaşımı

Bot iki modda tasarlanmalı:

1. Kural tabanlı kesin akışlar: iletişim alma, destek kaydı oluşturma, insan devri, acil destek, izin isteme.
2. AI destekli cevaplar: SSS, hizmet açıklaması, AVM/mağaza/kampanya rehberi, sosyal medya cevap taslakları.

AI kullanıldığında:

- Yanıtlar sadece onaylı bilgi tabanına dayandırılmalı.
- Tool/function çağrıları `strict` şema ile sınırlandırılmalı.
- Riskli işlemlerde bot öneri üretmeli, işlem insan veya yetkili servis tarafından onaylanmalı.
- Cevap güveni düşükse "emin değilim" davranışı ve insan devri çalışmalı.
- Prompt injection ve kötüye kullanım testleri MVP test setinin parçası olmalı.

## Bot Veri Modeli

| Alan | Zorunlu | Açıklama |
| --- | --- | --- |
| `conversation_id` | Evet | Her görüşme için benzersiz ID |
| `channel` | Evet | Web, WhatsApp, Telegram, Instagram, Discord vb. |
| `external_user_id` | Kanala bağlı | Kanal kullanıcısını temsil eden ID |
| `display_name` | Hayır | Kullanıcının görünen adı |
| `intent` | Evet | Hizmet, teklif, destek, taksi, AVM, sosyal medya vb. |
| `status` | Evet | Açık, çözüldü, devredildi, beklemede |
| `priority` | Evet | Kritik, yüksek, orta, düşük |
| `module` | Hayır | Taksi, AVM, sosyal medya, anasayfa/hizmetler |
| `summary` | Evet | Görüşmenin kısa özeti |
| `handoff_required` | Evet | İnsan devri gerekip gerekmediği |
| `consent_status` | Evet | Kullanıcı veri/iletişim izni durumu |
| `created_at` | Evet | Görüşme başlangıcı |
| `last_message_at` | Evet | Son mesaj zamanı |
| `owner` | Hayır | Devredilen ekip veya temsilci |

## Bilgi Tabanı Planı

| Kaynak | Kullanım | Eksik |
| --- | --- | --- |
| Anasayfa ve Hizmetler | Hizmet anlatımı ve CTA yönlendirmesi | Gerçek hizmet listesi, fiyat/teklif kuralları, SSS |
| Genel Güvenlik | Bot güvenlik ve veri saklama standardı | Bot özel prompt/tool güvenliği |
| Mobil Görünüm | Chat widget mobil kabul kriterleri | Chat ekran tasarımı ve mobil test görüntüleri |
| Taksi Modülü | Taksi destek ve şikayet sınıflandırması | Gerçek yolculuk API'si ve operasyon paneli |
| AVM Dünyası | AVM/mağaza/kampanya rehberi | Gerçek AVM, mağaza ve kampanya veri kaynağı |
| Sosyal Medya | DM/yorum ve sosyal paylaşım entegrasyonu | Hesap envanteri, mesaj politikası, API tokenları |
| Admin/Süper Admin Panel | İnsan devri, destek kuyruğu, audit log, yetki ve operasyon ekranları | Bot kayıtlarının panelde nasıl yönetileceği |
| Partner Panel | Partner destek talepleri, kampanya/kupon içerik soruları ve sınırlı görünürlük | Partner sahiplik modeli ve bot erişim sınırları |
| User Panel | Kullanıcı geçmişi, bildirim tercihleri, destek ve hesap akışları | Botun kullanıcı hesabıyla hangi bilgileri okuyabileceği |
| Günlük Geliştirme Motoru | Bot geliştirme ritmi ve raporlama | Bot günlük rapor şablonu |

## Geliştirmemiz Gerekenler

| Başlık | Gereken İş | Öncelik |
| --- | --- | --- |
| Ürün kararı | İlk kanal, ilk kullanıcı grubu ve botun başarı metriği netleşmeli | Kritik |
| İçerik | SSS, hizmet listesi, teklif soruları ve insan devri metinleri hazırlanmalı | Kritik |
| Teknik altyapı | Web chat, webhook gateway, conversation store ve loglama kurulmalı | Kritik |
| Güvenlik | Rate limit, secret yönetimi, webhook doğrulama, kişisel veri maskeleme uygulanmalı | Kritik |
| İnsan devri | Destek kuyruğu, bildirim ve sahiplik modeli kurulmalı | Yüksek |
| Panel entegrasyonu | Botun açtığı destek/talep kayıtları admin, partner veya user panelde izlenebilir olmalı | Yüksek |
| Bilgi tabanı | Mevcut dokümanlar indekslenmeli, cevap kaynakları sürümlenmeli | Yüksek |
| Modül araçları | Taksi durum sorgusu, AVM arama ve destek kaydı gibi araçlar tasarlanmalı | Orta-Yüksek |
| Test | Intent, fallback, kötüye kullanım, mobil ve kanal regresyon testleri yazılmalı | Yüksek |
| Ölçümleme | Çözüm oranı, devretme oranı, cevap kalitesi, gecikme ve maliyet izlenmeli | Orta |
| Çok kanal | WhatsApp, Telegram, sosyal medya DM ve Discord adaptörleri eklenmeli | Orta |

## Uygulama Fazları

### Faz 0: Netleştirme ve Envanter

Süre: 1-2 gün

- İlk kanal seçilir: öneri web chat.
- Botun cevaplayacağı ilk 30 soru belirlenir.
- İnsan devri yapılacak durumlar listelenir.
- Veri saklama ve kişisel veri kuralları netleştirilir.
- Sosyal medya ve mesajlaşma hesap envanteri çıkarılır.
- Bot kayıtlarının hangi panelde, hangi rolle ve hangi görünürlükle yönetileceği belirlenir.

Kabul kriteri: MVP kapsamı, cevap sınırları ve başarı metriği yazılıdır.

### Faz 1: Bilgi Tabanı ve Akış Tasarımı

Süre: 2-4 gün

- Hizmet, teklif, iletişim, taksi destek ve AVM rehber intentleri yazılır.
- Her intent için örnek kullanıcı cümleleri hazırlanır.
- SSS ve standart cevap metinleri oluşturulur.
- Fallback ve insan devri akışları tasarlanır.

Kabul kriteri: Bot en az 30 temel soruyu onaylı içerikle cevaplayabilir.

### Faz 2: Web Chat MVP

Süre: 4-7 gün

- Basit chat arayüzü ve backend endpoint kurulur.
- Konuşma kayıt modeli eklenir.
- Loglama, rate limit ve hata yönetimi uygulanır.
- Mobil görünüm 320px dahil test edilir.

Kabul kriteri: Web chat üzerinden hizmet/iletişim/destek akışı uçtan uca çalışır.

### Faz 3: AI Destekli Bilgi Cevaplama

Süre: 5-8 gün

- Mevcut proje dokümanları bilgi tabanına alınır.
- AI cevapları kaynaklı ve kontrollü hale getirilir.
- Araç çağırma sadece güvenli ve düşük riskli işlemler için açılır.
- Prompt injection, hassas veri ve yanlış cevap testleri yapılır.

Kabul kriteri: Bot onaylı dokümanlardan cevap verir, emin olmadığı yerde insan devrine gider.

### Faz 4: WhatsApp veya Telegram Kanalı

Süre: 4-8 gün

- Seçilen kanal için webhook doğrulama ve mesaj adaptörü yazılır.
- Kanal bazlı kullanıcı izinleri ve mesaj formatları ele alınır.
- Web botuyla aynı orkestratör kullanılır.
- Hata, tekrar deneme ve temsilci devri test edilir.

Kabul kriteri: Seçilen kanalda SSS, destek kaydı ve insan devri çalışır.

### Faz 5: Taksi ve AVM Araçları

Süre: 7-14 gün

- Taksi için yolculuk ID veya destek kategorisi bazlı sorgu akışı tasarlanır.
- AVM için şehir, AVM, mağaza, kampanya ve çalışma saati arama aracı hazırlanır.
- Maddi, güvenlik veya konum hassasiyetli işlemlerde insan onayı zorunlu tutulur.

Kabul kriteri: Bot modül bilgisi arayabilir, destek kaydı açabilir, riskli işlemi otomatik yapmaz.

### Faz 6: Operasyon ve Optimizasyon

Süre: Sürekli

- Günlük bot raporu oluşturulur.
- En çok sorulan sorular bilgi tabanına eklenir.
- Çözüm oranı ve devretme oranı izlenir.
- Sesli bot ve sosyal medya DM otomasyonu için pilot hazırlanır.

Kabul kriteri: Bot performansı haftalık ürün kararlarını etkileyen rapor üretir.

## İlk 14 Günlük İş Planı

| Gün | İş |
| --- | --- |
| 1 | MVP kanal kararı, hedef kullanıcı ve başarı metriği |
| 2 | İlk 30 soru, intent listesi ve insan devri kuralları |
| 3 | Hizmet/iletişim/teklif SSS metinleri |
| 4 | Taksi ve AVM için destek/rehber soru seti |
| 5 | Web chat arayüz ve backend teknik taslağı |
| 6 | Conversation veri modeli ve loglama planı |
| 7 | Güvenlik kontrolleri: secret, rate limit, veri maskeleme |
| 8 | Web chat MVP geliştirme başlangıcı |
| 9 | Bilgi tabanı indeksleme veya doküman arama denemesi |
| 10 | Fallback, insan devri, destek kaydı ve panel sahiplik modeli |
| 11 | Mobil görünüm ve erişilebilirlik kontrolü |
| 12 | Prompt injection, hassas veri ve yanlış cevap testleri |
| 13 | Pilot kullanıcı testi ve cevap düzeltmeleri |
| 14 | MVP kapanış raporu ve WhatsApp/Telegram faz kararları |

## Mobil Chat ve Yatay Modül Düzeni

Bot arayüzü mobilde yalnızca dikey mesaj yığını olmamalıdır. Hızlı seçim, öneri, kaynak, geçmiş ve destek aksiyonları yatay kaydırmalı şeritlerle desteklenmelidir:

| Alan | Mobil Düzen | Kontrol |
| --- | --- | --- |
| Hızlı başlangıç soruları | Yatay öneri chipleri | Hizmet, teklif, taksi destek ve AVM rehberi ilk seçeneklerde olmalı |
| Bot önerileri | Yatay cevap kartları | Kullanıcı tek dokunuşla önerilen aksiyona gidebilmeli |
| Hizmet yönlendirmeleri | Yatay hizmet kartları | Başlık, kısa açıklama ve CTA aynı kartta olmalı |
| Taksi destek seçenekleri | Yatay sorun kategori kartları | Ödeme, iptal, konum ve güvenlik seçenekleri ayrışmalı |
| AVM rehber sonuçları | Yatay AVM/mağaza/kampanya kartları | Ad, konum, durum ve detay CTA görünür olmalı |
| İnsan devri | Yatay destek aksiyonları | Temsilciye aktar, kayıt aç, iletişim bırak seçenekleri görünür olmalı |
| Görüşme geçmişi | Yatay oturum kartları veya kompakt liste | Son görüşme ilk sırada olmalı |
| Günlük bot raporu | Yatay metrik kartları | Toplam görüşme, çözülen, devredilen ve risk sayısı ayrışmalı |

Mobil kabul notları:

- Chat input alanı klavye açıldığında kapanmamalı ve gönder butonu görünür kalmalıdır.
- Hızlı öneriler ve modül sonuçları dikeyde uzun listeye dönüşmemeli; yatay şerit kullanılmalıdır.
- Mesaj balonları ekranı yatay taşırmamalı; uzun URL veya kod benzeri içerik satır kırmalıdır.
- Riskli işlem önerileri yatay kartta gösterilse bile insan onayı olmadan otomatik uygulanmamalıdır.
- Bot widget kapatılıp açıldığında mobilde aynı görüşme bağlamı korunmalıdır.

## Test Edilecek Kritik Akışlar

1. Kullanıcı hizmetleri sorar ve bot doğru hizmet yönlendirmesi yapar.
2. Kullanıcı teklif almak ister ve bot gerekli bilgileri toplayıp kayıt oluşturur.
3. Kullanıcı botun bilmediği bir soru sorar ve bot uydurmak yerine insan devrine gider.
4. Kullanıcı taksi yolculuğunda ödeme veya iptal sorunu bildirir ve bot önceliklendirme yapar.
5. Kullanıcı AVM, mağaza veya kampanya sorar ve bot mevcut bilgiyle rehberlik eder.
6. Kullanıcı kişisel veri paylaşır; bot gereksiz veriyi tekrar etmez ve loglarda maskeleme çalışır.
7. Kullanıcı kötü niyetli veya prompt injection benzeri mesaj gönderir; bot güvenlik sınırlarını korur.
8. Kullanıcı mobilde chat arayüzünü açar, yazar, kapatır ve tekrar devam eder.
9. Kanal webhook isteği geçersiz imza veya secret ile gelir ve sistem reddeder.
10. Bot cevap üretemezse hata kullanıcıya sade mesajla gösterilir ve kayıt açılır.

## Güvenlik ve Uyum Kriterleri

- API anahtarları ve kanal tokenları repoya yazılmamalı.
- Webhook istekleri kanalın desteklediği imza, secret veya header doğrulamasıyla kontrol edilmeli.
- Kullanıcı mesajları rate limit ve abuse monitoring ile korunmalı.
- Prompt ve tool çağrıları loglanmalı; token, parola, ödeme bilgisi ve hassas kişisel veri loglarda maskeleme görmeli.
- Bot yalnızca yetki verilen araçları çağırmalı.
- Riskli işlemlerde insan onayı veya temsilci devri zorunlu olmalı.
- LLM çıktısı doğrudan kod, SQL, HTML veya ödeme/hesap işlemi olarak kullanılmamalı.
- OWASP LLM riskleri özellikle prompt injection, sensitive information disclosure ve excessive agency açısından test edilmeli.

## Günlük Bot Raporu

| Alan | İçerik |
| --- | --- |
| Toplam görüşme | Gün içindeki conversation sayısı |
| Çözülen görüşme | Bot tarafından tamamlanan görüşmeler |
| İnsan devri | Temsilciye aktarılan görüşmeler |
| En çok sorulan konular | İlk 5 intent veya soru |
| Cevapsız sorular | Bilgi tabanına eklenmesi gereken açıklar |
| Kritik riskler | Güvenlik, yanlış cevap, kanal hatası veya kullanıcı şikayeti |
| Teknik durum | Hata sayısı, latency, rate limit, webhook başarısı |
| Ertesi gün aksiyonu | İçerik, teknik veya operasyon iyileştirme |

## Açık Riskler

| Risk | Etki | Öncelik | Aksiyon |
| --- | --- | --- | --- |
| Bot kapsamının belirsiz kalması | Yanlış beklenti ve dağınık geliştirme | Kritik | İlk kanal ve ilk 30 soru netleştirilmeli |
| Onaylı bilgi tabanı olmaması | Uydurma veya tutarsız cevap | Kritik | SSS ve hizmet kaynakları hazırlanmalı |
| İnsan devrinin olmaması | Kullanıcı sorunlarının çözümsüz kalması | Yüksek | Destek kuyruğu ve sahiplik modeli kurulmalı |
| Secret ve token sızıntısı | Hesap ve kanal güvenliği riski | Kritik | Secret manager ve repo taraması uygulanmalı |
| Riskli işlemde fazla otonomi | Yanlış iptal, iade veya kullanıcı zararı | Kritik | Tool izinleri ve insan onayı zorunlu olmalı |
| Sosyal medya hesabı erişimlerinin belirsizliği | DM/yorum otomasyonu başlatılamaz | Yüksek | Hesap envanteri ve MFA kontrolü yapılmalı |
| Test setinin eksikliği | Yanlış cevaplar canlıda fark edilir | Yüksek | Intent, güvenlik ve regresyon testleri yazılmalı |

## Kaynaklar

Yerel proje kaynakları:

- `Anasayfa ve Hizmetler.md`
- `Genel Güvenlik (Security).md`
- `Mobil Görünüm Sorumlusu.md`
- `Taksi Modülü Sorumlusu.md`
- `AVM Dünyası Modülü Sorumlusu.md`
- `Sosyal Medya Sorumlusu.md`
- `Admin Panel Sorumlusu.md`
- `Süper Admin Paneli Araştırma Raporu.md`
- `Partner Panel Sorumlusu.md`
- `User Panel Sorumlusu.md`
- `Günlük Geliştirme Motoru.md`

Resmi teknik kaynaklar:

- OpenAI Responses API: https://developers.openai.com/api/docs/guides/migrate-to-responses
- OpenAI Function Calling: https://developers.openai.com/api/docs/guides/function-calling
- OpenAI File Search: https://developers.openai.com/api/docs/guides/tools-file-search
- OpenAI Realtime and Audio: https://developers.openai.com/api/docs/guides/realtime
- WhatsApp Business Platform: https://whatsappbusiness.com/products/business-platform/
- Telegram Bot API: https://core.telegram.org/bots/api
- Discord Interactions Overview: https://docs.discord.com/developers/interactions/overview
- OWASP Top 10 for Large Language Model Applications: https://owasp.org/www-project-top-10-for-large-language-model-applications/
