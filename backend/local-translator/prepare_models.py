from __future__ import annotations

import argparse
import json
from pathlib import Path

from huggingface_hub import snapshot_download


MODEL_FILES = [
    "config.json",
    "generation_config.json",
    "model.safetensors",
    "sentencepiece.bpe.model",
    "special_tokens_map.json",
    "tokenizer_config.json",
    "added_tokens.json",
    "vocab.json",
]


def download_and_normalize(repo_id: str, revision: str, destination: Path) -> None:
    snapshot_download(
        repo_id=repo_id,
        revision=revision,
        local_dir=str(destination),
        allow_patterns=MODEL_FILES,
    )
    tokenizer_config_path = destination / "tokenizer_config.json"
    tokenizer_config = json.loads(tokenizer_config_path.read_text(encoding="utf-8"))
    # The directional Kyrgyz repositories contain __ky__ as an added token,
    # while the upstream M2M100 tokenizer rejects ky as its initial src_lang.
    # A known base language lets the converter load the exact same vocabulary;
    # runtime requests add the __ky__ token explicitly where required.
    tokenizer_config["src_lang"] = "en"
    tokenizer_config_path.write_text(
        json.dumps(tokenizer_config, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--en-ky-revision", required=True)
    parser.add_argument("--ky-en-revision", required=True)
    parser.add_argument("--output-root", default="/sources")
    args = parser.parse_args()
    root = Path(args.output_root)
    download_and_normalize("alinatl/m2m100-en-ky", args.en_ky_revision, root / "m2m100-en-ky")
    download_and_normalize("alinatl/m2m100-ky-en", args.ky_en_revision, root / "m2m100-ky-en")


if __name__ == "__main__":
    main()
