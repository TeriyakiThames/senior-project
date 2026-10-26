import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleSetReminder,
  handleConfirmReminder,
  handleUpdatePendingReminderTime,
  calculateReminderFireTime,
  REMINDER_FALLBACK_MESSAGE,
  REMINDER_EXPIRED_OR_NOT_FOUND_MESSAGE,
} from '@/lib/tools/reminder';
import * as collections from '@/lib/firebase/collections';
import * as tasks from '@/lib/scheduler/cloud-tasks';
import * as extractor from '@/lib/ai/parameter-extractor';
import type { UserDoc } from '@/types/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { createBangkokDate, getBangkokComponents } from '@/lib/utils/recurrence';
import { createMockUserDoc } from '@/__tests__/mocks';

vi.mock('@/lib/firebase/collections', () => ({
  remindersRef: vi.fn(),
  pendingActionsRef: vi.fn(),
}));

vi.mock('@/lib/scheduler/cloud-tasks', () => ({
  scheduleNotification: vi.fn(),
  saveAndScheduleTask: vi.fn(async ({ collectionRef, data, schedule }) => {
    const docRef = await collectionRef.add(data);
    try {
      const taskName = await tasks.scheduleNotification({
        userId: schedule.userId,
        itemId: docRef.id,
        itemType: schedule.itemType,
        fireAt: schedule.fireAt,
      });
      await docRef.update({ cloudTaskName: taskName });
      return { docRef, taskName };
    } catch (err) {
      if (typeof docRef.delete === 'function') {
        await docRef.delete();
      }
      throw err;
    }
  }),
}));

vi.mock('@/lib/ai/parameter-extractor', () => ({
  extractReminderParams: vi.fn(),
}));

