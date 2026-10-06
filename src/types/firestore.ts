import { Timestamp } from 'firebase-admin/firestore';

export interface UserDoc {
  lineUserId: string;
  displayName: string;
  language: 'th' | 'en';
  timezone: string;
  firebaseUid: string;
  createdAt: Timestamp;
  lastInteractionId?: string; // Last Gemini interaction ID for chaining
  profile: {
    facts: string[]; // Long-term learned facts about the user
    updatedAt: Timestamp;
  };
  dailySummary?: {
    date: string; // "YYYY-MM-DD"
    summary: string;
    generatedAt: Timestamp;
  };
}

export interface MessageDoc {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Timestamp;
}

export type Recurrence = 'once' | 'daily' | 'weekly' | 'monthly';

export interface AlarmDoc {
  time: string; // "HH:mm" 24h format
  label?: string;
  recurrence: Recurrence;
  daysOfWeek?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  dayOfMonth?: number; // 1-31
  enabled: boolean;
  nextFireAt: Timestamp;
  cloudTaskName?: string;
  createdAt: Timestamp;
}

export interface ReminderDoc {
  message: string;
  scheduledAt: Timestamp;
  recurrence: Recurrence;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  enabled: boolean;
  nextFireAt: Timestamp;
  cloudTaskName?: string;
  status: 'pending' | 'fired' | 'snoozed' | 'done';
  createdAt: Timestamp;
}

export interface NoteDoc {
  content: string; // Full transcribed/typed text
  summary: string; // AI-summarized version
  source: 'voice' | 'text';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PendingActionDoc {
  type: 'confirm_note' | 'confirm_delete';
  data: Record<string, unknown>;
  expiresAt: Timestamp;
}
