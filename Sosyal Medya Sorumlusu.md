# Sosyal Medya Sorumlusu

Bu doküman ALLONAHUB sosyal medya yönetiminin mevcut durumunu, eksiklerini, günlük operasyon düzenini ve otomatik ürün paylaşımına giden uygulama rotasını tanımlar.

## Mevcut Repo Bulgusu

27 Haziran 2026 itibarıyla yerel Git deposu incelendi.

| Alan | Durum | Not |
| --- | --- | --- |
| Git remote | Yok | Depo şu an GitHub remote adresine bağlı görünmüyor. |
| Takip edilen dosya | Yok | `git ls-files` boş döndü. |
| Mevcut proje dosyaları | Var | Anasayfa, mobil görünüm, güvenlik ve günlük geliştirme dokümanları var. |
| Sosyal medya dokümanı | Eksikti | Bu dosya ile rol, kapsam ve rota tanımlandı. |
| Sosyal medya hesap linkleri | Yok | Instagram, Facebook, TikTok, LinkedIn, X, Pinterest veya YouTube linki bulunamadı. |
| Sosyal paylaşım bileşeni | Yok | Site kodu veya footer/header sosyal ikon yapısı bu çalışma klasöründe bulunamadı. |
| Open Graph / sosyal SEO | Kısmen ihtiyaç olarak geçiyor | Anasayfa dokümanında meta açıklama ve SEO gereksinimi var; sosyal paylaşım meta alanları tanımlı değil. |
| Ürün veri kaynağı | Yok | Ürün listesi, stok, fiyat, görsel URL, kategori ve ürün linki kaynağı bulunamadı. |
| Otomasyon altyapısı | Yok | Cron, queue, scheduler, webhook veya sosyal medya API entegrasyonu yok. |
| İçerik takvimi | Yok | Günlük/haftalık paylaşım planı ve kampanya akışı tanımlı değil. |
| Marka dili | Kısmen var | Anasayfa dokümanı sade, güven veren, kullanıcı odaklı dil istiyor. |

## Öncelikli Sonuç

Sosyal medya tarafında şu anda strateji, hesap envanteri, site bağlantıları, ürün feed'i, otomatik paylaşım altyapısı ve ölçümleme eksik. Buna karşılık anasayfa, hizmetler, mobil kalite, güvenlik ve günlük geliştirme dokümanları sosyal medya çalışmasını bağlayacağımız iyi bir temel veriyor.

## Sosyal Medyada Neyimiz Var

- ALLONAHUB marka adı ve hizmet odaklı değer önerisi temeli.
- Anasayfa ve hizmetler için kullanıcı odaklı içerik kriterleri.
- Mobil görünüm kalite standardı.
- Güvenlikte secret, API anahtarı, MFA ve erişim prensipleri.
- Günlük geliştirme ve raporlama ritmi.

## Sosyal Medyada Neyimiz Yok

- Resmi sosyal medya hesap listesi.
- Site üzerinde sosyal medya ikonları ve bağlantıları.
- Sosyal paylaşım önizlemeleri için Open Graph ve Twitter/X Card standardı.
- Ürün veya hizmet görsel standardı.
- Ürün feed'i veya katalog veri modeli.
- Günlük paylaşım takvimi.
- İçerik onay süreci.
- Otomatik paylaşım sistemi.
- Platform API anahtarları ve token yenileme süreci.
- Analytics, UTM, dönüşüm ve raporlama düzeni.
- Kriz, yorum, DM ve topluluk yönetimi kılavuzu.

## Hedef Sosyal Medya Kanalları

| Kanal | Rol | Öncelik | Otomasyon Yaklaşımı |
| --- | --- | --- | --- |
| Instagram | Görsel ürün/hizmet vitrini, Reels ve güven inşası | Kritik | Instagram Graph API ile işletme hesabından içerik yayınlama |
| Facebook | Sayfa paylaşımı, yerel güven, katalog ve reklam altyapısı | Yüksek | Pages API ve Meta katalog entegrasyonu |
| TikTok | Kısa video, ürün kullanımı, trend içerik | Orta | Content Posting API; video/foto içerik için ayrı onay akışı |
| LinkedIn | Kurumsal güven, B2B hizmet ve iş ortaklığı | Orta | LinkedIn Posts API ile organik gönderi |
| Pinterest | Ürün keşfi ve görsel trafik | Düşük-Orta | Pin oluşturma API'si; ürün kategorisi uygunsa öncelik artırılır |
| X | Duyuru, hızlı güncelleme, kampanya | Düşük | X API ile metin/görsel post; ücret ve kota koşulları ayrıca doğrulanmalı |
| YouTube Shorts | Video içerik arşivi ve arama görünürlüğü | Düşük-Orta | YouTube Data API ile video yükleme; video üretim kapasitesine bağlı |

