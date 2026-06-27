# Taksi Modülü Sorumlusu

Bu doküman ALLONAHUB proje yönetimi kapsamında taksi modülünden sorumlu rolün kapsamını, operasyon alanlarını, teslim kriterlerini, kontrol listesini ve takip rutinlerini tanımlar.

## Mevcut Teknik Bulgular

27 Haziran 2026 itibarıyla yerel ALLONAHUB proje klasörü incelendi.

| Alan | Durum | Aksiyon |
| --- | --- | --- |
| Çalışan uygulama kodu | Bulunamadı | Taksi modülü route, component, API, test ve migration dosyaları gerçek uygulama reposunda doğrulanmalı |
| Supabase bağlantısı | Bulunamadı | Supabase URL, anon key, service role kullanımı, RLS ve migration yapısı kurulmalı |
| Taksi modülü dokümanı | Var | Bu doküman UI, mobil, harita, buton ve Supabase entegrasyon kriterleriyle güncellendi |
| Partner panel bağı | Kısmen dokümante | Partnerin sadece kendi taksi filosu/sürücü/yolculuk kayıtlarını göreceği sahiplik modeli eklenmeli |
| Mobil düzen standardı | Var | Harita alanı küçültme, tam ekran harita modu ve yatay kaydırma kuralları netleştirildi |

Kritik not: Bu klasörde gerçek frontend/backend kodu olmadığı için mevcut butonlar, harita bileşeni veya Supabase sorguları teknik olarak çalıştırılıp düzeltilmedi. Aşağıdaki maddeler, uygulama koduna doğrudan uygulanacak geliştirme ve kabul kriterleridir.

## Amaç

- Taksi çağırma, yolculuk yönetimi ve sürücü-yolcu eşleşme süreçlerinin güvenilir çalışmasını sağlamak.
- Yolcu, sürücü ve operasyon ekibi için net, izlenebilir ve hataya dayanıklı bir modül standardı oluşturmak.
- Konum, ücret, ödeme, bildirim ve destek akışlarında kullanıcı güvenini korumak.
- Taksi modülüyle ilgili geliştirme, test, yayın ve operasyon kararlarını ortak kriterlere bağlamak.

## Kapsam

- Yolcu taksi çağırma akışı
- Sürücü uygunluk, konum ve kabul akışları
- Canlı konum takibi
- Rota, mesafe, tahmini varış ve ücret hesaplama
- Yolculuk başlatma, tamamlama ve iptal süreçleri
- Ödeme, fiş/fatura ve kampanya kullanımı
- Bildirimler, çağrı merkezi veya destek akışları
- Yönetim paneli, yolculuk kayıtları ve operasyon raporları
- Güvenlik, kötüye kullanım ve kullanıcı şikayet süreçleri

## Temel İlkeler

- Taksi modülü gerçek zamanlı çalıştığı için gecikme, belirsizlik ve hatalı bilgi doğrudan güven kaybı yaratır.
- Yolcu ve sürücü ekranları aynı operasyon gerçeğini göstermelidir.
- Konum, ücret ve durum bilgileri açık, anlaşılır ve izlenebilir olmalıdır.
- Kritik aksiyonlarda geri dönüş, iptal ve destek seçenekleri görünür olmalıdır.
- Her yolculuk; başlangıç, bitiş, ödeme ve destek açısından kayıt altına alınmalıdır.

## Ana Sorumluluklar

- Taksi modülünün yolcu, sürücü ve yönetim paneli kapsamını takip etmek.
- Yolculuk durumlarını ve geçiş kurallarını netleştirmek.
- Konum doğruluğu, rota, tahmini süre ve ücret hesaplama kontrollerini yapmak.
- Sürücü-yolcu eşleşme mantığının iş kurallarına uygunluğunu denetlemek.
- İptal, no-show, ödeme hatası, sürücü reddi ve bağlantı kopması gibi kenar durumları takip etmek.
- Mobil görünüm, bildirim ve canlı takip deneyiminin kullanılabilirliğini kontrol etmek.
- Test senaryolarını, kabul kriterlerini ve yayın öncesi taksi modülü kontrol listesini güncel tutmak.
- Operasyonel sorunları önceliklendirip proje sahibi, teknik ekip ve destek ekibiyle paylaşmak.

## Yolculuk Durumları

