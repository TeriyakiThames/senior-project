import type { IntentClassification } from '@/types/jev';
import type { UserDoc } from '@/types/firestore';
import { handleSetAlarm, type HandleSetAlarmOptions } from './alarm';
import { handleSetReminder, type HandleSetReminderOptions } from './reminder';
import {
  handleSaveNote,
  handleConfirmNote,
  handleCancelAction,
  type HandleSaveNoteOptions,
  type HandleConfirmNoteOptions,
  type HandleCancelActionOptions,
} from './notes';

export interface ToolResult {
  success: boolean;
  message?: string;
  flexMessage?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

export interface ExecuteToolOptions {
  intent: IntentClassification;
  userText: string;
  geminiResponse?: string;
  user: UserDoc;
  now?: Date;
  alarmOptions?: HandleSetAlarmOptions;
  reminderOptions?: HandleSetReminderOptions;
  noteOptions?: HandleSaveNoteOptions;
  confirmNoteOptions?: HandleConfirmNoteOptions;
  cancelActionOptions?: HandleCancelActionOptions;
}

/**
 * Main tool dispatcher routing classified intents to their respective handlers.
 */
export async function executeTool(options: ExecuteToolOptions): Promise<ToolResult> {
  const {
    intent,
    userText,
    geminiResponse = '',
    user,
    now,
    alarmOptions,
    reminderOptions,
    noteOptions,
    confirmNoteOptions,
    cancelActionOptions,
  } = options;

  switch (intent.intent) {
    case 'set_alarm':
      return handleSetAlarm(userText, geminiResponse, user, {
        now,
        ...alarmOptions,
      });

    case 'set_reminder':
      return handleSetReminder(userText, geminiResponse, user, {
        now,
        ...reminderOptions,
      });

    case 'save_note':
      return handleSaveNote(userText, geminiResponse, user, {
        now,
        ...noteOptions,
      });

    case 'confirm_action':
      return handleConfirmNote(user, {
        now,
        ...confirmNoteOptions,
      });

    case 'cancel_action':
      return handleCancelAction(user, {
        now,
        ...cancelActionOptions,
      });

    case 'list_items':
    case 'delete_item':
    case 'update_item':
    case 'snooze':
    case 'dismiss':
      // Graceful pass-through until respective tool tickets are implemented
      return {
        success: true,
        message: geminiResponse || undefined,
      };

    case 'general_chat':
    default:
      return {
        success: true,
        message: geminiResponse || undefined,
      };
  }
}

export * from './alarm';
export * from './reminder';
export * from './notes';
