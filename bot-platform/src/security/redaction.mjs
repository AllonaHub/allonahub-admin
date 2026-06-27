const MASK = '[masked]';

const patterns = [
  {
    name: 'email',
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
  },
  {
    name: 'phone',
    regex: /(?:\+?90\s*)?(?:0\s*)?(?:5\d{2}|\(\s*5\d{2}\s*\))[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}\b/g
  },
  {
    name: 'api_key',
    regex: /\b(?:sk|pk|rk|ghp|glpat|xoxb|xoxp)-[A-Za-z0-9_\-]{12,}\b/g
  },
  {
    name: 'card_number',
    regex: /\b(?:\d[ -]*?){13,19}\b/g
  },
  {
    name: 'national_id',
    regex: /\b[1-9]\d{10}\b/g
  },
  {
    name: 'password_hint',
    regex: /\b(?:sifre|parola|password)\s*[:=]\s*\S+/gi
  }
];

export function maskSensitiveText(value) {
  if (typeof value !== 'string') return value;
  return patterns.reduce((text, pattern) => text.replace(pattern.regex, MASK), value);
}

export function maskObject(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return maskSensitiveText(value);
  if (Array.isArray(value)) return value.map(maskObject);
  if (typeof value !== 'object') return value;

  const masked = {};
  for (const [key, raw] of Object.entries(value)) {
    if (/password|token|secret|apiKey|card|authorization/i.test(key)) {
      masked[key] = MASK;
    } else {
      masked[key] = maskObject(raw);
    }
  }
  return masked;
}

export function hasSensitiveData(value) {
  if (typeof value !== 'string') return false;
  return patterns.some((pattern) => {
    pattern.regex.lastIndex = 0;
    return pattern.regex.test(value);
  });
}
