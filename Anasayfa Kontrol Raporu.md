# Anasayfa Kontrol Raporu

Bu rapor ALLONAHUB ana sayfası için yapılan statik kaynak, link, i18n, tema ve mobil görünüm denetim sonuçlarını özetler.

## Kontrol Tarihi

- Tarih: 27 Haziran 2026
- Kapsam: `index.html`, ana sayfa CSS/JS dosyaları, i18n dosyaları, ana sayfa linkleri, service worker cache referansları
- Not: Commit ve push yapılmadı. Commit/push için proje sahibinden ayrıca onay beklenmelidir.

## Denetlenen Dosyalar

| Dosya | Amaç |
| --- | --- |
| `index.html` | Ana sayfa içerik, navigasyon, hero, hizmetler, premium ve partner alanları |
| `css/allonahub-home.css` | Ana sayfa temel görünüm ve responsive kuralları |
| `css/platform.css` | Ortak tema, dil, mobil shell ve modül rayı kuralları |
| `css/home-module-labels.std32.css` | Hizmet kartı metin boyutu ve taşma kuralları |
| `js/allonahub-home.js` | Hero reklam slider, konum ve mobil modül sıralaması |
| `js/platform.js` | Tema, dil, çeviri, ortak kontroller ve link onarımları |
| `js/layout.v3.js` | Ortak footer/header üretimi ve layout davranışı |
| `i18n/*.json` | Dil paketleri ve ortak çeviri katalogları |
| `sw.js`, `sw-reset2.js` | PWA/cache kaynak referansları |

## Çalıştırılan Kontroller

| Kontrol | Sonuç |
| --- | --- |
| JavaScript syntax kontrolü | Temiz |
| `index.html` yerel `href` / `src` dosya kontrolü | 62 referans kontrol edildi, eksik yok |
| Ana sayfa `a[href]` hedef kontrolü | 47 link kontrol edildi, eksik dosya yok |
| Service worker cache referansları | Her iki dosyada 19 referans kontrol edildi, eksik yok |
| i18n JSON parse kontrolü | `tr`, `en`, `de`, `ru`, `ar`, `az`, `catalog` geçerli JSON |
| Viewport ölçümleri | 1440, 1024, 768, 430, 390, 375, 320 px kontrol edildi |
| Tema ölçümleri | Ocean, Corporate, White kontrol edildi |
| Mobil global yatay taşma | `documentElement` seviyesinde taşma yok |

## Genel Durum

Ana sayfa temel olarak çalışır durumda. Ana dosya linkleri, görseller, CSS/JS referansları ve service worker cache kaynaklarında kırık dosya bulunmadı. Masaüstü, tablet ve mobil ölçümlerde sayfa genelinde global yatay scroll oluşmuyor.

Buna rağmen mobil görünümde ve içerik okunabilirliğinde iyileştirilmesi gereken noktalar var. Özellikle mobil header/navigasyon alanı, hizmet kartı açıklama fontları ve canlı dil değiştirme kapsamı dikkat istiyor.

## Kritik Bulgular

Kritik seviyede, ana sayfanın açılmasını veya ana hizmet bağlantılarının dosya seviyesinde çalışmasını engelleyen kırık tespit edilmedi.

## Yüksek Öncelikli Bulgular

| Alan | Bulgu | Etki | Öneri |
| --- | --- | --- | --- |
| Mobil navigasyon | 430px ve altında header nav içinde yatay scroll oluşuyor. 320px ölçümde nav içerik farkı yaklaşık 187px. | Kullanıcı bazı menü öğelerini fark etmeyebilir veya zor erişebilir. | Mobilde nav tek sütun veya iki satırlı tam görünür grid olarak sabitlenmeli; yatay nav scroll kaldırılmalı. |
| Mobil üst mini nav | 430px ve altında top mini nav yatay taşan scroll alanına dönüşüyor. 320px ölçümde fark yaklaşık 438px. | HP, kupon, destek, akademi gibi bağlantılar görünmeden sağda kalıyor. | Mobilde mini nav kısa bir yatay chip rayıysa görsel ipucu eklenmeli; değilse 2 satırlı grid yapılmalı. |
| Dil değiştirme testi | `file://` ortamında dil JSON fetch çalışmadığı için canlı çeviri doğrulaması tam yapılamadı. Statik dosyalar geçerli, ancak localhost/canlı test gerekli. | Dil değiştirince gerçek çeviri davranışında kaçan metin veya RTL görünüm riski kalır. | Proje sahibinden localhost test onayı alınıp canlı HTTP ortamında dil geçişleri tekrar test edilmeli. |

## Orta Öncelikli Bulgular

