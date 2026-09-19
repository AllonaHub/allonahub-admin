import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";


const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");


test("local translator stays on an internal Docker network with no host port", () => {
  for (const composePath of [
    "deploy/compose/docker-compose.coolify-hetzner.yml",
    "deploy/compose/docker-compose.hetzner-traefik.yml",
    "deploy/compose/docker-compose.prod.yml"
  ]) {
    const compose = read(composePath);
    const translatorBlock = compose.split("\n  marsoh-translator:\n")[1].split("\nnetworks:")[0];
    assert.match(translatorBlock, /expose:\s*\n\s*- "8080"/);
    assert.doesNotMatch(translatorBlock, /\n\s+ports:/);
    assert.match(compose, /marsoh-internal:\s*\n\s+internal: true/);
  }
});

test("translation route authorizes published visibility before calling local inference", () => {
  const route = read("backend/src/routes/marsoh.js");
  const start = route.indexOf('app.post("/v1/maritime/marsoh/messages/:messageId/translate"');
  const end = route.indexOf('app.post("/v1/maritime/marsoh/messages/:messageId/reactions"', start);
  const handler = route.slice(start, end);
  assert.ok(handler.indexOf("visiblePublished(ctx, messageId)") < handler.indexOf("translateMarsohTextDetailed"));
  assert.match(handler, /marsoh_translation_cache/);
  assert.match(handler, /MARSOH_TRANSLATION_RATE_LIMITED/);
});

test("local model revisions and offline runtime are pinned", () => {
  const dockerfile = read("backend/local-translator/Dockerfile");
  assert.match(dockerfile, /M2M100_REVISION=55c2e61bbf05dfb8d7abccdc3fae6fc8512fd636/);
  assert.match(dockerfile, /EN_KY_REVISION=ccc530699de3ac70a9025dbab7e3a28f0a0d7fbf/);
  assert.match(dockerfile, /KY_EN_REVISION=b58e6ac487460ea01f333dd9bb9150c7fd2ec57b/);
  const preparation = read("backend/local-translator/prepare_models.py");
  assert.match(preparation, /tokenizer_config\["src_lang"\] = "en"/);
  assert.match(preparation, /allow_patterns=MODEL_FILES/);
  assert.match(dockerfile, /HF_HUB_OFFLINE=1/);
  assert.match(dockerfile, /TRANSFORMERS_OFFLINE=1/);
});
