# Yemek Modülü Sorumlusu

Bu doküman ALLONAHUB proje yönetimi kapsamında yemek modülünün mevcut durumunu, eksiklerini, Supabase/partner entegrasyonunu, görsel kalite standardını, buton aksiyonlarını, kurye entegrasyonu hazırlığını ve satışa hazır yayın kriterlerini tanımlar.

## Mevcut Teknik Bulgular

27 Haziran 2026 itibarıyla yerel ALLONAHUB proje klasörü incelendi.

| Alan | Durum | Aksiyon |
| --- | --- | --- |
| Çalışan yemek uygulama kodu | Bulunamadı | Kullanıcı arayüzündeki canlı butonlar teknik olarak çalıştırılamadı; yeni modül iskeleti eklendi |
| Yemek modülü klasörü | Yeni eklendi | `yemek-modulu/` altında kurulum, Supabase, veri, görsel, entegrasyon ve test dosyaları oluşturuldu |
| Supabase bağlantısı | Canlı bağlantı doğrulanamadı | `.env` ve Supabase proje bilgisi yok; migration, seed ve health-check scripti hazırlandı |
| Partner ürün yükleme akışı | Yeni tanımlandı | Partner sadece kendi restoran/ürün kayıtlarını yönetir; onay sonrası kullanıcı tarafına düşer |
| Görsel kontrolü | Yeni örnek katalogla hazırlandı | Dört satışa hazır ürün için isimle uyumlu yeni görseller üretildi ve modüle eklendi |
| Buton aksiyonları | Yeni sözleşme eklendi | CTA ve ikon butonları için tablo, fonksiyon ve durum matrisi tanımlandı |
| Diğer modüllerle ayrışma | Yeni kural eklendi | Tüm tablo, dosya, event ve payload adları `food_` / `food.` namespace altında tutuldu |
| Kurye entegrasyonu | Hazırlık katmanı eklendi | `food_delivery_handoffs` ve `food-courier-handoff.v1` payload yapısı hazırlandı |
| Yeni kurulum | Eklendi | `food_module_setups` tablosu ve `default_sale_ready_marketplace` kurulumu seed edildi |

Kritik not: Bu klasörde gerçek frontend/backend uygulaması olmadığı için mevcut canlı buton, route veya Supabase sorgusu doğrudan düzeltilemedi. Bunun yerine yemek modülünün uygulama reposuna taşınabilecek teknik temeli, veri modeli, buton sözleşmesi, görsel standardı ve satışa hazır örnek ürünleri oluşturuldu.

## Oluşturulan Teknik Çıktılar

| Dosya | Amaç |
| --- | --- |
| `yemek-modulu/README.md` | Modül kapsamı, dosya haritası ve hızlı doğrulama |
| `yemek-modulu/KURULUM.md` | Supabase migration/seed, env ve test kurulumu |
| `yemek-modulu/supabase/migrations/20260627000100_yemek_modulu.sql` | Yemek modülü şeması, RLS, storage bucket, kurye handoff yapısı |
| `yemek-modulu/supabase/seed/20260627000100_yemek_modulu_seed.sql` | Satışa hazır demo partner, kategori, ürün ve kurulum verisi |
| `yemek-modulu/assets/data/sale-ready-products.json` | Ürün adı, fiyat, stok, görsel, alerjen ve teslimat profiliyle katalog verisi |
| `yemek-modulu/assets/img/*.png` | Ürün isimleriyle uyumlu katalog görselleri |
| `yemek-modulu/src/food-module-contract.mjs` | Buton aksiyonu, ürün validasyonu, görsel eşleşme ve kurye payload sözleşmesi |
| `yemek-modulu/src/food-supabase-repository.mjs` | Supabase repository fonksiyon iskeleti |
| `yemek-modulu/src/supabase-health-check.mjs` | Supabase REST bağlantı kontrol scripti |
| `yemek-modulu/tests/food-module-contract.test.mjs` | Satışa hazır ürün, görsel eşleşme, namespace ve kurye payload testleri |
| `yemek-modulu/docs/GORSEL-DENETIM.md` | Görsel uygunluk raporu ve yeni görsel üretim notları |

## Amaç

- Kullanıcıların restoran ve yemek ürünlerine güvenilir, hızlı ve satışa hazır şekilde ulaşmasını sağlamak.
- Partner restoranların ürün yüklediğinde ürünlerin doğru onay akışına düşmesini ve yalnızca kendi kayıtlarını yönetmesini sağlamak.
- Ürün adı, açıklama, fiyat, stok, görsel ve teslimat bilgisini tek bir kalite standardına bağlamak.
- Sipariş akışını ileride kurye modülüne bağlanabilecek şekilde şimdiden ayrık ve izlenebilir kurmak.
- Diğer modüllerle tablo, dosya, event, route ve yetki karışıklığını önlemek.

