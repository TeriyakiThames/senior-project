import { lineClient } from './client';
import { logError } from '@/lib/utils/errors';

export const DEFAULT_LOADING_SECONDS = 60;
export const LOADING_API_TIMEOUT_MS = 2000;

/**
 * Normalizes loading duration in seconds to a valid multiple of 5 between 5 and 60
 * per LINE Messaging API specification.
 */
export function normalizeLoadingSeconds(seconds: number): number {
  if (isNaN(seconds) || seconds < 5) {
    return 5;
  }
  if (seconds > 60) {
    return 60;
  }
  return Math.round(seconds / 5) * 5;
}

export interface StartLoadingAnimationOptions {
  loadingSeconds?: number;
  timeoutMs?: number;
}

/**
 * Displays native LINE loading animation (pulsing "..." bubble) in 1-on-1 chat.
 *
 * Designed to provide immediate visual feedback while heavy background processes
 * (speech-to-text, Gemini dialogue generation, TypeSafe intent classification,
 * tool execution) prepare a response. The animation automatically vanishes as soon
 * as the bot sends its replyMessage, or when loadingSeconds expires.
 *
 * Safe to invoke: guards with an explicit timeout and swallows errors to ensure
 * external LINE API network issues never crash or block the message pipeline.
 *
 * @param chatId LINE user ID (must be a 1-on-1 user chat)
 * @param options.loadingSeconds Duration to display (5 to 60s, multiple of 5; default 60s)
 * @param options.timeoutMs Maximum wait time before continuing pipeline (default 2000ms)
 * @returns Promise<boolean> indicating whether the loading indicator was successfully requested
 */
export async function startLoadingAnimation(
  chatId: string | undefined | null,
  options?: StartLoadingAnimationOptions,
): Promise<boolean> {
  if (!chatId || typeof chatId !== 'string' || !chatId.trim()) {
    return false;
  }

  const rawSeconds = options?.loadingSeconds ?? DEFAULT_LOADING_SECONDS;
  const loadingSeconds = normalizeLoadingSeconds(rawSeconds);
  const timeoutMs = options?.timeoutMs ?? LOADING_API_TIMEOUT_MS;

  try {
    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`LINE showLoadingAnimation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const apiCall = lineClient.showLoadingAnimation({
      chatId: chatId.trim(),
      loadingSeconds,
    });

    await Promise.race([
      apiCall.finally(() => {
        if (timer) clearTimeout(timer);
      }),
      timeoutPromise,
    ]);

    return true;
  } catch (error) {
    // Non-fatal degradation: log structured warning and let main message processing proceed
    logError(
      'line_loading_animation',
      error,
      {
        chatId,
        loadingSeconds,
        timeoutMs,
      },
      'WARNING',
    );
    return false;
  }
}
