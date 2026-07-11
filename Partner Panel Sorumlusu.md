# Partner Panel Sorumlusu

Bu rapor 27 Haziran 2026 itibarıyla yerel ALLONAHUB proje klasöründeki mevcut dokümanlar incelenerek hazırlanmıştır. Amaç, partner panel tarafında elimizde olan dayanakları, eksikleri, hata/risk alanlarını ve geliştirme önerilerini netleştirmektir.

## Mevcut Repo Bulgusu

| Alan | Durum | Not |
| --- | --- | --- |
| Git branch | Var | Aktif branch `main`. |
| Git commit geçmişi | Yok | Branch üzerinde henüz commit bulunmuyor. |
| Git remote | Yok | Depo şu an uzak GitHub/GitLab adresine bağlı görünmüyor. |
| Takip edilen dosya | Yok | `git ls-files` boş dönüyor; dosyalar Git tarafından takip edilmiyor. |
| Uygulama kodu | Yok | Partner panel route, component, API, migration, servis veya test dosyası bulunamadı. |
| Partner panel dokümanı | Bu dosya ile oluşturuldu | Önceki durumda doğrudan partner panel dokümanı yoktu. |
| Gereksinim temeli | Kısmen var | AVM, admin panel, güvenlik, mobil görünüm ve sosyal medya dokümanlarında partner panelle ilişkili güçlü ihtiyaçlar var. |

## Kısa Sonuç

Çalışma klasöründe çalışan bir partner panel uygulaması veya kod kanıtı bulunmadı. Mevcut içerik proje yönetimi ve kalite dokümanlarından oluşuyor.

Buna rağmen partner panel ihtiyacının ana çerçevesi netleşiyor: AVM/mağaza temsilcileri, hizmet veya ürün sağlayıcıları, kampanya/kupon sahipleri ve içerik üreticileri kendi alanlarını sınırlı yetkiyle yönetebilmeli; süper admin/admin tarafı ise bu içerikleri onaylamalı, denetlemeli ve raporlamalıdır.

Partner panel, admin panelin daha sınırlı ve dış paydaşlara açılan versiyonu gibi düşünülmelidir. En kritik konu, partnerin sadece kendi varlıklarını görebilmesi ve değiştirebilmesidir.

## Partner Panelde Neyimiz Var

| Alan | Mevcut Dayanak | Kaynak |
| --- | --- | --- |
| Güvenlik standardı | MFA, RBAC, sunucu tarafı yetki, audit log, rate limit ve OWASP kontrolleri tanımlı | Genel Güvenlik |
| AVM/mağaza temsilcisi ihtiyacı | Mağaza temsilcisi yetkileri, içerik onayı, kampanya, kupon, etkinlik ve raporlama ihtiyacı var | AVM Dünyası |
| Admin denetimi | Admin ve süper admin panelde içerik onay, rol yönetimi, audit log ve raporlama kapsamı tanımlı | Admin Panel / Süper Admin Panel |
| Mobil kalite standardı | Yönetim akışları dahil 320px, tablet, form, modal ve dokunmatik kullanım kriterleri var | Mobil Görünüm |
| Sosyal içerik onayı | Taslak, onay kuyruğu, yayın logu ve platform raporu ihtiyacı tanımlı | Sosyal Medya |
| Günlük takip ritmi | Öncelik, test, güvenlik, mobil kontrol ve gün sonu raporu standardı var | Günlük Geliştirme Motoru |

## Tespit Edilen Eksikler ve Riskler

