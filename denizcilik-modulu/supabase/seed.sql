insert into public.maritime_freight_rates
  (route, origin, destination, transit_days, carrier, mode, container_type, price_usd, validity, status, capacity, updated_at_label, note)
values
  ('Ambarli - Hamburg', 'Istanbul Ambarli', 'Hamburg', 11, 'Marmara Forwarding', 'FCL', '40HC', 3150, '2026-07-15', 'Onayli', '18 TEU', '2026-06-27', 'Haftalik cikis, ISPS ve dokumantasyon haric.'),
  ('Mersin - Jeddah', 'Mersin', 'Jeddah', 8, 'Akdeniz Line', 'FCL', '40HC', 2200, '2026-07-10', 'Yeni', '26 TEU', '2026-06-27', 'Gida ve kuru yuk icin uygun slot.'),
  ('Izmir - Valencia', 'Izmir Alsancak', 'Valencia', 9, 'Ege Container Lines', 'FCL', '20DC', 1650, '2026-07-12', 'Onayli', '12 TEU', '2026-06-26', 'Dokumantasyon ve lokal masraflar ayrica teyit edilir.'),
  ('Gemlik - Alexandria', 'Gemlik', 'Alexandria', 7, 'Bosphorus Shipping', 'FCL', '40HC', 1850, '2026-07-08', 'Kapasite Acik', '20 TEU', '2026-06-27', 'Tekstil ve makine yukleri icin oncelikli.'),
  ('Mersin - Rotterdam', 'Mersin', 'Rotterdam', 14, 'North Sea Logistics', 'FCL', '40HC', 3450, '2026-07-18', 'Onayli', '16 TEU', '2026-06-27', 'Haftada iki servis; liman yogunlugu icin opsiyonlu ETD.'),
  ('Haydarpasa - Piraeus', 'Haydarpasa', 'Piraeus', 4, 'Liman360', 'LCL', '1-6 CBM', 780, '2026-07-05', 'Yeni', '32 CBM', '2026-06-26', 'Parsiyel yuk icin min. 1 CBM ucretlendirme.'),
  ('Aliaga - Antwerp', 'Aliaga', 'Antwerp', 13, 'Atlas Chartering', 'FCL', '40HC', 3320, '2026-07-15', 'Onayli', '14 TEU', '2026-06-25', 'Kimyasal olmayan paketli yukler icin onayli.'),
  ('Iskenderun - Jebel Ali', 'Iskenderun', 'Jebel Ali', 10, 'Kizildeniz Freight', 'FCL', '40HC', 2750, '2026-07-20', 'Kapasite Acik', '22 TEU', '2026-06-27', 'Transit sure liman programina gore +/- 1 gun oynar.'),
  ('Trabzon - Poti', 'Trabzon', 'Poti', 2, 'Karadeniz Ro-Ro', 'Ro-Ro', 'Tir Slot', 690, '2026-07-09', 'Yeni', '9 arac', '2026-06-27', 'Surucu ve arac evrak kontrolu zorunlu.'),
  ('Samsun - Constanta', 'Samsun', 'Constanta', 5, 'Blacksea Link', 'FCL', '20DC', 1280, '2026-07-11', 'Onayli', '15 TEU', '2026-06-26', 'Konteyner depozito sartlari firma bazinda degisir.');

insert into public.maritime_companies
  (name, type, base, verified, rating, phone, email, website, lanes, services, response_time, active_offers)
values
  ('Marmara Forwarding', 'Forwarder', 'Istanbul', true, 4.8, '+90 212 700 18 42', 'operasyon@marmaraforwarding.example', 'firmalar.html#company-marmara', array['Kuzey Avrupa', 'Akdeniz', 'Karadeniz'], array['FCL', 'LCL', 'Gumruk koordinasyonu', 'Depo'], '28 dk', 18),
  ('Ege Container Lines', 'Hat acentesi', 'Izmir', true, 4.7, '+90 232 700 44 18', 'sales@egecontainer.example', 'firmalar.html#company-ege', array['Ispanya', 'Italya', 'Fransa'], array['FCL', 'Reefer', 'IMO on inceleme'], '35 dk', 11),
  ('Atlas Chartering', 'Broker', 'Aliaga', true, 4.9, '+90 232 700 64 73', 'charter@atlasmaritime.example', 'firmalar.html#company-atlas', array['Antwerp', 'Rotterdam', 'Hamburg'], array['Breakbulk', 'FCL', 'Proje yuk'], '22 dk', 9),
  ('Liman360', 'Dijital lojistik', 'Istanbul', true, 4.6, '+90 216 700 30 60', 'partner@liman360.example', 'firmalar.html#company-liman360', array['Yunanistan', 'Italya', 'Kibris'], array['LCL', 'Teklif toplama', 'Evrak takip'], '18 dk', 24),
  ('Kizildeniz Freight', 'Forwarder', 'Iskenderun', false, 4.4, '+90 326 700 12 08', 'ops@kizildenizfreight.example', 'firmalar.html#company-kizildeniz', array['Jebel Ali', 'Dammam', 'Jeddah'], array['FCL', 'Transit yuk', 'Saha takip'], '46 dk', 13),
  ('Blacksea Link', 'Ro-Ro ve konteyner', 'Samsun', true, 4.5, '+90 362 700 91 22', 'desk@blacksealink.example', 'firmalar.html#company-blacksea', array['Poti', 'Constanta', 'Batumi'], array['Ro-Ro', 'FCL', 'Arac evrak kontrolu'], '31 dk', 15);

