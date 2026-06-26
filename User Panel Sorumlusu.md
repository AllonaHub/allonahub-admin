# User Panel Sorumlusu

Bu rapor 27 Haziran 2026 itibarıyla yerel ALLONAHUB proje klasöründeki dokümanlar incelenerek hazırlanmıştır. Amaç, user panel tarafında elimizde olan temel dayanakları, eksikleri, riskleri ve geliştirme önceliklerini netleştirmektir.

## Mevcut Repo Bulgusu

| Alan | Durum | Not |
| --- | --- | --- |
| Git remote | Yok | Yerel depo herhangi bir uzak GitHub/Git remote adresine bağlı görünmüyor. |
| Takip edilen dosya | Yok | `git ls-files` boş dönüyor; mevcut dosyalar Git tarafından takip edilmiyor. |
| Uygulama kodu | Yok | User panel ekranı, API, rota, component veya test dosyası bulunamadı. |
| User panel dokümanı | Bu dosya ile oluşturuldu | Önceki durumda doğrudan User Panel Sorumlusu dokümanı yoktu. |
| Gereksinim temeli | Kısmen var | Güvenlik, mobil, anasayfa, taksi ve AVM dokümanlarında user panelle ilişkili beklentiler var. |
| Rol/yetki modeli | Beklemede | Güvenlik dokümanında admin, ekip, müşteri, misafir rolleri öneriliyor. |
| Mobil kalite standardı | Var | Giriş, kayıt, profil, hesap ve ayarlar mobil kritik akış olarak tanımlı. |
| Modül entegrasyon ihtiyaçları | Var | Taksi ve AVM modülleri kullanıcı hesabı, bildirim, favori, kupon, destek ve geçmiş kayıt ihtiyaçları doğuruyor. |

## User Panelde Neyimiz Var

- Kullanıcı verisi ve hesap güvenliği için genel güvenlik standardı.
- Giriş, kayıt, parola sıfırlama, profil, hesap ve ayarlar ekranlarının mobil kritik akış olarak tanımlanması.
- Rol bazlı erişim modeli ihtiyacı: admin, ekip, müşteri, misafir.
- API tarafında kimlik doğrulama, yetkilendirme, rate limit, sahiplik kontrolü ve güvenli oturum beklentileri.
- Loglanması gereken olaylar: giriş denemeleri, parola/MFA değişiklikleri, rol değişiklikleri, kritik veri işlemleri.
- Anasayfa ve hizmetler üzerinden kullanıcıyı CTA, iletişim, teklif veya başvuru akışına taşıyacak temel dönüşüm yaklaşımı.
- Taksi modülünde yolcu hesabı, yolculuk geçmişi, ödeme, fiş/fatura, destek ve şikayet ihtiyaçları.
- AVM modülünde favori AVM/mağaza, bildirim tercihleri, kupon kullanımı ve etkinlik takibi ihtiyaçları.

## User Panelde Eksikler

| Alan | Eksik | Etki | Öncelik |
| --- | --- | --- | --- |
| Ürün kapsamı | User panelin ana ekranları ve kullanıcı rolleri net değil | Geliştirme parçalanır, kabul kriteri belirsiz kalır | Kritik |
| Kod tabanı | Panel ekranları, API ve veri modeli yok | Çalışan ürün doğrulanamaz | Kritik |
| Kimlik doğrulama | Login, kayıt, parola sıfırlama ve oturum akışı tanımlı değil | Kullanıcı hesabı güvenilir şekilde kullanılamaz | Kritik |
| Profil ve hesap | Profil bilgileri, iletişim, adres, ayarlar ve hesap silme akışı yok | Kullanıcı kendi verisini yönetemez | Yüksek |
| Rol/yetki | Müşteri, misafir, ekip, admin ayrımı uygulanmış değil | Yetkisiz erişim ve veri sızıntısı riski doğar | Kritik |
| Bildirim tercihleri | Kanal, izin ve abonelik tercihleri merkezi değil | Kullanıcı izni ihlal edilebilir | Yüksek |
| Aktivite/geçmiş | Yolculuk, kupon, favori, başvuru ve destek geçmişi tanımlı değil | Kullanıcı panelinin ana değeri eksik kalır | Yüksek |
| Destek akışı | Talep, şikayet, mesaj ve durum takibi yok | Operasyon ve kullanıcı iletişimi kopar | Yüksek |
| Güvenlik kontrolleri | MFA, rate limit, session güvenliği, IDOR testleri uygulanmış değil | Hesap güvenliği riski yüksek kalır | Kritik |
| Mobil ve erişilebilirlik | Panel özelinde test edilmiş kırılımlar yok | Kullanıcı akışları mobilde bozulabilir | Yüksek |
| Test planı | User panel için uçtan uca ve regresyon senaryoları yok | Yayın riski artar | Yüksek |
| Analitik | Kullanıcı aktivitesi, dönüşüm ve hata metrikleri tanımlı değil | İyileştirme kararı veriye dayanmaz | Orta |

