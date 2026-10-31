import { webhook, type messagingApi } from '@line/bot-sdk';
import { lineClient } from './client';
import { startLoadingAnimation } from './loading';
import { processAudioMessage, getUserProfile } from '@/lib/speech/handler';
import { resolvePersonaParticles } from '@/lib/ai/persona';
import { AppError, logError, getFallbackMessage, type ErrorStage } from '@/lib/utils/errors';
import { getOrCreateUser, saveMessages, pendingActionsRef } from '@/lib/firebase/collections';
import { loadMemoryContext, updateUserProfile } from '@/lib/ai/memory';
import { generateResponse } from '@/lib/ai/gemini';
import { classifyIntent } from '@/lib/ai/jev';
import { buildFeatureSuggestionBubble } from '@/lib/ai/feature-suggestions';
import {
  executeTool,
  handleSnooze,
  handleDismiss,
  handleConfirmNote,
  handleConfirmReminder,
  handleCancelAction,
  handleUpdatePendingReminderTime,
  type ToolResult,
} from '@/lib/tools';
import type { PendingActionDoc } from '@/types/firestore';

export const DEFAULT_EVENT_TIMEOUT_MS = 50_000;
export const DEFAULT_DEDUP_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * In-memory deduplication cache tracking processed event IDs and message IDs with timestamps.
 */
const processedEventCache = new Map<string, number>();

/**
 * In-memory cache for user display names (TTL: 1 hour) to eliminate redundant LINE getProfile calls.
 */
const displayNameCache = new Map<string, { displayName: string; expiresAt: number }>();

export function getCachedDisplayName(userId: string): string | null {
  const cached = displayNameCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.displayName;
  }
  return null;
}

export function setCachedDisplayName(userId: string, displayName: string, ttlMs = 60 * 60 * 1000): void {
  displayNameCache.set(userId, { displayName, expiresAt: Date.now() + ttlMs });
}

export function clearDisplayNameCache(): void {
  displayNameCache.clear();
}

/**
 * Extracts a unique string identifier from a LINE webhook event.
 */
export function getEventIdentifier(event: webhook.Event): string | null {
  const eventObj = event as {
    webhookEventId?: string;
    message?: { id?: string };
  };

  if (eventObj.webhookEventId && typeof eventObj.webhookEventId === 'string') {
    return `webhook:${eventObj.webhookEventId}`;
  }

  if (eventObj.message?.id && typeof eventObj.message.id === 'string') {
    return `msg:${eventObj.message.id}`;
  }

  return null;
}

/**
 * Checks whether an event has already been processed or is a redelivery duplicate.
 */
export function isEventDuplicate(event: webhook.Event, ttlMs = DEFAULT_DEDUP_TTL_MS): boolean {
  const eventId = getEventIdentifier(event);
  if (!eventId) {
    return false;
  }

  const now = Date.now();

  // Housekeeping: remove expired keys if map grows large
  if (processedEventCache.size > 2000) {
    for (const [key, timestamp] of processedEventCache.entries()) {
      if (now - timestamp > ttlMs) {
        processedEventCache.delete(key);
      }
    }
  }

  if (processedEventCache.has(eventId)) {
    const timestamp = processedEventCache.get(eventId)!;
    if (now - timestamp < ttlMs) {
      return true;
    }
  }

  return false;
}

/**
 * Records an event as processed in the deduplication cache.
 */
export function markEventProcessed(event: webhook.Event): void {
  const eventId = getEventIdentifier(event);
  if (eventId) {
    processedEventCache.set(eventId, Date.now());
  }
}

/**
 * Clears the in-memory deduplication cache (useful for testing).
 */
export function clearProcessedEventCache(): void {
  processedEventCache.clear();
  clearDisplayNameCache();
}

/**
 * Wraps an asynchronous operation with an explicit deadline to prevent serverless function timeouts
 * from terminating event processing silently before a fallback response can be returned.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage = 'Operation timed out',
): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new AppError(timeoutMessage, 'NET_TIMEOUT'));
    }, ms);
  });

  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    timeoutPromise,
  ]);
}

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
 * 2. Short-circuits interactive notification actions (snooze/dismiss) and action confirmation (บันทึกเลย/ยืนยัน/ยกเลิก).
 * 3. Loads 3-tier memory context.
 * 4. Executes conversational response generation (Gemini) and deterministic intent classification (Jev) concurrently.
 * 5. Executes the matching tool (alarm, reminder, notes, list, delete, actions).
 * 6. Dispatches reply to LINE with Flex Message or text, followed by contextual feature suggestions bubble underneath.
 * 7. Records the conversation turn in Firestore messages history and asynchronously learns new profile facts.
 *
 * Accepts optional transcribedText to process recognized audio input.
 */
