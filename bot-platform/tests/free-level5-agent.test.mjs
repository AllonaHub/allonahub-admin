import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBotApp } from '../src/app.mjs';
import { buildDailyReport } from '../src/tools/reporting.mjs';
import { recordApprovalDecision } from '../src/tools/approval-workflow.mjs';

const fixtureRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixtureSources = new URL('./fixtures/knowledge-sources.json', import.meta.url);

async function appWithTempStorage(overrides = {}) {
  return createBotApp({
    storageDir: await fs.mkdtemp(path.join(os.tmpdir(), 'allonahub-free-l5-test-')),
    knowledgeRootDir: fixtureRoot,
    knowledgeSourcesUrl: fixtureSources,
    ...overrides
  });
}

test('free mode blocks paid AI even if API settings are present', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error('fetch_should_not_be_called_in_free_mode');
  };

  try {
    const app = await appWithTempStorage({
      costMode: 'free',
      ai: {
        enabled: true,
        openaiApiKey: 'sk-test-should-not-run',
        openaiModel: 'paid-model'
      }
    });

    const response = await app.orchestrator.handleMessage({
      conversationId: 'free-mode',
      channel: 'test',
      message: 'AVM kampanya bilgisi lazim',
      user: { externalUserId: 'free-user' }
    });

    assert.equal(response.ok, true);
    assert.equal(fetchCalled, false);
    assert.equal(response.agent.cost.estimatedCost, 0);
    assert.equal(response.agent.autonomy.canUseExternalApis, false);
    assert.equal(app.config.ai.enabled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('offline level 5 agent creates local actions and approval queue for risky support', async () => {
  const app = await appWithTempStorage();
  const response = await app.orchestrator.handleMessage({
    conversationId: 'offline-agent-risk',
    channel: 'test',
    message: 'Taksi odeme hatasi var, iade yap ve hemen iptal et',
    user: { externalUserId: 'risk-user' }
  });

  assert.equal(response.intent, 'taxi_support');
  assert.equal(response.agent.level, 'level_5_free_offline');
  assert.equal(response.agent.cost.externalCalls, 0);
  assert.equal(response.agent.decision.approvalRequired, true);
  assert.ok(response.agent.execution.queuedForApprovalCount > 0);
  assert.ok(response.agent.actions.some((action) => action.type === 'prepare_panel_task'));
  assert.ok(response.agent.actions.some((action) => action.type === 'queue_human_approval'));

  const approvals = await app.eventStore.readAll('approval-queue');
  assert.ok(approvals.some((approval) => approval.type === 'queue_human_approval'));
});

test('records local approval decisions without executing risky actions', async () => {
  const app = await appWithTempStorage();
  const response = await app.orchestrator.handleMessage({
    conversationId: 'approval-decision',
    channel: 'test',
    message: 'Taksi odeme hatasi var, iade yap',
    user: { externalUserId: 'approval-user' }
  });
  const approval = response.agent.actions.find((action) => action.type === 'queue_human_approval');

  const decision = await recordApprovalDecision({
    store: app.eventStore,
    decision: {
      approvalActionId: approval.actionId,
      decision: 'needs_info',
      reviewer: 'operator',
      note: 'Yolculuk ID bekleniyor'
    }
  });

  assert.equal(decision.approvalActionId, approval.actionId);
  assert.equal(decision.decision, 'needs_info');
  const decisions = await app.eventStore.readAll('approval-decisions');
  assert.equal(decisions.length, 1);
});

test('daily report includes offline agent and zero cost metrics', async () => {
  const app = await appWithTempStorage();
  await app.orchestrator.handleMessage({
    conversationId: 'offline-agent-report',
    channel: 'test',
    message: 'Teklif almak istiyorum',
    user: { externalUserId: 'report-user' }
  });

  const report = await buildDailyReport({ store: app.eventStore });
  assert.ok(report.offlineAgentActionCount > 0);
  assert.equal(report.cost.estimatedCost, 0);
  assert.equal(report.cost.externalCalls, 0);
});
