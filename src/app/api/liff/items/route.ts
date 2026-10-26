import { NextRequest, NextResponse } from 'next/server';
import { alarmsRef, remindersRef, notesRef } from '@/lib/firebase/collections';
import { getAuthorizedUserId } from '@/lib/liff/auth';
import { getMockItems } from '@/lib/liff/mock-items';

export async function GET(request: NextRequest) {
  const userId = await getAuthorizedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // In production, strictly reject any mock user access
  if (
    process.env.NODE_ENV === 'production' &&
    (userId === 'mock-user-123' || userId.startsWith('mock-'))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get('type') || 'all';

  // In non-production, allow mock data for offline development
  if (
    process.env.NODE_ENV !== 'production' &&
    (userId === 'mock-user-123' || userId.startsWith('mock-'))
  ) {
    return NextResponse.json(getMockItems(type));
  }

  const result: Record<string, unknown[]> = {};

  try {
    if (type === 'alarms' || type === 'all') {
      let alarmDocs: { id: string; [key: string]: unknown }[];
      try {
        const snaps = await alarmsRef(userId).where('enabled', '==', true).orderBy('time').get();
        alarmDocs = snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (err: unknown) {
        const error = err as { code?: number; message?: string };
        if (
          error?.code === 9 ||
          error?.message?.includes('FAILED_PRECONDITION') ||
          error?.message?.includes('requires an index')
        ) {
          console.warn(
            '[LIFF items] Missing composite index for alarms; falling back to in-memory sort',
          );
          const snaps = await alarmsRef(userId).where('enabled', '==', true).get();
          alarmDocs = snaps.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) =>
              String((a as { time?: string }).time ?? '').localeCompare(
                String((b as { time?: string }).time ?? ''),
              ),
            );
        } else {
          throw err;
        }
      }
      result.alarms = alarmDocs;
    }

    if (type === 'reminders' || type === 'all') {
      let reminderDocs: { id: string; [key: string]: unknown }[];
      try {
        const snaps = await remindersRef(userId)
          .where('status', 'in', ['pending', 'snoozed'])
          .orderBy('nextFireAt')
          .get();
        reminderDocs = snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (err: unknown) {
        const error = err as { code?: number; message?: string };
        if (
          error?.code === 9 ||
          error?.message?.includes('FAILED_PRECONDITION') ||
          error?.message?.includes('requires an index')
        ) {
          console.warn(
            '[LIFF items] Missing composite index for reminders; falling back to in-memory sort',
          );
          const snaps = await remindersRef(userId)
            .where('status', 'in', ['pending', 'snoozed'])
            .get();
          reminderDocs = snaps.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => {
              const remA = a as { nextFireAt?: { toMillis?: () => number; seconds?: number } };
              const remB = b as { nextFireAt?: { toMillis?: () => number; seconds?: number } };
              const tA =
                remA.nextFireAt?.toMillis?.() ??
                (remA.nextFireAt?.seconds ? remA.nextFireAt.seconds * 1000 : 0);
              const tB =
                remB.nextFireAt?.toMillis?.() ??
                (remB.nextFireAt?.seconds ? remB.nextFireAt.seconds * 1000 : 0);
              return tA - tB;
            });
        } else {
          throw err;
        }
      }
      result.reminders = reminderDocs;
    }

    if (type === 'notes' || type === 'all') {
      const snaps = await notesRef(userId).orderBy('createdAt', 'desc').limit(20).get();
      result.notes = snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Error fetching LIFF items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