| Durum | Açıklama | Kritik Kontrol |
| --- | --- | --- |
| Talep oluşturuldu | Yolcu taksi çağırır | Konum ve hedef doğru alınmalı |
| Sürücü aranıyor | Sistem uygun sürücüleri tarar | Bekleme süresi ve kapsama alanı yönetilmeli |
| Sürücü atandı | Bir sürücü yolculuğu kabul eder | Sürücü bilgisi ve ETA yolcuya gösterilmeli |
| Sürücü yolda | Sürücü yolcuya doğru ilerler | Canlı konum ve bildirimler çalışmalı |
| Yolcu alındı | Yolculuk başlar | Başlangıç zamanı ve konumu kaydedilmeli |
| Yolculuk sürüyor | Araç hedefe ilerler | Rota, ücret ve güvenlik seçenekleri erişilebilir olmalı |
| Yolculuk tamamlandı | Sürücü yolculuğu bitirir | Ücret, ödeme ve fiş akışı tamamlanmalı |
| İptal edildi | Yolcu, sürücü veya sistem iptal eder | İptal nedeni ve varsa ücret kuralı kaydedilmeli |
| Sorunlu yolculuk | Ödeme, konum veya destek sorunu oluşur | Operasyon panelinde görünür olmalı |

## Taksi Modülü Kontrol Listesi

| Alan | Kontrol | Durum | Not |
| --- | --- | --- | --- |
| Konum izni | Yolcu ve sürücü konum izinleri doğru istenmeli | Beklemede | Reddedilen izin senaryosu ayrıca tasarlanmalı |
| Harita | Alış ve varış noktaları doğru gösterilmeli | Beklemede | Harita yüklenemezse alternatif mesaj olmalı |
| Adres arama | Kullanıcı adresi kolay bulabilmeli | Beklemede | Yanlış konum seçimini azaltacak onay ekranı gerekli |
| Sürücü eşleşme | En uygun sürücü kurala göre atanmalı | Beklemede | Mesafe, uygunluk ve araç tipi dikkate alınmalı |
| ETA | Tahmini varış süresi güncel olmalı | Beklemede | Ağ gecikmesinde yanıltıcı bilgi verilmemeli |
| Ücret | Tahmini ve nihai ücret kuralları net olmalı | Beklemede | Kullanıcıya sürpriz maliyet çıkarılmamalı |
| İptal | Yolcu ve sürücü iptal akışları tanımlı olmalı | Beklemede | İptal nedeni zorunlu olabilir |
| Ödeme | Nakit, kart veya cüzdan akışı sorunsuz olmalı | Beklemede | Başarısız ödeme tekrar denenebilmeli |
| Bildirim | Sürücü atandı, geldi, başladı, bitti bildirimleri çalışmalı | Beklemede | Push ve uygulama içi bildirim birlikte kontrol edilmeli |
| Güvenlik | Acil destek, yolculuk paylaşımı veya şikayet akışı bulunmalı | Beklemede | Kritik güvenlik aksiyonları gizlenmemeli |
| Yönetim paneli | Yolculuk kayıtları operasyon tarafından izlenebilmeli | Beklemede | Durum, ücret, kullanıcı ve sürücü bilgileri filtrelenebilmeli |
| Loglama | Hatalar ve durum geçişleri kaydedilmeli | Beklemede | Kişisel veriler gereksiz loglanmamalı |
| Supabase | Partner, sürücü, yolculuk ve ödeme kayıtları güvenli bağlanmalı | Beklemede | RLS olmadan canlıya alınmamalı |
| Butonlar | Tüm CTA ve ikon butonlar gerçek aksiyona bağlanmalı | Beklemede | Boş, dekoratif veya console-only buton kalmamalı |

## Mobil Yatay Modül Düzeni

Taksi modülünde mobil ekran harita, durum ve ana aksiyon öncelikli olmalıdır. Uzun dikey alanlar aşağıdaki şekilde yatay kaydırmalı hale getirilmelidir:

| Alan | Mobil Düzen | Kontrol |
| --- | --- | --- |
| Yolculuk durumları | Yatay durum stepperi | Talep, arama, atama, yolda, başladı, tamamlandı adımları tek uzun liste olmamalı |
| Araç ve sürücü seçenekleri | Yatay seçim kartları | Fiyat, süre ve araç tipi aynı kartta karşılaştırılmalı |
| Ödeme seçenekleri | Yatay ödeme kartları | Varsayılan yöntem ilk kartta görünmeli |
| Yolculuk geçmişi | Yatay geçmiş kartları | Son yolculuk ilk kart olmalı; detay ayrı ekrana açılmalı |
| Destek aksiyonları | Yatay hızlı aksiyon şeridi | Acil destek ve şikayet aksiyonları gizlenmemeli |
| Yönetim kayıtları | Yatay kaydırmalı tablo veya kayıt kartları | Kritik kolonlar ilk görünümde tutulmalı |

