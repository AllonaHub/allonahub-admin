# Süper Admin Paneli Araştırma Raporu

Tarih: 27 Haziran 2026

Bu rapor, ALLONAHUB proje yönetimi klasöründeki mevcut dokümanlar incelenerek hazırlanmıştır. İnceleme kapsamındaki dosyalar:

- `Genel Güvenlik (Security).md`
- `AVM Dünyası Modülü Sorumlusu.md`
- `Taksi Modülü Sorumlusu.md`
- `Sosyal Medya Sorumlusu.md`
- `Mobil Görünüm Sorumlusu.md`
- `Anasayfa ve Hizmetler.md`
- `Günlük Geliştirme Motoru.md`

## Kısa Sonuç

Çalışma klasöründe süper admin paneline ait uygulama kodu, route, API, veri modeli veya ekran tasarımı bulunmadı. Mevcut içerik proje yönetimi ve kalite dokümanlarından oluşuyor.

Buna rağmen dokümanlarda süper admin panelinin kapsamını belirleyen güçlü gereksinimler var: rol bazlı yetki, MFA, audit log, içerik onayı, modül yönetimi, operasyon raporları, kritik işlem izleme, mobil uygunluk, güvenlik ve günlük takip düzeni.

Süper admin paneli ALLONAHUB için sadece bir yönetici ekranı değil; kullanıcı, modül, içerik, operasyon, güvenlik ve raporlama kararlarının merkezi kontrol alanı olmalı.

## Elimizde Olanlar

| Alan | Mevcut Durum | Kaynak |
| --- | --- | --- |
| Güvenlik prensipleri | En az yetki, MFA, RBAC, audit log, secret yönetimi, rate limit ve OWASP kontrolleri tanımlı | Genel Güvenlik |
| Erişim yönetimi | Kişisel hesap, yönetici erişim denetimi, servis hesabı sahipliği ve erişim kaldırma kuralları tanımlı | Genel Güvenlik |
| Loglama ihtiyacı | Login, yetki değişimi, veri dışa aktarma, ödeme ve panel aktiviteleri loglanmalı | Genel Güvenlik |
| AVM yönetim paneli ihtiyacı | AVM, mağaza, kampanya, kupon, etkinlik, içerik onayı ve yayın durumu yönetimi tanımlı | AVM Dünyası |
| Taksi operasyon paneli ihtiyacı | Yolculuk kayıtları, durum, ücret, kullanıcı, sürücü, ödeme, iptal ve destek inceleme ihtiyacı tanımlı | Taksi Modülü |
| Sosyal medya operasyon ihtiyacı | Hesap envanteri, içerik takvimi, onay kuyruğu, otomatik paylaşım, log ve rapor ihtiyacı tanımlı | Sosyal Medya |
| Mobil kalite standardı | 320px dahil mobil kırılımlar, dokunmatik alan, modal, form ve erişilebilirlik kontrolü tanımlı | Mobil Görünüm |
| Günlük geliştirme ritmi | Önceliklendirme, test, güvenlik, mobil kontrol ve gün sonu raporu formatı tanımlı | Günlük Geliştirme Motoru |

## Eksik Olanlar

| Alan | Eksik | Etki |
| --- | --- | --- |
| Uygulama kodu | Süper admin paneline ait frontend, backend, API veya route yok | Geliştirme başlamadan teknik mimari çıkarılmalı |
| Veri modeli | Kullanıcı, rol, yetki, audit log, modül, içerik, onay, bildirim ve rapor tabloları tanımlı değil | Panel kapsamı veri seviyesinde net değil |
| Rol matrisi | Süper admin, admin, operasyon, içerik, mağaza temsilcisi, sürücü operasyonu gibi roller ayrıştırılmamış | Yetki sınırları belirsiz kalır |
| Menü yapısı | Panel navigasyonu ve ekran listesi yok | İş kapsamı parçalanamaz |
| API sözleşmesi | Admin API uçları, input/output ve hata formatı yok | Frontend-backend paralel ilerleyemez |
| Denetim izi | Hangi işlemin kim tarafından, ne zaman ve hangi veride yapıldığına dair model yok | Güvenlik ve operasyon riski yüksek |
| Onay akışı | İçerik oluşturma, onaya gönderme, yayınlama, reddetme ve arşivleme akışı kodlanmamış | AVM ve sosyal medya operasyonu ölçeklenemez |
| Raporlama | KPI, filtre, dışa aktarma ve zaman aralığı standardı yok | Yönetim kararları veriyle desteklenemez |
| Test senaryoları | Panel özelinde E2E, yetki ve güvenlik testleri yok | Kritik yönetici hataları geç fark edilir |
| Tasarım sistemi | Admin UI bileşenleri, tablo, filtre, form, modal ve boş durum standardı yok | Panel tutarsız ve yavaş geliştirilebilir |

