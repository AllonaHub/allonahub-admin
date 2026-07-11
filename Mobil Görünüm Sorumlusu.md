# Mobil Görünüm Sorumlusu

Bu doküman ALLONAHUB proje yönetimi kapsamında mobil görünüm kalitesinden sorumlu rolün kapsamını, kontrol alanlarını, teslim kriterlerini ve takip rutinlerini tanımlar.

## Amaç

- Mobil kullanıcı deneyiminin tüm kritik ekranlarda tutarlı, hızlı ve erişilebilir olmasını sağlamak.
- Tasarım, geliştirme ve test süreçlerinde mobil öncelikli kalite standardı oluşturmak.
- Mobil görünüm kaynaklı kullanılabilirlik, dönüşüm ve performans risklerini erken tespit etmek.

## Kapsam

- Mobil web ve responsive arayüzler
- Giriş, kayıt, ana sayfa, listeleme, detay, sepet, ödeme, profil ve yönetim akışları
- Telefon ve tablet kırılımları
- Farklı tarayıcılar, işletim sistemleri ve ekran yoğunlukları
- Mobil performans, erişilebilirlik ve dokunmatik kullanım kontrolleri

## Temel İlkeler

- Mobil görünüm sonradan uyarlama değil, tasarım ve geliştirme sürecinin temel parçasıdır.
- Kritik kullanıcı akışları önce küçük ekranlarda doğrulanır.
- Dokunmatik kullanım, okunabilirlik ve performans mobil kalitenin ana ölçütleridir.
- Mobil hatalar sadece görsel kusur olarak değil, kullanıcı kaybı riski olarak değerlendirilir.
- Her yeni özellik mobil kırılımlarda test edilmeden tamamlanmış kabul edilmez.

## Ana Sorumluluklar

- Mobil ekran kırılımlarını ve responsive davranışları düzenli kontrol etmek.
- Tasarım dosyaları, geliştirme çıktıları ve canlı ortam arasında mobil tutarlılığı denetlemek.
- Mobil cihazlarda taşma, üst üste binme, okunamayan metin, küçük dokunma alanı ve kaydırma problemlerini tespit etmek.
- Uzun dikey modül içeriklerini mobilde yatay kaydırmalı, kontrollü ve dokunmatik kullanıma uygun şeritlere dönüştürmek.
- Geliştirme ekibiyle birlikte mobil görünüm hatalarının önceliğini belirlemek.
- Kritik akışlar için mobil kabul kriterlerini netleştirmek.
- Mobil performans ve erişilebilirlik risklerini takip etmek.
- Yayın öncesi mobil kontrol listesini tamamlamak ve sonucu proje ekibiyle paylaşmak.

## Zorunlu Mobil Modül Standardı

Tüm ALLONAHUB modüllerinde mobil görünüm için aşağıdaki standart uygulanmalıdır:

- Sayfa genelinde istemsiz yatay taşma olmamalıdır.
- Uzun liste, kart, tablo, rapor, kategori, kampanya, kayıt, akış ve durum alanları mobilde dikey yığılmak yerine yatay kaydırmalı modül şeridi olarak tasarlanmalıdır.
- Yatay modül şeritleri dokunmatik kaydırmaya uygun, görünür başlangıç ve bitiş boşluklarına sahip olmalıdır.
- Kart genişlikleri küçük ekranda sabit ve tahmin edilebilir olmalıdır; kartlar içerik uzadığında büyüyerek düzeni bozmamalıdır.
- Her yatay şerit kendi içinde başlık, kısa durum bilgisi ve ana aksiyon taşımalıdır.
- Yatay kaydırma sadece ilgili modül içinde olmalı; tüm sayfayı yatay kaydırmaya zorlamamalıdır.
- Kullanıcı dikey sayfada önce kritik aksiyonu görmeli, detay ve yoğun içerik yatay şeritlerde keşfedilmelidir.
- Klavye, ekran okuyucu ve dokunmatik kullanımda yatay şerit elemanları sırayla erişilebilir olmalıdır.

## Uzun Dikey İçerik Dönüşüm Kuralı

Mobilde aşağıdaki yapılar uzun dikey blok olarak bırakılmamalıdır:

