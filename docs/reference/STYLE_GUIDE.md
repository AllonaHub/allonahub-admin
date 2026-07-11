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

## Geriye Dönük Görsel Bütünlük

- `origin/main` üzerindeki mevcut sayfa yapısı görsel tabandır. Açık kullanıcı talimatı olmadan mevcut hero, görsel, bölüm, kart, metin, kontrol, link, rota, grid, renk paleti, tipografi veya tema varsayılanı kaldırılamaz, yeniden sıralanamaz ya da başka bir tasarımla değiştirilemez.
- Geliştirme eklemeli yapılır. Yeni işlev mevcut yüzeyi değiştirmek yerine ayrı bileşen, ayrı rota veya mevcut tasarım diline uyan dar bir eklenti olarak uygulanır.
- Ortak `/css/platform.css`, `/js/platform.js`, `/css/allonahub-home.css` ve `/js/allonahub-home.js` değişiklikleri tüm siteyi etkiler. Bu dosyalarda global tema, grid veya görünüm değişikliği otomasyon tarafından yapılamaz.
- Mevcut rota veya dosya kullanımdan kaldırılacaksa silinmez; eski içerik korunur ve geriye uyumlu yönlendirme eklenir.
- Arayüz değişikliğinden önce 1440 px ve 390 px ekran görüntüsü ile bölüm, link ve kontrol envanteri alınır. Sonraki görüntüde yalnız açıkça hedeflenen alan değişebilir; eksilen bölüm veya beklenmeyen görsel fark varsa değişiklik yayınlanmaz.
- Görünümü etkileyen otomasyon değişiklikleri, testler geçse bile kullanıcı görsel onayı olmadan production'a gönderilemez.

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