| Alan | Eksik/Hata | Etki | Öncelik |
| --- | --- | --- | --- |
| Uygulama kodu | Partner panel ekranı, API, veri modeli ve test dosyası yok | Çalışan ürün doğrulanamaz | Kritik |
| Partner tanımı | Partner tipleri net değil: AVM, mağaza, marka, hizmet sağlayıcı, sosyal içerik sahibi ayrılmamış | Yetki ve ekran kapsamı belirsiz kalır | Kritik |
| Tenant/sahiplik modeli | Partnerin hangi AVM, mağaza, kampanya veya ürüne sahip olduğu tanımlı değil | IDOR ve veri sızıntısı riski oluşur | Kritik |
| Rol-yetki matrisi | Partner owner, partner editor, finance/report viewer gibi roller yok | Her kullanıcıya fazla yetki verilme riski doğar | Kritik |
| Onay akışı | Partnerin oluşturduğu içeriklerin admin onayına nasıl gideceği yazılı değil | Yanlış kampanya veya yanıltıcı içerik yayına çıkabilir | Kritik |
| Audit log | Partner değişikliklerinin kim, ne zaman, neyi değiştirdi bilgisi yok | Uyuşmazlık ve güvenlik olayları izlenemez | Kritik |
| Dosya/görsel yükleme | Logo, kampanya görseli, mağaza fotoğrafı için güvenli yükleme kuralı yok | Zararlı dosya, uygunsuz içerik veya büyük asset riski doğar | Yüksek |
| Finansal/rapor erişimi | Partnerin hangi metrikleri göreceği ve dışa aktarabileceği belirsiz | Hassas veri gereğinden fazla paylaşılabilir | Yüksek |
| Bildirimler | Onay, red, revizyon, süresi biten kampanya ve kupon uyarıları tanımlı değil | Operasyon takibi manuel kalır | Yüksek |
| Mobil kullanım | Partner formları ve tabloları için özel mobil kabul kriteri yok | Sahada mobil kullanım zorlaşır | Yüksek |
| Destek akışı | Partnerin talep/şikayet/yardım kaydı açacağı alan yok | Operasyon iletişimi dağınık yürür | Orta-Yüksek |
| Sözleşme/KVKK | Partner kabul metinleri, veri işleme ve içerik sorumluluğu tanımlı değil | Hukuki ve operasyonel risk oluşur | Yüksek |

## Önerilen Partner Panel Kapsamı

| Ekran/Akış | Beklenen İçerik | Kritik Kontrol |
| --- | --- | --- |
| Partner giriş | E-posta/telefon, parola, MFA, parola sıfırlama | Rate limit, güvenli oturum, güvenli hata mesajı |
| Partner dashboard | Bekleyen onaylar, aktif kampanyalar, kupon durumu, performans özeti | Sadece partnerin kendi verileri görünmeli |
| Profil ve şirket bilgileri | Firma adı, vergi bilgisi, iletişim, yetkili kişi, logo | Hassas alan değişiklikleri onaya bağlanmalı |
| Kullanıcı ve ekip yönetimi | Partner kullanıcı daveti, rol atama, pasifleştirme | Partner sadece kendi organizasyonundaki kullanıcıları yönetebilmeli |
| AVM/mağaza yönetimi | Mağaza bilgisi, kategori, kat, mağaza no, çalışma saati, iletişim | Admin onayı olmadan kritik bilgi yayına çıkmamalı |
| Kampanya yönetimi | Başlık, açıklama, tarih, koşul, görsel, CTA | Süresi dolan kampanya otomatik pasifleşmeli |
| Kupon yönetimi | Kod, limit, geçerlilik, hedef kullanıcı, kullanım durumu | Limit ve kullanım kayıtları atomik tutulmalı |
| Etkinlik/duyuru | Tarih, saat, lokasyon, katılım koşulu, görsel | Tarih geçmişse kullanıcı tarafında aktif kalmamalı |
| İçerik onay durumu | Taslak, onay bekliyor, revizyon, yayında, reddedildi, arşiv | Her durum değişikliği loglanmalı |
| Raporlar | Görüntülenme, tıklama, favori, kupon kaydetme/kullanma, kampanya performansı | Kişisel veri maskeleme ve dışa aktarma yetkisi |
| Destek merkezi | Talep açma, dosya ekleme, durum takibi, admin notları | Hassas veri ve dosya güvenliği sağlanmalı |
| Bildirimler | Onay/red, revizyon, süre bitimi, limit dolumu, destek cevabı | Kanal ve tercih yönetimi olmalı |

