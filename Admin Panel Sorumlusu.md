# Admin Panel Sorumlusu

Bu doküman ALLONAHUB proje yönetimi kapsamında admin panelin mevcut durumunu, dokümanlarda tanımlanmış ihtiyaçları, eksikleri, geliştirme önceliklerini ve operasyon standardını raporlar.

## Mevcut Repo Bulgusu

27 Haziran 2026 itibarıyla yerel çalışma klasörü incelendi.

| Alan | Durum | Not |
| --- | --- | --- |
| Git branch | Var | Aktif branch `main`. |
| Git commit geçmişi | Yok | Branch üzerinde henüz commit bulunmuyor. |
| Git remote | Yok | Depo şu an uzak GitHub/GitLab adresine bağlı görünmüyor. |
| Takip edilen dosya | Yok | `git ls-files` boş döndü. |
| Uygulama kodu | Yok | Admin panel route, component, API, migration veya servis dosyası bulunamadı. |
| Proje dokümanları | Var | Anasayfa, mobil görünüm, güvenlik, günlük geliştirme, sosyal medya, taksi ve AVM modülü dokümanları var. |
| İlişkili panel raporları | Var | Süper Admin Paneli Araştırma Raporu ve User Panel Sorumlusu dokümanları da mevcut. |
| Ayrı admin panel dokümanı | Eksikti | Bu dosya ile admin panel kapsamı ve yol haritası tanımlandı. |

## Öncelikli Sonuç

Admin panel şu anda uygulanmış bir yazılım modülü olarak görünmüyor. Buna karşılık mevcut dokümanlarda admin panel için güçlü gereksinimler var:

- Güvenlik tarafında MFA, rol bazlı erişim, sunucu tarafı yetki kontrolü, loglama ve yönetici erişim denetimi isteniyor.
- Taksi modülü için yolculuk kayıtları, durum filtreleme, operasyon raporları, destek ve şikayet inceleme ihtiyacı var.
- AVM Dünyası için AVM, mağaza, kampanya, kupon, etkinlik, içerik onayı, yayın durumu, moderasyon ve raporlama ihtiyacı var.
- Sosyal medya tarafında ürün/hizmet paylaşımı için onay kuyruğu, zamanlayıcı, yayın logları ve günlük rapor ihtiyacı var.
- Mobil görünüm dokümanı admin ve yönetim akışlarının da mobil kırılımlarda kontrol edilmesini istiyor.

Bu nedenle admin panel ALLONAHUB için sadece bir yönetici ekranı değil; güvenlik, içerik, operasyon, destek, raporlama ve otomasyonun merkezi olmalıdır.

## İlişkili Panel Ayrımı

| Panel | Amaç | Bu Raporla İlişkisi |
| --- | --- | --- |
| Süper Admin Paneli | Tüm sistem, roller, güvenlik, modül ayarları, audit log ve kritik kararları yönetir | Admin panelin en üst yetkili katmanıdır; RBAC, MFA ve audit log burada zorunludur |
| Admin Panel | Operasyon, içerik, destek, sosyal medya ve raporlama işlerini yürütür | Bu dokümanın ana kapsamıdır |
| User Panel | Son kullanıcının profil, bildirim, favori, kupon, yolculuk ve destek geçmişini yönetir | Admin panel, user panelde oluşan destek, şikayet ve veri taleplerini operasyon tarafında izler |

Sınır netliği önemlidir: user panel kullanıcıya kendi verisini yönetme alanı verir; admin panel operasyonu yürütür; süper admin panel ise yetki, güvenlik ve sistem kararlarını kontrol eder.

## Admin Panelde Neyimiz Var

| Alan | Mevcut Temel | Kaynak |
| --- | --- | --- |
| Güvenlik standardı | MFA, RBAC, loglama, secret yönetimi, rate limit ve OWASP kontrolleri tanımlı | Genel Güvenlik |
| Taksi operasyon ihtiyacı | Yolculuk kayıtları, durumlar, ödeme/iptal/destek incelemesi tanımlı | Taksi Modülü |
| AVM içerik yönetimi ihtiyacı | AVM, mağaza, kampanya, kupon, etkinlik, onay ve arşiv akışları tanımlı | AVM Dünyası |
| Sosyal medya onay ihtiyacı | Ürün seçimi, içerik taslağı, insan onayı, yayın ve raporlama rotası tanımlı | Sosyal Medya |
| Mobil kalite standardı | Yönetim akışları dahil mobil test kırılımları tanımlı | Mobil Görünüm |
| Günlük takip ritmi | Öncelik, test, güvenlik, mobil kontrol ve gün sonu raporu standardı var | Günlük Geliştirme Motoru |

