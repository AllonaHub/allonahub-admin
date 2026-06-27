import { createId, nowIso } from '../core/ids.mjs';

function routeOwner(intent) {
  switch (intent) {
    case 'taxi_support':
      return 'taksi-operasyon';
    case 'mall_guide':
      return 'avm-operasyon';
    case 'social_media':
      return 'sosyal-medya';
    case 'partner_support':
      return 'partner-panel';
    case 'user_account':
      return 'user-panel';
    case 'legal_policy':
      return 'hukuk-politika';
    case 'security':
      return 'guvenlik';
    default:
      return 'destek';
  }
}

export async function createSupportTicket({ store, conversation, message, classification, risk }) {
  const ticket = {
    ticketId: createId('ticket'),
    conversationId: conversation.conversationId,
    channel: conversation.channel,
    status: 'open',
    priority: risk.isCritical ? 'critical' : classification.priority,
    owner: routeOwner(classification.intent),
    intent: classification.intent,
    summary: message.slice(0, 280),
    riskSignals: {
      promptInjection: risk.promptInjection,
      riskyActions: risk.riskyActions,
      criticalPolicyHits: risk.criticalPolicyHits
    },
    user: conversation.user,
    createdAt: nowIso()
  };

  await store.append('support-tickets', ticket);
  return ticket;
}