## Kapsam

- Restoran/partner profili
- Yemek kategorileri
- Menü ve ürün yönetimi
- Ürün görseli, alerjen, içerik, stok ve fiyat kontrolü
- Kullanıcı ürün listeleme, sepet ve sipariş hazırlığı
- Partner ürün yükleme, taslak, inceleme, onay, yayın ve pasifleştirme akışı
- Supabase tablo, RLS, storage ve audit log yapısı
- Kurye entegrasyonu için teslimat handoff kaydı ve event modeli
- Mobil görünümde yatay ürün şeritleri, filtreler ve hızlı aksiyonlar
- Yayın öncesi QA ve satışa açıklık kontrolü

## Temel İlkeler

- Ürün kullanıcıya gösterilmeden önce satışa hazır olmalıdır: ad, açıklama, fiyat, para birimi, stok, kategori, görsel, alerjen ve teslimat profili eksiksiz olmalıdır.
- Partner içerikleri admin onayı olmadan kullanıcı tarafında aktif satışa çıkmamalıdır.
- Görsel ürün adını yanıltmamalıdır. Lahmacun görseli çorba, döner görseli tatlı gibi kullanılmamalıdır.
- Yemek modülü kendi namespace'iyle ayrılmalıdır: tablo adları `food_`, event adları `food.`, storage bucket adı `food-product-images`.
- Kurye modülü bugün yoksa bile sipariş teslimat bilgisi ayrı handoff kaydında tutulmalıdır.
- Stokta olmayan, fiyatı eksik, görseli hatalı veya alerjen bilgisi belirsiz ürün satışa açılmamalıdır.

## Partner Ürün Akışı

| Adım | Sorumlu | Durum | Kritik Kontrol |
| --- | --- | --- | --- |
| Ürün taslağı oluşturma | Partner | `draft` | Partner sadece kendi `partner_id` alanıyla kayıt açabilir |
| Görsel yükleme | Partner | `draft` | Dosya tipi, boyut, alt metin ve isim-görsel eşleşmesi kontrol edilir |
| İncelemeye gönderme | Partner | `pending_review` | Eksik fiyat, stok, kategori, alerjen veya görsel varsa engellenir |
| İçerik kontrolü | Admin/operasyon | `approved` veya `rejected` | Yanıltıcı isim, alakasız görsel ve eksik içerik reddedilir |
| Yayına alma | Admin/otomasyon | `active` | Satışa hazırlık validasyonu geçmeden aktif olamaz |
| Geçici kapatma | Partner/admin | `paused` veya `sold_out` | Stok ve çalışma saati kullanıcı tarafına doğru yansır |
| Arşivleme | Partner/admin | `archived` | Aktif siparişi olan ürün doğrudan silinmez |

## Çalışması Gereken Buton ve Aksiyonlar

Hiçbir yemek modülü butonu yalnızca görsel kalmamalıdır. Her butonun hedef işlemi, yükleniyor durumu, hata durumu ve başarı sonucu olmalıdır.

| Buton/Aksiyon | Bağlanacağı İşlem | Başarı Davranışı | Hata Davranışı |
| --- | --- | --- | --- |
| Kategori seç | `food_categories` filtresi | Ürün listesi kategoriye göre yenilenir | Boş kategori mesajı gösterilir |
| Ürünü aç | `food_products` detay sorgusu | Detay, alerjen ve seçenekler görünür | Ürün pasifse alternatif önerilir |
| Sepete ekle | Sepet state veya sipariş taslağı | Adet ve toplam tutar güncellenir | Stok/fiyat hatası net gösterilir |
| Adet artır/azalt | Sepet kalemi güncelleme | Toplamlar yeniden hesaplanır | Minimum/maksimum adet uyarısı verilir |
| Favorile | Kullanıcı favori kaydı | Kalp/ikon durumu güncellenir | Oturum gerekiyorsa giriş yönlendirmesi açılır |
| Siparişi ver | `food_orders` kaydı | Sipariş `confirmed` veya ödeme adımına geçer | Eksik adres, ödeme veya stok hatası gösterilir |
| Partner ürün ekle | `food_products` insert | Ürün taslak olarak kaydedilir | Yetki veya zorunlu alan hatası gösterilir |
| Görsel yükle | `food-product-images` bucket | Görsel ürün medyasına bağlanır | Tip, boyut veya eşleşme hatası gösterilir |
| İncelemeye gönder | Ürün validasyonu + status update | Ürün admin kuyruğuna düşer | Eksik alan listesi gösterilir |
| Admin onayla | Status `approved`/`active` | Ürün kullanıcı tarafında görünür olur | Satışa hazır değilse onay engellenir |
| Stokta yok yap | Status `sold_out` | Ürün satış dışı görünür | Aktif sipariş varsa bilgi verilir |
| Kurye hazırlığı oluştur | `food_delivery_handoffs` insert | Kurye modülüne hazır payload oluşur | Adres veya paket bilgisi eksikse engellenir |