## Admin Panelde Neyimiz Yok

| Eksik Alan | Etki | Öncelik |
| --- | --- | --- |
| Gerçek admin panel uygulaması | Yönetim süreçleri elle veya belirsiz yürür | Kritik |
| Admin giriş ve oturum yönetimi | Yönetici erişimi güvenli doğrulanamaz | Kritik |
| MFA uygulanması | Yönetici hesabı ele geçirilme riski artar | Kritik |
| Rol bazlı yetki matrisi | Kim neyi görebilir/değiştirebilir belirsiz kalır | Kritik |
| Sunucu tarafı yetki kontrolü | Sadece arayüz kısıtıyla yetkisiz işlem riski oluşur | Kritik |
| Denetim logları | Kim, neyi, ne zaman değiştirdi izlenemez | Kritik |
| İçerik onay ve yayın akışı | Kampanya, etkinlik ve sosyal içerikler kontrolsüz yayınlanabilir | Yüksek |
| Operasyon dashboard'u | Taksi, AVM ve sosyal medya durumları tek ekranda görülemez | Yüksek |
| Raporlama ve dışa aktarma | Performans, hata ve operasyon kararları ölçülemez | Yüksek |
| Bildirim/uyarı sistemi | Kritik ödeme, güvenlik, kampanya veya yayın hataları geç fark edilir | Yüksek |
| Test verisi ve kabul senaryoları | Admin panel kalite standardı ölçülemez | Yüksek |

## Admin Panel Ana Kapsamı

Admin panelin ilk kapsamı aşağıdaki modüllerden oluşmalıdır:

| Modül | Amaç | İlk Sürümde Olmalı |
| --- | --- | --- |
| Giriş ve güvenlik | Yöneticileri güvenli şekilde doğrulamak | Login, MFA, oturum süresi, başarısız giriş limiti |
| Kullanıcı ve rol yönetimi | Yetkileri kontrollü yönetmek | Admin, operasyon, içerik, destek, sosyal medya, rapor rolleri |
| Genel dashboard | Kritik operasyon durumunu göstermek | Açık hata, bekleyen onay, yolculuk sorunu, süresi yaklaşan kampanya |
| AVM yönetimi | AVM ve mağaza içeriklerini yönetmek | AVM, mağaza, kampanya, kupon, etkinlik CRUD ve onay akışı |
| Taksi operasyonu | Yolculukları ve sorunları takip etmek | Yolculuk listesi, durum filtresi, ödeme/iptal/destek inceleme |
| Sosyal medya onayı | Otomatik içerik taslaklarını kontrol etmek | Taslak listesi, onay/red, yayın durumu, hata logu |
| Destek ve şikayet | Kullanıcı etkili sorunları takip etmek | Taksi şikayeti, içerik bildirimi, destek notu, durum güncelleme |
| Raporlama | Karar metriklerini izlemek | Günlük, haftalık ve aylık rapor ekranları |
| Audit log | Kritik işlemleri izlemek | Login, yetki değişimi, içerik değişimi, veri dışa aktarma |
| Sistem ayarları | Operasyon kurallarını yönetmek | Bildirim, sosyal platform, kampanya ve güvenlik ayarları |

## Önerilen Rol ve Yetki Matrisi

