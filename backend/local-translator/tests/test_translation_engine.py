import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from language_quality import (
    LANGUAGE_PROFILES,
    apply_conservative_glossary_repairs,
    glossary_metadata,
    missing_structured_tokens,
    normalize_translation_input,
    postprocess_translation,
    translation_quality,
)
from translation_engine import SUPPORTED_LANGUAGES, TranslationEngine, normalize_input, plan_translation


class FakeModel:
    calls = []

    def __init__(self, model_path, cpu_threads):
        self.model_path = model_path
        self.cpu_threads = cpu_threads

    def translate(self, text, source_language, target_language, quality_mode=False):
        self.calls.append((self.model_path, text, source_language, target_language, quality_mode))
        return f"[{source_language}-{target_language}]{text}"


class RetryModel(FakeModel):
    def translate(self, text, source_language, target_language, quality_mode=False):
        self.calls.append((self.model_path, text, source_language, target_language, quality_mode))
        return "Безопасная вахта" if quality_mode else "safe safe safe safe"


class IdentifierLossModel(FakeModel):
    def translate(self, text, source_language, target_language, quality_mode=False):
        self.calls.append((self.model_path, text, source_language, target_language, quality_mode))
        return "Check the vessel certificate."


class TranslationEngineTests(unittest.TestCase):
    def setUp(self):
        FakeModel.calls = []
        self.engine = TranslationEngine(
            model_paths={"m2m100": "base", "en_ky": "en-ky", "ky_en": "ky-en"},
            model_factory=FakeModel,
        )

    def test_direct_supported_language_pair_uses_base_model(self):
        result = self.engine.translate("Merhaba dünya", "tr", "de")
        self.assertEqual(result["translated_text"], "[tr-de]Merhaba dünya")
        self.assertEqual(result["model"], "m2m100")
        self.assertEqual(result["engine_version"], "2.0.0")
        self.assertEqual(FakeModel.calls[0][0], "base")

    def test_kyrgyz_target_pivots_through_english(self):
        result = self.engine.translate("Merhaba", "tr", "ky")
        self.assertEqual(result["route"], ["tr:en", "en:ky"])
        self.assertEqual([call[0] for call in FakeModel.calls], ["base", "en-ky", "base", "en-ky"])

    def test_kyrgyz_source_pivots_through_english(self):
        result = self.engine.translate("Салам", "ky", "az")
        self.assertEqual(result["route"], ["ky:en", "en:az"])
        self.assertEqual([call[0] for call in FakeModel.calls], ["ky-en", "base"])

    def test_same_language_is_private_identity_translation(self):
        result = self.engine.translate("  Salam  ", "az", "az")
        self.assertEqual(result["translated_text"], "Salam")
        self.assertEqual(result["provider"], "local_identity")
        self.assertEqual(FakeModel.calls, [])

    def test_invalid_or_oversized_input_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "empty_text"):
            normalize_input("  ")
        with self.assertRaisesRegex(ValueError, "text_too_long"):
            normalize_input("x" * 2001)
        with self.assertRaisesRegex(ValueError, "unsupported_language"):
            plan_translation("tr", "fr")

    def test_unicode_controls_are_removed_before_translation(self):
        self.assertEqual(normalize_translation_input("  Var\u200bdiya\t güvenliği  "), "Vardiya güvenliği")

    def test_language_profiles_and_glossary_cover_every_supported_language(self):
        self.assertEqual(set(LANGUAGE_PROFILES), set(SUPPORTED_LANGUAGES))
        metadata = glossary_metadata()
        self.assertGreaterEqual(metadata["term_count"], 30)
        self.assertEqual(metadata["neural_vocabulary_size"], 128112)
        self.assertEqual(set(metadata["languages"]), set(SUPPORTED_LANGUAGES))
        self.assertTrue(all(
            coverage["mode"] == "shared_subword_neural" and coverage["units"] >= 25_000
            for coverage in metadata["general_coverage"].values()
        ))

    def test_untranslated_maritime_term_is_repaired_without_reordering_sentence(self):
        repaired, terms = apply_conservative_glossary_repairs(
            "Denizci makine dairesi bölümünde çalışıyor.",
            "The seafarer works in the makine dairesi.",
            "tr",
            "de",
        )
        self.assertEqual(repaired, "The seafarer works in the Maschinenraum.")
        self.assertEqual(terms, ("engine_room",))

    def test_structured_maritime_identifiers_must_survive_translation(self):
        source = "IMO 9389370 ve STCW A-II/4 bilgilerini kontrol edin."
        self.assertEqual(missing_structured_tokens(source, "Check IMO 9389370 and STCW A-II/4."), ())
        self.assertIn("IMO 9389370", missing_structured_tokens(source, "Check the vessel."))

    def test_arabic_output_uses_arabic_punctuation(self):
        self.assertEqual(postprocess_translation("هل الوردية آمنة, نعم?", "ar"), "هل الوردية آمنة، نعم؟")
        self.assertEqual(postprocess_translation("الأجر 3,500 USD, صحيح?", "ar"), "الأجر 3,500 USD، صحيح؟")

    def test_quality_report_detects_repetition_and_wrong_script(self):
        report = translation_quality("Güvenli vardiya", "safe safe safe safe", "ru")
        self.assertFalse(report["script_plausible"])
        self.assertTrue(report["excessive_repetition"])

    def test_low_quality_output_gets_a_stricter_second_decode(self):
        engine = TranslationEngine(
            model_paths={"m2m100": "base", "en_ky": "en-ky", "ky_en": "ky-en"},
            model_factory=RetryModel,
        )
        result = engine.translate("Güvenli vardiya", "tr", "ru")
        self.assertEqual(result["translated_text"], "Безопасная вахта")
        self.assertEqual([call[4] for call in RetryModel.calls], [False, True])

    def test_translation_fails_closed_when_maritime_identifier_is_lost_twice(self):
        engine = TranslationEngine(
            model_paths={"m2m100": "base", "en_ky": "en-ky", "ky_en": "ky-en"},
            model_factory=IdentifierLossModel,
        )
        with self.assertRaisesRegex(RuntimeError, "translation_quality_failed"):
            engine.translate("IMO 9389370 sertifikasını kontrol edin", "tr", "en")


if __name__ == "__main__":
    unittest.main()