## Harita Boyutu ve Tam Ekran Modu

Taksi modülündeki harita sayfanın sağ tarafını veya ilk görünümün çoğunu kaplamamalıdır. Harita ana bağlamı göstermeli, fakat form, durum ve aksiyon alanlarını ezmemelidir.

| Görünüm | Harita Boyutu | Davranış |
| --- | --- | --- |
| Mobil canlı yolculuk | İlk görünümün en fazla yüzde 38-45'i | Altında durum, sürücü ve ana aksiyonlar görünür kalmalı |
| Mobil çağırma ekranı | 220-280px yükseklik | Adres seçimi ve araç seçimi aynı ekranda erişilebilir olmalı |
| Tablet | İçeriğin en fazla yüzde 45'i | Sağ/sol kolon dengesi korunmalı |
| Masaüstü | Ana grid içinde en fazla 5/12 kolon veya 420-520px genişlik | Sağ paneli tamamen kapatmamalı |
| Yönetim paneli | Liste üstünde kompakt önizleme veya detay içinde 360-460px yükseklik | Yolculuk tablosu harita yüzünden aşağı itilmemeli |

Tam ekran harita gereksinimi:

- Harita üzerinde belirgin bir büyüt ikon butonu bulunmalıdır.
- Kullanıcı büyütmeye bastığında harita tam ekran modal veya ayrı tam ekran rota görünümünde açılmalıdır.
- Tam ekran modda yakınlaştırma, uzaklaştırma, mevcut konuma dönme, rota sığdırma ve kapat butonları çalışmalıdır.
- Tam ekran moddan çıkınca önceki sayfa durumu, seçili adres, araç tipi ve yolculuk bilgisi korunmalıdır.
- Mobilde tam ekran harita güvenli alanlara uymalı; kapat butonu ekran çentiği veya tarayıcı barı altında kalmamalıdır.
- Harita yüklenemezse kullanıcı adresi manuel girerek taksi çağırma akışına devam edebilmelidir.

## Dikey Uzama ve Yatay Kaydırma Düzeltmeleri

Uzun görünen veya dikey görüntüyü bozan alanlar kart yığınları şeklinde aşağı uzatılmamalıdır. Aşağıdaki alanlar yatay kaydırmalı, sekmeli veya detay ekranına taşınmış olmalıdır.

| Problemli Alan | Düzeltme | Kabul Kriteri |
| --- | --- | --- |
| Uzun yolculuk durum listesi | Yatay stepper | Ekran yüksekliği gereksiz uzamaz; aktif adım görünür olur |
| Araç tipi listesi | Yatay seçim kartları | Standart, konfor, geniş araç gibi seçenekler tek satırda kayar |
| Sürücü/araç bilgisi | Kompakt özet + detay drawer | Plaka, puan, ETA görünür; uzun detaylar ayrı açılır |
| Ödeme seçenekleri | Yatay ödeme kartları | Varsayılan ödeme ilk sırada görünür |
| Geçmiş yolculuklar | Yatay kart şeridi veya filtreli tablo | Son kayıtlar dikey duvar oluşturmaz |
| Admin/partner tabloları | Sticky ilk kolon + yatay scroll | Yolculuk ID, durum ve aksiyon her zaman erişilebilir olur |
| Destek aksiyonları | Yatay hızlı aksiyon menüsü | Acil destek, şikayet, sürücü ara, yolculuk paylaş kaybolmaz |

Mobil kabul notları:

- Canlı yolculuk ekranında harita ve ana durum bilgisi ilk görünümde kalmalıdır.
- Yolculuk durumları dikey zaman çizelgesi olarak ekranı uzatmamalı; yatay stepper kullanılmalıdır.
- Ücret, ETA, sürücü bilgisi ve güvenlik aksiyonları aynı anda erişilebilir olmalıdır.
- Alt sheet, sticky CTA veya bildirim alanı harita pinlerini ve ana butonları kapatmamalıdır.
- Sayfa genelinde istemsiz yatay taşma olmamalı; yatay kaydırma sadece ilgili şerit içinde olmalıdır.
- Uzun metinler en fazla 2 satırda gösterilmeli, devamı detay ekranında açılmalıdır.
- Yatay kaydırmalı alanlarda odak, klavye ve ekran okuyucu erişilebilirliği korunmalıdır.