## Önerilen Süper Admin Panel Kapsamı

### 1. Ana Dashboard

- Sistem sağlık özeti
- Kritik uyarılar
- Bekleyen onaylar
- Açık destek/operasyon sorunları
- Günlük aktif kullanıcı, işlem ve hata özeti
- Modül bazlı durum kartları: AVM, Taksi, Sosyal Medya, Güvenlik

### 2. Kullanıcı ve Rol Yönetimi

- Kullanıcı listesi, arama, filtreleme ve detay
- Rol atama ve kaldırma
- Yetki matrisi
- Yönetici MFA durumu
- Hesap kilitleme, pasifleştirme ve erişim sonlandırma
- Servis hesabı sahipliği, amaç, kapsam ve son kullanma tarihi

Önerilen roller:

| Rol | Kapsam |
| --- | --- |
| Süper Admin | Tüm sistem, roller, güvenlik, ayarlar ve kritik işlemler |
| Admin | Modül ve operasyon yönetimi, sınırlı kullanıcı işlemleri |
| Operasyon | Yolculuk, destek, içerik doğrulama ve günlük raporlar |
| İçerik Editörü | AVM, mağaza, kampanya, etkinlik ve sosyal içerik taslakları |
| Onaycı | İçerik yayınlama, reddetme ve arşivleme |
| AVM Temsilcisi | Kendi AVM/mağaza alanı ile sınırlı içerik yönetimi |
| Destek | Kullanıcı şikayetleri ve operasyon kayıtlarını inceleme |
| Salt Okunur | Rapor ve kayıt görüntüleme |

### 3. Audit Log ve Güvenlik Merkezi

- Başarılı/başarısız giriş denemeleri
- MFA, parola ve oturum değişiklikleri
- Rol/yetki değişiklikleri
- Veri oluşturma, güncelleme, silme ve dışa aktarma işlemleri
- Ödeme, faturalama ve finansal işlem denemeleri
- Panel aktiviteleri
- Şüpheli trafik ve rate limit aşımı
- Log maskeleme ve hassas veri koruması

Kritik kabul: Süper admin dahil hiçbir kritik işlem log dışı kalmamalı.

### 4. AVM Dünyası Yönetimi

- AVM listeleme ve detay yönetimi
- Mağaza, marka, kategori, kat ve mağaza no yönetimi
- Çalışma saatleri ve özel gün istisnaları
- Kampanya, kupon, etkinlik ve duyuru yönetimi
- Harita, kat planı ve mağaza pin yönetimi
- İçerik onay, yayın, arşiv ve reddetme akışı
- Süresi biten kampanya/kupon otomatik pasifleştirme
- Kupon kullanım limitleri ve kullanım logları
- AVM/mağaza bazlı performans raporları

Öncelik: Kritik. AVM dokümanında yönetim paneli yetki sınırları belirsizliği açık risk olarak işaretlenmiş.

### 5. Taksi Operasyon Yönetimi

- Yolculuk kayıtları listesi
- Yolculuk detay ekranı
- Yolcu, sürücü, ücret, ödeme ve konum bilgisi görüntüleme
- Durum geçişleri ve zaman çizelgesi
- İptal nedenleri ve no-show kayıtları
- Ödeme başarısızlığı ve tekrar deneme kayıtları
- Destek/şikayet inceleme ekranı
- Sürücü performansı, eşleşme başarısı, bekleme süresi ve iptal oranı raporları
- Sorunlu yolculuklar için operasyon iş kuyruğu

Öncelik: Kritik. Konum, ücret, ödeme ve güvenlik hataları doğrudan kullanıcı güvenini etkiler.

### 6. Sosyal Medya ve İçerik Operasyonu

- Sosyal hesap envanteri
- Hesap sahibi, MFA ve erişim durumu
- İçerik takvimi
- Ürün/hizmet paylaşım veri modeli
- Platform bazlı taslak üretim alanı
- İnsan onay kuyruğu
- Yayın logları ve hata kayıtları
- UTM, kampanya ve performans raporları
- Token ve API anahtarı güvenlik kontrolü

Öncelik: Orta-Yüksek. Kod altyapısı henüz yok, fakat operasyon planı hazır.

### 7. Raporlama ve Dışa Aktarma

- Modül bazlı filtrelenebilir raporlar
- Tarih aralığı, şehir, AVM, mağaza, sürücü, durum ve kampanya filtreleri
- CSV/XLSX dışa aktarma
- Dışa aktarma yetki kontrolü
- Dışa aktarma audit log kaydı
- Hassas veri maskeleme

