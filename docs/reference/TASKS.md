# TASKS

## Zorunlu Açılış Kilidi - AllonaHub MVP

Bu 10 sistem çalışır ve doğrulanmış duruma gelmeden halka açık açılışa izin yoktur.

- [ ] Süper Admin Paneli
- [ ] Admin Paneli
- [ ] Kullanıcı Paneli
- [ ] Partner Paneli
- [ ] Sipariş Sistemi
- [ ] iyzico Ödeme Sistemi
- [ ] HP / Kupon Sistemi
- [ ] Finans ve Komisyon Merkezi
- [ ] Bildirim Sistemi
- [ ] Hetzner Backend Geçişi

## Öncelik 0 - Transaction Core MVP

- [x] Kullanıcı adres kaydı için `addresses` RLS ve default adres kurallarını migration'a ekle.
- [x] Gerçek Supabase sepeti için `carts`, `cart_items` ve sepet RPC'lerini hazırla.
- [x] Sipariş oluşturmayı `create_transaction_order(...)` RPC'sine taşı.
- [x] Checkout'u kart bilgisi toplamadan iyzico yönlendirmesine bağla.
- [x] Kupon ve HP indirimini MVP seviyesinde server-side doğrula.
- [x] Kullanıcı Kupon Merkezi sayfasını ekle.
- [x] Admin sipariş, kupon ve HP/XP yönetim ekranlarını genişlet.
- [x] Partner Siparişlerim ekranını partner sipariş kalemleriyle hazırla.
- [x] iyzico Edge Function durum güncellemelerini yeni `status` alanıyla uyumlu yap.
- [ ] Canlı Supabase projesinde `supabase/migrations/20260621015000_transaction_core_mvp.sql` migration'ını çalıştır.
- [ ] Canlı iyzico sandbox/prod secret değerlerini Edge Functions'a gir ve ödeme turunu uçtan uca test et.
- [ ] Partner/admin sipariş durumu güncellemesini canlı RLS altında gerçek rollerle test et.

## Öncelik 0 - Yeni Allona Shop Mimari Kararı

- [x] Kullanıcı tarafından verilen tek dosyalık Allona Shop anasayfasını `/index.html` olarak birebir kaydet.
- [x] Önceki anasayfayı silmeden `docs/archive/index-before-allona-shop-homepage.html` altında arşivle.
- [x] Kanonik anasayfa referansını `docs/architecture/allona-shop-homepage-canonical.html` olarak sakla.
- [x] Ana sayfadaki ürün CTA bağlantısı için `/pages/commerce/odeme.html` uyumluluk sayfasını ekle.
- [x] Ana sayfadaki yasal bağlantı için `/pages/legal/mesafeli-satis-sozlesmesi.html` uyumluluk sayfasını ekle.
- [x] Yeni mimari kararını `docs/architecture/ALLONA_SHOP_ARCHITECTURE.md` ile dokümante et.
- [ ] Canlıya çıkmadan önce yasal metinleri hukuk/onay sürecinden geçir.

## Öncelik 0.1 - AllonaHub Süper Uygulama Anasayfa Güncellemesi

- [x] Kullanıcı tarafından verilen AllonaHub süper uygulama anasayfasını `/index.html` olarak birebir kaydet.
- [x] Önceki kanonik anasayfayı `docs/archive/index-before-super-app-homepage-*.html` altında arşivle.
- [x] Yeni kanonik referansı `docs/architecture/allonahub-superapp-homepage-canonical.html` olarak sakla.
- [x] Yeni anasayfanın beklediği uyumluluk rota ve görsellerini ekle.
- [x] Anasayfa CSS ve JavaScript kodlarını `/css/allonahub-home.css` ve `/js/allonahub-home.js` dosyalarına ayır.

## Öncelik 0.2 - Platform Geneli Ortak Deneyim

- [x] `/pages/account/login.html` ile aynı `data-layout="footer"` mekanizmasını bütün modüllere yay.
- [x] Ortak footer içeriğini `/js/layout.v3.js` üzerinden tek kaynak haline getir.
- [x] Dil seçici ve tema seçiciyi Giriş Yap / Hesabım alanının yanına ekle.
- [x] Platform temalarını `ocean`, `forest`, `sunset`, `graphite` olarak tanımla.
- [x] Çok dilli yapı için `/i18n/` dil paketlerini ve opsiyonel online çeviri endpoint altyapısını ekle.
- [x] Dosyası olmayan iç bağlantıları çalışan sayfalara veya gerçek modül hedeflerine bağla.
- [x] Yeni destek/uyumluluk sayfalarını ortak header, ortak footer ve ana sayfa tasarım diliyle oluştur.

## Öncelik 1 - Üretime Hazırlık

- [x] Tek dosyalık mevcut mağaza kodunu modüler proje yapısına taşı.
- [x] Supabase bağlantısını ortak servis katmanına al.
- [x] Aktif ürün listeleme, ürün detayı, sepet, favoriler ve auth sayfalarını oluştur.
- [x] Kullanıcı adres yönetimini Supabase `addresses` tablosuna bağla.
- [x] Checkout akışını iyzico CheckoutForm Edge Function sözleşmesine bağla.
- [x] Checkout yasal onaylarını ve iyzico yönlendirme mantığını kart bilgisi toplamadan hazırla.
- [x] Footer yasal linklerini ve şirket bilgilerini AllonaHub odağıyla düzenle.
- [x] Footer, dil ve tema altyapısını platform geneline bağla.
- [x] Supabase SQL şemasını ve RLS politikalarını dokümante et.
- [ ] Supabase SQL Editor üzerinden `supabase/schema.sql` içeriğini canlı projeye uygula.
- [ ] Supabase Storage bucketlarını oluştur: `product-images`, `brand-assets`, `partner-documents`.
- [ ] iyzico sandbox anahtarlarını Supabase Edge Function secret olarak ekle.
- [ ] Cloudflare domain, SSL ve cache kurallarını yayına hazırla.

## Öncelik 2 - Yönetim

- [x] Admin panel iskeleti: ürün, sipariş, kupon ve kullanıcı görünümü.
- [x] Partner panel iskeleti: ürün, stok, sipariş ve rapor görünümü.
- [ ] Admin ürün görsel yüklemesini Supabase Storage ile tamamla.
- [ ] Sipariş durum güncellemelerinde e-posta/SMS bildirimi ekle.
- [ ] Kupon kullanım limitleri ve minimum sepet kontrollerini Edge Function tarafına taşı.

## Öncelik 3 - Güvenlik ve Kalite

- [x] XSS için frontend render yardımcılarında HTML escape kullan.
- [x] Supabase RLS politikalarını tablo bazında hazırla.
- [ ] Supabase Auth rate limit ve email template ayarlarını canlı ortamda yapılandır.
- [ ] Cloudflare WAF ve bot fight mode kurallarını etkinleştir.
- [ ] Lighthouse performans, erişilebilirlik ve SEO skorlarını ölç.

## Öncelik 4 - Ölçekleme

- [ ] Çok satıcılı yapı için partner komisyon ve ödeme bölüştürme tablolarını netleştir.
- [ ] Kargo entegrasyonu için sağlayıcı bağımsız servis katmanı tasarla.
- [ ] Ürün varyantları, iade talepleri ve destek talepleri tablolarını ekle.
