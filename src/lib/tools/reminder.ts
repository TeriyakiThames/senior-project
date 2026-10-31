import { Timestamp } from 'firebase-admin/firestore';
import { remindersRef, pendingActionsRef } from '@/lib/firebase/collections';
import { saveAndScheduleTask } from '@/lib/scheduler/cloud-tasks';
import { extractReminderParams } from '@/lib/ai/parameter-extractor';
import {
  ReminderScheduleCalculator,
  getBangkokComponents,
  parseBangkokDateTime,
} from '@/lib/utils/recurrence';
import { buildReminderConfirmation } from '@/lib/line/flex-messages';
import type { ReminderDoc, PendingActionDoc, UserDoc } from '@/types/firestore';
import type { ReminderParams } from '@/types/jev';
import type { ToolResult } from './index';

export const REMINDER_FALLBACK_MESSAGE =
  "หนูยังไม่ค่อยแน่ใจเรื่องการแจ้งเตือนเลยค่ะ คุณตาคุณยายช่วยบอกสิ่งที่ต้องการให้เตือนและเวลาอีกครั้งได้ไหมคะ เช่น 'เตือนกินยาตอน 6 โมงเย็น' ค่ะ";

export const REMINDER_EXPIRED_OR_NOT_FOUND_MESSAGE =
  'ไม่พบรายการแจ้งเตือนที่รอยืนยัน หรือรายการหมดอายุแล้วค่ะ (รายการมีอายุ 5 นาทีนะคะ) รบกวนบอกหนูใหม่อีกครั้งได้เลยค่ะ';

export interface HandleSetReminderOptions {
  params?: ReminderParams | null;
  now?: Date;
  autoConfirm?: boolean;
}

export interface HandleConfirmReminderOptions {
  now?: Date;
  pendingDoc?: PendingActionDoc | null;
}

export interface HandleUpdateReminderTimeOptions {
  now?: Date;
}

/**
 * Calculates the next trigger timestamp for a reminder using ReminderScheduleCalculator.
 */
export function calculateReminderFireTime(
  params: Partial<ReminderParams>,
  now: Date = new Date(),
): Date | null {
  return new ReminderScheduleCalculator(params, now).calculateNextFireTime();
}

/**
 * Formats a Date into LINE datetimepicker's YYYY-MM-DDTHH:mm format in Asia/Bangkok.
 */
function toLineDatetimeString(date: Date): string {
  const bkk = getBangkokComponents(date);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${bkk.year}-${pad(bkk.month)}-${pad(bkk.day)}T${pad(bkk.hours)}:${pad(bkk.minutes)}`;
}

/**
 * Formats a Date into a friendly Thai time string in Asia/Bangkok.
 */
function toThaiTimeString(date: Date): string {
  const bkk = getBangkokComponents(date);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(bkk.hours)}:${pad(bkk.minutes)} น.`;
}

/**
 * Handles reminder creation:
 * - If options.autoConfirm is true: immediately schedules and saves the reminder.
 * - Otherwise (default): stores a 5-minute pending draft in users/{userId}/pendingActions/current
 *   and returns an interactive Flex confirmation card with [✓ ยืนยัน] and [✏️ เปลี่ยนเวลา] (LINE datetime picker).
 */
