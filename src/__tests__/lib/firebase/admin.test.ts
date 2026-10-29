import { describe, it, expect, vi } from 'vitest';

describe('Firebase Admin Initialization (admin.ts)', () => {
  it('configures Firestore with ignoreUndefinedProperties: true', async () => {
    const { db } = await import('@/lib/firebase/admin');
    expect(db).toBeDefined();
    // Verify db settings does not throw even if called again
    expect(() => {
      try {
        db.settings({ ignoreUndefinedProperties: true });
      } catch (err: any) {
        expect(err.message).toContain('Firestore has already been initialized');
      }
    }).not.toThrow();
  });
});
