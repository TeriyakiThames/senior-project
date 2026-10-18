'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useTranslations, useLocale } from 'next-intl';
import { parseTimestamp, formatReminderDate, formatRecurrenceLabel } from '@/lib/utils/date';

export interface ReminderItem {
  id: string;
  message: string;
  status: string;
  nextFireAt?: { _seconds?: number } | string | Date | null;
  recurrence?: string;
}

export interface ReminderCardProps {
  reminder: ReminderItem;
  onDelete: () => void;
}

export function ReminderCard({ reminder, onDelete }: ReminderCardProps) {
  const t = useTranslations('dashboard');
  const locale = useLocale();

  const fireDate = parseTimestamp(reminder.nextFireAt);
  const recurrenceText = formatRecurrenceLabel(reminder.recurrence, locale);

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-senior-base font-semibold text-senior-text break-words">
            {reminder.message}
          </p>
          {fireDate && (
            <p className="text-senior-sm text-senior-muted mt-1 tabular-nums">
              {formatReminderDate(fireDate, locale)}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {recurrenceText && (
              <span className="inline-block px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                {recurrenceText}
              </span>
            )}
            {reminder.status === 'snoozed' && (
              <span className="inline-block px-2.5 py-0.5 bg-yellow-50 text-yellow-700 text-xs rounded-full font-medium">
                {t('snoozed')}
              </span>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="danger"
          onClick={onDelete}
          aria-label={`${t('delete')} ${reminder.message}`}
          className="shrink-0"
        >
          {t('delete')}
        </Button>
      </div>
    </Card>
  );
}
