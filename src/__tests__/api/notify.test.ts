import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/notify/route';
import { lineClient } from '@/lib/line/client';
import { alarmsRef, remindersRef } from '@/lib/firebase/collections';
import { scheduleNotification } from '@/lib/scheduler/cloud-tasks';
import { calculateNextOccurrence } from '@/lib/utils/recurrence';
import { Timestamp } from 'firebase-admin/firestore';
import { createMockLineClient } from '@/__tests__/mocks';

vi.mock('@/lib/line/client', async () => {
  const { createMockLineClient } = await import('@/__tests__/mocks');
  return {
    lineClient: createMockLineClient(),
  };
});

vi.mock('@/lib/firebase/collections', () => ({
  alarmsRef: vi.fn(),
  remindersRef: vi.fn(),
}));

vi.mock('@/lib/scheduler/cloud-tasks', () => ({
  scheduleNotification: vi.fn(),
}));

vi.mock('@/lib/utils/recurrence', () => ({
  calculateNextOccurrence: vi.fn(),
}));

describe('POST /api/notify (SCHED-08)', () => {
  const TEST_SECRET = 'test-secret-token-123';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WEBHOOK_SECRET = TEST_SECRET;
  });

  describe('Authentication & Security', () => {
    it('returns 413 when payload exceeds maximum size limit (DoS hardening)', async () => {
      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': '999999',
          'x-webhook-secret': TEST_SECRET,
        },
        body: JSON.stringify({ userId: 'u1', itemId: 'a1', itemType: 'alarm' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data).toEqual({ error: 'Payload too large' });
    });

    it('returns 413 when body length exceeds 32KB even without content-length header (chunked DoS)', async () => {
      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
        },
        body: 'a'.repeat(32 * 1024 + 1),
      });

      const response = await POST(request);
      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data).toEqual({ error: 'Payload too large' });
    });

    it('returns 400 when userId or itemId contains path traversal slashes (Security Hardening)', async () => {
      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
        },
        body: JSON.stringify({ userId: '../../victim', itemId: 'a1', itemType: 'alarm' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({ error: 'Invalid payload' });
    });

    it('returns 401 when x-webhook-secret is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ userId: 'u1', itemId: 'a1', itemType: 'alarm' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('returns 401 when x-webhook-secret does not match', async () => {
      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': 'wrong-secret',
        },
        body: JSON.stringify({ userId: 'u1', itemId: 'a1', itemType: 'alarm' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('accepts valid secret matching rotated secondary secret (S5 secret rotation)', async () => {
      process.env.WEBHOOK_SECRET = 'new-primary-secret, test-secret-token-123';

      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': 'test-secret-token-123',
        },
        body: JSON.stringify({ userId: 'u1', itemId: 'a1', itemType: 'unknown' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid payload');
    });

    it('accepts authorization bearer header with valid secret', async () => {
      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${TEST_SECRET}`,
        },
        body: JSON.stringify({ userId: 'u1', itemId: 'a1', itemType: 'unknown' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid payload');
    });
  });

  describe('Payload Validation', () => {
    it('returns 400 when body is invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
        },
        body: 'invalid-json',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({ error: 'Invalid JSON payload' });
    });

    it('returns 400 when required fields are missing or itemType is invalid', async () => {
      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
        },
        body: JSON.stringify({ userId: 'u1', itemId: 'a1', itemType: 'unknown' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({ error: 'Invalid payload' });
    });
  });

  describe('Alarm Notification Handling', () => {
    it('silently returns 200 when alarm doc does not exist', async () => {
      const mockDoc = {
        get: vi.fn().mockResolvedValue({ exists: false }),
      };
      vi.mocked(alarmsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDoc),
      } as unknown as ReturnType<typeof alarmsRef>);

      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
        },
        body: JSON.stringify({ userId: 'user-1', itemId: 'alarm-1', itemType: 'alarm' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ status: 'skipped', reason: 'not_found' });
      expect(lineClient.pushMessage).not.toHaveBeenCalled();
    });

    it('silently returns 200 when alarm is disabled (enabled: false)', async () => {
      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ enabled: false, label: 'ปลุกเช้า', recurrence: 'once' }),
        }),
      };
      vi.mocked(alarmsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDoc),
      } as unknown as ReturnType<typeof alarmsRef>);

      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
        },
        body: JSON.stringify({ userId: 'user-1', itemId: 'alarm-1', itemType: 'alarm' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ status: 'skipped', reason: 'disabled' });
      expect(lineClient.pushMessage).not.toHaveBeenCalled();
    });

    it('pushes notification card and deactivates one-off alarm', async () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            enabled: true,
            label: 'ปลุกกินยาเช้า',
            recurrence: 'once',
          }),
        }),
        update: mockUpdate,
      };
      vi.mocked(alarmsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDoc),
      } as unknown as ReturnType<typeof alarmsRef>);

      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
        },
        body: JSON.stringify({ userId: 'user-1', itemId: 'alarm-1', itemType: 'alarm' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ status: 'ok' });

      expect(lineClient.pushMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user-1',
          messages: [
            expect.objectContaining({
              type: 'flex',
              altText: expect.stringContaining('ปลุกกินยาเช้า'),
            }),
          ],
        }),
      );

      expect(mockUpdate).toHaveBeenCalledWith({
        enabled: false,
        cloudTaskName: null,
      });
    });

    it('pushes timer notification card and sets repeating 5-minute task until dismissed', async () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            enabled: true,
            durationMinutes: 15,
            label: 'ต้มไข่',
          }),
        }),
        update: mockUpdate,
      };
      vi.mocked(alarmsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDoc),
      } as unknown as ReturnType<typeof alarmsRef>);
      vi.mocked(scheduleNotification).mockResolvedValue('tasks/queue/task-timer-repeat');

      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
        },
        body: JSON.stringify({ userId: 'user-1', itemId: 'timer-1', itemType: 'timer' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ status: 'ok' });

      expect(lineClient.pushMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user-1',
          messages: [
            expect.objectContaining({
              type: 'flex',
              altText: expect.stringContaining('ต้มไข่'),
            }),
          ],
        }),
      );

      expect(scheduleNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          itemId: 'timer-1',
          itemType: 'timer',
        }),
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'fired',
          enabled: true,
          cloudTaskName: 'tasks/queue/task-timer-repeat',
        }),
      );
    });

    it('stops repeating and deactivates timer when max notification repeats is reached', async () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            enabled: true,
            label: 'ต้มไข่',
            durationMinutes: 10,
            repeatCount: 3,
          }),
        }),
        update: mockUpdate,
      };
      vi.mocked(alarmsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDoc),
      } as unknown as ReturnType<typeof alarmsRef>);

      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
        },
        body: JSON.stringify({ userId: 'user-1', itemId: 'timer-1', itemType: 'timer' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ status: 'ok', reason: 'max_repeats_reached' });
      expect(scheduleNotification).not.toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
          status: 'done',
          cloudTaskName: null,
        }),
      );
    });

    it('pushes notification card and reschedules recurring alarm', async () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            enabled: true,
            label: 'ตื่นนอนทุกวัน',
            recurrence: 'daily',
            time: '07:00',
          }),
        }),
        update: mockUpdate,
      };
      vi.mocked(alarmsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDoc),
      } as unknown as ReturnType<typeof alarmsRef>);

      const nextDate = new Date('2026-10-19T00:00:00.000Z');
      vi.mocked(calculateNextOccurrence).mockReturnValue(nextDate);
      vi.mocked(scheduleNotification).mockResolvedValue('tasks/queue/task-next-daily');

      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
        },
        body: JSON.stringify({ userId: 'user-1', itemId: 'alarm-daily', itemType: 'alarm' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(scheduleNotification).toHaveBeenCalledWith({
        userId: 'user-1',
        itemId: 'alarm-daily',
        itemType: 'alarm',
        fireAt: nextDate,
      });
      expect(mockUpdate).toHaveBeenCalledWith({
        nextFireAt: Timestamp.fromDate(nextDate),
        cloudTaskName: 'tasks/queue/task-next-daily',
      });
    });

    it('deactivates recurring alarm if calculateNextOccurrence returns null', async () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            enabled: true,
            label: 'ปลุกตามนัด',
            recurrence: 'daily',
            time: '07:00',
          }),
        }),
        update: mockUpdate,
      };
      vi.mocked(alarmsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDoc),
      } as unknown as ReturnType<typeof alarmsRef>);

      vi.mocked(calculateNextOccurrence).mockReturnValue(null);

      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
        },
        body: JSON.stringify({ userId: 'user-1', itemId: 'alarm-ended', itemType: 'alarm' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(scheduleNotification).not.toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith({
        enabled: false,
        cloudTaskName: null,
      });
    });
  });

  describe('Reminder Notification Handling', () => {
    it('silently returns 200 when reminder doc does not exist', async () => {
      const mockDoc = {
        get: vi.fn().mockResolvedValue({ exists: false }),
      };
      vi.mocked(remindersRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDoc),
      } as unknown as ReturnType<typeof remindersRef>);

      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
        },
        body: JSON.stringify({ userId: 'user-1', itemId: 'rem-1', itemType: 'reminder' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ status: 'skipped', reason: 'not_found' });
      expect(lineClient.pushMessage).not.toHaveBeenCalled();
    });

    it('silently returns 200 when reminder is already done or disabled', async () => {
      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            enabled: true,
            status: 'done',
            message: 'พบแพทย์',
            recurrence: 'once',
          }),
        }),
      };
      vi.mocked(remindersRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDoc),
      } as unknown as ReturnType<typeof remindersRef>);

      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
        },
        body: JSON.stringify({ userId: 'user-1', itemId: 'rem-done', itemType: 'reminder' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ status: 'skipped', reason: 'inactive_or_done' });
      expect(lineClient.pushMessage).not.toHaveBeenCalled();
    });

    it('pushes reminder card and schedules 5-minute auto-repeat for one-off reminder', async () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            enabled: true,
            status: 'pending',
            message: 'ทานยาหลังอาหาร',
            recurrence: 'once',
            scheduledAt: Timestamp.fromDate(new Date('2026-10-18T12:00:00.000Z')),
          }),
        }),
        update: mockUpdate,
      };
      vi.mocked(remindersRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDoc),
      } as unknown as ReturnType<typeof remindersRef>);
      vi.mocked(scheduleNotification).mockResolvedValue('tasks/queue/task-rem-repeat-1');

      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
        },
        body: JSON.stringify({ userId: 'user-1', itemId: 'rem-1', itemType: 'reminder' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(lineClient.pushMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user-1',
          messages: [
            expect.objectContaining({
              type: 'flex',
              altText: expect.stringContaining('ทานยาหลังอาหาร'),
            }),
          ],
        }),
      );
      expect(scheduleNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          itemId: 'rem-1',
          itemType: 'reminder',
          fireAt: expect.any(Date),
        }),
      );
      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'fired',
        enabled: true,
        cloudTaskName: 'tasks/queue/task-rem-repeat-1',
        nextFireAt: expect.any(Object),
        lastHandledNotificationId: null,
        lastHandledAction: null,
        repeatCount: 1,
      });
    });

    it('stops repeating and deactivates reminder when max notification repeats is reached', async () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            enabled: true,
            status: 'fired',
            message: 'ทานยาหลังอาหาร',
            recurrence: 'once',
            repeatCount: 3,
          }),
        }),
        update: mockUpdate,
      };
      vi.mocked(remindersRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDoc),
      } as unknown as ReturnType<typeof remindersRef>);

      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
        },
        body: JSON.stringify({ userId: 'user-1', itemId: 'rem-1', itemType: 'reminder' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ status: 'ok', reason: 'max_repeats_reached' });
      expect(scheduleNotification).not.toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
          status: 'done',
          cloudTaskName: null,
        }),
      );
    });

    it('reschedules 5-minute auto-repeat when fired again (second nagging cycle)', async () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            enabled: true,
            status: 'fired',
            message: 'ทานยาหลังอาหาร',
            recurrence: 'once',
            lastNotificationId: 'tasks/queue/task-first-fire',
            cloudTaskName: 'tasks/queue/task-second-fire',
          }),
        }),
        update: mockUpdate,
      };
      vi.mocked(remindersRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDoc),
      } as unknown as ReturnType<typeof remindersRef>);
      vi.mocked(scheduleNotification).mockResolvedValue('tasks/queue/task-third-fire');

      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
          'x-cloudtasks-taskname': 'tasks/queue/task-second-fire',
        },
        body: JSON.stringify({ userId: 'user-1', itemId: 'rem-1', itemType: 'reminder' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(lineClient.pushMessage).toHaveBeenCalledTimes(1);
      expect(scheduleNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          itemId: 'rem-1',
          itemType: 'reminder',
          fireAt: expect.any(Date),
        }),
      );
      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'fired',
        enabled: true,
        cloudTaskName: 'tasks/queue/task-third-fire',
        nextFireAt: expect.any(Object),
        lastHandledNotificationId: null,
        lastHandledAction: null,
        lastNotificationId: 'tasks/queue/task-second-fire',
        repeatCount: 1,
      });
    });

    it('clears lastHandledNotificationId and lastHandledAction when snoozed reminder fires again', async () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            enabled: true,
            status: 'snoozed',
            message: 'ทานยาหลังอาหาร',
            recurrence: 'once',
            lastNotificationId: 'tasks/queue/task-initial',
            lastHandledNotificationId: 'tasks/queue/task-initial',
            lastHandledAction: 'snooze',
            cloudTaskName: 'tasks/queue/task-snooze-fire',
          }),
        }),
        update: mockUpdate,
      };
      vi.mocked(remindersRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDoc),
      } as unknown as ReturnType<typeof remindersRef>);
      vi.mocked(scheduleNotification).mockResolvedValue('tasks/queue/task-after-snooze-repeat');

      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
          'x-cloudtasks-taskname': 'tasks/queue/task-snooze-fire',
        },
        body: JSON.stringify({ userId: 'user-1', itemId: 'rem-1', itemType: 'reminder' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(lineClient.pushMessage).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'fired',
        enabled: true,
        cloudTaskName: 'tasks/queue/task-after-snooze-repeat',
        nextFireAt: expect.any(Object),
        lastHandledNotificationId: null,
        lastHandledAction: null,
        lastNotificationId: 'tasks/queue/task-snooze-fire',
        repeatCount: 1,
      });
    });

    it('pushes reminder card and reschedules recurring reminder', async () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const scheduledDate = new Date('2026-10-18T12:00:00.000Z');
      const nextDate = new Date('2026-10-19T12:00:00.000Z');

      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            enabled: true,
            status: 'pending',
            message: 'กินยาความดัน',
            recurrence: 'daily',
            scheduledAt: Timestamp.fromDate(scheduledDate),
          }),
        }),
        update: mockUpdate,
      };
      vi.mocked(remindersRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDoc),
      } as unknown as ReturnType<typeof remindersRef>);

      vi.mocked(calculateNextOccurrence).mockReturnValue(nextDate);
      vi.mocked(scheduleNotification).mockResolvedValue('tasks/queue/task-rem-next');

      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
        },
        body: JSON.stringify({ userId: 'user-1', itemId: 'rem-daily', itemType: 'reminder' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(scheduleNotification).toHaveBeenCalledWith({
        userId: 'user-1',
        itemId: 'rem-daily',
        itemType: 'reminder',
        fireAt: nextDate,
      });
      expect(mockUpdate).toHaveBeenCalledWith({
        nextFireAt: Timestamp.fromDate(nextDate),
        cloudTaskName: 'tasks/queue/task-rem-next',
        status: 'pending',
      });
    });

    it('sets reminder to done and disabled when recurring next occurrence returns null', async () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            enabled: true,
            status: 'pending',
            message: 'กินยาวันสุดท้าย',
            recurrence: 'daily',
            scheduledAt: Timestamp.fromDate(new Date('2026-10-18T12:00:00.000Z')),
          }),
        }),
        update: mockUpdate,
      };
      vi.mocked(remindersRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDoc),
      } as unknown as ReturnType<typeof remindersRef>);

      vi.mocked(calculateNextOccurrence).mockReturnValue(null);

      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
        },
        body: JSON.stringify({ userId: 'user-1', itemId: 'rem-daily-done', itemType: 'reminder' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'done',
        enabled: false,
        cloudTaskName: null,
      });
    });
  });

  describe('Error Handling and Cloud Tasks Retries', () => {
    it('returns 500 when LINE pushMessage fails so Cloud Tasks can retry', async () => {
      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            enabled: true,
            label: 'ปลุกเช้า',
            recurrence: 'once',
          }),
        }),
        update: vi.fn(),
      };
      vi.mocked(alarmsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDoc),
      } as unknown as ReturnType<typeof alarmsRef>);

      vi.mocked(lineClient.pushMessage).mockRejectedValue(new Error('LINE API connection timeout'));

      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
        },
        body: JSON.stringify({ userId: 'user-1', itemId: 'alarm-1', itemType: 'alarm' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({ error: 'Internal server error' });
    });

    it('does not send LINE push and returns 500 if scheduling next occurrence fails (R1)', async () => {
      const mockUpdate = vi.fn();
      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            enabled: true,
            label: 'ปลุกเช้าประจำ',
            recurrence: 'daily',
            time: '07:00',
          }),
        }),
        update: mockUpdate,
      };
      vi.mocked(alarmsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDoc),
      } as unknown as ReturnType<typeof alarmsRef>);

      vi.mocked(calculateNextOccurrence).mockReturnValue(new Date('2026-10-27T00:00:00.000Z'));
      vi.mocked(scheduleNotification).mockRejectedValue(new Error('Cloud Tasks quota exceeded'));

      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
        },
        body: JSON.stringify({ userId: 'user-1', itemId: 'alarm-recurring', itemType: 'alarm' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
      expect(lineClient.pushMessage).not.toHaveBeenCalled();
    });

    it('skips duplicate push notification when matching idempotency key was already delivered (R1)', async () => {
      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            enabled: true,
            label: 'ปลุกเช้า',
            recurrence: 'once',
            lastNotificationId: 'task-cloud-tasks-duplicate-1',
          }),
        }),
        update: vi.fn(),
      };
      vi.mocked(alarmsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDoc),
      } as unknown as ReturnType<typeof alarmsRef>);

      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
          'x-cloudtasks-taskname': 'task-cloud-tasks-duplicate-1',
        },
        body: JSON.stringify({ userId: 'user-1', itemId: 'alarm-1', itemType: 'alarm' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ status: 'skipped', reason: 'already_notified' });
      expect(lineClient.pushMessage).not.toHaveBeenCalled();
    });

    it('ignores idempotencyKey with invalid characters or excessive length to prevent parameter injection', async () => {
      vi.mocked(lineClient.pushMessage).mockResolvedValue({} as any);
      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            enabled: true,
            status: 'pending',
            label: 'ปลุกเช้า',
            recurrence: 'once',
          }),
        }),
        update: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(alarmsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDoc),
      } as unknown as ReturnType<typeof alarmsRef>);

      const request = new NextRequest('http://localhost:3000/api/notify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': TEST_SECRET,
          'x-idempotency-key': 'malicious&action=hacked\r\n',
        },
        body: JSON.stringify({ userId: 'user-1', itemId: 'alarm-1', itemType: 'alarm' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(mockDoc.update).toHaveBeenCalledWith({
        enabled: false,
        cloudTaskName: null,
      });
      expect(mockDoc.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ lastNotificationId: 'malicious&action=hacked\r\n' }),
      );
    });
  });
});
