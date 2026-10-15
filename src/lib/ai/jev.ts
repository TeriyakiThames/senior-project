import { TypeSafeClient, choice, noul } from '@typesafe-ai/sdk';
import type { IntentClassification, IntentType } from '@/types/jev';

const apiKey = process.env.TYPESAFE_API_KEY || 'placeholder_typesafe_key';

const globalForJev = globalThis as unknown as {
  jevClient?: TypeSafeClient;
};

export const jevClient = globalForJev.jevClient ?? new TypeSafeClient({ apiKey });

if (process.env.NODE_ENV !== 'production') {
  globalForJev.jevClient = jevClient;
}

export const INTENT_CRITERIA: Record<IntentType, string> = {
  set_alarm:
    'User wants to set or create a new alarm or wake-up call (e.g. ตั้งปลุก, ปลุกตอนเช้า).',
  set_reminder:
    'User wants to schedule or set a reminder for a task, medication, appointment, or event (e.g. เตือนกินยา, เตือนไปหาหมอ).',
  save_note:
    'User wants to record, save, or take a note, memo, or thought (e.g. จดบันทึก, บันทึกไว้หน่อย).',
  list_items:
    'User wants to view, query, check, or list existing alarms, reminders, notes, or schedule (e.g. มีนัดอะไรบ้าง, ปลุกกี่โมงบ้าง, ขอดูบันทึก).',
  delete_item:
    'User wants to remove, delete, or clear an existing alarm, reminder, or note (e.g. ลบการแจ้งเตือน, ลบโน้ต, ยกเลิกนาฬิกาปลุก).',
  update_item:
    'User wants to modify, edit, reschedule, or update an existing item (e.g. เลื่อนเวลาปลุก, แก้ไขข้อความเตือน).',
  confirm_action:
    'User explicitly confirms, approves, or says yes to a pending action or question (e.g. ตกลง, ใช่, ยืนยัน, เอาเลย).',
  cancel_action:
    'User rejects, declines, cancels, or says no to a pending action or question (e.g. ยกเลิก, ไม่เอา, ไม่ใช่, ปฏิเสธ).',
  snooze:
    'User wants to snooze or temporarily delay an active sounding alarm or reminder notification (e.g. ขออีก 5 นาที, เลื่อนไปก่อน, ค่อยเตือนใหม่).',
  dismiss:
    'User wants to stop, dismiss, or silence an active sounding alarm or reminder notification (e.g. ปิดเสียง, ปิดเลย, รับทราบแล้ว, หยุดปลุก).',
  general_chat:
    'General conversation, greetings, social banter, health inquiries, or requests that do not map to scheduling, alarms, notes, or actions (e.g. สวัสดี, สบายดีไหม, กินข้าวหรือยัง).',
};

export interface ClassifyIntentOptions {
  client?: TypeSafeClient;
  model?: string;
  ambiguityThreshold?: number;
  fallbackOnFailure?: boolean;
}

/**
 * Classifies user intent deterministically using TypeSafe AI Jev (systemOne).
 *
 * Combines a choice primitive across the 11 system intents with a noul
 * ambiguity primitive to detect missing or incomplete parameters.
 */
export async function classifyIntent(
  userInput: string,
  assistantResponse?: string,
  options?: ClassifyIntentOptions,
): Promise<IntentClassification> {
  const client = options?.client ?? jevClient;
  const threshold = options?.ambiguityThreshold ?? 0.5;

  const state = assistantResponse?.trim()
    ? `User: ${userInput}\nAssistant: ${assistantResponse}`
    : `User: ${userInput}`;

  try {
    const response = await client.systemOne({
      state,
      model: options?.model,
      questions: {
        intent: choice(
          "Classify the user's intent into exactly one category based on the conversation.",
          INTENT_CRITERIA,
        ),
        is_ambiguous: noul(
          'Is the user request ambiguous, incomplete, or missing key parameters (such as time for alarm/reminder or content for notes) needed to execute the action?',
          {
            true: 'The request is missing critical information or is too vague to act on directly.',
            false: 'The request has sufficient details or is standard conversational chat.',
          },
        ),
      },
    });

    const intentAnswer = response.answers.intent;
    const ambiguityAnswer = response.answers.is_ambiguous;

    return {
      intent: intentAnswer.choice as IntentType,
      confidence: intentAnswer.confidence,
      isAmbiguous: ambiguityAnswer.noul >= threshold,
      probabilities: intentAnswer.probabilities as Record<string, number>,
    };
  } catch (error) {
    if (options?.fallbackOnFailure) {
      return {
        intent: 'general_chat',
        confidence: 0,
        isAmbiguous: true,
      };
    }
    throw error;
  }
}
