import { parseTimestamp, getAlarmNextFireDate } from '@/lib/utils/date';
import type { AlarmItem } from '@/components/liff/AlarmCard';
import type { ReminderItem } from '@/components/liff/ReminderCard';

export interface UpcomingTimelineItem {
  id: string;
  type: 'alarm' | 'reminder';
  time: string;
  dayText: string;
  title: string;
  tag: string;
  tagVariant: 'alarm' | 'reminder' | 'plan';
  sortTimestamp: number;
}

export interface BuildUpcomingItemsOptions {
  alarms?: AlarmItem[];
  reminders?: ReminderItem[];
  locale?: string;
  t?: (key: string) => string;
  now?: Date;
}

/**
 * Builds and sorts upcoming timeline items for the LIFF dashboard.
 * Gracefully handles alarms, timers (alarms with durationMinutes and no time string),
 * snoozed reminders, and recurring plans without runtime errors.
 */
export function buildUpcomingTimelineItems({
  alarms = [],
  reminders = [],
  locale = 'th',
  t = (key) => key,
  now = new Date(),
}: BuildUpcomingItemsOptions): UpcomingTimelineItem[] {
  const items: UpcomingTimelineItem[] = [];

  // 1. Process active reminders
  for (const rem of reminders) {
    if (rem.status === 'done') continue;
    const fireDate = parseTimestamp(rem.nextFireAt);
    if (!fireDate) continue;

    const hours = String(fireDate.getHours()).padStart(2, '0');
    const minutes = String(fireDate.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    const isToday =
      fireDate.getDate() === now.getDate() &&
      fireDate.getMonth() === now.getMonth() &&
      fireDate.getFullYear() === now.getFullYear();

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow =
      fireDate.getDate() === tomorrow.getDate() &&
      fireDate.getMonth() === tomorrow.getMonth() &&
      fireDate.getFullYear() === tomorrow.getFullYear();

    const dayText = isToday
      ? t('today')
      : isTomorrow
        ? t('tomorrow')
        : `${fireDate.getDate()} ${new Intl.DateTimeFormat(locale.startsWith('th') ? 'th-TH' : 'en-US', { month: 'short' }).format(fireDate)}`;

    let tag = t('reminder');
    let tagVariant: 'alarm' | 'reminder' | 'plan' = 'reminder';

    if (rem.status === 'snoozed') {
      tag = `${t('reminder')} · ${t('snoozed')}`;
      tagVariant = 'reminder';
    } else if (rem.recurrence && rem.recurrence !== 'once') {
      tag = t('plan');
      tagVariant = 'plan';
    }

    items.push({
      id: rem.id,
      type: 'reminder',
      time: timeStr,
      dayText,
      title: rem.message,
      tag,
      tagVariant,
      sortTimestamp: fireDate.getTime(),
    });
  }

  // 2. Process enabled alarms & timers
  for (const alarm of alarms) {
    if (alarm.enabled === false || alarm.status === 'done') continue;

    let targetDate = getAlarmNextFireDate(alarm, now);

    // Fallback if getAlarmNextFireDate returned null, but alarm.time exists and is valid
    if (!targetDate && typeof alarm.time === 'string' && alarm.time.includes(':')) {
      const [hhStr, mmStr] = alarm.time.split(':');
      const hh = parseInt(hhStr || '0', 10);
      const mm = parseInt(mmStr || '0', 10);

      const alarmToday = new Date(now);
      alarmToday.setHours(hh, mm, 0, 0);

      targetDate = alarmToday;
      if (alarmToday.getTime() <= now.getTime()) {
        const alarmTomorrow = new Date(alarmToday);
        alarmTomorrow.setDate(alarmTomorrow.getDate() + 1);
        targetDate = alarmTomorrow;
      }
    }

    // If still no valid target date could be calculated, skip this item
    if (!targetDate) continue;

    const isToday =
      targetDate.getDate() === now.getDate() &&
      targetDate.getMonth() === now.getMonth() &&
      targetDate.getFullYear() === now.getFullYear();

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow =
      targetDate.getDate() === tomorrow.getDate() &&
      targetDate.getMonth() === tomorrow.getMonth() &&
      targetDate.getFullYear() === tomorrow.getFullYear();

    const dayText = isToday
      ? t('today')
      : isTomorrow
        ? t('tomorrow')
        : `${targetDate.getDate()} ${new Intl.DateTimeFormat(locale.startsWith('th') ? 'th-TH' : 'en-US', { month: 'short' }).format(targetDate)}`;

    const timeStr =
      typeof alarm.time === 'string' && alarm.time.trim()
        ? alarm.time.trim()
        : `${String(targetDate.getHours()).padStart(2, '0')}:${String(targetDate.getMinutes()).padStart(2, '0')}`;

    const title =
      alarm.label ||
      (alarm.durationMinutes
        ? locale.startsWith('th')
          ? `จับเวลา ${alarm.durationMinutes} นาที`
          : `Timer ${alarm.durationMinutes} min`
        : t('alarm'));

    items.push({
      id: alarm.id,
      type: 'alarm',
      time: timeStr,
      dayText,
      title,
      tag: t('alarm'),
      tagVariant: 'alarm',
      sortTimestamp: targetDate.getTime(),
    });
  }

  // Sort chronologically ascending
  items.sort((a, b) => a.sortTimestamp - b.sortTimestamp);
  return items;
}