## Supabase Kabul Kriterleri

- `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` istemci tarafında; service role anahtarı yalnızca sunucu tarafında kullanılmalıdır.
- Tüm yemek tablolarında RLS açık olmalıdır.
- Partner sorgularında `partner_id` sahiplik kontrolü hem RLS hem sunucu tarafı repository katmanında doğrulanmalıdır.
- Kullanıcı tarafı yalnızca `active` ve satışa hazır ürünleri görebilmelidir.
- Partner başka partnere ait ürün, sipariş, görsel veya teslimat kaydını okuyamamalı ve değiştirememelidir.
- Admin onayları ve partner değişiklikleri `food_audit_logs` tablosuna yazılmalıdır.
- Görsel bucket MIME tipi ve maksimum boyut kısıtlamasıyla korunmalıdır.
- Sipariş ve teslimat eventleri ayrı tutulmalı; kurye modülü geldiğinde `food_delivery_handoffs` üzerinden bağlanmalıdır.

## Görsel Uygunluk Standardı

| Kontrol | Kural |
| --- | --- |
| İsim uyumu | Ürün adıyla ana görseldeki yemek aynı olmalı |
| Ana nesne | Görselde ürün tek ana odak olmalı; alakasız yemekler öne çıkmamalı |
| Katalog kalitesi | Temiz, iştah açıcı, kırpılmamış, teslimat uygulaması kartına uygun olmalı |
| Metin ve logo | Görselde yazı, watermark, marka veya yanıltıcı logo olmamalı |
| Alerjen görünürlüğü | Görsel alerjen bilgisinin yerini tutmaz; alerjen alanı ayrıca zorunlu olmalı |
| Mobil görünüm | 4:3 veya kare karta kırpıldığında yemek tanınabilir kalmalı |

Yeni eklenen görseller:

| Ürün | Görsel | Denetim |
| --- | --- | --- |
| Tavuk Döner Dürüm | `yemek-modulu/assets/img/tavuk-doner-durum.png` | Uyumlu |
| Lahmacun | `yemek-modulu/assets/img/lahmacun.png` | Uyumlu |
| Mercimek Çorbası | `yemek-modulu/assets/img/mercimek-corbasi.png` | Uyumlu |
| Fıstıklı Baklava | `yemek-modulu/assets/img/fistikli-baklava.png` | Uyumlu |

## Kurye Entegrasyonu Hazırlığı

Kurye modülüyle bugün doğrudan bağlantı kurulmadı; buna karşılık yemek modülü siparişten bağımsız bir handoff katmanı hazırladı.

| Alan | Hazırlık |
| --- | --- |
| Teslimat kaydı | `food_delivery_handoffs` |
| Teslimat eventleri | `food_delivery_events` |
| Payload şeması | `food-courier-handoff.v1` |
| Kaynak modül | `food` |
| Sipariş bağlantısı | `food_orders.id` |
| Kurye bağlantı alanı | `courier_module_ref` |
| İleri entegrasyon | Kurye modülü geldiğinde kendi assignment ID değerini bu alana yazabilir |

Kurye entegrasyonu için yemek modülünün gönderdiği payload restoran teslim alma noktası, müşteri teslim adresi, sipariş kalemleri, paket sayısı, sıcak/soğuk taşıma ihtiyacı ve tahmini hazır olma süresini içerir.

## Mobil Yatay Modül Düzeni

| Alan | Mobil Düzen | Kontrol |
| --- | --- | --- |
| Kategori filtreleri | Yatay chip grubu | Ekranı kaplamadan kaydırılır |
| Öne çıkan ürünler | Yatay ürün kartları | Görsel, ad, fiyat ve sepete ekle butonu görünür kalır |
| Restoran ürünleri | Bölümlü liste + yatay öneriler | Uzun menüler tek duvar haline gelmez |
| Sepet özeti | Sticky alt bar | Toplam ve ödeme CTA görünür kalır |
| Partner ürün listesi | Yatay durum kartları veya kompakt tablo | Taslak, incelemede, aktif, stokta yok ayrışır |
| Sipariş durumu | Yatay stepper | Hazırlanıyor, hazır, kuryeye uygun, teslim edildi adımları tek uzun liste olmaz |

