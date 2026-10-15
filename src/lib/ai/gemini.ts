import { GoogleGenAI } from '@google/genai';
import { buildSystemPrompt } from '@/lib/ai/system-prompt';
import type { UserDoc, MessageDoc } from '@/types/firestore';

const apiKey = process.env.GEMINI_API_KEY;
const defaultModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

const globalForGemini = globalThis as unknown as {
  geminiClient?: GoogleGenAI;
};

export const ai = globalForGemini.geminiClient ?? new GoogleGenAI({ apiKey });
export const geminiClient = ai;

if (process.env.NODE_ENV !== 'production') {
  globalForGemini.geminiClient = ai;
}

export interface GenerateResponseOptions {
  client?: GoogleGenAI;
  now?: Date;
  model?: string;
}

export interface SummarizeNoteOptions {
  client?: GoogleGenAI;
  language?: 'th' | 'en';
  model?: string;
}

export interface GenerateDailySummaryOptions {
  client?: GoogleGenAI;
  model?: string;
}

/**
 * Generates a warm, conversational Thai response using multi-turn chat context.
 */
export async function generateResponse(
  userText: string,
  user: UserDoc,
  recentMessages: MessageDoc[] = [],
  options?: GenerateResponseOptions,
): Promise<{ responseText: string; interactionId?: string }> {
  const client = options?.client ?? ai;
  const model = options?.model ?? defaultModel;

  const systemPrompt = buildSystemPrompt({
    now: options?.now,
    profileFacts: user.profile?.facts ?? [],
    dailySummary: user.dailySummary ?? null,
  });

  const historyContext = recentMessages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const fullInput = historyContext
    ? `Previous conversation:\n${historyContext}\n\nUser: ${userText}`
    : userText;

  const interaction = await client.interactions.create({
    model,
    input: fullInput,
    system_instruction: systemPrompt,
    generation_config: {
      temperature: 0.7,
      max_output_tokens: 1024,
    },
    store: false,
  });

  return {
    responseText: interaction.output_text ?? '',
    interactionId: interaction.id,
  };
}

/**
 * Summarizes note content into a concise 2–3 sentence memo preserving critical facts.
 */
export async function summarizeNote(
  content: string,
  options?: SummarizeNoteOptions,
): Promise<string> {
  if (!content || !content.trim()) {
    return '';
  }

  const client = options?.client ?? ai;
  const model = options?.model ?? defaultModel;
  const language = options?.language ?? 'th';

  const instruction =
    language === 'th'
      ? 'สรุปเนื้อหาโน้ตนี้ให้กระชับ ไม่เกิน 2-3 ประโยค โดยเก็บใจความสำคัญ วันที่ เวลา และสิ่งที่ต้องทำ ไว้อย่างครบถ้วน'
      : 'Summarize this note concisely in 2-3 sentences. Preserve all critical dates, times, and action items.';

  const interaction = await client.interactions.create({
    model,
    input: content,
    system_instruction: instruction,
    generation_config: {
      temperature: 0.3,
      max_output_tokens: 256,
    },
    store: false,
  });

  return interaction.output_text ?? content;
}

/**
 * Aggregates turn messages into a concise 3–5 bullet point summary narrative.
 */
export async function generateDailySummary(
  messages: MessageDoc[],
  options?: GenerateDailySummaryOptions,
): Promise<string> {
  if (!messages || messages.length === 0) {
    return '';
  }

  const client = options?.client ?? ai;
  const model = options?.model ?? defaultModel;

  const transcript = messages
    .map((m) => `${m.role === 'user' ? 'ผู้ใช้' : 'ผู้ช่วย'}: ${m.content}`)
    .join('\n');

  const instruction =
    'สรุปบทสนทนาประจำวันนี้เป็น 3-5 หัวข้อย่อย (bullet points) สั้น ๆ โดยเน้นสิ่งที่ทำเสร็จ การตัดสินใจ ความชอบ และเรื่องสำคัญที่คุยกัน';

  const interaction = await client.interactions.create({
    model,
    input: transcript,
    system_instruction: instruction,
    generation_config: {
      temperature: 0.3,
      max_output_tokens: 512,
    },
    store: false,
  });

  return interaction.output_text ?? '';
}
