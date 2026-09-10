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

## Öncelik 0.3 - Denizcilik Modülü

- [x] `pages/ecosystem/allonadenizcilik.html` sayfasını mobile-first, platform footer uyumlu ve gerçek CTA/link akışlarıyla yenile.
- [x] Eski `pages/ecosystem/denizcilik.html` rotasını inline script/style içermeyen uyumluluk köprüsüne çevir.
- [x] `pages/career/maritime-cv.html` sayfasını otomatik script yönlendirmesi yerine CV formu, denizcilik modülü ve destek CTA'ları veren geçiş sayfası yap.
- [x] Denizcilik linkleri ve taslak metadatasını repo genelindeki kanonik `module_key = maritime` değeriyle hizala.
- [x] Navlun ön talebinde rota/tonaj bilgisini URL'den çıkar; sekmeye özel, süreli taslak geri yükleme ve istemci doğrulaması ekle.
- [x] Backend'e bağlı olmayan crew ve gemi örneklerini canlı/aktif ilan gibi göstermeyen rol ve arama profillerine dönüştür.
- [x] Kullanıcının yalnızca kendi kayıtlarını RLS ile okuyabildiği `pages/account/maritime-requests.html` navlun takip ekranını ekle.
- [x] Crew kartlarından gelen güvenli `source` ve `position` parametrelerini Maritime CV formunda pozisyon ön dolgusuna bağla.
- [x] Maritime CV pozisyon ön dolgusunu kayıtlı taslaktan sonra deterministik uygula; sentetik input/çift auto-save'i kaldır ve pasif URL ziyaretinin taslağı değiştirmesini önle.
- [x] Maritime CV profil fotoğrafı önizlemesine anlamlı alternatif metin ekle.
- [x] Genel partner sayfasındaki şema dışı doğrudan yazmaya bağımlı olmayan, Turnstile + backend + özel RLS tablosu kullanan denizcilik partner başvurusunu ekle.
- [x] Denizcilik yüzeylerindeki dekoratif radial ışıkları kaldır ve kart/araç yüzeylerini 8px radius standardına hizala.
- [x] Ana denizcilik ve Maritime CV hero'larını gerçek fotoğraflı tam yüzey düzene taşı; H1 ürün adı, mobil kompakt navigasyon ve kısa viewport sonraki bölüm ipucunu doğrula.
- [x] Ana denizcilik ve Maritime CV geçiş sayfalarına ilk Tab'da anında görünen skip-link ekle; Enter ile `main` odağını ve mobil/desktop taşmasız klavye akışını doğrula.
- [x] Kullanıcı panelinde `module=maritime` bağlamını allowlist ile tanı ve Maritime CV, belgeler, navlun talepleri, gemi işleri kısayollarını göster.
- [x] Navlun takip ekranına yalnızca talep sahibi ve uygun durumlar için backend doğrulamalı iptal akışı ekle.
- [x] Crew ve gemi özetleri için `status = active`, `module_key = maritime`, yayın ve son kullanma zamanı kontrollü RLS liste modeli/API ekle; veri yoksa profil şablonlarını koru.
- [x] Denizcilik migration'larını MFA önkoşulu, tek transaction ve üretim RLS/grant/idempotency kontrolüyle uygulayan deploy araçlarını ekle.
- [x] Broker tekliflerini talep sahibi, teklif sahibi MFA partner ve MFA admin arasında RLS ile sınırla; navlun takip ekranında güvenli teklif özetlerini göster.
- [x] Talep sahibinin süresi dolmamış broker teklifini iki aşamalı UI onayı ve service-role-only atomik RPC ile kabul etmesini sağla.
- [x] Navlun takip ekranında RLS ile okunan, event payload göstermeyen allowlist durum geçmişini ekle.
- [x] Partner OS ilan gönderimini MFA + onaylı denizcilik partneri + idempotency ile `pending_review` kuyruğuna bağla.
- [x] Admin Operasyon Paneli'ne MFA korumalı denizcilik partner başvurusu ve ilan onay/ret kuyruğunu ekle; active yayın geçişini backend'e taşı.
- [x] Ops Admin navlun-partner atamasını ve atanan MFA partnerin atomik/idempotent navlun teklif gönderimini Partner OS'ye bağla.
- [x] Partner OS'de teklif üretmemiş eşleşmeyi reddetme ve kabul edilmemiş teklifi geri çekme akışlarını iki aşamalı onay, service-role-only RPC ve sahip zaman çizelgesiyle tamamla.
- [x] Süresi dolan navlun eşleşme/tekliflerini sınırlı, atomik ve idempotent RPC + timing-safe cron ile uzlaştır; talep durumunu kalan aktif işe göre yeniden hesapla.
- [x] Kabul edilmiş/terminal navlun taleplerinde kazanan dışı eşleşmeleri match-first cron uzlaştırmasıyla kapat ve Partner OS'de sonucu beklemeden terminal durum göster.
- [x] Kullanıcı Bildirim Merkezi'ne owner-RLS navlun olay akışını payload'sız allowlist ile bağla; Partner OS'ye yalnız aktif davetleri sayan anlık menü rozeti ekle.
- [x] Navlun bildirim CTA'larını UUID allowlist'li hash deep-link ile ilgili takip kartına bağla; dinamik render sonrası vurgu, odak ve filtre toparlaması ekle.
- [x] Denizcilik bağlamlı kullanıcı paneli arama/kopyalama kontrollerindeki inline stil ve event handler'ları CSP uyumlu sınıf + listener desenine taşı.
- [x] Kullanıcı panelindeki sabit bildirim rozetini gerçek `quoted` navlun sayacına, demo Maritime işlem satırlarını owner-RLS son olay akışına dönüştür; güvenli fallback ekle.
- [x] Denizcilik ana aramasını navlun/CV/destek ve maritime detail akışlarına ayır; public vessel detayından role-aware özel denizcilik partner başvurusuna geçişi düzelt.
- [x] Denizcilik partner başvurusunu güvenli UUID fallback, idempotent ağ tekrarı, tek kullanımlık Turnstile tokenı, PII bellek temizliği ve CSP uyumlu challenge render'ıyla güçlendir.
- [x] Navlun talebi formuna tek uçuş gönderim kilidi, offline/zaman aşımı toparlaması, depolama kapalı oturum koruması ve backend uyumlu 730 günlük laycan sınırı ekle.
- [x] Navlun talebi ve ilk `submitted` olayını service-role-only, yarış güvenli idempotent RPC ile tek transaction içinde oluştur; backend doğrudan çift tablo yazımını kaldır.
- [x] Navlun talebi iptali ile tekil `cancelled` olayını sahiplik/durum kilitli service-role-only RPC içinde atomik ve idempotent yap.
- [x] Navlun takip ekranı iptal aksiyonuna offline/timeout/401/404/429/503 toparlaması, yanıt doğrulaması ve hata sonrası iki aşamalı onay sıfırlaması ekle.
- [x] Navlun teklif kabul UI'ına talep bazlı mutation kilidi, offline/timeout/HTTP toparlaması, tüm onayları sıfırlama ve katı kabul yanıtı doğrulaması ekle.
- [x] Eşzamanlı teklif kabul çağrılarında kilitli `acceptance_changed` raporlayan v2 RPC ile doğru duplicate yanıtı ve tek audit üret; transaction dışı ön okumaları kaldır.
- [x] Navlun takip kartlarını detay sorgularından önce render et; RLS okumalarına timeout, gecikmeli deep-link odak koruması ve UUID allowlist'li giriş dönüşü ekle.
- [x] Navlun takip yükleme/ayrıntı hatalarına mobil uyumlu, tek-uçuşlu retry kontrolü ekle; kartları koru ve başarıda kontrolü gizle.
- [x] Denizcilik partner başvurusu ve navlun takip aksiyonlarına hata/başarı odağı, bağlamlı erişilebilir ad ve iki aşamalı onay durum duyurusu ekle.
- [x] Maritime giriş CTA'larını CSP uyumlu kanonik auth formlarına taşı; login/register/forgot legacy redirectlerini kaldır, güvenli returnTo ve navlun taslak geri dönüşünü doğrula.
- [x] Maritime CV PII taslağını 2 saatlik sekme depolamasına taşı; legacy kalıcı anahtarı tek geçişte sil, envelope/alan/satır/fotoğraf sınırlarını ve debounce + `pagehide` kaydını doğrula.
- [x] Maritime CV mobil araç çubuğunu 320/390 px'de kaydırmasız iki sütuna geçir; dil/kaydet/PDF/temizle kontrollerinin görünürlüğünü ve yatay taşma olmadığını doğrula.
- [x] Maritime CV PDF bağımlılıklarına SRI/CORS/referrer koruması ekle; toolbar inline handler'larını listener'a taşı ve tek-uçuş/hata toparlama/güvenli dosya adı akışını doğrula.
- [x] Maritime CV'de gerçek `html2canvas + jsPDF` ile dört sayfalı `%PDF-` indirme smoke testi ve işlem sonrası UI toparlanmasını doğrula.
- [x] Maritime CV'deki tüm inline event attribute'lerini allowlist'li editör delegation katmanına taşı; dinamik satır yeniden render'ını ve UI tarafında 50 satır sınırını doğrula.
- [x] Maritime CV inline CSS/JS ve runtime stil yazımlarını yerel dış dosya, sınıf ve `hidden` desenine taşı; screen/print/mobile regresyonunu doğrula.
- [x] Maritime CV statik/dinamik kontrollerini programatik label/ID ile adlandır; EN/TR/AZ/RU belge dili, toolbar, ARIA/alt ve mesaj yerelleştirmesini 320 px ile depolama-kapalı durumda doğrula.
- [x] Maritime CV yazma/depolama sınırlarını statik alanlarda 2000, dinamik alanlarda 300 karaktere eşitle; update/remove global fonksiyonlarında key/index/prototype savunmasını doğrula.
- [ ] Canlı Supabase projesinde denizcilik migration deploy ve şema kontrol scriptlerini çalıştır; backend endpointlerini canlı domain üzerinden smoke test et.

