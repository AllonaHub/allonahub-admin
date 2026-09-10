# DATABASE

AllonaHub Supabase üzerinde PostgreSQL kullanır. `supabase/schema.sql` temel kurulumu, `supabase/migrations/` ise bu temelden sonraki tarih sıralı değişiklikleri tanımlar. Temel kural: müşteri tarafı sadece güvenli RLS politikalarıyla izin verilen veriye erişir; ödeme ve kritik sipariş onayı Edge Functions veya backend üzerinden yapılır.

## Ana Tablolar

### products

Zorunlu alanlar:

- `id`
- `name`
- `description`
- `price`
- `stock`
- `image_url`
- `category`
- `module_key`: `shop`, `market`, `food`, `taxi` veya `service`
- `status`
- `created_at`

Üretim için önerilen ek alanlar:

- `slug`
- `meta_title`
- `meta_description`
- `brand`
- `sold_count`
- `partner_id`
- `updated_at`

Kural: vitrinde yalnızca `status = active` ürünler gösterilir. Modüllerin birbirine karışmaması için Allona Shop ürünleri `module_key = shop`, Allona Market ürünleri `module_key = market`, Allona Yemek ürünleri `module_key = food` kapsamıyla ayrılır. Eski canlı ürün tablolarında frontend `brand`, `category` ve `sku` alanlarından aynı ayrımı geriye uyumlu şekilde algılar.

### profiles

Supabase Auth kullanıcılarının halka açık olmayan profil verilerini tutar.

- `id`: auth user id
- `full_name`
- `phone`
- `role`: `customer`, `admin`, `partner`
- `created_at`
- `updated_at`

### addresses

Kullanıcının teslimat ve fatura adresleri. MVP Transaction Core modelinde checkout, seçili veya varsayılan adresi `orders.address_id` ile ilişkilendirir ve teslimat özetini ayrıca `orders.address` alanına yazar.

Canlı sitede `Could not find the table 'public.addresses' in the schema cache` hatası görülürse Supabase SQL Editor'da `supabase/migrations/20260621015000_transaction_core_mvp.sql` dosyasının tamamı çalıştırılmalıdır. Frontend bu tablo hazır olana kadar adresleri kullanıcı cihazında geçici olarak saklar; tablo oluşturulduktan sonra kayıtlar Supabase'e kalıcı yazılır.

```sql
create extension if not exists pgcrypto;

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Adres',
  full_name text,
  phone text,
  address text not null,
  district text,
  city text not null,
  zip_code text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists addresses_set_updated_at on public.addresses;
create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

alter table public.addresses enable row level security;

drop policy if exists "addresses_select_own" on public.addresses;
create policy "addresses_select_own"
  on public.addresses for select
  using (user_id = auth.uid());

drop policy if exists "addresses_insert_own" on public.addresses;
create policy "addresses_insert_own"
  on public.addresses for insert
  with check (user_id = auth.uid());

drop policy if exists "addresses_update_own" on public.addresses;
create policy "addresses_update_own"
  on public.addresses for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "addresses_delete_own" on public.addresses;
create policy "addresses_delete_own"
  on public.addresses for delete
  using (user_id = auth.uid());

create index if not exists addresses_user_created_idx
  on public.addresses(user_id, created_at desc);

create unique index if not exists addresses_one_default_per_user
  on public.addresses(user_id)
  where is_default;
```

### favorites

Giriş yapan kullanıcıların favorileri Supabase'de saklanır. Misafir favorileri tarayıcı localStorage'da geçici tutulur.

### carts / cart_items

Gerçek sepet sistemi. Giriş yapan kullanıcının tek aktif sepeti vardır. Aynı ürün tekrar eklenirse quantity artar; quantity `1` altına düşerse ürün sepetten çıkarılır. Ürün pasifse veya stok yetmiyorsa sepet RPC'si hata verir.

RPC'ler:

- `get_or_create_active_cart()`
- `get_active_cart()`
- `add_cart_item(p_product_id uuid, p_quantity integer)`
- `set_cart_item_quantity(p_product_id uuid, p_quantity integer)`
- `clear_active_cart()`

### orders / order_items