| İçerik Tipi | Mobil Davranış | Not |
| --- | --- | --- |
| Hizmet, ürün, AVM, mağaza ve kampanya kartları | Yatay kaydırmalı kart şeridi | Kartlar karşılaştırılabilir boyutta olmalı |
| Durum adımları ve süreç akışları | Yatay stepper veya durum şeridi | Aktif adım görünür olmalı |
| Rapor, kayıt ve geçmiş listeleri | Yatay kart şeridi veya tablo sarmalayıcı | Kritik kolonlar ilk görünümde kalmalı |
| Filtre ve kategori seçenekleri | Yatay chip grubu | Çok satıra taşarak ekranı uzatmamalı |
| Yönetim paneli metrikleri | Yatay KPI kart şeridi | En önemli metrik ilk kart olmalı |
| Uzun tablolar | Kendi içinde yatay kaydırmalı tablo | Sayfa genelinde taşma oluşturmamalı |
| Çok adımlı formlar | Bölümlenmiş akış veya yatay sekmeler | Form alanlarının kendisi okunabilir dikey sırada kalmalı |

## Modül Bazlı Mobil Denetim Sonucu

| Modül | Tespit | Düzeltme Standardı |
| --- | --- | --- |
| Anasayfa ve Hizmetler | Hizmet, güven unsuru, süreç ve SSS alanları mobilde uzun dikey blok oluşturabilir | Kart ve süreç alanları yatay kaydırmalı şeritlere dönüştürülmeli |
| Taksi Modülü | Yolculuk durumları, ödeme seçenekleri, geçmiş kayıtlar ve destek aksiyonları dikey uzayabilir | Harita öncelikli ekran, yatay durum şeridi ve yatay kayıt kartları kullanılmalı |
| AVM Dünyası | AVM, mağaza, kampanya, etkinlik ve hizmet listeleri mobilde sayfayı aşırı uzatabilir | Kategori, liste ve kampanya alanları yatay kaydırmalı modül şeridi olmalı |
| User Panel | Dashboard, kupon, favori, yolculuk ve destek listeleri yoğunlaşabilir | Özet kartlar ve geçmiş kayıtları yatay şeritlerde gösterilmeli |
| Admin Panel | Onay kuyruğu, kullanıcı listesi, rapor ve operasyon ekranları mobilde uzayabilir | KPI kartları, yatay onay kartları ve tablo sarmalayıcıları kullanılmalı |
| Süper Admin Paneli | Tablo, rapor, onay kuyruğu ve KPI alanları mobilde taşma riski taşır | KPI şeritleri, yatay veri tabloları ve sekmeli modül navigasyonu kullanılmalı |
| Partner Panel | Kampanya, kupon, onay durumu, rapor ve destek kayıtları mobilde yoğunlaşabilir | Partner dashboard ve içerik kayıtları yatay kart şeritlerine alınmalı |
| Bot Geliştirme | Chat önerileri, modül sonuçları ve bot raporları dikey mesaj yığınına dönüşebilir | Hızlı öneri chipleri, sonuç kartları ve metrik şeritleri kullanılmalı |
| Sosyal Medya | Kanal listesi, içerik takvimi ve platform raporları uzun dikey yapı oluşturabilir | Platform kartları ve takvim slotları yatay kaydırmalı olmalı |
| Günlük Geliştirme | Günlük akış, kontrol listesi ve rapor tabloları mobilde yoğunlaşabilir | Gün adımları, checklist kartları ve rapor alanları yatay şeritlenmeli |
| Denizcilik Modülü | HTML ekranları, hero görseli, navlun, firma, danışman, destek ve partner sayfaları var | Merkezi mobil çekirdeğe bağlandı; hero responsive, operasyon kartları yatay şerit olmalı |
| Yemek Modülü | Şu an frontend yok; ürün görselleri, veri ve sözleşme testleri var | Frontend geldiğinde ürün, kategori, sepet ve sipariş alanları merkezi mobil çekirdeğe bağlanmalı |

## Merkezi Mobil Görünüm Çekirdeği

Mobil görünüm artık modül modül ayrı CSS kurallarıyla yönetilmemelidir. Tüm çalışan HTML modülleri aşağıdaki merkezi çekirdeğe bağlanmıştır:

