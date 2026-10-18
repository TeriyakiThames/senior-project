import { alarmsRef, remindersRef } from '@/lib/firebase/collections';
import { scheduleNotification, cancelScheduledTask } from '@/lib/scheduler/cloud-tasks';
import { Timestamp } from 'firebase-admin/firestore';
import type { AlarmDoc, ReminderDoc, UserDoc } from '@/types/firestore';
import type { ToolResult } from './index';

export const SNOOZE_ALARM_MS = 5 * 60 * 1000; // 5 minutes
export const SNOOZE_REMINDER_MS = 15 * 60 * 1000; // 15 minutes
export const RECENT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

export const SNOOZE_NOT_FOUND_MESSAGE = 'ไม่พบการแจ้งเตือนที่จะเลื่อนค่ะ คุณตาคุณยาย';
export const SNOOZE_CLARIFY_MESSAGE =
  'พบการแจ้งเตือนหลายรายการที่เพิ่งแจ้งเตือนค่ะ คุณตาคุณยายต้องการเลื่อนรายการไหนคะ?';
export const DISMISS_NOT_FOUND_MESSAGE = 'ไม่พบการแจ้งเตือนที่จะปิดค่ะ คุณตาคุณยาย';
export const DISMISS_CLARIFY_MESSAGE =
  'พบการแจ้งเตือนหลายรายการที่เพิ่งแจ้งเตือนค่ะ คุณตาคุณยายต้องการปิดรายการไหนคะ?';

export interface HandleActionOptions {
  now?: Date;
  scheduleNotificationFn?: typeof scheduleNotification;
  cancelScheduledTaskFn?: typeof cancelScheduledTask;
}

interface ActionCandidate {
  id: string;
  itemType: 'alarm' | 'reminder';
  fireTime: Date;
  data: AlarmDoc | ReminderDoc;
  docRef: FirebaseFirestore.DocumentReference;
}

/**
 * Finds candidate alarms and reminders that fired or were scheduled within the recent 30-minute window.
 */
async function findRecentCandidates(
  uid: string,
  currentTime: Date,
  userText: string,
): Promise<ActionCandidate[]> {
  const windowStart = new Date(currentTime.getTime() - RECENT_WINDOW_MS);
  const candidates: ActionCandidate[] = [];
  const normalizedText = userText.toLowerCase();

  const isAlarmExplicit =
    (normalizedText.includes('ปลุก') ||
      normalizedText.includes('alarm') ||
      normalizedText.includes('นาฬิกา')) &&
    !normalizedText.includes('เตือน');
  const isReminderExplicit =
    normalizedText.includes('เตือนความจำ') ||
    normalizedText.includes('กินยา') ||
    normalizedText.includes('reminder');

  // Check Alarms
  if (!isReminderExplicit) {
    const alarmSnap = await alarmsRef(uid).where('enabled', '==', true).get();
    for (const doc of alarmSnap.docs) {
      const data = doc.data() as AlarmDoc;
      const fireTime = data.nextFireAt?.toDate();
      if (fireTime && fireTime >= windowStart && fireTime <= currentTime) {
        candidates.push({
          id: doc.id,
          itemType: 'alarm',
          fireTime,
          data,
          docRef: doc.ref,
        });
      }
    }
  }

  // Check Reminders
  if (!isAlarmExplicit) {
    const reminderSnap = await remindersRef(uid)
      .where('status', 'in', ['fired', 'snoozed', 'pending'])
      .get();
    for (const doc of reminderSnap.docs) {
      const data = doc.data() as ReminderDoc;
      const fireTime = data.nextFireAt?.toDate() ?? data.scheduledAt?.toDate();
      const isStatusFired = data.status === 'fired' || data.status === 'snoozed';
      const isWithinWindow = fireTime && fireTime >= windowStart && fireTime <= currentTime;

      if (isStatusFired || isWithinWindow) {
        candidates.push({
          id: doc.id,
          itemType: 'reminder',
          fireTime: fireTime ?? currentTime,
          data,
          docRef: doc.ref,
        });
      }
    }
  }

  // Sort descending by most recent fireTime
  candidates.sort((a, b) => b.fireTime.getTime() - a.fireTime.getTime());
  return candidates;
}