## Günlük İçerik Ritmi

| Günlük Slot | İçerik Türü | Amaç |
| --- | --- | --- |
| Sabah | Günün ürünü veya hizmeti | Trafik ve keşif |
| Öğle | Fayda, kullanım senaryosu veya kısa ipucu | Eğitim ve güven |
| Akşam | Sosyal kanıt, kampanya veya soru-cevap | Etkileşim ve dönüşüm |

Minimum sürdürülebilir başlangıç: Her gün 1 ürün/hizmet paylaşımı. Haftalık hedef: 5 ürün/hizmet, 1 güven içeriği, 1 etkileşim içeriği.

## Mobil Yatay Modül Düzeni

Sosyal medya operasyon ekranları mobilde kanal, takvim ve rapor yoğunluğu nedeniyle dikeyde hızla uzayabilir. Aşağıdaki alanlar yatay kaydırmalı modül şeritleriyle tasarlanmalıdır:

| Alan | Mobil Düzen | Kontrol |
| --- | --- | --- |
| Hedef kanallar | Yatay platform kartları | Öncelik, otomasyon durumu ve hesap bağlantısı görünmeli |
| Günlük içerik ritmi | Yatay zaman slotu kartları | Sabah, öğle, akşam kartları tek satır şerit olmalı |
| Ürün paylaşım taslakları | Yatay taslak kartları | Ürün, platform, görsel ve onay durumu görünmeli |
| İçerik takvimi | Yatay gün kartları | 7 günlük plan mobilde tek uzun tablo olmamalı |
| Onay kuyruğu | Yatay onay kartları | Onayla, düzenle, reddet aksiyonları erişilebilir olmalı |
| Platform API durumları | Yatay durum kartları veya tablo sarmalayıcı | Token ve izin hataları kritik olarak ayrışmalı |
| Günlük rapor | Yatay metrik kartları | Yayın, trafik, etkileşim ve dönüşüm ayrı kartlarda olmalı |

Mobil kabul notları:

- Platform listeleri ve içerik takvimi tek uzun dikey tabloya dönüşmemelidir.
- Her platform kartında bağlantı durumu, son yayın ve kritik hata bilgisi kısa gösterilmelidir.
- İçerik onay aksiyonları mobilde tek dokunuşla erişilebilir olmalıdır.
- Görsel önizlemeleri küçük ekranda anlamını kaybetmeyecek oranlarda sunulmalıdır.
- Sayfa genelinde istemsiz yatay taşma olmamalı; kaydırma sadece modül şeridi içinde kalmalıdır.

## Ürün Paylaşımı İçin Zorunlu Veri Modeli

Otomatik paylaşım başlamadan önce her ürün veya hizmet için aşağıdaki alanlar hazırlanmalı:

| Alan | Zorunlu | Açıklama |
| --- | --- | --- |
| `id` | Evet | Benzersiz ürün/hizmet kodu |
| `title` | Evet | Kısa ve net başlık |
| `description` | Evet | 1-3 cümlelik fayda açıklaması |
| `category` | Evet | Ürün/hizmet kategorisi |
| `price` | Ürüne bağlı | Fiyat gösterilecekse güncel olmalı |
| `currency` | Ürüne bağlı | TRY, USD vb. |
| `availability` | Ürüne bağlı | Stokta, tükendi, ön sipariş |
| `image_url` | Evet | Dışarıdan erişilebilir, kaliteli görsel URL |
| `product_url` | Evet | Site üzerindeki ürün/hizmet sayfası |
| `alt_text` | Evet | Erişilebilirlik ve sosyal önizleme için açıklama |
| `hashtags` | Evet | Marka, kategori ve niş etiketler |
| `cta` | Evet | İncele, teklif al, iletişime geç gibi aksiyon |
| `publish_priority` | Evet | 1-5 arası paylaşım önceliği |
| `last_published_at` | Hayır | Tekrar paylaşımı önlemek için |

## Sosyal Paylaşım Şablonu

```text
{title}

{description}

{cta}: {product_url}?utm_source={platform}&utm_medium=social&utm_campaign=daily_product

{hashtags}
```

## Otomatik Paylaşım Mimarisi

