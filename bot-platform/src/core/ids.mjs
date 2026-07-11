import crypto from 'node:crypto';

export function createId(prefix) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const random = crypto.randomBytes(5).toString('hex');
  return `${prefix}_${stamp}_${random}`;
}

export function nowIso() {
  return new Date().toISOString();
}
