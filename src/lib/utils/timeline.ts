import {
  parseTimestamp,
  getAlarmNextFireDate,
  getTimerNextFireDate,
  getReminderNextFireDate,
} from '@/lib/utils/date';
import type { TimerItem } from '@/components/liff/TimerCard';
import type { ReminderItem } from '@/components/liff/ReminderCard';

export interface UpcomingTimelineItem {
  id: string;
  type: 'timer' | 'reminder' | 'alarm';
  time: string;
  dayText: string;
  title: string;
  tag: string;
  tagVariant: 'timer' | 'reminder' | 'plan' | 'alarm';
  sortTimestamp: number;
}

export interface BuildUpcomingItemsOptions {
  timers?: TimerItem[];
  alarms?: TimerItem[];
  reminders?: ReminderItem[];
  locale?: string;
  t?: (key: string) => string;
  now?: Date;
}

/**
 * Builds and sorts upcoming timeline items for the LIFF dashboard.
 * Gracefully handles timers, snoozed reminders, and recurring plans without runtime errors.
 */
export function buildUpcomingTimelineItems({
  timers,
  alarms = [],
  reminders = [],
  locale = 'th',
  t = (key) => key,
  now = new Date(),
}: BuildUpcomingItemsOptions): UpcomingTimelineItem[] {
  const items: UpcomingTimelineItem[] = [];
  const timerItems = timers ?? alarms;

  // 1. Process active reminders
  for (const rem of reminders) {
    if (rem.status === 'done' || rem.enabled === false) continue;
    const fireDate = getReminderNextFireDate(rem, now);
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

  // 2. Process enabled timers
  for (const timer of timerItems) {
    if (timer.enabled === false || timer.status === 'done') continue;

    let targetDate = (getTimerNextFireDate || getAlarmNextFireDate)(timer, now);

    // Fallback if getTimerNextFireDate returned null, but timer.time exists and is valid
    if (!targetDate && typeof timer.time === 'string' && timer.time.includes(':')) {
      const [hhStr, mmStr] = timer.time.split(':');
      const hh = parseInt(hhStr || '0', 10);
      const mm = parseInt(mmStr || '0', 10);

      const timerToday = new Date(now);
      timerToday.setHours(hh, mm, 0, 0);

      targetDate = timerToday;
      if (timerToday.getTime() <= now.getTime()) {
        const timerTomorrow = new Date(timerToday);
        timerTomorrow.setDate(timerTomorrow.getDate() + 1);
        targetDate = timerTomorrow;
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
      typeof timer.time === 'string' && timer.time.trim()
        ? timer.time.trim()
        : `${String(targetDate.getHours()).padStart(2, '0')}:${String(targetDate.getMinutes()).padStart(2, '0')}`;

    const defaultLabel = t('timer') || t('alarm');
    const title =
      timer.label ||
      (timer.durationMinutes
        ? locale.startsWith('th')
          ? `จับเวลา ${timer.durationMinutes} นาที`
          : `Timer ${timer.durationMinutes} min`
        : defaultLabel);

    items.push({
      id: timer.id,
      type: 'timer',
      time: timeStr,
      dayText,
      title,
      tag: defaultLabel,
      tagVariant: 'timer',
      sortTimestamp: targetDate.getTime(),
    });
  }

  // Sort chronologically ascending
  items.sort((a, b) => a.sortTimestamp - b.sortTimestamp);
  return items;
}