## Önerilen Partner Rolleri

| Rol | Kapsam |
| --- | --- |
| Partner Owner | Partner hesabı, ekip, içerik, kampanya, rapor ve destek alanlarını yönetir |
| Partner Admin | İçerik, kampanya, kupon, etkinlik ve ekip yönetimini sınırlı yapar |
| İçerik Editörü | Mağaza, kampanya, etkinlik ve duyuru taslakları oluşturur |
| Rapor Görüntüleyici | Sadece partnerin performans raporlarını görür |
| Finans/Rapor Yetkilisi | Kupon, kampanya ve varsa finansal özetleri görüntüler; dışa aktarma sınırlı olabilir |
| Salt Okunur | İçerik ve durumları görür, değişiklik yapamaz |

Kritik kural: Partner rolleri admin/süper admin yetkilerine yükseltilememeli; partner kullanıcıları sadece kendi organizasyon sınırında işlem yapmalıdır.

## Veri Modeli İhtiyaçları

| Veri | Amaç |
| --- | --- |
| `partners` | Partner organizasyonu ve durum bilgisi |
| `partner_users` | Partner kullanıcıları, davet ve MFA durumu |
| `partner_roles` | Partner içi rol tanımları |
| `partner_permissions` | Eylem bazlı partner izinleri |
| `partner_memberships` | Kullanıcı-partner-rol ilişkisi |
| `partner_assets` | Partnerin sahip olduğu AVM, mağaza, marka, ürün veya hizmet ilişkileri |
| `partner_profile_change_requests` | Kritik firma bilgisi değişiklik onayları |
| `campaigns` | Kampanya içerikleri ve durumları |
| `coupons` | Kupon kuralları, limitleri ve geçerlilik |
| `events` | Etkinlik ve duyuru içerikleri |
| `content_approvals` | Onay, red, revizyon ve yayın akışı |
| `partner_files` | Logo, görsel, belge ve dosya kayıtları |
| `partner_audit_logs` | Partner panel aktiviteleri |
| `partner_support_tickets` | Partner destek talepleri |
| `partner_reports` | Partner rapor konfigürasyonu veya hazır çıktılar |

## Güvenlik ve Denetim Kontrol Listesi

| Kontrol | Öncelik | Durum |
| --- | --- | --- |
| Partner login ve güvenli oturum | Kritik | Geliştirilmeli |
| Partner MFA veya risk bazlı ek doğrulama | Yüksek | Geliştirilmeli |
| Partner organizasyon sahipliği kontrolü | Kritik | Geliştirilmeli |
| Sunucu tarafı RBAC | Kritik | Geliştirilmeli |
| IDOR testleri | Kritik | Geliştirilmeli |
| Audit log | Kritik | Geliştirilmeli |
| Dosya yükleme validasyonu | Yüksek | Geliştirilmeli |
| Görsel boyut/tip kontrolü | Yüksek | Geliştirilmeli |
| Hassas veri maskeleme | Yüksek | Geliştirilmeli |
| Dışa aktarma yetki ve log kontrolü | Yüksek | Geliştirilmeli |
| Rate limit ve abuse monitoring | Yüksek | Geliştirilmeli |
| KVKK/izin/sözleşme metni takibi | Yüksek | Ürün/hukuk kararı gerekli |

## Mobil Yatay Modül Düzeni

Partner panel sahada ve mobil cihazlarda kullanılacağı için uzun form, tablo ve rapor yapıları tek dikey sayfaya yığılmamalıdır. Aşağıdaki alanlar yatay kaydırmalı modül şeridi veya bölümlenmiş mobil akış olarak uygulanmalıdır:

| Alan | Mobil Düzen | Kontrol |
| --- | --- | --- |
| Partner dashboard | Yatay özet kartları | Bekleyen onay, aktif kampanya, kupon durumu ve destek talebi ilk kartlarda görünmeli |
| Profil ve şirket bilgileri | Yatay sekmeler + kısa form blokları | Hassas firma alanları ayrı onay akışına bağlanmalı |
| Ekip yönetimi | Yatay kullanıcı kartları veya tablo sarmalayıcı | Rol, durum ve davet aksiyonu görünür olmalı |
| Mağaza/partner içerikleri | Yatay içerik kartları | Mağaza, kampanya, kupon ve etkinlik türleri ayrışmalı |
| Kampanya ve kuponlar | Yatay kart şeridi | Tarih, limit, durum ve CTA ilk görünümde olmalı |
| Onay durumu | Yatay durum stepperi | Taslak, onay bekliyor, revizyon, yayında ve arşiv adımları tek uzun liste olmamalı |
| Raporlar | Yatay metrik kartları | Görüntülenme, tıklama, favori ve kupon kullanımı ayrı kartlarda olmalı |
| Destek talepleri | Yatay talep kartları | Açık talep ve son yanıt ilk kartlarda görünmeli |

Mobil kabul notları:

- Partner panelde sayfa genelinde istemsiz yatay taşma olmamalıdır.
- Uzun formlar parçalara ayrılmalı; form alanlarının kendisi okunabilir dikey sırada kalmalıdır.
- Tekrarlayan kampanya, kupon, etkinlik, rapor ve destek kayıtları yatay şeritlere taşınmalıdır.
- Partner yalnızca kendi varlıklarını görmeli; yatay kartlarda başka partnere ait veri sızmamalıdır.
- 320px dahil dar ekranlarda CTA, tarih, durum ve onay bilgisi görünür kalmalıdır.

## Test Edilecek Kritik Akışlar

1. Partner kullanıcısı davet linkiyle hesap oluşturur ve giriş yapar.
2. Partner kullanıcısı hatalı parola denemelerinde rate limit davranışı görür.
3. Partner owner kendi ekibine kullanıcı davet eder ve rol atar.
4. Partner editor mağaza bilgisini düzenler ve onaya gönderir.
5. Admin değişikliği onaylamadan kullanıcı tarafında yeni bilgi yayınlanmaz.
6. Partner kampanya oluşturur, görsel yükler ve tarih aralığı belirler.
7. Süresi biten kampanya otomatik pasifleşir.
8. Partner kupon limiti belirler; kullanım sonrası kalan limit doğru güncellenir.
9. Partner sadece kendi mağaza/kampanya/kupon kayıtlarını görür.
10. Başka partnere ait ID ile erişim denendiğinde istek reddedilir.
11. Partner rapor ekranında kişisel veri içermeyen performans metriklerini görür.
12. Dışa aktarma yalnızca yetkili rolde çalışır ve audit log'a yazılır.
13. Partner destek talebi açar, dosya ekler ve durum değişimini takip eder.
14. Mobilde login, dashboard, kampanya formu, kupon formu ve onay durumu taşma olmadan çalışır.

## Öncelikli Geliştirme Rotası

### Faz 1: Kapsam ve Rol Netleştirme

Süre: 1-2 gün

- Partner tipleri belirlenir: AVM, mağaza, marka, hizmet sağlayıcı, sosyal içerik sahibi.
- Partner rolleri ve yetki matrisi çıkarılır.
- Partnerin yönetebileceği kaynaklar ve admin onayı gerektiren alanlar ayrılır.
- KVKK, sözleşme ve içerik sorumluluğu kararları netleştirilir.

Kabul kriteri: Partner tipleri, roller, sahiplik modeli ve MVP ekran listesi yazılıdır.

### Faz 2: Kimlik, Organizasyon ve Sahiplik Modeli

Süre: 3-5 gün

- Partner login, oturum, parola sıfırlama ve davet akışı tasarlanır.
- Partner organizasyonu, üyelik ve rol modeli oluşturulur.
- Her API işleminde partner sahipliği kontrolü uygulanır.
- Audit log altyapısı başlatılır.

