'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useLiff } from '@/components/liff/LiffProvider';
import { useLiffData } from '@/hooks/useLiffData';
import { AlarmCard, type AlarmItem } from '@/components/liff/AlarmCard';
import { ReminderCard, type ReminderItem } from '@/components/liff/ReminderCard';
import { NoteCard, type NoteItem } from '@/components/liff/NoteCard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Loading } from '@/components/ui/Loading';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { formatDashboardDate } from '@/lib/utils/date';

interface DashboardData {
  alarms?: AlarmItem[];
  reminders?: ReminderItem[];
  notes?: NoteItem[];
}

export default function DashboardPage() {
  const locale = useLocale();
  const t = useTranslations('dashboard');
  const { isReady, displayName } = useLiff();
  const { data, loading, deleteItem } = useLiffData<DashboardData>('all');

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    type: 'alarm' | 'reminder' | 'note';
    title: string;
  } | null>(null);

  if (!isReady || loading) {
    return (
      <PageWrapper className="flex items-center justify-center min-h-[60vh]">
        <Loading message={t('loading')} />
      </PageWrapper>
    );
  }

  const alarms = data?.alarms ?? [];
  const reminders = data?.reminders ?? [];
  const notes = (data?.notes ?? []).slice(0, 3);

  const handleDeleteRequest = (id: string, type: 'alarm' | 'reminder' | 'note', title: string) => {
    setDeleteTarget({ id, type, title });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { id, type } = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteItem(id, type);
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  const handleCancelDelete = () => {
    setDeleteTarget(null);
  };

  return (
    <PageWrapper>
      <header className="mb-6">
        <h1 className="text-senior-2xl font-bold text-senior-text mb-1">
          {t('greeting', { name: displayName || '' })} 👋
        </h1>
        <p className="text-senior-sm text-senior-muted">
          {formatDashboardDate(new Date(), locale)}
        </p>
      </header>

      {/* Alarms Section */}
      <section className="mb-8" aria-labelledby="alarms-heading">
        <h2 id="alarms-heading" className="text-senior-lg font-bold text-senior-text mb-3">
          ⏰ {t('alarms')}
        </h2>
        {alarms.length === 0 ? (
          <p className="text-senior-base text-senior-muted bg-white p-4 rounded-card border border-gray-100 text-center">
            {t('noItems')}
          </p>
        ) : (
          <div className="space-y-3">
            {alarms.map((alarm) => (
              <AlarmCard
                key={alarm.id}
                alarm={alarm}
                onDelete={() => handleDeleteRequest(alarm.id, 'alarm', alarm.label || alarm.time)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Reminders Section */}
      <section className="mb-8" aria-labelledby="reminders-heading">
        <h2 id="reminders-heading" className="text-senior-lg font-bold text-senior-text mb-3">
          📋 {t('reminders')}
        </h2>
        {reminders.length === 0 ? (
          <p className="text-senior-base text-senior-muted bg-white p-4 rounded-card border border-gray-100 text-center">
            {t('noItems')}
          </p>
        ) : (
          <div className="space-y-3">
            {reminders.map((reminder) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                onDelete={() => handleDeleteRequest(reminder.id, 'reminder', reminder.message)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recent Notes Section (capped at top 3) */}
      <section className="mb-8" aria-labelledby="notes-heading">
        <h2 id="notes-heading" className="text-senior-lg font-bold text-senior-text mb-3">
          📝 {t('notes')}
        </h2>
        {notes.length === 0 ? (
          <p className="text-senior-base text-senior-muted bg-white p-4 rounded-card border border-gray-100 text-center">
            {t('noItems')}
          </p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onDelete={() => handleDeleteRequest(note.id, 'note', note.summary)}
              />
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title={t('confirmDeleteTitle')}
        message={
          deleteTarget?.title
            ? `"${deleteTarget.title}" — ${t('confirmDeleteMessage')}`
            : t('confirmDeleteMessage')
        }
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        confirmVariant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </PageWrapper>
  );
}