## Öncelik 0.4 - Allona Maritime Autonomous Hiring

- [x] Master Maritime kapsamını mevcut repo, Partner OS ve güvenlik kurallarıyla uyumlu architecture dokümanına ve coverage matrix'e bağla.
- [x] Seafarer Workspace, Readiness Passport, Smart Document Doctor, Smart Portrait, otomatik CV, Current Work Status, Verified Vessel Profile, structured jobs ve explainable matching için temel şema ekle.
- [x] Company Maritime Workspace, Private Candidate Room, Multi-Candidate Hiring Room, Crew Room, Allona Connect provider abstraction, Trust Oversight, sensitive access, view/download audit ve permission matrix için RLS kontrollü temel şema ekle.
- [x] Verified Gold Tick'i kanıtlı doğrulama, Pro Blue Tick'i ayrı üyelik sinyali olarak veri seviyesinde ayır.
- [x] Allona Connect için raw secret tutmayan ve varsayılan kayıt politikası `not_recorded` olan provider abstraction satırını ekle.
- [x] Doğrulanmış çalışma ilişkisi olmadan referans isteği açılamamasını trigger ile koru.
- [x] Yeni çekirdeği kontrol eden `deploy/maritime/check-maritime-hiring-core.sh` scriptini ekle ve migration uygulama zincirine bağla.
- [x] Super Admin içinde Maritime Trust Control Center sekmesini ve `/v1/control-center/maritime-trust` metadata/risk/şikayet/audit endpointini ekle; özel konuşma içeriği, dosya yolu, görüşme kaydı, ham gerekçe ve metadata değerlerini varsayılan yanıttan dışarıda tut.
- [x] Ara yayın için Denizcilik hero görselini koruyup mobil üst alan karışmasını sadeleştir; Partner OS içinde yerel demo ödeme/destek/cihaz fallback'lerini kaldır.
- [ ] Yeni çekirdek migration'ı staging Supabase üzerinde çalıştır ve RLS/grant/policy kontrolünü gerçek veritabanında doğrula.
- [ ] Seafarer Workspace backend endpointlerini ekle: belge yükleme/onay, Readiness Passport okuma, müsaitlik yenileme, eşleşme ve teklif durumu.
- [ ] Partner Panel içinde Company Maritime Workspace backend ve UI akışlarını ekle: Operations Center, Jobs, Hiring Room, Smart Matches, Candidate Room, Urgent Crew, Crew Matrix, Offers & Contracts.
- [ ] Allona Connect mesaj, dosya, görüşme planlama ve WebRTC provider adapter endpointlerini ekle; medya sağlayıcı secret değerlerini sadece server environment üzerinden bağla.
- [ ] Trust & Communication Oversight hassas içerik erişim akışını ekle; vaka, gerekçe, süre ve çift onay olmadan özel konuşma/dosya/görüşme içeriği açma.
- [ ] Adaylar arası görünmezlik, partner tenant izolasyonu, Gold/Blue ayrımı, referans yetkisi, sensitive access ve append-only audit için negative testleri ekle.

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
