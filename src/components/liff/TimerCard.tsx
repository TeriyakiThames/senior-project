'use client';

import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { formatTimerRecurrence, formatTimerNextFire, getTimerNextFireDate } from '@/lib/utils/date';

export interface TimerItem {
  id: string;
  time?: string;
  durationMinutes?: number;
  hours?: number;
  minutes?: number;
  label?: string;
  recurrence?: string;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  enabled?: boolean;
  status?: string;
  nextFireAt?: { _seconds?: number; seconds?: number; toDate?: () => Date } | string | Date | null;
  createdAt?: { _seconds?: number; seconds?: number; toDate?: () => Date } | string | Date | null;
}

export interface TimerCardProps {
  timer: TimerItem;
  onDelete: () => void;
  baseNow?: Date;
}

export function TimerCard({ timer, onDelete, baseNow }: TimerCardProps) {
  const item = timer;
  const t = useTranslations('dashboard');
  const locale = useLocale();

  const isEnabled = item.enabled !== false;
  const recurrenceLabel = formatTimerRecurrence(
    {
      recurrence: item.recurrence,
      daysOfWeek: item.daysOfWeek,
      dayOfMonth: item.dayOfMonth,
    },
    locale,
  );

  const nextFireDate = getTimerNextFireDate(item, baseNow);
  const nextFireText = nextFireDate ? formatTimerNextFire(nextFireDate, locale, baseNow) : '-';

  const isThai = locale.toLowerCase().startsWith('th');
  const isDurationTimer = !item.time && Boolean(item.durationMinutes);

  const displayTime =
    typeof item.time === 'string' && item.time.trim()
      ? item.time.trim()
      : isDurationTimer && item.durationMinutes
        ? `${item.durationMinutes}`
        : nextFireDate
          ? `${String(nextFireDate.getHours()).padStart(2, '0')}:${String(nextFireDate.getMinutes()).padStart(2, '0')}`
          : '--:--';

  const showThaiHourSuffix =
    isThai &&
    (Boolean(item.time) ||
      (!isDurationTimer && Boolean(nextFireDate)) ||
      (!item.time && !item.durationMinutes));

  const showDurationUnit = isDurationTimer;

  const enabledLabel = t('timerEnabled');
  const disabledLabel = t('timerDisabled');
  const nextTimerLabel = t('nextTimer');

  return (
    <article className="bg-white rounded-3xl p-5 shadow-[0_2px_6px_rgba(33,33,92,0.06),0_8px_24px_rgba(33,33,92,0.08)] border border-[#F2F7FA]/80 transition-shadow">
      {/* Large 24h Time Display matching Figma Ground Truth */}
      <div className="flex items-baseline">
        <span className="text-4xl sm:text-5xl font-black text-[#21215C] tracking-tight tabular-nums">
          {displayTime}
        </span>
        {showThaiHourSuffix && (
          <span className="text-xl sm:text-2xl font-bold text-[#21215C] ml-1">น.</span>
        )}
        {showDurationUnit && (
          <span className="text-xl sm:text-2xl font-bold text-[#21215C] ml-1">
            {isThai ? 'นาที' : 'min'}
          </span>
        )}
      </div>

      {/* Timer Description / Label */}
      {item.label && (
        <h3 className="text-xl font-bold text-[#21215C] mt-1.5 mb-2.5 break-words">{item.label}</h3>
      )}

      {/* Status Badges Row: Recurrence & Enabled Indicator */}
      <div className="flex items-center gap-2.5 flex-wrap mb-4">
        {recurrenceLabel && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-[#FBEFD8] text-[#7A4E00]">
            <Image
              src="/icons/recurring.svg"
              alt=""
              width={14}
              height={14}
              unoptimized
              aria-hidden="true"
            />
            <span>{recurrenceLabel}</span>
          </span>
        )}

        <div
          className={`inline-flex items-center gap-1.5 text-sm font-bold ${
            isEnabled ? 'text-[#16A34A]' : 'text-[#7D84A3]'
          }`}
        >
          {isEnabled ? (
            <Image
              src="/icons/active_tick.svg"
              alt=""
              width={16}
              height={16}
              unoptimized
              aria-hidden="true"
            />
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
          <span>{isEnabled ? enabledLabel : disabledLabel}</span>
        </div>
      </div>

      {/* Bottom Info & Action Row */}
      <div className="flex items-end justify-between gap-3 pt-1">
        {/* Next Trigger Info */}
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-sm font-medium text-[#7D84A3] mb-0.5">{nextTimerLabel}</p>
          <p className="text-base sm:text-lg font-bold text-[#21215C] leading-snug break-words">
            {nextFireText}
          </p>
        </div>

        {/* Outlined Crimson Red Delete Button matching NoteCard / Figma */}
        <button
          type="button"
          onClick={onDelete}
          aria-label={`${t('delete')} ${item.label || item.time || displayTime}`}
          className="border-[1.5px] border-[#942626] bg-white text-[#942626] hover:bg-red-50 active:scale-[0.98] rounded-2xl px-4 py-2 flex items-center gap-1.5 font-bold text-base transition-all min-h-[48px] min-w-[76px] justify-center shrink-0 focus:outline-none focus:ring-2 focus:ring-[#942626]"
        >
          <Image
            src="/icons/trashbin.svg"
            alt=""
            width={16}
            height={16}
            unoptimized
            aria-hidden="true"
          />
          <span>{t('delete')}</span>
        </button>
      </div>
    </article>
  );
}