Sipariş ve sipariş kalemleri Transaction Core RPC ile oluşturulur. Frontend doğrudan `orders.insert` yapmaz; fiyat, stok, kupon, HP ve kargo hesapları server-side doğrulanır. Checkout seçili veya varsayılan adresi `orders.address_id` ile ilişkilendirir ve teslimat özetini `orders.address` alanına da yazar.

- `orders.id`
- `orders.order_no`
- `orders.order_number`
- `orders.user_id`
- `orders.address_id`
- `orders.customer_name`
- `orders.customer_email`
- `orders.customer_phone`
- `orders.city`
- `orders.address`
- `orders.subtotal`
- `orders.shipping`
- `orders.discount`
- `orders.total`
- `orders.discount_total`
- `orders.hp_discount`
- `orders.coupon_discount`
- `orders.shipping_total`
- `orders.grand_total`
- `orders.status`: `pending`, `awaiting_payment`, `paid`, `preparing`, `shipped`, `delivered`, `cancelled`, `refunded`
- `orders.order_status`: `pending`, `awaiting_payment`, `paid`, `preparing`, `shipped`, `delivered`, `cancelled`, `refunded`
- `orders.payment_status`: `unpaid`, `pending`, `awaiting_payment`, `paid`, `failed`, `refunded`
- `orders.fraud_status`: `normal`, `review`, `blocked`
- `orders.partner_status`: `new`, `preparing`, `shipped`, `delivered`
- `tracking_number`
- `cargo_company`
- `admin_note`

`order_items` temel alanları:

- `id`
- `order_id`
- `product_id`
- `partner_id`
- `product_name`
- `quantity`
- `price`
- `unit_price`
- `total_price`
- `partner_commission_rate`
- `platform_commission`
- `partner_net_earning`

### coupons

Checkout sırasında uygulanacak kampanya kodları.

### HP/XP ve Kupon Merkezi

MVP'de gerçek para cüzdanı yoktur. HP yalnızca indirim hakkı, kupon avantajı ve kampanya hakkı olarak çalışır; nakit çekim ve gerçek para bakiyesi gösterimi kapalıdır.

Tablolar:

- `hp_ledger`
- `user_rewards`
- `coupons`
- `coupon_redemptions`

Kurallar:

- Kupon süresi, kullanım limiti, minimum sepet tutarı ve tekil kullanıcı kullanımı server-side kontrol edilir.
- HP kullanımı günlük ve sipariş başı limitlidir.
- Kupon + HP indirimi sipariş toplamını sıfırın altına düşüremez.
- Nakit çekim MVP'de kapalıdır.

### CV hak, ödeme ve risk tabloları

Akıllı CV üretiminde kullanıcı formu doldurabilir; kısıtlama sadece CV/PDF üretim anında uygulanır.

- `cv_device_accounts`: cihaz anahtarı ile kullanıcı eşleşmesini tutar.
- `cv_access_accounts`: kullanıcı başına ücretsiz hak, kullanılan hak, ücretli kredi ve risk durumunu tutar.
- `cv_generations`: her başarılı CV/PDF üretimini kayıt altına alır.
- `cv_payments`: CV üretim kredisi için iyzico ödeme kayıtlarını tutar.
- `admin_notifications`: admin paneline düşen riskli profil ve cihaz bildirimlerini tutar.

İş kuralı:

- İlk cihaz hesabına 2 ücretsiz CV/PDF üretim hakkı tanımlanır.
- Aynı cihazdan ikinci veya sonraki hesap açılırsa/denenirse admin bildirimi oluşur.
- Aynı cihazdaki ikinci ve sonraki hesaplara ücretsiz CV hakkı verilmez.
- Ücretsiz hak bittikten sonra kullanıcı `/pages/career/cv-payment.html` üzerinden ücretli CV üretim kredisi alır.
- Bu CV hak kuralı dışında kullanıcıya başka kısıtlama uygulanmaz.
- Maritime CV taslağı sunucu/veritabanı kaydı değildir; yalnız sekmeye özel `sessionStorage` içinde `module_key = maritime`, şema sürümü ve en fazla 2 saatlik son kullanma zamanı ile tutulur.
- Eski `localStorage` CV taslağı okunabiliyorsa bir kez sekme taslağına taşınır ve kalıcı anahtar her durumda silinir. Yüklemede alan allowlist'i, metin/satır sınırları ve yalnız JPEG/PNG/WebP, en fazla 2 MB fotoğraf kuralı uygulanır.

