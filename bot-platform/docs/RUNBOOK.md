# Bot Operasyon Runbook

## Gunluk Kontrol

1. `GET /health` ile servis ayakta mi kontrol edilir.
2. `GET /api/report/daily` ile gunluk gorusme, insan devri ve kritik ticket sayisi incelenir.
3. `runtime/support-tickets.jsonl` icindeki kritik kayitlar sorumlu kuyruga aktarilir.
4. `runtime/bot-errors.jsonl` varsa hata kok nedeni incelenir.
5. Cevapsiz sorular bilgi tabanina yeni SSS olarak planlanir.

## Kritik Durumlar

| Durum | Aksiyon |
| --- | --- |
| Prompt injection sinyali | Otomatik cevap sinirli tutulur, guvenlik kaydi incelenir |
| Odeme/iade/iptal talebi | Insan onayi olmadan islem yapilmaz |
| KVKK veya veri silme talebi | Hukuk-politika ve user panel kuyruguna aktarilir |
| Token/sifre paylasimi | Mesaj maskelenir, kullaniciya tekrar paylasmamasi soylenir |
| Webhook imza hatasi | Kanal secret ve kaynak IP/uygulama kontrol edilir |

## Yayina Hazirlik

- `BOT_WEBHOOK_SECRET` tanimli olmalidir.
- `BOT_STORAGE_DIR` kalici ve erisim kontrollu bir dizin olmalidir.
- Log rotasyonu ve yedekleme politikasi belirlenmelidir.
- AI acilacaksa `OPENAI_MODEL`, veri politikasi ve maliyet siniri onaylanmalidir.
- Admin/User/Partner panel destek kuyrugu entegrasyonu tamamlanmalidir.
