'use client';

import { useTranslations, useLocale } from 'next-intl';
import { formatAlarmRecurrence, formatAlarmNextFire, getAlarmNextFireDate } from '@/lib/utils/date';

export interface AlarmItem {
  id: string;
  time: string;
  label?: string;
  recurrence: string;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  enabled?: boolean;
  nextFireAt?: { _seconds?: number } | string | Date | null;
  createdAt?: { _seconds?: number } | string | Date | null;
}

export interface AlarmCardProps {
  alarm: AlarmItem;
  onDelete: () => void;
  baseNow?: Date;
}

export function AlarmCard({ alarm, onDelete, baseNow }: AlarmCardProps) {
  const t = useTranslations('dashboard');
  const locale = useLocale();

  const isEnabled = alarm.enabled !== false;
  const recurrenceLabel = formatAlarmRecurrence(
    {
      recurrence: alarm.recurrence,
      daysOfWeek: alarm.daysOfWeek,
      dayOfMonth: alarm.dayOfMonth,
    },
    locale,
  );

  const nextFireDate = getAlarmNextFireDate(alarm, baseNow);
  const nextFireText = nextFireDate ? formatAlarmNextFire(nextFireDate, locale, baseNow) : '-';

  return (
    <article className="bg-white rounded-3xl p-5 shadow-[0_2px_6px_rgba(33,33,92,0.06),0_8px_24px_rgba(33,33,92,0.08)] border border-[#F2F7FA]/80 transition-shadow">
      {/* Large 24h Time Display matching Figma Ground Truth */}
      <div className="flex items-baseline">
        <span className="text-4xl sm:text-5xl font-black text-[#21215C] tracking-tight tabular-nums">
          {alarm.time}
        </span>
        {locale.toLowerCase().startsWith('th') && (
          <span className="text-xl sm:text-2xl font-bold text-[#21215C] ml-1">น.</span>
        )}
      </div>

      {/* Alarm Description / Label */}
      {alarm.label && (
        <h3 className="text-xl font-bold text-[#21215C] mt-1.5 mb-2.5 break-words">
          {alarm.label}
        </h3>
      )}

      {/* Status Badges Row: Recurrence & Enabled Indicator */}
      <div className="flex items-center gap-2.5 flex-wrap mb-4">
        {recurrenceLabel && (
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
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            <span>{recurrenceLabel}</span>
          </span>
        )}

        <div
          className={`inline-flex items-center gap-1.5 text-sm font-bold ${
            isEnabled ? 'text-[#16A34A]' : 'text-[#7D84A3]'
          }`}
        >
          {isEnabled ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" fill="#16A34A" />
              <polyline
                points="8 12 11 15 16 9"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="#7D84A3" strokeWidth="2" />
              <line
                x1="8"
                y1="12"
                x2="16"
                y2="12"
                stroke="#7D84A3"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          )}
          <span>{isEnabled ? t('alarmEnabled') : t('alarmDisabled')}</span>
        </div>
      </div>

      {/* Bottom Info & Action Row */}
      <div className="flex items-end justify-between gap-3 pt-1">
        {/* Next Trigger Info */}
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-sm font-medium text-[#7D84A3] mb-0.5">{t('nextAlarm')}</p>
          <p className="text-base sm:text-lg font-bold text-[#21215C] leading-snug break-words">
            {nextFireText}
          </p>
        </div>

        {/* Outlined Crimson Red Delete Button matching NoteCard / Figma */}
        <button
          type="button"
          onClick={onDelete}
          aria-label={`${t('delete')} ${alarm.label || alarm.time}`}
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