## Önerilen User Panel Kapsamı

| Ekran/Akış | Beklenen İçerik | Kritik Kontrol |
| --- | --- | --- |
| Giriş | E-posta/telefon, parola, sosyal giriş opsiyonu, hata durumları | Rate limit, güvenli hata mesajı, oturum cookie ayarları |
| Kayıt | Temel bilgiler, doğrulama, izinler, KVKK/aydınlatma metni | Açık rıza ve doğrulama akışı ayrılmalı |
| Parola sıfırlama | Tek kullanımlık süreli link veya kod | Link tahmin edilemez ve süreli olmalı |
| Dashboard | Kullanıcı özeti, son işlemler, hızlı aksiyonlar | Kişiye özel veri sahiplik kontrolü yapılmalı |
| Profil | Ad, soyad, telefon, e-posta, avatar, doğrulama durumu | Hassas değişikliklerde tekrar doğrulama |
| Adresler | Kayıtlı adresler, varsayılan adres, manuel konum | Taksi ve teslimat/ziyaret akışlarıyla uyumlu olmalı |
| Bildirim tercihleri | Push, SMS, e-posta, kampanya ve favori bildirimleri | İzinler merkezi ve geri alınabilir olmalı |
| Favoriler | AVM, mağaza, hizmet veya ürün favorileri | Bildirim tercihiyle tutarlı çalışmalı |
| Kuponlar | Kaydedilen, kullanılan, süresi dolan kuponlar | Kullanım limiti ve geçerlilik doğru gösterilmeli |
| Yolculuklar | Taksi geçmişi, durum, ödeme, fiş/fatura, destek | Yolculuk ID ve kullanıcı sahipliği kontrol edilmeli |
| Destek | Talep açma, şikayet, dosya ekleme, durum takibi | Kişisel veri ve dosya güvenliği sağlanmalı |
| Güvenlik | Parola değişimi, MFA, aktif oturumlar, cihazlar | Oturum kapatma ve şüpheli giriş bildirimleri olmalı |
| Hesap yönetimi | Veri indirme, hesap dondurma/silme, izin yönetimi | Yasal saklama ve silme kuralları net olmalı |

## Mobil Yatay Modül Düzeni

User panel mobilde kullanıcıyı uzun bir hesap sayfasına hapsetmemelidir. Ana özet ve tekrar eden kayıtlar yatay kaydırmalı modül şeritleriyle sunulmalıdır:

| Alan | Mobil Düzen | Kontrol |
| --- | --- | --- |
| Dashboard özeti | Yatay özet kartları | En son işlem, açık destek ve hızlı aksiyon ilk kartlarda olmalı |
| Profil bölümleri | Yatay sekmeler + kısa form blokları | Form alanları okunabilir dikey sırada kalmalı |
| Adresler | Yatay adres kartları | Varsayılan adres ilk kartta görünmeli |
| Bildirim tercihleri | Yatay kanal kartları veya chip grupları | Push, SMS, e-posta tercihleri kolay açılıp kapanmalı |
| Favoriler | Yatay favori kartları | AVM, mağaza, hizmet veya ürün türü ayırt edilmeli |
| Kuponlar | Yatay kupon kartları | Aktif, kullanılan ve süresi dolan durumlar ayrışmalı |
| Yolculuklar | Yatay yolculuk geçmişi kartları | Son yolculuk ve destek CTA görünür olmalı |
| Destek talepleri | Yatay talep kartları | Açık talep durumu ilk görünümde olmalı |
| Güvenlik cihazları | Yatay oturum/cihaz kartları | Şüpheli oturumu kapat aksiyonu dokunulabilir olmalı |

Mobil kabul notları:

- Dashboard tek uzun dikey liste olmamalı; özet kartları yatay şeritte verilmelidir.
- Kritik hesap formları yatay kart içine sıkıştırılmamalı; form alanları okunabilir dikey sırada kalmalıdır.
- Tekrarlı geçmiş kayıtları mobilde yatay kart şeritlerine taşınmalıdır.
- Her yatay kartta detay ekranına giden net bir aksiyon bulunmalıdır.
- Sayfa genelinde istemsiz yatay taşma olmamalı; kaydırma sadece modül şeritlerinin içinde kalmalıdır.

## Öncelikli Geliştirme Rotası

### Faz 1: Kapsam ve Veri Modeli

