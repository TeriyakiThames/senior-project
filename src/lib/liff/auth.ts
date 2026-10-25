import { NextRequest } from 'next/server';
import { auth } from '@/lib/firebase/admin';
import { verifyLineIdToken } from '@/lib/line/verify-token';

export async function getAuthorizedUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (!token) return null;

    // 1. Try verifying as LINE ID Token first (primary auth path for LIFF)
    const lineVerified = await verifyLineIdToken(token);
    if (lineVerified?.lineUserId) {
      return lineVerified.lineUserId;
    }

    // 2. Try verifying as Firebase ID Token (custom claim lineUserId or uid)
    try {
      const decoded = await auth.verifyIdToken(token);
      return (decoded.lineUserId as string) || decoded.uid;
    } catch {
      return null;
    }
  }

  // Reject spoofable x-line-userid header in production
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  // In non-production (test/development), allow mock user ID only for offline development
  const lineUserId = request.headers.get('x-line-userid');
  if (lineUserId && lineUserId.trim() !== '') {
    const cleanId = lineUserId.trim();
    if (cleanId === 'mock-user-123' || cleanId.startsWith('mock-')) {
      return cleanId;
    }
  }

  return null;
}