export async function handleTextMessage(
  event: webhook.MessageEvent & { message: webhook.TextMessageContent },
  transcribedText?: string,
  options?: { loadingAlreadyStarted?: boolean; disableSuggestions?: boolean },
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
    const cachedName = getCachedDisplayName(userId);
    if (cachedName) {
      displayName = cachedName;
    } else {
      try {
        const profile = await lineClient.getProfile(userId);
        if (profile?.displayName) {
          displayName = profile.displayName;
          setCachedDisplayName(userId, profile.displayName);
        }
      } catch {
        // Gracefully continue with default display name if profile fetch fails
      }
    }
  }

  const user = userId ? await getOrCreateUser(userId, displayName) : null;
  if (user?.displayName && userId && !getCachedDisplayName(userId)) {
    setCachedDisplayName(userId, user.displayName);
  }

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

  // 3. Deterministic short-circuits: Action Confirmation / Cancellation (Notes & Reminders)
  const isConfirm =
    userText === 'บันทึกเลย' ||
    userText === '✓ บันทึกเลย' ||
    userText === 'ยืนยัน' ||
    userText === '✓ ยืนยัน' ||
    userText === 'ยืนยันเตือน' ||
    userText === 'ตกลง';
  const isCancel = userText === 'ยกเลิก' || userText === '✕ ยกเลิก';

  if (user && (isConfirm || isCancel)) {
    try {
      let toolRes: ToolResult;
      let pendingType: string | null = null;

      if (isCancel) {
        toolRes = await handleCancelAction(user);
      } else {
        // Inspect current pending action in Firestore to determine whether to confirm reminder or note
        try {
          const pendingSnap = await pendingActionsRef(user.lineUserId).doc('current').get();
          pendingType = pendingSnap.exists
            ? ((pendingSnap.data() as PendingActionDoc)?.type ?? null)
            : null;
        } catch {}

        if (pendingType === 'confirm_reminder') {
          toolRes = await handleConfirmReminder(user);
        } else {
          toolRes = await handleConfirmNote(user);
        }
      }

      const replyText =
        toolRes.message ||
        (isCancel ? 'ยกเลิกเรียบร้อยแล้วค่ะ' : 'ดำเนินการเรียบร้อยแล้วค่ะ คุณตาคุณยาย');

      const messages: messagingApi.Message[] = [{ type: 'text', text: replyText }];

      // Attach contextual suggestion bubble underneath confirmation/cancellation
      if (toolRes.success && !options?.disableSuggestions) {
        const actionType = isCancel
          ? 'cancel_action'
          : pendingType === 'confirm_reminder'
            ? 'confirm_reminder'
            : 'confirm_note';
        const suggestionBubble = buildFeatureSuggestionBubble({
          actionType,
          userDoc: user,
          userText,
        });
        if (suggestionBubble) {
          messages.push(suggestionBubble);
        }
      }

      await lineClient.replyMessage({
        replyToken,
        messages,
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

  // 4. Trigger LINE Loading Animation before initiating heavy AI & tool processing
  const isDirectUserChat = event.source?.type === 'user' && !!userId;
  if (isDirectUserChat && !options?.loadingAlreadyStarted) {
    void startLoadingAnimation(userId, { loadingSeconds: 60 });
  }

  // 5. Load memory context
  let memoryContext;
  try {
    memoryContext = userId
      ? await loadMemoryContext(userId, { user: user ?? undefined })
      : { recentMessages: [], userFacts: [] };
  } catch {
    memoryContext = { recentMessages: [], userFacts: [] };
  }

  const recentMessages = memoryContext.recentMessages;
  const currentUser = memoryContext.user ?? user;

  // 5. Concurrent Gemini response generation and Jev intent classification
  const lastAssistantMsg = [...recentMessages]
    .reverse()
    .find((m) => m.role === 'assistant')?.content;

  const geminiPromise = currentUser
    ? generateResponse(userText, currentUser, recentMessages)
    : Promise.resolve({ responseText: 'สวัสดีค่ะ มีอะไรให้หนูช่วยไหมคะ' });

  // Guard against unhandled promise rejections if geminiPromise fails while a tool handles the user request
  geminiPromise.catch(() => {});

  let intentResult;
  try {
    intentResult = await classifyIntent(userText, lastAssistantMsg, { fallbackOnFailure: true });
  } catch (error) {
    throw error instanceof AppError
      ? error
      : new AppError((error as Error).message, 'AI_PIPELINE_FAIL');
  }

  // 6. Execute matching tool
  // For structured tool requests (set_alarm, set_reminder, save_note, confirm/cancel, snooze/dismiss),
  // execute tool immediately without waiting for speculative conversational dialogue.
  const requiresDialogue =
    intentResult.intent === 'general_chat' ||
    intentResult.intent === 'list_items' ||
    intentResult.intent === 'delete_item';

  let geminiResult: { responseText: string; interactionId?: string } = { responseText: '' };
  if (requiresDialogue) {
    try {
      geminiResult = await geminiPromise;
    } catch (error) {
      throw error instanceof AppError
        ? error
        : new AppError((error as Error).message, 'AI_PIPELINE_FAIL');
    }
  }

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
      const fallbackDialogue =
        geminiResult.responseText || (await geminiPromise.catch(() => ({ responseText: '' }))).responseText;
      toolResult = { success: true, message: fallbackDialogue || 'สวัสดีค่ะ มีอะไรให้หนูช่วยไหมคะ' };
    }
  } catch (error) {
    throw error instanceof AppError
      ? error
      : new AppError((error as Error).message, 'TOOL_EXEC_FAIL');
  }

  // 7. Dispatch reply to LINE (single reply token, with contextual suggestions bubble underneath)
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
    let fallbackText = geminiResult.responseText;
    if (!fallbackText) {
      try {
        const resolved = await geminiPromise;
        fallbackText = resolved.responseText;
      } catch {}
    }
    fallbackText = fallbackText || 'สวัสดีค่ะ มีอะไรให้หนูช่วยไหมคะ';
    lineMessages = [{ type: 'text', text: fallbackText }];
    savedAssistantText = fallbackText;
  }

  // Attach safe-guarded feature suggestions chat bubble underneath
  if (toolResult.success && !options?.disableSuggestions) {
    const suggestionBubble = buildFeatureSuggestionBubble({
      intent: intentResult?.intent,
      userText,
      userDoc: currentUser,
    });
    if (suggestionBubble) {
      lineMessages.push(suggestionBubble);
    }
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
    // Gate knowledge base updates:
    // - General chat turns are always eligible for learning user facts / preferences.
    // - Tool calls are strictly gated: only learn if the tool executed successfully and is not a pending draft.
    const isToolIntent = intentResult.intent !== 'general_chat';
    const isPendingDraft = Boolean(toolResult.flexMessage);
    const isToolSuccessful = toolResult.success && !isPendingDraft;
    const shouldUpdateKnowledgeBase = !isToolIntent || isToolSuccessful;

    if (shouldUpdateKnowledgeBase) {
      updateUserProfile(userId, userText, savedAssistantText, memoryContext.userFacts).catch(
        (memError) => {
          logError('ai_memory_update', memError, { userId });
        },
      );
    }
  }
}

