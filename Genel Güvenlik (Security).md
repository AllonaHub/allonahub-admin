# Genel Güvenlik (Security)

Bu doküman ALLONAHUB proje yönetimi kapsamında genel güvenlik yaklaşımını, minimum güvenlik kontrollerini ve operasyonel takip maddelerini tanımlar.

## Amaç

- Proje varlıklarını, kullanıcı verilerini ve iş sürekliliğini korumak.
- Erişim, veri, uygulama, altyapı ve operasyon güvenliği için ortak standart oluşturmak.
- Güvenlik risklerini erken tespit etmek, azaltmak ve düzenli takip etmek.

## Kapsam

- Web, mobil, API ve yönetim panelleri
- Sunucular, veritabanları, depolama alanları ve üçüncü taraf servisler
- Kullanıcı hesapları, yönetici hesapları ve servis hesapları
- Kaynak kod, CI/CD, loglar, yedekler ve gizli anahtarlar

## Temel İlkeler

- En az yetki prensibi uygulanır.
- Varsayılan ayarlar güvenli kabul edilmez; kritik yapılandırmalar ayrıca gözden geçirilir.
- Kimlik doğrulama, yetkilendirme ve veri koruma merkezi kontroller olarak ele alınır.
- Güvenlik kontrolleri geliştirme sürecinin sonunda değil, tasarım aşamasından itibaren uygulanır.
- Üretim ortamı erişimleri kayıt altına alınır ve düzenli olarak denetlenir.

## Güvenlik Kontrol Listesi

| Alan | Kontrol | Durum | Not |
| --- | --- | --- | --- |
| Kimlik doğrulama | Güçlü parola politikası uygulanmalı | Beklemede | Minimum uzunluk, karmaşıklık ve sızıntı kontrolü |
| Kimlik doğrulama | Yönetici hesaplarında MFA zorunlu olmalı | Beklemede | SMS yerine authenticator veya passkey tercih edilmeli |
| Yetkilendirme | Rol bazlı erişim modeli tanımlanmalı | Beklemede | Admin, ekip, müşteri, misafir gibi roller |
| Yetkilendirme | Kritik işlemler sunucu tarafında kontrol edilmeli | Beklemede | Sadece arayüz kontrolü yeterli değildir |
| Veri güvenliği | Hassas veriler sınıflandırılmalı | Beklemede | Kişisel veri, finansal veri, sistem sırrı |
| Veri güvenliği | Aktarımda TLS kullanılmalı | Beklemede | HTTP trafiği HTTPS'e yönlendirilmeli |
| Veri güvenliği | Hassas veriler şifreli saklanmalı | Beklemede | Özellikle token, anahtar ve kişisel veriler |
| Gizli bilgiler | Secret değerleri repoya yazılmamalı | Beklemede | `.env`, vault veya secret manager kullanılmalı |
| Uygulama güvenliği | Input validasyonu yapılmalı | Beklemede | Hem istemci hem sunucu tarafında |
| Uygulama güvenliği | OWASP Top 10 riskleri kontrol edilmeli | Beklemede | Injection, XSS, CSRF, SSRF, IDOR |
| API güvenliği | Rate limiting uygulanmalı | Beklemede | Login, ödeme ve arama uçlarında öncelikli |
| API güvenliği | API anahtarları kapsamlandırılmalı | Beklemede | Süreli ve minimum yetkili anahtarlar |
| Altyapı | Üretim erişimleri sınırlandırılmalı | Beklemede | VPN, IP kısıtı veya bastion tercih edilmeli |
| Altyapı | Güvenlik yamaları düzenli uygulanmalı | Beklemede | OS, runtime, framework, paketler |
| Loglama | Kritik olaylar loglanmalı | Beklemede | Login, yetki değişimi, ödeme, veri dışa aktarma |
| Loglama | Loglarda hassas veri tutulmamalı | Beklemede | Parola, token, kart bilgisi yazılmamalı |
| Yedekleme | Otomatik yedekleme yapılmalı | Beklemede | Geri dönüş testiyle birlikte takip edilmeli |
| Olay müdahalesi | Güvenlik olayı süreci tanımlanmalı | Beklemede | Sorumlular, iletişim ve aksiyon planı |

## Erişim Yönetimi

- Tüm kullanıcılar kişisel hesap kullanmalıdır; ortak hesaplardan kaçınılmalıdır.
- Yönetici rolleri sadece ihtiyacı olan kişilere verilmelidir.
- İşten ayrılan veya rolü değişen kişilerin erişimleri aynı gün kaldırılmalıdır.
- Üretim veritabanı erişimleri istisna kabul edilmeli ve kayıt altına alınmalıdır.
- Servis hesapları için sahip, amaç, yetki kapsamı ve son kullanma tarihi belirlenmelidir.

