import { alarmsRef, remindersRef, notesRef } from '@/lib/firebase/collections';
import { cancelScheduledTask } from '@/lib/scheduler/cloud-tasks';
import {
  classifyItemType,
  type ItemType,
  type ClassifyItemTypeOptions,
} from '@/lib/ai/parameter-extractor';
import type { AlarmDoc, ReminderDoc, NoteDoc, UserDoc } from '@/types/firestore';
import type { ToolResult } from './index';

export const DELETE_NOT_FOUND_ALARM_MESSAGE = 'ไม่พบนาฬิกาปลุกที่จะลบค่ะ คุณตาคุณยาย';
export const DELETE_NOT_FOUND_REMINDER_MESSAGE = 'ไม่พบการเตือนที่จะลบค่ะ คุณตาคุณยาย';
export const DELETE_NOT_FOUND_NOTE_MESSAGE = 'ไม่พบบันทึกที่จะลบค่ะ คุณตาคุณยาย';
export const DELETE_AMBIGUOUS_FALLBACK_MESSAGE =
  'หนูยังไม่แน่ใจว่าคุณตาคุณยายต้องการให้ลบรายการไหนค่ะ รบกวนบอกเพิ่มเติมได้ไหมคะ เช่น "ลบนาฬิกาปลุก 7 โมง" หรือ "ลบการเตือนกินยา" ค่ะ';

export interface HandleDeleteItemOptions {
  itemType?: ItemType;
  classifyOptions?: ClassifyItemTypeOptions;
  cancelTaskFn?: (taskName: string) => Promise<void>;
}

/**
 * Handles deletion of alarms, reminders, and notes.
 * - Soft-deletes alarms (enabled: false) and cancels linked Cloud Tasks.
 * - Soft-deletes reminders (status: 'done', enabled: false) and cancels linked Cloud Tasks.
 * - Hard-deletes notes from Firestore.
 * Matches by keyword/time if specified, otherwise targets the most recent active item.
 */
