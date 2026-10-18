import { NextRequest, NextResponse } from 'next/server';
import { alarmsRef, remindersRef, notesRef } from '@/lib/firebase/collections';
import { cancelScheduledTask } from '@/lib/scheduler/cloud-tasks';
import { getAuthorizedUserId } from '@/lib/liff/auth';

const VALID_TYPES = ['alarm', 'reminder', 'note'] as const;
type ItemType = (typeof VALID_TYPES)[number];

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getAuthorizedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const type = request.nextUrl.searchParams.get('type') as ItemType | null;

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: 'Invalid or missing type parameter. Expected alarm, reminder, or note.' },
      { status: 400 },
    );
  }

  try {
    const collectionRef =
      type === 'alarm'
        ? alarmsRef(userId)
        : type === 'reminder'
          ? remindersRef(userId)
          : notesRef(userId);

    const docRef = collectionRef.doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const data = snap.data();
    if (data?.cloudTaskName) {
      try {
        await cancelScheduledTask(data.cloudTaskName);
      } catch (taskErr) {
        console.warn('Failed to cancel Cloud Task:', taskErr);
      }
    }

    if (type === 'note') {
      await docRef.delete();
    } else if (type === 'reminder') {
      await docRef.update({ status: 'done', enabled: false });
    } else {
      await docRef.update({ enabled: false });
    }

    return NextResponse.json({ success: true, status: 'deleted' });
  } catch (error: unknown) {
    console.error('Error deleting LIFF item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
