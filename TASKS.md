# TASKS

## Öncelik 1 - Üretime Hazırlık

- [x] Tek dosyalık mevcut mağaza kodunu modüler proje yapısına taşı.
- [x] Supabase bağlantısını ortak servis katmanına al.
- [x] Aktif ürün listeleme, ürün detayı, sepet, favoriler ve auth sayfalarını oluştur.
- [x] Kullanıcı adres yönetimini Supabase `addresses` tablosuna bağla.
- [x] Checkout akışını iyzico CheckoutForm Edge Function sözleşmesine bağla.
- [x] Checkout yasal onaylarını ve iyzico yönlendirme mantığını kart bilgisi toplamadan hazırla.
- [x] Footer yasal linklerini ve şirket bilgilerini Allona Shop odağıyla düzenle.
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
