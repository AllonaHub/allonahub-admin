# Bot Mimarisi

## Katmanlar

| Katman | Dosya | Gorev |
| --- | --- | --- |
| HTTP | `src/http/server.mjs` | Chat ve webhook endpointlerini sunar |
| Orkestrator | `src/core/orchestrator.mjs` | Intent, risk, bilgi tabani, AI ve insan devrini yonetir |
| Intent | `src/core/intent.mjs` | Kullanici mesajini modullere ayirir |
| Bilgi tabani | `src/knowledge/loader.mjs` | Proje dokumanlarini parcalar ve arar |
| Guvenlik | `src/security/*` | Redaction, risk, rate limit ve imza dogrulama |
| Destek | `src/tools/support-ticket.mjs` | Insan devri ve panel sahipligi icin kayit acma |
| Raporlama | `src/tools/reporting.mjs` | Gunluk bot raporu uretme |
| AI | `src/ai/openai-responses.mjs` | Opsiyonel Responses API cagrisi |

## Varsayilan Akis

1. Kanal adaptorunden standart mesaj gelir.
2. Rate limit ve gerekiyorsa webhook imzasi kontrol edilir.
3. Intent siniflandirilir.
4. Risk analizi yapilir.
5. Bilgi tabaninda ilgili kaynaklar aranir.
6. Riskli veya insan onayi gereken konuysa destek kaydi acilir.
7. AI etkinse onayli bilgi baglamiyla cevap uretilir; degilse kaynakli yerel cevap doner.
8. Konusma olayi maskelenerek JSONL loga yazilir.

## Panel Baglantisi

Destek kayitlarindaki `owner` alani panel rotasini belirler:

- `taksi-operasyon`
- `avm-operasyon`
- `sosyal-medya`
- `partner-panel`
- `user-panel`
- `hukuk-politika`
- `guvenlik`
- `destek`

Bu alanlar ileride Admin, User ve Partner panellerindeki is kuyruklarina baglanmalidir.
