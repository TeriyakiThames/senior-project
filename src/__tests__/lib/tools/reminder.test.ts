import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleSetReminder,
  calculateReminderFireTime,
  REMINDER_FALLBACK_MESSAGE,
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

describe('Reminder Tool Handler (SCHED-04)', () => {
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

  describe('handleSetReminder', () => {
    it('creates ReminderDoc with status pending, enabled true, schedules task, and links cloudTaskName', async () => {
      const now = createBangkokDate(2026, 10, 16, 7, 0, 0);
      const mockDocId = 'reminder-doc-123';
      const mockTaskName = 'projects/p/locations/l/queues/q/tasks/reminder-task-999';

      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockDelete = vi.fn().mockResolvedValue(undefined);
      const mockAdd = vi.fn().mockResolvedValue({
        id: mockDocId,
        update: mockUpdate,
        delete: mockDelete,
      });

      vi.mocked(collections.remindersRef).mockReturnValue({
        add: mockAdd,
      } as unknown as ReturnType<typeof collections.remindersRef>);

      vi.mocked(tasks.scheduleNotification).mockResolvedValue(mockTaskName);

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
      expect(result.message).toContain('ตั้งเตือน "กินยาหลังอาหาร" เวลา 08:00 น. เรียบร้อยแล้วค่ะ');
      expect(result.data?.reminderId).toBe(mockDocId);
      expect(result.data?.cloudTaskName).toBe(mockTaskName);

      // Verify Firestore add call
      expect(mockAdd).toHaveBeenCalledTimes(1);
      const addedData = mockAdd.mock.calls[0][0];
      expect(addedData.message).toBe('กินยาหลังอาหาร');
      expect(addedData.recurrence).toBe('once');
      expect(addedData.enabled).toBe(true);
      expect(addedData.status).toBe('pending');
      expect(addedData.scheduledAt).toBeInstanceOf(Timestamp);
      expect(addedData.nextFireAt).toBeInstanceOf(Timestamp);

      // Verify Cloud Task scheduling
      expect(tasks.scheduleNotification).toHaveBeenCalledWith({
        userId: mockUser.lineUserId,
        itemId: mockDocId,
        itemType: 'reminder',
        fireAt: expect.any(Date),
      });

      // Verify task name link update
      expect(mockUpdate).toHaveBeenCalledWith({ cloudTaskName: mockTaskName });
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('rolls back created document when scheduling Cloud Task fails', async () => {
      const now = createBangkokDate(2026, 10, 16, 7, 0, 0);
      const mockDocId = 'reminder-doc-fail';
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockDelete = vi.fn().mockResolvedValue(undefined);
      const mockAdd = vi.fn().mockResolvedValue({
        id: mockDocId,
        update: mockUpdate,
        delete: mockDelete,
      });

      vi.mocked(collections.remindersRef).mockReturnValue({
        add: mockAdd,
      } as unknown as ReturnType<typeof collections.remindersRef>);

      vi.mocked(tasks.scheduleNotification).mockRejectedValue(new Error('Cloud Tasks down'));

      const scheduledAt = createBangkokDate(2026, 10, 16, 8, 0, 0).toISOString();
      const result = await handleSetReminder('เตือนกินยา', '', mockUser, {
        now,
        params: {
          message: 'กินยา',
          scheduledAt,
          recurrence: 'once',
        },
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('เกิดข้อผิดพลาดในการตั้งเตือน กรุณาลองใหม่อีกครั้งค่ะ');
      expect(mockAdd).toHaveBeenCalledTimes(1);
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it('extracts parameters using extractReminderParams when params option is omitted', async () => {
      const now = createBangkokDate(2026, 10, 16, 7, 0, 0);
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockAdd = vi.fn().mockResolvedValue({
        id: 'reminder-doc-456',
        update: mockUpdate,
        delete: vi.fn().mockResolvedValue(undefined),
      });

      vi.mocked(collections.remindersRef).mockReturnValue({
        add: mockAdd,
      } as unknown as ReturnType<typeof collections.remindersRef>);
      vi.mocked(tasks.scheduleNotification).mockResolvedValue('reminder-task-456');

      const scheduledAt = createBangkokDate(2026, 10, 16, 18, 0, 0).toISOString();
      vi.mocked(extractor.extractReminderParams).mockResolvedValue({
        message: 'ไปหาหมอ',
        scheduledAt,
        recurrence: 'once',
      });

      const result = await handleSetReminder('ช่วยเตือนไปหาหมอ 6 โมงเย็นหน่อยจ้ะ', '', mockUser, {
        now,
      });

      expect(extractor.extractReminderParams).toHaveBeenCalledWith(
        'ช่วยเตือนไปหาหมอ 6 โมงเย็นหน่อยจ้ะ',
        { now },
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe('ตั้งเตือน "ไปหาหมอ" เวลา 18:00 น. เรียบร้อยแล้วค่ะ');
    });

    it('returns polite Thai fallback when parameters cannot be understood', async () => {
      vi.mocked(extractor.extractReminderParams).mockResolvedValue(null);

      const result = await handleSetReminder('ข้อความที่ไม่ชัดเจนเลย', '', mockUser);

      expect(result.success).toBe(false);
      expect(result.message).toBe(REMINDER_FALLBACK_MESSAGE);
      expect(collections.remindersRef).not.toHaveBeenCalled();
      expect(tasks.scheduleNotification).not.toHaveBeenCalled();
    });

    it('returns error result when Firestore throws', async () => {
      const now = createBangkokDate(2026, 10, 16, 7, 0, 0);
      vi.mocked(collections.remindersRef).mockReturnValue({
        add: vi.fn().mockRejectedValue(new Error('Firestore error')),
      } as unknown as ReturnType<typeof collections.remindersRef>);

      const scheduledAt = createBangkokDate(2026, 10, 16, 8, 0, 0).toISOString();
      const result = await handleSetReminder('เตือนกินยา', '', mockUser, {
        now,
        params: {
          message: 'กินยา',
          scheduledAt,
          recurrence: 'once',
        },
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('เกิดข้อผิดพลาดในการตั้งเตือน');
    });
  });
});
