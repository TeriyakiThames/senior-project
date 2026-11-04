'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useLiff } from '@/components/liff/LiffProvider';
import { useLiffData } from '@/hooks/useLiffData';
import { TimerCard, type TimerItem } from '@/components/liff/TimerCard';
import { DetailHeader } from '@/components/layout/DetailHeader';
import { TipBanner } from '@/components/ui/TipBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Toast } from '@/components/ui/Toast';
import { getTimerNextFireDate } from '@/lib/utils/date';

interface TimersData {
  timers?: TimerItem[];
  alarms?: TimerItem[];
}

export default function TimerPage() {
  const locale = useLocale();
  const t = useTranslations('dashboard');
  const { isReady } = useLiff();
  const { data, loading, deleteItem } = useLiffData<TimersData>('timers');

  const [deleteTarget, setDeleteTarget] = useState<TimerItem | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const timers = useMemo(() => data?.timers ?? data?.alarms ?? [], [data?.timers, data?.alarms]);

  // Sort timers chronologically by next trigger date ascending (soonest first)
  const sortedTimers = useMemo(() => {
    const list = [...timers];
    return list.sort((a, b) => {
      const nextA = getTimerNextFireDate(a)?.getTime() ?? 0;
      const nextB = getTimerNextFireDate(b)?.getTime() ?? 0;
      if (nextA && nextB && nextA !== nextB) {
        return nextA - nextB;
      }
      return (a.time || '').localeCompare(b.time || '');
    });
  }, [timers]);

  const handleDeleteRequest = (timer: TimerItem) => {
    setDeleteTarget(timer);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setIsDeleting(true);
    try {
      await deleteItem(id, 'timer');
      setDeleteTarget(null);
      setShowToast(true);
    } catch (err) {
      console.error('Failed to delete timer:', err);
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

  const pageTitle = t('timer');
  const pageSubtitle =
    timers.length > 0 ? t('timersSubtitle', { count: timers.length }) : undefined;
  const emptyTitle = t('emptyTimersTitle');
  const tipTitle = t('tipTimerTitle');
  const tipHint = t('tipTimerHint');
  const confirmDeleteTitle = t('confirmDeleteTimerTitle');
  const deleteBtnLabel = t('deleteTimer');
  const toastMessage = t('timerDeletedToast');

  return (
    <div className="min-h-screen bg-[#F2F7FA] text-[#21215C]">
      {/* Top LINE Service App Bar + Category Header matching Figma Ground Truth */}
      <DetailHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        badgeBgColor="bg-[#FBEFD8]"
        badgeIcon={
          <Image
            src="/icons/clock.svg"
            alt=""
            width={26}
            height={26}
            unoptimized
            aria-hidden="true"
          />
        }
      />

      <main className="px-5 pt-1 pb-16 max-w-[440px] mx-auto">
        {sortedTimers.length === 0 ? (
          /* Empty State matching Figma Specification */
          <EmptyState
            badgeBgColor="bg-[#FBEFD8]"
            badgeIcon={
              <Image
                src="/icons/clock.svg"
                alt=""
                width={56}
                height={56}
                unoptimized
                aria-hidden="true"
              />
            }
            title={emptyTitle}
            description={
              <div className="space-y-1">
                <p>{t('emptyTimersHintLine1')}</p>
                <p>{t('emptyTimersHintLine2')}</p>
              </div>
            }
            actionLabel={t('goToChat')}
            actionButtonColor="bg-[#3E81F7]"
          />
        ) : (
          /* Timer Cards List + Bottom Speech Tip Banner matching Provided UI */
          <div>
            <div className="space-y-4">
              {sortedTimers.map((timer) => (
                <TimerCard
                  key={timer.id}
                  timer={timer}
                  onDelete={() => handleDeleteRequest(timer)}
                />
              ))}
            </div>

            {/* Bottom Natural Speech Guidance Tip Banner */}
            <div className="mt-6">
              <TipBanner title={tipTitle} description={tipHint} />
            </div>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal matching Figma & Note Page Standard */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title={confirmDeleteTitle}
        contentPreview={
          deleteTarget
            ? deleteTarget.label
              ? `${deleteTarget.time ? `${deleteTarget.time}${isThai ? ' น.' : ''} · ` : ''}${deleteTarget.label}`
              : deleteTarget.time
                ? `${deleteTarget.time}${isThai ? ' น.' : ''}`
                : deleteTarget.durationMinutes
                  ? `${deleteTarget.durationMinutes} ${isThai ? 'นาที' : 'min'}`
                  : pageTitle
            : ''
        }
        warningText={t('confirmDeleteWarning')}
        confirmLabel={deleteBtnLabel}
        cancelLabel={t('doNotDelete')}
        confirmVariant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      {/* Floating Bottom Toast Feedback matching Figma Standard */}
      <Toast
        isOpen={showToast}
        message={toastMessage}
        durationMs={3000}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
}
