export function enforceFreeMode(config) {
  const costMode = config.costMode ?? 'free';
  const freeMode = costMode === 'free';

  return {
    ...config,
    costMode,
    ai: freeMode
      ? {
          enabled: false,
          openaiApiKey: '',
          openaiModel: '',
          disabledReason: 'free_mode_no_external_api'
        }
      : config.ai,
    costGuard: {
      freeMode,
      externalApiAllowed: !freeMode,
      estimatedCost: 0,
      currency: 'USD',
      reason: freeMode
        ? 'No paid API, token usage, or external AI call is allowed in free mode.'
        : 'Paid API mode must be explicitly enabled and budgeted.'
    }
  };
}

export function assertNoPaidApi(config) {
  if (config.costMode === 'free' && config.ai?.enabled) {
    throw new Error('paid_api_blocked_in_free_mode');
  }
}
