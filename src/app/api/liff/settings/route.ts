import { NextRequest, NextResponse } from 'next/server';
import { userRef } from '@/lib/firebase/collections';
import { getAuthorizedUserId } from '@/lib/liff/auth';
import { getMockSettings, updateMockSettings } from '@/lib/liff/mock-items';
import { isValidDocumentId } from '@/lib/utils/security';
import { isMockAllowed } from '@/lib/utils/env';
import type { UserDoc } from '@/types/firestore';

export async function GET(request: NextRequest) {
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

  // In non-production or preview, allow mock settings
  if (isMockAllowed() && (userId === 'mock-user-123' || userId.startsWith('mock-'))) {
    return NextResponse.json(getMockSettings());
  }

  try {
    const snap = await userRef(userId).get();
    const data = snap.exists ? (snap.data() as UserDoc) : null;
    const notificationRepeatCap = data?.settings?.notificationRepeatCap ?? 3;
    return NextResponse.json({ notificationRepeatCap });
  } catch (error) {
    console.error('[LIFF settings GET error]', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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

  let body: { notificationRepeatCap?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { notificationRepeatCap } = body;
  if (
    typeof notificationRepeatCap !== 'number' ||
    !Number.isInteger(notificationRepeatCap) ||
    notificationRepeatCap < 1 ||
    notificationRepeatCap > 12
  ) {
    return NextResponse.json(
      { error: 'Repeat cap must be an integer between 1 and 12' },
      { status: 400 },
    );
  }

  if (isMockAllowed() && (userId === 'mock-user-123' || userId.startsWith('mock-'))) {
    const updated = updateMockSettings({ notificationRepeatCap });
    return NextResponse.json({ success: true, settings: updated });
  }

  try {
    await userRef(userId).set(
      {
        settings: {
          notificationRepeatCap,
        },
      },
      { merge: true },
    );
    return NextResponse.json({
      success: true,
      settings: { notificationRepeatCap },
    });
  } catch (error) {
    console.error('[LIFF settings PUT error]', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
