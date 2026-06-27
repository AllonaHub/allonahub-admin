# AVM Dünyası Modülü Sorumlusu

Bu doküman ALLONAHUB proje yönetimi kapsamında AVM Dünyası modülünden sorumlu rolün kapsamını, operasyon alanlarını, teslim kriterlerini, kontrol listesini ve takip rutinlerini tanımlar.

## Amaç

- Kullanıcıların AVM, mağaza, kampanya, etkinlik ve hizmet bilgilerine hızlı ve güvenilir şekilde ulaşmasını sağlamak.
- AVM ziyaretini planlama, mağaza keşfi, yön bulma ve fırsat takip süreçlerini tek bir modül standardına bağlamak.
- AVM yönetimi, mağazalar, kullanıcılar ve operasyon ekibi için güncel, izlenebilir ve yönetilebilir bir yapı oluşturmak.
- AVM Dünyası modülüyle ilgili geliştirme, içerik, test, yayın ve operasyon kararlarını ortak kabul kriterlerine bağlamak.

## Kapsam

- AVM listeleme ve AVM detay sayfaları
- Mağaza, marka, kategori ve kat bilgileri
- Kampanya, indirim, kupon ve fırsat duyuruları
- Etkinlik, duyuru ve özel gün içerikleri
- AVM içi hizmetler: otopark, danışma, bebek bakım, mescit, engelli erişimi, vale, Wi-Fi, kayıp eşya
- Çalışma saatleri, iletişim, adres ve yol tarifi bilgileri
- AVM içi harita, kat planı ve mağaza yönlendirme akışları
- Favori AVM, favori mağaza ve bildirim tercihleri
- Yönetim paneli, içerik onayı, mağaza temsilcisi yetkileri ve raporlama
- Moderasyon, veri güncelliği, güvenlik ve kötüye kullanım kontrolleri

## Temel İlkeler

- AVM bilgileri kullanıcı için güncel, açık ve kolay taranabilir olmalıdır.
- Kampanya, etkinlik ve çalışma saati gibi zaman duyarlı içerikler yanlış veya eski bilgi göstermemelidir.
- Mağaza ve AVM bilgileri kullanıcıyı doğru aksiyona yönlendirmelidir: ara, yol tarifi al, kampanyayı incele, mağazayı bul.
- AVM içi harita ve kat bilgileri sade, mobilde okunabilir ve hataya dayanıklı olmalıdır.
- İçerik giriş, onay, yayın ve arşiv süreçleri yönetim panelinde izlenebilir olmalıdır.

## Ana Sorumluluklar

- AVM Dünyası modülünün kullanıcı, mağaza temsilcisi, AVM yönetimi ve yönetim paneli kapsamını takip etmek.
- AVM, mağaza, kampanya ve etkinlik veri alanlarının eksiksiz ve tutarlı olmasını sağlamak.
- Çalışma saatleri, geçici kapanış, özel gün saatleri ve etkinlik tarihleri gibi zaman duyarlı alanları kontrol etmek.
- Harita, kat planı, mağaza konumu ve yol tarifi deneyiminin kullanılabilirliğini denetlemek.
- Kampanya/kupon kurallarını, kullanım koşullarını, tarih aralıklarını ve görünürlük kurallarını netleştirmek.
- Bildirim, favori, arama, filtreleme ve kategori akışlarının kullanıcı ihtiyacına uygunluğunu kontrol etmek.
- İçerik onayı, moderasyon ve veri güncelleme sorumluluklarını operasyon ekibiyle birlikte takip etmek.
- Test senaryolarını, kabul kriterlerini ve yayın öncesi AVM Dünyası kontrol listesini güncel tutmak.

## AVM Dünyası Veri Alanları