## Parola ve MFA Politikası

- Yönetici ve ekip hesaplarında MFA zorunlu olmalıdır.
- Parolalar güvenli biçimde hashlenmeli; düz metin parola saklanmamalıdır.
- Parola sıfırlama linkleri süreli, tek kullanımlık ve tahmin edilemez olmalıdır.
- Başarısız giriş denemeleri izlenmeli ve kötüye kullanıma karşı sınırlandırılmalıdır.

## Veri Güvenliği

- Veriler hassasiyet seviyesine göre sınıflandırılmalıdır.
- Kişisel veriler yalnızca gerekli amaç ve süre boyunca saklanmalıdır.
- Veri dışa aktarma işlemleri yetki kontrolüne ve loglamaya tabi olmalıdır.
- Test ve geliştirme ortamlarında gerçek kullanıcı verisi kullanılmamalı veya maskeleme uygulanmalıdır.
- Yedekler üretim verisi kadar hassas kabul edilmelidir.

## Uygulama Güvenliği

- Kullanıcı girdileri doğrulanmalı, normalize edilmeli ve güvenli biçimde işlenmelidir.
- Yetki kontrolleri her kritik API ve sunucu işleminde tekrar yapılmalıdır.
- Dosya yükleme varsa dosya tipi, boyut, içerik ve saklama konumu kontrol edilmelidir.
- Oturum yönetiminde güvenli cookie ayarları kullanılmalıdır: `HttpOnly`, `Secure`, `SameSite`.
- Hata mesajları kullanıcıya gereksiz sistem detayı göstermemelidir.

## Mobil Güvenlik ve Yönetim Ekranları

Güvenlik, log, erişim ve yönetim ekranları mobilde uzun dikey tablolar halinde bırakılmamalıdır. Bu alanlarda aşağıdaki mobil düzen standardı uygulanmalıdır:

| Alan | Mobil Düzen | Kontrol |
| --- | --- | --- |
| Güvenlik kontrol listesi | Yatay kategori kartları veya tablo sarmalayıcı | Durum ve not alanları taşmamalı |
| Erişim kayıtları | Yatay kayıt kartları | Kullanıcı, rol, tarih ve aksiyon görünür olmalı |
| Audit log | Yatay kaydırmalı tablo veya kompakt log kartları | Parola, token ve hassas veri gösterilmemeli |
| Açık riskler | Yatay risk kartları | Etki, olasılık, öncelik ve aksiyon birlikte görünmeli |
| Periyodik kontroller | Yatay kontrol şeridi | Haftalık, aylık ve yıllık kontroller ayrışmalı |

Mobil güvenlik kabul notları:

- Hassas güvenlik aksiyonları küçük ekranda yanlış dokunmaya açık olmamalıdır.
- MFA, rol değişimi, erişim kaldırma ve veri dışa aktarma gibi işlemler mobilde ek onayla korunmalıdır.
- Güvenlik tabloları sayfa genelinde yatay taşma yaratmamalı; yatay kaydırma yalnızca tablo veya kart şeridinin içinde olmalıdır.
- Kritik uyarılar yatay kart şeridinde ilk sırada gösterilmelidir.

## API Güvenliği

- Tüm API uçları kimlik doğrulama ve yetki modeliyle uyumlu olmalıdır.
- Public API uçları için rate limit ve abuse monitoring uygulanmalıdır.
- ID tabanlı kaynak erişimlerinde kullanıcı sahipliği kontrol edilmelidir.
- Webhook imzaları doğrulanmalı ve tekrar oynatma saldırılarına karşı korunmalıdır.
- API versiyonlama ve geriye dönük uyumluluk planı yapılmalıdır.

## Altyapı ve Operasyon

- Üretim, test ve geliştirme ortamları ayrılmalıdır.
- Varsayılan portlar, kullanıcılar ve örnek yapılandırmalar gözden geçirilmelidir.
- Yönetim panelleri internete açık bırakılmamalı veya ek korumayla sınırlandırılmalıdır.
- Bağımlılıklar düzenli olarak taranmalı ve kritik açıklar öncelikli kapatılmalıdır.
- CI/CD süreçlerinde secret sızıntısı ve yetkisiz deploy riski kontrol edilmelidir.

## Loglama ve İzleme

Loglanması gereken olaylar:

