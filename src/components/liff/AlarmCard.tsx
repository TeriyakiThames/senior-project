'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useTranslations, useLocale } from 'next-intl';
import { formatRecurrenceLabel } from '@/lib/utils/date';

export interface AlarmItem {
  id: string;
  time: string;
  label?: string;
  recurrence: string;
  enabled?: boolean;
}

export interface AlarmCardProps {
  alarm: AlarmItem;
  onDelete: () => void;
}

export function AlarmCard({ alarm, onDelete }: AlarmCardProps) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const recurrenceText = formatRecurrenceLabel(alarm.recurrence, locale);

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-senior-xl font-bold tabular-nums text-senior-text">{alarm.time}</p>
          {alarm.label && (
            <p className="text-senior-sm text-senior-muted truncate mt-0.5">{alarm.label}</p>
          )}
          {recurrenceText && (
            <span className="inline-block mt-1 px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
              {recurrenceText}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="danger"
          onClick={onDelete}
          aria-label={`${t('delete')} ${alarm.time}`}
          className="shrink-0"
        >
          {t('delete')}
        </Button>
      </div>
    </Card>
  );
}
