'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useLiff } from '@/components/liff/LiffProvider';
import { useLiffData } from '@/hooks/useLiffData';
import { NoteCard, type NoteItem } from '@/components/liff/NoteCard';
import { DetailHeader } from '@/components/layout/DetailHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Toast } from '@/components/ui/Toast';
import { groupNotesByDate } from '@/lib/utils/date';

interface NotesData {
  notes?: NoteItem[];
}

export default function NotesPage() {
  const locale = useLocale();
  const t = useTranslations('dashboard');
  const { isReady } = useLiff();
  const { data, loading, deleteItem } = useLiffData<NotesData>('notes');

  const [deleteTarget, setDeleteTarget] = useState<NoteItem | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const notes = useMemo(() => data?.notes ?? [], [data?.notes]);

  const dateGroups = useMemo(() => {
    return groupNotesByDate(notes, locale);
  }, [notes, locale]);

  const handleDeleteRequest = (note: NoteItem) => {
    setDeleteTarget(note);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setIsDeleting(true);
    try {
      await deleteItem(id, 'note');
      setDeleteTarget(null);
      setShowToast(true);
    } catch (err) {
      console.error('Failed to delete note:', err);
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

  return (
    <div className="min-h-screen bg-[#F2F7FA] text-[#21215C]">
      {/* Top LINE Service App Bar + Category Header matching Figma Image 1 & 3 */}
      <DetailHeader
        title={t('notes')}
        subtitle={notes.length > 0 ? t('notesSubtitle', { count: notes.length }) : undefined}
        badgeBgColor="bg-[#EEE1FA]"
        badgeIcon={
          <Image
            src="/icons/notes.svg"
            alt=""
            width={24}
            height={24}
            unoptimized
            aria-hidden="true"
          />
        }
      />

      <main className="px-5 pt-1 pb-16 max-w-[440px] mx-auto">
        {notes.length === 0 ? (
          /* Empty State matching Figma Image 3 */
          <EmptyState
            badgeBgColor="bg-[#EEE1FA]"
            badgeIcon={
              <Image
                src="/icons/notes.svg"
                alt=""
                width={56}
                height={56}
                unoptimized
                aria-hidden="true"
              />
            }
            title={t('emptyNotesTitle')}
            description={
              <div className="space-y-1">
                <p>{t('emptyNotesHintLine1')}</p>
                <p>{t('emptyNotesHintLine2')}</p>
              </div>
            }
            actionLabel={t('goToChat')}
            actionButtonColor="bg-[#3E81F7]"
          />
        ) : (
          /* Date-Grouped Notes List matching Figma Image 1 */
          <div className="space-y-6">
            {dateGroups.map((group) => (
              <section key={group.label} aria-labelledby={`heading-${group.label}`}>
                <h3
                  id={`heading-${group.label}`}
                  className="text-xl font-bold text-[#21215C] mb-3 tracking-tight"
                >
                  {group.label}
                </h3>
                <div className="space-y-3">
                  {group.items.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onDelete={() => handleDeleteRequest(note)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal matching Figma Image 2 */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title={t('confirmDeleteNoteTitle')}
        contentPreview={deleteTarget?.content || deleteTarget?.summary}
        warningText={t('confirmDeleteWarning')}
        confirmLabel={t('deleteNote')}
        cancelLabel={t('doNotDelete')}
        confirmVariant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      {/* Floating Bottom Toast Feedback matching Figma Image 3 */}
      <Toast
        isOpen={showToast}
        message={t('noteDeletedToast')}
        durationMs={3000}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
}
