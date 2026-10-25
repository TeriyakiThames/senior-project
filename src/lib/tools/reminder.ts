import { Timestamp } from 'firebase-admin/firestore';
import { remindersRef } from '@/lib/firebase/collections';
import { saveAndScheduleTask } from '@/lib/scheduler/cloud-tasks';
import { extractReminderParams } from '@/lib/ai/parameter-extractor';
import { ReminderScheduleCalculator, getBangkokComponents } from '@/lib/utils/recurrence';
import type { ReminderDoc, UserDoc } from '@/types/firestore';
import type { ReminderParams } from '@/types/jev';
import type { ToolResult } from './index';

export const REMINDER_FALLBACK_MESSAGE =
  "หนูยังไม่ค่อยแน่ใจเรื่องการแจ้งเตือนเลยค่ะ คุณตาคุณยายช่วยบอกสิ่งที่ต้องการให้เตือนและเวลาอีกครั้งได้ไหมคะ เช่น 'เตือนกินยาตอน 6 โมงเย็น' ค่ะ";

export interface HandleSetReminderOptions {
  params?: ReminderParams | null;
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
 * Handles reminder creation: extracts parameters (or accepts pre-parsed params),
 * rolls overdue times forward by 24 hours (or next recurrence cycle), saves
 * ReminderDoc under users/{userId}/reminders with status: 'pending', queues a
 * Cloud Task, and records cloudTaskName.
 */
export async function handleSetReminder(
  userText: string,
  _geminiResponse: string,
  user: UserDoc,
  options?: HandleSetReminderOptions,
): Promise<ToolResult> {
  const params =
    options?.params !== undefined
      ? options.params
      : await extractReminderParams(userText, { now: options?.now });

  if (!params || !params.message || !params.message.trim()) {
    return {
      success: false,
      message: REMINDER_FALLBACK_MESSAGE,
    };
  }

  const fireAt = calculateReminderFireTime(params, options?.now ?? new Date());
  if (!fireAt) {
    return {
      success: false,
      message: REMINDER_FALLBACK_MESSAGE,
    };
  }

  const reminderData: ReminderDoc = {
    message: params.message.trim(),
    scheduledAt: Timestamp.fromDate(fireAt),
    recurrence: params.recurrence,
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

    const fireBkk = getBangkokComponents(fireAt);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timeStr = `${pad(fireBkk.hours)}:${pad(fireBkk.minutes)}`;
    const message = `ตั้งเตือน "${params.message.trim()}" เวลา ${timeStr} น. เรียบร้อยแล้วค่ะ`;

    return {
      success: true,
      message,
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
