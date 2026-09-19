from __future__ import annotations

import os
import re
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Callable


SUPPORTED_LANGUAGES = frozenset({"tr", "az", "en", "de", "ru", "ar", "kk", "uz", "ky"})
M2M100_LANGUAGES = SUPPORTED_LANGUAGES - {"ky"}
MAX_TEXT_CHARS = 2000
MAX_SOURCE_TOKENS = 850


class TranslationInputError(ValueError):
    pass


@dataclass(frozen=True)
class TranslationStep:
    model_key: str
    source_language: str
    target_language: str


MODEL_PATHS = {
    "m2m100": "/models/m2m100",
    "en_ky": "/models/opus-en-trk",
    "ky_en": "/models/opus-trk-en",
}


def plan_translation(source_language: str, target_language: str) -> tuple[TranslationStep, ...]:
    source = str(source_language or "").strip().lower()
    target = str(target_language or "").strip().lower()
    if source not in SUPPORTED_LANGUAGES or target not in SUPPORTED_LANGUAGES:
        raise TranslationInputError("unsupported_language")
    if source == target:
        return ()
    if source == "ky":
        first = TranslationStep("ky_en", "ky", "en")
        return (first,) if target == "en" else (first, TranslationStep("m2m100", "en", target))
    if target == "ky":
        last = TranslationStep("en_ky", "en", "ky")
        return (last,) if source == "en" else (TranslationStep("m2m100", source, "en"), last)
    return (TranslationStep("m2m100", source, target),)


def normalize_input(text: str) -> str:
    value = str(text or "").replace("\x00", "").strip()
    if not value:
        raise TranslationInputError("empty_text")
    if len(value) > MAX_TEXT_CHARS:
        raise TranslationInputError("text_too_long")
    return value


class CTranslateModel:
    def __init__(self, model_path: str, cpu_threads: int):
        import ctranslate2
        from transformers import M2M100Tokenizer, MarianTokenizer

        self.path = Path(model_path)
        if not (self.path / "model.bin").is_file():
            raise RuntimeError(f"model_not_ready:{self.path.name}")
        self.is_m2m100 = (self.path / "sentencepiece.bpe.model").is_file()
        tokenizer_class = M2M100Tokenizer if self.is_m2m100 else MarianTokenizer
        self.tokenizer = tokenizer_class.from_pretrained(str(self.path), local_files_only=True)
        self.translator = ctranslate2.Translator(
            str(self.path),
            device="cpu",
            compute_type="int8",
            inter_threads=1,
            intra_threads=max(1, cpu_threads),
        )

    def _language_token(self, language: str) -> str:
        language_map = getattr(self.tokenizer, "lang_code_to_token", {})
        token = language_map.get(language, f"__{language}__")
        token_id = self.tokenizer.convert_tokens_to_ids(token)
        if token_id == self.tokenizer.unk_token_id:
            raise RuntimeError("unsupported_model_language")
        return token

    def _source_tokens(self, text: str, source_language: str, target_language: str) -> list[str]:
        if self.is_m2m100:
            self.tokenizer.src_lang = source_language
            token_ids = self.tokenizer.encode(text)
        else:
            value = f">>kir_Cyrl<< {text}" if target_language == "ky" else text
            token_ids = self.tokenizer.encode(value)
        return self.tokenizer.convert_ids_to_tokens(token_ids)

    def _token_count(self, text: str, source_language: str, target_language: str) -> int:
        return len(self._source_tokens(text, source_language, target_language))

    def _chunks(self, text: str, source_language: str, target_language: str) -> list[str]:
        if self._token_count(text, source_language, target_language) <= MAX_SOURCE_TOKENS:
            return [text]

        parts = [part for part in re.split(r"(?<=[.!?…])\s+|\n+", text) if part.strip()]
        if len(parts) == 1:
            parts = re.findall(r"\S+\s*", text)
        chunks: list[str] = []
        current = ""
        for part in parts:
            candidate = f"{current} {part.strip()}".strip()
            if current and self._token_count(candidate, source_language, target_language) > MAX_SOURCE_TOKENS:
                chunks.append(current)
                current = part.strip()
            else:
                current = candidate
        if current:
            chunks.append(current)
        if any(self._token_count(chunk, source_language, target_language) > MAX_SOURCE_TOKENS for chunk in chunks):
            raise TranslationInputError("text_token_limit")
        return chunks

    def translate(self, text: str, source_language: str, target_language: str) -> str:
        target_prefix = [self._language_token(target_language)] if self.is_m2m100 else None
        translated_parts: list[str] = []
        for chunk in self._chunks(text, source_language, target_language):
            source_tokens = self._source_tokens(chunk, source_language, target_language)
            options = dict(
                beam_size=4,
                max_decoding_length=1024,
                repetition_penalty=1.08,
            )
            if target_prefix:
                options["target_prefix"] = [target_prefix]
            results = self.translator.translate_batch([source_tokens], **options)
            output_tokens = results[0].hypotheses[0]
            if target_prefix:
                output_tokens = output_tokens[1:]
            output_ids = self.tokenizer.convert_tokens_to_ids(output_tokens)
            translated = self.tokenizer.decode(output_ids, skip_special_tokens=True).strip()
            if not translated:
                raise RuntimeError("empty_translation")
            translated_parts.append(translated)
        return " ".join(translated_parts)


class TranslationEngine:
    def __init__(
        self,
        model_paths: dict[str, str] | None = None,
        model_factory: Callable[[str, int], object] = CTranslateModel,
    ):
        self.model_paths = dict(model_paths or MODEL_PATHS)
        self.model_factory = model_factory
        self.cpu_threads = max(1, int(os.getenv("CT2_INTRA_THREADS", "2")))
        self._models: dict[str, object] = {}
        self._models_lock = threading.Lock()
        self._translation_lock = threading.Lock()

    def ready(self) -> bool:
        return all((Path(path) / "model.bin").is_file() for path in self.model_paths.values())

    def _model(self, model_key: str):
        with self._models_lock:
            if model_key not in self._models:
                self._models[model_key] = self.model_factory(self.model_paths[model_key], self.cpu_threads)
            return self._models[model_key]

    def translate(self, text: str, source_language: str, target_language: str) -> dict:
        normalized = normalize_input(text)
        steps = plan_translation(source_language, target_language)
        if not steps:
            return {
                "translated_text": normalized,
                "provider": "local_identity",
                "model": "identity",
                "route": [],
            }

        output = normalized
        with self._translation_lock:
            for step in steps:
                output = self._model(step.model_key).translate(output, step.source_language, step.target_language)

        return {
            "translated_text": output,
            "provider": "local_ctranslate2",
            "model": "+".join(step.model_key for step in steps),
            "route": [f"{step.source_language}:{step.target_language}" for step in steps],
        }
