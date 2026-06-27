import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyIntent } from '../src/core/intent.mjs';

test('classifies taxi support messages', () => {
  const result = classifyIntent('Taksi yolculugumda odeme hatasi oldu');
  assert.equal(result.intent, 'taxi_support');
  assert.equal(result.priority, 'high');
  assert.ok(result.confidence > 0);
});

test('classifies mall guide messages', () => {
  const result = classifyIntent('AVM icinde kampanya ve magaza ariyorum');
  assert.equal(result.intent, 'mall_guide');
});

test('returns unknown for unrelated messages', () => {
  const result = classifyIntent('Bugun hava nasil');
  assert.equal(result.intent, 'unknown');
  assert.equal(result.confidence, 0);
});