/**
 * Handles snoozing an alarm (+5m) or a reminder (+15m).
 * Supports explicit IDs from Flex actions (snooze_alarm:{id}, snooze_reminder:{id})
 * and falls back to resolving recently fired items within 30 minutes for voice commands.
 */
export async function handleSnooze(
  userText: string,
  user: UserDoc,
  options?: HandleActionOptions,
): Promise<ToolResult> {
  const uid = user.lineUserId;
  const currentTime = options?.now ?? new Date();
  const scheduleTask = options?.scheduleNotificationFn ?? scheduleNotification;
  const cancelTask = options?.cancelScheduledTaskFn ?? cancelScheduledTask;

  const alarmMatch = userText.trim().match(/^snooze_alarm:(.+)$/);
  const reminderMatch = userText.trim().match(/^snooze_reminder:(.+)$/);

  // 1. Explicit Alarm Snooze
  if (alarmMatch) {
    const alarmId = alarmMatch[1].trim();
    const docRef = alarmsRef(uid).doc(alarmId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return { success: false, message: 'ไม่พบนาฬิกาปลุกที่จะเลื่อนค่ะ คุณตาคุณยาย' };
    }

    const alarm = snap.data() as AlarmDoc;
    if (alarm.cloudTaskName) {
      try {
        await cancelTask(alarm.cloudTaskName);
      } catch (err) {
        console.error('[handleSnooze] Error canceling alarm task:', err);
      }
    }

    const snoozeAt = new Date(currentTime.getTime() + SNOOZE_ALARM_MS);
    const taskName = await scheduleTask({
      userId: uid,
      itemId: alarmId,
      itemType: 'alarm',
      fireAt: snoozeAt,
    });

    await docRef.update({
      cloudTaskName: taskName,
      nextFireAt: Timestamp.fromDate(snoozeAt),
      enabled: true,
    });

    return {
      success: true,
      message: 'เลื่อนปลุกไปอีก 5 นาทีค่ะ ⏰',
      data: { id: alarmId, itemType: 'alarm', snoozeAt: snoozeAt.toISOString() },
    };
  }

  // 2. Explicit Reminder Snooze
  if (reminderMatch) {
    const reminderId = reminderMatch[1].trim();
    const docRef = remindersRef(uid).doc(reminderId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return { success: false, message: 'ไม่พบการเตือนที่จะเลื่อนค่ะ คุณตาคุณยาย' };
    }

    const reminder = snap.data() as ReminderDoc;
    if (reminder.cloudTaskName) {
      try {
        await cancelTask(reminder.cloudTaskName);
      } catch (err) {
        console.error('[handleSnooze] Error canceling reminder task:', err);
      }
    }

    const snoozeAt = new Date(currentTime.getTime() + SNOOZE_REMINDER_MS);
    const taskName = await scheduleTask({
      userId: uid,
      itemId: reminderId,
      itemType: 'reminder',
      fireAt: snoozeAt,
    });

    await docRef.update({
      cloudTaskName: taskName,
      nextFireAt: Timestamp.fromDate(snoozeAt),
      status: 'snoozed',
      enabled: true,
    });

    return {
      success: true,
      message: 'เลื่อนการเตือนไปอีก 15 นาทีค่ะ 📋',
      data: { id: reminderId, itemType: 'reminder', snoozeAt: snoozeAt.toISOString() },
    };
  }

  // 3. Voice / Text Fallback Resolution
  const candidates = await findRecentCandidates(uid, currentTime, userText);

  if (candidates.length === 0) {
    return {
      success: false,
      message: SNOOZE_NOT_FOUND_MESSAGE,
    };
  }

  if (candidates.length > 1) {
    return {
      success: false,
      message: SNOOZE_CLARIFY_MESSAGE,
    };
  }

  // Single candidate found: delegate to explicit snooze logic
  const candidate = candidates[0];
  if (candidate.itemType === 'alarm') {
    return handleSnooze(`snooze_alarm:${candidate.id}`, user, options);
  } else {
    return handleSnooze(`snooze_reminder:${candidate.id}`, user, options);
  }
}