### maritime_freight_requests / maritime_freight_request_events

Allona Denizcilik navlun ön talepleri `module_key = maritime` ile ayrı tutulur. Talep oluşturma yazması frontend'den doğrudan tabloya yapılmaz; auth doğrulaması, Zod alan kontrolü, rate limit, idempotency ve audit için `POST /v1/maritime/freight-requests` backend endpointi kullanılır. Endpoint, talep ve ilk `submitted` olayını tek transaction içinde oluşturan service-role-only `create_maritime_freight_request(...)` RPC'sini çağırır.

- Kullanıcı yalnızca kendi navlun taleplerini ve ilgili olay geçmişini RLS üzerinden okuyabilir.
- Admin güncellemeleri `public.is_admin()` ile rol + MFA kontrolüne bağlıdır.
- `client_request_id`, aynı kullanıcıdan tekrarlanan gönderimin ikinci kayıt oluşturmasını engeller.
- Rota ve miktar verisi URL'ye veya güvenlik audit metadata alanına yazılmaz.
- Frontend taslağı yalnızca mevcut sekmenin `sessionStorage` alanında iki saat saklanır; kesin kayıt sayılmaz.
- Navlun POST'u tek uçuş kilidi ve 15 saniyelik istemci zaman aşımı kullanır; offline/429/ağ hatasında aynı `client_request_id` ve taslak korunur. Girişli kullanıcıda depolama kapalıysa API kaydı engellenmez, oturumsuz kullanıcı veri kaybıyla girişe yönlendirilmez.
- İstemci laycan üst sınırı backend sözleşmesiyle aynı biçimde bugünden itibaren tam 730 gündür ve form her doğrulamada tarih sınırlarını yeniler.
- Oluşturma RPC'si `(user_id, client_request_id)` çakışmasını yarış güvenli `ON CONFLICT` ile idempotent karşılar; mevcut kayıtta eksik ilk olayı onarır ve olay yazılamazsa yeni talep yazımını da geri alır.
- `cancel_maritime_freight_request(...)` talebi kullanıcı sahipliği ve `module_key = maritime` sınırında kilitler; yalnız `submitted/in_review` durumunu `cancelled` yapar ve tekil iptal olayını aynı transaction içinde yazar. Tekrar çağrı mevcut sonucu döndürür, eski olaysız iptali onarır.
- Takip ekranı iptal mutation'ı offline durumda API çağrısı yapmaz, 15 saniyede kontrollü biçimde sonlanır ve yalnız kimlik/durum doğrulanmış `cancelled` sunucu yanıtını yerel karta uygular. Hata sonrasında iki aşamalı onay bayrağı sıfırlanır.
- Teklif kabul UI'ı aynı talepteki tüm mutation düğmelerini işlem boyunca kilitler; böylece iki broker teklifi paralel gönderilemez. Offline/timeout/HTTP hatasında tüm iki aşamalı onaylar sıfırlanır, yalnız talep + teklif kimliği, `accepted` durumları ve geçerli `accepted_at` içeren yanıt yerel duruma uygulanır.
- Takip ekranı ana RLS talep okumasını ve teklif/olay detay okumalarını 8 saniyeyle sınırlar; temel talep kartlarını detay sorgularını beklemeden render eder. Detay render'ı aktif deep-link kartının klavye odağını korur.
- Oturumsuz takip CTA'sı yalnız allowlist'ten geçen UUID hash'ini sabit yerel `maritime-requests.html#request-...` dönüşüne ekler; malformed veya serbest return hedefi üretilmez.
- Navlun takip çizelgesi olay tablosundan yalnız `id`, `freight_request_id`, `event_type` ve `created_at` alanlarını seçer; `event_payload` kullanıcı DOM'una taşınmaz.
- Çizelgede yalnız tanımlı navlun olay türleri gösterilir; beklenmeyen türler istemci allowlist kontrolünde yok sayılır.
- Kullanıcı bildirim merkezi aynı sahiplik RLS sınırındaki olaylardan read-only bir navlun akışı türetir; admin-only `admin_notifications` tablosu son kullanıcıya açılmaz ve yeni bir istemci yazma düzlemi oluşturulmaz.
- Bildirim merkezi talep tablosundan yalnız kimlik/referans/durum, olay tablosundan yalnız kimlik/talep/tür/zaman alanlarını alır; rota, tutar, şartlar ve `event_payload` sorgulanmaz.
- Maritime bağlamlı kullanıcı paneli de aynı exact-field sözleşmesiyle en son üç allowlist olayı gösterir; zil rozeti okunmamış sayısı taklit etmez, yalnız `quoted` durumunda kullanıcı aksiyonu bekleyen talep sayısını verir.

