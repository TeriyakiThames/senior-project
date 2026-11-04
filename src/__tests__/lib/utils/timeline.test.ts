import { describe, it, expect } from 'vitest';
import { buildUpcomingTimelineItems } from '@/lib/utils/timeline';
import type { TimerItem } from '@/components/liff/TimerCard';
import type { ReminderItem } from '@/components/liff/ReminderCard';

describe('buildUpcomingTimelineItems (Timeline Builder & S1/FE-02 robustness)', () => {
  const baseNow = new Date('2026-10-22T10:00:00.000Z');

  const mockTranslations: Record<string, string> = {
    today: 'วันนี้',
    tomorrow: 'พรุ่งนี้',
    reminder: 'การเตือน',
    snoozed: 'เลื่อนเวลา',
    plan: 'แผน',
    timer: 'ตัวจับเวลา',
    alarm: 'ตัวจับเวลา',
  };
  const t = (k: string) => mockTranslations[k] ?? k;

  it('gracefully handles timer items where time is undefined without throwing split error', () => {
    // Regression test for production bug:
    // page-*.js: Uncaught TypeError: Cannot read properties of undefined (reading 'split')
    const timerItem: TimerItem = {
      id: 'timer-123',
      time: undefined as unknown as string,
      durationMinutes: 15,
      enabled: true,
      nextFireAt: new Date('2026-10-22T10:15:00.000Z'),
    };

    expect(() => {
      const items = buildUpcomingTimelineItems({
        timers: [timerItem],
        reminders: [],
        locale: 'th',
        t,
        now: baseNow,
      });
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('timer-123');
      expect(items[0].type).toBe('timer');
      expect(items[0].title).toBe('จับเวลา 15 นาที');
      expect(items[0].tag).toBe('ตัวจับเวลา');
      expect(items[0].tagVariant).toBe('timer');
    }).not.toThrow();
  });

  it('skips timers when time is undefined and nextFireAt is missing or in the past', () => {
    const pastTimer: TimerItem = {
      id: 'past-timer',
      time: undefined as unknown as string,
      durationMinutes: 10,
      enabled: true,
      nextFireAt: new Date('2026-10-22T09:00:00.000Z'), // in the past
    };

    const items = buildUpcomingTimelineItems({
      timers: [pastTimer],
      reminders: [],
      locale: 'th',
      t,
      now: baseNow,
    });

    expect(items).toHaveLength(0);
  });

  it('correctly processes standard timers with time string', () => {
    const timer: TimerItem = {
      id: 'timer-1',
      time: '07:00',
      label: 'ตื่นนอน',
      recurrence: 'daily',
      enabled: true,
    };

    const items = buildUpcomingTimelineItems({
      timers: [timer],
      reminders: [],
      locale: 'th',
      t,
      now: baseNow,
    });

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('timer-1');
    expect(items[0].time).toBe('07:00');
    expect(items[0].title).toBe('ตื่นนอน');
    expect(items[0].tag).toBe('ตัวจับเวลา');
    expect(items[0].tagVariant).toBe('timer');
  });

  it('correctly processes active reminders including snoozed status and recurring plans', () => {
    const reminders: ReminderItem[] = [
      {
        id: 'rem-1',
        message: 'กินยาความดัน',
        status: 'pending',
        nextFireAt: new Date('2026-10-22T14:30:00.000Z'),
        recurrence: 'daily',
      },
      {
        id: 'rem-2',
        message: 'โทรหาลูก',
        status: 'snoozed',
        nextFireAt: new Date('2026-10-22T11:00:00.000Z'),
        recurrence: 'once',
      },
    ];

    const items = buildUpcomingTimelineItems({
      alarms: [],
      reminders,
      locale: 'th',
      t,
      now: baseNow,
    });

    expect(items).toHaveLength(2);
    // rem-2 (11:00) should be before rem-1 (14:30)
    expect(items[0].id).toBe('rem-2');
    expect(items[0].tag).toBe('การเตือน · เลื่อนเวลา');
    expect(items[0].tagVariant).toBe('reminder');

    expect(items[1].id).toBe('rem-1');
    expect(items[1].tag).toBe('แผน');
    expect(items[1].tagVariant).toBe('plan');
  });

  it('skips disabled timers and done reminders', () => {
    const timers: TimerItem[] = [
      { id: 'disabled-timer', time: '08:00', enabled: false },
      { id: 'done-timer', time: '09:00', enabled: true, status: 'done' },
    ];
    const reminders: ReminderItem[] = [
      {
        id: 'done-rem',
        message: 'ทำเสร็จแล้ว',
        status: 'done',
        nextFireAt: new Date('2026-10-22T12:00:00.000Z'),
      },
    ];

    const items = buildUpcomingTimelineItems({
      timers,
      reminders,
      locale: 'th',
      t,
      now: baseNow,
    });

    expect(items).toHaveLength(0);
  });

  it('sorts mixed timers and reminders chronologically ascending', () => {
    const timers: TimerItem[] = [
      {
        id: 'timer-future',
        time: '20:00',
        label: 'สวดมนต์',
        enabled: true,
        nextFireAt: new Date('2026-10-22T20:00:00.000Z'),
      },
      {
        id: 'timer-soon',
        time: undefined as unknown as string,
        durationMinutes: 5,
        enabled: true,
        nextFireAt: new Date('2026-10-22T10:05:00.000Z'),
      },
    ];
    const reminders: ReminderItem[] = [
      {
        id: 'rem-noon',
        message: 'กินข้าวเที่ยง',
        status: 'pending',
        nextFireAt: new Date('2026-10-22T12:00:00.000Z'),
      },
    ];

    const items = buildUpcomingTimelineItems({
      timers,
      reminders,
      locale: 'th',
      t,
      now: baseNow,
    });

    expect(items).toHaveLength(3);
    expect(items[0].id).toBe('timer-soon');
    expect(items[1].id).toBe('rem-noon');
    expect(items[2].id).toBe('timer-future');
  });
});