Süre: 1-2 gün

- User panel rolleri, ekranları ve MVP kapsamı kesinleştirilir.
- Kullanıcı profil veri modeli çıkarılır.
- Kullanıcıya bağlı kaynaklar listelenir: favoriler, kuponlar, yolculuklar, destek talepleri, bildirim tercihleri.
- KVKK, izin ve hesap silme gereksinimleri ürün ekibiyle netleştirilir.

Kabul kriteri: User panel ekran listesi, roller, veri alanları ve kabul kriterleri yazılıdır.

### Faz 2: Kimlik ve Hesap Temeli

Süre: 3-5 gün

- Login, kayıt, parola sıfırlama ve oturum yönetimi uygulanır.
- Güçlü parola, rate limit ve güvenli hata mesajları eklenir.
- Profil görüntüleme/düzenleme ve güvenli iletişim bilgisi değişikliği hazırlanır.
- Temel audit log olayları kaydedilir.

Kabul kriteri: Kullanıcı güvenli şekilde hesap açabilir, giriş yapabilir, profilini yönetebilir ve çıkış yapabilir.

### Faz 3: Panel Dashboard ve Kişisel Alanlar

Süre: 4-7 gün

- Dashboard, profil, adresler, bildirim tercihleri ve favoriler eklenir.
- Boş durum, hata durumu ve yükleniyor durumları tasarlanır.
- Mobil kırılımlar 320px dahil kontrol edilir.
- Erişilebilirlik için odak sırası, etiketler ve kontrast kontrol edilir.

Kabul kriteri: Kullanıcı panelde kendi bilgilerini ve tercihlerini mobil/masaüstü yönetebilir.

### Faz 4: Modül Entegrasyonları

Süre: 5-10 gün

- Taksi yolculuk geçmişi, ödeme/fiş ve destek akışı panele bağlanır.
- AVM favorileri, kuponlar, etkinlik hatırlatmaları ve bildirim tercihleri bağlanır.
- Kullanıcı sahipliği kontrolleri API seviyesinde test edilir.
- Modül bazlı hata ve boş durumlar eklenir.

Kabul kriteri: Panel, taksi ve AVM modüllerindeki kullanıcıya özel geçmiş ve aksiyonları güvenli şekilde gösterir.

### Faz 5: Güvenlik, Test ve Yayın Hazırlığı

Süre: 3-6 gün

- MFA opsiyonu, aktif oturum yönetimi ve şüpheli giriş bildirimleri eklenir.
- IDOR, XSS, CSRF, rate limit ve yetki testleri yapılır.
- Uçtan uca testler hazırlanır.
- Günlük raporlama ve kritik log kontrolü devreye alınır.

Kabul kriteri: Kritik kullanıcı akışları, mobil görünüm ve güvenlik kontrolleri yayın öncesi tamamlanmıştır.

## Test Edilecek Kritik Akışlar

1. Kullanıcı kayıt olur, doğrulama adımını tamamlar ve panele girer.
2. Kullanıcı hatalı parola denemelerinde güvenli hata mesajı ve rate limit davranışı görür.
3. Kullanıcı parola sıfırlama linkiyle parolasını değiştirir.
4. Kullanıcı profil bilgilerini günceller.
5. Kullanıcı telefon veya e-posta değiştirirken tekrar doğrulama yapar.
6. Kullanıcı bildirim tercihlerini değiştirir ve bu tercih modül bildirimlerine yansır.
7. Kullanıcı favori AVM veya mağazalarını panelde görür.
8. Kullanıcı kuponlarını aktif, kullanılan ve süresi dolan olarak görüntüler.
9. Kullanıcı taksi yolculuk geçmişini, ödeme durumunu ve fiş/fatura bilgisini inceler.
10. Kullanıcı destek talebi açar ve durumunu takip eder.
11. Kullanıcı aktif oturumlarını görür ve bir oturumu sonlandırır.
12. Kullanıcı hesap silme veya veri indirme talebi başlatır.
13. Başka bir kullanıcıya ait ID ile kaynak erişimi denendiğinde erişim reddedilir.
14. Mobilde giriş, profil, bildirim, kupon ve yolculuk ekranlarında taşma oluşmaz.

## Açık Riskler

