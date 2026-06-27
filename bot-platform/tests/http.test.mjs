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
        message: 'Taksi odeme hatasi var, iade yap',
        channel: 'web',
        user: { externalUserId: 'http-user' }
      }
    });
    const payload = chat.json();
    assert.equal(chat.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.intent, 'taxi_support');
    assert.equal(payload.agent.cost.estimatedCost, 0);
    assert.equal(payload.agent.autonomy.canUseExternalApis, false);

    const approvals = await request(app.server, { method: 'GET', url: '/api/agent/approvals' });
    const approvalsPayload = approvals.json();
    assert.equal(approvals.status, 200);
    assert.equal(approvalsPayload.ok, true);
    assert.ok(approvalsPayload.approvals.length > 0);

    const approvalActionId = approvalsPayload.approvals[0].actionId;
    const decision = await request(app.server, {
      method: 'POST',
      url: '/api/agent/approval-decision',
      body: {
        approvalActionId,
        decision: 'needs_info',
        reviewer: 'http-test'
      }
    });
    assert.equal(decision.status, 200);
    assert.equal(decision.json().decision.approvalActionId, approvalActionId);

    const actions = await request(app.server, { method: 'GET', url: '/api/agent/actions' });
    assert.equal(actions.status, 200);
    assert.ok(actions.json().actions.length > 0);
});
