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