| Risk | Etki | Olasılık | Öncelik | Aksiyon |
| --- | --- | --- | --- | --- |
| User panel kapsamının belirsiz kalması | Yüksek | Yüksek | Kritik | MVP ekranları ve kabul kriterleri hemen netleştirilmeli |
| Kod tabanı veya remote olmaması | Yüksek | Yüksek | Kritik | Gerçek uygulama reposu bağlanmalı veya paylaşılmalı |
| Eksik yetki ve sahiplik kontrolü | Yüksek | Orta | Kritik | API seviyesinde rol ve resource ownership testleri eklenmeli |
| Bildirim tercihinin modüllere yansımaması | Orta-Yüksek | Orta | Yüksek | Merkezi notification preference servisi tanımlanmalı |
| Mobil formların kullanılamaması | Yüksek | Orta | Yüksek | 320px, iOS Safari ve Android Chrome kontrolleri zorunlu olmalı |
| Hesap silme/veri indirme sürecinin belirsiz olması | Yüksek | Orta | Yüksek | KVKK ve saklama politikası ürün/hukuk kararıyla netleştirilmeli |
| Loglarda hassas veri tutulması | Orta-Yüksek | Orta | Yüksek | Log maskeleme ve hassas veri denetimi eklenmeli |

## İlk 7 Günlük Aksiyon Planı

| Gün | İş |
| --- | --- |
| 1 | Gerçek uygulama reposu, remote ve mevcut user panel kodu doğrulanır. |
| 2 | User panel MVP kapsamı ve ekran listesi kilitlenir. |
| 3 | Kullanıcı, rol, profil, adres, bildirim ve favori veri modeli çıkarılır. |
| 4 | Login, kayıt, parola sıfırlama ve oturum güvenliği kabul kriterleri yazılır. |
| 5 | Dashboard, profil, bildirim tercihleri ve destek ekranlarının wireframe ihtiyacı netleştirilir. |
| 6 | Taksi ve AVM modül entegrasyon noktaları listelenir. |
| 7 | Test senaryoları, mobil kontrol listesi ve güvenlik kontrol listesi user panel özelinde tamamlanır. |

## Günlük User Panel Rapor Formatı

| Alan | İçerik |
| --- | --- |
| Tamamlanan işler | Bitirilen ekran, API, test veya dokümantasyon |
| Devam eden işler | Yarım kalan akış ve mevcut durum |
| Test sonucu | Masaüstü, mobil, API ve güvenlik doğrulamaları |
| Açık hatalar | Öncelik, etki, ekran/API ve önerilen aksiyon |
| Engeller | Tasarım, API, veri, hukuk, erişim veya ürün kararı bekleyen noktalar |
| Ertesi gün odağı | İlk ele alınacak user panel işi |

## Uygulama Durumu

27 Haziran 2026 itibarıyla user panel MVP frontend uygulaması `user-panel/` klasöründe oluşturuldu.

| Alan | Durum | Not |
| --- | --- | --- |
| Statik uygulama | Tamamlandı | `user-panel/index.html` ile açılır. |
| Profil yönetimi | Tamamlandı | Ad, e-posta, telefon, şehir ve adres güncellenir; veri `localStorage` içinde korunur. |
| Bildirim tercihleri | Tamamlandı | Push, e-posta, SMS ve kampanya tercihleri açılıp kapatılabilir. |
| Kupon ve favoriler | Tamamlandı | Kupon kullanma, favori ekleme ve favori kaldırma çalışır. |
| Yolculuk geçmişi | Tamamlandı | Yolculuk listesi, ödeme durumu, fiş indirme ve destek formuna aktarma bulunur. |
| Destek talepleri | Tamamlandı | Yeni talep oluşturma ve talep kapatma çalışır. |
| Güvenlik ekranı | Tamamlandı | MFA tercihi ve aktif oturum sonlandırma akışı vardır. |
| Veri indirme | Tamamlandı | Kullanıcı verisi JSON olarak indirilebilir. |
| Mobil kontrol | Doğrulandı | Playwright ile 390px genişlikte menü ve yatay taşma kontrolü geçti. |
| Tarayıcı hatası | Doğrulandı | Playwright kontrolünde console/page error görülmedi. |

Not: Backend, gerçek auth servisi ve veritabanı henüz bağlı değildir. Bu MVP, kullanıcı deneyimi ve panel davranışlarını göstermek için tarayıcı `localStorage` alanını kullanır. Kalıcı üretim sürümünde aynı akışlar API, RBAC, audit log ve veri sahipliği kontrolleriyle sunucu tarafına bağlanmalıdır.

## Sonuç

User panel için ilk çalışan MVP artık mevcut. Elimizdeki güvenlik, mobil kalite ve modül ihtiyaçlarından türetilen gereksinimler `user-panel/` altında profil, bildirim, kupon, favori, yolculuk, destek ve güvenlik ekranlarına dönüştürüldü. Bir sonraki ana hedef, gerçek backend/auth reposunu bağlayıp `localStorage` durumunu API, veritabanı, RBAC, audit log ve kullanıcı sahipliği kontrollerine taşımaktır.