| Alan | Bulgu | Etki | Öneri |
| --- | --- | --- | --- |
| Hizmet kartı okunabilirliği | Masaüstünde 21 kart açıklaması 9.5px seviyesine düşüyor. Mobilde bazı uzun açıklamalar 8px seviyesine iniyor. | Metinler özellikle mobilde ve erişilebilirlik açısından zayıf kalıyor. | Kart açıklamalarında minimum 11px mobil, 12px masaüstü hedeflenmeli; uzun açıklamalar kısaltılmalı. |
| Mobil hizmet rayı | Hizmetler alanı 2 satırlı yatay ray olarak çalışıyor. Global taşma yok, fakat 31 kartın büyük kısmı ilk ekranda gizli. | Tasarım bilinçli olabilir; ancak kullanıcı tüm hizmetleri fark etmeyebilir. | Rayın sağa devam ettiğini gösteren fade/ok/scroll göstergesi eklenmeli veya kategori filtreli yapı düşünülmeli. |
| Hero dot rayı | Reklam dot alanı masaüstü ve mobilde yatay scroll üretiyor. Global sayfayı bozmuyor. | 31 slider noktası çok yoğun görünüyor; kontrol hissi zayıflayabilir. | Dot sayısı azaltılmalı, aktif modül adı + ileri/geri butonları kullanılmalı veya dot rayı daha kompakt yapılmalı. |
| Header yüksekliği | 768px tablet ölçümünde header yaklaşık 211px yüksekliğe çıkıyor. | İlk ekranın büyük kısmı navigasyona gidiyor; hero aşağı itiliyor. | Tablet kırılımında arama ve nav daha sıkı düzenlenmeli. |

## Düşük Öncelikli Bulgular

| Alan | Bulgu | Etki | Öneri |
| --- | --- | --- | --- |
| Çeviri kapsamı | Statik i18n kapsamında çoğu metin var; eksik görünenler marka, paket adı, fiyat ve iki premium madde. | Marka/fiyat çevrilmeyebilir; çoğu kabul edilebilir. | Marka ve fiyatlar çevrilmeyebilir; premium maddeleri istenirse i18n dosyalarına eklenmeli. |
| PWA test ortamı | `file://` testinde i18n fetch uyarıları oluşuyor. | Yerel dosya testine özgü; canlı HTTP ortamında tekrar doğrulanmalı. | HTTP tabanlı test için açık onayla sınırlı localhost sunucusu kullanılmalı. |

## Mobil Ölçüm Özeti

| Genişlik | Global yatay taşma | Nav scroll | Mini nav scroll | Hizmet rayı | Not |
| --- | --- | --- | --- | --- | --- |
| 430px | Yok | Var | Var | Var | Genel sayfa stabil, nav/mini nav gizli içerik bırakıyor |
| 390px | Yok | Var | Var | Var | Kart açıklamalarında 8px metinler var |
| 375px | Yok | Var | Var | Var | Header stabil ama nav tamamen görünür değil |
| 320px | Yok | Var | Var | Var | En dar ekranda okunabilirlik riski artıyor |

## Dil ve RTL Notları

- `i18n/tr.json`, `en.json`, `de.json`, `ru.json`, `ar.json`, `az.json` ve `catalog.json` geçerli JSON.
- Arapça için `dir="rtl"` ayarı kodda uygulanıyor.
- `file://` testinde tarayıcı güvenliği nedeniyle JSON fetch yapılamadığı için metinler canlı olarak çevrilemedi.
- Statik kapsam kontrolünde 132 ana metinden yalnızca 11 tanesi çeviri kapsamı dışında göründü; bunların çoğu marka, paket adı ve fiyat gibi çevrilmesi şart olmayan metinler.

## Link ve Kaynak Durumu

- Ana sayfadaki yerel dosya referanslarında eksik yok.
- Ana sayfadaki link hedeflerinde eksik dosya yok.
- Ana sayfa hero görselleri ve modül görselleri dosya olarak mevcut.
- Service worker cache listesinde eksik kaynak yok.

## Önerilen Düzeltme Sırası

1. Mobil header nav ve top mini nav görünürlüğünü düzelt.
2. Hizmet kartı açıklama fontlarını minimum okunabilir seviyeye çek.
3. Mobil hizmet rayına devam göstergesi veya daha anlaşılır kategori yapısı ekle.
4. Hero dot kontrolünü sadeleştir.
5. HTTP ortamında dil değiştirme ve Arapça RTL görünümü tekrar test et.
6. Gerekirse eksik premium çeviri maddelerini i18n paketlerine ekle.

## Commit ve Push Durumu

- Commit yapılmadı.
- Push yapılmadı.
- Kod düzeltmesi yapıldı: mobil ana sayfa header içindeki dil ve tema butonları 94px'lik iki ikonlu sabit grid olarak kilitlendi.
- 430px, 390px, 375px ve 320px kırılımlarında TR, EN, DE, RU ve AR geçişleri ölçüldü.
- Ölçüm sonucu: dil ve tema butonlarında header dışına taşma yok, kontrol alanında yatay scroll yok, sayfa genelinde yatay taşma yok.
- Proje sahibi onayıyla commit ve push adımlarına geçilmelidir.
