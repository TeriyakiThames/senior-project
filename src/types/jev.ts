export type IntentType =
  | 'set_alarm'
  | 'set_reminder'
  | 'save_note'
  | 'list_items'
  | 'delete_item'
  | 'update_item'
  | 'confirm_action'
  | 'cancel_action'
  | 'snooze'
  | 'dismiss'
  | 'general_chat';

export interface IntentClassification {
  intent: IntentType | string;
  confidence: number;
  isAmbiguous: boolean;
  probabilities?: Record<string, number>;
}

export interface AlarmParams {
  time: string; // "HH:mm" 24h
  label?: string;
  recurrence: 'once' | 'daily' | 'weekly' | 'monthly';
  daysOfWeek?: number[];
  dayOfMonth?: number;
}

export interface ReminderParams {
  message: string;
  scheduledAt: string; // ISO 8601 datetime
  recurrence: 'once' | 'daily' | 'weekly' | 'monthly';
  daysOfWeek?: number[];
  dayOfMonth?: number;
}