/**
 * Handles incoming LINE postback events (e.g. datetimepicker selection, reminder confirm/cancel buttons).
 */
export async function handlePostbackEvent(
  event: webhook.PostbackEvent,
  options?: { disableSuggestions?: boolean },
): Promise<void> {
  const replyToken = event.replyToken;
  if (!replyToken) {
    return;
  }

  const userId = event.source?.userId;
  if (!userId) {
    return;
  }

  let displayName = 'คุณตาคุณยาย';
  const cachedName = getCachedDisplayName(userId);
  if (cachedName) {
    displayName = cachedName;
  } else {
    try {
      const profile = await lineClient.getProfile(userId);
      if (profile?.displayName) {
        displayName = profile.displayName;
        setCachedDisplayName(userId, profile.displayName);
      }
    } catch {}
  }

  const user = await getOrCreateUser(userId, displayName);
  if (user?.displayName && !getCachedDisplayName(userId)) {
    setCachedDisplayName(userId, user.displayName);
  }
  const data = event.postback.data ?? '';

  const isDirectUserChat = event.source?.type === 'user';
  if (isDirectUserChat) {
    void startLoadingAnimation(userId, { loadingSeconds: 20 });
  }

  if (data === 'action=confirm_reminder' || data === 'action=confirm_note') {
    const isReminder = data === 'action=confirm_reminder';
    const toolRes = isReminder ? await handleConfirmReminder(user) : await handleConfirmNote(user);

    const replyText = toolRes.message || 'ดำเนินการเรียบร้อยแล้วค่ะ';
    const messages: messagingApi.Message[] = [{ type: 'text', text: replyText }];

    if (toolRes.success && !options?.disableSuggestions) {
      const suggestionBubble = buildFeatureSuggestionBubble({
        actionType: isReminder ? 'confirm_reminder' : 'confirm_note',
        userDoc: user,
      });
      if (suggestionBubble) {
        messages.push(suggestionBubble);
      }
    }

    await lineClient.replyMessage({
      replyToken,
      messages,
    });
    await saveMessages(userId, 'ยืนยัน', replyText);
    return;
  }

  if (data === 'action=cancel_reminder' || data === 'action=cancel_action') {
    const toolRes = await handleCancelAction(user);
    const replyText = toolRes.message || 'ยกเลิกเรียบร้อยแล้วค่ะ';
    const messages: messagingApi.Message[] = [{ type: 'text', text: replyText }];

    if (toolRes.success && !options?.disableSuggestions) {
      const suggestionBubble = buildFeatureSuggestionBubble({
        actionType: 'cancel_action',
        userDoc: user,
      });
      if (suggestionBubble) {
        messages.push(suggestionBubble);
      }
    }

    await lineClient.replyMessage({
      replyToken,
      messages,
    });
    await saveMessages(userId, 'ยกเลิก', replyText);
    return;
  }

  if (data === 'action=change_reminder_time') {
    const selectedDatetime = event.postback.params?.datetime;
    if (!selectedDatetime) {
      return;
    }

    const toolRes = await handleUpdatePendingReminderTime(user, selectedDatetime);
    if (toolRes.flexMessage) {
      await lineClient.replyMessage({
        replyToken,
        messages: [toolRes.flexMessage as messagingApi.FlexMessage],
      });
      const flexAltText =
        (toolRes.flexMessage as { altText?: string }).altText ?? 'เปลี่ยนเวลาแจ้งเตือน';
      await saveMessages(userId, `เปลี่ยนเวลาเป็น ${selectedDatetime}`, flexAltText);
    } else if (toolRes.message) {
      await lineClient.replyMessage({
        replyToken,
        messages: [{ type: 'text', text: toolRes.message }],
      });
      await saveMessages(userId, `เปลี่ยนเวลาเป็น ${selectedDatetime}`, toolRes.message);
    }
    return;
  }
}

