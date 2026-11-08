import { Timestamp } from 'firebase-admin/firestore';
import { timersRef } from '@/lib/firebase/collections';
import { saveAndScheduleTask, cancelScheduledTask } from '@/lib/scheduler/cloud-tasks';
import { extractTimerParams } from '@/lib/ai/parameter-extractor';
import { buildTimerConfirmationCard } from '@/lib/line/flex-messages';
import { isValidDocumentId } from '@/lib/utils/security';
import type { TimerDoc, UserDoc } from '@/types/firestore';
import type { TimerParams } from '@/types/jev';
import type { ToolResult } from './index';

export const TIMER_FALLBACK_MESSAGE =
  "หนูยังไม่ค่อยแน่ใจเรื่องเวลาเลยค่ะ คุณตาคุณยายช่วยบอกเวลาเป็นนาทีหรือชั่วโมงได้ไหมคะ เช่น 'จับเวลา 15 นาที' หรือ 'ตั้งเวลา 1 ชั่วโมง' ค่ะ";

export interface HandleSetTimerOptions {
  params?: TimerParams | null;
  now?: Date;
}

/**
 * Calculates the trigger timestamp for a timer based on duration in minutes.
 */
export function calculateTimerFireTime(totalMinutes: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + totalMinutes * 60 * 1000);
}

/**
 * Formats duration in hours and minutes into polite Thai text.
 */
export function formatTimerDurationThai(
  hours?: number,
  minutes?: number,
  totalMinutes?: number,
): string {
  const h = hours ?? (totalMinutes ? Math.floor(totalMinutes / 60) : 0);
  const m = minutes ?? (totalMinutes ? totalMinutes % 60 : 0);

  if (h > 0 && m > 0) {
    return `${h} ชั่วโมง ${m} นาที`;
  }
  if (h > 0) {
    return `${h} ชั่วโมง`;
  }
  return `${m || totalMinutes || 0} นาที`;
}

/**
 * Handles timer creation: extracts parameters (or accepts pre-parsed params),
 * computes fire time, saves TimerDoc to Firestore, and enqueues a Cloud Task targeting /api/notify.
 */
export async function handleSetTimer(
  userText: string,
  _geminiResponse: string,
  user: UserDoc,
  options?: HandleSetTimerOptions,
): Promise<ToolResult> {
  const params =
    options?.params !== undefined ? options.params : await extractTimerParams(userText);

  if (!params || !params.totalMinutes || params.totalMinutes <= 0) {
    return {
      success: false,
      message: TIMER_FALLBACK_MESSAGE,
    };
  }

  const currentTime = options?.now ?? new Date();
  const fireAt = calculateTimerFireTime(params.totalMinutes, currentTime);

  const timerData: TimerDoc = {
    durationMinutes: params.totalMinutes,
    hours: params.hours ?? Math.floor(params.totalMinutes / 60),
    minutes: params.minutes ?? params.totalMinutes % 60,
    enabled: true,
    status: 'pending',
    nextFireAt: Timestamp.fromDate(fireAt),
    createdAt: Timestamp.now(),
  };

  if (params.label !== undefined && params.label.trim()) {
    timerData.label = params.label.trim();
  }

  try {
    const { docRef, taskName } = await saveAndScheduleTask({
      collectionRef: timersRef(user.lineUserId),
      data: timerData,
      schedule: {
        userId: user.lineUserId,
        itemType: 'timer',
        fireAt,
      },
    });

    const durationText = formatTimerDurationThai(params.hours, params.minutes, params.totalMinutes);
    const labelPrefix = params.label ? ` "${params.label}"` : '';
    const message = `ตั้งตัวจับเวลา${labelPrefix} ${durationText} เรียบร้อยแล้วค่ะ ⏱️`;

    const flexMessage = buildTimerConfirmationCard({
      durationText,
      fireAt,
      timerId: docRef.id,
      label: params.label,
    });

    return {
      success: true,
      message,
      flexMessage: flexMessage as unknown as Record<string, unknown>,
      data: {
        timerId: docRef.id,
        cloudTaskName: taskName,
        nextFireAt: fireAt.toISOString(),
        durationMinutes: params.totalMinutes,
        hours: params.hours,
        minutes: params.minutes,
        label: params.label,
      },
    };
  } catch (error) {
    console.error('[TimerTool] Error creating timer:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการตั้งเวลา กรุณาลองใหม่อีกครั้งค่ะ',
    };
  }
}

export interface HandleDeleteTimerOptions {
  cancelTaskFn?: (taskName: string) => Promise<void>;
}

/**
 * Handles deletion of a timer by ID: cancels scheduled Cloud Task and updates status in Firestore.
 */
export async function handleDeleteTimer(
  timerId: string,
  user: UserDoc,
  options?: HandleDeleteTimerOptions,
): Promise<ToolResult> {
  const uid = user.lineUserId;
  const cancelTask = options?.cancelTaskFn ?? cancelScheduledTask;

  if (!isValidDocumentId(timerId)) {
    return {
      success: false,
      message: 'ไม่พบตัวจับเวลาที่จะลบค่ะ คุณตาคุณยาย',
    };
  }

  try {
    const docRef = timersRef(uid).doc(timerId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return {
        success: false,
        message: 'ไม่พบตัวจับเวลาที่จะลบค่ะ คุณตาคุณยาย',
      };
    }

    const timer = snap.data() as TimerDoc;

    if (!timer.enabled && !timer.cloudTaskName) {
      return {
        success: false,
        message: 'รายการนี้จัดการไปเรียบร้อยแล้วค่ะ ปุ่มนี้จึงไม่มีผลอะไรแล้วนะคะ คุณตาคุณยาย',
        data: { id: timerId, itemType: 'timer', alreadyHandled: true },
      };
    }

    if (timer.cloudTaskName) {
      try {
        await cancelTask(timer.cloudTaskName);
      } catch (err) {
        console.error('[handleDeleteTimer] Error canceling timer task:', err);
      }
    }

    await docRef.update({
      enabled: false,
      status: 'done',
      cloudTaskName: null,
    });

    return {
      success: true,
      message: 'ลบตัวจับเวลาเรียบร้อยแล้วค่ะ ⏱️',
      data: {
        id: timerId,
        itemType: 'timer',
      },
    };
  } catch (error) {
    console.error('[handleDeleteTimer] Unexpected error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบตัวจับเวลา กรุณาลองใหม่อีกครั้งค่ะ',
    };
  }
}