export async function handleSetReminder(
  userText: string,
  _geminiResponse: string,
  user: UserDoc,
  options?: HandleSetReminderOptions,
): Promise<ToolResult> {
  const now = options?.now ?? new Date();
  const params =
    options?.params !== undefined ? options.params : await extractReminderParams(userText, { now });

  if (!params || !params.message || !params.message.trim()) {
    return {
      success: false,
      message: REMINDER_FALLBACK_MESSAGE,
    };
  }

  const fireAt = calculateReminderFireTime(params, now);
  if (!fireAt) {
    return {
      success: false,
      message: REMINDER_FALLBACK_MESSAGE,
    };
  }

  const cleanMessage = params.message.trim();
  const timeStr = toThaiTimeString(fireAt);
  const initialDatetime = toLineDatetimeString(fireAt);

  // Auto-confirm flow (if explicitly requested by caller)
  if (options?.autoConfirm) {
    const reminderData: ReminderDoc = {
      message: cleanMessage,
      scheduledAt: Timestamp.fromDate(fireAt),
      recurrence: params.recurrence ?? 'once',
      enabled: true,
      nextFireAt: Timestamp.fromDate(fireAt),
      status: 'pending',
      createdAt: Timestamp.now(),
    };

    if (params.daysOfWeek !== undefined) {
      reminderData.daysOfWeek = params.daysOfWeek;
    }
    if (params.dayOfMonth !== undefined) {
      reminderData.dayOfMonth = params.dayOfMonth;
    }

    try {
      const { docRef, taskName } = await saveAndScheduleTask({
        collectionRef: remindersRef(user.lineUserId),
        data: reminderData,
        schedule: {
          userId: user.lineUserId,
          itemType: 'reminder',
          fireAt,
        },
      });

      return {
        success: true,
        message: `ตั้งเตือน "${cleanMessage}" เวลา ${timeStr} เรียบร้อยแล้วค่ะ`,
        data: {
          reminderId: docRef.id,
          cloudTaskName: taskName,
          scheduledAt: fireAt.toISOString(),
          nextFireAt: fireAt.toISOString(),
          time: timeStr,
        },
      };
    } catch (error) {
      console.error('[ReminderTool] Error creating reminder:', error);
      return {
        success: false,
        message: 'เกิดข้อผิดพลาดในการตั้งเตือน กรุณาลองใหม่อีกครั้งค่ะ',
      };
    }
  }

  // Interactive pre-confirmation draft flow (Ticket LINE-07)
  const expiresAtDate = new Date(now.getTime() + 5 * 60 * 1000);
  const pendingReminderData: Record<string, unknown> = {
    message: cleanMessage,
    scheduledAt: fireAt.toISOString(),
    recurrence: params.recurrence ?? 'once',
  };

  if (params.daysOfWeek !== undefined) {
    pendingReminderData.daysOfWeek = params.daysOfWeek;
  }
  if (params.dayOfMonth !== undefined) {
    pendingReminderData.dayOfMonth = params.dayOfMonth;
  }

  const pendingData: PendingActionDoc = {
    type: 'confirm_reminder',
    data: pendingReminderData,
    expiresAt: Timestamp.fromDate(expiresAtDate),
  };

  try {
    const pendingRef = pendingActionsRef(user.lineUserId).doc('current');
    await pendingRef.set(pendingData);

    const flexMessage = buildReminderConfirmation(cleanMessage, timeStr, initialDatetime);

    return {
      success: true,
      flexMessage,
      data: {
        message: cleanMessage,
        scheduledAt: fireAt.toISOString(),
        time: timeStr,
        expiresAt: expiresAtDate.toISOString(),
      },
    };
  } catch (error) {
    console.error('[ReminderTool] Error creating pending reminder draft:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการเตรียมตั้งเตือน กรุณาลองใหม่อีกครั้งค่ะ',
    };
  }
}

/**
 * Handles explicit confirmation of a pending reminder: validates expiration (5 min),
 * commits ReminderDoc to Firestore, enqueues Cloud Task via saveAndScheduleTask,
 * and clears the pending draft.
 */
export async function handleConfirmReminder(
  user: UserDoc,
  options?: HandleConfirmReminderOptions,
): Promise<ToolResult> {
  const now = options?.now ?? new Date();
  const pendingRef = pendingActionsRef(user.lineUserId).doc('current');

  try {
    let data: PendingActionDoc | null = null;
    if (options?.pendingDoc !== undefined) {
      data = options.pendingDoc;
      if (!data) {
        return {
          success: false,
          message: REMINDER_EXPIRED_OR_NOT_FOUND_MESSAGE,
        };
      }
    } else {
      const snap = await pendingRef.get();
      if (!snap.exists) {
        return {
          success: false,
          message: REMINDER_EXPIRED_OR_NOT_FOUND_MESSAGE,
        };
      }
      data = snap.data() as PendingActionDoc;
    }

    if (data.type !== 'confirm_reminder' || !data.data) {
      return {
        success: false,
        message: REMINDER_EXPIRED_OR_NOT_FOUND_MESSAGE,
      };
    }

    // Check expiration (5 minutes expiry)
    if (data.expiresAt && data.expiresAt.toMillis() <= now.getTime()) {
      await pendingRef.delete();
      return {
        success: false,
        message: REMINDER_EXPIRED_OR_NOT_FOUND_MESSAGE,
      };
    }

    const draft = data.data as {
      message: string;
      scheduledAt: string;
      recurrence?: string;
      daysOfWeek?: number[];
      dayOfMonth?: number;
    };

    if (
      !draft ||
      typeof draft.message !== 'string' ||
      !draft.message.trim() ||
      !draft.scheduledAt
    ) {
      return {
        success: false,
        message: REMINDER_EXPIRED_OR_NOT_FOUND_MESSAGE,
      };
    }

    let fireAt = parseBangkokDateTime(draft.scheduledAt);
    if (!fireAt || isNaN(fireAt.getTime()) || fireAt.getTime() <= now.getTime()) {
      const recalculated = calculateReminderFireTime(
        {
          scheduledAt: draft.scheduledAt,
          recurrence: draft.recurrence as any,
          daysOfWeek: draft.daysOfWeek,
          dayOfMonth: draft.dayOfMonth,
        },
        now,
      );
      if (recalculated) {
        fireAt = recalculated;
      }
    }

    if (!fireAt) {
      return {
        success: false,
        message: 'ไม่สามารถระบุเวลาแจ้งเตือนที่ถูกต้องได้ค่ะ',
      };
    }

    const reminderData: ReminderDoc = {
      message: draft.message,
      scheduledAt: Timestamp.fromDate(fireAt),
      recurrence: (draft.recurrence as any) ?? 'once',
      enabled: true,
      nextFireAt: Timestamp.fromDate(fireAt),
      status: 'pending',
      createdAt: Timestamp.now(),
    };

    if (draft.daysOfWeek !== undefined) {
      reminderData.daysOfWeek = draft.daysOfWeek;
    }
    if (draft.dayOfMonth !== undefined) {
      reminderData.dayOfMonth = draft.dayOfMonth;
    }

    const { docRef, taskName } = await saveAndScheduleTask({
      collectionRef: remindersRef(user.lineUserId),
      data: reminderData,
      schedule: {
        userId: user.lineUserId,
        itemType: 'reminder',
        fireAt,
      },
    });

    await pendingRef.delete();

    const timeStr = toThaiTimeString(fireAt);
    return {
      success: true,
      message: `ตั้งเตือน "${draft.message}" เวลา ${timeStr} เรียบร้อยแล้วค่ะ`,
      data: {
        reminderId: docRef.id,
        cloudTaskName: taskName,
        scheduledAt: fireAt.toISOString(),
        nextFireAt: fireAt.toISOString(),
        time: timeStr,
      },
    };
  } catch (error) {
    console.error('[ReminderTool] Error confirming reminder:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการตั้งเตือน กรุณาลองใหม่อีกครั้งค่ะ',
    };
  }
}

