'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useLiff } from '@/components/liff/LiffProvider';
import { useLiffData } from '@/hooks/useLiffData';
import { NoteCard, type NoteItem } from '@/components/liff/NoteCard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Loading } from '@/components/ui/Loading';
import { PageWrapper } from '@/components/layout/PageWrapper';

interface NotesData {
  notes?: NoteItem[];
}

export default function NotesPage() {
  const locale = useLocale();
  const t = useTranslations('dashboard');
  const { isReady } = useLiff();
  const { data, loading, deleteItem } = useLiffData<NotesData>('notes');

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

  const notes = data?.notes ?? [];

  const handleDeleteRequest = (id: string, title: string) => {
    setDeleteTarget({ id, title });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteItem(id, 'note');
    } catch (err) {
      console.error('Failed to delete note:', err);
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
        <h1 className="text-senior-2xl font-bold text-senior-text">📝 {t('notes')}</h1>
      </header>

      {/* Notes Content */}
      <section aria-labelledby="notes-list-heading">
        <h2 id="notes-list-heading" className="sr-only">
          {t('notes')}
        </h2>

        {notes.length === 0 ? (
          <div className="bg-white rounded-card border border-gray-200 p-6 text-center shadow-sm">
            <div
              className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl"
              aria-hidden="true"
            >
              📝
            </div>
            <p className="text-senior-lg font-bold text-senior-text mb-2">{t('emptyNotesTitle')}</p>
            <div className="bg-senior-bg border border-purple-200 rounded-card p-4 mt-4 inline-block text-left w-full">
              <p className="text-senior-sm font-semibold text-purple-700 flex items-center gap-1.5 mb-1">
                <span aria-hidden="true">💡</span>
                <span>{t('tip')}</span>
              </p>
              <p className="text-senior-base text-senior-text">{t('emptyNotesHint')}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onDelete={() => handleDeleteRequest(note.id, note.summary)}
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
