'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useLiff } from '@/components/liff/LiffProvider';
import { useLiffData } from '@/hooks/useLiffData';
import { AlarmCard, type AlarmItem } from '@/components/liff/AlarmCard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Loading } from '@/components/ui/Loading';
import { PageWrapper } from '@/components/layout/PageWrapper';

interface AlarmsData {
  alarms?: AlarmItem[];
}

export default function AlarmsPage() {
  const locale = useLocale();
  const t = useTranslations('dashboard');
  const { isReady } = useLiff();
  const { data, loading, deleteItem } = useLiffData<AlarmsData>('alarms');

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
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

  const handleDeleteRequest = (id: string, title: string) => {
    setDeleteTarget({ id, title });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteItem(id, 'alarm');
    } catch (err) {
      console.error('Failed to delete alarm:', err);
    }
  };

  const handleCancelDelete = () => {
    setDeleteTarget(null);
  };

  return (
    <PageWrapper>
      {/* Top Header with Back Navigation */}
      <header className="mb-6">
        <Link
          href={`/${locale}/liff`}
          className="inline-flex items-center gap-1.5 text-senior-base text-senior-muted hover:text-senior-text min-h-touch py-2 font-medium focus:outline-none focus:ring-2 focus:ring-line-green rounded-md mb-1"
          aria-label={t('back')}
        >
          <span aria-hidden="true">←</span>
          <span>{t('back')}</span>
        </Link>
        <h1 className="text-senior-2xl font-bold text-senior-text">⏰ {t('alarms')}</h1>
      </header>

      {/* Alarms Content */}
      <section aria-labelledby="alarms-list-heading">
        <h2 id="alarms-list-heading" className="sr-only">
          {t('alarms')}
        </h2>

        {alarms.length === 0 ? (
          <div className="bg-white rounded-card border border-gray-200 p-6 text-center shadow-sm">
            <div
              className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl"
              aria-hidden="true"
            >
              ⏰
            </div>
            <p className="text-senior-lg font-bold text-senior-text mb-2">
              {t('emptyAlarmsTitle')}
            </p>
            <div className="bg-senior-bg border border-green-200 rounded-card p-4 mt-4 inline-block text-left w-full">
              <p className="text-senior-sm font-semibold text-line-green flex items-center gap-1.5 mb-1">
                <span aria-hidden="true">💡</span>
                <span>{locale.startsWith('th') ? 'คำแนะนำ' : 'Tip'}</span>
              </p>
              <p className="text-senior-base text-senior-text">{t('emptyAlarmsHint')}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {alarms.map((alarm) => (
              <AlarmCard
                key={alarm.id}
                alarm={alarm}
                onDelete={() => handleDeleteRequest(alarm.id, alarm.label || alarm.time)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Confirmation Dialog */}
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