| Rol | Görüntüleme | Oluşturma/Düzenleme | Onay/Yayın | Yetki Yönetimi | Veri Dışa Aktarma |
| --- | --- | --- | --- | --- | --- |
| Super Admin | Tümü | Tümü | Tümü | Evet | Evet |
| Admin | Tümü | Operasyonel alanlar | Kritik olmayan yayınlar | Sınırlı | Evet |
| Operasyon | Taksi, destek, AVM durumları | Taksi notu, destek durumu | Hayır | Hayır | Sınırlı |
| İçerik Editörü | AVM, mağaza, kampanya, etkinlik | İçerik taslağı | Hayır | Hayır | Hayır |
| İçerik Onaylayıcı | İçerik ve yayın kuyruğu | Revizyon isteği | Evet | Hayır | Sınırlı |
| AVM Temsilcisi | Kendi AVM/mağaza alanı | Sınırlı içerik taslağı | Hayır | Hayır | Hayır |
| Sosyal Medya | Sosyal taslak ve raporlar | Taslak, takvim, platform notu | Sınırlı | Hayır | Sınırlı |
| Destek | Kullanıcı bildirimleri ve şikayetler | Destek notu, durum | Hayır | Hayır | Hayır |
| Raporlama | Metrik ve raporlar | Hayır | Hayır | Hayır | Evet |

Yetki kontrolleri her kritik API işleminde sunucu tarafında tekrar yapılmalıdır.

## Önerilen Menü Yapısı

1. Dashboard
2. Kullanıcılar ve Roller
3. Güvenlik ve Audit Log
4. AVM Dünyası
5. Taksi Operasyon
6. Sosyal Medya
7. İçerik Onayları
8. Destek ve Şikayet
9. Bildirimler
10. Raporlar
11. Sistem Ayarları

## Ekran Bazlı Gereksinimler

### 1. Admin Giriş

- E-posta ve parola ile giriş.
- Yönetici ve ekip hesaplarında MFA zorunluluğu.
- Başarısız giriş limiti ve şüpheli giriş uyarısı.
- Oturum süresi, güvenli cookie ve logout akışı.
- Parola sıfırlama linkinin süreli ve tek kullanımlık olması.

### 2. Dashboard

- Bekleyen içerik onayları.
- Kritik taksi yolculuk sorunları.
- Ödeme hataları ve iptal oranları.
- Süresi yaklaşan veya bitmiş kampanya/kuponlar.
- Sosyal medya yayın durumu ve günlük hata özeti.
- Güvenlik uyarıları: başarısız giriş, yetki değişimi, rate limit aşımı.

### 3. Kullanıcı ve Rol Yönetimi

- Kullanıcı listesi, rol filtresi ve durum filtresi.
- Yeni yönetici daveti.
- Rol atama ve rol kaldırma.
- MFA durumu görüntüleme.
- İşten ayrılan veya rolü değişen kişilerin erişimini aynı gün kapatma.
- Tüm rol ve yetki değişikliklerini audit log'a yazma.

### 4. AVM Dünyası Yönetimi

- AVM profili: ad, açıklama, şehir, ilçe, adres, görsel, iletişim.
- Çalışma saatleri: normal gün, hafta sonu, özel gün ve geçici kapanış.
- Mağaza profili: marka, kategori, kat, mağaza no, iletişim, durum.
- Kampanya: başlık, açıklama, görsel, tarih, koşullar ve CTA.
- Kupon: kod, limit, hedef kullanıcı, geçerlilik ve kullanım durumu.
- Etkinlik: tarih, saat, alan, katılım koşulu ve bildirim tercihi.
- İçerik durumları: taslak, onay bekliyor, yayında, reddedildi, arşivlendi.
- Süresi bitmiş kampanya/kuponların otomatik pasifleşmesi.

### 5. Taksi Operasyon Yönetimi

- Yolculuk listesi: durum, tarih, sürücü, yolcu, ücret, ödeme ve şehir filtresi.
- Yolculuk detayı: başlangıç, bitiş, rota, ETA, ücret, ödeme, iptal nedeni.
- Sorunlu yolculuk görünümü: ödeme hatası, konum sorunu, destek talebi.
- Sürücü-yolcu uyuşmazlıklarında kayıt ve destek notu.
- İptal, no-show ve ödeme hatalarının raporlanması.
- Kişisel verilerin gereksiz gösterilmemesi ve dışa aktarımın yetkiye bağlanması.

### 6. Sosyal Medya Onay Paneli

- Ürün/hizmet paylaşım taslakları.
- Platform bazlı metin, görsel, hashtag ve CTA önizlemesi.
- Onay, red, revizyon isteği ve planlama akışı.
- Instagram/Facebook öncelikli yayın durumu.
- Platform API hata logları.
- Günlük yayın raporu: link, durum, hata ve temel metrikler.

### 7. Destek ve Şikayet

