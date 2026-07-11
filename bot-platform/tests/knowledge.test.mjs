import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadKnowledgeBase, searchKnowledgeBase } from '../src/knowledge/loader.mjs';

const fixtureRoot = fileURLToPath(new URL('./fixtures', import.meta.url));
const fixtureSources = new URL('./fixtures/knowledge-sources.json', import.meta.url);

test('loads project markdown knowledge sources', async () => {
  const kb = await loadKnowledgeBase({
    rootDir: fixtureRoot,
    sourcesUrl: fixtureSources
  });
  assert.ok(kb.documents.length > 0);
  assert.ok(kb.sources.length >= 3);
});

test('finds taxi knowledge', async () => {
  const kb = await loadKnowledgeBase({
    rootDir: path.resolve(fixtureRoot),
    sourcesUrl: fixtureSources
  });
  const results = searchKnowledgeBase(kb, 'taksi odeme iptal destek', { limit: 3 });
  assert.ok(results.length > 0);
  assert.ok(results.some((result) => result.domain === 'taxi' || result.sourcePath.includes('Taksi')));
});
