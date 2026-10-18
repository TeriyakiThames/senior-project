import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useTranslations } from 'next-intl';

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

  let fireDate: Date | null = null;
  if (reminder.nextFireAt) {
    if (
      typeof reminder.nextFireAt === 'object' &&
      reminder.nextFireAt !== null &&
      '_seconds' in reminder.nextFireAt &&
      typeof reminder.nextFireAt._seconds === 'number'
    ) {
      fireDate = new Date(reminder.nextFireAt._seconds * 1000);
    } else if (reminder.nextFireAt instanceof Date) {
      fireDate = reminder.nextFireAt;
    } else if (typeof reminder.nextFireAt === 'string') {
      fireDate = new Date(reminder.nextFireAt);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-senior-base font-semibold text-senior-text break-words">
            {reminder.message}
          </p>
          {fireDate && (
            <p className="text-senior-sm text-senior-muted mt-1">
              {fireDate.toLocaleDateString('th-TH', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
          {reminder.status === 'snoozed' && (
            <span className="inline-block mt-1 px-2.5 py-0.5 bg-yellow-50 text-yellow-700 text-xs rounded-full font-medium">
              Snoozed
            </span>
          )}
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
