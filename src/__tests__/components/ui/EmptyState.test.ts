import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleCloseOrRedirectToLine } from '@/components/ui/EmptyState';
import liff from '@line/liff';

vi.mock('@line/liff', () => ({
  default: {
    isInClient: vi.fn(),
    closeWindow: vi.fn(),
  },
}));

describe('handleCloseOrRedirectToLine (EmptyState CTA action)', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error Mocking window location for redirect tests
    delete globalThis.window;
    globalThis.window = {
      location: { href: '' },
    } as unknown as Window & typeof globalThis;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  it('invokes custom onAction callback when provided', () => {
    const onAction = vi.fn();
    handleCloseOrRedirectToLine(onAction);

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(liff.closeWindow).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
  });

  it('calls liff.closeWindow() when running inside LINE client', () => {
    vi.mocked(liff.isInClient).mockReturnValue(true);

    handleCloseOrRedirectToLine();

    expect(liff.isInClient).toHaveBeenCalled();
    expect(liff.closeWindow).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe('');
  });

  it('redirects to LINE universal link when running in external browser', () => {
    vi.mocked(liff.isInClient).mockReturnValue(false);

    handleCloseOrRedirectToLine();

    expect(liff.isInClient).toHaveBeenCalled();
    expect(liff.closeWindow).not.toHaveBeenCalled();
    expect(window.location.href).toBe('https://line.me/R/');
  });

  it('gracefully falls back to redirect when liff throws an error', () => {
    vi.mocked(liff.isInClient).mockImplementation(() => {
      throw new Error('LIFF not initialized');
    });

    handleCloseOrRedirectToLine();

    expect(window.location.href).toBe('https://line.me/R/');
  });
});
