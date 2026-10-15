import { describe, it, expect } from 'vitest';
import {
  calculateNextOccurrence,
  createBangkokDate,
  getBangkokComponents,
  getDaysInMonth,
} from '@/lib/utils/recurrence';

describe('Recurrence Calculation Utility (SCHED-02)', () => {
  describe('Helper functions', () => {
    it('correctly maps date components in Asia/Bangkok (UTC+7)', () => {
      // 2026-10-15 01:00:00 UTC = 2026-10-15 08:00:00 Bangkok
      const date = new Date('2026-10-15T01:00:00.000Z');
      const bkk = getBangkokComponents(date);

      expect(bkk.year).toBe(2026);
      expect(bkk.month).toBe(10);
      expect(bkk.day).toBe(15);
      expect(bkk.hours).toBe(8);
      expect(bkk.minutes).toBe(0);
      expect(bkk.dayOfWeek).toBe(4); // Thursday
    });

    it('correctly creates Date from Bangkok components', () => {
      const date = createBangkokDate(2026, 10, 15, 8, 30);
      expect(date.toISOString()).toBe('2026-10-15T01:30:00.000Z');
    });

    it('returns correct days in month including leap years', () => {
      expect(getDaysInMonth(2024, 2)).toBe(29); // Leap year
      expect(getDaysInMonth(2025, 2)).toBe(28); // Non-leap year
      expect(getDaysInMonth(2026, 4)).toBe(30);
      expect(getDaysInMonth(2026, 10)).toBe(31);
    });
  });

  describe('calculateNextOccurrence', () => {
    it('returns null for "once" recurrence', () => {
      const fromDate = createBangkokDate(2026, 10, 15, 8, 0);
      const next = calculateNextOccurrence({
        recurrence: 'once',
        time: '08:00',
        fromDate,
      });

      expect(next).toBeNull();
    });

    it('calculates daily recurrence for next day at target time', () => {
      const fromDate = createBangkokDate(2026, 10, 15, 8, 0);
      const next = calculateNextOccurrence({
        recurrence: 'daily',
        time: '07:30',
        fromDate,
      });

      expect(next).not.toBeNull();
      const bkk = getBangkokComponents(next!);
      expect(bkk.year).toBe(2026);
      expect(bkk.month).toBe(10);
      expect(bkk.day).toBe(16);
      expect(bkk.hours).toBe(7);
      expect(bkk.minutes).toBe(30);
    });

    it('calculates daily recurrence rolling over month end', () => {
      const fromDate = createBangkokDate(2026, 10, 31, 20, 0);
      const next = calculateNextOccurrence({
        recurrence: 'daily',
        time: '08:00',
        fromDate,
      });

      expect(next).not.toBeNull();
      const bkk = getBangkokComponents(next!);
      expect(bkk.year).toBe(2026);
      expect(bkk.month).toBe(11);
      expect(bkk.day).toBe(1);
      expect(bkk.hours).toBe(8);
      expect(bkk.minutes).toBe(0);
    });

    it('calculates weekly recurrence matching specific target weekdays', () => {
      // 2026-10-12 was a Monday (dayOfWeek: 1)
      const monday = createBangkokDate(2026, 10, 12, 9, 0);

      // Next occurrence for [1, 3] (Monday and Wednesday) from Monday should be Wednesday
      const nextWed = calculateNextOccurrence({
        recurrence: 'weekly',
        daysOfWeek: [1, 3],
        time: '09:00',
        fromDate: monday,
      });

      expect(nextWed).not.toBeNull();
      const wedBkk = getBangkokComponents(nextWed!);
      expect(wedBkk.day).toBe(14);
      expect(wedBkk.dayOfWeek).toBe(3);

      // Next occurrence for [1] (every Monday) from Monday should be next Monday
      const nextMon = calculateNextOccurrence({
        recurrence: 'weekly',
        daysOfWeek: [1],
        time: '09:00',
        fromDate: monday,
      });

      expect(nextMon).not.toBeNull();
      const monBkk = getBangkokComponents(nextMon!);
      expect(monBkk.day).toBe(19);
      expect(monBkk.dayOfWeek).toBe(1);
    });

    it('calculates monthly recurrence advancing by one month', () => {
      const fromDate = createBangkokDate(2026, 5, 15, 10, 0);
      const next = calculateNextOccurrence({
        recurrence: 'monthly',
        dayOfMonth: 15,
        time: '10:00',
        fromDate,
      });

      expect(next).not.toBeNull();
      const bkk = getBangkokComponents(next!);
      expect(bkk.year).toBe(2026);
      expect(bkk.month).toBe(6);
      expect(bkk.day).toBe(15);
      expect(bkk.hours).toBe(10);
      expect(bkk.minutes).toBe(0);
    });

    it('clamps monthly recurrence to last day for shorter months (Feb non-leap)', () => {
      const jan31 = createBangkokDate(2025, 1, 31, 8, 0);
      const feb = calculateNextOccurrence({
        recurrence: 'monthly',
        dayOfMonth: 31,
        time: '08:00',
        fromDate: jan31,
      });

      expect(feb).not.toBeNull();
      const bkk = getBangkokComponents(feb!);
      expect(bkk.year).toBe(2025);
      expect(bkk.month).toBe(2);
      expect(bkk.day).toBe(28); // Clamped to 28
    });

    it('clamps monthly recurrence to 29th for Feb in a leap year', () => {
      const jan31 = createBangkokDate(2024, 1, 31, 8, 0);
      const feb = calculateNextOccurrence({
        recurrence: 'monthly',
        dayOfMonth: 31,
        time: '08:00',
        fromDate: jan31,
      });

      expect(feb).not.toBeNull();
      const bkk = getBangkokComponents(feb!);
      expect(bkk.year).toBe(2024);
      expect(bkk.month).toBe(2);
      expect(bkk.day).toBe(29); // Clamped to 29
    });

    it('rolls over year from December to January for monthly recurrence', () => {
      const dec15 = createBangkokDate(2026, 12, 15, 8, 0);
      const next = calculateNextOccurrence({
        recurrence: 'monthly',
        dayOfMonth: 15,
        time: '08:00',
        fromDate: dec15,
      });

      expect(next).not.toBeNull();
      const bkk = getBangkokComponents(next!);
      expect(bkk.year).toBe(2027);
      expect(bkk.month).toBe(1);
      expect(bkk.day).toBe(15);
    });

    it('enforces maxIterations guardrail and returns null when reached', () => {
      const fromDate = createBangkokDate(2026, 10, 15, 8, 0);

      // Reached limit: currentIteration (3) >= maxIterations (3)
      const finished = calculateNextOccurrence({
        recurrence: 'daily',
        time: '08:00',
        fromDate,
        currentIteration: 3,
        maxIterations: 3,
      });
      expect(finished).toBeNull();

      // Within limit: currentIteration (2) < maxIterations (3)
      const continuing = calculateNextOccurrence({
        recurrence: 'daily',
        time: '08:00',
        fromDate,
        currentIteration: 2,
        maxIterations: 3,
      });
      expect(continuing).not.toBeNull();
    });

    it('enforces endDate guardrail and returns null when next occurrence exceeds cut-off', () => {
      const fromDate = createBangkokDate(2026, 10, 15, 8, 0);
      const endDate = createBangkokDate(2026, 10, 15, 23, 59);

      // Next daily occurrence would be Oct 16, which exceeds endDate
      const next = calculateNextOccurrence({
        recurrence: 'daily',
        time: '08:00',
        fromDate,
        endDate,
      });

      expect(next).toBeNull();
    });
  });
});
