import crypto from 'crypto';

/**
 * Verifies the LINE webhook request signature using HMAC-SHA256 and constant-time comparison.
 *
 * @param body Raw request body as string or Buffer
 * @param signature Signature header received from LINE (x-line-signature)
 * @param channelSecret Optional channel secret override (defaults to process.env.LINE_CHANNEL_SECRET)
 * @returns boolean True if signature matches, false otherwise
 */
export function verifyLineSignature(
  body: string | Buffer,
  signature: string | null | undefined,
  channelSecret?: string,
): boolean {
  try {
    if (!signature || typeof signature !== 'string') {
      return false;
    }

    const trimmedSignature = signature.trim();
    if (!trimmedSignature) {
      return false;
    }

    const secret = channelSecret ?? process.env.LINE_CHANNEL_SECRET;
    if (!secret) {
      return false;
    }

    // In production, strictly reject default placeholder channel secrets
    if (
      process.env.NODE_ENV === 'production' &&
      (secret.toLowerCase().includes('placeholder') || secret.toLowerCase().includes('example'))
    ) {
      return false;
    }

    const expectedSignature = crypto.createHmac('SHA256', secret).update(body).digest('base64');

    // Hash both signatures with SHA-256 to ensure constant-length (32-byte) comparisons,
    // eliminating any timing leakage based on signature length.
    const expectedHash = crypto.createHash('sha256').update(expectedSignature).digest();
    const actualHash = crypto.createHash('sha256').update(trimmedSignature).digest();

    return crypto.timingSafeEqual(expectedHash, actualHash);
  } catch {
    return false;
  }
}
