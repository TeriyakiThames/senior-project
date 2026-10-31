import { GoogleGenAI } from '@google/genai';
import { Timestamp } from 'firebase-admin/firestore';
import { userRef, messagesRef, getRecentMessages } from '@/lib/firebase/collections';
import { geminiClient, generateDailySummary } from '@/lib/ai/gemini';
import type { UserDoc, MessageDoc } from '@/types/firestore';

export interface MemoryContext {
  user?: UserDoc;
  recentMessages: MessageDoc[];
  dailySummary?: {
    date: string;
    summary: string;
  };
  userFacts: string[];
}

export interface LoadMemoryContextOptions {
  now?: Date;
  client?: GoogleGenAI;
  messagesLimit?: number;
  user?: UserDoc;
}

export interface UpdateUserProfileOptions {
  client?: GoogleGenAI;
  model?: string;
  maxFacts?: number;
}

const defaultModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const MAX_PROFILE_FACTS = 50;

/**
 * Returns the current calendar date in Asia/Bangkok formatted as YYYY-MM-DD.
 */
export function getBangkokDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Three-tier memory loader:
 * 1. Short-term context: Last N messages in chronological order from Firestore.
 * 2. Daily summary: Synthesized summary of yesterday if today is a new calendar day (Asia/Bangkok).
 * 3. Long-term user facts: Accumulated facts from user profile.
 */
export async function loadMemoryContext(
  lineUserId: string,
  options?: LoadMemoryContextOptions,
): Promise<MemoryContext> {
  let user = options?.user;

  if (!user) {
    const userSnap = await userRef(lineUserId).get();
    if (!userSnap.exists) {
      return {
        recentMessages: [],
        userFacts: [],
      };
    }
    user = userSnap.data() as UserDoc;
  }

  const limit = options?.messagesLimit ?? 10;
  const recentMessages = await getRecentMessages(lineUserId, limit);

  const now = options?.now ?? new Date();
  const todayDateStr = getBangkokDateString(now);

  let dailySummary = user.dailySummary
    ? { date: user.dailySummary.date, summary: user.dailySummary.summary }
    : undefined;

  // Tier 2: Check rollover for a new calendar day
  if (user.dailySummary?.date && user.dailySummary.date !== todayDateStr) {
    const yesterdaySnap = await messagesRef(lineUserId)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    if (!yesterdaySnap.empty) {
      const messagesToSummarize = yesterdaySnap.docs.map((d) => d.data() as MessageDoc).reverse();

      const summaryText = await generateDailySummary(messagesToSummarize, {
        client: options?.client,
      });

      if (summaryText.trim()) {
        dailySummary = {
          date: todayDateStr,
          summary: summaryText,
        };

        await userRef(lineUserId).update({
          'dailySummary.date': todayDateStr,
          'dailySummary.summary': summaryText,
          'dailySummary.generatedAt': Timestamp.now(),
        });

        user.dailySummary = {
          date: todayDateStr,
          summary: summaryText,
          generatedAt: Timestamp.now(),
        };
      }
    }
  }

  return {
    user,
    recentMessages,
    dailySummary,
    userFacts: user.profile?.facts ?? [],
  };
}

/**
 * Extracts novel personal facts from a conversation turn using Gemini.
 */
async function extractUserFacts(
  userText: string,
  assistantResponse: string,
  existingFacts: string[],
  options?: UpdateUserProfileOptions,
): Promise<string[]> {
  const client = options?.client ?? geminiClient;
  const model = options?.model ?? defaultModel;

  const factsList =
    existingFacts.length > 0 ? existingFacts.map((f) => `- ${f}`).join('\n') : 'None';

  const systemInstruction = `You are a memory extraction assistant for an elderly Thai user companion.
Analyze the user message and assistant reply to discover any NEW personal facts about the user (e.g. name, preferences, daily routine, family relationships, habits, health notes).

Rules for memory extraction:
1. Only extract personal facts that the user explicitly stated or confirmed about themselves (e.g. "ผมชื่อ...", "ยายชอบกิน...", "จำไว้ว่าฉันแพ้...").
2. NEVER extract facts if the assistant response indicates an error, failure, cancellation, or inability to perform a task (e.g. "เกิดข้อผิดพลาด", "ไม่สำเร็จ", "ขออภัย", "ยกเลิก").
3. Do NOT extract one-time tool requests (such as a single reminder or alarm request) as permanent daily habits unless the user explicitly stated it is their regular habit or recurring routine.
4. Return ONLY a valid JSON array of concise string statements in the user's language (primarily Thai).
5. If no new personal facts were mentioned or if the action failed/was cancelled, return an empty array [].
Do NOT return Markdown formatting or conversational commentary, only the JSON array.`;

  const inputPrompt = `Existing facts:
${factsList}

User message: "${userText}"
Assistant response: "${assistantResponse}"`;

  const interaction = await client.interactions.create({
    model,
    input: inputPrompt,
    system_instruction: systemInstruction,
    generation_config: {
      temperature: 0.1,
      max_output_tokens: 512,
    },
    store: false,
  });

  const rawOutput = (interaction.output_text ?? '').trim();
  if (!rawOutput) {
    return [];
  }

  const cleaned = rawOutput
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      );
    }
  } catch (error) {
    console.error(
      '[Memory] Failed to parse extracted facts JSON:',
      error,
      'Raw output:',
      rawOutput,
    );
  }

  return [];
}

/**
 * Discovers novel personal facts after a turn and updates the user document in Firestore.
 * Capped at 50 facts (FIFO) and deduplicated. Safe for asynchronous / fire-and-forget calls.
 */
export async function updateUserProfile(
  lineUserId: string,
  userText: string,
  assistantResponse: string,
  existingFacts: string[] = [],
  options?: UpdateUserProfileOptions,
): Promise<string[]> {
  try {
    const newFacts = await extractUserFacts(userText, assistantResponse, existingFacts, options);
    if (newFacts.length === 0) {
      return existingFacts;
    }

    const existingSet = new Set(existingFacts.map((f) => f.trim()));
    const uniqueNewFacts: string[] = [];

    for (const fact of newFacts) {
      const trimmed = fact.trim();
      if (trimmed && !existingSet.has(trimmed)) {
        existingSet.add(trimmed);
        uniqueNewFacts.push(trimmed);
      }
    }

    if (uniqueNewFacts.length === 0) {
      return existingFacts;
    }

    const maxFacts = options?.maxFacts ?? MAX_PROFILE_FACTS;
    const updatedFacts = [...existingFacts, ...uniqueNewFacts].slice(-maxFacts);

    await userRef(lineUserId).update({
      'profile.facts': updatedFacts,
      'profile.updatedAt': Timestamp.now(),
    });

    return updatedFacts;
  } catch (error) {
    console.error('[Memory] Error updating user profile facts:', error);
    return existingFacts;
  }
}