| Alan | Açıklama | Kritik Kontrol |
| --- | --- | --- |
| AVM profili | AVM adı, açıklama, görsel, şehir, ilçe, adres | Eksik veya yanlış konum kullanıcıyı doğrudan etkiler |
| Çalışma saatleri | Normal, hafta sonu ve özel gün saatleri | Tarih bazlı istisnalar desteklenmeli |
| Mağaza profili | Marka adı, kategori, kat, mağaza no, iletişim | Mağaza durumu ve konumu güncel olmalı |
| Kampanya | Başlık, açıklama, görsel, tarih, koşullar | Süresi dolan kampanya görünmemeli |
| Kupon | Kod, kullanım limiti, hedef kullanıcı, geçerlilik | Tekrar kullanım ve stok kuralı net olmalı |
| Etkinlik | Tarih, saat, alan, katılım koşulu | Takvim ve bildirim akışı doğru çalışmalı |
| Hizmetler | Otopark, danışma, bebek bakım, mescit, Wi-Fi vb. | Erişilebilirlik ve konum bilgisi açık olmalı |
| Harita | Kat planı, mağaza pinleri, yönlendirme | Mobilde okunabilir ve yakınlaştırılabilir olmalı |
| Bildirim | Kampanya, etkinlik ve favori mağaza duyuruları | Kullanıcı izinleri ve tercihleri dikkate alınmalı |

## Kullanıcı Akışları

| Akış | Açıklama | Kritik Kontrol |
| --- | --- | --- |
| AVM keşfi | Kullanıcı şehir, yakınlık veya popülerliğe göre AVM bulur | Konum izni reddedilirse manuel şehir seçimi olmalı |
| AVM detayı | Kullanıcı AVM bilgilerini, mağazaları ve kampanyaları inceler | İçerikler kategorilere ayrılmış ve güncel olmalı |
| Mağaza arama | Kullanıcı marka, kategori veya kat bilgisiyle mağaza bulur | Arama sonuçları hızlı ve alakalı dönmeli |
| Kampanya inceleme | Kullanıcı kampanya koşullarını ve geçerlilik tarihini görür | Yanıltıcı veya süresi geçmiş kampanya gösterilmemeli |
| Kupon kullanımı | Kullanıcı kuponu kaydeder veya mağazada gösterir | Kullanım limiti ve geçerlilik kontrol edilmeli |
| Etkinlik takibi | Kullanıcı etkinliği inceler, hatırlatma veya katılım seçer | Tarih, saat ve lokasyon açık olmalı |
| AVM içi yön bulma | Kullanıcı mağaza veya hizmet noktasına yönlenir | Kat planı ve pin bilgileri doğru olmalı |
| Favoriler | Kullanıcı AVM veya mağazayı favoriler | Bildirim tercihleri yönetilebilir olmalı |

## AVM Dünyası Kontrol Listesi

| Alan | Kontrol | Durum | Not |
| --- | --- | --- | --- |
| AVM listeleme | Şehir, yakınlık, kategori veya popülerlik filtreleri çalışmalı | Beklemede | Konum izni yoksa manuel seçim desteklenmeli |
| AVM detayı | Adres, iletişim, çalışma saatleri ve hizmetler görünmeli | Beklemede | Özel gün saatleri ayrıca tanımlanmalı |
| Mağazalar | Marka, kategori, kat ve mağaza no bilgileri doğru olmalı | Beklemede | Kapalı veya taşınmış mağazalar arşivlenmeli |
| Arama | AVM, mağaza ve kategori araması hızlı çalışmalı | Beklemede | Yazım hatasına tolerans değerlendirilmeli |
| Filtreleme | Kategori, kat, kampanya ve hizmet filtreleri kullanılabilir olmalı | Beklemede | Mobilde filtre paneli taşmamalı |
| Kampanyalar | Tarih, koşul, görsel ve CTA bilgileri eksiksiz olmalı | Beklemede | Süresi biten kampanya otomatik pasifleşmeli |
| Kuponlar | Kullanım limiti, geçerlilik ve kullanıcı uygunluğu kontrol edilmeli | Beklemede | Kullanım sonrası durum güncellenmeli |
| Etkinlikler | Tarih, saat, lokasyon ve katılım bilgisi açık olmalı | Beklemede | Takvim hatırlatma opsiyonu değerlendirilmeli |
| Harita | Kat planı, pinler ve yakınlaştırma kullanılabilir olmalı | Beklemede | Harita yüklenemezse alternatif liste gösterilmeli |
| Bildirimler | Favori AVM, mağaza, kampanya ve etkinlik bildirimleri çalışmalı | Beklemede | Kullanıcı izin ve tercihleri dikkate alınmalı |
| Yönetim paneli | AVM, mağaza, kampanya ve etkinlik içerikleri yönetilebilmeli | Beklemede | Onay ve yayın durumu izlenmeli |
| Loglama | İçerik değişiklikleri ve kupon kullanımları kaydedilmeli | Beklemede | Kişisel veriler gereksiz loglanmamalı |