| Katman | Görev | Gereksinim |
| --- | --- | --- |
| Ürün kaynağı | Paylaşılabilir ürünleri sağlar | CMS, JSON, veritabanı veya e-ticaret API'si |
| İçerik üretici | Başlık, açıklama, hashtag ve CTA üretir | Marka dili kuralları ve karakter limitleri |
| Görsel hazırlayıcı | Platforma uygun görsel/video üretir | Kare, dikey, story/reel oranları |
| Onay kuyruğu | Otomatik içeriği insan onayına sunar | İlk aşamada zorunlu |
| Zamanlayıcı | Günlük paylaşım saatini yönetir | Cron, GitHub Actions, server cron veya queue worker |
| Yayınlayıcı | Platform API'lerine gönderir | Token, izin, hata yönetimi |
| Log ve rapor | Başarı, hata ve performansı kaydeder | Günlük rapor ve tekrar deneme |

## Platform API Notları

- Instagram içerik yayınlama için Meta'nın Instagram Content Publishing API akışı kullanılmalı. İşletme veya creator hesabı, Facebook Page bağlantısı ve gerekli izinler gerekir.
- Facebook sayfa gönderileri için Meta Pages API kullanılmalı.
- Meta katalog ve ürün reklamları için Product Catalog yapısı ayrıca kurulmalı; bu organik günlük paylaşımı destekleyen ayrı ama tamamlayıcı bir katmandır.
- TikTok doğrudan gönderim için Content Posting API kullanılabilir; uygulama onayı, creator bilgisi sorgusu ve medya URL koşulları dikkate alınmalı.
- LinkedIn organik gönderiler için Posts API kullanılabilir; görsel gönderilerde önce medya varlığı yüklenir, sonra gönderiye bağlanır.
- X üzerinde post oluşturma ve medya yükleme X API ile yapılır; erişim planı, kota ve maliyet koşulları işe başlamadan doğrulanmalı.
- Pinterest için Create Pin endpoint'i kullanılabilir; pano yapısı ve ürün kategorileri önceden planlanmalı.
- YouTube için video yükleme YouTube Data API `videos.insert` ile yapılır; Shorts ancak video üretim süreci oturduktan sonra devreye alınmalı.

## Güvenlik Gereksinimleri

- API anahtarları, access token ve refresh token değerleri repoya yazılmamalı.
- Platform hesaplarında MFA zorunlu olmalı.
- Her platform için ayrı servis hesabı veya uygulama sahibi tanımlanmalı.
- Token yenileme, iptal ve erişim kaybı senaryosu dokümante edilmeli.
- Yayıncı servis sadece paylaşım için gerekli minimum izinlere sahip olmalı.
- Loglarda token, müşteri verisi veya gizli kampanya bilgisi tutulmamalı.

## Uygulama Rotası

### Faz 1: Envanter ve Temel Kurulum

Süre: 1-2 gün

- Resmi sosyal medya hesapları açılır veya mevcut hesaplar doğrulanır.
- Kullanıcı adları, profil fotoğrafı, bio, web sitesi linki ve iletişim bilgileri standartlaştırılır.
- Site footer/header için sosyal medya bağlantı listesi hazırlanır.
- Marka dili, yasaklı kelimeler, CTA listesi ve hashtag havuzu oluşturulur.
- Ürün/hizmet listesinin nereden besleneceği netleştirilir.

Kabul kriteri: Tüm hesaplar listelenmiş, sahipleri belli, MFA açık ve siteye eklenecek bağlantılar hazır.

### Faz 2: Site Sosyal Medya Hazırlığı

Süre: 2-4 gün

- Open Graph ve Twitter/X Card meta alanları tanımlanır.
- Her ürün/hizmet sayfasında paylaşılabilir başlık, açıklama ve görsel olur.
- UTM standardı belirlenir.
- Sosyal ikonlar erişilebilir etiketlerle header/footer alanına eklenir.
- Ürün görselleri mobilde ve sosyal önizlemede test edilir.

Kabul kriteri: Site linki paylaşıldığında doğru başlık, açıklama ve görsel görünür.

### Faz 3: Ürün Feed'i ve İçerik Takvimi

Süre: 3-5 gün

- Ürün/hizmet veri modeli uygulanır.
- Günlük paylaşım için uygun ürün seçme kuralı yazılır.
- Aynı ürünün çok sık tekrar edilmesini engelleyen `last_published_at` takibi eklenir.
- Haftalık içerik takvimi oluşturulur.
- Manuel onay paneli veya onay dosyası hazırlanır.

Kabul kriteri: Sistem her gün paylaşılacak tek ürünü seçebilir ve platform bazlı metin taslağı üretebilir.

### Faz 4: Yarı Otomatik Yayın

Süre: 5-8 gün

- Instagram ve Facebook ilk öncelikli platform olur.
- Paylaşım taslağı otomatik üretilir.
- İnsan onayı sonrası yayın yapılır.
- Hatalar ve platform cevapları loglanır.
- Gün sonu sosyal medya raporu hazırlanır.

Kabul kriteri: En az 5 gün üst üste günlük ürün paylaşımı manuel onayla sorunsuz yayınlanır.

