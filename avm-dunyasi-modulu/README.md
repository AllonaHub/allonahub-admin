# ALLONAHUB AVM Dünyası Modülü

Bu klasör AVM Dünyası için çalışan statik modül prototipini içerir.

## Girişler

- `index.html`: Kullanıcı tarafı AVM keşfi, mağaza/restoran listesi, kampanya, kupon, değerlendirme ve yatay shop vitrini.
- `shop.html`: Trendyol/Hepsiburada benzeri kategori navigasyonu ve ürün katalog görünümü.
- `partner.html`: AVM partneri HTML içeriği; partner onboarding, profil, mağaza, restoran, shop, kampanya, onay, rapor ve destek bölümleri.
- `admin.html`: AVM admin paneli; AVM sorumlusu mağazaları, işletmeleri, restoranları, ürünleri, kampanyaları, kuponları, etkinlikleri, harita pinlerini, değerlendirmeleri, siparişleri ve onay kuyruğunu yönetir.

## Veri Katmanı

- `assets/js/data.js`: Public kaynaklı AVM dizini seed verisi, örnek mağazalar, restoranlar, ürünler, kampanyalar, kuponlar ve değerlendirmeler.
- `assets/js/shop-categories.js`: Shop kategori menüsü, kategori kırılımı, arama ve ürün grid deneyimi.
- `assets/js/supabase-client.js`: Supabase bağlantısı varsa tabloları REST API üzerinden okur; bağlantı yoksa seed veriyle çalışır.
- `assets/css/shop-categories.css`: Shop katalog ve gömülü kategori menüsü arayüz stilleri.
- `supabase/schema.sql`: Canlı Supabase kurulumu için tablo, RLS, sahiplik, admin ve partner politikaları.

## Supabase Bağlantısı

Admin panelinde `Ayarlar` sekmesine girip Project URL ve anon key kaydedilebilir. Alternatif olarak HTML yüklenmeden önce şu global değerler verilebilir:

```html
<script>
  window.ALLONAHUB_SUPABASE_URL = "https://project.supabase.co";
  window.ALLONAHUB_SUPABASE_ANON_KEY = "public-anon-key";
</script>
```

Beklenen ana tablolar:

- `malls`
- `stores`
- `products`
- `campaigns`
- `coupons`
- `events`
- `reviews`

## Shop Akışı

Ürün kartlarında fiyat, stok, puan, değerlendirme sayısı, `Sepete Ekle` ve `Hemen Al` aksiyonları vardır. Ürünler seçili AVM'ye göre yatay kaydırmalı vitrinde gösterilir.

## Kaynak Notu

AVM isimleri public dizin seed verisi olarak eklendi. Canlı ürün için AVM partner onboarding, resmi AVM doğrulaması ve Supabase tablosundaki `verification_status` alanı zorunlu kullanılmalıdır.
