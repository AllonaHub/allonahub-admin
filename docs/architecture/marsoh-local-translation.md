# MarSoh Local Translation v2

MarSoh message translation runs inside AllonaHub's own production server. Message text is not sent to a public free translation endpoint. Existing authentication, message visibility, rate limiting, and translation-cache checks remain in the API before the internal translator is called.

## Runtime

- `marsoh-translator` is reachable only from the private `marsoh-internal` Docker network.
- The service accepts plain text up to 2,000 characters and returns plain text only.
- Requests are serialized during model inference and capped at four waiting requests to protect the host.
- The API stores successful results in `marsoh_translation_cache`, keyed by message, target language, and source hash.
- The source hash includes the translation-engine cache version. A motor upgrade ignores stale translations without deleting historical rows, then caches the new result normally.
- A failed local translation does not interrupt chat. The UI receives the existing temporary-unavailable response.
- An external provider can remain configured as a future fallback, but no paid API key is required for the local path.
- Translation v2 normalizes Unicode input, protects maritime identifiers, applies a reviewed nine-language maritime glossary, and performs target-language script, repetition, punctuation, and structured-token checks.
- If the first decoding pass loses a protected maritime identifier or repeats text excessively, the engine retries with a wider beam and stricter repetition controls, then keeps the higher-quality result.

## Languages and models

The primary model is the MIT-licensed `facebook/m2m100_418M`, pinned to commit `55c2e61bbf05dfb8d7abccdc3fae6fc8512fd636` and converted to CTranslate2 INT8 format during the container build. It directly serves Turkish, Azerbaijani, English, German, Russian, Arabic, Kazakh, and Uzbek.

M2M100 is a sequence-to-sequence translation model, so sentence order and grammar are generated in context instead of replacing words one by one. Its shared tokenizer has 128,112 vocabulary units. The explicit AllonaHub glossary is therefore an accuracy overlay for maritime language, not a replacement general dictionary.

Kyrgyz uses Apache-2.0 licensed OPUS-MT Turkic-language models from Helsinki-NLP:

- `Helsinki-NLP/opus-mt-en-trk` at `f9d8f6cd9d95d2f8ce34943c1f6cfe610d3bbf92`
- `Helsinki-NLP/opus-mt-trk-en` at `be5007c9e9ab775de82c5d7409ae7d2b330190cc`

The English-to-Turkic model is explicitly prompted with the `kir_Cyrl` target code. Kyrgyz-to-non-English and non-English-to-Kyrgyz translations pivot through English. This keeps all nine AllonaHub languages available without a paid service, but a two-step translation can be less precise than a direct model. Machine translation should therefore be presented as automatic translation, not as a certified or human translation.

## Language quality layer

`language_quality.py` contains a profile for every supported language. Profiles record writing direction, primary script, normal sentence order, and CLDR plural categories. These properties are used for validation and locale-aware punctuation. They are deliberately not used to mechanically rearrange generated words, because hand-written word-order rules would damage case endings, agreement, idioms, and subordinate clauses.

The versioned `maritime_glossary.json` covers core ranks, departments, ship types, operations, and certificate language in all nine supported languages. A conservative repair runs only when the model copies a recognized source term unchanged. Correct model output is not overwritten. IMO, MMSI, STCW references, core maritime abbreviations, currencies, and units are checked after translation so a retry can recover a lost identifier.

## Vocabulary policy

The runtime does not pad low-resource languages with invented entries to claim a fixed dictionary size. English Wiktionary-derived coverage currently exceeds 25,000 senses for English, German, Russian, Arabic, and Turkish, but is below that threshold for Azerbaijani, Kazakh, Uzbek, and Kyrgyz. A fabricated 25,000-word list for those languages would reduce quality and make the build impossible to audit.

General-language coverage instead comes from the pinned neural models and their 128,112-unit shared vocabulary; the checked-in glossary contains reviewed maritime terminology. Future dictionary imports must be versioned, licensed, normalized, deduplicated, and accompanied by per-language source counts. Raw dictionary data must not silently change during a production build.

## Source references

- Meta M2M100 model card and supported languages: <https://huggingface.co/facebook/m2m100_418M>
- Pinned model configuration and 128,112-unit vocabulary: <https://huggingface.co/facebook/m2m100_418M/raw/main/config.json>
- Unicode CLDR language plural rules: <https://unicode.org/cldr/charts/49/supplemental/language_plural_rules.html>
- English Wiktionary machine-readable coverage index: <https://kaikki.org/dictionary/index.html>

The Wiktionary coverage check recorded 1,787,236 English, 633,412 German, 492,474 Russian, 101,305 Arabic, 60,299 Turkish, 22,986 Azerbaijani, 16,122 Kazakh, 5,190 Uzbek, and 4,597 Kyrgyz senses. These figures describe source coverage, not guaranteed unique words or translation quality.

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
3. Confirm API `/health` reports `build: marsoh-translation-quality-v2-cache-20260920`, `marsoh_translation_mode: local`, and `marsoh_translation_engine_version: 2.0.0`.
4. Confirm translator `/health` reports `provider: local_ctranslate2_quality_v2`, `engine_version: 2.0.0`, nine languages, and the expected glossary metadata.
5. Test at least one uncached translation in each direction, including a Kyrgyz route and a message containing IMO/STCW identifiers.
6. Confirm a repeated request is returned from the existing database cache.

No new Supabase migration is required; the existing secure translation cache is reused.
