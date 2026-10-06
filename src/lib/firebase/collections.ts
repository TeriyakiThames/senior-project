import { db } from './admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { UserDoc, MessageDoc } from '@/types/firestore';

// User document
export const usersRef = () => db.collection('users');
export const userRef = (lineUserId: string) => usersRef().doc(lineUserId);

// Subcollections
export const messagesRef = (uid: string) => userRef(uid).collection('messages');
export const alarmsRef = (uid: string) => userRef(uid).collection('alarms');
export const remindersRef = (uid: string) => userRef(uid).collection('reminders');
export const notesRef = (uid: string) => userRef(uid).collection('notes');
export const pendingActionsRef = (uid: string) => userRef(uid).collection('pendingActions');

// Get or create user
export async function getOrCreateUser(lineUserId: string, displayName: string): Promise<UserDoc> {
  const ref = userRef(lineUserId);
  const snap = await ref.get();
  if (snap.exists) return snap.data() as UserDoc;

  const newUser: UserDoc = {
    lineUserId,
    displayName,
    language: 'th',
    timezone: 'Asia/Bangkok',
    firebaseUid: '',
    createdAt: Timestamp.now(),
    profile: { facts: [], updatedAt: Timestamp.now() },
  };
  await ref.set(newUser);
  return newUser;
}

// Load recent messages for context
export async function getRecentMessages(uid: string, limit = 10): Promise<MessageDoc[]> {
  const snap = await messagesRef(uid).orderBy('timestamp', 'desc').limit(limit).get();
  return snap.docs.map((d) => d.data() as MessageDoc).reverse();
}

// Save a message pair
export async function saveMessages(
  uid: string,
  userMsg: string,
  assistantMsg: string,
): Promise<void> {
  const batch = db.batch();
  const now = Timestamp.now();
  batch.create(messagesRef(uid).doc(), { role: 'user', content: userMsg, timestamp: now });
  batch.create(messagesRef(uid).doc(), {
    role: 'assistant',
    content: assistantMsg,
    timestamp: now,
  });
  await batch.commit();
}