describe('Reminder Tool Handler (SCHED-04, LINE-07)', () => {
  const mockUser: UserDoc = createMockUserDoc({
    lineUserId: 'U_TEST_USER_REMINDER_001',
    displayName: 'คุณยายใจดี',
    firebaseUid: 'firebase-uid-rem-001',
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateReminderFireTime', () => {
    it('returns target time when scheduledAt is in the future', () => {
      const now = createBangkokDate(2026, 10, 16, 8, 0, 0);
      const scheduledAt = createBangkokDate(2026, 10, 16, 14, 0, 0).toISOString();

      const fireAt = calculateReminderFireTime({ scheduledAt, recurrence: 'once' }, now);

      expect(fireAt).not.toBeNull();
      const fireBkk = getBangkokComponents(fireAt!);
      expect(fireBkk.year).toBe(2026);
      expect(fireBkk.month).toBe(10);
      expect(fireBkk.day).toBe(16);
      expect(fireBkk.hours).toBe(14);
      expect(fireBkk.minutes).toBe(0);
    });

    it('shifts target time forward by 24 hours if it falls in the past', () => {
      // Current time is 10:00 Bangkok
      const now = createBangkokDate(2026, 10, 16, 10, 0, 0);
      // Requested time was 08:00 today (already passed)
      const scheduledAt = createBangkokDate(2026, 10, 16, 8, 0, 0).toISOString();

      const fireAt = calculateReminderFireTime({ scheduledAt, recurrence: 'once' }, now);

      expect(fireAt).not.toBeNull();
      const fireBkk = getBangkokComponents(fireAt!);
      expect(fireBkk.year).toBe(2026);
      expect(fireBkk.month).toBe(10);
      expect(fireBkk.day).toBe(17); // Shifted forward by 24 hours to tomorrow
      expect(fireBkk.hours).toBe(8);
      expect(fireBkk.minutes).toBe(0);
    });

    it('defaults to 10 minutes from now if scheduledAt is unspecified', () => {
      const now = createBangkokDate(2026, 10, 16, 9, 15, 0);

      const fireAt = calculateReminderFireTime({ recurrence: 'once' }, now);

      expect(fireAt).not.toBeNull();
      expect(fireAt!.getTime()).toBe(now.getTime() + 10 * 60 * 1000);
      const fireBkk = getBangkokComponents(fireAt!);
      expect(fireBkk.hours).toBe(9);
      expect(fireBkk.minutes).toBe(25);
    });

    it('defaults to 10 minutes from now if scheduledAt is invalid', () => {
      const now = createBangkokDate(2026, 10, 16, 9, 15, 0);

      const fireAt = calculateReminderFireTime(
        { scheduledAt: 'not-a-valid-date', recurrence: 'once' },
        now,
      );

      expect(fireAt).not.toBeNull();
      expect(fireAt!.getTime()).toBe(now.getTime() + 10 * 60 * 1000);
    });

    it('calculates the next upcoming cycle for weekly recurrence when overdue', () => {
      // 2026-10-16 is a Friday (dayOfWeek: 5)
      const now = createBangkokDate(2026, 10, 16, 12, 0, 0);
      // Scheduled for Friday 08:00 (past) every Friday
      const scheduledAt = createBangkokDate(2026, 10, 16, 8, 0, 0).toISOString();

      const fireAt = calculateReminderFireTime(
        { scheduledAt, recurrence: 'weekly', daysOfWeek: [5] },
        now,
      );

      expect(fireAt).not.toBeNull();
      const fireBkk = getBangkokComponents(fireAt!);
      expect(fireBkk.dayOfWeek).toBe(5);
      expect(fireBkk.day).toBe(23); // Next Friday Oct 23, 2026
      expect(fireBkk.hours).toBe(8);
    });
  });

  describe('handleSetReminder (Interactive Pre-Confirmation & Draft)', () => {
    it('creates pending draft in pendingActions and returns Flex confirmation card with datetimepicker', async () => {
      const now = createBangkokDate(2026, 10, 16, 7, 0, 0);
      const mockSet = vi.fn().mockResolvedValue(undefined);
      vi.mocked(collections.pendingActionsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue({ set: mockSet }),
      } as any);

      const scheduledAt = createBangkokDate(2026, 10, 16, 8, 0, 0).toISOString();
      const result = await handleSetReminder('เตือนกินยาตอน 8 โมงเช้า', '', mockUser, {
        now,
        params: {
          message: 'กินยาหลังอาหาร',
          scheduledAt,
          recurrence: 'once',
        },
      });

      expect(result.success).toBe(true);
      expect(result.flexMessage).toBeDefined();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'confirm_reminder',
          data: expect.objectContaining({
            message: 'กินยาหลังอาหาร',
          }),
        }),
      );
      // Reminders collection must NOT be written yet
      expect(collections.remindersRef).not.toHaveBeenCalled();
    });

    it('supports autoConfirm option to immediately schedule and save without pre-confirmation card', async () => {
      const now = createBangkokDate(2026, 10, 16, 7, 0, 0);
      const mockDocId = 'reminder-doc-auto';
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockAdd = vi.fn().mockResolvedValue({
        id: mockDocId,
        update: mockUpdate,
        delete: vi.fn().mockResolvedValue(undefined),
      });

      vi.mocked(collections.remindersRef).mockReturnValue({
        add: mockAdd,
      } as any);
      vi.mocked(tasks.scheduleNotification).mockResolvedValue('task-auto-123');

      const scheduledAt = createBangkokDate(2026, 10, 16, 8, 0, 0).toISOString();
      const result = await handleSetReminder('เตือนกินยาตอน 8 โมงเช้า', '', mockUser, {
        now,
        autoConfirm: true,
        params: {
          message: 'กินยาหลังอาหาร',
          scheduledAt,
          recurrence: 'once',
        },
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('ตั้งเตือน "กินยาหลังอาหาร" เวลา 08:00 น. เรียบร้อยแล้วค่ะ');
      expect(mockAdd).toHaveBeenCalledTimes(1);
      expect(tasks.scheduleNotification).toHaveBeenCalled();
    });

    it('returns polite Thai fallback when parameters cannot be understood', async () => {
      vi.mocked(extractor.extractReminderParams).mockResolvedValue(null);

      const result = await handleSetReminder('ข้อความที่ไม่ชัดเจนเลย', '', mockUser);

      expect(result.success).toBe(false);
      expect(result.message).toBe(REMINDER_FALLBACK_MESSAGE);
      expect(collections.remindersRef).not.toHaveBeenCalled();
      expect(collections.pendingActionsRef).not.toHaveBeenCalled();
    });
  });

  describe('handleConfirmReminder', () => {
    it('commits reminder to Firestore, schedules Cloud Task, and clears pending action', async () => {
      const now = createBangkokDate(2026, 10, 16, 7, 0, 0);
      const mockDocId = 'reminder-doc-123';
      const mockTaskName = 'projects/p/locations/l/queues/q/tasks/reminder-task-999';

      const mockDelete = vi.fn().mockResolvedValue(undefined);
      const mockPendingDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            type: 'confirm_reminder',
            data: {
              message: 'กินยาความดัน',
              scheduledAt: createBangkokDate(2026, 10, 16, 8, 0, 0).toISOString(),
              recurrence: 'once',
            },
            expiresAt: Timestamp.fromDate(new Date(now.getTime() + 3 * 60 * 1000)),
          }),
        }),
        delete: mockDelete,
      };

      vi.mocked(collections.pendingActionsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockPendingDoc),
      } as any);

      const mockAdd = vi.fn().mockResolvedValue({
        id: mockDocId,
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      });

      vi.mocked(collections.remindersRef).mockReturnValue({
        add: mockAdd,
      } as any);

      vi.mocked(tasks.scheduleNotification).mockResolvedValue(mockTaskName);

      const result = await handleConfirmReminder(mockUser, { now });

      expect(result.success).toBe(true);
      expect(result.message).toContain('ตั้งเตือน "กินยาความดัน" เวลา 08:00 น. เรียบร้อยแล้วค่ะ');
      expect(mockAdd).toHaveBeenCalledTimes(1);
      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(tasks.scheduleNotification).toHaveBeenCalled();
    });

    it('returns expired/not-found fallback when pending action does not exist', async () => {
      const mockPendingDoc = {
        get: vi.fn().mockResolvedValue({ exists: false }),
        delete: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(collections.pendingActionsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockPendingDoc),
      } as any);

      const result = await handleConfirmReminder(mockUser);

      expect(result.success).toBe(false);
      expect(result.message).toBe(REMINDER_EXPIRED_OR_NOT_FOUND_MESSAGE);
    });

    it('returns expired fallback when draft is past 5-minute expiry', async () => {
      const now = createBangkokDate(2026, 10, 16, 7, 10, 0);
      const mockDelete = vi.fn().mockResolvedValue(undefined);
      const mockPendingDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            type: 'confirm_reminder',
            data: { message: 'กินยา' },
            expiresAt: Timestamp.fromDate(createBangkokDate(2026, 10, 16, 7, 5, 0)),
          }),
        }),
        delete: mockDelete,
      };

      vi.mocked(collections.pendingActionsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockPendingDoc),
      } as any);

      const result = await handleConfirmReminder(mockUser, { now });

      expect(result.success).toBe(false);
      expect(result.message).toBe(REMINDER_EXPIRED_OR_NOT_FOUND_MESSAGE);
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleUpdatePendingReminderTime', () => {
    it('updates scheduledAt and returns updated Flex confirmation card', async () => {
      const now = createBangkokDate(2026, 10, 16, 7, 0, 0);
      const mockSet = vi.fn().mockResolvedValue(undefined);
      const mockPendingDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            type: 'confirm_reminder',
            data: {
              message: 'กินยาลดไข้',
              scheduledAt: createBangkokDate(2026, 10, 16, 8, 0, 0).toISOString(),
              recurrence: 'once',
            },
            expiresAt: Timestamp.fromDate(new Date(now.getTime() + 4 * 60 * 1000)),
          }),
        }),
        set: mockSet,
      };

      vi.mocked(collections.pendingActionsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockPendingDoc),
      } as any);

      const newDatetimeIso = createBangkokDate(2026, 10, 16, 10, 30, 0).toISOString();
      const result = await handleUpdatePendingReminderTime(mockUser, newDatetimeIso, { now });

      expect(result.success).toBe(true);
      expect(result.flexMessage).toBeDefined();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'confirm_reminder',
          data: expect.objectContaining({
            message: 'กินยาลดไข้',
            scheduledAt: newDatetimeIso,
          }),
        }),
      );
    });

    it('rolls back (deletes) created reminder document if scheduleNotification fails (R4)', async () => {
      const now = createBangkokDate(2026, 10, 16, 7, 0, 0);
      const mockDocId = 'reminder-doc-fail';
      const mockDelete = vi.fn().mockResolvedValue(undefined);
      const mockUpdate = vi.fn();
      const mockAdd = vi.fn().mockResolvedValue({
        id: mockDocId,
        update: mockUpdate,
        delete: mockDelete,
      });

      vi.mocked(collections.remindersRef).mockReturnValue({
        add: mockAdd,
      } as unknown as ReturnType<typeof collections.remindersRef>);

      vi.mocked(tasks.scheduleNotification).mockRejectedValue(
        new Error('Cloud Tasks scheduleTime cannot exceed 30 days in the future'),
      );

      const scheduledAt = createBangkokDate(2026, 10, 16, 8, 0, 0).toISOString();
      const result = await handleSetReminder('เตือนกินยา', '', mockUser, {
        now,
        autoConfirm: true,
        params: {
          message: 'กินยา',
          scheduledAt,
          recurrence: 'once',
        },
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('เกิดข้อผิดพลาดในการตั้งเตือน');
      expect(mockAdd).toHaveBeenCalledTimes(1);
      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
});
