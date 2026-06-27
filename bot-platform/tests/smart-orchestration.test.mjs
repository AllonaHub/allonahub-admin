import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBotApp } from '../src/app.mjs';

const fixtureRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixtureSources = new URL('./fixtures/knowledge-sources.json', import.meta.url);

async function appWithTempStorage() {
  return createBotApp({
    storageDir: await fs.mkdtemp(path.join(os.tmpdir(), 'allonahub-smart-test-')),
    knowledgeRootDir: fixtureRoot,
    knowledgeSourcesUrl: fixtureSources
  });
}

test('continues an offer flow and fills customer slots across turns', async () => {
  const app = await appWithTempStorage();

  const first = await app.orchestrator.handleMessage({
    conversationId: 'smart-offer',
    channel: 'test',
    message: 'Teklif almak istiyorum',
    user: { externalUserId: 'customer-1' }
  });

  assert.equal(first.intent, 'offer');
  assert.equal(first.smart.action, 'ask_followup');
  assert.ok(first.smart.missingSlots.includes('name'));
  assert.ok(first.ticket.ticketId);

  const second = await app.orchestrator.handleMessage({
    conversationId: 'smart-offer',
    channel: 'test',
    message: 'Adim Ayse Yilmaz, telefonum 0555 123 45 67',
    user: { externalUserId: 'customer-1' }
  });

  assert.equal(second.intent, 'offer');
  assert.equal(second.ticket.ticketId, first.ticket.ticketId);
  assert.equal(second.smart.customerContext.filledSlots.name, 'Ayse Yilmaz');
  assert.equal(second.smart.action, 'handoff');
  assert.match(second.answer, /Talebi toparladim/);
  assert.equal(second.answer.includes('0555'), false);
});

test('adapts tone for frustrated taxi support and asks for next best slot', async () => {
  const app = await appWithTempStorage();
  const response = await app.orchestrator.handleMessage({
    conversationId: 'smart-taxi',
    channel: 'test',
    message: 'Bu rezalet, taksi odeme sorunum cozulmedi',
    user: { externalUserId: 'customer-2' }
  });

  assert.equal(response.intent, 'taxi_support');
  assert.equal(response.smart.tone, 'frustrated');
  assert.equal(response.smart.nextBestAction, 'collect_tripId');
  assert.match(response.answer, /Yasadiginiz sorunu anladim/);
});

test('returns a guided answer for mall campaign questions', async () => {
  const app = await appWithTempStorage();
  const response = await app.orchestrator.handleMessage({
    conversationId: 'smart-mall',
    channel: 'test',
    message: 'AVM kampanya ve kupon bilgisi lazim',
    user: { externalUserId: 'customer-3' }
  });

  assert.equal(response.intent, 'mall_guide');
  assert.equal(response.smart.action, 'answer');
  assert.equal(response.smart.nextBestAction, 'ask_location_or_store');
  assert.match(response.answer, /sehir, AVM adi veya magaza/);
});
