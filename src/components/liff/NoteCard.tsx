'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useTranslations, useLocale } from 'next-intl';
import { parseTimestamp, formatReminderDate } from '@/lib/utils/date';

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
  const isVoice = note.source === 'voice';

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-senior-base font-semibold text-senior-text break-words">
            {note.summary}
          </p>
          <div className="text-senior-sm text-senior-muted mt-1.5 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
              aria-label={isVoice ? t('voiceSource') : t('textSource')}
            >
              <span aria-hidden="true">{isVoice ? '🎤' : '⌨️'}</span>
              <span>{isVoice ? t('voiceSource') : t('textSource')}</span>
            </span>
            {createDate && (
              <span className="tabular-nums">{formatReminderDate(createDate, locale)}</span>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="danger"
          onClick={onDelete}
          aria-label={`${t('delete')} ${note.summary}`}
          className="shrink-0"
        >
          {t('delete')}
        </Button>
      </div>
    </Card>
  );
}
