'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useLiff } from '@/components/liff/LiffProvider';
import { useLiffData } from '@/hooks/useLiffData';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { parseTimestamp } from '@/lib/utils/date';
import type { AlarmItem } from '@/components/liff/AlarmCard';
import type { ReminderItem } from '@/components/liff/ReminderCard';
import type { NoteItem } from '@/components/liff/NoteCard';

interface DashboardData {
  alarms?: AlarmItem[];
  reminders?: ReminderItem[];
  notes?: NoteItem[];
}

interface UpcomingTimelineItem {
  id: string;
  type: 'alarm' | 'reminder';
  time: string;
  dayText: string;
  title: string;
  tag: string;
  tagVariant: 'alarm' | 'reminder' | 'plan';
  sortTimestamp: number;
}

function formatHeaderDate(date: Date, locale: string): string {
  const isThai = locale.toLowerCase().startsWith('th');
  if (isThai) {
    const weekday = new Intl.DateTimeFormat('th-TH', { weekday: 'long' }).format(date);
    const day = date.getDate();
    const month = new Intl.DateTimeFormat('th-TH', { month: 'short' }).format(date);
    return `${weekday} ${day} ${month}`;
  }
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function formatNoteTime(date: Date | null, locale: string, tToday: string): string {
  if (!date) return '';
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes} น.`;

  if (isToday) {
    return `${tToday} ${timeStr}`;
  }

  const isThai = locale.toLowerCase().startsWith('th');
  const month = new Intl.DateTimeFormat(isThai ? 'th-TH' : 'en-US', { month: 'short' }).format(
    date,
  );
  return `${date.getDate()} ${month} ${timeStr}`;
}

export default function DashboardPage() {
  const locale = useLocale();
  const t = useTranslations('dashboard');
  const { isReady } = useLiff();
  const { data, loading, deleteItem } = useLiffData<DashboardData>('all');

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    type: 'alarm' | 'reminder' | 'note';
    title: string;
  } | null>(null);

  const alarms = useMemo(() => data?.alarms ?? [], [data?.alarms]);
  const reminders = useMemo(() => data?.reminders ?? [], [data?.reminders]);
  const notes = useMemo(() => data?.notes ?? [], [data?.notes]);

  // Count recurring items as plans matching the SVG category "แผนของฉัน"
  const plansCount = useMemo(() => {
    const recurringCount = reminders.filter((r) => r.recurrence && r.recurrence !== 'once').length;
    return recurringCount > 0 ? recurringCount : reminders.length > 0 ? 1 : 0;
  }, [reminders]);

  const upcomingItems = useMemo<UpcomingTimelineItem[]>(() => {
    const items: UpcomingTimelineItem[] = [];
    const now = new Date();

    // 1. Process active reminders
    for (const rem of reminders) {
      if (rem.status === 'done') continue;
      const fireDate = parseTimestamp(rem.nextFireAt);
      if (!fireDate) continue;

      const hours = String(fireDate.getHours()).padStart(2, '0');
      const minutes = String(fireDate.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      const isToday =
        fireDate.getDate() === now.getDate() &&
        fireDate.getMonth() === now.getMonth() &&
        fireDate.getFullYear() === now.getFullYear();

      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      const isTomorrow =
        fireDate.getDate() === tomorrow.getDate() &&
        fireDate.getMonth() === tomorrow.getMonth() &&
        fireDate.getFullYear() === tomorrow.getFullYear();

      const dayText = isToday
        ? t('today')
        : isTomorrow
          ? t('tomorrow')
          : `${fireDate.getDate()} ${new Intl.DateTimeFormat(locale.startsWith('th') ? 'th-TH' : 'en-US', { month: 'short' }).format(fireDate)}`;

      let tag = t('reminder');
      let tagVariant: 'alarm' | 'reminder' | 'plan' = 'reminder';

      if (rem.status === 'snoozed') {
        tag = `${t('reminder')} · ${t('snoozed')}`;
        tagVariant = 'reminder';
      } else if (rem.recurrence && rem.recurrence !== 'once') {
        tag = t('plan');
        tagVariant = 'plan';
      }

      items.push({
        id: rem.id,
        type: 'reminder',
        time: timeStr,
        dayText,
        title: rem.message,
        tag,
        tagVariant,
        sortTimestamp: fireDate.getTime(),
      });
    }

    // 2. Process enabled alarms
    for (const alarm of alarms) {
      if (alarm.enabled === false) continue;
      const [hhStr, mmStr] = alarm.time.split(':');
      const hh = parseInt(hhStr || '0', 10);
      const mm = parseInt(mmStr || '0', 10);

      const alarmToday = new Date(now);
      alarmToday.setHours(hh, mm, 0, 0);

      let targetDate = alarmToday;
      let dayText = t('today');

      if (alarmToday.getTime() <= now.getTime()) {
        const alarmTomorrow = new Date(alarmToday);
        alarmTomorrow.setDate(alarmTomorrow.getDate() + 1);
        targetDate = alarmTomorrow;
        dayText = t('tomorrow');
      }

      items.push({
        id: alarm.id,
        type: 'alarm',
        time: alarm.time,
        dayText,
        title: alarm.label || t('alarm'),
        tag: t('alarm'),
        tagVariant: 'alarm',
        sortTimestamp: targetDate.getTime(),
      });
    }

    // Sort chronologically ascending
    items.sort((a, b) => a.sortTimestamp - b.sortTimestamp);
    return items;
  }, [reminders, alarms, locale, t]);

  const recentNotes = useMemo(() => notes.slice(0, 3), [notes]);

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
      <div className="px-5 pt-4 pb-8 max-w-[440px] mx-auto">
        {/* Date and "ของฉัน" (My Hub) Heading */}
        <section className="mb-4">
          <p className="text-sm font-medium text-[#4B4F72]">
            {formatHeaderDate(new Date(), locale)}
          </p>
          <h2 className="text-3xl font-extrabold text-[#21215C] mt-1 tracking-tight">
            {t('mine')}
          </h2>
        </section>

        {/* 2x2 Category Hub Grid */}
        <section className="grid grid-cols-2 gap-3 mb-7" aria-label={t('mine')}>
          {/* 1. Alarms (นาฬิกาปลุก) */}
          <Link
            href={`/${locale}/liff/alarms`}
            className="bg-[#FBEFD8] rounded-3xl p-4 flex flex-col justify-between min-h-[120px] active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-[#7A4E00]"
          >
            <Image
              src="/icons/clock.svg"
              alt=""
              width={36}
              height={36}
              unoptimized
              aria-hidden="true"
            />
            <div>
              <p className="text-[#7A4E00] font-bold text-lg leading-tight">{t('alarms')}</p>
              <p className="text-[#7A4E00]/80 text-sm font-medium mt-0.5">
                {t('itemsCount', { count: alarms.length })}
              </p>
            </div>
          </Link>

          {/* 2. Reminders (การเตือน) */}
          <Link
            href={`/${locale}/liff/reminders`}
            className="bg-[#E1E8F8] rounded-3xl p-4 flex flex-col justify-between min-h-[120px] active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-[#385289]"
          >
            <Image
              src="/icons/reminder.svg"
              alt=""
              width={36}
              height={36}
              unoptimized
              aria-hidden="true"
            />
            <div>
              <p className="text-[#385289] font-bold text-lg leading-tight">{t('reminder')}</p>
              <p className="text-[#385289]/80 text-sm font-medium mt-0.5">
                {t('itemsCount', { count: reminders.length })}
              </p>
            </div>
          </Link>

          {/* 3. Notes (โน้ต) */}
          <Link
            href={`/${locale}/liff/notes`}
            className="bg-[#EEE1FA] rounded-3xl p-4 flex flex-col justify-between min-h-[120px] active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-[#544378]"
          >
            <Image
              src="/icons/notes.svg"
              alt=""
              width={36}
              height={36}
              unoptimized
              aria-hidden="true"
            />
            <div>
              <p className="text-[#544378] font-bold text-lg leading-tight">{t('notes')}</p>
              <p className="text-[#544378]/80 text-sm font-medium mt-0.5">
                {t('notesCount', { count: notes.length })}
              </p>
            </div>
          </Link>

          {/* 4. Settings (ตั้งค่า) */}
          <Link
            href={`/${locale}/liff/settings`}
            className="bg-[#FDE5F0] rounded-3xl p-4 flex flex-col justify-between min-h-[120px] active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-[#B4225A]"
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
                fill="#E8216F"
                stroke="#B4225A"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="3" fill="#FDE5F0" stroke="#B4225A" strokeWidth="2" />
            </svg>
            <div>
              <p className="text-[#B4225A] font-bold text-lg leading-tight">{t('settings')}</p>
              <p className="text-[#B4225A]/80 text-sm font-medium mt-0.5">
                {t('settingsSubtitle')}
              </p>
            </div>
          </Link>
        </section>

        {/* Section "ต่อไป" (Next / Upcoming) */}
        <section className="mb-7" aria-labelledby="upcoming-heading">
          <h3 id="upcoming-heading" className="text-2xl font-bold text-[#21215C] mb-3">
            {t('upcoming')}
          </h3>

          <div className="bg-white rounded-3xl shadow-[0_2px_6px_rgba(33,33,92,0.06),0_8px_24px_rgba(33,33,92,0.08)] overflow-hidden divide-y divide-[#F2F7FA]">
            {upcomingItems.length === 0 ? (
              <div className="p-6 text-center text-[#7D84A3]">
                <p className="text-senior-base font-semibold text-[#21215C] mb-1">
                  {t('emptyUpcomingTitle')}
                </p>
                <p className="text-sm text-[#7D84A3]">{t('emptyUpcomingHint')}</p>
              </div>
            ) : (
              upcomingItems.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex items-center justify-between p-4 sm:p-5 hover:bg-gray-50/50 transition-colors"
                >
                  {/* Left Column: Time & Day text */}
                  <div className="w-20 shrink-0 text-left">
                    <p className="text-2xl font-extrabold text-[#21215C] tabular-nums tracking-tight leading-none">
                      {item.time}
                    </p>
                    <p className="text-xs sm:text-sm text-[#7D84A3] font-medium mt-1">
                      {item.dayText}
                    </p>
                  </div>

                  {/* Middle Column: Title & Badge Pill */}
                  <div className="flex-1 min-w-0 px-3">
                    <p className="text-base sm:text-lg font-bold text-[#21215C] truncate">
                      {item.title}
                    </p>
                    <div className="mt-1">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          item.tagVariant === 'alarm'
                            ? 'bg-[#FBEFD8] text-[#7A4E00]'
                            : item.tagVariant === 'plan'
                              ? 'bg-[#FDE5F0] text-[#B4225A]'
                              : 'bg-[#E1E8F8] text-[#385289]'
                        }`}
                      >
                        {item.tag}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Delete & Chevron Navigation */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDeleteRequest(item.id, item.type, item.title)}
                      className="p-2 text-[#7D84A3] hover:text-[#EF4444] transition-colors rounded-full focus:outline-none focus:ring-2 focus:ring-[#7D84A3]"
                      aria-label={`${t('delete')} ${item.title}`}
                      title={t('delete')}
                    >
                      <Image
                        src="/icons/trashbin.svg"
                        alt=""
                        width={16}
                        height={16}
                        unoptimized
                        aria-hidden="true"
                      />
                    </button>

                    <Link
                      href={
                        item.type === 'alarm'
                          ? `/${locale}/liff/alarms`
                          : `/${locale}/liff/reminders`
                      }
                      className="p-2 text-[#4B4F72] hover:text-[#21215C] transition-colors"
                      aria-label={`${item.title} details`}
                    >
                      <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
                        <path
                          d="M1 1l6 6-6 6"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Section "โน้ตล่าสุด" (Recent Notes) */}
        <section className="mb-7" aria-labelledby="recent-notes-heading">
          <h3 id="recent-notes-heading" className="text-2xl font-bold text-[#21215C] mb-3">
            {t('recentNotes')}
          </h3>

          <div className="bg-white rounded-3xl shadow-[0_2px_6px_rgba(33,33,92,0.06),0_8px_24px_rgba(33,33,92,0.08)] p-5">
            {recentNotes.length === 0 ? (
              <div className="py-6 text-center text-[#7D84A3]">
                <p className="text-senior-base font-semibold text-[#21215C] mb-1">
                  {t('emptyNotesTitle')}
                </p>
                <p className="text-sm text-[#7D84A3]">{t('emptyNotesHint')}</p>
              </div>
            ) : (
              <div className="divide-y divide-[#F2F7FA]">
                {recentNotes.map((note) => {
                  const createDate = parseTimestamp(note.createdAt);
                  const isVoice = note.source === 'voice';

                  return (
                    <div key={note.id} className="py-3.5 first:pt-0 last:pb-0">
                      <p className="text-[#21215C] font-semibold text-base sm:text-lg leading-relaxed break-words">
                        {note.summary}
                      </p>

                      <div className="mt-2 flex items-center justify-between text-xs sm:text-sm text-[#7D84A3]">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EAF0F6] text-[#21215C]">
                            {isVoice ? (
                              <Image
                                src="/icons/microphone_small.svg"
                                alt=""
                                width={14}
                                height={14}
                                unoptimized
                                aria-hidden="true"
                              />
                            ) : (
                              <Image
                                src="/icons/keyboard.svg"
                                alt=""
                                width={14}
                                height={14}
                                unoptimized
                                aria-hidden="true"
                              />
                            )}
                            <span>{isVoice ? t('voice') : t('typed')}</span>
                          </span>

                          {createDate && (
                            <span className="tabular-nums font-medium">
                              {formatNoteTime(createDate, locale, t('today'))}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteRequest(note.id, 'note', note.summary)}
                          className="p-1.5 text-[#7D84A3] hover:text-[#EF4444] transition-colors rounded-full focus:outline-none focus:ring-2 focus:ring-[#7D84A3]"
                          aria-label={`${t('delete')} ${note.summary}`}
                          title={t('delete')}
                        >
                          <Image
                            src="/icons/trashbin.svg"
                            alt=""
                            width={16}
                            height={16}
                            unoptimized
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* "ดูโน้ตทั้งหมด >" Outlined Action Button matching SVG */}
            <Link
              href={`/${locale}/liff/notes`}
              className="mt-5 w-full border-2 border-[#7D84A3] bg-white rounded-2xl text-[#21215C] font-bold py-3.5 px-4 flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-[0.99] transition-all min-h-[52px]"
            >
              <span className="text-base sm:text-lg">{t('viewAllNotes')}</span>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
                <path
                  d="M1 1l6 6-6 6"
                  stroke="#21215C"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </section>

        {/* Bottom Voice Tip Banner matching SVG */}
        <div className="bg-[#EAF0F6] rounded-2xl p-4 sm:p-5 flex items-center gap-4 border border-[#E1E8F8]">
          <div className="w-12 h-12 rounded-full bg-[#E1E8F8] flex items-center justify-center shrink-0 shadow-xs">
            <Image
              src="/icons/microphone_big.svg"
              alt=""
              width={24}
              height={24}
              unoptimized
              aria-hidden="true"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#21215C] font-bold text-sm sm:text-base leading-snug">
              {t('tipPrompt')}
            </p>
            <p className="text-[#4B4F72] text-xs sm:text-sm mt-0.5 font-medium">
              {t('tipExample')}
            </p>
          </div>
        </div>
      </div>

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
    </div>
  );
}
