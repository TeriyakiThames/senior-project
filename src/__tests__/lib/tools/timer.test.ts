import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleSetTimer,
  calculateTimerFireTime,
  formatTimerDurationThai,
  TIMER_FALLBACK_MESSAGE,
} from '@/lib/tools/timer';
import * as collections from '@/lib/firebase/collections';
import * as tasks from '@/lib/scheduler/cloud-tasks';
import * as extractor from '@/lib/ai/parameter-extractor';
import type { UserDoc } from '@/types/firestore';
import { createMockUserDoc } from '@/__tests__/mocks';

vi.mock('@/lib/firebase/collections', () => ({
  timersRef: vi.fn(),
  alarmsRef: vi.fn(),
}));

vi.mock('@/lib/scheduler/cloud-tasks', () => ({
  scheduleNotification: vi.fn(),
  saveAndScheduleTask: vi.fn(async ({ collectionRef, data, schedule }) => {
    const docRef = await collectionRef.add(data);
    const taskName = await tasks.scheduleNotification({
      userId: schedule.userId,
      itemId: docRef.id,
      itemType: schedule.itemType,
      fireAt: schedule.fireAt,
    });
    await docRef.update({ cloudTaskName: taskName });
    return { docRef, taskName };
  }),
}));

vi.mock('@/lib/ai/parameter-extractor', () => ({
  extractTimerParams: vi.fn(),
}));

describe('Timer Tool Handler (Timer Feature)', () => {
  const mockUser: UserDoc = createMockUserDoc({
    lineUserId: 'U_TEST_USER_TIMER',
    displayName: 'คุณตาใจดี',
    firebaseUid: 'firebase-uid-timer',
  });

  const fixedNow = new Date('2026-11-03T10:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateTimerFireTime', () => {
    it('calculates fire time exactly by adding minutes to now', () => {
      const fireAt = calculateTimerFireTime(15, fixedNow);
      expect(fireAt.getTime()).toBe(fixedNow.getTime() + 15 * 60 * 1000);
    });

    it('calculates fire time for hours and minutes', () => {
      const fireAt = calculateTimerFireTime(90, fixedNow);
      expect(fireAt.getTime()).toBe(fixedNow.getTime() + 90 * 60 * 1000);
    });
  });

  describe('formatTimerDurationThai', () => {
    it('formats minutes only', () => {
      expect(formatTimerDurationThai(0, 15, 15)).toBe('15 นาที');
    });

    it('formats hours only', () => {
      expect(formatTimerDurationThai(2, 0, 120)).toBe('2 ชั่วโมง');
    });

    it('formats hours and minutes', () => {
      expect(formatTimerDurationThai(1, 30, 90)).toBe('1 ชั่วโมง 30 นาที');
    });
  });

  describe('handleSetTimer', () => {
    it('returns fallback message when duration is missing or totalMinutes <= 0', async () => {
      vi.mocked(extractor.extractTimerParams).mockResolvedValue(null);

      const result = await handleSetTimer('จับเวลาหน่อย', '', mockUser, { now: fixedNow });

      expect(result.success).toBe(false);
      expect(result.message).toBe(TIMER_FALLBACK_MESSAGE);
      expect(tasks.saveAndScheduleTask).not.toHaveBeenCalled();
    });

    it('successfully creates a timer, enqueues Cloud Task, and returns confirmation', async () => {
      const mockDocRef = {
        id: 'timer-doc-123',
        update: vi.fn().mockResolvedValue(undefined),
      };
      const mockCollectionRef = {
        add: vi.fn().mockResolvedValue(mockDocRef),
      };
      vi.mocked(collections.timersRef).mockReturnValue(mockCollectionRef as any);
      vi.mocked(tasks.scheduleNotification).mockResolvedValue('tasks/timer-task-1');

      const result = await handleSetTimer('จับเวลา 15 นาที', '', mockUser, {
        now: fixedNow,
        params: {
          hours: 0,
          minutes: 15,
          totalMinutes: 15,
        },
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('ตั้งตัวจับเวลา 15 นาที เรียบร้อยแล้วค่ะ ⏱️');
      expect(result.data).toMatchObject({
        timerId: 'timer-doc-123',
        durationMinutes: 15,
        cloudTaskName: 'tasks/timer-task-1',
      });

      expect(tasks.saveAndScheduleTask).toHaveBeenCalledWith(
        expect.objectContaining({
          schedule: expect.objectContaining({
            userId: mockUser.lineUserId,
            itemType: 'timer',
            fireAt: new Date(fixedNow.getTime() + 15 * 60 * 1000),
          }),
        }),
      );
    });

    it('includes label in confirmation message when label is provided', async () => {
      const mockDocRef = {
        id: 'timer-doc-456',
        update: vi.fn().mockResolvedValue(undefined),
      };
      const mockCollectionRef = {
        add: vi.fn().mockResolvedValue(mockDocRef),
      };
      vi.mocked(collections.timersRef).mockReturnValue(mockCollectionRef as any);
      vi.mocked(tasks.scheduleNotification).mockResolvedValue('tasks/timer-task-2');

      const result = await handleSetTimer('จับเวลาต้มไข่ 7 นาที', '', mockUser, {
        now: fixedNow,
        params: {
          hours: 0,
          minutes: 7,
          totalMinutes: 7,
          label: 'ต้มไข่',
        },
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('ต้มไข่');
      expect(result.message).toContain('7 นาที');
    });

    it('handles unexpected errors gracefully', async () => {
      vi.mocked(tasks.saveAndScheduleTask).mockRejectedValueOnce(
        new Error('Cloud Tasks unavailable'),
      );

      const result = await handleSetTimer('จับเวลา 10 นาที', '', mockUser, {
        now: fixedNow,
        params: {
          hours: 0,
          minutes: 10,
          totalMinutes: 10,
        },
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('เกิดข้อผิดพลาดในการตั้งเวลา');
    });
  });
});
