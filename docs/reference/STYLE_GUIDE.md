# STYLE GUIDE

## Marka Hissi

AllonaHub premium, canlı, güven veren ve modüler bir süper uygulama deneyimi sunmalıdır. Ana sayfa ilk bakışta ekosistem kapısı gibi çalışmalı; modüller, premium üyelik ve partner ekosistemi net görünmelidir.

Yeni görsel kaynak `/index.html` içindeki kullanıcı tarafından verilen anasayfadır. Açık talimat gelmedikçe bu anasayfa kodu değiştirilmez; yeni sayfalar ve bileşenler bu tasarım diline göre uyarlanır.

Anasayfa stilleri `/css/allonahub-home.css`, davranış kodları `/js/allonahub-home.js` dosyasında tutulur. Yeni düzenlemelerde inline `<style>`, inline `<script>` ve inline event handler kullanımından kaçınılır.

Ortak footer, dil seçici ve tema seçici platform standardıdır. Yeni sayfalarda `/css/platform.css`, `/js/platform.js` ve `data-layout="footer"` kullanılır; footer kopyalanmaz.

## Renkler

- Ana koyu renk: gece laciverti `#020814`
- İkinci koyu renk: ekosistem laciverti `#061b33`
- Vurgu mavisi: neon mavi `#00e5ff`
- İkinci renk: altın `#ffd700`
- Arka plan: koyu degrade ve ışıklı kartlar
- Kartlar: beyaz, hafif gölge
- Kullanıcı temaları: `ocean`, `forest`, `sunset`, `graphite`

## UI Kuralları

- Ana sayfada verilen mevcut radius ve grid kararları korunur.
- Destekleyici sayfalarda Allona Shop anasayfasındaki yuvarlak kart, altın CTA ve mavi vurgu dili takip edilir.
- Gölge hafif ve doğal olmalı.
- Animasyonlar kısa, minimal ve işlevsel olmalı.
- Butonlar erişilebilir kontrastta olmalı.
- Form alanlarında label kullanılmalı.
- Mobilde temel aksiyonlar tek elle ulaşılabilir olmalı.
- Giriş Yap / Hesabım alanının yanında dil ve tema seçimi görünür kalmalı.
- Boş veya geçici linkler 404 üretmemeli; ilgili modül, destek, arama veya partner akışına bağlanmalı.

## Tipografi

- Sistem fontları kullanılır.
- Başlıklar net ve kısa olmalı.
- Ürün kartlarında fiyat, stok ve aksiyonlar kolay taranmalı.

## Responsive

- Desktop: 12 kolon mantığında geniş grid.
- Tablet: 2-3 kolon ürün grid.
- Mobil: tek kolon ürün grid, yatay taşma yok.

## Erişilebilirlik

- Her görselde `alt` metni olmalı.
- Icon button'larda `aria-label` bulunmalı.
- Form hata ve başarı mesajları metinle de aktarılmalı.
- Klavye odak çizgisi görünür kalmalı.
