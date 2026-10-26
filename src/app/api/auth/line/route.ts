import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase/admin';
import { userRef } from '@/lib/firebase/collections';
import { verifyLineIdToken } from '@/lib/line/verify-token';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken } = body;

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid idToken' }, { status: 400 });
    }

    const verified = await verifyLineIdToken(idToken);
    if (!verified) {
      return NextResponse.json({ error: 'Invalid or expired LINE ID token' }, { status: 401 });
    }

    const { lineUserId, displayName } = verified;

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

    try {
      const uRef = userRef(lineUserId);
      const snap = await uRef.get();
      if (snap.exists) {
        await uRef.update({ firebaseUid });
      }
    } catch (dbErr) {
      console.error('Failed to update user firebaseUid:', dbErr);
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