Tablo migration kaynağı: `supabase/migrations/20260711123000_create_maritime_freight_requests.sql`.

Atomik oluşturma RPC migration kaynağı: `supabase/migrations/20260711213000_create_maritime_freight_request_rpc.sql`.

Atomik iptal RPC migration kaynağı: `supabase/migrations/20260711223000_cancel_maritime_freight_request_rpc.sql`.

### maritime_partner_applications

Denizcilik partner ön başvuruları genel partner tablosundan ayrı ve PII odaklı kapalı bir tabloda tutulur. `anon` ve normal `authenticated` rolleri tabloya doğrudan yazamaz; kayıt yalnızca Turnstile, payload doğrulama ve rate limit uygulayan `POST /v1/public/maritime/partner-applications` endpointi üzerinden service role ile oluşturulur.

- `module_key` sabit olarak `maritime` değerindedir.
- Audit metadata alanında ham e-posta yerine SHA-256 `email_hash` kullanılır.
- Başvurular için varsayılan saklama süresi 730 gündür.
- Admin okuması `public.is_admin()` üzerinden rol + MFA kontrolüne bağlıdır.
- Frontend form PII verisini localStorage veya sessionStorage içinde saklamaz.
- İstemci idempotency kimliği `crypto.randomUUID()` veya `crypto.getRandomValues()` ile üretilir; ağ/rate-limit hatasında aynı kimlik korunur, her gönderim denemesinde yeni Turnstile tokenı alınır.
- Başarı veya idempotent duplicate yanıtında formdaki PII bellekten temizlenir; doğrulama ya da geçici ağ hatasında kullanıcı girdisi yalnız sayfa belleğinde tekrar deneme için tutulur.

Migration kaynağı: `supabase/migrations/20260711133000_create_maritime_partner_applications.sql`.

### maritime_public_listings

Halka açık crew ve gemi ilan özetlerini tutar. Anonim ve giriş yapmış kullanıcılar RLS üzerinden yalnızca `module_key = maritime`, `status = active`, yayın zamanı gelmiş ve süresi dolmamış kayıtları okuyabilir. Tablo yalnızca halka gösterilmesi güvenli alanları içerir; iletişim PII veya doğrulama evrakı barındırmaz.

- `listing_type`: `crew_position` veya `vessel`
- `status`: `draft`, `pending_review`, `active`, `paused`, `rejected`, `archived`
- `title`, `summary`, `location_label`, `detail_label`
- `published_at`, `expires_at`, `sort_order`
- Partner gönderimlerinde `partner_user_id`, partner bazlı `client_listing_id`, `submission_source` ve `submitted_at` zorunludur.
- `reviewed_by`, `reviewed_at` ve `review_note` admin karar izini tutar; bu alanlar public endpoint sözleşmesine dahil değildir.
- MFA doğrulamalı partner yalnız kendi kayıtlarını okuyabilir; `anon` ve normal istemci rolleri tabloya doğrudan yazamaz.
- Partner formu durum göndermez; backend her yeni kaydı `pending_review` oluşturur. Yalnız MFA Ops Admin kararı `active` durumuna geçebilir.

Migration kaynağı: `supabase/migrations/20260711143000_create_maritime_public_listings.sql`.

Partner sahipliği ve onay akışı migration kaynağı: `supabase/migrations/20260711163000_add_maritime_listing_approval_workflow.sql`.

### maritime_freight_offers