- Başarılı ve başarısız giriş denemeleri
- Parola ve MFA değişiklikleri
- Rol ve yetki değişiklikleri
- Kritik veri oluşturma, güncelleme, silme ve dışa aktarma işlemleri
- Ödeme, faturalama veya finansal işlem denemeleri
- Yönetici paneli aktiviteleri
- Şüpheli trafik, rate limit aşımı ve güvenlik duvarı olayları

Loglarda tutulmaması gereken bilgiler:

- Parolalar
- Session token ve API anahtarları
- Kart bilgileri
- Kimlik doğrulama kodları
- Gereksiz kişisel veri

## Yedekleme ve Geri Dönüş

- Kritik veriler otomatik ve düzenli olarak yedeklenmelidir.
- Yedekler şifreli saklanmalı ve erişimi sınırlandırılmalıdır.
- Geri yükleme testleri düzenli yapılmalıdır.
- Kabul edilebilir veri kaybı süresi ve toparlanma süresi tanımlanmalıdır.

Önerilen hedefler:

- RPO: 24 saat veya daha kısa
- RTO: 4 saat veya daha kısa

## Güvenlik Olayı Müdahale Süreci

1. Olay tespit edilir ve kayıt altına alınır.
2. Etkilenen sistem, hesap, veri ve kullanıcı kapsamı belirlenir.
3. Devam eden risk izole edilir.
4. Kök neden analizi yapılır.
5. Gerekli düzeltmeler uygulanır.
6. Etkilenen taraflara ve gerekiyorsa resmi kurumlara bildirim yapılır.
7. Olay sonrası öğrenimler dokümante edilir.

## Periyodik Kontroller

| Sıklık | Kontrol |
| --- | --- |
| Haftalık | Kritik loglar, başarısız girişler ve uyarılar gözden geçirilir |
| Aylık | Kullanıcı ve yönetici erişimleri denetlenir |
| Aylık | Bağımlılık ve güvenlik açığı taraması yapılır |
| Üç aylık | Yedekten geri dönüş testi yapılır |
| Üç aylık | Güvenlik kontrol listesi güncellenir |
| Yıllık | Penetrasyon testi veya bağımsız güvenlik değerlendirmesi planlanır |

## Öncelikli Aksiyonlar

1. Yönetici hesaplarında MFA zorunlu hale getir.
2. Rol bazlı erişim matrisini çıkar.
3. Secret yönetimi standardını belirle.
4. Kritik API uçları için rate limit ekle.
5. Loglama kapsamını netleştir ve hassas veri sızıntısı kontrolü yap.
6. Otomatik yedekleme ve geri dönüş testini planla.
7. OWASP Top 10 tabanlı ilk güvenlik gözden geçirmesini tamamla.

## Sorumluluk Matrisi

| Rol | Sorumluluk |
| --- | --- |
| Proje sahibi | Güvenlik önceliklerini ve risk kabul kararlarını onaylar |
| Teknik lider | Güvenlik kontrollerinin teknik uygulanmasını yönetir |
| Geliştirme ekibi | Güvenli kodlama, test ve düzeltmeleri uygular |
| Operasyon ekibi | Altyapı, yedekleme, izleme ve erişim kontrollerini yürütür |
| Ürün ekibi | Kullanıcı deneyimi ile güvenlik gereksinimlerini dengeler |

## Açık Riskler

| Risk | Etki | Olasılık | Öncelik | Aksiyon |
| --- | --- | --- | --- | --- |
| MFA eksikliği | Yüksek | Orta | Yüksek | Yönetici hesaplarında MFA zorunlu kılınmalı |
| Secret sızıntısı | Yüksek | Orta | Yüksek | Secret manager ve repo taraması uygulanmalı |
| Eksik yetki kontrolü | Yüksek | Orta | Yüksek | API bazlı yetki testleri eklenmeli |
| Yedek geri dönüşünün test edilmemesi | Yüksek | Düşük | Orta | Periyodik restore testi yapılmalı |
| Loglarda hassas veri bulunması | Orta | Orta | Orta | Log maskeleme ve denetim eklenmeli |

## Kabul Kriterleri

- Kritik sistemlerde kimlik doğrulama ve yetkilendirme kontrolleri dokümante edilmiştir.
- Yönetici erişimleri MFA ile korunmaktadır.
- Secret değerleri kod deposunda tutulmamaktadır.
- Kritik olaylar loglanmakta ve loglar hassas veri içermemektedir.
- Yedekleme ve geri dönüş süreci test edilmiştir.
- Güvenlik olayları için sorumlu kişiler ve iletişim akışı bellidir.