### 8. Sistem Ayarları

- Genel platform ayarları
- Modül aktif/pasif durumları
- Bildirim kanalları ve şablonları
- Rate limit ve güvenlik eşikleri
- Bakım modu
- API anahtarı ve webhook yönetimi
- Yedekleme ve geri dönüş durumu

## Geliştirilmesi Gereken Kritik Teknik Parçalar

| Öncelik | Parça | Açıklama |
| --- | --- | --- |
| Kritik | Kimlik doğrulama | Admin login, güvenli oturum, MFA, parola sıfırlama |
| Kritik | RBAC | Rol ve izin matrisi, sunucu tarafı yetki kontrolü |
| Kritik | Audit log | Tüm kritik işlemlerin değiştirilemez iz kaydı |
| Kritik | Admin API | Kullanıcı, rol, modül, içerik, rapor ve log uçları |
| Kritik | AVM içerik yönetimi | İçerik CRUD, onay, yayın, arşiv, tarih bazlı pasifleştirme |
| Kritik | Taksi operasyon paneli | Yolculuk liste/detay, durum ve destek inceleme |
| Yüksek | Güvenlik merkezi | Login denemeleri, şüpheli aktivite, erişim raporu |
| Yüksek | Raporlama | Modül KPI'ları, filtreler ve dışa aktarma |
| Yüksek | Mobil uyum | Tablet ve dar ekranlarda admin kullanılabilirliği |
| Orta | Sosyal medya onay kuyruğu | Taslak, onay, yayın ve log ekranları |
| Orta | Otomasyon kontrolü | Zamanlayıcılar, retry, hata ve bildirim yönetimi |

## Önerilen Menü Yapısı

1. Dashboard
2. Kullanıcılar
3. Roller ve Yetkiler
4. Güvenlik ve Audit Log
5. AVM Dünyası
6. Taksi Operasyon
7. Sosyal Medya
8. İçerik Onayları
9. Bildirimler
10. Raporlar
11. Sistem Ayarları

## Mobil Yatay Modül Düzeni

Süper admin paneli mobilde masaüstü tablosunun daraltılmış hali gibi davranmamalıdır. Yönetim ekranlarında uzun dikey yığılma ve geniş tablo taşmaları aşağıdaki standartla çözülmelidir:

| Alan | Mobil Düzen | Kontrol |
| --- | --- | --- |
| Ana dashboard | Yatay KPI kart şeridi | Kritik uyarılar ve bekleyen onaylar ilk kartlarda görünmeli |
| Menü | Yatay modül sekmeleri veya alt navigasyon | Uzun sidebar mobilde ekrana yığılmamalı |
| Kullanıcı listesi | Yatay kaydırmalı tablo veya kompakt kullanıcı kartları | Rol, durum ve aksiyon alanları erişilebilir olmalı |
| Rol matrisi | Yatay tablo sarmalayıcı | Yetki kolonları sayfa genelinde taşma yaratmamalı |
| Audit log | Yatay kayıt kartları + filtre chipleri | Zaman, aktör, işlem ve risk seviyesi ilk görünümde olmalı |
| AVM içerik yönetimi | Yatay onay kuyruğu kartları | Yayın, reddet, arşivle aksiyonları görünür olmalı |
| Taksi operasyon | Yatay sorunlu yolculuk kartları | Yolculuk ID, durum, ücret ve destek aksiyonu görünmeli |
| Sosyal medya onay kuyruğu | Yatay platform/taslak kartları | Platform ve zamanlama bilgisi ilk görünümde olmalı |
| Raporlar | Yatay metrik kartları ve yatay veri tabloları | Dışa aktarma butonu yetkiye göre görünmeli |

Mobil kabul notları:

- Admin panelinde hiçbir tablo sayfanın tamamını yatay kaydırmaya zorlamamalıdır.
- Geniş tablolar kendi içinde yatay kaydırmalı olmalı veya mobil kart görünümüne dönüşmelidir.
- Filtreler yatay chip şeridi olarak kullanılmalı; uzun filtre formları ekranı kapatmamalıdır.
- Kritik aksiyonlar sticky alanlarla içerik üstüne binmemeli ve yanlış dokunma riski yaratmamalıdır.
- 320px, 375px, 390px, 414px ve tablet kırılımlarında panel taşmadan kullanılmalıdır.

## İlk Sürüm MVP Kapsamı

MVP, tüm sistemi yönetmeye çalışmak yerine kritik riskleri kapatmalı.

