import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeLoadingSeconds,
  startLoadingAnimation,
  DEFAULT_LOADING_SECONDS,
} from '@/lib/line/loading';
import { lineClient } from '@/lib/line/client';
import { logError } from '@/lib/utils/errors';

vi.mock('@/lib/line/client', () => ({
  lineClient: {
    showLoadingAnimation: vi.fn(),
  },
}));

vi.mock('@/lib/utils/errors', () => ({
  logError: vi.fn(),
}));

describe('LINE Loading Animation (loading.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeLoadingSeconds', () => {
    it('clamps values below 5 to 5', () => {
      expect(normalizeLoadingSeconds(0)).toBe(5);
      expect(normalizeLoadingSeconds(-10)).toBe(5);
      expect(normalizeLoadingSeconds(4)).toBe(5);
      expect(normalizeLoadingSeconds(NaN)).toBe(5);
    });

    it('clamps values above 60 to 60', () => {
      expect(normalizeLoadingSeconds(61)).toBe(60);
      expect(normalizeLoadingSeconds(100)).toBe(60);
    });

    it('rounds to nearest multiple of 5', () => {
      expect(normalizeLoadingSeconds(11)).toBe(10);
      expect(normalizeLoadingSeconds(12)).toBe(10);
      expect(normalizeLoadingSeconds(13)).toBe(15);
      expect(normalizeLoadingSeconds(14)).toBe(15);
      expect(normalizeLoadingSeconds(27)).toBe(25);
      expect(normalizeLoadingSeconds(28)).toBe(30);
    });

    it('preserves valid multiples of 5 between 5 and 60', () => {
      expect(normalizeLoadingSeconds(5)).toBe(5);
      expect(normalizeLoadingSeconds(20)).toBe(20);
      expect(normalizeLoadingSeconds(35)).toBe(35);
      expect(normalizeLoadingSeconds(60)).toBe(60);
    });
  });

  describe('startLoadingAnimation', () => {
    it('returns false immediately if chatId is falsy or blank', async () => {
      expect(await startLoadingAnimation(undefined)).toBe(false);
      expect(await startLoadingAnimation(null)).toBe(false);
      expect(await startLoadingAnimation('')).toBe(false);
      expect(await startLoadingAnimation('   ')).toBe(false);
      expect(lineClient.showLoadingAnimation).not.toHaveBeenCalled();
    });

    it('calls lineClient.showLoadingAnimation with default 60s and trimmed chatId', async () => {
      vi.mocked(lineClient.showLoadingAnimation).mockResolvedValueOnce({});

      const result = await startLoadingAnimation('  U1234567890abcdef  ');

      expect(result).toBe(true);
      expect(lineClient.showLoadingAnimation).toHaveBeenCalledWith({
        chatId: 'U1234567890abcdef',
        loadingSeconds: DEFAULT_LOADING_SECONDS,
      });
      expect(logError).not.toHaveBeenCalled();
    });

    it('normalizes custom loadingSeconds', async () => {
      vi.mocked(lineClient.showLoadingAnimation).mockResolvedValueOnce({});

      const result = await startLoadingAnimation('U1234567890abcdef', {
        loadingSeconds: 13,
      });

      expect(result).toBe(true);
      expect(lineClient.showLoadingAnimation).toHaveBeenCalledWith({
        chatId: 'U1234567890abcdef',
        loadingSeconds: 15,
      });
    });

    it('catches LINE API errors gracefully, logs warning, and returns false', async () => {
      const apiError = new Error('LINE 500 Internal Server Error');
      vi.mocked(lineClient.showLoadingAnimation).mockRejectedValueOnce(apiError);

      const result = await startLoadingAnimation('U1234567890abcdef');

      expect(result).toBe(false);
      expect(logError).toHaveBeenCalledWith(
        'line_loading_animation',
        apiError,
        expect.objectContaining({
          chatId: 'U1234567890abcdef',
          loadingSeconds: 60,
        }),
        'WARNING',
      );
    });

    it('aborts when API call exceeds timeoutMs, logs warning, and returns false', async () => {
      // Simulate hanging promise
      vi.mocked(lineClient.showLoadingAnimation).mockReturnValueOnce(
        new Promise((resolve) => setTimeout(resolve, 500)),
      );

      const result = await startLoadingAnimation('U1234567890abcdef', {
        timeoutMs: 50,
      });

      expect(result).toBe(false);
      expect(logError).toHaveBeenCalledWith(
        'line_loading_animation',
        expect.objectContaining({
          message: expect.stringContaining('timed out after 50ms'),
        }),
        expect.any(Object),
        'WARNING',
      );
    });
  });
});
