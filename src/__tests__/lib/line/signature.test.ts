import crypto from 'crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { verifyLineSignature } from '@/lib/line/signature';

describe('verifyLineSignature', () => {
  const originalEnv = process.env;
  const testSecret = 'test_channel_secret_12345';
  const testPayload = JSON.stringify({
    destination: 'U1234567890',
    events: [{ type: 'message', message: { type: 'text', text: 'สวัสดี' } }],
  });

  const createValidSignature = (body: string | Buffer, secret: string) => {
    return crypto.createHmac('SHA256', secret).update(body).digest('base64');
  };

  beforeEach(() => {
    process.env = { ...originalEnv, LINE_CHANNEL_SECRET: testSecret };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns true for a valid signature with string body', () => {
    const validSignature = createValidSignature(testPayload, testSecret);
    const result = verifyLineSignature(testPayload, validSignature);
    expect(result).toBe(true);
  });

  it('returns true for a valid signature with Buffer body', () => {
    const bufferPayload = Buffer.from(testPayload, 'utf-8');
    const validSignature = createValidSignature(bufferPayload, testSecret);
    const result = verifyLineSignature(bufferPayload, validSignature);
    expect(result).toBe(true);
  });

  it('returns false when signature does not match payload', () => {
    const tamperedPayload = testPayload + 'tampered';
    const validSignature = createValidSignature(testPayload, testSecret);
    const result = verifyLineSignature(tamperedPayload, validSignature);
    expect(result).toBe(false);
  });

  it('returns false safely when signature length differs from expected signature', () => {
    const resultShort = verifyLineSignature(testPayload, 'short_sig');
    expect(resultShort).toBe(false);

    const resultLong = verifyLineSignature(testPayload, 'a'.repeat(256));
    expect(resultLong).toBe(false);
  });

  it('returns false safely when signature is missing, null, undefined, or empty', () => {
    expect(verifyLineSignature(testPayload, null)).toBe(false);
    expect(verifyLineSignature(testPayload, undefined)).toBe(false);
    expect(verifyLineSignature(testPayload, '')).toBe(false);
    // @ts-expect-error testing invalid input types
    expect(verifyLineSignature(testPayload, 12345)).toBe(false);
  });

  it('returns false when channel secret is unset in environment and not passed', () => {
    delete process.env.LINE_CHANNEL_SECRET;
    const validSignature = createValidSignature(testPayload, testSecret);
    const result = verifyLineSignature(testPayload, validSignature);
    expect(result).toBe(false);
  });

  it('uses channelSecret parameter override when provided', () => {
    const customSecret = 'custom_override_secret';
    const validSignature = createValidSignature(testPayload, customSecret);

    // Fails with env secret
    expect(verifyLineSignature(testPayload, validSignature)).toBe(false);

    // Passes when custom secret is passed explicitly
    expect(verifyLineSignature(testPayload, validSignature, customSecret)).toBe(true);
  });
});
