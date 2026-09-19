import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from translation_engine import TranslationEngine, normalize_input, plan_translation


class FakeModel:
    calls = []

    def __init__(self, model_path, cpu_threads):
        self.model_path = model_path
        self.cpu_threads = cpu_threads

    def translate(self, text, source_language, target_language):
        self.calls.append((self.model_path, text, source_language, target_language))
        return f"[{source_language}-{target_language}]{text}"


class TranslationEngineTests(unittest.TestCase):
    def setUp(self):
        FakeModel.calls = []
        self.engine = TranslationEngine(
            model_paths={"m2m100": "base", "en_ky": "en-ky", "ky_en": "ky-en"},
            model_factory=FakeModel,
        )

    def test_direct_supported_language_pair_uses_base_model(self):
        result = self.engine.translate("Merhaba gemici", "tr", "de")
        self.assertEqual(result["translated_text"], "[tr-de]Merhaba gemici")
        self.assertEqual(result["model"], "m2m100")
        self.assertEqual(FakeModel.calls[0][0], "base")

    def test_kyrgyz_target_pivots_through_english(self):
        result = self.engine.translate("Merhaba", "tr", "ky")
        self.assertEqual(result["route"], ["tr:en", "en:ky"])
        self.assertEqual([call[0] for call in FakeModel.calls], ["base", "en-ky"])

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


if __name__ == "__main__":
    unittest.main()
