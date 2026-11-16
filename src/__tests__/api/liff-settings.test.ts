import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT } from '@/app/api/liff/settings/route';
import { getAuthorizedUserId } from '@/lib/liff/auth';
import { userRef } from '@/lib/firebase/collections';
import { isMockAllowed } from '@/lib/utils/env';
import { getMockSettings, resetMockStore } from '@/lib/liff/mock-items';

vi.mock('@/lib/liff/auth', () => ({
  getAuthorizedUserId: vi.fn(),
}));

vi.mock('@/lib/firebase/collections', () => ({
  userRef: vi.fn(),
}));

vi.mock('@/lib/utils/env', () => ({
  isMockAllowed: vi.fn(),
}));

describe('LIFF Settings API Routes (GET & PUT /api/liff/settings)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockStore();
    vi.mocked(isMockAllowed).mockReturnValue(true);
  });

  describe('GET /api/liff/settings', () => {
    it('returns 401 when unauthorized (no token or bad token)', async () => {
      vi.mocked(getAuthorizedUserId).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/liff/settings');
      const res = await GET(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('returns mock settings for mock user when mock is allowed', async () => {
      vi.mocked(getAuthorizedUserId).mockResolvedValue('mock-user-123');

      const req = new NextRequest('http://localhost:3000/api/liff/settings');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.notificationRepeatCap).toBe(3);
    });

    it('returns default repeat cap 3 for real user if document has no settings', async () => {
      vi.mocked(getAuthorizedUserId).mockResolvedValue('U1234567890abcdef');
      const mockDoc = {
        exists: true,
        data: () => ({ displayName: 'คุณตา' }),
      };
      vi.mocked(userRef).mockReturnValue({
        get: vi.fn().mockResolvedValue(mockDoc),
      } as any);

      const req = new NextRequest('http://localhost:3000/api/liff/settings');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.notificationRepeatCap).toBe(3);
    });

    it('returns configured repeat cap for real user', async () => {
      vi.mocked(getAuthorizedUserId).mockResolvedValue('U1234567890abcdef');
      const mockDoc = {
        exists: true,
        data: () => ({
          settings: { notificationRepeatCap: 6 },
        }),
      };
      vi.mocked(userRef).mockReturnValue({
        get: vi.fn().mockResolvedValue(mockDoc),
      } as any);

      const req = new NextRequest('http://localhost:3000/api/liff/settings');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.notificationRepeatCap).toBe(6);
    });
  });

  describe('PUT /api/liff/settings', () => {
    it('returns 401 when unauthorized', async () => {
      vi.mocked(getAuthorizedUserId).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/liff/settings', {
        method: 'PUT',
        body: JSON.stringify({ notificationRepeatCap: 4 }),
      });
      const res = await PUT(req);
      expect(res.status).toBe(401);
    });

    it('returns 400 for non-integer or out-of-range values (< 1 or > 12)', async () => {
      vi.mocked(getAuthorizedUserId).mockResolvedValue('mock-user-123');

      // Test value 0
      let req = new NextRequest('http://localhost:3000/api/liff/settings', {
        method: 'PUT',
        body: JSON.stringify({ notificationRepeatCap: 0 }),
      });
      let res = await PUT(req);
      expect(res.status).toBe(400);

      // Test value 13
      req = new NextRequest('http://localhost:3000/api/liff/settings', {
        method: 'PUT',
        body: JSON.stringify({ notificationRepeatCap: 13 }),
      });
      res = await PUT(req);
      expect(res.status).toBe(400);

      // Test non-integer float
      req = new NextRequest('http://localhost:3000/api/liff/settings', {
        method: 'PUT',
        body: JSON.stringify({ notificationRepeatCap: 3.5 }),
      });
      res = await PUT(req);
      expect(res.status).toBe(400);

      // Test string
      req = new NextRequest('http://localhost:3000/api/liff/settings', {
        method: 'PUT',
        body: JSON.stringify({ notificationRepeatCap: '5' }),
      });
      res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('updates mock settings successfully for mock user', async () => {
      vi.mocked(getAuthorizedUserId).mockResolvedValue('mock-user-123');

      const req = new NextRequest('http://localhost:3000/api/liff/settings', {
        method: 'PUT',
        body: JSON.stringify({ notificationRepeatCap: 8 }),
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ success: true, settings: { notificationRepeatCap: 8 } });
      expect(getMockSettings().notificationRepeatCap).toBe(8);
    });

    it('saves setting to Firestore with merge: true for real user', async () => {
      vi.mocked(getAuthorizedUserId).mockResolvedValue('U1234567890abcdef');
      const mockSet = vi.fn().mockResolvedValue(undefined);
      vi.mocked(userRef).mockReturnValue({
        set: mockSet,
      } as any);

      const req = new NextRequest('http://localhost:3000/api/liff/settings', {
        method: 'PUT',
        body: JSON.stringify({ notificationRepeatCap: 5 }),
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      expect(mockSet).toHaveBeenCalledWith(
        {
          settings: {
            notificationRepeatCap: 5,
          },
        },
        { merge: true },
      );
    });
  });
});
