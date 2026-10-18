import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/liff/items/route';
import { DELETE } from '@/app/api/liff/items/[id]/route';
import { alarmsRef, remindersRef, notesRef } from '@/lib/firebase/collections';
import { cancelScheduledTask } from '@/lib/scheduler/cloud-tasks';
import { auth } from '@/lib/firebase/admin';

vi.mock('@/lib/firebase/admin', () => ({
  auth: {
    verifyIdToken: vi.fn(),
  },
  db: {
    collection: vi.fn(),
  },
}));

vi.mock('@/lib/firebase/collections', () => ({
  alarmsRef: vi.fn(),
  remindersRef: vi.fn(),
  notesRef: vi.fn(),
}));

vi.mock('@/lib/scheduler/cloud-tasks', () => ({
  cancelScheduledTask: vi.fn(),
}));

describe('LIFF Items API Routes (FE-01)', () => {
  const TEST_USER_ID = 'test-line-user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/liff/items', () => {
    it('returns 401 when no credentials are provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/liff/items');
      const response = await GET(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('returns active alarms, pending reminders, and notes when authenticated via x-line-userid', async () => {
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
        headers: { 'x-line-userid': TEST_USER_ID },
      });

      const response = await GET(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        alarms: mockAlarms,
        reminders: mockReminders,
        notes: mockNotes,
      });
    });

    it('returns only alarms when type=alarms and authenticates via Bearer token', async () => {
      vi.mocked(auth.verifyIdToken).mockResolvedValue({ uid: TEST_USER_ID } as any);

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
      expect(remindersRef).not.toHaveBeenCalled();
      expect(notesRef).not.toHaveBeenCalled();
    });

    it('returns mock data without accessing Firestore when user is mock-user-123', async () => {
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
      const request = new NextRequest('http://localhost:3000/api/liff/items/item1?type=invalid', {
        method: 'DELETE',
        headers: { 'x-line-userid': TEST_USER_ID },
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: 'item1' }) });
      expect(response.status).toBe(400);
    });

    it('returns 404 when item does not exist', async () => {
      const docMock = {
        get: vi.fn().mockResolvedValue({ exists: false }),
      };
      vi.mocked(alarmsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(docMock),
      } as any);

      const request = new NextRequest('http://localhost:3000/api/liff/items/item1?type=alarm', {
        method: 'DELETE',
        headers: { 'x-line-userid': TEST_USER_ID },
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: 'item1' }) });
      expect(response.status).toBe(404);
    });

    it('cancels cloud task and permanently deletes note', async () => {
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
        headers: { 'x-line-userid': TEST_USER_ID },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'n1' }) });
      expect(response.status).toBe(200);
      expect(cancelScheduledTask).toHaveBeenCalledWith('tasks/task-note-1');
      expect(docMock.delete).toHaveBeenCalled();
    });

    it('cancels cloud task and soft-disables alarm (enabled: false)', async () => {
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
        headers: { 'x-line-userid': TEST_USER_ID },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'a1' }) });
      expect(response.status).toBe(200);
      expect(cancelScheduledTask).toHaveBeenCalledWith('tasks/task-alarm-1');
      expect(docMock.update).toHaveBeenCalledWith({ enabled: false });
    });

    it('cancels cloud task and soft-disables reminder (status: done, enabled: false)', async () => {
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
        headers: { 'x-line-userid': TEST_USER_ID },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'r1' }) });
      expect(response.status).toBe(200);
      expect(cancelScheduledTask).toHaveBeenCalledWith('tasks/task-reminder-1');
      expect(docMock.update).toHaveBeenCalledWith({ status: 'done', enabled: false });
    });

    it('deletes mock items and returns 200 for mock-user-123', async () => {
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

    it('returns 404 when deleting nonexistent mock item for mock-user-123', async () => {
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