Kabul kriteri: Partner kullanıcısı güvenli şekilde giriş yapabilir ve sadece kendi organizasyon verilerine erişebilir.

### Faz 3: İçerik ve Onay MVP

Süre: 5-8 gün

- Mağaza/partner profili, kampanya, kupon ve etkinlik formları hazırlanır.
- Taslak, onay bekliyor, revizyon, yayında, reddedildi ve arşiv durumları uygulanır.
- Admin panel onay kuyruğu ile entegrasyon planlanır.
- Süresi biten kampanya/kupon pasifleştirme kuralı eklenir.

Kabul kriteri: Partner içerik oluşturabilir, onaya gönderebilir ve admin onayı sonrası yayın durumunu takip edebilir.

### Faz 4: Raporlama, Destek ve Bildirim

Süre: 4-7 gün

- Partner dashboard ve performans raporları eklenir.
- Destek talebi ve dosya ekleme akışı hazırlanır.
- Onay/red/revizyon ve süre bitimi bildirimleri tanımlanır.
- Dışa aktarma yetki ve audit log kontrolü eklenir.

Kabul kriteri: Partner kendi performansını görebilir, destek talebi açabilir ve önemli durum değişikliklerinden haberdar olur.

### Faz 5: Güvenlik, Mobil ve Yayın Hazırlığı

Süre: 3-5 gün

- IDOR, XSS, CSRF, rate limit, dosya yükleme ve RBAC testleri yapılır.
- 320px, 375px, 390px, 414px ve tablet kırılımları kontrol edilir.
- Kritik ve yüksek öncelikli partner panel hataları kapatılır.
- Yayın öncesi kabul kriterleri tamamlanır.

Kabul kriteri: Partner panel güvenlik, mobil ve temel E2E testlerinden geçer.

## MVP Kapsamı

1. Partner login, parola sıfırlama ve güvenli oturum.
2. Partner organizasyon, kullanıcı daveti ve temel roller.
3. Partner dashboard.
4. Mağaza/partner profil yönetimi.
5. Kampanya, kupon ve etkinlik taslak oluşturma.
6. Onaya gönderme, revizyon, yayın ve arşiv durum takibi.
7. Admin onay kuyruğuyla entegrasyon.
8. Temel raporlar: görüntülenme, tıklama, kupon kaydetme/kullanma.
9. Destek talebi açma ve durum izleme.
10. Audit log, sahiplik kontrolü ve mobil uygunluk.

## Yayın Öncesi Kabul Kriterleri

- Partner paneline yalnızca yetkili partner kullanıcıları erişebilir.
- Partner kullanıcısı sadece kendi organizasyonuna ait kaynakları görebilir ve değiştirebilir.
- Rol bazlı yetki matrisi dokümante edilmiş ve sunucu tarafında uygulanmıştır.
- Partner içerikleri admin onayı olmadan kullanıcı tarafında yayınlanmaz.
- Kampanya, kupon ve etkinliklerde tarih ve limit kontrolleri doğru çalışır.
- Süresi biten kampanya/kupon kullanıcı tarafında aktif görünmez.
- Partner panel aktiviteleri audit log'a yazılır.
- Loglarda parola, token, kart bilgisi veya gereksiz kişisel veri tutulmaz.
- Dosya yükleme tip, boyut ve güvenlik kontrollerinden geçer.
- Rapor ve dışa aktarma ekranları hassas veriyi maskeleyerek gösterir.
- Panel 320px, 375px, 390px, 414px ve tablet kırılımlarında taşmadan kullanılabilir.
- Kritik ve yüksek öncelikli partner panel hataları yayından önce kapatılmıştır.

## Açık Riskler