## Test Edilecek Kritik Akışlar

1. Kullanıcı yemek kategorisi seçer ve ürün listesi doğru filtrelenir.
2. Kullanıcı ürün detayını açar, alerjen ve fiyat bilgisini görür.
3. Kullanıcı ürünü sepete ekler, adet değiştirir ve toplam doğru hesaplanır.
4. Stokta olmayan ürün sepete eklenemez.
5. Partner yeni ürün taslağı oluşturur.
6. Partner görsel yükler ve ürün incelemeye gönderilir.
7. Eksik görsel, fiyat veya alerjen bilgisi olan ürün incelemeye gönderilemez.
8. Admin ürünü onaylar ve ürün kullanıcı tarafında aktif görünür.
9. Partner sadece kendi ürünlerini ve siparişlerini görür.
10. Başka partnere ait ürün ID'siyle erişim denemesi reddedilir.
11. Ürün görseli adıyla uyumsuzsa sistem inceleme uyarısı üretir.
12. Sipariş oluşturulduğunda kurye handoff kaydı hazırlanır.
13. Kurye modülü yokken yemek siparişi bozulmaz; teslimat kaydı beklemede kalır.
14. Mobilde kategori, ürün kartı, sepet ve partner ürün listesi taşma olmadan çalışır.

## Yayın Öncesi Kabul Kriterleri

- Yemek modülü gerçek uygulama reposuna bağlanmış ve route/component/API karşılığı oluşturulmuştur.
- Supabase migration canlı projeye uygulanmış, RLS politikaları doğrulanmıştır.
- `supabase-health-check.mjs` canlı Supabase REST sorgusundan başarılı sonuç almıştır.
- Partner ürün yükleme akışı taslak, inceleme, onay ve aktif satış durumlarını geçmiştir.
- Kullanıcı tarafında yalnızca satışa hazır `active` ürünler görünmektedir.
- Ürün adı, kategori, fiyat, stok, görsel, alerjen ve teslimat profili eksiksizdir.
- Tüm butonlar gerçek aksiyonlara bağlıdır; boş, console-only veya dekoratif CTA kalmamıştır.
- Ürün görselleri adlarıyla uyumludur ve mobil kart kırpımında tanınabilir kalmaktadır.
- Diğer modül tablolarına veya assetlerine yazılmamaktadır.
- Kurye entegrasyonu için handoff kaydı ve payload üretimi test edilmiştir.
- Kritik ve yüksek öncelikli yemek modülü hataları kapatılmıştır.

## Açık Riskler

| Risk | Etki | Olasılık | Öncelik | Aksiyon |
| --- | --- | --- | --- | --- |
| Gerçek uygulama kodunun bu klasörde olmaması | Canlı butonlar düzeltilemez | Yüksek | Kritik | Uygulama reposu bağlanmalı |
| Supabase env bilgisinin olmaması | Canlı bağlantı test edilemez | Yüksek | Kritik | Proje URL ve anon key sağlanmalı |
| Partner sahiplik kontrolünün atlanması | Başka partner verisi sızabilir | Orta | Kritik | RLS ve repository kontrolü birlikte kullanılmalı |
| Görsel-isim uyumsuzluğu | Kullanıcı yanıltılır, iade/şikayet oluşur | Orta | Yüksek | Görsel denetimi ve admin onayı zorunlu kalmalı |
| Kurye modülü erken sıkı bağlanırsa | Sipariş akışı kırılabilir | Orta | Yüksek | Handoff/event modeliyle gevşek bağlantı korunmalı |

## Günlük Takip Formatı

| Alan | İçerik |
| --- | --- |
| Bugün incelenen alan | Ürün, görsel, partner, Supabase, sipariş veya kurye hazırlığı |
| Bulunan hata | Ekran, buton, veri, görsel veya yetki hatası |
| Yapılan düzeltme | Dosya, migration, veri veya kabul kriteri |
| Test sonucu | Geçti, kaldı, bloklu |
| Blokaj | Env, uygulama reposu, ürün kararı veya tasarım ihtiyacı |
| Ertesi gün odağı | İlk ele alınacak yemek modülü işi |

