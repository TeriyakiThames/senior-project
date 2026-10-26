import { NextRequest, NextResponse } from 'next/server';
import { lineClient } from '@/lib/line/client';
import { alarmsRef, remindersRef } from '@/lib/firebase/collections';
import { buildAlarmNotification, buildReminderNotification } from '@/lib/line/flex-messages';
import { scheduleNotification } from '@/lib/scheduler/cloud-tasks';
import { isValidWebhookSecret } from '@/lib/scheduler/webhook-auth';
import { calculateNextOccurrence } from '@/lib/utils/recurrence';
import { Timestamp } from 'firebase-admin/firestore';
import type { AlarmDoc, ReminderDoc } from '@/types/firestore';
import { logError } from '@/lib/utils/errors';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret');
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  const isSecretValid =
    isValidWebhookSecret(secret) || (bearerToken ? isValidWebhookSecret(bearerToken) : false);

  if (!isSecretValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { userId?: string; itemId?: string; itemType?: string; idempotencyKey?: string };
  try {
    body = (await request.json()) as {
      userId?: string;
      itemId?: string;
      itemType?: string;
      idempotencyKey?: string;
    };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { userId, itemId, itemType } = body;

  if (!userId || !itemId || (itemType !== 'alarm' && itemType !== 'reminder')) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const idempotencyKey =
    request.headers.get('x-cloudtasks-taskname') ||
    request.headers.get('x-idempotency-key') ||
    body.idempotencyKey ||
    null;

  try {
    if (itemType === 'alarm') {
      const result = await handleAlarmFire(userId, itemId, idempotencyKey);
      return NextResponse.json(result, { status: 200 });
    } else {
      const result = await handleReminderFire(userId, itemId, idempotencyKey);
      return NextResponse.json(result, { status: 200 });
    }
  } catch (error) {
    logError('notify_route', error, { userId, itemId, itemType });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleAlarmFire(userId: string, alarmId: string, idempotencyKey?: string | null) {
  const ref = alarmsRef(userId).doc(alarmId);
  const snap = await ref.get();

  if (!snap.exists) {
    return { status: 'skipped', reason: 'not_found' };
  }

  const alarm = snap.data() as AlarmDoc;
  if (!alarm.enabled) {
    return { status: 'skipped', reason: 'disabled' };
  }

  // Idempotency check: if this specific execution already pushed notification, skip sending duplicate push
  if (idempotencyKey && alarm.lastNotificationId === idempotencyKey) {
    return { status: 'skipped', reason: 'already_notified' };
  }

  // Evaluate recurrence and save the next schedule BEFORE sending the push
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
  }

  // Push LINE notification card
  await lineClient.pushMessage({
    to: userId,
    messages: [buildAlarmNotification(alarm.label || '⏰ ถึงเวลาแล้วค่ะ!', alarmId)],
  });

  // For one-off, deactivate and record notification key
  if (alarm.recurrence === 'once') {
    const updateData: Record<string, unknown> = {
      enabled: false,
      cloudTaskName: null,
    };
    if (idempotencyKey) {
      updateData.lastNotificationId = idempotencyKey;
    }
    await ref.update(updateData);
  } else if (idempotencyKey) {
    // Record idempotency on recurring item
    await ref.update({
      lastNotificationId: idempotencyKey,
    });
  }

  return { status: 'ok' };
}

async function handleReminderFire(
  userId: string,
  reminderId: string,
  idempotencyKey?: string | null,
) {
  const ref = remindersRef(userId).doc(reminderId);
  const snap = await ref.get();

  if (!snap.exists) {
    return { status: 'skipped', reason: 'not_found' };
  }

  const reminder = snap.data() as ReminderDoc;
  if (!reminder.enabled || reminder.status === 'done') {
    return { status: 'skipped', reason: 'inactive_or_done' };
  }

  // Idempotency check: if this specific execution already pushed notification, skip sending duplicate push
  if (idempotencyKey && reminder.lastNotificationId === idempotencyKey) {
    return { status: 'skipped', reason: 'already_notified' };
  }

  // Evaluate recurrence and save the next schedule BEFORE sending the push
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
  }

  // Push LINE notification card
  await lineClient.pushMessage({
    to: userId,
    messages: [buildReminderNotification(reminder.message, reminderId)],
  });

  // For one-off, deactivate and record notification key
  if (reminder.recurrence === 'once') {
    const updateData: Record<string, unknown> = {
      status: 'fired',
      enabled: false,
      cloudTaskName: null,
    };
    if (idempotencyKey) {
      updateData.lastNotificationId = idempotencyKey;
    }
    await ref.update(updateData);
  } else if (idempotencyKey) {
    await ref.update({
      lastNotificationId: idempotencyKey,
    });
  }

  return { status: 'ok' };
}
