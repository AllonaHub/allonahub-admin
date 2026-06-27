import fs from 'node:fs/promises';
import { classifyIntent } from './intent.mjs';
import {
  analyzeCustomerMessage,
  isLikelySlotContinuation,
  mergeCustomerContext,
  publicCustomerContext
} from './customer-insights.mjs';
import { buildSmartResponsePlan } from './response-planner.mjs';
import { analyzeRisk } from '../security/risk.mjs';
import { hasSensitiveData, maskSensitiveText } from '../security/redaction.mjs';
import { buildKnowledgeAnswer, searchKnowledgeBase } from '../knowledge/loader.mjs';
import { createSupportTicket } from '../tools/support-ticket.mjs';

export class BotOrchestrator {
  constructor({ knowledgeBase, conversationStore, eventStore, policy, aiResponder, systemPromptPath }) {
    this.knowledgeBase = knowledgeBase;
    this.conversationStore = conversationStore;
    this.eventStore = eventStore;
    this.policy = policy;
    this.aiResponder = aiResponder;
    this.systemPromptPath = systemPromptPath;
  }

  async handleMessage(input) {
    const message = String(input.message ?? '').trim();
    if (!message) {
      return {
        ok: false,
        error: 'message_required',
        answer: 'Mesaj bos geldi. Lutfen sorunuzu veya talebinizi yazin.'
      };
    }

    const conversation = await this.conversationStore.touch(input);
    let classification = classifyIntent(message);
    const continuationIntents = new Set([
      'offer',
      'contact',
      'taxi_support',
      'partner_support',
      'user_account',
      'mall_guide',
      'social_media'
    ]);
    const previousIntent = conversation.smartContext?.lastIntent;
    const shouldContinuePreviousIntent =
      previousIntent &&
      continuationIntents.has(previousIntent) &&
      isLikelySlotContinuation(message) &&
      (classification.intent === 'unknown' ||
        (classification.intent === 'contact' && ['offer', 'partner_support', 'user_account'].includes(previousIntent)));

    if (shouldContinuePreviousIntent) {
      classification = {
        ...classification,
        intent: previousIntent,
        priority: classification.priority === 'low' ? 'medium' : classification.priority,
        confidence: Math.max(classification.confidence, 0.45),
        continuedFromContext: true
      };
    }
    const insights = analyzeCustomerMessage(message, classification);
    conversation.smartContext = mergeCustomerContext(
      conversation.smartContext,
      insights,
      classification
    );
    const risk = analyzeRisk(message, this.policy);
    const needsHuman =
      risk.isCritical ||
      risk.hasPromptInjection ||
      (this.policy.handoff?.humanRequiredIntents ?? []).includes(classification.intent);

    let ticket = conversation.activeTicket ?? null;
    if (needsHuman || ['support', 'offer', 'contact'].includes(classification.intent)) {
      if (!ticket) {
        ticket = await createSupportTicket({
          store: this.eventStore,
          conversation,
          message,
          classification,
          risk,
          customerContext: conversation.smartContext
        });
        conversation.activeTicket = ticket;
      }
    }

    const knowledgeResults = searchKnowledgeBase(this.knowledgeBase, message, {
      limit: 4
    });
    const knowledgeAnswer = buildKnowledgeAnswer(knowledgeResults);
    const smartPlan = buildSmartResponsePlan({
      message,
      classification,
      risk,
      needsHuman,
      ticket,
      knowledgeAnswer,
      knowledgeResults,
      customerContext: conversation.smartContext,
      insights
    });
    const answer = await this.buildAnswer({
      message,
      classification,
      risk,
      needsHuman,
      ticket,
      knowledgeAnswer,
      knowledgeResults,
      smartPlan
    });

    const response = {
      ok: true,
      conversationId: conversation.conversationId,
      channel: conversation.channel,
      intent: classification.intent,
      confidence: classification.confidence,
      priority: ticket?.priority ?? classification.priority,
      handoffRequired: Boolean(ticket),
      ticket,
      answer,
      citations: knowledgeAnswer.citations,
      quickReplies: smartPlan.quickReplies,
      smart: {
        action: smartPlan.action,
        missingSlots: smartPlan.missingSlots,
        nextBestAction: smartPlan.meta?.nextBestAction,
        tone: smartPlan.meta?.tone,
        customerContext: publicCustomerContext(conversation.smartContext)
      },
      safety: {
        promptInjectionDetected: risk.hasPromptInjection,
        riskyActionDetected: risk.hasRiskyAction,
        sensitiveDataDetected: hasSensitiveData(message)
      }
    };

    await this.conversationStore.addTurn(conversation.conversationId, {
      type: 'bot_turn',
      userMessage: maskSensitiveText(message),
      botAnswer: answer,
      classification,
      smart: response.smart,
      handoffRequired: response.handoffRequired,
      ticketId: ticket?.ticketId,
      citations: response.citations
    });

    return response;
  }

  async buildAnswer({
    message,
    classification,
    risk,
    ticket,
    knowledgeAnswer,
    knowledgeResults,
    smartPlan
  }) {
    if (risk.hasPromptInjection) {
      return smartPlan.answer;
    }

    if (risk.hasRiskyAction) {
      return smartPlan.answer;
    }

    if (this.aiResponder && smartPlan.allowAiEnhancement && knowledgeResults.length > 0) {
      try {
        const systemPrompt = await fs.readFile(this.systemPromptPath, 'utf8');
        const context = knowledgeResults
          .map((result) => `${result.title} (${result.sourcePath})\n${result.snippet}`)
          .join('\n\n');
        const aiAnswer = await this.aiResponder.generate({
          systemPrompt,
          userMessage: message,
          knowledgeContext: context
        });
        if (aiAnswer) return aiAnswer;
      } catch (error) {
        await this.eventStore.append('bot-errors', {
          type: 'ai_generation_failed',
          message: error.message
        });
      }
    }

    return smartPlan.answer ?? knowledgeAnswer.answer;
  }
}
