FROM python:3.11-slim AS converter

ARG CT2_VERSION=4.8.2
ARG TRANSFORMERS_VERSION=4.57.6
ARG TORCH_VERSION=2.8.0
ARG M2M100_REVISION=55c2e61bbf05dfb8d7abccdc3fae6fc8512fd636
ARG EN_TRK_REVISION=f9d8f6cd9d95d2f8ce34943c1f6cfe610d3bbf92
ARG TRK_EN_REVISION=be5007c9e9ab775de82c5d7409ae7d2b330190cc

ENV HF_HUB_DISABLE_TELEMETRY=1 \
    TRANSFORMERS_NO_ADVISORY_WARNINGS=1

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates libgomp1 && \
    rm -rf /var/lib/apt/lists/*

RUN python -m pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu "torch==${TORCH_VERSION}" && \
    python -m pip install --no-cache-dir "ctranslate2==${CT2_VERSION}" "transformers==${TRANSFORMERS_VERSION}" sentencepiece==0.2.1 safetensors==0.6.2

RUN ct2-transformers-converter \
      --model facebook/m2m100_418M \
      --revision "${M2M100_REVISION}" \
      --quantization int8 \
      --copy_files sentencepiece.bpe.model tokenizer_config.json special_tokens_map.json vocab.json generation_config.json \
      --output_dir /models/m2m100 && \
    ct2-transformers-converter \
      --model Helsinki-NLP/opus-mt-en-trk \
      --revision "${EN_TRK_REVISION}" \
      --quantization int8 \
      --copy_files source.spm target.spm tokenizer_config.json vocab.json generation_config.json \
      --output_dir /models/opus-en-trk && \
    ct2-transformers-converter \
      --model Helsinki-NLP/opus-mt-trk-en \
      --revision "${TRK_EN_REVISION}" \
      --quantization int8 \
      --copy_files source.spm target.spm tokenizer_config.json vocab.json generation_config.json \
      --output_dir /models/opus-trk-en && \
    rm -rf /root/.cache/huggingface && \
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
COPY --chown=translator:translator translation_engine.py language_quality.py maritime_glossary.json server.py ./

USER translator
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=3)" || exit 1
CMD ["python", "server.py"]
