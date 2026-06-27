# Yemek Modülü Görsel Denetimi

Mevcut çalışma alanında daha önce oluşturulmuş yemek ürünü görseli bulunamadı. Bu nedenle uyumsuz görsel değiştirme yerine yemek modülü için satışa hazır örnek katalog görselleri üretildi ve ürün isimleriyle tek tek eşleştirildi.

## Eklenen Görseller

| Ürün | Dosya | Sonuç |
| --- | --- | --- |
| Tavuk Döner Dürüm | `../assets/img/tavuk-doner-durum.png` | Dürüm, tavuk parçaları ve tabak sunumu görünüyor; uyumlu |
| Lahmacun | `../assets/img/lahmacun.png` | İnce kıymalı lahmacun, limon, maydanoz ve soğanla görünüyor; uyumlu |
| Mercimek Çorbası | `../assets/img/mercimek-corbasi.png` | Turuncu mercimek çorbası, limon ve ekmekle görünüyor; uyumlu |
| Fıstıklı Baklava | `../assets/img/fistikli-baklava.png` | Fıstıklı baklava dilimleri net görünüyor; uyumlu |

## Kullanılan Üretim Standardı

- Ürün tek ana odak olarak yer aldı.
- 4:3 katalog kartı kırpımına uygun kompozisyon istendi.
- Metin, watermark, marka, insan ve alakasız tabaklar dışlandı.
- Teslimat uygulaması ürün kartına uygun temiz restoran masa üstü tercih edildi.

## Otomatik Kontrol

`src/food-module-contract.mjs` içindeki `inferImageNameMatch(product)` fonksiyonu ürün adı, slug, görsel yolu, alt metin, etiket ve içerik alanlarını anahtar kelimeyle karşılaştırır.

Bu yöntem görselin kendisini semantik olarak görmez; canlı uygulamada admin onayı veya görsel sınıflandırma servisiyle desteklenmelidir. Yine de yanlış dosya/alt metin eşleşmelerini erken yakalamak için kullanışlıdır.

