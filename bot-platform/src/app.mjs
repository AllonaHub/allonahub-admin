import path from 'node:path';
import { loadConfig } from './config.mjs';
import { loadKnowledgeBase } from './knowledge/loader.mjs';
import { JsonlStore } from './storage/jsonl-store.mjs';
import { ConversationStore } from './storage/conversation-store.mjs';
import { BotOrchestrator } from './core/orchestrator.mjs';
import { InMemoryRateLimiter } from './security/rate-limit.mjs';
import { createOpenAIResponder } from './ai/openai-responses.mjs';
import { buildDailyReport } from './tools/reporting.mjs';
import { createHttpServer } from './http/server.mjs';
import fs from 'node:fs/promises';

export async function createBotApp(overrides = {}) {
  const config = loadConfig(overrides);
  const policy = JSON.parse(
    await fs.readFile(new URL('../config/policies.json', import.meta.url), 'utf8')
  );
  const knowledgeBase =
    overrides.knowledgeBase ??
    (await loadKnowledgeBase({
      rootDir: overrides.knowledgeRootDir ?? config.repoRoot,
      sourcesUrl: overrides.knowledgeSourcesUrl
    }));
  const eventStore = new JsonlStore({
    storageDir: config.storageDir,
    maskLogs: policy.privacy?.maskInLogs !== false
  });
  const conversationStore = new ConversationStore({ eventStore });
  const aiResponder = createOpenAIResponder(config.ai);
  const orchestrator = new BotOrchestrator({
    knowledgeBase,
    conversationStore,
    eventStore,
    policy,
    aiResponder,
    systemPromptPath: path.join(config.packageRoot, 'prompts', 'system.md')
  });
  const rateLimiter = new InMemoryRateLimiter(config.rateLimit);

  return {
    config,
    policy,
    knowledgeBase,
    eventStore,
    conversationStore,
    orchestrator,
    rateLimiter,
    server: createHttpServer({
      config,
      orchestrator,
      rateLimiter,
      reportBuilder: () => buildDailyReport({ store: eventStore })
    })
  };
}
