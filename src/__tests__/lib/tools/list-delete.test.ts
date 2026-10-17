import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleListItems,
  LIST_EMPTY_ALL_MESSAGE,
  LIST_EMPTY_ALARMS_MESSAGE,
} from '@/lib/tools/list';
import {
  handleDeleteItem,
  DELETE_NOT_FOUND_ALARM_MESSAGE,
  DELETE_NOT_FOUND_REMINDER_MESSAGE,
} from '@/lib/tools/delete';
import { executeTool } from '@/lib/tools/index';
import * as collections from '@/lib/firebase/collections';
import * as tasks from '@/lib/scheduler/cloud-tasks';
import * as extractor from '@/lib/ai/parameter-extractor';
import type { UserDoc } from '@/types/firestore';
import { Timestamp } from 'firebase-admin/firestore';

vi.mock('@/lib/firebase/collections', () => ({
  alarmsRef: vi.fn(),
  remindersRef: vi.fn(),
  notesRef: vi.fn(),
}));

vi.mock('@/lib/scheduler/cloud-tasks', () => ({
  cancelScheduledTask: vi.fn(),
}));

vi.mock('@/lib/ai/parameter-extractor', () => ({
  classifyItemType: vi.fn(),
}));

describe('List and Delete Tool Handlers (SCHED-06)', () => {
  const mockUser: UserDoc = {
    lineUserId: 'U_TEST_USER_SCHED06',
    displayName: 'คุณยายสมใจ',
    language: 'th',
    timezone: 'Asia/Bangkok',
    firebaseUid: 'uid-sched-06',
    createdAt: Timestamp.now(),
    profile: {
      facts: [],
      updatedAt: Timestamp.now(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleListItems', () => {
    it('returns combined friendly message when no items exist across all categories', async () => {
      vi.mocked(extractor.classifyItemType).mockResolvedValue({
        itemType: 'all',
        confidence: 0.99,
      });

      const emptyQuery = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      };

      vi.mocked(collections.alarmsRef).mockReturnValue(emptyQuery as any);
      vi.mocked(collections.remindersRef).mockReturnValue(emptyQuery as any);
      vi.mocked(collections.notesRef).mockReturnValue(emptyQuery as any);

      const result = await handleListItems('มีอะไรบ้าง', '', mockUser);

      expect(result.success).toBe(true);
      expect(result.message).toBe(LIST_EMPTY_ALL_MESSAGE);
    });

    it('formats active alarms, reminders, and notes with emojis and numbers', async () => {
      vi.mocked(extractor.classifyItemType).mockResolvedValue({
        itemType: 'all',
        confidence: 0.95,
      });

      const alarmDocs = [
        {
          id: 'alarm-1',
          data: () => ({
            time: '07:00',
            label: 'ตื่นนอน',
            recurrence: 'daily',
            enabled: true,
          }),
        },
      ];

      const reminderDocs = [
        {
          id: 'rem-1',
          data: () => ({
            message: 'กินยาความดัน',
            scheduledAt: Timestamp.fromDate(new Date('2026-10-18T08:00:00+07:00')),
            nextFireAt: Timestamp.fromDate(new Date('2026-10-18T08:00:00+07:00')),
            status: 'pending',
          }),
        },
      ];

      const noteDocs = [
        {
          id: 'note-1',
          data: () => ({
            summary: 'นัดคุณหมอวันจันทร์',
            createdAt: Timestamp.now(),
          }),
        },
      ];

      vi.mocked(collections.alarmsRef).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: false, docs: alarmDocs }),
      } as any);

      vi.mocked(collections.remindersRef).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: false, docs: reminderDocs }),
      } as any);

      vi.mocked(collections.notesRef).mockReturnValue({
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: false, docs: noteDocs }),
      } as any);

      const result = await handleListItems('ดูรายการทั้งหมด', '', mockUser);

      expect(result.success).toBe(true);
      expect(result.message).toContain('⏰ นาฬิกาปลุก:');
      expect(result.message).toContain('1. 07:00 — ตื่นนอน (ทุกวัน)');
      expect(result.message).toContain('📋 การเตือน:');
      expect(result.message).toContain('1. กินยาความดัน');
      expect(result.message).toContain('📝 บันทึกล่าสุด:');
      expect(result.message).toContain('1. นัดคุณหมอวันจันทร์');
    });

    it('returns category-specific empty message when a single category is requested and empty', async () => {
      vi.mocked(extractor.classifyItemType).mockResolvedValue({
        itemType: 'alarm',
        confidence: 0.98,
      });

      vi.mocked(collections.alarmsRef).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      } as any);

      const result = await handleListItems('ดูนาฬิกาปลุก', '', mockUser);

      expect(result.success).toBe(true);
      expect(result.message).toBe(LIST_EMPTY_ALARMS_MESSAGE);
    });
  });

  describe('handleDeleteItem', () => {
    it('soft-deletes alarm and cancels linked Cloud Task', async () => {
      vi.mocked(extractor.classifyItemType).mockResolvedValue({
        itemType: 'alarm',
        confidence: 0.96,
      });

      const updateMock = vi.fn().mockResolvedValue(undefined);
      const mockAlarmDoc = {
        id: 'alarm-123',
        ref: { update: updateMock },
        data: () => ({
          time: '07:00',
          label: 'ตื่นนอน',
          cloudTaskName: 'projects/p/locations/l/queues/q/tasks/alarm-task-1',
          enabled: true,
        }),
      };

      vi.mocked(collections.alarmsRef).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: false, docs: [mockAlarmDoc] }),
      } as any);

      const result = await handleDeleteItem('ลบนาฬิกาปลุก 7:00', '', mockUser);

      expect(tasks.cancelScheduledTask).toHaveBeenCalledWith(
        'projects/p/locations/l/queues/q/tasks/alarm-task-1',
      );
      expect(updateMock).toHaveBeenCalledWith({ enabled: false });
      expect(result.success).toBe(true);
      expect(result.message).toContain('ลบนาฬิกาปลุก 07:00');
    });

    it('soft-deletes reminder and cancels linked Cloud Task', async () => {
      vi.mocked(extractor.classifyItemType).mockResolvedValue({
        itemType: 'reminder',
        confidence: 0.97,
      });

      const updateMock = vi.fn().mockResolvedValue(undefined);
      const mockReminderDoc = {
        id: 'reminder-456',
        ref: { update: updateMock },
        data: () => ({
          message: 'กินยาวันนี้',
          cloudTaskName: 'projects/p/locations/l/queues/q/tasks/rem-task-1',
          status: 'pending',
          enabled: true,
        }),
      };

      vi.mocked(collections.remindersRef).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: false, docs: [mockReminderDoc] }),
      } as any);

      const result = await handleDeleteItem('ลบเตือนกินยา', '', mockUser);

      expect(tasks.cancelScheduledTask).toHaveBeenCalledWith(
        'projects/p/locations/l/queues/q/tasks/rem-task-1',
      );
      expect(updateMock).toHaveBeenCalledWith({ status: 'done', enabled: false });
      expect(result.success).toBe(true);
      expect(result.message).toContain('ลบการเตือน "กินยาวันนี้"');
    });

    it('hard-deletes note directly from Firestore', async () => {
      vi.mocked(extractor.classifyItemType).mockResolvedValue({
        itemType: 'note',
        confidence: 0.95,
      });

      const deleteMock = vi.fn().mockResolvedValue(undefined);
      const mockNoteDoc = {
        id: 'note-789',
        ref: { delete: deleteMock },
        data: () => ({
          summary: 'นัดทำฟัน',
          content: 'นัดทำฟันวันศุกร์',
        }),
      };

      vi.mocked(collections.notesRef).mockReturnValue({
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: false, docs: [mockNoteDoc] }),
      } as any);

      const result = await handleDeleteItem('ลบบันทึก', '', mockUser);

      expect(deleteMock).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.message).toContain('ลบบันทึก "นัดทำฟัน"');
    });

    it('returns polite fallback when no item exists to delete', async () => {
      vi.mocked(extractor.classifyItemType).mockResolvedValue({
        itemType: 'alarm',
        confidence: 0.95,
      });

      vi.mocked(collections.alarmsRef).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      } as any);

      const result = await handleDeleteItem('ลบปลุก', '', mockUser);

      expect(result.success).toBe(false);
      expect(result.message).toBe(DELETE_NOT_FOUND_ALARM_MESSAGE);
    });
  });

  describe('executeTool integration', () => {
    it('dispatches list_items intent to handleListItems', async () => {
      vi.mocked(extractor.classifyItemType).mockResolvedValue({
        itemType: 'all',
        confidence: 0.99,
      });

      const emptyQuery = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      };

      vi.mocked(collections.alarmsRef).mockReturnValue(emptyQuery as any);
      vi.mocked(collections.remindersRef).mockReturnValue(emptyQuery as any);
      vi.mocked(collections.notesRef).mockReturnValue(emptyQuery as any);

      const result = await executeTool({
        intent: { intent: 'list_items', confidence: 0.95, isAmbiguous: false },
        userText: 'ดูรายการทั้งหมด',
        user: mockUser,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe(LIST_EMPTY_ALL_MESSAGE);
    });

    it('dispatches delete_item intent to handleDeleteItem', async () => {
      vi.mocked(extractor.classifyItemType).mockResolvedValue({
        itemType: 'reminder',
        confidence: 0.95,
      });

      vi.mocked(collections.remindersRef).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      } as any);

      const result = await executeTool({
        intent: { intent: 'delete_item', confidence: 0.92, isAmbiguous: false },
        userText: 'ลบการเตือน',
        user: mockUser,
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe(DELETE_NOT_FOUND_REMINDER_MESSAGE);
    });
  });
});
