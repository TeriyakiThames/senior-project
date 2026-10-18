import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useTranslations } from 'next-intl';

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

  let createDate: Date | null = null;
  if (note.createdAt) {
    if (
      typeof note.createdAt === 'object' &&
      note.createdAt !== null &&
      '_seconds' in note.createdAt &&
      typeof note.createdAt._seconds === 'number'
    ) {
      createDate = new Date(note.createdAt._seconds * 1000);
    } else if (note.createdAt instanceof Date) {
      createDate = note.createdAt;
    } else if (typeof note.createdAt === 'string') {
      createDate = new Date(note.createdAt);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-senior-base font-semibold text-senior-text break-words">
            {note.summary}
          </p>
          <p className="text-senior-sm text-senior-muted mt-1 flex items-center gap-1.5">
            <span aria-hidden="true">{note.source === 'voice' ? '🎤' : '⌨️'}</span>
            {createDate && (
              <span>
                {createDate.toLocaleDateString('th-TH', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </p>
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
