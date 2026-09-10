# Allona Maritime Autonomous Hiring Architecture

Bu dokuman, kullanicinin "MASTER IMPLEMENTATION DIRECTIVE ALLONA MARITIME" talimatini baglayici is kapsami olarak alir. `Allona_Maritime_Autonomous_Hiring_Strategy_TR.pdf` bir gereksinim kaynagidir; PDF icindeki faz/later ayrimlari kapsam daraltma gerekcesi olarak kullanilmaz. Teknik olarak hemen tamamlanamayan ozellikler, calisiyormus gibi gosterilmeden altyapi ve entegrasyon noktasi olarak isaretlenir.

## Mevcut Durum Analizi

- Mevcut Denizcilik modulu uc ayri yuzeyde yasiyor: `pages/ecosystem/allonadenizcilik.html`, `pages/career/maritime-cv.html` ve Partner OS icindeki sinirli denizcilik paneli.
- Mevcut aktif altyapi navlun on talebi, denizcilik partner basvurusu, public crew/gemi ozetleri, partner ilan/teklif akisi, ops admin onay kuyrugu ve RLS kontrollu navlun event akisini kapsiyor.
- Mevcut Partner mimarisi `partner_businesses`, `partner_staff` ve `partner_member_has_access(...)` uzerinden tenant sinirini sagliyor. Yeni Company Maritime Workspace bu modeli genisletir; ikinci bir partner sistemi olusturmaz.
- Mevcut frontend tarafinda hero/fotograf deneyimi hassas kabul edilmeli. Tam urun yeniden insa edilene kadar sadece gerekli, kanitli ve testli UI degisikligi yapilmalidir.
- Mevcut kapsam; Readiness Passport, deterministic hard gate, aciklanabilir skor, Allona Connect, Private Candidate Room, Multi-Candidate Hiring Room, Crew Room ve Trust Oversight icin yeterli veri/izin temelini henuz icermiyordu.

## Yeni Cekirdek Karar

Yeni cekirdek `supabase/migrations/20260910120000_create_maritime_hiring_core.sql` ile baslar. Bu migration, ekranda sahte tamamlanmis ozellik gostermeden asagidaki temel katmanlari kurar:

- Seafarer Workspace ve Readiness Passport.
- Smart Document Doctor icin belge alimi, OCR siniflandirma ve kullanici onayi zorunlulugu.
- Smart Portrait icin kimlik degistirmeyen, kullanici onayli fotograf profesyonellestirme kaydi.
- Otomatik CV uretimi icin onayli input snapshot ve cikti kaydi.
- Current Work Status Engine ve musaitlik tazeligi.
- Verified Vessel Profile, job assistant draft, structured maritime job ve job versioning.
- Deterministic hard gate + aciklanabilir tercih skoru icin match snapshotlari.
- Partner tenant icinde Company Maritime Workspace, Hiring Room, Private Candidate Room ve Crew Room.
- Allona Connect icin provider abstraction; WebRTC/media saglayicisi disarida, Allona izin/audit is mantigi iceride.
- Unified inbox ve bulk invite icin kayit zemini; toplu mesajlar grup sohbeti olarak degil, bire bir candidate thread'lerine acilacak sekilde modellenir.
- Verified work relationship temelli reference sistemi.
- Offers & Contracts, Contract Compare, Interviews ve scorecard zemini.
- Urgent Crew, Favorite Candidates, Crew Matrix, Crew Pool sinyali, Relief/Rehire Autopilot ve Billing event zemini.
- Trust & Communication Oversight; varsayilan metadata/risk/vaka modeli, hassas icerik icin vaka/gerekce/sure/cift onay siniri.
- Imzali sureli erisim, goruntuleme/indirme loglari, append-only audit, versiyonlama ve rollback snapshot zemini.

## Guvenlik ve Gizlilik Sinirlari

