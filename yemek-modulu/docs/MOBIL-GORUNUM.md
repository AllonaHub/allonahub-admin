# Yemek Modülü Mobil Görünüm Notu

Yemek modülünde şu an çalışan HTML arayüzü bulunmuyor. Modül; Supabase şeması, satışa hazır ürün verisi, ürün görselleri ve sözleşme testlerinden oluşuyor.

## Merkezi Mobil Çekirdek

Yemek modülü için frontend eklendiğinde mobil görünüm ayrı modül CSS'iyle çözülmemelidir. Sayfa aşağıdaki merkezi çekirdeği kullanmalıdır:

```html
<link rel="stylesheet" href="../shared/mobile/mobile-core.css">
<script defer src="../shared/mobile/mobile-core.js"></script>
```

## Mobil Düzen Standardı

- Ürün kartları mobilde uzun dikey liste olmamalı; yatay kaydırmalı ürün şeridi kullanılmalıdır.
- Kategori, mutfak türü, fiyat, teslimat süresi ve uygunluk filtreleri yatay chip grubu olmalıdır.
- Sepet özeti sticky alanla içerik üstüne binmemeli; mobilde ayrı alt panel veya kompakt özet olarak çalışmalıdır.
- Ürün görselleri 4:3 katalog oranını korumalı ve ana yemek odağı kırpılmamalıdır.
- Kampanya, popüler ürün, yeni ürün ve restoran/partner listeleri yatay kart şeritleriyle gösterilmelidir.
- Geniş sipariş, stok veya partner tabloları kendi kapsayıcısında yatay kaymalı veya mobil kart görünümüne dönüşmelidir.
- Sayfa genelinde istemsiz yatay taşma olmamalıdır.

## Önerilen Mobil Şeritler

| Alan | Mobil Düzen | Kontrol |
| --- | --- | --- |
| Kategoriler | Yatay chip grubu | Çok satıra taşıp ekranı kapatmamalı |
| Ürün vitrini | Yatay ürün kartları | Görsel, ürün adı, fiyat ve sepete ekle görünür olmalı |
| Popüler ürünler | Yatay ürün şeridi | En çok satan ilk kartta olmalı |
| Sepet önerileri | Yatay öneri kartları | Ek ürün ve içecek önerisi hızlı seçilmeli |
| Sipariş geçmişi | Yatay kayıt kartları | Son sipariş ilk kartta olmalı |
| Partner paneli | Yatay metrik ve ürün yönetim kartları | Stok, fiyat ve yayın durumu erişilebilir olmalı |

## Kabul Kriterleri

- 320px, 375px, 390px, 414px ve tablet kırılımlarında ürün kartları taşmadan görünür.
- Ürün görselleri mobilde yemeğin ana odağını kaybetmez.
- Sepete ekle, miktar artır/azalt ve ödeme aksiyonları en az 44px dokunma alanına sahiptir.
- Filtreler ve ürün listeleri merkezi mobil çekirdek üzerinden yatay şerit davranışı alır.
- Yemek modülüne özel mobil düzen gerekiyorsa önce `shared/mobile/mobile-core.css` içinde genel kural olarak değerlendirilir.

