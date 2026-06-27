import { createId, nowIso } from './ids.mjs';
import { maskObject } from '../security/redaction.mjs';

const ownerPanelMap = {
  'taksi-operasyon': 'admin:taksi-operasyon',
  'avm-operasyon': 'admin:avm-operasyon',
  'sosyal-medya': 'admin:sosyal-medya',
  'partner-panel': 'partner:support',
  'user-panel': 'user:support',
  'hukuk-politika': 'admin:legal',
  guvenlik: 'super-admin:security',
  destek: 'admin:support'
};

const approvalReasons = {
  payment: 'Maddi etkisi olan odeme/iade islemi insan onayi gerektirir.',
  cancellation: 'Iptal islemi kullanici ve operasyon etkisi nedeniyle insan onayi gerektirir.',
  security: 'Guvenlik ve yetki islemleri insan kontrolu gerektirir.',
  legal: 'Hukuk/KVKK konulari uzman onayi gerektirir.',
  publish: 'Sosyal medya veya kamusal yayin insan onayi gerektirir.'
};

function inferApprovalReason({ classification, customerContext, risk }) {
  const issueType = customerContext.slots?.issueType;
  if (risk.hasRiskyAction && issueType === 'payment') return approvalReasons.payment;
  if (risk.hasRiskyAction && issueType === 'cancellation') return approvalReasons.cancellation;
  if (classification.intent === 'security') return approvalReasons.security;
  if (classification.intent === 'legal_policy') return approvalReasons.legal;
  if (classification.intent === 'social_media' && risk.hasRiskyAction) return approvalReasons.publish;
  return risk.hasRiskyAction
    ? 'Riskli veya geri alinmasi zor islem insan onayi gerektirir.'
    : null;
}

function makeAction({ type, mode = 'local_record', status = 'ready', description, payload = {}, priority }) {
  return {
    actionId: createId('act'),
    type,
    mode,
    status,
    priority,
    description,
    payload: maskObject(payload),
    createdAt: nowIso()
  };
}

function buildPanelTask({ ticket, classification, smartPlan, customerContext }) {
  if (!ticket) return null;
  const panelTarget = ownerPanelMap[ticket.owner] ?? 'admin:support';
  return makeAction({
    type: 'prepare_panel_task',
    priority: ticket.priority,
    description: `Panel gorevi hazirlandi: ${panelTarget}`,
    payload: {
      panelTarget,
      ticketId: ticket.ticketId,
      owner: ticket.owner,
      intent: classification.intent,
      nextBestAction: smartPlan.meta?.nextBestAction,
      customerSlots: customerContext.slots
    }
  });
}

function buildApprovalAction({ ticket, classification, risk, customerContext }) {
  const reason = inferApprovalReason({ classification, customerContext, risk });
  if (!reason) return null;
  return makeAction({
    type: 'queue_human_approval',
    mode: 'requires_human_approval',
    status: 'queued',
    priority: ticket?.priority ?? 'high',
    description: reason,
    payload: {
      ticketId: ticket?.ticketId,
      intent: classification.intent,
      issueType: customerContext.slots?.issueType,
      riskSignals: {
        riskyActions: risk.riskyActions,
        criticalPolicyHits: risk.criticalPolicyHits
      }
    }
  });
}

function buildKnowledgeImprovement({ classification, knowledgeResults, message }) {
  if (classification.intent !== 'unknown' && knowledgeResults.length > 0) return null;
  return makeAction({
    type: 'suggest_knowledge_update',
    mode: 'requires_content_review',
    status: 'queued',
    priority: 'medium',
    description: 'Bilgi tabani eksigi icin icerik iyilestirme onerisi olusturuldu.',
    payload: {
      intent: classification.intent,
      unansweredMessage: message
    }
  });
}

export function buildOfflineAgentPlan({
  message,
  classification,
  risk,
  ticket,
  smartPlan,
  customerContext,
  knowledgeResults
}) {
  const actions = [];

  actions.push(
    makeAction({
      type: 'record_customer_context',
      description: 'Musteri baglami yerel hafizada guncellendi.',
      payload: {
        intent: classification.intent,
        urgency: customerContext.urgency,
        sentiment: customerContext.lastSentiment?.tone,
        slots: customerContext.slots
      }
    })
  );

  actions.push(
    makeAction({
      type: 'prepare_customer_reply',
      description: 'Musteriye ton, eksik bilgi ve next-best-action uyumlu cevap hazirlandi.',
      payload: {
        action: smartPlan.action,
        nextBestAction: smartPlan.meta?.nextBestAction,
        missingSlots: smartPlan.missingSlots
      }
    })
  );

  const panelTask = buildPanelTask({ ticket, classification, smartPlan, customerContext });
  if (panelTask) actions.push(panelTask);

  const approvalAction = buildApprovalAction({ ticket, classification, risk, customerContext });
  if (approvalAction) actions.push(approvalAction);

  const knowledgeAction = buildKnowledgeImprovement({
    classification,
    knowledgeResults,
    message
  });
  if (knowledgeAction) actions.push(knowledgeAction);

  const safeActions = actions.filter((action) => action.mode === 'local_record');
  const approvalActions = actions.filter((action) => action.mode !== 'local_record');

  return {
    agentLevel: 'level_5_free_offline',
    autonomy: {
      canPlan: true,
      canUseLocalTools: true,
      canUseExternalApis: false,
      canSpendMoney: false,
      canExecuteRiskyActions: false,
      humanApprovalRequiredForRisk: true
    },
    cost: {
      estimatedCost: 0,
      currency: 'USD',
      tokenUsage: 0,
      externalCalls: 0
    },
    decision: {
      intent: classification.intent,
      nextBestAction: smartPlan.meta?.nextBestAction,
      confidence: classification.confidence,
      tone: smartPlan.meta?.tone,
      approvalRequired: approvalActions.length > 0
    },
    actions,
    safeActionCount: safeActions.length,
    approvalActionCount: approvalActions.length
  };
}