## Çalışması Gereken Buton ve Aksiyonlar

Taksi modülünde hiçbir buton sadece görsel kalmamalıdır. Her butonun net hedefi, yükleniyor durumu, hata durumu ve başarı sonucu olmalıdır.

| Buton/Aksiyon | Bağlanacağı İşlem | Başarı Davranışı | Hata Davranışı |
| --- | --- | --- | --- |
| Taksi çağır | `taxi_trips` kaydı oluşturur | Sürücü aranıyor durumuna geçer | Konum/adres/ödeme hatası net gösterilir |
| Konumumu kullan | Tarayıcı/app konum izni ister | Alış noktası güncellenir | Manuel adres alanı açılır |
| Adresi onayla | Alış/varış noktasını doğrular | Araç ve ücret seçenekleri açılır | Eksik veya servis dışı alan mesajı gösterilir |
| Araç seç | Seçilen araç tipini trip taslağına yazar | Ücret ve ETA yenilenir | Uygun araç yoksa alternatif gösterilir |
| Sürücü kabul et | Sürücü tarafında yolculuğu üstlenir | Yolcuya sürücü bilgisi gider | Başka sürücü aldıysa durum yenilenir |
| Yolculuğu başlat | Sürücü tarafında trip durumunu günceller | Yolculuk sürüyor ekranı açılır | Yolcu alınmadıysa onay istenir |
| Yolculuğu tamamla | Ücret ve bitiş konumunu kaydeder | Ödeme/özet ekranı açılır | Ödeme veya ağ hatası tekrar denenir |
| İptal et | İptal nedeni ve tarafı kaydedilir | İptal sonucu ve varsa ücret gösterilir | Kritik durumda destek aksiyonu açılır |
| Ödeme yap | Ödeme sağlayıcı veya cüzdan akışını başlatır | Fiş ve yolculuk özeti gösterilir | Alternatif ödeme ve destek sunulur |
| Haritayı büyüt | Tam ekran harita modunu açar | Rota tam ekrana sığdırılır | Kompakt harita korunur |
| Destek al | Destek kaydı oluşturur | Talep numarası gösterilir | Mesaj veya telefon alternatifi gösterilir |
| Yolculuğu paylaş | Güvenli paylaşım linki oluşturur | Link paylaşım menüsü açılır | Link üretilemezse tekrar deneme sunulur |

## Supabase ve Partner Entegrasyonu

Taksi modülü Supabase'e partner sahipliği ve RLS kurallarıyla bağlanmalıdır. Partner sadece kendi filosu, sürücüleri, araçları ve yolculuk kayıtlarını görebilmelidir.

| Tablo | Amaç | Sahiplik Kuralı |
| --- | --- | --- |
| `taxi_partners` | Taksi işletmesi veya filo partneri | Partner organizasyonuna bağlıdır |
| `taxi_partner_users` | Partner panel kullanıcıları | Kullanıcı sadece üyesi olduğu partnerleri görür |
| `taxi_drivers` | Sürücü profili, durum ve belge bilgisi | Bir partner veya platform sürücüsüne bağlıdır |
| `taxi_vehicles` | Plaka, araç tipi, uygunluk ve belge durumu | Partner filosuna bağlıdır |
| `taxi_driver_locations` | Sürücü canlı konumları | Sadece eşleşme servisi ve yetkili operasyon erişir |
| `taxi_trips` | Yolculuk ana kaydı | Yolcu, sürücü, partner ve operasyon yetkisine göre sınırlanır |
| `taxi_trip_events` | Durum geçişleri ve audit kayıtları | İlgili trip erişimi olan roller görebilir |
| `taxi_payments` | Ödeme durumu ve tutar bilgisi | Hassas alanlar maskelenir |
| `taxi_cancellations` | İptal nedeni ve ücret kuralı | Yolculuk tarafları ve operasyon görebilir |
| `taxi_support_tickets` | Yolculuk destek kayıtları | İlgili kullanıcı, partner ve operasyonla sınırlıdır |

Supabase kabul kriterleri:

- `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` istemci tarafında, service role anahtarı sadece sunucu tarafında kullanılmalıdır.
- Tüm taksi tablolarında RLS açık olmalıdır.
- Partner sorgularında `partner_id` sahiplik kontrolü sunucu tarafında da doğrulanmalıdır.
- Yolculuk durumu değişiklikleri `taxi_trip_events` tablosuna otomatik yazılmalıdır.
- Canlı konum verisi gereksiz uzun süre tutulmamalı; saklama süresi ürün ve KVKK kararına bağlanmalıdır.
- Ödeme, kimlik belgesi, telefon ve hassas kullanıcı bilgileri loglara açık yazılmamalıdır.
- Realtime subscription sadece gerekli trip, sürücü ve operasyon kanallarıyla sınırlandırılmalıdır.
- Offline veya bağlantı kopması durumunda kullanıcıya son bilinen durum ve tekrar bağlanma mesajı gösterilmelidir.

## Test Edilecek Kritik Akışlar

1. Yolcu mevcut konumdan taksi çağırır.
2. Yolcu farklı bir alış noktası seçerek taksi çağırır.
3. Sürücü yolculuğu kabul eder ve yolcu ekranında bilgiler güncellenir.
4. Sürücü yolcuya yaklaşır ve bildirim gönderilir.
5. Yolculuk başlatılır, takip edilir ve tamamlanır.
6. Ödeme başarılı olur ve yolculuk özeti gösterilir.
7. Yolcu eşleşme öncesi iptal eder.
8. Sürücü kabul sonrası iptal eder.
9. Konum izni reddedilmiş kullanıcı manuel adres girer.
10. Ödeme başarısız olur ve tekrar deneme akışı çalışır.
11. Yolculuk sırasında destek veya şikayet akışı kullanılır.
12. Operasyon ekibi yönetim panelinden yolculuk detayını inceler.
13. Partner kullanıcısı sadece kendi filo ve yolculuk kayıtlarını görür.
14. Harita kompakt görünümden tam ekran moda açılır ve tekrar eski ekrana döner.
15. Mobilde araç, ödeme, geçmiş ve destek alanları yatay kaydırmalı çalışır.

## Önceliklendirme

| Öncelik | Tanım | Örnek |
| --- | --- | --- |
| Kritik | Yolculuk başlatmayı, güvenliği veya ödemeyi engelleyen hata | Sürücü atanmasına rağmen yolcu ekranının güncellenmemesi |
| Yüksek | Kullanıcı güvenini ciddi biçimde bozan hata | Yanlış ücret veya yanlış ETA gösterimi |
| Orta | Deneyimi bozan ama yolculuğu tamamen durdurmayan sorun | Harita pininin geç güncellenmesi |
| Düşük | Kozmetik veya nadir görülen sorun | Yolculuk özetinde küçük hizalama hatası |

## Yayın Öncesi Kabul Kriterleri

- Yolcu taksi çağırma akışı uçtan uca test edilmiştir.
- Sürücü kabul, varış, başlatma ve tamamlama akışları doğrulanmıştır.
- Konum izni reddedildiğinde kullanıcı alternatif yolla devam edebilmektedir.
- Harita, adres arama, rota, ETA ve ücret bilgileri doğru çalışmaktadır.
- İptal kuralları yolcu, sürücü ve operasyon tarafında izlenebilir durumdadır.
- Ödeme başarılı, başarısız ve tekrar deneme senaryoları test edilmiştir.
- Kritik bildirimler mobil cihazlarda kontrol edilmiştir.
- Yönetim panelinde yolculuk kayıtları filtrelenebilir ve incelenebilir durumdadır.
- Kritik ve yüksek öncelikli taksi modülü hataları kapatılmıştır.
- Harita kompakt boyutta kalır; kullanıcı isterse tam ekran harita moduna geçebilir.
- Uzun dikey alanlar yatay kaydırmalı, sekmeli veya detay ekranlı hale getirilmiştir.
- Tüm butonlar gerçek API, state update veya kullanıcı aksiyonuna bağlıdır.
- Partner Supabase bağlantısı RLS ve sahiplik kontrolüyle çalışır.

## Periyodik Kontroller

| Sıklık | Kontrol |
| --- | --- |
| Her geliştirme tamamlandığında | İlgili yolculuk akışı ve durum geçişleri test edilir |
| Günlük | Açık kritik taksi modülü hataları gözden geçirilir |
| Haftalık | İptal nedenleri, ödeme hataları ve destek kayıtları incelenir |
| Sprint sonunda | Yolcu, sürücü ve yönetim paneli regresyon testleri yapılır |
| Yayın öncesi | Kabul kriterleri ve canlı senaryo kontrolleri tamamlanır |
| Aylık | Eşleşme başarısı, bekleme süresi, iptal oranı ve ödeme başarısı raporlanır |

