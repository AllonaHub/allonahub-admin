const promptInjectionSignals = [
  'ignore previous',
  'ignore all previous',
  'onceki talimatlari yok say',
  'onceki kurallari yok say',
  'sistem prompt',
  'system prompt',
  'developer message',
  'gizli talimat',
  'tokeni goster',
  'api key',
  'secret key'
];

const riskyActionSignals = [
  'iade yap',
  'odeme al',
  'karttan cek',
  'yolculugu iptal et',
  'kuponu kullan',
  'rol ver',
  'admin yap',
  'verileri indir',
  'hesabi sil',
  'sosyal medyada yayinla'
];

export function analyzeRisk(message, policy = {}) {
  const normalized = String(message ?? '').toLowerCase();
  const promptInjection = promptInjectionSignals.filter((signal) => normalized.includes(signal));
  const riskyActions = riskyActionSignals.filter((signal) => normalized.includes(signal));
  const criticalPolicyHits = (policy.handoff?.criticalKeywords ?? []).filter((signal) =>
    normalized.includes(signal.toLowerCase())
  );

  return {
    promptInjection,
    riskyActions,
    criticalPolicyHits,
    hasPromptInjection: promptInjection.length > 0,
    hasRiskyAction: riskyActions.length > 0,
    isCritical: criticalPolicyHits.length > 0 || riskyActions.length > 0
  };
}
