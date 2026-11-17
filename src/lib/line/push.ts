import { lineClient } from './client';
import { logError } from '@/lib/utils/errors';
import type { messagingApi } from '@line/bot-sdk';

export interface LineErrorInfo {
  isQuotaExceeded: boolean;
  isRateLimited: boolean;
  isBlockedOrNotFound: boolean;
  isTransientNetworkError: boolean;
  status?: number;
  body?: string;
  message: string;
}

export function parseLineError(error: unknown): LineErrorInfo {
  let status: number | undefined;
  let body: string | undefined;
  let message = '';

  if (error instanceof Error) {
    message = error.message;
    if ('status' in error && typeof (error as { status?: unknown }).status === 'number') {
      status = (error as { status: number }).status;
    } else if (
      'statusCode' in error &&
      typeof (error as { statusCode?: unknown }).statusCode === 'number'
    ) {
      status = (error as { statusCode: number }).statusCode;
    }
    if ('body' in error && typeof (error as { body?: unknown }).body === 'string') {
      body = (error as { body: string }).body;
    }
  } else if (typeof error === 'string') {
    message = error;
  }

  // Check if status code is present in error message (e.g. "429 - Too Many Requests")
  if (!status) {
    const match = message.match(/\b(429|400|401|403|404|500|502|503|504)\b/);
    if (match) {
      status = parseInt(match[1], 10);
    }
  }

  const combined = `${message} ${body || ''}`.toLowerCase();

  // LINE returns 429 for monthly push quota exhaustion with messages like:
  // {"message":"You have reached your monthly limit."}
  const isQuotaExceeded =
    status === 429 &&
    (combined.includes('monthly limit') ||
      combined.includes('monthly_limit') ||
      combined.includes('quota') ||
      combined.includes('limit has been reached') ||
      combined.includes('reached your monthly limit'));

  // Transient throughput rate limiting (token bucket / requests per second)
  const isRateLimited = status === 429 && !isQuotaExceeded;

  const isBlockedOrNotFound =
    status === 400 &&
    (combined.includes('not a friend') ||
      combined.includes('blocked') ||
      combined.includes('user not found') ||
      combined.includes('failed to send messages'));

  const isTransientNetworkError =
    status === 502 ||
    status === 503 ||
    status === 504 ||
    combined.includes('econnreset') ||
    combined.includes('etimedout') ||
    combined.includes('timeout') ||
    combined.includes('network error') ||
    combined.includes('fetch failed');

  return {
    isQuotaExceeded,
    isRateLimited,
    isBlockedOrNotFound,
    isTransientNetworkError,
    status,
    body,
    message,
  };
}

export interface PushNotificationOptions {
  to: string;
  messages: messagingApi.Message[];
  maxRetries?: number;
  baseDelayMs?: number;
  client?: messagingApi.MessagingApiClient;
}

export interface LinePushResult {
  success: boolean;
  status?: number;
  reason?: 'ok' | 'quota_exceeded' | 'rate_limited' | 'blocked' | 'network_error' | 'unknown_error';
  errorMessage?: string;
  errorBody?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Pushes a notification card to LINE with resilient rate limiting backoff,
 * immediate quota exhaustion detection, and safe circuit breaker semantics.
 */
export async function pushLineNotificationWithRetry(
  opts: PushNotificationOptions,
): Promise<LinePushResult> {
  const {
    to,
    messages,
    maxRetries = 2,
    baseDelayMs = process.env.NODE_ENV === 'test' ? 1 : 1000,
    client = lineClient,
  } = opts;

  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      await client.pushMessage({
        to,
        messages,
      });
      return { success: true, reason: 'ok', status: 200 };
    } catch (error) {
      const parsed = parseLineError(error);

      if (parsed.isQuotaExceeded) {
        logError(
          'line_push',
          error,
          {
            userId: to,
            reason: 'monthly_quota_exceeded',
            errorBody: parsed.body,
            instruction:
              'LINE Official Account monthly push message quota reached. Upgrade OA tier in LINE Official Account Manager or wait for monthly reset.',
          },
          'ALERT',
        );
        return {
          success: false,
          status: 429,
          reason: 'quota_exceeded',
          errorMessage: parsed.message,
          errorBody: parsed.body,
        };
      }

      if (parsed.isBlockedOrNotFound) {
        logError(
          'line_push',
          error,
          { userId: to, reason: 'user_blocked_or_not_found' },
          'WARNING',
        );
        return {
          success: false,
          status: 400,
          reason: 'blocked',
          errorMessage: parsed.message,
          errorBody: parsed.body,
        };
      }

      const isRetryable = parsed.isRateLimited || parsed.isTransientNetworkError;
      if (isRetryable && attempt < maxRetries) {
        attempt++;
        const jitter = process.env.NODE_ENV === 'test' ? 0 : Math.floor(Math.random() * 300);
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
        logError(
          'line_push_retry',
          error,
          {
            userId: to,
            attempt,
            delayMs: delay,
            reason: parsed.isRateLimited ? 'rate_limited' : 'network_error',
          },
          'WARNING',
        );
        await sleep(delay);
        continue;
      }

      logError(
        'line_push',
        error,
        {
          userId: to,
          attempts: attempt + 1,
          reason: parsed.isRateLimited
            ? 'rate_limited'
            : parsed.isTransientNetworkError
              ? 'network_error'
              : 'unknown_error',
        },
        'ERROR',
      );

      return {
        success: false,
        status: parsed.status || 500,
        reason: parsed.isRateLimited
          ? 'rate_limited'
          : parsed.isTransientNetworkError
            ? 'network_error'
            : 'unknown_error',
        errorMessage: parsed.message,
        errorBody: parsed.body,
      };
    }
  }

  return {
    success: false,
    status: 500,
    reason: 'unknown_error',
    errorMessage: 'Exceeded maximum push attempts',
  };
}

/**
 * Checks channel message quota status directly from the LINE Messaging API.
 */
export async function getLineMessageQuota(): Promise<{
  quotaType?: string;
  quotaLimit?: number;
  totalUsage?: number;
  isExhausted: boolean;
}> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    return { isExhausted: false };
  }
  try {
    const [quotaRes, consRes] = await Promise.all([
      fetch('https://api.line.me/v2/bot/message/quota', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch('https://api.line.me/v2/bot/message/quota/consumption', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    let quotaLimit: number | undefined;
    let quotaType: string | undefined;
    let totalUsage: number | undefined;

    if (quotaRes.ok) {
      const qData = (await quotaRes.json()) as { type?: string; value?: number };
      quotaType = qData.type;
      quotaLimit = qData.value;
    }

    if (consRes.ok) {
      const cData = (await consRes.json()) as { totalUsage?: number };
      totalUsage = cData.totalUsage;
    }

    const isExhausted =
      typeof quotaLimit === 'number' && typeof totalUsage === 'number' && totalUsage >= quotaLimit;

    return { quotaType, quotaLimit, totalUsage, isExhausted };
  } catch {
    return { isExhausted: false };
  }
}
