import { NextRequest, NextResponse } from 'next/server';
import { alarmsRef, remindersRef, notesRef } from '@/lib/firebase/collections';
import { getAuthorizedUserId } from '@/lib/liff/auth';

export async function GET(request: NextRequest) {
  const userId = await getAuthorizedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get('type') || 'all';
  const result: Record<string, unknown[]> = {};

  try {
    if (type === 'alarms' || type === 'all') {
      const snaps = await alarmsRef(userId).where('enabled', '==', true).orderBy('time').get();
      result.alarms = snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    if (type === 'reminders' || type === 'all') {
      const snaps = await remindersRef(userId)
        .where('status', 'in', ['pending', 'snoozed'])
        .orderBy('nextFireAt')
        .get();
      result.reminders = snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
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
