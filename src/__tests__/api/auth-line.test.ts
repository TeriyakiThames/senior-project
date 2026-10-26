import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/line/route';
import { auth } from '@/lib/firebase/admin';
import { userRef } from '@/lib/firebase/collections';
import { verifyLineIdToken } from '@/lib/line/verify-token';

vi.mock('@/lib/firebase/admin', () => ({
  auth: {
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    createCustomToken: vi.fn(),
  },
  db: {
    collection: vi.fn(),
  },
}));

vi.mock('@/lib/firebase/collections', () => ({
  userRef: vi.fn(),
}));

vi.mock('@/lib/line/verify-token', () => ({
  verifyLineIdToken: vi.fn(),
}));

describe('POST /api/auth/line (SEC-02 / S2 & S4)', () => {
  const TEST_LINE_USER_ID = 'U_SEC_TEST_123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when idToken is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/line', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Missing or invalid idToken');
  });

  it('returns 401 when LINE ID token verification fails', async () => {
    vi.mocked(verifyLineIdToken).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/auth/line', {
      method: 'POST',
      body: JSON.stringify({ idToken: 'invalid-or-spoofed-token' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Invalid or expired LINE ID token');
    expect(verifyLineIdToken).toHaveBeenCalledWith('invalid-or-spoofed-token');
  });

  it('returns custom token for an existing Firebase user identified by LINE user id', async () => {
    vi.mocked(verifyLineIdToken).mockResolvedValue({
      lineUserId: TEST_LINE_USER_ID,
      displayName: 'Existing User',
    });
    vi.mocked(auth.getUser).mockResolvedValue({
      uid: TEST_LINE_USER_ID,
    } as any);
    vi.mocked(auth.createCustomToken).mockResolvedValue('custom-jwt-token-123');

    const updateMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(userRef).mockReturnValue({
      get: vi.fn().mockResolvedValue({ exists: true }),
      update: updateMock,
    } as any);

    const request = new NextRequest('http://localhost:3000/api/auth/line', {
      method: 'POST',
      body: JSON.stringify({ idToken: 'valid-line-token' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ token: 'custom-jwt-token-123' });
    expect(auth.getUser).toHaveBeenCalledWith(TEST_LINE_USER_ID);
    expect(auth.createCustomToken).toHaveBeenCalledWith(TEST_LINE_USER_ID, {
      lineUserId: TEST_LINE_USER_ID,
    });
    expect(updateMock).toHaveBeenCalledWith({ firebaseUid: TEST_LINE_USER_ID });
  });

  it('creates new Firebase user with uid aligned to lineUserId and returns custom token', async () => {
    vi.mocked(verifyLineIdToken).mockResolvedValue({
      lineUserId: TEST_LINE_USER_ID,
      displayName: 'New User',
    });
    vi.mocked(auth.getUser).mockRejectedValue(new Error('User not found'));
    vi.mocked(auth.getUserByEmail).mockRejectedValue(new Error('User not found'));
    vi.mocked(auth.createUser).mockResolvedValue({
      uid: TEST_LINE_USER_ID,
    } as any);
    vi.mocked(auth.createCustomToken).mockResolvedValue('custom-jwt-token-new');

    const updateMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(userRef).mockReturnValue({
      get: vi.fn().mockResolvedValue({ exists: true }),
      update: updateMock,
    } as any);

    const request = new NextRequest('http://localhost:3000/api/auth/line', {
      method: 'POST',
      body: JSON.stringify({ idToken: 'valid-line-token-new' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ token: 'custom-jwt-token-new' });
    expect(auth.createUser).toHaveBeenCalledWith({
      uid: TEST_LINE_USER_ID,
      email: `${TEST_LINE_USER_ID}@line.user`,
      displayName: 'New User',
    });
    expect(auth.createCustomToken).toHaveBeenCalledWith(TEST_LINE_USER_ID, {
      lineUserId: TEST_LINE_USER_ID,
    });
  });

  it('returns 500 when updating user firebaseUid in Firestore fails (R6)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(verifyLineIdToken).mockResolvedValue({
      lineUserId: TEST_LINE_USER_ID,
      displayName: 'Existing User',
    });
    vi.mocked(auth.getUser).mockResolvedValue({
      uid: TEST_LINE_USER_ID,
    } as any);

    vi.mocked(userRef).mockReturnValue({
      get: vi.fn().mockRejectedValue(new Error('Firestore connection reset')),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/auth/line', {
      method: 'POST',
      body: JSON.stringify({ idToken: 'valid-line-token' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal server error');

    consoleErrorSpy.mockRestore();
  });

  it('returns 500 when an unexpected internal error occurs', async () => {
    vi.mocked(verifyLineIdToken).mockRejectedValue(new Error('Unexpected crash'));

    const request = new NextRequest('http://localhost:3000/api/auth/line', {
      method: 'POST',
      body: JSON.stringify({ idToken: 'valid-line-token' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal server error');
  });
});
