import { Timestamp } from 'firebase-admin/firestore';
import { alarmsRef } from '@/lib/firebase/collections';
import { saveAndScheduleTask } from '@/lib/scheduler/cloud-tasks';
import { extractAlarmParams } from '@/lib/ai/parameter-extractor';
import { AlarmScheduleCalculator } from '@/lib/utils/recurrence';
import type { AlarmDoc, UserDoc } from '@/types/firestore';
import type { AlarmParams } from '@/types/jev';
import type { ToolResult } from './index';

export const ALARM_FALLBACK_MESSAGE =
  "หนูยังไม่ค่อยแน่ใจเรื่องเวลาปลุกเลยค่ะ คุณตาคุณยายช่วยบอกเวลาใหม่อีกครั้งได้ไหมคะ เช่น 'ตั้งปลุก 7 โมงเช้า' ค่ะ";

export interface HandleSetAlarmOptions {
  params?: AlarmParams | null;
  now?: Date;
}

/**
 * Calculates the next trigger timestamp in Asia/Bangkok for an alarm using AlarmScheduleCalculator.
 */
export function calculateAlarmFireTime(params: AlarmParams, now: Date = new Date()): Date | null {
  return new AlarmScheduleCalculator(params, now).calculateNextFireTime();
}

/**
 * Handles alarm creation: extracts parameters (or accepts pre-parsed params),
 * computes next fire time in Asia/Bangkok, saves AlarmDoc to Firestore,
 * and enqueues a Cloud Task targeting /api/notify.
 */
export async function handleSetAlarm(
  userText: string,
  _geminiResponse: string,
  user: UserDoc,
  options?: HandleSetAlarmOptions,
): Promise<ToolResult> {
  const params =
    options?.params !== undefined ? options.params : await extractAlarmParams(userText);

  if (!params || !params.time) {
    return {
      success: false,
      message: ALARM_FALLBACK_MESSAGE,
    };
  }

  const fireAt = calculateAlarmFireTime(params, options?.now ?? new Date());
  if (!fireAt) {
    return {
      success: false,
      message: ALARM_FALLBACK_MESSAGE,
    };
  }

  const alarmData: AlarmDoc = {
    time: params.time,
    recurrence: params.recurrence ?? 'once',
    enabled: true,
    nextFireAt: Timestamp.fromDate(fireAt),
    createdAt: Timestamp.now(),
  };

  if (params.label !== undefined && params.label.trim()) {
    alarmData.label = params.label.trim();
  }
  if (params.daysOfWeek !== undefined) {
    alarmData.daysOfWeek = params.daysOfWeek;
  }
  if (params.dayOfMonth !== undefined) {
    alarmData.dayOfMonth = params.dayOfMonth;
  }

  try {
    const { docRef, taskName } = await saveAndScheduleTask({
      collectionRef: alarmsRef(user.lineUserId),
      data: alarmData,
      schedule: {
        userId: user.lineUserId,
        itemType: 'alarm',
        fireAt,
      },
    });

    const labelSuffix = params.label ? ` "${params.label}"` : '';
    const message = `ตั้งปลุก${labelSuffix} เวลา ${params.time} น. เรียบร้อยแล้วค่ะ`;

    return {
      success: true,
      message,
      data: {
        alarmId: docRef.id,
        cloudTaskName: taskName,
        nextFireAt: fireAt.toISOString(),
        time: params.time,
      },
    };
  } catch (error) {
    console.error('[AlarmTool] Error creating alarm:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการตั้งปลุก กรุณาลองใหม่อีกครั้งค่ะ',
    };
  }
}
