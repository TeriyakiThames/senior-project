import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isVercelPreview, isMockAllowed, isStrictProduction } from '@/lib/utils/env';

describe('Environment detection and mock authorization (env.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('isVercelPreview', () => {
    it('returns true when VERCEL_ENV is preview', () => {
      vi.stubEnv('VERCEL_ENV', 'preview');
      expect(isVercelPreview()).toBe(true);
    });

    it('returns true when NEXT_PUBLIC_VERCEL_ENV is preview', () => {
      vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'preview');
      expect(isVercelPreview()).toBe(true);
    });

    it('returns true on Vercel preview branch hostnames containing -git-', () => {
      const originalWindow = globalThis.window;
      globalThis.window = {
        location: {
          hostname: 'senior-project-git-feat-activity-mock-teriyakithames-projects.vercel.app',
        },
      } as unknown as Window & typeof globalThis;

      expect(isVercelPreview()).toBe(true);

      globalThis.window = originalWindow;
    });

    it('returns false for Vercel production domain', () => {
      const originalWindow = globalThis.window;
      globalThis.window = {
        location: {
          hostname: 'senior-project-eta-two.vercel.app',
        },
      } as unknown as Window & typeof globalThis;

      expect(isVercelPreview()).toBe(false);

      globalThis.window = originalWindow;
    });
  });

  describe('isMockAllowed', () => {
    it('returns true in test environment', () => {
      vi.stubEnv('NODE_ENV', 'test');
      expect(isMockAllowed()).toBe(true);
    });

    it('returns true in development on localhost', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const originalWindow = globalThis.window;
      globalThis.window = {
        location: { hostname: 'localhost' },
      } as unknown as Window & typeof globalThis;

      expect(isMockAllowed()).toBe(true);

      globalThis.window = originalWindow;
    });

    it('returns true in Vercel preview even if NODE_ENV is production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('VERCEL_ENV', 'preview');
      expect(isMockAllowed()).toBe(true);
    });

    it('strictly returns false in production environment when not in preview', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('VERCEL_ENV', 'production');
      const originalWindow = globalThis.window;
      globalThis.window = {
        location: {
          hostname: 'senior-project-eta-two.vercel.app',
        },
      } as unknown as Window & typeof globalThis;

      expect(isMockAllowed()).toBe(false);

      globalThis.window = originalWindow;
    });
  });

  describe('isStrictProduction', () => {
    it('returns true when NODE_ENV is production and not in Vercel preview', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('VERCEL_ENV', 'production');
      expect(isStrictProduction()).toBe(true);
    });

    it('returns false when running in Vercel preview', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('VERCEL_ENV', 'preview');
      expect(isStrictProduction()).toBe(false);
    });

    it('returns false in development', () => {
      vi.stubEnv('NODE_ENV', 'development');
      expect(isStrictProduction()).toBe(false);
    });
  });
});