| Dosya | Görev |
| --- | --- |
| `shared/mobile/mobile-core.css` | Tüm modüller için ortak mobil kırılım, yatay kart şeritleri, filtre chipleri, tablo sarmalayıcıları ve hero davranışı |
| `shared/mobile/mobile-core.js` | Dinamik içerikleri izler, tabloları otomatik sarmalar ve yatay modül alanlarını erişilebilir hale getirir |
| `shared/mobile/README.md` | Yeni modül bağlama kuralı |

Yeni HTML modülü eklendiğinde kendi CSS dosyasından sonra `../shared/mobile/mobile-core.css`, head içinde veya sayfa sonunda `../shared/mobile/mobile-core.js` bağlanmalıdır.

## Mobil Kontrol Listesi

| Alan | Kontrol | Durum | Not |
| --- | --- | --- | --- |
| Responsive yapı | 320px, 375px, 390px, 414px ve tablet kırılımları kontrol edilmeli | Beklemede | iPhone SE gibi dar ekranlar dahil edilmeli |
| Layout | Sayfa genelinde istemsiz yatay taşma olmamalı | Beklemede | Bilinçli yatay modül şeritleri bu kuralın dışındadır |
| Yatay modül şeritleri | Uzun dikey liste ve kart alanları yatay kaydırmalı olmalı | Beklemede | Kart, tablo, süreç ve kategori alanları dahil |
| Modül yoğunluğu | Mobilde ilk ekranda kritik aksiyon görünür kalmalı | Beklemede | Detay içerikler yatay şeritlerde toplanmalı |
| Tipografi | Metinler okunabilir boyutta olmalı | Beklemede | Küçük metinler kritik alanlarda kullanılmamalı |
| Butonlar | Dokunma alanları yeterli olmalı | Beklemede | En az 44px hedef alan önerilir |
| Formlar | Input, select, checkbox ve hata mesajları mobilde rahat kullanılmalı | Beklemede | Klavye açıldığında alanlar kapanmamalı |
| Navigasyon | Menü, alt menü ve geri dönüş akışları mobilde anlaşılır olmalı | Beklemede | Hamburger veya alt navigasyon davranışı net olmalı |
| Görseller | Görseller kırpılmadan veya amacını kaybetmeden görünmeli | Beklemede | Önemli ürün/kişi/yer görselleri küçük ekranda da seçilmeli |
| Sabit alanlar | Header, footer, sticky buton ve modal alanları çakışmamalı | Beklemede | Özellikle ödeme ve form ekranlarında kontrol edilmeli |
| Performans | Mobil yükleme süresi ve etkileşim gecikmesi izlenmeli | Beklemede | Ağ yavaşlatma testi yapılmalı |
| Erişilebilirlik | Kontrast, odak sırası ve ekran okuyucu etiketleri kontrol edilmeli | Beklemede | İkon butonlarda erişilebilir ad bulunmalı |
| Tarayıcı uyumu | Safari, Chrome ve yaygın Android tarayıcıları kontrol edilmeli | Beklemede | iOS Safari özel sorunları ayrıca takip edilmeli |
| Cihaz yönü | Gerekli ekranlarda dikey ve yatay kullanım kontrol edilmeli | Beklemede | Tabletlerde özellikle önemli |

## Test Edilecek Kritik Akışlar

1. Ana sayfa veya ilk açılış ekranı
2. Kayıt, giriş ve parola sıfırlama
3. Ürün, hizmet veya içerik listeleme
4. Detay sayfası
5. Arama, filtreleme ve sıralama
6. Form doldurma ve validasyon hataları
7. Sepet, teklif, rezervasyon veya ödeme akışı
8. Profil, hesap ve ayarlar
9. Bildirim, modal ve onay ekranları
10. Hata, boş durum ve yükleniyor ekranları

## Önceliklendirme

| Öncelik | Tanım | Örnek |
| --- | --- | --- |
| Kritik | Kullanıcı akışını durduran mobil hata | Ödeme butonunun görünmemesi |
| Yüksek | Kullanımı ciddi zorlaştıran hata | Form alanlarının klavye altında kalması |
| Orta | Kullanıcı deneyimini bozan ama akışı durdurmayan hata | Kart hizalarının bozulması |
| Düşük | Kozmetik veya nadir görülen hata | Belirli cihazda küçük boşluk farkı |

