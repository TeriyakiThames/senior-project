import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyLineIdToken } from '@/lib/line/verify-token';

describe('verifyLineIdToken (SEC-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns null when idToken is empty, whitespace, or invalid', async () => {
    expect(await verifyLineIdToken('')).toBeNull();
    expect(await verifyLineIdToken('   ')).toBeNull();
    expect(await verifyLineIdToken(null as unknown as string)).toBeNull();
  });

  it('verifies a valid LINE ID token against LINE OAuth2 endpoint', async () => {
    vi.stubEnv('LINE_LOGIN_CHANNEL_ID', '1234567890');

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        iss: 'https://access.line.me',
        sub: 'U_TEST_LINE_USER_123',
        aud: '1234567890',
        exp: 1700000000,
        name: 'Somchai Grandfather',
        picture: 'https://example.com/avatar.jpg',
        email: 'somchai@example.com',
      }),
    } as Response);

    const result = await verifyLineIdToken('valid-jwt-token-string');

    expect(result).toEqual({
      lineUserId: 'U_TEST_LINE_USER_123',
      displayName: 'Somchai Grandfather',
      picture: 'https://example.com/avatar.jpg',
      email: 'somchai@example.com',
    });

    expect(fetchMock).toHaveBeenCalledWith('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'id_token=valid-jwt-token-string&client_id=1234567890',
    });
  });

  it('falls back to channel id extracted from NEXT_PUBLIC_LIFF_ID prefix', async () => {
    vi.stubEnv('LINE_LOGIN_CHANNEL_ID', '');
    vi.stubEnv('NEXT_PUBLIC_LIFF_ID', '9876543210-abcdefgh');

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sub: 'U_USER_FROM_LIFF_PREFIX',
      }),
    } as Response);

    const result = await verifyLineIdToken('token-with-liff-prefix');
    expect(result?.lineUserId).toBe('U_USER_FROM_LIFF_PREFIX');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.line.me/oauth2/v2.1/verify',
      expect.objectContaining({
        body: expect.stringContaining('client_id=9876543210'),
      }),
    );
  });

  it('returns null if LINE verify endpoint returns 400 Bad Request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'invalid_request',
        error_description: 'IdToken expired',
      }),
    } as Response);

    const result = await verifyLineIdToken('expired-token');
    expect(result).toBeNull();
  });

  it('returns null if response JSON is missing sub field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: 'Invalid Payload Without Sub',
      }),
    } as Response);

    const result = await verifyLineIdToken('missing-sub-token');
    expect(result).toBeNull();
  });

  it('returns null if network fetch throws an error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const result = await verifyLineIdToken('network-error-token');
    expect(result).toBeNull();
  });

  it('supports simulated mock-token in non-production mode', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    const result = await verifyLineIdToken('mock-token-test-user');
    expect(result).toEqual({
      lineUserId: 'mock-user-test-user',
      displayName: 'Mock User test-user',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects mock-token simulated shortcut in production mode', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
    } as Response);

    const result = await verifyLineIdToken('mock-token-test-user');
    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalled();
  });
});
