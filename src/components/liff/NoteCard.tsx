'use client';

import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { parseTimestamp, formatNoteTime } from '@/lib/utils/date';

export interface NoteItem {
  id: string;
  summary: string;
  content?: string;
  source?: string;
  createdAt?: { _seconds?: number } | string | Date | null;
}

export interface NoteCardProps {
  note: NoteItem;
  onDelete: () => void;
}

export function NoteCard({ note, onDelete }: NoteCardProps) {
  const t = useTranslations('dashboard');
  const locale = useLocale();

  const createDate = parseTimestamp(note.createdAt);
  const isVoice = note.source === 'voice' || note.source?.includes('voice');
  const displayText = note.content || note.summary;

  return (
    <article className="bg-white rounded-3xl p-5 shadow-[0_2px_6px_rgba(33,33,92,0.06),0_8px_24px_rgba(33,33,92,0.08)] border border-[#F2F7FA]/80 transition-shadow">
      {/* Note Main Body */}
      <p className="text-[#21215C] text-lg font-medium leading-relaxed break-words mb-4">
        {displayText}
      </p>

      {/* Footer Meta & Action Row */}
      <div className="flex items-center justify-between gap-3 pt-1">
        {/* Source Badge & Timestamp */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-[#EAF0F6] text-[#21215C]">
            {isVoice ? (
              <Image
                src="/icons/microphone_small.svg"
                alt=""
                width={14}
                height={14}
                unoptimized
                aria-hidden="true"
              />
            ) : (
              <Image
                src="/icons/keyboard.svg"
                alt=""
                width={14}
                height={14}
                unoptimized
                aria-hidden="true"
              />
            )}
            <span>{isVoice ? t('voice') : t('typed')}</span>
          </span>

          {createDate && (
            <span className="text-sm font-medium text-[#7D84A3] tabular-nums">
              {formatNoteTime(createDate, locale)}
            </span>
          )}
        </div>

        {/* Outlined Crimson Red Delete Button matching Figma Image 1 */}
        <button
          type="button"
          onClick={onDelete}
          aria-label={`${t('delete')} ${displayText}`}
          className="border border-[#942626] bg-white text-[#942626] hover:bg-red-50 active:scale-[0.98] rounded-2xl px-4 py-2 flex items-center gap-1.5 font-bold text-base transition-all min-h-[48px] min-w-[72px] justify-center shrink-0 focus:outline-none focus:ring-2 focus:ring-[#942626]"
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
