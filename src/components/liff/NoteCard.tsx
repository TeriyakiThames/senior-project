'use client';

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
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                aria-hidden="true"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" strokeLinecap="round" />
              </svg>
            ) : (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                aria-hidden="true"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h8M6 16h.01M18 16h.01" />
              </svg>
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