## İletişim ve Raporlama

- Taksi modülü bulguları yolculuk ID, kullanıcı tipi, cihaz, konum, adım, beklenen davranış ve mevcut davranışla raporlanmalıdır.
- Konum, ücret, ödeme ve güvenlik sorunları kritik öncelikle ele alınmalıdır.
- Sürücü-yolcu uyuşmazlıklarında kayıtlar operasyon ekibiyle birlikte incelenmelidir.
- Teknik hatalarda log, zaman damgası, API cevabı ve ekran görüntüsü birlikte paylaşılmalıdır.
- Kullanıcı etkisi olan sorunlarda destek ekibi için hazır açıklama metni oluşturulmalıdır.

## Sorumluluk Matrisi

| Rol | Sorumluluk |
| --- | --- |
| Taksi modülü sorumlusu | Modül kapsamını, iş kurallarını, test senaryolarını ve yayın uygunluğunu takip eder |
| Ürün ekibi | Yolcu, sürücü ve operasyon ihtiyaçlarını önceliklendirir |
| Tasarım ekibi | Yolculuk ekranları, harita deneyimi, durum göstergeleri ve destek akışlarını tasarlar |
| Geliştirme ekibi | Eşleşme, konum, ödeme, bildirim ve yönetim paneli özelliklerini uygular |
| QA ekibi | Uçtan uca yolculuk, ödeme, bildirim ve regresyon testlerini yapar |
| Operasyon ekibi | Canlı yolculuk sorunlarını, sürücü performansını ve destek kayıtlarını takip eder |
| Teknik lider | Mimari, performans, veri güvenliği ve yayın uygunluğunu onaylar |

## Açık Riskler

| Risk | Etki | Olasılık | Öncelik | Aksiyon |
| --- | --- | --- | --- | --- |
| Konum bilgisinin hatalı alınması | Yüksek | Orta | Kritik | Konum doğrulama ve manuel adres alternatifi eklenmeli |
| Sürücü eşleşmesinin gecikmesi | Yüksek | Orta | Yüksek | Eşleşme zaman aşımı ve alternatif sürücü kuralı tanımlanmalı |
| Ücretin yanlış hesaplanması | Yüksek | Düşük-Orta | Kritik | Ücret motoru testleri ve operasyon onayı yapılmalı |
| Ödeme başarısızlığının yönetilememesi | Yüksek | Orta | Yüksek | Tekrar deneme, nakit alternatif ve destek akışı hazırlanmalı |
| Bildirimlerin ulaşmaması | Orta | Orta | Orta | Push, SMS veya uygulama içi yedek bildirim stratejisi belirlenmeli |
| Güvenlik akışının görünür olmaması | Yüksek | Düşük-Orta | Kritik | Acil destek ve şikayet aksiyonları yolculuk ekranında erişilebilir olmalı |
| Haritanın sayfanın büyük kısmını kaplaması | Orta-Yüksek | Orta | Yüksek | Kompakt harita ölçüsü ve tam ekran harita modu uygulanmalı |
| Uzun içeriklerin dikey görünümü bozması | Orta | Yüksek | Yüksek | Stepper, yatay kart şeridi ve detay drawer kullanılmalı |
| Partnerin başka kayıtları görmesi | Yüksek | Orta | Kritik | Supabase RLS ve sunucu tarafı `partner_id` kontrolü zorunlu olmalı |
| Butonların boş veya çalışmaz kalması | Yüksek | Orta | Kritik | Her buton için API, loading, success ve error state testi yazılmalı |

## Teslim Çıktıları

- Taksi modülü iş kuralları ve durum geçişleri
- Yolcu, sürücü ve yönetim paneli test senaryoları
- Konum, rota, ETA ve ücret doğrulama notları
- İptal, ödeme hatası ve destek senaryosu kayıtları
- Harita kompakt/tam ekran davranışı kabul sonucu
- Mobil yatay kaydırma ve uzun içerik düzeltme kontrol sonucu
- Supabase tablo, RLS ve partner sahiplik matrisi
- Çalışan buton ve aksiyon test listesi
- Yayın öncesi taksi modülü kontrol listesi sonucu
- Önceliklendirilmiş taksi modülü hata listesi