## Mobil Yatay Modül Düzeni

AVM Dünyası modülünde mobil görünüm keşif ve hızlı karar odaklı olmalıdır. Uzun liste ve yoğun içerik alanları aşağıdaki şekilde yatay kaydırmalı hale getirilmelidir:

| Alan | Mobil Düzen | Kontrol |
| --- | --- | --- |
| AVM listeleme | Yatay AVM kart şeridi veya kısa liste + yatay öneriler | Yakındaki ve favori AVM ilk kartlarda görünmeli |
| Kategori ve kat filtreleri | Yatay chip grubu | Filtreler iki-üç satır olup ekranı kapatmamalı |
| Mağaza listesi | Yatay mağaza kartları veya yatay kaydırmalı kompakt satırlar | Marka, kat ve yön bul CTA görünür olmalı |
| Kampanyalar | Yatay kampanya kart şeridi | Geçerlilik tarihi ve koşul kısa gösterilmeli |
| Kuponlar | Yatay kupon kartları | Kullan, kaydet ve süresi doldu durumları ayrışmalı |
| Etkinlikler | Yatay etkinlik takvimi/kartları | Tarih ve lokasyon ilk görünümde olmalı |
| Hizmetler | Yatay hizmet ikon şeridi | Otopark, danışma, Wi-Fi gibi hizmetler hızlı taranmalı |
| Harita ve kat planı | Tam genişlik harita + yatay kat seçici | Harita uzun kart listelerinin arasında kaybolmamalı |

Mobil kabul notları:

- AVM detayı tek uzun dikey katalog gibi davranmamalıdır.
- Kampanya, mağaza ve etkinlik içerikleri yatay şeritler halinde gruplandırılmalıdır.
- Harita, kat seçici ve yön bul aksiyonu küçük ekranda görünür ve dokunulabilir kalmalıdır.
- Süresi dolan kampanya veya kupon yatay şeritlerde aktif gibi gösterilmemelidir.
- Sayfa genelinde istemsiz yatay taşma olmamalı; kaydırma ilgili modül şeridiyle sınırlı kalmalıdır.

## Test Edilecek Kritik Akışlar

1. Kullanıcı konum izni vererek yakındaki AVM listesini görür.
2. Kullanıcı konum izni vermeden şehir seçerek AVM arar.
3. Kullanıcı AVM detayında çalışma saatleri, adres, hizmetler ve mağaza listesini inceler.
4. Kullanıcı mağaza arar, kategori filtresi uygular ve mağaza detayına gider.
5. Kullanıcı mağazanın AVM içindeki kat ve konum bilgisini görüntüler.
6. Kullanıcı aktif kampanyayı inceler ve kampanya koşullarını görür.
7. Kullanıcı kuponu kaydeder, kullanım ekranını açar ve kullanım sonrası durum değişir.
8. Kullanıcı etkinliği inceler ve hatırlatma bildirimi tercih eder.
9. Kullanıcı favori AVM veya mağaza ekler ve bildirim tercihlerini günceller.
10. Süresi bitmiş kampanya kullanıcı ekranından otomatik kaldırılır.
11. Yönetim panelinde yeni kampanya oluşturulur, onaya gönderilir ve yayınlanır.
12. Harita yüklenemediğinde kullanıcı mağaza bilgilerine liste üzerinden ulaşır.

## Önceliklendirme

| Öncelik | Tanım | Örnek |
| --- | --- | --- |
| Kritik | Kullanıcının AVM, mağaza, kampanya veya kupon akışını tamamlamasını engelleyen hata | Aktif kuponun kullanılamaması veya yanlış AVM adresi gösterilmesi |
| Yüksek | Kullanıcı güvenini veya operasyon doğruluğunu ciddi biçimde bozan hata | Süresi geçmiş kampanyanın aktif görünmesi |
| Orta | Deneyimi bozan ama ana akışı tamamen durdurmayan sorun | Kat filtresinin geç tepki vermesi |
| Düşük | Kozmetik veya nadir görülen sorun | Mağaza kartında küçük hizalama farkı |

## Yayın Öncesi Kabul Kriterleri

