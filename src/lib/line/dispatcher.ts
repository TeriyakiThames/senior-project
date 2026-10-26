import { webhook } from '@line/bot-sdk';
import { lineClient } from './client';
import { processAudioMessage, getUserProfile } from '@/lib/speech/handler';
import { resolvePersonaParticles } from '@/lib/ai/persona';
import { AppError, logError, getFallbackMessage, type ErrorStage } from '@/lib/utils/errors';

export const DEFAULT_EVENT_TIMEOUT_MS = 50_000;
export const DEFAULT_DEDUP_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * In-memory deduplication cache tracking processed event IDs and message IDs with timestamps.
 */
const processedEventCache = new Map<string, number>();

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
 * Handles incoming text messages by replying with an echo / acknowledgement.
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
  const userText = rawText.trim();
  const replyText = `ได้รับข้อความแล้ว: "${userText}"`;

  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: 'text',
        text: replyText,
      },
    ],
  });
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
