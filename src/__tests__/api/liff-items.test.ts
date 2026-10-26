import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/liff/items/route';
import { DELETE } from '@/app/api/liff/items/[id]/route';
import { alarmsRef, remindersRef, notesRef } from '@/lib/firebase/collections';
import { cancelScheduledTask } from '@/lib/scheduler/cloud-tasks';
import { auth } from '@/lib/firebase/admin';
import { verifyLineIdToken } from '@/lib/line/verify-token';

vi.mock('@/lib/firebase/admin', () => ({
  auth: {
    verifyIdToken: vi.fn(),
  },
  db: {
    collection: vi.fn(),
  },
}));

vi.mock('@/lib/line/verify-token', () => ({
  verifyLineIdToken: vi.fn(),
}));

vi.mock('@/lib/firebase/collections', () => ({
  alarmsRef: vi.fn(),
  remindersRef: vi.fn(),
  notesRef: vi.fn(),
}));

vi.mock('@/lib/scheduler/cloud-tasks', () => ({
  cancelScheduledTask: vi.fn(),
}));

describe('LIFF Items API Routes (S1, S3, S4 Security Hardening)', () => {
  const TEST_USER_ID = 'test-line-user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('GET /api/liff/items', () => {
    it('returns 401 when no credentials are provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/liff/items');
      const response = await GET(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('returns active alarms, pending reminders, and notes when authenticated via LINE Bearer token (S1 & S4)', async () => {
      vi.mocked(verifyLineIdToken).mockResolvedValueOnce({
        lineUserId: TEST_USER_ID,
      });

      const mockAlarms = [{ id: 'a1', time: '08:00', enabled: true }];
      const mockReminders = [{ id: 'r1', message: 'Take pills', status: 'pending' }];
      const mockNotes = [{ id: 'n1', content: 'Doctor visit' }];

      const alarmsQuery = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({
          docs: [{ id: 'a1', data: () => ({ time: '08:00', enabled: true }) }],
        }),
      };
      const remindersQuery = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({
          docs: [{ id: 'r1', data: () => ({ message: 'Take pills', status: 'pending' }) }],
        }),
      };
      const notesQuery = {
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({
          docs: [{ id: 'n1', data: () => ({ content: 'Doctor visit' }) }],
        }),
      };

      vi.mocked(alarmsRef).mockReturnValue(alarmsQuery as any);
      vi.mocked(remindersRef).mockReturnValue(remindersQuery as any);
      vi.mocked(notesRef).mockReturnValue(notesQuery as any);

      const request = new NextRequest('http://localhost:3000/api/liff/items', {
        headers: { authorization: 'Bearer valid-line-id-token' },
      });

      const response = await GET(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        alarms: mockAlarms,
        reminders: mockReminders,
        notes: mockNotes,
      });
      expect(alarmsRef).toHaveBeenCalledWith(TEST_USER_ID);
      expect(remindersRef).toHaveBeenCalledWith(TEST_USER_ID);
      expect(notesRef).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it('returns only alarms when type=alarms and authenticates via Firebase ID token with lineUserId claim (S4)', async () => {
      vi.mocked(verifyLineIdToken).mockResolvedValueOnce(null);
      vi.mocked(auth.verifyIdToken).mockResolvedValue({
        uid: 'firebase-uid-999',
        lineUserId: TEST_USER_ID,
      } as any);

      const alarmsQuery = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({
          docs: [{ id: 'a2', data: () => ({ time: '12:00', enabled: true }) }],
        }),
      };
      vi.mocked(alarmsRef).mockReturnValue(alarmsQuery as any);

      const request = new NextRequest('http://localhost:3000/api/liff/items?type=alarms', {
        headers: { authorization: 'Bearer valid-firebase-token' },
      });

      const response = await GET(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        alarms: [{ id: 'a2', time: '12:00', enabled: true }],
      });
      expect(alarmsRef).toHaveBeenCalledWith(TEST_USER_ID);
      expect(remindersRef).not.toHaveBeenCalled();
      expect(notesRef).not.toHaveBeenCalled();
    });

    it('strictly rejects unverified x-line-userid in production mode (S1)', async () => {
      vi.stubEnv('NODE_ENV', 'production');

      const request = new NextRequest('http://localhost:3000/api/liff/items', {
        headers: { 'x-line-userid': TEST_USER_ID },
      });

      const response = await GET(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ error: 'Unauthorized' });
      expect(alarmsRef).not.toHaveBeenCalled();
    });

    it('strictly rejects mock-user-123 in production mode (S3)', async () => {
      vi.stubEnv('NODE_ENV', 'production');

      const request = new NextRequest('http://localhost:3000/api/liff/items', {
        headers: { 'x-line-userid': 'mock-user-123' },
      });

      const response = await GET(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ error: 'Unauthorized' });
      expect(alarmsRef).not.toHaveBeenCalled();
    });

    it('returns mock data without accessing Firestore in non-production when user is mock-user-123 (S3)', async () => {
      vi.stubEnv('NODE_ENV', 'development');

      const request = new NextRequest('http://localhost:3000/api/liff/items', {
        headers: { 'x-line-userid': 'mock-user-123' },
      });

      const response = await GET(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.alarms).toBeDefined();
      expect(data.reminders).toBeDefined();
      expect(data.notes).toBeDefined();
      expect(alarmsRef).not.toHaveBeenCalled();
      expect(remindersRef).not.toHaveBeenCalled();
      expect(notesRef).not.toHaveBeenCalled();
    });

    it('gracefully falls back to in-memory sort when Firestore returns FAILED_PRECONDITION for missing composite index (R3)', async () => {
      vi.mocked(verifyLineIdToken).mockResolvedValueOnce({
        lineUserId: TEST_USER_ID,
      });

      const failedPreconditionErr = new Error(
        '9 FAILED_PRECONDITION: The query requires an index. You can create it here: https://...',
      );

      const alarmsQuery = {
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            get: vi.fn().mockRejectedValueOnce(failedPreconditionErr),
          }),
          get: vi.fn().mockResolvedValueOnce({
            docs: [
              { id: 'a2', data: () => ({ time: '14:00', enabled: true }) },
              { id: 'a1', data: () => ({ time: '08:00', enabled: true }) },
            ],
          }),
        }),
      };

      vi.mocked(alarmsRef).mockReturnValue(alarmsQuery as any);

      const request = new NextRequest('http://localhost:3000/api/liff/items?type=alarms', {
        headers: { authorization: 'Bearer valid-line-id-token' },
      });

      const response = await GET(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.alarms).toEqual([
        { id: 'a1', time: '08:00', enabled: true },
        { id: 'a2', time: '14:00', enabled: true },
      ]);
    });
  });

  describe('DELETE /api/liff/items/[id]', () => {
    it('returns 401 when no credentials are provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/liff/items/item1?type=alarm', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: 'item1' }) });
      expect(response.status).toBe(401);
    });

    it('returns 400 when item type is invalid or missing', async () => {
      vi.mocked(verifyLineIdToken).mockResolvedValueOnce({ lineUserId: TEST_USER_ID });

      const request = new NextRequest('http://localhost:3000/api/liff/items/item1?type=invalid', {
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-line-token' },
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: 'item1' }) });
      expect(response.status).toBe(400);
    });

    it('returns 404 when item does not exist', async () => {
      vi.mocked(verifyLineIdToken).mockResolvedValueOnce({ lineUserId: TEST_USER_ID });

      const docMock = {
        get: vi.fn().mockResolvedValue({ exists: false }),
      };
      vi.mocked(alarmsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(docMock),
      } as any);

      const request = new NextRequest('http://localhost:3000/api/liff/items/item1?type=alarm', {
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-line-token' },
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: 'item1' }) });
      expect(response.status).toBe(404);
    });

    it('cancels cloud task and permanently deletes note when authenticated via Bearer token', async () => {
      vi.mocked(verifyLineIdToken).mockResolvedValueOnce({ lineUserId: TEST_USER_ID });

      const docMock = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ cloudTaskName: 'tasks/task-note-1' }),
        }),
        delete: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(notesRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(docMock),
      } as any);

      const request = new NextRequest('http://localhost:3000/api/liff/items/n1?type=note', {
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-line-token' },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'n1' }) });
      expect(response.status).toBe(200);
      expect(cancelScheduledTask).toHaveBeenCalledWith('tasks/task-note-1');
      expect(docMock.delete).toHaveBeenCalled();
    });

    it('cancels cloud task and soft-disables alarm (enabled: false)', async () => {
      vi.mocked(verifyLineIdToken).mockResolvedValueOnce({ lineUserId: TEST_USER_ID });

      const docMock = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ cloudTaskName: 'tasks/task-alarm-1' }),
        }),
        update: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(alarmsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(docMock),
      } as any);

      const request = new NextRequest('http://localhost:3000/api/liff/items/a1?type=alarm', {
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-line-token' },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'a1' }) });
      expect(response.status).toBe(200);
      expect(cancelScheduledTask).toHaveBeenCalledWith('tasks/task-alarm-1');
      expect(docMock.update).toHaveBeenCalledWith({ enabled: false });
    });

    it('cancels cloud task and soft-disables reminder (status: done, enabled: false)', async () => {
      vi.mocked(verifyLineIdToken).mockResolvedValueOnce({ lineUserId: TEST_USER_ID });

      const docMock = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ cloudTaskName: 'tasks/task-reminder-1' }),
        }),
        update: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(remindersRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(docMock),
      } as any);

      const request = new NextRequest('http://localhost:3000/api/liff/items/r1?type=reminder', {
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-line-token' },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'r1' }) });
      expect(response.status).toBe(200);
      expect(cancelScheduledTask).toHaveBeenCalledWith('tasks/task-reminder-1');
      expect(docMock.update).toHaveBeenCalledWith({ status: 'done', enabled: false });
    });

    it('strictly rejects mock delete in production mode (S3)', async () => {
      vi.stubEnv('NODE_ENV', 'production');

      const request = new NextRequest(
        'http://localhost:3000/api/liff/items/mock-alarm-1?type=alarm',
        {
          method: 'DELETE',
          headers: { 'x-line-userid': 'mock-user-123' },
        },
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'mock-alarm-1' }),
      });
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ error: 'Unauthorized' });
      expect(alarmsRef).not.toHaveBeenCalled();
    });

    it('deletes mock items and returns 200 for mock-user-123 in non-production (S3)', async () => {
      vi.stubEnv('NODE_ENV', 'development');

      const request = new NextRequest(
        'http://localhost:3000/api/liff/items/mock-alarm-1?type=alarm',
        {
          method: 'DELETE',
          headers: { 'x-line-userid': 'mock-user-123' },
        },
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'mock-alarm-1' }),
      });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ success: true, status: 'deleted' });
      expect(alarmsRef).not.toHaveBeenCalled();
    });

    it('returns 404 when deleting nonexistent mock item for mock-user-123 in non-production (S3)', async () => {
      vi.stubEnv('NODE_ENV', 'development');

      const request = new NextRequest(
        'http://localhost:3000/api/liff/items/non-existent-item?type=alarm',
        {
          method: 'DELETE',
          headers: { 'x-line-userid': 'mock-user-123' },
        },
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'non-existent-item' }),
      });
      expect(response.status).toBe(404);
    });
  });
});