- AVM listeleme, AVM detay, mağaza arama ve mağaza detay akışları uçtan uca test edilmiştir.
- AVM çalışma saatleri, özel gün saatleri, adres, iletişim ve yol tarifi bilgileri doğrulanmıştır.
- Kampanya ve etkinlik içerikleri tarih aralığına göre doğru görünmektedir.
- Kupon kullanım, limit, geçerlilik ve durum güncelleme senaryoları test edilmiştir.
- Harita, kat planı, mağaza pinleri ve alternatif liste deneyimi mobilde kontrol edilmiştir.
- Favori AVM, favori mağaza ve bildirim tercihleri kullanıcı izinlerine uygun çalışmaktadır.
- Yönetim panelinde içerik oluşturma, düzenleme, onaylama, yayınlama ve arşivleme akışları tamamlanmıştır.
- Kritik ve yüksek öncelikli AVM Dünyası hataları kapatılmıştır.
- Kullanıcıya eski, yanlış veya yanıltıcı kampanya/etkinlik bilgisi gösterilmediği doğrulanmıştır.

## Çalışan Modül Dosyaları

27 Haziran 2026 itibarıyla AVM Dünyası için bağımsız çalışan statik modül klasörü oluşturuldu: `avm-dunyasi-modulu/`.

| Dosya | Amaç |
| --- | --- |
| `avm-dunyasi-modulu/index.html` | Kullanıcı tarafı AVM keşfi, mağaza/restoran rehberi, kampanya, kupon, değerlendirme ve yatay shop vitrini |
| `avm-dunyasi-modulu/shop.html` | Trendyol/Hepsiburada benzeri kategori menüsü ve ürün katalog ekranı |
| `avm-dunyasi-modulu/partner.html` | AVM partneri için onboarding, profil, mağaza, restoran, ürün, kampanya, onay, rapor ve destek bölümleri |
| `avm-dunyasi-modulu/admin.html` | AVM sorumlusunun AVM, mağaza, işletme, restoran, ürün, kampanya, kupon, etkinlik, harita, sipariş, değerlendirme ve onay kuyruğunu yönettiği admin paneli |
| `avm-dunyasi-modulu/assets/js/data.js` | Public kaynaklı AVM isimleri seed dizini, örnek mağazalar, restoranlar, ürünler ve kampanya verileri |
| `avm-dunyasi-modulu/assets/js/shop-categories.js` | Shop kategori navigasyonu, kategori kırılımı, ürün grid ve arama deneyimi |
| `avm-dunyasi-modulu/assets/js/supabase-client.js` | Supabase bağlantısı varsa canlı tablolardan okuyan, yoksa seed veriyle çalışan veri adaptörü |
| `avm-dunyasi-modulu/supabase/schema.sql` | Canlı Supabase kurulumu için tablo, RLS, admin ve partner sahiplik politikaları |

## AVM Admin Paneli Kapsamı

Admin paneli AVM sorumlusunun seçili AVM içindeki tüm yönetim alanlarını tek yerden takip etmesi için tasarlandı:

- AVM profili, adres, iletişim, çalışma saati ve yayın doğruluğu
- Mağaza, işletme ve restoran kayıtları
- Ürün yönetimi, fiyat, stok, görsel, değerlendirme ve shop vitrini
- Kampanya, kupon, etkinlik ve duyuru yönetimi
- Kat planı, mağaza pinleri ve alternatif liste kontrolleri
- Değerlendirme moderasyonu
- Sipariş, rezervasyon, sepete ekle ve hemen al izleme
- İçerik onay kuyruğu, revizyon, yayın ve arşiv akışı
- Audit log, CSV dışa aktarma ve Supabase bağlantı ayarları

## Supabase ve Shop Notu

- Supabase bağlantısı admin panelindeki `Ayarlar` sekmesinden Project URL ve anon key ile verilebilir.
- Canlı bağlantı yokken modül seed veriyle çalışır; bağlantı verildiğinde `malls`, `stores`, `products`, `campaigns`, `coupons`, `events` ve `reviews` tabloları okunur.
- Ürünler seçili AVM'ye göre yatay kaydırmalı vitrinde fiyat, değerlendirme, `Sepete Ekle` ve `Hemen Al` butonlarıyla gösterilir.
- Ürün görselleri canlı sistemde Supabase Storage public URL veya güvenli signed URL üzerinden gelmelidir.
- Public kaynaklı AVM isimleri seed başlangıç verisidir; resmi partner onboarding sonrası `verification_status` alanıyla doğrulanmalıdır.

## Periyodik Kontroller