- Kullanıcı şikayeti, içerik bildirimi ve taksi destek kayıtları.
- Öncelik, durum, sorumlu kişi ve son işlem tarihi.
- Teknik hata için log, zaman damgası, API cevabı ve ekran görüntüsü alanı.
- Kullanıcı etkisi olan sorunlarda hazır destek açıklaması.

### 8. Raporlama

- Taksi: eşleşme başarısı, bekleme süresi, iptal oranı, ödeme başarısı.
- AVM: en çok görüntülenen AVM, mağaza, kampanya, kupon ve etkinlik.
- Sosyal medya: yayın sayısı, erişim, tıklama, etkileşim ve dönüşüm.
- Güvenlik: başarısız giriş, rol değişikliği, veri dışa aktarma, kritik işlem.
- Raporların günlük, haftalık ve aylık kırılımları.

## Veri Modeli İhtiyaçları

İlk teknik analizde aşağıdaki ana tablolar veya koleksiyonlar planlanmalıdır:

| Veri | Amaç |
| --- | --- |
| `admin_users` | Yönetici hesapları ve MFA durumu |
| `service_accounts` | Servis hesabı sahibi, amacı, kapsamı ve son kullanma tarihi |
| `roles` | Rol tanımları |
| `permissions` | Eylem bazlı yetkiler |
| `role_permissions` | Rol-yetki eşleşmeleri |
| `audit_logs` | Kritik admin panel aktiviteleri |
| `admin_sessions` | Oturum ve güvenlik takibi |
| `malls` | AVM profilleri |
| `stores` | Mağaza profilleri |
| `campaigns` | Kampanya içerikleri |
| `coupons` | Kupon ve kullanım kuralları |
| `events` | Etkinlik içerikleri |
| `content_approvals` | İçerik onay ve yayın akışı |
| `taxi_trips` | Yolculuk kayıtları |
| `taxi_trip_events` | Yolculuk durum geçişleri |
| `support_tickets` | Destek ve şikayet kayıtları |
| `social_drafts` | Sosyal medya paylaşım taslakları |
| `social_publish_logs` | Yayın başarı/hata kayıtları |
| `reports` | Hazır rapor çıktıları veya rapor konfigürasyonları |

## Admin API İhtiyaçları

İlk teknik tasarımda frontend ve backend paralel ilerleyebilmesi için API sözleşmesi yazılmalıdır.

| API Alanı | Beklenen Uçlar |
| --- | --- |
| Auth | Login, logout, MFA doğrulama, parola sıfırlama, oturum yenileme |
| Kullanıcı/Rol | Kullanıcı listeleme, davet, pasifleştirme, rol atama, rol kaldırma |
| Yetki | Rol izinleri, yetki matrisi, permission kontrolü |
| AVM | AVM, mağaza, kampanya, kupon, etkinlik CRUD ve yayın durumu |
| Taksi | Yolculuk liste/detay, durum filtresi, destek notu, ödeme/iptal inceleme |
| Sosyal Medya | Taslak listeleme, onay, red, revizyon, yayın logu |
| Destek | Talep listeleme, durum güncelleme, sorumlu atama, not ekleme |
| Raporlama | Tarih aralığı, modül filtresi, dışa aktarma ve özet metrikler |
| Audit Log | Kritik işlem listeleme, filtreleme ve güvenli görüntüleme |

## Güvenlik Kontrol Listesi

| Kontrol | Öncelik | Durum |
| --- | --- | --- |
| Yönetici MFA | Kritik | Geliştirilmeli |
| Rol bazlı erişim matrisi | Kritik | Geliştirilmeli |
| Sunucu tarafı yetki kontrolü | Kritik | Geliştirilmeli |
| Güvenli oturum/cookie ayarları | Kritik | Geliştirilmeli |
| Rate limit ve abuse monitoring | Yüksek | Geliştirilmeli |
| Audit log | Kritik | Geliştirilmeli |
| Veri dışa aktarma logu | Yüksek | Geliştirilmeli |
| Hassas veri maskeleme | Yüksek | Geliştirilmeli |
| Secret/token değerlerinin repoya yazılmaması | Kritik | Standart var, uygulanmalı |
| Yönetim panelinin ek korumayla sınırlandırılması | Yüksek | Geliştirilmeli |

## Mobil ve Kullanılabilirlik Kontrolü

