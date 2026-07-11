import { createId, nowIso } from '../core/ids.mjs';
import { maskObject } from '../security/redaction.mjs';

export async function listOfflineAgentActions({ store, limit = 200 } = {}) {
  return store.readAll('offline-agent-actions', { limit });
}

export async function listApprovalQueue({ store, limit = 200 } = {}) {
  return store.readAll('approval-queue', { limit });
}

export async function recordApprovalDecision({ store, decision }) {
  const normalized = {
    decisionId: createId('approval_decision'),
    approvalActionId: decision.approvalActionId,
    decision: decision.decision,
    reviewer: decision.reviewer ?? 'local-reviewer',
    note: decision.note ?? '',
    createdAt: nowIso()
  };

  if (!normalized.approvalActionId) {
    const error = new Error('approvalActionId_required');
    error.statusCode = 400;
    throw error;
  }

  if (!['approved', 'rejected', 'needs_info'].includes(normalized.decision)) {
    const error = new Error('invalid_approval_decision');
    error.statusCode = 400;
    throw error;
  }

  return store.append('approval-decisions', maskObject(normalized));
}
