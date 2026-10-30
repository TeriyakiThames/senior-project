import type { Recurrence } from '@/types/firestore';
import { AlarmScheduleCalculator } from '@/lib/utils/recurrence';

/**
 * Formats a date for the dashboard header according to the user's locale.
 * Thai (th) uses the Buddhist Era (พ.ศ.), while English (en) uses the Gregorian calendar.
 */
export function formatDashboardDate(date: Date, locale: string): string {
  const isThai = locale.toLowerCase().startsWith('th');
  const targetLocale = isThai ? 'th-TH-u-ca-buddhist' : 'en-US';

  return new Intl.DateTimeFormat(targetLocale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Safely parses Firestore Timestamp-like objects, ISO strings, or Date instances into a Date object.
 */
export function parseTimestamp(
  val: { _seconds?: number } | string | Date | null | undefined,
): Date | null {
  if (!val) return null;
  if (typeof val === 'object' && '_seconds' in val && typeof val._seconds === 'number') {
    return new Date(val._seconds * 1000);
  }
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Formats a scheduled date and time in 24-hour format (HH:mm) for reminder cards.
 */
export function formatReminderDate(date: Date, locale: string): string {
  const isThai = locale.toLowerCase().startsWith('th');
  const targetLocale = isThai ? 'th-TH' : 'en-US';

  return new Intl.DateTimeFormat(targetLocale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Maps recurrence frequency string to localized display label.
 */
export function formatRecurrenceLabel(recurrence?: string, locale: string = 'th'): string {
  if (!recurrence || recurrence === 'once') return '';
  const isThai = locale.toLowerCase().startsWith('th');
  const thaiLabels: Record<string, string> = {
    daily: 'ทุกวัน',
    weekly: 'ทุกสัปดาห์',
    monthly: 'ทุกเดือน',
  };
  const enLabels: Record<string, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
  };
  const labels = isThai ? thaiLabels : enLabels;
  return labels[recurrence] || recurrence;
}

/**
 * Formats a date group header for item listings (e.g. Notes page).
 * - Today: "วันนี้" (th) / "Today" (en)
 * - Yesterday: "เมื่อวาน · 21 ต.ค." (th) / "Yesterday · 21 Oct" (en)
 * - Past dates: "อังคาร 20 ต.ค." (th, stripped "วัน" prefix) / "Tuesday, 20 Oct" (en)
 */
export function formatDateGroupHeader(
  date: Date,
  locale: string = 'th',
  baseNow: Date = new Date(),
): string {
  const isThai = locale.toLowerCase().startsWith('th');

  const startOfBase = new Date(baseNow.getFullYear(), baseNow.getMonth(), baseNow.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = startOfBase.getTime() - startOfTarget.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const targetLocale = isThai ? 'th-TH' : 'en-US';
  const month = new Intl.DateTimeFormat(targetLocale, { month: 'short' }).format(date);
  const day = date.getDate();

  if (diffDays === 0) {
    return isThai ? 'วันนี้' : 'Today';
  }

  if (diffDays === 1) {
    return isThai ? `เมื่อวาน · ${day} ${month}` : `Yesterday · ${day} ${month}`;
  }

  const rawWeekday = new Intl.DateTimeFormat(targetLocale, { weekday: 'long' }).format(date);
  if (isThai) {
    // Strip "วัน" prefix (e.g. "วันอังคาร" -> "อังคาร") matching Figma design specification
    const weekday = rawWeekday.replace(/^วัน/, '');
    return `${weekday} ${day} ${month}`;
  }

  return `${rawWeekday}, ${day} ${month}`;
}

/**
 * Formats time for notes (e.g. "14:15 น." for Thai, "14:15" for English).
 */
export function formatNoteTime(date: Date, locale: string = 'th'): string {
  const isThai = locale.toLowerCase().startsWith('th');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return isThai ? `${hours}:${minutes} น.` : `${hours}:${minutes}`;
}

/**
 * Groups and sorts items by date descending (newest first).
 */
export function groupNotesByDate<
  T extends { createdAt?: { _seconds?: number } | string | Date | null },
>(
  notes: T[],
  locale: string = 'th',
  baseNow: Date = new Date(),
): { label: string; date: Date | null; items: T[] }[] {
  const sorted = [...notes].sort((a, b) => {
    const timeA = parseTimestamp(a.createdAt)?.getTime() ?? 0;
    const timeB = parseTimestamp(b.createdAt)?.getTime() ?? 0;
    return timeB - timeA;
  });

  const groups: { label: string; date: Date | null; items: T[] }[] = [];
  const map = new Map<string, { label: string; date: Date | null; items: T[] }>();

  for (const item of sorted) {
    const parsed = parseTimestamp(item.createdAt);
    if (!parsed) {
      const fallbackLabel = locale.toLowerCase().startsWith('th') ? 'อื่นๆ' : 'Other';
      let group = map.get(fallbackLabel);
      if (!group) {
        group = { label: fallbackLabel, date: null, items: [] };
        map.set(fallbackLabel, group);
        groups.push(group);
      }
      group.items.push(item);
      continue;
    }

    const key = `${parsed.getFullYear()}-${parsed.getMonth()}-${parsed.getDate()}`;
    let group = map.get(key);
    if (!group) {
      const label = formatDateGroupHeader(parsed, locale, baseNow);
      group = { label, date: parsed, items: [] };
      map.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }

  return groups;
}

/**
 * Formats recurrence for alarms according to the user's locale.
 * - 'daily' -> "ทุกวัน" (th) / "Daily" (en)
 * - 'weekly' with daysOfWeek [1, 2, 3, 4, 5] -> "จ.-ศ." (th) / "Mon-Fri" (en)
 * - 'weekly' with daysOfWeek [0, 6] -> "ส.-อา." (th) / "Sat-Sun" (en)
 * - 'weekly' with single day (e.g. [1]) -> "ทุกวันจันทร์" (th) / "Every Mon" (en)
 * - 'weekly' without days -> "ทุกสัปดาห์" (th) / "Weekly" (en)
 * - 'monthly' with dayOfMonth -> "ทุกวันที่ {day}" (th) / "Day {day} of month" (en)
 * - 'monthly' without dayOfMonth -> "ทุกเดือน" (th) / "Monthly" (en)
 * - 'once' -> "ครั้งเดียว" (th) / "Once" (en)
 */
export function formatAlarmRecurrence(
  params: { recurrence?: string; daysOfWeek?: number[]; dayOfMonth?: number },
  locale: string = 'th',
): string {
  const isThai = locale.toLowerCase().startsWith('th');
  const { recurrence, daysOfWeek, dayOfMonth } = params;

  if (!recurrence || recurrence === 'once') {
    return isThai ? 'ครั้งเดียว' : 'Once';
  }

  if (recurrence === 'daily') {
    return isThai ? 'ทุกวัน' : 'Daily';
  }

  if (recurrence === 'weekly') {
    if (daysOfWeek && daysOfWeek.length > 0) {
      const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
      const isWeekdays =
        sortedDays.length === 5 &&
        sortedDays[0] === 1 &&
        sortedDays[1] === 2 &&
        sortedDays[2] === 3 &&
        sortedDays[3] === 4 &&
        sortedDays[4] === 5;
      if (isWeekdays) {
        return isThai ? 'จ.-ศ.' : 'Mon-Fri';
      }

      const isWeekends = sortedDays.length === 2 && sortedDays[0] === 0 && sortedDays[1] === 6;
      if (isWeekends) {
        return isThai ? 'ส.-อา.' : 'Sat-Sun';
      }

      // Single day
      if (sortedDays.length === 1) {
        const dayNamesTh = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const day = sortedDays[0];
        if (day >= 0 && day <= 6) {
          return isThai ? `ทุกวัน${dayNamesTh[day]}` : `Every ${dayNamesEn[day]}`;
        }
      }

      // Multiple custom days: e.g. "จ., พ., ศ."
      const shortDaysTh = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
      const shortDaysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const names = sortedDays
        .filter((d) => d >= 0 && d <= 6)
        .map((d) => (isThai ? shortDaysTh[d] : shortDaysEn[d]));
      return names.join(', ');
    }
    return isThai ? 'ทุกสัปดาห์' : 'Weekly';
  }

  if (recurrence === 'monthly') {
    if (typeof dayOfMonth === 'number' && dayOfMonth >= 1 && dayOfMonth <= 31) {
      return isThai ? `ทุกวันที่ ${dayOfMonth}` : `Day ${dayOfMonth} of month`;
    }
    return isThai ? 'ทุกเดือน' : 'Monthly';
  }

  return recurrence;
}

/**
 * Formats next alarm trigger time for alarm cards (e.g. "พรุ่งนี้ ศ. 23 ต.ค.", "อา. 1 พ.ย.").
 */
export function formatAlarmNextFire(
  date: Date,
  locale: string = 'th',
  baseNow: Date = new Date(),
): string {
  const isThai = locale.toLowerCase().startsWith('th');
  const targetLocale = isThai ? 'th-TH' : 'en-US';

  const startOfBase = new Date(baseNow.getFullYear(), baseNow.getMonth(), baseNow.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = startOfTarget.getTime() - startOfBase.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const rawWeekday = new Intl.DateTimeFormat(targetLocale, { weekday: 'short' }).format(date);
  const month = new Intl.DateTimeFormat(targetLocale, { month: 'short' }).format(date);
  const day = date.getDate();

  if (diffDays === 0) {
    return isThai ? `วันนี้ ${rawWeekday} ${day} ${month}` : `Today, ${rawWeekday} ${day} ${month}`;
  }

  if (diffDays === 1) {
    return isThai
      ? `พรุ่งนี้ ${rawWeekday} ${day} ${month}`
      : `Tomorrow, ${rawWeekday} ${day} ${month}`;
  }

  if (isThai) {
    return `${rawWeekday} ${day} ${month}`;
  }

  return `${rawWeekday}, ${day} ${month}`;
}

/**
 * Resolves or computes the next fire Date for an alarm item.
 */
export function getAlarmNextFireDate(
  alarm: {
    time: string;
    recurrence?: string;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    nextFireAt?: { _seconds?: number } | string | Date | null;
  },
  baseNow: Date = new Date(),
): Date | null {
  const parsed = parseTimestamp(alarm.nextFireAt);
  if (parsed && parsed.getTime() > baseNow.getTime()) {
    return parsed;
  }

  const calc = new AlarmScheduleCalculator(
    {
      time: alarm.time,
      recurrence: (alarm.recurrence as Recurrence) || 'daily',
      daysOfWeek: alarm.daysOfWeek,
      dayOfMonth: alarm.dayOfMonth,
    },
    baseNow,
  );
  return calc.calculateNextFireTime();
}