/**
 * Handles updating the scheduled time of a pending reminder when the user selects
 * a new date/time via LINE's native datetime picker.
 */
export async function handleUpdatePendingReminderTime(
  user: UserDoc,
  newDatetimeIso: string,
  options?: HandleUpdateReminderTimeOptions,
): Promise<ToolResult> {
  const now = options?.now ?? new Date();
  const pendingRef = pendingActionsRef(user.lineUserId).doc('current');

  try {
    const snap = await pendingRef.get();
    if (!snap.exists) {
      return {
        success: false,
        message: REMINDER_EXPIRED_OR_NOT_FOUND_MESSAGE,
      };
    }

    const data = snap.data() as PendingActionDoc;
    if (data.type !== 'confirm_reminder' || !data.data) {
      return {
        success: false,
        message: REMINDER_EXPIRED_OR_NOT_FOUND_MESSAGE,
      };
    }

    const draft = data.data as {
      message: string;
      scheduledAt: string;
      recurrence?: string;
      daysOfWeek?: number[];
      dayOfMonth?: number;
    };

    if (
      !draft ||
      typeof draft.message !== 'string' ||
      !draft.message.trim() ||
      !draft.scheduledAt
    ) {
      return {
        success: false,
        message: REMINDER_EXPIRED_OR_NOT_FOUND_MESSAGE,
      };
    }

    // Calculate new target fire time from chosen datetime picker value
    const targetDate = parseBangkokDateTime(newDatetimeIso);
    const fireAt =
      targetDate && !isNaN(targetDate.getTime())
        ? targetDate
        : new Date(now.getTime() + 10 * 60 * 1000);

    const expiresAtDate = new Date(now.getTime() + 5 * 60 * 1000);
    const updatedData: Record<string, unknown> = {
      message: draft.message.trim(),
      scheduledAt: fireAt.toISOString(),
      recurrence: draft.recurrence ?? 'once',
    };
    if (draft.daysOfWeek !== undefined) {
      updatedData.daysOfWeek = draft.daysOfWeek;
    }
    if (draft.dayOfMonth !== undefined) {
      updatedData.dayOfMonth = draft.dayOfMonth;
    }

    const updatedPendingData: PendingActionDoc = {
      type: 'confirm_reminder',
      data: updatedData,
      expiresAt: Timestamp.fromDate(expiresAtDate),
    };

    await pendingRef.set(updatedPendingData);

    const timeStr = toThaiTimeString(fireAt);
    const initialDatetime = toLineDatetimeString(fireAt);
    const flexMessage = buildReminderConfirmation(draft.message, timeStr, initialDatetime);

    return {
      success: true,
      flexMessage,
      data: {
        message: draft.message,
        scheduledAt: fireAt.toISOString(),
        time: timeStr,
      },
    };
  } catch (error) {
    console.error('[ReminderTool] Error updating pending reminder time:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการเปลี่ยนเวลา กรุณาลองใหม่อีกครั้งค่ะ',
    };
  }
}
