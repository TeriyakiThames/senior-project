import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isPlaceholderLiffId, shouldEnableMockUser } from '@/components/liff/LiffProvider';

describe('LiffProvider Environment & Mock Safeguards (S7 Security Hardening)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('isPlaceholderLiffId', () => {
    it('returns true for null, undefined, empty, or placeholder strings', () => {
      expect(isPlaceholderLiffId(null)).toBe(true);
      expect(isPlaceholderLiffId(undefined)).toBe(true);
      expect(isPlaceholderLiffId('')).toBe(true);
      expect(isPlaceholderLiffId('   ')).toBe(true);
      expect(isPlaceholderLiffId('placeholder_liff_id')).toBe(true);
      expect(isPlaceholderLiffId('<your-liff-id>')).toBe(true);
    });

    it('returns false for actual production LIFF IDs', () => {
      expect(isPlaceholderLiffId('1234567890-abcdefgh')).toBe(false);
      expect(isPlaceholderLiffId('2001234567-ZYXWVUT')).toBe(false);
    });
  });

  describe('shouldEnableMockUser', () => {
    it('strictly returns false in production environment under all conditions', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('NEXT_PUBLIC_ENABLE_MOCK_USER', 'true');
      expect(shouldEnableMockUser()).toBe(false);
    });

    it('returns true in test environment', () => {
      vi.stubEnv('NODE_ENV', 'test');
      expect(shouldEnableMockUser()).toBe(true);
    });

    it('returns false in non-production when running on remote/staging hostname without explicit opt-in', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('NEXT_PUBLIC_ENABLE_MOCK_USER', '');

      // Mock remote staging hostname
      const originalWindow = globalThis.window;
      // @ts-expect-error Mocking window location for test
      globalThis.window = { location: { hostname: 'staging.senior-project.app' } };

      expect(shouldEnableMockUser()).toBe(false);

      globalThis.window = originalWindow;
    });

    it('returns true in non-production when running on localhost', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('NEXT_PUBLIC_ENABLE_MOCK_USER', '');

      const originalWindow = globalThis.window;
      // @ts-expect-error Mocking window location for test
      globalThis.window = { location: { hostname: 'localhost' } };

      expect(shouldEnableMockUser()).toBe(true);

      globalThis.window = originalWindow;
    });

    it('returns true when explicitly opted-in via NEXT_PUBLIC_ENABLE_MOCK_USER on staging', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('NEXT_PUBLIC_ENABLE_MOCK_USER', 'true');

      const originalWindow = globalThis.window;
      // @ts-expect-error Mocking window location for test
      globalThis.window = { location: { hostname: 'staging.senior-project.app' } };

      expect(shouldEnableMockUser()).toBe(true);

      globalThis.window = originalWindow;
    });
  });
});