export async function handleDeleteItem(
  userText: string,
  geminiResponse: string = '',
  user: UserDoc,
  options?: HandleDeleteItemOptions,
): Promise<ToolResult> {
  const itemType: ItemType =
    options?.itemType ??
    (await classifyItemType(userText, geminiResponse, options?.classifyOptions)).itemType;

  const uid = user.lineUserId;
  const cancelTask = options?.cancelTaskFn ?? cancelScheduledTask;
  const normalizedUserText = userText.toLowerCase().trim();

  if (itemType === 'alarm') {
    let snapDocs: FirebaseFirestore.QueryDocumentSnapshot[];
    try {
      const snap = await alarmsRef(uid)
        .where('enabled', '==', true)
        .orderBy('createdAt', 'desc')
        .get();
      snapDocs = snap.docs;
    } catch (err: unknown) {
      const error = err as { code?: number; message?: string };
      if (
        error?.code === 9 ||
        error?.message?.includes('FAILED_PRECONDITION') ||
        error?.message?.includes('requires an index')
      ) {
        console.warn(
          '[DeleteItem] Missing composite index for alarms; falling back to in-memory sort',
        );
        const snap = await alarmsRef(uid).where('enabled', '==', true).get();
        snapDocs = [...snap.docs].sort((a, b) => {
          const tA = (a.data() as AlarmDoc).createdAt?.toMillis?.() ?? 0;
          const tB = (b.data() as AlarmDoc).createdAt?.toMillis?.() ?? 0;
          return tB - tA;
        });
      } else {
        throw err;
      }
    }

    if (snapDocs.length === 0) {
      return {
        success: false,
        message: DELETE_NOT_FOUND_ALARM_MESSAGE,
      };
    }

    // Try finding an alarm matching time or label mentioned in user text
    let targetDoc = snapDocs[0];
    for (const doc of snapDocs) {
      const d = doc.data() as AlarmDoc;
      const timeClean = d.time.replace(/^0/, ''); // "07:00" -> "7:00"
      if (
        normalizedUserText.includes(d.time) ||
        normalizedUserText.includes(timeClean) ||
        (d.label && normalizedUserText.includes(d.label.toLowerCase()))
      ) {
        targetDoc = doc;
        break;
      }
    }

    const data = targetDoc.data() as AlarmDoc;
    if (data.cloudTaskName) {
      try {
        await cancelTask(data.cloudTaskName);
      } catch (err) {
        console.error('[DeleteItem] Error cancelling alarm cloud task:', err);
      }
    }

    await targetDoc.ref.update({ enabled: false });

    const labelPart = data.label ? ` (${data.label})` : '';
    return {
      success: true,
      message: `ลบนาฬิกาปลุก ${data.time}${labelPart} เรียบร้อยแล้วค่ะ ⏰`,
      data: {
        id: targetDoc.id,
        itemType: 'alarm',
        time: data.time,
      },
    };
  }

  if (itemType === 'reminder') {
    let snapDocs: FirebaseFirestore.QueryDocumentSnapshot[];
    try {
      const snap = await remindersRef(uid)
        .where('status', 'in', ['pending', 'snoozed'])
        .orderBy('createdAt', 'desc')
        .get();
      snapDocs = snap.docs;
    } catch (err: unknown) {
      const error = err as { code?: number; message?: string };
      if (
        error?.code === 9 ||
        error?.message?.includes('FAILED_PRECONDITION') ||
        error?.message?.includes('requires an index')
      ) {
        console.warn(
          '[DeleteItem] Missing composite index for reminders; falling back to in-memory sort',
        );
        const snap = await remindersRef(uid).where('status', 'in', ['pending', 'snoozed']).get();
        snapDocs = [...snap.docs].sort((a, b) => {
          const tA = (a.data() as ReminderDoc).createdAt?.toMillis?.() ?? 0;
          const tB = (b.data() as ReminderDoc).createdAt?.toMillis?.() ?? 0;
          return tB - tA;
        });
      } else {
        throw err;
      }
    }

    if (snapDocs.length === 0) {
      return {
        success: false,
        message: DELETE_NOT_FOUND_REMINDER_MESSAGE,
      };
    }

    // Try finding a reminder matching message keyword mentioned in user text
    let targetDoc = snapDocs[0];
    for (const doc of snapDocs) {
      const d = doc.data() as ReminderDoc;
      if (d.message && normalizedUserText.includes(d.message.toLowerCase())) {
        targetDoc = doc;
        break;
      }
    }

    const data = targetDoc.data() as ReminderDoc;
    if (data.cloudTaskName) {
      try {
        await cancelTask(data.cloudTaskName);
      } catch (err) {
        console.error('[DeleteItem] Error cancelling reminder cloud task:', err);
      }
    }

    await targetDoc.ref.update({
      status: 'done',
      enabled: false,
    });

    return {
      success: true,
      message: `ลบการเตือน "${data.message}" เรียบร้อยแล้วค่ะ 📋`,
      data: {
        id: targetDoc.id,
        itemType: 'reminder',
        message: data.message,
      },
    };
  }

  if (itemType === 'note') {
    const snap = await notesRef(uid).orderBy('createdAt', 'desc').get();

    if (snap.empty) {
      return {
        success: false,
        message: DELETE_NOT_FOUND_NOTE_MESSAGE,
      };
    }

    // Try finding a note matching summary or content mentioned in user text
    let targetDoc = snap.docs[0];
    for (const doc of snap.docs) {
      const d = doc.data() as NoteDoc;
      if (
        (d.summary && normalizedUserText.includes(d.summary.toLowerCase())) ||
        (d.content && normalizedUserText.includes(d.content.toLowerCase()))
      ) {
        targetDoc = doc;
        break;
      }
    }

    const data = targetDoc.data() as NoteDoc;
    await targetDoc.ref.delete();

    const noteTitle = data.summary || data.content;
    return {
      success: true,
      message: `ลบบันทึก "${noteTitle}" เรียบร้อยแล้วค่ะ 📝`,
      data: {
        id: targetDoc.id,
        itemType: 'note',
      },
    };
  }

  return {
    success: false,
    message: DELETE_AMBIGUOUS_FALLBACK_MESSAGE,
  };
}
