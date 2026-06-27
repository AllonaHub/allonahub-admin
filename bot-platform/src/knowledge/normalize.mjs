const stopWords = new Set([
  've',
  'veya',
  'ile',
  'icin',
  'gibi',
  'olan',
  'olarak',
  'bir',
  'bu',
  'su',
  'da',
  'de',
  'mi',
  'mu',
  'ne',
  'nasil',
  'hangi',
  'var',
  'yok',
  'allona',
  'allonahub'
]);

export function normalizeText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(value) {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 2 && !stopWords.has(token));
}