Admin panel masaüstü öncelikli olabilir, ancak kritik operasyon ekranları tablet ve mobilde de kullanılabilir olmalıdır.

| Alan | Mobil Gereksinim |
| --- | --- |
| Login ve MFA | 320px dahil taşmadan çalışmalı |
| Onay kuyruğu | Kart/liste görünümü mobilde okunabilir olmalı |
| Taksi detay | Kritik bilgiler dar ekranda öncelikli görünmeli |
| AVM içerik formları | Uzun formlar bölümlere ayrılmalı |
| Filtreler | Mobilde drawer veya alt panel olarak çalışmalı |
| Tablolar | Zorunlu kolonlar sabit, detaylar açılır yapı olmalı |
| Butonlar | Dokunma alanı en az 44px olmalı |

## Mobil Yatay Modül Düzeni

Admin panelde mobil görünüm uzun tabloların ve operasyon listelerinin dikeyde yığılmasıyla bozulmamalıdır. Aşağıdaki alanlar yatay kaydırmalı modül şeridi veya mobil kart düzeniyle ele alınmalıdır:

| Alan | Mobil Düzen | Kontrol |
| --- | --- | --- |
| Dashboard | Yatay KPI ve uyarı kartları | Bekleyen onay, kritik taksi sorunu ve güvenlik uyarısı ilk kartlarda olmalı |
| Onay kuyruğu | Yatay onay kartları | Onayla, reddet, revizyon iste aksiyonları dokunulabilir olmalı |
| Kullanıcı ve rol listesi | Yatay kaydırmalı tablo veya kompakt kartlar | Rol, durum, MFA ve aksiyon alanları görünür kalmalı |
| AVM içerik yönetimi | Yatay içerik kartları ve durum chipleri | Taslak, onay bekliyor, yayında ve arşiv durumları ayrışmalı |
| Taksi operasyon | Yatay sorunlu yolculuk kartları | Yolculuk ID, ödeme, iptal ve destek durumu ilk görünümde olmalı |
| Sosyal medya onayı | Yatay platform/taslak kartları | Platform, zamanlama ve hata durumu aynı kartta görünmeli |
| Raporlar | Yatay metrik kartları ve tablo sarmalayıcı | Dışa aktarma butonu yetkiye göre gösterilmeli |
| Filtreler | Yatay chip şeridi | Filtreler ekranı kaplayan uzun forma dönüşmemeli |

Mobil kabul notları:

- Admin panelde sayfa genelinde istemsiz yatay taşma olmamalıdır.
- Geniş tablolar kendi kapsayıcısında yatay kaymalı veya mobil kart görünümüne dönüşmelidir.
- Kritik aksiyon butonları sticky alanlarla içerik üstüne binmemelidir.
- Onay, red, rol değişimi ve veri dışa aktarma gibi işlemlerde yanlış dokunmaya karşı net onay adımı bulunmalıdır.
- 320px, 375px, 390px, 414px ve tablet kırılımlarında dashboard, onay kuyruğu, taksi detay ve rapor ekranları kontrol edilmelidir.

## Raporlama Standardı

Admin panel raporlarında her kayıt için aşağıdaki bilgiler bulunmalıdır:

- Tarih aralığı.
- Modül adı.
- Sorumlu ekip veya kişi.
- Mevcut durum.
- Kritik bulgu.
- Kullanıcı veya operasyon etkisi.
- Aksiyon sahibi.
- Sonraki adım.

## İlk 30 Günlük Uygulama Rotası

| Dönem | İş | Çıktı |
| --- | --- | --- |
| Gün 1-3 | Admin panel kapsamı ve rol-yetki matrisi netleştirilir | Onaylı MVP kapsamı |
| Gün 4-6 | Veri modeli ve API uçları tasarlanır | ERD/API taslağı |
| Gün 7-10 | Login, MFA, oturum ve audit log temeli yapılır | Güvenli admin iskeleti |
| Gün 11-15 | Dashboard, kullanıcı/rol ve temel ayarlar geliştirilir | Çalışan çekirdek panel |
| Gün 16-20 | AVM içerik yönetimi ve onay akışı yapılır | AVM içerik MVP |
| Gün 21-24 | Taksi yolculuk listesi, detay ve destek notları yapılır | Taksi operasyon MVP |
| Gün 25-27 | Sosyal medya taslak/onay ekranı eklenir | Yarı otomatik onay paneli |
| Gün 28-30 | Raporlama, mobil kontrol, güvenlik testleri ve yayın hazırlığı yapılır | Yayına hazır MVP raporu |

