import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseLineError,
  pushLineNotificationWithRetry,
  getLineMessageQuota,
} from '@/lib/line/push';
import type { messagingApi } from '@line/bot-sdk';

describe('LINE Push Resilience & Quota Utilities (push.ts)', () => {
  describe('parseLineError', () => {
    it('detects monthly quota exceeded from status 429 and body', () => {
      const error = new Error('429 - Too Many Requests');
      (error as any).status = 429;
      (error as any).body = JSON.stringify({ message: 'You have reached your monthly limit.' });

      const parsed = parseLineError(error);
      expect(parsed.isQuotaExceeded).toBe(true);
      expect(parsed.isRateLimited).toBe(false);
      expect(parsed.status).toBe(429);
    });

    it('detects throughput rate limiting from status 429 without monthly limit message', () => {
      const error = new Error('429 - Too Many Requests');
      (error as any).status = 429;
      (error as any).body = JSON.stringify({
        message: 'The API rate limit has been exceeded. Try again later.',
      });

      const parsed = parseLineError(error);
      expect(parsed.isQuotaExceeded).toBe(false);
      expect(parsed.isRateLimited).toBe(true);
    });

    it('detects blocked user or invalid recipient from status 400', () => {
      const error = new Error('400 - Bad Request');
      (error as any).status = 400;
      (error as any).body = JSON.stringify({ message: 'User is not a friend or blocked' });

      const parsed = parseLineError(error);
      expect(parsed.isBlockedOrNotFound).toBe(true);
    });

    it('detects transient network errors (502, 503, timeout)', () => {
      const error503 = new Error('503 - Service Unavailable');
      (error503 as any).status = 503;
      expect(parseLineError(error503).isTransientNetworkError).toBe(true);

      const timeoutError = new Error('connect ETIMEDOUT 147.92.149.19:443');
      expect(parseLineError(timeoutError).isTransientNetworkError).toBe(true);
    });
  });

  describe('pushLineNotificationWithRetry', () => {
    let mockClient: { pushMessage: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockClient = {
        pushMessage: vi.fn(),
      };
    });

    it('returns success when push succeeds on first attempt', async () => {
      mockClient.pushMessage.mockResolvedValueOnce({} as any);

      const result = await pushLineNotificationWithRetry({
        to: 'user-1',
        messages: [{ type: 'text', text: 'Hello' }],
        client: mockClient as unknown as messagingApi.MessagingApiClient,
      });

      expect(result.success).toBe(true);
      expect(result.reason).toBe('ok');
      expect(mockClient.pushMessage).toHaveBeenCalledTimes(1);
    });

    it('immediately halts and returns quota_exceeded when monthly limit is reached (no retries)', async () => {
      const quotaError = new Error('429 - Too Many Requests');
      (quotaError as any).status = 429;
      (quotaError as any).body = JSON.stringify({
        message: 'You have reached your monthly limit.',
      });

      mockClient.pushMessage.mockRejectedValue(quotaError);

      const result = await pushLineNotificationWithRetry({
        to: 'user-1',
        messages: [{ type: 'text', text: 'Hello' }],
        maxRetries: 3,
        client: mockClient as unknown as messagingApi.MessagingApiClient,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('quota_exceeded');
      expect(result.status).toBe(429);
      // Crucial: Must NOT retry when quota is exceeded!
      expect(mockClient.pushMessage).toHaveBeenCalledTimes(1);
    });

    it('retries on throughput rate limiting and succeeds when subsequent attempt succeeds', async () => {
      const rateLimitError = new Error('429 - Too Many Requests');
      (rateLimitError as any).status = 429;
      (rateLimitError as any).body = JSON.stringify({ message: 'Rate limit exceeded' });

      mockClient.pushMessage.mockRejectedValueOnce(rateLimitError).mockResolvedValueOnce({} as any);

      const result = await pushLineNotificationWithRetry({
        to: 'user-1',
        messages: [{ type: 'text', text: 'Hello' }],
        maxRetries: 2,
        baseDelayMs: 1,
        client: mockClient as unknown as messagingApi.MessagingApiClient,
      });

      expect(result.success).toBe(true);
      expect(result.reason).toBe('ok');
      expect(mockClient.pushMessage).toHaveBeenCalledTimes(2);
    });

    it('halts and returns blocked when recipient blocked the bot', async () => {
      const blockedError = new Error('400 - Bad Request: user is not a friend');
      (blockedError as any).status = 400;

      mockClient.pushMessage.mockRejectedValue(blockedError);

      const result = await pushLineNotificationWithRetry({
        to: 'user-blocked',
        messages: [{ type: 'text', text: 'Hello' }],
        maxRetries: 2,
        client: mockClient as unknown as messagingApi.MessagingApiClient,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('blocked');
      expect(mockClient.pushMessage).toHaveBeenCalledTimes(1);
    });

    it('fails gracefully when retries are exhausted on transient network errors', async () => {
      const networkError = new Error('connect ETIMEDOUT');
      mockClient.pushMessage.mockRejectedValue(networkError);

      const result = await pushLineNotificationWithRetry({
        to: 'user-1',
        messages: [{ type: 'text', text: 'Hello' }],
        maxRetries: 2,
        baseDelayMs: 1,
        client: mockClient as unknown as messagingApi.MessagingApiClient,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('network_error');
      expect(mockClient.pushMessage).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('getLineMessageQuota', () => {
    it('returns isExhausted false when LINE_CHANNEL_ACCESS_TOKEN is missing', async () => {
      const orig = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      delete process.env.LINE_CHANNEL_ACCESS_TOKEN;

      const result = await getLineMessageQuota();
      expect(result.isExhausted).toBe(false);

      process.env.LINE_CHANNEL_ACCESS_TOKEN = orig;
    });

    it('correctly calculates isExhausted true when totalUsage reaches quota limit', async () => {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';

      const origFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/quota/consumption')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ totalUsage: 300 }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ type: 'limited', value: 300 }),
        });
      });

      const result = await getLineMessageQuota();
      expect(result.isExhausted).toBe(true);
      expect(result.quotaLimit).toBe(300);
      expect(result.totalUsage).toBe(300);

      global.fetch = origFetch;
    });
  });
});
