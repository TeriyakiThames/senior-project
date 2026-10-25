import { webhook, type messagingApi } from '@line/bot-sdk';
import { lineClient } from './client';
import { processAudioMessage, getUserProfile } from '@/lib/speech/handler';
import { resolvePersonaParticles } from '@/lib/ai/persona';
import { AppError, logError, getFallbackMessage, type ErrorStage } from '@/lib/utils/errors';
import { getOrCreateUser, saveMessages } from '@/lib/firebase/collections';
import { loadMemoryContext, updateUserProfile } from '@/lib/ai/memory';
import { generateResponse } from '@/lib/ai/gemini';
import { classifyIntent } from '@/lib/ai/jev';
import {
  executeTool,
  handleSnooze,
  handleDismiss,
  handleConfirmNote,
  handleCancelAction,
  type ToolResult,
} from '@/lib/tools';

/**
 * Resolves the appropriate pipeline failure stage from the event and caught error.
 */
export function resolveErrorStage(event: webhook.Event, error: unknown): ErrorStage {
  if (error instanceof AppError) {
    if (error.code.startsWith('STT_')) return 'stt';
    if (error.code.startsWith('AI_')) return 'ai';
    if (error.code.startsWith('TOOL_')) return 'tool';
    if (error.code.startsWith('NET_')) return 'network';
  }

  if (event.type === 'message') {
    const msg = (event as webhook.MessageEvent).message;
    if (msg.type === 'audio') return 'stt';
  }

  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('network') ||
    message.includes('fetch')
  ) {
    return 'network';
  }

  return 'default';
}

/**
 * Handles incoming text messages by routing them through the full conversational pipeline:
 * 1. Resolves user profile and fetches or initializes the user document in Firestore.
 * 2. Short-circuits interactive notification actions (snooze/dismiss) and note confirmation (บันทึกเลย/ยกเลิก).
 * 3. Loads 3-tier memory context.
 * 4. Executes conversational response generation (Gemini) and deterministic intent classification (Jev) concurrently.
 * 5. Executes the matching tool (alarm, reminder, notes, list, delete, actions).
 * 6. Dispatches a single reply to LINE with Flex Message or text.
 * 7. Records the conversation turn in Firestore messages history and asynchronously learns new profile facts.
 *
 * Accepts optional transcribedText to process recognized audio input.
 */
export async function handleTextMessage(
  event: webhook.MessageEvent & { message: webhook.TextMessageContent },
  transcribedText?: string,
): Promise<void> {
  const replyToken = event.replyToken;
  if (!replyToken) {
    return;
  }

  const rawText = transcribedText ?? event.message.text;
  const userText = rawText?.trim() ?? '';
  if (!userText) {
    return;
  }

  const userId = event.source?.userId;

  // 1. Fetch display name & retrieve or create user
  let displayName = 'คุณตาคุณยาย';
  if (userId) {
    try {
      const profile = await lineClient.getProfile(userId);
      if (profile?.displayName) {
        displayName = profile.displayName;
      }
    } catch {
      // Gracefully continue with default display name if profile fetch fails
    }
  }

  const user = userId ? await getOrCreateUser(userId, displayName) : null;

  // 2. Deterministic short-circuits: Snooze / Dismiss
  if (user && /^(snooze|dismiss)_(alarm|reminder):/.test(userText)) {
    try {
      const toolRes = userText.startsWith('snooze_')
        ? await handleSnooze(userText, user)
        : await handleDismiss(userText, user);

      const replyText = toolRes.message || 'ดำเนินการเรียบร้อยแล้วค่ะ';
      await lineClient.replyMessage({
        replyToken,
        messages: [{ type: 'text', text: replyText }],
      });

      if (userId) {
        await saveMessages(userId, userText, replyText);
      }
      return;
    } catch (error) {
      throw error instanceof AppError
        ? error
        : new AppError((error as Error).message, 'TOOL_ACTION_FAIL');
    }
  }

  // 3. Deterministic short-circuits: Note confirm / cancel
  const isNoteConfirm = userText === 'บันทึกเลย' || userText === '✓ บันทึกเลย';
  const isNoteCancel = userText === 'ยกเลิก' || userText === '✕ ยกเลิก';
  if (user && (isNoteConfirm || isNoteCancel)) {
    try {
      const toolRes = isNoteConfirm
        ? await handleConfirmNote(user)
        : await handleCancelAction(user);

      const replyText =
        toolRes.message ||
        (isNoteConfirm
          ? 'บันทึกโน้ตเรียบร้อยแล้วค่ะ คุณตาคุณยาย'
          : 'ยกเลิกการบันทึกเรียบร้อยแล้วค่ะ');

      await lineClient.replyMessage({
        replyToken,
        messages: [{ type: 'text', text: replyText }],
      });

      if (userId) {
        await saveMessages(userId, userText, replyText);
      }
      return;
    } catch (error) {
      throw error instanceof AppError
        ? error
        : new AppError((error as Error).message, 'TOOL_NOTE_FAIL');
    }
  }

  // 4. Load memory context
  let memoryContext;
  try {
    memoryContext = userId
      ? await loadMemoryContext(userId)
      : { recentMessages: [], userFacts: [] };
  } catch {
    memoryContext = { recentMessages: [], userFacts: [] };
  }

  const recentMessages = memoryContext.recentMessages;
  const currentUser = memoryContext.user ?? user;

  // 5. Parallel Gemini response generation and Jev intent classification
  const lastAssistantMsg = [...recentMessages]
    .reverse()
    .find((m) => m.role === 'assistant')?.content;

  let geminiResult: { responseText: string; interactionId?: string };
  let intentResult;

  try {
    const [geminiRes, jevRes] = await Promise.all([
      currentUser
        ? generateResponse(userText, currentUser, recentMessages)
        : Promise.resolve({ responseText: 'สวัสดีค่ะ มีอะไรให้หนูช่วยไหมคะ' }),
      classifyIntent(userText, lastAssistantMsg, { fallbackOnFailure: true }),
    ]);
    geminiResult = geminiRes;
    intentResult = jevRes;
  } catch (error) {
    throw error instanceof AppError
      ? error
      : new AppError((error as Error).message, 'AI_PIPELINE_FAIL');
  }

  // 6. Execute matching tool
  let toolResult: ToolResult;
  try {
    if (currentUser) {
      toolResult = await executeTool({
        intent: intentResult,
        userText,
        geminiResponse: geminiResult.responseText,
        user: currentUser,
      });
    } else {
      toolResult = { success: true, message: geminiResult.responseText };
    }
  } catch (error) {
    throw error instanceof AppError
      ? error
      : new AppError((error as Error).message, 'TOOL_EXEC_FAIL');
  }

  // 7. Dispatch reply to LINE (single reply token)
  let lineMessages: messagingApi.Message[];
  let savedAssistantText: string;

  if (toolResult.flexMessage) {
    lineMessages = [toolResult.flexMessage as messagingApi.FlexMessage];
    const dataSummary = (toolResult.data as { summary?: string } | undefined)?.summary;
    const flexAltText = (toolResult.flexMessage as { altText?: string }).altText;
    savedAssistantText = dataSummary
      ? `สรุปบันทึก: ${dataSummary}`
      : (flexAltText ?? 'ส่งการแจ้งเตือนแบบการ์ด');
  } else if (toolResult.message) {
    lineMessages = [{ type: 'text', text: toolResult.message }];
    savedAssistantText = toolResult.message;
  } else {
    const fallbackText = geminiResult.responseText || 'สวัสดีค่ะ มีอะไรให้หนูช่วยไหมคะ';
    lineMessages = [{ type: 'text', text: fallbackText }];
    savedAssistantText = fallbackText;
  }

  await lineClient.replyMessage({
    replyToken,
    messages: lineMessages,
  });

  // 8. Save messages to Firestore history
  if (userId) {
    try {
      await saveMessages(userId, userText, savedAssistantText);
    } catch (saveError) {
      logError('firestore_save_messages', saveError, { userId });
    }

    // 9. Asynchronously update user profile facts in background
    updateUserProfile(userId, userText, savedAssistantText, memoryContext.userFacts).catch(
      (memError) => {
        logError('ai_memory_update', memError, { userId });
      },
    );
  }
}