## MVP Kabul Kriterleri

- Admin kullanıcı güvenli şekilde giriş yapabilir ve MFA ile doğrulanır.
- Rol bazlı yetki matrisi uygulanır ve kritik işlemler sunucu tarafında kontrol edilir.
- Dashboard bekleyen onayları, kritik taksi sorunlarını ve sosyal medya yayın durumunu gösterir.
- AVM içerikleri oluşturulabilir, düzenlenebilir, onaya gönderilebilir, yayınlanabilir ve arşivlenebilir.
- Taksi yolculuk kayıtları filtrelenebilir ve sorunlu yolculuk detayları incelenebilir.
- Sosyal medya taslakları onaylanabilir, reddedilebilir veya revizyona gönderilebilir.
- Kritik admin işlemleri audit log'a yazılır.
- Hassas veriler gereksiz gösterilmez ve loglarda token/parola/kart bilgisi tutulmaz.
- Mobilde login, MFA, dashboard ve onay kuyruğu temel akışları taşma olmadan çalışır.
- Kritik ve yüksek öncelikli admin panel hataları yayından önce kapatılır.

## Açık Riskler

| Risk | Etki | Öncelik | Aksiyon |
| --- | --- | --- | --- |
| Uygulama kodunun bu klasörde bulunmaması | Gerçek admin panel durumu doğrulanamıyor | Kritik | Uygulama reposu veya remote adresi bağlanmalı |
| Rol-yetki sınırlarının belirsiz kalması | Yetkisiz veri erişimi veya yanlış yayın riski | Kritik | RBAC matrisi onaylanmalı |
| MFA olmadan admin panel açılması | Hesap ele geçirilme riski | Kritik | MFA MVP kapsamına alınmalı |
| Audit log olmadan içerik ve yetki değişimi yapılması | Geriye dönük inceleme yapılamaz | Kritik | Audit log ilk sprintte yapılmalı |
| AVM kampanya tarih kontrollerinin eksik kalması | Süresi geçmiş kampanya kullanıcıya görünür | Kritik | Otomatik pasifleştirme ve günlük kontrol eklenmeli |
| Taksi destek kayıtlarının panelde görünmemesi | Canlı operasyon sorunları geç çözülür | Yüksek | Sorunlu yolculuk görünümü MVP'ye eklenmeli |
| Sosyal içeriklerin onaysız yayınlanması | Marka ve hukuki risk oluşur | Yüksek | İnsan onayı ilk fazda zorunlu olmalı |
| Mobil admin akışlarının atlanması | Saha/operasyon kullanımı zorlaşır | Orta | Kritik ekranlar mobil kontrol listesine eklenmeli |

## Öncelikli Geliştirme Listesi

1. Admin panel uygulama reposu veya mevcut kod konumu netleştirilmeli.
2. Admin panel MVP kapsamı ürün sahibi tarafından onaylanmalı.
3. Rol bazlı yetki matrisi çıkarılmalı.
4. Admin login, MFA, oturum yönetimi ve audit log iskeleti yapılmalı.
5. Dashboard ekranı kritik operasyon göstergeleriyle hazırlanmalı.
6. AVM içerik yönetimi ve onay/yayın akışı geliştirilmelidir.
7. Taksi yolculuk listesi, filtreleme ve sorunlu yolculuk detayı geliştirilmelidir.
8. Sosyal medya taslak/onay paneli hazırlanmalıdır.
9. Raporlama ekranları ve dışa aktarma yetkileri eklenmelidir.
10. Güvenlik, mobil ve regresyon testleri yayın öncesi zorunlu hale getirilmelidir.

## Teslim Çıktıları

- Admin panel mevcut durum raporu.
- Rol ve yetki matrisi.
- Admin panel MVP ekran listesi.
- Veri modeli ihtiyaç listesi.
- Güvenlik kontrol listesi.
- İlk 30 günlük uygulama rotası.
- Admin panel kabul kriterleri.
- Önceliklendirilmiş risk ve geliştirme listesi.