| Sıklık | Kontrol |
| --- | --- |
| Her geliştirme tamamlandığında | İlgili AVM, mağaza, kampanya veya etkinlik akışı test edilir |
| Günlük | Aktif kampanya, etkinlik ve kupon tarihleri kontrol edilir |
| Haftalık | Mağaza listesi, çalışma saatleri, kapalı/taşınmış mağazalar ve hizmet bilgileri gözden geçirilir |
| Sprint sonunda | AVM listeleme, mağaza arama, kampanya, kupon ve yönetim paneli regresyon testleri yapılır |
| Yayın öncesi | Kabul kriterleri ve canlı veri kontrolleri tamamlanır |
| Aylık | En çok görüntülenen AVM, mağaza, kampanya ve kupon performansı raporlanır |

## İletişim ve Raporlama

- AVM Dünyası bulguları AVM adı, mağaza adı, şehir, cihaz, ekran, adım, beklenen davranış ve mevcut davranışla raporlanmalıdır.
- Kampanya, kupon, çalışma saati ve adres hataları yüksek öncelikle ele alınmalıdır.
- Mağaza bilgisi uyuşmazlıklarında AVM yönetimi veya mağaza temsilcisiyle doğrulama yapılmalıdır.
- Teknik hatalarda log, zaman damgası, API cevabı ve ekran görüntüsü birlikte paylaşılmalıdır.
- Kullanıcı etkisi olan sorunlarda destek ekibi için kısa ve net açıklama metni oluşturulmalıdır.

## Sorumluluk Matrisi

| Rol | Sorumluluk |
| --- | --- |
| AVM Dünyası modülü sorumlusu | Modül kapsamını, iş kurallarını, test senaryolarını ve yayın uygunluğunu takip eder |
| Ürün ekibi | Kullanıcı, AVM yönetimi ve mağaza ihtiyaçlarını önceliklendirir |
| İçerik ekibi | AVM, mağaza, kampanya, etkinlik ve hizmet içeriklerini hazırlar |
| Tasarım ekibi | AVM keşfi, mağaza kartları, kampanya ekranları, harita ve mobil deneyimi tasarlar |
| Geliştirme ekibi | Arama, filtreleme, harita, kupon, bildirim ve yönetim paneli özelliklerini uygular |
| QA ekibi | Uçtan uca AVM, mağaza, kampanya, kupon, bildirim ve regresyon testlerini yapar |
| Operasyon ekibi | Canlı içerik doğruluğunu, mağaza değişikliklerini ve destek kayıtlarını takip eder |
| Teknik lider | Mimari, performans, veri güvenliği ve yayın uygunluğunu onaylar |

## Açık Riskler

| Risk | Etki | Olasılık | Öncelik | Aksiyon |
| --- | --- | --- | --- | --- |
| AVM veya mağaza bilgisinin güncel olmaması | Yüksek | Orta | Yüksek | Haftalık veri doğrulama ve içerik sahibi atanmalı |
| Süresi geçmiş kampanyanın aktif görünmesi | Yüksek | Orta | Kritik | Tarih bazlı otomatik pasifleştirme ve günlük kontrol eklenmeli |
| Kupon kullanım limitinin hatalı yönetilmesi | Yüksek | Düşük-Orta | Kritik | Kullanım durumu atomik kaydedilmeli ve test edilmeli |
| Harita veya kat planının yanlış yönlendirmesi | Orta-Yüksek | Orta | Yüksek | AVM bazlı harita doğrulama ve alternatif liste akışı hazırlanmalı |
| Bildirimlerin kullanıcı tercihini ihlal etmesi | Orta | Düşük-Orta | Yüksek | İzin, tercih ve abonelik kontrolleri merkezi yönetilmeli |
| Yönetim panelinde yetki sınırlarının belirsiz olması | Yüksek | Orta | Kritik | Rol bazlı yetki ve içerik onay akışı tanımlanmalı |

## Teslim Çıktıları

- AVM Dünyası modülü iş kuralları ve veri alanları
- AVM, mağaza, kampanya, kupon, etkinlik ve harita test senaryoları
- Yönetim paneli içerik onay ve yayın akışı
- Çalışma saatleri, kampanya tarihi ve kupon geçerlilik kontrol notları
- Yayın öncesi AVM Dünyası kontrol listesi sonucu
- Önceliklendirilmiş AVM Dünyası hata ve risk listesi
