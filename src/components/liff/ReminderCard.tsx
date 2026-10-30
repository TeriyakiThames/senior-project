'use client';

import { useTranslations, useLocale } from 'next-intl';
import {
  parseTimestamp,
  formatNoteTime,
  formatReminderCardHeader,
  formatAlarmRecurrence,
} from '@/lib/utils/date';

export interface ReminderItem {
  id: string;
  message: string;
  status: 'pending' | 'snoozed' | 'fired' | 'done' | string;
  scheduledAt?: { _seconds?: number } | string | Date | null;
  nextFireAt?: { _seconds?: number } | string | Date | null;
  recurrence?: string;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  enabled?: boolean;
}

export interface ReminderCardProps {
  reminder: ReminderItem;
  onDelete: () => void;
  baseNow?: Date;
}

export function ReminderCard({ reminder, onDelete, baseNow }: ReminderCardProps) {
  const t = useTranslations('dashboard');
  const locale = useLocale();

  const isSnoozed = reminder.status === 'snoozed';
  const isRecurring = Boolean(reminder.recurrence && reminder.recurrence !== 'once');

  // If snoozed and scheduledAt is present, header displays scheduled time,
  // while the snooze sub-notice displays nextFireAt.
  const scheduledDate = parseTimestamp(reminder.scheduledAt);
  const nextFireDate = parseTimestamp(reminder.nextFireAt);

  const headerDate = isSnoozed && scheduledDate ? scheduledDate : nextFireDate || scheduledDate;
  const headerInfo = headerDate ? formatReminderCardHeader(headerDate, locale, baseNow) : null;

  const snoozeDate = nextFireDate || scheduledDate;
  const snoozeTimeStr = isSnoozed && snoozeDate ? formatNoteTime(snoozeDate, locale) : '';

  const recurrenceLabel = formatAlarmRecurrence(
    {
      recurrence: reminder.recurrence,
      daysOfWeek: reminder.daysOfWeek,
      dayOfMonth: reminder.dayOfMonth,
    },
    locale,
  );

  return (
    <article className="bg-white rounded-3xl p-5 shadow-[0_2px_6px_rgba(33,33,92,0.06),0_8px_24px_rgba(33,33,92,0.08)] border border-[#F2F7FA]/80 transition-shadow">
      {/* Time & Date Header matching Figma specification */}
      {headerInfo && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-xl sm:text-2xl font-black text-[#21215C] tracking-tight tabular-nums">
            {headerInfo.time}
          </span>
          <span className="text-base sm:text-lg font-medium text-[#7D84A3]">
            · {headerInfo.dateLabel}
          </span>
        </div>
      )}

      {/* Reminder Message / Title */}
      <h3 className="text-xl sm:text-2xl font-bold text-[#21215C] leading-snug break-words whitespace-pre-line mb-1">
        {reminder.message}
      </h3>

      {/* Snooze Sub-notice (when snoozed) */}
      {isSnoozed && snoozeTimeStr && (
        <p className="text-base sm:text-lg font-medium text-[#7D84A3] mb-3">
          {t('willRemindAgain', { time: snoozeTimeStr })}
        </p>
      )}

      {/* Footer Badges & Action Row */}
      <div className="flex items-center justify-between gap-3 pt-2">
        {/* Status Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {isSnoozed && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-[#FBEFD8] text-[#7A4E00]">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>{t('snoozed')}</span>
            </span>
          )}

          {isRecurring ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-[#E1E8F8] text-[#385289]">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              <span>{recurrenceLabel}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-[#EAF0F6] text-[#4B4F72]">
              <span>{recurrenceLabel || t('once')}</span>
            </span>
          )}
        </div>

        {/* Outlined Crimson Red Delete Button matching Design System Ground Truth */}
        <button
          type="button"
          onClick={onDelete}
          aria-label={`${t('delete')} ${reminder.message}`}
          className="border-[1.5px] border-[#942626] bg-white text-[#942626] hover:bg-red-50 active:scale-[0.98] rounded-2xl px-4 py-2 flex items-center gap-1.5 font-bold text-base transition-all min-h-[48px] min-w-[76px] justify-center shrink-0 focus:outline-none focus:ring-2 focus:ring-[#942626]"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
          </svg>
          <span>{t('delete')}</span>
        </button>
      </div>
    </article>
  );
}
