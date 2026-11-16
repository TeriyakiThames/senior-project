import { Timestamp } from 'firebase-admin/firestore';

export interface UserSettings {
  notificationRepeatCap?: number; // 1 to 12 (default: 3)
}

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
  settings?: UserSettings;
}

export interface MessageDoc {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Timestamp;
}

export type Recurrence = 'once' | 'daily' | 'weekly' | 'monthly';

export interface AlarmDoc {
  time?: string; // "HH:mm" 24h format (optional for timers)
  durationMinutes?: number; // total duration in minutes
  hours?: number;
  minutes?: number;
  label?: string;
  recurrence?: Recurrence;
  daysOfWeek?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  dayOfMonth?: number; // 1-31
  enabled: boolean;
  nextFireAt: Timestamp;
  cloudTaskName?: string | null;
  lastNotificationId?: string | null;
  lastHandledNotificationId?: string | null;
  lastHandledAction?: 'snooze' | 'dismiss' | null;
  repeatCount?: number;
  status?: 'pending' | 'fired' | 'snoozed' | 'done';
  createdAt: Timestamp;
}

export type TimerDoc = AlarmDoc;

export interface ReminderDoc {
  message: string;
  scheduledAt: Timestamp;
  recurrence: Recurrence;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  enabled: boolean;
  nextFireAt: Timestamp;
  cloudTaskName?: string | null;
  lastNotificationId?: string | null;
  lastHandledNotificationId?: string | null;
  lastHandledAction?: 'snooze' | 'dismiss' | null;
  repeatCount?: number;
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
  type: 'confirm_note' | 'confirm_delete' | 'confirm_reminder';
  data: Record<string, unknown>;
  expiresAt: Timestamp;
}
