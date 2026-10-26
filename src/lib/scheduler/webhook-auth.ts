import crypto from 'crypto';

/**
 * Validates the incoming webhook secret in constant time against active secrets.
 * Supports comma-separated secret rotation in WEBHOOK_SECRET (S5).
 *
 * @param clientSecret The secret supplied in X-Webhook-Secret header or Bearer authorization
 * @returns boolean indicating whether the secret matches any active configured secret
 */
export function isValidWebhookSecret(clientSecret?: string | null): boolean {
  if (!clientSecret || typeof clientSecret !== 'string') {
    return false;
  }

  const configuredSecrets = (process.env.WEBHOOK_SECRET || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (configuredSecrets.length === 0) {
    return false;
  }

  const clientBuf = Buffer.from(clientSecret);

  for (const configured of configuredSecrets) {
    const configuredBuf = Buffer.from(configured);
    if (
      clientBuf.length === configuredBuf.length &&
      crypto.timingSafeEqual(clientBuf, configuredBuf)
    ) {
      return true;
    }
  }

  return false;
}
