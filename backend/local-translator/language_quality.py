from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path


ENGINE_VERSION = "2.0.0"
NEURAL_VOCABULARY_SIZE = 128_112
GLOSSARY_PATH = Path(__file__).with_name("maritime_glossary.json")


@dataclass(frozen=True)
class LanguageProfile:
    code: str
    name: str
    script: str
    direction: str
    sentence_order: str
    plural_categories: tuple[str, ...]


LANGUAGE_PROFILES = {
    "tr": LanguageProfile("tr", "Turkish", "latin", "ltr", "SOV", ("one", "other")),
    "az": LanguageProfile("az", "Azerbaijani", "latin", "ltr", "SOV", ("one", "other")),
    "en": LanguageProfile("en", "English", "latin", "ltr", "SVO", ("one", "other")),
    "de": LanguageProfile("de", "German", "latin", "ltr", "SVO/V2", ("one", "other")),
    "ru": LanguageProfile("ru", "Russian", "cyrillic", "ltr", "flexible-SVO", ("one", "few", "many", "other")),
    "ar": LanguageProfile("ar", "Arabic", "arabic", "rtl", "VSO/SVO", ("zero", "one", "two", "few", "many", "other")),
    "kk": LanguageProfile("kk", "Kazakh", "cyrillic", "ltr", "SOV", ("one", "other")),
    "uz": LanguageProfile("uz", "Uzbek", "latin", "ltr", "SOV", ("one", "other")),
    "ky": LanguageProfile("ky", "Kyrgyz", "cyrillic", "ltr", "SOV", ("one", "other")),
}


_SCRIPT_PATTERNS = {
    "latin": re.compile(r"[A-Za-z\u00c0-\u024f]"),
    "cyrillic": re.compile(r"[\u0400-\u052f]"),
    "arabic": re.compile(r"[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]"),
}

_STRUCTURED_TOKEN_PATTERN = re.compile(
    r"\b(?:IMO\s*\d{7}|MMSI\s*\d{9}|(?:STCW|SOLAS|MARPOL|ISM|ISPS|MLC|ITF|DWT|GRT|GT|NT)"
    r"|[A-Z]-?(?:I|V|X){1,4}/\d+(?:-\d+)?|\d+(?:[.,]\d+)?\s*(?:USD|EUR|TRY|AZN|KZT|UZS|KGS))\b",
    re.IGNORECASE,
)


def _load_glossary() -> dict:
    with GLOSSARY_PATH.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    terms = payload.get("terms", [])
    if not isinstance(terms, list) or not terms:
        raise RuntimeError("maritime_glossary_empty")
    required = set(LANGUAGE_PROFILES)
    for term in terms:
        labels = term.get("labels", {})
        if set(labels) != required or any(not str(labels[code]).strip() for code in required):
            raise RuntimeError(f"maritime_glossary_incomplete:{term.get('id', 'unknown')}")
    return payload


MARITIME_GLOSSARY = _load_glossary()


def normalize_translation_input(text: str) -> str:
    value = unicodedata.normalize("NFKC", str(text or ""))
    value = re.sub(r"[\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]", "", value)
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    value = re.sub(r"[\t\f\v]+", " ", value)
    value = re.sub(r" {2,}", " ", value)
    value = re.sub(r" *\n *", "\n", value)
    return value.strip()


def structured_tokens(text: str) -> tuple[str, ...]:
    return tuple(dict.fromkeys(match.group(0).strip() for match in _STRUCTURED_TOKEN_PATTERN.finditer(text)))


def missing_structured_tokens(source: str, translated: str) -> tuple[str, ...]:
    folded_output = unicodedata.normalize("NFKC", translated).casefold().replace(" ", "")
    return tuple(
        token for token in structured_tokens(source)
        if unicodedata.normalize("NFKC", token).casefold().replace(" ", "") not in folded_output
    )


def apply_conservative_glossary_repairs(
    source: str,
    translated: str,
    source_language: str,
    target_language: str,
) -> tuple[str, tuple[str, ...]]:
    """Repair only terms the model copied unchanged; never reorder generated sentences."""
    output = translated
    repaired: list[str] = []
    for term in MARITIME_GLOSSARY["terms"]:
        source_label = str(term["labels"][source_language]).strip()
        target_label = str(term["labels"][target_language]).strip()
        if source_label.casefold() == target_label.casefold():
            continue
        source_match = re.search(rf"(?<!\w){re.escape(source_label)}(?!\w)", source, flags=re.IGNORECASE)
        untranslated_match = re.search(rf"(?<!\w){re.escape(source_label)}(?!\w)", output, flags=re.IGNORECASE)
        if source_match and untranslated_match:
            output = output[:untranslated_match.start()] + target_label + output[untranslated_match.end():]
            repaired.append(term["id"])
    return output, tuple(repaired)


def postprocess_translation(text: str, target_language: str) -> str:
    if target_language not in LANGUAGE_PROFILES:
        raise ValueError("unsupported_language_profile")
    value = unicodedata.normalize("NFC", str(text or "")).strip()
    value = re.sub(r"[\t\f\v ]+", " ", value)
    value = re.sub(r" *\n *", "\n", value)
    value = re.sub(r"\s+([,.;:!?])", r"\1", value)
    value = re.sub(r"([!?.,؛،؟])\1{2,}", r"\1", value)
    if target_language == "ar":
        value = re.sub(r"(?<!\d),(?!\d)", "،", value)
        value = value.replace(";", "؛").replace("?", "؟")
        value = re.sub(r"\s+([،؛؟])", r"\1", value)
    return value.strip()


def translation_quality(
    source: str,
    translated: str,
    target_language: str,
    repaired_terms: tuple[str, ...] = (),
) -> dict:
    profile = LANGUAGE_PROFILES[target_language]
    letters = [character for character in translated if character.isalpha()]
    expected = _SCRIPT_PATTERNS[profile.script]
    expected_count = sum(1 for character in letters if expected.fullmatch(character))
    script_ratio = round(expected_count / len(letters), 3) if letters else 1.0
    missing = missing_structured_tokens(source, translated)
    repeated = bool(re.search(r"\b([^\W\d_]{2,})(?:\s+\1){3,}\b", translated, flags=re.IGNORECASE))
    return {
        "profile": profile.code,
        "direction": profile.direction,
        "sentence_order": profile.sentence_order,
        "script_ratio": script_ratio,
        "script_plausible": script_ratio >= (0.35 if len(letters) >= 8 else 0.0),
        "structured_tokens_preserved": not missing,
        "missing_structured_tokens": list(missing),
        "excessive_repetition": repeated,
        "glossary_repairs": list(repaired_terms),
    }


def glossary_metadata() -> dict:
    return {
        "version": str(MARITIME_GLOSSARY.get("version", "unknown")),
        "term_count": len(MARITIME_GLOSSARY["terms"]),
        "languages": sorted(LANGUAGE_PROFILES),
        "neural_vocabulary_size": NEURAL_VOCABULARY_SIZE,
        "general_coverage": {
            language: {"mode": "shared_subword_neural", "units": NEURAL_VOCABULARY_SIZE}
            for language in sorted(LANGUAGE_PROFILES)
        },
    }
