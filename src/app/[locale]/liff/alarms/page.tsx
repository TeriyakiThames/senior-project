'use client';

import { useState, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useLiff } from '@/components/liff/LiffProvider';
import { useLiffData } from '@/hooks/useLiffData';
import { AlarmCard, type AlarmItem } from '@/components/liff/AlarmCard';
import { DetailHeader } from '@/components/layout/DetailHeader';
import { TipBanner } from '@/components/ui/TipBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Toast } from '@/components/ui/Toast';
import { getAlarmNextFireDate } from '@/lib/utils/date';

interface AlarmsData {
  alarms?: AlarmItem[];
}

export default function AlarmsPage() {
  const locale = useLocale();
  const t = useTranslations('dashboard');
  const { isReady } = useLiff();
  const { data, loading, deleteItem } = useLiffData<AlarmsData>('alarms');

  const [deleteTarget, setDeleteTarget] = useState<AlarmItem | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const alarms = useMemo(() => data?.alarms ?? [], [data?.alarms]);

  // Sort alarms chronologically by next trigger date ascending (soonest first)
  const sortedAlarms = useMemo(() => {
    const list = [...alarms];
    return list.sort((a, b) => {
      const nextA = getAlarmNextFireDate(a)?.getTime() ?? 0;
      const nextB = getAlarmNextFireDate(b)?.getTime() ?? 0;
      if (nextA && nextB && nextA !== nextB) {
        return nextA - nextB;
      }
      return (a.time || '').localeCompare(b.time || '');
    });
  }, [alarms]);

  const handleDeleteRequest = (alarm: AlarmItem) => {
    setDeleteTarget(alarm);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setIsDeleting(true);
    try {
      await deleteItem(id, 'alarm');
      setDeleteTarget(null);
      setShowToast(true);
    } catch (err) {
      console.error('Failed to delete alarm:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    if (isDeleting) return;
    setDeleteTarget(null);
  };

  if (!isReady || loading) {
    return (
      <div className="min-h-screen bg-[#F2F7FA] flex items-center justify-center p-6">
        <div className="text-center">
          <div
            className="w-12 h-12 border-4 border-[#3E81F7] border-t-transparent rounded-full animate-spin mx-auto mb-4"
            aria-hidden="true"
          />
          <p className="text-[#21215C] text-senior-base font-semibold">{t('loading')}</p>
        </div>
      </div>
    );
  }

  const isThai = locale.toLowerCase().startsWith('th');

  return (
    <div className="min-h-screen bg-[#F2F7FA] text-[#21215C]">
      {/* Top LINE Service App Bar + Category Header matching Figma Ground Truth */}
      <DetailHeader
        title={t('alarms')}
        subtitle={alarms.length > 0 ? t('alarmsSubtitle', { count: alarms.length }) : undefined}
        badgeBgColor="bg-[#FBEFD8]"
        badgeIcon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 4l3 2M20 4l-3 2" stroke="#7A4E00" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="12" cy="13" r="8" fill="#FCCE57" stroke="#7A4E00" strokeWidth="2" />
            <path
              d="M12 9v4l2.5 1.5"
              stroke="#7A4E00"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M6.5 20l1.5-2M17.5 20l-1.5-2"
              stroke="#7A4E00"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        }
      />

      <main className="px-5 pt-1 pb-16 max-w-[440px] mx-auto">
        {sortedAlarms.length === 0 ? (
          /* Empty State matching Figma Specification */
          <EmptyState
            badgeBgColor="bg-[#FBEFD8]"
            badgeIcon={
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 4l3 2M20 4l-3 2"
                  stroke="#7A4E00"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="13" r="8" fill="#FCCE57" stroke="#7A4E00" strokeWidth="2" />
                <path
                  d="M12 9v4l2.5 1.5"
                  stroke="#7A4E00"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M6.5 20l1.5-2M17.5 20l-1.5-2"
                  stroke="#7A4E00"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            }
            title={t('emptyAlarmsTitle')}
            description={
              <div className="space-y-1">
                <p>{t('emptyAlarmsHintLine1')}</p>
                <p>{t('emptyAlarmsHintLine2')}</p>
              </div>
            }
            actionLabel={t('goToChat')}
            actionButtonColor="bg-[#3E81F7]"
          />
        ) : (
          /* Alarm Cards List + Bottom Speech Tip Banner matching Provided UI */
          <div>
            <div className="space-y-4">
              {sortedAlarms.map((alarm) => (
                <AlarmCard
                  key={alarm.id}
                  alarm={alarm}
                  onDelete={() => handleDeleteRequest(alarm)}
                />
              ))}
            </div>

            {/* Bottom Natural Speech Guidance Tip Banner */}
            <div className="mt-6">
              <TipBanner title={t('tipAlarmTitle')} description={t('tipAlarmHint')} />
            </div>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal matching Figma & Note Page Standard */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title={t('confirmDeleteAlarmTitle')}
        contentPreview={
          deleteTarget
            ? deleteTarget.label
              ? `${deleteTarget.time}${isThai ? ' น.' : ''} · ${deleteTarget.label}`
              : `${deleteTarget.time}${isThai ? ' น.' : ''}`
            : ''
        }
        warningText={t('confirmDeleteWarning')}
        confirmLabel={t('deleteAlarm')}
        cancelLabel={t('doNotDelete')}
        confirmVariant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      {/* Floating Bottom Toast Feedback matching Figma Standard */}
      <Toast
        isOpen={showToast}
        message={t('alarmDeletedToast')}
        durationMs={3000}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
}
