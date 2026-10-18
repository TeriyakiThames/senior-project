import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase/admin';
import { userRef } from '@/lib/firebase/collections';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lineUserId } = body;

    if (!lineUserId || typeof lineUserId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid lineUserId' }, { status: 400 });
    }

    let firebaseUid: string;
    try {
      const existingUser = await auth.getUserByEmail(`${lineUserId}@line.user`);
      firebaseUid = existingUser.uid;
    } catch {
      const newUser = await auth.createUser({
        email: `${lineUserId}@line.user`,
        displayName: lineUserId,
      });
      firebaseUid = newUser.uid;
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

    const customToken = await auth.createCustomToken(firebaseUid);
    return NextResponse.json({ token: customToken });
  } catch (error: unknown) {
    console.error('Error in /api/auth/line:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
