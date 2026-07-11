import { maskSensitiveText } from '../security/redaction.mjs';

const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const phoneRegex =
  /(?:\+?90\s*)?(?:0\s*)?(?:5\d{2}|\(\s*5\d{2}\s*\))[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}\b/;
const tripIdRegex =
  /\b(?:yolculuk|trip|ride|rezervasyon|talep)\s*(?:id|no|numarasi|numarası)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{3,})\b/i;

const sentimentLexicon = {
  negative: [
    'kotu',
    'kötü',
    'rezalet',
    'sinir',
    'kizgin',
    'kızgın',
    'magdur',
    'mağdur',
    'sikayet',
    'şikayet',
    'bekliyorum',
    'cozulmedi',
    'çözülmedi',
    'calismiyor',
    'çalışmıyor'
  ],
  urgent: ['acil', 'hemen', 'simdi', 'şimdi', 'kritik', 'guvenlik', 'güvenlik'],
  positive: ['tesekkur', 'teşekkür', 'harika', 'guzel', 'güzel', 'memnun']
};

const channelWords = {
  whatsapp: ['whatsapp', 'wp'],
  phone: ['telefon', 'ara', 'arama'],
  email: ['mail', 'e-posta', 'eposta'],
  telegram: ['telegram']
};

function normalize(value) {
  return String(value ?? '').toLocaleLowerCase('tr-TR');
}

function firstMatch(regex, value) {
  const match = value.match(regex);
  return match?.[0] ?? null;
}

function captureTripId(value) {
  const match = value.match(tripIdRegex);
  return match?.[1] ?? null;
}

function captureName(value) {
  const patterns = [
    /\b(?:adim|adım|ismim|ben)\s+([A-ZÇĞİÖŞÜa-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+){0,2})\b/iu,
    /\b(?:ad soyad|isim)\s*[:=-]\s*([A-ZÇĞİÖŞÜa-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+){0,2})\b/iu
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function detectPreferredChannel(normalized) {
  for (const [channel, words] of Object.entries(channelWords)) {
    if (words.some((word) => normalized.includes(word))) return channel;
  }
  return null;
}

function detectSentiment(normalized) {
  const negativeHits = sentimentLexicon.negative.filter((word) => normalized.includes(word));
  const urgentHits = sentimentLexicon.urgent.filter((word) => normalized.includes(word));
  const positiveHits = sentimentLexicon.positive.filter((word) => normalized.includes(word));

  if (urgentHits.length > 0) return { tone: 'urgent', hits: urgentHits };
  if (negativeHits.length > 0) return { tone: 'frustrated', hits: negativeHits };
  if (positiveHits.length > 0) return { tone: 'positive', hits: positiveHits };
  return { tone: 'neutral', hits: [] };
}

function inferIssueType(normalized, classification) {
  if (normalized.includes('odeme') || normalized.includes('ödeme') || normalized.includes('iade')) {
    return 'payment';
  }
  if (normalized.includes('iptal')) return 'cancellation';
  if (normalized.includes('konum') || normalized.includes('rota')) return 'location';
  if (normalized.includes('kampanya')) return 'campaign';
  if (normalized.includes('kupon')) return 'coupon';
  if (normalized.includes('hesap')) return 'account';
  if (classification.intent === 'offer') return 'quote';
  return classification.intent;
}

function inferNeedSummary(message, classification) {
  const clean = maskSensitiveText(message).replace(/\s+/g, ' ').trim();
  if (clean.length <= 180) return clean;
  return `${clean.slice(0, 177)}...`;
}

export function analyzeCustomerMessage(message, classification) {
  const normalized = normalize(message);
  const sentiment = detectSentiment(normalized);
  const email = firstMatch(emailRegex, message);
  const phone = firstMatch(phoneRegex, message);
  const name = captureName(message);
  const tripId = captureTripId(message);
  const preferredChannel = detectPreferredChannel(normalized);
  const issueType = inferIssueType(normalized, classification);

  return {
    sentiment,
    urgency: sentiment.tone === 'urgent' ? 'critical' : sentiment.tone === 'frustrated' ? 'high' : 'normal',
    slots: {
      name,
      email,
      phone,
      contact: email || phone,
      preferredChannel,
      tripId,
      issueType,
      needSummary: inferNeedSummary(message, classification)
    }
  };
}

export function isLikelySlotContinuation(message) {
  return Boolean(
    firstMatch(emailRegex, message) ||
      firstMatch(phoneRegex, message) ||
      captureTripId(message) ||
      captureName(message) ||
      detectPreferredChannel(normalize(message))
  );
}

function mergeDefined(target, source) {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value !== null && value !== undefined && value !== '') {
      result[key] = value;
    }
  }
  return result;
}

export function mergeCustomerContext(existing = {}, insights, classification) {
  const slots = mergeDefined(existing.slots ?? {}, insights.slots ?? {});
  const intentHistory = [
    ...(existing.intentHistory ?? []),
    {
      intent: classification.intent,
      confidence: classification.confidence,
      at: new Date().toISOString()
    }
  ].slice(-12);

  return {
    ...existing,
    slots,
    lastIntent: classification.intent,
    lastSentiment: insights.sentiment,
    urgency: insights.urgency,
    intentHistory,
    updatedAt: new Date().toISOString()
  };
}

export function publicCustomerContext(context = {}) {
  const slots = context.slots ?? {};
  return {
    lastIntent: context.lastIntent,
    urgency: context.urgency,
    sentiment: context.lastSentiment?.tone ?? 'neutral',
    filledSlots: Object.fromEntries(
      Object.entries(slots)
        .filter(([, value]) => Boolean(value))
        .map(([key, value]) => [key, maskSensitiveText(String(value))])
    )
  };
}