/**
 * Handles dismissing an alarm or reminder.
 * Supports explicit IDs from Flex actions (dismiss_alarm:{id}, dismiss_reminder:{id})
 * and falls back to resolving recently fired items within 30 minutes for voice commands.
 */
export async function handleDismiss(
  userText: string,
  user: UserDoc,
  options?: HandleActionOptions,
): Promise<ToolResult> {
  const uid = user.lineUserId;
  const currentTime = options?.now ?? new Date();
  const cancelTask = options?.cancelScheduledTaskFn ?? cancelScheduledTask;

  const alarmMatch = userText.trim().match(/^dismiss_alarm:(.+)$/);
  const reminderMatch = userText.trim().match(/^dismiss_reminder:(.+)$/);

  // 1. Explicit Alarm Dismiss
  if (alarmMatch) {
    const alarmId = alarmMatch[1].trim();
    const docRef = alarmsRef(uid).doc(alarmId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return { success: false, message: 'ไม่พบนาฬิกาปลุกที่จะปิดค่ะ คุณตาคุณยาย' };
    }

    const alarm = snap.data() as AlarmDoc;
    if (alarm.cloudTaskName) {
      try {
        await cancelTask(alarm.cloudTaskName);
      } catch (err) {
        console.error('[handleDismiss] Error canceling alarm task:', err);
      }
    }

    if (alarm.recurrence === 'once') {
      await docRef.update({
        enabled: false,
        cloudTaskName: null,
      });
    } else {
      // Keep enabled: true for future occurrences, clear active snooze task
      await docRef.update({
        cloudTaskName: null,
      });
    }

    return {
      success: true,
      message: 'ปิดเสียงปลุกแล้วค่ะ ✓',
      data: { id: alarmId, itemType: 'alarm' },
    };
  }

  // 2. Explicit Reminder Dismiss
  if (reminderMatch) {
    const reminderId = reminderMatch[1].trim();
    const docRef = remindersRef(uid).doc(reminderId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return { success: false, message: 'ไม่พบการเตือนที่จะปิดค่ะ คุณตาคุณยาย' };
    }

    const reminder = snap.data() as ReminderDoc;
    if (reminder.cloudTaskName) {
      try {
        await cancelTask(reminder.cloudTaskName);
      } catch (err) {
        console.error('[handleDismiss] Error canceling reminder task:', err);
      }
    }

    await docRef.update({
      status: 'done',
      enabled: false,
      cloudTaskName: null,
    });

    return {
      success: true,
      message: 'ปิดการเตือนแล้วค่ะ ✓',
      data: { id: reminderId, itemType: 'reminder' },
    };
  }

  // 3. Voice / Text Fallback Resolution
  const candidates = await findRecentCandidates(uid, currentTime, userText);

  if (candidates.length === 0) {
    return {
      success: false,
      message: DISMISS_NOT_FOUND_MESSAGE,
    };
  }

  if (candidates.length > 1) {
    return {
      success: false,
      message: DISMISS_CLARIFY_MESSAGE,
    };
  }

  // Single candidate found: delegate to explicit dismiss logic
  const candidate = candidates[0];
  if (candidate.itemType === 'alarm') {
    return handleDismiss(`dismiss_alarm:${candidate.id}`, user, options);
  } else {
    return handleDismiss(`dismiss_reminder:${candidate.id}`, user, options);
  }
}
