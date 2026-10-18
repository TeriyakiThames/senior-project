import { NextRequest } from 'next/server';
import { auth } from '@/lib/firebase/admin';

export async function getAuthorizedUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      const decoded = await auth.verifyIdToken(token);
      return decoded.uid;
    } catch {
      return null;
    }
  }

  const lineUserId = request.headers.get('x-line-userid');
  if (lineUserId && lineUserId.trim() !== '') {
    return lineUserId.trim();
  }

  return null;
}
