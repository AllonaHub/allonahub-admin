import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createBotApp } from '../src/app.mjs';

const fixtureRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixtureSources = new URL('./fixtures/knowledge-sources.json', import.meta.url);

async function tempStorage() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'allonahub-bot-http-test-'));
}

function request(server, { method = 'GET', url = '/', body, headers = {} }) {
  return new Promise((resolve) => {
    const raw = body ? JSON.stringify(body) : '';
    const req = Readable.from(raw ? [Buffer.from(raw)] : []);
    req.method = method;
    req.url = url;
    req.headers = {
      host: 'localhost',
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers
    };
    req.socket = { remoteAddress: '127.0.0.1' };

    const chunks = [];
    const res = {
      statusCode: 200,
      headers: {},
      writeHead(statusCode, responseHeaders) {
        this.statusCode = statusCode;
        this.headers = responseHeaders;
      },
      write(chunk) {
        chunks.push(Buffer.from(chunk));
      },
      end(chunk) {
        if (chunk) chunks.push(Buffer.from(chunk));
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({
          status: this.statusCode,
          headers: this.headers,
          text,
          json: () => JSON.parse(text)
        });
      }
    };

    server.emit('request', req, res);
  });
}

test('serves health and chat endpoints', async () => {
  const app = await createBotApp({
    storageDir: await tempStorage(),
    knowledgeRootDir: fixtureRoot,
    knowledgeSourcesUrl: fixtureSources
  });

  const health = await request(app.server, { method: 'GET', url: '/health' });
  assert.equal(health.status, 200);
  assert.equal(health.json().ok, true);

  const chat = await request(app.server, {
    method: 'POST',
    url: '/api/chat',
    body: {
      conversationId: 'http-test',
      message: 'AVM kampanya bilgisi lazim',
      channel: 'web',
      user: { externalUserId: 'http-user' }
    }
  });
  const payload = chat.json();
  assert.equal(chat.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.intent, 'mall_guide');
});
