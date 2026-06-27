import crypto from 'node:crypto';

export function verifyHmacSignature({ body, secret, signatureHeader }) {
  if (!secret) {
    return { ok: true, reason: 'not_configured' };
  }

  if (!signatureHeader) {
    return { ok: false, reason: 'missing_signature' };
  }

  const expected = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
  const incoming = signatureHeader.trim();
  const expectedBuffer = Buffer.from(expected);
  const incomingBuffer = Buffer.from(incoming);

  if (expectedBuffer.length !== incomingBuffer.length) {
    return { ok: false, reason: 'signature_length_mismatch' };
  }

  return {
    ok: crypto.timingSafeEqual(expectedBuffer, incomingBuffer),
    reason: 'verified'
  };
}
