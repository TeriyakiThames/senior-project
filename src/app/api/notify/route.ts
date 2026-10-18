import { NextRequest, NextResponse } from 'next/server';
import { lineClient } from '@/lib/line/client';
import { alarmsRef, remindersRef } from '@/lib/firebase/collections';
import { buildAlarmNotification, buildReminderNotification } from '@/lib/line/flex-messages';
import { scheduleNotification } from '@/lib/scheduler/cloud-tasks';
import { calculateNextOccurrence } from '@/lib/utils/recurrence';
import { Timestamp } from 'firebase-admin/firestore';
import type { AlarmDoc, ReminderDoc } from '@/types/firestore';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret');
  const configuredSecret = process.env.WEBHOOK_SECRET;

  if (!configuredSecret || secret !== configuredSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { userId?: string; itemId?: string; itemType?: string };
  try {
    body = (await request.json()) as { userId?: string; itemId?: string; itemType?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { userId, itemId, itemType } = body;

  if (!userId || !itemId || (itemType !== 'alarm' && itemType !== 'reminder')) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    if (itemType === 'alarm') {
      const result = await handleAlarmFire(userId, itemId);
      return NextResponse.json(result, { status: 200 });
    } else {
      const result = await handleReminderFire(userId, itemId);
      return NextResponse.json(result, { status: 200 });
    }
  } catch (error) {
    console.error(`[Notify Route] Error processing notification [${itemType}/${itemId}]:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleAlarmFire(userId: string, alarmId: string) {
  const ref = alarmsRef(userId).doc(alarmId);
  const snap = await ref.get();

  if (!snap.exists) {
    return { status: 'skipped', reason: 'not_found' };
  }

  const alarm = snap.data() as AlarmDoc;
  if (!alarm.enabled) {
    return { status: 'skipped', reason: 'disabled' };
  }

  // Push LINE notification card
  await lineClient.pushMessage({
    to: userId,
    messages: [buildAlarmNotification(alarm.label || '⏰ ถึงเวลาแล้วค่ะ!', alarmId)],
  });

  // Evaluate recurrence
  if (alarm.recurrence !== 'once') {
    const nextFire = calculateNextOccurrence({
      recurrence: alarm.recurrence,
      time: alarm.time,
      daysOfWeek: alarm.daysOfWeek,
      dayOfMonth: alarm.dayOfMonth,
      fromDate: new Date(),
    });

    if (nextFire) {
      const taskName = await scheduleNotification({
        userId,
        itemId: alarmId,
        itemType: 'alarm',
        fireAt: nextFire,
      });

      await ref.update({
        nextFireAt: Timestamp.fromDate(nextFire),
        cloudTaskName: taskName,
      });
    } else {
      await ref.update({
        enabled: false,
        cloudTaskName: null,
      });
    }
  } else {
    await ref.update({
      enabled: false,
      cloudTaskName: null,
    });
  }

  return { status: 'ok' };
}

async function handleReminderFire(userId: string, reminderId: string) {
  const ref = remindersRef(userId).doc(reminderId);
  const snap = await ref.get();

  if (!snap.exists) {
    return { status: 'skipped', reason: 'not_found' };
  }

  const reminder = snap.data() as ReminderDoc;
  if (!reminder.enabled || reminder.status === 'done') {
    return { status: 'skipped', reason: 'inactive_or_done' };
  }

  // Push LINE notification card
  await lineClient.pushMessage({
    to: userId,
    messages: [buildReminderNotification(reminder.message, reminderId)],
  });

  // Evaluate recurrence
  if (reminder.recurrence !== 'once') {
    const scheduledAtDate = reminder.scheduledAt?.toDate
      ? reminder.scheduledAt.toDate()
      : new Date();
    const nextFire = calculateNextOccurrence({
      recurrence: reminder.recurrence,
      scheduledAt: scheduledAtDate,
      daysOfWeek: reminder.daysOfWeek,
      dayOfMonth: reminder.dayOfMonth,
      fromDate: new Date(),
    });

    if (nextFire) {
      const taskName = await scheduleNotification({
        userId,
        itemId: reminderId,
        itemType: 'reminder',
        fireAt: nextFire,
      });

      await ref.update({
        nextFireAt: Timestamp.fromDate(nextFire),
        cloudTaskName: taskName,
        status: 'pending',
      });
    } else {
      await ref.update({
        status: 'done',
        enabled: false,
        cloudTaskName: null,
      });
    }
  } else {
    await ref.update({
      status: 'fired',
      enabled: false,
      cloudTaskName: null,
    });
  }

  return { status: 'ok' };
}
