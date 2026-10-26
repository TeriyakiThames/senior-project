import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isValidWebhookSecret } from '@/lib/scheduler/webhook-auth';

describe('isValidWebhookSecret (S5 Security Hardening)', () => {
  const originalEnv = process.env.WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.WEBHOOK_SECRET = originalEnv;
  });

  it('returns false when client secret is missing, empty, or not a string', () => {
    vi.stubEnv('WEBHOOK_SECRET', 'my-secret-123');
    expect(isValidWebhookSecret('')).toBe(false);
    expect(isValidWebhookSecret(null)).toBe(false);
    expect(isValidWebhookSecret(undefined)).toBe(false);
  });

  it('returns false when WEBHOOK_SECRET is not configured', () => {
    vi.stubEnv('WEBHOOK_SECRET', '');
    expect(isValidWebhookSecret('some-secret')).toBe(false);
  });

  it('returns true when secret matches configured single secret', () => {
    vi.stubEnv('WEBHOOK_SECRET', 'test-valid-secret');
    expect(isValidWebhookSecret('test-valid-secret')).toBe(true);
    expect(isValidWebhookSecret('wrong-secret')).toBe(false);
  });

  it('supports comma-separated secret rotation and matches any active secret', () => {
    vi.stubEnv('WEBHOOK_SECRET', 'new-secret-v2, old-secret-v1, fallback-secret-v0');

    expect(isValidWebhookSecret('new-secret-v2')).toBe(true);
    expect(isValidWebhookSecret('old-secret-v1')).toBe(true);
    expect(isValidWebhookSecret('fallback-secret-v0')).toBe(true);
    expect(isValidWebhookSecret('expired-secret')).toBe(false);
  });

  it('safely handles length mismatches without throwing in constant time', () => {
    vi.stubEnv('WEBHOOK_SECRET', 'short');
    expect(isValidWebhookSecret('very-long-attacker-input-string-attempting-timing-attack')).toBe(
      false,
    );
  });
});
