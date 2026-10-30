import { describe, it, expect } from 'vitest';
import {
  formatDashboardDate,
  parseTimestamp,
  formatReminderDate,
  formatRecurrenceLabel,
  formatDateGroupHeader,
  formatNoteTime,
  groupNotesByDate,
  formatAlarmRecurrence,
  formatAlarmNextFire,
  getAlarmNextFireDate,
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
    const today = new Date(2026, 9, 22, 9, 30);
    expect(formatDateGroupHeader(today, 'th', baseNow)).toBe('วันนี้');
    expect(formatDateGroupHeader(today, 'en', baseNow)).toBe('Today');
  });

  it('formats yesterday with date in Thai and English', () => {
    const yesterday = new Date(2026, 9, 21, 15, 0);
    const thResult = formatDateGroupHeader(yesterday, 'th', baseNow);
    expect(thResult).toContain('เมื่อวาน');
    expect(thResult).toContain('21');

    const enResult = formatDateGroupHeader(yesterday, 'en', baseNow);
    expect(enResult).toContain('Yesterday');
    expect(enResult).toContain('21');
  });

  it('formats past dates by stripping "วัน" prefix in Thai', () => {
    const pastDate = new Date(2026, 9, 20, 10, 0); // Tuesday, 20 Oct 2026
    const thResult = formatDateGroupHeader(pastDate, 'th', baseNow);
    expect(thResult).toBe('อังคาร 20 ต.ค.');
    expect(thResult.startsWith('วัน')).toBe(false);

    const enResult = formatDateGroupHeader(pastDate, 'en', baseNow);
    expect(enResult).toBe('Tuesday, 20 Oct');
  });

  it('formats note time in 24-hour format with "น." suffix for Thai', () => {
    const time1 = new Date(2026, 9, 22, 14, 15);
    expect(formatNoteTime(time1, 'th')).toBe('14:15 น.');
    expect(formatNoteTime(time1, 'en')).toBe('14:15');

    const time2 = new Date(2026, 9, 22, 8, 5);
    expect(formatNoteTime(time2, 'th')).toBe('08:05 น.');
    expect(formatNoteTime(time2, 'en')).toBe('08:05');
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

describe('formatAlarmRecurrence', () => {
  it('formats daily recurrence in Thai and English', () => {
    expect(formatAlarmRecurrence({ recurrence: 'daily' }, 'th')).toBe('ทุกวัน');
    expect(formatAlarmRecurrence({ recurrence: 'daily' }, 'en')).toBe('Daily');
  });

  it('formats weekdays (จ.-ศ.) and weekends (ส.-อา.) in Thai and English', () => {
    expect(formatAlarmRecurrence({ recurrence: 'weekly', daysOfWeek: [1, 2, 3, 4, 5] }, 'th')).toBe(
      'จ.-ศ.',
    );
    expect(formatAlarmRecurrence({ recurrence: 'weekly', daysOfWeek: [1, 2, 3, 4, 5] }, 'en')).toBe(
      'Mon-Fri',
    );

    expect(formatAlarmRecurrence({ recurrence: 'weekly', daysOfWeek: [0, 6] }, 'th')).toBe(
      'ส.-อา.',
    );
    expect(formatAlarmRecurrence({ recurrence: 'weekly', daysOfWeek: [0, 6] }, 'en')).toBe(
      'Sat-Sun',
    );
  });

  it('formats single day and custom days in Thai and English', () => {
    expect(formatAlarmRecurrence({ recurrence: 'weekly', daysOfWeek: [1] }, 'th')).toBe(
      'ทุกวันจันทร์',
    );
    expect(formatAlarmRecurrence({ recurrence: 'weekly', daysOfWeek: [1] }, 'en')).toBe(
      'Every Mon',
    );

    expect(formatAlarmRecurrence({ recurrence: 'weekly', daysOfWeek: [1, 3, 5] }, 'th')).toBe(
      'จ., พ., ศ.',
    );
    expect(formatAlarmRecurrence({ recurrence: 'weekly', daysOfWeek: [1, 3, 5] }, 'en')).toBe(
      'Mon, Wed, Fri',
    );
  });

  it('formats monthly recurrence with and without dayOfMonth', () => {
    expect(formatAlarmRecurrence({ recurrence: 'monthly', dayOfMonth: 1 }, 'th')).toBe(
      'ทุกวันที่ 1',
    );
    expect(formatAlarmRecurrence({ recurrence: 'monthly', dayOfMonth: 1 }, 'en')).toBe(
      'Day 1 of month',
    );

    expect(formatAlarmRecurrence({ recurrence: 'monthly' }, 'th')).toBe('ทุกเดือน');
    expect(formatAlarmRecurrence({ recurrence: 'monthly' }, 'en')).toBe('Monthly');
  });

  it('formats once or empty recurrence', () => {
    expect(formatAlarmRecurrence({ recurrence: 'once' }, 'th')).toBe('ครั้งเดียว');
    expect(formatAlarmRecurrence({ recurrence: 'once' }, 'en')).toBe('Once');
    expect(formatAlarmRecurrence({}, 'th')).toBe('ครั้งเดียว');
  });
});

describe('formatAlarmNextFire', () => {
  const baseNow = new Date(2026, 9, 22, 12, 0); // Thu Oct 22, 2026

  it('formats today trigger with weekday, day, and month', () => {
    const today = new Date(2026, 9, 22, 18, 0);
    const resultTh = formatAlarmNextFire(today, 'th', baseNow);
    expect(resultTh).toContain('วันนี้');
    expect(resultTh).toContain('22');
    expect(resultTh).toContain('ต.ค.');

    const resultEn = formatAlarmNextFire(today, 'en', baseNow);
    expect(resultEn).toContain('Today');
    expect(resultEn).toContain('22');
    expect(resultEn).toContain('Oct');
  });

  it('formats tomorrow trigger matching Figma UI (พรุ่งนี้ ศ. 23 ต.ค.)', () => {
    const tomorrow = new Date(2026, 9, 23, 5, 30);
    const resultTh = formatAlarmNextFire(tomorrow, 'th', baseNow);
    expect(resultTh).toBe('พรุ่งนี้ ศ. 23 ต.ค.');

    const resultEn = formatAlarmNextFire(tomorrow, 'en', baseNow);
    expect(resultEn).toBe('Tomorrow, Fri 23 Oct');
  });

  it('formats future trigger matching Figma UI (อา. 1 พ.ย.)', () => {
    const future = new Date(2026, 10, 1, 6, 0); // Sun Nov 1, 2026
    const resultTh = formatAlarmNextFire(future, 'th', baseNow);
    expect(resultTh).toBe('อา. 1 พ.ย.');

    const resultEn = formatAlarmNextFire(future, 'en', baseNow);
    expect(resultEn).toBe('Sun, 1 Nov');
  });
});

describe('getAlarmNextFireDate', () => {
  const baseNow = new Date(2026, 9, 22, 10, 0); // Oct 22, 2026 10:00

  it('uses nextFireAt if it is in the future', () => {
    const futureDate = new Date(2026, 9, 23, 5, 30);
    const alarm = {
      time: '05:30',
      recurrence: 'daily',
      nextFireAt: futureDate,
    };
    const nextDate = getAlarmNextFireDate(alarm, baseNow);
    expect(nextDate?.getTime()).toBe(futureDate.getTime());
  });

  it('computes next fire time using AlarmScheduleCalculator when nextFireAt is missing', () => {
    const alarm = {
      time: '05:30',
      recurrence: 'daily',
    };
    // 05:30 is past 10:00 today, so next fire should be tomorrow Oct 23 at 05:30
    const nextDate = getAlarmNextFireDate(alarm, baseNow);
    expect(nextDate).toBeDefined();
    expect(nextDate?.getHours()).toBe(5);
    expect(nextDate?.getMinutes()).toBe(30);
  });
});
