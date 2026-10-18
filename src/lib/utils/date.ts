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
