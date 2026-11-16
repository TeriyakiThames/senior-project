import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getAuthorizedUserId } from '@/lib/liff/auth';
import { auth } from '@/lib/firebase/admin';
import { verifyLineIdToken } from '@/lib/line/verify-token';

vi.mock('@/lib/firebase/admin', () => ({
  auth: {
    verifyIdToken: vi.fn(),
  },
}));

vi.mock('@/lib/line/verify-token', () => ({
  verifyLineIdToken: vi.fn(),
}));

describe('getAuthorizedUserId (Security Hardening)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when Authorization header is missing and mock is disabled in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const request = new NextRequest('http://localhost:3000/api/liff/items');
    const result = await getAuthorizedUserId(request);
    expect(result).toBeNull();
    vi.unstubAllEnvs();
  });

  it('authenticates via valid LINE ID token', async () => {
    vi.mocked(verifyLineIdToken).mockResolvedValueOnce({
      lineUserId: 'U12345678',
      displayName: 'Alice',
    });

    const request = new NextRequest('http://localhost:3000/api/liff/items', {
      headers: { authorization: 'Bearer line-token-123' },
    });

    const result = await getAuthorizedUserId(request);
    expect(result).toBe('U12345678');
    expect(verifyLineIdToken).toHaveBeenCalledWith('line-token-123');
  });

  it('authenticates via Firebase ID token with checkRevoked=true and lineUserId claim', async () => {
    vi.mocked(verifyLineIdToken).mockResolvedValueOnce(null);
    vi.mocked(auth.verifyIdToken).mockResolvedValueOnce({
      uid: 'firebase-uid-1',
      lineUserId: 'U98765432',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/liff/items', {
      headers: { authorization: 'Bearer firebase-jwt-123' },
    });

    const result = await getAuthorizedUserId(request);
    expect(result).toBe('U98765432');
    expect(auth.verifyIdToken).toHaveBeenCalledWith('firebase-jwt-123', true);
  });

  it('rejects Firebase ID token without lineUserId custom claim even if uid is present', async () => {
    vi.mocked(verifyLineIdToken).mockResolvedValueOnce(null);
    vi.mocked(auth.verifyIdToken).mockResolvedValueOnce({
      uid: 'arbitrary-firebase-uid',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/liff/items', {
      headers: { authorization: 'Bearer firebase-jwt-without-claim' },
    });

    const result = await getAuthorizedUserId(request);
    expect(result).toBeNull();
  });

  it('rejects revoked Firebase ID tokens', async () => {
    vi.mocked(verifyLineIdToken).mockResolvedValueOnce(null);
    vi.mocked(auth.verifyIdToken).mockRejectedValueOnce(
      new Error('Firebase token has been revoked'),
    );

    const request = new NextRequest('http://localhost:3000/api/liff/items', {
      headers: { authorization: 'Bearer revoked-jwt' },
    });

    const result = await getAuthorizedUserId(request);
    expect(result).toBeNull();
  });
});