- `anon` rolune yeni cekirdek tablolarda okuma veya yazma verilmez.
- `authenticated` rolu sadece RLS ile izinli okuma yapabilir; dogrudan insert/update/delete kapali kalir.
- Yazma islemleri backend/RPC/Edge Function/service role tarafinda, server-side dogrulama ve audit ile yapilmalidir.
- Gold Tick dogrulama kaniti olmadan verilemez. Pro Blue Tick uyelik sinyalidir ve dogrulamadan ayridir.
- Smart Document Doctor OCR ve belge siniflandirmasi kullanici onayi olmadan final kanit haline gelemez.
- Smart Portrait kisi kimligini degistiren sonuc uretemez; kimlik degisikligi tespit edilirse yayin durumuna gecemez.
- Sesli/goruntulu gorusmeler varsayilan olarak kaydedilmez. Kayit ozelligi eklenirse acik bildirim/onay ve yasal uyum kontrolu zorunlu ayrik is akisidir.
- Trust Oversight "God Mode" degildir. Varsayilan gorunum metadata, risk sinyali, sikayet ve islem gecmisidir. Hassas icerik icin vaka numarasi, amac, gerekce, sure siniri ve cift onay matrisi gerekir.
- Super Admin Maritime Trust Control Center, kalici `super_admin` rolu + MFA + owner kilidi ister ve yalniz metadata/risk/sikayet/audit ozetleri dondurur; mesaj govdesi, dosya yolu/icerigi, gorusme kaydi, ham sensitive access gerekcesi ve metadata degerleri varsayilan yanitta yer almaz.
- Allona Connect mesaj icerigi ve gorusme oturumu kayitlari varsayilan admin erisimi almaz; dogrudan RLS okuma katilimci/gercek partner uyesi ile sinirlidir. Trust reviewer hassas icerige ancak ayri vaka ve sureli erisim akisi uzerinden ulasmalidir.
- Provider adapter kaydinda secret degeri tutulmaz; yalnizca server ortamindaki secret referansi tutulabilir.

## Durum Zinciri

Butun kritik akislarda hedef zincir sudur:

1. Yukleme.
2. OCR/siniflandirma.
3. Kullanici onayi.
4. Dogrulama.
5. Hard gate.
6. Aciklanabilir skor.
7. Eylem.
8. Degistirilemez denetim kaydi.

Bu zincir, migration icinde ayri tablolar ve durum alanlariyla temsil edilir. UI veya backend endpointleri bu zinciri kisaltamaz.

## Partner Workspace Kapsami

Company Maritime Workspace, Partner Panel icinde mevcut tenant modeliyle calisir. Temel veri karsiliklari:

- Operations Center: `maritime_jobs`, `maritime_hiring_applications`, `maritime_match_results`, `maritime_interviews`, `maritime_offers_contracts`.
- Hiring ve Jobs: `maritime_jobs`, `maritime_job_versions`, `maritime_job_assistant_drafts`.
- Smart Matches ve Candidates: `maritime_match_results`, `maritime_hiring_applications`, `maritime_private_candidate_rooms`.
- Urgent Crew: `maritime_urgent_crew_requests`.
- Crew Matrix ve Crew Pool: `maritime_crew_matrix_snapshots`, `maritime_favorite_candidates`, `maritime_relief_rehire_plans`.
- Vessels: `maritime_vessel_profiles`.
- Interviews: `maritime_interviews`, `maritime_connect_sessions`.
- Offers & Contracts: `maritime_offers_contracts`.
- Active Crew, Relief & Rehire: `maritime_crew_rooms`, `maritime_crew_room_members`, `maritime_relief_rehire_plans`.
- References: `maritime_work_relationships`, `maritime_reference_requests`, `maritime_reference_responses`.
- Verification: `maritime_document_intakes`, `maritime_readiness_items`, `maritime_trust_cases`.
- Team: mevcut `partner_staff`.
- Analytics: operasyon metrikleri bu tablolardan uretilir; gorunum/API katmani henuz eklenmedi.
- Billing: `maritime_billing_events` ve mevcut odeme/partner muhasebe kurallari.

## Coverage Matrix

