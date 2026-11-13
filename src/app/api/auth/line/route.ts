import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase/admin';
import { userRef } from '@/lib/firebase/collections';
import { verifyLineIdToken } from '@/lib/line/verify-token';
import { isValidDocumentId, isPayloadSizeWithinLimit } from '@/lib/utils/security';
import { isMockAllowed } from '@/lib/utils/env';

export async function POST(request: NextRequest) {
  try {
    if (!isPayloadSizeWithinLimit(request, 32 * 1024)) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    const rawText = await request.text();
    if (rawText.length > 32 * 1024) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    let body: { idToken?: unknown };
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    const { idToken } = body;

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid idToken' }, { status: 400 });
    }

    const verified = await verifyLineIdToken(idToken);
    if (!verified) {
      return NextResponse.json({ error: 'Invalid or expired LINE ID token' }, { status: 401 });
    }

    const { lineUserId, displayName } = verified;

    if (lineUserId === 'mock-user-123' || lineUserId.startsWith('mock-')) {
      if (!isMockAllowed()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      // Return a simulated mock token without minting real Firebase custom tokens or touching Auth records
      return NextResponse.json({ token: `mock-custom-token-${lineUserId}` });
    }

    if (!isValidDocumentId(lineUserId)) {
      return NextResponse.json({ error: 'Invalid LINE user ID format' }, { status: 400 });
    }

    let firebaseUid = lineUserId;
    try {
      const existingUser = await auth.getUser(lineUserId);
      firebaseUid = existingUser.uid;
    } catch {
      try {
        const existingUserByEmail = await auth.getUserByEmail(`${lineUserId}@line.user`);
        firebaseUid = existingUserByEmail.uid;
      } catch {
        const newUser = await auth.createUser({
          uid: lineUserId,
          email: `${lineUserId}@line.user`,
          displayName: displayName || lineUserId,
        });
        firebaseUid = newUser.uid;
      }
    }

    const uRef = userRef(lineUserId);
    const snap = await uRef.get();
    if (snap.exists) {
      await uRef.update({ firebaseUid });
    }

    const customToken = await auth.createCustomToken(firebaseUid, {
      lineUserId,
    });
    return NextResponse.json({ token: customToken });
  } catch (error: unknown) {
    console.error('Error in /api/auth/line:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