insert into public.maritime_consultants
  (name, title, city, experience, rating, email, phone, specialties, next_slot, price_try)
values
  ('Aylin Karaca', 'Navlun ve hat secimi danismani', 'Istanbul', '12 yil', 4.9, 'aylin.karaca@allonahub.example', '+90 532 700 11 22', array['FCL pazarlik', 'Kuzey Avrupa', 'SLA kontrolu'], 'Bugun 16:30', 1850),
  ('Emre Yildiz', 'Gumruk ve evrak akisi uzmani', 'Mersin', '10 yil', 4.8, 'emre.yildiz@allonahub.example', '+90 533 700 91 40', array['Ihracat evraki', 'Liman masraflari', 'Transit sure'], 'Yarin 10:00', 1600),
  ('Selin Onur', 'Reefer ve hassas yuk operasyonu', 'Izmir', '9 yil', 4.7, 'selin.onur@allonahub.example', '+90 535 700 84 15', array['Reefer', 'Gida', 'ETA risk takibi'], 'Bugun 14:00', 1750),
  ('Mert Aksoy', 'Ro-Ro ve kara-deniz baglantisi', 'Samsun', '8 yil', 4.6, 'mert.aksoy@allonahub.example', '+90 536 700 07 68', array['Ro-Ro', 'Karadeniz', 'Arac dokumani'], 'Yarin 15:30', 1450);

insert into public.maritime_posts
  (type, title, owner, route, published_at_label, price_usd, status, content, tags)
values
  ('Navlun Paylasimi', 'Mersin - Rotterdam 40HC icin haftalik sabit slot', 'North Sea Logistics', 'Mersin - Rotterdam', '2026-06-27 09:20', 3450, 'Yayinda', 'Temmuz ortasina kadar haftalik 16 TEU kapasite. Kuru yuk ve paketli makine sevkiyatlari onceliklidir.', array['FCL', '40HC', 'Kuzey Avrupa']),
  ('Bos Kapasite', 'Izmir cikisli Ispanya hattinda ek parsiyel alan', 'Liman360', 'Izmir - Valencia', '2026-06-27 10:05', 780, 'Yayinda', '1-6 CBM arasi parsiyel yukler icin ek konsolidasyon alani acildi. ETD teyidi operasyon masasindan alinabilir.', array['LCL', 'Parsiyel', 'Ispanya']),
  ('Danisman Notu', 'Jeddah hattinda evrak teyidi yukleme oncesine alinmali', 'Emre Yildiz', 'Mersin - Jeddah', '2026-06-26 17:40', 0, 'Yayinda', 'Kirmizi Deniz sevkiyatlarinda alici evraki gecikmesi demuraj riskini artiriyor. Booking oncesi alici teyidi onerilir.', array['Evrak', 'Risk', 'Jeddah']),
  ('Hizli Teklif', 'Gemlik - Alexandria icin tekstil yuklerine ozel servis', 'Bosphorus Shipping', 'Gemlik - Alexandria', '2026-06-26 14:15', 1850, 'Yayinda', '40HC tekstil yuklerinde haftalik cikis; yukleme fotograflari ve konteyner muhur bilgisi partner panelinden islenir.', array['Tekstil', '40HC', 'Misir']),
  ('Operasyon Uyarisi', 'Ambarli hafta sonu saha yogunlugu icin erken kapama', 'Marmara Forwarding', 'Ambarli - Hamburg', '2026-06-25 18:00', 0, 'Yayinda', 'Hafta sonu liman kapisi yogunlugu nedeniyle cut-off saatinden once saha giris randevusu alinmasi onerilir.', array['Cut-off', 'Ambarli', 'Saha']);

insert into public.maritime_quote_requests
  (company_name, contact_name, email, phone, origin, destination, cargo_type, container_type, target_date, budget_usd, status, created_at_label)
values
  ('Anadolu Makine A.S.', 'Ozan Kaya', 'lojistik@anadolumakine.example', '+90 312 700 23 30', 'Konya', 'Hamburg', 'Paketli makine parcasi', '40HC', '2026-07-08', 3300, 'Teklif Toplaniyor', '2026-06-27 08:50'),
  ('Ege Gida', 'Derya Sari', 'export@egegida.example', '+90 232 700 78 01', 'Izmir', 'Valencia', 'Kuru gida', '20DC', '2026-07-03', 1700, 'Partner Yaniti Bekliyor', '2026-06-26 12:30'),
  ('Toros Tekstil', 'Nihan Er', 'sevkiyat@torostekstil.example', '+90 324 700 61 44', 'Mersin', 'Jeddah', 'Tekstil urunu', '40HC', '2026-07-12', 2250, 'On Inceleme', '2026-06-25 15:15');

insert into public.maritime_support_tickets
  (subject, owner, priority, status, updated_at_label)
values
  ('Booking numarasi partner panelinde gorunmuyor', 'Marmara Forwarding', 'Yuksek', 'Acil', '2026-06-27 10:30'),
  ('Jebel Ali hattinda lokal masraf kalemi teyidi', 'Kizildeniz Freight', 'Orta', 'Inceleniyor', '2026-06-27 09:05'),
  ('Ro-Ro arac evraki yukleme listesine eklendi', 'Blacksea Link', 'Dusuk', 'Cozuldu', '2026-06-26 16:45');
