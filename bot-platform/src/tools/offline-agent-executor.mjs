export async function executeOfflineAgentPlan({ store, conversationId, plan }) {
  const executed = [];
  const queuedForApproval = [];

  for (const action of plan.actions) {
    const record = {
      conversationId,
      agentLevel: plan.agentLevel,
      ...action
    };

    if (action.mode === 'local_record') {
      await store.append('offline-agent-actions', record);
      executed.push(action.actionId);
      continue;
    }

    await store.append('approval-queue', record);
    queuedForApproval.push(action.actionId);
  }

  return {
    executed,
    queuedForApproval,
    executedCount: executed.length,
    queuedForApprovalCount: queuedForApproval.length
  };
}
