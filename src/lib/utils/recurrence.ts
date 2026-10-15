import type { Recurrence } from '@/types/firestore';

export const BANGKOK_TIMEZONE = 'Asia/Bangkok';
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface BangkokDateComponents {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
}

export interface RecurrenceConfig {
  recurrence: Recurrence;
  time?: string; // "HH:mm" 24h format (primarily for alarms)
  scheduledAt?: Date; // Baseline scheduled date/time (primarily for reminders)
  daysOfWeek?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat (for weekly recurrence)
  dayOfMonth?: number; // 1-31 (for monthly recurrence)
  fromDate?: Date; // Baseline reference time (defaults to now)
  endDate?: Date; // Cut-off limit guardrail
  maxIterations?: number; // Maximum allowed firing cycles
  currentIteration?: number; // Current firing count (1-based)
}

/**
 * Returns calendar date and time components in the Asia/Bangkok (UTC+7) timezone.
 */
export function getBangkokComponents(date: Date): BangkokDateComponents {
  const bangkokDate = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  return {
    year: bangkokDate.getUTCFullYear(),
    month: bangkokDate.getUTCMonth() + 1,
    day: bangkokDate.getUTCDate(),
    dayOfWeek: bangkokDate.getUTCDay(),
    hours: bangkokDate.getUTCHours(),
    minutes: bangkokDate.getUTCMinutes(),
    seconds: bangkokDate.getUTCSeconds(),
    milliseconds: bangkokDate.getUTCMilliseconds(),
  };
}

/**
 * Creates a UTC Date corresponding to the given calendar components in Asia/Bangkok (UTC+7).
 */
export function createBangkokDate(
  year: number,
  month: number, // 1-12
  day: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
  milliseconds = 0,
): Date {
  const utcMs = Date.UTC(year, month - 1, day, hours, minutes, seconds, milliseconds);
  return new Date(utcMs - BANGKOK_OFFSET_MS);
}

/**
 * Returns the number of days in a given year and month (1-indexed: 1=Jan, 2=Feb, etc.).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Calculates the next occurrence of a recurring alarm or reminder in Asia/Bangkok.
 * Returns null if the schedule is non-recurring, completed, or exceeds guardrails.
 */
export function calculateNextOccurrence(config: RecurrenceConfig): Date | null {
  if (config.recurrence === 'once') {
    return null;
  }

  // Guardrail: iteration count check
  if (
    config.maxIterations !== undefined &&
    config.currentIteration !== undefined &&
    config.currentIteration >= config.maxIterations
  ) {
    return null;
  }

  const from = config.fromDate ?? new Date();

  // Guardrail: already past end date
  if (config.endDate && from >= config.endDate) {
    return null;
  }

  const fromBkk = getBangkokComponents(from);

  let targetHours: number;
  let targetMinutes: number;
  let targetSeconds = 0;

  if (config.time) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(config.time.trim());
    if (!match) {
      return null;
    }
    targetHours = Number(match[1]);
    targetMinutes = Number(match[2]);
  } else if (config.scheduledAt) {
    const schedBkk = getBangkokComponents(config.scheduledAt);
    targetHours = schedBkk.hours;
    targetMinutes = schedBkk.minutes;
    targetSeconds = schedBkk.seconds;
  } else {
    targetHours = fromBkk.hours;
    targetMinutes = fromBkk.minutes;
    targetSeconds = fromBkk.seconds;
  }

  let nextDate: Date | null = null;

  switch (config.recurrence) {
    case 'daily': {
      nextDate = createBangkokDate(
        fromBkk.year,
        fromBkk.month,
        fromBkk.day + 1,
        targetHours,
        targetMinutes,
        targetSeconds,
      );
      break;
    }

    case 'weekly': {
      const targetDays =
        config.daysOfWeek && config.daysOfWeek.length > 0 ? config.daysOfWeek : [fromBkk.dayOfWeek];
      const validDays = targetDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
      if (validDays.length === 0) {
        return null;
      }

      for (let i = 1; i <= 7; i++) {
        const candidate = createBangkokDate(
          fromBkk.year,
          fromBkk.month,
          fromBkk.day + i,
          targetHours,
          targetMinutes,
          targetSeconds,
        );
        const candidateBkk = getBangkokComponents(candidate);
        if (validDays.includes(candidateBkk.dayOfWeek)) {
          nextDate = candidate;
          break;
        }
      }
      break;
    }

    case 'monthly': {
      let nextYear = fromBkk.year;
      let nextMonth = fromBkk.month + 1;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear++;
      }

      const targetDay =
        config.dayOfMonth ??
        (config.scheduledAt ? getBangkokComponents(config.scheduledAt).day : fromBkk.day);

      const maxDays = getDaysInMonth(nextYear, nextMonth);
      const clampedDay = Math.min(Math.max(1, targetDay), maxDays);

      nextDate = createBangkokDate(
        nextYear,
        nextMonth,
        clampedDay,
        targetHours,
        targetMinutes,
        targetSeconds,
      );
      break;
    }

    default:
      return null;
  }

  if (!nextDate) {
    return null;
  }

  // Guardrail: next fire time exceeds cut-off date
  if (config.endDate && nextDate > config.endDate) {
    return null;
  }

  return nextDate;
}