/**
 * Handles incoming audio messages by processing voice download, STT transcription,
 * and forwarding recognized text to the conversational text pipeline.
 */
export async function handleAudioMessage(
  event: webhook.MessageEvent & { message: webhook.AudioMessageContent },
): Promise<void> {
  await processAudioMessage(event, async (transcribedText) => {
    await handleTextMessage(
      event as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent },
      transcribedText,
    );
  });
}

/**
 * Routes a single webhook event to the appropriate message handler.
 * Ignores unsupported message types and non-message events safely.
 */
export async function handleWebhookEvent(event: webhook.Event): Promise<void> {
  if (event.type !== 'message') {
    return;
  }

  const messageEvent = event as webhook.MessageEvent;
  if (messageEvent.message.type === 'text') {
    await handleTextMessage(
      messageEvent as webhook.MessageEvent & { message: webhook.TextMessageContent },
    );
  } else if (messageEvent.message.type === 'audio') {
    await handleAudioMessage(
      messageEvent as webhook.MessageEvent & { message: webhook.AudioMessageContent },
    );
  }
}

/**
 * Iterates through webhook events and processes each event safely.
 * Catches per-event errors so one failed event does not crash or abort processing for others,
 * logging structured telemetry and replying with an elderly-friendly, polite fallback message.
 */
export async function processWebhookEvents(events: webhook.Event[]): Promise<void> {
  for (const event of events) {
    try {
      await handleWebhookEvent(event);
    } catch (error) {
      const stage = resolveErrorStage(event, error);
      const userId = event.source?.userId;
      const replyToken =
        'replyToken' in event && typeof (event as { replyToken?: unknown }).replyToken === 'string'
          ? (event as { replyToken: string }).replyToken
          : undefined;

      logError(stage, error, {
        stage,
        userId,
        eventType: event.type,
      });

      const isReplyError =
        error instanceof Error &&
        (error.message.includes('LINE API') ||
          error.message.includes('Invalid reply token') ||
          error.message.includes('replyMessage'));

      if (replyToken && !isReplyError) {
        try {
          const userDoc = await getUserProfile(userId);
          const particles = resolvePersonaParticles(userDoc);
          const language = userDoc?.language ?? 'th';
          const fallbackText = getFallbackMessage(stage, language, particles);

          await lineClient.replyMessage({
            replyToken,
            messages: [
              {
                type: 'text',
                text: fallbackText,
              },
            ],
          });
        } catch (replyError) {
          logError('line_reply', replyError, {
            stage,
            userId,
          });
        }
      }
    }
  }
}
