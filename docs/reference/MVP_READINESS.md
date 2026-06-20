# MVP READINESS

AllonaHub halka açık açılışına yalnızca aşağıdaki sistemler çalışır, test edilmiş ve onaylanmış olduğunda izin verilir.

## Zorunlu Açılış Kilidi

1. Süper Admin Paneli
2. Admin Paneli
3. Kullanıcı Paneli
4. Partner Paneli
5. Sipariş Sistemi
6. iyzico Ödeme Sistemi
7. HP / Kupon Sistemi
8. Finans ve Komisyon Merkezi
9. Bildirim Sistemi
10. Hetzner Backend Geçişi

## Transaction Core Durumu

Bu çalışma Transaction Core MVP katmanını kurar:

- Supabase adres RLS ve tek varsayılan adres kuralı.
- Supabase aktif sepet ve sepet kalemi tabloları.
- Server-side sipariş oluşturma RPC'si.
- Ürün fiyatı, stok, kupon, HP ve kargo toplamlarının server-side doğrulanması.
- Kullanıcı Kupon Merkezi.
- Admin sipariş, kupon ve HP/XP ekranları.
- Partner sipariş kalemi görünümü ve sınırlı durum güncelleme akışı.
- iyzico ödeme başlatma/callback durumlarının yeni sipariş alanlarıyla uyumu.

## Canlı Açılış Öncesi Zorunlu Testler

- Kullanıcı adres ekleyebilmeli, varsayılan adres seçebilmeli ve adres silebilmeli.
- Ürün sepete eklenmeli; aynı ürün tekrar eklenince quantity artmalı.
- Sepet boşken checkout engellenmeli.
- Adres yokken checkout engellenmeli.
- Kupon süresi, kullanım limiti ve minimum sepet tutarı doğru çalışmalı.
- HP indirimi günlük/sipariş limitlerine uymalı ve toplamı negatif yapmamalı.
- Sipariş oluşunca aktif sepet `completed` olmalı.
- iyzico ödeme başlatma sayfası açılmalı; kart bilgisi yalnız iyzico ekranında girilmeli.
- iyzico callback başarılı ödemede siparişi `paid`, başarısız ödemede `failed/pending` yapmalı.
- Partner sadece kendi sipariş kalemlerini görmeli.
- Partner sadece `preparing`, `shipped`, `delivered` durumlarına güncelleyebilmeli.
- Admin tüm siparişleri görmeli, fraud/status/admin note alanlarını yönetebilmeli.
- Kullanıcı başka kullanıcının siparişini görememeli.
- Frontend fiyat manipülasyonu yapılsa bile RPC ürün fiyatını Supabase ürün tablosundan yeniden hesaplamalı.

## Operasyon Notu

HP gerçek para cüzdanı değildir. MVP'de yalnızca indirim hakkı, kupon avantajı ve kampanya hakkı olarak gösterilir. Nakit çekim ve gerçek para bakiyesi gösterimi kapalıdır.