| Risk | Etki | Olasılık | Öncelik | Aksiyon |
| --- | --- | --- | --- | --- |
| Gerçek uygulama kodunun bu klasörde olmaması | Mevcut partner panel teknik olarak denetlenemiyor | Yüksek | Kritik | Uygulama reposu veya remote adresi bağlanmalı |
| Partner sahiplik modelinin tanımlanmaması | Başka partnere ait veri görüntülenebilir | Orta | Kritik | Tenant/resource ownership matrisi çıkarılmalı |
| Admin onay akışının eksik kalması | Yanlış veya yanıltıcı içerik yayına çıkabilir | Orta | Kritik | İçerik durum makinesi ve onay kuyruğu MVP'ye alınmalı |
| Partner rollerinin fazla geniş verilmesi | Yetkisiz düzenleme veya veri dışa aktarma riski oluşur | Orta | Kritik | Minimum yetki rol matrisi uygulanmalı |
| Kupon limitlerinin hatalı yönetilmesi | Finansal/operasyonel uyuşmazlık doğar | Düşük-Orta | Kritik | Atomik kullanım kaydı ve limit testleri eklenmeli |
| Dosya yükleme güvenliğinin eksik olması | Zararlı dosya veya uygunsuz içerik riski oluşur | Orta | Yüksek | Dosya tipi, boyut, tarama ve moderasyon kuralı uygulanmalı |
| Mobil formların kullanılamaması | Partner sahada içerik yönetemez | Orta | Yüksek | Dar ekran testleri zorunlu yapılmalı |

## İlk 10 Günlük Aksiyon Planı

| Gün | İş |
| --- | --- |
| 1 | Gerçek uygulama reposu, remote ve mevcut partner panel kodu doğrulanır. |
| 2 | Partner tipleri, sahip oldukları kaynaklar ve MVP kapsamı kesinleştirilir. |
| 3 | Partner rol-yetki matrisi ve admin onay sınırları çıkarılır. |
| 4 | Partner organizasyon, üyelik, rol ve audit log veri modeli hazırlanır. |
| 5 | Kampanya, kupon, etkinlik ve profil değişiklik onay akışları yazılır. |
| 6 | API sözleşmesi: login, dashboard, içerik CRUD, onay, rapor ve destek uçları tasarlanır. |
| 7 | Güvenlik test listesi: IDOR, RBAC, dosya yükleme, rate limit ve log maskeleme netleştirilir. |
| 8 | Mobil form ve tablo davranışları için 320px dahil tasarım kabul kriterleri yazılır. |
| 9 | Admin panel onay kuyruğu entegrasyon noktaları belirlenir. |
| 10 | MVP backlog, test senaryoları ve yayın öncesi kontrol listesi kilitlenir. |

## Günlük Partner Panel Rapor Formatı

| Alan | İçerik |
| --- | --- |
| Tamamlanan işler | Bitirilen ekran, API, test veya dokümantasyon |
| Devam eden işler | Yarım kalan akış ve mevcut durum |
| Test sonucu | Masaüstü, mobil, API ve güvenlik doğrulamaları |
| Açık hatalar | Öncelik, etki, ekran/API ve önerilen aksiyon |
| Engeller | Tasarım, API, veri, hukuk, erişim veya ürün kararı bekleyen noktalar |
| Ertesi gün odağı | İlk ele alınacak partner panel işi |

## Sonuç

Partner panel için mevcut klasörde çalışan yazılım kanıtı yok; bu nedenle teknik kod denetimi yapılamıyor. Ancak mevcut dokümanlar partner panelin nasıl konumlanması gerektiğini açıkça gösteriyor: partnerler kendi mağaza, kampanya, kupon, etkinlik ve rapor alanlarını yönetmeli; admin tarafı ise onay, denetim, güvenlik ve yayın kontrolünü elinde tutmalıdır.

İlk net hedef, gerçek uygulama reposunu doğrulamak ve partner sahiplik modelini kilitlemektir. Ardından auth, RBAC, audit log, içerik onay akışı, kampanya/kupon yönetimi, raporlama ve mobil kullanılabilirlik MVP kapsamıyla ilerletilmelidir.
