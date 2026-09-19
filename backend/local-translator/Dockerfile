FROM python:3.11-slim AS converter

ARG CT2_VERSION=4.8.2
ARG TRANSFORMERS_VERSION=4.57.6
ARG TORCH_VERSION=2.8.0
ARG M2M100_REVISION=55c2e61bbf05dfb8d7abccdc3fae6fc8512fd636
ARG EN_KY_REVISION=ccc530699de3ac70a9025dbab7e3a28f0a0d7fbf
ARG KY_EN_REVISION=b58e6ac487460ea01f333dd9bb9150c7fd2ec57b

ENV HF_HUB_DISABLE_TELEMETRY=1 \
    TRANSFORMERS_NO_ADVISORY_WARNINGS=1

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates libgomp1 && \
    rm -rf /var/lib/apt/lists/*

RUN python -m pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu "torch==${TORCH_VERSION}" && \
    python -m pip install --no-cache-dir "ctranslate2==${CT2_VERSION}" "transformers==${TRANSFORMERS_VERSION}" sentencepiece==0.2.1 safetensors==0.6.2

WORKDIR /build
COPY prepare_models.py ./prepare_models.py
RUN python prepare_models.py \
      --en-ky-revision "${EN_KY_REVISION}" \
      --ky-en-revision "${KY_EN_REVISION}" \
      --output-root /sources

RUN ct2-transformers-converter \
      --model facebook/m2m100_418M \
      --revision "${M2M100_REVISION}" \
      --quantization int8 \
      --copy_files sentencepiece.bpe.model tokenizer_config.json special_tokens_map.json vocab.json generation_config.json \
      --output_dir /models/m2m100 && \
    ct2-transformers-converter \
      --model /sources/m2m100-en-ky \
      --quantization int8 \
      --copy_files sentencepiece.bpe.model tokenizer_config.json special_tokens_map.json added_tokens.json vocab.json generation_config.json \
      --output_dir /models/m2m100-en-ky && \
    ct2-transformers-converter \
      --model /sources/m2m100-ky-en \
      --quantization int8 \
      --copy_files sentencepiece.bpe.model tokenizer_config.json special_tokens_map.json added_tokens.json vocab.json generation_config.json \
      --output_dir /models/m2m100-ky-en && \
    rm -rf /root/.cache/huggingface /sources && \
    find /models -type f \( -name '*.bin' -o -name '*.json' -o -name '*.model' \) | sort

FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1 \
    PORT=8080

WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates libgomp1 && \
    rm -rf /var/lib/apt/lists/* && \
    python -m pip install --no-cache-dir -r requirements.txt && \
    useradd --create-home --uid 10001 translator

COPY --from=converter --chown=translator:translator /models /models
COPY --chown=translator:translator translation_engine.py server.py ./

USER translator
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=3)" || exit 1
CMD ["python", "server.py"]
