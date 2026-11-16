import { NextRequest, NextResponse } from 'next/server';
import { alarmsRef, remindersRef, notesRef } from '@/lib/firebase/collections';
import { cancelScheduledTask } from '@/lib/scheduler/cloud-tasks';
import { getAuthorizedUserId } from '@/lib/liff/auth';
import { deleteMockItem } from '@/lib/liff/mock-items';
import { isValidDocumentId } from '@/lib/utils/security';
import { isMockAllowed } from '@/lib/utils/env';

const VALID_TYPES = ['alarm', 'timer', 'reminder', 'note'] as const;
type ItemType = (typeof VALID_TYPES)[number];

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getAuthorizedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // In production, strictly reject any mock user access
  if (!isMockAllowed() && (userId === 'mock-user-123' || userId.startsWith('mock-'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isValidDocumentId(userId)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  const { id } = await params;
  if (!isValidDocumentId(id)) {
    return NextResponse.json({ error: 'Invalid item ID format' }, { status: 400 });
  }

  const type = request.nextUrl.searchParams.get('type') as ItemType | null;

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: 'Invalid or missing type parameter. Expected alarm, timer, reminder, or note.' },
      { status: 400 },
    );
  }

  // In non-production or preview, allow mock item deletion for offline development
  if (isMockAllowed() && (userId === 'mock-user-123' || userId.startsWith('mock-'))) {
    const deleted = deleteMockItem(id, type === 'timer' ? 'alarm' : type);
    if (!deleted) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, status: 'deleted' });
  }

  try {
    const collectionRef =
      type === 'alarm' || type === 'timer'
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
      await docRef.update({ status: 'done', enabled: false, cloudTaskName: null });
    } else {
      await docRef.update({ enabled: false, status: 'done', cloudTaskName: null });
    }

    return NextResponse.json({ success: true, status: 'deleted' });
  } catch (error: unknown) {
    console.error('Error deleting LIFF item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
