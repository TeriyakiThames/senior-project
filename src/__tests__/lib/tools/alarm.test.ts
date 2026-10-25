import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSetAlarm, calculateAlarmFireTime, ALARM_FALLBACK_MESSAGE } from '@/lib/tools/alarm';
import * as collections from '@/lib/firebase/collections';
import * as tasks from '@/lib/scheduler/cloud-tasks';
import * as extractor from '@/lib/ai/parameter-extractor';
import type { UserDoc } from '@/types/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { createBangkokDate, getBangkokComponents } from '@/lib/utils/recurrence';
import { createMockUserDoc } from '@/__tests__/mocks';

vi.mock('@/lib/firebase/collections', () => ({
  alarmsRef: vi.fn(),
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
  extractAlarmParams: vi.fn(),
}));

describe('Alarm Tool Handler (SCHED-03)', () => {
  const mockUser: UserDoc = createMockUserDoc({
    lineUserId: 'U_TEST_USER_001',
    displayName: 'คุณตาใจดี',
    firebaseUid: 'firebase-uid-001',
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateAlarmFireTime', () => {
    it('schedules for today if target time has not passed yet', () => {
      // 08:00 in Bangkok
      const now = createBangkokDate(2026, 10, 16, 8, 0, 0);
      const fireAt = calculateAlarmFireTime({ time: '09:30', recurrence: 'once' }, now);

      expect(fireAt).not.toBeNull();
      const fireBkk = getBangkokComponents(fireAt!);
      expect(fireBkk.year).toBe(2026);
      expect(fireBkk.month).toBe(10);
      expect(fireBkk.day).toBe(16);
      expect(fireBkk.hours).toBe(9);
      expect(fireBkk.minutes).toBe(30);
    });

    it('automatically rolls over to the following day if target time has already passed today', () => {
      // 10:00 in Bangkok
      const now = createBangkokDate(2026, 10, 16, 10, 0, 0);
      // Target is 07:00 (already passed)
      const fireAt = calculateAlarmFireTime({ time: '07:00', recurrence: 'once' }, now);

      expect(fireAt).not.toBeNull();
      const fireBkk = getBangkokComponents(fireAt!);
      expect(fireBkk.year).toBe(2026);
      expect(fireBkk.month).toBe(10);
      expect(fireBkk.day).toBe(17); // Rolled over to tomorrow
      expect(fireBkk.hours).toBe(7);
      expect(fireBkk.minutes).toBe(0);
    });

    it('schedules weekly recurrence on the closest upcoming target day of the week', () => {
      // 2026-10-16 is a Friday (dayOfWeek: 5)
      const now = createBangkokDate(2026, 10, 16, 8, 0, 0);
      // Target next Monday (dayOfWeek: 1)
      const fireAt = calculateAlarmFireTime(
        { time: '07:00', recurrence: 'weekly', daysOfWeek: [1] },
        now,
      );

      expect(fireAt).not.toBeNull();
      const fireBkk = getBangkokComponents(fireAt!);
      expect(fireBkk.dayOfWeek).toBe(1);
      expect(fireBkk.day).toBe(19); // Oct 19, 2026 is Monday
      expect(fireBkk.hours).toBe(7);
    });

    it('returns null when time string format is invalid', () => {
      const now = createBangkokDate(2026, 10, 16, 8, 0, 0);
      const fireAt = calculateAlarmFireTime({ time: 'invalid-time', recurrence: 'once' }, now);
      expect(fireAt).toBeNull();
    });
  });

  describe('handleSetAlarm', () => {
    it('creates alarm record in Firestore, schedules Cloud Task, and links cloudTaskName', async () => {
      const now = createBangkokDate(2026, 10, 16, 6, 0, 0);
      const mockDocId = 'alarm-doc-123';
      const mockTaskName = 'projects/p/locations/l/queues/q/tasks/task-999';

      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockDelete = vi.fn().mockResolvedValue(undefined);
      const mockAdd = vi.fn().mockResolvedValue({
        id: mockDocId,
        update: mockUpdate,
        delete: mockDelete,
      });

      vi.mocked(collections.alarmsRef).mockReturnValue({
        add: mockAdd,
      } as unknown as ReturnType<typeof collections.alarmsRef>);

      vi.mocked(tasks.scheduleNotification).mockResolvedValue(mockTaskName);

      const result = await handleSetAlarm('ตั้งปลุก 7 โมงเช้ากินยา', '', mockUser, {
        now,
        params: {
          time: '07:00',
          label: 'กินยา',
          recurrence: 'daily',
        },
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('ตั้งปลุก "กินยา" เวลา 07:00 น. เรียบร้อยแล้วค่ะ');
      expect(result.data?.alarmId).toBe(mockDocId);
      expect(result.data?.cloudTaskName).toBe(mockTaskName);

      // Verify Firestore add call
      expect(mockAdd).toHaveBeenCalledTimes(1);
      const addedData = mockAdd.mock.calls[0][0];
      expect(addedData.time).toBe('07:00');
      expect(addedData.label).toBe('กินยา');
      expect(addedData.recurrence).toBe('daily');
      expect(addedData.enabled).toBe(true);
      expect(addedData.nextFireAt).toBeInstanceOf(Timestamp);

      // Verify Cloud Task scheduling
      expect(tasks.scheduleNotification).toHaveBeenCalledWith({
        userId: mockUser.lineUserId,
        itemId: mockDocId,
        itemType: 'alarm',
        fireAt: expect.any(Date),
      });

      // Verify task name link update
      expect(mockUpdate).toHaveBeenCalledWith({ cloudTaskName: mockTaskName });
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('rolls back created document when scheduling Cloud Task fails', async () => {
      const now = createBangkokDate(2026, 10, 16, 6, 0, 0);
      const mockDocId = 'alarm-doc-fail';
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockDelete = vi.fn().mockResolvedValue(undefined);
      const mockAdd = vi.fn().mockResolvedValue({
        id: mockDocId,
        update: mockUpdate,
        delete: mockDelete,
      });

      vi.mocked(collections.alarmsRef).mockReturnValue({
        add: mockAdd,
      } as unknown as ReturnType<typeof collections.alarmsRef>);

      vi.mocked(tasks.scheduleNotification).mockRejectedValue(new Error('Cloud Tasks down'));

      const result = await handleSetAlarm('ตั้งปลุก 7 โมงเช้า', '', mockUser, {
        now,
        params: { time: '07:00', recurrence: 'once' },
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('เกิดข้อผิดพลาดในการตั้งปลุก กรุณาลองใหม่อีกครั้งค่ะ');
      expect(mockAdd).toHaveBeenCalledTimes(1);
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it('extracts parameters using extractAlarmParams when params option is not passed', async () => {
      const now = createBangkokDate(2026, 10, 16, 6, 0, 0);
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockAdd = vi.fn().mockResolvedValue({
        id: 'alarm-doc-456',
        update: mockUpdate,
        delete: vi.fn().mockResolvedValue(undefined),
      });

      vi.mocked(collections.alarmsRef).mockReturnValue({
        add: mockAdd,
      } as unknown as ReturnType<typeof collections.alarmsRef>);
      vi.mocked(tasks.scheduleNotification).mockResolvedValue('task-456');

      vi.mocked(extractor.extractAlarmParams).mockResolvedValue({
        time: '08:30',
        recurrence: 'once',
      });

      const result = await handleSetAlarm('ช่วยตั้งปลุก 8 โมงครึ่งหน่อยจ้ะ', '', mockUser, { now });

      expect(extractor.extractAlarmParams).toHaveBeenCalledWith('ช่วยตั้งปลุก 8 โมงครึ่งหน่อยจ้ะ');
      expect(result.success).toBe(true);
      expect(result.message).toBe('ตั้งปลุก เวลา 08:30 น. เรียบร้อยแล้วค่ะ');
    });

    it('returns warm polite Thai fallback when parameters cannot be understood', async () => {
      vi.mocked(extractor.extractAlarmParams).mockResolvedValue(null);

      const result = await handleSetAlarm('ข้อความที่ไม่ชัดเจน', '', mockUser);

      expect(result.success).toBe(false);
      expect(result.message).toBe(ALARM_FALLBACK_MESSAGE);
      expect(collections.alarmsRef).not.toHaveBeenCalled();
      expect(tasks.scheduleNotification).not.toHaveBeenCalled();
    });

    it('returns error result when Firestore throws', async () => {
      const now = createBangkokDate(2026, 10, 16, 6, 0, 0);
      vi.mocked(collections.alarmsRef).mockReturnValue({
        add: vi.fn().mockRejectedValue(new Error('Firestore permission denied')),
      } as unknown as ReturnType<typeof collections.alarmsRef>);

      const result = await handleSetAlarm('ตั้งปลุก 07:00', '', mockUser, {
        now,
        params: { time: '07:00', recurrence: 'once' },
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('เกิดข้อผิดพลาดในการตั้งปลุก');
    });
  });
});