### Faz 5: Tam Otomatik Günlük Ürün Paylaşımı

Süre: 5-10 gün

- Zamanlayıcı her gün belirlenen saatte çalışır.
- Ürün seçimi, metin üretimi, görsel kontrolü ve yayın otomatik yapılır.
- Hata durumunda tekrar deneme ve bildirim akışı çalışır.
- Stokta olmayan veya görseli eksik ürün paylaşılmaz.
- Günlük raporda yayın linki, durum, hata ve temel metrikler yer alır.

Kabul kriteri: Sistem 7 gün boyunca her gün en az 1 ürünü otomatik yayınlar ve raporlar.

### Faz 6: Ölçümleme ve Optimizasyon

Süre: Sürekli

- Platform bazlı erişim, tıklama, etkileşim ve dönüşüm izlenir.
- En iyi çalışan kategori, saat, hashtag ve görsel türleri raporlanır.
- Düşük performanslı içerikler için açıklama, görsel ve CTA test edilir.
- Reklam bütçesi açılacaksa Meta katalog ve piksel/veri seti kurulumu yapılır.

Kabul kriteri: Haftalık sosyal medya raporu içerik kararlarını etkileyen net öneriler üretir.

## İlk 14 Günlük İş Planı

| Gün | İş |
| --- | --- |
| 1 | Sosyal hesap envanteri, erişim sahipleri ve MFA kontrolü |
| 2 | Bio, profil, kapak, link ve marka dili standardı |
| 3 | Ürün/hizmet veri modelinin kesinleşmesi |
| 4 | Hashtag, CTA ve içerik şablonlarının hazırlanması |
| 5 | Open Graph, sosyal önizleme ve UTM standardı görevi |
| 6 | İlk 7 günlük içerik takvimi |
| 7 | İlk manuel ürün paylaşımı ve rapor |
| 8 | Ürün seçme kuralı ve tekrar paylaşım engeli |
| 9 | Instagram/Facebook API başvuru ve izin kontrolü |
| 10 | Yarı otomatik taslak üretimi |
| 11 | Onay akışı ve hata logları |
| 12 | 3 günlük pilot yayın |
| 13 | Pilot sonuç analizi ve düzeltmeler |
| 14 | Tam otomasyon için teknik görevlerin kilitlenmesi |

## Günlük Sosyal Medya Raporu

| Alan | İçerik |
| --- | --- |
| Bugün yayınlanan içerik | Platform, link ve ürün/hizmet adı |
| Yayın durumu | Başarılı, beklemede, hata |
| Etkileşim | Beğeni, yorum, paylaşım, kayıt, görüntülenme |
| Trafik | UTM tıklamaları ve site oturumları |
| Dönüşüm | Form, teklif, sepet, satış veya iletişim |
| Yorum/DM | Cevaplanan ve açık kalan kullanıcı mesajları |
| Öğrenim | Ertesi gün uygulanacak iyileştirme |

## Kritik Riskler

| Risk | Etki | Öncelik | Aksiyon |
| --- | --- | --- | --- |
| GitHub remote olmaması | Gerçek GitHub içeriği görülemeyebilir | Kritik | Remote eklenmeli veya GitHub repo linki paylaşılmalı |
| Ürün feed'i olmaması | Otomatik paylaşım yapılamaz | Kritik | Ürün/hizmet veri modeli uygulanmalı |
| API izinlerinin alınmaması | Otomatik yayın durur | Kritik | Meta, TikTok, LinkedIn vb. geliştirici başvuruları erken başlatılmalı |
| Görsel standardının olmaması | Paylaşım kalitesi düşer | Yüksek | Platform bazlı görsel ölçüleri ve şablonlar hazırlanmalı |
| İnsan onayı olmadan erken otomasyon | Hatalı veya yanlış ürün paylaşımı | Yüksek | İlk pilot yarı otomatik yapılmalı |
| Tokenların repoya yazılması | Hesap güvenliği riski | Kritik | Secret manager veya güvenli environment kullanılmalı |

## Kaynaklar

- Meta Instagram Content Publishing: https://developers.facebook.com/docs/instagram-platform/content-publishing
- Meta Pages API: https://developers.facebook.com/docs/pages-api/
- Meta Product Catalog: https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-catalog
- TikTok Content Posting API: https://developers.tiktok.com/doc/content-posting-api-get-started
- LinkedIn Posts API: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- X Create Post API: https://docs.x.com/x-api/posts/create-post
- Pinterest Create Pin API: https://developers.pinterest.com/docs/api/v5/pins-create/
- YouTube videos.insert: https://developers.google.com/youtube/v3/docs/videos/insert