Broker teklifleri navlun taleplerinden ayrı ve halka kapalı tutulur. Talep sahibi yalnızca `submitted`, `accepted`, `rejected` veya `expired` durumundaki yayınlanmış teklifleri; MFA doğrulamalı partner yalnız kendi tekliflerini; MFA doğrulamalı admin operasyon kayıtlarını RLS üzerinden okuyabilir.

- `broker_user_id` ile teklif sahibi, `freight_request_id` ile navlun talebi bağlanır.
- Tutar yalnız izinli para birimi ve fiyatlama bazında saklanır; kart veya ödeme aracı verisi tutulmaz.
- Aynı broker/talep çifti tek operasyonel teklif kaydı üretir; `client_offer_id` broker bazında idempotency sağlar.
- Bir navlun talebinde aynı anda yalnızca bir teklif `accepted` olabilir.
- `accepted_at` yalnız server-side atomik kabul işleminde yazılır.
- `anon` ve `authenticated` rolleri doğrudan yazamaz; yazma akışı service role kullanan yetkili backend operasyonuna ayrılmıştır.

Migration kaynağı: `supabase/migrations/20260711153000_create_maritime_freight_offers.sql`.

### maritime_freight_matches

Navlun talepleri ile teklif verebilecek doğrulanmış partnerler arasındaki kapalı atama tablosudur. Partner yalnız kendi eşleşmelerini MFA korumalı RLS ile okuyabilir; admin MFA ile operasyon görünümüne sahiptir. `anon` ve normal istemci yazmaları kapalıdır.

- Atama yalnız `broker`, `shipowner` veya `agency` rolünde onaylı denizcilik başvurusu ve `profiles.role = partner` birleşince yapılabilir.
- `assign_maritime_freight_partner(...)` talebi kilitler, eşleşmeyi oluşturur/uygun kaydı yeniden açar, talebi `matching` yapar ve tekil `matching_started` olayını aynı transaction içinde yazar.
- `submit_maritime_freight_offer(...)` eşleşme ve talebi kilitler, partner sahipliğini ve süreleri yeniden doğrular, idempotent teklifi `submitted` oluşturur, eşleşmeyi `accepted`, talebi `quoted` yapar ve `quote_added` olayını yazar.
- `decline_maritime_freight_match(...)` yalnız teklif üretmemiş `invited` eşleşmeyi `declined` yapar; başka aktif eşleşme veya teklif yoksa talebi `in_review` durumuna döndürür ve `match_declined` olayı ekler.
- `withdraw_maritime_freight_offer(...)` kabul edilmemiş `submitted` teklifi `withdrawn`, eşleşmeyi `closed` yapar; kalan işe göre talebi `matching` veya `in_review` durumuna döndürür ve `offer_withdrawn` olayı ekler.
- Dört RPC de yalnız `service_role` execute grantine sahiptir. Partner formu `status`, `broker_display_name`, `company_display_name` veya `match_id` göndermez; çıkış endpointleri durum alanı kabul etmez.
- Tutar ve şart özeti security audit metadata alanına kopyalanmaz.

Migration kaynağı: `supabase/migrations/20260711183000_create_maritime_freight_matching.sql`.

Partner çıkış akışları migration kaynağı: `supabase/migrations/20260711193000_add_maritime_partner_exit_workflows.sql`.

### reconcile_maritime_freight_expirations(...)

Süresi dolan navlun işlerini en fazla 500 eşleşmelik batch içinde uzlaştırır. Aday seçimi yazma kilidi almaz; her kayıt işlenirken ortak sıra olan eşleşme, talep, teklif kilit sırası ve `FOR UPDATE SKIP LOCKED` kullanılır.

- Geçerlilik zamanı dolmuş `submitted` teklif `expired`, bağlı eşleşme `closed` olur ve `offer_expired` olayı tekilleştirilir.
- Teklifsiz süresi dolmuş `invited` eşleşme `closed` olur ve atama süresiyle tekilleştirilen `match_expired` olayı yazılır.
- Kalan süresi geçmemiş teklif varsa talep `quoted`, teklifsiz aktif davet varsa `matching`, ikisi de yoksa `in_review` olur.
- `accepted` talepte kazanan `accepted` teklifin eşleşmesi açık tutulur; rakip teklif ve cevapsız davet eşleşmeleri `closed` yapılır. `cancelled` veya `closed` taleplerde tüm açık eşleşmeler kapatılır.
- RPC yalnız `service_role` execute grantine sahiptir; batch limiti server-side `1..500` aralığında doğrulanır ve olay payload'ı rota, tutar, PII veya teklif şartı içermez.

