import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleSnooze,
  handleDismiss,
  SNOOZE_NOT_FOUND_MESSAGE,
  SNOOZE_CLARIFY_MESSAGE,
  DISMISS_NOT_FOUND_MESSAGE,
  DISMISS_CLARIFY_MESSAGE,
  ACTION_ALREADY_HANDLED_MESSAGE,
} from '@/lib/tools/actions';
import { executeTool } from '@/lib/tools/index';
import { buildAlarmNotification, buildReminderNotification } from '@/lib/line/flex-messages';
import * as collections from '@/lib/firebase/collections';
import * as tasks from '@/lib/scheduler/cloud-tasks';
import type { UserDoc } from '@/types/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { createMockUserDoc } from '@/__tests__/mocks';

vi.mock('@/lib/firebase/collections', () => ({
  alarmsRef: vi.fn(),
  remindersRef: vi.fn(),
}));

vi.mock('@/lib/scheduler/cloud-tasks', () => ({
  scheduleNotification: vi.fn(),
  cancelScheduledTask: vi.fn(),
}));

describe('Snooze and Dismiss Tool Handlers (SCHED-07)', () => {
  const mockUser: UserDoc = createMockUserDoc({
    lineUserId: 'U_TEST_USER_SCHED07',
    displayName: 'คุณยายสมใจ',
    firebaseUid: 'uid-sched-07',
  });

  const fixedNow = new Date('2026-10-18T08:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleSnooze with explicit ID', () => {
    it('snoozes alarm by +5 minutes, reschedules cloud task, and updates Firestore', async () => {
      const mockAlarmDoc = {
        time: '07:55',
        label: 'ตื่นนอน',
        recurrence: 'once',
        enabled: true,
        cloudTaskName: 'tasks/locations/asia-southeast1/queues/reminder-queue/tasks/old-alarm-task',
        nextFireAt: Timestamp.fromDate(new Date('2026-10-18T07:55:00.000Z')),
      };

      const updateMock = vi.fn().mockResolvedValue(undefined);
      const docMock = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => mockAlarmDoc,
        }),
        update: updateMock,
      };

      vi.mocked(collections.alarmsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(docMock),
      } as any);

      vi.mocked(tasks.cancelScheduledTask).mockResolvedValue(undefined);
      vi.mocked(tasks.scheduleNotification).mockResolvedValue(
        'tasks/locations/asia-southeast1/queues/reminder-queue/tasks/new-snooze-alarm-task',
      );

      const result = await handleSnooze('snooze_alarm:alarm-123', mockUser, {
        now: fixedNow,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('เลื่อนปลุกไปอีก 5 นาทีค่ะ ⏰');
      expect(tasks.cancelScheduledTask).toHaveBeenCalledWith(mockAlarmDoc.cloudTaskName);
      expect(tasks.scheduleNotification).toHaveBeenCalledWith({
        userId: mockUser.lineUserId,
        itemId: 'alarm-123',
        itemType: 'alarm',
        fireAt: new Date(fixedNow.getTime() + 5 * 60 * 1000),
      });

      expect(updateMock).toHaveBeenCalledWith({
        cloudTaskName:
          'tasks/locations/asia-southeast1/queues/reminder-queue/tasks/new-snooze-alarm-task',
        nextFireAt: Timestamp.fromDate(new Date(fixedNow.getTime() + 5 * 60 * 1000)),
        enabled: true,
      });
    });

    it('snoozes reminder by +15 minutes, reschedules task, and marks status: snoozed', async () => {
      const mockReminderDoc = {
        message: 'กินยาความดัน',
        recurrence: 'once',
        enabled: true,
        status: 'fired',
        cloudTaskName: 'tasks/locations/asia-southeast1/queues/reminder-queue/tasks/old-rem-task',
        nextFireAt: Timestamp.fromDate(new Date('2026-10-18T07:45:00.000Z')),
        scheduledAt: Timestamp.fromDate(new Date('2026-10-18T07:45:00.000Z')),
      };

      const updateMock = vi.fn().mockResolvedValue(undefined);
      const docMock = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => mockReminderDoc,
        }),
        update: updateMock,
      };

      vi.mocked(collections.remindersRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(docMock),
      } as any);

      vi.mocked(tasks.cancelScheduledTask).mockResolvedValue(undefined);
      vi.mocked(tasks.scheduleNotification).mockResolvedValue(
        'tasks/locations/asia-southeast1/queues/reminder-queue/tasks/new-snooze-rem-task',
      );

      const result = await handleSnooze('snooze_reminder:rem-456', mockUser, {
        now: fixedNow,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('เลื่อนการเตือนไปอีก 15 นาทีค่ะ 📋');
      expect(tasks.cancelScheduledTask).toHaveBeenCalledWith(mockReminderDoc.cloudTaskName);
      expect(tasks.scheduleNotification).toHaveBeenCalledWith({
        userId: mockUser.lineUserId,
        itemId: 'rem-456',
        itemType: 'reminder',
        fireAt: new Date(fixedNow.getTime() + 15 * 60 * 1000),
      });

      expect(updateMock).toHaveBeenCalledWith({
        cloudTaskName:
          'tasks/locations/asia-southeast1/queues/reminder-queue/tasks/new-snooze-rem-task',
        nextFireAt: Timestamp.fromDate(new Date(fixedNow.getTime() + 15 * 60 * 1000)),
        status: 'snoozed',
        enabled: true,
      });
    });

    it('snoozes timer by +15 minutes, reschedules cloud task, and updates Firestore', async () => {
      const mockTimerDoc = {
        durationMinutes: 15,
        enabled: true,
        status: 'fired',
        cloudTaskName: 'tasks/locations/asia-southeast1/queues/reminder-queue/tasks/old-timer-task',
        nextFireAt: Timestamp.fromDate(new Date('2026-10-18T07:55:00.000Z')),
      };

      const updateMock = vi.fn().mockResolvedValue(undefined);
      const docMock = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => mockTimerDoc,
        }),
        update: updateMock,
      };

      vi.mocked(collections.alarmsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(docMock),
      } as any);

      vi.mocked(tasks.cancelScheduledTask).mockResolvedValue(undefined);
      vi.mocked(tasks.scheduleNotification).mockResolvedValue(
        'tasks/locations/asia-southeast1/queues/reminder-queue/tasks/new-snooze-timer-task',
      );

      const result = await handleSnooze('snooze_timer:timer-123', mockUser, {
        now: fixedNow,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('เลื่อนเวลาไปอีก 15 นาทีค่ะ ⏱️');
      expect(tasks.cancelScheduledTask).toHaveBeenCalledWith(mockTimerDoc.cloudTaskName);
      expect(tasks.scheduleNotification).toHaveBeenCalledWith({
        userId: mockUser.lineUserId,
        itemId: 'timer-123',
        itemType: 'timer',
        fireAt: new Date(fixedNow.getTime() + 15 * 60 * 1000),
      });

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cloudTaskName:
            'tasks/locations/asia-southeast1/queues/reminder-queue/tasks/new-snooze-timer-task',
          nextFireAt: Timestamp.fromDate(new Date(fixedNow.getTime() + 15 * 60 * 1000)),
          status: 'snoozed',
          enabled: true,
        }),
      );
    });

    it('returns error when target doc does not exist', async () => {
      vi.mocked(collections.alarmsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: false }),
        }),
      } as any);

      const result = await handleSnooze('snooze_alarm:nonexistent', mockUser, {
        now: fixedNow,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('ไม่พบนาฬิกาปลุก');
    });
  });

  describe('handleDismiss with explicit ID', () => {
    it('dismisses one-off alarm by disabling it and canceling task', async () => {
      const mockAlarmDoc = {
        time: '08:00',
        recurrence: 'once',
        enabled: true,
        cloudTaskName: 'task-alarm-1',
      };

      const updateMock = vi.fn().mockResolvedValue(undefined);
      const docMock = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => mockAlarmDoc,
        }),
        update: updateMock,
      };

      vi.mocked(collections.alarmsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(docMock),
      } as any);

      const result = await handleDismiss('dismiss_alarm:alarm-1', mockUser, {
        now: fixedNow,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('ปิดเสียงปลุกแล้วค่ะ ✓');
      expect(tasks.cancelScheduledTask).toHaveBeenCalledWith('task-alarm-1');
      expect(updateMock).toHaveBeenCalledWith({
        enabled: false,
        cloudTaskName: null,
      });
    });

    it('dismisses recurring alarm by canceling active task but keeping enabled: true', async () => {
      const mockRecurringAlarm = {
        time: '08:00',
        recurrence: 'daily',
        enabled: true,
        cloudTaskName: 'task-recurring-snooze',
      };

      const updateMock = vi.fn().mockResolvedValue(undefined);
      const docMock = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => mockRecurringAlarm,
        }),
        update: updateMock,
      };

      vi.mocked(collections.alarmsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(docMock),
      } as any);

      const result = await handleDismiss('dismiss_alarm:alarm-rec', mockUser, {
        now: fixedNow,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('ปิดเสียงปลุกแล้วค่ะ ✓');
      expect(tasks.cancelScheduledTask).toHaveBeenCalledWith('task-recurring-snooze');
      expect(updateMock).toHaveBeenCalledWith({
        cloudTaskName: null,
      });
    });

    it('dismisses timer by disabling it, marking status done, and canceling task', async () => {
      const mockTimer = {
        durationMinutes: 15,
        enabled: true,
        status: 'fired',
        cloudTaskName: 'task-timer-cancel',
      };

      const updateMock = vi.fn().mockResolvedValue(undefined);
      const docMock = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => mockTimer,
        }),
        update: updateMock,
      };

      vi.mocked(collections.alarmsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(docMock),
      } as any);

      const result = await handleDismiss('dismiss_timer:timer-1', mockUser, {
        now: fixedNow,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('ปิดตัวจับเวลาแล้วค่ะ ✓');
      expect(tasks.cancelScheduledTask).toHaveBeenCalledWith('task-timer-cancel');
      expect(updateMock).toHaveBeenCalledWith({
        enabled: false,
        cloudTaskName: null,
        status: 'done',
      });
    });

    it('dismisses reminder by setting status: done, enabled: false, and canceling task', async () => {
      const mockReminderDoc = {
        message: 'กินยา',
        status: 'fired',
        enabled: true,
        cloudTaskName: 'task-rem-1',
      };

      const updateMock = vi.fn().mockResolvedValue(undefined);
      const docMock = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => mockReminderDoc,
        }),
        update: updateMock,
      };

      vi.mocked(collections.remindersRef).mockReturnValue({
        doc: vi.fn().mockReturnValue(docMock),
      } as any);

      const result = await handleDismiss('dismiss_reminder:rem-1', mockUser, {
        now: fixedNow,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('ปิดการเตือนแล้วค่ะ ✓');
      expect(tasks.cancelScheduledTask).toHaveBeenCalledWith('task-rem-1');
      expect(updateMock).toHaveBeenCalledWith({
        status: 'done',
        enabled: false,
        cloudTaskName: null,
      });
    });
  });

  describe('Idempotent notification card button interactions', () => {
    it('disables buttons after snoozing a reminder: repeated snooze tells user it does nothing', async () => {
      const mockReminderDoc = {
        message: 'กินยาลดความดัน',
        status: 'snoozed',
        enabled: true,
        lastHandledNotificationId: 'nid-test-123',
        lastHandledAction: 'snooze',
        cloudTaskName: 'active-task',
      };

      const updateMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(collections.remindersRef).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => mockReminderDoc,
          }),
          update: updateMock,
        }),
      } as any);

      const result = await handleSnooze('snooze_reminder:rem-123', mockUser, {
        notificationId: 'nid-test-123',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe(ACTION_ALREADY_HANDLED_MESSAGE);
      expect(updateMock).not.toHaveBeenCalled();
      expect(tasks.scheduleNotification).not.toHaveBeenCalled();
    });

    it('disables buttons after snoozing a reminder: pressing dismiss tells user it does nothing', async () => {
      const mockReminderDoc = {
        message: 'กินยาลดความดัน',
        status: 'snoozed',
        enabled: true,
        lastHandledNotificationId: 'nid-test-123',
        lastHandledAction: 'snooze',
        cloudTaskName: 'active-task',
      };

      const updateMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(collections.remindersRef).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => mockReminderDoc,
          }),
          update: updateMock,
        }),
      } as any);

      const result = await handleDismiss('dismiss_reminder:rem-123', mockUser, {
        notificationId: 'nid-test-123',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe(ACTION_ALREADY_HANDLED_MESSAGE);
      expect(updateMock).not.toHaveBeenCalled();
      expect(tasks.cancelScheduledTask).not.toHaveBeenCalled();
    });

    it('disables buttons after dismissing a reminder: repeated dismiss or snooze tells user it does nothing', async () => {
      const mockReminderDoc = {
        message: 'กินยาลดความดัน',
        status: 'done',
        enabled: false,
        lastHandledNotificationId: 'nid-test-123',
        lastHandledAction: 'dismiss',
        cloudTaskName: null,
      };

      const updateMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(collections.remindersRef).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => mockReminderDoc,
          }),
          update: updateMock,
        }),
      } as any);

      const dismissRes = await handleDismiss('dismiss_reminder:rem-123', mockUser, {
        notificationId: 'nid-test-123',
      });
      expect(dismissRes.success).toBe(false);
      expect(dismissRes.message).toBe(ACTION_ALREADY_HANDLED_MESSAGE);

      const snoozeRes = await handleSnooze('snooze_reminder:rem-123', mockUser, {
        notificationId: 'nid-test-123',
      });
      expect(snoozeRes.success).toBe(false);
      expect(snoozeRes.message).toBe(ACTION_ALREADY_HANDLED_MESSAGE);
      expect(updateMock).not.toHaveBeenCalled();
    });

    it('disables buttons after snoozing or dismissing an alarm', async () => {
      const mockAlarmDoc = {
        label: 'ตื่นนอน',
        enabled: true,
        lastHandledNotificationId: 'nid-alarm-456',
        lastHandledAction: 'snooze',
        cloudTaskName: 'alarm-active-task',
        recurrence: 'once',
      };

      const updateMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(collections.alarmsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => mockAlarmDoc,
          }),
          update: updateMock,
        }),
      } as any);

      const result = await handleSnooze('snooze_alarm:alm-456', mockUser, {
        notificationId: 'nid-alarm-456',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe(ACTION_ALREADY_HANDLED_MESSAGE);
      expect(updateMock).not.toHaveBeenCalled();
    });

    it('allows snoozing an actively repeating reminder (status: fired) and cancels repeat task', async () => {
      const mockReminderDoc = {
        message: 'กินยาลดความดัน',
        status: 'fired',
        enabled: true,
        cloudTaskName: 'repeat-task-1',
        recurrence: 'once',
        lastNotificationId: 'nid-repeat-1',
      };

      const updateMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(collections.remindersRef).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => mockReminderDoc,
          }),
          update: updateMock,
        }),
      } as any);

      vi.mocked(tasks.cancelScheduledTask).mockResolvedValue(undefined);
      vi.mocked(tasks.scheduleNotification).mockResolvedValue('new-snooze-task');

      const result = await handleSnooze('snooze_reminder:rem-repeat-1', mockUser, {
        now: fixedNow,
        notificationId: 'nid-repeat-1',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('เลื่อนการเตือนไปอีก 15 นาทีค่ะ 📋');
      expect(tasks.cancelScheduledTask).toHaveBeenCalledWith('repeat-task-1');
      expect(tasks.scheduleNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.lineUserId,
          itemId: 'rem-repeat-1',
          itemType: 'reminder',
          fireAt: new Date(fixedNow.getTime() + 15 * 60 * 1000),
        }),
      );
      expect(updateMock).toHaveBeenCalledWith({
        cloudTaskName: 'new-snooze-task',
        nextFireAt: expect.any(Object),
        status: 'snoozed',
        enabled: true,
        lastHandledNotificationId: 'nid-repeat-1',
        lastHandledAction: 'snooze',
      });
    });

    it('allows dismissing an actively repeating reminder (status: fired) and cancels repeat task', async () => {
      const mockReminderDoc = {
        message: 'กินยาลดความดัน',
        status: 'fired',
        enabled: true,
        cloudTaskName: 'repeat-task-1',
        recurrence: 'once',
        lastNotificationId: 'nid-repeat-1',
      };

      const updateMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(collections.remindersRef).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => mockReminderDoc,
          }),
          update: updateMock,
        }),
      } as any);

      vi.mocked(tasks.cancelScheduledTask).mockResolvedValue(undefined);

      const result = await handleDismiss('dismiss_reminder:rem-repeat-1', mockUser, {
        now: fixedNow,
        notificationId: 'nid-repeat-1',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('ปิดการเตือนแล้วค่ะ ✓');
      expect(tasks.cancelScheduledTask).toHaveBeenCalledWith('repeat-task-1');
      expect(updateMock).toHaveBeenCalledWith({
        status: 'done',
        enabled: false,
        cloudTaskName: null,
        lastHandledNotificationId: 'nid-repeat-1',
        lastHandledAction: 'dismiss',
      });
    });

    it('allows dismissing from an earlier notification card when a reminder has auto-repeated', async () => {
      const mockReminderDoc = {
        message: 'กินยาลดความดัน',
        status: 'fired',
        enabled: true,
        cloudTaskName: 'repeat-task-2',
        recurrence: 'once',
        lastNotificationId: 'nid-repeat-2',
      };

      const updateMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(collections.remindersRef).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => mockReminderDoc,
          }),
          update: updateMock,
        }),
      } as any);

      vi.mocked(tasks.cancelScheduledTask).mockResolvedValue(undefined);

      // User clicks Dismiss on the 10:00 card (nid-repeat-1) even though nid-repeat-2 was sent at 10:05
      const result = await handleDismiss('dismiss_reminder:rem-repeat-1', mockUser, {
        now: fixedNow,
        notificationId: 'nid-repeat-1',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('ปิดการเตือนแล้วค่ะ ✓');
      expect(tasks.cancelScheduledTask).toHaveBeenCalledWith('repeat-task-2');
      expect(updateMock).toHaveBeenCalledWith({
        status: 'done',
        enabled: false,
        cloudTaskName: null,
        lastHandledNotificationId: 'nid-repeat-1',
        lastHandledAction: 'dismiss',
      });
    });

    it('allows snoozing from an earlier notification card when a reminder has auto-repeated', async () => {
      const mockReminderDoc = {
        message: 'กินยาลดความดัน',
        status: 'fired',
        enabled: true,
        cloudTaskName: 'repeat-task-2',
        recurrence: 'once',
        lastNotificationId: 'nid-repeat-2',
      };

      const updateMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(collections.remindersRef).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => mockReminderDoc,
          }),
          update: updateMock,
        }),
      } as any);

      vi.mocked(tasks.cancelScheduledTask).mockResolvedValue(undefined);
      vi.mocked(tasks.scheduleNotification).mockResolvedValue('snooze-task-after-card1');

      // User clicks Snooze on the 10:00 card (nid-repeat-1) even though nid-repeat-2 was sent at 10:05
      const result = await handleSnooze('snooze_reminder:rem-repeat-1', mockUser, {
        now: fixedNow,
        notificationId: 'nid-repeat-1',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('เลื่อนการเตือนไปอีก 15 นาทีค่ะ 📋');
      expect(tasks.cancelScheduledTask).toHaveBeenCalledWith('repeat-task-2');
      expect(updateMock).toHaveBeenCalledWith({
        cloudTaskName: 'snooze-task-after-card1',
        nextFireAt: expect.any(Object),
        status: 'snoozed',
        enabled: true,
        lastHandledNotificationId: 'nid-repeat-1',
        lastHandledAction: 'snooze',
      });
    });
  });

  describe('Voice / Text fallback within 30-minute window', () => {
    it('resolves single recently fired alarm when user says "เลื่อน"', async () => {
      const recentFireTime = new Date(fixedNow.getTime() - 10 * 60 * 1000); // 10 minutes ago
      const mockAlarmDoc = {
        time: '07:50',
        label: 'ตื่นนอน',
        recurrence: 'once',
        enabled: true,
        nextFireAt: Timestamp.fromDate(recentFireTime),
        cloudTaskName: 'old-task',
      };

      const updateMock = vi.fn().mockResolvedValue(undefined);
      const docRefMock = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => mockAlarmDoc,
        }),
        update: updateMock,
      };

      vi.mocked(collections.alarmsRef).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({
          docs: [{ id: 'alarm-single', data: () => mockAlarmDoc, ref: docRefMock }],
        }),
        doc: vi.fn().mockReturnValue(docRefMock),
      } as any);

      vi.mocked(collections.remindersRef).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ docs: [] }),
      } as any);

      vi.mocked(tasks.scheduleNotification).mockResolvedValue('new-task');

      const result = await handleSnooze('เลื่อน', mockUser, { now: fixedNow });

      expect(result.success).toBe(true);
      expect(result.message).toContain('เลื่อนปลุกไปอีก 5 นาทีค่ะ ⏰');
    });

    it('resolves single recently fired reminder when user says "เสร็จแล้ว"', async () => {
      const recentFireTime = new Date(fixedNow.getTime() - 5 * 60 * 1000); // 5 minutes ago
      const mockReminderDoc = {
        message: 'กินยาวันนี้',
        status: 'fired',
        enabled: true,
        scheduledAt: Timestamp.fromDate(recentFireTime),
        cloudTaskName: 'rem-task',
      };

      const updateMock = vi.fn().mockResolvedValue(undefined);
      const docRefMock = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => mockReminderDoc,
        }),
        update: updateMock,
      };

      vi.mocked(collections.alarmsRef).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ docs: [] }),
      } as any);

      vi.mocked(collections.remindersRef).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({
          docs: [{ id: 'rem-single', data: () => mockReminderDoc, ref: docRefMock }],
        }),
        doc: vi.fn().mockReturnValue(docRefMock),
      } as any);

      const result = await handleDismiss('เสร็จแล้ว', mockUser, { now: fixedNow });

      expect(result.success).toBe(true);
      expect(result.message).toBe('ปิดการเตือนแล้วค่ะ ✓');
      expect(updateMock).toHaveBeenCalledWith({
        status: 'done',
        enabled: false,
        cloudTaskName: null,
      });
    });

    it('asks for clarification when multiple items fired within 30 minutes', async () => {
      const recentFireTime = new Date(fixedNow.getTime() - 5 * 60 * 1000);
      const mockAlarm = {
        time: '07:55',
        enabled: true,
        nextFireAt: Timestamp.fromDate(recentFireTime),
      };
      const mockReminder = {
        message: 'กินยา',
        status: 'fired',
        scheduledAt: Timestamp.fromDate(recentFireTime),
      };

      vi.mocked(collections.alarmsRef).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({
          docs: [{ id: 'alarm-1', data: () => mockAlarm, ref: {} }],
        }),
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: true, data: () => mockAlarm }),
          update: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      vi.mocked(collections.remindersRef).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({
          docs: [{ id: 'rem-1', data: () => mockReminder, ref: {} }],
        }),
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: true, data: () => mockReminder }),
          update: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      const snoozeResult = await handleSnooze('เลื่อนออกไป', mockUser, { now: fixedNow });
      expect(snoozeResult.success).toBe(false);
      expect(snoozeResult.message).toBe(SNOOZE_CLARIFY_MESSAGE);

      const dismissResult = await handleDismiss('ปิดการแจ้งเตือน', mockUser, { now: fixedNow });
      expect(dismissResult.success).toBe(false);
      expect(dismissResult.message).toBe(DISMISS_CLARIFY_MESSAGE);
    });

    it('returns friendly not-found message when no items fired in the 30-minute window', async () => {
      vi.mocked(collections.alarmsRef).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ docs: [] }),
      } as any);

      vi.mocked(collections.remindersRef).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ docs: [] }),
      } as any);

      const snoozeResult = await handleSnooze('เลื่อน', mockUser, { now: fixedNow });
      expect(snoozeResult.success).toBe(false);
      expect(snoozeResult.message).toBe(SNOOZE_NOT_FOUND_MESSAGE);

      const dismissResult = await handleDismiss('เสร็จแล้ว', mockUser, { now: fixedNow });
      expect(dismissResult.success).toBe(false);
      expect(dismissResult.message).toBe(DISMISS_NOT_FOUND_MESSAGE);
    });
  });

  describe('executeTool integration', () => {
    it('dispatches snooze intent to handleSnooze', async () => {
      vi.mocked(collections.alarmsRef).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ time: '08:00', enabled: true }),
          }),
          update: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);
      vi.mocked(tasks.scheduleNotification).mockResolvedValue('task-snooze-test');

      const result = await executeTool({
        intent: { intent: 'snooze', confidence: 0.95, isAmbiguous: false },
        userText: 'snooze_alarm:a-1',
        user: mockUser,
        now: fixedNow,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('เลื่อนปลุกไปอีก 5 นาทีค่ะ ⏰');
    });

    it('dispatches dismiss intent to handleDismiss', async () => {
      vi.mocked(collections.remindersRef).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ message: 'กินยา', status: 'fired' }),
          }),
          update: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      const result = await executeTool({
        intent: { intent: 'dismiss', confidence: 0.95, isAmbiguous: false },
        userText: 'dismiss_reminder:r-1',
        user: mockUser,
        now: fixedNow,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('ปิดการเตือนแล้วค่ะ ✓');
    });

    it('rejects path traversal and unsafe item IDs in handleSnooze without querying Firestore', async () => {
      const docSpy = vi.fn();
      vi.mocked(collections.alarmsRef).mockReturnValue({ doc: docSpy } as any);
      vi.mocked(collections.remindersRef).mockReturnValue({ doc: docSpy } as any);

      const resAlarm = await handleSnooze('snooze_alarm:../../malicious', mockUser);
      expect(resAlarm.success).toBe(false);
      expect(resAlarm.message).toBe('ไม่พบนาฬิกาปลุกที่จะเลื่อนค่ะ คุณตาคุณยาย');

      const resTimer = await handleSnooze('snooze_timer:../../malicious', mockUser);
      expect(resTimer.success).toBe(false);
      expect(resTimer.message).toBe('ไม่พบตัวจับเวลาที่จะเลื่อนค่ะ คุณตาคุณยาย');

      const resRem = await handleSnooze('snooze_reminder:../../malicious', mockUser);
      expect(resRem.success).toBe(false);
      expect(resRem.message).toBe('ไม่พบการเตือนที่จะเลื่อนค่ะ คุณตาคุณยาย');

      expect(docSpy).not.toHaveBeenCalled();
    });

    it('rejects path traversal and unsafe item IDs in handleDismiss without querying Firestore', async () => {
      const docSpy = vi.fn();
      vi.mocked(collections.alarmsRef).mockReturnValue({ doc: docSpy } as any);
      vi.mocked(collections.remindersRef).mockReturnValue({ doc: docSpy } as any);

      const resAlarm = await handleDismiss('dismiss_alarm:../../malicious', mockUser);
      expect(resAlarm.success).toBe(false);
      expect(resAlarm.message).toBe('ไม่พบนาฬิกาปลุกที่จะปิดค่ะ คุณตาคุณยาย');

      const resTimer = await handleDismiss('dismiss_timer:../../malicious', mockUser);
      expect(resTimer.success).toBe(false);
      expect(resTimer.message).toBe('ไม่พบตัวจับเวลาที่จะปิดค่ะ คุณตาคุณยาย');

      const resRem = await handleDismiss('dismiss_reminder:../../malicious', mockUser);
      expect(resRem.success).toBe(false);
      expect(resRem.message).toBe('ไม่พบการเตือนที่จะปิดค่ะ คุณตาคุณยาย');

      expect(docSpy).not.toHaveBeenCalled();
    });
  });

  describe('Flex Message Builders', () => {
    it('builds alarm notification Flex message with snooze and dismiss actions', () => {
      const flex = buildAlarmNotification('กินยาความดัน', 'alarm-test-id');

      expect(flex.type).toBe('flex');
      expect(flex.altText).toContain('กินยาความดัน');

      const bubble = flex.contents as any;
      expect(bubble.footer.contents).toHaveLength(2);
      expect(bubble.footer.contents[0].action.type).toBe('postback');
      expect(bubble.footer.contents[0].action.data).toBe('action=snooze_alarm&id=alarm-test-id');
      expect(bubble.footer.contents[0].action.displayText).toBe('เลื่อน 5 นาที');
      expect(bubble.footer.contents[1].action.type).toBe('postback');
      expect(bubble.footer.contents[1].action.data).toBe('action=dismiss_alarm&id=alarm-test-id');
      expect(bubble.footer.contents[1].action.displayText).toBe('ปิดการปลุก');
    });

    it('builds reminder notification Flex message with snooze and dismiss actions', () => {
      const flex = buildReminderNotification('พบแพทย์โรงพยาบาล', 'rem-test-id');

      expect(flex.type).toBe('flex');
      expect(flex.altText).toContain('พบแพทย์โรงพยาบาล');

      const bubble = flex.contents as any;
      expect(bubble.footer.contents).toHaveLength(2);
      expect(bubble.footer.contents[0].action.type).toBe('postback');
      expect(bubble.footer.contents[0].action.data).toBe('action=snooze_reminder&id=rem-test-id');
      expect(bubble.footer.contents[0].action.displayText).toBe('เลื่อน 15 นาที');
      expect(bubble.footer.contents[1].action.type).toBe('postback');
      expect(bubble.footer.contents[1].action.data).toBe('action=dismiss_reminder&id=rem-test-id');
      expect(bubble.footer.contents[1].action.displayText).toBe('เรียบร้อย');
    });
  });
});