1. Admin login ve MFA
2. Süper admin rolü
3. Rol bazlı yetki modeli
4. Kullanıcı listesi ve rol atama
5. Audit log altyapısı
6. AVM içerik listeleme, oluşturma, düzenleme, onaya gönderme ve yayınlama
7. Taksi yolculuk kayıtları liste ve detay ekranı
8. Temel dashboard: bekleyen onaylar, sorunlu yolculuklar, güvenlik uyarıları
9. Temel raporlar: AVM içerik durumu, taksi yolculuk durumu, login denemeleri
10. Mobil ve tablet uyumluluk kontrolü

## Risk Değerlendirmesi

| Risk | Etki | Olasılık | Öncelik | Aksiyon |
| --- | --- | --- | --- | --- |
| Yetki sınırlarının belirsiz kalması | Yüksek | Orta | Kritik | RBAC matrisi ilk iş olarak çıkarılmalı |
| Kritik işlemlerin loglanmaması | Yüksek | Orta | Kritik | Audit log altyapısı MVP'ye dahil edilmeli |
| MFA olmadan admin erişimi | Yüksek | Orta | Kritik | Yönetici hesaplarında MFA zorunlu olmalı |
| AVM içeriklerinin yanlış/yayında kalması | Yüksek | Orta | Kritik | Tarih bazlı otomatik pasifleştirme ve onay akışı kurulmalı |
| Taksi ücret/ödeme/konum sorunlarının izlenememesi | Yüksek | Orta | Kritik | Yolculuk detay ve sorunlu yolculuk kuyruğu yapılmalı |
| Hassas verinin rapor veya loglara sızması | Yüksek | Düşük-Orta | Yüksek | Maskeleme ve dışa aktarma yetki kontrolü uygulanmalı |
| Panelin mobil/tablette kullanılamaması | Orta | Orta | Orta | 320px, tablet ve dokunmatik kontroller zorunlu olmalı |

## Kabul Kriterleri

- Süper admin paneline sadece yetkili kullanıcılar erişebilir.
- Yönetici hesaplarında MFA zorunludur.
- Rol ve izin matrisi dokümante edilmiş ve sunucu tarafında uygulanmıştır.
- Kullanıcı, rol, içerik, ödeme, dışa aktarma ve ayar değişiklikleri audit log'a yazılır.
- Loglarda parola, token, kart bilgisi veya gereksiz kişisel veri tutulmaz.
- AVM içerikleri oluşturulabilir, düzenlenebilir, onaya gönderilebilir, yayınlanabilir ve arşivlenebilir.
- Süresi geçmiş kampanya, etkinlik ve kuponlar kullanıcı ekranında aktif görünmez.
- Taksi yolculukları operasyon panelinden filtrelenebilir ve detaylı incelenebilir.
- Sorunlu yolculuklar, ödeme hataları ve iptal nedenleri raporlanabilir.
- Temel raporlar tarih aralığıyla filtrelenebilir.
- Veri dışa aktarma sadece yetkili roller tarafından yapılabilir ve loglanır.
- Panel 320px, 375px, 390px, 414px ve tablet kırılımlarında taşmadan kullanılabilir.

## 30 Günlük Yol Haritası

| Dönem | Hedef | Çıktı |
| --- | --- | --- |
| Gün 1-3 | Kapsam ve mimari netleştirme | Menü yapısı, rol matrisi, veri modeli taslağı |
| Gün 4-7 | Auth, MFA ve RBAC temeli | Güvenli admin giriş ve yetki kontrolü |
| Gün 8-10 | Audit log altyapısı | Kritik işlem logları ve log görüntüleme |
| Gün 11-16 | AVM yönetim MVP | AVM, mağaza, kampanya ve onay akışı |
| Gün 17-21 | Taksi operasyon MVP | Yolculuk liste/detay, filtre ve sorunlu kayıtlar |
| Gün 22-24 | Dashboard ve temel raporlar | Bekleyen onay, sorunlu yolculuk, güvenlik özeti |
| Gün 25-27 | Mobil, güvenlik ve QA | Yetki testleri, mobil kontroller, hata düzeltmeleri |
| Gün 28-30 | Yayın hazırlığı | Kabul kriterleri, gün sonu raporu, canlıya geçiş listesi |

## Sonraki Net Aksiyonlar

1. Süper admin paneli için rol ve yetki matrisi ayrı doküman olarak çıkarılmalı.
2. Menü yapısı ve MVP ekran listesi onaylanmalı.
3. Admin veri modeli taslağı hazırlanmalı.
4. Kullanılacak teknoloji yığını ve mevcut uygulama deposu netleştirilmeli.
5. İlk geliştirme işi auth, MFA, RBAC ve audit log temeli olmalı.
