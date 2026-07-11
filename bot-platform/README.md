# ALLONAHUB Bot Platform

Bu klasor ALLONAHUB bot gelistirme altyapisini yeni bir paket olarak ekler. Mevcut proje dosyalarini silmez veya degistirmez; bilgi tabani olarak okur.

## Ne Eklendi

- Web chat API: `POST /api/chat`
- Genel webhook: `POST /webhooks/generic`
- Telegram webhook cevabi: `POST /webhooks/telegram`
- WhatsApp webhook normalizasyonu: `POST /webhooks/whatsapp`
- Bilgi tabani arama: proje `.md` dokumanlarindan kaynakli cevap
- Intent siniflandirma: hizmet, teklif, taksi, AVM, sosyal medya, hukuk, guvenlik, panel ve denizcilik
- Guvenlik: rate limit, HMAC webhook imzasi, hassas veri maskeleme, prompt-injection/risk tespiti
- Destek kaydi: riskli veya insan onayi gereken konularda `support-tickets.jsonl`
- Gunluk rapor: `GET /api/report/daily`
- Offline agent aksiyonlari: `GET /api/agent/actions`
- Insan onay kuyrugu: `GET /api/agent/approvals`
- Yerel onay karari: `POST /api/agent/approval-decision`
- Opsiyonel OpenAI Responses API entegrasyonu: varsayilan kapali
- Akilli cevap planlama: musteri tonu, eksik bilgi, onceki niyet ve next-best-action ile cevap hazirlama
- Cok turlu konusma hafizasi: teklif ve destek akislari sonraki mesajlarda surdurulur
- Ucretsiz Seviye 5 offline agent: dis API kullanmadan yerel aksiyon planlar, panel gorevi hazirlar ve riskli islemleri onay kuyruguna alir
- Maliyet korumasi: `BOT_COST_MODE=free` iken OpenAI/API cagrilari teknik olarak kapali tutulur

## Calistirma

Sistemde Node.js varsa:

```bash
cd bot-platform
npm test
npm start
```

Codex paketli Node.js ile:

```bash
/Users/allonabusiness/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs
/Users/allonabusiness/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node src/server.mjs
```

Chat istegi:

```bash
curl -X POST http://127.0.0.1:8787/api/chat \
  -H 'Content-Type: application/json' \
  -d @examples/chat-request.json
```

## Ucretsiz Seviye 5 Modu

Varsayilan mod `BOT_COST_MODE=free` degeridir. Bu modda:

- OpenAI veya baska dis AI API cagrisi yapilmaz.
- Token harcanmaz.
- Bot yerel bilgi tabani, kural motoru, musteri baglami ve offline agent planlayici ile calisir.
- Riskli islemler uygulanmaz; `approval-queue.jsonl` icine insan onayi icin yazilir.
- Guvenli yerel aksiyonlar `offline-agent-actions.jsonl` icine kaydedilir.
- Panel entegrasyonu gelene kadar onay kuyrugu HTTP endpointleriyle okunabilir.

## AI Kullanimi

Varsayilan modda bot yerel bilgi tabani, offline agent ve guvenlik katmaniyla calisir. OpenAI Responses API kullanmak icin ileride model, veri politikasi ve butce onaylandiktan sonra once `BOT_COST_MODE=paid_api` yapilmalidir:

```bash
BOT_COST_MODE=paid_api
BOT_ENABLE_AI=true
OPENAI_API_KEY=...
OPENAI_MODEL=...
```

Model bilincli olarak varsayilan verilmedi. Boylece guncel model, maliyet ve veri isleme karari alinmadan dis AI cagrisi acilmaz.

## Guvenlik Kararlari

- Bot riskli islemleri otomatik yapmaz.
- Odeme, iade, yolculuk iptali, rol degisikligi, veri disari aktarma, kupon kullanma ve sosyal medya yayini insan onayi gerektirir.
- Loglarda e-posta, telefon, token, kart ve benzeri hassas degerler maskelenir.
- Webhook imzasi icin `BOT_WEBHOOK_SECRET` tanimlanabilir.

## Sonraki Gelistirme

- Admin/User/Partner panellerine destek kaydi gorunumu eklenmeli.
- Gercek CRM veya destek kuyruğu entegrasyonu baglanmali.
- WhatsApp outbound mesaj gonderimi icin resmi token ve izinler tamamlanmali.
- AVM, taksi ve denizcilik icin gercek API araclari eklenmeli.
- Production AI icin model, eval, maliyet siniri, insan geri bildirimi ve guvenli tool onay mekanizmasi eklenmeli.
