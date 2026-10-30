import { describe, it, expect } from 'vitest';
import {
  formatDashboardDate,
  parseTimestamp,
  formatReminderDate,
  formatRecurrenceLabel,
  formatDateGroupHeader,
  formatNoteTime,
  groupNotesByDate,
} from '@/lib/utils/date';

describe('formatDashboardDate (FE-03)', () => {
  it('formats dates in Thai using Buddhist Era', () => {
    // 2026-10-18
    const testDate = new Date(2026, 9, 18);
    const formatted = formatDashboardDate(testDate, 'th');

    expect(formatted).toContain('2569');
    expect(formatted).toContain('ตุลาคม');
  });

  it('formats dates in English using Gregorian calendar', () => {
    // 2026-10-18
    const testDate = new Date(2026, 9, 18);
    const formatted = formatDashboardDate(testDate, 'en');

    expect(formatted).toContain('2026');
    expect(formatted).toContain('October');
    expect(formatted).toContain('Sunday');
  });

  it('handles locale variants gracefully', () => {
    const testDate = new Date(2026, 9, 18);
    const formattedTh = formatDashboardDate(testDate, 'th-TH');
    expect(formattedTh).toContain('2569');

    const formattedOther = formatDashboardDate(testDate, 'fr');
    expect(formattedOther).toContain('2026');
  });
});

describe('parseTimestamp (FE-04)', () => {
  it('correctly parses Firestore timestamp objects with _seconds', () => {
    const timestamp = { _seconds: 1729300000 };
    const date = parseTimestamp(timestamp);
    expect(date).toBeInstanceOf(Date);
    expect(date?.getTime()).toBe(1729300000 * 1000);
  });

  it('correctly parses Date instances and ISO strings', () => {
    const now = new Date();
    expect(parseTimestamp(now)?.getTime()).toBe(now.getTime());

    const isoString = '2026-10-19T07:30:00.000Z';
    const parsed = parseTimestamp(isoString);
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed?.toISOString()).toBe(isoString);
  });

  it('returns null for null, undefined, or invalid inputs', () => {
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp(undefined)).toBeNull();
    expect(parseTimestamp('invalid-date')).toBeNull();
  });
});

describe('formatReminderDate (FE-04)', () => {
  it('formats scheduled date/time in 24-hour format', () => {
    const testDate = new Date(2026, 9, 19, 14, 5); // 14:05 (2:05 PM)
    const formattedEn = formatReminderDate(testDate, 'en');
    expect(formattedEn).toContain('14:05');

    const formattedTh = formatReminderDate(testDate, 'th');
    expect(formattedTh).toContain('14:05');
  });
});

describe('formatRecurrenceLabel (FE-04)', () => {
  it('maps recurrence frequencies to localized labels', () => {
    expect(formatRecurrenceLabel('daily', 'th')).toBe('ทุกวัน');
    expect(formatRecurrenceLabel('weekly', 'th')).toBe('ทุกสัปดาห์');
    expect(formatRecurrenceLabel('monthly', 'th')).toBe('ทุกเดือน');
    expect(formatRecurrenceLabel('once', 'th')).toBe('');

    expect(formatRecurrenceLabel('daily', 'en')).toBe('Daily');
    expect(formatRecurrenceLabel('weekly', 'en')).toBe('Weekly');
    expect(formatRecurrenceLabel('monthly', 'en')).toBe('Monthly');
    expect(formatRecurrenceLabel('once', 'en')).toBe('');
  });

  it('returns fallback or empty string for unknown or missing recurrence', () => {
    expect(formatRecurrenceLabel(undefined)).toBe('');
    expect(formatRecurrenceLabel('custom-yearly', 'th')).toBe('custom-yearly');
  });
});

describe('formatDateGroupHeader & formatNoteTime', () => {
  const baseNow = new Date(2026, 9, 22, 12, 0); // 22 Oct 2026

  it('formats today correctly in Thai and English', () => {
    const todayDate = new Date(2026, 9, 22, 9, 30);
    expect(formatDateGroupHeader(todayDate, 'th', baseNow)).toBe('วันนี้');
    expect(formatDateGroupHeader(todayDate, 'en', baseNow)).toBe('Today');
  });

  it('formats yesterday with date and month in Thai and English', () => {
    const yesterdayDate = new Date(2026, 9, 21, 18, 5); // 21 Oct 2026
    const thYesterday = formatDateGroupHeader(yesterdayDate, 'th', baseNow);
    expect(thYesterday).toContain('เมื่อวาน · 21');
    expect(thYesterday).toContain('ต.ค.');

    const enYesterday = formatDateGroupHeader(yesterdayDate, 'en', baseNow);
    expect(enYesterday).toContain('Yesterday · 21');
    expect(enYesterday).toContain('Oct');
  });

  it('formats past dates with weekday without "วัน" prefix in Thai', () => {
    const pastDate = new Date(2026, 9, 20, 10, 12); // Tuesday, 20 Oct 2026
    const thPast = formatDateGroupHeader(pastDate, 'th', baseNow);
    expect(thPast).toBe('อังคาร 20 ต.ค.');

    const enPast = formatDateGroupHeader(pastDate, 'en', baseNow);
    expect(enPast).toBe('Tuesday, 20 Oct');
  });

  it('formats note time in 24-hour with Thai suffix and English clean', () => {
    const timeDate = new Date(2026, 9, 22, 14, 15);
    expect(formatNoteTime(timeDate, 'th')).toBe('14:15 น.');
    expect(formatNoteTime(timeDate, 'en')).toBe('14:15');
  });
});

describe('groupNotesByDate', () => {
  const baseNow = new Date(2026, 9, 22, 15, 0);

  it('sorts and groups notes by date descending', () => {
    const notes = [
      { id: '1', summary: 'Past note', createdAt: new Date(2026, 9, 20, 10, 0) },
      { id: '2', summary: 'Today note 2', createdAt: new Date(2026, 9, 22, 14, 15) },
      { id: '3', summary: 'Today note 1', createdAt: new Date(2026, 9, 22, 9, 40) },
      { id: '4', summary: 'Yesterday note', createdAt: new Date(2026, 9, 21, 18, 5) },
    ];

    const groups = groupNotesByDate(notes, 'th', baseNow);
    expect(groups.length).toBe(3);

    // Group 0: Today
    expect(groups[0]?.label).toBe('วันนี้');
    expect(groups[0]?.items.length).toBe(2);
    expect(groups[0]?.items[0]?.id).toBe('2'); // 14:15 comes before 9:40
    expect(groups[0]?.items[1]?.id).toBe('3');

    // Group 1: Yesterday
    expect(groups[1]?.label).toContain('เมื่อวาน');
    expect(groups[1]?.items[0]?.id).toBe('4');

    // Group 2: Past
    expect(groups[2]?.label).toBe('อังคาร 20 ต.ค.');
    expect(groups[2]?.items[0]?.id).toBe('1');
  });

  it('handles notes without createdAt gracefully under fallback group', () => {
    const notes = [
      { id: '1', summary: 'Undated note', createdAt: null },
      { id: '2', summary: 'Today note', createdAt: new Date(2026, 9, 22, 10, 0) },
    ];

    const groups = groupNotesByDate(notes, 'th', baseNow);
    expect(groups.length).toBe(2);
    expect(groups[0]?.label).toBe('วันนี้');
    expect(groups[1]?.label).toBe('อื่นๆ');
  });
});
