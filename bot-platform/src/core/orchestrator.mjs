import fs from 'node:fs/promises';
import { classifyIntent } from './intent.mjs';
import { analyzeRisk } from '../security/risk.mjs';
import { hasSensitiveData, maskSensitiveText } from '../security/redaction.mjs';
import { buildKnowledgeAnswer, searchKnowledgeBase } from '../knowledge/loader.mjs';
import { createSupportTicket } from '../tools/support-ticket.mjs';

const quickRepliesByIntent = {
  greeting: ['Hizmetleri goster', 'Teklif almak istiyorum', 'Destek talebi ac'],
  services: ['Teklif al', 'Iletisim bilgisi birak', 'AVM modulu', 'Taksi modulu'],
  offer: ['Ad soyad ekle', 'Telefon ekle', 'E-posta ekle', 'Insan destegine aktar'],
  taxi_support: ['Yolculuk ID ekle', 'Odeme sorunu', 'Iptal sorunu', 'Acil destek'],
  mall_guide: ['AVM ara', 'Magaza ara', 'Kampanya sor', 'Kupon sor'],
  social_media: ['DM taslagi', 'Yorum siniflandir', 'Paylasim onayi', 'Rapor'],
  legal_policy: ['KVKK', 'Cerez politikasi', 'Insan destegi'],
  security: ['Guvenlik raporu', 'Yetki sorunu', 'Insan destegi'],
  unknown: ['Hizmetleri goster', 'Destek talebi ac', 'Insan destegi']
};

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
    const classification = classifyIntent(message);
    const risk = analyzeRisk(message, this.policy);
    const needsHuman =
      risk.isCritical ||
      risk.hasPromptInjection ||
      (this.policy.handoff?.humanRequiredIntents ?? []).includes(classification.intent);

    let ticket = null;
    if (needsHuman || ['support', 'offer', 'contact'].includes(classification.intent)) {
      ticket = await createSupportTicket({
        store: this.eventStore,
        conversation,
        message,
        classification,
        risk
      });
    }

    const knowledgeResults = searchKnowledgeBase(this.knowledgeBase, message, {
      limit: 4
    });
    const knowledgeAnswer = buildKnowledgeAnswer(knowledgeResults);
    const answer = await this.buildAnswer({
      message,
      classification,
      risk,
      needsHuman,
      ticket,
      knowledgeAnswer,
      knowledgeResults
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
      quickReplies: quickRepliesByIntent[classification.intent] ?? quickRepliesByIntent.unknown,
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
      handoffRequired: response.handoffRequired,
      ticketId: ticket?.ticketId,
      citations: response.citations
    });

    return response;
  }

  async buildAnswer({ message, classification, risk, needsHuman, ticket, knowledgeAnswer, knowledgeResults }) {
    if (risk.hasPromptInjection) {
      return [
        'Bu istekte sistem kurallarini veya gizli bilgileri hedefleyen ifadeler var.',
        'Guvenlik nedeniyle bu talebi otomatik islemiyorum.',
        ticket ? `Destek kaydi acildi: ${ticket.ticketId}` : 'Konuyu insan destegine aktarabilirim.'
      ].join('\n');
    }

    if (risk.hasRiskyAction) {
      return [
        'Bu istek riskli veya onay gerektiren bir islem iceriyor.',
        'Odeme, iade, iptal, rol, veri disari aktarma ve yayin islemleri bot tarafindan otomatik yapilmaz.',
        ticket ? `Insan onayi icin destek kaydi acildi: ${ticket.ticketId}` : 'Insan onayi gerekiyor.'
      ].join('\n');
    }

    if (classification.intent === 'greeting') {
      return 'Merhaba. ALLONAHUB hizmetleri, teklif, taksi destek, AVM rehberi veya hesap destek konularinda yardimci olabilirim.';
    }

    if (classification.intent === 'offer' || classification.intent === 'contact') {
      return [
        'Teklif veya iletisim talebini aldim.',
        'Ad, iletisim kanali, ihtiyac ozeti ve tercih ettiginiz donus zamanini paylasirsaniz temsilciye aktaririm.',
        ticket ? `On kayit acildi: ${ticket.ticketId}` : ''
      ]
        .filter(Boolean)
        .join('\n');
    }

    if (needsHuman && ticket) {
      return [
        knowledgeAnswer.answer,
        '',
        `Bu konu insan kontrolu gerektiriyor. Destek kaydi acildi: ${ticket.ticketId}`,
        `Sorumlu kuyruk: ${ticket.owner}`
      ].join('\n');
    }

    if (this.aiResponder && knowledgeResults.length > 0) {
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

    return knowledgeAnswer.answer;
  }
}