Migration kaynağı: `supabase/migrations/20260711203000_reconcile_maritime_freight_expirations.sql`.

### accept_maritime_freight_offer(...)

Talep sahibinin yayınlanmış broker teklifini seçmesi kritik ve atomik bir RPC işlemidir. Fonksiyon istek/teklif satırlarını `FOR UPDATE` ile kilitler, sahiplik/durum/geçerlilik zamanını yeniden doğrular, seçilen teklifi `accepted`, diğer `submitted` teklifleri `rejected`, navlun talebini `accepted` yapar ve tekil `accepted` olayını aynı transaction içinde yazar.

- Fonksiyon `anon` ve `authenticated` rollerine kapalıdır; yalnız backend `service_role` çalıştırabilir.
- Aynı teklif için tekrar çağrı idempotent sonuç döndürür; farklı ikinci teklif yarış durumunda reddedilir.
- Backend `accept_maritime_freight_offer_v2(...)` sarmalayıcısını kullanır; talep/teklifi kilit altında ön durumuyla okuyup `previous_status` ve `acceptance_changed` döndürür. Eşzamanlı aynı kabulde yalnız değişiklik yapan çağrı `duplicate = false` ve audit üretir.
- Endpoint transaction dışı talep/teklif ön sorgusu yapmaz; v2 sonucundaki kimlik, iki durum ve kabul zamanı doğrulanmadan HTTP başarı yanıtı oluşturmaz.
- Tutar veya rota verisi security audit metadata alanına kopyalanmaz; yalnız kayıt kimlikleri ve durum geçişi tutulur.

Migration kaynağı: `supabase/migrations/20260711173000_accept_maritime_freight_offer_rpc.sql`.

Kilitli idempotency raporu migration kaynağı: `supabase/migrations/20260711233000_accept_maritime_freight_offer_v2_rpc.sql`.

### Allona Maritime autonomous hiring core

Allona Maritime işe alım çekirdeği `supabase/migrations/20260910120000_create_maritime_hiring_core.sql` ile eklenir. Bu katman mevcut Partner OS tenant modelini genişletir; ikinci bir partner sistemi oluşturmaz ve hiçbir frontend ekranını tek başına çalışan ürün gibi kabul ettirmez.

- Seafarer Workspace ve Readiness Passport: `maritime_seafarer_workspaces`, `maritime_readiness_passports`, `maritime_readiness_items`.
- Smart Document Doctor, Smart Portrait ve otomatik CV üretimi: `maritime_document_intakes`, `maritime_smart_portrait_reviews`, `maritime_cv_generations`.
- Current Work Status Engine ve müsaitlik tazeliği: `maritime_work_status_events`.
- Verified Vessel Profile, iş oluşturma yardımcısı, job versioning ve açıklanabilir eşleşme: `maritime_vessel_profiles`, `maritime_jobs`, `maritime_job_versions`, `maritime_job_assistant_drafts`, `maritime_match_results`.
- Company Maritime Workspace, Private Candidate Room, Multi-Candidate Hiring Room ve Crew Room: `maritime_hiring_rooms`, `maritime_private_candidate_rooms`, `maritime_crew_rooms`, `maritime_crew_room_members`.
- Allona Connect sağlayıcı soyutlaması ve oda bazlı iletişim: `maritime_connect_provider_adapters`, `maritime_connect_threads`, `maritime_connect_messages`, `maritime_connect_broadcasts`, `maritime_connect_sessions`.
- Görüşme, teklif/sözleşme, acil ekip, favori aday, crew matrix ve relief/rehire zemini: `maritime_interviews`, `maritime_offers_contracts`, `maritime_urgent_crew_requests`, `maritime_bulk_invite_batches`, `maritime_favorite_candidates`, `maritime_crew_matrix_snapshots`, `maritime_relief_rehire_plans`.
- Referanslar yalnız doğrulanmış çalışma ilişkisine dayanır: `maritime_work_relationships`, `maritime_reference_requests`, `maritime_reference_responses`.
- Trust & Communication Oversight, süreli hassas erişim, görünüm/indirme logları, permission matrix, versioning/rollback ve badge ayrımı: `maritime_trust_cases`, `maritime_sensitive_access_requests`, `maritime_access_grants`, `maritime_access_events`, `maritime_permission_matrix`, `maritime_entity_versions`, `maritime_workflow_transition_log`, `maritime_trust_badges`.

