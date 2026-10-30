'use client';

import { useState, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useLiff } from '@/components/liff/LiffProvider';
import { useLiffData } from '@/hooks/useLiffData';
import { ReminderCard, type ReminderItem } from '@/components/liff/ReminderCard';
import { DetailHeader } from '@/components/layout/DetailHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Toast } from '@/components/ui/Toast';
import { groupRemindersByTimeline, parseTimestamp } from '@/lib/utils/date';

interface RemindersData {
  reminders?: ReminderItem[];
}

export default function RemindersPage() {
  const locale = useLocale();
  const t = useTranslations('dashboard');
  const { isReady } = useLiff();
  const { data, loading, deleteItem } = useLiffData<RemindersData>('reminders');

  const [deleteTarget, setDeleteTarget] = useState<ReminderItem | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter out any completed items to strictly guarantee only active reminders are shown
  const reminders = useMemo(
    () => (data?.reminders ?? []).filter((r) => r.status !== 'done'),
    [data?.reminders],
  );

  const timelineGroups = useMemo(() => {
    return groupRemindersByTimeline(reminders, locale);
  }, [reminders, locale]);

  const handleDeleteRequest = (reminder: ReminderItem) => {
    setDeleteTarget(reminder);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setIsDeleting(true);
    try {
      await deleteItem(id, 'reminder');
      setDeleteTarget(null);
      setShowToast(true);
    } catch (err) {
      console.error('Failed to delete reminder:', err);
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

  const deleteTargetPreview = deleteTarget
    ? (() => {
        const d = parseTimestamp(deleteTarget.nextFireAt || deleteTarget.scheduledAt);
        if (d) {
          const hours = String(d.getHours()).padStart(2, '0');
          const minutes = String(d.getMinutes()).padStart(2, '0');
          const timeStr = isThai ? `${hours}:${minutes} น.` : `${hours}:${minutes}`;
          return `${timeStr} · ${deleteTarget.message}`;
        }
        return deleteTarget.message;
      })()
    : '';

  return (
    <div className="min-h-screen bg-[#F2F7FA] text-[#21215C]">
      {/* Top LINE Service App Bar + Category Header matching Figma Ground Truth */}
      <DetailHeader
        title={t('reminders')}
        subtitle={
          reminders.length > 0 ? t('remindersSubtitle', { count: reminders.length }) : undefined
        }
        badgeBgColor="bg-[#E1E8F8]"
        badgeIcon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
              fill="#3E81F7"
              stroke="#385289"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M13.73 21a2 2 0 0 1-3.46 0"
              stroke="#385289"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
      />

      <main className="px-5 pt-1 pb-16 max-w-[440px] mx-auto">
        {reminders.length === 0 ? (
          /* Empty State matching Figma Specification */
          <EmptyState
            badgeBgColor="bg-[#E1E8F8]"
            badgeIcon={
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
                  fill="#3E81F7"
                  stroke="#385289"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M13.73 21a2 2 0 0 1-3.46 0"
                  stroke="#385289"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            title={t('emptyRemindersTitle')}
            description={
              <div className="space-y-1">
                <p>{t('emptyRemindersHintLine1')}</p>
                <p>{t('emptyRemindersHintLine2')}</p>
              </div>
            }
            actionLabel={t('goToChat')}
            actionButtonColor="bg-[#3E81F7]"
          />
        ) : (
          /* Grouped Reminders List matching Figma Image Ground Truth */
          <div>
            <div className="space-y-6">
              {timelineGroups.map((group) => (
                <section key={group.id} aria-labelledby={`heading-${group.id}`}>
                  <h3
                    id={`heading-${group.id}`}
                    className="text-xl font-bold text-[#21215C] mb-3 tracking-tight"
                  >
                    {group.label}
                  </h3>
                  <div className="space-y-3">
                    {group.items.map((reminder) => (
                      <ReminderCard
                        key={reminder.id}
                        reminder={reminder}
                        onDelete={() => handleDeleteRequest(reminder)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* Bottom Notice: Completed items are hidden */}
            <p className="text-center text-[#7D84A3] text-sm sm:text-base font-medium mt-8">
              {t('completedRemindersHidden')}
            </p>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal matching Figma Specification */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title={t('confirmDeleteReminderTitle')}
        contentPreview={deleteTargetPreview}
        warningText={t('confirmDeleteWarning')}
        confirmLabel={t('deleteReminder')}
        cancelLabel={t('doNotDelete')}
        confirmVariant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      {/* Floating Bottom Toast Feedback matching Figma Standard */}
      <Toast
        isOpen={showToast}
        message={t('reminderDeletedToast')}
        durationMs={3000}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
}
