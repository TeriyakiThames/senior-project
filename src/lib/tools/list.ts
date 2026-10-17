import { alarmsRef, remindersRef, notesRef } from '@/lib/firebase/collections';
import {
  classifyItemType,
  type ItemType,
  type ClassifyItemTypeOptions,
} from '@/lib/ai/parameter-extractor';
import type { AlarmDoc, ReminderDoc, NoteDoc, UserDoc } from '@/types/firestore';
import type { ToolResult } from './index';

export const LIST_EMPTY_ALL_MESSAGE = 'ตอนนี้ยังไม่มีรายการใดๆ เลยค่ะ คุณตาคุณยาย';
export const LIST_EMPTY_ALARMS_MESSAGE = 'ตอนนี้ยังไม่มีนาฬิกาปลุกที่ตั้งไว้ค่ะ คุณตาคุณยาย';
export const LIST_EMPTY_REMINDERS_MESSAGE = 'ตอนนี้ยังไม่มีการเตือนที่ตั้งไว้ค่ะ คุณตาคุณยาย';
export const LIST_EMPTY_NOTES_MESSAGE = 'ตอนนี้ยังไม่มีบันทึกข้อความค่ะ คุณตาคุณยาย';

export interface HandleListItemsOptions {
  itemType?: ItemType;
  classifyOptions?: ClassifyItemTypeOptions;
}

function formatRecurrence(rec?: string): string {
  if (!rec || rec === 'once') return '';
  switch (rec) {
    case 'daily':
      return ' (ทุกวัน)';
    case 'weekly':
      return ' (ทุกสัปดาห์)';
    case 'monthly':
      return ' (ทุกเดือน)';
    default:
      return ` (${rec})`;
  }
}

function formatReminderTime(date?: Date): string {
  if (!date || isNaN(date.getTime())) return '';
  return date.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Handles listing active alarms, pending reminders, and recent notes.
 * Formats results into senior-friendly Thai text with emoji category indicators.
 */
export async function handleListItems(
  userText: string,
  geminiResponse: string = '',
  user: UserDoc,
  options?: HandleListItemsOptions,
): Promise<ToolResult> {
  const itemType: ItemType =
    options?.itemType ??
    (await classifyItemType(userText, geminiResponse, options?.classifyOptions)).itemType;

  const uid = user.lineUserId;
  const sections: string[] = [];

  let hasAlarmItems = false;
  let hasReminderItems = false;
  let hasNoteItems = false;

  if (itemType === 'alarm' || itemType === 'all') {
    const snap = await alarmsRef(uid).where('enabled', '==', true).limit(5).get();
    if (!snap.empty) {
      hasAlarmItems = true;
      const lines = ['⏰ นาฬิกาปลุก:'];
      snap.docs.forEach((doc, i) => {
        const d = doc.data() as AlarmDoc;
        const recLabel = formatRecurrence(d.recurrence);
        const labelPart = d.label ? ` — ${d.label}` : '';
        lines.push(`  ${i + 1}. ${d.time}${labelPart}${recLabel}`);
      });
      sections.push(lines.join('\n'));
    } else if (itemType === 'alarm') {
      return {
        success: true,
        message: LIST_EMPTY_ALARMS_MESSAGE,
      };
    }
  }

  if (itemType === 'reminder' || itemType === 'all') {
    const snap = await remindersRef(uid)
      .where('status', 'in', ['pending', 'snoozed'])
      .limit(5)
      .get();
    if (!snap.empty) {
      hasReminderItems = true;
      const lines = ['📋 การเตือน:'];
      snap.docs.forEach((doc, i) => {
        const d = doc.data() as ReminderDoc;
        const fireDate = d.nextFireAt?.toDate?.() ?? d.scheduledAt?.toDate?.();
        const timeStr = formatReminderTime(fireDate);
        const timePart = timeStr ? ` — ${timeStr}` : '';
        lines.push(`  ${i + 1}. ${d.message}${timePart}`);
      });
      sections.push(lines.join('\n'));
    } else if (itemType === 'reminder') {
      return {
        success: true,
        message: LIST_EMPTY_REMINDERS_MESSAGE,
      };
    }
  }

  if (itemType === 'note' || itemType === 'all') {
    const snap = await notesRef(uid).orderBy('createdAt', 'desc').limit(5).get();
    if (!snap.empty) {
      hasNoteItems = true;
      const lines = ['📝 บันทึกล่าสุด:'];
      snap.docs.forEach((doc, i) => {
        const d = doc.data() as NoteDoc;
        const summaryText = d.summary?.trim() || d.content?.trim();
        lines.push(`  ${i + 1}. ${summaryText}`);
      });
      sections.push(lines.join('\n'));
    } else if (itemType === 'note') {
      return {
        success: true,
        message: LIST_EMPTY_NOTES_MESSAGE,
      };
    }
  }

  if (itemType === 'all' && !hasAlarmItems && !hasReminderItems && !hasNoteItems) {
    return {
      success: true,
      message: LIST_EMPTY_ALL_MESSAGE,
    };
  }

  return {
    success: true,
    message: sections.join('\n\n'),
  };
}
