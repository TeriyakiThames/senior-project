import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/line/route';
import { auth } from '@/lib/firebase/admin';
import { userRef } from '@/lib/firebase/collections';

vi.mock('@/lib/firebase/admin', () => ({
  auth: {
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

describe('POST /api/auth/line (FE-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when lineUserId is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/line', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('returns custom token for an existing Firebase user', async () => {
    vi.mocked(auth.getUserByEmail).mockResolvedValue({
      uid: 'firebase-uid-existing',
    } as any);
    vi.mocked(auth.createCustomToken).mockResolvedValue('custom-jwt-token-123');

    const updateMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(userRef).mockReturnValue({
      get: vi.fn().mockResolvedValue({ exists: true }),
      update: updateMock,
    } as any);

    const request = new NextRequest('http://localhost:3000/api/auth/line', {
      method: 'POST',
      body: JSON.stringify({ lineUserId: 'line-user-123' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ token: 'custom-jwt-token-123' });
    expect(auth.getUserByEmail).toHaveBeenCalledWith('line-user-123@line.user');
    expect(updateMock).toHaveBeenCalledWith({ firebaseUid: 'firebase-uid-existing' });
  });

  it('creates new Firebase user and returns custom token when user does not exist', async () => {
    vi.mocked(auth.getUserByEmail).mockRejectedValue(new Error('User not found'));
    vi.mocked(auth.createUser).mockResolvedValue({
      uid: 'firebase-uid-new',
    } as any);
    vi.mocked(auth.createCustomToken).mockResolvedValue('custom-jwt-token-new');

    const updateMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(userRef).mockReturnValue({
      get: vi.fn().mockResolvedValue({ exists: true }),
      update: updateMock,
    } as any);

    const request = new NextRequest('http://localhost:3000/api/auth/line', {
      method: 'POST',
      body: JSON.stringify({ lineUserId: 'line-user-new' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ token: 'custom-jwt-token-new' });
    expect(auth.createUser).toHaveBeenCalledWith({
      email: 'line-user-new@line.user',
      displayName: 'line-user-new',
    });
  });
});
