import { describe, it, expect } from 'vitest';
import { APP_VERSION } from '@/lib/constants/version';
import packageJson from '../../../../package.json';

describe('APP_VERSION', () => {
  it('matches package.json version', () => {
    expect(APP_VERSION).toBe(packageJson.version);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+.*$/);
  });
});