/**
 * Handles incoming audio messages by processing voice download, STT transcription,
 * and forwarding recognized text to the conversational text pipeline.
 */
export async function handleAudioMessage(
  event: webhook.MessageEvent & { message: webhook.AudioMessageContent },
): Promise<void> {
  const userId = event.source?.userId;
  const isDirectUserChat = event.source?.type === 'user' && !!userId;
  if (isDirectUserChat) {
    void startLoadingAnimation(userId, { loadingSeconds: 60 });
  }

  await processAudioMessage(event, async (transcribedText) => {
    await handleTextMessage(
      event as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent },
      transcribedText,
      { loadingAlreadyStarted: true },
    );
  });
}

/**
 * Routes a single webhook event to the appropriate message handler.
 * Ignores unsupported message types and non-message events safely.
 */
export async function handleWebhookEvent(event: webhook.Event): Promise<void> {
  if (event.type === 'message') {
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
  } else if (event.type === 'postback') {
    await handlePostbackEvent(event as webhook.PostbackEvent);
  }
}

/**
 * Iterates through webhook events and processes each event safely within an execution deadline.
 * Drops duplicate events and redeliveries via webhookEventId / message.id deduplication.
 * Catches per-event errors so one failed event does not crash or abort processing for others,
 * logging structured telemetry and replying with an elderly-friendly, polite fallback message.
 */
export async function processWebhookEvents(
  events: webhook.Event[],
  options?: { timeoutMs?: number; skipDeduplication?: boolean },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_EVENT_TIMEOUT_MS;

  for (const event of events) {
    if (!options?.skipDeduplication && isEventDuplicate(event)) {
      continue;
    }
    if (!options?.skipDeduplication) {
      markEventProcessed(event);
    }

    try {
      await withTimeout(handleWebhookEvent(event), timeoutMs);
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
