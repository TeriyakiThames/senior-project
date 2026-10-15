import { GoogleGenAI } from '@google/genai';
import { TypeSafeClient, choice } from '@typesafe-ai/sdk';
import { geminiClient } from '@/lib/ai/gemini';
import { jevClient } from '@/lib/ai/jev';
import type { AlarmParams, ReminderParams } from '@/types/jev';

export type { AlarmParams, ReminderParams };

export type ItemType = 'alarm' | 'reminder' | 'note' | 'all';

export interface ClassifiedItemType {
  itemType: ItemType;
  confidence: number;
}

export interface ExtractAlarmParamsOptions {
  client?: GoogleGenAI;
  now?: Date;
  model?: string;
}

export interface ExtractReminderParamsOptions {
  client?: GoogleGenAI;
  now?: Date;
  model?: string;
}

export interface ClassifyItemTypeOptions {
  client?: TypeSafeClient;
  model?: string;
}

const defaultGeminiModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

/**
 * Extracts structured alarm parameters (24-hour HH:mm time and recurrence)
 * from Thai or English colloquial text using Gemini structured JSON generation.
 */
export async function extractAlarmParams(
  userText: string,
  options?: ExtractAlarmParamsOptions,
): Promise<AlarmParams | null> {
  if (!userText || !userText.trim()) {
    return null;
  }

  const client = options?.client ?? geminiClient;
  const model = options?.model ?? defaultGeminiModel;

  const systemInstruction = `You are a structured parameter extractor for alarm requests.
Extract the alarm time in 24-hour "HH:mm" format and recurrence from user input.

Thai time conventions:
- "ตี 1" = 01:00 ... "ตี 5" / "ตีห้า" = 05:00
- "6 โมงเช้า" = 06:00, "7 โมงเช้า" = 07:00 ... "11 โมงเช้า" / "สิบเอ็ดโมง" = 11:00
- "เที่ยง" / "เที่ยงวัน" = 12:00, "เที่ยงครึ่ง" = 12:30
- "บ่ายโมง" / "บ่าย 1" = 13:00, "บ่ายสอง" = 14:00, "บ่ายสาม" / "บ่าย 3" = 15:00, "บ่ายสี่" = 16:00
- "5 โมงเย็น" / "ห้าโมงเย็น" = 17:00, "6 โมงเย็น" / "หกโมงเย็น" = 18:00
- "1 ทุ่ม" / "ทุ่มตรง" = 19:00, "ทุ่มครึ่ง" = 19:30, "2 ทุ่ม" = 20:00, "3 ทุ่ม" = 21:00, "4 ทุ่ม" = 22:00, "5 ทุ่ม" = 23:00
- "เที่ยงคืน" = 00:00
- Half hours: "ครึ่ง" = :30 (e.g., "7 โมงครึ่ง" = 07:30)

Recurrence conventions:
- "ทุกวัน" = "daily"
- "ทุกวันจันทร์" = "weekly" (daysOfWeek: [1])
- "ทุกวันเสาร์-อาทิตย์" = "weekly" (daysOfWeek: [6, 0])
- "ทุกเดือน" = "monthly"
- Default: "once"

Return ONLY valid JSON matching this schema:
{
  "time": "HH:mm",
  "label": "optional string or omitted",
  "recurrence": "once" | "daily" | "weekly" | "monthly",
  "daysOfWeek": [0, 1, 2, 3, 4, 5, 6],
  "dayOfMonth": 1-31
}

If no clear alarm time can be identified, return JSON null:
null`;

  try {
    const interaction = await client.interactions.create({
      model,
      input: userText.trim(),
      system_instruction: systemInstruction,
      generation_config: {
        temperature: 0.0,
        max_output_tokens: 256,
      },
      store: false,
    });

    const rawOutput = interaction.output_text?.trim() ?? '';
    const cleaned = rawOutput.replace(/```json\n?|\n?```/g, '').trim();

    if (!cleaned || cleaned === 'null') {
      return null;
    }

    const parsed = JSON.parse(cleaned) as Partial<AlarmParams>;

    if (!parsed || typeof parsed !== 'object' || !parsed.time) {
      return null;
    }

    // Validate 24-hour HH:mm time format
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(parsed.time)) {
      return null;
    }

    const validRecurrences = ['once', 'daily', 'weekly', 'monthly'] as const;
    const recurrence = validRecurrences.includes(
      parsed.recurrence as (typeof validRecurrences)[number],
    )
      ? (parsed.recurrence as (typeof validRecurrences)[number])
      : 'once';

    const result: AlarmParams = {
      time: parsed.time,
      recurrence,
    };

    if (parsed.label && typeof parsed.label === 'string') {
      result.label = parsed.label;
    }
    if (Array.isArray(parsed.daysOfWeek) && parsed.daysOfWeek.every((d) => typeof d === 'number')) {
      result.daysOfWeek = parsed.daysOfWeek;
    }
    if (
      typeof parsed.dayOfMonth === 'number' &&
      parsed.dayOfMonth >= 1 &&
      parsed.dayOfMonth <= 31
    ) {
      result.dayOfMonth = parsed.dayOfMonth;
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Extracts reminder parameters (message, scheduledAt in ISO 8601, and recurrence)
 * from Thai or English text using Gemini structured JSON generation.
 */
export async function extractReminderParams(
  userText: string,
  options?: ExtractReminderParamsOptions,
): Promise<ReminderParams | null> {
  if (!userText || !userText.trim()) {
    return null;
  }

  const client = options?.client ?? geminiClient;
  const model = options?.model ?? defaultGeminiModel;
  const now = options?.now ?? new Date();

  const referenceDateBangkok = now.toLocaleString('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const systemInstruction = `You are a structured parameter extractor for reminder requests.
Extract reminder message content, scheduled target datetime in ISO 8601 format, and recurrence.

Current Reference Time in Asia/Bangkok: ${referenceDateBangkok} (Timezone: Asia/Bangkok, UTC+7)

Thai date and time conventions:
- "เตือนกินยาตอน 6 โมงเย็น" -> message: "กินยา", scheduledAt: today or tomorrow 18:00:00+07:00
- "เตือนพรุ่งนี้ 8 โมงเช้า" -> message: reminder text, scheduledAt: tomorrow 08:00:00+07:00
- "บ่ายสามโมง" = 15:00
- "ทุ่มครึ่ง" = 19:30
- If the requested time today has already passed, schedule for the next occurrence tomorrow.

Return ONLY valid JSON matching this schema:
{
  "message": "reminder message description",
  "scheduledAt": "YYYY-MM-DDTHH:mm:ss+07:00",
  "recurrence": "once" | "daily" | "weekly" | "monthly",
  "daysOfWeek": [0, 1, 2, 3, 4, 5, 6],
  "dayOfMonth": 1-31
}

If no reminder message or scheduled datetime can be extracted, return JSON null:
null`;

  try {
    const interaction = await client.interactions.create({
      model,
      input: userText.trim(),
      system_instruction: systemInstruction,
      generation_config: {
        temperature: 0.0,
        max_output_tokens: 256,
      },
      store: false,
    });

    const rawOutput = interaction.output_text?.trim() ?? '';
    const cleaned = rawOutput.replace(/```json\n?|\n?```/g, '').trim();

    if (!cleaned || cleaned === 'null') {
      return null;
    }

    const parsed = JSON.parse(cleaned) as Partial<ReminderParams>;

    if (!parsed || typeof parsed !== 'object' || !parsed.message || !parsed.scheduledAt) {
      return null;
    }

    const scheduledDate = new Date(parsed.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return null;
    }

    const validRecurrences = ['once', 'daily', 'weekly', 'monthly'] as const;
    const recurrence = validRecurrences.includes(
      parsed.recurrence as (typeof validRecurrences)[number],
    )
      ? (parsed.recurrence as (typeof validRecurrences)[number])
      : 'once';

    const result: ReminderParams = {
      message: parsed.message.trim(),
      scheduledAt: parsed.scheduledAt,
      recurrence,
    };

    if (Array.isArray(parsed.daysOfWeek) && parsed.daysOfWeek.every((d) => typeof d === 'number')) {
      result.daysOfWeek = parsed.daysOfWeek;
    }
    if (
      typeof parsed.dayOfMonth === 'number' &&
      parsed.dayOfMonth >= 1 &&
      parsed.dayOfMonth <= 31
    ) {
      result.dayOfMonth = parsed.dayOfMonth;
    }

    return result;
  } catch {
    return null;
  }
}

export const ITEM_TYPE_CRITERIA: Record<ItemType, string> = {
  alarm: 'An alarm (wake-up time, sound alert, e.g., นาฬิกาปลุก, ปลุกตอนเช้า, เวลาปลุก).',
  reminder:
    'A reminder (scheduled notification with message or task, e.g., เตือนกินยา, แจ้งเตือนนัดหมอ, การแจ้งเตือน).',
  note: 'A note or memo (recorded thoughts, summaries, text memos, e.g., โน้ต, บันทึกข้อความ, ที่จดไว้).',
  all: 'All items or unspecified items across categories (e.g., ทุกอย่าง, ทั้งหมด, รายการทั้งหมด, ลบให้หมด).',
};

/**
 * Disambiguates which item type the user wants to list, view, or delete
 * using TypeSafe AI Jev choice classification.
 */
export async function classifyItemType(
  userText: string,
  assistantResponse?: string,
  options?: ClassifyItemTypeOptions,
): Promise<ClassifiedItemType> {
  const client = options?.client ?? jevClient;

  const state = assistantResponse?.trim()
    ? `User: ${userText}\nAssistant: ${assistantResponse}`
    : `User: ${userText}`;

  const response = await client.systemOne({
    state,
    model: options?.model,
    questions: {
      itemType: choice(
        'What type of item is the user referring to or wants to operate on?',
        ITEM_TYPE_CRITERIA,
      ),
    },
  });

  const answer = response.answers.itemType;

  return {
    itemType: answer.choice as ItemType,
    confidence: answer.confidence,
  };
}
