# DEPLOY

## 1. Supabase

1. Supabase projesinde SQL Editor aç.
2. Veritabanı temelini kurmak için `supabase/schema.sql` içeriğini çalıştır. Bu dosya sonraki tarihli migration'ların yerine geçmez.
3. Ardından `supabase/migrations/20260619110000_security_hardening.sql` migration'ını çalıştır.
4. Admin, partner, kurye ve finans rolleri için Supabase MFA ayarlarını etkinleştir.
5. MFA aktif olduktan sonra `supabase/migrations/20260619193000_enterprise_security_controls.sql` migration'ını çalıştır.
6. Auth URL ayarlarına canlı domaini ekle.
7. Denizcilik tablolarını aşağıdaki sıralı deploy komutuyla uygula ve doğrula.
8. Storage bucketlarını oluştur:
   - `product-images`
   - `brand-assets`
   - `partner-documents`
9. Edge Function secretlarını ekle:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="..."
supabase secrets set IYZICO_API_KEY="..."
supabase secrets set IYZICO_SECRET_KEY="..."
supabase secrets set IYZICO_BASE_URL="https://sandbox-api.iyzipay.com"
supabase secrets set SITE_URL="https://allonahub.com"
supabase secrets set ALLOWED_ORIGINS="https://allonahub.com"
supabase secrets set CV_PRICE_TRY="149.99"
```

Canlı geçişte `IYZICO_BASE_URL` iyzico üretim adresine alınmalıdır.

### 1.1 Denizcilik Migration'ları

Denizcilik migration'ları `schema.sql`, security hardening ve MFA enterprise security migration'larından sonra uygulanır. Script, MFA ile güçlendirilmiş admin/partner helper'larını doğrular ve mevcut denizcilik migration listesini tek transaction içinde çalıştırır; herhangi biri hata verirse hiçbirini kısmi bırakmaz.

```bash
SUPABASE_DB_URL="postgresql://..." ./deploy/maritime/apply-maritime-migrations.sh
```

Migration'lar daha önce uygulandıysa salt-okunur üretim kontrolü ayrıca çalıştırılabilir:

```bash
SUPABASE_DB_URL="postgresql://..." ./deploy/maritime/check-maritime-schema.sh
SUPABASE_DB_URL="postgresql://..." ./deploy/maritime/check-maritime-hiring-core.sh
```

Komutlar bağlantı adresini veya secret değerlerini çıktılamaz. `supabase/schema.sql` tek başına güncel üretim şeması sayılmaz; tarih sıralı migration'lar deploy kaydının parçasıdır.

## 2. Edge Functions

```bash
supabase functions deploy create-iyzico-checkout
supabase functions deploy create-cv-checkout
supabase functions deploy iyzico-callback
```

CV ödeme akışı için `iyzico-callback` fonksiyonu hem ürün siparişi `orderId` callback'ini hem de CV ödeme `cvPaymentId` callback'ini işler. `create-cv-checkout` başarılı ödeme başlatır, callback başarılı dönerse kullanıcıya 1 ücretli CV üretim kredisi eklenir.

Kartlı ödeme akışında AllonaHub e-posta, telefon, teslimat ve yasal onay bilgilerini toplar; kart numarası, son kullanma tarihi veya CVC alanı açmaz. Sipariş kaydı sonrası kullanıcı iyzico CheckoutForm `paymentPageUrl` adresine yönlendirilir; kart verisi yalnızca iyzico güvenli ödeme ekranında girilir ve dönüş `iyzico-callback` token sorgulamasıyla doğrulanır.

## 3. GitHub

1. Dosyaları GitHub reposuna yükle.
2. Varsayılan branch'i korumaya al.
3. Cloudflare Pages veya GitHub Pages yayını bağla.

## 3.1 Hetzner Backend API

Frontend GitHub Pages/Cloudflare tarafında kalır. Backend API Hetzner CPX31 üzerinde `api.allonahub.com` olarak çalıştırılır.

Detaylı kurulum:

```text
docs/deploy/hetzner-cpx31-backend.md
```

Ana deploy komutları:

```bash
cp deploy/hetzner/.env.production.example deploy/hetzner/.env.production
nano deploy/hetzner/.env.production
docker compose -f deploy/compose/docker-compose.hetzner-traefik.yml up -d --build
curl https://api.allonahub.com/health
```

Coolify olmayan Nginx sunucularında alternatif config:

```bash
cp deploy/hetzner/nginx/api.allonahub.com.conf /etc/nginx/sites-available/api.allonahub.com
ln -sf /etc/nginx/sites-available/api.allonahub.com /etc/nginx/sites-enabled/api.allonahub.com
nginx -t
systemctl reload nginx
```

## 3.2 Hetzner Kurumsal E-posta Yönlendirme

`allonahub.com` için kurumsal inbound e-posta adresleri Hetzner sunucusunda Postfix virtual alias forwarding ile hazırlanır. Tüm gelen postalar `allonahub@gmail.com` adresine yönlendirilir.

Detaylı kurulum ve DNS kayıtları:

```text
docs/deploy/hetzner-email-forwarding.md
deploy/hetzner/mail-forwarding/dns-records.txt
```

Ana kurulum komutları:

```bash
cd /opt/allonahub
git pull --ff-only origin main
sudo bash deploy/hetzner/setup-mail-forwarding.sh
bash deploy/hetzner/check-mail-forwarding.sh
```

Cloudflare/Domain DNS tarafında `mail.allonahub.com` A kaydı ve `allonahub.com` MX kaydı tanımlanmadan canlı teslimat tamamlanmış sayılmaz. Hetzner Cloud tarafında outbound TCP 25 kapalıysa Gmail'e forward teslimatı için Hetzner port açma talebi veya harici SMTP/mail relay gerekir.

## 4. Cloudflare

- SSL: Full Strict
- Cache: HTML kısa, CSS/JS/assets uzun cache
- WAF: temel bot ve rate limit kuralları
- Rate limit: kayıt, giriş, partner başvuru, checkout, CV ödeme, admin ve cron URL'leri
- Cloudflare Access: `admin.allonahub.com` ve Coolify dashboard için zorunlu
- Security Headers: HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Bot koruması: şüpheli form POST ve hızlı checkout denemelerine challenge
- Redirect: `http` -> `https`
- Domain: canlı özel domain

## 5. Yayın Öncesi Kontrol

- Ürün listeleme Supabase'den geliyor.
- `status = active` dışındaki ürünler görünmüyor.
- Register, login, forgot password, profile akışı çalışıyor.
- Sepet toplamı doğru hesaplanıyor.
- Checkout sipariş oluşturuyor ve iyzico sayfasına yönlendiriyor.
- CV formunda ilk hesap için 2 ücretsiz CV/PDF üretim hakkı çalışıyor.
- Aynı cihazdan ikinci veya sonraki hesap CV hakkı talep ederse admin bildiriminde riskli profil görünüyor.
- Ücretsiz CV hakları bitince kullanıcı `/pages/career/cv-payment.html` sayfasına yönleniyor.
- Admin rolü olmayan kullanıcı admin paneline erişemiyor.
- Admin, partner, kurye ve finans kritik işlemleri MFA olmadan reddediliyor.
- `public.security_audit_events` tablosunda sipariş, ödeme, callback, admin ve yetki reddi eventleri oluşuyor.
- Denizcilik şema kontrolü altı tabloda RLS, beklenen policy/grant ve idempotency indekslerini doğruluyor.
- Allona Maritime hiring core kontrolü Seafarer Workspace, Readiness Passport, Partner Maritime Workspace, Allona Connect, Crew Room, Trust Oversight, time-boxed sensitive access ve append-only audit tablolarında RLS/grant/policy sınırlarını doğruluyor.
- Broker teklifleri yalnızca talep sahibi, teklif sahibi MFA partner veya MFA admin yetki sınırında okunabiliyor; anonim ya da doğrudan istemci yazması kapalı.
- Partner ilanı yalnız MFA + onaylı denizcilik partneriyle `pending_review` oluşuyor; aktif vitrine yalnız Ops Admin inceleme endpointiyle geçiyor.
- Admin denizcilik kuyruğunda partner başvuru kararı ve ilan kararı audit eventleri oluşuyor; ret notu partnere geri dönüyor.
- Teklif kabul RPC'si yalnız `service_role` execute grantine sahip; talep, seçilen teklif, diğer teklifler ve `accepted` olayı tek transaction içinde güncelleniyor.
- Teklif kabul v2 RPC'si kilit altında `acceptance_changed` raporluyor; eşzamanlı idempotent çağrılarda yalnız gerçek değişiklik audit üretiyor ve backend transaction dışı ön okuma yapmıyor.
- Navlun takip ekranı yalnız sahip olunan olay türü/zamanını gösteriyor; event payload ve başka kullanıcının geçmişi istemciye gelmiyor.
- Bildirim merkezi yalnız sahip olunan navlun olaylarını allowlist ile gösteriyor; oturumsuz durumda giriş CTA'sına düşüyor ve admin bildirim tablosunu sorgulamıyor.
- Bildirim CTA'sı yalnız UUID doğrulamalı `#request-...` hash'i kullanıyor; takip ekranı dinamik render sonrası ilgili kartı vurguluyor ve rota/yük içeriğini URL'ye taşımıyor.
- Partner OS denizcilik menü rozeti yalnız süresi geçmemiş, teklifsiz aktif davetleri sayıyor; terminal/eski eşleşmeler sayıya girmiyor.
- Denizcilik kısayollarını içeren kullanıcı paneli araması inline stil/handler kullanmıyor; semantik form Enter ile çalışıyor ve üye numarası kopyalama listener üzerinden bağlanıyor.
- Maritime kullanıcı paneli “Son İşlemlerim” alanı owner-RLS olaylarından besleniyor; veri alınamazsa sahte HP işlemi yerine navlun takip CTA'sı gösteriyor ve action badge gizli kalıyor.
- Navlun eşleştirmesi yalnız MFA Ops Admin ve onaylı/partner rolündeki navlun sağlayıcısıyla oluşuyor; partner başka eşleşmeyi göremiyor veya teklif veremiyor.
- Partner teklif RPC'si eşleşme/teklif/talep/event geçişlerini atomik yapıyor ve teklif tutarını audit metadata'ya yazmıyor.
- Partner eşleşme reddi ve teklif geri çekme RPC'leri yalnız `service_role` ile çalışıyor; tekrar çağrılar ikinci olay üretmiyor ve kalan aktif işe göre talep durumunu atomik yeniden hesaplıyor.
- Denizcilik uzlaştırma cron'u timing-safe secret kontrolüyle çalışıyor; RPC süresi dolan işleri ve terminal taleplerde kazanan dışı eşleşmeleri sınırlı match-first batch içinde kapatıyor, aktif talebi kalan işe göre `quoted`, `matching` veya `in_review` yapıyor.
- Halka açık denizcilik ilan endpointi yalnızca aktif, yayınlanmış ve süresi dolmamış `module_key = maritime` kayıtlarını döndürüyor.
- Denizcilik ana araması navlun/CV/destek terimlerini gerçek akışlara, diğer terimleri `module = maritime` detayına yönlendiriyor; public vessel kartı role-aware özel denizcilik partner CTA'sına ulaşıyor.
- Ana denizcilik ve Maritime CV hero'ları gerçek liman/gemi fotoğrafını tam yüzey kullanıyor; H1 ürün adını taşıyor ve 1440/390/320 px görsel testlerinde CTA, durum bandı, yatay taşma ve sonraki bölüm ipucu kontrollerini geçiyor.
- Ana denizcilik ve Maritime CV geçiş sayfalarında skip-link ilk Tab'da anında görünür 3 px altın odak halkası alıyor; Enter ana içeriği odaklıyor ve 1440/320 px'de yatay taşma üretmiyor.
- Maritime crew pozisyon ön dolgusu source allowlist'iyle ve kayıtlı CV yüklemesinden sonra uygulanıyor; preview HTML'i escape ediliyor, pasif URL ziyareti sekmeye özel CV taslağını otomatik değiştirmiyor.
- Maritime CV taslağı kullanıcı açıkça temizleyene kadar sürümlü `localStorage` yedeğinde ve oturum açıldığında `maritime_cv_profiles` hesabında kalıcı tutuluyor; eski oturum taslağını bir kez taşıyor, bozuk veya yanlış modüllü veriyi reddediyor ve eksik CV'yi güvenli sunucu taslağı olarak saklıyor.
- Maritime CV taslak yüklemesi alan/satır allowlist'i ile uzunluk sınırlarını uyguluyor; profil fotoğrafını JPEG/PNG/WebP ve 2 MB ile sınırlıyor, güvenilmeyen data URL'yi reddediyor ve önizlemede anlamlı alternatif metin içeriyor.
- Maritime CV araç çubuğu 320/390 px görünümde iki sütuna geçiyor; dört kontrolün tamamı ilk görünümde kesilmeden kullanılabiliyor ve belge yatay taşmıyor.
- Maritime CV PDF kütüphaneleri sabit CDN sürümü, SHA-384 SRI, anonim CORS ve `no-referrer` ile yükleniyor; değiştirilmiş yanıt çalıştırılmıyor, eksik bağımlılık kontrollü uyarı veriyor.
- PDF denetleyicisi hızlı çift tetikte tek üretim yapıyor, render hatasında UI kilidini temizliyor ve ad/soyaddan dosya sistemi karakteri taşımayan sınırlı bir dosya adı üretiyor.
- Headless gerçek-kütüphane smoke testi dört sayfalı, `%PDF-` imzalı 1 MB üzeri dosyayı güvenli önerilen adla indirdi; işlem sonunda düğme ve `pdf-capture` durumu temiz kaldı.
- Maritime CV statik ve dinamik form işlemleri inline event attribute kullanmıyor; allowlist'li editör delegation katmanı bilinmeyen satır/alan/index değerini yok sayıyor ve üç tekrarlı bölümde 50 satır sınırını UI'da da uyguluyor.
- Maritime CV base CSS ve form mantığı yerel dış dosyalara çıkarıldı; sayfa inline style/script/event/style attribute veya runtime `.style` üretmiyor. Fotoğraf `hidden`, dinamik gruplar 8 px sınıf deseni kullanıyor.
- CSS/JS çıkarım regresyonu A4 print genişliği/beyaz zemin ile 320/390 px kaydırmasız toolbar görünümünü doğruluyor.
- Maritime CV editöründe test edilen 88/88 kontrol programatik ada ve benzersiz ID'ye sahip; statik/dinamik label odağı, dil değişimi sonrası yeniden render ve yerelleştirilmiş beceri ARIA adları doğrulandı.
- `html[lang]`, toolbar, selector ARIA, fotoğraf alt'ı ve uyarılar EN/TR/AZ/RU ile eşzamanlı değişiyor; e-posta/telefon mobil klavye ipuçları ve 320 px dört dil metin uyumu kontrol edildi.
- `localStorage` dil tercihi okunamaz/yazılamaz olduğunda hata loglanmadan bellek içi dil değişimi çalışmayı sürdürüyor.
- Maritime CV kontrolleri statik alanlarda 2000, dinamik satır alanlarında 300 `maxlength` uyguluyor; programatik input, önizleme ve session taslağı aynı sınırda tutuluyor.
- Dinamik update/remove fonksiyonları kendi key/index doğrulamasını tekrar yapıyor; bilinmeyen/özel key, negatif ve taşan index doğrudan global çağrıda da veri/prototype değiştirmiyor.
- Navlun oluşturma/iptal akışları kullanıcı JWT'sini doğruluyor; partner başvurusu doğrudan Supabase yazması yapmıyor.
- Navlun oluşturma endpointi service-role-only RPC üzerinden talep + `submitted` olayını atomik ve yarış güvenli idempotency ile yazıyor; istemci veya backend iki tabloya ayrı ayrı yazmıyor.
- Navlun iptal endpointi sahiplik ve durum kararını service-role-only RPC içinde kilitliyor; `cancelled` durumu ile olay kaydı atomik, tekrar çağrı idempotent kalıyor.
- Navlun takip ekranı iptal isteğini offline/15 saniye timeout sınırında toparlıyor; hata sonrası iki aşamalı onayı sıfırlıyor, 401'de giriş görünümüne dönüyor ve yalnız doğrulanmış iptal yanıtını karta uyguluyor.
- Teklif kabul ekranı talep bazlı mutation kilidiyle paralel teklif seçimlerini engelliyor; offline/timeout/HTTP hatasında tüm onay düğmelerini sıfırlıyor ve yalnız kimlik/durum/zamanı doğrulanmış kabul yanıtını render ediyor.
- Navlun takip ekranı temel kartları detay sorgularından önce çiziyor, tüm RLS okumalarını 8 saniyeyle sınırlıyor ve gecikmeli detay render'ında deep-link odağını koruyor; giriş dönüşüne yalnız UUID allowlist'li hash ekleniyor.
- Takip ekranı ana/detay okuma hatasında mobil uyumlu `Yeniden Dene` kontrolü gösteriyor; retry tek uçuşlu, mevcut kartları koruyor ve başarılı tam yüklemede kendini gizliyor.
- Maritime giriş zinciri meta refresh/inline kod içermeyen `login.html`, `register.html` ve `forgot-password.html` formlarını kullanıyor; auth sayfaları güvenli aynı-origin dönüşü birbirine aktarıyor ve dış origin'i kullanıcı paneline düşürüyor.
- Oturumsuz navlun formu taslağı login yönlendirmesinde sekmede kalıyor; başarılı giriş aynı maritime intent'ine dönüp rota, miktar, birim ve laycan alanlarını geri yüklüyor.
- Navlun oluşturma formu çift gönderimi kilitliyor, 15 saniyede kontrollü biçimde toparlanıyor ve 730 günlük laycan penceresini backend ile aynı hesaplıyor; ağ hatasında idempotency taslağı korunuyor.
- Partner başvuru challenge'ı statik platform CSS'iyle çiziliyor, Turnstile action `maritime_partner_application` olarak doğrulanıyor; ağ tekrarında aynı güvenli idempotency kimliği ve yeni challenge tokenı kullanılıyor.
- Mobil, tablet ve desktop görünüm kontrol edildi.
