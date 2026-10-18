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