| Gereksinim | Durum | Kanit / Not |
| --- | --- | --- |
| Mevcut AllonaHub ve Partner mimarisini koru | Uygulandi | Yeni tablolar `partner_businesses` ve `partner_member_has_access(...)` uzerinden tenant baglar. |
| Ikinci partner sistemi olusturma | Uygulandi | Company Maritime Workspace tablolarinda `partner_id` mevcut Partner OS kimligidir. |
| Seafarer Workspace | Sadece altyapi hazir | `maritime_seafarer_workspaces`; UI/backend endpoint henuz yok. |
| Readiness Passport merkezde olsun | Sadece altyapi hazir | `maritime_readiness_passports`, `maritime_readiness_items`. |
| Her alanin kaynak ve guven seviyesi gorunsun | Sadece altyapi hazir | `source_type`, `trust_level`, `verification_status`, `confidence`, `source_reference_hash`. |
| Allona Verified Gold Tick satilamaz | Uygulandi | `maritime_trust_badges_gold_requires_review` constraint'i Gold icin review kaniti ister. |
| Pro Blue Tick dogrulamadan ayridir | Sadece altyapi hazir | `maritime_trust_badges.badge_type = pro_blue` ayri tutulur. |
| Smart Document Doctor OCR/siniflandirma, kullanici onayi olmadan final degil | Sadece altyapi hazir | `maritime_document_intakes` onay alanlari ve durumlari eklendi. |
| Smart Portrait kisiyi degistirmez | Sadece altyapi hazir | `maritime_smart_portrait_reviews` kimlik degisimi constraint'i yayin durumunu engeller. |
| CV otomatik uretilir | Sadece altyapi hazir | `maritime_cv_generations` input snapshot/cikti/onay zemini. |
| Verified Vessel Profile | Sadece altyapi hazir | `maritime_vessel_profiles` ve `profile_version`. |
| Gemi degisirse yeniden onay gerekir | Sadece altyapi hazir | `reapproval_required`, `last_change_summary`, entity version zemini. Trigger/API henuz yok. |
| Is olusturma yardimcisi serbest metni structured ilana cevirir | Sadece altyapi hazir | `maritime_job_assistant_drafts`, `maritime_jobs`. |
| Hard gate once, aciklanabilir skor sonra | Sadece altyapi hazir | `maritime_match_results` hard gate ve score snapshot alanlari. Motor henuz yok. |
| Skor gerekcesi, versiyon, input snapshot saklanir | Sadece altyapi hazir | `rule_version`, `score_version`, `input_snapshot_hash`, `input_snapshot`, `score_reasons`. |
| Musaitlik tazelik akisi | Sadece altyapi hazir | `maritime_work_status_events`, workspace availability alanlari. |
| Eski musaitlik seffaf isaretlenir | Sadece altyapi hazir | `availability_status`, `stale_after`. UI henuz yok. |
| Company Maritime Workspace bolumleri | Kismen | Veri zemini eklendi; Partner Panel UI ve backend API henuz genisletilmedi. |
| Operations Center kart panosu degil, net funnel metrikleri | Sadece altyapi hazir | Metrik kaynak tablolari var; UI uygulanmadi. |
| Urgent Crew | Sadece altyapi hazir | `maritime_urgent_crew_requests`. |
| Smart Bulk Invite | Sadece altyapi hazir | `maritime_bulk_invite_batches`, `maritime_connect_broadcasts`. |
| Crew Matrix | Sadece altyapi hazir | `maritime_crew_matrix_snapshots`. |
| Favorite Candidates | Sadece altyapi hazir | `maritime_favorite_candidates`. |
| Rehire/Relief Autopilot | Sadece altyapi hazir | `maritime_relief_rehire_plans`. |
| Private Candidate Room | Sadece altyapi hazir | `maritime_private_candidate_rooms`; aday izolasyonu RLS ve tablo modelinde. |
| Allona Interview Room | Sadece altyapi hazir | `maritime_interviews`, `maritime_connect_sessions`. |
| Contract Compare | Sadece altyapi hazir | `maritime_offers_contracts.contract_compare_status`, `compare_result`. |
| Current Work Status Engine | Sadece altyapi hazir | `maritime_work_status_events`. |
| Allona Connect guvenli iletisim katmani | Sadece altyapi hazir | `maritime_connect_*` tablolari ve provider adapter. Mesaj/media backend yok. |
| Telefon/kisisel e-posta paylasmadan iletisim | Sadece altyapi hazir | Model thread/room uzerinden kuruldu; UI/backend henuz PII maskeleme akisini uygulamadi. |
| WebRTC saglayici abstraction | Sadece altyapi hazir | `webrtc_provider_pending`; canli media saglayici secilmedi, secret girilmedi. |
| Multi-Candidate Hiring Room | Sadece altyapi hazir | `maritime_hiring_rooms`, broadcast ve candidate room baglari. |
| Adaylar birbirini gormez | Sadece altyapi hazir | Candidate room tek `seafarer_user_id`; hiring room sadece partner RLS ile okunur. |
| Unified recruiter inbox | Sadece altyapi hazir | Connect thread/message zemini var; inbox API/UI yok. |
| Toplu mesaj grup sohbeti gibi gorunmez | Sadece altyapi hazir | Permission matrix bulk mesaj icin one-to-one expansion kuralini service-role-only tutar. |
| Secilen/yedek aday akisi | Sadece altyapi hazir | `selected_application_id`, `backup_application_id`. |
| Crew Room post-hire modu | Sadece altyapi hazir | `maritime_crew_rooms`, `maritime_crew_room_members`; post-hire policy backendde uygulanacak. |
| Minimum gerekli operasyon bilgisi | Sadece altyapi hazir | `privacy_mode`, `visible_profile_fields`. |
| Trust & Communication Oversight | Kismen | Veri modeli + Super Admin-only metadata/risk/sikayet/audit UI/API eklendi; hassas icerik erisim akisi henuz yok. |
| God Mode yok | Uygulandi | Permission matrix hassas icerik icin `dual_approval_required`; mesaj/session icerigi katilimci-only helper kullanir. |
| Hassas icerik vaka/gerekce/sure ile acilir | Sadece altyapi hazir | `case_id`, `purpose`, `justification`, `expires_at` ve 24 saat constraint'i. |
| Ses/goruntu varsayilan kayit yok | Sadece altyapi hazir | Provider/session default `not_recorded`. |
| Referans sadece dogrulanmis calisma iliskisine dayansin | Uygulandi | Trigger, reference request icin verified relationship zorunlu kilar. |
| Isveren referanslari yalniz yetkili sirketlere gorunsun | Sadece altyapi hazir | Response RLS `authorized_company_only` ve `candidate_only` gorunurluk ayrimi yapar; detay endpoint henuz yok. |
| Referansla Sirket Kazanimi sadece aday sinyali | Sadece altyapi hazir | Contact/dogrulama kontrollu is akisi icin relationship/reference zemini var; outreach otomasyonu yok. |
| Yukleme -> OCR -> onay -> dogrulama -> hard gate -> skor -> eylem -> audit zinciri | Kismen | Veri modeli zinciri temsil ediyor; backend orkestrasyon henuz yazilmadi. |
| Rol bazli erisim ve tenant izolasyonu | Uygulandi | RLS policy seti ve Partner OS helperlari kullanildi. |
| Imzali sureli erisim | Sadece altyapi hazir | `maritime_access_grants.grant_token_hash`, `expires_at`. Token uretim endpointi yok. |
| Gorunum/indirme loglari | Sadece altyapi hazir | `maritime_access_events`, append-only trigger, record RPC. |
| Versiyonlama ve geri alma | Sadece altyapi hazir | `maritime_job_versions`, `maritime_entity_versions`, rollback pointer. UI/backend yok. |
| Sahte calisan ekran uretilmesin | Uygulandi | Super Admin Trust ekrani gercek backend endpointine bagli; Seafarer/Partner urun ekranlari endpoint olmadan calisiyor gibi acilmadi. |
| Coverage matrix | Uygulandi | Bu tablo master kapsam icin baslangic matrisi olarak eklendi. |

## Sonraki Uygulama Sirasi

1. Migration'i staging Supabase uzerinde calistir ve `deploy/maritime/check-maritime-hiring-core.sh` ile dogrula.
2. Backend endpoint sozlesmelerini ekle: Seafarer Workspace read/write intents, Partner Maritime Workspace jobs/hiring rooms, Allona Connect thread/message, Trust Oversight metadata.
3. RLS negative testleri ekle: adaylar arasi gorunmezlik, partner tenant izolasyonu, hassas icerik vaka olmadan erisim reddi.
4. UI'yi ancak endpointler ve RLS testleri hazirken ekle: Seafarer Workspace, Partner Panel Maritime Workspace ve Admin Control Center.
5. WebRTC saglayicisi secilmeden media ozelligini aktif gosterme; provider secret'i sadece server environment uzerinden bagla.