Yeni çekirdek tablolarda `anon` okuma/yazma kapalıdır. `authenticated` yalnız RLS ile izinli okuma yapar; doğrudan istemci insert/update/delete yoktur. Yazmalar backend/RPC/Edge Function tarafında service role, server-side doğrulama, tenant izolasyonu ve audit ile yapılmalıdır. Allona Verified Gold Tick `source_review_id` olmadan verilemez; Pro Blue Tick doğrulama değil üyelik durumudur. Allona Connect provider kayıtları secret değeri taşımaz; medya/WebRTC sağlayıcısı için yalnız server environment referansı kullanılabilir.

Allona Connect mesaj içeriği ve görüşme oturumu kayıtları varsayılan admin okumasına açılmaz. `maritime_connect_messages` ve `maritime_connect_sessions` RLS politikaları katılımcı veya gerçek partner üyesi sınırı kullanan `maritime_can_access_connect_thread_content(...)` helper'ına bağlıdır. Super Admin Maritime Trust ekranı metadata/risk/şikayet/audit özetleriyle sınırlıdır; Trust reviewer hassas içerik incelemesi ayrı vaka, gerekçe, süre ve onay akışı üzerinden backend tarafından yapılmalıdır.

İşveren referans cevapları aday kayıt sahibine varsayılan olarak açılmaz. `maritime_reference_responses` yalnız `candidate_only` görünürlükte aday tarafından, `authorized_company_only` görünürlükte ise gerçek requester partner üyesi tarafından okunabilir; genel admin içerik okuması bu politikada yer almaz.

Doğrulama kaynağı: `deploy/maritime/check-maritime-hiring-core.sh`.

## SQL

Canlı Supabase projesi için Transaction Core MVP'nin exact SQL kaynağı:

```text
supabase/migrations/20260621015000_transaction_core_mvp.sql
```

Supabase SQL Editor'da bu dosyanın içeriği eksiksiz çalıştırılmalıdır. Bu migration aşağıdakileri tek seferde hazırlar:

- `addresses` default adres kuralları ve RLS
- `carts` / `cart_items` tabloları, RLS ve sepet RPC'leri
- `orders` / `order_items` Transaction Core alanları
- `create_transaction_order(...)` RPC'si
- `hp_ledger`, `user_rewards`, `coupon_redemptions`
- kupon alanları ve RLS
- partner/admin sipariş görünürlüğü ve sınırlı durum güncelleme güvenliği

Önceki doğrudan `orders.insert` SQL'i kullanılmamalıdır. MVP checkout, yalnızca `create_transaction_order(...)` RPC'siyle sipariş oluşturur.

```sql
-- Supabase SQL Editor:
-- 1. supabase/migrations/20260621015000_transaction_core_mvp.sql dosyasını aç.
-- 2. İçeriğin tamamını kopyala.
-- 3. Tek parça olarak çalıştır.
-- 4. Ardından Edge Functions secrets ve deploy adımlarını DEPLOY.md üzerinden tamamla.
```

Yeni kurulumlarda önce `supabase/schema.sql`, ardından gerekli migration'lar tarih sırasıyla uygulanır; yalnızca temel dosyayı çalıştırmak güncel üretim şemasını oluşturmaz. Denizcilik migration'ları güvenli biçimde `deploy/maritime/apply-maritime-migrations.sh` ile uygulanıp `deploy/maritime/check-maritime-schema.sh` ile doğrulanır. Auth, Storage, backend ve Edge Function adımları `docs/reference/DEPLOY.md` sırasıyla tamamlanmalıdır.