## Yayın Öncesi Mobil Kabul Kriterleri

- Kritik ekranlar en az bir iOS ve bir Android cihazda kontrol edilmiştir.
- 320px genişlikte sayfa genelinde istemsiz yatay taşma bulunmamaktadır.
- Uzun dikey modül içerikleri yatay kaydırmalı kart, chip, stepper veya tablo şeridine dönüştürülmüştür.
- Yatay modül şeritleri dokunmatik kaydırma, klavye odağı ve ekran okuyucu sırası açısından kullanılabilir durumdadır.
- Ana aksiyon butonları görünür, dokunulabilir ve doğru çalışmaktadır.
- Formlar mobil klavye açıkken kullanılabilir durumdadır.
- Header, navigasyon, modal ve sticky alanlar birbirini kapatmamaktadır.
- Görseller ve metinler küçük ekranda anlamını korumaktadır.
- Kritik akışlarda mobil performans kullanıcıyı bekletmeyecek seviyededir.
- Mobilde tespit edilen kritik ve yüksek öncelikli hatalar kapatılmıştır.

## Periyodik Kontroller

| Sıklık | Kontrol |
| --- | --- |
| Her geliştirme tamamlandığında | İlgili ekranların mobil kırılımları kontrol edilir |
| Haftalık | Açık mobil görünüm hataları önceliklerine göre gözden geçirilir |
| Sprint sonunda | Kritik kullanıcı akışları mobil cihazlarda tekrar test edilir |
| Yayın öncesi | Mobil kabul kriterleri tamamlanır |
| Aylık | Mobil performans, cihaz uyumu ve erişilebilirlik bulguları değerlendirilir |

## İletişim ve Raporlama

- Mobil görünüm bulguları ekran adı, cihaz, tarayıcı, ekran genişliği, adım ve ekran görüntüsüyle raporlanmalıdır.
- Kritik ve yüksek öncelikli mobil hatalar aynı gün proje sahibi ve teknik liderle paylaşılmalıdır.
- Tasarım kaynaklı belirsizliklerde ürün ve tasarım ekibiyle karar netleştirilmelidir.
- Geliştirme kaynaklı hatalarda beklenen davranış ve mevcut davranış ayrı yazılmalıdır.

## Sorumluluk Matrisi

| Rol | Sorumluluk |
| --- | --- |
| Mobil görünüm sorumlusu | Mobil kalite standardını takip eder, kontrolleri yapar ve bulguları önceliklendirir |
| Tasarım ekibi | Mobil tasarım kararlarını, kırılımları ve bileşen davranışlarını netleştirir |
| Geliştirme ekibi | Mobil görünüm hatalarını düzeltir ve responsive yapıyı uygular |
| QA ekibi | Mobil test senaryolarını çalıştırır ve regresyon kontrollerini yapar |
| Ürün ekibi | Mobil kullanıcı akışlarının iş önceliğini ve kabul kriterlerini belirler |
| Teknik lider | Teknik çözüm kalitesini ve yayın uygunluğunu onaylar |

## Açık Riskler

| Risk | Etki | Olasılık | Öncelik | Aksiyon |
| --- | --- | --- | --- | --- |
| Dar ekranlarda yatay taşma | Yüksek | Orta | Yüksek | 320px testleri zorunlu hale getirilmeli |
| Mobil formların kullanılamaması | Yüksek | Orta | Yüksek | Klavye ve validasyon durumları test edilmeli |
| Sticky alanların içerik kapatması | Orta | Orta | Orta | Header, footer ve CTA çakışmaları kontrol edilmeli |
| Görsellerin mobilde anlamını kaybetmesi | Orta | Orta | Orta | Responsive görsel kuralları belirlenmeli |
| Sadece masaüstünde test yapılması | Yüksek | Orta | Yüksek | Yayın öncesi mobil kabul kriterleri zorunlu olmalı |

## Teslim Çıktıları

- Mobil kontrol listesi sonucu
- Önceliklendirilmiş mobil hata listesi
- Kritik akışlara ait mobil test notları
- Cihaz, tarayıcı ve ekran genişliği bilgileriyle desteklenmiş ekran görüntüleri
- Yayın öncesi mobil uygunluk onayı
