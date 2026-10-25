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

/**
 * Base schedule calculator encapsulating Asia/Bangkok date calculations and recurrence logic.
 */
export abstract class BaseScheduleCalculator {
  protected readonly now: Date;
  protected readonly nowBkk: BangkokDateComponents;

  constructor(now: Date = new Date()) {
    this.now = now;
    this.nowBkk = getBangkokComponents(now);
  }

  /**
   * Computes the next scheduled trigger Date in UTC for Asia/Bangkok context.
   */
  abstract calculateNextFireTime(): Date | null;

  /**
   * Helper to check if a candidate Date in Asia/Bangkok is strictly in the future relative to `now`.
   */
  protected isFuture(candidate: Date): boolean {
    return candidate.getTime() > this.now.getTime();
  }

  /**
   * Finds the next matching weekly date given target hours, minutes, and allowed days of week.
   */
  protected calculateNextWeeklyDate(
    hours: number,
    minutes: number,
    daysOfWeek?: number[],
    checkToday = true,
  ): Date | null {
    const targetDays =
      daysOfWeek && daysOfWeek.length > 0
        ? daysOfWeek.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        : [this.nowBkk.dayOfWeek];

    if (targetDays.length === 0) {
      return null;
    }

    if (checkToday) {
      const candidateToday = createBangkokDate(
        this.nowBkk.year,
        this.nowBkk.month,
        this.nowBkk.day,
        hours,
        minutes,
        0,
        0,
      );
      if (targetDays.includes(this.nowBkk.dayOfWeek) && this.isFuture(candidateToday)) {
        return candidateToday;
      }
    }

    for (let i = 1; i <= 7; i++) {
      const candidate = createBangkokDate(
        this.nowBkk.year,
        this.nowBkk.month,
        this.nowBkk.day + i,
        hours,
        minutes,
        0,
        0,
      );
      const candidateBkk = getBangkokComponents(candidate);
      if (targetDays.includes(candidateBkk.dayOfWeek)) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * Finds the next matching monthly date given target hours, minutes, and target day of month.
   */
  protected calculateNextMonthlyDate(
    hours: number,
    minutes: number,
    dayOfMonth?: number,
    checkToday = true,
  ): Date | null {
    const targetDay = dayOfMonth ?? this.nowBkk.day;

    if (checkToday) {
      const candidateToday = createBangkokDate(
        this.nowBkk.year,
        this.nowBkk.month,
        this.nowBkk.day,
        hours,
        minutes,
        0,
        0,
      );
      if (this.nowBkk.day === targetDay && this.isFuture(candidateToday)) {
        return candidateToday;
      }
    }

    let nextYear = this.nowBkk.year;
    let nextMonth = this.nowBkk.month + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear++;
    }

    const maxDays = getDaysInMonth(nextYear, nextMonth);
    const clampedDay = Math.min(Math.max(1, targetDay), maxDays);

    return createBangkokDate(nextYear, nextMonth, clampedDay, hours, minutes, 0, 0);
  }
}

export interface AlarmScheduleParams {
  time?: string | null;
  recurrence?: Recurrence;
  daysOfWeek?: number[];
  dayOfMonth?: number;
}

/**
 * Schedule calculator for alarm entities specified with 24h "HH:mm" time strings.
 */
export class AlarmScheduleCalculator extends BaseScheduleCalculator {
  private readonly params: AlarmScheduleParams;

  constructor(params: AlarmScheduleParams, now: Date = new Date()) {
    super(now);
    this.params = params;
  }

  calculateNextFireTime(): Date | null {
    if (!this.params.time) {
      return null;
    }

    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(this.params.time.trim());
    if (!match) {
      return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const recurrence = this.params.recurrence ?? 'once';

    if (recurrence === 'weekly') {
      return this.calculateNextWeeklyDate(hours, minutes, this.params.daysOfWeek, true);
    }

    if (recurrence === 'monthly') {
      return this.calculateNextMonthlyDate(hours, minutes, this.params.dayOfMonth, true);
    }

    // Recurrence 'once' or 'daily'
    const candidateToday = createBangkokDate(
      this.nowBkk.year,
      this.nowBkk.month,
      this.nowBkk.day,
      hours,
      minutes,
      0,
      0,
    );

    if (this.isFuture(candidateToday)) {
      return candidateToday;
    }

    return createBangkokDate(
      this.nowBkk.year,
      this.nowBkk.month,
      this.nowBkk.day + 1,
      hours,
      minutes,
      0,
      0,
    );
  }
}

export interface ReminderScheduleParams {
  scheduledAt?: string | Date | null;
  recurrence?: Recurrence;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  fallbackMinutes?: number;
}

/**
 * Schedule calculator for reminder entities specified with ISO date strings or Timestamps.
 */
export class ReminderScheduleCalculator extends BaseScheduleCalculator {
  private readonly params: ReminderScheduleParams;

  constructor(params: ReminderScheduleParams, now: Date = new Date()) {
    super(now);
    this.params = params;
  }

  calculateNextFireTime(): Date | null {
    const fallbackMs = (this.params.fallbackMinutes ?? 10) * 60 * 1000;
    const defaultDate = new Date(this.now.getTime() + fallbackMs);

    if (!this.params.scheduledAt) {
      return defaultDate;
    }

    if (typeof this.params.scheduledAt === 'string' && !this.params.scheduledAt.trim()) {
      return defaultDate;
    }

    const target =
      this.params.scheduledAt instanceof Date
        ? this.params.scheduledAt
        : new Date(this.params.scheduledAt);

    if (isNaN(target.getTime())) {
      return defaultDate;
    }

    if (this.isFuture(target)) {
      return target;
    }

    const recurrence = this.params.recurrence ?? 'once';

    if (recurrence === 'weekly' || recurrence === 'monthly') {
      const next = calculateNextOccurrence({
        recurrence,
        scheduledAt: target,
        daysOfWeek: this.params.daysOfWeek,
        dayOfMonth: this.params.dayOfMonth,
        fromDate: this.now,
      });
      if (next) {
        return next;
      }
    }

    // Single or daily reminder: shift target times that fall in the past forward by 24 hours
    let fireAt = new Date(target.getTime() + 24 * 60 * 60 * 1000);
    while (fireAt.getTime() <= this.now.getTime()) {
      fireAt = new Date(fireAt.getTime() + 24 * 60 * 60 * 1000);
    }

    return fireAt;
  }
}
