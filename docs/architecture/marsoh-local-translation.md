# MarSoh Local Translation

MarSoh message translation runs inside AllonaHub's own production server. Message text is not sent to a public free translation endpoint. Existing authentication, message visibility, rate limiting, and translation-cache checks remain in the API before the internal translator is called.

## Runtime

- `marsoh-translator` is reachable only from the private `marsoh-internal` Docker network.
- The service accepts plain text up to 2,000 characters and returns plain text only.
- Requests are serialized during model inference and capped at four waiting requests to protect the host.
- The API stores successful results in `marsoh_translation_cache`, keyed by message, target language, and source hash.
- A failed local translation does not interrupt chat. The UI receives the existing temporary-unavailable response.
- An external provider can remain configured as a future fallback, but no paid API key is required for the local path.

## Languages and models

The primary model is the MIT-licensed `facebook/m2m100_418M`, pinned to commit `55c2e61bbf05dfb8d7abccdc3fae6fc8512fd636` and converted to CTranslate2 INT8 format during the container build. It directly serves Turkish, Azerbaijani, English, German, Russian, Arabic, Kazakh, and Uzbek.

Kyrgyz uses Apache-2.0 licensed OPUS-MT Turkic-language models from Helsinki-NLP:

- `Helsinki-NLP/opus-mt-en-trk` at `f9d8f6cd9d95d2f8ce34943c1f6cfe610d3bbf92`
- `Helsinki-NLP/opus-mt-trk-en` at `be5007c9e9ab775de82c5d7409ae7d2b330190cc`

The English-to-Turkic model is explicitly prompted with the `kir_Cyrl` target code. Kyrgyz-to-non-English and non-English-to-Kyrgyz translations pivot through English. This keeps all nine AllonaHub languages available without a paid service, but a two-step translation can be less precise than a direct model. Machine translation should therefore be presented as automatic translation, not as a certified or human translation.

## Configuration

```dotenv
MARSOH_TRANSLATION_PROVIDER=local
MARSOH_LOCAL_TRANSLATION_URL=http://marsoh-translator:8080
MARSOH_LOCAL_TRANSLATION_TIMEOUT_MS=60000
MARSOH_LOCAL_TRANSLATION_SECRET=
```

`MARSOH_LOCAL_TRANSLATION_SECRET` is optional because the service is isolated on an internal network. It can be set to the same value in both containers for defense in depth if the deployment platform injects shared secrets.

## Deployment verification

1. Build both Compose services. The first build downloads and converts the pinned models, so it is substantially slower than a normal API-only build.
2. Confirm `marsoh-translator` is healthy before the API starts.
3. Confirm `/health` reports `build: marsoh-local-translation-20260919` and `marsoh_translation_mode: local`.
4. Test at least one uncached translation in each direction, including a Kyrgyz route.
5. Confirm a repeated request is returned from the existing database cache.

No new Supabase migration is required; the existing secure translation cache is reused.
