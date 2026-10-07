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

    const secret = channelSecret ?? process.env.LINE_CHANNEL_SECRET;
    if (!secret) {
      return false;
    }

    const expectedSignature = crypto.createHmac('SHA256', secret).update(body).digest('base64');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const actualBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}
