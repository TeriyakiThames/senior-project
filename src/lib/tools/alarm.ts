import { Timestamp } from 'firebase-admin/firestore';
import { alarmsRef } from '@/lib/firebase/collections';
import { scheduleNotification } from '@/lib/scheduler/cloud-tasks';
import { extractAlarmParams } from '@/lib/ai/parameter-extractor';
import { createBangkokDate, getBangkokComponents, getDaysInMonth } from '@/lib/utils/recurrence';
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
 * Calculates the next trigger timestamp in Asia/Bangkok for an alarm.
 * If the target time has already passed today, it rolls over to tomorrow
 * (or the next matching weekday/day-of-month if recurrence specifies).
 */
export function calculateAlarmFireTime(params: AlarmParams, now: Date = new Date()): Date | null {
  if (!params.time) {
    return null;
  }

  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(params.time.trim());
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  const nowBkk = getBangkokComponents(now);
  const candidateToday = createBangkokDate(
    nowBkk.year,
    nowBkk.month,
    nowBkk.day,
    hours,
    minutes,
    0,
    0,
  );

  if (params.recurrence === 'weekly') {
    const targetDays =
      params.daysOfWeek && params.daysOfWeek.length > 0
        ? params.daysOfWeek.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        : [nowBkk.dayOfWeek];

    if (targetDays.length === 0) {
      return null;
    }

    // Check if today matches target day of week and time has not passed yet
    if (targetDays.includes(nowBkk.dayOfWeek) && candidateToday.getTime() > now.getTime()) {
      return candidateToday;
    }

    // Otherwise, check the next 7 days for the closest matching day of week
    for (let i = 1; i <= 7; i++) {
      const candidate = createBangkokDate(
        nowBkk.year,
        nowBkk.month,
        nowBkk.day + i,
        hours,
        minutes,
        0,
        0,
      );
      const candidateBkk = getBangkokComponents(candidate);
      if (targetDays.includes(candidateBkk.dayOfWeek)) {
        return candidate;
      }
    }

    return null;
  }

  if (params.recurrence === 'monthly') {
    const targetDay = params.dayOfMonth ?? nowBkk.day;

    if (nowBkk.day === targetDay && candidateToday.getTime() > now.getTime()) {
      return candidateToday;
    }

    let nextYear = nowBkk.year;
    let nextMonth = nowBkk.month + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear++;
    }

    const maxDays = getDaysInMonth(nextYear, nextMonth);
    const clampedDay = Math.min(Math.max(1, targetDay), maxDays);

    return createBangkokDate(nextYear, nextMonth, clampedDay, hours, minutes, 0, 0);
  }

  // Recurrence 'once' or 'daily'
  if (candidateToday.getTime() > now.getTime()) {
    return candidateToday;
  }

  // Target time already passed today; schedule for tomorrow
  return createBangkokDate(nowBkk.year, nowBkk.month, nowBkk.day + 1, hours, minutes, 0, 0);
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
    recurrence: params.recurrence,
    enabled: true,
    nextFireAt: Timestamp.fromDate(fireAt),
    createdAt: Timestamp.now(),
  };

  if (params.label !== undefined) {
    alarmData.label = params.label;
  }
  if (params.daysOfWeek !== undefined) {
    alarmData.daysOfWeek = params.daysOfWeek;
  }
  if (params.dayOfMonth !== undefined) {
    alarmData.dayOfMonth = params.dayOfMonth;
  }

  try {
    const docRef = await alarmsRef(user.lineUserId).add(alarmData);

    const taskName = await scheduleNotification({
      userId: user.lineUserId,
      itemId: docRef.id,
      itemType: 'alarm',
      fireAt,
    });

    await docRef.update({ cloudTaskName: taskName });

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
